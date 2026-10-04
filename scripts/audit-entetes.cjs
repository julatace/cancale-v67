#!/usr/bin/env node
// ── REVUE DU 4 OCTOBRE : CE QUE LE SITE ENVOIE AVANT MÊME D'AFFICHER QUOI QUE CE SOIT ──
//
// Quatre défauts mesurés en production le 4 octobre, aucun visible à l'écran :
//
// 1. AUCUNE PROTECTION CONTRE L'AFFICHAGE DANS UN CADRE. La réponse de
//    vrm.center ne portait ni `X-Frame-Options` ni `frame-ancestors` : n'importe
//    quel site pouvait afficher VRM dans une page piégée et faire cliquer un
//    vendeur connecté sur un bouton qu'il ne voit pas (« clickjacking »).
//    Sur un outil qui génère des bordereaux et accepte des offres, c'est réel.
//
// 2. LES ROUTES SERVEUR TOURNAIENT À WASHINGTON (iad1, mesuré : `x-vercel-id`)
//    alors que la base est en Irlande (eu-west-1). Chaque route traversait
//    l'Atlantique pour chaque lecture, et les données de vendeurs européens
//    sortaient de l'Europe. Rien ne l'imposait : `regions` était absent.
//
// 3. LE ZOOM DE L'IPHONE. La règle anti-zoom existait (police ≥ 16 px sur iOS),
//    mais SANS `!important` — or 46 des 105 champs de l'app portent leur taille
//    EN LIGNE, et un style en ligne gagne sur une feuille de style. La règle ne
//    s'appliquait donc presque nulle part : toucher un champ zoomait la page.
//    Prouvé ici dans un vrai navigateur : la règle d'avant laisse 13 px.
//
// 4. UN INSCRIT ÉTAIT ENVOYÉ DANS LE TABLEAU DE BORD SUPABASE (« Désactive
//    Confirm email dans Supabase → Authentication… ») — un endroit auquel un
//    revendeur n'a, et ne doit avoir, aucun accès.
//
// Usage : node scripts/audit-entetes.cjs           (sort en 1 si un contrôle échoue)
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

let ok = 0, ko = 0;
const verifie = (nom, cond, detail) => {
  if (cond) { ok++; console.log(`  ✅ ${nom}`); }
  else { ko++; console.log(`  ❌ ${nom}${detail ? ` — ${detail}` : ''}`); }
};

// ── 1 + 2 : vercel.json ──────────────────────────────────────────────────────
console.log('\n── vercel.json');
let cfg = {};
try { cfg = JSON.parse(lire('vercel.json')); } catch (e) { verifie('vercel.json se lit', false, e.message); }

const REGIONS_UE = new Set(['dub1', 'fra1', 'cdg1', 'lhr1', 'arn1']);
const regions = Array.isArray(cfg.regions) ? cfg.regions : [];
verifie('les routes serveur tournent en Europe, près de la base (eu-west-1)',
  regions.length > 0 && regions.every((r) => REGIONS_UE.has(r)),
  regions.length ? `régions : ${regions.join(', ')}` : 'aucune région déclarée → Washington (iad1) par défaut');

// Un en-tête posé sur une source qui couvre TOUTES les pages (« /(.*) »).
// Une protection posée sur /assets seulement ne protège pas la page de l'app.
const couvreTout = (src) => src === '/(.*)' || src === '/:path*' || src === '/(.*)?';
const entetes = [];
for (const h of (cfg.headers || [])) {
  if (!couvreTout(h.source)) continue;
  for (const e of (h.headers || [])) entetes.push({ k: String(e.key || '').toLowerCase(), v: String(e.value || '') });
}
const xfo = entetes.find((e) => e.k === 'x-frame-options');
const csp = entetes.find((e) => e.k === 'content-security-policy');
const xfoOk = !!xfo && /^(deny|sameorigin)$/i.test(xfo.v.trim());
const fa = csp && /frame-ancestors\s+([^;]+)/i.exec(csp.v);
// `frame-ancestors *` ou une liste qui contient « * » / « https: » ne protège rien.
const faOk = !!fa && !/(^|\s)(\*|https?:)(\s|$)/.test(fa[1]);
verifie('aucun site étranger ne peut afficher VRM dans un cadre (X-Frame-Options)', xfoOk,
  xfo ? `valeur « ${xfo.v} »` : 'en-tête absent sur l\'ensemble du site');
verifie('… et la même règle pour les navigateurs récents (frame-ancestors)', faOk,
  csp ? `CSP « ${csp.v} »` : 'aucune Content-Security-Policy sur l\'ensemble du site');

// ── 3 : la règle anti-zoom de l'iPhone gagne sur les tailles écrites en ligne ──
console.log('\n── zoom de l\'iPhone sur les champs');
const html = lire('index.html');
const bloc = /@supports\s*\(-webkit-touch-callout:\s*none\)\s*\{([\s\S]*?)\}\s*\}/.exec(html)
  || /@supports\s*\(-webkit-touch-callout:\s*none\)\s*\{([\s\S]*?\})/.exec(html);
const regle = bloc ? bloc[1] : '';
verifie('une règle réservée à iOS pose la police des champs', !!bloc && /font-size/.test(regle));

// Le contrôle qui compte : un vrai navigateur, un champ à taille EN LIGNE
// (exactement la forme des champs de l'app), et la règle telle qu'elle est
// écrite dans index.html. On remplace seulement la condition « iOS » par une
// condition toujours vraie : Chromium ne connaît pas -webkit-touch-callout.
(async () => {
  let chromium = null;
  try { ({ chromium } = require('playwright')); } catch (_) {}
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p));
  if (!chromium || !exe || !bloc) {
    verifie('mesure dans un navigateur', false, !bloc ? 'règle introuvable' : 'navigateur du banc introuvable');
  } else {
    const css = bloc[0].replace(/@supports\s*\(-webkit-touch-callout:\s*none\)/, '@supports (display: block)');
    let b = null;
    try {
      b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
      const p = await b.newPage();
      await p.setContent(`<style>${css}</style>
        <input id="t" style="font-size:13px"><textarea id="z" style="font-size:12px"></textarea>
        <select id="s" style="font-size:14px"><option>a</option></select>
        <input id="c" type="checkbox" style="font-size:13px">`);
      const px = await p.evaluate(() => ['t', 'z', 's', 'c'].map((id) => parseFloat(getComputedStyle(document.getElementById(id)).fontSize)));
      verifie('un champ à 13 px écrit en ligne passe à 16 px sur iOS', px[0] >= 16, `police calculée ${px[0]} px`);
      verifie('… une zone de texte aussi', px[1] >= 16, `police calculée ${px[1]} px`);
      verifie('… une liste déroulante aussi', px[2] >= 16, `police calculée ${px[2]} px`);
      verifie('une case à cocher n\'est pas touchée (elle ne zoome pas)', px[3] < 16, `police calculée ${px[3]} px`);
    } catch (e) {
      verifie('mesure dans un navigateur', false, e.message.split('\n')[0]);
    } finally { if (b) await b.close().catch(() => {}); }
  }

  // ── 4 : aucun message d'inscription n'envoie dans le tableau de bord Supabase ──
  console.log('\n── messages lus par un nouvel inscrit');
  // On juge les fonctions du PARCOURS DE CONNEXION (de `authCall` à la fin de
  // `authSignUp`) : c'est là que parle un inconnu qui s'inscrit. Le panneau
  // « Sécurité des données » de Réglages, lui, s'adresse au propriétaire et a
  // le droit de nommer Supabase (§ « panneau de sécurité »).
  const src = lire('src/App.jsx');
  const debut = src.indexOf('const authCall');
  const finSignUp = src.indexOf('\n};', src.indexOf('const authSignUp'));
  verifie('le parcours de connexion se retrouve dans App.jsx', debut >= 0 && finSignUp > debut);
  const avant = src.slice(0, Math.max(0, debut)).split('\n').length - 1;
  const app = src.slice(Math.max(0, debut), finSignUp > debut ? finSignUp : debut).split('\n');
  // Les commentaires citent l'ancienne phrase pour expliquer pourquoi elle est
  // partie : on ne juge que les CHAÎNES du code (§ « un audit lit le CODE »).
  const fautifs = [];
  app.forEach((l, j) => {
    const i = j + avant;
    const code = l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/\s.*$/, '');
    const chaines = code.match(/(["'`])(?:\\.|(?!\1).)*\1/g) || [];
    for (const s of chaines) {
      if (/Supabase\s*\(|Supabase\s*→|dans Supabase|Authentication\s*→|Providers\s*→/.test(s)) fautifs.push(`ligne ${i + 1} : ${s.slice(0, 90)}`);
    }
  });
  verifie('aucun message n\'envoie un inscrit régler Supabase', fautifs.length === 0, fautifs.slice(0, 3).join(' · '));

  console.log(`\n${ok} contrôles OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
