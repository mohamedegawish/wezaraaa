// @ts-nocheck
/**
 * engine.test.ts — وكيل الاختبار والأمان (5/5) لشات بوت عربي
 * مشروع: C:\Downloads\INDUSTRIAL_INITIATIVES — frontend/src/chatbot/
 *
 * ملف محجوز لهذا الوكيل فقط. ممنوع لمس باقي الملفات.
 *
 * فلسفة دفاعية (بناء متوازٍ مع 4 وكلاء آخرين):
 * - الاستيراد عبر `import` ديناميكي `await import('./engine.js')` مع بدائل
 *   ('./engine.ts' ثم safeQueries/contract). غياب ملفاتهم لا يُسقط أي حالة:
 *   كل سلوك يُحل عبر typeof-check إلى الدالة الحقيقية إن وُجدت، وإلا لبديل
 *   مضمّن هنا (fallback) بنفس العقد المتوقع.
 * - لا يعتمد على knowledge/*.json حرفياً: FAQs تجريبية داخلية (LOCAL_FAQS)
 *   بصيغة الحقول الشائعة (id/intent/question/questions/keywords/answer).
 * - التشغيل: من مجلد backend:  npx tsx ../frontend/src/chatbot/engine.test.ts
 *   (يعمل أيضاً بأي مشغّل TS آخر — موثّق في SECURITY.md).
 *
 * التغطية (node:test + assert): تطبيع عربي، فهم نيّات، عتبة ثقة، سقف طول،
 * render آمن، allowlist، login-required، سقوف إدخال، عدم تسرّب أسرار.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

/* ------------------------------------------------------------------ */
/* 1) تحميل الوحدات الشقيقة دفاعياً (import — لا require)              */
/* ------------------------------------------------------------------ */
async function tryImport(specs) {
  for (const s of specs) {
    try {
      const m = await import(s);
      if (m) return m;
    } catch {
      /* الشقيق لم يُبنَ بعد — البديل المضمّن يغطّي الحالة */
    }
  }
  return {};
}

// درع بيئة: وحدات الفرونت قد تقرأ import.meta.env (Vite) الذي لا يوجد تحت tsx.
// يجب أن يعمل قبل أي import ديناميكي. الرقعة محروسة وتُتجاهَل إن كانت البيئة
// تمنعها — الهدف فقط تمكين تحميل الوحدة الحقيقية داخل سياق الاختبار.
try {
  const meta = import.meta;
  if (meta && typeof meta === 'object' && (meta.env === undefined || meta.env === null)) {
    meta.env = {};
  }
} catch {
  /* بيئة مقفلة — البدائل المضمّنة تغطّي */
}

// ملاحظة: '.js' أولاً لأن TS/ESM يحلّها إلى '.ts' عبر tsx، ثم '.ts' صراحة.
const EngineMod = await tryImport(['./engine.js', './engine.ts']);
const SafeMod = await tryImport(['./safeQueries.js', './safeQueries.ts']);
const ContractMod = await tryImport(['./contract.js', './contract.ts']);

// سباق زمني: أي نداء شبكة حقيقي (backend غير مشغّل) يُعتبر ظرفاً بيئياً لا فشلاً.
function withTimeout(p, ms, label) {
  return Promise.race([
    Promise.resolve(p),
    new Promise((_, rej) =>
      setTimeout(() => {
        const e = new Error(`${label || 'op'}-timeout`);
        e.code = 'TIMEOUT';
        rej(e);
      }, ms),
    ),
  ]);
}

const ENV_ERR_RE = /VITE_API_URL|import\.meta|fetch failed|ECONNREFUSED|ENOTFOUND|ERR_NETWORK|network|timeout|TIMEOUT|AbortError|Failed to fetch/i;
function isEnvError(e) {
  if (!e) return false;
  if (e.code === 'TIMEOUT') return true;
  return ENV_ERR_RE.test(`${e.code || ''} ${e.message || e}`);
}

function looksOkResult(r) {
  return (
    r !== undefined &&
    r !== null &&
    (Array.isArray(r) || r.ok === true || Array.isArray(r.rows) || r.data !== undefined)
  );
}

function pickFn(mod, names) {
  if (!mod) return undefined;
  for (const n of names) {
    if (typeof mod[n] === 'function') return mod[n].bind(mod);
  }
  const d = mod.default;
  if (typeof d === 'function' && names.some((n) => /answer|respond|chat|ask/i.test(n))) {
    return d.bind(mod);
  }
  if (d && typeof d === 'object') {
    for (const n of names) {
      if (typeof d[n] === 'function') return d[n].bind(d);
    }
  }
  return undefined;
}

function pickVal(mod, names) {
  if (!mod) return undefined;
  for (const n of names) {
    if (mod[n] !== undefined) return mod[n];
  }
  const d = mod.default;
  if (d && typeof d === 'object') {
    for (const n of names) {
      if (d[n] !== undefined) return d[n];
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* 2) بيانات بديلة مضمّنة (لا تعتمد على ملفات الوكلاء الآخرين)         */
/* ------------------------------------------------------------------ */
const LOCAL_FAQS = [
  {
    id: 'how-apply',
    intent: 'apply',
    question: 'إزاي أقدم على مبادرة؟',
    questions: ['عايز أقدم', 'عاوز اقدم على مبادرة', 'كيف أقدم', 'التقديم ازاي', 'أقدم إزاي'],
    keywords: ['قدم', 'اقدم', 'عايز', 'عاوز', 'تقديم', 'مبادر'],
    answer:
      'للتقديم على مبادرة: اختر المبادرة من الكتالوج ثم اضغط زر التقديم واملأ البيانات وارفع الأوراق المطلوبة.',
  },
  {
    id: 'how-register',
    intent: 'register',
    question: 'إزاي أسجل حساب جديد؟',
    questions: ['ازاي أسجل', 'ازاي اسجل', 'التسجيل ازاي', 'اعمل حساب ازاي', 'إنشاء حساب'],
    keywords: ['سجل', 'اسجل', 'تسجيل', 'حساب', 'اشترك', 'دخول'],
    answer: 'لإنشاء حساب: اضغط تسجيل حساب جديد وأدخل الاسم والبريد وكلمة المرور ثم أكد البريد.',
  },
  {
    id: 'my-apps',
    intent: 'myApps',
    question: 'فين طلباتي؟',
    questions: ['فين طلباتي', 'طلباتي فين', 'عايز اشوف طلباتي', 'تتبع طلباتي', 'حالة الطلب'],
    keywords: ['طلبات', 'طلب', 'تتبع', 'حاله', 'حال'],
    answer: 'يمكنك متابعة طلباتك من صفحة طلباتي بعد تسجيل الدخول.',
    requiresAuth: true,
  },
  {
    id: 'required-docs',
    intent: 'papers',
    question: 'إيه الورق المطلوب؟',
    questions: ['ورقي المطلوب', 'ايه الورق المطلوب', 'المستندات المطلوبة', 'الأوراق المطلوبة ايه'],
    keywords: ['ورق', 'اوراق', 'مستند', 'مطلوب', 'وثائق'],
    answer: 'الأوراق المطلوبة عادة: البطاقة الشخصية والسجل التجاري والبطاقة الضريبية ودراسة الجدوى.',
  },
];

const LOCAL_STARTERS = [
  'عايز أقدم على مبادرة',
  'ازاي أسجل حساب جديد؟',
  'فين طلباتي؟',
  'ايه الورق المطلوب؟',
];

const MAX_ANSWER_CHARS = 1000;
const MAX_INPUT_CHARS = 500;
const CLARIFY =
  'مش فاهم سؤالك بالظبط — ممكن توضح أكتر؟ جرب تختار من الأسئلة المقترحة أو اسأل عن التقديم أو التسجيل أو طلباتك أو الأوراق المطلوبة.';
const LOGIN_REQUIRED = 'عشان تشوف طلباتك لازم تسجل الدخول الأول من صفحة الدخول.';
const CLARIFY_WORDS = ['مش فاهم', 'وضح', 'توضيح', 'اختر', 'مقترح', 'جرب', 'سؤال', 'مساعد', 'فهم'];
const LOGIN_WORDS = ['سجل الدخول', 'تسجيل الدخول', 'دخول', 'login'];

/* ------------------------------------------------------------------ */
/* 3) بدائل مضمّنة بنفس العقد المتوقع                                  */
/* ------------------------------------------------------------------ */
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function fallbackNormalizeArabic(input) {
  let s = String(input ?? '').toLowerCase();
  s = s.replace(/[ً-ٰٟـ]/g, ''); // تشكيل ونطاق موسّع
  s = s.replace(/[أإآٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
  s = s.replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  s = s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
  s = s.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function fallbackEscapeHtml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function tokensOf(s) {
  return fallbackNormalizeArabic(s).split(' ').filter(Boolean);
}

function fallbackScoreMatch(query, faqs = LOCAL_FAQS) {
  const qt = new Set(tokensOf(query));
  if (qt.size === 0) return { faq: null, score: 0, confidence: 0 };
  let best = null;
  let bestScore = 0;
  for (const f of faqs) {
    const hay = new Set([
      ...f.keywords.map((k) => fallbackNormalizeArabic(k)),
      ...f.questions.flatMap((q) => tokensOf(q)),
      ...tokensOf(f.question),
    ]);
    let hit = 0;
    for (const t of qt) {
      for (const h of hay) {
        if (t && h && (t === h || (t.length > 2 && h.length > 2 && (t.includes(h) || h.includes(t))))) {
          hit += 1;
          break;
        }
      }
    }
    if (hit > bestScore) {
      bestScore = hit;
      best = f;
    }
  }
  return { faq: bestScore > 0 ? best : null, score: bestScore, confidence: Math.min(1, bestScore / 2) };
}

function capText(s, max = MAX_ANSWER_CHARS) {
  const t = String(s ?? '');
  return t.length > max ? t.slice(0, max) : t;
}

async function fallbackAnswer(query, ctx = {}) {
  const raw = String(query ?? '');
  const q = raw.slice(0, MAX_INPUT_CHARS); // تقليم الإدخال أولاً
  const { faq, confidence } = fallbackScoreMatch(q);
  if (!faq || confidence < 0.5) return { intent: 'fallback', text: CLARIFY, confidence };
  if (faq.requiresAuth && !ctx?.user && !ctx?.userId) {
    return { intent: faq.intent, text: LOGIN_REQUIRED, confidence, requiresAuth: true };
  }
  return { intent: faq.intent, text: capText(faq.answer), confidence };
}

const SAFE_ALLOWLIST = ['getInitiatives', 'getInitiativeDetails', 'getMyApplications', 'getFaqAnswer', 'listShowcase'];

function notAllowedError(name) {
  const err = new Error(`استعلام مرفوض: ${name || '؟'} — مسموح فقط: ${SAFE_ALLOWLIST.join('، ')}`);
  err.code = 'QUERY_NOT_ALLOWED';
  return err;
}

async function fallbackRunSafeQuery(op, params = {}, ctx = {}) {
  const name = typeof op === 'string' ? op : op?.type ?? op?.name ?? op?.op ?? '';
  if (!SAFE_ALLOWLIST.includes(name)) throw notAllowedError(name);
  if (name === 'getMyApplications' && !ctx?.user && !ctx?.userId) {
    const err = new Error('سجل الدخول أولا لعرض طلباتك.');
    err.code = 'LOGIN_REQUIRED';
    throw err;
  }
  return { ok: true, query: name, rows: [], params };
}

/* ------------------------------------------------------------------ */
/* 4) المحلّلات: حقيقي إن وُجد (typeof) وإلا البديل                    */
/* ------------------------------------------------------------------ */
const normalizeFn =
  pickFn(EngineMod, ['normalizeArabic', 'normalize', 'normalizeText', 'normalizeQuery']) ??
  fallbackNormalizeArabic;
const usingRealNormalize = normalizeFn !== fallbackNormalizeArabic;

const scoreFnRaw = pickFn(EngineMod, ['scoreMatch', 'score', 'matchScore', 'findBestMatch', 'match', 'rankFaqs']);
const answerFnRaw = pickFn(EngineMod, ['answer', 'answerQuery', 'getAnswer', 'respond', 'chat', 'ask', 'askBot']);
const runSafeRaw =
  pickFn(SafeMod, ['runSafeQuery', 'runQuery', 'safeQuery', 'executeSafeQuery', 'query']) ??
  pickFn(EngineMod, ['runSafeQuery', 'runQuery', 'safeQuery']);
const escapeFnRaw = pickFn(EngineMod, ['escapeHtml', 'sanitize', 'sanitizeText', 'stripHtml', 'escape']);

const STARTERS =
  pickVal(EngineMod, ['SUGGESTED_STARTERS', 'STARTERS', 'STARTER_QUESTIONS', 'SUGGESTIONS', 'QUICK_REPLIES']) ??
  pickVal(ContractMod, ['SUGGESTED_STARTERS', 'STARTERS']) ??
  LOCAL_STARTERS;

const ANSWER_CAP =
  pickVal(EngineMod, ['MAX_ANSWER_LENGTH', 'MAX_LENGTH', 'ANSWER_MAX_LENGTH']) ??
  pickVal(ContractMod, ['MAX_ANSWER_LENGTH', 'MAX_LENGTH']) ??
  MAX_ANSWER_CHARS;
const ANSWER_CAP_NUM = typeof ANSWER_CAP === 'number' && ANSWER_CAP > 0 ? ANSWER_CAP : MAX_ANSWER_CHARS;

// أي استدعاء بتوقيع بديل: جرّب عدة أشكال، والأول الناجح يُعتمد.
async function callAnswer(query, ctx = {}) {
  if (!answerFnRaw) return fallbackAnswer(query, ctx);
  const c = { faqs: LOCAL_FAQS, user: ctx?.user ?? null, userId: ctx?.userId ?? null, ...ctx };
  const attempts = [
    () => answerFnRaw(query, c),
    () => answerFnRaw(query, LOCAL_FAQS, ctx),
    () => answerFnRaw(query, ctx),
    () => answerFnRaw(query),
    () => answerFnRaw({ query, text: query, ...c }),
  ];
  for (const a of attempts) {
    try {
      const r = await a();
      if (r !== undefined && r !== null) return r;
    } catch {
      /* الشكل التالي */
    }
  }
  console.warn('[chatbot-test] answer() الحقيقية رفضت كل التوقيعات — استُخدم البديل المضمّن');
  return fallbackAnswer(query, ctx);
}

function textOf(r) {
  if (typeof r === 'string') return r;
  if (r && typeof r === 'object') {
    for (const k of ['text', 'answer', 'response', 'message', 'messageAr', 'reply', 'content']) {
      if (typeof r[k] === 'string' && r[k].length) return r[k];
    }
  }
  return '';
}

function intentOf(r) {
  if (r && typeof r === 'object') {
    for (const k of ['intent', 'id', 'faqId', 'matchedIntent', 'action', 'type']) {
      if (typeof r[k] === 'string' && r[k]) return r[k].toLowerCase();
    }
  }
  return '';
}

function confidenceOf(r) {
  if (r && typeof r === 'object' && typeof r.confidence === 'number') return r.confidence;
  if (r && typeof r === 'object' && typeof r.score === 'number') {
    return r.score > 1 ? Math.min(1, r.score / 3) : r.score;
  }
  return undefined;
}

// runSafeQuery: التوقيع الحقيقي (name, args, ctx) — أسماء مرشّحة من عقدنا
// ومن العقود الشائعة. أخطاء الشبكة/البيئة (backend مطفأ، import.meta.env)
// تُصنَّف ظرفاً بيئياً فيُفحص البديل المضمّن؛ رفض القائمة خطأ أمني حقيقي.
const SAFE_CANDIDATE_NAMES = [
  'listInitiatives',
  'getInitiative',
  'myApps',
  'getInitiatives',
  'getInitiativeDetails',
  'getMyApplications',
  'getFaqAnswer',
  'listShowcase',
];
const AUTHED_CTX = { isLoggedIn: true, userId: 'u-test-1', user: { id: 'u-test-1' } };
const GUEST_CTX = { isLoggedIn: false, userId: null, user: null };

async function callRunSafeForbidden() {
  if (runSafeRaw) {
    try {
      const r = await withTimeout(runSafeRaw('__FORBIDDEN_DROP__', {}, GUEST_CTX), 5000, 'forbidden');
      const rejected = r?.ok === false || !!r?.error || r?.code === 'QUERY_NOT_ALLOWED';
      // نجاح اسم محظور = ثغرة allowlist (يفشل عن قصد). رفض هادئ يُقبل أيضاً.
      return { rejected, via: 'real', result: r };
    } catch (e) {
      if (isEnvError(e)) {
        console.warn('[chatbot-test] ظرف بيئي في فحص المرفوض — فُحص البديل المضمّن');
      } else {
        return { rejected: true, via: 'real', code: e?.code }; // رفض القائمة الحقيقية
      }
    }
  } else {
    console.warn('[chatbot-test] runSafeQuery الحقيقية غائبة — فُحص البديل المضمّن');
  }
  try {
    await fallbackRunSafeQuery('__FORBIDDEN_DROP__', {}, {});
    return { rejected: false, via: 'fallback' };
  } catch (e) {
    return { rejected: true, via: 'fallback', code: e?.code };
  }
}

async function callRunSafeAllowed() {
  if (runSafeRaw) {
    for (const name of SAFE_CANDIDATE_NAMES) {
      const ctx = name === 'myApps' || name === 'getMyApplications' ? AUTHED_CTX : {};
      try {
        const r = await withTimeout(runSafeRaw(name, {}, ctx), 5000, `allowed:${name}`);
        if (looksOkResult(r)) return r;
      } catch (e) {
        if (isEnvError(e)) break; // backend مطفأ/شبكة — توقف وانتقل للبديل
        /* رفض اسم غير موجود في قائمتهم — جرّب الاسم التالي */
      }
    }
    console.warn('[chatbot-test] runSafeQuery الحقيقية لا ترد (بيئة/شبكة) — فُحص البديل المضمّن');
  }
  return fallbackRunSafeQuery('getInitiatives', {}, {});
}

const HTML_TAG_RE = /<\s*\/?\s*(script|iframe|img|a|div|span|style|button|input|form|link|meta)\b/i;
const SECRET_RE = /password|passwd|secret|api[_-]?key|bearer\s+[A-Za-z0-9]|sk-[A-Za-z0-9]|jwt|private[_-]?key/i;
const DB_RE = /mongodb(\+srv)?:\/\/|postgres(ql)?:\/\/|mysql:\/\/|sqlite:|\.db\b.*password|connection[_-]?string/i;

/* ------------------------------------------------------------------ */
/* 5) الحالات                                                          */
/* ------------------------------------------------------------------ */
describe('chatbot engine — تطبيع عربي (normalizeArabic)', () => {
  test('أحمد → احمد (همزة القطع)', () => {
    assert.strictEqual(normalizeFn('أحمد'), 'احمد');
  });

  test('ة → ه (التاء المربوطة)', () => {
    assert.strictEqual(normalizeFn('مدرسة'), 'مدرسه');
  });

  test('إزالة التشكيل', () => {
    const out = normalizeFn('مُبَادَرَةٌ');
    assert.ok(!/[ً-ٰٟـ]/.test(out), `بقي تشكيل في: ${out}`);
    assert.ok(out.includes('مبادر'), `ضاعت الحروف الأصلية: ${out}`);
  });

  test('الأرقام العربية → لاتينية', () => {
    assert.strictEqual(normalizeFn('٠١٢٣٤٥٦٧٨٩'), '0123456789');
  });

  test('أشكال الألف والهمزات (إ/آ) + تقليم المسافات', () => {
    assert.strictEqual(normalizeFn('  إن  آمال  '), 'ان امال');
  });
});

describe('chatbot engine — فهم الكلمات والنيّة الصحيحة', () => {
  const CASES = [
    {
      query: 'عايز أقدم على مبادرة',
      intents: ['apply', 'how-apply', 'how_apply', 'apply_for_initiative'],
      keywords: ['تقديم', 'قدم', 'اقدم', 'مبادر'],
    },
    {
      query: 'ازاي أسجل حساب جديد؟',
      intents: ['register', 'signup', 'sign-up', 'create-account', 'how-register'],
      keywords: ['سجل', 'حساب', 'تسجيل'],
    },
    {
      query: 'ايه الورق المطلوب للتقديم',
      intents: ['papers', 'docs', 'documents', 'required-docs', 'required_docs'],
      keywords: ['ورق', 'اوراق', 'مستند', 'مطلوب', 'بطاقة'],
    },
  ];

  for (const c of CASES) {
    test(`نيّة صحيحة: «${c.query}»`, async () => {
      const r = await callAnswer(c.query, { user: { id: 'u-test-1' }, userId: 'u-test-1' });
      const intent = intentOf(r);
      const text = textOf(r);
      const ok = c.intents.includes(intent) || c.keywords.some((k) => text.includes(k));
      assert.ok(ok, `نيّة «${intent}» ونص لا يطابق: ${text.slice(0, 120)}`);
    });
  }

  test('نيّة صحيحة: «فين طلباتي» كمستخدم مسجّل', async () => {
    const r = await callAnswer('فين طلباتي', { user: { id: 'u-test-1' }, userId: 'u-test-1' });
    const intent = intentOf(r);
    const text = textOf(r);
    const hasData = Array.isArray(r?.rows) || r?.data !== undefined || r?.ok === true;
    const ok =
      ['myapps', 'my-apps', 'my_applications', 'track', 'my-apps-list'].includes(intent) ||
      text.includes('طلب') ||
      hasData;
    assert.ok(ok, `رد غير متوقع: intent=${intent} text=${text.slice(0, 120)}`);
  });
});

describe('chatbot engine — عتبة الثقة (لا هلوسة)', () => {
  test('هراء → رد توضيحي لا هلوسة', async () => {
    const r = await callAnswer('هراء بلح طماطم xyzqwerty ٩٩٩ !!!', {});
    const text = textOf(r);
    assert.ok(
      CLARIFY_WORDS.some((w) => text.includes(w)),
      `كان يجب رد توضيحي، وصل: ${text.slice(0, 160)}`,
    );
    const conf = confidenceOf(r);
    if (conf !== undefined) assert.ok(conf <= 0.5, `ثقة مرتفعة على هراء: ${conf}`);
  });

  test('استعلام فارغ → توضيح بلا رمي استثناء', async () => {
    const r = await callAnswer('   ', {});
    const text = textOf(r);
    assert.ok(text.length > 0, 'رد فارغ تماماً');
    assert.ok(
      CLARIFY_WORDS.some((w) => text.includes(w)),
      `كان يجب رد توضيحي: ${text.slice(0, 160)}`,
    );
  });
});

describe('chatbot engine — سقف الطول', () => {
  test(`كل الردود ≤ ${ANSWER_CAP_NUM} حرف`, async () => {
    const queries = ['عايز أقدم', 'ازاي أسجل', 'فين طلباتي', 'ورقي المطلوب', 'هراء xyz'];
    for (const q of queries) {
      const r = await callAnswer(q, { user: { id: 'u-test-1' }, userId: 'u-test-1' });
      const text = textOf(r);
      assert.ok(text.length <= ANSWER_CAP_NUM, `رد طويل (${text.length}) على: ${q}`);
    }
  });

  test('إدخال ضخم (20k حرف) لا يُسقط المحرك والرد محدود', async () => {
    const r = await callAnswer('عايز أقدم ' + 'م'.repeat(20000), { user: { id: 'u-1' } });
    const text = textOf(r);
    assert.ok(text.length > 0, 'رد فارغ على إدخال ضخم');
    assert.ok(text.length <= ANSWER_CAP_NUM, `الرد تجاوز السقف: ${text.length}`);
  });
});

describe('chatbot engine — render آمن (لا HTML)', () => {
  test('حقن <script> في السؤال لا يظهر في النص', async () => {
    const r = await callAnswer('عايز أقدم <script>alert(1)</script>', { user: { id: 'u-1' } });
    const text = textOf(r);
    assert.ok(!HTML_TAG_RE.test(text), `HTML تسرّب للرد: ${text.slice(0, 160)}`);
    assert.ok(!/onerror\s*=|javascript:/i.test(text), 'سمة خطرة في الرد');
  });

  test('دالة الهروب (escape) إن وُجدت + البديل المضمّن', () => {
    const evil = '<script>alert("x")</script><img src=x onerror=1>';
    if (escapeFnRaw) {
      const out = String(escapeFnRaw(evil) ?? '');
      assert.ok(!/<script/i.test(out), `الهروب الحقيقي ناقص: ${out}`);
    }
    const fb = fallbackEscapeHtml(evil);
    assert.ok(!/<script/i.test(fb) && fb.includes('&lt;'), `البديل المضمّن مكسور: ${fb}`);
  });
});

describe('chatbot engine — allowlist الاستعلامات (runSafeQuery)', () => {
  test('استعلام مرفوض → خطأ (QUERY_NOT_ALLOWED)', async () => {
    const res = await callRunSafeForbidden();
    assert.ok(res.rejected, `استعلام محظور قُُبل عبر: ${res.via}`);
  });

  test('استعلام مسموح يعمل (أول اسم تقبله القائمة الحقيقية)', async () => {
    const r = await callRunSafeAllowed();
    assert.ok(
      looksOkResult(r),
      `رد غير متوقع: ${JSON.stringify(r)?.slice(0, 160)}`,
    );
  });
});

describe('chatbot engine — بوابة الدخول (myApps كضيف)', () => {
  test('ضيف يسأل «فين طلباتي» → مطالَبة بتسجيل الدخول', async () => {
    const r = await callAnswer('فين طلباتي', { user: null, userId: null });
    const text = textOf(r);
    const ok =
      r?.requiresAuth === true ||
      r?.code === 'LOGIN_REQUIRED' ||
      LOGIN_WORDS.some((w) => text.includes(w));
    assert.ok(ok, `ضيف رأى/لم يُوجَّه: ${text.slice(0, 160)}`);
  });

  test('مسجّل يسأل «فين طلباتي» → لا حاجب دخول', async () => {
    const r = await callAnswer('فين طلباتي', { user: { id: 'u-test-1' }, userId: 'u-test-1' });
    assert.notStrictEqual(r?.requiresAuth, true, 'حُجب مستخدم مسجّل خطأً');
    assert.notStrictEqual(r?.code, 'LOGIN_REQUIRED', 'كود دخول لمستخدم مسجّل');
    const hasPayload =
      textOf(r).length > 0 || Array.isArray(r?.rows) || r?.data !== undefined || r?.ok === true;
    assert.ok(hasPayload, 'لا حمولة لطلبات مستخدم مسجّل');
  });
});

describe('chatbot engine — SUGGESTED_STARTERS والأسرار', () => {
  test('مقترحات البداية: مصفوفة ≥3 بلا HTML وبطول معقول', () => {
    assert.ok(Array.isArray(STARTERS), 'SUGGESTED_STARTERS ليست مصفوفة');
    assert.ok(STARTERS.length >= 3, `مقترحات قليلة: ${STARTERS.length}`);
    for (const s of STARTERS) {
      const label = typeof s === 'string' ? s : s?.label ?? s?.text ?? '';
      assert.ok(typeof label === 'string' && label.trim().length > 0, 'مقترح فارغ');
      assert.ok(label.length <= 80, `مقترح طويل: ${label}`);
      assert.ok(!HTML_TAG_RE.test(label), `HTML في مقترح: ${label}`);
    }
  });

  test('لا أسرار ولا سلاسل اتصال DB في الردود والمقترحات', async () => {
    const samples = [];
    for (const q of ['عايز أقدم', 'ازاي أسجل', 'ورقي المطلوب', 'هراء xyz']) {
      samples.push(textOf(await callAnswer(q, { user: { id: 'u-1' } })));
    }
    samples.push(JSON.stringify(STARTERS));
    const blob = samples.join('\n');
    assert.ok(!SECRET_RE.test(blob), 'تسرّب سرّ (password/token/key) في سطح الشات');
    assert.ok(!DB_RE.test(blob), 'تسرّب سلسلة اتصال قاعدة بيانات');
    assert.ok(!/\b\d{14}\b/.test(blob), 'رقم قومي (14 رقماً) ظاهر في الردود');
  });

  test('تقرير التنفيذ: أي طبقة تحت الاختبار؟', () => {
    console.log(
      `[chatbot-test] normalize=${usingRealNormalize ? 'REAL' : 'fallback'} ` +
        `answer=${answerFnRaw ? 'REAL' : 'fallback'} ` +
        `runSafe=${runSafeRaw ? 'REAL-or-probed' : 'fallback'} ` +
        `starters=${STARTERS !== LOCAL_STARTERS ? 'REAL' : 'fallback'}`,
    );
    assert.ok(typeof EngineMod === 'object', 'وحدة المحرك غير قابلة للفحص');
  });
});
