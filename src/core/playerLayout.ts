import type { PlayerSettings } from './model';
import { clampPlayer } from './gestures';

export function placePlayer(
  saved: PlayerSettings,
  occupied: PlayerSettings[],
  viewport: { w: number; h: number },
): PlayerSettings {
  const width = Math.min(saved.width, viewport.w - 16);
  const height = Math.min(saved.height, viewport.h - 16);
  const base = clampPlayer(
    saved.x < 0 ? viewport.w - width - 28 : saved.x,
    saved.y < 0 ? viewport.h - height - 28 : saved.y,
    width,
    height,
    viewport.w,
    viewport.h,
  );
  const used = occupied.map((item) => {
    const w = item.collapsed ? 56 : Math.min(item.width, viewport.w - 16);
    const h = item.collapsed ? 56 : item.height;
    return {
      ...clampPlayer(item.x, item.y, w, h, viewport.w, viewport.h),
      w,
      h,
    };
  });
  const candidates = [base];
  for (let y = viewport.h - height - 28; y >= 8; y -= height + 12)
    for (let x = viewport.w - width - 28; x >= 8; x -= width + 12) candidates.push({ x, y });
  const free = candidates.find(({ x, y }) =>
    used.every(
      (item) =>
        x + width + 8 <= item.x ||
        item.x + item.w + 8 <= x ||
        y + height + 8 <= item.y ||
        item.y + item.h + 8 <= y,
    ),
  );
  const position =
    free ||
    clampPlayer(
      base.x - occupied.length * 32,
      base.y - occupied.length * 38,
      width,
      height,
      viewport.w,
      viewport.h,
    );
  return { ...saved, ...position, width, height, collapsed: false };
}
