// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE G — « LE TABLEAU » (17 nov., proposition pour Julien, PAS livrée)
//
//  Les paires avancent en colonnes d'étapes, comme un tableau Kanban :
//    Achetées · À ranger · En ligne · Vendues · À envoyer · En route · Payées  (+ À vérifier)
//  ⚠️ L'ÉTAPE D'UNE PAIRE EST CALCULÉE, JAMAIS POSÉE À LA MAIN, JAMAIS DEVINÉE.
//  Rien ne se « glisse » d'une colonne à l'autre : une carte change de colonne quand une
//  donnée LUE change (la vente, le bordereau, le suivi, le versement). Ce qu'on ne sait pas
//  dire va dans « À vérifier », avec sa raison — jamais dans la colonne la plus probable.
//
//  L'identité (CLAUDE.md §5) : une paire = une fiche N° (`vinted_annonce_numeros`, par l'id
//  de SON annonce) ; sa vente par l'`item_id` ; son bordereau par le n° de transaction ;
//  son achat par `buyFromId` (posé par SON clic). Jamais par titre, jamais par ressemblance.
//
//  Les règles ci-dessous sont des COPIES des règles de l'app (src/App.jsx, non exportées) :
//  PAS_UNE_VENTE, COLIS_DEJA_BOUGE, venteQuiRevient, venteVivante (<preuve-vente-regle>),
//  « En ligne » = lecture du dressing de moins de 24 h (<enligne-regle>). Si la maquette est
//  retenue, ces règles sortent d'App.jsx dans un module partagé — jamais une 2e version.
//  Module PUR (aucun accès réseau) : `construire(src, maintenant)`.
// ════════════════════════════════════════════════════════════════════════════

const J = 86400000;
const str = (v) => String(v == null ? '' : v).trim();

// ── Copies des règles de l'app (src/App.jsx) ─────────────────────────────────
export const PAS_UNE_VENTE = /annul|cancel|refus|rembours|retour|suspend|[ée]chou|[ée]chec\s+du\s+paiement/i;
export const COLIS_DEJA_BOUGE = /d[ée]pos[ée]|exp[ée]di[ée]|achemin|transit|livr[ée]e?\b|non\s+r[ée]clam|r[ée]ceptionn/i;
export const venteQuiRevient = (o) => /non\s+r[ée]clam|retour\s+initi|retour\s+en\s+cours|retour\s+demand/i.test(str(o && o.status));
export function venteVivante(o) {
  if (!o || o.transaction_id == null) return false;
  if (PAS_UNE_VENTE.test(str(o.status))) return false;
  return str(o.transaction_user_status) !== 'failed';
}
// « Vendue » se PROUVE : un état de commande non vide (une conversation, état vide, n'est pas une vente).
const venteProuvee = (o) => venteVivante(o) && !!str(o.status);
const finalisee = (o) => /finalis/i.test(str(o.status)) || str(o.transaction_user_status) === 'completed';
// Achat : arrivé chez lui ; au point relais (seul le STATUT « au point » compte, jamais `needs_action`).
const ACHAT_ARRIVE = /finalis|commande\s+livr|r[ée]cup[ée]r|retir[ée]/i;
const ACHAT_AU_POINT = /point\s+relais|disponible|[àa]\s+retirer|au\s+point/i;
export const cleNum = (v) => { let s = str(v).toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
export const centimes = (p) => {
  if (p == null) return null;
  const v = typeof p === 'object' ? p.amount : p;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};
const photoDe = (p) => (!p ? '' : typeof p === 'string' ? p : str(p.url));
const uidDe = (id) => { const m = /^harvest_(\d+)_/.exec(str(id)); return m ? m[1] : ''; };

export const COLONNES = [
  { cle: 'achetees', nom: 'Achetées', court: 'Achetées' },
  { cle: 'ranger', nom: 'À ranger', court: 'À ranger' },
  { cle: 'enligne', nom: 'En ligne', court: 'En ligne' },
  { cle: 'vendues', nom: 'Vendues', court: 'Vendues' },
  { cle: 'envoyer', nom: 'À envoyer', court: 'À envoyer' },
  { cle: 'route', nom: 'En route', court: 'En route' },
  { cle: 'payees', nom: 'Payées', court: 'Payées' },
  { cle: 'verifier', nom: 'À vérifier', court: 'À vérifier' },
];
// Le geste EN SÉRIE d'une colonne (le bouton au pouce). `null` : rien à faire, on attend une donnée.
const SERIE = {
  achetees: (c) => { const n = c.filter((x) => x.ambre).length; return n ? { mot: 'Retirer', n } : null; },
  ranger: (c) => (c.length ? { mot: 'Ranger', n: c.length } : null),
  enligne: (c) => { const n = c.filter((x) => x.ambre).length; return n ? { mot: 'Baisser', n, suite: 'prix' } : null; },
  vendues: () => null,
  envoyer: (c) => (c.length ? { mot: 'Imprimer', n: c.length } : null),
  route: () => null,
  payees: () => ({ mot: 'Voir l’argent', lien: true }),
  verifier: (c) => (c.length ? { mot: 'Vérifier', n: c.length } : null),
};
export const ATTENTE = {
  vendues: 'On attend le bordereau de Vinted',
  route: 'Rien à faire : l’acheteur reçoit',
  achetees: 'En route vers toi',
};

export function construire(src, maintenant = Date.now()) {
  const comptes = (src.comptes || []).map((a) => ({ uid: str(a.vinted_user_id), login: str(a.login) }));
  const loginDe = (uid) => (comptes.find((a) => a.uid === str(uid)) || {}).login || '';
  const main = src.main || {};
  const nums = main.nums || null;
  const couts = main.couts || {};
  const caseDe = new Map();
  for (const [cel, l] of Object.entries(main.grille || {})) for (const n of Array.isArray(l) ? l : []) { const k = cleNum(n); if (k && !caseDe.has(k)) caseDe.set(k, cel); }

  // Annonces lues, par id, avec la date de LEUR lecture (la lecture du dressing de leur compte).
  const items = new Map();
  for (const r of src.listings || []) {
    const lu = Date.parse(r.lu || '') || null;
    for (const it of Array.isArray(r.items) ? r.items : []) items.set(str(it.id), { ...it, _uid: uidDe(r.id), _lu: lu });
  }
  const ventes = []; for (const r of src.vendues || []) for (const o of Array.isArray(r.o) ? r.o : []) ventes.push({ ...o, _uid: uidDe(r.id) });
  const achats = []; for (const r of src.achetees || []) for (const o of Array.isArray(r.o) ? r.o : []) achats.push({ ...o, _uid: uidDe(r.id) });
  const bordParTx = new Map(); for (const b of src.bords || []) if (b.tx) bordParTx.set(str(b.tx), b);
  const verseParTx = new Map(); for (const t of src.txns || []) if (str(t.st) === '450' && t.at) verseParTx.set(str(t.tx), t.at);
  const venteParItem = new Map();
  for (const v of ventes) {
    if (!str(v.status)) continue;                     // une conversation n'est pas une vente
    const k = str(v.item_id); const d = venteParItem.get(k);
    if (!d || (Date.parse(v.date) || 0) > (Date.parse(d.date) || 0)) venteParItem.set(k, v);
  }

  const col = Object.fromEntries(COLONNES.map((c) => [c.cle, []]));
  const carte = (base) => ({ ambre: false, doublon: false, geste: null, ...base });

  // ── 1. Les PAIRES (fiches N°) ──
  const fiches = Object.entries(nums || {}).map(([id, f]) => ({ id: str(id), f: f || {}, n: str(f && (f.numero || f.num)) })).filter((x) => x.n);
  const relies = new Set(fiches.map((x) => str(x.f.buyFromId)).filter(Boolean));
  const placees = [];
  for (const { id, f, n } of fiches) {
    const a = items.get(id) || null;
    const v = venteParItem.get(id) || null;
    const base = { cle: 'p' + id, numero: n, titre: str((v && v.title) || (a && a.title) || f.title), photo: photoDe((a && a.photo) || (v && v.photo) || f.photo),
      compte: loginDe((v && v._uid) || (a && a._uid) || f.accountId), cout: centimes(f.buyPrice != null ? f.buyPrice : couts[n]) };
    let ou, c;
    if (v && venteQuiRevient(v)) {
      // « Non réclamée », « retour en cours » : pas une vente pour l'argent, mais un colis qui REVIENT (règle de l'app).
      ou = 'verifier'; c = carte({ ...base, prix: centimes(v.price), sous: 'Le colis te revient : regarde qu’il arrive', geste: { mot: 'Suivi' } });
    } else if (v && venteProuvee(v)) {
      const prix = centimes(v.price);
      if (finalisee(v)) {
        const at = verseParTx.get(str(v.transaction_id)) || null;
        ou = 'payees'; c = carte({ ...base, prix, date: at, sous: at ? 'Versé ' + jour(at, maintenant) : 'Finalisée · date de versement pas lue' });
      } else if (str(v.transaction_user_status) === 'needs_action' && !COLIS_DEJA_BOUGE.test(str(v.status))) {
        const b = bordParTx.get(str(v.transaction_id));
        if (b) {
          const lim = Date.parse(b.limite || '') || null;
          ou = 'envoyer'; c = carte({ ...base, prix, limite: lim, ambre: true, geste: { mot: 'Imprimer' },
            sous: lim ? 'Avant ' + jour(new Date(lim).toISOString(), maintenant) : 'Date limite pas lue' });
        } else { ou = 'vendues'; c = carte({ ...base, prix, date: v.date, sous: 'Vendue ' + jour(v.date, maintenant) + ' · bordereau pas encore reçu' }); }
      } else { ou = 'route'; c = carte({ ...base, prix, date: v.date, sous: str(v.status) || 'Expédiée', geste: { mot: 'Suivi' } }); }
    } else if (!a) {
      ou = 'verifier'; c = carte({ ...base, sous: 'Annonce pas lue dans le dressing', geste: { mot: 'Ouvrir' } });
    } else if (a.is_draft) {
      const cel = caseDe.get(cleNum(n));
      ou = 'ranger'; c = carte({ ...base, prix: centimes(a.price), sous: cel ? `Case ${cel} · pas en ligne` : 'Pas encore de case', geste: { mot: cel ? 'Publier' : 'Ranger' }, ambre: !cel });
    } else if (a.is_closed) {
      ou = 'verifier'; c = carte({ ...base, prix: centimes(a.price), geste: { mot: 'Vérifier' },
        sous: v && !venteVivante(v) ? 'Vente annulée : la paire est-elle revenue ?' : 'Fermée sur Vinted, aucune vente lue' });
    } else if (a.is_hidden) {
      ou = 'verifier'; c = carte({ ...base, prix: centimes(a.price), sous: 'Masquée par Vinted · toujours chez toi', geste: { mot: 'Voir' } });
    } else if (!a._lu || maintenant - a._lu > J) {
      ou = 'verifier'; c = carte({ ...base, prix: centimes(a.price), sous: a._lu ? `Dressing lu il y a ${Math.max(1, Math.round((maintenant - a._lu) / J))} j : en ligne ?` : 'Dressing pas lu : en ligne ?', geste: { mot: 'Relire' } });
    } else {
      const cree = Number(a.created_at_ts) ? Number(a.created_at_ts) * 1000 : Date.parse(a.created_at_ts || '');
      const jours = cree ? Math.max(0, Math.round((maintenant - cree) / J)) : null;
      const dort = jours != null && jours > 60;
      ou = 'enligne'; c = carte({ ...base, prix: centimes(a.price), jours, ambre: dort, geste: dort ? { mot: 'Baisser' } : null,
        sous: [jours != null ? `${jours} j en ligne` : null, ((f) => `${f} favori${f > 1 ? 's' : ''}`)(Number(a.favourite_count) || 0)].filter(Boolean).join(' · ') });
    }
    placees.push({ ou, c, k: cleNum(n) });
  }
  // Deux paires PRÉSENTES sous le même N° : le seul rouge, et la seule place est « À vérifier ».
  const presentes = new Set(['achetees', 'ranger', 'enligne', 'vendues', 'envoyer', 'verifier']);
  const parK = new Map(); for (const p of placees) if (presentes.has(p.ou)) parK.set(p.k, (parK.get(p.k) || 0) + 1);
  for (const p of placees) {
    if (presentes.has(p.ou) && parK.get(p.k) > 1) { p.ou = 'verifier'; p.c = { ...p.c, doublon: true, ambre: false, sous: `Deux paires sous le N° ${p.c.numero} : regarde les cartons`, geste: { mot: 'Régler' } }; }
    col[p.ou].push(p.c);
  }

  // ── 2. Les ACHATS pas encore une paire (reliés à aucune fiche par leur n° de transaction) ──
  let anciens = 0;
  for (const o of achats) {
    if (!venteVivante(o) || relies.has(str(o.transaction_id))) continue;
    const s = str(o.status);
    const base = { cle: 'a' + o.transaction_id, numero: null, titre: str(o.title), photo: photoDe(o.photo), compte: loginDe(o._uid), prix: centimes(o.price), achat: true };
    if (!ACHAT_ARRIVE.test(s)) {
      const auPoint = ACHAT_AU_POINT.test(s);
      col.achetees.push(carte({ ...base, date: o.date, ambre: auPoint, geste: { mot: auPoint ? 'Retirer' : 'Suivi' }, sous: auPoint ? 'Au point relais' : 'En route vers toi' }));
    } else if (maintenant - (Date.parse(o.date) || 0) < 30 * J) {
      col.ranger.push(carte({ ...base, date: o.date, ambre: true, geste: { mot: 'Numéroter' }, sous: 'Arrivée · pas encore de N°' }));
    } else anciens++;
  }
  if (anciens) col.verifier.push(carte({ cle: 'anciens', numero: null, titre: `${anciens} anciens achats`, sous: 'Reliés à aucune paire : à relier par ton clic', geste: { mot: 'Relier' }, groupe: true }));

  // ── Ordre dans chaque colonne : ce qui demande un geste d'abord ──
  const t = (x) => Date.parse(x || '') || 0;
  col.envoyer.sort((a, b) => (a.limite || 9e15) - (b.limite || 9e15));
  col.achetees.sort((a, b) => Number(b.ambre) - Number(a.ambre) || t(b.date) - t(a.date));
  col.ranger.sort((a, b) => Number(b.ambre) - Number(a.ambre) || t(b.date) - t(a.date));
  col.enligne.sort((a, b) => (b.jours || 0) - (a.jours || 0));
  col.vendues.sort((a, b) => t(a.date) - t(b.date));
  col.route.sort((a, b) => t(a.date) - t(b.date));
  // Payées : les 30 derniers jours (date de VERSEMENT) ; une finalisée sans date lue reste visible, dite.
  const payees = col.payees.filter((c) => !c.date || maintenant - t(c.date) <= 30 * J).sort((a, b) => t(b.date) - t(a.date));
  const payeesAvant = col.payees.length - payees.length;
  col.payees = payees;
  col.verifier.sort((a, b) => Number(b.doublon) - Number(a.doublon));

  const colonnes = COLONNES.map((c) => ({ ...c, cartes: col[c.cle], n: col[c.cle].length, serie: SERIE[c.cle](col[c.cle]), attente: ATTENTE[c.cle] || '' }));
  const somme = (l) => { let s = 0, k = 0; for (const x of l) if (x.prix != null) { s += x.prix; k++; } return { s, k, sur: l.length }; };
  return { colonnes, comptes, payeesAvant, montantPayees: somme(payees), montantEnvoyer: somme(col.envoyer), nPaires: fiches.length };
}

export function jour(iso, maintenant = Date.now()) {
  const x = Date.parse(iso || ''); if (!x) return '';
  const d = new Date(x), n = new Date(maintenant);
  const j0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const dj = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - j0) / J);
  if (dj === 0) return 'aujourd’hui'; if (dj === -1) return 'hier'; if (dj === 1) return 'demain';
  if (dj > 1 && dj < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' });
  return 'le ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
}
export const euros = (c) => (c == null ? '—' : (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }) + ' €');
