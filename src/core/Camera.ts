import { VH, VW } from './constants';
import { clamp, rnd } from './math';

export class Camera {
  x = 0;
  y = 0;
  private shakeT = 0;
  private shakeMag = 0;
  enabledShake = true;

  follow(tx: number, ty: number, mapW: number, mapH: number): void {
    this.x = mapW <= VW ? (mapW - VW) / 2 : clamp(tx - VW / 2, 0, mapW - VW);
    this.y = mapH <= VH ? (mapH - VH) / 2 : clamp(ty - VH / 2, 0, mapH - VH);
  }

  shake(t: number, mag = 2): void {
    if (!this.enabledShake) return;
    this.shakeT = Math.max(this.shakeT, t);
    this.shakeMag = mag;
  }

  update(dt: number): void {
    this.shakeT = Math.max(0, this.shakeT - dt);
  }

  /** 加上震动后取整的镜头位置，用于绘制。 */
  get ox(): number { return Math.round(this.x + (this.shakeT > 0 ? rnd(-1, 1) * this.shakeMag * this.shakeT * 4 : 0)); }
  get oy(): number { return Math.round(this.y + (this.shakeT > 0 ? rnd(-1, 1) * this.shakeMag * this.shakeT * 4 : 0)); }
}
