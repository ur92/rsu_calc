exports.handler = async function () {
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/FROG?interval=1d&range=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price !== 'number' || price <= 0) {
      return { statusCode: 502, body: JSON.stringify({ error: 'invalid price' }) };
    }
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
      body: JSON.stringify({ price }),
    };
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: 'fetch failed' }) };
  }
};
