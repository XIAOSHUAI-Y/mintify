import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

// 主版本始终来自 package.json；CI 构建号和提交哈希会让每次部署都有唯一、可追踪的版本。
const buildNumber = process.env.GITHUB_RUN_NUMBER ?? 'dev'
const commitSha = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'

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
