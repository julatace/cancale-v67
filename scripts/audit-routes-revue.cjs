// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : revue adverse des routes serveur (17 octobre)
//         node scripts/audit-routes-revue.cjs
// ═══════════════════════════════════════════════════════════════════════════
// §4.10 : une route n'est vérifiée que si on l'EXÉCUTE. Chaque scénario lance
// la VRAIE route (api/*.js) dans un processus neuf (les mémoires d'instance —
// sonde de cloisonnement, jetons — ne débordent pas d'un scénario à l'autre),
// contre une fausse base à état. Données inventées.
//
//   A. Facture Pro — compteur ILLISIBLE : la route repartait de 0, émettait
//      « FA-AAAA-0001 » (un numéro déjà donné) et RÉÉCRIVAIT le compteur à 1 :
//      toutes les factures suivantes reprenaient des numéros déjà émis.
//   B. Facture Pro — même email RENVOYÉ (le 503 est fait pour ça) : la facture
//      déjà émise recevait un NOUVEAU numéro et repassait « à envoyer » — le
//      script Gmail l'envoyait une seconde fois à l'acheteur.
//   C. Rejeu d'un email mis de côté (api/email-rattacher → traiterEmail) :
//      une sonde de cloisonnement qui hoquette faisait lire SANS filtre de
//      vendeur, avec la clé de service (journal, mémo, fiches d'un autre).
//   D. Widget : une sonde ratée valait « une seule boutique » — lectures sans
//      filtre de vendeur, chiffres de TOUS les vendeurs servis.
//   E. /api/ai : la clé IA du SERVEUR (celle de Julien) payait pour n'importe
//      quel vendeur connecté (§2.9), et écrasait même la clé du vendeur.
//   F. /api/vinted-refresh : jetons renouvelés chez Vinted (l'ancien est
//      consommé) mais pas rangés en base ⇒ la route répondait 200 « refreshed ».
//   P. (17 oct.) Facture : SEULEMENT pour un compte Vinted PRO (la mention de
//      Vinted « membre Vinted Pro » / « Coordonnées de l'acheteur »), identité =
//      n° de transaction (pièce jointe « Formulaire-retour-commande-{tx} »).
//      Un compte particulier n'a pas les coordonnées de l'acheteur : jamais de
//      facture. Email inventé, à la forme de celui que Julien a transmis.
//
// §6.1 : copié dans un arbre d'avant et lancé DEPUIS cet arbre, il doit être
// rouge (RACINE se déduit de __dirname).
const path = require('path');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');

const A = '11111111-2222-3333-4444-555555555555';
const B = '99999999-8888-7777-6666-555555555555';
const JWT = (sub) => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.sig';

if (!process.argv[2]) {
  let ko = 0, ok = 0;
  for (const sc of ['A', 'A2', 'B', 'C', 'D', 'E', 'F', 'P']) {
    const r = spawnSync(process.execPath, [__filename, sc], { encoding: 'utf8', timeout: 60000 });
    const out = (r.stdout || '') + (r.stderr ? r.stderr.split('\n').filter((l) => /❌|Error/.test(l)).join('\n') : '');
    process.stdout.write(out);
    ok += (out.match(/✅/g) || []).length;
    ko += (out.match(/❌/g) || []).length;
    if (r.status !== 0 && !/❌/.test(out)) { ko++; console.log(`❌ scénario ${sc} — le processus est mort (code ${r.status})`); }
  }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
}

// ── Dans le processus d'un scénario ─────────────────────────────────────────
const SC = process.argv[2];
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + `[${SC}] ` + m + (d ? ' — ' + d : '')); };

process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.EMAIL_INBOUND_SECRET='cle-banc-routes';
delete process.env.VAPID_PRIVATE_KEY;
delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;

const base = new Map([[`${A}|vrm_email_owners`,{adresses:{'boite@banc.test':{owner:A}}}]]);                     // `${owner}|${id}` → data
const pannes = new Set();                   // ids dont la LECTURE répond 522
let sondeKO = 0;                            // nombre de sondes `select=owner&limit=1` qui répondront 522
const lectures = [];                        // URLs GET app_data
const appels = [];                          // tout ce qui sort
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const r522 = () => new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
const filtreOwner = (u) => { const v = u.searchParams.get('owner'); return v ? decodeURIComponent(v.replace(/^eq\./, '')) : null; };
let fetchSpecial = null;

global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  appels.push({ url: String(url), m, headers: opts.headers || {}, body: opts.body });
  if (fetchSpecial) { const r = await fetchSpecial(u, m, opts); if (r) return r; }
  if (u.pathname === '/auth/v1/user') {
    const t = String((opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || '').replace(/^Bearer\s+/, '');
    const sub = JSON.parse(Buffer.from(t.split('.')[1] || 'e30', 'base64url').toString() || '{}').sub;
    return sub ? rep({ id: sub, email: 'v@banc.test' }) : rep({}, 401);
  }
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  if (m === 'POST') {
    for (const r of JSON.parse(opts.body || '[]')) base.set(`${r.owner || A}|${r.id}`, r.data);
    return new Response('', { status: 201 });
  }
  if (m !== 'GET') return rep([]);
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') { if (sondeKO > 0) { sondeKO--; return r522(); } return rep([]); }
  lectures.push(String(url));
  const idp = u.searchParams.get('id') || '';   // déjà décodé (un second décodage lève sur « %_ »)
  const own = filtreOwner(u);
  const exact = idp.startsWith('eq.') ? idp.slice(3) : null;
  if (exact && pannes.has(exact)) return r522();
  const like = idp.startsWith('like.') ? new RegExp('^' + idp.slice(5).replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$') : null;
  const lignes = [...base.entries()].map(([k, d]) => { const [o, id] = k.split('|'); return { owner: o, id, data: d }; })
    .filter((l) => (!own || l.owner === own) && (exact ? l.id === exact : like ? like.test(l.id) : true));
  // projections simples `x:data->k` / `x:data->>k` / `data->k`
  if (sel && sel !== 'data' && sel !== 'id,data' && sel !== 'owner,data') {
    return rep(lignes.map((l) => {
      const o = {};
      for (const part of sel.split(',')) {
        const [alias, chemin] = part.includes(':') ? part.split(':') : [part.replace(/^data->>?/, ''), part];
        if (chemin === 'id' || chemin === 'owner') { o[alias] = l[chemin]; continue; }
        const k = chemin.replace(/^data->>?/, '');
        o[alias] = l.data ? l.data[k] : undefined;
      }
      return o;
    }));
  }
  return rep(lignes);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };
const importer = (p) => import('file://' + path.join(RACINE, p));

const VENTE = {
  from: 'no-reply@vinted.fr', to: 'boite@banc.test', subject: 'Ton article s\'est vendu',
  text: 'acheteur_banc a acheté\nNike Air Max banc\n50,00 €\nEn tant que membre Vinted Pro, tu dois envoyer à l\'acheteur 2 documents supplémentaires :\nCoordonnées de l\'acheteur\nAdresse : Jean Banc, 1 rue du Banc 35000 Rennes\nAdresse e-mail : acheteur@banc.test\n',
  html: '', attachments: [],
};
// La forme de l'email d'un compte PRO, telle que Julien l'a transmise (16 oct.),
// avec des données INVENTÉES. Transféré depuis sa boîte, en-tête compris.
const VENTE_PRO = (tx, pseudo = 'acheteuse_banc') => ({
  from: 'boutique@banc.test', to: 'boite@banc.test', subject: 'Fwd: Ton article s\'est vendu !',
  text: '---------- Message transféré ---------\nDe : L\'équipe Vinted <no-reply@vinted.fr>\nObjet : Ton article s\'est vendu !\n\n'
    + 'Bonjour boutique_banc,\n\n' + pseudo + ' a acheté\n\nAsics Metaspeed banc - Taille 43,5\n\n30,00 €\n\n'
    + 'Nous transférerons le paiement sur ton porte-monnaie Vinted une fois la commande terminée.\n'
    + 'Expédie cette commande au cours des 5 prochains jours.\n'
    + 'En tant que membre Vinted Pro, tu dois envoyer à l\'acheteur 2 documents supplémentaires :\n'
    + '• Un formulaire de retour de commande.\n• Une facture. Veille à inclure une facture dans le colis avec l\'article.\n\n'
    + 'Coordonnées de l\'acheteur\nAdresse :\nMarie Banc, 12 rue Inventée, Lisbonne, 1000-001, PT, Portugal\nAdresse e-mail :\nmarie.banc@exemple.test\n\n'
    + 'N\'hésite pas à contacter ' + pseudo + ' afin de lui faire savoir quand tu as envoyé l\'article.\n\nL\'équipe Vinted\n',
  html: '', attachments: [{ filename: `Formulaire-retour-commande-${tx}.pdf`, contentType: 'application/pdf', content: '' }],
});
// Un compte PARTICULIER : la même vente, sans mention Pro ni coordonnées.
const VENTE_PART = {
  from: 'no-reply@vinted.fr', to: 'boite@banc.test', subject: 'Ton article s\'est vendu !',
  text: 'Bonjour julien_banc,\n\nacheteur_banc a acheté\n\nNike Air Max banc - Taille 42\n\n50,00 €\n\nNous transférerons le paiement sur ton porte-monnaie Vinted une fois la commande terminée.\n'
    + 'Expédie cette commande au cours des 5 prochains jours.\nRends-toi dans le fil de conversation entre l\'acheteur et toi pour télécharger ton bordereau d\'envoi.\n'
    + 'Pour toute question, écris-nous à aide@exemple.test\n',
  html: '', attachments: [],
};
const factures = () => [...base.entries()].filter(([k]) => k.includes('|email_invoice_')).map(([, d]) => d);

(async () => {
  try {
    if (SC === 'A') {
      base.set(`${A}|vrm_pro_facture`, { actif: true, autoSend: true, prefixe: 'FA' });
      base.set(`${A}|vrm_invoice_counter`, 41);
      pannes.add('vrm_invoice_counter');
      const inbound = await importer('api/email-inbound.js');
      const res = faireRes();
      await inbound.default({ method: 'POST', query: {}, headers: {'x-vrm-email-key':'cle-banc-routes'}, body: JSON.parse(JSON.stringify(VENTE)) }, res);
      const cpt = base.get(`${A}|vrm_invoice_counter`);
      dit(cpt === 41, 'compteur illisible : le compteur de factures n’est PAS réécrit', `compteur = ${JSON.stringify(cpt)} (était 41)`);
      const f = factures();
      dit(!f.some((x) => /-0001$/.test(String(x.number))), 'aucune facture n’est émise sous un numéro déjà donné (0001)', f.map((x) => x.number).join(', ') || 'aucune');
      dit(res.code === 503, 'la route ne dit pas « reçu » : l’email reviendra quand le compteur sera lisible', `HTTP ${res.code}`);
    }
    if (SC === 'A2') {
      // Le RÉGLAGE de facturation illisible n'est pas « facturation coupée ».
      base.set(`${A}|vrm_pro_facture`, { actif: true, autoSend: true, prefixe: 'FA' });
      base.set(`${A}|vrm_invoice_counter`, 41);
      pannes.add('vrm_pro_facture');
      const inbound = await importer('api/email-inbound.js');
      const res = faireRes();
      await inbound.default({ method: 'POST', query: {}, headers: {'x-vrm-email-key':'cle-banc-routes'}, body: JSON.parse(JSON.stringify(VENTE)) }, res);
      dit(res.code === 503, 'réglage de facturation illisible : pas de « reçu », la facture n’est pas perdue en silence', `HTTP ${res.code}`);
      // l'autre sens : réglage lisible et coupé ⇒ 200, aucune facture.
      pannes.clear(); base.set(`${A}|vrm_pro_facture`, { actif: false });
      const res2 = faireRes();
      await inbound.default({ method: 'POST', query: {}, headers: {'x-vrm-email-key':'cle-banc-routes'}, body: JSON.parse(JSON.stringify(VENTE)) }, res2);
      dit(res2.code === 200 && factures().length === 0, 'réglage lu « coupé » : 200 et aucune facture (l’autre sens)', `HTTP ${res2.code} · ${factures().length} facture(s)`);
    }
    if (SC === 'B') {
      base.set(`${A}|vrm_pro_facture`, { actif: true, autoSend: true, prefixe: 'FA' });
      base.set(`${A}|vrm_invoice_counter`, 41);
      const inbound = await importer('api/email-inbound.js');
      const recoit = async () => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: {'x-vrm-email-key':'cle-banc-routes'}, body: JSON.parse(JSON.stringify(VENTE)) }, res); return res; };
      await recoit();
      const f1 = factures();
      dit(f1.length === 1 && /-0042$/.test(f1[0].number), 'premier passage : une facture, numéro 0042', f1.map((x) => x.number).join(', '));
      // Le script Gmail l'envoie : statut « sent ».
      for (const [k, d] of base) if (k.includes('|email_invoice_')) base.set(k, { ...d, status: 'sent', sentAt: '2026-10-17T08:00:00Z' });
      const res2 = await recoit();
      const f2 = factures();
      dit(f2.length === 1 && /-0042$/.test(f2[0].number), 'email renvoyé : la facture garde SON numéro', f2.map((x) => x.number).join(', '));
      dit(f2[0] && f2[0].status === 'sent', 'email renvoyé : une facture déjà envoyée ne repasse pas « à envoyer »', f2[0] && f2[0].status);
      dit(base.get(`${A}|vrm_invoice_counter`) === 42, 'email renvoyé : aucun numéro brûlé', `compteur = ${base.get(`${A}|vrm_invoice_counter`)}`);
      dit(res2.code === 200, 'le renvoi est acquitté normalement', `HTTP ${res2.code}`);
    }
    if (SC === 'P') {
      base.set(`${A}|vrm_pro_facture`, { actif: true, autoSend: false, prefixe: 'FA' });
      base.set(`${A}|vrm_invoice_counter`, 10);
      const inbound = await importer('api/email-inbound.js');
      const recoit = async (m) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: {'x-vrm-email-key':'cle-banc-routes'}, body: JSON.parse(JSON.stringify(m)) }, res); return res; };
      const rp = await recoit(VENTE_PART);
      dit(rp.code === 200 && factures().length === 0, 'compte PARTICULIER (ni mention Pro, ni coordonnées) : aucune facture, même facturation allumée', `HTTP ${rp.code} · ${factures().length} facture(s)`);
      const p1 = await recoit(VENTE_PRO('23999999001'));
      const f = factures();
      dit(p1.code === 200 && f.length === 1, 'compte PRO : une facture est préparée', `HTTP ${p1.code} · ${f.length} facture(s)`);
      const x = f[0] || {};
      dit(x.transaction === '23999999001', 'son identité est le n° de transaction (pièce jointe « Formulaire-retour-commande-… »)', `transaction=${x.transaction}`);
      dit([...base.keys()].some((k) => k === `${A}|email_invoice_tx23999999001`), 'la ligne de facture est rangée sous la transaction', [...base.keys()].filter((k) => k.includes('email_invoice_')).join(', '));
      dit(x.buyerName === 'Marie Banc' && /Lisbonne/.test(x.buyerAddress || '') && x.buyerEmail === 'marie.banc@exemple.test',
        'le nom, l\'adresse et l\'email de l\'acheteur viennent du bloc « Coordonnées de l\'acheteur »', `${x.buyerName} · ${x.buyerAddress} · ${x.buyerEmail}`);
      dit(x.prix === '30.00' && /Asics Metaspeed banc/.test(x.designation || ''), 'le prix et l\'article sont ceux de la vente (pas l\'en-tête du transfert)', `${x.prix} · ${x.designation}`);
      await recoit(VENTE_PRO('23999999002'));
      dit(factures().length === 2, 'une AUTRE vente au même pseudo, prix et titre (autre transaction) a SA facture', `${factures().length} facture(s)`);
      await recoit(VENTE_PRO('23999999001'));
      dit(factures().length === 2, 'le même email renvoyé ne fait pas une troisième facture', `${factures().length} facture(s)`);
      // Une adresse email citée dans l'email d'un particulier n'en fait pas un pro.
      const leurre = JSON.parse(JSON.stringify(VENTE_PART)); leurre.text += 'Adresse : X, 1 rue Y\nAdresse e-mail : x@exemple.test\n';
      const nAvant = factures().length;
      await recoit(leurre);
      dit(factures().length === nAvant, 'un email SANS la mention de Vinted Pro ne fait pas de facture, même avec une adresse email dedans', `${nAvant} → ${factures().length} facture(s)`);
    }
    if (SC === 'C') {
      // Deux vendeurs ; l'email est rejoué chez B (propriétaire imposé).
      base.set(`${A}|email_journal`, { entries: [{ type: 'vente', subject: 'SECRET-DE-A' }] });
      base.set(`${A}|main`, { vinted_annonce_numeros: { x: { numero: 7, title: 'nike air max banc' } } });
      sondeKO = 1000;                      // la sonde ne répond plus du tout
      const inbound = await importer('api/email-inbound.js');
      const res = faireRes();
      await inbound.traiterEmail({ method: 'POST', query: {}, headers: {'x-vrm-email-key':'cle-banc-routes'}, body: JSON.parse(JSON.stringify(VENTE)), __ownerForce: B }, res);
      const sansFiltre = lectures.filter((l) => !/[?&]owner=eq\./.test(l) && !/vrm_email_owners/.test(l));
      dit(sansFiltre.length === 0, 'rejeu chez B, sonde muette : aucune lecture sans filtre de vendeur', sansFiltre.slice(0, 3).map((l) => decodeURIComponent(new URL(l).search)).join(' · '));
      const jB = base.get(`${B}|email_journal`);
      dit(!JSON.stringify(jB || {}).includes('SECRET-DE-A'), 'le journal de A ne se retrouve pas chez B', jB ? `${(jB.entries || []).length} entrée(s)` : 'pas de journal');
    }
    if (SC === 'D') {
      base.set(`${A}|main`, { vrm_widget_token: 'cle-de-a' });
      base.set(`${B}|main`, { vrm_widget_token: 'cle-de-b' });
      base.set(`${A}|email_sale_1`, { prix: '10', receivedAt: new Date().toISOString() });
      base.set(`${B}|email_sale_2`, { prix: '1000', receivedAt: new Date().toISOString() });
      sondeKO = 1;                         // un hoquet sur la sonde, la base répond pour le reste
      const w = await importer('api/widget.js');
      const res = faireRes();
      await w.default({ method: 'GET', query: { k: 'cle-de-a' }, headers: {} }, res);
      const sansFiltre = lectures.filter((l) => !/[?&]owner=eq\./.test(l) && !/select=owner,vrm_widget_token/.test(l));
      dit(sansFiltre.length === 0, 'sonde ratée : aucune lecture de données sans filtre de vendeur', `${sansFiltre.length} lecture(s) sans filtre`);
      const servi = res.code === 200 ? res.corps : null;
      dit(res.code === 503, 'sonde ratée : « pas su » — 503, aucun chiffre servi', servi ? `salesMonth=${servi.salesMonth}` : `HTTP ${res.code}`);
      // l'autre sens : la sonde répond, la clé de A sert les chiffres de A seul.
      lectures.length = 0;
      const r2 = faireRes();
      await w.default({ method: 'GET', query: { k: 'cle-de-a' }, headers: {} }, r2);
      dit(r2.code === 200 && r2.corps && r2.corps.salesMonth === 1, 'sonde lue : la clé de A sert SES chiffres (l’autre sens)', `HTTP ${r2.code} salesMonth=${r2.corps && r2.corps.salesMonth}`);
    }
    if (SC === 'E') {
      process.env.AI_API_KEY = 'cle-de-julien';
      const cles = [];
      fetchSpecial = async (u, m, opts) => {
        if (u.hostname === 'api.anthropic.com') { cles.push(opts.headers['x-api-key']); return rep({ content: [{ text: '{"title":"t","desc":"d","why":"w"}' }] }); }
        return null;
      };
      const ai = await importer('api/ai.js');
      // Un AUTRE vendeur (B), sans clé à lui.
      const r1 = faireRes();
      await ai.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer ' + JWT(B) }, body: { title: 'x' } }, r1);
      dit(!cles.includes('cle-de-julien'), 'un autre vendeur ne dépense pas la clé IA du serveur (§2.9)', `clés envoyées : ${JSON.stringify(cles)} · HTTP ${r1.code} ${JSON.stringify(r1.corps && r1.corps.reason)}`);
      // Un autre vendeur AVEC sa clé : c'est la sienne qui part.
      cles.length = 0;
      const r2 = faireRes();
      await ai.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer ' + JWT(B) }, body: { title: 'x', key: 'cle-de-b' } }, r2);
      dit(cles.length === 1 && cles[0] === 'cle-de-b', 'un vendeur qui apporte SA clé : c’est la sienne qui paie', JSON.stringify(cles));
      // Le propriétaire : la clé du serveur.
      cles.length = 0;
      const r3 = faireRes();
      await ai.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer ' + JWT(A) }, body: { title: 'x' } }, r3);
      dit(cles.length === 1 && cles[0] === 'cle-de-julien' && r3.corps && r3.corps.ok === true, 'le propriétaire garde la clé du serveur (l’autre sens)', JSON.stringify(cles));
    }
    if (SC === 'F') {
      const vieux = 'eyJ.' + Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url') + '.s';
      fetchSpecial = async (u, m) => {
        if (u.pathname === '/rest/v1/vinted_accounts' && m === 'GET') return rep([{ vinted_user_id: '900', access_token: vieux, refresh_token: 'rt-ancien', domain: 'www.vinted.fr' }]);
        if (u.pathname === '/rest/v1/vinted_accounts' && m === 'PATCH') return new Response('{"message":"boom"}', { status: 500 });
        if (u.hostname === 'www.vinted.fr') return rep({ access_token: 'at-neuf', refresh_token: 'rt-neuf' });
        return null;
      };
      const vr = await importer('api/vinted-refresh.js');
      const res = faireRes();
      await vr.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer ' + JWT(A) }, body: {} }, res);
      const act = res.corps && res.corps.summary && res.corps.summary[0] && res.corps.summary[0].action;
      dit(act !== 'refreshed', 'jetons pas rangés en base : la route ne dit pas « refreshed »', `action=${act}`);
      dit(res.code !== 200, 'jetons pas rangés : pas de 200', `HTTP ${res.code}`);
    }
  } catch (e) { ko++; console.log(`❌ [${SC}] a levé : ${String((e && e.stack) || e).split('\n').slice(0, 3).join(' ')}`); }
  process.exit(ko ? 1 : 0);
})();
