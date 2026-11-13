// ── LA MÊME PAIRE EN LIGNE DEUX FOIS (6 nov. 2026, vague 3) ─────────────────────
// Une même paire physique en ligne à DEUX endroits en même temps peut se vendre
// deux fois. Module PUR (aucun accès au navigateur ni à la base) : Ma journée
// (`Comptabilite`, App.jsx) et `scripts/audit-en-ligne-deux-fois.cjs` exécutent
// les MÊMES fonctions (§11).
//
// ⚠️ « EN LIGNE » N'EST PAS JUGÉ ICI. La règle unique (<enligne-regle>,
//    `enLigneDuCompte`) a déjà rangé chaque annonce Vinted : seules celles qu'elle
//    dit EN LIGNE arrivent (`enLigne`) — jamais celles « à confirmer », jamais les
//    masquées (invendables tant que Vinted les masque). En plus, un compte dont la
//    lecture a raté, n'a pas d'heure, ou a plus de 24 h ne CONCLUT RIEN (« pas su »,
//    nommé dans `manque`) : ses annonces ne servent à aucun groupe.
//
// ⚠️ L'IDENTITÉ D'UNE PAIRE (§5) — JAMAIS LE TITRE, JAMAIS LA RESSEMBLANCE.
//    Deux annonces VINTED sont la même paire si elles portent :
//      · la même PHOTO EXACTE (`clePhoto` = `photoKey` d'App.jsx : dossier ET
//        fichier ; la photo de l'annonce ou la clé `photoK` mémorisée sur sa fiche
//        au numérotage — `jumellesParPhoto`). Jamais le DOSSIER seul (mesuré :
//        17 collisions sur 261 annonces, §5) ;
//      · ou un lien `recreeDe` posé par VRM quand il a recréé l'annonce
//        (Republier, `src/repriseNumero.js`) : l'ancienne pas supprimée + la
//        nouvelle = la même paire deux fois.
//    ⇒ `vinted` : LE GESTE MANQUANT (carte ambre de Ma journée, « N°x en ligne
//       deux fois sur Vinted », supprimer l'une sur SON clic, sur vinted.fr).
//
// ⚠️ LE MÊME N° SUR DEUX ANNONCES VINTED NE PROUVE PAS LA MÊME PAIRE. C'est aussi
//    « deux paires sous un même N° » (24 numéros portés par deux fiches chez
//    Julien) : le bloc ROUGE (`conflitsDeNumeros`) le dit déjà et les doublons se
//    renumérotent seuls (`doublonsAReattribuer`, sa décision du 20 oct.). Rendu à
//    part (`numeroSeul`), DÉJÀ DIT : aucune seconde alerte, et surtout jamais
//    « supprime l'une » sur un soupçon (ce serait peut-être l'annonce d'une
//    AUTRE paire). Mieux vaut un blanc qu'un faux.
//
// ⚠️ PLUSIEURS SITES, C'EST VOULU. Vinted + Leboncoin/eBay/Vestiaire sous le même
//    N° (SKU `VRM-{n°}`, référence posée, N° de l'annonce Vestiaire) : c'est
//    « Publier ailleurs » (`src/publierAilleurs.js`). Rendu à part (`sites`), sans
//    carte : quand l'une se vend, « Vendus ailleurs » (l'anti double vente) la
//    fait retirer des autres.

import { motsVendeur } from './profilVendeur.js';
const arr = (a) => (Array.isArray(a) ? a : []);
const cleDefaut = (n) => {
  const s = String(n == null ? '' : n).toUpperCase().replace(/[\s\-_.]/g, '');
  return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s;
};
export const EN_LIGNE_FRAIS_MS = 24 * 60 * 60 * 1000;
// Le prix d'une annonce Vinted : un objet `{ amount }` (la forme réelle) ou un nombre.
// Illisible ⇒ null (« — » à l'écran, jamais 0).
export const prixEuros = (p) => {
  const v = p && typeof p === 'object' ? p.amount : p;
  const n = Number(String(v == null ? '' : v).replace(',', '.'));
  return v != null && String(v).trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};
// « 60 € », « 59,90 € » ; null ⇒ « prix pas lu ».
export const texteEuros = (n) => (n == null ? 'prix pas lu' : `${(Math.round(n * 100) / 100).toFixed(Number.isInteger(n) ? 0 : 2).replace('.', ',')}\u00a0€`);
// « en ligne depuis le 3 nov. » (« depuis aujourd'hui ») ; null ⇒ la date n'est pas lue.
export const texteDepuis = (ms, maintenant = Date.now()) => {
  if (!Number.isFinite(ms)) return 'date de mise en ligne pas lue';
  const d = new Date(ms), m = new Date(maintenant);
  if (d.toDateString() === m.toDateString()) return 'en ligne depuis aujourd’hui';
  return `en ligne depuis le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== m.getFullYear() ? { year: 'numeric' } : {}) })}`;
};
// (9 nov., lot AF) LES GROUPES SUR DEUX COMPTES : la même paire publiée sur deux comptes
// Vinted différents (le risque que Julien veut voir AVANT la double vente). Même compte :
// toujours dans `vinted` (la carte de Ma journée), mais pas « deux comptes ».
export const surDeuxComptes = (groupes) => arr(groupes).filter((g) => g && Array.isArray(g.comptes) && g.comptes.length >= 2);
const PLATS = ['ebay', 'leboncoin', 'vestiaire'];

// La lecture d'un compte peut-elle conclure ? 'ok' · une raison (« pas su »).
export function raisonPasSu(c, maintenant) {
  if (!c || c.ok === false) return 'lecture ratée';
  const lu = Number(c.lu);
  if (c.lu == null || !Number.isFinite(lu)) return 'jamais lue';
  if (!(Number(maintenant) - lu <= EN_LIGNE_FRAIS_MS)) return 'lecture de plus de 24 h';
  return 'ok';
}

// vinted : [{ uid, nom, ok, lu (ms), enLigne: [{ id, title, photo, url }] }]
// fiches : `vinted_annonce_numeros` ({ [idAnnonce]: { numero, photoK, recreeDe } })
// autres : { ebay, leboncoin, vestiaire } — chacune null (pas su) ou
//          [{ id, numero, title, photo, url }] déjà jugées en ligne ; absent = pas demandé.
// Rend { su, manque, vinted, numeroSeul, sites, auMoins }.
//   groupe : { cle, numeros, annonces: [{ plat, id, uid, nom, titre, photo, url, numero }],
//              comptes, memeCompte, preuves: ['photo' | 'recree' | 'numero'] }
export function enLigneDeuxFois({ vinted, fiches, autres = null, clePhoto = null, cle = cleDefaut, maintenant = Date.now(), dateDe = null } = {}) {
  const F = fiches && typeof fiches === 'object' ? fiches : {};
  const manque = [];
  const parts = [];
  const vus = new Set();
  let lus = 0;
  for (const c of arr(vinted)) {
    if (!c) continue;
    const r = raisonPasSu(c, maintenant);
    if (r !== 'ok') { manque.push({ plateforme: 'vinted', uid: String(c.uid || ''), nom: String(c.nom || c.uid || ''), raison: r }); continue; }
    lus++;
    for (const it of arr(c.enLigne)) {
      if (!it || it.id == null) continue;
      const id = String(it.id);
      if (vus.has(id)) continue;
      vus.add(id);
      const f = F[id] || {};
      const numero = f.numero != null ? String(f.numero).trim() : '';
      parts.push({ plat: 'vinted', id, uid: String(c.uid || ''), nom: String(c.nom || c.uid || ''), titre: String(it.title || f.title || ''),
        photo: it.photo || f.photo || null, url: typeof it.url === 'string' ? it.url : '', numero, cle: numero ? cle(numero) : '',
        photos: [...new Set([clePhoto && it.photo ? clePhoto(it.photo) : '', f.photoK ? String(f.photoK) : ''].filter(Boolean))],
        recreeDe: f.recreeDe != null ? String(f.recreeDe) : '' });
      // (9 nov., lot AF) Ce que l'alerte montre de CHAQUE annonce : son prix et depuis quand
      // elle est en ligne (`dateDe` = `dateMiseEnLigneMs` d'App.jsx ; null = pas lue, dit).
      parts[parts.length - 1].prix = prixEuros(it.price != null ? it.price : f.price);
      parts[parts.length - 1].depuis = typeof dateDe === 'function' ? (Number.isFinite(dateDe(it)) ? dateDe(it) : null) : null;
    }
  }

  // Vinted ↔ Vinted : PHOTO EXACTE et `recreeDe` seulement (union-find).
  const parent = parts.map((_, i) => i);
  const racine = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const preuvesDe = new Map();                      // racine → Set des preuves
  const lie = (i, j, preuve) => {
    const a = racine(i), b = racine(j);
    const p = new Set([...(preuvesDe.get(a) || []), ...(preuvesDe.get(b) || []), preuve]);
    if (a !== b) { parent[a] = b; preuvesDe.delete(a); }
    preuvesDe.set(b, p);
  };
  const parPhoto = new Map(), parId = new Map();
  parts.forEach((p, i) => parId.set(p.id, i));
  parts.forEach((p, i) => {
    for (const k of p.photos) { if (parPhoto.has(k)) lie(i, parPhoto.get(k), 'photo'); else parPhoto.set(k, i); }
  });
  parts.forEach((p, i) => { if (p.recreeDe && parId.has(p.recreeDe)) lie(i, parId.get(p.recreeDe), 'recree'); });

  const sortie = (g, preuves) => {
    const nums = [...new Set(g.map((p) => p.numero).filter(Boolean))];
    const comptes = [...new Set(g.filter((p) => p.plat === 'vinted').map((p) => p.uid))];
    const t = g.find((p) => p.cle) || g[0];
    return { cle: t.cle, numeros: nums,
      annonces: g.map((p) => ({ plat: p.plat, id: p.id, uid: p.uid, nom: p.nom, titre: p.titre, photo: p.photo, url: p.url, numero: p.numero, prix: p.prix == null ? null : p.prix, depuis: p.depuis == null ? null : p.depuis })),
      comptes, memeCompte: comptes.length === 1, preuves: [...preuves].sort() };
  };
  const groupes = new Map();
  parts.forEach((p, i) => { const r = racine(i); if (!groupes.has(r)) groupes.set(r, []); groupes.get(r).push(p); });
  const vintedG = [];
  for (const [r, g] of groupes) if (g.length > 1) vintedG.push(sortie(g, preuvesDe.get(r) || []));

  // Le même N° sur plusieurs PAIRES Vinted (groupes d'identité différents) : déjà dit.
  const parCle = new Map();
  parts.forEach((p, i) => { if (!p.cle) return; if (!parCle.has(p.cle)) parCle.set(p.cle, new Map()); parCle.get(p.cle).set(racine(i), true); });
  const numeroSeul = [];
  for (const [k, racines] of parCle) {
    if (racines.size < 2) continue;
    const g = parts.filter((p) => p.cle === k);
    numeroSeul.push(sortie(g, ['numero']));
  }

  // Plusieurs SITES sous le même N° : voulu (« Publier ailleurs »).
  const autresParts = [];
  if (autres && typeof autres === 'object') {
    for (const plat of PLATS) {
      if (!(plat in autres)) continue;
      const l = autres[plat];
      if (l == null) { manque.push({ plateforme: plat, uid: '', nom: plat, raison: 'pas lu' }); continue; }
      lus++;
      for (const a of arr(l)) {
        const numero = a && a.numero != null ? String(a.numero).trim() : '';
        const k = numero ? cle(numero) : '';
        if (!k) continue;                              // sans N° : aucune identité commune
        autresParts.push({ plat, id: String((a && a.id) || k), uid: '', nom: plat, titre: String((a && a.title) || ''), photo: (a && a.photo) || null,
          url: a && typeof a.url === 'string' ? a.url : '', numero, cle: k });
      }
    }
  }
  const sites = [];
  const clesAutres = new Set(autresParts.map((p) => p.cle));
  for (const k of clesAutres) {
    const g = [...parts.filter((p) => p.cle === k), ...autresParts.filter((p) => p.cle === k)];
    if (new Set(g.map((p) => p.plat)).size < 2) continue;
    sites.push(sortie(g, ['numero']));
  }

  const tri = (a, b) => String(a.cle || '').localeCompare(String(b.cle || ''), 'fr', { numeric: true });
  const su = lus > 0;
  return { su, manque, vinted: vintedG.sort(tri), numeroSeul: numeroSeul.sort(tri), sites: sites.sort(tri), auMoins: su && manque.length > 0 };
}

// Ce que dit la carte de Ma journée (une seule source pour le titre, la ligne et
// l'infobulle, §11). Titre et ligne tiennent chacun sur UNE ligne à 390 px (la règle
// des cartes de « À faire ») ; tout le reste (les autres N°, les comptes) est dans
// `complet` (infobulle, lecteur d'écran) et dans la feuille.
export function texteCarte(groupes) {
  const g = arr(groupes);
  if (!g.length) return null;
  if (g.length === 1) {
    const x = g[0];
    const titre = x.numeros.length ? `N°${x.numeros[0]} en ligne deux fois` : `${motsVendeur().Un} en ligne deux fois`;
    const ou = x.memeCompte ? 'Même compte' : `${x.comptes.length} comptes`;
    const noms = [...new Set(x.annonces.map((a) => a.nom).filter(Boolean))];
    const complet = `${x.numeros.length > 1 ? `N°${x.numeros.join(' et N°')} : ${motsVendeur().meme}` : titre}, en ligne deux fois sur Vinted (${x.memeCompte ? `deux annonces sur ${noms[0] || 'le même compte'}` : `sur ${noms.join(' et ')}`}) — supprime celle en trop sur Vinted.`;
    return { titre, detail: `${ou} · supprimes-en une`, complet };
  }
  const nums = g.map((x) => (x.numeros[0] ? `N°${x.numeros[0]}` : 'sans N°'));
  const titre = `${g.length} ${motsVendeur().noms} en ligne deux fois`;
  return { titre, detail: `${nums.slice(0, 3).join(', ')}${nums.length > 3 ? '…' : ''} · supprime celles en trop`,
    complet: `${titre} sur Vinted : ${nums.join(', ')} — supprime celles en trop sur Vinted.` };
}
