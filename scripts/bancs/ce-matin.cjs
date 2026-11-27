require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  « CE MATIN » EN TÊTE D'AUJOURD'HUI (27 nov., lot scan-ce-matin) — choix de Julien : la liste ordonnée de ce qui
//  attend (acheteurs à répondre, bordereaux à imprimer, colis à retirer et l'heure où ferme le point, offres à trancher,
//  comptes à vérifier), chaque ligne ouvre le geste, rien ⇒ « Rien d'urgent ». Récit : docs/passation/2026-11-27-scan-ce-matin.md.
//
//  L'app RENDUE (dist/), la base INVENTÉE du banc aujourdhui-moins-texte (aucune donnée réelle : le dépôt est public).
//  Il juge (data-* et boîtes rendues, jamais un libellé) :
//    E  EN TÊTE  — le bloc `data-v2-bloc="ce-matin"` est rendu, AU-DESSUS du tableau de bord (le héros) ;
//    O  ORDRE    — `data-cm-ordre` suit l'ordre de Julien (messages, bordereaux, retraits, offres, verifications) ;
//    N  NOMBRES  — chaque nombre est celui de SON propriétaire : bordereaux = le disque « Imprimer » (`data-v2-principal`),
//                  retraits = la case « À retirer » (`data-v2-cj`), messages = la pastille Messages de la barre ;
//    C  CIBLES   — chaque ligne fait au moins 44 px et porte un nom accessible ;
//    G  GESTE    — toucher « Imprimer les bordereaux » ouvre l'écran des bordereaux (`?tab=` change, le bloc disparaît) ;
//    P  PHRASE   — aucune ligne de plus de 8 mots ;
//  à 390 et 1512 px, clair et sombre. Réglages : `BANC_DIST` (l'AVANT : rouge attendu), `LARGEURS`, `THEMES`,
//  `SHOTS=<dossier>` (captures à REGARDER), `MUTATION=ordre|nombre` (rouge attendu). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.TZ = 'Europe/Paris';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { baseCapture, ouvrir } = require('./aujourdhui-moins-texte.cjs');
const SHOTS = process.env.SHOTS || '';
const MUT = process.env.MUTATION || '';
const liste = (v, d) => String(process.env[v] == null ? d : process.env[v]).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number), THEMES = liste('THEMES', 'clair,sombre');
const ORDRE = ['messages', 'bordereaux', 'retraits', 'offres', 'verifications'];
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };

const MESURER = (mut) => {
  const bloc = document.querySelector('[data-v2-bloc="ce-matin"]');
  if (!bloc) return { bloc: false };
  if (mut === 'ordre') { const r = [...bloc.querySelectorAll('[data-cm-ligne]')]; if (r.length > 1) r[0].parentNode.insertBefore(r[1], r[0]); }
  if (mut === 'nombre') { const r = bloc.querySelector('[data-cm-ligne="bordereaux"]'); if (r) r.setAttribute('data-cm-ligne-n', String(Number(r.getAttribute('data-cm-ligne-n')) + 1)); }
  const lignes = [...bloc.querySelectorAll('[data-cm-ligne]')].map((e) => {
    const b = e.querySelector('button, [role="button"], a') || e; const r = b.getBoundingClientRect();
    const nom = (b.getAttribute('aria-label') || b.innerText || '').trim();
    return { cle: e.getAttribute('data-cm-ligne'), n: Number(e.getAttribute('data-cm-ligne-n')), h: Math.round(r.height), nom: !!nom, mots: (e.innerText || '').trim().split(/\s+/).filter((w) => /\p{L}/u.test(w)).length };
  });
  // Le héros lui-même (au téléphone, la colonne du tableau de bord n'a pas de boîte propre : display contents).
  const heros = document.querySelector('[data-pil-ecart]') || document.querySelector('[data-tb="pilotage"]');
  const enTete = !!heros && bloc.getBoundingClientRect().top < heros.getBoundingClientRect().top;
  const principal = document.querySelector('[data-v2-principal]');
  const cj = (document.querySelector('[data-v2-cj]') || { getAttribute: () => '' }).getAttribute('data-v2-cj') || '';
  return { bloc: true, etat: bloc.getAttribute('data-cm-etat'), lignes, enTete, imprimer: principal ? Number(principal.getAttribute('data-v2-principal')) : null,
    retirer: cj.split(',')[1] === undefined || cj.split(',')[1] === '' ? null : Number(cj.split(',')[1]), debord: document.documentElement.scrollWidth > innerWidth + 1 };
};

(async () => {
  const b = baseCapture();
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const nom = `${W}-${theme}`;
      console.log(`\n▶ ${nom}`);
      const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: theme === 'sombre', style: '', b });
      try {
        const r = await pg.evaluate(MESURER, MUT);
        if (SHOTS) {
          fs.mkdirSync(SHOTS, { recursive: true });
          const el = await pg.$('[data-v2-bloc="ce-matin"]');
          if (el) await el.scrollIntoViewIfNeeded().catch(() => {});
          await pg.screenshot({ path: path.join(SHOTS, `ce-matin-${nom}.png`) });
        }
        dit(r.bloc, 'E « Ce matin » est rendu');
        if (r.bloc) {
          dit(r.enTete, 'E au-dessus du tableau de bord');
          const cles = r.lignes.map((l) => l.cle);
          dit(r.etat === 'liste' && cles.length >= 3 && cles.every((c, i) => i === 0 || ORDRE.indexOf(cles[i - 1]) < ORDRE.indexOf(c)), 'O l’ordre de Julien', cles);
          const bd = r.lignes.find((l) => l.cle === 'bordereaux'), rt = r.lignes.find((l) => l.cle === 'retraits');
          dit(!!bd && bd.n === r.imprimer, 'N bordereaux = le disque « Imprimer »', { ce: bd && bd.n, imprimer: r.imprimer });
          dit(!!rt && rt.n === r.retirer, 'N colis à retirer = la case « À retirer »', { ce: rt && rt.n, retirer: r.retirer });
          dit(r.lignes.every((l) => l.h >= 44 && l.nom), 'C chaque ligne ≥ 44 px, nommée', r.lignes);
          dit(r.lignes.every((l) => l.mots <= 8), 'P aucune ligne de plus de 8 mots', r.lignes.map((l) => l.mots));
          dit(!r.debord, 'aucun défilement de côté');
          dit(!erreurs.length, 'aucune erreur JS', erreurs);
          // G : le geste (en dernier : il quitte l'écran).
          const avant = await pg.evaluate(() => location.search);
          const t = await pg.$('[data-cm-ligne="bordereaux"] button, [data-cm-ligne="bordereaux"][role="button"], [data-cm-ligne="bordereaux"]');
          if (t) { await t.click().catch(() => {}); await pg.waitForTimeout(1500); }
          const apres = await pg.evaluate(() => ({ s: location.search, bloc: !!document.querySelector('[data-v2-bloc="ce-matin"]') }));
          dit(!!t && (apres.s !== avant || !apres.bloc), 'G « Imprimer les bordereaux » ouvre son écran', { avant, apres });
        }
      } catch (e) { dit(false, 'mesure ' + nom, String(e && e.stack || e).slice(0, 400)); }
      await ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
