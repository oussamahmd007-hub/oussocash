-- ═══════════════════════════════════════════════════════════════════
--  OussoCash — Schéma Supabase (Identité basée sur 1xBet ID)
--  مخطط قاعدة البيانات — الهوية مبنية على 1xBet ID فقط
--  exécuter une seule fois dans Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1) Comptes — l'identité = game_id (jamais modifiable)
--    الحسابات — الهوية = game_id (لا تتغير أبداً)
CREATE TABLE IF NOT EXISTS accounts (
    id              BIGSERIAL PRIMARY KEY,
    game_id         TEXT UNIQUE NOT NULL,           -- 1xBet ID = identité permanente
    name            TEXT DEFAULT '',
    currency        TEXT DEFAULT 'MRU',
    country         TEXT DEFAULT '',                -- البلد (depuis CSV)
    xbet_reg_date   TEXT DEFAULT '',                -- تاريخ التسجيل في 1xBet
    total_deposit   NUMERIC DEFAULT 0,              -- مجموع الإيداعات (USD)
    lang            TEXT DEFAULT 'ar',
    status          TEXT DEFAULT 'pending',         -- pending | active | deposit_incomplete | banned
    balance_um      INTEGER DEFAULT 0,
    pin_hash        TEXT DEFAULT NULL,              -- PIN 4 chiffres (optionnel) — haché
    ref_code        TEXT UNIQUE NOT NULL,           -- code de parrainage de ce compte
    referrer_code   TEXT DEFAULT NULL,              -- code du parrain (si inscrit via lien)
    deposit_done    BOOLEAN DEFAULT FALSE,          -- dépôt 200 UM confirmé
    deadline_at     TIMESTAMPTZ DEFAULT NULL,       -- date limite dépôt (3 jours)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    activated_at    TIMESTAMPTZ DEFAULT NULL,
    last_seen_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acc_gid       ON accounts(game_id);
CREATE INDEX IF NOT EXISTS idx_acc_ref       ON accounts(ref_code);
CREATE INDEX IF NOT EXISTS idx_acc_referrer  ON accounts(referrer_code) WHERE referrer_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acc_status    ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_acc_pending   ON accounts(created_at) WHERE status = 'pending';

-- 2) Appareils de confiance — empreinte par appareil (anti-spam + sécurité)
--    الأجهزة الموثوقة — بصمة لكل جهاز (مكافحة الإساءة + أمان)
CREATE TABLE IF NOT EXISTS devices (
    id            BIGSERIAL PRIMARY KEY,
    game_id       TEXT NOT NULL,
    fingerprint   TEXT NOT NULL,                    -- empreinte d'appareil (hachée)
    trusted       BOOLEAN DEFAULT FALSE,            -- autorisé pour les retraits protégés
    user_agent    TEXT DEFAULT '',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(game_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_dev_fp  ON devices(fingerprint);
CREATE INDEX IF NOT EXISTS idx_dev_gid ON devices(game_id);

-- 3) Parrainages
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

-- 4) Retraits — toujours vers la même identité 1xBet
CREATE TABLE IF NOT EXISTS withdrawals (
    id              BIGSERIAL PRIMARY KEY,
    game_id         TEXT NOT NULL,
    amount_um       INTEGER NOT NULL,
    method          TEXT NOT NULL,                  -- Bankily | Masrvi | Sedad
    account_number  TEXT NOT NULL,
    status          TEXT DEFAULT 'pending',         -- pending | approved | rejected
    requested_at    TIMESTAMPTZ DEFAULT NOW(),
    processed_at    TIMESTAMPTZ DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_wd_status ON withdrawals(status, requested_at);

-- 5) IDs bloqués (anti-fraude)
CREATE TABLE IF NOT EXISTS banned_ids (
    game_id     TEXT PRIMARY KEY,
    reason      TEXT DEFAULT '',
    banned_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 6) Paramètres (gérés par l'admin)
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO settings(key, value) VALUES
    ('support_whatsapp', '22249002902'),
    ('channel_url',      'https://whatsapp.com/channel/0029Vb7TGP52phHUrKJ13u1p')
ON CONFLICT (key) DO NOTHING;

-- 7) Journal CSV
CREATE TABLE IF NOT EXISTS csv_uploads (
    id              BIGSERIAL PRIMARY KEY,
    filename        TEXT,
    rows_total      INTEGER DEFAULT 0,
    rows_activated  INTEGER DEFAULT 0,
    uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 8) Notifications (livrées à l'ouverture + push OneSignal)
CREATE TABLE IF NOT EXISTS notifications (
    id          BIGSERIAL PRIMARY KEY,
    game_id     TEXT NOT NULL,
    title       TEXT,
    body        TEXT,
    seen        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_gid ON notifications(game_id, seen);

-- ═══════════════════════════════════════════════════════════════════
--  RLS : aucun accès direct depuis le navigateur.
--  Toutes les opérations passent par l'API (service_role).
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_ids    ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_uploads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- pas de policy = aucun accès via anon key. Seul service_role (API) y accède.
