// ════════════════════════════════════════════════════════════════════════════
//  LES COLIS À ALLER CHERCHER, PAR POINT RELAIS (31 octobre)
//  Julien : « l'extension peut essayer de capter le nom des points relais où
//  les colis vont arriver, pour prévoir ; objectif : une carte avec les colis à
//  aller chercher par point relais, et des prévisions ».
//  Une règle PURE (aucune lecture, aucune écriture), testée seule
//  (scripts/audit-relais-carte.cjs) :
//   · `arrives`  — les colis DÉJÀ au point relais (e-mail du transporteur ou
//                  conversation Vinted), chacun avec SON lieu lu ;
//   · `attendus` — les achats EN ROUTE dont la destination est connue PAR
//                  IDENTITÉ : le suivi Vinted de CETTE transaction
//                  (`harvest_{uid}_suivi_{tx}` → relaisNom/Rue/Cp/Ville,
//                  relevés par l'extension 5.295), jamais un lieu deviné depuis
//                  le titre, le transporteur ou le relais « habituel » (§5) ;
//                  leur arrivée n'est qu'ESTIMÉE (celle que Vinted donne), ou
//                  pas dite.
//  Deux colis sont au MÊME point quand le nom propre normalisé (sans accents,
//  espaces ni ponctuation — « TABA'VAP » = « TABAVAP », la règle des blocs
//  « Va à » ; sans le type de lieu en tête — « Point relais TABAVAP » =
//  « TABAVAP ») ET le code postal sont les mêmes ; un lieu sans code postal ne
//  rejoint un point que si UN SEUL point porte ce nom (dans sa ville, à sa rue).
//  Ce sont des LIEUX qu'on regroupe, jamais des colis qu'on rapproche : chaque
//  colis garde son identité.
//  (1er nov.) Un colis dont AUCUNE source ne nomme le lieu n'est plus écarté :
//  il tombe sous « Point pas encore connu » (`CLE_INCONNU`), avec sa raison.
// ════════════════════════════════════════════════════════════════════════════

export const normNomRelais = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
export const cpDe = (s) => { const m = /\b(\d{5})\b/.exec(String(s || '')); return m ? m[1] : ''; };

// ── LE NOM D'UN POINT (1er nov.) ─────────────────────────────────────────────
// Julien : « certains colis n'ont pas de point ou un point mal nommé ». Mesuré
// sur les formes rangées (historique colis-retraits) :
//   · le TYPE de lieu pris pour son nom : « Votre Relais Pickup TERRA CBD »
//     (Chronopost, « disponible dans votre Relais Pickup … »), « Consigne
//     Vinted Go » seule, « Point relais TABAVAP » ;
//   · un TRANSPORTEUR pris pour un lieu (« chez Mondial Relay ») ;
//   · la VILLE prise pour le nom : `cleanLieu` nomme le point d'après sa ville
//     quand l'e-mail ne donne que « 40 RUE DU PORT 35260 CANCALE » (« Cancale »).
// Le nom propre est rendu, ou '' : un point sans nom reste un point (son
// adresse le désigne), jamais un nom inventé.
const TYPE_EN_TETE = /^(?:(?:votre|ton|le|la|au|en|dans)\s+)?(?:point\s+relais|point\s+de\s+retrait|relais\s+pick-?up|consigne(?:\s+vinted\s*go|\s+pick-?up|\s+automatique)?|locker(?:\s*24\s*\/?\s*7)?|casier)\b\s*[:\-–]?\s*/i;
const PAS_UN_POINT = /^(?:mondialrelay|chronopost|chronopostpickup|vinted|vintedgo|relaiscolis|laposte|colissimo|pickup|relaispickup|ups|dpd|gls|inpost|pointrelais|pointderetrait|consigne|consignevintedgo|consignepickup|locker|casier|lieunonindique)$/;
export function nomRelaisPropre(nom, ville = '') {
  let s = String(nom || '').replace(/®|™|©|[*_]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 2; i++) {
    const m = TYPE_EN_TETE.exec(s);
    if (!m) break;
    const reste = s.slice(m[0].length).trim();
    if (!reste) break;
    s = reste;
  }
  const n = normNomRelais(s);
  if (!n || n.replace(/[0-9]/g, '').length < 2 || PAS_UN_POINT.test(n)) return '';
  if (ville && n === normNomRelais(ville)) return '';
  return s;
}

// L'adresse qu'on peut chercher sur une carte : une RUE (qui commence par son
// numéro) ET un code postal ou une ville. Sinon `null` — un nom de commerce
// seul, ou une ville seule, poserait l'épingle au centre de la ville : faux.
const RUE = /^\d{1,4}\s*(?:bis|ter)?[\s,]+\S{2,}/i;
export function adresseGeocodable(p) {
  if (!p) return null;
  const rue = String(p.rue || '').trim(), cp = String(p.cp || '').trim(), ville = String(p.ville || '').trim();
  if (!RUE.test(rue)) return null;
  if (!/^\d{5}$/.test(cp) && ville.length < 2) return null;
  return `${rue}, ${[cp, ville].filter(Boolean).join(' ')}`.replace(/\s+/g, ' ').trim();
}

// « 12 Rue du Port, 35260 Cancale » → { rue, cp, ville } ; sinon ce qu'on en lit.
// (1er nov.) « 35260 CANCALE » seul (le transporteur ne donne que la ville) n'est
// PAS une rue : avant, il passait pour la rue et l'adresse s'écrivait « 35260
// CANCALE, 35260 ».
export function decouperAdresse(adresse) {
  const s = String(adresse || '').replace(/\s+/g, ' ').replace(/[,\s]*\bfrance\s*$/i, '').trim();
  const seul = /^(\d{5})\s+([A-Za-zÀ-ÿ'’ -]{2,40})$/.exec(s);
  if (seul) return { rue: '', cp: seul[1], ville: seul[2].trim() };
  const m = /^(.*?)[,\s]+(\d{5})\s+([A-Za-zÀ-ÿ'’ -]{2,40}?)$/i.exec(s);
  if (m) return { rue: m[1].replace(/[,\s]+$/, ''), cp: m[2], ville: m[3].trim() };
  const sansVille = /^(.*?)[,\s]+(\d{5})$/.exec(s);
  if (sansVille) return { rue: sansVille[1].replace(/[,\s]+$/, ''), cp: sansVille[2], ville: '' };
  return { rue: /^\d{5}\b/.test(s) ? '' : s, cp: cpDe(s), ville: '' };
}
// Un texte TOUT EN MAJUSCULES (« 29 RUE HOCHE ») s'écrit lisiblement ; le reste tel quel.
const lisible = (s) => {
  const t = String(s || '').trim();
  if (!t || t !== t.toUpperCase() || !/[A-Z]/.test(t)) return t;
  return t.toLowerCase().replace(/(^|[\s'’-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase())
    .replace(/(\s)(De|Du|La|Le|Les|Des|Et)(?=\s)/g, (m, a, w) => a + w.toLowerCase());
};

const jourValide = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && Number.isFinite(Date.parse(s + 'T12:00:00Z'));

// Le point « pas encore connu » : les colis dont AUCUNE source ne nomme le lieu.
// Ils restent listés (§5 : un colis caché est un colis perdu), avec la raison.
export const CLE_INCONNU = '__inconnu';

// arrives  : [{ id, nom, adresse | rue/cp/ville, transporteur, aCode, titre, … }]
//            (tout autre champ est GARDÉ sur le colis : photo, code, N°, jours…)
// attendus : [{ id, nom, rue, cp, ville, transporteur, estimee, titre }]
export function regrouperRelais({ arrives = [], attendus = [] } = {}) {
  const points = new Map();
  const vu = new Set();   // un colis (son identité) ne compte qu'une fois
  const poser = (x, sorte) => {
    if (!x) return;
    const idc = String(x.id || '');
    if (idc) { if (vu.has(idc)) return; vu.add(idc); }
    const morceaux = x.adresse != null && x.rue == null ? decouperAdresse(x.adresse) : { rue: x.rue || '', cp: x.cp || '', ville: x.ville || '' };
    const cp = /^\d{5}$/.test(String(morceaux.cp || '')) ? String(morceaux.cp) : '';
    const rueLue = String(morceaux.rue || '').trim();
    const rueOk = RUE.test(rueLue) ? rueLue : '';
    const nom = nomRelaisPropre(x.nom, morceaux.ville);
    // L'identité d'un LIEU : son nom propre + son code postal ; sans nom, sa rue
    // + son code postal (une adresse est un endroit) ; sans rien, « pas connu ».
    const cle = nom ? normNomRelais(nom) + '|' + cp : (rueOk && cp ? 'adr:' + normNomRelais(rueOk) + '|' + cp : CLE_INCONNU);
    const inconnu = cle === CLE_INCONNU;
    const p = points.get(cle) || { cle, nom: inconnu ? '' : nom, nomConnu: !!nom, inconnu, rue: '', cp, ville: '', transporteurs: [], arrives: [], attendus: [] };
    if (!inconnu) { p.rue = p.rue || rueOk || ''; p.ville = p.ville || morceaux.ville || ''; }
    if (x.transporteur && !p.transporteurs.includes(x.transporteur)) p.transporteurs.push(x.transporteur);
    const reste = { ...x };
    for (const k of ['nom', 'adresse', 'rue', 'cp', 'ville']) delete reste[k];
    const colis = { ...reste, id: idc, titre: x.titre || '', aCode: x.aCode === true };
    if (sorte === 'attendu') colis.estimee = jourValide(x.estimee) ? x.estimee : null;
    p[sorte === 'attendu' ? 'attendus' : 'arrives'].push(colis);
    points.set(cle, p);
  };
  for (const x of arrives) poser(x, 'arrive');
  for (const x of attendus) poser(x, 'attendu');
  // Un lieu SANS code postal rejoint le point du même nom s'il est le SEUL à le
  // porter — ou le seul de ce nom dans SA ville, ou à SA rue (une identité de
  // plus, jamais une ressemblance). « Speed Queen - Vannes » (consigne Vinted Go,
  // sans code postal) est « Speed Queen » à Vannes.
  const nomDe = (cle) => cle.split('|')[0];
  for (const [cle, p] of [...points.entries()]) {
    if (p.cp || p.inconnu || cle.startsWith('adr:')) continue;
    const autres = [...points.values()].filter((q) => q !== p && q.cp && !q.inconnu && !q.cle.startsWith('adr:'));
    let memes = autres.filter((q) => nomDe(q.cle) === nomDe(cle));
    if (memes.length > 1 && p.ville) memes = memes.filter((q) => normNomRelais(q.ville) === normNomRelais(p.ville));
    if (memes.length > 1 && p.rue) memes = memes.filter((q) => normNomRelais(q.rue) === normNomRelais(p.rue));
    if (!memes.length) {
      const tiret = /^(.*?)\s+[-–]\s+(.{2,40})$/.exec(p.nom);
      if (tiret) memes = autres.filter((q) => nomDe(q.cle) === normNomRelais(tiret[1]) && normNomRelais(q.ville) === normNomRelais(tiret[2]));
    }
    if (memes.length !== 1) continue;
    const q = memes[0];
    q.arrives.push(...p.arrives); q.attendus.push(...p.attendus);
    for (const t of p.transporteurs) if (!q.transporteurs.includes(t)) q.transporteurs.push(t);
    q.rue = q.rue || p.rue; q.ville = q.ville || p.ville;
    points.delete(cle);
  }
  const liste = [...points.values()].map((p) => {
    const est = p.attendus.map((c) => c.estimee).filter(Boolean).sort();
    p.attendus.sort((a, b) => (a.estimee ? 0 : 1) - (b.estimee ? 0 : 1) || String(a.estimee || '').localeCompare(String(b.estimee || '')));
    // La date limite la plus proche, parmi les colis COMPTÉS (un « à vérifier »
    // n'a plus de date à tenir).
    const lims = p.arrives.filter((c) => !c.aVerifier && Number.isFinite(c.jours)).map((c) => c.jours);
    const prochaineLimite = lims.length ? Math.min(...lims) : null;
    p.arrives.sort((a, b) => (a.aVerifier ? 1 : 0) - (b.aVerifier ? 1 : 0) || (Number.isFinite(a.jours) ? a.jours : 99) - (Number.isFinite(b.jours) ? b.jours : 99));
    const rue = lisible(p.rue), ville = lisible(p.ville);
    return { ...p, rue, ville, adresse: [rue, [p.cp, ville].filter(Boolean).join(' ')].filter(Boolean).join(', '), adresseCourte: [rue, ville].filter(Boolean).join(', ') || p.cp,
      geocode: p.inconnu ? null : adresseGeocodable({ rue, cp: p.cp, ville }),
      nArrives: p.arrives.length, nAttendus: p.attendus.length, nComptes: p.arrives.filter((c) => !c.horsCompte).length,
      prochaineEstimee: est[0] || null, prochaineLimite, urgent: prochaineLimite != null && prochaineLimite <= 1 };
  });
  // Le point où des colis ATTENDENT d'abord (ils repartent si on ne vient pas) :
  // la date limite la plus proche en tête, puis le plus chargé ; puis les points
  // où des colis vont arriver, le plus tôt d'abord ; « pas encore connu » à la fin.
  const lim = (x) => (x.prochaineLimite == null ? 99 : x.prochaineLimite);
  return liste.sort((a, b) => (a.inconnu ? 1 : 0) - (b.inconnu ? 1 : 0) || (b.nArrives > 0) - (a.nArrives > 0) || lim(a) - lim(b) || b.nArrives - a.nArrives
    || String(a.prochaineEstimee || '9999').localeCompare(String(b.prochaineEstimee || '9999')) || b.nAttendus - a.nAttendus || a.nom.localeCompare(b.nom, 'fr'));
}

// ── LE REPÈRE DONNÉ PAR VINTED LUI-MÊME (1er nov.) ──────────────────────────
// La liste des points relais que l'extension relève chez Vinted
// (`harvest_{uid}_pickup_points` → nom, adresse, latitude, longitude) porte la
// position EXACTE du point. On la prend pour un point de la colonne seulement
// par identité : le MÊME nom propre ET le même code postal (ou, sans code
// postal lu, la même rue). Plusieurs positions possibles ⇒ rien (on ne choisit
// pas). Jamais le nom seul : « Carrefour City » existe dans chaque ville.
export function repereDepuisPointsVinted(p, liste) {
  if (!p || p.inconnu || !p.nom || !Array.isArray(liste)) return null;
  const n = normNomRelais(p.nom);
  const bons = liste.filter((q) => {
    if (!q || normNomRelais(nomRelaisPropre(q.nom)) !== n) return false;
    const lat = Number(q.lat), lon = Number(q.lon);
    if (q.lat === '' || q.lon === '' || q.lat == null || q.lon == null) return false;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (!lat && !lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
    const a = decouperAdresse(q.adresse);
    if (p.cp) return a.cp === p.cp;
    return !!(p.rue && a.rue && normNomRelais(a.rue) === normNomRelais(p.rue));
  });
  const pos = [...new Set(bons.map((q) => `${Number(q.lat).toFixed(4)},${Number(q.lon).toFixed(4)}`))];
  if (pos.length !== 1) return null;
  const a = decouperAdresse(bons[0].adresse);
  return { lat: Number(bons[0].lat), lon: Number(bons[0].lon), rue: a.rue, cp: a.cp, ville: a.ville, source: 'vinted' };
}

// ── LA COLONNE « À RETIRER », PAR POINT (1er nov.) ──────────────────────────
// Julien : « je crois qu'il n'y a pas tous les points relais, il ne doit pas y
// avoir d'erreur et ça doit être un peu plus clair ». Chaque colis de la colonne
// (ceux que `pickupUnion` compte, et ses « à vérifier » marqués `horsCompte`)
// tombe sous SON point, ou sous « Point pas encore connu » avec sa raison —
// jamais écarté. Les points reçoivent un NUMÉRO (le même sur la carte et dans
// la liste) et, s'ils ne peuvent pas y être, la raison en clair.
export function pointsARetirer({ colis = [], attendus = [], pointsVinted = [] } = {}) {
  const groupes = regrouperRelais({ arrives: colis, attendus });
  let numero = 0;
  const points = groupes.map((g) => {
    if (g.inconnu) return { ...g, numero: null, repere: null, sansCarte: null };
    let x = { ...g };
    const rv = repereDepuisPointsVinted(g, pointsVinted);
    if (rv) {
      const rue = x.rue || lisible(rv.rue), cp = x.cp || rv.cp, ville = x.ville || lisible(rv.ville);
      x = { ...x, rue, cp, ville, adresse: [rue, [cp, ville].filter(Boolean).join(' ')].filter(Boolean).join(', '), adresseCourte: [rue, ville].filter(Boolean).join(', ') || cp, geocode: adresseGeocodable({ rue, cp, ville }) };
    }
    numero++;
    const sansCarte = rv ? null
      : !x.rue ? (x.cp || x.ville ? 'la rue du point n’a pas été donnée, seulement la ville' : 'l’adresse du point n’a pas été donnée')
      : !x.geocode ? 'il manque le code postal et la ville du point'
      : null;
    return { ...x, numero, repere: rv ? { lat: rv.lat, lon: rv.lon, source: 'vinted' } : null, sansCarte };
  });
  const nComptes = points.reduce((t, p) => t + p.nComptes, 0);
  const nHors = points.reduce((t, p) => t + p.arrives.filter((c) => c.horsCompte).length, 0);
  return { points, nComptes, nHors, nAttendus: points.reduce((t, p) => t + p.nAttendus, 0) };
}

// Le résultat de la Base Adresse Nationale n'est GARDÉ que s'il est sûr : une
// adresse (pas une commune), un score ≥ 0,6, et le MÊME code postal que celui
// lu. Sinon `null` : le point est listé sans repère, et c'est dit.
export function repereDepuisBan(json, cpAttendu) {
  const f = json && Array.isArray(json.features) ? json.features[0] : null;
  if (!f || !f.geometry || !Array.isArray(f.geometry.coordinates)) return null;
  const pr = f.properties || {};
  const [lon, lat] = f.geometry.coordinates.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!(Number(pr.score) >= 0.6)) return null;
  if (pr.type && !/^(housenumber|street)$/.test(String(pr.type))) return null;
  if (cpAttendu && String(pr.postcode || '') !== String(cpAttendu)) return null;
  return { lat, lon };
}

// (1er nov.) LES REQUÊTES À LA BASE ADRESSE NATIONALE, dans l'ordre : l'adresse
// complète filtrée par son code postal ; puis la rue + la ville seules (un code
// postal mal relié à la ville dans la base) — le résultat devant TOUJOURS
// porter le code postal lu (`repereDepuisBan`). Rien à chercher sans rue.
export function requetesBan(p) {
  const g = adresseGeocodable(p);
  if (!g) return [];
  const cp = /^\d{5}$/.test(String(p.cp || '')) ? String(p.cp) : '';
  const q = [{ q: g, postcode: cp }];
  if (p.ville && cp) q.push({ q: `${String(p.rue).trim()}, ${String(p.ville).trim()}`, postcode: '' });
  return q;
}
