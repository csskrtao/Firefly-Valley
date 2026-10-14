import { TS } from '../core/constants';
import { ri, rnd } from '../core/math';
import type { NpcDef, NpcId } from '../data/npcs';
import { NPCS, scheduleAt } from '../data/npcs';
import type { TileMap } from '../world/TileMap';
import { findPath } from '../world/TileMap';

const SPEED = 30;

/** 镇民：按日程在小镇里走动，到了地方就在附近闲逛，玩家靠近时会转头看过来 */
export class Npc {
  readonly def: NpcDef;
  x = 0;
  y = 0;
  fx = 0;
  fy = 1;
  walk = 0;
  walking = false;
  private path: [number, number][] = [];
  private target: [number, number] = [0, 0];
  private wait = rnd(1, 3);
  private stuck = 0;
  /** 和玩家说话后停下来一会儿 */
  private hold = 0;

  constructor(readonly id: NpcId, minutes: number) {
    this.def = NPCS[id];
    this.target = scheduleAt(this.def, minutes);
    this.x = this.target[0] * TS + 8;
    this.y = this.target[1] * TS + 10;
  }

  /** 当前所在图块，用于碰撞和对话判定 */
  get tile(): [number, number] {
    return [Math.floor(this.x / TS), Math.floor((this.y - 3) / TS)];
  }

  lookAt(px: number, py: number, hold = 0): void {
    const dx = px - this.x;
    const dy = py - this.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.fx = Math.sign(dx);
      this.fy = 0;
    } else {
      this.fx = 0;
      this.fy = Math.sign(dy) || 1;
    }
    this.hold = Math.max(this.hold, hold);
  }

  update(dt: number, minutes: number, map: TileMap, canWalk: (tx: number, ty: number) => boolean, player: { x: number; y: number }): void {
    this.hold = Math.max(0, this.hold - dt);
    const goal = scheduleAt(this.def, minutes);
    if (goal[0] !== this.target[0] || goal[1] !== this.target[1]) {
      this.target = goal;
      this.route(map, goal, canWalk);
    }
    if (this.hold > 0) {
      this.walking = false;
      return;
    }
    if (this.path.length) {
      this.follow(dt, map, canWalk);
      return;
    }
    this.walking = false;
    this.walk = 0;
    const near = Math.hypot(player.x - this.x, player.y - this.y) < 44;
    if (near) this.lookAt(player.x, player.y);
    const roam = this.def.roam;
    if (!roam) return;
    this.wait -= dt;
    if (this.wait > 0 || near) return;
    this.wait = rnd(2.5, 6);
    const tx = this.target[0] + ri(-roam, roam);
    const ty = this.target[1] + ri(-roam, roam);
    if (canWalk(tx, ty)) this.route(map, [tx, ty], canWalk);
  }

  private route(map: TileMap, goal: [number, number], canWalk: (tx: number, ty: number) => boolean): void {
    const [sx, sy] = this.tile;
    this.path = findPath(map, sx, sy, goal[0], goal[1], canWalk) ?? [];
    this.stuck = 0;
  }

  private follow(dt: number, map: TileMap, canWalk: (tx: number, ty: number) => boolean): void {
    const [nx, ny] = this.path[0];
    // 下一格被玩家挡住了就等一等，等久了换条路
    if (!canWalk(nx, ny)) {
      this.walking = false;
      this.stuck += dt;
      if (this.stuck > 1.5) {
        const last = this.path[this.path.length - 1];
        this.route(map, last, canWalk);
        if (this.stuck === 0 && !this.path.length) this.wait = 1;
      }
      return;
    }
    this.stuck = 0;
    const gx = nx * TS + 8;
    const gy = ny * TS + 10;
    const dx = gx - this.x;
    const dy = gy - this.y;
    const d = Math.hypot(dx, dy);
    const step = Math.min(d, SPEED * dt);
    if (d > 0.01) {
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.fx = Math.sign(dx);
        this.fy = 0;
      } else {
        this.fx = 0;
        this.fy = Math.sign(dy);
      }
    }
    this.walking = true;
    this.walk += step / 7;
    if (d - step < 0.5) {
      this.x = gx;
      this.y = gy;
      this.path.shift();
      if (!this.path.length) this.wait = rnd(2, 5);
    }
  }
}
