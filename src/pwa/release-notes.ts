export interface ReleaseNoteCommit {
  sha: string;
  subject: string;
  date: string;
}

export interface ReleaseNotesPayload {
  version: string;
  buildNumber: string;
  commitSha: string;
  commits: ReleaseNoteCommit[];
}

/**
 * release-notes.json 由构建插件生成、不在 SW 预缓存内（globPatterns 不含 json），
 * 加时间戳参数是双保险，确保拿到的一定是服务器上的最新版本说明。
 */
export async function fetchReleaseNotes(): Promise<ReleaseNotesPayload | null> {
  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}release-notes.json?ts=${Date.now()}`,
      { cache: 'no-store' },
    );
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') return null;
    const payload = data as Partial<ReleaseNotesPayload>;
    if (typeof payload.version !== 'string' || !Array.isArray(payload.commits)) return null;
    return payload as ReleaseNotesPayload;
  } catch {
    // 离线或说明文件缺失时静默降级，弹窗仍能完成更新动作。
    return null;
  }
}

/**
 * 提交列表按时间倒序；从头部取到用户当前版本为止，就是“这次落后了几个版本”。
 * 当前 sha 不在列表里（落后太多）时，全部展示并交由 UI 提示。
 */
export function selectNewCommits(
  commits: ReleaseNoteCommit[],
  currentSha: string,
): { commits: ReleaseNoteCommit[]; truncated: boolean } {
  if (!currentSha || currentSha === 'local') return { commits, truncated: false };
  const index = commits.findIndex((commit) => commit.sha.startsWith(currentSha));
  if (index === -1) return { commits, truncated: commits.length > 0 };
  return { commits: commits.slice(0, index), truncated: false };
}
