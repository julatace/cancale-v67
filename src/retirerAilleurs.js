// ── VENDU SUR UN SITE ⇒ RETIRÉ DES AUTRES EN UN TOUCHER (11 nov., lot anti-double-vente) ──
// Module PUR (aucun accès au navigateur, à la base ni à l'extension) : Ma journée,
// Ventes (`Comptabilite`, App.jsx) et `scripts/audit-retirer-ailleurs.cjs`
// exécutent les MÊMES fonctions (§11).
//
// L'entrée est la vérification « Vendus ailleurs » qui existe déjà
// (`articlesVendusAilleurs`, src/bilanSynchronisation.js : la vente PROUVÉE —
// transaction Vinted engagée, commande eBay engagée, vente Leboncoin où il est le
// vendeur, vente Vestiaire par référence — et l'annonce encore active AILLEURS,
// reliées par le N° de leur FICHE, jamais par le titre ; un N° porté par deux
// paires est écarté : `ambigus`). Ce module ne rapproche RIEN de neuf : il range,
// site par site, ce que VRM peut faire, ce qui reste à faire à la main, et ce qui
// n'est pas sûr.
//
//   · `auto`     : VRM le fait sur SON clic, par les voies qui existent déjà —
//                  Leboncoin : `supprimeLbcDepuisApp` de l'extension (capacité
//                  `lbcsupprime`, plafond horaire et garde du compte de l'onglet
//                  tenus PAR l'extension) ; eBay : la route `retirer` d'api/ebay.js
//                  (EndFixedPriceItem, `confirme:true` exigé par le serveur).
//   · `main`     : VRM ne le fait pas — Vinted (supprimer une annonce Vinted
//                  automatiquement est REFUSÉ, §3 : seulement un lien direct),
//                  Vestiaire (aucune voie de retrait), Leboncoin sans extension à
//                  jour. Dit « à faire sur le site », avec le lien.
//   · `verifier` : « pas su » — lecture de plus de 24 h, état pas confirmé, la
//                  paire semble remise en vente, ou deux annonces sous ce N° sur
//                  le même site. « Peut-être encore en ligne sur … · vérifier » :
//                  jamais affirmé, jamais retiré par VRM. Mieux vaut un blanc
//                  qu'un faux.

import { articlesVendusAilleurs } from './bilanSynchronisation.js';

export const FRAIS_MS = 24 * 3600e3;
const NOM = { Vinted: 'Vinted', eBay: 'eBay', Leboncoin: 'Leboncoin', Vestiaire: 'Vestiaire' };
const ORDRE = ['Leboncoin', 'eBay', 'Vestiaire', 'Vinted'];
const arr = (a) => (Array.isArray(a) ? a : []);
export const cleSite = (a) => [a.plateforme, a.compte, a.id].join(':');
const tsDe = (c) => (typeof c === 'number' ? c : Date.parse(c || ''));
const dateCourte = (t) => {
  const d = new Date(t);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
};
// Une liste « à la française » : « Leboncoin et eBay », « Leboncoin, eBay et Vestiaire ».
export const enListe = (l) => { const x = [...new Set(arr(l))]; return x.length < 2 ? (x[0] || '') : `${x.slice(0, -1).join(', ')} et ${x[x.length - 1]}`; };

// Les annonces dont l'état n'est PAS confirmé (`active: null` : lecture de plus de 24 h,
// état Leboncoin/Vestiaire pas confirmé) mais dont le N° — par la même identité — est
// vendu ailleurs : « peut-être encore en ligne · vérifier ». Jamais retirées par VRM.
export function lignesPeutEtre(data, sures) {
  const vues = new Set(arr(sures).map(cleSite));
  const d = data && typeof data === 'object' ? data : {};
  const annonces = arr(d.annonces).map((a) => (a && a.active === null ? { ...a, active: true, _pasConfirme: true } : a));
  return articlesVendusAilleurs({ ...d, annonces }).lignes.filter((a) => a._pasConfirme && !vues.has(cleSite(a)));
}

// `v` : la sortie du crochet « Vendus ailleurs » ({ lignes, peutEtre, ambigus, manques, at }).
// `o.lbcOk` : l'extension de CE navigateur sait supprimer sur Leboncoin (`extSait('lbcsupprime') === 'ok'`).
// `o.lbcPourquoi` : la phrase quand elle ne le sait pas. `o.ebayOk` : la route eBay est joignable (session).
export function planRetirerAilleurs(v, o = {}) {
  const maintenant = Number.isFinite(o.maintenant) ? o.maintenant : Date.now();
  const sures = arr(v && v.lignes).map((a) => ({ ...a, _peutEtre: false }));
  const vues = new Set(sures.map(cleSite));
  const douteuses = arr(v && v.peutEtre).filter((a) => !vues.has(cleSite(a))).map((a) => ({ ...a, _peutEtre: true }));
  const toutes = [...sures, ...douteuses];
  // Deux annonces sous le même N° sur le même site : laquelle est la paire vendue ?
  // Ni l'une ni l'autre n'est retirée par VRM (identité ambiguë, §5).
  const parNumSite = new Map();
  for (const a of toutes) { const k = `${a.numero}|${a.plateforme}`; parNumSite.set(k, (parNumSite.get(k) || 0) + 1); }
  const articles = new Map();
  for (const a of toutes) {
    const numero = String(a.numero || '');
    if (!numero) continue;
    if (!articles.has(numero)) articles.set(numero, { numero, venduSur: [], titre: '', photo: null, sites: [] });
    const art = articles.get(numero);
    for (const x of arr(a.ventes)) if (x && x.plateforme && !art.venduSur.includes(x.plateforme)) art.venduSur.push(x.plateforme);
    if (!art.titre && a.titre) art.titre = String(a.titre);
    if (!art.photo && a.photo) art.photo = a.photo;
    const t = tsDe(a.capture);
    const vieille = !(Number.isFinite(t) && maintenant - t <= FRAIS_MS);
    let voie, moyen = null, raison;
    if (a.aConfirmer) { voie = 'verifier'; raison = 'la paire semble remise en vente — vérifie avant de retirer'; }
    else if (parNumSite.get(`${a.numero}|${a.plateforme}`) > 1) { voie = 'verifier'; raison = `deux annonces sous ce N° sur ${NOM[a.plateforme] || a.plateforme} — VRM ne choisit pas`; }
    else if (a._peutEtre || vieille) { voie = 'verifier'; raison = Number.isFinite(t) ? `lu le ${dateCourte(t)} — peut-être déjà retirée` : 'état pas confirmé — peut-être déjà retirée'; }
    else if (a.plateforme === 'Vinted') { voie = 'main'; raison = 'à retirer toi-même sur Vinted — VRM ne supprime jamais une annonce Vinted'; }
    else if (a.plateforme === 'Vestiaire') { voie = 'main'; raison = 'à faire sur Vestiaire — VRM n’a pas de voie pour la retirer'; }
    else if (a.plateforme === 'Leboncoin') {
      if (!/^\d{6,12}$/.test(String(a.id))) { voie = 'main'; raison = 'annonce Leboncoin sans identifiant lisible — à faire sur Leboncoin'; }
      else if (o.lbcOk) { voie = 'auto'; moyen = 'lbc'; raison = 'supprimée par l’extension, au nom du compte connecté dans l’onglet'; }
      else { voie = 'main'; raison = o.lbcPourquoi || 'l’extension de ce navigateur ne sait pas supprimer sur Leboncoin — à faire sur Leboncoin'; }
    } else if (a.plateforme === 'eBay') {
      if (!/^\d{1,19}$/.test(String(a.id))) { voie = 'main'; raison = 'annonce eBay sans identifiant lisible — à faire sur eBay'; }
      else if (o.ebayOk !== false) { voie = 'auto'; moyen = 'ebay'; raison = 'annonce terminée chez eBay (sans retour : il faudrait la republier)'; }
      else { voie = 'main'; raison = 'eBay pas joignable depuis ici — à faire sur eBay'; }
    } else { voie = 'main'; raison = 'à faire sur le site'; }
    art.sites.push({ cle: cleSite(a), plateforme: a.plateforme, id: String(a.id), compte: a.compte, compteNom: a.compteNom && a.compteNom !== 'principal' ? a.compteNom : '', lien: a.lien || null, onglet: a.onglet || null, voie, moyen, raison, titre: a.titre || '' });
  }
  const liste = [...articles.values()].map((art) => ({ ...art, sites: art.sites.sort((x, y) => ORDRE.indexOf(x.plateforme) - ORDRE.indexOf(y.plateforme)) }))
    .sort((a, b) => String(a.numero).localeCompare(String(b.numero), 'fr', { numeric: true }));
  const tous = liste.flatMap((a) => a.sites);
  return {
    articles: liste,
    nAuto: tous.filter((s) => s.voie === 'auto').length,
    nMain: tous.filter((s) => s.voie === 'main').length,
    nVerifier: tous.filter((s) => s.voie === 'verifier').length,
    ambigus: Number(v && v.ambigus) || 0,
    manques: arr(v && v.manques),
  };
}

// La phrase de l'article : « N°124 vendu sur Vinted · encore en ligne sur Leboncoin et eBay »,
// « · peut-être encore en ligne sur Vestiaire · vérifier » pour ce qui n'est pas su.
export function phraseArticle(art) {
  const sur = arr(art.sites).filter((s) => s.voie !== 'verifier').map((s) => NOM[s.plateforme] || s.plateforme);
  const pe = arr(art.sites).filter((s) => s.voie === 'verifier').map((s) => NOM[s.plateforme] || s.plateforme);
  return `N°${art.numero} vendu sur ${enListe(art.venduSur) || '—'}`
    + (sur.length ? ` · encore en ligne sur ${enListe(sur)}` : '')
    + (pe.length ? ` · peut-être encore en ligne sur ${enListe(pe)} · vérifier` : '');
}

// Le texte de la confirmation : chaque site, ce qui sera fait. Rien d'autre ne part.
export function texteConfirmation(plan) {
  const auto = plan.articles.flatMap((a) => a.sites.filter((s) => s.voie === 'auto').map((s) => ({ a, s })));
  const lignes = auto.map(({ a, s }) => `N°${a.numero} · ${NOM[s.plateforme]}${s.compteNom ? ` (${s.compteNom})` : ''} : ${s.moyen === 'lbc' ? 'supprimée' : 'terminée'}`);
  const main = plan.articles.flatMap((a) => a.sites.filter((s) => s.voie !== 'auto').map((s) => `N°${a.numero} · ${NOM[s.plateforme]} : ${s.voie === 'main' ? 'à faire sur le site' : 'à vérifier'} — rien n’y part`));
  return {
    titre: auto.length > 1 ? `Retirer ${auto.length} annonces des autres sites ?` : `Retirer le N°${auto[0] ? auto[0].a.numero : ''} de ${auto[0] ? NOM[auto[0].s.plateforme] : ''} ?`,
    desc: [...lignes, ...main].join('\n') + '\n\nUne annonce à la fois. C’est sans retour : il faudrait la republier.',
  };
}

// ── LES ISSUES, TELLES QUE LES VOIES LES RENDENT ─────────────────────────────
// statut : 'retire' (le site a accepté) · 'incertain' (pas de réponse claire : peut-être
// retirée — regarder avant de recommencer) · 'refuse' (rien n'a été retiré) · 'arrete'
// (pas tenté : la précédente du même site n'est pas passée).
// Leboncoin — la réponse de `supprimeLbcDepuisApp` (vinted-sync-extension/background.js).
export function issueLbc(rep) {
  if (!rep || typeof rep !== 'object') return { statut: 'incertain', texte: 'pas de réponse de l’extension — regarde l’annonce sur Leboncoin' };
  if (rep.accepte === false) return { statut: 'refuse', texte: `pas fait — ${rep.raison || 'refusé par l’extension'}` };
  if (rep.etape === 'fait') return { statut: 'retire', texte: 'Leboncoin a accepté la suppression' };
  if (rep.etape === 'refuse') return { statut: 'refuse', texte: `pas fait — Leboncoin a répondu ${rep.statut || 'non'}` };
  return { statut: 'incertain', texte: `je ne sais pas si elle est supprimée — ${rep.raison || 'pas de réponse de Leboncoin'}` };
}
// eBay — la réponse de la route `retirer` (api/ebay.js, `handleRetirer`).
export const EBAY_DEJA_TERMINEE = /(already|has)\s+(been\s+)?(closed|ended)|d[ée]j[àa]\s+(été\s+)?(termin|clos|ferm)/i;
export function issueEbay(code, j) {
  if (j && j.ok) return { statut: 'retire', texte: 'eBay a terminé l’annonce' };
  if (j && EBAY_DEJA_TERMINEE.test(String(j.error || ''))) return { statut: 'retire', texte: 'déjà terminée chez eBay' };
  if (!j || code === 0 || code === 504 || j.reason === 'incertain') return { statut: 'incertain', texte: 'eBay n’a pas répondu clairement — regarde sur eBay avant de recommencer' };
  return { statut: 'refuse', texte: `pas fait — ${String(j.error || 'eBay a refusé le retrait').slice(0, 160)}` };
}

// ── L'EXÉCUTION : site par site, une annonce à la fois ───────────────────────
// `voies.lbc(site)` / `voies.ebay(site)` rendent l'issue (`issueLbc` / `issueEbay`).
// `continuer()` est relu avant CHAQUE appel. Une issue qui n'est pas « retiré » sur un
// site arrête CE site (plafond, compte pas connecté, pause : la suivante échouerait
// pareil, et un « incertain » se regarde avant de recommencer) ; les autres sites
// continuent. Seules les lignes `auto` partent — jamais `main`, jamais `verifier`.
export async function executerRetraits(plan, voies, continuer = () => true, maintenant = () => Date.now()) {
  const out = {};
  const stop = new Set();
  for (const art of arr(plan && plan.articles)) {
    for (const s of art.sites) {
      if (s.voie !== 'auto') continue;
      if (stop.has(s.plateforme)) { out[s.cle] = { statut: 'arrete', texte: 'pas tenté — la précédente sur ce site n’est pas passée', at: maintenant() }; continue; }
      if (!continuer()) { out[s.cle] = { statut: 'arrete', texte: 'pas tenté — arrêté', at: maintenant() }; continue; }
      const f = s.moyen && voies && typeof voies[s.moyen] === 'function' ? voies[s.moyen] : null;
      let r;
      try { r = f ? await f(s, art) : { statut: 'refuse', texte: 'pas de voie pour ce site' }; } catch (_) { r = { statut: 'incertain', texte: 'la demande a été coupée — regarde sur le site avant de recommencer' }; }
      out[s.cle] = { ...r, plateforme: s.plateforme, compte: s.compte, at: maintenant() };
      if (r.statut !== 'retire') stop.add(s.plateforme);
    }
  }
  return out;
}

// ── « RETIRÉ ✓ RELU » ───────────────────────────────────────────────────────
// « Relu » veut dire : une lecture COMPLÈTE de CE site et de CE compte, faite APRÈS le
// retrait (`v.completes` : liste eBay complète, lecture complète de « Mes annonces »
// Leboncoin, dressing Vinted — la même preuve que `conserverRetraitsNonConfirmes`), ne
// la montre plus. La note que VRM écrit lui-même après un « oui » du site n'est PAS une
// relecture. Sinon : « retiré · pas encore relu » (la prochaine lecture du site le
// dira) — jamais « relu » sur une lecture d'avant, ni sur une lecture ratée.
export function avecRelecture(resultats, v) {
  const out = {};
  const encore = new Set([...arr(v && v.lignes), ...arr(v && v.peutEtre)].map(cleSite));
  const lueOk = !!(v && !v.erreur && Number.isFinite(v.at));
  const completeApres = (r) => arr(v && v.completes).some((c) => c && c.plateforme === r.plateforme && String(c.compte) === String(r.compte) && Number.isFinite(c.at) && Number.isFinite(r.at) && c.at > r.at);
  for (const [k, r] of Object.entries(resultats || {})) {
    out[k] = r.statut === 'retire' && lueOk && v.at > r.at && completeApres(r) && !encore.has(k) ? { ...r, relu: true } : { ...r, relu: false };
  }
  return out;
}
export function texteResultat(r) {
  if (!r) return '';
  if (r.statut === 'retire') return r.relu ? `retiré ✓ relu · ${r.texte}` : `retiré · ${r.texte} · pas encore relu`;
  if (r.statut === 'incertain') return `pas su · ${r.texte}`;
  return r.texte;
}
