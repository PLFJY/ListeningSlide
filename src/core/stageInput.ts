export interface NavigationRequest {
  version: number;
  explicit: boolean;
}

/** Invalidates navigation that started before a change between browsing and ink. */
export class StageInput {
  private annotation = false;
  private version = 0;

  setAnnotation(active: boolean) {
    if (active !== this.annotation) this.version++;
    this.annotation = active;
  }

  isAnnotating() {
    return this.annotation;
  }

  invalidate() {
    this.version++;
  }

  navigation(explicit = false): NavigationRequest | null {
    return this.annotation && !explicit ? null : { version: this.version, explicit };
  }

  allows(request: NavigationRequest | null | undefined): request is NavigationRequest {
    return !!request && request.version === this.version && (!this.annotation || request.explicit);
  }
}
