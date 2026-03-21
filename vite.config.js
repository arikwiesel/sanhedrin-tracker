import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { execSync } from 'node:child_process'

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001'

function getGitBuildInfo(command, fallback) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim()
  } catch {
    return fallback
  }
}

const lastCommitAt = getGitBuildInfo('git log -1 --format=%cI', '')
const lastCommitHash = getGitBuildInfo('git log -1 --format=%h', '')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  define: {
    __APP_LAST_COMMIT_AT__: JSON.stringify(lastCommitAt),
    __APP_LAST_COMMIT_HASH__: JSON.stringify(lastCommitHash),
  },
  server: {
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },

  build: {
    chunkSizeWarningLimit: 1000
  }

})
