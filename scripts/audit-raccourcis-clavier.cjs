// Audit : RACCOURCIS CLAVIER + NOMS LUS (10 novembre, lot P) — src/raccourcisClavier.js,
// src/RaccourcisClavier.jsx, src/composants/Bouton.jsx.
// Ce que Julien a validé, mot pour mot : « jamais quand on tape dans un champ ; jamais un
// geste irréversible au clavier ». Donc :
//   · la règle (`toucheEcoutee`) refuse un champ de saisie, ⌘/Ctrl/Alt, une touche répétée,
//     une feuille modale ouverte ;
//   · chaque raccourci est `aller` (un écran de la liste blanche `ONGLETS_LIENS` d'App.jsx)
//     ou `ouvrir` (la liste « ? ») — RIEN d'autre ; le composant n'envoie que `vrm:aller`
//     et n'appelle aucune écriture ;
//   · « g » puis une lettre, en moins de 1,5 s ; une lettre inconnue ne fait rien ;
//   · un bouton en icône seule a toujours un nom lu (`nomBoutonIcone`).
// `--prouve` : chaque règle réaffaiblie doit faire passer l'audit au rouge.
require('./_source-app.cjs').brancher(); // App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');

async function charger(src, nom) {
  const f = path.join(R, 'src', `.${nom}-audit-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}
// Le JSX du bouton : on n'en garde que la fonction pure (pas de React à charger ici).
const purBouton = (src) => {
  const a = src.indexOf('export const NOMS_ICONES'); const b = src.indexOf('export function BoutonBase');
  return a >= 0 && b > a ? src.slice(a, b) : 'export const nomBoutonIcone = undefined;';
};
const ongletsLiens = () => {
  const app = lire('src/App.jsx');
  const m = /const ONGLETS_LIENS=\[\.\.\.Object\.keys\(CHEMINS_ARGENT\),([^\]]*)\]/.exec(app);
  return m ? new Set(m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, ''))) : new Set();
};
const champ = (tag, extra = {}) => ({ tagName: tag, isContentEditable: false, getAttribute: (k) => (extra.attrs || {})[k] || null, ...extra });
const ev = (key, o = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, defaultPrevented: false, target: champ('BODY'), ...o });

async function audit(srcRegle, srcComposant, srcBouton, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
  let M; try { M = await charger(srcRegle, 'raccourcisClavier'); } catch (e) { dit(false, 'le module se charge', e.message); return ko || 1; }
  // 1. Jamais dans un champ, jamais avec un modificateur, jamais sous une feuille modale.
  for (const [nom, e] of [
    ['dans un input', ev('a', { target: champ('INPUT') })], ['dans un textarea', ev('a', { target: champ('TEXTAREA') })],
    ['dans un select', ev('a', { target: champ('SELECT') })], ['contenteditable', ev('a', { target: champ('DIV', { isContentEditable: true }) })],
    ['role=textbox', ev('a', { target: champ('DIV', { attrs: { role: 'textbox' } }) })], ['role=combobox', ev('a', { target: champ('DIV', { attrs: { role: 'combobox' } }) })],
    ['⌘', ev('a', { metaKey: true })], ['Ctrl', ev('a', { ctrlKey: true })], ['Alt', ev('a', { altKey: true })],
    ['touche répétée', ev('g', { repeat: true })], ['déjà prise', ev('g', { defaultPrevented: true })],
  ]) dit(M.toucheEcoutee(e, false) === false, `une touche ${nom} n'est jamais un raccourci`);
  dit(M.toucheEcoutee(ev('g'), true) === false, 'une feuille modale ouverte : aucun raccourci');
  dit(M.toucheEcoutee(ev('g'), false) === true && M.toucheEcoutee(ev('?', { shiftKey: true }), false) === true, 'hors champ : « g » et « ? » (avec Maj) sont écoutés');
  // 2. « g » puis une lettre.
  const onglets = ongletsLiens();
  dit(onglets.size > 20, 'la liste blanche ONGLETS_LIENS est lue dans App.jsx', String(onglets.size));
  const touches = new Set();
  for (const a of M.ALLER) {
    dit(/^[a-z]$/.test(a.touche) && !touches.has(a.touche), `« g ${a.touche} » : une lettre, une seule fois`);
    touches.add(a.touche);
    dit(onglets.has(a.tab), `« g ${a.touche} » mène à un écran de la liste blanche (${a.tab})`);
    const r1 = M.lireTouche({ g: 0 }, 'g', 1000); const r2 = M.lireTouche(r1.etat, a.touche, 1600);
    dit(r2.action && r2.action.sorte === 'aller' && r2.action.lien === '?tab=' + a.tab, `« g » puis « ${a.touche} » ⇒ ${a.nom}`, JSON.stringify(r2.action));
  }
  // (11 nov., lot DJ3) Colis n'est plus un écran : ses deux moitiés sont en tête de Ventes et d'Achats.
  for (const n of ['journee', 'annonces', 'ventes', 'achats', 'messages']) dit(M.ALLER.some((a) => a.tab === n), `l'écran ${n} a son raccourci`);
  { const r1 = M.lireTouche({ g: 0 }, 'g', 1000); const r2 = M.lireTouche(r1.etat, 'a', 1000 + M.DELAI_SEQUENCE + 1);
    dit(!(r2.action && r2.action.sorte === 'aller' && /annonces/.test(r2.action.lien)), '« g » puis « a » après le délai : plus une séquence'); }
  { const r1 = M.lireTouche({ g: 0 }, 'g', 1000); const r2 = M.lireTouche(r1.etat, 'q', 1100); const r3 = M.lireTouche(r2.etat, 'a', 1200);
    dit(r2.action === null && r3.action === null, '« g » puis une lettre inconnue : rien, et la séquence est finie'); }
  dit(M.lireTouche({ g: 0 }, 'a', 1000).action === null && M.lireTouche({ g: 0 }, 'a', 1000).pris === false, '« a » seul : rien (la touche n’est pas prise)');
  // 3. Les touches seules : aller ou ouvrir, rien d'autre.
  for (const s of M.SEULES) dit(s.sorte === 'aller' || s.sorte === 'ouvrir', `« ${s.touche} » ne fait que naviguer ou ouvrir`, s.sorte);
  { const r = M.lireTouche({ g: 0 }, 'n', 1000); dit(r.action && r.action.sorte === 'aller' && r.action.lien === '?tab=achats&achat=1', '« n » ⇒ Nouvel achat, VIDE (aucun titre ni prix dans le lien)', JSON.stringify(r.action)); }
  { const r = M.lireTouche({ g: 0 }, '?', 1000); dit(r.action && r.action.sorte === 'ouvrir' && r.action.quoi === 'aide', '« ? » ⇒ la liste des raccourcis'); }
  dit(M.lireTouche({ g: 0 }, '/', 1000).pris === false, '« / » reste à App.jsx (pas écouté deux fois)');
  // 4. Le composant : il ne fait QUE naviguer (vrm:aller) ou ouvrir sa feuille.
  const c = sansCommentaires(srcComposant);
  const evts = [...c.matchAll(/new (?:Custom)?Event\('([^']+)'/g)].map((m) => m[1]);
  dit(evts.length > 0 && evts.every((x) => x === 'vrm:aller'), 'le composant n’envoie que « vrm:aller »', evts.join(', '));
  dit(!/\b(fetch|save|persist|modifierDonnee|askConfirm|localStorage|supabase)\s*\(|\.(setItem|removeItem)\(/.test(c), 'le composant n’écrit rien (ni base, ni stockage)');
  dit(/toucheEcoutee\(e, modaleOuverte\(\)\)/.test(c), 'le composant passe chaque touche par la règle (champ, modificateurs, feuille)');
  // 5. Le nom lu d'un bouton en icône seule.
  let B; try { B = await charger(purBouton(srcBouton), 'boutonNom'); } catch (e) { dit(false, 'le nom lu des boutons se charge', e.message); return ko || 1; }
  dit(typeof B.nomBoutonIcone === 'function', 'nomBoutonIcone existe');
  if (typeof B.nomBoutonIcone === 'function') {
    dit(B.nomBoutonIcone('close', {}) === 'Fermer', 'icône « close » seule ⇒ « Fermer »');
    dit(B.nomBoutonIcone('close', { title: 'Fermer la photo' }) === 'Fermer la photo', 'le titre passe avant le nom de l’icône');
    dit(B.nomBoutonIcone('close', { 'aria-label': 'X' }) === null, 'un aria-label posé par l’écran est gardé');
    dit(B.nomBoutonIcone('inconnue', {}) === 'Bouton', 'une icône sans nom connu ⇒ « Bouton » (jamais muet)');
    dit(B.nomBoutonIcone(null, {}) === null, 'un bouton sans icône : rien à ajouter');
  }
  dit(/const occ = \{[^\n]*\.\.\.\(nomIcone \? \{ 'aria-label': nomIcone \} : \{\}\) \};/.test(sansCommentaires(srcBouton)), 'BoutonBase pose le nom lu sur le bouton');
  return ko;
}

(async () => {
  const regle = lire('src/raccourcisClavier.js'), comp = lire('src/RaccourcisClavier.jsx'), bouton = lire('src/composants/Bouton.jsx');
  if (process.argv.includes('--prouve')) {
    const mut = [
      ['champ de saisie accepté', regle.replace("if (dansUnChamp(ev.target)) return false;", '')],
      ['feuille modale ignorée', regle.replace('if (modaleOuverte) return false;', '')],
      ['⌘ accepté', regle.replace('|| ev.metaKey ', '')],
      ['délai de séquence infini', regle.replace('maintenant - e.g <= DELAI_SEQUENCE', 'true')],
      ['« n » pré-rempli', regle.replace("'?tab=achats&achat=1'", "'?tab=achats&achat=1&prix=10'")],
      ['écran hors liste blanche', regle.replace("tab: 'messages'", "tab: 'colis'")],
      ['une sorte « ecrire »', regle.replace("{ touche: 'n', sorte: 'aller'", "{ touche: 'n', sorte: 'ecrire'")],
    ];
    const mutC = [
      ['le composant écrit', comp.replace('setOuvert(true);\n    };', 'setOuvert(true); try { localStorage.setItem("x","1"); } catch (_) {}\n    };')],
      ['le composant envoie un autre événement', comp.replace("new CustomEvent('vrm:aller'", "new CustomEvent('vrm:supprimer'")],
      ['règle contournée', comp.replace('toucheEcoutee(e, modaleOuverte())', 'true')],
    ];
    const mutB = [
      ['icône muette', bouton.replace("return NOMS_ICONES[icone] || 'Bouton';", "return NOMS_ICONES[icone] || '';")],
      ['nom non posé', bouton.replace("...(nomIcone ? { 'aria-label': nomIcone } : {}) };", '};')],
    ];
    let rate = 0;
    for (const [n, s] of mut) { if (s === regle) { console.log('⚠️  mutation sans effet : ' + n); rate++; continue; } const k = await audit(s, comp, bouton, false); console.log((k ? '✅ rouge : ' : '❌ RESTE VERT : ') + n); if (!k) rate++; }
    for (const [n, s] of mutC) { if (s === comp) { console.log('⚠️  mutation sans effet : ' + n); rate++; continue; } const k = await audit(regle, s, bouton, false); console.log((k ? '✅ rouge : ' : '❌ RESTE VERT : ') + n); if (!k) rate++; }
    for (const [n, s] of mutB) { if (s === bouton) { console.log('⚠️  mutation sans effet : ' + n); rate++; continue; } const k = await audit(regle, comp, s, false); console.log((k ? '✅ rouge : ' : '❌ RESTE VERT : ') + n); if (!k) rate++; }
    process.exit(rate ? 1 : 0);
  }
  const ko = await audit(regle, comp, bouton, true);
  console.log(ko ? `\n❌ ${ko} défaut(s)` : '\n✅ raccourcis clavier et noms lus : tout est tenu');
  process.exit(ko ? 1 : 0);
})();
