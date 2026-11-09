// ════════════════════════════════════════════════════════════════════════════
//  LE VÉRIFICATEUR DE RESTAURATION, ESSAYÉ SUR DEUX FAUX POSTGREST (9 nov.)
//  scripts/sauvegarde/verifier-restauration.mjs est lancé (processus à part,
//  comme Julien le lancera) contre deux bases INVENTÉES servies en HTTP local
//  (scripts/charge/_faux-postgrest.cjs, 3 vendeurs au poids de sa base) :
//   V1. copie identique ⇒ code 0, « Identiques » ;
//   V2. une ligne perdue dans la copie ⇒ code 1, le vendeur et la famille nommés ;
//   V3. un numéro de rangement changé dans `main` ⇒ code 1, « NUMÉROS » signalé ;
//   V4. un vendeur absent de la copie ⇒ code 1 ;
//   V5. une base qui ne répond pas (page en 500) ⇒ code 2 « pas su », jamais « identiques » ;
//   V6. LECTURE SEULE : aucune requête autre que GET n'arrive aux deux bases ;
//   V7. AUCUN CONTENU affiché : ni pseudo, ni titre, ni clé, ni identifiant complet ;
//   V8. même URL pour SOURCE et COPIE ⇒ refusé (code 2).
//  `--prouve` : chaque mutation du vérificateur rougit.
//  Lancer : node scripts/audit-sauvegarde-verifier.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { spawn } = require('child_process');
const SCRIPT = process.env.VERIF_SCRIPT || path.join(__dirname, 'sauvegarde', 'verifier-restauration.mjs');

const MUTATIONS = {
  'numéros pas comparés': ["if (s.numeros !== c.numeros) ecarts.push", "if (false) ecarts.push"],
  'familles pas comparées': ["if (s.ids !== c.ids) {", "if (false) {"],
  'page ratée prise pour vide': ["if (!r.ok) throw new PasSu", "if (!r.ok) return { lignes: [], plage: '' }; if (false) throw new PasSu"],
  'vendeur absent ignoré': ["if (!s || !c) { ecarts.push(", "if (!s || !c) { continue; ecarts.push("],
  'contenu affiché': ["const court = (o) => String(o || '∅').slice(0, 8);", "const court = (o) => String(o || '∅');"],
};
if (process.argv.includes('--prouve')) {
  let attrapees = 0;
  for (const [nom, [de, vers]] of Object.entries(MUTATIONS)) {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    if (!src.includes(de)) { console.log(`❌ mutation ${nom} : ancre introuvable`); continue; }
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-mut-'));
    const f = path.join(d, 'v.mjs'); fs.writeFileSync(f, src.replace(de, vers));
    const r = require('child_process').spawnSync(process.execPath, [__filename], { env: { ...process.env, VERIF_SCRIPT: f }, encoding: 'utf8', timeout: 600000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0; if (ok) attrapees++;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${ok ? rouges + ' rouge(s)' : 'VERTE'}`);
    fs.rmSync(d, { recursive: true, force: true });
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(attrapees === n ? `\n✅ ${n}/${n} mutations attrapées` : `\n❌ ${n - attrapees} mutation(s) non attrapée(s)`);
  process.exit(attrapees === n ? 0 : 1);
}

const { creerBase } = require('./charge/_faux-postgrest.cjs');
let ko = 0, ok = 0;
const vrai = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? ' — ' + String(d).slice(0, 400) : '')); } };
const lancer = (S, C, extra = {}) => new Promise((fin) => {
  const p = spawn(process.execPath, [SCRIPT], { env: { PATH: process.env.PATH, SOURCE_URL: S.url, SOURCE_CLE: S.cleService, COPIE_URL: C.url, COPIE_CLE: C.cleService, ...extra } });
  let out = ''; p.stdout.on('data', (x) => { out += x; }); p.stderr.on('data', (x) => { out += x; });
  p.on('close', (code) => fin({ code, out }));
});

(async () => {
  const S = creerBase({ vendeurs: 3 }), C = creerBase({ vendeurs: 3 });
  await S.ecouter(); await C.ecouter();
  const ecritures = () => S.compteurs.ecritures + C.compteurs.ecritures;

  const r1 = await lancer(S, C);
  vrai(r1.code === 0 && /Identiques/.test(r1.out), 'V1 copie identique ⇒ code 0, « Identiques »', r1.out);
  // V7 : aucun contenu (pseudo, titre, clé, identifiant complet de vendeur)
  vrai(!/vendeur_\d|Nike|Adidas|samba|cle-service|c4a6-4e00/.test(r1.out), 'V7 rien de lisible : ni pseudo, ni titre, ni clé, ni identifiant complet', r1.out);

  // V2 : une ligne perdue
  const o1 = C.owners[1];
  const perdue = C.lignes(o1).find((r) => /_orders_sold$/.test(r.id)).id;
  await C.repondre({ url: `/rest/v1/app_data?owner=eq.${o1}&id=eq.${perdue}`, method: 'DELETE', headers: { apikey: C.cleService } });
  const r2 = await lancer(S, C);
  vrai(r2.code === 1 && new RegExp(o1.slice(0, 8) + ' · lignes harvest_N_orders_sold : (\\d+) / (\\d+)').test(r2.out) && (([, a, b]) => +a === +b + 1)(new RegExp(o1.slice(0, 8) + ' · lignes harvest_N_orders_sold : (\\d+) / (\\d+)').exec(r2.out)), 'V2 une ligne perdue ⇒ code 1, vendeur et famille nommés', r2.out);

  // V3 : un numéro changé dans `main` (copie neuve)
  const C3 = creerBase({ vendeurs: 3 }); await C3.ecouter();
  const o2 = C3.owners[2];
  const main = JSON.parse(JSON.stringify(C3.ligne(o2, 'main').data));
  const k = Object.keys(main.vinted_annonce_numeros)[0]; main.vinted_annonce_numeros[k].num = '999';
  C3.poser(o2, 'main', main);
  const r3 = await lancer(S, C3);
  vrai(r3.code === 1 && /NUMÉROS/.test(r3.out) && r3.out.includes(o2.slice(0, 8)), 'V3 un numéro de rangement changé ⇒ code 1, « NUMÉROS » signalé pour CE vendeur', r3.out);

  // V4 : un vendeur absent
  const C4 = creerBase({ vendeurs: 2 }); await C4.ecouter();
  const r4 = await lancer(S, C4);
  vrai(r4.code === 1 && /absent de la copie/.test(r4.out), 'V4 un vendeur absent de la copie ⇒ code 1', r4.out);

  // V5 : base qui ne répond pas
  const r5 = await lancer(S, { url: 'http://127.0.0.1:9', cleService: 'x' });
  vrai(r5.code === 2 && /Pas su/.test(r5.out) && !/Identiques/.test(r5.out), 'V5 une base injoignable ⇒ code 2 « pas su »', r5.out);
  const http = require('http');
  const panne = http.createServer((q, s) => { s.writeHead(q.url.includes('vinted_accounts') ? 200 : 500, { 'content-type': 'application/json', 'content-range': '*/0' }); s.end(q.url.includes('vinted_accounts') ? '[]' : '{}'); });
  await new Promise((f) => panne.listen(0, '127.0.0.1', f));
  const r5b = await lancer(S, { url: `http://127.0.0.1:${panne.address().port}`, cleService: 'x' });
  vrai(r5b.code === 2 && /HTTP 500/.test(r5b.out), 'V5 une page en erreur 500 ⇒ code 2, jamais une liste vide prise pour vraie', r5b.out);

  // V6 : lecture seule
  vrai(S.compteurs.ecritures === 0 && C3.compteurs.ecritures === 0 && C4.compteurs.ecritures === 0 && C.compteurs.ecritures === 1 /* le DELETE du banc */, `V6 aucune écriture n'est arrivée aux bases (${ecritures()} dont 1 posée par le banc lui-même)`);

  // V8 : même base des deux côtés
  const r8 = await lancer(S, S);
  vrai(r8.code === 2 && /même base/.test(r8.out), 'V8 SOURCE = COPIE ⇒ refusé', r8.out);

  for (const b of [S, C, C3, C4]) await b.fermer(); panne.close();
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + (e && e.stack || e)); process.exit(1); });
