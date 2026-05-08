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
    fetch('/api/stock-price')
      .then((r) => r.json())
      .then((data: unknown) => {
        const price = (data as { price?: unknown })?.price;
        if (typeof price === 'number' && price > 0) {
          setState({ priceUSD: price, isLive: true, isLoading: false });
        } else {
          setState((s) => ({ ...s, isLoading: false }));
        }
      })
      .catch(() => setState((s) => ({ ...s, isLoading: false })));
  }, []);

  return state;
}
