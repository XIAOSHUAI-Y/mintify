import { formatAppVersion } from './version';

// Vitest 直接执行模块时没有 Vite define 常量，使用开发回退值避免数据层测试被构建环境绑死。
const packageVersion = typeof __APP_PACKAGE_VERSION__ === 'undefined' ? '0.0.0' : __APP_PACKAGE_VERSION__;
const buildNumber = typeof __APP_BUILD_NUMBER__ === 'undefined' ? 'dev' : __APP_BUILD_NUMBER__;
const commitSha = typeof __APP_COMMIT_SHA__ === 'undefined' ? 'local' : __APP_COMMIT_SHA__;

export const APP_VERSION = formatAppVersion(
  packageVersion,
  buildNumber,
  commitSha,
);
