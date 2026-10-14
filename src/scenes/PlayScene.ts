import type { Sfx, Track } from '../core/Audio';
import { audio } from '../core/Audio';
import { Camera } from '../core/Camera';
import { DAY_END, DAY_START, MINUTES_PER_SECOND, TS } from '../core/constants';
import type { Scene } from '../core/Game';
import { settings } from '../core/settings';
import { slotKey, storage } from '../core/Storage';
import { floorName, MAX_FLOOR } from '../data/floors';
import { ITEMS } from '../data/items';
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
import { monsterSprites, npcSprites } from '../gfx/sprites';
import { itemIcon, toolIcons } from '../gfx/tiles';
import type { SaveData } from '../state/save';
import { count, seasonOf } from '../state/save';
import { advanceDay } from '../systems/farming';
import * as quests from '../systems/quests';
import { classOf, maxHp } from '../systems/stats';
import { clockText, dateText } from '../systems/time';
import type { HudSlot } from '../ui/Hud';
import type { FloorLayout } from '../world/mineGen';
import { generateFloor } from '../world/mineGen';
import type { Overworld } from '../world/overworld';
import { buildOverworld } from '../world/overworld';
import type { TileMap } from '../world/TileMap';
import { Tile } from '../world/TileMap';
import type { App } from './App';
import { currentSeed, heal, interact, selectSlot, useTool } from './play/actions';
import type { Shot } from './play/combat';
import * as combat from './play/combat';
import { Fx } from './play/fx';
import { openInventory, openPause } from './play/menus';
import { renderPlay } from './play/render';

export type Mode = 'town' | 'mine';

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
    if (this.mode === 'town') {
      const canStand = (tx: number, ty: number) => !this.map.solid(tx, ty) && !(tx === this.player.tile()[0] && ty === this.player.tile()[1]);
      for (const n of this.npcs) n.update(dt, canStand);
    } else {
      for (const e of this.enemies.slice()) e.update(this, dt);
      combat.updateShots(this, dt);
      combat.updateOrbs(this, dt);
      combat.updateHazards(this, dt);
    }
  }

  private updatePlayer(dt: number): void {
    const input = this.game.input;
    const p = this.player;
    const s = this.s;
    const C = classOf(s);
    p.tick(dt);

    let mx = 0;
    let my = 0;
    if (input.held('left')) mx--;
    if (input.held('right')) mx++;
    if (input.held('up')) my--;
    if (input.held('down')) my++;
    // 斜着走时优先朝左右，面前的格子才不会是斜角
    if (mx) p.face(mx, 0);
    else if (my) p.face(0, my);

    if (p.dashT > 0) combat.updateDash(this, dt);
    else {
      const l = Math.hypot(mx, my) || 1;
      const tired = s.en <= 0 ? 0.7 : 1;
      const sp = 72 * C.speed * tired * (p.atkT > 0 ? 0.45 : 1);
      p.moving = !!(mx || my);
      if (p.moving) p.walk += dt * 8 * C.speed;
      this.move(p, (mx / l) * sp * dt + p.kx * dt, (my / l) * sp * dt + p.ky * dt, p.hw, p.hh);
    }

    SLOT_ACTIONS.forEach((a, i) => {
      if (input.pressed(a)) selectSlot(this, i);
    });
    if (input.pressed('cycle')) selectSlot(this, (s.tool + 1) % 4);
    if (input.pressed('heal')) heal(this);
    if (input.pressed('attack') || input.held('attack')) combat.attack(this);
    if (input.pressed('skill')) {
      if (this.mode === 'town') this.toast('技能留到矿脉里再用吧');
      else combat.useSkill(this);
    }
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

  private updateHud(): void {
    const s = this.s;
    const C = classOf(s);
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
      cls: C.name,
      skill: C.skill.name,
      skillCd: this.player.skillCd,
      slots,
      selected: s.tool,
      quest,
      boss: boss ? { name: boss.name, hp: boss.hp, max: boss.maxHp } : null,
    });
  }

  render(): void {
    renderPlay(this);
  }

  /* ---------- 碰撞（也提供给敌人使用） ---------- */

  private blocked(tx: number, ty: number, fly: boolean): boolean {
    if (fly) return this.map.get(tx, ty) === Tile.ROCK;
    if (this.map.solid(tx, ty)) return true;
    if (this.mode === 'mine') return this.ores.some((o) => o.tx === tx && o.ty === ty);
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
    return npcSprites[id];
  }

  private resetWorld(): void {
    this.enemies = [];
    this.ores = [];
    this.shots = [];
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
    this.npcs = NPC_IDS.map((id) => new Npc(id));
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
    s.hp = this.maxHp;
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
