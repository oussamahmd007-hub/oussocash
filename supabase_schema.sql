-- ═══════════════════════════════════════════════════════════════════
--  OussoCash — قاعدة بيانات Supabase (الإصدار 4 · كامل)
--  وكالة 1xBet معتمدة · الهوية = معرّف 1xBet · الدخول من أي جهاز
--
--  ▶ التشغيل: Supabase → SQL Editor → الصق هذا الملف كاملاً → Run
--  ▶ آمن للتشغيل أكثر من مرة (IF NOT EXISTS) ولا يحذف أي بيانات
--
--  منطق المشروع:
--   1) التحقق الأول: إدخال معرّف 1xBet → API يؤكد وجوده ويستخرج الاسم والعملة
--   2) المستخدم يودِع 200 UM عبر بروموكود OUSSO ويلعب
--   3) التحقق الثاني: الأدمن يرفع تقرير CSV → تفعيل الحساب
--   4) لا تُفتح لوحة التحكم إلا بعد التفعيل (status = active)
--   5) الدخول من أي جهاز بمعرفة المعرّف · السحب مرتبط بحساب 1xBet
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- 1) accounts — الحسابات (المعرّف فريد = الهوية الدائمة)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
    id              BIGSERIAL PRIMARY KEY,
    game_id         TEXT UNIQUE NOT NULL,            -- معرّف 1xBet (فريد لا يتكرر)
    name            TEXT DEFAULT '',                 -- اسم اللاعب (من 1xBet)
    currency        TEXT DEFAULT 'MRU',              -- عملة الحساب
    country         TEXT DEFAULT '',                 -- البلد (من CSV)
    xbet_reg_date   TEXT DEFAULT '',                 -- تاريخ التسجيل في 1xBet (من CSV)
    total_deposit   NUMERIC DEFAULT 0,               -- مجموع الإيداعات USD (من CSV)
    lang            TEXT DEFAULT 'ar',               -- لغة الواجهة
    status          TEXT DEFAULT 'pending',          -- pending | active | deposit_incomplete | banned
    balance_um      INTEGER DEFAULT 0,               -- رصيد الأرباح بالأوقية
    pin_hash        TEXT DEFAULT NULL,               -- (اختياري) رمز حماية
    owner_device    TEXT DEFAULT NULL,               -- بصمة أول جهاز سجّل (للإحصاء فقط)
    ref_code        TEXT UNIQUE NOT NULL,            -- كود الإحالة الخاص بهذا الحساب
    referrer_code   TEXT DEFAULT NULL,               -- كود من أحاله (إن وُجد)
    deposit_done    BOOLEAN DEFAULT FALSE,           -- هل أكمل الإيداع المطلوب
    deposit_needed  INTEGER DEFAULT 0,               -- المبلغ الناقص للوصول لـ 200 UM
    deadline_at     TIMESTAMPTZ DEFAULT NULL,        -- مهلة إكمال الإيداع (3 أيام)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    activated_at    TIMESTAMPTZ DEFAULT NULL,        -- وقت التفعيل (يُستخدم للمسابقات)
    last_seen_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acc_gid      ON accounts(game_id);
CREATE INDEX IF NOT EXISTS idx_acc_ref      ON accounts(ref_code);
CREATE INDEX IF NOT EXISTS idx_acc_referrer ON accounts(referrer_code) WHERE referrer_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acc_status   ON accounts(status);

-- ترقية تلقائية: إضافة الأعمدة الناقصة إن كان الجدول موجوداً بنسخة قديمة
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS country        TEXT DEFAULT '';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS xbet_reg_date  TEXT DEFAULT '';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS total_deposit  NUMERIC DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deposit_needed INTEGER DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deadline_at    TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS owner_device   TEXT DEFAULT NULL;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS activated_at   TIMESTAMPTZ DEFAULT NULL;


-- ───────────────────────────────────────────────────────────────────
-- 2) devices — الأجهزة (للإحصاء · الدخول مفتوح من أي جهاز)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
    id            BIGSERIAL PRIMARY KEY,
    game_id       TEXT NOT NULL,
    fingerprint   TEXT NOT NULL,
    trusted       BOOLEAN DEFAULT TRUE,
    user_agent    TEXT DEFAULT '',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(game_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_dev_gid ON devices(game_id);


-- ───────────────────────────────────────────────────────────────────
-- 3) referrals — الإحالات (activated_at لحساب المسابقات)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
    id              BIGSERIAL PRIMARY KEY,
    referrer_gid    TEXT NOT NULL,                   -- معرّف المُحيل
    referred_gid    TEXT NOT NULL,                   -- معرّف المُحال
    commission_um   INTEGER DEFAULT 0,               -- العمولة المدفوعة
    paid            BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    activated_at    TIMESTAMPTZ DEFAULT NULL,         -- وقت تفعيل المُحال
    UNIQUE(referrer_gid, referred_gid)
);
CREATE INDEX IF NOT EXISTS idx_ref_referrer  ON referrals(referrer_gid);
CREATE INDEX IF NOT EXISTS idx_ref_activated ON referrals(activated_at) WHERE activated_at IS NOT NULL;


-- ───────────────────────────────────────────────────────────────────
-- 4) withdrawals — السحوبات (إلى معرّف 1xBet المرتبط)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawals (
    id              BIGSERIAL PRIMARY KEY,
    game_id         TEXT NOT NULL,                   -- معرّف 1xBet المستلِم
    amount_um       INTEGER NOT NULL,
    method          TEXT NOT NULL DEFAULT '1xbet',   -- دائماً 1xbet
    account_number  TEXT NOT NULL,                   -- = معرّف 1xBet نفسه
    status          TEXT DEFAULT 'pending',          -- pending | approved | rejected
    requested_at    TIMESTAMPTZ DEFAULT NOW(),
    processed_at    TIMESTAMPTZ DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_wd_status ON withdrawals(status, requested_at);
CREATE INDEX IF NOT EXISTS idx_wd_gid    ON withdrawals(game_id);


-- ───────────────────────────────────────────────────────────────────
-- 5) banned_ids — المعرّفات المحظورة (مكافحة الاحتيال)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banned_ids (
    game_id     TEXT PRIMARY KEY,
    reason      TEXT DEFAULT '',
    banned_at   TIMESTAMPTZ DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────
-- 6) settings — الإعدادات العامة
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO settings(key, value) VALUES
    ('support_whatsapp', '22232230404'),
    ('channel_url',      'https://whatsapp.com/channel/0029Vb7TGP52phHUrKJ13u1p')
ON CONFLICT (key) DO NOTHING;


-- ───────────────────────────────────────────────────────────────────
-- 7) csv_uploads — سجل رفع تقارير 1xBet
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS csv_uploads (
    id              BIGSERIAL PRIMARY KEY,
    filename        TEXT,
    rows_total      INTEGER DEFAULT 0,
    rows_activated  INTEGER DEFAULT 0,
    uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────
-- 8) notifications — الإشعارات (game_id = '*' تعني رسالة جماعية)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id          BIGSERIAL PRIMARY KEY,
    game_id     TEXT NOT NULL,                       -- معرّف المستلِم · '*' = للجميع
    title       TEXT,
    body        TEXT,
    seen        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_gid ON notifications(game_id, seen);


-- ───────────────────────────────────────────────────────────────────
-- 9) contests — المسابقات (ترتيب الإحالات + جائزة + مهلة)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contests (
    id              BIGSERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    title_fr        TEXT DEFAULT '',
    prize_um        INTEGER DEFAULT 0,               -- مبلغ الجائزة
    required_refs   INTEGER DEFAULT 0,               -- الإحالات المطلوبة للتأهل
    starts_at       TIMESTAMPTZ DEFAULT NOW(),       -- الإحالات تُحسب من هنا فقط
    ends_at         TIMESTAMPTZ NOT NULL,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contest_active ON contests(active, ends_at);


-- ───────────────────────────────────────────────────────────────────
-- 10) feedback — اقتراحات المستخدمين (ساهم في تطوير OussoCash)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
    id          BIGSERIAL PRIMARY KEY,
    game_id     TEXT DEFAULT '',                     -- صاحب الاقتراح (إن وُجد)
    kind        TEXT DEFAULT 'idea',                 -- نوع الاقتراح
    title       TEXT DEFAULT '',
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);


-- ═══════════════════════════════════════════════════════════════════
--  RLS — أمان: لا وصول مباشر من المتصفح إطلاقاً.
--  فقط service_role (عبر الـ API في Vercel) يتجاوز RLS.
--  كل مستخدم يقرأ بياناته فقط عبر الجلسة الموقّعة في الـ API.
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_ids    ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_uploads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback      ENABLE ROW LEVEL SECURITY;
-- لا توجد policies = لا أحد يصل عبر anon key. فقط الـ API (service_role).
