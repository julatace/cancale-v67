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
import React from 'react';
import { tr } from '../i18n/index.js';
import VueAnnonces from '../natif/ecrans/Annonces.jsx';
import { construireArticles, filtrerArticles, compterArticles, trierArticles, opsFait, limitesDe, NOM_SITE, CLE_ARTICLES } from '../articles/modele.js';
import { annoncesVinted, annoncesLeboncoin, annoncesEbay, annoncesVestiaire } from '../articles/sources.js';
import { etatEnLigneLbc } from '../enLigneLbc.js';
import { annuaireLbc } from '../plateformes.js';
import { etatAnnonceVcBrut, numVcAnnonce } from '../../api/_lib/vestiaire-regle.js';
import { fetchVintedListings, lbcListingsSession, lireBaseRelue, SUPABASE_URL, lireEbayTous, SEL_EBAY_ANNONCES, numEbayLu, numeroLbcIdentite,
  annonceLbcEnVente, annoncesLbcVendues, lienEbay, cleNum, fmt, gesteVrm, load, Icon, numerosVcEffectifs, comptesStockEcartes, toast, demanderActionAnnonces } from '../App.jsx';

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

export default function AnnoncesEgalite({ accounts = [], siteInitial = 'tous', onEcranSite = null }) {
  const [lu, setLu] = React.useState(undefined);            // undefined lecture · null pas su · { annonces, manque }
  const [tic, setTic] = React.useState(0);
  const [filtre, setFiltre] = React.useState({ site: siteInitial || 'tous', etat: 'enligne' });
  const [q, setQ] = React.useState('');
  const [agent, setAgent] = React.useState(null);           // les articles choisis pour « Publier sur… »
  const cleComptes = (accounts || []).map((a) => String((a && a.vinted_user_id) || '')).sort().join(',');
  React.useEffect(() => {
    let vivant = true;
    lireAnnoncesEgalite(accounts).then((r) => { if (vivant) setLu(r); }).catch(() => { if (vivant) setLu(null); });
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
  const onAction = (k, choisis) => {
    if (k === 'agent') { setAgent(choisis); return; }
    if (k === 'partout') { const nums = choisis.map((a) => a.numero).filter(Boolean); if (nums.length) { try { window.dispatchEvent(new CustomEvent('vrm:publier-partout', { detail: { nums } })); } catch (_) {} } return; }
    const sel = choisis.map(vintedDe).filter(Boolean).map((v) => ({ uid: v.compte, id: v.id }));
    if (!sel.length) { toast(tr('egalite.action.vintedSeul')); return; }
    demanderActionAnnonces(k, sel);
  };
  return (
    <>
    <VueAnnonces articles={liste} comptes={comptes} filtre={filtre} onFiltre={setFiltre} sites={sites} recherche={q} onRecherche={setQ}
      actions={actions} onAction={onAction} onFait={onFait}
      onPrix={(a) => { if (a.numero) { try { window.dispatchEvent(new CustomEvent('vrm:prix-partout', { detail: String(a.numero) })); } catch (_) {} } }}
      onRelier={(a) => { const x = a.annonces.find((y) => y.site !== 'vinted'); if (x) { try { window.dispatchEvent(new CustomEvent('vrm:liaison-ouvrir', { detail: { site: NOM_SITE[x.site], id: String(x.id), vue: null } })); } catch (_) {} } }}
      onPublier={() => { try { window.dispatchEvent(new CustomEvent('vrm:publier-ailleurs', { detail: {} })); } catch (_) {} }}
      onEcranSite={onEcranSite} limites={limites} manque={manque}
      euros={(n) => fmt(n)} depuisTexte={(ms) => tr('egalite.jours', { n: Math.max(0, Math.floor((Date.now() - ms) / JOUR)) })} nomSite={nomSite} Icon={Icon}/>
    {agent ? <React.Suspense fallback={null}><PublierAgent ouverte articles={agent} onRetour={() => setAgent(null)}/></React.Suspense> : null}
    </>
  );
}
