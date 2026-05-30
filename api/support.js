// api/support.js — مساعد ذكي يفهم نية المستخدم ويعرف كل مشروع OussoCash
const { json, readBody } = require('../lib/core');

// ═══════════════════════════════════════════════════════════════════
//  قاعدة المعرفة الكاملة (من faq.py الاحترافي) + فهم النية
// ═══════════════════════════════════════════════════════════════════
const KB = [
  {
    id: 'register',
    keys_ar: ['سجل','تسجيل','كيف ابدا','انشاء حساب','افتح حساب','ابدا','اشترك','انضم','رابط الوكالة','كيف اسجل'],
    keys_fr: ['inscrire','inscription','commencer','creer compte','ouvrir compte','comment sinscrire','rejoindre','lien agence'],
    ar: 'طريقة التسجيل عبر وكالة OussoCash:\n\n1. اضغط زر "سجل الآن" في الصفحة الرئيسية\n2. سيفتح موقع 1xBet — أدخل البروموكود OUSSO\n3. أكمل بياناتك وأنشئ الحساب\n4. أودع 200 UM على الأقل والعب بها\n5. عُد وأضف Game ID للتحقق\n\nمهم: سجّل عبر رابط الوكالة حصراً، فالبروموكود OUSSO يمنحك 200% على أول إيداع حتى 9000 UM. بعد التسجيل ستجد وكالتنا في قسم الإيداع.',
    fr: 'Inscription via l\'agence OussoCash:\n\n1. Appuyez sur "S\'inscrire" sur la page d\'accueil\n2. Le site 1xBet s\'ouvre — entrez le code OUSSO\n3. Complétez vos informations et créez le compte\n4. Déposez au moins 200 UM et jouez\n5. Revenez ajouter votre Game ID pour vérification\n\nImportant: inscrivez-vous uniquement via notre lien. Le code OUSSO donne 200% sur le 1er dépôt jusqu\'à 9000 UM. Vous trouverez notre agence dans la section Dépôt.',
  },
  {
    id: 'activate',
    keys_ar: ['فعل','تفعيل','كيف افعل','تنشيط','نشط','حسابي غير مفعل','متى يفعل'],
    keys_fr: ['activer','activation','comment activer','active','mon compte inactif'],
    ar: 'خطوات تفعيل حسابك في OussoCash:\n\n1. سجّل في 1xBet عبر رابط الوكالة ببروموكود OUSSO\n2. أودع 200 UM على الأقل (يمكن تقسيمها)\n3. العب بالمبلغ المودع لتنشيط الحساب\n4. أضف Game ID في قسم التحقق\n5. انتظر رسالة التأكيد\n\nبعد التفعيل تحصل فوراً على 100 UM مكافأة ترحيب. التحقق يتم عادة خلال أقل من ساعة.',
    fr: 'Étapes d\'activation OussoCash:\n\n1. Inscrivez-vous sur 1xBet via notre lien avec le code OUSSO\n2. Déposez au moins 200 UM (fractionnable)\n3. Jouez avec le montant déposé\n4. Ajoutez votre Game ID en vérification\n5. Attendez la confirmation\n\nAprès activation, vous recevez 100 UM de bonus. La vérification se fait généralement en moins d\'une heure.',
  },
  {
    id: 'promo',
    keys_ar: ['بروموكود','كود الترويج','promo','ousso','مكافاة التسجيل','بونص','200%','9000'],
    keys_fr: ['code promo','bonus inscription','ousso','200%','9000'],
    ar: 'مكافآت بروموكود OUSSO الحصرية:\n\nمن 1xBet:\n- 200% على أول إيداع حتى 9000 UM (مثال: تودع 1000 = تحصل على 3000 إجمالاً)\n- 200% كل يوم إثنين على الإيداع\n\nمن OussoCash:\n- 100 UM عند تفعيل حسابك\n- 20 UM عن كل شخص تدعوه ويُفعّل\n- 25% من أرباح من أحلتهم مدى الحياة\n\nمكافآت 1xBet مستقلة عن مكافآت OussoCash.',
    fr: 'Bonus exclusifs du code OUSSO:\n\nDe 1xBet:\n- 200% sur le 1er dépôt jusqu\'à 9000 UM (ex: dépôt 1000 = 3000 au total)\n- 200% chaque lundi sur le dépôt\n\nDe OussoCash:\n- 100 UM à l\'activation\n- 20 UM par personne invitée et activée\n- 25% des gains de vos filleuls à vie\n\nLes bonus 1xBet sont indépendants des bonus OussoCash.',
  },
  {
    id: 'referral_timing',
    keys_ar: ['متى تصلني','متى احصل','مكافاة الاحالة','عمولة','متى تضاف','احالاتي','25%','20um'],
    keys_fr: ['quand recois','commission','parrainage quand','recompense parrainage','25%','20um'],
    ar: 'توقيت مكافآت الإحالة:\n\nالمكافأة لا تُضاف عند تسجيل الشخص، بل فور تفعيل حسابه.\n\nالتسلسل:\n1. يسجل الشخص عبر رابطك ببروموكود OUSSO\n2. يودع 200 UM ويلعب بها\n3. يضيف Game ID للتحقق\n4. عند تفعيله تصلك 20 UM فوراً مع إشعار\n\nكما تحصل على 25% من أرباح من أحلتهم تلقائياً مع إشعار لحظة التفعيل.',
    fr: 'Délai des commissions de parrainage:\n\nLa commission est versée dès l\'activation de la personne, pas à l\'inscription.\n\nProcessus:\n1. La personne s\'inscrit via votre lien avec le code OUSSO\n2. Elle dépose 200 UM et joue\n3. Elle ajoute son Game ID\n4. À son activation, vous recevez 20 UM avec notification\n\nVous recevez aussi 25% des gains de vos filleuls automatiquement.',
  },
  {
    id: 'withdraw',
    keys_ar: ['سحب','اسحب','فلوسي','اموالي','كيف اسحب','طلب سحب','اخراج'],
    keys_fr: ['retrait','retirer','mes gains','comment retirer','demande retrait','argent'],
    ar: 'طريقة سحب الأرباح:\n\nالشروط:\n- رصيدك 300 UM على الأقل\n- حسابك مفعّل ببروموكود OUSSO\n\nالخطوات:\n1. اذهب لقسم السحب في حسابك\n2. اختر الطريقة: Bankily أو Masrvi أو Sedad\n3. أدخل رقم حسابك\n4. أكّد الطلب (يُسحب رصيدك كاملاً)\n5. يعالج وكيلنا الطلب ويحوّل لك\n\nبدون أي رسوم على السحب إطلاقاً.',
    fr: 'Procédure de retrait:\n\nConditions:\n- Solde d\'au moins 300 UM\n- Compte activé avec le code OUSSO\n\nÉtapes:\n1. Allez dans la section Retrait\n2. Choisissez: Bankily, Masrvi ou Sedad\n3. Entrez votre numéro de compte\n4. Confirmez (tout le solde est retiré)\n5. Notre agent traite et vous crédite\n\nAucuns frais sur les retraits.',
  },
  {
    id: 'payment',
    keys_ar: ['طرق الدفع','طرق السحب','bankily','masrvi','sedad','وسائل الدفع','بنكيلي','مصرفي'],
    keys_fr: ['moyens paiement','methodes','bankily','masrvi','sedad','comment payer'],
    ar: 'طرق الدفع عبر وكالة OussoCash:\n\nالتحويل المحلي: Bankily، Masrvi، Sedad، BimBank، Click، BCIPay، Amanty\nالبطاقات: Mastercard، Visa\n\nالمزايا:\n- بدون أي رسوم على الإيداع والسحب\n- متوفرون 24 ساعة طوال الأسبوع\n- معالجة سريعة\n- دعم كامل لأي مشكلة',
    fr: 'Moyens de paiement OussoCash:\n\nLocal: Bankily, Masrvi, Sedad, BimBank, Click, BCIPay, Amanty\nCartes: Mastercard, Visa\n\nAvantages:\n- Aucuns frais sur dépôts et retraits\n- Disponible 24h/24, 7j/7\n- Traitement rapide\n- Support complet',
  },
  {
    id: 'id_rejected',
    keys_ar: ['رفض','لم يقبل','لماذا رفض','مشكلة id','id خطا','حسابي مرفوض','ما قبل'],
    keys_fr: ['refus','refuse','rejete','pourquoi refuse','probleme id','id incorrect'],
    ar: 'أسباب رفض ID الحساب وحلولها:\n\n1. الحساب غير مرتبط بـ OUSSO — أنشئ حساباً جديداً عبر رابط الوكالة ببروموكود OUSSO\n2. الإيداع غير كافٍ — أودع حتى يصل 200 UM\n3. الحساب غير نشط — العب بالمبلغ المودع\n4. ID خاطئ — تأكد من نسخه صحيحاً من 1xBet\n\nللمساعدة المباشرة تواصل مع دعم واتساب.',
    fr: 'Raisons du refus de l\'ID:\n\n1. Compte non lié à OUSSO — créez un nouveau compte via notre lien avec OUSSO\n2. Dépôt insuffisant — déposez jusqu\'à 200 UM\n3. Compte inactif — jouez avec le montant déposé\n4. ID incorrect — vérifiez la copie depuis 1xBet\n\nPour assistance, contactez le support WhatsApp.',
  },
  {
    id: 'limits',
    keys_ar: ['حد ادنى','اقل مبلغ','كم اودع','كم اسحب','300','200','الحدود','minimum'],
    keys_fr: ['minimum','montant min','combien deposer','combien retirer','limites','300','200'],
    ar: 'الحدود الدنيا في OussoCash:\n\nالإيداع للتفعيل: 200 UM (يمكن تقسيمها، بشرط اللعب بها)\nالسحب: 300 UM كحد أدنى، بدون حد أقصى، بدون رسوم\n\nمكافأة 1xBet: 200% على أول إيداع حتى 9000 UM (مثال: 500 إيداع = 1500 في حسابك).\n\nرصيد OussoCash مستقل تماماً عن رصيد 1xBet.',
    fr: 'Montants minimums OussoCash:\n\nDépôt activation: 200 UM (fractionnable, à jouer)\nRetrait: 300 UM minimum, pas de maximum, sans frais\n\nBonus 1xBet: 200% sur le 1er dépôt jusqu\'à 9000 UM (ex: 500 = 1500).\n\nLe solde OussoCash est indépendant du solde 1xBet.',
  },
  {
    id: 'find_agency',
    keys_ar: ['وكالة','كيف ارى الوكالة','اظهار الوكالة','وكالتكم','وين الوكالة','معتمدة','موثوق','نصاب','حقيقي'],
    keys_fr: ['agence','voir agence','trouver agence','officielle','fiable','arnaque','confiance'],
    ar: 'طريقة إيجاد وكالة OussoCash في 1xBet:\n\n1. سجّل عبر رابط الوكالة ببروموكود OUSSO\n2. ادخل حسابك في 1xBet\n3. اذهب لقسم الإيداع\n4. ابحث عن "تحويل حوالة إلكترونية"\n5. ستجد OUSSO CASH ظاهراً رسمياً\n\nهذا دليل أننا وكالة معتمدة. إن لم تظهر، تأكد من التسجيل ببروموكود OUSSO وتواصل مع الدعم. وكالتنا تعمل بخبرة أكثر من 5 سنوات.',
    fr: 'Trouver l\'agence OussoCash dans 1xBet:\n\n1. Inscrivez-vous via notre lien avec OUSSO\n2. Connectez-vous à 1xBet\n3. Allez dans Dépôt\n4. Cherchez "Transfert électronique"\n5. Vous verrez OUSSO CASH affiché officiellement\n\nC\'est la preuve que nous sommes une agence certifiée avec plus de 5 ans d\'expérience.',
  },
  {
    id: 'ref_link',
    keys_ar: ['رابط الاحالة','رابطي','رابط لا يعمل','مشاركة الرابط','كيف اشارك','ادعو'],
    keys_fr: ['lien parrainage','mon lien','lien marche pas','partager lien','inviter'],
    ar: 'رابط الإحالة الخاص بك:\n\nتجده في حسابك بعد التسجيل. كل شخص يسجل عبره يُنسب إليك تلقائياً.\n\nمهم:\n- المكافأة تُضاف فقط بعد تفعيل حساب الشخص (ليس عند الضغط)\n- من سجّل مسبقاً لا يُحتسب إحالة جديدة\n\nنصيحة: شارك الرابط مع شرح فوائد بروموكود OUSSO لزيادة تفعيل إحالاتك.',
    fr: 'Votre lien de parrainage:\n\nDisponible dans votre compte après inscription. Chaque inscrit via ce lien vous est attribué automatiquement.\n\nImportant:\n- La commission est versée après activation (pas au clic)\n- Une personne déjà inscrite ne compte pas\n\nConseil: partagez le lien en expliquant les avantages du code OUSSO.',
  },
  {
    id: 'balance',
    keys_ar: ['رصيد','كم عندي','ارباحي','حسابي','كم ربحت'],
    keys_fr: ['solde','combien jai','mes gains','mon compte','combien gagne'],
    ar: 'تجد رصيدك وأرباحك وعدد إحالاتك المفعّلة في حسابك بعد تسجيل الدخول. كل إشعارات التفعيل والأرباح تصلك فوراً إذا فعّلت الإشعارات.',
    fr: 'Votre solde, gains et nombre de parrainages activés sont dans votre compte. Toutes les notifications arrivent immédiatement si vous activez les notifications.',
  },
  {
    id: 'notifications',
    keys_ar: ['اشعار','اشعارات','تنبيه','notification'],
    keys_fr: ['notification','alerte','avis'],
    ar: 'فعّل الإشعارات من حسابك لتصلك تنبيهات التفعيل والأرباح لحظة حدوثها. نحن لا نرسل أي رسائل مزعجة إطلاقاً.',
    fr: 'Activez les notifications pour recevoir les alertes d\'activation et de gains instantanément. Nous n\'envoyons jamais de spam.',
  },
];

// تطبيع النص العربي/الفرنسي
function normalize(s) {
  return (s || '').toLowerCase().trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[ïî]/g, 'i').replace(/[ôö]/g, 'o').replace(/[ùûü]/g, 'u')
    .replace(/[^\w\u0600-\u06FF\s%]/g, ' ')
    .replace(/\s+/g, ' ');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const q = normalize(body.message);
    const lang = body.lang === 'fr' ? 'fr' : 'ar';
    if (!q || q.length < 2) return json(res, 200, { answer: null, found: false });

    const qWords = q.split(' ').filter((w) => w.length > 1);
    let best = null, bestScore = 0;

    for (const item of KB) {
      const keys = lang === 'fr' ? item.keys_fr : item.keys_ar;
      let score = 0;
      for (const k of keys) {
        const nk = normalize(k);
        if (q.includes(nk)) score += nk.length > 5 ? 4 : 3;
        else {
          // مطابقة جزئية بالكلمات
          const kw = nk.split(' ');
          for (const w of kw) {
            if (w.length > 2 && qWords.includes(w)) score += 1;
          }
        }
      }
      if (score > bestScore) { bestScore = score; best = item; }
    }

    if (best && bestScore >= 3) {
      return json(res, 200, { answer: best[lang], found: true, intent: best.id });
    }
    return json(res, 200, { answer: null, found: false });
  } catch (e) {
    return json(res, 500, { error: 'server' });
  }
};
