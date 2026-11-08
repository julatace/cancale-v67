#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LE CENTRE D'AIDE vrm.center/aide — LE GÉNÉRATEUR (8 nov.)
//          node scripts/aide-generer.cjs            (écrit public/aide/)
//          node scripts/aide-generer.cjs --verifier (rouge si public/aide/ n'est
//                                                    pas ce que ce fichier produit)
// ════════════════════════════════════════════════════════════════════════════
// Des pages STATIQUES (pas l'app, pas React) : une coque commune, un texte par
// article, une feuille de style (aide.css, le même style Apple calme que l'app,
// clair/sombre : le choix fait dans l'app `vinted_dark`, sinon le système) et
// un script servi par VRM (aide.js : le thème et la recherche — la politique de
// contenu n'autorise aucun script en ligne). Le texte est ICI, une fois : les
// pages et l'index de la recherche en sortent, ils ne divergent pas.
// Chaque phrase dit ce que VRM fait vraiment (CLAUDE.md §2, §3, §5) ; les
// captures sont prises en MODE EXEMPLE seulement (scripts/bancs/aide-captures.cjs :
// données inventées, aucune donnée réelle — le dépôt est public).
'use strict';
const fs = require('fs');
const path = require('path');
const DOSSIER = path.join(__dirname, '..', 'public', 'aide');
const { ARTICLES } = require('./aide-contenu.cjs');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Un texte d'article : **gras**, `code`, [lien](url) — rien d'autre (aucun HTML brut).
const enLigne = (s) => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a href="${u}">${t}</a>`);

function bloc(b) {
  if (typeof b === 'string') return `<p>${enLigne(b)}</p>`;
  if (b.titre) return `<h2 id="${esc(b.id || '')}">${enLigne(b.titre)}</h2>`;
  if (b.etapes) return `<ol class="etapes">${b.etapes.map((e) => `<li>${enLigne(e)}</li>`).join('')}</ol>`;
  if (b.liste) return `<ul class="puces">${b.liste.map((e) => `<li>${enLigne(e)}</li>`).join('')}</ul>`;
  if (b.note) return `<p class="note"><b>${enLigne(b.titreNote || 'À savoir')}</b> ${enLigne(b.note)}</p>`;
  if (b.capture) return `<figure class="capture"><img src="/aide/captures/${esc(b.capture)}" alt="${esc(b.alt)}" width="390" height="${b.h || 760}" loading="lazy" decoding="async"><figcaption>${enLigne(b.legende)} <span class="exemple">Données d’exemple.</span></figcaption></figure>`;
  throw new Error('bloc inconnu : ' + JSON.stringify(b).slice(0, 80));
}

const tete = ({ titre, description, slug }) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/vrm-icon-v4-192.png">
<link rel="stylesheet" href="/aide/aide.css">
<!-- Centre d'aide VRM : page générée par scripts/aide-generer.cjs (ne pas modifier à la main). -->
<script src="/aide/aide.js"></script>
</head>
<body data-aide-page="${esc(slug)}">
<main>
  <header class="tete"><a href="/aide" class="marque"><img src="/logo-vrm-96.png" alt="" width="32" height="32"><span>VRM <em>Aide</em></span></a><a class="ouvrir" href="/">Ouvrir VRM</a></header>
`;
const pied = `  <footer class="pied">
    <p>Ça ne marche toujours pas&nbsp;? Dans VRM, touche <b>?</b> en haut de l’écran, puis <b>Signaler un problème</b> : tu vois exactement ce qui part avant d’envoyer.</p>
    <nav class="liens"><a href="/aide">Centre d’aide</a><a href="/etat">État de VRM</a><a href="/legal/mentions-legales.html">Mentions légales</a><a href="/legal/confidentialite.html">Confidentialité</a></nav>
  </footer>
</main>
</body>
</html>
`;

function pageArticle(a) {
  const autres = (a.voir || []).map((s) => ARTICLES.find((x) => x.slug === s)).filter(Boolean);
  return tete({ titre: `${a.titre} · Aide VRM`, description: a.resume, slug: a.slug })
    + `  <nav class="fil" aria-label="Fil d’Ariane"><a href="/aide">Centre d’aide</a></nav>
  <article>
    <h1>${esc(a.titre)}</h1>
    <p class="chapo">${enLigne(a.chapo || a.resume)}</p>
${a.blocs.map((b) => '    ' + bloc(b)).join('\n')}
  </article>
${autres.length ? `  <section class="voir" aria-label="Voir aussi"><h2>Voir aussi</h2><ul class="groupe">${autres.map((x) => `<li><a href="/aide/${x.slug}"><span><b>${esc(x.titre)}</b><small>${esc(x.resume)}</small></span></a></li>`).join('')}</ul></section>\n` : ''}${pied}`;
}

function pageIndex() {
  return tete({ titre: 'Centre d’aide · VRM', description: 'Installer l’extension, relier ta boîte e-mail, les numéros, les bordereaux, les colis à retirer, la compta et l’URSSAF.', slug: 'index' })
    + `  <h1 class="titre-index">Comment t’aider<h1 class="titre-index">Comment peut-on t’aider&nbsp;?</h1>nbsp;?</h1>
  <form class="recherche" role="search" action="/aide" data-aide-recherche="">
    <label for="q" class="cache">Chercher dans l’aide</label>
    <input id="q" name="q" type="search" placeholder="Bordereau, code de retrait, URSSAF…" autocomplete="off" enterkeyhint="search">
  </form>
  <p class="resultat" id="resultat" role="status" aria-live="polite"></p>
  <ul class="groupe articles" id="articles">
${ARTICLES.map((a) => `    <li data-article="${a.slug}"><a href="/aide/${a.slug}"><span><b>${esc(a.titre)}</b><small>${esc(a.resume)}</small></span></a></li>`).join('\n')}
  </ul>
  <p class="rien" id="rien" hidden>Rien trouvé. Essaie un autre mot, ou ouvre VRM : le <b>?</b> de chaque écran répond aux questions de cet écran.</p>
${pied}`;
}

// L'index de la recherche : titre, résumé et le texte de l'article (sans balises).
function indexRecherche() {
  const brut = (b) => (typeof b === 'string' ? b : b.titre || b.note || b.legende || (b.etapes || b.liste || []).join(' ') || '');
  const net = (t) => String(t).replace(/\*\*|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  return ARTICLES.map((a) => ({ slug: a.slug, titre: a.titre, resume: a.resume, mots: net([a.mots || '', ...a.blocs.map(brut)].join(' ')).slice(0, 4000) }));
}

function rendu() {
  const fichiers = { 'index.html': pageIndex(), 'index-recherche.json': JSON.stringify(indexRecherche()) + '\n' };
  for (const a of ARTICLES) fichiers[a.slug + '.html'] = pageArticle(a);
  return fichiers;
}

if (require.main === module) {
  const f = rendu();
  if (process.argv.includes('--verifier')) {
    const ecarts = Object.entries(f).filter(([n, t]) => { const p = path.join(DOSSIER, n); return !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== t; }).map(([n]) => n);
    console.log(ecarts.length ? `❌ public/aide/ pas à jour : ${ecarts.join(', ')} — lance node scripts/aide-generer.cjs` : '✅ public/aide/ = scripts/aide-contenu.cjs');
    process.exit(ecarts.length ? 1 : 0);
  }
  fs.mkdirSync(DOSSIER, { recursive: true });
  for (const [n, t] of Object.entries(f)) fs.writeFileSync(path.join(DOSSIER, n), t);
  console.log(`✅ ${Object.keys(f).length} fichiers écrits dans public/aide/`);
}
module.exports = { rendu, ARTICLES, enLigne };
