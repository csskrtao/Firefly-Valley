import type { Sfx } from '../core/Audio';
import type { BossId, MonsterId } from '../data/monsters';

export interface Box {
  x: number;
  y: number;
}

/** 地面危险区：先闪烁预警（arm），然后在 life 时间内造成伤害 */
export interface Hazard {
  x: number;
  y: number;
  r: number;
  arm: number;
  life: number;
  dmg: number;
  color: string;
  /** 已经打中过玩家 */
  hit?: boolean;
}

/** 敌人需要从场景拿到的能力，场景实现这个接口，实体就不必直接依赖场景 */
export interface EnemyHost {
  readonly player: { x: number; y: number };
  readonly mapW: number;
  readonly mapH: number;
  move(e: Box, dx: number, dy: number, hw: number, hh: number, fly?: boolean): boolean;
  boxFree(x: number, y: number, hw: number, hh: number): boolean;
  hurtPlayer(raw: number, sx: number, sy: number): void;
  spawnMonster(id: MonsterId, x: number, y: number): void;
  countMonsters(id: MonsterId): number;
  addHazard(h: Hazard): void;
  burst(x: number, y: number, color: string, n?: number, speed?: number): void;
  ring(x: number, y: number, r: number, t: number, color: string): void;
  shake(t: number, mag?: number): void;
  sfx(name: Sfx): void;
  toast(msg: string): void;
}

export abstract class Enemy {
  flash = 0;
  frozen = 0;
  kx = 0;
  ky = 0;
  /** 最近一次命中它的攻击编号 */
  hitBy = -1;
  orbCd = 0;
  /** 离地高度，跳起时不可被攻击 */
  z = 0;
  knock = 1;
  readonly boss: BossId | null = null;
  readonly mid: MonsterId | null = null;
  maxHp: number;

  constructor(
    public x: number,
    public y: number,
    readonly hw: number,
    readonly hh: number,
    public hp: number,
    public atk: number,
  ) {
    this.maxHp = hp;
  }

  abstract get name(): string;
  abstract update(h: EnemyHost, dt: number): void;
  abstract draw(b: CanvasRenderingContext2D, cx: number, cy: number, t: number): void;

  /** 钻地等状态下看不见也打不到 */
  get hidden(): boolean {
    return false;
  }

  get targetable(): boolean {
    return this.z <= 6 && !this.hidden;
  }

  /** 受到伤害的倍率，例如 Boss 眩晕时更脆 */
  get damageMul(): number {
    return 1;
  }

  /** 公共的每帧逻辑：受击闪烁、击退、冰冻。返回 true 表示被冻住，本帧不行动 */
  protected baseUpdate(h: EnemyHost, dt: number, fly = false): boolean {
    this.flash = Math.max(0, this.flash - dt);
    if (this.kx || this.ky) {
      h.move(this, this.kx * dt, this.ky * dt, this.hw, this.hh, fly);
      const decay = Math.pow(0.002, dt);
      this.kx *= decay;
      this.ky *= decay;
      if (Math.abs(this.kx) < 4) this.kx = 0;
      if (Math.abs(this.ky) < 4) this.ky = 0;
    }
    if (this.frozen > 0 && this.z <= 4) {
      this.frozen -= dt;
      return true;
    }
    return false;
  }

  /** 碰到玩家造成接触伤害 */
  protected contact(h: EnemyHost, dmg = this.atk): void {
    if (!this.targetable || this.frozen > 0) return;
    const p = h.player;
    if (Math.abs(p.x - this.x) < this.hw + 6 && Math.abs(p.y - this.y) < this.hh + 6) h.hurtPlayer(dmg, this.x, this.y);
  }

  protected drawHpBar(b: CanvasRenderingContext2D, cx: number, cy: number, yOff = 18): void {
    if (this.hp >= this.maxHp) return;
    const x = Math.round(this.x - cx);
    const y = Math.round(this.y - cy - yOff);
    b.fillStyle = '#0b0910';
    b.fillRect(x - 7, y, 14, 3);
    b.fillStyle = '#ef5d5d';
    b.fillRect(x - 6, y + 1, Math.max(0, Math.round((12 * this.hp) / this.maxHp)), 1);
  }

  protected drawShadow(b: CanvasRenderingContext2D, cx: number, cy: number, w = 10): void {
    b.fillStyle = 'rgba(0,0,0,.28)';
    b.fillRect(Math.round(this.x - cx - w / 2), Math.round(this.y - cy + 3), w, 2);
  }
}
