// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : UN SEUL FIL PAR ACHETEUR ET PAR PAIRE (10 nov., lot AB) — EXÉCUTE src/filUnique.js
//        node scripts/audit-fil-unique.cjs
// ═══════════════════════════════════════════════════════════════════════════
//  1. §5 « 50 paires identiques » : 50 conversations Vinted au MÊME titre, de 50
//     acheteurs, ne forment JAMAIS un fil ; le même pseudo avec deux identifiants
//     différents non plus ;
//  2. même interlocuteur (identifiant Vinted) + une identité de paire commune
//     (annonce, transaction ou N°) ⇒ UN fil ; même interlocuteur, deux paires
//     PROUVÉES différentes ⇒ deux fils, et AUCUNE proposition ;
//  3. un identifiant d'interlocuteur n'est comparé qu'à sa plateforme (« 5301 »
//     Vinted ≠ « 5301 » ailleurs) ; Leboncoin et Vestiaire ne fusionnent jamais seuls ;
//  4. les propositions : « paire » (même interlocuteur, une conversation sans
//     identité de paire), « acheteur » (même N° sur deux plateformes) ; un « Non »
//     ne revient pas ; SON lien relie ; « délier » défait ;
//  5. les messages d'un fil, dans l'ordre, chacun avec sa plateforme ; un message
//     sans date reste à sa place dans SA conversation ;
//  6. on répond par la conversation du DERNIER message ; rien de daté ⇒ la
//     conversation bougée en dernier ; aucune ⇒ null ;
//  7. le N° du module = `cleNum` de l'app (même résultat sur 12 saisies) ;
//  8. l'app : « Tous » existe pour Messages, le défaut reste Vinted ; la clé est
//     synchronisée ; FilsTous n'écrit les liens que par `relierFils`/`refuserFils`/`delierFil`.
const path = require('path');
const fs = require('fs');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };

(async () => {
  const F = await import(path.join(__dirname, '..', 'src', 'filUnique.js'));
  const N = await import(path.join(__dirname, '..', 'src', 'navigationTache.js'));
  const T = 1_800_000_000_000, h = (n) => new Date(T - n * 3600e3).toISOString();
  const vc = (id, qui, paire, at, login) => F.convVinted({ id, opposite_user: { id: qui, login: login || 'ach' + qui }, updated_at: at, description: 'msg ' + id, unread: false, _acc: { vinted_user_id: '111' } }, paire);

  // 1 — 50 paires identiques, 50 acheteurs
  const cinquante = Array.from({ length: 50 }, (_, i) => vc(1000 + i, 9000 + i, { item: 7000 + i, tx: 8000 + i, num: String(i + 1), titre: 'adidas spezial noir 38' }, h(i)));
  const f50 = F.regrouperFils(cinquante, {});
  dit(f50.length === 50 && f50.every((f) => f.convs.length === 1), '1 · 50 conversations au même titre, 50 acheteurs ⇒ 50 fils', String(f50.length));
  dit(F.suggestionsFils(f50, {}, {}).length === 0, '1 · aucune proposition entre 50 paires identiques');
  const memePseudo = F.regrouperFils([vc(1, 501, { item: 44 }, h(2), 'julie'), vc(2, 502, { item: 44 }, h(1), 'julie')], {});
  dit(memePseudo.length === 2, '1 · même pseudo, deux identifiants ⇒ deux fils (jamais un pseudo ressemblant)');

  // 2
  const a = vc(301, 5301, { item: 444, tx: 9001, num: '7' }, h(30));
  const b = vc(302, 5301, { item: 444, tx: null, num: '' }, h(2));
  const c = vc(303, 5301, { item: 555, tx: 9002, num: '12' }, h(1));
  const f2 = F.regrouperFils([a, b, c], {});
  const fa = f2.find((f) => f.convs.some((x) => x.conv === '301'));
  dit(fa && fa.convs.length === 2 && fa.convs.some((x) => x.conv === '302'), '2 · même acheteur + même annonce ⇒ un fil de deux conversations');
  dit(f2.length === 2, '2 · même acheteur, paire PROUVÉE différente ⇒ fil à part', String(f2.length));
  dit(F.suggestionsFils(f2, {}, {}).length === 0, '2 · deux paires prouvées différentes ⇒ aucune proposition');
  const parNum = F.regrouperFils([vc(10, 77, { num: '007' }, h(3)), vc(11, 77, { num: '7' }, h(2))], {});
  dit(parNum.length === 1 && parNum[0].num === '7', '2 · le N° est une identité (« 007 » = « 7 »)');
  const parTx = F.regrouperFils([vc(12, 78, { tx: 55 }, h(3)), vc(13, 78, { tx: '55' }, h(2))], {});
  dit(parTx.length === 1, '2 · la transaction est une identité');

  // 3
  const lbc = F.convLeboncoin({ conv: 'c-1', compte: 'L1', da: h(1), ap: 'dispo ?', dm: 'false' });
  const lbc2 = F.convLeboncoin({ conv: 'c-2', compte: 'L1', da: h(2), ap: 'dispo ?', dm: 'false' });
  const vca = F.convVestiaire({ conv: 'v-1', pid: '444', num: '7', date: h(4) });
  dit(lbc.interlocuteur === null && vca.interlocuteur === null, '3 · Leboncoin et Vestiaire : aucun interlocuteur (le site ne le donne pas)');
  dit(vca.annonce === 'vestiaire:444' && a.annonce === 'vinted:444', '3 · une annonce est préfixée par SA plateforme');
  const f3 = F.regrouperFils([a, lbc, lbc2, vca], {});
  dit(f3.length === 4, '3 · Vinted N°7 + Vestiaire N°7 + deux Leboncoin ⇒ quatre fils (rien de fusionné seul)', String(f3.length));

  // 4
  const s4 = F.suggestionsFils(F.regrouperFils([vc(20, 600, { item: 1 }, h(3)), vc(21, 600, null, h(2))], {}), {}, {});
  dit(s4.length === 1 && s4[0].sorte === 'paire', '4 · même acheteur, une conversation sans paire ⇒ « Peut-être la même paire ? »');
  const s4b = F.suggestionsFils(f3, {}, {});
  dit(s4b.length === 1 && s4b[0].sorte === 'acheteur', '4 · même N° sur Vinted et Vestiaire ⇒ « Peut-être le même acheteur ? »', JSON.stringify(s4b.map((x) => x.sorte)));
  dit(!s4b.some((x) => x.a.startsWith('leboncoin') || x.b.startsWith('leboncoin')), '4 · Leboncoin (sans identité) n\'est jamais proposé');
  let etat = F.refuserFils({}, s4b[0].a, s4b[0].b, h(0));
  dit(F.suggestionsFils(f3, etat.liens, etat.refus).length === 0, '4 · un « Non » ne revient pas');
  etat = F.relierFils(etat, s4b[0].a, s4b[0].b, h(0));
  const f4 = F.regrouperFils([a, lbc, lbc2, vca], etat.liens);
  dit(f4.length === 3 && f4.some((f) => f.convs.length === 2 && f.plateformes.join() === 'vinted,vestiaire'), '4 · SON lien relie (un fil Vinted + Vestiaire)');
  dit(!etat.refus[F.cleLien(s4b[0].a, s4b[0].b)], '4 · relier efface le « Non » d\'avant');
  etat = F.delierFil(etat, [a.cle]);
  dit(F.regrouperFils([a, lbc, lbc2, vca], etat.liens).length === 4, '4 · « délier » défait');
  const fantome = F.regrouperFils([a], { x: { a: a.cle, b: 'vinted:111:999' } });
  dit(fantome.length === 1 && fantome[0].convs.length === 1, '4 · un lien vers une conversation absente dort');

  // 5
  const ex = F.convLeboncoin({ conv: 'L', compte: 'x', da: h(1) });
  const ev = vc(40, 1, { item: 1 }, h(1));
  const msgs = F.messagesDuFil([
    { entree: ev, messages: [{ t: 'v1', at: h(5), deMoi: false }, { t: 'v-sans-date', at: null, deMoi: false }, { t: 'v3', at: h(1), deMoi: true }] },
    { entree: ex, messages: [{ t: 'l1', at: h(4), deMoi: false }, { t: 'l2', at: h(2), deMoi: true }] },
    { entree: F.convLeboncoin({ conv: 'Z', compte: 'x' }), messages: null },
  ]);
  dit(msgs.map((m) => m.t).join(',') === 'v1,v-sans-date,l1,l2,v3', '5 · ordre des dates, le message sans date à sa place', msgs.map((m) => m.t).join(','));
  dit(msgs.every((m) => ['vinted', 'leboncoin'].includes(m.plateforme)) && msgs.find((m) => m.t === 'l1').plateforme === 'leboncoin', '5 · chaque message porte SA plateforme');

  // 6
  const fil6 = { convs: [ev, ex], dernier: ev };
  dit(F.conversationDeReponse(fil6, msgs) === ev, '6 · on répond par la conversation du DERNIER message (Vinted ici)');
  const msgs6 = F.messagesDuFil([{ entree: ev, messages: [{ t: 'a', at: h(5) }] }, { entree: ex, messages: [{ t: 'b', at: h(1) }] }]);
  dit(F.conversationDeReponse(fil6, msgs6) === ex, '6 · … Leboncoin quand le dernier message est sur Leboncoin');
  dit(F.conversationDeReponse(fil6, []) === ev, '6 · rien de daté lu ⇒ la conversation bougée en dernier');
  dit(F.conversationDeReponse({ convs: [ev, ex], dernier: null }, []) === null, '6 · rien de su ⇒ null (l\'écran ne choisit pas)');

  // 7 — cleNum recopiée
  const app = require('./_source-app.cjs').sourceAppDe(path.join(__dirname, '..', 'src', 'App.jsx'));
  const m7 = /const cleNum = \(v\) => \{[\s\S]*?\n\};/.exec(app);
  let appCle = null; try { appCle = m7 ? new Function(m7[0] + '; return cleNum;')() : null; } catch (_) { appCle = null; }
  const saisies = ['7', '007', ' 7 ', 'b125', 'B-125', 'B 125', 'C0123', '0', '', null, 'N°7', '12.5'];
  dit(appCle && saisies.every((s) => appCle(s) === F.cleNumFil(s)), '7 · le N° du module = `cleNum` de l\'app', appCle ? saisies.filter((s) => appCle(s) !== F.cleNumFil(s)).join('|') : 'cleNum introuvable');

  // 8 — l'app
  dit(N.TACHES_SITE.messages && N.TACHES_SITE.messages.toutes === true, '8 · Messages a « Tous »');
  dit(N.siteDeTache('messages', null) === 'vinted' && N.siteDeTache('messages', 'toutes') === 'toutes' && N.siteDeTache('ventes', null) === 'toutes' && N.siteDeTache('annonces', 'toutes') === 'vinted', '8 · défaut de Messages : Vinted ; Ventes inchangé ; Annonces sans « Tous »');
  dit(/'vrm_fils_relies',/.test((/const SYNC_KEYS = \[[\s\S]*?\];/.exec(app) || [''])[0]), '8 · `vrm_fils_relies` est synchronisé');
  const ecran = fs.readFileSync(path.join(__dirname, '..', 'src', 'ecrans', 'FilsTous.jsx'), 'utf8').replace(/\/\/.*$/gm, '');
  const ecritures = [...ecran.matchAll(/\becrire\(\s*([\w.]+)/g)].map((m) => m[1]);
  const directs = (ecran.match(/save\(/g) || []).length;
  dit(ecritures.length >= 3 && ecritures.every((x) => ['relierFils', 'refuserFils', 'delierFil'].includes(x)) && directs === 1, '8 · l\'écran n\'écrit les liens que par relier / refuser / délier (un seul `save`)', ecritures.join(' ') + ' · save×' + directs);
  dit(!/titre[^\n]{0,40}===|normTitle|title\s*===/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'filUnique.js'), 'utf8').replace(/\/\/.*$/gm, '')), '8 · la règle ne compare jamais un titre');

  console.log(ko ? `\n${ko} contrôle(s) rouge(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
