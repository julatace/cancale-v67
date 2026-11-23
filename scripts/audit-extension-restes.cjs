// ════════════════════════════════════════════════════════════════════════════
//  LOT extension-restes (16 nov., extension 5.395) — le VRAI background.js dans
//  `_fond-vm.cjs`, données inventées (le dépôt est public).
//   F  « Publier cette fiche » (2026-11-11-rangement-guide.md) : SON clic annonce la
//      fiche (`annoncerFicheAPublier`) ⇒ la PREMIÈRE page de dépôt qui s'ouvre (30 min)
//      affiche et réserve LE N° DE LA FICHE (pas le suivant) ; la publication lie ce
//      N° à l'annonce créée par l'identifiant rendu (`items[id].fiche`) ; une fois ;
//      N° déjà sur une annonce ⇒ refus ; « Je numérote moi-même » ⇒ refus ; périmée ⇒
//      règle d'avant ; base illisible ⇒ rien promis.
//   E  « Même photo » eBay : `empreintesImagesPourApp` — seulement `https://i.ebayimg.com/`,
//      sans cookie, 5 par demande, 60 par heure, l'EMPREINTE seule (96 hex), aucune
//      requête vers Vinted ni eBay, rien écrit ; le manifeste porte l'hôte ; l'app ne
//      demande qu'avec une extension à jour (`extSait('empreinteebay')`).
//   S  « Créer sur Vinted » reprend les photos du studio d'une fiche SANS photo (la photo d'origine).
//   C  les deux capacités dans EXT_CAPACITES (5.400.0 : 5.395 sur la branche, servie après 5.399) et la table de l'audit coherence.
//  `--src chemin` : un autre background.js (preuve sur le code d'avant, §6.1).
//  `--prouve` : mutations ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
  const src = fs.readFileSync(BG, 'utf8');
  const MUT = [
    ['la fiche ignorée (le suivant)', "if (ficheP && !numeroPorteAilleurs(main, r, ficheP.numero)) { numero = String(ficheP.numero); ficheLiee = String(ficheP.fiche); }", 'if (false) {}'],
    ['la fiche resservie deux fois', "  try { await chrome.storage.local.remove(FICHE_A_PUBLIER); } catch (_) {}\n", ''],
    ['N° pris pas vérifié', "    if (numeroPorteAilleurs(main, resa, numero)) { noterDiag('fiche_publier_numero_pris'); return { ok: false, code: 'pris' }; }\n", ''],
    ['la fiche pas liée à l’annonce', "uid: v.uid, ...(v.fiche ? { fiche: String(v.fiche) } : {}) };", 'uid: v.uid };'],
    ['eBay : n’importe quelle adresse', "const urlImageEbay = (u) => typeof u === 'string' && u.length < 600 && /^https:\\/\\/i\\.ebayimg\\.com\\/[^\\s?#]+(\\?[^\\s#]*)?$/i.test(u);", "const urlImageEbay = (u) => typeof u === 'string';"],
    ['eBay : avec cookie', "const r = await fetch(u, { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(20000) });", "const r = await fetch(u, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(20000) });"],
    ['eBay : sans plafond horaire', 'if (vues.length >= EMPREINTES_EBAY_HEURE) { h[u] = null; continue; }', ''],
  ];
  let rouges = 0;
  for (const [nom, avant, apres] of MUT) {
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : texte introuvable`); continue; }
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-restes-'));
    const f = path.join(d, 'background.js'); fs.writeFileSync(f, src.replace(avant, apres));
    let code = 0;
    try { execFileSync(process.execPath, [__filename, '--src', f], { stdio: 'pipe' }); } catch (e) { code = e.status || 1; }
    console.log(`${code ? '✅' : '❌'} mutation « ${nom} » ⇒ ${code ? 'rouge (attendu)' : 'VERT : l’audit ne la voit pas'}`);
    if (code) rouges++;
    fs.rmSync(d, { recursive: true, force: true });
  }
  console.log(`\n${rouges}/${MUT.length} mutations rouges`);
  process.exit(rouges === MUT.length ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${String((e && e.stack) || e).slice(0, 400)}`); return null; } };
const MAIN = (o = {}) => ({ vinted_used_numeros: [1, 2, 3, 40, 41, 42], vinted_annonce_numeros: { '10400000001': { numero: '40', accountId: '111' } }, ...o });
const monter = (opts = {}) => faireFond({ src: cheminSource(), lignes: { main: MAIN(opts.main), ...(opts.lignes || {}) }, lectureKO: opts.lectureKO || (() => false) });
const tab = (id) => ({ tab: { id }, origin: 'https://www.vinted.fr', url: 'https://www.vinted.fr/items/new' });
const pourPublier = (f, id) => f.envoyer({ from: 'cancale-vcapture', action: 'numeroPourPublier', domain: 'www.vinted.fr' }, tab(id));
const attendre = (ms = 30) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await essaie('F. Publier cette fiche', async () => {
    const f = monter();
    if (typeof f.ctx.annoncerFicheAPublier !== 'function') { dit(false, 'F0 · `annoncerFicheAPublier` existe dans le fond'); return; }
    const a = await f.ctx.annoncerFicheAPublier({ fiche: 'fn-abc', numero: '42' });
    dit(a && a.ok === true, 'F1 · SON clic : la fiche N°42 est annoncée', JSON.stringify(a));
    const r1 = await pourPublier(f, 5);
    dit(r1 && r1.ok && r1.numero === '42', 'F2 · la page de dépôt qui s’ouvre affiche LE N° DE LA FICHE (42), pas le suivant (43)', JSON.stringify(r1));
    const L = f.lignes.panel_num_reserves;
    dit(!!(L && L.attente && L.attente['42'] && L.attente['42'].fiche === 'fn-abc'), 'F3 · il est RÉSERVÉ en base avec la fiche, avant d’être montré', JSON.stringify(L && L.attente));
    const r2 = await pourPublier(f, 6);
    dit(r2 && r2.numero === '43', 'F4 · une seconde page de dépôt prend le suivant (la fiche ne sert qu’une fois)', JSON.stringify(r2));
    await f.envoyer({ from: 'cancale-content', kind: 'publication', itemId: '10499990042', status: 200, domain: 'www.vinted.fr' }, tab(5));
    await attendre();
    const L2 = f.lignes.panel_num_reserves;
    const it = L2 && L2.items && L2.items['10499990042'];
    dit(!!it && it.numero === '42' && it.fiche === 'fn-abc', 'F5 · la publication LIE le N°42 de la fiche à l’annonce créée (son identifiant)', JSON.stringify(L2 && L2.items));
    // N° déjà sur une annonce ⇒ refus.
    const g = monter();
    const p = await g.ctx.annoncerFicheAPublier({ fiche: 'fn-x', numero: '40' });
    const rg = await pourPublier(g, 5);
    dit(p && p.ok === false && p.code === 'pris' && rg && rg.numero === '43', 'F6 · N° déjà porté par une annonce ⇒ refusé, la page garde la règle d’avant', JSON.stringify({ p, rg }));
    // « Je numérote moi-même »
    const h = monter({ main: { vrm_numero_ecrit: { actif: true } } });
    const ph = await h.ctx.annoncerFicheAPublier({ fiche: 'fn-y', numero: '42' });
    dit(ph && ph.ok === false && ph.code === 'ecrit', 'F7 · « Je numérote moi-même » ⇒ rien n’est réservé', JSON.stringify(ph));
    // Périmée (> 30 min) ⇒ règle d'avant.
    const k = monter();
    await k.ctx.annoncerFicheAPublier({ fiche: 'fn-z', numero: '42' });
    k.store.vrmFicheAPublier.at = Date.now() - 31 * 60000;
    const rk = await pourPublier(k, 5);
    dit(rk && rk.numero === '43', 'F8 · annoncée il y a plus de 30 min ⇒ le suivant (rien de vieux ne revient)', JSON.stringify(rk));
    // Base illisible ⇒ rien promis.
    const m = monter({ lectureKO: (u) => /id=eq\.main/.test(u) });
    const pm = await m.ctx.annoncerFicheAPublier({ fiche: 'fn-w', numero: '42' });
    dit(pm && pm.ok === false && !m.store.vrmFicheAPublier, 'F9 · base illisible ⇒ rien d’annoncé (pas su)', JSON.stringify(pm));
    const inv = await f.ctx.annoncerFicheAPublier({ fiche: 'fn<script>', numero: '42' });
    dit(inv && inv.ok === false && inv.code === 'invalide', 'F10 · une fiche ou un N° illisible ⇒ refus', JSON.stringify(inv));
  });

  await essaie('E. empreintes eBay', async () => {
    const f = monter();
    if (typeof f.ctx.empreintesImagesPourApp !== 'function') { dit(false, 'E0 · `empreintesImagesPourApp` existe dans le fond'); return; }
    // Images inventées : un NOM ⇒ des pixels (motif à blocs).
    const pixels = (nom) => { let s = 0; for (const c of String(nom)) s = (s * 31 + c.charCodeAt(0)) >>> 0; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; }; const n = 64, px = new Uint8ClampedArray(n * n * 4); const b = Array.from({ length: 64 }, () => Math.floor(r() * 255)); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = b[Math.floor(y / 8) * 8 + Math.floor(x / 8)]; const k = (y * n + x) * 4; px[k] = v; px[k + 1] = v; px[k + 2] = v; px[k + 3] = 255; } return px; };
    f.ctx.createImageBitmap = async (blob) => ({ nom: await blob.text(), close() {} });
    f.ctx.OffscreenCanvas = function () { let b = null; this.getContext = () => ({ drawImage(bmp) { b = bmp; }, getImageData: () => ({ data: pixels(b.nom) }), set imageSmoothingQuality(_) {} }); };
    const appels = [];
    const f0 = f.ctx.fetch;
    f.ctx.fetch = async (u, o = {}) => {
      const s = String(u);
      if (/ebayimg|ebay\.|example/.test(s)) { appels.push({ u: s, cred: o.credentials }); return new Response(new Blob([s.split('/').pop()], { type: 'image/jpeg' }), { status: 200 }); }
      return f0(u, o);
    };
    const U = (i) => `https://i.ebayimg.com/images/g/abc${i}/s-l1600.jpg`;
    const r = await f.ctx.empreintesImagesPourApp({ urls: [U(1), U(2), 'https://www.example.com/x.jpg', 'https://i.ebayimg.com.evil.test/x.jpg'] });
    dit(r && r.ok && /^[0-9a-f]{96}$/.test(r.h[U(1)] || '') && /^[0-9a-f]{96}$/.test(r.h[U(2)] || ''), 'E1 · une photo i.ebayimg.com ⇒ son EMPREINTE (96 hex), rien d’autre', JSON.stringify(r && Object.keys(r.h || {})));
    dit(appels.length === 2 && appels.every((a) => a.cred === 'omit' && /^https:\/\/i\.ebayimg\.com\//.test(a.u)), 'E2 · seulement i.ebayimg.com, sans cookie (une autre adresse n’est jamais lue)', JSON.stringify(appels));
    const r5 = await f.ctx.empreintesImagesPourApp({ urls: [1, 2, 3, 4, 5, 6, 7].map((i) => U(10 + i)) });
    dit(r5 && Object.keys(r5.h).length === 5, 'E3 · 5 photos au plus par demande', JSON.stringify(r5 && Object.keys(r5.h).length));
    f.store.vrmEmpreintesEbayHeure = Array.from({ length: 60 }, () => Date.now() - 1000);
    appels.length = 0;
    const rp = await f.ctx.empreintesImagesPourApp({ urls: [U(99)] });
    dit(rp && rp.h[U(99)] === null && rp.plein === true && appels.length === 0, 'E4 · 60 photos par heure au plus : au-delà, rien n’est lu (« pas vérifiée »)', JSON.stringify(rp));
    dit(!(f.j.vinted || []).length && !Object.keys(f.lignes).some((k) => /empreinte|photo/.test(k)), 'E5 · aucune requête vers Vinted, rien écrit en base (l’app range elle-même)', JSON.stringify(Object.keys(f.lignes)));
    const r0 = await f.ctx.empreintesImagesPourApp({ urls: ['https://www.vinted.fr/x.jpg'] });
    dit(r0 && r0.ok === false && r0.code === 'adresse', 'E6 · aucune adresse permise ⇒ refus', JSON.stringify(r0));
  });

  await essaie('S. photos du studio dans « Créer sur Vinted »', async () => {
    const A = await import('file://' + path.join(RACINE, 'src', 'annonceVinted.js'));
    const J = 'data:image/jpeg;base64,AAAA';
    const l = A.photosStudioPourVinted({ photos: [{ id: '1', img: J + '1', detoure: J + 'D' }, { id: '2', img: 'https://ailleurs.test/x.jpg' }, { id: '3', img: J + '3' }, null] });
    dit(Array.isArray(l) && l.length === 2 && l[0] === J + '1' && l[1] === J + '3', 'S1 · la photo D’ORIGINE du studio (jamais la détourée : Vestiaire seul, §3), data URL seulement, dans l’ordre', JSON.stringify(l));
    dit(A.photosStudioPourVinted(null).length === 0 && A.photosStudioPourVinted({ photos: [] }).length === 0, 'S2 · studio pas lu ou vide ⇒ rien de repris');
    // (20 nov., décision de Julien) « Créer sur Vinted » se fait dans le PANNEAU de l'extension : l'atelier de l'app
    // (src/CreerSurVinted.jsx) est retiré ; la règle (photosStudioPourVinted, ci-dessus) reste, l'app ouvre le panneau sur le N°.
    const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
    dit(!fs.existsSync(path.join(RACINE, 'src', 'CreerSurVinted.jsx')) && /<FeuilleExtension action="creerVinted" ids=\{l\.map\(\(f\) => String\(f\.numero\)\)\}/.test(app), 'S3 · (20 nov.) « Créer sur Vinted » : la feuille ouvre le panneau sur les N° (jamais un titre)');
  });

  await essaie('C. branchements', async () => {
    const bg = fs.readFileSync(cheminSource(), 'utf8');
    const man = JSON.parse(fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'manifest.json'), 'utf8'));
    const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
    const coh = fs.readFileSync(path.join(RACINE, 'scripts', 'audit-coherence.cjs'), 'utf8');
    dit(/msg\.type === 'empreinteImage'\) \{ sendResponse\(await empreintesImagesPourApp\(msg\)\)/.test(bg) && /msg\.type === 'ficheAPublier'\) \{ sendResponse\(await annoncerFicheAPublier\(msg\)\)/.test(bg), 'C1 · les deux messages de l’app (origine vérifiée, `onMessageExternal`)');
    dit((man.host_permissions || []).includes('https://i.ebayimg.com/*'), 'C2 · le manifeste porte l’hôte i.ebayimg.com (et rien de plus large)');
    dit(/fichepublier: '5\.400\.0'/.test(app) && /empreinteebay: '5\.400\.0'/.test(app) && /fichepublier:'annoncerFicheAPublier'/.test(coh) && /empreinteebay:'empreintesImagesPourApp'/.test(coh), 'C3 · EXT_CAPACITES : fichepublier et empreinteebay à 5.395.0, dans la table de l’audit coherence');
    dit(/extSait\('empreinteebay'\) === 'ok'/.test(app) && /extSait\('fichepublier'\) !== 'ok'/.test(app), 'C4 · l’app ne demande qu’à une extension à jour (« pas su » ≠ « oui »)');
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
