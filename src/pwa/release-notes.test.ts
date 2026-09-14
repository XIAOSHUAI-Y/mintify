import { describe, expect, it } from 'vitest';
import { selectNewCommits, type ReleaseNoteCommit } from './release-notes';

const commits: ReleaseNoteCommit[] = [
  { sha: 'ccc3333full', subject: 'feat: 最新功能', date: '2026-09-14' },
  { sha: 'bbb2222full', subject: 'fix: 中间修复', date: '2026-09-13' },
  { sha: 'aaa1111full', subject: 'feat: 用户当前版本', date: '2026-09-12' },
];

describe('selectNewCommits', () => {
  it('只返回比当前版本新的提交', () => {
    const result = selectNewCommits(commits, 'aaa1111');
    expect(result.commits.map((commit) => commit.subject)).toEqual(['feat: 最新功能', 'fix: 中间修复']);
    expect(result.truncated).toBe(false);
  });

  it('已经是最新时返回空列表', () => {
    const result = selectNewCommits(commits, 'ccc3333');
    expect(result.commits).toEqual([]);
  });

  it('当前版本太老不在列表中时全部返回并标记截断', () => {
    const result = selectNewCommits(commits, 'zzz9999');
    expect(result.commits).toHaveLength(3);
    expect(result.truncated).toBe(true);
  });

  it('本地开发版本不做过滤', () => {
    const result = selectNewCommits(commits, 'local');
    expect(result.commits).toHaveLength(3);
    expect(result.truncated).toBe(false);
  });
});
