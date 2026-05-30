// public/texts.js — كل النصوص (عربي/فرنسي) - نظيفة بدون إيموجي
window.TEXTS = {
  ar: {
    dir: 'rtl', langBtn: 'FR',
    brand_sub: 'وكالة 1xBet المعتمدة في موريتانيا',
    nav_home: 'الرئيسية', nav_account: 'حسابي', nav_support: 'الدعم',

    // hero
    hero_title: 'مرحبا بك في OussoCash',
    hero_desc: 'وكالة 1xBet الرسمية المعتمدة في موريتانيا منذ 2022. سجّل، فعّل حسابك، واربح مع برنامج الإحالة.',
    btn_register: 'سجّل الآن',
    btn_how: 'طريقة العمل',
    btn_account: 'الدخول إلى حسابي',

    // rewards
    rewards_title: 'اربح أكثر مع برنامج الإحالة',
    rw_welcome: 'مكافأة ترحيبية', rw_welcome_d: 'عند تسجيلك بكود إحالة صحيح',
    rw_ref: 'من كل إحالة', rw_ref_d: 'لكل صديق يفعّل حسابه',
    rw_pct: 'من أرباح من أحلتهم', rw_pct_d: 'مدى الحياة',

    // steps
    steps_title: 'كيف تبدأ في 4 خطوات',
    step1: 'سجّل في 1xBet', step1d: 'ببروموكود OUSSO عبر رابطنا',
    step2: 'ادفع 200 UM', step2d: 'أول إيداع والعب به',
    step3: 'أرسل Game ID', step3d: 'للتحقق من حسابك',
    step4: 'استلم 100 UM', step4d: 'مكافأة ترحيب وابدأ الربح',

    // videos
    videos_title: 'شروحات بالفيديو',
    vid_register: 'طريقة التسجيل',
    vid_agency: 'طريقة إظهار الوكالة المعتمدة',

    // agency
    agency_title: 'وكالة معتمدة وموثوقة',
    feat1: 'سحب فوري', feat1d: 'عبر Bankily و Masrvi و Sedad بدون رسوم',
    feat2: 'معتمدون منذ 2022', feat2d: 'ترخيص رسمي وآلاف العملاء',
    feat3: 'دعم متواصل', feat3d: 'فريق دعم على مدار الساعة',
    feat4: 'شفافية كاملة', feat4d: 'أرباحك محفوظة وواضحة دائماً',

    // withdraw methods
    withdraw_title: 'طرق السحب المتاحة',

    // support
    support_title: 'الدعم الفني الرسمي',
    support_desc: 'فريقنا جاهز لمساعدتك في أي وقت',
    btn_whatsapp: 'تواصل عبر واتساب',
    btn_channel: 'انضم لقناتنا الرسمية',

    // register modal
    reg_title: 'التسجيل في OussoCash',
    reg_phone: 'رقم واتساب',
    reg_phone_ph: 'مثال: 22XXXXXX',
    reg_phone_note: 'هذا الرقم هو المعتمد الوحيد للتواصل مع الدعم وحماية بياناتك',
    reg_refcode: 'كود الإحالة (اختياري)',
    reg_refcode_ph: 'إن وُجد',
    reg_submit: 'تسجيل',
    reg_err_phone: 'رقم واتساب غير صحيح',
    reg_err_ref: 'رمز الإحالة غير صحيح',
    reg_link_title: 'رابط التسجيل في 1xBet',
    reg_link_desc: 'سجّل ببروموكود OUSSO ثم عُد للتحقق من حسابك',
    reg_link_btn: 'فتح رابط التسجيل',

    // account
    acc_balance: 'رصيدك', acc_refs: 'إحالاتك المفعّلة', acc_earned: 'أرباحك',
    acc_gameid: 'Game ID', acc_status: 'الحالة',
    status_verified: 'مفعّل', status_pending: 'قيد التحقق', status_new: 'غير مفعّل',
    acc_myref: 'رابط الإحالة الخاص بك',
    acc_copy: 'نسخ الرابط', acc_copied: 'تم النسخ',
    acc_share: 'مشاركة',
    acc_verify_btn: 'تحقق من حسابك الآن',
    acc_withdraw_btn: 'طلب سحب',
    acc_logout: 'خروج',

    // verify id
    vid_title: 'التحقق من Game ID',
    vid_enter: 'أدخل Game ID الخاص بك في 1xBet',
    vid_check: 'تحقق',
    vid_checking: 'جاري التحقق...',
    vid_found: 'تم العثور على الحساب',
    vid_notfound: 'لم يتم العثور على الحساب',
    vid_taken: 'هذا الـ ID مستخدم بحساب آخر',
    vid_banned: 'هذا الـ ID محظور من النظام',
    vid_name: 'اسم المستخدم', vid_currency: 'العملة',
    confirm_title: 'تأكيد التحقق',
    confirm_desc: 'سنقوم بمراجعة البيانات التالية للتحقق من حسابك:',
    confirm_l1: 'اسم المستخدم', confirm_l2: 'عملة الحساب',
    confirm_l3: 'البروموكود المرتبط', confirm_l4: 'تاريخ فتح الحساب',
    confirm_l5: 'مجموع الإيداعات',
    confirm_yes: 'نعم، أوافق', confirm_no: 'رفض',
    vid_sent: 'تم إرسال طلبك للمراجعة. ستصلك رسالة فور التفعيل.',

    // withdraw
    wd_title: 'طلب سحب',
    wd_choose: 'اختر طريقة السحب',
    wd_balance: 'رصيدك المتاح',
    wd_min: 'الحد الأدنى للسحب 300 UM',
    wd_insufficient: 'رصيدك أقل من الحد الأدنى (300 UM). ادعُ المزيد من الأصدقاء.',
    wd_account: 'رقم الحساب',
    wd_account_ph: 'أدخل رقم حسابك',
    wd_confirm: 'تأكيد السحب',
    wd_confirm_desc: 'سيتم سحب كامل رصيدك',
    wd_sent: 'تم إرسال طلب السحب بنجاح. ستتم معالجته قريباً.',
    wd_pending: 'لديك طلب سحب قيد المعالجة بالفعل',

    // notifications
    notif_enable: 'فعّل الإشعارات لتصلك تنبيهات التفعيل والأرباح',
    notif_btn: 'تفعيل الإشعارات',

    cancel: 'إلغاء', close: 'إغلاق', back: 'رجوع',
    support_chat_title: 'المساعد الذكي',
    support_chat_ph: 'اكتب سؤالك هنا...',
    support_human: 'لم تجد إجابتك؟ تواصل مع الدعم المباشر',
  },

  fr: {
    dir: 'ltr', langBtn: 'ع',
    brand_sub: 'Agence 1xBet officielle en Mauritanie',
    nav_home: 'Accueil', nav_account: 'Mon compte', nav_support: 'Support',

    hero_title: 'Bienvenue sur OussoCash',
    hero_desc: 'Agence 1xBet officielle en Mauritanie depuis 2022. Inscrivez-vous, activez votre compte et gagnez avec le parrainage.',
    btn_register: 'S\'inscrire',
    btn_how: 'Comment ça marche',
    btn_account: 'Accéder à mon compte',

    rewards_title: 'Gagnez plus avec le parrainage',
    rw_welcome: 'Bonus de bienvenue', rw_welcome_d: 'avec un code de parrainage valide',
    rw_ref: 'par parrainage', rw_ref_d: 'pour chaque ami activé',
    rw_pct: 'des gains de vos filleuls', rw_pct_d: 'à vie',

    steps_title: 'Commencez en 4 étapes',
    step1: 'Inscrivez-vous sur 1xBet', step1d: 'avec le code OUSSO',
    step2: 'Déposez 200 UM', step2d: 'premier dépôt',
    step3: 'Envoyez le Game ID', step3d: 'pour vérification',
    step4: 'Recevez 100 UM', step4d: 'bonus et commencez à gagner',

    videos_title: 'Tutoriels vidéo',
    vid_register: 'Comment s\'inscrire',
    vid_agency: 'Comment vérifier l\'agence',

    agency_title: 'Agence certifiée et fiable',
    feat1: 'Retrait instantané', feat1d: 'via Bankily, Masrvi, Sedad sans frais',
    feat2: 'Certifiée depuis 2022', feat2d: 'licence officielle, milliers de clients',
    feat3: 'Support continu', feat3d: 'équipe disponible 24/7',
    feat4: 'Transparence totale', feat4d: 'vos gains toujours clairs',

    withdraw_title: 'Méthodes de retrait',

    support_title: 'Support officiel',
    support_desc: 'Notre équipe est prête à vous aider',
    btn_whatsapp: 'Contacter sur WhatsApp',
    btn_channel: 'Rejoindre notre chaîne',

    reg_title: 'Inscription OussoCash',
    reg_phone: 'Numéro WhatsApp',
    reg_phone_ph: 'Ex: 22XXXXXX',
    reg_phone_note: 'Ce numéro est le seul autorisé pour contacter le support et protéger vos données',
    reg_refcode: 'Code de parrainage (optionnel)',
    reg_refcode_ph: 'si disponible',
    reg_submit: 'S\'inscrire',
    reg_err_phone: 'Numéro WhatsApp invalide',
    reg_err_ref: 'Code de parrainage invalide',
    reg_link_title: 'Lien d\'inscription 1xBet',
    reg_link_desc: 'Inscrivez-vous avec le code OUSSO puis revenez vérifier',
    reg_link_btn: 'Ouvrir le lien',

    acc_balance: 'Solde', acc_refs: 'Parrainages activés', acc_earned: 'Gains',
    acc_gameid: 'Game ID', acc_status: 'Statut',
    status_verified: 'Activé', status_pending: 'En vérification', status_new: 'Non activé',
    acc_myref: 'Votre lien de parrainage',
    acc_copy: 'Copier', acc_copied: 'Copié',
    acc_share: 'Partager',
    acc_verify_btn: 'Vérifier votre compte',
    acc_withdraw_btn: 'Demander un retrait',
    acc_logout: 'Déconnexion',

    vid_title: 'Vérification Game ID',
    vid_enter: 'Entrez votre Game ID 1xBet',
    vid_check: 'Vérifier',
    vid_checking: 'Vérification...',
    vid_found: 'Compte trouvé',
    vid_notfound: 'Compte introuvable',
    vid_taken: 'Cet ID est utilisé par un autre compte',
    vid_banned: 'Cet ID est bloqué',
    vid_name: 'Nom', vid_currency: 'Devise',
    confirm_title: 'Confirmer la vérification',
    confirm_desc: 'Nous examinerons les données suivantes:',
    confirm_l1: 'Nom d\'utilisateur', confirm_l2: 'Devise du compte',
    confirm_l3: 'Code promo lié', confirm_l4: 'Date de création',
    confirm_l5: 'Total des dépôts',
    confirm_yes: 'Oui, j\'accepte', confirm_no: 'Refuser',
    vid_sent: 'Demande envoyée pour vérification. Vous serez notifié à l\'activation.',

    wd_title: 'Demande de retrait',
    wd_choose: 'Choisissez la méthode',
    wd_balance: 'Solde disponible',
    wd_min: 'Minimum de retrait 300 UM',
    wd_insufficient: 'Solde inférieur au minimum (300 UM). Invitez plus d\'amis.',
    wd_account: 'Numéro de compte',
    wd_account_ph: 'Entrez votre numéro',
    wd_confirm: 'Confirmer le retrait',
    wd_confirm_desc: 'Tout votre solde sera retiré',
    wd_sent: 'Demande envoyée avec succès. Traitement bientôt.',
    wd_pending: 'Vous avez déjà une demande en cours',

    notif_enable: 'Activez les notifications pour les alertes',
    notif_btn: 'Activer les notifications',

    cancel: 'Annuler', close: 'Fermer', back: 'Retour',
    support_chat_title: 'Assistant intelligent',
    support_chat_ph: 'Écrivez votre question...',
    support_human: 'Pas de réponse? Contactez le support direct',
  },
};
