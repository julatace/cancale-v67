// Audit : ANNONCES — CHANTIER C (5 nov., revue de cohérence 2.5 à 2.10).
// Ce qui se juge SANS rendu (le rendu : scripts/bancs/annonces-coherence.cjs).
//
//   R. `raisonCommune` (src/annoncesActions.js) : la raison partagée par les tuiles
//      grisées se dit UNE fois (tête), jamais sous chaque tuile ; la raison propre
//      d'une tuile reste sous elle ; une tuile possible garde sa description ;
//   T. quatre tuiles, dans l'ordre, avec les quatre mots retenus ; « à la main »
//      n'est pas une tuile ;
//   A. l'app : une seule feuille d'actions (plus de `data-actions-menu`, plus de
//      « Republier et brouillons ») ; « Republier… » et l'entrée « Republier » du
//      menu mènent à la vue « Sélectionner » ; la feuille lit `raisonCommune` ;
//   Z. la zone Annonces (écran, sélection, feuille) : aucun « Baisser à » à part,
//      aucun TEXTE en `C.accent`, plus de « refuse < », le filtre ne s'appelle
//      plus « sélection », aucun mot écarté (`motsEcartesDans`, src/libelles.js),
//      `Numero` / `PhotoVide` / `ChampRecherche` / `SheetShell titre` branchés, plus
//      de croix « ✕ » faite main dans la feuille Actions ;
//   C. la carte : deux gestes + « … » dans la rangée ; la case « prix d'achat »
//      n'est plus ambre (styles-annonces-coherence.css l'emporte) ; un bandeau.
// `--prouve` : chaque règle réaffaiblie doit passer au rouge.
const fs = require('fs'), path = require('path'), os = require('os');
const RAC = path.join(__dirname, '..');
const F = {
  src: path.join(RAC, 'src', 'annoncesActions.js'),
  app: path.join(RAC, 'src', 'App.jsx'),
  css: path.join(RAC, 'src', 'styles-annonces-coherence.css'),
  lib: path.join(RAC, 'src', 'libelles.js'),
};

const MUTATIONS = {
  raison_partout: { f: 'src', m: (s) => s.replace("(x.raison === tete ? '' : x.raison)", 'x.raison') },
  pas_de_tete: { f: 'src', m: (s) => s.replace("for (const [r, n] of compte) if (n > max) { max = n; tete = r; }", '') },
  cinq_tuiles: { f: 'src', m: (s) => s.replace('export const ACTIONS_TUILES = ACTIONS_SELECTION.filter((A) => !A.lien)', 'export const ACTIONS_TUILES = ACTIONS_SELECTION.filter((A) => A)') },
  vieux_mots: { f: 'src', m: (s) => s.replace("titre: 'Modifier prix ou titre'", "titre: 'En ligne → en ligne, avec tes modifications'") },
  feuille_revenue: { f: 'app', m: (s) => s.replace("if(only==='annonces' && prendreVue('republier')) setAnnSort('selection');", "if(only==='annonces' && prendreVue('republier')) setActionsOpen(true);") },
  republier_feuille: { f: 'app', m: (s) => s.replace("data-actions-ouvrir=\"\" aria-pressed={annSort==='selection'} title=\"Republier : coche les annonces, puis Actions\"\n              onClick={()=>setAnnSort('selection')}", "data-actions-ouvrir=\"\" aria-pressed={annSort==='selection'} title=\"Republier : coche les annonces, puis Actions\"\n              onClick={()=>setActionsOpen(true)}") },
  baisser_revenu: { f: 'app', m: (s) => s.replace('<button type="button" className="vrm-fiche-geste" data-fiche-vendue=""', '<a className="vrm-fiche-geste" style={{color:C.accent}}>Baisser à 9 €</a><button type="button" className="vrm-fiche-geste" data-fiche-vendue=""') },
  refuse_chevron: { f: 'app', m: (s) => s.replace('<span style={lib}>Refuser sous</span>', "<span style={lib}>{'refuse <'}</span>") },
  filtre_selection: { f: 'app', m: (s) => s.replace("return `${k} annonce${k>1?'s':''} affichée${k>1?'s':''}`;", "return `${k} annonce${k>1?'s':''} dans cette sélection`;") },
  num_main: { f: 'app', m: (s) => s.replace('<Numero n={a.numero} taille="petit" className="vrm-sel-num"/>', '<span className="vrm-sel-num">N°{a.numero}</span>') },
  photo_vide_main: { f: 'app', m: (s) => s.replace('<PhotoVide remplir rayon={0}/>', '<Icon name="image" size={28}/>') },
  achat_ambre: { f: 'css', m: (s) => s.replace('border-color: var(--vrm-line) !important; background: var(--vrm-bg) !important;', 'border-color: var(--vrm-warn) !important;') },
  geste_en_trop: { f: 'app', m: (s) => s.replace('<button type="button" className="vrm-fiche-geste vrm-fiche-geste-plus"', '<button type="button" className="vrm-fiche-geste" data-fiche-passeport="">Passeport</button><button type="button" className="vrm-fiche-geste vrm-fiche-geste-plus"') },
  croix_main: { f: 'app', m: (s) => s.replace("<SheetShell onClose={onClose} maxWidth={520} titre={`Actions · ${n} annonce${n > 1 ? 's' : ''}`}>", "<SheetShell onClose={onClose} maxWidth={520}><button type=\"button\" onClick={onClose} aria-label=\"Fermer\">✕</button>") },
  mot_ecarte: { f: 'app', m: (s) => s.replace('Coche des annonces d’un même compte, puis ', 'Coche des annonces à poster, puis ') },
};

async function charger(src, nom) {
  const f = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src.replace(/from '\.\/([^']+)'/g, (_, m) => `from '${require('url').pathToFileURL(path.join(RAC, 'src', m)).href}'`));
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}
// Les commentaires retirés avant de chercher (§6.4 : juger la règle, pas son orthographe).
const sansCommentaires = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const tranche = (s, a, b) => { const i = s.indexOf(a); if (i < 0) return ''; const j = s.indexOf(b, i + a.length); return j < 0 ? '' : s.slice(i, j); };

async function auditer(S) {
  const out = []; const dit = (ok, m, d) => out.push({ ok: !!ok, m, d });
  const R0 = await charger(S.src, 'annoncesActions');
  // Sur un arbre d'avant, ces règles n'existent pas : elles RÉPONDENT faux (rouge), sans planter.
  const R = { ...R0, ACTIONS_TUILES: R0.ACTIONS_TUILES || [], raisonCommune: typeof R0.raisonCommune === 'function' ? R0.raisonCommune : () => ({ tete: '', parTuile: {} }) };
  const Lb = await charger(S.lib, 'libelles');
  const nom = (u) => ({ 111: 'compte_a', 222: 'compte_b' })[u] || '';
  const act = (selection, chrome = '111', capOk = () => true) => R.actionsPossibles({ selection, chrome, capOk, nomCompte: nom });
  // ── T ──
  dit(JSON.stringify(R.ACTIONS_TUILES) === JSON.stringify(['recreer', 'modifier', 'versBrouillon', 'enLigne']), 'T1 quatre tuiles, dans l’ordre (recreer · modifier · versBrouillon · enLigne)', JSON.stringify(R.ACTIONS_TUILES));
  const titres = Object.fromEntries(R.ACTIONS_SELECTION.map((A) => [A.k, A.titre]));
  dit(titres.recreer === 'Republier' && titres.modifier === 'Modifier prix ou titre' && titres.versBrouillon === 'Mettre en brouillon' && titres.enLigne === 'Mettre en ligne', 'T2 les quatre mots retenus', JSON.stringify(titres));
  dit(!R.ACTIONS_TUILES.includes('main') && R.ACTIONS_SELECTION.some((A) => A.k === 'main'), 'T3 « à la main » existe toujours, mais n’est pas une tuile');
  dit(R.ACTIONS_SELECTION.every((A) => !/→/.test(A.titre)), 'T4 plus de flèches dans les titres');
  // ── R ──
  { const a = act([{ id: '1', uid: '111', etat: 'en-ligne' }, { id: '2', uid: '222', etat: 'en-ligne' }]); const r = R.raisonCommune(a);
    dit(/2 comptes/.test(r.tete) && R.ACTIONS_TUILES.every((k) => r.parTuile[k] === ''), 'R1 deux comptes : la raison UNE fois en tête, rien sous les tuiles', JSON.stringify(r)); }
  { const a = R.actionsPossibles({ selection: [{ id: '1', uid: '111', etat: 'en-ligne' }], chrome: undefined, capOk: () => true, nomCompte: nom }); const r = R.raisonCommune(a);
    dit(/ne sait pas/.test(r.tete) && ['recreer', 'modifier', 'versBrouillon'].every((k) => r.parTuile[k] === '') && /brouillons/.test(r.parTuile.enLigne), 'R2 compte de l’onglet pas su : une fois en tête ; « Mettre en ligne » garde SA raison', JSON.stringify(r)); }
  { const a = act([{ id: '1', uid: '111', etat: 'en-ligne' }, { id: '3', uid: '111', etat: 'en-ligne' }]); const r = R.raisonCommune(a);
    dit(r.tete === '' && /brouillons/.test(r.parTuile.enLigne) && r.parTuile.recreer === a.find((x) => x.k === 'recreer').desc, 'R3 une seule tuile grisée : SA raison sous elle, les autres gardent leur description, rien en tête', JSON.stringify(r)); }
  { const a = act([{ id: '5', uid: '111', etat: 'brouillon' }]); const r = R.raisonCommune(a);
    dit(/en ligne/.test(r.tete) && r.parTuile.recreer === '' && r.parTuile.modifier === '' && r.parTuile.versBrouillon === '' && r.parTuile.enLigne !== '', 'R4 un brouillon : la raison commune des trois tuiles « en ligne » une fois, « Mettre en ligne » possible', JSON.stringify(r)); }
  { const r = R.raisonCommune([]); dit(r.tete === '' && Object.keys(r.parTuile).length === 0, 'R5 rien ⇒ rien (pas de phrase inventée)'); }
  { const a = act([]); const r = R.raisonCommune(a); const fois = [r.tete, ...Object.values(r.parTuile)].filter((t) => /Coche au moins/.test(t)).length;
    dit(fois === 1, 'R6 rien de coché : « Coche au moins une annonce » une seule fois', String(fois)); }
  // ── A ── l'app
  const app = S.app; const appN = sansCommentaires(app);
  dit(!/data-actions-menu/.test(appN) && !/Republier et brouillons/.test(appN), 'A1 plus de seconde feuille d’actions (« Republier et brouillons »)');
  dit(/if\(only==='annonces' && prendreVue\('republier'\)\) setAnnSort\('selection'\);/.test(app), 'A2 l’entrée « Republier » du menu mène à « Sélectionner »');
  { const b = tranche(appN, 'data-actions-ouvrir=""', '</button>'); dit(b && /onClick=\{\(\)=>setAnnSort\('selection'\)\}/.test(b) && !/setActionsOpen\(true\)/.test(b), 'A3 « Republier… » de la barre mène à « Sélectionner »', b.slice(0, 160)); }
  const feuille = tranche(appN, 'function ActionsSelectionFeuille(', '\nfunction ');
  dit(/raisonCommune\(actions\)/.test(feuille) && /ACTIONS_TUILES\.map/.test(feuille), 'A4 la feuille Actions lit `raisonCommune` et `ACTIONS_TUILES`');
  dit(/<SheetShell [^>]*titre=\{/.test(feuille) && !/✕/.test(feuille), 'A5 la feuille Actions : `SheetShell titre` (croix partagée), aucune croix faite main');
  // ── Z ── la zone Annonces
  const ecran = tranche(appN, "{curSub==='annonces' && (<>", 'className="vrm-ann-stock-tools"');
  const choix = tranche(appN, 'function ChoixAnnoncesVinted(', '\nfunction RepublierALaMain(');
  const zone = ecran + choix;
  dit(ecran.length > 5000 && choix.length > 2000, 'Z0 la zone Annonces est trouvée', `${ecran.length} / ${choix.length}`);
  dit(!/Baisser à/.test(zone), 'Z1 plus de « Baisser à » à part (un seul « Changer le prix »)');
  const accentTexte = (zone.match(/color:\s*C\.accent\b(?!Texte)/g) || []).length;
  dit(accentTexte === 0, 'Z2 aucun texte en `C.accent` (le texte bleu passe par `accentTexte`, et reste rare)', String(accentTexte));
  dit(!/refuse <(?!span)/.test(zone) && /Refuser sous/.test(zone) && /Accepter dès/.test(zone), 'Z3 les cases chiffrées en mots (« Accepter dès », « Refuser sous »)');
  dit(!/dans cette s[ée]lection/.test(zone) && !/Réinitialiser les annonces/.test(zone) && /affichée/.test(zone), 'Z4 le filtre ne s’appelle plus « sélection »');
  const textes = (zone.match(/>([^<>{}]{3,})</g) || []).map((x) => x.slice(1, -1)).concat((zone.match(/'([^'\n]{4,})'|`([^`\n]{4,})`/g) || []));
  const ecartes = [...new Set(textes.flatMap((t) => Lb.motsEcartesDans(t)))];
  dit(ecartes.length === 0, 'Z5 aucun mot écarté (libelles.js) dans la zone', ecartes.join(', '));
  dit(/<Numero n=\{num\}/.test(ecran) && /<Numero n=\{a\.numero\}/.test(choix) && /<Numero n=\{a\.numero\}/.test(feuille), 'Z6 `Numero` sur la carte, dans Sélectionner et dans la feuille Actions');
  dit(/<PhotoVide remplir/.test(ecran) && /<PhotoVide taille=\{52\}/.test(choix), 'Z7 `PhotoVide` sur la carte et dans Sélectionner');
  dit(/<ChampRecherche className="vrm-annbar-recherche"/.test(ecran) && !/<MicDictee onText=\{\(t\)=>setAnnSearch/.test(ecran), 'Z8 la recherche d’annonces est `ChampRecherche` (micro intégré)');
  dit(!/>N°\{/.test(zone.replace(/sousTitre=\{[^}]*\}/g, '')) , 'Z9 aucun « N°{…} » écrit à la main dans la zone', (zone.match(/>N°\{[^}]*\}/g) || []).join(' '));
  // ── C ── la carte
  const gestes = tranche(ecran, 'className="vrm-fiche-gestes"', '{ficheMenu===');
  const nGestes = (gestes.match(/className="vrm-fiche-geste[ "]/g) || []).length;
  dit(gestes && nGestes <= 4 && /data-fiche-menu-ouvrir/.test(gestes), 'C1 la rangée de la carte : « Changer le prix » (ou son lien Vinted), le stock, puis « … »', `${nGestes} gestes`);
  dit(/<SheetShell onClose=\{\(\)=>setFicheMenu\(null\)\}/.test(ecran) && /data-fiche-vendue/.test(tranche(ecran, '{ficheMenu===', '</SheetShell>')), 'C2 « … » ouvre une feuille (`SheetShell`) qui porte les autres gestes');
  dit(/data-ann-achats=\{`\$\{n\}\/\$\{m\}`\}/.test(ecran) && (ecran.match(/data-ann-achats=/g) || []).length === 1 && !/k:'fillbuy'/.test(ecran), 'C3 UN bandeau « Prix d’achat · N/M → Compléter » (et plus d’entrée en double dans « Outils »)');
  const css = S.css;
  dit(/\[data-fiche-achat="inconnu"\] \{\s*border-color: var\(--vrm-line\) !important; background: var\(--vrm-bg\) !important;/.test(css) && !/data-fiche-achat="inconnu"[^}]*--vrm-warn/.test(css), 'C4 la case « prix d’achat » manquante est grise (plus d’ambre sur chaque carte)');
  return out;
}

(async () => {
  const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } };   // un fichier absent fait rougir ses règles, pas planter l'audit
  const base = Object.fromEntries(Object.entries(F).map(([k, f]) => [k, lire(f)]));
  if (process.argv.includes('--prouve')) {
    let rouges = 0, n = 0;
    for (const [nomM, { f, m }] of Object.entries(MUTATIONS)) {
      n++;
      const s = { ...base, [f]: m(base[f]) };
      if (s[f] === base[f]) { console.log(`⚠️  mutation ${nomM} : l'ancre ne correspond plus`); continue; }
      let r; try { r = await auditer(s); } catch (e) { r = [{ ok: false, m: 'plante : ' + e.message }]; }
      const ko = r.filter((x) => !x.ok);
      if (ko.length) rouges++;
      console.log(`${ko.length ? '✅' : '❌'} mutation ${nomM} : ${ko.length} contrôle(s) rouge(s)${ko.length ? ' — ' + ko[0].m : ''}`);
    }
    console.log(`\n${rouges}/${n} mutations attrapées`);
    process.exit(rouges === n ? 0 : 1);
  }
  let r; try { r = await auditer(base); } catch (e) { console.log('❌ l’audit plante : ' + e.message); process.exit(1); }
  for (const x of r) console.log(`${x.ok ? '✅' : '❌'} ${x.m}${x.d && !x.ok ? ' — ' + x.d : ''}`);
  const ko = r.filter((x) => !x.ok).length;
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s) sur ${r.length}` : `\n✅ annonces, chantier C : ${r.length} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
