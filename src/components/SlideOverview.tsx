import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Presentation, Slide } from '../core/model';
function Thumbnail({ deck, slide }: { deck: Presentation; slide: Slide }) {
  const container = useRef<HTMLDivElement>(null),
    host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(220),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(container.current!);
    const resize = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    resize.observe(container.current!);
    return () => {
      observer.disconnect();
      resize.disconnect();
    };
  }, []);
  useLayoutEffect(() => {
    if (visible) {
      const image = document.createElement('img');
      image.alt = '';
      image.src = slide.thumbnail || '';
      image.style.cssText = 'display:block;width:100%;height:100%';
      host.current!.replaceChildren(...(slide.thumbnail ? [image] : []));
    }
  }, [visible, deck, slide, slide.thumbnail]);
  return (
    <div
      ref={container}
      className="thumbnail"
      style={{ aspectRatio: `${deck.width}/${deck.height}` }}
      inert
    >
      <div
        ref={host}
        style={{
          width: deck.width,
          height: deck.height,
          transform: `scale(${width / deck.width})`,
          transformOrigin: 'top left',
        }}
      />
    </div>
  );
}
export function SlideOverview({
  deck,
  page,
  onGo,
  onClose,
}: {
  deck: Presentation;
  page: number;
  onGo: (page: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const selected = dialog.current?.querySelector<HTMLButtonElement>('[aria-current=page]');
    selected?.scrollIntoView({ block: 'nearest' });
    selected?.focus({ preventScroll: true });
  }, []);
  return (
    <div data-overlay className="overview-backdrop" onClick={onClose}>
      <section
        data-overlay
        ref={dialog}
        className="overview-panel"
        role="dialog"
        aria-modal="true"
        aria-label="幻灯片总览"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>幻灯片总览</h2>
          <button aria-label="关闭幻灯片总览" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="overview-grid">
          {deck.slides.map((slide, index) => (
            <button
              key={slide.id}
              className="overview-item"
              aria-label={`跳转到第 ${index + 1} 页`}
              aria-current={page === index ? 'page' : undefined}
              onClick={() => onGo(index)}
            >
              <Thumbnail deck={deck} slide={slide} />
              <span>{index + 1}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
