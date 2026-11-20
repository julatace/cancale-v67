// ══════════════════════════════════════════════════════════════════════════
//  ANNONCES — LE BRANCHEMENT DE L'ÉCRAN NATIF (19 nov. 2026)
//
//  Julien : « je veux que tout soit comme Vinted, avec toutes les informations à côté : les prix minimum
//  acceptés, relier un achat, relié à Vinted. Ce n'est pas parce que Vinted est ma plateforme principale
//  que c'est la plateforme principale des autres. »
//
//  Ici seulement les LECTURES et les ÉCRITURES ; la vue est src/natif/ecrans/Annonces.jsx, les règles
//  src/articles/ (modele, sources). Chaque site est lu par SES règles, celles que l'app applique déjà :
//    · Vinted : `fetchVintedListings` (<enligne-regle>), compte par compte, comme le Stock ;
//    · Leboncoin : `lbc_listings` (projeté) + `lbc_ventes`, `annonceLbcEnVente` / `etatEnLigneLbc`,
//      N° par `numeroLbcIdentite` — TOUTES ses annonces, plus seulement celles « reliées » (le défaut du 19 nov.) ;
//    · eBay : `lireEbayTous` (`ebay_listings`), N° par `numEbayLu` (SKU, lien, N° propre) ;
//    · Vestiaire : `vc_listings` projeté, `etatAnnonceVcBrut`, `numVcAnnonce`.
//  Une lecture ratée ⇒ ce site est « pas su », NOMMÉ en pied (jamais « aucune annonce »).
//  Les faits (acheté, prix mini) s'écrivent par `gesteVrm` (`opsFait` : la fiche Vinted si l'article en a une,
//  sinon `vrm_articles_sites` sous l'identifiant de l'annonce de SON site), relus juste avant : carte pas lue ⇒ rien.
//  Les actions passent par l'écran Annonces Vinted d'hier (monté, caché) : `demanderActionAnnonces`.
// ══════════════════════════════════════════════════════════════════════════
import { useComptesBloques } from '../compteBloqueEtat.js';
import { etatLienLu, propositionLu, relierDepuisListe, queSurCeSite, ouvrirLiaison, abonnerLiaison, demanderLiaison } from '../liaisonEtat.js';   // (20 nov.) relier depuis la liste
import React from 'react';
import { tr } from '../i18n/index.js';
import VueAnnonces from '../natif/ecrans/Annonces.jsx';
import { construireArticles, filtrerArticles, compterArticles, trierArticles, opsFait, limitesDe, NOM_SITE, CLE_ARTICLES, statutTableau, comptesDesArticles } from '../articles/modele.js';
import { annoncesVinted, annoncesLeboncoin, annoncesEbay, annoncesVestiaire } from '../articles/sources.js';
import { etatEnLigneLbc } from '../enLigneLbc.js';
import { annuaireLbc } from '../plateformes.js';
import { etatAnnonceVcBrut, numVcAnnonce } from '../../api/_lib/vestiaire-regle.js';
import { fetchVintedListings, lbcListingsSession, lireBaseRelue, SUPABASE_URL, lireEbayTous, SEL_EBAY_ANNONCES, numEbayLu, numeroLbcIdentite,
  annonceLbcEnVente, annoncesLbcVendues, lienEbay, cleNum, fmt, gesteVrm, load, Icon, PhotoVinted, numerosVcEffectifs, comptesStockEcartes, toast, demanderActionAnnonces, askConfirm, vmrCmd, vmrExtPresent, __vmrEtat } from '../App.jsx';

const JOUR = 24 * 3600 * 1000;
const ACTIONS = [
  { cle: 'recreer', libelle: 'egalite.action.republier', icone: 'sync', etats: ['enligne'], robot: true },
  { cle: 'main', libelle: 'egalite.action.main', icone: 'pencil', etats: ['enligne', 'masquee', 'brouillon'] },
  { cle: 'versBrouillon', libelle: 'egalite.action.versBrouillon', icone: 'archive', etats: ['enligne'], robot: true },
  { cle: 'enLigne', libelle: 'egalite.action.enLigne', icone: 'play', etats: ['brouillon'], robot: true },
  { cle: 'baisser', libelle: 'egalite.action.baisser', icone: 'tag', etats: ['enligne'] },
  { cle: 'partout', libelle: 'egalite.action.partout', icone: 'link', etats: ['enligne'], tousSites: true },
  // (19 nov., publier-agent) « Publier sur… » : l'agent sans IA remplit chaque site depuis la fiche article neutre (src/publier/).
  { cle: 'agent', libelle: 'agent.action', icone: 'link', etats: ['enligne'], tousSites: true },
];
const cleActionTr = { recreer: 'republier', main: 'main', versBrouillon: 'versBrouillon', enLigne: 'enLigne', baisser: 'baisser', partout: 'partout' };
const PublierAgent = React.lazy(() => import('./PublierAgent.jsx'));
const vintedDe = (a) => a.annonces.find((x) => x.site === 'vinted') || null;
const propreJournal = (journal, site, id) => { const e = journal && journal['propre:' + site + ':' + id]; return !!(e && typeof e === 'object' && e.actif !== false); };

// Toutes les annonces de tous ses sites, dans la forme commune. Rend { annonces, manque: [site] } ou null (rien lu).
export async function lireAnnoncesEgalite(accounts) {
  const horsCompte = comptesStockEcartes();
  const accs = (accounts || []).filter((a) => a && a.vinted_user_id != null && !horsCompte({ accountId: a.vinted_user_id }));
  const manque = [];
  const [vinted, ls, vr, eb, vc, annu] = await Promise.all([
    Promise.all(accs.map(async (acc) => {
      const uid = String(acc.vinted_user_id);
      let r; try { r = await fetchVintedListings(acc, 1, {}); } catch (_) { r = null; }
      if (!r || !r.ok) return { uid, ok: false };
      return { uid, pseudo: String(acc.login || acc.username || ''), ok: true, enLigne: r.items || [], aConfirmer: r.aConfirmer || [], masquees: r.masquees || [], brouillons: r.brouillons || [] };
    })),
    lbcListingsSession().catch(() => null),
    lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_ventes&select=ventes:data->ventes`).catch(() => null),
    lireEbayTous('ebay_listings', SEL_EBAY_ANNONCES, 'items').catch(() => null),
    lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_listings&select=items:data->items,liens:data->liens,capturedAt:data->>capturedAt`).catch(() => null),
    lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_accounts&select=a:data->accounts`).catch(() => null),
  ]);
  const journal = load('vrm_liaison_sites', {}) || {};
  const out = [];
  if (vinted.some((c) => !c.ok)) manque.push('vinted');
  out.push(...annoncesVinted(vinted));
  // Leboncoin
  if (ls && ls.items && Array.isArray(vr)) {
    const vendues = annoncesLbcVendues((vr[0] && vr[0].ventes) || {});
    const liens = { ...(load('vrm_lbc_liens', {}) || {}) };
    const noms = Array.isArray(annu) ? annuaireLbc((annu[0] && annu[0].a) || {}) : null;
    out.push(...annoncesLeboncoin(ls.items, {
      etatDe: (ad) => { if (!annonceLbcEnVente(ad, vendues)) return vendues.has(String(ad.id)) ? 'vendue' : 'retiree';
        const e = etatEnLigneLbc(ad, { enVente: (x) => annonceLbcEnVente(x, vendues), lectures: ls.lectures || {}, maintenant: Date.now() });
        return e.etat === 'enligne' ? 'active' : e.etat === 'aconfirmer' ? 'aconfirmer' : 'retiree'; },
      numeroDe: (ad) => numeroLbcIdentite({ itemId: ad.id }, ls.items, liens),
      pseudoDe: (ad) => { const c = String(ad.account || ad.lbcUser || '').replace(/^lbc-account:/i, ''); return (noms && noms[c]) || ad.accountName || ''; },
      propreDe: (ad) => propreJournal(journal, 'Leboncoin', ad.id) }));
  } else manque.push('leboncoin');
  // eBay
  if (eb && Array.isArray(eb.items)) {
    const luDe = new Map((eb.lignes || []).map(({ compte, ligne }) => [compte && compte.ref, ligne && ligne.capturedAt ? Date.parse(ligne.capturedAt) : NaN]));
    out.push(...annoncesEbay(eb.items.map((x) => { const t = luDe.get(x && x._compte); return { ...x, frais: Number.isFinite(t) && Date.now() - t >= 0 && Date.now() - t < JOUR }; }), {
      numeroDe: (x) => numEbayLu(x && x.sku, x && x.itemId, null, x && x.depuis) || '',
      vintedDe: (x) => { const l = lienEbay(x && x.itemId); return l ? String(l.pairId) : ''; },
      propreDe: (x) => propreJournal(journal, 'eBay', x && x.itemId) }));
    if ((eb.illisibles || []).length) manque.push('ebay');
  } else manque.push('ebay');
  // Vestiaire
  if (Array.isArray(vc)) {
    const L = vc[0] || {};
    const auto = numerosVcEffectifs();
    const liensVc = load('vrm_vc_liens', {}) || {};
    const t = Date.parse(L.capturedAt || '');
    out.push(...annoncesVestiaire(L.items || {}, {
      etatDe: (id, it) => etatAnnonceVcBrut(it, false, L.capturedAt),
      numeroDe: (id, it) => numVcAnnonce(id, it, { ...(L.liens || {}) }, auto),
      vintedDe: (id) => { const x = liensVc[String(id)]; return x && typeof x === 'object' && x.item ? String(x.item) : ''; },
      vieille: !(Number.isFinite(t) && Date.now() - t < JOUR) }));
  } else manque.push('vestiaire');
  return { annonces: out, manque };
}

// `site` (20 nov., sélecteur de plateforme global — src/siteCourant.js) : le site choisi pour toute l'app ('toutes' | un site).
// Donné, il REMPLACE le filtre de site de l'écran (liste et tableau) : plus de menu des sites ici. Absent (bancs d'hier) :
// le filtre local d'avant.
export default function AnnoncesEgalite({ accounts: accountsTous = [], siteInitial = 'tous', onEcranSite = null, site: siteGlobal = null }) {
  // (19 nov., intégration — lot compte-bloque) Un compte que Vinted a bloqué et que le vendeur a mis EN PAUSE (son choix) :
  // ses annonces sortent de la liste, comme dans l'écran d'avant (`annBase`) ; la ligne « N annonces en pause » les dit.
  const { pause: pauseCB } = useComptesBloques();
  const accounts = React.useMemo(() => (accountsTous || []).filter((a) => !(a && pauseCB && pauseCB.has(String(a.vinted_user_id)))), [accountsTous, pauseCB]);
  const [lu, setLu] = React.useState(undefined);            // undefined lecture · null pas su · { annonces, manque }
  const [tic, setTic] = React.useState(0);
  // (19 nov. soir, tableau de travail) « Mis à jour il y a … » : l'heure de la dernière lecture RÉUSSIE ; ⟳ relance la MÊME lecture.
  const [majLe, setMajLe] = React.useState(undefined);
  const [relit, setRelit] = React.useState(false);
  const [filtreT, setFiltreT] = React.useState({ site: siteInitial || 'tous', compte: '', dort: 'toutes' });
  const [filtre, setFiltre] = React.useState({ site: siteInitial || 'tous', etat: 'enligne' });
  const siteG = siteGlobal == null ? null : (siteGlobal === 'toutes' ? 'tous' : siteGlobal);
  React.useEffect(() => {
    if (siteG == null) return;
    setFiltre((f) => (f.site === siteG ? f : { ...f, site: siteG }));
    setFiltreT((f) => (f.site === siteG ? f : { ...f, site: siteG, compte: '' }));
  }, [siteG]);
  const [q, setQ] = React.useState('');
  const [agent, setAgent] = React.useState(null);           // les articles choisis pour « Publier sur… »
  const cleComptes = (accounts || []).map((a) => String((a && a.vinted_user_id) || '')).sort().join(',');
  React.useEffect(() => {
    let vivant = true;
    lireAnnoncesEgalite(accounts).then((r) => { if (vivant) { setLu(r); setMajLe(r ? Date.now() : null); setRelit(false); } }).catch(() => { if (vivant) { setLu(null); setMajLe(null); setRelit(false); } });
    return () => { vivant = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleComptes, tic]);
  React.useEffect(() => {
    const f = (e) => { const k = e && e.detail && e.detail.k; if ([CLE_ARTICLES, 'vinted_annonce_numeros', 'vinted_buyprice_by_num', 'vrm_lbc_liens', 'vrm_ebay_liens', 'vrm_vc_liens', 'vrm_slots'].includes(k)) setTic((t) => t + 1); };
    const g = (e) => { const d = e && e.detail; if (d && d.type === 'maj') setTic((t) => t + 1); };
    window.addEventListener('vrm:save', f); window.addEventListener('vrm:ext', g);
    return () => { window.removeEventListener('vrm:save', f); window.removeEventListener('vrm:ext', g); };
  }, []);
  const seuil = (() => { try { const s = Number(localStorage.getItem('vrm_qd_seuil')); return [30, 60, 90].includes(s) ? s : 30; } catch (_) { return 30; } })();
  const modele = React.useMemo(() => {
    if (!lu) return lu;
    const aVinted = (accounts || []).length > 0;
    return construireArticles({ annonces: lu.annonces, fiches: load('vinted_annonce_numeros', {}) || {}, faits: load(CLE_ARTICLES, {}) || {},
      achatsParNum: load('vinted_buyprice_by_num', {}) || {}, slots: load('vrm_slots', {}) || {}, cle: cleNum, aVinted,
      meubleDe: (s) => { const m = (load('vrm_meubles', []) || []).find((x) => x && String(x.id) === String(s.m)); return m ? `${m.name || ''} · ${Number(s.i) + 1}` : ''; } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lu, tic]);
  const sites = React.useMemo(() => (modele ? [...new Set(modele.articles.flatMap((a) => a.sites))] : []), [modele]);
  const opts = { seuil, maintenant: Date.now(), cle: cleNum };
  const comptes = modele ? compterArticles(modele.articles, opts) : null;
  const liste = modele ? trierArticles(filtrerArticles(modele.articles, { ...opts, site: filtre.site, etat: filtre.etat, recherche: q })) : modele;
  const nomSite = (s) => NOM_SITE[s] || s;
  const limites = limitesDe(sites).map((l) => tr('egalite.limite.' + l.quoi, { site: nomSite(l.site) }));
  const manque = lu && lu.manque && lu.manque.length && lu.manque.some((s) => sites.includes(s) || s === 'vinted') ? tr('egalite.pasSu') : '';

  // Écrire un fait : les cartes RELUES maintenant ; `null` (pas lue) ⇒ rien n'est écrit.
  const onFait = async (article, champs) => {
    const lire = (k) => { try { const v = load(k, null); return v && typeof v === 'object' ? v : null; } catch (_) { return null; } };
    const r = opsFait({ article, champs, cartes: { fiches: lire('vinted_annonce_numeros'), faits: lire(CLE_ARTICLES) || {}, parNum: lire('vinted_buyprice_by_num') || {} } });
    if (!r || r.refus) return { refus: (r && r.refus) || 'pas-su' };
    gesteVrm(tr('egalite.enregistre', { quoi: tr('egalite.col.' + (champs.min !== undefined ? 'prixMini' : 'achat')) }), r.ops, {}, () => setTic((t) => t + 1));
    return { ok: true };
  };
  const actions = ACTIONS.map((A) => ({
    cle: A.cle, libelle: tr(A.libelle), icone: A.icone, phrase: A.cle === 'agent' ? tr('agent.action.phrase') : tr('egalite.action.' + cleActionTr[A.cle] + '.phrase'),
    pour: (a) => (A.tousSites ? !!a.numero && a.annonces.some((x) => x.etat === 'enligne') : (() => { const v = vintedDe(a); return !!v && A.etats.includes(v.etat); })()),
    juger: (sel) => {
      if (!sel.length) return { ok: false, raison: tr('egalite.selection.aucune') };
      if (A.robot) { const c = new Set(sel.map((a) => (vintedDe(a) || {}).compte)); if (c.size > 1) return { ok: false, raison: tr('egalite.action.vintedSeul') }; }
      return { ok: true };
    },
  }));
  // (19 nov. soir, « tout doit marcher aussi pour Leboncoin et Vestiaire ») Les gestes que CHAQUE site permet, par les chemins
  // EXISTANTS : le prix sur tous ses sites d'un N° (la feuille « Changer le prix », `vrm:prix-partout` : Vinted, Leboncoin
  // `baisserPrixLbc`, Vestiaire `baisserPrixVestiaire`, chacun avec ses garde-fous) — un article à la fois ; la PAUSE Leboncoin
  // sur son geste CONFIRMÉ (`lbcPause`, une à la fois, la réponse de Leboncoin dite), jamais une suppression.
  const lbcEnLigne = (a) => a.annonces.filter((x) => x.site === 'leboncoin' && x.etat === 'enligne');
  const pauseLbcSue = () => (vmrExtPresent() && __vmrEtat && __vmrEtat.lbcPause === true);
  actions.push(
    { cle: 'prixSites', libelle: tr('egalite.action.prixSites'), icone: 'tag', phrase: tr('egalite.action.prixSites.phrase'),
      pour: (a) => !!a.numero && a.annonces.some((x) => x.etat === 'enligne'),
      juger: (sel) => (sel.length === 1 ? { ok: true } : { ok: false, raison: sel.length ? tr('egalite.action.unALaFois') : tr('egalite.selection.aucune') }) },
    { cle: 'pauseLbc', libelle: tr('egalite.action.pauseLbc'), icone: 'archive', phrase: tr('egalite.action.pauseLbc.phrase'),
      pour: (a) => lbcEnLigne(a).length > 0,
      juger: (sel) => (!sel.length ? { ok: false, raison: tr('egalite.selection.aucune') } : !pauseLbcSue() ? { ok: false, raison: tr('egalite.action.pauseLbc.ext') } : { ok: true }) });
  const pauserLbc = async (choisis) => {
    const ids = choisis.flatMap((a) => lbcEnLigne(a).map((x) => ({ id: String(x.id), numero: a.numero || '', titre: a.titre || '' })));
    if (!ids.length) return;
    const ok = await askConfirm({ title: tr('egalite.pauseLbc.titre', { n: ids.length }), desc: tr('egalite.pauseLbc.desc'), ok: tr('egalite.action.pauseLbc'), cancel: tr('egalite.pauseLbc.annuler') });
    if (!ok) return;
    let faits = 0, refus = 0;
    for (const x of ids) {   // une à la fois : l'extension relit l'annonce, vérifie le compte de l'onglet, garde, sécurité
      let rep = null; try { rep = await vmrCmd({ cmd: 'lbcPause', id: x.id }, 70000); } catch (_) { rep = null; }
      if (rep && rep.accepte && rep.etape === 'fait') faits++; else refus++;
    }
    toast(tr('egalite.pauseLbc.bilan', { faits, refus }));
    setTic((t) => t + 1);
  };
  const onAction = (k, choisis) => {
    if (k === 'prixSites') { const a = choisis[0]; if (a && a.numero) { try { window.dispatchEvent(new CustomEvent('vrm:prix-partout', { detail: String(a.numero) })); } catch (_) {} } return; }
    if (k === 'pauseLbc') { pauserLbc(choisis); return; }
    if (k === 'agent') { setAgent(choisis); return; }
    if (k === 'partout') { const nums = choisis.map((a) => a.numero).filter(Boolean); if (nums.length) { try { window.dispatchEvent(new CustomEvent('vrm:publier-partout', { detail: { nums } })); } catch (_) {} } return; }
    const sel = choisis.map(vintedDe).filter(Boolean).map((v) => ({ uid: v.compte, id: v.id }));
    if (!sel.length) { toast(tr('egalite.action.vintedSeul')); return; }
    demanderActionAnnonces(k, sel);
  };
  // (19 nov. soir) Le TABLEAU de l'ordinateur : les articles au site et au compte choisis, chacun avec SON état (`statutTableau`) ;
  // « Dorment » = la règle du segment (`filtrerArticles` etat 'dorment'), au même site et au même compte.
  const cpts = modele ? comptesDesArticles(modele.articles, filtreT.site) : [];
  const cptChoisi = filtreT.compte ? cpts.find((c) => c.cle === filtreT.compte) || null : null;
  const siteT = cptChoisi ? cptChoisi.site : filtreT.site, compteT = cptChoisi ? cptChoisi.compte : '';
  const lignesT = React.useMemo(() => {
    if (!modele) return modele;
    const dort = filtreT.dort === 'dorment' ? new Set(filtrerArticles(modele.articles, { ...opts, site: siteT, compte: compteT, etat: 'dorment' }).map((a) => a.cle)) : null;
    const out = [];
    for (const a of trierArticles(modele.articles)) { if (dort && !dort.has(a.cle)) continue; const st = statutTableau(a, { site: siteT, compte: compteT }); if (st) out.push({ a, statut: st }); }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modele, siteT, compteT, filtreT.dort, seuil]);
  const nomCompte = (c) => (c.pseudo || ('#' + c.compte)) + (filtreT.site === 'tous' && sites.length > 1 ? ' · ' + nomSite(c.site) : '');
  const tableau = {
    articles: lignesT, majLe, rafraichit: relit, onRafraichir: () => { setRelit(true); setTic((t) => t + 1); },
    compte: cptChoisi ? nomCompte(cptChoisi) : '',
    onAutomatisations: () => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=automatisations' })); } catch (_) {} },
    filtres: [
      ...(sites.length > 1 && siteG == null ? [{ cle: 'site', libelle: tr('egalite.site.titre'), valeur: filtreT.site, onChange: (v) => setFiltreT((f) => ({ ...f, site: v, compte: '' })),
        options: [{ cle: 'tous', libelle: tr('egalite.site.tous') }, ...sites.map((s) => ({ cle: s, libelle: nomSite(s) }))] }] : []),
      ...(cpts.length > 1 ? [{ cle: 'compte', libelle: tr('tableau.filtre.compte'), valeur: filtreT.compte || 'tous', onChange: (v) => setFiltreT((f) => ({ ...f, compte: v === 'tous' ? '' : v })),
        options: [{ cle: 'tous', libelle: tr('tableau.tousComptes') }, ...cpts.map((c) => ({ cle: c.cle, libelle: nomCompte(c) }))] }] : []),
      { cle: 'dort', libelle: tr('tableau.filtre.anciennete'), valeur: filtreT.dort, onChange: (v) => setFiltreT((f) => ({ ...f, dort: v })),
        options: [{ cle: 'toutes', libelle: tr('tableau.filtre.toutes') }, { cle: 'dorment', libelle: tr('tableau.filtre.dorment', { n: seuil }) }] },
    ],
  };
  // (20 nov.) RELIER DEPUIS LA LISTE — Julien : « on ne peut pas relier des annonces comme ça, on est obligé d'appuyer dessus,
  // regarder la fiche ». L'état du lien et LA proposition de chaque annonce d'un autre site sont LUS (src/liaisonEtat.js, calculés
  // par les règles du parcours) ; SON toucher passe par `relierDepuisListe` (la proposition relue, le geste du parcours).
  const [, majLiaison] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => { const fin = abonnerLiaison(majLiaison); demanderLiaison(false); return fin; }, []);
  const liaison = {
    de: (a) => {
      const x = a && Array.isArray(a.annonces) ? a.annonces.find((y) => y.site !== 'vinted') : null;
      if (!x) return null;
      const site = NOM_SITE[x.site] || x.site, st = etatLienLu(site, x.id);
      if (st.etat === 'passu') return null;
      return { site, id: String(x.id), etat: st.etat, numero: st.numero, prop: st.etat === 'aRelier' ? propositionLu(site, x.id) : null };
    },
    relier: (l) => { if (l && l.prop) relierDepuisListe({ site: l.site, id: l.id, paireId: l.prop.paireId }); },
    autre: (l) => { if (l) ouvrirLiaison({ site: l.site, id: l.id }); },
    propre: (l) => { if (l) queSurCeSite({ site: l.site, id: l.id }); },
    lot: (ls) => { const cles = ls.filter((l) => l && l.prop && l.prop.niveau === 'sur').map((l) => `${l.site}:${l.id}`); if (cles.length) ouvrirLiaison({ vue: 'lot', cles }); },
    Photo: (src) => <PhotoVinted src={src} alt="" loading="lazy" decoding="async"/>,
  };
  return (
    <>
    <VueAnnonces filtreSite={siteG == null} liaison={liaison} travail={tableau} articles={liste} comptes={comptes} filtre={filtre} onFiltre={setFiltre} sites={sites} recherche={q} onRecherche={setQ}
      actions={actions} onAction={onAction} onFait={onFait}
      onPrix={(a) => { if (a.numero) { try { window.dispatchEvent(new CustomEvent('vrm:prix-partout', { detail: String(a.numero) })); } catch (_) {} } }}
      onRelier={(a) => { const x = a.annonces.find((y) => y.site !== 'vinted'); if (x) { try { window.dispatchEvent(new CustomEvent('vrm:liaison-ouvrir', { detail: { site: NOM_SITE[x.site], id: String(x.id), vue: null } })); } catch (_) {} } }}
      onPublier={() => { try { window.dispatchEvent(new CustomEvent('vrm:publier-ailleurs', { detail: {} })); } catch (_) {} }}
      // (19 nov., fiche directe) Un toucher sur un article numéroté ouvre SA fiche complète (par son N°, l'identité de l'article).
      onFiche={(a) => { if (a.numero) { try { window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: String(a.numero) })); } catch (_) {} } }}
      onEcranSite={onEcranSite} limites={limites} manque={manque}
      euros={(n) => fmt(n)} depuisTexte={(ms) => tr('egalite.jours', { n: Math.max(0, Math.floor((Date.now() - ms) / JOUR)) })} nomSite={nomSite} Icon={Icon}/>
    {agent ? <React.Suspense fallback={null}><PublierAgent ouverte articles={agent} onRetour={() => setAgent(null)}/></React.Suspense> : null}
    </>
  );
}
