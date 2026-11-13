// ═══════════════════════════════════════════════════════════════════════════
// « OUVRIR LES PAIEMENTS » — LA LISTE ✓ / ✗ DU PROPRIÉTAIRE (12 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Pur. Entrées, toutes LUES :
//   · `serveur` : `ouverture` rendu par /api/compte?mode=abonnement au seul
//     propriétaire (api/_lib/ouverture-paiements.js : Vercel, Stripe, editeur.js,
//     contact.js) ; `undefined` en cours, `null` pas su ;
//   · `cgv` : le texte de /legal/cgv.html relu par l'app (null = pas su) ;
//   · `proAccueil` : PRO_OUVERT de src/accueil-reglages.js (la page d'accueil).
// Sortie : une étape par prérequis { cle, titre, etat, geste, ou, detail }.
// `etat` : 'ok' · 'manque' · 'pas-su' — « pas su » n'est JAMAIS un ✓.
// Le guide pas à pas : docs/passation/2026-11-12-guide-paiement-julien.md.
// ═══════════════════════════════════════════════════════════════════════════

// Les CGV relues : les deux prix et les articles que les offres exigent.
export const CGV_ATTENDU = [
  { cle: 'solo', motif: /16,99\s*€/, dit: 'le prix Solo (16,99 €)' },
  { cle: 'pro', motif: /19,99\s*€/, dit: 'le prix Pro (19,99 €)' },
  { cle: 'parrainage', motif: /parrain/i, dit: 'le parrainage' },
  { cle: 'retractation', motif: /r[ée]tractation/i, dit: 'la rétractation' },
  { cle: 'essai', motif: /essai gratuit/i, dit: 'l’essai gratuit' },
];
export function cgvManquants(texte) {
  if (typeof texte !== 'string' || texte.length < 200) return null;
  return CGV_ATTENDU.filter((c) => !c.motif.test(texte)).map((c) => c.dit);
}

const ETAT = (x) => (x === 'ok' || x === 'manque' ? x : 'pas-su');

// `proprio` : ces consignes d'administrateur (Stripe, Vercel) ne s'écrivent qu'au propriétaire de l'installation
// (l'écran est monté sous `proprioInst` dans Réglages ; audit-vendeur-neutre B).
export function etapesPaiement({ serveur, cgv = null, proAccueil = false, proprio = true } = {}) {
  if (serveur === undefined) return undefined;
  const s = serveur && serveur.etapes ? serveur.etapes : null;
  const e = (k) => (s && s[k] ? ETAT(s[k].etat) : 'pas-su');
  const cgvM = cgvManquants(cgv);
  const liste = [
    { cle: 'mentions', titre: 'Mentions légales', etat: e('mentions'),
      geste: s && s.mentions && s.mentions.manquants && s.mentions.manquants.length ? `À remplir : ${s.mentions.manquants.join(', ')}.` : 'Remplis les 10 champs de l’éditeur.',
      ou: 'Fichier public/legal/editeur.js (envoie les valeurs à Claude).' },
    { cle: 'contact', titre: 'Adresse de contact', etat: e('contact'),
      geste: s && s.contact && s.contact.differents ? 'Mets la même adresse aux deux endroits.' : 'Une adresse qui reçoit les e-mails des clients.',
      ou: 'src/contact.js et le champ email de public/legal/editeur.js.' },
    { cle: 'cgv', titre: 'Conditions de vente', etat: cgvM === null ? 'pas-su' : cgvM.length ? 'manque' : 'ok',
      geste: cgvM && cgvM.length ? `Il manque : ${cgvM.join(', ')}.` : 'Fais-les relire par un juriste avant le mode réel.',
      ou: 'vrm.center/legal/cgv.html et /legal/retractation.html.' },
    { cle: 'cle', titre: 'Clé secrète Stripe', etat: e('cle'),
      geste: 'Colle la clé sk_… dans Vercel, puis redéploie.',
      ou: proprio ? 'Stripe → Développeurs → Clés API ; Vercel → Settings → Environment Variables → STRIPE_SECRET_KEY.' : '',
      detail: s && s.cle && s.cle.mode ? (s.cle.mode === 'test' ? 'Clé de test' : 'Clé réelle') : null },
    { cle: 'prixSolo', titre: 'Prix Solo 16,99 € / mois', etat: e('prixSolo'),
      geste: s && s.prixSolo && s.prixSolo.texteStripe ? `Stripe dit ${s.prixSolo.texteStripe} : recrée le prix.` : 'Crée le prix mensuel, clé de recherche vrm_mensuel.',
      ou: `Stripe → Catalogue de produits → VRM Solo → clé « ${(s && s.prixSolo && s.prixSolo.cle) || 'vrm_mensuel'} ».` },
    { cle: 'prixPro', titre: 'Prix Pro 19,99 € / mois', etat: e('prixPro'),
      geste: s && s.prixPro && s.prixPro.raison === 'prix-different' ? `Stripe dit ${s.prixPro.texteStripe || 'un autre montant'} : recrée le prix.`
        : s && s.prixPro && s.prixPro.raison === 'prix-illisible' ? 'Le price_… posé est introuvable chez Stripe.'
        : 'Crée le prix, puis colle son price_… dans Vercel.',
      ou: 'Stripe → VRM Pro (clé vrm_pro_mensuel) ; Vercel → STRIPE_PRIX_PRO.' },
    { cle: 'secret', titre: 'Secret du webhook', etat: e('secret'),
      geste: 'Colle le secret whsec_… dans Vercel, puis redéploie.',
      ou: 'Stripe → Webhooks → ton point → Secret de signature ; Vercel → STRIPE_WEBHOOK_SECRET.' },
    { cle: 'webhook', titre: 'Webhook chez Stripe', etat: e('webhook'),
      geste: s && s.webhook && s.webhook.desactive ? 'Le webhook est désactivé : réactive-le.'
        : s && s.webhook && s.webhook.absent ? 'Ajoute le point vrm.center/api/stripe-webhook.'
        : s && s.webhook && Array.isArray(s.webhook.manquants) && s.webhook.manquants.length ? `Ajoute : ${s.webhook.manquants.join(', ')}.`
        : 'Adresse vrm.center/api/stripe-webhook, 5 événements.',
      ou: 'Stripe → Développeurs → Webhooks.' },
    { cle: 'proAccueil', titre: 'Offre Pro sur l’accueil', etat: proAccueil === true ? 'ok' : 'manque',
      geste: 'Prix Pro ✓ ? Dis à Claude : « ouvre Pro sur l’accueil ».',
      ou: 'src/accueil-reglages.js (PRO_OUVERT).' },
    { cle: 'modeReel', titre: 'Mode réel', etat: e('modeReel'),
      geste: 'Refais prix, webhook et clés en mode réel.',
      ou: 'Stripe : interrupteur « Mode test » en haut, puis Vercel.' },
  ];
  const ok = liste.filter((x) => x.etat === 'ok').length;
  return {
    liste, ok, total: liste.length,
    ouvertTest: !!(serveur && serveur.ouvertTest) && liste.find((x) => x.cle === 'cgv').etat === 'ok',
    ouvertClients: !!(serveur && serveur.ouvertClients) && liste.every((x) => x.etat === 'ok' || x.cle === 'proAccueil'),
    pasSu: serveur === null,
  };
}
