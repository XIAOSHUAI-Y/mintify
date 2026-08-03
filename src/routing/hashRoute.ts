export const APP_ROUTES = [
  '/home',
  '/reports',
  '/budget',
  '/settings',
  '/add',
  '/categories',
  '/recurring',
  '/funds',
  '/savings',
] as const;

export type AppRoute = typeof APP_ROUTES[number];

const ROUTE_SET = new Set<string>(APP_ROUTES);

/** Hash 中只保存页面路径；查询参数不参与当前页面匹配。 */
export function parseHashRoute(hash: string): AppRoute {
  const rawPath = hash.replace(/^#/, '').split('?')[0] || '/home';
  const normalizedPath = rawPath === '/'
    ? '/home'
    : rawPath.replace(/\/+$/, '') || '/home';
  return ROUTE_SET.has(normalizedPath) ? normalizedPath as AppRoute : '/home';
}

export function toHashRoute(route: AppRoute): string {
  return `#${route}`;
}

export function isPrimaryRoute(route: AppRoute): boolean {
  return route === '/home' || route === '/reports' || route === '/budget' || route === '/settings';
}
