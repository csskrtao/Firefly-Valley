import { CLASSES } from '../../data/classes';
import type { EquipSlot, Gear } from '../../data/gear';
import { EQUIP_SLOTS, EQUIP_SLOT_NAME, gearName } from '../../data/gear';
import type { ItemDef, ItemId, ItemKind } from '../../data/items';
import { BUFF_TEXT, ITEMS } from '../../data/items';
import { SKILLS } from '../../data/skills';
import { typesOf, weaponType } from '../../data/weapons';
import { MAX_LEVEL, xpToNext } from '../../systems/level';
import { MONSTERS } from '../../data/monsters';
import type { MonsterId } from '../../data/monsters';
import { NPCS, NPC_IDS } from '../../data/npcs';
import { QUESTS } from '../../data/quests';
import { iconUrl, itemIcon } from '../../gfx/tiles';
import { bagGear, bagUsed, count, removeItem } from '../../state/save';
import { encodeSave } from '../../state/saveCode';
import {
  bagCells, canWear, equip, equipped, equippedSlot, expandBag, expandCost, gearById, gearLabel, inStash, salvage, salvageUpTo, salvageValue, sortBag, unequip,
} from '../../systems/gear';
import { hearts, MAX_HEARTS } from '../../systems/friendship';
import * as quests from '../../systems/quests';
import { attack, critChance, defense, maxHp, weaponTypeOf } from '../../systems/stats';
import { renderHelp, renderSaveCode, renderSettings } from '../../ui/common';
import { h } from '../../ui/dom';
import type { PanelTab } from '../../ui/UI';
import type { PlayScene } from '../PlayScene';
import { consume } from './actions';
import { bookTab } from './explore';
import { actBtn, actionRow, compareInfo, emptyCell, gearCell, gearInfo, itemSlotCell, targetSlot } from './gearui';

/** 背包和装备页里当前点中的东西，刷新面板时保留 */
type Pick = { gear: number } | { item: ItemId } | { slot: EquipSlot } | null;
let picked: Pick = null;
/** 等待第二次确认的危险操作（分解强化过的装备、丢东西） */
let confirming = '';

const pick = (sc: PlayScene, p: Pick) => {
  picked = p;
  confirming = '';
  sc.sfx('blip');
  sc.ui.panel.refresh();
};

/** 需要再点一次才执行的按钮 */
function confirmBtn(sc: PlayScene, key: string, label: string, fn: () => void, need: boolean): HTMLButtonElement {
  const waiting = confirming === key;
  return actBtn(waiting ? `确定${label}？` : label, () => {
    if (need && !waiting) {
      confirming = key;
      sc.ui.panel.refresh();
      return;
    }
    confirming = '';
    fn();
  }, { danger: waiting });
}

function wear(sc: PlayScene, g: Gear): void {
  const s = sc.s;
  if (!equip(s, g.id)) return;
  s.hp = Math.min(s.hp, maxHp(s));
  if (g.slot === 'weapon') sc.player.atkCd = 0.2;
  sc.sfx('equip');
  sc.toast(`穿上了【${gearLabel(g)}】`);
  sc.ui.panel.refresh();
}

function takeOff(sc: PlayScene, slot: EquipSlot): void {
  const s = sc.s;
  const r = unequip(s, slot);
  if (r === 'full') sc.toast('背包满了，卸不下来');
  else if (r === 'weapon') sc.toast('武器不能空着，换一把别的就行');
  if (r !== 'ok') return;
  s.hp = Math.min(s.hp, maxHp(s));
  sc.sfx('blip');
  sc.ui.panel.refresh();
}

/** 点中一件装备时右边（手机上是下面）的详情和操作 */
function gearDetail(sc: PlayScene, g: Gear): HTMLElement {
  const s = sc.s;
  const on = equippedSlot(s, g.id);
  const wearable = canWear(s, g);
  const salvageNeedsConfirm = g.plus > 0 || g.q >= 2;
  return h('div', { class: 'bag-detail' },
    gearInfo(g),
    compareInfo(s, g),
    !wearable ? h('p', { class: 'muted', text: '这种武器还没有图纸，暂时用不了。可以分解，或者先放进仓库箱。' }) : null,
    actionRow(
      on ? actBtn('卸下', () => takeOff(sc, on), { disabled: on === 'weapon', note: on === 'weapon' ? '换一把别的武器' : undefined })
        : actBtn('穿上', () => wear(sc, g), { disabled: !wearable }),
      on ? null : confirmBtn(sc, `salvage:${g.id}`, `分解（萤尘×${salvageValue(g)}）`, () => {
        const n = salvage(s, g.id);
        picked = null;
        sc.sfx('forge');
        sc.toast(`分解了【${gearLabel(g)}】，得到萤尘×${n}`);
        sc.ui.panel.refresh();
      }, salvageNeedsConfirm),
    ),
  );
}

function itemDetail(sc: PlayScene, id: ItemId): HTMLElement {
  const s = sc.s;
  const def = ITEMS[id] as ItemDef;
  const usable = !!(def.heal || def.energy || def.buff);
  const sell = def.sell ? ` · 售价 ${def.sell} 金` : '';
  const eff = def.buff ? ` · ${BUFF_TEXT[def.buff.stat](def.buff.value)}` : '';
  const n = count(s, id);
  return h('div', { class: 'bag-detail' },
    h('div', { class: 'gear-head' },
      h('img', { src: iconUrl(itemIcon(id)), alt: '' }),
      h('div', {}, h('b', { text: def.name }), h('small', { text: `${KIND_NAME[def.kind]} · ${n} 个` })),
    ),
    h('p', { text: `${def.desc}${eff}${sell}` }),
    actionRow(
      usable ? actBtn('使用', () => {
        if (consume(sc, id) && !count(s, id)) picked = null;
        sc.ui.panel.refresh();
      }) : null,
      def.kind !== 'key' ? confirmBtn(sc, `drop:${id}`, n > 1 ? `丢掉全部 ${n} 个` : '丢掉', () => {
        removeItem(s, id, n);
        picked = null;
        sc.sfx('blip');
        sc.ui.panel.refresh();
      }, true) : null,
    ),
  );
}

const KIND_NAME: Record<ItemKind, string> = {
  consumable: '药品', dish: '料理', crop: '作物', forage: '采集物', seed: '种子', accessory: '饰品', ore: '矿石', material: '怪物素材', key: '重要物品',
};

function bagTab(sc: PlayScene): PanelTab {
  return {
    id: 'bag',
    label: '背包',
    render: (body) => {
      const s = sc.s;
      const used = bagUsed(s);
      const grid = h('div', { class: 'gslots' });
      for (const c of bagCells(s)) {
        const on = c.kind === 'gear' ? !!picked && 'gear' in picked && picked.gear === c.g.id : !!picked && 'item' in picked && picked.item === c.id;
        const cell = c.kind === 'gear' ? gearCell(c.g, { on }) : itemSlotCell(c.id, c.n, { on });
        cell.addEventListener('click', () => pick(sc, c.kind === 'gear' ? { gear: c.g.id } : { item: c.id }));
        grid.append(cell);
      }
      for (let i = used; i < s.bagSize; i++) grid.append(emptyCell());

      let detail: HTMLElement = h('p', { class: 'muted', text: '点一下物品看说明。装备会和身上的那件比较，升了标绿，降了标红。' });
      if (picked && 'gear' in picked) {
        const g = gearById(s, picked.gear);
        if (g && !inStash(s, g.id) && !equippedSlot(s, g.id)) detail = gearDetail(sc, g);
      } else if (picked && 'item' in picked && count(s, picked.item) > 0) detail = itemDetail(sc, picked.item);

      const cost = expandCost(s);
      const head = h('div', { class: 'bag-head' },
        h('b', { class: used > s.bagSize ? 'over' : '', text: `${used} / ${s.bagSize} 格` }),
        actBtn('整理', () => {
          sortBag(s);
          sc.sfx('blip');
          sc.ui.panel.refresh();
        }),
        actBtn('分解普通和优秀', () => {
          const r = salvageUpTo(s, 1);
          picked = null;
          sc.sfx(r.count ? 'forge' : 'blip');
          sc.toast(r.count ? `分解了 ${r.count} 件装备，得到萤尘×${r.essence}` : '没有可以分解的（强化过的不会动）');
          sc.ui.panel.refresh();
        }, { note: '强化过的不会动' }),
        cost !== null ? actBtn(`扩容 +6 格`, () => {
          if (expandBag(s)) {
            sc.sfx('coin');
            sc.toast(`背包扩到了 ${s.bagSize} 格`);
          }
          sc.ui.panel.refresh();
        }, { disabled: s.gold < cost, note: `${cost} 金` }) : null,
      );
      body.append(head, h('div', { class: 'bag' }, grid, h('div', { class: 'bag-side' }, detail)));
      if (used > s.bagSize) body.append(h('p', { class: 'muted', text: '背包超出容量了：新拿到的东西会被送回家里的仓库箱。' }));
      else if (s.stash.gear.length || Object.keys(s.stash.items).length) body.append(h('p', { class: 'muted', text: '背包满了的时候，新东西会送回家里的仓库箱。' }));
    },
  };
}

function gearTab(sc: PlayScene): PanelTab {
  return {
    id: 'gear',
    label: '装备',
    render: (body) => {
      const s = sc.s;
      const C = CLASSES[s.cls];
      const row = (k: string, v: string) => h('div', { class: 'row' }, h('span', { text: k }), h('b', { text: v }));

      // 6 个装备格
      const slots = h('div', { class: 'equip-slots' });
      for (const slot of EQUIP_SLOTS) {
        const g = equipped(s, slot);
        const on = !!picked && 'slot' in picked && picked.slot === slot;
        const cell = g ? gearCell(g, { on, tag: EQUIP_SLOT_NAME[slot] }) : h('button', { type: 'button', class: `slot-cell empty${on ? ' on' : ''}`, 'data-nav': '' }, h('i', { text: EQUIP_SLOT_NAME[slot] }));
        cell.addEventListener('click', () => pick(sc, { slot }));
        slots.append(h('div', { class: 'equip-slot' }, cell, h('small', { text: g ? gearName(g) : '空' })));
      }

      // 点中一个装备格：看身上那件，下面列出背包里能换上的
      let side: HTMLElement = h('p', { class: 'muted', text: '点一个装备格，看身上的装备和背包里能换上的。' });
      let pickedGear: Gear | undefined;
      if (picked && 'gear' in picked) pickedGear = gearById(s, picked.gear);
      const slot = picked && 'slot' in picked ? picked.slot : pickedGear ? (equippedSlot(s, pickedGear.id) ?? targetSlot(s, pickedGear)) : null;
      if (slot) {
        const cur = equipped(s, slot);
        const kind = slot === 'acc1' || slot === 'acc2' ? 'acc' : slot;
        const options = bagGear(s).filter((g) => g.slot === kind && canWear(s, g));
        const list = h('div', { class: 'gslots' });
        for (const g of options) {
          const c = gearCell(g, { on: pickedGear?.id === g.id });
          c.addEventListener('click', () => pick(sc, { gear: g.id }));
          list.append(c);
        }
        side = h('div', {},
          pickedGear && !equippedSlot(s, pickedGear.id) ? gearDetail(sc, pickedGear) : cur ? gearDetail(sc, cur) : h('p', { class: 'muted', text: `${EQUIP_SLOT_NAME[slot]}格空着。` }),
          h('h3', { text: options.length ? `背包里可以换上的${EQUIP_SLOT_NAME[slot]}` : `背包里没有可以换上的${EQUIP_SLOT_NAME[slot]}` }),
          options.length ? list : null,
        );
      }

      const skills = h('dl', { class: 'keys skills-list' });
      SKILLS[s.cls].forEach((k, i) => {
        skills.append(
          h('dt', { text: `${['L', 'U', 'O'][i]} · ${k.name}` }),
          h('dd', { text: s.level >= k.level ? `${k.desc}（冷却 ${k.cooldown}s，体力 ${k.cost}）` : `${k.level} 级解锁：${k.desc}` }),
        );
      });
      const types = typesOf(s.cls).map((t) => {
        const d = weaponType(t);
        return `${d.name}${s.weaponTypes.includes(t) ? '' : '（没有图纸）'}`;
      }).join('、');
      const wt = weaponTypeOf(s);

      body.append(
        h('div', { class: 'bag' },
          h('div', {},
            slots,
            h('section', { class: 'card' },
              h('h3', { text: `${C.name} · Lv.${s.level}` }),
              row('经验', s.level >= MAX_LEVEL ? '已满级' : `${s.xp} / ${xpToNext(s.level)}`),
              row('攻击力', String(attack(s))),
              row('防御力', String(defense(s))),
              row('生命上限', String(maxHp(s))),
              row('暴击率', `${Math.round(critChance(s) * 100)}%`),
              row('武器', `${wt.name} · 攻击间隔 ${wt.cooldown}s`),
            ),
          ),
          h('div', { class: 'bag-side' }, side),
        ),
        h('p', { class: 'muted', text: `武器类型：${types}。换武器就是换一把别的类型的武器；新的图纸在老岩那里买，或者在宝箱里找到。` }),
        h('h3', { text: '技能' }),
        skills,
        h('p', { class: 'muted', text: '去铁匠铺找老岩强化装备、提升品质、升阶。' }),
      );
    },
  };
}

function peopleTab(sc: PlayScene): PanelTab {
  return {
    id: 'people',
    label: '人物',
    render: (body) => {
      const s = sc.s;
      const list = h('div', { class: 'people' });
      for (const id of NPC_IDS) {
        const d = NPCS[id];
        const hs = hearts(s, id);
        const st = s.npcs[id];
        const heartsEl = h('span', { class: 'hearts', 'aria-label': `${hs} 心` });
        for (let i = 0; i < MAX_HEARTS; i++) heartsEl.append(h('i', { class: i < hs ? 'on' : '' }));
        const face = h('canvas', { width: '16', height: '16', class: 'face' });
        face.getContext('2d')!.drawImage(sc.npcFace(id), 0, 0);
        const perks = d.perks.map((p) => `${p.hearts}♥ ${p.text}`).join(' · ');
        list.append(h('div', { class: 'person', 'data-nav': '', tabindex: '0' },
          face,
          h('div', {},
            h('b', { text: `${d.name}` }), h('small', { text: ` ${d.title}` }),
            heartsEl,
            h('small', { class: 'muted', text: `${st.talkDay === s.day ? '今天聊过了' : '今天还没聊天'} · ${st.giftDay === s.day ? '今天送过礼' : '今天可以送礼'}` }),
            h('small', { class: 'muted', text: perks }),
          ),
        ));
      }
      body.append(list);
    },
  };
}

function questTab(sc: PlayScene): PanelTab {
  return {
    id: 'quest',
    label: '委托',
    render: (body) => {
      const s = sc.s;
      const q = quests.currentQuest(s);
      if (!q) body.append(h('p', { class: 'big', text: '所有委托都已完成！' }));
      else {
        const pr = quests.progressOf(s);
        body.append(
          h('section', { class: 'card' },
            h('h3', { text: s.quest.active ? '进行中' : '可以去公会找艾恩接取' }),
            h('p', { class: 'big', text: q.title }),
            h('p', { text: q.desc }),
            s.quest.active ? h('p', { text: `进度：${pr.have} / ${pr.need}${quests.isComplete(s) ? '（可以交付了）' : ''}` }) : null,
            h('p', { class: 'muted', text: `报酬：${q.reward.gold} 金${Object.entries(q.reward.items ?? {}).map(([k, n]) => `、${ITEMS[k as ItemId].name}×${n}`).join('')}` }),
          ),
        );
      }
      body.append(h('p', { class: 'muted', text: `已完成委托 ${s.quest.index} / ${QUESTS.length}` }));
      const kills = Object.entries(s.kills) as [MonsterId, number][];
      if (kills.length) {
        body.append(h('h3', { text: '讨伐记录' }));
        const dl = h('dl', { class: 'keys' });
        for (const [id, n] of kills) dl.append(h('dt', { text: MONSTERS[id].name }), h('dd', { text: `${n} 只` }));
        body.append(dl);
      }
      if (s.bosses.length) body.append(h('p', { class: 'muted', text: `已击败守层者：${s.bosses.length}` }));
    },
  };
}

export function openInventory(sc: PlayScene, tab = 'bag'): void {
  sc.sfx('select');
  picked = null;
  confirming = '';
  sc.ui.panel.show('背包', [bagTab(sc), gearTab(sc), peopleTab(sc), questTab(sc), bookTab(sc)], { tab });
}

export function openPause(sc: PlayScene): void {
  sc.sfx('select');
  sc.ui.panel.show('暂停', [{
    id: 'pause',
    label: '暂停',
    render: (body) => {
      const btn = (label: string, fn: () => void, note?: string) => {
        const b = h('button', { type: 'button', class: 'menu-btn', 'data-nav': '' }, h('span', { text: label }), note ? h('small', { text: note }) : null);
        b.addEventListener('click', fn);
        return b;
      };
      body.append(h('div', { class: 'menu' },
        btn('继续游戏', () => sc.ui.panel.close()),
        btn('背包 / 装备', () => {
          sc.ui.panel.close();
          openInventory(sc);
        }),
        btn('存档', () => {
          const ok = sc.saveGame();
          sc.toast(ok ? '已存档。读档后会从家门口出发。' : '存档失败：浏览器不允许保存数据');
        }, '睡觉时也会自动存档'),
        btn('存档码', () => {
          sc.saveGame();
          sc.ui.panel.show('存档码', [{ id: 'code', label: '存档码', render: (b2) => renderSaveCode(b2, encodeSave(sc.s)) }], { onClose: () => openPause(sc) });
        }, '换设备、换浏览器或者备份时用'),
        btn('设置', () => sc.ui.panel.show('设置', [{ id: 'settings', label: '设置', render: (b2) => renderSettings(b2, () => sc.applySettings()) }], { onClose: () => openPause(sc) })),
        btn('操作说明', () => sc.ui.panel.show('操作说明', [{ id: 'help', label: '操作', render: renderHelp }], { onClose: () => openPause(sc) })),
        btn('回到标题画面', () => {
          sc.ui.panel.close();
          sc.ui.dialog.say('回到标题', '没有存档的进度会丢失。要先存档吗？', {
            choices: [
              { label: '存档并回到标题', onSelect: () => { sc.saveGame(); sc.quit(); } },
              { label: '不存档，直接回去', onSelect: () => sc.quit() },
              { label: '取消' },
            ],
          });
        }),
      ));
    },
  }]);
}
