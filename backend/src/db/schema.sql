-- Egypt Industrial Initiatives Platform — SQLite schema (production-ready baseline)
-- JSON columns store TEXT JSON for flexible CMS fields (INITIATIVE = CONFIGURATION).
-- All timestamps are ISO-8601 TEXT (UTC).

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id           TEXT PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nameAr       TEXT NOT NULL,
  nameEn       TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('ministry','authority','center','bank','utility','provider','factory')),
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  contactEmail TEXT NOT NULL DEFAULT '',
  createdAt    TEXT NOT NULL,
  updatedAt    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orgs_type ON organizations(type);

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  nameEn         TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role           TEXT NOT NULL CHECK (role IN ('ministry_admin','initiative_manager','ida_reviewer','imc_reviewer','bank_reviewer','solar_provider','factory_owner','auditor')),
  organizationId TEXT NOT NULL REFERENCES organizations(id) ON UPDATE CASCADE,
  factoryId      TEXT NOT NULL DEFAULT '',
  passwordHash   TEXT NOT NULL DEFAULT '',
  mustChangePassword INTEGER NOT NULL DEFAULT 0 CHECK (mustChangePassword IN (0,1)),
  isVerified     INTEGER NOT NULL DEFAULT 1 CHECK (isVerified IN (0,1)),
  emailVerificationToken TEXT NOT NULL DEFAULT '',
  emailVerificationExpires TEXT NOT NULL DEFAULT '',
  createdAt      TEXT NOT NULL,
  updatedAt      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organizationId);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
-- NOTE: idx_users_factory is created by ensureMigrated() AFTER the factoryId
-- column exists. Declaring it here would crash old DBs before migration runs.

CREATE TABLE IF NOT EXISTS initiatives (
  id                    TEXT PRIMARY KEY,
  slug                  TEXT NOT NULL UNIQUE COLLATE NOCASE,
  titleAr               TEXT NOT NULL,
  titleEn               TEXT NOT NULL,
  taglineAr             TEXT NOT NULL DEFAULT '',
  taglineEn             TEXT NOT NULL DEFAULT '',
  descriptionAr         TEXT NOT NULL DEFAULT '',
  descriptionEn         TEXT NOT NULL DEFAULT '',
  category              TEXT NOT NULL DEFAULT '',
  categoryEn            TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('active','draft','coming_soon','closed','archived','completed')),
  targetSectors         TEXT NOT NULL DEFAULT '[]',
  targetSectorsEn       TEXT NOT NULL DEFAULT '[]',
  targetGovernorates    TEXT NOT NULL DEFAULT '[]',
  budgetTotalEGP        REAL NOT NULL DEFAULT 0 CHECK (budgetTotalEGP >= 0),
  budgetAllocatedEGP    REAL NOT NULL DEFAULT 0 CHECK (budgetAllocatedEGP >= 0),
  startDate             TEXT NOT NULL DEFAULT '',
  endDate               TEXT NOT NULL DEFAULT '',
  coverImage            TEXT NOT NULL DEFAULT '/covers/solar-2026.svg',
  badgeTextAr           TEXT NOT NULL DEFAULT '',
  badgeTextEn           TEXT NOT NULL DEFAULT '',
  participatingOrgs     TEXT NOT NULL DEFAULT '[]',
  benefits              TEXT NOT NULL DEFAULT '[]',
  faqs                  TEXT NOT NULL DEFAULT '[]',
  preEligibilityQuestions TEXT NOT NULL DEFAULT '[]',
  requiredDocsList      TEXT NOT NULL DEFAULT '[]',
  formSections          TEXT NOT NULL DEFAULT '[]',
  impactMetrics         TEXT NOT NULL DEFAULT '{}',
  customization         TEXT NOT NULL DEFAULT '{"requireDetailsFile":false,"maxFileSizeMB":15,"allowedFileTypes":".pdf"}',
  workflow              TEXT NOT NULL DEFAULT '{"version":1,"stages":[]}',
  objectives            TEXT NOT NULL DEFAULT '[]',
  eligibilityRequirements TEXT NOT NULL DEFAULT '[]',
  selectionCriteria     TEXT NOT NULL DEFAULT '[]',
  financialTerms        TEXT NOT NULL DEFAULT '{}',
  executionNotesAr      TEXT NOT NULL DEFAULT '',
  executionNotesEn      TEXT NOT NULL DEFAULT '',
  kpis                  TEXT NOT NULL DEFAULT '[]', -- ADMIN ONLY: لا يُرجع في القراءة العامة
  createdAt             TEXT NOT NULL,
  updatedAt             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_initiatives_status ON initiatives(status);

CREATE TABLE IF NOT EXISTS factories (
  id        TEXT PRIMARY KEY,
  data      TEXT NOT NULL DEFAULT '{}',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS details_files (
  id            TEXT PRIMARY KEY,
  factoryId     TEXT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  fileName      TEXT NOT NULL,
  fileSize      TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  initiativeId  TEXT REFERENCES initiatives(id) ON DELETE SET NULL,
  applicationId TEXT,
  storedPath    TEXT NOT NULL DEFAULT '',
  uploadedAt    TEXT NOT NULL,
  uploadedBy    TEXT NOT NULL DEFAULT 'unknown',
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected'))
);
CREATE INDEX IF NOT EXISTS idx_files_factory ON details_files(factoryId);
CREATE INDEX IF NOT EXISTS idx_files_app ON details_files(applicationId);

CREATE TABLE IF NOT EXISTS applications (
  id                     TEXT PRIMARY KEY,
  applicationNumber      TEXT NOT NULL UNIQUE,
  initiativeId           TEXT NOT NULL REFERENCES initiatives(id) ON DELETE RESTRICT,
  initiativeTitleAr      TEXT NOT NULL DEFAULT '',
  factoryId              TEXT NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
  factoryNameAr          TEXT NOT NULL DEFAULT '',
  factorySectorAr        TEXT NOT NULL DEFAULT '',
  factoryGovernorateAr   TEXT NOT NULL DEFAULT '',
  currentStageId         TEXT NOT NULL DEFAULT 'stage-1',
  currentStageNameAr     TEXT NOT NULL DEFAULT '',
  status                 TEXT NOT NULL DEFAULT 'submitted',
  currentAssignedOrgId   TEXT NOT NULL DEFAULT 'org-ida',
  currentAssignedOrgNameAr TEXT NOT NULL DEFAULT '',
  slaDays                INTEGER NOT NULL DEFAULT 3,
  submittedAt            TEXT NOT NULL,
  updatedAt              TEXT NOT NULL,
  formData               TEXT NOT NULL DEFAULT '{}',
  detailsFileIds         TEXT NOT NULL DEFAULT '[]',
  timeline               TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_apps_initiative ON applications(initiativeId);
CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_apps_org ON applications(currentAssignedOrgId);
CREATE INDEX IF NOT EXISTS idx_apps_factory ON applications(factoryId);

CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  applicationId TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  fromUserId    TEXT NOT NULL DEFAULT '',
  fromOrgId     TEXT NOT NULL DEFAULT '',
  toOrgId       TEXT NOT NULL DEFAULT '',
  subject       TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  customFields  TEXT NOT NULL DEFAULT '{}',
  detailsFileId TEXT,
  createdAt     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_app ON messages(applicationId);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(toOrgId);

-- مركز المراسلات (5c): محادثة ثنائية بين أي جهتين (الوزارة جهة مثل غيرها).
-- الزوج مرتب (orgA < orgB) وفريد؛ حالة القراءة وتذكير البريد لكل طرف.
-- ملاحظة: فهارس الأعمدة الجديدة تُنشأ في ensureMigrated بعد ترحيل القواعد القديمة (orgId/senderSide).
CREATE TABLE IF NOT EXISTS chat_conversations (
  id                 TEXT PRIMARY KEY,
  orgA               TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  orgB               TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lastMessageAt      TEXT NOT NULL DEFAULT '',
  lastMessagePreview TEXT NOT NULL DEFAULT '',
  lastSenderOrgId    TEXT NOT NULL DEFAULT '',
  readA              TEXT NOT NULL DEFAULT '',
  readB              TEXT NOT NULL DEFAULT '',
  reminderSentA      TEXT NOT NULL DEFAULT '',
  reminderSentB      TEXT NOT NULL DEFAULT '',
  reminderAttemptA   TEXT NOT NULL DEFAULT '',
  reminderAttemptB   TEXT NOT NULL DEFAULT '',
  createdAt          TEXT NOT NULL,
  UNIQUE (orgA, orgB),
  CHECK (orgA < orgB)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id             TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  senderUserId   TEXT NOT NULL DEFAULT '',
  senderOrgId    TEXT NOT NULL DEFAULT '',
  body           TEXT NOT NULL DEFAULT '',
  createdAt      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversationId, createdAt);

CREATE TABLE IF NOT EXISTS chat_attachments (
  id         TEXT PRIMARY KEY,
  messageId  TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  fileName   TEXT NOT NULL,
  mimeType   TEXT NOT NULL,
  sizeBytes  INTEGER NOT NULL DEFAULT 0,
  storedPath TEXT NOT NULL,
  createdAt  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_msg ON chat_attachments(messageId);

-- طابور البريد الصادر (Outbox): إشعارات المنشآت تُسجَّل مع القرار وتُرسل من العامل (jobs/mailQueue.ts)
-- مع إعادة المحاولة — القرار لا يتأخر ولا يفشل بسبب SMTP، ولكل رسالة أثر للتدقيق.
CREATE TABLE IF NOT EXISTS email_outbox (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,
  refType       TEXT NOT NULL DEFAULT '',
  refId         TEXT NOT NULL DEFAULT '',
  recipients    TEXT NOT NULL DEFAULT '[]',
  subject       TEXT NOT NULL,
  html          TEXT NOT NULL,
  text          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  lastError     TEXT NOT NULL DEFAULT '',
  nextAttemptAt TEXT NOT NULL DEFAULT '',
  createdAt     TEXT NOT NULL,
  sentAt        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_due ON email_outbox(status, nextAttemptAt);
CREATE INDEX IF NOT EXISTS idx_email_outbox_ref ON email_outbox(refType, refId);

-- بانرات الإعلانات في الصفحة الرئيسية (يديرها المسؤولون من «بانرات الرئيسية»).
-- imageUrl: data:image/… (مرفوعة، تُخدم ثنائياً من /highlights/:id/image) أو https:// أو مسار نسبي /…
-- startsAt/endsAt: ISO أو '' (بلا حد) — «المعروض الآن» = active + داخل النافذة الزمنية.
CREATE TABLE IF NOT EXISTS home_banners (
  id          TEXT PRIMARY KEY,
  imageUrl    TEXT NOT NULL,
  titleAr     TEXT NOT NULL DEFAULT '',
  titleEn     TEXT NOT NULL DEFAULT '',
  subtitleAr  TEXT NOT NULL DEFAULT '',
  subtitleEn  TEXT NOT NULL DEFAULT '',
  ctaLabelAr  TEXT NOT NULL DEFAULT '',
  ctaLabelEn  TEXT NOT NULL DEFAULT '',
  linkType    TEXT NOT NULL DEFAULT 'none' CHECK (linkType IN ('none','initiative','url')),
  linkTarget  TEXT NOT NULL DEFAULT '',
  placement   TEXT NOT NULL DEFAULT 'before_about' CHECK (placement IN ('before_about','before_steps','before_cta')),
  sortOrder   INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  startsAt    TEXT NOT NULL DEFAULT '',
  endsAt      TEXT NOT NULL DEFAULT '',
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  timestamp  TEXT NOT NULL,
  userId     TEXT NOT NULL DEFAULT 'unknown',
  userName   TEXT NOT NULL DEFAULT 'unknown',
  ip         TEXT NOT NULL DEFAULT '',
  actionType TEXT NOT NULL DEFAULT '',
  entityType TEXT NOT NULL DEFAULT '',
  entityId   TEXT NOT NULL DEFAULT '',
  summaryAr  TEXT NOT NULL DEFAULT '',
  beforeJson TEXT NOT NULL DEFAULT '',
  afterJson  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entityType, entityId);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp DESC);

-- PROD FIX: سجل التدقيق append-only — منع التعديل/المسح على مستوى القاعدة.
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_logs BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only');
END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_logs BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only');
END;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         TEXT PRIMARY KEY,
  userId     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tokenHash  TEXT NOT NULL,
  expiresAt  TEXT NOT NULL,
  revoked    INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0,1)),
  createdAt  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(userId);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
