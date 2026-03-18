const path = require('path');

const serverDir = path.resolve(__dirname, 'apps/server');
const webDir = path.resolve(__dirname, 'apps/web');

module.exports = {
  apps: [
    {
      name: 'ai-e2e-tester',
      script: path.resolve(serverDir, 'src/index.ts'),
      interpreter: 'node',
      interpreter_args: '--import tsx',
      cwd: serverDir,
      watch: ['src'],
      ignore_watch: ['node_modules', 'data'],
      watch_delay: 1000,
      autorestart: true,
      max_restarts: 50,
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        PORT: 4820,
      },
    },
    {
      name: 'ai-e2e-web',
      script: 'node_modules/vite/bin/vite.js',
      args: '--host',
      interpreter: 'node',
      cwd: webDir,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
