// عقد الشات بوت — أنواع مشتركة فقط، بلا أي منطق أو وصول للبيانات.
// البوت بلا وصول مباشر للداتا بيز — فقط 3 استعلامات مقيدة عبر safeQueries.ts.

/** أسماء الاستعلامات المسموحة حصراً — أي اسم آخر مرفوض. */
export type SafeQueryName = 'listInitiatives' | 'getInitiative' | 'myApps';

/** رابط تنقل داخل التطبيق يعرضه البوت مع الإجابة. */
export interface ChatLink {
  labelAr: string;
  view: string;
  initiativeId?: string;
}

/** إجابة البوت الموحدة للواجهة. */
export interface ChatAnswer {
  textAr: string;
  links: ChatLink[];
  suggestions: string[];
  via: 'kb' | 'live';
}

/** الحد الأدنى من سياق الجلسة الذي يحتاجه البوت (بلا بيانات حساسة). */
export interface SafeContext {
  isLoggedIn: boolean;
}
