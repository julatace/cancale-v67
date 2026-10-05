// ════════════════════════════════════════════════════════════════════════════
//  RATTACHER UN EMAIL MIS DE CÔTÉ — la vraie route, exécutée (§4.10).
//        node scripts/audit-email-rattacher.cjs [--src dossier]
//
//  `/api/email-rattacher` rejoue un email en quarantaine AU PROFIT de celui
//  qui le réclame. Elle relit la ligne avec la CLÉ DE SERVICE — qui voit tous
//  les vendeurs — et ne la filtrait pas : n'importe quel vendeur connecté
//  pouvait faire rejouer chez lui l'email mis de côté d'un autre (bordereau,
//  adresse, acheteur) en donnant son identifiant. Et sans session, l'appel
//  repartait quand même dans la résolution.
//
//  Aucun banc n'avait jamais lancé cette route. Celui-ci le fait, avec deux
//  vendeurs, et vérifie les deux sens : l'autre vendeur ne prend rien, le
//  vendeur qui possède l'email le récupère bien.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

const J = '11111111-1111-1111-1111-111111111111';   // propriétaire de l'installation : la quarantaine est chez lui
const B = '22222222-2222-2222-2222-222222222222';   // un autre vendeur
const ID = 'email_quarantaine_mzx01abcde';
const LIGNE = {
  raison: 'adresse de réception inconnue', at: '2026-10-01T08:00:00.000Z',
  from: 'no-reply@vinted.fr', to: 'inconnue@vrm.center', subject: 'Ton article est vendu !',
  text: "acheteur-de-banc a acheté [Paire de banc] n°9001 42,00 €\nPrépare ton colis.", html: '<p>vendu</p>',
};

// ── Une fausse base, à deux vendeurs ─────────────────────────────────────────
let etat = {};
const journal = [];   // { m, id, owner, url }
const rep = (corps, status = 200, type = 'application/json') =>
  new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': type } });
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  if (u.includes('/auth/v1/user')) {
    const a = String((opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || '');
    if (a === 'Bearer jeton-de-B') return rep({ id: B });
    if (a === 'Bearer jeton-de-J') return rep({ id: J });
    return rep({ msg: 'invalid' }, 401);
  }
  if (!u.includes('/rest/v1/')) return rep({});
  if (m === 'POST') {
    try { JSON.parse(opts.body || '[]').forEach((x) => journal.push({ m, id: x.id, owner: x.owner || '', data: x.data })); } catch (_) {}
    return rep('', 201);
  }
  if (m === 'DELETE') { journal.push({ m, url: u }); return rep('', 204); }
  if (/select=owner&limit=1/.test(u)) return etat.sansColonne ? rep({ code: '42703' }, 400) : rep([{ owner: J }]);
  if (u.includes('id=eq.' + ID)) {
    if (etat.panne) return rep('<html>522</html>', 522, 'text/html');
    const filtre = /owner=eq\.([0-9a-f-]+)/.exec(u);
    if (filtre && etat.sansColonne) return rep({ code: '42703' }, 400);
    if (filtre && filtre[1] !== J) return rep([]);                // la ligne est à J
    return rep([{ data: LIGNE }]);
  }
  return rep([]);
};
const faireRes = () => { const x = { code: null, corps: null }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };

(async () => {
  process.env.VRM_OWNER_UID = J;
  let route;
  await essaie('chargement', async () => { route = await import('file://' + path.join(RACINE, 'api', 'email-rattacher.js')); });
  if (!route) { console.log(`\n❌ audit-email-rattacher : la route n'a pas pu être chargée`); process.exit(1); }
  const appeler = async (jeton, e, corps = { id: ID }) => {
    etat = e || {}; journal.length = 0;
    const res = faireRes();
    await route.default({ method: 'POST', headers: jeton ? { authorization: 'Bearer ' + jeton } : {}, body: corps }, res);
    return { code: res.code, corps: res.corps, journal: journal.slice() };
  };
  const metier = (j) => j.filter((x) => x.m === 'POST' && !/^email_quarantaine_/.test(x.id));

  await essaie('autre vendeur', async () => {
    const o = await appeler('jeton-de-B');
    const chezB = metier(o.journal).filter((x) => x.owner === B);
    dit(chezB.length === 0, "un autre vendeur ne peut pas faire rejouer CHEZ LUI l'email mis de côté d'un autre",
      chezB.length ? `${chezB.length} ligne(s) écrite(s) chez lui : ${chezB.map((x) => x.id).join(', ')}` : '');
    dit(!o.journal.some((x) => x.m === 'DELETE'), "et il ne peut pas non plus l'effacer",
      o.journal.filter((x) => x.m === 'DELETE').map((x) => x.url).join(' · '));
    dit(o.code === 404, "il reçoit « introuvable » — comme pour un identifiant qui n'existe pas", `HTTP ${o.code}`);
  });
  await essaie('sans session', async () => {
    const o = await appeler('');
    dit(o.code === 401 && o.journal.filter((x) => x.m !== 'GET').length === 0,
      'sans session, rien n\'est rejoué ni écrit (pas même une copie de plus en quarantaine)',
      `HTTP ${o.code} · ${o.journal.map((x) => x.m + ' ' + (x.id || x.url)).join(', ')}`);
  });
  await essaie('lecture ratée', async () => {
    const o = await appeler('jeton-de-J', { panne: true });
    dit(o.code >= 500, "une lecture ratée n'est pas « déjà rattaché » : c'est « réessaie »", `HTTP ${o.code} ${JSON.stringify(o.corps)}`);
  });
  // ── L'autre sens : le vendeur à qui l'email appartient le récupère ────────
  await essaie('son vendeur', async () => {
    const o = await appeler('jeton-de-J');
    dit(o.code === 200 && o.corps && o.corps.ok && metier(o.journal).some((x) => x.owner === J),
      "l'autre sens : le vendeur qui possède l'email le rattache bien chez lui",
      `HTTP ${o.code} · ${JSON.stringify(metier(o.journal).map((x) => x.id + '@' + (x.owner === J ? 'J' : x.owner)))}`);
    const del = o.journal.filter((x) => x.m === 'DELETE');
    dit(del.length === 1 && del[0].url.includes('owner=eq.' + J),
      "et la quarantaine n'est retirée QUE chez lui", del.map((x) => x.url.replace(/^.*\/rest\/v1\//, '')).join(' · ') || 'aucun DELETE');
  });
  await essaie('base sans colonne owner', async () => {
    const o = await appeler('jeton-de-J', { sansColonne: true });
    dit(o.code === 200 && o.corps && o.corps.ok,
      'base non cloisonnée (une seule boutique) : le rattachement marche comme avant', `HTTP ${o.code}`);
  });

  console.log(ko ? `\n❌ audit-email-rattacher : ${ko} rouge(s), ${ok} vert(s)`
                 : `\n✅ audit-email-rattacher : ${ok} contrôles — un email mis de côté ne se rattache qu'à son vendeur`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ audit-email-rattacher est tombé :', e && e.message); process.exit(1); });
