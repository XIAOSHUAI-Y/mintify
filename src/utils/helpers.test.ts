import { describe, expect, it } from 'vitest';
import { formatPercentage, formatShortDate } from './helpers';

describe('记账时间展示', () => {
  it('只展示月日，不把小时分钟带入记账日期入口', () => {
    const timestamp = new Date(2026, 7, 2, 14, 5).getTime();

    expect(formatShortDate(timestamp)).toBe('08-02');
  });
});

describe('百分比展示', () => {
  it('统一四舍五入并固定展示两位小数', () => {
    expect(formatPercentage(28.335)).toBe('28.34%');
    expect(formatPercentage(28.334)).toBe('28.33%');
    expect(formatPercentage(1.005)).toBe('1.01%');
    expect(formatPercentage(0)).toBe('0.00%');
  });
});
