# OussoCash — دليل النشر · Guide de déploiement

منصة احترافية لمستخدمي 1xBet · هوية عبر 1xBet ID فقط · إحالات + إشعارات.
Plateforme premium pour utilisateurs 1xBet · identité par ID 1xBet · parrainage + notifications.

---

## 1) قاعدة البيانات · Base de données (Supabase)

1. أنشئ مشروعاً على https://supabase.com
2. افتح **SQL Editor** والصق محتوى `supabase_schema.sql` ثم نفّذه مرة واحدة.
3. من **Settings → API** انسخ:
   - `Project URL` → سيصبح `SUPABASE_URL`
   - `service_role` key (السري) → سيصبح `SUPABASE_SERVICE_KEY`

> RLS مفعّل على كل الجداول. لا وصول من المتصفح إطلاقاً — فقط الـ API عبر service_role.

---

## 2) متغيّرات البيئة · Variables d'environnement (Vercel)

من **Vercel → Project → Settings → Environment Variables** أضف:

| المتغيّر | الوصف |
|---|---|
| `SUPABASE_URL` | رابط مشروع Supabase |
| `SUPABASE_SERVICE_KEY` | مفتاح service_role السري |
| `REFERRAL_SECRET` | نص عشوائي طويل (لتوليد أكواد الإحالة وتوقيع الجلسات) |
| `SESSION_SECRET` | نص عشوائي طويل (اختياري — يستخدم REFERRAL_SECRET إن غاب) |
| `ADMIN_PASSWORD` | كلمة مرور لوحة الإدارة |
| `XBET_API_URL` | رابط API الخاص بـ 1xBet |
| `XBET_HASH` | hash الكاشير |
| `XBET_CASHIERPASS` | كلمة مرور الكاشير |
| `XBET_CASHDESKID` | معرّف الكاشديسك |
| `ONESIGNAL_APP_ID` | `2bc2dce1-ddee-42f3-a013-504c9989bc37` |
| `ONESIGNAL_API_KEY` | REST API Key من OneSignal |

> لتوليد نص عشوائي: `openssl rand -hex 32`

---

## 3) الإشعارات · Notifications (OneSignal)

- App ID الحالي: `2bc2dce1-ddee-42f3-a013-504c9989bc37`
- من **OneSignal → Settings → Keys & IDs** انسخ **REST API Key** إلى `ONESIGNAL_API_KEY`.
- ملف `public/OneSignalSDKWorker.js` **يجب** أن يبقى في جذر الموقع (هو كذلك بالفعل).
- في إعداد OneSignal Web، اضبط Site URL على نطاق Vercel الخاص بك (مثال `https://oussocash.vercel.app`).
- الاستهداف يتم عبر `external_id = game_id`، والواجهة تنفّذ `OneSignal.login(game_id)` تلقائياً بعد الدخول.

---

## 4) النشر · Déploiement (Vercel)

```bash
npm i -g vercel      # إن لزم
vercel               # أول نشر
vercel --prod        # نشر الإنتاج
```

- `vercel.json` يحوّل `/r/:code` إلى الواجهة (روابط الإحالة تعمل مباشرة).
- مجلد `api/` يصبح دوال serverless تلقائياً (Node 18+).

---

## 5) روابط الإحالة · Liens de parrainage

- رابط كل مستخدم: `https://VOTRE-DOMAINE/r/CODE`
- عند فتح الرابط، يُلتقط الكود تلقائياً ويُربط بالحساب عند التفعيل.
- المكافآت: 100 UM ترحيب (للمُحال) · 20 UM لكل إحالة مُفعّلة · 25% من أرباح المُحالين.

---

## 6) لوحة الإدارة · Administration

كل الطلبات إلى `POST /api/admin` مع `password` و `action`:

- `dashboard` — إحصائيات عامة
- `accounts` — قائمة الحسابات
- `withdrawals` / `process_wd` — إدارة السحوبات
- `devices` / `trust_device` — إدارة الأجهزة الموثوقة (تفعيل جهاز جديد)
- `ban_id` — حظر معرّف
- `cleanup_pending` — حذف الحسابات المعلّقة منتهية المدة (>24h بلا إيداع)
- `process_csv` — رفع ملف 1xBet CSV ومعالجة التفعيل

### قواعد معالجة CSV
- المعرّف غير موجود في الملف → حذف الحساب
- لا يحوي SubId فيه `OUSSO` → حظر + حذف
- الإيداع < 200 UM → وضع `deposit_incomplete` (أو حظر+حذف إذا انتهت مهلة 3 أيام)
- صالح → تفعيل + دفع مكافأة الترحيب (للمُحالين فقط) + عمولة الإحالة

---

## ملاحظات الأمان · Notes de sécurité

- لا تُخزَّن كلمات مرور 1xBet أو بيانات بنكية أو معلومات استرجاع. الهوية = 1xBet ID المُتحقَّق منه فقط.
- السحب مرتبط دائماً بنفس الهوية، ومحمي بنظام **الأجهزة الموثوقة**: أي جهاز جديد يحتاج تفعيلاً يدوياً عبر الدعم قبل السحب.
- الجلسات موقّعة (HMAC) وتربط المعرّف ببصمة الجهاز.
- استرجاع حساب 1xBet يتم حصراً عبر القنوات الرسمية لـ 1xBet.
