// ════════════════════════════════════════════════════════════════════════════
//  « TOUT GÉNÉRER » NE CONTOURNE PAS LES GARDE-FOUS DU §3 (revue du 9 octobre)
//
//  On EXÉCUTE le vrai `background.js` dans un `vm` (banc commun `_fond-vm.cjs` :
//  base à état, Vinted factice qui COMPTE chaque requête) et on lui envoie les
//  commandes exactement comme l'app les envoie. Ce qui était mesuré sur e6bda5c :
//   · 20 colis, UN clic ⇒ 20 PUT chez Vinted et les 20 actions de l'heure ; une
//     réponse à un acheteur était ensuite refusée une heure ;
//   · la pause demandée par Vinted n'apparaissait pas dans l'état lu par l'app
//     (elle disait « Actions possibles » jusqu'au clic) ;
//   · une base lente retenait l'ACCUSÉ (lecture sans délai maximum) : l'app
//     abandonnait à 9 s et comptait « refusé » un bordereau généré ensuite ;
//   · un colis en file depuis plus de 120 s était RÉACCEPTÉ (second job, une
//     action brûlée de plus).
//  Chaque contrôle a son AUTRE SENS : « ne jamais rien accepter » passerait les
//  bornes — le cas normal doit aboutir, et un service worker redémarré ne doit
//  pas laisser un colis bloqué « en file » pour rien.
//  Et §11 : la borne d'un clic de l'app (`BORD_LOT_MAX`) est la même que celle
//  d'une visite (`BORD_MAX_PAR_VISITE`).
//  Aucune donnée réelle : tout est inventé (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const { faireFond } = require('./_fond-vm.cjs');

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
// Un audit ne meurt pas, il rapporte (§ CLAUDE.md, huit fois) : ce qui lève
// devient un contrôle rouge, et le bilan est toujours imprimé.
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
// Une réponse qui ne vient pas dans le délai vaut `'muet'` (comme l'app à 9 s).
const avant = (p, ms) => Promise.race([p, attendre(ms).then(() => 'muet')]);

const UID = '111';
const TX = (i) => String(22500000000 + i);
// Un faux Vinted : l'expédition existe après le PUT, l'URL du PDF est servie.
function vintedFaux(opts = {}) {
  const ship = {}; const j = { puts: 0, parTx: {} };
  const f = async (req) => {
    let m;
    const tx = (/transactions\/(\d+)/.exec(req.chemin) || [])[1];
    if (tx) j.parTx[tx] = (j.parTx[tx] || 0) + 1;
    if (opts.porte && tx === opts.porte.tx) await opts.porte.p;
    if ((m = /^\/api\/v2\/transactions\/(\d+)\/shipment\/order$/.exec(req.chemin)) && req.methode === 'PUT') { j.puts++; ship[m[1]] = true; return { status: 200, body: {} }; }
    if ((m = /^\/api\/v2\/transactions\/(\d+)$/.exec(req.chemin))) return { status: 200, body: { transaction: { id: +m[1], item_id: 555, shipment: ship[m[1]] ? { id: m[1] } : null } } };
    if (/\/shipments\/\d+\/label_url$/.test(req.chemin)) return { status: 200, body: { label_url: 'https://svc-shipping-labels.s3.eu-central-1.amazonaws.com/x.pdf' } };
    if (/\/conversations\/\d+\/replies$/.test(req.chemin)) return { status: 200, body: { ok: true } };
    return { status: 200, body: {} };
  };
  return { f, j };
}
function monter({ store = {}, vinted, lenteLabelMs = 0 } = {}) {
  const V = vinted || vintedFaux();
  const F = faireFond({ connecte: UID, store: Object.assign({ vrmAdresses: { [UID]: 123 } }, store), vinted: V.f });
  const f0 = F.ctx.fetch;
  F.ctx.fetch = async (u, o) => {
    const s = String(u);
    if (/amazonaws\.com/.test(s)) { const b = Buffer.from('%PDF-1.4\n%banc\n'); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; }
    // Notre base qui traîne sur « ce PDF est-il déjà rangé ? » (temps RÉEL,
    // hors du vm : c'est la base, pas l'extension).
    if (lenteLabelMs && /_label_/.test(decodeURIComponent(s)) && (!o || !o.method || o.method === 'GET')) await attendre(lenteLabelMs);
    return f0(u, o);
  };
  const cmd = (tx) => F.envoyer({ from: 'vmr-bridge', action: 'cmd', cmd: 'bordereau', uid: UID, tx });
  const finir = async (ids, max = 3000) => {
    for (let i = 0; i < max; i++) {
      const c = F.store.vrmCmds || {};
      if (ids.every((id) => c[id] && !['file', 'generation', 'pdf'].includes(c[id].etape))) return c;
      await attendre(5);
    }
    return F.store.vrmCmds || {};
  };
  return { F, V, cmd, finir };
}

(async () => {
  console.log('── UN CLIC « TOUT GÉNÉRER (8) » : la borne d\'une visite, pas 8 PUT');
  await essaie('lot', async () => {
    const H = monter();
    const reps = [];
    for (let i = 0; i < 8; i++) reps.push(await H.cmd(TX(i)));
    const acceptes = reps.filter((r) => r && r.accepte).length;
    const septieme = reps[6] || {};
    await H.finir(reps.filter((r) => r && r.accepte).map((r) => r.jobId));
    dit(acceptes === 6, 'au plus 6 bordereaux acceptés d\'affilée sur un compte (comme une visite, §3)', `${acceptes} acceptés`);
    dit(septieme.accepte === false && septieme.code === 'lot' && /\d+ min/.test(String(septieme.raison || '')),
      'le 7ᵉ est REFUSÉ avec sa raison et l\'heure de la suite (jamais en silence)', JSON.stringify(septieme));
    dit(H.V.j.puts <= 6, 'Vinted ne reçoit pas plus de 6 PUT pour ce clic', `${H.V.j.puts} PUT`);
    dit(acceptes > 0 && H.V.j.puts > 0, 'autre sens : les 6 premiers partent pour de vrai', `${H.V.j.puts} PUT`);
    dit(H.F.j.maxEnVol === 1, 'toujours une requête Vinted à la fois', `max ${H.F.j.maxEnVol}`);
  });

  console.log('── UNE RÉSERVE POUR LES GESTES SUR CLIC (répondre à un acheteur)');
  await essaie('réserve', async () => {
    const t = Date.now();
    // 15 actions déjà faites dans l'heure, toutes hors de la fenêtre de 5 min.
    const H = monter({ store: { vrmActions: { [UID]: Array.from({ length: 15 }, (_, i) => t - 20 * 60000 - i * 1000) } } });
    const r = await H.cmd(TX(50));
    dit(r && r.accepte === false && r.code === 'plafond-bordereaux' && /\d+ min/.test(String(r.raison || '')),
      'les bordereaux de l\'app s\'arrêtent à 15 actions sur 20 — refus dit, avec l\'heure', JSON.stringify(r));
    const rep = await H.F.envoyer({ from: 'vmr-bridge', action: 'exec', uid: UID, method: 'POST', endpoint: '/api/v2/conversations/123456/replies', body: { body: 'Bonjour' } });
    dit(rep && rep.ok === true, 'et une réponse à un acheteur PART encore (les 5 dernières actions lui sont gardées)', JSON.stringify(rep && { ok: rep.ok, code: rep.code, error: rep.error }));
  });
  await essaie('réserve, autre sens', async () => {
    const t = Date.now();
    const H = monter({ store: { vrmActions: { [UID]: Array.from({ length: 10 }, (_, i) => t - 20 * 60000 - i * 1000) } } });
    const r = await H.cmd(TX(51));
    dit(r && r.accepte === true, 'autre sens : à 10 actions dans l\'heure, un bordereau part', JSON.stringify(r));
  });

  console.log('── LA PAUSE DEMANDÉE PAR VINTED SE DIT AVANT LE CLIC');
  await essaie('pause', async () => {
    const jusqua = Date.now() + 14 * 60000;
    const H = monter({ store: { vrmPauseVinted: { jusqua, niveau: 1, statut: 429 } } });
    const e = await H.F.envoyer({ from: 'vmr-bridge', action: 'etat' });
    dit(e && e.pause && Math.abs(Number(e.pause.jusqua) - jusqua) < 5, 'l\'état lu par l\'app porte la pause (`pause.jusqua`)', JSON.stringify(e && Object.keys(e)));
    const r = await H.cmd(TX(60));
    dit(r && r.accepte === false && r.code === 'vinted-pause', 'et une commande pendant la pause est refusée « vinted-pause », sans requête', JSON.stringify(r));
    dit(H.F.j.vinted.length === 0, 'aucune requête chez Vinted pendant la pause', `${H.F.j.vinted.length}`);
    const H2 = monter();
    const e2 = await H2.F.envoyer({ from: 'vmr-bridge', action: 'etat' });
    dit(e2 && e2.ok && !e2.pause, 'autre sens : sans pause, l\'état n\'en invente pas', JSON.stringify(e2 && e2.pause));
  });

  console.log('── UNE BASE LENTE NE RETIENT PLUS L\'ACCUSÉ');
  await essaie('base lente', async () => {
    const H = monter({ lenteLabelMs: 12000 });
    const t0 = Date.now();
    const r = await avant(H.cmd(TX(70)), 6000);
    const ms = Date.now() - t0;
    dit(r !== 'muet' && r && r.accepte === true && ms < 4000, 'la lecture « PDF déjà rangé ? » qui traîne ne retient plus la réponse (l\'app attend 9 s)', `${r === 'muet' ? 'pas de réponse en 6 s' : JSON.stringify(r)} · ${ms} ms`);
  });
  await essaie('comptes illisibles', async () => {
    const H = monter();
    H.F.ctx.getStoredAccounts = () => new Promise(() => {});      // la base ne répond jamais
    const r = await avant(H.cmd(TX(71)), 6000);
    dit(r !== 'muet' && r && r.accepte === false && r.code === 'lecture' && H.F.j.vinted.length === 0,
      'liste des comptes illisible : refus « lecture » DIT, rien chez Vinted (jamais « compte introuvable »)', r === 'muet' ? 'pas de réponse en 6 s' : JSON.stringify(r));
  });

  console.log('── UN COLIS EN FILE N\'EST PAS RECOMMANDÉ, QUEL QUE SOIT SON ÂGE');
  await essaie('file longue', async () => {
    let ouvrir; const p = new Promise((r) => { ouvrir = r; });
    const V = vintedFaux({ porte: { tx: TX(80), p } });
    const H = monter({ vinted: V });
    const r0 = await H.cmd(TX(80));                    // il bloque la file (Vinted lent)
    const r1 = await H.cmd(TX(81));                    // attend son tour
    const avantN = (H.F.store.vrmActions[UID] || []).length;
    // Le temps passe : son accusé a plus de 2 min.
    H.F.store.vrmCmds[`bord:${UID}:${TX(81)}`].at = Date.now() - 125000;
    const r2 = await H.cmd(TX(81));
    const apresN = (H.F.store.vrmActions[UID] || []).length;
    const e = await H.F.envoyer({ from: 'vmr-bridge', action: 'etat' });
    const vu = e && e.cmds && e.cmds[`bord:${UID}:${TX(81)}`];
    ouvrir();
    await H.finir([r0.jobId, r1.jobId]);
    dit(r2 && r2.accepte === true && r2.deja === true && apresN === avantN, 'un 2ᵉ clic sur un colis encore en file : même demande, AUCUNE action brûlée', `${JSON.stringify(r2)} · actions ${avantN} → ${apresN}`);
    dit(vu && vu.vivant === true, 'l\'état dit qu\'il est réellement dans la file (`vivant`) : l\'app garde « En file… »', JSON.stringify(vu));
    dit((V.j.parTx[TX(81)] || 0) <= 6, 'et Vinted ne le voit traité qu\'une fois', `${V.j.parTx[TX(81)]} requêtes`);
  });
  await essaie('orphelin', async () => {
    // Un service worker redémarré : le stockage dit « file », la file est vide.
    const H = monter({ store: { vrmCmds: { [`bord:${UID}:${TX(90)}`]: { etape: 'file', uid: UID, tx: TX(90), at: Date.now() - 30000 } } } });
    const e = await H.F.envoyer({ from: 'vmr-bridge', action: 'etat' });
    const vu = e && e.cmds && e.cmds[`bord:${UID}:${TX(90)}`];
    dit(vu && !vu.vivant, 'une demande orpheline (plus dans la file) ne se dit pas « vivante »', JSON.stringify(vu));
    const r = await H.cmd(TX(90));
    await H.finir([`bord:${UID}:${TX(90)}`]);
    dit(r && r.accepte === true && !r.deja && H.V.j.puts === 1, 'autre sens : un nouveau clic la relance pour de vrai (pas de colis bloqué « en file » pour rien)', `${JSON.stringify(r)} · ${H.V.j.puts} PUT`);
  });

  console.log('── §11 : LA BORNE D\'UN CLIC DE L\'APP EST CELLE D\'UNE VISITE');
  await essaie('§11', async () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
    const bg = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
    const a = (/const BORD_LOT_MAX = (\d+);/.exec(app) || [])[1];
    const b = (/const BORD_MAX_PAR_VISITE = (\d+);/.exec(bg) || [])[1];
    dit(a && b && a === b, '« Tout générer » (app) ne lance pas plus qu\'une visite (extension)', `app ${a || 'absent'} · extension ${b || 'absent'}`);
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
