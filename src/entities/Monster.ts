import { rnd } from '../core/math';
import type { MonsterDef, MonsterId } from '../data/monsters';
import { MONSTERS, scaleFor } from '../data/monsters';
import { draw, flashOf } from '../gfx/sprite';
import { monsterSprites } from '../gfx/sprites';
import type { EnemyHost } from './Enemy';
import { Enemy } from './Enemy';

type MoleState = 'up' | 'down' | 'pop';

export class Monster extends Enemy {
  readonly def: MonsterDef;
  override readonly mid: MonsterId;
  private t = Math.random();
  private ph = Math.random() * 6;
  private hop = false;
  private vx = 0;
  private vy = 0;
  private st: MoleState = 'up';
  private sporeCd = rnd(1, 3);
  private puff = 0;

  /** size 放大碰撞框，给野外区域的 Boss 用 */
  constructor(mid: MonsterId, x: number, y: number, floor: number, size = 1) {
    const d = MONSTERS[mid];
    const s = scaleFor(floor);
    super(x, y, d.hw * size, d.hh * size, Math.round(d.hp * s.hp), Math.round(d.atk * s.atk));
    this.def = d;
    this.mid = mid;
    this.knock = d.knock;
    if (d.ai === 'burrow') this.t = rnd(0.5, 2);
  }

  get name(): string {
    return this.def.name;
  }

  override get hidden(): boolean {
    return this.def.ai === 'burrow' && this.st === 'down';
  }

  update(h: EnemyHost, dt: number): void {
    const fly = this.def.ai === 'fly';
    this.ph += dt;
    if (this.baseUpdate(h, dt, fly)) return;
    const p = h.player;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const aggro = dist < 150;
    const spd = this.def.speed;

    switch (this.def.ai) {
      case 'hop': {
        this.t -= dt;
        if (this.t <= 0) {
          if (this.hop) {
            this.hop = false;
            this.t = rnd(0.45, 0.9);
          } else {
            this.hop = true;
            this.t = 0.32;
            const a = aggro ? Math.atan2(dy, dx) : rnd(0, Math.PI * 2);
            this.vx = Math.cos(a) * spd;
            this.vy = Math.sin(a) * spd;
          }
        }
        if (this.hop) h.move(this, this.vx * dt, this.vy * dt, this.hw, this.hh);
        break;
      }
      case 'fly': {
        const a = aggro ? Math.atan2(dy, dx) + Math.sin(this.ph * 3) * 1.1 : this.ph * 0.7;
        h.move(this, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, this.hw, this.hh, true);
        break;
      }
      case 'walk':
        if (aggro) h.move(this, ux * spd * dt, uy * spd * dt, this.hw, this.hh);
        break;
      case 'spore': {
        this.sporeCd -= dt;
        this.puff = Math.max(0, this.puff - dt);
        if (this.puff > 0) break;
        if (aggro && dist < 42 && this.sporeCd <= 0) {
          // 喷出孢子云：先预警再生效
          this.sporeCd = 3.2;
          this.puff = 0.8;
          h.addHazard({ x: this.x, y: this.y - 2, r: 26, arm: 0.7, life: 1.1, dmg: this.atk, color: '#d9c2a0' });
          h.sfx('magic');
        } else if (aggro) h.move(this, ux * spd * dt, uy * spd * dt, this.hw, this.hh);
        break;
      }
      case 'burrow': {
        this.t -= dt;
        if (this.st === 'up') {
          if (aggro) h.move(this, ux * spd * 0.45 * dt, uy * spd * 0.45 * dt, this.hw, this.hh);
          if (this.t <= 0) {
            this.st = 'down';
            this.t = 1.6;
            h.burst(this.x, this.y, '#7a5a44', 6, 40);
          }
        } else if (this.st === 'down') {
          if (aggro) h.move(this, ux * spd * dt, uy * spd * dt, this.hw, this.hh);
          if (Math.random() < 0.4) h.burst(this.x, this.y + 2, '#8a6a4a', 1, 20);
          if (this.t <= 0) {
            this.st = 'pop';
            this.t = 0.35;
          }
        } else if (this.t <= 0) {
          this.st = 'up';
          this.t = rnd(1.6, 2.4);
          h.burst(this.x, this.y, '#8a6a4a', 10, 60);
          if (Math.hypot(p.x - this.x, p.y - this.y) < 16) h.hurtPlayer(this.atk + 4, this.x, this.y);
        }
        break;
      }
    }
    this.contact(h);
  }

  draw(b: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
    const x = this.x - cx;
    const y = this.y - cy;
    const facingLeft = this.vx < 0;
    switch (this.mid) {
      case 'slime': {
        const img = monsterSprites.slime[0];
        const st = this.hop ? 1.15 : 1 + Math.sin(t * 6 + this.ph) * 0.05;
        this.drawShadow(b, cx, cy);
        this.paint(b, img, x - 8 / st, y - 12 - 4 * (st - 1) - (this.hop ? 2 : 0), facingLeft, 16 / st, 16 * st);
        break;
      }
      case 'bat': {
        const img = monsterSprites.bat[Math.floor(t * 8 + this.ph) % 2];
        this.drawShadow(b, cx, cy, 8);
        this.paint(b, img, x - 8, y - 14 + Math.sin(t * 5 + this.ph) * 2);
        break;
      }
      case 'mole': {
        if (this.st === 'down') {
          b.fillStyle = '#6b4a2b';
          b.fillRect(Math.round(x - 6), Math.round(y), 12, 3);
          b.fillStyle = '#8a6a4a';
          b.fillRect(Math.round(x - 4), Math.round(y - 1), 8, 2);
          return;
        }
        const rise = this.st === 'pop' ? 6 : 0;
        this.drawShadow(b, cx, cy);
        this.paint(b, monsterSprites.mole[0], x - 8, y - 12 + rise);
        break;
      }
      default: {
        const img = monsterSprites[this.mid as 'skeleton' | 'mushroom' | 'golem'][0];
        this.drawShadow(b, cx, cy);
        const bob = this.def.ai === 'spore' && this.puff > 0 ? Math.sin(t * 30) : Math.floor(t * 6 + this.ph) % 2;
        this.paint(b, img, x - 8, y - 15 + bob);
      }
    }
    if (this.frozen > 0) {
      b.fillStyle = 'rgba(150,220,255,.45)';
      const w = this.hw * 2 + 4;
      const hgt = this.hh * 2 + 8;
      b.fillRect(Math.round(x - w / 2), Math.round(y - hgt + 2), w, hgt);
    }
    this.drawHpBar(b, cx, cy);
  }

  private paint(b: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, flip = false, w = img.width, h = img.height): void {
    draw(b, img, x, y, flip, w, h);
    if (this.flash > 0) {
      b.globalAlpha = 0.8;
      draw(b, flashOf(img), x, y, flip, w, h);
      b.globalAlpha = 1;
    }
  }
}
