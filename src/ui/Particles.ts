import { Container, Graphics } from 'pixi.js';

interface Particle {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  spin: number;
}

const POOL_SIZE = 120;
const GRAVITY = 1400; // design px / s^2

/**
 * Tiny pooled particle burst for PERFECT hits (spec §8 polish).
 *
 * The pool is fixed and allocated once: spawning Graphics mid-song would hand
 * the GC work to do exactly when the frame budget matters most, and a dropped
 * frame during a rhythm game is the one thing the player feels.
 *
 * Motion is integrated per frame rather than derived from the song clock — these
 * are decorative and never judged, so drift is irrelevant here.
 */
export class Particles {
  readonly container = new Container();
  private readonly pool: Particle[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      const gfx = new Graphics().rect(-6, -6, 12, 12).fill(0xffffff);
      gfx.visible = false;
      this.container.addChild(gfx);
      this.pool.push({ gfx, vx: 0, vy: 0, life: 0, maxLife: 1, spin: 0 });
    }
  }

  burst(x: number, y: number, color: number, count = 12): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length;
      if (!p) continue;

      // Fan upward and outward from the receptor.
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const speed = 260 + Math.random() * 340;

      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.maxLife = 0.42 + Math.random() * 0.28;
      p.life = p.maxLife;
      p.spin = (Math.random() - 0.5) * 14;

      p.gfx.tint = color;
      p.gfx.position.set(x, y);
      p.gfx.scale.set(0.6 + Math.random() * 0.7);
      p.gfx.rotation = Math.random() * Math.PI;
      p.gfx.alpha = 1;
      p.gfx.visible = true;
    }
  }

  update(dtMS: number): void {
    const dt = Math.min(dtMS, 100) / 1000; // clamp so a stall cannot fling them

    for (const p of this.pool) {
      if (p.life <= 0) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.gfx.visible = false;
        continue;
      }

      p.vy += GRAVITY * dt;
      p.gfx.x += p.vx * dt;
      p.gfx.y += p.vy * dt;
      p.gfx.rotation += p.spin * dt;

      const k = p.life / p.maxLife;
      p.gfx.alpha = k;
      p.gfx.scale.set(0.3 + k * 0.8);
    }
  }

  clear(): void {
    for (const p of this.pool) {
      p.life = 0;
      p.gfx.visible = false;
    }
  }
}
