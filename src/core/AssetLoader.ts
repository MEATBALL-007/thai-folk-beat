import { Assets, Container, Graphics, Text, Texture, type Renderer } from 'pixi.js';
import { MANIFEST, type AssetSpec } from '../assets/manifest';
import { C, FONT } from '../ui/theme';

export interface LoadProgress {
  loaded: number;
  total: number;
  /** Keys that fell back to a generated placeholder. */
  missing: string[];
}

/**
 * Loads every manifest entry, substituting a generated placeholder for anything
 * that is not on disk (spec §6).
 *
 * The point is that a missing PNG is a *normal* state, not an error: the
 * designer is still exporting art, and the build has to run tonight regardless.
 * Each miss logs exactly one line so the console stays readable.
 */
export class AssetLoader {
  private readonly textures = new Map<string, Texture>();
  private readonly missing: string[] = [];
  private renderer: Renderer | null = null;

  setRenderer(renderer: Renderer): void {
    this.renderer = renderer;
  }

  get missingKeys(): readonly string[] {
    return this.missing;
  }

  has(key: string): boolean {
    return this.textures.has(key);
  }

  /** Never throws and never returns undefined — placeholders fill every gap. */
  get(key: string): Texture {
    return this.textures.get(key) ?? Texture.WHITE;
  }

  /** True when this key came from a real file rather than a placeholder. */
  isReal(key: string): boolean {
    return this.textures.has(key) && !this.missing.includes(key);
  }

  async loadAll(onProgress?: (p: LoadProgress) => void): Promise<LoadProgress> {
    const total = MANIFEST.length;
    let loaded = 0;

    for (const spec of MANIFEST) {
      let texture: Texture | null = null;

      try {
        const result: unknown = await Assets.load(spec.path);
        if (result instanceof Texture && result.width > 1 && result.height > 1) {
          texture = result;
        }
      } catch {
        texture = null;
      }

      if (!texture) {
        this.missing.push(spec.key);
        console.info(`[assets] missing "${spec.path}" -> placeholder for ${spec.key}`);
        texture = this.makePlaceholder(spec);
      }

      this.textures.set(spec.key, texture);
      loaded++;
      onProgress?.({ loaded, total, missing: [...this.missing] });
    }

    if (this.missing.length) {
      console.info(
        `[assets] ${this.missing.length}/${total} using placeholders. See public/assets/README.md.`,
      );
    }

    return { loaded, total, missing: [...this.missing] };
  }

  /**
   * A labelled rectangle in the palette, with the asset key drawn on it so a
   * screenshot of the demo tells the designer exactly which file to drop in.
   */
  private makePlaceholder(spec: AssetSpec): Texture {
    // Placeholders are generated at a fraction of the 4K authoring size — an
    // actual 3840x2160 render target per background would cost far more VRAM
    // than the demo needs, and it is only ever shown scaled down.
    const scale = Math.min(1, 720 / Math.max(spec.w, spec.h));
    const w = Math.max(64, Math.round(spec.w * scale));
    const h = Math.max(64, Math.round(spec.h * scale));

    const node = new Container();

    const tint = spec.kind === 'comic' ? C.paper : spec.kind === 'bg' ? C.cream : C.olive;
    const g = new Graphics()
      .rect(0, 0, w, h)
      .fill({ color: tint, alpha: 0.9 })
      .rect(0, 0, w, h)
      .stroke({ width: 6, color: C.ink, alignment: 0 });

    // Diagonal so a placeholder is unmistakable at a glance.
    g.moveTo(0, 0).lineTo(w, h).moveTo(w, 0).lineTo(0, h).stroke({
      width: 3,
      color: C.ink,
      alpha: 0.25,
    });

    const label = new Text({
      text: `${spec.key}\n${spec.w}x${spec.h}`,
      style: {
        fontFamily: FONT.body,
        fontSize: Math.max(18, Math.round(Math.min(w, h) / 12)),
        fill: C.ink,
        align: 'center',
        lineHeight: Math.max(22, Math.round(Math.min(w, h) / 10)),
      },
    });
    label.anchor.set(0.5);
    label.position.set(w / 2, h / 2);

    node.addChild(g, label);

    if (!this.renderer) {
      // Should not happen — App wires the renderer before loading — but a blank
      // texture is still better than a crash mid-demo.
      return Texture.WHITE;
    }

    const texture = this.renderer.generateTexture(node);
    node.destroy({ children: true });
    return texture;
  }
}

export const assetLoader = new AssetLoader();
