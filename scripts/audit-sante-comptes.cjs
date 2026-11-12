#!/usr/bin/env node
// Exécute la VRAIE règle de src/santeComptes.js (11 nov., lot sante-comptes) sur
// des lectures de la FORME mesurée (profil `harvest_{uid}_profile`, avis
// `{ id, rating, feedback }` SANS date, historique `{ at, total, c:[5] }`,
// `panel_comptes_etat.comptes[uid] = { etat, at }`, lignes d'envoi publiées
// `[tx, compte, vente, depart, limite, aEnvoyer]`), valeurs inventées.
// Contrôles : seuils écrits et montrés ; « pas su » ne fait JAMAIS « à surveiller »
// ni « en forme » ; une limite ESTIMÉE ne compte jamais en retard ; tendance 30 j
// contre 30 j d'avant ; LA raison est la plus grave ; un compte sans rien de lu est
// « pas assez lu » ; aucun score opaque (chaque point a sa valeur et sa source).
// Puis le code : trois placements, aucune écriture, aucune notification, ambre
// (jamais rouge), tout texte par tr(), la publication lit la limite LUE.
// `--mutation=X` : estimee-retard · passu-alerte · seuil-note · ordre · fenetre · forme-vide
// `--prouve` : chaque mutation doit faire rougir au moins un contrôle.
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ICI = path.join(__dirname, '..');
const args = process.argv.slice(2);
const MUTATIONS = {
  'estimee-retard': ['if (!fini(l.limite) || !fini(l.depart)) { if (dedans) sansLimite++; continue; }', 'if (!fini(l.depart)) { if (dedans) sansLimite++; continue; } const lim = fini(l.limite) ? l.limite : l.vente + 7 * J;'],
  'passu-alerte': ["const pasLu = (k, raison, extra) => ({ k, lu: false, valeur: null, tendance: null, alerte: false,", "const pasLu = (k, raison, extra) => ({ k, lu: false, valeur: null, tendance: null, alerte: true,"],
  'seuil-note': ['alerte: c.note < SEUILS.note', 'alerte: c.note < 4'],
  'ordre': ["export const ORDRE = Object.freeze(['moderation', 'retards', 'annulees', 'avisBas', 'note', 'delai']);", "export const ORDRE = Object.freeze(['delai', 'note', 'avisBas', 'annulees', 'retards', 'moderation']);"],
  'fenetre': ['export const FENETRE_J = 30;', 'export const FENETRE_J = 3000;'],
  'forme-vide': ["(lus >= SEUILS.minLus && (ind.note.lu || ind.delai.lu)) ? 'forme' : 'passu'", "'forme'"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe' }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let src = fs.readFileSync(path.join(ICI, 'src', 'santeComptes.js'), 'utf8');
if (mut) {
  const [a, b] = MUTATIONS[mut] || [];
  if (!a || !src.includes(a)) { console.error('ancre absente :', mut); process.exit(2); }
  src = src.replace(a, b);
  if (mut === 'estimee-retard') src = src.replace('if (l.depart > l.limite) {', 'if (l.depart > lim) {');
}
const tmp = path.join(ICI, 'src', `.audit-sante-${process.pid}.mjs`);
fs.writeFileSync(tmp, src);
let ko = 0, n = 0;
const dit = (ok, l, d) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${l}${!ok && d !== undefined ? ' — ' + d : ''}`); };
(async () => {
  try {
    const M = await import(tmp);
    const J = 86400000, H = 3600000;
    const maintenant = Date.UTC(2026, 10, 11, 12);
    const iso = (j) => new Date(maintenant - j * J).toISOString();
    const avis = (notes) => notes.map((r, i) => ({ id: 9000 - i, rating: r, feedback: 'ok' }));
    const comptes = [{ uid: '1', nom: 'forme' }, { uid: '2', nom: 'retard' }, { uid: '3', nom: 'vide' }, { uid: '4', nom: 'banni' }, { uid: '5', nom: 'avisbas' }, { uid: '6', nom: 'estimee' }];
    const profils = [
      { uid: '1', at: iso(0.2), rep: '0.98', n: '120', avis: avis(Array(20).fill(5)), hist: [{ at: iso(35), total: 100, c: [0, 0, 1, 1, 18] }, { at: iso(0.2), total: 120, c: [0, 0, 0, 0, 20] }] },
      { uid: '2', at: iso(1), rep: '0.96', n: '50', avis: avis(Array(20).fill(5)) },
      { uid: '4', at: iso(1), rep: '0.97', n: '40', avis: avis(Array(20).fill(5)) },
      { uid: '5', at: iso(3), rep: '0.86', n: '30', avis: avis([2, 5, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]) },
      { uid: '6', at: iso(1), rep: '0.98', n: '60', avis: avis(Array(20).fill(5)) },
    ];
    const etats = { 1: { etat: 'actif', at: iso(1) }, 2: { etat: 'actif', at: iso(1) }, 4: { etat: 'banni', at: iso(2) }, 5: { etat: 'actif', at: iso(1) }, 6: { etat: 'actif', at: iso(1) } };
    const L = (tx, c, venteJ, departH, limiteH, aEnvoyer = false) => {
      const vente = maintenant - venteJ * J;
      return { tx: String(tx), compte: String(c), vente, depart: departH == null ? null : vente + departH * H, limite: limiteH == null ? null : vente + limiteH * H, aEnvoyer };
    };
    const lignes = [
      // compte 1 : 4 colis en 24 h, limite lue à 5 j ⇒ aucun retard ; 30 j d'avant : 48 h
      L(11, 1, 2, 24, 120), L(12, 1, 5, 20, 120), L(13, 1, 10, 30, 120), L(14, 1, 20, 24, 120), L(15, 1, 40, 48, 120), L(16, 1, 45, 48, 120), L(17, 1, 50, 48, 120),
      // compte 2 : 2 colis partis APRÈS la limite lue + 1 encore à poster après sa limite
      L(21, 2, 3, 150, 120), L(22, 2, 12, 130, 120), L(23, 2, 15, 30, 120), L(24, 2, 8, null, 120, true),
      // compte 6 : parti au 9e jour SANS limite lue (estimée seulement) ⇒ jamais un retard
      L(61, 6, 12, 9 * 24, null), L(62, 6, 15, 9 * 24, null), L(63, 6, 18, 9 * 24, null),
    ];
    const ventes = [];
    const V = (tx, uid, j, status) => ventes.push({ transaction_id: tx, status, date: iso(j), _acc: { vinted_user_id: uid } });
    for (let i = 0; i < 6; i++) V(100 + i, '1', 2 + i, 'Commande finalisée');
    for (let i = 0; i < 6; i++) V(200 + i, '2', 2 + i, i < 3 ? 'Commande annulée' : 'Commande finalisée');
    V(299, '2', 40, 'Commande annulée');
    const estAnnulee = (o) => /annul/i.test(o.status);
    const R = M.santeComptes({ comptes, profils, etats, moderation: null, envois: { lignes }, ventes, estAnnulee, maintenant });
    const C = (u) => R.comptes.find((x) => x.uid === u) || {};
    const I = (u, k) => (C(u).indicateurs || {})[k] || {};

    // Le compte en forme
    dit(C('1').etat === 'forme' && !C('1').raison && C('1').alertes.length === 0, 'forme : aucun seuil passé ⇒ « En forme », aucune raison', JSON.stringify({ e: C('1').etat, a: C('1').alertes }));
    dit(I('1', 'note').valeur === 4.9 && I('1', 'note').n === 120 && I('1', 'note').nouveaux === 20, 'note : la note AFFICHÉE par Vinted (0,98 ⇒ 4,9/5), 120 avis, +20 depuis le point d’il y a 35 j', JSON.stringify(I('1', 'note')));
    dit(I('1', 'note').tendance && I('1', 'note').tendance.avant === 4.9 && I('1', 'note').tendance.apres === 5 && I('1', 'note').tendance.sens === 'hausse', 'note : tendance = moyenne de la page lue il y a 30 j (4,9) contre la dernière (5)', JSON.stringify(I('1', 'note').tendance));
    dit(I('1', 'delai').valeur === 24 * H && I('1', 'delai').n === 4 && I('1', 'delai').tendance && I('1', 'delai').tendance.avant === 48 * H && I('1', 'delai').tendance.sens === 'baisse', 'délai : médiane 24 h sur 4 colis (30 j) ; 30 j d’avant 48 h ⇒ en baisse', JSON.stringify(I('1', 'delai')));
    dit(I('1', 'retards').valeur === 0 && I('1', 'retards').sur === 4 && I('1', 'retards').alerte === false, 'retards : 0 sur 4 colis à limite lue');
    dit(I('1', 'annulees').valeur === 0 && I('1', 'annulees').n === 6, 'annulations : 0 sur 6 ventes (30 j)');
    dit(I('1', 'moderation').lu && I('1', 'moderation').sorte === 'ok' && !I('1', 'moderation').alerte, 'modération : actif ⇒ rien de signalé');
    dit(I('1', 'fraicheur').lu && I('1', 'fraicheur').ancienne === false && I('1', 'fraicheur').alerte === false, 'fraîcheur : lu il y a 5 h, jamais une alerte');
    // Le compte qui envoie en retard
    dit(C('2').etat === 'surveiller' && C('2').raison && C('2').raison.k === 'retards' && C('2').raison.valeur === 2 && C('2').raison.enRetard === 1, 'retard : 2 colis partis après la limite LUE + 1 encore à poster après la sienne ⇒ « À surveiller », raison « retards »', JSON.stringify(C('2').raison));
    dit(C('2').raison && C('2').raison.geste === '?tab=ventes', 'retard : LE geste mène à Ventes');
    dit(C('2').alertes.join() === 'retards,annulees,delai' && I('2', 'annulees').valeur === 3 && I('2', 'annulees').taux === 50, 'retard : les annulations (3 sur 6, 50 %) et le délai (130 h) passent aussi — LA raison reste la plus grave (retards)', JSON.stringify(C('2').alertes));
    dit(I('2', 'annulees').tendance && I('2', 'annulees').tendance.avant === 1, 'annulations : 30 j d’avant = 1 (la vente annulée il y a 40 j)', JSON.stringify(I('2', 'annulees').tendance));
    // Rien de lu
    dit(C('3').etat === 'passu' && C('3').lus === 0 && C('3').alertes.length === 0, 'rien de lu : « Pas assez lu », jamais « en forme » ni « à surveiller »', JSON.stringify({ e: C('3').etat, l: C('3').lus }));
    dit(['note', 'avisBas', 'delai', 'retards', 'annulees', 'moderation', 'fraicheur'].every((k) => I('3', k).lu === false && I('3', k).valeur === null && typeof I('3', k).raison === 'string'), 'rien de lu : chaque indicateur vaut « — » (null) avec SA raison, jamais 0');
    // Banni
    dit(C('4').etat === 'surveiller' && C('4').raison.k === 'moderation' && C('4').raison.sorte === 'banni', 'banni (profil Vinted) ⇒ raison « modération », la plus grave', JSON.stringify(C('4').raison));
    // Avis bas
    dit(I('5', 'avisBas').valeur === 2 && I('5', 'avisBas').sur === 10 && I('5', 'avisBas').alerte === true, 'avis bas : 2 de 3★ ou moins parmi les 10 plus récents ⇒ passe le seuil', JSON.stringify(I('5', 'avisBas')));
    dit(I('5', 'avisBas').tendance && I('5', 'avisBas').tendance.avant === 0 && I('5', 'avisBas').tendance.sens === 'hausse', 'avis bas : tendance = les 10 récents (2) contre les 10 d’avant (0) — Vinted ne date pas les avis');
    dit(I('5', 'note').valeur === 4.3 && I('5', 'note').alerte === true, 'note 0,86 ⇒ 4,3/5 : sous 4,5 ⇒ passe le seuil');
    dit(C('5').raison && C('5').raison.k === 'avisBas' && C('5').alertes.join() === 'avisBas,note', 'avis bas avant la note dans l’ordre des raisons', JSON.stringify(C('5').alertes));
    dit(I('5', 'fraicheur').ancienne === true && I('5', 'fraicheur').alerte === false, 'profil lu il y a 3 j : « à relire », jamais une alerte');
    dit(I('5', 'delai').lu === false && I('5', 'delai').raison === 'aucunColis', 'aucun envoi publié pour ce compte ⇒ « — » + raison');
    // Limite estimée
    dit(I('6', 'retards').lu === false && I('6', 'retards').raison === 'sansLimite' && I('6', 'retards').sansLimite === 3 && I('6', 'retards').alerte === false, 'limite ESTIMÉE seulement (parti au 9e jour) : AUCUN retard compté, « 3 sans date limite lue »', JSON.stringify(I('6', 'retards')));
    dit(I('6', 'delai').valeur === 9 * 24 * H && I('6', 'delai').alerte === true && C('6').raison.k === 'delai', 'mais le délai (9 j en médiane, 3 colis) passe SON seuil : la raison dit le délai, pas un retard', JSON.stringify(C('6').raison));
    // Pas su
    const R2 = M.santeComptes({ comptes, profils: null, etats: null, envois: null, ventes: null, maintenant });
    dit(R2.comptes.every((c) => c.etat === 'passu' && c.alertes.length === 0), 'lectures ratées (null partout) ⇒ tous « Pas assez lu », aucune alerte');
    const R3 = M.santeComptes({ comptes, profils: undefined, etats: undefined, maintenant });
    dit(R3.etat === 'encours', 'lecture en cours ⇒ « encours »');
    // Une vente d'un compte dont la lecture a raté n'est pas comptée
    const R4 = M.santeComptes({ comptes: [{ uid: '2', nom: 'x' }], profils, etats, envois: { lignes }, ventes, ko: ['2'], estAnnulee, maintenant });
    dit(R4.comptes[0].indicateurs.annulees.lu === false && R4.comptes[0].indicateurs.annulees.raison === 'ventes', 'ventes d’un compte en échec ⇒ annulations « — », jamais 0 %');
    // Modération (ligne du lot alerte-moderation)
    const R5 = M.santeComptes({ comptes: [{ uid: '1', nom: 'f' }], profils, etats, moderation: { 1: { e: [{ k: 'r1', s: 'restreint', t: maintenant - 2 * J }, { k: 'm1', s: 'masquee', t: maintenant - 40 * J, a: '123' }] } }, envois: { lignes }, ventes, estAnnulee, maintenant });
    dit(R5.comptes[0].raison && R5.comptes[0].raison.k === 'moderation' && R5.comptes[0].raison.sorte === 'restreint' && R5.comptes[0].indicateurs.moderation.tendance.avant === 1, 'restreint il y a 2 j ⇒ raison « modération » ; 30 j d’avant : 1 événement', JSON.stringify(R5.comptes[0].indicateurs.moderation));
    // Seuils écrits, exposés
    dit(M.SEUILS.note === 4.5 && M.SEUILS.avisBas === 2 && M.SEUILS.delaiH === 72 && M.SEUILS.retards === 2 && M.SEUILS.annulees === 3 && M.SEUILS.annuleesTaux === 10, 'les seuils sont écrits (4,5/5 · 2 avis bas · 3 j · 2 retards · 3 annulations ou 10 %)');
    // Publication : la limite estimée n'est jamais publiée
    const env = M.lignesEnvois({ vitesse: [{ tx: '1', compte: '9', vente: 1, depart: 2 }], aPoster: [{ tx: '2', compte: '9', vente: 3 }, { tx: '1', compte: '9', vente: 1 }], limiteLue: (tx) => (tx === '2' ? 99 : null) });
    dit(env.length === 2 && env[0].limite === null && env[1].limite === 99 && env[1].aEnvoyer === true, 'lignesEnvois : une ligne par vente, la limite LUE seulement, « à poster » marqué', JSON.stringify(env));
    dit(M.lignesEnvois({ vitesse: null }) === null, 'lignesEnvois : vitesse pas sue ⇒ null (rien publié)');
  } catch (e) { dit(false, 'exécution', e && e.stack); }
  finally { try { fs.unlinkSync(tmp); } catch (_) {} }

  // ── Le code ──
  const lire = (f) => { try { return fs.readFileSync(path.join(ICI, f), 'utf8'); } catch (_) { return ''; } };
  const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const jsx = sansCommentaires(lire('src/SanteComptes.jsx')), css = lire('src/styles-sante-comptes.css');
  const app = sansCommentaires(lire('src/App.jsx')), reg = sansCommentaires(lire('src/ecrans/Reglages.jsx')), stats = sansCommentaires(lire('src/ecrans/Stats.jsx'));
  dit(/<SanteComptes variante="reglages"/.test(reg) && /id:'santecomptes'/.test(reg), 'placement : Paramètres → Mes comptes');
  dit(/<SanteComptes variante="stats"\/>/.test(stats), 'placement : une carte dans Statistiques');
  dit(/'sante-comptes': santeSurv\.length \? \[carteSanteComptes\(\)\] : \[\]/.test(app) && /className="vrm-day-task-note is-urgent" data-sous-ligne="sante-comptes"/.test(app), 'placement : Ma journée, seulement quand un compte glisse (ambre `is-urgent`)');
  dit(!/method:\s*['"](POST|PATCH|PUT|DELETE)/i.test(jsx) && !/withOwner|modifierDonnee|save\(/.test(jsx), 'l’écran n’écrit rien en base');
  dit(!/api\/push|Notification\(|showNotification/.test(jsx), 'aucune nouvelle notification');
  dit(!/select=data(&|$|')/.test(jsx), 'jamais `select=data` (projections seulement)');
  dit(/\[data-ton="surveiller"\][^}]*var\(--vrm-warn/.test(css) && !/#FF3B30|#ff453a|--vrm-danger|--vrm-rouge|--vrm-doublon/i.test(css), '« À surveiller » est AMBRE, jamais rouge');
  const textes = (jsx.match(/>\s*[A-Za-zÀ-ÿ][^<>{}();=]*</g) || []).filter((t) => /[A-Za-zÀ-ÿ]{3,}/.test(t));
  dit(textes.length === 0, 'aucun texte en dur dans l’écran : tout passe par tr()', textes.join(' | '));
  dit(/lireDateLimite\(b\.dateLimite\)/.test(app) && /publierEnvois\(env/.test(app), 'la publication lit la date limite de l’e-mail (`lireDateLimite`), jamais l’estimée');

  console.log(`\n${ko ? '❌' : '✅'} audit-sante-comptes : ${n - ko} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
