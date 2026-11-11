// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « alerte arnaque dans les messages » (11 nov., lot anti-arnaque)
//
//  La règle pure `src/antiArnaque.js` (sans IA, §2.9) :
//   P   chaque message d'escroquerie typique déclenche LE BON motif ;
//   N   les messages normaux ne déclenchent RIEN (« je paie via Vinted », n° de
//       suivi, adresse de point relais, lien vinted.fr, code de retrait…) ;
//   M   ses PROPRES messages (deMoi true) et ceux dont l'auteur n'est pas su
//       (null/undefined) ne sont JAMAIS lus ; la priorité choisit la raison ;
//   T   chaque raison et chaque geste ont leur texte dans les 5 langues ;
//   B   les écrans branchent la bannière (Vinted, Leboncoin, Vestiaire, eBay,
//       Tous) et le compteur, sans aucune action (aucun vmrCmd/fetch dans la
//       bannière).
//  `--prouve` : mutation — chaque motif est désactivé tour à tour dans une copie
//  de la règle : ses vrais positifs doivent rougir.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const os = require('os');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

// Les VRAIS POSITIFS : [texte, motif attendu en tête].
const POSITIFS = [
  ['Pour finaliser donne-moi le code que tu viens de recevoir par SMS', 'codeSms'],
  ['Tu vas recevoir un sms avec un code, envoie-le moi stp', 'codeSms'],
  ['Envoie moi le code de vérification', 'codeSms'],
  ['Votre paiement est bloqué, il faut payer des frais de déblocage de 25 €', 'fauxBlocage'],
  ['L’argent est bloqué chez Vinted, clique sur le lien pour valider', 'fauxBlocage'],
  ['Pour débloquer le paiement remplis le formulaire', 'fauxBlocage'],
  ['Confirme la vente ici : https://vinted-securite.com/confirm', 'lienImite'],
  ['Va sur www.vlnted-paiement.fr pour recevoir ton argent', 'lienImite'],
  ['https://paypa1.com/login pour recevoir le paiement', 'lienImite'],
  ['Le suivi est sur mondial-relay-livraison.net/colis', 'lienImite'],
  ['Remplis le formulaire vinted-securite pour la livraison', 'lienImite'],
  ['Mets tes infos ici bit.ly/3xYz12 merci', 'lienRaccourci'],
  ['https://tinyurl.com/abc123 pour la livraison', 'lienRaccourci'],
  ['Je te paie par PayPal entre proches, c’est plus simple', 'paiementHors'],
  ['Paypal amis et famille ça te va ?', 'paiementHors'],
  ['Je peux te faire un virement direct', 'paiementHors'],
  ['Envoie-moi ton RIB', 'paiementHors'],
  ['Je paye par Lydia si tu veux', 'paiementHors'],
  ['Je t’envoie un mandat cash', 'paiementHors'],
  ['paypal.me/jeanmarc75', 'paiementHors'],
  ['Envoie d’abord le colis et je te paie après', 'envoieDabord'],
  ['Je te paierai à la réception du colis', 'envoieDabord'],
  ['Paiement à la livraison possible ?', 'envoieDabord'],
  ['Mon transporteur passera récupérer le colis chez toi', 'transporteurPerso'],
  ['Un coursier va venir chercher la paire demain', 'transporteurPerso'],
  ['Livraison par mon transporteur, je m’occupe de tout', 'transporteurPerso'],
  ['Ajoute-moi sur WhatsApp on parlera mieux', 'horsPlateforme'],
  ['Écris-moi sur w h a t s a p p', 'horsPlateforme'],
  ['On continue sur Telegram ?', 'horsPlateforme'],
  ['Contacte moi par mail stp', 'horsPlateforme'],
  ['mon mail : acheteur.paire@exemple.com', 'horsPlateforme'],
  ['Appelle-moi au 06 12 34 56 78', 'horsPlateforme'],
  ['Mon numéro +33 7 12 34 56 78', 'horsPlateforme'],
  ['wa.me/33612345678', 'horsPlateforme'],
];
// Les messages NORMAUX : rien ne doit se déclencher.
const NEGATIFS = [
  'Bonjour, toujours disponible ?',
  'Je paie via Vinted tout de suite',
  'Je l’ai payé avec PayPal sur Vinted',
  'Mon numéro de suivi : 6A12345678901',
  'Le numéro de suivi est 0712345678901',
  'Voici mon point relais : Tabac du Centre, 12 rue de la Paix, 75002 Paris',
  'Point relais Mondial Relay 012345, 8 avenue Jean Jaurès 69007 Lyon',
  'J’ai reçu le code de retrait, je passe demain',
  'Le code de retrait est dans le suivi du colis',
  'Pouvez-vous envoyer en Mondial Relay ?',
  'Je vous envoie le paiement avec le bouton Acheter',
  'Voici le lien de l’annonce https://www.vinted.fr/items/123456-nike',
  'Suivi ici https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=123',
  'https://www.leboncoin.fr/ad/chaussures/2456789',
  'Le virement Vinted met 3 jours à arriver',
  'Je paie dès que possible',
  'Vous faites 45 € ? Envoi rapide svp',
  'Taille 42 ? Elles taillent grand ?',
  'Je peux venir la chercher en main propre samedi',
  'Merci, bien reçu ! Je laisse une évaluation',
  'Prix 12.50 € en plus pour le port',
  'Je signale juste que la boîte est abîmée',
  'J’ai envoyé le colis hier soir',
  'C’est pour mon frère, il fait du 43',
  'Le livreur est passé, colis reçu merci',
  'Elle est en très bon état ?',
  'Code promo VINTED10 ça marche ?',
  'Ok je valide l’achat sur Vinted',
];

async function verifier(F, { silence = false } = {}) {
  const res = { P: [], N: [] };
  for (const [t, attendu] of POSITIFS) {
    const ids = F.motifsDuTexte(t);
    const ok = ids[0] === attendu;
    res.P.push({ t, attendu, ids, ok });
  }
  for (const t of NEGATIFS) { const ids = F.motifsDuTexte(t); res.N.push({ t, ids, ok: !ids.length }); }
  if (!silence) {
    for (const p of res.P) dit(p.ok, `P · « ${p.t.slice(0, 60)} » ⇒ ${p.attendu}`, p.ok ? '' : 'rendu : ' + (p.ids.join(',') || 'rien'));
    for (const n of res.N) dit(n.ok, `N · « ${n.t.slice(0, 60)} » ⇒ rien`, n.ok ? '' : 'rendu : ' + n.ids.join(','));
  }
  return res;
}

(async () => {
  const src = path.join(__dirname, '..', 'src', 'antiArnaque.js');
  const F = await import(src);
  await verifier(F);
  dit(new Set(POSITIFS.map((p) => p[1])).size === F.MOTIFS_ARNAQUE.length, 'P · chaque motif a ses vrais positifs', F.MOTIFS_ARNAQUE.map((m) => m.id).join(','));

  // M — qui a écrit
  const arnaque = 'Ajoute-moi sur WhatsApp et envoie le code reçu par SMS';
  dit(F.alerteArnaque([{ t: arnaque, deMoi: true }]) === null, 'M · SES propres messages ne sont jamais lus');
  dit(F.alerteArnaque([{ t: arnaque, deMoi: null }]) === null && F.alerteArnaque([{ t: arnaque }]) === null, 'M · auteur pas su ⇒ pas lu (pas su ≠ oui)');
  const a = F.alerteArnaque([{ t: 'Bonjour', deMoi: false }, { t: arnaque, deMoi: false }, { t: 'Mon WhatsApp : 06 12 34 56 78', deMoi: true }]);
  dit(a && a.motif === 'codeSms' && a.motifs.includes('horsPlateforme') && a.n === 1, 'M · la raison la plus grave en tête, les autres gardées, n = messages reçus concernés', JSON.stringify(a));
  dit(F.alerteArnaque([]) === null && F.alerteArnaque(null) === null && F.alerteArnaque([{ t: 'Toujours dispo ?', deMoi: false }]) === null, 'M · rien vu ⇒ null');
  dit(F.motifDeLApercu('Écris-moi sur WhatsApp', false) === 'horsPlateforme' && F.motifDeLApercu('Écris-moi sur WhatsApp', true) === null && F.motifDeLApercu('Écris-moi sur WhatsApp', null) === null, 'M · aperçu de la liste : seulement PROUVÉ de l’autre');

  // T — textes dans les 5 langues
  const langues = {};
  for (const l of ['fr', 'en', 'es', 'it', 'de']) langues[l] = (await import(path.join(__dirname, '..', 'src', 'i18n', 'langues', l + '.js'))).default;
  const cles = new Set();
  for (const m of F.MOTIFS_ARNAQUE) { cles.add(m.raison); cles.add(m.geste); }
  for (const c of ['antiArnaque.titre', 'antiArnaque.signaler', 'antiArnaque.autres', 'antiArnaque.compteur', 'antiArnaque.ligne', 'antiArnaque.rienFait']) cles.add(c);
  const manquent = [];
  for (const c of cles) for (const l of Object.keys(langues)) if (langues[l][c] == null) manquent.push(l + ':' + c);
  dit(!manquent.length, 'T · raisons, gestes et libellés présents en fr, en, es, it, de', manquent.join(' '));

  // B — branchement dans les écrans, et aucune action dans la bannière
  const lire = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const app = require('./_source-app.cjs').sourceAppDe(path.join(__dirname, '..', 'src', 'App.jsx'));
  const ban = lire('src/AlerteArnaque.jsx').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  dit(!/vmrCmd|fetch\(|save\(|signalerVc|withOwner|lireBaseRelue/.test(ban), 'B · la bannière n’agit jamais (aucune commande, aucune écriture, aucune lecture)');
  dit(/<AlerteArnaque\b/.test(app) && /compteurArnaque|data-arnaque-compteur/.test(app), 'B · Messages Vinted : bannière sur la conversation + compteur');
  dit(/<AlerteArnaque\b/.test(lire('src/ecrans/MessagesLeboncoin.jsx')), 'B · Leboncoin : bannière');
  dit(/<AlerteArnaque\b/.test(lire('src/ecrans/Vestiaire.jsx')), 'B · Vestiaire : bannière');
  dit(/<AlerteArnaque\b/.test(lire('src/ebayGestion.jsx')), 'B · eBay : bannière');
  dit(/<AlerteArnaque\b/.test(lire('src/ecrans/FilsTous.jsx')) && /data-arnaque-compteur/.test(lire('src/ecrans/FilsTous.jsx') + ban), 'B · Tous : bannière + compteur');

  // --prouve : mutation par motif
  if (process.argv.includes('--prouve')) {
    const code = fs.readFileSync(src, 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arnaque-'));
    for (const m of F.MOTIFS_ARNAQUE) {
      const re = new RegExp("(id: '" + m.id + "',[^\\n]*\\n\\s*test: )");
      if (!re.test(code)) { dit(false, `--prouve · ${m.id} : point de mutation introuvable`); continue; }
      const mute = code.replace(re, '$1(() => false) || ');
      const f = path.join(dir, m.id + '.mjs'); fs.writeFileSync(f, mute);
      const G = await import(f);
      const r = await verifier(G, { silence: true });
      const rouges = r.P.filter((p) => p.attendu === m.id && !p.ok).length;
      dit(rouges > 0, `--prouve · ${m.id} désactivé ⇒ ${rouges} vrai(s) positif(s) rouge(s)`);
    }
    // Mutation « qui a écrit » : lire aussi SES messages ⇒ M doit rougir.
    const mute2 = code.replace("if (!m || m.deMoi !== false) continue;", 'if (!m) continue;');
    const f2 = path.join(dir, 'auteur.mjs'); fs.writeFileSync(f2, mute2);
    const H = await import(f2);
    dit(H.alerteArnaque([{ t: 'Ajoute-moi sur WhatsApp', deMoi: true }]) !== null, '--prouve · lire SES messages ⇒ le contrôle M rougirait');
  }
  console.log(ko ? `\n${ko} contrôle(s) rouge(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
