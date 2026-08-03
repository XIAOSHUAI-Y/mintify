import { describe, expect, it } from 'vitest';
import { APP_ROUTES, parseHashRoute, toHashRoute } from './hashRoute';

describe('Hash 页面路由', () => {
  it('支持直接打开主页面与快捷页面', () => {
    expect(parseHashRoute('#/budget')).toBe('/budget');
    expect(parseHashRoute('#/categories')).toBe('/categories');
    expect(parseHashRoute('#/savings')).toBe('/savings');
    expect(toHashRoute('/funds')).toBe('#/funds');
  });

  it('空地址、尾部斜杠和未知地址都有稳定回退', () => {
    expect(parseHashRoute('')).toBe('/home');
    expect(parseHashRoute('#/reports/')).toBe('/reports');
    expect(parseHashRoute('#/budget?from=home')).toBe('/budget');
    expect(parseHashRoute('#/unknown')).toBe('/home');
  });

  it('每一个应用页面都能通过 Hash 地址直达', () => {
    APP_ROUTES.forEach((route) => {
      expect(parseHashRoute(toHashRoute(route))).toBe(route);
    });
  });
});
