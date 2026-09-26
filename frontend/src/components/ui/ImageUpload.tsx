import React, { useRef, useState } from 'react';
import { usePlatformStore } from '../../store/state';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

// Shared device-image uploader with client-side compression.
// Keeps dataURLs small enough for localStorage persistence (≈50–200KB).
// - PNG/WebP sources keep transparency (max 512px, PNG output)
// - Other sources → JPEG quality 0.82 (max 1024px)

interface ImageUploadProps {
  value: string;
  onChange: (dataUrl: string) => void;
  onClear?: () => void;
  /** max side in px for photos (default 1024) */
  maxDim?: number;
  buttonLabelAr?: string;
  buttonLabelEn?: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('bad-image'));
    img.src = src;
  });
}

export async function compressImageFile(file: File, maxDim = 1024): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });
  const img = await loadImage(raw);
  const keepAlpha = file.type === 'image/png' || file.type === 'image/webp';
  const limit = keepAlpha ? Math.min(maxDim, 512) : maxDim;
  const scale = Math.min(1, limit / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale >= 1 && (keepAlpha || file.type === 'image/jpeg')) return raw;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.82);
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value, onChange, onClear, maxDim = 1024,
  buttonLabelAr = 'رفع صورة من الجهاز',
  buttonLabelEn = 'Upload from device',
}) => {
  const { language } = usePlatformStore();
  const isAr = language === 'ar';
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError(isAr ? 'الملف المختار ليس صورة.' : 'Selected file is not an image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(isAr ? 'حجم الصورة كبير جداً (أقصى 10MB).' : 'Image too large (max 10MB).');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await compressImageFile(file, maxDim);
      onChange(dataUrl);
    } catch {
      setError(isAr ? 'تعذر قراءة الصورة.' : 'Could not read image.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const isLocal = value.startsWith('data:');

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
        <div style={{ width: 120, height: 75, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-medium)', flexShrink: 0, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {value ? (
            <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <ImageIcon size={24} style={{ opacity: 0.35 }} />
          )}
        </div>
        <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', flex: 1, minWidth: 160, wordBreak: 'break-all' }}>
          {isLocal ? (isAr ? '📷 صورة محملة من جهازك (مضغوطة للحفظ)' : '📷 Local device image (compressed for storage)') : (value || (isAr ? 'لا توجد صورة' : 'No image'))}
        </div>
        {value && onClear && (
          <button type="button" onClick={onClear} style={{ color: 'var(--egypt-red)', fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>
            ✕ {isAr ? 'إزالة' : 'Remove'}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
          <Upload size={14} />
          <span>{busy ? (isAr ? 'جارٍ الضغط...' : 'Compressing...') : (isAr ? buttonLabelAr : buttonLabelEn)}</span>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { void handleFile(e.target.files?.[0]); }} />
        </label>
      </div>
      {error && <div style={{ fontSize: '0.75rem', color: 'var(--status-rejected)', marginTop: '0.35rem', fontWeight: 700 }}>{error}</div>}
    </div>
  );
};
