// audit-observateur — VRM Observateur (outil à part, pour étudier Vintex).
// La règle (regle.js) est EXÉCUTÉE sur des requêtes inventées à la forme de
// Vinted (messages aux favoris) : jamais une valeur dans ce qui est rangé,
// mais un même identifiant donne la même empreinte d'une requête à l'autre.
const path = require('path');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + d : '')); } };
const fs = require('fs'), vm = require('vm');
// `--src chemin/regle.js` : juge une autre copie de la règle (la preuve sur le code d'AVANT, §6.1).
const iSrc = process.argv.indexOf('--src');
const SRC = fs.readFileSync(iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..', 'vrm-observateur-extension', 'regle.js'), 'utf8');
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
// 2.1 (27 nov.) VESTIAIRE COLLECTIVE : noté comme Vinted (chemin normalisé, identifiants en empreintes, corps en
// formes, longueurs), avec les MÊMES garanties — et un hôte qui imite le nom n'est pas suivi. Données inventées.
{
  const vc = (method, url, body, init = 'https://fr.vestiairecollective.com') => OBS.entree({ url, method, initiator: init, type: 'xmlhttprequest', timeStamp: 2000, tabId: 2, requestBody: body ? corps(body) : undefined });
  const v1 = vc('GET', 'https://apiv2.vestiairecollective.com/users/me/product-listings?offset=0&limit=48&sort=listingDate:desc');
  const v2 = vc('GET', 'https://apiv2.vestiairecollective.com/products/48123456/likes?userId=98765432');
  const v3 = vc('POST', 'https://apiv2.vestiairecollective.com/negotiations/7712345/counter-offer', { price: { cents: 12000, currency: 'EUR' }, buyerId: 98765432, message: 'Bonjour Claire, 120 € ça vous va ? claire.martin@mail.fr' });
  const v4 = vc('GET', 'https://fr.vestiairecollective.com/profile/claire.martin@mail.fr/');
  const v5 = vc('POST', 'https://chat.stream-chat.com/channels/messaging/abc-98765432/message', { message: { text: 'Bonjour Claire' } });
  const v6 = vc('GET', 'https://apiv2.vestiairecollective.com.evil.example/users/me', null, 'https://apiv2.vestiairecollective.com.evil.example');
  const v7 = vc('GET', 'https://apiv2.vestiairecollective.com/products/48123456');
  const tv = JSON.stringify([v1, v2, v3, v4, v5, v6, v7]);
  dit(v1 && v1.h === 'apiv2.vestiairecollective.com' && v1.p === '/users/me/product-listings' && JSON.stringify(v1.q) === '["offset","limit","sort"]', "Vestiaire : une requête de la page est notée (hôte, chemin normalisé, noms des paramètres)", JSON.stringify(v1));
  dit(v2 && /^\/products\/\{id:[0-9a-f]{6}\}\/likes$/.test(v2.p) && v2.qid && /^id:[0-9a-f]{6}$/.test(v2.qid.userId), "Vestiaire : « qui a aimé » — l'article et la personne en EMPREINTES, jamais leur numéro", JSON.stringify(v2));
  dit(v7 && v2 && (v7.p.match(/\{id:([0-9a-f]{6})\}/) || [])[1] === (v2.p.match(/\{id:([0-9a-f]{6})\}/) || [])[1], "Vestiaire : le même article a la même empreinte d'une requête à l'autre", `${v2 && v2.p} / ${v7 && v7.p}`);
  dit(v3 && v3.corps && v3.corps.json && v3.corps.json.message === 'texte:' + 'Bonjour Claire, 120 € ça vous va ? claire.martin@mail.fr'.length && /^id:[0-9a-f]{6}$/.test(v3.corps.json.buyerId) && v3.corps.json.price && v3.corps.json.price.cents === 'number', "Vestiaire : le corps d'une contre-offre en FORMES (texte en longueur, acheteur en empreinte, prix en type)", JSON.stringify(v3 && v3.corps));
  dit(v4 && !/@|claire/i.test(v4.p), "Vestiaire : une adresse e-mail dans un chemin ne se garde jamais", JSON.stringify(v4));
  dit(v5 && v5.h === 'chat.stream-chat.com' && v5.p === '' && !v5.corps && v5.de === 'fr.vestiairecollective.com', "Vestiaire : la messagerie (Stream) partie de la page — l'hôte seul, ni chemin ni corps", JSON.stringify(v5));
  dit(v6 === null, "un hôte qui IMITE vestiairecollective.com n'est pas suivi", JSON.stringify(v6));
  dit(!/48123456|98765432|7712345|Claire|claire|Bonjour|12000|mail\.fr/.test(tv), "Vestiaire : aucune valeur rangée (ni identifiant, ni prix, ni texte, ni nom, ni e-mail)", tv.slice(0, 400));
  const gv = OBS.geste ? OBS.geste({ k: 'page', t: 9, url: 'https://fr.vestiairecollective.com/men-shoes/sneakers/nike/white-nike-sneakers-48123456.shtml?tab=likes' }) : null;
  const gc = OBS.geste ? OBS.geste({ k: 'clic', t: 10, vrai: true, el: { tag: 'a', texte: 'Claire', href: 'https://fr.vestiairecollective.com/profile/98765432/' } }) : null;
  dit(gv && gv.h === 'fr.vestiairecollective.com' && gv.p && !/48123456/.test(gv.p) && JSON.stringify(gv.q) === '["tab"]', "Vestiaire : une page visitée est notée (chemin normalisé, noms des paramètres)", JSON.stringify(gv));
  dit(gc && gc.el && /^\/profile\/\{id:[0-9a-f]{6}\}\/?$/.test(gc.el.lien || '') && !gc.el.texte, "Vestiaire : un lien vers une personne — son profil en empreinte, jamais son nom", JSON.stringify(gc));
  dit(OBS.estSuivi && OBS.estSuivi('www.vinted.fr') && OBS.estSuivi('apiv2.vestiairecollective.com') && !OBS.estSuivi('vestiairecollective.com.evil.example') && !OBS.estSuivi('example.com'), "les sites suivis : Vinted et Vestiaire, rien d'autre");
  // Le manifeste : les pages Vestiaire reçoivent le script des gestes ; version 2.1.0.
  const man = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vrm-observateur-extension', 'manifest.json'), 'utf8'));
  const cs = (man.content_scripts || []).flatMap((c) => c.matches || []);
  dit(iSrc > 0 || (cs.includes('https://*.vestiairecollective.com/*') && (man.host_permissions || []).includes('https://*.vestiairecollective.com/*') && man.version === '2.1.0'), "manifeste : Vestiaire dans les pages et les permissions, version 2.1.0", JSON.stringify({ v: man.version, cs }));
}
console.log(ko ? `\n❌ audit-observateur : ${ko} rouge(s)` : `\n✅ audit-observateur : ${ok} contrôles`);
process.exit(ko ? 1 : 0);
