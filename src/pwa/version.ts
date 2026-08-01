export function formatAppVersion(
  packageVersion: string,
  buildNumber: string,
  commitSha: string,
): string {
  return `${packageVersion}+${buildNumber}.${commitSha.slice(0, 7)}`;
}
