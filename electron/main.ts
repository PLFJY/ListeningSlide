import { app, BrowserWindow, dialog, ipcMain, session, protocol } from 'electron';
import { promises as fs, constants } from 'node:fs';
import path from 'node:path';
import { convertPresentation } from './onlyoffice';
import { createConversionQueue } from './conversionQueue';
import { defaultSettings, type Settings } from '../src/core/model';
let win: BrowserWindow | null = null;
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'listeningslide',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);
let settings: Settings = structuredClone(defaultSettings);
let dataDirectory = '',
  storageWarning = '',
  initialPath: string | undefined;
const findPptx = (args: string[]) =>
  args.find((arg) => /\.pptx$/i.test(arg) && !arg.startsWith('--'));
initialPath = findPptx(process.argv.slice(1));
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', async (_event, args) => {
    win?.show();
    win?.focus();
    const file = findPptx(args);
    if (file) await sendFile(file);
  });
  app.on('open-file', (event, file) => {
    event.preventDefault();
    if (win) void sendFile(file);
    else initialPath = file;
  });
  app.whenReady().then(start);
  app.on('window-all-closed', () => app.quit());
}
async function setupData() {
  // electron-builder's portable executable unpacks to TEMP; use the original EXE directory.
  const base =
    process.env.PORTABLE_EXECUTABLE_DIR ||
    (app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath());
  const preferred = path.join(base, 'Data');
  try {
    await fs.mkdir(preferred, { recursive: true });
    await fs.access(preferred, constants.W_OK);
    dataDirectory = preferred;
  } catch {
    dataDirectory = path.join(app.getPath('userData'), 'Data');
    await fs.mkdir(dataDirectory, { recursive: true });
    storageWarning = '程序目录不可写，配置已保存至用户数据目录。';
  }
  try {
    settings = cleanSettings(
      JSON.parse(await fs.readFile(path.join(dataDirectory, 'settings.json'), 'utf8')),
    );
  } catch {
    /* first launch / damaged settings: safe defaults */
  }
}
function cleanSettings(raw: any): Settings {
  const num = (v: unknown, def: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
  const p = raw?.player || {},
    d = defaultSettings.player;
  return {
    player: {
      x: num(p.x, d.x, -1, 30000),
      y: num(p.y, d.y, -1, 30000),
      width: num(p.width, d.width, 280, 4000),
      height: num(p.height, d.height, 208, 360),
      collapsed: typeof p.collapsed === 'boolean' ? p.collapsed : d.collapsed,
      opacity: num(p.opacity, d.opacity, 0.4, 1),
    },
    endBehavior: raw?.endBehavior === 'restart' ? 'restart' : 'hold',
    recent: Array.isArray(raw?.recent)
      ? raw.recent
          .filter(
            (r: any) =>
              r &&
              typeof r.path === 'string' &&
              /\.pptx$/i.test(r.path) &&
              typeof r.name === 'string' &&
              typeof r.openedAt === 'string',
          )
          .slice(0, 12)
      : [],
  };
}
let saving = Promise.resolve();
function persist() {
  const json = JSON.stringify(settings, null, 2);
  saving = saving
    .catch(() => {})
    .then(async () => {
      const file = path.join(dataDirectory, 'settings.json');
      await fs.writeFile(`${file}.tmp`, json);
      await fs.rename(`${file}.tmp`, file);
    });
  return saving;
}
async function readFile(file: string, remember = true) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || !/\.pptx$/i.test(file))
    throw new Error('请选择 PPTX 文件。');
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > 256 * 1024 * 1024) throw new Error('课件不能超过 256 MB。');
  const data = await fs.readFile(file);
  if (data[0] !== 0x50 || data[1] !== 0x4b) throw new Error('文件不是有效的 PPTX 压缩包。');
  if (remember)
    settings.recent = [
      { path: file, name: path.basename(file), openedAt: new Date().toISOString() },
      ...settings.recent.filter((r) => r.path !== file),
    ].slice(0, 12);
  await persist();
  return { path: file, name: path.basename(file), data: new Uint8Array(data) };
}
async function sendFile(file: string) {
  try {
    win?.webContents.send('file:opened', await readFile(file));
  } catch (e) {
    await dialog.showMessageBox({ type: 'error', message: '无法打开课件', detail: String(e) });
  }
}
async function start() {
  await setupData();
  const staticRoot = path.resolve(__dirname, '../dist');
  protocol.handle('listeningslide', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'app' || request.method !== 'GET')
      return new Response('Forbidden', { status: 403 });
    let file: string;
    try {
      file = path.resolve(
        staticRoot,
        '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname),
      );
    } catch {
      return new Response('Bad path', { status: 400 });
    }
    if (!file.startsWith(staticRoot + path.sep)) return new Response('Forbidden', { status: 403 });
    const mime: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.wasm': 'application/wasm',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain',
    };
    try {
      return new Response(new Uint8Array(await fs.readFile(file)), {
        headers: { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 640,
    minHeight: 480,
    frame: true,
    title: 'ListeningSlide',
    backgroundColor: '#0b1020',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  win.setMenuBarVisibility(false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  // The player is offline; upstream SDK requests may only reach local assets.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const dev =
      process.env.VITE_DEV_SERVER_URL && ['127.0.0.1', 'localhost'].includes(url.hostname);
    callback({ cancel: !dev && !['listeningslide:', 'data:', 'blob:'].includes(url.protocol) });
  });
  const runtime = app.isPackaged
    ? path.join(process.resourcesPath, 'onlyoffice')
    : path.join(app.getAppPath(), 'runtime/onlyoffice');
  const convertQueued = createConversionQueue((bytes) =>
    convertPresentation(bytes, runtime, app.getPath('temp')),
  );
  ipcMain.handle('onlyoffice:convert', (event, bytes) => {
    if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame)
      throw new Error('Invalid conversion sender');
    return convertQueued(bytes);
  });
  ipcMain.handle('file:demo', () => readFile(path.join(__dirname, '../dist/demo.pptx'), false));
  ipcMain.handle('file:open', async () => {
    const result = await dialog.showOpenDialog(win!, {
      filters: [{ name: 'PowerPoint 课件', extensions: ['pptx'] }],
      properties: ['openFile'],
    });
    return result.canceled ? null : readFile(result.filePaths[0]);
  });
  ipcMain.handle('file:recent', (_e, file) => {
    if (!settings.recent.some((r) => r.path === file)) throw new Error('此文件不在最近课件中。');
    return readFile(file);
  });
  ipcMain.handle('file:drop', (_e, file) => readFile(file));
  ipcMain.handle('file:initial', async () => {
    const file = initialPath;
    initialPath = undefined;
    return file ? readFile(file) : null;
  });
  ipcMain.handle('settings:get', () => ({ ...settings, dataDirectory, storageWarning }));
  ipcMain.handle('settings:save', async (_event, raw) => {
    const cleaned = cleanSettings(raw);
    settings = { ...cleaned, recent: settings.recent };
    await persist();
  });
  ipcMain.handle('window:is-fullscreen', () => win?.isFullScreen() ?? false);
  win.on('enter-full-screen', () => win?.webContents.send('window:fullscreen-changed', true));
  win.on('leave-full-screen', () => win?.webContents.send('window:fullscreen-changed', false));
  ipcMain.handle('window:fullscreen', (_e, full) => {
    win?.setFullScreen(full === true);
    return full === true;
  });
  win.once('ready-to-show', () => win?.show());
  if (process.env.VITE_DEV_SERVER_URL) await win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else await win.loadURL('listeningslide://app/');
}
