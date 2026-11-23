// ════════════════════════════════════════════════════════════════════════════
//  LEBONCOIN : UNE OFFRE REÇUE DANS UN FIL (22 nov., ext. 5.435 — Julien, choix 2c)
//  ⚠️ Aucune offre Leboncoin n'a jamais été MESURÉE : la capture l'apprendra. Ce contrôle charge le VRAI `lbc-inject.js`
//  dans Chromium (faux leboncoin.fr, compte privé lu, tout inventé) et juge ce qui sort en `lbcfil` :
//   O1 un message qui DIT être une offre (`type: "offer"`, ou un objet `priceProposal`) ⇒ une offre (n° du message, date,
//      « de toi » = faux) ; le montant en centimes seulement si l'unité est dans le NOM de la clé (`amountCents`) ;
//   O2 un message ordinaire qui parle de prix (« 40 € ? ») n'est PAS une offre (jamais par ressemblance du texte) ;
//   O3 montant sans unité écrite (`price: 40`) ⇒ offre sans montant (null), jamais supposé ;
//   O4 la FORME de la 1re offre (chemins de clés) part, sans nom ni avatar de l'autre personne ;
//   O5 ma propre offre : « de toi » = vrai.
//  `--prouve` : chaque mutation rend le contrôle rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const argv = process.argv.slice(2);
const EXT = path.join(__dirname, '..', 'vinted-sync-extension');
const MUTATIONS = {
  marque: ["if (CLE_TYPE_OFFRE_LBC.test(k) && typeof v === 'string' && v.length <= 60 && MOT_OFFRE_LBC.test(v.replace(/[_-]+/g, ' '))) marque = true;", "if (typeof v === 'string' && /€|offre|propos/i.test(v)) marque = true;"],
  unite: ["if (/cent/i.test(k) && /(amount|price|prix|montant|value|offer)/i.test(k) && Number.isInteger(v) && v > 0 && v < 1e8) return v;", "if (/(amount|price|prix|montant|value|offer)/i.test(k) && Number.isInteger(v) && v > 0 && v < 1e8) return v;"],
  joint: ["      if (!CLE_JOINT_LBC.test(k) || SANS_PERSONNE_LBC.test(k)) continue;", "      continue;"],
  personne: [".filter((c) => !SANS_PERSONNE_LBC.test(c.split(':')[0])).slice(0, 60);", ".slice(0, 60);"],
};
if (argv.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 180000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
const mut = (argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let inj = fs.readFileSync(argv.includes('--inj') ? path.resolve(argv[argv.indexOf('--inj') + 1]) : path.join(EXT, 'lbc-inject.js'), 'utf8');
if (mut) { const [a, b] = MUTATIONS[mut]; if (!inj.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); } inj = inj.split(a).join(b); }
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + String(det).slice(0, 400) : ''}`); } };
const U1 = '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b', U2 = '7c1d0e2f-1111-4222-8333-944455556666';
const CONV = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const URL_FIL = `https://api.leboncoin.fr/api/messaging/proxy/api/hal/${U1}/conversations/${CONV}/messages`;
const PERSO = ['Acheteur Test', 'avatar.exemple.test', 'acheteur@exemple.test'];
(async () => {
  let nav;
  try {
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    nav = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
    const c = await nav.newContext(); const p = await c.newPage();
    await c.route('https://www.leboncoin.fr/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>x</body></html>' }));
    await c.route('https://api.leboncoin.fr/**', async (r) => {
      const u = r.request().url(); let body = {};
      if (/\/api\/account\/v1\/members\/me\/account$/.test(u)) body = { account: { account_id: U1, type: 'private', email: 'acheteur@exemple.test' }, member: { account_id: U1, nickname: { value: 'Julien P' } } };
      else if (u === URL_FIL) body = { conversation_id: CONV, partner: { name: 'Acheteur Test', avatar: 'https://avatar.exemple.test/a.png' }, _embedded: { messages: [
        { id: 'm1', text: 'Bonjour, 40 € ça irait ?', createdAt: '2026-11-21T08:00:00Z', author: { id: U2, name: 'Acheteur Test' } },
        { id: 'm2', text: 'Offre envoyée', type: 'price_offer', createdAt: '2026-11-21T08:01:00Z', author: { id: U2, name: 'Acheteur Test' }, offer: { amountCents: 4000, status: 'pending' } },
        { id: 'm3', text: 'Proposition', createdAt: '2026-11-21T08:02:00Z', author: { id: U2 }, attachment: { attachmentType: 'PRICE_PROPOSAL', price: 40 } },
        { id: 'm4', text: 'Ma contre-offre', type: 'counter_offer', createdAt: '2026-11-21T08:03:00Z', author: { id: U1 }, offer: { amount_cents: 4500 } },
        { id: 'm5', text: 'Merci', type: 'text', createdAt: '2026-11-21T08:04:00Z', author: { id: U2 } }] } };
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://www.leboncoin.fr', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
    });
    await p.goto('https://www.leboncoin.fr/messages/id/' + CONV);
    await p.addScriptTag({ content: 'window.__msgs=[];window.addEventListener("message",(e)=>{if(e.data&&e.data.__tag==="CANCALE_LBC")window.__msgs.push(e.data);});' });
    await p.addScriptTag({ content: inj });
    await p.evaluate(() => window.postMessage({ __tag: 'CANCALE_LBC_RELAY', kind: 'pret' }, '*'));
    const H = { 'x-lbc-auth': 'jeton-banc', 'content-type': 'application/json' };
    await p.evaluate(async ([h, uf]) => {
      await fetch('https://api.leboncoin.fr/api/account/v1/members/me/account', { headers: h }).then((r) => r.text());
      await fetch(uf, { headers: h }).then((r) => r.text());
    }, [H, URL_FIL]);
    await p.waitForTimeout(500);
    if (process.env.DBG) console.log(JSON.stringify(await p.evaluate(() => window.__msgs.map((m) => m.kind))));
    const fil = (await p.evaluate(() => window.__msgs.filter((m) => m.kind === 'lbcfil')))[0];
    dit(!!fil && fil.conv === CONV && Array.isArray(fil.offres), 'le fil part avec la liste de ses offres', JSON.stringify(fil && Object.keys(fil)));
    const O = (id) => ((fil && fil.offres) || []).find((x) => x.id === id);
    dit(O('m2') && O('m2').c === 4000 && O('m2').deMoi === false && /2026-11-21T08:01/.test(O('m2').at) && O('m2').s === 'pending', 'O1 `type: price_offer` + `offer.amountCents` ⇒ offre de 4 000 centimes, de l’autre personne, datée, statut', JSON.stringify(O('m2')));
    dit(!O('m1') && !O('m5'), 'O2 un message qui PARLE de prix (« 40 € ça irait ? ») n’est pas une offre ; `type: text` non plus', JSON.stringify(fil && fil.offres));
    dit(O('m3') && O('m3').c === null, 'O3 un objet joint `PRICE_PROPOSAL` avec `price: 40` (unité pas écrite) ⇒ offre SANS montant', JSON.stringify(O('m3')));
    dit(O('m4') && O('m4').deMoi === true && O('m4').c === 4500, 'O5 ma contre-offre : « de toi » = vrai', JSON.stringify(O('m4')));
    const forme = (fil && fil.formeOffre) || [];
    dit(forme.length > 0 && forme.some((k) => /offer/.test(k)), 'O4 la forme de la 1re offre part (chemins de clés)', JSON.stringify(forme));
    const s = JSON.stringify(fil || {});
    dit(!PERSO.some((x) => s.includes(x)) && !forme.some((k) => /^(author\.name|partner)/i.test(k)), 'O4 ni nom, ni avatar, ni e-mail de l’autre personne (forme comprise)', PERSO.filter((x) => s.includes(x)).join(',') + ' ' + JSON.stringify(forme));
    dit(fil && fil.messages.length === 5, 'les messages du fil restent tous là (une offre ne retire rien)', fil && fil.messages.length);
  } catch (e) { dit(false, 'le contrôle a tourné jusqu’au bout', e && e.stack); }
  finally { if (nav) await nav.close(); }
  console.log(`\n${ko ? '❌' : '✅'} audit-lbc-offres : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
