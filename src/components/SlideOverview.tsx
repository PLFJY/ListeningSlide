import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Presentation } from '../core/model';
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
        className="overview-panel liquid-glass-menu"
        role="dialog"
        aria-modal="true"
        aria-label="幻灯片总览"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const targets = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), [tabindex="0"]',
            ),
          );
          const first = targets[0],
            last = targets.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <header>
          <h2>幻灯片总览</h2>
          <button aria-label="关闭幻灯片总览" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="overview-scroll" role="region" aria-label="幻灯片列表" tabIndex={0}>
          <div className="overview-grid">
            {deck.slides.map((slide, index) => (
              <button
                key={slide.id}
                className="overview-item"
                aria-label={`跳转到第 ${index + 1} 页`}
                aria-current={page === index ? 'page' : undefined}
                onClick={() => onGo(index)}
              >
                <div className="thumbnail" inert>
                  {slide.thumbnail && (
                    <img
                      src={slide.thumbnail}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  )}
                </div>
                <span>{index + 1}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
