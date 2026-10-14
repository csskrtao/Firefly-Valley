import { CLASSES } from '../../data/classes';
import { ARMOR_TIERS, MAX_PLUS, WEAPON_TIERS } from '../../data/equipment';
import type { ItemId, ItemKind } from '../../data/items';
import { ITEMS, ITEM_IDS } from '../../data/items';
import { MONSTERS } from '../../data/monsters';
import type { MonsterId } from '../../data/monsters';
import { NPCS, NPC_IDS } from '../../data/npcs';
import { QUESTS } from '../../data/quests';
import { itemIcon } from '../../gfx/tiles';
import { count } from '../../state/save';
import { hearts, MAX_HEARTS } from '../../systems/friendship';
import * as quests from '../../systems/quests';
import { armorName, attack, critChance, defense, maxHp, weaponName } from '../../systems/stats';
import { renderHelp, renderSettings } from '../../ui/common';
import { h } from '../../ui/dom';
import type { PanelTab } from '../../ui/UI';
import { itemCell } from '../../ui/UI';
import type { PlayScene } from '../PlayScene';
import { consume } from './actions';

const KIND_ORDER: ItemKind[] = ['consumable', 'crop', 'seed', 'ore', 'material', 'key'];
const KIND_NAME: Record<ItemKind, string> = { consumable: '药品', crop: '作物', seed: '种子', ore: '矿石', material: '怪物素材', key: '重要物品' };

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
          const usable = ('heal' in d && d.heal) || ('energy' in d && d.energy);
          const describe = () => {
            const sell = 'sell' in d && d.sell ? ` · 售价 ${d.sell} 金` : '';
            detail.textContent = `${d.name}：${d.desc}${sell}${usable ? ' · 按确认键使用' : ''}`;
          };
          cell.addEventListener('focus', describe);
          cell.addEventListener('pointerenter', describe);
          cell.addEventListener('click', () => {
            describe();
            if (usable && consume(sc, id as ItemId)) sc.ui.panel.refresh();
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
      body.append(
        h('div', { class: 'cards' },
          h('section', { class: 'card' },
            h('h3', { text: '武器' }),
            h('p', { class: 'big', text: `${weaponName(s)} +${s.weapon.plus}` }),
            row('阶级', `${s.weapon.tier + 1} / ${WEAPON_TIERS.length}`),
            row('基础攻击', String(wt.atk)),
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
            h('h3', { text: `职业 · ${C.name}` }),
            row('攻击力', String(attack(s))),
            row('防御力', String(defense(s))),
            row('生命上限', String(maxHp(s))),
            row('暴击率', `${Math.round(critChance(s) * 100)}%`),
            row('技能', `${C.skill.name}（冷却 ${C.skill.cooldown}s，体力 ${C.skill.cost}）`),
          ),
        ),
        h('p', { class: 'muted', text: C.desc }),
        h('p', { class: 'muted', text: '去铁匠铺找老岩锻造更高阶的装备，或者用矿石强化。' }),
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
