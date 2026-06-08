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
  }
})
