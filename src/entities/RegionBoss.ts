import type { RegionBossDef, RegionId } from '../world/regions/defs';
import { REGIONS } from '../world/regions/defs';
import { Monster } from './Monster';

/** 画面上放大几倍 */
const SCALE = 2;

/**
 * 野外区域的 Boss：沿用一种普通怪物的行为和像素图，画成两倍大，
 * 血量和攻击按区域单独给。打倒以后当天不会再出现。
 */
export class RegionBoss extends Monster {
  readonly bdef: RegionBossDef;
  /** 已经在画面上报过名字了 */
  announced = false;

  constructor(readonly region: RegionId, x: number, y: number) {
    const bdef = REGIONS[region].boss!;
    super(bdef.base, x, y, 1, SCALE);
    this.bdef = bdef;
    this.hp = this.maxHp = bdef.hp;
    this.atk = bdef.atk;
    this.knock = 0.2;
  }

  override get name(): string {
    return this.bdef.name;
  }

  /** 血量显示在屏幕上方的 Boss 血条里 */
  protected override drawHpBar(): void {}

  override draw(b: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
    const x = Math.round(this.x - cx);
    const y = Math.round(this.y - cy);
    // 脚下一圈主题色的光环，提醒这是 Boss
    b.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3);
    b.fillStyle = REGIONS[this.region].color;
    b.beginPath();
    b.ellipse(x, y + 3, this.hw + 6, (this.hw + 6) * 0.4, 0, 0, Math.PI * 2);
    b.fill();
    b.globalAlpha = 1;
    // 以脚底为原点放大，再按普通怪物的画法画
    b.save();
    b.translate(x, y);
    b.scale(SCALE, SCALE);
    super.draw(b, this.x, this.y, t);
    b.restore();
  }
}
