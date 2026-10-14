import { TS } from '../../core/constants';
import { TAU, ri, rnd } from '../../core/math';
import { settings, unlocks } from '../../core/settings';
import { MAX_FLOOR } from '../../data/floors';
import type { ItemId } from '../../data/items';
import { ITEMS } from '../../data/items';
import { BOSSES, MONSTERS } from '../../data/monsters';
import { SKILLS } from '../../data/skills';
import type { Enemy } from '../../entities/Enemy';
import { Monster } from '../../entities/Monster';
import { RegionBoss } from '../../entities/RegionBoss';
import { monsterSprites } from '../../gfx/sprites';
import { MAX_GEAR_TIER, MONSTER_GEAR_CHANCE, gearTierFor } from '../../data/gear';
import { addItem, giveGear, owns } from '../../state/save';
import { bossDrops, rollGear } from '../../systems/gear';
import { gainXp, monsterXp } from '../../systems/level';
import * as quests from '../../systems/quests';
import { accSum, attack as atkStat, critChance, damageTaken, defense, lightRadiusMul, maxHp, weaponTypeOf } from '../../systems/stats';
import { Tile } from '../../world/TileMap';
import { defeatRegionBoss } from './regions';
import type { PlayScene } from '../PlayScene';
import { announceGear } from './gearui';

export type ShotKind = 'bolt' | 'shard' | 'dart' | 'orb' | 'fire' | 'knife';

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  pierce: boolean;
  hit: Set<Enemy>;
  color: string;
  kind: ShotKind;
  /** 伤害倍率 */
  mult: number;
  /** 每秒最多转多少弧度去追最近的敌人 */
  homing?: number;
  /** 命中或飞完后爆炸的半径 */
  boom?: number;
  poison?: boolean;
}

/** 星辉之雨落下的星星：倒计时结束时在落点炸开 */
export interface Strike {
  x: number;
  y: number;
  t: number;
  r: number;
  mult: number;
}

/* ---------- 普通攻击 ---------- */

/** 远程武器会自动瞄准面前一个扇形里最近的敌人，没有就朝正前方 */
function aimAngle(sc: PlayScene, range: number): number {
  const p = sc.player;
  const base = Math.atan2(p.fy, p.fx);
  let best = base;
  let bestD = range;
  for (const e of sc.enemies) {
    if (!e.targetable) continue;
    const dx = e.x - p.x;
    const dy = e.y - 6 - (p.y - 7);
    const d = Math.hypot(dx, dy);
    if (d >= bestD) continue;
    let diff = Math.atan2(dy, dx) - base;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    if (Math.abs(diff) < 0.55) {
      best = Math.atan2(dy, dx);
      bestD = d;
    }
  }
  return best;
}

function shoot(sc: PlayScene, a: number, speed: number, opts: Partial<Shot> & { t: number; color: string; kind: ShotKind }): void {
  const p = sc.player;
  sc.shots.push({
    x: p.x + Math.cos(a) * 6,
    y: p.y - 7 + Math.sin(a) * 6,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    pierce: false,
    hit: new Set(),
    mult: 1,
    ...opts,
  });
}

/** 普通攻击：打法由当前武器类型决定 */
export function attack(sc: PlayScene): void {
  const p = sc.player;
  if (p.atkCd > 0 || p.dashT > 0) return;
  const wt = weaponTypeOf(sc.s);
  p.atkCd = wt.cooldown;
  p.swing++;
  const poison = p.venomT > 0;
  switch (wt.kind) {
    case 'bolt':
      p.castT = 0.15;
      shoot(sc, aimAngle(sc, 150), 200, { t: 0.8, color: '#c39bff', kind: 'bolt' });
      sc.sfx('magic');
      return;
    case 'spread': {
      p.castT = 0.18;
      const a = aimAngle(sc, 120);
      for (const d of [-0.28, 0, 0.28]) shoot(sc, a + d, 190, { t: 0.6, color: '#c39bff', kind: 'bolt' });
      sc.sfx('magic');
      return;
    }
    case 'orb':
      p.castT = 0.25;
      shoot(sc, aimAngle(sc, 160), 105, { t: 1.7, color: '#ffb3ff', kind: 'orb', pierce: true, homing: 3.2 });
      sc.sfx('magic');
      return;
    case 'dart':
      p.castT = 0.1;
      shoot(sc, aimAngle(sc, 100), 290, { t: 0.36, color: '#dfe6ee', kind: 'dart', poison });
      sc.sfx('swing');
      return;
    case 'shard':
      p.castT = 0.15;
      shoot(sc, aimAngle(sc, 160), 230, { t: 0.7, color: '#62f0d6', kind: 'shard', pierce: true });
      sc.sfx('magic');
      return;
    case 'fan': {
      p.castT = 0.18;
      const a = aimAngle(sc, 120);
      for (const d of [-0.32, 0, 0.32]) shoot(sc, a + d, 215, { t: 0.55, color: '#62f0d6', kind: 'shard', pierce: true });
      sc.sfx('magic');
      return;
    }
    case 'pulse':
      p.castT = 0.2;
      sc.fx.ring(p.x, p.y - 6, 34, 0.3, '#62f0d6');
      for (const e of near(sc, 34)) push(sc, e, 1);
      sc.sfx('magic');
      return;
    default:
      melee(sc, wt.kind, wt.reach ?? 12);
      if (wt.kind === 'twin') p.twinT = 0.1;
  }
}

/** 近战判定：挥砍是面前一块，重劈是半圈，突刺是一条直线 */
function melee(sc: PlayScene, kind: 'slash' | 'cleave' | 'thrust' | 'twin', r: number): void {
  const p = sc.player;
  p.swingKind = kind;
  p.atkT = kind === 'cleave' ? 0.26 : 0.18;
  sc.sfx(kind === 'cleave' ? 'slam' : 'swing');
  const ox = p.x;
  const oy = p.y - 5;
  for (const e of sc.enemies.slice()) {
    if (e.hitBy === p.swing || !e.targetable) continue;
    const dx = e.x - ox;
    const dy = e.y - 4 - oy;
    let hit = false;
    if (kind === 'thrust') {
      // 沿朝向的距离和偏离的距离
      const along = dx * p.fx + dy * p.fy;
      const side = Math.abs(dx * p.fy - dy * p.fx);
      hit = along > -4 && along < r + e.hw && side < 6 + e.hh;
    } else if (kind === 'cleave') {
      const d = Math.hypot(dx, dy);
      hit = d < r + 4 + e.hw && (dx * p.fx + dy * p.fy) / (d || 1) > -0.35;
    } else {
      const cx = p.fx * (r - 4);
      const cy = p.fy * (r - 4);
      hit = Math.abs(dx - cx) < r - 3 + e.hw && Math.abs(dy - cy) < r - 3 + e.hh;
    }
    if (!hit) continue;
    e.hitBy = p.swing;
    hitEnemy(sc, e, 1, p.fx, p.fy, kind === 'cleave' ? 1.7 : 1);
  }
}

/** 每帧的战斗杂项：双刃第二刀、中毒、星星落地、生命回复 */
export function updateCombat(sc: PlayScene, dt: number): void {
  const p = sc.player;
  if (p.twinT > 0) {
    p.twinT -= dt;
    if (p.twinT <= 0) {
      p.swing++;
      // 第二刀转向最近的敌人
      const t = sc.enemies.filter((e) => e.targetable).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (t && Math.hypot(t.x - p.x, t.y - p.y) < 30) {
        if (Math.abs(t.x - p.x) > Math.abs(t.y - p.y)) p.face(Math.sign(t.x - p.x), 0);
        else p.face(0, Math.sign(t.y - p.y));
      }
      melee(sc, 'twin', weaponTypeOf(sc.s).reach ?? 12);
    }
  }
  for (const e of sc.enemies.slice()) {
    if (e.poison <= 0) continue;
    e.poison -= dt;
    e.poisonTick -= dt;
    if (Math.random() < dt * 6) sc.fx.spark(e.x + rnd(-4, 4), e.y - 8, '#8fe36a');
    if (e.poisonTick > 0) continue;
    e.poisonTick = 0.5;
    e.hp -= e.poisonDmg;
    e.flash = 0.06;
    if (settings.damageNumbers) sc.fx.text(e.x, e.y - 14, String(e.poisonDmg), '#8fe36a');
    if (e.hp <= 0) killEnemy(sc, e);
  }
  for (let i = sc.strikes.length - 1; i >= 0; i--) {
    const st = sc.strikes[i];
    st.t -= dt;
    if (st.t > 0) continue;
    sc.strikes.splice(i, 1);
    sc.fx.ring(st.x, st.y, st.r, 0.3, '#fff6c8');
    sc.fx.burst(st.x, st.y, '#ffe680', 8, 50);
    sc.sfx('hit');
    for (const e of sc.enemies.slice()) {
      if (e.targetable && Math.hypot(e.x - st.x, (e.y - st.y) * 1.2) < st.r + e.hw) hitEnemy(sc, e, st.mult, 0, 0);
    }
  }
}

/* ---------- 技能 ---------- */

const near = (sc: PlayScene, r: number) => {
  const p = sc.player;
  return sc.enemies.filter((e) => e.targetable && Math.hypot(e.x - p.x, (e.y - p.y) * 1.2) < r + e.hw);
};

const push = (sc: PlayScene, e: Enemy, mult: number) => {
  const p = sc.player;
  const a = Math.atan2(e.y - p.y, e.x - p.x);
  hitEnemy(sc, e, mult, Math.cos(a), Math.sin(a));
};

/** 职业技能，idx 为 0、1、2 */
export function useSkill(sc: PlayScene, idx: number): void {
  const s = sc.s;
  const p = sc.player;
  const sk = SKILLS[s.cls][idx];
  if (!sk) return;
  if (s.level < sk.level) {
    sc.toast(`【${sk.name}】在 ${sk.level} 级解锁`);
    return;
  }
  if (p.skillCds[idx] > 0) {
    sc.toast(`${sk.name} 冷却中：${p.skillCds[idx].toFixed(1)} 秒`);
    return;
  }
  if (s.en < sk.cost) {
    sc.toast('体力不够，放不出技能');
    return;
  }
  if (p.dashT > 0) return;
  s.en -= sk.cost;
  p.skillCds[idx] = sk.cooldown;
  p.swing++;
  switch (sk.id) {
    case 'whirl':
      p.spinT = 0.35;
      sc.fx.ring(p.x, p.y - 6, 32, 0.35, '#ffd34d');
      for (const e of near(sc, 32)) push(sc, e, 1.6);
      sc.sfx('swing');
      break;
    case 'charge':
      p.dashT = 0.24;
      p.dashKind = 'charge';
      p.dashId = p.swing;
      p.inv = Math.max(p.inv, 0.3);
      sc.fx.ring(p.x, p.y - 6, 14, 0.25, '#ffd34d');
      sc.sfx('dash');
      break;
    case 'warcry':
      p.rageT = 8;
      sc.fx.ring(p.x, p.y - 6, 60, 0.5, '#ff8a3a');
      sc.fx.ring(p.x, p.y - 6, 40, 0.4, '#ffd34d');
      for (const e of near(sc, 60)) {
        e.frozen = Math.max(e.frozen, 0.6);
        push(sc, e, 0.4);
      }
      sc.fx.text(p.x, p.y - 30, '攻击 +30%', '#ffcf5a');
      sc.shake(0.25, 2);
      sc.sfx('slam');
      break;
    case 'nova':
      sc.fx.ring(p.x, p.y - 6, 60, 0.45, '#8fd8ff');
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        sc.fx.particles.push({ x: p.x + Math.cos(a) * 20, y: p.y - 6 + Math.sin(a) * 12, vx: Math.cos(a) * 90, vy: Math.sin(a) * 50, t: 0.4, c: '#cfefff', g: 0 });
      }
      for (const e of near(sc, 60)) {
        e.frozen = 2.5;
        hitEnemy(sc, e, 0.6, 0, 0);
      }
      sc.sfx('magic');
      break;
    case 'fireball':
      p.castT = 0.25;
      shoot(sc, aimAngle(sc, 170), 170, { t: 1, color: '#ff8a3a', kind: 'fire', boom: 30, mult: 2.2 });
      sc.sfx('magic');
      break;
    case 'blink': {
      // 沿朝向找最远的空地
      let d = 64;
      while (d > 0 && !sc.boxFree(p.x + p.fx * d, p.y + p.fy * d, p.hw, p.hh)) d -= 4;
      sc.fx.ring(p.x, p.y - 6, 30, 0.4, '#8fd8ff');
      sc.fx.burst(p.x, p.y - 8, '#cfefff', 12, 50);
      for (const e of near(sc, 30)) {
        e.frozen = Math.max(e.frozen, 1.2);
        hitEnemy(sc, e, 0.8, 0, 0);
      }
      p.x += p.fx * d;
      p.y += p.fy * d;
      p.vx = p.vy = 0;
      p.inv = Math.max(p.inv, 0.25);
      sc.fx.burst(p.x, p.y - 8, '#c39bff', 12, 50);
      sc.sfx('blink');
      break;
    }
    case 'shadow':
      p.dashT = 0.2;
      p.dashKind = 'shadow';
      p.dashId = p.swing;
      p.inv = Math.max(p.inv, 0.35);
      sc.fx.ring(p.x, p.y - 6, 12, 0.25, '#ff6b8a');
      sc.sfx('dash');
      break;
    case 'knives': {
      const a = Math.atan2(p.fy, p.fx);
      for (let i = 0; i < 7; i++) shoot(sc, a + (i - 3) * 0.17, 240, { t: 0.45, color: '#dfe6ee', kind: 'knife', mult: 0.9, poison: p.venomT > 0 });
      sc.sfx('swing');
      break;
    }
    case 'venom':
      p.venomT = 8;
      sc.fx.ring(p.x, p.y - 6, 24, 0.4, '#8fe36a');
      sc.fx.text(p.x, p.y - 30, '毒刃', '#8fe36a');
      sc.sfx('magic');
      break;
    case 'burst':
      s.hp = Math.min(maxHp(s), s.hp + 30);
      sc.fx.text(p.x, p.y - 30, '+30 HP', '#7fffb0');
      sc.fx.ring(p.x, p.y - 6, 52, 0.5, '#62f0d6');
      for (const e of near(sc, 52)) push(sc, e, 1.2);
      sc.sfx('heal');
      break;
    case 'swarm':
      p.swarmT = 10;
      sc.fx.ring(p.x, p.y - 6, 26, 0.4, '#62f0d6');
      sc.fx.burst(p.x, p.y - 8, '#c8fff4', 16, 60);
      sc.sfx('magic');
      break;
    case 'starfall': {
      const targets = near(sc, 120).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      for (let i = 0; i < 10; i++) {
        const t = targets[i % Math.max(1, targets.length)];
        const x = t ? t.x + rnd(-6, 6) : p.x + rnd(-60, 60);
        const y = t ? t.y + rnd(-4, 4) : p.y + rnd(-40, 40);
        sc.strikes.push({ x, y, t: 0.3 + i * 0.11, r: 18, mult: 1.2 });
      }
      sc.sfx('magic');
      break;
    }
  }
}

/** 冲锋和影步期间的突进 */
export function updateDash(sc: PlayScene, dt: number): void {
  const p = sc.player;
  const charge = p.dashKind === 'charge';
  p.dashT -= dt;
  const sp = charge ? 300 : 380;
  sc.move(p, p.fx * sp * dt, p.fy * sp * dt, p.hw, p.hh);
  p.moving = true;
  p.walk += (sp * dt) / 7;
  for (const e of sc.enemies.slice()) {
    if (e.hitBy === p.dashId || !e.targetable) continue;
    if (Math.abs(e.x - p.x) < e.hw + 9 && Math.abs(e.y - p.y) < e.hh + 9) {
      e.hitBy = p.dashId;
      if (charge) e.frozen = Math.max(e.frozen, 0.8);
      hitEnemy(sc, e, charge ? 1.4 : 1.5, p.fx, p.fy, charge ? 1.5 : 1);
    }
  }
  sc.fx.spark(p.x + rnd(-3, 3), p.y - 6 + rnd(-5, 5), charge ? '#ffd34d' : '#ff6b8a');
}

/* ---------- 伤害和击杀 ---------- */

export function hitEnemy(sc: PlayScene, e: Enemy, mult: number, kx: number, ky: number, knock = 1, poison = false): void {
  if (!sc.enemies.includes(e)) return;
  const s = sc.s;
  const p = sc.player;
  const crit = Math.random() < critChance(s);
  const rage = p.rageT > 0 ? 1.3 : 1;
  const dmg = Math.max(1, Math.round(atkStat(s) * mult * rage * (crit ? 1.8 : 1) * e.damageMul * rnd(0.9, 1.1)));
  e.hp -= dmg;
  e.flash = 0.15;
  if (settings.damageNumbers) sc.fx.text(e.x, e.y - 16 - (e.boss ? 24 : 0), (crit ? '暴击 ' : '') + dmg, crit ? '#ffd34d' : '#fff');
  sc.sfx(crit ? 'crit' : 'hit');
  const steal = accSum(s, 'lifesteal');
  if (steal > 0) s.hp = Math.min(maxHp(s), s.hp + dmg * steal);
  if (poison || p.venomT > 0) {
    e.poison = 4;
    e.poisonDmg = Math.max(1, Math.round(atkStat(s) * 0.2));
    e.poisonTick = Math.min(e.poisonTick, 0.5);
  }
  const kb = 170 * e.knock * knock;
  e.kx = kx * kb;
  e.ky = ky * kb;
  if (e.hp <= 0) killEnemy(sc, e);
}

export function giveItems(sc: PlayScene, items: Partial<Record<ItemId, number>>, x: number, y: number): void {
  let dy = 0;
  for (const [id, n] of Object.entries(items) as [ItemId, number][]) {
    addItem(sc.s, id, n);
    sc.fx.text(x, y - 20 - dy, `+${n} ${ITEMS[id].name}`, ITEMS[id].color);
    dy += 8;
  }
}

/** 加经验并处理升级：回一点血，提示新解锁的技能 */
export function grantXp(sc: PlayScene, n: number, x: number, y: number): void {
  const s = sc.s;
  const amount = Math.round(n * (1 + accSum(s, 'xp')));
  if (amount <= 0) return;
  const before = maxHp(s);
  const up = gainXp(s, amount);
  sc.fx.text(x, y - 4, `+${amount} 经验`, '#9fd0ff');
  if (!up) return;
  s.hp = Math.min(maxHp(s), s.hp + (maxHp(s) - before) + Math.round(maxHp(s) * 0.25));
  sc.sfx('levelup');
  sc.fx.ring(sc.player.x, sc.player.y - 8, 26, 0.6, '#ffd34d');
  sc.fx.text(sc.player.x, sc.player.y - 36, `升级！Lv.${s.level}`, '#ffd34d');
  const keys = ['L', 'U', 'O'];
  SKILLS[s.cls].forEach((sk, i) => {
    if (sk.level > s.level - up && sk.level <= s.level) sc.toast(`学会了新技能【${sk.name}】（${keys[i]} 键）`);
  });
}

function killEnemy(sc: PlayScene, e: Enemy): void {
  const s = sc.s;
  if (!sc.enemies.includes(e)) return;
  sc.enemies.splice(sc.enemies.indexOf(e), 1);
  sc.sfx('kill');
  if (e instanceof RegionBoss) return defeatRegionBoss(sc, e);
  if (e instanceof Monster) {
    const mid = e.mid;
    const d = e.def;
    const g = ri(d.gold[0], d.gold[1]);
    s.gold += g;
    sc.fx.text(e.x, e.y - 10, `+${g} G`, '#ffcf5a');
    sc.fx.burst(e.x, e.y - 4, d.color, 10, 60);
    const drops: Partial<Record<ItemId, number>> = {};
    for (const dr of d.drops) if (Math.random() < dr.chance) drops[dr.item] = 1;
    giveItems(sc, drops, e.x, e.y);
    if (Math.random() < MONSTER_GEAR_CHANCE) {
      const g = giveGear(s, rollGear({ cls: s.cls, types: s.weaponTypes, tier: gearTierFor(sc.floor), source: 'monster', luck: accSum(s, 'luck') }));
      announceGear(sc, [g], e.x, e.y - 8 - Object.keys(drops).length * 8);
    }
    s.kills[mid] = (s.kills[mid] ?? 0) + 1;
    quests.onKill(s, mid);
    grantXp(sc, monsterXp(MONSTERS[mid].hp, sc.danger), e.x, e.y);
    return;
  }
  if (!e.boss) return;
  const id = e.boss;
  const def = BOSSES[id];
  const first = !s.bosses.includes(id);
  sc.shake(0.7, 3);
  sc.sfx('levelup');
  sc.fx.burst(e.x, e.y - 10, '#ffd34d', 30, 100);
  sc.enemies = [];
  sc.hazards = [];
  const g = ri(def.gold[0], def.gold[1]);
  s.gold += g;
  sc.fx.text(e.x, e.y - 30, `+${g} G`, '#ffcf5a');
  const drops: Partial<Record<ItemId, number>> = { ...(first ? def.firstDrops : def.repeatDrops) };
  // 再次挑战时有机会拿到 Boss 的饰品
  const trophy: ItemId = id === 'slimeKing' ? 'crownRing' : 'jawCharm';
  if (!owns(s, trophy) && (first ? id === 'ironJaw' : Math.random() < 0.35)) drops[trophy] = 1;
  giveItems(sc, drops, e.x, e.y - 10);
  // Boss 必掉稀有以上的装备，比这一带好一阶
  const tier = Math.min(MAX_GEAR_TIER, gearTierFor(sc.floor) + 1);
  const gears = bossDrops({ cls: s.cls, types: s.weaponTypes, tier, luck: accSum(s, 'luck') }, first).map((g) => giveGear(s, g));
  if (first) s.bosses.push(id);
  quests.onBoss(s, id);
  grantXp(sc, Math.round(def.hp / 2), e.x, e.y - 20);
  sc.openBossExit();
  sc.setMusic();
  const face = id === 'slimeKing' ? monsterSprites.king[0] : undefined;
  sc.ui.dialog.say(def.name, def.defeat, { face });
  if (drops[trophy]) sc.ui.dialog.say('系统', `得到了饰品【${ITEMS[trophy].name}】，在背包里点它就能戴上。`);
  announceGear(sc, gears, e.x, e.y - 40, true);
  if (first) {
    const list = Object.entries(def.firstDrops).map(([k, n]) => `${ITEMS[k as ItemId].name}×${n}`).join('、');
    sc.ui.dialog.say('系统', `击败了${def.name}！获得 ${list}，以及 ${g} 金币。`);
    if (id === 'slimeKing') {
      sc.ui.dialog.say('系统', '有了王冠凝胶，老岩就肯把装备升成金器了。通往锈铁坑道的楼梯出现了。');
      if (unlocks.add('spirit')) {
        sc.ui.dialog.say('？？？', '……你身上有萤石的味道。我等这一天很久了。');
        sc.ui.dialog.say('系统', '隐藏职业【萤灵使】已解锁！新建存档时可以选择。');
      }
    }
    if (id === 'ironJaw' && sc.floor >= MAX_FLOOR) {
      sc.ui.dialog.say('咕咕', '咕！你打倒了铁颚。更深处的矿脉被厚厚的萤石封住了……第一章到这里结束，谢谢你，农夫。', { face: sc.npcFace('owl') });
    }
  }
}

export function hurtPlayer(sc: PlayScene, raw: number, sx: number, sy: number): void {
  const p = sc.player;
  if (p.inv > 0 || p.dashT > 0 || sc.ui.fade.busy) return;
  const s = sc.s;
  const d = damageTaken(raw, defense(s) + (p.rageT > 0 ? 4 : 0));
  s.hp -= d;
  p.inv = 0.9;
  sc.shake(0.25);
  sc.sfx('hurt');
  sc.fx.text(p.x, p.y - 28, `-${d}`, '#ff6b6b');
  const dx = p.x - sx;
  const dy = p.y - sy;
  const l = Math.hypot(dx, dy) || 1;
  p.kx = (dx / l) * 160;
  p.ky = (dy / l) * 160;
  if (s.hp <= 0) {
    s.hp = 0;
    sc.faint();
  }
}

/* ---------- 弹体 ---------- */

function explode(sc: PlayScene, sh: Shot): void {
  const r = sh.boom ?? 0;
  sc.fx.ring(sh.x, sh.y, r, 0.35, '#ff8a3a');
  sc.fx.burst(sh.x, sh.y, '#ffb35a', 16, 80);
  sc.shake(0.2, 2);
  sc.sfx('boom');
  for (const e of sc.enemies.slice()) {
    if (!e.targetable || Math.hypot(e.x - sh.x, (e.y - 6 - sh.y) * 1.2) > r + e.hw) continue;
    const a = Math.atan2(e.y - sh.y, e.x - sh.x);
    hitEnemy(sc, e, sh.mult, Math.cos(a), Math.sin(a));
  }
}

export function updateShots(sc: PlayScene, dt: number): void {
  for (let i = sc.shots.length - 1; i >= 0; i--) {
    const sh = sc.shots[i];
    sh.t -= dt;
    if (sh.homing) {
      // 追踪：慢慢转向最近的敌人
      let best: Enemy | null = null;
      let bd = 120;
      for (const e of sc.enemies) {
        if (!e.targetable || sh.hit.has(e)) continue;
        const d = Math.hypot(e.x - sh.x, e.y - 6 - sh.y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (best) {
        const sp = Math.hypot(sh.vx, sh.vy);
        const cur = Math.atan2(sh.vy, sh.vx);
        let diff = Math.atan2(best.y - 6 - sh.y, best.x - sh.x) - cur;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        const a = cur + Math.max(-sh.homing * dt, Math.min(sh.homing * dt, diff));
        sh.vx = Math.cos(a) * sp;
        sh.vy = Math.sin(a) * sp;
      }
    }
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    const tx = Math.floor(sh.x / TS);
    const ty = Math.floor((sh.y + 4) / TS);
    let dead = sh.t <= 0 || sc.map.solid(tx, ty) || sc.map.get(tx, ty) === Tile.ROCK;
    if (!dead) {
      for (const e of sc.enemies.slice()) {
        if (sh.hit.has(e) || !e.targetable) continue;
        const size = sh.kind === 'orb' ? 6 : sh.kind === 'fire' ? 5 : 3;
        if (Math.abs(e.x - sh.x) < e.hw + size && Math.abs(e.y - 6 - sh.y) < e.hh + size + 2) {
          sh.hit.add(e);
          if (sh.boom) {
            dead = true;
            break;
          }
          const l = Math.hypot(sh.vx, sh.vy) || 1;
          hitEnemy(sc, e, sh.mult, sh.vx / l, sh.vy / l, 1, !!sh.poison);
          if (!sh.pierce) {
            dead = true;
            break;
          }
        }
      }
    }
    if (Math.random() < (sh.kind === 'fire' ? 1 : 0.6)) sc.fx.spark(sh.x, sh.y, sh.color);
    if (dead) {
      if (sh.boom) explode(sc, sh);
      sc.shots.splice(i, 1);
    }
  }
}

export function drawShot(b: CanvasRenderingContext2D, s: Shot, cx: number, cy: number): void {
  const x = Math.round(s.x - cx);
  const y = Math.round(s.y - cy);
  switch (s.kind) {
    case 'orb':
      b.fillStyle = 'rgba(255,179,255,.35)';
      b.fillRect(x - 5, y - 5, 10, 10);
      b.fillStyle = s.color;
      b.fillRect(x - 3, y - 3, 6, 6);
      b.fillStyle = '#fff';
      b.fillRect(x - 1, y - 2, 2, 2);
      return;
    case 'fire':
      b.fillStyle = 'rgba(255,138,58,.4)';
      b.fillRect(x - 5, y - 5, 10, 10);
      b.fillStyle = '#ff8a3a';
      b.fillRect(x - 3, y - 3, 6, 6);
      b.fillStyle = '#ffe680';
      b.fillRect(x - 1, y - 1, 3, 3);
      return;
    case 'dart':
    case 'knife': {
      const l = Math.hypot(s.vx, s.vy) || 1;
      const ux = s.vx / l;
      const uy = s.vy / l;
      b.fillStyle = s.poison ? '#8fe36a' : s.color;
      for (let i = 0; i < 4; i++) b.fillRect(Math.round(x - ux * i), Math.round(y - uy * i), 1, 1);
      b.fillStyle = '#fff';
      b.fillRect(Math.round(x + ux), Math.round(y + uy), 1, 1);
      return;
    }
    default:
      b.fillStyle = s.color;
      b.fillRect(x - 2, y - 2, 4, 4);
      b.fillStyle = '#fff';
      b.fillRect(x - 1, y - 1, 2, 2);
  }
}

export function drawStrikes(sc: PlayScene, b: CanvasRenderingContext2D, cx: number, cy: number): void {
  for (const st of sc.strikes) {
    const x = Math.round(st.x - cx);
    const fall = Math.min(1, st.t / 0.3);
    const y = Math.round(st.y - cy - fall * 70);
    b.globalAlpha = 0.35;
    b.fillStyle = '#fff6c8';
    b.beginPath();
    b.ellipse(x, Math.round(st.y - cy), st.r * (1 - fall * 0.6), st.r * 0.5 * (1 - fall * 0.6), 0, 0, TAU);
    b.fill();
    b.globalAlpha = 1;
    b.fillStyle = '#ffe680';
    b.fillRect(x - 2, y - 2, 5, 5);
    b.fillStyle = '#fff';
    b.fillRect(x - 1, y - 1, 3, 3);
    b.fillStyle = 'rgba(255,230,128,.5)';
    b.fillRect(x, y - 8, 1, 6);
  }
}

/* ---------- 萤灵 ---------- */

export const orbCount = (sc: PlayScene): number => (sc.s.cls !== 'spirit' ? 0 : sc.player.swarmT > 0 ? 4 : 2);

export const orbPos = (sc: PlayScene, i: number): [number, number] => {
  const swarm = sc.player.swarmT > 0;
  const a = sc.clock * (swarm ? 4.5 : 3) + (i * TAU) / orbCount(sc);
  const r = swarm ? 24 : 20;
  return [sc.player.x + Math.cos(a) * r, sc.player.y - 9 + Math.sin(a) * r * 0.6];
};

/** 萤灵使的萤灵：碰到敌人自动造成伤害 */
export function updateOrbs(sc: PlayScene, dt: number): void {
  const n = orbCount(sc);
  if (!n) return;
  for (const e of sc.enemies.slice()) {
    if (!e.targetable) continue;
    e.orbCd -= dt;
    if (e.orbCd > 0) continue;
    for (let i = 0; i < n; i++) {
      const [ox, oy] = orbPos(sc, i);
      if (Math.abs(e.x - ox) < e.hw + 4 && Math.abs(e.y - 6 - oy) < e.hh + 5) {
        e.orbCd = 0.5;
        hitEnemy(sc, e, 0.45, 0, 0);
        break;
      }
    }
  }
}

export function updateHazards(sc: PlayScene, dt: number): void {
  const p = sc.player;
  for (let i = sc.hazards.length - 1; i >= 0; i--) {
    const hz = sc.hazards[i];
    if (hz.arm > 0) {
      hz.arm -= dt;
      continue;
    }
    hz.life -= dt;
    if (!hz.hit && Math.hypot(p.x - hz.x, (p.y - hz.y) * 1.3) < hz.r) {
      hz.hit = true;
      hurtPlayer(sc, hz.dmg, hz.x, hz.y);
    }
    if (hz.life <= 0) sc.hazards.splice(i, 1);
  }
}

/** 灯光半径倍率（萤石吊坠、萤火花茶） */
export const lightMul = (sc: PlayScene): number => lightRadiusMul(sc.s);
