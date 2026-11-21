// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE STOCK SANS RÉSEAU (13 nov. 2026, point 45 de Julien)
// ════════════════════════════════════════════════════════════════════════════
// Exécute la VRAIE règle (src/stockHorsLigne.js) et la règle du Stock
// (`annoncesActuelles`, src/stockAnnonces.js) :
//   S1 la lecture figée, relue à travers JSON, donne EXACTEMENT les mêmes annonces
//      actuelles que la lecture d'origine (N°, état, plateformes, comptes, ce qui
//      manque, « au moins ») — masquées, à confirmer, eBay, Leboncoin, Vestiaire ;
//   S2 rien n'est figé si rien n'a répondu ; la lecture d'un AUTRE vendeur n'est
//      jamais servie (sa clé, ou la bonne clé à son nom) ; bornée ; un quota plein
//      n'écrit rien ET retire l'ancienne (jamais un état plus vieux que dit) ;
//   S3 les photos : seulement un hôte de photos connu, en https, sans identifiants
//      ni port ; l'adresse locale encode l'adresse d'origine ;
//   S4 le service worker : la MÊME liste d'hôtes et la même borne que le module,
//      une navigation n'est jamais une photo, l'hôte vérifié AVANT toute requête,
//      rien de `/api/` ni de la base, la réserve gardée à la mise à jour ;
//   S5 le branchement : hors réseau le Stock ne lit RIEN (il prend la lecture
//      gardée, sinon « jamais lu ») ; il ne refige ni la liste de l'inventaire ni
//      sa lecture ; la déconnexion vide la réserve des photos ; ce qui demande le
//      réseau est dit une fois ; aucun N° n'est écrit ;
//   S6 « plus d'un jour » se dit.
//   node scripts/audit-stock-hors-ligne.cjs            la règle du dépôt
//   node scripts/audit-stock-hors-ligne.cjs --prouve   chaque mutation doit rougir
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const F_MOD = path.join(RACINE, 'src', 'stockHorsLigne.js');
const F_SW = path.join(RACINE, 'public', 'sw.js');
const F_STOCK = path.join(RACINE, 'src', 'ecrans', 'Stock.jsx');
const F_APP = path.join(RACINE, 'src', 'App.jsx');

// [fichier, ancre, remplacement]
const MUTATIONS = {
  'autre-vendeur': [F_MOD, "f.v !== VERSION_STOCK_HL || f.uid !== uid ||", "f.v !== VERSION_STOCK_HL ||"],
  'rien-lu-fige': [F_MOD, '  if (!lus) return null;\n', ''],
  'sans-borne': [F_MOD, 'if (reste <= 0) break; ', ''],
  'masquees-perdues': [F_MOD, 'masquees: liste(c.masquees, annonceVinted) }', 'masquees: [] }'],
  'quota-garde-vieux': [F_MOD, "catch (_) { try { stockage.removeItem(cleStockHl(uid)); } catch (__) {} return false; }", 'catch (_) { return false; }'],
  'photo-tout-hote': [F_MOD, "const HOTES_PHOTOS = /^(?:[a-z0-9-]+\\.)*(?:vinted\\.net|ebayimg\\.com|vestiairecollective\\.com)$|^img\\.leboncoin\\.fr$/;", 'const HOTES_PHOTOS = /./;'],
  'photo-http': [F_MOD, "return x.protocol === 'https:' && !x.username", 'return !x.username'],
  'sw-sans-liste': [F_SW, "        if (!estPhotoGardable(u)) return new Response('', { status: 404 });\n", ''],
  'sw-navigation': [F_SW, "        if (req.mode === 'navigate') return new Response('', { status: 404 });\n        const u = url.searchParams.get('u') || '';", "        const u = url.searchParams.get('u') || '';"],
  'sw-sans-borne': [F_SW, '              for (const k of cles.slice(0, Math.max(0, cles.length - PHOTOS_MAX))) await c.delete(k);\n', ''],
  'stock-relit-hors-ligne': [F_STOCK, '      setLecture(f ? f.lecture : null);\n      return undefined;\n', '      setLecture(f ? f.lecture : null);\n'],
  'attendu-refige': [F_STOCK, 'if (!sigAttendu || etatHl) return;', 'if (!sigAttendu) return;'],
  'deconnexion-garde-photos': [F_APP, '  try { oublierPhotosHl(); } catch (_) {}\n', ''],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

let n = 0, ko = 0;
const dit = (c, m, d) => { n++; if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + String(d).slice(0, 400) : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le contrôle a tourné jusqu’au bout', e && e.stack); } };

// Le texte d'un fichier, la mutation posée (rien n'est écrit dans le dépôt).
const texte = (f) => { let t = fs.readFileSync(f, 'utf8'); if (mut) { const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); } if (m[0] === f) { if (!t.includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); } t = t.replace(m[1], m[2]); } } return t; };
const sans = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/[^\n]*/gm, '');
const memoire = (plein = false) => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (plein) throw new Error('QuotaExceededError'); m.set(k, String(v)); }, removeItem: (k) => m.delete(k), m }; };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-stock-hl-'));
  let M, SA;
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(dir, 'stockHorsLigne.js'), texte(F_MOD));
    M = await import(pathToFileURL(path.join(dir, 'stockHorsLigne.js')).href);
    SA = await import(pathToFileURL(path.join(RACINE, 'src', 'stockAnnonces.js')).href);
  } catch (e) { console.log('❌ les règles ne se chargent pas : ' + e.message); process.exit(1); }
  finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
  const UID = '11111111-2222-3333-4444-555555555555', AUTRE = '99999999-8888-7777-6666-555555555555';
  const cle = (v) => { const s = String(v == null ? '' : v).toUpperCase().replace(/\s+/g, ''); const m = /^([A-Z]*)0*(\d+)$/.exec(s); return m ? m[1] + m[2] : s; };
  const ph = (id) => `https://images1.vinted.net/t/${id}/f800/x.jpeg`;
  const it = (id, t) => ({ id: String(id), title: t, photo: ph(id), price: 50, currency: 'EUR', url: 'https://www.vinted.fr/items/' + id, brand: 'Marque', size: '42', description: 'longue description '.repeat(20) });
  const numeros = { '1001': { numero: '1' }, '1002': { numero: '2' }, '1003': { numero: '3' }, '1004': { numero: '4' }, '1005': { numero: 'B125' } };
  const lecture = {
    vinted: [
      { uid: 'A', nom: 'compte_a', ok: true, lu: Date.now() - 3600e3, enLigne: [it(1001, 'Une 42'), it(1002, 'Deux 40')], aConfirmer: [it(1003, 'Trois 43')], masquees: [it(1004, 'Quatre masquée')] },
      { uid: 'C', nom: 'compte_c', ok: false },
    ],
    ebay: { liste: [{ numero: '40', title: 'Sur eBay', photo: 'https://i.ebayimg.com/images/g/x/s-l500.jpg' }, { numero: 'B125', title: 'La même sur eBay', photo: ph(1005) }], illisibles: ['ebay_b'] },
    lbc: [{ numero: '50', title: 'Sur Leboncoin', photo: 'https://img.leboncoin.fr/api/v1/x.jpg', etat: 'aconfirmer', lu: Date.now() - 50 * 3600e3 }],
    vc: { lst: { items: { 'vc9': { titre: 'Sur Vestiaire', statut: 'En vente', ref: '60', photo: 'https://images.vestiairecollective.com/x.jpg', vuAt: new Date().toISOString(), profond: { a: 1 } } }, liens: {}, capturedAt: new Date().toISOString(), complet: true }, ventes: {} },
    at: Date.now() - 600e3,
  };
  const actuelles = (l) => {
    const vc = l.vc ? SA.annoncesVcStock({ lst: l.vc.lst, ventes: l.vc.ventes, auto: null }) : null;
    const aa = SA.annoncesActuelles({ vinted: l.vinted, numeros, ebay: l.ebay, lbc: l.lbc, vestiaire: vc, vendus: new Set(), cle, clePhoto: (u) => String(u || '').split('?')[0] });
    return JSON.stringify({ a: aa.articles.map((x) => [x.cle, x.etat, x.plateformes.join('+'), x.comptes.join('+'), x.photo, x.titre]).sort(), m: aa.manque, su: aa.su, au: aa.auMoins, n: aa.n });
  };

  await essaie('S1 — la lecture figée juge comme la lecture d’origine', () => {
    const f = M.figerLecture({ uid: UID, at: lecture.at, lecture });
    dit(!!f && f.uid === UID && f.at === lecture.at, 'S1 la lecture est figée, datée, au nom du vendeur');
    const relue = JSON.parse(JSON.stringify(f)).lecture;
    const a = actuelles(lecture), b = actuelles(relue);
    dit(a === b, 'S1 mêmes annonces actuelles (N°, état, plateformes, comptes, photo, ce qui manque) après gel et relecture', a + '\n≠\n' + b);
    dit(/"masquee"/.test(b) && /"aconfirmer"/.test(b) && /ebay/.test(b) && /leboncoin/.test(b) && /vestiaire/.test(b), 'S1 masquées, à confirmer, eBay, Leboncoin et Vestiaire passent le gel', b.slice(0, 300));
    const s = JSON.stringify(f);
    dit(!/longue description|items\/1001|profond/.test(s), 'S1 rien de lourd ni d’inutile (ni description, ni lien, ni objet imbriqué)');
  });

  await essaie('S2 — rien d’inventé, un seul vendeur, borné', () => {
    dit(M.figerLecture({ uid: UID, at: 1, lecture: { vinted: [{ uid: 'A', ok: false }], ebay: null, lbc: null, vc: null } }) === null, 'S2 rien n’a répondu ⇒ rien n’est figé');
    dit(M.figerLecture({ uid: 'avec espace', at: 1, lecture }) === null && M.figerLecture({ uid: UID, at: NaN, lecture }) === null, 'S2 vendeur ou heure invalides ⇒ rien');
    const st = memoire();
    const f = M.figerLecture({ uid: UID, at: Date.now(), lecture });
    dit(M.ecrireLectureHl(UID, f, st) === true && !!M.lireLectureHl(UID, st), 'S2 écrite puis relue pour CE vendeur');
    dit(M.lireLectureHl(AUTRE, st) === null, 'S2 un autre vendeur ne la lit pas (sa clé)');
    st.setItem(M.cleStockHl(AUTRE), st.getItem(M.cleStockHl(UID)));
    dit(M.lireLectureHl(AUTRE, st) === null, 'S2 la lecture d’un vendeur posée sous la clé d’un autre n’est pas servie');
    dit(M.ecrireLectureHl(AUTRE, f, st) === false, 'S2 jamais écrite sous la clé d’un autre');
    const gros = { vinted: [{ uid: 'A', nom: 'a', ok: true, enLigne: Array.from({ length: M.MAX_ANNONCES + 400 }, (_, i) => it(5000 + i, 'Paire ' + i)), aConfirmer: [], masquees: [] }], ebay: null, lbc: null, vc: null };
    const fg = M.figerLecture({ uid: UID, at: 1, lecture: gros });
    dit(fg.lecture.vinted[0].enLigne.length === M.MAX_ANNONCES, `S2 au plus ${M.MAX_ANNONCES} annonces gardées`, String(fg.lecture.vinted[0].enLigne.length));
    const plein = memoire(true); plein.m.set(M.cleStockHl(UID), JSON.stringify(f));
    const f2 = M.figerLecture({ uid: UID, at: Date.now(), lecture: { ...lecture, vc: null } });
    dit(!!M.lireLectureHl(UID, plein) && M.ecrireLectureHl(UID, f2, plein) === false && M.lireLectureHl(UID, plein) === null, 'S2 quota plein ⇒ rien d’écrit et l’ancienne retirée (jamais un état plus vieux que dit)');
  });

  await essaie('S3 — les photos', () => {
    const oui = ['https://images1.vinted.net/t/1/f800/x.jpeg?s=abc', 'https://i.ebayimg.com/images/g/a/s-l500.jpg', 'https://img.leboncoin.fr/api/v1/x.jpg', 'https://images.vestiairecollective.com/x.jpg'];
    const non = ['http://images1.vinted.net/t/1/x.jpeg', 'https://vinted.net.exemple.com/x.jpg', 'https://exemple.com/?u=vinted.net', 'https://user:pw@images1.vinted.net/x.jpg', 'https://images1.vinted.net:8443/x.jpg', 'https://lgonxzrzjcqthjtbdpzo.supabase.co/rest/v1/app_data', '/api/compte', 'javascript:alert(1)', 'https://img.leboncoin.fr.exemple.com/x.jpg', 'https://' + 'a'.repeat(700) + '.vinted.net/x'];
    dit(oui.every(M.estPhotoGardable), 'S3 les hôtes de photos connus passent', oui.filter((u) => !M.estPhotoGardable(u)).join(' '));
    dit(non.every((u) => !M.estPhotoGardable(u)), 'S3 rien d’autre (http, faux hôte, identifiants, port, base, /api/)', non.filter(M.estPhotoGardable).join(' '));
    dit(M.adressePhotoHl(oui[0]) === '/hl-photo?u=' + encodeURIComponent(oui[0]) && M.adressePhotoHl(non[0]) === null, 'S3 l’adresse locale encode l’adresse d’origine (et refuse le reste)');
  });

  await essaie('S4 — le service worker', () => {
    const sw = sans(texte(F_SW)), mod = sans(texte(F_MOD));
    const reSw = (/const HOTES_PHOTOS = (\/.*\/);/.exec(sw) || [])[1], reMod = (/const HOTES_PHOTOS = (\/.*\/);/.exec(mod) || [])[1];
    dit(!!reSw && reSw === reMod, 'S4 la même liste d’hôtes que le module', `${reSw} ≠ ${reMod}`);
    const corps = (t) => { const i = t.indexOf('function estPhotoGardable(u) {'); return i < 0 ? '' : t.slice(i, t.indexOf('\n}', i)).replace(/\s+/g, ' '); };
    dit(corps(sw) && corps(sw) === corps(mod), 'S4 la même règle estPhotoGardable', corps(sw) + '\n≠\n' + corps(mod));
    dit(Number((/const PHOTOS_MAX = (\d+);/.exec(sw) || [])[1]) === M.PHOTOS_MAX && (/const CACHE_PHOTOS = '([^']+)';/.exec(sw) || [])[1] === M.CACHE_PHOTOS && M.CACHE_PHOTOS.startsWith('vrm-hl-'), 'S4 la même réserve (vrm-hl-…) et la même borne');
    const route = sw.slice(sw.indexOf("if (url.pathname === '/hl-photo')"), sw.indexOf("if (url.pathname === '/partage-achat'"));
    const iNav = route.indexOf("req.mode === 'navigate'"), iListe = route.indexOf('if (!estPhotoGardable(u)) return'), iFetch = route.indexOf('await fetch(u,');
    dit(iNav > 0 && iListe > iNav && iFetch > iListe, 'S4 une navigation n’est jamais une photo, l’hôte est vérifié AVANT toute requête');
    dit(/credentials: 'omit'/.test(route) && /referrerPolicy: 'no-referrer'/.test(route) && /cles\.length - PHOTOS_MAX/.test(route), 'S4 sans cookie ni référent, au plus PHOTOS_MAX');
    dit(!/\/api\/|supabase|rest\/v1/.test(route), 'S4 rien de la base ni de /api/ dans la route des photos');
    dit(/!k\.startsWith\('vrm-hl-'\)/.test(sw), 'S4 la réserve est gardée à la mise à jour (vrm-hl-*)');
    dit(/if \(url\.pathname\.startsWith\('\/api\/'\)\) return;/.test(sw), 'S4 toujours aucun cache sur /api/');
  });

  await essaie('S5 — le branchement', () => {
    const st = sans(texte(F_STOCK)), app = sans(texte(F_APP));
    const eff = st.slice(st.indexOf('const horsLigneStock = useStockHorsLigne();'), st.indexOf('}, [comptesLus, cleComptesStock, horsLigneStock]);'));
    // Le bloc « hors réseau » (jusqu'à son accolade) doit SE TERMINER par un retour : rien après lui ne s'exécute.
    const iHl = eff.indexOf('if (horsLigneStock) {'), iFin = eff.indexOf('\n    }', iHl), iRet = iFin, iLit = eff.indexOf('lireAnnoncesStock(');
    const blocHl = iHl > 0 && iFin > iHl ? eff.slice(iHl, iFin) : '';
    dit(iHl > 0 && /lireLectureHl\(uidV, localStorage\)/.test(blocHl) && /\n\s*return undefined;\s*$/.test(blocHl) && iLit > iFin && blocHl.indexOf('lireAnnoncesStock(') < 0, 'S5 hors réseau, le Stock prend la lecture gardée et ne lit RIEN au réseau');
    dit(/setEtatHl\(\{ at: f \? f\.at : null \}\)/.test(eff), 'S5 sans lecture gardée : « jamais lu sur cet appareil » (rien d’inventé)');
    dit(/navigator\.onLine !== false && !horsLigneActif\(\)\) \{ const f = figerLecture\(/.test(eff), 'S5 la lecture n’est gardée qu’EN LIGNE');
    dit(/if \(!sigAttendu \|\| etatHl\) return;/.test(st), 'S5 hors réseau, la liste de l’inventaire n’est pas refigée à l’heure d’aujourd’hui');
    dit(/horsLigne=\{etatHl && Number\.isFinite\(etatHl\.at\) \? \{ at: etatHl\.at \} : null\}/.test(st), 'S5 l’inventaire du Stock dit qu’il juge contre le dernier état');
    dit((st.match(/data-hl-refuse=/g) || []).length === 1, 'S5 ce qui demande le réseau est dit UNE fois');
    const hl = st.slice(st.indexOf('function useStockHorsLigne'), st.indexOf('function StockMeubles('));
    dit(!/\bsave\(|saveTout\(|vinted_annonce_numeros|vinted_used_numeros|vrm_slots|fetch\(/.test(hl + eff.slice(iHl, iRet)), 'S5 le chemin hors réseau n’écrit rien et ne lit pas la base (aucun N°, aucune case)');
    dit(/oublierPhotosHl\(\)/.test(app.slice(app.indexOf('const wipeLocalData'), app.indexOf('const OWNER_MARK'))), 'S5 la déconnexion vide la réserve des photos');
    dit(/onLoad=\{\(\) => retenirPhoto\(f\.photo\)\}/.test(st), 'S5 seule une photo AFFICHÉE en ligne est retenue');
  });

  await essaie('S6 — un état de plus d’un jour', () => {
    const t = Date.now();
    dit(!M.etatStockVieux(t - 23 * 3600e3, t) && M.etatStockVieux(t - 25 * 3600e3, t) && !M.etatStockVieux(NaN, t), 'S6 plus de 24 h ⇒ dit (ambre) ; pas su ⇒ rien');
  });

  console.log(`\n${n - ko}/${n} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
