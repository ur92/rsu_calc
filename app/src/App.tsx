import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Calculator, Moon, Sun } from 'lucide-react';
import FileUpload from './components/FileUpload';
import SalaryInput from './components/SalaryInput';
import PriceSimulator from './components/PriceSimulator';
import PortfolioOverview from './components/PortfolioOverview';
import GrantsTable from './components/GrantsTable';
import OptionsTable from './components/OptionsTable';
import EsppTable from './components/EsppTable';
import AvailableNowTable from './components/AvailableNowTable';
import WhatsNewDropdown from './components/WhatsNewDropdown';
import FutureVestsTable from './components/FutureVestsTable';
import { parseEtradeFile } from './lib/parseEtrade';
import { marginalRate, capitalGainsRate } from './lib/taxCalc';
import { buildFullSalePlan, mergeSalePlanKeys } from './lib/surtaxFromSalePlan';
import { useStockPrice } from './lib/useStockPrice';
import { useExchangeRate } from './lib/useExchangeRate';
import { useGrantFmv } from './lib/useGrantFmv';
import type { FmvSource, ParsedData } from './lib/types';

const DEFAULT_PRICE = 50;
const DEFAULT_RATE = 3.6;

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [salary, setSalary] = useState<number>(300_000);
  const [otherCapitalIncomeNIS, setOtherCapitalIncomeNIS] = useState(0);
  const [salePlan, setSalePlan] = useState<Record<string, number>>({});
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  // Manual FMV overrides — kept separate so editing doesn't re-trigger the fetch hook
  const [manualFmvOverrides, setManualFmvOverrides] = useState<Record<string, number>>({});

  const [parseGeneration, setParseGeneration] = useState(0);
  const lastParseGenSync = useRef(-1);

  const { priceUSD: livePrice, isLive, isLoading } = useStockPrice(DEFAULT_PRICE);
  const [priceOverride, setPriceOverride] = useState<number | null>(null);
  const priceUSD = priceOverride ?? livePrice;

  const { rate: liveRate, isLive: rateIsLive, isLoading: rateIsLoading } = useExchangeRate(DEFAULT_RATE);
  const [rateOverride, setRateOverride] = useState<number | null>(null);
  const rate = rateOverride ?? liveRate;

  const [isDark, setIsDark] = useState<boolean>(() => localStorage.getItem('rsu-dark') === '1');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('rsu-dark', isDark ? '1' : '0');
  }, [isDark]);

  const mRate = useMemo(() => marginalRate(salary), [salary]);
  const cgRate = useMemo(() => capitalGainsRate(salary), [salary]);

  // Fetch 20-day trailing average for each unique grant date (JFrog's RSU pricing method)
  const { fmvByDate, isLoading: fmvLoading } = useGrantFmv(parsed?.rsus ?? []);

  // Merge: manual override > 20d calculated > vest-proxy fallback
  const rsusWithFmv = useMemo(() => {
    if (!parsed) return [];
    return parsed.rsus.map((g) => {
      if (manualFmvOverrides[g.grantNumber] !== undefined) {
        return { ...g, fmvAtGrant: manualFmvOverrides[g.grantNumber], fmvSource: 'manual' as FmvSource };
      }
      const dateStr = g.grantDate.toISOString().slice(0, 10);
      const calcFmv = fmvByDate[dateStr];
      if (calcFmv !== undefined) {
        return { ...g, fmvAtGrant: calcFmv, fmvSource: 'calculated' as FmvSource };
      }
      return { ...g, fmvSource: 'vest-proxy' as FmvSource };
    });
  }, [parsed, fmvByDate, manualFmvOverrides]);

  // effectiveParsed replaces parsed.rsus with the FMV-corrected version everywhere
  const effectiveParsed = useMemo<ParsedData | null>(() => {
    if (!parsed) return null;
    return { ...parsed, rsus: rsusWithFmv };
  }, [parsed, rsusWithFmv]);

  const handleAnalyze = async () => {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    try {
      const data = await parseEtradeFile(file);
      setParsed(data);
      setParseGeneration((n) => n + 1);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'שגיאה בניתוח הקובץ');
    } finally {
      setParsing(false);
    }
  };

  const handleEditFmv = (grantNumber: string, fmv: number) => {
    setManualFmvOverrides((prev) => ({ ...prev, [grantNumber]: fmv }));
  };

  const handleReset = () => {
    setParsed(null);
    setFile(null);
    setParseError(null);
    setSalePlan({});
    setParseGeneration(0);
    setManualFmvOverrides({});
    lastParseGenSync.current = -1;
  };

  useLayoutEffect(() => {
    if (!effectiveParsed) return;
    const built = buildFullSalePlan(effectiveParsed, priceUSD);
    if (lastParseGenSync.current !== parseGeneration) {
      lastParseGenSync.current = parseGeneration;
      setSalePlan(built);
    } else {
      setSalePlan((prev) => mergeSalePlanKeys(prev, built));
    }
  }, [effectiveParsed, priceUSD, parseGeneration]);

  const handleSalePlanChange = useCallback((key: string, qty: number) => {
    setSalePlan((p) => ({ ...p, [key]: qty }));
  }, []);

  if (!effectiveParsed) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center p-4 bg-surface-50 dark:bg-surface-950">
        <div className="w-full max-w-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500 text-white mb-2">
              <Calculator size={28} />
            </div>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">
              מחשבון RSU/אופציות — JFrog
            </h1>
            <p className="text-surface-600 dark:text-surface-400">
              העלה קובץ <span className="font-mono text-sm">ByBenefitType_expanded</span> מ-eTrade
              <br />
              לניתוח מס מלא לפי סעיף 102
            </p>
          </div>

          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-6 space-y-5">
            <FileUpload onFile={setFile} fileName={file?.name} />
            <SalaryInput
              inline
              value={salary}
              onChange={setSalary}
              marginalRate={mRate}
              otherCapitalIncomeNIS={otherCapitalIncomeNIS}
              onOtherCapitalIncomeChange={setOtherCapitalIncomeNIS}
            />

            {parseError && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                {parseError}
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!file || salary <= 0 || parsing}
              className="w-full py-3 rounded-lg font-semibold transition-colors bg-primary-500 hover:bg-primary-600 disabled:bg-surface-300 dark:disabled:bg-surface-800 disabled:text-surface-500 text-white"
            >
              {parsing ? 'מנתח...' : 'חשב'}
            </button>
          </div>

          <p className="text-xs text-center text-surface-500 dark:text-surface-500">
            כל הנתונים מעובדים בדפדפן בלבד · שום מידע לא נשלח לשרת
          </p>

          <div className="text-center">
            <button
              onClick={() => setIsDark((v) => !v)}
              className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
              {isDark ? 'מצב בהיר' : 'מצב כהה'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-surface-900/80 backdrop-blur border-b border-surface-200 dark:border-surface-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary-500 text-white flex items-center justify-center shrink-0">
              <Calculator size={18} />
            </div>
            <h1 className="font-bold text-surface-900 dark:text-surface-100 truncate">
              מחשבון RSU/אופציות — JFrog
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <WhatsNewDropdown />
            <button
              onClick={() => setIsDark((v) => !v)}
              className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400"
              title={isDark ? 'מצב בהיר' : 'מצב כהה'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300"
            >
              <span className="hidden sm:inline">קובץ חדש</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <PriceSimulator
          priceUSD={priceUSD}
          onPriceChange={(v) => setPriceOverride(v)}
          onResetPrice={() => setPriceOverride(null)}
          rate={rate}
          onRateChange={(v) => setRateOverride(v)}
          onResetRate={() => setRateOverride(null)}
          isLive={isLive && priceOverride === null}
          isLoading={isLoading}
          isRateLive={rateIsLive && rateOverride === null}
          isRateLoading={rateIsLoading}
        />

        <SalaryInput
          value={salary}
          onChange={setSalary}
          marginalRate={mRate}
          otherCapitalIncomeNIS={otherCapitalIncomeNIS}
          onOtherCapitalIncomeChange={setOtherCapitalIncomeNIS}
        />

        <PortfolioOverview
          data={effectiveParsed}
          priceUSD={priceUSD}
          rate={rate}
          marginalRate={mRate}
          cgRate={cgRate}
          salaryNIS={salary}
          otherCapitalIncomeNIS={otherCapitalIncomeNIS}
        />

        <Section title="מניות זמינות עכשיו (לפי עדיפויות למכירה)" subtitle="מסודר לפי שיעור מס אפקטיבי מהנמוך לגבוה">
          <AvailableNowTable
            data={effectiveParsed}
            priceUSD={priceUSD}
            rate={rate}
            marginalRate={mRate}
            cgRate={cgRate}
            salaryNIS={salary}
            salePlan={salePlan}
            onSalePlanChange={handleSalePlanChange}
            otherCapitalIncomeNIS={otherCapitalIncomeNIS}
          />
        </Section>
        <Section title="מניות עם הבשלה עתידית" subtitle="כל ההבשלות מעתה ועד תום לוח ה-vesting; שווי נטו במחיר הנוכחי.">
          <FutureVestsTable data={effectiveParsed} priceUSD={priceUSD} rate={rate} marginalRate={mRate} cgRate={cgRate} />
        </Section>

        <Section title="RSU Grants" subtitle="FMV ביום הענקה — ממוצע 20 ימי מסחר לפני תאריך ההענקה (שיטת JFrog). ניתן לעריכה ידנית.">
          <GrantsTable
            rsus={rsusWithFmv}
            priceUSD={priceUSD}
            rate={rate}
            marginalRate={mRate}
            cgRate={cgRate}
            onEditFmv={handleEditFmv}
            fmvLoading={fmvLoading}
          />
        </Section>

        <Section title="אופציות (NQ)">
          <OptionsTable options={effectiveParsed.options} priceUSD={priceUSD} rate={rate} cgRate={cgRate} />
        </Section>

        <Section title="ESPP">
          <EsppTable espp={effectiveParsed.espp} priceUSD={priceUSD} rate={rate} marginalRate={mRate} cgRate={cgRate} />
        </Section>

        <footer className="pt-8 pb-4 text-center text-xs text-surface-400 dark:text-surface-600">
          חישוב מס לפי סעיף 102 (מסלול הוני 24+ חודשים, רגיל מתחת ל-24) · אינו מהווה ייעוץ מס
        </footer>
      </main>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100">{title}</h2>
        {subtitle && <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
