// 24 octobre : retrait explicite du bloc email dans Messages.
// La capture email et les règles de rapprochement sont conservées.
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');
const mutation = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || (process.argv.includes('--mutation') ? process.argv[process.argv.indexOf('--mutation') + 1] : '');

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const essaie = (quoi, fn) => { try { return fn(); } catch (e) { dit(false, quoi, String((e && e.message) || e)); return null; } };
// Les commentaires ne comptent pas : un audit lit le CODE (leçon des sondes).
const CODE = APP.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// La messagerie doit rester centrée sur les conversations et leurs offres.
dit(!/data-offres-messages/.test(CODE), 'plus de bloc historique des offres email dans Messages');
dit(!/lireTout\(`id=like\.email_offer_\*/.test(CODE), 'plus de lecture dédiée à ce bloc supprimé');
dit(/data-conv=/.test(CODE) && /data-offre-liste=/.test(CODE), 'les conversations et leurs offres restent rendues');
dit(/'vinted_offers_done',/.test(CODE), 'les choix déjà synchronisés ne sont pas effacés');

// ── 4. Une offre, une fois — par identité ────────────────────────────────────
const morceau = (re, quoi) => { const m = re.exec(APP); if (!m) { dit(false, `${quoi} introuvable dans App.jsx`); return null; } return m[0]; };
const fnNorm = morceau(/const normTitle = \([^\n]*\n/, '`normTitle`');
const fnBornes = (APP.match(/const OFFRE_(?:FENETRE_J|TOLERANCE_H) = [^\n]*\n/g) || []).join('');
const fnEuro = morceau(/const euroOffre = [^\n]*\n/, '`euroOffre`');
let fnMeme = morceau(/const memeOffre = \([\s\S]*?\n\};/, '`memeOffre`');
const fnHors = morceau(/const offresEmailHorsConversations = \([\s\S]*?\n\};/, '`offresEmailHorsConversations`');
if (fnMeme && mutation === 'sansqui') fnMeme = fnMeme.replace(/if \(!qui \|\|[^\n]*\n/, '');
if (fnMeme && mutation === 'titreseul') fnMeme = 'const memeOffre = (of, co) => !!of && !!co && normTitle(of.article || "") === normTitle(co.titre || "");';
let R = null;
if (fnNorm && fnBornes && fnEuro && fnMeme && fnHors) {
  R = essaie('la règle se charge', () => {
    const ctx = {}; vm.createContext(ctx);
    vm.runInContext(`${fnNorm}\n${fnBornes}\n${fnEuro}\n${fnMeme}\n${fnHors}\nglobalThis.R = { memeOffre, offresEmailHorsConversations };`, ctx, { filename: 'App.jsx' });
    return ctx.R;
  });
}
if (R) {
  const t0 = Date.parse('2026-10-20T10:00:00Z');
  const of = (x) => ({ id: 'email_offer_x', uid: '111', qui: 'acheteuse_1', montant: '45,00', receivedAt: new Date(t0 + 3600e3).toISOString(), article: 'Nike Air Max 1 blanc 42', ...x });
  const co = (x) => ({ uid: '111', login: 'Acheteuse_1', prix: 45, ts: t0, titre: 'Nike Air Max 1 blanc 42', ...x });
  const meme = (a, b) => essaie('memeOffre', () => R.memeOffre(a, b));
  dit(meme(of(), co()) === true, 'même compte, même acheteur (login, sans la casse), même montant, même fenêtre, même paire : la même offre');
  dit(meme(of(), co({ titre: '' })) === true, 'le titre de la paire absent côté conversation : l’identité suffit (le titre n’est qu’une contrainte EN PLUS)');
  dit(meme(of({ qui: '' }), co()) === false, 'SANS acheteur dans l’email (la forme mesurée sur ses 248 offres) : rien ne prouve que c’est la même — elle reste');
  dit(meme(of({ uid: '' }), co()) === false, 'sans compte : pas la même');
  dit(meme(of({ uid: '222' }), co()) === false, 'un autre compte : pas la même');
  dit(meme(of({ qui: 'acheteur_2' }), co()) === false, 'un autre acheteur : pas la même');
  dit(meme(of({ montant: '46,00' }), co()) === false, 'un autre montant (au centime) : pas la même');
  dit(meme(of({ montant: '' }), co()) === false, 'un montant illisible : pas la même');
  dit(meme(of({ receivedAt: new Date(t0 + 30 * 3600e3).toISOString() }), co()) === false, 'hors de la fenêtre de classement de l’email : pas la même');
  dit(meme(of(), co({ ts: null })) === false, 'une heure d’offre illisible : pas la même');
  dit(meme(of({ article: 'Nike Air Max 90 noir 43' }), co()) === false, 'deux paires différentes (les deux titres connus) : pas la même');
  dit(meme(of({ qui: '', montant: '45,00' }), co({ login: '' })) === false, 'le titre SEUL (même compte, même montant, même heure, aucun acheteur) ne désigne rien (§5)');
  const h = essaie('offresEmailHorsConversations', () => R.offresEmailHorsConversations([of({ id: 'a' }), of({ id: 'b', qui: '' })], [co()]));
  dit(!!h && JSON.stringify(h.affichees.map((x) => x.id)) === '["b"]' && JSON.stringify(h.dansConversation.map((x) => x.id)) === '["a"]', 'la même n’est pas réécrite, l’autre reste — et on sait combien sont dans leur conversation', JSON.stringify(h && { a: h.affichees.map((x) => x.id), c: h.dansConversation.map((x) => x.id) }));
  const p = essaie('pas su', () => R.offresEmailHorsConversations([of({ id: 'a' })], null));
  dit(!!p && p.affichees.length === 1 && p.dansConversation.length === 0, 'offres des conversations PAS SUES : rien n’est retiré (rien lu ne vaut pas rien)');
}
console.log(ko ? `\n❌ audit-offres-email : ${ko} rouge(s)` : '\n✅ audit-offres-email : tout est vert');
process.exit(ko ? 1 : 0);
