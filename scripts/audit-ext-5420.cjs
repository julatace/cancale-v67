// ════════════════════════════════════════════════════════════════════════════
//  EXTENSION 5.420.0 (21 nov.) — le VRAI background.js (scripts/_fond-vm.cjs, base inventée) et le VRAI vrm-pdf.js +
//  pdf-lib.min.js du paquet (un faux monde isolé de l'onglet) :
//   P. « Imprimer N bordereaux » en UN PDF (`bordereauxUnPdf`) : les fichiers de la bibliothèque injectés dans CET onglet ;
//      le fichier unique porte une page par bordereau, dans l'ORDRE de la sélection ; une commande sans bordereau, un
//      PDF abîmé, un e-mail d'un autre compte n'y entrent jamais ; hors vinted.fr : rien ;
//   V. le mode vacances (`vacancesCarte`) : SA confirmation exigée, l'onglet vinted.fr seul, déjà dans l'état ⇒ rien ;
//      sinon UN geste par l'interface (`vacances`, la page apprise de SON geste), la garde stricte, journal sur « vu » ;
//   R. la 1re réponse d'un favori (`noterReponsesFavori`) : par identité (conversation ET acheteur), APRÈS l'envoi, jamais
//      réécrite, notre offre acceptée, l'offre de l'acheteur, « relu » ; la ligne publiée ne porte aucun texte ;
//   S. la santé (`santeCompte`, `santeComptes`) : Pause / Attention / Bon par la règle, « pas su » jamais « Bon ».
//  §6.1 : `--src <ancien background.js>` ⇒ rouge. `--prouve` : chaque mutation rend l'audit rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { execFileSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const R = path.join(__dirname, '..'), EXT = path.join(R, 'vinted-sync-extension');
const args = process.argv.slice(2);
const iSrc = args.indexOf('--src');
const SRC0 = iSrc >= 0 ? path.resolve(args[iSrc + 1]) : path.join(EXT, 'background.js');
const MUTATIONS = {
  pdfOrdre: ["for (const x of Array.isArray(liste) ? liste : []) {", "for (const x of (Array.isArray(liste) ? liste : []).slice().reverse()) {", 'vrm-pdf.js'],
  pdfAbime: ["if (n < 1 || n > PAGES_MAX) { illisibles.push(tx); continue; }", "if (n > 999) { illisibles.push(tx); continue; }", 'vrm-pdf.js'],
  pdfSite: ["  const r = await bordereauCarte(msg, sender);\n  if (!r || !r.ok) return r || { ok: false, code: 'erreur' };", "  const r = await bordereauCarte(msg, { tab: { id: 7, url: 'https://www.vinted.fr/' } });\n  if (!r || !r.ok) return r || { ok: false, code: 'erreur' };"],
  vacConfirme: ["  if (msg.confirme !== true) return { ok: false, code: 'confirmation', raison: 'Rien n’est parti : confirme d’abord.' };\n  if (typeof msg.vacances !== 'boolean')", "  if (typeof msg.vacances !== 'boolean')"],
  vacDeja: ["  if (lu === voulu) return { ok: true, deja: true, uid: u, vacances: lu };", ''],
  vacVu: ["  if (r.vu !== true) return { ok: false, code: 'pas-vu',", "  if (false) return { ok: false, code: 'pas-vu',"],
  repIdentite: ["  if (envoi.a && String(envoi.a) !== opp) return null;", ''],
  repApres: ["&& ts > t0 && (r == null || ts < r)) r = ts;", "&& (r == null || ts < r)) r = ts;"],
  repPremiere: ["      if (x.r != null && e.r == null) { e.r = x.r;", "      if (x.r != null) { e.r = x.r;"],
  santePause: ["  if (pauseJ) return sortie('pause', 'pause_vinted', 'attendre', { jusqua: pauseJ });", ''],
  santePassu: ["  if (h == null || maxH == null) return sortie('passu', 'passu', '');", "  if (h == null || maxH == null) return sortie('bon', 'bon', '');"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 180000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  process.exit(rates ? 1 : 0);
}
let SRC = SRC0, PDFJS = path.join(EXT, 'vrm-pdf.js');
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b, f] = MUTATIONS[mut]; const fic = f ? PDFJS : SRC0; const s = fs.readFileSync(fic, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  const sortie = path.join(os.tmpdir(), `ext5420-${mut}-${process.pid}-${path.basename(fic)}`); fs.writeFileSync(sortie, s.replace(a, b));
  if (f) PDFJS = sortie; else SRC = sortie;
}
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 400) : ''}`); } };
const UID = '111';
const vinted = { tab: { id: 7, url: 'https://www.vinted.fr/member/111' }, frameId: 0 };
(async () => {
  // ── P ──────────────────────────────────────────────────────────────────────
  console.log('\nP. Bordereaux en un seul PDF');
  {
    const PDFLib = require(path.join(R, 'node_modules', 'pdf-lib'));
    const fabrique = async (texte, n = 1) => { const d = await PDFLib.PDFDocument.create(); for (let i = 0; i < n; i++) { const p = d.addPage([288, 432]); p.drawText(texte + ' p' + (i + 1), { x: 20, y: 400, size: 14 }); } d.setTitle(texte); return Buffer.from(await d.save()).toString('base64'); };
    const A = await fabrique('ETIQ-A'), B = await fabrique('ETIQ-B', 2), C = await fabrique('ETIQ-C'), D9 = await fabrique('ETIQ-D', 9);
    const abime = 'JVBERi0xLjcK' + Buffer.from('pas un vrai pdf '.repeat(20)).toString('base64');
    const lignes = {
      [`harvest_${UID}_label_9101`]: { pdfB64: A }, [`harvest_${UID}_label_9102`]: { pdfB64: B }, [`harvest_${UID}_label_9104`]: { pdfB64: abime }, [`harvest_${UID}_label_9107`]: { pdfB64: D9 },   // 9 pages : pas un bordereau
      [`email_bord_9105`]: { uid: '999', pdfB64: C },   // l'e-mail d'un AUTRE compte
      [`email_bord_9106`]: { uid: UID, pdfB64: C },
    };
    const f = faireFond({ src: SRC, connecte: UID, lignes });
    if (typeof f.ctx.bordereauxUnPdf !== 'function') { dit(false, 'bordereauxUnPdf existe'); }
    else {
      // Le monde isolé de l'onglet : les fichiers injectés y sont EXÉCUTÉS (le vrai pdf-lib, le vrai vrm-pdf.js).
      const page = { atob: (s) => Buffer.from(s, 'base64').toString('binary'), console, Uint8Array, setTimeout, clearTimeout, TextEncoder, TextDecoder };
      page.globalThis = page; page.self = page; vm.createContext(page);
      const inj = [];
      const avant = f.ctx.chrome.scripting.executeScript;
      f.ctx.chrome.scripting.executeScript = async (o) => { if (Array.isArray(o.files) && o.files.includes('pdf-lib.min.js')) { inj.push(o); for (const fi of o.files) vm.runInContext(fs.readFileSync(fi === 'vrm-pdf.js' ? PDFJS : path.join(EXT, fi), 'utf8'), page, { filename: fi }); return [{ result: undefined }]; } return avant(o); };
      const r = await f.ctx.bordereauxUnPdf({ txs: ['9102', '9101', '9103', '9104', '9105', '9106', '9107'] }, vinted);
      dit(r && r.ok && r.assembler === true && inj.length === 1 && inj[0].target.tabId === 7 && JSON.stringify(inj[0].files) === '["pdf-lib.min.js","vrm-pdf.js"]', 'P1 la bibliothèque PDF et l’assembleur sont injectés dans CET onglet (et seulement là)', JSON.stringify({ r: r && { ok: r.ok, assembler: r.assembler }, inj: inj.map((x) => x.files) }));
      dit(r && (r.manque || []).includes('9103') && (r.manque || []).includes('9105') && !(r.pdfs || []).some((p) => ['9103', '9105'].includes(String(p.tx))), 'P2 une commande sans bordereau, l’e-mail d’un autre compte : jamais dans le fichier', JSON.stringify(r && { manque: r.manque, pdfs: (r.pdfs || []).map((p) => p.tx) }));
      const un = await page.__vrmAssemblerPdf((r.pdfs || []).map((p) => ({ tx: String(p.tx), b64: p.b64 })));
      const lu = un && un.ok ? await PDFLib.PDFDocument.load(un.octets) : null;
      dit(un && un.ok && un.pages === 4 && lu && lu.getPageCount() === 4 && JSON.stringify(un.inclus.map((x) => x.tx)) === '["9102","9101","9106"]', 'P3 UN fichier, une page par page de bordereau, dans l’ordre de la sélection (9102 ×2, 9101, 9106)', JSON.stringify(un && { ok: un.ok, pages: un.pages, inclus: un.inclus }));
      dit(un && JSON.stringify(un.illisibles) === '["9104","9107"]', 'P4 un PDF abîmé ou de 9 pages n’entre pas : rendu à part (ouvert seul)', JSON.stringify(un && un.illisibles));
      const r2 = await f.ctx.bordereauxUnPdf({ txs: ['9101', '9102'] }, { tab: { id: 8, url: 'https://www.leboncoin.fr/' } });
      dit(r2 && !r2.ok && inj.length === 1, 'P5 hors vinted.fr : rien (aucune injection)', JSON.stringify(r2));
    }
  }
  // ── V ──────────────────────────────────────────────────────────────────────
  console.log('\nV. Mode vacances par l’interface');
  {
    const monter = (vu, pageApprise) => {
      const lignes = pageApprise ? { vinted_vacances_recette: { page: pageApprise, recettes: {} } } : {};
      const f = faireFond({ src: SRC, connecte: UID, lignes, store: { vrmVacancesVues: { [UID]: { v: vu, at: 1 } } } });
      const gestes = [];
      f.ctx.interfaceVinted = async (acc, geste, d) => { gestes.push({ geste, d }); return f.__rep || { ok: true, status: 200, vu: true, etat: d.voulu }; };
      return { f, gestes };
    };
    {
      const { f, gestes } = monter(false, '/settings/holiday');
      if (typeof f.ctx.vacancesCarte !== 'function') dit(false, 'vacancesCarte existe');
      else {
        const r0 = await f.ctx.vacancesCarte({ quoi: 'poser', vacances: true }, vinted);
        dit(r0 && !r0.ok && gestes.length === 0, 'V1 sans SA confirmation : rien ne part', JSON.stringify(r0));
        const r1 = await f.ctx.vacancesCarte({ quoi: 'poser', vacances: true, confirme: true }, { tab: { id: 8, url: 'https://vrm.center/' } });
        dit(r1 && !r1.ok && gestes.length === 0, 'V2 hors de l’onglet vinted.fr : rien', JSON.stringify(r1));
        const r2 = await f.ctx.vacancesCarte({ quoi: 'poser', vacances: false, confirme: true }, vinted);
        dit(r2 && r2.ok && r2.deja && gestes.length === 0, 'V3 déjà dans cet état (lu) : rien n’est touché', JSON.stringify(r2));
        const r3 = await f.ctx.vacancesCarte({ quoi: 'poser', vacances: true, confirme: true }, vinted);
        dit(r3 && r3.ok && r3.fait && gestes.length === 1 && gestes[0].geste === 'vacances' && gestes[0].d.voulu === true && gestes[0].d.page === '/settings/holiday', 'V4 UN geste par l’interface, sur la page apprise de SON geste', JSON.stringify({ r3, gestes }));
        const jr = f.store.vrmJournal && f.store.vrmJournal[UID];
        dit(Array.isArray(jr) && jr.some((e) => e.s === 'vacances_on'), 'V5 au journal (« vacances_on ») une fois vu à l’écran', JSON.stringify(jr));
        const lu = await f.ctx.vacancesCarte({ quoi: 'lire' }, vinted);
        dit(lu && lu.ok && lu.vacances === true, 'V6 l’état relu (profil) suit le geste vu', JSON.stringify(lu));
      }
    }
    {
      const { f, gestes } = monter(false, null);
      if (typeof f.ctx.vacancesCarte === 'function') {
        f.__rep = { ok: true, status: 200, vu: false };
        const r = await f.ctx.vacancesCarte({ quoi: 'poser', vacances: true, confirme: true }, vinted);
        const jr = (f.store.vrmJournal || {})[UID] || [];
        dit(r && !r.ok && r.code === 'pas-vu' && gestes[0] && gestes[0].d.page === '/settings/profile' && !jr.some((e) => e.s === 'vacances_on'), 'V7 réponse sans preuve à l’écran : « pas vu », rien au journal (page par défaut sans apprentissage)', JSON.stringify({ r, g: gestes[0] }));
        f.__rep = { ok: false, status: 0, rienParti: true, sansPage: 'element', manque: 'vacances-interrupteur', raison: 'x' };
        const r2 = await f.ctx.vacancesCarte({ quoi: 'poser', vacances: true, confirme: true }, vinted);
        dit(r2 && !r2.ok && r2.code === 'element' && r2.manque === 'vacances-interrupteur', 'V8 interrupteur introuvable : arrêt NOMMÉ, rien n’est parti', JSON.stringify(r2));
      }
    }
  }
  // ── R ──────────────────────────────────────────────────────────────────────
  console.log('\nR. La première réponse d’un favori');
  {
    const f = faireFond({ src: SRC, connecte: UID });
    if (typeof f.ctx.noterReponsesFavori !== 'function') dit(false, 'noterReponsesFavori existe');
    else {
      const t0 = Date.now() - 3600000;
      f.store.vrmFavorisEnvois = { [UID]: [{ c: '5001', v: 0, k: 'u1', t: t0, i: '7001', a: '42', o: 1 }, { c: '5002', v: 0, k: 'u2', t: t0, i: '7002', a: '43' }] };
      const s = (x) => Math.round(x / 1000);
      const conv = (id, opp, msgs) => ({ conversation: { id, opposite_user: { id: opp }, messages: msgs } });
      await f.ctx.noterReponsesFavori(UID, conv(5001, 99, [{ entity_type: 'message', entity: { user_id: 99, body: 'salut' }, created_at_ts: s(t0 + 60000) }]));
      let l = f.store.vrmFavorisEnvois[UID];
      dit(l[0].r == null, 'R1 un AUTRE acheteur dans le fil : rien (identité conversation ET acheteur)', JSON.stringify(l[0]));
      await f.ctx.noterReponsesFavori(UID, conv(5001, 42, [{ entity_type: 'message', entity: { user_id: 42 }, created_at_ts: s(t0 - 60000) }]));
      l = f.store.vrmFavorisEnvois[UID];
      dit(l[0].r == null && l[0].l > 0, 'R2 un message de l’acheteur AVANT l’envoi n’est pas une réponse (fil « relu »)', JSON.stringify(l[0]));
      const t1 = t0 + 5 * 60000;
      await f.ctx.noterReponsesFavori(UID, conv(5001, 42, [{ entity_type: 'message', entity: { user_id: 42 }, created_at_ts: s(t1) }, { entity_type: 'offer_request_message', entity: { user_id: Number(UID), status: 20 }, created_at_ts: s(t0 + 1000) }]));
      l = f.store.vrmFavorisEnvois[UID];
      dit(Math.abs(l[0].r - s(t1) * 1000) < 2 && l[0].oa === 1 && l[1].r == null, 'R3 la 1re réponse datée, notre offre acceptée notée, l’autre envoi intact', JSON.stringify(l));
      await f.ctx.noterReponsesFavori(UID, conv(5001, 42, [{ entity_type: 'message', entity: { user_id: 42 }, created_at_ts: s(t1 + 600000) }]));
      l = f.store.vrmFavorisEnvois[UID];
      dit(Math.abs(l[0].r - s(t1) * 1000) < 2, 'R4 une réponse notée ne se réécrit jamais (la première fait foi)', JSON.stringify(l[0]));
      await f.ctx.noterReponsesFavori(UID, conv(5002, 43, [{ entity_type: 'offer_request_message', entity: { user_id: 43, status: 10 }, created_at_ts: s(t0 + 9000) }]));
      l = f.store.vrmFavorisEnvois[UID];
      dit(l[1].r > 0 && l[1].ob === 1 && !l[1].oa, 'R5 l’offre de l’acheteur après le message : une réponse, « offre de l’acheteur »', JSON.stringify(l[1]));
      await new Promise((ok) => setTimeout(ok, 30));
      const ligne = Object.keys(f.lignes).find((k) => k.startsWith('favoris_reponses_' + UID + '_'));
      const d = ligne ? f.lignes[ligne] : null;
      const txt = JSON.stringify(d || {});
      dit(d && Array.isArray(d.e) && d.e.length === 2 && d.e[0].r > 0 && d.e[0].oa === 1 && !/salut|5001|5002|body/.test(txt), 'R6 la ligne pour l’app : des scalaires par envoi, ni texte ni n° de conversation', txt);
      const jr = (f.store.vrmJournal || {})[UID] || [];
      dit(jr.filter((e) => e.s === 'favori_reponse').length === 2, 'R7 au journal : une « favori_reponse » par 1re réponse', JSON.stringify(jr));
    }
  }
  // ── S ──────────────────────────────────────────────────────────────────────
  console.log('\nS. La santé des comptes');
  {
    const f = faireFond({ src: SRC, connecte: UID });
    const S = f.ctx.santeCompte;
    if (typeof S !== 'function') dit(false, 'santeCompte existe');
    else {
      const t = Date.now(), base = { h: 10, maxH: 50, j: 30, maxJ: 200, refus: { '403': 0, '429': 0, captcha: 0, pasvu: 0 } };
      const e = (x) => S(Object.assign({}, base, x), t);
      dit(e({}).etat === 'bon', 'S1 rien ⇒ Bon');
      dit(e({ pauseJusqua: t + 600000 }).etat === 'pause' && e({ pauseJusqua: t + 600000 }).raison === 'pause_vinted', 'S2 une pause posée par Vinted ⇒ Pause');
      dit(e({ arret: { quoi: 'captcha', depuis: t } }).geste === 'verification' && e({ bloque: 'banni' }).raison === 'bloque' && e({ h: 50 }).raison === 'plafond_heure' && e({ j: 200 }).raison === 'plafond_jour', 'S3 vérification, compte bloqué, plafonds ⇒ Pause avec la raison et le geste');
      dit(e({ refus: { '403': 1, '429': 0, captcha: 0, pasvu: 0 } }).etat === 'attention' && e({ prudenceJusqua: t + 1000 }).raison === 'prudence' && e({ h: 40 }).raison === 'presque_plafond' && e({ refus: { '403': 0, '429': 0, captcha: 0, pasvu: 1 } }).raison === 'pas_vu', 'S4 refus 24 h, prudence, 80 % du plafond, geste pas vu ⇒ Attention');
      dit(S({ h: null, maxH: null }, t).etat === 'passu', 'S5 jauge pas lue ⇒ « — » (jamais « Bon »)');
      f.store.vrmCarnet = { [UID]: [{ t: t - 3600000, s: '429' }, { t: t - 2 * 864e5, s: '403' }] };
      const tout = await f.ctx.santeComptes();
      const c = tout && tout.comptes && tout.comptes.find((x) => x.uid === UID);
      dit(c && c.refus && c.refus['429'] === 1 && c.refus['403'] === 0 && c.sante.etat === 'attention' && c.sante.raison === 'refus', 'S6 le carnet des 24 h (un 429 d’il y a 1 h compte, un 403 d’avant-hier non) ⇒ Attention', JSON.stringify(c));
    }
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-ext-5420 : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ plantage', e && e.stack); process.exit(1); });
