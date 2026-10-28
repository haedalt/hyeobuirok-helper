import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// GitHub Pages는 https://<사용자>.github.io/<저장소>/ 로 서비스되므로
// 빌드 시 base를 저장소 이름으로 맞춘다. Actions에서는 GITHUB_REPOSITORY에서 읽는다.
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'hyeobuirok-helper'

export default defineConfig(({ command, isPreview }) => ({
  // vite preview도 빌드 결과를 서비스하므로 같은 base를 써야 한다
  base: command === 'build' || isPreview ? `/${repoName}/` : '/',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}))
