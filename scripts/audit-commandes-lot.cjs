// ════════════════════════════════════════════════════════════════════════════
//  « COMMANDER LES BORDEREAUX MANQUANTS » DEPUIS COMMANDES (21 nov., ext. 5.419, `commandeslot`)
//
//  On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs, base inventée) : `bordereauxCommanderCarte`
//   K1. sans SA confirmation : rien ; hors vinted.fr (leboncoin, eBay) : rien — jamais une étiquette ailleurs (§2.8) ;
//   K2. seules les ventes À EXPÉDIER de CE compte (par n° de transaction lu dans SA liste) partent, par la commande
//       d'après-vente de toujours (`executerCommande` · `bordereau`) ; une vente en route, une transaction inconnue,
//       une vente d'un autre compte, un bordereau déjà rangé : refusés et dits ;
//   K3. plus de 6 à la fois (la borne des bordereaux par 5 min) : refusé d'avance.
//  §6.1 : `--src <ancien background.js>` ⇒ rouge. `--prouve` : chaque mutation rend l'audit rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const iSrc = args.indexOf('--src');
const SRC0 = iSrc >= 0 ? path.resolve(args[iSrc + 1]) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const MUTATIONS = {
  etat: ["if (!aExp.has(tx)) { refus.push({ tx, raison: 'pas une vente à expédier de ce compte' }); continue; }", ''],
  pdf: ["if (avecPdf.has(tx)) { refus.push({ tx, raison: 'bordereau déjà rangé : imprime-le' }); continue; }", ''],
  confirme: ["if (msg.confirme !== true) return { ok: false, code: 'confirmation', raison: 'Rien n’est parti sans ta confirmation.' };", ''],
  site: ["if (!o || o.fenetre || plateformeDe(o.url) !== 'vinted') return { ok: false, code: 'origine', raison: 'Ouvre le panneau depuis l’onglet vinted.fr.' };\n  if (msg.confirme", "if (!o) return { ok: false };\n  if (msg.confirme"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 120000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  process.exit(rates ? 1 : 0);
}
let SRC = SRC0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) { const [a, b] = MUTATIONS[mut]; const s = fs.readFileSync(SRC0, 'utf8'); if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); } SRC = path.join(os.tmpdir(), `bg-cmd-lot-${mut}-${process.pid}.js`); fs.writeFileSync(SRC, s.split(a).join(b)); }
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 400) : ''}`); } };
const UID = '111';
const ventes = [
  { transaction_id: 91000000000, status: 'Envoie le colis avant le 23 nov.', transaction_user_status: 'needs_action', title: 'A' },
  { transaction_id: 91000000001, status: 'Envoie le colis avant le 23 nov.', transaction_user_status: 'needs_action', title: 'B' },
  { transaction_id: 91000000002, status: 'Commande expédiée et en cours d\'acheminement !', transaction_user_status: 'waiting', title: 'C' },
];
function monter() {
  const lignes = { [`harvest_${UID}_orders_sold`]: { capturedAt: new Date().toISOString(), nItems: 3, payload: { my_orders: ventes } }, [`harvest_${UID}_label_91000000001`]: { tx: '91000000001', pdfB64: 'JVBERi0x' } };
  const f = faireFond({ src: SRC, connecte: UID, lignes });
  const appels = [];
  f.ctx.executerCommande = async (m) => { appels.push(m); return { accepte: true, jobId: 'bord:' + m.uid + ':' + m.tx, etape: 'file' }; };
  return { f, appels };
}
const vinted = { tab: { id: 7, url: 'https://www.vinted.fr/member/111' } };
(async () => {
  console.log('\nK1. Sa confirmation, et Vinted seulement');
  {
    const { f, appels } = monter();
    if (typeof f.ctx.bordereauxCommanderCarte !== 'function') { dit(false, 'bordereauxCommanderCarte existe'); console.log(`\n❌ ${ok} vert(s), ${ko} rouge(s)`); process.exit(1); }
    const r0 = await f.ctx.bordereauxCommanderCarte({ txs: ['91000000000'] }, vinted);
    dit(r0 && !r0.ok && appels.length === 0, 'sans `confirme` : rien ne part', JSON.stringify(r0));
    const r1 = await f.ctx.bordereauxCommanderCarte({ txs: ['91000000000'], confirme: true }, { tab: { id: 8, url: 'https://www.leboncoin.fr/compte' } });
    const r2 = await f.ctx.bordereauxCommanderCarte({ txs: ['91000000000'], confirme: true }, { tab: { id: 9, url: 'https://www.ebay.fr/sh/ord' } });
    dit(r1 && !r1.ok && r2 && !r2.ok && appels.length === 0, 'Leboncoin, eBay : rien (jamais une étiquette ailleurs que Vinted)', JSON.stringify([r1, r2]));
  }
  console.log('\nK2. Seules les ventes à expédier de CE compte, sans bordereau rangé');
  {
    const { f, appels } = monter();
    const r = await f.ctx.bordereauxCommanderCarte({ txs: ['91000000000', '91000000001', '91000000002', '99999999999'], confirme: true }, vinted);
    dit(r && r.ok && appels.length === 1 && appels[0].cmd === 'bordereau' && appels[0].uid === UID && appels[0].tx === '91000000000', 'une seule commande part : la vente à expédier sans bordereau, par `executerCommande · bordereau`', JSON.stringify(appels));
    const raisons = Object.fromEntries((r.refus || []).map((x) => [x.tx, x.raison]));
    dit(/déjà rangé/.test(raisons['91000000001'] || '') && /pas une vente à expédier/.test(raisons['91000000002'] || '') && /pas une vente à expédier/.test(raisons['99999999999'] || ''), 'refusés et dits : déjà rangé, en route, inconnue', JSON.stringify(raisons));
  }
  console.log('\nK3. Au plus 6 à la fois');
  {
    const { f, appels } = monter();
    const r = await f.ctx.bordereauxCommanderCarte({ txs: Array.from({ length: 7 }, (_, i) => String(91000000100 + i)), confirme: true }, vinted);
    dit(r && !r.ok && appels.length === 0, '7 demandés : refusé d’avance, rien ne part', JSON.stringify(r));
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-commandes-lot : ${ok} vert(s), ${ko} rouge(s)`);
  if (mut) try { fs.unlinkSync(SRC); } catch (_) {}
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); process.exit(1); });
