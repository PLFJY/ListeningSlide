export interface AudioHit {
  id: string | null;
}
export function pointInAudioArea(
  point: { x: number; y: number },
  area: { x: number; y: number }[],
) {
  if (
    area.length < 3 ||
    Math.abs(
      area.reduce((sum, a, i) => {
        const b = area[(i + 1) % area.length];
        return sum + a.x * b.y - b.x * a.y;
      }, 0),
    ) < 1e-7
  )
    return false;
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
