// ⚠️⚠️ CONTRÔLE PERMANENT — LES OFFRES REÇUES PAR EMAIL SONT RENDUES, UNE FOIS.
//
// Mesuré le 22 octobre (lecture seule, sa vraie base) : 248 offres `email_offer_*`
// ces 14 derniers jours (17 sur le dernier jour, 5 comptes) — et 0 offre en
// attente dans une conversation captée sur la même période (3 en tout, la plus
// récente du 15 septembre). Or la règle `offresAtraiter` n'était plus RENDUE
// nulle part depuis le 13 octobre (13f6c89 a retiré le bloc de Messages, la
// cloche est retirée le 17) : ses offres ne s'affichaient plus du tout.
//
// Ce contrôle exige :
//   1. que la règle soit APPELÉE au rendu (pas seulement définie — un composant
//      ou une règle jamais rendue ne lève rien, §4.11) ;
//   2. que la lecture reste en SCALAIRES (§4.4 : `extrait` jamais rapatrié),
//      bornée à la fenêtre, et qu'une page ratée vaille « pas su » ;
//   3. que « c'est fait » soit un réglage synchronisé, rattrapé à l'arrivée du
//      nuage (§5.49) ;
//   4. que la MÊME offre vue par email et dans sa conversation ne s'écrive
//      qu'une fois — par IDENTITÉ (compte, acheteur, montant, fenêtre ; le
//      titre seulement EN PLUS), jamais par ressemblance (§5). Exécuté dans un
//      `vm` sur la VRAIE fonction : on juge ce qu'elle rend.
//
// `--mutation sansqui` : la règle réaffaiblie qui ne demande plus l'acheteur ;
// `--mutation titreseul` : la règle réduite au titre. Les deux doivent être ROUGES.
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');
const mutation = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || (process.argv.includes('--mutation') ? process.argv[process.argv.indexOf('--mutation') + 1] : '');

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const essaie = (quoi, fn) => { try { return fn(); } catch (e) { dit(false, quoi, String((e && e.message) || e)); return null; } };
// Les commentaires ne comptent pas : un audit lit le CODE (leçon des sondes).
const CODE = APP.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// ── 1. La règle est RENDUE ───────────────────────────────────────────────────
// (La définition s'écrit `offresAtraiter = (` : seul un APPEL écrit `offresAtraiter(`.)
const appels = (CODE.match(/offresAtraiter\(/g) || []).length;
const defs = (CODE.match(/const offresAtraiter = \(/g) || []).length;
dit(defs === 1 && appels >= 1, 'la règle `offresAtraiter` est appelée au rendu (pas seulement définie)', `${appels} appel(s)`);
dit(/data-offres-messages=\{/.test(CODE), 'le bloc « offres à trancher » est rendu en tête de Messages');

// ── 2. La lecture ────────────────────────────────────────────────────────────
const lecture = (CODE.match(/lireTout\(`id=like\.email_offer_\*[^`]*`[^)]*\)/) || [])[0] || '';
dit(!!lecture, 'les offres email sont relues (Messages)', lecture ? '' : 'aucune lecture de `email_offer_*`');
dit(!!lecture && /meta->>receivedAt=gte\.\$\{depuis\}/.test(lecture) && /select=[^`]*meta->>/.test(lecture) && !/select=data|extrait/.test(lecture), 'en scalaires, bornées à la fenêtre — jamais `extrait` ni la ligne entière (§4.4)', lecture.slice(0, 140));
dit(!!lecture && /strict:\s*true/.test(lecture), 'une page ratée vaut « pas su », jamais une demi-liste', '');

// ── 3. « c'est fait » ────────────────────────────────────────────────────────
dit(/SYNC_KEYS[\s\S]{0,4000}'vinted_offers_done'/.test(CODE) || /'vinted_offers_done',/.test(CODE), '« c’est fait » est un réglage synchronisé (`vinted_offers_done`)');
dit(/onCloudReady\(\(\) => setOffresFaites\(/.test(CODE), 'et il est rattrapé à l’arrivée du nuage (§5.49)');

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
