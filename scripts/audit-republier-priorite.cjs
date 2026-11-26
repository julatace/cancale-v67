#!/usr/bin/env node
// ── audit-republier-priorite — « LES PAIRES À REPUBLIER EN PRIORITÉ » (21 nov., choix n° 12 de Julien) ──────────────
// Exécute la VRAIE règle (src/republierPriorite.js) sur des articles construits par la VRAIE règle des articles
// (src/articles/modele.js `construireArticles`), avec des données INVENTÉES. Il exige :
//   R1 UNE règle : « qui dort » = `filtrerArticles` etat 'dorment' (le segment Dorment), au site Vinted — une annonce de
//      20 j, sans date, « à confirmer » ou d'un autre site n'y entre jamais ; l'âge mini = le seuil de « Dorment »
//      (`vrm_qd_seuil`, 30/60/90) ;
//   R2 les exclusions, chacune COMPTÉE : vendue (sur n'importe quel site), masquée par Vinted, en litige ou retour (par
//      son N° ou son identifiant d'annonce), compte bloqué (en pause ou bloqué), compte personnel / d'achats ;
//   R3 pas su ≠ zéro : des vues ou favoris pas lus ne valent jamais 0 (ni dans le score, ni dans la raison) ;
//   R4 le classement (score en jours, poids documentés), stable, et la raison chiffrée « 41 j · 136 vues · 0 favori » ;
//   R5 « vues qui baissent » seulement sur un journal qui le PROUVE (≥ 3 points, deux moitiés ≥ 2 j) ;
//   R6 50 annonces au MÊME titre : 50 lignes, 50 identités (jamais le titre) ;
//   R7 lecture en cours ⇒ undefined, ratée ⇒ null (jamais « rien à republier ») ; réglages hors choix ⇒ défaut ;
//   R8 AUCUN LANCEMENT SANS SON TOUCHER : la règle n'ouvre ni n'envoie rien ; la vue n'appelle `onRepublier` que dans le
//      `onClick` de « Republier N » ; l'écran n'ouvre le panneau que dans ce geste (aucun effet, aucun minuteur) ; l'URL
//      est celle de l'atelier Republier (`ACTIONS_EXTENSION.republier`) avec les identifiants cochés ; deux comptes ⇒ refus ;
//   R9 Aujourd'hui : la rangée seulement si la publication propose au moins une paire (jamais publiée ⇒ rien) ; le segment
//      « À republier » existe dans Annonces, et le filtre de l'ordinateur y mène.
//   node scripts/audit-republier-priorite.cjs [--prouve]   (--prouve : chaque mutation doit rougir)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const F = (m) => path.join(R, 'src', m);
const SRC = fs.readFileSync(F('republierPriorite.js'), 'utf8');
const VUE = fs.readFileSync(F('natif/ecrans/RepublierPriorite.jsx'), 'utf8');
const EG = fs.readFileSync(F('ecrans/AnnoncesEgalite.jsx'), 'utf8');
const ANN = fs.readFileSync(F('natif/ecrans/Annonces.jsx'), 'utf8');
const AUJ = fs.readFileSync(F('natif/ecrans/Aujourdhui.jsx'), 'utf8');
const BR = fs.readFileSync(F('aujourdhui/Branche.jsx'), 'utf8');

// [cible, avant, après] — chaque défaut remis exprès : il faut du ROUGE.
const MUTATIONS = {
  'age-recopie': ['src', "if (!filtrerArticles([a], { site: 'vinted', etat: 'dorment', seuil: reglage.jours, maintenant, cle }).length) {", "if (!a.annonces.some((y) => y.site === 'vinted' && y.etat === 'enligne')) {"],
  'tous-sites': ['src', "etat: 'dorment', seuil: reglage.jours, maintenant, cle }).length) {", "etat: 'dorment', site: 'tous', seuil: reglage.jours, maintenant, cle }).length) {"],
  'vendue-oubliee': ['src', "if (a.annonces.some((y) => y.etat === 'vendue')) raison = 'vendue';", "if (false) raison = 'vendue';"],
  'litige-oublie': ['src', "else if (litige && (litige.ids.has(str(x.id)) || (cle(a.numero) && litige.nums.has(cle(a.numero))))) raison = 'litige';", ''],
  'bloque-oublie': ['src', "else if (bloques.has(compte) || a.annonces.some((y) => y.etat === 'bloque')) raison = 'bloque';", ''],
  'perso-oublie': ['src', "else if (perso.has(compte) || horsVente.has(compte)) raison = 'perso';", ''],
  'pas-lu-zero': ['src', "const vues = entier(x.vues), favoris = entier(x.favoris);", "const vues = entier(x.vues) ?? 0, favoris = entier(x.favoris) ?? 0;"],
  'baisse-sur-doute': ['src', '  if (pts.length < 3) return null;', '  if (pts.length < 2) return true;'],
  'identite-titre': ['src', "proposables.push({ cle: a.cle, article: a,", "proposables.push({ cle: a.titre, article: a,"],
  'pas-lu-vide': ['src', "if (!Array.isArray(articles)) return articles === undefined ? undefined : null;", "if (!Array.isArray(articles)) articles = [];"],
  'tri-favoris-ignores': ['src', "  if (f === 0) s += POIDS.zeroFavori;\n  else if (f != null) s -= POIDS.parFavori * Math.min(f, POIDS.favorisMax);", ''],
  'deux-comptes': ['src', "  if (comptes.length > 1) return { ok: false, raison: 'comptes', comptes };", ''],
  'lancement-seul': ['vue', "  const [reglages, setReglages] = React.useState(false);", "  const [reglages, setReglages] = React.useState(false);\n  React.useEffect(() => { if (lignes && lignes.length && onRepublierAuto) onRepublierAuto(); });"],
  'panneau-effet': ['eg', "  const republierPrio = ({ ids }) =>", "  React.useEffect(() => { if (prio && prio.liste.length) ouvrirPanneau({ site: 'vinted', page: 'republier', ids: prio.liste.map((l) => l.annonce.id), action: 'republier' }); }, [prio]);\n  const republierPrio = ({ ids }) =>"],
  'journee-vide': ['src', "export const rangeeAujourdhui = (p) => (p && p.montres > 0 ?", "export const rangeeAujourdhui = (p) => (p ?"],
};
const PROUVE = process.argv.includes('--prouve');

async function charger(src) {
  const abs = (m) => pathToFileURL(F(m)).href;
  const code = src.replace("from './articles/modele.js'", `from '${abs('articles/modele.js')}'`).replace("from './quiDorment.js'", `from '${abs('quiDorment.js')}'`);
  const f = path.join(os.tmpdir(), `republierPriorite-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, code);
  try { return await import(pathToFileURL(f).href); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

const J = 24 * 3600e3, NOW = Date.parse('2026-11-21T10:00:00Z');
// Une annonce dans la forme commune (src/articles/sources.js).
const an = (site, id, jours, extra = {}) => ({ site, id: String(id), compte: extra.compte || '111', pseudo: extra.pseudo || 'atelier.nord', titre: extra.titre || ('Paire ' + id), photo: null, prix: 40,
  taille: '42', condition: '', depuis: jours == null ? null : NOW - jours * J, favoris: extra.favoris === undefined ? 2 : extra.favoris, vues: extra.vues === undefined ? 30 : extra.vues,
  messages: null, etat: extra.etat || 'enligne', numero: extra.numero || '', vintedId: extra.vintedId || '', url: '' });
// Le jeu, à la main (âge mini 30 j, 10 par jour) :
//   p1  41 j · 136 vues · 0 fav           ⇒ 41 + 14 = 55
//   p2  90 j · 10 vues · 3 fav            ⇒ 90 − 21 + 7 (10/90 < 1) = 76
//   p3  35 j · 5 vues · 0 fav · BAISSE    ⇒ 35 + 14 + 14 + 7 = 70
//   p4  20 j                              ⇒ trop jeune (pas « Dorment »)
//   p5  60 j, vendue sur Leboncoin (même N° 5)   ⇒ écartée « vendue »
//   p6  60 j masquée par Vinted                  ⇒ écartée « masquée »
//   p7  70 j, compte 333 PERSONNEL               ⇒ écartée « perso »
//   p8  70 j, compte 444 BLOQUÉ                  ⇒ écartée « bloqué »
//   p9  65 j, N° 9 en RETOUR                      ⇒ écartée « litige »
//   p10 50 j, vues et favoris PAS LUS            ⇒ 50 (rien d'ajouté sur un doute)
//   p11 date inconnue ; p12 à confirmer ; p13 sur Leboncoin seul (55 j) ⇒ dans aucune liste
//   p14 10 j sur Vinted, 60 j sur Leboncoin (même N°) ⇒ ne dort pas SUR VINTED : jamais proposée
//   + 50 annonces au MÊME titre, 45 j · 2 vues · 0 fav ⇒ 45 + 14 + 7 = 66 chacune
const MEME = Array.from({ length: 50 }, (_, i) => an('vinted', 8000 + i, 45, { titre: 'Nike Air Force 1 blanche taille 42', vues: 2, favoris: 0, compte: '111' }));
const ANNONCES = [
  an('vinted', 1, 41, { vues: 136, favoris: 0 }),
  an('vinted', 2, 90, { vues: 10, favoris: 3 }),
  an('vinted', 3, 35, { vues: 5, favoris: 0 }),
  an('vinted', 4, 20, { vues: 0, favoris: 0 }),
  an('vinted', 5, 60, { numero: '5' }), an('leboncoin', 'lb5', 10, { etat: 'vendue', numero: '5', compte: 'lbc' }),
  an('vinted', 6, 60, { etat: 'masquee' }),
  an('vinted', 7, 70, { compte: '333' }),
  an('vinted', 8, 70, { compte: '444' }),
  an('vinted', 9, 65, { numero: '9' }),
  an('vinted', 10, 50, { vues: null, favoris: null }),
  an('vinted', 11, null),
  an('vinted', 12, 80, { etat: 'aconfirmer' }),
  an('leboncoin', 'lb13', 55, { compte: 'lbc' }),
  an('vinted', 14, 10, { numero: '14' }), an('leboncoin', 'lb14', 60, { numero: '14', compte: 'lbc' }),
  ...MEME,
];
const JOURNAL = { 'vinted#3': [[NOW - 34 * J, 0, 0], [NOW - 20 * J, 4, 0], [NOW - 1 * J, 5, 0]], 'vinted#1': [[NOW - 10 * J, 100, 0], [NOW - 5 * J, 118, 0], [NOW - 1 * J, 136, 0]] };

async function audit(sources, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); };
  let M, Mo;
  try { M = await charger(sources.src); Mo = await import(pathToFileURL(F('articles/modele.js')).href); } catch (e) { dit(false, 'le module se charge', e.message); return ko || 1; }
  const { articles } = Mo.construireArticles({ annonces: ANNONCES, fiches: {}, aVinted: true });
  const opts = { maintenant: NOW, comptesPersonnels: new Set(['333']), comptesBloques: new Set(['444']), enLitige: { nums: new Set(['9']), ids: new Set() }, journalVues: JOURNAL };
  const r = M.republierEnPriorite(articles, { ...opts, parJour: 50 });
  const ids = r ? r.classees.map((l) => l.annonce.id) : [];
  // R1
  dit(r && !ids.includes('4') && !ids.includes('11') && !ids.includes('12') && !ids.includes('lb13') && !ids.includes('14'), 'R1 la règle « Dorment » au site Vinted : 20 j, sans date, « à confirmer », Leboncoin seul, 10 j sur Vinted (60 j ailleurs) ⇒ jamais proposées', ids.slice(0, 8));
  dit(r && r.n === 54 && r.classees.length === 54 && r.liste.length === 50, `R1 54 proposables (p1 p2 p3 p10 + 50), 50 montrées au plus — ${r && r.n}`, r && r.n);
  const r60 = M.republierEnPriorite(articles, { ...opts, jours: 60, parJour: 50 });
  dit(r60 && r60.liste.map((l) => l.annonce.id).join(',') === '2', 'R1 âge mini 60 j ⇒ p2 seule (90 j)', r60 && r60.liste.map((l) => l.annonce.id));
  dit(/CLE_SEUIL_DORMENT = 'vrm_qd_seuil'/.test(sources.src) && /localStorage\.getItem\(CLE_SEUIL_DORMENT\)/.test(EG) && /const seuil = regPrio\.jours;/.test(EG), 'R1 l\'âge mini EST le seuil de « Dorment » (`vrm_qd_seuil`), un seul réglage pour les deux');
  // R2
  dit(r && JSON.stringify(r.exclues) === JSON.stringify({ vendue: 1, masquee: 1, litige: 1, bloque: 1, perso: 1 }), 'R2 écartées, chacune comptée : vendue 1 · masquée 1 · litige 1 · bloqué 1 · personnel 1', r && r.exclues);
  dit(r && !['5', '6', '7', '8', '9'].some((x) => ids.includes(x)), 'R2 aucune écartée dans la liste', ids.filter((x) => ['5', '6', '7', '8', '9'].includes(x)));
  const rId = M.republierEnPriorite(articles, { ...opts, enLitige: { nums: new Set(), ids: new Set(['2']) } });
  dit(rId && !rId.liste.some((l) => l.annonce.id === '2') && rId.exclues.litige === 1, 'R2 un litige par l\'IDENTIFIANT de l\'annonce l\'écarte aussi', rId && rId.exclues);
  const rHV = M.republierEnPriorite(articles, { ...opts, comptesHorsVente: new Set(['111']) });
  dit(rHV && rHV.liste.length === 0, 'R2 un compte d\'achats (rôle « achats ») n\'est jamais proposé', rHV && rHV.liste.length);
  // R3
  const l10 = r && r.classees.find((l) => l.annonce.id === '10');
  dit(l10 && l10.vues === null && l10.favoris === null && l10.score === 50 && r.sansCompteur === 1, 'R3 p10 : vues et favoris pas lus ⇒ null, score 50 (rien ajouté sur un doute), compté « sans compteur »', l10 && { v: l10.vues, f: l10.favoris, s: l10.score });
  const raison10 = l10 ? M.raisonPriorite(l10).map((x) => x.k).join(',') : '';
  dit(raison10 === 'jours,vuesPasLues,favorisPasLus', 'R3 sa raison dit « vues pas lues · favoris pas lus », jamais « 0 »', raison10);
  // R4
  const top = ids.slice(0, 3).join(',');
  dit(top === '2,3,8000', 'R4 classement : p2 (76), p3 (70), puis les 50 (66, identifiant croissant)', ids.slice(0, 5));
  const i1 = ids.indexOf('1'), i10 = ids.indexOf('10');
  dit(i1 === 53 - 1 && i10 === 53, 'R4 p1 (55) puis p10 (50) en fin de liste', { i1, i10 });
  const l1 = r && r.classees.find((l) => l.annonce.id === '1');
  dit(l1 && M.raisonPriorite(l1).map((x) => x.k + (x.n != null ? x.n : '')).join(' · ') === 'jours41 · vues136 · favoris0', 'R4 la raison de p1 : « 41 j · 136 vues · 0 favori »', l1 && M.raisonPriorite(l1));
  const rB = M.republierEnPriorite(articles, { ...opts, parJour: 50 });
  dit(rB && rB.classees.map((l) => l.cle).join() === r.classees.map((l) => l.cle).join(), 'R4 deux calculs ⇒ le même ordre (stable d\'un jour à l\'autre)');
  const r10 = M.republierEnPriorite(articles, opts);
  dit(r10 && r10.liste.length === 10 && r10.reste === 44 && r10.reglage.parJour === 10, 'R4 10 par jour par défaut ; les 44 autres attendent (« reste »)', r10 && { n: r10.liste.length, reste: r10.reste });
  // R5
  const l3 = r && r.classees.find((l) => l.annonce.id === '3');
  dit(l3 && l3.baisse === true && M.raisonPriorite(l3).some((x) => x.k === 'baisse'), 'R5 p3 : 4 vues en 14 j puis 1 en 19 j ⇒ « vues qui baissent »', l3 && l3.baisse);
  dit(l1 && l1.baisse === false, 'R5 p1 : 18 vues en 5 j puis 18 en 4 j ⇒ elles ne baissent pas', l1 && l1.baisse);
  dit(M.vuesEnBaisse([[NOW - 3 * J, 10], [NOW, 11]]) === null && M.vuesEnBaisse([[NOW - 3 * J, 10], [NOW - 2 * J, 20], [NOW, 21]]) === null && M.vuesEnBaisse(null) === null,
    'R5 deux points, ou une moitié de moins de 2 jours ⇒ pas su (null), jamais « baisse »');
  // R6
  const meme = r ? r.classees.filter((l) => /^80\d\d$/.test(l.annonce.id)) : [];
  dit(meme.length === 50 && new Set(meme.map((l) => l.cle)).size === 50 && new Set(meme.map((l) => l.annonce.id)).size === 50, 'R6 50 annonces au même titre : 50 lignes, 50 identités', meme.length);
  // R7
  dit(M.republierEnPriorite(undefined) === undefined && M.republierEnPriorite(null) === null, 'R7 lecture en cours ⇒ undefined, ratée ⇒ null (jamais une liste vide)');
  const lr = M.lireReglagePrio({ jours: 45, parJour: 7 });
  dit(lr.jours === 30 && lr.parJour === 10 && M.lireReglagePrio({ jours: '90', parJour: '20' }).jours === 90, 'R7 réglage hors choix ⇒ le défaut (30 j, 10 par jour)', lr);
  // R8
  const s2 = M.selectionRepublier(r.liste, new Set([r.liste[0].cle, r.liste[1].cle]));
  dit(s2.ok && s2.ids.join() === '2,3' && s2.compte === '111', 'R8 deux cochées d\'un compte ⇒ leurs identifiants, dans l\'ordre', s2);
  const lAutre = { cle: 'x', annonce: { id: '99', compte: '555' } };
  dit(M.selectionRepublier([r.liste[0], lAutre], new Set([r.liste[0].cle, 'x'])).raison === 'comptes' && M.selectionRepublier(r.liste, new Set()).raison === 'aucune', 'R8 deux comptes ⇒ refus nommé ; rien coché ⇒ refus');
  dit(!/ouvrirPanneau|vmrCmd|fetch\(|window\.open/.test(sources.src.replace(/\/\/.*$/gm, '')), 'R8 la règle n\'ouvre rien et n\'envoie rien');
  const vueSans = sources.vue.replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const appels = vueSans.match(/\bonRepublier\(/g) || [];
  dit(appels.length === 1 && /onClick=\{\(\) => \{ if \(j\.ok\) onRepublier\(\{ ids: j\.ids, compte: j\.compte \}\); \}\}/.test(vueSans) && !/useEffect\([^)]*onRepublier/.test(vueSans) && !/onRepublierAuto/.test(vueSans),
    'R8 la vue n\'appelle `onRepublier` QUE dans le onClick de « Republier N »', appels.length);
  const egSans = sources.eg.replace(/\/\/.*$/gm, '');
  // (25 nov., décision de Julien du 24 nov. — CLAUDE.md §3) « Republier N » part DEPUIS VRM par la porte (les annonces cochées, SON
  // compte, UNE confirmation) ; refusé ⇒ le panneau (atelier Republier) sur ces annonces. Seulement dans ce geste : aucun effet,
  // aucun minuteur.
  const i8 = egSans.indexOf('const republierPrio = ({ ids, compte }) => {'), j8 = i8 < 0 ? -1 : egSans.indexOf('})(); };', i8);
  const corps8 = i8 < 0 || j8 < 0 ? '' : egSans.slice(i8, j8 + 8);
  const r8 = await require('./_porte-agir.cjs').regle({ code: corps8,
    porte: /const a = ACTIONS_EXTENSION\.republier;[\s\S]*const r = await republierDansApp\(\(ids \|\| \[\]\)\.map\(\(id\) => \(\{ compte: String\(compte \|\| ''\), id: String\(id\) \}\)\), confirmerRepub\);/,
    repli: /if \(!r\.annule\) ouvrirPanneau\(\{ site: 'vinted', compte: compte \? String\(compte\) : '\*', page: a\.page, ids, action: a\.action \}\);/ });
  const ouvertures = (egSans.match(/ouvrirPanneau\(\{ site: 'vinted', compte: compte \? String\(compte\) : '\*', page: a\.page, ids, action: a\.action \}\)/g) || []).length;
  dit(r8.ok && ouvertures === 1 && !/useEffect\([^;]*(?:ouvrirPanneau|republierDansApp)/.test(egSans) && !/setTimeout\([^;]*republierPrio/.test(egSans) && /onRepublier=\{republierPrio\}/.test(egSans),
    'R8 (24 nov.) « Republier N » : DEPUIS VRM par la porte, sinon le panneau sur ces annonces — seulement dans ce geste, aucun effet, aucun minuteur', r8.detail || ouvertures);
  const OP = await import(pathToFileURL(F('ouvrirPanneau.js')).href); const AE = await import(pathToFileURL(F('actionsExtension.js')).href);
  const url = OP.lienPanneau({ site: 'vinted', page: AE.ACTIONS_EXTENSION.republier.page, ids: s2.ids, action: AE.ACTIONS_EXTENSION.republier.action });
  dit(url === 'https://www.vinted.fr/?vrm=panneau&page=republier&ids=2,3&action=republier', 'R8 l\'URL : l\'atelier Republier du panneau, les annonces cochées', url);
  // R9
  dit(M.rangeeAujourdhui(null) === null && M.rangeeAujourdhui({ n: 0, montres: 0, jours: 30 }) === null && M.rangeeAujourdhui({ n: 12, montres: 10, jours: 30 }).n === 10, 'R9 Aujourd\'hui : jamais publiée ou zéro ⇒ aucune rangée ; sinon les N du jour');
  dit(/aRepublier && aRepublier\.n > 0 \? <Rangee/.test(AUJ) && /tr\('prio\.journee'/.test(AUJ) && /rangeeAujourdhui\(lirePriorite\(outils\.uid\(\)\)\)/.test(BR) && /outils\.vue\('arepublier'\)/.test(BR), 'R9 la rangée « N paires à republier en priorité › » d\'Aujourd\'hui lit la publication et ouvre « À republier »');
  dit(/\[\.\.\.ETATS, (?:\.\.\.\(priorite \? \[)?'arepublier'\]/.test(ANN) && /prendreVue\('arepublier'\)/.test(EG) && /cle: 'arepublier', libelle: tr\('egalite\.etat\.arepublier'\)/.test(EG), 'R9 Annonces : le segment « À republier », pris de la demande d\'Aujourd\'hui, et l\'option du filtre de l\'ordinateur');
  return ko;
}

(async () => {
  const base = { src: SRC, vue: VUE, eg: EG };
  const ko = await audit(base, true);
  if (!PROUVE) { console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ audit-republier-priorite : tout vert'); process.exit(ko ? 1 : 0); }
  let rates = 0;
  for (const [nom, [cible, avant, apres]] of Object.entries(MUTATIONS)) {
    if (!base[cible].includes(avant)) { console.log(`❌ mutation ${nom} : ancre introuvable`); rates++; continue; }
    const k = await audit({ ...base, [cible]: base[cible].replace(avant, apres) }, false);
    console.log(k ? `✅ mutation ${nom} : ${k} rouge(s)` : `❌ mutation ${nom} : RESTE VERTE`); if (!k) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non attrapée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations attrapées`);
  process.exit(rates ? 1 : 0);
})();
