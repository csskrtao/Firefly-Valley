import { describe, expect, it } from 'vitest';
import { viewFor } from '../src/core/constants';

describe('view size', () => {
  it('keeps 480×270 on 16:9 screens of any size', () => {
    expect(viewFor(1280, 720)).toEqual([480, 270]);
    expect(viewFor(2560, 1440)).toEqual([480, 270]);
    expect(viewFor(693, 390)).toEqual([480, 270]);
  });

  it('shows a taller view on portrait phones and tablets', () => {
    // 手机竖屏：宽 270，高度按比例
    expect(viewFor(390, 704)).toEqual([270, 487]);
    // 平板竖屏：长边至少 480
    const [w, h] = viewFor(768, 880);
    expect(h).toBe(480);
    expect(w).toBeGreaterThanOrEqual(270);
  });
});
