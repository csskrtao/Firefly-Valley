export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'tool' | 'attack' | 'skill' | 'interact' | 'heal' | 'cycle'
  | 'slot0' | 'slot1' | 'slot2' | 'slot3' | 'slot4'
  | 'pause' | 'inventory';

const KEYMAP: Record<string, Action> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyJ: 'tool', Space: 'tool',
  KeyK: 'attack',
  KeyL: 'skill',
  KeyE: 'interact', Enter: 'interact',
  KeyQ: 'heal',
  Tab: 'cycle',
  Digit1: 'slot0', Digit2: 'slot1', Digit3: 'slot2', Digit4: 'slot3', Digit5: 'slot4',
  Escape: 'pause', KeyP: 'pause',
  KeyI: 'inventory', KeyB: 'inventory',
};

/**
 * 把键盘和触屏按钮统一成“动作”。
 * held 表示按住，pressed 只在按下的那一帧为真，每帧结束时由游戏循环清空。
 */
export class Input {
  private heldSet = new Set<Action>();
  private pressedSet = new Set<Action>();
  /** 为 false 时不拦截按键，让标题菜单这类 DOM 界面自己处理。 */
  enabled = false;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.clear());
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (!down) {
      this.heldSet.delete(action);
      return;
    }
    if (!this.enabled) return;
    const target = e.target as HTMLElement | null;
    // 设置面板里获得焦点的滑块需要左右键，不抢
    if (target?.tagName === 'INPUT' && (action === 'left' || action === 'right')) return;
    e.preventDefault();
    if (!e.repeat) this.pressedSet.add(action);
    this.heldSet.add(action);
  }

  held(a: Action): boolean { return this.heldSet.has(a); }
  pressed(a: Action): boolean { return this.pressedSet.has(a); }
  press(a: Action): void { this.pressedSet.add(a); }
  hold(a: Action, on: boolean): void { if (on) this.heldSet.add(a); else this.heldSet.delete(a); }
  endFrame(): void { this.pressedSet.clear(); }
  clear(): void { this.heldSet.clear(); this.pressedSet.clear(); }

  /** 绑定触屏按钮：data-hold 为按住型（方向键、攻击），data-press 为点按型。 */
  bindTouch(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('[data-hold]').forEach((el) => {
      const a = el.dataset.hold as Action;
      const on = (e: PointerEvent) => {
        e.preventDefault();
        this.heldSet.add(a);
        if (a === 'attack') this.pressedSet.add(a);
        el.setPointerCapture?.(e.pointerId);
      };
      const off = () => this.heldSet.delete(a);
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('lostpointercapture', off);
    });
    root.querySelectorAll<HTMLElement>('[data-press]').forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.pressedSet.add(el.dataset.press as Action);
      });
    });
  }
}
