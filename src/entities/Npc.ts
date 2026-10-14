import { TS } from '../core/constants';
import { rnd, ri } from '../core/math';
import type { NpcDef, NpcId } from '../data/npcs';
import { NPCS } from '../data/npcs';

export class Npc {
  readonly def: NpcDef;
  x: number;
  y: number;
  private tx2: number;
  private ty2: number;
  private wait = rnd(1, 3);
  walking = false;
  phase = Math.random() * 6;

  constructor(readonly id: NpcId) {
    this.def = NPCS[id];
    this.x = this.def.tx * TS + 8;
    this.y = this.def.ty * TS + 10;
    this.tx2 = this.x;
    this.ty2 = this.y;
  }

  /** 当前所在图块，用于碰撞和对话判定 */
  get tile(): [number, number] {
    return [Math.floor(this.x / TS), Math.floor((this.y - 3) / TS)];
  }

  update(dt: number, canStand: (tx: number, ty: number) => boolean): void {
    this.phase += dt;
    const w = this.def.wander;
    if (!w) return;
    if (!this.walking) {
      this.wait -= dt;
      if (this.wait <= 0) {
        const tx = ri(w[0], w[2]);
        const ty = ri(w[1], w[3]);
        if (canStand(tx, ty)) {
          this.tx2 = tx * TS + 8;
          this.ty2 = ty * TS + 10;
          this.walking = true;
        } else this.wait = 0.5;
      }
      return;
    }
    const dx = this.tx2 - this.x;
    const dy = this.ty2 - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) {
      this.walking = false;
      this.wait = rnd(2, 5);
      return;
    }
    const step = Math.min(d, 26 * dt);
    const nx = this.x + (dx / d) * step;
    const ny = this.y + (dy / d) * step;
    if (canStand(Math.floor(nx / TS), Math.floor((ny - 3) / TS))) {
      this.x = nx;
      this.y = ny;
    } else {
      this.walking = false;
      this.wait = 1;
    }
  }
}
