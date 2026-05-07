import { useRef, useState, type DragEvent } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface Props {
  onFile: (f: File) => void;
  fileName?: string;
}

export default function FileUpload({ onFile, fileName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.toLowerCase().endsWith('.xlsx')) onFile(f);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`cursor-pointer rounded-2xl border-2 border-dashed transition-colors p-8 text-center ${
        dragOver
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
          : 'border-surface-300 dark:border-surface-700 hover:border-primary-400 hover:bg-surface-50 dark:hover:bg-surface-900/40'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <div className="flex flex-col items-center gap-3">
        {fileName ? (
          <>
            <FileSpreadsheet className="text-emerald-500" size={36} />
            <div>
              <p className="font-medium text-surface-800 dark:text-surface-200">{fileName}</p>
              <p className="text-sm text-surface-500 mt-1">לחץ להחלפה</p>
            </div>
          </>
        ) : (
          <>
            <Upload className="text-surface-400" size={36} />
            <div>
              <p className="font-medium text-surface-700 dark:text-surface-300">
                גרור קובץ ByBenefitType_expanded לכאן
              </p>
              <p className="text-sm text-surface-500 mt-1">או לחץ לבחירת קובץ (.xlsx)</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
