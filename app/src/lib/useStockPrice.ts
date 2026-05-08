import { useEffect, useState } from 'react';

interface StockPriceState {
  priceUSD: number;
  isLive: boolean;
  isLoading: boolean;
}

export function useStockPrice(baseline: number): StockPriceState {
  const [state, setState] = useState<StockPriceState>({
    priceUSD: baseline,
    isLive: false,
    isLoading: true,
  });

  useEffect(() => {
    const YAHOO_URL =
      'https://query1.finance.yahoo.com/v8/finance/chart/FROG?interval=1d&range=1d';

    const tryFetch = (url: string) =>
      fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        .then((r) => r.json())
        .then((data: unknown) => {
          const price = (data as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: unknown } }> } })
            ?.chart?.result?.[0]?.meta?.regularMarketPrice;
          if (typeof price === 'number' && price > 0) {
            setState({ priceUSD: price, isLive: true, isLoading: false });
            return true;
          }
          return false;
        })
        .catch(() => false);

    // Try edge function first (works in local dev); fall back to Yahoo Finance directly
    tryFetch('/api/stock-price').then((ok) => {
      if (!ok) tryFetch(YAHOO_URL).then((ok2) => {
        if (!ok2) setState((s) => ({ ...s, isLoading: false }));
      });
    });
  }, []);

  return state;
}
