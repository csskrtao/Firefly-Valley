import { TS } from '../core/constants';

export class Player {
  x = 0;
  y = 0;
  readonly hw = 5;
  readonly hh = 4;
  /** 朝向 */
  fx = 0;
  fy = 1;
  /** 当前速度（像素/秒），加减速让起步和停下更顺滑 */
  vx = 0;
  vy = 0;
  /** 走过的距离折算成的动画进度，每 1 是一帧 */
  walk = 0;
  moving = false;
  running = false;
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
  /** 三个技能各自的冷却 */
  skillCds = [0, 0, 0];
  dashT = 0;
  dashId = 0;
  dashKind: 'shadow' | 'charge' = 'shadow';
  spinT = 0;
  /** 双刃的第二刀 */
  twinT = 0;
  /** 战吼、毒刃、萤灵增殖的剩余时间 */
  rageT = 0;
  venomT = 0;
  swarmT = 0;
  /** 最近一次挥砍的类型，画刀光用 */
  swingKind: 'slash' | 'cleave' | 'thrust' | 'twin' = 'slash';

  place(tx: number, ty: number): void {
    this.x = tx * TS + 8;
    this.y = ty * TS + 10;
    this.kx = this.ky = 0;
    this.vx = this.vy = 0;
    this.dashT = 0;
    this.twinT = 0;
    this.moving = false;
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
    for (let i = 0; i < this.skillCds.length; i++) this.skillCds[i] = Math.max(0, this.skillCds[i] - dt);
    this.rageT = Math.max(0, this.rageT - dt);
    this.venomT = Math.max(0, this.venomT - dt);
    this.swarmT = Math.max(0, this.swarmT - dt);
    this.castT = Math.max(0, this.castT - dt);
    this.spinT = Math.max(0, this.spinT - dt);
    this.kx *= Math.pow(0.001, dt);
    this.ky *= Math.pow(0.001, dt);
  }
}
