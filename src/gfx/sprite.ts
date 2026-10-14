export type Palette = Record<string, string>;
export type Img = HTMLCanvasElement;

/** 用字符画生成像素精灵：每个字符对应调色板里的一种颜色，'.' 为透明。 */
export function sprite(rows: string[], pal: Palette, width = 16): Img {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = rows.length;
  const g = c.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (row[x] !== '.' && col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  });
  return c;
}

/** 用绘制函数生成一张小画布 */
export function paint(w: number, h: number, fn: (g: CanvasRenderingContext2D) => void): Img {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  fn(g);
  return c;
}

export function draw(b: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, flip = false, w = img.width, h = img.height): void {
  x = Math.round(x);
  y = Math.round(y);
  if (flip) {
    b.save();
    b.translate(x + w, y);
    b.scale(-1, 1);
    b.drawImage(img, 0, 0, w, h);
    b.restore();
  } else {
    b.drawImage(img, x, y, w, h);
  }
}

/** 把精灵变成纯色剪影，用于受击闪白 */
const flashCache = new WeakMap<Img, Img>();
export function flashOf(img: Img): Img {
  let f = flashCache.get(img);
  if (!f) {
    f = paint(img.width, img.height, (g) => {
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, img.width, img.height);
    });
    flashCache.set(img, f);
  }
  return f;
}
