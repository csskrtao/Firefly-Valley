import { MONSTERS } from '../../data/monsters';
import { canFastTravel, hasVisited, lockReason, regionBossAround, TRAVEL_MINUTES } from '../../systems/regions';
import { h } from '../../ui/dom';
import type { RegionId } from '../../world/regions/defs';
import { REGIONS, REGION_IDS } from '../../world/regions/defs';
import type { PlayScene } from '../PlayScene';
import { nearRegionBoss } from './regions';
import '../../styles/worldmap.css';

const COLS = 3;
const ROWS = 3;
/** 矿脉画在萤石镇正下方 */
const MINE_POS: [number, number] = [1, 2];

const center = ([c, r]: [number, number]): [number, number] => [((c + 0.5) / COLS) * 100, ((r + 0.5) / ROWS) * 100];

/** 现在能不能快速旅行，不能的话说明原因 */
function travelBlock(sc: PlayScene): string | null {
  if (sc.mode === 'mine') return '在矿脉里没法快速旅行，先爬回地面吧';
  if (nearRegionBoss(sc, 160)) return 'Boss 就在旁边，走不开！';
  return null;
}

/** 按 M 打开的世界地图：去过的区域会亮起来，点一下快速旅行过去 */
export function openWorldMap(sc: PlayScene): void {
  sc.sfx('select');
  sc.ui.panel.show('世界地图', [{ id: 'map', label: '地图', render: (body) => renderMap(sc, body) }], {
    hint: '↑↓ 选择 · E 快速旅行 · M / Esc 关闭',
  });
}

function renderMap(sc: PlayScene, body: HTMLElement): void {
  const s = sc.s;
  const here: RegionId | 'mine' = sc.mode === 'mine' ? 'mine' : sc.region;
  const detail = h('p', { class: 'detail wmap-detail' });
  const block = travelBlock(sc);

  // 区域之间的连线：两边都去过才画实线
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('wmap-links');
  const line = (a: [number, number], b: [number, number], cls: string) => {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const [x1, y1] = center(a);
    const [x2, y2] = center(b);
    l.setAttribute('x1', String(x1));
    l.setAttribute('y1', String(y1));
    l.setAttribute('x2', String(x2));
    l.setAttribute('y2', String(y2));
    l.setAttribute('class', cls);
    svg.append(l);
  };
  for (const id of REGION_IDS) {
    for (const to of Object.values(REGIONS[id].links) as RegionId[]) {
      if (id > to) continue;
      line(REGIONS[id].pos, REGIONS[to].pos, hasVisited(s, id) && hasVisited(s, to) ? 'on' : '');
    }
  }
  line(REGIONS.town.pos, MINE_POS, 'under' + (s.deepest > 0 ? ' on' : ''));

  const grid = h('div', { class: 'wmap' });
  grid.append(svg);

  const node = (pos: [number, number], color: string, name: string, state: string, cls: string, describe: () => string, go: (() => void) | null) => {
    const bt = h('button', { type: 'button', class: `wnode ${cls}`, 'data-nav': '', style: `grid-column:${pos[0] + 1};grid-row:${pos[1] + 1};--c:${color}` },
      h('b', { text: name }), h('small', { text: state }));
    const show = () => {
      detail.textContent = describe();
    };
    bt.addEventListener('focus', show);
    bt.addEventListener('pointerenter', show);
    bt.addEventListener('click', () => {
      show();
      if (go) go();
      else sc.sfx('blip');
    });
    return bt;
  };

  for (const id of REGION_IDS) {
    const def = REGIONS[id];
    const lock = lockReason(s, id);
    const seen = hasVisited(s, id);
    const isHere = here === id;
    const state = isHere ? '你在这里' : lock ? '未开放' : seen ? '可以快速旅行' : '还没去过';
    const cls = [isHere ? 'here' : '', seen ? 'seen' : '', lock ? 'locked' : ''].join(' ');
    const describe = () => {
      const parts = [`${def.name}：${def.desc}`];
      const mons = Object.keys(def.monsters).map((m) => MONSTERS[m as keyof typeof MONSTERS].name);
      if (mons.length) parts.push(`出没：${mons.join('、')}`);
      if (def.boss) parts.push(`Boss：${def.boss.name}${s.regionBosses?.[id] === undefined ? '' : regionBossAround(s, id) ? '（已击败过，今天又回来了）' : '（今天已击败）'}`);
      if (lock) parts.push(lock);
      else if (!isHere) {
        const ok = canFastTravel(s, sc.mode === 'mine' ? null : sc.region, id);
        parts.push(block ?? (ok.ok ? `按确认键快速旅行，路上要花 ${TRAVEL_MINUTES} 分钟` : ok.msg));
      }
      return parts.join(' · ');
    };
    const go = () => {
      const ok = canFastTravel(s, sc.mode === 'mine' ? null : sc.region, id);
      if (block || !ok.ok) {
        sc.sfx('blip');
        sc.toast(block ?? ok.msg);
        return;
      }
      sc.ui.panel.close();
      sc.fastTravel(id);
    };
    grid.append(node(def.pos, def.color, def.name, state, cls, describe, isHere ? null : go));
  }

  // 矿脉：地下区域，快速旅行到小镇南边的矿脉入口
  const inMine = here === 'mine';
  grid.append(node(MINE_POS, '#62f0d6', '老矿脉', inMine ? `你在第 ${sc.floor} 层` : s.deepest ? `最深第 ${s.deepest} 层` : '地下', `under${inMine ? ' here' : ''} seen`,
    () => `老矿脉：萤石镇南边悬崖下的地下矿道，越往下越危险。${inMine ? '' : block ?? `按确认键快速旅行到矿脉入口，路上要花 ${TRAVEL_MINUTES} 分钟`}`,
    inMine ? null : () => {
      if (block) {
        sc.sfx('blip');
        sc.toast(block);
        return;
      }
      sc.ui.panel.close();
      sc.fastTravel('town', sc.overworld.spawns.mine);
    }));

  detail.textContent = '去过的区域会亮起来。走到地图边上的路口就能进入相邻区域。';
  body.append(grid, detail);
}
