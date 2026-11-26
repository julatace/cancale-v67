#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════
//  RELANCES : JAMAIS DEUX FOIS LE MÊME TEXTE À LA MÊME PERSONNE POUR LE MÊME ARTICLE (ext. 5.441, 23 nov.)
//
//  Julien, 23 nov. : « les relances sont permises (une personne peut recevoir un nouveau message plus tard), mais jamais
//  deux fois le même texte à la même personne pour le même article ». Avant : seule la DERNIÈRE version envoyée à cet
//  acheteur était évitée, et seulement s'il en restait une autre ; avec deux versions, la 3e relance répétait la 1re.
//  On juge la règle pure (src/favorisPerso.js) ET le vrai background.js (scripts/_fond-vm.cjs) :
//   T1  règle : un texte déjà envoyé est écarté même s'il est le seul ⇒ `deja_envoye` (rien ne part) ;
//   T2  règle : il reste un texte pas encore envoyé ⇒ c'est lui ;
//   T3  fond : 1er envoi texte A, relance texte B (jamais A), 3e relance ⇒ SAUTÉ (« déjà contacté »), aucune écriture ;
//   T4  fond : une AUTRE personne, ou un AUTRE article ⇒ les textes repartent (la règle est par personne ET article) ;
//   T5  fond : registre illisible ⇒ rien ne part (« pas su » ne vaut pas « jamais envoyé »).
//  `--prouve` : mutations. Données inventées.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const { faireFond } = require('./_fond-vm.cjs');
const R = path.join(__dirname, '..');
let BG = path.join(R, 'vinted-sync-extension', 'background.js');
const MUTATIONS = {
  'dernier-seulement': ['      if (deja(v.modele)) { vuDeja = true; continue; }\n', ''],
  'pas-su-vaut-jamais': ["  if (dejaEnv === null) { noterDiag('favori_textes_envoyes_illisible'); return { ok: false, source: '', raison: 'deja_envoye', manque: [], op: null }; }", ''],
};
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouge = r.status === 1 && /❌ T/.test(r.stdout || '');
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`); if (!rouge) rate++;
  }
  process.exit(rate ? 1 : 0);
}
const mut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const s = fs.readFileSync(BG, 'utf8'), M = MUTATIONS[mut];
  if (!M || !s.includes(M[0])) { console.log('mutation introuvable'); process.exit(2); }
  const d = path.join(os.tmpdir(), `bg-relances-${process.pid}.js`); fs.writeFileSync(d, s.split(M[0]).join(M[1])); BG = d;
  process.on('exit', () => { try { fs.unlinkSync(d); } catch (_) {} });
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 500) : '')); } };
const UID = '111', JETON = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' };

function monter(store) {
  const conv = (rid, item) => ({ id: 301, opposite_user: { id: Number(rid), login: 'pseudo_banc' }, transaction: { id: 5001, item_id: Number(item) }, allow_reply: true, messages: [] });
  let cible = { rid: '201', item: '101' };
  const f = faireFond({ src: BG, connecte: UID, comptes: [ACC], lignes: {}, store: Object.assign({ __commeBleamDefaut: false }, store || {}),
    vinted: (e) => {
      if (e.methode === 'POST' && /\/api\/v2\/conversations$/.test(e.chemin)) return { status: 200, body: { conversation: conv(cible.rid, cible.item), code: 0 } };
      if (e.methode === 'GET' && /\/api\/v2\/conversations\/\d+$/.test(e.chemin)) return { status: 200, body: { conversation: conv(cible.rid, cible.item) } };
      if (e.methode === 'GET' && /\/api\/v2\/transactions\/\d+$/.test(e.chemin)) return { status: 200, body: { transaction: { id: 5001, item_id: Number(cible.item), item: { id: Number(cible.item), price: { amount: '50.0', currency_code: 'EUR' } } } } };
      if (e.methode === 'POST' && /\/replies$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      return { status: 404, body: {} };
    } });
  const fetchFond = f.ctx.fetch;
  f.ctx.fetch = async (url, o = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) {
      const c = JSON.parse(o.body || '{}');
      const j = c.action === 'consommer' ? { ok: true, uid: UID, suivi: 's', travail: { itemId: cible.item, recipientId: cible.rid, initiator: 'native-fixture', aimes: 1, message: 'Bonjour, il est toujours dispo !', variantes: ['Salut, je peux faire un geste si tu veux.'] } } : { ok: true, autorise: true, uid: UID };
      return { ok: true, status: 200, json: async () => j };
    }
    return fetchFond(url, o);
  };
  f.ctx.notifierApp = async () => {};
  f.cible = (rid, item) => { cible = { rid, item }; };
  return f;
}
const textes = (f) => f.j.vinted.filter((v) => v.methode === 'POST' && /replies$/.test(v.chemin)).map((v) => { try { return JSON.parse(v.corps).reply.body; } catch (_) { return String(v.corps || ''); } });
const jouer = (f) => f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON }).catch((e) => ({ erreur: String(e && e.stack || e) }));

(async () => {
  const P = await import(pathToFileURL(path.join(R, 'src', 'favorisPerso.js')).href);
  const choisir = P.choisirMessageFavori;
  const base = { ancien: { message: 'Bonjour A', variantes: ['Salut B'] }, fav: {}, ctx: {}, hasard: () => 0 };
  const r1 = choisir(Object.assign({}, base, { deja: (m) => m === 'Bonjour A' || m === 'Salut B' }));
  dit(r1.ok === false && r1.raison === 'deja_envoye', 'T1 règle : tous les textes déjà envoyés à cette personne pour cet article ⇒ « deja_envoye », rien ne part', JSON.stringify(r1));
  const r2 = choisir(Object.assign({}, base, { deja: (m) => m === 'Bonjour A' }));
  dit(r2.ok === true && r2.version.modele === 'Salut B', 'T2 règle : il reste un texte jamais envoyé ⇒ c’est lui', JSON.stringify(r2 && r2.version));

  const f = monter();
  const a = await jouer(f), b = await jouer(f), c = await jouer(f);
  const t = textes(f);
  dit(a.json && a.json.resultat === 'envoye' && b.json && b.json.resultat === 'envoye' && t.length === 2 && t[0] !== t[1], 'T3 1er envoi puis relance : deux textes DIFFÉRENTS', JSON.stringify({ a: a.json, b: b.json, t }));
  dit(c.json && c.json.resultat === 'ignore' && c.json.raison === 'conversation_deja_contactee' && textes(f).length === 2, 'T3 3e relance (plus aucun texte neuf) ⇒ SAUTÉE, aucun message écrit', JSON.stringify({ c: c.json, n: textes(f).length }));
  f.cible('202', '101'); const d = await jouer(f);
  f.cible('201', '102'); const e = await jouer(f);
  dit(d.json && d.json.resultat === 'envoye' && e.json && e.json.resultat === 'envoye', 'T4 une autre personne, ou un autre article ⇒ les textes repartent', JSON.stringify({ d: d.json, e: e.json }));

  const g = monter({ vrmFavTextesEnvoyes: 'illisible' });
  const gl = g.ctx.chrome.storage.local.get;
  g.ctx.chrome.storage.local.get = async (k) => { if (k === 'vrmFavTextesEnvoyes' || (Array.isArray(k) && k.includes('vrmFavTextesEnvoyes'))) throw new Error('lecture KO'); return gl(k); };
  const h = await jouer(g);
  dit(h.json && h.json.resultat !== 'envoye' && textes(g).length === 0, 'T5 registre illisible ⇒ rien ne part (« pas su » ≠ « jamais envoyé »)', JSON.stringify({ h: h.json, n: textes(g).length }));
  console.log(`\n${ko ? '❌' : '✅'} relances sans le même texte : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
