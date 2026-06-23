import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 空文字（手元で backend を起動しない設定）も AWS ALB へフォールバックさせる。
  // `??` だと空文字が残りプロキシ target が空になり dev サーバーがクラッシュするため `||` を使う。
  const backendTarget =
    env.VITE_DEV_BACKEND_URL || env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
  const devPort = 5173
  const strictPort = true

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: devPort,
      strictPort,
      proxy: {
        '/api': { target: backendTarget, changeOrigin: true },
        '/health': { target: backendTarget, changeOrigin: true },
        '/internal': { target: backendTarget, changeOrigin: true },
        '/ws': {
          target: backendTarget.replace(/^http/, 'ws'),
          ws: true,
          changeOrigin: true,
        },
      },
    },
  }
})
