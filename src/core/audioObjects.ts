export interface AudioHit {
  id: string | null;
}
function validArea(area: { x: number; y: number }[]) {
  return (
    area.length >= 3 &&
    Math.abs(
      area.reduce((sum, a, i) => {
        const b = area[(i + 1) % area.length];
        return sum + a.x * b.y - b.x * a.y;
      }, 0),
    ) >= 1e-7
  );
}
export function pointInAudioArea(
  point: { x: number; y: number },
  area: { x: number; y: number }[],
) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !validArea(area)) return false;
  let positive = false,
    negative = false;
  for (let i = 0; i < area.length; i++) {
    const a = area[i],
      b = area[(i + 1) % area.length];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross > 1e-7) positive = true;
    if (cross < -1e-7) negative = true;
  }
  return !(positive && negative);
}

/** Expand tiny audio targets for fingers without changing the slide artwork. */
export function pointNearAudioArea(
  point: { x: number; y: number },
  area: { x: number; y: number }[],
  padding: number,
) {
  if (pointInAudioArea(point, area)) return true;
  if (padding <= 0 || !validArea(area)) return false;
  return area.some((a, i) => {
    const b = area[(i + 1) % area.length];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length
      ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length))
      : 0;
    return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy) <= padding;
  });
}
