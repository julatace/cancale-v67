// ════════════════════════════════════════════════════════════════════════════
//  LA ROUTE eBAY, EXÉCUTÉE : qui pilote QUEL compte eBay, et ce qui part chez
//  eBay quand on publie, vérifie, programme, annule ou déplace.
//        node scripts/audit-ebay-route.cjs [--src dossier]
//
//  Mesuré le 5 octobre : `/api/ebay` n'exigeait AUCUNE session, et le compte
//  eBay de Julien est connecté en production (une ligne `ebay_tokens` avec son
//  jeton de renouvellement). N'importe qui sur Internet pouvait donc lister ses
//  commandes, publier sur SON compte, ou remplacer sa connexion par la sienne.
//
//  ── CHAQUE VENDEUR SON eBAY (5 octobre, suite) ─────────────────────────────
//  Julien : « tout doit être adaptable en fonction de la personne en face ».
//  `ebay_tokens` et les lignes `ebay_*` étaient celles de L'INSTALLATION : la
//  route refusait tout autre vendeur (403), et le jour où elle l'aurait laissé
//  passer, il aurait lu les jetons de Julien. On exige maintenant, sur une base
//  cloisonnée :
//    · un vendeur B connecté relie SON eBay (le `state` signé PORTE son
//      identifiant, ses jetons sont rangés `owner = B`) ;
//    · B ne lit jamais les jetons ni les lignes de Julien : toutes ses lectures
//      sont filtrées `owner=eq.B`, et ses appels à eBay partent avec SON jeton ;
//    · un `state` falsifié (le vendeur remplacé, la signature d'un autre) est
//      refusé : aucun échange, aucun jeton rangé ;
//    · la ligne d'avant de Julien (owner = VRM_OWNER_UID) marche sans rien
//      refaire ;
//    · un abonnement coupé ⇒ 402, zéro appel eBay ;
//    · base PAS ENCORE cloisonnée ⇒ exactement comme avant (un seul jeu de
//      données, seul le propriétaire de l'installation) — rejoué dans un
//      second processus, la sonde de schéma étant mémorisée par instance.
//
//  ── LES FRAIS ET LES ERREURS (corrigés le 5 octobre) ───────────────────────
//    · les frais sont lus PAR NOM : `ListingFee` EST le total (guide Trading
//      « Fees ») — l'ancien `totalFrais` additionnait tout et doublait ;
//      absent ⇒ null (« pas su »), jamais 0 ;
//    · toutes les <Errors> sont gardées : un Warning puis une Error ⇒ c'est
//      l'Error qui est rendue.
//
//  ── LE PLANIFICATEUR (programmer · programmees · deprogrammer ·
//     reprogrammer · limites) ────────────────────────────────────────────────
//    · ce qui engage exige `confirme:true` ET une heure, un N°, un état, un
//      UUID, des frais vus valides — refusés AVANT tout appel à eBay ;
//    · ordre : relecture des annonces → vérification à blanc (SANS UUID) →
//      ajout (AVEC UUID) ; même <Item> hors <UUID> ; <ScheduleTime> UTC DANS
//      <Item> ;
//    · une paire déjà programmée / déjà en ligne (SKU) ⇒ 409, rien d'envoyé ;
//      liste illisible ⇒ 503 ;
//    · frais plus chers que vus ⇒ 409 ; frais inconnus ⇒ refus ;
//    · coupure ⇒ « incertain » ; un second envoi avec le MÊME UUID ne crée pas
//      une seconde annonce ; 488 confirmé par GetItem (même SKU) seulement ;
//    · eBay qui ignore l'heure ⇒ `enLigneMaintenant` ;
//    · GetMyeBaySelling découpé par conteneur, paginé ;
//    · annuler : la réponse d'eBay remonte telle quelle ; déplacer : refusé
//      dans la dernière heure ;
//    · limites : des nombres lus, jamais un 0 inventé.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const cp = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const NON_CLOISONNEE = process.argv.includes('--non-cloisonnee');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

const J = '11111111-1111-1111-1111-111111111111';   // Julien, propriétaire de l'installation
const B = '22222222-2222-2222-2222-222222222222';   // un autre vendeur
const C = '33333333-3333-3333-3333-333333333333';   // un vendeur dont l'abonnement est coupé
// Un JWT a trois morceaux : le contrôle de forme du serveur l'exige.
const JWT_J = 'eyJh.jeton-de-J.sig', JWT_B = 'eyJh.jeton-de-B.sig', JWT_C = 'eyJh.jeton-de-C.sig';

process.env.VRM_OWNER_UID = J;
process.env.EBAY_APP_ID = 'app-de-banc';
process.env.EBAY_CERT_ID = 'secret-de-banc';
process.env.EBAY_RUNAME = 'runame-de-banc';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';
// La relecture différée après une révision (règle d'offre) : 20 ms au banc.
process.env.EBAY_RELECTURE_MS = '20';

const MIN = 60 * 1000, H = 60 * MIN, JOUR = 24 * H;
const iso = (t) => new Date(Math.round(t / MIN) * MIN).toISOString();

// ── LA FAUSSE BASE : des lignes (owner, id), et elle sait filtrer ────────────
// ⚠️ §6.3 : l'ancienne fausse base rendait `ebay_tokens` à QUICONQUE le
// demandait, filtre ou pas — elle ne pouvait pas voir un vendeur lire les
// jetons d'un autre. Celle-ci honore `owner=eq.` et la projection `select=`.
let lignes = [];
const remettreBase = () => { lignes = [{ owner: J, id: 'ebay_tokens', data: { refresh_token: 'rt-de-J', saved_at: 1 } }]; };
remettreBase();
const projette = (r, sel) => {
  if (!sel) return r;
  const out = {};
  for (const part of decodeURIComponent(sel).split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'owner') { out[alias] = r[src]; continue; }
    if (src === 'data') { out[alias] = r.data; continue; }
    let v = r.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

// ── LE FAUX eBAY : un compte par jeton (Julien et B n'ont pas le même eBay) ──
// Données INVENTÉES (le dépôt est public).
const annonce = (itemId, title, sku, prix, debut, extra) => ({ itemId, title, sku, prix, debut, ...(extra || {}) });
const ANNONCES_J = () => [
  annonce('110000000001', 'Adidas Gazelle bleu taille 40', 'VRM-22', '80.0', '2026-09-20T10:00:00.000Z', { watch: 3 }),
  annonce('110000000002', 'Nike Dunk Low panda taille 42', '', '100.0', '2026-09-21T10:00:00.000Z', { variantes: '<Variations><Variation><SKU>VAR-42</SKU></Variation></Variations>' }),
];
let ebay = {};
const remettreEbay = () => { ebay = { 'at-J': { actives: ANNONCES_J(), programmees: [], pagesProg: 1 }, 'at-B': { actives: [], programmees: [], pagesProg: 1 }, 'at-A2': { actives: [], programmees: [], pagesProg: 1 }, 'at-A3': { actives: [], programmees: [], pagesProg: 1 } }; };
// ── QUI EST DERRIÈRE CHAQUE JETON (9 octobre, plusieurs comptes eBay) ────────
// GetUser rend le compte APPELANT : son pseudo et son identifiant stable
// (EIASToken). Julien a DEUX comptes eBay (particulier `at-J`, pro `at-A2`) ;
// B a le sien. Données INVENTÉES.
const IDENTITES = { 'at-J': ['julien_part', 'EIAS-JULIEN-PART-000000001'], 'at-A2': ['julien_pro', 'EIAS-JULIEN-PRO-000000002'], 'at-A3': ['julien_trois', 'EIAS-JULIEN-TROIS-00000003'], 'at-B': ['vendeur_b', 'EIAS-VENDEUR-B-0000000004'] };
remettreEbay();
let prochainId = 110000000777;
const itemFake = (a) => `<Item><ItemID>${a.itemId}</ItemID><Title>${a.title}</Title>${a.sku ? `<SKU>${a.sku}</SKU>` : ''}${a.watch != null ? `<WatchCount>${a.watch}</WatchCount>` : ''}<QuantityAvailable>1</QuantityAvailable>${a.variantes || ''}<SellingStatus><CurrentPrice currencyID="EUR">${a.prix}</CurrentPrice><QuantitySold>0</QuantitySold></SellingStatus><ListingDetails><StartTime>${a.debut}</StartTime>${a.fin ? `<EndTime>${a.fin}</EndTime>` : ''}<ViewItemURL>https://www.ebay.fr/itm/${a.itemId}</ViewItemURL></ListingDetails></Item>`;
function repListe(compte, corps) {
  const veutA = /<ActiveList>/.test(corps), veutS = /<ScheduledList>/.test(corps);
  const pageS = Number((/<ScheduledList>[\s\S]*?<PageNumber>(\d+)<\/PageNumber>/.exec(corps) || [])[1] || 1);
  let x = '<?xml version="1.0" encoding="UTF-8"?><GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>';
  // eBay n'émet pas un conteneur vide (forme supposée, et servie ainsi exprès :
  // la route doit le lire « vide », jamais « pas su »).
  if (veutA && compte.actives.length) x += `<ActiveList><ItemArray>${compte.actives.map(itemFake).join('')}</ItemArray><PaginationResult><TotalNumberOfPages>1</TotalNumberOfPages></PaginationResult></ActiveList>`;
  if (veutS && compte.programmees.length) {
    const n = compte.pagesProg, par = Math.ceil(compte.programmees.length / n);
    const page = compte.programmees.slice((pageS - 1) * par, pageS * par);
    x += `<ScheduledList><ItemArray>${page.map(itemFake).join('')}</ItemArray><PaginationResult><TotalNumberOfPages>${n}</TotalNumberOfPages></PaginationResult></ScheduledList>`;
  }
  return x + '</GetMyeBaySellingResponse>';
}
const XML_OK = (inner) => `<?xml version="1.0"?><R xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>${inner || ''}</R>`;
const XML_ECHEC = (errs) => `<?xml version="1.0"?><R xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack>${errs}</R>`;
const XML_WARN = (errs) => `<?xml version="1.0"?><R xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Warning</Ack>${errs}</R>`;
// (9 octobre) 5ᵉ argument facultatif : la CLASSE de l'erreur (RequestError /
// SystemError) — les appels d'avant ne changent pas.
const ERR = (code, sev, msg, params, classe) => `<Errors><ShortMessage>x</ShortMessage><LongMessage>${msg}</LongMessage><ErrorCode>${code}</ErrorCode><SeverityCode>${sev}</SeverityCode>${(params || []).map((p, i) => `<ErrorParameters ParamID="${i}"><Value>${p}</Value></ErrorParameters>`).join('')}${classe ? `<ErrorClassification>${classe}</ErrorClassification>` : ''}</Errors>`;
const XML_REFUS = XML_ECHEC(ERR('1047', 'Error', 'Cette annonce est déjà terminée. v^1.1#SECRET-QUI-FUIRAIT'));
const fee = (n, v) => `<Fee><Name>${n}</Name><Fee currencyID="EUR">${v}</Fee></Fee>`;
const ELIGIBLE = '110000000002';
let mode = {};
const uuidsVus = new Map();       // UUID déjà utilisé → ItemID (comme eBay : 488)
// La règle d'offre d'une annonce, avant la dernière révision (« ancien-puis-nouveau »).
const avantRevision = new Map();
let ecrituresOffres = 0, getEnVol = 0, maxGetEnVol = 0;
const remettre = () => { mode = { liste: 'ok', commandes: 'ok', eligibles: 'ok', envoi: 'ok', trading: 'ok', verif: 'ok', add: 'ok', end: 'ok', revise: 'ok', priv: 'ok', getitem: 'ok', mainKo: false, journalKo: false, listingsKo: false, getuser: 'ok', listeKoPour: '', comptesKo: false,
  regle: 'ok', getitemApres: '', prix: 'efface', offresKo: false, offresEcritureKo: false, offresEcritureKoApres: false, getitemKoPour: '', getitemLent: false }; remettreEbay(); uuidsVus.clear(); avantRevision.clear(); ecrituresOffres = 0; getEnVol = 0; maxGetEnVol = 0; };
remettre();
// ── LA RÈGLE D'OFFRE CHEZ LE FAUX eBAY (9 octobre) ──────────────────────────
// Une annonce peut porter `regle: { actives: true|false|null, accepte, refuse,
// offresFaites }`, un `type` (défaut FixedPriceItem), un `statut` (défaut
// Active), une `devise` (défaut EUR). GetItem rend une annonce COMPLÈTE au
// compte qui la possède (seuils compris) ; à un AUTRE compte, sans les seuils
// (doc eBay : seul le vendeur les voit).
const ouEst = (id) => { for (const [jeton, c] of Object.entries(ebay)) { const a = [...c.actives, ...c.programmees].find((x) => x.itemId === id); if (a) return { jeton, a }; } return null; };
const regleDe = (a) => a.regle || (a.regle = { actives: false, accepte: null, refuse: null, offresFaites: null });
function itemComplet(a, avecSeuils, sansBestOffer, rg) {
  const r = rg || regleDe(a); const dev = a.devise || 'EUR';
  const bo = (sansBestOffer || r.actives === null) ? '' : `<BestOfferDetails><BestOfferEnabled>${r.actives ? 'true' : 'false'}</BestOfferEnabled>${r.offresFaites != null ? `<BestOfferCount>${r.offresFaites}</BestOfferCount>` : ''}</BestOfferDetails>`;
  const seuils = avecSeuils ? `${r.accepte != null ? `<BestOfferAutoAcceptPrice currencyID="${dev}">${r.accepte}</BestOfferAutoAcceptPrice>` : ''}${r.refuse != null ? `<MinimumBestOfferPrice currencyID="${dev}">${r.refuse}</MinimumBestOfferPrice>` : ''}` : '';
  return `<Item><ItemID>${a.itemId}</ItemID>${a.sku ? `<SKU>${a.sku}</SKU>` : ''}<ListingType>${a.type || 'FixedPriceItem'}</ListingType><Currency>${dev}</Currency><StartPrice currencyID="${dev}">${a.prix}</StartPrice>`
    + `<SellingStatus><CurrentPrice currencyID="${dev}">${a.prix}</CurrentPrice><ConvertedCurrentPrice currencyID="EUR">1.0</ConvertedCurrentPrice><ListingStatus>${a.statut || 'Active'}</ListingStatus></SellingStatus>`
    + bo + `<ListingDetails><StartTime>${a.debut}</StartTime>${a.fin ? `<EndTime>${a.fin}</EndTime>` : ''}${seuils}</ListingDetails><Description>x</Description></Item>`;
}
const baliseA = (s, t) => { const m = new RegExp('<' + t + '(?:\\s[^>]*)?>([^<]*)</' + t + '>').exec(s || ''); return m ? m[1] : null; };

const journal = [];       // ce qui part chez eBay, ce qui s'écrit en base, avec quel jeton
let seq = 0;              // numéro d'ordre commun (base + eBay) : « le marqueur AVANT la révision »
const rep = (corps, status = 200) => new Response(status === 204 ? null : (typeof corps === 'string' ? corps : JSON.stringify(corps)), { status, headers: { 'content-type': 'application/json' } });
const xml = (s) => new Response(s, { status: 200, headers: { 'content-type': 'text/xml' } });
const balise = (s, t) => (new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>').exec(s || '') || [])[1] || '';
global.fetch = async (url, opts = {}) => {
  const u = String(url);
  const m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (u.includes('/auth/v1/user')) {
    const a = String((h.Authorization || h.authorization) || '');
    if (a === 'Bearer ' + JWT_J) return rep({ id: J, email: 'j@exemple.test' });
    if (a === 'Bearer ' + JWT_B) return rep({ id: B, email: 'b@exemple.test' });
    if (a === 'Bearer ' + JWT_C) return rep({ id: C, email: 'c@exemple.test' });
    return rep({ msg: 'invalid' }, 401);
  }
  if (u.includes('ebay.com')) {
    const appel = h['X-EBAY-API-CALL-NAME'] || '';
    const jeton = h['X-EBAY-API-IAF-TOKEN'] || String(h.Authorization || '').replace(/^Bearer\s+/, '') || '';
    const corps = String(opts.body || '');
    journal.push({ ou: 'ebay', m, u: u.replace(/\?.*$/, ''), appel, corps, jeton, marche: h['X-EBAY-C-MARKETPLACE-ID'] || '', seq: ++seq });
    if (u.includes('/identity/v1/oauth2/token')) {
      // Le jeton d'accès dépend du refresh_token : c'est ce qui montre QUEL
      // compte eBay sert chaque appel.
      const rt = decodeURIComponent((/refresh_token=([^&]*)/.exec(corps) || [])[1] || '');
      const code = decodeURIComponent((/code=([^&]*)/.exec(corps) || [])[1] || '');
      if (/grant_type=authorization_code/.test(corps)) {
        // Chaque code dit QUEL compte eBay vient de consentir (son jeton d'accès).
        const PAR_CODE = { 'code-de-B': ['rt-de-B', 'at-B'], 'code-A2': ['rt-A2', 'at-A2'], 'code-A3': ['rt-A3', 'at-A3'], 'code-J-part': ['rt-neuf-de-J', 'at-J'] };
        const [rtn, atn] = PAR_CODE[code] || ['rt-neuf-de-J', 'at-neuf'];
        return rep({ access_token: atn, expires_in: 7200, refresh_token: rtn, refresh_token_expires_in: 47304000 });
      }
      if (rt === 'rt-de-J' || rt === 'rt-neuf-de-J') return rep({ access_token: 'at-J', expires_in: 7200 });
      if (rt === 'rt-de-B') return rep({ access_token: 'at-B', expires_in: 7200 });
      if (rt === 'rt-A2') return rep({ access_token: 'at-A2', expires_in: 7200 });
      if (rt === 'rt-A3') return rep({ access_token: 'at-A3', expires_in: 7200 });
      return rep({ error: 'invalid_grant' }, 400);
    }
    if (u.includes('/ws/api.dll')) {
      const compte = ebay[jeton] || { actives: [], programmees: [], pagesProg: 1 };
      if (appel === 'GetUser') {
        const idn = IDENTITES[jeton];
        if (mode.getuser === 'ko' || !idn) return xml(mode.getuser === 'ko' ? XML_REFUS : XML_OK(''));
        return xml(XML_OK(`<User><UserID>${idn[0]}</UserID><EIASToken>${idn[1]}</EIASToken><Status>Confirmed</Status></User>`));
      }
      if (appel === 'GetMyeBaySelling') {
        if (mode.liste === 'ko' || (mode.listeKoPour && mode.listeKoPour === jeton)) return xml(XML_REFUS);
        if (mode.liste === 'reseau') throw new Error('ECONNRESET');
        return xml(repListe(compte, corps));
      }
      if (appel === 'GetItem') {
        const id = balise(corps, 'ItemID');
        if (mode.getitem === 'autre') return xml(XML_OK(`<Item><ItemID>${id}</ItemID><SKU>VRM-999</SKU><ListingDetails><StartTime>2026-11-01T10:00:00.000Z</StartTime></ListingDetails></Item>`));
        // (9 octobre) Les GetItem qui SUIVENT une révision de la règle d'offre.
        const apres = avantRevision.get(id);
        if (mode.getitemLent) { getEnVol++; maxGetEnVol = Math.max(maxGetEnVol, getEnVol); await new Promise((ok) => setTimeout(ok, 5)); getEnVol--; }
        if (apres && mode.getitemApres === 'ko') return xml(XML_REFUS);
        if (mode.getitem === 'ko' || (mode.getitemKoPour && mode.getitemKoPour === id)) return xml(XML_REFUS);
        if (mode.getitem === 'reseau') throw new Error('ECONNRESET');
        if (mode.getitem === 'tronque') return xml(XML_OK(`<Item><ItemID>${id}</ItemID><Description>x</Description></Item>`));
        const ou = ouEst(id);
        if (!ou) return xml(XML_OK('<Item><Description>x</Description></Item>'));
        let rg = null;
        if (apres && mode.getitemApres === 'ancien-puis-nouveau' && !apres.servi) { apres.servi = true; rg = apres.regle; }
        const sansBo = mode.getitem === 'sans-bestoffer' || (!!apres && mode.getitemApres === 'sans-bestoffer');
        return xml(XML_OK(itemComplet(ou.a, ou.jeton === jeton, sansBo, rg)));
      }
      if (appel === 'VerifyAddFixedPriceItem') {
        if (mode.verif === 'refus') return xml(XML_ECHEC(ERR('21916672', 'Error', 'La photo est trop petite.')));
        const prog = /<ScheduleTime>/.test(corps);
        const sched = prog ? '0.2' : '0.0';
        if (mode.verif === 'sansTotal') return xml(XML_OK(`<Fees>${fee('InsertionFee', '0.0')}${fee('SchedulingFee', sched)}</Fees>`));
        const tot = mode.verif === 'cher' ? '0.55' : (prog ? '0.2' : '0.0');
        const ins = mode.verif === 'cher' ? '0.35' : '0.0';
        return xml(XML_OK(`<Fees>${fee('BoldFee', '0.0')}${fee('InsertionFee', ins)}${fee('ListingFee', tot)}${fee('SchedulingFee', sched)}${fee('SubtitleFee', '0.0')}</Fees>`));
      }
      if (appel === 'AddFixedPriceItem') {
        if (mode.trading === 'reseau') throw new Error('ECONNRESET');
        if (mode.trading === 'refus') return xml(XML_REFUS);
        if (mode.add === 'deuxErreurs') return xml(XML_ECHEC(ERR('21917091', 'Warning', 'Le titre est long, il sera peut-être coupé.') + ERR('21916672', 'Error', 'La catégorie ne convient pas à cet objet.')));
        const uuid = balise(corps, 'UUID');
        if (uuid && uuidsVus.has(uuid)) {
          const id0 = uuidsVus.get(uuid);
          return xml(XML_ECHEC(ERR('488', 'Error', `The specified UUID has already been used; ListedByRequestAppId=1, item ID=${id0}.`, [id0])));
        }
        const id = String(prochainId++);
        const quand = balise(corps, 'ScheduleTime');
        const debut = mode.add === 'maintenant' || !quand ? iso(Date.now()) : (mode.add === 'decale' ? iso(Date.parse(quand) + 15 * MIN) : quand);
        const a = annonce(id, balise(corps, 'Title'), balise(corps, 'SKU'), balise(corps, 'StartPrice'), debut, { fin: iso(Date.parse(debut) + 30 * JOUR) });
        // (9 octobre) Une annonce créée AVEC sa règle d'offre la garde.
        if (/<BestOfferEnabled>true<\/BestOfferEnabled>/.test(corps)) a.regle = { actives: true, accepte: baliseA(corps, 'BestOfferAutoAcceptPrice'), refuse: baliseA(corps, 'MinimumBestOfferPrice'), offresFaites: null };
        if (quand && mode.add !== 'maintenant') compte.programmees.push(a); else compte.actives.push(a);
        if (uuid) uuidsVus.set(uuid, id);
        // Le réseau tombe APRÈS qu'eBay a créé l'annonce : la réponse se perd.
        if (mode.add === 'reseau-apres') throw new Error('ECONNRESET');
        // La passerelle d'eBay répond 503 en HTML APRÈS avoir créé l'annonce :
        // aucun <Ack>, eBay n'a rien dit de ce qu'il a fait (revue du 6 octobre).
        if (mode.add === '503-apres') return new Response('<html><body>503 Service Unavailable</body></html>', { status: 503, headers: { 'content-type': 'text/html' } });
        if (mode.add === '488') return xml(XML_ECHEC(ERR('488', 'Error', `The specified UUID has already been used; ListedByRequestAppId=1, item ID=${id}.`, [id])));
        return xml(XML_OK(`<ItemID>${id}</ItemID><StartTime>${a.debut}</StartTime><EndTime>${a.fin}</EndTime><Fees>${fee('ListingFee', quand ? '0.2' : '0.0')}</Fees>`));
      }
      if (appel === 'EndFixedPriceItem') {
        if (mode.trading === 'reseau') throw new Error('ECONNRESET');
        if (mode.trading === 'refus' || mode.end === 'refus') return xml(mode.end === 'refus' ? XML_ECHEC(ERR('1047', 'Error', 'Une annonce programmée ne peut pas être terminée par cet appel.')) : XML_REFUS);
        const id = balise(corps, 'ItemID');
        if (mode.end !== 'reste') { compte.programmees = compte.programmees.filter((x) => x.itemId !== id); compte.actives = compte.actives.filter((x) => x.itemId !== id); }
        if (mode.end === '503-apres') return new Response('<html>503</html>', { status: 503, headers: { 'content-type': 'text/html' } });
        return xml(XML_OK('<EndTime>2026-10-05T12:00:00.000Z</EndTime>'));
      }
      if (appel === 'ReviseFixedPriceItem') {
        if (mode.trading === 'reseau') throw new Error('ECONNRESET');
        if (mode.trading === 'refus') return xml(XML_REFUS);
        const id = balise(corps, 'ItemID'); const st = balise(corps, 'ScheduleTime');
        // (9 octobre) LA RÈGLE D'OFFRE : seuils, activation, champs supprimés.
        const enAcc = baliseA(corps, 'BestOfferAutoAcceptPrice'), enMin = baliseA(corps, 'MinimumBestOfferPrice'), enBo = baliseA(corps, 'BestOfferEnabled');
        const dels = []; { const re = /<DeletedField>([^<]*)<\/DeletedField>/g; let mm; while ((mm = re.exec(corps))) dels.push(mm[1]); }
        if (enAcc != null || enMin != null || enBo != null || dels.length) {
          const a0 = [...compte.actives, ...compte.programmees].find((x) => x.itemId === id);
          if (!a0) return xml(XML_ECHEC(ERR('21916590', 'Error', "Tu n'es pas le vendeur de cet objet (message inventé).", [], 'RequestError')));
          const r0 = regleDe(a0);
          avantRevision.set(id, { regle: { ...r0 }, servi: false });
          const appliquer = (partiel) => {
            if (enBo === 'true') r0.actives = true;
            if (partiel) return;
            if (enAcc != null) r0.accepte = enAcc;
            if (enMin != null && mode.regle !== 'warning-21992') r0.refuse = enMin;
            if (mode.regle === 'warning-21992') r0.refuse = null;
            if (dels.includes('Item.ListingDetails.BestOfferAutoAcceptPrice')) r0.accepte = null;
            if (dels.includes('Item.ListingDetails.MinimumBestOfferPrice')) r0.refuse = null;
          };
          const html503 = () => new Response('<html><body>503 Service Unavailable</body></html>', { status: 503, headers: { 'content-type': 'text/html' } });
          switch (mode.regle) {
            case 'refus-prix': return xml(XML_ECHEC(ERR('23004', 'Error', 'Invalid AutoAccept price. The Best Offer Auto Accept Price must be less than the Buy It Now price. Bearer at-J v^1.1#SECRET-QUI-FUIRAIT', [], 'RequestError')));
            case 'warning-21992': appliquer(); return xml(XML_WARN(ERR('21992', 'Warning', 'AutoDecline has been disabled or is no longer available.')));
            case 'warning-partiel': appliquer(true); return xml(XML_WARN(ERR('21920000', 'Warning', 'Best Offer auto accept is not supported in this category (message inventé).')));
            // eBay garde les MONTANTS mais coupe les offres : le seuil ne joue pas.
            case 'montant-sans-offres': appliquer(); r0.actives = false; return xml(XML_WARN(ERR('21920001', 'Warning', 'Best Offer is not available for this item (message inventé).')));
            case '503-apres': appliquer(); return html503();
            case '503-avant': return html503();
            case 'reseau-apres': appliquer(); throw new Error('ECONNRESET');
            case 'failure-systeme-applique': appliquer(); return xml(XML_ECHEC(ERR('10007', 'Error', 'Internal error to the application.', [], 'SystemError')));
            case 'failure-systeme': return xml(XML_ECHEC(ERR('10007', 'Error', 'Internal error to the application.', [], 'SystemError')));
            case 'failure-sans-classe': return xml(XML_ECHEC(ERR('10007', 'Error', 'Internal error to the application.')));
            case 'ignore': return xml(XML_OK());
            default: appliquer(); return xml(XML_OK());
          }
        }
        const a = compte.programmees.find((x) => x.itemId === id);
        if (st && a) a.debut = st;
        if (mode.revise === '503-apres') return new Response('<html>503</html>', { status: 503, headers: { 'content-type': 'text/html' } });
        return xml(XML_OK());
      }
      if (appel === 'ReviseInventoryStatus') {
        if (mode.trading === 'reseau') throw new Error('ECONNRESET');
        if (mode.trading === 'refus') return xml(XML_REFUS);
        if (mode.prix === 'refus-23004') return xml(XML_ECHEC(ERR('23004', 'Error', 'Invalid AutoAccept price. The Best Offer Auto Accept Price must be less than the Buy It Now price.', [], 'RequestError')));
        const id = balise(corps, 'ItemID'); const p = balise(corps, 'StartPrice');
        const a = [...compte.actives, ...compte.programmees].find((x) => x.itemId === id);
        if (a && p) {
          const change = Number(p) !== Number(a.prix);
          a.prix = p;
          // Ce qu'eBay fait des seuils quand le prix change : non documenté pour
          // cet appel — les deux issues sont servies (« efface » par défaut).
          if (change && mode.prix === 'efface' && a.regle) { a.regle.accepte = null; a.regle.refuse = null; }
        }
        return xml(XML_OK());
      }
      if (mode.trading === 'reseau') throw new Error('ECONNRESET');
      if (mode.trading === 'refus') return xml(XML_REFUS);
      return xml(XML_OK());
    }
    if (u.includes('/sell/account/v1/privilege')) {
      if (mode.priv === '403') return rep({ errors: [{ errorId: 1100 }] }, 403);
      if (mode.priv === '500') return rep({ errors: [{ errorId: 2003 }] }, 500);
      if (mode.priv === 'vide') return rep({ sellerRegistrationCompleted: true });
      return rep({ sellerRegistrationCompleted: true, sellingLimit: { amount: { currency: 'EUR', value: '500.0' }, quantity: 10 } });
    }
    if (u.includes('/sell/negotiation/v1/find_eligible_items')) {
      if (mode.eligibles === '204') return rep(null, 204);
      if (mode.eligibles === 'ko') return rep({ errors: [{ errorId: 150000, message: 'System error' }] }, 500);
      return rep({ eligibleItems: [{ listingId: ELIGIBLE }], total: 1, limit: 200, offset: 0 });
    }
    if (u.includes('/sell/negotiation/v1/send_offer_to_interested_buyers')) {
      if (mode.envoi === 'refus') return rep({ errors: [{ errorId: 150020, longMessage: 'Offre refusée par eBay. Bearer at-J v^1.1#SECRET-QUI-FUIRAIT' }] }, 400);
      return rep({ offers: [{ offerId: 'o1', offerStatus: 'PENDING' }, { offerId: 'o2', offerStatus: 'PENDING' }] });
    }
    if (u.includes('/sell/fulfillment/v1/order')) return mode.commandes === 'ko' ? rep({ errors: [] }, 500) : rep({ orders: [{ orderId: '01-0001', lineItems: [{ sku: 'VRM-24' }] }], total: 1 });
    return rep({ orders: [], inventoryItems: [], total: 0 });
  }
  if (u.includes('/rest/v1/rpc/vrm_acces_pour')) {
    let qui = ''; try { qui = JSON.parse(opts.body || '{}').u; } catch (_) {}
    return rep(qui !== C);
  }
  if (u.includes('/rest/v1/app_data')) {
    const q = decodeURIComponent(u);
    if (/select=owner&limit=1/.test(q)) return NON_CLOISONNEE ? rep({ message: 'column app_data.owner does not exist' }, 400) : rep([]);
    if (m !== 'GET') {
      let rows = []; try { rows = [].concat(JSON.parse(opts.body || '[]')); } catch (_) {}
      // Un PATCH porte `{data}` sans identifiant (il est dans l'adresse) : on le
      // journalise sous la forme d'une écriture `[{id, owner, data}]`, pour que
      // les contrôles qui cherchent « ce qui a été écrit dans ebay_offres »
      // lisent la même chose quelle que soit la forme (POST ou PATCH).
      if (m === 'PATCH') {
        const pid0 = (/[?&]id=eq\.([^&]*)/.exec(q) || [])[1], pown0 = (/[?&]owner=eq\.([^&]*)/.exec(q) || [])[1];
        rows = rows.map((r) => ({ id: pid0, ...(pown0 ? { owner: pown0 } : {}), ...r }));
      }
      // (9 octobre) Une ÉCRITURE de `ebay_offres*` qui échoue (toujours, ou
      // après la première) : la base debout par ailleurs.
      if (rows.some((r) => /^ebay_offres/.test(String(r.id || ''))) || /[?&]id=eq\.ebay_offres/.test(q)) {
        ecrituresOffres++;
        if (mode.offresEcritureKo || (mode.offresEcritureKoApres && ecrituresOffres > 1)) { journal.push({ ou: 'base-ko', m, u: q, corps: m === 'PATCH' ? JSON.stringify(rows) : String(opts.body || ''), seq: ++seq }); return rep({ message: 'boom' }, 500); }
      }
      journal.push({ ou: 'base', m, u: q, corps: m === 'PATCH' ? JSON.stringify(rows) : String(opts.body || ''), seq: ++seq });
      // (11 octobre) LES DEUX FORMES DU COMPARER-ET-ÉCHANGER (§6.3 : servir la
      // forme que le code envoie). PATCH filtré (id, owner, `data->>rev`) : ne
      // touche que la ligne dont la version est celle LUE, rend les lignes
      // modifiées. POST SANS `on_conflict` : insertion seule, 409 si la ligne
      // existe déjà (la vraie base répond 23505).
      if (m === 'PATCH') {
        const pid = (/[?&]id=eq\.([^&]*)/.exec(q) || [])[1];
        const pown = (/[?&]owner=eq\.([^&]*)/.exec(q) || [])[1];
        const revEq = (/[?&]data->>rev=eq\.([^&]*)/.exec(q) || [])[1];
        const revNul = /[?&]data->>rev=is\.null/.test(q);
        const corps = { data: rows[0] && rows[0].data };
        const touche = lignes.filter((x) => x.id === pid && (!pown || x.owner === pown)
          && (revNul ? (x.data == null || x.data.rev == null) : (revEq === undefined || (x.data && x.data.rev != null && String(x.data.rev) === revEq))));
        for (const x of touche) Object.assign(x, corps);
        return rep(touche.map((x) => ({ id: x.id })));
      }
      if (m === 'POST' && !/on_conflict=/.test(q)) {
        const doublon = rows.some((r) => lignes.some((x) => x.id === r.id && (NON_CLOISONNEE || x.owner === r.owner)));
        if (doublon) return rep({ code: '23505', message: 'duplicate key value violates unique constraint' }, 409);
      }
      for (const r of rows) {
        const cle = NON_CLOISONNEE ? (x) => x.id === r.id : (x) => x.id === r.id && x.owner === r.owner;
        const i = lignes.findIndex(cle);
        if (i >= 0) lignes[i] = { ...lignes[i], ...r }; else lignes.push({ ...r });
      }
      return rep('', 201);
    }
    journal.push({ ou: 'lecture', m, u: q });
    const id = (/[?&]id=eq\.([^&]*)/.exec(q) || [])[1];
    const owner = (/[?&]owner=eq\.([^&]*)/.exec(q) || [])[1];
    const sel = (/[?&]select=([^&]*)/.exec(q) || [])[1];
    // Une lecture qui échoue, ligne par ligne (retrait automatique, 6 octobre).
    if (id === 'main' && mode.mainKo) return rep({ message: 'boom' }, 500);
    if (id === 'ebay_retraits_auto' && mode.journalKo) return rep({ message: 'boom' }, 500);
    if (id === 'ebay_listings' && mode.listingsKo) return rep({ message: 'boom' }, 500);
    if (id === 'ebay_comptes' && mode.comptesKo) return rep({ message: 'boom' }, 500);
    if (/^ebay_offres/.test(String(id || '')) && mode.offresKo) return rep({ message: 'boom' }, 500);
    const out = lignes.filter((r) => (!id || r.id === id) && (!owner || r.owner === owner));
    return rep(out.map((r) => projette(r, sel)));
  }
  return rep({});
};
const faireRes = () => {
  const x = { code: null, corps: null, entetes: {} };
  x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; };
  x.setHeader = (k, v) => { x.entetes[String(k).toLowerCase()] = v; }; x.end = () => x; return x;
};

// ── LA RÈGLE DE L'APP (extraite d'App.jsx, exécutée) — §11 ────────────────────
function extraire(src, nom) {
  const re = new RegExp(`^(?:async )?function ${nom}\\(|^const ${nom} = `, 'm');
  const m = re.exec(src);
  if (!m) return '';
  let i = m.index, prof = 0, vuCorps = false;
  const estFn = /function/.test(m[0]);
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') {
      prof--;
      if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1);
    } else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}
const APP = (() => { try { return fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8'); } catch (_) { return ''; } })();
const RA = {};
{
  const noms = ['cleNum', 'NUM_OK', 'numDeSkuEbay', 'skuEbayDe'];
  const srcs = noms.map((n) => extraire(APP, n));
  if (srcs.every(Boolean)) {
    const ctx = {}; vm.createContext(ctx);
    try { vm.runInContext(srcs.join('\n') + '\n;this.R = { cleNum, NUM_OK, numDeSkuEbay, skuEbayDe };', ctx); Object.assign(RA, ctx.R || {}); } catch (_) {}
  }
  const suf = extraire(APP, 'suffixeCompteEbay'), cle = extraire(APP, 'CLE_COMPTE_EBAY');
  if (suf && cle) { const c2 = {}; vm.createContext(c2); try { vm.runInContext(cle + '\n' + suf + '\n;this.f = suffixeCompteEbay;', c2); RA.suffixeCompteEbay = c2.f; } catch (_) {} }
}

(async () => {
  let route;
  await essaie('chargement', async () => { route = await import('file://' + path.join(RACINE, 'api', 'ebay.js')); });
  if (!route) { console.log('\n❌ audit-ebay-route : la route n\'a pas pu être chargée'); process.exit(1); }
  const app = async (jwt, corps) => {
    journal.length = 0;
    const res = faireRes();
    await route.default({ method: 'POST', query: {}, headers: jwt ? { authorization: 'Bearer ' + jwt } : {}, body: corps }, res);
    return { code: res.code, corps: res.corps, journal: journal.slice(), entetes: res.entetes };
  };
  // Le retour d'eBay, tel que le NAVIGATEUR le fait : avec ses cookies (le
  // nonce posé par `authurl`), ou sans (le navigateur de quelqu'un d'autre).
  const retourEbay = async (query, cookie) => {
    journal.length = 0;
    const res = faireRes();
    await route.default({ method: 'GET', query: { mode: 'callback', ...query }, headers: cookie ? { cookie } : {} }, res);
    return { code: res.code, loc: res.entetes.location || '', journal: journal.slice(), cookie: String(res.entetes['set-cookie'] || '') };
  };
  // Le cookie que le navigateur renverra, lu dans le Set-Cookie d'`authurl`.
  const cookieDe = (d) => { const m = /^(vrm_ebay_etat=[^;]*)/.exec(String((d && d.entetes && d.entetes['set-cookie']) || '')); return m ? m[1] : ''; };
  let cookieB = '', cookieJ = '';
  const chezEbay = (j) => j.filter((x) => x.ou === 'ebay');
  // Ce qui part chez eBay SANS compter le renouvellement du jeton (qui ne fait
  // rien au compte) : les vrais appels au compte eBay.
  const auCompte = (j) => chezEbay(j).filter((x) => !/oauth2\/token/.test(x.u));
  const appels = (j) => auCompte(j).map((x) => x.appel || x.u.replace(/^.*\/v1\//, '')).join(',');
  const ecritJetons = (j) => j.some((x) => x.ou === 'base' && /ebay_tokens|rt-de-B|rt-neuf/.test(x.u + ' ' + x.corps));
  const sansJeton = (o) => !/at-J|at-B|rt-de-|rt-neuf|v\^1\.1#|Bearer/.test(JSON.stringify(o && o.corps || {}));
  const ecrit = (j, id) => {
    const w = j.filter((x) => x.ou === 'base' && x.corps.includes(`"id":"${id}"`));
    if (!w.length) return null;
    try { return [].concat(JSON.parse(w[w.length - 1].corps)).find((r) => r.id === id) || null; } catch (_) { return null; }
  };

  // ════ BASE PAS ENCORE CLOISONNÉE : exactement comme avant (processus fils) ══
  if (NON_CLOISONNEE) {
    await essaie('np propriétaire', async () => {
      const o = await app(JWT_J, { action: 'status' });
      const lec = o.journal.filter((x) => x.ou === 'lecture' && /ebay_tokens/.test(x.u));
      dit(o.code === 200 && o.corps && o.corps.connected === true && lec.length && lec.every((x) => !/owner=eq/.test(x.u)),
        'base non cloisonnée : le propriétaire voit son compte eBay, lu SANS filtre de vendeur (comme avant)', `HTTP ${o.code} · ${lec.map((x) => x.u).join(' ')}`);
    });
    await essaie('np autre vendeur', async () => {
      for (const action of ['sync', 'status', 'authurl', 'programmer', 'regleoffre', 'regleoffrelire']) {
        const o = await app(JWT_B, { action, confirme: true, itemId: '110000000001', accepte: 70, prixVu: 80, attendu: 'inconnu', itemIds: ['110000000001'] });
        dit(o.code === 403 && chezEbay(o.journal).length === 0,
          `base non cloisonnée : un autre vendeur ne pilote pas « ${action} » (un seul jeu de données, celui de l'installation)`, `HTTP ${o.code} · ${chezEbay(o.journal).length} appel(s) eBay`);
      }
    });
    await essaie('np plusieurs comptes', async () => {
      const a = await app(JWT_J, { action: 'authurl', ajout: true });
      const s = await app(JWT_J, { action: 'sync', compte: 'a'.repeat(16) });
      dit(a.code === 409 && s.code === 404 && chezEbay(s.journal).length === 0,
        "base non cloisonnée : un seul compte eBay, comme avant (« connecter un autre compte » refusé, un `compte` ne désigne rien)", `${a.code}/${s.code}`);
      const d = await app(JWT_J, { action: 'authurl' });
      const etat = decodeURIComponent((/[?&]state=([^&]+)/.exec((d.corps && d.corps.url) || '') || [])[1] || '');
      const r = await retourEbay({ code: 'code-A2', state: etat }, cookieDe(d));
      const getUser = chezEbay(r.journal).some((x) => x.appel === 'GetUser');
      const w = r.journal.find((x) => x.ou === 'base' && /ebay_tokens/.test(x.corps));
      dit(/ebay=connecte/.test(r.loc) && !getUser && w && /"id":"ebay_tokens"/.test(w.corps) && !r.journal.some((x) => x.ou === 'base' && /ebay_comptes/.test(x.corps)),
        'base non cloisonnée : le retour range dans ebay_tokens comme avant — ni GetUser, ni registre', `${r.loc} · GetUser=${getUser}`);
    });
    await essaie('np écriture', async () => {
      const o = await app(JWT_J, { action: 'sync' });
      const w = o.journal.find((x) => x.ou === 'base' && /ebay_listings/.test(x.corps));
      dit(!!w && /on_conflict=owner,id/.test(w.u) && /"owner":"11111111/.test(w.corps),
        'base non cloisonnée : l\'écriture garde la forme d\'avant (VRM_OWNER_UID, cible owner,id)', w ? w.u : 'aucune écriture');
    });
    console.log(`NC ok=${ok} ko=${ko}`);
    process.exit(ko ? 1 : 0);
  }

  // ── 1. Session obligatoire ─────────────────────────────────────────────────
  const TOUTES = ['sync', 'finances', 'publish', 'revise', 'sku', 'offreinfo', 'offre', 'retirer', 'programmer', 'programmees', 'deprogrammer', 'reprogrammer', 'limites', 'regleoffre', 'regleoffrelire'];
  for (const action of TOUTES) {
    await essaie('sans session : ' + action, async () => {
      const o = await app('', { action, item: { title: 'x' }, itemId: '110000000001', listingId: ELIGIBLE, numero: '22', remise: 10, confirme: true, price: '10' });
      dit(o.code === 401 && chezEbay(o.journal).length === 0,
        `sans session, « ${action} » est refusé et rien ne part chez eBay`,
        `HTTP ${o.code} · ${chezEbay(o.journal).length} appel(s) eBay`);
    });
  }
  await essaie('jeton falsifié', async () => {
    const o = await app('eyJh.faux.sig', { action: 'finances' });
    dit(o.code === 401 && chezEbay(o.journal).length === 0, 'un jeton que le service d\'identité ne reconnaît pas est refusé', `HTTP ${o.code}`);
  });
  await essaie('abonnement coupé', async () => {
    for (const action of ['status', 'sync', 'programmer', 'authurl']) {
      const o = await app(JWT_C, { action, confirme: true });
      dit(o.code === 402 && chezEbay(o.journal).length === 0,
        `un vendeur dont l'abonnement est coupé ne pilote pas « ${action} » (402, zéro appel eBay)`, `HTTP ${o.code}`);
    }
  });

  // ── 2. CHAQUE VENDEUR SON eBAY ─────────────────────────────────────────────
  await essaie('Julien, ligne d\'avant', async () => {
    remettreBase(); remettre();
    const o = await app(JWT_J, { action: 'status' });
    const lec = o.journal.filter((x) => x.ou === 'lecture' && /ebay_tokens/.test(x.u));
    dit(o.code === 200 && o.corps && o.corps.connected === true,
      "la ligne d'avant de Julien (owner = VRM_OWNER_UID) marche sans rien refaire : son compte eBay est relié", `HTTP ${o.code} ${JSON.stringify(o.corps)}`);
    dit(lec.length > 0 && lec.every((x) => /owner=eq\.11111111-1111-1111-1111-111111111111/.test(x.u)),
      'et ses jetons sont lus filtrés sur LUI (owner=eq.J), jamais « la première ligne venue »', lec.map((x) => x.u.replace(/^.*app_data/, '')).join(' '));
  });
  await essaie('B pas encore relié', async () => {
    remettreBase(); remettre();
    const s = await app(JWT_B, { action: 'status' });
    dit(s.code === 200 && s.corps && s.corps.connected === false,
      "un autre vendeur connecté voit SON état : pas de compte eBay relié (jamais celui de Julien)", `HTTP ${s.code} ${JSON.stringify(s.corps)}`);
    for (const action of ['sync', 'sku', 'offreinfo', 'offre', 'retirer', 'programmees', 'limites']) {
      const o = await app(JWT_B, { action, itemId: '110000000001', listingId: ELIGIBLE, numero: '22', remise: 10, confirme: true });
      const jetonJ = chezEbay(o.journal).some((x) => /rt-de-J/.test(x.corps) || x.jeton === 'at-J');
      dit(o.code === 401 && o.corps && o.corps.reason === 'not-connected' && auCompte(o.journal).length === 0 && !jetonJ,
        `B, sans eBay relié, ne pilote pas « ${action} » sur le compte de Julien : « aucun compte eBay relié », zéro appel, jamais le jeton de Julien`,
        `HTTP ${o.code} · ${o.corps && o.corps.reason} · ${auCompte(o.journal).length} appel(s) · jeton de J : ${jetonJ}`);
    }
  });
  let etatB = '', etatJ = '';
  // ⚠️⚠️ LE LIEN D'UN AUTRE (revue du 6 octobre) : B envoie SON lien de
  // consentement à Julien ; Julien accepte chez eBay ; SON navigateur revient
  // avec SON code et le state de B — mais sans le nonce de B. Rien ne doit
  // être rangé, chez personne.
  await essaie('le lien d\'un autre', async () => {
    remettreBase(); remettre();
    const d = await app(JWT_B, { action: 'authurl' });
    const etat = decodeURIComponent((/[?&]state=([^&]+)/.exec((d.corps && d.corps.url) || '') || [])[1] || '');
    const avant = JSON.stringify(lignes);
    const sansCookie = await retourEbay({ code: 'CODE-DE-LA-VICTIME', state: etat });
    const dJ = await app(JWT_J, { action: 'authurl' });
    const autreNonce = await retourEbay({ code: 'CODE-DE-LA-VICTIME', state: etat }, cookieDe(dJ));
    const n = chezEbay(sansCookie.journal).length + chezEbay(autreNonce.journal).length;
    dit(n === 0 && !ecritJetons(sansCookie.journal) && !ecritJetons(autreNonce.journal) && JSON.stringify(lignes) === avant && /ebay=erreur/.test(sansCookie.loc) && /ebay=erreur/.test(autreNonce.loc),
      'le lien de B ouvert dans le navigateur de Julien (sans le nonce de B, ou avec le sien) : aucun échange, aucun jeton rangé chez B', `${n} appel(s) eBay · ${sansCookie.loc}`);
    const jb = lignes.find((x) => x.owner === B && x.id === 'ebay_tokens');
    dit(!jb, 'et B n\'a toujours aucun eBay relié', jb ? JSON.stringify(jb.data) : 'aucun');
  });
  await essaie('B relie SON eBay', async () => {
    remettreBase(); remettre();
    const d = await app(JWT_B, { action: 'authurl' });
    etatB = decodeURIComponent((/[?&]state=([^&]+)/.exec((d.corps && d.corps.url) || '') || [])[1] || '');
    dit(d.code === 200 && etatB.includes(B), 'B demande la connexion : le state signé PORTE son identifiant', etatB || `HTTP ${d.code}`);
    cookieB = cookieDe(d);
    const sc = String((d.entetes || {})['set-cookie'] || '');
    dit(/^vrm_ebay_etat=[0-9a-f]{32};/.test(sc) && /HttpOnly/.test(sc) && /Secure/.test(sc) && /SameSite=Lax/.test(sc) && /Path=\/api\//.test(sc) && !(d.corps && JSON.stringify(d.corps).includes(cookieB.split('=')[1] || '§')),
      'et la demande pose un NONCE dans un cookie HttpOnly, Secure, SameSite=Lax (jamais dans la réponse lisible par la page)', sc || 'aucun cookie');
    const r = await retourEbay({ code: 'code-de-B', state: etatB }, cookieB);
    dit(/vrm_ebay_etat=;/.test(r.cookie) && /Max-Age=0/.test(r.cookie), 'le retour EFFACE le nonce (un lien, un seul retour)', r.cookie || 'cookie gardé');
    const w = r.journal.filter((x) => x.ou === 'base' && /ebay_tokens/.test(x.corps));
    let ligne = null; try { ligne = [].concat(JSON.parse((w[0] || {}).corps || '[]'))[0]; } catch (_) {}
    dit(/ebay=connecte/.test(r.loc) && ligne && ligne.owner === B && ligne.data && ligne.data.refresh_token === 'rt-de-B' && /on_conflict=owner,id/.test((w[0] || {}).u || ''),
      'au retour, les jetons de B sont rangés CHEZ B (owner = B, cible owner,id)', `${r.loc} · ${ligne ? 'owner=' + ligne.owner : 'rien rangé'}`);
    const j = lignes.find((x) => x.owner === J && x.id === 'ebay_tokens');
    dit(j && j.data.refresh_token === 'rt-de-J', 'et la connexion eBay de Julien n\'a pas bougé', j ? j.data.refresh_token : 'disparue');
  });
  await essaie('B pilote SON eBay', async () => {
    remettre();
    const o = await app(JWT_B, { action: 'sync' });
    const parti = auCompte(o.journal);
    dit(o.code === 200 && parti.length > 0 && parti.every((x) => x.jeton === 'at-B'),
      'la synchro de B part chez eBay avec SON jeton (at-B), jamais celui de Julien', parti.map((x) => x.jeton).join(','));
    const L = ecrit(o.journal, 'ebay_listings');
    dit(L && L.owner === B && L.data && Array.isArray(L.data.items) && L.data.items.length === 0,
      'et elle range SES annonces chez lui (owner = B, ses 0 annonces) — pas celles de Julien', L ? `owner=${L.owner} · ${L.data.items.length} annonce(s)` : 'rien rangé');
    const lec = o.journal.filter((x) => x.ou === 'lecture' && /app_data\?id=eq/.test(x.u));
    dit(lec.length > 0 && lec.every((x) => /owner=eq\.22222222/.test(x.u)), 'toutes les lectures de B sont filtrées sur B', lec.map((x) => x.u.replace(/^.*app_data/, '')).join(' '));
    const oJ = await app(JWT_J, { action: 'sync' });
    const LJ = ecrit(oJ.journal, 'ebay_listings');
    dit(auCompte(oJ.journal).every((x) => x.jeton === 'at-J') && LJ && LJ.owner === J && LJ.data.items.length === 2,
      'pendant ce temps, la synchro de Julien lit SON eBay et range chez LUI (2 annonces)', LJ ? `owner=${LJ.owner} · ${LJ.data.items.length}` : 'rien rangé');
  });
  await essaie('state falsifié', async () => {
    remettre();
    const d = await app(JWT_J, { action: 'authurl' });
    etatJ = decodeURIComponent((/[?&]state=([^&]+)/.exec((d.corps && d.corps.url) || '') || [])[1] || '');
    cookieJ = cookieDe(d);
    const [ts, , mac] = etatJ.split('.');
    // Le state de Julien, dont on remplace le vendeur par B : la signature ne colle plus.
    const forge = [ts, B, mac].join('.');
    const avant = JSON.stringify(lignes);
    const r1 = await retourEbay({ code: 'code-d-un-inconnu', state: forge }, cookieJ);
    const r2 = await retourEbay({ code: 'code-d-un-inconnu', state: ts + '.' + J + '.' + '0'.repeat(40) }, cookieJ);
    const r3 = await retourEbay({ code: 'code-d-un-inconnu', state: 'vrm' }, cookieJ);
    const r4 = await retourEbay({ code: 'code-d-un-inconnu' }, cookieJ);
    const n = [r1, r2, r3, r4].reduce((s, r) => s + chezEbay(r.journal).length, 0);
    dit(n === 0 && ![r1, r2, r3, r4].some((r) => ecritJetons(r.journal)) && JSON.stringify(lignes) === avant,
      'un state falsifié (vendeur remplacé, signature au hasard, « vrm », absent) : aucun échange, aucun jeton rangé chez personne', `${n} appel(s) eBay`);
  });
  await essaie('retour expiré', async () => {
    const vrai = Date.now;
    try {
      Date.now = () => vrai() + 31 * MIN;
      const o = await retourEbay({ code: 'code-de-B', state: etatB }, cookieB);
      dit(chezEbay(o.journal).length === 0, 'une demande de plus de 30 minutes ne sert plus', `${chezEbay(o.journal).length} appel(s) eBay`);
    } finally { Date.now = vrai; }
  });
  await essaie('retour valide de Julien', async () => {
    remettreBase();
    const o = await retourEbay({ code: 'code-de-julien', state: etatJ }, cookieJ);
    const w = o.journal.find((x) => x.ou === 'base' && /ebay_tokens/.test(x.corps));
    dit(/ebay=connecte/.test(o.loc) && w && /"owner":"11111111/.test(w.corps), "l'autre sens : la connexion que Julien a lui-même demandée aboutit, chez lui", o.loc);
  });

  // ── 3. CE QUI ENGAGE EXIGE `confirme:true` — vérifié AVANT eBay ────────────
  remettreBase();
  for (const [action, corps] of [['retirer', { itemId: '110000000001' }], ['offre', { listingId: ELIGIBLE, remise: 10 }],
    ['retirer', { itemId: '110000000001', confirme: 'true' }], ['offre', { listingId: ELIGIBLE, remise: 10, confirme: 1 }],
    ['programmer', { item: {}, uuid: 'A'.repeat(32), fraisVus: 0.2 }], ['deprogrammer', { itemId: '110000000001' }], ['reprogrammer', { itemId: '110000000001', scheduleTime: iso(Date.now() + 2 * JOUR) }]]) {
    await essaie('confirmation ' + action, async () => {
      remettre();
      const o = await app(JWT_J, { action, ...corps });
      dit(o.code === 400 && o.corps && o.corps.reason === 'confirmation' && chezEbay(o.journal).length === 0,
        `« ${action} » sans confirmation explicite (${JSON.stringify(corps.confirme)}) est refusé, zéro appel eBay`,
        `HTTP ${o.code} · ${o.corps && (o.corps.reason || o.corps.error)} · ${chezEbay(o.journal).length} appel(s) eBay`);
    });
  }
  // ── 4. VALIDATION : remise, identifiants, numéro — zéro appel eBay ─────────
  for (const remise of [4, 51, 10.5, '12abc', null]) {
    await essaie('remise ' + remise, async () => {
      const o = await app(JWT_J, { action: 'offre', listingId: ELIGIBLE, remise, confirme: true });
      dit(o.code === 400 && o.corps && o.corps.reason === 'remise' && chezEbay(o.journal).length === 0,
        `une remise de ${JSON.stringify(remise)} % est refusée (entre 5 et 50, entière), zéro appel eBay`, `HTTP ${o.code}`);
    });
  }
  for (const [action, corps] of [['retirer', { itemId: '12a', confirme: true }], ['retirer', { itemId: '110</ItemID><X>', confirme: true }],
    ['sku', { itemId: '1 2', numero: '22' }], ['offre', { listingId: '1;2', remise: 10, confirme: true }], ['offre', { listingId: '', remise: 10, confirme: true }],
    ['deprogrammer', { itemId: '11a', confirme: true }]]) {
    await essaie('identifiant ' + action, async () => {
      const o = await app(JWT_J, { action, ...corps });
      dit(o.code === 400 && /annonce eBay invalide/.test((o.corps && o.corps.error) || '') && chezEbay(o.journal).length === 0,
        `« ${action} » refuse un identifiant qui n'est pas que des chiffres (${JSON.stringify(corps.itemId || corps.listingId)}), zéro appel eBay`, `HTTP ${o.code}`);
    });
  }
  for (const numero of ['zz', '', 'B1234567', '1234567', 'ABCD1', null]) {
    await essaie('numéro ' + numero, async () => {
      const o = await app(JWT_J, { action: 'sku', itemId: '110000000002', numero });
      dit(o.code === 400 && o.corps && o.corps.reason === 'numero' && chezEbay(o.journal).length === 0,
        `« sku » refuse un numéro illisible (${JSON.stringify(numero)}), zéro appel eBay`, `HTTP ${o.code}`);
    });
  }
  await essaie('message trop long', async () => {
    const o = await app(JWT_J, { action: 'offre', listingId: ELIGIBLE, remise: 10, confirme: true, message: 'x'.repeat(2001) });
    dit(o.code === 400 && o.corps && o.corps.reason === 'message' && chezEbay(o.journal).length === 0, 'un message de plus de 2 000 caractères est refusé, zéro appel eBay', `HTTP ${o.code}`);
  });

  // ── 5. CE QUI PART CHEZ eBAY (publier, relier, offre, retirer) ─────────────
  await essaie('règle de l\'app chargée', async () => {
    dit(typeof RA.skuEbayDe === 'function' && typeof RA.numDeSkuEbay === 'function',
      "la règle du SKU existe dans l'app (`skuEbayDe`, `numDeSkuEbay`) et se charge", Object.keys(RA).join(',') || 'absente');
  });
  for (const numero of ['22', '007', 'b125', ' B-125 ', 'c 12', 'AB3']) {
    await essaie('sku ' + numero, async () => {
      remettre();
      const o = await app(JWT_J, { action: 'sku', itemId: '110000000002', numero });
      const a = auCompte(o.journal);
      const corps = (a[0] && a[0].corps) || '';
      const skuEnvoye = (/<SKU>([^<]*)<\/SKU>/.exec(corps) || [])[1] || '';
      const attendu = RA.skuEbayDe ? RA.skuEbayDe(numero) : '(règle de l\'app absente)';
      dit(o.code === 200 && a.length === 1 && a[0].appel === 'ReviseFixedPriceItem'
          && /<Item><ItemID>110000000002<\/ItemID><SKU>/.test(corps) && skuEnvoye === attendu && o.corps.sku === attendu,
        `« sku » ${JSON.stringify(numero)} ⇒ ReviseFixedPriceItem pose ${attendu} — la même règle que l'app`, `HTTP ${o.code} · envoyé ${skuEnvoye || '∅'}`);
      dit(!!RA.numDeSkuEbay && RA.numDeSkuEbay(skuEnvoye) === RA.cleNum(numero),
        `et l'app relit ${skuEnvoye || '∅'} comme le N°${RA.cleNum ? RA.cleNum(numero) : '?'} (aller-retour sans perte)`);
    });
  }
  await essaie('lecture stricte du SKU', async () => {
    const cas = { 'VRM-22': '22', 'vrm-b125': 'B125', 'VRM 7': '7', '12345-ABC': '', 'VRM-22X': '', 'XVRM-22': '', '22': '', 'VAR-42': '' };
    const faux = RA.numDeSkuEbay ? Object.entries(cas).filter(([s, n]) => RA.numDeSkuEbay(s) !== n) : [['(absente)', '']];
    dit(faux.length === 0, "l'app ne lit un numéro QUE dans un SKU « VRM-… » entier", faux.map(([s]) => s).join(' · '));
  });
  const item = { title: 'Nike Dunk Low panda T42', categoryId: '15709', price: '100', conditionId: '3000', photos: ['https://img.test/1.jpg'], aspects: { Marque: 'Nike' }, ebayGere: true };
  await essaie('publish avec numéro', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'publish', item: { ...item, numero: '401' } });
    const add = auCompte(o.journal).find((x) => x.appel === 'AddFixedPriceItem');
    dit(o.code === 200 && add && /<SKU>VRM-401<\/SKU>/.test(add.corps) && o.corps.sku === 'VRM-401', 'une paire publiée part avec son SKU VRM-401', `HTTP ${o.code}`);
  });
  await essaie('publish : rien de recopié du navigateur', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'publish', item: { ...item, sku: 'EVIL-1', scheduleTime: iso(Date.now() + 2 * JOUR), uuid: 'B'.repeat(32) } });
    const add = auCompte(o.journal).find((x) => x.appel === 'AddFixedPriceItem');
    dit(o.code === 200 && add && !/<SKU>/.test(add.corps) && !/<ScheduleTime>/.test(add.corps) && !/<UUID>/.test(add.corps),
      "sans numéro, aucun SKU — et un `sku`, une heure ou un UUID glissés dans `item` ne sont jamais recopiés", add ? add.corps.slice(0, 80) : 'aucun appel');
  });
  await essaie('pubverify avec numéro', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'pubverify', item: { ...item, numero: 'b7' } });
    const v = auCompte(o.journal).find((x) => x.appel === 'VerifyAddFixedPriceItem');
    dit(o.code === 200 && v && /<SKU>VRM-B7<\/SKU>/.test(v.corps), 'la vérification à blanc porte le MÊME SKU que la publication (VRM-B7)');
  });
  await essaie('publish numéro illisible', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'publish', item: { ...item, numero: 'zz' } });
    dit(o.code === 400 && auCompte(o.journal).length === 0, 'un numéro de paire illisible ⇒ rien n\'est publié (pas de faux lien)', `HTTP ${o.code}`);
  });
  await essaie('offreinfo', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'offreinfo' });
    const e = auCompte(o.journal)[0] || {};
    dit(o.code === 200 && o.corps && JSON.stringify(o.corps.eligibles) === JSON.stringify([ELIGIBLE]) && /find_eligible_items/.test(e.u) && e.marche === 'EBAY_FR',
      '« offreinfo » lit find_eligible_items (marché EBAY_FR) et rend les annonces éligibles', `HTTP ${o.code}`);
    mode.eligibles = '204';
    const o2 = await app(JWT_J, { action: 'offreinfo' });
    dit(o2.code === 200 && o2.corps && Array.isArray(o2.corps.eligibles) && o2.corps.eligibles.length === 0, 'eBay répond 204 ⇒ « lu, aucune », pas une panne', `HTTP ${o2.code}`);
    mode.eligibles = 'ko';
    const o3 = await app(JWT_J, { action: 'offreinfo' });
    dit(o3.code >= 500 && o3.corps && o3.corps.ok === false && !('eligibles' in o3.corps), 'eBay en panne ⇒ « pas su » — jamais « aucun observateur »', `HTTP ${o3.code}`);
  });
  await essaie('offre éligible', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'offre', listingId: ELIGIBLE, remise: 15, confirme: true, message: 'Toujours dispo, envoi rapide.' });
    const a = auCompte(o.journal);
    const post = a.find((x) => /send_offer_to_interested_buyers/.test(x.u));
    let corps = null; try { corps = JSON.parse(post && post.corps); } catch (_) {}
    dit(o.code === 200 && o.corps && o.corps.envoyees === 2, 'une offre confirmée sur une annonce éligible part, et la réponse dit à combien de personnes', `HTTP ${o.code}`);
    dit(a.length === 2 && /find_eligible_items/.test(a[0].u) && post && post.m === 'POST', "l'éligibilité est REVÉRIFIÉE chez eBay juste avant l'envoi");
    dit(!!corps && corps.offeredItems && corps.offeredItems[0].discountPercentage === '15' && corps.allowCounterOffer === false && corps.offerDuration.value === 2, 'le corps envoyé à eBay est celui attendu (remise « 15 », 48 h, pas de contre-offre)', JSON.stringify(corps));
  });
  await essaie('offre non éligible', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'offre', listingId: '110000000099', remise: 10, confirme: true });
    dit(o.code === 409 && !auCompte(o.journal).some((x) => /send_offer/.test(x.u)), 'une annonce non éligible ⇒ refusée, RIEN n\'est posté', `HTTP ${o.code}`);
  });
  await essaie('offre vérification en panne', async () => {
    remettre(); mode.eligibles = 'ko';
    const o = await app(JWT_J, { action: 'offre', listingId: ELIGIBLE, remise: 10, confirme: true });
    dit(o.code >= 500 && !auCompte(o.journal).some((x) => /send_offer/.test(x.u)), "la vérification d'éligibilité échoue ⇒ RIEN n'est posté", `HTTP ${o.code}`);
  });
  await essaie('offre refusée par eBay', async () => {
    remettre(); mode.envoi = 'refus';
    const o = await app(JWT_J, { action: 'offre', listingId: ELIGIBLE, remise: 10, confirme: true });
    dit(o.code === 400 && /Offre refusée par eBay/.test((o.corps && o.corps.error) || '') && sansJeton(o), "un refus d'eBay remonte avec SON message — sans aucun jeton dedans", `HTTP ${o.code}`);
  });
  await essaie('retirer', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    const e = auCompte(o.journal);
    dit(o.code === 200 && e.length === 1 && e[0].appel === 'EndFixedPriceItem' && /<ItemID>110000000001<\/ItemID><EndingReason>NotAvailable<\/EndingReason>/.test(e[0].corps),
      '« retirer » confirmé ⇒ EndFixedPriceItem (ItemID, raison NotAvailable), un seul appel', `HTTP ${o.code} · ${appels(o.journal)}`);
    mode.trading = 'refus';
    const o2 = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    dit(o2.code >= 400 && /déjà terminée/.test((o2.corps && o2.corps.error) || '') && sansJeton(o2), "un refus d'eBay remonte avec son message, sans jeton", `HTTP ${o2.code}`);
    mode.trading = 'reseau';
    const o3 = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    dit(o3.code === 504 && o3.corps && o3.corps.reason === 'incertain', 'eBay ne répond pas ⇒ « je ne sais pas si elle a été retirée »', `HTTP ${o3.code}`);
  });
  // L'annonce terminée sort de la liste rangée TOUT DE SUITE (revue du 6
  // octobre) : sinon l'alerte « à retirer » restait, et le retrait automatique
  // reprenait la même annonce à chaque ouverture. Lecture ratée ⇒ rien d'écrit.
  await essaie('retirer : la liste rangée suit', async () => {
    remettre(); remettreBase();
    lignes.push({ owner: J, id: 'ebay_listings', data: { items: [{ itemId: '110000000001', sku: 'VRM-22' }, { itemId: '110000000002', sku: '' }], capturedAt: 5 } });
    const o = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    const L = lignes.find((x) => x.owner === J && x.id === 'ebay_listings');
    const ids = L && L.data && Array.isArray(L.data.items) ? L.data.items.map((x) => x.itemId) : [];
    dit(o.code === 200 && o.corps.listes === true && ids.length === 1 && ids[0] === '110000000002' && L.data.capturedAt === 5,
      'après un retrait réussi, l\'annonce terminée sort de ebay_listings (les autres et la date de capture restent)', `HTTP ${o.code} · listes=${o.corps && o.corps.listes} · ${ids.join(',')}`);
    remettre(); remettreBase();
    lignes.push({ owner: J, id: 'ebay_listings', data: { items: [{ itemId: '110000000001', sku: 'VRM-22' }, { itemId: '110000000002', sku: '' }], capturedAt: 5 } });
    mode.listingsKo = true;
    const o2 = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    const ecritL = o2.journal.some((x) => x.ou === 'base' && /ebay_listings/.test(x.corps));
    dit(o2.code === 200 && o2.corps.listes === null && !ecritL, 'liste rangée illisible ⇒ le retrait est dit fait, la liste n\'est PAS réécrite depuis une lecture ratée', `listes=${o2.corps && o2.corps.listes} · écrite=${ecritL}`);
  });
  await essaie('modifier : réponse sans Ack', async () => {
    remettre(); mode.trading = 'reseau';
    const o = await app(JWT_J, { action: 'revise', itemId: '110000000001', price: '70' });
    dit(o.code === 504 && o.corps.reason === 'incertain', 'changer un prix, réseau coupé ⇒ « incertain », jamais « eBay a refusé »', `HTTP ${o.code} · ${o.corps && o.corps.error}`);
    remettre(); mode.trading = 'refus';
    const o2 = await app(JWT_J, { action: 'revise', itemId: '110000000001', price: '70' });
    dit(o2.code !== 504 && o2.corps.ok === false && o2.corps.reason !== 'incertain', 'l\'autre sens : un vrai refus (Ack Failure) reste un refus', `HTTP ${o2.code}`);
  });

  // ── 5 bis. LE RETRAIT AUTOMATIQUE (proposition 8, 6 octobre) ──────────────
  //    L'interrupteur est relu PAR LA ROUTE dans SA ligne `main` ; le SKU de
  //    l'annonce est redemandé à eBay et doit être celui de la paire vendue.
  await essaie('retrait automatique', async () => {
    const fin = (o) => auCompte(o.journal).some((x) => x.appel === 'EndFixedPriceItem');
    const AUTO = { action: 'retirer', itemId: '110000000001', confirme: true, auto: true, sku: 'VRM-22', titre: 'Adidas Gazelle bleu taille 40' };
    remettre(); remettreBase();
    let o = await app(JWT_J, AUTO);
    dit(o.code === 403 && o.corps.reason === 'auto-eteint' && !fin(o), 'automatique, interrupteur jamais allumé ⇒ 403, rien n\'est envoyé à eBay', `HTTP ${o.code} · ${appels(o.journal)}`);
    remettre(); remettreBase(); lignes.push({ owner: J, id: 'main', data: { vrm_ebay_retrait_auto: false } });
    o = await app(JWT_J, AUTO);
    dit(o.code === 403 && !fin(o), 'interrupteur éteint ⇒ rien n\'est envoyé', `HTTP ${o.code}`);
    remettre(); remettreBase(); lignes.push({ owner: J, id: 'main', data: { vrm_ebay_retrait_auto: true } }); mode.mainKo = true;
    o = await app(JWT_J, AUTO);
    dit(o.code === 503 && o.corps.reason === 'reglage-pas-su' && !fin(o), 'réglage illisible ⇒ « pas su » ne vaut pas « allumé » : rien n\'est envoyé', `HTTP ${o.code}`);
    remettre(); remettreBase(); lignes.push({ owner: J, id: 'main', data: { vrm_ebay_retrait_auto: true } });
    o = await app(JWT_J, { ...AUTO, sku: '' });
    dit(o.code === 400 && !fin(o), 'automatique sans SKU de paire ⇒ refusé avant eBay', `HTTP ${o.code}`);
    mode.getitem = 'autre';
    o = await app(JWT_J, AUTO);
    dit(o.code === 409 && o.corps.reason === 'sku-change' && !fin(o), 'l\'annonce eBay ne porte plus ce SKU ⇒ 409, rien n\'est retiré (identité, §5)', `HTTP ${o.code} · ${appels(o.journal)}`);
    remettre(); remettreBase(); lignes.push({ owner: J, id: 'main', data: { vrm_ebay_retrait_auto: true } });
    o = await app(JWT_J, AUTO);
    const ordre = auCompte(o.journal).map((x) => x.appel).filter(Boolean);
    const jr = lignes.find((r) => r.id === 'ebay_retraits_auto' && r.owner === J);
    dit(o.code === 200 && ordre.indexOf('GetItem') >= 0 && ordre.indexOf('GetItem') < ordre.indexOf('EndFixedPriceItem'), 'allumé et même SKU ⇒ eBay est relu PUIS l\'annonce est terminée', `HTTP ${o.code} · ${ordre.join(',')}`);
    dit(jr && jr.data && Array.isArray(jr.data.items) && jr.data.items[0].sku === 'VRM-22' && o.corps.journal === true, 'et le retrait est NOTÉ (il peut relire ce qui a été fait en son nom)', JSON.stringify(jr && jr.data));
    remettre(); remettreBase(); lignes.push({ owner: J, id: 'main', data: { vrm_ebay_retrait_auto: true } }, { owner: J, id: 'ebay_retraits_auto', data: { items: [{ itemId: '1', sku: 'VRM-1', at: 1 }] } }); mode.journalKo = true;
    o = await app(JWT_J, AUTO);
    const jr2 = lignes.find((r) => r.id === 'ebay_retraits_auto' && r.owner === J);
    dit(o.code === 200 && o.corps.journal === false && jr2.data.items.length === 1 && jr2.data.items[0].sku === 'VRM-1', 'journal illisible ⇒ il n\'est PAS réécrit depuis le vide (son historique reste)', JSON.stringify(jr2 && jr2.data));
    remettre(); remettreBase();
    o = await app(JWT_B, AUTO);
    dit(!fin(o), 'un AUTRE vendeur ne retire rien chez Julien, même en « automatique »', `HTTP ${o.code}`);
  });

  // ── 6. LES FRAIS, PAR NOM ; LES ERREURS, TOUTES ────────────────────────────
  await essaie('frais par nom', async () => {
    remettre(); mode.verif = 'cher';
    const o = await app(JWT_J, { action: 'pubverify', item: { ...item, numero: '22' } });
    const f = (o.corps && o.corps.frais) || {};
    dit(o.code === 200 && o.corps.fees === 0.55 && f.total === 0.55 && f.insertion === 0.35,
      'les frais sont lus PAR NOM : total = ListingFee 0,55 € (tout additionner donnait 0,90 €)', `fees=${o.corps && o.corps.fees} · ${JSON.stringify({ total: f.total, insertion: f.insertion })}`);
    mode.verif = 'sansTotal';
    const o2 = await app(JWT_J, { action: 'pubverify', item: { ...item, numero: '22' } });
    dit(o2.code === 200 && o2.corps && o2.corps.fees === null && o2.corps.frais && o2.corps.frais.total === null,
      'ListingFee absent ⇒ total « pas su » (null) — jamais 0', `fees=${o2.corps && o2.corps.fees}`);
  });
  await essaie('frais de programmation', async () => {
    remettre();
    const quand = iso(Date.now() + 2 * JOUR);
    const o = await app(JWT_J, { action: 'pubverify', item: { ...item, numero: '22' }, scheduleTime: quand });
    const v = auCompte(o.journal).find((x) => x.appel === 'VerifyAddFixedPriceItem');
    dit(o.code === 200 && o.corps.frais && o.corps.frais.programmation === 0.2 && o.corps.programme === quand && v && new RegExp(`<Item>[\\s\\S]*<ScheduleTime>${quand}</ScheduleTime>[\\s\\S]*</Item>`).test(v.corps) && !/<UUID>/.test(v.corps),
      'vérifier avec une heure ⇒ <ScheduleTime> dans <Item>, frais de programmation lu par nom (0,20 €), aucun UUID', `prog=${o.corps && o.corps.frais && o.corps.frais.programmation}`);
    const o2 = await app(JWT_J, { action: 'pubverify', item: { ...item, numero: '22' }, scheduleTime: '2026-10-11 18:00' });
    dit(o2.code === 400 && o2.corps.reason === 'heure' && auCompte(o2.journal).length === 0, 'une heure mal formée à la vérification ⇒ 400, zéro appel eBay', `HTTP ${o2.code}`);
  });
  await essaie('toutes les erreurs', async () => {
    remettre(); mode.add = 'deuxErreurs';
    const o = await app(JWT_J, { action: 'publish', item: { ...item, numero: '23' } });
    dit(o.code >= 400 && /catégorie ne convient pas/.test((o.corps && o.corps.error) || '') && !/titre est long/.test((o.corps && o.corps.error) || ''),
      'deux <Errors> (un Warning PUIS une Error) ⇒ c\'est le message de l\'ERREUR qui est rendu', `HTTP ${o.code} · ${o.corps && o.corps.error}`);
  });

  // ── 7. PROGRAMMER ──────────────────────────────────────────────────────────
  const UUID1 = 'ABCDEF0123456789ABCDEF0123456789';
  const prog = (extra) => ({ action: 'programmer', confirme: true, uuid: UUID1, fraisVus: 0.2, scheduleTime: iso(Date.now() + 2 * JOUR), item: { ...item, numero: '30' }, ...(extra || {}) });
  for (const [nom, st] of [['format', '2026-10-11 18:00'], ['passée', iso(Date.now() - H)], ['+5 min', iso(Date.now() + 5 * MIN)], ['+22 jours', iso(Date.now() + 22 * JOUR)], ['date impossible', '2026-02-30T10:00:00.000Z']]) {
    await essaie('heure ' + nom, async () => {
      remettre();
      const o = await app(JWT_J, prog({ scheduleTime: st }));
      dit(o.code === 400 && o.corps && o.corps.reason === 'heure' && chezEbay(o.journal).length === 0, `programmer avec une heure ${nom} (${st}) ⇒ 400 « heure », zéro appel eBay`, `HTTP ${o.code} · ${o.corps && o.corps.reason}`);
    });
  }
  await essaie('programmer sans numéro', async () => {
    remettre();
    const o = await app(JWT_J, prog({ item: { ...item } }));
    dit(o.code === 400 && o.corps.reason === 'numero' && chezEbay(o.journal).length === 0, 'programmer EXIGE un N° (sans lui, une paire vendue ailleurs ne se retrouve pas) — 400, zéro appel', `HTTP ${o.code}`);
  });
  await essaie('programmer sans état', async () => {
    remettre();
    const it2 = { ...item, numero: '30' }; delete it2.conditionId;
    const o = await app(JWT_J, prog({ item: it2 }));
    dit(o.code === 400 && o.corps.reason === 'champs' && chezEbay(o.journal).length === 0 && !auCompte(o.journal).some((x) => /<ConditionID>3000/.test(x.corps)),
      "programmer sans l'état de l'objet ⇒ 400 « champs » (plus d'« Occasion » posé en silence)", `HTTP ${o.code}`);
  });
  await essaie('programmer uuid / frais vus', async () => {
    remettre();
    const o = await app(JWT_J, prog({ uuid: 'abc' }));
    const o2 = await app(JWT_J, prog({ fraisVus: undefined }));
    const o3 = await app(JWT_J, prog({ fraisVus: '0.2' }));
    dit(o.code === 400 && o.corps.reason === 'uuid' && o2.code === 400 && o2.corps.reason === 'frais-vus' && o3.code === 400 && chezEbay([...o.journal, ...o2.journal, ...o3.journal]).length === 0,
      'un UUID mal formé, ou des frais vus absents ⇒ 400, zéro appel eBay', `${o.code}/${o2.code}/${o3.code}`);
  });
  let addCorps = '', verifCorps = '';
  await essaie('programmer : l\'ordre et le corps', async () => {
    remettre();
    const p = prog({ item: { ...item, numero: 'b 125', sku: 'VRM-999' } });
    const o = await app(JWT_J, p);
    const a = auCompte(o.journal);
    const v = a.find((x) => x.appel === 'VerifyAddFixedPriceItem'), ad = a.find((x) => x.appel === 'AddFixedPriceItem');
    verifCorps = (v && v.corps) || ''; addCorps = (ad && ad.corps) || '';
    dit(o.code === 200 && o.corps.ok === true && a.map((x) => x.appel).join(',') === 'GetMyeBaySelling,VerifyAddFixedPriceItem,AddFixedPriceItem',
      'programmer ⇒ relire ses annonces, PUIS vérifier à blanc, PUIS ajouter — dans cet ordre', `HTTP ${o.code} · ${appels(o.journal)}`);
    dit(/<SKU>VRM-B125<\/SKU>/.test(addCorps) && !/VRM-999/.test(addCorps), 'le SKU vient du N° (« b 125 » ⇒ VRM-B125), jamais du `sku` du navigateur', (/<SKU>[^<]*<\/SKU>/.exec(addCorps) || ['∅'])[0]);
    const itemDe = (s) => (/<Item>[\s\S]*<\/Item>/.exec(s) || [''])[0];
    dit(/<UUID>ABCDEF0123456789ABCDEF0123456789<\/UUID>/.test(itemDe(addCorps)) && !/<UUID>/.test(verifCorps),
      "l'UUID part à l'AJOUT (dans <Item>) et jamais à la vérification");
    dit(itemDe(addCorps).replace(/<UUID>[^<]*<\/UUID>/, '') === itemDe(verifCorps),
      "la vérification et l'ajout envoient le MÊME <Item>, à l'UUID près");
    dit(new RegExp(`<Item>[\\s\\S]*<ScheduleTime>${p.scheduleTime}</ScheduleTime>[\\s\\S]*</Item>`).test(addCorps), `<ScheduleTime> part en UTC DANS <Item> (${p.scheduleTime})`);
    dit(o.corps.debut === p.scheduleTime && /^\d+$/.test(o.corps.itemId) && o.corps.enLigneMaintenant === false && o.corps.frais && o.corps.frais.programmation === 0.2,
      "la réponse rend l'ItemID et l'heure RETENUE par eBay, et les frais lus par nom", JSON.stringify({ id: o.corps.itemId, debut: o.corps.debut }));
    const lg = /<GetMyeBaySellingRequest[\s\S]*<ActiveList><Include>true<\/Include>[\s\S]*<ScheduledList><Include>true<\/Include>/.test((a[0] || {}).corps || '');
    dit(lg, 'la relecture demande les annonces EN LIGNE et PROGRAMMÉES (<ScheduledList><Include>true)');
    dit(!o.journal.some((x) => x.ou === 'base'), "programmer n'écrit rien en base (la vérité est chez eBay)");
  });
  await essaie('programmer : une paire, une annonce', async () => {
    remettre();
    ebay['at-J'].programmees.push(annonce('110000000500', 'Salomon XT-6', 'VRM-30', '120.0', iso(Date.now() + 3 * JOUR)));
    const o = await app(JWT_J, prog());
    dit(o.code === 409 && o.corps.reason === 'deja-programmee' && o.corps.itemId === '110000000500' && !auCompte(o.journal).some((x) => /Verify|AddFixed/.test(x.appel)),
      'la paire N°30 déjà PROGRAMMÉE sur eBay ⇒ 409, ni vérification ni ajout', `HTTP ${o.code} · ${appels(o.journal)}`);
    remettre();
    ebay['at-J'].actives.push(annonce('110000000501', 'Salomon XT-6', 'VRM-30', '120.0', '2026-09-01T10:00:00.000Z'));
    const o2 = await app(JWT_J, prog());
    dit(o2.code === 409 && o2.corps.reason === 'deja-en-ligne' && !auCompte(o2.journal).some((x) => /AddFixed/.test(x.appel)),
      'la paire déjà EN LIGNE sur eBay ⇒ 409 « déjà en vente », rien d\'ajouté', `HTTP ${o2.code}`);
    remettre(); mode.liste = 'ko';
    const o3 = await app(JWT_J, prog());
    dit(o3.code === 503 && o3.corps.reason === 'pas-su' && !auCompte(o3.journal).some((x) => /AddFixed|Verify/.test(x.appel)),
      'ses annonces illisibles ⇒ 503 « pas su », rien n\'est programmé', `HTTP ${o3.code}`);
    // Plus de 5 pages de programmées : la liste est INCOMPLÈTE, l'absence de la
    // paire n'est pas prouvée.
    remettre();
    for (let k = 0; k < 7; k++) ebay['at-J'].programmees.push(annonce('11000000097' + k, 'P' + k, 'VRM-6' + k, '10.0', iso(Date.now() + JOUR)));
    ebay['at-J'].pagesProg = 7;
    const o4 = await app(JWT_J, prog());
    const lectures = auCompte(o4.journal).filter((x) => x.appel === 'GetMyeBaySelling').length;
    dit(o4.code === 503 && o4.corps.reason === 'pas-su' && lectures === 5 && !auCompte(o4.journal).some((x) => /AddFixed|Verify/.test(x.appel)),
      'plus de 5 pages de programmées ⇒ liste incomplète (5 pages lues) : l\'absence n\'est pas prouvée, rien n\'est programmé', `HTTP ${o4.code} · ${lectures} page(s)`);
  });
  // « VRM-030 », « vrm-30 », « VRM 30 » (retapé dans le Seller Hub) désignent
  // la N°30 — la même lecture que l'app (revue du 6 octobre).
  await essaie('une paire, une annonce : formes du SKU', async () => {
    for (const forme of ['VRM-030', 'vrm-30', 'VRM 30', 'VRM30']) {
      remettre();
      ebay['at-J'].programmees.push(annonce('110000000510', 'Salomon XT-6', forme, '120.0', iso(Date.now() + 3 * JOUR)));
      const o = await app(JWT_J, prog());
      remettre();
      ebay['at-J'].actives.push(annonce('110000000511', 'Salomon XT-6', forme, '120.0', '2026-09-01T10:00:00.000Z'));
      const o2 = await app(JWT_J, { action: 'publish', item: { ...item, numero: '30' } });
      dit(o.code === 409 && o.corps.reason === 'deja-programmee' && o2.code === 409 && o2.corps.reason === 'deja-en-ligne' && ![o, o2].some((x) => auCompte(x.journal).some((y) => /AddFixed/.test(y.appel))),
        `une annonce sous « ${forme} » est la N°30 : programmer et publier la refusent (409), rien d'ajouté`, `programmer HTTP ${o.code} · publier HTTP ${o2.code}`);
    }
    remettre();
    ebay['at-J'].actives.push(annonce('110000000512', 'Autre', 'VRM-300', '50.0', '2026-09-01T10:00:00.000Z'));
    const o3 = await app(JWT_J, { action: 'publish', item: { ...item, numero: '30' } });
    dit(o3.code === 200 && o3.corps.ok === true, 'l\'autre sens : « VRM-300 » n\'est PAS la N°30 — la publication part', `HTTP ${o3.code}`);
  });
  // « Publier » avait AUCUNE garde : une paire déjà en vente ou programmée
  // repartait en seconde annonce (revue du 6 octobre, prouvé).
  await essaie('publier : une paire, une annonce', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'publish', item: { ...item, numero: '22' } });
    const n = ebay['at-J'].actives.filter((x) => x.sku === 'VRM-22').length;
    dit(o.code === 409 && o.corps.reason === 'deja-en-ligne' && n === 1 && !auCompte(o.journal).some((x) => /AddFixed/.test(x.appel)),
      'publier la N°22, déjà EN LIGNE ⇒ 409, eBay n\'a toujours qu\'une annonce VRM-22', `HTTP ${o.code} · ${n} annonce(s)`);
    remettre();
    ebay['at-J'].programmees.push(annonce('110000000777', 'Salomon XT-6', 'VRM-30', '120.0', iso(Date.now() + JOUR)));
    const o2 = await app(JWT_J, { action: 'publish', item: { ...item, numero: '30' } });
    const n2 = [...ebay['at-J'].actives, ...ebay['at-J'].programmees].filter((x) => x.sku === 'VRM-30').length;
    dit(o2.code === 409 && o2.corps.reason === 'deja-programmee' && o2.corps.itemId === '110000000777' && n2 === 1,
      'publier la N°30, PROGRAMMÉE pour demain ⇒ 409 « déjà programmée », une seule annonce VRM-30', `HTTP ${o2.code} · ${n2} annonce(s)`);
    remettre(); mode.liste = 'ko';
    const o3 = await app(JWT_J, { action: 'publish', item: { ...item, numero: '30' } });
    dit(o3.code === 503 && o3.corps.reason === 'pas-su' && !auCompte(o3.journal).some((x) => /AddFixed/.test(x.appel)),
      'ses annonces illisibles ⇒ 503 « pas su », rien n\'est publié', `HTTP ${o3.code}`);
    remettre();
    const o4 = await app(JWT_J, { action: 'publish', item: { ...item } });
    dit(o4.code === 200 && o4.corps.ok === true && !auCompte(o4.journal).some((x) => x.appel === 'GetMyeBaySelling'),
      'l\'autre sens : une annonce SANS N° (pas de SKU, rien à comparer) part comme avant', `HTTP ${o4.code} · ${appels(o4.journal)}`);
  });
  // Une passerelle 5xx sans <Ack> APRÈS qu'eBay a agi : « incertain », jamais
  // « refusé » (sinon le brouillon reste à republier — une seconde annonce).
  await essaie('eBay sans réponse claire', async () => {
    remettre(); uuidsVus.clear(); mode.add = '503-apres';
    const o = await app(JWT_J, prog());
    const n = ebay['at-J'].programmees.filter((x) => x.sku === 'VRM-30').length;
    dit(o.code === 504 && o.corps.reason === 'incertain' && n === 1, 'programmer : eBay crée l\'annonce puis répond 503 en HTML ⇒ 504 « incertain », jamais « refusée »', `HTTP ${o.code} · ${o.corps && o.corps.error}`);
    remettre(); mode.add = '503-apres';
    const o2 = await app(JWT_J, { action: 'publish', item: { ...item, numero: '401' } });
    dit(o2.code === 504 && o2.corps.reason === 'incertain', 'publier : même cas ⇒ 504 « incertain »', `HTTP ${o2.code}`);
    const avecProg0 = (dans) => { remettre(); ebay['at-J'].programmees.push(annonce('110000000900', 'Salomon XT-6', 'VRM-30', '120.0', iso(Date.now() + dans))); };
    avecProg0(2 * JOUR); mode.end = '503-apres';
    const o3 = await app(JWT_J, { action: 'deprogrammer', itemId: '110000000900', confirme: true });
    dit(o3.code === 504 && o3.corps.reason === 'incertain', 'annuler : eBay annule puis répond 503 ⇒ « incertain », jamais « eBay a refusé »', `HTTP ${o3.code}`);
    avecProg0(3 * JOUR); mode.revise = '503-apres';
    const o4 = await app(JWT_J, { action: 'reprogrammer', itemId: '110000000900', scheduleTime: iso(Date.now() + 4 * JOUR), confirme: true });
    dit(o4.code === 504 && o4.corps.reason === 'incertain', 'déplacer : même cas ⇒ « incertain »', `HTTP ${o4.code}`);
    remettre(); mode.end = '503-apres';
    const o5 = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    dit(o5.code === 504 && o5.corps.reason === 'incertain', 'retirer : même cas ⇒ « incertain »', `HTTP ${o5.code}`);
    remettre(); mode.end = 'refus';
    const o6 = await app(JWT_J, { action: 'retirer', itemId: '110000000001', confirme: true });
    dit(o6.code !== 504 && o6.corps.ok === false && o6.corps.reason !== 'incertain', 'l\'autre sens : un VRAI refus d\'eBay (Ack Failure) reste un refus', `HTTP ${o6.code}`);
  });
  await essaie('programmer : les frais', async () => {
    remettre(); mode.verif = 'cher';
    const o = await app(JWT_J, prog({ fraisVus: 0.2 }));
    dit(o.code === 409 && o.corps.reason === 'frais' && !auCompte(o.journal).some((x) => x.appel === 'AddFixedPriceItem'),
      'eBay annonce 0,55 € quand il en a vu 0,20 € ⇒ 409 « frais », AUCUN ajout', `HTTP ${o.code}`);
    remettre(); mode.verif = 'sansTotal';
    const o2 = await app(JWT_J, prog());
    dit(o2.code === 502 && o2.corps.reason === 'frais-pas-su' && !auCompte(o2.journal).some((x) => x.appel === 'AddFixedPriceItem'),
      'eBay n\'annonce pas son total ⇒ rien n\'est programmé sans connaître les frais', `HTTP ${o2.code}`);
    remettre(); mode.verif = 'refus';
    const o3 = await app(JWT_J, prog());
    dit(o3.code === 200 && o3.corps.ok === false && o3.corps.etape === 'verif' && /trop petite/.test(o3.corps.error || '') && !auCompte(o3.journal).some((x) => x.appel === 'AddFixedPriceItem'),
      'eBay refuserait à la vérification ⇒ son message remonte, rien n\'est ajouté', `HTTP ${o3.code}`);
  });
  await essaie('programmer : eBay ignore ou décale l\'heure', async () => {
    remettre(); mode.add = 'decale';
    const p = prog();
    const o = await app(JWT_J, p);
    dit(o.code === 200 && o.corps.debut === iso(Date.parse(p.scheduleTime) + 15 * MIN) && o.corps.demande === p.scheduleTime,
      "eBay retient un quart d'heure plus tard ⇒ c'est SON heure qui est rendue (`debut`), à côté de la demande", `debut=${o.corps && o.corps.debut}`);
    remettre(); mode.add = 'maintenant';
    const o2 = await app(JWT_J, prog());
    dit(o2.code === 200 && o2.corps.enLigneMaintenant === true, "eBay l'a mise en ligne TOUT DE SUITE ⇒ `enLigneMaintenant`, jamais « programmée »", `enLigneMaintenant=${o2.corps && o2.corps.enLigneMaintenant}`);
  });
  await essaie('programmer : coupure puis second envoi', async () => {
    remettre(); uuidsVus.clear(); mode.add = 'reseau-apres';
    const o = await app(JWT_J, prog());
    dit(o.code === 504 && o.corps.reason === 'incertain', 'le réseau tombe après l\'ajout ⇒ « incertain », jamais « refusée »', `HTTP ${o.code}`);
    mode.add = 'ok';
    const o2 = await app(JWT_J, prog());
    const n = ebay['at-J'].programmees.filter((x) => x.sku === 'VRM-30').length;
    dit(o2.code === 409 && o2.corps.reason === 'deja-programmee' && n === 1,
      'le second envoi trouve la paire déjà programmée (relue par SKU) ⇒ eBay n\'a qu\'UNE annonce pour elle', `HTTP ${o2.code} · ${n} annonce(s)`);
  });
  await essaie('programmer : 488', async () => {
    remettre(); uuidsVus.clear(); mode.add = '488';
    const o = await app(JWT_J, prog());
    dit(o.code === 200 && o.corps.ok === true && o.corps.deja === true && /^\d+$/.test(o.corps.itemId) && auCompte(o.journal).some((x) => x.appel === 'GetItem'),
      '488 « UUID déjà utilisé » CONFIRMÉ par GetItem (même SKU) ⇒ « déjà programmée », avec son ItemID', `HTTP ${o.code} · ${appels(o.journal)}`);
    remettre(); uuidsVus.clear(); mode.add = '488'; mode.getitem = 'autre';
    const o2 = await app(JWT_J, prog());
    dit(o2.code === 504 && o2.corps.reason === 'incertain' && o2.corps.ok === false, '488 dont l\'annonce porte un AUTRE SKU ⇒ « incertain », jamais ok', `HTTP ${o2.code}`);
  });
  await essaie('programmer tout de suite', async () => {
    remettre();
    const o = await app(JWT_J, prog({ scheduleTime: '', fraisVus: 0 }));
    const ad = auCompte(o.journal).find((x) => x.appel === 'AddFixedPriceItem');
    dit(o.code === 200 && ad && !/<ScheduleTime>/.test(ad.corps) && /<UUID>/.test(ad.corps),
      'sans heure (« tout de suite ») : aucun <ScheduleTime>, mais toujours l\'UUID et la relecture', `HTTP ${o.code}`);
  });
  await essaie('programmer : rien ne fuit', async () => {
    remettre(); mode.add = 'deuxErreurs';
    const o = await app(JWT_J, prog());
    dit(o.code === 422 && sansJeton(o) && !/<\?xml|<Errors>/.test(JSON.stringify(o.corps)), 'un refus rend le message d\'eBay — ni jeton, ni XML brut', `HTTP ${o.code}`);
  });

  // ── 8. LIRE LES PROGRAMMÉES · LA SYNCHRO DÉCOUPÉE PAR CONTENEUR ────────────
  await essaie('programmees', async () => {
    remettre();
    ebay['at-J'].programmees.push(annonce('110000000600', 'New Balance 550', 'VRM-24', '90.0', iso(Date.now() + JOUR)));
    const o = await app(JWT_J, { action: 'programmees' });
    const w = ecrit(o.journal, 'ebay_programmees');
    dit(o.code === 200 && o.corps.items.length === 1 && o.corps.items[0].sku === 'VRM-24' && o.corps.items[0].debut && w && w.owner === J && w.data.items.length === 1,
      '« programmees » lit la liste des programmées et la range chez le vendeur', `HTTP ${o.code} · ${w ? w.owner : 'rien rangé'}`);
    dit(Array.isArray(o.corps.enLigne) && o.corps.enLigne.some((x) => x.sku === 'VRM-22'), 'et rend les identités EN LIGNE (ce qui dit qu\'une programmée est bien partie)');
    mode.liste = 'ko';
    const o2 = await app(JWT_J, { action: 'programmees' });
    dit(o2.code >= 500 && ecrit(o2.journal, 'ebay_programmees') === null,
      'eBay ne répond pas ⇒ 5xx et AUCUNE écriture : la dernière capture reste (« rien lu » ne vaut pas « rien »)', `HTTP ${o2.code}`);
  });
  await essaie('pagination des programmées', async () => {
    remettre();
    ebay['at-J'].programmees.push(annonce('110000000701', 'A', 'VRM-41', '10.0', iso(Date.now() + JOUR)), annonce('110000000702', 'B', 'VRM-42', '10.0', iso(Date.now() + JOUR)));
    ebay['at-J'].pagesProg = 2;
    const o = await app(JWT_J, { action: 'programmees' });
    const ls = auCompte(o.journal).filter((x) => x.appel === 'GetMyeBaySelling');
    dit(o.code === 200 && o.corps.items.length === 2 && ls.length === 2 && /<ScheduledList>[\s\S]*<PageNumber>2<\/PageNumber>/.test(ls[1].corps) && !/<ActiveList>/.test(ls[1].corps),
      'deux pages de programmées ⇒ la page 2 est lue (et seulement la liste qui en a une)', `${o.corps && o.corps.items.length} programmée(s) · ${ls.length} appel(s)`);
  });
  await essaie('sync découpée par conteneur', async () => {
    remettre();
    ebay['at-J'].actives = [ANNONCES_J()[0]];
    ebay['at-J'].programmees = [annonce('110000000800', 'Asics Gel', 'VRM-25', '70.0', iso(Date.now() + 2 * JOUR))];
    const o = await app(JWT_J, { action: 'sync' });
    const L = ecrit(o.journal, 'ebay_listings'), P = ecrit(o.journal, 'ebay_programmees');
    dit(L && L.data.items.length === 1 && L.data.items[0].itemId === '110000000001' && P && P.data.items.length === 1 && P.data.items[0].itemId === '110000000800',
      'la synchro range 1 annonce EN LIGNE et 1 PROGRAMMÉE, chacune à sa place (une programmée n\'est jamais « en ligne »)',
      `en ligne : ${L ? L.data.items.map((x) => x.itemId).join(',') : '∅'} · programmées : ${P ? P.data.items.map((x) => x.itemId).join(',') : '∅'}`);
  });
  await essaie('sync', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'sync' });
    const L = ecrit(o.journal, 'ebay_listings');
    const a1 = L && L.data.items.find((x) => x.itemId === '110000000001');
    const a2 = L && L.data.items.find((x) => x.itemId === '110000000002');
    dit(o.code === 200 && !!a1 && a1.sku === 'VRM-22', 'la synchro range le SKU de chaque annonce (VRM-22)', a1 ? 'sku=' + a1.sku : 'rien rangé');
    dit(!!a2 && a2.sku === '', "le SKU d'une VARIANTE ne devient pas celui de l'annonce", a2 ? 'sku=' + JSON.stringify(a2.sku) : 'absente');
    dit(!!a1 && a1.observateurs === 3 && a1.vues === '3' && !!a2 && a2.observateurs === null, 'les observateurs sont rangés en nombre — absents ⇒ null, jamais 0');
    dit(sansJeton(o), 'la réponse de la synchro ne transporte aucun jeton');
  });
  await essaie('sync annonces illisibles', async () => {
    remettre(); mode.liste = 'ko';
    const o = await app(JWT_J, { action: 'sync' });
    dit(ecrit(o.journal, 'ebay_listings') === null && ecrit(o.journal, 'ebay_programmees') === null,
      'eBay ne rend pas les annonces ⇒ annonces ET programmées gardent leur dernière capture');
  });
  await essaie('sync commandes illisibles', async () => {
    remettre(); mode.commandes = 'ko';
    const o = await app(JWT_J, { action: 'sync' });
    dit(ecrit(o.journal, 'ebay_orders') === null && ecrit(o.journal, 'ebay_listings') !== null,
      'eBay ne rend pas les commandes ⇒ elles gardent leur dernière capture, les annonces lues sont rangées quand même');
  });

  // ── 9. ANNULER · DÉPLACER ──────────────────────────────────────────────────
  const avecProg = (debutDans) => { remettre(); ebay['at-J'].programmees.push(annonce('110000000900', 'Salomon XT-6', 'VRM-30', '120.0', iso(Date.now() + debutDans))); };
  await essaie('annuler', async () => {
    avecProg(2 * JOUR);
    const o = await app(JWT_J, { action: 'deprogrammer', itemId: '110000000900', confirme: true });
    dit(o.code === 200 && o.corps.ok === true && o.corps.verifie === true && appels(o.journal) === 'GetMyeBaySelling,EndFixedPriceItem,GetMyeBaySelling',
      'annuler une programmée ⇒ relire, EndFixedPriceItem, relire : elle a disparu (verifie:true)', `HTTP ${o.code} · ${appels(o.journal)}`);
    avecProg(2 * JOUR); mode.end = 'refus';
    const o2 = await app(JWT_J, { action: 'deprogrammer', itemId: '110000000900', confirme: true });
    dit(o2.code === 422 && o2.corps.reason === 'refus' && /ne peut pas être terminée/.test(o2.corps.error || ''),
      "eBay refuse l'annulation ⇒ SA réponse remonte telle quelle (l'écran renvoie au Seller Hub)", `HTTP ${o2.code} · ${o2.corps && o2.corps.error}`);
    avecProg(2 * JOUR); mode.end = 'reste';
    const o3 = await app(JWT_J, { action: 'deprogrammer', itemId: '110000000900', confirme: true });
    dit(o3.code === 409 && o3.corps.reason === 'toujours-programmee', 'eBay dit « fait » mais elle est toujours programmée ⇒ on le dit (409), jamais « annulée »', `HTTP ${o3.code}`);
    remettre();
    const o4 = await app(JWT_J, { action: 'deprogrammer', itemId: '110000000001', confirme: true });
    dit(o4.code === 409 && o4.corps.reason === 'pas-programmee' && o4.corps.enLigne === true && !auCompte(o4.journal).some((x) => x.appel === 'EndFixedPriceItem'),
      'une annonce déjà EN LIGNE n\'est pas « annulée » ici (409, renvoi vers « Retirer d\'eBay »), zéro End', `HTTP ${o4.code}`);
    remettre(); mode.liste = 'ko';
    const o5 = await app(JWT_J, { action: 'deprogrammer', itemId: '110000000900', confirme: true });
    dit(o5.code === 503 && !auCompte(o5.journal).some((x) => x.appel === 'EndFixedPriceItem'), 'liste illisible ⇒ 503, on ne termine jamais à l\'aveugle', `HTTP ${o5.code}`);
  });
  await essaie('déplacer', async () => {
    avecProg(3 * H);
    const nouv = iso(Date.now() + 2 * JOUR);
    const o = await app(JWT_J, { action: 'reprogrammer', itemId: '110000000900', scheduleTime: nouv, confirme: true });
    const rv = auCompte(o.journal).find((x) => x.appel === 'ReviseFixedPriceItem');
    dit(o.code === 200 && rv && new RegExp(`<Item><ItemID>110000000900</ItemID><ScheduleTime>${nouv}</ScheduleTime></Item>`).test(rv.corps) && o.corps.debut === nouv,
      'déplacer à plus d\'1 h du départ ⇒ ReviseFixedPriceItem avec la nouvelle heure UTC, relue chez eBay', `HTTP ${o.code} · debut=${o.corps && o.corps.debut}`);
    avecProg(40 * MIN);
    const o2 = await app(JWT_J, { action: 'reprogrammer', itemId: '110000000900', scheduleTime: nouv, confirme: true });
    dit(o2.code === 409 && o2.corps.reason === 'derniere-heure' && !auCompte(o2.journal).some((x) => x.appel === 'ReviseFixedPriceItem'),
      'à moins d\'1 h du départ (relu chez eBay) ⇒ 409 « dernière heure », zéro Revise', `HTTP ${o2.code}`);
    avecProg(3 * H);
    const o3 = await app(JWT_J, { action: 'reprogrammer', itemId: '110000000900', scheduleTime: iso(Date.now() + 22 * JOUR), confirme: true });
    dit(o3.code === 400 && o3.corps.reason === 'heure' && chezEbay(o3.journal).length === 0, 'une nouvelle heure à plus de 3 semaines ⇒ 400, zéro appel', `HTTP ${o3.code}`);
  });

  // ── 10. LIMITES DE VENTE ───────────────────────────────────────────────────
  await essaie('limites', async () => {
    remettre();
    const o = await app(JWT_J, { action: 'limites' });
    const e = auCompte(o.journal)[0] || {};
    dit(o.code === 200 && o.corps.quantite === 10 && o.corps.montant === 500 && o.corps.devise === 'EUR' && /sell\/account\/v1\/privilege/.test(e.u),
      '« limites » lit /sell/account/v1/privilege : 10 annonces, 500 € par mois', JSON.stringify(o.corps));
    mode.priv = 'vide';
    const o2 = await app(JWT_J, { action: 'limites' });
    dit(o2.code === 200 && o2.corps.quantite === null && o2.corps.montant === null, 'aucune limite dans la réponse ⇒ null (« pas su »), jamais 0', JSON.stringify(o2.corps));
    mode.priv = '403';
    const o3 = await app(JWT_J, { action: 'limites' });
    dit(o3.corps && o3.corps.ok === false && o3.corps.reason === 'scope' && !('quantite' in o3.corps), 'droit refusé ⇒ « scope », aucun nombre');
    mode.priv = '500';
    const o4 = await app(JWT_J, { action: 'limites' });
    dit(o4.code >= 500 && o4.corps.ok === false && !('quantite' in o4.corps), 'eBay en panne ⇒ échec dit, aucun nombre inventé', `HTTP ${o4.code}`);
  });

  // ── 12. PLUSIEURS COMPTES eBAY PAR VENDEUR (9 octobre) ─────────────────────
  //    Julien : « donne la possibilité d'avoir plusieurs comptes eBay connectés,
  //    si c'est possible uniquement avec la connexion ». Deux comptes chez lui
  //    (julien_part = le principal d'aujourd'hui, julien_pro = A2), un chez B.
  const crypto = require('crypto');
  const cleDe = (eias) => crypto.createHash('sha256').update('vrm-ebay-compte|' + eias).digest('hex').slice(0, 16);
  const CLE_A1 = cleDe(IDENTITES['at-J'][1]), CLE_A2 = cleDe(IDENTITES['at-A2'][1]), CLE_A3 = cleDe(IDENTITES['at-A3'][1]);
  const registre = (owner) => { const l = lignes.find((x) => x.owner === owner && x.id === 'ebay_comptes'); return l && l.data && Array.isArray(l.data.comptes) ? l.data.comptes : null; };
  const jetons = (owner, id) => { const l = lignes.find((x) => x.owner === owner && x.id === id); return l && l.data ? l.data.refresh_token : undefined; };
  const etatDe = (d) => decodeURIComponent((/[?&]state=([^&]+)/.exec((d.corps && d.corps.url) || '') || [])[1] || '');
  // Le vrai parcours : l'app demande l'adresse, eBay renvoie le navigateur
  // (avec son cookie) et un code — le code dit QUEL compte eBay a consenti.
  const connecter = async (jwt, code, ajout) => {
    const d = await app(jwt, { action: 'authurl', ...(ajout ? { ajout: true } : {}) });
    return retourEbay({ code, state: etatDe(d) }, cookieDe(d));
  };
  const avecDeuxComptes = async () => {
    remettre(); remettreBase();
    await app(JWT_J, { action: 'status' });                 // apprend le principal
    return connecter(JWT_J, 'code-A2', true);               // ajoute julien_pro
  };
  await essaie('multi : le principal apprend son identité', async () => {
    remettre(); remettreBase();
    const o = await app(JWT_J, { action: 'status' });
    const reg = registre(J);
    dit(o.code === 200 && reg && reg.length === 1 && reg[0].principal === true && reg[0].pseudo === 'julien_part' && reg[0].cle === CLE_A1,
      "la ligne d'avant de Julien reste son PREMIER compte : à l'ouverture, eBay dit qui il est (GetUser) et c'est rangé — pseudo julien_part, clé tirée de l'identifiant stable",
      reg ? JSON.stringify(reg.map((x) => [x.pseudo, x.principal])) : `aucun registre · HTTP ${o.code}`);
    dit(o.corps && Array.isArray(o.corps.comptes) && o.corps.comptes.length === 1 && o.corps.comptes[0].pseudo === 'julien_part' && o.corps.comptes[0].relie === true,
      "« status » rend ses comptes (pseudo, relié) — un seul compte, rien ne change pour lui", JSON.stringify(o.corps && o.corps.comptes));
    const l = lignes.find((x) => x.owner === J && x.id === 'ebay_comptes');
    dit(l && !/rt-|at-|refresh|access|EIAS/i.test(JSON.stringify(l.data)) && sansJeton(o),
      'le registre (lisible par l\'app) ne porte AUCUN jeton ni l\'identifiant brut d\'eBay — pseudo, clé hachée, dates', l ? Object.keys(l.data.comptes[0]).join(',') : 'absent');
    dit(jetons(J, 'ebay_tokens') === 'rt-de-J', 'et ses jetons d\'avant n\'ont pas bougé (mêmes lignes, mêmes ids)');
  });
  await essaie('multi : « connecter un autre compte »', async () => {
    remettre(); remettreBase();
    const d = await app(JWT_J, { action: 'authurl', ajout: true });
    const d0 = await app(JWT_J, { action: 'authurl' });
    dit(d.code === 200 && /[?&]prompt=login(&|$)/.test(d.corps.url) && /\.a$/.test(etatDe(d)),
      "« Connecter un AUTRE compte eBay » ⇒ prompt=login (sinon eBay reconnecte en silence le compte déjà ouvert), et l'intention est signée dans le state", (d.corps && d.corps.url || '').replace(/^.*\?/, '').slice(0, 120));
    dit(d0.code === 200 && !/prompt=login/.test(d0.corps.url) && !/\.a$/.test(etatDe(d0)), "l'autre sens : la connexion d'avant ne change pas (pas de prompt, state d'avant)");
    // L'intention ne se retourne pas en route : le state d'un ajout privé de son « .a » est refusé.
    const avant = JSON.stringify(lignes);
    const r = await retourEbay({ code: 'code-A2', state: etatDe(d).replace(/\.a$/, '') }, cookieDe(d));
    dit(/ebay=erreur/.test(r.loc) && JSON.stringify(lignes) === avant && chezEbay(r.journal).length === 0, "et l'intention fait partie de ce qui est signé : la retirer du state ⇒ refusé, rien rangé", r.loc);
  });
  await essaie('multi : un 2e compte est AJOUTÉ', async () => {
    const r = await avecDeuxComptes();
    const reg = registre(J) || [];
    const a2 = reg.find((x) => x.cle === CLE_A2);
    dit(/ebay=connecte/.test(r.loc) && /compte=julien_pro/.test(r.loc) && /nouveau=1/.test(r.loc) && reg.length === 2 && a2 && a2.principal === false && a2.pseudo === 'julien_pro',
      'au retour, eBay dit que c\'est un AUTRE compte (julien_pro) ⇒ il est ajouté au registre, à côté du premier', `${r.loc} · ${reg.map((x) => x.pseudo).join(',')}`);
    dit(jetons(J, 'ebay_tokens_' + CLE_A2) === 'rt-A2' && jetons(J, 'ebay_tokens') === 'rt-de-J',
      'ses jetons sont rangés dans SA ligne (ebay_tokens_{clé}) — ceux du premier compte ne sont pas touchés', `A2=${jetons(J, 'ebay_tokens_' + CLE_A2)} · A1=${jetons(J, 'ebay_tokens')}`);
    const s = await app(JWT_J, { action: 'status' });
    dit(s.corps && s.corps.comptes && s.corps.comptes.length === 2 && s.corps.comptes.every((c) => c.relie === true) && sansJeton(s),
      '« status » rend les deux comptes, chacun relié, sans jeton', JSON.stringify(s.corps && s.corps.comptes && s.corps.comptes.map((c) => c.pseudo)));
  });
  await essaie('multi : même compte reconnecté ⇒ pas de doublon', async () => {
    await avecDeuxComptes();
    const r = await connecter(JWT_J, 'code-A2', true);
    const reg = registre(J) || [];
    dit(/ebay=connecte/.test(r.loc) && !/nouveau=1/.test(r.loc) && reg.length === 2 && reg.filter((x) => x.cle === CLE_A2).length === 1,
      'julien_pro reconnecté ⇒ SES jetons sont rafraîchis, aucun doublon au registre', `${r.loc} · ${reg.length} compte(s)`);
    const r2 = await connecter(JWT_J, 'code-J-part', true);
    const reg2 = registre(J) || [];
    dit(/ebay=connecte/.test(r2.loc) && reg2.length === 2 && jetons(J, 'ebay_tokens') === 'rt-neuf-de-J' && jetons(J, 'ebay_tokens_' + CLE_A2) === 'rt-A2',
      'le premier compte (julien_part), même par « connecter un autre compte », retrouve SA ligne — pas de doublon, A2 intact', `${reg2.length} compte(s) · A1=${jetons(J, 'ebay_tokens')}`);
  });
  await essaie('multi : identité illisible ⇒ refus, rien rangé', async () => {
    await avecDeuxComptes();
    mode.getuser = 'ko';
    const avant = JSON.stringify(lignes);
    const r = await connecter(JWT_J, 'code-A3', true);
    const r2 = await connecter(JWT_J, 'code-A3', false);
    dit(/ebay=erreur/.test(r.loc) && /identite-illisible/.test(r.loc) && /ebay=erreur/.test(r2.loc) && JSON.stringify(lignes) === avant && !ecritJetons(r.journal) && !ecritJetons(r2.journal),
      'GetUser en échec pour un compte SUPPLÉMENTAIRE (ajout, ou reconnexion avec deux comptes) ⇒ refus, AUCUNE écriture : jamais un jeton qui écrase celui d\'un autre compte', `${r.loc} · ${r2.loc}`);
    remettre(); lignes = []; mode.getuser = 'ko';
    const r3 = await connecter(JWT_B, 'code-de-B', false);
    dit(/ebay=connecte/.test(r3.loc) && jetons(B, 'ebay_tokens') === 'rt-de-B',
      "l'autre sens : le TOUT PREMIER compte d'un vendeur garde le comportement d'avant (principal), même sans identité", r3.loc);
  });
  await essaie('multi : principal illisible ⇒ on n\'ajoute pas', async () => {
    remettre(); remettreBase();
    lignes.find((x) => x.owner === J && x.id === 'ebay_tokens').data.refresh_token = 'rt-mort';
    const avant = JSON.stringify(lignes);
    const r = await connecter(JWT_J, 'code-A2', true);
    dit(/ebay=erreur/.test(r.loc) && /principal-inconnu/.test(r.loc) && JSON.stringify(lignes) === avant,
      "l'identité du premier compte est inconnue et ne peut pas être apprise (jeton mort) ⇒ on n'ajoute pas un second compte (on ne saurait pas si c'est le même)", r.loc);
    remettre(); remettreBase(); mode.comptesKo = true;
    const avant2 = JSON.stringify(lignes);
    const r2 = await connecter(JWT_J, 'code-A2', true);
    dit(/ebay=erreur/.test(r2.loc) && JSON.stringify(lignes) === avant2 && !chezEbay(r2.journal).some((x) => /oauth2\/token/.test(x.u)),
      'registre illisible ⇒ refus AVANT même d\'échanger le code (« pas su » ne range rien)', r2.loc);
  });
  await essaie('multi : chaque action part sur SON compte', async () => {
    await avecDeuxComptes();
    const o = await app(JWT_J, { action: 'sync', compte: CLE_A2 });
    const parti = auCompte(o.journal);
    const L = ecrit(o.journal, 'ebay_listings_' + CLE_A2);
    dit(o.code === 200 && parti.length > 0 && parti.every((x) => x.jeton === 'at-A2') && L && L.owner === J && ecrit(o.journal, 'ebay_listings') === null,
      'la synchro du compte julien_pro part avec SON jeton et range dans SES lignes (ebay_listings_{clé}) — jamais dans celles du premier', `${parti.map((x) => x.jeton).join(',')} · ${L ? 'ebay_listings_' + CLE_A2 : 'rien'}`);
    const o2 = await app(JWT_J, { action: 'sync' });
    dit(auCompte(o2.journal).every((x) => x.jeton === 'at-J') && ecrit(o2.journal, 'ebay_listings') && ecrit(o2.journal, 'ebay_listings_' + CLE_A2) === null,
      'sans `compte` ⇒ le principal, avec ses lignes d\'avant (rétrocompatible)');
    for (const action of ['finances', 'programmees', 'limites', 'offreinfo']) {
      const x = await app(JWT_J, { action, compte: CLE_A2 });
      const ps = auCompte(x.journal);
      dit(ps.length > 0 && ps.every((y) => y.jeton === 'at-A2'), `« ${action} » sur julien_pro part avec SON jeton`, ps.map((y) => y.jeton).join(','));
    }
  });
  await essaie('multi : le compte d\'un autre vendeur ne désigne rien', async () => {
    await avecDeuxComptes();
    for (const action of ['sync', 'publish', 'retirer', 'programmer', 'finances', 'deconnecter']) {
      const o = await app(JWT_B, { action, compte: CLE_A2, confirme: true, itemId: '110000000001', item: { ...item, numero: '30' }, uuid: 'C'.repeat(32), fraisVus: 0.2 });
      dit((o.code === 404 || o.code === 403) && chezEbay(o.journal).length === 0 && !auCompte(o.journal).some((x) => x.jeton === 'at-A2'),
        `B désigne le compte eBay de Julien (« ${action} ») ⇒ ${o.code}, zéro appel eBay`, `HTTP ${o.code} · ${chezEbay(o.journal).length} appel(s)`);
    }
    const inc = await app(JWT_J, { action: 'sync', compte: 'f'.repeat(16) });
    const mal = await app(JWT_J, { action: 'sync', compte: '../ebay_tokens' });
    dit(inc.code === 404 && mal.code === 400 && chezEbay(inc.journal).length === 0 && chezEbay(mal.journal).length === 0,
      'une clé inconnue ⇒ 404, une clé mal formée ⇒ 400 — zéro appel eBay', `${inc.code}/${mal.code}`);
    mode.comptesKo = true;
    const pk = await app(JWT_J, { action: 'sync', compte: CLE_A2 });
    dit(pk.code === 503 && chezEbay(pk.journal).length === 0, 'registre illisible ⇒ 503, zéro appel (« pas su » ne désigne aucun compte)', `HTTP ${pk.code}`);
  });
  const VRM30 = () => annonce('110000000930', 'Salomon XT-6 noir T43', 'VRM-30', '120.0', '2026-09-01T10:00:00.000Z');
  await essaie('multi : une paire en vente sur A1 ne part pas sur A2', async () => {
    await avecDeuxComptes();
    ebay['at-J'].actives.push(VRM30());
    const o = await app(JWT_J, { action: 'publish', compte: CLE_A2, item: { ...item, numero: '30' } });
    dit(o.code === 409 && o.corps.reason === 'deja-en-ligne' && o.corps.autreCompte === true && /julien_part/.test(o.corps.error || '') && !auCompte(o.journal).some((x) => x.appel === 'AddFixedPriceItem'),
      'publier VRM-30 sur julien_pro alors qu\'elle est en vente sur julien_part ⇒ 409, le compte est nommé, aucune annonce créée', `HTTP ${o.code} · ${o.corps && o.corps.error}`);
    const lus = auCompte(o.journal).filter((x) => x.appel === 'GetMyeBaySelling').map((x) => x.jeton);
    dit(lus.includes('at-J'), "c'est l'AUTRE compte (julien_part) qui a été relu chez eBay, avec SON jeton", lus.join(','));
    const p = await app(JWT_J, { action: 'programmer', compte: CLE_A2, confirme: true, uuid: 'D'.repeat(32), fraisVus: 0.2, scheduleTime: iso(Date.now() + 2 * JOUR), item: { ...item, numero: '30' } });
    dit(p.code === 409 && !auCompte(p.journal).some((x) => /Verify|AddFixed/.test(x.appel)), 'programmer VRM-30 sur julien_pro ⇒ 409 aussi, ni vérification ni ajout', `HTTP ${p.code}`);
    ebay['at-J'].actives = ebay['at-J'].actives.filter((x) => x.sku !== 'VRM-30');
    ebay['at-A2'].programmees.push(annonce('110000000931', 'Salomon XT-6 noir T43', 'VRM-30', '120.0', iso(Date.now() + 3 * JOUR)));
    const o2 = await app(JWT_J, { action: 'publish', item: { ...item, numero: '30' } });
    dit(o2.code === 409 && o2.corps.reason === 'deja-programmee' && !auCompte(o2.journal).some((x) => x.appel === 'AddFixedPriceItem'),
      'et dans l\'autre sens : programmée sur julien_pro ⇒ elle ne part pas sur le premier compte', `HTTP ${o2.code}`);
    remettre(); await avecDeuxComptes();
    const o3 = await app(JWT_J, { action: 'publish', compte: CLE_A2, item: { ...item, numero: '31' } });
    const add = auCompte(o3.journal).find((x) => x.appel === 'AddFixedPriceItem');
    dit(o3.code === 200 && add && add.jeton === 'at-A2' && o3.corps.compte === 'julien_pro', "l'autre sens : une paire libre partout part sur julien_pro, avec SON jeton", `HTTP ${o3.code}`);
  });
  await essaie('multi : un compte illisible ⇒ rien ne part', async () => {
    await avecDeuxComptes();
    mode.listeKoPour = 'at-J';
    const o = await app(JWT_J, { action: 'publish', compte: CLE_A2, item: { ...item, numero: '32' } });
    dit(o.code === 503 && o.corps.reason === 'pas-su' && /julien_part/.test(o.corps.error || '') && !auCompte(o.journal).some((x) => x.appel === 'AddFixedPriceItem'),
      'la liste de julien_part illisible ⇒ publier sur julien_pro est refusé « pas su », en nommant le compte qui manque', `HTTP ${o.code} · ${o.corps && o.corps.error}`);
    mode.listeKoPour = '';
    lignes.find((x) => x.owner === J && x.id === 'ebay_tokens').data.refresh_token = 'rt-mort';
    const o2 = await app(JWT_J, { action: 'publish', compte: CLE_A2, item: { ...item, numero: '32' } });
    dit(o2.code === 503 && !auCompte(o2.journal).some((x) => x.appel === 'AddFixedPriceItem'), 'le jeton de julien_part mort ⇒ pareil, rien ne part sur julien_pro', `HTTP ${o2.code}`);
  });
  await essaie('multi : déconnecter UN compte', async () => {
    await avecDeuxComptes();
    const sans = await app(JWT_J, { action: 'deconnecter', compte: CLE_A2 });
    dit(sans.code === 400 && jetons(J, 'ebay_tokens_' + CLE_A2) === 'rt-A2', 'déconnecter sans confirmation ⇒ 400, rien ne change');
    const o = await app(JWT_J, { action: 'deconnecter', compte: CLE_A2, confirme: true });
    const a2 = (registre(J) || []).find((x) => x.cle === CLE_A2);
    dit(o.code === 200 && jetons(J, 'ebay_tokens_' + CLE_A2) === '' && a2 && a2.deconnecteLe > 0 && jetons(J, 'ebay_tokens') === 'rt-de-J' && chezEbay(o.journal).length === 0,
      'déconnecter julien_pro (confirmé) ⇒ SES jetons sont vidés, il est marqué déconnecté — le premier compte n\'est pas touché', `HTTP ${o.code}`);
    const x = await app(JWT_J, { action: 'sync', compte: CLE_A2 });
    dit(x.code === 409 && chezEbay(x.journal).length === 0, 'une action sur le compte déconnecté ⇒ 409, zéro appel eBay', `HTTP ${x.code}`);
    const s = await app(JWT_J, { action: 'status' });
    dit(s.corps && s.corps.comptes && s.corps.comptes.length === 1 && s.corps.comptes[0].pseudo === 'julien_part', '« status » ne le rend plus (il sort du sélecteur)', JSON.stringify(s.corps && s.corps.comptes && s.corps.comptes.map((c) => c.pseudo)));
    ebay['at-A2'].actives.push(VRM30());
    const p = await app(JWT_J, { action: 'publish', item: { ...item, numero: '30' } });
    dit(p.code === 200 && !auCompte(p.journal).some((x) => x.jeton === 'at-A2'), 'un compte déconnecté n\'est plus relu (aucun appel avec son jeton)', `HTTP ${p.code}`);
    const r = await connecter(JWT_J, 'code-A2', true);
    const a2b = (registre(J) || []).find((x) => x.cle === CLE_A2);
    dit(/ebay=connecte/.test(r.loc) && a2b && !a2b.deconnecteLe && (registre(J) || []).length === 2 && jetons(J, 'ebay_tokens_' + CLE_A2) === 'rt-A2',
      'le reconnecter le retrouve TEL QUEL (même clé, mêmes lignes), sans doublon', r.loc);
  });
  await essaie('multi : B n\'a jamais les comptes de Julien', async () => {
    await avecDeuxComptes();
    const s = await app(JWT_B, { action: 'status' });
    dit(s.code === 200 && s.corps.connected === false && (!s.corps.comptes || s.corps.comptes.length === 0), 'B ne voit aucun des comptes eBay de Julien', JSON.stringify(s.corps));
  });
  await essaie('multi : la règle du suffixe, app = serveur', async () => {
    const lib = await import('file://' + path.join(RACINE, 'api', '_lib', 'ebay.js'));
    const cas = [{ cle: CLE_A2, principal: false }, { cle: CLE_A1, principal: true }, { cle: '', principal: true }, { cle: 'ZZ', principal: false }, { cle: CLE_A3 }, null];
    const app2 = RA.suffixeCompteEbay;
    const ecarts = cas.filter((c) => !app2 || app2(c) !== lib.suffixeCompte(c));
    dit(typeof app2 === 'function' && ecarts.length === 0, "le suffixe des lignes d'un compte se calcule PAR LA MÊME RÈGLE dans l'app et sur le serveur (§11)", ecarts.map((c) => JSON.stringify(c)).join(' · ') || (app2 ? '' : 'absente de l\'app'));
  });

  // ══ 13. LA RÈGLE D'OFFRE — c'est eBAY qui accepte, au seuil fixé (9 octobre) ═
  //    Julien : « je veux juste définir une règle sur chaque annonce et à chaque
  //    offre au-dessus ça accepte ». Le réglage NATIF d'eBay, posé sur SON
  //    clic : VRM n'appelle jamais une route d'acceptation. Chaque message porte
  //    son repère [R-…] : `prouve-regle-offre.cjs` exige que la bonne ligne
  //    passe au rouge sous chaque mutation. Données INVENTÉES.
  const DR = '2026-09-20T10:00:00.000Z';
  const R1 = () => annonce('110000000301', 'Nike Air Max 1 bleu taille 44', 'VRM-41', '80.0', DR, { regle: { actives: false, accepte: null, refuse: null, offresFaites: null } });
  const R2 = () => annonce('110000000302', 'Adidas Samba blanc taille 42', 'VRM-42', '90.0', DR, { regle: { actives: true, accepte: '70.0', refuse: '50.0', offresFaites: 2 } });
  const R3 = () => annonce('110000000303', 'Salomon XT-6 noir taille 43', '', '120.0', DR, { type: 'Chinese' });
  const R4 = () => annonce('110000000304', 'Puma Suede gris taille 42', 'VRM-44', '60.0', DR, { statut: 'Completed' });
  const R5 = () => annonce('110000000305', 'Vans Old Skool noir taille 41', 'VRM-45', '50.0', DR, { devise: 'USD' });
  const R6 = () => annonce('120000000306', 'Asics Gel 1130 argent taille 39', 'VRM-46', '70.0', DR);
  const R7 = () => annonce('110000000307', 'New Balance 550 gris taille 44', 'VRM-47', '100.0', iso(Date.now() + 2 * JOUR));
  const pousserR = () => { ebay['at-J'].actives.push(R1(), R2(), R3(), R4(), R5()); ebay['at-J'].programmees.push(R7()); ebay['at-A2'].actives.push(R6()); };
  const avecR = () => { remettre(); remettreBase(); pousserR(); };
  const RA_ = (id) => [...ebay['at-J'].actives, ...ebay['at-J'].programmees, ...ebay['at-A2'].actives].find((x) => x.itemId === id);
  const POSE = (itemId, accepte, prixVu, attendu, extra) => ({ action: 'regleoffre', itemId, accepte, prixVu, attendu, confirme: true, ...(extra || {}) });
  const NUL = { accepte: null, refuse: null };
  const offresDe = (owner, suffixe) => { const l = lignes.find((x) => x.owner === owner && x.id === 'ebay_offres' + (suffixe || '')); return l && l.data ? (l.data.items || {}) : null; };
  const revs = (j) => auCompte(j).filter((x) => x.appel === 'ReviseFixedPriceItem');
  const innerRev = (j) => { const r = revs(j)[0]; return r ? ((/<ReviseFixedPriceItemRequest[^>]*>([\s\S]*)<\/ReviseFixedPriceItemRequest>/.exec(r.corps) || [])[1] || '') : ''; };
  const getsApres = (j) => { const a = auCompte(j); const i = a.findIndex((x) => x.appel === 'ReviseFixedPriceItem'); return i < 0 ? 0 : a.slice(i + 1).filter((x) => x.appel === 'GetItem').length; };
  const zero = (o) => chezEbay(o.journal).length === 0;

  await essaie('[R-conf]', async () => {
    for (const corps of [{ itemId: '110000000301', accepte: 72, prixVu: 80, attendu: NUL }, { itemId: '110000000302', accepte: null, refuse: null }]) {
      for (const confirme of [undefined, 'true', 1]) {
        avecR();
        const o = await app(JWT_J, { action: 'regleoffre', ...corps, ...(confirme === undefined ? {} : { confirme }) });
        dit(o.code === 400 && o.corps && o.corps.reason === 'confirmation' && zero(o),
          `[R-conf] ${corps.accepte === null ? 'retrait' : 'pose'} sans confirmation explicite (${JSON.stringify(confirme)}) ⇒ 400, zéro appel eBay`, `HTTP ${o.code} · ${o.corps && o.corps.reason}`);
      }
    }
  });
  await essaie('[R-id]', async () => {
    for (const itemId of ['12a', '110</ItemID><X>', '']) {
      avecR();
      const o = await app(JWT_J, POSE(itemId, 72, 80, NUL));
      dit(o.code === 400 && /annonce eBay invalide/.test((o.corps && o.corps.error) || '') && zero(o), `[R-id] identifiant ${JSON.stringify(itemId)} ⇒ 400 « annonce eBay invalide », zéro appel`, `HTTP ${o.code}`);
    }
  });
  await essaie('[R-mont]', async () => {
    const cas = [[{ accepte: 0 }, 'montant'], [{ accepte: -5 }, 'montant'], [{ accepte: '72' }, 'montant'], [{ accepte: 72.555 }, 'montant'], [{ accepte: 1e9 }, 'montant'], [{ accepte: undefined }, 'montant'],
      [{ accepte: null, refuse: 60 }, 'refuse-seul'], [{ accepte: 60, refuse: 60 }, 'refuse'], [{ accepte: 60, refuse: 70 }, 'refuse'], [{ accepte: 72, refuse: 0 }, 'refuse-montant'],
      // (11 octobre, revue — tour 2) des montants qui s'arrondissent à 0 : « > 0 »
      // les laissait passer, et eBay recevait « 0.00 ».
      [{ accepte: 1e-9, sousMoitie: true }, 'montant'], [{ accepte: 5e-324, sousMoitie: true }, 'montant'], [{ accepte: 0.004 }, 'montant'], [{ accepte: 72, refuse: 1e-9 }, 'refuse-montant'], [{ accepte: 72, refuse: 5e-324 }, 'refuse-montant']];
    for (const [m, code] of cas) {
      avecR();
      const corps = { action: 'regleoffre', itemId: '110000000301', prixVu: 80, attendu: NUL, confirme: true, ...m };
      if (m.accepte === undefined) delete corps.accepte;
      const o = await app(JWT_J, corps);
      dit(o.code === 400 && o.corps && o.corps.reason === code && zero(o), `[R-mont] ${JSON.stringify(m)} ⇒ 400 « ${code} », zéro appel eBay`, `HTTP ${o.code} · ${o.corps && o.corps.reason}`);
    }
  });
  await essaie('[R-prixvu]', async () => {
    for (const pv of [undefined, '80', 0]) {
      avecR();
      const c = POSE('110000000301', 72, pv, NUL); if (pv === undefined) delete c.prixVu;
      const o = await app(JWT_J, c);
      dit(o.code === 400 && o.corps && o.corps.reason === 'prix-vu' && zero(o), `[R-prixvu] prixVu ${JSON.stringify(pv)} ⇒ 400 « prix-vu », zéro appel`, `HTTP ${o.code} · ${o.corps && o.corps.reason}`);
    }
    avecR(); RA_('110000000301').prix = '120.0';
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    dit(o.code === 409 && o.corps.reason === 'prix-change' && o.corps.prix === 120 && o.corps.lecture && o.corps.lecture.prix === 120 && appels(o.journal) === 'GetMyeBaySelling,GetItem' && revs(o.journal).length === 0,
      '[R-prixvu] le prix a changé chez eBay (120 € quand il voyait 80 €) ⇒ 409 « prix-change », la lecture rendue, AUCUNE révision', `HTTP ${o.code} · ${appels(o.journal)}`);
  });
  await essaie('[R-sous-moitie]', async () => {
    avecR();
    const o = await app(JWT_J, POSE('110000000301', 7, 80, NUL));
    dit(o.code === 400 && o.corps.reason === 'sous-moitie' && zero(o), '[R-sous-moitie] 7 € sur une annonce à 80 € sans confirmation explicite ⇒ 400, zéro appel', `HTTP ${o.code} · ${o.corps && o.corps.reason}`);
    avecR();
    const o2 = await app(JWT_J, POSE('110000000301', 7, 80, NUL, { sousMoitie: true }));
    dit(o2.code === 200 && /<BestOfferAutoAcceptPrice currencyID="EUR">7\.00<\/BestOfferAutoAcceptPrice>/.test(innerRev(o2.journal)), '[R-sous-moitie] confirmé (sousMoitie:true) ⇒ la révision part avec 7.00', `HTTP ${o2.code}`);
    avecR();
    const o3 = await app(JWT_J, POSE('110000000301', 40, 80, NUL));
    dit(o3.code === 200 && revs(o3.journal).length === 1, '[R-sous-moitie] 40 € sur 80 € (50 % pile) n\'est PAS « trop bas » ⇒ passe sans drapeau', `HTTP ${o3.code} · ${o3.corps && o3.corps.reason}`);
  });
  await essaie('[R-attendu]', async () => {
    for (const at of [undefined, 'x', { accepte: '70' }]) {
      avecR();
      const c = POSE('110000000302', 75, 90, at); if (at === undefined) delete c.attendu;
      const o = await app(JWT_J, c);
      dit(o.code === 400 && o.corps.reason === 'attendu' && zero(o), `[R-attendu] attendu ${JSON.stringify(at)} ⇒ 400 « attendu », zéro appel`, `HTTP ${o.code} · ${o.corps && o.corps.reason}`);
    }
    avecR();
    const o = await app(JWT_J, POSE('110000000302', 75, 90, NUL));
    dit(o.code === 409 && o.corps.reason === 'regle-changee' && o.corps.lecture && o.corps.lecture.accepte === 70 && revs(o.journal).length === 0,
      '[R-attendu] il voyait « aucune règle », eBay en a une (70/50) ⇒ 409 « regle-changee », la lecture rendue, aucune révision', `HTTP ${o.code} · ${o.corps && o.corps.reason}`);
    avecR();
    const o2 = await app(JWT_J, POSE('110000000302', 75, 90, 'inconnu'));
    dit(o2.code === 409 && o2.corps.reason === 'regle-existante' && revs(o2.journal).length === 0, '[R-attendu] règle « pas lue » et eBay en a une ⇒ 409 « regle-existante », rien n\'est remplacé', `HTTP ${o2.code} · ${o2.corps && o2.corps.reason}`);
    avecR();
    const o3 = await app(JWT_J, POSE('110000000301', 72, 80, 'inconnu'));
    dit(o3.code === 200 && revs(o3.journal).length === 1, '[R-attendu] règle « pas lue » et eBay n\'en a aucune ⇒ la pose part', `HTTP ${o3.code}`);
    avecR();
    const o4 = await app(JWT_J, POSE('110000000302', 70, 90, 'inconnu', { refuse: 50 }));
    dit(o4.code === 200 && o4.corps.inchange === true && revs(o4.journal).length === 0, '[R-attendu] la même règle déjà chez eBay ⇒ 200 « inchangée » (l\'idempotence passe avant)', `HTTP ${o4.code}`);
  });
  await essaie('[R-prix]', async () => {
    for (const a of [80, 80.01]) {
      avecR();
      const o = await app(JWT_J, POSE('110000000301', a, 80, NUL));
      dit(o.code === 409 && o.corps.reason === 'seuil-prix' && o.corps.prix === 80 && appels(o.journal) === 'GetMyeBaySelling,GetItem',
        `[R-prix] un seuil de ${a} € sur une annonce à 80 € (relu chez eBay) ⇒ 409 « seuil-prix », aucune révision`, `HTTP ${o.code} · ${o.corps && o.corps.reason} · ${appels(o.journal)}`);
    }
    avecR();
    const o = await app(JWT_J, POSE('110000000301', 79.99, 80, NUL));
    dit(o.code === 200 && revs(o.journal).length === 1, '[R-prix] 79,99 € sur 80 € passe', `HTTP ${o.code}`);
  });
  await essaie('[R-pose]', async () => {
    avecR();
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    const exact = '<Item><ItemID>110000000301</ItemID><BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails><ListingDetails><BestOfferAutoAcceptPrice currencyID="EUR">72.00</BestOfferAutoAcceptPrice></ListingDetails></Item>';
    dit(appels(o.journal) === 'GetMyeBaySelling,GetItem,ReviseFixedPriceItem,GetItem', '[R-pose] relire la liste, relire l\'annonce, réviser, relire — dans cet ordre', appels(o.journal));
    dit(innerRev(o.journal) === exact && !/DeletedField/.test(innerRev(o.journal)), '[R-pose] le corps de la révision est EXACTEMENT celui attendu (offres activées + seuil 72.00 EUR)', innerRev(o.journal).slice(0, 220));
    dit(o.code === 200 && o.corps.ok === true && o.corps.verifie === true && o.corps.lecture && o.corps.lecture.accepte === 72, '[R-pose] 200, vérifiée par la relecture (eBay accepte dès 72 €)', `HTTP ${o.code} · verifie=${o.corps && o.corps.verifie}`);
    const it = (offresDe(J) || {})['110000000301'];
    dit(!!it && it.lu === true && it.accepte === 72 && it.offresActives === true && it.par === 'regle', '[R-pose] rangée dans ebay_offres (owner J) : la lecture d\'eBay, par « regle »', JSON.stringify(it));
  });
  await essaie('[R-marque]', async () => {
    avecR();
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    const marque = o.journal.find((x) => x.ou === 'base' && /ebay_offres/.test(x.corps) && /en-cours/.test(x.corps));
    const rev = revs(o.journal)[0];
    dit(!!marque && !!rev && marque.seq < rev.seq, '[R-marque] la base est marquée « en cours » AVANT l\'écriture chez eBay', `marque=${marque && marque.seq} · révision=${rev && rev.seq}`);
    avecR(); mode.offresEcritureKo = true;
    const o2 = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    dit(o2.code === 503 && o2.corps.reason === 'note' && revs(o2.journal).length === 0, '[R-marque] le marqueur ne s\'écrit pas ⇒ 503 « note », AUCUNE révision chez eBay', `HTTP ${o2.code} · ${o2.corps && o2.corps.reason}`);
    avecR(); lignes.push({ owner: J, id: 'ebay_offres', data: { items: { '110000000302': { lu: true, offresActives: true, accepte: 70, refuse: 50, devise: 'EUR', prix: 90, lueA: 5, par: 'sync' } }, capturedAt: 5 } });
    const avant = JSON.stringify(lignes.find((x) => x.id === 'ebay_offres'));
    mode.offresKo = true;
    const o3 = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    dit(o3.code === 503 && o3.corps.reason === 'note' && revs(o3.journal).length === 0 && JSON.stringify(lignes.find((x) => x.id === 'ebay_offres')) === avant,
      '[R-marque] la ligne ebay_offres illisible ⇒ 503 « note », aucune révision, et la ligne n\'est PAS réécrite depuis le vide', `HTTP ${o3.code}`);
  });
  await essaie('[R-refus]', async () => {
    avecR();
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL, { refuse: 60 }));
    dit(o.code === 200 && /<ListingDetails><BestOfferAutoAcceptPrice currencyID="EUR">72\.00<\/BestOfferAutoAcceptPrice><MinimumBestOfferPrice currencyID="EUR">60\.00<\/MinimumBestOfferPrice><\/ListingDetails>/.test(innerRev(o.journal)),
      '[R-refus] le refus part DANS ListingDetails, après l\'acceptation', innerRev(o.journal).slice(0, 220));
  });
  await essaie('[R-actif]', async () => {
    avecR();
    const o = await app(JWT_J, POSE('110000000302', 75, 90, { accepte: 70, refuse: 50 }, { refuse: 50 }));
    dit(o.code === 200 && revs(o.journal).length === 1 && !/BestOfferDetails/.test(innerRev(o.journal)), '[R-actif] offres déjà actives ⇒ pas de <BestOfferDetails> (eBay le verrouille quand des offres attendent)', innerRev(o.journal).slice(0, 200));
  });
  await essaie('[R-idem]', async () => {
    avecR();
    const o = await app(JWT_J, POSE('110000000302', 70, 90, { accepte: 70, refuse: 50 }, { refuse: 50 }));
    dit(o.code === 200 && o.corps.inchange === true && revs(o.journal).length === 0, '[R-idem] la même règle déjà posée ⇒ 200 « inchangée », AUCUNE révision', `HTTP ${o.code} · ${appels(o.journal)}`);
    avecR(); mode.getitem = 'sans-bestoffer';
    const o2 = await app(JWT_J, POSE('110000000302', 70, 90, { accepte: 70, refuse: 50 }, { refuse: 50 }));
    dit(o2.code === 200 && !o2.corps.inchange && revs(o2.journal).length === 1, '[R-idem] offres actives NON prouvées (pas de BestOfferDetails) ⇒ l\'idempotence ne joue pas : la révision part', `HTTP ${o2.code} · inchange=${o2.corps && o2.corps.inchange}`);
  });
  await essaie('[R-retrait]', async () => {
    avecR();
    const o = await app(JWT_J, { action: 'regleoffre', itemId: '110000000302', accepte: null, refuse: null, confirme: true });
    dit(innerRev(o.journal) === '<Item><ItemID>110000000302</ItemID></Item><DeletedField>Item.ListingDetails.BestOfferAutoAcceptPrice</DeletedField><DeletedField>Item.ListingDetails.MinimumBestOfferPrice</DeletedField>' && !/BestOfferEnabled/.test(innerRev(o.journal)),
      '[R-retrait] retirer ⇒ DeletedField des deux seuils, sans toucher aux offres (aucun BestOfferEnabled)', innerRev(o.journal));
    dit(o.code === 200 && o.corps.verifie === true && o.corps.lecture && o.corps.lecture.accepte === null, '[R-retrait] relue « aucune règle » ⇒ vérifiée', `HTTP ${o.code} · verifie=${o.corps && o.corps.verifie}`);
  });
  await essaie('[R-garde-refus]', async () => {
    avecR();
    const o = await app(JWT_J, POSE('110000000302', 72, 90, { accepte: 70, refuse: 50 }));
    dit(o.code === 200 && /<MinimumBestOfferPrice currencyID="EUR">50\.00<\/MinimumBestOfferPrice>/.test(innerRev(o.journal)) && !/DeletedField/.test(innerRev(o.journal)) && o.corps.verifie === true,
      '[R-garde-refus] sans clé « refuse », le refus d\'eBay (50 €) est RENVOYÉ dans le même appel, rien n\'est effacé', `HTTP ${o.code} · ${innerRev(o.journal).slice(0, 200)}`);
    avecR(); mode.regle = 'warning-21992';
    const o2 = await app(JWT_J, POSE('110000000302', 72, 90, { accepte: 70, refuse: 50 }));
    dit(o2.code === 200 && o2.corps.verifie === false && (o2.corps.avertissements || []).some((x) => /AutoDecline/.test(x)), '[R-garde-refus] eBay fait sauter le refus (21992) ⇒ « pas vérifiée », et l\'avertissement est rendu', `verifie=${o2.corps && o2.corps.verifie}`);
    avecR(); Object.assign(RA_('110000000302').regle, { accepte: '80.0', refuse: '75.0' });
    const o3 = await app(JWT_J, POSE('110000000302', 72, 90, { accepte: 80, refuse: 75 }));
    dit(o3.code === 409 && o3.corps.reason === 'refuse-existant' && revs(o3.journal).length === 0, '[R-garde-refus] eBay refuse déjà sous 75 € et la règle demandée est 72 € ⇒ 409, aucune révision', `HTTP ${o3.code} · ${o3.corps && o3.corps.reason}`);
  });
  await essaie('[R-ack]', async () => {
    avecR(); mode.regle = '503-apres';
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    const it = (offresDe(J) || {})['110000000301'];
    dit(o.code === 200 && o.corps.verifie === true && o.corps.apresIncertain === true && it && it.lu === true && it.accepte === 72, '[R-ack] 503 en HTML APRÈS avoir écrit, relu « posée » ⇒ 200 vérifiée (apresIncertain), la lecture rangée', `HTTP ${o.code}`);
    avecR(); mode.regle = '503-avant';
    const o2 = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    const it2 = (offresDe(J) || {})['110000000301'];
    dit(o2.code === 504 && o2.corps.reason === 'incertain' && o2.corps.lecture == null && it2 && it2.lu === false && it2.raison === 'incertain', '[R-ack] 503 AVANT d\'écrire, eBay montre ENCORE l\'état d\'avant ⇒ 504 « incertain », rangé en RISQUE (jamais le fait « aucune » — #0)', `HTTP ${o2.code} · ${JSON.stringify(it2)}`);
    for (const r of ['503-apres', 'reseau-apres']) {
      avecR(); mode.regle = r; mode.getitemApres = 'ko';
      const o3 = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
      const it3 = (offresDe(J) || {})['110000000301'];
      dit(o3.code === 504 && it3 && it3.lu === false && it3.raison === 'incertain', `[R-ack] ${r} et relecture ratée ⇒ 504, rangé « incertain » (jamais 422, jamais l'ancienne lecture)`, `HTTP ${o3.code} · ${JSON.stringify(it3)}`);
    }
  });
  await essaie('[R-systeme]', async () => {
    avecR(); mode.regle = 'failure-systeme-applique';
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    dit(o.code === 200 && o.corps.verifie === true, '[R-systeme] eBay écrit PUIS répond « panne interne » (SystemError) ⇒ relu posé : 200 vérifiée — jamais « rien n\'a changé »', `HTTP ${o.code} · ${o.corps && o.corps.reason}`);
    avecR(); mode.regle = 'failure-systeme';
    const o2 = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    const it2 = (offresDe(J) || {})['110000000301'];
    dit(o2.code === 504 && o2.corps.reason === 'incertain' && o2.corps.lecture == null && it2 && it2.lu === false && (o2.corps.erreurs || [])[0] && o2.corps.erreurs[0].classe === 'SystemError', '[R-systeme] panne d\'eBay sans écriture, eBay montre encore l\'état d\'avant ⇒ 504 « incertain », rangé en RISQUE (jamais « aucune » — #0), la classe de l\'erreur rendue', `HTTP ${o2.code} · ${JSON.stringify(it2)}`);
    avecR(); mode.regle = 'failure-sans-classe';
    const o3 = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    dit(o3.code === 504 && o3.corps.reason === 'incertain', '[R-systeme] un échec sans classe ⇒ « incertain », jamais « refusé »', `HTTP ${o3.code}`);
  });
  await essaie('[R-ebay-refus]', async () => {
    avecR(); mode.regle = 'refus-prix';
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    const it = (offresDe(J) || {})['110000000301'];
    dit(o.code === 422 && o.corps.reason === 'refus' && (o.corps.erreurs || [])[0] && o.corps.erreurs[0].code === '23004' && o.corps.erreurs[0].classe === 'RequestError' && sansJeton(o),
      '[R-ebay-refus] eBay refuse (RequestError 23004) ⇒ 422, son message et son code — sans aucun jeton', `HTTP ${o.code}`);
    dit(!!it && it.lu === true && it.accepte === null && it.raison !== 'en-cours', '[R-ebay-refus] la ligne rangée est la relecture (rien n\'a changé), jamais le marqueur « en cours »', JSON.stringify(it));
    avecR(); mode.regle = 'refus-prix'; mode.getitemApres = 'ko';
    const o2 = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    const it2 = (offresDe(J) || {})['110000000301'];
    dit(o2.code === 422 && it2 && it2.lu === true && it2.accepte === null, '[R-ebay-refus] relecture ratée ⇒ ce qu\'on avait lu AVANT (lu, valeurs d\'avant)', JSON.stringify(it2));
  });
  await essaie('[R-warning]', async () => {
    avecR(); mode.regle = 'warning-21992';
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL, { refuse: 60 }));
    dit(o.code === 200 && o.corps.ok === true && (o.corps.avertissements || []).some((x) => /AutoDecline/.test(x)) && o.corps.verifie === false, '[R-warning] Ack Warning ⇒ 200, l\'avertissement d\'eBay rendu, « pas vérifiée » (le refus a sauté)', `verifie=${o.corps && o.corps.verifie}`);
  });
  await essaie('[R-partiel]', async () => {
    avecR(); mode.regle = 'warning-partiel';
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    const it = (offresDe(J) || {})['110000000301'];
    dit(o.code === 200 && o.corps.verifie === false && it && it.offresActives === true && it.accepte === null, '[R-partiel] eBay active les offres mais ignore le montant ⇒ « pas vérifiée », rangé tel qu\'eBay le montre', JSON.stringify(it));
  });
  // L'autre moitié : les MONTANTS sont là, mais les offres sont COUPÉES — le
  // seuil ne joue pas. Des montants conformes ne suffisent pas à « vérifiée ».
  await essaie('[R-partiel] offres coupées', async () => {
    avecR(); mode.regle = 'montant-sans-offres';
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    const it = (offresDe(J) || {})['110000000301'];
    dit(o.code === 200 && o.corps.verifie === false && it && it.offresActives === false && it.accepte === 72, '[R-partiel] eBay garde le montant mais coupe les offres ⇒ « pas vérifiée » (le seuil ne joue pas), rangé tel qu\'eBay le montre', `verifie=${o.corps && o.corps.verifie} · ${JSON.stringify(it)}`);
  });
  await essaie('[R-ecart]', async () => {
    avecR(); mode.regle = 'ignore';
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    const it = (offresDe(J) || {})['110000000301'];
    dit(o.code === 200 && o.corps.verifie === null && o.corps.lecture == null && it && it.lu === false && it.raison === 'apres-ecriture' && getsApres(o.journal) === 2,
      '[R-ecart] eBay dit « fait » mais montre ENCORE l\'état d\'avant ⇒ « pas confirmée » (verifie null, rangé en RISQUE apres-ecriture, jamais le fait « aucune » — #0), après une relecture DIFFÉRÉE (2 GetItem)', `verifie=${o.corps && o.corps.verifie} · ${getsApres(o.journal)} GetItem après · ${JSON.stringify(it)}`);
  });
  await essaie('[R-delai]', async () => {
    avecR(); mode.getitemApres = 'ancien-puis-nouveau';
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    dit(o.code === 200 && o.corps.verifie === true && getsApres(o.journal) === 2, '[R-delai] eBay montre la révision un instant plus tard ⇒ la 2ᵉ relecture la voit : vérifiée', `verifie=${o.corps && o.corps.verifie} · ${getsApres(o.journal)} GetItem après`);
  });
  await essaie('[R-offres-inconnues]', async () => {
    avecR(); mode.getitemApres = 'sans-bestoffer';
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    dit(o.code === 200 && o.corps.verifie === null && o.corps.lecture && o.corps.lecture.offresActives === null, '[R-offres-inconnues] montant relu mais offres activées ou non : pas lu ⇒ « pas vérifiée » (null), jamais « vérifiée »', `verifie=${o.corps && o.corps.verifie}`);
  });
  await essaie('[R-relu-ko]', async () => {
    avecR(); mode.getitemApres = 'ko';
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    const it = (offresDe(J) || {})['110000000301'];
    dit(o.code === 200 && o.corps.verifie === null && it && it.lu === false && it.raison === 'apres-ecriture', '[R-relu-ko] eBay a dit « fait », la relecture rate ⇒ verifie null, rangé « pas relue » — jamais « aucune »', JSON.stringify(it));
  });
  await essaie('[R-ordre]', async () => {
    avecR();
    const futur = Date.now() + H;
    lignes.push({ owner: J, id: 'ebay_offres', data: { items: { '110000000302': { lu: true, offresActives: true, accepte: 66, refuse: null, devise: 'EUR', prix: 90, lueA: futur, par: 'regle' } }, capturedAt: futur } });
    const o = await app(JWT_J, { action: 'regleoffrelire', itemIds: ['110000000302'] });
    const it = (offresDe(J) || {})['110000000302'];
    dit(o.code === 200 && it && it.accepte === 66 && it.lueA === futur, '[R-ordre] une lecture plus ANCIENNE n\'écrase pas une entrée plus récente', JSON.stringify(it));
    const o2 = await app(JWT_J, POSE('110000000302', 75, 90, { accepte: 70, refuse: 50 }, { refuse: 50 }));
    const it2 = (offresDe(J) || {})['110000000302'];
    dit(o2.code === 200 && it2 && it2.accepte === 75 && it2.par === 'regle', '[R-ordre] une pose (marqueur forcé) la remplace bien', JSON.stringify(it2));
  });
  await essaie('[R-avant]', async () => {
    const cas = [
      ['GetItem avant KO', () => { mode.getitem = 'ko'; }, POSE('110000000301', 72, 80, NUL), 503, 'pas-su'],
      ['GetItem tronqué', () => { mode.getitem = 'tronque'; }, POSE('110000000301', 72, 80, NUL), 503, 'pas-su'],
      ['liste KO', () => { mode.liste = 'ko'; }, POSE('110000000301', 72, 80, NUL), 503, 'pas-su'],
      ['programmée (pose)', () => {}, POSE('110000000307', 70, 100, NUL), 409, 'programmee'],
      ['programmée (retrait)', () => {}, { action: 'regleoffre', itemId: '110000000307', accepte: null, refuse: null, confirme: true }, 409, 'programmee'],
      ['absente d\'une liste complète', () => {}, POSE('990000000001', 70, 100, NUL), 409, 'pas-sur-ce-compte'],
      ['terminée (R4)', () => {}, POSE('110000000304', 40, 60, NUL), 409, 'plus-en-vente'],
      ['enchère (R3)', () => {}, POSE('110000000303', 90, 120, NUL), 409, 'format'],
      ['dollars (R5)', () => {}, POSE('110000000305', 40, 50, NUL), 409, 'devise'],
    ];
    for (const [nom, prep, corps, code, reason] of cas) {
      avecR(); prep();
      const o = await app(JWT_J, corps);
      dit(o.code === code && o.corps && o.corps.reason === reason && revs(o.journal).length === 0, `[R-avant] ${nom} ⇒ ${code} « ${reason} », aucune révision`, `HTTP ${o.code} · ${o.corps && o.corps.reason}`);
      if (nom === 'programmée (retrait)') dit(/annule sa programmation/.test(o.corps.error || ''), '[R-avant] et le message du retrait parle d\'annuler la programmation', o.corps.error);
    }
  });
  await essaie('[R-range]', async () => {
    avecR(); lignes.push({ owner: J, id: 'ebay_offres', data: { items: { '110000000302': { lu: true, offresActives: true, accepte: 70, refuse: 50, devise: 'EUR', prix: 90, lueA: 5, par: 'sync' } }, capturedAt: 5 } });
    const o = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    const its = offresDe(J) || {};
    dit(o.code === 200 && its['110000000302'] && its['110000000302'].accepte === 70 && its['110000000301'] && its['110000000301'].accepte === 72, '[R-range] la ligne est FUSIONNÉE : l\'entrée de 302 est gardée, celle de 301 ajoutée', Object.keys(its).join(','));
    avecR(); mode.offresEcritureKoApres = true;
    const o2 = await app(JWT_J, POSE('110000000301', 72, 80, NUL));
    const it2 = (offresDe(J) || {})['110000000301'];
    dit(o2.code === 200 && o2.corps.range === false && it2 && it2.lu === false && it2.raison === 'en-cours', '[R-range] eBay a posé mais VRM n\'a pas pu le noter ⇒ range:false, et la base garde « en cours » (jamais l\'ancien « aucune »)', `range=${o2.corps && o2.corps.range} · ${JSON.stringify(it2)}`);
  });
  await essaie('[R-compte]', async () => {
    await avecDeuxComptes(); pousserR();
    const o = await app(JWT_J, POSE('120000000306', 60, 70, NUL, { compte: CLE_A2 }));
    const parti = auCompte(o.journal);
    const wA2 = o.journal.filter((x) => x.ou === 'base' && x.corps.includes(`"id":"ebay_offres_${CLE_A2}"`));
    const wJ = o.journal.filter((x) => x.ou === 'base' && x.corps.includes('"id":"ebay_offres"'));
    dit(o.code === 200 && parti.length > 0 && parti.every((x) => x.jeton === 'at-A2') && wA2.length > 0 && wJ.length === 0,
      '[R-compte] l\'annonce de julien_pro ⇒ tout part avec SON jeton, rangé dans ebay_offres_{clé} (jamais la ligne du premier compte)', `HTTP ${o.code} · ${parti.map((x) => x.jeton).join(',')}`);
    await avecDeuxComptes(); pousserR();
    const o2 = await app(JWT_J, POSE('120000000306', 60, 70, NUL));
    dit(o2.code === 409 && o2.corps.reason === 'pas-sur-ce-compte' && revs(o2.journal).length === 0, '[R-compte] la même annonce SANS son compte (donc sur le premier) ⇒ 409 « pas sur ce compte », aucune révision', `HTTP ${o2.code} · ${o2.corps && o2.corps.reason}`);
    await avecDeuxComptes(); pousserR();
    const o3 = await app(JWT_B, POSE('120000000306', 60, 70, NUL, { compte: CLE_A2 }));
    dit((o3.code === 404 || o3.code === 403) && zero(o3), '[R-compte] B désigne le compte de Julien ⇒ 404/403, zéro appel eBay', `HTTP ${o3.code}`);
  });
  await essaie('[R-lire]', async () => {
    avecR(); mode.getitemLent = true;
    const o = await app(JWT_J, { action: 'regleoffrelire', itemIds: ['110000000301', '110000000302', '990000000001'] });
    const its = offresDe(J) || {};
    dit(o.code === 200 && o.corps.lectures['110000000301'].lu === true && o.corps.lectures['110000000302'].offresFaites === 2 && its['110000000301'] && its['110000000302'] && its['110000000302'].par === 'relire',
      '[R-lire] 301 et 302 relus et rangés (302 : 2 offres faites)', JSON.stringify(Object.keys(its)));
    dit(o.corps.lectures['990000000001'] && o.corps.lectures['990000000001'].raison === 'pas-sur-ce-compte' && !its['990000000001'], '[R-lire] une annonce qui n\'est pas sur ce compte : dite, jamais rangée');
    dit(maxGetEnVol === 1, '[R-lire] les GetItem partent l\'un après l\'autre', `max en vol ${maxGetEnVol}`);
    for (const ids of [Array.from({ length: 21 }, (_, i) => String(110000000400 + i)), '110000000301', ['110000000301', 'abc']]) {
      avecR();
      const x = await app(JWT_J, { action: 'regleoffrelire', itemIds: ids });
      dit(x.code === 400 && x.corps.reason === 'annonces' && zero(x), `[R-lire] liste invalide (${Array.isArray(ids) ? ids.length + ' ids' : 'pas un tableau'}) ⇒ 400, zéro appel`, `HTTP ${x.code}`);
    }
    avecR(); mode.liste = 'ko';
    const o2 = await app(JWT_J, { action: 'regleoffrelire', itemIds: ['110000000301'] });
    dit(o2.code === 503 && !o2.journal.some((x) => x.ou === 'base' && /ebay_offres/.test(x.corps)), '[R-lire] liste illisible ⇒ 503, rien n\'est rangé');
    avecR(); mode.getitem = 'tronque';
    const o3 = await app(JWT_J, { action: 'regleoffrelire', itemIds: ['110000000301'] });
    dit(o3.code === 200 && o3.corps.lectures['110000000301'].lu === false && o3.corps.lectures['110000000301'].raison === 'lecture-ratee', '[R-lire] une réponse tronquée ⇒ « lecture ratée », jamais « aucune »', JSON.stringify(o3.corps.lectures));
  });
  await essaie('[R-sync]', async () => {
    avecR();
    const o = await app(JWT_J, { action: 'sync' });
    const nAct = ebay['at-J'].actives.length;
    const nGet = auCompte(o.journal).filter((x) => x.appel === 'GetItem').length;
    const w = ecrit(o.journal, 'ebay_offres');
    const L = ecrit(o.journal, 'ebay_listings');
    dit(nGet === Math.min(20, nAct), '[R-sync] la synchro fait autant de GetItem qu\'avant (un par annonce en ligne, 20 au plus) — aucun appel de plus', `${nGet} GetItem pour ${nAct} annonce(s)`);
    dit(!!w && w.data.items['110000000301'] && w.data.items['110000000301'].accepte === null && w.data.items['110000000302'] && w.data.items['110000000302'].accepte === 70 && w.data.items['110000000302'].par === 'sync',
      '[R-sync] la règle de chaque annonce est rangée dans ebay_offres (R1 aucune, R2 70 €)', w ? Object.keys(w.data.items).join(',') : 'rien');
    dit(!!L && L.data.items.every((x) => !x.detail || (!('_regle' in x.detail) && !('regle' in x.detail))), '[R-sync] ebay_listings ne porte AUCUNE règle (une ligne, un propriétaire)');
    dit(o.corps.lu && o.corps.lu.regles === true, '[R-sync] la réponse dit que les règles ont été rangées');
    avecR(); mode.offresKo = true;
    const o2 = await app(JWT_J, { action: 'sync' });
    dit(ecrit(o2.journal, 'ebay_listings') !== null && ecrit(o2.journal, 'ebay_offres') === null && o2.corps.lu.regles === false, '[R-sync] ligne des règles illisible ⇒ annonces rangées, règles NON réécrites');
    avecR(); mode.getitemKoPour = '110000000302';
    const o3 = await app(JWT_J, { action: 'sync' });
    const w3 = ecrit(o3.journal, 'ebay_offres');
    dit(!!w3 && w3.data.items['110000000302'] && w3.data.items['110000000302'].lu === false, '[R-sync] GetItem raté pour une annonce ⇒ son entrée « pas lue »', w3 ? JSON.stringify(w3.data.items['110000000302']) : 'rien');
  });
  await essaie('[R-prix-change]', async () => {
    const regleR2 = () => lignes.push({ owner: J, id: 'ebay_offres', data: { items: { '110000000302': { lu: true, offresActives: true, accepte: 70, refuse: 50, devise: 'EUR', prix: 90, lueA: Date.now() - H, par: 'sync' }, '110000000301': { lu: true, offresActives: false, accepte: null, refuse: null, devise: 'EUR', prix: 80, lueA: Date.now() - H, par: 'sync' } }, capturedAt: 5 } });
    avecR(); regleR2();
    const o = await app(JWT_J, { action: 'revise', itemId: '110000000302', price: '95' });
    const marque = o.journal.find((x) => x.ou === 'base' && /ebay_offres/.test(x.corps) && /en-cours/.test(x.corps));
    const rev = auCompte(o.journal).find((x) => x.appel === 'ReviseInventoryStatus');
    dit(!!marque && !!rev && marque.seq < rev.seq, '[R-prix-change] une annonce à règle : marquée « en cours » AVANT le changement de prix', `${marque && marque.seq} < ${rev && rev.seq}`);
    const it = (offresDe(J) || {})['110000000302'];
    dit(o.code === 200 && o.corps.regle && o.corps.regle.tombee === true && o.corps.regle.avant && o.corps.regle.avant.accepte === 70 && it && it.accepte === null,
      '[R-prix-change] eBay a fait tomber la règle ⇒ « tombée », ce qu\'elle était, et l\'entrée relue (aucune)', JSON.stringify(o.corps.regle));
    avecR(); regleR2(); mode.prix = 'garde';
    const o2 = await app(JWT_J, { action: 'revise', itemId: '110000000302', price: '95' });
    dit(o2.code === 200 && o2.corps.regle.tombee === false && o2.corps.regle.lecture.accepte === 70 && o2.corps.regle.lecture.prix === 95, '[R-prix-change] eBay l\'a gardée ⇒ « pas tombée », relue à 70 € sur un prix de 95 €', JSON.stringify(o2.corps.regle));
    avecR(); regleR2(); mode.prix = 'refus-23004';
    const o3 = await app(JWT_J, { action: 'revise', itemId: '110000000302', price: '65' });
    const it3 = (offresDe(J) || {})['110000000302'];
    dit(o3.code === 422 && (o3.corps.erreurs || [])[0] && o3.corps.erreurs[0].code === '23004' && it3 && it3.lu === true && it3.accepte === 70, '[R-prix-change] eBay refuse le prix (23004) ⇒ 422 avec son code, l\'entrée = la relecture (jamais « en cours »)', JSON.stringify(it3));
    avecR(); regleR2(); mode.trading = 'reseau';
    const o4 = await app(JWT_J, { action: 'revise', itemId: '110000000302', price: '95' });
    const it4 = (offresDe(J) || {})['110000000302'];
    dit(o4.code === 504 && it4 && it4.lu === false && it4.raison === 'incertain', '[R-prix-change] réseau coupé ⇒ 504, l\'entrée « incertaine »', JSON.stringify(it4));
    avecR(); regleR2(); mode.offresEcritureKo = true;
    const o5 = await app(JWT_J, { action: 'revise', itemId: '110000000302', price: '95' });
    dit(o5.code === 503 && o5.corps.reason === 'note' && !auCompte(o5.journal).some((x) => x.appel === 'ReviseInventoryStatus'), '[R-prix-change] le marqueur ne s\'écrit pas ⇒ 503, le prix n\'est PAS changé', `HTTP ${o5.code}`);
    avecR(); regleR2();
    const o6 = await app(JWT_J, { action: 'revise', itemId: '110000000301', price: '85' });
    dit(o6.code === 200 && o6.corps.regle.tombee === false && !o6.journal.some((x) => x.ou === 'base' && /en-cours/.test(x.corps)), '[R-prix-change] une annonce SANS règle connue ⇒ « pas tombée », aucun marqueur', JSON.stringify(o6.corps.regle));
    avecR();
    const o7 = await app(JWT_J, { action: 'revise', itemId: '110000000302', price: '95' });
    dit(o7.code === 200 && o7.corps.regle.tombee === null && (offresDe(J) || {})['110000000302'], '[R-prix-change] une annonce sans entrée ⇒ « pas su » (null), la lecture rangée', JSON.stringify(o7.corps.regle));
    avecR(); regleR2(); mode.offresKo = true;
    const o8 = await app(JWT_J, { action: 'revise', itemId: '110000000302', price: '95' });
    dit(o8.code === 200 && o8.corps.regle.tombee === null, '[R-prix-change] ligne des règles illisible ⇒ « pas su » (null), jamais « pas tombée »', JSON.stringify(o8.corps.regle));
    avecR(); regleR2();
    const o9 = await app(JWT_J, { action: 'revise', itemId: '110000000302', quantity: '2' });
    dit(o9.code === 200 && !auCompte(o9.journal).some((x) => x.appel === 'GetItem') && !o9.journal.some((x) => x.ou === 'base' && /ebay_offres/.test(x.corps)), '[R-prix-change] le stock seul ⇒ aucun GetItem, rien n\'est écrit dans ebay_offres');
  });
  // [R-revise-sans-regle] (tour 4, #10) Un changement de PRIX ne peut pas créer
  // de règle d'offre. Sur une annonce SANS règle dont la relecture rate, ne
  // RIEN ranger : « apres-ecriture » (risque) inventerait « eBay tient peut-être
  // une règle » sous un « ✓ Modifié ». Le risque n'est légitime que s'il y avait
  // une règle AVANT (elle a pu tomber).
  await essaie('[R-revise-sans-regle]', async () => {
    const regleR3 = () => lignes.push({ owner: J, id: 'ebay_offres', data: { items: { '110000000302': { lu: true, offresActives: true, accepte: 70, refuse: 50, devise: 'EUR', prix: 90, lueA: Date.now() - H, par: 'sync' } }, capturedAt: 5 } });
    avecR(); regleR3(); mode.getitemKoPour = '110000000001';
    const o = await app(JWT_J, { action: 'revise', itemId: '110000000001', price: '70' });
    const it = (offresDe(J) || {})['110000000001'];
    dit(o.code === 200 && o.corps.ok === true && !it,
      '[R-revise-sans-regle] prix changé sur une annonce SANS règle + relecture ratée ⇒ AUCUNE entrée « apres-ecriture » inventée', `entrée=${JSON.stringify(it)}`);
    avecR(); regleR3(); mode.getitemKoPour = '110000000302';
    const o2 = await app(JWT_J, { action: 'revise', itemId: '110000000302', price: '95' });
    const it2 = (offresDe(J) || {})['110000000302'];
    dit(o2.code === 200 && it2 && it2.lu === false && (it2.raison === 'apres-ecriture' || it2.raison === 'incertain'),
      '[R-revise-sans-regle] à l\'inverse : une annonce À RÈGLE dont la relecture rate RESTE un risque (la règle a pu tomber)', JSON.stringify(it2));
  });
  // ── [R-concurrence] (11 octobre, revue) DEUX GESTES SUR DEUX CARTES DU MÊME
  // COMPTE qui se croisent. `rangerReglesOffre` lisait la ligne, fusionnait et
  // la réécrivait ENTIÈRE : le second écrit remettait la copie périmée de
  // l'autre annonce — la base disait « aucune » sur une annonce qu'eBay vendait
  // dès 72 €, les deux réponses disant « rangé ». Latences simulées (eBay
  // 150 ms, base 120 ms sur `ebay_offres`) pour que les requêtes se
  // chevauchent comme en vrai ; on juge la BASE contre ce qu'eBay tient.
  await essaie('[R-concurrence]', async () => {
    const f0 = global.fetch, relecture0 = process.env.EBAY_RELECTURE_MS;
    global.fetch = async (url, opts = {}) => {
      const q = decodeURIComponent(String(url));
      if (/app_data/.test(q) && /ebay_offres/.test(q + String(opts.body || ''))) await new Promise((r) => setTimeout(r, 120));
      if (/ebay\.com\/ws/.test(q)) await new Promise((r) => setTimeout(r, 150));
      return f0(url, opts);
    };
    process.env.EBAY_RELECTURE_MS = '20';
    const ecartBase = (id) => {
      const e = (offresDe(J) || {})[id], r = RA_(id).regle, eb = r && r.accepte != null ? Number(r.accepte) : null;
      return (e && e.lu === true && (e.accepte == null ? null : Number(e.accepte)) === eb) ? '' : `${id} eBay ${eb == null ? 'aucune' : 'dès ' + eb} · base ${e ? JSON.stringify({ lu: e.lu, accepte: e.accepte, raison: e.raison }) : 'absente'}`;
    };
    try {
      const t0 = Date.now() - 60000;
      const ligne = (r2) => ({ owner: J, id: 'ebay_offres', data: { items: {
        '110000000301': { lu: true, offresActives: false, accepte: null, refuse: null, devise: 'EUR', prix: 80, lueA: t0, par: 'sync' },
        '110000000302': r2 } } });
      const fautes = [], reponses = [];
      for (const ecart of [0, 50, 100, 200]) {
        avecR(); lignes.push(ligne({ lu: true, offresActives: true, accepte: 70, refuse: 50, devise: 'EUR', prix: 90, lueA: t0, par: 'sync' }));
        const [a, b] = await Promise.all([
          app(JWT_J, POSE('110000000301', 72, 80, NUL)),
          new Promise((r) => setTimeout(r, ecart)).then(() => app(JWT_J, { action: 'regleoffre', itemId: '110000000302', accepte: null, refuse: null, confirme: true })),
        ]);
        reponses.push(`${a.code}/${b.code} range ${a.corps.range}/${b.corps.range}`);
        for (const id of ['110000000301', '110000000302']) { const f = ecartBase(id); if (f) fautes.push(`pose+retrait à ${ecart} ms : ${f}`); }
      }
      dit(fautes.length === 0, '[R-concurrence] « poser » sur une carte et « retirer » sur une autre du même compte, à 0-200 ms : la base garde LES DEUX (ce qu\'eBay tient)', fautes.join(' ; ') || reponses.join(' · '));
      const fautes2 = [];
      for (const ecart of [0, 100, 250, 400]) {
        avecR(); RA_('110000000302').regle = { actives: false, accepte: null, refuse: null, offresFaites: null };
        lignes.push(ligne({ lu: true, offresActives: false, accepte: null, refuse: null, devise: 'EUR', prix: 90, lueA: t0, par: 'sync' }));
        await Promise.all([
          app(JWT_J, POSE('110000000301', 72, 80, NUL)),
          new Promise((r) => setTimeout(r, ecart)).then(() => app(JWT_J, POSE('110000000302', 80, 90, NUL))),
        ]);
        for (const id of ['110000000301', '110000000302']) { const f = ecartBase(id); if (f) fautes2.push(`deux poses à ${ecart} ms : ${f}`); }
      }
      dit(fautes2.length === 0, '[R-concurrence] deux poses sur deux cartes du même compte, à 0-400 ms : aucune n\'efface l\'autre, ni ne laisse un « en cours » périmé', fautes2.join(' ; '));
      // La ligne n'existe pas encore (premier geste du compte) : deux créations
      // concurrentes — l'une crée, l'autre reçoit 409, relit et fusionne.
      const fautes3 = [];
      for (const ecart of [0, 60]) {
        avecR(); RA_('110000000302').regle = { actives: false, accepte: null, refuse: null, offresFaites: null };
        await Promise.all([
          app(JWT_J, POSE('110000000301', 72, 80, 'inconnu')),
          new Promise((r) => setTimeout(r, ecart)).then(() => app(JWT_J, POSE('110000000302', 80, 90, 'inconnu'))),
        ]);
        for (const id of ['110000000301', '110000000302']) { const f = ecartBase(id); if (f) fautes3.push(`ligne absente, deux poses à ${ecart} ms : ${f}`); }
        if (lignes.filter((x) => x.owner === J && x.id === 'ebay_offres').length !== 1) fautes3.push(`ligne absente : ${lignes.filter((x) => x.owner === J && x.id === 'ebay_offres').length} lignes ebay_offres`);
      }
      dit(fautes3.length === 0, '[R-concurrence] la ligne n\'existe pas encore : deux premières poses concurrentes donnent UNE ligne qui porte les deux', fautes3.join(' ; '));
    } finally {
      global.fetch = f0;
      if (relecture0 === undefined) delete process.env.EBAY_RELECTURE_MS; else process.env.EBAY_RELECTURE_MS = relecture0;
    }
  });
  // ── [R-lecture-ratee] (11 octobre, revue — tour 2) UNE LECTURE RATÉE NE
  // REMPLACE RIEN. Un GetItem qui hoquette (synchro ou « Relire chez eBay »)
  // rangeait « pas lue » PAR-DESSUS une règle connue (plus récente, donc
  // gagnante) : VRM oubliait une règle qu'eBay appliquait toujours — plus
  // comptée active, plus de relecture des ventes eBay pour ce compte.
  await essaie('[R-lecture-ratee]', async () => {
    const poser1 = (e) => lignes.push({ owner: J, id: 'ebay_offres', data: { rev: 4, items: { '110000000301': e } } });
    for (const action of ['sync', 'regleoffrelire']) {
      avecR();
      RA_('110000000301').regle = { actives: true, accepte: '72.00', refuse: null, offresFaites: null };
      poser1({ lu: true, offresActives: true, accepte: 72, refuse: null, devise: 'EUR', prix: 80, offresFaites: null, lueA: Date.now() - JOUR, par: 'sync' });
      mode.getitemKoPour = '110000000301';
      const o = await app(JWT_J, action === 'sync' ? { action: 'sync' } : { action: 'regleoffrelire', itemIds: ['110000000301'] });
      mode.getitemKoPour = '';
      const e = (offresDe(J) || {})['110000000301'];
      dit(o.code === 200 && !!e && e.lu === true && e.accepte === 72 && e.offresActives === true, `[R-lecture-ratee] ${action} : le GetItem de l'annonce rate ⇒ la règle CONNUE (72 €, offres actives) reste dans la base, jamais remplacée par « pas lue »`, JSON.stringify(e));
      if (action === 'regleoffrelire') dit(!!(o.corps.lectures && o.corps.lectures['110000000301']) && o.corps.lectures['110000000301'].raison === 'lecture-ratee', '[R-lecture-ratee] la réponse, elle, dit que la relecture a raté', JSON.stringify(o.corps.lectures));
    }
    // Une écriture INCERTAINE (le risque qu'une règle soit active) n'est pas
    // effacée non plus par une lecture ratée.
    avecR();
    poser1({ lu: false, raison: 'incertain', lueA: Date.now() - H, par: 'regle' });
    mode.getitemKoPour = '110000000301';
    await app(JWT_J, { action: 'sync' });
    mode.getitemKoPour = '';
    const e2 = (offresDe(J) || {})['110000000301'];
    dit(!!e2 && e2.lu === false && e2.raison === 'incertain', '[R-lecture-ratee] une écriture incertaine n\'est pas effacée par une lecture ratée (le risque reste dit)', JSON.stringify(e2));
    // Sur une place VIDE, la lecture ratée se range : « pas lue », jamais « aucune ».
    avecR(); mode.getitemKoPour = '110000000301';
    await app(JWT_J, { action: 'sync' });
    mode.getitemKoPour = '';
    const e3 = (offresDe(J) || {})['110000000301'];
    dit(!!e3 && e3.lu === false && e3.raison === 'lecture-ratee', '[R-lecture-ratee] sur une place vide, la lecture ratée est rangée « pas lue »', JSON.stringify(e3));
  });
  // ── [R-course] (11 octobre, revue — tour 2) UNE LECTURE PARTIE AVANT UNE
  // POSE ET RANGÉE APRÈS. `lueA` était l'heure de la RÉPONSE : une lecture lente
  // se croyait plus fraîche que la relecture de la pose et la réécrivait
  // (« aucune » sur une annonce qu'eBay vend dès 72 €) ; et `garder` (la liste
  // d'une synchro) effaçait la règle d'une annonce publiée APRÈS que la liste
  // avait été lue. La lecture part sur une requête TENUE, jamais un délai.
  await essaie('[R-course]', async () => {
    const f0 = global.fetch;
    try {
      for (const variante of ['sync', 'relire']) {
        avecR();
        lignes.push({ owner: J, id: 'ebay_offres', data: { items: { '110000000301': { lu: true, offresActives: false, accepte: null, refuse: null, devise: 'EUR', prix: 80, lueA: Date.now() - 60000, par: 'sync' } } } });
        let lancer, fini; const pret = new Promise((r) => { lancer = r; }); const fin = new Promise((r) => { fini = r; });
        let tenu = false;
        global.fetch = async (url, opts = {}) => {
          const h = opts.headers || {}; const corps = String(opts.body || '');
          if (!tenu && /ebay\.com\/ws/.test(String(url)) && h['X-EBAY-API-CALL-NAME'] === 'GetItem' && /110000000301/.test(corps) && (variante === 'sync' ? /ReturnAll/.test(corps) : true)) {
            tenu = true;
            const rep0 = await f0(url, opts); const txt = await rep0.text();   // eBay lit l'annonce MAINTENANT (avant la pose)
            lancer(); await fin;                                               // la réponse arrive APRÈS la pose
            return new Response(txt, { status: rep0.status, headers: { 'content-type': 'text/xml' } });
          }
          return f0(url, opts);
        };
        const pL = variante === 'sync' ? app(JWT_J, { action: 'sync' }) : app(JWT_J, { action: 'regleoffrelire', itemIds: ['110000000301'] });
        await pret;
        // La pose part APRÈS la lecture tenue : au moins une milliseconde plus
        // tard (dans le faux, tout tient dans la même milliseconde — deux heures
        // de départ égales ne disent pas laquelle est la plus récente, et le
        // contrôle tombait une fois sur quelques-unes sur un code intact).
        await new Promise((r) => setTimeout(r, 3));
        const res = faireRes();
        await route.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer ' + JWT_J }, body: POSE('110000000301', 72, 80, NUL) }, res);
        fini(); await pL; global.fetch = f0;
        const e = (offresDe(J) || {})['110000000301'], eb = RA_('110000000301').regle;
        dit(res.code === 200 && eb.accepte != null && !!e && e.lu === true && e.accepte === 72, `[R-course] ${variante} : sa lecture de la Nike part AVANT une pose et revient APRÈS ⇒ la base garde la règle posée (eBay accepte dès ${eb.accepte}), jamais « aucune »`, JSON.stringify(e));
      }
      // Une publication avec règle pendant une synchro dont la LISTE a été lue avant elle.
      avecR();
      let lancer2, fini2; const pret2 = new Promise((r) => { lancer2 = r; }); const fin2 = new Promise((r) => { fini2 = r; });
      let tenu2 = false;
      global.fetch = async (url, opts = {}) => {
        const h = opts.headers || {}; const corps = String(opts.body || '');
        if (!tenu2 && /ebay\.com\/ws/.test(String(url)) && h['X-EBAY-API-CALL-NAME'] === 'GetItem' && /ReturnAll/.test(corps)) { tenu2 = true; lancer2(); await fin2; }
        return f0(url, opts);
      };
      const pS = app(JWT_J, { action: 'sync' });
      await pret2;
      const res2 = faireRes();
      const itemP = { title: 'Nike Air Max 1 bleu taille 44', categoryId: '15709', price: '74', conditionId: '3000', photos: ['https://img.test/1.jpg'], aspects: { Marque: 'Nike' }, ebayGere: true, numero: '77', offre: { accepte: 66 } };
      await route.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer ' + JWT_J }, body: { action: 'publish', item: itemP } }, res2);
      const id = res2.corps && res2.corps.itemId;
      fini2(); const sy = await pS; global.fetch = f0;
      const e2 = id ? (offresDe(J) || {})[String(id)] : null;
      dit(res2.code === 200 && sy.code === 200 && !!e2 && e2.lu === true && e2.accepte === 66, '[R-course] une annonce publiée avec règle (66 €) PENDANT une synchro dont la liste a été lue avant elle : sa règle reste dans la base (une liste plus ancienne ne prouve pas son absence)', `HTTP ${res2.code}/${sy.code} · ${JSON.stringify(e2)}`);
      // …et l'AUTRE sens : une annonce terminée dont l'entrée est plus ancienne
      // que la liste en sort bien (sinon on garderait les règles d'annonces mortes).
      avecR();
      lignes.push({ owner: J, id: 'ebay_offres', data: { items: { '110000000999': { lu: true, offresActives: true, accepte: 40, refuse: null, devise: 'EUR', prix: 50, lueA: Date.now() - JOUR, par: 'sync' } } } });
      await app(JWT_J, { action: 'sync' });
      dit(!(offresDe(J) || {})['110000000999'], '[R-course] une annonce absente d\'une liste COMPLÈTE, rangée avant elle, en sort toujours');
    } finally { global.fetch = f0; }
  });
  const BLOC66 = '<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails><ListingDetails><BestOfferAutoAcceptPrice currencyID="EUR">66.00</BestOfferAutoAcceptPrice></ListingDetails>';
  const itemC = { title: 'Nike Air Max 1 bleu taille 44', categoryId: '15709', price: '74', conditionId: '3000', photos: ['https://img.test/1.jpg'], aspects: { Marque: 'Nike' }, ebayGere: true };
  await essaie('[R-crea]', async () => {
    avecR();
    const o = await app(JWT_J, { action: 'pubverify', item: { ...itemC, offre: { accepte: 66, refuse: null } } });
    const v = auCompte(o.journal).find((x) => x.appel === 'VerifyAddFixedPriceItem');
    dit(o.code === 200 && v && v.corps.includes(BLOC66), '[R-crea] « Vérifier » avec une règle (66 € sur 74 €) : le <Item> porte les offres et le seuil', v ? v.corps.slice(-400) : `HTTP ${o.code}`);
    for (const [nom, it, reason] of [['seuil = prix', { ...itemC, offre: { accepte: 74 } }, 'offre'], ['prix illisible', { ...itemC, price: 'abc', offre: { accepte: 66 } }, 'offre'], ['sous la moitié', { ...itemC, offre: { accepte: 7 } }, 'sous-moitie']]) {
      avecR();
      const x = await app(JWT_J, { action: 'pubverify', item: it });
      dit(x.code === 400 && x.corps.reason === reason && zero(x), `[R-crea] ${nom} ⇒ 400 « ${reason} », zéro appel eBay`, `HTTP ${x.code} · ${x.corps && x.corps.reason}`);
    }
    // (11 octobre, revue — tour 2) Un montant qui s'arrondit à 0 ne part JAMAIS
    // (« BestOfferAutoAcceptPrice 0.00 » / « MinimumBestOfferPrice 0.00 ») —
    // ni à la vérification, ni à la publication, confirmé ou non.
    for (const action of ['pubverify', 'publish']) {
      for (const [nom, offre] of [['seuil 1e-9 confirmé', { accepte: 1e-9, sousMoitie: true }], ['seuil 5e-324 confirmé', { accepte: 5e-324, sousMoitie: true }], ['refus 1e-9', { accepte: 66, refuse: 1e-9 }]]) {
        avecR();
        const x = await app(JWT_J, { action, item: { ...itemC, offre } });
        const parti = auCompte(x.journal).find((y) => /AddFixed|VerifyAdd/.test(y.appel));
        dit(x.code === 400 && x.corps.reason === 'offre' && zero(x), `[R-crea] ${action} ${nom} ⇒ 400 « offre », zéro appel eBay (jamais « 0.00 » chez eBay)`, `HTTP ${x.code} · ${parti ? (parti.corps.match(/<(?:BestOfferAutoAcceptPrice|MinimumBestOfferPrice)[^>]*>[^<]*</g) || []).join(' ') : 'rien parti'}`);
      }
    }
    avecR();
    const o2 = await app(JWT_J, { action: 'pubverify', item: { ...itemC, offre: { accepte: 7, sousMoitie: true } } });
    const v2 = auCompte(o2.journal).find((x) => x.appel === 'VerifyAddFixedPriceItem');
    dit(o2.code === 200 && v2 && /<BestOfferAutoAcceptPrice currencyID="EUR">7\.00</.test(v2.corps), '[R-crea] sous la moitié mais confirmé ⇒ le bloc part');
    avecR();
    const o3 = await app(JWT_J, { action: 'pubverify', item: { ...itemC, regleOffre: { accepte: 1 } } });
    const v3 = auCompte(o3.journal).find((x) => x.appel === 'VerifyAddFixedPriceItem');
    dit(o3.code === 200 && v3 && !/BestOffer|ListingDetails/.test(v3.corps), '[R-crea] un `regleOffre` glissé par le navigateur n\'est JAMAIS recopié');
    avecR();
    const p = await app(JWT_J, { action: 'programmer', confirme: true, uuid: 'C0FFEE0123456789ABCDEF0123456789', fraisVus: 0.2, scheduleTime: iso(Date.now() + 2 * JOUR), item: { ...itemC, numero: '61', offre: { accepte: 66, refuse: null } } });
    const pv = auCompte(p.journal).find((x) => x.appel === 'VerifyAddFixedPriceItem'), pa = auCompte(p.journal).find((x) => x.appel === 'AddFixedPriceItem');
    const iA = auCompte(p.journal).findIndex((x) => x.appel === 'AddFixedPriceItem');
    dit(p.code === 200 && pv && pa && pv.corps.includes(BLOC66) && pa.corps.includes(BLOC66) && p.corps.offre && p.corps.offre.envoyee && p.corps.offre.envoyee.accepte === 66 && !auCompte(p.journal).slice(iA + 1).some((x) => x.appel === 'GetItem'),
      '[R-crea] programmer : vérification ET ajout portent le même bloc, la réponse dit ce qui a été ENVOYÉ, aucune relecture d\'une annonce pas commencée', `HTTP ${p.code} · ${appels(p.journal)}`);
    avecR();
    const q = await app(JWT_J, { action: 'publish', item: { ...itemC, offre: { accepte: 66, refuse: null } } });
    const iQ = auCompte(q.journal).findIndex((x) => x.appel === 'AddFixedPriceItem');
    dit(q.code === 200 && q.corps.offre && q.corps.offre.verifie === true && auCompte(q.journal).slice(iQ + 1).filter((x) => x.appel === 'GetItem').length === 1, '[R-crea] publier avec une règle ⇒ UNE relecture après l\'ajout, « vérifiée »', `HTTP ${q.code} · ${appels(q.journal)}`);
  });
  await essaie('[R-vide]', async () => {
    const st = iso(Date.now() + 2 * JOUR);
    const corpsDe = async (offre) => {
      const out = [];
      for (const corps of [{ action: 'pubverify', item: { ...itemC, ...offre } }, { action: 'publish', item: { ...itemC, ...offre } }, { action: 'programmer', confirme: true, uuid: 'D0FFEE0123456789ABCDEF0123456789', fraisVus: 0.2, scheduleTime: st, item: { ...itemC, numero: '62', ...offre } }]) {
        remettre(); remettreBase(); prochainId = 110000000777;
        const o = await app(JWT_J, corps);
        out.push(auCompte(o.journal).filter((x) => /AddFixed|VerifyAdd/.test(x.appel)).map((x) => x.corps).join('\n'));
      }
      return out;
    };
    const sans = await corpsDe({}), nul = await corpsDe({ offre: null });
    dit(sans.every((s, i) => s && s === nul[i]) && sans.every((s) => !/BestOffer|ListingDetails|MinimumBestOffer/.test(s)), '[R-vide] sans règle (absente ou null) : le XML est identique, sans aucun bloc d\'offre', sans.map((s) => s.length).join('/'));
  });
  await essaie('[R-§11]', async () => {
    const lib = await import('file://' + path.join(RACINE, 'api', '_lib', 'ebay.js'));
    const noms = ['MONTANT_MAX', 'montantOk', 'valideRegleOffre', 'seuilTropBas'];
    const srcs = noms.map((n) => extraire(APP, n));
    let A = null;
    if (srcs.every(Boolean)) { const c3 = {}; vm.createContext(c3); try { vm.runInContext(srcs.join('\n') + '\n;this.R = { valideRegleOffre, seuilTropBas };', c3); A = c3.R; } catch (_) {} }
    dit(!!A && typeof A.valideRegleOffre === 'function', '[R-§11] la règle d\'offre existe dans l\'app (`valideRegleOffre`, `seuilTropBas`) et se charge', srcs.map((s, i) => s ? '' : noms[i]).filter(Boolean).join(','));
    const cas = [{ accepte: 72, prix: 80 }, { accepte: 80, prix: 80 }, { accepte: 79.995, prix: 80 }, { accepte: 0 }, { accepte: -1 }, { accepte: '72' }, { accepte: 72.5, refuse: 72.5 }, { accepte: 72, refuse: 60 }, { accepte: null, refuse: 60 }, { accepte: null, refuse: null }, { accepte: 72, refuse: undefined }, { accepte: 1e6 }, { accepte: NaN }, { accepte: 72.555 },
      { accepte: 1e-9 }, { accepte: 5e-324 }, { accepte: 0.004 }, { accepte: 0.01 }, { accepte: 72, refuse: 1e-9 }];
    const ecarts = A ? cas.filter((c) => JSON.stringify(A.valideRegleOffre({ prix: null, ...c })) !== JSON.stringify(lib.valideRegleOffre({ prix: null, ...c }))) : cas;
    dit(ecarts.length === 0, '[R-§11] `valideRegleOffre` rend la MÊME chose dans l\'app et sur le serveur', ecarts.map((c) => JSON.stringify(c)).join(' · '));
    const cs = [[7, 80], [40, 80], [39.99, 80], [0.03, 0.05], [72, null], [NaN, 80]];
    const e2 = A ? cs.filter(([a, p]) => A.seuilTropBas(a, p) !== lib.seuilTropBas(a, p)) : cs;
    dit(e2.length === 0, '[R-§11] `seuilTropBas` aussi', e2.map((c) => JSON.stringify(c)).join(' · '));
  });

  // ══ (11 octobre, revue — tour 3) ═════════════════════════════════════════
  // [R-prog-regle] Une annonce PROGRAMMÉE part avec sa règle : la route la
  // RANGE (relue si elle est en ligne maintenant, « programmee » sinon). Elle
  // n'était ni rangée ni relue : une fois partie, VRM ne la voyait nulle part.
  await essaie('[R-prog-regle]', async () => {
    const corpsP = (uuid, numero, scheduleTime) => ({ action: 'programmer', confirme: true, uuid, fraisVus: 0.2, scheduleTime, item: { ...itemC, numero, offre: { accepte: 66, refuse: null } } });
    avecR();
    const o = await app(JWT_J, corpsP('C1FFEE0123456789ABCDEF0123456789', '63', ''));
    const id = o.corps && String(o.corps.itemId || '');
    const e = (offresDe(J) || {})[id];
    const iA = auCompte(o.journal).findIndex((x) => x.appel === 'AddFixedPriceItem');
    const nGet = iA < 0 ? 0 : auCompte(o.journal).slice(iA + 1).filter((x) => x.appel === 'GetItem').length;
    dit(o.code === 200 && !!e && e.lu === true && e.accepte === 66 && e.par === 'programmation' && nGet === 1 && !!o.corps.offre && o.corps.offre.range === true && !!o.corps.offre.lecture,
      '[R-prog-regle] programmer « maintenant » avec une règle (66 €) ⇒ relue chez eBay après l\'ajout et RANGÉE, comme une publication', `HTTP ${o.code} · ${JSON.stringify(e)} · ${nGet} GetItem après`);
    avecR();
    const p = await app(JWT_J, corpsP('C2FFEE0123456789ABCDEF0123456789', '64', iso(Date.now() + 2 * JOUR)));
    const e2 = (offresDe(J) || {})[p.corps && String(p.corps.itemId || '')];
    dit(p.code === 200 && !!e2 && e2.lu === false && e2.raison === 'programmee' && e2.accepte === 66 && !!p.corps.offre && p.corps.offre.programmee === true && p.corps.offre.range === true,
      '[R-prog-regle] programmée pour plus tard ⇒ rangée « programmee » avec le seuil ENVOYÉ (66 €) — l\'app la compte comme une règle qu\'eBay tiendra', `HTTP ${p.code} · ${JSON.stringify(e2)}`);
    avecR(); mode.add = 'maintenant';
    const q = await app(JWT_J, corpsP('C3FFEE0123456789ABCDEF0123456789', '65', iso(Date.now() + 2 * JOUR)));
    const e3 = (offresDe(J) || {})[q.corps && String(q.corps.itemId || '')];
    dit(q.code === 200 && q.corps.enLigneMaintenant === true && !!e3 && e3.lu === true && e3.accepte === 66,
      '[R-prog-regle] eBay a ignoré l\'heure (en ligne MAINTENANT) ⇒ la règle est relue et rangée tout de suite', `HTTP ${q.code} · ${JSON.stringify(e3)}`);
  });
  // [R-retrouvee] (tour 4, #2) Après un premier envoi resté SANS RÉPONSE,
  // l'annonce existe chez eBay avec sa règle. Au second essai, `dejaChezEbay`
  // la reconnaît (409 « deja-* ») AVANT la branche « programmée rangée » du
  // tour 3 : la règle n'était alors rangée NULLE PART (ni « ce que ça engage »,
  // ni la relecture des ventes, ni la déconnexion). `rangerRetrouvee` la range
  // depuis la demande.
  await essaie('[R-retrouvee]', async () => {
    const corpsR = { action: 'programmer', confirme: true, uuid: 'D1FFEE0123456789ABCDEF0123456789', fraisVus: 0.2, scheduleTime: iso(Date.now() + 2 * JOUR), item: { ...item, numero: '63', offre: { accepte: 66, refuse: null } } };
    avecR(); uuidsVus.clear(); mode.add = 'reseau-apres';
    const o = await app(JWT_J, corpsR);
    dit(o.code === 504 && o.corps.reason === 'incertain', '[R-retrouvee] le réseau tombe après l\'ajout ⇒ « incertain » (l\'annonce a pu être créée chez eBay avec sa règle)', `HTTP ${o.code}`);
    mode.add = 'ok';
    const o2 = await app(JWT_J, corpsR);
    const id = o2.corps && String(o2.corps.itemId || '');
    const e = (offresDe(J) || {})[id];
    dit(o2.code === 409 && o2.corps.reason === 'deja-programmee' && !!e && e.lu === false && e.raison === 'programmee' && e.accepte === 66 && !!o2.corps.offre && o2.corps.offre.retrouvee === true && o2.corps.offre.range === true,
      '[R-retrouvee] le second envoi retrouve la paire déjà programmée (409) ⇒ sa règle (66 €) est RANGÉE depuis la demande, pas perdue', `HTTP ${o2.code} · ${JSON.stringify(e)}`);
  });
  // [R-retire-regle] Une annonce terminée (retirée, programmation annulée) sort
  // aussi des règles rangées — la déconnexion la comptait encore.
  await essaie('[R-retire-regle]', async () => {
    const regles2 = () => lignes.push({ owner: J, id: 'ebay_offres', data: { rev: 1, items: {
      '110000000301': { lu: true, offresActives: true, accepte: 72, refuse: null, devise: 'EUR', prix: 80, lueA: Date.now() - H, par: 'sync' },
      '110000000302': { lu: true, offresActives: true, accepte: 70, refuse: 50, devise: 'EUR', prix: 90, lueA: Date.now() - H, par: 'sync' },
      '110000000307': { lu: false, raison: 'programmee', accepte: 90, refuse: null, lueA: Date.now() - H, par: 'programmation' } } } });
    avecR(); regles2();
    const o = await app(JWT_J, { action: 'retirer', itemId: '110000000301', confirme: true });
    const its = offresDe(J) || {};
    dit(o.code === 200 && o.corps.regles === true && !its['110000000301'] && !!its['110000000302'], '[R-retire-regle] retirer une annonce ⇒ sa règle SORT de ebay_offres (les autres restent)', `HTTP ${o.code} · ${Object.keys(its).join(',')}`);
    avecR(); regles2();
    const d = await app(JWT_J, { action: 'deprogrammer', itemId: '110000000307', confirme: true });
    const its2 = offresDe(J) || {};
    dit(d.code === 200 && d.corps.verifie === true && !its2['110000000307'] && !!its2['110000000301'], '[R-retire-regle] annuler une programmation ⇒ sa règle « programmee » sort aussi', `HTTP ${d.code} · ${Object.keys(its2).join(',')}`);
    avecR(); regles2(); mode.offresKo = true;
    const o3 = await app(JWT_J, { action: 'retirer', itemId: '110000000301', confirme: true });
    mode.offresKo = false;
    dit(o3.code === 200 && o3.corps.regles === false && ecrit(o3.journal, 'ebay_offres') === null, '[R-retire-regle] ligne des règles illisible ⇒ rien n\'est réécrit (et la réponse le dit)', `HTTP ${o3.code} · regles=${o3.corps.regles}`);
  });
  // [R-lire-absente] « Relire chez eBay » sur une liste COMPLÈTE : une annonce
  // qui n'est plus sur ce compte voit sa règle sortir (la règle de la synchro :
  // seulement une entrée plus ancienne que la liste).
  await essaie('[R-lire-absente]', async () => {
    avecR();
    lignes.push({ owner: J, id: 'ebay_offres', data: { rev: 1, items: {
      '110000000999': { lu: true, offresActives: true, accepte: 40, refuse: null, devise: 'EUR', prix: 60, lueA: Date.now() - JOUR, par: 'sync' },
      '110000000302': { lu: true, offresActives: true, accepte: 70, refuse: 50, devise: 'EUR', prix: 90, lueA: Date.now() - H, par: 'sync' } } } });
    const o = await app(JWT_J, { action: 'regleoffrelire', itemIds: ['110000000999'] });
    const its = offresDe(J) || {};
    dit(o.code === 200 && o.corps.lectures['110000000999'].raison === 'pas-sur-ce-compte' && !its['110000000999'] && !!its['110000000302'],
      '[R-lire-absente] eBay ne la montre plus sur ce compte (liste complète) ⇒ dite, et sa règle rangée SORT (les autres restent)', `HTTP ${o.code} · ${Object.keys(its).join(',')}`);
  });
  // [R-engage] (app) UNE règle pour « eBay tient — peut-être — une règle » :
  // `regleEngage` sur `etatRegleOffre`, et `reglesEngagees` (déconnexion,
  // fermeture, relecture des ventes) — exécutées, jamais relues.
  await essaie('[R-engage]', async () => {
    const noms = ['REGLE_ANCIENNE_MS', 'etatRegleOffre', 'regleEngage', 'reglesEngagees'];
    const srcs = noms.map((n) => extraire(APP, n));
    let A = null;
    if (srcs.every(Boolean)) { const c3 = {}; vm.createContext(c3); try { vm.runInContext(srcs.join('\n') + '\n;this.R = { etatRegleOffre, regleEngage, reglesEngagees };', c3); A = c3.R; } catch (_) {} }
    dit(!!A, '[R-engage] la règle existe dans l\'app (`regleEngage`, `reglesEngagees`) et se charge', srcs.map((s, i) => s ? '' : noms[i]).filter(Boolean).join(','));
    if (!A) return;
    const now = Date.now();
    const lu = (o) => ({ lu: true, devise: 'EUR', lueA: now - H, offresFaites: null, prix: 80, ...o });
    const cas = [
      ['connue', lu({ offresActives: true, accepte: 72 }), 'oui'],
      ['offres-inconnues', lu({ offresActives: null, accepte: 72 }), 'peut-etre'],
      ['incertain', { lu: false, raison: 'incertain', lueA: now }, 'peut-etre'],
      ['en-cours', { lu: false, raison: 'en-cours', lueA: now }, 'peut-etre'],
      ['apres-ecriture', { lu: false, raison: 'apres-ecriture', lueA: now }, 'peut-etre'],
      ['programmee', { lu: false, raison: 'programmee', accepte: 70, lueA: now }, 'peut-etre'],
      ['prix changé sur une règle', lu({ offresActives: true, accepte: 72, prix: 90 }), 'peut-etre'],
      ['aucune', lu({ offresActives: true, accepte: null }), null],
      ['offres coupées', lu({ offresActives: false, accepte: 72 }), null],
      ['lecture ratée', { lu: false, raison: 'lecture-ratee', lueA: now }, null],
      // (tour 4, défauts #4 et #6) Une règle qu'eBay TIENT en devise étrangère
      // engage comme en euros — VRM ne la POSE pas, mais eBay vend seul.
      ['autre devise, règle active', lu({ offresActives: true, accepte: 72, devise: 'USD' }), 'oui'],
      ['autre devise, seuil relu sans l\'état des offres', lu({ offresActives: null, accepte: 72, devise: 'USD' }), 'peut-etre'],
      ['autre devise, aucune règle', lu({ offresActives: false, accepte: null, devise: 'USD' }), null],
    ];
    const faux = cas.filter(([, e, k]) => A.regleEngage(A.etatRegleOffre({ itemId: '1', price: '80' }, new Map([['principal:1', e]]), null, now)) !== k);
    dit(!faux.length, '[R-engage] connue ⇒ « oui » ; seuil relu sans l\'état des offres, incertaine, en cours, posée pas relue, programmée, prix changé, règle active en devise étrangère ⇒ « oui »/« peut-être » selon l\'état ; aucune, offres coupées, lecture ratée ⇒ rien', faux.map((c) => c[0]).join(' · '));
    const E = (o) => lu({ offresActives: true, accepte: 60, ...o });
    const base = (o) => ({ ref: 'principal', entrees: { '1': E({}), '2': E({ lueA: now - 2 * JOUR }), '3': E({ lueA: now }), '4': { lu: false, raison: 'apres-ecriture', lueA: now - 2 * JOUR } }, annonces: [{ itemId: '1', price: '80' }], programmees: [], cap: now - H / 2, complet: true, ...o });
    const r1 = A.reglesEngagees([base({})], now);
    dit(r1.oui === 2 && r1.peutEtre === 0, '[R-engage] liste complète lue APRÈS : une règle d\'annonce terminée (2) ne compte plus ; une règle plus récente que la liste (3) compte ; une écriture pas relue d\'une annonce terminée (4) non plus', JSON.stringify(r1));
    const r2 = A.reglesEngagees([base({ complet: false })], now), r3 = A.reglesEngagees([base({ annonces: null })], now);
    dit(r2.oui === 3 && r2.peutEtre === 1 && r3.oui === 3 && r3.peutEtre === 1, '[R-engage] liste incomplète ou illisible ⇒ rien n\'est écarté (« pas su » ne cache rien)', `${JSON.stringify(r2)} · ${JSON.stringify(r3)}`);
    const r4 = A.reglesEngagees([{ ref: 'principal', entrees: { '1': E({ prix: 80 }) }, annonces: [{ itemId: '1', price: '95' }], programmees: [], cap: now, complet: true }], now);
    dit(r4.oui === 0 && r4.peutEtre === 1, '[R-engage] le prix de la liste juge « prix changé » ⇒ peut-être (comme la carte)', JSON.stringify(r4));
  });
  // [R-apres-prix] (app) Après un changement de prix, « ✓ … reste à » ne
  // s'écrit que si la carte dit « connue » sur la MÊME lecture.
  await essaie('[R-apres-prix]', async () => {
    const noms = ['eurEbay', 'seuilTropBas', 'etatEnClair', 'REGLE_ANCIENNE_MS', 'etatRegleOffre', 'regleApresPrix'];
    const srcs = noms.map((n) => extraire(APP, n));
    let A = null;
    if (srcs.every(Boolean)) { const c3 = {}; vm.createContext(c3); try { vm.runInContext(srcs.join('\n') + '\n;this.R = { regleApresPrix };', c3); A = c3.R; } catch (_) {} }
    dit(!!A, '[R-apres-prix] `regleApresPrix` se charge', srcs.map((s, i) => s ? '' : noms[i]).filter(Boolean).join(','));
    if (!A) return;
    const L = (o) => ({ lecture: { lu: true, accepte: 72, refuse: 60, devise: 'EUR', prix: 85, offresFaites: 2, lueA: Date.now(), ...o }, tombee: false, avant: { accepte: 72, refuse: 60 } });
    const r0 = A.regleApresPrix(L({ offresActives: true }), []), rN = A.regleApresPrix(L({ offresActives: null }), []), rF = A.regleApresPrix(L({ offresActives: false }), []);
    dit(r0.ton === 'ok' && /^✓/.test(r0.msg) && rN.ton === 'warn' && !/✓/.test(rN.msg) && rF.ton === 'warn' && !/✓/.test(rF.msg),
      '[R-apres-prix] offres actives ⇒ « ✓ … reste à 72 € » ; offres activées ou non pas montré, ou coupées ⇒ ambre, sans ✓', `${r0.ton}/${rN.ton}/${rF.ton} · « ${rN.msg} »`);
  });
  // [R-publie-offre] (app) Ce que la publication dit de la règle vient de la
  // MÊME classification que la carte (`resultatRegleOffre`).
  await essaie('[R-publie-offre]', async () => {
    const noms = ['eurEbay', 'etatEnClair', 'resultatRegleOffre', 'messageOffreCreation'];
    const srcs = noms.map((n) => extraire(APP, n));
    let A = null;
    if (srcs.every(Boolean)) { const c3 = {}; vm.createContext(c3); try { vm.runInContext(srcs.join('\n') + '\n;this.R = { messageOffreCreation };', c3); A = c3.R; } catch (_) {} }
    dit(!!A, '[R-publie-offre] `messageOffreCreation` se charge', srcs.map((s, i) => s ? '' : noms[i]).filter(Boolean).join(','));
    if (!A) return;
    const lec = (o) => ({ lu: true, accepte: 66, refuse: null, devise: 'EUR', prix: 74, lueA: Date.now(), ...o });
    const a = A.messageOffreCreation({ verifie: null, lecture: lec({ offresActives: null }), range: true }, { accepte: 66 });
    const b0 = A.messageOffreCreation({ verifie: null, lecture: null, range: false }, { accepte: 66 });
    const c = A.messageOffreCreation({ verifie: true, lecture: lec({ offresActives: true }), range: false }, { accepte: 66 });
    const d = A.messageOffreCreation({ verifie: true, lecture: lec({ offresActives: true }), range: true }, { accepte: 66 });
    dit(a.issue === 'offres-inconnues' && !a.ok && /66,00/.test(a.msg) && !/pas encore relue/.test(a.msg) && b0.issue === 'non-relu' && !b0.ok && c.issue === 'ok' && !c.ok && d.ok === true,
      '[R-publie-offre] seuil relu sans l\'état des offres ⇒ « eBay montre ton seuil », jamais « pas encore relue » ; rien relu ⇒ pas relue ; posée mais pas notée ⇒ pas « ok »', JSON.stringify([a.issue, b0.issue, c.ok, d.ok]));
  });

  // ── 11. BASE PAS ENCORE CLOISONNÉE : rejouée dans un processus neuf ─────────
  await essaie('base non cloisonnée', async () => {
    const args = [__filename, '--non-cloisonnee'];
    if (iSrc > 0) args.push('--src', RACINE);
    const r = cp.spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60000 });
    const sortie = String(r.stdout || '');
    process.stdout.write(sortie.split('\n').filter((l) => /^(✅|❌)/.test(l)).map((l) => '   ' + l).join('\n') + '\n');
    const m = /NC ok=(\d+) ko=(\d+)/.exec(sortie);
    dit(!!m && m[2] === '0' && Number(m[1]) >= 3, 'base non cloisonnée : comportement d\'avant à l\'identique', m ? m[0] : String(r.stderr || '').slice(0, 160));
  });

  console.log(ko ? `\n❌ audit-ebay-route : ${ko} rouge(s), ${ok} vert(s)`
                 : `\n✅ audit-ebay-route : ${ok} contrôles — chaque vendeur pilote SON eBay et jamais celui d'un autre ; ce qui engage exige sa confirmation ; frais lus par nom ; programmer, annuler, déplacer disent ce qu'eBay a vraiment fait`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ audit-ebay-route est tombé :', e && e.message); process.exit(1); });
