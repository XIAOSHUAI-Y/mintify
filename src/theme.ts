import { useSyncExternalStore } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'mintify-theme';

let mode: ThemeMode = readStoredMode();
const listeners = new Set<() => void>();

// 系统深色偏好转为暗色时，跟随系统模式需要立即响应，不能等下次启动。
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
systemDarkQuery.addEventListener('change', () => {
  if (mode === 'system') applyTheme();
});

function readStoredMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

function resolveIsDark(value: ThemeMode): boolean {
  return value === 'dark' || (value === 'system' && systemDarkQuery.matches);
}

function applyTheme() {
  const isDark = resolveIsDark(mode);
  document.documentElement.classList.toggle('dark', isDark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', isDark ? '#0f172a' : '#FACC15');
  for (const listener of listeners) listener();
}

export function getThemeMode(): ThemeMode {
  return mode;
}

export function isDarkTheme(): boolean {
  return resolveIsDark(mode);
}

export function setThemeMode(next: ThemeMode) {
  mode = next;
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, () => mode);
}

export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, () => resolveIsDark(mode));
}

// 模块加载即应用一次，index.html 里的内联脚本负责首帧前的兜底。
applyTheme();
