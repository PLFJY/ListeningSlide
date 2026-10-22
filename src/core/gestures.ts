export interface Point {
  x: number;
  y: number;
}
export type Gesture = 'next' | 'previous' | 'tap' | 'none';
export function isTapMovement(start: Point, end: Point, maxDistance = 0) {
  return Math.max(maxDistance, Math.hypot(end.x - start.x, end.y - start.y)) < 12;
}
// Horizontal intent and a minimum distance prevent diagonal scrolling / finger jitter from paging.
export function classifyGesture(
  start: Point,
  end: Point,
  elapsed: number,
  maxDistance = Math.hypot(end.x - start.x, end.y - start.y),
): Gesture {
  const dx = end.x - start.x,
    dy = end.y - start.y;
  if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && elapsed < 1600)
    return dx < 0 ? 'next' : 'previous';
  if (isTapMovement(start, end, maxDistance) && elapsed < 650) return 'tap';
  return 'none';
}
export function clampPlayer(
  x: number,
  y: number,
  width: number,
  height: number,
  vw: number,
  vh: number,
) {
  return {
    x: Math.max(0, Math.min(x, Math.max(0, vw - width))),
    y: Math.max(0, Math.min(y, Math.max(0, vh - height))),
  };
}
