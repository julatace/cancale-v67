// ═════════════════════════════════════════════════════════════════════════════
//  LES PRIX EN ATTENTE (19 nov. 2026, extension 5.409 — capacité `prixattente`)
// ═════════════════════════════════════════════════════════════════════════════
// Julien, sur une capture de son iPhone (fiche N°134, « Changer le prix », 59 → 58) :
// « Regarde ce genre de fonctionnalité qui pue, tu me les enlèves tout de suite :
// c'est à l'extension de baisser les prix, c'est pas à moi. » L'app répondait
// « Proposé : à toi de confirmer » avec un SECOND bouton « Baisser sur Vinted ».
//
// ⇒ « Appliquer » EST son clic : la baisse part par le chemin d'extension existant
//   (`baisserPrixVinted`, `baisserPrixLbc`, `baisserPrixVestiaire` — AUCUN garde-fou
//   retiré : compte de l'onglet, prix lu avant et RELU après, 45/h, pause 429/403).
//   Quand l'extension ne peut pas agir MAINTENANT (iPhone, pas d'onglet du site sur ce
//   compte, plafond, pause), la baisse est RANGÉE ici, dans SA base :
//
//     une ligne `cmd_prix_{id}` = UNE commande = UN prix = UNE annonce,
//     à autorisation unique (prise par une écriture conditionnelle `attente → pris`,
//     notée dans `chrome.storage.local` AVANT d'agir : jamais rejouée), périmée après
//     24 h (jamais exécutée en retard), annulable tant qu'elle attend, et le prix LU
//     avant d'agir doit être celui qu'il a vu à la saisie (`prixAvant`) — sinon rien
//     ne part et c'est dit.
//
//   La première extension 5.409 d'un de SES navigateurs qui a le site ouvert sur le
//   bon compte la prend, l'exécute avec EXACTEMENT les gardes d'un clic, et écrit
//   l'issue dans la ligne (prix relu). Une famille d'identifiants à part
//   (`cmd_prix_*`, pas `cmd_relais_*`) : une extension plus ancienne ne la voit pas
//   (elle l'aurait refusée « expirée » au bout de 10 min).
//
// Le bloc <prix-attente-regle> est RECOPIÉ tel quel dans
// vinted-sync-extension/background.js (`node scripts/audit-prix-attente.cjs --recopie`) :
// l'app et l'extension jugent une commande et une réponse avec la MÊME règle.
// Module PUR en dehors des trois fonctions d'entrée/sortie du bas (dépendances
// données par l'app). Exécuté par scripts/audit-prix-attente.cjs.
// ═════════════════════════════════════════════════════════════════════════════

// <prix-attente-regle>
const PRIX_ATT_MS = 24 * 3600000;             // une baisse en attente périme après 24 h
const PRIX_ATT_PRIS_MS = 10 * 60000;          // prise sans issue depuis 10 min ⇒ « pas sûr »
const PRIX_ATT_REPORTS = 40;                  // remise en attente au plus 40 fois (jamais une boucle sans fin)
const PRIX_ATT_RE_ID = /^cmd_prix_[a-z0-9]{8,40}$/;
const PRIX_ATT_SITES = ['vinted', 'leboncoin', 'vestiaire'];
// Les refus où RIEN n'est parti et où la baisse redevient possible toute seule (le
// bon compte ouvert, une place dans l'heure, la fin d'une pause) : elle ATTEND.
// Tout autre refus est une issue (dite), jamais une attente.
const PRIX_ATT_ATTENDRE = {
  vinted: ['vinted-absent', 'vinted-autre', 'vinted-pause', 'onglet-vinted', 'absente', 'plafond', 'plafond-bordereaux', 'plafond-jour', 'quota-jour', 'discretion', 'prudence', 'frein-refus', 'stockage', 'coffre-lecture', 'modele-lecture'],
  leboncoin: ['en-cours', 'lbc-pause', 'lbc-absent', 'autre-compte', 'entetes', 'plafond', 'stockage', 'lecture'],
  vestiaire: ['en-cours', 'vc-pause', 'vc-absent', 'autre-compte', 'annonce-non-vue', 'entetes', 'plafond', 'stockage', 'lecture'],
};
// Les arrêts qu'il a posés ou qui demandent SON geste (« Tout arrêter », vérification
// anti-robot) : jamais une attente — un arrêt est un arrêt, la baisse est refusée et dite.
const PRIX_ATT_ARRETS = /^(tout-arrete|verification|secu-robot|secu-arret|arrete)$/;
function prixAttCents(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : NaN; }
function prixAttAttend(site, code) {
  const c = String(code || '');
  if (PRIX_ATT_ARRETS.test(c)) return false;
  if ((PRIX_ATT_ATTENDRE[site] || []).includes(c)) return true;
  return /^secu-/.test(c);                    // un frein de la sécurité des comptes (repos, plafond du jour, espace…)
}
// La commande rangée, vérifiée de la MÊME façon des deux côtés. Rend
// { site, cle, vouluC, avantC, msg } (le message du chemin de baisse) ou { refus }.
// Une HAUSSE n'est jamais une commande (les chemins de baisse la refusent : §3).
function prixAttCommande(d) {
  const a = d && d.args && typeof d.args === 'object' ? d.args : {};
  const site = String((d && d.site) || '');
  if (!PRIX_ATT_SITES.includes(site)) return { refus: 'non-autorise' };
  if (d.confirme !== true) return { refus: 'confirmation' };
  const vouluC = prixAttCents(a.prix), avantC = prixAttCents(a.prixAvant);
  if (!Number.isInteger(vouluC) || !Number.isInteger(avantC) || Math.abs(Number(a.prix) * 100 - vouluC) > 1e-6 || Math.abs(Number(a.prixAvant) * 100 - avantC) > 1e-6) return { refus: 'arguments' };
  if (!(vouluC >= 100 && avantC < 10000000)) return { refus: 'arguments' };
  if (!(vouluC < avantC)) return { refus: 'hausse' };
  const id = String(a.id == null ? '' : a.id);
  if (site === 'vinted') {
    const uid = String(a.uid == null ? '' : a.uid);
    if (!/^\d{1,20}$/.test(uid) || !/^\d{4,15}$/.test(id)) return { refus: 'arguments' };
    return { site, cle: 'vinted:' + id, uid, vouluC, avantC, msg: { cmd: 'baisserPrixVinted', uid, id, prix: vouluC / 100, prixAvant: avantC / 100, confirme: true } };
  }
  if (site === 'leboncoin') {
    if (!/^\d{6,12}$/.test(id)) return { refus: 'arguments' };
    return { site, cle: 'leboncoin:' + id, uid: '', vouluC, avantC, msg: { cmd: 'lbcPrix', id, prix: vouluC / 100, prixAvant: avantC / 100, confirme: true } };
  }
  if (!/^\d{3,15}$/.test(id)) return { refus: 'arguments' };
  return { site, cle: 'vestiaire:' + id, uid: '', vouluC, avantC, msg: { cmd: 'vcPrix', produit: id, avantCents: avantC, apresCents: vouluC, confirme: true } };
}
// La date après laquelle une commande ne part plus (jamais plus de 24 h après la demande).
function prixAttFin(d) {
  const dem = Number(d && d.demandeLe) || 0;
  return dem ? Math.min(Number(d.expire) || dem + PRIX_ATT_MS, dem + PRIX_ATT_MS) : 0;
}
// Le sens de la réponse d'un chemin de baisse, pour une baisse voulue à `vouluC` centimes :
//   fait (relu : le site MONTRE ce prix) · incertain · refuse · attendre (rien n'est parti).
// « Le prix a changé » alors que le site montre DÉJÀ le prix voulu ⇒ fait (une commande
// partie deux fois ne baisse jamais deux fois : la seconde lit le prix et s'arrête).
function prixAttIssue(site, r, vouluC) {
  if (!r || typeof r !== 'object') return { etat: 'incertain', code: 'sans-reponse', raison: '', prixVu: null };
  const vuC = r.prixVu == null ? NaN : prixAttCents(r.prixVu);
  const vu = Number.isInteger(vuC) ? vuC / 100 : null;
  const raison = String(r.raison || r.error || '').slice(0, 300);
  if (r.accepte === true) {
    if (r.etape === 'fait') return Number.isInteger(vuC) && vuC !== vouluC ? { etat: 'incertain', code: 'ecart', raison, prixVu: vu } : { etat: 'fait', code: '', raison: '', prixVu: vu };
    if (r.etape === 'envoye') return { etat: 'fait', code: 'envoye', raison: '', prixVu: null };     // Leboncoin : accepté, relu plus tard sur « Mes annonces »
    if (r.etape === 'ecart') return { etat: 'incertain', code: 'ecart', raison, prixVu: vu };
    if (r.etape === 'incertain') return { etat: 'incertain', code: 'incertain', raison, prixVu: null };
    return { etat: 'refuse', code: String(r.code || r.etape || 'echec'), raison, prixVu: vu };
  }
  const code = String(r.code || '');
  const change = code === 'prix-change' || (site === 'leboncoin' && code === 'perime');
  if (change && Number.isInteger(vuC) && vuC === vouluC) return { etat: 'fait', code: 'deja', raison: '', prixVu: vu };
  if (change) return { etat: 'refuse', code: 'prix-change', raison, prixVu: vu };
  if (prixAttAttend(site, code)) return { etat: 'attendre', code, raison, prixVu: null, attendreMs: Number(r.attendreMs) > 0 ? Number(r.attendreMs) : 0 };
  return { etat: 'refuse', code: code || 'refus', raison, prixVu: vu };
}
// </prix-attente-regle>

export { PRIX_ATT_MS, PRIX_ATT_PRIS_MS, PRIX_ATT_REPORTS, PRIX_ATT_RE_ID, PRIX_ATT_SITES, PRIX_ATT_ATTENDRE, prixAttCents, prixAttAttend, prixAttCommande, prixAttFin, prixAttIssue };

// ── CÔTÉ APP ────────────────────────────────────────────────────────────────
// La ligne d'une commande neuve. `null` ⇒ ce n'est pas une baisse rangeable (hausse,
// prix illisible, annonce incomplète) : rien n'est écrit.
// `alea` : 8 caractères [a-z0-9] (l'app les tire ; un audit les fixe).
export function nouvelleCommandePrix({ site, uid = '', id, prix, prixAvant, num = '', owner, maintenant = Date.now(), alea = '' } = {}) {
  if (!owner) return null;
  const data = { v: 1, site: String(site || ''), args: { ...(site === 'vinted' ? { uid: String(uid || '') } : {}), id: String(id == null ? '' : id), prix: Number(prix), prixAvant: Number(prixAvant) },
    confirme: true, pour: String(owner), demandeLe: maintenant, expire: maintenant + PRIX_ATT_MS, etat: 'attente', reports: 0 };
  const c = prixAttCommande(data);
  if (c.refus) return null;
  // À plat pour `meta` (une lecture ne décompresse jamais `data`, §4.4) : la clé de l'annonce, les deux prix, le N°.
  Object.assign(data, { cle: c.cle, prix: c.vouluC / 100, prixAvant: c.avantC / 100, num: String(num || '').slice(0, 12) });
  const suffixe = String(alea || '').toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(8, '0').slice(0, 8);
  return { id: 'cmd_prix_' + maintenant.toString(36) + suffixe, data };
}

// Ce que l'écran dit d'une commande lue (`meta` projetée : etat, cle, prix, prixAvant,
// demandeLe, expire, prisLe, finiLe, code, raison, prixVu). Une commande encore « en
// attente » après sa date limite est PÉRIMÉE même si aucune extension ne l'a écrite.
//   attente · pris · incertain (prise sans issue depuis 10 min) · fait · refuse ·
//   perimee · annulee · remplacee
export function vueCommandePrix(l, maintenant = Date.now()) {
  if (!l || typeof l !== 'object') return null;
  const n = (v) => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
  const brut = String(l.etat || '');
  const dem = n(l.demandeLe) || 0, fin = prixAttFin({ demandeLe: dem, expire: n(l.expire) });
  let etat = brut;
  if (brut === 'attente' && fin && maintenant > fin) etat = 'perimee';
  else if (brut === 'expiree') etat = 'perimee';
  else if (brut === 'pris' && maintenant - (n(l.prisLe) || dem) > PRIX_ATT_PRIS_MS) etat = 'incertain';
  else if (!['attente', 'pris', 'fait', 'refuse', 'incertain', 'annulee', 'remplacee'].includes(brut)) etat = 'refuse';
  return { id: String(l.id || ''), cle: String(l.cle || ''), etat, prix: n(l.prix), prixAvant: n(l.prixAvant), prixVu: n(l.prixVu), num: String(l.num || ''),
    code: String(l.code || ''), raison: String(l.raison || ''), demandeLe: dem, fin, finiLe: n(l.finiLe), relu: etat === 'fait' && n(l.prixVu) != null };
}
// La commande qui PARLE pour une annonce : celle qui attend (ou est prise), sinon la
// dernière issue de moins de 24 h. Une annulée ou remplacée ne dit rien.
export function commandeCourante(vues, cle, maintenant = Date.now()) {
  const l = (vues || []).filter((v) => v && v.cle === cle && v.etat !== 'annulee' && v.etat !== 'remplacee').sort((a, b) => b.demandeLe - a.demandeLe);
  const enCours = l.find((v) => v.etat === 'attente' || v.etat === 'pris');
  if (enCours) return enCours;
  const derniere = l[0];
  return derniere && maintenant - (derniere.finiLe || derniere.demandeLe) < PRIX_ATT_MS ? derniere : null;
}

export const SELECT_PRIX_ATTENTE = 'id,etat:meta->>etat,cle:meta->>cle,prix:meta->>prix,prixAvant:meta->>prixAvant,num:meta->>num,demandeLe:meta->>demandeLe,expire:meta->>expire,prisLe:meta->>prisLe,finiLe:meta->>finiLe,code:meta->>code,raison:meta->>raison,prixVu:meta->>prixVu';

// ── ENTRÉES / SORTIES (la base du vendeur, RLS) — `dep` donné par l'app ──────
//   dep.base        l'adresse REST (`…/rest/v1`)
//   dep.entetes(x)  les en-têtes de SA session
//   dep.ligne(l)    `withOwner` (propriétaire + `updated_at`)
//   dep.conflit     la clé d'unicité (`owner,id` en base cloisonnée)
// Trois états partout : valeur · `null` (pas su, rien n'est supposé).
const enc = encodeURIComponent;
async function appel(dep, chemin, init) {
  try { const r = await (dep.fetch || fetch)(`${dep.base}/${chemin}`, init); return r && r.ok ? r : null; } catch (_) { return null; }
}
// Les commandes d'une liste d'annonces (`cles` : « vinted:123 », …), les plus récentes d'abord.
export async function lirePrixAttente(dep, cles = null, maintenant = Date.now()) {
  const filtre = Array.isArray(cles) && cles.length ? `&meta->>cle=in.(${cles.map((c) => `"${String(c).replace(/[^a-z0-9:]/gi, '')}"`).map(enc).join(',')})` : '';
  const r = await appel(dep, `app_data?id=like.cmd_prix_*${filtre}&select=${SELECT_PRIX_ATTENTE}&order=id.desc&limit=60`, { headers: dep.entetes(), cache: 'no-store' });
  if (!r) return null;
  let rows; try { rows = await r.json(); } catch (_) { return null; }
  return Array.isArray(rows) ? rows.map((l) => vueCommandePrix(l, maintenant)).filter(Boolean) : null;
}
// Passe une commande d'un état à un autre SOUS CONDITION (elle doit encore attendre).
// true = changée · false = elle n'attendait plus (prise entre-temps) · null = pas su.
async function changerSiAttente(dep, id, etat, maintenant) {
  const lue = await appel(dep, `app_data?id=eq.${enc(id)}&select=data`, { headers: dep.entetes(), cache: 'no-store' });
  if (!lue) return null;
  let rows; try { rows = await lue.json(); } catch (_) { return null; }
  const d = Array.isArray(rows) && rows[0] && rows[0].data;
  if (!d || typeof d !== 'object') return Array.isArray(rows) ? false : null;
  if (d.etat !== 'attente') return false;
  const r = await appel(dep, `app_data?id=eq.${enc(id)}&meta->>etat=eq.attente&select=id`, { method: 'PATCH',
    headers: dep.entetes({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify({ data: { ...d, etat, finiLe: maintenant }, updated_at: new Date(maintenant).toISOString() }) });
  if (!r) return null;
  try { const x = await r.json(); return Array.isArray(x) ? x.length > 0 : null; } catch (_) { return null; }
}
export const annulerPrixAttente = (dep, id, maintenant = Date.now()) => (PRIX_ATT_RE_ID.test(String(id || '')) ? changerSiAttente(dep, String(id), 'annulee', maintenant) : Promise.resolve(false));
// Range UNE commande. Celles qui attendaient déjà pour la MÊME annonce sont d'abord
// remplacées (une annonce n'a jamais deux baisses en attente) ; si l'une d'elles ne peut
// pas l'être à coup sûr (pas su), RIEN n'est rangé. Rend la ligne écrite, ou null.
export async function deposerPrixAttente(dep, commande, maintenant = Date.now()) {
  if (!commande || !PRIX_ATT_RE_ID.test(String(commande.id || '')) || !commande.data) return null;
  const avant = await lirePrixAttente(dep, [commande.data.cle], maintenant);
  if (avant === null) return null;
  for (const v of avant) if (v.etat === 'attente') { const ok = await changerSiAttente(dep, v.id, 'remplacee', maintenant); if (ok === null) return null; }
  const r = await appel(dep, `app_data?on_conflict=${dep.conflit}`, { method: 'POST',
    headers: dep.entetes({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify([dep.ligne({ id: commande.id, data: commande.data })]) });
  return r ? commande : null;
}
