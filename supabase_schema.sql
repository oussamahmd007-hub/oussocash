-- ═══════════════════════════════════════════════════════════════════
--  OussoCash — Schéma Supabase (v3)
--  وكالة 1xBet المعتمدة · الهوية = 1xBet ID · أمان صارم ضد التكرار
--
--  ▶ التشغيل: انسخ كامل هذا الملف في Supabase → SQL Editor → Run
--  ▶ آمن للتشغيل أكثر من مرة (IF NOT EXISTS / ON CONFLICT)
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1) accounts — الحسابات (الهوية = game_id، فريد لا يتكرر أبداً)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
    id              BIGSERIAL PRIMARY KEY,
    game_id         TEXT UNIQUE NOT NULL,            -- 1xBet ID = هوية دائمة (فريدة)
    name            TEXT DEFAULT '',
    currency        TEXT DEFAULT 'MRU',
    country         TEXT DEFAULT '',                 -- البلد (من CSV)
    xbet_reg_date   TEXT DEFAULT '',                 -- تاريخ التسجيل في 1xBet (من CSV)
    total_deposit   NUMERIC DEFAULT 0,               -- مجموع الإيداعات USD (من CSV)
    lang            TEXT DEFAULT 'ar',
    status          TEXT DEFAULT 'pending',          -- pending | active | deposit_incomplete | banned
    balance_um      INTEGER DEFAULT 0,
    pin_hash        TEXT DEFAULT NULL,
    owner_device    TEXT DEFAULT NULL,               -- بصمة الجهاز المالك (جهاز واحد = حساب واحد)
    ref_code        TEXT UNIQUE NOT NULL,            -- كود الإحالة الخاص بهذا الحساب
    referrer_code   TEXT DEFAULT NULL,               -- كود من أحاله (إن وُجد)
    deposit_done    BOOLEAN DEFAULT FALSE,
    deposit_needed  INTEGER DEFAULT 0,               -- المبلغ الناقص للوصول لـ 200 UM
    deadline_at     TIMESTAMPTZ DEFAULT NULL,        -- مهلة إكمال الإيداع (3 أيام)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    activated_at    TIMESTAMPTZ DEFAULT NULL,
    last_seen_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acc_gid      ON accounts(game_id);
CREATE INDEX IF NOT EXISTS idx_acc_ref      ON accounts(ref_code);
CREATE INDEX IF NOT EXISTS idx_acc_referrer ON accounts(referrer_code) WHERE referrer_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acc_owner    ON accounts(owner_device)  WHERE owner_device IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acc_status   ON accounts(status);

-- ───────────────────────────────────────────────────────────────────
-- 2) devices — الأجهزة الموثوقة (للسحب المحمي)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
    id            BIGSERIAL PRIMARY KEY,
    game_id       TEXT NOT NULL,
    fingerprint   TEXT NOT NULL,
    trusted       BOOLEAN DEFAULT FALSE,
    user_agent    TEXT DEFAULT '',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(game_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_dev_fp  ON devices(fingerprint);
CREATE INDEX IF NOT EXISTS idx_dev_gid ON devices(game_id);

-- ───────────────────────────────────────────────────────────────────
-- 3) referrals — الإحالات
--    activated_at يُستخدم لحساب المسابقات (الإحالات بعد بدء المسابقة فقط)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
    id              BIGSERIAL PRIMARY KEY,
    referrer_gid    TEXT NOT NULL,
    referred_gid    TEXT NOT NULL,
    commission_um   INTEGER DEFAULT 0,
    paid            BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    activated_at    TIMESTAMPTZ DEFAULT NULL,
    UNIQUE(referrer_gid, referred_gid)
);
CREATE INDEX IF NOT EXISTS idx_ref_referrer ON referrals(referrer_gid);
CREATE INDEX IF NOT EXISTS idx_ref_activated ON referrals(activated_at) WHERE activated_at IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────
-- 4) withdrawals — السحوبات (دائماً لنفس الهوية)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawals (
    id              BIGSERIAL PRIMARY KEY,
    game_id         TEXT NOT NULL,
    amount_um       INTEGER NOT NULL,
    method          TEXT NOT NULL,
    account_number  TEXT NOT NULL,
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
-- 6) settings — الإعدادات
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO settings(key, value) VALUES
    ('support_whatsapp', '22249002902'),
    ('channel_url',      'https://whatsapp.com/channel/0029Vb7TGP52phHUrKJ13u1p')
ON CONFLICT (key) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────
-- 7) csv_uploads — سجل رفع التقارير
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS csv_uploads (
    id              BIGSERIAL PRIMARY KEY,
    filename        TEXT,
    rows_total      INTEGER DEFAULT 0,
    rows_activated  INTEGER DEFAULT 0,
    uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────
-- 8) notifications — الإشعارات (داخلية + push عبر OneSignal)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id          BIGSERIAL PRIMARY KEY,
    game_id     TEXT NOT NULL,                       -- '*' = رسالة جماعية
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

-- ═══════════════════════════════════════════════════════════════════
--  RLS — لا وصول مباشر من المتصفح إطلاقاً. فقط service_role عبر الـ API.
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
