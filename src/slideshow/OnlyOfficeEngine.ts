import type {
  AnnotationPointer,
  AnnotationSettings,
  ConvertedPresentation,
  ISlideshowEngine,
  SlideshowState,
} from './types';
import type { NavigationRequest } from '../core/stageInput';

const FRAME_PATH = './onlyoffice/runtime/web-apps/apps/presentationeditor/main/player.html';
/** Owns an isolated upstream realm. Removing the frame also releases SDK timers/globals. */
export class OnlyOfficeEngine implements ISlideshowEngine {
  private frame: HTMLIFrameElement | null = null;
  private state: SlideshowState = {
    slideIndex: 0,
    slideCount: 0,
    stepIndex: 0,
    busy: false,
    thumbnails: {},
    media: [],
    warnings: [],
  };
  private listeners = new Set<(state: SlideshowState) => void>();
  private pending = new Map<
    string,
    { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private disposed = false;
  constructor(
    private host: HTMLElement,
    private convert: (file: ArrayBuffer) => Promise<ConvertedPresentation>,
  ) {
    addEventListener('message', this.onMessage);
  }
  private emit() {
    this.listeners.forEach((listener) => listener(this.state));
  }
  private onMessage = (event: MessageEvent) => {
    if (
      this.disposed ||
      event.source !== this.frame?.contentWindow ||
      event.origin !== location.origin ||
      event.data?.source !== 'listening-slide-engine'
    )
      return;
    const { type, message, state, request } = event.data;
    if (type === 'error') {
      const error = new Error(message || 'ONLYOFFICE 放映失败');
      this.pending.forEach((item) => {
        clearTimeout(item.timer);
        item.reject(error);
      });
      this.pending.clear();
      this.state = { ...this.state, warnings: [...this.state.warnings, error.message] };
      this.emit();
    } else if (type === 'state') {
      this.state = state;
      this.emit();
    } else if (['advance', 'previous'].includes(type)) {
      this.host.dispatchEvent(new CustomEvent(`slideshow:${type}`, { detail: request }));
    } else {
      const item = this.pending.get(type);
      if (item) {
        clearTimeout(item.timer);
        this.pending.delete(type);
        item.resolve();
      }
    }
  };
  private wait(type: string, timeout = 45000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(type);
        reject(new Error(`ONLYOFFICE ${type} 超时；请先运行 pnpm run onlyoffice:prepare。`));
      }, timeout);
      this.pending.set(type, { resolve, reject, timer });
    });
  }
  private send(type: string, data?: unknown) {
    if (this.disposed || !this.frame?.contentWindow) throw new Error('放映引擎已关闭');
    this.frame.contentWindow.postMessage(
      { source: 'listening-slide-host', type, data },
      location.origin,
    );
  }
  async load(file: ArrayBuffer) {
    if (this.frame || this.disposed) throw new Error('每个放映引擎实例只能加载一个文件');
    // Start conversion and SDK initialization together; errors always clean up at the caller.
    const converted = this.convert(file);
    void converted.catch(() => {});
    const frame = document.createElement('iframe');
    frame.title = 'ONLYOFFICE 10.0.0 幻灯片放映';
    frame.className = 'onlyoffice-frame';
    frame.tabIndex = -1;
    frame.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;border:0;visibility:hidden;pointer-events:none;z-index:0';
    frame.setAttribute('allow', "autoplay 'none'; camera 'none'; microphone 'none'");
    const ready = this.wait('ready');
    frame.src = FRAME_PATH;
    this.frame = frame;
    this.host.append(frame);
    const [, payload] = await Promise.all([ready, converted]);
    if (this.disposed) throw new Error('放映引擎已关闭');
    const loaded = this.wait('loaded');
    this.send('load', payload);
    await loaded;
  }
  async start() {
    const started = this.wait('started');
    this.send('start');
    await started;
    if (this.frame) this.frame.style.visibility = 'visible';
  }
  nextStep(request: NavigationRequest) {
    this.send('step', request);
  }
  finishCurrentStep(slideIndex: number) {
    this.send('finish-step', slideIndex);
  }
  previousStep(request: NavigationRequest) {
    this.send('previous-step', request);
  }
  requestThumbnails() {
    this.send('thumbnails');
  }
  setAnnotation(settings: AnnotationSettings) {
    this.send('annotation-tool', settings);
  }
  annotationPointer(pointer: AnnotationPointer) {
    this.send('annotation-pointer', pointer);
  }
  clearAnnotations() {
    this.send('annotation-clear');
  }
  cancelAnnotation() {
    this.send('annotation-cancel');
  }
  goToSlide(index: number) {
    if (Number.isInteger(index) && index >= 0 && index < this.state.slideCount)
      this.send('goto', index);
  }
  subscribe(listener: (state: SlideshowState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    removeEventListener('message', this.onMessage);
    this.pending.forEach((item) => {
      clearTimeout(item.timer);
      item.reject(new Error('放映已关闭'));
    });
    this.pending.clear();
    this.listeners.clear();
    this.frame?.remove();
    this.frame = null;
  }
}
