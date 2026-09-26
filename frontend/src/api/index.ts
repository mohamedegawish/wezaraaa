// نقطة دخول طبقة API — كل بيانات الفرونت من الباك فقط (لا بيانات ثابتة).
// الإعداد الوحيد عبر .env: VITE_API_URL=http://localhost:4000
export { api } from './endpoints';
export { API_BASE, ApiException, resolveCoverUrl } from './client';
export * from './schemas';
