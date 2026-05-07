import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'dev-api',
      configureServer(server) {
        server.middlewares.use('/api/stock-price', async (_req, res) => {
          try {
            const upstream = await fetch(
              'https://query1.finance.yahoo.com/v8/finance/chart/FROG?interval=1d&range=1d',
              { headers: { 'User-Agent': 'Mozilla/5.0' } },
            );
            const data = await upstream.json() as {
              chart?: { result?: Array<{ meta?: { regularMarketPrice?: unknown } }> };
            };
            const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (typeof price !== 'number' || price <= 0) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'invalid price' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ price }));
          } catch {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'fetch failed' }));
          }
        });
      },
    },
  ],
})
