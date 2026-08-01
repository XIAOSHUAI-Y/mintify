import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 所有数据库集成测试共享固定的浏览器数据库名，串行运行可避免跨文件互相污染。
    fileParallelism: false,
  },
});
