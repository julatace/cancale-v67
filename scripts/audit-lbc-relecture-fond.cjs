// ════════════════════════════════════════════════════════════════════════════
// LEBONCOIN RELU SANS OUVRIR « MES ANNONCES » (26 octobre, 5.231)
//   node scripts/audit-lbc-relecture-fond.cjs [--src background.js]
// Julien : « je veux que la capture leboncoin se fasse sans que j'ai à ouvrir
// annonce ». L'extension ouvre elle-même la page, EN ARRIÈRE-PLAN, laisse la
// page lire, puis referme l'onglet. Le VRAI background.js (vm), données inventées.
// ════════════════════════════════════════════════════════════════════════════
const { faireFond } = require('./_fond-vm.cjs');
const srcI = process.argv.indexOf('--src'), src = srcI > 0 ? process.argv[srcI + 1] : undefined;
let ko = 0; const dit = (c, m, d) => { console.log((c ? 'OK  ' : 'KO  ') + m + (c || !d ? '' : ' — ' + d)); if (!c) ko++; };
const MOI = 'aaaa1111-0000-4000-8000-000000000001';
function monte({ session = true, compte = true, pageSession = true, pageListe = true, store = {} } = {}) {
  const f = faireFond({ src, lignes: {} });
  const ouverts = [], fermes = [];
  if (typeof f.ctx.relireLbcEnFond !== 'function') return { f, absent: true, ouverts, fermes };
  f.ctx.loadSession = async () => (session ? { access_token: 'jeton', user: { id: 'owner-banc' } } : null);
  Object.assign(f.store, store);
  if (compte) f.store.vrmLbcCompte = { v: 2, id: MOI, name: 'moi', at: Date.now() };
  f.ctx.chrome.tabs.create = async (o) => {
    ouverts.push(o); const id = 70 + ouverts.length;
    const carte = {};
    if (pageSession) carte.source = 'prive', carte.compte = 'lbc-account:' + MOI;
    if (pageListe) carte.receptions = { annonces: { etat: 'enregistre', nombre: 11, at: Date.now() + 5 } };
    carte.at = Date.now();
    f.store.vrmLbcTransport = { ...(f.store.vrmLbcTransport || {}), [id]: carte };
    return { id };
  };
  f.ctx.chrome.tabs.remove = async (id) => { fermes.push(id); };
  if (!pageSession) f.ctx.attendreSessionOnglet = async () => null;
  return { f, ouverts, fermes };
}
(async () => {
  try {
    let m = monte();
    if (m.absent) { dit(false, 'relireLbcEnFond existe'); throw 0; }
    const r = await m.f.ctx.relireLbcEnFond();
    dit(r && r.fait === true, 'la liste Leboncoin est relue sans geste', JSON.stringify(r));
    dit(m.ouverts.length === 1 && m.ouverts[0].active === false, 'UN onglet, en arrière-plan', JSON.stringify(m.ouverts));
    dit(/leboncoin\.fr\/compte\/part\/mes-annonces$/.test((m.ouverts[0] || {}).url || ''), 'la page « Mes annonces », rien d\'autre');
    dit(m.fermes.length === 1, 'l\'onglet est refermé');
    const r2 = await m.f.ctx.relireLbcEnFond();
    dit(r2 && r2.fait === false && m.ouverts.length === 1, 'pas deux fois en 6 h', JSON.stringify(r2));
    const plusTard = await m.f.ctx.relireLbcEnFond(Date.now() + 6.1 * 3600e3);
    dit(plusTard && m.ouverts.length === 2, '6 h plus tard, elle repart', JSON.stringify(plusTard));

    m = monte({ session: false });
    await m.f.ctx.relireLbcEnFond();
    dit(m.ouverts.length === 0, 'sans session VRM : rien n\'est ouvert');
    m = monte({ compte: false });
    await m.f.ctx.relireLbcEnFond();
    dit(m.ouverts.length === 0, 'aucun compte Leboncoin vu dans ce Chrome : rien n\'est ouvert');
    m = monte({ store: { vrmLbcTransport: { 5: { receptions: { annonces: { etat: 'enregistre', at: Date.now() - 3600e3 } }, at: Date.now() } } } });
    await m.f.ctx.relireLbcEnFond();
    dit(m.ouverts.length === 0, 'déjà lue par lui il y a 1 h : rien n\'est ouvert');
    m = monte({ pageSession: false });
    const r3 = await m.f.ctx.relireLbcEnFond();
    dit(r3 && r3.raison === 'session' && m.fermes.length === 1, 'déconnecté de Leboncoin : l\'onglet est refermé', JSON.stringify(r3));
    const r4 = await m.f.ctx.relireLbcEnFond(Date.now() + 7 * 3600e3);
    dit(m.ouverts.length === 1, 'puis 24 h de recul (pas une page toutes les 6 h)', JSON.stringify(r4));
    m = monte();
    m.f.ctx.PAUSE_LBC_EN_VOL = true;
    const p = m.f.ctx.relireLbcEnFond.toString();
    dit(/PAUSE_LBC_EN_VOL/.test(p), 'jamais pendant une mise en pause');
  } catch (e) { if (e !== 0) dit(false, 'exécution', e && e.stack); }
  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTout est vert'); process.exit(ko ? 1 : 0);
})();
