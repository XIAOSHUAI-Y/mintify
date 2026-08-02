import { describe, expect, it } from 'vitest';
import { formatShortDate } from './helpers';

describe('记账时间展示', () => {
  it('只展示月日，不把小时分钟带入记账日期入口', () => {
    const timestamp = new Date(2026, 7, 2, 14, 5).getTime();

    expect(formatShortDate(timestamp)).toBe('08-02');
  });
});
