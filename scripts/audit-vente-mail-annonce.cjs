// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « LA VENTE VUE PAR E-MAIL ET SON ANNONCE ENCORE EN LIGNE » (24 nov.)
//  Récit : docs/passation/2026-11-24-vente-mail-annonce.md.
//  Il EXÉCUTE la règle (src/venteMailAnnonce.js) sur la FORME mesurée le 24 nov. (lecture seule, vraie base) — les valeurs
//  sont INVENTÉES (le dépôt est public) :
//    · l'e-mail de vente (ligne projetée `requeteVentesEmail`) : { id: email_sale_tx{n°}, type: 'vente', tx, uid, at, photo }
//      avec photo = images1.vinted.net/t/{dossier}/150x210/{fichier}.jpeg?s=… ;
//    · l'annonce du dressing : photo = images1.vinted.net/tc/{dossier}/{fichier}.jpeg?s=… (même dossier, même fichier).
//   M1 l'identité d'une image : /t/ + taille = /tc/ ; un autre fichier, un autre dossier, une autre adresse ⇒ différent / rien ;
//   M2 50 annonces « Autry reelwind low noir taille 36 » identiques (titre, taille, prix, compte) : SEULE celle de l'image de
//      l'e-mail est reliée ; sans photo dans l'e-mail ⇒ AUCUNE (jamais par le titre) ; une image d'aucune annonce ⇒ aucune ;
//   M3 deux annonces à la même image ⇒ rien ; même image sur un AUTRE compte ⇒ rien ; deux ventes pour une annonce ⇒ rien ;
//   M4 la lecture fait foi : dressing relu APRÈS l'e-mail, ou heure de lecture inconnue ⇒ rien ; N° posé après l'e-mail ⇒ rien ;
//   M5 SON clic « Relier » relie (même sans photo) ; « Délier » défait (même la photo) ; un lien vers une annonce d'un autre
//      compte ne relie pas ; les propositions sont du MÊME compte et ne relient rien seules ;
//   M6 « en ligne » : l'article relié sort d'« En ligne » (et des totaux) et entre dans « Vendues » ; rien n'est supprimé ;
//   M7 aucun double compte : quand la liste Vinted lit la vente, la ligne e-mail sort (une ligne) ; quand le dressing est
//      relu, plus rien n'est « vendu par e-mail » (la lecture fait foi) ;
//   M8 l'écran : Comptabilite ne refuse plus le N° de l'annonce reliée (`onlineAnnonceIds` sans elle), les totaux l'excluent
//      (`emailSoldIds`), l'e-mail relie par `identiteAnnonce` ; Annonces et la fiche appliquent la MÊME règle.
//  `--prouve` : chaque mutation réaffaiblit une règle (dont « relier par le titre ») ⇒ l'audit doit tomber.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  const F = 'src/venteMailAnnonce.js';
  prouver(__filename, path.join(__dirname, '..'), {
    'relier par le TITRE (la première annonce du compte au même titre)': [[F, 'const memes = (parImage.get(k) || []).filter((a) => str(a.uid) === n.uid);',
      "const memes = [...parId.values()].filter((a) => str(a.uid) === n.uid && String(a.titre || '').toLowerCase() === String(n.titre || a.titre || '').toLowerCase()).slice(0, 1);"]],
    'sans photo, la première annonce du compte': [[F, 'const k = cleImageVinted(n.photo); if (!k) continue;', 'const k = cleImageVinted(n.photo) || [...parImage.keys()][0];']],
    'deux annonces à la même image : la première': [[F, 'if (memes.length !== 1) continue;', 'if (!memes.length) continue;']],
    'image d’un autre compte admise': [[F, 'const memes = (parImage.get(k) || []).filter((a) => str(a.uid) === n.uid);', 'const memes = (parImage.get(k) || []);'], [F, "if (!a || str(a.uid) !== n.uid) return false;", 'if (!a) return false;']],
    'la lecture d’après l’e-mail ne fait plus foi': [[F, 'const lu = msLu(a.lu); if (!Number.isFinite(lu) || !(lu < n.t)) return false;', '']],
    'paire renumérotée après l’e-mail reliée': [[F, 'const tf = tsFiche(fiches && fiches[str(a.id)]); if (tf != null && tf > n.t) return false;', '']],
    '« Délier » ignoré': [[F, 'if (lien && lien.aucun) continue;', '']],
    'deux ventes pour une annonce : la première': [[F, 'if (choix.length !== 1) continue;', '']],
    'l’image sans son dossier (fichier seul)': [[F, "return (dossier + '/' + fichier).toLowerCase();", 'return fichier.toLowerCase();']],
    'l’écran refuse encore l’annonce en ligne': [['src/ecrans/Comptabilite.jsx', ".filter((id) => !venduesMail.has(id))), [listings.items, venduesMail]);", "), [listings.items, venduesMail]);"]],
    'les totaux comptent encore l’annonce': [['src/ecrans/Comptabilite.jsx', ', ...venduesMail.keys()]),', ']),']],
    'Annonces n’applique pas la règle': [['src/ecrans/AnnoncesEgalite.jsx', "parMail.has(String(x.id)) ? { ...x, etat: 'vendue', venteMail: true", "false ? { ...x, etat: 'vendue', venteMail: true"]],
  });
  return;
}

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + String(d).slice(0, 400) : ''}`); };

(async () => {
  let M = null, V = null, A = null;
  try { M = await import(pathToFileURL(path.join(R, 'src', 'venteMailAnnonce.js')).href); } catch (e) { dit(false, 'la règle existe (src/venteMailAnnonce.js)', e.message); }
  try { V = await import(pathToFileURL(path.join(R, 'src', 'venteEmailFraiche.js')).href); } catch (e) { dit(false, 'src/venteEmailFraiche.js se charge', e.message); }
  try { A = await import(pathToFileURL(path.join(R, 'src', 'articles', 'modele.js')).href); } catch (e) { dit(false, 'src/articles/modele.js se charge', e.message); }
  if (!M || !V || !A) { console.log(`\n❌ ${ko} rouge(s)`); process.exit(1); }

  // ── la forme mesurée (valeurs inventées) ──
  const UID = '123456789', AUTRE = '987654321';
  const T_MAIL = Date.parse('2026-11-24T11:29:34.561Z');
  const LU_AVANT = Date.parse('2026-11-23T19:50:43.040Z');
  const dossier = (i) => `05_000df_${'Ab' + String(i).padStart(4, '0')}CdEfGhIjKlMnOpQrStUv`;
  const fichier = (i) => (0x941d4700 + i).toString(16);
  const photoAnnonce = (i) => `https://images1.vinted.net/tc/${dossier(i)}/${fichier(i)}.jpeg?s=${'5ca53aa8'.repeat(5)}`;
  const photoMail = (i) => `https://images1.vinted.net/t/${dossier(i)}/150x210/${fichier(i)}.jpeg?s=${'e2eda205'.repeat(5)}`;
  const mail = (o = {}) => ({ id: 'email_sale_tx' + (o.tx || '24000000001'), type: 'vente', tx: o.tx === '' ? '' : (o.tx || '24000000001'), uid: o.uid || UID, at: new Date(o.t || T_MAIL).toISOString(),
    titre: 'Autry reelwind low noir taille 36', prix: '77.00', photo: o.photo === undefined ? photoMail(37) : o.photo, ...(o.id ? { id: o.id } : {}) });
  const annonces50 = Array.from({ length: 50 }, (_, i) => ({ id: String(10924548300 + i), uid: UID, photo: photoAnnonce(i), lu: LU_AVANT, titre: 'Autry reelwind low noir taille 36', taille: '36', prix: 84 }));
  const ID37 = String(10924548300 + 37);
  const relie = (o) => M.venduesParMail(o);

  // M1
  dit(M.cleImageVinted(photoMail(37)) && M.cleImageVinted(photoMail(37)) === M.cleImageVinted(photoAnnonce(37)), 'M1 /t/…/150x210/ (e-mail) = /tc/ (dressing) : la même image', `${M.cleImageVinted(photoMail(37))} vs ${M.cleImageVinted(photoAnnonce(37))}`);
  dit(M.cleImageVinted(photoAnnonce(37).replace('images1', 'images')) === M.cleImageVinted(photoAnnonce(37)), 'M1 l’hôte et la signature ne changent pas l’image');
  dit(M.cleImageVinted(photoAnnonce(36)) !== M.cleImageVinted(photoAnnonce(37)), 'M1 une autre image ⇒ une autre identité');
  dit(M.cleImageVinted(`https://images1.vinted.net/tc/${dossier(5)}/${fichier(37)}.jpeg`) !== M.cleImageVinted(photoAnnonce(37)), 'M1 même fichier, autre dossier ⇒ autre identité');
  dit(M.cleImageVinted('https://exemple.com/tc/abc/def.jpeg') === '' && M.cleImageVinted('') === '' && M.cleImageVinted(null) === '', 'M1 une adresse qui n’est pas une image Vinted ⇒ rien');

  // M2 — 50 identiques
  let r = relie({ ventes: [mail()], annonces: annonces50 });
  dit(r.size === 1 && r.has(ID37) && r.get(ID37).via === 'photo', 'M2 50 annonces identiques : seule celle de l’image de l’e-mail est reliée', JSON.stringify([...r]));
  r = relie({ ventes: [mail({ photo: '' })], annonces: annonces50 });
  dit(r.size === 0, 'M2 e-mail sans photo ⇒ aucune des 50 (jamais par le titre)', JSON.stringify([...r]));
  r = relie({ ventes: [mail({ photo: photoMail(99) })], annonces: annonces50 });
  dit(r.size === 0, 'M2 image d’aucune annonce ⇒ aucune', JSON.stringify([...r]));
  r = relie({ ventes: [mail({ tx: '', id: 'email_sale_m891bfc4fbb448a84' })], annonces: annonces50 });
  dit(r.size === 1 && r.has(ID37) && r.get(ID37).cle === 'email:email_sale_m891bfc4fbb448a84', 'M2 vente de particulier (sans n°) : reliée par l’image, clé de SA ligne', JSON.stringify([...r]));

  // M3
  const doubles = annonces50.map((a, i) => (i === 12 ? { ...a, photo: photoAnnonce(37) } : a));
  dit(relie({ ventes: [mail()], annonces: doubles }).size === 0, 'M3 deux annonces à la même image ⇒ rien');
  const autreCompte = annonces50.map((a, i) => (i === 37 ? { ...a, uid: AUTRE } : a));
  dit(relie({ ventes: [mail()], annonces: autreCompte }).size === 0, 'M3 la même image sur un AUTRE compte ⇒ rien (l’adresse de réception décide du compte)');
  dit(relie({ ventes: [mail(), mail({ tx: '24000000002' })], annonces: annonces50 }).size === 0, 'M3 deux ventes pour une annonce ⇒ rien de choisi');

  // M4
  dit(relie({ ventes: [mail()], annonces: annonces50.map((a) => ({ ...a, lu: T_MAIL + 60000 })) }).size === 0, 'M4 dressing relu APRÈS l’e-mail ⇒ la lecture fait foi, rien');
  dit(relie({ ventes: [mail()], annonces: annonces50.map((a) => ({ ...a, lu: null })) }).size === 0, 'M4 heure de lecture inconnue ⇒ rien (pas su)');
  dit(relie({ ventes: [mail()], annonces: annonces50, fiches: { [ID37]: { numero: '262', numberedAt: new Date(T_MAIL + 3600000).toISOString() } } }).size === 0, 'M4 N° posé après l’e-mail (paire republiée) ⇒ rien');
  dit(relie({ ventes: [mail()], annonces: annonces50, fiches: { [ID37]: { numero: '262', numberedAt: new Date(T_MAIL - 86400000).toISOString() } } }).size === 1, 'M4 N° posé avant l’e-mail ⇒ reliée');
  dit(relie({ ventes: null, annonces: annonces50 }).size === 0 && relie({ ventes: [mail()], annonces: null }).size === 0, 'M4 e-mails ou annonces pas lus ⇒ rien');
  dit(relie({ ventes: [{ ...mail(), type: 'statut' }], annonces: annonces50 }).size === 0, 'M4 un e-mail qui n’est pas une VENTE ⇒ rien');

  // M5 — son clic
  const ID5 = String(10924548305);
  const cle = '24000000001';
  let liens = M.relierVenteMail({}, cle, ID5, T_MAIL);
  r = relie({ ventes: [mail({ photo: '' })], annonces: annonces50, liens });
  dit(r.size === 1 && r.has(ID5) && r.get(ID5).via === 'main', 'M5 SON « Relier » relie l’annonce choisie (sans photo)', JSON.stringify([...r]));
  r = relie({ ventes: [mail()], annonces: annonces50, liens });
  dit(r.size === 1 && r.has(ID5), 'M5 son choix l’emporte sur la photo', JSON.stringify([...r]));
  liens = M.delierVenteMail(liens, cle, T_MAIL);
  r = relie({ ventes: [mail()], annonces: annonces50, liens });
  dit(r.size === 0, 'M5 « Délier » défait (et la photo ne relie plus cette vente)', JSON.stringify([...r]));
  r = relie({ ventes: [mail({ photo: '' })], annonces: autreCompte, liens: M.relierVenteMail({}, cle, ID37) });
  dit(r.size === 0, 'M5 un lien vers l’annonce d’un autre compte ne relie pas');
  const ventesLigne = V.ventesEmailFraiches({ mails: [mail()], comptes: [{ vinted_user_id: UID }], ventes: [], ko: [], lectures: { [UID]: LU_AVANT } });
  dit(ventesLigne.length === 1, 'M5 la ligne de Ventes de l’e-mail existe (la forme de Ventes)');
  const c = M.candidatsRelier(ventesLigne[0], [...annonces50, { ...annonces50[0], id: '1', uid: AUTRE }], { titre: 'Autry reelwind low noir taille 36', prix: 77 });
  dit(c.length > 0 && c.length <= 8 && c.every((x) => x.uid === UID), 'M5 propositions : du MÊME compte seulement, au plus 8', c.map((x) => x.uid).join(','));
  dit(relie({ ventes: [mail({ photo: '' })], annonces: annonces50 }).size === 0, 'M5 les propositions ne relient rien sans son clic');
  r = relie({ ventes: ventesLigne, annonces: annonces50 });
  dit(r.size === 1 && r.has(ID37), 'M5 la ligne de Ventes (forme `_venteEmail`) se relie par la même règle');

  // M6 — « en ligne » et totaux
  const annArt = (etat, extra = {}) => annonces50.slice(30, 40).map((a) => ({ site: 'vinted', id: a.id, compte: UID, titre: a.titre, photo: a.photo, prix: 84, etat: a.id === ID37 ? etat : 'enligne', lu: LU_AVANT, ...(a.id === ID37 ? extra : {}) }));
  const avant = A.compterArticles(A.construireArticles({ annonces: annArt('enligne') }).articles);
  const vendus = A.construireArticles({ annonces: annArt('vendue', { venteMail: true, venduLe: T_MAIL }) }).articles;
  const apres = A.compterArticles(vendus);
  dit(avant.tous.enligne === 10 && apres.tous.enligne === 9 && apres.tous.vendues === 1, 'M6 l’annonce reliée sort d’« En ligne » (10 → 9) et entre dans « Vendues »', JSON.stringify({ avant: avant.tous, apres: apres.tous }));
  const art = vendus.find((x) => x.annonces.some((y) => y.id === ID37));
  dit(!!art && art.venteMail === true && art.annonces.length === 1, 'M6 rien n’est supprimé : l’article reste, marqué « par e-mail, en attente de Vinted »');

  // M7 — pas de double compte
  const venteVinted = { transaction_id: '24000000001', title: 'Autry reelwind low noir taille 36', date: new Date(T_MAIL - 60000).toISOString(), _acc: { vinted_user_id: UID }, status: 'Commande en cours' };
  const fraiches = V.ventesEmailFraiches({ mails: [mail()], comptes: [{ vinted_user_id: UID }], ventes: [venteVinted], ko: [], lectures: { [UID]: T_MAIL + 600000 } });
  const fusion = V.avecVentesEmail([venteVinted], fraiches);
  dit(fraiches.length === 0 && fusion.length === 1, 'M7 la vente lue par l’extension : UNE ligne (la ligne e-mail sort)', JSON.stringify({ f: fraiches.length, l: fusion.length }));
  dit(relie({ ventes: [mail()], annonces: annonces50.filter((a) => a.id !== ID37).map((a) => ({ ...a, lu: T_MAIL + 600000 })) }).size === 0, 'M7 le dressing relu (annonce fermée, absente) : plus rien « par e-mail »');

  // M8 — l'écran (source, commentaires retirés)
  const lire = (f) => { try { return sansCommentaires(fs.readFileSync(path.join(R, f), 'utf8')); } catch (_) { return ''; } };
  const comp = lire('src/ecrans/Comptabilite.jsx');
  dit(/const onlineAnnonceIds = useMemo\(\(\) => new Set\(\(listings\.items \|\| \[\]\)\.map\(it => String\(it\.id\)\)\.filter\(\(id\) => !venduesMail\.has\(id\)\)\)/.test(comp), 'M8 Comptabilite : l’annonce reliée n’est plus « en ligne » (la vente reçoit son N°)');
  dit(/const emailSoldIds = useMemo\(\(\) => new Set\(\[\.\.\.venduesParEmail\([\s\S]{0,300}\), \.\.\.venduesMail\.keys\(\)\]\)/.test(comp), 'M8 Comptabilite : les totaux « en ligne » l’excluent (`emailSoldIds`)');
  dit(/o\._fromEmail && o\.transaction_id != null && venteMailItem\.has\(/.test(comp), 'M8 Comptabilite : la vente e-mail relie par `identiteAnnonce`');
  dit(/relierAnnonce: relierAnnonceDe\(o, num\)/.test(comp), 'M8 Ventes : le geste « Relier à l’annonce » est posé sur la vente e-mail');
  const eg = lire('src/ecrans/AnnoncesEgalite.jsx');
  dit(/venduesParMail\(\{ ventes: mails,/.test(eg) && /parMail\.has\(String\(x\.id\)\) \? \{ \.\.\.x, etat: 'vendue', venteMail: true/.test(eg), 'M8 Annonces : la MÊME règle, l’annonce passe « Vendue · par e-mail »');
  const app = lire('src/App.jsx');
  dit(/venduesMail=new Set\(venduesParMail\(\{ ventes:mails,/.test(app) && /venduesMail: nd\.venduesMail/.test(app), 'M8 la fiche : la MÊME règle (plus « en ligne », « vendue · par e-mail »)');
  dit(!/titre|title/.test(lire('src/venteMailAnnonce.js').split('export function candidatsRelier')[0].split('export function venduesParMail')[1] || 'titre'), 'M8 la règle qui relie ne lit aucun titre');

  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ tout vert');
  process.exit(ko ? 1 : 0);
})();
