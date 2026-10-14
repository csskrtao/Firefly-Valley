import type { Input } from '../core/Input';
import { audio } from '../core/Audio';

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`缺少界面元素 ${sel}`);
  return el;
};

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/**
 * 键盘/手柄式的菜单导航：在容器内带 data-nav 的元素之间移动高亮，
 * 确认键触发点击。鼠标和触屏直接点击即可。
 */
export class NavList {
  index = 0;

  constructor(private root: HTMLElement) {}

  items(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>('[data-nav]')].filter((el) => !el.closest('[hidden]') && el.offsetParent !== null);
  }

  reset(i = 0): void {
    this.index = i;
    this.mark();
  }

  mark(): void {
    const list = this.items();
    if (!list.length) return;
    this.index = Math.max(0, Math.min(list.length - 1, this.index));
    list.forEach((el, i) => el.classList.toggle('sel', i === this.index));
    list[this.index].scrollIntoView({ block: 'nearest' });
  }

  /** 处理一帧输入，返回 true 表示消耗了确认键 */
  handle(input: Input): boolean {
    const list = this.items();
    if (!list.length) return false;
    const prev = this.index;
    const cur = list[this.index];
    // 选中滑块时左右键调数值，上下键换行
    if (cur instanceof HTMLInputElement && cur.type === 'range' && (input.pressed('left') || input.pressed('right'))) {
      if (input.pressed('left')) cur.stepDown();
      else cur.stepUp();
      cur.dispatchEvent(new Event('input', { bubbles: true }));
      return false;
    }
    if (input.pressed('up') || input.pressed('left')) this.index = (this.index - 1 + list.length) % list.length;
    if (input.pressed('down') || input.pressed('right')) this.index = (this.index + 1) % list.length;
    if (prev !== this.index) {
      audio.sfx('blip');
      this.mark();
    }
    if (input.pressed('interact') || input.pressed('tool')) {
      const el = list[this.index];
      if (el && !(el as HTMLButtonElement).disabled) el.click();
      return true;
    }
    return false;
  }

  /** 鼠标悬停时同步高亮 */
  bindHover(): void {
    this.root.addEventListener('pointermove', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]');
      if (!el) return;
      const i = this.items().indexOf(el);
      if (i >= 0 && i !== this.index) {
        this.index = i;
        this.mark();
      }
    });
  }
}
