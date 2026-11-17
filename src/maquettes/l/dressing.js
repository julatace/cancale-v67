// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE L — « LE DRESSING » (17 nov., proposition pour Julien, PAS livrée)
//
//  Tout se voit par la PHOTO de la paire. Chaque paire (ou achat pas encore numéroté)
//  reçoit UN état calculé, jamais posé à la main, jamais deviné :
//    envoyer · retirer · numeroter · publier · verifier · enligne · vendue · enroute · payee
//  Les filtres du haut regroupent ces états en quatre mots : À faire · En ligne · Vendues · Achats.
//  « Payée » ne va pas dans le dressing : elle va dans Argent (date de VERSEMENT, transaction 450).
//
//  L'identité (CLAUDE.md §5) : une paire = une fiche N° (`vinted_annonce_numeros`, par l'id de SON
//  annonce) ; sa vente par l'`item_id` ; son bordereau par le n° de transaction ; son achat par
//  `buyFromId` (posé par SON clic) ; le code de retrait d'un achat par le n° de transaction de
//  l'achat (ligne publiée `vrm_colis_retirer`, forme de `ligneRetrait`, src/journeeHorsLigne.js).
//  Jamais par titre, jamais par ressemblance.
//
//  Le QR n'est JAMAIS fabriqué (App.jsx : générateur retiré à dessein, un QR fait depuis le n° de
//  suivi ne passe pas au comptoir) : seulement l'image d'un vrai QR (Chronopost, Vinted Go, ou sa
//  capture) ; sinon le code, en grand.
//
//  Règles RECOPIÉES d'App.jsx (non exportées), comme la maquette G : PAS_UNE_VENTE,
//  COLIS_DEJA_BOUGE, venteQuiRevient, venteVivante, « en ligne » = dressing lu < 24 h. Si L est
//  retenue, elles sortent d'App.jsx dans un module partagé — jamais une 2e version.
//  Module PUR : `construire(src, maintenant)`.
// ════════════════════════════════════════════════════════════════════════════

const J = 86400000;
const str = (v) => String(v == null ? '' : v).trim();

export const PAS_UNE_VENTE = /annul|cancel|refus|rembours|retour|suspend|[ée]chou|[ée]chec\s+du\s+paiement/i;
export const COLIS_DEJA_BOUGE = /d[ée]pos[ée]|exp[ée]di[ée]|achemin|transit|livr[ée]e?\b|non\s+r[ée]clam|r[ée]ceptionn/i;
export const venteQuiRevient = (o) => /non\s+r[ée]clam|retour\s+initi|retour\s+en\s+cours|retour\s+demand/i.test(str(o && o.status));
export function venteVivante(o) {
  if (!o || o.transaction_id == null) return false;
  if (PAS_UNE_VENTE.test(str(o.status))) return false;
  return str(o.transaction_user_status) !== 'failed';
}
const venteProuvee = (o) => venteVivante(o) && !!str(o.status);
const finalisee = (o) => /finalis/i.test(str(o.status)) || str(o.transaction_user_status) === 'completed';
const ACHAT_ARRIVE = /finalis|commande\s+livr|r[ée]cup[ée]r|retir[ée]/i;
const ACHAT_AU_POINT = /point\s+relais|disponible|[àa]\s+retirer|au\s+point/i;
export const cleNum = (v) => { let s = str(v).toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
export const centimes = (p) => {
  if (p == null) return null;
  const v = typeof p === 'object' ? p.amount : p;
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};
const photoDe = (p) => (!p ? '' : typeof p === 'string' ? p : str(p.url));
const uidDe = (id) => { const m = /^harvest_(\d+)_/.exec(str(id)); return m ? m[1] : ''; };

// Les états : le mot du badge (UN par paire), et s'il demande un geste (ambre).
export const ETATS = {
  envoyer: { mot: 'À envoyer', geste: true },
  retirer: { mot: 'À retirer', geste: true },
  verifier: { mot: 'À vérifier', geste: true },
  numeroter: { mot: 'Sans N°', geste: true },
  publier: { mot: 'À publier', geste: true },
  enligne: { mot: 'En ligne', geste: false },
  vendue: { mot: 'Vendue', geste: false },
  enroute: { mot: 'En route', geste: false },
};
// Les filtres du haut, en mots simples ; l'ordre des états à l'intérieur = l'ordre des gestes.
export const FILTRES = [
  { cle: 'afaire', mot: 'À faire', etats: ['envoyer', 'retirer', 'verifier', 'numeroter', 'publier'] },
  { cle: 'enligne', mot: 'En ligne', etats: ['enligne'] },
  { cle: 'vendues', mot: 'Vendues', etats: ['vendue'] },
];
// (Julien, 16 nov.) Achats a SON onglet dans la barre du bas : il n'est plus un filtre du Dressing.
export const ACHATS = ['retirer', 'enroute', 'numeroter'];
// La taille va sur la ligne du N° (un titre ne se coupe jamais sur deux lignes).
export const separerTaille = (t) => { const m = /^(.*?)[\s,]+taille\s+(\d{2}(?:[.,]5)?)\s*$/i.exec(str(t)); return m ? { titre: m[1], taille: m[2] } : { titre: str(t), taille: null }; };

export function construire(src, maintenant = Date.now()) {
  const comptes = (src.comptes || []).map((a) => ({ uid: str(a.vinted_user_id), login: str(a.login) }));
  const loginDe = (uid) => (comptes.find((a) => a.uid === str(uid)) || {}).login || '';
  const main = src.main || {};
  const nums = main.nums || {};
  const couts = main.couts || {};

  const items = new Map();
  for (const r of src.listings || []) {
    const lu = Date.parse(r.lu || '') || null;
    for (const it of Array.isArray(r.items) ? r.items : []) items.set(str(it.id), { ...it, _uid: uidDe(r.id), _lu: lu });
  }
  const ventes = []; for (const r of src.vendues || []) for (const o of Array.isArray(r.o) ? r.o : []) ventes.push({ ...o, _uid: uidDe(r.id) });
  const achats = []; for (const r of src.achetees || []) for (const o of Array.isArray(r.o) ? r.o : []) achats.push({ ...o, _uid: uidDe(r.id) });
  const bordParTx = new Map(); for (const b of src.bords || []) if (b.tx) bordParTx.set(str(b.tx), b);
  const verseParTx = new Map(); for (const t of src.txns || []) if (str(t.st) === '450' && t.at) verseParTx.set(str(t.tx), t.at);
  // Codes de retrait : par le n° de transaction de l'ACHAT seulement (identité).
  const retraitParTx = new Map();
  for (const c of (src.retirer && Array.isArray(src.retirer.colis) ? src.retirer.colis : [])) if (str(c.tx)) retraitParTx.set(str(c.tx), c);
  const venteParItem = new Map();
  for (const v of ventes) {
    if (!str(v.status)) continue; // une conversation n'est pas une vente
    const k = str(v.item_id); const d = venteParItem.get(k);
    if (!d || (Date.parse(v.date) || 0) > (Date.parse(d.date) || 0)) venteParItem.set(k, v);
  }

  const paires = [];
  const payees = [];
  const p = (base) => ({ detail: '', doublon: false, ...base, ...separerTaille(base.titre), urgent: !!(base.limite && base.limite - maintenant <= 2 * J) });
  const fiches = Object.entries(nums).map(([id, f]) => ({ id: str(id), f: f || {}, n: str(f && (f.numero || f.num)) })).filter((x) => x.n);
  const relies = new Set(fiches.map((x) => str(x.f.buyFromId)).filter(Boolean));
  const achatParTx = new Map(achats.map((o) => [str(o.transaction_id), o]));

  for (const { id, f, n } of fiches) {
    const a = items.get(id) || null;
    const v = venteParItem.get(id) || null;
    const achat = f.buyFromId ? achatParTx.get(str(f.buyFromId)) : null;
    const cout = centimes(f.buyPrice != null ? f.buyPrice : couts[n] != null ? couts[n] : achat ? achat.price : null);
    const base = { cle: 'p' + id, numero: n, titre: str((v && v.title) || (a && a.title) || f.title), photo: photoDe((a && a.photo) || (v && v.photo) || f.photo),
      compte: loginDe((v && v._uid) || (a && a._uid) || f.accountId), cout, vinted: id };
    if (v && venteQuiRevient(v)) {
      paires.push(p({ ...base, etat: 'verifier', prix: centimes(v.price), detail: 'Le colis revient', raison: 'Le colis te revient : regarde qu’il arrive.', geste: 'Voir le suivi' }));
    } else if (v && venteProuvee(v)) {
      const prix = centimes(v.price);
      if (finalisee(v)) {
        payees.push({ ...base, ...separerTaille(base.titre), prix, verse: verseParTx.get(str(v.transaction_id)) || null, vendueLe: v.date });
      } else if (str(v.transaction_user_status) === 'needs_action' && !COLIS_DEJA_BOUGE.test(str(v.status))) {
        const b = bordParTx.get(str(v.transaction_id));
        if (b) {
          const lim = Date.parse(b.limite || '') || null;
          paires.push(p({ ...base, etat: 'envoyer', prix, limite: lim, suivi: str(b.suivi) || null, detail: lim ? avantLe(lim, maintenant) : 'date pas lue', geste: 'Imprimer le bordereau', vendueLe: v.date }));
        } else paires.push(p({ ...base, etat: 'vendue', prix, date: v.date, detail: 'bordereau attendu', vendueLe: v.date }));
      } else paires.push(p({ ...base, etat: 'vendue', prix, date: v.date, detail: 'en route', geste: 'Voir le suivi', vendueLe: v.date }));
    } else if (!a) {
      paires.push(p({ ...base, etat: 'verifier', detail: 'annonce pas lue', raison: 'Cette annonce n’est dans aucune lecture du dressing.', geste: 'Ouvrir sur Vinted' }));
    } else if (a.is_draft) {
      paires.push(p({ ...base, etat: 'publier', prix: centimes(a.price), detail: 'brouillon', geste: 'Publier sur Vinted' }));
    } else if (a.is_closed) {
      paires.push(p({ ...base, etat: 'verifier', prix: centimes(a.price), detail: 'fermée', raison: v && !venteVivante(v) ? 'Vente annulée : la paire est-elle revenue ?' : 'Fermée sur Vinted, aucune vente lue.', geste: 'Vérifier' }));
    } else if (a.is_hidden) {
      paires.push(p({ ...base, etat: 'verifier', prix: centimes(a.price), detail: 'masquée', raison: 'Masquée par Vinted : toujours chez toi, plus visible.', geste: 'Ouvrir sur Vinted' }));
    } else if (!a._lu || maintenant - a._lu > J) {
      const j = a._lu ? Math.max(1, Math.round((maintenant - a._lu) / J)) : null;
      paires.push(p({ ...base, etat: 'verifier', prix: centimes(a.price), detail: j ? `lue il y a ${j} j` : 'pas lue', raison: 'Le dressing de ce compte n’a pas été relu depuis plus de 24 h : en ligne, pas prouvé.', geste: 'Relire le dressing' }));
    } else {
      const cree = Number(a.created_at_ts) ? Number(a.created_at_ts) * 1000 : Date.parse(a.created_at_ts || '');
      const jours = cree ? Math.max(0, Math.round((maintenant - cree) / J)) : null;
      paires.push(p({ ...base, etat: 'enligne', prix: centimes(a.price), jours, favoris: Number(a.favourite_count) || 0, vues: Number(a.view_count) || 0,
        detail: jours != null ? `${jours} j` : '', geste: 'Baisser le prix' }));
    }
  }
  // Deux paires PRÉSENTES sous le même N° : le seul rouge (§5, §7).
  const presentes = new Set(['envoyer', 'verifier', 'publier', 'enligne']);
  const parK = new Map(); for (const x of paires) if (presentes.has(x.etat)) { const k = cleNum(x.numero); parK.set(k, (parK.get(k) || 0) + 1); }
  for (const x of paires) if (presentes.has(x.etat) && parK.get(cleNum(x.numero)) > 1) {
    Object.assign(x, { doublon: true, etatAvant: x.etat, etat: 'verifier', detail: 'deux sous ce N°', raison: `Deux paires présentes sous le N° ${x.numero}. Regarde les deux cartons.`, geste: 'Régler le N°' });
  }

  // Les ACHATS reliés à aucune paire (par leur n° de transaction).
  for (const o of achats) {
    if (!venteVivante(o) || relies.has(str(o.transaction_id))) continue;
    const s = str(o.status);
    const base = { cle: 'a' + o.transaction_id, numero: null, titre: str(o.title), photo: photoDe(o.photo), compte: loginDe(o._uid), prix: centimes(o.price), achat: true, tx: str(o.transaction_id), date: o.date };
    if (!ACHAT_ARRIVE.test(s)) {
      if (ACHAT_AU_POINT.test(s)) {
        const r = retraitParTx.get(str(o.transaction_id)) || null;
        const lim = r && Date.parse(r.limite || '') ? Date.parse(r.limite) : null;
        paires.push(p({ ...base, etat: 'retirer', retrait: r, limite: lim, detail: lim ? avantLe(lim, maintenant) : 'au point relais', geste: 'J’ai retiré le colis' }));
      } else paires.push(p({ ...base, etat: 'enroute', detail: s.toLowerCase().includes('transit') ? 'en transit' : 'envoyé', geste: 'Voir le suivi' }));
    } else if (maintenant - (Date.parse(o.date) || 0) < 30 * J) {
      paires.push(p({ ...base, etat: 'numeroter', detail: 'arrivée ' + jour(o.date, maintenant), geste: 'Donner un N°' }));
    }
  }

  const t = (x) => Date.parse(x || '') || 0;
  const ordre = { envoyer: 0, retirer: 1, verifier: 2, numeroter: 3, publier: 4, vendue: 5, enroute: 6, enligne: 7 };
  paires.sort((a, b) => (ordre[a.etat] - ordre[b.etat])
    || (a.etat === 'envoyer' || a.etat === 'retirer' ? (a.limite || 9e15) - (b.limite || 9e15) : 0)
    || (a.etat === 'verifier' ? Number(b.doublon) - Number(a.doublon) : 0)
    || (a.etat === 'enligne' ? (b.jours || 0) - (a.jours || 0) : 0)
    || t(b.date) - t(a.date));
  payees.sort((a, b) => t(b.verse) - t(a.verse));

  const filtres = FILTRES.map((f) => {
    const l = paires.filter((x) => f.etats.includes(x.etat));
    return { ...f, paires: l, n: l.length, melange: new Set(l.map((x) => x.etat)).size > 1 };
  });
  // Les codes de retrait d'un MÊME point relais : une carte, qu'on fait défiler code par code.
  const parPoint = new Map();
  for (const x of paires.filter((y) => y.etat === 'retirer')) { const k = (x.retrait && x.retrait.lieu) || 'Point pas lu'; if (!parPoint.has(k)) parPoint.set(k, []); parPoint.get(k).push(x); }
  const points = [...parPoint.entries()].map(([lieu, l]) => ({ lieu, colis: l, limite: Math.min(...l.map((x) => x.limite || 9e15)) })).sort((a, b) => a.limite - b.limite);
  const achatsL = paires.filter((x) => ACHATS.includes(x.etat));
  return { paires, filtres, payees, comptes, points, achats: achatsL, argent: argent(paires, payees, ventes, maintenant) };
}

// ── Argent : une liste chiffrée sobre. Vendu (date de vente) ≠ reçu (date de VERSEMENT). ──
function argent(paires, payees, ventes, maintenant) {
  const n = new Date(maintenant);
  const debut = new Date(n.getFullYear(), n.getMonth(), 1).getTime();
  const ceMois = (iso) => { const x = Date.parse(iso || ''); return x && x >= debut && x <= maintenant; };
  const somme = (l, f = (x) => x.prix) => { let s = 0, k = 0; for (const x of l) { const v = f(x); if (v != null) { s += v; k++; } } return { s: k ? s : null, k, sur: l.length }; };
  const vendus = ventes.filter((v) => venteProuvee(v) && !venteQuiRevient(v) && ceMois(v.date));
  const recus = payees.filter((x) => x.verse && ceMois(x.verse));
  const sansDate = payees.filter((x) => !x.verse).length;
  const avecCout = recus.filter((x) => x.cout != null && x.prix != null);
  const benef = avecCout.length ? avecCout.reduce((s, x) => s + x.prix - x.cout, 0) : null;
  const envoyer = paires.filter((x) => x.etat === 'envoyer');
  const enCours = paires.filter((x) => x.etat === 'vendue');
  return {
    mois: n.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' }),
    vendu: somme(vendus, (v) => centimes(v.price)),
    recu: somme(recus),
    benefice: { s: benef, k: avecCout.length, sur: recus.length },
    sansDate,
    aVenir: { envoyer: somme(envoyer), enCours: somme(enCours) },
    derniers: payees.filter((x) => x.verse).slice(0, 6),
  };
}

const avantLe = (ms, maintenant) => { const j = jour(new Date(ms).toISOString(), maintenant); return j === 'aujourd’hui' ? 'aujourd’hui' : 'avant ' + j; };
export function jour(iso, maintenant = Date.now()) {
  const x = Date.parse(iso || ''); if (!x) return '';
  const d = new Date(x), n = new Date(maintenant);
  const j0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const dj = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - j0) / J);
  if (dj === 0) return 'aujourd’hui'; if (dj === -1) return 'hier'; if (dj === 1) return 'demain';
  if (dj > 1 && dj < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' });
  if (dj < -1 && dj > -7) return `il y a ${-dj} j`;
  return 'le ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
}
export const euros = (c) => (c == null ? '—' : (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }).replace(/ | /g, ' ') + ' €');
