import { TS } from '../../core/constants';
import { TAU, ri, rnd } from '../../core/math';
import { settings, unlocks } from '../../core/settings';
import { MAX_FLOOR } from '../../data/floors';
import type { ItemId } from '../../data/items';
import { ITEMS } from '../../data/items';
import { BOSSES } from '../../data/monsters';
import type { Enemy } from '../../entities/Enemy';
import { Monster } from '../../entities/Monster';
import { monsterSprites } from '../../gfx/sprites';
import { addItem } from '../../state/save';
import * as quests from '../../systems/quests';
import { attack as atkStat, classOf, critChance, damageTaken, defense, maxHp } from '../../systems/stats';
import { Tile } from '../../world/TileMap';
import type { PlayScene } from '../PlayScene';

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  pierce: boolean;
  hit: Set<Enemy>;
  color: string;
}

/** 普通攻击：近战职业挥砍，远程职业发射弹体 */
export function attack(sc: PlayScene): void {
  const p = sc.player;
  if (p.atkCd > 0 || p.dashT > 0) return;
  const C = classOf(sc.s);
  p.atkCd = C.cooldown;
  p.swing++;
  if (C.ranged) {
    p.castT = 0.15;
    const bolt = C.ranged === 'bolt';
    const sp = bolt ? 200 : 230;
    sc.shots.push({ x: p.x + p.fx * 6, y: p.y - 7 + p.fy * 6, vx: p.fx * sp, vy: p.fy * sp, t: bolt ? 0.8 : 0.7, pierce: !bolt, hit: new Set(), color: bolt ? '#c39bff' : '#62f0d6' });
    sc.sfx('magic');
    return;
  }
  p.atkT = 0.18;
  sc.sfx('swing');
  const r = C.reach ?? 12;
  const cx = p.x + p.fx * (r - 4);
  const cy = p.y - 5 + p.fy * (r - 4);
  for (const e of sc.enemies.slice()) {
    if (e.hitBy === p.swing || !e.targetable) continue;
    if (Math.abs(e.x - cx) < r - 3 + e.hw && Math.abs(e.y - 4 - cy) < r - 3 + e.hh) {
      e.hitBy = p.swing;
      hitEnemy(sc, e, 1, p.fx, p.fy);
    }
  }
}

/** 职业技能 */
export function useSkill(sc: PlayScene): void {
  const s = sc.s;
  const p = sc.player;
  const C = classOf(s);
  if (p.skillCd > 0) {
    sc.toast(`${C.skill.name} 冷却中：${p.skillCd.toFixed(1)} 秒`);
    return;
  }
  if (s.en < C.skill.cost) {
    sc.toast('体力不够，放不出技能');
    return;
  }
  s.en -= C.skill.cost;
  p.skillCd = C.skill.cooldown;
  p.swing++;
  const near = (r: number) => sc.enemies.filter((e) => e.targetable && Math.hypot(e.x - p.x, (e.y - p.y) * 1.2) < r + e.hw);
  const push = (e: Enemy, mult: number) => {
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    hitEnemy(sc, e, mult, Math.cos(a), Math.sin(a));
  };
  switch (s.cls) {
    case 'mage':
      sc.fx.ring(p.x, p.y - 6, 60, 0.45, '#8fd8ff');
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        sc.fx.particles.push({ x: p.x + Math.cos(a) * 20, y: p.y - 6 + Math.sin(a) * 12, vx: Math.cos(a) * 90, vy: Math.sin(a) * 50, t: 0.4, c: '#cfefff', g: 0 });
      }
      for (const e of near(60)) {
        e.frozen = 2.5;
        hitEnemy(sc, e, 0.6, 0, 0);
      }
      sc.sfx('magic');
      break;
    case 'rogue':
      p.dashT = 0.2;
      p.dashId = p.swing;
      p.inv = Math.max(p.inv, 0.35);
      sc.fx.ring(p.x, p.y - 6, 12, 0.25, '#ff6b8a');
      sc.sfx('dash');
      break;
    case 'spirit':
      s.hp = Math.min(maxHp(s), s.hp + 30);
      sc.fx.text(p.x, p.y - 22, '+30 HP', '#7fffb0');
      sc.fx.ring(p.x, p.y - 6, 52, 0.5, '#62f0d6');
      for (const e of near(52)) push(e, 1.2);
      sc.sfx('heal');
      break;
    default:
      p.spinT = 0.35;
      sc.fx.ring(p.x, p.y - 6, 32, 0.35, '#ffd34d');
      for (const e of near(32)) push(e, 1.6);
      sc.sfx('swing');
  }
}

/** 刺客影步期间的突进和穿刺 */
export function updateDash(sc: PlayScene, dt: number): void {
  const p = sc.player;
  p.dashT -= dt;
  sc.move(p, p.fx * 380 * dt, p.fy * 380 * dt, p.hw, p.hh);
  p.moving = true;
  for (const e of sc.enemies.slice()) {
    if (e.hitBy === p.dashId || !e.targetable) continue;
    if (Math.abs(e.x - p.x) < e.hw + 9 && Math.abs(e.y - p.y) < e.hh + 9) {
      e.hitBy = p.dashId;
      hitEnemy(sc, e, 1.5, p.fx, p.fy);
    }
  }
  sc.fx.spark(p.x + rnd(-3, 3), p.y - 6 + rnd(-5, 5), '#ff6b8a');
}

export function hitEnemy(sc: PlayScene, e: Enemy, mult: number, kx: number, ky: number): void {
  if (!sc.enemies.includes(e)) return;
  const s = sc.s;
  const crit = Math.random() < critChance(s);
  const dmg = Math.max(1, Math.round(atkStat(s) * mult * (crit ? 1.8 : 1) * e.damageMul * rnd(0.9, 1.1)));
  e.hp -= dmg;
  e.flash = 0.15;
  if (settings.damageNumbers) sc.fx.text(e.x, e.y - 16 - (e.boss ? 24 : 0), (crit ? '暴击 ' : '') + dmg, crit ? '#ffd34d' : '#fff');
  sc.sfx(crit ? 'crit' : 'hit');
  const kb = 170 * e.knock;
  e.kx = kx * kb;
  e.ky = ky * kb;
  if (e.hp <= 0) killEnemy(sc, e);
}

function giveItems(sc: PlayScene, items: Partial<Record<ItemId, number>>, x: number, y: number): void {
  let dy = 0;
  for (const [id, n] of Object.entries(items) as [ItemId, number][]) {
    addItem(sc.s, id, n);
    sc.fx.text(x, y - 20 - dy, `+${n} ${ITEMS[id].name}`, ITEMS[id].color);
    dy += 8;
  }
}

function killEnemy(sc: PlayScene, e: Enemy): void {
  const s = sc.s;
  sc.enemies.splice(sc.enemies.indexOf(e), 1);
  sc.sfx('kill');
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
    s.kills[mid] = (s.kills[mid] ?? 0) + 1;
    quests.onKill(s, mid);
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
  giveItems(sc, first ? def.firstDrops : def.repeatDrops, e.x, e.y - 10);
  if (first) s.bosses.push(id);
  quests.onBoss(s, id);
  sc.openBossExit();
  sc.setMusic();
  const face = id === 'slimeKing' ? monsterSprites.king[0] : undefined;
  sc.ui.dialog.say(def.name, def.defeat, { face });
  if (first) {
    const list = Object.entries(def.firstDrops).map(([k, n]) => `${ITEMS[k as ItemId].name}×${n}`).join('、');
    sc.ui.dialog.say('系统', `击败了${def.name}！获得 ${list}，以及 ${g} 金币。`);
    if (id === 'slimeKing') {
      sc.ui.dialog.say('系统', '王冠凝胶可以交给老岩打造金器。通往锈铁坑道的楼梯出现了。');
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
  const d = damageTaken(raw, defense(s));
  s.hp -= d;
  p.inv = 0.9;
  sc.shake(0.25);
  sc.sfx('hurt');
  sc.fx.text(p.x, p.y - 22, `-${d}`, '#ff6b6b');
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

export function updateShots(sc: PlayScene, dt: number): void {
  for (let i = sc.shots.length - 1; i >= 0; i--) {
    const sh = sc.shots[i];
    sh.t -= dt;
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    let dead = sh.t <= 0 || sc.map.solid(Math.floor(sh.x / TS), Math.floor((sh.y + 4) / TS)) || sc.map.get(Math.floor(sh.x / TS), Math.floor((sh.y + 4) / TS)) === Tile.ROCK;
    if (!dead) {
      for (const e of sc.enemies.slice()) {
        if (sh.hit.has(e) || !e.targetable) continue;
        if (Math.abs(e.x - sh.x) < e.hw + 3 && Math.abs(e.y - 6 - sh.y) < e.hh + 5) {
          sh.hit.add(e);
          const l = Math.hypot(sh.vx, sh.vy) || 1;
          hitEnemy(sc, e, 1, sh.vx / l, sh.vy / l);
          if (!sh.pierce) {
            dead = true;
            break;
          }
        }
      }
    }
    if (Math.random() < 0.6) sc.fx.spark(sh.x, sh.y, sh.color);
    if (dead) sc.shots.splice(i, 1);
  }
}

export const orbPos = (sc: PlayScene, i: number): [number, number] => {
  const a = sc.clock * 3 + i * Math.PI;
  return [sc.player.x + Math.cos(a) * 20, sc.player.y - 8 + Math.sin(a) * 12];
};

/** 萤灵使的两只萤灵：碰到敌人自动造成伤害 */
export function updateOrbs(sc: PlayScene, dt: number): void {
  if (sc.s.cls !== 'spirit') return;
  for (const e of sc.enemies.slice()) {
    if (!e.targetable) continue;
    e.orbCd -= dt;
    if (e.orbCd > 0) continue;
    for (let i = 0; i < 2; i++) {
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
