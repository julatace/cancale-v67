// ════════════════════════════════════════════════════════════════════════════
// LEBONCOIN — UNE ANNONCE DÉSACTIVÉE SORT DE « EN VENTE » (26 octobre)
//   node scripts/audit-lbc-desactivees.cjs [--src background.js]
// Julien : « quand les annonces sont désactivées sur Leboncoin, je veux que ça
// soit mis à jour ». Mesuré (lecture seule) : ses 11 annonces restaient
// `active`, et sa page « Mes annonces » charge `pintad/v1/public/expired`
// (la liste des désactivées / expirées), jamais exploitée.
// Le VRAI background.js (vm), identifiants INVENTÉS.
// ════════════════════════════════════════════════════════════════════════════
const { faireFond } = require('./_fond-vm.cjs');
let ko = 0; const dit = (c, m, d) => { console.log((c ? 'OK  ' : 'KO  ') + m + (c || !d ? '' : ' — ' + d)); if (!c) ko++; };
const MOI = 'aaaa1111-0000-4000-8000-000000000001', AUTRE = 'bbbb2222-0000-4000-8000-000000000002';
const base = () => ({
  lbc_accounts: { accounts: { [MOI]: { id: MOI, name: 'moi', sessionAt: new Date().toISOString() } } },
  lbc_listings: { items: {
    '1000000001': { id: '1000000001', subject: 'Paire A', status: 'active', account: MOI, seenAt: '2026-10-20T10:00:00Z' },
    '1000000002': { id: '1000000002', subject: 'Paire B', status: 'active', account: MOI, seenAt: '2026-10-20T10:00:00Z' },
    '1000000003': { id: '1000000003', subject: 'Chez un autre', status: 'active', account: AUTRE, seenAt: '2026-10-20T10:00:00Z' },
  } },
});
const URL_DESACT = 'https://api.leboncoin.fr/api/pintad/v1/public/expired';
(async () => {
  try {
    const f = faireFond({ lignes: base() });
    if (typeof f.ctx.handleLbcRaw !== 'function') { dit(false, 'handleLbcRaw est exécutable'); throw 0; }
    const corps = JSON.stringify({ ads: [{ list_id: 1000000001, subject: 'Paire A' }, { list_id: 1000000003 }, { list_id: 1000000099 }] });
    const r = await f.ctx.handleLbcRaw(URL_DESACT, corps, null, 'owner-banc');
    const it = (f.lignes.lbc_listings || {}).items || {};
    dit(it['1000000001'] && it['1000000001'].status === 'inactive', 'une de SES annonces listée désactivée passe « inactive »', JSON.stringify(it['1000000001']));
    dit(it['1000000002'] && it['1000000002'].status === 'active', 'une annonce absente de la liste ne bouge pas');
    dit(it['1000000003'] && it['1000000003'].status === 'active', 'une annonce d\'un AUTRE compte n\'est jamais touchée (§5)');
    dit(!it['1000000099'], 'une annonce inconnue n\'est pas créée');
    dit(r && r.etat === 'desactivees' && r.n === 1, 'la réponse dit combien', JSON.stringify(r));
    // L'autre sens : une capture « Mes annonces » plus récente qui la remontre active.
    const r2 = await f.ctx.handleLbcRaw('https://api.leboncoin.fr/api/adfinder/v2/myads', JSON.stringify({ ads: [{ list_id: 1000000001, subject: 'Paire A', price: [50], status: 'active', owner: { user_id: MOI } }] }), 'lbc-account:' + MOI, 'owner-banc');
    void r2;
    // Lecture ratée ⇒ rien n'est écrit.
    const g = faireFond({ lignes: base(), lectureKO: (u) => /lbc_listings/.test(u) });
    const avant = JSON.stringify(g.lignes.lbc_listings);
    await g.ctx.handleLbcRaw(URL_DESACT, corps, null, 'owner-banc');
    dit(JSON.stringify(g.lignes.lbc_listings) === avant, 'lecture ratée ⇒ rien n\'est réécrit');
    // Un statut « désactivée » dans « Mes annonces » est traduit aussi.
    dit(typeof f.ctx.statutLbcNormal === 'function' && f.ctx.statutLbcNormal('DISABLED') === 'inactive' && f.ctx.statutLbcNormal('expired') === 'inactive' && f.ctx.statutLbcNormal('active') === 'active', 'les statuts désactivée/expirée deviennent « inactive »');
  } catch (e) { if (e !== 0) dit(false, 'l\'audit a levé', String(e && e.stack || e).slice(0, 200)); }
  console.log(ko ? `\n❌ annonces Leboncoin désactivées : ${ko} rouge(s)` : '\n✅ annonces Leboncoin désactivées : tout est vert');
  process.exit(ko ? 1 : 0);
})();
