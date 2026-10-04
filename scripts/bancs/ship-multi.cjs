// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE RAPPEL D'EXPÉDITION, PAR VENDEUR (node scripts/bancs/ship-multi.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// §4.10 — une route serveur n'est vérifiée que si un banc l'EXÉCUTE.
// Le cron `ship-reminders` calculait UN total global et le poussait à TOUT LE
// MONDE (`sendPushToAll` sans contexte). Juste tant qu'il n'y a qu'un vendeur,
// faux dès qu'il y en a deux : le résumé de l'un part sur le téléphone de
// l'autre. On sert une base CLOISONNÉE avec DEUX vendeurs et on exige :
//   • une passe PAR vendeur, lectures filtrées `owner=eq.<lui>` ;
//   • le dédoublonnage écrit POUR CHAQUE vendeur (clé (owner,id)) ;
//   • les appareils (`push_subs`) lus par vendeur → chacun ses notifications ;
//   • JAMAIS une lecture globale de `email_bord_*` sans filtre owner.
// §6.1 : sur le code mono-vendeur (une passe globale), ces exigences TOMBENT.
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

// Date limite = aujourd'hui (Paris), en JJ/MM/AAAA — pour un colis « dû aujourd'hui ».
const auj = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }); // YYYY-MM-DD
const [Y, M, D] = auj.split('-');
const limiteAuj = `${D}/${M}/${Y}`;

// Deux vendeurs, chacun SES données.
const V = {
  A: { subs: [{ endpoint: 'https://push/A1' }], bord: { dateLimite: limiteAuj, transaction: 'TXA', suivi: 'SA', numero: '1' }, txns: ['TXA'] },
  B: { subs: [{ endpoint: 'https://push/B1' }], bord: { dateLimite: limiteAuj, transaction: 'TXB', suivi: 'SB', numero: '2' }, txns: ['TXB'] },
};

const lus = [];            // toutes les URL GET vues
const ecrits = [];         // { id, owner } de chaque POST
const pushes = [];         // les envois vers un appareil (endpoint)
let enVol = 0, maxEnVol = 0;

// sonde : 200 (cloisonnée) · 503 (base qui hoquette) ; mainKO : vendeurs dont la
// ligne main ne répond pas ; vendeurs : la liste énumérée.
function poserFetch({ sonde = 200, mainKO = new Set(), vendeurs = ['A', 'B'] } = {}) {
  lus.length = 0; ecrits.length = 0; pushes.length = 0; enVol = 0; maxEnVol = 0;
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
    if (/^https:\/\/push\//.test(u)) { pushes.push(u); return new Response('', { status: 201 }); }
    if ((opts.method || 'GET') === 'POST') {
      try { JSON.parse(opts.body || '[]').forEach(r => ecrits.push({ id: r.id, owner: r.owner || null })); } catch (_) {}
      return new Response('', { status: 201 });
    }
    lus.push(u);
    // Sonde de cloisonnement (ship-reminders ET push.js) : la colonne existe.
    if (/select=owner&limit=1/.test(u)) return sonde === 200 ? J([{ owner: 'A' }]) : new Response('<html>503</html>', { status: sonde });
    // Énumération des vendeurs : un `main` par vendeur, sans filtre owner.
    if (/id=eq\.main/.test(u) && /select=owner/.test(u) && !/owner=eq\./.test(u)) return J(vendeurs.map(owner => ({ owner })));
    // À partir d'ici, tout doit être filtré par vendeur.
    const mo = u.match(/owner=eq\.([^&]+)/);
    const o = mo ? decodeURIComponent(mo[1]) : null;
    if (/id=like\.email_bord_/.test(u)) { enVol++; maxEnVol = Math.max(maxEnVol, enVol); await new Promise(r => setTimeout(r, 10)); enVol--; }
    if (/id=eq\.main/.test(u) && o && mainKO.has(o)) return new Response('<html>522</html>', { status: 522 });
    if (/id=eq\.main/.test(u)) return J([{ data: {} }]);
    if (/id=eq\.panel_bords_done/.test(u)) return J([{ data: {} }]);
    if (/id=eq\.ship_reminder_dedup/.test(u)) return J([{ data: {} }]);        // pas encore notifié
    if (/id=eq\.urssaf_reminder_dedup/.test(u)) return J([{ data: {} }]);
    if (/id=eq\.push_prefs/.test(u)) return J([{ data: { expedier: true } }]);
    const v = o && (V[o] || (/^V\d+$/.test(o) ? { subs: [{ endpoint: 'https://push/' + o }], bord: { dateLimite: limiteAuj, transaction: 'TX' + o }, txns: ['TX' + o] } : null));
    if (/id=eq\.push_subs/.test(u)) return J([{ data: { subs: v ? v.subs : [] } }]);
    if (/id=like\.email_bord_/.test(u)) return J(v ? [v.bord] : []);
    if (/orders_sold/.test(u)) return J(v ? [{ txns: v.txns }] : []);
    return J([]);
  };
}

(async () => {
  poserFetch();
  const mod = await import('file://' + path.join(RACINE, 'api', 'ship-reminders.js'));
  const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
  await mod.default({ method: 'GET', headers: {}, query: {} }, res);

  const bordsScopes = new Set(lus.filter(u => /id=like\.email_bord_/.test(u)).map(u => (u.match(/owner=eq\.([^&]+)/) || [])[1]).filter(Boolean));
  const bordsGlobal = lus.some(u => /id=like\.email_bord_/.test(u) && !/owner=eq\./.test(u));
  const subsScopes = new Set(lus.filter(u => /id=eq\.push_subs/.test(u)).map(u => (u.match(/owner=eq\.([^&]+)/) || [])[1]).filter(Boolean));
  const dedupOwners = new Set(ecrits.filter(e => e.id === 'ship_reminder_dedup').map(e => e.owner));

  // 1. Une passe PAR vendeur : bordereaux lus filtrés pour A ET pour B.
  dit(bordsScopes.has('A') && bordsScopes.has('B'),
    'bordereaux lus séparément pour chaque vendeur (owner=eq.A ET owner=eq.B)',
    'scopes=' + [...bordsScopes].join(','));

  // 2. JAMAIS une lecture globale (le défaut mono-vendeur).
  dit(!bordsGlobal,
    'aucune lecture globale de email_bord_* (sans filtre owner)',
    bordsGlobal ? 'une lecture a balayé TOUS les vendeurs' : '');

  // 3. Les appareils lus PAR vendeur → chacun ses notifications.
  dit(subsScopes.has('A') && subsScopes.has('B'),
    'push_subs lu par vendeur → le résumé de A ne part pas chez B',
    'scopes=' + [...subsScopes].join(','));

  // 4. Dédoublonnage écrit pour CHAQUE vendeur (clé (owner,id)).
  dit(dedupOwners.has('A') && dedupOwners.has('B'),
    'ship_reminder_dedup écrit pour chaque vendeur (pas un mémo partagé)',
    'owners=' + [...dedupOwners].join(','));

  // 5. Le bilan nomme deux vendeurs.
  dit(res.corps && res.corps.vendeurs === 2,
    'la réponse rend un bilan par vendeur', 'vendeurs=' + (res.corps && res.corps.vendeurs));

  const lancer = async () => { const r = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } }; await mod.default({ method: 'GET', headers: {}, query: {} }, r); return r; };
  // Sans clé VAPID le banc n'envoie rien pour de vrai : ce qui prouve qu'un
  // vendeur a été NOTIFIÉ est son mémo du jour (écrit après l'envoi) et la
  // lecture de SES appareils. Indépendant de la date (le rappel URSSAF du 1er
  // lit aussi les appareils, pas le mémo d'expédition).
  const notifie = (o) => ecrits.filter(e => e.id === 'ship_reminder_dedup' && e.owner === o).length;

  // 6. La sonde hoquette : PAS de passe globale (les vendeurs mélangés).
  poserFetch({ sonde: 503 });
  const r6 = await lancer();
  const global6 = lus.some(u => /id=like\.email_bord_/.test(u) && !/owner=eq\./.test(u));
  dit(!global6 && !ecrits.some(e => e.id === 'ship_reminder_dedup') && r6.code >= 500,
    'sonde de cloisonnement en panne ⇒ ni passe globale, ni notification, et l\'échec est visible',
    `code=${r6.code} global=${global6}`);

  // 7. La ligne main de A ne répond pas : A se tait (ses colis « postés » sont
  //    dedans), B reçoit quand même le sien.
  poserFetch({ mainKO: new Set(['A']) });
  await lancer();
  dit(notifie('A') === 0, 'réglages de A illisibles ⇒ A ne reçoit PAS un compte gonflé', `mémo A=${notifie('A')}`);
  dit(notifie('B') === 1, '… et B reçoit le sien quand même', `mémo B=${notifie('B')}`);

  // 8. À l'échelle : 24 vendeurs, traités en parallèle borné, aucun oublié.
  const vingt = Array.from({ length: 24 }, (_, i) => 'V' + i);
  poserFetch({ vendeurs: vingt });
  const r8 = await lancer();
  const servis = new Set(lus.filter(u => /id=like\.email_bord_/.test(u)).map(u => (u.match(/owner=eq\.([^&]+)/) || [])[1]));
  dit(r8.corps && r8.corps.vendeurs === 24 && servis.size === 24, '24 vendeurs : tous traités', `servis=${servis.size}`);
  dit(maxEnVol > 1 && maxEnVol <= 8, 'en parallèle, mais borné (8 au plus)', `max=${maxEnVol}`);
  const subs8 = new Set(lus.filter(u => /id=eq\.push_subs/.test(u)).map(u => (u.match(/owner=eq\.([^&]+)/) || [])[1]));
  dit(vingt.every(o => notifie(o) === 1) && vingt.every(o => subs8.has(o)), 'chacun reçoit exactement SON rappel, une fois, sur SES appareils', `${ecrits.filter(e => e.id === 'ship_reminder_dedup').length} mémos`);

  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTous les contrôles passent — chaque vendeur a son rappel, ses appareils, son mémo.');
  process.exit(ko ? 1 : 0);
})();
