import { audio } from '../core/Audio';
import type { Input } from '../core/Input';
import type { Img } from '../gfx/sprite';
import { iconUrl } from '../gfx/tiles';
import { $, NavList, h } from './dom';

export interface Choice {
  label: string;
  disabled?: boolean;
  /** 选项下方的小字说明 */
  note?: string;
  onSelect?: () => void;
}

interface DialogEntry {
  who: string;
  text: string;
  face?: Img;
  choices?: Choice[];
}

/** 底部对话框，支持排队和选项 */
class Dialog {
  private el = $('#dialog');
  private face = $<HTMLCanvasElement>('#dlgFace');
  private faceCtx = this.face.getContext('2d')!;
  private who = $('#dlgWho');
  private txt = $('#dlgText');
  private choicesEl = $('#dlgChoices');
  private hint = $('#dlgHint');
  private queue: DialogEntry[] = [];
  private cur: DialogEntry | null = null;
  private nav = new NavList(this.choicesEl);
  private shown = 0;
  private typing = 0;

  constructor() {
    this.faceCtx.imageSmoothingEnabled = false;
    this.nav.bindHover();
    this.el.addEventListener('click', (e) => {
      if (this.cur && !this.cur.choices && !(e.target as HTMLElement).closest('button')) this.advance();
    });
  }

  get open(): boolean {
    return this.cur !== null;
  }

  say(who: string, text: string, opts: { face?: Img; choices?: Choice[] } = {}): void {
    this.queue.push({ who, text, ...opts });
    if (!this.cur) this.next();
  }

  /** 清空队列并关闭 */
  close(): void {
    this.queue = [];
    this.cur = null;
    this.el.hidden = true;
  }

  private next(): void {
    this.cur = this.queue.shift() ?? null;
    if (!this.cur) {
      this.el.hidden = true;
      return;
    }
    const c = this.cur;
    this.el.hidden = false;
    this.who.textContent = c.who;
    this.txt.textContent = '';
    this.shown = 0;
    this.typing = 0;
    this.face.hidden = !c.face;
    this.faceCtx.clearRect(0, 0, 16, 16);
    if (c.face) this.faceCtx.drawImage(c.face, 0, 0);
    this.choicesEl.innerHTML = '';
    if (c.choices) {
      for (const ch of c.choices) {
        const bt = h('button', { type: 'button', 'data-nav': '' }, h('span', { text: ch.label }), ch.note ? h('small', { text: ch.note }) : null);
        if (ch.disabled) bt.classList.add('off');
        bt.addEventListener('click', () => this.choose(ch));
        this.choicesEl.append(bt);
      }
      this.hint.textContent = '↑↓ 选择 · E 确认 · Esc 关闭';
    } else {
      this.hint.textContent = '按 E / 空格 继续';
    }
    this.choicesEl.hidden = true;
  }

  private finishTyping(): void {
    if (!this.cur) return;
    this.shown = this.cur.text.length;
    this.txt.textContent = this.cur.text;
    if (this.cur.choices) {
      this.choicesEl.hidden = false;
      this.nav.reset(0);
    }
  }

  private advance(): void {
    if (!this.cur) return;
    if (this.shown < this.cur.text.length) {
      this.finishTyping();
      return;
    }
    audio.sfx('blip');
    this.next();
  }

  private choose(ch: Choice): void {
    if (ch.disabled) {
      audio.sfx('fail');
      return;
    }
    audio.sfx('select');
    this.queue = [];
    this.cur = null;
    this.el.hidden = true;
    ch.onSelect?.();
    if (!this.cur) this.next();
  }

  update(dt: number, input: Input): void {
    if (!this.cur) return;
    if (this.shown < this.cur.text.length) {
      this.typing += dt * 60;
      const n = Math.min(this.cur.text.length, Math.floor(this.typing));
      if (n !== this.shown) {
        this.shown = n;
        this.txt.textContent = this.cur.text.slice(0, n);
        if (n >= this.cur.text.length) this.finishTyping();
      }
      if (input.pressed('interact') || input.pressed('tool') || input.pressed('attack')) this.finishTyping();
      return;
    }
    if (this.cur.choices) {
      if (input.pressed('pause')) {
        this.close();
        return;
      }
      this.nav.handle(input);
    } else if (input.pressed('interact') || input.pressed('tool') || input.pressed('attack') || input.pressed('pause')) {
      this.advance();
    }
  }
}

export interface PanelTab {
  id: string;
  label: string;
  render: (body: HTMLElement) => void;
}

/** 居中的大面板：暂停菜单、背包、设置等都用它 */
class Panel {
  private el = $('#panel');
  private title = $('#panelTitle');
  private tabsEl = $('#panelTabs');
  private body = $('#panelBody');
  private hint = $('#panelHint');
  private nav = new NavList(this.body);
  private tabs: PanelTab[] = [];
  private tab = 0;
  private onClose: (() => void) | null = null;
  open = false;

  constructor() {
    this.nav.bindHover();
    $('#panelClose').addEventListener('click', () => this.close());
  }

  show(title: string, tabs: PanelTab[], opts: { tab?: string; hint?: string; onClose?: () => void } = {}): void {
    this.open = true;
    this.el.hidden = false;
    this.title.textContent = title;
    this.tabs = tabs;
    this.tab = Math.max(0, tabs.findIndex((t) => t.id === opts.tab));
    this.onClose = opts.onClose ?? null;
    this.hint.textContent = opts.hint ?? (tabs.length > 1 ? 'Tab 切换分页 · ↑↓ 选择 · E 确认 · Esc 返回' : '↑↓ 选择 · E 确认 · Esc 返回');
    this.renderTabs();
    this.refresh(true);
  }

  private renderTabs(): void {
    this.tabsEl.innerHTML = '';
    this.tabsEl.hidden = this.tabs.length < 2;
    this.tabs.forEach((t, i) => {
      const bt = h('button', { type: 'button', class: i === this.tab ? 'on' : '' }, t.label);
      bt.addEventListener('click', () => this.switchTab(i));
      this.tabsEl.append(bt);
    });
  }

  switchTab(i: number): void {
    this.tab = (i + this.tabs.length) % this.tabs.length;
    audio.sfx('blip');
    this.renderTabs();
    this.refresh(true);
  }

  /** 重新渲染当前分页（数据变化后调用），保留选中位置 */
  refresh(resetSel = false): void {
    if (!this.open) return;
    const keep = this.nav.index;
    this.body.innerHTML = '';
    this.tabs[this.tab]?.render(this.body);
    this.nav.reset(resetSel ? 0 : keep);
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.el.hidden = true;
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }

  update(input: Input): void {
    if (!this.open) return;
    if (input.pressed('pause') || input.pressed('inventory')) {
      audio.sfx('blip');
      this.close();
      return;
    }
    if (input.pressed('cycle') && this.tabs.length > 1) this.switchTab(this.tab + 1);
    this.nav.handle(input);
  }
}

/** 黑屏过场 */
class Fade {
  private el = $('#fade');
  busy = false;

  run(label: string, mid: () => void, hold = 700): void {
    this.busy = true;
    this.el.textContent = label;
    this.el.classList.add('on');
    window.setTimeout(() => {
      mid();
      window.setTimeout(() => {
        this.el.classList.remove('on');
        window.setTimeout(() => (this.busy = false), 250);
      }, label ? hold : 120);
    }, 450);
  }
}

class Toast {
  private el = $('#toast');
  private t = 0;

  show(msg: string): void {
    this.el.textContent = msg;
    this.el.classList.remove('off');
    this.t = 2.4;
  }

  update(dt: number): void {
    if (this.t <= 0) return;
    this.t -= dt;
    if (this.t <= 0) this.el.classList.add('off');
  }
}

export class UI {
  readonly dialog = new Dialog();
  readonly panel = new Panel();
  readonly fade = new Fade();
  readonly toast = new Toast();

  get modal(): boolean {
    return this.dialog.open || this.panel.open;
  }

  update(dt: number, input: Input): void {
    this.toast.update(dt);
    if (this.panel.open) this.panel.update(input);
    else if (this.dialog.open) this.dialog.update(dt, input);
  }

  closeAll(): void {
    this.dialog.close();
    this.panel.close();
  }
}

/** 带图标的物品格子 */
export function itemCell(icon: Img, label: string, count?: number, extra?: { title?: string; nav?: boolean; off?: boolean }): HTMLButtonElement {
  const bt = h('button', { type: 'button', class: `cell${extra?.off ? ' off' : ''}`, title: extra?.title ?? label },
    h('img', { src: iconUrl(icon), alt: '' }),
    h('span', { text: label }),
    count !== undefined ? h('b', { text: String(count) }) : null,
  );
  if (extra?.nav !== false) bt.dataset.nav = '';
  return bt;
}
