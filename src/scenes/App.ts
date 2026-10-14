import type { Game } from '../core/Game';
import type { SaveData } from '../state/save';
import type { Hud } from '../ui/Hud';
import type { UI } from '../ui/UI';

/** 场景之间共享的全局对象，以及切换场景的入口 */
export interface App {
  readonly game: Game;
  readonly ui: UI;
  readonly hud: Hud;
  toTitle(): void;
  play(save: SaveData): void;
}
