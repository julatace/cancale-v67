// ════════════════════════════════════════════════════════════════════════════
//  LE PLAN DU MATIN DES PAIRES QUI DORMENT (24 nov.) — EXÉCUTÉ
//  docs/passation/2026-11-24-paires-dorment.md · règle : src/conseiller/planDorment.js · gestes : src/conseiller/planGestes.js
//
//  Sur des annonces INVENTÉES (dépôt public) à la FORME réelle des lignes que bâtit Annonces (`planMatin`,
//  src/ecrans/Comptabilite.jsx, depuis `mapWardrobeItem` : prix en texte « 45.0 », vues `null` quand Vinted rend 0,
//  favoris lus, âge en jours, identifiant d'annonce en chiffres, compte Vinted) :
//    A  « pas su » n'est JAMAIS « dort » : âge, vues ou favoris pas lus ⇒ hors du plan, comptés à part, hors quartile ;
//    B  une baisse n'est JAMAIS sous le plancher (achat + 10 %, achat + frais, prix mini), jamais plus de −10 %, jamais
//       sans prix d'achat, jamais avant 30 j ni dans les 14 j d'une baisse ; les baisses varient d'une paire à l'autre ;
//    C  UNE action par paire, une ligne par paire, 8 au plus ;
//    D  identité : compte + identifiant d'annonce ; 50 paires au même titre = 50 lignes ; sans identifiant ⇒ dehors ;
//    E  les seuils viennent des données (le quart le plus bas) ; trop peu d'annonces ⇒ « peu », aucun seuil deviné ;
//    F  le geste : le chemin gardé existant (panneau sur CETTE annonce) ; la porte qui dit non ⇒ rien ;
//    G  l'app : Annonces publie le plan, le Conseiller le lit et le montre, 5 langues.
//  `--prouve` : chaque mutation de la règle doit faire rougir au moins un contrôle.
//  `--racine <dir>` : jouer l'audit sur un autre arbre (git archive de origin/main : rouge attendu).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const iR = process.argv.indexOf('--racine');
const R = iR > 0 ? path.resolve(process.argv[iR + 1]) : path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');

const JOUR = 86400000;
const MAINTENANT = Date.UTC(2026, 10, 24, 7, 0, 0);
// Une ligne à la forme de `planMatin` (Comptabilite.jsx).
const ligne = (i, o = {}) => ({ id: String(7300000000 + i), uid: '3100000001', compte: 'compte_test', numero: String(i + 1), photo: `https://images.example/f${i}.jpg`,
  prix: `${40 + (i % 30)}.0`, age: 14 + (i % 9), vues: 20 + i * 2, favoris: 1 + (i % 6), achat: 20, plancherVente: null, mini: null, derniereBaisse: null,
  surLbc: false, surVc: null, surEbay: null, ...o });

async function controles(SRC, parler) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (parler) console.log((c ? 'OK  ' : 'KO  ') + m + (d && !c ? ' — ' + d : '')); };
  const charge = async (f) => { try { return await import(pathToFileURL(path.join(SRC, f)).href + '?v=' + Math.random()); } catch (e) { dit(false, `src/${f} se charge`, e.message); return null; } };
  const M = await charge('conseiller/planDorment.js');
  const G = await charge('conseiller/planGestes.js');
  if (!M) return ko;
  const plan = (L, ctx = {}) => { try { return M.planDuMatin(L, { bloque: {}, sites: ['leboncoin', 'ebay', 'vestiaire'], maintenant: MAINTENANT, ...ctx }); } catch (e) { return { etat: 'leve', lignes: [], err: e.message }; } };
  const base = Array.from({ length: 24 }, (_, i) => ligne(i));

  // ── A : « pas su » n'est jamais « dort » ───────────────────────────────────
  {
    // Des paires TRÈS vieilles, les pires chiffres possibles… mais un compteur pas lu.
    const pasSu = [ligne(100, { vues: null, favoris: 0, age: 90 }), ligne(101, { favoris: null, vues: 1, age: 90 }), ligne(102, { age: null, vues: 1, favoris: 0 }),
      ligne(103, { vues: '', favoris: 0, age: 90 }), ligne(104, { vues: 1, favoris: true, age: 90 })];
    const P = plan([...base, ...pasSu]);
    const ids = new Set(P.lignes.map((l) => l.id));
    dit(pasSu.every((l) => !ids.has(l.id)), 'A1 vues / favoris / âge pas lus ⇒ jamais dans le plan', JSON.stringify(P.lignes.map((l) => l.id)));
    dit(P.passu === 5, 'A2 ces 5 paires sont comptées « pas su » (à part)', String(P.passu));
    const S0 = M.seuilsDormir(base), S1 = M.seuilsDormir([...base, ...pasSu]);
    dit(S0.etat === 'su' && S1.n === S0.n && S1.vuesJour === S0.vuesJour, 'A3 une ligne pas lue n’entre dans aucun quartile', `${S0.n}/${S1.n}`);
    dit(M.etatLigne(ligne(1, { vues: null, age: 60 }), S0) === 'passu', 'A4 etatLigne(vues pas lues) = passu');
    const Pk = plan(base.map((l) => ({ ...l, vues: null })));
    dit(Pk.lignes.length === 0 && Pk.etat !== 'su', 'A5 aucune vue lue ⇒ aucun plan, aucun seuil', Pk.etat);
  }

  // ── B : la baisse, dans SES bornes ─────────────────────────────────────────
  {
    let sous = 0, trop = 0, n = 0, sansAchat = 0, pcts = new Set();
    for (let i = 0; i < 400; i++) {
      const prix = 15 + (i * 7.3) % 180, achat = 5 + (i * 3.1) % 120, pv = i % 3 === 0 ? Math.round((achat + 4.5) * 100) : null, mini = i % 4 === 0 ? (achat + 15).toFixed(2) : null;
      const b = M.baisseProposee({ id: String(7300000000 + i), prix: prix.toFixed(1), age: 45, achat, plancherVente: pv, mini, maintenant: MAINTENANT });
      if (b.sugg == null) continue;
      n++;
      const pl = Math.max(Math.ceil(achat * 1.1 - 1e-9), pv != null ? pv / 100 : 0, mini != null ? Number(mini) : 0);
      if (b.sugg + 1e-9 < pl) sous++;
      if (b.sugg + 1e-9 < Math.round(prix * 10) / 10 * 0.9 - 0.001) trop++;
      pcts.add(b.pct);
    }
    dit(n > 100 && sous === 0, 'B1 jamais sous le plancher (achat + 10 %, achat + frais, prix mini) — 400 cas', `${sous}/${n}`);
    dit(trop === 0, 'B2 jamais plus de −10 %', String(trop));
    for (const a of [null, '', undefined]) if (M.baisseProposee({ id: '7300000001', prix: '80.0', age: 60, achat: a, maintenant: MAINTENANT }).sugg != null) sansAchat++;
    dit(sansAchat === 0, 'B3 prix d’achat pas saisi ⇒ aucune baisse');
    dit(M.baisseProposee({ id: '7300000001', prix: '80.0', age: 29, achat: 20, maintenant: MAINTENANT }).sugg == null, 'B4 moins de 30 j ⇒ aucune baisse (règle du 12 nov.)');
    dit(M.baisseProposee({ id: '7300000001', prix: '80.0', age: 60, achat: 20, derniereBaisse: MAINTENANT - 5 * JOUR, maintenant: MAINTENANT }).sugg == null, 'B5 baisse lue il y a 5 j ⇒ aucune (14 j)');
    dit(M.baisseProposee({ id: '7300000001', prix: '22.5', age: 60, achat: 20, maintenant: MAINTENANT }).sugg == null, 'B6 déjà à son plancher ⇒ aucune baisse');
    dit(pcts.size >= 20, 'B7 baisses irrégulières : le pourcentage varie d’une paire à l’autre', String(pcts.size));
    const ps = Array.from({ length: 50 }, (_, i) => M.pctDe(String(7300000000 + i)));
    dit(ps.every((p) => p >= 6 && p <= 10) && M.pctDe('7300000001') === M.pctDe('7300000001'), 'B8 entre 6 et 10 %, stable pour une même paire');
    // Dans le plan : une paire vue sans favori, vieille, achat connu ⇒ « Baisser à X € » au-dessus de son prix mini.
    const L = [...base, ligne(200, { age: 40, vues: 400, favoris: 0, prix: '90.0', achat: 30, mini: '85.00' }), ligne(201, { age: 40, vues: 400, favoris: 0, prix: '90.0', achat: 30 })];
    const S = M.seuilsDormir(L), ctx = { bloque: {}, sites: [], maintenant: MAINTENANT };
    const a200 = { action: M.actionPour(L[L.length - 2], S, ctx) }, a201 = { action: M.actionPour(L[L.length - 1], S, ctx) };
    dit(a201 && a201.action.k === 'baisser' && a201.action.sugg >= 33 && a201.action.sugg < 90, 'B9 vue sans favori ⇒ une baisse dans ses bornes', JSON.stringify(a201 && a201.action));
    dit(a200 && a200.action.k === 'baisser' && a200.action.sugg >= 85, 'B10 jamais sous SON prix mini', JSON.stringify(a200 && a200.action));
  }

  // ── C : une action par paire, ≤ 8 ──────────────────────────────────────────
  {
    const L = Array.from({ length: 60 }, (_, i) => ligne(i, { vues: i < 30 ? 3 + i : 300 + i, favoris: i % 4 }));
    const P = plan(L);
    const K = new Set(['baisser', 'favoris', 'republier', 'prix', 'lbc', 'vestiaire', 'ebay']);
    dit(P.lignes.length > 0 && P.lignes.length <= M.MAX_PLAN && M.MAX_PLAN <= 10, 'C1 une courte liste (≤ 8)', String(P.lignes.length));
    dit(P.lignes.every((l) => l.action && typeof l.action === 'object' && !Array.isArray(l.action) && K.has(l.action.k)), 'C2 chaque paire porte UNE action, connue');
    dit(new Set(P.lignes.map((l) => l.cle)).size === P.lignes.length, 'C3 une paire n’apparaît qu’une fois');
    const peu = plan(L, {}).lignes.filter((l) => l.action.pourquoi === 'vues');
    dit(peu.length > 0 && peu.every((l) => l.action.k === 'republier'), 'C4 peu vue ⇒ republier', JSON.stringify(peu.map((l) => l.action.k)));
    const bl = plan(L, { bloque: { republier: 'ext' } }).lignes.filter((l) => l.action.pourquoi === 'vues');
    dit(bl.length > 0 && bl.every((l) => ['lbc', 'ebay', 'vestiaire', 'republier'].includes(l.action.k)) && bl.some((l) => l.action.k === 'lbc'), 'C5 republier bloqué ⇒ un autre de SES sites où elle n’est pas', JSON.stringify(bl.map((l) => l.action.k)));
    const surLbcPasSu = plan(L.map((l) => ({ ...l, surLbc: null })), { bloque: { republier: 'ext' }, sites: ['leboncoin'] }).lignes.filter((l) => l.action.pourquoi === 'vues');
    dit(surLbcPasSu.every((l) => l.action.k !== 'lbc'), 'C6 « déjà sur Leboncoin ? » pas su ⇒ Leboncoin pas proposé');
    const sansSites = plan(L, { bloque: { republier: 'ext' }, sites: null }).lignes.filter((l) => l.action.pourquoi === 'vues');
    dit(sansSites.every((l) => l.action.k === 'republier' && l.action.bloque), 'C7 sites pas sus ⇒ aucun autre site ; le geste bloqué dit pourquoi');
    const LF = [...base, ligne(700, { age: 22, vues: 300, favoris: 1 }), ligne(701, { age: 21, vues: 280, favoris: 1 })];
    const S = M.seuilsDormir(LF);
    const fav = LF.filter((l) => l.favoris > 0 && M.etatLigne(l, S) === 'dort' && l.vues / l.age > S.vuesJour).map((l) => ({ action: M.actionPour(l, S, { bloque: {}, sites: [] }) }));
    dit(fav.length > 0 && fav.every((l) => l.action.k === 'favoris'), 'C8 des favoris sans vente ⇒ offre aux favoris');
    dit(P.lignes.every((l) => l.action.effet == null), 'C9 aucun effet promis (pas mesurable dans son historique)');
  }

  // ── D : identité par identifiant d'annonce ─────────────────────────────────
  {
    const memes = Array.from({ length: 50 }, (_, i) => ({ ...ligne(i), titre: 'Nike Air Max 90 — 42', vues: 5, favoris: 0, age: 20, prix: '50.0' }));
    const L = [...memes, ...Array.from({ length: 20 }, (_, i) => ligne(300 + i, { vues: 500, favoris: 9 }))];
    const S = M.seuilsDormir(L);
    let n = 0; for (const l of memes) if (M.etatLigne(l, S) === 'dort') n++;
    const P = plan(L);
    dit(n === 50 && P.dorment >= 50 && new Set(P.lignes.map((l) => l.id)).size === P.lignes.length, 'D1 50 paires au même titre = 50 paires distinctes', `${n} ${P.dorment}`);
    dit(P.lignes.every((l) => !('titre' in l)), 'D2 le titre ne sort jamais du plan (identité ≠ titre)');
    const sansId = plan([...base, ligne(400, { id: 'Nike Air Max', vues: 1, favoris: 0, age: 60 }), ligne(401, { id: '', vues: 1, favoris: 0, age: 60 }), ligne(402, { id: null, vues: 1, favoris: 0, age: 60 })]);
    dit(sansId.lignes.every((l) => /^\d+$/.test(l.id)) && sansId.total === base.length, 'D3 sans identifiant lisible ⇒ hors du plan');
    const deux = plan([...base, ligne(500, { uid: '3100000001', vues: 1, favoris: 0 }), ligne(500, { uid: '3100000002', vues: 1, favoris: 0 }), ligne(500, { uid: '3100000002', vues: 1, favoris: 0 })]);
    const c = deux.lignes.filter((l) => l.id === String(7300000500)).map((l) => l.cle).sort();
    dit(c.length === 2 && c[0] !== c[1], 'D4 même identifiant sur deux comptes : deux lignes ; le même deux fois : une', JSON.stringify(c));
  }

  // ── E : les seuils viennent des données ────────────────────────────────────
  {
    const S = M.seuilsDormir(base);
    const vj = base.map((l) => l.vues / l.age).sort((a, b) => a - b);
    const q = M.quantile(vj, 0.25);
    dit(S.etat === 'su' && Math.abs(S.vuesJour - q) < 1e-9, 'E1 « peu vue » = le quart le plus bas de SES annonces de 14 j et plus');
    const S2 = M.seuilsDormir(base.map((l) => ({ ...l, vues: l.vues * 10 })));
    dit(S2.vuesJour > S.vuesJour * 9, 'E2 le seuil suit ses chiffres (aucun nombre fixe)');
    const peu = plan(base.slice(0, M.POP_MIN - 1));
    dit(peu.etat === 'peu' && peu.lignes.length === 0, 'E3 moins de 8 annonces comparables ⇒ « pas assez de recul », aucun plan', peu.etat);
    const jeunes = plan([...base, ligne(600, { age: 5, vues: 1, favoris: 0 })]);
    dit(!jeunes.lignes.some((l) => l.id === String(7300000600)) && jeunes.jeunes === 1, 'E4 moins de 14 j ⇒ pas « dort » (elle n’a pas eu sa chance)');
    dit(M.AGE_MIN_J === 14 && M.QUARTILE === 0.25 && M.POP_MIN === 8, 'E5 les constantes mesurées (14 j, quart, 8)');
  }

  // ── F : le geste ───────────────────────────────────────────────────────────
  if (G) {
    const appels = [];
    const ouvrir = (o) => { appels.push(o); return 'ok'; };
    const l = (k) => ({ id: '7300000001', uid: '3100000001', action: { k } });
    for (const k of ['baisser', 'favoris', 'republier', 'prix', 'lbc', 'vestiaire']) G.agirPlan(l(k), { ouvrir });
    let ebay = null; G.agirPlan(l('ebay'), { ouvrir, onEbay: (id) => { ebay = id; } });
    dit(appels.length === 6 && appels.every((a) => a.ids.length === 1 && a.ids[0] === '7300000001'), 'F1 chaque geste vise CETTE annonce (son identifiant), une seule');
    dit(appels[0].site === 'vinted' && appels[0].page === 'prix' && appels[0].action === 'baisser', 'F2 « Baisser » ⇒ la page prix du panneau (le chemin baisseprix, 45/h)', JSON.stringify(appels[0]));
    dit(appels[1].page === 'favoris' && appels[2].page === 'republier' && appels[4].site === 'leboncoin' && appels[5].site === 'vestiaire' && ebay === '7300000001', 'F3 favoris · republier · Leboncoin · Vestiaire · eBay par leurs chemins existants');
    const non = { agirMaintenant: () => ({ ok: false, cle: 'agir.raison.pas-vu', vars: {} }) }, oui = { agirMaintenant: () => ({ ok: true }) };
    dit(G.verdictPlan(l('baisser'), non).ok === false && G.verdictPlan(l('baisser'), oui).ok === true, 'F4 la porte dit non (compte pas connecté) ⇒ bouton éteint');
    let vu = null; G.verdictPlan(l('republier'), { agirMaintenant: (s, c, g) => { vu = [s, c, g]; return { ok: true }; } });
    dit(vu && vu[0] === 'vinted' && vu[1] === '3100000001' && vu[2] === 'republier', 'F5 la porte reçoit le COMPTE de la paire et le geste', JSON.stringify(vu));
  }
  return ko;
}

function cablage(parler) {
  let ko = 0;
  const dit = (c, m) => { if (!c) ko++; if (parler) console.log((c ? 'OK  ' : 'KO  ') + m); };
  const cpt = sansCommentaires(lire('src/ecrans/Comptabilite.jsx'));
  dit(/planDuMatin\(lignes/.test(cpt) && /annBase\.map\(\(it\) =>/.test(cpt) && /publierPlan\(planMatin/.test(cpt), 'G1 Annonces bâtit le plan sur `annBase` (en ligne) et le publie');
  dit(/vues: Number\.isFinite\(it\.views\) \? it\.views : null/.test(cpt) && /surLbc: lbcAussi\.has\(id\) \? true : \(lbcPostedLu \? false : null\)/.test(cpt), 'G2 vues et « déjà sur Leboncoin » : pas lus ⇒ null');
  const src = sansCommentaires(lire('src/conseiller/sources.js'));
  dit(/lirePub\(CLE_PUB_PLAN, uid\)/.test(src), 'G3 le Conseiller lit le plan de SON compte VRM');
  const br = sansCommentaires(lire('src/conseiller/Branche.jsx'));
  dit(/<PlanDuMatin /.test(br) && /agirPlan\(l/.test(br) && /verdictPorte\(l, PORTE/.test(br), 'G4 l’écran Conseiller montre le plan, chaque toucher passe par agirPlan et la porte');
  dit(!/fetch\(|save\(|localStorage\.setItem/.test(sansCommentaires(lire('src/conseiller/PlanDorment.jsx')) + sansCommentaires(lire('src/conseiller/planGestes.js')) + sansCommentaires(lire('src/conseiller/planDorment.js'))), 'G5 rien n’est lu ni écrit par le plan ni par ses gestes');
  const pd = lire('src/conseiller/PlanDorment.jsx');
  const cles = [...new Set([...pd.matchAll(/tr\('(cplan\.[\w.]+)'/g)].map((m) => m[1]).filter((k) => !k.endsWith('.')))];
  const dyn = ['cplan.a.favoris', 'cplan.a.republier', 'cplan.a.prix', 'cplan.r.vues', 'cplan.r.favoris', 'cplan.r.sansFavoris'];
  for (const lg of ['fr', 'en', 'es', 'it', 'de']) {
    const t = lire(`src/i18n/langues/${lg}/conseiller.js`);
    const manque = [...cles, ...dyn].filter((k) => !t.includes(`"${k}"`));
    dit(cles.length > 8 && !manque.length, `G6 ${lg} : toutes les phrases du plan (${cles.length + dyn.length})${manque.length ? ' — manque ' + manque.join(', ') : ''}`);
  }
  dit(!/#(?:f[0-9a-f]{2}[0-9a-f]00|ff8|ffa|f97316|fb923c)/i.test(lire('src/conseiller/conseiller.css').split('(24 nov.) Plan du matin')[1] || 'x') && /\.n-plan-pied/.test(lire('src/conseiller/conseiller.css')), 'G7 aucun orange dans le style du plan');
  return ko;
}

// Les mutations : chacune doit faire rougir au moins un contrôle.
const MUTATIONS = [
  ['pas su compté comme dort', "if (m.vj == null || m.fj == null) return 'passu';", ''],
  ['plancher retiré', 'if (s < pl) s = pl;', ''],
  ['achat inconnu toléré', 'if (pc == null) return null;', 'if (pc == null) return 0;'],
  ['prix mini ignoré', 'const mi = centimes(mini); if (mi != null && mi > p) p = mi;', ''],
  ['identité par n’importe quoi', "const idOk = (id) => /^\\d{1,20}$/.test(String(id == null ? '' : id));", 'const idOk = () => true;'],
  ['doublons gardés', 'if (vus.has(k)) continue; ', ''],
  ['liste sans plafond', 'if (out.length >= MAX_PLAN) break;', ''],
  ['14 j entre deux baisses oubliés', "return { sugg: null, pourquoi: 'baisse-recente' };", "{}"],
  ['baisse toujours au même %', 'let h = 2166136261;', 'return BAISSE_MAX_PCT; let h = 2166136261;'],
  ['baisse avant 30 j', 'a < AGE_BAISSE_J', 'a < 0'],
  ['seuil fixe', 'vuesJour: quantile(P.map((m) => m.vj), QUARTILE)', 'vuesJour: 1000'],
  ['pas assez de recul ignoré', 'if (P.length < POP_MIN)', 'if (P.length < 0)'],
  ['jeunes comptées', 'if (m.age < AGE_MIN_J) return \'jeune\';', ''],
  ['site pas su proposé', '&& l[champ] === false)', '&& l[champ] !== true)'],
];
const MUT_GESTES = [
  ['geste sur toutes les annonces', 'ids = [String(l.id)]', 'ids = [String(l.id), \'*\']'],
  ['porte ignorée', "return v && v.ok ? { ok: true }", 'return true ? { ok: true }'],
];

(async () => {
  const SRC = path.join(R, 'src');
  console.log('— Plan du matin des paires qui dorment —');
  let ko = await controles(SRC, true);
  ko += cablage(true);
  if (PROUVE) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-dorment-'));
    try {
      const copie = (f) => { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.copyFileSync(path.join(SRC, f), path.join(tmp, f)); };
      for (const f of ['conseiller/planDorment.js', 'conseiller/planGestes.js', 'conseilPrix.js', 'ouvrirPanneau.js', 'actionsExtension.js']) copie(f);
      const orig = { p: fs.readFileSync(path.join(tmp, 'conseiller/planDorment.js'), 'utf8'), g: fs.readFileSync(path.join(tmp, 'conseiller/planGestes.js'), 'utf8') };
      let rates = 0;
      if (ko) { console.log('KO  la base n’est pas verte : les mutations ne prouvent rien'); rates++; }
      for (const [nom, a, b, quoi] of [...MUTATIONS.map((m) => [...m, 'p']), ...MUT_GESTES.map((m) => [...m, 'g'])]) {
        const f = quoi === 'p' ? 'conseiller/planDorment.js' : 'conseiller/planGestes.js';
        const s = orig[quoi];
        if (!s.includes(a)) { console.log('KO  mutation introuvable : ' + nom); rates++; continue; }
        fs.writeFileSync(path.join(tmp, f), s.replace(a, b));
        const k = await controles(tmp, false);
        fs.writeFileSync(path.join(tmp, f), s);
        console.log((k > 0 ? 'OK  ' : 'KO  ') + 'mutation « ' + nom + ' » ⇒ ' + k + ' contrôle(s) rouge(s)');
        if (!(k > 0)) rates++;
      }
      ko += rates;
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
