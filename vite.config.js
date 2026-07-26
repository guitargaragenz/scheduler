import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function partsboxDevProxy(apiKey) {
  return {
    name: 'partsbox-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/partsbox', async (req, res) => {
        const op = new URL(req.url, 'http://localhost').searchParams.get('op');
        if (!op) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing op' })); return; }
        let body = '';
        req.on('data', d => body += d);
        req.on('end', async () => {
          try {
            const r = await fetch(`https://api.partsbox.com/api/1/${op}`, {
              method: 'POST',
              headers: {
                'Authorization': `APIKey ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: body || '{}',
            });
            const data = await r.json();
            res.statusCode = r.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  plugins: [react(), partsboxDevProxy(env.PARTSBOX_API_KEY)],
  base: '/',
  server: {
    port: 5173,
  },
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/firestore',
    ],
  },
  test: {
    // Agent worktrees under .claude/ hold whole stale copies of the repo,
    // including old copies of the test files. Vitest's default glob walks into
    // them, so `npm test` was running joinJobs.test.js twice — once live, once
    // from a July 21 snapshot on an abandoned branch. That inflates the count
    // and, once the snapshot drifts, fails against code that no longer exists.
    // Excluded rather than deleted: the worktrees are still registered with git.
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/worktrees/**'],
  },
  }
})
