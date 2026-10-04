// ⚠️⚠️ CONTRÔLE PERMANENT — LA MESSAGERIE LEBONCOIN : UN NOMBRE, JAMAIS UN TEXTE.
//
// Julien, 4 octobre : « dans Leboncoin, il y ait les messages ». Mesuré : aucune
// conversation captée, mais la page recharge elle-même un compteur de non-lus
// par compte. L'extension (5.153) relaie CE NOMBRE — et rien d'autre.
//
// Ce contrôle charge le VRAI `lbc-inject.js` dans un vrai navigateur, sur une page
// servie sous le nom de leboncoin.fr, et regarde TOUT ce qui en sort :
//   · le compteur part, avec son identifiant de compte et son nombre — et pas
//     d'autre champ ;
//   · le TEXTE d'une conversation (qui contient « annonce », « owner »,
//     « subject » : les mots qui la faisaient relayer en `lbcraw`) ne sort JAMAIS ;
//   · le jeton de connexion temps réel ne sort jamais, même pas ses clés ;
//   · les comptes liés partent SANS email ;
//   · un UUID dans un chemin devient `{uuid}` (il partait à moitié en clair).
// Sur le code d'avant : le compteur ne partait pas, et le texte de la
// conversation partait en entier (preuve par le comportement, §6.1).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs = require('fs'), path = require('path');
const racine = path.join(__dirname, '..');
const INJ = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'lbc-inject.js'), 'utf8');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };

const U1 = '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b';
const CONV = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const COMPTEUR = JSON.stringify({ userId: U1, unread: 4, pollingTime: 30000 });
const CONVERSATION = JSON.stringify({ conversation_id: CONV, unseen_counter: 2,
  item: { id: '2900001', subject: 'Nike Air Max taille 42', owner_id: U1, status: 'active', url: 'https://www.leboncoin.fr/ad/x/2900001' },
  partners: [{ name: 'Acheteur Test', id: 'p-9' }],
  messages: [{ text: 'SECRET-MESSAGE bonjour, l\'annonce est toujours dispo ? owner ok', author: 'Acheteur Test' }] });
const CREDENTIALS = JSON.stringify({ xmppJid: 'jid@x', token: 'TOKEN-SECRET-123', websocketUrl: 'wss://x' });
const COMPTES = JSON.stringify({ linked_accounts: [{ user_id: U1, email: 'moi@exemple.test', display_name: 'Julien P', is_business_user: true, unread_notifications: 2 }] });

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
    const pg = await b.newPage();
    // Fourre-tout d'abord, routes précises ensuite (§6.6 : la dernière gagne).
    await pg.route('https://www.leboncoin.fr/**', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' }));
    await pg.route('https://api.leboncoin.fr/**', (r) => {
      const u = r.request().url();
      const body = /\/counter\//.test(u) ? COMPTEUR : /realtime\/credentials/.test(u) ? CREDENTIALS : /linked_accounts/.test(u) ? COMPTES : /conversations/.test(u) ? CONVERSATION : '{}';
      r.fulfill({ status: 200, contentType: 'application/json', body });
    });
    await pg.goto('https://www.leboncoin.fr/messages');
    await pg.evaluate(`window.__tout = []; window.addEventListener('message', (e) => { const d = e.data; if (d && d.__tag === 'CANCALE_LBC') window.__tout.push(d); });`);
    await pg.evaluate(INJ);
    await pg.evaluate(`(async () => {
      await fetch('https://api.leboncoin.fr/api/messaging/proxy/api/hal/${U1}/counter/').then(r => r.text());
      await fetch('https://api.leboncoin.fr/api/messaging/proxy/api/messaging-items-api/v3/conversations/${CONV}').then(r => r.text());
      await fetch('https://api.leboncoin.fr/api/messaging/realtime/credentials').then(r => r.text());
      await fetch('https://api.leboncoin.fr/api/authenticator/v1/users/me/linked_accounts').then(r => r.text());
    })()`);
    await pg.waitForTimeout(5000);                 // le relevé des chemins part toutes les 4 s
    const tout = await pg.evaluate('window.__tout');
    const texte = JSON.stringify(tout);

    const cpt = tout.filter((d) => d.kind === 'lbcmsgcompteur');
    dit(cpt.length === 1 && cpt[0].userId === U1 && cpt[0].unread === 4, 'le nombre de non-lus part, avec le compte', JSON.stringify(cpt));
    dit(cpt.length === 1 && Object.keys(cpt[0]).sort().join(',') === '__tag,kind,unread,userId', 'et rien d\'autre que ce nombre (ni « pollingTime », ni autre champ)', cpt[0] ? Object.keys(cpt[0]).join(',') : '');
    dit(!/SECRET-MESSAGE/.test(texte), '⚠️ le TEXTE d\'une conversation ne quitte jamais la page', /SECRET-MESSAGE/.test(texte) ? 'un message client est parti' : '');
    dit(!tout.some((d) => d.kind === 'lbcraw' && /messaging/.test(String(d.url || ''))), 'aucune réponse de messagerie n\'est relayée comme « annonce » (lbcraw)');
    dit(!/TOKEN-SECRET/.test(texte), 'le jeton temps réel ne part jamais');
    dit(!tout.some((d) => d.kind === 'lbcschema' && /credentials/.test(String(d.endpoint || ''))), 'pas même la structure de sa réponse');
    const cc = tout.filter((d) => d.kind === 'lbccomptes');
    dit(cc.length === 1 && cc[0].comptes[0].id === U1 && cc[0].comptes[0].name === 'Julien P' && cc[0].comptes[0].pro === true, 'ses comptes liés partent (identifiant, nom, pro)', JSON.stringify(cc.map((x) => x.comptes)));
    dit(!cc.some((x) => /moi@exemple\.test/.test(JSON.stringify(x))), '…sans l\'email du compte');
    const chemins = tout.filter((d) => d.kind === 'lbcpaths').flatMap((d) => d.paths || []);
    const brut = chemins.filter((p) => /[0-9a-f]{8}-[0-9a-f]{4}-/i.test(p) || /[0-9a-f]{4}-[0-9a-f]{12}/i.test(p));
    dit(chemins.length > 0 && chemins.some((p) => /\{uuid\}/.test(p)) && !brut.length, 'un UUID dans un chemin devient {uuid} (il partait à moitié en clair)', brut.slice(0, 2).join(' | ') || `${chemins.length} chemin(s)`);
    const schemas = tout.filter((d) => d.kind === 'lbcschema').map((d) => d.endpoint);
    dit(!schemas.some((e) => /[0-9a-f]{8}-[0-9a-f]{4}/i.test(e) || /[0-9a-f]{4}-[0-9a-f]{12}/i.test(e)), 'une structure par ENDPOINT, pas une par conversation', schemas.filter((e) => /-[0-9a-f]{4}/i.test(e)).slice(0, 2).join(' | '));
  } catch (e) { dit(false, 'le contrôle a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); }
  console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
