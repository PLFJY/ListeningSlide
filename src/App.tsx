import { useEffect, useRef, useState } from 'react';
import { FileSliders, FolderOpen, LoaderCircle, Monitor, Moon, Play, Sun, X } from 'lucide-react';
import { importPptx } from './importer/pptx';
import { useApp } from './core/store';
import { defaultSettings, type OpenedFile } from './core/model';
import { Stage } from './components/Stage';
import { About } from './components/About';
import { getAppearance, setAppearance } from './ui/appearance';
export default function App() {
  const [appearance, updateAppearance] = useState(getAppearance);
  const deck = useApp((s) => s.deck),
    settings = useApp((s) => s.settings);
  const [presenting, setPresenting] = useState(false),
    [loading, setLoading] = useState(''),
    [error, setError] = useState(''),
    [drag, setDrag] = useState(false),
    [storageWarning, setStorageWarning] = useState('');
  const input = useRef<HTMLInputElement>(null),
    loadVersion = useRef(0);
  async function load(file: OpenedFile | File) {
    const version = ++loadVersion.current;
    setError('');
    setLoading('正在读取课件…');
    try {
      if (file instanceof File && file.size > 256 * 1024 * 1024)
        throw new Error('课件不能超过 256 MB。');
      const data = file instanceof File ? await file.arrayBuffer() : file.data;
      const result = await importPptx(data, (message) => {
        if (version === loadVersion.current) setLoading(message);
      });
      if (version !== loadVersion.current) {
        result.dispose();
        return;
      }
      useApp.getState().setDeck(result);
      setPresenting(true);
      if (window.desktop) {
        const next = await window.desktop.getSettings();
        useApp.getState().setSettings(next);
      }
    } catch (e) {
      if (version === loadVersion.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (version === loadVersion.current) setLoading('');
    }
  }
  async function open() {
    try {
      if (window.desktop) {
        const file = await window.desktop.openFile();
        if (file) await load(file);
      } else input.current?.click();
    } catch (e) {
      setError(String(e));
    }
  }
  async function demo() {
    try {
      setLoading('正在打开交互演示…');
      if (window.desktop) {
        await load(await window.desktop.openDemo());
        return;
      }
      const response = await fetch('./demo.pptx');
      if (!response.ok) throw new Error('演示课件未找到，请运行 pnpm run demo:generate。');
      await load(new File([await response.arrayBuffer()], 'Listening Lab · 交互演示.pptx'));
    } catch (e) {
      setLoading('');
      setError(String(e));
    }
  }
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        if (window.desktop) {
          const saved = await window.desktop.getSettings();
          if (!active) return;
          useApp.getState().setSettings(saved);
          setStorageWarning(saved.storageWarning || '');
          const file = await window.desktop.getInitialFile();
          if (file && active) await load(file);
        } else {
          const raw = localStorage.getItem('listeningslide-settings');
          if (raw) {
            const parsed = JSON.parse(raw);
            useApp.getState().setSettings({
              ...defaultSettings,
              ...parsed,
              player: { ...defaultSettings.player, ...parsed.player },
            });
          }
        }
      } catch (e) {
        setError(String(e));
      }
    }
    void init();
    const unsubscribe = window.desktop?.onOpenFile((file) => void load(file));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        void open();
      }
    };
    addEventListener('keydown', listener);
    return () => removeEventListener('keydown', listener);
  });
  const recent = settings.recent;
  const isFileDrag = (data: DataTransfer) => data.types.includes('Files');
  return (
    <div
      className="app-shell"
      onDragStartCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (isFileDrag(e.dataTransfer)) {
          e.dataTransfer.dropEffect = 'copy';
          setDrag(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        setDrag(false);
        if (!isFileDrag(e.dataTransfer)) return;
        const file = e.dataTransfer.files[0];
        if (!file) return;
        if (!/\.pptx$/i.test(file.name)) {
          setError('请选择 .pptx 格式的课件。');
          return;
        }
        try {
          await load(window.desktop ? await window.desktop.openDropped(file) : file);
        } catch (error) {
          setError(String(error));
        }
      }}
    >
      <input
        ref={input}
        type="file"
        accept=".pptx"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void load(file);
          e.target.value = '';
        }}
      />
      {deck && presenting ? (
        <Stage
          deck={deck}
          onOpen={() => void open()}
          onHome={() => {
            setPresenting(false);
            void window.desktop
              ?.setFullscreen(false)
              .catch((error) => setError(`退出全屏失败：${String(error)}`));
            if (document.fullscreenElement)
              void document
                .exitFullscreen()
                .catch((error) => setError(`退出全屏失败：${String(error)}`));
          }}
        />
      ) : (
        <main className="home-main">
          <div className="home-preferences">
            <div className="appearance-controls" role="group" aria-label="界面外观">
              {(
                [
                  ['system', Monitor, '跟随系统外观'],
                  ['light', Sun, '浅色外观'],
                  ['dark', Moon, '深色外观'],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  aria-label={label}
                  title={label}
                  aria-pressed={appearance === value}
                  onClick={() => {
                    updateAppearance(value);
                    setAppearance(value);
                  }}
                >
                  <Icon size={17} />
                </button>
              ))}
            </div>
          </div>
          <div className="home-actions">
            <button className="primary-button" onClick={() => void open()}>
              <FolderOpen size={19} />
              打开课件
            </button>
            {deck && (
              <button className="plain-button" onClick={() => setPresenting(true)}>
                继续放映
              </button>
            )}
            <button className="plain-button" onClick={() => void demo()}>
              <Play size={15} />
              演示课件
            </button>
          </div>
          {recent.length > 0 && (
            <section className="recent-section">
              <h2>最近打开</h2>
              <div className="recent-list">
                {recent.map((file) => (
                  <button
                    key={file.path}
                    title={file.path}
                    onClick={async () => {
                      try {
                        if (window.desktop) await load(await window.desktop.openRecent(file.path));
                      } catch (error) {
                        setError(`无法打开课件：${String(error)}`);
                      }
                    }}
                  >
                    <FileSliders size={19} />
                    <span>{file.name}</span>
                    <time>{new Date(file.openedAt).toLocaleDateString('zh-CN')}</time>
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
      )}
      {!presenting && <About />}
      {error && (
        <div className="toast error-toast" role="alert">
          <span>{error}</span>
          <button aria-label="关闭提示" onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {storageWarning && !presenting && <div className="storage-warning">{storageWarning}</div>}
      {drag && <div className="drop-overlay">打开 PPTX</div>}
      {loading && (
        <div className="loading-overlay" role="status">
          <LoaderCircle size={28} className="spinner" />
          <span>{loading}</span>
        </div>
      )}
    </div>
  );
}
