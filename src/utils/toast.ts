/**
 * React 19 下 antd-mobile 的静态 Toast API 无法可靠挂载（与 ConfirmDialogProvider
 * 注释里记录的 Dialog 问题同源），因此提示条直接操作 DOM，不经过 React 渲染树。
 */

let activeToast: HTMLDivElement | null = null;
let hideTimer: number | undefined;

export function showToast(content: string, duration = 3000): void {
  if (activeToast) {
    activeToast.remove();
    activeToast = null;
    window.clearTimeout(hideTimer);
  }

  const element = document.createElement('div');
  element.className = 'app-toast';
  element.setAttribute('role', 'status');
  element.textContent = content;
  document.body.appendChild(element);
  activeToast = element;

  // 下一帧再加可见类，确保 transition 生效。
  requestAnimationFrame(() => element.classList.add('app-toast-visible'));

  hideTimer = window.setTimeout(() => {
    element.classList.remove('app-toast-visible');
    element.addEventListener('transitionend', () => element.remove(), { once: true });
    if (activeToast === element) activeToast = null;
  }, duration);
}
