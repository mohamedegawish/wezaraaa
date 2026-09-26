import React, { useEffect, useState } from 'react';
import { Download, Eye, Loader2 } from 'lucide-react';
import { api } from '../../api/endpoints';
import type { ChatAttachmentShape } from '../../api/schemas';
import { Modal } from '../ui/Modal';
import { useToast } from '../common/ToastSystem';
import { fileIconFor, formatBytes } from './chatUtils';

// مرفق داخل فقاعة الرسالة: صورة مصغرة للصور، معاينة PDF، وتنزيل لكل الأنواع.
// الملفات تُجلب كـ Blob بتوكن الذاكرة (لا يمكن استخدام رابط مباشر) ثم object URL يُلغى عند الإزالة.

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const AttachmentCard: React.FC<{ att: ChatAttachmentShape; isAr: boolean; mine: boolean }> = ({ att, isAr, mine }) => {
  const { toast } = useToast();
  const [thumb, setThumb] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isPdf = att.mimeType === 'application/pdf';
  const { Icon, color } = fileIconFor(att.mimeType || att.fileName);

  useEffect(() => {
    if (!att.isImage) return;
    let url: string | null = null;
    let alive = true;
    api.downloadChatAttachment(att.id, true)
      .then(b => { if (!alive) return; url = URL.createObjectURL(b); setThumb(url); })
      .catch(() => { /* card fallback */ });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [att.id, att.isImage]);

  useEffect(() => () => { if (preview && preview !== thumb) URL.revokeObjectURL(preview); }, [preview, thumb]);

  const download = async () => {
    setBusy(true);
    try {
      saveBlob(await api.downloadChatAttachment(att.id), att.fileName);
    } catch {
      toast('error', isAr ? 'تعذر تنزيل الملف.' : 'Download failed.');
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async () => {
    if (att.isImage && thumb) { setPreview(thumb); return; }
    setBusy(true);
    try {
      setPreview(URL.createObjectURL(await api.downloadChatAttachment(att.id, true)));
    } catch {
      toast('error', isAr ? 'تعذر فتح المعاينة.' : 'Preview failed.');
    } finally {
      setBusy(false);
    }
  };

  const closePreview = () => {
    if (preview && preview !== thumb) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  return (
    <>
      {/* Fixed-size frame (even while loading) so late thumbnails never shift the thread scroll position */}
      {att.isImage && (
        <button type="button" className="chat-att-image" onClick={openPreview} title={att.fileName} disabled={!thumb}>
          {thumb
            ? <img src={thumb} alt={att.fileName} decoding="async" />
            : <span className="chat-att-image-ph"><Loader2 size={18} className="chat-spin" /></span>}
        </button>
      )}
      <div className={`chat-att${mine ? ' mine' : ''}`}>
        <span className="chat-att-icon" style={{ color }}><Icon size={20} /></span>
        <span className="chat-att-meta">
          <span className="chat-att-name" title={att.fileName}>{att.fileName}</span>
          <small>{formatBytes(att.sizeBytes)}</small>
        </span>
        {(isPdf || att.isImage) && (
          <button type="button" className="btn btn-secondary chat-round-btn chat-round-btn--sm" onClick={openPreview} disabled={busy} title={isAr ? 'معاينة' : 'Preview'} aria-label={isAr ? 'معاينة' : 'Preview'}>
            <Eye size={15} />
          </button>
        )}
        <button type="button" className="btn btn-secondary chat-round-btn chat-round-btn--sm" onClick={download} disabled={busy} title={isAr ? 'تنزيل' : 'Download'} aria-label={isAr ? 'تنزيل' : 'Download'}>
          {busy ? <Loader2 size={15} className="chat-spin" /> : <Download size={15} />}
        </button>
      </div>

      {preview && (
        <Modal
          onClose={closePreview}
          title={att.fileName}
          maxWidth="960px"
          footer={
            <button type="button" className="btn btn-primary btn-sm" onClick={download} disabled={busy}>
              <Download size={14} />
              <span>{isAr ? 'تنزيل' : 'Download'}</span>
            </button>
          }
        >
          {att.isImage
            ? <img src={preview} alt={att.fileName} className="chat-preview-img" />
            : <iframe src={preview} title={att.fileName} className="chat-preview-pdf" />}
        </Modal>
      )}
    </>
  );
};
