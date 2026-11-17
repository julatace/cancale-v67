// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE F — « LA PAIRE AU CENTRE » (17 nov., proposition pour Julien, PAS livrée)
//
//  Ce module lit les MÊMES lignes que l'app (Supabase `app_data`, projections scalaires,
//  pagination par `Range`) et en fait un modèle tourné vers la PAIRE :
//    une paire = un N° (`vinted_annonce_numeros`, par l'id de SON annonce) ; sa vente par
//    l'`item_id` de la commande ; son bordereau par le n° de transaction ; son achat par
//    `buyFromId` (posé par SON clic) ; sa case par le plan de rangement ; son coût saisi
//    par lui. Jamais par titre, jamais par ressemblance (§5) : le titre ne sert qu'à
//    PROPOSER dans la recherche (moteur de l'app, src/rechercheUnique.js).
//  Trois états partout : `undefined` en cours · `null` pas su · valeur lue.
//  Monté seulement derrière un réglage de BANC (`vrm_banc_maquette` = 'f', src/main.jsx).
// ════════════════════════════════════════════════════════════════════════════
import { cleNumero, centimes, alnum, normaliser, indexMemo, chercherPartout, reconnaitreRequete, estIdentiteExacte } from '../../rechercheUnique.js';

const SUPABASE_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';
const str = (v) => String(v == null ? '' : v);
const J = 86400000;

function session() { try { return JSON.parse(localStorage.getItem('vrm_session') || 'null'); } catch (_) { return null; } }

// Supabase plafonne une réponse à 1 000 lignes sans le dire (§4.5) : on pagine par `Range`.
async function lireTout(chemin) {
  const s = session(); if (!s || !s.access_token) return null;
  const out = [];
  for (let de = 0; de < 20000; de += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`, Range: `${de}-${de + 999}`, 'Range-Unit': 'items' } });
    if (!r.ok) return null;   // une lecture ratée : `null`, jamais `[]`
    const l = await r.json();
    if (!Array.isArray(l)) return null;
    out.push(...l);
    if (l.length < 1000) break;
  }
  return out;
}

export async function lireDonnees() {
  const q = (s) => lireTout(s);
  const [comptes, main, listings, vendues, achetees, bords, suivis, convs] = await Promise.all([
    q('vinted_accounts?select=vinted_user_id,login'),
    q('app_data?select=id,nums:data->vinted_annonce_numeros,couts:data->vinted_buyprice_by_num,grille:data->vinted_garage_grid&id=eq.main'),
    q('app_data?select=id,items:data->payload->items,lu:data->>capturedAt&id=like.harvest_*_listings'),
    q('app_data?select=id,o:data->payload->my_orders&id=like.harvest_*_orders_sold'),
    q('app_data?select=id,o:data->payload->my_orders&id=like.harvest_*_orders_purchased'),
    q('app_data?select=id,tx:data->>transaction,suivi:data->>suivi,limite:data->>dateLimite,recu:data->>receivedAt&id=like.email_bord_*'),
    q('app_data?select=id,carrier:data->>carrier,suivi:data->>suivi,tracking:data->>tracking,status:data->>status,code:data->>code,lieu:data->>lieu,limite:data->>limite,art:data->>artTitle,recu:data->>receivedAt&id=like.email_track_*'),
    q('app_data?select=id,c:data->payload->conversation&id=like.harvest_*_conv_*'),
  ]);
  return construire({ comptes, main: main && main[0], listings, vendues, achetees, bords, suivis, convs });
}

const uidDe = (id) => { const m = /^harvest_(\d+)_/.exec(str(id)); return m ? m[1] : ''; };
const photoDe = (p) => (!p ? '' : typeof p === 'string' ? p : str(p.url || ''));

// Le modèle. Chaque source peut être `null` (pas lue) : elle le reste, et l'écran le dit.
export function construire(src, maintenant = Date.now()) {
  const comptes = Array.isArray(src.comptes) ? src.comptes.map((a) => ({ uid: str(a.vinted_user_id), login: str(a.login) })) : null;
  const loginDe = (uid) => { const a = (comptes || []).find((x) => x.uid === str(uid)); return a ? a.login : ''; };
  const m = src.main || null;
  const nums = (m && m.nums) || null;
  const couts = (m && m.couts) || {};
  const grille = (m && m.grille) || {};
  const caseDe = new Map();
  for (const [cel, l] of Object.entries(grille)) for (const n of Array.isArray(l) ? l : []) { const k = cleNumero(n); if (k) { if (!caseDe.has(k)) caseDe.set(k, []); caseDe.get(k).push(cel); } }

  // Les annonces (toutes, ouvertes ou fermées), par id ; les ouvertes = « en ligne » (lecture complète).
  const items = new Map(); const annonces = src.listings ? [] : null; let luListings = null;
  for (const r of src.listings || []) {
    const uid = uidDe(r.id);
    if (r.lu && (!luListings || r.lu > luListings)) luListings = r.lu;
    for (const it of Array.isArray(r.items) ? r.items : []) {
      const a = { id: str(it.id), uid, title: str(it.title), brand: str(it.brand_title), size: str(it.size_title), etat: str(it.status), price: it.price, photo: photoDe(it.photo),
        ouverte: !it.is_closed && !it.is_draft, masquee: !!it.is_hidden, fav: Number(it.favourite_count) || 0, vues: Number(it.view_count) || 0, cree: str(it.created_at_ts) };
      items.set(a.id, a);
      if (a.ouverte && !a.masquee) annonces.push(a);
    }
  }
  const lesVentes = src.vendues ? [] : null, lesAchats = src.achetees ? [] : null;
  for (const r of src.vendues || []) for (const o of Array.isArray(r.o) ? r.o : []) lesVentes.push({ ...o, _uid: uidDe(r.id), _tx: str(o.transaction_id), _item: str(o.item_id || '') });
  for (const r of src.achetees || []) for (const o of Array.isArray(r.o) ? r.o : []) lesAchats.push({ ...o, _uid: uidDe(r.id), _tx: str(o.transaction_id) });
  const achatParTx = new Map((lesAchats || []).map((a) => [a._tx, a]));
  const bordParTx = new Map();
  for (const b of src.bords || []) if (b.tx) bordParTx.set(str(b.tx), { tx: str(b.tx), suivi: str(b.suivi), limite: str(b.limite), recu: str(b.recu) });
  const colis = src.suivis ? src.suivis.map((c) => ({ id: str(c.id), suivi: str(c.suivi || c.tracking), code: str(c.code), lieu: str(c.lieu), art: str(c.art), status: str(c.status), carrier: str(c.carrier), at: str(c.recu), limite: str(c.limite), sens: 'entrant' })) : null;

  // Conversations : l'interlocuteur et SA transaction (le seul lien vers une vente) ; la dernière offre.
  const messages = src.convs ? [] : null; const pseudos = []; const offres = src.convs ? [] : null;
  for (const r of src.convs || []) {
    const c = r.c; if (!c) continue;
    const uid = uidDe(r.id); const t = c.transaction || {};
    const pseudo = str(c.opposite_user && c.opposite_user.login);
    const msgs = Array.isArray(c.messages) ? c.messages : [];
    const der = msgs[msgs.length - 1] || null;
    const date = str((der && der.created_at_ts) || '');
    messages.push({ uid, conv: str(c.id), tx: str(t.id || ''), titre: str(t.item_title || ''), pseudo, date, photo: t.item_photo || null, item: str(t.item_id || '') });
    if (t.id && pseudo) pseudos.push({ tx: str(t.id), pseudo });
    if (der && der.entity_type === 'offer_request_message' && der.entity && Number(der.entity.status) === 10) {
      offres.push({ uid, conv: str(c.id), pseudo, item: str(t.item_id || ''), titre: str(t.item_title || ''), montant: centimes(der.entity.price), date, photo: photoDe(t.item_photo) });
    }
  }
  const pseudoParTx = new Map(pseudos.map((p) => [p.tx, p.pseudo]));

  // LES PAIRES — une par N° (cleNum). Une annonce rejoint un N° par SON id (la fiche) ; jamais par titre.
  const paires = new Map(); const numParItem = new Map(); const numerosTx = {};
  const fiches = nums ? {} : null;
  for (const [id, f] of Object.entries(nums || {})) {
    const numero = str(f && (f.numero || f.num)).trim(); if (!numero) continue;
    const k = cleNumero(numero); const a = items.get(str(id)) || null;
    fiches[id] = { numero, title: str(f.title || (a && a.title)), photo: f.photo || (a && a.photo) || '', price: a && a.price, buyPrice: f.buyPrice, accountId: str(f.accountId || (a && a.uid) || ''), brand: a && a.brand, size: a && a.size };
    numParItem.set(str(id), k);
    let p = paires.get(k);
    if (!p) { p = { k, numero, ids: [], fiche: f, annonces: [], ventes: [], cases: caseDe.get(k) || [] }; paires.set(k, p); }
    p.ids.push(str(id)); if (a) p.annonces.push(a);
    if (f && f.buyFromId && !p.fiche.buyFromId) p.fiche = f;
  }
  for (const v of lesVentes || []) { const k = numParItem.get(v._item); if (!k) continue; paires.get(k).ventes.push(v); numerosTx[v._tx] = paires.get(k).numero; }

  for (const p of paires.values()) completerPaire(p, { couts, achatParTx, bordParTx, pseudoParTx, loginDe, maintenant, ventesLues: !!lesVentes });

  // LES LISTES ENREGISTRÉES — chacune une règle, un compte vrai (ou `null` si sa source n'est pas lue).
  const ventesAEnvoyer = lesVentes ? lesVentes.filter((v) => str(v.transaction_user_status) === 'needs_action') : null;
  const envoyer = ventesAEnvoyer ? ventesAEnvoyer.map((v) => {
    const k = numParItem.get(v._item); const b = bordParTx.get(v._tx) || null;
    const lim = b && b.limite ? Date.parse(b.limite) : null;
    const est = !lim && v.date ? Date.parse(v.date) + 7 * J : null;   // vente + 7 j : une ESTIMATION (un plancher)
    return { cle: 'v' + v._tx, v, paire: k ? paires.get(k) : null, bord: b, limite: lim, estimee: est, pseudo: pseudoParTx.get(v._tx) || '', compte: loginDe(v._uid) };
  }).sort((a, b) => ((a.limite || a.estimee || 9e15) - (b.limite || b.estimee || 9e15))) : null;
  const retirer = colis ? colis.filter((c) => c.status === 'available').sort((a, b) => (Date.parse(a.limite) || 9e15) - (Date.parse(b.limite) || 9e15)) : null;
  const dorment = annonces ? annonces.filter((a) => a.cree && maintenant - Date.parse(a.cree) > 60 * J) : null;
  const listes = {
    envoyer: { cle: 'envoyer', nom: 'À envoyer', n: envoyer ? envoyer.length : null, lignes: envoyer, geste: true },
    retirer: { cle: 'retirer', nom: 'À retirer', n: retirer ? retirer.length : null, lignes: retirer, geste: true },
    offres: { cle: 'offres', nom: 'Offres', n: offres ? offres.length : null, lignes: offres },
    enligne: { cle: 'enligne', nom: 'En ligne', n: annonces ? annonces.length : null, lignes: annonces },
    dorment: { cle: 'dorment', nom: 'Qui dorment', n: dorment ? dorment.length : null, lignes: dorment },
  };

  // L'index de la recherche : le MOTEUR DE L'APP (src/rechercheUnique.js), mêmes sources.
  const stock = [...caseDe.entries()].flatMap(([k, cs]) => cs.map((c) => ({ numero: k, lieu: 'case ' + c })));
  const sources = { ventes: lesVentes, achats: lesAchats, pseudos, bordereaux: [...bordParTx.values()], colis, fiches, annonces: annonces && annonces.map((a) => ({ ...a })), numerosTx, messages, stock };
  return { comptes, loginDe, paires, items, listes, colis, offres, annonces, ventes: lesVentes, achats: lesAchats, sources, numParItem, luListings, maintenant };
}

// La vie d'une paire, étape par étape. Une étape lue : `fait` ; à faire maintenant : `geste` ;
// pas encore : `avenir` ; pas su : `passu` avec sa raison. Rien n'est inventé.
function completerPaire(p, { couts, achatParTx, bordParTx, pseudoParTx, loginDe, maintenant, ventesLues }) {
  const parDate = (a, b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0);
  p.ventes.sort(parDate);
  const v = p.ventes[0] || null;
  const a = p.annonces.find((x) => v && x.id === v._item) || p.annonces.find((x) => x.ouverte) || p.annonces[0] || null;
  p.annonce = a; p.vente = v;
  p.titre = (v && v.title) || (a && a.title) || str(p.fiche && p.fiche.title);
  p.photo = (a && a.photo) || photoDe(v && v.photo) || str(p.fiche && p.fiche.photo);
  p.taille = (a && a.size) || ''; p.etatArticle = (a && a.etat) || '';
  p.compte = loginDe((v && v._uid) || (a && a.uid) || (p.fiche && p.fiche.accountId));
  const fiche = p.fiche || {};
  const achat = fiche.buyFromId ? achatParTx.get(str(fiche.buyFromId)) || null : null;
  const coutSaisi = centimes(fiche.buyPrice) != null ? centimes(fiche.buyPrice) : centimes(couts[p.numero] != null ? couts[p.numero] : couts[p.k]);
  p.cout = coutSaisi;   // saisi par lui (§2.5) ; jamais deviné
  p.prixVente = v ? centimes(v.price) : null;
  p.prixAnnonce = a ? centimes(a.price) : null;
  p.bord = v ? bordParTx.get(v._tx) || null : null;
  p.pseudo = v ? pseudoParTx.get(v._tx) || '' : '';
  const st = v ? str(v.transaction_user_status) : '';
  const fini = v && /finalis/i.test(str(v.status));
  const e = [];
  // 1. Achat
  if (achat) e.push({ cle: 'achat', etat: 'fait', titre: 'Achetée', date: achat.date, valeur: centimes(achat.price), detail: `sur ${loginDe(achat._uid) || 'un de tes comptes'} · reliée par son n° de transaction${coutSaisi != null && coutSaisi !== centimes(achat.price) ? ' · coût saisi frais compris' : ''}`, preuve: 'transaction' });
  else if (coutSaisi != null) e.push({ cle: 'achat', etat: 'fait', titre: 'Achetée', date: null, valeur: coutSaisi, detail: 'coût saisi par toi · achat pas relié', geste: 'Relier l’achat' });
  else e.push({ cle: 'achat', etat: 'passu', titre: 'Achat', detail: 'prix d’achat pas saisi', geste: 'Saisir le prix' });
  // 2. Rangée
  if (p.cases.length > 1) e.push({ cle: 'case', etat: 'fait', titre: `Rangée en ${p.cases.join(' et ')}`, detail: 'deux cases pour ce N° : regarde les cartons' });
  else if (p.cases.length === 1) e.push({ cle: 'case', etat: 'fait', titre: `Case ${p.cases[0]}`, date: fiche.numberedAt || null, detail: `N° ${p.numero} écrit sur le carton` });
  else e.push({ cle: 'case', etat: 'passu', titre: 'Rangement', detail: 'aucune case notée pour ce N°' });
  // 3. En ligne (chaque site lu)
  if (a) e.push({ cle: 'ligne', etat: 'fait', titre: v ? 'Était en ligne sur Vinted' : 'En ligne sur Vinted', date: a.cree || null, valeur: p.prixAnnonce,
    detail: [a.cree ? `${Math.max(0, Math.round((((v && Date.parse(v.date)) || maintenant) - Date.parse(a.cree)) / J))} j` : null, `${a.fav} favoris`, `${a.vues} vues`, loginDe(a.uid)].filter(Boolean).join(' · ') });
  else e.push({ cle: 'ligne', etat: 'passu', titre: 'Annonce', detail: 'annonce pas lue dans le dressing' });
  // 4. Vendue
  if (v) e.push({ cle: 'vente', etat: 'fait', titre: 'Vendue sur Vinted', date: v.date, valeur: p.prixVente, detail: [p.pseudo ? `à ${p.pseudo}` : null, 'par son n° de transaction'].filter(Boolean).join(' · ') });
  else e.push({ cle: 'vente', etat: 'avenir', titre: 'Vente', detail: ventesLues ? 'pas encore vendue' : 'ventes pas lues' });
  // 5. Bordereau → 6. Envoi
  if (v) {
    const aEnvoyer = st === 'needs_action';
    const lim = p.bord && p.bord.limite ? Date.parse(p.bord.limite) : null;
    if (p.bord) e.push({ cle: 'bord', etat: 'fait', titre: 'Bordereau reçu', date: p.bord.recu, detail: p.bord.suivi ? `suivi ${p.bord.suivi}` : '' });
    else e.push({ cle: 'bord', etat: aEnvoyer ? 'passu' : 'fait', titre: 'Bordereau', detail: aEnvoyer ? 'pas encore reçu par e-mail' : 'colis parti' });
    if (aEnvoyer) e.push({ cle: 'envoi', etat: 'geste', titre: 'À envoyer', date: lim ? new Date(lim).toISOString() : null, detail: lim ? 'date limite de l’e-mail du bordereau' : 'date limite pas lue', geste: p.bord ? 'Imprimer le bordereau' : null });
    else e.push({ cle: 'envoi', etat: 'fait', titre: fini ? 'Livrée' : 'Envoyée', date: null, detail: str(v.status) });
    // 7. Argent : la date de VERSEMENT fait foi (« Commande finalisée »), sinon « — ».
    if (fini) e.push({ cle: 'argent', etat: 'fait', titre: 'Argent versé', date: null, valeur: p.prixVente, detail: 'commande finalisée' });
    else e.push({ cle: 'argent', etat: 'avenir', titre: 'Argent', detail: 'versé quand l’acheteur confirme' });
  } else {
    e.push({ cle: 'envoi', etat: 'avenir', titre: 'Envoi', detail: '' });
    e.push({ cle: 'argent', etat: 'avenir', titre: 'Argent', detail: '' });
  }
  p.vie = e;
  p.marge = p.prixVente != null && coutSaisi != null ? p.prixVente - coutSaisi : null;
  // Là où la paire en est, en un mot, et le geste du moment.
  if (v && st === 'needs_action') { p.ou = 'envoyer'; p.ouTexte = 'À envoyer'; }
  else if (v && fini) { p.ou = 'payee'; p.ouTexte = 'Vendue · payée'; }
  else if (v) { p.ou = 'route'; p.ouTexte = 'Vendue · en route'; }
  else if (a && a.ouverte) { p.ou = 'ligne'; p.ouTexte = 'En ligne'; }
  else { p.ou = 'stock'; p.ouTexte = 'En stock'; }
  p.rang = ['achat', 'case', 'ligne', 'vente', 'bord', 'envoi', 'argent'].map((c) => { const x = e.find((s) => s.cle === c); return x ? x.etat : 'avenir'; });
}

// LA RECHERCHE : ce que la requête a l'air d'être + le moteur de l'app + les raccourcis (listes,
// lieux de retrait). Une identité EXACTE ouvre la paire ; le titre PROPOSE seulement.
const RACCOURCIS = [['envoyer', ['a envoyer', 'envoyer', 'expedier', 'a expedier', 'colis a faire']], ['retirer', ['a retirer', 'retirer', 'colis a retirer', 'point relais']], ['offres', ['offres', 'offre']], ['enligne', ['en ligne', 'annonces']], ['dorment', ['dorment', 'qui dorment', 'vieilles annonces']]];
export function chercher(modele, q) {
  const brut = str(q).trim(); const qn = normaliser(brut);
  if (!modele || !qn) return null;
  const raccourcis = [];
  for (const [cle, mots] of RACCOURCIS) if (mots.some((m) => m.startsWith(qn) || qn.startsWith(m))) raccourcis.push({ type: 'liste', cle });
  // « colis Super U » : un filtre de la liste « À retirer » par le LIEU lu dans l'e-mail — un filtre, jamais un lien.
  const motsQ = qn.replace(/^colis\s+/, '').split(' ').filter(Boolean);
  if (modele.colis && motsQ.length) {
    const parLieu = new Map();
    for (const c of modele.colis) { if (c.status !== 'available' || !c.lieu) continue; const l = normaliser(c.lieu); if (motsQ.every((m) => l.includes(m))) { const nom = c.lieu.split('\n')[0]; parLieu.set(nom, (parLieu.get(nom) || 0) + 1); } }
    for (const [nom, n] of parLieu) raccourcis.push({ type: 'lieu', cle: 'retirer', lieu: nom, n });
  }
  const numeroTape = /^(n°|no|#)?\s*[a-z]?\d{1,5}$/i.test(brut) ? cleNumero(brut.replace(/^(n°|no|#)\s*/i, '')) : null;
  const index = indexMemo(modele.sources);
  const r = chercherPartout(index, brut, { max: 12, numero: numeroTape && modele.paires.has(numeroTape) ? numeroTape : null, exactesEnTete: true });
  const genre = reconnaitreRequete(brut, { numero: numeroTape });
  // Chaque trouvaille ramenée à SA paire, par identité (fiche → N° ; vente → item → N°), sinon elle-même.
  const versPaire = (t) => {
    const e = t.e;
    if (e.type === 'paire') return modele.paires.get(cleNumero(e.numero)) || null;
    if (e.type === 'stock') return modele.paires.get(e.numK) || null;
    if (e.type === 'vente' && e.o) { const k = modele.numParItem.get(str(e.o.item_id || e.o._item)); return k ? modele.paires.get(k) : null; }
    if (e.type === 'message' && e.m && e.m.tx) { const v = (modele.ventes || []).find((x) => x._tx === str(e.m.tx)); const k = v ? modele.numParItem.get(v._item) : null; return k ? modele.paires.get(k) : null; }
    return null;
  };
  const exactes = r.exactes.map((t) => ({ t, paire: versPaire(t), exact: estIdentiteExacte(t) }));
  const parType = (types) => r.ordre.filter((k) => types.includes(k)).flatMap((k) => r.groupes[k].map((t) => ({ t, paire: versPaire(t) })));
  // Les PERSONNES (pseudo) et les COLIS ; puis ce qui RESSEMBLE (titre), toujours proposé, jamais relié.
  const vus = new Set(exactes.map((x) => x.paire && x.paire.k).filter(Boolean));
  const autres = parType(['paire', 'vente', 'annonce', 'message', 'achat', 'colis', 'retrait', 'stock']).filter((x) => { if (x.paire) { if (vus.has(x.paire.k)) return false; vus.add(x.paire.k); } return true; });
  const personnes = autres.filter((x) => x.t.par === 'pseudo');
  const ressemble = autres.filter((x) => x.t.par === 'titre');
  const reste = autres.filter((x) => x.t.par !== 'pseudo' && x.t.par !== 'titre');
  return { q: brut, genre, raccourcis, exactes, personnes, reste, ressemble, total: r.total };
}

export const euros = (c, { signe = false } = {}) => {
  if (c == null) return '—';
  const s = (Math.abs(c) / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
  return (signe ? (c < 0 ? '−' : '+') : (c < 0 ? '−' : '')) + s + ' €';
};
export const jourCourt = (iso, maintenant = Date.now()) => {
  const t = Date.parse(iso || ''); if (!t) return '';
  const d = new Date(t), n = new Date(maintenant);
  const j0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const dj = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - j0) / J);
  if (dj === 0) return 'aujourd’hui'; if (dj === -1) return 'hier'; if (dj === 1) return 'demain';
  const o = { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' };
  if (Math.abs(dj) < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' }) + (dj < 0 ? ' dernier' : '');
  return d.toLocaleDateString('fr-FR', o);
};
export { alnum, cleNumero };

// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE O « GALERIE » — les listes vues par la PHOTO. Mêmes sources que F (ci-dessus),
//  mêmes identités : une annonce rejoint son N° par SON id, une vente par son `item_id`,
//  un bordereau par le n° de transaction. Un montant inconnu reste `null` (« — »).
// ════════════════════════════════════════════════════════════════════════════
const PAS_UNE_VENTE = /annul|rembours|retour|suspend|échou|echou/i;
export function galerie(m) {
  const maintenant = m.maintenant;
  const bordParTx = new Map((m.sources.bordereaux || []).map((b) => [b.tx, b]));
  const pseudoParTx = new Map((m.sources.pseudos || []).map((p) => [p.tx, p.pseudo]));
  const numDe = (itemId) => { const k = m.numParItem.get(str(itemId)); const p = k ? m.paires.get(k) : null; return p ? p.numero : ''; };
  const pairDe = (itemId) => { const k = m.numParItem.get(str(itemId)); return k ? m.paires.get(k) || null : null; };

  // Annonces en ligne : la photo, le N° (par l'id), le prix, l'âge.
  const annonces = m.annonces ? m.annonces.map((a) => ({ cle: 'a:' + a.id, id: a.id, photo: a.photo || '', numero: numDe(a.id), titre: a.title, prix: centimes(a.price),
    jours: a.cree ? Math.max(0, Math.floor((maintenant - Date.parse(a.cree)) / J)) : null, compte: m.loginDe(a.uid), taille: a.size, etat: a.etat, fav: a.fav, vues: a.vues }))
    .sort((x, y) => (x.jours ?? 9e9) - (y.jours ?? 9e9)) : null;

  // Ventes : à envoyer (machine `needs_action`), en route, finies ; une vente annulée ou remboursée n'est pas une vente.
  const ventes = m.ventes ? m.ventes.map((v) => {
    const b = bordParTx.get(v._tx) || null; const p = pairDe(v._item);
    const etat = v.transaction_user_status === 'needs_action' ? 'envoyer' : PAS_UNE_VENTE.test(str(v.status)) ? 'annulee' : /finalis/i.test(str(v.status)) ? 'finie' : 'route';
    const lim = b && b.limite ? Date.parse(b.limite) : null;
    return { cle: 'v:' + v._tx, tx: v._tx, photo: photoDe(v.photo) || (p && p.photo) || '', numero: p ? p.numero : '', titre: str(v.title), prix: centimes(v.price), date: v.date,
      pseudo: pseudoParTx.get(v._tx) || '', compte: m.loginDe(v._uid), etat, bord: b, limite: lim, estimee: !lim && v.date ? Date.parse(v.date) + 7 * J : null, paire: p, statut: str(v.status) };
  }) : null;
  const aEnvoyer = ventes ? ventes.filter((v) => v.etat === 'envoyer').sort((a, b) => (a.limite || a.estimee || 9e15) - (b.limite || b.estimee || 9e15)) : null;
  const parDate = (a, b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0);

  // Achats : reçus (commande finalisée) ou en route ; les colis à retirer viennent des e-mails du transporteur.
  const achats = m.achats ? m.achats.map((o) => ({ cle: 'h:' + o._tx, tx: o._tx, photo: photoDe(o.photo), titre: str(o.title), prix: centimes(o.price), date: o.date, compte: m.loginDe(o._uid),
    etat: /finalis/i.test(str(o.status)) ? 'recu' : 'route', statut: str(o.status), vendeur: str(o.vendeur || '') })).sort(parDate) : null;
  const retirer = m.colis ? m.colis.filter((c) => c.status === 'available' && c.code).map((c) => ({ cle: 'c:' + c.id, ...c, photo: str(c.photo || ''), point: c.lieu ? c.lieu.split('\n')[0] : '', adresse: c.lieu ? c.lieu.split('\n').slice(1).join(', ') : '' }))
    .sort((a, b) => (Date.parse(a.limite) || 9e15) - (Date.parse(b.limite) || 9e15)) : null;
  const points = [];
  for (const c of retirer || []) { let g = points.find((x) => x.point === c.point); if (!g) { g = { point: c.point, adresse: c.adresse, limite: c.limite, colis: [] }; points.push(g); } g.colis.push(c); }

  // L'argent du mois : VENDU = date de vente (pas le versement). Bénéfice = seulement les ventes dont il a saisi le coût, la couverture dite.
  const d = new Date(maintenant); const debut = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const duMois = ventes ? ventes.filter((v) => v.etat !== 'annulee' && Date.parse(v.date || '') >= debut).sort(parDate) : null;
  const vendu = duMois ? duMois.reduce((s, v) => s + (v.prix || 0), 0) : null;
  const avecCout = duMois ? duMois.filter((v) => v.paire && v.paire.cout != null && v.prix != null) : [];
  const benefice = duMois && avecCout.length ? avecCout.reduce((s, v) => s + v.prix - v.paire.cout, 0) : null;
  const mois = d.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' });
  return { annonces, ventes: ventes ? ventes.filter((v) => v.etat !== 'annulee').sort(parDate) : null, aEnvoyer, achats, retirer, points,
    argent: { mois, vendu, n: duMois ? duMois.length : null, benefice, couverts: avecCout.length, duMois },
    aImprimer: aEnvoyer ? aEnvoyer.filter((v) => v.bord).length : null };
}
