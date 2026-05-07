import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Calculator, Moon, Sun } from 'lucide-react';
import FileUpload from './components/FileUpload';
import SalaryInput from './components/SalaryInput';
import PriceSimulator from './components/PriceSimulator';
import PortfolioOverview from './components/PortfolioOverview';
import GrantsTable from './components/GrantsTable';
import OptionsTable from './components/OptionsTable';
import EsppTable from './components/EsppTable';
import SalePriority from './components/SalePriority';
import VestingSchedule from './components/VestingSchedule';
import { parseEtradeFile } from './lib/parseEtrade';
import { marginalRate } from './lib/taxCalc';
import { useStockPrice } from './lib/useStockPrice';
import { useExchangeRate } from './lib/useExchangeRate';
import type { ParsedData } from './lib/types';

const DEFAULT_PRICE = 50;
const DEFAULT_RATE = 3.6;

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [salary, setSalary] = useState<number>(300_000);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

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

  const handleAnalyze = async () => {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    try {
      const data = await parseEtradeFile(file);
      setParsed(data);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'שגיאה בניתוח הקובץ');
    } finally {
      setParsing(false);
    }
  };

  const handleEditFmv = (grantNumber: string, fmv: number) => {
    if (!parsed) return;
    setParsed({
      ...parsed,
      rsus: parsed.rsus.map((g) =>
        g.grantNumber === grantNumber ? { ...g, fmvAtGrant: fmv } : g,
      ),
    });
  };

  const handleReset = () => {
    setParsed(null);
    setFile(null);
    setParseError(null);
  };

  if (!parsed) {
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
            <SalaryInput value={salary} onChange={setSalary} marginalRate={mRate} />

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
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary-500 text-white flex items-center justify-center shrink-0">
              <Calculator size={18} />
            </div>
            <h1 className="font-bold text-surface-900 dark:text-surface-100 truncate">
              מחשבון RSU/אופציות — JFrog
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
              קובץ חדש
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <PriceSimulator
          priceUSD={priceUSD}
          onPriceChange={(v) => setPriceOverride(v)}
          rate={rate}
          onRateChange={(v) => setRateOverride(v)}
          isLive={isLive && priceOverride === null}
          isLoading={isLoading}
          isRateLive={rateIsLive && rateOverride === null}
          isRateLoading={rateIsLoading}
        />

        <PortfolioOverview data={parsed} priceUSD={priceUSD} rate={rate} marginalRate={mRate} />

        <Section title="סדר עדיפות למכירה" subtitle="מסודר לפי שיעור מס אפקטיבי מהנמוך לגבוה.">
          <SalePriority data={parsed} priceUSD={priceUSD} rate={rate} marginalRate={mRate} />
        </Section>

        <Section title="הבשלות ב-12 החודשים הקרובים">
          <VestingSchedule data={parsed} priceUSD={priceUSD} rate={rate} marginalRate={mRate} />
        </Section>

        <Section title="RSU Grants" subtitle="ניתן לערוך FMV ביום הענקה — eTrade לא מייצא ערך זה ישירות, ברירת מחדל לקוחה מה-vest הראשון.">
          <GrantsTable
            rsus={parsed.rsus}
            priceUSD={priceUSD}
            rate={rate}
            marginalRate={mRate}
            onEditFmv={handleEditFmv}
          />
        </Section>

        <Section title="אופציות (NQ)">
          <OptionsTable options={parsed.options} priceUSD={priceUSD} rate={rate} />
        </Section>

        <Section title="ESPP">
          <EsppTable espp={parsed.espp} priceUSD={priceUSD} rate={rate} marginalRate={mRate} />
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
