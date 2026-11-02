#!/usr/bin/env node
// Audit (1er nov., X2 · X3 · X8) : les messages aux favoris, sur le VRAI
// `executerMessageFavori` (background.js dans un vm, `_fond-vm.cjs`).
//
// X2 — une offre DEMANDÉE qui n'est pas faite (Vinted la refuse, le prix ne se
//      lit pas, réponse incertaine) ⇒ le message « je t'ai fait une offre »
//      ne part PAS ; le résultat est « refusé » (ou « incertain ») avec la raison.
// X3 — un favori = 2 ou 3 écritures chez Vinted (conversation, offre, message) :
//      toutes COMPTÉES, réservées AVANT la première sous `RESERVE_GESTES` (la file
//      s'arrête à 45, les 5 dernières restent à SES clics) ; plafond plein ⇒ rien
//      n'est créé chez Vinted ; les places non servies sont rendues.
// X8 — `rendreActions` rend SES horodatages, pas ceux d'un autre geste.
// `--src <background.js>` : le code d'avant (§6.1). `--prouve` : mutations.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const UID = '111', JETON = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const acc = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' };

const MUTATIONS = {
  une_action: (s) => s.replace('const nA=offre?3:2;', 'const nA=1;'),
  sans_reserve: (s) => s.replace('{reserve:RESERVE_GESTES,actions:nA,recu}', '{actions:nA,recu}'),
  offre_ignoree: (s) => s.replace("    if(!offreFaite)return (o.status>=400&&o.status<500)||(o.ok&&!offreFaite)?rep('refuse',o.status,'offre_refusee'):rep('incertain',o.status,'offre_incertaine');\n", ''),
  prix_ignore: (s) => s.replace("    if(!prix){noterDiag('favori_offre_prix_inconnu');return rep('refuse',0,'offre_prix_inconnu');}\n", "    if(!prix){noterDiag('favori_offre_prix_inconnu');}else{\n").replace("    if(!offreFaite)return (o.status", "    }\n    if(false)return (o.status"),
  rendre_recent: (s) => s.replace('      for (let i = 0; i < l.length && k > 0;) { if (l[i] === d) { l.splice(i, 1); k--; } else i++; }\n      for (let i = 0; i < l.length && k > 0;) { if (l[i] >= d) { l.splice(i, 1); k--; } else i++; }',
    '      for (let i = l.length - 1; i >= 0 && k > 0; i--) if (l[i] >= d) { l.splice(i, 1); k--; }'),
};

function monter(src, { offreStatus = 200, actionsDeja = 0, message = 'Bonjour {username}, je t’ai fait une offre !', offre = { mode: 'pct', valeur: 10, arrondi: false }, prixLisible = true } = {}) {
  const conv = () => ({ id: 301, opposite_user: { id: 201, login: 'acheteuse' }, transaction: { id: 5001, item_id: 101 }, allow_reply: true, messages: [] });
  const t = Date.now();
  const store = { vrmActions: { [UID]: Array.from({ length: actionsDeja }, (_, i) => t - 1000 - i) } };
  const f = faireFond({ src, connecte: UID, store, vinted: (e) => {
    if (e.methode === 'POST' && /\/api\/v2\/conversations$/.test(e.chemin)) return { status: 200, body: { conversation: conv(), code: 0 } };
    if (e.methode === 'GET' && /\/api\/v2\/transactions\/\d+$/.test(e.chemin)) return { status: 200, body: { transaction: { id: 5001, item_id: 101, item: prixLisible ? { id: 101, price: { amount: '50.0', currency_code: 'EUR' } } : { id: 101 } } } };
    if (e.methode === 'POST' && /offers$/.test(e.chemin)) return { status: offreStatus, body: offreStatus === 200 ? { code: 0 } : { code: 99, message: 'refus' } };
    if (e.methode === 'POST' && /replies$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
    return { status: 404, body: {} };
  } });
  const ff = f.ctx.fetch;
  f.ctx.fetch = async (url, o = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) {
      const c = JSON.parse(o.body || '{}');
      const j = c.action === 'consommer' ? { ok: true, uid: UID, suivi: 's', travail: { itemId: '101', recipientId: '201', initiator: 'native-fixture', message, ...(offre ? { offre } : {}) } } : { ok: true, autorise: true, uid: UID };
      return { ok: true, status: 200, json: async () => j };
    }
    return ff(url, o);
  };
  f.ctx.authToken = async () => ({ access_token: 'session' }); f.ctx.notifierApp = async () => {}; f.ctx.__vrmPausesVues = [];
  return f;
}

async function lancer(src) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
  const ecrits = (f) => f.j.vinted.filter((v) => v.methode !== 'GET').map((v) => v.chemin.replace(/\d+/g, '#'));
  const compte = async (f) => (((await f.ctx.chrome.storage.local.get('vrmActions')).vrmActions || {})[UID] || []).length;
  const essai = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — a levé', e.message); } };

  console.log('X3 — chaque écriture comptée, réservée avant la première');
  await essai('A', async () => {
    const f = monter(src); const r = await f.ctx.executerMessageFavori(UID, acc, { jeton: JETON });
    dit(r.json && r.json.resultat === 'envoye', 'favori avec offre : envoyé', JSON.stringify(r.json));
    dit(ecrits(f).length === 3 && (await compte(f)) === 3, 'conversation + offre + message = 3 écritures, 3 actions comptées', `${ecrits(f).length} écrites · ${await compte(f)} comptées`);
  });
  await essai('A2', async () => {
    const f = monter(src, { offre: null, message: 'Bonjour {username} !' }); const r = await f.ctx.executerMessageFavori(UID, acc, { jeton: JETON });
    dit(r.json && r.json.resultat === 'envoye' && ecrits(f).length === 2 && (await compte(f)) === 2, 'favori sans offre : 2 écritures, 2 actions comptées', `${JSON.stringify(r.json)} · ${ecrits(f).length} · ${await compte(f)}`);
  });
  await essai('C', async () => {
    const f = monter(src, { actionsDeja: 43 }); const r = await f.ctx.executerMessageFavori(UID, acc, { jeton: JETON });
    dit(r.json && r.json.resultat === 'refuse' && r.json.raison === 'quota_extension' && ecrits(f).length === 0, '43 actions déjà : un favori à 3 écritures dépasserait 45 ⇒ refusé « plafond », RIEN chez Vinted', `${JSON.stringify(r.json)} · ${ecrits(f).length} écriture(s)`);
    dit((await compte(f)) === 43, 'le compteur n\'a pas bougé', String(await compte(f)));
    const g = await f.ctx.gardeStricte(UID, acc, {});
    dit(g === null, 'une réponse à un acheteur (son clic) passe encore : la réserve de 5 tient', g && g.code);
  });
  await essai('C2', async () => {
    const f = monter(src, { actionsDeja: 42 }); const r = await f.ctx.executerMessageFavori(UID, acc, { jeton: JETON });
    dit(r.json && r.json.resultat === 'envoye' && (await compte(f)) === 45, '42 actions déjà : le favori passe et s\'arrête pile à 45', `${JSON.stringify(r.json)} · ${await compte(f)}`);
  });
  await essai('D', async () => {
    const f = monter(src, { actionsDeja: 50 }); const r = await f.ctx.executerMessageFavori(UID, acc, { jeton: JETON });
    dit(r.json && r.json.resultat === 'refuse' && ecrits(f).length === 0, 'plafond plein (50/50) : aucune conversation créée chez Vinted', `${JSON.stringify(r.json)} · ${JSON.stringify(ecrits(f))}`);
  });

  console.log('X2 — une offre demandée et pas faite : AUCUN message');
  for (const [st, attendu, raison] of [[422, 'refuse', 'offre_refusee'], [500, 'incertain', 'offre_incertaine']]) {
    await essai('B' + st, async () => {
      const f = monter(src, { offreStatus: st }); const r = await f.ctx.executerMessageFavori(UID, acc, { jeton: JETON });
      const repondu = f.j.vinted.some((v) => /replies$/.test(v.chemin));
      dit(!repondu, `Vinted répond ${st} à l'offre ⇒ le message « je t'ai fait une offre » n'est PAS envoyé`, repondu ? 'envoyé' : '');
      dit(r.json && r.json.resultat === attendu && r.json.raison === raison, `résultat « ${attendu} », raison ${raison}`, JSON.stringify(r.json));
      dit((await compte(f)) === 2, 'la place du message (pas parti) est rendue : 2 actions comptées', String(await compte(f)));
    });
  }
  await essai('B-prix', async () => {
    const f = monter(src, { prixLisible: false }); const r = await f.ctx.executerMessageFavori(UID, acc, { jeton: JETON });
    const repondu = f.j.vinted.some((v) => /replies$/.test(v.chemin)), offert = f.j.vinted.some((v) => /offers$/.test(v.chemin));
    dit(!repondu && !offert, 'prix de l\'article illisible ⇒ ni offre ni message', `offre ${offert} · message ${repondu}`);
    dit(r.json && r.json.resultat === 'refuse' && r.json.raison === 'offre_prix_inconnu', 'résultat « refusé », raison offre_prix_inconnu', JSON.stringify(r.json));
    dit((await compte(f)) === 1, 'seule la conversation (partie) reste comptée', String(await compte(f)));
  });

  console.log('X8 — on rend SES places');
  await essai('E', async () => {
    const f = monter(src);
    const t0 = Date.now() - 60000, tAutre = Date.now() - 1000;
    await f.ctx.chrome.storage.local.set({ vrmActions: { [UID]: [t0, t0, t0, tAutre] } });
    await f.ctx.rendreActions(UID, t0, 2);
    const l = (((await f.ctx.chrome.storage.local.get('vrmActions')).vrmActions || {})[UID] || []).slice().sort((a, b) => a - b);
    dit(l.length === 2 && l[0] === t0 && l[1] === tAutre, 'rendre 2 places réservées à t0 : l\'action d\'un AUTRE geste (plus récente) reste', JSON.stringify(l.map((x) => x === t0 ? 't0' : x === tAutre ? 'autre' : x)));
  });
  return ko;
}

(async () => {
  const src = fs.readFileSync(cheminSource(), 'utf8');
  if (!process.argv.includes('--prouve')) {
    const tmp = path.join(os.tmpdir(), `bg-favoris-${process.pid}.js`); fs.writeFileSync(tmp, src);
    const ko = await lancer(tmp); try { fs.unlinkSync(tmp); } catch (_) {}
    console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ un favori ne dépasse jamais le plafond et ne promet jamais une offre absente');
    process.exit(ko ? 1 : 0);
  }
  let toutes = true;
  for (const [nom, mut] of Object.entries(MUTATIONS)) {
    const m = mut(src);
    console.log(`\n════ mutation « ${nom} »`);
    if (m === src) { console.log('  ❌ la mutation ne s\'applique plus'); toutes = false; continue; }
    const tmp = path.join(os.tmpdir(), `bg-favoris-${process.pid}-${nom}.js`); fs.writeFileSync(tmp, m);
    let k; try { k = await lancer(tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
    console.log(`  → ${k ? `ROUGE (${k})` : 'VERTE — pas attrapée'}`);
    if (!k) toutes = false;
  }
  console.log(toutes ? '\n✅ chaque réaffaiblissement est attrapé' : '\n❌ une mutation passe au vert');
  process.exit(toutes ? 0 : 1);
})();
