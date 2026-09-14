import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

// 主版本始终来自 package.json；CI 构建号和提交哈希会让每次部署都有唯一、可追踪的版本。
const buildNumber = process.env.GITHUB_RUN_NUMBER ?? 'dev'
const commitSha = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'

// 更新弹窗要展示“本次更新内容”，构建时把最近的提交记录打包成静态 JSON 随版本一起发布。
function getRecentCommits(): { sha: string; subject: string; date: string }[] {
  try {
    const output = execSync('git log --no-merges -n 10 --format=%H%x1f%s%x1f%cI', {
      encoding: 'utf8',
    })
    return output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, subject, date] = line.split('\x1f')
        return { sha, subject, date: date.slice(0, 10) }
      })
  } catch {
    // 本地无 git 环境（如归档构建）时退化为空列表，运行时只显示版本号。
    return []
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/mintify/',
  define: {
    __APP_PACKAGE_VERSION__: JSON.stringify(packageJson.version),
    __APP_BUILD_NUMBER__: JSON.stringify(buildNumber),
    __APP_COMMIT_SHA__: JSON.stringify(commitSha),
  },
  plugins: [
    react(),
    {
      name: 'mintify-release-notes',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'release-notes.json',
          source: JSON.stringify({
            version: packageJson.version,
            buildNumber,
            commitSha: process.env.GITHUB_SHA ?? 'local',
            commits: getRecentCommits(),
          }),
        })
      },
    },
    VitePWA({
      registerType: 'prompt',
      manifest: {
        id: '/mintify/',
        name: 'Mintify 记账',
        short_name: 'Mintify',
        description: '一款简洁好用的记账工具',
        theme_color: '#FACC15',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        scope: './',
        orientation: 'portrait',
        categories: ['finance', 'productivity'],
        icons: [
          {
            src: './icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: './icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
