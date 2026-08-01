import { formatAppVersion } from './version';

export const APP_VERSION = formatAppVersion(
  __APP_PACKAGE_VERSION__,
  __APP_BUILD_NUMBER__,
  __APP_COMMIT_SHA__,
);
