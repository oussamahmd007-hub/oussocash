# OussoCash — دليل التشغيل الكامل

منصة وكالة 1xBet معتمدة: تحقق عبر API + تفعيل عبر CSV + إحالات + مسابقات + رياضة + دعم ذكي.

---

## 1) الملفات التي ترفعها على GitHub

ارفع **كل** مجلد `oussocash` كما هو:

```
oussocash/
├── api/            (verify, register, me, withdraw, device-auth, config,
│                    contest, admin, support, sport)
├── lib/            (core.js, support-kb.js)
├── public/         (index.html, app.js, styles.css, texts.js,
│                    admin.html, admin.css, admin.js,
│                    OneSignalSDKWorker.js ← في الجذر،
│                    logos/, images/)
├── .gitignore
├── package.json
├── vercel.json
├── supabase_schema.sql
└── SETUP.md
```

❌ **لا ترفع أبداً:** ملف `.env` أو أي مفتاح سري. ملف `.gitignore` يمنع ذلك تلقائياً.

---

## 2) متغيّرات البيئة في Vercel (Settings → Environment Variables)

| المتغيّر | القيمة |
|---|---|
| `SUPABASE_URL` | رابط مشروع Supabase |
| `SUPABASE_SERVICE_KEY` | مفتاح service_role |
| `REFERRAL_SECRET` | نص عشوائي طويل (`openssl rand -hex 32`) |
| `SESSION_SECRET` | نص عشوائي طويل آخر |
| `ADMIN_PASSWORD` | كلمة مرور لوحة الإدارة |
| `XBET_API_URL` | `https://partners.servcul.com/CashdeskBotAPI` |
| `XBET_HASH` | من مدير 1xBet |
| `XBET_CASHIERPASS` | من مدير 1xBet |
| `XBET_CASHDESKID` | من مدير 1xBet |
| `ONESIGNAL_APP_ID` | `2bc2dce1-ddee-42f3-a013-504c9989bc37` |
| `ONESIGNAL_API_KEY` | مفتاح OneSignal REST (يبدأ بـ os_v2_app_…) |
| `FOOTBALL_API_KEY` | مفتاح football-data.org (لقسم الرياضة) |
| `TELEGRAM_BOT_TOKEN` | (اختياري) توكن بوت تيليجرام لاستقبال الاقتراحات |
| `TELEGRAM_CHAT_ID` | (اختياري) معرّف قناة/مجموعة الإدارة على تيليجرام |

> ⚠️ **مهم:** أنشئ مفتاح football-data.org جديداً إن سبق أن شاركته، وضعه هنا فقط.

---

## 3) الإجراءات بالترتيب

**أ. Supabase**
1. أنشئ مشروعاً على supabase.com
2. SQL Editor → الصق كامل `supabase_schema.sql` → Run
3. Settings → API → انسخ `Project URL` و `service_role key`

**ب. GitHub** — أنشئ repo (خاص أفضل) وارفع كل الملفات.

**ج. Vercel** — New Project → اربط الـ repo → أضف كل المتغيّرات → Deploy.

**د. OneSignal** — اضبط Site URL على نطاق Vercel، وتأكد أن
`نطاقك/OneSignalSDKWorker.js` يعمل.

**هـ. football-data.org** — سجّل مجاناً، خذ المفتاح، ضعه في `FOOTBALL_API_KEY`.

---

## 4) تسلسل تجربة المستخدم (Event Flow)

1. **الدخول** → شاشة splash → الصفحة الرئيسية (هوية الوكالة + CTA "تحقّق من حسابك").
2. **التحقق الأول (API):** يُدخل المستخدم معرّف 1xBet → النظام:
   - يرفض إن كان الجهاز يملك حساباً (`device_has_account`)
   - يرفض إن كان المعرّف مستخدماً من آخر (`id_taken`)
   - يرفض إن كان محظوراً (`banned`)
   - يرفض إن لم يوجد في 1xBet (`not_found`)
   - يستخرج الاسم والعملة إن وُجد → ينشئ حساب **pending**.
3. **الإيداع:** المستخدم يودِع ≥ 200 UM عبر بروموكود OUSSO.
4. **التحقق الثاني (CSV):** الأدمن يرفع تقرير 1xBet من لوحة الإدارة →
   - غير موجود في التقرير → حذف
   - بدون OUSSO → حظر + حذف
   - إيداع < 200 → "إيداع غير مكتمل" + المبلغ الناقص + مهلة 3 أيام
   - صالح → **تفعيل** + مكافأة ترحيب + عمولة الإحالة.
5. **بعد التفعيل:** رصيد، إحالات، سحب (عبر جهاز موثوق فقط)، مسابقات، رياضة، دعم.

---

## 5) قواعد الأمان المطبّقة

- المعرّف فريد: لا يتكرر في حسابين (UNIQUE + معالجة السباق).
- لا يُتحقق من معرّف مستخدمٍ من جهاز آخر.
- جهاز واحد = حساب واحد (لا إضافة معرّف بعد امتلاك حساب).
- القبول النهائي عبر CSV فقط (الـ API يؤكد الوجود فقط).
- كل مستخدم يقرأ بياناته فقط (جلسة موقّعة HMAC).
- السحب عبر الجهاز الموثوق فقط.
- كل الأسرار في Vercel، لا شيء في GitHub.

---

## 6) لوحة الإدارة — `نطاقك/admin.html`

- **الرئيسية:** إحصائيات (الحسابات، المفعّلة، المعلّقة، السحوبات).
- **التقارير:** رفع CSV ومعالجته (تفعيل/حظر/حذف تلقائي).
- **بحث:** عن أي معرّف → بياناته كاملة + حظر/توثيق جهاز.
- **السحوبات:** قبول/رفض (الرفض يُرجع الرصيد).
- **مسابقات:** إنشاء (جائزة + إحالات مطلوبة + مهلة) → يُشعر الجميع.
- **رسالة جماعية:** broadcast لكل المستخدمين.

---

## 7) تطبيق PWA (تنزيل التطبيق)

الموقع قابل للتثبيت كتطبيق هاتف:
- `public/manifest.webmanifest` — هوية التطبيق والأيقونات.
- `public/sw.js` — service worker خفيف للتثبيت (منفصل عن OneSignal).
- زر "تنزيل التطبيق" يظهر تلقائياً في الأعلى على Android، وعلى iPhone يرشد المستخدم لـ «أضف إلى الشاشة الرئيسية».

> الإشعارات: OneSignal يطلب الإذن بلطف بعد دخول المستخدم بثانيتين (مرة واحدة فقط).

---

## 8) التحديث المستقبلي (تقسيم احترافي)

- **الألوان:** عدّل متغيّرات CSS في أعلى `styles.css` فقط.
- **النصوص:** كل النصوص في `public/texts.js` (عربي/فرنسي).
- **الثوابت** (المكافآت، الحدود): في `lib/core.js`.
- **كل API منفصل** في ملفه (`api/*.js`).
- **الأدمن منفصل تماماً** عن تطبيق المستخدم.
- **معرفة الدعم:** `lib/support-kb.js` (40 نية).
