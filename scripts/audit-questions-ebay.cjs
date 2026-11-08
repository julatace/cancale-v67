// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LES QUESTIONS eBAY — LUES, UNE PAR ANNONCE, RÉPONDUES SUR SON CLIC
//         node scripts/audit-questions-ebay.cjs [--mutation=type|confirme|relu|groupe|ordre|email|echappe|envoyer]
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE la vraie gestion eBay (api/_lib/ebay-gestion.js) contre un FAUX
// serveur Trading qui rend le VRAI format XML de `GetMemberMessages`
// (MemberMessage/MemberMessageExchange : Item, Question{MessageType,
// SenderID, SenderEmail, Subject, Body, MessageID}, Response, MessageStatus,
// CreationDate) et d'`AddMemberMessageRTQ`, puis la règle de l'écran
// (src/questionsEbay.js). Aucune donnée réelle : pseudos et textes inventés.
// fast-xml-parser n'est pas installé ici : un analyseur XML minimal, posé
// dans un node_modules TEMPORAIRE, rend la même forme d'objet (options de la
// gestion : attributs « @_ », texte « #text », préfixes retirés, valeurs brutes).
// Vérifie :
//   1. la lecture : `type` rendu, l'adresse e-mail de l'acheteur JAMAIS rendue ;
//   2. une ligne par annonce, la plus ancienne question sans réponse d'abord,
//      un message qui n'est pas une question n'entre pas ;
//   3. répondre : sans `confirme:true` ⇒ 400 AVANT le jeton, rien chez eBay ;
//      la question RELUE chez eBay comme « AskSellerQuestion » avant l'envoi ;
//      pas une question ⇒ 409, rien d'envoyé ; le texte échappé ; eBay muet ⇒
//      « incertain » (504), jamais « envoyé » ;
//   4. l'écran : « Envoyer » seulement sur une question, la vue « Questions »
//      par défaut, l'article par l'ItemID / SKU (jamais le titre).
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || process.env.BAVARD) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
let GESTION = lire('api/_lib/ebay-gestion.js');
let Q = lire('src/questionsEbay.js');
let ECRAN = lire('src/ebayGestion.jsx');
const muter = (quoi, avant, apres) => {
  const src = quoi === 'g' ? GESTION : quoi === 'q' ? Q : ECRAN;
  if (!src.includes(avant)) { console.log('❌ mutation impossible : motif absent — ' + avant.slice(0, 90)); process.exit(2); }
  if (quoi === 'g') GESTION = GESTION.replace(avant, apres); else if (quoi === 'q') Q = Q.replace(avant, apres); else ECRAN = ECRAN.replace(avant, apres);
};
if (MUT === 'type') muter('q', "export const estQuestion = (m) => !!m && QUESTION.test(String(m.type || '').trim()) &&", 'export const estQuestion = (m) => !!m &&');
else if (MUT === 'confirme') muter('g', "    if(b.confirme!==true)return echec('Confirme la réponse.',400,'confirmation');\n", '');
else if (MUT === 'relu') muter('g', "if(!original)return echec('Ce message n’est plus disponible pour cette annonce.',409);", '');
else if (MUT === 'groupe') muter('q', "    const k = String(m.itemId);", '    const k = String(m.id);');
else if (MUT === 'ordre') muter('q', 'aTraiter: sans[0] || derniere', 'aTraiter: derniere');
else if (MUT === 'email') muter('g', 'type:texte(q.MessageType).trim()};', 'type:texte(q.MessageType).trim(),email:texte(q.SenderEmail)};');
else if (MUT === 'echappe') muter('g', '<Body>${xml(body)}</Body><DisplayToPublic>false</DisplayToPublic>', '<Body>${body}</Body><DisplayToPublic>false</DisplayToPublic>');
else if (MUT === 'envoyer') muter('e', '{selected.itemId && estQuestion(selected) ? <div className="vrm-chat-foot"', '{selected.itemId ? <div className="vrm-chat-foot"');
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

// ── L'analyseur XML minimal (la forme de fast-xml-parser, options de la gestion) ──
const SHIM = String.raw`
const ent = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const sansNs = (n) => n.replace(/^[^:]+:/, '');
export class XMLParser {
  constructor(o = {}) { this.o = o; }
  parse(xml) {
    let i = 0;
    const s = xml.replace(/<\?xml[^>]*\?>/, '');
    const noeud = () => {
      const m = /^<([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>/.exec(s.slice(i));
      if (!m) throw new Error('XML illisible à ' + i);
      i += m[0].length;
      const nom = sansNs(m[1]);
      const attrs = {};
      for (const a of m[2].matchAll(/([\w:.-]+)="([^"]*)"/g)) attrs['@_' + sansNs(a[1])] = ent(a[2]);
      if (m[3]) return [nom, Object.keys(attrs).length ? attrs : ''];
      const enfants = {}; let texte = ''; let aEnfant = false;
      for (;;) {
        if (s.startsWith('</', i)) { const f = /^<\/[^>]+>/.exec(s.slice(i)); i += f[0].length; break; }
        if (s.startsWith('<![CDATA[', i)) { const f = s.indexOf(']]>', i); texte += s.slice(i + 9, f); i = f + 3; continue; }
        if (s[i] === '<') { aEnfant = true; const [n, v] = noeud(); if (n in enfants) { if (!Array.isArray(enfants[n]) || !enfants[n].__liste) { enfants[n] = Object.assign([enfants[n]], { __liste: true }); } enfants[n].push(v); } else enfants[n] = v; continue; }
        const f = s.indexOf('<', i); texte += ent(s.slice(i, f)); i = f;
      }
      if (!aEnfant) { const t = texte; return [nom, Object.keys(attrs).length ? { ...attrs, '#text': t } : t]; }
      const o = { ...attrs }; for (const k of Object.keys(enfants)) o[k] = Array.isArray(enfants[k]) ? [...enfants[k]] : enfants[k];
      return [nom, o];
    };
    while (i < s.length && /\s/.test(s[i])) i++;
    const [n, v] = noeud();
    return { [n]: v };
  }
}
export const XMLValidator = { validate: (x) => (typeof x === 'string' && /^\s*(<\?xml[^>]*\?>)?\s*</.test(x) ? true : { err: 'illisible' }) };
`;

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-q-ebay-'));
  try {
    fs.mkdirSync(path.join(tmp, 'node_modules', 'fast-xml-parser'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'node_modules', 'fast-xml-parser', 'package.json'), JSON.stringify({ name: 'fast-xml-parser', type: 'module', main: 'index.js', exports: './index.js' }));
    fs.writeFileSync(path.join(tmp, 'node_modules', 'fast-xml-parser', 'index.js'), SHIM);
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ type: 'module' }));
    fs.writeFileSync(path.join(tmp, 'ebay-gestion.js'), GESTION);
    fs.writeFileSync(path.join(tmp, 'ebay-etat-commande.js'), lire('api/_lib/ebay-etat-commande.js'));
    fs.writeFileSync(path.join(tmp, 'questionsEbay.js'), Q || 'export {}');
    const G = await import('file://' + path.join(tmp, 'ebay-gestion.js'));
    const QE = await import('file://' + path.join(tmp, 'questionsEbay.js'));
    dit(typeof QE.questionsParAnnonce === 'function' && typeof QE.estQuestion === 'function', 'la règle de l’écran existe (src/questionsEbay.js)');
    if (typeof QE.questionsParAnnonce !== 'function') throw new Error('module absent');

    // ── Le faux serveur Trading, au vrai format ─────────────────────────────
    const ech = ({ item, titre, type, id, sender, subject, body, status, date, reponses = [] }) => `
  <MemberMessageExchange>
   <Item><ItemID>${item}</ItemID><ListingDetails><StartTime>2026-10-01T08:00:00.000Z</StartTime></ListingDetails><SellingStatus><CurrentPrice currencyID="EUR">89.0</CurrentPrice></SellingStatus><Title>${titre}</Title></Item>
   <Question><MessageType>${type}</MessageType><QuestionType>General</QuestionType><DisplayToPublic>false</DisplayToPublic><SenderID>${sender}</SenderID><SenderEmail>acheteur.invente@exemple.test</SenderEmail><RecipientID>vendeur_invente</RecipientID><Subject>${subject}</Subject><Body>${body}</Body><MessageID>${id}</MessageID></Question>
   ${reponses.map((r) => `<Response>${r}</Response>`).join('')}
   <MessageStatus>${status}</MessageStatus><CreationDate>${date}</CreationDate><LastModifiedDate>${date}</LastModifiedDate>
  </MemberMessageExchange>`;
    const ECH = [
      { item: '110000000001', titre: 'Nike Air Max 90 T42', type: 'AskSellerQuestion', id: '9001', sender: 'acheteur_a', subject: 'Taille', body: 'Elle taille grand ? &amp; la boîte ?', status: 'Unanswered', date: '2026-11-02T09:00:00.000Z' },
      { item: '110000000001', titre: 'Nike Air Max 90 T42', type: 'AskSellerQuestion', id: '9002', sender: 'acheteur_b', subject: 'Prix', body: 'Dernier prix ?', status: 'Answered', date: '2026-11-01T09:00:00.000Z', reponses: ['85 € ferme'] },
      { item: '110000000001', titre: 'Nike Air Max 90 T42', type: 'AskSellerQuestion', id: '9003', sender: 'acheteur_c', subject: 'Envoi', body: 'Envoi rapide ?', status: 'Unanswered', date: '2026-11-03T09:00:00.000Z' },
      { item: '110000000002', titre: 'Adidas Samba T40', type: 'AskSellerQuestion', id: '9004', sender: 'acheteur_d', subject: 'État', body: 'Des défauts ?', status: 'Unanswered', date: '2026-11-01T18:00:00.000Z' },
      { item: '110000000003', titre: 'Jordan 1 T44', type: 'AskSellerQuestion', id: '9005', sender: 'acheteur_e', subject: 'Ok', body: 'Merci !', status: 'Answered', date: '2026-11-03T20:00:00.000Z', reponses: ['Avec plaisir'] },
      { item: '110000000004', titre: 'New Balance 550', type: 'ContactTransactionPartner', id: '9006', sender: 'acheteur_f', subject: 'Commande', body: 'Reçu, merci', status: 'Unanswered', date: '2026-11-03T21:00:00.000Z' },
    ];
    const env = (call, corps, ack = 'Success') => `<?xml version="1.0" encoding="UTF-8"?>\n<${call}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Timestamp>2026-11-04T08:00:00.000Z</Timestamp><Ack>${ack}</Ack><Version>1271</Version><Build>E1271_CORE</Build>${corps}</${call}Response>`;
    const banc = ({ ackEcrire = 'Success', muet = false } = {}) => {
      const appels = [], jetons = [];
      const gestion = G.creerGestionEbay({
        apiOrigin: 'https://api.ebay.invalid',
        accessToken: async (owner) => { jetons.push(owner); return { ok: true, token: 'jeton-invente' }; },
        ebayJson: async () => ({ ok: false, status: 500 }),
        tradingCall: async (token, call, inner) => {
          appels.push({ call, inner });
          if (call === 'GetMemberMessages') {
            const type = (/<MailMessageType>([^<]+)</.exec(inner) || [])[1];
            const id = (/<MemberMessageID>([^<]+)</.exec(inner) || [])[1];
            const item = (/<ItemID>([^<]+)</.exec(inner) || [])[1];
            const L = ECH.filter((e) => (type === 'All' || e.type === type) && (!id || e.id === id) && (!item || e.item === item));
            return { ok: true, ack: true, status: 200, xml: env(call, `<MemberMessage>${L.map(ech).join('')}</MemberMessage><PaginationResult><TotalNumberOfPages>1</TotalNumberOfPages><TotalNumberOfEntries>${L.length}</TotalNumberOfEntries></PaginationResult>`), erreurs: [] };
          }
          if (call === 'AddMemberMessageRTQ') {
            if (muet) return { ok: false, ack: false, status: 0, xml: '' };
            return { ok: ackEcrire === 'Success', ack: true, status: 200, xml: env(call, ackEcrire === 'Success' ? '' : '<Errors><ShortMessage>Refusé</ShortMessage><SeverityCode>Error</SeverityCode></Errors>', ackEcrire), erreurs: ackEcrire === 'Success' ? [] : [{ severite: 'Error' }] };
          }
          return { ok: false, ack: true, status: 400, xml: env(call, '', 'Failure'), erreurs: [{ severite: 'Error' }] };
        },
      });
      return { gestion, appels, jetons, ecrits: () => appels.filter((a) => a.call !== 'GetMemberMessages') };
    };

    console.log('── 1. La lecture');
    let b = banc();
    const r = await b.gestion.messages({}, 'vendeur-A');
    const M = r.body && r.body.messages;
    dit(r.status === 200 && Array.isArray(M) && M.length === 6, 'GetMemberMessages lu (6 échanges)', JSON.stringify(r.body).slice(0, 160));
    const m1 = (M || []).find((m) => m.id === '9001');
    dit(m1 && m1.type === 'AskSellerQuestion' && m1.itemId === '110000000001' && m1.body === 'Elle taille grand ? & la boîte ?', 'le type, l’annonce et le texte (entités décodées) sont rendus', JSON.stringify(m1));
    dit(!JSON.stringify(r.body).includes('exemple.test') && !(M || []).some((m) => 'email' in m), 'l’adresse e-mail de l’acheteur n’est JAMAIS rendue (seul le pseudo l’est)');

    console.log('── 2. Une ligne par annonce');
    const Gs = QE.questionsParAnnonce(M);
    dit(Gs.length === 3 && Gs.every((g) => g.itemId !== '110000000004'), '3 annonces avec des questions ; le message de transaction n’en est pas une', Gs.map((g) => g.itemId).join(','));
    const g1 = Gs.find((g) => g.itemId === '110000000001');
    dit(g1 && g1.questions.length === 3 && g1.nSans === 2 && g1.aTraiter.id === '9001', 'annonce 1 : 3 questions, 2 sans réponse, la plus ANCIENNE sans réponse d’abord', g1 && `${g1.questions.map((q) => q.id)} · ${g1.aTraiter.id}`);
    dit(g1 && g1.questions.map((q) => q.id).join(',') === '9002,9001,9003', 'les questions d’une annonce, de la plus ancienne à la plus récente');
    dit(Gs[0].itemId === '110000000002' && Gs[1].itemId === '110000000001' && Gs[2].itemId === '110000000003', 'en tête : la plus vieille attente (2), puis (1) ; la répondue (3) après', Gs.map((g) => g.itemId).join(','));
    dit(!QE.estQuestion({ type: 'AskSellerQuestion', itemId: '' }) && !QE.estQuestion({ type: '', itemId: '1' }) && !QE.estQuestion({ type: 'ContactEbayMember', itemId: '1' }), 'sans annonce identifiée, ou type absent / autre ⇒ pas une question (VRM ne promet pas d’y répondre)');

    console.log('── 3. Répondre, sur SON clic');
    b = banc();
    let w = await b.gestion.repondre({ itemId: '110000000001', messageId: '9001', body: 'Oui' }, 'vendeur-A');
    dit(w.status === 400 && w.body.reason === 'confirmation' && !b.jetons.length && !b.appels.length, 'sans `confirme:true` ⇒ 400 AVANT le jeton, rien chez eBay');
    b = banc();
    w = await b.gestion.repondre({ itemId: '110000000001', messageId: '9001', body: 'Taille normale <b>&</b> boîte d’origine', confirme: true }, 'vendeur-A');
    const relu = b.appels[0], ecrit = b.ecrits()[0];
    dit(w.status === 200 && w.body.ok && relu && relu.call === 'GetMemberMessages' && /<MailMessageType>AskSellerQuestion</.test(relu.inner) && /<MemberMessageID>9001</.test(relu.inner), 'la question est RELUE chez eBay comme « AskSellerQuestion » juste avant');
    dit(ecrit && ecrit.call === 'AddMemberMessageRTQ' && /<ParentMessageID>9001<\/ParentMessageID>/.test(ecrit.inner) && /<ItemID>110000000001<\/ItemID>/.test(ecrit.inner) && /<DisplayToPublic>false/.test(ecrit.inner), 'AddMemberMessageRTQ sur CETTE question de CETTE annonce, jamais publique', ecrit && ecrit.inner);
    dit(ecrit && /<Body>Taille normale &lt;b&gt;&amp;&lt;\/b&gt; boîte d’origine<\/Body>/.test(ecrit.inner), 'le texte est échappé (aucun XML injecté)');
    b = banc();
    w = await b.gestion.repondre({ itemId: '110000000004', messageId: '9006', body: 'Merci', confirme: true }, 'vendeur-A');
    dit(w.status === 409 && !b.ecrits().length, 'pas une question (message de transaction) ⇒ 409, rien d’envoyé', JSON.stringify(w.body));
    b = banc();
    w = await b.gestion.repondre({ itemId: '110000000002', messageId: '9001', body: 'x', confirme: true }, 'vendeur-A');
    dit(w.status === 409 && !b.ecrits().length, 'la question d’une AUTRE annonce ⇒ 409, rien d’envoyé');
    b = banc({ muet: true });
    w = await b.gestion.repondre({ itemId: '110000000001', messageId: '9001', body: 'Oui', confirme: true }, 'vendeur-A');
    dit(w.status === 504 && w.body.reason === 'incertain', 'eBay muet ⇒ « incertain » (504), jamais « envoyé »');
    b = banc({ ackEcrire: 'Failure' });
    w = await b.gestion.repondre({ itemId: '110000000001', messageId: '9001', body: 'Oui', confirme: true }, 'vendeur-A');
    dit(w.status >= 400 && w.body.ok === false, 'eBay refuse ⇒ l’erreur est rendue');

    console.log('── 4. L’écran (lu dans le code)');
    const e = ECRAN.replace(/\/\*[\s\S]*?\*\//g, '');
    dit(/useState\('questions'\)/.test(e) && /questionsParAnnonce\(affiches\)/.test(e), 'Messages · eBay s’ouvre sur « Questions », une ligne par annonce');
    dit(/\{selected\.itemId && estQuestion\(selected\) \? <div className="vrm-chat-foot"/.test(e) && /if\(!m \|\| !m\.itemId \|\| !estQuestion\(m\)/.test(e), '« Envoyer » n’existe que sur une question (sinon « Ouvrir sur eBay »)');
    dit(/call\('repondre',\{itemId:m\.itemId,messageId:m\.id,body:texte,confirme:true\}/.test(e) && /await confirm\(/.test(e), 'l’envoi passe par SA confirmation, puis `confirme:true`');
    dit(/const p=paireDe\?paireDe\(m\):null;/.test(e) && !/paireDe\([^)]*titre/.test(e), 'l’article (photo, N°) vient de `paireDe` (ItemID puis SKU VRM-{n°}), jamais du titre');
    const app = lire('src/App.jsx');
    dit(/const num = numEbayLu\(a && a\.sku, id, null, a && a\.depuis\)/.test(app), 'le N° vient du SKU de CETTE annonce (`numEbayLu`)');
  } catch (err) {
    dit(false, 'le banc s’exécute', String(err && err.stack || err).split('\n').slice(0, 2).join(' '));
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\n${ko ? '❌' : '✅'} questions-ebay : ${ko} rouge(s), ${ok} vert(s)${MUT ? ' [mutation ' + MUT + ']' : ''}`);
  process.exit(ko ? 1 : 0);
})();
