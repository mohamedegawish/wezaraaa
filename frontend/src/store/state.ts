import { useState, useEffect } from 'react';
import {
  Language,
  User,
  UserRole,
  Organization,
  FactoryProfile,
  HeroSlide,
  Initiative,
  InitiativeCustomization,
  Application,
  AuditLogEntry,
  ROLE_PERMISSIONS,
  DEFAULT_CUSTOMIZATION,
} from '../types';
import { api, RegisterFactoryReq } from '../api/endpoints';
import { refreshSession, getAccessToken, clearTokens } from '../api/client';
import type { ChatUnreadSummary, HomeBannerShape } from '../api/schemas';

const STORAGE_KEY_LANG = 'egypt_ind_lang_v1';
const STORAGE_KEY_USER = 'egypt_ind_user_v1';
const STORAGE_KEY_HERO = 'egypt_ind_hero_slides_v1';
const STORAGE_KEY_SLIDER_INTERVAL = 'egypt_ind_slider_interval_v1';
const STORAGE_KEY_SELECTED_INITIATIVE = 'egypt_ind_selected_initiative_v1';

// Display titles per role (presentation config — real data comes from the API).
export const ROLE_DEFAULT_TITLES: Record<UserRole, { ar: string; en: string }> = {
  ministry_admin: { ar: 'مشرف عام المبادرات الوطنية', en: 'General Initiatives Supervisor' },
  initiative_manager: { ar: 'مدير مبادرة', en: 'Initiative Manager' },
  ida_reviewer: { ar: 'مراجع هيئة التنمية الصناعية', en: 'IDA Reviewer' },
  imc_reviewer: { ar: 'مراجع مركز تحديث الصناعة', en: 'IMC Reviewer' },
  bank_reviewer: { ar: 'مراجع التمويل البنكي', en: 'Bank Reviewer' },
  solar_provider: { ar: 'مقدم خدمة الطاقة', en: 'Energy Service Provider' },
  factory_owner: { ar: 'مالك مصنع', en: 'Factory Owner' },
  auditor: { ar: 'مدقق', en: 'Auditor' },
};

function upgradeCoverUrl(url: string | undefined): string {
  if (!url) return '/covers/solar-2026.jpg';
  return url.replace(/\.svg$/i, '.jpg');
}

// Hero slides — admin-managed showcase content (localStorage), NOT business data.
function defaultHeroSlides(): HeroSlide[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HERO);
    if (raw) {
      const parsed = JSON.parse(raw) as HeroSlide[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s, i) => ({
          ...s,
          imageUrl: upgradeCoverUrl(s.imageUrl),
          order: (s as { order?: number }).order ?? i + 1,
          subtitleAr: s.subtitleAr ?? '',
          subtitleEn: s.subtitleEn ?? '',
        } as HeroSlide)).sort((a, b) => a.order - b.order);
      }
    }
  } catch { /* ignore */ }
  return [
    {
      id: 'hero-1',
      order: 1,
      titleAr: 'دليل المبادرات والحوافز الصناعية القومية',
      titleEn: 'National Industrial Initiatives & Incentives',
      subtitleAr: 'بوابة موحدة للتمويلات الميسرة وبرامج الطاقة النظيفة وتحديث خطوط الإنتاج.',
      subtitleEn: 'Unified portal for financing, clean energy and modernization programs.',
      imageUrl: '/covers/solar-2026.jpg',
      active: true,
    },
    {
      id: 'hero-2',
      order: 2,
      titleAr: 'تحديث صناعي وتعميق محلي',
      titleEn: 'Modernization & Local Content',
      subtitleAr: 'أتمتة خطوط الإنتاج ورفع تنافسية المصانع المصرية.',
      subtitleEn: 'Automate production lines and boost competitiveness.',
      imageUrl: '/covers/modernization-2026.jpg',
      active: true,
    },
    {
      id: 'hero-3',
      order: 3,
      titleAr: 'توطين الصناعات والبدائل',
      titleEn: 'Localization & Import Substitution',
      subtitleAr: 'دعم المكون المحلي وسلاسل الإمداد الوطنية.',
      subtitleEn: 'Support local components and national supply chains.',
      imageUrl: '/covers/import-substitution-2026.jpg',
      active: true,
    },
  ];
}

export const GUEST_USER: User = {
  id: 'guest',
  name: 'تسجيل الدخول',
  nameEn: 'Sign In',
  email: '',
  role: 'factory_owner',
  roleTitleAr: 'حساب منشأة أو جهة',
  roleTitleEn: 'Facility / Official Account',
  organizationId: '',
  organizationNameAr: 'منصة المبادرات',
  organizationNameEn: 'Initiatives Platform',
  avatar: '👤',
};

interface RawSessionUser {
  id: string; name: string; nameEn: string; email: string; role: string;
  organizationId: string; factoryId?: string; mustChangePassword?: boolean;
}

const AUDIT_ROLES = ['ministry_admin', 'initiative_manager', 'auditor'];
const ADMIN_ROLES = ['ministry_admin', 'initiative_manager'];

export function mapServerAudit(row: Record<string, unknown>): AuditLogEntry {
  const action = String(row.actionType ?? 'update').toLowerCase();
  const actionType = ((): AuditLogEntry['actionType'] => {
    if (action === 'create' || action === 'submit' || action === 'register') return 'CREATE';
    if (action === 'delete') return 'DELETE';
    if (action === 'approve') return 'APPROVE';
    if (action === 'reject') return 'REJECT';
    if (action === 'request_rework' || action === 'rework') return 'REWORK';
    if (action === 'login' || action === 'logout' || action === 'refresh') return 'LOGIN';
    if (action === 'export') return 'EXPORT';
    if (action === 'assign' || action === 'escalate') return 'ASSIGN';
    return 'UPDATE';
  })();
  const entity = String(row.entityType ?? 'organization').toLowerCase();
  const entityType = ((): AuditLogEntry['entityType'] => {
    if (entity === 'application') return 'APPLICATION';
    if (entity === 'initiative' || entity === 'workflow') return 'INITIATIVE';
    if (entity === 'factory') return 'FACTORY';
    if (entity === 'banner') return 'BANNER';
    return 'ORGANIZATION';
  })();
  return {
    id: String(row.id ?? ''),
    timestamp: String(row.timestamp ?? new Date().toISOString()),
    userId: String(row.userId ?? 'unknown'),
    userName: String(row.userName ?? 'unknown'),
    userRoleAr: '',
    userRoleEn: '',
    userOrgAr: '',
    userOrgEn: '',
    actionType,
    entityType,
    entityId: String(row.entityId ?? ''),
    summaryAr: String(row.summaryAr ?? ''),
    summaryEn: '',
    ipAddress: String(row.ip ?? ''),
  };
}

// API-only store — every business record comes from the backend (Seeder).
// No static data, no mock layer, no local mutation engines.
class PlatformStore {
  private listeners: Set<() => void> = new Set();
  private _initialized = false;

  public language: Language = 'ar';
  public isLoggedIn: boolean = false;
  public currentUser: User = GUEST_USER;
  public users: User[] = [];
  public organizations: Organization[] = [];
  public factories: FactoryProfile[] = [];
  public myFactory: FactoryProfile | null = null;
  public initiatives: Initiative[] = [];
  public applications: Application[] = [];
  public auditLogs: AuditLogEntry[] = [];
  public heroSlides: HeroSlide[] = defaultHeroSlides();
  public heroSliderInterval: number = 3000;
  /** بانرات الصفحة الرئيسية المعروضة الآن (من الباك — تديرها الإدارة من «بانرات الرئيسية»). */
  public homeBanners: HomeBannerShape[] = [];

  public activeView: string = 'home';
  public selectedInitiativeId: string | null = null;
  public selectedApplicationId: string | null = null;

  // مركز المراسلات — ملخص غير المقروء (يُحدَّث بالـ polling من ChatNotifier) + الجهة المراد فتحها
  public chatUnread: ChatUnreadSummary | null = null;
  public chatFocusOrgId: string | null = null;
  /** Conversation currently on screen (no notify — read by ChatNotifier to skip redundant toasts). */
  public chatActiveOrgId: string | null = null;

  constructor() {
    try {
      const savedLang = localStorage.getItem(STORAGE_KEY_LANG);
      if (savedLang === 'ar' || savedLang === 'en') this.language = savedLang;
    } catch { /* ignore */ }
    this.applyLanguageToHtml(this.language);
    try {
      const savedInterval = localStorage.getItem(STORAGE_KEY_SLIDER_INTERVAL);
      if (savedInterval) {
        const val = Number(savedInterval);
        if (!isNaN(val) && val >= 2000 && val <= 30000) this.heroSliderInterval = val;
      }
    } catch { /* ignore */ }
  }

  /** Bootstraps store from the API. Call once at app startup. */
  async init(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;
    try {
      await this.boot();
    } catch (err) {
      console.error('[PlatformStore] init failed:', err);
    }
    const hashView = window.location.hash.slice(1);
    if (hashView && this.isViewAllowed(hashView, this.currentUser)) {
      this.activeView = hashView;
    } else if (!this.isViewAllowed(this.activeView, this.currentUser)) {
      this.activeView = this.getDefaultView(this.currentUser);
    }
    // استعادة المبادرة المختارة بعد التحديث (صفحة المبادرة وحدها).
    if (this.activeView === 'initiative-detail') {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY_SELECTED_INITIATIVE);
        if (saved) this.selectedInitiativeId = saved;
      } catch { /* ignore */ }
    }
    this.notify();
    window.addEventListener('hashchange', () => {
      const v = window.location.hash.slice(1);
      if (v && this.isViewAllowed(v, this.currentUser)) {
        this.activeView = v;
        this.notify();
      }
    });
  }

  /** القائمة تختلف بالهوية (الباك يخفي المسودة/المؤرشفة عن غير الإدارة) — تُعاد عند الدخول. */
  private async loadInitiatives(): Promise<void> {
    try {
      const inits = await api.fullListInitiatives();
      this.initiatives = (inits as unknown as Initiative[]) ?? [];
    } catch { this.initiatives = []; }
    this.applyInitiativeDefaults();
  }

  private async loadHomeBanners(): Promise<void> {
    try {
      this.homeBanners = (await api.listBanners()).data ?? [];
    } catch { this.homeBanners = []; }
  }

  /** بعد تعديلات الإدارة حتى تظهر في الصفحة الرئيسية فوراً. */
  public async reloadHomeBanners(): Promise<void> {
    await this.loadHomeBanners();
    this.notify();
  }

  private async boot(): Promise<void> {
    // 1) Restore session FIRST — access in memory, refresh as httpOnly cookie (P0-1).
    // الترتيب مهم: قائمة المبادرات تختلف بالهوية (المسودة/المؤرشفة للإدارة فقط)، فتحميلها
    // قبل استعادة الجلسة كان يعطي الأدمن بعد الريفريش القائمة العامة الناقصة.
    let token: string | null = null;
    try { token = getAccessToken(); } catch { token = null; }
    if (!token) {
      try {
        if (await refreshSession()) token = getAccessToken();
      } catch { token = null; }
    }
    if (token) {
      try {
        const me = await api.me();
        this.setSession(me.data as unknown as RawSessionUser);
      } catch {
        clearTokens();
        this.clearSession();
      }
    } else {
      this.clearSession();
    }
    // 2) Initiatives — public for guests; admins/auditor also get draft/archived. Banners are public.
    await Promise.all([this.loadInitiatives(), this.loadHomeBanners()]);
    // 3) Role-scoped data for logged-in users.
    if (this.isLoggedIn) await this.loadRoleData();
    this.notify();
  }

  /** Reloads everything the current session may see (also used after login). */
  public async reloadAll(): Promise<void> {
    await this.loadInitiatives();
    if (this.isLoggedIn) await this.loadRoleData();
    this.notify();
  }

  private async loadRoleData(): Promise<void> {
    const role = this.currentUser.role;
    const isAdmin = ADMIN_ROLES.includes(role);
    const isAuditor = AUDIT_ROLES.includes(role);
    const [usersR, orgsR, appsR, auditR, factoriesR, mineR] = await Promise.allSettled([
      isAdmin ? api.fullListUsers() : Promise.resolve([] as User[]),
      api.fullListOrganizations(),
      api.fullListApplications(),
      isAuditor ? api.listAuditLogs({ page: 1, pageSize: 100 }) : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      isAuditor ? api.fullListFactories() : Promise.resolve([] as Array<Record<string, unknown> & { id: string }>),
      role === 'factory_owner' ? api.getMyFactory().then(r => r.data).catch(() => null) : Promise.resolve(null),
    ]);
    if (usersR.status === 'fulfilled') this.users = (usersR.value as unknown as User[]) ?? [];
    if (orgsR.status === 'fulfilled') this.organizations = (orgsR.value as unknown as Organization[]) ?? [];
    if (appsR.status === 'fulfilled') this.applications = (appsR.value as unknown as Application[]) ?? [];
    if (auditR.status === 'fulfilled') {
      const rows = ((auditR.value as { data?: Array<Record<string, unknown>> }).data ?? []) as Array<Record<string, unknown>>;
      this.auditLogs = rows.map(mapServerAudit);
    } else {
      this.auditLogs = [];
    }
    if (factoriesR.status === 'fulfilled') {
      this.factories = (factoriesR.value as unknown as FactoryProfile[]) ?? [];
    } else {
      this.factories = [];
    }
    if (mineR.status === 'fulfilled' && mineR.value) {
      this.myFactory = mineR.value as unknown as FactoryProfile;
      if (!this.factories.some(f => f.id === this.myFactory?.id)) {
        this.factories = [this.myFactory, ...this.factories];
      }
    } else {
      this.myFactory = null;
    }
    // Organization names may have arrived after the session was set — re-enrich.
    if (this.isLoggedIn && this.currentUser.id !== 'guest') this.refreshSessionMeta();
  }

  /** Refreshes the current user's factory from the API (after profile mutations). */
  public async refreshMyFactory(): Promise<void> {
    if (!this.isLoggedIn || this.currentUser.role !== 'factory_owner') return;
    try {
      const r = await api.getMyFactory();
      this.myFactory = r.data as unknown as FactoryProfile;
      this.factories = [this.myFactory, ...this.factories.filter(f => f.id !== this.myFactory?.id)];
    } catch { this.myFactory = null; }
    this.notify();
  }

  private enrichUser(raw: RawSessionUser): User {
    const titles = ROLE_DEFAULT_TITLES[(raw.role as UserRole) ?? 'factory_owner'] ?? { ar: raw.role, en: raw.role };
    const org = this.organizations.find(o => o.id === raw.organizationId);
    const name = raw.name || '';
    return {
      id: raw.id,
      name,
      nameEn: raw.nameEn || name,
      email: raw.email || '',
      role: (raw.role as UserRole) ?? 'factory_owner',
      roleTitleAr: titles.ar,
      roleTitleEn: titles.en,
      organizationId: raw.organizationId || '',
      organizationNameAr: org?.nameAr ?? '',
      organizationNameEn: org?.nameEn ?? org?.nameAr ?? '',
      factoryId: raw.factoryId || undefined,
      mustChangePassword: Boolean(raw.mustChangePassword),
      avatar: name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join(''),
    };
  }

  private setSession(raw: RawSessionUser): void {
    this.currentUser = this.enrichUser(raw);
    this.isLoggedIn = true;
    try { localStorage.setItem(STORAGE_KEY_USER, raw.id); } catch { /* ignore */ }
  }

  private refreshSessionMeta(): void {
    this.currentUser = this.enrichUser({
      id: this.currentUser.id,
      name: this.currentUser.name,
      nameEn: this.currentUser.nameEn,
      email: this.currentUser.email,
      role: this.currentUser.role,
      organizationId: this.currentUser.organizationId,
      factoryId: this.currentUser.factoryId,
      mustChangePassword: this.currentUser.mustChangePassword,
    });
  }

  private clearSession(): void {
    this.isLoggedIn = false;
    this.currentUser = GUEST_USER;
    try { localStorage.removeItem(STORAGE_KEY_USER); } catch { /* ignore */ }
  }

  // Real JWT login — the ONLY login path (no local email lookup).
  public async login(email: string, password: string): Promise<User> {
    const r = await api.login(email.trim(), password);
    this.setSession(r.data.user as unknown as RawSessionUser);
    await Promise.all([this.loadInitiatives(), this.loadRoleData()]);
    try { localStorage.setItem(STORAGE_KEY_USER, this.currentUser.id); } catch { /* ignore */ }
    if (this.currentUser.role === 'factory_owner') {
      // مالك المصنع يهبط على «مبادراتي» عند تسجيل الدخول.
      this.activeView = 'my-initiatives';
      window.location.hash = 'my-initiatives';
    } else if (!this.isViewAllowed(this.activeView, this.currentUser)) {
      this.activeView = this.getDefaultView(this.currentUser);
    }
    this.notify();
    return this.currentUser;
  }

  // Real self-registration — creates org + factory + owner via the API.
  // In test, auto-verified + tokens; in dev/prod, requires email verification.
  public async registerFactory(data: RegisterFactoryReq): Promise<User & { requiresVerification?: boolean; verificationToken?: string }> {
    const r = await api.registerFactory(data);
    const d = r.data as unknown as { user?: unknown; organization?: { nameAr: string; nameEn: string }; factory?: { id: string }; accessToken?: string; requiresVerification?: boolean; verificationToken?: string };
    if (d.requiresVerification) {
      // Dev returns token for easy testing — auto-verify then login
      if (d.verificationToken) {
        try { await api.verifyEmail(d.verificationToken); } catch {}
        return this.login(data.email, data.password) as Promise<User & { requiresVerification?: boolean }>;
      }
      return { requiresVerification: true, verificationToken: d.verificationToken } as unknown as User & { requiresVerification?: boolean };
    }
    this.setSession({ ...(d.user as unknown as RawSessionUser), factoryId: (d.factory as { id: string }).id });
    const titles = ROLE_DEFAULT_TITLES.factory_owner;
    this.currentUser = {
      ...this.currentUser,
      roleTitleAr: titles.ar,
      roleTitleEn: titles.en,
      organizationNameAr: (d.organization as { nameAr: string }).nameAr,
      organizationNameEn: (d.organization as { nameEn: string }).nameEn,
      mustChangePassword: false,
    };
    await this.loadRoleData();
    this.activeView = 'factory-portal';
    this.notify();
    return this.currentUser as User & { requiresVerification?: boolean };
  }

  // Real password change via the API.
  public async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.changePassword(currentPassword, newPassword);
    if (this.currentUser.id !== 'guest') {
      this.currentUser = { ...this.currentUser, mustChangePassword: false };
    }
    this.notify();
  }

  private applyInitiativeDefaults(): void {
    this.initiatives = this.initiatives.map(init => {
      if (!init.customization) return { ...init, customization: { ...DEFAULT_CUSTOMIZATION } };
      if (!init.workflow) {
        return {
          ...init,
          workflow: {
            id: `wf-${init.id}`, initiativeId: init.id, version: 1,
            nameAr: `مسار ${init.titleAr}`, nameEn: `Workflow ${init.titleEn}`, stages: [], active: true,
          },
        };
      }
      return init;
    });
  }

  public isViewAllowed(view: string, user: User = this.currentUser): boolean {
    // 'showcase' اسم قديم يعادل 'home' (alias للتوافق مع الروابط القديمة).
    const normalized = view === 'showcase' ? 'home' : view;
    // الصفحات العامة المتاحة للجميع (أي دور بما فيهم الزائر):
    // login / home / initiatives / initiative-detail / compare
    // صفحة 'impact' (الأثر الوطني) سيادية ADMIN ONLY عبر ROLE_PERMISSIONS.
    // صفحة 'my-initiatives' للمسجلين فقط (غير الزائر).
    if (normalized === 'login' || normalized === 'home' || normalized === 'initiatives' || normalized === 'initiative-detail' || normalized === 'compare') return true;
    if (normalized === 'my-initiatives') return user.id !== 'guest';
    const config = ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS.factory_owner;
    return config.allowedViews.includes(view) || config.allowedViews.includes(normalized);
  }

  public getDefaultView(user: User = this.currentUser): string {
    // الزائر (guest) افتراضيه الصفحة التعريفية العامة — وليس my-initiatives
    // (دور guest التقني factory_owner لكنه غير مسجل).
    if (user.id === 'guest') return 'home';
    const config = ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS.factory_owner;
    return config.defaultView;
  }

  public canUserReviewApplication(app: Application, user: User = this.currentUser): boolean {
    // الباك مصدر الحقيقة: الجهة صاحبة المرحلة الحالية فقط (الإدارة تقرر «المراجعة الأولية» ثم تتابع).
    void user;
    return app.viewerCanDecide === true;
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  public subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  // Language management
  public setLanguage(lang: Language) {
    this.language = lang;
    this.applyLanguageToHtml(lang);
    this.notify();
  }

  private applyLanguageToHtml(lang: Language) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }

  // Navigation with RBAC check
  // 'showcase' يُطبَّع إلى 'home' (alias قديم) حتى لا تنكسر الروابط القديمة.
  public navigate(view: string, initiativeId?: string, applicationId?: string) {
    const normalized = view === 'showcase' ? 'home' : view;
    if (!this.isViewAllowed(normalized, this.currentUser)) {
      this.activeView = this.getDefaultView(this.currentUser);
    } else {
      this.activeView = normalized;
    }
    if (initiativeId !== undefined) this.selectedInitiativeId = initiativeId;
    if (applicationId !== undefined) this.selectedApplicationId = applicationId;
    // ثبات صفحة المبادرة المنفصلة بعد التحديث.
    try {
      if (initiativeId !== undefined && initiativeId) sessionStorage.setItem(STORAGE_KEY_SELECTED_INITIATIVE, initiativeId);
    } catch { /* ignore */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.location.hash = this.activeView;
    this.notify();
  }

  /** Chat is for officials + organizations only (never factories/investors/guests). */
  public canUseChat(user: User = this.currentUser): boolean {
    return this.isLoggedIn && user.id !== 'guest' && user.role !== 'factory_owner' && this.isViewAllowed('chat', user);
  }

  /** Polled by ChatNotifier; returns the fresh summary (null when not eligible / failed). */
  public async refreshChatUnread(): Promise<ChatUnreadSummary | null> {
    if (!this.canUseChat()) {
      if (this.chatUnread) { this.chatUnread = null; this.notify(); }
      return null;
    }
    try {
      const next = await api.getChatUnread();
      const prev = this.chatUnread;
      this.chatUnread = next;
      if (!prev || prev.total !== next.total || JSON.stringify(prev.items) !== JSON.stringify(next.items)) this.notify();
      return next;
    } catch {
      return this.chatUnread;
    }
  }

  /** Locally clears one conversation's unread (optimistic, right after markChatRead). */
  public clearChatUnread(orgId: string) {
    if (!this.chatUnread) return;
    const hit = this.chatUnread.items.find(i => i.orgId === orgId);
    const removed = hit?.unread ?? 0;
    if (!removed) return;
    this.chatUnread = {
      ...this.chatUnread,
      total: Math.max(0, this.chatUnread.total - removed),
      items: this.chatUnread.items.filter(i => i.orgId !== orgId),
    };
    this.notify();
  }

  public openChat(orgId?: string) {
    this.chatFocusOrgId = orgId ?? null;
    this.navigate('chat');
  }

  public consumeChatFocus(): string | null {
    const v = this.chatFocusOrgId;
    this.chatFocusOrgId = null;
    return v;
  }

  public logout() {
    void api.logout();
    this.clearSession();
    this.chatUnread = null;
    this.chatFocusOrgId = null;
    this.users = [];
    this.organizations = [];
    this.factories = [];
    this.myFactory = null;
    this.applications = [];
    this.auditLogs = [];
    // المسودة/المؤرشفة كانت محملة لجلسة الأدمن — لا تبقى في الذاكرة بعد الخروج
    this.initiatives = this.initiatives.filter(i => i.status !== 'draft' && i.status !== 'archived');
    this.activeView = 'login';
    window.location.hash = 'login';
    this.notify();
  }

  // Hero slides management (admin showcase content — localStorage).
  private persistHero() {
    this.heroSlides = [...this.heroSlides].sort((a, b) => a.order - b.order);
    try { localStorage.setItem(STORAGE_KEY_HERO, JSON.stringify(this.heroSlides)); } catch { /* ignore */ }
  }

  public getActiveHeroSlides(): HeroSlide[] {
    const act = this.heroSlides.filter(s => s.active).sort((a, b) => a.order - b.order);
    return act.length > 0 ? act : [...this.heroSlides].sort((a, b) => a.order - b.order);
  }

  public saveHeroSlides(slides: HeroSlide[]) {
    if (slides.length === 0) throw new Error('يجب وجود شريحة واحدة على الأقل.');
    if (slides.length > 6) throw new Error('الحد الأقصى 6 شرائح.');
    this.heroSlides = slides;
    this.persistHero();
    this.notify();
  }

  public addHeroSlide(slide: Omit<HeroSlide, 'id' | 'order'> & { order?: number }): HeroSlide {
    if (this.heroSlides.length >= 6) throw new Error('الحد الأقصى 6 شرائح.');
    const maxOrder = this.heroSlides.reduce((m, s) => Math.max(m, s.order || 0), 0);
    const created: HeroSlide = { ...slide, id: `hero-${Date.now()}`, order: slide.order ?? maxOrder + 1 } as HeroSlide;
    this.heroSlides = [...this.heroSlides, created];
    this.persistHero();
    this.notify();
    return created;
  }

  public updateHeroSlide(id: string, patch: Partial<HeroSlide>) {
    this.heroSlides = this.heroSlides.map(s => (s.id === id ? { ...s, ...patch } : s));
    this.persistHero();
    this.notify();
  }

  public deleteHeroSlide(id: string) {
    if (this.heroSlides.length <= 1) throw new Error('لا يمكن حذف كل الشرائح.');
    this.heroSlides = this.heroSlides.filter(s => s.id !== id);
    this.persistHero();
    this.notify();
  }

  public setHeroSliderInterval(ms: number) {
    const clamped = Math.max(2000, Math.min(30000, ms));
    this.heroSliderInterval = clamped;
    try {
      localStorage.setItem(STORAGE_KEY_SLIDER_INTERVAL, String(clamped));
    } catch { /* ignore */ }
    this.notify();
  }
}

// Global Singleton Instance
export const store = new PlatformStore();

// React Hook for Reactive Store
export function usePlatformStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return store.subscribe(() => setTick(t => t + 1));
  }, []);

  return {
    language: store.language,
    isLoggedIn: store.isLoggedIn,
    currentUser: store.currentUser,
    users: store.users,
    organizations: store.organizations,
    factories: store.factories,
    myFactory: store.myFactory,
    initiatives: store.initiatives,
    applications: store.applications,
    auditLogs: store.auditLogs,
    heroSlides: store.heroSlides,
    homeBanners: store.homeBanners,
    activeView: store.activeView,
    selectedInitiativeId: store.selectedInitiativeId,
    selectedApplicationId: store.selectedApplicationId,
    chatUnread: store.chatUnread,

    // RBAC Permissions
    isViewAllowed: (view: string, user?: User) => store.isViewAllowed(view, user),
    getDefaultView: (user?: User) => store.getDefaultView(user),
    canUserReviewApplication: (app: Application, user?: User) => store.canUserReviewApplication(app, user),
    rolePermissions: ROLE_PERMISSIONS,

    // Actions
    setLanguage: (lang: Language) => store.setLanguage(lang),
    navigate: (view: string, initId?: string, appId?: string) => store.navigate(view, initId, appId),
    login: (email: string, password: string) => store.login(email, password),
    registerFactory: (data: RegisterFactoryReq) => store.registerFactory(data),
    changePassword: (currentPassword: string, newPassword: string) => store.changePassword(currentPassword, newPassword),
    logout: () => store.logout(),
    reloadAll: () => store.reloadAll(),
    canUseChat: () => store.canUseChat(),
    refreshChatUnread: () => store.refreshChatUnread(),
    clearChatUnread: (orgId: string) => store.clearChatUnread(orgId),
    openChat: (orgId?: string) => store.openChat(orgId),
    consumeChatFocus: () => store.consumeChatFocus(),
    refreshMyFactory: () => store.refreshMyFactory(),
    reloadHomeBanners: () => store.reloadHomeBanners(),
    heroSliderInterval: store.heroSliderInterval,
    setHeroSliderInterval: (ms: number) => store.setHeroSliderInterval(ms),
    getActiveHeroSlides: () => store.getActiveHeroSlides(),
    saveHeroSlides: (slides: HeroSlide[]) => store.saveHeroSlides(slides),
    addHeroSlide: (slide: Omit<HeroSlide, 'id' | 'order'> & { order?: number }) => store.addHeroSlide(slide),
    updateHeroSlide: (id: string, patch: Partial<HeroSlide>) => store.updateHeroSlide(id, patch),
    deleteHeroSlide: (id: string) => store.deleteHeroSlide(id),
  };
}
