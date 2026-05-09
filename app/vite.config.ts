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

        server.middlewares.use('/api/fmv-at-grant', async (req, res) => {
          // Connect strips the path prefix; query string is preserved in req.url
          const rawUrl = req.url ?? '';
          const qIdx = rawUrl.indexOf('?');
          const qs = new URLSearchParams(qIdx >= 0 ? rawUrl.slice(qIdx + 1) : '');
          const grantDate = qs.get('grantDate');

          if (!grantDate || !/^\d{4}-\d{2}-\d{2}$/.test(grantDate)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'grantDate required (YYYY-MM-DD)' }));
            return;
          }

          const endDate = new Date(grantDate + 'T00:00:00Z');
          const startDate = new Date(endDate.getTime() - 40 * 24 * 60 * 60 * 1000);
          const period2 = Math.floor(endDate.getTime() / 1000);
          const period1 = Math.floor(startDate.getTime() / 1000);

          try {
            const upstream = await fetch(
              `https://query1.finance.yahoo.com/v8/finance/chart/FROG?interval=1d&period1=${period1}&period2=${period2}`,
              { headers: { 'User-Agent': 'Mozilla/5.0' } },
            );
            const data = await upstream.json() as {
              chart?: {
                result?: Array<{
                  timestamp?: number[];
                  indicators?: { quote?: Array<{ close?: (number | null)[] }> };
                }>;
              };
            };
            const result = data?.chart?.result?.[0];
            if (!result) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'no data from Yahoo Finance' }));
              return;
            }

            const timestamps = result.timestamp ?? [];
            const closes = result.indicators?.quote?.[0]?.close ?? [];
            const endMs = endDate.getTime();

            const pairs = timestamps
              .map((ts, i) => ({ ts: ts * 1000, close: closes[i] }))
              .filter(({ ts, close }) => ts <= endMs && typeof close === 'number' && close > 0);

            const last20 = pairs.slice(-20);
            if (last20.length === 0) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'no trading data for date range' }));
              return;
            }

            const fmv = last20.reduce((sum, { close }) => sum + (close as number), 0) / last20.length;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              fmv: Math.round(fmv * 100) / 100,
              tradingDays: last20.length,
              method: '20d-trailing',
            }));
          } catch {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'fetch failed' }));
          }
        });
      },
    },
  ],
})
