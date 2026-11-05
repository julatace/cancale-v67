// ═══════════════════════════════════════════════════════════════════════════
// ANNONCES : SÉLECTIONNER, PUIS « ACTIONS POSSIBLES » (5 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (pages du 5 nov. + vocal) : « les brouillons ET les annonces masquées
// apparaissent et se sélectionnent (sauf celles en vérification par Vinted) ;
// un petit carré « Actions » qui propose, selon la sélection : republier, en
// ligne → brouillon, brouillon → en ligne, en ligne → en ligne avec les
// modifications, republier à la main avec le suivi ». « Séparer vraiment les
// comptes : les brouillons ne sont pas les mêmes d'un compte à l'autre ; la
// republication ne marche pas d'un compte à l'autre. »
//
// Règles PURES (aucune lecture), exécutées par scripts/audit-annonces-actions.cjs.
// Elles ne refont AUCUN moteur : chaque action renvoie à un geste qui existe
// déjà (`ACTIONS_REPUB` de l'app : recreer · modifier · versBrouillon · enLigne)
// ou au parcours « à la main » (rien ne part chez Vinted).

// L'état d'une annonce de son dressing. `verification` d'abord : Vinted la
// vérifie (`is_processing`, ou une alerte posée sur l'annonce, `item_alert_type`
// — deux champs que Vinted envoie dans le dressing, mesurés le 5 nov. sur deux
// annonces non allégées). ⚠️ L'extension (5.3xx) ne GARDE pas encore ces deux
// champs (`CHAMPS_ARTICLE`) : tant qu'elle ne les garde pas, aucune annonce n'est
// dite « en vérification » (pas su ≠ oui) — et l'extension revérifie tout au
// lancement de toute façon.
export const ETATS_ANNONCE = {
  'en-ligne': 'En ligne',
  brouillon: 'Brouillon',
  masquee: 'Masquée',
  verification: 'En vérification par Vinted',
};
export function enVerificationVinted(it) {
  if (!it || typeof it !== 'object') return false;
  if (it.verifVinted) return true;
  if (it.is_processing === true) return true;
  const a = it.item_alert_type;
  return typeof a === 'string' && a.trim() !== '';
}
export function etatAnnonceVinted(it) {
  if (!it) return '';
  if (enVerificationVinted(it)) return 'verification';
  if (it._vrmBrouillon || it.is_draft) return 'brouillon';
  if (it._vrmMasquee || it.is_hidden) return 'masquee';
  return 'en-ligne';
}
// Une annonce se coche-t-elle ? Toutes, sauf celles que Vinted vérifie.
export function raisonPasSelectionnable(etat) {
  return etat === 'verification' ? 'Vinted la vérifie : rien ne peut partir tant que ce n’est pas fini.' : '';
}

// Les actions, dans l'ordre du carré. `etats` = les états qu'elle accepte ;
// `robot` = elle part chez Vinted par l'extension (compte de Chrome exigé) ;
// `cap` = la capacité d'extension qu'elle demande (`EXT_CAPACITES` de l'app) ;
// `seule` = une annonce à la fois.
export const ACTIONS_SELECTION = [
  { k: 'recreer', titre: 'Republier', desc: 'Supprimer et recréer : favoris et vues repartent de zéro.', etats: ['en-ligne'], robot: true, cap: 'recreer' },
  { k: 'modifier', titre: 'En ligne → en ligne, avec tes modifications', desc: 'Prix ou titre changés sur place : favoris et vues gardés.', etats: ['en-ligne'], robot: true, cap: 'republiermodif' },
  { k: 'versBrouillon', titre: 'En ligne → brouillon', desc: 'Retirée de la vente, gardée dans tes brouillons Vinted.', etats: ['en-ligne'], robot: true, cap: 'versbrouillon' },
  { k: 'enLigne', titre: 'Brouillon → en ligne', desc: 'Mis en ligne tel qu’il est enregistré sur Vinted.', etats: ['brouillon'], robot: true, cap: 'brouillon' },
  { k: 'main', titre: 'Republier à la main, accompagné', desc: 'VRM te donne les photos réglées, le titre, la description et le prix ; puis remet le N° sur la nouvelle annonce.', etats: ['en-ligne', 'masquee', 'brouillon'], robot: false, seule: true },
];
const POUR_ETAT = { 'en-ligne': 'les annonces en ligne', brouillon: 'les brouillons', masquee: 'les annonces masquées', verification: 'les annonces en vérification' };
const pl = (n, mot, plur) => `${n} ${n > 1 ? (plur || mot + 's') : mot}`;
const COMPTE_ETAT = (n, e) => (e === 'brouillon' ? pl(n, 'brouillon')
  : e === 'masquee' ? `${pl(n, 'annonce')} ${n > 1 ? 'masquées' : 'masquée'}`
  : `${pl(n, 'annonce')} ${e === 'verification' ? 'en vérification' : 'en ligne'}`);

// La liste des actions, selon la sélection.
//   selection : [{ id, uid, etat }] (l'ordre de ses clics) ;
//   chrome    : l'uid du compte Vinted ouvert dans Chrome — `undefined` pas su ·
//               `null` aucun · string ;
//   capOk     : (cap) => true | false — la capacité est-elle là ;
//   nomCompte : (uid) => login.
// Rend [{ k, titre, desc, ok, raison, ids }] : une action qui ne peut pas
// partir reste DANS la liste, grisée, avec SA raison (jamais cachée, §7).
export function actionsPossibles({ selection, chrome, capOk, nomCompte } = {}) {
  const sel = Array.isArray(selection) ? selection.filter((x) => x && x.id != null) : [];
  const nom = (u) => (nomCompte && nomCompte(u)) || (u ? `compte ${u}` : 'compte inconnu');
  const comptes = [...new Set(sel.map((x) => String(x.uid || '')))];
  const parEtat = {}; for (const x of sel) parEtat[x.etat] = (parEtat[x.etat] || 0) + 1;
  return ACTIONS_SELECTION.map((A) => {
    const ids = sel.map((x) => String(x.id));
    let raison = '';
    if (!sel.length) raison = 'Coche au moins une annonce.';
    else if (comptes.length > 1) raison = `Ta sélection mélange ${comptes.length} comptes (${comptes.map(nom).join(', ')}) : une action se lance sur un seul compte à la fois.`;
    else if (comptes[0] === '') raison = 'VRM ne sait pas à quel compte est cette annonce.';
    else if (A.seule && sel.length > 1) raison = 'Une annonce à la fois : coche-n’en qu’une.';
    else {
      const hors = Object.keys(parEtat).filter((e) => !A.etats.includes(e));
      if (hors.length) raison = `Seulement pour ${A.etats.map((e) => POUR_ETAT[e]).join(' ou ')} : ta sélection contient ${hors.map((e) => COMPTE_ETAT(parEtat[e], e)).join(', ')}.`;
    }
    if (!raison && A.robot) {
      if (A.cap && capOk && !capOk(A.cap)) raison = 'Demande une extension VRM plus récente dans ce navigateur.';
      else if (chrome === undefined) raison = 'VRM ne sait pas encore quel compte Vinted est ouvert dans Chrome.';
      else if (chrome === null || chrome === '') raison = `Aucun compte Vinted ouvert dans Chrome : ouvre vinted.fr sur ${nom(comptes[0])}.`;
      else if (String(chrome) !== comptes[0]) raison = `Chrome est sur ${nom(String(chrome))} : ouvre vinted.fr sur ${nom(comptes[0])} pour agir sur ses annonces.`;
    }
    return { k: A.k, titre: A.titre, desc: A.desc, ok: !raison, raison, ids, robot: !!A.robot };
  });
}

// ── REPUBLIER À LA MAIN : REMETTRE LE N° SUR LA NOUVELLE (identité) ─────────
// `suivis` = { [ancienId]: { uid, num, at, nouvelId?, lieAt? } } (synchronisé,
// `vrm_repub_main`). Le lien nouvelle → ancienne est posé par SON clic
// (« C'est celle-ci ») : une IDENTITÉ qu'il donne, jamais une ressemblance de
// titre, de prix ou de date (§5). La reprise du N° elle-même est celle des
// republications (`repriseNumerosRecreation`, src/repriseNumero.js) : la table
// { nouvelId: ancienId } rendue ici s'AJOUTE à celle que l'extension écrit.
export function liensRepubMain(suivis) {
  const t = {};
  if (!suivis || typeof suivis !== 'object') return t;
  const num = (x) => (/^\d{4,15}$/.test(String(x || '')) ? String(x) : '');
  for (const anc of Object.keys(suivis)) {
    const s = suivis[anc]; const a = num(anc), n = num(s && s.nouvelId);
    if (a && n && a !== n && !t[n]) t[n] = a;
  }
  return t;
}
// Les annonces qu'il PEUT désigner comme la nouvelle : en ligne, sur le MÊME
// compte, pas l'ancienne, pas déjà désignée pour une autre, sans N° posé à la
// main. Triées de la plus récente à la plus ancienne (pour qu'il la trouve vite) ;
// la date n'est jamais une preuve : rien n'est choisi à sa place.
export function candidatsNouvelle({ ancienId, uid, enLigne, numeros, suivis, debut }) {
  const anc = String(ancienId || ''); const u = String(uid || '');
  const pris = new Set(Object.entries(suivis || {}).filter(([k, s]) => k !== anc && s && s.nouvelId).map(([, s]) => String(s.nouvelId)));
  const t0 = Number(debut) || 0;
  const date = (it) => { const c = Number(it && it.createdTs); return Number.isFinite(c) && c > 0 ? (c < 1e12 ? c * 1000 : c) : null; };
  return (enLigne || [])
    .filter((it) => it && String(it.uid || '') === u && String(it.id) !== anc && !pris.has(String(it.id)))
    .filter((it) => { const e = (numeros || {})[it.id]; return !(e && String(e.numero || '').trim() && (!e.auto || e.manuelAt)); })
    // Une annonce mise en ligne bien AVANT qu'il commence (plus de 10 min) ne
    // peut pas être la nouvelle : elle sort de la liste (date connue seulement).
    .filter((it) => { const d = date(it); return !(t0 && d != null && d < t0 - 10 * 60000); })
    .sort((a, b) => (date(b) || 0) - (date(a) || 0));
}
// Où en est un suivi : 'attente' (pas encore désignée) · 'lie' (désignée, l'ancienne
// encore en ligne : le N° attend) · 'fait' (la nouvelle porte le N°).
export function etatSuiviMain(s, { numeros, enLigneIds, cle } = {}) {
  if (!s || !s.nouvelId) return 'attente';
  const k = cle || ((n) => String(n == null ? '' : n).trim().toUpperCase());
  const e = (numeros || {})[String(s.nouvelId)];
  if (e && s.num && k(e.numero) === k(s.num)) return 'fait';
  return 'lie';
}

// ── LES PHOTOS RÉGLÉES (republier à la main) ───────────────────────────────
// Les VALEURS des réglages (les mêmes que Republier : rotation, lumière,
// contraste, saturation, zoom) traduites pour une toile 2D. Pur : la toile est
// dessinée par l'app.
export const REGLAGES_NEUTRES = { rot: 0, bright: 1, contrast: 1, sat: 1, zoom: 1 };
export function filtreReglages(r) {
  const x = { ...REGLAGES_NEUTRES, ...(r || {}) };
  const b = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));
  return {
    filtre: `brightness(${b(x.bright, 0.5, 1.6)}) contrast(${b(x.contrast, 0.5, 1.6)}) saturate(${b(x.sat, 0, 2)})`,
    rot: b(x.rot, -15, 15), zoom: b(x.zoom, 1, 1.5),
  };
}
export function nomPhotoReglee(num, i) {
  const n = String(num || '').replace(/[^0-9A-Za-z]/g, '');
  return `VRM-${n || 'annonce'}-${String(i + 1).padStart(2, '0')}.jpg`;
}
// Repli quand la toile ne sait pas filtrer (`ctx.filter` absent : Safari) : la
// même lumière, le même contraste, la même saturation, pixel par pixel (formules
// des filtres CSS). `data` = Uint8ClampedArray RGBA, modifié en place.
export function appliquerCouleursPixels(data, r) {
  const x = { ...REGLAGES_NEUTRES, ...(r || {}) };
  const br = Number(x.bright) || 1, ct = Number(x.contrast) || 1, sa = Number.isFinite(Number(x.sat)) ? Number(x.sat) : 1;
  if (br === 1 && ct === 1 && sa === 1) return data;
  const ic = 0.5 - 0.5 * ct;
  for (let i = 0; i < data.length; i += 4) {
    let R = data[i] / 255 * br, G = data[i + 1] / 255 * br, B = data[i + 2] / 255 * br;
    R = R * ct + ic; G = G * ct + ic; B = B * ct + ic;
    const l = 0.213 * R + 0.715 * G + 0.072 * B;
    R = l + (R - l) * sa; G = l + (G - l) * sa; B = l + (B - l) * sa;
    data[i] = R * 255; data[i + 1] = G * 255; data[i + 2] = B * 255;
  }
  return data;
}
