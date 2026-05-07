import { useEffect, useState } from 'react';

interface ExchangeRateState {
  rate: number;
  isLive: boolean;
  isLoading: boolean;
}

export function useExchangeRate(baseline: number): ExchangeRateState {
  const [state, setState] = useState<ExchangeRateState>({
    rate: baseline,
    isLive: false,
    isLoading: true,
  });

  useEffect(() => {
    fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=ILS')
      .then((r) => r.json())
      .then((data: unknown) => {
        const rate = (data as { rates?: { ILS?: unknown } })?.rates?.ILS;
        if (typeof rate === 'number' && rate > 0) {
          setState({ rate, isLive: true, isLoading: false });
        } else {
          setState((s) => ({ ...s, isLoading: false }));
        }
      })
      .catch(() => setState((s) => ({ ...s, isLoading: false })));
  }, []);

  return state;
}
