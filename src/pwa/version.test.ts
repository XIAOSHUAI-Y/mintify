import { describe, expect, it } from 'vitest';
import { formatAppVersion } from './version';

describe('应用版本', () => {
  it('以 package.json 版本为主版本，并追加每次部署的构建号和提交号', () => {
    expect(formatAppVersion('1.2.0', '48', '2f3c9998413')).toBe('1.2.0+48.2f3c999');
  });

  it('本地开发没有 CI 构建信息时仍保持可识别', () => {
    expect(formatAppVersion('1.2.0', 'dev', 'local')).toBe('1.2.0+dev.local');
  });
});
