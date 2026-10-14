import { TAU, clamp, rnd } from '../core/math';
import { BOSSES } from '../data/monsters';
import { draw, flashOf } from '../gfx/sprite';
import { monsterSprites } from '../gfx/sprites';
import type { EnemyHost } from './Enemy';
import { Enemy } from './Enemy';

/** 第 5 层守层者：跳起砸地，半血后分裂 */
export class SlimeKing extends Enemy {
  override readonly boss = 'slimeKing' as const;
  private st: 'walk' | 'jump' | 'rest' = 'walk';
  private t = 2;
  private dur = 1;
  private sx = 0;
  private sy = 0;
  tx = 0;
  ty = 0;
  private split = false;

  constructor(x: number, y: number) {
    super(x, y, 17, 11, BOSSES.slimeKing.hp, BOSSES.slimeKing.atk);
    this.knock = 0.25;
  }

  get name(): string {
    return BOSSES.slimeKing.name;
  }

  get enraged(): boolean {
    return this.hp < this.maxHp * 0.5;
  }

  update(h: EnemyHost, dt: number): void {
    if (this.baseUpdate(h, dt)) return;
    const p = h.player;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (this.enraged && !this.split) {
      this.split = true;
      h.toast('史莱姆王分裂了！');
      for (let i = 0; i < 3; i++) h.spawnMonster('slime', this.x + rnd(-30, 30), this.y + rnd(-20, 20));
    }
    this.t -= dt;
    const speed = this.enraged ? 1.4 : 1;
    if (this.st === 'walk') {
      h.move(this, (dx / d) * 24 * speed * dt, (dy / d) * 24 * speed * dt, this.hw, this.hh);
      if (this.t <= 0) {
        this.st = 'jump';
        this.t = this.dur = this.enraged ? 0.9 : 1.15;
        this.sx = this.x;
        this.sy = this.y;
        this.tx = clamp(p.x, 40, h.mapW - 40);
        this.ty = clamp(p.y, 40, h.mapH - 24);
      }
    } else if (this.st === 'jump') {
      const k = 1 - this.t / this.dur;
      this.x = this.sx + (this.tx - this.sx) * k;
      this.y = this.sy + (this.ty - this.sy) * k;
      this.z = Math.sin(k * Math.PI) * 70;
      if (this.t <= 0) {
        this.z = 0;
        this.st = 'rest';
        this.t = this.enraged ? 0.7 : 1.1;
        h.shake(0.35);
        h.sfx('slam');
        h.ring(this.x, this.y, 40, 0.4, '#b06bd8');
        h.burst(this.x, this.y, '#b06bd8', 16, 60);
        if (Math.hypot(p.x - this.x, (p.y - this.y) * 1.4) < 40) h.hurtPlayer(this.atk + 8, this.x, this.y);
        if (this.enraged && h.countMonsters('slime') < 5) {
          for (let i = 0; i < 2; i++) h.spawnMonster('slime', this.x + rnd(-24, 24), this.y + rnd(-10, 10));
        }
      }
      return;
    } else if (this.t <= 0) {
      this.st = 'walk';
      this.t = rnd(1.4, 2.4) * (this.enraged ? 0.7 : 1);
    }
    if (this.z < 4) this.contact(h);
  }

  draw(b: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
    const x = this.x - cx;
    const y = this.y - cy;
    if (this.st === 'jump') {
      const k = 1 - this.t / this.dur;
      b.fillStyle = 'rgba(255,60,90,.35)';
      b.beginPath();
      b.ellipse(this.tx - cx, this.ty - cy, 40 * k + 6, 16 * k + 3, 0, 0, TAU);
      b.fill();
    }
    const sh = this.st === 'jump' ? 1 - this.z / 90 : 1;
    b.fillStyle = 'rgba(0,0,0,.35)';
    b.beginPath();
    b.ellipse(x, y + 2, 20 * sh, 7 * sh, 0, 0, TAU);
    b.fill();
    const sq = this.st === 'rest' ? 1 + Math.max(0, this.t - 0.6) * 0.6 : 1 + Math.sin(t * 4) * 0.04;
    const W = 48 * sq;
    const H = 48 / sq;
    const img = monsterSprites.king[0];
    const top = y - H + 8 - this.z;
    draw(b, img, x - W / 2, top, false, W, H);
    if (this.flash > 0) {
      b.globalAlpha = 0.8;
      draw(b, flashOf(img), x - W / 2, top, false, W, H);
      b.globalAlpha = 1;
    }
    if (this.frozen > 0) {
      b.fillStyle = 'rgba(150,220,255,.4)';
      b.fillRect(Math.round(x - W / 2 + 4), Math.round(top + 18), Math.round(W - 8), Math.round(H - 18));
    }
    const cyy = Math.round(top + 14);
    const rx = Math.round(x);
    b.fillStyle = '#ffd34d';
    b.fillRect(rx - 9, cyy, 18, 5);
    b.fillRect(rx - 9, cyy - 4, 3, 4);
    b.fillRect(rx - 1, cyy - 6, 3, 6);
    b.fillRect(rx + 6, cyy - 4, 3, 4);
    b.fillStyle = '#62f0d6';
    b.fillRect(rx, cyy + 1, 2, 2);
  }
}

type JawState = 'walk' | 'aim' | 'charge' | 'stunned' | 'sink' | 'under' | 'rise';

/** 第 10 层守层者：直线冲撞（撞墙会眩晕）和钻地突袭 */
export class IronJaw extends Enemy {
  override readonly boss = 'ironJaw' as const;
  private st: JawState = 'walk';
  private t = 2.5;
  private ax = 0;
  private ay = 0;
  private faceLeft = false;
  private raged = false;

  constructor(x: number, y: number) {
    super(x, y, 18, 12, BOSSES.ironJaw.hp, BOSSES.ironJaw.atk);
    this.knock = 0.15;
  }

  get name(): string {
    return BOSSES.ironJaw.name;
  }

  get enraged(): boolean {
    return this.hp < this.maxHp * 0.5;
  }

  override get hidden(): boolean {
    return this.st === 'under' || this.st === 'sink';
  }

  override get damageMul(): number {
    return this.st === 'stunned' ? 1.6 : 1;
  }

  update(h: EnemyHost, dt: number): void {
    if (this.baseUpdate(h, dt)) return;
    const p = h.player;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (this.enraged && !this.raged) {
      this.raged = true;
      h.toast('铁颚掘地者暴怒了！');
      h.sfx('rumble');
      h.shake(0.6);
    }
    const rage = this.enraged ? 1.35 : 1;
    this.t -= dt;
    switch (this.st) {
      case 'walk':
        this.faceLeft = dx < 0;
        h.move(this, (dx / d) * 30 * rage * dt, (dy / d) * 30 * rage * dt, this.hw, this.hh);
        this.contact(h);
        if (this.t <= 0) {
          if (Math.random() < 0.55) {
            this.st = 'aim';
            this.t = this.enraged ? 0.6 : 0.85;
          } else {
            this.st = 'sink';
            this.t = 0.5;
            h.sfx('rumble');
          }
        }
        break;
      case 'aim':
        this.ax = dx / d;
        this.ay = dy / d;
        this.faceLeft = dx < 0;
        if (this.t <= 0) {
          this.st = 'charge';
          this.t = 1.6;
          h.sfx('dash');
        }
        break;
      case 'charge': {
        const sp = 230 * rage * dt;
        const moved = h.move(this, this.ax * sp, this.ay * sp, this.hw, this.hh);
        if (Math.random() < 0.6) h.burst(this.x - this.ax * 16, this.y, '#8a6a4a', 1, 30);
        this.contact(h, this.atk + 8);
        if (!moved) {
          this.st = 'stunned';
          this.t = this.enraged ? 2 : 2.6;
          h.shake(0.5, 3);
          h.sfx('slam');
          h.burst(this.x + this.ax * 18, this.y - 6, '#c9d4e0', 14, 80);
          h.toast('铁颚撞上了岩壁，晕了过去！');
        } else if (this.t <= 0) {
          this.st = 'walk';
          this.t = rnd(1.5, 2.5);
        }
        break;
      }
      case 'stunned':
        if (this.t <= 0) {
          this.st = 'walk';
          this.t = rnd(1.5, 2.2);
        }
        break;
      case 'sink':
        if (this.t <= 0) {
          this.st = 'under';
          this.t = this.enraged ? 1.6 : 2.1;
        }
        break;
      case 'under':
        h.move(this, (dx / d) * 90 * rage * dt, (dy / d) * 90 * rage * dt, this.hw, this.hh, true);
        if (Math.random() < 0.7) h.burst(this.x + rnd(-8, 8), this.y + 2, '#8a6a4a', 1, 25);
        if (this.t <= 0) {
          this.st = 'rise';
          this.t = 0.65;
          h.addHazard({ x: this.x, y: this.y, r: 32, arm: 0.6, life: 0.12, dmg: this.atk + 6, color: '#ff5a3a' });
        }
        break;
      case 'rise':
        if (this.t <= 0) {
          this.st = 'walk';
          this.t = rnd(1.4, 2.2);
          h.shake(0.4, 3);
          h.sfx('slam');
          h.burst(this.x, this.y, '#8a6a4a', 18, 90);
          if (this.enraged && h.countMonsters('mole') < 4) {
            for (let i = 0; i < 2; i++) h.spawnMonster('mole', this.x + rnd(-30, 30), this.y + rnd(-16, 16));
          }
        }
        break;
    }
  }

  draw(b: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
    const x = Math.round(this.x - cx);
    const y = Math.round(this.y - cy);
    if (this.st === 'aim') {
      // 冲撞预警线
      b.save();
      b.globalAlpha = 0.25 + 0.2 * Math.sin(t * 30);
      b.strokeStyle = '#ff3a3a';
      b.lineWidth = 14;
      b.beginPath();
      b.moveTo(x, y - 4);
      b.lineTo(x + this.ax * 200, y - 4 + this.ay * 200);
      b.stroke();
      b.restore();
    }
    if (this.st === 'under' || this.st === 'rise') {
      b.fillStyle = '#5a3a22';
      b.beginPath();
      b.ellipse(x, y + 2, 14, 5, 0, 0, TAU);
      b.fill();
      b.fillStyle = '#7a5530';
      b.fillRect(x - 6, y - 2, 12, 3);
      return;
    }
    const sink = this.st === 'sink' ? 1 - this.t / 0.5 : 0;
    b.fillStyle = 'rgba(0,0,0,.35)';
    b.beginPath();
    b.ellipse(x, y + 3, 22, 7, 0, 0, TAU);
    b.fill();
    b.save();
    b.beginPath();
    b.rect(x - 40, y - 60, 80, 64);
    b.clip();
    const dir = this.faceLeft ? -1 : 1;
    const top = y - 26 + sink * 28 + (this.st === 'walk' ? Math.round(Math.sin(t * 10)) : 0);
    const flash = this.flash > 0;
    const c = (col: string) => (flash ? '#ffffff' : col);
    // 身体
    b.fillStyle = c('#4a3a34');
    b.fillRect(x - 18, top + 6, 36, 22);
    b.fillRect(x - 14, top + 2, 28, 4);
    b.fillStyle = c('#5e4a42');
    b.fillRect(x - 16, top + 8, 32, 4);
    // 铁甲片
    b.fillStyle = c('#8c96a3');
    for (let i = 0; i < 4; i++) b.fillRect(x - 15 + i * 8, top + 4, 6, 3);
    b.fillStyle = c('#b8c2cc');
    b.fillRect(x - 15, top + 4, 30, 1);
    // 铁颚
    const jx = x + dir * 16;
    const open = this.st === 'charge' || this.st === 'aim' ? 3 : Math.round(Math.abs(Math.sin(t * 3)) * 2);
    b.fillStyle = c('#c9d4e0');
    b.fillRect(Math.min(jx, jx + dir * 12), top + 10 - open, 12, 5);
    b.fillRect(Math.min(jx, jx + dir * 12), top + 17 + open, 12, 5);
    b.fillStyle = c('#eef3f7');
    for (let i = 0; i < 3; i++) {
      b.fillRect(jx + dir * (2 + i * 4), top + 15 - open, 2, 2);
      b.fillRect(jx + dir * (2 + i * 4), top + 16 + open, 2, 2);
    }
    // 眼睛
    b.fillStyle = this.enraged ? '#ff3a3a' : '#ffcf5a';
    b.fillRect(x + dir * 8 - 1, top + 9, 3, 2);
    // 爪子
    b.fillStyle = c('#d9d2c0');
    b.fillRect(x - 16, top + 27, 6, 3);
    b.fillRect(x + 10, top + 27, 6, 3);
    b.restore();
    if (this.frozen > 0) {
      b.fillStyle = 'rgba(150,220,255,.4)';
      b.fillRect(x - 20, top + 2, 40, 28);
    }
    if (this.st === 'stunned') {
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + (i * TAU) / 3;
        b.fillStyle = '#ffd34d';
        b.fillRect(Math.round(x + Math.cos(a) * 14), Math.round(top - 4 + Math.sin(a) * 4), 3, 3);
      }
    }
  }
}
