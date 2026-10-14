import type { Img } from './sprite';

/**
 * 纸娃娃式角色生成器：用发型、衣服、帽子等部件拼出 16×28 的像素小人，
 * 自动生成正面、背面、侧面各 4 帧走路动画和一张 16×16 的头像。
 * 侧面只画朝右，朝左时水平翻转。
 */

export type Dir = 'down' | 'up' | 'side';
export type HairStyle = 'short' | 'spiky' | 'long' | 'bun' | 'bald' | 'ponytail' | 'bob';
export type HatKind = 'wizard' | 'hood' | 'headband' | 'cap';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  eyes?: string;
  /** 上衣 */
  top: string;
  /** 领口、腰带、袖口的点缀色 */
  trim?: string;
  lower: 'pants' | 'skirt' | 'robe';
  legs: string;
  boots: string;
  hat?: { kind: HatKind; color: string; trim?: string };
  beard?: string;
  glasses?: string;
  apron?: string;
  /** 蒙面围巾 */
  scarf?: string;
  /** 胸前的十字徽记 */
  emblem?: string;
  /** 护肩（护甲阶级的颜色） */
  pauldron?: string;
  /** 胸甲 */
  plate?: string;
  kid?: boolean;
}

export interface CharSet {
  down: Img[];
  up: Img[];
  side: Img[];
  portrait: Img;
}

export const CHAR_W = 16;
export const CHAR_H = 28;
/** 脚底所在的行 */
export const CHAR_FOOT = 26;
/** 手所在的行（成年人正面），用来对齐手持武器 */
export const CHAR_HAND = 20;

const OUTLINE = '#1c1424';

/* ---------- 颜色工具 ---------- */

const hex = (c: string): [number, number, number] => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** k < 0 变暗，k > 0 变亮 */
export function shade(c: string, k: number): string {
  const [r, g, b] = hex(c);
  const f = (v: number) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/* ---------- 像素画板 ---------- */

class Grid {
  readonly px: (string | null)[] = new Array(CHAR_W * CHAR_H).fill(null);

  set(x: number, y: number, c: string | null | undefined): void {
    if (c === undefined || x < 0 || y < 0 || x >= CHAR_W || y >= CHAR_H) return;
    this.px[y * CHAR_W + x] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: string | null | undefined): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }

  /** 一行里的若干个像素 */
  row(y: number, xs: number[], c: string): void {
    for (const x of xs) this.set(x, y, c);
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= CHAR_W || y >= CHAR_H) return null;
    return this.px[y * CHAR_W + x];
  }

  outline(): void {
    const add: number[] = [];
    for (let y = 0; y < CHAR_H; y++) {
      for (let x = 0; x < CHAR_W; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push(y * CHAR_W + x);
      }
    }
    for (const i of add) this.px[i] = OUTLINE;
  }

  toImg(): Img {
    const c = document.createElement('canvas');
    c.width = CHAR_W;
    c.height = CHAR_H;
    const g = c.getContext('2d')!;
    for (let i = 0; i < this.px.length; i++) {
      const col = this.px[i];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(i % CHAR_W, Math.floor(i / CHAR_W), 1, 1);
    }
    return c;
  }
}

/* ---------- 身体比例 ---------- */

interface Frame {
  look: Look;
  /** 头顶所在行 */
  hy: number;
  /** 躯干第一行 */
  by: number;
  torsoH: number;
  /** 腿第一行 */
  ly: number;
  legH: number;
  /** 靴子第一行 */
  fy: number;
  bootH: number;
  /** -1 左脚迈出，1 右脚迈出，0 并拢 */
  step: number;
  frame: number;
}

function frameOf(look: Look, frame: number): Frame {
  const kid = !!look.kid;
  const torsoH = kid ? 4 : 6;
  const legH = kid ? 2 : 3;
  const bootH = kid ? 1 : 2;
  const T = CHAR_FOOT - (8 + torsoH + legH + bootH) + 1;
  const step = frame === 1 ? -1 : frame === 3 ? 1 : 0;
  // 迈步的那一帧身体往下沉一个像素
  const bob = step ? 1 : 0;
  const ly = T + 8 + torsoH;
  return { look, hy: T + bob, by: T + 8 + bob, torsoH, ly, legH, fy: ly + legH, bootH, step, frame };
}

/* ---------- 正面 ---------- */

function legsFront(g: Grid, f: Frame): void {
  const { look: L, ly, legH, fy, bootH, step } = f;
  const boot = (x: number, lift: number) => {
    g.rect(x, fy - lift, 3, bootH, L.boots);
    g.rect(x, fy - lift + bootH - 1, 3, 1, shade(L.boots, -0.35));
  };
  const leftLift = step === -1 ? 1 : 0;
  const rightLift = step === 1 ? 1 : 0;
  if (L.lower === 'robe') {
    const hem = fy + bootH - 1;
    // 袍子下摆，迈步时一只靴子露出来
    g.rect(4, ly, 8, hem - ly, L.top);
    g.rect(3, hem - 1, 10, 1, L.trim ?? shade(L.top, -0.2));
    g.rect(11, ly, 1, hem - ly - 1, shade(L.top, -0.18));
    if (!leftLift) g.rect(5, hem, 2, 1, L.boots);
    if (!rightLift) g.rect(9, hem, 2, 1, L.boots);
    return;
  }
  if (L.lower === 'skirt') {
    g.rect(4, ly, 8, 1, L.legs);
    g.rect(3, ly + 1, 10, Math.max(1, legH - 2), L.legs);
    g.rect(3, ly + legH - 2, 10, 1, shade(L.legs, -0.25));
    g.rect(5, ly + legH - 1, 2, 1, L.skin);
    g.rect(9, ly + legH - 1, 2, 1, L.skin);
    boot(4, leftLift);
    boot(9, rightLift);
    return;
  }
  g.rect(5, ly, 3, legH - leftLift, L.legs);
  g.rect(8, ly, 3, legH - rightLift, L.legs);
  g.rect(7, ly + 1, 1, legH - 1 - leftLift, shade(L.legs, -0.3));
  g.rect(8, ly + 1, 1, legH - 1 - rightLift, shade(L.legs, -0.3));
  boot(5, leftLift);
  boot(8, rightLift);
}

function torsoFront(g: Grid, f: Frame, back: boolean): void {
  const { look: L, by, torsoH, step } = f;
  const top = L.top;
  g.rect(4, by, 8, torsoH, top);
  g.rect(11, by + 1, 1, torsoH - 1, shade(top, -0.18));
  g.rect(4, by, 8, 1, shade(top, 0.12));
  // 腰带
  if (L.lower !== 'robe' || L.trim) g.rect(4, by + torsoH - 1, 8, 1, L.trim ?? shade(top, -0.35));
  if (!back) {
    // 领口
    g.row(by, [7, 8], L.skin);
    if (L.trim) g.row(by, [6, 9], L.trim);
  }
  // 手臂：迈左脚时右手往前（在正面看起来是往下）
  const sleeve = shade(top, -0.12);
  const arm = (x: number, dy: number) => {
    g.rect(x, by + dy, 1, torsoH - 2, sleeve);
    g.set(x, by + dy + torsoH - 2, L.skin);
  };
  arm(3, step === -1 ? -1 : step === 1 ? 1 : 0);
  arm(12, step === 1 ? -1 : step === -1 ? 1 : 0);

  if (L.apron) {
    if (back) {
      g.rect(4, by + torsoH - 2, 8, 1, L.apron);
      g.row(by, [5, 10], L.apron);
    } else {
      g.rect(5, by + 1, 6, torsoH - 1, L.apron);
      g.rect(5, f.ly, 6, 1, L.apron);
      g.row(by, [5, 10], L.apron);
      g.rect(6, by + 3, 4, 1, shade(L.apron, -0.2));
    }
  }
  if (L.emblem && !back) {
    g.row(by + 1, [7, 8], L.emblem);
    g.row(by + 2, [6, 7, 8, 9], L.emblem);
    g.row(by + 3, [7, 8], L.emblem);
  }
  if (L.plate) {
    g.rect(5, by + 1, 6, torsoH - 2, L.plate);
    g.rect(5, by + 1, 2, 1, shade(L.plate, 0.45));
    g.rect(10, by + 2, 1, torsoH - 3, shade(L.plate, -0.25));
    if (!back) g.rect(7, by + 1, 2, 1, shade(L.plate, 0.25));
  }
  if (L.pauldron) {
    g.rect(2, by, 3, 2, L.pauldron);
    g.rect(11, by, 3, 2, L.pauldron);
    g.rect(2, by, 3, 1, shade(L.pauldron, 0.35));
    g.rect(11, by, 3, 1, shade(L.pauldron, 0.35));
  }
}

function headFront(g: Grid, f: Frame): void {
  const { look: L, hy } = f;
  g.rect(4, hy + 1, 8, 6, L.skin);
  g.rect(5, hy + 7, 6, 1, L.skin);
  g.rect(5, hy, 6, 1, L.skin);
  g.set(11, hy + 6, shade(L.skin, -0.12));
  const eye = L.eyes ?? '#2a1e2e';
  g.rect(6, hy + 4, 1, 2, eye);
  g.rect(9, hy + 4, 1, 2, eye);
  g.row(hy + 6, [5, 10], '#f0a0a0');
  hairFront(g, f);
  if (L.beard) {
    g.rect(4, hy + 6, 8, 1, L.beard);
    g.rect(5, hy + 7, 6, 1, L.beard);
    g.row(hy + 5, [4, 11], L.beard);
    g.rect(7, hy + 6, 2, 1, shade(L.beard, -0.3));
    g.rect(6, hy + 8, 4, 1, L.beard);
  }
  if (L.glasses) {
    g.row(hy + 3, [5, 6, 9, 10], L.glasses);
    g.row(hy + 4, [5, 7, 8, 10], L.glasses);
    g.row(hy + 5, [5, 10], L.glasses);
  }
  if (L.scarf) {
    g.rect(4, hy + 6, 8, 2, L.scarf);
    g.rect(5, hy + 8, 6, 1, L.scarf);
    g.rect(4, hy + 7, 8, 1, shade(L.scarf, -0.2));
  }
  hatFront(g, f);
}

function hairFront(g: Grid, f: Frame): void {
  const { look: L, hy } = f;
  const H = L.hair;
  const hi = shade(H, 0.3);
  switch (L.hairStyle) {
    case 'bald':
      g.set(6, hy + 1, shade(L.skin, 0.4));
      g.rect(4, hy + 3, 1, 2, H);
      g.rect(11, hy + 3, 1, 2, H);
      return;
    case 'bob':
      g.rect(5, hy, 6, 1, H);
      g.rect(4, hy + 1, 8, 2, H);
      g.row(hy + 3, [4, 5, 7, 8, 10, 11], H);
      g.rect(3, hy + 2, 1, 5, H);
      g.rect(12, hy + 2, 1, 5, H);
      g.rect(4, hy + 4, 1, 3, H);
      g.rect(11, hy + 4, 1, 3, H);
      g.row(hy + 1, [6, 7], hi);
      return;
    case 'spiky':
      g.row(hy - 1, [5, 8, 10], H);
      g.rect(4, hy, 8, 1, H);
      g.rect(3, hy + 1, 10, 1, H);
      g.rect(4, hy + 2, 8, 1, H);
      g.row(hy + 3, [4, 5, 7, 10, 11], H);
      g.set(11, hy + 4, H);
      g.set(4, hy + 4, H);
      g.row(hy, [6, 7], hi);
      return;
    default:
      g.rect(5, hy, 6, 1, H);
      g.rect(4, hy + 1, 8, 2, H);
      g.row(hy + 3, [4, 5, 11], H);
      g.set(4, hy + 4, H);
      g.set(11, hy + 4, H);
      g.row(hy + 1, [6, 7], hi);
      if (L.hairStyle === 'long') {
        g.rect(3, hy + 2, 2, 8, H);
        g.rect(11, hy + 2, 2, 8, H);
        g.rect(3, hy + 9, 1, 1, shade(H, -0.2));
        g.rect(12, hy + 9, 1, 1, shade(H, -0.2));
      } else if (L.hairStyle === 'bun') {
        g.rect(6, hy - 2, 4, 2, H);
        g.set(7, hy - 2, hi);
      } else if (L.hairStyle === 'ponytail') {
        g.rect(12, hy + 2, 1, 3, H);
      }
  }
}

function hatFront(g: Grid, f: Frame): void {
  const { look: L, hy, frame } = f;
  const hat = L.hat;
  if (!hat) return;
  const c = hat.color;
  const t = hat.trim ?? shade(c, 0.4);
  switch (hat.kind) {
    case 'headband': {
      g.rect(4, hy + 2, 8, 1, c);
      const flap = frame % 2;
      g.set(12, hy + 2, c);
      g.set(13, hy + 3 - flap, c);
      g.set(13, hy + 4 - flap, shade(c, -0.25));
      return;
    }
    case 'cap':
      g.rect(5, hy - 2, 6, 1, c);
      g.rect(4, hy - 1, 8, 3, c);
      g.rect(3, hy + 2, 10, 1, shade(c, -0.25));
      g.row(hy - 1, [6, 7], shade(c, 0.3));
      g.set(8, hy - 2, t);
      return;
    case 'wizard':
      g.rect(8, hy - 7, 2, 1, c);
      g.rect(7, hy - 6, 2, 2, c);
      g.rect(6, hy - 4, 4, 2, c);
      g.rect(5, hy - 2, 6, 2, c);
      g.rect(4, hy, 8, 1, c);
      g.rect(4, hy + 1, 8, 1, t);
      g.rect(2, hy + 2, 12, 1, shade(c, -0.2));
      g.set(6, hy - 2, t);
      g.set(7, hy - 4, shade(c, 0.3));
      g.row(hy + 3, [4, 11], L.hair);
      return;
    case 'hood':
      g.rect(5, hy - 1, 6, 1, c);
      g.rect(4, hy, 8, 3, c);
      g.rect(3, hy + 1, 1, 8, c);
      g.rect(12, hy + 1, 1, 8, c);
      g.rect(4, hy + 3, 1, 5, c);
      g.rect(11, hy + 3, 1, 5, c);
      g.rect(4, hy + 2, 8, 1, t);
      g.row(hy + 3, [5, 6, 10], L.hair);
      g.row(hy, [6, 7], shade(c, 0.25));
      return;
  }
}

/* ---------- 背面 ---------- */

function headBack(g: Grid, f: Frame): void {
  const { look: L, hy } = f;
  const H = L.hair;
  g.rect(4, hy + 1, 8, 6, L.skin);
  g.rect(5, hy, 6, 1, L.skin);
  g.rect(5, hy + 7, 6, 1, L.skin);
  if (L.hairStyle === 'bald') {
    g.rect(4, hy + 3, 8, 3, H);
    g.set(6, hy + 1, shade(L.skin, 0.4));
  } else {
    g.rect(5, hy, 6, 1, H);
    g.rect(4, hy + 1, 8, 6, H);
    g.rect(5, hy + 7, 6, 1, shade(H, -0.15));
    g.rect(6, hy + 1, 2, 1, shade(H, 0.3));
    g.rect(5, hy + 4, 1, 3, shade(H, -0.15));
    g.rect(10, hy + 4, 1, 3, shade(H, -0.15));
  }
  switch (L.hairStyle) {
    case 'spiky':
      g.row(hy - 1, [5, 8, 10], H);
      g.rect(3, hy + 1, 10, 1, H);
      break;
    case 'long':
      g.rect(4, hy + 7, 8, 3, H);
      g.rect(5, hy + 10, 6, 1, shade(H, -0.2));
      break;
    case 'bob':
      g.rect(3, hy + 2, 10, 5, H);
      g.rect(4, hy + 7, 8, 1, shade(H, -0.2));
      break;
    case 'bun':
      g.rect(6, hy - 2, 4, 3, H);
      g.set(7, hy - 2, shade(H, 0.3));
      break;
    case 'ponytail':
      g.rect(7, hy + 4, 2, 1, L.trim ?? shade(H, -0.4));
      g.rect(7, hy + 5, 2, 5, H);
      g.set(8, hy + 10, shade(H, -0.2));
      break;
  }
  if (L.scarf) {
    g.rect(4, hy + 6, 8, 2, L.scarf);
    g.rect(7, hy + 8, 2, 2 + (f.frame % 2), shade(L.scarf, -0.15));
  }
  const hat = L.hat;
  if (!hat) return;
  const c = hat.color;
  const t = hat.trim ?? shade(c, 0.4);
  switch (hat.kind) {
    case 'headband':
      g.rect(4, hy + 2, 8, 1, c);
      g.rect(7, hy + 3, 1, 2, c);
      g.rect(8, hy + 3, 1, 3 - (f.frame % 2), shade(c, -0.2));
      break;
    case 'cap':
      g.rect(5, hy - 2, 6, 1, c);
      g.rect(4, hy - 1, 8, 3, c);
      g.rect(6, hy + 1, 4, 1, shade(c, -0.3));
      break;
    case 'wizard':
      g.rect(8, hy - 7, 2, 1, c);
      g.rect(7, hy - 6, 2, 2, c);
      g.rect(6, hy - 4, 4, 2, c);
      g.rect(5, hy - 2, 6, 2, c);
      g.rect(4, hy, 8, 1, c);
      g.rect(4, hy + 1, 8, 1, t);
      g.rect(2, hy + 2, 12, 1, shade(c, -0.2));
      break;
    case 'hood':
      g.rect(5, hy - 1, 6, 1, c);
      g.rect(4, hy, 8, 8, c);
      g.rect(3, hy + 1, 1, 8, c);
      g.rect(12, hy + 1, 1, 8, c);
      g.rect(5, hy + 8, 6, 1, c);
      g.rect(7, hy + 1, 1, 7, shade(c, -0.25));
      g.row(hy, [6, 7], shade(c, 0.25));
      break;
  }
}

/* ---------- 侧面（朝右） ---------- */

function legsSide(g: Grid, f: Frame): void {
  const { look: L, ly, legH, fy, bootH, step } = f;
  const back = shade(L.legs, -0.25);
  const bootBack = shade(L.boots, -0.25);
  if (L.lower === 'robe') {
    const hem = fy + bootH - 1;
    g.rect(5, ly, 6, hem - ly, L.top);
    g.rect(4, hem - 1, 8, 1, L.trim ?? shade(L.top, -0.2));
    if (step) {
      g.rect(10, hem, 2, 1, L.boots);
      g.rect(4, hem, 2, 1, bootBack);
    } else g.rect(6, hem, 4, 1, L.boots);
    return;
  }
  // 一条腿：top 为大腿位置，foot 为脚的位置
  const leg = (top: number, foot: number, legC: string, bootC: string) => {
    g.rect(top, ly, 2, 1, legC);
    g.rect(foot, ly + 1, 2, legH - 1, legC);
    g.rect(foot, fy, 3, bootH, bootC);
    g.rect(foot, fy + bootH - 1, 3, 1, shade(bootC, -0.35));
  };
  if (step === -1) {
    leg(6, 5, back, bootBack);
    leg(8, 9, L.legs, L.boots);
  } else if (step === 1) {
    leg(6, 9, back, bootBack);
    leg(8, 5, L.legs, L.boots);
  } else {
    leg(6, 6, back, bootBack);
    leg(8, 8, L.legs, L.boots);
  }
  if (L.lower === 'skirt') {
    g.rect(4, ly, 8, Math.max(2, legH - 1), L.legs);
    g.rect(4, ly + Math.max(2, legH - 1) - 1, 8, 1, shade(L.legs, -0.25));
  }
}

function torsoSide(g: Grid, f: Frame): void {
  const { look: L, by, torsoH, step } = f;
  const top = L.top;
  g.rect(5, by, 6, torsoH, top);
  g.rect(5, by, 1, torsoH, shade(top, -0.18));
  g.rect(5, by, 6, 1, shade(top, 0.12));
  if (L.lower !== 'robe' || L.trim) g.rect(5, by + torsoH - 1, 6, 1, L.trim ?? shade(top, -0.35));
  if (L.apron) g.rect(10, by + 1, 1, torsoH, L.apron);
  if (L.plate) {
    g.rect(8, by + 1, 3, torsoH - 2, L.plate);
    g.set(9, by + 1, shade(L.plate, 0.45));
  }
  if (L.emblem) g.set(10, by + 2, L.emblem);
  // 手臂随步伐前后摆
  const sleeve = shade(top, -0.15);
  const swing = step === -1 ? 1 : step === 1 ? -1 : 0;
  const len = torsoH - 2;
  g.rect(7, by, 2, 1, sleeve);
  for (let i = 1; i < len; i++) {
    const off = Math.round((swing * i) / (len - 1));
    g.rect(7 + off, by + i, 2, 1, sleeve);
  }
  g.rect(7 + swing, by + len, 2, 1, L.skin);
  if (L.pauldron) {
    g.rect(6, by, 4, 2, L.pauldron);
    g.rect(6, by, 4, 1, shade(L.pauldron, 0.35));
  }
}

function headSide(g: Grid, f: Frame): void {
  const { look: L, hy, frame } = f;
  const H = L.hair;
  g.rect(5, hy + 1, 7, 6, L.skin);
  g.rect(6, hy + 7, 5, 1, L.skin);
  g.rect(5, hy, 6, 1, L.skin);
  g.set(12, hy + 4, L.skin);
  g.rect(9, hy + 4, 1, 2, L.eyes ?? '#2a1e2e');
  g.set(10, hy + 6, '#f0a0a0');
  // 耳朵
  g.set(7, hy + 4, shade(L.skin, -0.15));
  const hi = shade(H, 0.3);
  switch (L.hairStyle) {
    case 'bald':
      g.rect(5, hy + 3, 2, 3, H);
      g.set(8, hy + 1, shade(L.skin, 0.4));
      break;
    case 'spiky':
      g.row(hy - 1, [5, 7, 9], H);
      g.rect(4, hy, 8, 1, H);
      g.rect(2, hy + 1, 10, 2, H);
      g.rect(4, hy + 3, 3, 3, H);
      g.row(hy + 3, [10, 11], H);
      g.set(3, hy + 3, H);
      g.row(hy, [7, 8], hi);
      break;
    case 'bob':
      g.rect(5, hy, 6, 1, H);
      g.rect(4, hy + 1, 8, 2, H);
      g.rect(3, hy + 2, 4, 5, H);
      g.row(hy + 3, [10, 11], H);
      g.row(hy + 1, [7, 8], hi);
      break;
    default:
      g.rect(5, hy, 6, 1, H);
      g.rect(4, hy + 1, 8, 2, H);
      g.rect(4, hy + 3, 3, 3, H);
      g.set(11, hy + 3, H);
      g.set(5, hy + 6, H);
      g.row(hy + 1, [7, 8], hi);
      if (L.hairStyle === 'long') g.rect(3, hy + 3, 3, 7, H);
      else if (L.hairStyle === 'bun') g.rect(2, hy, 3, 3, H);
      else if (L.hairStyle === 'ponytail') {
        g.set(4, hy + 3, L.trim ?? shade(H, -0.4));
        g.rect(2, hy + 3 + (frame % 2), 2, 4, H);
      }
  }
  if (L.beard) {
    g.rect(8, hy + 6, 4, 1, L.beard);
    g.rect(7, hy + 7, 4, 1, L.beard);
    g.rect(7, hy + 4, 1, 3, L.beard);
    g.rect(8, hy + 8, 2, 1, L.beard);
  }
  if (L.glasses) {
    g.rect(8, hy + 3, 1, 1, L.glasses);
    g.row(hy + 4, [8, 10], L.glasses);
    g.row(hy + 3, [9, 10], L.glasses);
  }
  if (L.scarf) {
    g.rect(7, hy + 6, 6, 2, L.scarf);
    g.rect(7, hy + 7, 6, 1, shade(L.scarf, -0.2));
    g.rect(3, hy + 7 + (frame % 2), 3, 1, L.scarf);
    g.rect(2, hy + 8 + (frame % 2), 2, 1, shade(L.scarf, -0.15));
  }
  const hat = L.hat;
  if (!hat) return;
  const c = hat.color;
  const t = hat.trim ?? shade(c, 0.4);
  switch (hat.kind) {
    case 'headband':
      g.rect(4, hy + 2, 8, 1, c);
      g.set(3, hy + 2, c);
      g.rect(1, hy + 3 - (frame % 2), 2, 1, c);
      g.set(2, hy + 4 - (frame % 2), shade(c, -0.25));
      break;
    case 'cap':
      g.rect(5, hy - 2, 6, 1, c);
      g.rect(4, hy - 1, 8, 3, c);
      g.rect(9, hy + 2, 5, 1, shade(c, -0.25));
      g.row(hy - 1, [7, 8], shade(c, 0.3));
      break;
    case 'wizard':
      g.rect(4, hy - 7, 2, 1, c);
      g.rect(5, hy - 6, 2, 2, c);
      g.rect(5, hy - 4, 4, 2, c);
      g.rect(5, hy - 2, 6, 2, c);
      g.rect(4, hy, 8, 1, c);
      g.rect(4, hy + 1, 8, 1, t);
      g.rect(2, hy + 2, 12, 1, shade(c, -0.2));
      g.set(8, hy - 2, t);
      g.rect(4, hy + 3, 2, 2, L.hair);
      break;
    case 'hood':
      g.rect(5, hy - 1, 6, 1, c);
      g.rect(4, hy, 8, 3, c);
      g.rect(3, hy + 1, 5, 8, c);
      g.rect(8, hy + 7, 3, 1, c);
      g.rect(4, hy + 2, 8, 1, t);
      g.set(11, hy + 3, L.hair);
      g.rect(5, hy + 3, 1, 5, shade(c, -0.25));
      break;
  }
}

/* ---------- 组装 ---------- */

function build(look: Look, dir: Dir, frame: number): Img {
  const g = new Grid();
  const f = frameOf(look, frame);
  if (dir === 'side') {
    legsSide(g, f);
    torsoSide(g, f);
    headSide(g, f);
  } else if (dir === 'up') {
    legsFront(g, f);
    torsoFront(g, f, true);
    headBack(g, f);
  } else {
    legsFront(g, f);
    torsoFront(g, f, false);
    headFront(g, f);
  }
  g.outline();
  return g.toImg();
}

/** 从正面第一帧截一张 16×16 的头像 */
function portraitOf(img: Img, look: Look): Img {
  const top = frameOf(look, 0).hy - 3;
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  c.getContext('2d')!.drawImage(img, 0, top, 16, 16, 0, 0, 16, 16);
  return c;
}

export function makeCharacter(look: Look): CharSet {
  const frames = (dir: Dir) => [0, 1, 2, 3].map((i) => build(look, dir, i));
  const down = frames('down');
  return { down, up: frames('up'), side: frames('side'), portrait: portraitOf(down[0], look) };
}

/** 把一张 16×16 的小图（比如猫头鹰）放进角色画布，跳着走 */
export function makeCritter(img: Img): CharSet {
  const at = (dy: number) => {
    const c = document.createElement('canvas');
    c.width = CHAR_W;
    c.height = CHAR_H;
    c.getContext('2d')!.drawImage(img, 0, CHAR_FOOT - 15 - dy);
    return c;
  };
  const still = at(0);
  const hop = at(1);
  const set = [still, hop, still, hop];
  return { down: set, up: set, side: set, portrait: img };
}

/** 走路时的帧序号：按走过的距离推进，停下来回到站立帧 */
export function walkFrame(moving: boolean, walk: number): number {
  return moving ? Math.floor(walk) % 4 : 0;
}

export function frameFor(set: CharSet, fx: number, fy: number, frame: number): { img: Img; flip: boolean } {
  if (fx) return { img: set.side[frame], flip: fx < 0 };
  return { img: (fy < 0 ? set.up : set.down)[frame], flip: false };
}
