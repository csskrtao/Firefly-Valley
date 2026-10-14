import { TS } from '../core/constants';

export class Player {
  x = 0;
  y = 0;
  readonly hw = 5;
  readonly hh = 4;
  /** 朝向 */
  fx = 0;
  fy = 1;
  walk = 0;
  moving = false;
  /** 挥砍动画剩余时间 */
  atkT = 0;
  atkCd = 0;
  /** 无敌时间 */
  inv = 0;
  /** 每次攻击自增，防止同一下打中同一个敌人两次 */
  swing = 0;
  kx = 0;
  ky = 0;
  castT = 0;
  skillCd = 0;
  dashT = 0;
  dashId = 0;
  spinT = 0;

  place(tx: number, ty: number): void {
    this.x = tx * TS + 8;
    this.y = ty * TS + 10;
    this.kx = this.ky = 0;
    this.dashT = 0;
  }

  face(fx: number, fy: number): void {
    this.fx = fx;
    this.fy = fy;
  }

  /** 面前的图块 */
  frontTile(): [number, number] {
    return [Math.floor((this.x + this.fx * 12) / TS), Math.floor((this.y - 3 + this.fy * 12) / TS)];
  }

  /** 脚下的图块 */
  tile(): [number, number] {
    return [Math.floor(this.x / TS), Math.floor((this.y - 3) / TS)];
  }

  tick(dt: number): void {
    this.atkT = Math.max(0, this.atkT - dt);
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.inv = Math.max(0, this.inv - dt);
    this.skillCd = Math.max(0, this.skillCd - dt);
    this.castT = Math.max(0, this.castT - dt);
    this.spinT = Math.max(0, this.spinT - dt);
    this.kx *= Math.pow(0.001, dt);
    this.ky *= Math.pow(0.001, dt);
  }
}
