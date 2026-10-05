import { useRef, useState, type DragEvent } from 'react';
import { FileImage, Upload } from 'lucide-react';

export default function UploadCard({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!/\.tiff?$/i.test(file.name)) {
      setError('Only GeoTIFF files (.tif, .tiff) are accepted.');
      return;
    }
    setError(null);
    onFile(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files?.[0]);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center rounded-2xl border-2 bg-card p-5 text-center shadow-xs transition-all dark:shadow-none ${
        dragging ? 'border-[#2563EB] bg-blue-50/30 dark:bg-blue-500/10' : 'border-dashed border-line-strong'
      }`}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Choose a GeoTIFF to upload"
        className="mb-3 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-accent-soft text-accent-text shadow-xs transition-transform hover:scale-105 dark:shadow-none"
      >
        <Upload className="h-6 w-6 stroke-[2.2]" aria-hidden />
      </button>

      <h3 className="mb-1 text-base font-bold text-ink">Upload Sentinel-2 GeoTIFF</h3>
      <p className="mb-1 text-xs text-muted">Drag and drop a file here, or browse</p>
      <p className="mb-4 font-mono text-[11px] leading-snug text-faint">4-band L2A, B4 B3 B2 B8, 10 m, up to 512 × 512 px</p>
      {error && (
        <p role="alert" className="mb-3 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#1D4ED8] hover:shadow"
      >
        <FileImage className="h-4 w-4" aria-hidden />
        <span>Choose GeoTIFF</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".tif,.tiff,image/tiff"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = '';
        }}
        className="hidden"
      />
    </div>
  );
}
