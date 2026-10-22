/** A multi-contact gesture stays blocked until every finger has lifted. */
export class TouchSession {
  private ids = new Set<number>();
  private multiple = false;

  begin(id: number) {
    if (this.ids.has(id)) return false;
    this.ids.add(id);
    if (this.ids.size > 1) this.multiple = true;
    return !this.multiple;
  }

  release(id: number) {
    const single = this.ids.has(id) && !this.multiple;
    this.ids.delete(id);
    if (!this.ids.size) this.multiple = false;
    return single;
  }

  has(id: number) {
    return this.ids.has(id);
  }

  reset() {
    const ids = [...this.ids];
    this.ids.clear();
    this.multiple = false;
    return ids;
  }
}

/** Suppress only the compatibility click belonging to a consumed pointer. */
export class PointerClicks {
  private blocked = new Set<number>();
  private fallback = false;

  begin(id: number) {
    this.blocked.delete(id);
    this.fallback = false;
  }

  block(id: number) {
    this.blocked.add(id);
    this.fallback = true;
    // A cancelled pointer may never dispatch a click. Bound retained IDs.
    if (this.blocked.size > 64) this.blocked.delete(this.blocked.values().next().value!);
  }

  consume(event: { pointerId?: number; detail: number }) {
    if (typeof event.pointerId === 'number' && event.pointerId >= 0) {
      const blocked = this.blocked.delete(event.pointerId);
      if (blocked) this.fallback = false;
      return blocked;
    }
    if (event.detail === 0) return false; // Keyboard / assistive activation.
    const blocked = this.fallback;
    this.fallback = false;
    return blocked;
  }
}

export interface PointerSample {
  clientX: number;
  clientY: number;
}
export function pointerSamples(
  event: PointerSample & { getCoalescedEvents?: () => PointerSample[] },
) {
  const samples = event.getCoalescedEvents?.() || [];
  // Include the dispatch point and preserve the latest samples in one bridge message.
  return [...samples, event].slice(-64);
}
