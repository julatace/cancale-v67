#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  audit-essoufflement — « LES ANNONCES QUI S'ESSOUFFLENT » (28 nov., choix de Julien)
//  « quand une annonce n'a plus ni vues ni favoris depuis plusieurs jours, elle remonte en tête de "À republier", avec le
//    gain estimé. C'est toujours toi qui lances. »
//  Exécute la VRAIE règle (src/essoufflement.js), sa consommatrice (src/republierPriorite.js) sur des articles de la VRAIE
//  règle des articles (src/articles/modele.js), et la VRAIE notification du serveur (api/_lib/essoufflement-notif.js),
//  avec des données INVENTÉES (jamais la base). Il exige :
//   E1 courbe plate (≥ 4 pas de suite, jours LUS consécutifs, ≤ 1 vue et 0 favori par jour, lue aujourd'hui ou hier)
//      ⇒ essoufflée, avec le nombre de jours à plat ;
//   E2 pas su ⇒ JAMAIS essoufflée : un trou (jour non lu), une courbe vieille, des vues à 0 (Vinted ne donne plus le
//      nombre), un champ absent, trop court ; une annonce qui vit (vues ou favori gagnés, favori perdu) ⇒ active ;
//   E3 exclues et COMPTÉES : vendue (sur un autre site), masquée, réservée, compte personnel ; une annonce dont la courbe
//      n'a pas été lue (paquet raté) ⇒ pas su ; courbes en cours ⇒ personne, ratées ⇒ « passu » ;
//   E4 en TÊTE de « À republier », même avant l'âge de « Dorment », rangées par le gain de LEUR compte (inconnu ⇒ après) ;
//      50 annonces au même titre ⇒ 50 identités ;
//   E5 le gain vient SEULEMENT de SES republications passées (repère « r » sur la NOUVELLE annonce, ses vues LUES au
//      3ᵉ jour) : l'ancienne annonce, un 3ᵉ jour non lu, des vues à 0 ne comptent pas ; aucune ⇒ « — » (null), jamais 0 ;
//      jamais le gain d'un autre compte ; la couverture (n) est dite ;
//   E6 rien ne part sans SON toucher : la vue n'appelle `onRepublierUne` que dans un onClick ; l'écran n'appelle le geste
//      dans aucun effet ; les modules n'ouvrent ni n'envoient rien ;
//   E7 la notification : ÉTEINTE par défaut (seul `essouffle === true`), une par jour au plus, mémo écrit AVANT l'envoi
//      (illisible ou pas écrit ⇒ rien), un nombre seul ; l'interrupteur de Réglages suit la même règle ;
//   E8 textes : la phrase de la ligne ≤ 8 mots (5 langues), « — » quand le gain n'est pas su.
//  `--prouve` : chaque mutation rougit.   Lancer : node scripts/audit-essoufflement.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');
const ES = 'src/essoufflement.js', RP = 'src/republierPriorite.js', NO = 'api/_lib/essoufflement-notif.js', VUE = 'src/natif/ecrans/RepublierPriorite.jsx',
  EG = 'src/ecrans/AnnoncesEgalite.jsx', RG = 'src/ecrans/Reglages.jsx', LE = 'src/essoufflementLecture.js';

const MUTATIONS = {
  'trou traversé': [[ES, "if (b.j - a.j !== 1) { arret = 'trou'; break; }", '']],
  'vue à 0 prise pour lue': [[ES, 'const lisible = (p) => p && p.v != null && p.v > 0 && p.f != null;', 'const lisible = (p) => p && p.v != null && p.f != null;']],
  'favori perdu pris pour plat': [[ES, 'if (dv <= ESS.vuesMax && df === ESS.favorisMax) { plats++; continue; }', 'if (dv <= ESS.vuesMax && df <= ESS.favorisMax) { plats++; continue; }']],
  'courbe vieille acceptée': [[ES, "if (auj - z.j > ESS.fraicheur) return { etat: 'passu', raison: 'ancienne', dernier: z.j };", '']],
  'seuil abaissé': [[ES, 'if (plats >= ESS.jours) return', 'if (plats >= 2) return']],
  'courte devenue active': [[ES, "  return { etat: 'passu', raison: arret };\n}", "  return { etat: 'active' };\n}"]],
  'ancienne annonce comptée': [[ES, 'if (pts.some((p) => p.j < jr)) continue;', '']],
  '3e jour deviné': [[ES, 'const p = pts.find((x) => x.j === cible);', 'const p = pts.filter((x) => x.j >= jr).pop();']],
  'gain inventé à 0': [[ES, 'moyenne: n ? Math.round(ech.reduce((t, e) => t + e.vues, 0) / n) : null', 'moyenne: n ? Math.round(ech.reduce((t, e) => t + e.vues, 0) / n) : 0']],
  'paquet raté pris pour lu': [[ES, 'if (!c || !c.lus || !c.lus.has(str(id))) return', 'if (!c) return']],
  'gain d’un autre compte': [[RP, 'const g = gainCompte(C[uid], { maintenant });', 'const g = gainCompte(C[Object.keys(C).sort()[0]], { maintenant });']],
  'exclusion oubliée': [[RP, 'if (raisonE) { exclues[raisonE] += 1; continue; }', '']],
  'réservée oubliée': [[RP, "if (a.annonces.some((y) => y.site === 'vinted' && y.reservee === true)) return 'reservee';", '']],
  'pas en tête': [[RP, '(q.essouffle ? 1 : 0) - (p.essouffle ? 1 : 0)', '0']],
  'gain ignoré au tri': [[RP, '(gainTri(q) - gainTri(p) || q.essouffle.jours - p.essouffle.jours)', '(q.essouffle.jours - p.essouffle.jours)']],
  'en cours dit lu': [[RP, "const C = opts.courbes && typeof opts.courbes === 'object' ? opts.courbes : null;", 'const C = opts.courbes && typeof opts.courbes === \'object\' ? opts.courbes : {};']],
  'notif allumée par défaut': [[NO, "typeof prefs === 'object' && prefs.essouffle === true)", "typeof prefs === 'object' && prefs.essouffle !== false)"]],
  'notif deux fois par jour': [[NO, "if (memo && memo.jour === jour) return { envoye: false, raison: 'déjà aujourd’hui' };", '']],
  'mémo écrit après l’envoi': [[NO, "if (!(await ecrire(MEMO_ESSOUFFLE, { jour, n: k, at: new Date(maintenant).toISOString() }))) return { envoye: false, raison: 'mémo non écrit — rien envoyé' };", 'await ecrire(MEMO_ESSOUFFLE, { jour, n: k, at: new Date(maintenant).toISOString() });']],
  'mémo illisible ignoré': [[NO, "if (memo === undefined) return { envoye: false, raison: 'mémo illisible — rien envoyé' };", '']],
  'interrupteur allumé par défaut': [[RG, 'const on = !!(prefs && prefs.essouffle === true);', 'const on = !(prefs && prefs.essouffle === false);']],
  'republier lancé seul': [[VUE, '  const [reglages, setReglages] = React.useState(false);', '  const [reglages, setReglages] = React.useState(false);\n  React.useEffect(() => { if (onRepublierUne && lignes && lignes[0]) onRepublierUne(lignes[0]); });']],
  'écran lance seul': [[EG, '  const nEss = prio && prio.essouffle', "  React.useEffect(() => { if (prio && prio.liste[0] && prio.liste[0].essouffle) republierPrio({ ids: [prio.liste[0].annonce.id], compte: prio.liste[0].annonce.compte }); }, [prio]);\n  const nEss = prio && prio.essouffle"]],
};

if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0;
const vrai = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 300) : '')); };
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const imp = (f) => import(pathToFileURL(path.join(R, f)).href);
const J = 864e5, NOW = Date.parse('2026-11-28T10:00:00Z');

(async () => {
  const E = await imp(ES), P = await imp(RP), Mo = await imp('src/articles/modele.js');
  const { jourCourbe } = await imp('src/courbeAnnonce.js');
  const AUJ = jourCourbe(NOW);
  // Une courbe : vues/favoris par jour, du plus ancien (AUJ - n + 1) à aujourd'hui ; `null` = jour non lu.
  const courbe = (vf, fin = AUJ) => { const out = []; vf.forEach((x, i) => { if (x) out.push([fin - vf.length + 1 + i, x[0], x[1], 4000, 600]); }); return out; };
  const PLAT = [[100, 3], [100, 3], [101, 3], [101, 3], [102, 3]];               // 4 pas plats
  const PLAT7 = [[90, 2], [90, 2], [91, 2], [91, 2], [91, 2], [92, 2], [92, 2]]; // 6 pas plats
  const o = { maintenant: NOW };
  // ── E1 ──
  const e1 = E.etatCourbe(courbe(PLAT), o), e1b = E.etatCourbe(courbe(PLAT7), o);
  vrai(e1.etat === 'essoufflee' && e1.jours === 4 && e1b.etat === 'essoufflee' && e1b.jours === 6, 'E1 courbe plate ⇒ essoufflée (4 jours, puis 6)', { e1, e1b });
  const e1h = E.etatCourbe(courbe(PLAT, AUJ - 1), o);
  vrai(e1h.etat === 'essoufflee', 'E1 lue hier : encore fraîche ⇒ essoufflée', e1h);
  const deuxNav = E.etatCourbe([...courbe(PLAT), [AUJ, 150, 3, 4000, 300]], o);   // un autre navigateur, plus tôt le même jour
  vrai(deuxNav.etat === 'essoufflee', 'E1 deux lectures le même jour : la plus TARDIVE compte (jamais additionnées)', deuxNav);
  // ── E2 ──
  const trou = E.etatCourbe(courbe([[100, 3], [100, 3], null, [101, 3], [101, 3], [101, 3]]), o);
  vrai(trou.etat === 'passu' && trou.raison === 'trou', 'E2 un jour non lu au milieu ⇒ pas su (jamais interpolé)', trou);
  const vieille = E.etatCourbe(courbe(PLAT, AUJ - 3), o);
  vrai(vieille.etat === 'passu' && vieille.raison === 'ancienne', 'E2 dernier jour lu il y a 3 j ⇒ pas su', vieille);
  const zero = E.etatCourbe(courbe([[0, 3], [0, 3], [0, 3], [0, 3], [0, 3]]), o);
  vrai(zero.etat === 'passu', 'E2 des vues à 0 (Vinted ne donne plus le nombre) ⇒ pas su, jamais « aucune vue »', zero);
  const champ = E.etatCourbe(courbe([[100, null], [100, null], [100, null], [100, null], [100, null]]), o);
  vrai(champ.etat === 'passu' && champ.raison === 'champ', 'E2 favoris pas lus ⇒ pas su', champ);
  const court = E.etatCourbe(courbe([[100, 3], [100, 3], [100, 3], [100, 3]]), o);
  vrai(court.etat === 'passu' && court.raison === 'courte', 'E2 trois pas seulement ⇒ pas su (trop court), jamais « active »', court);
  const vit = E.etatCourbe(courbe([[100, 3], [100, 3], [100, 3], [108, 3], [108, 3]]), o);
  const fav = E.etatCourbe(courbe([[100, 3], [100, 3], [100, 4], [100, 4], [100, 4]]), o);
  const perdu = E.etatCourbe(courbe([[100, 3], [100, 3], [100, 2], [100, 2], [100, 2]]), o);
  vrai(vit.etat === 'active' && fav.etat === 'active' && perdu.etat === 'active', 'E2 8 vues, un favori gagné, ou un favori perdu dans les 4 derniers pas ⇒ pas essoufflée', { vit, fav, perdu });
  vrai(E.etatCourbe([], o).etat === 'passu' && E.etatCourbe(null, o).etat === 'passu', 'E2 aucune courbe ⇒ pas su');
  // ── Le jeu d'articles ──
  const an = (site, id, jours, x = {}) => ({ site, id: String(id), compte: x.compte || '111', pseudo: x.pseudo || 'atelier.nord', titre: x.titre || ('Paire ' + id), photo: null, prix: 40,
    taille: '42', condition: '', depuis: jours == null ? null : NOW - jours * J, favoris: 3, vues: 100, messages: null, etat: x.etat || 'enligne', numero: x.numero || '', vintedId: '', url: '', reservee: !!x.reservee });
  const MEME = Array.from({ length: 50 }, (_, i) => an('vinted', 9000 + i, 12, { titre: 'Nike Air Force 1 blanche taille 42', compte: '222', pseudo: 'deux' }));
  const ANN = [
    an('vinted', 1001, 10),                                     // jeune (10 j), plate ⇒ essoufflée, compte 111 (gain connu)
    an('vinted', 1002, 45),                                     // vieille, plate ⇒ essoufflée
    an('vinted', 1003, 40),                                     // vieille, vit ⇒ « Dorment » seulement
    an('vinted', 1004, 12, { numero: '4' }), an('leboncoin', 'lb4', 3, { etat: 'vendue', numero: '4', compte: 'lbc' }),  // vendue ailleurs
    an('vinted', 1005, 12, { reservee: true }),                 // réservée
    an('vinted', 1006, 12, { compte: '333' }),                  // compte personnel
    an('vinted', 1007, 12),                                     // plate mais son paquet n'a pas été lu ⇒ pas su
    an('vinted', 1008, 12),                                     // trou ⇒ pas su
    an('vinted', 1009, 12, { compte: '444', pseudo: 'quatre' }),  // plate, compte 444 SANS republication ⇒ gain « — »
    ...MEME,
  ];
  const { articles } = Mo.construireArticles({ annonces: ANN, fiches: {}, aVinted: true });
  // Les lignes de courbes (un navigateur chacune), et SES republications passées (repère « r »).
  const jr = AUJ - 20;
  const pts = (ids, c) => Object.fromEntries(ids.map((id) => [String(id), c]));
  const rows = [
    { id: 'courbes_annonces_111_navA', a: { ...pts([1001, 1002, 1004, 1005, 1007], courbe(PLAT)), '1003': courbe([[100, 3], [104, 3], [110, 4], [117, 5], [125, 5]]), '1008': courbe([[100, 3], null, [100, 3], [100, 3], [100, 3]]),
        // republication 1 : l'ancienne 2001 (lue avant), la nouvelle 2002 (lue à partir du jour du repère, 12 vues au 3e jour)
        '2001': [[jr - 2, 50, 1, 4000, 600], [jr - 1, 50, 1, 4000, 600], [jr, 50, 1, 4000, 500]],
        '2002': [[jr, 2, 0, 4000, 700], [jr + 1, 5, 0, 4000, 700], [jr + 2, 9, 0, 4000, 700], [jr + 3, 12, 0, 4000, 700]],
        // republication 2 : la nouvelle 2004, 20 vues au 3e jour
        '2004': [[jr + 5, 4, 0, 4000, 700], [jr + 8, 20, 1, 4000, 700]],
        // republication 3 : la nouvelle 2006, 3e jour NON lu (lue au 2e et au 4e) ⇒ pas comptée
        '2006': [[jr + 10, 1, 0, 4000, 700], [jr + 12, 9, 0, 4000, 700], [jr + 14, 15, 0, 4000, 700]],
        // republication 4 : la nouvelle 2008, vues à 0 au 3e jour (pas su) ⇒ pas comptée
        '2008': [[jr + 11, 0, 0, 4000, 700], [jr + 14, 0, 2, 4000, 700]],
        // « modifiée » sur place (repère « r », la MÊME annonce, lue avant) : 400 vues cumulées au 3e jour ⇒ jamais un gain
        '2010': [[jr + 13, 396, 4, 4000, 700], [jr + 14, 397, 4, 4000, 700], [jr + 15, 398, 4, 4000, 700], [jr + 18, 400, 4, 4000, 700]] },
      ev: { '2001': [[jr, 'r']], '2002': [[jr, 'r']], '2004': [[jr + 5, 'r']], '2006': [[jr + 10, 'r']], '2008': [[jr + 11, 'r']], '2010': [[jr + 15, 'r']] } },
    { id: 'courbes_annonces_222_navA', a: pts(MEME.map((x) => x.id), courbe(PLAT)), ev: {} },
    // Le compte 444 : AUCUNE republication ; mais le 999 (un autre vendeur ? un autre compte) en a une à 300 vues.
    { id: 'courbes_annonces_333_navA', a: { '1006': courbe(PLAT) }, ev: {} },
    { id: 'courbes_annonces_444_navB', a: { '1009': courbe(PLAT) }, ev: {} },
    { id: 'courbes_annonces_999_navA', a: { '3002': [[jr, 1, 0, 4000, 700], [jr + 3, 300, 9, 4000, 700]] }, ev: { '3002': [[jr, 'r']] } },
  ];
  const lus = { '111': ['1001', '1002', '1003', '1004', '1005', '1006', '1008', '2001', '2002', '2004', '2006', '2008', '2010'], '222': MEME.map((x) => x.id), '333': ['1006'], '444': ['1009'], '999': ['3002'] };   // 1007 : paquet raté
  const C = E.courbesParCompte(rows, lus);
  // ── E5 ──
  const g111 = E.gainCompte(C['111'], o), g444 = E.gainCompte(C['444'], o), g999 = E.gainCompte(C['999'], o);
  vrai(g111.n === 2 && g111.moyenne === 16 && g111.echantillons.map((e) => e.id).join() === '2002,2004', 'E5 compte 111 : la moyenne de SES 2 republications mesurées (12 et 20 ⇒ +16), d’après 2', g111);
  vrai(!g111.echantillons.some((e) => e.id === '2001' || e.id === '2010'), 'E5 l’ANCIENNE annonce, ou une annonce modifiée sur place (lues avant le repère), n’est jamais un gain', g111.echantillons);
  vrai(!g111.echantillons.some((e) => e.id === '2006' || e.id === '2008'), 'E5 un 3ᵉ jour non lu, ou des vues à 0, ne comptent pas (jamais devinés)', g111.echantillons);
  vrai(g444.n === 0 && g444.moyenne === null && g999.moyenne === 300, 'E5 compte sans republication ⇒ moyenne null (« — »), jamais 0', { g444, g999 });
  // ── E3 / E4 ──
  const opts = { maintenant: NOW, parJour: 50, comptesPersonnels: new Set(['333']), courbes: C };
  const r = P.republierEnPriorite(articles, opts);
  const ids = r.classees.map((l) => l.annonce.id);
  const essIds = r.classees.filter((l) => l.essouffle).map((l) => l.annonce.id);
  vrai(r.essouffle.etat === 'lu' && r.essouffle.n === 53, 'E3 53 essoufflées proposables (1001, 1002, 1009 + 50)', r.essouffle);
  vrai(!ids.includes('1004') && !ids.includes('1005') && !ids.includes('1006') && r.exclues.vendue === 1 && r.exclues.reservee === 1 && r.exclues.perso === 1,
    'E3 vendue ailleurs, réservée, compte personnel ⇒ jamais proposées, chacune COMPTÉE', r.exclues);
  vrai(!essIds.includes('1007') && !essIds.includes('1008') && r.essouffle.passu === 2, 'E3 paquet raté (1007) et trou (1008) ⇒ pas su, comptés (2), jamais essoufflées', { essIds: essIds.slice(0, 5), passu: r.essouffle.passu });
  vrai(!essIds.includes('1003') && ids.includes('1003'), 'E3 1003 vit encore : pas essoufflée, mais reste dans « Dorment » (40 j)');
  vrai(ids.slice(0, 2).join() === '1002,1001', 'E4 en TÊTE : les essoufflées du compte au gain connu (+16), même la jeune (10 j), la plus longue à plat d’abord puis l’identité', ids.slice(0, 4));
  const iDort = ids.indexOf('1003'), iDer = Math.max(...essIds.map((x) => ids.indexOf(x)));
  vrai(iDer < iDort, 'E4 toutes les essoufflées passent devant les autres paires', { iDer, iDort });
  const i444 = ids.indexOf('1009'), iMeme = ids.indexOf('9000');
  vrai(i444 > 1 && iMeme > 1, 'E4 gain inconnu (« — ») ⇒ après les comptes au gain connu', { i444, iMeme });
  const l1001 = r.classees.find((l) => l.annonce.id === '1001'), l1009 = r.classees.find((l) => l.annonce.id === '1009');
  vrai(l1001 && l1001.gain && l1001.gain.moyenne === 16 && l1001.gain.n === 2 && l1001.essouffle.jours === 4, 'E5 la ligne porte le gain de SON compte (+16, d’après 2) et ses jours à plat', l1001 && { g: l1001.gain, e: l1001.essouffle });
  vrai(l1009 && l1009.gain && l1009.gain.moyenne === null && l1009.gain.n === 0, 'E5 compte 444 : gain « — » — jamais celui du compte 999 (+300)', l1009 && l1009.gain);
  const meme = r.classees.filter((l) => /^90\d\d$/.test(l.annonce.id));
  vrai(meme.length === 50 && new Set(meme.map((l) => l.cle)).size === 50, 'E4 50 annonces au même titre ⇒ 50 lignes, 50 identités', meme.length);
  const rEnCours = P.republierEnPriorite(articles, { ...opts, courbes: undefined }), rRate = P.republierEnPriorite(articles, { ...opts, courbes: null });
  vrai(rEnCours.essouffle.etat === 'lecture' && rEnCours.essouffle.n === 0 && !rEnCours.classees.some((l) => l.essouffle) && rRate.essouffle.etat === 'passu' && rRate.essouffle.n === 0,
    'E3 courbes en cours ⇒ « lecture », ratées ⇒ « passu » : personne n’est dit essoufflé', { a: rEnCours.essouffle, b: rRate.essouffle });
  vrai(E.courbesParCompte(undefined) === undefined && E.courbesParCompte(null) === null, 'E3 lecture en cours / ratée rendue telle quelle (jamais {})');
  // ── E6 ──
  const vue = sansCommentaires(lire(VUE)), eg = sansCommentaires(lire(EG));
  const appels = vue.match(/onRepublierUne\(/g) || [];
  vrai(appels.length === 1 && /onClick: \(\) => onRepublierUne\(l\)/.test(vue) && !/useEffect\([^;]*onRepublierUne/.test(vue), 'E6 la vue n’appelle « Republier » d’une essoufflée QUE dans son onClick', appels.length);
  vrai(/onRepublierUne=\{\(l\) => republierPrio\(\{ ids: \[l\.annonce\.id\], compte: l\.annonce\.compte \}\)\}/.test(eg) && !/useEffect\([^;]*republierPrio/.test(eg) && !/setTimeout\([^;]*republierPrio/.test(eg),
    'E6 l’écran : « Republier » = le geste existant (SA confirmation, l’atelier sinon), jamais dans un effet ni un minuteur');
  for (const f of [ES, LE]) vrai(!/ouvrirPanneau|republierDansApp|vmrCmd|window\.open|method:\s*'(POST|PATCH|DELETE)'/.test(sansCommentaires(lire(f))), `E6 ${f} n’ouvre rien, n’écrit rien, n’envoie rien`);
  vrai(/select=id,ev:data->ev/.test(lire(LE)) && !/select=data\b/.test(lire(LE)), 'E6 la lecture est PROJETÉE (repères, puis points par annonce) — jamais la ligne entière');
  // ── E7 ──
  const N = await imp(NO);
  const run = async ({ prefs = {}, memo = null, memoPasSu = false, ecrireKo = false, n = 3 } = {}) => {
    const ecrits = [], envois = [];
    const res = await N.notifierEssoufflees({ n, prefs: async () => prefs, getRow: async () => (memoPasSu ? undefined : memo), ecrire: async (id, data) => { ecrits.push({ id, data, avant: envois.length === 0 }); return !ecrireKo; },
      pousser: async (x) => { envois.push(x); return { sent: 1 }; }, maintenant: NOW });
    return { res, ecrits, envois };
  };
  let x = await run({ prefs: {} });
  const xNull = await run({ prefs: null });
  vrai(!x.res.envoye && x.envois.length === 0 && !xNull.res.envoye, 'E7 réglage jamais posé ⇒ ÉTEINTE (rien ne sonne)', x.res);
  x = await run({ prefs: { essouffle: true } });
  vrai(x.res.envoye && x.envois.length === 1 && x.envois[0].title === '3 annonces s’essoufflent' && x.envois[0].cat === 'essouffle' && /tab=annonces&vue=arepublier/.test(x.envois[0].url),
    'E7 allumée ⇒ « 3 annonces s’essoufflent », famille Rappels, ouvre « À republier »', x.envois[0]);
  vrai(x.ecrits.length === 1 && x.ecrits[0].avant && x.ecrits[0].id === 'vrm_essouffle_dit', 'E7 le mémo du jour est écrit AVANT d’envoyer', x.ecrits);
  const memo = x.ecrits[0] && x.ecrits[0].data;
  x = await run({ prefs: { essouffle: true }, memo });
  vrai(!x.res.envoye && x.envois.length === 0, 'E7 le même jour, une seconde fois ⇒ rien (une par jour au plus)', x.res);
  x = await run({ prefs: { essouffle: true }, memo: { jour: '2026-11-27' } });
  vrai(x.res.envoye, 'E7 le lendemain ⇒ elle peut sonner à nouveau', x.res);
  x = await run({ prefs: { essouffle: true }, memoPasSu: true });
  const xKo = await run({ prefs: { essouffle: true }, ecrireKo: true });
  vrai(!x.res.envoye && !xKo.res.envoye && x.envois.length + xKo.envois.length === 0, 'E7 mémo illisible ou pas écrit ⇒ rien envoyé', { a: x.res, b: xKo.res });
  x = await run({ prefs: { essouffle: true }, n: 0 });
  vrai(!x.res.envoye, 'E7 zéro annonce ⇒ rien', x.res);
  const rg = sansCommentaires(lire(RG));
  vrai(/const on = !!\(prefs && prefs\.essouffle === true\);/.test(rg) && /essouffle: !on/.test(rg), 'E7 Réglages → Notifications : l’interrupteur, éteint tant qu’il ne l’a pas allumé');
  vrai(/body: JSON\.stringify\(\{ action: 'essouffle', n: nEss \}\)/.test(eg) && /localStorage\.getItem\(cleJ\) === jour/.test(eg), 'E7 l’écran ne donne que le NOMBRE, au plus une fois par jour et par appareil');
  // ── E8 ──
  for (const l of ['fr', 'en', 'es', 'it', 'de']) {
    const d = (await imp(`src/i18n/langues/${l}/essouffle.js`)).default;
    const ph = d['ess.ligne'].other.replace('{n}', '5').split(/\s+/).length;
    vrai(ph <= 8 && /—/.test(d['ess.gainPasSu']) && /—/.test(d['ess.pasSu']), `E8 ${l} : « ${d['ess.ligne'].other.replace('{n}', '5')} » (${ph} mots), le gain pas su dit « — »`);
  }
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ audit-essoufflement : tout vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
}
