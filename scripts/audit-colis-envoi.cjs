#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  COLIS, CÔTÉ ENVOI (5 nov., chantier D) — node scripts/audit-colis-envoi.cjs [--mutations]
//  Les règles qui se jugent sans rendu. On EXÉCUTE src/design/friseFusion.js et
//  src/colisEnvoi.js, et on lit le branchement d'App.jsx et des feuilles de style.
//   F  La frise : `derniere` est posée sur la DERNIÈRE étape faite, une seule fois,
//      jamais sans étape faite ; l'étape en cours n'a plus de ton « encre »
//      (« attente », ou « urgent » seulement si un geste est dû) ; le CSS ne met
//      l'encre que sur `[data-derniere]` (plus sur `[data-fait="1"]` ni `[data-cours]`).
//   P  Le temps de préparation : jours de calendrier à Paris depuis la vente (pas su
//      ⇒ null, jamais 0) ; l'ordre : limite la plus proche, puis la plus ancienne ;
//      la phrase de l'attente ne dit jamais « retard ».
//   G  « En grand » : le titre n'est jamais un sujet d'e-mail (vouvoiement, « … est
//      disponible ») ; l'article d'abord, sinon « Colis <transporteur> » ; l'écran
//      rend « En grand » par `SheetShell lumineuse`, sans emoji.
//   T  La tournée : un groupe par transporteur dans l'ordre de l'écran, chaque colis
//      une fois par sa clé (jamais deux fois, même au même titre).
//   B  La barre du haut : les trois boutons ne dépendent pas de l'onglet ; plus de
//      lien « Tes emails… » ni de réglage d'imprimante dans Colis.
//   W  Le branchement : « Tout imprimer » et l'écran rangent par la même règle.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const remplace = (s, avant, apres, nom) => { if (!s.includes(avant)) throw new Error('mutation ' + nom + ' : ancre introuvable'); return s.split(avant).join(apres); };
// Chaque mutation réaffaiblit UNE règle : l'audit doit rougir.
const MUTATIONS = {
  'encre-cours': { frise: (s) => remplace(s, "etapes[i].ton = geste ? 'urgent' : 'attente';", "etapes[i].ton = geste ? 'urgent' : 'encre';", 'encre-cours') },
  'derniere-absente': { frise: (s) => remplace(s, 'etapes.forEach((e, k) => { e.derniere = k === d; });', 'etapes.forEach((e) => { e.derniere = !!e.fait; });', 'derniere-absente') },
  'css-encre-fait': { css: (s) => remplace(s, '.vrm-fu-seg[data-derniere] > span { color: var(--fu-encre); }', '.vrm-fu-seg[data-fait="1"] > span { color: var(--fu-encre); }', 'css-encre-fait') },
  'attente-zero': { envoi: (s) => remplace(s, 'if (t == null || t > maintenant + 60e3) return null;', 'if (t == null || t > maintenant + 60e3) return 0;', 'attente-zero') },
  'ordre-recent': { envoi: (s) => remplace(s, 'at(b[0]) - at(a[0])', 'at(a[0]) - at(b[0])', 'ordre-recent') },
  'titre-sujet': { envoi: (s) => remplace(s, 'if (a && !ressembleSujetEmail(a)) return a;', 'if (a) return a;', 'titre-sujet').replace('if (t && !ressembleSujetEmail(t)) return t;', 'if (t) return t;') },
  'tournee-doublon': { envoi: (s) => remplace(s, 'if (!k || vus.has(k)) continue;', 'if (!k) continue;', 'tournee-doublon') },
  'barre-onglet': { app: (s) => remplace(s, '<div className="vrm-colis-barre" data-colis-barre="">', '<div className="vrm-colis-barre" data-colis-barre="">{onglet === \'retirer\' ? null : <span/>}', 'barre-onglet') },
  'journal-revenu': { app: (s) => remplace(s, "{/* (5 nov., revue 2.21) « Tes emails, ce que VRM en a fait » n'est plus dans Colis", "{ongletColisVu === 'envoyer' ? <EntreeJournalEmails headers={sbAuth}/> : null}{/* (5 nov., revue 2.21) « Tes emails, ce que VRM en a fait » n'est plus dans Colis", 'journal-revenu') },
  'en-grand-sombre': { app: (s) => remplace(s, '<SheetShell lumineuse onClose={() => setQrView(null)}', '<SheetShell onClose={() => setQrView(null)}', 'en-grand-sombre') },
  'lot-autre-ordre': { app: (s) => remplace(s, 'return rangerColisEnvoi([...exTout.filter(x => !estPosteColis(x)), ...autresColis], trNomColis);', 'return rangerParTransporteur([...exTout.filter(x => !estPosteColis(x)), ...autresColis], { trNom: trNomColis, jours: (x) => x.dl });', 'lot-autre-ordre') },
};
if (args.includes('--mutations')) {
  let t = 0;
  for (const nom of Object.keys(MUTATIONS)) { const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8' }); if (r.status !== 0) t++; console.log((r.status !== 0 ? '✅ tuée    ' : '❌ SURVIT  ') + nom); }
  const n = Object.keys(MUTATIONS).length; console.log(`\n${t === n ? '✅' : '❌'} mutations : ${t}/${n} tuées`); process.exit(t === n ? 0 : 1);
}
const M = MUTATION ? MUTATIONS[MUTATION] : null;
if (MUTATION && !M) { console.log('mutation inconnue : ' + MUTATION); process.exit(2); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-colis-envoi-'));
const lire = (rel, tr) => { let s = fs.readFileSync(path.join(RACINE, rel), 'utf8'); if (tr) s = tr(s); return s; };
const charger = async (rel, nom, tr) => {
  const src = path.join(RACINE, rel);
  let s = lire(rel, tr);
  s = s.replace(/from '(\.\.?\/[^']+)'/g, (_, f) => `from '${pathToFileURL(path.join(path.dirname(src), f)).href}'`);
  const f = path.join(tmp, nom + '.mjs'); fs.writeFileSync(f, s); return import(pathToFileURL(f).href);
};
const essaie = async (nom, f) => { try { return await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); return undefined; } };

(async () => {
  const fu = await essaie('friseFusion.js chargé', () => charger('src/design/friseFusion.js', 'frise', M && M.frise));
  const ce = await essaie('colisEnvoi.js chargé', () => charger('src/colisEnvoi.js', 'envoi', M && M.envoi));
  const css = lire('src/design/fusion.css', M && M.css);
  const app = lire('src/App.jsx', M && M.app);
  const friseJsx = lire('src/design/Frise.jsx');
  if (!fu || !ce) { console.log(`\n❌ ${ko} rouge(s)`); process.exit(1); }

  // ── F : la frise.
  await essaie('F', () => {
    const cas = [
      [{}, -1, 'rien de fait'], [{ imprime: true }, 0, 'imprimé'], [{ depose: true }, 1, 'déposé (imprimé déduit)'],
      [{ imprime: true, depose: true, enroute: true }, 2, 'en route'], [{ livre: true }, 3, 'livré'],
    ];
    for (const [lues, attendu, nom] of cas) for (const geste of [false, true]) {
      const f = fu.friseColisFusion(lues, { geste });
      const d = f.map((e) => !!e.derniere);
      const nD = d.filter(Boolean).length;
      dit(attendu === -1 ? nD === 0 : (nD === 1 && d[attendu]), `F colis « ${nom} »${geste ? ' (geste dû)' : ''} : l'encre sur la dernière étape faite seulement`, JSON.stringify(f.map((e) => e.cle + (e.fait ? '+' : '-') + (e.derniere ? '*' : ''))));
      const cours = f.find((e) => e.cours);
      dit(!cours || (cours.ton === (geste ? 'urgent' : 'attente') && !cours.derniere), `F colis « ${nom} »${geste ? ' (geste dû)' : ''} : l'étape en cours n'est jamais à l'encre`, cours ? cours.cle + ':' + cours.ton : 'aucune');
    }
    const v = fu.friseVenteLue({ vendue: true, postee: true }, {});
    dit(v.filter((e) => e.derniere).map((e) => e.cle).join() === 'postee', 'F vente (Leboncoin, eBay, Vestiaire) : la même loi', JSON.stringify(v.map((e) => e.cle + (e.derniere ? '*' : ''))));
    dit(/data-derniere=\{e\.derniere \? '' : undefined\}/.test(friseJsx), 'F Frise.jsx rend `data-derniere`');
    const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const encre = [...sansCommentaires.matchAll(/([^{}]*)\{([^}]*)\}/g)].filter(([, sel, decl]) => /\.vrm-fu-seg/.test(sel) && /color:\s*var\(--fu-encre\)/.test(decl) && /> span/.test(sel)).map(([, sel]) => sel.trim());
    dit(encre.length > 0 && encre.every((s) => /\[data-derniere\]/.test(s) && !/\[data-fait="1"\]|\[data-cours\]/.test(s)), 'F fusion.css : le mot à l\'encre seulement sur [data-derniere]', JSON.stringify(encre));
    const traitEncre = [...sansCommentaires.matchAll(/([^{}]*)\{([^}]*)\}/g)].filter(([, sel, decl]) => /\.vrm-fu-seg/.test(sel) && /> i/.test(sel) && /background:\s*var\(--fu-encre\)/.test(decl)).map(([, sel]) => sel.trim());
    dit(!traitEncre.length, 'F fusion.css : aucun trait d\'étape à l\'encre (en cours = piste, ou ambre si geste)', JSON.stringify(traitEncre));
  });

  // ── P : temps de préparation.
  await essaie('P', () => {
    const now = Date.parse('2026-11-05T10:00:00Z');
    dit(ce.joursAttente('2026-11-05T08:00:00Z', now) === 0, 'P vendue ce matin ⇒ 0 j');
    dit(ce.joursAttente('2026-11-04T22:30:00Z', now) === 1, 'P vendue la veille à 23 h 30 (Paris) ⇒ 1 j (jours de calendrier à Paris)', String(ce.joursAttente('2026-11-04T22:30:00Z', now)));
    dit(ce.joursAttente('2026-11-04T23:30:00Z', now) === 0, 'P vendue à 0 h 30 (Paris) ce jour ⇒ 0 j (pas le jour UTC)', String(ce.joursAttente('2026-11-04T23:30:00Z', now)));
    dit(ce.joursAttente('2026-11-02T10:00:00Z', now) === 3, 'P vendue il y a trois jours ⇒ 3');
    dit(ce.joursAttente('', now) === null && ce.joursAttente('pas une date', now) === null && ce.joursAttente(null, now) === null, 'P date illisible ⇒ null (pas su, jamais 0)');
    dit(ce.joursAttente('2026-11-09T10:00:00Z', now) === null, 'P date dans le futur ⇒ null');
    const it = [{ k: 'a', dl: 1, att: 2 }, { k: 'b', dl: 1, att: 6 }, { k: 'c', dl: null, att: 9 }, { k: 'd', dl: -1, att: 9 }, { k: 'e', dl: 4, att: 3 }, { k: 'f', dl: 1, att: null }];
    const o = ce.ordrePreparation(it, { jours: (x) => x.dl, attente: (x) => x.att }).map((x) => x.k).join('');
    dit(o === 'dbafec', 'P ordre : limite la plus proche, à limite égale la plus ancienne, sans limite à la fin', o);
    for (const j of [0, 1, 6, 30]) dit(!/retard/i.test(ce.texteAttente(j)) && /\d|aujourd/.test(ce.texteAttente(j)), `P phrase d'attente (${j} j) neutre`, ce.texteAttente(j));
    dit(ce.texteAttente(null) === '', 'P attente pas sue ⇒ rien écrit');
  });

  // ── G : le titre de « En grand ».
  await essaie('G', () => {
    const t = (o) => ce.titreEnGrand(o);
    dit(t({ article: 'Air Max 90 blanche 42', transporteur: 'Mondial Relay' }) === 'Air Max 90 blanche 42', 'G l\'article relié d\'abord');
    dit(t({ artTitle: 'Votre colis 81000001 est disponible dans votre Point Relais', transporteur: 'Mondial Relay' }) === 'Colis Mondial Relay', 'G un sujet vouvoyé ⇒ « Colis <transporteur> »');
    dit(t({ artTitle: 'Ton achat t’attend au point relais', transporteur: 'Chronopost' }) === 'Colis Chronopost', 'G « Ton achat t\'attend… » ⇒ « Colis <transporteur> »');
    dit(t({ artTitle: 'Samba noire 40', transporteur: 'Vinted Go' }) === 'Samba noire 40', 'G un vrai titre d\'article porté par l\'e-mail reste');
    dit(t({}) === 'Colis', 'G rien de lu ⇒ « Colis »');
    dit(/title: titreEnGrand\(/.test(app), 'G App.jsx : le titre de « En grand » passe par `titreEnGrand`');
    const bloc = (app.split('{/* ── « EN GRAND »')[1] || '').split('{/* ── Bandeau « Annuler »')[0];
    dit(/<SheetShell lumineuse[\s\S]{0,400}?data-qr-plein=""/.test(bloc), 'G « En grand » : `SheetShell lumineuse` (plus de calque fait main)', bloc ? '' : 'bloc introuvable');
    const sansCom = bloc.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '');
    dit(!/[☀-➿\u{1F300}-\u{1FAFF}⏰-⏿]/u.test(sansCom), 'G « En grand » : aucun emoji');
  });

  // ── T : la tournée.
  await essaie('T', () => {
    const it = [{ c: 'v:1', t: 'Mondial Relay' }, { c: 'v:2', t: 'Chronopost' }, { c: 'v:3', t: 'Mondial Relay' }, { c: 'v:1', t: 'Mondial Relay' }, { c: 'vc:9', t: '' }];
    const g = ce.groupesTournee(it, { trNom: (x) => x.t, cle: (x) => x.c });
    dit(JSON.stringify(g.map((x) => [x.nom, x.colis.map((y) => y.c)])) === JSON.stringify([['Mondial Relay', ['v:1', 'v:3']], ['Chronopost', ['v:2']], ['Autres', ['vc:9']]]), 'T un groupe par transporteur (ordre de l\'écran), chaque clé une fois, sans transporteur ⇒ « Autres »', JSON.stringify(g.map((x) => [x.nom, x.colis.map((y) => y.c)])));
    dit(/groupesTournee\(tourneeItems, \{ trNom: \(t\) => trNomDe\(t\.x\), cle: \(t\) => t\.cle \}\)/.test(app), 'T App.jsx : la tournée groupe les colis de la liste par le transporteur de l\'écran');
    dit(/data-tournee-depose=\{t\.cle\}[\s\S]{0,200}deposeScan\.demander\(t\.cle/.test(app), 'T App.jsx : « Déposé » = le geste existant (`deposeScan`), par la clé du colis');
  });

  // ── B : la barre du haut.
  await essaie('B', () => {
    const barre = (app.split('<div className="vrm-colis-barre" data-colis-barre="">')[1] || '').split('</div>')[0];
    dit(!!barre && ['scanner', 'imprimer', 'outils'].every((k) => barre.includes(`data-colis-barre-btn="${k}"`)), 'B les trois boutons de la barre');
    dit(!!barre && !/onglet\s*===|ongletColisVu/.test(barre), 'B la barre ne dépend pas de l\'onglet', barre.match(/onglet\s*===[^?]*/) ? barre.match(/onglet\s*===[^?]*/)[0] : '');
    const sansCom = app.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    dit(!/<EntreeJournalEmails\b/.test(sansCom), 'B « Tes emails, ce que VRM en a fait » n\'est plus rendu dans Colis');
    dit(!/className="vrm-colis-imprimante"/.test(sansCom), 'B le réglage d\'imprimante n\'est plus en double dans Colis (il est dans Paramètres)');
  });

  // ── W : une règle d'ordre pour l'écran et « Tout imprimer ».
  await essaie('W', () => {
    dit(/const colisAEnvoyerRanges = \(\) => \{[^\n]*rangerColisEnvoi\(/.test(app), 'W « Tout imprimer » range par `rangerColisEnvoi`');
    dit(/const exT = rangerColisEnvoi\(tous, trNomDe\);/.test(app), 'W l\'écran range par `rangerColisEnvoi`');
  });

  console.log(ko ? `\n❌ audit-colis-envoi : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-colis-envoi : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
