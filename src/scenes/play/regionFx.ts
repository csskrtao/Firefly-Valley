import { TS, VH, VW } from '../../core/constants';
import { hash } from '../../core/math';
import { nightAlpha } from '../../systems/time';
import { Tile } from '../../world/TileMap';
import type { PlayScene } from '../PlayScene';

/** 野外区域各自的气氛：森林的雾、湿地水面上的星光、遗迹里飘的萤石微光、北山的风 */
export function drawAtmosphere(sc: PlayScene, cx: number, cy: number): void {
  switch (sc.region) {
    case 'mistwood': return drawFog(sc, cx, cy);
    case 'starmarsh': return drawStarlight(sc, cx, cy);
    case 'ruins': return drawMotes(sc, cx, cy);
    case 'northcrag': return drawWind(sc);
  }
}

/** 一团团慢慢飘过去的雾，比镜头移动得慢一点，看起来有远近 */
function drawFog(sc: PlayScene, cx: number, cy: number): void {
  const { b } = sc.game.renderer;
  const t = sc.clock;
  for (let i = 0; i < 14; i++) {
    const span = VW + 240;
    const x = ((hash(i, 3) * span + t * (6 + hash(i, 5) * 8) - cx * 0.6) % span + span) % span - 120;
    const y = ((hash(7, i) * (VH + 120) - cy * 0.6) % (VH + 120) + VH + 120) % (VH + 120) - 60;
    const r = 50 + hash(i, 9) * 50;
    const g = b.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(225,235,240,.3)');
    g.addColorStop(1, 'rgba(225,235,240,0)');
    b.fillStyle = g;
    b.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** 晚上水面上一闪一闪的星光 */
function drawStarlight(sc: PlayScene, cx: number, cy: number): void {
  const a = nightAlpha(sc.s.time);
  if (a < 0.15 || sc.s.weather !== 'sunny') return;
  const { b } = sc.game.renderer;
  const map = sc.map;
  const x0 = Math.max(0, Math.floor(cx / TS));
  const y0 = Math.max(0, Math.floor(cy / TS));
  const x1 = Math.min(map.w - 1, Math.floor((cx + VW) / TS));
  const y1 = Math.min(map.h - 1, Math.floor((cy + VH) / TS));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (map.get(x, y) !== Tile.WATER || hash(x * 11, y * 13) > 0.45) continue;
    const tw = 0.5 + 0.5 * Math.sin(sc.clock * 2.5 + hash(x, y) * 20);
    const px = x * TS - cx + Math.floor(hash(x, y * 3) * 12) + 2;
    const py = y * TS - cy + Math.floor(hash(x * 3, y) * 12) + 2;
    b.fillStyle = `rgba(255,250,210,${a * tw})`;
    b.fillRect(px, py, 1, 1);
    if (tw > 0.8) {
      b.fillRect(px - 1, py, 3, 1);
      b.fillRect(px, py - 1, 1, 3);
    }
  }
}

/** 遗迹里慢慢往上飘的青色微光 */
function drawMotes(sc: PlayScene, cx: number, cy: number): void {
  const { b } = sc.game.renderer;
  const t = sc.clock;
  for (let i = 0; i < 40; i++) {
    const x = ((hash(i, 21) * (VW + 40) - cx * 0.9 + Math.sin(t * 0.8 + i) * 10) % (VW + 40) + VW + 40) % (VW + 40) - 20;
    const y = ((hash(23, i) * (VH + 40) - t * (8 + hash(i, 2) * 10) - cy * 0.9) % (VH + 40) + VH + 40) % (VH + 40) - 20;
    const glow = 0.4 + 0.4 * Math.sin(t * 2 + i);
    b.fillStyle = `rgba(98,240,214,${glow})`;
    b.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}

/** 北山上横着刮过去的风 */
function drawWind(sc: PlayScene): void {
  const { b } = sc.game.renderer;
  const t = sc.clock;
  b.fillStyle = 'rgba(255,255,255,.28)';
  for (let i = 0; i < 12; i++) {
    const len = 10 + hash(i, 4) * 18;
    const x = ((hash(i, 8) * (VW + 60) + t * (140 + hash(i, 6) * 80)) % (VW + 60)) - 30;
    const y = hash(9, i) * VH + Math.sin(t + i) * 4;
    b.fillRect(Math.round(x), Math.round(y), Math.round(len), 1);
  }
}
