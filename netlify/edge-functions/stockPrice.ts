export default async function handler(_request: Request): Promise<Response> {
  try {
    const upstream = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/FROG?interval=1d&range=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    const data: unknown = await upstream.json();
    const price = (data as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: unknown } }> } })
      ?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price !== 'number' || price <= 0) {
      return new Response(JSON.stringify({ error: 'invalid price' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ price }), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=300',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'fetch failed' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}

// Inline route config — no [[edge_functions]] entry needed in netlify.toml
export const config = { path: '/api/stock-price' };
