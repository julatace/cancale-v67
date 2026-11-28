// ═════════════════════════════════════════════════════════════════════════════
//  À DISTANCE (22 nov. 2026, extension 5.436.0 — capacité `adistance`)
// ═════════════════════════════════════════════════════════════════════════════
// Julien : accéder à ses comptes Vinted (et Leboncoin, Vestiaire) À DISTANCE, « comme Bleam
// Cloud mais sans risque de ban », pour TOUS les vendeurs VRM. Décision (confirmée par lui) :
// PAS de navigateur dans le cloud, PAS d'adresse IP ni d'empreinte par compte (§3). Le relais,
// c'est SON ordinateur : son Chrome avec l'extension, chez lui, exécute ; l'app (iPhone,
// n'importe où) montre et commande.
//
//   · PRÉSENCE — chaque navigateur publie SA ligne `presence_{appareil}` (jamais `main`) :
//     allumé, version, comptes ouverts dans ses onglets (Vinted, Leboncoin, Vestiaire), ce
//     qu'il a lu (48 h), ce qui retient une commande. L'app dit « Ton ordinateur (Chrome · Mac)
//     est allumé · comptes X, Y » ou « éteint depuis 21:40 — tes gestes attendront ».
//   · FILE — une ligne `cmd_dist_{id}` = UNE commande = UN geste = UN compte (le modèle de
//     `cmd_prix_*`, src/prixAttente.js, étendu) : déposée par SA session (RLS, `owner`), son
//     empreinte (rien ne change après le dépôt), 24 h au plus, prise UNE fois par une écriture
//     conditionnelle (`attente → pris`, notée avant d'agir), annulable tant qu'elle attend.
//     L'extension ne l'exécute que dans l'onglet de CE compte, par le chemin du clic (interface
//     de la page, compte de l'onglet, cadence du compte, une à la fois, pause 403/429, arrêt à
//     une vérification VISIBLE) et écrit l'issue : fait (avant → après) · refusé (raison) ·
//     pas sûr. Jamais deux comptes en même temps.
//   · INSTANTANÉ — la base prévient (Supabase Realtime, diffusion privée `vrm-lignes:<owner>`,
//     migration 040 posée) : l'extension prend la commande dans la seconde, l'app voit « en
//     cours » puis « fait ». Realtime muet ⇒ sondage, et c'est DIT.
//
// Le bloc <a-distance-regle> est RECOPIÉ tel quel dans vinted-sync-extension/background.js
// (`node scripts/audit-a-distance.cjs --recopie`) : l'app et l'extension jugent une commande
// avec la MÊME règle. Module PUR au-dessus des entrées/sorties du bas.
// ═════════════════════════════════════════════════════════════════════════════
import { signalDelai } from './compatSafari.js';   // (24 nov.) AbortSignal.timeout manque à Safari < 16 (audit-safari)

// <a-distance-regle>
const ADIST_MS = 24 * 3600000;                 // une commande à distance périme après 24 h
const ADIST_PRIS_MS = 15 * 60000;              // prise sans issue depuis 15 min ⇒ « pas sûr »
const ADIST_ALLUME_MS = 3 * 60000;             // présence plus vieille ⇒ ordinateur éteint (ou Chrome fermé)
const ADIST_REPORTS = 40;                      // remise en attente au plus 40 fois
const ADIST_RE_ID = /^cmd_dist_[a-z0-9]{8,40}$/;
const ADIST_RE_PRESENCE = /^presence_[a-f0-9]{16}$/;
const ADIST_SITES = ['vinted', 'leboncoin', 'vestiaire'];
// Les gestes permis, et sur quels sites. Rien d'autre ne part (jamais une suppression seule,
// jamais une requête arbitraire, jamais un achat).
const ADIST_GESTES = {
  repondre: ['vinted', 'leboncoin', 'vestiaire'],
  accepter: ['vinted'], refuser: ['vinted'], contreOffre: ['vinted'],
  prix: ['vinted', 'leboncoin', 'vestiaire'],
  masquer: ['vinted'], afficher: ['vinted'],
  republier: ['vinted'],
  bordereau: ['vinted'],
  relire: ['vinted', 'leboncoin'],
  // 5.450 (24 nov., Julien : « faire absolument TOUT depuis VRM si l'extension est connectée ») — par les chemins du clic
  // existants, avec leurs gardes : messages aux favoris (la file 5.440.1), mode vacances, créer un brouillon ; Leboncoin
  // pause, suppression (confirmée, sans retour), publication ; Vestiaire réponse à une offre, offre aux « aimés » (recettes
  // APPRISES de son propre geste). Publier sur Vestiaire n'y est PAS : VRM n'y clique jamais « Publier » à sa place.
  favoris: ['vinted'], vacances: ['vinted'], creer: ['vinted'],
  pause: ['leboncoin'], supprimer: ['leboncoin'], publier: ['leboncoin'],
  offre: ['vestiaire'], aimes: ['vestiaire'],
};
// Les gestes qui engagent l'argent ou ne se défont pas (§2.10 : la SEULE confirmation) :
// accepter vend la paire ; republier supprime l'ancienne annonce.
const ADIST_CONFIRMER = ['accepter', 'republier', 'favoris', 'supprimer'];   // 5.450 : écrire à des personnes ; supprimer (sans retour)
// Les raisons où RIEN n'est parti et où le geste redeviendra possible tout seul (le bon compte
// ouvert, une place dans l'heure, la fin d'une pause, la vérification faite) : il ATTEND.
const ADIST_ATTENDRE = ['absent', 'autre-compte', 'deux-comptes', 'onglet', 'pause', 'verification', 'plafond', 'plafond-jour', 'quota-jour',
  'discretion', 'prudence', 'frein-refus', 'stockage', 'en-cours', 'vinted-absent', 'vinted-autre', 'vinted-pause', 'onglet-vinted', 'lbc-absent', 'lbc-pause',
  'vc-absent', 'vc-pause', 'session', 'lecture', 'coffre-lecture', 'modele-lecture', 'plafond-bordereaux',
  'tour'];   // 5.457 (« Mode ordinateur allumé ») : un AUTRE profil de l'ordinateur a le tour d'écriture — rien n'est parti, il attend
// (« Tout arrêter » n'est JAMAIS une attente : un arrêt est un arrêt, la commande est refusée et dite.)
function adistAttend(code) { const c = String(code || ''); return ADIST_ATTENDRE.includes(c) || /^secu-/.test(c); }
function adistCompteOk(site, c) {
  const x = String(c == null ? '' : c);
  if (site === 'vinted') return /^\d{1,20}$/.test(x);
  if (site === 'leboncoin') return /^[0-9a-z_-]{1,64}$/i.test(x);
  if (site === 'vestiaire') return /^[\w-]{1,40}$/.test(x);
  return false;
}
// Une forme stable (clés triées) : l'empreinte ne dépend pas de l'ordre d'écriture.
function adistStable(v) {
  if (Array.isArray(v)) return '[' + v.map(adistStable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + adistStable(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
// L'EMPREINTE de la commande (FNV-1a 64 bits en deux moitiés) : ce que SA session a déposé — le geste, le site, le
// compte, les arguments, le vendeur, l'heure. Une ligne modifiée après le dépôt (un argument changé, un autre compte)
// ne correspond plus : refusée. (La signature, c'est sa session : RLS n'accepte que SES lignes.)
function adistEmpreinte(d) {
  const s = adistStable([d && d.v, d && d.geste, d && d.site, d && d.compte, d && d.args, d && d.pour, d && d.demandeLe]);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ c, 0x0100019d) >>> 0; }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
const adistNum = (x) => /^[1-9]\d{0,19}$/.test(String(x == null ? '' : x));
function adistCents(v) { const n = Number(v); return Number.isFinite(n) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 ? Math.round(n * 100) : NaN; }
// La commande, vérifiée de la MÊME façon des deux côtés. Rend { geste, site, compte, cle, args } ou { refus }.
function adistCommande(d) {
  if (!d || typeof d !== 'object' || d.v !== 1) return { refus: 'forme' };
  const geste = String(d.geste || ''), site = String(d.site || '');
  if (!Object.prototype.hasOwnProperty.call(ADIST_GESTES, geste) || !ADIST_GESTES[geste].includes(site)) return { refus: 'non-autorise' };
  const compte = String(d.compte == null ? '' : d.compte);
  if (!adistCompteOk(site, compte)) return { refus: 'compte' };
  if (!/^[0-9a-f-]{8,64}$/i.test(String(d.pour || ''))) return { refus: 'proprietaire' };
  if (String(d.empreinte || '') !== adistEmpreinte(d)) return { refus: 'empreinte' };
  if (ADIST_CONFIRMER.includes(geste) && d.confirme !== true) return { refus: 'confirmation' };
  const a = d.args && typeof d.args === 'object' && !Array.isArray(d.args) ? d.args : {};
  const out = (args, cle) => ({ geste, site, compte, args, cle: `${site}:${compte}:${geste}:${cle}` });
  if (geste === 'repondre') {
    const conv = String(a.conv == null ? '' : a.conv);
    const okConv = site === 'vinted' ? adistNum(conv) : site === 'leboncoin' ? /^[\w-]{3,64}$/.test(conv) : /^[\w-]{3,40}$/.test(conv);
    const texte = typeof a.texte === 'string' ? a.texte.replace(/\r\n?/g, '\n').trim() : '';
    if (!okConv || !texte || texte.length > (site === 'vestiaire' ? 1000 : 2000)) return { refus: 'arguments' };
    return out({ conv, texte }, conv + ':' + adistEmpreinte({ v: 1, args: texte }).slice(0, 8));
  }
  if (geste === 'accepter' || geste === 'refuser') {
    if (!adistNum(a.tx) || !adistNum(a.oid) || (a.conv != null && !adistNum(a.conv))) return { refus: 'arguments' };
    const prixC = a.prix == null ? null : adistCents(a.prix);
    return out(Object.assign({ tx: String(a.tx), oid: String(a.oid) }, a.conv != null ? { conv: String(a.conv) } : {}, Number.isInteger(prixC) ? { prix: prixC / 100 } : {}), a.tx + ':' + a.oid);
  }
  if (geste === 'contreOffre') {
    const c = adistCents(a.prix);
    if (!adistNum(a.tx) || !Number.isInteger(c) || c < 100 || c >= 10000000 || (a.conv != null && !adistNum(a.conv)) || (a.itemId != null && !/^\d{4,15}$/.test(String(a.itemId)))) return { refus: 'arguments' };
    return out(Object.assign({ tx: String(a.tx), prix: c / 100 }, a.conv != null ? { conv: String(a.conv) } : {}, a.itemId != null ? { itemId: String(a.itemId) } : {}), a.tx);
  }
  if (geste === 'prix') {
    const id = String(a.id == null ? '' : a.id), c = adistCents(a.prix), av = adistCents(a.prixAvant);
    const okId = site === 'vinted' ? /^\d{4,15}$/.test(id) : site === 'leboncoin' ? /^\d{6,12}$/.test(id) : /^\d{3,15}$/.test(id);
    // Une BAISSE seulement (§3 : la hausse ne part jamais par une file), et le prix VU à la saisie voyage avec.
    if (!okId || !Number.isInteger(c) || !Number.isInteger(av) || c < 100 || av >= 10000000 || !(c < av)) return { refus: c >= av ? 'hausse' : 'arguments' };
    return out({ id, prix: c / 100, prixAvant: av / 100 }, id);
  }
  if (geste === 'masquer' || geste === 'afficher' || geste === 'republier') {
    const id = String(a.id == null ? '' : a.id);
    if (!/^\d{4,15}$/.test(id)) return { refus: 'arguments' };
    return out({ id }, id);
  }
  if (geste === 'bordereau') {
    if (!adistNum(a.tx)) return { refus: 'arguments' };
    return out({ tx: String(a.tx) }, a.tx);
  }
  // ── 5.450 ──
  if (geste === 'favoris') {
    const ids = Array.isArray(a.ids) ? a.ids : [];
    if (ids.length > 50 || ids.some((x) => typeof x !== 'string' || !/^[\w:.-]{1,160}$/.test(x))) return { refus: 'arguments' };
    const texte = a.texte == null ? null : typeof a.texte === 'string' ? a.texte.replace(/\r\n?/g, '\n').trim() : '';
    if (texte === '' || (texte && texte.length > 2000)) return { refus: 'arguments' };
    const taux = a.taux == null ? null : Number(a.taux);
    if (taux != null && !(Number.isInteger(taux) && taux >= 1 && taux <= 90)) return { refus: 'arguments' };
    const args = Object.assign({ ids: [...new Set(ids)] }, texte ? { texte } : {}, taux != null ? { taux } : {});
    return out(args, ids.length ? adistEmpreinte({ v: 1, args: [...new Set(ids)].sort() }).slice(0, 8) : 'tous');
  }
  if (geste === 'vacances') {
    if (typeof a.vacances !== 'boolean') return { refus: 'arguments' };
    return out({ vacances: a.vacances }, a.vacances ? 'on' : 'off');
  }
  if (geste === 'creer') {
    const f = a.fiche && typeof a.fiche === 'object' && !Array.isArray(a.fiche) ? a.fiche : null;
    let taille = 0; try { taille = JSON.stringify(a).length; } catch (_) { taille = 1e9; }
    // Une fiche LÉGÈRE seulement (des adresses de photos, jamais des images en base64) : la file n'est pas un transport de fichiers.
    if (!f || !/^[\w-]{1,40}$/.test(String(f.id || '')) || taille > 30000 || !Array.isArray(f.photos) || !f.photos.length || f.photos.length > 20
      || f.photos.some((u) => typeof u !== 'string' || !/^https:\/\//.test(u) || u.length > 600)) return { refus: 'arguments' };
    return out({ fiche: f, ...(a.reponses && typeof a.reponses === 'object' && !Array.isArray(a.reponses) ? { reponses: a.reponses } : {}) }, String(f.id));
  }
  if (geste === 'pause' || geste === 'publier') {
    const id = String(a.id == null ? '' : a.id);
    if (!(geste === 'pause' ? /^\d{6,12}$/ : /^\d{1,20}$/).test(id)) return { refus: 'arguments' };
    return out({ id }, id);
  }
  if (geste === 'supprimer') {
    const id = String(a.id == null ? '' : a.id);
    if (!/^\d{6,12}$/.test(id)) return { refus: 'arguments' };
    return out({ id, numero: String(a.numero || '').slice(0, 12), titre: String(a.titre || '').slice(0, 120) }, id);
  }
  if (geste === 'offre') {
    const nego = String(a.nego == null ? '' : a.nego), g2 = String(a.geste || '');
    const c = a.prix == null ? null : adistCents(a.prix);
    if (!/^\d{3,15}$/.test(nego) || !['accepter', 'refuser', 'contre'].includes(g2) || (g2 === 'contre' && !(Number.isInteger(c) && c >= 100 && c < 10000000))) return { refus: 'arguments' };
    return out(Object.assign({ nego, geste: g2 }, g2 === 'contre' ? { prix: c / 100 } : {}), nego + ':' + g2);
  }
  if (geste === 'aimes') {
    const produit = String(a.produit == null ? '' : a.produit), c = adistCents(a.prix), av = adistCents(a.prixAvant);
    if (!/^\d{3,15}$/.test(produit) || !Number.isInteger(c) || !Number.isInteger(av) || c < 100 || av >= 10000000 || !(c < av)) return { refus: c >= av ? 'hausse' : 'arguments' };
    return out({ produit, prix: c / 100, prixAvant: av / 100 }, produit);
  }
  return out({}, 'compte');                    // relire : le compte seulement
}
// La date après laquelle une commande ne part plus (jamais plus de 24 h après la demande).
function adistFin(d) {
  const dem = Number(d && d.demandeLe) || 0;
  return dem ? Math.min(Number(d.expire) || dem + ADIST_MS, dem + ADIST_MS) : 0;
}
// La présence lue d'un navigateur : `allume` seulement si son dernier signe de vie a moins de 3 min.
function adistPresence(row, maintenant) {
  if (!row || !ADIST_RE_PRESENCE.test(String(row.id || ''))) return null;
  const atMs = Number(row.atMs) || 0;
  const app = row.appareil && typeof row.appareil === 'object' ? row.appareil : {};
  const comptes = [];
  for (const c of Array.isArray(row.comptes) ? row.comptes.slice(0, 20) : []) {
    if (c && ADIST_SITES.includes(c.site) && adistCompteOk(c.site, c.id)) comptes.push({ site: c.site, id: String(c.id), nom: String(c.nom || '').slice(0, 60) });
  }
  const retenues = (Array.isArray(row.retenues) ? row.retenues : []).filter((x) => x && ADIST_RE_ID.test(String(x.id || ''))).slice(0, 20).map((x) => ({ id: String(x.id), code: String(x.code || '').slice(0, 30) }));
  return { id: String(row.id).slice(9), atMs, allume: atMs > 0 && maintenant - atMs < ADIST_ALLUME_MS && atMs <= maintenant + 120000, ver: String(row.ver || ''),
    nav: String(app.nav || ''), sys: String(app.systeme || ''), comptes, retenues, enCours: ADIST_RE_ID.test(String(row.enCours || '')) ? String(row.enCours) : '',
    rt: String(row.rt || ''),
    // 5.457 (« Mode ordinateur allumé ») : la veille de CE profil — allumée, sur quel compte, prête ou arrêtée (et pourquoi).
    serveur: row.serveur && typeof row.serveur === 'object' && row.serveur.on === true
      ? { on: true, uid: /^\d{1,20}$/.test(String(row.serveur.uid || '')) ? String(row.serveur.uid) : '', code: String(row.serveur.code || '').slice(0, 20), deconnecte: row.serveur.deconnecte === true } : null };
}
// </a-distance-regle>

export { ADIST_MS, ADIST_PRIS_MS, ADIST_ALLUME_MS, ADIST_REPORTS, ADIST_RE_ID, ADIST_RE_PRESENCE, ADIST_SITES, ADIST_GESTES, ADIST_CONFIRMER, ADIST_ATTENDRE,
  adistAttend, adistCompteOk, adistEmpreinte, adistCommande, adistFin, adistPresence };

// ── CÔTÉ APP : la ligne d'une commande neuve ─────────────────────────────────
// `null` ⇒ ce n'est pas une commande permise (rien n'est écrit). `alea` : 8 caractères [a-z0-9].
export function nouvelleCommandeDistance({ geste, site, compte, args = {}, owner, confirme = false, num = '', avant = null, maintenant = Date.now(), alea = '' } = {}) {
  if (!owner) return null;
  const data = { v: 1, geste: String(geste || ''), site: String(site || ''), compte: String(compte == null ? '' : compte), args: { ...args }, pour: String(owner), demandeLe: maintenant,
    expire: maintenant + ADIST_MS, etat: 'attente', reports: 0, par: 'app', ...(confirme === true ? { confirme: true } : {}) };
  const c0 = adistCommande({ ...data, empreinte: adistEmpreinte(data) });
  if (c0.refus) return null;
  data.args = c0.args;                           // la forme RANGÉE (texte nettoyé, prix en euros justes)
  data.empreinte = adistEmpreinte(data);
  // À plat pour `meta` (une lecture ne décompresse jamais `data`, §4.4).
  Object.assign(data, { cle: c0.cle, num: String(num || '').slice(0, 12), ...(avant != null && Number.isFinite(Number(avant)) ? { avant: Number(avant) } : {}) });
  const suffixe = String(alea || '').toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(8, '0').slice(0, 8);
  return { id: 'cmd_dist_' + maintenant.toString(36) + suffixe, data };
}

// Ce que l'écran dit d'une commande lue (projection scalaire). Une commande encore « en attente » après sa date
// limite est PÉRIMÉE même si aucun ordinateur ne l'a écrite ; prise sans issue depuis 15 min ⇒ « pas sûr ».
//   attente · pris · fait · refuse · incertain · perimee · annulee
export function vueCommandeDistance(l, maintenant = Date.now()) {
  if (!l || typeof l !== 'object' || !ADIST_RE_ID.test(String(l.id || ''))) return null;
  const n = (v) => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
  const brut = String(l.etat || '');
  const dem = n(l.demandeLe) || 0, fin = adistFin({ demandeLe: dem, expire: n(l.expire) });
  let etat = brut;
  if (brut === 'attente' && fin && maintenant > fin) etat = 'perimee';
  else if (brut === 'expiree') etat = 'perimee';
  else if (brut === 'pris' && maintenant - (n(l.prisLe) || dem) > ADIST_PRIS_MS) etat = 'incertain';
  else if (!['attente', 'pris', 'fait', 'refuse', 'incertain', 'annulee'].includes(brut)) etat = 'refuse';
  return { id: String(l.id), geste: String(l.geste || ''), site: String(l.site || ''), compte: String(l.compte || ''), etat, code: String(l.code || ''), raison: String(l.raison || ''),
    num: String(l.num || ''), avant: n(l.avant), apres: n(l.apres), demandeLe: dem, prisLe: n(l.prisLe), finiLe: n(l.finiLe), fin, par: String(l.appareil || ''),
    attend: String(l.attend || ''), pdf: l.pdf === true || l.pdf === 'true', cle: String(l.cle || '') };
}
export const SELECT_DISTANCE = 'id,etat:meta->>etat,geste:meta->>geste,site:meta->>site,compte:meta->>compte,num:meta->>num,avant:meta->>avant,apres:meta->>apres,'
  + 'demandeLe:meta->>demandeLe,expire:meta->>expire,prisLe:meta->>prisLe,finiLe:meta->>finiLe,code:meta->>code,raison:meta->>raison,appareil:meta->>appareil,attend:meta->>attend,pdf:meta->>pdf,cle:meta->>cle';
export const SELECT_PRESENCE = 'id,atMs:meta->>atMs,ver:meta->>ver,enCours:meta->>enCours,rt:meta->>rt,appareil:data->appareil,comptes:data->comptes,retenues:data->retenues,serveur:data->serveur';

// Les quatre groupes de la file (« En attente / En cours / Fait / Refusé »), du plus récent au plus ancien.
export function groupesFile(vues, maintenant = Date.now()) {
  const g = { attente: [], cours: [], fait: [], refuse: [] };
  for (const v of vues || []) {
    if (!v || v.etat === 'annulee') continue;
    if (v.etat === 'attente') g.attente.push(v);
    else if (v.etat === 'pris') g.cours.push(v);
    else if (v.etat === 'fait') { if (maintenant - (v.finiLe || v.demandeLe) < ADIST_MS) g.fait.push(v); }
    else if (maintenant - (v.finiLe || v.fin || v.demandeLe) < ADIST_MS) g.refuse.push(v);   // refusé · pas sûr · périmé
  }
  for (const k of Object.keys(g)) g[k].sort((a, b) => b.demandeLe - a.demandeLe);
  return g;
}

// L'ÉTAT DES ORDINATEURS, et D'OÙ partirait un geste pour un compte.
//   `presences` : undefined (on lit) · null (pas su) · liste de `adistPresence`.
// Rend { niveau, allumes, eteints, dernier } — niveau : lecture · passu · aucun · eteint · allume.
export function etatOrdinateurs(presences, maintenant = Date.now()) {
  if (presences === undefined) return { niveau: 'lecture', allumes: [], eteints: [], dernier: null };
  if (presences === null) return { niveau: 'passu', allumes: [], eteints: [], dernier: null };
  const l = presences.filter(Boolean).sort((a, b) => b.atMs - a.atMs);
  const allumes = l.filter((p) => p.allume), eteints = l.filter((p) => !p.allume);
  return { niveau: !l.length ? 'aucun' : allumes.length ? 'allume' : 'eteint', allumes, eteints, dernier: l[0] || null };
}
// L'ordinateur ALLUMÉ qui a CE compte ouvert, sinon un ordinateur allumé (il ouvrira l'onglet de travail Vinted s'il est
// connecté sur ce compte), sinon null. Rien n'est promis : c'est l'extension qui revérifie le compte au moment du geste.
export function ordinateurPour(presences, site, compte) {
  const l = (presences || []).filter((p) => p && p.allume).sort((a, b) => b.atMs - a.atMs);
  const avec = l.find((p) => p.comptes.some((c) => c.site === site && c.id === String(compte)));
  if (avec) return { p: avec, ouvert: true };
  return l[0] ? { p: l[0], ouvert: false } : null;
}

// ── ENTRÉES / SORTIES (la base du vendeur, RLS) — `dep` donné par l'app ──────
//   dep.base, dep.entetes(x), dep.ligne(l) (`withOwner`), dep.conflit, dep.fetch?
const enc = encodeURIComponent;
// Chaque lecture porte un `signal` (10 s au plus) : elle ne passe JAMAIS par la mémoire des lectures identiques de l'app
// (src/lecturesPartagees.js — une lecture annulable passe telle quelle). L'extension écrit ces lignes sans passer par
// l'app : une réponse gardée (2 s) pourrait montrer « en attente » juste après que l'ordinateur l'a prise. Précaution.
// (24 nov., main-vert) Par `signalDelai` (src/compatSafari.js) : sous Safari < 16 il n'y avait AUCUN signal (la lecture
// passait alors par la mémoire de 2 s) ; maintenant un AbortController + minuteur, partout.
const signalFrais = () => { try { return signalDelai(10000); } catch (_) { return undefined; } };
async function appel(dep, chemin, init) {
  const i = Object.assign({}, init || {});
  if (!i.signal) { const s = signalFrais(); if (s) i.signal = s; }
  try { const r = await (dep.fetch || fetch)(`${dep.base}/${chemin}`, i); return r && r.ok ? r : null; } catch (_) { return null; }
}
export { signalFrais };
async function json(r) { if (!r) return null; try { const x = await r.json(); return Array.isArray(x) ? x : null; } catch (_) { return null; } }
export async function lireCommandesDistance(dep, maintenant = Date.now()) {
  const rows = await json(await appel(dep, `app_data?id=like.cmd_dist_*&select=${SELECT_DISTANCE}&order=id.desc&limit=80`, { headers: dep.entetes(), cache: 'no-store' }));
  return rows ? rows.map((l) => vueCommandeDistance(l, maintenant)).filter(Boolean) : null;
}
export async function lireUneCommande(dep, id, maintenant = Date.now()) {
  if (!ADIST_RE_ID.test(String(id || ''))) return null;
  const rows = await json(await appel(dep, `app_data?id=eq.${enc(id)}&select=${SELECT_DISTANCE}`, { headers: dep.entetes(), cache: 'no-store' }));
  return rows ? (rows[0] ? vueCommandeDistance(rows[0], maintenant) : { absente: true }) : null;
}
// (25 nov., budget-vitesse) UNE lecture des présences partagée : la porte d'« agir » (App.jsx `SourceAgir`) et « À distance » la
// demandaient chacune au même moment (lecture en double). Une lecture en cours sert tous ceux qui la demandent ; une lecture
// RÉUSSIE sert 5 s ; une lecture ratée (null, « pas su ») n'est jamais gardée.
let presencesEnCours = null, presencesLues = null;
export async function lirePresences(dep, maintenant = Date.now()) {
  let rows;
  if (presencesLues && Date.now() - presencesLues.at < 5000) rows = presencesLues.rows;
  else {
    if (!presencesEnCours) {
      presencesEnCours = (async () => json(await appel(dep, `app_data?id=like.presence_*&select=${SELECT_PRESENCE}&limit=20`, { headers: dep.entetes(), cache: 'no-store' })))()
        .then((r) => { if (Array.isArray(r)) presencesLues = { at: Date.now(), rows: r }; return r; }, () => null)
        .finally(() => { presencesEnCours = null; });
    }
    rows = await presencesEnCours;
  }
  return rows ? rows.map((r) => adistPresence(r, maintenant)).filter(Boolean) : null;
}
// Dépose UNE commande. Une commande qui attend déjà pour le MÊME geste sur la MÊME chose (`cle`) n'est pas doublée :
// la plus ancienne reste (rien n'est écrit, elle est rendue). Rend { id, data } ou { deja } ou null (pas su ⇒ rien écrit).
export async function deposerCommandeDistance(dep, commande, maintenant = Date.now()) {
  if (!commande || !ADIST_RE_ID.test(String(commande.id || '')) || !commande.data) return null;
  const cle = String(commande.data.cle || '');
  const avant = await json(await appel(dep, `app_data?id=like.cmd_dist_*&meta->>cle=eq.${enc(cle)}&meta->>etat=in.(attente,pris)&select=id,etat:meta->>etat,demandeLe:meta->>demandeLe,expire:meta->>expire`, { headers: dep.entetes(), cache: 'no-store' }));
  if (avant === null) return null;
  const vivante = avant.find((l) => { const f = adistFin({ demandeLe: Number(l.demandeLe), expire: Number(l.expire) }); return f && maintenant <= f; });
  if (vivante) return { deja: String(vivante.id) };
  const r = await appel(dep, `app_data?on_conflict=${dep.conflit}`, { method: 'POST',
    headers: dep.entetes({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify([dep.ligne({ id: commande.id, data: commande.data })]) });
  return r ? commande : null;
}
// Annule SOUS CONDITION (elle doit encore attendre). true · false (prise entre-temps) · null (pas su).
export async function annulerCommandeDistance(dep, id, maintenant = Date.now()) {
  if (!ADIST_RE_ID.test(String(id || ''))) return false;
  const lue = await json(await appel(dep, `app_data?id=eq.${enc(id)}&select=data`, { headers: dep.entetes(), cache: 'no-store' }));
  if (!lue) return null;
  const d = lue[0] && lue[0].data;
  if (!d || typeof d !== 'object' || d.etat !== 'attente') return false;
  const r = await json(await appel(dep, `app_data?id=eq.${enc(id)}&meta->>etat=eq.attente&select=id`, { method: 'PATCH',
    headers: dep.entetes({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify({ data: { ...d, etat: 'annulee', finiLe: maintenant }, updated_at: new Date(maintenant).toISOString() }) }));
  return r ? r.length > 0 : null;
}

// ── LE MIROIR D'UN COMPTE VINTED (lectures légères, aucune écriture) ─────────
// La boîte : les 20 premières conversations, projetées champ par champ (jamais `select=data` : la ligne pèse ~60 Ko).
export const MIROIR_CONV_N = 20;
export function selectBoite(n = MIROIR_CONV_N) {
  // Un INDEX de tableau (le 2e paramètre d'Array.from), jamais un identifiant : audit-chemin-json-guillemets.
  // Les alias (i0, u0, t0, d0, l0…) sont lus par `conversationsDe` : l'ordre des colonnes n'y change rien.
  return ['cap:data->>capturedAt',
    ...Array.from({ length: n }, (_, i) => `i${i}:data->payload->conversations->${i}->>id`),
    ...Array.from({ length: n }, (_, i) => `u${i}:data->payload->conversations->${i}->>unread`),
    ...Array.from({ length: n }, (_, i) => `t${i}:data->payload->conversations->${i}->>updated_at`),
    ...Array.from({ length: n }, (_, i) => `d${i}:data->payload->conversations->${i}->>description`),
    ...Array.from({ length: n }, (_, i) => `l${i}:data->payload->conversations->${i}->opposite_user->>login`)].join(',');
}
export function conversationsDe(row, n = MIROIR_CONV_N) {
  if (!row || typeof row !== 'object') return null;
  const out = [];
  for (let i = 0; i < n; i++) {
    const id = row['i' + i];
    if (!adistNum(id)) continue;
    out.push({ id: String(id), nonLu: row['u' + i] === true || row['u' + i] === 'true', at: Date.parse(String(row['t' + i] || '')) || null,
      texte: String(row['d' + i] || '').slice(0, 160), qui: String(row['l' + i] || '').slice(0, 60) });
  }
  return { capte: Date.parse(String(row.cap || '')) || null, conversations: out };
}
// Une offre « en attente » : `current` et le statut 10 (OFFRE_EN_ATTENTE de l'extension ; mesuré : 10 · 20 · 30 · 40).
// Le fil d'UNE conversation (`harvest_{uid}_conv_{id}`, ~3 Ko) : messages, offres (une offre en cours se tranche ICI).
export const SELECT_FIL = 'cap:data->>capturedAt,msgs:data->payload->conversation->messages,tx:data->payload->conversation->transaction->>id,'
  + 'item:data->payload->conversation->transaction->>item_id,qui:data->payload->conversation->opposite_user->>login,repondre:data->payload->conversation->>allow_reply';
export function filDe(row, uid) {
  if (!row || typeof row !== 'object') return null;
  const messages = [];
  for (const m of Array.isArray(row.msgs) ? row.msgs.slice(-60) : []) {
    const e = m && m.entity && typeof m.entity === 'object' ? m.entity : {};
    const at = Number(m && m.created_at_ts) ? Number(m.created_at_ts) * (Number(m.created_at_ts) < 1e12 ? 1000 : 1) : null;
    if (m && m.entity_type === 'message') messages.push({ sorte: 'message', id: String(e.id || ''), texte: String(e.body || '').slice(0, 2000), moi: String(e.user_id || '') === String(uid), at });
    else if (m && m.entity_type === 'offer_request_message') {
      const prix = Number(e.price && typeof e.price === 'object' ? e.price.amount : e.price);
      messages.push({ sorte: 'offre', id: String(e.offer_request_id || ''), tx: String(e.transaction_id || ''), prix: Number.isFinite(prix) ? prix : null,
        statut: String(e.status_title || e.status || ''), courante: e.current === true, enAttente: e.current === true && Number(e.status) === 10, moi: String(e.user_id || '') === String(uid), at });
    }
  }
  return { capte: Date.parse(String(row.cap || '')) || null, tx: adistNum(row.tx) ? String(row.tx) : '', item: /^\d{4,15}$/.test(String(row.item || '')) ? String(row.item) : '',
    qui: String(row.qui || ''), peutRepondre: row.repondre !== false && row.repondre !== 'false', messages };
}
