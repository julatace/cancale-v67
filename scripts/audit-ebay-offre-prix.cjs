// ════════════════════════════════════════════════════════════════════════════
//  eBAY : L'OFFRE AUX OBSERVATEURS PART AU PRIX VU, UNE PAR ANNONCE (23 nov.)
//        node scripts/audit-ebay-offre-prix.cjs [--src dossier] [--mutation=nom]
//
//  La VRAIE route `api/ebay.js` (actions `offre`, `offreinfo`) devant un faux
//  eBay (GetItem au format XML Trading, Negotiation API en JSON) et une fausse
//  base qui filtre par vendeur et sait écrire (comparer-et-échanger). Données
//  INVENTÉES (dépôt public). Ce qui doit rester vrai :
//   · sans le prix vu, RIEN ne part chez eBay ;
//   · l'annonce est RELUE chez eBay : prix ≠ prix vu, terminée, variantes,
//     autre devise, illisible ⇒ refus, AUCUN envoi ;
//   · une offre confirmée est NOTÉE (journal par compte) et la réponse dit le
//     prix de l'offre calculé sur le prix relu ;
//   · une 2e offre sur la même annonce pendant 48 h ⇒ refusée ; après 48 h ⇒ repart ;
//   · journal illisible ⇒ rien ne part (« pas su » ne vaut pas « aucune »).
//  Mutations (`--mutation=`) : `prix` (le prix relu n'est plus comparé),
//  `doublon` (la 2e offre n'est plus refusée), `journal` (journal illisible
//  traité comme vide).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const iSrc = process.argv.indexOf('--src');
let RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';

require('node:module').register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, n) { if (s === 'fast-xml-parser') return { url: 'data:text/javascript,' + encodeURIComponent('export class XMLParser { parse() { throw new Error(\"bouchon\"); } } export const XMLValidator = { validate() { return true; } };'), shortCircuit: true }; return n(s, c); }"));

if (MUT) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'offre-mut-'));
  fs.cpSync(path.join(RACINE, 'api'), path.join(tmp, 'api'), { recursive: true });
  fs.cpSync(path.join(RACINE, 'src'), path.join(tmp, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  const remplace = (f, a, b) => { const p = path.join(tmp, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) { console.log('mutation introuvable : ' + a); process.exit(2); } fs.writeFileSync(p, s.replace(a, b)); };
  if (MUT === 'prix') remplace('api/_lib/ebay-offre.js', 'if (vu !== chez) return', 'if (false) return');
  if (MUT === 'doublon') remplace('api/ebay.js', "if (deja) return { status: 409, body: { ok: false, reason: 'deja-envoyee'", "if (false) return { status: 409, body: { ok: false, reason: 'deja-envoyee'");
  if (MUT === 'journal') remplace('api/ebay.js', "if (jo === undefined) return { status: 503, body: { ok: false, reason: 'journal-pas-su'", "if (false) return { status: 503, body: { ok: false, reason: 'journal-pas-su'");
  RACINE = tmp;
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 200)); } };

const J = '11111111-1111-1111-1111-111111111111';
const JWT_J = 'eyJh.jeton-de-J.sig';
process.env.VRM_OWNER_UID = J;
process.env.EBAY_APP_ID = 'app-de-banc'; process.env.EBAY_CERT_ID = 'secret-de-banc'; process.env.EBAY_RUNAME = 'runame-de-banc';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';

const ID = '120000000401';
// ── la fausse base (lecture projetée, écriture POST/PATCH sur data->>rev) ──
let lignes = [], modeBase = {};
const remettreBase = () => { lignes = [{ owner: J, id: 'ebay_tokens', data: { refresh_token: 'rt-de-J', saved_at: 1 } }]; modeBase = {}; };
const projette = (r, sel) => {
  if (!sel) return r;
  const out = {};
  for (const part of decodeURIComponent(sel).split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'owner') { out[alias] = r[src]; continue; }
    if (src === 'data') { out[alias] = r.data; continue; }
    let v = r.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (v != null && /->>[^>]*$/.test(src) && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};
const journalOffres = () => (lignes.find((r) => r.id === 'ebay_offres_envoyees') || {}).data || null;

// ── le faux eBay ──
let item = {}, eligibles = [ID], journal = [], modeEbay = {};
const remettreEbay = () => { item = { itemId: ID, prix: '80.0', statut: 'Active', devise: 'EUR', variantes: false }; eligibles = [ID]; journal = []; modeEbay = {}; };
const ITEM = (a) => `<Item><ItemID>${a.itemId}</ItemID><Title>Paire inventée</Title><SKU>VRM-41</SKU><Currency>${a.devise}</Currency><StartPrice currencyID="${a.devise}">${a.prix}</StartPrice>`
  + `${a.variantes ? '<Variations><Variation><SKU>VRM-1</SKU></Variation></Variations>' : ''}<SellingStatus><CurrentPrice currencyID="${a.devise}">${a.prix}</CurrentPrice><QuantitySold>0</QuantitySold><ListingStatus>${a.statut}</ListingStatus></SellingStatus>`
  + `<ListingDetails><StartTime>2026-11-01T10:00:00.000Z</StartTime></ListingDetails></Item>`;
const OK = (appel, inner) => `<?xml version="1.0" encoding="UTF-8"?><${appel}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>${inner || ''}</${appel}Response>`;
const rep = (corps, status = 200) => new Response(corps == null ? null : (typeof corps === 'string' ? corps : JSON.stringify(corps)), { status, headers: { 'content-type': 'application/json' } });
const xmlRep = (s) => new Response(s, { status: 200, headers: { 'content-type': 'text/xml' } });
const balise = (s, t) => (new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>').exec(s || '') || [])[1] || '';
global.fetch = async (url, opts = {}) => {
  const u = String(url), m = (opts.method || 'GET').toUpperCase(), h = opts.headers || {};
  if (u.includes('/auth/v1/user')) return String(h.Authorization || h.authorization || '') === 'Bearer ' + JWT_J ? rep({ id: J, email: 'j@exemple.test' }) : rep({ msg: 'invalid' }, 401);
  if (u.includes('ebay.com')) {
    const appel = h['X-EBAY-API-CALL-NAME'] || '';
    const corps = String(opts.body || '');
    if (u.includes('/identity/v1/oauth2/token')) return rep({ access_token: 'at-J', expires_in: 7200 });
    journal.push({ appel, u, m, corps });
    if (u.includes('/sell/negotiation/v1/find_eligible_items')) return eligibles.length ? rep({ eligibleItems: eligibles.map((listingId) => ({ listingId })), total: eligibles.length }) : rep(null, 204);
    if (u.includes('/sell/negotiation/v1/send_offer_to_interested_buyers')) {
      if (modeEbay.envoi === 'coupure') throw new Error('ECONNRESET');
      return rep({ offers: [{ offerId: 'o1', offerStatus: 'PENDING' }, { offerId: 'o2', offerStatus: 'PENDING' }, { offerId: 'o3', offerStatus: 'PENDING' }] });
    }
    if (appel === 'GetUser') return xmlRep(OK('GetUser', '<User><UserID>julien_part</UserID><EIASToken>EIAS-J-0000000001</EIASToken><Site>France</Site></User>'));
    if (appel === 'GetItem') {
      if (modeEbay.getitem === 'ko') return new Response('<html>503</html>', { status: 503, headers: { 'content-type': 'text/html' } });
      return xmlRep(OK('GetItem', balise(corps, 'ItemID') === item.itemId ? ITEM(item) : ''));
    }
    return xmlRep(OK(appel, ''));
  }
  if (u.includes('/rest/v1/rpc/vrm_acces_pour')) return rep(true);
  if (u.includes('/rest/v1/app_data')) {
    const q = decodeURIComponent(u);
    if (/select=owner&limit=1/.test(q)) return rep([]);
    const id = (/[?&]id=eq\.([^&]*)/.exec(q) || [])[1];
    const owner = (/[?&]owner=eq\.([^&]*)/.exec(q) || [])[1];
    if (id === 'ebay_offres_envoyees' && modeBase.journal === 'ko') return rep({ message: 'panne' }, 500);
    if (m === 'POST') {
      let rows = []; try { rows = JSON.parse(opts.body || '[]'); } catch (_) {}
      for (const r of (Array.isArray(rows) ? rows : [rows])) { const i = lignes.findIndex((x) => x.id === r.id && x.owner === r.owner); if (i >= 0) lignes[i] = r; else lignes.push(r); }
      return rep('', 201);
    }
    if (m === 'PATCH') {
      let b = {}; try { b = JSON.parse(opts.body || '{}'); } catch (_) {}
      const rev = (/data->>rev=eq\.([^&]*)/.exec(q) || [])[1]; const sansRev = /data->>rev=is\.null/.test(q);
      const out = lignes.filter((r) => r.id === id && (!owner || r.owner === owner) && (sansRev ? r.data.rev == null : String(r.data.rev) === rev));
      for (const r of out) r.data = b.data;
      return rep(out.map((r) => ({ id: r.id })));
    }
    if (id === 'main') return rep([{ v: null }]);
    const sel = (/[?&]select=([^&]*)/.exec(q) || [])[1];
    const out = lignes.filter((r) => (!id || r.id === id) && (!owner || r.owner === owner));
    return rep(out.map((r) => projette(r, sel)));
  }
  return rep({});
};
const faireRes = () => { const x = { code: null, corps: null, entetes: {} }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = (k, v) => { x.entetes[String(k).toLowerCase()] = v; }; x.end = () => x; return x; };

(async () => {
  let route;
  await essaie('chargement de la route', async () => { route = await import('file://' + path.join(RACINE, 'api', 'ebay.js')); });
  if (!route) { console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(1); }
  const app = async (corps) => { journal.length = 0; const res = faireRes(); await route.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer ' + JWT_J }, body: corps }, res); return { code: res.code, j: res.corps || {}, journal: journal.slice() }; };
  const envois = (r) => r.journal.filter((x) => /send_offer_to_interested_buyers/.test(x.u));
  const BASE = { action: 'offre', listingId: ID, remise: 10, confirme: true, prixVu: '80' };

  await essaie('A. sans prix vu', async () => {
    remettreBase(); remettreEbay();
    const { prixVu, ...sans } = BASE; void prixVu;
    const r = await app(sans);
    dit(r.code === 400 && r.j.reason === 'prix' && r.journal.length === 0, 'sans le prix vu : refus « prix », AUCUN appel à eBay', JSON.stringify({ c: r.code, j: r.j, n: r.journal.length }));
  });
  await essaie('B. offre au prix vu', async () => {
    remettreBase(); remettreEbay();
    const r = await app(BASE);
    const ordre = r.journal.map((x) => x.appel || (/find_eligible/.test(x.u) ? 'eligibles' : /send_offer/.test(x.u) ? 'envoi' : '?'));
    dit(r.code === 200 && r.j.ok === true && r.j.envoyees === 3 && r.j.prix === 80 && r.j.prixOffre === 72, 'au prix vu (80 €) : l’offre part, la réponse dit 3 personnes et 72,00 € (−10 % du prix RELU)', JSON.stringify(r.j));
    dit(ordre.indexOf('eligibles') >= 0 && ordre.indexOf('GetItem') > ordre.indexOf('eligibles') && ordre.indexOf('envoi') > ordre.indexOf('GetItem'), 'ordre : éligibilité → annonce RELUE (GetItem) → envoi', ordre.join(','));
    const c = JSON.parse((envois(r)[0] || {}).corps || '{}');
    dit(c.offeredItems && c.offeredItems[0].discountPercentage === '10' && !/shipping|livraison/i.test(JSON.stringify(c)), 'le corps : la remise seule, aucun champ de livraison (§2.8)', JSON.stringify(c));
    const jo = journalOffres();
    dit(!!(jo && jo.items && jo.items[ID] && jo.items[ID].etat === 'envoyee' && jo.items[ID].offreCents === 7200 && jo.items[ID].envoyees === 3) && r.j.note === true, 'l’offre est NOTÉE au journal du compte (envoyée, 72,00 €, 3 personnes)', JSON.stringify(jo));
  });
  const refuse = async (nom, prep, reason, statut) => {
    await essaie(nom, async () => {
      remettreBase(); remettreEbay(); prep();
      const r = await app(BASE);
      dit(r.code === statut && r.j.reason === reason && envois(r).length === 0 && !journalOffres(), nom + ` ⇒ ${statut} « ${reason} », rien ne part, rien n'est noté`, JSON.stringify({ c: r.code, j: r.j }));
    });
  };
  await refuse('C. prix chez eBay ≠ prix vu (75 €)', () => { item.prix = '75.0'; }, 'prix-change', 409);
  await refuse('D. annonce terminée chez eBay', () => { item.statut = 'Completed'; }, 'pas-en-ligne', 409);
  await refuse('E. annonce à variantes', () => { item.variantes = true; }, 'variantes', 409);
  await refuse('F. autre devise (GBP sur un compte EUR)', () => { item.devise = 'GBP'; }, 'devise', 409);
  await refuse('G. GetItem illisible (503)', () => { modeEbay.getitem = 'ko'; }, 'pas-su', 503);
  await essaie('H. une 2e offre pendant 48 h', async () => {
    remettreBase(); remettreEbay();
    await app(BASE);
    const r = await app({ ...BASE, remise: 15 });
    dit(r.code === 409 && r.j.reason === 'deja-envoyee' && envois(r).length === 0 && r.j.enCours && r.j.enCours.jusqua, 'une offre déjà partie il y a moins de 48 h ⇒ 409 « deja-envoyee », rien ne part, la date de fin est dite', JSON.stringify({ c: r.code, j: r.j }));
    dit(r.journal.length === 0, 'et AUCUN appel à eBay (ni éligibilité, ni relecture)', String(r.journal.length));
  });
  await essaie('I. après 48 h', async () => {
    remettreBase(); remettreEbay();
    lignes.push({ owner: J, id: 'ebay_offres_envoyees', data: { rev: 1, items: { [ID]: { at: new Date(Date.now() - 49 * 3600 * 1000).toISOString(), remise: 10, etat: 'envoyee', offreCents: 7200 } } } });
    const r = await app(BASE);
    dit(r.code === 200 && envois(r).length === 1, 'une offre de plus de 48 h ne bloque pas : la nouvelle part', JSON.stringify({ c: r.code, j: r.j }));
  });
  await essaie('J. journal illisible', async () => {
    remettreBase(); remettreEbay(); modeBase.journal = 'ko';
    const r = await app(BASE);
    dit(r.code === 503 && r.j.reason === 'journal-pas-su' && envois(r).length === 0, 'journal des offres illisible ⇒ 503, rien ne part (« pas su » ≠ « aucune »)', JSON.stringify({ c: r.code, j: r.j }));
  });
  await essaie('K. coupure pendant l’envoi', async () => {
    remettreBase(); remettreEbay(); modeEbay.envoi = 'coupure';
    const r = await app(BASE);
    const jo = journalOffres();
    dit(r.code === 504 && r.j.reason === 'incertain' && jo && jo.items[ID] && jo.items[ID].etat === 'incertaine', 'coupure ⇒ « incertain », noté « incertaine » (jamais « envoyée »)', JSON.stringify({ c: r.code, jo }));
  });
  await essaie('L. offreinfo dit les offres en cours', async () => {
    remettreBase(); remettreEbay();
    await app(BASE);
    const r = await app({ action: 'offreinfo' });
    dit(r.code === 200 && r.j.enCours && r.j.enCours[ID] && r.j.enCours[ID].offreCents === 7200, '« offreinfo » rend les offres en cours (48 h) pour l’écran', JSON.stringify(r.j));
    modeBase.journal = 'ko';
    const r2 = await app({ action: 'offreinfo' });
    dit(r2.code === 200 && r2.j.enCours === null && Array.isArray(r2.j.eligibles), 'journal illisible ⇒ `enCours: null` (pas su), les éligibles restent', JSON.stringify(r2.j));
  });
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
