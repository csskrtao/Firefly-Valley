import type { Input } from './Input';
import type { Renderer } from './Renderer';

export interface Scene {
  enter?(): void;
  exit?(): void;
  update(dt: number): void;
  render(): void;
}

/** 游戏主循环与场景切换。 */
export class Game {
  private scene: Scene | null = null;
  private last = performance.now();

  constructor(readonly renderer: Renderer, readonly input: Input) {}

  get current(): Scene | null {
    return this.scene;
  }

  setScene(next: Scene): void {
    this.scene?.exit?.();
    this.scene = next;
    this.input.clear();
    next.enter?.();
  }

  start(): void {
    requestAnimationFrame(this.loop);
  }

  private loop = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.scene) {
      this.scene.update(dt);
      this.scene.render();
    }
    this.input.endFrame();
    requestAnimationFrame(this.loop);
  };
}
