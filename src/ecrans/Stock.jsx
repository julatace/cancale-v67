// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { quandLectureLbc } from '../enLigneLbc.js';
import { useEssentiel } from '../AttenteEcran.jsx';
import { unParArticle, planchesCases, planchesRangees } from '../stockRegles.js';
import { requeteDeLaVoix } from '../rechercheVocale.js';
import React, { useState, useMemo, useEffect } from 'react';
import { ChiffreConseil } from '../Conseils.jsx';
import { premiereCaseLibre as premiereCaseMeubles, caseEnMots } from '../ouRanger.js';
import { attrCible } from '../cibleNotif.js';
import { remettreCase, resteAuStock, etatCase } from '../stockSortie.js';
import { annoncesActuelles, annoncesVcStock, classerRangees, partagerParEtat } from '../stockAnnonces.js';
import { LIGNE_INVENTAIRE } from '../inventaire.js';
import { ValeurStockCarte, useValeurStock } from '../CascadeVente.jsx';   // (10 nov., lot BF) la valeur du stock, publiée par Annonces
import { EmballagesCarte } from '../EmballagesCarte.jsx';
import { useSelectionSerie, CaseSerie, BarreSerie, OuvrirSerie } from '../composants/SelectionSerie.jsx';   // (11 nov., lot actions-serie)
import { trierSerie, resumeSerie, csvDe } from '../selectionSerie.js';   // (10 nov., lot L) le stock d'emballages
import { CLE_EMBALLAGES, colisFaits } from '../emballages.js';
import { useMotsArticle, useExemplesVendeur, NotePaireCoque, InfoPop, Pourquoi, AUTH, Badge, Bouton, C, COL_H, Card, ChoixPlanches, DEMANDE_SAISIE_PRIX, DEMANDE_STOCK_CASE, DEMANDE_STOCK_CHERCHE, DEMANDE_STOCK_INVENTAIRE, INVENTAIRE_FEUILLE, DICTEE_OK, FermeAuRetour, INV_STATUS, Icon, LAYOUT, MicDictee, NAV, NOM_PLAT_STOCK, PhotoVinted, SUPABASE_URL, ScreenHead, Segmente, SheetShell, StatBox, annonceDeclareePartie, annotateAndDownloadBordereau, archiveNumeros, askChoix, askConfirm, classifyOrderStatus, cleDeclarationPartie, cleNum, comptesStockEcartes, estTamponAnnule, fetchHarvest, fetchVintedListings, fetchVintedOrders, filtreInventaire, lireBaseRelue, lireEbayEnLigne, lireLbcEnVente, load, loadRoomPlan, masqueesPresentes, normTitle, normalizePlan, onCloudReady, orderPhoto, ouDansMeubles, ouEstNumero, ouvrirRecherchePhoto, photoKey, placeDansMeubles, poserCible, save, saveTout, sbAuth, toast, tod, triNum, uid, useStateCle, useVcLocal, withOwner } from '../App.jsx';

// ⟦← App.jsx #1⟧
import StockExplication from "../StockExplication.jsx";
// ⟦← App.jsx #2⟧
import { InventaireStock } from "../InventaireStock.jsx";
import { InventaireAnnuel } from "../InventaireAnnuel.jsx";   // (10 nov., lot W) l'inventaire de fin d'année
import { DEMANDE_INVENTAIRE_ANNUEL } from "../inventaireAnnuel.js";   // (11 nov.) ouverte depuis « Clôturer l'année »
import { figerAttendu, ecrireAttendu } from "../inventaireHorsLigne.js";

// ⟦← App.jsx #3⟧

// Detecte un numero de paire ecrit dans un titre Vinted, au format "nXX",
// "n XX" ou "n°XX" (ex: "Adidas spezial n20" -> "20"). Sert UNIQUEMENT de
// suggestion lors de l'import : l'attribution du numero reste manuelle.
const extractPairNumber = (text) => {
  if (!text) return null;
  const m = /\bn\s*°?\s*(\d{1,5})\b/i.exec(text);
  return m ? m[1] : null;
};
// ⟦← App.jsx #4⟧
// (28 oct.) Les PLANCHES d'un meuble et la GRAVITÉ. Julien : « quand on enlève
// un article, ceux du dessus descendent — il faut pouvoir faire des barres »,
// puis « pas imaginaires justement » : ce sont les vraies planches de son
// meuble, dessinées. `m.planches` = les rangées (1 = celle du haut) SOUS
// lesquelles il y a une planche ; le bas du meuble en est toujours une.
// `m.gravite` : dans chaque colonne, entre deux planches, les articles posent
// sur celui du dessous — un vide se comble par le haut. On ne déplace que des
// articles PRÉSENTS (`presents`), jamais leur numéro ; seule la case change.
// Rend { slots, bouges: { cle: nbRangéesDescendues } }.
// (28 oct., suite) « rends les planches réglables colonne par colonne » : une
// planche peut ne couvrir que certaines colonnes. Rangé dans `m.planches` :
// un NOMBRE = une planche sur toute la largeur (la forme d'avant, toujours lue),
// une chaîne « r:c » = un morceau sous la rangée r, colonne c (1 = la gauche).
// Une règle (§11) : `planchesCases` lit, `planchesRangees` range, et tout le
// reste (dessin, éditeur, gravité) passe par elles.
function planchesDe(m) { return planchesRangees(planchesCases(m && m.planches, m && m.cols, m && m.rows), m && m.cols, m && m.rows); }
function tasserMeuble(slots, m, presents) {
  const out = { ...slots }; const bouges = {};
  if (!m || !m.gravite) return { slots: out, bouges };
  const cols = Math.max(1, +m.cols || 1), rows = Math.max(1, +m.rows || 1);
  const cases = planchesCases(m.planches, cols, rows);
  const chez = {};                                      // i → clé présente
  Object.keys(out).forEach((k) => { const v = out[k]; if (v && v.m === m.id && presents.has(k) && v.i < cols * rows && chez[v.i] == null) chez[v.i] = k; });
  for (let c = 0; c < cols; c++) {
    const bornes = [0];                                   // segments [haut, bas[ en rangées 0-based, propres à CETTE colonne
    for (let r = 1; r < rows; r++) if (cases.has(r + ':' + (c + 1))) bornes.push(r);
    bornes.push(rows);
    for (let b = 0; b < bornes.length - 1; b++) {
      const haut = bornes[b], bas = bornes[b + 1] - 1;
      const pile = [];                                    // du bas vers le haut
      for (let r = bas; r >= haut; r--) { const k = chez[r * cols + c]; if (k) pile.push([k, r]); }
      pile.forEach(([k, r0], j) => { const r1 = bas - j; if (r1 !== r0) { out[k] = { m: m.id, i: r1 * cols + c }; bouges[k] = r1 - r0; } });
    }
  }
  return { slots: out, bouges };
}
// ⟦← App.jsx #5⟧
// (9 nov.) Exportées : l'app les rejoue au retour du réseau quand un inventaire fait
// hors connexion attend encore (`rejouerInventaireLocal`, App.jsx).
export const lireLigneInventaire = async () => {
  if (!AUTH.user) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${LIGNE_INVENTAIRE}${filtreInventaire()}&select=data`, { headers: sbAuth(), cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j) || j.length > 1) return null;
    if (!j[0]) return { existe: false, data: {} };
    const d = j[0].data;
    return { existe: true, data: d && typeof d === 'object' && !Array.isArray(d) ? d : {} };
  } catch (_) { return null; }
};
export const ecrireLigneInventaire = async ({ existe, rev, data }) => {
  if (!AUTH.user) return 'ko';
  try {
    if (!existe) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
        method: 'POST', headers: { ...sbAuth(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify([withOwner({ id: LIGNE_INVENTAIRE, data })]),
      });
      if (r.ok) { try { window.dispatchEvent(new Event('vrm:inventaire')); } catch (_) {} return 'ok'; }
      return r.status === 409 ? 'conflit' : 'ko';
    }
    const garde = rev == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev}`;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${LIGNE_INVENTAIRE}${filtreInventaire()}&${garde}&select=id`, {
      method: 'PATCH', headers: { ...sbAuth(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) return 'ko';
    const j = await r.json().catch(() => null);
    if (Array.isArray(j) && j.length === 1) { try { window.dispatchEvent(new Event('vrm:inventaire')); } catch (_) {} return 'ok'; }
    return Array.isArray(j) && j.length === 0 ? 'conflit' : 'ko';
  } catch (_) { return 'ko'; }
};
// ⟦← App.jsx #6⟧
// (6 nov.) Le conseil « Ton premier inventaire » (src/accompagnement.js) : SA ligne relue
// (scalaires : y a-t-il un inventaire en cours, et d'anciens ?), et la copie de cet appareil.
// Lecture ratée ⇒ `null` (pas su ⇒ aucun conseil). Jamais fait = ni en cours, ni ancien.
function ChiffreInventaire({ numeros }) {
  const [jamais, setJamais] = React.useState(undefined);
  React.useEffect(() => {
    let vivant = true;
    const lire = async () => {
      let local = false;
      try { const t = localStorage.getItem('vrm_inventaire_local_' + (AUTH.user?.id || 'anon')); const d = t ? JSON.parse(t) : null; local = !!(d && (d.courant || (Array.isArray(d.anciens) && d.anciens.length))); } catch (_) {}
      if (local) { if (vivant) setJamais(false); return; }
      if (!AUTH.user) { if (vivant) setJamais(null); return; }
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${LIGNE_INVENTAIRE}${filtreInventaire()}&select=c:data->courant->>id,a:data->anciens->0->>id`, { headers: sbAuth(), cache: 'no-store' });
        if (!r.ok) { if (vivant) setJamais(null); return; }
        const j = await r.json();
        if (!Array.isArray(j)) { if (vivant) setJamais(null); return; }
        const l = j[0];
        if (vivant) setJamais(!l || (!l.c && !l.a));
      } catch (_) { if (vivant) setJamais(null); }
    };
    lire();
    window.addEventListener('vrm:inventaire', lire);
    return () => { vivant = false; window.removeEventListener('vrm:inventaire', lire); };
  }, []);
  return <ChiffreConseil cle="stock.inventaire" valeur={jamais === undefined || numeros === undefined ? undefined : (jamais === null || numeros === null ? null : { jamais, numeros })}/>;
}
// ⟦← App.jsx #7⟧

// (5 nov.) LES ANNONCES ACTUELLES, lues pour le Stock par les MÊMES lectures que
// l'écran Annonces (§11) : chaque compte Vinted gardé par `fetchVintedListings`
// (la règle <enligne-regle> : en ligne, à confirmer, masquées), eBay
// (`lireEbayEnLigne`) et Leboncoin (`lireLbcEnVente`). Un compte écarté du Stock
// (masqué, retiré, supprimé, plus lié — `comptesStockEcartes`) n'est pas lu.
// (5 nov., « ce qui reste ») Vestiaire : `vc_listings` et `vc_ventes`, PROJETÉS
// (les mêmes champs que l'écran Annonces → Vestiaire, jamais `select=data`) ;
// le jugement (`annoncesVcStock`) se fait au rendu, avec les N° du moment
// (`numerosVcEffectifs`, qui suivent un N° donné ou relié pendant que l'écran
// est ouvert). `vc: null` = la lecture a raté ; `{ lst: {} }` = jamais rangée.
// Rend `{ vinted: [{ uid, nom, ok, lu, enLigne, aConfirmer, masquees }], ebay, lbc, vc, at }`
// — une lecture ratée reste « pas su » (`ok: false`, `null`), jamais `[]`.
async function lireVcStock() {
  const [rl, rv] = await Promise.all([
    lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_listings&select=items:data->items,liens:data->liens,capturedAt:data->>capturedAt,complet:data->complet`).catch(() => null),
    lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_ventes&select=ventes:data->ventes`).catch(() => null),
  ]);
  if (!Array.isArray(rl)) return null;
  const r = rl[0] || {};
  const ventes = Array.isArray(rv) && rv[0] && rv[0].ventes && typeof rv[0].ventes === 'object' ? rv[0].ventes : null;
  return { lst: { items: r.items && typeof r.items === 'object' ? r.items : null, liens: r.liens && typeof r.liens === 'object' ? r.liens : {}, capturedAt: r.capturedAt || '', complet: r.complet === true }, ventes };
}
async function lireAnnoncesStock(accounts) {
  const horsCompte = comptesStockEcartes();
  const accs = (accounts || []).filter((a) => a && a.vinted_user_id != null && !horsCompte({ accountId: a.vinted_user_id }));
  const [vinted, ebay, lbc, vc] = await Promise.all([
    Promise.all(accs.map(async (acc) => {
      const uid = String(acc.vinted_user_id), nom = String(acc.login || acc.username || uid);
      let r; try { r = await fetchVintedListings(acc, 1, {}); } catch (_) { r = null; }
      if (!r || !r.ok) return { uid, nom, ok: false };
      return { uid, nom, ok: true, lu: Number.isFinite(r.lu) ? r.lu : null, enLigne: r.items || [], aConfirmer: r.aConfirmer || [], masquees: r.masquees || [] };
    })),
    lireEbayEnLigne(), lireLbcEnVente(), lireVcStock().catch(() => null),
  ]);
  return { vinted, ebay, lbc, vc, at: Date.now() };
}
const NOM_PLAT_FILTRE = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };
const depuisQuand = (ms) => { if (!Number.isFinite(ms)) return 'jamais lu'; const h = (Date.now() - ms) / 3600000; return h < 48 ? `lu il y a ${Math.max(1, Math.round(h))} h` : `lu il y a ${Math.round(h / 24)} j`; };

function StockMeubles({ locate = null, placeNum = null, onPlaced = null, accounts = null, comptesLus = false } = {}) {
  const motsStock = useMotsArticle();   // (11 nov., lot DJ2) « paire » seulement pour Sneakers
  const exemplesStock = useExemplesVendeur();   // (11 nov., lot DJ2) le nom d’emballage proposé
  const [meubles, setMeubles] = React.useState(() => { const m = load('vrm_meubles', []); return Array.isArray(m) ? m : []; });
  const [slots, setSlots] = React.useState(() => { const s = load('vrm_slots', {}); return s && typeof s === 'object' ? s : {}; });
  const [pairsLost, setPairsLost] = useStateCle('vinted_pairs_lost', () => load('vinted_pairs_lost', {}));
  // (10 nov., lot BF) « Valeur du stock » : LUE (`vrm_valeur_stock`, propriétaire : Annonces), jamais recalculée ici.
  const valeurStk = useValeurStock((AUTH.user && AUTH.user.id) || '');
  const [emballagesR, setEmballagesR] = useStateCle(CLE_EMBALLAGES, () => load(CLE_EMBALLAGES, null));
  const saisirPrixStock = () => { DEMANDE_SAISIE_PRIX.on = true; try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=vinted_annonces' })); } catch (_) {} };
  // Une demande venue d'ailleurs (Colis « où sont ces paires », la recherche
  // globale « Tout sur le N° ») : un seul N° remplit la recherche.
  const [demande] = React.useState(() => {
    const d = DEMANDE_STOCK_CHERCHE;
    if (Array.isArray(d.nums) && d.nums.length && Date.now() - d.at < 120000) { const n = d.nums.map(String); d.nums = null; return n; }
    return null;
  });
  const [q, setQ] = React.useState(() => (demande && demande.length === 1 ? demande[0] : ''));
  const [cibles, setCibles] = React.useState(() => (demande && demande.length > 1 ? demande.map((x) => cleNum(x)).filter(Boolean) : []));
  const [flash, setFlash] = React.useState(null);           // cleNum de la case montrée
  const chercheRef = React.useRef(null);
  // « Voir de plus loin » : la taille des cases, choisie par appareil
  // (commodité d'affichage, jamais une donnée). Par défaut : de loin.
  const ZOOMS = { loin: 64, normal: 100, pres: 150 };
  const [zoom, setZoomEtat] = React.useState(() => { try { const z = localStorage.getItem('vrm_meubles_zoom'); return ZOOMS[z] ? z : 'loin'; } catch (_) { return 'loin'; } });
  const setZoom = (z) => { setZoomEtat(z); try { localStorage.setItem('vrm_meubles_zoom', z); } catch (_) {} };
  const caseMax = ZOOMS[zoom] || 64;
  const [place, setPlace] = React.useState(null);           // cleNum en cours de pose
  // (6 nov., vague 3) LA CASE VISÉE ({ m, i }) — sélectionnée jusqu'au prochain toucher d'une case.
  const lireDemandeCase = () => { const d = DEMANDE_STOCK_CASE; if (d.m == null || Date.now() - d.at > 120000) return null; const c = { m: String(d.m), i: Number(d.i) }; d.m = null; d.i = null; return c; };
  const [choisie, setChoisie] = React.useState(lireDemandeCase);
  React.useEffect(() => { const f = () => { const c = lireDemandeCase(); if (c) setChoisie(c); }; window.addEventListener('vrm:stock-case', f); return () => window.removeEventListener('vrm:stock-case', f); }, []);
  const viserCase = (m, i) => poserCible({ type: 'case', meuble: String(m), i: String(i) }, 'garage');
  // (5 nov., revue) « Voir au stock » (Annonces, Ventes, Ma journée) cherche ce
  // N° ; « Ranger au stock » le prend en main : il ne reste qu'à toucher la case.
  // Avant, ces deux gestes arrivaient sur un Stock vide de toute demande (ils
  // ne parlaient qu'à l'ancienne grille et à la pièce 3D, plus affichées).
  // (6 nov., vague 3) Un N° qui a SA case : la case est sélectionnée, défilée et éclairée (avant, la
  // recherche s'ouvrait et la case restait hors de l'écran) ; sans case, la recherche comme avant.
  React.useEffect(() => {
    if (locate == null || !String(locate).trim()) return;
    const k = cleNum(locate); const s0 = k && slots[k];
    if (s0 && s0.m != null && Number.isInteger(Number(s0.i)) && meubles.some((x) => String(x.id) === String(s0.m))) { setQ(''); setCibles([k]); viserCase(s0.m, Number(s0.i)); }
    else { setQ(String(locate)); setCibles([]); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locate]);
  // « Ranger au stock » : la PREMIÈRE CASE LIBRE est proposée (la règle de « Où ranger à l'arrivée »,
  // src/ouRanger.js, jamais une seconde) — sélectionnée, défilée, éclairée ; toucher une case y range
  // la paire (celle-ci ou une autre : c'est lui qui choisit).
  React.useEffect(() => {
    if (placeNum == null || !String(placeNum).trim()) return;
    const k = cleNum(placeNum);
    if (k) {
      setPlace(k); setQ('');
      const libre = premiereCaseMeubles({ meubles, slots });
      if (libre) { viserCase(libre.meubleId, libre.i); toast(`Touche la case où tu ranges N°${placeNum} — proposée : ${caseEnMots(libre)}.`); }
      else toast(`Touche la case où tu ranges N°${placeNum}.`);
    }
    if (onPlaced) onPlaced();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeNum]);
  const [modal, setModal] = React.useState(null);           // {type:'meuble'|'placer'|'fiche', …}
  // (6 nov.) L'INVENTAIRE (src/InventaireStock.jsx) : ouvert par le bouton « Inventaire »
  // du titre (`vrm:inventaire-ouvrir`) ou par Ma journée (`DEMANDE_STOCK_INVENTAIRE`).
  const [inventaire, setInventaire] = React.useState(() => { if (Date.now() - DEMANDE_STOCK_INVENTAIRE.at < 120000) { DEMANDE_STOCK_INVENTAIRE.at = 0; return true; } return false; });
  React.useEffect(() => { const f = () => setInventaire(true); window.addEventListener('vrm:inventaire-ouvrir', f); return () => window.removeEventListener('vrm:inventaire-ouvrir', f); }, []);
  // (9 nov.) La feuille ouverte est dite à la coque : si le réseau coupe pendant le tour,
  // l'inventaire hors connexion la rouvre (les saisies sont sur l'appareil). Démontée AVEC
  // le réseau (changement d'écran), elle ne se rouvrira pas toute seule.
  // (10 nov., lot W) L'INVENTAIRE DE FIN D'ANNÉE (src/InventaireAnnuel.jsx) ; « Je vérifie mes
  // cartons » ouvre l'inventaire ci-dessus, et le referme sur la fin d'année.
  // (11 nov.) Ouverte depuis « Clôturer l'année » : la demande vaut 30 s et n'est consommée qu'à la
  // fermeture de la feuille (l'écran peut se monter deux fois pendant son chargement).
  const [annuel, setAnnuel] = React.useState(() => { const t = DEMANDE_INVENTAIRE_ANNUEL.at; return !!t && Date.now() - t < 30000; });
  const retourAnnuel = React.useRef(false);
  React.useEffect(() => { INVENTAIRE_FEUILLE.ouverte = !!inventaire; }, [inventaire]);
  React.useEffect(() => () => { try { if (typeof navigator === 'undefined' || navigator.onLine !== false) INVENTAIRE_FEUILLE.ouverte = false; } catch (_) {} }, []);
  // Rattrapage nuage (§5.49) : on ne remplace que si resté VIDE — jamais par-dessus
  // un meuble créé ou une case posée pendant le chargement.
  React.useEffect(() => onCloudReady(() => {
    setMeubles((prev) => (prev && prev.length) ? prev : (Array.isArray(load('vrm_meubles', [])) ? load('vrm_meubles', []) : []));
    setSlots((prev) => (prev && Object.keys(prev).length) ? prev : (load('vrm_slots', {}) || {}));
    setPairsLost((prev) => (prev && Object.keys(prev).length) ? prev : (load('vinted_pairs_lost', {}) || {}));
  }), []);
  // (5 nov.) La sortie automatique (`sortirPartisDuStock`) a libéré une case :
  // l'écran relit `vrm_slots` (sinon son état, plus ancien, la réécrirait).
  React.useEffect(() => {
    const relire = () => { const sl = load('vrm_slots', {}); setSlots(sl && typeof sl === 'object' ? sl : {}); setJournal(load('vrm_stock_sortis', {}) || {}); };
    window.addEventListener('vrm:stock-slots', relire);
    return () => window.removeEventListener('vrm:stock-slots', relire);
  }, []);
  // L'ANCIENNE PIÈCE 3D (retirée de l'écran le 5 nov.) : LUE seulement, jamais
  // écrite — une paire « à ranger » qui y avait une place la voit sur sa fiche.
  // undefined = en cours · null = pas lue ou vide · plan normalisé.
  const [ancienPlan, setAncienPlan] = React.useState(undefined);
  React.useEffect(() => { let vivant = true; (async () => { const brut = await loadRoomPlan(); if (!vivant) return; setAncienPlan(brut && (Array.isArray(brut.items) || Array.isArray(brut.rooms)) ? normalizePlan(brut) : null); })(); return () => { vivant = false; }; }, []);
  const ancienneplace = (num) => { if (!ancienPlan) return null; try { return ouEstNumero(ancienPlan, num); } catch (_) { return null; } };
  const [journal, setJournal] = useStateCle('vrm_stock_sortis', () => load('vrm_stock_sortis', {}) || {});
  const [explication, setExplication] = React.useState(false);
  const [glisse, setGlisse] = React.useState(null);        // cleNum glissé à la souris
  const [survol, setSurvol] = React.useState(null);        // 'mid:i' sous la souris pendant un glisser
  const souris = React.useMemo(() => { try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (_) { return false; } }, []);
  const ecrireMeubles = (u) => { setMeubles(u); save('vrm_meubles', u); };
  const [tombes, setTombes] = React.useState({});   // cle → rangées descendues (animation)
  const ecrireSlotsBrut = (u) => { setSlots(u); save('vrm_slots', u); };

  const numeros = load('vinted_annonce_numeros', {}) || {};
  const horsCompte = comptesStockEcartes();
  const venduSig = load('vrm_stock_vendus', null);
  const vendus = new Set((venduSig && Array.isArray(venduSig.nums) ? venduSig.nums : []).map((x) => cleNum(x)).filter(Boolean));
  const estVendu = (f) => vendus.has(cleNum(f.numero));
  // ⚠️⚠️ (5 nov.) Julien : « pour le stock onglet je veux que ça soit les annonces
  // actuelles ». Avant, le Stock proposait TOUTES les fiches numérotées jamais
  // vues (mesuré chez lui : 521 fiches, dont 401 « B » d'archive, pour 56
  // annonces présentes sur Vinted). Maintenant : ses ANNONCES ACTUELLES, toutes
  // plateformes, une fois par paire (`annoncesActuelles`, src/stockAnnonces.js),
  // lues par la règle unique « en ligne » (`lireAnnoncesStock`). Une paire posée
  // dans une case qui n'est plus une annonce actuelle ne disparaît pas : vendue
  // ⇒ « Vendues à sortir », sinon ⇒ « Plus en ligne » (`classerRangees`) — et si
  // une lecture qui pourrait la porter manque, on ne dit RIEN d'elle (« pas su »).
  const [lecture, setLecture] = React.useState(undefined);   // undefined = en cours
  useEssentiel('stock', lecture);                            // (6 nov.) l'écran Stock attend ses annonces actuelles (src/AttenteEcran.jsx)
  const vcLocStock = useVcLocal();                           // les N° Vestiaire (donnés, reliés) : redessine quand ils changent
  const cleComptesStock = (accounts || []).map((a) => String((a && a.vinted_user_id) || '')).filter(Boolean).sort().join(',');
  React.useEffect(() => {
    if (!comptesLus) return undefined;
    let vivant = true;
    (async () => { const lu = await lireAnnoncesStock(accounts || []); if (vivant) setLecture(lu); })();
    return () => { vivant = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comptesLus, cleComptesStock]);
  // Les filtres (commodité d'affichage, par appareil) : par défaut TOUT.
  const [filtrePlat, setFiltrePlatEtat] = React.useState(() => { try { return localStorage.getItem('vrm_stock_filtre_plat') || ''; } catch (_) { return ''; } });
  const [filtreCompte, setFiltreCompteEtat] = React.useState(() => { try { return localStorage.getItem('vrm_stock_filtre_compte') || ''; } catch (_) { return ''; } });
  const setFiltrePlat = (v) => { setFiltrePlatEtat(v); try { localStorage.setItem('vrm_stock_filtre_plat', v); } catch (_) {} };
  const setFiltreCompte = (v) => { setFiltreCompteEtat(v); try { localStorage.setItem('vrm_stock_filtre_compte', v); } catch (_) {} };
  const [maxListe, setMaxListe] = React.useState(60);        // la liste des annonces actuelles, 60 par 60
  const [, setTic] = React.useState(0);                      // relire après « Elle est encore là »
  const garder = { ...(load('vrm_stock_garde_hors_ligne', {}) || {}), ...(load('vrm_stock_garder', {}) || {}) };
  // Vestiaire : ses annonces jugées par la règle de Vestiaire, avec les N° du
  // moment (donnés par VRM, ou celui de Vinted qu'il a relié — `vrm_vc_liens`).
  const vcStock = lecture ? (lecture.vc ? annoncesVcStock({ lst: lecture.vc.lst, ventes: lecture.vc.ventes, auto: vcLocStock.auto }) : null) : undefined;
  const aa = lecture ? annoncesActuelles({
    vinted: lecture.vinted.map((c) => (c.ok ? { ...c, masquees: masqueesPresentes(c.masquees, numeros, pairsLost) } : c)),
    numeros, ebay: lecture.ebay, lbc: lecture.lbc, vestiaire: vcStock, vendus, cle: cleNum, clePhoto: photoKey,
  }) : null;
  // Une paire sous deux N° (même photo exacte, `aussi`) : chacun de ses N° est actuel.
  const actuellesCles = aa ? new Set(aa.articles.flatMap((a) => [a.cle, ...(a.aussi || []).map(cleNum)]).filter(Boolean)) : null;
  // Les fiches numérotées par N° : pour montrer une paire rangée qui n'est plus
  // une annonce actuelle, et savoir de quels comptes elle vient.
  const fichesParCle = {};
  for (const id of Object.keys(numeros)) {
    const f = numeros[id] || {}; const k = cleNum(f.numero); if (!k) continue;
    (fichesParCle[k] = fichesParCle[k] || []).push({ id, ...f });
  }
  // Toutes les lectures qui pourraient porter ce N° ont-elles répondu ? Sinon
  // « pas su » : la paire rangée n'est dite ni présente ni partie.
  const lusOk = new Set(lecture ? lecture.vinted.filter((c) => c.ok).map((c) => c.uid) : []);
  // Vestiaire : une lecture absente, ratée ou lue en partie, ou une annonce de
  // ce N° à l'état non dit ⇒ on ne dit rien de la paire rangée.
  const vcNonJugeesCles = new Set(aa ? (aa.vcNonJugees || []).map((x) => x.cle).filter(Boolean) : []);
  const jugeable = (k) => {
    if (!aa || !aa.su || !lecture.lbc || !lecture.ebay || (lecture.ebay.illisibles || []).length) return false;
    if (aa.manque.some((m) => m.plateforme === 'vestiaire') || vcNonJugeesCles.has(k)) return false;
    const cs = (fichesParCle[k] || []).map((f) => String(f.accountId || '')).filter(Boolean);
    return cs.length ? cs.every((u) => lusOk.has(u)) : lecture.vinted.every((c) => c.ok);
  };
  const etatsRangees = classerRangees({ slots, actuelles: actuellesCles, vendus, garder, jugeable, cle: cleNum });
  const correspondFiltre = (f) => (!filtrePlat || (f.plateformes || []).includes(filtrePlat)) && (!filtreCompte || (f.comptes || []).includes(filtreCompte));
  const filtreActif = !!(filtrePlat || filtreCompte);
  // Les articles montrés : les annonces actuelles (avec un N°), puis les paires
  // RANGÉES qui ne le sont plus (vendues, plus en ligne, gardées, pas su).
  const fiches = [];
  const vus = new Set();
  for (const a of (aa ? aa.articles : [])) {
    if (!a.cle || vus.has(a.cle)) continue; vus.add(a.cle);
    const v = (fichesParCle[a.cle] || [])[0];
    const fa = { id: a.ids[0], numero: a.numero, title: a.titre, photo: a.photo || (v && v.photo) || null, plateformes: a.plateformes, comptes: a.comptes, aussi: a.aussi, etatAnnonce: a.etat, actuelle: true };
    fiches.push(fa);
    // Son autre N° (même photo) : la même paire, montrée sous CE numéro s'il est dans une case.
    for (const n of (a.aussi || [])) { const kn = cleNum(n); if (kn && !vus.has(kn)) { vus.add(kn); if (slots[kn]) fiches.push({ ...fa, id: fa.id + ':' + kn, numero: n, aussi: [a.numero], doublure: true }); } }
  }
  for (const k of Object.keys(etatsRangees)) {
    if (vus.has(k)) continue;
    const tout = fichesParCle[k] || [];
    if (tout.length && tout.every((f) => horsCompte(f))) continue;   // compte écarté : pas montrée (comme avant)
    const f = tout.find((x) => !horsCompte(x)) || null; const j = (journal || {})[k];
    vus.add(k);
    fiches.push({ id: f ? f.id : 'n:' + k, numero: f ? f.numero : (j && j.num) || k, title: (f && f.title) || (j && j.titre) || '', photo: (f && f.photo) || null, plateformes: [], comptes: f && f.accountId ? [String(f.accountId)] : [], aussi: [], actuelle: false, rangee: etatsRangees[k] });
  }
  // Une paire REMISE à la main (« Remettre », sa case prise) attend dans « À
  // ranger », même hors des annonces actuelles : il a dit qu'elle est chez lui.
  const remises = load('vrm_stock_garder', {}) || {};
  for (const k of Object.keys(remises)) {
    if (vus.has(k) || slots[k]) continue;
    const f = (fichesParCle[k] || []).find((x) => !horsCompte(x) && !annonceDeclareePartie(x.id, numeros, pairsLost)); if (!f) continue;
    if (!resteAuStock(f, { pose: false, vendus, physiques: null, garder: remises, cle: cleNum })) continue;
    vus.add(k); fiches.push({ id: f.id, numero: f.numero, title: f.title || '', photo: f.photo || null, plateformes: [], comptes: [], aussi: [], actuelle: false, remise: true });
  }
  const ficheParCle = {}; fiches.forEach((f) => { const k = cleNum(f.numero); if (k && !ficheParCle[k]) ficheParCle[k] = f; });
  const rangeeEtat = (f) => etatsRangees[cleNum(f.numero)] || null;

  // Toute écriture des cases passe par la gravité des meubles qui l'ont.
  const tasserTout = (u, ms) => { let cur = u, b = {}; (ms || meubles).forEach((m) => { const r = tasserMeuble(cur, m, new Set(Object.keys(ficheParCle))); cur = r.slots; Object.assign(b, r.bouges); }); return { slots: cur, bouges: b }; };
  const ecrireSlots = (u, ms) => {
    const r = tasserTout(u, ms); ecrireSlotsBrut(r.slots);
    if (Object.keys(r.bouges).length) { setTombes(r.bouges); setTimeout(() => setTombes({}), 700); }
  };
  const cleDeFiche = (f) => cleNum(f.numero);
  // Rangée si l'un de ses N° (le sien, ou l'autre N° de la même paire) a une case.
  const posee = (f) => !!slots[cleDeFiche(f)] || (f.aussi || []).some((n) => !!slots[cleNum(n)]);
  const occupant = (mid, i) => { const k = Object.keys(slots).find((c) => slots[c] && slots[c].m === mid && slots[c].i === i && ficheParCle[c]); return k ? ficheParCle[k] : null; };
  // « À ranger » : les annonces actuelles SANS case (et les paires remises à la main).
  const aRanger = unParArticle(fiches.filter((f) => ((f.actuelle && f.etatAnnonce === 'enligne') || f.remise) && !f.doublure && correspondFiltre(f)).sort((a, b) => triNum(a.numero, b.numero)), { cle: cleNum, clePhoto: photoKey, estRangee: posee })
    .map((f) => ({ ...f, aussi: [...new Set([...((ficheParCle[cleNum(f.numero)] || {}).aussi || []), ...(f.aussi || [])])] }));
  const filtre = q.trim().toLowerCase();
  // Plusieurs mots : tous doivent y être (« nike 42 noir »). Un N° seul se juge
  // par IDENTITÉ (« 12 » ne montre pas la N°128) ; un mot cherche aussi le titre.
  const sansAccent = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const motsQ = sansAccent(filtre).replace(/^(numero|num|no|n°|n|#)\.?\s*(?=\w*\d)/, '').split(/\s+/).filter(Boolean);
  const qEstNum = motsQ.length === 1 && !!cleNum(motsQ[0]) && /\d/.test(motsQ[0]);
  const correspond = (f) => {
    if (!filtre) return true;
    if (qEstNum) {
      if (cleNum(f.numero) === cleNum(motsQ[0])) return true;
      // un nombre seul peut être une taille (« 42 ») : un MOT entier du titre
      return new RegExp('(^|[^0-9])' + motsQ[0].replace(/[^0-9a-z]/g, '') + '([^0-9]|$)').test(sansAccent(f.title));
    }
    const t = sansAccent(f.title) + ' n' + sansAccent(f.numero) + ' ' + sansAccent(f.numero);
    return motsQ.every((w) => t.includes(w));
  };
  const exactNum = (f) => qEstNum && cleNum(f.numero) === cleNum(motsQ[0]);
  const resultats = filtre ? fiches.filter(correspond).sort((a, b) => (exactNum(b) - exactNum(a)) || ((+cleNum(a.numero) || 0) - (+cleNum(b.numero) || 0))) : [];
  const ouEst = (f) => ouDansMeubles(f.numero, meubles, slots);
  // Montrer une paire : défiler jusqu'à SA case et la faire clignoter.
  const montrer = (f) => {
    const k = cleDeFiche(f); setFlash(k); setQ(''); setCibles([k]);   // la liste se referme, la case reste désignée
    setTimeout(() => setFlash((x) => (x === k ? null : x)), 4000);
  };
  // Défiler APRÈS le rendu (la liste vient de se refermer, la page a bougé).
  React.useEffect(() => {
    if (!flash) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      try { const el = document.querySelector(`[data-case-num="${CSS.escape(flash)}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
    }));
    return () => cancelAnimationFrame(id);
  }, [flash]);
  // Ordinateur : un chiffre tapé n'importe où sur le Stock ouvre la recherche.
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target; if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      if (document.querySelector('[data-stock-modale]') || document.querySelector('[data-inventaire]')) return;   // l'inventaire garde ses chiffres
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code || '');
      if (!m) return;
      e.preventDefault(); setQ(m[1]); setCibles([]);
      setTimeout(() => { try { chercheRef.current && chercheRef.current.focus(); } catch (_) {} }, 0);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  // (5 nov.) Ce qui est dans une case et n'est plus une annonce actuelle.
  const vendSortir = fiches.filter((f) => rangeeEtat(f) === 'vendue');
  const plusEnLigne = fiches.filter((f) => rangeeEtat(f) === 'plusenligne');
  const rangeesPasSu = fiches.filter((f) => rangeeEtat(f) === 'passu');
  const nVendus = vendSortir.length;
  const nEcartes = Object.keys(numeros).filter((id) => { const f = { id, ...(numeros[id] || {}) }; return String(f.numero == null ? '' : f.numero).trim() && !annonceDeclareePartie(f.id, numeros, pairsLost) && horsCompte(f); }).length;

  // ⚠️⚠️ 1er nov. (audit X7) — UNE CASE OCCUPÉE DEMANDE. Avant, toucher par erreur
  // une case pleine y posait la paire et renvoyait l'OCCUPANTE dans « À ranger »
  // sans un mot (le toast ne parlait que de la nouvelle) : son carton restait dans
  // la case, « Où est la N°12 ? » ne la trouvait plus, et le plan mentait. Une case
  // qui porte une paire PRÉSENTE (`ficheParCle`) pose la question : échanger (si la
  // paire qu'on range avait une place), choisir la nouvelle case de l'occupante, ou
  // la remettre « À ranger » — chaque issue DITE ; « Annuler » ne change rien.
  const poser = async (cle, mid, i) => {
    const u = { ...slots };
    // occupant éventuel de la case cible
    const occ = Object.keys(u).find((c) => u[c] && u[c].m === mid && u[c].i === i);
    const ancien = u[cle];
    const m = meubles.find((x) => x.id === mid); const f = ficheParCle[cle];
    const ici = (mm, ii) => { if (!mm) return 'cette case'; const p = placeDansMeubles(ii, mm); return `${mm.name} · rangée ${p.rangee}, colonne ${p.colonne}`; };
    let suite = null;
    if (occ && occ !== cle) {
      const fo = ficheParCle[occ];
      if (fo) {
        const mAncien = ancien ? meubles.find((x) => x.id === ancien.m) : null;
        const options = [];
        if (ancien && mAncien) options.push(['echanger', `Échanger : N°${fo.numero} va dans l'ancienne case de N°${f ? f.numero : cle} (${ici(mAncien, ancien.i)})`]);
        options.push(['choisir', `Je choisis maintenant la nouvelle case de N°${fo.numero}`]);
        options.push(['aranger', `N°${fo.numero} repart dans « À ranger » (il sort de cette case)`]);
        const choix = await askChoix({
          title: `${ici(m, i)} contient déjà N°${fo.numero}`,
          desc: `${fo.title ? '« ' + fo.title + ' »\n' : ''}Tu ranges N°${f ? f.numero : cle} dans cette case : où va N°${fo.numero} ?`,
          options, cancel: 'Annuler — ne rien changer',
        });
        if (choix == null) { toast(`Rien n'a changé : N°${fo.numero} reste dans ${ici(m, i)}.`); return false; }
        if (choix === 'echanger' && ancien && mAncien) { u[occ] = ancien; suite = `N°${fo.numero} est maintenant dans ${ici(mAncien, ancien.i)}.`; }
        else { delete u[occ]; suite = choix === 'choisir' ? `Touche la case où tu poses N°${fo.numero}.` : `N°${fo.numero} est dans « À ranger ».`; if (choix === 'choisir') setPlace(occ); }
      } else { if (ancien) u[occ] = ancien; else delete u[occ]; }   // case notée pour un article qui n'est plus là
    }
    u[cle] = { m: mid, i };
    ecrireSlots(u);
    // (1er nov.) Un geste réussi se DIT : où la paire vient d'être posée, avec
    // les mots du meuble (rangée, colonne) — la case qui clignote peut être
    // hors de l'écran sur téléphone.
    if (m) toast(`N°${f ? f.numero : cle} rangée : ${ici(m, i)}.${suite ? ' ' + suite : ''}`, 'ok');
    return true;
  };
  const retirerCase = (cle) => { const u = { ...slots }; delete u[cle]; ecrireSlots(u); };
  const sortir = (f) => {
    const cle = cleDeclarationPartie(f.numero, f.id, numeros);
    setPairsLost((prev) => { const u = { ...prev, [cle]: { id: String(f.id), at: new Date().toISOString(), title: f.title || '', from: 'stock' } }; save('vinted_pairs_lost', u); return u; });
    retirerCase(cleDeFiche(f));
    toast(`N°${f.numero} sortie du stock — son numéro reste pris, jamais redonné.`, 'ok');
  };
  const cliquerCase = (mid, i) => {
    setChoisie(null);
    const occ = occupant(mid, i);
    if (place) { const p = place; setPlace(null); poser(p, mid, i); return; }
    if (occ) setModal({ type: 'fiche', cle: cleDeFiche(occ) });
    else setModal({ type: 'placer', m: mid, i });
  };

  // ── Vignette d'un article dans une case ────────────────────────────────
  // (5 nov.) Le N° en bas à gauche, lisible sur toute photo (pastille encre) ;
  // « Vendue » en haut, à l'accent — jamais rouge (§7 : rien d'irréversible).
  // (5 nov.) Rangée mais plus une annonce actuelle : « Plus en ligne », à l'ambre.
  const Vignette = ({ f, sold, hors = false, mini = false }) => (
    <>
      {f.photo
        ? <PhotoVinted src={f.photo} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span className="vrm-s2d-sansphoto" aria-hidden="true">{String(f.title || '').trim().slice(0, 1).toUpperCase() || '·'}</span>}
      <span className="vrm-s2d-num" data-vendue={sold ? '1' : undefined} data-hors-ligne={!sold && hors ? '1' : undefined}>N°{f.numero}</span>
      {sold && !mini && <span className="vrm-s2d-vendue">Vendue</span>}
      {!sold && hors && !mini && <span className="vrm-s2d-horsligne">Plus en ligne</span>}
    </>
  );

  const total = (m) => m.cols * m.rows;
  // Glisser à la SOURIS (le doigt garde « touche un article puis une case ») :
  // la même pose que le toucher (`poser`, qui DEMANDE si la case est prise).
  const dragProps = (cle) => (souris ? {
    draggable: true,
    onDragStart: (e) => { try { e.dataTransfer.setData('text/plain', 'vrm-num:' + cle); e.dataTransfer.effectAllowed = 'move'; } catch (_) {} setGlisse(cle); setPlace(null); },
    onDragEnd: () => { setGlisse(null); setSurvol(null); },
  } : {});
  const dropProps = (mid, i) => (souris ? {
    onDragOver: (e) => { if (!glisse) return; e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (_) {} const k = mid + ':' + i; if (survol !== k) setSurvol(k); },
    onDragLeave: () => setSurvol((x) => (x === mid + ':' + i ? null : x)),
    onDrop: (e) => { e.preventDefault(); let k = glisse; try { const d = e.dataTransfer.getData('text/plain'); if (/^vrm-num:/.test(d)) k = d.slice(8); } catch (_) {} setGlisse(null); setSurvol(null); if (k) poser(k, mid, i); },
  } : {});
  const cadreMeuble = (m) => {
    const filled = Array.from({ length: total(m) }).filter((_, i) => occupant(m.id, i)).length;
    const cherche = !!(filtre || cibles.length);
    const nIci = cherche ? Array.from({ length: total(m) }).filter((_, i) => { const o = occupant(m.id, i); if (!o) return false; const k = cleDeFiche(o); return cibles.includes(k) || (filtre && correspond(o)); }).length : 0;
    const nVenduesIci = Array.from({ length: total(m) }).filter((_, i) => { const o = occupant(m.id, i); return o && (estVendu(o) || rangeeEtat(o) === 'plusenligne'); }).length;
    // Pendant une recherche, un meuble où rien ne correspond se replie : celui
    // qui contient l'article remonte sous les yeux.
    const replie = cherche && nIci === 0 && meubles.length > 1 && !(choisie && choisie.m === String(m.id));
    const casesPl = planchesCases(m.planches, m.cols, m.rows);
    const gap = zoom === 'loin' ? 4 : 6;
    return (
      <section key={m.id} data-meuble={m.id} data-meuble-ici={cherche ? nIci : undefined} className="vrm-s2d-meuble" data-replie={replie ? '1' : undefined}>
        <div className="vrm-s2d-tete">
          <span className="vrm-s2d-nom">{m.name}</span>
          <span className="vrm-s2d-compte" data-meuble-plein={filled}>{filled}/{total(m)} · {m.cols}×{m.rows}{m.gravite ? ' · empilé' : ''}</span>
          {nVenduesIci > 0 && !cherche && <span className="vrm-s2d-pastille" data-meuble-vendues={nVenduesIci}>{nVenduesIci} à sortir</span>}
          {cherche && <span className="vrm-s2d-pastille" data-vide={nIci ? undefined : '1'}>{nIci ? `${nIci} ici` : 'rien ici'}</span>}
          <span style={{ flex: 1 }} />
          <button className="vrm-b vrm-b-secondaire vrm-b-petit vrm-b-icone" type="button" onClick={() => setModal({ type: 'meuble', id: m.id, name: m.name, cols: m.cols, rows: m.rows, planches: planchesDe(m), gravite: !!m.gravite })} aria-label="Modifier le meuble" style={{ width: 44, height: 44, display: 'grid', placeItems: 'center' }}><Icon name="pencil" size={15} /></button>
        </div>
        {!replie && (
        <div className="vrm-s2d-defile">
        <div className="vrm-s2d-etagere" data-meuble-grille="" data-zoom={zoom} data-glisse={glisse ? '1' : undefined} style={{ gridTemplateColumns: `16px repeat(${m.cols},minmax(44px,1fr))`, gap, maxWidth: `max(min(100%, ${m.cols * (caseMax + gap) + 34}px), ${m.cols * (44 + gap) + 34}px)` }}>
          {/* Règle : colonnes numérotées au-dessus, rangées à gauche (comme sur le meuble). */}
          <span />
          {Array.from({ length: m.cols }).map((_, c) => <span key={'c' + c} data-regle-col={c + 1} className="vrm-s2d-regle">{c + 1}</span>)}
          {Array.from({ length: total(m) }).map((_, i) => {
            const occ = occupant(m.id, i); const sold = occ && estVendu(occ); const kOcc = occ ? cleDeFiche(occ) : null;
            const estChoisie = !!(choisie && choisie.m === String(m.id) && choisie.i === i);
            const vise = estChoisie || (kOcc && (flash === kOcc || cibles.includes(kOcc) || (filtre && correspond(occ))));
            const dim = estChoisie ? false : occ ? ((cherche && !vise) || (filtreActif && !cherche && !correspondFiltre(occ))) : cherche;
            const pl = placeDansMeubles(i, m);
            const hors = !!occ && rangeeEtat(occ) === 'plusenligne';
            const etat = hors && !sold ? 'plusenligne' : etatCase(occ, { vendus, cle: cleNum });
            const classes = ['vrm-s2d-case', 'is-' + etat, vise ? 'is-vise' : '', dim ? 'is-terne' : '', place ? 'is-cible' : '', survol === m.id + ':' + i ? 'is-survol' : '', glisse && glisse === kOcc ? 'is-glisse' : '',
              flash && flash === kOcc ? 'vrm-case-flash' : '', kOcc && tombes[kOcc] ? 'vrm-case-tombe' : ''].filter(Boolean).join(' ');
            return (
              <React.Fragment key={i}>
              {pl.colonne === 1 && <span data-regle-rang={pl.rangee} className="vrm-s2d-regle">{pl.rangee}</span>}
              <button type="button" onClick={() => cliquerCase(m.id, i)} aria-label={occ ? `N°${occ.numero}${sold ? ' (vendue, à sortir)' : (hors ? ' (plus en ligne)' : '')} — rangée ${pl.rangee}, colonne ${pl.colonne}` : `Case vide — rangée ${pl.rangee}, colonne ${pl.colonne}`} title={`Rangée ${pl.rangee}, colonne ${pl.colonne}`}
                data-case-num={kOcc || undefined} data-case-vise={vise ? '' : undefined} data-case-choisie={estChoisie ? '' : undefined} aria-current={estChoisie ? 'location' : undefined} data-cible={attrCible(['case', m.id, i])} data-case-etat={etat} data-case-ici={m.id + ':' + i} data-tombe={kOcc && tombes[kOcc] ? tombes[kOcc] : undefined} className={classes}
                {...(occ ? dragProps(kOcc) : {})} {...dropProps(m.id, i)}
                style={kOcc && tombes[kOcc] ? { '--vrm-tombe': `calc(${-tombes[kOcc]} * (100% + ${gap}px))` } : undefined}>
                {occ ? <Vignette f={occ} sold={sold} hors={hors} /> : <span className="vrm-s2d-plus" aria-hidden="true">+</span>}
              </button>
              {pl.colonne === m.cols && pl.rangee < m.rows && (() => {
                const ks = Array.from({ length: m.cols }, (_, c) => casesPl.has(pl.rangee + ':' + (c + 1)));
                if (ks.every(Boolean)) return <span data-planche={pl.rangee} aria-hidden="true" className="vrm-s2d-planche" style={{ gridColumn: '2 / -1' }} />;
                if (!ks.some(Boolean)) return null;
                return <>{<span aria-hidden="true" />}{ks.map((o, c) => <span key={'p' + c} data-planche-case={o ? pl.rangee + ':' + (c + 1) : undefined} aria-hidden="true" className={o ? 'vrm-s2d-planche' : 'vrm-s2d-planche-vide'} />)}</>;
              })()}
              </React.Fragment>
            );
          })}
          <span aria-hidden="true" className="vrm-s2d-socle" style={{ gridColumn: '1 / -1' }} />
        </div>
        </div>)}
      </section>
    );
  };

  // ── Modale (créer/modifier un meuble · choisir un article · fiche) ──────
  const fermerModal = () => setModal(null);
  const Modale = () => {
    if (!modal) return null;
    let corps = null;
    if (modal.type === 'meuble') {
      corps = <EditeurMeuble modal={modal} onSave={(nom, cols, rows, extra = {}) => {
        const planches = planchesRangees(planchesCases(extra.planches, cols, rows), cols, rows), gravite = !!extra.gravite;
        if (modal.id) { const ancien = meubles.find((x) => x.id === modal.id) || {};
          const u = meubles.map((x) => x.id === modal.id ? { ...x, name: nom, cols, rows, planches, gravite } : x);
          // Les paires gardent leur rangée et leur colonne quand le nombre de
          // colonnes change ; celles hors des nouvelles cases repartent « à ranger ».
          const oc = Math.max(1, +ancien.cols || cols), us = { ...slots };
          Object.keys(us).forEach((c) => { const v = us[c]; if (!v || v.m !== modal.id) return; const r = Math.floor(v.i / oc), co = v.i % oc; if (r >= rows || co >= cols) delete us[c]; else us[c] = { m: modal.id, i: r * cols + co }; });
          ecrireMeubles(u); ecrireSlots(us, u);
        } else { ecrireMeubles([...meubles, { id: 'm' + Date.now().toString(36), name: nom, cols, rows, planches, gravite }]); }
        fermerModal();
      }} onDelete={modal.id ? async () => {
        if (!(await askConfirm({ titre: 'Supprimer ce meuble ?', desc: 'Les articles qu\'il contient repartent dans « À ranger ». Aucun numéro n\'est perdu.', danger: true, ok: 'Supprimer' }))) return;
        const us = { ...slots }; Object.keys(us).forEach((c) => { if (us[c] && us[c].m === modal.id) delete us[c]; });
        ecrireMeubles(meubles.filter((x) => x.id !== modal.id)); ecrireSlots(us); fermerModal();
      } : null} />;
    } else if (modal.type === 'placer') {
      const m = meubles.find((x) => x.id === modal.m);
      corps = (<>
        <h3 style={{ margin: '0 0 2px', fontSize: 17, color: C.text }}>Ranger dans {m ? m.name : ''}</h3>
        <div data-placer-case={m ? `${placeDansMeubles(modal.i, m).rangee}:${placeDansMeubles(modal.i, m).colonne}` : ''} style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>{m ? <>Rangée {placeDansMeubles(modal.i, m).rangee}, colonne {placeDansMeubles(modal.i, m).colonne}</> : 'Cette case'} · choisis l'article à y poser</div>
        {aRanger.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '52vh', overflowY: 'auto' }}>
          {aRanger.map((f) => (
            <button type="button" key={f.id} onClick={() => { poser(cleDeFiche(f), modal.m, modal.i); fermerModal(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 8px', borderRadius: 12, border: 'none', background: 'transparent', color: C.text, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <span style={{ position: 'relative', width: 46, height: 46, borderRadius: 12, overflow: 'hidden', flex: 'none', background: C.card2 }}><Vignette f={f} sold={estVendu(f)} /></span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.title || '—'}</span>
              <span style={{ fontWeight: 800, color: estVendu(f) ? C.accent : C.muted }}>N°{f.numero}</span>
            </button>
          ))}
        </div> : <div style={{ color: C.muted, padding: '22px 0', textAlign: 'center' }}>Tous tes articles sont déjà rangés 👌</div>}
      </>);
    } else if (modal.type === 'fiche') {
      const f = ficheParCle[modal.cle]; if (!f) { fermerModal(); return null; }
      const sold = estVendu(f); const s = slots[modal.cle]; const m = s && meubles.find((x) => x.id === s.m);
      const hors = !sold && rangeeEtat(f) === 'plusenligne';
      corps = (<>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 10 }}>
          <span style={{ position: 'relative', width: 72, height: 72, borderRadius: 12, overflow: 'hidden', flex: 'none', background: C.card2 }}><Vignette f={f} sold={sold} hors={hors} /></span>
          <div><div style={{ fontSize: 17, fontWeight: 800, color: C.text, lineHeight: 1.25 }}>{f.title || '—'}</div><div data-fiche-statut={sold ? 'vendue' : (hors ? 'plusenligne' : (f.actuelle ? 'actuelle' : 'autre'))} style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{sold ? 'Vendu — à sortir du stock' : (hors ? 'Plus en ligne — plus une annonce actuelle' : (f.actuelle ? `En ligne${(f.plateformes || []).length ? ' sur ' + f.plateformes.map((x) => NOM_PLAT_FILTRE[x] || x).join(' et ') : ''}` : 'En stock'))} · N°{f.numero}</div></div>
        </div>
        <div style={{ textAlign: 'center', background: C.card2, border: `1px solid ${sold ? C.accent : C.line}`, borderRadius: 14, padding: 14, margin: '12px 0' }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{sold ? 'Va le chercher' : 'Rangé dans'}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: sold ? C.accent : C.text, marginTop: 4 }}>{m ? m.name : 'Pas rangé'}</div>
          {m && (() => { const p = placeDansMeubles(s.i, m); return <div data-fiche-place="" style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 4 }}>Rangée {p.rangee} <span style={{ color: C.muted, fontWeight: 500 }}>(en partant du haut)</span> · colonne {p.colonne} <span style={{ color: C.muted, fontWeight: 500 }}>(depuis la gauche)</span></div>; })()}
          {!m && (() => { const a = ancienneplace(f.numero); return a ? <div data-fiche-ancienne-place="" style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.4 }}>Ancienne place, dans la pièce 3D (plus affichée) : <b style={{ color: C.text }}>{[a.roomName, a.itemName, a.nom].filter(Boolean).join(' · ')}</b></div> : null; })()}
        </div>
        {/* (5 nov.) « Voir l'état » : la fiche complète du N°, avec tout ce qui se
            calcule (prix d'achat, temps achat → vente, réception → mise en ligne,
            mise en ligne → vente, republications) — `etatArticle`. */}
        <button className="vrm-b vrm-b-secondaire" type="button" data-fiche-voir-etat={cleDeFiche(f)} onClick={() => { const n = String(f.numero); fermerModal(); try { window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: n })); } catch (_) {} }} style={{ width: '100%', marginBottom: 9 }}>Voir l’état</button>
        <div style={{ display: 'flex', gap: 9 }}>
          {/* (1er nov.) Une paire PAS rangée : « Déplacer » et « Retirer de la case »
              ne voulaient rien dire. Le geste est de la ranger. */}
          <button className="vrm-b vrm-b-secondaire" type="button" data-fiche-ranger={m ? 'deplacer' : 'ranger'} onClick={() => { setPlace(modal.cle); fermerModal(); }} style={btnSec}>{m ? 'Déplacer' : 'Ranger dans une case'}</button>
          {m && <button className="vrm-b vrm-b-secondaire" type="button" data-fiche-retirer="" onClick={() => { const n = f.numero; retirerCase(modal.cle); fermerModal(); toast(`N°${n} retirée de ${m.name} : elle repasse dans « À ranger ».`); }} style={btnSec}>Retirer de la case</button>}
        </div>
        {sold && <button className="vrm-b vrm-b-primaire" type="button" onClick={() => { sortir(f); fermerModal(); }} style={{ ...btnPri, width: '100%', marginTop: 9 }}>✓ Je l'ai sorti du stock</button>}
        {hors && <button className="vrm-b vrm-b-secondaire" type="button" data-fiche-encore-la="" onClick={() => { encoreLa(f); fermerModal(); }} style={{ width: '100%', marginTop: 9 }}>Elle est encore là</button>}
      </>);
    }
    return (
      <div data-stock-modale="" onClick={fermerModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div className="vrm-feuille-surface" onClick={(e) => e.stopPropagation()} style={{ width: 'min(540px,100%)', maxHeight: '86vh', overflowY: 'auto', background: C.card, border: `1px solid ${C.line}`, borderRadius: '20px 20px 0 0', padding: '18px 18px calc(20px + env(safe-area-inset-bottom,0px))' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={fermerModal} aria-label="Fermer" style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button></div>
          {corps}
        </div>
      </div>
    );
  };

  const btnSec = { flex: 1 };
  const btnPri = {};

  // (5 nov.) Rangée, plus en ligne, mais il dit qu'elle est encore là (une
  // annonce en pause, une paire à republier) : la case n'est plus signalée.
  const encoreLa = (f) => {
    const k = cleDeFiche(f); const g = { ...(load('vrm_stock_garde_hors_ligne', {}) || {}) }; g[k] = Date.now();
    saveTout('vrm_stock_garde_hors_ligne', g); setTic((x) => x + 1);
    toast(`N°${f.numero} reste dans sa case : elle n'est plus signalée « plus en ligne ».`, 'ok');
  };
  const sortirDeLaCase = (f) => {
    const k = cleDeFiche(f); const ou = ouEst(f); retirerCase(k);
    toast(`N°${f.numero} retirée${ou ? ' de ' + ou.meuble.name : ''} : la case est libre, le numéro reste pris (jamais redonné).`, 'ok');
  };

  // ── (5 nov.) LES CHIFFRES EN TÊTE : les annonces actuelles ─────────────────
  // N annonces actuelles (une par paire), dont « à confirmer » NOMMÉ, dont
  // masquées par Vinted ; « au moins » si une lecture manque (nommée) ; rien lu
  // ⇒ « — » et la raison, jamais « aucune annonce ».
  const comptesNoms = new Map((lecture ? lecture.vinted : []).map((c) => [c.uid, c.nom]));
  // (11 nov., lot DJ4) Le Stock = les paires EN LIGNE ; « à confirmer » et « masquées par Vinted »
  // sont dites à part (`partagerParEtat`, src/stockAnnonces.js), jamais mêlées.
  const parEtat = partagerParEtat(aa ? aa.articles.filter(correspondFiltre) : []);
  const articlesVus = parEtat.enLigne;
  const nAffiche = articlesVus.length;
  const nAConf = parEtat.aConfirmer.length;
  const nMasq = parEtat.masquees.length;
  const articleRange = (a) => !!a.cle && (!!slots[a.cle] || (a.aussi || []).some((n) => !!slots[cleNum(n)]));
  const nRangees = articlesVus.filter(articleRange).length;
  const nSansNum = articlesVus.filter((a) => !a.cle).length;
  const platsPresents = aa ? [...new Set(aa.articles.flatMap((a) => a.plateformes))] : [];
  const comptesPresents = aa ? [...new Set(aa.articles.flatMap((a) => a.comptes))] : [];
  // Les lectures qui manquent, NOMMÉES : « compte_beta sur Vinted, Leboncoin ».
  // (5 nov.) Vestiaire : la raison est dite (« jamais lu », « lue en partie »), avec le geste.
  const MOT_MANQUE_VC = { 'pas lu': 'Vestiaire (lecture ratée)', 'jamais lu': 'Vestiaire (jamais lu : ouvre « Mes articles » sur vestiairecollective.com)', 'lue en partie': 'Vestiaire (liste lue en partie : ouvre « Mes articles » jusqu’en bas)' };
  const manqueTxt = aa ? (() => { const v = aa.manque.filter((x) => x.plateforme === 'vinted').map((x) => x.nom); const e = aa.manque.filter((x) => x.plateforme === 'ebay').map((x) => (x.nom === 'eBay' ? 'eBay' : `${x.nom} sur eBay`)); const l = aa.manque.some((x) => x.plateforme === 'leboncoin') ? ['Leboncoin'] : [];
    const vc = aa.manque.filter((x) => x.plateforme === 'vestiaire').map((x) => MOT_MANQUE_VC[x.raison] || 'Vestiaire');
    return [...(v.length ? [`${v.join(', ')} sur Vinted`] : []), ...e, ...l, ...vc].join(', '); })() : '';
  const sansNumAutres = aa ? (aa.sansNumero.ebay + aa.sansNumero.leboncoin) : 0;
  const vcSansNum = aa ? (aa.vcSansNumero || []) : [];
  const vcNonDites = aa ? (aa.vcNonJugees || []) : [];
  const aConfVoir = aa ? aa.aConfirmerComptes.filter((c) => !filtreCompte || c.uid === filtreCompte) : [];
  const aConfTxt = aConfVoir.map((c) => (c.plateforme === 'vestiaire' ? (c.vieille ? `Vestiaire, ${depuisQuand(c.lu)}` : 'Vestiaire, plus vues dans ta dernière liste') : c.plateforme === 'leboncoin' ? `Leboncoin, ${quandLectureLbc(c.lu)}` : `${c.nom}, ${depuisQuand(c.lu)}`)).join(' ; ');
  const aConfGeste = [aConfVoir.some((c) => c.plateforme === 'vinted') ? 'plus de 24 h : repasse sur Vinted avec ce compte' : '', aConfVoir.some((c) => c.plateforme === 'vestiaire') ? 'ouvre « Mes articles » sur Vestiaire' : '', aConfVoir.some((c) => c.plateforme === 'leboncoin') ? 'ouvre « Mes annonces » sur leboncoin.fr' : ''].filter(Boolean).join(' ; ');
  const blocResume = (
    <Card style={{ padding: '13px 14px' }}>
      <div className="vrm-s2d-resume" data-stock-actuelles={lecture === undefined ? 'encours' : (aa && aa.su ? nAffiche : 'passu')} data-stock-au-moins={aa && aa.auMoins ? '1' : '0'} data-stock-a-confirmer={aa && aa.su ? nAConf : undefined} data-stock-masquees={aa && aa.su ? nMasq : undefined} data-stock-rangees={aa && aa.su ? nRangees : undefined}>
        <div className="vrm-s2d-resume-n">
          {/* (11 nov., états vides) « au moins 0 » ne se dit jamais (§5) : rien lu et une lecture qui manque ⇒ « — ». */}
          {lecture === undefined ? '…' : (aa && aa.su && !(aa.auMoins && nAffiche === 0) ? <>{aa.auMoins ? <span style={{ fontSize: 15, fontWeight: 600 }}>au moins </span> : null}{nAffiche}</> : '—')}
          <small>{nAffiche === 1 && aa && aa.su ? 'paire en ligne' : 'paires en ligne'}{filtreActif ? ' (filtrées)' : ''}</small>
        </div>
        {/* (6 nov.) La lecture garde la place des lignes qui suivront (trois lignes) : le Stock ne saute plus quand elles arrivent. */}
        {lecture === undefined && <div className="vrm-s2d-resume-l" data-stock-resume-attente="" style={{ minHeight: 'calc(3 * 1.45em)' }}>Je lis tes annonces Vinted, Leboncoin, eBay et Vestiaire…</div>}
        {/* (11 nov., états vides) Aucun compte Vinted relié (liste LUE et vide) : le geste qui remplit le Stock. */}
        {comptesLus && Array.isArray(accounts) && accounts.length === 0 && lecture !== undefined && <div data-stock-sans-compte="" style={{ marginTop: 10 }}>
          <Bouton variante="primaire" icone="link" onClick={() => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=vintedaccounts' })); } catch (_) {} }}>Relier un compte</Bouton>
        </div>}
        {lecture && !aa.su && <div className="vrm-s2d-resume-l" data-stock-passu="">Annonces pas lues{manqueTxt ? ` (${manqueTxt})` : ''}, rien n'est perdu : ouvre Vinted {NAV.dans}.</div>}
        {/* (9 nov., lot AI — Julien : « ça fait très moche ») UNE ligne courte (rangées · à ranger, et le
            signal de ce qui manque) ; la phrase d'avant, entière, dans sa pop-up. Ambre : un geste à faire. */}
        {aa && aa.su && <InfoPop nom="stock-resume" titre="Tes annonces actuelles" className="vrm-s2d-resume-l"
          ton={nAConf > 0 || aa.manque.length > 0 || aa.vcVieille ? 'ambre' : 'neutre'}
          attrs={{ 'data-stock-resume-court': '' }}
          puces={nAffiche > 0
            ? [{ texte: `${nRangees} rangée${nRangees > 1 ? 's' : ''}` }, { texte: `${nAffiche - nRangees - nSansNum} à ranger` },
               nAConf > 0 ? { texte: `${nAConf} à confirmer`, ton: 'ambre' } : null, aa.manque.length > 0 ? { texte: 'Pas tout lu', ton: 'ambre' } : null,
               nSansNum + sansNumAutres + vcSansNum.length > 0 ? { texte: `${nSansNum + sansNumAutres + vcSansNum.length} sans N°` } : null].filter(Boolean)
            : [{ texte: 'Aucune annonce lue' }, aa.manque.length > 0 ? { texte: 'Pas tout lu', ton: 'ambre' } : null].filter(Boolean)}
          phrase={aa.manque.length > 0 ? 'Une lecture manque : ouvre ce site avec l’extension.' : nAConf > 0 ? 'À confirmer : repasse sur ce compte pour le relire.' : nAffiche - nRangees - nSansNum > 0 ? 'Range chaque paire : touche « Ranger » dans la liste.' : 'Tout ce qui est en ligne est rangé.'}>
        <div data-stock-resume-detail="">
          {nAffiche > 0 ? <><b>{nRangees}</b> rangée{nRangees > 1 ? 's' : ''} · <b>{nAffiche - nRangees - nSansNum}</b> pas encore rangée{nAffiche - nRangees - nSansNum > 1 ? 's' : ''}</> : 'Aucune annonce en ligne lue'}
          {nAConf > 0 && <span data-stock-a-confirmer-noms=""> · à part : <b>{nAConf}</b> à confirmer ({aConfTxt} — {aConfGeste})</span>}
          {aa.vcVieille && !aConfVoir.some((c) => c.plateforme === 'vestiaire') && <span data-stock-vc-vieille=""> · Vestiaire {depuisQuand(aa.vcVieille.lu)} : ouvre « Mes articles » sur Vestiaire</span>}
          {nMasq > 0 && <> · à part : <b>{nMasq}</b> masquée{nMasq > 1 ? 's' : ''} par Vinted (toujours chez toi)</>}
          {nSansNum > 0 && <> · <b>{nSansNum}</b> sans N° (donne-leur un N° dans Annonces pour les ranger)</>}
          {aa.manque.length > 0 && <span data-stock-manque=""> · pas lu : {manqueTxt}</span>}
          {sansNumAutres > 0 && <> · {sansNumAutres} annonce{sansNumAutres > 1 ? 's' : ''} {aa.sansNumero.leboncoin && aa.sansNumero.ebay ? 'Leboncoin et eBay' : (aa.sansNumero.leboncoin ? 'Leboncoin' : 'eBay')} sans N° pas comptée{sansNumAutres > 1 ? 's' : ''} (rien ne dit quelle paire c'est)</>}
          {vcSansNum.length > 0 && <span data-stock-vc-sans-numero={vcSansNum.length}> · {vcSansNum.length} annonce{vcSansNum.length > 1 ? 's' : ''} Vestiaire sans N° pas comptée{vcSansNum.length > 1 ? 's' : ''} : {vcSansNum.slice(0, 4).map((x) => `« ${x.titre || 'sans titre lu'} »`).join(', ')}{vcSansNum.length > 4 ? '…' : ''} (le N° arrive quand VRM a relu tes numéros — jamais deviné par le titre)</span>}
          {vcNonDites.length > 0 && <span data-stock-vc-non-dites={vcNonDites.length}> · {vcNonDites.length} annonce{vcNonDites.length > 1 ? 's' : ''} Vestiaire à l'état non dit (ni en ligne ni partie) pas comptée{vcNonDites.length > 1 ? 's' : ''}</span>}
        </div></InfoPop>}
        {aa && aa.su && (platsPresents.length > 1 || comptesPresents.length > 1) && (
          <div className="vrm-s2d-filtres" data-stock-filtres="">
            {platsPresents.length > 1 && <div className="vrm-rangee vrm-filtres" role="group" aria-label="Filtrer par plateforme" data-stock-filtre-plat={filtrePlat || 'toutes'}>
              {['', ...platsPresents].map((x) => <button key={x || 'toutes'} type="button" aria-pressed={filtrePlat === x} data-plat={x || 'toutes'} onClick={() => setFiltrePlat(x)}>{x ? (NOM_PLAT_FILTRE[x] || x) : 'Toutes'}</button>)}
            </div>}
            {comptesPresents.length > 1 && <select aria-label="Filtrer par compte" data-stock-filtre-compte={filtreCompte || 'tous'} value={filtreCompte} onChange={(e) => setFiltreCompte(e.target.value)}>
              <option value="">Tous les comptes</option>
              {comptesPresents.map((u) => <option key={u} value={u}>{comptesNoms.get(u) || u}</option>)}
            </select>}
          </div>
        )}
      </div>
    </Card>
  );
  // (11 nov., lot actions-serie) Les rangées « Vendues à sortir » et « Plus en ligne » :
  // sélectionner plusieurs paires, agir une fois. « Enlever du stock » = le geste de la
  // ligne (« Je l'ai sortie » pour une vendue : partie + case libérée ; « Je l'ai retirée »
  // pour une plus en ligne : la case seule), écrit EN UNE FOIS (une écriture des cases,
  // pas N écritures qui s'écrasent), après une confirmation qui nomme les N°.
  const serieStock = useSelectionSerie(useMemo(() => [...vendSortir, ...plusEnLigne].map(cleDeFiche), [vendSortir.map(cleDeFiche).join('|'), plusEnLigne.map(cleDeFiche).join('|')]), { nom: 'stock' });
  const actionsSerieStock = () => {
    const parCle = new Map([...vendSortir, ...plusEnLigne].map((f) => [cleDeFiche(f), f]));
    const lignes = (cles) => cles.map((k) => parCle.get(k)).filter(Boolean);
    return [
      { k: 'enlever', libelle: 'Enlever du stock', icone: 'check', variante: 'primaire', faire: async (cles) => {
        const { ok, pasFaits } = trierSerie(lignes(cles), (f) => (ouEst(f) || slots[cleDeFiche(f)]) ? true : 'case introuvable');
        if (!ok.length) return resumeSerie({ faits: [], pasFaits }, { un: 'enlevée', plusieurs: 'enlevées' });
        const nv = ok.filter((f) => rangeeEtat(f) === 'vendue').length;
        if (!(await askConfirm({ title: `Enlever ${ok.length} paire${ok.length > 1 ? 's' : ''} du stock ?`, desc: `${ok.map((f) => 'N°' + f.numero).join(', ')}\n${nv ? `${nv} vendue${nv > 1 ? 's' : ''} : sortie${nv > 1 ? 's' : ''} du stock. ` : ''}${ok.length - nv ? `${ok.length - nv} plus en ligne : la case se libère. ` : ''}Les numéros restent pris, jamais redonnés.`, ok: 'Enlever', cancel: 'Annuler' }))) return { annule: true };
        const u = { ...slots }; for (const f of ok) delete u[cleDeFiche(f)];
        const vendues = ok.filter((f) => rangeeEtat(f) === 'vendue');
        if (vendues.length) setPairsLost((prev) => { const n = { ...prev }; const at = new Date().toISOString(); for (const f of vendues) n[cleDeclarationPartie(f.numero, f.id, numeros)] = { id: String(f.id), at, title: f.title || '', from: 'stock' }; save('vinted_pairs_lost', n); return n; });
        ecrireSlots(u);
        return resumeSerie({ faits: ok, pasFaits }, { un: 'enlevée du stock', plusieurs: 'enlevées du stock' });
      } },
      { k: 'exporter', libelle: 'Exporter', icone: 'doc', faire: (cles) => {
        const L = lignes(cles);
        const csv = csvDe(['N°', 'Article', 'État', 'Meuble', 'Rangée', 'Colonne'], L.map((f) => { const ou = ouEst(f); return [f.numero, f.title || '', rangeeEtat(f) === 'vendue' ? 'vendue à sortir' : 'plus en ligne', ou ? ou.meuble.name : '', ou ? ou.rangee : '', ou ? ou.colonne : '']; }));
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `stock-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
        return resumeSerie({ faits: L, pasFaits: [] }, { un: 'paire exportée', plusieurs: 'paires exportées' });
      } },
    ];
  };
  // ── Vendues à sortir · Plus en ligne : rangées, plus des annonces actuelles ──
  const ligneRangee = (f, gestes) => { const ou = ouEst(f); const sold = estVendu(f); return (
    <div key={f.id} {...serieStock.ligne(cleDeFiche(f))} className="vrm-s2d-liste-ligne" data-stock-rangee={cleDeFiche(f)} style={{ flexWrap: 'wrap' }}>
      <span className="vrm-s2d-vig"><CaseSerie serie={serieStock} cle={cleDeFiche(f)} etiquette={'N°' + f.numero} surPhoto/><Vignette f={f} sold={sold} hors={!sold && rangeeEtat(f) === 'plusenligne'} mini /></span>
      <span className="vrm-s2d-txt"><span className="vrm-s2d-txt-t"><b>N°{f.numero}</b> · {f.title || '—'}</span>
        <span className="vrm-s2d-txt-s">{ou ? <><b>{ou.meuble.name}</b> · rangée {ou.rangee}, colonne {ou.colonne}</> : 'case introuvable'}</span></span>
      <div className="vrm-s2d-gestes">{ou && <button className="vrm-b vrm-b-secondaire" type="button" onClick={() => montrer(f)}>Voir la case</button>}{gestes}</div>
    </div>); };
  const blocVendues = vendSortir.length ? (
    <Card style={{ padding: '12px 13px' }}>
      <div data-stock-vendues-sortir={vendSortir.length}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Vendues à sortir · {vendSortir.length}</span>
          <span style={{ flex: 1 }} />
          <OuvrirSerie serie={serieStock}/>
          {vendSortir.length > 1 && <button className="vrm-b vrm-b-discret" type="button" data-vendues-chercher={vendSortir.length} onClick={() => { setQ(''); setCibles(vendSortir.map(cleDeFiche)); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {} }}>Le chemin pour les sortir</button>}
        </div>
        {vendSortir.map((f) => ligneRangee(f, <button className="vrm-b vrm-b-primaire" type="button" data-stock-sortir={cleDeFiche(f)} onClick={() => sortir(f)}>✓ Je l'ai sortie</button>))}
      </div>
    </Card>) : null;
  const barreSerieStock = <BarreSerie serie={serieStock} actions={actionsSerieStock()} rendreIcone={(n, t) => <Icon name={n} size={t}/>}/>;
  const blocPlusEnLigne = plusEnLigne.length ? (
    <Card style={{ padding: '12px 13px' }}>
      <div data-stock-plus-en-ligne={plusEnLigne.length}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Plus en ligne · {plusEnLigne.length}</div>
        <InfoPop nom="stock-plus-en-ligne" titre="Plus en ligne" style={{ margin: '2px 0 4px' }} resume="Retire-les de leur case, ou garde-les">
          <p>Rangées, mais plus en annonce : retire-les de leur case, ou garde-les.</p>
        </InfoPop>
        {plusEnLigne.map((f) => ligneRangee(f, <>
          <button className="vrm-b vrm-b-secondaire" type="button" data-stock-retirer-case={cleDeFiche(f)} onClick={() => sortirDeLaCase(f)}>Je l'ai retirée</button>
          <button className="vrm-b vrm-b-discret" type="button" data-stock-encore-la={cleDeFiche(f)} onClick={() => encoreLa(f)}>Elle est encore là</button>
        </>))}
      </div>
    </Card>) : null;
  const blocPasSu = rangeesPasSu.length && aa ? (
    // (9 nov., lot AI) Une ligne courte (« 3 rangées pas vérifiées · N°5, N°27… ») ; la phrase entière en pop-up.
    <InfoPop nom="stock-pas-verifiees" titre="Paires rangées pas vérifiées" ton="neutre" style={{ margin: 0 }}
      attrs={{ 'data-stock-rangees-passu': rangeesPasSu.length }}
      puces={[{ texte: `${rangeesPasSu.length} pas vérifiée${rangeesPasSu.length > 1 ? 's' : ''}` }]}
      phrase="Une lecture manque : ni « en ligne », ni « partie » n'est dit.">
      {/* (6 nov., onglets B) La lecture qui manque est déjà NOMMÉE en tête (« pas lu : … ») : elle ne se redit
          pas ici (§7, une phrase une fois — mesuré sur sa base : « Vestiaire (jamais lu : ouvre… ») deux fois). */}
      <p data-stock-rangees-passu-detail="">{rangeesPasSu.length} paire{rangeesPasSu.length > 1 ? 's' : ''} rangée{rangeesPasSu.length > 1 ? 's' : ''} pas vérifiée{rangeesPasSu.length > 1 ? 's' : ''} ({rangeesPasSu.slice(0, 6).map((f) => 'N°' + f.numero).join(', ')}{rangeesPasSu.length > 6 ? '…' : ''}) : {aa.manque.length > 0 && manqueTxt ? 'une lecture manque (« pas tout lu » en tête de Stock)' : (manqueTxt || 'la lecture de son compte manque')}. En ligne ou partie : pas su.</p>
    </InfoPop>) : null;
  // ── La liste de toutes les annonces actuelles, et où chacune est ────────────
  const blocListe = aa && aa.su && articlesVus.length ? (
    <Card style={{ padding: '12px 13px' }}>
      <div data-stock-liste={articlesVus.length}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4 }}>En ligne</div>
        {articlesVus.slice().sort((a, b) => (articleRange(a) - articleRange(b)) || triNum(a.numero, b.numero)).slice(0, maxListe).map((a) => {
          const f = a.cle ? ficheParCle[a.cle] : null;
          const fOu = f ? ((ouEst(f) ? f : null) || (a.aussi || []).map((n) => ficheParCle[cleNum(n)]).filter(Boolean).find((x) => ouEst(x)) || null) : null;
          const ou = fOu ? ouEst(fOu) : null;
          return (
            <div key={a.ids[0]} className="vrm-s2d-liste-ligne" data-stock-annonce={a.cle || 'sans:' + a.ids[0]} data-stock-annonce-etat={a.etat} data-stock-annonce-plats={a.plateformes.join(',')} data-stock-annonce-place={ou ? `${ou.meuble.name}|${ou.rangee}|${ou.colonne}` : (a.cle ? 'non-range' : 'sans-numero')}>
              <span className="vrm-s2d-vig"><Vignette f={{ numero: a.numero || '—', title: a.titre, photo: a.photo }} sold={false} mini /></span>
              <span className="vrm-s2d-txt">
                <span className="vrm-s2d-txt-t">{a.cle ? <b>N°{a.numero} · </b> : null}{a.titre || '—'}</span>
                <span className="vrm-s2d-sites" data-stock-sites={a.plateformes.join(',')}>{a.plateformes.map((x) => <span key={x} className="vrm-s2d-site" data-site={x}>{NOM_PLAT_FILTRE[x] || x}</span>)}</span>
                <span className="vrm-s2d-txt-s">{a.comptes.length ? a.comptes.map((u) => comptesNoms.get(u) || u).join(', ') : ''}{a.etat === 'aconfirmer' ? ' · à confirmer' : (a.etat === 'masquee' ? ' · masquée par Vinted' : '')}{(a.aussi || []).length ? ' · aussi N°' + a.aussi.join(', N°') : ''}
                  <br />{ou ? <b>{ou.meuble.name} · rangée {ou.rangee}, colonne {ou.colonne}</b> : (a.cle ? 'pas encore rangée' : 'sans N° : pas rangeable')}</span>
                {/* (10 nov., lot BD) La note privée de la paire, par son N° (jamais le titre). */}
                {a.cle ? <NotePaireCoque numero={a.numero} ajout rangee/> : null}
              </span>
              {a.cle && f && <button className="vrm-b vrm-b-discret" type="button" data-stock-annonce-geste={ou ? 'voir' : 'ranger'} onClick={() => { if (ou) montrer(fOu); else { setPlace(a.cle); toast(`Touche la case où tu ranges N°${a.numero}.`); } }} style={{ flexShrink: 0 }}>{ou ? 'Voir ›' : 'Ranger ›'}</button>}
            </div>); })}
        {articlesVus.length > maxListe && <button className="vrm-b vrm-b-discret" type="button" onClick={() => setMaxListe((x) => x + 60)} style={{ width: '100%' }}>Voir plus — {maxListe} sur {articlesVus.length}</button>}
      </div>
    </Card>) : null;

  // ── (11 nov., lot DJ4) À PART : ce qui n'est pas « en ligne » mais reste chez lui ──────
  // Trois replis fermés : « À confirmer » (lecture de plus de 24 h : la date de lecture dite),
  // « Masquées par Vinted », « Gardées chez toi » (SA réponse « Oui, je la garde » : hors ligne,
  // à republier). Rien n'y est compté dans « en ligne », rien n'y est supprimé.
  const decisionsCycle = load('vrm_cycle_decisions', {}) || {};
  const gardees = (() => {
    const out = []; const vusG = new Set(aa ? aa.articles.flatMap((a) => [a.cle, ...(a.aussi || []).map(cleNum)]).filter(Boolean) : []);
    for (const id of Object.keys(decisionsCycle)) {
      const d = decisionsCycle[id]; if (!d || (d.choix !== 'chez-moi' && d.choix !== 'remise')) continue;
      const f = numeros[id]; if (!f) continue; const k = cleNum(f.numero); if (!k || vusG.has(k) || vendus.has(k)) continue;
      if (horsCompte({ id, ...f }) || annonceDeclareePartie(id, numeros, pairsLost)) continue;
      vusG.add(k); out.push({ id, numero: String(f.numero), titre: f.title || '', photo: f.photo || null });
    }
    return out.sort((x, y) => triNum(x.numero, y.numero));
  })();
  const ligneAPart = (a, sous) => (
    <div key={a.ids ? a.ids[0] : a.id} className="vrm-s2d-liste-ligne" data-stock-a-part={a.cle || cleNum(a.numero) || 'sans'}>
      <span className="vrm-s2d-vig"><Vignette f={{ numero: a.numero || '—', title: a.titre, photo: a.photo }} sold={false} mini /></span>
      <span className="vrm-s2d-txt"><span className="vrm-s2d-txt-t">{a.numero ? <b>N°{a.numero} · </b> : null}{a.titre || '—'}</span><span className="vrm-s2d-txt-s">{sous}</span></span>
    </div>);
  const repliAPart = (cle, titre, liste, rendu, pied = null) => (liste.length ? (
    <details className="vrm-repli vrm-s2d-a-part" data-stock-repli={cle} data-n={liste.length}>
      <summary><span>{titre} · {liste.length}</span></summary>
      <div>{liste.slice(0, 60).map(rendu)}{liste.length > 60 ? <p className="vrm-aide" style={{ fontSize: 12, color: C.muted }}>{liste.length - 60} de plus</p> : null}{pied}</div>
    </details>) : null);
  const blocAPart = aa && aa.su && (nAConf || nMasq || gardees.length) ? (
    <Card style={{ padding: '6px 13px' }}>
      <div data-stock-a-part-blocs="">
        {repliAPart('aconfirmer', 'À confirmer', parEtat.aConfirmer, (a) => ligneAPart(a, `${a.plateformes.map((x) => NOM_PLAT_FILTRE[x] || x).join(' · ')}${a.comptes.length ? ' · ' + a.comptes.map((u) => comptesNoms.get(u) || u).join(', ') : ''}`),
          aConfTxt ? <p className="vrm-aide" data-stock-a-confirmer-quand="" style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{aConfTxt} — {aConfGeste}</p> : null)}
        {repliAPart('masquees', 'Masquées par Vinted', parEtat.masquees, (a) => ligneAPart(a, a.comptes.map((u) => comptesNoms.get(u) || u).join(', ') || 'Vinted'))}
        {repliAPart('gardees', 'Gardées chez toi', gardees, (g) => ligneAPart(g, 'Hors ligne · à republier'),
          <button className="vrm-b vrm-b-secondaire" type="button" data-stock-republier="" style={{ width: '100%', marginTop: 6 }} onClick={() => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=republier' })); } catch (_) {} }}>Republier ›</button>)}
      </div>
    </Card>) : null;

  // ── (6 nov.) L'INVENTAIRE : l'ATTENDU est celui du Stock, tel quel (une source) ──
  // Les annonces actuelles (`aa`, la règle unique « en ligne »), les N° prouvés vendus
  // (`vrm_stock_vendus` — jamais publié ⇒ `null`, pas su), les paires gardées « encore
  // là », et `jugeable` (la même question que « Plus en ligne »). Les jugements, le
  // bilan, la fusion et l'écriture sont dans src/inventaire.js. AUCUN N° n'est changé :
  // l'écran n'écrit que `vrm_inventaire` ; « Je l'ai sortie » est `sortir` d'ici.
  const fabriquerStockInv = () => {
    let stockInv;
    if (lecture === undefined) stockInv = undefined;
    else if (!aa) stockInv = null;
    else {
      const physSig = load('vinted_nums_physiques', null);
      const dblSig = load('vrm_num_doublons', null);
      const connues = new Set(Object.keys(fichesParCle));
      try { (load('vinted_used_numeros', []) || []).forEach((v) => { const c = cleNum(v); if (c) connues.add(c); }); } catch (_) {}
      try { Object.values(load('vinted_sale_overrides', {}) || {}).forEach((o) => { const c = cleNum(o && o.numero); if (c) connues.add(c); }); } catch (_) {}
      try { Object.values(vcLocStock.auto || {}).forEach((v) => { const c = cleNum(v); if (c) connues.add(c); }); } catch (_) {}
      const gardees = {};
      for (const k of Object.keys(garder)) { const f = (fichesParCle[k] || []).find((x) => !horsCompte(x)); if (f) gardees[k] = { numero: f.numero, titre: f.title || '', photo: f.photo || null }; }
      stockInv = { su: aa.su, articles: aa.articles, manque: aa.manque,
        vendus: venduSig && Array.isArray(venduSig.nums) ? vendus : null,
        physiques: physSig && Array.isArray(physSig.nums) ? new Set(physSig.nums.map((x) => cleNum(x)).filter(Boolean)) : null,
        garder, gardees, jugeable, connues, archive: archiveNumeros(),
        doublons: dblSig && Array.isArray(dblSig.nums) ? new Set(dblSig.nums.map((x) => cleNum(x)).filter(Boolean)) : null, slots };
    }
    return stockInv;
  };
  // (9 nov.) L'INVENTAIRE HORS CONNEXION : la liste des paires attendues, FIGÉE sur cet
  // appareil au nom de CE vendeur (src/inventaireHorsLigne.js), chaque fois que le Stock
  // l'a LUE (`aa.su`) — jamais une liste « pas su ». Les réponses de `jugeable` sont
  // rejouées pour chaque N° qui a une fiche ; aucune écriture de N° (sa seule clé).
  const sigAttendu = aa && aa.su ? [aa.articles.length, aa.manque.length, lecture && lecture.at, Object.keys(slots || {}).length, Object.keys(garder).length, meubles.length, venduSig && Array.isArray(venduSig.nums) ? venduSig.nums.length : -1].join('|') : '';
  React.useEffect(() => {
    if (!sigAttendu) return;
    const uidV = AUTH.user && AUTH.user.id; if (!uidV) return;
    const t = setTimeout(() => {
      try {
        const st = fabriquerStockInv(); if (!st || !st.su) return;
        const f = figerAttendu({ uid: uidV, at: Date.now(), stock: st, fichesCles: Object.keys(fichesParCle), meubles, noms: Object.fromEntries(comptesNoms) });
        if (f) ecrireAttendu(uidV, f, localStorage);
      } catch (_) {}
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigAttendu]);
  const elInventaire = inventaire ? (() => {
    const stockInv = fabriquerStockInv();
    const ficheDe = (k) => ficheParCle[k] || (fichesParCle[k] || [])[0] || null;
    return <InventaireStock stock={stockInv} meubles={meubles} slots={slots} owner={AUTH.user?.id || ''} cle={cleNum}
      lire={lireLigneInventaire} ecrire={ecrireLigneInventaire} Feuille={SheetShell} Micro={MicDictee} confirmer={askConfirm} nomsComptes={comptesNoms}
      onFermer={() => { setInventaire(false); if (retourAnnuel.current) { retourAnnuel.current = false; setAnnuel(true); } }}
      onFiche={(n) => { try { window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: String(n) })); } catch (_) {} }}
      onVoirCase={(k) => { const f = ficheDe(k); setInventaire(false); montrer(f ? { ...f, numero: f.numero } : { numero: k }); }}
      peutSortir={(k) => !!ficheDe(k)} onSortir={(k) => { const f = ficheDe(k); if (f) sortir({ ...f, id: f.id, numero: f.numero, title: f.title || '' }); }}/>;
  })() : null;

  // (5 nov.) Qui découvre : l'explication animée (données inventées), puis le
  // geste. Sans annonce actuelle ni meuble, il n'y a rien d'autre à montrer.
  // (11 nov.) La feuille de fin d'année, montée sur les DEUX chemins (Stock vide compris : « Clôturer l'année » l'ouvre).
  const elAnnuel = annuel ? <InventaireAnnuel owner={AUTH.user?.id || ''} cle={cleNum} Feuille={SheetShell} lire={lireLigneInventaire} onFermer={() => { DEMANDE_INVENTAIRE_ANNUEL.at = 0; setAnnuel(false); }} onSaisirPrix={saisirPrixStock}
      onVerifier={() => { retourAnnuel.current = true; setAnnuel(false); setInventaire(true); }}
      onAnnonces={() => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=vinted_annonces' })); } catch (_) {} }}/> : null;
  if (!fiches.length && !meubles.length) return (<>
    {elInventaire}
    {elAnnuel}
    {blocResume}
    <StockExplication sneakers={motsStock.nom === 'paire'} />
    {aa && aa.su && !aa.n && <Card style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{aa.auMoins ? 'Aucune annonce lue pour l’instant — une lecture manque (voir plus haut).' : 'Aucune annonce en ligne en ce moment : dès qu’une annonce est en ligne, elle arrive ici, prête à ranger.'}</Card>}
  </>);

  // (5 nov.) Ce qui est sorti TOUT SEUL des meubles (colis parti) : dit, avec
  // « Remettre » (sur son clic : sa case si elle est libre ; une paire remise
  // n'est plus jamais sortie toute seule — `vrm_stock_garder`).
  const limJ = Date.now() - 14 * 86400000;
  const sortisMeubles = Object.values(journal || {}).filter((x) => x && x.source === 'meubles' && x.at > limJ).sort((a, b) => b.at - a.at);
  const jourCourt = (t) => { try { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
  const remettre = (x) => {
    const k = cleNum(x.cle || x.num);
    const g = { ...(load('vrm_stock_garder', {}) || {}) }; g[k] = Date.now(); saveTout('vrm_stock_garder', g);
    const nj = { ...(journal || {}) }; delete nj[x.cle]; saveTout('vrm_stock_sortis', nj); setJournal(nj);
    const r = remettreCase({ slots, meubles, sorti: x, cle: cleNum });
    if (r.remise) { if (r.slots !== slots) ecrireSlots(r.slots); toast(`N°${x.num} remise dans ${x.itemName} · ${x.nom}. Elle ne sera plus sortie toute seule.`, 'ok'); }
    else { setPlace(k); toast(`N°${x.num} : ${r.raison}. Touche la case où tu la poses.`); }
  };
  const blocSortis = sortisMeubles.length ? (
    <div className="vrm-s2d-sortis" data-stock-sortis-meubles={sortisMeubles.length}>
      <div className="vrm-s2d-sortis-titre">Cases libérées toutes seules · {sortisMeubles.length}</div>
      <div className="vrm-aide" style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>Le colis est parti : la case est libre, le numéro reste. Encore chez toi ? Remets-le.</div>
      {sortisMeubles.map((x) => (
        <div key={x.cle} className="vrm-s2d-sorti" data-stock-sorti-meuble={x.cle}>
          <span style={{ flex: '1 1 220px', minWidth: 0, fontSize: 13, color: C.text, lineHeight: 1.4 }}>
            <b>N°{x.num}</b>{x.titre ? ` · ${x.titre}` : ''}
            <span style={{ display: 'block', color: C.muted, fontSize: 12 }}>{x.itemName}{x.nom ? ` · ${x.nom}` : ''} · le {jourCourt(x.at)} — {x.plateforme || 'Vinted'} : {x.statut || 'colis parti'}</span>
          </span>
          <button className="vrm-b vrm-b-secondaire" type="button" data-stock-remettre-meuble={x.cle} onClick={() => remettre(x)}>Remettre</button>
        </div>
      ))}
    </div>
  ) : null;

  // Ce que la recherche montre : chaque article trouvé, et OÙ il est.
  const MAX_RES = 30;
  const blocCherche = (
    <div data-stock-recherche="" style={{ position: 'sticky', top: 6, zIndex: 25, background: C.bg, paddingBottom: 6 }}>
      <div style={{ position: 'relative' }}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: C.muted, display: 'flex' }}><Icon name="search" size={18} /></span>
        <input ref={chercheRef} value={q} onChange={(e) => { setQ(e.target.value); setCibles([]); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); setCibles([]); } if (e.key === 'Enter' && resultats.length === 1) { e.preventDefault(); const f = resultats[0]; if (ouEst(f)) montrer(f); else setModal({ type: 'fiche', cle: cleDeFiche(f) }); }
            else if (e.key === 'Enter' && resultats.length > 1) { e.preventDefault(); setCibles(resultats.map(cleDeFiche)); setQ(''); try { e.currentTarget.blur(); } catch (_) {} } }}
          type="search" enterKeyHint="search" autoComplete="off"
          placeholder="N°, marque, taille…" aria-label="Retrouver un article dans le stock"
          style={{ width: '100%', boxSizing: 'border-box', padding: `13px ${DICTEE_OK ? 92 : 40}px 13px 40px`, borderRadius: 12, border: `1.5px solid ${filtre ? C.accent : C.line}`, background: C.card, color: C.text, fontSize: 17, outline: 'none', minHeight: 48 }} />
        <span style={{ position: 'absolute', right: (q || cibles.length > 0) ? 46 : 5, top: '50%', transform: 'translateY(-50%)' }}><MicDictee titre={motsStock.nom === 'paire' ? 'Chercher à la voix (« numéro 12 », « nike noire »)' : 'Chercher à la voix (« numéro 12 »)'} onText={(t) => { setQ(requeteDeLaVoix(t).requete); setCibles([]); }} /></span>
        {(q || cibles.length > 0) && <button type="button" onClick={() => { setQ(''); setCibles([]); }} aria-label="Effacer la recherche" style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>}
      </div>
      {filtre && (
        <div data-stock-resultats={resultats.length} style={{ marginTop: 6, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, maxHeight: '46vh', overflowY: 'auto' }}>
          {resultats.length === 0
            ? <div data-stock-rien="" style={{ padding: '14px 14px', fontSize: 15, color: C.muted, lineHeight: 1.45 }}>{qEstNum
                ? <>Aucun article N°{motsQ[0].toUpperCase()} en stock — il est peut-être vendu et parti, ou retiré du stock. La loupe en haut de l'écran dit tout sur ce numéro.</>
                : <>Aucun article en stock ne correspond à « {q.trim()} ».</>}</div>
            : resultats.slice(0, MAX_RES).map((f) => { const ou = ouEst(f); const sold = estVendu(f);
              return (
                <button type="button" key={f.id} data-stock-res={cleDeFiche(f)} onClick={() => { if (ou) montrer(f); else setModal({ type: 'fiche', cle: cleDeFiche(f) }); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', width: '100%', minHeight: 64, border: 'none', borderBottom: `1px solid ${C.line}`, background: 'transparent', color: C.text, cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ position: 'relative', width: 48, height: 48, borderRadius: 12, overflow: 'hidden', flex: 'none', background: C.card2 }}><Vignette f={f} sold={sold} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><b>N°{f.numero}</b> · {f.title || '—'}</span>
                    <span data-stock-ou={ou ? `${ou.meuble.name}|${ou.rangee}|${ou.colonne}` : 'non-range'} style={{ display: 'block', fontSize: 13, marginTop: 2, color: ou ? C.text : C.muted, fontWeight: ou ? 700 : 500 }}>
                      {ou ? <>{ou.meuble.name} · rangée {ou.rangee}, colonne {ou.colonne}</> : 'Pas encore rangé dans un meuble'}{sold ? <span style={{ color: C.accentTexte, fontWeight: 700 }}> · vendue</span> : null}
                    </span>
                  </span>
                  <span style={{ color: C.accentTexte, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{ou ? 'Voir ›' : 'Ranger ›'}</span>
                </button>
              ); })}
          {resultats.length > 1 && <button className="vrm-b vrm-b-discret" type="button" data-stock-tout-montrer={resultats.length} onClick={() => { setCibles(resultats.map(cleDeFiche)); setQ(''); }} style={{ width: '100%' }}>Les montrer toutes dans les meubles ({resultats.length})</button>}
          {resultats.length > MAX_RES && <div style={{ padding: '9px 12px', fontSize: 12, color: C.muted }}>{resultats.length} trouvées — {MAX_RES} affichées, précise ta recherche.</div>}
        </div>
      )}
      {cibles.length > 0 && !filtre && (() => {
        // Dans l'ordre du chemin : meuble par meuble, de haut en bas, de gauche à droite.
        const rang = (k) => { const f = ficheParCle[k]; const ou = f && ouEst(f); if (!ou) return [9999, 0]; return [meubles.findIndex((x) => x.id === ou.meuble.id), ou.i]; };
        const tri = [...cibles].sort((a, b) => { const x = rang(a), y = rang(b); return x[0] - y[0] || x[1] - y[1]; });
        return (
        <div data-stock-cibles={cibles.length} style={{ marginTop: 6, background: C.card, border: `1px solid ${C.accent}`, borderRadius: 12, padding: '8px 6px 8px 12px', fontSize: 15, color: C.text, maxHeight: '40vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <b>À aller chercher{cibles.length > 1 ? ` · ${cibles.length}` : ''}</b>
            <span style={{ flex: 1 }} />
            <button className="vrm-b vrm-b-discret" type="button" onClick={() => setCibles([])}>Fermer</button>
          </div>
          {tri.map((k) => { const f = ficheParCle[k]; const ou = f && ouEst(f);
            return (
              <button type="button" key={k} data-aller-chercher={k} onClick={() => { if (f && ou) montrer(f); else if (f) setModal({ type: 'fiche', cle: k }); }}
                style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '6px 4px', minHeight: 44, background: 'transparent', border: 'none', borderTop: `1px solid ${C.line}`, color: C.text, cursor: 'pointer', textAlign: 'left', fontSize: 15 }}>
                <b style={{ minWidth: 48 }}>N°{f ? f.numero : k}</b>
                <span style={{ flex: 1, minWidth: 0, color: ou ? C.text : C.muted, fontWeight: ou ? 600 : 400 }}>{ou ? `${ou.meuble.name} · rangée ${ou.rangee}, colonne ${ou.colonne}` : (f ? 'pas encore rangé' : 'plus en stock')}</span>
              </button>
            ); })}
        </div>); })()}
    </div>
  );

  return (<>
    {/* (6 nov.) Pour le conseil « Ton premier inventaire » : les N° des annonces actuelles (lus seulement). */}
    <ChiffreInventaire numeros={aa ? aa.articles.filter((a) => a.cle).length : (lecture === undefined ? undefined : null)}/>
    {elInventaire}
    {blocResume}
    <ValeurStockCarte v={valeurStk} onSaisir={saisirPrixStock} mots={motsStock}/>
    {/* (10 nov., lot L) Le stock d'emballages : écrit sur SON clic ; le reste dérive des « Colis fait ». */}
    <EmballagesCarte reglage={emballagesR} Feuille={SheetShell} exemple={exemplesStock.emballage} ecrire={(r) => { setEmballagesR(r); save(CLE_EMBALLAGES, r); }}
      lireFaits={() => colisFaits({ vinted: load('vinted_ship_done', {}), leboncoin: load('vrm_lbc_colis_done', {}), vestiaire: load('vrm_vc_colis_done', {}) })}/>
    <button type="button" className="vrm-ia-entree" data-ia-ouvrir="" onClick={() => setAnnuel(true)}><span>Inventaire de fin d’année</span><span aria-hidden="true">›</span></button>
    {elAnnuel}
    {blocCherche}
    {meubles.length === 0 && <StockExplication sneakers={motsStock.nom === 'paire'} />}
    {blocVendues}
    {blocPlusEnLigne}
    {barreSerieStock}
    {blocPasSu}
    {blocSortis}
    {/* à ranger */}
    {aRanger.length > 0 && (
      <Card style={{ padding: '12px 13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>À ranger</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.onAccent, background: C.accent, borderRadius: 999, padding: '1px 8px' }}>{aRanger.length}</span>
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 'auto' }}>{souris ? 'glisse un article dans une case (ou clique-le, puis une case)' : 'touche un article puis une case'}</span>
        </div>
        <div data-bande-a-ranger="" style={{ display: 'flex', gap: 9, overflowX: 'auto', paddingBottom: 3 }}>
          {aRanger.map((f) => { const sold = estVendu(f); const sel = place === cleDeFiche(f);
            return (
              <button type="button" key={f.id} data-a-ranger={cleDeFiche(f)} data-paire-a-ranger={String(f.numero)} data-paire-plateformes={(f.plateformes || []).join(',')} data-paire-aussi={(f.aussi || []).join(',')} {...dragProps(cleDeFiche(f))} onClick={() => setPlace(sel ? null : cleDeFiche(f))} aria-pressed={sel} aria-label={`Ranger l’article N°${f.numero}${(f.aussi || []).length ? ' (aussi N°' + f.aussi.join(', N°') + ')' : ''}${f.title ? ' · ' + f.title : ''}${(f.plateformes || []).length && !f.plateformes.includes('vinted') ? ' · seulement sur ' + f.plateformes.map((x) => NOM_PLAT_STOCK[x] || x).join(' et ') : ''}${sold ? ' (vendue)' : ''}`} style={{ position: 'relative', flex: 'none', width: 70, height: 88, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', padding: 0, background: C.card2, border: sel ? `2px solid ${C.accent}` : (sold ? `2px solid ${C.accent}` : `1px solid ${C.border}`), opacity: filtre && !correspond(f) ? 0.3 : 1 }}>
                <Vignette f={f} sold={sold} />
                {/* (5 nov.) Une paire vue seulement sur eBay ou Leboncoin le dit ; une
                    même paire sous deux N° (même photo) dit l'autre N° (`unParArticle`). */}
                {(f.plateformes || []).length && !f.plateformes.includes('vinted') ? <span className="vrm-s2d-plat">{f.plateformes.map((x) => NOM_PLAT_STOCK[x] || x).join(' · ')}</span> : null}
                {(f.aussi || []).length ? <span className="vrm-s2d-aussi">+N°{f.aussi.join(', ')}</span> : null}
              </button>
            );
          })}
        </div>
      </Card>
    )}

    {place && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', borderRadius: 12, background: C.accent, color: C.onAccent, fontSize: 15, fontWeight: 700, position: 'sticky', top: 8, zIndex: 20, boxShadow: '0 3px 12px rgba(0,0,0,0.18)' }}>
        <span>Où ranger <b>N°{(ficheParCle[place] || {}).numero || place}</b> ? Touche une case</span>
        <button type="button" onClick={() => setPlace(null)} style={{ background: 'rgba(0,0,0,0.18)', border: 'none', color: C.onAccent, borderRadius: 999, padding: '5px 11px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Annuler</button>
      </div>
    )}

    {nEcartes > 0 && <div data-stock-ecartes={nEcartes} style={{ fontSize: 12, color: C.muted }}>{nEcartes} paire{nEcartes > 1 ? 's' : ''} d'un compte retiré ou masqué {nEcartes > 1 ? 'ne sont' : "n'est"} pas montrée{nEcartes > 1 ? 's' : ''} ici.</div>}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
      {/* (6 nov., onglets B) CE QUE VEULENT DIRE LES CASES, en une ligne (Julien : « être accompagné ») :
          les MÊMES classes que les cases (libre, rangée, vendue = l'accent, plus en ligne = l'ambre, §7). */}
      {meubles.length > 0 ? <div className="vrm-s2d-legende-l" data-stock-legende="" style={{ flex: '1 1 200px', minWidth: 0 }}>
        <span data-legende="libre"><i className="vrm-s2d-pastille is-libre" aria-hidden="true">+</i>libre</span>
        <span data-legende="rangee"><i className="vrm-s2d-pastille is-rangee" aria-hidden="true">N°</i>rangée</span>
        <span data-legende="vendue"><i className="vrm-s2d-pastille is-vendue" aria-hidden="true">N°</i>vendue : à sortir</span>
        <span data-legende="plusenligne"><i className="vrm-s2d-pastille is-plusenligne" aria-hidden="true">N°</i>plus en ligne</span>
      </div> : <div style={{ flex: '1 1 200px', minWidth: 0 }} />}
      {/* (30 oct.) Sans meuble, « De loin / De près » ne montrait rien : le choix attend le premier meuble. */}
      {meubles.length > 0 && <div data-meubles-zoom={zoom}><Segmente label="Taille des cases" value={zoom} onChange={setZoom} options={[{ v: 'loin', l: 'De loin', data: { 'data-zoom-choix': 'loin' } }, { v: 'normal', l: 'Normale', data: { 'data-zoom-choix': 'normal' } }, { v: 'pres', l: 'De près', data: { 'data-zoom-choix': 'pres' } }]} /></div>}
    </div>

    {/* De loin, les meubles se rangent côte à côte : toute la pièce d'un coup d'œil. */}
    <div data-meubles-liste="" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: zoom === 'pres' ? 0 : 28 }}>
      {meubles.map((m) => <div key={m.id} style={{ flex: zoom === 'pres' ? '1 1 100%' : '0 1 auto', minWidth: 0, maxWidth: '100%' }}>{cadreMeuble(m)}</div>)}
    </div>
    {blocListe}
    {blocAPart}

    {/* (30 oct.) Pièce vide : créer un meuble est LE geste de l'écran (primaire) ; ensuite il redevient secondaire. */}
    <button className={`vrm-b ${meubles.length ? 'vrm-b-secondaire' : 'vrm-b-primaire'}`} type="button" data-creer-meuble="" onClick={() => setModal({ type: 'meuble' })} style={{ alignSelf: meubles.length ? 'stretch' : 'flex-start' }}>+ Ajouter un meuble</button>
    {meubles.length > 0 && (explication
      ? <StockExplication sneakers={motsStock.nom === 'paire'} onFermer={() => setExplication(false)} />
      : <button className="vrm-b vrm-b-discret" type="button" data-stock-explication-ouvrir="" onClick={() => setExplication(true)} style={{ alignSelf: 'center' }}>Comment ça marche ?</button>)}

    {Modale()}
  </>);
}
// ⟦← App.jsx #8⟧

// Éditeur de meuble (nom + colonnes × lignes), avec aperçu des cases.
function EditeurMeuble({ modal, onSave, onDelete }) {
  const [name, setName] = React.useState(modal.name || '');
  const [cols, setCols] = React.useState(modal.cols || 4);
  const [rows, setRows] = React.useState(modal.rows || 3);
  const [planches, setPlanches] = React.useState(() => (Array.isArray(modal.planches) ? modal.planches : []));
  const [gravite, setGravite] = React.useState(!!modal.gravite);
  const pl = planchesRangees(planchesCases(planches, cols, rows), cols, rows);
  const step = (set, v, d, min, max) => () => set(Math.max(min, Math.min(max, v + d)));
  const Stepper = ({ v, set, min, max, label }) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 7 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', background: C.card2, border: `1px solid ${C.line}`, borderRadius: 12, width: 'fit-content' }}>
        <button type="button" onClick={step(set, v, -1, min, max)} aria-label="Moins" style={{ width: 48, height: 48, background: 'transparent', border: 'none', color: C.text, fontSize: 22, cursor: 'pointer' }}>−</button>
        <span style={{ minWidth: 48, textAlign: 'center', fontSize: 20, fontWeight: 800, color: C.text }}>{v}</span>
        <button type="button" onClick={step(set, v, 1, min, max)} aria-label="Plus" style={{ width: 48, height: 48, background: 'transparent', border: 'none', color: C.text, fontSize: 22, cursor: 'pointer' }}>+</button>
      </div>
    </div>
  );
  return (<>
    <h3 style={{ margin: '0 0 2px', fontSize: 17, color: C.text }}>{modal.id ? 'Modifier le meuble' : 'Nouveau meuble'}</h3>
    <div style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>Un nom, et le nombre de cases.</div>
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 7 }}>Nom</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Étagère salon" maxLength={30} style={{ width: '100%', background: C.card2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 12, padding: '13px 14px', fontSize: 17, outline: 'none' }} />
    </div>
    <div style={{ display: 'flex', gap: 22, marginBottom: 6 }}>
      <Stepper v={cols} set={setCols} min={1} max={8} label="Colonnes" />
      <Stepper v={rows} set={setRows} min={1} max={10} label="Lignes" />
    </div>
    <label data-gravite-choix="" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '12px 0 4px', cursor: 'pointer', minHeight: 44 }}>
      <input type="checkbox" checked={gravite} onChange={(e) => setGravite(e.target.checked)} style={{ width: 22, height: 22, marginTop: 1, accentColor: C.accent, flexShrink: 0 }} />
      <span style={{ fontSize: 15, color: C.text, lineHeight: 1.4 }}><b>Articles empilés</b><br /><span style={{ color: C.muted, fontSize: 13 }}>Un article retiré : ceux du dessus descendent.</span></span>
    </label>
    <div style={{ background: C.card2, border: `1px solid ${C.line}`, borderRadius: 14, padding: 13, margin: '8px 0 4px', textAlign: 'center' }}>
      <ChoixPlanches cols={cols} rows={rows} planches={planches} setPlanches={setPlanches} />
    </div>
    <button className="vrm-b vrm-b-primaire" type="button" data-meuble-enregistrer="" onClick={() => onSave((name || '').trim() || 'Meuble', cols, rows, { planches: pl, gravite })} style={{ width: '100%', marginTop: 9 }}>{modal.id ? 'Enregistrer' : 'Créer le meuble'}</button>
    {onDelete && <button className="vrm-b vrm-b-secondaire" type="button" onClick={onDelete} style={{ width: '100%', marginTop: 9 }}>Supprimer ce meuble</button>}
  </>);
}

function Garage({catalog,garageGrid,setGarageGrid,blockedCells,setBlockedCells,extraCols,setExtraCols,cellColors,setCellColors,locate,onLocateConsumed,placeNum,onPlaced,accounts=null,comptesLus=false}) {
  const motsStock = useMotsArticle();   // (11 nov., lot DJ2) « paire » seulement pour Sneakers
  const [searchInput,setSearchInput]=useState('');
  const [garageSearch,setGarageSearch]=useState(''); // recherche validée
  // ⚠️ LA 3D EST LA VUE PAR DÉFAUT (Julien : « je veux vraiment que la 3D soit
  // une application dans l'application »). Le choix reste MÉMORISÉ par appareil :
  // qui préfère la grille la retrouve au prochain passage — on change le point
  // de départ, pas son habitude.
  // (17 oct.) Julien : « enlève aussi les autres types de rangement ». Le Stock
  // n'a plus que la pièce (3D + vue du dessus) et l'assistant « Ranger » ; la
  // grille de zones et la photo du local ne s'ouvrent plus (mesuré : vides chez
  // lui). Un choix mémorisé « grille »/« photo » retombe sur la pièce.
  // ⚠️ (5 nov.) Julien : « garder seulement la méthode de rangement annonce →
  // case sur des étagères que l'on modélise comme on veut, en vue 2D ». Le Stock
  // n'a plus qu'une vue : « Mes meubles » (`StockMeubles`). La pièce 3D, ses
  // cases et la grille de photos ne s'ouvrent plus d'ici — RIEN n'est effacé :
  // `vrm_room` (la pièce et ses piles), `vinted_garage_view` et chaque numéro
  // restent en base ; une paire notée dans l'ancienne pièce le dit sur sa fiche.

  // Localisation demandee depuis l'inventaire : amorce la recherche sur le numero.
  useEffect(()=>{
    if(locate){
      setSearchInput(String(locate));
      setGarageSearch(String(locate));
      onLocateConsumed && onLocateConsumed();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[locate]);
  const [blockMode,setBlockMode]=useState(false);
  const [colorMode,setColorMode]=useState(false);
  const [addMode,setAddMode]=useState(false); // masquer les cases vides par défaut
  const [activeColor,setActiveColor]=useState('#ffb830');
  const [focusedCell,setFocusedCell]=useState(null); // {zid, ci, si}
  const highlightRef=React.useRef(null);
  // Rangement lancé DEPUIS le garage (bouton « Ranger » sur une paire à ranger),
  // en plus de celui lancé depuis Annonces (prop placeNum). placing = le N° en cours.
  const [localPlace,setLocalPlace]=useState(null);
  const [advanced,setAdvanced]=useState(false); // options avancées (modes, colonnes) repliées par défaut
  const placing = placeNum || localPlace;
  const clearPlacing = () => { setLocalPlace(null); onPlaced&&onPlaced(); };

  // Quand une recherche trouve une case, on défile automatiquement jusqu'à elle (centré)
  useEffect(()=>{
    if(garageSearch.trim()&&highlightRef.current){
      setTimeout(()=>{
        try{ highlightRef.current.scrollIntoView({behavior:'smooth',block:'center',inline:'center'}); }catch(e){}
      },100);
    }
  },[garageSearch]);
  
  const isBlocked=(zid,ci,si)=>blockedCells[`${zid}_${ci}_${si}`]===true;
  const toggleBlock=(zid,ci,si)=>{
    const k=`${zid}_${ci}_${si}`;
    const u={...blockedCells};
    if(u[k]) delete u[k]; else u[k]=true;
    setBlockedCells(u); save('vinted_blocked',u);
  };
  
  const getColor=(zid,ci,si)=>cellColors[`${zid}_${ci}_${si}`];
  const setColor=(zid,ci,si,color)=>{
    const k=`${zid}_${ci}_${si}`;
    const u={...cellColors};
    if(color===null||u[k]===color) delete u[k]; else u[k]=color;
    setCellColors(u); save('vinted_colors',u);
  };
  
  const soldIds=useMemo(()=>new Set(catalog.filter(p=>p.status==='vendu').map(p=>p.id)),[catalog]);
  const BW=46,BH=26,SW=6,TH=5;
  const CW=BW+SW,CH=BH+TH,GAP=3;
  
  // LAYOUT effectif avec colonnes ajoutées par l'utilisateur
  const effectiveLayout=useMemo(()=>LAYOUT.map(z=>{
    const extra=extraCols[z.id]||0;
    return {...z, cols:[...z.cols, ...Array(extra).fill(COL_H)]};
  }),[extraCols]);
  
  const globalMax=useMemo(()=>Math.max(...effectiveLayout.flatMap(z=>z.cols.map(b=>b+z.elev))),[effectiveLayout]);
  const TOTAL=useMemo(()=>effectiveLayout.reduce((s,z)=>s+z.cols.reduce((ss,b)=>ss+b,0),0),[effectiveLayout]);

  const allVals=useMemo(()=>
    Object.values(garageGrid).flatMap(a=>Array.isArray(a)?a:[]).filter(v=>v&&v.trim()!=='')
  ,[garageGrid]);
  
  // Set des valeurs en lowercase (recherche instantanée)
  const allValsSet=useMemo(()=>{
    const s=new Set();
    allVals.forEach(v=>s.add(v.trim().toLowerCase()));
    return s;
  },[allVals]);

  // Cohérence garage ↔ paires numérotées (annonces). Chargé depuis la même
  // source que l'onglet Comptes (clé vinted_annonce_numeros).
  const pairNumeros=useMemo(()=>load('vinted_annonce_numeros',{}),[]);
  // ⚠️ Seules les paires qui EXISTENT ENCORE ont une place à occuper. La photo
  // `vinted_nums_physiques` est publiée par l'écran Annonces (annonce en ligne
  // ou vente pas encore expédiée). Sans elle (écran jamais ouvert sur cet
  // appareil), on garde l'ancien comportement plutôt que de masquer à tort.
  const numsPhysiques=useMemo(()=>{
    const p=load('vinted_nums_physiques', null);
    if(!p || !Array.isArray(p.nums) || !p.nums.length) return null;
    return new Set(p.nums.map(x=>String(x).trim().toLowerCase()));
  },[]);
  const numberedSet=useMemo(()=>{
    const s=new Set();
    Object.values(pairNumeros).forEach(e=>{ const t=String((e&&e.numero)||'').trim().toLowerCase(); if(!t) return;
      if(numsPhysiques && !numsPhysiques.has(t)) return;   // paire partie : sa boîte est libre
      s.add(t); });
    return s;
  },[pairNumeros,numsPhysiques]);
  // Numérotées (paires connues) mais absentes du garage → à ranger.
  const numberedNotStored=useMemo(()=>Array.from(numberedSet).filter(n=>!allValsSet.has(n)).sort((a,b)=>(+a||0)-(+b||0)),[numberedSet,allValsSet]);
  // Au garage mais numéro inconnu (aucune paire numérotée) → doute/typo/ancien.
  const storedUnknown=useMemo(()=>Array.from(allValsSet).filter(n=>numberedSet.size>0&&!numberedSet.has(n)).sort((a,b)=>(+a||0)-(+b||0)),[allValsSet,numberedSet]);

  // Détection des doublons
  const duplicates=useMemo(()=>{
    const counts={};
    Object.entries(garageGrid).forEach(([key,arr])=>{
      if(!Array.isArray(arr)) return;
      arr.forEach((v,si)=>{
        const t=v&&v.trim();
        if(!t) return;
        if(!counts[t]) counts[t]=[];
        counts[t].push(`${key}_${si}`);
      });
    });
    return Object.entries(counts).filter(([k,v])=>v.length>1).map(([num,locs])=>({num,locs,count:locs.length}));
  },[garageGrid]);

  const getCol=(zid,ci,n)=>{
    const a=garageGrid[`${zid}_${ci}`];
    const r=Array.isArray(a)?[...a]:[];
    while(r.length<n) r.push('');
    return r.slice(0,n);
  };
  const setCol=(zid,ci,arr)=>{
    const u={...garageGrid,[`${zid}_${ci}`]:arr};
    setGarageGrid(u); save('vinted_garage_grid',u);
  };
  const onChange=(zid,ci,si,val,n)=>{const arr=getCol(zid,ci,n);arr[si]=val;setCol(zid,ci,arr);};
  
  // Compactage qui IGNORE les cases bloquées
  const onBlur=(zid,ci,n)=>{
    const arr=getCol(zid,ci,n);
    // Pour chaque position, savoir si elle est bloquée
    const blockedSet=new Set();
    for(let i=0;i<n;i++){
      if(isBlocked(zid,ci,i)) blockedSet.add(i);
    }
    // On extrait les valeurs non-bloquées avec leur statut
    const free=[]; // positions non-bloquées
    for(let i=0;i<n;i++){
      if(!blockedSet.has(i)) free.push({pos:i, val:arr[i]||''});
    }
    // Récupérer les valeurs remplies parmi free, en gardant l'ordre
    const filled=free.filter(f=>f.val.trim()!=='').map(f=>f.val);
    // Reconstruire : positions libres = vides en haut puis filled en bas
    const newArr=[...arr]; // garder les bloquées intactes
    let fillIdx=filled.length-1; // on remplit du bas vers le haut parmi les positions libres
    for(let i=free.length-1;i>=0;i--){
      const pos=free[i].pos;
      if(fillIdx>=0){
        newArr[pos]=filled[fillIdx];
        fillIdx--;
      } else {
        newArr[pos]='';
      }
    }
    setCol(zid,ci,newArr);
  };

  // Recherche : déclenchée seulement quand on appuie sur Entrée
  const triggerSearch=()=>setGarageSearch(searchInput);
  const clearSearch=()=>{setSearchInput('');setGarageSearch('');};
  const searchTrim=garageSearch.trim().toLowerCase();
  
  // Liste des cellules de chaque colonne pour navigation flèches
  const navigateFromCell=(zid,ci,si,direction)=>{
    // Trouve la zone et colonne courante dans effectiveLayout
    const zIdx=effectiveLayout.findIndex(z=>z.id===zid);
    if(zIdx<0) return;
    const z=effectiveLayout[zIdx];
    const maxBoxes=z.cols[ci];
    let newZ=zIdx, newCi=ci, newSi=si;
    if(direction==='up') newSi=Math.max(0,si-1);
    else if(direction==='down') newSi=Math.min(maxBoxes-1,si+1);
    else if(direction==='left') {
      if(ci>0){newCi=ci-1;}
      else if(zIdx>0){newZ=zIdx-1;newCi=effectiveLayout[zIdx-1].cols.length-1;}
      else return;
    }
    else if(direction==='right'){
      if(ci<z.cols.length-1){newCi=ci+1;}
      else if(zIdx<effectiveLayout.length-1){newZ=zIdx+1;newCi=0;}
      else return;
    }
    const targetZ=effectiveLayout[newZ];
    const targetMax=targetZ.cols[newCi];
    if(newSi>=targetMax) newSi=targetMax-1;
    setFocusedCell({zid:targetZ.id,ci:newCi,si:newSi});
    // Focus l'input après le rendu
    setTimeout(()=>{
      const inp=document.querySelector(`input[data-cell="${targetZ.id}_${newCi}_${newSi}"]`);
      if(inp) inp.focus();
    },10);
  };
  
  
  const addColumn=(zid)=>{
    const u={...extraCols, [zid]:(extraCols[zid]||0)+1};
    setExtraCols(u); save('vinted_extracols',u);
  };
  const removeColumn=(zid)=>{
    const u={...extraCols, [zid]:Math.max(0,(extraCols[zid]||0)-1)};
    setExtraCols(u); save('vinted_extracols',u);
  };

  let colN=0;
  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      <ScreenHead icon="home" title="Stock" phrase="garage" desc="Tes étagères en 2D : chaque article dans sa case. Cherche un numéro, il te dit le meuble et la case."
        right={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Bouton variante="secondaire" icone="camera" data-stock-recherche-photo="" onClick={ouvrirRecherchePhoto} style={{ minHeight: 44 }} title={`Photographie ${motsStock.le} : VRM montre les annonces qui lui ressemblent`}>Trouver par photo</Bouton><button type="button" className="vrm-b vrm-b-secondaire" data-stock-inventaire-ouvrir="" title={`Compter ${motsStock.tes.replace(/^tes /, 'les ')} présent${motsStock.es}, case par case`} onClick={() => { try { window.dispatchEvent(new Event('vrm:inventaire-ouvrir')); } catch (_) {} }}>Faire l’inventaire</button></div>}/>

      <StockMeubles locate={locate} placeNum={placeNum} onPlaced={onPlaced} accounts={accounts} comptesLus={comptesLus}/>

      {/* (30 oct.) L'ancienne grille de zones (cases bloquées, couleurs, colonnes) n'était plus
          joignable depuis le 17 oct. (aucune vue « grid ») : ses ~20 boutons sont retirés. */}
    </div>
  );
}
// ⟦← App.jsx #9⟧

/* ── Stock Vinted ──────────────────────────────────────── */
// Suivi des annonces en ligne sur Vinted, avec réconciliation garage.
// - Saisie manuelle des numéros (à l'unité + collage en masse)
// - Une facture qui arrive => le numéro se retire automatiquement (géré dans App via useEffect)
// - Une facture supprimée => le numéro revient (géré dans App)
// - Nouveau numéro au catalogue (à partir de maintenant) => ajout auto (géré dans App)
// - Incohérences : compare le Stock Vinted avec les numéros présents dans le Garage
function StockVinted({stockVinted,setStockVinted,garageGrid,invoices}) {
  const [input,setInput]=useState('');
  const [bulk,setBulk]=useState('');
  const [showBulk,setShowBulk]=useState(false);
  const [search,setSearch]=useState('');

  // Normalise un numéro (string, trim)
  const norm=(v)=>String(v||'').trim();

  // Ajoute un numéro à l'unité
  const addOne=()=>{
    const n=norm(input);
    if(!n){ return; }
    if(stockVinted.includes(n)){ toast('Le numéro '+n+' est déjà dans le stock Vinted.'); setInput(''); return; }
    const u=[...stockVinted,n];
    setStockVinted(u); save('vinted_stock_vinted',u);
    setInput('');
  };

  // Ajoute plusieurs numéros d'un coup (séparés par virgule, espace, point-virgule ou saut de ligne)
  const addBulk=()=>{
    const parts=bulk.split(/[\s,;]+/).map(norm).filter(Boolean);
    if(parts.length===0){ toast('Aucun numéro détecté.'); return; }
    const set=new Set(stockVinted);
    let added=0;
    parts.forEach(p=>{ if(!set.has(p)){ set.add(p); added++; } });
    const u=Array.from(set);
    setStockVinted(u); save('vinted_stock_vinted',u);
    setBulk(''); setShowBulk(false);
    toast(added+' numéro(s) ajouté(s) au stock Vinted.');
  };

  // Retire un numéro manuellement
  const removeOne=(n)=>{
    const u=stockVinted.filter(x=>x!==n);
    setStockVinted(u); save('vinted_stock_vinted',u);
  };

  // Numéros présents dans le garage (toutes les cases non vides)
  const garageNums=useMemo(()=>{
    const s=new Set();
    Object.values(garageGrid||{}).forEach(arr=>{
      if(Array.isArray(arr)) arr.forEach(v=>{ const t=norm(v); if(t) s.add(t); });
    });
    return s;
  },[garageGrid]);

  // Set du stock Vinted pour comparaisons rapides
  const stockSet=useMemo(()=>new Set(stockVinted.map(norm)),[stockVinted]);

  // Incohérences :
  //  - "en ligne mais pas au garage" : numéro dans Stock Vinted mais introuvable dans le garage
  //    (=> l'annonce est en ligne alors que la paire n'est plus là : à vérifier)
  //  - "au garage mais pas en ligne" : numéro présent au garage mais pas dans Stock Vinted
  //    (=> paire stockée mais pas annoncée : peut-être à mettre en ligne)
  const enLignePasGarage=useMemo(()=>
    stockVinted.map(norm).filter(n=>n&&!garageNums.has(n)).sort((a,b)=>(+a||0)-(+b||0))
  ,[stockVinted,garageNums]);

  // ⚠️ Le garage 3D est-il seulement utilise ? Sans ca, « en ligne mais absent
  // du garage » vaut mecaniquement 100 % et n'apprend rien.
  const garageVide = garageNums.size === 0;
  // Jamais des centaines de pastilles d'un coup : une tranche, et le total ecrit
  // sur le bouton (meme motif que Ventes et Achats).
  const [ecartsMax, setEcartsMax] = useState(200);
  const [listeMax, setListeMax] = useState(200);
  const garagePasEnLigne=useMemo(()=>
    Array.from(garageNums).filter(n=>!stockSet.has(n)).sort((a,b)=>(+a||0)-(+b||0))
  ,[garageNums,stockSet]);

  // Une recherche remet la tranche a zero : sinon on croirait que les derniers
  // resultats manquent (meme regle que Ventes et Achats).
  useEffect(()=>{ setListeMax(200); },[search]);
  // Liste filtrée pour l'affichage
  const liste=useMemo(()=>{
    const arr=[...stockVinted].map(norm).sort((a,b)=>(+a||0)-(+b||0));
    const q=norm(search).toLowerCase();
    if(!q) return arr;
    return arr.filter(n=>n.toLowerCase().includes(q));
  },[stockVinted,search]);

  return (
    <div>
      <ScreenHead icon="tag" title={`Stock Vinted (${stockVinted.length})`}
        desc="L'ancienne liste des numéros en ligne."
        right={<button type="button" onClick={()=>setShowBulk(s=>!s)} style={{background:C.purple,color:'#fff',border:'none',borderRadius:12,padding:'7px 12px',fontWeight:500,fontSize:12,cursor:'pointer'}}>
          {showBulk?'Fermer':'Coller en masse'}
        </button>}/>

      <p style={{fontSize:13,color:C.muted,margin:'0 0 14px',lineHeight:1.5}}>
        L'<b>ancienne</b> liste tenue à la main (<b>Annonces</b> a pris le relais). Ajoute tes N° ici.
      </p>
      <div style={{fontSize:13,color:C.muted,margin:'-8px 0 14px'}}><Pourquoi label="Comment elle bouge">Quand une facture arrive, le numéro se retire tout seul ; si tu supprimes la facture, il revient. Les nouveaux numéros ajoutés au catalogue s'ajoutent aussi automatiquement.</Pourquoi></div>

      {/* Saisie à l'unité */}
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter') addOne(); }}
          placeholder="N° de l'annonce (ex : 1908)"
          inputMode="numeric"
          style={{flex:1,padding:'10px 12px',border:`1px solid ${C.border||'#ccc'}`,borderRadius:12,fontSize:15}}
        />
        <button type="button" onClick={addOne} style={{background:C.accent,color:C.onAccent,border:'none',borderRadius:12,padding:'10px 16px',fontWeight:500,fontSize:15,cursor:'pointer'}}>
          Ajouter
        </button>
      </div>

      {/* Collage en masse (optionnel) */}
      {showBulk&&(
        <div style={{marginBottom:14,padding:12,background:C.card2||'rgba(0,0,0,0.04)',borderRadius:12}}>
          <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Colle plusieurs numéros (séparés par espace, virgule ou retour à la ligne) :</div>
          <textarea
            value={bulk}
            onChange={e=>setBulk(e.target.value)}
            rows={4}
            placeholder="1908 1925 898 ..."
            style={{width:'100%',padding:10,border:`1px solid ${C.border||'#ccc'}`,borderRadius:12,fontSize:13,boxSizing:'border-box',resize:'vertical'}}
          />
          <button type="button" onClick={addBulk} style={{marginTop:8,background:C.accent,color:C.onAccent,border:'none',borderRadius:12,padding:'9px 16px',fontWeight:500,fontSize:13,cursor:'pointer'}}>
            Ajouter tout
          </button>
        </div>
      )}

      {/* Incohérences */}
      {/* ⚠️ Rien a comparer tant que le garage est vide : on le DIT, une fois. */}
      {garageVide && stockVinted.length>0 && (
        <div style={{marginBottom:16,padding:'10px 12px',border:`1px solid ${C.border}`,borderRadius:12,background:C.card,fontSize:13,color:C.muted,lineHeight:1.5}}>
          Range tes articles dans le <b style={{color:C.text}}>Stock</b> : les écarts apparaîtront ici. <Pourquoi>Aucun numéro n'est encore posé dans le Stock : la comparaison avec cette liste signalerait les {stockVinted.length} numéros d'un coup.</Pourquoi>
        </div>
      )}
      {!garageVide && (enLignePasGarage.length>0||garagePasEnLigne.length>0)&&(
        <div style={{marginBottom:16}}>
          <h3 style={{fontSize:15,fontWeight:600,margin:'0 0 8px',color:C.warn,display:'flex',alignItems:'center',gap:6}}><Icon name="alert" size={15}/>Incohérences avec le stock</h3>

          {enLignePasGarage.length>0&&(
            <div style={{marginBottom:10,padding:10,background:'rgba(156,106,31,0.10)',borderRadius:12}}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>En ligne mais absent du stock ({enLignePasGarage.length})</div>
              <div className="vrm-aide" style={{fontSize:12,color:C.muted,marginBottom:6}}>Ces annonces sont dans ton stock Vinted mais leur numéro n'est pas dans le stock.</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {enLignePasGarage.slice(0,ecartsMax).map(n=>(
                  <span key={n} style={{background:C.warn,color:C.onWarn||'#fff',borderRadius:6,padding:'3px 8px',fontSize:12,fontWeight:500}}>{n}</span>
                ))}
              </div>
              {enLignePasGarage.length>ecartsMax && (
                <button type="button" onClick={()=>setEcartsMax(m=>m+200)}
                  style={{marginTop:8,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:12,padding:'5px 11px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                  Voir plus — {ecartsMax} affichés sur {enLignePasGarage.length}
                </button>
              )}
            </div>
          )}

          {garagePasEnLigne.length>0&&(
            <div style={{padding:10,background:'rgba(0,119,130,0.08)',borderRadius:12}}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>Au stock mais pas en ligne ({garagePasEnLigne.length})</div>
              <div className="vrm-aide" style={{fontSize:12,color:C.muted,marginBottom:6}}>Dans le stock, pas sur Vinted : à mettre en ligne ?</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {garagePasEnLigne.map(n=>(
                  <span key={n} style={{background:C.accent,color:C.onAccent,borderRadius:6,padding:'3px 8px',fontSize:12,fontWeight:500}}>{n}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recherche */}
      {stockVinted.length>0&&(
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Rechercher un numéro…"
          style={{width:'100%',padding:'9px 12px',border:`1px solid ${C.border||'#ccc'}`,borderRadius:12,fontSize:13,boxSizing:'border-box',marginBottom:12}}
        />
      )}

      {/* Liste des numéros en ligne */}
      {liste.length===0?(
        <div style={{textAlign:'center',color:C.muted,fontSize:13,padding:'30px 0'}}>
          {stockVinted.length===0?'Aucun numéro pour le moment. Ajoute tes annonces en ligne ci-dessus.':'Aucun résultat.'}
        </div>
      ):(
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {liste.slice(0,listeMax).map(n=>{
            // ⚠️ Le contour ambre ne veut dire quelque chose que si le garage
            // sert : sinon il est sur les 1815 pastilles a la fois, donc sur
            // aucune. Une alerte qui vise tout ne vise rien.
            const absentGarage=!garageVide && !garageNums.has(n);
            return (
              <span key={n} style={{
                display:'inline-flex',alignItems:'center',gap:6,
                background:absentGarage?'rgba(156,106,31,0.12)':(C.card2||'rgba(0,0,0,0.05)'),
                border:absentGarage?`1px solid ${C.warn}`:'1px solid transparent',
                borderRadius:12,padding:'5px 8px 5px 10px',fontSize:13,fontWeight:500
              }}>
                {n}
                <button type="button" onClick={()=>removeOne(n)} title="Retirer" style={{background:'none',border:'none',color:C.danger,cursor:'pointer',fontSize:15,lineHeight:1,padding:0,fontWeight:700}}>×</button>
              </span>
            );
          })}
        </div>
      )}
      {liste.length>listeMax && (
        <div style={{marginTop:10}}>
          <button type="button" onClick={()=>setListeMax(m=>m+200)}
            style={{border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:12,padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            Voir plus — {listeMax} affichés sur {liste.length}
          </button>
        </div>
      )}
    </div>
  );
}
// ⟦← App.jsx #10⟧
function Inventory({ inventory, setInventory, accounts, garageGrid, labels, onLocate }) {
  const motsStock = useMotsArticle();   // (11 nov., lot DJ2) « paire » seulement pour Sneakers
  const exemplesInv = useExemplesVendeur();   // (11 nov., lot DJ2) l’exemple de titre suit ce qu’il vend
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all'); // all | online | sold | stock
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ numero:'', title:'', status:'stock' });
  const [showImport, setShowImport] = useState(false);
  const [importState, setImportState] = useState({}); // { [accId]: {loading, items, error} }
  const [importNums, setImportNums] = useState({});   // { [itemId]: numero }
  const [editing, setEditing] = useState(null);       // pair id
  const [editDraft, setEditDraft] = useState(null);
  const bordereauInputRef = React.useRef(null);
  const bordereauPairRef = React.useRef(null);        // paire ciblee par l'annotation

  const persist = (next) => { setInventory(next); save('vinted_inventory', next); };

  // Bordereau : on demande a l'utilisateur le PDF telecharge depuis Vinted, puis
  // on y imprime le numero + le titre de la paire avant de le retelecharger.
  const startBordereau = (pair) => { bordereauPairRef.current = pair; bordereauInputRef.current?.click(); };
  const onBordereauFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    const pair = bordereauPairRef.current;
    if (!file || !pair) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast('Merci de choisir le bordereau au format PDF téléchargé depuis Vinted.'); return;
    }
    try {
      const buf = await file.arrayBuffer();
      await annotateAndDownloadBordereau(pair.numero, pair.title, buf);
    } catch (err) {
      if (!estTamponAnnule(err)) toast('Impossible d\'annoter ce PDF : ' + String(err));
    }
  };

  // Index inverse garage : numero (normalise) -> present dans une case ?
  const garageNums = useMemo(() => {
    const s = new Set();
    Object.values(garageGrid || {}).forEach(arr => {
      if (Array.isArray(arr)) arr.forEach(v => { const t = (v||'').trim().toLowerCase(); if (t) s.add(t); });
    });
    return s;
  }, [garageGrid]);
  const inGarage = (numero) => !!numero && garageNums.has(String(numero).trim().toLowerCase());

  const accName = (accId) => (labels && labels[accId]) || accounts.find(a=>a.vinted_user_id===accId)?.login || `Compte #${accId}`;

  const numeroExists = (numero, exceptId=null) =>
    inventory.some(p => String(p.numero).trim().toLowerCase() === String(numero).trim().toLowerCase() && p.id !== exceptId);

  const addPair = () => {
    const numero = addForm.numero.trim();
    if (!numero) { toast('Indique un numéro.'); return; }
    if (numeroExists(numero)) { toast(`Le numéro ${numero} est déjà utilisé.`); return; }
    const pair = { id: uid(), numero, title: addForm.title.trim(), status: addForm.status,
      vintedItemId:null, vintedAccountId:null, price:null, photo:null, soldAt:null, transactionId:null, createdAt: tod() };
    persist([pair, ...inventory]);
    setAddForm({ numero:'', title:'', status:'stock' });
    setShowAdd(false);
  };

  const deletePair = async (id)=>{
    if (!await askConfirm('Supprimer cet article de l\'inventaire ?')) return;
    persist(inventory.filter(p => p.id !== id));
  };

  const startEdit = (p) => { setEditing(p.id); setEditDraft({ ...p }); };
  const commitEdit = () => {
    const numero = String(editDraft.numero).trim();
    if (!numero) { toast('Le numéro ne peut pas être vide.'); return; }
    if (numeroExists(numero, editDraft.id)) { toast(`Le numéro ${numero} est déjà utilisé.`); return; }
    persist(inventory.map(p => p.id === editDraft.id ? { ...editDraft, numero } : p));
    setEditing(null); setEditDraft(null);
  };

  // Import : charge les annonces en ligne d'un compte.
  const loadListings = async (acc) => {
    setImportState(s => ({ ...s, [acc.vinted_user_id]: { loading:true } }));
    const res = await fetchVintedListings(acc);
    setImportState(s => ({ ...s, [acc.vinted_user_id]: { loading:false, items: res.ok?res.items:[], error: res.ok?null:res.error } }));
    // Pre-remplit une suggestion de numero depuis le titre (nXX) - modifiable.
    if (res.ok) {
      setImportNums(prev => {
        const u = { ...prev };
        res.items.forEach(it => { if (u[it.id] === undefined) u[it.id] = extractPairNumber(it.title) || ''; });
        return u;
      });
    }
  };

  // Associe une annonce en ligne a un numero (cree ou met a jour la paire).
  const associate = (acc, listing) => {
    const numero = String(importNums[listing.id] || '').trim();
    if (!numero) { toast('Indique le numéro à associer à cette annonce.'); return; }
    const existing = inventory.find(p => String(p.numero).trim().toLowerCase() === numero.toLowerCase());
    if (existing) {
      // On sauvegarde le titre EXACT de l'annonce : c'est ce même titre qui
      // reviendra dans la commande vendue, et qui permettra de retrouver le
      // numéro au moment de la vente (les commandes n'ont pas d'id d'article).
      persist(inventory.map(p => p.id === existing.id
        ? { ...p, title: listing.title, status:'online', vintedItemId: listing.id,
            vintedAccountId: acc.vinted_user_id, price: listing.price, photo: listing.photo }
        : p));
    } else {
      const pair = { id: uid(), numero, title: listing.title, status:'online', vintedItemId: listing.id,
        vintedAccountId: acc.vinted_user_id, price: listing.price, photo: listing.photo, soldAt:null, transactionId:null, createdAt: tod() };
      persist([pair, ...inventory]);
    }
  };

  const isListingLinked = (itemId) => inventory.some(p => p.vintedItemId === String(itemId));

  // Synchronise les VENTES depuis Vinted : recupere les commandes vendues de
  // chaque compte et bascule en "Vendu" les paires de l'inventaire dont le
  // numero (nXX) apparait dans le titre de la commande. Ne touche jamais une
  // paire deja marquee vendue, ni une commande annulee/remboursee.
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const syncSalesFromVinted = async () => {
    if (accounts.length === 0) { setSyncResult({ msg:'Aucun compte Vinted lié.' }); return; }
    setSyncing(true); setSyncResult(null);
    // Matching par TITRE : les annonces Vinted n'exposent pas d'id d'article
    // dans les commandes, seulement le titre exact. On a sauvegardé ce titre
    // sur chaque paire au moment de l'association -> on relie ainsi la vente au
    // numéro sans dépendre d'un "nXX" dans le titre.
    const byTitle = new Map();
    inventory.forEach(p => { const k = normTitle(p.title); if (k) byTitle.set(k, p); });
    const updates = new Map(); // id -> patch
    let sold = 0, pending = 0, scanned = 0;
    for (const acc of accounts) {
      // Priorité aux ventes moissonnées par l'extension (aucun appel Vinted).
      // Sinon repli sur le proxy (jusqu'à 3 pages).
      const harvested = await fetchHarvest(acc.vinted_user_id, 'orders');
      let pages;
      if (harvested && Array.isArray(harvested.my_orders)) {
        pages = [harvested.my_orders];
      } else {
        pages = [];
        for (let page = 1; page <= 3; page++) {
          const res = await fetchVintedOrders(acc, 'sold', page, 'all');
          if (!res.ok) break;
          pages.push(res.items || []);
          if (!res.pagination || page >= (res.pagination.total_pages || 1)) break;
        }
      }
      for (const orders of pages) {
        scanned += orders.length;
        for (const o of orders) {
          const cls = classifyOrderStatus(o.status);
          const pair = byTitle.get(normTitle(o.title));
          if (!pair) continue;
          const base = {
            transactionId: o.transaction_id || pair.transactionId || null,
            photo: pair.photo || orderPhoto(o) || null,
            price: pair.price ?? (o.price?.amount != null ? Number(o.price.amount) : null),
            vintedAccountId: pair.vintedAccountId || acc.vinted_user_id,
          };
          if (cls === 'completed') {
            // Vente FINALISÉE = argent reçu -> on la comptabilise.
            if (pair.status !== 'sold') { updates.set(pair.id, { ...base, status:'sold', soldAt: o.date ? new Date(o.date).toLocaleDateString('fr-FR') : tod() }); sold++; }
          } else if (cls === 'cancelled') {
            // Annulée/remboursée : si on l'avait mise "en cours", on la remet en ligne.
            if (pair.status === 'pending_sale') updates.set(pair.id, { status:'online' });
          } else {
            // Vente en cours (expédiée, en acheminement...) : on l'affiche mais on
            // NE la compte PAS tant que l'acheteur n'a pas validé (argent reçu).
            if (pair.status === 'online' || pair.status === 'stock') { updates.set(pair.id, { ...base, status:'pending_sale' }); pending++; }
          }
        }
      }
    }
    if (updates.size > 0) {
      persist(inventory.map(p => updates.has(p.id) ? { ...p, ...updates.get(p.id) } : p));
    }
    setSyncing(false);
    setSyncResult({ sold, pending, scanned });
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return inventory
      .filter(p => filter === 'all' ? true : p.status === filter)
      .filter(p => !term || String(p.numero).toLowerCase().includes(term) || (p.title||'').toLowerCase().includes(term))
      .sort((a,b) => {
        const na = parseInt(a.numero,10), nb = parseInt(b.numero,10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
        return String(a.numero).localeCompare(String(b.numero));
      });
  }, [inventory, q, filter]);

  const counts = useMemo(() => ({
    all: inventory.length,
    online: inventory.filter(p=>p.status==='online').length,
    pending_sale: inventory.filter(p=>p.status==='pending_sale').length,
    sold: inventory.filter(p=>p.status==='sold').length,
    stock: inventory.filter(p=>p.status==='stock').length,
  }), [inventory]);

  const inputStyle = { padding:'8px 10px', borderRadius:12, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:13 };
  const btn = (bg, fg='#fff') => ({ padding:'8px 12px', borderRadius:12, border:'none', background:bg, color:fg, fontWeight:500, fontSize:13, cursor:'pointer' });

  return (
    <div style={{padding:'0 4px'}}>
      <input ref={bordereauInputRef} type="file" accept="application/pdf,.pdf" onChange={onBordereauFile} style={{display:'none'}}/>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
        <StatBox label={motsStock.noms.charAt(0).toUpperCase() + motsStock.noms.slice(1)} value={counts.all}/>
        <StatBox label="En ligne" value={counts.online} color={INV_STATUS.online.color}/>
        <StatBox label="Vente en cours" value={counts.pending_sale} color={INV_STATUS.pending_sale.color}/>
        <StatBox label="Vendues" value={counts.sold} color={INV_STATUS.sold.color} sub="argent reçu"/>
        <StatBox label="En stock" value={counts.stock} color={INV_STATUS.stock.color}/>
      </div>

      <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center',marginBottom:12}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un numéro ou un titre…"
          style={{...inputStyle, flex:1, minWidth:180}}/>
        <button type="button" onClick={()=>{setShowAdd(v=>!v);setShowImport(false);}} style={btn(C.accent)}>➕ Ajouter</button>
        <button type="button" onClick={()=>{setShowImport(v=>!v);setShowAdd(false);}} style={btn(C.blue||C.accent)}>🔄 Importer mes annonces</button>
        <button type="button" onClick={syncSalesFromVinted} disabled={syncing} style={{...btn(INV_STATUS.sold.color),opacity:syncing?0.6:1,cursor:syncing?'default':'pointer'}}>
          {syncing ? 'Synchronisation…' : '💸 Mettre à jour les ventes'}
        </button>
      </div>

      {syncResult && (
        <div style={{fontSize:12,marginBottom:12,padding:'8px 12px',borderRadius:12,background:C.surface,border:`1px solid ${C.border}`,color:C.text}}>
          {syncResult.msg
            ? syncResult.msg
            : ((syncResult.sold + syncResult.pending) > 0
                ? `✅ ${syncResult.sold} vente(s) finalisée(s) comptée(s)${syncResult.pending?`, ${syncResult.pending} en cours (non comptée(s), en attente de validation)`:''} — sur ${syncResult.scanned} commandes analysées.`
                : `Aucune vente à reporter (${syncResult.scanned} commandes analysées). Chaque article doit avoir le même titre que son annonce Vinted (via « Importer mes annonces »).`)}
        </div>
      )}

      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
        {[['all','Toutes'],['online','En ligne'],['pending_sale','En cours'],['sold','Vendues'],['stock','Stock']].map(([id,label]) => (
          <button key={id} type="button" onClick={()=>setFilter(id)}
            style={{padding:'7px 14px',borderRadius:12,border:`1px solid ${filter===id?C.accent:C.border}`,
              background:filter===id?C.accent:'transparent',color:filter===id?'#fff':C.muted,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
              boxShadow:filter===id?`0 2px 8px ${C.accent}44`:'none',transition:'all .18s ease'}}>
            {label} <span style={{opacity:0.7}}>({counts[id]})</span>
          </button>
        ))}
      </div>

      {showAdd && (
        <Card style={{marginBottom:14}}>
          <div style={{fontWeight:600,marginBottom:10,color:C.text}}>Nouvel article</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
            <input value={addForm.numero} onChange={e=>setAddForm(f=>({...f,numero:e.target.value}))} placeholder="Numéro (ex : 2057)" style={{...inputStyle,width:150}}/>
            <input value={addForm.title} onChange={e=>setAddForm(f=>({...f,title:e.target.value}))} placeholder={motsStock.nom === 'paire' ? 'Titre (ex : Adidas Spezial 38)' : `Titre (${exemplesInv.achat})`} style={{...inputStyle,flex:1,minWidth:180}}/>
            <select value={addForm.status} onChange={e=>setAddForm(f=>({...f,status:e.target.value}))} style={inputStyle}>
              <option value="stock">📦 Stock</option>
              <option value="online">🟢 En ligne</option>
              <option value="sold">💸 Vendu</option>
            </select>
            <button type="button" onClick={addPair} style={btn(C.accent)}>Enregistrer</button>
          </div>
        </Card>
      )}

      {showImport && (
        <Card style={{marginBottom:14}}>
          <div style={{fontWeight:600,marginBottom:4,color:C.text}}>Importer mes annonces en ligne</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>
            Charge tes annonces en ligne, donne à chacune son numéro, puis « Associer ».
            {' '}<Pourquoi>Si le titre contient déjà « nXX », le numéro est pré-rempli (tu peux le corriger).</Pourquoi>
          </div>
          {accounts.length === 0 && <div style={{fontSize:13,color:C.muted}}>Aucun compte Vinted lié.</div>}
          {accounts.map(acc => {
            const st = importState[acc.vinted_user_id] || {};
            return (
              <div key={acc.vinted_user_id} style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <div style={{fontWeight:500,color:C.text,fontSize:13}}>{accName(acc.vinted_user_id)}</div>
                  <button type="button" onClick={()=>loadListings(acc)} style={{...btn(C.blue||C.accent),padding:'5px 10px',fontSize:12}}>
                    {st.loading ? 'Chargement…' : (st.items ? 'Recharger' : 'Charger les annonces')}
                  </button>
                </div>
                {st.error && <div style={{fontSize:12,color:C.danger}}>Erreur : {String(st.error)}</div>}
                {st.items && st.items.length === 0 && <div style={{fontSize:12,color:C.muted}}>Aucune annonce en ligne sur ce compte.</div>}
                {st.items && st.items.length > 0 && (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))',gap:12}}>
                    {st.items.map(listing => {
                      const linked = isListingLinked(listing.id);
                      return (
                        <div key={listing.id} style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',background:C.bg,opacity:linked?0.6:1}}>
                          <div style={{width:'100%',aspectRatio:'1/1',background:C.border,display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {listing.photo ? <PhotoVinted src={listing.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{fontSize:28}}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}
                          </div>
                          <div style={{padding:8}}>
                            <div title={listing.title} style={{fontSize:11,fontWeight:600,color:C.text,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',minHeight:28}}>{listing.title}</div>
                            {linked ? (
                              <div style={{fontSize:11,color:INV_STATUS.online.color,fontWeight:500,marginTop:6}}>✓ Associée</div>
                            ) : (
                              <div style={{display:'flex',gap:4,marginTop:6}}>
                                <input value={importNums[listing.id] ?? ''} onChange={e=>setImportNums(n=>({...n,[listing.id]:e.target.value}))}
                                  placeholder="N°" style={{...inputStyle,width:52,padding:'5px 6px'}}/>
                                <button type="button" onClick={()=>associate(acc, listing)} style={{...btn(C.accent),padding:'5px 8px',fontSize:11,flex:1}}>Associer</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {filtered.length === 0 && (
        <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'30px 0'}}>
          {inventory.length === 0 ? 'Ton inventaire est vide. Ajoute un article ou importe tes annonces en ligne.' : 'Aucun article pour ce filtre.'}
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {filtered.map(p => {
          const stt = INV_STATUS[p.status] || INV_STATUS.stock;
          const garage = inGarage(p.numero);
          return (
            <div key={p.id} style={{display:'flex',gap:12,alignItems:'center',padding:11,borderRadius:12,border:`1px solid ${C.border}`,background:C.card,boxShadow:C.shadow||'none'}}>
              <div style={{width:52,height:52,borderRadius:12,background:C.border,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                {p.photo ? <PhotoVinted src={p.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{fontSize:22}}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}
              </div>
              <div style={{flexShrink:0,minWidth:54,textAlign:'center'}}>
                <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>N°</div>
                <div style={{fontSize:20,fontWeight:700,color:C.text,lineHeight:1}}>{p.numero}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.title || <span style={{color:C.muted,fontStyle:'italic'}}>Sans titre</span>}</div>
                <div style={{display:'flex',gap:6,alignItems:'center',marginTop:5,flexWrap:'wrap'}}>
                  <Badge color={stt.color}>{stt.icon} {stt.label}</Badge>
                  <button type="button" onClick={()=>garage && onLocate && onLocate(p.numero)}
                    title={garage?'Voir dans le stock':'Ce numéro n\'apparaît dans aucune case du stock'}
                    style={{border:'none',background:'transparent',cursor:garage?'pointer':'default',padding:0,fontSize:11,fontWeight:500,color:garage?C.blue||C.accent:C.muted}}>
                    {garage ? 'Au stock' : 'Absent du stock'}
                  </button>
                  {p.price != null && <span style={{fontSize:11,color:C.muted}}>{p.price}&nbsp;€</span>}
                  {p.vintedItemId && <span style={{fontSize:11,color:C.muted}}>🔗 annonce liée</span>}
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button className="vrm-icon-control" aria-label="Générer le bordereau annoté (numéro + titre)" type="button" title="Générer le bordereau annoté (numéro + titre)" onClick={()=>startBordereau(p)} style={{...btn('transparent',C.text),border:`1px solid ${C.border}`,padding:'6px 10px'}}><Icon name="doc" size={16}/></button>
                <button className="vrm-icon-control" aria-label="Modifier l’article" type="button" onClick={()=>startEdit(p)} style={{...btn('transparent',C.text),border:`1px solid ${C.border}`,padding:'6px 10px'}}>✏️</button>
                <button className="vrm-icon-control" aria-label="Supprimer l’article" type="button" onClick={()=>deletePair(p.id)} style={{...btn('transparent',C.danger),border:`1px solid ${C.border}`,padding:'6px 10px'}}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && editDraft && (
        <div onClick={()=>{setEditing(null);setEditDraft(null);}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <FermeAuRetour fermer={()=>{setEditing(null);setEditDraft(null);}}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:12,padding:20,width:'100%',maxWidth:420}}>
            <div style={{fontWeight:600,fontSize:15,color:C.text,marginBottom:14}}>Modifier l’article</div>
            <label style={{display:'block',fontSize:11,color:C.muted,marginBottom:4}}>Numéro</label>
            <input value={editDraft.numero} onChange={e=>setEditDraft(d=>({...d,numero:e.target.value}))} style={{...inputStyle,width:'100%',marginBottom:12}}/>
            <label style={{display:'block',fontSize:11,color:C.muted,marginBottom:4}}>Titre</label>
            <input value={editDraft.title||''} onChange={e=>setEditDraft(d=>({...d,title:e.target.value}))} style={{...inputStyle,width:'100%',marginBottom:12}}/>
            <label style={{display:'block',fontSize:11,color:C.muted,marginBottom:4}}>Statut</label>
            <select value={editDraft.status} onChange={e=>setEditDraft(d=>({...d,status:e.target.value}))} style={{...inputStyle,width:'100%',marginBottom:16}}>
              <option value="stock">📦 Stock</option>
              <option value="online">🟢 En ligne</option>
              <option value="pending_sale">⏳ Vente en cours</option>
              <option value="sold">💸 Vendu</option>
            </select>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="vrm-b vrm-b-discret" type="button" onClick={()=>{setEditing(null);setEditDraft(null);}} style={{...btn('transparent',C.text),border:`1px solid ${C.border}`}}>Annuler</button>
              <button type="button" onClick={commitEdit} style={btn(C.accent)}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export { Garage, StockVinted, Inventory };
