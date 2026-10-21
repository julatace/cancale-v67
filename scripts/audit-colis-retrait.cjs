#!/usr/bin/env node
// AUDIT (17 oct.) — « Un colis au point relais SANS le code », « des colis à
// Vinted Go et d'autres à Kusmi Tea (aussi Vinted Go) ». Julien veut une
// interface FIABLE : lieu, transporteur, code et QR toujours cohérents.
//
// Formes MESURÉES sur sa base (lecture seule, 17 oct.) — reproduites ici avec
// des valeurs INVENTÉES (aucun vrai code, aucun vrai suivi) :
//   · email Vinted Go « Libère de la place dans la consigne » : en-tête
//     « Adresse » puis « *Consigne Vinted Go* », « * Kusmi Tea * », « * 13 Rue… »
//     (gras de la version texte) → lieu rangé « *Consigne Vinted Go*, * Kusmi Tea *… »
//     et `consigne:false` ;
//   · conversation Vinted (extension) : « Kusmi Tea, 13 Rue Saint-Vincent, 56000
//     Vannes, France » et « point relais TABAVAP, TABAVAP, 29 RUE HOCHE, 56000 VANNES » ;
//   · Mondial Relay : lieu « ® juste ici ! » (le texte d'un bouton).
// Il EXÉCUTE la vraie `parseCarrierEmail` (api/email-inbound.js) et la vraie
// `cleanLieu` (src/App.jsx, extraite par Babel).
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String(e && e.message || e).slice(0, 200)); } };

function chargeApp(noms) {
  const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
  const src = require('./_source-app.cjs')(path.join(R, 'src/App.jsx'));
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const t = {};
  for (const n of ast.program.body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id && noms.includes(d.id.name)) t[d.id.name] = 'const ' + src.slice(d.start, d.end) + ';';
  }
  const ctx = {}; vm.createContext(ctx);
  for (const nom of noms) if (t[nom]) { try { vm.runInContext(t[nom] + `\nthis.${nom}=${nom};`, ctx); } catch (_) {} }
  return ctx;
}

(async () => {
  const app = chargeApp(['titleCasePR', 'TYPE_LIEU', 'cleanLieuCorps', 'cleanLieu']);
  const { parseCarrierEmail } = await import('file://' + path.join(R, 'api/email-inbound.js'));

  await essaie('cleanLieu', () => {
    const cl = (x) => app.cleanLieu(x);
    const mail = cl('*Consigne Vinted Go*, * Kusmi Tea *, * 13 Rue Saint-Vincent');
    const conv = cl('Kusmi Tea, 13 Rue Saint-Vincent, 56000 Vannes, France');
    dit(mail.nom === conv.nom && /kusmi tea/i.test(mail.nom), 'la même consigne Vinted Go porte le MÊME nom, qu\'elle vienne de l\'email ou de la conversation (un endroit = un bloc)', `${mail.nom} / ${conv.nom}`);
    const autre = cl('*Consigne Vinted Go*, * Speed Queen - Vannes *, * 24 Rue Hoche');
    dit(autre.nom !== mail.nom, 'deux consignes Vinted Go d\'enseignes différentes ne se fondent PAS dans un bloc « Consigne Vinted Go »', `${autre.nom} / ${mail.nom}`);
    dit(!/\*/.test(mail.nom + mail.adresse + mail.display), 'aucun astérisque de la version texte ne s\'affiche', mail.display);
    const tab = cl('point relais TABAVAP, TABAVAP, 29 RUE HOCHE, 56000 VANNES');
    dit(/^tabavap$/i.test(tab.nom) && /29 rue hoche/i.test(tab.adresse), '« point relais TABAVAP, TABAVAP, … » → le nom « Tabavap », l\'adresse à part', JSON.stringify(tab));
    dit(cl('® juste ici !').nom === '', 'un slogan (« ® juste ici ! ») n\'est jamais un lieu');
    const mp = cl('Maison de la Presse, 40 Rue du Port, 35260 Cancale');
    dit(/maison de la presse/i.test(mp.nom) && /35260 cancale/i.test(mp.adresse), 'l\'autre sens : un lieu ordinaire garde son nom et son adresse', JSON.stringify(mp));
    const pk = cl('Consigne Pickup Carrefour City, 3 Rue X, 35000 Rennes');
    dit(/carrefour city/i.test(pk.nom) && /consigne pickup/i.test(pk.type || ''), 'une « Consigne Pickup <enseigne> » : l\'enseigne est le nom, le type est gardé à part', JSON.stringify(pk));
  });

  await essaie('email Vinted Go', () => {
    const text = [
      'Ton colis t\'attend à la consigne.', '', 'Saisis le code suivant : X12345', '', 'Numéro de suivi : 1790000000000001', '', 'Adresse',
      '*Consigne Vinted Go*', '* Kusmi Tea *', '* 13 Rue Saint-Vincent *', '* 56000 Vannes *', '', 'À retirer avant le 29/10/2026',
    ].join('\n');
    const t = parseCarrierEmail({ from: 'noreply@vinted.com', subject: 'Libère de la place dans la consigne : récupère ton colis sans attendre ! #1790000000000001', text, html: '' }, 'vinted');
    dit(t.status === 'available' && t.code === 'X12345', 'le code Vinted Go est lu', JSON.stringify({ s: t.status, c: t.code }));
    dit(t.lieu && !/\*/.test(t.lieu) && /kusmi tea/i.test(t.lieu) && /56000 vannes/i.test(t.lieu), 'le lieu est rangé sans astérisques, avec le code postal', t.lieu);
    dit(t.consigne === true, 'une consigne Vinted Go est une CONSIGNE (code à saisir, pas de comptoir)', String(t.consigne));
  });

  await essaie('email Mondial Relay', () => {
    const base = (corps) => parseCarrierEmail({ from: 'noreply@mondialrelay.fr', subject: 'Votre colis 12345678 est disponible 📦', text: corps, html: '' }, 'mondialrelay');
    const a = base('Bonjour,\nVotre colis est disponible.\nVotre code de retrait est 482913\nPoint Relais\nPhone Cash\n17 Rue Exemple\n56000 Vannes\nHoraires');
    dit(a.code === '482913', '« Votre code de retrait EST 482913 » : le code est lu', String(a.code));
    const b = base('Votre colis est disponible chez ® juste ici !\nCode de retrait : 715204');
    dit(b.code === '715204' && !b.lieu, 'un slogan n\'est pas rangé comme lieu (et le code reste lu)', JSON.stringify({ c: b.code, l: b.lieu }));
    const d = base('Votre colis est disponible.\nVotre PIN retrait\n\n931 207\nPoint Relais\nTabac X\n2 Rue Y\n56000 Vannes');
    dit(!d.code && typeof d.extraitCode === 'string' && /PIN/i.test(d.extraitCode), 'une forme encore inconnue : rien d\'inventé, mais les lignes « code / retrait / PIN » sont gardées pour la mesurer (`extraitCode`)', JSON.stringify({ c: d.code, e: d.extraitCode }));
  });

  // L'écran Achats rend un colis vu par Vinted dans le bloc du lieu que l'email
  // nomme (même nom normalisé) — vérifié dans le code de l'écran.
  await essaie('fusion des blocs', () => {
    const src = require('./_source-app.cjs')(path.join(R, 'src/App.jsx'));
    dit(/const extraFusion = \{\}/.test(src) && /extraFusion\[normNom\(nom\)\]/.test(src), 'un colis vu par Vinted rejoint le bloc email du même lieu (un endroit = un bloc)');
    dit(!/String\(rel\.lieu\)\.split\(','\)\[0\]/.test(src), 'le nom d\'un lieu vu par Vinted vient de `cleanLieu`, plus d\'un découpage à la virgule (§11)');
  });

  console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
