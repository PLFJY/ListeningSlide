export type Appearance = 'system' | 'light' | 'dark';
const systemAppearance = matchMedia('(prefers-color-scheme: dark)');
let preference: Appearance = 'system';
try {
  const saved = localStorage.getItem('listeningslide-appearance');
  if (saved === 'light' || saved === 'dark') preference = saved;
} catch {
  /* Appearance still works when local storage is unavailable. */
}
export const getAppearance = () => preference;
function applyAppearance() {
  document.documentElement.dataset.theme =
    preference === 'system' ? (systemAppearance.matches ? 'dark' : 'light') : preference;
}
export function setAppearance(value: Appearance) {
  preference = value;
  applyAppearance();
  try {
    localStorage.setItem('listeningslide-appearance', value);
  } catch {
    /* Session-only preference. */
  }
}
applyAppearance();
systemAppearance.addEventListener('change', applyAppearance);
