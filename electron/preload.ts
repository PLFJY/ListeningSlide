import { contextBridge, ipcRenderer, webUtils } from 'electron';
contextBridge.exposeInMainWorld('desktop', {
  convertPresentation: (data: Uint8Array) => ipcRenderer.invoke('onlyoffice:convert', data),
  openFile: () => ipcRenderer.invoke('file:open'),
  openDemo: () => ipcRenderer.invoke('file:demo'),
  openRecent: (path: string) => ipcRenderer.invoke('file:recent', path),
  openDropped: (file: File) => ipcRenderer.invoke('file:drop', webUtils.getPathForFile(file)),
  getInitialFile: () => ipcRenderer.invoke('file:initial'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),
  getFullscreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  onFullscreenChanged: (callback: (value: boolean) => void) => {
    const listener = (_event: unknown, value: boolean) => callback(value);
    ipcRenderer.on('window:fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('window:fullscreen-changed', listener);
  },
  setFullscreen: (value: boolean) => ipcRenderer.invoke('window:fullscreen', value),
  onOpenFile: (callback: (file: unknown) => void) => {
    const listener = (_event: unknown, file: unknown) => callback(file);
    ipcRenderer.on('file:opened', listener);
    return () => ipcRenderer.removeListener('file:opened', listener);
  },
});
