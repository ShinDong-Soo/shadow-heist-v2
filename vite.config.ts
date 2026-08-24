import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 경로 빌드는 루트 도메인과 GitHub Pages 하위 경로에서 모두 동작한다.
  base: './',
  build: {
    rollupOptions: {
      input: {
        game: 'index.html',
        foundation3d: '3d.html',
      },
    },
  },
});
