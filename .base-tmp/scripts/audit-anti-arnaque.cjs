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
  // (15 nov., lot securite-ventes) Le faux « j'ai payé, vérifie ton mail », « hors de Vinted », et les QUATRE autres langues.
  ['J’ai payé, vérifie ton mail', 'fauxPaiement'],
  ['C’est payé ! Regarde tes e-mails, tu as reçu la confirmation de Vinted', 'fauxPaiement'],
  ['Paiement effectué. Consulte ta boîte mail stp', 'fauxPaiement'],
  ['Paie-moi hors de Vinted, c’est plus rapide', 'paiementHors'],
  ['On continue en dehors de Vinted ?', 'horsPlateforme'],
  ['I have already paid, check your email', 'fauxPaiement'],
  ['Ya te he pagado, revisa tu correo', 'fauxPaiement'],
  ['Ho già pagato, controlla la tua email', 'fauxPaiement'],
  ['Ich habe schon bezahlt, schau in dein Postfach', 'fauxPaiement'],
  ['Send me the code you got by SMS please', 'codeSms'],
  ['Pásame el código de verificación', 'codeSms'],
  ['Mandami il codice che hai ricevuto via SMS', 'codeSms'],
  ['Schick mir den Code per SMS', 'codeSms'],
  ['Your payment is on hold, click the link to confirm', 'fauxBlocage'],
  ['Il pagamento è bloccato, clicca qui per confermare', 'fauxBlocage'],
  ['Ship it first and I will pay after', 'envoieDabord'],
  ['Te pago cuando lo reciba', 'envoieDabord'],
  ['Ti pago alla consegna', 'envoieDabord'],
  ['Ich zahle bei Erhalt', 'envoieDabord'],
  ['Can I pay by bank transfer?', 'paiementHors'],
  ['Te pago por Bizum', 'paiementHors'],
  ['Ti faccio un bonifico', 'paiementHors'],
  ['PayPal Freunde und Familie?', 'paiementHors'],
  ['My courier will pick it up tomorrow', 'transporteurPerso'],
  ['Il mio corriere passerà a ritirarlo', 'transporteurPerso'],
  ['Text me on +44 7700 900123', 'horsPlateforme'],
  ['Escríbeme al 612 34 56 78, mi número', 'horsPlateforme'],
  ['Scrivimi su WhatsApp', 'horsPlateforme'],
  ['Meine Handynummer ist 0151 2345678', 'horsPlateforme'],
  ['Confirm here: https://vinted-pay-secure.com/de', 'lienImite'],
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
  // (15 nov.) Les messages NORMAUX demandés par Julien, et leurs pareils dans les quatre autres langues.
  'toujours dispo ?',
  'tu fais 50 € ?',
  'J’ai payé, merci !',
  'J’ai payé sur Vinted, tu as dû recevoir la notification',
  'Tu recevras un mail de Vinted quand j’aurai payé',
  'Is it still available?', 'Would you take 50?', 'I paid via Vinted, thanks', 'Payment made on Vinted, thanks', 'Can you send it today?', 'Tracking number 6A12345678901', 'My order number is 12345',
  '¿Sigue disponible?', '¿Me lo dejas en 50 €?', 'He pagado por Vinted', 'Envíamelo cuando puedas', 'Mi número de seguimiento es 6A12345678901',
  'Ancora disponibile? Fai 50?', 'Ho pagato su Vinted', 'Puoi spedire con Mondial Relay?', 'Il mio numero di ordine è 55',
  'Noch verfügbar? Würdest du 50 € nehmen?', 'Ich habe über Vinted bezahlt', 'Kannst du es heute verschicken?', 'Meine Sendungsnummer ist 6A12345678901',
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
  for (const m of F.MOTIFS_ARNAQUE) { cles.add(m.raison); cles.add(m.geste); cles.add(m.phrase); }
  for (const c of ['antiArnaque.titre', 'antiArnaque.signaler', 'antiArnaque.autres', 'antiArnaque.compteur', 'antiArnaque.ligne', 'antiArnaque.rienFait', 'antiArnaque.separateur', 'antiArnaque.attention', 'antiArnaque.laPlateforme', 'antiArnaque.ouvrirSur']) cles.add(c);
  // (15 nov.) UNE phrase par motif : le risque ET le geste, le site nommé ({site}) quand elle parle de la plateforme.
  const sansSite = F.MOTIFS_ARNAQUE.filter((m) => !m.phrase || (!/\{site\}/.test(langues.fr[m.phrase] || '') && !['codeSms', 'lienRaccourci'].includes(m.id)));
  dit(!sansSite.length, 'T · chaque motif a SA phrase (risque + geste), le site nommé', sansSite.map((m) => m.id).join(','));
  const deuxPhrases = F.MOTIFS_ARNAQUE.filter((m) => ((langues.fr[m.phrase] || '').match(/[.!?](\s|$)/g) || []).length > 2);
  dit(!deuxPhrases.length, 'T · la bannière tient en une phrase courte (au plus deux propositions)', deuxPhrases.map((m) => m.id).join(','));
  const manquent = [];
  for (const c of cles) for (const l of Object.keys(langues)) if (langues[l][c] == null) manquent.push(l + ':' + c);
  dit(!manquent.length, 'T · raisons, gestes et libellés présents en fr, en, es, it, de', manquent.join(' '));

  // B — branchement dans les écrans, et aucune action dans la bannière
  const lire = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const app = require('./_source-app.cjs').sourceAppDe(path.join(__dirname, '..', 'src', 'App.jsx'));
  const ban = lire('src/AlerteArnaque.jsx').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  dit(!/vmrCmd|fetch\(|save\(|signalerVc|withOwner|lireBaseRelue/.test(ban), 'B · la bannière n’agit jamais (aucune commande, aucune écriture, aucune lecture)');
  // (15 nov.) Sobre : jamais de rouge (le rouge = doublon de N°, §7) — ni dans le composant ni dans sa feuille.
  const css = lire('src/design/arnaque.css').replace(/\/\*[\s\S]*?\*\//g, '');
  dit(!/doublon|#D70015|#FF3B30|#FF453A|\bred\b|--vrm-danger|--vrm-red/i.test(ban + css), 'B · la bannière n’est jamais rouge (ambre seulement)');
  dit(/tr\(a\.phrase/.test(ban) && /data-arnaque-phrase/.test(ban), 'B · la bannière dit UNE phrase (la clé `phrase` du motif)');
  dit(/<AlerteArnaque\b/.test(app) && /<CompteurArnaque\b/.test(app) && /<PastilleArnaque\b/.test(app), 'B · Messages Vinted : bannière sur la conversation + compteur');
  dit(/<AlerteArnaque\b/.test(lire('src/ecrans/MessagesLeboncoin.jsx')), 'B · Leboncoin : bannière');
  dit(/<AlerteArnaque\b/.test(lire('src/ecrans/Vestiaire.jsx')), 'B · Vestiaire : bannière');
  dit(/<AlerteArnaque\b/.test(lire('src/ebayGestion.jsx')), 'B · eBay : bannière');
  dit(/<AlerteArnaque\b/.test(lire('src/ecrans/FilsTous.jsx')) && /data-arnaque-compteur/.test(lire('src/ecrans/FilsTous.jsx') + ban), 'B · Tous : bannière + compteur');
  // (16 nov., lot extension-restes) « Tous » : une ligne Vinted compte quand le dernier message du FIL capté est
  // PROUVÉ de l'autre (`dernier`, la règle de la liste Vinted) — jamais l'aperçu de la boîte (auteur pas su).
  {
    const FU = await import(path.join(__dirname, '..', 'src', 'filUnique.js'));
    const A = await import(path.join(__dirname, '..', 'src', 'antiArnaque.js'));
    const c = { id: 9, updated_at: '2026-11-16T10:00:00Z', description: 'Ajoute-moi sur WhatsApp', opposite_user: { id: 5, login: 'x' }, _acc: { vinted_user_id: '111' } };
    const boite = FU.convVinted(c, null);
    const eux = FU.convVinted(c, null, undefined, { texte: 'Ajoute-moi sur WhatsApp au 06 12 34 56 78', deMoi: false });
    const moi = FU.convVinted(c, null, undefined, { texte: 'Ajoute-moi sur WhatsApp au 06 12 34 56 78', deMoi: true });
    const flou = FU.convVinted(c, null, undefined, { texte: 'Ajoute-moi sur WhatsApp', deMoi: null });
    dit(!A.motifDeLApercu(boite.apercu, boite.deMoi) && !!A.motifDeLApercu(eux.apercu, eux.deMoi) && !A.motifDeLApercu(moi.apercu, moi.deMoi) && !A.motifDeLApercu(flou.apercu, flou.deMoi),
      'B · Tous : la ligne Vinted compte sur le dernier message PROUVÉ de l’autre (fil capté) ; ses messages, l’aperçu de la boîte et l’auteur pas su ne comptent jamais',
      JSON.stringify([boite.deMoi, eux.deMoi, moi.deMoi, flou.deMoi]));
    const appNu = app.replace(/\/\*[\s\S]*?\*\//g, '');
    dit(/<FilsTous[\s\S]{0,1500}extraitConversation\(c, paire&&paire\.r, paire&&paire\.titre, normTitle\)[\s\S]{0,200}ex\.source==='fil' && !ex\.vinted && \(ex\.de==='eux'\|\|ex\.de==='toi'\)[\s\S]{0,120}dernier \}/.test(appNu)
      && /convVinted\(x\.c, x\.paire, undefined, x\.dernier\)/.test(lire('src/ecrans/FilsTous.jsx')),
      'B · Tous : l’app passe à convVinted le dernier message du fil capté (même règle que la liste Vinted)');
  }

  // --prouve : mutation par motif
  if (process.argv.includes('--prouve')) {
    const code = fs.readFileSync(src, 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arnaque-'));
    for (const m of F.MOTIFS_ARNAQUE) {
      const re = new RegExp("(id: '" + m.id + "',[^\\n]*\\n\\s*test: )");
      if (!re.test(code)) { dit(false, `--prouve · ${m.id} : point de mutation introuvable`); continue; }
      const mute = code.replace(re, (t) => t.replace(/test: $/, 'test: () => false, _avant: '));
      const f = path.join(dir, m.id + '.mjs'); fs.writeFileSync(f, mute);
      const G = await import(f);
      const r = await verifier(G, { silence: true });
      const rouges = r.P.filter((p) => p.attendu === m.id && !p.ok).length;
      dit(rouges > 0, `--prouve · ${m.id} désactivé ⇒ ${rouges} vrai(s) positif(s) rouge(s)`);
    }
    // (15 nov.) Mutation « français seulement » : les motifs des quatre autres langues retirés ⇒ leurs vrais positifs rougissent.
    const fr = code.replace('const ENVOIE_DABORD_AILLEURS = UNE(', 'const ENVOIE_DABORD_AILLEURS = () => false; const _e = UNE(')
      .replace('const TRANSPORTEUR_AILLEURS = UNE(', 'const TRANSPORTEUR_AILLEURS = () => false; const _t = UNE(');
    if (fr === code) dit(false, '--prouve · français seulement : point de mutation introuvable');
    else {
      const f3 = path.join(dir, 'francais.mjs'); fs.writeFileSync(f3, fr);
      const r3 = await verifier(await import(f3), { silence: true });
      const rouges3 = r3.P.filter((p) => !p.ok && /^(Ship|Te pago|Ti pago|Ich zahle|My courier|Il mio corriere)/.test(p.t)).length;
      dit(rouges3 >= 6, `--prouve · motifs étrangers retirés ⇒ ${rouges3} vrai(s) positif(s) en en/es/it/de rouge(s)`);
    }
    // Mutation « qui a écrit » : lire aussi SES messages ⇒ M doit rougir.
    const mute2 = code.replace("if (!m || m.deMoi !== false) continue;", 'if (!m) continue;');
    const f2 = path.join(dir, 'auteur.mjs'); fs.writeFileSync(f2, mute2);
    const H = await import(f2);
    dit(H.alerteArnaque([{ t: 'Ajoute-moi sur WhatsApp', deMoi: true }]) !== null, '--prouve · lire SES messages ⇒ le contrôle M rougirait');
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}   // (15 nov.) les copies mutées ne restent pas sur le disque
  }
  console.log(ko ? `\n${ko} contrôle(s) rouge(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
