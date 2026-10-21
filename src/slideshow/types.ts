export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface SlideMediaObject {
  slideIndex: number;
  /** Original OOXML cNvPr.id, scoped to slideIndex. */
  shapeId: string;
  name: string;
  mediaPath: string;
  /** Slide model coordinates in millimetres. */
  bounds: Bounds;
  /** CSS pixels relative to the presentation host, including letterboxing and rotation. */
  screenBounds: Bounds;
  screenPolygon: { x: number; y: number }[];
  visible: boolean;
  trimStartMs: number | null;
  trimEndMs: number | null;
}
export interface SlideshowState {
  slideIndex: number;
  slideCount: number;
  stepIndex: number;
  busy: boolean;
  thumbnails: Record<number, string>;
  media: SlideMediaObject[];
  warnings: string[];
}
export interface ConvertedPresentation {
  binary: Uint8Array;
  media: { name: string; data: Uint8Array }[];
}
export interface ISlideshowEngine {
  load(file: ArrayBuffer): Promise<void>;
  start(): Promise<void>;
  nextStep(): void;
  finishCurrentStep(slideIndex: number): void;
  previousStep(): void;
  requestThumbnails(): void;
  goToSlide(index: number): void;
  subscribe(listener: (state: SlideshowState) => void): () => void;
  dispose(): void;
}
