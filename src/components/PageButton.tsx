import { useRef, type ButtonHTMLAttributes } from 'react';
import { isTapMovement } from '../core/gestures';

/** Touchscreen swipes over a page control must not become button clicks. */
export function PageButton({
  onClick,
  onKeyDown,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const press = useRef<{ id: number; x: number; y: number; distance: number } | null>(null);
  const tapped = useRef(false);
  const pointerClick = useRef(false);
  return (
    <button
      {...props}
      onPointerDown={(event) => {
        tapped.current = false;
        press.current = null;
        pointerClick.current = true;
        if (!event.isPrimary || event.button !== 0) return;
        press.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          distance: 0,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const current = press.current;
        if (current?.id === event.pointerId)
          current.distance = Math.max(
            current.distance,
            Math.hypot(event.clientX - current.x, event.clientY - current.y),
          );
      }}
      onPointerUp={(event) => {
        const current = press.current;
        if (current?.id !== event.pointerId) return;
        tapped.current = isTapMovement(
          current,
          { x: event.clientX, y: event.clientY },
          current.distance,
        );
        press.current = null;
      }}
      onPointerCancel={() => {
        press.current = null;
        tapped.current = false;
      }}
      onLostPointerCapture={() => {
        if (!press.current) return;
        press.current = null;
        tapped.current = false;
        pointerClick.current = true;
      }}
      onClick={(event) => {
        const rejected = !tapped.current && (pointerClick.current || event.detail !== 0);
        pointerClick.current = false;
        if (rejected) {
          event.preventDefault();
          return;
        }
        tapped.current = false;
        onClick?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') pointerClick.current = false;
        onKeyDown?.(event);
      }}
    />
  );
}
