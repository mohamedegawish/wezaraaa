// دوال الراوتس — كل دالة = راوت واحد من ROUTES.
// API-only: لا توجد بيانات ثابتة في الفرونت إطلاقاً — كل شيء من باك SQLite (Seeder).
import { apiFetch, apiFetchBlob, setAccessToken, clearTokens } from './client';
import { store } from '../store/state';
import type {
  CreateApplicationReq, CreateApplicationRes, CreateDecisionReq, CreateDecisionRes,
  CreateOrganizationReq, CreateOrgUserReq, UpdateOrgUserReq,
  ListApplicationsQuery, ListInitiativesQuery, ListMessagesQuery, ListOrganizationsQuery, ListUsersQuery,
  MessageShape, SendMessageReq,
  OrganizationShape, Paginated, ApplicationListItem,
  InitiativeListItem, SwitchUserRes, UpdateCustomizationReq, UpdateFactoryReq,
  UpdateOrganizationReq, UpdateWorkflowReq, UpsertInitiativeReq,
  UserShape, RegisterFactoryReq, RegisterFactoryRes,
  ChatConversationsRes, ChatMessageShape, ChatMessagesRes, ChatReadMarkers, ChatUnreadSummary,
  ChatOversightItem, ChatOversightMessagesRes,
  GetKpisRes, UpdateKpisReq, UpdateKpisRes, DuplicateInitiativeRes, LogExportReq,
  HomeBannerRes, ListHomeBannersRes, UpsertHomeBannerReq,
} from './schemas';

function ctx() {
  return { userId: store.currentUser.id, lang: store.language as 'ar' | 'en' };
}

/** Fetches ALL pages through the backend 100-row cap (no silent truncation past 100 rows). */
async function fetchAllPages<T>(path: string, extra?: Record<string, string | number | undefined>): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  for (;;) {
    const r = await apiFetch<{ data: T[]; total: number; page: number; pageSize: number }>(
      path, { query: { page, pageSize: 100, ...extra }, ...ctx() },
    );
    out.push(...(r.data ?? []));
    if (out.length >= (r.total ?? 0) || (r.data ?? []).length === 0) break;
    page += 1;
    if (page > 50) break; // safety cap: 5000 rows
  }
  return out;
}

export type { RegisterFactoryReq, RegisterFactoryRes };

export const api = {
  // JWT login — access in memory, refresh as httpOnly cookie (P0-1).
  async login(email: string, password: string) {
    const r = await apiFetch<{ message: string; status: 'ok'; data: { accessToken: string; refreshToken: string; mustChangePassword: boolean; user: UserShape } }>('/api/v1/auth/login', { method: 'POST', body: { email, password } });
    setAccessToken(r.data.accessToken);
    return r;
  },
  // Public factory self-registration — creates org + factory + owner.
  // In test, auto-verified + tokens; in prod/dev, requires email verification (no tokens).
  async registerFactory(req: RegisterFactoryReq): Promise<RegisterFactoryRes> {
    const r = await apiFetch<RegisterFactoryRes>('/api/v1/factories/register', { method: 'POST', body: req });
    if ((r.data as { accessToken?: string }).accessToken) setAccessToken((r.data as { accessToken?: string }).accessToken!);
    return r;
  },
  async changePassword(currentPassword: string, newPassword: string) {
    return apiFetch<{ message: string; status: 'ok' }>('/api/v1/auth/change-password', {
      method: 'POST', body: { currentPassword, newPassword }, ...ctx(),
    });
  },
  async verifyEmail(token: string) {
    return apiFetch<{ message: string; status: 'ok'; data: { email: string } }>('/api/v1/auth/verify-email', { method: 'POST', body: { token } });
  },
  async resendVerification(email: string) {
    return apiFetch('/api/v1/auth/resend-verification', { method: 'POST', body: { email } });
  },
  async logout() {
    try { await apiFetch('/api/v1/auth/logout', { method: 'POST', body: {} }); } catch { /* noop */ }
    clearTokens();
  },
  health() {
    return apiFetch<{ status: 'ok'; version: string; time: string }>('/api/v1/health', { ...ctx() });
  },
  me() {
    return apiFetch<{ message: string; status: 'ok'; data: UserShape }>('/api/v1/users/me', { ...ctx() });
  },
  switchUser(userId: string): Promise<SwitchUserRes> {
    return apiFetch<SwitchUserRes>('/api/v1/auth/switch-user', { method: 'POST', body: { userId }, ...ctx() });
  },
  listUsers(q: ListUsersQuery): Promise<Paginated<UserShape>> {
    return apiFetch<Paginated<UserShape>>('/api/v1/users', { query: q as Record<string, string | number | undefined>, ...ctx() });
  },
  createUser(req: CreateOrgUserReq) {
    return apiFetch<{ message: string; status: 'ok'; data: { id: string } }>('/api/v1/users', { method: 'POST', body: req, ...ctx() });
  },
  updateUser(userId: string, req: UpdateOrgUserReq) {
    return apiFetch<{ message: string; status: 'ok'; data: { id: string } }>(`/api/v1/users/${userId}`, { method: 'PUT', body: req, ...ctx() });
  },
  deleteUser(userId: string) {
    return apiFetch<{ message: string; status: 'ok' }>(`/api/v1/users/${userId}`, { method: 'DELETE', ...ctx() });
  },
  listOrganizations(q: ListOrganizationsQuery): Promise<Paginated<OrganizationShape>> {
    return apiFetch<Paginated<OrganizationShape>>('/api/v1/organizations', { query: q as Record<string, string | number | undefined>, ...ctx() });
  },
  createOrganization(req: CreateOrganizationReq) {
    return apiFetch<{ message: string; status: 'ok'; data: { id: string } }>('/api/v1/organizations', { method: 'POST', body: req, ...ctx() });
  },
  updateOrganization(orgId: string, patch: UpdateOrganizationReq) {
    return apiFetch(`/api/v1/organizations/${orgId}`, { method: 'PUT', body: patch, ...ctx() });
  },
  listInitiatives(q: ListInitiativesQuery): Promise<Paginated<InitiativeListItem>> {
    return apiFetch<Paginated<InitiativeListItem>>('/api/v1/initiatives', { query: q as Record<string, string | number | undefined>, ...ctx() });
  },
  updateCustomization(initiativeId: string, patch: UpdateCustomizationReq) {
    return apiFetch(`/api/v1/initiatives/${initiativeId}/customization`, { method: 'PUT', body: patch, ...ctx() });
  },
  // مؤشرات قياس الأداء — ADMIN ONLY (ministry_admin / initiative_manager)
  getInitiativeKpis(initiativeId: string): Promise<GetKpisRes> {
    return apiFetch<GetKpisRes>(`/api/v1/initiatives/${initiativeId}/kpis`, { ...ctx() });
  },
  updateInitiativeKpis(initiativeId: string, req: UpdateKpisReq): Promise<UpdateKpisRes> {
    return apiFetch<UpdateKpisRes>(`/api/v1/initiatives/${initiativeId}/kpis`, { method: 'PUT', body: req, ...ctx() });
  },
  updateInitiative(initiativeId: string, patch: UpsertInitiativeReq & { customization?: unknown }) {
    return apiFetch(`/api/v1/initiatives/${initiativeId}`, { method: 'PUT', body: patch, ...ctx() });
  },
  createInitiative(req: UpsertInitiativeReq) {
    return apiFetch<{ message: string; status: 'ok'; data: { id: string } }>('/api/v1/initiatives', { method: 'POST', body: req, ...ctx() });
  },
  getInitiative(initiativeId: string) {
    return apiFetch(`/api/v1/initiatives/${initiativeId}`, { ...ctx() });
  },
  deleteInitiative(initiativeId: string) {
    return apiFetch(`/api/v1/initiatives/${initiativeId}`, { method: 'DELETE', ...ctx() });
  },
  /** نسخة كاملة كمسودة (البيانات + التخصيص + المراحل + المؤشرات) */
  duplicateInitiative(initiativeId: string): Promise<DuplicateInitiativeRes> {
    return apiFetch<DuplicateInitiativeRes>(`/api/v1/initiatives/${initiativeId}/duplicate`, { method: 'POST', ...ctx() });
  },
  // بانرات الصفحة الرئيسية — المعروض الآن عام؛ scope 'all' والتعديل للمسؤولين فقط.
  listBanners(scope?: 'all'): Promise<ListHomeBannersRes> {
    return apiFetch<ListHomeBannersRes>('/api/v1/highlights', { query: { scope }, ...ctx() });
  },
  createBanner(req: UpsertHomeBannerReq): Promise<HomeBannerRes> {
    return apiFetch<HomeBannerRes>('/api/v1/highlights', { method: 'POST', body: req, ...ctx() });
  },
  updateBanner(id: string, req: UpsertHomeBannerReq): Promise<HomeBannerRes> {
    return apiFetch<HomeBannerRes>(`/api/v1/highlights/${encodeURIComponent(id)}`, { method: 'PUT', body: req, ...ctx() });
  },
  deleteBanner(id: string) {
    return apiFetch<{ message: string; status: 'ok' }>(`/api/v1/highlights/${encodeURIComponent(id)}`, { method: 'DELETE', ...ctx() });
  },
  reorderBanners(ids: string[]): Promise<ListHomeBannersRes> {
    return apiFetch<ListHomeBannersRes>('/api/v1/highlights/reorder', { method: 'POST', body: { ids }, ...ctx() });
  },
  /** توثيق تصدير تم في المتصفح (Excel) في سجل التدقيق */
  logExport(req: LogExportReq) {
    return apiFetch('/api/v1/audit-logs/export', { method: 'POST', body: req, ...ctx() });
  },
  getMyFactory() {
    return apiFetch<{ message: string; status: 'ok'; data: Record<string, unknown> & { id: string } }>('/api/v1/factories/mine', { ...ctx() });
  },
  listFactories(q?: { q?: string; page?: number; pageSize?: number }) {
    return apiFetch<{ data: Array<Record<string, unknown> & { id: string }>; total: number; page: number; pageSize: number }>(
      '/api/v1/factories', { query: { q: q?.q, page: q?.page ?? 1, pageSize: q?.pageSize ?? 100 }, ...ctx() },
    );
  },
  updateFactory(factoryId: string, patch: UpdateFactoryReq) {
    return apiFetch(`/api/v1/factories/${factoryId}`, { method: 'PUT', body: patch, ...ctx() });
  },
  deleteDetailsFile(factoryId: string, fileId: string) {
    return apiFetch(`/api/v1/factories/${factoryId}/details-files/${fileId}`, { method: 'DELETE', ...ctx() });
  },
  updateWorkflow(initiativeId: string, req: UpdateWorkflowReq) {
    return apiFetch(`/api/v1/initiatives/${initiativeId}/workflow`, { method: 'PUT', body: req, ...ctx() });
  },
  listDetailsFiles(factoryId: string, initiativeId?: string) {
    return apiFetch<{ message: string; status: 'ok'; data: Array<Record<string, unknown>> }>(`/api/v1/factories/${factoryId}/details-files`, { query: { initiativeId }, ...ctx() });
  },
  uploadDetailsFile(factoryId: string, file: File, extra?: { description?: string; initiativeId?: string; applicationId?: string }) {
    const fd = new FormData();
    fd.append('file', file);
    if (extra?.description) fd.append('description', extra.description);
    if (extra?.initiativeId) fd.append('initiativeId', extra.initiativeId);
    if (extra?.applicationId) fd.append('applicationId', extra.applicationId);
    return apiFetch(`/api/v1/factories/${factoryId}/details-files`, { method: 'POST', formData: fd, ...ctx() });
  },
  listApplications(q: ListApplicationsQuery): Promise<Paginated<ApplicationListItem>> {
    return apiFetch<Paginated<ApplicationListItem>>('/api/v1/applications', { query: q as Record<string, string | number | undefined>, ...ctx() });
  },
  createApplication(req: CreateApplicationReq): Promise<CreateApplicationRes> {
    return apiFetch<CreateApplicationRes>('/api/v1/applications', { method: 'POST', body: req, ...ctx() });
  },
  createDecision(appId: string, req: CreateDecisionReq): Promise<CreateDecisionRes> {
    return apiFetch<CreateDecisionRes>(`/api/v1/applications/${appId}/decisions`, { method: 'POST', body: req, ...ctx() });
  },
  listMessages(appId: string, q?: ListMessagesQuery): Promise<Paginated<MessageShape>> {
    return apiFetch<Paginated<MessageShape>>(`/api/v1/applications/${appId}/messages`, { query: q as Record<string, string | number | undefined>, ...ctx() });
  },
  sendMessage(appId: string, req: SendMessageReq): Promise<{ message: string; status: 'ok'; data: MessageShape }> {
    return apiFetch<{ message: string; status: 'ok'; data: MessageShape }>(`/api/v1/applications/${appId}/messages`, { method: 'POST', body: req, ...ctx() });
  },
  // 5c) مركز المراسلات — المسؤولون ↔ الجهات
  listChatConversations(): Promise<ChatConversationsRes> {
    return apiFetch<ChatConversationsRes>('/api/v1/chat/conversations', { ...ctx() });
  },
  getChatUnread(): Promise<ChatUnreadSummary> {
    return apiFetch<ChatUnreadSummary>('/api/v1/chat/unread', { ...ctx() });
  },
  listChatMessages(orgId: string, q?: { before?: string; after?: string; limit?: number }): Promise<ChatMessagesRes> {
    return apiFetch<ChatMessagesRes>(`/api/v1/chat/conversations/${encodeURIComponent(orgId)}/messages`, { query: q, ...ctx() });
  },
  sendChatMessage(orgId: string, body: string, files: File[]): Promise<{ message: string; status: 'ok'; data: ChatMessageShape }> {
    const fd = new FormData();
    if (body) fd.append('body', body);
    for (const f of files) fd.append('files', f, f.name);
    return apiFetch(`/api/v1/chat/conversations/${encodeURIComponent(orgId)}/messages`, { method: 'POST', formData: fd, ...ctx() });
  },
  markChatRead(orgId: string): Promise<{ message: string; status: 'ok'; data: ChatReadMarkers }> {
    return apiFetch(`/api/v1/chat/conversations/${encodeURIComponent(orgId)}/read`, { method: 'POST', ...ctx() });
  },
  listChatOversight(): Promise<{ data: ChatOversightItem[] }> {
    return apiFetch<{ data: ChatOversightItem[] }>('/api/v1/chat/oversight', { ...ctx() });
  },
  listOversightMessages(conversationId: string, q?: { before?: string; after?: string; limit?: number }): Promise<ChatOversightMessagesRes> {
    return apiFetch<ChatOversightMessagesRes>(`/api/v1/chat/oversight/${encodeURIComponent(conversationId)}/messages`, { query: q, ...ctx() });
  },
  downloadChatAttachment(id: string, inline = false): Promise<Blob> {
    return apiFetchBlob(`/api/v1/chat/attachments/${encodeURIComponent(id)}`, { query: inline ? { inline: '1' } : {}, userId: ctx().userId });
  },
  dashboardSummary() {
    return apiFetch('/api/v1/dashboard/summary', { ...ctx() });
  },
  listAuditLogs(q?: { page?: number; pageSize?: number }) {
    return apiFetch<{ data: Array<Record<string, unknown>>; total: number; page: number; pageSize: number }>(
      '/api/v1/audit-logs', { query: { page: q?.page ?? 1, pageSize: q?.pageSize ?? 50 }, ...ctx() },
    );
  },
  // ── Full-list helpers for store init (page through the 100-row cap) ──
  fullListInitiatives(): Promise<{ id: string; titleAr: string; titleEn: string; status: string; slug: string; taglineAr?: string; taglineEn?: string; descriptionAr?: string; descriptionEn?: string; category?: string; categoryEn?: string; targetSectors?: string[]; targetSectorsEn?: string[]; targetGovernorates?: string[]; budgetTotalEGP?: number; budgetAllocatedEGP?: number; startDate?: string; endDate?: string; coverImage?: string; badgeTextAr?: string; badgeTextEn?: string; participatingOrgs?: string[]; benefits?: any[]; faqs?: any[]; preEligibilityQuestions?: any[]; requiredDocsList?: any[]; formSections?: any[]; customization?: any; workflow?: any; impactMetrics?: any; objectives?: any[]; eligibilityRequirements?: any[]; selectionCriteria?: any[]; financialTerms?: any; executionNotesAr?: string; executionNotesEn?: string }[]> {
    return fetchAllPages('/api/v1/initiatives', { full: 1 });
  },
  fullListOrganizations(): Promise<{ id: string; code: string; nameAr: string; nameEn: string; type: string; active: boolean; contactEmail: string; logoBadge?: string; logoImage?: string }[]> {
    return fetchAllPages('/api/v1/organizations');
  },
  fullListFactories(): Promise<Array<Record<string, unknown> & { id: string }>> {
    return fetchAllPages('/api/v1/factories');
  },
  fullListUsers(): Promise<{ id: string; name: string; nameEn: string; email: string; role: string; organizationId: string; factoryId?: string; mustChangePassword?: boolean; organizationNameAr: string; organizationNameEn: string; roleTitleAr: string; roleTitleEn: string; avatar?: string }[]> {
    return fetchAllPages('/api/v1/users');
  },
  fullListApplications(): Promise<{ id: string; applicationNumber: string; initiativeId: string; initiativeTitleAr: string; initiativeTitleEn: string; factoryId: string; factoryNameAr: string; factoryNameEn: string; factorySectorAr: string; factorySectorEn: string; factoryGovernorateAr: string; factoryGovernorateEn: string; currentStageId: string; currentStageCode: string; currentStageNameAr: string; currentStageNameEn: string; status: string; currentAssignedOrgId: string; currentAssignedOrgNameAr: string; currentAssignedOrgNameEn: string; submittedAt: string; lastUpdatedAt: string; stageStartedAt: string; slaDays: number; slaDueDate: string; isSlaViolated: boolean; daysSpentInStage: number; formData: Record<string, unknown>; documents: any[]; timeline: any[] }[]> {
    return fetchAllPages('/api/v1/applications');
  },
};
