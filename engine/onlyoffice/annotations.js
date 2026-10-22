/* ListeningSlide adapter for the pinned ONLYOFFICE 10.0.0 slideshow ink API.
 * Upstream sources remain unmodified. Ink lives in SlideShowAnnotations only. */
'use strict';
window.createSlideshowAnnotations = function (api, Asc, common) {
  let tool = 'none';
  let stroke = null;
  const manager = () => api.WordControl.DemonstrationManager;
  function finish() {
    if (!stroke) return;
    const last = stroke;
    stroke = null;
    try {
      api.WordControl.m_oLogicDocument.OnMouseUp(
        common.global_mouseEvent,
        last.x,
        last.y,
        last.page,
      );
    } finally {
      common.global_mouseEvent.UnLockMouse();
    }
  }
  return {
    finish,
    setTool(settings) {
      finish();
      tool = settings?.tool;
      if (tool === 'none') return api.asc_StopInkDrawer();
      if (tool === 'eraser') return api.asc_StartInkEraser();
      if (!['pen', 'highlighter'].includes(tool) || !/^#[\da-f]{6}$/i.test(settings.color))
        throw new Error('无效的批注工具');
      const color = new Asc.asc_CColor();
      color.put_r(parseInt(settings.color.slice(1, 3), 16));
      color.put_g(parseInt(settings.color.slice(3, 5), 16));
      color.put_b(parseInt(settings.color.slice(5, 7), 16));
      const pen = new Asc.asc_CStroke();
      pen.put_type(Asc.c_oAscStrokeType.STROKE_COLOR);
      pen.put_color(color);
      pen.asc_putPrstDash(Asc.c_oDashType.solid);
      // Public stroke properties; keep the pinned upstream renderer untouched.
      pen.asc_putLinecap(Asc.c_oAscLineCapType.Round);
      pen.asc_putLinejoin(Asc.c_oAscLineJoinType.Round);
      pen.put_width(Math.max(0.5, Math.min(12, Number(settings.width) || 1)));
      pen.put_transparent(tool === 'highlighter' ? 127 : 255);
      api.asc_StartDrawInk(pen);
    },
    pointer(data) {
      const dm = manager();
      if (tool === 'none' || !api.isInkDrawerOn() || data.slideIndex !== dm.SlideNum) return;
      if (!['down', 'move', 'up', 'cancel'].includes(data.phase)) return;
      if (data.phase === 'cancel') {
        if (stroke?.id === data.id) finish();
        return;
      }
      if (data.phase === 'move' && Array.isArray(data.points)) {
        for (const point of data.points.slice(-64))
          this.pointer({ ...data, points: undefined, x: point.x, y: point.y });
        return;
      }
      if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
      if (data.phase === 'down') {
        if (stroke || data.x < 0 || data.x > 1 || data.y < 0 || data.y > 1) return;
      } else if (!stroke || stroke.id !== data.id) return;
      const event = {
        pageX: data.x * dm.Canvas.clientWidth,
        pageY: data.y * dm.Canvas.clientHeight,
        button: 0,
        preventDefault() {},
        stopPropagation() {},
      };
      // Use the SDK's own retina/letterbox coordinate conversion, then send
      // only drawing input to the document. No slideshow click/swipe fallback.
      const point = dm.documentMouseInfo(event);
      if (!point) {
        if (data.phase === 'up') finish();
        return;
      }
      stroke = { ...point, id: data.id };
      const doc = api.WordControl.m_oLogicDocument;
      if (data.phase === 'down') {
        common.global_mouseEvent.LockMouse();
        doc.OnMouseDown(common.global_mouseEvent, point.x, point.y, point.page);
      } else if (data.phase === 'move') {
        doc.OnMouseMove(common.global_mouseEvent, point.x, point.y, point.page);
      } else finish();
    },
    clear() {
      finish();
      api.asc_EraseAllInksOnSlide();
    },
  };
};
