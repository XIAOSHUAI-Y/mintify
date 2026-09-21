import { describe, expect, it } from 'vitest';
import { fitWithin } from './imageResize';

describe('fitWithin', () => {
  it('长边超过上限时等比缩到上限', () => {
    expect(fitWithin(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3000, 4000, 1280)).toEqual({ width: 960, height: 1280 });
  });

  it('本来就在上限内时不放大', () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1280, 720, 1280)).toEqual({ width: 1280, height: 720 });
  });

  it('极端长宽比不会把短边缩成 0', () => {
    expect(fitWithin(4000, 1000, 1280)).toEqual({ width: 1280, height: 320 });
    expect(fitWithin(1, 10000, 1280)).toEqual({ width: 1, height: 1280 });
  });

  it('尺寸不合法时返回 0，让调用方退回原图', () => {
    expect(fitWithin(0, 0, 1280)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(-10, 100, 1280)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(Number.NaN, 100, 1280)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(4000, 3000, 0)).toEqual({ width: 0, height: 0 });
  });

  it('小数尺寸会取整', () => {
    expect(fitWithin(4001, 3001, 1280)).toEqual({ width: 1280, height: 960 });
  });
});
