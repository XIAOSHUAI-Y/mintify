import { useCallback, useEffect, useState } from 'react';
import { parseHashRoute, toHashRoute, type AppRoute } from './hashRoute';

interface NavigateOptions {
  replace?: boolean;
}

export function useHashRoute() {
  const [route, setRoute] = useState<AppRoute>(() => parseHashRoute(window.location.hash));

  useEffect(() => {
    const syncRoute = () => {
      const nextRoute = parseHashRoute(window.location.hash);
      setRoute(nextRoute);
      const canonicalHash = toHashRoute(nextRoute);
      if (window.location.hash !== canonicalHash) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${canonicalHash}`);
      }
    };

    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  const navigate = useCallback((nextRoute: AppRoute, options: NavigateOptions = {}) => {
    const nextHash = toHashRoute(nextRoute);
    if (options.replace) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
      setRoute(nextRoute);
      return;
    }
    if (window.location.hash === nextHash) {
      setRoute(nextRoute);
      return;
    }
    window.location.hash = nextHash;
  }, []);

  return { route, navigate };
}
