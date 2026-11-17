// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE L « Le dressing » — PAGE BLANCHE (17 nov.). N'importe RIEN de src/.
//  Une app de mode, mais pour le vendeur : la photo d'abord, le papier, l'encre, l'éditorial.
//  Écrans : #f=afaire | enligne | vendues | achats · #e=argent · #p=<paire> (la fiche).
// ════════════════════════════════════════════════════════════════════════════
import { PAIRES, PAYEES, MAINTENANT } from './donnees.js';
import { photo, qr } from './photos.js';

const J = 86400000;
const ETATS = {
  envoyer: { mot: 'À envoyer', geste: true }, retirer: { mot: 'À retirer', geste: true }, verifier: { mot: 'À vérifier', geste: true },
  numeroter: { mot: 'Sans N°', geste: true }, publier: { mot: 'À publier', geste: true },
  enligne: { mot: 'En ligne', geste: false }, vendue: { mot: 'Vendue', geste: false }, enroute: { mot: 'En route', geste: false },
};
const FILTRES = [
  { cle: 'afaire', mot: 'À faire', etats: ['envoyer', 'retirer', 'verifier', 'numeroter', 'publier'] },
  { cle: 'enligne', mot: 'En ligne', etats: ['enligne'] },
  { cle: 'vendues', mot: 'Vendues', etats: ['vendue'] },
  { cle: 'achats', mot: 'Achats', etats: ['retirer', 'enroute', 'numeroter'] },
];
const ORDRE = { envoyer: 0, retirer: 1, verifier: 2, numeroter: 3, publier: 4, vendue: 5, enroute: 6, enligne: 7 };
const t = (x) => Date.parse(x || '') || 0;
const trier = (l) => [...l].sort((a, b) => ORDRE[a.etat] - ORDRE[b.etat] || (t(a.limite) || 9e15) - (t(b.limite) || 9e15) || Number(!!b.doublon) - Number(!!a.doublon) || (b.jours || 0) - (a.jours || 0));

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
const detail = (x) => (x.etat === 'envoyer' || x.etat === 'retirer' ? avant(x.limite) : x.etat === 'enligne' ? `${x.jours} j en ligne` : x.detail || '');

const ICO = {
  loupe: '<circle cx="10.5" cy="10.5" r="6.25"/><path d="M15.2 15.2L20 20"/>',
  retour: '<path d="M15 5l-7 7 7 7"/>',
  fleche: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  plus: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="2.6"/>',
};
const ico = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" aria-hidden="true">${ICO[n]}</svg>`;

const lireHash = () => { const h = new URLSearchParams(location.hash.slice(1)); return { f: h.get('f') || 'afaire', e: h.get('e') || 'dressing', p: h.get('p') || '' }; };
const lien = (o) => { const h = { ...lireHash(), ...o }; const q = new URLSearchParams(); if (h.e !== 'dressing') q.set('e', h.e); if (h.f !== 'afaire') q.set('f', h.f); if (h.p) q.set('p', h.p); return '#' + q.toString(); };

// ── La tuile : la photo, l'étiquette N°, une étiquette d'état (seulement si le filtre en mélange), puis le texte ──
function tuile(x, melange, i) {
  const e = ETATS[x.etat];
  const tag = x.numero ? `<span class="n${x.doublon ? ' rouge' : ''}">N° ${esc(x.numero)}</span>` : '';
  const etat = melange ? `<span class="etat${e.geste ? ' geste' : ''}">${e.mot}</span>` : '';
  return `<a class="tuile" href="${lien({ p: x.cle })}" data-etat="${x.etat}" style="--i:${Math.min(i, 9)}">
    <span class="photo"><img src="${photo(x.photo)}" alt="" width="800" height="1000" ${i > 7 ? 'loading="lazy"' : ''} decoding="async">${tag}${etat}</span>
    <span class="nom">${esc(x.titre)}</span>
    <span class="bas"><span class="prix">${euros(x.prix)}</span><span class="quand${e.geste && !melange ? ' geste' : ''}">${esc(detail(x))}</span></span>
  </a>`;
}

function geste(f, l) {
  const n = (et) => l.filter((x) => x.etat === et).length;
  if (f.cle === 'afaire' && n('envoyer')) return { mot: `Imprimer ${n('envoyer')} bordereaux`, href: '#' };
  if ((f.cle === 'afaire' || f.cle === 'achats') && n('retirer')) return { mot: `Mes ${n('retirer')} codes de retrait`, href: lien({ p: l.find((x) => x.etat === 'retirer').cle }) };
  return null;
}

function dressing(h) {
  const f = FILTRES.find((x) => x.cle === h.f) || FILTRES[0];
  const l = trier(PAIRES.filter((x) => f.etats.includes(x.etat)));
  const melange = new Set(l.map((x) => x.etat)).size > 1;
  const g = geste(f, l);
  const filtres = FILTRES.map((x) => `<a class="filtre" href="${lien({ f: x.cle, p: '' })}" ${x.cle === f.cle ? 'aria-current="true"' : ''}>${x.mot}<span class="compte">${PAIRES.filter((p) => x.etats.includes(p.etat)).length}</span></a>`).join('');
  return { titre: 'Dressing', filtres, g, corps: `<div class="grille" role="list">${l.map((x, i) => tuile(x, melange, i)).join('')}</div>` };
}

function argent() {
  const nov = (iso) => t(iso) >= Date.parse('2026-11-01T00:00:00+01:00') && t(iso) <= MAINTENANT;
  const ventes = [...PAIRES.filter((x) => x.vendueLe), ...PAYEES];
  const vendus = ventes.filter((x) => nov(x.vendueLe));
  const recus = PAYEES.filter((x) => nov(x.verse));
  const connus = recus.filter((x) => x.cout != null);
  const benef = connus.reduce((s, x) => s + x.prix - x.cout, 0);
  const somme = (l) => l.reduce((s, x) => s + (x.prix || 0), 0);
  const envoyer = PAIRES.filter((x) => x.etat === 'envoyer'), vendues = PAIRES.filter((x) => x.etat === 'vendue');
  const pl = (n, s, p) => `${n} ${n > 1 ? p : s}`;
  const rang = (mot, sous, val) => `<div class="rang"><span class="rang-g"><span class="rang-mot">${mot}</span><span class="rang-sous">${sous}</span></span><span class="rang-val">${val}</span></div>`;
  return { titre: 'Argent', filtres: '', g: null, corps: `<div class="argent">
    <section><h2>Novembre</h2>
      ${rang('Vendu', pl(vendus.length, 'vente', 'ventes'), euros(somme(vendus)))}
      ${rang('Reçu', pl(recus.length, 'versement', 'versements'), euros(somme(recus)))}
      ${rang('Bénéfice', `prix d’achat connu pour ${connus.length} sur ${recus.length}`, (connus.length < recus.length ? 'au moins ' : '') + euros(benef))}
    </section>
    <section><h2>À venir</h2>
      ${rang('À envoyer', pl(envoyer.length, 'colis', 'colis'), euros(somme(envoyer)))}
      ${rang('Vendues, pas encore reçues', pl(vendues.length, 'vente', 'ventes'), euros(somme(vendues)))}
    </section>
    <section><h2>Derniers versements</h2>
      ${PAYEES.map((x) => `<div class="rang photo-rang"><img src="${photo(x.photo)}" alt="" width="40" height="50"><span class="rang-g"><span class="rang-mot">${esc(x.titre)}</span><span class="rang-sous">N° ${x.numero} · reçu ${jour(x.verse)}</span></span><span class="rang-val">${euros(x.prix)}</span></div>`).join('')}
    </section></div>` };
}

function fiche(x) {
  const e = ETATS[x.etat];
  const marge = x.prix != null && x.cout != null ? x.prix - x.cout : null;
  const ligne = (k, v) => `<div class="spec"><dt>${k}</dt><dd>${v}</dd></div>`;
  const etat = x.etat === 'envoyer' ? `À envoyer ${avant(x.limite)}` : x.etat === 'retirer' ? `À retirer ${avant(x.limite)}` : x.etat === 'enligne' ? `En ligne depuis ${x.jours} jours`
    : x.etat === 'vendue' ? `Vendue ${jour(x.vendueLe)}, ${x.detail}` : x.etat === 'enroute' ? `Achat ${x.detail}` : x.etat === 'numeroter' ? `${x.detail[0].toUpperCase() + x.detail.slice(1)}, sans N°` : x.doublon ? `Deux paires sous le N° ${x.numero}` : e.mot;
  const raison = x.doublon ? 'Regarde les deux cartons : un N° ne désigne qu’une paire.' : x.raison || '';
  const gestes = { envoyer: 'Imprimer le bordereau', retirer: 'J’ai retiré le colis', enligne: 'Baisser le prix', verifier: x.doublon ? 'Régler le N°' : 'Relire le dressing', publier: 'Publier sur Vinted', numeroter: 'Donner un N°', vendue: x.detail === 'en route' ? 'Voir le suivi' : null, enroute: 'Voir le suivi' };
  let specs;
  if (x.achat) specs = [['Payé', euros(x.prix)], ['Compte', esc(x.compte)], ['Acheté', jour(x.achete)]];
  else if (x.etat === 'enligne') specs = [['Prix', euros(x.prix)], ['Acheté', euros(x.cout)], ['Favoris', x.favoris], ['Vues', x.vues], ['Compte', esc(x.compte)]];
  else specs = [['Acheté', euros(x.cout)], ['Vendu', euros(x.prix)], ['Marge', marge == null ? '—' : (marge > 0 ? '+' : '') + euros(marge)], ['Compte', esc(x.compte)], ...(x.vendueLe ? [['Vendue', jour(x.vendueLe)]] : []), ...(x.suivi ? [['Suivi', x.suivi]] : [])];
  const r = x.retrait;
  const ticket = r ? `<section class="ticket" aria-label="Code de retrait"><img class="ticket-photo" src="${photo(x.photo)}" alt="" width="64" height="80">
      <div class="ticket-haut"><span>${esc(r.transporteur)}</span><span>${avant(x.limite)}</span></div>
      <p class="code">${esc(r.code.replace(/(\d{3})(?=\d{3}$)/, '$1 '))}</p>
      <p class="lieu">${esc(r.lieu)}</p>
      <div class="ticket-qr">${r.qr ? `<img src="${qr(r.qr)}" alt="QR de retrait ${esc(r.transporteur)}" width="168" height="168">` : `<p class="sans-qr">Pas de QR : ${esc(r.transporteur)} fonctionne au code.</p>`}</div>
      <p class="suivi">Suivi ${esc(r.suivi)}</p>
    </section>` : '';
  const g = gestes[x.etat];
  return `<div class="fiche" role="dialog" aria-label="${esc(x.titre)}" data-etat="${x.etat}">
    <a class="voile" href="${lien({ p: '' })}" aria-label="Fermer" tabindex="-1"></a>
    <article class="fiche-corps">
      <div class="fiche-photo">${r ? '' : `<img src="${photo(x.photo)}" alt="" width="800" height="1000">`}
        <a class="fermer" href="${lien({ p: '' })}" aria-label="Fermer">${ico('retour')}</a>
        <button class="plus" type="button" aria-label="Autres gestes">${ico('plus')}</button></div>
      <div class="fiche-texte">
        <div class="fiche-tags">${x.numero ? `<span class="n${x.doublon ? ' rouge' : ''}">N° ${esc(x.numero)}</span>` : '<span class="n vide">Achat sans N°</span>'}<span class="taille">Taille ${x.taille}</span></div>
        <h2 class="fiche-titre">${esc(x.titre)}</h2>
        <p class="fiche-etat${e.geste ? ' geste' : ''}">${etat}</p>
        ${raison ? `<p class="raison">${raison}</p>` : ''}
        ${ticket}
        <dl class="specs">${specs.map(([k, v]) => ligne(k, v)).join('')}</dl>
      </div>
      ${g ? `<a class="action" href="#">${g}${ico('fleche')}</a>` : ''}
    </article></div>`;
}

const ONGLETS = [['dressing', 'Dressing'], ['messages', 'Messages'], ['argent', 'Argent'], ['moi', 'Moi']];
function rendre() {
  const h = lireHash();
  const ordi = matchMedia('(min-width: 1100px)').matches;
  const v = h.e === 'argent' ? argent() : dressing(h);
  const p = h.p ? [...PAIRES].find((x) => x.cle === h.p) : null;
  const nav = ONGLETS.map(([k, mot]) => `<a class="onglet" href="${lien({ e: k === 'moi' || k === 'messages' ? h.e : k, p: '' })}" ${k === h.e ? 'aria-current="page"' : ''}>${mot}</a>`).join('');
  const action = v.g ? `<a class="action" href="${v.g.href}" data-plein>${v.g.mot}${ico('fleche')}</a>` : '';
  document.getElementById('app').innerHTML = ordi
    ? `<div class="ordi${p ? ' a-fiche' : ''}"><header class="haut"><span class="marque">VRM</span><nav class="nav">${nav}</nav><label class="cherche">${ico('loupe', 18)}<input type="search" placeholder="N°, titre, suivi, code de retrait"></label></header>
       <main><div class="tete"><h1>${v.titre}</h1>${v.filtres ? `<nav class="filtres">${v.filtres}</nav>` : ''}${action}</div>${v.corps}</main>${p ? fiche(p) : ''}</div>`
    : `<div class="tel${p ? ' a-fiche' : ''}"><div class="ecran" ${p ? 'inert' : ''}><header class="tete"><h1>${v.titre}</h1><button class="loupe" type="button" aria-label="Chercher une paire">${ico('loupe')}</button></header>
       ${v.filtres ? `<nav class="filtres">${v.filtres}</nav>` : ''}<main>${v.corps}</main>${action}<nav class="barre">${nav}</nav></div>${p ? fiche(p) : ''}</div>`;
  document.documentElement.classList.toggle('verrou', !!p && !ordi);
}
addEventListener('hashchange', () => { rendre(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && lireHash().p) location.hash = lien({ p: '' }); });
matchMedia('(min-width: 1100px)').addEventListener('change', rendre);
rendre();
document.documentElement.dataset.pret = '1';
