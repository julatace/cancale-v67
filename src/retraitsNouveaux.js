// ════════════════════════════════════════════════════════════════════════════
//  « NOUVEAU CODE DE RETRAIT » EN DIRECT (19 nov., retraits parfaits)
//  Julien : « quand je me balade sur Vinted avec l'extension je dois voir dans l'app quand un nouveau QR code
//  ou colis à retirer a été détecté ».
//  Les colis arrivent déjà sans recharger : la veille (src/tempsReel.js) signale une ligne `email_track_*`
//  (un e-mail rangé par le serveur) ou `panel_colis_relais` (un code lu dans une conversation par l'extension),
//  l'app relit CETTE famille, la règle `pickupUnion` refait la liste. Ce module dit ce qui est NOUVEAU dans
//  cette liste, par IDENTITÉ seulement (le n° de suivi `e:…`, la transaction Vinted `v:{compte}:{tx}`) :
//    · un colis compté « à retirer » jamais vu sur CET appareil ⇒ « colis » ;
//    · un colis déjà vu qui reçoit son QR ⇒ « qr » ; son code (il n'en avait pas) ⇒ « code ».
//  La PREMIÈRE fois (rien de vu sur cet appareil), tout est noté vu, rien n'est annoncé : on n'annonce jamais
//  « nouveau » ce qu'il avait déjà. Un colis marqué nouveau le reste jusqu'à ce qu'il OUVRE sa ligne (`vu`).
//  Pur : aucune horloge implicite, aucun stockage (l'écran range `etat` par appareil, c'est une commodité).
// ════════════════════════════════════════════════════════════════════════════

export const CLE_RETRAITS_VUS = 'vrm_retraits_vus';
const MAX_VUS = 400;
const MAX_NOUVEAUX = 60;

// L'identité commune à la liste des codes (`listeCodesRetrait` : `e:{n°}`, `v:{compte}:{tx}`) et aux lignes de
// l'écran (`r:e:{n°}`, `r:v:{tx}`) : `e:{n°}` ou `tx:{transaction}`. Rien d'autre (une clé d'e-mail sans n° ne
// désigne pas un colis de façon sûre ⇒ jamais annoncée).
export function cleNouveau(id) {
  const s = String(id == null ? '' : id);
  let m = /^(?:r:)?e:(.+)$/.exec(s); if (m && m[1]) return 'e:' + m[1].toUpperCase();
  m = /^v:[^:]*:(\d{1,20})$/.exec(s); if (m) return 'tx:' + m[1];
  m = /^r:v:(\d{1,20})$/.exec(s); if (m) return 'tx:' + m[1];
  return '';
}

const lireEtat = (e) => (e && typeof e === 'object' && e.vus && typeof e.vus === 'object' ? e : null);

// `avant` : l'état rangé (ou null) ; `codes` : [{ id, code, qr, compte, lieu, carrier, titre }] (listeCodesRetrait).
// Rend { etat, annonces: [{ cle, raison, lieu, carrier, titre }] }.
export function comparerRetraits(avant, codes, maintenant) {
  const a = lireEtat(avant);
  const vus = { ...(a ? a.vus : {}) };
  const nouveaux = { ...(a && a.nouveaux && typeof a.nouveaux === 'object' ? a.nouveaux : {}) };
  const annonces = [];
  for (const c of codes || []) {
    if (!c || !c.compte) continue;
    const k = cleNouveau(c.id);
    if (!k) continue;
    const forme = (c.code ? 'c' : '') + (c.qr ? 'q' : '');
    const v = vus[k];
    if (a) {
      let raison = '';
      if (v === undefined) raison = 'colis';
      else if (forme.includes('q') && !String(v).includes('q')) raison = 'qr';
      else if (forme.includes('c') && !String(v).includes('c')) raison = 'code';
      if (raison) { annonces.push({ cle: k, raison, aCode: !!c.code, aQr: !!c.qr, lieu: c.lieu || '', carrier: c.carrier || '', titre: c.titre || '' }); nouveaux[k] = maintenant; }
    }
    vus[k] = forme;
  }
  // Bornes : les plus récents gardés (un appareil ne grossit pas sans fin).
  const vusL = Object.entries(vus); const vusB = vusL.length > MAX_VUS ? Object.fromEntries(vusL.slice(-MAX_VUS)) : vus;
  const nouvL = Object.entries(nouveaux).sort((x, y) => (Number(y[1]) || 0) - (Number(x[1]) || 0)).slice(0, MAX_NOUVEAUX);
  return { etat: { v: 1, vus: vusB, nouveaux: Object.fromEntries(nouvL) }, annonces };
}

// Il a ouvert la ligne : elle n'est plus « nouveau ».
export function marquerVu(etat, cle) {
  const e = lireEtat(etat); const k = cleNouveau(cle) || String(cle || '');
  if (!e || !k || !e.nouveaux || !(k in e.nouveaux)) return e;
  const n = { ...e.nouveaux }; delete n[k];
  return { ...e, nouveaux: n };
}
export const estNouveau = (etat, cle) => { const e = lireEtat(etat); const k = cleNouveau(cle); return !!(e && k && e.nouveaux && k in e.nouveaux); };

// La phrase du toast : « Nouveau code de retrait · Mondial Relay Intermarché » (plusieurs : « 3 nouveaux codes de retrait »).
// `tr` : la fonction de traduction, `nomTransp` : (clé) → nom lisible.
export function texteAnnonce(annonces, { tr, nomTransp = (k) => k } = {}) {
  const l = (annonces || []).filter(Boolean);
  if (!l.length || typeof tr !== 'function') return '';
  if (l.length > 1) return tr('retraits.nouveaux.plusieurs', { n: l.length });
  const a = l[0];
  const ou = [nomTransp(a.carrier) || '', a.lieu || ''].filter(Boolean).join(' ');
  const cle = a.raison === 'qr' ? 'retraits.nouveau.qr' : (a.raison === 'code' || a.aCode) ? 'retraits.nouveau.code' : a.aQr ? 'retraits.nouveau.qr' : 'retraits.nouveau.colis';
  return ou ? tr(cle + 'Lieu', { lieu: ou }) : tr(cle);
}
