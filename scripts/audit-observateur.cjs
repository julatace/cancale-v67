// audit-observateur — VRM Observateur (outil à part, pour étudier Vintex).
// La règle (regle.js) est EXÉCUTÉE sur des requêtes inventées à la forme de
// Vinted (messages aux favoris) : jamais une valeur dans ce qui est rangé,
// mais un même identifiant donne la même empreinte d'une requête à l'autre.
const path = require('path');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + d : '')); } };
const fs = require('fs'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'vrm-observateur-extension', 'regle.js'), 'utf8');
const charger = () => { const ctx = { URL, TextDecoder, TextEncoder }; vm.runInNewContext(SRC + '\nthis.OBS = OBS;', ctx); return ctx.OBS; };
const OBS = charger();
if (OBS.poserSel) OBS.poserSel('sel-banc');
const corps = (o) => ({ raw: [{ bytes: new TextEncoder().encode(JSON.stringify(o)).buffer }] });
const req = (method, url, body, t = 1000) => OBS.entree({ url, method, initiator: 'https://www.vinted.fr', type: 'xmlhttprequest', timeStamp: t, tabId: 1, requestBody: body ? corps(body) : undefined });
const a = req('GET', 'https://www.vinted.fr/api/v2/notifications?page=1&per_page=20');
const b = req('POST', 'https://www.vinted.fr/api/v2/conversations', { initiator: 'favourite', item_id: 7123456789, opposite_user_id: 31234567 });
const c = req('POST', 'https://www.vinted.fr/api/v2/conversations/9988776655/replies', { reply: { body: 'Bonjour Jean, -10 % pour toi ! 06 12 34 56 78', photo_temp_uuids: null, is_personal_data_sharing_check_skipped: false } });
const d = req('GET', 'https://www.vinted.fr/api/v2/conversations/9988776655?item_id=7123456789');
const tout = JSON.stringify([a, b, c, d]);
dit(!/7123456789|31234567|9988776655|Jean|06 12/.test(tout), "aucune valeur rangée (ni identifiant, ni texte du message)", tout.slice(0, 300));
const idPath = (e) => (e.p.match(/\{id:([0-9a-f]{6})\}/) || [])[1];
dit(idPath(c) && idPath(c) === idPath(d), "la même conversation a la même empreinte dans deux requêtes (réponse puis lecture)", `${c && c.p} / ${d && d.p}`);
dit(b && b.corps && b.corps.json && /^id:[0-9a-f]{6}$/.test(b.corps.json.item_id) && d.qid && d.qid.item_id === b.corps.json.item_id, "l'article du favori se suit du corps à l'adresse (même empreinte)", JSON.stringify([b && b.corps, d && d.qid]));
dit(c && c.corps && c.corps.json && c.corps.json.reply && c.corps.json.reply.body === 'texte:45', "le texte du message : sa LONGUEUR seulement", JSON.stringify(c && c.corps));
dit(a && JSON.stringify(a.q) === '["page","per_page"]' && !a.qid, "les paramètres ordinaires : leurs noms seulement", JSON.stringify(a));
const OBS2 = charger();
if (OBS2.poserSel) OBS2.poserSel('autre-ordinateur');
dit(OBS2.empreinte && OBS2.empreinte('9988776655') !== OBS.empreinte('9988776655'), "l'empreinte dépend du sel de l'ordinateur (pas une table publique)");
// 2.0 (26 nov.) LES GESTES : la sorte, vrai doigt ou script, la signature de l'élément — jamais une valeur ni une personne.
if (OBS.geste) {
  const g1 = OBS.geste({ k: 'clic', t: 5, vrai: false, el: { tag: 'BUTTON', texte: 'Envoyer 12', testid: 'send', ancetres: ['conversation-reply'] } });
  const g2 = OBS.geste({ k: 'frappe', t: 6, vrai: true, longueur: 19, el: { tag: 'textarea', name: 'body', texte: 'Bonjour Jean' } });
  const g3 = OBS.geste({ k: 'clic', t: 7, vrai: true, el: { tag: 'a', texte: 'jean@x.fr', href: 'https://www.vinted.fr/member/123456-jean' } });
  const g4 = OBS.geste({ k: 'page', t: 8, url: 'https://www.vinted.fr/inbox/12345678?item_id=7123456789' });
  const tg = JSON.stringify([g1, g2, g3, g4]);
  dit(g1 && g1.vrai === false && g1.el.texte === 'Envoyer #' && g1.el.testid === 'send', "un clic de script est noté « vrai: false », le bouton par son libellé d'interface", JSON.stringify(g1));
  dit(g2 && g2.longueur === 19 && !g2.el.texte, "la frappe : sa LONGUEUR, jamais le texte (un champ n'a pas de libellé gardé)", JSON.stringify(g2));
  dit(!/Jean|jean|123456|7123456789|12345678|Bonjour|@/.test(tg), "aucun geste ne garde un nom, un identifiant ou un texte tapé", tg);
  dit(OBS.geste({ k: 'inconnu', t: 1 }) === null, "une sorte de geste inconnue tombe");
}
console.log(ko ? `\n❌ audit-observateur : ${ko} rouge(s)` : `\n✅ audit-observateur : ${ok} contrôles`);
process.exit(ko ? 1 : 0);
