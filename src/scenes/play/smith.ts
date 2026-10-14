import { MAX_PLUS } from '../../data/equipment';
import type { Gear } from '../../data/gear';
import { ESSENCE, MAX_QUALITY, QUALITIES, TIER_ORE, gearEnhanceCost, gearName, qualityUpgradeCost } from '../../data/gear';
import type { ItemId } from '../../data/items';
import { ITEMS } from '../../data/items';
import { bagGear, count } from '../../state/save';
import { canAfford, costText, successRate } from '../../systems/forge';
import * as fr from '../../systems/friendship';
import { allEquipped, enhanceGear, equippedSlot, gearById, gearLabel, tierUp, tierUpCost, tierUpNeed, upgradeQuality } from '../../systems/gear';
import { maxHp } from '../../systems/stats';
import { h } from '../../ui/dom';
import type { PlayScene } from '../PlayScene';
import { actBtn, actionRow, gearCell, gearInfo } from './gearui';

const itemName = (id: ItemId) => ITEMS[id].name;

let picked = 0;
let said = '';

/** 老岩的工作台：选一件装备（身上的或背包里的），强化、提升品质或者升阶 */
export function smithPanel(sc: PlayScene): void {
  picked = sc.s.equip.weapon;
  said = '挑一件，我看看能怎么弄。';
  sc.sfx('select');
  sc.ui.panel.show('铁匠铺', [{ id: 'smith', label: '打理装备', render: (body) => renderSmith(sc, body) }]);
}

function renderSmith(sc: PlayScene, body: HTMLElement): void {
  const s = sc.s;
  const worn = allEquipped(s);
  const list = [...worn, ...bagGear(s)];
  const grid = h('div', { class: 'gslots' });
  for (const g of list) {
    const slot = equippedSlot(s, g.id);
    const c = gearCell(g, { on: g.id === picked, tag: slot ? '身上' : undefined });
    c.addEventListener('click', () => {
      picked = g.id;
      said = '';
      sc.sfx('blip');
      sc.ui.panel.refresh();
    });
    grid.append(c);
  }
  const g = gearById(s, picked);
  const mats = [ESSENCE, ...new Set(TIER_ORE)].map((id) => `${itemName(id)} ${count(s, id)}`).join(' · ');
  body.append(
    h('p', { class: 'smith-say', text: `老岩：${said || '嗯。'}` }),
    h('div', { class: 'bag' },
      h('div', {}, grid, h('p', { class: 'muted', text: `手上的材料：${mats}。萤尘靠分解不要的装备得到。` })),
      h('div', { class: 'bag-side' }, g && list.includes(g) ? smithDetail(sc, g) : h('p', { class: 'muted', text: '先选一件装备。' })),
    ),
  );
}

function smithDetail(sc: PlayScene, g: Gear): HTMLElement {
  const s = sc.s;
  const enhanceBonus = fr.hasPerk(s, 'smith', 4) ? 0.1 : 0;
  const discount = fr.hasPerk(s, 'smith', 6) ? 0.2 : 0;
  const say = (text: string) => {
    said = text;
    s.hp = Math.min(s.hp, maxHp(s));
    sc.autosave();
    sc.ui.panel.refresh();
  };

  // 强化
  let enhance: HTMLButtonElement;
  if (g.plus >= MAX_PLUS) enhance = actBtn(`强化已满 +${MAX_PLUS}`, () => {}, { disabled: true });
  else {
    const cost = gearEnhanceCost(g);
    const rate = Math.round(successRate(g.plus, enhanceBonus) * 100);
    enhance = actBtn(`强化 +${g.plus} → +${g.plus + 1}（${rate}%）`, () => {
      const r = enhanceGear(s, g.id, enhanceBonus);
      if (r === 'success') {
        sc.sfx('forge');
        say(`成了！${gearName(g)} +${g.plus}。${g.plus === 5 || g.plus === 10 ? '看见那层光了吗？' : ''}`);
      } else if (r === 'fail') {
        sc.sfx('fail');
        say('叮……裂了道纹，失败了。材料没了，等级没掉。再来？');
      } else sc.toast('材料不够');
    }, { disabled: !canAfford(s, cost), note: costText(cost, itemName) });
  }

  // 提升品质
  const qCost = qualityUpgradeCost(g);
  const upgrade = qCost
    ? actBtn(`提升品质：${QUALITIES[g.q].name} → ${QUALITIES[g.q + 1].name}`, () => {
      if (upgradeQuality(s, g.id) !== 'ok') return sc.toast('材料不够');
      sc.sfx('forge');
      sc.shake(0.2);
      say(`重新淬了一遍火……成了，现在是${QUALITIES[g.q].name}品质，还多了一条词条。${g.q === MAX_QUALITY ? '这可是传说级的东西了。' : ''}`);
    }, { disabled: !canAfford(s, qCost), note: costText(qCost, itemName) })
    : actBtn('品质已经是传说', () => {}, { disabled: true });

  // 升阶
  const tCost = tierUpCost(g);
  const need = tierUpNeed(s, g);
  let tier: HTMLButtonElement | null = null;
  if (g.slot !== 'acc') {
    if (!tCost) tier = actBtn('已经是最高阶', () => {}, { disabled: true });
    else {
      const next = gearName({ ...g, tier: g.tier + 1 });
      tier = actBtn(`升阶：${gearName(g)} → ${next}`, () => {
        const r = tierUp(s, g.id, discount);
        if (r === 'ok') {
          sc.sfx('forge');
          sc.shake(0.2);
          say(`叮！叮！……拿好你的【${gearLabel(g)}】。品质、强化和词条都给你留着。`);
        } else if (r === 'need') say(`升成${next}得用${itemName(need!)}，那是矿脉深处守层者身上的东西。`);
        else sc.toast('材料不够');
      }, {
        disabled: !!need || !canAfford(s, tCost, discount),
        note: need ? `要先有${itemName(need)}（打败守层者）` : costText(tCost, itemName, discount),
      });
    }
  }

  return h('div', { class: 'bag-detail' }, gearInfo(g), actionRow(enhance, upgrade, tier));
}
