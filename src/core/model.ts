export interface AudioTrack {
  id: string;
  shapeId: string;
  name: string;
  src: string;
  trimStart: number;
  trimEnd: number;
  trimError?: string;
}
export interface Slide {
  id: string;
  thumbnail?: string;
  audios: AudioTrack[];
}
export interface Presentation {
  width: number;
  height: number;
  slides: Slide[];
  warnings: string[];
  converted: import('../slideshow/types').ConvertedPresentation;
  dispose: () => void;
}
export interface RecentFile {
  path: string;
  name: string;
  openedAt: string;
}
export interface PlayerSettings {
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  opacity: number;
}
export interface Settings {
  player: PlayerSettings;
  endBehavior: 'hold' | 'restart';
  recent: RecentFile[];
}
export const defaultPlayer: PlayerSettings = {
  x: -1,
  y: -1,
  width: 392,
  height: 224,
  collapsed: false,
  opacity: 0.94,
};
export const defaultSettings: Settings = { player: defaultPlayer, endBehavior: 'hold', recent: [] };
export interface OpenedFile {
  name: string;
  path: string;
  data: Uint8Array;
}
export interface DesktopAPI {
  convertPresentation: (
    data: Uint8Array,
  ) => Promise<import('../slideshow/types').ConvertedPresentation>;
  openFile: () => Promise<OpenedFile | null>;
  openDemo: () => Promise<OpenedFile>;
  openRecent: (path: string) => Promise<OpenedFile>;
  openDropped: (file: File) => Promise<OpenedFile>;
  getInitialFile: () => Promise<OpenedFile | null>;
  getSettings: () => Promise<Settings & { dataDirectory?: string; storageWarning?: string }>;
  saveSettings: (settings: Settings) => Promise<void>;
  getFullscreen: () => Promise<boolean>;
  onFullscreenChanged: (callback: (value: boolean) => void) => () => void;
  setFullscreen: (full: boolean) => Promise<boolean>;
  onOpenFile: (callback: (file: OpenedFile) => void) => () => void;
}
declare global {
  interface Window {
    desktop?: DesktopAPI;
  }
}
