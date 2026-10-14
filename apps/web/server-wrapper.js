#!/usr/bin/env node

/**
 * Production entrypoint for the web app (`pnpm start` and the Docker image).
 *
 * NEXT_PUBLIC_* values are read at runtime, not baked in at build time, so the
 * same build works on any domain. This writes them to runtime-config.json
 * (server) and public/runtime-config.js (browser, loaded by app/layout.tsx),
 * then starts Next:
 *   - Docker / standalone output: ./server.js sits next to this file
 *   - plain server (`pnpm build && pnpm start`): runs `next start`
 */

const fs = require('fs');
const path = require('path');

const standaloneServer = path.join(__dirname, 'server.js');
const isStandalone = fs.existsSync(standaloneServer);

// Outside Docker the values live in .env files; load them exactly like
// `next start` would so the browser config matches the server's.
if (!isStandalone) {
  try {
    const nextDir = path.dirname(require.resolve('next/package.json'));
    const { loadEnvConfig } = require(require.resolve('@next/env', { paths: [nextDir] }));
    loadEnvConfig(__dirname, false);
  } catch (error) {
    console.warn('[server-wrapper] Could not load .env files:', error.message);
  }
}

// Read all NEXT_PUBLIC_* environment variables from the environment
const env = process.env;

// Collect all NEXT_PUBLIC_* variables from the environment
const runtimeConfig = {};

// Additional non-NEXT_PUBLIC vars that need client-side access
const EXTRA_CLIENT_VARS = ['LEARNHOUSE_PLATFORM_URL'];

Object.keys(env).forEach((key) => {
  if (key.startsWith('NEXT_PUBLIC_') || EXTRA_CLIENT_VARS.includes(key)) {
    runtimeConfig[key] = env[key];
  }
});

// Write runtime config JSON file
const configPath = path.join(__dirname, 'runtime-config.json');
fs.writeFileSync(configPath, JSON.stringify(runtimeConfig, null, 2), 'utf8');

// Create client-side runtime config script for browser access
const publicDir = path.join(__dirname, 'public');
try {
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(publicDir, 'runtime-config.js'),
    `window.__RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};`,
    'utf8'
  );
} catch {
  // Non-critical for server-side rendering; runtime-config.json still applies.
}

if (!process.env.PORT) {
  process.env.PORT = '3000';
}

if (isStandalone) {
  // Standalone server.js binds to HOSTNAME; default to all interfaces.
  if (!process.env.HOSTNAME) {
    process.env.HOSTNAME = '0.0.0.0';
  }
  require('./server.js');
} else {
  const { spawn } = require('child_process');
  const nextBin = require.resolve('next/dist/bin/next');
  const child = spawn(process.execPath, [nextBin, 'start', '--port', process.env.PORT], {
    cwd: __dirname,
    env: process.env,
    stdio: 'inherit',
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
  }
  child.on('exit', (code) => process.exit(code ?? 0));
}
