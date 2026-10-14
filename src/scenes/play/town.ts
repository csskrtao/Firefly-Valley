import { CROPS } from '../../data/crops';
import { BOSSES } from '../../data/monsters';
import { MAX_FLOOR, ZONES } from '../../data/floors';
import type { ItemId } from '../../data/items';
import { ITEMS, ITEM_IDS } from '../../data/items';
import type { NpcId } from '../../data/npcs';
import { NPCS, OWL_TIPS } from '../../data/npcs';
import { gearName } from '../../data/gear';
import { iconUrl, itemIcon } from '../../gfx/tiles';
import type { ItemDef } from '../../data/items';
import { BUFF_TEXT } from '../../data/items';
import { RECIPES } from '../../data/recipes';
import { typesOf, weaponType } from '../../data/weapons';
import { canCook, cook, kitchenOk } from '../../systems/cooking';
import { HOUSES } from '../../data/buildings';
import { homeChoices, homeGreeting } from './home';
import { addItem, count, seasonOf } from '../../state/save';
import { buy, price, sellAll, sellableValue } from '../../systems/economy';
import * as forge from '../../systems/forge';
import * as fr from '../../systems/friendship';
import * as quests from '../../systems/quests';
import { unlockWeaponType } from '../../systems/gear';
import type { Choice } from '../../ui/UI';
import { itemCell } from '../../ui/UI';
import { h } from '../../ui/dom';
import type { PlayScene } from '../PlayScene';
import { smithPanel } from './smith';
import { stashPanel } from './stash';

const itemName = (id: ItemId) => ITEMS[id].name;

/** 和镇民说话：先结算每日好感和心数剧情，再打开各自的功能菜单 */
export function talkTo(sc: PlayScene, id: NpcId): void {
  const s = sc.s;
  const def = NPCS[id];
  const face = sc.npcFace(id);
  const who = `${def.title}·${def.name}`;
  const firstToday = fr.talk(s, id);
  const ev = fr.pendingHeartEvent(s, id);
  if (ev) {
    sc.sfx('levelup');
    sc.ui.dialog.say(who, ev.text, { face });
    sc.ui.dialog.say('系统', `${def.name} 的好感达到 ${ev.hearts} 心。`);
    grantPerkGifts(sc, id);
  }
  if (firstToday && !ev) sc.fx.text(sc.player.x, sc.player.y - 26, '♥', '#ff8fb3');
  const menus: Record<NpcId, () => void> = {
    smith: () => smithMenu(sc),
    vera: () => shopMenu(sc),
    lia: () => clinicMenu(sc),
    ian: () => guildMenu(sc),
    owl: () => owlTalk(sc),
    kid: () => kidTalk(sc),
  };
  menus[id]();
}

function grantPerkGifts(sc: PlayScene, id: NpcId): void {
  const s = sc.s;
  if (id === 'kid' && fr.hearts(s, 'kid') >= 4 && !s.perks.includes('kid4')) {
    s.perks.push('kid4');
    addItem(s, 'tonic', 3);
    sc.ui.dialog.say('系统', '小橡塞给你 3 瓶体力饮剂。');
  }
  if (id === 'owl' && fr.hearts(s, 'owl') >= 5 && !s.perks.includes('owl5')) {
    s.perks.push('owl5');
    addItem(s, 'owlFeather', 1);
    sc.ui.dialog.say('系统', '获得了饰品【咕咕羽毛】：移动速度 +10%。在背包的装备页可以戴上。');
  }
  if (id === 'ian' && fr.hearts(s, 'ian') >= 5 && !s.perks.includes('ian5')) {
    s.perks.push('ian5');
    addItem(s, 'scholarGlasses', 1);
    sc.ui.dialog.say('系统', '获得了饰品【学者眼镜】：获得的经验 +25%。在背包的装备页可以戴上。');
  }
}

const line = (id: NpcId): string => {
  const l = NPCS[id].lines;
  return l[Math.floor(Math.random() * l.length)];
};

function giftChoice(sc: PlayScene, id: NpcId): Choice {
  const done = sc.s.npcs[id].giftDay === sc.s.day;
  return { label: '送礼物', disabled: done, note: done ? '今天已经送过了' : undefined, onSelect: () => (done ? sc.toast('今天已经送过礼物了') : giftPanel(sc, id)) };
}

/** 选择礼物的面板 */
export function giftPanel(sc: PlayScene, id: NpcId): void {
  const def = NPCS[id];
  sc.ui.panel.show(`送给 ${def.name}`, [{
    id: 'gift',
    label: '礼物',
    render: (body) => {
      const giftable = ITEM_IDS.filter((it) => count(sc.s, it) > 0 && ['crop', 'forage', 'dish', 'ore', 'material'].includes(ITEMS[it].kind));
      if (!giftable.length) {
        body.append(h('p', { class: 'empty', text: '背包里没有能送的东西。作物、采集物、料理、矿石和怪物素材都可以当礼物。' }));
        return;
      }
      const grid = h('div', { class: 'grid' });
      for (const it of giftable) {
        const cell = itemCell(itemIcon(it), itemName(it), count(sc.s, it));
        cell.addEventListener('click', () => {
          const r = fr.gift(sc.s, id, it);
          sc.ui.panel.close();
          const face = sc.npcFace(id);
          const text = {
            love: `这是……${itemName(it)}！我最喜欢这个了！谢谢你！`,
            like: `${itemName(it)}啊，我挺喜欢的。谢谢。`,
            neutral: '谢谢你的礼物。',
            dislike: `呃……${itemName(it)}……好吧，心意我收下了。`,
            already: '今天已经收过你的礼物啦。',
            none: '……？',
          }[r];
          sc.sfx(r === 'love' || r === 'like' ? 'levelup' : 'blip');
          sc.ui.dialog.say(def.name, text, { face });
          const ev = fr.pendingHeartEvent(sc.s, id);
          if (ev) {
            sc.ui.dialog.say(def.name, ev.text, { face });
            sc.ui.dialog.say('系统', `${def.name} 的好感达到 ${ev.hearts} 心。`);
            grantPerkGifts(sc, id);
          }
        });
        grid.append(cell);
      }
      body.append(h('p', { class: 'muted', text: `${def.name}最喜欢：${(def.loves as ItemId[]).map(itemName).join('、')}` }), grid);
    },
  }]);
}

/* ---------- 铁匠 ---------- */

export function smithMenu(sc: PlayScene, greeting?: string): void {
  const s = sc.s;
  const face = sc.npcFace('smith');
  const forgeDiscount = fr.hasPerk(s, 'smith', 6) ? 0.2 : 0;
  const choices: Choice[] = [{
    label: '打理装备',
    note: '强化 +1 到 +10、提升品质、升到更好的材料',
    onSelect: () => smithPanel(sc),
  }];
  // 武器图纸：最深到过一定层数后，老岩会画新的武器图纸
  for (const t of typesOf(s.cls)) {
    const wt = weaponType(t);
    const bp = wt.blueprint;
    if (!bp || s.weaponTypes.includes(t) || s.deepest < bp.floor) continue;
    choices.push({
      label: `买图纸：${wt.name}`,
      note: `${forge.costText(bp.cost, itemName, forgeDiscount)} · ${wt.desc}`,
      disabled: !forge.canAfford(s, bp.cost, forgeDiscount),
      onSelect: () => {
        if (!forge.canAfford(s, bp.cost, forgeDiscount)) return;
        forge.pay(s, bp.cost, forgeDiscount);
        const w = unlockWeaponType(s, t);
        sc.sfx('forge');
        sc.autosave();
        smithMenu(sc, `【${wt.name}】的图纸画好了，顺手照着打了一把${w ? `【${gearName(w)}】` : ''}送你，在背包里点它就能换上。以后宝箱里也会出这种武器。`);
      },
    });
  }
  const oreValue = sellableValue(s, ['ore']);
  choices.push({
    label: oreValue ? `卖出全部矿石 +${oreValue}金` : '卖出全部矿石',
    note: '锻造要用的矿石记得留着',
    disabled: !oreValue,
    onSelect: () => {
      const g = sellAll(s, ['ore']);
      sc.sfx('coin');
      smithMenu(sc, `收下了。${g} 金币，点清楚。`);
    },
  });
  choices.push(giftChoice(sc, 'smith'), { label: '离开' });
  sc.ui.dialog.say('铁匠·老岩', greeting ?? line('smith'), { face, choices });
}

/* ---------- 杂货店 ---------- */

export function shopMenu(sc: PlayScene, greeting?: string): void {
  const s = sc.s;
  const face = sc.npcFace('vera');
  const discount = fr.hasPerk(s, 'vera', 6) ? 0.2 : fr.hasPerk(s, 'vera', 4) ? 0.1 : 0;
  const season = seasonOf(s.day);
  const seeds = Object.values(CROPS).filter((c) => c.seasons.includes(season)).map((c) => c.seed);
  const choices: Choice[] = seeds.map((seed) => ({
    label: `买 ${itemName(seed)} ×5`,
    note: `${price(seed, 5, discount)} 金 · ${ITEMS[seed].desc}`,
    disabled: s.gold < price(seed, 5, discount),
    onSelect: () => {
      if (buy(s, seed, 5, discount)) {
        sc.sfx('coin');
        shopMenu(sc, '谢谢惠顾~ 还要别的吗？');
      }
    },
  }));
  if (!seeds.length) choices.push({ label: '（冬天没有能种的种子）', disabled: true });
  choices.push({
    label: '买 木材 ×10',
    note: `${price('wood', 10)} 金 · 盖房子、造设施用`,
    disabled: s.gold < price('wood', 10),
    onSelect: () => {
      if (!buy(s, 'wood', 10)) return;
      sc.sfx('coin');
      shopMenu(sc, '木头是隔壁山上运来的，结实着呢。');
    },
  });
  const cropValue = sellableValue(s, ['crop', 'forage']);
  choices.push({
    label: cropValue ? `卖出全部作物和采集物 +${cropValue}金` : '卖出全部作物和采集物',
    disabled: !cropValue,
    onSelect: () => {
      sellAll(s, ['crop', 'forage']);
      sc.sfx('coin');
      shopMenu(sc, '新鲜的作物！我收下啦。');
    },
  });
  choices.push(giftChoice(sc, 'vera'), { label: '离开' });
  sc.ui.dialog.say('杂货店·薇拉', greeting ?? (season === 3 ? '冬天地里什么都长不了，去矿里转转吧！' : line('vera')), { face, choices });
}

/* ---------- 诊所 ---------- */

export function clinicMenu(sc: PlayScene, greeting?: string): void {
  const s = sc.s;
  const face = sc.npcFace('lia');
  const discount = fr.hasPerk(s, 'lia', 4) ? 0.15 : 0;
  const stock: ItemId[] = ['potion', 'tonic'];
  if (fr.hasPerk(s, 'lia', 5)) stock.push('bigPotion');
  const choices: Choice[] = stock.map((id) => ({
    label: `买 ${itemName(id)}`,
    note: `${price(id, 1, discount)} 金 · ${ITEMS[id].desc}`,
    disabled: s.gold < price(id, 1, discount),
    onSelect: () => {
      if (buy(s, id, 1, discount)) {
        sc.sfx('coin');
        clinicMenu(sc, '收好。别等到快不行了才喝。');
      }
    },
  }));
  if (!fr.hasPerk(s, 'lia', 5)) choices.push({ label: '高级药水（莉娅好感 5 心后解锁）', disabled: true });
  choices.push({
    label: '治疗（回满生命和体力）',
    note: '50 金',
    disabled: s.gold < 50,
    onSelect: () => {
      s.gold -= 50;
      s.hp = sc.maxHp;
      s.en = 100;
      sc.sfx('heal');
      sc.ui.dialog.say('药剂师·莉娅', '好了，伤口都处理干净了。', { face });
    },
  });
  choices.push(giftChoice(sc, 'lia'), { label: '离开' });
  sc.ui.dialog.say('药剂师·莉娅', greeting ?? line('lia'), { face, choices });
}

/* ---------- 冒险者公会 ---------- */

export function guildMenu(sc: PlayScene, greeting?: string): void {
  const s = sc.s;
  const face = sc.npcFace('ian');
  const bonus = fr.hasPerk(s, 'ian', 4) ? 0.25 : 0;
  const q = quests.currentQuest(s);
  const choices: Choice[] = [];
  let text = greeting ?? line('ian');
  if (!q) {
    text = '所有委托都完成了。公会以你为荣……这句话我会写进小说里的。';
  } else if (!s.quest.active) {
    choices.push({
      label: `接受委托：${q.title}`,
      note: `${q.desc} 报酬 ${Math.round(q.reward.gold * (1 + bonus))} 金`,
      onSelect: () => {
        quests.accept(s);
        sc.sfx('select');
        sc.ui.dialog.say('冒险者公会·艾恩', `委托【${q.title}】已登记。${q.desc}`, { face });
      },
    });
  } else {
    const pr = quests.progressOf(s);
    if (quests.isComplete(s)) {
      choices.push({
        label: `交付委托：${q.title}`,
        note: `进度 ${pr.have}/${pr.need}`,
        onSelect: () => {
          const done = quests.turnIn(s, bonus);
          if (!done) return;
          sc.sfx('levelup');
          const items = Object.entries(done.reward.items ?? {}).map(([k, n]) => `${itemName(k as ItemId)}×${n}`);
          sc.ui.dialog.say('冒险者公会·艾恩', `干得漂亮。这是报酬：${Math.round(done.reward.gold * (1 + bonus))} 金${items.length ? `、${items.join('、')}` : ''}。`, { face });
          sc.autosave();
        },
      });
    } else {
      text = `委托【${q.title}】进度 ${pr.have}/${pr.need}。${q.desc}`;
    }
  }
  const matValue = sellableValue(s, ['material']);
  choices.push({
    label: matValue ? `卖出全部怪物素材 +${matValue}金` : '卖出全部怪物素材',
    note: '锻造护甲要用凝胶、骨头和齿轮',
    disabled: !matValue,
    onSelect: () => {
      sellAll(s, ['material']);
      sc.sfx('coin');
      guildMenu(sc, '公会收购完毕。');
    },
  });
  choices.push(giftChoice(sc, 'ian'), { label: '离开' });
  sc.ui.dialog.say('冒险者公会·艾恩', text, { face, choices });
}

/* ---------- 咕咕和小橡 ---------- */

function owlTalk(sc: PlayScene): void {
  const s = sc.s;
  const face = sc.npcFace('owl');
  const tip = OWL_TIPS[s.tip % OWL_TIPS.length];
  s.tip++;
  sc.ui.dialog.say('猫头鹰·咕咕', tip, { face, choices: [{ label: '再说一条', onSelect: () => owlTalk(sc) }, giftChoice(sc, 'owl'), { label: '离开' }] });
}

function kidTalk(sc: PlayScene): void {
  sc.ui.dialog.say('小橡', line('kid'), { face: sc.npcFace('kid'), choices: [giftChoice(sc, 'kid'), { label: '离开' }] });
}

/* ---------- 家和矿脉入口 ---------- */

export function homeMenu(sc: PlayScene): void {
  const cookable = RECIPES.filter((r) => canCook(sc.s, r)).length;
  sc.ui.dialog.say('家', homeGreeting(sc), {
    choices: [
      { label: '睡觉', note: '睡到明天早上，会自动存档', onSelect: () => sc.sleep() },
      { label: '做饭', note: cookable ? `现在能做 ${cookable} 道菜` : '材料不够的话可以先看看菜谱', onSelect: () => cookPanel(sc) },
      { label: '仓库箱', note: '和背包分开放东西，背包满了时新东西也会送到这里', onSelect: () => stashPanel(sc) },
      ...homeChoices(sc),
      { label: '离开' },
    ],
  });
}

/** 灶台：列出全部菜谱，材料够了就能做 */
export function cookPanel(sc: PlayScene): void {
  sc.ui.panel.show('灶台', [{
    id: 'cook',
    label: '菜谱',
    render: (body) => {
      const s = sc.s;
      const list = h('div', { class: 'recipes' });
      for (const r of RECIPES) {
        const d = ITEMS[r.dish] as ItemDef;
        const ok = canCook(s, r);
        const kitchen = kitchenOk(s, r) ? '' : `需要${HOUSES[r.kitchen ?? 0].name}的厨房`;
        const needs = (Object.entries(r.needs) as [ItemId, number][]).map(([id, n]) => {
          const have = count(s, id);
          return h('span', { class: have >= n ? 'have' : 'miss', text: `${itemName(id)} ${have}/${n}` });
        });
        const eff = [d.heal ? `+${d.heal} HP` : '', d.energy ? `+${d.energy} 体力` : '', d.buff ? BUFF_TEXT[d.buff.stat](d.buff.value) : ''].filter(Boolean).join(' · ');
        const row = h('button', { type: 'button', class: `recipe${ok ? '' : ' off'}`, 'data-nav': '' },
          h('img', { src: iconUrl(itemIcon(r.dish)), alt: '' }),
          h('div', {},
            h('b', { text: d.name }),
            h('small', { text: eff }),
            h('p', {}, ...needs),
          ),
          h('em', { text: kitchen || (count(s, r.dish) ? `已有 ${count(s, r.dish)}` : '') }),
        );
        row.addEventListener('click', () => {
          if (!cook(s, r)) {
            sc.sfx('fail');
            sc.toast(kitchen || '材料不够');
            return;
          }
          sc.sfx('cook');
          sc.toast(`做好了【${d.name}】`);
          sc.ui.panel.refresh();
        });
        list.append(row);
      }
      body.append(
        h('p', { class: 'muted', text: '料理能回复生命和体力，还附带一种效果，持续几个小时（睡一觉就没了）。同一时间只能有一种料理效果。' }),
        list,
      );
    },
  }]);
}

export function mineEntrance(sc: PlayScene): void {
  const s = sc.s;
  const choices: Choice[] = [{ label: '进入第 1 层', note: ZONES[0].name, onSelect: () => sc.goToFloor(1) }];
  for (const z of ZONES) {
    const bossDown = s.bosses.includes(z.boss.id);
    if (s.deepest >= z.boss.floor) {
      choices.push({ label: `直达第 ${z.boss.floor} 层`, note: `${z.boss.room} · ${BOSSES[z.boss.id].name}${bossDown ? '（已击败，可再次挑战）' : ''}`, onSelect: () => sc.goToFloor(z.boss.floor) });
    }
    if (bossDown && z.boss.floor < MAX_FLOOR) {
      choices.push({ label: `直达第 ${z.boss.floor + 1} 层`, note: ZONES.find((zz) => zz.from === z.boss.floor + 1)?.name, onSelect: () => sc.goToFloor(z.boss.floor + 1) });
    }
  }
  choices.push({ label: '先不去' });
  sc.ui.dialog.say('矿脉入口', `冷风从洞里吹出来，深处有微弱的青光。${s.deepest ? `（最深到过第 ${s.deepest} 层）` : ''}`, { choices });
}
