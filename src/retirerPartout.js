// ── UNE PAIRE VENDUE EST RETIRÉE PARTOUT (21 nov., choix 49 de Julien — « c'est la force de l'app », ext. 5.426.0) ──
// Dès qu'une vente est PROUVÉE sur un site (Vinted, Leboncoin, eBay, Vestiaire), chacune des AUTRES annonces de la MÊME
// paire — reliées par IDENTITÉ seulement (id d'annonce lié à la fiche, référence VRM-{N°}, SKU VRM-{N°}, lien posé ; jamais
// le titre : `articlesVendusAilleurs`, src/bilanSynchronisation.js) — est retirée de la vente de façon RÉVERSIBLE :
//   · Vinted    : MASQUÉE (moteur existant `masquerAilleursTick`, liste `vinted_masquer_ailleurs`, toujours allumé) ;
//   · Leboncoin : MISE EN PAUSE par l'interface de la page (geste appris de SA pause faite à la main) — réglage
//                 `vrm_retirer_partout_reglage.leboncoin`, ÉTEINT par défaut, allumer demande UNE confirmation ;
//   · Vestiaire : aucune pause PAR ANNONCE mesurée sur vestiairecollective.com ⇒ VRM ne clique rien, il le DIT
//                 (« à retirer toi-même ») et sonne à 30 min ; le réglage existe et le dit ;
//   · eBay      : le chemin existant (fin d'annonce par l'API officielle, retrait automatique de VRM s'il est allumé).
// Jamais de suppression automatique. Vente annulée / retour ⇒ chaque annonce retirée PAR VRM est remise en ligne par le même
// chemin (démasquée / réactivée), seulement sur une liste COMPLÈTE (« pas su » ne remet rien).
// L'app PUBLIE la liste (`vrm_retirer_partout`, ligne `main`) ; l'extension AGIT (background.js `retirerPartoutTick`) et
// tient son registre (`vrm_retraits_partout`, sa ligne dédiée — elle n'écrit jamais `main`). Le bloc <retirer-partout-regle>
// est le MÊME ici et dans l'extension (node scripts/audit-retirer-partout.cjs --recopie).
import { articlesVendusAilleurs } from './bilanSynchronisation.js';

// <retirer-partout-regle> — la RÈGLE, recopiée telle quelle dans vinted-sync-extension/background.js (node scripts/audit-retirer-partout.cjs --recopie).
const RP_V = 1;
const RP_AGE_MAX_MS = 48 * 3600000;        // une liste plus vieille ne fait plus rien (ni retirer, ni remettre)
const RP_ALERTE_MS = 30 * 60000;           // un retrait pas fait depuis 30 min : risque de double vente, on sonne
const RP_REFUS_ATTENTE_MS = 24 * 3600000;  // un refus du site : pas de nouvel essai avant 24 h
const RP_SITES = ['vinted', 'leboncoin', 'vestiaire', 'ebay'];
// Les sites où l'EXTENSION retire par l'interface de la page, et ceux qui ont un réglage (allumer = une confirmation).
const RP_SITES_EXTENSION = ['leboncoin'];
const RP_SITES_REGLABLES = ['leboncoin', 'vestiaire'];
const RP_ETATS_FAITS = ['retiree', 'hors-ligne'];
const rpCle = (site, id) => String(site) + ':' + String(id);
// Le réglage, toujours complet : éteint par défaut, sauf ce qu'il a allumé lui-même (`true` exact).
function rpReglageDe(v) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  return { leboncoin: o.leboncoin === true, vestiaire: o.vestiaire === true };
}
// La liste publiée par l'app : null si elle peut servir, sinon pourquoi (rien ne bouge).
function rpListeDit(liste, maintenant) {
  const t = Number.isFinite(maintenant) ? maintenant : Date.now();
  if (!liste || typeof liste !== 'object' || liste.v !== RP_V || !Array.isArray(liste.items)) return 'absente';
  const at = Number(liste.at);
  if (!Number.isFinite(at) || t - at > RP_AGE_MAX_MS || at > t + 120000) return 'perimee';
  return null;
}
// Ce qu'il y a à faire sur UN site, pour UN compte (celui de l'ONGLET du site) : { retirer: [id], remettre: [id] }.
//   `etats` : id → { compte, enLigne, enPause } tels que la DERNIÈRE lecture du site les dit (la base, jamais la liste) ;
//   retirer  : dans la liste (vente PROUVÉE ailleurs, par identité), de CE compte d'après le site, EN LIGNE, ni déjà
//              retirée / en cours / « je ne sais pas » (jamais relancé seul), ni refusée il y a moins de 24 h ;
//   remettre : retirée PAR VRM (registre), plus dans une liste COMPLÈTE, toujours en pause sur le site, de CE compte.
function rpPlan({ liste, registre, site, compte, etats, maintenant }) {
  const out = { retirer: [], remettre: [] };
  const t = Number.isFinite(maintenant) ? maintenant : Date.now();
  if (rpListeDit(liste, t) || !RP_SITES.includes(site)) return out;
  const c = String(compte || '');
  if (!c) return out;
  const ets = etats && typeof etats === 'object' ? etats : {};
  const reg = registre && typeof registre === 'object' ? registre : {};
  const dans = new Set();
  for (const e of liste.items) {
    if (!e || typeof e !== 'object' || e.site !== site || e.id == null || !/^[\w-]{3,40}$/.test(String(e.id))) continue;
    const id = String(e.id);
    dans.add(id);
    const et = ets[id];
    if (!et || String(et.compte || '') !== c || et.enLigne !== true) continue;
    const r = reg[rpCle(site, id)];
    if (r && (r.etat === 'retiree' || r.etat === 'envoye' || r.etat === 'incertain')) continue;
    if (r && r.etat === 'refuse' && t - Number(r.at || 0) < RP_REFUS_ATTENTE_MS) continue;
    out.retirer.push(id);
  }
  if (liste.complet === true) {
    for (const k of Object.keys(reg)) {
      const r = reg[k];
      if (!r || r.site !== site || r.etat !== 'retiree' || r.voulu === false) continue;
      const id = String(r.id || '');
      if (!id || dans.has(id) || rpCle(site, id) !== k) continue;
      const et = ets[id];
      if (!et || String(et.compte || '') !== c || et.enPause !== true) continue;
      out.remettre.push(id);
    }
  }
  return out;
}
// L'état d'UN site d'une paire, en un mot (le tableau « Vendue → retirée sur ») :
//   retiree    — fait et RELU (masquée, en pause) ;          hors-ligne — le site ne la montre plus en vente ;
//   attente    — VRM va le faire (onglet du site fermé, plafond, autre compte…) ; envoye / incertain — à vérifier ;
//   refuse     — le site a refusé ;  pas-appris — fais le geste une fois à la main ;  eteint — réglage éteint ;
//   a-faire    — VRM ne sait pas le faire sur ce site (Vestiaire) : à retirer toi-même ;  ebay — retrait eBay de VRM.
function rpEtatSite({ item, registre, masquees, reglage }) {
  const reg = rpReglageDe(reglage);
  if (!item || typeof item !== 'object') return 'attente';
  if (item.site === 'vinted') {
    const m = masquees && typeof masquees === 'object' ? masquees[String(item.id)] : null;
    if (m && m.etat === 'masquee') return 'retiree';
    if (item.enLigne === false) return 'hors-ligne';
    if (m && (m.etat === 'envoye' || m.etat === 'ecart')) return 'envoye';
    if (m && m.etat === 'refuse') return 'refuse';
    return 'attente';
  }
  const r = registre && typeof registre === 'object' ? registre[rpCle(item.site, item.id)] : null;
  if (r && r.etat === 'retiree') return 'retiree';
  if (item.enLigne === false) return 'hors-ligne';
  // eBay : le retrait automatique existant de VRM ne vise qu'une vente VINTED prouvée (api/ebay.js, mode auto) ; vendue ailleurs ⇒ à faire.
  if (item.site === 'ebay') return item.venduSur === 'Vinted' ? 'ebay' : 'a-faire';
  if (r && ['envoye', 'incertain', 'refuse', 'pas-appris'].includes(r.etat)) return r.etat;
  if (item.site === 'vestiaire') return reg.vestiaire ? 'a-faire' : 'eteint';
  if (item.site === 'leboncoin' && !reg.leboncoin) return 'eteint';
  return 'attente';
}
// Le tableau : une rangée par PAIRE (N°), une case par AUTRE site, et ce qui est en retard (> 30 min, risque de double
// vente). `depuis` : la 1re fois que l'extension a vu ce retrait à faire (registre), sinon rien (pas de retard inventé).
function rpTableau({ liste, registre, masquees, reglage, maintenant }) {
  const t = Number.isFinite(maintenant) ? maintenant : Date.now();
  if (rpListeDit(liste, t)) return { lignes: [], enRetard: 0, attente: {}, lu: false };
  const parNum = new Map();
  const attente = {};
  let enRetard = 0;
  for (const e of liste.items) {
    if (!e || typeof e !== 'object' || !RP_SITES.includes(e.site) || e.id == null) continue;
    const num = String(e.num || '');
    if (!parNum.has(num)) parNum.set(num, { num, venduSur: String(e.venduSur || ''), sites: [] });
    const etat = rpEtatSite({ item: e, registre, masquees, reglage });
    const r = registre && typeof registre === 'object' ? registre[rpCle(e.site, e.id)] : null;
    const depuis = r && Number(r.depuis) > 0 ? Number(r.depuis) : null;
    const retard = !RP_ETATS_FAITS.includes(etat) && etat !== 'eteint' && etat !== 'ebay' && depuis != null && t - depuis > RP_ALERTE_MS;
    if (retard) enRetard++;
    if (etat === 'attente' && RP_SITES_EXTENSION.includes(e.site)) attente[e.site] = (attente[e.site] || 0) + 1;
    parNum.get(num).sites.push({ site: e.site, id: String(e.id), etat, depuis, retard, raison: r && r.raison ? String(r.raison).slice(0, 40) : '' });
  }
  const lignes = [...parNum.values()].sort((a, b) => a.num.localeCompare(b.num, 'fr', { numeric: true }));
  return { lignes, enRetard, attente, lu: true };
}
// </retirer-partout-regle>

export { RP_V, RP_AGE_MAX_MS, RP_ALERTE_MS, RP_REFUS_ATTENTE_MS, RP_SITES, RP_SITES_EXTENSION, RP_SITES_REGLABLES, RP_ETATS_FAITS, rpCle, rpReglageDe, rpListeDit, rpPlan, rpEtatSite, rpTableau };

// ── CÔTÉ APP ────────────────────────────────────────────────────────────────
export const RETIRER_CLE = 'vrm_retirer_partout';
export const RETRAITS_REGISTRE = 'vrm_retraits_partout';
export const RETIRER_REGLAGE_CLE = 'vrm_retirer_partout_reglage';
const SITE_DE = { Vinted: 'vinted', Leboncoin: 'leboncoin', Vestiaire: 'vestiaire', eBay: 'ebay' };

// La liste à publier : chaque annonce (de n'importe quel site) dont la paire est VENDUE sur un AUTRE site — vente engagée,
// par identité (`articlesVendusAilleurs`). L'annonce y reste même une fois retirée (son état `enLigne` le dit) : une
// annonce qui SORT de la liste veut dire « la vente n'est plus engagée » (annulée, retour), jamais « je l'ai mise en pause ».
// Une ligne « à confirmer » (la paire est peut-être remise en vente) n'y entre pas. `complet` : toutes les plateformes
// relues ET aucun N° ambigu (sinon l'extension ne REMET rien en ligne : « pas su »).
// `data` : la sortie de `chargerRetraitsMulti` (App.jsx).
export function listeRetirerPartout(data, maintenant = Date.now()) {
  if (!data || !Array.isArray(data.annonces) || !Array.isArray(data.ventes)) return { v: RP_V, at: maintenant, items: [], complet: false };
  // Les annonces des autres sites comptent même hors ligne (en pause, terminée) : leur état est gardé à part.
  const annonces = data.annonces.map((a) => (a && a.plateforme !== 'Vinted' ? { ...a, enLigne: a.active, active: true } : { ...a, enLigne: a && a.active === true ? true : a && a.active === false ? false : null }));
  const calcul = articlesVendusAilleurs({ ...data, annonces });
  const items = [], vus = new Set();
  for (const l of calcul.lignes || []) {
    const site = SITE_DE[l && l.plateforme];
    if (!site || l.id == null || l.aConfirmer) continue;
    // Vinted : la vente sur un AUTRE compte Vinted reste au moteur d'avant (même règle) ; ici « ailleurs » = autre site.
    const ailleurs = (l.ventes || []).filter((v) => v && v.engagee === true && v.plateforme && v.plateforme !== l.plateforme);
    if (!ailleurs.length) continue;
    const cle = rpCle(site, l.id);
    if (vus.has(cle)) continue;
    vus.add(cle);
    items.push({ site, id: String(l.id), compte: String(l.compte || '').slice(0, 64), num: String(l.numero || '').slice(0, 24), venduSur: String(ailleurs[0].plateforme).slice(0, 20),
      enLigne: l.enLigne === true ? true : l.enLigne === false ? false : null, titre: String(l.titre || '').slice(0, 80) });
  }
  const manques = Array.isArray(data.manques) ? data.manques.map(String) : ['rien lu'];
  return { v: RP_V, at: maintenant, items: items.sort((a, b) => cleTri(a).localeCompare(cleTri(b))), complet: manques.length === 0 && !(calcul.ambigus > 0) };
}
const cleTri = (x) => x.site + ':' + x.id;

// Ce que la fiche « Sites et comptes » d'une paire montre : les retraits de CE N° (une case par site), ou null.
export function retraitsDuNumero(num, { liste, registre, masquees, reglage, maintenant = Date.now() } = {}) {
  const n = String(num == null ? '' : num).trim();
  if (!n) return null;
  const tab = rpTableau({ liste, registre, masquees, reglage, maintenant });
  if (!tab.lu) return null;
  return tab.lignes.find((l) => l.num === n) || null;
}
