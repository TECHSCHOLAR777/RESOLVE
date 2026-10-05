import { useRef, useState, type DragEvent } from 'react';
import { FileImage, Upload } from 'lucide-react';

export default function UploadCard({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
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
        aria-label="Choose an image to upload"
        className="mb-3 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-accent-soft text-accent-text shadow-xs transition-transform hover:scale-105 dark:shadow-none"
      >
        <Upload className="h-6 w-6 stroke-[2.2]" />
      </button>

      <h3 className="mb-1 text-base font-bold text-ink">Upload Sentinel-2 Image</h3>
      <p className="mb-1 text-xs text-muted">Drag and drop a file here, or click to browse</p>
      <p className="mb-4 font-mono text-[11px] text-faint">Supports .tif, .jp2, .png (Sentinel-2 L2A)</p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#1D4ED8] hover:shadow"
      >
        <FileImage className="h-4 w-4" />
        <span>Choose Image</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".tif,.tiff,.jp2,.png,.jpg,.jpeg,image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
        className="hidden"
      />
    </div>
  );
}
