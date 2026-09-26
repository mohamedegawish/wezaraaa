import React, { useState } from 'react';
import type { Initiative, InitiativeStatus } from '../../../types';
import type { StatusTone } from '../../../utils/theme';
import { api } from '../../../api';
import { store } from '../../../store/state';
import { useToast } from '../../common/ToastSystem';

/** الحالات الست بترتيب دورة حياة المبادرة + هل تظهر للجمهور. */
export const INITIATIVE_STATUS_META: ReadonlyArray<{ value: InitiativeStatus; ar: string; en: string; tone: StatusTone; isPublic: boolean }> = [
  { value: 'draft', ar: 'مسودة', en: 'Draft', tone: 'draft', isPublic: false },
  { value: 'coming_soon', ar: 'قريباً', en: 'Coming soon', tone: 'gold', isPublic: true },
  { value: 'active', ar: 'نشطة', en: 'Active', tone: 'approved', isPublic: true },
  { value: 'closed', ar: 'مغلقة', en: 'Closed', tone: 'rework', isPublic: true },
  { value: 'completed', ar: 'مكتملة', en: 'Completed', tone: 'teal', isPublic: true },
  { value: 'archived', ar: 'مؤرشفة', en: 'Archived', tone: 'draft', isPublic: false },
];

export const statusMeta = (s: string) => INITIATIVE_STATUS_META.find(m => m.value === s) ?? INITIATIVE_STATUS_META[0];

/** الحالات التي يراها الجمهور (الباك يخفي الباقي عن غير الإدارة). */
export const PUBLIC_INITIATIVE_STATUSES: string[] = INITIATIVE_STATUS_META.filter(m => m.isPublic).map(m => m.value);

export const OPEN_APP_STATUSES = ['submitted', 'under_review', 'pending_documents', 'in_progress'];

/**
 * تغيير حالة المبادرة من الجدول/الترويسة مع تأكيد. يحذّر عند الإغلاق/الأرشفة وعليها طلبات مفتوحة،
 * وعند إخفائها عن الجمهور. يرسل expectedUpdatedAt حتى لا يكتب فوق تعديل أحدث.
 */
export const StatusSelect: React.FC<{ initiative: Initiative; openApps: number; isAr: boolean; compact?: boolean }> = ({ initiative, openApps, isAr, compact }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const change = async (next: InitiativeStatus) => {
    if (next === initiative.status) return;
    const to = statusMeta(next);
    const lines = [isAr ? `تغيير حالة «${initiative.titleAr}» إلى «${to.ar}»؟` : `Change "${initiative.titleEn}" to "${to.en}"?`];
    if ((next === 'closed' || next === 'archived') && openApps > 0) {
      lines.push(isAr ? `تنبيه: عليها ${openApps} طلب مفتوح ما زال قيد المراجعة.` : `Warning: ${openApps} open application(s) are still in review.`);
    }
    if (!to.isPublic) lines.push(isAr ? 'لن تظهر المبادرة للجمهور بعد هذا التغيير.' : 'The initiative will be hidden from the public.');
    if (to.isPublic && !statusMeta(initiative.status).isPublic) lines.push(isAr ? 'ستظهر المبادرة للجمهور في الكتالوج.' : 'The initiative will become public.');
    if (!window.confirm(lines.join('\n'))) return;
    setBusy(true);
    try {
      await api.updateInitiative(initiative.id, { status: next, expectedUpdatedAt: initiative.updatedAt } as never);
      await store.reloadAll();
      toast('success', isAr ? `أصبحت الحالة «${to.ar}»` : `Status set to "${to.en}"`);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : (isAr ? 'تعذر تغيير الحالة.' : 'Could not change status.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <select
      className="form-control"
      aria-label={isAr ? 'حالة المبادرة' : 'Initiative status'}
      value={initiative.status}
      disabled={busy}
      onChange={e => { void change(e.target.value as InitiativeStatus); }}
      style={{ width: 'auto', minWidth: compact ? '110px' : '140px', fontSize: compact ? '0.78rem' : '0.85rem', padding: compact ? '0.25rem 0.5rem' : undefined, fontWeight: 700 }}
    >
      {INITIATIVE_STATUS_META.map(m => (
        <option key={m.value} value={m.value}>{isAr ? m.ar : m.en}{m.isPublic ? '' : (isAr ? ' (مخفية)' : ' (hidden)')}</option>
      ))}
    </select>
  );
};
