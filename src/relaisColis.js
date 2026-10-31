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
//  Deux colis sont au MÊME point quand le nom normalisé (sans accents, espaces
//  ni ponctuation — « TABA'VAP » = « TABAVAP », la règle des blocs « Va à »)
//  ET le code postal sont les mêmes ; un lieu sans code postal ne rejoint un
//  point que si UN SEUL point porte ce nom. Ce sont des LIEUX qu'on regroupe,
//  jamais des colis qu'on rapproche : chaque colis garde son identité.
// ════════════════════════════════════════════════════════════════════════════

export const normNomRelais = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
export const cpDe = (s) => { const m = /\b(\d{5})\b/.exec(String(s || '')); return m ? m[1] : ''; };

// L'adresse qu'on peut chercher sur une carte : une RUE (qui commence par son
// numéro) ET un code postal ou une ville. Sinon `null` — un nom de commerce
// seul, ou une ville seule, poserait l'épingle au centre de la ville : faux.
export function adresseGeocodable(p) {
  if (!p) return null;
  const rue = String(p.rue || '').trim(), cp = String(p.cp || '').trim(), ville = String(p.ville || '').trim();
  if (!/^\d{1,4}\s*(?:bis|ter)?[\s,]+\S{2,}/i.test(rue)) return null;
  if (!/^\d{5}$/.test(cp) && ville.length < 2) return null;
  return `${rue}, ${[cp, ville].filter(Boolean).join(' ')}`.replace(/\s+/g, ' ').trim();
}

// « 12 Rue du Port, 35260 Cancale » → { rue, cp, ville } ; sinon ce qu'on en lit.
export function decouperAdresse(adresse) {
  const s = String(adresse || '').replace(/\s+/g, ' ').trim();
  const m = /^(.*?)[,\s]+(\d{5})\s+([A-Za-zÀ-ÿ'’ -]{2,40}?)(?:\s*,\s*france)?$/i.exec(s);
  if (m) return { rue: m[1].replace(/[,\s]+$/, ''), cp: m[2], ville: m[3].trim() };
  return { rue: s, cp: cpDe(s), ville: '' };
}

const jourValide = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && Number.isFinite(Date.parse(s + 'T12:00:00Z'));

export function regrouperRelais({ arrives = [], attendus = [] } = {}) {
  const points = new Map();
  const vu = new Set();   // un colis (son identité) ne compte qu'une fois
  const poser = (x, sorte) => {
    if (!x || !x.nom || !normNomRelais(x.nom)) return;
    const idc = String(x.id || '');
    if (idc) { if (vu.has(idc)) return; vu.add(idc); }
    const morceaux = x.adresse != null && x.rue == null ? decouperAdresse(x.adresse) : { rue: x.rue || '', cp: x.cp || '', ville: x.ville || '' };
    const cp = /^\d{5}$/.test(String(morceaux.cp || '')) ? String(morceaux.cp) : '';
    const cle = normNomRelais(x.nom) + '|' + cp;
    const p = points.get(cle) || { cle, nom: x.nom, rue: '', cp, ville: '', transporteurs: [], arrives: [], attendus: [] };
    p.rue = p.rue || morceaux.rue || ''; p.ville = p.ville || morceaux.ville || '';
    if (x.transporteur && !p.transporteurs.includes(x.transporteur)) p.transporteurs.push(x.transporteur);
    const colis = { id: idc, titre: x.titre || '', aCode: x.aCode === true };
    if (sorte === 'attendu') colis.estimee = jourValide(x.estimee) ? x.estimee : null;
    p[sorte === 'attendu' ? 'attendus' : 'arrives'].push(colis);
    points.set(cle, p);
  };
  for (const x of arrives) poser(x, 'arrive');
  for (const x of attendus) poser(x, 'attendu');
  // Un lieu SANS code postal rejoint le point du même nom s'il est le SEUL à le porter.
  for (const [cle, p] of [...points.entries()]) {
    if (p.cp) continue;
    const n = cle.split('|')[0];
    const memes = [...points.values()].filter((q) => q !== p && q.cp && q.cle.split('|')[0] === n);
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
    return { ...p, adresse: [p.rue, [p.cp, p.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '), geocode: adresseGeocodable(p),
      nArrives: p.arrives.length, nAttendus: p.attendus.length, prochaineEstimee: est[0] || null };
  });
  // Le point où des colis ATTENDENT d'abord (ils repartent si on ne vient pas),
  // le plus chargé en tête ; puis les points où des colis vont arriver, le plus tôt d'abord.
  return liste.sort((a, b) => (b.nArrives > 0) - (a.nArrives > 0) || b.nArrives - a.nArrives
    || String(a.prochaineEstimee || '9999').localeCompare(String(b.prochaineEstimee || '9999')) || b.nAttendus - a.nAttendus || a.nom.localeCompare(b.nom, 'fr'));
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
