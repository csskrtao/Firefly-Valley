import { audio } from '../core/Audio';
import { VH, VW } from '../core/constants';
import type { Scene } from '../core/Game';
import { TAU, hash } from '../core/math';
import { unlocks } from '../core/settings';
import { SLOT_COUNT, slotKey, storage } from '../core/Storage';
import type { ClassDef, ClassId } from '../data/classes';
import { CLASSES, CLASS_IDS } from '../data/classes';
import { SKILLS } from '../data/skills';
import { defaultType, isRanged, weaponType } from '../data/weapons';
import type { SaveData } from '../state/save';
import { migrate, newSave } from '../state/save';
import { dateText } from '../systems/time';
import { renderHelp, renderSettings } from '../ui/common';
import { $, NavList, h } from '../ui/dom';
import type { App } from './App';

export function loadSlot(slot: number): SaveData | null {
  const s = migrate(storage.get(slotKey(slot)));
  if (s) s.slot = slot;
  return s;
}

const playTimeText = (sec: number): string => {
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分` : `${m} 分钟`;
};

interface Firefly { x: number; y: number; p: number; s: number }

/** 标题画面：画布上是夜晚的山谷，菜单是 DOM */
export class TitleScene implements Scene {
  private root = $('#title');
  private menu = $('#titleMenu');
  private nav = new NavList(this.menu);
  private back: (() => void) | null = null;
  private t = 0;
  private flies: Firefly[] = Array.from({ length: 36 }, (_, i) => ({ x: hash(i, 3) * VW, y: 150 + hash(i, 7) * 110, p: hash(i, 11) * TAU, s: 0.4 + hash(i, 13) * 0.8 }));
  private onPointer = (e: PointerEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]');
    if (!el) return;
    const i = this.nav.items().indexOf(el);
    if (i >= 0 && i !== this.nav.index) this.nav.reset(i);
  };

  constructor(private readonly app: App) {}

  enter(): void {
    this.root.hidden = false;
    this.menu.addEventListener('pointermove', this.onPointer);
    audio.music('title');
    this.showMain();
  }

  exit(): void {
    this.root.hidden = true;
    this.menu.removeEventListener('pointermove', this.onPointer);
    this.menu.innerHTML = '';
  }

  /* ---------- 菜单页 ---------- */

  private page(title: string | null, back: (() => void) | null, ...children: (Node | null)[]): void {
    this.back = back;
    this.menu.innerHTML = '';
    if (title) this.menu.append(h('h2', { text: title }));
    this.menu.append(...children.filter((c): c is Node => c !== null));
    if (back) this.menu.append(this.button('返回', back, undefined, 'ghost'));
    this.nav.reset(0);
  }

  private button(label: string, fn: () => void, note?: string, cls = ''): HTMLButtonElement {
    const b = h('button', { type: 'button', class: `menu-btn ${cls}`.trim(), 'data-nav': '' }, h('span', { text: label }), note ? h('small', { text: note }) : null);
    b.addEventListener('click', () => {
      audio.sfx('select');
      fn();
    });
    return b;
  }

  private latest(): SaveData | null {
    let best: SaveData | null = null;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const s = loadSlot(i);
      if (s && (!best || s.savedAt > best.savedAt)) best = s;
    }
    return best;
  }

  private summary(s: SaveData): string {
    return `${CLASSES[s.cls].name} · ${dateText(s.day)} · ${s.gold} 金 · 最深 ${s.deepest} 层 · ${playTimeText(s.playTime)}`;
  }

  private showMain(): void {
    const last = this.latest();
    const any = last !== null;
    this.page(null, null,
      h('div', { class: 'menu' },
        last ? this.button('继续游戏', () => this.app.play(last), this.summary(last)) : null,
        this.button('新游戏', () => this.showSlots('new')),
        any ? this.button('读取存档', () => this.showSlots('load')) : null,
        this.button('设置', () => this.page('设置', () => this.showMain(), this.panel(renderSettings))),
        this.button('操作说明', () => this.page('操作说明', () => this.showMain(), this.panel(renderHelp))),
      ),
    );
  }

  private panel(render: (body: HTMLElement) => void): HTMLElement {
    const body = h('div', { class: 'title-panel' });
    render(body);
    return body;
  }

  private showSlots(mode: 'new' | 'load'): void {
    const rows = h('div', { class: 'menu slots' });
    for (let i = 0; i < SLOT_COUNT; i++) {
      const s = loadSlot(i);
      const label = `存档 ${i + 1}`;
      if (mode === 'load') {
        if (!s) {
          rows.append(h('div', { class: 'menu-btn off' }, h('span', { text: label }), h('small', { text: '空' })));
          continue;
        }
        const row = h('div', { class: 'slot-row' }, this.button(label, () => this.app.play(s), this.summary(s)));
        const del = this.button('删除', () => {
          if (del.dataset.armed) {
            storage.remove(slotKey(i));
            this.showSlots('load');
            if (!this.latest()) this.showMain();
          } else {
            del.dataset.armed = '1';
            del.querySelector('span')!.textContent = '再按一次确认';
          }
        }, undefined, 'danger small');
        row.append(del);
        rows.append(row);
      } else {
        rows.append(this.button(label, () => (s ? this.confirmOverwrite(i, s) : this.showClasses(i)), s ? `覆盖：${this.summary(s)}` : '空存档'));
      }
    }
    this.page(mode === 'new' ? '选择存档位置' : '读取存档', () => this.showMain(), rows);
  }

  private confirmOverwrite(slot: number, s: SaveData): void {
    this.page('覆盖存档？', () => this.showSlots('new'),
      h('p', { class: 'muted', text: `存档 ${slot + 1}（${this.summary(s)}）会被新游戏替换，无法恢复。` }),
      h('div', { class: 'menu' }, this.button('覆盖并开始新游戏', () => this.showClasses(slot), undefined, 'danger')),
    );
  }

  private showClasses(slot: number): void {
    const grid = h('div', { class: 'classes' });
    for (const id of CLASS_IDS) {
      const C: ClassDef = CLASSES[id];
      const locked = C.secret && !unlocks.has('spirit');
      if (locked) {
        grid.append(h('div', { class: 'class-card locked' },
          h('b', { text: '？？？' }),
          h('small', { text: '隐藏职业' }),
          h('p', { text: '据说击败矿脉深处的守层者之后，会有什么东西找上门来……' }),
        ));
        continue;
      }
      const card = h('button', { type: 'button', class: `class-card cls-${id}`, 'data-nav': '' },
        h('b', { text: C.name }),
        h('small', { text: `${isRanged(weaponType(defaultType(id)).kind) ? '远程' : '近战'} · 生命 ${100 + C.hp} · 初始技能【${SKILLS[id][0].name}】` }),
        h('p', { text: C.desc }),
      );
      card.addEventListener('click', () => this.start(slot, id));
      grid.append(card);
    }
    this.page('选择职业', () => this.showSlots('new'), grid, h('p', { class: 'muted', text: '职业决定战斗方式和一部分农活加成，开局后不能更换。' }));
  }

  private start(slot: number, cls: ClassId): void {
    audio.sfx('levelup');
    const s = newSave(slot, cls);
    storage.set(slotKey(slot), s);
    this.app.play(s);
  }

  /* ---------- 每帧 ---------- */

  update(dt: number): void {
    this.t += dt;
    const input = this.app.game.input;
    if (input.pressed('pause') && this.back) {
      audio.sfx('blip');
      this.back();
      return;
    }
    this.nav.handle(input);
  }

  render(): void {
    const r = this.app.game.renderer;
    const b = r.b;
    const t = this.t;
    const sky = b.createLinearGradient(0, 0, 0, VH);
    sky.addColorStop(0, '#0d0b22');
    sky.addColorStop(0.55, '#2a1f4a');
    sky.addColorStop(1, '#3d2a52');
    b.fillStyle = sky;
    b.fillRect(0, 0, VW, VH);

    for (let i = 0; i < 70; i++) {
      const x = Math.floor(hash(i, 1) * VW);
      const y = Math.floor(hash(i, 2) * 150);
      const tw = 0.5 + 0.5 * Math.sin(t * (1 + hash(i, 5) * 2) + i);
      b.fillStyle = `rgba(255,248,220,${0.25 + tw * 0.6})`;
      b.fillRect(x, y, 1, 1);
    }
    b.fillStyle = '#f4ecd8';
    b.beginPath();
    b.arc(392, 52, 14, 0, TAU);
    b.fill();
    b.fillStyle = '#2a1f4a';
    b.beginPath();
    b.arc(386, 48, 12, 0, TAU);
    b.fill();

    // 远山和近山
    const hills = (base: number, amp: number, freq: number, color: string, shift: number) => {
      b.fillStyle = color;
      b.beginPath();
      b.moveTo(0, VH);
      for (let x = 0; x <= VW; x += 4) b.lineTo(x, base + Math.sin(x * freq + shift) * amp + Math.sin(x * freq * 2.7 + shift) * amp * 0.35);
      b.lineTo(VW, VH);
      b.fill();
    };
    hills(170, 18, 0.012, '#241c3c', 1);
    hills(195, 12, 0.02, '#1a1530', 4);

    // 农舍剪影和亮着的窗户
    const glow = b.createRadialGradient(92, 198, 4, 92, 198, 46);
    glow.addColorStop(0, 'rgba(255,217,138,.22)');
    glow.addColorStop(1, 'rgba(255,217,138,0)');
    b.fillStyle = glow;
    b.fillRect(40, 150, 104, 96);
    b.fillStyle = '#120f22';
    b.fillRect(70, 186, 44, 26);
    b.beginPath();
    b.moveTo(64, 188);
    b.lineTo(92, 166);
    b.lineTo(120, 188);
    b.fill();
    b.fillRect(102, 168, 6, 12);
    b.fillStyle = '#ffd98a';
    b.fillRect(80, 194, 8, 7);
    b.fillRect(98, 194, 8, 7);

    // 田垄
    b.fillStyle = '#100d1c';
    b.fillRect(0, 212, VW, VH - 212);
    b.fillStyle = '#1b1530';
    for (let y = 218; y < VH; y += 9) b.fillRect(0, y, VW, 2);

    for (const f of this.flies) {
      const x = (f.x + Math.sin(t * f.s + f.p) * 18 + t * 6 * f.s) % VW;
      const y = f.y + Math.cos(t * f.s * 1.3 + f.p) * 10;
      const glow = 0.5 + 0.5 * Math.sin(t * 3 * f.s + f.p);
      b.fillStyle = `rgba(98,240,214,${0.12 * glow})`;
      b.fillRect(Math.round(x) - 3, Math.round(y) - 3, 7, 7);
      b.fillStyle = `rgba(200,255,244,${0.35 + 0.65 * glow})`;
      b.fillRect(Math.round(x), Math.round(y), 1 + Math.round(glow), 1 + Math.round(glow));
    }
    r.present();
  }
}
