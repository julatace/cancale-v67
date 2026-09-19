// ════════════════════════════════════════════════════════════════════════════
//  « LE BOUTON TÉLÉCHARGER MES DONNÉES ME RENVOIE SUR "COMPTE BLOQUÉ" »
//  Demande de Julien, 19 septembre. Son compte PRO Vinted est bloqué et il a
//  besoin de l'export de ses données pour le récupérer.
//
//  ⚠️⚠️ CE QUE JE NE PEUX PAS FAIRE, ET POURQUOI JE NE L'INVENTE PAS.
//  Mesuré sur sa base : sur les **41 chemins d'API** que son extension a
//  observés en tout, **aucun** ne concerne un export. Je n'ai donc JAMAIS vu
//  cet endpoint. Écrire un appel vers une adresse devinée, c'est exactement ce
//  que ce dossier interdit partout — et ici ça se ferait depuis la session d'un
//  compte déjà bloqué, c'est-à-dire au pire endroit possible.
//  ⇒ C'est SON navigateur qui mesure et qui me rapporte, comme pour le
//    formulaire eBay et les étapes Leboncoin : *faire mesurer par ce qui y a
//    accès.*
//
//  ⚠️⚠️ ET LA MESURE QUI MANQUAIT EST LE **STATUT**. Deux situations très
//  différentes se ressemblent de l'extérieur :
//    · la requête d'export PART et le serveur la refuse (403) ⇒ aucun
//      contournement côté navigateur ne servira, la voie écrite est la seule ;
//    · la requête ne part JAMAIS parce que c'est seulement la page qui redirige
//      ⇒ la donnée est peut-être atteignable.
//  Le mouchard notait le chemin et PAS le statut : les deux cas étaient
//  indistinguables. Et il ignorait tout ce qui n'est pas `/api/`, donc une page
//  de réglages ne laissait aucune trace du tout.
//
//  ⚠️ §4.10 : `node --check` ne voit rien de ça. On CHARGE `inject.js` dans une
//  vraie page et on regarde ce qu'il ENVOIE.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require(require('path').join(__dirname, '..', 'node_modules', 'playwright'));
const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'inject.js'), 'utf8');

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => {
  if (bon) { ok++; console.log(`✅ ${quoi}`); }
  else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); }
};
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const ctx = await nav.newContext();
  const pg = await ctx.newPage();
  // ⚠️ §6.6 : le fourre-tout D'ABORD, les routes précises ENSUITE — Playwright
  //    prend la dernière enregistrée en premier.
  await pg.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>page</body></html>' }));
  // La page de réglages où vit le bouton, telle qu'il la décrit : elle répond,
  // mais la requête d'export se fait REFUSER par le serveur.
  await pg.route('**/api/v2/data_export**', (r) => r.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"account_blocked"}' }));
  await pg.route('**/api/v2/inbox**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"conversations":[]}' }));
  await pg.goto('https://www.vinted.fr/parametres/donnees-personnelles', { waitUntil: 'domcontentloaded' });

  // On rejoue le pont : `inject.js` poste ses messages par `window.postMessage`.
  await pg.evaluate(() => {
    window.__vus = [];
    window.addEventListener('message', (e) => {
      const d = e && e.data;
      if (d && d.kind === 'seen_urls') window.__vus.push(d);
    });
  });
  await pg.addScriptTag({ content: SRC });

  await essaie('le clic sur le bouton', async () => {
    // Ce que fait le bouton : une requête d'export, plus un appel banal à côté.
    await pg.evaluate(async () => {
      try { await fetch('/api/v2/data_export?scope=all&email=julien@exemple.fr', { method: 'POST', body: JSON.stringify({ secret: 'ne-doit-pas-partir' }) }); } catch (_) {}
      try { await fetch('/api/v2/inbox?page=1'); } catch (_) {}
      // et en XHR, parce que Vinted utilise les deux
      await new Promise((res) => { const x = new XMLHttpRequest(); x.open('POST', '/api/v2/data_export/2214455667'); x.onloadend = res; x.onerror = res; x.send('rien'); });
    });
    await pg.waitForTimeout(6000);
    const vus = await pg.evaluate(() => window.__vus || []);
    dit(vus.length > 0, 'le mouchard envoie son relevé', `${vus.length} envoi(s)`);
    const dernier = vus[vus.length - 1] || {};
    const chemins = dernier.paths || [];
    const rep = dernier.reponses || {};

    // 1. LE STATUT — c'est toute la raison de cette passe.
    const cles = Object.keys(rep);
    const exp = cles.filter((k) => /data_export/.test(k));
    dit(exp.length > 0, 'la requête d’export est relevée avec sa MÉTHODE', exp.join(' · '));
    dit(exp.some((k) => rep[k] && rep[k].st === 403),
      'et avec son CODE DE RÉPONSE — c’est lui qui dit si le serveur refuse',
      JSON.stringify(exp.map((k) => k + '→' + (rep[k] || {}).st)));
    dit(cles.some((k) => /inbox/.test(k) && rep[k].st === 200),
      'un appel qui réussit est relevé avec son 200 (sinon on ne distingue rien)');
    // ⚠️ L'AUTRE SENS : *ne rien relever* passerait les contrôles d'absence.
    dit(cles.length >= 2, 'plusieurs appels distincts sont relevés', `${cles.length} clés`);

    // 2. LA PAGE elle-même — sans elle on ne sait même pas qu'il y est passé.
    dit(chemins.some((p) => /donnees-personnelles|parametres/.test(p)),
      'la PAGE de réglages est relevée, pas seulement les appels /api/', JSON.stringify(chemins));

    // 3. LA CONFIDENTIALITÉ : chemin, méthode, statut — et RIEN d'autre.
    const brut = JSON.stringify(dernier);
    dit(!/ne-doit-pas-partir/.test(brut), 'le CORPS de la requête ne part pas');
    dit(!/julien@exemple\.fr/.test(brut), 'les PARAMÈTRES d’URL ne partent pas (ni son adresse)');
    dit(!/2214455667/.test(brut) && /\{id\}/.test(brut),
      'et les identifiants réels sont remplacés par {id}',
      JSON.stringify(cles.filter((k) => /data_export/.test(k))));
  });

  await ctx.close(); await nav.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge.' : `✅ ${ok} contrôles : son clic me dira l’endpoint ET si le serveur refuse.`}`);
  process.exit(ko ? 1 : 0);
})();
