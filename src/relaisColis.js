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
const TYPE_EN_TETE = /^(?:(?:votre|ton|le|la|au|en|dans)\s+)?(?:point\s+relais|point\s+de\s+retrait|relais\s+pick-?up|consigne(?:\s+vinted\s*go|\s+pick-?up|\s+automatique)?|locker(?:\s*24\s*\/?\s*7)?(?:\s+vinted\s*go)?|casier|vinted\s*go|mondial\s+relay|relais\s+colis|chronopost(?:\s+pick-?up)?)\b\s*[:,\-–]?\s*/i;
// (1er nov., « plus fiable ») Le TYPE peut aussi venir EN QUEUE : « Kusmi Tea -
// Consigne Vinted Go », « TABAVAP (Point Relais) ». Il est retiré de la même façon.
const TYPE_EN_QUEUE = /\s*(?:[,\-–(]\s*)(?:point\s+relais|point\s+de\s+retrait|relais\s+pick-?up|consigne(?:\s+vinted\s*go|\s+pick-?up)?|locker(?:\s+vinted\s*go)?|vinted\s*go)\s*\)?\s*$/i;
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
  { const q = TYPE_EN_QUEUE.exec(s); if (q && s.slice(0, q.index).trim()) s = s.slice(0, q.index).trim(); }
  s = s.replace(/^[\s,;:\-–]+|[\s,;:\-–]+$/g, '').trim();
  const n = normNomRelais(s);
  if (!n || n.replace(/[0-9]/g, '').length < 2 || PAS_UN_POINT.test(n)) return '';
  if (ville && n === normNomRelais(ville)) return '';
  // « le Narval » (l'article mis en minuscule par la mise en forme du lieu) : la
  // première lettre d'un nom reste une majuscule.
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// L'adresse qu'on peut chercher sur une carte : une RUE (qui commence par son
// numéro) ET un code postal ou une ville. Sinon `null` — un nom de commerce
// seul, ou une ville seule, poserait l'épingle au centre de la ville : faux.
// (1er nov., « plus fiable ») Une rue lue SANS code postal ni ville à part
// (« 29 RUE HOCHE VANNES » : la ville collée à la rue) est cherchée telle quelle,
// et le résultat n'est gardé que si SA ville termine le texte et SON adresse en
// est tout le début, mot pour mot (`jugerBan`, mode `texte`) — sinon rien, dit.
const RUE = /^\d{1,4}\s*(?:bis|ter)?[\s,]+\S{2,}/i;
// (2 nov., 23 h) Une VOIE sans numéro (« Rue de la Bretonnière », le locker d'un
// supermarché) est une adresse cherchable AVEC son code postal seulement : la Base
// Adresse rend alors la rue (type `street`) et `jugerBan` exige le même code postal.
// Sans code postal, une rue sans numéro reste trop vague : rien.
const VOIE_SANS_NUMERO = /^(?:rue|avenue|av\.?|boulevard|bd|place|quai|chemin|all[ée]e|route|impasse|cours|square|faubourg|passage|esplanade|promenade|rond-point|r[ée]sidence|zac|za|zi|zone|parc|lotissement|lieu[- ]dit|centre\s+commercial)\s+\S{2,}/i;
export const rueCherchable = (rue, cp) => { const r = String(rue || '').trim(); return RUE.test(r) || (/^\d{5}$/.test(String(cp || '')) && VOIE_SANS_NUMERO.test(r)); };
// Un nom suivi de « <numéro> <type de voie> … » : l'adresse collée au nom.
const ADRESSE_DANS_NOM = /^(.*?[A-Za-zÀ-ÿ].*?)[\s,]+(\d{1,4}\s*(?:bis|ter)?[\s,]+(?:rue|avenue|av\.?|boulevard|bd|place|pl\.?|quai|chemin|all[ée]e|route|impasse|cours|square|faubourg|passage|esplanade|promenade|rond-point|r[ée]sidence|zac|za|zi)\b.*)$/i;
export function adresseGeocodable(p) {
  if (!p) return null;
  const rue = String(p.rue || '').trim(), cp = String(p.cp || '').trim(), ville = String(p.ville || '').trim();
  if (!rueCherchable(rue, cp)) return null;
  if (!/^\d{5}$/.test(cp) && ville.length < 2) return rue.split(/\s+/).length >= 4 && !rue.includes(',') ? rue.replace(/\s+/g, ' ') : null;
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
  // (1er nov.) « 29 Rue Hoche, Vannes » : la rue, une virgule, la ville SANS code
  // postal. Avant, le tout passait pour la rue et le point n'avait pas de ville :
  // jamais cherché sur la carte (« il manque le code postal et la ville »). La
  // ville est le DERNIER morceau, des lettres seulement, après une rue numérotée.
  const rueVille = /^(\d{1,4}\s*(?:bis|ter)?[\s,]+[^,]{3,60}?)\s*,\s*([A-Za-zÀ-ÿ'’ -]{2,40})$/i.exec(s);
  if (rueVille) return { rue: rueVille[1].trim(), cp: '', ville: rueVille[2].trim() };
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
    let morceaux = x.adresse != null && x.rue == null ? decouperAdresse(x.adresse) : { rue: x.rue || '', cp: x.cp || '', ville: x.ville || '' };
    let nomLu = x.nom;
    // (1er nov.) L'adresse COLLÉE au nom (« TABAVAP 29 RUE HOCHE VANNES » : sans
    // code postal, `cleanLieu` garde tout comme nom) : le nom est ce qui précède le
    // numéro de la rue, l'adresse ce qui suit. Sans quoi ce point était un « nom »
    // à part, sans adresse — jamais sur la carte, et pas avec les autres Tabavap.
    if (!RUE.test(String(morceaux.rue || '').trim())) {
      const colle = ADRESSE_DANS_NOM.exec(String(nomLu || '').replace(/[*_]+/g, ' ').replace(/\s+/g, ' ').trim());
      if (colle) {
        const d = decouperAdresse(colle[2]);
        nomLu = colle[1];
        morceaux = { rue: d.rue, cp: morceaux.cp && /^\d{5}$/.test(String(morceaux.cp)) ? morceaux.cp : d.cp, ville: morceaux.ville || d.ville };
      }
    }
    const cp = /^\d{5}$/.test(String(morceaux.cp || '')) ? String(morceaux.cp) : '';
    const rueLue = String(morceaux.rue || '').trim();
    const rueOk = rueCherchable(rueLue, cp) ? rueLue : '';
    const nom = nomRelaisPropre(nomLu, morceaux.ville);
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
    // (3 nov.) Jamais dans une AUTRE ville, jamais à une AUTRE rue : quand le lieu les donne, ils
    // doivent être ceux du point rejoint (avant : « le seul autre point du même nom », même ailleurs).
    let memes = autres.filter((q) => nomDe(q.cle) === nomDe(cle)
      && (!p.ville || !q.ville || normNomRelais(q.ville) === normNomRelais(p.ville))
      && (!p.rue || !q.rue || normRue(q.rue) === normRue(p.rue)));
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
    // (2 nov., revue du 23 oct. rétablie) Pour TRIER seulement : sans date limite lue,
    // ce qui reste de la garde de SON transporteur (`urgenceTri`, posé par l'écran sur
    // chaque colis : Mondial Relay 5 j, Vinted Go 6 j…). Jamais affiché, jamais « en retard ».
    const tris = p.arrives.filter((c) => !c.aVerifier && Number.isFinite(c.tri)).map((c) => c.tri);
    const triPoint = lims.length ? Math.min(...lims, ...tris) : (tris.length ? Math.min(...tris) : null);
    p.arrives.sort((a, b) => (a.aVerifier ? 1 : 0) - (b.aVerifier ? 1 : 0) || (Number.isFinite(a.jours) ? a.jours : 99) - (Number.isFinite(b.jours) ? b.jours : 99));
    const rue = lisible(p.rue), ville = lisible(p.ville);
    return { ...p, rue, ville, adresse: [rue, [p.cp, ville].filter(Boolean).join(' ')].filter(Boolean).join(', '), adresseCourte: [rue, ville].filter(Boolean).join(', ') || p.cp,
      geocode: p.inconnu ? null : adresseGeocodable({ rue, cp: p.cp, ville }),
      nArrives: p.arrives.length, nAttendus: p.attendus.length, nComptes: p.arrives.filter((c) => !c.horsCompte).length,
      prochaineEstimee: est[0] || null, prochaineLimite, triPoint, urgent: prochaineLimite != null && prochaineLimite <= 1 };
  });
  // Le point où des colis ATTENDENT d'abord (ils repartent si on ne vient pas) :
  // la date limite la plus proche en tête, puis le plus chargé ; puis les points
  // où des colis vont arriver, le plus tôt d'abord ; « pas encore connu » à la fin.
  const lim = (x) => (x.triPoint != null ? x.triPoint : x.prochaineLimite == null ? 99 : x.prochaineLimite);
  return liste.sort((a, b) => (a.inconnu ? 1 : 0) - (b.inconnu ? 1 : 0) || (b.nArrives > 0) - (a.nArrives > 0) || lim(a) - lim(b) || b.nArrives - a.nArrives
    || String(a.prochaineEstimee || '9999').localeCompare(String(b.prochaineEstimee || '9999')) || b.nAttendus - a.nAttendus || a.nom.localeCompare(b.nom, 'fr'));
}

// ── LE LIEU COMPLÉTÉ PAR LE TRANSPORTEUR, PAR LE N° DE SUIVI (1er nov.) ─────
// Julien : « Kusmi Tea · 13 Rue Saint-Vincent — Pas sur la carte : le message
// donne la rue du point mais ni son code postal ni sa ville » ; « je sais que tu
// peux avoir les infos en regardant sur Vinted Go ». L'e-mail de la consigne
// Vinted Go ne porte ni code postal ni ville ; le SUIVI Vinted Go de CE colis
// (`transp_vinted_{n°}`, lu par le serveur, ou relayé par l'extension) porte
// l'adresse du point où il attend : rue + ville (mesuré : « 24 Rue Hoche,
// Vannes, FR », jamais de code postal). Le rattachement est le n° de suivi (une
// identité, §5) — jamais le nom du point.
// `lu` : { lieuNom, lieuAdresse } (tel que l'e-mail ou la conversation l'écrit) ;
// `tr` : la ligne `transp_` du MÊME n° (ou rien).
// Rend `lu` inchangé, ou complété (`lieuComplete: 'transporteur'`), ou marqué
// `lieuConflit` quand les deux sources donnent deux adresses (rien n'est choisi).
// Seul un transporteur qui donne la RUE (Vinted Go) agit ici : Chronopost et
// Mondial Relay (nom + ville, sans rue) ne changent rien à ce qui marchait.
const ABREV_RUE = [[/\bst\b/g, 'saint'], [/\bste\b/g, 'sainte'], [/\bav\b/g, 'avenue'], [/\bbd\b/g, 'boulevard'], [/\bpl\b/g, 'place'], [/\bche?m\b/g, 'chemin'], [/\bimp\b/g, 'impasse'], [/\bfbg\b/g, 'faubourg']];
export const normRue = (s) => {
  let t = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const [re, w] of ABREV_RUE) t = t.replace(re, w);
  return t.replace(/\s+/g, '');
};
// (2 nov., mesuré en base) Des lignes `transp_vinted_…` rangées avant le
// correctif du serveur portent le PAYS à la place de la ville et la ville collée à
// la rue (rue « 13 Rue Saint-Vincent, Vannes », ville « France ») : la rue ne
// ressemblait plus à celle de l'e-mail ⇒ « deux adresses » ⇒ pas sur la carte.
// On les relit dans LEUR forme (« <rue>, <Ville> » + pays), sans rien deviner :
// un pays seul en ville et une rue qui finit par « , <Ville> ». Sinon rien.
export const PAYS_VILLE = /^(?:[A-Z]{2}|France|Belgique|Belgi[eë]|Belgium|Nederland|Pays-Bas|Netherlands|Deutschland|Allemagne|Germany|Italia|Italie|Italy|Espa[ñn]a|Espagne|Spain|Portugal|Österreich|Autriche|Austria|Polska|Pologne|Poland)$/i;
export function lieuTransporteurRepare(tr) {
  if (!tr || typeof tr !== 'object') return tr;
  const ville = String(tr.lieuVille || '').trim();
  const rue = String(tr.lieuRue || '').trim();
  if (!PAYS_VILLE.test(ville)) return tr;
  const m = /^(.+?),\s*(?:(\d{5})\s+)?([A-Za-zÀ-ÿ'’ -]{2,60})$/.exec(rue);
  if (!m || !RUE.test(m[1].trim()) || PAYS_VILLE.test(m[3].trim())) return { ...tr, lieuVille: '' };   // un pays n'est jamais une ville
  return { ...tr, lieuRue: m[1].trim(), lieuCp: /^\d{5}$/.test(String(tr.lieuCp || '')) ? String(tr.lieuCp) : (m[2] || ''), lieuVille: m[3].trim() };
}
export function lieuCompleteParTransporteur(lu, tr) {
  const base = { lieuNom: String((lu && lu.lieuNom) || ''), lieuAdresse: String((lu && lu.lieuAdresse) || '') };
  if (!tr || typeof tr !== 'object' || !['disponible', 'retire'].includes(tr.etat)) return base;
  tr = lieuTransporteurRepare(tr);
  const trRue = String(tr.lieuRue || '').trim();
  const trCp = /^\d{5}$/.test(String(tr.lieuCp || '')) ? String(tr.lieuCp) : '';
  const trVille = String(tr.lieuVille || '').trim();
  if (!RUE.test(trRue) || (!trCp && trVille.length < 2)) return base;
  const e = decouperAdresse(base.lieuAdresse);
  const eRue = RUE.test(String(e.rue || '').trim()) ? String(e.rue).trim() : '';
  const conflit = (quoi) => ({ ...base, lieuConflit: { quoi, email: [eRue, [e.cp, e.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '), transporteur: [trRue, [trCp, trVille].filter(Boolean).join(' ')].filter(Boolean).join(', '), carrier: String(tr.carrier || '') } });
  if (eRue && normRue(eRue) !== normRue(trRue)) return conflit('rue');
  if (e.cp && trCp && e.cp !== trCp) return conflit('cp');
  if (e.ville && trVille && normNomRelais(e.ville) !== normNomRelais(trVille)) return conflit('ville');
  const cp = e.cp || trCp, ville = e.ville || trVille, rue = eRue || trRue;
  if (cp === e.cp && ville === e.ville && rue === eRue) return base;   // rien à ajouter
  return { lieuNom: base.lieuNom || String(tr.lieuNom || ''), lieuAdresse: `${rue}, ${[cp, ville].filter(Boolean).join(' ')}`, lieuComplete: 'transporteur' };
}

// ── LE REPÈRE DONNÉ PAR VINTED LUI-MÊME (1er nov.) ──────────────────────────
// La liste des points relais que l'extension relève chez Vinted
// (`harvest_{uid}_pickup_points` → nom, adresse, latitude, longitude) porte la
// position EXACTE du point. On la prend pour un point de la colonne seulement
// par identité : le MÊME nom propre ET le même code postal (ou, sans code
// postal lu, la même rue). Plusieurs positions possibles ⇒ rien (on ne choisit
// pas). Jamais le nom seul : « Carrefour City » existe dans chaque ville.
// (1er nov., « plus fiable ») Le nom est comparé SANS accents, majuscules,
// espaces ni ponctuation, et sans le type de lieu (« TABA'VAP » = « Tabavap »,
// « Relais Pickup TERRA CBD » = « Terra Cbd ») ; et la MÊME ADRESSE (même rue
// avec son numéro, même code postal) désigne le même endroit même quand Vinted
// écrit le nom autrement (« SARL TABAVAP ») — une adresse est une identité de
// lieu, pas une ressemblance. Plusieurs positions à cette adresse ⇒ rien.
const posValide = (q) => {
  if (!q || q.lat === '' || q.lon === '' || q.lat == null || q.lon == null) return false;
  const lat = Number(q.lat), lon = Number(q.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && !(!lat && !lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
};
const unePosition = (bons) => {
  const pos = [...new Set(bons.map((q) => `${Number(q.lat).toFixed(4)},${Number(q.lon).toFixed(4)}`))];
  return pos.length;
};
export function repereDepuisPointsVinted(p, liste) {
  if (!p || p.inconnu || !Array.isArray(liste)) return null;
  const sortie = (q, par) => { const a = decouperAdresse(q.adresse); return { lat: Number(q.lat), lon: Number(q.lon), rue: a.rue, cp: a.cp, ville: a.ville, source: 'vinted', par }; };
  if (p.nom) {
    const n = normNomRelais(p.nom);
    const bons = liste.filter((q) => {
      if (!posValide(q) || normNomRelais(nomRelaisPropre(q.nom)) !== n) return false;
      const a = decouperAdresse(q.adresse);
      if (p.cp) return a.cp === p.cp;
      return !!(p.rue && a.rue && normNomRelais(a.rue) === normNomRelais(p.rue));
    });
    const k = unePosition(bons);
    if (k === 1) return sortie(bons[0], 'nom');
    if (k > 1) return { plusieurs: true };
  }
  if (p.rue && p.cp && RUE.test(String(p.rue))) {
    const r = normNomRelais(p.rue);
    const bons = liste.filter((q) => { if (!posValide(q)) return false; const a = decouperAdresse(q.adresse); return a.cp === p.cp && !!a.rue && normNomRelais(a.rue) === r; });
    const k = unePosition(bons);
    if (k === 1) return sortie(bons[0], 'adresse');
    if (k > 1) return { plusieurs: true };
  }
  return null;
}

// Le NOMBRE d'une épingle (1er nov., Julien : « il doit y avoir UN point par
// relais avec le NOMBRE de colis ») : les colis à y RETIRER (ceux du compte de
// Ma journée, `vrm_colis_retirer`) ; un point sans colis compté porte ses « à
// vérifier », sinon ses colis en route. La ligne du point dit CE nombre, de la
// même fonction (une seule source).
export function nombreEpingle(p) {
  if (!p) return { n: 0, sorte: 'aretirer' };
  const hors = (p.arrives || []).filter((c) => c.horsCompte).length;
  if (p.nComptes > 0) return { n: p.nComptes, sorte: 'aretirer' };
  if (hors > 0) return { n: hors, sorte: 'averifier' };
  return { n: p.nAttendus || 0, sorte: 'enroute' };
}

// ── LA COLONNE « À RETIRER », PAR POINT (1er nov.) ──────────────────────────
// Julien : « je crois qu'il n'y a pas tous les points relais, il ne doit pas y
// avoir d'erreur et ça doit être un peu plus clair ». Chaque colis de la colonne
// (ceux que `pickupUnion` compte, et ses « à vérifier » marqués `horsCompte`)
// tombe sous SON point, ou sous « Point pas encore connu » avec sa raison —
// jamais écarté. Les points reçoivent un rang (`numero`, l'ordre de la liste),
// le nombre de leur épingle (`nombreEpingle`) et, s'ils ne peuvent pas être sur
// la carte, la raison en clair.
export function pointsARetirer({ colis = [], attendus = [], pointsVinted = [] } = {}) {
  const groupes = regrouperRelais({ arrives: colis, attendus });
  let numero = 0;
  const points = groupes.map((g) => {
    if (g.inconnu) return { ...g, numero: null, repere: null, sansCarte: null, epingle: nombreEpingle(g) };
    let x = { ...g };
    // (1er nov.) Deux adresses pour un colis de ce point (l'e-mail et le suivi du
    // transporteur, même n°) : AUCUNE n'est mise sur la carte, et c'est dit.
    const conflit = (g.arrives || []).map((c) => c.lieuConflit).find(Boolean) || null;
    if (conflit) x.geocode = null;
    const lu = conflit ? null : repereDepuisPointsVinted(g, pointsVinted);
    const rv = lu && lu.lat != null ? lu : null;
    if (rv) {
      const rue = x.rue || lisible(rv.rue), cp = x.cp || rv.cp, ville = x.ville || lisible(rv.ville);
      x = { ...x, rue, cp, ville, adresse: [rue, [cp, ville].filter(Boolean).join(' ')].filter(Boolean).join(', '), adresseCourte: [rue, ville].filter(Boolean).join(', ') || cp, geocode: adresseGeocodable({ rue, cp, ville }) };
    }
    numero++;
    // Une consigne Vinted Go dont le suivi n'a pas encore donné l'adresse : dit, avec le geste.
    const vgPasLu = (x.transporteurs || []).includes('vinted') && !(x.arrives || []).some((c) => c.lieuComplete);
    let sansCarte = rv ? null
      : !x.rue ? (x.cp || x.ville ? 'le message donne la ville du point mais pas sa rue' : 'le message ne donne pas l’adresse du point')
      : !x.geocode ? 'le message donne la rue du point mais ni son code postal ni sa ville'
      : null;
    let sansCarteCode = sansCarte ? 'adresse' : '';
    if (conflit) {
      sansCarte = `deux adresses pour ce colis (e-mail : ${conflit.email || '—'} ; suivi ${conflit.carrier === 'vinted' ? 'Vinted Go' : 'du transporteur'} : ${conflit.transporteur}) : aucune n’est choisie`;
      sansCarteCode = 'deux-adresses';
    } else if (sansCarte && vgPasLu && x.rue && !x.geocode) {
      sansCarte += ' — le suivi Vinted Go de ce colis ne l’a pas encore donné : VRM le relit tout seul ; sinon ouvre le suivi Vinted Go du colis une fois dans le navigateur où est l’extension VRM';
      sansCarteCode = 'vintedgo-pas-lu';
    }
    return { ...x, numero, repere: rv ? { lat: rv.lat, lon: rv.lon, source: 'vinted' } : null, sansCarte, sansCarteCode, vintedPlusieurs: !!(lu && lu.plusieurs), epingle: nombreEpingle(x) };
  });
  const nComptes = points.reduce((t, p) => t + p.nComptes, 0);
  const nHors = points.reduce((t, p) => t + p.arrives.filter((c) => c.horsCompte).length, 0);
  return { points, nComptes, nHors, nAttendus: points.reduce((t, p) => t + p.nAttendus, 0) };
}

// ── LA BASE ADRESSE NATIONALE : un repère SÛR, ou la raison (1er nov.) ──────
// Un résultat n'est GARDÉ que s'il est sûr : une adresse (numéro ou rue, jamais
// une commune ni un lieu-dit), un score suffisant, et
//   · mode « code postal » : le MÊME code postal que celui lu ;
//   · mode « ville » (rue + ville lues, sans code postal) : la MÊME ville, et un
//     score plus haut (0,7) ;
//   · mode « texte » (la ville collée à la rue) : SA ville termine le texte et
//     SON adresse (« 29 Rue Hoche ») en est tout le début, mot pour mot.
// Et il doit être SEUL : deux résultats qui passent ces filtres à plus de 80 m
// l'un de l'autre, avec des scores proches ⇒ plusieurs endroits possibles ⇒
// rien (on ne choisit pas), et c'est dit.
// Rend { lat, lon } ou { echec: 'introuvable' | 'incertain' | 'ville' | 'ambigu' }.
const metres = (a, b) => {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};
export function jugerBan(json, attendu = {}) {
  const cp = /^\d{5}$/.test(String(attendu.cp || '')) ? String(attendu.cp) : '';
  const ville = cp ? '' : String(attendu.ville || '').trim();
  const texte = !cp && !ville && attendu.texte ? normNomRelais(attendu.texte) : '';
  const seuil = cp ? 0.6 : 0.7;
  const feats = json && Array.isArray(json.features) ? json.features : [];
  if (!feats.length) return { echec: 'introuvable' };
  let raison = 'introuvable';
  const bons = [];
  for (const f of feats) {
    if (!f || !f.geometry || !Array.isArray(f.geometry.coordinates)) continue;
    const pr = f.properties || {};
    const [lon, lat] = f.geometry.coordinates.map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (pr.type && !/^(housenumber|street)$/.test(String(pr.type))) { if (raison === 'introuvable') raison = 'incertain'; continue; }
    if (!(Number(pr.score) >= seuil)) { if (raison === 'introuvable') raison = 'incertain'; continue; }
    if (cp && String(pr.postcode || '') !== cp) { raison = 'ville'; continue; }
    if (ville && normNomRelais(pr.city) !== normNomRelais(ville)) { raison = 'ville'; continue; }
    if (texte) {
      const c = normNomRelais(pr.city), nm = normNomRelais(pr.name);
      if (!c || c.length < 3 || !texte.endsWith(c) || texte.slice(0, texte.length - c.length) !== nm) { raison = 'ville'; continue; }
    }
    if (!cp && !ville && !texte) { /* aucun contrôle de lieu possible */ raison = 'ville'; continue; }
    bons.push({ lat, lon, score: Number(pr.score), type: String(pr.type || ''), ville: String(pr.city || ''), cpTrouve: String(pr.postcode || '') });
  }
  if (!bons.length) return { echec: raison };
  const numeros = bons.filter((b) => b.type === 'housenumber');
  const parmi = (numeros.length ? numeros : bons).sort((a, b) => b.score - a.score);
  const tete = parmi[0];
  if (parmi.some((b) => b !== tete && b.score >= tete.score - 0.1 && metres(b, tete) > 80)) return { echec: 'ambigu' };
  // (3 nov.) La ville et le code postal du résultat SÛR (pour nommer la ville d'un point qui n'a
  // que son code postal — `villeDuPoint`, src/villeRelais.js, au même code postal seulement).
  return { lat: tete.lat, lon: tete.lon, ville: tete.ville, cp: tete.cpTrouve };
}
// L'ancienne forme (un repère ou `null`), gardée pour ceux qui ne veulent pas la raison.
export function repereDepuisBan(json, cpAttendu) {
  const r = jugerBan(json, { cp: cpAttendu });
  return r && r.lat != null ? { lat: r.lat, lon: r.lon } : null;
}

// (1er nov.) LES REQUÊTES À LA BASE ADRESSE NATIONALE, dans l'ordre : l'adresse
// complète filtrée par son code postal ; puis la rue + la ville seules (un code
// postal mal relié à la ville dans la base) — le résultat devant TOUJOURS
// porter le code postal lu. Sans code postal : rue + ville (la ville exigée), ou
// le texte lu tel quel (mode « texte »). Rien à chercher sans rue. Chaque
// requête porte ce que `jugerBan` doit vérifier (`attendu`).
export function requetesBan(p) {
  const g = adresseGeocodable(p);
  if (!g) return [];
  const cp = /^\d{5}$/.test(String(p.cp || '')) ? String(p.cp) : '';
  const ville = String(p.ville || '').trim();
  if (cp) {
    const q = [{ q: g, postcode: cp, attendu: { cp } }];
    if (ville) q.push({ q: `${String(p.rue).trim()}, ${ville}`, postcode: '', attendu: { cp } });
    return q;
  }
  if (ville.length >= 2) return [{ q: g, postcode: '', attendu: { ville } }];
  return [{ q: g, postcode: '', attendu: { texte: g } }];
}

// La raison, en français simple, pour laquelle la Base Adresse n'a pas placé un point.
export const RAISONS_BAN = {
  introuvable: 'adresse introuvable sur la carte',
  incertain: 'l’adresse n’a pas été reconnue avec assez de certitude',
  ville: 'la ville trouvée n’est pas celle du message (ou la ville n’est pas écrite) : rien n’est deviné',
  ambigu: 'plusieurs endroits possibles pour cette adresse : aucun n’est choisi',
};
