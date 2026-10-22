import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import type { AnnotationPointer, AnnotationSettings } from '../src/slideshow/types';

interface InkAdapter {
  setTool(settings: AnnotationSettings): void;
  pointer(data: AnnotationPointer): void;
  finish(): void;
  clear(): void;
}
function setup() {
  const window: { createSlideshowAnnotations?: (...args: unknown[]) => InkAdapter } = {};
  runInNewContext(readFileSync('engine/onlyoffice/annotations.js', 'utf8'), { window });
  const doc = { OnMouseDown: vi.fn(), OnMouseMove: vi.fn(), OnMouseUp: vi.fn() };
  const dm = {
    SlideNum: 0,
    Canvas: { clientWidth: 1000, clientHeight: 600 },
    documentMouseInfo: vi.fn(({ pageX, pageY }) => ({
      x: pageX / 2,
      y: pageY / 2,
      page: dm.SlideNum,
    })),
  };
  let active = false;
  const api = {
    WordControl: { DemonstrationManager: dm, m_oLogicDocument: doc },
    asc_StopInkDrawer: vi.fn(() => {
      active = false;
    }),
    asc_StartInkEraser: vi.fn(() => {
      active = true;
    }),
    asc_StartDrawInk: vi.fn((pen: Pen) => {
      active = true;
      return pen;
    }),
    asc_EraseAllInksOnSlide: vi.fn(),
    isInkDrawerOn: () => active,
  };
  const mouse = { LockMouse: vi.fn(), UnLockMouse: vi.fn() };
  class Color {
    put_r = vi.fn();
    put_g = vi.fn();
    put_b = vi.fn();
  }
  class Pen {
    put_type = vi.fn();
    put_color = vi.fn();
    asc_putPrstDash = vi.fn();
    asc_putLinecap = vi.fn();
    asc_putLinejoin = vi.fn();
    put_width = vi.fn();
    put_transparent = vi.fn();
  }
  const ink = window.createSlideshowAnnotations!(
    api,
    {
      asc_CColor: Color,
      asc_CStroke: Pen,
      c_oAscStrokeType: { STROKE_COLOR: 1 },
      c_oDashType: { solid: 0 },
      c_oAscLineCapType: { Round: 1 },
      c_oAscLineJoinType: { Round: 1 },
    },
    { global_mouseEvent: mouse },
  );
  const settings: AnnotationSettings = { tool: 'pen', color: '#FF3B30', width: 2 };
  const point: AnnotationPointer = { phase: 'down', id: 1, slideIndex: 0, x: 0.2, y: 0.4 };
  return { ink, api, dm, doc, mouse, settings, point };
}

describe('ONLYOFFICE slideshow ink adapter', () => {
  it('uses native stroke settings and translucent highlighter ink', () => {
    const { ink, api, settings } = setup();
    ink.setTool({ ...settings, tool: 'highlighter', width: 6 });
    const pen = api.asc_StartDrawInk.mock.calls[0][0];
    expect(pen.put_width).toHaveBeenCalledWith(6);
    expect(pen.put_transparent).toHaveBeenCalledWith(127);
    expect(pen.asc_putLinecap).toHaveBeenCalledWith(1);
    expect(pen.asc_putLinejoin).toHaveBeenCalledWith(1);
    ink.setTool({ ...settings, tool: 'eraser' });
    expect(api.asc_StartInkEraser).toHaveBeenCalledOnce();
    ink.setTool({ ...settings, tool: 'none' });
    expect(api.asc_StopInkDrawer).toHaveBeenCalledOnce();
  });
  it('preserves coalesced stylus points in order without connecting secondary touches', () => {
    const { ink, settings, point, doc, mouse } = setup();
    ink.setTool(settings);
    ink.pointer(point);
    ink.pointer({
      ...point,
      phase: 'move',
      points: [
        { x: 0.3, y: 0.4 },
        { x: 0.4, y: 0.4 },
        { x: 0.5, y: 0.4 },
      ],
    });
    expect(doc.OnMouseMove.mock.calls).toEqual([
      [mouse, 150, 120, 0],
      [mouse, 200, 120, 0],
      [mouse, 250, 120, 0],
    ]);
    ink.pointer({ ...point, phase: 'move', id: 2, points: [{ x: 0.9, y: 0.9 }] });
    expect(doc.OnMouseMove).toHaveBeenCalledTimes(3);
  });
  it('maps normalized coordinates through the SDK and finishes exactly one stroke', () => {
    const { ink, settings, point, doc, mouse } = setup();
    ink.setTool(settings);
    ink.pointer(point);
    ink.pointer({ ...point, phase: 'move', x: 0.5 });
    ink.pointer({ ...point, phase: 'up', x: 0.6 });
    ink.finish();
    expect(doc.OnMouseDown).toHaveBeenCalledWith(mouse, 100, 120, 0);
    expect(doc.OnMouseMove).toHaveBeenCalledWith(mouse, 250, 120, 0);
    expect(doc.OnMouseUp).toHaveBeenCalledWith(mouse, 300, 120, 0);
    expect(doc.OnMouseUp).toHaveBeenCalledOnce();
    expect(mouse.UnLockMouse).toHaveBeenCalledOnce();
  });
  it('ignores stale pages, stray moves and secondary pointers without losing the active stroke', () => {
    const { ink, settings, point, doc } = setup();
    ink.setTool(settings);
    ink.pointer({ ...point, slideIndex: 1 });
    ink.pointer({ ...point, phase: 'move' });
    ink.pointer(point);
    ink.pointer({ ...point, id: 2 });
    ink.pointer({ ...point, id: 2, phase: 'up' });
    expect(doc.OnMouseDown).toHaveBeenCalledOnce();
    expect(doc.OnMouseMove).not.toHaveBeenCalled();
    expect(doc.OnMouseUp).not.toHaveBeenCalled();
    ink.pointer({ ...point, phase: 'cancel' });
    expect(doc.OnMouseUp).toHaveBeenCalledOnce();
  });
  it('finishes writing before clearing or switching tools, and ignores browsing input', () => {
    const { ink, settings, point, doc, api } = setup();
    ink.pointer(point);
    expect(doc.OnMouseDown).not.toHaveBeenCalled();
    ink.setTool(settings);
    ink.pointer(point);
    ink.clear();
    expect(doc.OnMouseUp).toHaveBeenCalledOnce();
    expect(api.asc_EraseAllInksOnSlide).toHaveBeenCalledOnce();
    ink.pointer(point);
    ink.setTool({ ...settings, tool: 'none' });
    ink.pointer({ ...point, phase: 'move' });
    expect(doc.OnMouseUp).toHaveBeenCalledTimes(2);
    expect(doc.OnMouseMove).not.toHaveBeenCalled();
  });
});
