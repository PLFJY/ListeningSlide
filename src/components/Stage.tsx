import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Grid2X2,
  Home,
  Maximize,
  Minimize,
  MoreHorizontal,
  PenLine,
  RotateCcw,
} from 'lucide-react';
import type { PlayerSettings, Presentation } from '../core/model';
import { defaultPlayer } from '../core/model';
import { useApp, updateSettings } from '../core/store';
import { placePlayer } from '../core/playerLayout';
import { OnlyOfficeEngine } from '../slideshow/OnlyOfficeEngine';
import type { AnnotationPointer, AnnotationSettings, SlideMediaObject } from '../slideshow/types';
import { classifyGesture } from '../core/gestures';
import { StageInput, type NavigationRequest } from '../core/stageInput';
import { PointerClicks, TouchSession, pointerSamples } from '../core/touch';
import { pointInAudioArea, pointNearAudioArea, type AudioHit } from '../core/audioObjects';
import { AudioPlayerInstance, type OpenAudioPlayer } from './AudioPlayerInstance';
import { SlideOverview } from './SlideOverview';
import { AnnotationTools } from './AnnotationTools';
import { PageButton } from './PageButton';
interface Props {
  deck: Presentation;
  onHome: () => void;
  onOpen: () => void;
}
export function Stage({ deck, onHome, onOpen }: Props) {
  const inkPointer = useRef<number | null>(null);
  const input = useRef(new StageInput());
  const page = useApp((s) => s.page),
    revision = useApp((s) => s.revision),
    settings = useApp((s) => s.settings),
    go = useApp((s) => s.go);
  const slide = deck.slides[page];
  const stage = useRef<HTMLElement>(null),
    host = useRef<HTMLDivElement>(null),
    engine = useRef<OnlyOfficeEngine | null>(null),
    engineReady = useRef<Promise<void>>(Promise.resolve()),
    advanceRef = useRef<(request: NavigationRequest) => void>(() => {}),
    previousRef = useRef<(request: NavigationRequest) => void>(() => {});
  const gesture = useRef<{
      id: number;
      x: number;
      y: number;
      t: number;
      distance: number;
      audioHit: AudioHit | null;
      navigation: NavigationRequest;
    } | null>(null),
    pointers = useRef(new TouchSession()),
    clicks = useRef(new PointerClicks());
  const playerOrder = useRef(0);
  const fullscreenPending = useRef(false);
  const wheelGesture = useRef({
    time: 0,
    direction: 0,
    distance: 0,
    consumed: false,
    finishRequested: false,
    slideIndex: -1,
  });
  const homeUntil = useRef(0),
    homeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [stepIndex, setStepIndex] = useState(0),
    [ready, setReady] = useState(false),
    [annotation, setAnnotation] = useState<AnnotationSettings>({
      tool: 'none',
      color: '#FF3B30',
      width: 2,
    }),
    [annotationMenu, setAnnotationMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [media, setMedia] = useState<SlideMediaObject[]>([]),
    [menu, setMenu] = useState(false),
    [overview, setOverview] = useState(false),
    [homeArmed, setHomeArmed] = useState(false),
    [full, setFull] = useState(false),
    [players, setPlayers] = useState<OpenAudioPlayer[]>([]),
    [ended, setEnded] = useState(false),
    [audioNotice, setAudioNotice] = useState(''),
    [size, setSize] = useState({ w: innerWidth, h: innerHeight });
  const annotationValue = useRef(annotation);
  const visiblePlayers = players.filter(
    (player) => player.owner === deck && (player.pinned || player.scopeSlideId === slide.id),
  );
  function changeAnnotation(value: AnnotationSettings) {
    annotationValue.current = value;
    input.current.setAnnotation(value.tool !== 'none');
    gesture.current = null;
    wheelGesture.current.consumed = true;
    wheelGesture.current.finishRequested = true;
    if (ready) engine.current?.setAnnotation(value);
    setAnnotation(value);
  }
  function clearHome() {
    homeUntil.current = 0;
    clearTimeout(homeTimer.current);
    setHomeArmed(false);
  }
  function resetInteraction() {
    if (inkPointer.current !== null) engine.current?.cancelAnnotation();
    inkPointer.current = null;
    gesture.current = null;
    for (const id of pointers.current.reset()) clicks.current.block(id);
    input.current.invalidate();
    // Keep the current wheel burst consumed across page changes. Its own
    // idle timeout or a direction reversal starts the next navigation intent.
    clearHome();
  }
  function requestHome() {
    if (performance.now() < homeUntil.current) {
      clearHome();
      onHome();
      return;
    }
    homeUntil.current = performance.now() + 2500;
    setHomeArmed(true);
    setMenu(false);
    clearTimeout(homeTimer.current);
    homeTimer.current = setTimeout(clearHome, 2500);
  }
  useEffect(() => {
    const resize = () => {
      resetInteraction();
      setSize({ w: innerWidth, h: innerHeight });
    };
    const visibility = () => {
      if (document.hidden) resetInteraction();
    };
    addEventListener('resize', resize);
    addEventListener('blur', resetInteraction);
    document.addEventListener('visibilitychange', visibility);
    if (window.desktop)
      void window.desktop
        .getFullscreen()
        .then(setFull)
        .catch(() => {});
    const unsubscribe = window.desktop?.onFullscreenChanged(setFull);
    const changed = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', changed);
    return () => {
      removeEventListener('resize', resize);
      removeEventListener('blur', resetInteraction);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('fullscreenchange', changed);
      unsubscribe?.();
      clearTimeout(homeTimer.current);
    };
  }, []);
  useEffect(() => {
    setPlayers((current) =>
      current.filter(
        (player) => player.owner === deck && (player.pinned || player.scopeSlideId === slide.id),
      ),
    );
    clearHome();
    setMenu(false);
    setEnded(false);
    setAudioNotice('');
  }, [deck, slide.id]);
  function openAudio(id: string | null, play = true) {
    if (!id) {
      setAudioNotice('此音频资源未能读取。');
      return;
    }
    setAudioNotice('');
    const sourcePage = deck.slides.findIndex((slide) =>
      slide.audios.some((track) => track.id === id),
    );
    const source = deck.slides[sourcePage];
    const track = source?.audios.find((track) => track.id === id);
    if (!track) return;
    const order = ++playerOrder.current;
    setPlayers((current) => {
      const active = current.filter(
        (player) => player.owner === deck && (player.pinned || player.scopeSlideId === slide.id),
      );
      const existing = active.find((player) => player.track.id === id);
      if (existing)
        return active.map((player) =>
          player === existing
            ? {
                ...player,
                order,
                activations: player.activations + (play ? 1 : 0),
                position: { ...player.position, collapsed: false },
              }
            : player,
        );
      return [
        ...active,
        {
          owner: deck,
          track,
          sourceSlideId: source.id,
          scopeSlideId: slide.id,
          sourcePage: sourcePage + 1,
          pinned: false,
          activations: play ? 1 : 0,
          order,
          position: placePlayer(
            useApp.getState().settings.player,
            active.map((player) => player.position),
            size,
          ),
        },
      ];
    });
  }
  function updatePlayer(id: string, update: Partial<OpenAudioPlayer>) {
    setPlayers((current) =>
      current.map((player) => (player.track.id === id ? { ...player, ...update } : player)),
    );
  }
  function movePlayer(id: string, position: PlayerSettings, persist = false) {
    updatePlayer(id, { position });
    if (persist) updateSettings({ player: { ...position, opacity: settings.player.opacity } });
  }
  function resetPlayers() {
    updateSettings({ player: { ...defaultPlayer } });
    setPlayers((current) => {
      const positions: PlayerSettings[] = [];
      return current.map((player) => {
        const position = placePlayer(defaultPlayer, positions, size);
        positions.push(position);
        return { ...player, position };
      });
    });
  }
  useLayoutEffect(() => {
    setReady(false);
    changeAnnotation({ tool: 'none', color: '#FF3B30', width: 2 });
    setAnnotationMenu(false);
    const current = new OnlyOfficeEngine(host.current!, async () => deck.converted);
    engine.current = current;
    let active = true;
    const unsubscribe = current.subscribe((state) => {
      if (!active) return;
      setStepIndex(state.stepIndex);
      setBusy(state.busy);
      setMedia(state.media);
      deck.warnings = [...new Set([...deck.warnings, ...state.warnings])];
      for (const [index, image] of Object.entries(state.thumbnails))
        if (deck.slides[+index]) deck.slides[+index].thumbnail = image;
    });
    const advance = (event: Event) =>
      advanceRef.current((event as CustomEvent<NavigationRequest>).detail);
    const previous = (event: Event) =>
      previousRef.current((event as CustomEvent<NavigationRequest>).detail);
    const container = host.current!;
    container.addEventListener('slideshow:advance', advance);
    container.addEventListener('slideshow:previous', previous);
    engineReady.current = (async () => {
      await current.load(new ArrayBuffer(0));
      if (active) {
        await current.start();
        if (active) setReady(true);
      }
    })();
    void engineReady.current.catch((error) => {
      if (active) setAudioNotice(error instanceof Error ? error.message : String(error));
    });
    return () => {
      active = false;
      unsubscribe();
      container.removeEventListener('slideshow:advance', advance);
      container.removeEventListener('slideshow:previous', previous);
      current.dispose();
      engine.current = null;
    };
  }, [deck]);
  useLayoutEffect(() => {
    resetInteraction();
    let active = true;
    setStepIndex(0);
    setBusy(false);
    setMedia([]);
    void engineReady.current
      .then(() => {
        if (active) engine.current?.goToSlide(page);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [deck, page, revision]);
  useEffect(() => {
    if (ready) engine.current?.setAnnotation(annotationValue.current);
  }, [ready]);
  useEffect(() => {
    if (overview)
      void engineReady.current.then(() => engine.current?.requestThumbnails()).catch(() => {});
  }, [overview]);
  function enterEndScreen() {
    changeAnnotation({ ...annotation, tool: 'none' });
    setAnnotationMenu(false);
    setBusy(false);
    setPlayers([]);
    setAudioNotice('');
    setMenu(false);
    setOverview(false);
    clearHome();
    setEnded(true);
  }
  function advanceSlide(request: NavigationRequest) {
    if (!input.current.allows(request)) return;
    if (ended) {
      onHome();
      return;
    }
    if (page === deck.slides.length - 1) enterEndScreen();
    else go(page + 1);
  }
  function nextStep(request = input.current.navigation(true)) {
    if (!input.current.allows(request)) return;
    if (ended) {
      onHome();
      return;
    }
    setBusy(true);
    void engineReady.current
      .then(() => {
        if (input.current.allows(request)) engine.current?.nextStep(request);
      })
      .catch(() => {});
  }
  function previousStep(request = input.current.navigation(true)) {
    if (!input.current.allows(request)) return;
    if (ended) {
      setEnded(false);
      return;
    }
    void engineReady.current
      .then(() => {
        if (input.current.allows(request)) engine.current?.previousStep(request);
      })
      .catch(() => {});
  }
  advanceRef.current = advanceSlide;
  previousRef.current = (request) => {
    if (input.current.allows(request)) go(page - 1);
  };
  async function fullscreen(value: boolean) {
    if (fullscreenPending.current) return;
    fullscreenPending.current = true;
    try {
      if (window.desktop) setFull(await window.desktop.setFullscreen(value));
      else {
        if (value) await document.documentElement.requestFullscreen();
        else if (document.fullscreenElement) await document.exitFullscreen();
        setFull(value);
      }
    } catch (error) {
      setAudioNotice(`无法切换全屏：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      fullscreenPending.current = false;
      setMenu(false);
    }
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (
        event.repeat &&
        ['Escape', 'p', 'f'].includes(event.key.length === 1 ? event.key.toLowerCase() : event.key)
      ) {
        event.preventDefault();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        clearHome();
        if (ended) {
          onHome();
          return;
        }
        if (overview) {
          setOverview(false);
          stage.current?.focus();
        } else if (annotationMenu || annotation.tool !== 'none') {
          setAnnotationMenu(false);
          changeAnnotation({ ...annotation, tool: 'none' });
          stage.current?.focus();
        } else if (menu) {
          setMenu(false);
          stage.current?.focus();
        } else void fullscreen(false);
        return;
      }
      if (
        (event.target as HTMLElement)?.matches('input,select,textarea') ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        void fullscreen(!full);
        return;
      }
      if (event.key.toLowerCase() === 'p' && ready && !ended && !overview && !menu) {
        event.preventDefault();
        changeAnnotation({ ...annotation, tool: input.current.isAnnotating() ? 'none' : 'pen' });
        setAnnotationMenu(false);
        return;
      }
      if (menu || overview || (event.target as HTMLElement)?.closest('[data-overlay]')) return;
      const navigation = input.current.navigation();
      if (!navigation) {
        if (
          [
            'ArrowRight',
            'ArrowDown',
            'PageDown',
            ' ',
            'Enter',
            'ArrowLeft',
            'ArrowUp',
            'PageUp',
            'Home',
            'End',
          ].includes(event.key)
        )
          event.preventDefault();
        return;
      }
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(event.key)) {
        event.preventDefault();
        clearHome();
        nextStep(navigation);
      }
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        clearHome();
        previousStep(navigation);
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setEnded(false);
        go(0);
      }
      if (event.key === 'End') {
        event.preventDefault();
        setEnded(false);
        go(deck.slides.length - 1);
      }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  });
  useEffect(() => {
    const container = stage.current!;
    const wheel = (event: WheelEvent) => {
      if (input.current.isAnnotating()) {
        if (!(event.target instanceof Element && event.target.closest('[data-overlay]')))
          event.preventDefault();
        return;
      }
      const navigation = input.current.navigation();
      if (!navigation) return;
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        menu ||
        overview ||
        (event.target instanceof Element &&
          event.target.closest('[data-overlay],input,select,textarea,[contenteditable="true"]')) ||
        !event.deltaY ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      )
        return;
      event.preventDefault();
      const now = performance.now();
      const direction = Math.sign(event.deltaY);
      const gesture = wheelGesture.current;
      // One burst may start and finish a step, without skipping to another one.
      // Do not reset on a render or page change; reversing direction is a new intent.
      if (now - gesture.time > 240 || direction !== gesture.direction) {
        gesture.direction = direction;
        gesture.distance = 0;
        gesture.consumed = false;
        gesture.finishRequested = false;
      }
      gesture.time = now;
      if (gesture.consumed) {
        if (direction > 0 && !gesture.finishRequested) {
          gesture.finishRequested = true;
          const slideIndex = gesture.slideIndex;
          void engineReady.current
            .then(() => {
              if (input.current.allows(navigation)) engine.current?.finishCurrentStep(slideIndex);
            })
            .catch(() => {});
        }
        return;
      }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1;
      gesture.distance += Math.abs(event.deltaY) * unit;
      if (gesture.distance < 24) return;
      gesture.consumed = true;
      gesture.slideIndex = page;
      clearHome();
      if (direction > 0) nextStep(navigation);
      else previousStep(navigation);
    };
    container.addEventListener('wheel', wheel, { passive: false });
    return () => container.removeEventListener('wheel', wheel);
  });
  function sendInk(event: PointerEvent<HTMLElement>, phase: AnnotationPointer['phase']) {
    const rect = host.current!.getBoundingClientRect();
    const normalize = (point: { clientX: number; clientY: number }) => ({
      x: (point.clientX - rect.left) / rect.width,
      y: (point.clientY - rect.top) / rect.height,
    });
    engine.current?.annotationPointer({
      phase,
      id: event.pointerId,
      slideIndex: page,
      ...normalize(event),
      points: phase === 'move' ? pointerSamples(event.nativeEvent).map(normalize) : undefined,
    });
  }
  function down(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    clicks.current.begin(event.pointerId);
    const single = pointers.current.begin(event.pointerId);
    if (!single || !event.isPrimary) {
      gesture.current = null;
      clicks.current.block(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const path = event.nativeEvent.composedPath();
    if (!path.some((node) => node instanceof Element && node.hasAttribute('data-home')))
      clearHome();
    if (path.some((node) => node instanceof Element && node.hasAttribute('data-overlay'))) return;
    if (menu) {
      setMenu(false);
      gesture.current = null;
      return;
    }
    if (input.current.isAnnotating() && !ended) {
      gesture.current = null;
      event.preventDefault();
      event.stopPropagation();
      if (!ready || !event.isPrimary || inkPointer.current !== null) return;
      const rect = host.current!.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        return;
      inkPointer.current = event.pointerId;
      setAnnotationMenu(false);
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      sendInk(event, 'down');
      return;
    }
    const navigation = input.current.navigation();
    if (!navigation) return;
    const rect = host.current!.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) * deck.width) / rect.width,
      y: ((event.clientY - rect.top) * deck.height) / rect.height,
    };
    const candidates = ended
      ? []
      : [...media].reverse().filter((item) => item.slideIndex === page && item.visible);
    const object =
      candidates.find((item) => pointInAudioArea(point, item.screenPolygon)) ||
      (event.pointerType === 'touch' &&
        candidates.find((item) =>
          pointNearAudioArea(
            point,
            item.screenPolygon,
            Math.max(
              0,
              ((44 * deck.width) / rect.width -
                Math.min(item.screenBounds.width, item.screenBounds.height)) /
                2,
            ),
          ),
        ));
    const audioHit = object
      ? { id: slide.audios.find((track) => track.shapeId === object.shapeId)?.id || null }
      : null;
    gesture.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      t: performance.now(),
      distance: 0,
      audioHit,
      navigation,
    };
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLElement>) {
    if (inkPointer.current === event.pointerId) {
      sendInk(event, 'move');
      return;
    }
    if (input.current.isAnnotating()) return;
    const current = gesture.current;
    if (current && current.id === event.pointerId)
      for (const point of pointerSamples(event.nativeEvent))
        current.distance = Math.max(
          current.distance,
          Math.hypot(point.clientX - current.x, point.clientY - current.y),
        );
  }
  function up(event: PointerEvent<HTMLElement>) {
    const tracked = pointers.current.has(event.pointerId);
    const single = pointers.current.release(event.pointerId);
    if (inkPointer.current === event.pointerId) {
      sendInk(event, 'up');
      inkPointer.current = null;
      clicks.current.block(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!tracked) return;
    if (!single) {
      gesture.current = null;
      clicks.current.block(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null;
    if (!input.current.allows(current.navigation)) {
      clicks.current.block(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const result = classifyGesture(
      current,
      { x: event.clientX, y: event.clientY },
      performance.now() - current.t,
      Math.max(current.distance, Math.hypot(event.clientX - current.x, event.clientY - current.y)),
    );
    if (result === 'next' || result === 'previous') {
      clicks.current.block(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      if (result === 'next') nextStep(current.navigation);
      else previousStep(current.navigation);
    } else if (result === 'tap') {
      if (current.audioHit && !ended) openAudio(current.audioHit.id);
      else if (ended) onHome();
    }
  }
  const scale = Math.min(size.w / deck.width, size.h / deck.height);
  return (
    <main
      ref={stage}
      className={`stage ${annotation.tool !== 'none' ? 'is-annotating' : ''}`}
      tabIndex={-1}
      onPointerDownCapture={down}
      onPointerMoveCapture={move}
      onPointerUpCapture={up}
      onPointerCancelCapture={(event) => {
        if (inkPointer.current === event.pointerId) {
          sendInk(event, 'cancel');
          inkPointer.current = null;
        }
        pointers.current.release(event.pointerId);
        clicks.current.block(event.pointerId);
        gesture.current = null;
      }}
      onLostPointerCapture={(event) => {
        // Touch implicitly captures the original target before we capture on
        // the stage. Ignore the old target's loss while the stage still owns it.
        if (
          event.target !== event.currentTarget ||
          event.currentTarget.hasPointerCapture(event.pointerId)
        )
          return;
        pointers.current.release(event.pointerId);
        if (inkPointer.current === event.pointerId) {
          sendInk(event, 'cancel');
          inkPointer.current = null;
          pointers.current.release(event.pointerId);
          clicks.current.block(event.pointerId);
        }
        if (gesture.current?.id === event.pointerId) {
          gesture.current = null;
          pointers.current.release(event.pointerId);
          clicks.current.block(event.pointerId);
        }
      }}
      onContextMenu={(event) => event.preventDefault()}
      onDragStartCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClickCapture={(event) => {
        if (clicks.current.consume(event.nativeEvent as MouseEvent & { pointerId?: number })) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div className="stage-surface" aria-hidden="true" />
      <div
        className="slide-viewport"
        hidden={ended}
        style={{ width: deck.width * scale, height: deck.height * scale }}
      >
        <div
          ref={host}
          className="slide-host"
          style={{ width: deck.width, height: deck.height, transform: `scale(${scale})` }}
        >
          {media
            .filter((item) => item.slideIndex === page && item.visible)
            .map((item) => {
              const track = slide.audios.find((track) => track.shapeId === item.shapeId);
              const bounds = item.screenBounds;
              return (
                <button
                  key={item.shapeId}
                  data-audio-object
                  data-audio-id={track?.id}
                  data-is-audio="true"
                  aria-label={`播放 ${track?.name || item.name}`}
                  style={{
                    position: 'absolute',
                    zIndex: 1,
                    left: bounds.x,
                    top: bounds.y,
                    width: bounds.width,
                    height: bounds.height,
                    padding: 0,
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    clipPath: `polygon(${item.screenPolygon
                      .map((point) => `${point.x - bounds.x}px ${point.y - bounds.y}px`)
                      .join(',')})`,
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      openAudio(track?.id || null);
                    }
                  }}
                />
              );
            })}
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        <span>{String(page + 1).padStart(2, '0')}</span>
        <span>{stepIndex}</span>
        <span>{busy ? '动画播放中' : '就绪'}</span>
      </span>
      {!ended && (
        <>
          <PageButton
            data-overlay
            className="edge-nav edge-nav-previous"
            aria-label="上一页"
            disabled={page === 0 && stepIndex === 0}
            onClick={() => {
              clearHome();
              setMenu(false);
              previousStep();
              stage.current?.focus({ preventScroll: true });
            }}
          >
            <ChevronLeft size={26} />
          </PageButton>
          <PageButton
            data-overlay
            className="edge-nav edge-nav-next"
            aria-label="下一页"
            onClick={() => {
              clearHome();
              setMenu(false);
              nextStep();
              stage.current?.focus({ preventScroll: true });
            }}
          >
            <ChevronRight size={26} />
          </PageButton>
        </>
      )}
      {!ended && (
        <div data-overlay className="stage-dock liquid-glass" role="toolbar" aria-label="放映工具">
          <button
            data-home
            className={`dock-button ${homeArmed ? 'home-armed' : ''}`}
            aria-label="返回首页"
            title="返回首页"
            onKeyDown={(event) => {
              if (event.repeat) event.preventDefault();
            }}
            onClick={requestHome}
          >
            <Home size={19} />
            {homeArmed && <span>再按一次退出</span>}
          </button>
          <button
            className="dock-button"
            aria-label="批注"
            title="批注（P），Esc 退出"
            aria-pressed={annotation.tool !== 'none'}
            aria-expanded={annotationMenu}
            aria-controls="annotation-tools"
            disabled={!ready}
            onClick={() => {
              clearHome();
              setMenu(false);
              if (annotationMenu) {
                setAnnotationMenu(false);
              } else {
                setAnnotationMenu(true);
                if (annotation.tool === 'none') changeAnnotation({ ...annotation, tool: 'pen' });
              }
            }}
          >
            <PenLine size={21} />
          </button>
          <button
            className="dock-button"
            aria-label="更多"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => {
              clearHome();
              setAnnotationMenu(false);
              setMenu((value) => !value);
            }}
          >
            <MoreHorizontal size={21} />
          </button>
        </div>
      )}
      {annotationMenu && !ended && (
        <AnnotationTools
          value={annotation}
          onChange={changeAnnotation}
          onClear={() => engine.current?.clearAnnotations()}
          onClose={() => {
            setAnnotationMenu(false);
            stage.current?.focus();
          }}
        />
      )}
      {!ended && (
        <div
          data-overlay
          className="page-indicator"
          aria-label={`第 ${page + 1} 页，共 ${deck.slides.length} 页`}
        >
          <span>{String(page + 1).padStart(2, '0')}</span>
          <span>/ {String(deck.slides.length).padStart(2, '0')}</span>
        </div>
      )}
      {menu && (
        <aside data-overlay className="stage-menu liquid-glass-menu" role="menu" aria-label="更多">
          <button
            role="menuitem"
            onClick={() => {
              setMenu(false);
              setOverview(true);
            }}
          >
            <Grid2X2 size={18} />
            幻灯片总览
            <span>
              {page + 1} / {deck.slides.length}
            </span>
          </button>
          <button role="menuitem" onClick={() => void fullscreen(!full)}>
            {full ? <Minimize size={18} /> : <Maximize size={18} />}{' '}
            {full ? '退出全屏' : '进入全屏'}
          </button>
          <label className="menu-opacity">
            播放器透明度<output>{Math.round(settings.player.opacity * 100)}%</output>
            <input
              aria-label="播放器透明度"
              type="range"
              min=".4"
              max="1"
              step=".01"
              value={settings.player.opacity}
              onChange={(event) =>
                updateSettings({ player: { ...settings.player, opacity: +event.target.value } })
              }
            />
          </label>
          <button
            role="menuitem"
            onClick={() => {
              setMenu(false);
              onOpen();
            }}
          >
            <FolderOpen size={18} />
            打开课件
          </button>
          <details>
            <summary>播放设置</summary>
            <button onClick={resetPlayers}>
              <RotateCcw size={17} />
              恢复播放器位置与大小
            </button>
            <button
              onClick={() => {
                useApp.getState().reset();
                setMenu(false);
                stage.current?.focus();
              }}
            >
              <RotateCcw size={17} />
              重置本页动画
            </button>
            <label>
              播放结束
              <select
                aria-label="播放结束行为"
                value={settings.endBehavior}
                onChange={(event) =>
                  updateSettings({ endBehavior: event.target.value as 'hold' | 'restart' })
                }
              >
                <option value="hold">停留在结束位置</option>
                <option value="restart">返回裁剪起点</option>
              </select>
            </label>
          </details>
          {deck.warnings.length > 0 && (
            <details>
              <summary>兼容性提示（{deck.warnings.length}）</summary>
              {deck.warnings.map((warning, index) => (
                <p key={index}>{warning}</p>
              ))}
            </details>
          )}
        </aside>
      )}
      {overview && (
        <SlideOverview
          deck={deck}
          page={page}
          onClose={() => {
            setOverview(false);
            stage.current?.focus();
          }}
          onGo={(index) => {
            setOverview(false);
            if (index === page) useApp.getState().reset();
            else go(index);
            stage.current?.focus();
          }}
        />
      )}
      {ended && (
        <div className="end-screen">
          <p>单击以结束放映</p>
        </div>
      )}
      {audioNotice && !ended && (
        <div data-overlay className="toast error-toast" role="alert">
          <span>{audioNotice}</span>
          <button aria-label="关闭提示" onClick={() => setAudioNotice('')}>
            ×
          </button>
        </div>
      )}
      {!ended && (
        <div className="audio-players">
          {visiblePlayers.map((player) => (
            <AudioPlayerInstance
              key={player.track.id}
              player={player}
              tracks={deck.slides.find((slide) => slide.id === player.sourceSlideId)!.audios}
              endBehavior={settings.endBehavior}
              opacity={settings.player.opacity}
              onOpen={(id) => openAudio(id, false)}
              onPosition={(position, persist) => movePlayer(player.track.id, position, persist)}
              onActivate={() => updatePlayer(player.track.id, { order: ++playerOrder.current })}
              onPin={() =>
                updatePlayer(player.track.id, {
                  pinned: !player.pinned,
                  scopeSlideId: slide.id,
                })
              }
              onClose={() => {
                setPlayers((current) =>
                  current.filter((item) => item.track.id !== player.track.id),
                );
                stage.current?.focus();
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
