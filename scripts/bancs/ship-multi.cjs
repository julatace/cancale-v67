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

function poserFetch() {
  lus.length = 0; ecrits.length = 0;
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
    if ((opts.method || 'GET') === 'POST') {
      try { JSON.parse(opts.body || '[]').forEach(r => ecrits.push({ id: r.id, owner: r.owner || null })); } catch (_) {}
      return new Response('', { status: 201 });
    }
    lus.push(u);
    // Sonde de cloisonnement (ship-reminders ET push.js) : la colonne existe.
    if (/select=owner&limit=1/.test(u)) return J([{ owner: 'A' }]);
    // Énumération des vendeurs : un `main` par vendeur, sans filtre owner.
    if (/id=eq\.main/.test(u) && /select=owner/.test(u) && !/owner=eq\./.test(u)) return J([{ owner: 'A' }, { owner: 'B' }]);
    // À partir d'ici, tout doit être filtré par vendeur.
    const mo = u.match(/owner=eq\.([^&]+)/);
    const o = mo ? decodeURIComponent(mo[1]) : null;
    if (/id=eq\.main/.test(u)) return J([{ data: {} }]);
    if (/id=eq\.panel_bords_done/.test(u)) return J([{ data: {} }]);
    if (/id=eq\.ship_reminder_dedup/.test(u)) return J([{ data: {} }]);        // pas encore notifié
    if (/id=eq\.urssaf_reminder_dedup/.test(u)) return J([{ data: {} }]);
    if (/id=eq\.push_prefs/.test(u)) return J([{ data: { expedier: true } }]);
    if (/id=eq\.push_subs/.test(u)) return J([{ data: { subs: (o && V[o]) ? V[o].subs : [] } }]);
    if (/id=like\.email_bord_/.test(u)) return J((o && V[o]) ? [V[o].bord] : []);
    if (/orders_sold/.test(u)) return J((o && V[o]) ? [{ txns: V[o].txns }] : []);
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

  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTous les contrôles passent — chaque vendeur a son rappel, ses appareils, son mémo.');
  process.exit(ko ? 1 : 0);
})();
