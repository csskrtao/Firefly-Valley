import type { EquipSlot, Gear } from '../../data/gear';
import { EQUIP_SLOT_NAME, GEAR_SLOT_NAME, QUALITIES, STAT_TEXT, gearName, gearStats, slotsFor } from '../../data/gear';
import type { AccStat, ItemId } from '../../data/items';
import { ITEMS } from '../../data/items';
import { WEAPON_TYPES } from '../../data/weapons';
import { gearIcon } from '../../gfx/gearIcons';
import { iconUrl, itemIcon } from '../../gfx/tiles';
import type { SaveData } from '../../state/save';
import { equipped, equippedSlot, gearLabel } from '../../systems/gear';
import { compareEquip } from '../../systems/stats';
import { h } from '../../ui/dom';
import type { PlayScene } from '../PlayScene';

/* ---------- 格子 ---------- */

/** 装备格子：边框按品质上色，右下角是强化等级 */
export function gearCell(g: Gear, opts: { on?: boolean; tag?: string } = {}): HTMLButtonElement {
  const bt = h('button', {
    type: 'button', class: `slot-cell q${g.q}${opts.on ? ' on' : ''}`, 'data-nav': '',
    title: gearLabel(g), 'aria-label': gearLabel(g),
  },
  h('img', { src: iconUrl(gearIcon(g)), alt: '' }),
  g.plus ? h('b', { text: `+${g.plus}` }) : null,
  opts.tag ? h('i', { text: opts.tag }) : null,
  );
  return bt;
}

/** 物品格子：右下角是数量 */
export function itemSlotCell(id: ItemId, n: number, opts: { on?: boolean } = {}): HTMLButtonElement {
  const d = ITEMS[id];
  return h('button', { type: 'button', class: `slot-cell${opts.on ? ' on' : ''}${d.kind === 'key' ? ' key' : ''}`, 'data-nav': '', title: `${d.name}×${n}`, 'aria-label': `${d.name}×${n}` },
    h('img', { src: iconUrl(itemIcon(id)), alt: '' }),
    n > 1 ? h('b', { text: String(n) }) : null,
  );
}

export const emptyCell = (label = ''): HTMLElement => h('div', { class: 'slot-cell empty', title: label }, label ? h('i', { text: label }) : null);

/* ---------- 详情 ---------- */

const fmt = (v: number) => (Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(1));

/** 一件装备的说明：名字、部位、基础属性和词条 */
export function gearInfo(g: Gear): HTMLElement {
  const q = QUALITIES[g.q];
  const st = gearStats(g);
  const lines: HTMLElement[] = [];
  let kind = GEAR_SLOT_NAME[g.slot];
  if (g.slot === 'weapon') {
    const wt = WEAPON_TYPES[g.wt ?? 'sword'];
    kind = `${wt.name} · ${g.tier + 1} 阶`;
    lines.push(h('li', { text: `基础攻击 ${fmt(st.atk)} × ${wt.mul}` }), h('li', { text: `攻击间隔 ${wt.cooldown}s` }));
    if (g.plus) lines.push(h('li', { text: `暴击 +${g.plus * 2}%` }));
  } else if (g.slot === 'acc') {
    for (const [k, v] of Object.entries(st.mods) as [AccStat, number][]) {
      if (!g.affixes.some((a) => a.k === k)) lines.push(h('li', { text: STAT_TEXT[k](round(v)) }));
    }
  } else {
    kind = `${kind} · ${g.tier + 1} 阶`;
    lines.push(h('li', { text: `防御 +${st.def}` }), h('li', { text: `生命 +${st.hp}` }));
  }
  for (const a of g.affixes) lines.push(h('li', { class: 'affix', text: `◆ ${STAT_TEXT[a.k](round(a.v))}` }));
  const desc = g.slot === 'acc' ? ITEMS[g.acc ?? 'copperRing'].desc : g.slot === 'weapon' ? WEAPON_TYPES[g.wt ?? 'sword'].desc : '';
  return h('div', { class: `gear-info q${g.q}` },
    h('div', { class: 'gear-head' },
      h('img', { src: iconUrl(gearIcon(g)), alt: '' }),
      h('div', {},
        h('b', { text: `${gearName(g)}${g.plus ? ` +${g.plus}` : ''}` }),
        h('small', { text: `${q.name} · ${kind}` }),
      ),
    ),
    h('ul', { class: 'gear-stats' }, ...lines),
    desc ? h('p', { class: 'muted', text: desc }) : null,
  );
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** 和身上同部位的装备比：会穿到哪一格，以及属性怎么变（升了标绿，降了标红） */
export function compareInfo(s: SaveData, g: Gear): HTMLElement | null {
  if (equippedSlot(s, g.id)) return null;
  const slot = targetSlot(s, g);
  const cur = equipped(s, slot);
  const lines = compareEquip(s, g, slot);
  const box = h('div', { class: 'compare' },
    h('small', { text: cur ? `和身上的【${gearLabel(cur)}】比：` : `${EQUIP_SLOT_NAME[slot]}格现在空着，穿上以后：` }),
  );
  if (!lines.length) box.append(h('p', { class: 'muted', text: '属性没有变化' }));
  for (const l of lines) {
    const up = l.next > l.cur;
    box.append(h('div', { class: `cmp ${up ? 'up' : 'down'}` },
      h('span', { text: l.label }),
      h('b', { text: `${l.fmt(l.cur)} → ${l.fmt(l.next)} ${up ? '▲' : '▼'}` }),
    ));
  }
  return box;
}

/** 穿上时会放进哪一格：饰品先找空格，都满了就换第一格 */
export function targetSlot(s: SaveData, g: Gear): EquipSlot {
  const slots = slotsFor(g.slot);
  return slots.find((k) => !s.equip[k]) ?? slots[0];
}

/** 一排操作按钮 */
export function actionRow(...buttons: (HTMLButtonElement | null)[]): HTMLElement {
  return h('div', { class: 'gear-acts' }, ...buttons);
}

export function actBtn(label: string, fn: () => void, opts: { disabled?: boolean; note?: string; danger?: boolean } = {}): HTMLButtonElement {
  const b = h('button', { type: 'button', class: `menu-btn small${opts.disabled ? ' off' : ''}${opts.danger ? ' danger' : ''}`, 'data-nav': '' },
    h('span', { text: label }),
    opts.note ? h('small', { text: opts.note }) : null,
  );
  b.addEventListener('click', () => {
    if (!opts.disabled) fn();
  });
  return b;
}

/* ---------- 掉落提示 ---------- */

/** 拿到装备时飘字；史诗以上（或者 Boss 掉的）再弹个对话框 */
export function announceGear(sc: PlayScene, gears: Gear[], x: number, y: number, dialog = false): void {
  let dy = 0;
  for (const g of gears) {
    sc.fx.text(x, y - dy, `+ ${gearLabel(g)}`, QUALITIES[g.q].color);
    dy += 8;
    if (g.q >= 3 || dialog) {
      sc.ui.dialog.say('系统', `得到了${QUALITIES[g.q].name}装备【${gearName(g)}】！按 I 打开背包，点它就能看属性、穿上。`);
    }
  }
  if (gears.length) sc.sfx('chest');
}
