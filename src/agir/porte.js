// ═══════════════════════════════════════════════════════════════════════════
// LA PORTE, côté app : les FAITS rassemblés une fois (src/App.jsx `SourceAgir`), lus par chaque bouton d'action.
// (24 nov., lot agir-si-connecte — la règle : src/agir/peutAgir.js)
// ═══════════════════════════════════════════════════════════════════════════
// Une mémoire de module (comme `poserExtensionIci`, src/ouvrirPanneau.js) : la source pose les faits, chaque bouton
// s'abonne. Tant que rien n'est posé, les faits sont `null` ⇒ « pas su » ⇒ LECTURE SEULE (jamais « ok » par défaut).
// Aucune écriture ici, aucune requête : la porte dit oui ou non ; l'envoi passe par le chemin d'extension existant
// (`envoyerGeste` → la file `cmd_dist_*` d'« À distance », exécutée par l'extension de l'ordinateur qui a CE compte
// dans son onglet, avec tous ses garde-fous) ou par le panneau de l'extension de CE navigateur.
import React from 'react';
import { peutAgir, etatCompteAgir } from './peutAgir.js';
import { suiviTermine, delaiSuivi } from './suivi.js';

let faits = null;
const abonnes = new Set();
let version = 0;
export function poserFaitsAgir(f) { faits = f && typeof f === 'object' ? f : null; version++; for (const a of abonnes) { try { a(); } catch (_) {} } }
export function faitsAgir() { return faits; }
const abonner = (fn) => { abonnes.add(fn); return () => abonnes.delete(fn); };
const lireVersion = () => version;

// Hors React (le pont, un geste lancé d'un gestionnaire) : la même règle sur les faits posés.
export function agirMaintenant(site, compte, geste, par = '') {
  if (!faits) return { ok: false, lecture: true, raison: 'lecture', cle: 'agir.raison.lecture', vars: {}, geste: null };
  return peutAgir({ ...faits, maintenant: Date.now() }, { site, compte, geste, par });
}

export function useFaitsAgir() {
  React.useSyncExternalStore(abonner, lireVersion, lireVersion);
  return faits;
}
// Le verdict pour UN bouton. Rend toujours un objet (jamais undefined).
export function usePeutAgir(site, compte, geste, par = '') {
  React.useSyncExternalStore(abonner, lireVersion, lireVersion);
  return agirMaintenant(site, compte, geste, par);
}
export function useCompteAgir(site, compte) {
  React.useSyncExternalStore(abonner, lireVersion, lireVersion);
  if (!faits) return { lecture: true, raison: { raison: 'lecture', cle: 'agir.raison.lecture', vars: {} } };
  return etatCompteAgir({ ...faits, maintenant: Date.now() }, site, compte);
}

// ── L'ENVOI : un geste ⇒ une commande de la file « À distance » (le chemin d'extension existant). ─────────────
// `deps` est posé par l'app (base, session, propriétaire) : ce module ne connaît ni Supabase ni la session.
let depsEnvoi = null;
export function poserEnvoiAgir(d) { depsEnvoi = d || null; }
// Rend { ok: true, id } · { ok: false, raison } — RIEN n'est déposé si la porte dit non (relue au moment du geste).
// (25 nov., 5.452 `envoisurs`) JAMAIS DEUX FOIS : un second toucher pendant que le premier dépose encore (double tap,
// lecture lente de la base) ne dépose pas une seconde commande — la base ne la voyait pas encore (`deja` arrivait trop
// tard) et le même message partait deux fois. Clé = le geste ET son contenu (un autre message, une autre offre passent).
const enVol = new Set();
export async function envoyerGeste({ site, compte, geste, distGeste, args, confirme = false, num = '', avant = null }) {
  const v = agirMaintenant(site, compte, geste, 'file');
  if (!v.ok) return { ok: false, raison: v.raison, verdict: v };
  if (!depsEnvoi || typeof depsEnvoi.deposer !== 'function') return { ok: false, raison: 'envoi-absent' };
  let cle = ''; try { cle = [site, String(compte), distGeste, JSON.stringify(args == null ? null : args)].join('|'); } catch (_) { cle = [site, String(compte), distGeste].join('|'); }
  if (enVol.has(cle)) return { ok: false, raison: 'deja' };
  enVol.add(cle);
  try {
    const r = await depsEnvoi.deposer({ geste: distGeste, site, compte: String(compte), args, confirme, num, avant });
    if (r && r.deja) return { ok: false, raison: 'deja', id: r.deja };
    return r && r.id ? { ok: true, id: r.id, voie: v.voie } : { ok: false, raison: 'base' };
  } catch (_) { return { ok: false, raison: 'base' }; }
  finally { enVol.delete(cle); }
}

// (25 nov., 5.452 `envoisurs`) LE SUIVI : relit la commande déposée jusqu'à son issue RÉELLE (écrite par l'extension après
// la réponse lue de Vinted) — src/agir/suivi.js dit la phrase. `surVue(vue)` : undefined → null (pas su) → la vue.
// Rend une fonction d'arrêt. Sans lecteur posé par l'app : rien n'est relu (la vue reste « pas su »).
export function suivreCommande(id, surVue) {
  let fini = false, minuteur = null;
  const t0 = Date.now();
  const tour = async () => {
    if (fini) return;
    let v = null;
    try { v = depsEnvoi && typeof depsEnvoi.lire === 'function' ? await depsEnvoi.lire(id) : null; } catch (_) { v = null; }
    if (fini) return;
    try { surVue(v); } catch (_) {}
    if (suiviTermine(v)) return;
    const d = delaiSuivi(Date.now() - t0);
    if (d != null) minuteur = setTimeout(tour, d);
  };
  minuteur = setTimeout(tour, 800);
  return () => { fini = true; if (minuteur) clearTimeout(minuteur); };
}
export function useSuiviCommande(id) {
  const [vue, setVue] = React.useState(undefined);
  React.useEffect(() => { setVue(undefined); if (!id) return undefined; return suivreCommande(id, setVue); }, [id]);
  return vue;
}

// « REPUBLIER » DEPUIS L'APP (Julien, 24 nov. : « republier dans l'application »). Une commande `republier` par annonce
// (la file « À distance » ⇒ `recreerVinted`, l'atelier de l'extension : coffre → brouillon → suppression → en ligne, §3),
// après UNE confirmation (elle supprime l'ancienne annonce). Seules les annonces dont le compte passe la porte partent ;
// les autres sont dites. `annonces` : [{ compte (uid Vinted), id, num? }] — l'identité, jamais un titre (§5).
// Rend { ok, n, refusees, verdict? } ; `null` si la porte dit non à TOUTES (l'appelant ouvre alors le panneau, gardé).
export async function republierDansApp(annonces, confirmer) {
  const l0 = (Array.isArray(annonces) ? annonces : []).filter((a) => a && a.id != null);
  const ok = l0.filter((a) => agirMaintenant('vinted', a.compte, 'republier', 'file').ok);
  if (!ok.length) return { ok: false, n: 0, refusees: l0.length, verdict: agirMaintenant('vinted', l0[0] && l0[0].compte, 'republier', 'file') };
  let oui = false; try { oui = await confirmer(ok.length); } catch (_) { oui = false; }
  if (!oui) return { ok: false, n: 0, refusees: 0, annule: true };
  let n = 0;
  for (const a of ok) {
    const r = await envoyerGeste({ site: 'vinted', compte: String(a.compte), geste: 'republier', distGeste: 'republier', args: { id: String(a.id) }, confirme: true, num: a.num || '' });
    if (r.ok) n++;
  }
  return { ok: n > 0, n, refusees: l0.length - ok.length };
}

// (24 nov., lot agir-tout) UN geste par annonce, en série, chacun par la porte au nom du compte de SON annonce.
// `liste` : [{ site, compte, id, args, num?, avant? }]. Rend { n, refusees, deja, verdict } (verdict du premier refus).
export async function envoyerSerie(geste, distGeste, liste) {
  let n = 0, refusees = 0, deja = 0, verdict = null;
  for (const a of Array.isArray(liste) ? liste : []) {
    const r = await envoyerGeste({ site: a.site || 'vinted', compte: String(a.compte || ''), geste, distGeste, args: a.args, num: a.num || '', avant: a.avant == null ? null : a.avant });
    if (r.ok) n++; else if (r.raison === 'deja') deja++; else { refusees++; if (!verdict && r.verdict) verdict = r.verdict; }
  }
  return { n, refusees, deja, verdict };
}

// (24 nov., lot agir-tout) UN geste lancé d'un écran qui avait le panneau : la FILE si la porte le permet pour CE compte
// (avec SA confirmation quand `confirmer` est donné), sinon l'ancien chemin `panneau()` (gardé lui aussi, il dit pourquoi).
// L'issue est DITE par l'app (`vrm:agir-dire`). Rend l'issue de `envoyerGeste`, ou { panneau: true }, ou { annule: true }.
export const dire = (texte) => { try { window.dispatchEvent(new CustomEvent('vrm:agir-dire', { detail: { texte } })); } catch (_) {} };
export async function agirOuPanneau({ site, compte, geste, distGeste, args, num = '', avant = null, confirmer = null, panneau = null, textes = {} }) {
  const v = agirMaintenant(site, compte, geste, 'file');
  if (!v.ok) { if (typeof panneau === 'function') { panneau(); return { panneau: true }; } return { ok: false, verdict: v }; }
  if (typeof confirmer === 'function') { let oui = false; try { oui = await confirmer(); } catch (_) { oui = false; } if (!oui) return { annule: true }; }
  const r = await envoyerGeste({ site, compte, geste, distGeste, args, num, avant, confirme: typeof confirmer === 'function' });
  if (textes && typeof textes.issue === 'function') { try { dire(textes.issue(r)); } catch (_) {} }
  return r;
}
