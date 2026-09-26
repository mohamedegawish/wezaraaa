// Strong Reports Generation — CSV / Excel / Print / Executive + Reports Studio Engine
// INITIATIVE = CONFIGURATION: reports derive from store data, no hard-coded stages.

import type * as XLSXType from 'xlsx';
import { Application, Initiative, FactoryProfile, AuditLogEntry, Organization } from '../types';

// Lazy-load xlsx only when an Excel export is requested — keeps the initial
// bundle lean (~300KB saved). CSV/Print paths never touch this chunk.
const loadXlsx = () => import('xlsx');
type WorkBook = XLSXType.WorkBook;
type WorkSheet = XLSXType.WorkSheet;

function csvCell(v: any): string {
  const s = String(v ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

export function downloadCSV(filename: string, headers: string[], rows: any[][]) {
  const csv = '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// قالب طباعة مستقل: نافذة جديدة لا ترث CSS vars، لذا hex ثابت بألوان الهوية (#0F172A للنص، #0E1622 للرأس).
// Identity-purge exception: print window has no CSS vars, so fixed identity hex only (#0F172A/#0E1622/#64748B/#CBD5E1/#FFFFFF).
export function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function printReport(titleAr: string, titleEn: string, bodyHtml: string, isAr: boolean) {
  const safeTitle = escapeHtml(isAr ? titleAr : titleEn);
  const w = window.open('', '_blank', 'width=1000,height=800');
  if (!w) return;
  w.document.write(`
    <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
    <head><meta charset="utf-8"><title>${safeTitle}</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 32px; color: #0F172A; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      .meta { color: #64748B; font-size: 12px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { border: 1px solid #CBD5E1; padding: 8px 10px; text-align: ${isAr ? 'right' : 'left'}; }
      th { background: #0E1622; color: #FFFFFF; }
      .kpi { display: inline-block; border: 1px solid #CBD5E1; border-radius: 8px; padding: 8px 14px; margin: 4px; font-size: 13px; }
      @media print { button { display: none; } }
    </style></head>
    <body>
      <h1>${safeTitle}</h1>
      <div class="meta">${new Date().toLocaleString(isAr ? 'ar-EG' : 'en-US')} — National Platform for Industrial Financing & Initiatives</div>
      ${bodyHtml}
      <div style="margin-top:24px"><button onclick="window.print()">🖨️ ${isAr ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</button></div>
    </body></html>
  `);
  w.document.close();
}

export function applicationsToRows(apps: Application[], factories: FactoryProfile[]) {
  return apps.map(a => {
    const detailsCount = (factories.find(f => f.id === a.factoryId)?.detailsFiles || [])
      .filter(f => !f.initiativeId || f.initiativeId === a.initiativeId || f.applicationId === a.id).length;
    return [
      a.applicationNumber,
      a.factoryNameAr,
      a.initiativeTitleAr,
      a.factorySectorAr,
      a.factoryGovernorateAr,
      a.currentStageNameAr,
      a.status,
      a.currentAssignedOrgNameAr,
      a.slaDays,
      detailsCount,
      a.submittedAt.split('T')[0],
    ];
  });
}

export const APPLICATIONS_REPORT_HEADERS = [
  'Application Number', 'Factory', 'Initiative', 'Sector', 'Governorate',
  'Current Stage', 'Status', 'Assigned Org', 'SLA Days', 'Details PDF Files', 'Submitted Date',
];

export function initiativesToRows(inits: Initiative[], apps: Application[]) {
  return inits.map(i => {
    const related = apps.filter(a => a.initiativeId === i.id);
    const done = related.filter(a => a.status === 'approved' || a.status === 'completed').length;
    return [
      i.titleAr,
      i.status,
      (i.budgetTotalEGP / 1000000000).toFixed(1) + ' B EGP',
      related.length,
      done,
      i.impactMetrics?.benefitedFactories ?? 0,
      i.customization?.requireDetailsFile ? 'PDF required' : 'PDF optional',
    ];
  });
}

export const INITIATIVES_REPORT_HEADERS = [
  'Initiative', 'Status', 'Budget', 'Applications', 'Approved/Completed', 'Benefited Factories', 'Details File Policy',
];

// ── Additional dataset headers ───────────────────────────────────────────
export const FACTORIES_REPORT_HEADERS = [
  'Factory Name AR', 'Factory Name EN', 'Sector', 'Governorate', 'Industrial Zone', 'Employees', 'Energy MWh', 'Compliant', 'Official IDs',
];
export const ORGANIZATIONS_REPORT_HEADERS = [
  'Code', 'Name AR', 'Name EN', 'Type', 'Active', 'Contact Email', 'Badge',
];
export const AUDIT_LOGS_HEADERS = [
  'Timestamp', 'User', 'Role', 'Organization', 'Action Type', 'Summary (AR)', 'Summary (EN)', 'IP Address',
];
export const KPI_REPORT_HEADERS = [
  'KPI', 'Value', 'Unit', 'Notes',
];
export const CHART_STATUS_HEADERS = ['Status', 'Count', 'Share %'];
export const CHART_TIMELINE_HEADERS = ['Month', 'Submissions'];
export const CHART_SECTOR_HEADERS = ['Sector', 'Applications'];
export const CHART_GOV_HEADERS = ['Governorate', 'Applications'];

export function factoriesToRows(factories: FactoryProfile[]) {
  return factories.map(f => [
    f.nameAr,
    f.nameEn,
    `${f.sector} / ${f.sectorEn}`,
    `${f.governorate} / ${f.governorateEn}`,
    f.industrialZone || '—',
    f.employeesCount,
    f.annualEnergyConsumptionMWh ?? '—',
    f.isCompliant ? 'Compliant' : 'Non-compliant',
    `${f.commercialRegistrationNumber} | ${f.industrialRegistrationNumber} | ${f.taxIdNumber}`,
  ]);
}

export function organizationsToRows(orgs: Organization[]) {
  return orgs.map(o => [
    o.code,
    o.nameAr,
    o.nameEn,
    o.type,
    o.active ? 'Active' : 'Inactive',
    o.contactEmail || '—',
    o.logoBadge,
  ]);
}

// ── Excel (xlsx) export helpers ──────────────────────────────────────────────

function buildWorkbook(XLSX: typeof import('xlsx'), headers: string[], rows: any[][], sheetName: string): WorkBook {
  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-size columns: measure header + first 20 rows for width heuristic
  const colWidths = headers.map((h, ci) => {
    let maxLen = h.length;
    for (let ri = 1; ri <= Math.min(rows.length, 20); ri++) {
      const cell = String(rows[ri - 1]?.[ci] ?? '');
      if (cell.length > maxLen) maxLen = cell.length;
    }
    return { wch: Math.min(maxLen + 4, 60) };
  });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

function downloadWorkbook(XLSX: typeof import('xlsx'), wb: WorkBook, filename: string) {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadExcel(filename: string, headers: string[], rows: any[][], sheetName = 'Report') {
  const XLSX = await loadXlsx();
  const wb = buildWorkbook(XLSX, headers, rows, sheetName);
  downloadWorkbook(XLSX, wb, filename);
}

export async function downloadMultiSheetExcel(
  sheets: { name: string; headers: string[]; rows: any[][] }[],
  filename: string
) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const wsData = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const colWidths = sheet.headers.map((h, ci) => {
      let maxLen = h.length;
      for (let ri = 1; ri <= Math.min(sheet.rows.length, 20); ri++) {
        const cell = String(sheet.rows[ri - 1]?.[ci] ?? '');
        if (cell.length > maxLen) maxLen = cell.length;
      }
      return { wch: Math.min(maxLen + 4, 60) };
    });
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  downloadWorkbook(XLSX, wb, filename);
}

// ── Premium Executive Workbook (styled headers + freeze + filter + kpi sheet) ─

function styleHeaderRow(XLSX: typeof import('xlsx'), ws: WorkSheet, headerLen: number) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let c = range.s.c; c <= Math.min(range.e.c, headerLen - 1); c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (!cell) continue;
    // xlsx-js-style compatible (ignored by CE but harmless & picked up by pro viewers)
    (cell as any).s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
      fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '1E293B' } },
        bottom: { style: 'thin', color: { rgb: '1E293B' } },
        left: { style: 'thin', color: { rgb: '1E293B' } },
        right: { style: 'thin', color: { rgb: '1E293B' } },
      },
    };
  }
  // row height for header
  if (!ws['!rows']) ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 18 } as any;
}

function finalizeSheet(XLSX: typeof import('xlsx'), ws: WorkSheet, headers: string[]) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  // autofilter
  (ws as any)['!autofilter'] = { ref: ws['!ref'] };
  // freeze header row
  (ws as any)['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  styleHeaderRow(XLSX, ws, headers.length);
  const colWidths = headers.map((h, ci) => {
    let maxLen = h.length;
    for (let r = 1; r <= range.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: ci });
      const v = ws[addr]?.v;
      const s = String(v ?? '');
      if (s.length > maxLen) maxLen = s.length;
    }
    return { wch: Math.min(maxLen + 6, 42) };
  });
  ws['!cols'] = colWidths;
}

export interface ExecutiveSheets {
  kpiRows: any[][];
  appHeaders: string[];
  appRows: any[][];
  initHeaders: string[];
  initRows: any[][];
  factoryHeaders: string[];
  factoryRows: any[][];
  orgHeaders: string[];
  orgRows: any[][];
  auditHeaders: string[];
  auditRows: any[][];
  chartStatusRows: any[][];
  chartTimelineRows: any[][];
  chartSectorRows: any[][];
  chartGovRows: any[][];
}

export async function downloadExecutiveWorkbook(
  sheets: ExecutiveSheets,
  filename: string,
  meta: { titleAr: string; titleEn: string; generatedBy: string; filtersSummary: string; isAr: boolean }
) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();

  // 1) Cover / KPI sheet
  {
    const coverHeaders = KPI_REPORT_HEADERS;
    const ws = XLSX.utils.aoa_to_sheet([
      coverHeaders,
      ...sheets.kpiRows,
      [],
      ['Report', meta.isAr ? meta.titleAr : meta.titleEn],
      ['Generated', new Date().toLocaleString(meta.isAr ? 'ar-EG' : 'en-US')],
      ['By', meta.generatedBy],
      ['Filters', meta.filtersSummary || (meta.isAr ? 'كل البيانات' : 'All data')],
      ['Platform', 'National Platform for Industrial Financing & Initiatives — Ministry of Industry'],
    ]);
    finalizeSheet(XLSX, ws, coverHeaders);
    // title merge for branding row
    ws['!merges'] = [{ s: { r: sheets.kpiRows.length + 2, c: 0 }, e: { r: sheets.kpiRows.length + 2, c: 3 } }];
    XLSX.utils.book_append_sheet(wb, ws, meta.isAr ? 'الملخص التنفيذي' : 'Executive Summary');
  }

  const append = (name: string, headers: string[], rows: any[][]) => {
    if (rows.length === 0 && headers.length === 0) return;
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    finalizeSheet(XLSX, ws, headers);
    // cap sheet name 31 chars
    const safe = name.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safe);
  };

  append('Applications', sheets.appHeaders, sheets.appRows);
  append('Initiatives', sheets.initHeaders, sheets.initRows);
  append('Factories', sheets.factoryHeaders, sheets.factoryRows);
  append('Organizations', sheets.orgHeaders, sheets.orgRows);
  append('Audit Logs', sheets.auditHeaders, sheets.auditRows);

  // Chart data sheets (drive in-Excel charts if user builds them, and document graphics)
  if (sheets.chartStatusRows.length) append('Chart — Status', CHART_STATUS_HEADERS, sheets.chartStatusRows);
  if (sheets.chartTimelineRows.length) append('Chart — Timeline', CHART_TIMELINE_HEADERS, sheets.chartTimelineRows);
  if (sheets.chartSectorRows.length) append('Chart — Sector', CHART_SECTOR_HEADERS, sheets.chartSectorRows);
  if (sheets.chartGovRows.length) append('Chart — Governorate', CHART_GOV_HEADERS, sheets.chartGovRows);

  downloadWorkbook(XLSX, wb, filename);
}

// ── Audit Logs Excel helpers ─────────────────────────────────────────────────

export function auditLogsToRows(logs: AuditLogEntry[]) {
  return logs.map(l => [
    new Date(l.timestamp).toLocaleString('en-GB'),
    l.userName,
    l.userRoleEn,
    l.userOrgEn,
    l.actionType,
    l.summaryAr,
    l.summaryEn,
    l.ipAddress,
  ]);
}

// ── Reports Studio Engine — Filters, KPIs, Chart datasets ────────────────────

export interface ReportFilters {
  search?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  initiativeIds?: string[]; // empty = all
  statuses?: string[]; // ApplicationStatus[] empty = all
  orgIds?: string[];
  sectors?: string[];
  governorates?: string[];
}

export function filterApplications(apps: Application[], f: ReportFilters): Application[] {
  const s = (f.search || '').trim().toLowerCase();
  const from = f.dateFrom ? new Date(f.dateFrom + 'T00:00:00').getTime() : -Infinity;
  const to = f.dateTo ? new Date(f.dateTo + 'T23:59:59').getTime() : Infinity;
  return apps.filter(a => {
    if (s) {
      const hay = `${a.applicationNumber} ${a.factoryNameAr} ${a.factoryNameEn} ${a.factorySectorAr} ${a.factorySectorEn} ${a.initiativeTitleAr} ${a.currentStageNameAr}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    const t = new Date(a.submittedAt).getTime();
    if (t < from || t > to) return false;
    if (f.initiativeIds && f.initiativeIds.length > 0 && !f.initiativeIds.includes(a.initiativeId)) return false;
    if (f.statuses && f.statuses.length > 0 && !f.statuses.includes(a.status)) return false;
    if (f.orgIds && f.orgIds.length > 0 && !f.orgIds.includes(a.currentAssignedOrgId)) return false;
    if (f.sectors && f.sectors.length > 0 && !f.sectors.includes(a.factorySectorAr) && !f.sectors.includes(a.factorySectorEn)) return false;
    if (f.governorates && f.governorates.length > 0 && !f.governorates.includes(a.factoryGovernorateAr) && !f.governorates.includes(a.factoryGovernorateEn)) return false;
    return true;
  });
}

export interface ReportKpis {
  totalInitiatives: number;
  totalApplications: number;
  filteredApplications: number;
  approved: number;
  completed: number;
  inReview: number;
  pendingDocs: number;
  rejected: number;
  approvalRate: number; // 0-1
  avgSla: number;
  factoriesCount: number;
  orgsCount: number;
  budgetTotal: number;
  budgetAllocated: number;
  investmentStimulated: number;
  jobsCreated: number;
  benefitedFactories: number;
  targetFactories: number;
}

export function computeReportKpis(
  appsAll: Application[],
  appsFiltered: Application[],
  initiatives: Initiative[],
  factories: FactoryProfile[],
  orgs: Organization[]
): ReportKpis {
  const approved = appsFiltered.filter(a => a.status === 'approved').length;
  const completed = appsFiltered.filter(a => a.status === 'completed').length;
  const inReview = appsFiltered.filter(a => a.status === 'under_review' || a.status === 'in_progress' || a.status === 'submitted').length;
  const pendingDocs = appsFiltered.filter(a => a.status === 'pending_documents').length;
  const rejected = appsFiltered.filter(a => a.status === 'rejected').length;
  const denom = approved + completed + rejected + pendingDocs + inReview;
  const approvalRate = denom ? (approved + completed) / denom : 0;
  const avgSla = appsFiltered.length ? Math.round(appsFiltered.reduce((s, a) => s + (a.slaDays || 0), 0) / appsFiltered.length) : 0;
  const budgetTotal = initiatives.reduce((s, i) => s + (i.budgetTotalEGP || 0), 0);
  const budgetAllocated = initiatives.reduce((s, i) => s + (i.budgetAllocatedEGP || 0), 0);
  const investmentStimulated = initiatives.reduce((s, i) => s + (i.impactMetrics?.investmentStimulatedEGP ?? 0), 0);
  const jobsCreated = initiatives.reduce((s, i) => s + (i.impactMetrics?.jobsCreated ?? 0), 0);
  const benefitedFactories = initiatives.reduce((s, i) => s + (i.impactMetrics?.benefitedFactories ?? 0), 0);
  const targetFactories = initiatives.reduce((s, i) => s + (i.impactMetrics?.targetFactories ?? 0), 0);
  return {
    totalInitiatives: initiatives.length,
    totalApplications: appsAll.length,
    filteredApplications: appsFiltered.length,
    approved,
    completed,
    inReview,
    pendingDocs,
    rejected,
    approvalRate,
    avgSla,
    factoriesCount: factories.length,
    orgsCount: orgs.length,
    budgetTotal,
    budgetAllocated,
    investmentStimulated,
    jobsCreated,
    benefitedFactories,
    targetFactories,
  };
}

export function buildTimelineMonthly(apps: Application[]): { month: string; count: number; labelAr: string }[] {
  const map = new Map<string, number>();
  for (const a of apps) {
    const d = new Date(a.submittedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  // keep last 8 months max for chart clarity; if fewer, keep all
  const sliced = sorted.slice(-8);
  const arMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return sliced.map(([k, count]) => {
    const [y, m] = k.split('-');
    const idx = parseInt(m, 10) - 1;
    return { month: k, labelAr: `${arMonths[idx]} ${y}`, count };
  });
}

export function buildStatusDistribution(apps: Application[]): { key: string; labelAr: string; labelEn: string; count: number; color: string }[] {
  const defs: Record<string, { ar: string; en: string; color: string }> = {
    submitted: { ar: 'مقدم جديد', en: 'Submitted', color: '#64748B' },
    under_review: { ar: 'قيد المراجعة', en: 'Under review', color: '#D97706' },
    in_progress: { ar: 'قيد التنفيذ', en: 'In progress', color: '#0E6B65' },
    pending_documents: { ar: 'مطلوب استيفاء', en: 'Rework', color: '#DC2626' },
    approved: { ar: 'معتمد', en: 'Approved', color: '#059669' },
    completed: { ar: 'مكتمل', en: 'Completed', color: '#1E40AF' },
    rejected: { ar: 'مرفوض', en: 'Rejected', color: '#991B1B' },
    draft: { ar: 'مسودة', en: 'Draft', color: '#94A3B8' },
  };
  const counts = new Map<string, number>();
  for (const a of apps) counts.set(a.status, (counts.get(a.status) || 0) + 1);
  return [...counts.entries()].map(([k, count]) => ({
    key: k,
    labelAr: defs[k]?.ar || k,
    labelEn: defs[k]?.en || k,
    count,
    color: defs[k]?.color || '#334155',
  })).sort((a,b) => b.count - a.count);
}

export function buildGroupCounts(apps: Application[], getKey: (a: Application) => string): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const a of apps) {
    const k = getKey(a) || '—';
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a,b) => b.count - a.count);
}

// ── SVG rasterization for Excel/Print (optional; print uses inline SVG, Excel gets chart-data sheets) ─
export async function svgToPngDataUrl(svgEl: SVGSVGElement, scale = 2): Promise<string> {
  const xml = new XMLSerializer().serializeToString(svgEl);
  const svg64 = btoa(unescape(encodeURIComponent(xml)));
  const imgSrc = `data:image/svg+xml;base64,${svg64}`;
  const img = new Image();
  img.src = imgSrc;
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('svg load failed')); });
  const canvas = document.createElement('canvas');
  const w = (svgEl.viewBox.baseVal.width || svgEl.clientWidth || 400) * scale;
  const h = (svgEl.viewBox.baseVal.height || svgEl.clientHeight || 260) * scale;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imgSrc;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0,0,w,h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}

// ── Executive Print with embedded chart SVGs (inline SVG prints perfectly, no canvas needed) ─
export function printExecutiveReport(
  opts: {
    titleAr: string; titleEn: string; isAr: boolean;
    kpis: ReportKpis;
    chartSvgs: { id: string; titleAr: string; titleEn: string; svgHtml: string }[];
    tables: { titleAr: string; titleEn: string; headers: string[]; rows: any[][] }[];
    filtersSummary: string;
    generatedBy: string;
  }
) {
  const w = window.open('', '_blank', 'width=1180,height=900');
  if (!w) return;
  const t = opts.isAr ? opts.titleAr : opts.titleEn;
  const kpiCards = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0">
      <div style="border:1px solid #E2E8F0;border-radius:10px;padding:12px;text-align:center"><div style="font-size:11px;color:#64748B">${opts.isAr ? 'الطلبات (مفلترة)' : 'Filtered apps'}</div><div style="font-size:22px;font-weight:800;color:#0F172A">${opts.kpis.filteredApplications.toLocaleString(opts.isAr ? 'ar-EG' : 'en-US')}</div><div style="font-size:10px;color:#94A3B8">/ ${opts.kpis.totalApplications}</div></div>
      <div style="border:1px solid #E2E8F0;border-radius:10px;padding:12px;text-align:center"><div style="font-size:11px;color:#64748B">${opts.isAr ? 'معدل الاعتماد' : 'Approval rate'}</div><div style="font-size:22px;font-weight:800;color:#059669">${(opts.kpis.approvalRate*100).toFixed(1)}%</div><div style="font-size:10px;color:#94A3B8">${opts.kpis.approved + opts.kpis.completed} ${opts.isAr ? 'معتمد/مكتمل' : 'approved/completed'}</div></div>
      <div style="border:1px solid #E2E8F0;border-radius:10px;padding:12px;text-align:center"><div style="font-size:11px;color:#64748B">SLA avg</div><div style="font-size:22px;font-weight:800;color:#0E6B65">${opts.kpis.avgSla} ${opts.isAr ? 'أيام' : 'days'}</div><div style="font-size:10px;color:#94A3B8">${opts.kpis.inReview} ${opts.isAr ? 'قيد المراجعة' : 'in review'}</div></div>
      <div style="border:1px solid #E2E8F0;border-radius:10px;padding:12px;text-align:center"><div style="font-size:11px;color:#64748B">${opts.isAr ? 'المصانع / الجهات' : 'Factories / Orgs'}</div><div style="font-size:22px;font-weight:800;color:#0F172A">${opts.kpis.factoriesCount} / ${opts.kpis.orgsCount}</div><div style="font-size:10px;color:#94A3B8">${(opts.kpis.investmentStimulated/1e9).toFixed(1)} B EGP</div></div>
    </div>`;

  const chartsHtml = opts.chartSvgs.length
    ? `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin:14px 0">
        ${opts.chartSvgs.map(c => `
          <div style="border:1px solid #E2E8F0;border-radius:12px;padding:12px;background:#fff">
            <div style="font-size:12px;font-weight:700;color:#0F172A;margin-bottom:8px">${opts.isAr ? c.titleAr : c.titleEn}</div>
            <div style="display:flex;justify-content:center;overflow:hidden">${c.svgHtml}</div>
          </div>`).join('')}
       </div>`
    : '';

  const tablesHtml = opts.tables.map(tbl => {
    if (!tbl.rows.length) return `<h3 style="font-size:13px;color:#0F172A;margin:16px 0 8px">${opts.isAr ? tbl.titleAr : tbl.titleEn} — <span style="color:#64748B;font-weight:500">0</span></h3><div style="color:#94A3B8;font-size:12px">— ${opts.isAr ? 'لا توجد بيانات مطابقة للفلاتر' : 'No matching rows'} —</div>`;
    const head = tbl.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
    const body = tbl.rows.slice(0, 120).map(r => `<tr>${r.map(v => `<td>${escapeHtml(String(v ?? ''))}</td>`).join('')}</tr>`).join('');
    const more = tbl.rows.length > 120 ? `<div style="font-size:11px;color:#64748B;margin-top:6px">${opts.isAr ? `و ${tbl.rows.length - 120} صف إضافي في ملف Excel` : `+ ${tbl.rows.length - 120} more rows in Excel`}</div>` : '';
    return `<h3 style="font-size:13px;color:#0F172A;margin:16px 0 8px">${opts.isAr ? tbl.titleAr : tbl.titleEn} <span style="color:#64748B;font-weight:500">(${tbl.rows.length.toLocaleString(opts.isAr ? 'ar-EG' : 'en-US')})</span></h3><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${more}`;
  }).join('');

  const html = `<!doctype html>
  <html dir="${opts.isAr ? 'rtl' : 'ltr'}" lang="${opts.isAr ? 'ar' : 'en'}">
  <head><meta charset="utf-8"><title>${t}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #0F172A; padding: 24px; line-height: 1.5; }
    h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: -0.01em; }
    .flag { height: 3px; background: linear-gradient(90deg,#C8102E 0 33.33%,#fff 33.33% 66.66%,#0F172A 66.66% 100%); border-radius: 9999px; margin: 10px 0 14px; }
    .meta { color:#64748B; font-size: 11px; display:flex; gap:12px; flex-wrap:wrap; }
    .filters { background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:10px 12px; font-size:12px; color:#334155; margin:10px 0; }
    table { width:100%; border-collapse:collapse; font-size:11.5px; margin-top:6px; }
    th, td { border:1px solid #CBD5E1; padding:7px 8px; text-align:${opts.isAr ? 'right' : 'left'}; vertical-align:top; }
    th { background:#0F172A; color:#fff; font-size:11px; letter-spacing:0.02em; }
    tr:nth-child(even) td { background:#F8FAFC; }
    svg { max-width: 100%; height: auto; }
    @media print { .no-print { display:none !important; } body { padding:0; } }
  </style></head>
  <body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
      <div>
        <h1>${t}</h1>
        <div class="meta"><span>${new Date().toLocaleString(opts.isAr ? 'ar-EG' : 'en-US')}</span><span>•</span><span>${opts.generatedBy}</span><span>•</span><span>National Platform for Industrial Financing & Initiatives</span></div>
      </div>
      <div style="text-align:${opts.isAr ? 'left' : 'right'};font-size:11px;color:#334155"><strong>وزارة الصناعة</strong><br/>Ministry of Industry</div>
    </div>
    <div class="flag"></div>
    <div class="filters"><strong>${opts.isAr ? 'الفلاتر:' : 'Filters:'}</strong> ${opts.filtersSummary || (opts.isAr ? 'كل البيانات — بلا تقييد' : 'All data — no filters')}</div>
    ${kpiCards}
    ${chartsHtml}
    <div style="height:1px;background:#E2E8F0;margin:12px 0"></div>
    ${tablesHtml}
    <div class="no-print" style="margin-top:18px;display:flex;gap:8px">
      <button onclick="window.print()" style="background:#C8102E;color:#fff;border:none;border-radius:9999px;padding:10px 18px;font-weight:700;cursor:pointer">🖨️ ${opts.isAr ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</button>
      <button onclick="window.close()" style="background:#fff;color:#334155;border:1px solid #CBD5E1;border-radius:9999px;padding:10px 16px;font-weight:600;cursor:pointer">${opts.isAr ? 'إغلاق' : 'Close'}</button>
    </div>
    <div style="margin-top:14px;font-size:10px;color:#94A3B8;text-align:center">© 2026 Ministry of Industry — Arab Republic of Egypt • Confidential — Administrative use only</div>
  </body></html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}
