// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { showToast } from './toast';

describe('showToast', () => {
  it('把内容渲染到 body，并在过渡结束后移除', async () => {
    showToast('「餐饮」预算已用 85%', 50);
    expect(document.body.textContent).toContain('预算已用 85%');

    await new Promise((resolve) => setTimeout(resolve, 80));
    const toast = document.querySelector('.app-toast');
    expect(toast).not.toBeNull();
    toast?.dispatchEvent(new Event('transitionend'));
    expect(document.querySelector('.app-toast')).toBeNull();
  });

  it('连续调用时只保留最新一条', () => {
    showToast('第一条');
    showToast('第二条');
    const toasts = document.querySelectorAll('.app-toast');
    expect(toasts).toHaveLength(1);
    expect(toasts[0].textContent).toBe('第二条');
  });
});
