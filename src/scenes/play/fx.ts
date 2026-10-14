import { TAU, rnd } from '../../core/math';
import type { Renderer } from '../../core/Renderer';

interface Particle { x: number; y: number; vx: number; vy: number; t: number; c: string; g: number }
interface Floater { x: number; y: number; text: string; color: string; t: number }
interface Ring { x: number; y: number; r: number; t: number; T: number; c: string }

/** 粒子、飘字和冲击波这类纯视觉效果 */
export class Fx {
  particles: Particle[] = [];
  floaters: Floater[] = [];
  rings: Ring[] = [];

  burst(x: number, y: number, c: string, n = 8, speed = 50, gravity = 160): void {
    for (let i = 0; i < n; i++) {
      this.particles.push({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), vx: rnd(-speed, speed), vy: rnd(-speed * 1.2, speed * 0.2), t: rnd(0.3, 0.7), c, g: gravity });
    }
  }

  spark(x: number, y: number, c: string): void {
    this.particles.push({ x, y, vx: rnd(-10, 10), vy: rnd(-10, 10), t: 0.22, c, g: 0 });
  }

  text(x: number, y: number, text: string, color = '#fff'): void {
    this.floaters.push({ x, y, text, color, t: 1 });
  }

  ring(x: number, y: number, r: number, t: number, c: string): void {
    this.rings.push({ x, y, r, t, T: t, c });
  }

  clear(): void {
    this.particles = [];
    this.floaters = [];
    this.rings = [];
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      if (p.t <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t -= dt;
      f.y -= 22 * dt;
      if (f.t <= 0) this.floaters.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].t -= dt;
      if (this.rings[i].t <= 0) this.rings.splice(i, 1);
    }
  }

  drawWorld(b: CanvasRenderingContext2D, cx: number, cy: number): void {
    for (const p of this.particles) {
      b.fillStyle = p.c;
      b.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), 2, 2);
    }
    for (const r of this.rings) {
      const k = 1 - r.t / r.T;
      const rad = r.r * (0.35 + 0.65 * k);
      b.globalAlpha = r.t / r.T;
      b.strokeStyle = r.c;
      b.lineWidth = 2;
      b.beginPath();
      b.ellipse(r.x - cx, r.y - cy + 4, rad, rad * 0.6, 0, 0, TAU);
      b.stroke();
      b.globalAlpha = 1;
    }
  }

  drawText(r: Renderer, cx: number, cy: number): void {
    for (const f of this.floaters) r.text(f.text, f.x - cx, f.y - cy, f.color, 6, Math.min(1, f.t * 2));
  }
}
