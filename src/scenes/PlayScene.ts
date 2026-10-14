import type { Sfx, Track } from '../core/Audio';
import { audio } from '../core/Audio';
import { Camera } from '../core/Camera';
import { DAY_END, DAY_START, MINUTES_PER_SECOND, TS } from '../core/constants';
import type { Scene } from '../core/Game';
import { settings } from '../core/settings';
import { slotKey, storage } from '../core/Storage';
import { floorName, MAX_FLOOR } from '../data/floors';
import { BUFF_TEXT, ITEMS } from '../data/items';
import type { MonsterId } from '../data/monsters';
import { BOSSES } from '../data/monsters';
import type { NpcId } from '../data/npcs';
import { NPC_IDS } from '../data/npcs';
import { SlimeKing, IronJaw } from '../entities/bosses';
import type { Box, Enemy, EnemyHost, Hazard } from '../entities/Enemy';
import { Monster } from '../entities/Monster';
import { Npc } from '../entities/Npc';
import { Ore } from '../entities/Ore';
import { Player } from '../entities/Player';
import type { Img } from '../gfx/sprite';
import { npcChars } from '../gfx/people';
import { monsterSprites } from '../gfx/sprites';
import { itemIcon, toolIcons } from '../gfx/tiles';
import type { SaveData } from '../state/save';
import { count, seasonOf } from '../state/save';
import { advanceDay } from '../systems/farming';
import * as quests from '../systems/quests';
import { spawnForage } from '../systems/forage';
import { xpToNext } from '../systems/level';
import { classOf, maxHp, moveSpeed, regenRate } from '../systems/stats';
import { SKILLS } from '../data/skills';
import { clockText, dateText } from '../systems/time';
import type { HudSlot } from '../ui/Hud';
import type { FloorLayout } from '../world/mineGen';
import { generateFloor } from '../world/mineGen';
import type { Overworld } from '../world/overworld';
import { buildOverworld } from '../world/overworld';
import type { TileMap } from '../world/TileMap';
import { Tile } from '../world/TileMap';
import type { App } from './App';
import { currentSeed, heal, interact, pickupForage, selectSlot, useTool } from './play/actions';
import type { Shot, Strike } from './play/combat';
import * as combat from './play/combat';
import { Fx } from './play/fx';
import { openInventory, openPause } from './play/menus';
import { renderPlay } from './play/render';

export type Mode = 'town' | 'mine';

export interface Chest {
  tx: number;
  ty: number;
  open: boolean;
}

/** 走路速度（像素/秒），按住 Shift 或把摇杆推到底时乘以 RUN_MUL */
const WALK_SPEED = 76;
const RUN_MUL = 1.45;
/** 拐角修正最多挪几个像素 */
const CORNER_NUDGE = 7;

const SLOT_ACTIONS = ['slot0', 'slot1', 'slot2', 'slot3', 'slot4'] as const;
const WEATHER_NAME = { sunny: '晴', rain: '雨', snow: '雪' } as const;
const SEASON_GREETING = [
  '春天来了。萝卜和光莓都可以种了，去杂货店看看吧。',
  '夏天到了！火椒和星瓜喜欢阳光。春天的作物已经熬不过换季了。',
  '秋天到了。铁根薯和月南瓜正当季，夏天的作物都枯萎了。',
  '冬天到了，地里什么都长不了。正好专心下矿，把装备打好。',
];

/** 游戏本体：地表小镇和矿脉都在这个场景里，靠 mode 区分 */
export class PlayScene implements Scene, EnemyHost {
  readonly player = new Player();
  readonly camera = new Camera();
  readonly fx = new Fx();
  readonly overworld: Overworld = buildOverworld();
  mode: Mode = 'town';
  floor = 0;
  map: TileMap = this.overworld.map;
  layout: FloorLayout | null = null;
  npcs: Npc[] = [];
  enemies: Enemy[] = [];
  ores: Ore[] = [];
  shots: Shot[] = [];
  strikes: Strike[] = [];
  chests: Chest[] = [];
  hazards: Hazard[] = [];
  crystals: [number, number][] = [];
  /** 场景内累计时间，驱动各种动画 */
  clock = 0;
  /** 进入新楼层时屏幕中央的楼层名，剩余显示时间 */
  floorBanner = 0;
  private pendingIntro: { who: string; text: string; face?: Img } | null = null;
  private lastTile = '';
  private collapsing = false;

  constructor(private readonly app: App, public s: SaveData) {}

  get game() { return this.app.game; }
  get ui() { return this.app.ui; }
  get maxHp(): number { return maxHp(this.s); }
  get mapW(): number { return this.map.w * TS; }
  get mapH(): number { return this.map.h * TS; }

  /* ---------- 场景生命周期 ---------- */

  enter(): void {
    this.app.hud.show(true);
    this.app.hud.onSlot = (i) => {
      if (!this.ui.modal) selectSlot(this, i);
    };
    this.applySettings();
    this.s.hp = Math.min(this.s.hp, this.maxHp);
    if (this.s.forageDay !== this.s.day) spawnForage(this.s, this.overworld.forage);
    this.enterTown(this.overworld.spawns.home, 1);
    if (this.s.playTime === 0) {
      const face = this.npcFace('owl');
      this.ui.dialog.say('猫头鹰·咕咕', `咕！你就是那位${classOf(this.s).name}吧？你祖母把这片农场和南边的老矿脉都留给了你。`, { face });
      this.ui.dialog.say('猫头鹰·咕咕', '先在围栏里锄地、种下萝卜，每天浇水。矿脉里挖到的矿石交给铁匠老岩，就能打造更好的装备。', { face });
      this.ui.dialog.say('猫头鹰·咕咕', '不知道怎么操作就按 Esc 看说明。还有，凌晨两点前一定要回家睡觉，咕。', { face });
    } else {
      this.toast(`欢迎回来。${dateText(this.s.day)}`);
    }
  }

  exit(): void {
    this.app.hud.show(false);
    this.app.hud.onSlot = null;
    this.ui.closeAll();
  }

  /* ---------- 每帧逻辑 ---------- */

  update(dt: number): void {
    const input = this.game.input;
    this.clock += dt;
    this.fx.update(dt);
    this.camera.update(dt);
    this.floorBanner = Math.max(0, this.floorBanner - dt);
    for (const o of this.ores) o.shake = Math.max(0, o.shake - dt);

    // 关掉对话框的那一下按键不能再触发一次交互，所以先记下这一帧开始时是否有弹窗
    const wasModal = this.ui.modal;
    this.ui.update(dt, input);
    this.updateHud();
    if (this.s.mailed) {
      this.s.mailed = 0;
      this.toast('背包满了，多出来的东西送回了家里的仓库箱');
    }
    if (wasModal || this.ui.modal || this.ui.fade.busy) return;
    if (this.pendingIntro) {
      const { who, text, face } = this.pendingIntro;
      this.pendingIntro = null;
      this.ui.dialog.say(who, text, { face });
      return;
    }

    if (input.pressed('pause')) return openPause(this);
    if (input.pressed('inventory')) return openInventory(this);

    const s = this.s;
    s.playTime += dt;
    s.time += dt * MINUTES_PER_SECOND;
    if (s.time >= DAY_END) {
      this.collapse('late');
      return;
    }
    this.setMusic();

    this.updatePlayer(dt);
    const regen = regenRate(s);
    if (regen > 0 && s.hp > 0) s.hp = Math.min(this.maxHp, s.hp + regen * dt);
    if (this.mode === 'town') {
      const [px, py] = this.player.tile();
      const canWalk = (tx: number, ty: number) => !this.map.solid(tx, ty) && !(tx === px && ty === py);
      for (const n of this.npcs) n.update(dt, s.time, this.map, canWalk, this.player);
      pickupForage(this);
    } else {
      for (const e of this.enemies.slice()) e.update(this, dt);
      combat.updateCombat(this, dt);
      combat.updateShots(this, dt);
      combat.updateOrbs(this, dt);
      combat.updateHazards(this, dt);
    }
  }

  private updatePlayer(dt: number): void {
    const input = this.game.input;
    const p = this.player;
    const s = this.s;
    p.tick(dt);

    // 方向输入：触屏摇杆是模拟量，键盘是八方向
    let mx = 0;
    let my = 0;
    const stick = input.stick;
    if (stick.active) {
      mx = stick.x;
      my = stick.y;
    } else {
      if (input.held('left')) mx--;
      if (input.held('right')) mx++;
      if (input.held('up')) my--;
      if (input.held('down')) my++;
      const l = Math.hypot(mx, my);
      if (l) {
        mx /= l;
        my /= l;
      }
    }
    const mag = Math.min(1, Math.hypot(mx, my));
    if (mag > 0.2) this.faceToward(mx, my);

    if (p.dashT > 0) combat.updateDash(this, dt);
    else {
      const tired = s.en <= 0 ? 0.7 : 1;
      p.running = (input.held('run') || (stick.active && mag > 0.9)) && s.en > 0;
      const sp = WALK_SPEED * moveSpeed(s) * tired * (p.atkT > 0 ? 0.45 : 1) * (p.running ? RUN_MUL : 1);
      // 平滑加减速：起步约 0.1 秒到全速，松手很快停下
      const k = 1 - Math.exp(-dt * (mag > 0.2 ? 20 : 26));
      p.vx += (mx * sp - p.vx) * k;
      p.vy += (my * sp - p.vy) * k;
      if (Math.abs(p.vx) < 1 && !mx) p.vx = 0;
      if (Math.abs(p.vy) < 1 && !my) p.vy = 0;
      const before = Math.floor(p.walk);
      const ox = p.x;
      const oy = p.y;
      this.movePlayer(p.vx * dt + p.kx * dt, p.vy * dt + p.ky * dt, mx, my);
      const moved = Math.hypot(p.x - ox, p.y - oy);
      p.moving = mag > 0.2 && moved > 0.05;
      if (p.moving) p.walk += moved / 7;
      else p.walk = 0;
      const now = Math.floor(p.walk);
      // 每迈一步：轻轻的脚步声，跑起来还会扬起尘土
      if (now !== before && now % 2 === 1) this.footstep();
    }
    SLOT_ACTIONS.forEach((a, i) => {
      if (input.pressed(a)) selectSlot(this, i);
    });
    if (input.pressed('cycle')) selectSlot(this, (s.tool + 1) % 4);
    if (input.pressed('heal')) heal(this);
    if (input.pressed('attack') || input.held('attack')) combat.attack(this);
    (['skill', 'skill2', 'skill3'] as const).forEach((a, i) => {
      if (!input.pressed(a)) return;
      if (this.mode === 'town') this.toast('技能留到矿脉里再用吧');
      else combat.useSkill(this, i);
    });
    if (input.pressed('tool')) useTool(this);
    if (input.pressed('interact')) interact(this);

    // 第一次站上楼梯时提示一下
    const [ux, uy] = p.tile();
    const key = `${this.mode}${this.floor}:${ux},${uy}`;
    if (key !== this.lastTile) {
      this.lastTile = key;
      const t = this.map.get(ux, uy);
      if (t === Tile.STAIRS) this.toast(`按 E 下到第 ${this.floor + 1} 层`);
      else if (t === Tile.LADDER) this.toast('按 E 爬回地面');
    }
  }

  /** 斜着走时保持原来的朝向，只有另一个方向明显占优才转身，避免面前的格子来回跳 */
  private faceToward(mx: number, my: number): void {
    const p = this.player;
    const ax = Math.abs(mx);
    const ay = Math.abs(my);
    const sx = Math.sign(mx);
    const sy = Math.sign(my);
    const keep = (p.fx !== 0 && p.fx === sx && ax >= ay * 0.5) || (p.fy !== 0 && p.fy === sy && ay >= ax * 0.5);
    if (keep) return;
    if (ax >= ay) p.face(sx, 0);
    else p.face(0, sy);
  }

  /** 玩家的移动：分轴碰撞，再加上拐角修正——只朝一个方向走时，差几个像素就能对上通道的话自动挪过去 */
  private movePlayer(dx: number, dy: number, mx: number, my: number): void {
    const p = this.player;
    const blockedX = dx !== 0 && !this.boxFree(p.x + dx, p.y, p.hw, p.hh);
    const blockedY = dy !== 0 && !this.boxFree(p.x, p.y + dy, p.hw, p.hh);
    this.move(p, dx, dy, p.hw, p.hh);
    if (blockedX) p.vx = 0;
    if (blockedY) p.vy = 0;
    const push = Math.max(Math.abs(dx), Math.abs(dy), 0.6);
    const nudge = (along: 'x' | 'y', d: number) => {
      for (let k = 1; k <= CORNER_NUDGE; k++) {
        for (const sgn of [-1, 1]) {
          const tx = along === 'x' ? p.x + d : p.x + sgn * k;
          const ty = along === 'x' ? p.y + sgn * k : p.y + d;
          if (!this.boxFree(tx, ty, p.hw, p.hh)) continue;
          const step = sgn * Math.min(k, push);
          if (along === 'x' && this.boxFree(p.x, p.y + step, p.hw, p.hh)) p.y += step;
          else if (along === 'y' && this.boxFree(p.x + step, p.y, p.hw, p.hh)) p.x += step;
          return;
        }
      }
    };
    if (blockedX && Math.abs(my) < 0.2) nudge('x', Math.sign(dx) * push);
    if (blockedY && Math.abs(mx) < 0.2) nudge('y', Math.sign(dy) * push);
  }

  private footstep(): void {
    const p = this.player;
    audio.sfx('step');
    if (!p.running) return;
    const [tx, ty] = p.tile();
    const t = this.map.get(tx, ty);
    const winter = seasonOf(this.s.day) === 3 && this.mode === 'town';
    const color = this.mode === 'mine' ? '#6b5f58' : winter ? '#eef4f8' : t === Tile.PATH || t === Tile.SAND ? '#d9bb83' : '#9fc77a';
    for (let i = 0; i < 3; i++) {
      this.fx.particles.push({ x: p.x + (Math.random() - 0.5) * 6, y: p.y + 2, vx: -p.vx * 0.15 + (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 12, t: 0.35, c: color, g: 60 });
    }
  }

  private updateHud(): void {
    const s = this.s;
    const seed = currentSeed(this);
    const slots: HudSlot[] = [
      { icon: toolIcons.hoe, label: '锄头' },
      { icon: toolIcons.water, label: '水壶' },
      seed ? { icon: itemIcon(seed), label: ITEMS[seed].name, count: count(s, seed) } : { icon: toolIcons.seeds, label: '种子（没有了）', count: 0 },
      { icon: toolIcons.pick, label: '镐' },
      { icon: toolIcons.food, label: '回复（药水 / 作物）', count: count(s, 'potion') + count(s, 'bigPotion') },
    ];
    const boss = this.enemies.find((e) => e.boss);
    const q = quests.currentQuest(s);
    let quest: string | null = null;
    if (q && s.quest.active) {
      const pr = quests.progressOf(s);
      quest = quests.isComplete(s) ? `委托「${q.title}」完成，回公会交付` : `委托「${q.title}」${pr.have}/${pr.need}`;
    }
    this.app.hud.update({
      hp: s.hp,
      maxHp: this.maxHp,
      en: s.en,
      date: dateText(s.day),
      clock: clockText(s.time),
      weather: WEATHER_NAME[s.weather],
      gold: s.gold,
      where: this.mode === 'town' ? '萤石谷' : `矿脉 ${this.floor}F · ${floorName(this.floor)}`,
      level: s.level,
      xp: s.xp,
      xpNext: s.level >= 20 ? 0 : xpToNext(s.level),
      skills: SKILLS[s.cls].map((k, i) => ({ name: k.name, key: ['L', 'U', 'O'][i], cd: this.player.skillCds[i], max: k.cooldown, need: s.level < k.level ? k.level : null })),
      buffs: this.buffLabels(),
      slots,
      selected: s.tool,
      quest,
      boss: boss ? { name: boss.name, hp: boss.hp, max: boss.maxHp } : null,
    });
  }

  /** HUD 上显示的增益：料理效果和战斗中的临时技能效果 */
  private buffLabels(): string[] {
    const s = this.s;
    const p = this.player;
    const out: string[] = [];
    if (s.buff && s.time < s.buff.until) out.push(`${ITEMS[s.buff.from].name}：${BUFF_TEXT[s.buff.stat](s.buff.value)} 到 ${clockText(s.buff.until)}`);
    if (p.rageT > 0) out.push(`战吼 ${Math.ceil(p.rageT)}s`);
    if (p.venomT > 0) out.push(`毒刃 ${Math.ceil(p.venomT)}s`);
    if (p.swarmT > 0) out.push(`萤灵增殖 ${Math.ceil(p.swarmT)}s`);
    return out;
  }

  render(): void {
    renderPlay(this);
  }

  /* ---------- 碰撞（也提供给敌人使用） ---------- */

  private blocked(tx: number, ty: number, fly: boolean): boolean {
    if (fly) return this.map.get(tx, ty) === Tile.ROCK;
    if (this.map.solid(tx, ty)) return true;
    if (this.mode === 'mine') return this.ores.some((o) => o.tx === tx && o.ty === ty) || this.chests.some((c) => c.tx === tx && c.ty === ty);
    return this.npcs.some((n) => n.tile[0] === tx && n.tile[1] === ty);
  }

  boxFree(x: number, y: number, hw: number, hh: number, fly = false): boolean {
    const x0 = Math.floor((x - hw) / TS);
    const x1 = Math.floor((x + hw - 0.01) / TS);
    const y0 = Math.floor((y - hh) / TS);
    const y1 = Math.floor((y + hh - 0.01) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.blocked(tx, ty, fly)) return false;
    return true;
  }

  /** 分轴移动，可以贴着墙滑。返回 false 表示有一个方向被挡住了 */
  move(e: Box, dx: number, dy: number, hw: number, hh: number, fly = false): boolean {
    let ok = true;
    if (dx) {
      if (this.boxFree(e.x + dx, e.y, hw, hh, fly)) e.x += dx;
      else ok = false;
    }
    if (dy) {
      if (this.boxFree(e.x, e.y + dy, hw, hh, fly)) e.y += dy;
      else ok = false;
    }
    return ok;
  }

  /* ---------- EnemyHost ---------- */

  hurtPlayer(raw: number, sx: number, sy: number): void {
    combat.hurtPlayer(this, raw, sx, sy);
  }

  spawnMonster(id: MonsterId, x: number, y: number): void {
    const m = new Monster(id, x, y, this.floor);
    if (!this.boxFree(x, y, m.hw, m.hh)) {
      // 生成点在墙里时退回到 Boss 脚下
      const boss = this.enemies.find((e) => e.boss);
      if (!boss) return;
      m.x = boss.x;
      m.y = boss.y;
    }
    m.frozen = 0.4;
    this.enemies.push(m);
    this.fx.burst(m.x, m.y - 4, m.def.color, 6, 40);
  }

  countMonsters(id: MonsterId): number {
    return this.enemies.filter((e) => e.mid === id).length;
  }

  addHazard(h: Hazard): void {
    this.hazards.push(h);
  }

  burst(x: number, y: number, color: string, n?: number, speed?: number): void {
    this.fx.burst(x, y, color, n, speed);
  }

  ring(x: number, y: number, r: number, t: number, color: string): void {
    this.fx.ring(x, y, r, t, color);
  }

  shake(t: number, mag?: number): void {
    this.camera.shake(t, mag);
  }

  sfx(name: Sfx): void {
    audio.sfx(name);
  }

  toast(msg: string): void {
    this.ui.toast.show(msg);
  }

  /* ---------- 地图切换 ---------- */

  npcFace(id: NpcId): Img {
    return npcChars[id].portrait;
  }

  private resetWorld(): void {
    this.enemies = [];
    this.ores = [];
    this.shots = [];
    this.strikes = [];
    this.chests = [];
    this.hazards = [];
    this.crystals = [];
    this.npcs = [];
    this.fx.clear();
    this.player.inv = 0;
    this.player.dashT = 0;
  }

  private enterTown(spawn: [number, number], fy: number): void {
    this.resetWorld();
    this.mode = 'town';
    this.floor = 0;
    this.layout = null;
    this.map = this.overworld.map;
    this.npcs = NPC_IDS.map((id) => new Npc(id, this.s.time));
    this.player.place(spawn[0], spawn[1]);
    this.player.face(0, fy);
    this.setMusic();
  }

  goToFloor(n: number): void {
    const target = Math.max(1, Math.min(MAX_FLOOR, n));
    this.ui.fade.run(`矿脉 第 ${target} 层`, () => this.loadFloor(target));
  }

  private loadFloor(n: number): void {
    const s = this.s;
    const L = generateFloor(n);
    this.resetWorld();
    this.mode = 'mine';
    this.floor = n;
    this.layout = L;
    this.map = L.map;
    this.ores = L.ores.map((o) => new Ore(o.tx, o.ty, o.item));
    this.enemies = L.monsters.map((m) => new Monster(m.id, m.tx * TS + 8, m.ty * TS + 10, n));
    this.crystals = L.crystals;
    this.chests = L.chests.map(([tx, ty]) => ({ tx, ty, open: false }));
    this.player.place(L.spawn[0], L.spawn[1]);
    this.player.face(0, 1);
    this.floorBanner = 2.5;
    s.deepest = Math.max(s.deepest, n);
    if (L.boss) {
      const x = L.boss.tx * TS + 8;
      const y = L.boss.ty * TS + 10;
      this.enemies.push(L.boss.id === 'slimeKing' ? new SlimeKing(x, y) : new IronJaw(x, y));
      const def = BOSSES[L.boss.id];
      const rematch = s.bosses.includes(L.boss.id);
      this.pendingIntro = { who: def.name, text: rematch ? def.rematch : def.intro, face: L.boss.id === 'slimeKing' ? monsterSprites.king[0] : undefined };
    }
    this.setMusic();
  }

  /** Boss 倒下后打开通往下一层的楼梯 */
  openBossExit(): void {
    const ex = this.layout?.bossExit;
    if (!ex || this.floor >= MAX_FLOOR) return;
    this.map.set(ex[0], ex[1], Tile.STAIRS);
    this.fx.burst(ex[0] * TS + 8, ex[1] * TS + 8, '#62f0d6', 24, 70);
    this.fx.ring(ex[0] * TS + 8, ex[1] * TS + 8, 30, 0.6, '#62f0d6');
  }

  exitMine(): void {
    this.ui.fade.run('回到地面', () => this.enterTown(this.overworld.spawns.mine, -1));
  }

  setMusic(): void {
    let track: Track;
    if (this.mode === 'mine') track = this.enemies.some((e) => e.boss) ? 'boss' : 'mine';
    else track = this.s.time >= 19 * 60 ? 'night' : 'farm';
    audio.music(track);
  }

  /* ---------- 一天的结束 ---------- */

  sleep(): void {
    const late = this.s.time >= 24 * 60;
    this.ui.fade.run(dateText(this.s.day + 1), () => {
      const msgs = this.newDay();
      if (late) {
        this.s.en = 70;
        msgs.unshift('熬夜了，体力只恢复了一部分。');
      }
      this.morning(msgs);
    }, 1100);
  }

  faint(): void {
    this.collapse('faint');
  }

  /** 在矿里倒下或者熬过凌晨两点：被送回家，损失一成金币 */
  private collapse(reason: 'faint' | 'late'): void {
    if (this.collapsing) return;
    this.collapsing = true;
    this.ui.closeAll();
    const lost = Math.floor(this.s.gold * 0.1);
    this.s.gold -= lost;
    this.ui.fade.run(reason === 'late' ? '凌晨 2:00……' : '', () => {
      const msgs = this.newDay();
      this.s.hp = Math.round(this.maxHp * 0.6);
      this.s.en = 60;
      const face = this.npcFace('owl');
      const text = reason === 'late'
        ? `你在外面睡着了。我把你拖回了家，收了 ${lost} 金币当运费，咕。`
        : `你在矿里晕倒了，莉娅和我把你抬了回来。诊费 ${lost} 金币，咕。`;
      this.ui.dialog.say('猫头鹰·咕咕', text, { face });
      this.morning(msgs);
      this.collapsing = false;
    }, 900);
  }

  /** 推进到新的一天并存档，返回早上要告诉玩家的消息 */
  private newDay(): string[] {
    const s = this.s;
    const prevSeason = seasonOf(s.day);
    const withered = advanceDay(s);
    s.time = DAY_START;
    s.en = 100;
    s.buff = null;
    s.hp = this.maxHp;
    spawnForage(s, this.overworld.forage);
    this.enterTown(this.overworld.spawns.home, 1);
    const msgs: string[] = [];
    if (seasonOf(s.day) !== prevSeason) msgs.push(SEASON_GREETING[seasonOf(s.day)]);
    if (withered) msgs.push(`换季了，${withered} 株过季的作物枯萎了。`);
    if (s.weather === 'rain') msgs.push('外面在下雨，田里的作物都被浇透了。');
    else if (s.weather === 'snow') msgs.push('下雪了，整个山谷白茫茫的。');
    if (!this.saveGame()) msgs.push('存档失败：浏览器不允许保存数据。');
    return msgs;
  }

  private morning(msgs: string[]): void {
    if (!msgs.length) {
      this.toast('新的一天开始了，已自动存档');
      return;
    }
    for (const m of msgs) this.ui.dialog.say('新的一天', m);
  }

  /* ---------- 存档与设置 ---------- */

  saveGame(): boolean {
    this.s.savedAt = Date.now();
    return storage.set(slotKey(this.s.slot), this.s);
  }

  autosave(): void {
    this.saveGame();
  }

  applySettings(): void {
    this.camera.enabledShake = settings.shake;
  }

  quit(): void {
    this.app.toTitle();
  }
}
