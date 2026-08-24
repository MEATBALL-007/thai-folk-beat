import { Container } from 'pixi.js';

export interface CarouselOptions {
  items: Container[];
  itemWidth: number;
  gap?: number;
  onChange?: (index: number) => void;
}

/**
 * Horizontal carousel holding N items (spec §5.4 — built for more than the two
 * songs that exist tonight).
 *
 * Items are laid out on a track that eases to centre the active one. Off-centre
 * items are scaled and faded by distance, so the active card reads as the
 * selection without needing a separate highlight.
 */
export class Carousel extends Container {
  private readonly track = new Container();
  private readonly items: Container[];
  private readonly itemWidth: number;
  private readonly gap: number;
  private readonly onChange: ((index: number) => void) | undefined;

  private current = 0;
  private offset = 0;
  private targetOffset = 0;

  constructor(opts: CarouselOptions) {
    super();
    this.items = opts.items;
    this.itemWidth = opts.itemWidth;
    this.gap = opts.gap ?? 60;
    this.onChange = opts.onChange;

    this.addChild(this.track);

    this.items.forEach((item, i) => {
      item.position.set(i * this.stride, 0);
      this.track.addChild(item);
    });

    this.targetOffset = this.offsetFor(0);
    this.offset = this.targetOffset;
    this.applyLayout();
  }

  private get stride(): number {
    return this.itemWidth + this.gap;
  }

  get index(): number {
    return this.current;
  }

  get count(): number {
    return this.items.length;
  }

  private offsetFor(index: number): number {
    return -index * this.stride;
  }

  setIndex(index: number): void {
    const clamped = Math.max(0, Math.min(this.items.length - 1, index));
    if (clamped === this.current) return;
    this.current = clamped;
    this.targetOffset = this.offsetFor(clamped);
    this.onChange?.(clamped);
  }

  next(): void {
    this.setIndex(this.current + 1);
  }

  prev(): void {
    this.setIndex(this.current - 1);
  }

  get canPrev(): boolean {
    return this.current > 0;
  }

  get canNext(): boolean {
    return this.current < this.items.length - 1;
  }

  update(dtMS: number): void {
    const k = Math.min(1, dtMS / 140);
    this.offset += (this.targetOffset - this.offset) * k;
    this.applyLayout();
  }

  private applyLayout(): void {
    this.track.position.x = this.offset;

    this.items.forEach((item, i) => {
      // Distance from centre in card units — fractional mid-slide.
      const d = Math.abs(i * this.stride + this.offset) / this.stride;
      const scale = Math.max(0.72, 1 - d * 0.22);
      item.scale.set(scale);
      item.alpha = Math.max(0.25, 1 - d * 0.55);

      // Re-centre after scaling so cards stay on one axis.
      item.position.x = i * this.stride + (this.itemWidth * (1 - scale)) / 2;
    });
  }
}
