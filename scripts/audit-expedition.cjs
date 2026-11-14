#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : L'EXPÉDITION (14 nov., idées 151 152 153 163)
//         node scripts/audit-expedition.cjs [--mutation=…] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE les règles (src/expedition/) sur des données INVENTÉES (le dépôt est public) :
//   M. 152 même acheteur : 50 acheteurs aux pseudos PROCHES (même pseudo à une lettre, à la
//      casse, à l'espace près ; même pseudo et autre identifiant) ⇒ AUCUN regroupement ; le
//      même identifiant sur deux comptes vendeurs ⇒ rien ; Leboncoin et Vestiaire ⇒ jamais ;
//      eBay : nom d'utilisateur EXACT seulement ; la vraie paire (même identifiant, même compte)
//      ⇒ UN groupe ; rapprocher ne touche que les groupes CHOISIS ; les lignes lues ne valent que
//      si leur n° colle au nom de la ligne et que c'est une VENTE ;
//   C. 153 consignes : les quatre plateformes, chaque clé dans les 5 langues ; aucun délai
//      chiffré inventé (seul le « 7 jours » mesuré) ; le délai LU passe tel quel ; eBay dit
//      « prépayée », « l'acheteur a payé », « VRM n'achète rien » ; AUCUN appel d'achat d'étiquette
//      eBay dans le code de l'expédition ni dans la route eBay ;
//   T. 151 imprimante : ZPL / TSPL / ESC-POS décodés octet par octet ⇒ la MÊME image ; une
//      étiquette par page ; Zebra ⇒ ZPL, TSC ⇒ TSPL, inconnu ⇒ TSPL puis l'essai ; pas de
//      jumelage, essai non réussi, navigateur sans WebUSB, page qui l'interdit ⇒ le PDF ;
//      l'en-tête servi (vercel.json) permet usb=(self) et serial=(self) ;
//   S. 163 samedi : horaires de Vinted lus (plages qui se touchent fondues, forme inconnue ⇒
//      rien), heure limite à Paris (ouvert / passé / fermé / inconnu), trajet au plus proche
//      depuis la ville, points sans position à la fin, point de dépôt du BON transporteur
//      seulement (aucun ⇒ « n'importe quel point », pas d'adresse inventée), cases du jour ;
//   B. le branchement dans App.jsx (sortirLot, rapprocher, consignes dans Préparer, mode samedi).
// `--mutation=…` réaffaiblit une règle dans une copie de src/ : rouge exigé ; `--prouve` les joue toutes.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUTS = {
  'acheteur-par-pseudo': ["const id = c.acheteurId;", "const id = c.pseudo ? String(c.pseudo).toLowerCase().replace(/[^a-z]/g, '') : c.acheteurId;", 'expedition/memeAcheteur.js'],
  'acheteur-tous-comptes': ["return s ? `vinted|${compte}|${s}` : '';", "return s ? `vinted|${s}` : '';", 'expedition/memeAcheteur.js'],
  'acheteur-ebay-casse': ["return nonVide(id) && id.trim() === id ? `ebay|${compte}|${id}` : '';", "return nonVide(id) ? `ebay|${compte}|${id.trim().toLowerCase()}` : '';", 'expedition/memeAcheteur.js'],
  'acheteur-lbc': ["export const SITES_AVEC_ACHETEUR = Object.freeze(['vinted', 'ebay']);", "export const SITES_AVEC_ACHETEUR = Object.freeze(['vinted', 'ebay', 'leboncoin', 'vestiaire']);", 'expedition/memeAcheteur.js'],
  'acheteur-seul': ['return [...par.values()].filter((g) => g.colis.length >= 2);', 'return [...par.values()];', 'expedition/memeAcheteur.js'],
  'rapprocher-sans-choix': ['const actifs = (groupes || []).filter((g) => choisis && choisis.has(g.cle));', 'const actifs = groupes || [];', 'expedition/memeAcheteur.js'],
  'lignes-cote-acheteur': ["if (!k || String(r.tx || '') !== k[2] || r.side !== 'seller' || !/^[1-9]\\d*$/.test(String(r.b || ''))) continue;", "if (!k || !/^[1-9]\\d*$/.test(String(r.b || ''))) continue;", 'expedition/MemeAcheteur.jsx'],
  'delai-invente': ["delai: lu ? { cle: 'exp.delai.lu', vars: { limite: limite.trim() } } : { cle: DELAI_PAS_LU[site], vars: {} },", "delai: { cle: 'exp.delai.lu', vars: { limite: lu ? limite.trim() : '5 jours' } },", 'expedition/consignesColis.js'],
  'zpl-octet-perdu': ["for (let i = 0; i < total; i++) { const b = bits[i];", "for (let i = 1; i < total; i++) { const b = bits[i];", 'expedition/thermiqueDirecte.js'],
  'tspl-pas-inverse': ['for (let i = 0; i < bits.length; i++) inv[i] = (~bits[i]) & 0xff;', 'for (let i = 0; i < bits.length; i++) inv[i] = bits[i];', 'expedition/thermiqueDirecte.js'],
  'seuil-gris': ['if (lum < seuil) bits[y * rb + (x >> 3)]', 'if (lum < 250) bits[y * rb + (x >> 3)]', 'expedition/thermiqueDirecte.js'],
  'directe-sans-essai': ["if (!LANGAGES.includes(v.langage) || v.essaiOk !== true) return null;", "if (!LANGAGES.includes(v.langage)) return null;", 'expedition/thermiqueDirecte.js'],
  'directe-sans-politique': ["const usb = aUsb && politique('usb'), serie = aSerie && politique('serial');", 'const usb = aUsb, serie = aSerie;', 'expedition/thermiqueDirecte.js'],
  'directe-tout-format': ["if (format !== 'thermique') return { voie: 'pdf', raison: 'format' };", '', 'expedition/thermiqueDirecte.js'],
  'langage-devine': ["export const langagePropose = (vendorId) => (FABRICANTS[vendorId] ? FABRICANTS[vendorId].langage : 'tspl');", "export const langagePropose = () => 'zpl';", 'expedition/thermiqueDirecte.js'],
  'horaires-faux': ["if (!HH.test(de) || !HH.test(a)) return null;", 'if (!HH.test(de) || !HH.test(a)) continue;', 'expedition/modeSamedi.js'],
  'heure-jour-pas-dit': ["if (!e) return { etat: 'inconnu' };                       // ce jour-là pas dit : pas su", "if (!e) return { etat: 'ferme' };", 'expedition/modeSamedi.js'],
  'trajet-ordre-recu': ['let bi = 0, bd = Infinity;', 'let bi = 0, bd = Infinity; if (reste.length) { bd = distanceKm(ici, reste[0]); }', 'expedition/modeSamedi.js'],
  'trajet-devine-position': ['const avec = L.filter(aPosition), sans = L.filter((p) => !aPosition(p));', 'const avec = L.map((p) => (aPosition(p) ? p : { ...p, lat: 48.85, lon: 2.35 })), sans = [];', 'expedition/modeSamedi.js'],
  'depot-autre-transporteur': ["const ceux = g.trCle ? candidats.filter((p) => p.trCle === g.trCle) : [];", 'const ceux = candidats;', 'expedition/modeSamedi.js'],
  'cases-hier': ["if (!brut || typeof brut !== 'object' || brut.jour !== jour || !brut.cles || typeof brut.cles !== 'object') return {};", "if (!brut || typeof brut !== 'object' || !brut.cles || typeof brut.cles !== 'object') return {};", 'expedition/modeSamedi.js'],
  'app-sans-directe': ["  const sortirLot = (pret, opts = {}) => {\n    const j = jumelageActuel();", "  const sortirLot = (pret, opts = {}) => { return ouvrirPdfLot(pret, opts);\n    const j = jumelageActuel();", 'App.jsx'],
  'app-directe-muette': ["toast(tr('exp.direct.repli', { raison: tr(`exp.direct.echec.${raisonEchec(err)}`) }), 'err');", '', 'App.jsx'],
  'app-sans-rapprocher': ['const rangerColisEnvoi = (tous) => rapprocher(ordreRecent(tous, quandColisAEnvoyer), cleRangeColis, memeAcheteurRef.current.groupes, memeAcheteurRef.current.choisis);', 'const rangerColisEnvoi = (tous) => ordreRecent(tous, quandColisAEnvoyer);', 'App.jsx'],
  'app-acheteur-autre-compte': ["compte: a && a.uid === uid ? uid : ''", 'compte: uid', 'App.jsx'],
  'app-sans-consignes': ["<ConsignesColis site={c.site} limite={c.limite || ''}/></> : null)}/> : null}", '</> : null)}/> : null}', 'App.jsx'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  if (!MUTS[MUT]) { console.log('mutation inconnue : ' + MUT); process.exit(2); }
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'expedition-'));
  process.on('exit', () => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} });
  // La copie : src/ (sans ses médias) et api/_lib (les modules importent ../../api/_lib/horaires-relais.js).
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true, filter: (s) => !/\/node_modules(\/|$)|\.(png|jpe?g|webp|mp4|woff2?)$/.test(s) });
  fs.cpSync(path.join(R, 'api', '_lib'), path.join(d, 'api', '_lib'), { recursive: true });
  try { fs.copyFileSync(path.join(R, 'package.json'), path.join(d, 'package.json')); } catch (_) {}
  const f = path.join(d, 'src', MUTS[MUT][2]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MUTS[MUT][0])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1]));
  SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const lire = (f) => { try { return fs.readFileSync(path.join(SRC, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;

(async () => {
  let MA, CO, TH, SA, LANG = {};
  try {
    MA = await import(url('expedition/memeAcheteur.js')); CO = await import(url('expedition/consignesColis.js'));
    TH = await import(url('expedition/thermiqueDirecte.js')); SA = await import(url('expedition/modeSamedi.js'));
    for (const l of ['fr', 'en', 'es', 'it', 'de']) LANG[l] = (await import(url(`i18n/langues/${l}/expedition.js`))).default;
  } catch (e) { dit(false, 'les modules de l’expédition existent et se chargent', e.message); console.log(`\n${ok} verts, ${ko} rouges`); process.exit(1); }
  // Les lignes lues (fonction pure du fichier .jsx, sans React) : extraites et évaluées seules.
  let acheteursDeLignes = null;
  { const src = lire('expedition/MemeAcheteur.jsx'); const m = /export function acheteursDeLignes\(rows\) \{[\s\S]*?\n\}/.exec(src);
    try { acheteursDeLignes = m ? new Function(m[0].replace('export ', '') + '\nreturn acheteursDeLignes;')() : null; } catch (_) { acheteursDeLignes = null; } }

  // ── M · même acheteur ─────────────────────────────────────────────────────
  console.log('\n── M. 152 · Même acheteur, par identité exacte');
  const proches = [];
  for (let i = 0; i < 50; i++) {
    const base = 'julien_sneak';
    const pseudo = [base, base.toUpperCase(), base + ' ', base.replace('_', '-'), base + String(i % 3), 'julien_snaek', base.slice(0, -1)][i % 7];
    proches.push({ cle: 'v:' + (9000 + i), site: 'vinted', compte: '111', acheteurId: String(70000000 + i), pseudo });
  }
  dit(MA.groupesMemeAcheteur(proches).length === 0, 'M1 50 acheteurs aux pseudos PROCHES (casse, espace, tiret, une lettre), identifiants différents ⇒ aucun regroupement');
  const memePseudo = Array.from({ length: 50 }, (_, i) => ({ cle: 'v:' + (8000 + i), site: 'vinted', compte: '111', acheteurId: 60000000 + i, pseudo: 'meme_pseudo' }));
  dit(MA.groupesMemeAcheteur(memePseudo).length === 0, 'M2 50 ventes au MÊME pseudo affiché mais 50 identifiants ⇒ aucun regroupement (le pseudo n’est qu’affiché)');
  const vraie = [...proches, { cle: 'v:1', site: 'vinted', compte: '111', acheteurId: '555', pseudo: 'a' }, { cle: 'v:2', site: 'vinted', compte: '111', acheteurId: 555, pseudo: 'a' }];
  const g1 = MA.groupesMemeAcheteur(vraie);
  dit(g1.length === 1 && JSON.stringify(g1[0].colis) === '["v:1","v:2"]', 'M3 le même identifiant (texte ou nombre) sur le même compte ⇒ UN groupe de 2, au milieu de 50 proches', JSON.stringify(g1));
  dit(MA.groupesMemeAcheteur([{ cle: 'v:1', site: 'vinted', compte: '111', acheteurId: '555' }, { cle: 'v:2', site: 'vinted', compte: '222', acheteurId: '555' }]).length === 0, 'M4 le même identifiant sur DEUX comptes vendeurs ⇒ rien (deux comptes, deux envois)');
  dit(MA.groupesMemeAcheteur([{ cle: 'l:1', site: 'leboncoin', compte: 'x', acheteurId: 'a' }, { cle: 'l:2', site: 'leboncoin', compte: 'x', acheteurId: 'a' }, { cle: 'vc:1', site: 'vestiaire', compte: 'x', acheteurId: 'a' }, { cle: 'vc:2', site: 'vestiaire', compte: 'x', acheteurId: 'a' }]).length === 0, 'M5 Leboncoin et Vestiaire (aucune identité d’acheteur lue) ⇒ jamais regroupés');
  dit(MA.groupesMemeAcheteur([{ cle: 'e:1', site: 'ebay', compte: 'c', acheteurId: 'Bob_42' }, { cle: 'e:2', site: 'ebay', compte: 'c', acheteurId: 'bob_42' }, { cle: 'e:3', site: 'ebay', compte: 'c', acheteurId: 'Bob_42 ' }]).length === 0, 'M6 eBay : « Bob_42 », « bob_42 », « Bob_42␠ » ⇒ trois acheteurs (égalité exacte)');
  dit(MA.groupesMemeAcheteur([{ cle: 'e:1', site: 'ebay', compte: 'c', acheteurId: 'Bob_42' }, { cle: 'e:2', site: 'ebay', compte: 'c', acheteurId: 'Bob_42' }]).length === 1, 'M7 eBay : le même nom exact sur le même compte ⇒ un groupe');
  dit(MA.groupesMemeAcheteur([{ cle: 'v:1', site: 'vinted', compte: '111', acheteurId: '' }, { cle: 'v:2', site: 'vinted', compte: '111', acheteurId: '' }, { cle: 'v:3', site: 'vinted', compte: '111', acheteurId: '0' }, { cle: 'v:4', site: 'vinted', compte: '111', acheteurId: '0' }]).length === 0, 'M8 identifiant vide ou « 0 » (pas lu) ⇒ rien');
  dit(MA.groupesMemeAcheteur([{ cle: 'v:1', site: 'vinted', compte: '111', acheteurId: '9' }, { cle: 'v:1', site: 'vinted', compte: '111', acheteurId: '9' }]).length === 0, 'M9 le même colis deux fois n’est pas deux colis');
  { const L = ['a', 'v:1', 'b', 'c', 'v:2', 'd'].map((k) => ({ k })); const gs = [{ cle: 'G', colis: ['v:1', 'v:2'] }];
    const sans = MA.rapprocher(L, (x) => x.k, gs, new Set()).map((x) => x.k).join(','), avec = MA.rapprocher(L, (x) => x.k, gs, new Set(['G'])).map((x) => x.k).join(',');
    dit(sans === 'a,v:1,b,c,v:2,d' && avec === 'a,v:1,v:2,b,c,d', 'M10 rapprocher : rien sans SON choix ; choisi ⇒ le second juste après le premier, le reste dans son ordre', `${sans} / ${avec}`); }
  dit(JSON.stringify(MA.autresDuGroupe([{ cle: 'G', colis: ['v:1', 'v:2', 'v:3'] }], 'v:2')) === '["v:1","v:3"]', 'M11 le rappel à l’emballage nomme les AUTRES colis du même acheteur');
  if (acheteursDeLignes) {
    const m = acheteursDeLignes([
      { id: 'harvest_111_txn_9301', tx: '9301', side: 'seller', b: '555', bl: 'ana', n: '1' },
      { id: 'harvest_111_txn_9302', tx: '9999', side: 'seller', b: '555' },       // n° qui ne colle pas au nom
      { id: 'harvest_111_txn_9303', tx: '9303', side: 'buyer', b: '555' },        // un ACHAT
      { id: 'harvest_111_txn_9304', tx: '9304', side: 'seller', b: 'ana' },       // identifiant pas numérique
    ]);
    dit(m.size === 1 && m.get('9301') && m.get('9301').acheteurId === '555' && m.get('9301').uid === '111', 'M12 une ligne lue ne vaut que si SON n° colle à son nom, que c’est une VENTE et un identifiant numérique', JSON.stringify([...m]));
  } else dit(false, 'M12 `acheteursDeLignes` se lit dans MemeAcheteur.jsx');
  { const q = lire('expedition/MemeAcheteur.jsx'); dit(/select=id,tx:data->payload->transaction->>id,side:[^`]*b:data->payload->transaction->>buyer_id/.test(q) && !/select=data\b|select=\*/.test(sansCommentaires(q)), 'M13 la lecture des identités est PROJETÉE en scalaires (jamais `select=data`, §4.4)'); }

  // ── C · consignes ─────────────────────────────────────────────────────────
  console.log('\n── C. 153 · Ce que demande chaque plateforme');
  const sites = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];
  const toutes = sites.map((s) => CO.consignesPour(s, ''));
  dit(toutes.every((c) => c && c.lignes.length >= 3 && c.source && /^https:\/\//.test(c.source)), 'C1 les quatre plateformes ont leurs consignes et leur page d’aide citée');
  const cles = toutes.flatMap((c) => [c.titre, ...c.lignes, c.delai.cle]).concat(['exp.delai.lu']);
  const manquent = []; for (const l of Object.keys(LANG)) for (const k of cles) if (typeof LANG[l][k] !== 'string' || !LANG[l][k].trim()) manquent.push(`${l}:${k}`);
  dit(!manquent.length, 'C2 chaque consigne existe dans les 5 langues (tr)', manquent.slice(0, 6).join(', '));
  const chiffres = cles.filter((k) => /\d/.test(LANG.fr[k] || '') && !/au plus tôt 7 jours après la vente, mesuré/.test(LANG.fr[k]));
  dit(!chiffres.length, 'C3 aucun délai chiffré inventé : seul le « 7 jours » MESURÉ (limite-envoi.js) est écrit', chiffres.join(', '));
  { const c = CO.consignesPour('vinted', 'avant demain 10 h'); dit(c.delai.cle === 'exp.delai.lu' && c.delai.vars.limite === 'avant demain 10 h' && CO.consignesPour('vinted', '  ').delai.cle === 'exp.delai.vinted.pasLu', 'C4 le délai LU pour CE colis passe tel quel ; pas lu ⇒ la règle de la plateforme'); }
  { const t = LANG.fr['exp.consigne.ebay.etiquette'] || ''; dit(/prépayée par eBay/.test(t) && /l’acheteur a payé/.test(t) && /VRM n’achète rien/.test(t), 'C5 eBay : l’étiquette prépayée par eBay, payée par l’acheteur, VRM n’achète rien (§2.8)', t); }
  dit(CO.consignesPour('autre', '') === null, 'C6 une plateforme inconnue ⇒ rien (jamais une consigne devinée)');
  { const code = ['expedition/consignesColis.js', 'expedition/ConsignesColis.jsx', 'expedition/ModeSamedi.jsx', 'expedition/MemeAcheteur.jsx'].map((f) => sansCommentaires(lire(f))).join('\n');
    const ebay = (() => { try { return sansCommentaires(fs.readFileSync(path.join(R, 'api', 'ebay.js'), 'utf8')); } catch (_) { return ''; } })();
    const ACHAT = /sell\/logistics|shipping_quote|shippingQuote|create_from_shipping_quote|purchaseShippingLabel|\/shipment\b.*label|achatEtiquette|acheterEtiquette/i;
    dit(!ACHAT.test(code) && !/appelEbay|api\.ebay\.com|\/api\/ebay/.test(code), 'C7 l’expédition n’appelle AUCUNE route eBay ni d’achat d’étiquette');
    dit(!!ebay && !ACHAT.test(ebay), 'C8 la route eBay (api/ebay.js) ne porte aucune route d’achat d’étiquette (logistics / shipping quote)'); }

  // ── T · imprimante thermique ──────────────────────────────────────────────
  console.log('\n── T. 151 · Imprimante thermique jumelée');
  const W = 61, Hh = 40;
  const rgba = new Uint8ClampedArray(W * Hh * 4);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const noir = (x * 7 + y * 3) % 5 === 0 || (x > 40 && y < 9); const gris = x === 5; const v = noir ? 10 : gris ? 200 : 255; rgba[i] = rgba[i + 1] = rgba[i + 2] = v; rgba[i + 3] = x === 60 && y === 0 ? 0 : 255; }
  const bits = TH.monochrome(rgba, W, Hh);
  const attendu = (x, y) => { const noir = (x * 7 + y * 3) % 5 === 0 || (x > 40 && y < 9); return noir && !(x === 60 && y === 0); };
  let ecarts = 0; for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (!!(bits[y * 8 + (x >> 3)] & (0x80 >> (x & 7))) !== attendu(x, y)) ecarts++;
  dit(ecarts === 0 && bits.length === 8 * Hh, 'T1 l’image en points : noir pur, gris clair ⇒ blanc, transparent ⇒ blanc, 8 octets par ligne de 61 points', String(ecarts));
  const page = { w: W, h: Hh, bits };
  const txt = (u) => Buffer.from(u).toString('latin1');
  { const z = txt(TH.etiquetteZpl(page)); const m = /^\^XA\^PW64\^LL40\^LH0,0\^FO0,0\^GFA,(\d+),(\d+),(\d+),([0-9A-F]+)\^FS\^PQ1\^XZ\n$/.exec(z);
    const dec = m ? Buffer.from(m[4], 'hex') : null;
    dit(!!m && +m[1] === 320 && +m[3] === 8 && dec && dec.equals(Buffer.from(bits)), 'T2 ZPL : ^XA ^PW ^LL ^GFA (taille, octets par ligne) et l’image décodée = la même, octet par octet'); }
  { const t = TH.etiquetteTspl(page); const s = txt(t); const m = /^SIZE (\d+) mm,(\d+) mm\r\nGAP 2 mm,0 mm\r\nDIRECTION 1\r\nREFERENCE 0,0\r\nCLS\r\nBITMAP 0,0,8,40,0,/.exec(s);
    const deb = m ? m[0].length : 0; const corps = Buffer.from(t.subarray(deb, deb + 320)); const fin = txt(t.subarray(deb + 320));
    dit(!!m && fin === '\r\nPRINT 1,1\r\n' && corps.every((b, i) => b === ((~bits[i]) & 0xff)), 'T3 TSPL : SIZE / BITMAP / PRINT, l’image INVERSÉE (en TSPL un bit à 0 imprime), octet par octet'); }
  { const e = TH.etiquetteEscpos(page); dit(e[0] === 0x1b && e[1] === 0x40 && e[2] === 0x1d && e[3] === 0x76 && e[4] === 0x30 && e[6] === 8 && e[8] === 40 && Buffer.from(e.subarray(10, 330)).equals(Buffer.from(bits)) && e[e.length - 3] === 0x56 && e[e.length - 2] === 0x42, 'T4 ESC/POS : ESC @, GS v 0 (largeur, hauteur), l’image, la coupe'); }
  { const lot = txt(TH.octetsDuLot('zpl', [page, page, page])); dit((lot.match(/\^XA/g) || []).length === 3 && (lot.match(/\^XZ/g) || []).length === 3, 'T5 un lot de 3 pages ⇒ 3 étiquettes, dans l’ordre');
    const ts = txt(TH.octetsDuLot('tspl', [page, page])); dit((ts.match(/PRINT 1,1/g) || []).length === 2, 'T6 TSPL : 2 pages ⇒ 2 PRINT'); }
  dit(TH.langagePropose(0x0a5f) === 'zpl' && TH.langagePropose(0x1203) === 'tspl' && TH.langagePropose(0x1234) === 'tspl' && TH.langageSuivant('tspl') === 'zpl' && TH.langageSuivant('zpl') === 'escpos' && TH.langageSuivant('escpos') === 'tspl', 'T7 Zebra ⇒ ZPL, TSC ⇒ TSPL, inconnu ⇒ TSPL puis l’essai tranche (TSPL → ZPL → ESC/POS)');
  const J = { voie: 'usb', vendorId: 0x0a5f, productId: 0x0100, serie: 'X1', nom: 'Zebra ZD420', langage: 'zpl', essaiOk: true, at: 1 };
  const V = { usb: true, serie: false, raison: '' };
  const voie = (o) => TH.voieImpressionDirecte({ format: 'thermique', jumelage: J, voies: V, ...o });
  dit(voie({}).voie === 'directe', 'T8 papier thermique + jumelée (essai réussi) + WebUSB ⇒ directe');
  dit(voie({ format: 'normale' }).voie === 'pdf' && voie({ format: 'planche4' }).voie === 'pdf', 'T9 papier A4 ou 4 par page ⇒ toujours le PDF');
  dit(voie({ jumelage: { ...J, essaiOk: false } }).voie === 'pdf' && voie({ jumelage: null }).raison === 'pasJumelee', 'T10 sans page d’essai réussie (ou jamais jumelée) ⇒ le PDF');
  dit(voie({ voies: { usb: false, serie: false, raison: 'navigateur' } }).raison === 'navigateur' && voie({ jumelage: { ...J, voie: 'serie' }, voies: { usb: true, serie: false } }).voie === 'pdf', 'T11 navigateur sans WebUSB (Safari, iPhone, Firefox) ⇒ le PDF, raison « navigateur »');
  { const nav = { usb: { requestDevice() {} }, serial: { requestPort() {} } };
    const bloque = TH.voiesDisponibles(nav, { permissionsPolicy: { allowsFeature: () => false } }), libre = TH.voiesDisponibles(nav, { permissionsPolicy: { allowsFeature: () => true } }), rien = TH.voiesDisponibles({}, {});
    dit(bloque.raison === 'politique' && !bloque.usb && libre.usb && libre.serie && rien.raison === 'navigateur', 'T12 la page interdite (Permissions-Policy) ⇒ raison « politique », dite ; rien ⇒ « navigateur »', JSON.stringify({ bloque, libre, rien })); }
  { const V2 = require(path.join(R, 'scripts', 'bancs', '_vercel.cjs')); const e = V2.entetesPour('/', { brut: true }); const pp = String(Object.entries(e).find(([k]) => k.toLowerCase() === 'permissions-policy')?.[1] || '');
    dit(/(^|,\s*)usb=\(self\)(\s*,|$)/.test(pp) && /(^|,\s*)serial=\(self\)(\s*,|$)/.test(pp), 'T13 l’en-tête SERVI (vercel.json) : usb=(self), serial=(self) — l’impression directe n’est pas bloquée en silence', pp); }
  dit(TH.raisonEchec({ name: 'NotFoundError', message: 'No device selected.' }) === 'annule' && TH.raisonEchec({ name: 'SecurityError', message: 'Unable to claim interface.' }) === 'occupee' && TH.raisonEchec({ raison: 'refus' }) === 'refus' && TH.raisonEchec({}) === 'inconnue', 'T14 chaque échec a sa raison dite (choix annulé, imprimante prise par Windows, refus)');
  dit(TH.jumelageValide({ ...J, voie: 'wifi' }) === null && TH.jumelageValide({ ...J, langage: 'pcl' }) === null && TH.jumelageValide({ ...J, vendorId: 'x' }) === null, 'T15 un jumelage étrange n’est jamais cru');
  { const app = sansCommentaires(lire('App.jsx'));
    dit(/montrerApres\(pret, sortirLot\(pret, \{ titre: tr\('impr\.titrePdf'\) \}\), sig\);/.test(app) && /sortirLot\(e\.res, \{ geste: false/.test(app), 'B1 « Imprimer (N) » passe par `sortirLot` (le chemin du geste ET celui de l’attente)');
    dit(/voieImpressionDirecte\(\{ format: pret\.mode \|\| formatLot, jumelage: j, voies: voiesActuelles\(\) \}\)\.voie !== 'directe'\) return ouvrirPdfLot\(pret, opts\)/.test(app) && /toast\(tr\('exp\.direct\.repli'/.test(app), 'B2 pas directe ⇒ le PDF comme avant ; un envoi raté le DIT puis ouvre le PDF'); }

  // ── S · le mode samedi ───────────────────────────────────────────────────
  console.log('\n── S. 163 · Le mode samedi');
  const bh = [{ weekday: 'saturday', hours: [{ opens_at_raw: '09:00', closes_at_raw: '12:00' }, { opens_at_raw: '12:00', closes_at_raw: '19:30' }] }, { weekday: 'sunday', hours: [] }];
  const h = SA.horairesDeVinted(bh);
  dit(JSON.stringify(h) === '[{"jours":[6],"plages":[{"de":"09:00","a":"19:30"}]},{"jours":[7],"plages":[]}]', 'S1 horaires de Vinted : plages qui se touchent fondues, dimanche fermé', JSON.stringify(h));
  dit(SA.horairesDeVinted([{ weekday: 'saturday', hours: [{ opens_at_raw: '9h', closes_at_raw: '12:00' }] }]) === null && SA.horairesDeVinted([{ weekday: 'samedi', hours: [] }]) === null && SA.horairesDeVinted(null) === null, 'S2 une forme inconnue ⇒ aucun horaire (jamais un bout pris pour le tout)');
  const sam = (hh, mm) => Date.parse(`2026-11-14T${String(hh - 1).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);   // samedi, Paris = UTC+1
  dit(JSON.stringify(SA.limiteDuJour(h, sam(10, 0))) === '{"etat":"ouvert","fermeA":"19:30","maintenant":true}' && SA.limiteDuJour(h, sam(20, 0)).etat === 'passe' && SA.limiteDuJour(h, sam(8, 0)).maintenant === false, 'S3 l’heure limite à PARIS : ouvert jusqu’à 19 h 30 ; à 20 h « déjà fermé » ; à 8 h « ferme à 19 h 30 »');
  dit(SA.limiteDuJour(h, Date.parse('2026-11-15T10:00:00Z')).etat === 'ferme' && SA.limiteDuJour(h, Date.parse('2026-11-16T10:00:00Z')).etat === 'inconnu' && SA.limiteDuJour(null).etat === 'inconnu', 'S4 dimanche fermé ⇒ « fermé » ; lundi pas dit ⇒ « horaires inconnus » (jamais fermé par défaut)');
  const depart = { lat: 48.676, lon: -1.852 };
  const pts = [{ cle: 'loin', lat: 48.70, lon: -1.70 }, { cle: 'pres', lat: 48.677, lon: -1.85 }, { cle: 'sans', lat: null, lon: null }, { cle: 'milieu', lat: 48.69, lon: -1.80 }];
  const o = SA.ordreTrajet(depart, pts);
  dit(o.map((p) => p.cle).join(',') === 'pres,milieu,loin,sans' && o[3].km === null && o[0].depuis === 'depart' && o[1].depuis === 'precedent', 'S5 trajet : le plus proche de la ville, puis le plus proche du précédent ; sans position ⇒ à la fin, « distance inconnue »', o.map((p) => `${p.cle}:${p.km && p.km.toFixed(2)}`).join(' '));
  dit(SA.ordreTrajet(null, [{ cle: 'a', lat: 1, lon: 1, kmLu: 3 }, { cle: 'b', lat: 2, lon: 2, kmLu: 1 }]).map((p) => p.cle).join(',') === 'b,a', 'S6 sans ville réglée : l’ordre des distances données par Vinted');
  const depots = [{ carrier: 'Mondial Relay', points: [{ code: 'M1', nom: 'Tabac du port', adresse: '1 rue A', lat: 48.70, lon: -1.70, km: 4, horaires: h }, { code: 'M2', nom: 'Épicerie', adresse: '2 rue B', lat: 48.677, lon: -1.85, km: 0.3, horaires: null }] },
    { carrier: 'Shop2Shop by Chronopost', points: [{ code: 'S1', nom: 'Presse', adresse: '3 rue C', lat: 48.6761, lon: -1.8521, km: 0.01 }] }];
  const pj = SA.pointsDuJour({ colis: [{ cle: 'v:1', trCle: 'mondialrelay', transporteur: 'Mondial Relay' }, { cle: 'v:2', trCle: 'mondialrelay', transporteur: 'Mondial Relay' }, { cle: 'v:3', trCle: 'colissimo', transporteur: 'Colissimo' }],
    depots, retraits: [{ cle: 'r:1', lieu: 'Bar', adresse: '9 rue Z', horaires: h, lat: 48.69, lon: -1.80 }, { cle: 'r:2', lieu: 'Bar', adresse: '9 rue Z' }], depart });
  const mr = pj.find((p) => p.cle === 'depot:mondialrelay'), co = pj.find((p) => p.cle === 'depot:colissimo'), re = pj.find((p) => p.type === 'retrait');
  dit(mr && mr.code === 'M2' && mr.colis.length === 2, 'S7 dépôt : LE point le plus proche du transporteur des colis (2 colis Mondial Relay ⇒ un point)', JSON.stringify(mr));
  dit(co && !co.propose && !co.nom && !co.adresse && co.lat === null, 'S8 aucun point lu pour Colissimo ⇒ « n’importe quel point », sans adresse ni position inventées (jamais le point d’un AUTRE transporteur)', JSON.stringify(co));
  dit(re && re.colis.length === 2 && re.horaires && pj.length === 3, 'S9 retraits : un point = une carte (même nom ET adresse), ses horaires lus');
  { const j = SA.jourParis(Date.parse('2026-11-14T23:30:00Z')); dit(j === '2026-11-15' && JSON.stringify(SA.emballesDuJour({ jour: '2026-11-14', cles: { a: true } }, '2026-11-15')) === '{}' && SA.emballesDuJour({ jour: '2026-11-15', cles: { a: true, b: 1 } }, '2026-11-15').a === true && !SA.emballesDuJour({ jour: '2026-11-15', cles: { b: 1 } }, '2026-11-15').b, 'S10 les cases « Emballé » valent pour la journée de Paris seulement (et seulement `true`)'); }
  dit(JSON.stringify(SA.basculerEmballe(SA.basculerEmballe({}, 'a'), 'a')) === '{}', 'S11 une case se coche et se décoche par SON toucher (rien d’automatique)');
  { const app = sansCommentaires(lire('App.jsx')); const ms = sansCommentaires(lire('expedition/ModeSamedi.jsx'));
    dit(/const rangerColisEnvoi = \(tous\) => rapprocher\(ordreRecent\(tous, quandColisAEnvoyer\), cleRangeColis, memeAcheteurRef\.current\.groupes, memeAcheteurRef\.current\.choisis\);/.test(app), 'B3 « À envoyer », Préparer et le samedi rapprochent les colis choisis (une règle, `rangerColisEnvoi`)');
    dit(/compte: a && a\.uid === uid \? uid : ''/.test(app), 'B4 l’identité Vinted n’est prise que du détail de transaction du MÊME compte');
    dit(/<ConsignesColis site=\{c\.site\} limite=\{c\.limite \|\| ''\}\/>/.test(app) && /<RappelMemeAcheteur autres=/.test(app), 'B5 « Préparer mes colis » dit les consignes et le même acheteur, à l’emballage');
    dit(/<ModeSamedi colis=\{colisPreparer\(\)\}/.test(app) && /onImprimer: \(\) => imprimerLot\(\)/.test(app) && /deposeScan\.demander\(c\.cle, c\.geste/.test(app), 'B6 le samedi imprime par le parcours simple (`imprimerLot`) et « Déposé » est le geste d’avant (`deposeScan`)');
    dit((ms.match(/className="sb-btn-plein"/g) || []).length === 1 && !/-webkit-overflow-scrolling/.test(ms + lire('expedition/expedition.css')), 'B7 UN bouton plein dans le samedi ; aucun `-webkit-overflow-scrolling` (feuilles)');
    dit(/horaires: horairesDeVinted\(p\.business_hours\)/.test(app), 'B8 les horaires des points de dépôt viennent de Vinted (`business_hours`)'); }

  console.log(`\n${ko ? '❌' : '✅'} audit-expedition : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
