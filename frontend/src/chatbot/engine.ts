// ============================================================
// محرك الإجابة للشات بوت العربي — engine.ts
// ------------------------------------------------------------
// - لا يستورد أي كود تشغيلي: الأنواع فقط عبر import type.
// - كل بيانات المعرفة تصل حقناً عبر deps (faqs / sitemap / keywords)
//   مع فحص دفاعي (Array.isArray و typeof) قبل كل قراءة، فلا ينكسر
//   لو اختلف شكل البيانات قليلاً عن المتوقع.
// - لا اعتماديات خارجية جديدة.
// ============================================================

import type { ChatAnswer, SafeQueryName } from './contract';

// ---------- أنواع محلية مرنة (متسامحة مع اختلاف الشكل) ----------

// شكل الـFAQ المتوقع من وكيل المعرفة:
// { id, q: string[], a: string, links: [{ labelAr, view, initiativeId? }], keywords: string[] }
// لكننا نقرأ كل حقل دفاعياً ولا نفترض وجوده.
export interface EngineDeps {
  faqs?: unknown;
  faq?: unknown; // اسم بديل متسامَح (مفرد)
  sitemap?: unknown;
  keywords?: unknown; // خريطة نية → مرادفات: Record<string, string[]>
  isLoggedIn?: unknown;
  user?: unknown; // بديل متسامَح: كائن المستخدم أو معرّفه يعني مسجلاً
  userId?: unknown; // بديل متسامَح لاكتشاف الدخول
  fetch?: unknown; // (q: SafeQueryName, args?) => Promise<unknown>
}

type FetchFn = (q: SafeQueryName, args?: Record<string, unknown>) => Promise<unknown>;

// رابط خارج موحّد قبل صبّه في نوع العقد.
interface OutLink {
  labelAr: string;
  view: string;
  initiativeId?: string;
}

// عتبة القبول: أعلى FAQ يجب أن يجمع 4 نقاط على الأقل، وإلا نرد
// بطلب توضيح + اقتراحات عامة. (مثال: كلمة مشتركة واحدة +2 مع
// مكافأة نية +5 = 7 تنجح، أما كلمة يتيمة +2 وحدها فتفشل).
export const ANSWER_THRESHOLD = 8;

// سقف طول نص الإجابة النهائي (حماية للواجهة من الردود الضخمة).
export const MAX_ANSWER_LENGTH = 1000;

// مهلة أي استدعاء بيانات حية حتى لا يعلّق الرد أبداً.
const FETCH_TIMEOUT_MS = 8000;

// ============================================================
// 1) تطبيع النص العربي
// ============================================================
export function normalizeArabic(text: unknown): string {
  if (typeof text !== 'string') return '';
  let s = text.toLowerCase();
  // أرقام عربية/فارسية → لاتينية (قبل إسقاط الرموز).
  s = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  s = s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  // توحيد الحروف.
  s = s.replace(/[أإآٱ]/g, 'ا');
  s = s.replace(/ؤ/g, 'و');
  s = s.replace(/ئ/g, 'ي');
  s = s.replace(/ة/g, 'ه');
  s = s.replace(/ى/g, 'ي');
  // إسقاط الهمزة المفردة المتبقية (ء → ا) — تكملة توحيد الهمزات.
  s = s.replace(/ء/g, 'ا');
  // إزالة التشكيل والحركات.
  s = s.replace(/[ً-ٰٟۖ-ۭ]/g, '');
  // إزالة التطويل (ـ) والمحارف غير المرئية (صفرية العرض وعلامات التوجيه).
  s = s.replace(/ـ/g, '');
  s = s.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '');
  // تجاهل التكرار الزخرفي للحروف (مبااادره → مبادره) — حروف فقط دون الأرقام.
  s = s.replace(/([ء-يa-z])\1{2,}/g, '$1');
  // إسقاط كل ما ليس حرفاً عربياً/لاتينياً أو رقماً (يشمل ؟ ? ! ، . ، ؛ :)
  s = s.replace(/[^0-9a-zء-ي ]/g, ' ');
  // توحيد المسافات + سقف 200 حرف.
  s = s.replace(/\s+/g, ' ').trim();
  return s.slice(0, 200);
}

// ============================================================
// 2) كلمات التوقف + تجذيع خفيف + نقاط التطابق
// ============================================================

// بصيغها بعد التطبيع (على→علي، أو→او، إلى→الي، أهلية→اهليه...).
const STOPWORDS: ReadonlySet<string> = new Set([
  'من', 'في', 'علي', 'الي', 'عن', 'ان', 'ما', 'هل', 'كيف', 'ليه',
  'و', 'او', 'ده', 'دي', 'دا', 'مع', 'هو', 'هي', 'انا', 'انت',
  'ايه', 'ازاي', 'فين', 'امتي', 'هذا', 'هذه', 'كده', 'كدا',
  'لو', 'اذا', 'كان', 'عشان', 'كمان', 'بس',
]);

// تجذيع خفيف: إسقاط سابقة "ال" ولاحقتي الجمع/التأنيث الشائعة،
// حتى تلتقي "المبادرات" و"مبادره" في الجذر "مبادر".
function stem(w: string): string {
  let s = w;
  if (s.startsWith('ال') && s.length > 4) s = s.slice(2);
  else if (s.startsWith('لل') && s.length > 4) s = s.slice(2);
  if (s.startsWith('و') && s.length > 5) s = s.slice(1);
  if (s.length > 5 && s.endsWith('ات')) s = s.slice(0, -2);
  if (s.length > 4 && s.endsWith('ه')) s = s.slice(0, -1);
  return s;
}

function tokenize(norm: string): string[] {
  if (!norm) return [];
  const out: string[] = [];
  const parts = norm.split(' ');
  for (const p of parts) {
    if (!p || p.length < 2 || STOPWORDS.has(p)) continue;
    const st = stem(p);
    if (!st || st.length < 2 || STOPWORDS.has(st)) continue;
    out.push(st);
  }
  return out;
}

// مفاتيح النيات (بصيغ مطبّعة). الترتيب مقصود: الدخول أولاً حتى لا
// تخطف "سجّل" نية التقديم من "سجّل الدخول"، والأهلية قبل المتابعة
// حتى لا تخطف "طلب" كلمة "المطلوبه".
const INTENT_KEYS: Array<{ name: string; keys: string[] }> = [
  { name: 'login', keys: ['دخول', 'تسجيل الدخول', 'حساب', 'مرور', 'باسورد', 'نسيت كلمه', 'انشاء حساب'] },
  { name: 'eligibility', keys: ['اهليه', 'شروط', 'شرط', 'موهل', 'مستحق', 'استحقاق', 'ينفع', 'مطلوب'] },
  { name: 'track', keys: ['طلباتي', 'طلبات', 'طلب', 'تابع', 'متابعه', 'حاله', 'وصل', 'رقم'] },
  { name: 'apply', keys: ['قدم', 'تقديم', 'سجل', 'تسجيل', 'اشترك', 'اشتراك', 'التحق'] },
  { name: 'browse', keys: ['استعرض', 'استعراض', 'مبادره', 'مبادرات', 'متاح', 'قايمه', 'تصفح', 'اعرض'] },
  { name: 'support', keys: ['مساعده', 'تواصل', 'اتصل', 'شكوي', 'دعم', 'استفسار'] },
];

// يستنتج النية من نص مطبّع، مع دمج مرادفات deps.keywords (نية → مرادفات).
// بنظام النقاط (عدد المفاتيح المطابقة) بدل أول تطابق — حتى لا يخطف
// مفتاح عام مثل «طلب» نية كاملة من أسئلة تحويتشتقاته (كأسئلة التقديم).
export function inferIntent(normText: unknown, synonyms: unknown): string | null {
  if (typeof normText !== 'string' || !normText) return null;
  const extra = synonyms && typeof synonyms === 'object' && !Array.isArray(synonyms)
    ? (synonyms as Record<string, unknown>)
    : null;
  let best: string | null = null;
  let bestHits = 0;
  for (const intent of INTENT_KEYS) {
    const keys = intent.keys.slice();
    if (extra) {
      const raw = extra[intent.name];
      if (Array.isArray(raw)) {
        for (const s of raw) {
          if (typeof s === 'string' && s.trim()) {
            const n = normalizeArabic(s);
            if (n) keys.push(n);
          }
        }
      }
    }
    let hits = 0;
    for (const k of keys) {
      if (k && normText.includes(k)) hits += 1;
    }
    if (hits > bestHits) {
      bestHits = hits;
      best = intent.name;
    }
  }
  return best;
}

function readStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) if (typeof x === 'string' && x.trim()) out.push(x);
  return out;
}

// قراءة أسئلة الـFAQ متسامحة: q (الأساسي) أو questions أو question (المفرد).
function readQuestions(rec: Record<string, unknown>): string[] {
  const direct = readStringArray(rec['q']);
  if (direct.length > 0) return direct;
  const plural = readStringArray(rec['questions']);
  if (plural.length > 0) return plural;
  const single = rec['question'];
  if (typeof single === 'string' && single.trim()) return [single.trim()];
  return [];
}

// قراءة نص الإجابة متسامحة: a (الأساسي) أو answer (البديل).
function readAnswerText(rec: Record<string, unknown>): string | null {
  for (const k of ['a', 'answer']) {
    const v = rec[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

// تلميح نية مصرّح به من الـFAQ نفسه (حقل intent) أو معرّفه.
function readIntentHint(rec: Record<string, unknown>): string {
  const v = rec['intent'];
  if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 60);
  const id = rec['id'];
  if (typeof id === 'string' || typeof id === 'number') return String(id).slice(0, 60);
  return '';
}

// هل كشف الدخول؟ isLoggedIn أولاً، ثم بدائل user/userId.
function readLoggedIn(d: EngineDeps): boolean {
  if (d.isLoggedIn !== undefined && d.isLoggedIn !== null) return Boolean(d.isLoggedIn);
  const rec = d as Record<string, unknown>;
  if (rec['user'] !== undefined && rec['user'] !== null) return Boolean(rec['user']);
  if (rec['userId'] !== undefined && rec['userId'] !== null) return Boolean(rec['userId']);
  return false;
}

// ثقة 0..1 من النقاط الخام (العتبة 8 ≈ 0.5 بعد ترجيح IDF).
function scoreToConfidence(s: number): number {
  if (!(s > 0)) return 0;
  return Math.min(1, s / 16);
}

// ترجيح IDF للكلمات المميزة: الكلمات النادرة عبر الأسئلة (شمس، سجل)
// وزنها أعلى من الشائعة (اقدم، في) — حتى لا تخطف الأسئلة العامة
// إجابات المبادرات المحددة والعكس. يُبنى من القائمة في answer() ويُمرر
// اختيارياً؛ scoreMatch بدونه يحافظ على السلوك القديم (للاختبارات).
export type IdfMap = Map<string, number>;
export function buildIdf(faqs: unknown[]): IdfMap {
  const df = new Map<string, number>();
  let n = 0;
  for (const f of faqs) {
    if (!f || typeof f !== 'object') continue;
    n += 1;
    const rec = f as Record<string, unknown>;
    const seen = new Set<string>();
    for (const qs of readQuestions(rec)) {
      for (const t of tokenize(normalizeArabic(qs))) seen.add(t);
    }
    for (const kw of readStringArray(rec['keywords'])) {
      for (const t of tokenize(normalizeArabic(kw))) seen.add(t);
    }
    const idHint = readIntentHint(rec);
    for (const t of tokenize(normalizeArabic(idHint))) seen.add(t);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const out: IdfMap = new Map();
  for (const [t, c] of df) out.set(t, 1 + Math.log(n / (1 + c)));
  return out;
}

// نقاط التطابق: كلمات مشتركة مرجحة بـIDF (+2 للجذر المطابق، +1 للاحتواء
// الجزئي) + تطابق keywords (+3) + مكافأة نية مشتركة (+5).
export function scoreMatch(query: unknown, faq: unknown, synonyms?: unknown, idf?: IdfMap | null): number {
  const nq = normalizeArabic(typeof query === 'string' ? query : '');
  if (!nq) return 0;
  if (!faq || typeof faq !== 'object') return 0;
  const rec = faq as Record<string, unknown>;

  const questions = readQuestions(rec);
  const keywords = readStringArray(rec['keywords']);
  const idStr = readIntentHint(rec);

  const qTokens = tokenize(nq);
  if (qTokens.length === 0) return 0;

  // جذور نصوص الأسئلة.
  const faqStems: string[] = [];
  const normQs: string[] = [];
  for (const qs of questions) {
    const n = normalizeArabic(qs);
    if (!n) continue;
    normQs.push(n);
    for (const t of tokenize(n)) faqStems.push(t);
  }
  const joinedFaq = normQs.join(' ');

  let score = 0;
  const wOf = (t: string): number => (idf ? (idf.get(t) ?? 1) : 1);
  for (const t of qTokens) {
    if (faqStems.includes(t)) {
      score += 2 * wOf(t);
      continue;
    }
    // احتواء جزئي (بادئات/لواحق صرفية) بنقطة واحدة مرجحة.
    if (t.length >= 3) {
      let hit = false;
      for (const f of faqStems) {
        if (f.length >= 3 && (t.includes(f) || f.includes(t))) { hit = true; break; }
      }
      if (hit) score += 1 * wOf(t);
    }
  }

  // وزن أعلى لتطابق keywords — مع منع احتساب نفس جذر الاستعلام
  // أكثر من مرة عبر كلمات مختلفة (حتى لا تتضخم أسئلة تشترك
  // في جذور عامة مثل «صناع» في «المبادرات الصناعية» و«وزارة الصناعة»).
  const usedKwStems = new Set<string>();
  for (const kw of keywords) {
    const nk = normalizeArabic(kw);
    if (!nk) continue;
    if (nq.includes(nk) || nk.split(' ').some((w) => w && nq.includes(w) && w.length >= 3)) {
      const stems = tokenize(nk);
      // الاحتواء الحرفي الكامل للعبارة (شمس الصناعة) أقوى دليل تمييز.
      const fullPhrase = nk.includes(' ') && nq.includes(nk);
      score += 3 * (stems.length > 0 ? Math.max(...stems.map(wOf)) : 1) + (fullPhrase ? 5 : 0);
      for (const s of stems) usedKwStems.add(s);
      continue;
    }
    const kwStems = tokenize(nk);
    let hit = false;
    for (const ks of kwStems) {
      if (usedKwStems.has(ks)) continue;
      if (qTokens.includes(ks)) { score += 3 * wOf(ks); usedKwStems.add(ks); hit = true; break; }
    }
    if (hit) continue;
    for (const ks of kwStems) {
      if (usedKwStems.has(ks)) continue;
      for (const t of qTokens) {
        if (ks.length >= 3 && t.length >= 3 && (t.includes(ks) || ks.includes(t))) { hit = true; break; }
      }
      if (hit) break;
    }
    if (hit) score += 1;
  }

  // مكافأة النية المستنتجة.
  const qIntent = inferIntent(nq, synonyms);
  if (qIntent) {
    const fIntent = inferIntent(normalizeArabic(joinedFaq + ' ' + keywords.join(' ') + ' ' + idStr), synonyms);
    if (fIntent === qIntent) score += 5;
  }

  return score;
}

// ============================================================
// 3) الإجابة: اختيار FAQ + بيانات حية + اقتراحات وروابط
// ============================================================

function fallbackClarification(general: string[], hasNear = false): ChatAnswer {
  const body = hasNear
    ? 'مفهمتش سؤالك بالظبط — بس يمكن تقصد واحد من الأسئلة دي؟ اختر منها أو أعد الصياغة بكلمات مختلفة:'
    : 'معلش، مفهمتش سؤالك بالظبط — ممكن تعيد الصياغه بكلمات مختلفه؟ اختر من الاقتراحات التاليه:';
  const out = {
    textAr: body,
    links: [] as OutLink[],
    suggestions: general.slice(0, 3),
    via: 'kb' as const,
    // أسماء بديلة للتوافق مع مستهلكين يتوقعون حقول intent/text/confidence.
    intent: 'fallback',
    text: body,
    confidence: 0,
  };
  return out as unknown as ChatAnswer;
}

// ============================================================
// ردود المجاملة القصيرة (تحية/شكر/وداع) — تُفحص فقط عند الثقة
// المنخفضة (تحت العتبة) حتى لا تخطف أي سؤال حقيقي ناجح.
// ============================================================

function matchesAny(norm: string, phrases: string[]): boolean {
  for (const p of phrases) {
    if (norm === p || norm.startsWith(p + ' ')) return true;
  }
  return false;
}

// الصيغ بصيغ مطبّعة (normalizeArabic): الهمزات ا، ة→ه، ى→ي.
const GREETINGS: string[] = [
  'السلام عليكم', 'سلام عليكم', 'سلام', 'اهلا', 'اهلا وسهلا', 'هاي',
  'هلا', 'صباح الخير', 'مساء الخير', 'صباح النور', 'مساء النور',
  'ازيك', 'ازيكم', 'عامل ايه', 'اخبارك', 'اهلين', 'مرحبا',
];

const THANKS: string[] = [
  'شكرا', 'متشكر', 'متشكره', 'الف شكر', 'تسلم', 'تسلمي',
  'مشكور', 'ممنون', 'جزاك الله خير', 'جزاك الله خيرا',
];

const FAREWELLS: string[] = [
  'مع السلامه', 'باي', 'وداعا', 'الي اللقاء', 'اشوفك بعدين', 'تصبح علي خير',
];

function smallTalkReply(norm: string, general: string[]): ChatAnswer | null {
  if (!norm || norm.length > 60) return null;
  let kind: 'greeting' | 'thanks' | 'farewell' | null = null;
  if (matchesAny(norm, GREETINGS)) kind = 'greeting';
  else if (matchesAny(norm, THANKS)) kind = 'thanks';
  else if (matchesAny(norm, FAREWELLS)) kind = 'farewell';
  if (!kind) return null;
  const bodies: Record<string, string> = {
    greeting:
      'أهلاً بيك! نورت المنصة الوطنية للتمويل والمبادرات الصناعية. أقدر أساعدك تستعرض المبادرات، تفحص أهليتك، أو تعرف خطوات التقديم — تحب نبدأ بإيه؟',
    thanks:
      'العفو! سعيد إني قدرت أساعدك. لو احتجت أي حاجة تانية عن المبادرات أو التقديم أنا موجود.',
    farewell:
      'مع السلامة! بالتوفيق في التقديم، ولو احتجت أي مساعدة ارجع لي في أي وقت.',
  };
  const body = bodies[kind];
  const out = {
    textAr: body,
    links: [] as OutLink[],
    suggestions: general.slice(0, 3),
    via: 'kb' as const,
    intent: kind,
    text: body,
    confidence: 1,
  };
  return out as unknown as ChatAnswer;
}

// يلتقط قائمة من بيانات خام مجهولة الشكل (مصفوفة مباشرة أو مغلفة).
function unwrapList(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') as Array<Record<string, unknown>>;
  }
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    const keys = ['items', 'data', 'list', 'results', 'initiatives', 'applications'];
    for (const k of keys) {
      const v = rec[k];
      if (Array.isArray(v)) {
        return v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') as Array<Record<string, unknown>>;
      }
    }
  }
  return [];
}

// يلتقط أول حقل نصي متاح من قائمة مفاتيح مرشحة، مقلّماً لطول آمن.
function pickStr(obj: Record<string, unknown>, keys: string[], max = 60): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, max);
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('fetch-timeout')), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e instanceof Error ? e : new Error('fetch-failed')); },
    );
  });
}

// يجرب أسماء استعلام مرشحة بالترتيب (تحسباً لاختلاف التسمية في contract.ts)
// ويرجع أول نجاح، أو فشلاً آمناً بعد انتهاء المرشحين.
async function tryFetch(deps: EngineDeps, names: string[], args: Record<string, unknown>): Promise<{ ok: boolean; data: unknown }> {
  const fn = (deps as Record<string, unknown>)['fetch'];
  if (typeof fn !== 'function') return { ok: false, data: null };
  for (const n of names) {
    try {
      const data = await withTimeout((fn as FetchFn)(n as unknown as SafeQueryName, args), FETCH_TIMEOUT_MS);
      return { ok: true, data };
    } catch {
      // جرّب الاسم المرشح التالي.
    }
  }
  return { ok: false, data: null };
}

// يبني مجموعة طرق العرض الصالحة من الـsitemap أياً كان شكله
// (مصفوفة سلاسل، مصفوفة كائنات فيها view/name، أو مفاتيح كائن).
// فارغة = شكل مجهول = لا ترشيح (نقبل كل الروابط).
function validViewsFrom(sitemap: unknown): Set<string> {
  const set = new Set<string>();
  if (Array.isArray(sitemap)) {
    for (const e of sitemap) {
      if (typeof e === 'string' && e.trim()) { set.add(e.trim()); continue; }
      if (e && typeof e === 'object') {
        const rec = e as Record<string, unknown>;
        for (const k of ['view', 'name', 'key', 'id']) {
          const v = rec[k];
          if (typeof v === 'string' && v.trim()) set.add(v.trim());
        }
      }
    }
  } else if (sitemap && typeof sitemap === 'object') {
    for (const k of Object.keys(sitemap as Record<string, unknown>)) if (k.trim()) set.add(k.trim());
  }
  return set;
}

// روابط الـFAQ بعد التنقية: labelAr نصية، view أو initiativeId أحدهما
// على الأقل، وإسقاط أي view غريب عن الـsitemap (إن كان معلوماً). بحد 4.
function toLinks(raw: unknown, sitemap: unknown): OutLink[] {
  if (!Array.isArray(raw)) return [];
  const valid = validViewsFrom(sitemap);
  const out: OutLink[] = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const rec = e as Record<string, unknown>;
    const label = typeof rec['labelAr'] === 'string' && (rec['labelAr'] as string).trim()
      ? (rec['labelAr'] as string).trim().slice(0, 80)
      : 'فتح';
    const view = typeof rec['view'] === 'string' ? (rec['view'] as string).trim() : '';
    const initId = typeof rec['initiativeId'] === 'string' && (rec['initiativeId'] as string).trim()
      ? (rec['initiativeId'] as string).trim().slice(0, 80)
      : undefined;
    if (!view && !initId) continue;
    if (view && valid.size > 0 && !valid.has(view)) continue;
    const link: OutLink = { labelAr: label, view };
    if (initId) link.initiativeId = initId;
    out.push(link);
    if (out.length >= 4) break;
  }
  return out;
}

function firstQuestion(f: unknown): string | null {
  if (!f || typeof f !== 'object') return null;
  const qs = readQuestions(f as Record<string, unknown>);
  for (const x of qs) if (x.trim()) return x.trim().slice(0, 120);
  return null;
}

// أسئلة متابعة من نفس النية (باستثناء المختارة) مرتبة بالأعلى score،
// وتكملة من البدائل العامة.
function buildSuggestions(normQ: string, best: unknown, list: unknown[], synonyms: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const bestQ = firstQuestion(best);
  const intent = inferIntent(normQ, synonyms);
  if (intent) {
    const scored: Array<{ q: string; s: number }> = [];
    for (const f of list) {
      if (f === best) continue;
      if (!f || typeof f !== 'object') continue;
      const rec = f as Record<string, unknown>;
      const joined = readQuestions(rec).join(' ') + ' ' + readStringArray(rec['keywords']).join(' ');
      if (inferIntent(normalizeArabic(joined), synonyms) !== intent) continue;
      const fq = firstQuestion(f);
      if (fq && fq !== bestQ && !seen.has(fq)) {
        seen.add(fq);
        scored.push({ q: fq, s: scoreMatch(normQ, f, synonyms) });
      }
    }
    scored.sort((a, b) => b.s - a.s);
    for (const c of scored) {
      out.push(c.q);
      if (out.length >= 3) break;
    }
  }
  for (const s of SUGGESTED_STARTERS) {
    if (out.length >= 3) break;
    if (s !== bestQ && !seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

// يركّب جملة عربية من الطلبات المقلّمة فقط (لا يسرّب خام JSON أبداً).
function composeAppsSentence(data: unknown): string {
  const items = unwrapList(data).slice(0, 5);
  const n = items.length;
  if (n === 0) return 'لا توجد طلبات مسجله باسمك حتى الآن — قدّم من صفحه المبادرات.';
  const head = n === 1 ? 'لديك طلب واحد:' : n === 2 ? 'لديك طلبان:' : `لديك ${n} طلبات:`;
  const parts: string[] = [];
  for (const it of items.slice(0, 3)) {
    const title = pickStr(it, ['title', 'name', 'initiative', 'initiativeTitle', 'nameAr', 'label']);
    const status = pickStr(it, ['status', 'state', 'stage', 'statusAr']);
    if (title && status) parts.push(`${title} — ${status}`);
    else if (title) parts.push(title);
  }
  return parts.length > 0 ? `${head} ${parts.join('؛ ')}.` : `${head} تابعها من صفحه طلباتي.`;
}

// يركّب جملة عربية من المبادرات المقلّمة فقط.
function composeInitiativesSentence(data: unknown): string {
  const items = unwrapList(data).slice(0, 5);
  if (items.length === 0) return 'لا توجد مبادرات متاحه حالياً — تابعنا قريباً.';
  const names: string[] = [];
  for (const it of items.slice(0, 3)) {
    const t = pickStr(it, ['title', 'name', 'nameAr', 'label']);
    if (t) names.push(t);
  }
  const n = items.length;
  const head = n === 1 ? 'توجد حالياً مبادره واحده متاحه' : `يوجد حالياً ${n} مبادرات متاحه`;
  return names.length > 0 ? `${head}، منها: ${names.join('؛ ')}.` : `${head}.`;
}

export async function answer(input: unknown, deps: EngineDeps): Promise<ChatAnswer> {
  const d: EngineDeps = deps && typeof deps === 'object' ? deps : {};
  const general = SUGGESTED_STARTERS.slice(0, 3);

  const rawList = Array.isArray(d.faqs)
    ? (d.faqs as unknown[])
    : Array.isArray(d.faq)
      ? (d.faq as unknown[])
      : [];
  const text = typeof input === 'string' ? input : '';
  const norm = normalizeArabic(text);
  if (!norm || rawList.length === 0) return fallbackClarification(general);

  // اختيار أعلى FAQ فوق العتبة (مع تجاهل من لا نص إجابة له).
  // IDF من القائمة يرجّح الكلمات المميزة (شمس) على الشائعة (اقدم).
  const idf = buildIdf(rawList);
  let best: unknown = null;
  let bestScore = -1;
  for (const f of rawList) {
    if (!f || typeof f !== 'object') continue;
    if (!readAnswerText(f as Record<string, unknown>)) continue;
    const s = scoreMatch(text, f, d.keywords, idf);
    if (s > bestScore) { bestScore = s; best = f; }
  }
  if (!best || bestScore < ANSWER_THRESHOLD) {
    // مجاملة قصيرة أولاً (لا تخطف أسئلة ناجحة — نحن تحت العتبة هنا).
    const small = smallTalkReply(norm, general);
    if (small) return small;
    // ثقة منخفضة: اعرض أقرب 3 أسئلة حقيقية (أعلى scores) بدل الرد العام.
    const ranked: Array<{ f: unknown; s: number }> = [];
    for (const f of rawList) {
      if (!f || typeof f !== 'object') continue;
      if (!readAnswerText(f as Record<string, unknown>)) continue;
      if (!firstQuestion(f)) continue;
      ranked.push({ f, s: scoreMatch(text, f, d.keywords, idf) });
    }
    ranked.sort((a, b) => b.s - a.s);
    const near: string[] = [];
    for (const r of ranked) {
      if (r.s <= 0 || near.length >= 3) break;
      const q = firstQuestion(r.f);
      if (q && !near.includes(q)) near.push(q);
    }
    return fallbackClarification(near.length > 0 ? near : general, near.length > 0);
  }

  const rec = best as Record<string, unknown>;
  let body = (readAnswerText(rec) as string).trim();
  const links = toLinks(rec['links'], d.sitemap);
  const suggestions = buildSuggestions(norm, best, rawList, d.keywords);
  const loggedIn = readLoggedIn(d);
  const faqIntent = inferIntent(
    normalizeArabic(readQuestions(rec).join(' ') + ' ' + readStringArray(rec['keywords']).join(' ') + ' ' + readIntentHint(rec)),
    d.keywords,
  );
  const outIntent = inferIntent(norm, d.keywords) ?? faqIntent ?? readIntentHint(rec) ?? 'general';

  // بوابة الدخول: FAQ يتطلب مصادقة (requiresAuth) والزائر ضيف → توجيه لطيف بلا بيانات.
  if (rec['requiresAuth'] === true && !loggedIn) {
    const gate = {
      textAr: 'عشان تشوف طلباتك لازم تسجيل الدخول الأول من صفحه الدخول، وبعدها اسألني تاني.',
      links,
      suggestions,
      via: 'kb' as const,
      intent: outIntent || 'track',
      text: 'عشان تشوف طلباتك لازم تسجيل الدخول الأول من صفحه الدخول، وبعدها اسألني تاني.',
      confidence: scoreToConfidence(bestScore),
      requiresAuth: true,
      code: 'LOGIN_REQUIRED',
    };
    return gate as unknown as ChatAnswer;
  }

  // بيانات حية عند وجود عناصر نائبة في نص الإجابة فقط.
  const needsApps = /\{\{\s*myapps\s*\}\}/i.test(body);
  const needsInits = /\{\{\s*initiatives\s*\}\}/i.test(body);
  let via: 'kb' | 'live' = 'kb';
  let liveUsed = false;
  let liveOk = true;

  if (needsApps) {
    if (!loggedIn) {
      // غير مسجل: لا نستدعي fetch أصلاً، نوجّه للدخول.
      body = body.replace(/\{\{\s*myapps\s*\}\}/gi, 'سجل الدخول اولا من صفحه الحساب لعرض طلباتك');
    } else {
      liveUsed = true;
      const r = await tryFetch(d, ['myApps', 'getMyApplications', 'myApplications', 'listMyApplications'], {});
      if (!r.ok) {
        liveOk = false;
        body = body.replace(/\{\{\s*myapps\s*\}\}/gi, 'تعذر جلب طلباتك الآن — حاول بعد قليل');
      } else {
        body = body.replace(/\{\{\s*myapps\s*\}\}/gi, () => composeAppsSentence(r.data));
      }
    }
  }

  if (needsInits) {
    liveUsed = true;
    const r = await tryFetch(d, ['listInitiatives', 'getInitiative', 'initiatives', 'getInitiatives'], {});
    if (!r.ok) {
      liveOk = false;
      body = body.replace(/\{\{\s*initiatives\s*\}\}/gi, 'تعذر جلب المبادرات الآن — حاول بعد قليل');
    } else {
      body = body.replace(/\{\{\s*initiatives\s*\}\}/gi, () => composeInitiativesSentence(r.data));
    }
  }

  if (liveUsed && liveOk) via = 'live';

  // سقف طول نهائي لحماية الواجهة.
  if (body.length > MAX_ANSWER_LENGTH) body = body.slice(0, MAX_ANSWER_LENGTH);

  const out = {
    textAr: body,
    links,
    suggestions,
    via,
    // أسماء بديلة للتوافق (نفس القيم، لا منطق إضافي).
    intent: outIntent,
    text: body,
    confidence: scoreToConfidence(bestScore),
  };
  return out as unknown as ChatAnswer;
}

// ============================================================
// 4) أسئلة البداية المقترحة (6): استعراض/أهلية/تقديم/مبادراتي/متابعة/حساب
// ============================================================
export const SUGGESTED_STARTERS: string[] = [
  'اعرض المبادرات المتاحه',
  'ايه شروط الاهليه؟',
  'ازاي اقدم في مبادره؟',
  'ايه المبادرات المناسبه لي؟',
  'طلباتي وصلت لفين؟',
  'ازاي ادخل علي حسابي؟',
];
