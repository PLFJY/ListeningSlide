export interface AudioBounds {
  start: number;
  end: number;
  duration: number;
}
export function audioBounds(duration: number, trimStart: number, trimEnd: number): AudioBounds {
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error('无法读取原始音频时长，请检查媒体文件或编码格式。');
  if (
    ![trimStart, trimEnd].every((n) => Number.isFinite(n) && n >= 0) ||
    trimStart + trimEnd >= duration
  )
    throw new Error('课件中的音频裁剪范围无效，已阻止播放。');
  return { start: trimStart, end: duration - trimEnd, duration: duration - trimStart - trimEnd };
}
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export function relativeToAbsolute(relative: number, bounds: AudioBounds) {
  return clamp(relative, 0, bounds.duration) + bounds.start;
}
export function timeLabel(seconds: number) {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}
