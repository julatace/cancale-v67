// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE L « Le dressing » — PAGE BLANCHE (17 nov.). N'importe RIEN de src/.
//  Une app de mode, mais pour le vendeur, aux conventions iOS : grand titre, recherche dans le titre,
//  UN contrôle segmenté, l'accueil en groupes « à faire » (compteur + action), les codes de retrait en
//  passes qu'on fait défiler, la fiche d'une paire en feuille (l'écran recule derrière), onglets icône + mot.
//  Signature : l'étiquette N° à œillet (comme celle qu'on accroche à un vêtement), partout où une paire paraît.
//  Écrans : #f=afaire | enligne | vendues | achats · #e=argent · #p=<paire>.
// ════════════════════════════════════════════════════════════════════════════
import { PAIRES, PAYEES, MAINTENANT } from './donnees.js';
import { photo, qr } from './photos.js';

const J = 86400000;
const t = (x) => Date.parse(x || '') || 0;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const euros = (c) => (c == null ? '—' : (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }).replace(/\s/g, ' ') + ' €');
function jour(iso) {
  const x = t(iso); if (!x) return '';
  const d = new Date(x), n = new Date(MAINTENANT);
  const dj = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / J);
  if (dj === 0) return 'aujourd’hui'; if (dj === -1) return 'hier'; if (dj === 1) return 'demain';
  if (dj > 1 && dj < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long' });
  if (dj < -1 && dj > -7) return `il y a ${-dj} j`;
  return 'le ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
const avant = (iso) => (jour(iso) === 'aujourd’hui' ? 'aujourd’hui' : 'avant ' + jour(iso));
const pl = (n, s, p) => `${n} ${n > 1 ? p : s}`;

// ── Les icônes : UN jeu (géométrie Lucide, 24 px, trait 1,75, bouts ronds), dessinées inline ──
const ICO = {
  cintre: '<path d="M12 6.2a2 2 0 1 1 2 2c-1.1 0-2 .9-2 2v.4"/><path d="M12 10.6 3.7 16.3a1 1 0 0 0 .6 1.8h15.4a1 1 0 0 0 .6-1.8z"/>',
  message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
  portefeuille: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  moi: '<circle cx="12" cy="8" r="4.5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  loupe: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  bas: '<path d="m6 9 6 6 6-6"/>', droite: '<path d="m9 18 6-6-6-6"/>', croix: '<path d="M18 6 6 18M6 6l12 12"/>',
  imprimer: '<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  etiquette: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1"/>',
  publier: '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  alerte: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/>',
  plus: '<circle cx="5" cy="12" r=".6"/><circle cx="12" cy="12" r=".6"/><circle cx="19" cy="12" r=".6"/>',
  horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  coeur: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
  camion: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.2-.6l-3.5-4.4A1 1 0 0 0 17.5 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
};
const ico = (n, s = 22, w = 1.75) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;

// ── La signature : l'étiquette N° à œillet (le seul rouge : deux paires sous un N°) ──
const etiquette = (x, grande) => (x.numero ? `<span class="tag${grande ? ' grande' : ''}${x.doublon ? ' rouge' : ''}" aria-label="N° ${esc(x.numero)}"><span class="tag-n">N°</span>${esc(x.numero)}</span>` : '');

const lireHash = () => { const h = new URLSearchParams(location.hash.slice(1)); return { f: h.get('f') || 'afaire', e: h.get('e') || 'dressing', p: h.get('p') || '' }; };
const lien = (o) => { const h = { ...lireHash(), ...o }; const q = new URLSearchParams(); if (h.e !== 'dressing') q.set('e', h.e); if (h.f !== 'afaire') q.set('f', h.f); if (h.p) q.set('p', h.p); return '#' + q.toString(); };

const GESTE = new Set(['envoyer', 'retirer', 'verifier', 'numeroter', 'publier']);
const detail = (x) => (x.etat === 'envoyer' || x.etat === 'retirer' ? avant(x.limite) : x.etat === 'enligne' ? `${x.jours} j en ligne` : x.detail || '');
function carte(x, i = 0) {
  return `<a class="carte" href="${lien({ p: x.cle })}" data-etat="${x.etat}" style="--i:${Math.min(i, 9)}">
    <span class="photo"><img src="${photo(x.photo)}" alt="" width="800" height="1000" ${i > 7 ? 'loading="lazy"' : ''} decoding="async">${etiquette(x)}</span>
    <span class="carte-nom">${esc(x.titre)}</span>
    <span class="carte-bas"><span class="prix">${euros(x.prix)}</span><span class="quand${GESTE.has(x.etat) ? ' geste' : ''}">${esc(detail(x))}</span></span>
  </a>`;
}
// iOS : ligne de liste — vignette, titre 17, sous-titre 15, valeur à droite, chevron, séparateur inset.
const ligne = (x, sous, val) => `<a class="ligne" href="${lien({ p: x.cle })}"><img class="vignette" src="${photo(x.photo)}" alt="" width="48" height="60"><span class="ligne-g"><span class="ligne-titre">${esc(x.titre)}</span><span class="ligne-sous">${sous}</span></span><span class="ligne-val">${val}</span>${ico('droite', 18)}</a>`;

// Le passe d'un colis à retirer : code en grand, QR seulement s'il existe vraiment (aucun QR fabriqué).
function passe(x, seul) {
  const r = x.retrait;
  return `<a class="passe${seul ? ' seul' : ''}" href="${lien({ p: x.cle })}" aria-label="Code de retrait ${esc(r.code)}">
    <span class="passe-haut"><span class="passe-tr">${ico('ticket', 18)}${esc(r.transporteur)}</span><span class="passe-lim">${avant(x.limite)}</span></span>
    <span class="passe-corps">
      <span class="passe-g"><span class="passe-mot">Code de retrait</span><span class="code">${esc(r.code.replace(/(\d{3})(?=\d{3}$)/, '$1 '))}</span><span class="lieu">${esc(r.lieu)}</span></span>
      ${r.qr ? `<img class="qr" src="${qr(r.qr)}" alt="QR de retrait ${esc(r.transporteur)}" width="104" height="104">` : `<span class="sans-qr">Au code<br>seulement</span>`}
    </span>
    <span class="passe-pied"><img src="${photo(x.photo)}" alt="" width="32" height="40"><span>${esc(x.titre)}</span></span>
  </a>`;
}

const GROUPES = [
  { etat: 'envoyer', mot: 'À envoyer', action: (l) => ({ mot: 'Imprimer', ico: 'imprimer' }) },
  { etat: 'retirer', mot: 'À retirer', action: (l) => ({ mot: 'Codes', ico: 'ticket', href: lien({ f: 'achats', p: '' }) }) },
  { etat: 'verifier', mot: 'À vérifier', action: () => null },
  { etat: 'numeroter', mot: 'Sans N°', action: () => ({ mot: 'Numéroter', ico: 'etiquette' }) },
  { etat: 'publier', mot: 'À publier', action: () => ({ mot: 'Publier', ico: 'publier' }) },
];
const ORDRE = (a, b) => (t(a.limite) || 9e15) - (t(b.limite) || 9e15) || Number(!!b.doublon) - Number(!!a.doublon);
const titreGroupe = (mot, n, a) => `<div class="groupe-tete"><h2>${mot}</h2><span class="groupe-n">${n}</span>${a ? `<a class="lien-action" href="${a.href || '#'}">${ico(a.ico, 18)}${a.mot}</a>` : ''}</div>`;

function afaire() {
  return GROUPES.map((g) => {
    const l = PAIRES.filter((x) => x.etat === g.etat).sort(ORDRE);
    if (!l.length) return '';
    return `<section class="groupe">${titreGroupe(g.mot, l.length, g.action(l))}<div class="rail">${l.map(carte).join('')}</div></section>`;
  }).join('');
}
function enligne() {
  const l = PAIRES.filter((x) => x.etat === 'enligne').sort((a, b) => b.jours - a.jours);
  return `<div class="tri"><span>${pl(l.length, 'paire', 'paires')}</span><button type="button" class="lien-action">Les plus anciennes${ico('bas', 16)}</button></div><div class="grille">${l.map(carte).join('')}</div>`;
}
function vendues() {
  const l = PAIRES.filter((x) => x.etat === 'vendue');
  return `<div class="tri"><span>${pl(l.length, 'vente', 'ventes')} pas encore payées</span></div><div class="grille">${l.map(carte).join('')}</div>`;
}
function achats() {
  const ret = PAIRES.filter((x) => x.etat === 'retirer').sort(ORDRE);
  const route = PAIRES.filter((x) => x.etat === 'enroute'), num = PAIRES.filter((x) => x.etat === 'numeroter');
  return `<section class="groupe">${titreGroupe('À retirer', ret.length, null)}<div class="rail passes">${ret.map((x) => passe(x)).join('')}</div></section>
    <section class="groupe">${titreGroupe('En route', route.length, null)}<div class="liste">${route.map((x) => ligne(x, x.detail[0].toUpperCase() + x.detail.slice(1), euros(x.prix))).join('')}</div></section>
    <section class="groupe">${titreGroupe('Arrivés sans N°', num.length, { mot: 'Numéroter', ico: 'etiquette' })}<div class="liste">${num.map((x) => ligne(x, x.detail[0].toUpperCase() + x.detail.slice(1), euros(x.prix))).join('')}</div></section>`;
}
function argent() {
  const nov = (iso) => t(iso) >= Date.parse('2026-11-01T00:00:00+01:00') && t(iso) <= MAINTENANT;
  const ventes = [...PAIRES.filter((x) => x.vendueLe), ...PAYEES];
  const vendus = ventes.filter((x) => nov(x.vendueLe));
  const recus = PAYEES.filter((x) => nov(x.verse));
  const connus = recus.filter((x) => x.cout != null);
  const benef = connus.reduce((s, x) => s + x.prix - x.cout, 0);
  const somme = (l) => l.reduce((s, x) => s + (x.prix || 0), 0);
  const envoyer = PAIRES.filter((x) => x.etat === 'envoyer'), vend = PAIRES.filter((x) => x.etat === 'vendue');
  const simple = (mot, sous, val) => `<div class="ligne simple"><span class="ligne-g"><span class="ligne-titre">${mot}</span><span class="ligne-sous">${sous}</span></span><span class="ligne-val">${val}</span>${ico('droite', 18)}</div>`;
  return `<section class="resume" aria-label="Novembre">
      <div><span class="resume-mot">Vendu</span><span class="resume-val">${euros(somme(vendus), true)}</span><span class="resume-sous">${pl(vendus.length, 'vente', 'ventes')}</span></div>
      <div><span class="resume-mot">Reçu</span><span class="resume-val">${euros(somme(recus), true)}</span><span class="resume-sous">${pl(recus.length, 'versement', 'versements')}</span></div>
      <div><span class="resume-mot">Bénéfice</span><span class="resume-val">${euros(benef, true)}</span><span class="resume-sous">au moins, ${connus.length} sur ${recus.length}</span></div>
    </section>
    <section class="groupe"><div class="groupe-tete"><h2>À venir</h2></div><div class="liste">
      ${simple('À envoyer', pl(envoyer.length, 'colis', 'colis'), euros(somme(envoyer)))}
      ${simple('Vendues, pas encore reçues', pl(vend.length, 'vente', 'ventes'), euros(somme(vend)))}
    </div></section>
    <section class="groupe"><div class="groupe-tete"><h2>Derniers versements</h2></div><div class="liste">
      ${PAYEES.map((x) => ligne(x, `N° ${x.numero} · reçu ${jour(x.verse)}`, euros(x.prix))).join('')}
    </div></section>`;
}

// ── La fiche : une feuille (grand cran), l'écran recule derrière ──
function fiche(x) {
  const marge = x.prix != null && x.cout != null ? x.prix - x.cout : null;
  const etat = x.etat === 'envoyer' ? ['imprimer', `À envoyer ${avant(x.limite)}`] : x.etat === 'retirer' ? ['ticket', `À retirer ${avant(x.limite)}`] : x.etat === 'enligne' ? ['horloge', `En ligne depuis ${x.jours} jours`]
    : x.etat === 'vendue' ? ['camion', `Vendue ${jour(x.vendueLe)}, ${x.detail}`] : x.etat === 'enroute' ? ['camion', `Achat ${x.detail}`] : x.etat === 'numeroter' ? ['etiquette', `${x.detail[0].toUpperCase() + x.detail.slice(1)}, sans N°`]
      : x.doublon ? ['alerte', `Deux paires sous le N° ${x.numero}`] : x.etat === 'publier' ? ['publier', 'Brouillon, pas en ligne'] : ['alerte', 'À vérifier'];
  const raison = x.doublon ? 'Regarde les deux cartons : un N° ne désigne qu’une paire.' : x.raison || '';
  const gestes = { envoyer: 'Imprimer le bordereau', retirer: 'J’ai retiré le colis', enligne: 'Baisser le prix', verifier: x.doublon ? 'Régler le N°' : 'Relire le dressing', publier: 'Publier sur Vinted', numeroter: 'Donner un N°', vendue: x.detail === 'en route' ? 'Voir le suivi' : null, enroute: 'Voir le suivi' };
  let specs;
  if (x.achat) specs = [['Payé', euros(x.prix)], ['Compte', esc(x.compte)], ['Acheté', jour(x.achete)], ...(x.retrait ? [['Suivi', esc(x.retrait.suivi)]] : [])];
  else if (x.etat === 'enligne') specs = [['Prix', euros(x.prix)], ['Acheté', euros(x.cout)], ['Favoris', x.favoris], ['Vues', x.vues], ['Compte', esc(x.compte)]];
  else specs = [['Acheté', euros(x.cout)], ['Vendu', euros(x.prix)], ['Marge', marge == null ? '—' : (marge > 0 ? '+' : '') + euros(marge)], ['Compte', esc(x.compte)], ...(x.vendueLe ? [['Vendue', jour(x.vendueLe)]] : []), ...(x.suivi ? [['Suivi', x.suivi]] : [])];
  const g = gestes[x.etat];
  return `<div class="feuille-fond"><a class="voile" href="${lien({ p: '' })}" aria-label="Fermer" tabindex="-1"></a>
    <article class="feuille" role="dialog" aria-modal="true" aria-label="${esc(x.titre)}" data-etat="${x.etat}">
      <span class="poignee" aria-hidden="true"></span>
      <a class="fermer" href="${lien({ p: '' })}" aria-label="Fermer">${ico('croix', 16, 2.2)}</a>
      <div class="feuille-defile">
        ${x.retrait ? `<div class="feuille-passe">${passe(x, true)}</div>` : `<div class="feuille-photo"><img src="${photo(x.photo)}" alt="" width="800" height="1000">${etiquette(x, true)}<span class="points" aria-hidden="true"><i class="on"></i><i></i><i></i></span></div>`}
        <div class="feuille-texte">
          <p class="feuille-sur">${x.retrait ? 'Achat' : 'Taille ' + x.taille} · ${esc(x.compte)}</p>
          <h2 class="feuille-titre">${esc(x.titre)}</h2>
          <p class="feuille-etat${GESTE.has(x.etat) ? ' geste' : ''}">${ico(etat[0], 18)}${etat[1]}</p>
          ${raison ? `<p class="raison">${raison}</p>` : ''}
          <dl class="liste specs">${specs.map(([k, v]) => `<div class="spec"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        </div>
      </div>
      ${g ? `<div class="feuille-pied"><a class="bouton" href="#">${g}</a><button type="button" class="rond" aria-label="Autres gestes">${ico('plus', 22, 2.4)}</button></div>` : ''}
    </article></div>`;
}

const SEGMENTS = [['afaire', 'À faire', (x) => GESTE.has(x.etat)], ['enligne', 'En ligne', (x) => x.etat === 'enligne'], ['vendues', 'Vendues', (x) => x.etat === 'vendue'], ['achats', 'Achats', (x) => x.achat]];
const ONGLETS = [['dressing', 'Dressing', 'cintre'], ['messages', 'Messages', 'message'], ['argent', 'Argent', 'portefeuille'], ['moi', 'Moi', 'moi']];

function rendre() {
  const h = lireHash();
  const ordi = matchMedia('(min-width: 1100px)').matches;
  const p = h.p ? PAIRES.find((x) => x.cle === h.p) : null;
  const titre = h.e === 'argent' ? 'Argent' : 'Dressing';
  const corps = h.e === 'argent' ? argent() : h.f === 'enligne' ? enligne() : h.f === 'vendues' ? vendues() : h.f === 'achats' ? achats() : afaire();
  const segments = h.e === 'argent' ? '' : `<div class="segments" role="tablist" aria-label="Filtrer le dressing">${SEGMENTS.map(([k, mot]) => `<a role="tab" class="segment" href="${lien({ f: k, p: '' })}" aria-selected="${k === h.f}">${mot}</a>`).join('')}</div>`;
  const compte = `<button type="button" class="menu-compte">3 comptes${ico('bas', 16, 2)}</button>`;
  const recherche = `<label class="recherche">${ico('loupe', 18, 2)}<input type="search" placeholder="${h.e === 'argent' ? 'Rechercher une vente' : 'N°, modèle, suivi, code'}" aria-label="Rechercher"></label>`;
  const nav = (avecMots) => ONGLETS.map(([k, mot, i]) => `<a class="onglet" href="${lien({ e: k === 'messages' || k === 'moi' ? h.e : k, p: '' })}" ${k === h.e ? 'aria-current="page"' : ''}>${ico(i, avecMots ? 20 : 26, 1.75)}<span>${mot}</span></a>`).join('');
  const app = document.getElementById('app');
  if (ordi) {
    const compteDe = (f) => PAIRES.filter(f).length;
    app.innerHTML = `<div class="ordi"><aside class="cote">
        <div class="cote-marque">VRM</div>${recherche}
        <nav class="cote-nav">${nav(true)}</nav>
        ${h.e === 'argent' ? '' : `<p class="cote-titre">Dressing</p><nav class="cote-filtres">${SEGMENTS.map(([k, mot, f]) => `<a href="${lien({ f: k, p: '' })}" ${k === h.f ? 'aria-current="true"' : ''}><span>${mot}</span><span class="cote-n">${compteDe(f)}</span></a>`).join('')}</nav>`}
      </aside>
      <main class="principal${p ? ' a-feuille' : ''}"><div class="barre-outils">${compte}</div><h1>${h.e === 'argent' ? 'Argent' : SEGMENTS.find((s) => s[0] === h.f)[1]}</h1>${corps}</main>
      ${p ? fiche(p) : ''}</div>`;
  } else {
    app.innerHTML = `<div class="tel${p ? ' a-feuille' : ''}"><div class="ecran" ${p ? 'inert' : ''}>
        <header class="nav-haut"><span></span>${compte}</header>
        <h1 class="grand-titre">${titre}</h1>${recherche}${segments}
        <main>${corps}</main>
        <nav class="onglets">${nav(false)}</nav></div>${p ? fiche(p) : ''}</div>`;
  }
  document.documentElement.classList.toggle('verrou', !!p && !ordi);
}
addEventListener('hashchange', rendre);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && lireHash().p) location.hash = lien({ p: '' }); });
matchMedia('(min-width: 1100px)').addEventListener('change', rendre);
rendre();
document.documentElement.dataset.pret = '1';
