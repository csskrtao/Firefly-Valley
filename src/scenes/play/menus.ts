import { CLASSES } from '../../data/classes';
import { ARMOR_TIERS, MAX_PLUS, WEAPON_TIERS } from '../../data/equipment';
import type { AccStat, ItemDef, ItemId, ItemKind } from '../../data/items';
import { BUFF_TEXT, ITEMS, ITEM_IDS } from '../../data/items';
import { SKILLS } from '../../data/skills';
import { WEAPON_TYPES, typesOf, weaponType } from '../../data/weapons';
import { MAX_LEVEL, xpToNext } from '../../systems/level';
import { MONSTERS } from '../../data/monsters';
import type { MonsterId } from '../../data/monsters';
import { NPCS, NPC_IDS } from '../../data/npcs';
import { QUESTS } from '../../data/quests';
import { iconUrl, itemIcon } from '../../gfx/tiles';
import { addItem, count, removeItem } from '../../state/save';
import { hearts, MAX_HEARTS } from '../../systems/friendship';
import * as quests from '../../systems/quests';
import { armorName, attack, critChance, defense, maxHp, weaponName } from '../../systems/stats';
import { renderHelp, renderSettings } from '../../ui/common';
import { h } from '../../ui/dom';
import type { PanelTab } from '../../ui/UI';
import { itemCell } from '../../ui/UI';
import type { PlayScene } from '../PlayScene';
import { consume } from './actions';

const KIND_ORDER: ItemKind[] = ['consumable', 'dish', 'crop', 'forage', 'seed', 'accessory', 'ore', 'material', 'build', 'key'];
const KIND_NAME: Record<ItemKind, string> = {
  consumable: '药品', dish: '料理', crop: '作物', forage: '采集物', seed: '种子', accessory: '饰品', ore: '矿石', material: '怪物素材', build: '建材', key: '重要物品',
};

function bagTab(sc: PlayScene): PanelTab {
  return {
    id: 'bag',
    label: '背包',
    render: (body) => {
      const s = sc.s;
      const detail = h('p', { class: 'detail', text: '选中物品查看说明。药品和作物可以直接使用。' });
      let any = false;
      for (const kind of KIND_ORDER) {
        const ids = ITEM_IDS.filter((id) => ITEMS[id].kind === kind && count(s, id) > 0);
        if (!ids.length) continue;
        any = true;
        const grid = h('div', { class: 'grid' });
        for (const id of ids) {
          const d = ITEMS[id];
          const cell = itemCell(itemIcon(id), d.name, count(s, id));
          const def = d as ItemDef;
          const usable = !!(def.heal || def.energy || def.buff);
          const isAcc = def.kind === 'accessory';
          const describe = () => {
            const sell = def.sell ? ` · 售价 ${def.sell} 金` : '';
            const eff = def.buff ? ` · ${BUFF_TEXT[def.buff.stat](def.buff.value)}` : def.acc ? ` · ${accText(def)}` : '';
            detail.textContent = `${def.name}：${def.desc}${eff}${sell}${usable ? ' · 按确认键使用' : isAcc ? ' · 按确认键戴上' : ''}`;
          };
          cell.addEventListener('focus', describe);
          cell.addEventListener('pointerenter', describe);
          cell.addEventListener('click', () => {
            describe();
            if (usable && consume(sc, id as ItemId)) sc.ui.panel.refresh();
            else if (isAcc) equipAccessory(sc, id as ItemId);
          });
          grid.append(cell);
        }
        body.append(h('h3', { text: KIND_NAME[kind] }), grid);
      }
      if (!any) body.append(h('p', { class: 'empty', text: '背包是空的。' }));
      body.append(detail);
    },
  };
}

const ACC_TEXT: Record<AccStat, (v: number) => string> = {
  hp: (v) => `生命 +${v}`,
  def: (v) => `防御 +${v}`,
  atk: (v) => `攻击 +${Math.round(v * 100)}%`,
  speed: (v) => `移速 +${Math.round(v * 100)}%`,
  crit: (v) => `暴击 +${Math.round(v * 100)}%`,
  lifesteal: (v) => `吸血 ${Math.round(v * 100)}%`,
  luck: () => '运气更好',
  xp: (v) => `经验 +${Math.round(v * 100)}%`,
  regen: (v) => `每秒回复 ${v} 生命`,
  light: (v) => `视野 +${Math.round(v * 100)}%`,
};

export const accText = (d: ItemDef): string =>
  (Object.entries(d.acc ?? {}) as [AccStat, number][]).map(([k, v]) => ACC_TEXT[k](v)).join('，');

/** 戴上饰品：满两件时替换掉先戴的那件 */
function equipAccessory(sc: PlayScene, id: ItemId): void {
  const s = sc.s;
  if (!removeItem(s, id, 1)) return;
  if (s.accessories.length >= 2) {
    const old = s.accessories.shift()!;
    addItem(s, old, 1);
  }
  s.accessories.push(id);
  s.hp = Math.min(s.hp, maxHp(s));
  sc.sfx('equip');
  sc.toast(`戴上了【${ITEMS[id].name}】`);
  sc.ui.panel.refresh();
}

function unequipAccessory(sc: PlayScene, idx: number): void {
  const s = sc.s;
  const [id] = s.accessories.splice(idx, 1);
  if (!id) return;
  addItem(s, id, 1);
  s.hp = Math.min(s.hp, maxHp(s));
  sc.sfx('blip');
  sc.ui.panel.refresh();
}

function gearTab(sc: PlayScene): PanelTab {
  return {
    id: 'gear',
    label: '装备',
    render: (body) => {
      const s = sc.s;
      const C = CLASSES[s.cls];
      const row = (k: string, v: string) => h('div', { class: 'row' }, h('span', { text: k }), h('b', { text: v }));
      const wt = WEAPON_TIERS[s.weapon.tier];
      const at = ARMOR_TIERS[s.armor.tier];
      const type = WEAPON_TYPES[s.weaponType];

      // 武器类型：三选一，阶级和强化共用
      const types = h('div', { class: 'wtypes' });
      for (const t of typesOf(s.cls)) {
        const d = weaponType(t);
        const own = s.weaponTypes.includes(t);
        const bp = d.blueprint;
        const btn = h('button', { type: 'button', class: `wtype${t === s.weaponType ? ' on' : ''}${own ? '' : ' off'}`, 'data-nav': '' },
          h('b', { text: own ? weaponName(s, s.weapon.tier, t) : `${d.name}（未解锁）` }),
          h('small', { text: own ? d.desc : `老岩那里买图纸（最深到过第 ${bp?.floor ?? 1} 层后出现），或者在矿脉宝箱里找到` }),
        );
        btn.addEventListener('click', () => {
          if (!own || t === s.weaponType) return;
          s.weaponType = t;
          sc.player.atkCd = 0.2;
          sc.sfx('equip');
          sc.toast(`换上了【${weaponName(s)}】`);
          sc.ui.panel.refresh();
        });
        types.append(btn);
      }

      // 饰品槽
      const accs = h('div', { class: 'accs' });
      for (let i = 0; i < 2; i++) {
        const id = s.accessories[i];
        if (!id) {
          accs.append(h('div', { class: 'acc empty' }, h('span', { text: '空的饰品栏' }), h('small', { text: '在背包里点饰品就能戴上' })));
          continue;
        }
        const d = ITEMS[id] as ItemDef;
        const btn = h('button', { type: 'button', class: 'acc', 'data-nav': '' },
          h('img', { src: iconUrl(itemIcon(id)), alt: '' }),
          h('span', {}, h('b', { text: d.name }), h('small', { text: accText(d) })),
          h('em', { text: '取下' }),
        );
        btn.addEventListener('click', () => unequipAccessory(sc, i));
        accs.append(btn);
      }
      const spare = ITEM_IDS.filter((id) => ITEMS[id].kind === 'accessory' && count(s, id) > 0);
      const spareRow = h('div', { class: 'grid' });
      for (const id of spare) {
        const cell = itemCell(itemIcon(id), ITEMS[id].name, count(s, id));
        cell.title = `${ITEMS[id].name}：${accText(ITEMS[id] as ItemDef)}`;
        cell.addEventListener('click', () => equipAccessory(sc, id));
        spareRow.append(cell);
      }

      const skills = h('dl', { class: 'keys skills-list' });
      SKILLS[s.cls].forEach((k, i) => {
        skills.append(
          h('dt', { text: `${['L', 'U', 'O'][i]} · ${k.name}` }),
          h('dd', { text: s.level >= k.level ? `${k.desc}（冷却 ${k.cooldown}s，体力 ${k.cost}）` : `${k.level} 级解锁：${k.desc}` }),
        );
      });

      body.append(
        h('div', { class: 'cards' },
          h('section', { class: 'card' },
            h('h3', { text: `武器 · ${type.name}` }),
            h('p', { class: 'big', text: `${weaponName(s)} +${s.weapon.plus}` }),
            row('阶级', `${s.weapon.tier + 1} / ${WEAPON_TIERS.length}`),
            row('基础攻击', `${wt.atk} × ${type.mul}`),
            row('攻击间隔', `${type.cooldown}s`),
            row('强化', `+${s.weapon.plus} / +${MAX_PLUS}`),
          ),
          h('section', { class: 'card' },
            h('h3', { text: '护甲' }),
            h('p', { class: 'big', text: `${armorName(s.armor.tier)} +${s.armor.plus}` }),
            row('阶级', `${s.armor.tier + 1} / ${ARMOR_TIERS.length}`),
            row('基础防御', String(at.def)),
            row('强化', `+${s.armor.plus} / +${MAX_PLUS}`),
          ),
          h('section', { class: 'card' },
            h('h3', { text: `${C.name} · Lv.${s.level}` }),
            row('经验', s.level >= MAX_LEVEL ? '已满级' : `${s.xp} / ${xpToNext(s.level)}`),
            row('攻击力', String(attack(s))),
            row('防御力', String(defense(s))),
            row('生命上限', String(maxHp(s))),
            row('暴击率', `${Math.round(critChance(s) * 100)}%`),
          ),
        ),
        h('h3', { text: '武器类型' }),
        types,
        h('h3', { text: '饰品（最多两件）' }),
        accs,
        ...(spare.length ? [spareRow] : []),
        h('h3', { text: '技能' }),
        skills,
        h('p', { class: 'muted', text: '去铁匠铺找老岩锻造更高阶的装备、强化，或者买新的武器图纸。' }),
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
  sc.ui.panel.show('背包', [bagTab(sc), gearTab(sc), peopleTab(sc), questTab(sc)], { tab });
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
