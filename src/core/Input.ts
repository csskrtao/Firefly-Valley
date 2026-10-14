export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'tool' | 'attack' | 'skill' | 'skill2' | 'skill3' | 'interact' | 'heal' | 'cycle' | 'run'
  | 'slot0' | 'slot1' | 'slot2' | 'slot3' | 'slot4'
  | 'pause' | 'inventory' | 'map';

const KEYMAP: Record<string, Action> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyJ: 'tool', Space: 'tool',
  KeyK: 'attack',
  KeyL: 'skill', KeyU: 'skill2', KeyO: 'skill3',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyE: 'interact', Enter: 'interact',
  KeyQ: 'heal',
  Tab: 'cycle',
  Digit1: 'slot0', Digit2: 'slot1', Digit3: 'slot2', Digit4: 'slot3', Digit5: 'slot4',
  Escape: 'pause', KeyP: 'pause',
  KeyI: 'inventory', KeyB: 'inventory',
  KeyM: 'map',
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
  /** 触屏摇杆的方向，长度 0–1 */
  readonly stick = { x: 0, y: 0, active: false };

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
    // 在文本框里打字（比如粘贴存档码）时不抢按键，只留 Esc 用来返回
    if ((target?.tagName === 'TEXTAREA' || (target?.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text')) && action !== 'pause') return;
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
  clear(): void {
    this.heldSet.clear();
    this.pressedSet.clear();
    this.stick.active = false;
  }

  /** 摇杆推过一半时也当作方向键按下，菜单里一样能用 */
  private setDir(a: Action, on: boolean): void {
    if (on && !this.heldSet.has(a)) this.pressedSet.add(a);
    if (on) this.heldSet.add(a);
    else this.heldSet.delete(a);
  }

  /** 绑定触屏摇杆：按下的位置为中心，拖动的方向和距离就是移动方向和速度 */
  bindStick(el: HTMLElement): void {
    const knob = el.querySelector<HTMLElement>('i');
    let id = -1;
    const st = this.stick;
    const update = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const R = r.width * 0.38;
      let dx = (e.clientX - (r.left + r.width / 2)) / R;
      let dy = (e.clientY - (r.top + r.height / 2)) / R;
      const m = Math.hypot(dx, dy);
      if (m > 1) {
        dx /= m;
        dy /= m;
      }
      st.x = dx;
      st.y = dy;
      st.active = m > 0.2;
      if (knob) knob.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
      this.setDir('left', dx < -0.5);
      this.setDir('right', dx > 0.5);
      this.setDir('up', dy < -0.5);
      this.setDir('down', dy > 0.5);
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      st.x = st.y = 0;
      st.active = false;
      if (knob) knob.style.transform = '';
      for (const a of ['left', 'right', 'up', 'down'] as const) this.heldSet.delete(a);
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      id = e.pointerId;
      el.setPointerCapture?.(e.pointerId);
      update(e);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId === id) update(e);
    });
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

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
