// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « REPUBLIÉE DANS L'APP VINTED » (15 nov., lot numeros-masquees, point 3)
//  Julien : « imagine que la personne publie sur l'app Vinted et ne lie pas l'extension
//  directement après », « quand VRM reconnaît la photo qu'elle a modifiée, elle attribue
//  le numéro ». Une republication faite entièrement dans l'app Vinted ne laisse AUCUNE
//  identité « qui remplace qui » et des fichiers photo NEUFS : la nouvelle annonce
//  recevait un N° NEUF, le carton porte l'ancien.
//  Le morceau de numérotation d'App.jsx est EXÉCUTÉ (scripts/_numerotation-vm.cjs) avec
//  la vraie règle (src/republieTelephone.js) et la vraie reprise (src/repriseNumero.js) :
//   1. ancienne disparue (vue en ligne puis absente), nouvelle sans lien, même empreinte
//      ⇒ AUCUN N° neuf, « N°42 republiée ? » proposée, l'attente notée ;
//      SON « Oui » (le lien de `vrm_repub_main`) ⇒ l'ancien N° repris ;
//      SON « Non » ⇒ N° neuf ;
//   2. autre paire du même modèle (empreinte différente) ⇒ N° neuf ;
//      aucune disparue sur le compte ⇒ N° neuf tout de suite ;
//      empreinte pas encore captée ⇒ attente, au plus 24 h, puis N° neuf ;
//   3. LA PHOTO FABRIQUÉE PAR VRM (registre) : 50 paires du même modèle, chacune republiée
//      avec SA photo ⇒ chacune reprend SON N°, aucune celui d'une autre, dit une fois ;
//      ancienne encore en ligne, deux N°, N° porté par une vente ⇒ proposé, jamais repris ;
//   4. « je numérote moi-même » : le N° écrit dans la description fait foi, rien demandé.
//  `--src <arbre>` · `--mutation=<nom>|toutes` (§6.1).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { charger, passageAvec, empreinte, voisine } = require('./_numerotation-vm.cjs');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);

const MUTATIONS = {
  attente: ['src/App.jsx', "if (dr.action === 'attendre' || dr.action === 'proposer') {", 'if (false) {'],
  seuil: ['src/republieTelephone.js', 'export const SEUIL_PHOTO_VRM = 8;', 'export const SEUIL_PHOTO_VRM = 40;'],
  deuxNumeros: ['src/republieTelephone.js', 'if (cands.length === 1) {', 'if (cands.length >= 1) {'],
  enLigne: ['src/republieTelephone.js', 'if (!presente && !ailleurs && !vendu && c.id)', 'if (!ailleurs && !vendu && c.id)'],
  vendu: ['src/republieTelephone.js', 'if (!presente && !ailleurs && !vendu && c.id)', 'if (!presente && !ailleurs && c.id)'],
  borne: ['src/republieTelephone.js', "const attendre = () => (now < jusqua ? { action: 'attendre', jusqua, raison: 'empreintes' } : { action: 'neuf', raison: 'attente-finie' });", "const attendre = () => ({ action: 'attendre', jusqua, raison: 'empreintes' });"],
  coexistence: ['src/republieTelephone.js', 'd.vuLe >= creee + MARGE_COEXISTENCE_MS));', 'd.vuLe >= creee + MARGE_COEXISTENCE_MS && false));'],
  coexistenceTrop: ['src/republieTelephone.js', 'd.vuLe >= creee + MARGE_COEXISTENCE_MS));', 'd.vuLe >= creee + MARGE_COEXISTENCE_MS || true));'],
  reponse: ['src/republieTelephone.js', "if (rep && rep.choix === 'non') return { action: 'neuf', raison: 'reponse' };", ''],
  lecture: ['src/App.jsx', '    if (empreintesVinted === undefined) return;\n', ''],
  dire: ['src/App.jsx', 'if (reconnusNum.length) direNumerosReconnus(reconnusNum);', ''],
  journee: ['src/App.jsx', "if (modeNum === 'vrm' && propositionsRepub.length) {", 'if (false) {'],
};

if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : [MUT];
  let attrapees = 0;
  for (const nom of noms) {
    const m = MUTATIONS[nom]; if (!m) { console.log(`❌ mutation inconnue : ${nom}`); continue; }
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-rt-'));
    for (const d of ['src', 'api/_lib']) fs.cpSync(path.join(RACINE, d), path.join(t, d), { recursive: true, filter: (f) => !/node_modules|\.zip$|\.png$|\.woff2?$|\.jpg$/.test(f) });
    const p = path.join(t, m[0]); const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(m[1])) { console.log(`❌ mutation ${nom} : ancre introuvable dans ${m[0]}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, src.replace(m[1], m[2]));
    const r = spawnSync(process.execPath, [__filename, '--src', t], { encoding: 'utf8', timeout: 180000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0; if (ok) attrapees++;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${ok ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  console.log(attrapees === noms.length ? `\n✅ ${attrapees}/${noms.length} mutations attrapées` : `\n❌ ${noms.length - attrapees} mutation(s) non attrapée(s)`);
  process.exit(attrapees === noms.length ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  const L = await charger(RACINE);
  dit(!!L.corps && !L.manque.length, 'App.jsx porte la numérotation et ses fonctions', L.manque.join(', '));
  dit(!!L.RT, 'src/republieTelephone.js existe (la règle)');
  if (!L.corps || L.manque.length || !L.N || !L.R) { console.log(`\n❌ Republiée : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }
  const MAINT = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const A = '3156028798';
  const acc = { vinted_user_id: A };
  const ann = (id, title, o = {}) => ({ id: String(id), title, photo: `https://images1.vinted.net/t/02_${id}/f800/${id}.jpeg`, _acc: acc, t: MAINT - 12 * 3600e3 + (Number(String(id).slice(-4)) || 0), ...o });   // (19 nov.) créée APRÈS la dernière vue de l'ancienne (2 j)
  const pool = Array.from({ length: 216 }, (_, i) => i + 1);
  const P = (x) => { const r = passageAvec(L, x); if (r.erreur) dit(false, 'le morceau s’exécute', r.erreur); return r; };
  const num = (r, id) => (r.fiches && r.fiches[id] && r.fiches[id].numero) || null;
  const essaie = (nom, f) => { try { f(); } catch (e) { dit(false, `${nom} s’exécute`, String(e && e.message).slice(0, 140)); } };
  const lu = MAINT - 60e3;
  // L'ancienne paire N°42 (annonce 10600000042), vue en ligne il y a 2 jours, supprimée dans l'app Vinted ;
  // la nouvelle (10700000042) n'a aucun lien. Les empreintes : celle de l'ancienne GARDÉE par VRM, celle de la
  // nouvelle captée par l'extension (`photo_emprunte_{uid}`).
  const hA = empreinte(42);
  const base = (o = {}) => ({
    items: [ann('10700000042', 'adidas spezial bleu marine 42,5'), ann('10800000001', 'Autre en ligne')],
    fiches: { 10600000042: { numero: '42', title: 'adidas spezial bleu marine 42,5', accountId: A, auto: true, photo: 'https://images1.vinted.net/t/02_x/f800/old.jpeg' }, 10800000001: { numero: '100', accountId: A, auto: true } },
    pool, complets: { [A]: true }, lues: { [A]: lu },
    store: { vrm_vus_en_ligne: { 10600000042: iso(MAINT - 2 * 86400e3), 10800000001: iso(MAINT - 3600e3) }, vrm_empreintes_fiches: { 10600000042: { n: '42', h: [hA], uid: A, at: iso(MAINT - 2 * 86400e3) } }, ...(o.store || {}) },
    empreintes: { [`vinted:${A}`]: { 10700000042: { k1: o.hNouvelle !== undefined ? o.hNouvelle : voisine(hA, 6, 8, 3) } } },
    ...o.x,
  });

  console.log('— 1. Republiée dans l’app Vinted (ancienne disparue, même photo)');
  essaie('1', () => {
    const r = P(base());
    dit(!num(r, '10700000042'), 'AUCUN N° neuf pour la nouvelle annonce', JSON.stringify(r.fiches['10700000042']));
    dit(!r.pool.includes(217), '… aucun N° brûlé (217 reste libre)');
    const pr = (r.propositions || []).find((p) => p.id === '10700000042');
    dit(!!pr && pr.candidats.length === 1 && pr.candidats[0].numero === '42' && pr.candidats[0].id === '10600000042', '« N°42 republiée ? » est PROPOSÉE (l’ancienne N°42, par sa photo)', JSON.stringify(pr));
    dit((r.attente || []).includes('10700000042'), '… et l’attente est notée (la borne de 24 h vaut pour tous ses appareils)');
    // SON « Oui » : le lien nouvelle → ancienne (`vrm_repub_main`), la table qu'en fait l'app.
    const liens = L.AA && L.AA.liensRepubMain ? L.AA.liensRepubMain({ 10600000042: { nouvelId: '10700000042', num: '42' } }, { presentes: new Set(), dejaRecrees: {} }) : { 10700000042: '10600000042' };
    const o = P({ ...base(), recrees: liens });
    dit(num(o, '10700000042') === '42' && o.fiches['10700000042'].recreeDe === '10600000042' && !o.fiches['10700000042'].nouveau, 'SON « Oui, garder N°42 » ⇒ la nouvelle annonce reprend N°42 (rien à écrire sur le carton)', JSON.stringify(o.fiches['10700000042']));
    const n = P(base({ store: { vrm_republie_reponses: { 10700000042: { choix: 'non', anciens: ['10600000042'], at: iso(MAINT) } } } }));
    dit(num(n, '10700000042') === '217' && n.fiches['10700000042'].nouveau, 'SON « Non, c’est un autre article » ⇒ N° neuf (217), « à écrire »', JSON.stringify(n.fiches['10700000042']));
  });

  console.log('— 2. Ce qui ne change rien (N° neuf)');
  essaie('2', () => {
    const d = P(base({ hNouvelle: voisine(hA, 18, 20, 5) }));
    dit(num(d, '10700000042') === '217' && !(d.propositions || []).length, 'une autre paire du même modèle (photo différente) ⇒ N° neuf tout de suite, rien proposé', JSON.stringify({ f: d.fiches['10700000042'], a: d.attente, p: d.propositions, e: d.erreur }));
    const sans = P(base({ store: { vrm_vus_en_ligne: { 10800000001: iso(MAINT - 3600e3) } } }));
    dit(num(sans, '10700000042') === '217', 'aucune disparue sur ce compte ⇒ N° neuf tout de suite (comme avant)', JSON.stringify(sans.fiches['10700000042']));
    const vendue = P(base({ x: { saleOv: { 999: { numero: '42' } } } }));
    dit(num(vendue, '10700000042') === '217', 'l’ancienne VENDUE (une vente porte N°42) n’est pas une disparue ⇒ N° neuf', JSON.stringify(vendue.fiches['10700000042']));
    // (19 nov., mesuré : 4 annonces en ligne depuis 6 à 10 jours attendaient 24 h à cause d'une disparue vue APRÈS leur mise en ligne.)
    const vieille = P({ ...base(), items: [ann('10700000042', 'adidas spezial bleu marine 42,5', { t: MAINT - 10 * 86400e3 }), ann('10800000001', 'Autre en ligne')], empreintes: { [`vinted:${A}`]: {} } });
    dit(num(vieille, '10700000042') === '217' && !(vieille.attente && vieille.attente['10700000042']), 'annonce mise en ligne AVANT la dernière vue de la disparue (elles ont coexisté) ⇒ N° neuf tout de suite, aucune attente', JSON.stringify({ f: vieille.fiches['10700000042'], a: vieille.attente }));
    const pasCapte = P({ ...base(), empreintes: { [`vinted:${A}`]: {} } });
    dit(!num(pasCapte, '10700000042') && (pasCapte.attente || []).includes('10700000042'), 'empreinte de la nouvelle pas encore captée ⇒ elle ATTEND (pas de N° neuf)');
    const fini = P(base({ hNouvelle: '', store: { vrm_republie_attente: { 10700000042: iso(MAINT - 25 * 3600e3) } } }));
    dit(num(fini, '10700000042') === '217', '… au-delà de 24 h d’attente ⇒ N° neuf (la règle normale)', JSON.stringify(fini.fiches['10700000042']));
    const autreCompte = P({ ...base(), items: [ann('10700000042', 'x', { _acc: { vinted_user_id: '111' } })], complets: { 111: true }, lues: { 111: lu } });
    dit(num(autreCompte, '10700000042') === '217', 'une disparue d’un AUTRE compte ne retient rien', JSON.stringify(autreCompte.fiches['10700000042']));
  });

  console.log('— 3. La photo fabriquée par VRM (registre : une identité)');
  essaie('3', () => {
    // 50 paires du MÊME modèle : chacune a SA photo fabriquée par VRM (proches du modèle, loin entre elles), puis
    // republiée dans l'app Vinted (Vinted recompresse : quelques bits changent).
    const modele = empreinte(7);
    const items = [], fiches = {}, registre = {}, emp = {}, vus = {};
    for (let i = 0; i < 50; i++) {
      const h = voisine(modele, 12, 16, 100 + i);
      const ancien = String(10610000000 + i), nouveau = String(10710000000 + i), n = String(11 + i);
      fiches[ancien] = { numero: n, title: 'Nike Air Max 90 blanche 42', accountId: A, auto: true };
      registre[h] = { n, src: ancien, uid: A, at: iso(MAINT - 3 * 86400e3) };
      vus[ancien] = iso(MAINT - 86400e3);
      items.push(ann(nouveau, 'Nike Air Max 90 blanche 42', { t: 3000 + i }));
      emp[nouveau] = { k1: voisine(h, 3, 4, 900 + i) };
    }
    const r = P({ items, fiches, pool: Array.from({ length: 60 }, (_, i) => i + 1), complets: { [A]: true }, lues: { [A]: lu }, store: { vrm_photos_vrm: registre, vrm_vus_en_ligne: vus }, empreintes: { [`vinted:${A}`]: emp } });
    const pris = items.map((it, i) => num(r, it.id) === String(11 + i));
    dit(pris.every(Boolean), '50 paires du même modèle, republiées avec leur photo VRM ⇒ chacune reprend SON N° (11…60)', items.map((it) => num(r, it.id)).slice(0, 6).join(','));
    dit(new Set(items.map((it) => num(r, it.id))).size === 50 && !r.pool.includes(61), '… aucune celui d’une autre, aucun N° neuf');
    dit((r.reconnus || []).length === 50 && items.every((it) => r.fiches[it.id] && r.fiches[it.id].recreeOrigine === 'photo-vrm'), '… et c’est DIT (« N°… reconnu par sa photo »), une fois', String((r.reconnus || []).length));
    const r2 = P({ items, fiches: r.fiches, pool: r.pool, complets: { [A]: true }, lues: { [A]: lu }, store: { vrm_photos_vrm: registre, vrm_vus_en_ligne: vus }, empreintes: { [`vinted:${A}`]: emp } });
    dit(!(r2.reconnus || []).length, 'un second passage ne redit rien');
    const avantLecture = P({ items: [items[0]], fiches, pool: Array.from({ length: 60 }, (_, i) => i + 1), complets: { [A]: true }, lues: { [A]: lu }, store: { vrm_photos_vrm: registre }, empreintesPasLues: true });
    dit(!num(avantLecture, items[0].id) && !avantLecture.pool.includes(61), 'empreintes pas encore lues : la numérotation ATTEND (jamais un N° neuf avant de pouvoir reconnaître la photo VRM)', JSON.stringify(avantLecture.fiches && avantLecture.fiches[items[0].id]));
    // L'ancienne encore en ligne : ce n'est pas une republication ⇒ proposé.
    const h0 = Object.keys(registre)[0];
    const enL = P({ items: [items[0], ann('10610000000', 'Nike Air Max 90 blanche 42')], fiches, pool: Array.from({ length: 60 }, (_, i) => i + 1), complets: { [A]: true }, lues: { [A]: lu }, store: { vrm_photos_vrm: registre, vrm_vus_en_ligne: vus }, empreintes: { [`vinted:${A}`]: emp } });
    dit(!num(enL, items[0].id) && (enL.propositions || []).some((p) => p.id === items[0].id && p.raison === 'origine-presente'), 'l’annonce d’origine encore en ligne ⇒ jamais repris, PROPOSÉ (son clic)', JSON.stringify(enL.fiches[items[0].id]));
    const deux = P({ items: [items[0]], fiches, pool: Array.from({ length: 60 }, (_, i) => i + 1), complets: { [A]: true }, lues: { [A]: lu }, store: { vrm_photos_vrm: { ...registre, [voisine(h0, 1, 0, 77)]: { n: '99', src: '10699999999', uid: A, at: iso(MAINT) } }, vrm_vus_en_ligne: vus }, empreintes: { [`vinted:${A}`]: emp } });
    dit(!num(deux, items[0].id) && (deux.propositions || []).some((p) => p.id === items[0].id && p.candidats.length === 2), 'deux N° du registre pour la même photo ⇒ proposé (il choisit), jamais repris', JSON.stringify((deux.propositions || [])[0] || null).slice(0, 160));
    const vendu = P({ items: [items[0]], fiches, pool: Array.from({ length: 60 }, (_, i) => i + 1), complets: { [A]: true }, lues: { [A]: lu }, saleOv: { 5: { numero: '11' } }, store: { vrm_photos_vrm: registre, vrm_vus_en_ligne: vus }, empreintes: { [`vinted:${A}`]: emp } });
    dit(!num(vendu, items[0].id) || num(vendu, items[0].id) !== '11', 'un N° que porte une VENTE n’est jamais repris par la photo', JSON.stringify(vendu.fiches[items[0].id]));
    const renum = P({ items: [items[0], ann('10610000000', 'Nike Air Max 90 blanche 42')], fiches: { ...fiches, 10610000000: { ...fiches['10610000000'], numero: '99' } }, pool: Array.from({ length: 99 }, (_, i) => i + 1), complets: { [A]: true }, lues: { [A]: lu }, store: { vrm_photos_vrm: registre, vrm_vus_en_ligne: vus }, empreintes: { [`vinted:${A}`]: emp } });
    dit(!num(renum, items[0].id) && (renum.propositions || []).some((p) => p.id === items[0].id && p.raison === 'origine-presente'), '… même si sa fiche porte aujourd’hui un autre N° (l’origine est là : on demande)', JSON.stringify(renum.fiches[items[0].id]));
    const non = P({ items: [items[0]], fiches, pool: Array.from({ length: 60 }, (_, i) => i + 1), complets: { [A]: true }, lues: { [A]: lu }, store: { vrm_photos_vrm: registre, vrm_vus_en_ligne: vus, vrm_republie_reponses: { [items[0].id]: { choix: 'non', anciens: [], at: iso(MAINT) } } }, empreintes: { [`vinted:${A}`]: emp } });
    dit(num(non, items[0].id) === '61', 'SON « Non » l’emporte aussi sur la photo VRM ⇒ N° neuf (61)', JSON.stringify(non.fiches[items[0].id]));
    const RT = L.RT;
    dit(RT && RT.ajouterAuRegistre({}, [{ h: h0, n: '11', src: '1', uid: A }], MAINT)[h0].n === '11' && RT.ajouterAuRegistre({ [h0]: { n: '11', src: '1', uid: A, at: iso(MAINT - 61 * 86400e3) } }, [], MAINT)[h0] === undefined, 'le registre : l’empreinte et le N° (jamais l’image), purgé après 60 jours');
  });

  console.log('— 4. « Je numérote moi-même » : inchangé');
  essaie('4', () => {
    const r = P({ ...base(), moi: true, items: [ann('10700000042', 'adidas spezial', { desc: 'Très bon état.\nN° 42' })] });
    dit(num(r, '10700000042') === '42' && !(r.propositions || []).length, 'republiée avec « N° 42 » en fin de description ⇒ N°42 repris, rien demandé', JSON.stringify(r.fiches['10700000042']));
  });

  console.log('— 5. Ma journée, la feuille, les clés');
  essaie('5', () => {
    const APP = sansCommentaires(L.APP);
    dit(/if \(modeNum === 'vrm' && propositionsRepub\.length\) \{[\s\S]{0,600}id: 'numeros-republiee'[\s\S]{0,400}avant: ouvrirPropositionsRepub/.test(APP), 'Ma journée : « N°42 republiée ? » ouvre la feuille');
    dit(/<RepublieeHost\/>/.test(APP) && /data-rt-avant=/.test(APP) && /data-rt-maintenant=/.test(APP) && /data-rt-oui=/.test(APP) && /data-rt-non=/.test(APP), 'la feuille : AVANT / MAINTENANT côte à côte, « Oui, garder N°… », « Non, c’est un autre article »');
    dit(/const repondreRepubliee = \(pr, cand\) => \{[\s\S]{0,900}k: 'vrm_repub_main'[\s\S]{0,900}k: CLE_REPUB_REPONSES/.test(APP), '« Oui » pose le lien de « Republier à la main », « Non » sa réponse — par SON clic seulement');
    dit(/if \(reconnusNum\.length\) direNumerosReconnus\(reconnusNum\);/.test(APP) && /function direNumerosReconnus\(liste\) \{[\s\S]{0,600}accompagner\('numero\.reconnu'[\s\S]{0,200}alerteLocale\(/.test(APP), '« N°42 reconnu par sa photo » est DIT (bandeau, notification si l’app est en arrière-plan)');
    const sk = (APP.match(/const SYNC_KEYS\s*=\s*\[[\s\S]*?\];/) || [''])[0];
    dit(['vrm_photos_vrm', 'vrm_empreintes_fiches', 'vrm_republie_reponses', 'vrm_republie_attente'].every((k) => sk.includes(`'${k}'`)), 'registre, empreintes gardées, réponses et attente : synchronisés');
    // (20 nov., décision de Julien) « Créer sur Vinted » se fait dans le PANNEAU de l'extension : ses photos produites arrivent par
    // `photo_vrm_{uid}` (l'extension les range), versées au registre par `verserPhotosVrmExtension` — l'atelier de l'app est retiré.
    dit(/async function verserPhotosVrmExtension\(\)[\s\S]{0,900}ajouterAuRegistre\(load\(CLE_PHOTOS_VRM, \{\}\), entrees\)/.test(APP) && !fs.existsSync(path.join(RACINE, 'src/CreerSurVinted.jsx')),
      '« Créer sur Vinted » (dans l’extension) : les photos produites entrent au registre par `photo_vrm_*`, avec le N°');
    const rep = sansCommentaires(fs.readFileSync(path.join(RACINE, 'src/ecrans/Republier.jsx'), 'utf8'));
    dit(/registre\.push\(\{ h, n: String\(numero\)/.test(rep) && /ajouterAuRegistre\(load\(CLE_PHOTOS_VRM, \{\}\), registre\)/.test(rep), 'chaque photo PRODUITE pour un N° (feuille guidée, kit, « Publier à la main ») entre au registre');
  });

  console.log(ko ? `\n❌ Republiée : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ Republiée : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
