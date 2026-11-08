// ═══════════════════════════════════════════════════════════════════════════
//  LES OFFRES QUI EXPIRENT (5 nov., chantier G) — la règle EXÉCUTÉE
//        node scripts/audit-offres-expirent.cjs [--mutation]
// ═══════════════════════════════════════════════════════════════════════════
//  E1  `expireBientot` (src/offresVestiaire.js) : une offre Vestiaire REÇUE dont
//      l'échéance LUE tombe dans moins de 6 h ⇒ oui ; à 6 h pile, au-delà, déjà
//      passée, expirée, ou sans échéance lue ⇒ non (« pas su » ≠ « bientôt »).
//  E2  seule une offre à TRANCHER (`aTrancher` : à toi, ouverte, pas expirée) la
//      porte : une offre que TU as envoyée (`enAttente`) n'est jamais « à toi de
//      répondre », même si elle expire dans 1 h.
//  E3  l'écran l'utilise UNE fois : la carte d'offre de Messages · Vestiaire
//      (`data-vc-offre-bientot`, la classe ambre `is-bientot`) ; la pastille
//      « offre » de la liste ne la lit pas.
//  E4  VINTED N'A AUCUNE EXPIRATION (Julien, 5 nov. : « les offres Vinted
//      n'expirent pas ») : aucun fichier hors Vestiaire n'importe la règle, et le
//      code des offres Vinted (fil, liste, Ma journée, e-mails) n'écrit nulle
//      part qu'une offre Vinted « expire » ou « a expiré ».
//  `--mutation` : chaque règle affaiblie à son tour doit rendre l'audit rouge.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');

async function juger(src) {
  let ko = 0, ok = 0; const lignes = [];
  const dit = (c, m, d) => { if (c) ok++; else ko++; lignes.push((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
  // Le module de règle est chargé depuis le texte jugé (mutations comprises).
  const tmp = path.join(require('os').tmpdir(), `offres-vc-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, src.regle);
  let M;
  try { M = await import(pathToFileURL(tmp).href); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
  const T = Date.UTC(2026, 10, 5, 12, 0);
  const o = (h, plus = {}) => ({ expire: T + h * 3600e3, expiree: false, ...plus });
  // E1
  const cas = [
    [o(0.5), true, '30 min'], [o(3), true, '3 h'], [o(5.99), true, '5 h 59'],
    [o(6), false, '6 h pile'], [o(6.01), false, '6 h 01'], [o(20), false, '20 h'],
    [o(-1), false, 'déjà passée'], [o(2, { expiree: true }), false, 'marquée expirée'],
    [{ expire: null }, false, 'échéance pas lue'], [{}, false, 'aucune échéance'], [null, false, 'rien'],
    [{ expire: NaN }, false, 'échéance illisible'], [{ expire: '2026-11-05T14:00:00Z' }, false, 'échéance en texte (pas lue par la règle)'],
  ];
  const faux = cas.filter(([x, attendu]) => (typeof M.expireBientot === 'function' ? M.expireBientot(x, T) : null) !== attendu);
  dit(typeof M.expireBientot === 'function' && faux.length === 0, 'E1 · `expireBientot` : moins de 6 h ⇒ oui ; 6 h pile, plus tard, passée, expirée, pas lue ⇒ non', faux.map((x) => x[2]).join(', '));
  dit(M.EXPIRE_BIENTOT_MS === 6 * 3600e3, 'E1 · le seuil est 6 heures', String(M.EXPIRE_BIENTOT_MS));
  // E2 — sur la vraie forme de `vc_offres` lue par `offresVestiaire`.
  const ligne = { capturedAt: new Date(T).toISOString(), offres: {
    n1: { id: '101', produit: '9001', expire: new Date(T + 2 * 3600e3).toISOString(), ouverte: true, aToi: true, dernier: { action: 'offer', par: 'acheteur', at: '' } },
    n2: { id: '102', produit: '9002', expire: new Date(T + 1 * 3600e3).toISOString(), ouverte: true, aToi: false, dernier: { action: 'offer', par: 'vendeur', at: '' } },
    n3: { id: '103', produit: '9003', expire: new Date(T - 1 * 3600e3).toISOString(), ouverte: true, aToi: true, dernier: { action: 'offer', par: 'acheteur', at: '' } },
  } };
  const e = M.offresVestiaire(ligne, T);
  const aT = (e.aTrancher || []).filter((x) => typeof M.expireBientot === 'function' && M.expireBientot(x, T)).map((x) => x.id);
  const eA = (e.enAttente || []).map((x) => x.id);
  dit(aT.join() === '101' && eA.join() === '102', 'E2 · seule l’offre REÇUE à trancher est « bientôt » ; l’offre envoyée ne l’est jamais ; l’expirée n’est plus à trancher', JSON.stringify({ aT, eA }));
  // E3
  const carte = src.carte;
  dit(/import\s*\{[^}]*\bexpireBientot\b[^}]*\}\s*from\s*'\.\/offresVestiaire\.js'/.test(carte) && /const bientot = expireBientot\(o, maintenant\)/.test(carte)
    && /data-vc-offre-bientot=\{bientot \? '1' : undefined\}/.test(carte) && /is-bientot/.test(carte), 'E3 · la carte d’offre Vestiaire porte la règle : `data-vc-offre-bientot` et le temps restant en ambre (`is-bientot`)');
  dit(/\.vrm-of-reste\.is-bientot\s*\{[^}]*color:\s*var\(--vrm-warn\)/.test(src.css), 'E3 · l’ambre est celui du geste (`--vrm-warn`), posé sur le temps restant seul');
  const tag = (src.app.match(/className="vrm-of-tag"[^>]*>[^<]*/) || [''])[0];
  dit(!!tag && !/bientot|expire/i.test(tag), 'E3 · la pastille « offre » de la liste reste neutre (l’ambre n’est dit qu’une fois)', tag.slice(0, 120));
  // E4 — personne d'autre n'importe la règle ; aucune offre Vinted n'« expire ».
  const importeurs = src.fichiers.filter(([f, t]) => /\bexpireBientot\b|\bEXPIRE_BIENTOT_MS\b/.test(t) && !/offresVestiaire\.js$|OffresVestiaire\.jsx$/.test(f)).map(([f]) => f);
  dit(importeurs.length === 0, 'E4 · la règle n’est utilisée QUE pour Vestiaire (aucun autre fichier ne l’importe)', importeurs.join(', '));
  const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const vinted = sansCommentaires(src.vintedOffres);
  const dits = (vinted.match(/['"`][^'"`\n]*\b(?:expir\w*)[^'"`\n]*['"`]/gi) || []).filter((x) => !/vestiaire|ebay|bordereau|lien|jeton|session|cookie|token|code/i.test(x));
  dit(src.vintedOffres.length > 2000 && dits.length === 0, 'E4 · le code des offres Vinted (liste et fil de Messages, Ma journée, e-mails) n’écrit jamais qu’une offre « expire »', dits.slice(0, 4).join(' | '));
  return { ok, ko, lignes };
}

function sources() {
  const app = require("./_source-app.cjs").sourceApp();
  // Les offres Vinted : le bloc Messages (liste + fil) de `Comptabilite`, et les règles qu'il lit.
  const debutFil = app.indexOf('const rendreConversation=()=>openConv');
  const finFil = app.indexOf('const rendreFicheConv', debutFil) > 0 ? app.indexOf('const rendreFicheConv', debutFil) : debutFil + 40000;
  const debutListe = app.indexOf("{/* ── Messages (séparés par compte via le sélecteur) ── */}");
  const finListe = app.indexOf('{/* ── Bordereaux (ventes non annulées avec un numéro, à imprimer) ── */}', debutListe);
  const extra = ['src/messagesLisibles.js', 'src/cibleNotif.js'].filter((f) => fs.existsSync(path.join(R, f))).map(lire).join('\n');
  const vintedOffres = (debutFil > 0 ? app.slice(debutFil, finFil) : '') + '\n' + (debutListe > 0 && finListe > debutListe ? app.slice(debutListe, finListe) : '') + '\n' + extra;
  const fichiers = [];
  const parcourir = (d) => { for (const n of fs.readdirSync(path.join(R, d), { withFileTypes: true })) { const f = path.join(d, n.name); if (n.isDirectory()) parcourir(f); else if (/\.(jsx?|mjs|cjs)$/.test(n.name)) fichiers.push([f, lire(f)]); } };
  parcourir('src'); parcourir('api');
  return { regle: lire('src/offresVestiaire.js'), carte: lire('src/OffresVestiaire.jsx'), css: lire('src/styles-messages.css'), app, vintedOffres, fichiers };
}

(async () => {
  const s = sources();
  const r = await juger(s);
  r.lignes.forEach((l) => console.log(l));
  if (process.argv.includes('--mutation')) {
    const mutants = [
      ['seuil à 24 h', (x) => ({ ...x, regle: x.regle.replace('6 * 3600e3', '24 * 3600e3') })],
      ['« pas su » vaut « bientôt »', (x) => ({ ...x, regle: x.regle.replace("o.expiree === true) return false;", "o.expiree === true) return o ? o.expiree !== true : true;") })],
      ['une offre passée compte', (x) => ({ ...x, regle: x.regle.replace('return reste > 0 && reste < EXPIRE_BIENTOT_MS;', 'return reste < EXPIRE_BIENTOT_MS;') })],
      ['6 h pile compte', (x) => ({ ...x, regle: x.regle.replace('reste < EXPIRE_BIENTOT_MS', 'reste <= EXPIRE_BIENTOT_MS') })],
      ['la carte ne lit plus la règle', (x) => ({ ...x, carte: x.carte.replace('const bientot = expireBientot(o, maintenant)', 'const bientot = false') })],
      ['la pastille de liste devient ambre', (x) => ({ ...x, app: x.app.replace('className="vrm-of-tag"', 'className="vrm-of-tag is-bientot"') })],
      ['Vinted importe la règle', (x) => ({ ...x, fichiers: [...x.fichiers, ['src/App.jsx', "import { expireBientot } from './offresVestiaire.js';"]] })],
      ['une offre Vinted « a expiré »', (x) => ({ ...x, vintedOffres: x.vintedOffres + "\nconst t = 'Offre expirée';" })],
      ['ambre hors du geste', (x) => ({ ...x, css: x.css.replace(/(\.vrm-of-reste\.is-bientot\s*\{[^}]*color:\s*)var\(--vrm-warn\)/, '$1var(--vrm-muted)') })],
    ];
    let rouges = 0;
    for (const [nom, m] of mutants) {
      const x = await juger(m(s));
      if (x.ko > 0) rouges++;
      console.log(`${x.ko > 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${x.ko} rouge(s)`);
    }
    console.log(`\n${rouges}/${mutants.length} mutations rouges`);
    if (rouges !== mutants.length) process.exitCode = 1;
  }
  console.log(`\n${r.ok} vert(s), ${r.ko} rouge(s).`);
  if (r.ko) process.exitCode = 1;
})();
