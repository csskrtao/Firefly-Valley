import { VH, VW } from './constants';

/**
 * 所有世界画面先画到 480×270 的离屏缓冲，再整块放大到屏幕，
 * 这样像素边缘不会出现缝隙。文字（伤害数字、Boss 名）直接画在高分辨率主画布上保持清晰。
 */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly buf: HTMLCanvasElement;
  readonly b: CanvasRenderingContext2D;
  /** 主画布像素 / 世界像素 */
  K = 2;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.buf = document.createElement('canvas');
    this.buf.width = VW;
    this.buf.height = VH;
    this.b = this.buf.getContext('2d')!;
    this.b.imageSmoothingEnabled = false;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.K = this.canvas.width / VW;
  }

  present(): void {
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.buf, 0, 0, this.canvas.width, this.canvas.height);
  }

  /** 在主画布上画带描边的文字，坐标为屏幕世界坐标（已减去镜头）。 */
  text(str: string, x: number, y: number, color: string, size = 6, alpha = 1, font = '"Noto Sans SC", sans-serif', weight = 700): void {
    const c = this.ctx;
    const K = this.K;
    c.globalAlpha = alpha;
    c.font = `${weight} ${Math.round(size * K)}px ${font}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = Math.max(2, K * 1.2);
    c.strokeStyle = '#0b0910';
    c.strokeText(str, x * K, y * K);
    c.fillStyle = color;
    c.fillText(str, x * K, y * K);
    c.globalAlpha = 1;
  }
}
