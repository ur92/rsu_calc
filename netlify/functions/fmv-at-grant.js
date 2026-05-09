exports.handler = async function (event) {
  const grantDate = event.queryStringParameters?.grantDate;
  if (!grantDate || !/^\d{4}-\d{2}-\d{2}$/.test(grantDate)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'grantDate required (YYYY-MM-DD)' }) };
  }

  // period2 = midnight UTC on grant date (inclusive upper bound)
  // period1 = 40 calendar days before, giving plenty of buffer for weekends + holidays
  const endDate = new Date(grantDate + 'T00:00:00Z');
  const startDate = new Date(endDate.getTime() - 40 * 24 * 60 * 60 * 1000);
  const period2 = Math.floor(endDate.getTime() / 1000);
  const period1 = Math.floor(startDate.getTime() / 1000);

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/FROG?interval=1d&period1=${period1}&period2=${period2}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return { statusCode: 502, body: JSON.stringify({ error: 'no data from Yahoo Finance' }) };
    }

    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];

    // Keep only trading days on or before the grant date with a valid closing price
    const endMs = endDate.getTime();
    const pairs = timestamps
      .map((ts, i) => ({ ts: ts * 1000, close: closes[i] }))
      .filter(({ ts, close }) => ts <= endMs && typeof close === 'number' && close > 0);

    // Take the last 20 trading days (JFrog's pricing method)
    const last20 = pairs.slice(-20);
    if (last20.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'no trading data for date range' }) };
    }

    const fmv = last20.reduce((sum, { close }) => sum + close, 0) / last20.length;

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        // Cache for a day — grant dates don't change
        'cache-control': 'public, max-age=86400',
      },
      body: JSON.stringify({
        fmv: Math.round(fmv * 100) / 100,
        tradingDays: last20.length,
        method: '20d-trailing',
      }),
    };
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: 'fetch failed' }) };
  }
};
