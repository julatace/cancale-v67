// ═══════════════════════════════════════════════════════════════════════════
// AUDIT — LES MOTS QUI FONT BANNIR UN COMPTE (12 nov., lot sécurité des comptes)
//        node scripts/audit-message-sur.cjs            (--prouve : mutations ⇒ rouge)
// ═══════════════════════════════════════════════════════════════════════════
// R. La règle (src/messageSur.js), EXÉCUTÉE sur 60 phrases inventées :
//    R1 chaque phrase risquée est relevée, avec la BONNE sorte (téléphone, e-mail,
//       lien, paiement, messagerie, hors plateforme, main propre, contrefaçon) ;
//    R2 chaque phrase sûre ne l'est pas (faux positifs évités : « téléphone portable
//       Samsung » dans un titre, une pointure, un prix, une date, un n° de suivi, un
//       lien vinted.fr, une négation « je ne fais pas de main propre ») ;
//    R3 Leboncoin : la main propre n'est pas un risque (le site la prévoit).
// A. L'app, EXÉCUTÉE :
//    A1 `problemesAnnonce` met « Réplica » EN TÊTE, ambre, jamais coupable ;
//    A2 `preparerMessageFavori` refuse un message aux favoris risqué (jamais envoyé) ;
//    A3 le serveur (`tourAuto`) s'arrête sur un message risqué AVANT de poser un message.
// S. Les chemins d'envoi (source, commentaires retirés) :
//    S1 `ComposeConv` (Vinted, Leboncoin, Vestiaire, eBay) passe par
//       `verifierMessageAvantEnvoi` avant `onEnvoyer`, au clic ET à Entrée, et chaque
//       site lui donne son nom ; S2 la réponse eBay (FilsTous) aussi ;
//    S3 la feuille dit « Envoyer quand même » ; S4 le message du refus automatique
//       n'est jamais rangé tel quel s'il est risqué (`ecrireRefusMsg`).
// Aucune donnée réelle : toutes les phrases sont inventées.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = process.env.RACINE || path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const lire = (f) => { try { return sansCommentaires(fs.readFileSync(path.join(R, f), 'utf8')); } catch (_) { return ''; } };

// [texte, site, famille, attendu] — attendu : liste des sortes relevées ([] = sûr).
const PHRASES = [
  // ── messages risqués (Vinted par défaut) ──
  ['Appelle-moi au 06 12 34 56 78 on s’arrange', 'vinted', 'message', ['telephone']],
  ['mon num 0612345678', 'vinted', 'message', ['telephone']],
  ['Contacte moi +33 6 12 34 56 78', 'vinted', 'message', ['telephone']],
  ['06.12.34.56.78 dispo le soir', 'vinted', 'message', ['telephone']],
  ['Envoie-moi un SMS stp', 'vinted', 'message', ['telephone']],
  ['Écris-moi à julie.martin@gmail.com', 'vinted', 'message', ['email']],
  ['mon adresse c’est jm arobase hotmail', 'vinted', 'message', ['email']],
  ['Regarde ici https://monsite-sneakers.com/promo', 'vinted', 'message', ['lien']],
  ['Plus de photos sur www.mesbaskets.fr', 'vinted', 'message', ['lien']],
  ['Tu peux payer par PayPal ?', 'vinted', 'message', ['paiement']],
  ['Je préfère un virement bancaire', 'vinted', 'message', ['paiement']],
  ['Envoie par Lydia c’est plus simple', 'vinted', 'message', ['paiement']],
  ['Je t’envoie mon RIB', 'vinted', 'message', ['paiement']],
  ['On continue sur WhatsApp ?', 'vinted', 'message', ['messagerie']],
  ['Ajoute-moi sur Snapchat', 'vinted', 'message', ['messagerie']],
  ['On peut faire la vente en dehors de Vinted', 'vinted', 'message', ['hors']],
  ['Paie-moi directement, on évite les frais', 'vinted', 'message', ['hors']],
  ['Hors plateforme je te la fais à 50', 'vinted', 'message', ['hors']],
  ['Je peux faire une remise en main propre à Lyon', 'vinted', 'message', ['mainpropre']],
  ['En mains propres sur Paris si tu veux', 'vestiaire', 'message', ['mainpropre']],
  ['Pas de souci, PayPal ami ça marche', 'vinted', 'message', ['paiement']],
  ['Paiement en espèces possible', 'vinted', 'message', ['paiement']],
  ['Écris-moi sur Insta ou au 07 11 22 33 44', 'ebay', 'message', ['telephone', 'messagerie']],
  ['Réponds sur Telegram, sans passer par Vestiaire', 'vestiaire', 'message', ['messagerie', 'hors']],
  ['Virement possible, mon whatsapp 0698765432', 'leboncoin', 'message', ['telephone', 'paiement', 'messagerie']],
  // ── messages sûrs ──
  ['Bonjour, la paire est toujours disponible !', 'vinted', 'message', []],
  ['Je vous propose 45 €, ça vous va ?', 'vinted', 'message', []],
  ['Taille 42, elles taillent normalement', 'vinted', 'message', []],
  ['Envoyé le 12/11/2026, numéro de suivi 6A12345678901', 'vinted', 'message', []],
  ['Colis Mondial Relay 12345678 déposé ce matin', 'vinted', 'message', []],
  ['Désolé, je ne fais pas de main propre', 'vinted', 'message', []],
  ['Je n’accepte pas PayPal, seulement via Vinted', 'vinted', 'message', []],
  ['Voici le lien : https://www.vinted.fr/items/123456789-nike', 'vinted', 'message', []],
  ['Remise en main propre possible à Nantes', 'leboncoin', 'message', []],
  ['Merci pour votre achat, bonne journée 🙏', 'vinted', 'message', []],
  ['Je peux baisser à 80 € avec le lot de deux', 'vinted', 'message', []],
  ['Elles ont été portées 3 fois, état 9/10', 'vinted', 'message', []],
  ['Je vous envoie ça demain matin 📦', 'ebay', 'message', []],
  ['Pas de souci, je prépare le colis', 'vestiaire', 'message', []],
  ['Je vous fais 10 % sur le lot de trois paires', 'vinted', 'message', []],
  // ── annonces risquées ──
  ['Nike Air Max 90 réplica taille 43', 'vinted', 'annonce', ['contrefacon']],
  ['Jordan 4 qualité 1:1 neuves', 'vinted', 'annonce', ['contrefacon']],
  ['Baskets inspirées de Yeezy 350', 'leboncoin', 'annonce', ['contrefacon']],
  ['Sac type Louis Vuitton très bon état', 'vinted', 'annonce', ['contrefacon']],
  ['Sneakers style Nike Dunk', 'vestiaire', 'annonce', ['contrefacon']],
  ['Copie Air Force 1 blanche', 'ebay', 'annonce', ['contrefacon']],
  ['Fake Balenciaga Triple S', 'vinted', 'annonce', ['contrefacon']],
  ['Non authentique, vendu comme tel', 'vinted', 'annonce', ['contrefacon']],
  ['Adidas Samba dupe pas cher', 'leboncoin', 'annonce', ['contrefacon']],
  ['Nike TN, contact 06 12 34 56 78', 'leboncoin', 'annonce', ['telephone']],
  ['Dunk Low Panda — paiement PayPal accepté', 'vinted', 'annonce', ['paiement']],
  // ── annonces sûres ──
  ['Téléphone portable Samsung Galaxy S21 128 Go', 'leboncoin', 'annonce', []],
  ['Nike Air Max 90 blanches taille 42 — 100 % authentiques, pas une copie', 'vinted', 'annonce', []],
  ['Copie de la facture disponible sur demande', 'vinted', 'annonce', []],
  ['New Balance 550 inspirées des années 80, neuves', 'vinted', 'annonce', []],
  ['Asics Gel-Kayano 14 style rétro, taille 41,5', 'vinted', 'annonce', []],
  ['Jordan 1 Mid, boîte d’origine, état 9/10, 120 €', 'ebay', 'annonce', []],
  ['Type de semelle : caoutchouc, pointure 44', 'vinted', 'annonce', []],
  ['Livraison Mondial Relay ou remise en main propre à Lyon', 'leboncoin', 'annonce', []],
  ['Adidas Gazelle bleues, lavées, prêtes à porter', 'vestiaire', 'annonce', []],
];

(async () => {
  let m;
  try { m = await import(pathToFileURL(path.join(R, 'src', 'messageSur.js')).href); }
  catch (e) { dit(false, 'src/messageSur.js existe et se charge', String(e && e.message || e).slice(0, 120)); }
  console.log(`\n── R. La règle (${PHRASES.length} phrases inventées)`);
  dit(PHRASES.length >= 60, 'au moins 60 phrases', PHRASES.length);
  if (m) {
    let rR = 0, rS = 0;
    for (const [t, site, fam, att] of PHRASES) {
      const r = (fam === 'annonce' ? m.risquesAnnonce : m.risquesMessage)(t, site).map((x) => x.code).sort();
      const a = att.slice().sort();
      const bon = JSON.stringify(r) === JSON.stringify(a);
      if (!bon) dit(false, `${att.length ? 'R1 relevée' : 'R2 sûre'} : « ${t} » (${site}, ${fam})`, `attendu [${a}] · lu [${r}]`);
      else if (att.length) rR++; else rS++;
    }
    const nR = PHRASES.filter((p) => p[3].length).length, nS = PHRASES.length - nR;
    dit(rR === nR, `R1 chaque phrase risquée est relevée avec la bonne sorte (${rR}/${nR})`);
    dit(rS === nS, `R2 aucun faux positif sur les phrases sûres (${rS}/${nS})`);
    dit(m.messageAutoPermis('Bonjour 🙂 merci pour ton favori !') === true && m.messageAutoPermis('Paie par PayPal stp') === false, 'messageAutoPermis : sûr ⇒ oui, risqué ⇒ non');
    dit(m.risquesMessage('Remise en main propre à Lyon', 'leboncoin').length === 0 && m.risquesMessage('Remise en main propre à Lyon', 'vinted').length === 1, 'R3 Leboncoin : la main propre n’est pas un risque, sur Vinted oui');
    dit(/Vinted bannit pour ça/.test(m.phraseRisqueMessage('vinted')) && /Leboncoin/.test(m.phraseRisqueMessage('leboncoin')), 'la phrase dit le site');
    dit(m.phraseRisqueMessage('vinted').split(/\s+/).length <= 12 && m.phraseRisqueAnnonce('vinted').split(/\s+/).length <= 12, 'phrases de 12 mots au plus');
  }

  console.log('\n── A. L’app, exécutée');
  try {
    const v = await import(pathToFileURL(path.join(R, 'src', 'verifAnnonce.js')).href);
    const p = v.problemesAnnonce({ titre: 'Nike Air Max réplica', nPhotos: 5, description: 'Envoi rapide' }, 'vinted');
    dit(p[0] && p[0].code === 'motsRisque' && p[0].ambre === true, 'A1 « réplica » est EN TÊTE de « vérifier avant de publier », ambre', JSON.stringify(p[0] || null));
    dit(!v.NOMS_ALERTES.motsRisque && v.lireCoupees(v.couperAlerte(null, 'motsRisque')).size === 0, 'A1 et ne se coupe jamais (« Ne plus me le dire » absent)');
    const q = v.problemesAnnonce({ titre: 'Nike Air Max 90', description: 'Très bon état, pas une copie' }, 'vinted');
    dit(!q.some((x) => x.code === 'motsRisque'), 'A1 une annonce sûre ne l’est pas', JSON.stringify(q));
  } catch (e) { dit(false, 'A1 problemesAnnonce s’exécute', String(e && e.message || e).slice(0, 140)); }
  try {
    const f = await import(pathToFileURL(path.join(R, 'src', 'favorisVinted.js')).href);
    const r = f.preparerMessageFavori('Merci ! Écris-moi sur WhatsApp au 06 12 34 56 78', '');
    dit(!r.message && /jamais tout seul/.test(r.erreur || ''), 'A2 un message aux favoris risqué est refusé, et c’est dit', JSON.stringify(r));
    dit(f.preparerMessageFavori('Merci pour ton favori {username} !', '').message !== '', 'A2 un message sûr passe');
  } catch (e) { dit(false, 'A2 preparerMessageFavori s’exécute', String(e && e.message || e).slice(0, 140)); }
  {
    const s = lire('api/_lib/favoris.js');
    const i = s.indexOf('export async function tourAuto'), j = s.indexOf('messageAutoPermis(prefs.message', i), k = s.indexOf('ajouterAuto(d,', i);
    dit(i > 0 && j > i && k > j && /stop\('message_risque'\)/.test(s.slice(j, j + 120)), 'A3 le tour automatique s’arrête sur un message risqué avant de poser un message');
    const a = lire('src/favorisAuto.js');
    dit(/message_risque\s*:/.test(a), 'A3 et la demande est dite (DEMANDES_AUTO.message_risque)');
  }

  console.log('\n── S. Les chemins d’envoi');
  const app = lire('src/App.jsx');
  const cc = app.slice(app.indexOf('function ComposeConv('), app.indexOf('function PiedSansEnvoi('));
  dit(/verifierMessageAvantEnvoi\(valeur, site\)/.test(cc) && /onClick=\{envoyerSur\}/.test(cc) && !/onClick=\{onEnvoyer\}/.test(cc) && /e\.preventDefault\(\); envoyerSur\(\)/.test(cc), 'S1 ComposeConv vérifie avant d’envoyer (clic et Entrée)');
  dit(/data-message-risque/.test(cc), 'S1 et le dit en ambre pendant la saisie');
  dit(/<ComposeConv site="leboncoin"/.test(lire('src/ecrans/MessagesLeboncoin.jsx')) && /<ComposeConv site="vestiaire"/.test(lire('src/ecrans/Vestiaire.jsx')) && /<ComposeConv site="ebay"/.test(lire('src/ebayGestion.jsx')), 'S1 chaque site donne son nom (Leboncoin, Vestiaire, eBay)');
  const ft = lire('src/ecrans/FilsTous.jsx');
  const fe = ft.slice(ft.indexOf('function FilEbay('), ft.indexOf('export function FilsTous'));
  dit(fe.indexOf("verifierMessageAvantEnvoi(body, 'ebay')") > 0 && fe.indexOf("verifierMessageAvantEnvoi(body, 'ebay')") < fe.indexOf("action: 'repondre'"), 'S2 la réponse eBay vérifie avant d’appeler la route');
  const vm = app.slice(app.indexOf('const verifierMessageAvantEnvoi'), app.indexOf('const askText'));
  dit(/Envoyer quand même/.test(vm) && /kind: 'verif'/.test(vm), 'S3 la feuille dit « Envoyer quand même »');
  dit(!/save\('vinted_offre_refus_msg', e\.target\.value\)/.test(app) && !/save\('vinted_offre_refus_msg', v\)/.test(app) && /save\('vinted_offre_refus_msg', erreurMessageAuto\(v\) \? '' : v\)/.test(app), 'S4 le refus automatique ne range jamais un message risqué');

  console.log(ko ? `\n❌ ${ko} rouge(s), ${ok} vert(s)` : `\n✅ ${ok} verts, 0 rouge`);
  if (process.argv.includes('--prouve') && !ko) prouver();
  process.exit(ko ? 1 : 0);
})();

// --prouve : chaque mutation (règle affaiblie) doit rendre l'audit ROUGE.
function prouver() {
  const MUT = [
    ['src/messageSur.js', 'const RE_TEL = /', 'const RE_TEL = /(?!)'],
    ['src/messageSur.js', "const nie = (t, i) => NEGATION.test", 'const nie = (t, i) => false && NEGATION.test'],
    ['src/messageSur.js', "if (!estLbc(site)) pose('mainpropre'", "pose('mainpropre'"],
    ['src/messageSur.js', "if (famille === 'annonce') pose('contrefacon'", "if (false) pose('contrefacon'"],
    ['src/App.jsx', 'onClick={envoyerSur}', 'onClick={onEnvoyer}'],
    ['src/favorisVinted.js', "const er=erreurMessageAuto(base,'vinted');if(er)", "const er='';if(er)"],
    ['src/verifAnnonce.js', 'if (mots.length) out.unshift', 'if (false) out.unshift'],
    ['src/App.jsx', "save('vinted_offre_refus_msg', erreurMessageAuto(v) ? '' : v)", "save('vinted_offre_refus_msg', v)"],
    ['api/_lib/favoris.js', "return await stop('message_risque');", ';'],
    ['src/ecrans/FilsTous.jsx', "if (!(await verifierMessageAvantEnvoi(body, 'ebay'))) return;", ''],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'msgsur-'));
  for (const d of ['src', 'api', 'package.json']) fs.cpSync(path.join(R, d), path.join(tmp, d), { recursive: true });
  let rouges = 0;
  for (const [f, a, b] of MUT) {
    const p = path.join(tmp, f), avant = fs.readFileSync(p, 'utf8');
    if (!avant.includes(a)) { console.log(`  ❌ mutation introuvable : ${f} « ${a.slice(0, 50)} »`); continue; }
    fs.writeFileSync(p, avant.replace(a, b));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, RACINE: tmp }, encoding: 'utf8' });
    fs.writeFileSync(p, avant);
    if (r.status !== 0) rouges++; else console.log(`  ❌ mutation NON vue : ${f} « ${a.slice(0, 60)} »`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${rouges}/${MUT.length} mutations rendent l’audit rouge`);
  if (rouges !== MUT.length) process.exit(1);
}
