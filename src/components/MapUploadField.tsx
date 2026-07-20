"use client";

import { useRef, useState } from "react";

type MapUploadFieldProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  optional?: boolean;
};

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_MB = 10;

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MapUploadField({
  file,
  onFileChange,
  disabled = false,
  optional = true,
}: MapUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  function validateAndSet(next: File | null) {
    setError("");
    if (!next) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      onFileChange(null);
      return;
    }

    if (next.size > MAX_MB * 1024 * 1024) {
      setError(`Arquivo maior que ${MAX_MB} MB.`);
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
      setError("Use JPG, PNG ou WebP.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(next));
    onFileChange(next);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files?.[0] ?? null;
    validateAndSet(dropped);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-[var(--ink)]">
          Planta do mapa{optional ? " (opcional)" : ""}
        </p>
        {optional ? (
          <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted-foreground)]">
            Pode enviar depois
          </span>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => validateAndSet(event.target.files?.[0] ?? null)}
      />

      {!file ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onClick={() => !disabled && inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`map-upload-zone ${dragOver ? "is-dragover" : ""} ${disabled ? "is-disabled" : ""}`}
        >
          <div className="map-upload-zone__icon" aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </div>
          <p className="map-upload-zone__title">Arraste a planta ou clique para selecionar</p>
          <p className="map-upload-zone__hint">JPG, PNG ou WebP · até {MAX_MB} MB</p>
          <button
            type="button"
            className="map-upload-zone__button"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              inputRef.current?.click();
            }}
          >
            Escolher arquivo
          </button>
        </div>
      ) : (
        <div className="map-upload-preview">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="map-upload-preview__thumb" />
          ) : (
            <div className="map-upload-preview__thumb map-upload-preview__thumb--empty" aria-hidden>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2 1.586-1.586a2 2 0 0 1 2.828 0L20 14" />
                <rect x="3" y="4" width="18" height="16" rx="2" />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--ink)]">{file.name}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{formatFileSize(file.size)}</p>
          </div>
          <button
            type="button"
            className="map-upload-preview__remove"
            disabled={disabled}
            onClick={() => validateAndSet(null)}
            aria-label="Remover arquivo"
          >
            Remover
          </button>
        </div>
      )}

      {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}
