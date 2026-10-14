import './styles/main.css';
import { audio } from './core/Audio';
import { Game } from './core/Game';
import { Input } from './core/Input';
import { Renderer } from './core/Renderer';
import { applySettings } from './core/settings';
import type { App } from './scenes/App';
import { PlayScene } from './scenes/PlayScene';
import { TitleScene } from './scenes/TitleScene';
import { Hud } from './ui/Hud';
import { UI } from './ui/UI';
import { $ } from './ui/dom';

const renderer = new Renderer($<HTMLCanvasElement>('#game'));
const input = new Input();
input.enabled = true;
input.bindTouch($('#touch'));

const game = new Game(renderer, input);
const app: App = {
  game,
  ui: new UI(),
  hud: new Hud(),
  toTitle: () => game.setScene(new TitleScene(app)),
  play: (save) => game.setScene(new PlayScene(app, save)),
};

applySettings();
// 浏览器要求用户先交互才能播放声音
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

app.toTitle();
game.start();

// 开发模式下暴露到控制台，方便调试
if (import.meta.env.DEV) Object.assign(window, { fireflyValley: app });
