import {
  detailsTable, escapeHtml, noteBlock, paragraph, progressBar, renderEmail, sectionTitle, statusPanel, type EmailTone,
} from './layout.js';

// بريد المنشأة الرسمي — يُرسل مع كل تحديث في مراحل طلبها (استلام، اعتماد مرحلة، استيفاء، رفض، اعتماد نهائي).

export type FactoryEventKind = 'submitted' | 'stage_approved' | 'completed' | 'rework' | 'rejected';

export interface FactoryEmailEvent {
  kind: FactoryEventKind;
  factoryNameAr: string;
  applicationNumber: string;
  initiativeTitleAr: string;
  /** Stage the event happened in (the current stage for `submitted`). */
  stageNameAr: string;
  /** Organization that decided (or is reviewing, for `submitted`). */
  orgNameAr: string;
  orgNameEn?: string;
  nextStageNameAr?: string;
  nextOrgNameAr?: string;
  /** 1-based order of the stage the application is in AFTER the event. */
  stageOrder: number;
  totalStages: number;
  approvedStages: number;
  comments?: string;
  at: string;
  appUrl: string;
}

const stripNo = (s: string) => String(s ?? '').replace(/^\s*\d+\s*[.\-–]\s*/, '');

export function formatCairo(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 16);
  }
}

interface Copy {
  subject: string;
  preheader: string;
  heading: string;
  tone: EmailTone;
  panelTitle: string;
  panelText: string;
  noteTitle: string;
  next: string;
  english: string;
}

function copyFor(e: FactoryEmailEvent): Copy {
  const stage = stripNo(e.stageNameAr);
  const nextStage = stripNo(e.nextStageNameAr ?? '');
  const no = e.applicationNumber;
  switch (e.kind) {
    case 'submitted':
      return {
        subject: `تم استلام طلبكم رقم ${no} — ${e.initiativeTitleAr}`,
        preheader: `استلمت المنصة طلبكم رقم ${no} وهو الآن قيد المراجعة الأولية.`,
        heading: 'تم استلام طلبكم بنجاح',
        tone: 'info',
        panelTitle: 'طلبكم قيد المراجعة الأولية',
        panelText: `استلمت المنصة طلبكم رقم ${no} في مبادرة «${e.initiativeTitleAr}»، وهو الآن لدى ${e.orgNameAr} لمرحلة «${stage}».`,
        noteTitle: 'ملاحظات',
        next: 'لا يلزمكم أي إجراء حالياً. ستصلكم رسالة بريد رسمية عند كل تحديث في مراحل طلبكم.',
        english: `We received application ${no} (${e.initiativeTitleAr}). It is now under initial review.`,
      };
    case 'stage_approved':
      return {
        subject: `تحديث طلبكم ${no}: اعتماد مرحلة «${stage}»`,
        preheader: `اعتمدت ${e.orgNameAr} مرحلة «${stage}» وأُحيل طلبكم إلى المرحلة التالية.`,
        heading: `اعتماد مرحلة «${stage}»`,
        tone: 'success',
        panelTitle: `تم اعتماد مرحلة «${stage}»`,
        panelText: `اعتمدت ${e.orgNameAr} هذه المرحلة، وأُحيل طلبكم إلى مرحلة «${nextStage}» لدى ${e.nextOrgNameAr ?? ''}.`,
        noteTitle: `ملاحظات ${e.orgNameAr}`,
        next: `لا يلزمكم أي إجراء حالياً — تتولى ${e.nextOrgNameAr ?? 'الجهة المختصة'} مراجعة طلبكم، وسنوافيكم بالنتيجة فور صدورها.`,
        english: `Application ${no}: stage "${stage}" was approved by ${e.orgNameEn || e.orgNameAr}; it moved to "${nextStage}".`,
      };
    case 'completed':
      return {
        subject: `اعتماد نهائي لطلبكم ${no}`,
        preheader: `اكتملت جميع مراحل طلبكم رقم ${no} بنجاح.`,
        heading: 'اعتماد نهائي لطلبكم',
        tone: 'success',
        panelTitle: 'تهانينا — اكتمل مسار طلبكم',
        panelText: `اعتمدت ${e.orgNameAr} المرحلة الأخيرة «${stage}»، وبذلك اكتملت جميع مراحل طلبكم رقم ${no} بنجاح.`,
        noteTitle: `ملاحظات ${e.orgNameAr}`,
        next: 'يمكنكم الاطلاع على كامل مسار الطلب وقرارات الجهات المختصة عبر المنصة.',
        english: `Application ${no} received final approval — all stages are complete.`,
      };
    case 'rework':
      return {
        subject: `مطلوب استيفاء — طلبكم ${no}`,
        preheader: `طلبت ${e.orgNameAr} استيفاء بعض البيانات أو المستندات لاستكمال مراجعة طلبكم.`,
        heading: 'مطلوب استيفاء لطلبكم',
        tone: 'warning',
        panelTitle: `مطلوب استيفاء في مرحلة «${stage}»`,
        panelText: `طلبت ${e.orgNameAr} استيفاء بعض البيانات أو المستندات قبل استكمال مراجعة طلبكم.`,
        noteTitle: 'المطلوب استيفاؤه',
        next: 'يرجى الدخول إلى المنصة واستيفاء المطلوب في أقرب وقت؛ تبقى مراجعة طلبكم متوقفة لحين الاستيفاء.',
        english: `Application ${no}: ${e.orgNameEn || e.orgNameAr} requested additional information at stage "${stage}".`,
      };
    case 'rejected':
    default:
      return {
        subject: `قرار بشأن طلبكم ${no}`,
        preheader: `صدر قرار من ${e.orgNameAr} بشأن طلبكم رقم ${no}.`,
        heading: 'قرار بشأن طلبكم',
        tone: 'danger',
        panelTitle: 'عدم الموافقة على الطلب',
        panelText: `نأسف لإبلاغكم بأن ${e.orgNameAr} قررت عدم الموافقة على طلبكم في مرحلة «${stage}».`,
        noteTitle: 'أسباب القرار',
        next: 'للاستفسار عن القرار يمكنكم متابعة تفاصيله عبر المنصة، ويمكنكم التقدم بطلب جديد بعد معالجة الأسباب الموضحة.',
        english: `Application ${no} was not approved by ${e.orgNameEn || e.orgNameAr} at stage "${stage}".`,
      };
  }
}

export function factoryUpdateEmail(e: FactoryEmailEvent): { subject: string; html: string; text: string } {
  const c = copyFor(e);
  const link = `${e.appUrl}/#my-initiatives`;
  const closed = e.kind === 'completed' || e.kind === 'rejected';
  const currentStage = e.kind === 'stage_approved' ? stripNo(e.nextStageNameAr ?? '') : stripNo(e.stageNameAr);
  const currentOrg = e.kind === 'stage_approved' ? (e.nextOrgNameAr ?? '') : e.orgNameAr;
  const rows: Array<[string, string]> = [
    ['رقم الطلب', e.applicationNumber],
    ['المبادرة', e.initiativeTitleAr],
    ['المنشأة', e.factoryNameAr],
    [closed ? 'المرحلة الأخيرة' : 'المرحلة الحالية', currentStage],
    [closed ? 'الجهة المصدرة للقرار' : 'الجهة المختصة', currentOrg],
    ['تاريخ التحديث', formatCairo(e.at)],
  ];
  const progressLabel = e.kind === 'completed'
    ? `اكتملت جميع المراحل (${e.totalStages} من ${e.totalStages})`
    : `المرحلة ${e.stageOrder} من ${e.totalStages}`;
  const done = e.kind === 'completed' ? e.totalStages : e.approvedStages;
  const tone: EmailTone = e.kind === 'rejected' ? 'danger' : e.kind === 'rework' ? 'warning' : 'success';

  const body = [
    paragraph(`السادة / <strong>${escapeHtml(e.factoryNameAr)}</strong>`),
    paragraph('تحية طيبة وبعد،'),
    statusPanel(c.tone, c.panelTitle, c.panelText),
    e.totalStages > 0 ? progressBar(done, e.totalStages, progressLabel, tone) : '',
    sectionTitle('بيانات الطلب'),
    detailsTable(rows),
    e.comments?.trim() ? noteBlock(c.noteTitle, e.comments.trim(), `${e.orgNameAr} — ${formatCairo(e.at)}`) : '',
    sectionTitle('الخطوة التالية'),
    paragraph(`<span style="color:#334155;">${escapeHtml(c.next)}</span>`),
    paragraph('<span style="color:#334155;">وتفضلوا بقبول فائق الاحترام،</span><br><strong style="color:#0B2545;">المنصة الوطنية للتمويل والمبادرات الصناعية — وزارة الصناعة</strong>'),
  ].join('');

  const html = renderEmail({
    preheader: c.preheader,
    heading: c.heading,
    bodyHtml: body,
    cta: { label: 'متابعة طلبكم على المنصة', href: link },
    englishSummary: c.english,
  });

  const text = [
    `السادة / ${e.factoryNameAr}`,
    'تحية طيبة وبعد،',
    '',
    `${c.panelTitle}`,
    c.panelText,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    `التقدم: ${progressLabel}`,
    ...(e.comments?.trim() ? ['', `${c.noteTitle}:`, e.comments.trim()] : []),
    '',
    `الخطوة التالية: ${c.next}`,
    `متابعة الطلب: ${link}`,
    '',
    c.english,
    '',
    'المنصة الوطنية للتمويل والمبادرات الصناعية — وزارة الصناعة',
    'هذه رسالة آلية — يرجى عدم الرد عليها.',
  ].join('\n');

  return { subject: c.subject, html, text };
}
