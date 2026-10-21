import { create } from 'zustand';
import { defaultSettings, type Settings, type Presentation } from './model';
interface AppState {
  settings: Settings;
  deck: Presentation | null;
  page: number;
  revision: number;
  setSettings: (settings: Settings) => void;
  setDeck: (deck: Presentation | null) => void;
  go: (page: number) => void;
  reset: () => void;
}
export const useApp = create<AppState>((set, get) => ({
  settings: structuredClone(defaultSettings),
  deck: null,
  page: 0,
  revision: 0,
  setSettings: (settings) => set({ settings }),
  setDeck: (deck) => {
    get().deck?.dispose();
    set({ deck, page: 0, revision: get().revision + 1 });
  },
  go: (page) => {
    const d = get().deck;
    if (d && page >= 0 && page < d.slides.length && page !== get().page)
      set({ page, revision: get().revision + 1 });
  },
  reset: () => set({ revision: get().revision + 1 }),
}));
let saveTimer: ReturnType<typeof setTimeout>;
export function updateSettings(partial: Partial<Settings>) {
  const settings = { ...useApp.getState().settings, ...partial };
  useApp.getState().setSettings(settings);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (window.desktop)
      void window.desktop.saveSettings(settings).catch((e) => console.error('配置保存失败', e));
    else localStorage.setItem('listeningslide-settings', JSON.stringify(settings));
  }, 180);
}
