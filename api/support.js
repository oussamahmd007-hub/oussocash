// api/support.js — بوت دعم ذكي (قائم على فهم النية، بدون AI مدفوع)
const { json, readBody } = require('../lib/core');

// قاعدة المعرفة: نية → إجابة (عربي/فرنسي) + كلمات مفتاحية
const KB = [
  {
    keys: ['تسجيل', 'سجل', 'كيف ابدا', 'انشاء حساب', 'inscription', 'inscrire', 'compte', 'commencer'],
    ar: 'للتسجيل: اضغط زر "سجل الان"، انشئ حساب 1xBet ببروموكود OUSSO، ادفع 200 UM اول ايداع، ثم ارسل ID الحساب للتحقق. التفعيل بعد المراجعة.',
    fr: 'Pour vous inscrire: cliquez "S\'inscrire", creez un compte 1xBet avec le code OUSSO, deposez 200 UM, puis envoyez votre ID. Activation apres verification.',
  },
  {
    keys: ['بروموكود', 'كود الترويج', 'promo', 'code', 'ousso'],
    ar: 'البروموكود الرسمي هو OUSSO. استخدمه اثناء التسجيل في 1xBet. لا يمكن اضافته بعد انشاء الحساب.',
    fr: 'Le code promo officiel est OUSSO. Utilisez-le lors de l\'inscription sur 1xBet. Il ne peut pas etre ajoute apres.',
  },
  {
    keys: ['ايداع', 'كم ادفع', '200', 'depot', 'deposer', 'minimum depot'],
    ar: 'اول ايداع مطلوب هو 200 UM. يمكنك تقسيمه لكن يجب ان يصل المجموع الى 200 UM واللعب به.',
    fr: 'Le premier depot requis est 200 UM. Vous pouvez le diviser mais le total doit atteindre 200 UM.',
  },
  {
    keys: ['مكافاة', 'ترحيب', '100', 'كم اربح', 'recompense', 'bonus', 'bienvenue', 'gagner'],
    ar: 'المكافات: 100 UM ترحيب عند التفعيل (تحتاج كود احالة صحيح)، 20 UM لكل صديق تحيله ويفعل، و25% من ارباح من احلتهم مدى الحياة.',
    fr: 'Recompenses: 100 UM de bienvenue a l\'activation (avec code valide), 20 UM par ami active, et 25% de leurs gains a vie.',
  },
  {
    keys: ['احالة', 'احالات', 'رابط', 'مشاركة', 'اصدقاء', 'reference', 'parrainage', 'inviter', 'lien', 'ami'],
    ar: 'رابط الاحالة الخاص بك تجده في حسابك بعد التسجيل. شاركه مع اصدقائك: كل صديق يفعل = 20 UM لك + 25% من ارباحه.',
    fr: 'Votre lien d\'invitation est dans votre compte. Partagez-le: chaque ami active = 20 UM + 25% de ses gains.',
  },
  {
    keys: ['سحب', 'اسحب', 'فلوسي', 'اموالي', 'retrait', 'retirer', 'argent', 'bankily', 'masrvi', 'sedad'],
    ar: 'السحب عبر Bankily او Masrvi او Sedad بدون رسوم. الحد الادنى 300 UM. اذهب لقسم السحب، اختر الطريقة، ادخل رقم حسابك، واكد الطلب.',
    fr: 'Retrait via Bankily, Masrvi ou Sedad sans frais. Minimum 300 UM. Allez dans Retrait, choisissez la methode, entrez votre numero et confirmez.',
  },
  {
    keys: ['حد ادنى', '300', 'اقل مبلغ', 'minimum', 'combien retirer'],
    ar: 'الحد الادنى للسحب هو 300 UM. ادع المزيد من الاصدقاء للوصول اليه بسرعة.',
    fr: 'Le minimum de retrait est 300 UM. Invitez plus d\'amis pour l\'atteindre vite.',
  },
  {
    keys: ['تفعيل', 'متى افعل', 'كم وقت', 'بطيء', 'تاخر', 'activation', 'quand active', 'temps'],
    ar: 'التفعيل يتم بعد مراجعة حسابك (تاكيد بروموكود OUSSO وايداع 200 UM). ستصلك اشعار فور التفعيل اذا فعّلت الاشعارات.',
    fr: 'L\'activation se fait apres verification (code OUSSO + depot 200 UM). Vous recevrez une notification a l\'activation.',
  },
  {
    keys: ['id', 'اي دي', 'game id', 'معرف', 'لا يعمل', 'خطا', 'introuvable'],
    ar: 'Game ID هو رقم حسابك في 1xBet. تجده بعد التسجيل او في تطبيق 1xBet ضمن الملف الشخصي. ادخله في قسم التحقق.',
    fr: 'Le Game ID est le numero de votre compte 1xBet. Trouvez-le apres inscription ou dans l\'app 1xBet (profil).',
  },
  {
    keys: ['رصيد', 'كم عندي', 'solde', 'combien'],
    ar: 'تجد رصيدك وارباحك وعدد احالاتك في حسابك بعد تسجيل الدخول.',
    fr: 'Votre solde, gains et invitations sont dans votre compte apres connexion.',
  },
  {
    keys: ['وكالة', 'موثوق', 'امن', 'نصاب', 'حقيقي', 'agence', 'fiable', 'arnaque', 'securise'],
    ar: 'OussoCash وكالة 1xBet معتمدة رسميا في موريتانيا منذ 2022، بالاف العملاء وسحوبات يومية. يمكنك التحقق: ادخل قسم الايداع في 1xBet وسترى اسم OussoCash.',
    fr: 'OussoCash est une agence 1xBet officielle en Mauritanie depuis 2022. Verifiez: entrez dans les depots 1xBet et vous verrez OussoCash.',
  },
  {
    keys: ['اشعار', 'اشعارات', 'notification', 'push'],
    ar: 'فعّل الاشعارات من حسابك لتصلك تنبيهات التفعيل والارباح فورا. نحن لا نرسل سبام ابدا.',
    fr: 'Activez les notifications dans votre compte pour les alertes d\'activation et de gains. Pas de spam.',
  },
];

function normalize(s) {
  return (s || '').toLowerCase().trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const q = normalize(body.message);
    const lang = body.lang === 'fr' ? 'fr' : 'ar';
    if (!q || q.length < 2) return json(res, 200, { answer: null, found: false });

    let best = null, bestScore = 0;
    for (const item of KB) {
      let score = 0;
      for (const k of item.keys) {
        const nk = normalize(k);
        if (q.includes(nk)) score += nk.length > 4 ? 3 : 2;
      }
      if (score > bestScore) { bestScore = score; best = item; }
    }

    if (best && bestScore >= 2) {
      return json(res, 200, { answer: best[lang], found: true });
    }
    return json(res, 200, { answer: null, found: false });
  } catch (e) {
    return json(res, 500, { error: 'server' });
  }
};
