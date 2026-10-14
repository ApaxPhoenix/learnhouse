import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
// pnpm workspace root: dependencies live in <root>/node_modules/.pnpm, so
// Turbopack and output tracing must be allowed to see past apps/payload.
const workspaceRoot = path.resolve(dirname, '../..')

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: workspaceRoot,
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: workspaceRoot,
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
