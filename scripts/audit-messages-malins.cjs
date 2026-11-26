// ════════════════════════════════════════════════════════════════════════════
//  DES MESSAGES AUX FAVORIS « PLUS MALINS » (20 nov., extension 5.410 — `messagesmalins`)
//
//  Julien : « plus d'intelligence […] pareil pour l'envoi des messages ».
//  Mesuré (vraie base, lecture seule, 20 nov., file des favoris de son compte) : 17 envoyés,
//  2 refusés par Vinted (`vinted_refus`, réponse non gardée), 2 arrêtés par l'anti-robot,
//  2 sautés (déjà en conversation), 39 annulés par lui.
//
//  On EXÉCUTE le vrai background.js (`_fond-vm.cjs` : faux Vinted de la forme de Vinted, fausse
//  base à état) et la vraie file serveur (api/_lib/favoris-file.js). Données inventées.
//    M1  un texte que la règle « les mots qui font bannir » refuse (téléphone) : RIEN ne part chez Vinted
//    M2  une version sûre est tirée parmi SES versions, la dangereuse jamais
//    M3  une version que Vinted a refusée n'est plus jamais tirée sur ce compte
//    M4  Vinted refuse le message (400) : classé « texte refusé », la version retenue, la suivante change
//    M5  annonce vendue (dressing) : favori SAUTÉ, 0 requête, la file continue
//    M6  offre sous le prix mini posé dans VRM : ni offre ni message ; au-dessus : l'offre part
//    M7  Vinted refuse d'ouvrir la conversation (422) : sauté, rien écrit
//    M8  un frein (429) sur le message n'est jamais pris pour un refus de texte
//    M9  la file : un refus de texte avec d'autres versions continue (2 au plus), sinon arrêt dit ;
//        un favori sauté ne l'arrête pas ; le bilan « 12 envoyés · 2 sautés (…) · 1 pas envoyé : … » (5.440.1 : un mot par état)
//    M10 la copie de la règle dans l'extension est celle de src/messageSur.js (fabriquée par script)
//  `--prouve` : rouge sur origin/main ET par mutation.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SRC = arg('--src') ? path.resolve(arg('--src')) : path.join(RACINE, 'vinted-sync-extension', 'background.js');
const SRV = arg('--srv') || RACINE;
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; if (!process.env.SILENCE) console.log('✅ ' + m); } else { ko++; if (!process.env.SILENCE) console.log('❌ ' + m + (d ? '  → ' + d : '')); } };
const UID = '111', JETON = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' };
const nowISO = () => new Date().toISOString();

function monter({ message = 'Bonjour ! Elle est toujours dispo.', variantes = null, pourcentage = null, listings = null, min = null, creation = 200, reponse = 200, store = {} } = {}) {
  const conv = { id: 301, opposite_user: { id: 201, login: 'acheteur' }, transaction: { id: 5001, item_id: 101 }, allow_reply: true, messages: [] };
  const lignes = { main: { capturedAt: nowISO(), vinted_annonce_numeros: { '101': { numero: '12', ...(min != null ? { min } : {}) } } } };
  if (listings) lignes[`harvest_${UID}_listings`] = { capturedAt: nowISO(), payload: { items: listings } };
  const f = faireFond({ src: SRC, lignes, connecte: UID, store,
    vinted: (e) => {
      if (e.methode === 'POST' && /\/api\/v2\/conversations$/.test(e.chemin)) return creation === 200 ? { status: 200, body: { conversation: conv, code: 0 } } : { status: creation, body: { code: 99, message: 'refus de test' } };
      if (e.methode === 'GET' && /\/api\/v2\/conversations\/301$/.test(e.chemin)) return { status: 200, body: { conversation: conv } };
      if (e.methode === 'GET' && /\/api\/v2\/transactions\/\d+$/.test(e.chemin)) return { status: 200, body: { transaction: { id: 5001, item_id: 101, item: { id: 101, price: { amount: '50.0', currency_code: 'EUR' } } } } };
      if (e.methode === 'POST' && /\/offers$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      if (e.methode === 'POST' && /\/replies$/.test(e.chemin)) { const s = typeof reponse === 'function' ? reponse(e) : reponse; return s === 200 ? { status: 200, body: { code: 0 } } : { status: s, body: { code: 99, message: 'Message refusé', errors: [{ field: 'body', value: 'refus de test' }] } }; }
      return { status: 404, body: {} };
    } });
  const fetchFond = f.ctx.fetch;
  f.ctx.fetch = async (url, o = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) {
      const c = JSON.parse(o.body || '{}');
      // 5.441 : chaque envoi de la série est une AUTRE personne (le banc garde le même fil) : le registre « déjà envoyé à
      //   cette personne pour cet article » est vidé à chaque autorisation — on juge ici la rotation, pas la règle de relance.
      if (c.action === 'consommer' && f.store) delete f.store.vrmFavTextesEnvoyes;
      const j = c.action === 'consommer' ? { ok: true, uid: UID, suivi: 's', travail: { itemId: '101', recipientId: '201', initiator: 'native-fixture', message, ...(variantes ? { variantes } : {}), ...(pourcentage != null ? { pourcentage } : {}) } } : { ok: true, autorise: true, uid: UID };
      return { ok: true, status: 200, json: async () => j };
    }
    return fetchFond(url, o);
  };
  f.ctx.authToken = async () => ({ access_token: 'session', user_id: 'owner-banc' });
  f.ctx.notifierApp = async () => {};
  return f;
}
const seq = (j) => j.vinted.map((v) => /conversations$/.test(v.chemin) ? 'C' : /offers$/.test(v.chemin) ? 'O' : /replies$/.test(v.chemin) ? 'R' : /transactions\/\d+$/.test(v.chemin) ? 'T' : /conversations\/\d+$/.test(v.chemin) ? 'L' : '?').join('');
const corpsReponse = (j) => { const r = j.vinted.filter((v) => /replies$/.test(v.chemin)).pop(); try { return JSON.parse(r.corps).reply.body; } catch (_) { return null; } };
const envoyer = (f) => f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON }).catch((e) => ({ erreur: String(e && e.message) }));

async function auditer() {
  // M1 — texte refusé par la règle : rien ne part
  { const f = monter({ message: 'Bonjour, appelle-moi au 06 12 34 56 78 !' }); const r = await envoyer(f);
    dit(f.j.vinted.length === 0 && r && r.json && r.json.resultat === 'refuse' && r.json.raison === 'texte_interdit' && r.json.ecrits === 0, 'M1 — un numéro de téléphone dans le message : AUCUNE requête chez Vinted, « texte_interdit », 0 écriture', seq(f.j) + ' ' + JSON.stringify(r && r.json)); }
  // M2 — une version sûre parmi les siennes
  { let tous = true; for (let i = 0; i < 12; i++) { const f = monter({ message: 'Écris-moi sur WhatsApp pour un prix', variantes: ['Bonjour ! Toujours dispo si tu veux.'] }); const r = await envoyer(f); const b = corpsReponse(f.j); if (!(r && r.ok && b && !/whats/i.test(b))) { tous = false; break; } }
    dit(tous, 'M2 — sur 12 envois, seule la version sûre part (celle qui renvoie sur WhatsApp jamais)'); }
  // M3 / M4 — refus du texte par Vinted : la version est retenue, la suivante change
  { const store = {};
    const f1 = monter({ message: 'Bonjour ! Toujours dispo si tu veux.', variantes: ['Hello ! Elle t’attend encore.'], reponse: 400, store });
    const r1 = await envoyer(f1); const b1 = corpsReponse(f1.j);
    dit(r1 && r1.json && r1.json.resultat === 'refuse' && r1.json.raison === 'texte_refuse', 'M4 — Vinted refuse le message (400) : classé « texte_refuse » (pas un refus muet)', JSON.stringify(r1 && r1.json));
    const ret = (store.vrmVersionsRefusees || {})[UID] || [];
    dit(ret.length === 1 && !JSON.stringify(ret).includes('dispo') && !JSON.stringify(ret).includes('attend'), 'M4b — la version refusée est retenue par son EMPREINTE (jamais le texte)', JSON.stringify(ret));
    let change = true;
    for (let i = 0; i < 8; i++) { const f2 = monter({ message: 'Bonjour ! Toujours dispo si tu veux.', variantes: ['Hello ! Elle t’attend encore.'], store }); await envoyer(f2); const b2 = corpsReponse(f2.j); const base = (x) => String(x || '').replace(/^(Bonjour|Salut|Hello)\s*!?\s*/i, ''); if (!b2 || base(b2) === base(b1)) { change = false; break; } }
    dit(change, 'M3 — ensuite, la version refusée n’est plus jamais tirée (8 envois sur 8 : l’autre version)'); }
  // M5 — annonce vendue : sauté, rien chez Vinted
  { const f = monter({ listings: [{ id: 101, is_closed: true, item_closing_action: 'sold' }] }); const r = await envoyer(f);
    dit(f.j.vinted.length === 0 && r && r.ok && r.json.resultat === 'ignore' && r.json.raison === 'annonce_indisponible', 'M5 — annonce vendue : favori SAUTÉ (rien chez Vinted), la file peut continuer', seq(f.j) + ' ' + JSON.stringify(r && r.json)); }
  // M6 — offre sous le prix mini (5.410.8 : remontée au prix mini, Julien : « comme Bleam »)
  { const f = monter({ pourcentage: 10, min: '48' }); const r = await envoyer(f);
    const off = f.j.vinted.filter((v) => /offers$/.test(v.chemin)).map((v) => { try { return JSON.parse(v.corps).offer.price; } catch (_) { return null; } });
    dit(/OR$/.test(seq(f.j)) && off.length === 1 && Number(off[0]) === 48 && r && r.json && r.json.resultat === 'envoye', 'M6 — 5.410.8 : offre de 45 € sous le prix mini (48 €) : REMONTÉE à 48 €, puis le message (jamais sous le prix mini)', seq(f.j) + ' ' + JSON.stringify(off) + ' ' + JSON.stringify(r && r.json));
    const g = monter({ pourcentage: 10, min: '40' }); const r2 = await envoyer(g);
    dit(/O.*R/.test(seq(g.j)) && r2 && r2.ok && r2.json.resultat === 'envoye', 'M6b — prix mini 40 € : l’offre (45 €) et le message partent', seq(g.j)); }
  // M7 — conversation refusée
  { const f = monter({ creation: 422 }); const r = await envoyer(f);
    dit(seq(f.j) === 'C' && r && r.json && r.json.resultat === 'ignore' && r.json.raison === 'conversation_refusee', 'M7 — Vinted refuse d’ouvrir la conversation (422) : sauté, rien écrit', seq(f.j) + ' ' + JSON.stringify(r && r.json)); }
  // M8 — frein 429 sur le message
  { const store = {}; const f = monter({ reponse: 429, store }); const r = await envoyer(f);
    dit(r && r.json && r.json.raison !== 'texte_refuse' && !((store.vrmVersionsRefusees || {})[UID] || []).length, 'M8 — un 429 sur le message est un frein, jamais un « texte refusé » (la version n’est pas retenue)', JSON.stringify(r && r.json)); }

  // M9 — la file serveur et le bilan
  { const F = await import(path.join(SRV, 'api', '_lib', 'favoris-file.js'));
    const P = await import(path.join(SRV, 'src', 'favorisProgression.js'));
    const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', T = 1_800_000_000_000;
    const cibles = (n) => Array.from({ length: n }, (_, i) => ({ notificationId: 'n' + i, itemId: String(1000 + i), recipientId: String(2000 + i), initiator: 'x' }));
    const tour = (d, k, resultat, raison) => { d = F.reserverFile(d, { owner, maintenant: T + k * 1000, jeton: 'j' + k }).data; d = F.consommerFile(d, { owner, jeton: 'j' + k, maintenant: T + k * 1000 + 10 }).data; const t = F.terminerFile(d, { owner, jeton: 'j' + k, resultat, raison, ecrits: resultat === 'ignore' ? 0 : 1, maintenant: T + k * 1000 + 20 }); return t; };
    const avance = (d) => { const g = d.groupes[owner]; g.prochain = 0; d.prochainGlobal = 0; return d; };
    { let d = F.lancerFile(null, { owner, targets: cibles(6), message: 'Bonjour', variantes: ['Salut'], intervalleMinutes: 0, maintenant: T }).data;
      let t = tour(d, 1, 'refuse', 'texte_refuse'); d = avance(t.data);
      dit(t.valeur.active === true && /autres versions/.test(t.valeur.raison), 'M9a — refus de texte avec d’autres versions : la file CONTINUE, c’est dit', JSON.stringify({ a: t.valeur.active, r: t.valeur.raison }));
      t = tour(d, 2, 'refuse', 'texte_refuse'); d = avance(t.data); t = tour(d, 3, 'refuse', 'texte_refuse');
      dit(t.valeur.active === false, 'M9b — au 3e refus de texte du lot : la file s’arrête (jamais de boucle)', JSON.stringify({ a: t.valeur.active, r: t.valeur.raison })); }
    { let d = F.lancerFile(null, { owner, targets: cibles(2), message: 'Bonjour', intervalleMinutes: 0, maintenant: T }).data;
      const t = tour(d, 1, 'refuse', 'texte_refuse');
      dit(t.valeur.active === false && /Vinted a refusé ce texte/.test(t.valeur.raison), 'M9c — refus de texte SANS autre version : arrêt, la raison et le geste dits', t.valeur.raison); }
    { let d = F.lancerFile(null, { owner, targets: cibles(15), message: 'Bonjour', variantes: ['Salut'], intervalleMinutes: 0, maintenant: T }).data;
      let k = 0, t;
      for (const [res, rai] of [...Array(2)].map(() => ['ignore', 'annonce_indisponible']).concat([['refuse', 'texte_refuse']], [...Array(12)].map(() => ['envoye', '']))) { k++; t = tour(d, k, res, rai); d = avance(t.data); if (k === 1) dit(t.valeur.active === true, 'M9d — un favori sauté (annonce vendue) n’arrête pas la file', JSON.stringify({ a: t.valeur.active })); }
      const ph = P.phraseBilanFavoris((t.valeur.fin && t.valeur.fin.bilan) || t.valeur.bilan);
      dit(ph === '12 envoyés · 2 sautés (vendus ou indisponibles) · 1 pas envoyé : texte refusé par Vinted', 'M9e — le bilan : « 12 envoyés · 2 sautés (vendus ou indisponibles) · 1 pas envoyé : texte refusé par Vinted »', ph);
      const b2 = P.bilanFavoris([{ etat: 'refuse', raison: 'texte_interdit' }, { etat: 'envoye' }]);
      dit(/1 pas envoyé : texte contenant un lien/.test(P.phraseBilanFavoris(b2)), 'M9f — un texte interdit est nommé dans le bilan (« texte contenant un lien, un e-mail… »)', P.phraseBilanFavoris(b2)); } }

  // M10 — la copie de la règle
  { let rc = 0; try { cp.execFileSync(process.execPath, [path.join(__dirname, 'recopier-message-sur.cjs'), '--verifier'], { stdio: 'pipe' }); } catch (e) { rc = e.status || 1; }
    const s = fs.readFileSync(SRC, 'utf8'); const { fabriquer } = require('./recopier-message-sur.cjs'); const voulu = fabriquer(fs.readFileSync(path.join(RACINE, 'src', 'messageSur.js'), 'utf8'));
    dit(rc === 0 && s.includes(voulu), 'M10 — la règle de l’extension est la copie FABRIQUÉE de src/messageSur.js (jamais modifiée à la main)'); }

  console.log(`\n${ko ? '❌' : '✅'} audit-messages-malins : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
}

// ── --prouve : rouge sur origin/main et par mutation (chaque règle réaffaiblie dans une copie) ──
const MUTATIONS = [
  ['versions non filtrées', 'bg', 'const envoyables=versionsEnvoyables(versionsMessage(body.message,body.variantes),refuseesIci);', 'const envoyables=versionsMessage(body.message,body.variantes);'],
  ['règle toujours d’accord', 'bg', "function texteSurVinted(texte) { const r = MESSAGE_SUR.risquesMessage(texte, 'vinted');", "function texteSurVinted(texte) { const r = [];"],
  ['version refusée oubliée', 'bg', 'async function noterVersionRefusee(uid, texte) {', 'async function noterVersionRefusee(uid, texte) { return;'],
  ['refus de texte muet', 'bg', "return rep('refuse',r.status,'texte_refuse');}", "return rep('refuse',r.status);}"],
  ['offre sous le prix mini', 'bg', "if (pl && c < pl.c) { c = pl.c; noterDiag('favori_offre_remontee_plancher'); }", ''],
  ['message sur article vendu', 'bg', "function annonceIndisponible(it, suppIds, id) {", "function annonceIndisponible(it, suppIds, id) { return '';"],
  ['frein pris pour un texte', 'bg', "if(!r.ok&&[400,422].includes(r.status)&&!frein)", 'if(!r.ok&&r.status>=400)'],
  ['file arrêtée au refus de texte', 'srv', "const autreVersion=!j.auto&&", 'const autreVersion=false&&!j.auto&&'],
  ['refus de texte sans fin', 'srv', '(Number(g.refusTexte)||0)<2;', 'true;'],
  ['sauté arrête la file', 'srv', "'tout_arrete','trop_tard','annonce_indisponible','texte_interdit','texte_refuse','offre_sous_plancher','conversation_refusee'];", "'tout_arrete','trop_tard','texte_interdit','texte_refuse'];"],
  ['copie de la règle retouchée', 'bg', "const RE_PAIEMENT = /\\bpay ?pal\\b|", "const RE_PAIEMENT = /"],
];
function copieServeur(dir, depuisGit) {
  if (depuisGit) cp.execSync(`git archive ${depuisGit} api/_lib src | tar -x -C ${JSON.stringify(dir)}`, { cwd: RACINE, maxBuffer: 256 * 1024 * 1024 });
  else { fs.mkdirSync(path.join(dir, 'api', '_lib'), { recursive: true }); cp.execSync(`cp -r api/_lib/. ${JSON.stringify(path.join(dir, 'api', '_lib'))} && cp -r src ${JSON.stringify(dir)}`, { cwd: RACINE }); }
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
}
const lancer = (args) => { try { cp.execFileSync(process.execPath, [__filename, ...args], { stdio: 'pipe', env: { ...process.env, SILENCE: '1' }, maxBuffer: 1 << 26 }); return 'vert'; } catch (e) { return 'rouge'; } };
function prouver() {
  const res = [];
  { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'malins-avant-'));
    try { fs.writeFileSync(path.join(dir, 'bg.js'), cp.execSync('git show origin/main:vinted-sync-extension/background.js', { cwd: RACINE, maxBuffer: 1 << 28 })); copieServeur(dir, 'origin/main'); res.push(['origin/main (avant)', lancer(['--src', path.join(dir, 'bg.js'), '--srv', dir])]); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); } }
  for (const [nom, f, de, vers] of MUTATIONS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'malins-mut-'));
    try {
      if (f === 'bg') { const s0 = fs.readFileSync(SRC, 'utf8'); if (!s0.includes(de)) { res.push([nom, 'motif absent']); continue; } fs.writeFileSync(path.join(dir, 'bg.js'), s0.replace(de, vers)); res.push([nom, lancer(['--src', path.join(dir, 'bg.js')])]); }
      else { copieServeur(dir, null); const p = path.join(dir, 'api', '_lib', 'favoris-file.js'), s0 = fs.readFileSync(p, 'utf8'); if (!s0.includes(de)) { res.push([nom, 'motif absent']); continue; } fs.writeFileSync(p, s0.replace(de, vers)); res.push([nom, lancer(['--srv', dir])]); }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  let bon = true; for (const [n, r] of res) { if (r !== 'rouge') bon = false; console.log(`${r === 'rouge' ? '✅' : '❌'} --prouve · ${n} : ${r}`); }
  console.log(bon ? `✅ --prouve : ${res.length}/${res.length} rouges` : '❌ --prouve : une version affaiblie passe encore');
  process.exit(bon ? 0 : 1);
}
if (process.argv.includes('--prouve')) prouver(); else auditer();
