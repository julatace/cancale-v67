// ════════════════════════════════════════════════════════════════════════════
//  « Les suivis de colis sans l'image du QR des colis retirés »
//  (src/suivisSansQr.js, 8 nov., démarrage) — la VRAIE règle EXÉCUTÉE contre le
//  mini-PostgREST des bancs (`_base-volume.cjs` : `meta` calculée comme
//  `public.vrm_meta`, filtres `data->>`, `or=`, `neq` à la SQL, pages de 1 000).
//   1. chaque ligne lue = la ligne d'avant (`select=id,data`), aux seules
//      différences permises : l'image du QR d'un colis RETIRÉ (remplacée par
//      `qrOmis`) et un champ rangé à `null` (absent, comme dans `meta`) ;
//   2. un colis en jeu (disponible, en route, état NULL) garde son QR identique ;
//   3. aucune image de QR d'un colis retiré ne passe sur le réseau ;
//   4. une ligne sans `meta` est relue ENTIÈRE ; une ligne rangée « retiré » que
//      la relecture remet en jeu a son QR relu ;
//   5. une lecture ratée (A, B, C, D ou E) = `null` pour tout le suivi ;
//   6. plus de 1 000 lignes : rien de perdu (pages) ;
//   7. câblage : `fetchEmailTrackingBrut` lit par `lireSuivisSansQr` (plus de
//      `email_track_*&select=id,data` à l'ouverture) ; la vue en grand relit le QR
//      d'un colis retiré (`lireQrDeLigne`).
//  `--prouve` : mutations ⇒ ROUGE exigé.
//  Lancer : node scripts/audit-suivis-sans-qr.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const SRC = path.join(__dirname, '..', 'src', 'suivisSansQr.js');
const APP = path.join(__dirname, '..', 'src', 'App.jsx');
const { repondre } = require('./bancs/_base-volume.cjs');

async function charger(texte) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-'));
  const f = path.join(dir, 'sq.mjs');
  fs.writeFileSync(f, texte);
  return import(pathToFileURL(f).href);
}
// Une image par ligne, sans motif commun (une suite cyclique se retrouvait d'une ligne à l'autre).
const image = (i) => Buffer.concat(Array.from({ length: 47 }, (_, k) => require('crypto').createHash('sha256').update(`${i}:${k}`).digest())).toString('base64');
function lignes(n = 40) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const st = ['available', 'delivered', 'transit', 'delivered', 'retour', null][i % 6];   // NULL sur une ligne qui a un QR (impaire)
    const d = { type: 'suivi', carrier: i % 2 ? 'chronopost' : 'mondialrelay', suivi: `XW${1000 + i}FR`, status: st, statusLabel: st ? 'x' : null,
      subject: `Votre colis XW${1000 + i}FR`, receivedAt: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00.000Z`, code: i % 3 ? String(200000 + i) : null,
      lieu: 'Relais\n1 rue A\n35000 Rennes', consigne: i % 4 === 0, n: i, qrUrl: null };
    if (i % 2) { d.qrB64 = image(i); d.qrType = 'image/png'; }
    if (i % 5 === 0) d.recuSur = ['a@b.fr'];
    if (i % 7 === 0) d.sms = { at: '2026-10-01T00:00:00.000Z', forme: 'disponible' };
    if (i % 9 === 0) d.extraitLieu = 'é'.repeat(590);          // ≤ 600 caractères, > 600 octets en JSON
    rows.push({ id: `email_track_${d.carrier}_XW${1000 + i}FR`, data: d });
  }
  return rows;
}
// Le faux PostgREST : la forme réelle ; `panne` = motif d'URL qui répond 503 ; `sansMeta` = ids sans colonne meta.
function base(rows, { panne = null, sansMeta = new Set() } = {}) {
  const servi = [];
  const repondreQ = (q, range) => {
    if (panne && panne.test(decodeURIComponent(q))) { servi.push({ q, corps: '' }); return null; }
    const vue = rows.map((r) => (sansMeta.has(r.id) ? { ...r, data: r.data, _sansMeta: true } : r));
    const rep = repondre('https://b/rest/v1/app_data?' + q, range, { rows: vue, main: [], accounts: [] });
    let body = rep.body;
    if (Array.isArray(body) && sansMeta.size) body = body.map((x) => (x && sansMeta.has(x.id) && 'meta' in x ? { ...x, meta: null } : x));
    servi.push({ q, corps: JSON.stringify(body) });
    return { body, headers: rep.headers };
  };
  const lire = async (q) => { const r = repondreQ(q, null); return r && Array.isArray(r.body) ? r.body : null; };
  const lireTout = async (q) => {
    const out = [];
    for (let p = 0; p < 20; p++) {
      const r = repondreQ(q, `${p * 1000}-${p * 1000 + 999}`);
      if (!r || !Array.isArray(r.body)) return null;
      out.push(...r.body);
      if (r.body.length < 1000) return out;
    }
    return null;
  };
  return { lire, lireTout, servi };
}
const sansNull = (d) => Object.fromEntries(Object.entries(d).filter(([, v]) => v !== null && v !== undefined));
const egal = (a, b) => JSON.stringify(Object.keys(a).sort().map((k) => [k, a[k]])) === JSON.stringify(Object.keys(b).sort().map((k) => [k, b[k]]));

async function verifier(mod) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (!process.env.SILENCE) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null ? ' — ' + d : '')); };
  const besoinQr = (d) => d.status !== 'delivered';
  const rows = lignes(40);

  let b = base(rows);
  let r = await mod.lireSuivisSansQr({ lireTout: b.lireTout, lire: b.lire, besoinQr });
  dit(Array.isArray(r) && r.length === rows.length, '1. toutes les lignes lues', r && r.length);
  const parId = new Map((r || []).map((x) => [x.id, x.data]));
  let ecarts = 0, qrGardes = 0, qrOmis = 0;
  for (const row of rows) {
    const n = parId.get(row.id); if (!n) { ecarts++; continue; }
    const attendu = sansNull({ ...row.data });
    if (row.data.qrB64 && row.data.status === 'delivered') { delete attendu.qrB64; delete attendu.qrType; attendu.qrType = row.data.qrType; attendu.qrOmis = true; qrOmis++; }
    else if (row.data.qrB64) qrGardes++;
    if (!egal(sansNull(n), attendu)) { ecarts++; if (!process.env.SILENCE && ecarts < 3) console.log('     ', row.id, JSON.stringify(n).slice(0, 200), '≠', JSON.stringify(attendu).slice(0, 200)); }
  }
  dit(ecarts === 0, '1. chaque ligne = la ligne d\'avant (sauf le QR d\'un colis retiré, les champs null)', `${ecarts} écart(s)`);
  dit(qrGardes > 0 && rows.filter((x) => x.data.qrB64 && x.data.status !== 'delivered').every((x) => parId.get(x.id) && parId.get(x.id).qrB64 === x.data.qrB64), '2. colis en jeu (disponible, en route, état NULL, retour) : QR identique', `${qrGardes} QR`);
  const retiresQr = rows.filter((x) => x.data.qrB64 && x.data.status === 'delivered');
  const fuite = b.servi.filter((s) => retiresQr.some((x) => s.corps.includes(x.data.qrB64.slice(0, 200)))).length;
  dit(fuite === 0 && qrOmis > 0, '3. aucune image de QR d\'un colis retiré sur le réseau', `${fuite} réponse(s) en portent`);
  const avant = Buffer.byteLength(JSON.stringify(rows.map((x) => ({ id: x.id, data: x.data }))));
  const apres = b.servi.reduce((a, s) => a + Buffer.byteLength(s.corps), 0);
  dit(apres < avant, '3. moins d\'octets qu\'avant', `${avant} → ${apres}`);
  dit(b.servi.length === 3, '3. trois lectures (parallèles), sans relecture', b.servi.length);

  // 4. sans meta ⇒ relue entière ; retiré remis en jeu ⇒ QR relu.
  const sm = new Set([rows[1].id, rows[3].id]);
  b = base(rows, { sansMeta: sm });
  r = await mod.lireSuivisSansQr({ lireTout: b.lireTout, lire: b.lire, besoinQr });
  const p2 = new Map((r || []).map((x) => [x.id, x.data]));
  dit(Array.isArray(r) && r.length === rows.length && p2.get(rows[3].id) && p2.get(rows[3].id).qrB64 === rows[3].data.qrB64 && egal(p2.get(rows[1].id), rows[1].data), '4. une ligne sans `meta` : relue entière (QR compris)');
  b = base(rows);
  r = await mod.lireSuivisSansQr({ lireTout: b.lireTout, lire: b.lire, besoinQr: (d) => d.suivi === rows[3].data.suivi || d.status !== 'delivered' });
  const p3 = new Map((r || []).map((x) => [x.id, x.data]));
  dit(p3.get(rows[3].id) && p3.get(rows[3].id).qrB64 === rows[3].data.qrB64 && !p3.get(rows[3].id).qrOmis && p3.get(rows[1].id) && p3.get(rows[1].id).qrOmis, '4. rangée « retiré », remise en jeu par la relecture : son QR est relu');

  // 5. pannes.
  for (const [nom, re, bq] of [['A (suivis)', /select=id,meta/], ['B (QR utiles)', /neq\.delivered/], ['C (retirés)', /status=eq\.delivered&select=id/], ['E (sans meta)', /select=id,data/, 'sm'], ['D (QR relu)', /id=in\..*qrB64:data/, 'd']]) {
    b = base(rows, { panne: re, sansMeta: bq === 'sm' ? sm : new Set() });
    r = await mod.lireSuivisSansQr({ lireTout: b.lireTout, lire: b.lire, besoinQr: bq === 'd' ? () => true : besoinQr });
    dit(r === null, `5. lecture ${nom} ratée ⇒ null (pas su)`, String(r && r.length));
  }
  // 6. plus de 1 000 lignes.
  const beaucoup = lignes(1205);
  b = base(beaucoup);
  r = await mod.lireSuivisSansQr({ lireTout: b.lireTout, lire: b.lire, besoinQr });
  dit(Array.isArray(r) && r.length === 1205 && new Set(r.map((x) => x.id)).size === 1205, '6. 1 205 lignes : aucune perdue', r && r.length);

  const q = await mod.lireQrDeLigne(base(rows).lire, rows[1].id);
  dit(q && q.qrB64 === rows[1].data.qrB64, 'la vue en grand relit le QR d\'UNE ligne');

  const app = fs.readFileSync(APP, 'utf8').replace(/\/\/[^\n]*/g, '');
  const brut = /const fetchEmailTrackingBrut = async[\s\S]*?\n\};/.exec(app);
  dit(!!brut && /await lireSuivisSansQr\(\{/.test(brut[0]) && !/email_track_\*&select=id,data/.test(brut[0]) && /if \(!Array\.isArray\(rows\)\) return null;/.test(brut[0]), '7. App.jsx : fetchEmailTrackingBrut lit sans le QR ; pas su ⇒ null');
  dit(!!brut && /besoinQr: \(d\) => \{ const x = reclassifyTrack\(d\); return !!x && x\.status !== 'delivered'; \}/.test(brut[0]), '7. App.jsx : le besoin du QR se juge sur la ligne RELUE (relireLigneSuivi)');
  dit(/if \(t\.qrOmis && t\._ligne\) \{\s*const q = await lireQrDeLigne\(/.test(app), '7. App.jsx : la vue en grand relit le QR d\'un colis retiré');
  return ko;
}

(async () => {
  const texte = fs.readFileSync(SRC, 'utf8');
  const ko = await verifier(await charger(texte));
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ audit-suivis-sans-qr : vert');
  if (!process.argv.includes('--prouve') || ko) process.exit(ko ? 1 : 0);
  const mutations = [
    ['tous les QR lus (sans filtre d\'état)', texte.replace('&or=(data->>status.is.null,data->>status.neq.delivered)&select=id,qrB64', '&select=id,qrB64')],
    ['`neq` seul (état NULL perdu)', texte.replace('&or=(data->>status.is.null,data->>status.neq.delivered)', '&data->>status=neq.delivered')],
    ['panne = liste vide', texte.replace("if (!Array.isArray(a) || !Array.isArray(b) || !Array.isArray(c)) return null;", "if (!Array.isArray(a)) return [];")],
    ['sans meta : ligne oubliée', texte.replace('if (!d) { sansMeta.push(r.id); continue; }', 'if (!d) continue;')],
    ['retiré remis en jeu : QR pas relu', texte.replace('const aRelire = lignes.filter(', 'const aRelire = [].filter(')],
    ['`recuSur` oublié', texte.replace("['recuSur', 'sms', 'extraitLieu', 'extraitCode', 'horaires']", "['sms', 'extraitLieu', 'extraitCode', 'horaires']")],
    ['extraits longs oubliés', texte.replace("['recuSur', 'sms', 'extraitLieu', 'extraitCode', 'horaires']", "['recuSur', 'sms', 'horaires']")],
    ['E ratée ignorée', texte.replace("const e = await parIds(lire, sansMeta, 'id,data');\n    if (!Array.isArray(e)) return null;", "const e = (await parIds(lire, sansMeta, 'id,data')) || [];")],
    ['D ratée ignorée', texte.replace("const d = await parIds(lire, aRelire, 'id,qrB64:data->>qrB64,qrType:data->>qrType');\n    if (!Array.isArray(d)) return null;", "const d = (await parIds(lire, aRelire, 'id,qrB64:data->>qrB64,qrType:data->>qrType')) || [];")],
  ];
  let verts = 0;
  for (const [nom, m] of mutations) {
    if (m === texte) { console.log('  ⚠️ mutation sans effet : ' + nom); verts++; continue; }
    process.env.SILENCE = '1';
    const k = await verifier(await charger(m)).catch(() => 1);
    delete process.env.SILENCE;
    console.log((k ? '  🔴 ' : '  🟢 ') + 'mutation « ' + nom + ' » ' + (k ? `rouge (${k})` : 'VERTE — non vue'));
    if (!k) verts++;
  }
  console.log(verts ? `\n❌ ${verts} mutation(s) non vue(s)` : `\n✅ ${mutations.length}/${mutations.length} mutations rouges`);
  process.exit(verts ? 1 : 0);
})();
