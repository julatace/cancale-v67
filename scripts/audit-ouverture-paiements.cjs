// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « OUVRIR LES PAIEMENTS » : CHAQUE ✓ EST LU, JAMAIS DEVINÉ (12 nov.)
//        node scripts/audit-ouverture-paiements.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Le VRAI api/compte.js (mode abonnement) est exécuté dans un monde simulé
// (scripts/_monde-paiement.cjs : faux Stripe à état, fausse base) :
//   O1 tout posé (mode test) : chaque prérequis serveur ✓ sauf « mode réel » ;
//   O2 chaque prérequis retiré UN à la fois ⇒ SA ligne passe « manque », avec le
//      bon geste (mentions nommées, prix lu chez Stripe, événement manquant…) ;
//   O3 Stripe muet sur les webhooks ⇒ « pas su », jamais ✓ ;
//   O4 clé réelle ⇒ « mode réel » ✓ et « ouvert aux clients » ;
//   O5 un VENDEUR ne reçoit jamais la liste ;
//   O6 la règle de l'app (src/ouverturePaiements.js) : CGV relues, « pas su »
//      partout quand le serveur n'a pas répondu, aucun ✓ inventé ;
//   O7 l'écran : panneau propriétaire seul dans Réglages, sans écriture.
// Données inventées (le dépôt est public) ; les mentions de l'éditeur sont
// remplies de valeurs d'essai le temps du banc, jamais écrites sur disque.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
if (process.argv.includes('--prouve')) {
  const { prouver } = require('./_mutations-audit.cjs');
  prouver(__filename, path.join(__dirname, '..'), {
    'tout événement suffit': [['api/_lib/ouverture-paiements.js', "return EVENEMENTS_WEBHOOK.filter((e) => !ev.includes(e));", 'return [];']],
    'webhook désactivé accepté': [['api/_lib/ouverture-paiements.js', "const desactive = best.ep.status !== 'enabled';", 'const desactive = false;']],
    'pas su = ✓': [['src/ouverturePaiements.js', "const ETAT = (x) => (x === 'ok' || x === 'manque' ? x : 'pas-su');", "const ETAT = (x) => (x === 'manque' ? x : 'ok');"]],
    'contact jamais comparé': [['api/_lib/ouverture-paiements.js', "const contactOk = !!contact && typeof editeurEmail === 'string' && editeurEmail.trim().toLowerCase() === String(contact).trim().toLowerCase();", 'const contactOk = !!contact;']],
    'mode réel deviné': [['api/_lib/ouverture-paiements.js', "modeReel: { etat: !cle ? 'manque' : e(modeTest === false) },", "modeReel: { etat: e(!!cle) },"]],
    'liste au vendeur': [['api/compte.js', '  if (acc.proprietaire) {\n    const webhookLu', '  if (true) {\n    const webhookLu']],
    'CGV jamais relues': [['src/ouverturePaiements.js', "return CGV_ATTENDU.filter((c) => !c.motif.test(texte)).map((c) => c.dit);", 'return [];']],
  }, ['public']);
  return;
}
const { creerMonde, appeler, brancherEnv, remplirMentions } = require('./_monde-paiement.cjs');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.stack || e).split('\n').slice(0, 2).join(' ')); } };

(async () => {
  const M = creerMonde();
  brancherEnv(M);
  global.fetch = (u, o) => monde.fetch(u, o);
  let monde = M;
  let compte;
  try { compte = (await import('file://' + path.join(R, 'api', 'compte.js'))).default; }
  catch (e) { dit(false, 'api/compte.js se charge', e.message); return fin(); }
  const restaurer = await remplirMentions(R);
  const P = M.ajouterUtilisateur(9, 'proprio@exemple.test');            // uuid(9) = le propriétaire
  const V = M.ajouterUtilisateur(1, 'vendeuse@exemple.test');
  const lire = async (qui = P, env = {}) => {
    const sauve = {}; for (const [k, v] of Object.entries(env)) { sauve[k] = process.env[k]; if (v === null) delete process.env[k]; else process.env[k] = v; }
    try { const r = await appeler(compte, { mode: 'abonnement', headers: { authorization: 'Bearer ' + qui.jeton } }); return r; }
    finally { for (const [k, v] of Object.entries(sauve)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
  };
  const etapes = (r) => (r && r.corps && r.corps.ouverture && r.corps.ouverture.etapes) || null;

  console.log('── O1 · tout posé, mode test');
  await essaie('O1', async () => {
    const r = await lire(); const e = etapes(r);
    const serveur = ['mentions', 'contact', 'cle', 'prixSolo', 'prixPro', 'secret', 'webhook'];
    dit(r.code === 200 && e && serveur.every((k) => e[k].etat === 'ok'), 'chaque prérequis serveur est ✓ quand tout est posé', e ? serveur.map((k) => `${k}:${e[k].etat}`).join(' ') : `HTTP ${r.code}`);
    dit(e && e.modeReel.etat === 'manque' && e.cle.mode === 'test', '  clé de test ⇒ « mode réel » reste à faire', e && `${e.modeReel.etat} · ${e.cle.mode}`);
    dit(r.corps.ouverture.ouvertTest === true && r.corps.ouverture.ouvertClients === false, '  « prêt en mode test », pas « ouvert aux clients »', JSON.stringify({ t: r.corps.ouverture.ouvertTest, c: r.corps.ouverture.ouvertClients }));
  });

  console.log('\n── O2 · un prérequis retiré à la fois');
  await essaie('sans clé', async () => {
    const e = etapes(await lire(P, { STRIPE_SECRET_KEY: null }));
    dit(e && e.cle.etat === 'manque' && e.prixSolo.etat === 'manque' && e.webhook.etat === 'manque' && e.modeReel.etat === 'manque', 'sans STRIPE_SECRET_KEY : clé, prix, webhook et mode réel « à faire » (rien n’est lu chez Stripe)', e && JSON.stringify({ c: e.cle.etat, s: e.prixSolo.etat, w: e.webhook.etat }));
  });
  await essaie('clé mal formée', async () => {
    const e = etapes(await lire(P, { STRIPE_SECRET_KEY: 'pk_test_publique' }));
    dit(e && e.cle.etat === 'manque', 'une clé PUBLIQUE (pk_…) collée à la place : « à faire »', e && e.cle.etat);
  });
  await essaie('sans secret', async () => {
    const e = etapes(await lire(P, { STRIPE_WEBHOOK_SECRET: null }));
    dit(e && e.secret.etat === 'manque' && e.webhook.etat === 'ok', 'sans STRIPE_WEBHOOK_SECRET : seule sa ligne est à faire', e && `${e.secret.etat} · ${e.webhook.etat}`);
    const e2 = etapes(await lire(P, { STRIPE_WEBHOOK_SECRET: 'sk_test_colle_au_mauvais_endroit' }));
    dit(e2 && e2.secret.etat === 'manque', '  une clé sk_… collée dans le secret du webhook : « à faire »', e2 && e2.secret.etat);
  });
  const webhooksAvant = JSON.parse(JSON.stringify(M.stripe.webhooks));
  await essaie('webhook absent', async () => {
    M.stripe.webhooks = [{ id: 'we_autre', url: 'https://autre.exemple/hook', status: 'enabled', enabled_events: ['*'] }];
    const e = etapes(await lire());
    dit(e && e.webhook.etat === 'manque' && e.webhook.absent === true, 'aucun webhook vers vrm.center (un autre site ne compte pas) : « ajoute le point »', e && JSON.stringify(e.webhook));
  });
  await essaie('événement manquant', async () => {
    M.stripe.webhooks = [{ ...webhooksAvant[0], enabled_events: webhooksAvant[0].enabled_events.filter((x) => x !== 'invoice.paid') }];
    const e = etapes(await lire());
    dit(e && e.webhook.etat === 'manque' && JSON.stringify(e.webhook.manquants) === '["invoice.paid"]', 'webhook sans invoice.paid (le parrainage ne serait jamais crédité) : l’événement est NOMMÉ', e && JSON.stringify(e.webhook.manquants));
  });
  await essaie('webhook désactivé', async () => {
    M.stripe.webhooks = [{ ...webhooksAvant[0], status: 'disabled' }];
    const e = etapes(await lire());
    dit(e && e.webhook.etat === 'manque' && e.webhook.desactive === true, 'webhook désactivé chez Stripe : « réactive-le »', e && JSON.stringify(e.webhook));
  });
  await essaie('webhook par l’autre adresse', async () => {
    M.stripe.webhooks = [{ ...webhooksAvant[0], url: 'https://vrm.center/api/compte?mode=webhook', enabled_events: ['*'] }];
    const e = etapes(await lire());
    dit(e && e.webhook.etat === 'ok', 'l’adresse directe de la route et « tous les événements » : ✓', e && e.webhook.etat);
  });
  await essaie('webhooks illisibles', async () => {
    M.stripe.webhooks = webhooksAvant; M.stripe.panneWebhooks = true;
    const r = await lire(); const e = etapes(r);
    dit(e && e.webhook.etat === 'pas-su' && r.corps.ouverture.ouvertTest === false, 'O3 · Stripe muet : « pas su », jamais ✓, et pas « prêt »', e && e.webhook.etat);
    M.stripe.panneWebhooks = false;
  });
  const prixAvant = JSON.parse(JSON.stringify(M.stripe.prix));
  await essaie('prix Solo différent', async () => {
    M.stripe.prix[0] = { ...prixAvant[0], unit_amount: 1299 };
    const e = etapes(await lire());
    dit(e && e.prixSolo.etat === 'manque' && e.prixSolo.texteStripe === '12,99 € / mois', 'prix Solo à 12,99 € chez Stripe : « à faire », avec le prix LU chez Stripe', e && JSON.stringify(e.prixSolo));
  });
  await essaie('prix Solo absent', async () => {
    M.stripe.prix = [prixAvant[1]];
    const e = etapes(await lire());
    dit(e && e.prixSolo.etat !== 'ok', 'aucun prix vrm_mensuel : pas ✓', e && e.prixSolo.etat);
    M.stripe.prix = JSON.parse(JSON.stringify(prixAvant));
  });
  await essaie('prix Pro', async () => {
    const e = etapes(await lire(P, { STRIPE_PRIX_PRO: null }));
    dit(e && e.prixPro.etat === 'manque' && e.prixPro.raison === 'sans-prix-stripe', 'STRIPE_PRIX_PRO vide : Pro « à faire »', e && JSON.stringify(e.prixPro));
    M.stripe.prix[1] = { ...prixAvant[1], unit_amount: 2499 };
    const e2 = etapes(await lire());
    dit(e2 && e2.prixPro.etat === 'manque' && e2.prixPro.raison === 'prix-different' && /24,99/.test(e2.prixPro.texteStripe || ''), '  Pro à 24,99 € chez Stripe : « à faire », prix lu', e2 && JSON.stringify(e2.prixPro));
    M.stripe.prix = JSON.parse(JSON.stringify(prixAvant));
  });
  await essaie('mentions', async () => {
    restaurer();
    const vides = Object.entries(globalThis.VRM_EDITEUR || {}).filter(([, v]) => !v).length;
    const e = etapes(await lire());
    dit(e && (vides ? e.mentions.etat === 'manque' && e.mentions.manquants.length === vides : e.mentions.etat === 'ok'), `les VRAIES mentions du dépôt : ${vides} champ(s) vide(s) nommé(s)`, e && JSON.stringify(e.mentions));
    await remplirMentions(R);
  });
  await essaie('contact différent', async () => {
    const E = globalThis.VRM_EDITEUR; const avant = E.email; E.email = 'autre@exemple.test';
    const e = etapes(await lire());
    dit(e && e.contact.etat === 'manque' && e.contact.differents === true, 'une adresse dans editeur.js, une autre dans contact.js : « mets la même »', e && JSON.stringify(e.contact));
    E.email = avant;
  });

  console.log('\n── O4 · mode réel');
  await essaie('O4', async () => {
    const r = await lire(P, { STRIPE_SECRET_KEY: 'sk_live_monde' }); const e = etapes(r);
    dit(e && e.modeReel.etat === 'ok' && e.cle.mode === 'reel' && r.corps.ouverture.ouvertClients === true, 'clé sk_live_ : « mode réel » ✓ et paiements ouverts aux clients', e && `${e.modeReel.etat} · ${r.corps.ouverture.ouvertClients}`);
  });

  console.log('\n── O5 · un vendeur ne voit rien');
  await essaie('O5', async () => {
    const r = await lire(V);
    dit(r.code === 200 && !('ouverture' in r.corps && r.corps.ouverture), 'la route rend l’abonnement au vendeur SANS la liste du propriétaire', JSON.stringify(Object.keys(r.corps || {}).filter((k) => /ouvert/.test(k))));
  });

  console.log('\n── O6 · la règle de l’app');
  await essaie('O6', async () => {
    const regle = await import('file://' + path.join(R, 'src', 'ouverturePaiements.js'));
    const serveur = (await lire()).corps.ouverture;
    const cgv = fs.readFileSync(path.join(R, 'public', 'legal', 'cgv.html'), 'utf8');
    const a = regle.etapesPaiement({ serveur, cgv, proAccueil: false });
    dit(a.liste.find((x) => x.cle === 'cgv').etat === 'ok' && a.ouvertTest === true, 'CGV du dépôt relues : Solo, Pro, parrainage, rétractation, essai — ✓', a.liste.find((x) => x.cle === 'cgv').geste);
    const b = regle.etapesPaiement({ serveur, cgv: cgv.replace(/19,99/g, '17,99'), proAccueil: false });
    dit(b.liste.find((x) => x.cle === 'cgv').etat === 'manque' && /Pro/.test(b.liste.find((x) => x.cle === 'cgv').geste) && b.ouvertTest === false, '  CGV sans le prix Pro : « à faire » et pas « prêt »', b.liste.find((x) => x.cle === 'cgv').geste);
    const c = regle.etapesPaiement({ serveur: null, cgv: null });
    dit(c.pasSu && c.liste.filter((x) => x.cle !== 'proAccueil').every((x) => x.etat === 'pas-su') && c.ok === 0, '  le serveur n’a pas répondu : « — » partout, aucun ✓', c.liste.map((x) => x.etat).join(','));
    dit(regle.etapesPaiement({ serveur: undefined }) === undefined, '  en cours : rien d’affiché comme su');
    const sMuet = { ...serveur, ouvertTest: false, etapes: { ...serveur.etapes, webhook: { ...serveur.etapes.webhook, etat: 'pas-su' }, prixSolo: { ...serveur.etapes.prixSolo, etat: 'inconnu' } } };
    const m = regle.etapesPaiement({ serveur: sMuet, cgv, proAccueil: false });
    dit(m.liste.find((x) => x.cle === 'webhook').etat === 'pas-su' && m.liste.find((x) => x.cle === 'prixSolo').etat === 'pas-su' && !m.ouvertTest, '  une ligne « pas su » (ou un état inconnu) du serveur reste « — », jamais ✓', m.liste.map((x) => x.cle + ':' + x.etat).join(' '));
    const d = regle.etapesPaiement({ serveur, cgv, proAccueil: true });
    dit(d.liste.find((x) => x.cle === 'proAccueil').etat === 'ok', '  l’accueil dit Pro ouvert : ✓');
    const mots = a.liste.map((x) => x.geste.split(/\s+/).length);
    dit(mots.every((n) => n <= 14), '  chaque geste tient en une phrase courte', mots.join(','));
  });

  console.log('\n── O7 · l’écran');
  await essaie('O7', async () => {
    const { sansCommentaires } = require('./_mutations-audit.cjs');
    const reg = sansCommentaires(fs.readFileSync(path.join(R, 'src', 'ecrans', 'Reglages.jsx'), 'utf8'));
    dit(/proprioInst && \{ id:'paiements'[^\n]*<OuvrirPaiements/.test(reg), 'Réglages : l’entrée « Ouvrir les paiements » n’existe que pour le propriétaire');
    const comp = sansCommentaires(fs.readFileSync(path.join(R, 'src', 'composants', 'OuvrirPaiements.jsx'), 'utf8'));
    dit(!/method:\s*'(POST|PATCH|DELETE)'/.test(comp) && /mode=abonnement/.test(comp) && /legal\/cgv\.html/.test(comp), '  le panneau ne fait que LIRE (abonnement + CGV), aucune écriture');
  });
  fin();
  function fin() {
    console.log(ko ? `\n❌ audit-ouverture-paiements : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-ouverture-paiements : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
