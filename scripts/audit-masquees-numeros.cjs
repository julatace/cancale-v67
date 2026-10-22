// Audit : UNE ANNONCE MASQUÉE PAR VINTED EST UNE PAIRE PRÉSENTE (22 octobre).
//
// Mesuré (lecture seule) sur julatace35260 : 6 annonces `is_hidden: true`,
// `is_closed: false`, `is_draft: false` — la paire est sur l'étagère. Quatre
// portaient un N° (51, 52, 59, 73) redonné le 18/10 à une autre paire en ligne,
// et la règle des doublons du 20 octobre ne les voyait pas.
// On EXÉCUTE les vraies règles extraites d'App.jsx (blocs <supprimees-regle>,
// <enligne-regle>, <masquees-regle>, `conflitsDeNumeros`, `doublonsAReattribuer`)
// et le vrai module de la recherche par numéro (src/rechercheNumero.js), sur des
// données INVENTÉES à la forme mesurée, et on juge ce qu'elles RENDENT :
//   · masquée (dressing frais OU lecture publique plus récente qui ne la montre
//     pas, le cas réel) ⇒ présente ; démasquée depuis ⇒ en ligne, pas deux fois ;
//   · fermée, brouillon ⇒ pas présente ; supprimée APRÈS la lecture ⇒ pas
//     présente ; suppressions « pas su » ⇒ gardée (on n'écarte rien) ;
//   · masquée numérotée la première face à une annonce en ligne numérotée après
//     ⇒ la règle du 20 octobre déplace l'annonce en ligne (pas la masquée) ;
//   · la recherche « Tout sur le N° » voit les deux paires et dit « en double ».
// `--prouve` réaffaiblit la règle de trois façons : chacune doit passer au ROUGE.
// Un audit ne meurt pas, il rapporte : chaque bloc passe par `essaie()`.
const fs = require('fs'), path = require('path'), os = require('os');
const APP = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
const RECH = fs.readFileSync(path.join(__dirname, '..', 'src', 'rechercheNumero.js'), 'utf8');

let ko = 0, vu = 0;
const dit = (bon, quoi, detail) => { vu++; if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };
const essaie = async (quoi, f) => { try { await f(); } catch (e) { dit(false, quoi, 'a levé : ' + String(e && e.message).slice(0, 140)); } };

const bloc = (src, nom) => {
  const a = src.indexOf(`// <${nom}>`), b = src.indexOf(`// </${nom}>`);
  if (a < 0 || b < 0) throw new Error(`bloc <${nom}> introuvable dans App.jsx`);
  return src.slice(a, b);
};
function extraire(src, nom) {
  const re = new RegExp(`^( *)(?:async )?function ${nom}\\(|^( *)const ${nom} = `, 'm');
  const m = re.exec(src);
  if (!m) throw new Error(`${nom} introuvable dans App.jsx`);
  let i = m.index, prof = 0, vuCorps = false;
  const estFn = /function/.test(m[0]);
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') {
      prof--;
      if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1);
    } else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  throw new Error(`${nom} : fin introuvable`);
}

const MUTATIONS = {
  // La masquée ne compte plus (le code d'avant).
  masquee_ignoree: { app: (s) => s.replace('function masqueeSurVinted(it) { return !!(it && it.is_hidden && !it.is_closed && !it.is_draft); }', 'function masqueeSurVinted(it) { return false; }') },
  // Une masquée SUPPRIMÉE depuis compterait encore : un numéro neuf donné pour rien.
  suppression_ignoree: { app: (s) => s.replace('masqueeSurVinted(it) && !supprimeeApres(suppIds, it.id, capDressing)', 'masqueeSurVinted(it)') },
  // La recherche « Tout sur le N° » ne la compte pas parmi les porteurs.
  recherche_sans_masquee: { rech: (s) => s.replace("|| a.etat === 'masquee') porteurs.push", ') porteurs.push') },
};

async function charger(srcRech) {
  const f = path.join(os.tmpdir(), `rechercheNumero-masq-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, srcRech);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

const it = (id, o) => Object.assign({ id, title: 'Paire ' + id, is_closed: false, is_hidden: false, is_draft: false, item_closing_action: null }, o || {});
const T17 = Date.parse('2026-10-17T15:59:52.925Z'), T22 = Date.parse('2026-10-22T14:20:02.235Z');

async function lancer(mut) {
  const app = mut && mut.app ? mut.app(APP) : APP;
  const rech = mut && mut.rech ? mut.rech(RECH) : RECH;
  if (mut && ((mut.app && app === APP) || (mut.rech && rech === RECH))) throw new Error('la mutation ne s\'applique plus (texte changé)');
  // Deux chargements : les règles des NUMÉROS (elles existent avant ce correctif)
  // et la règle des MASQUÉES — absente sur le code d'avant, ce qui ne doit pas
  // empêcher les blocs D et E de juger ce que l'app REND.
  let R = null, N = null;
  await essaie('les règles des numéros se chargent depuis App.jsx', async () => {
    const code = [extraire(app, 'cleNum'), extraire(app, 'normTitle'), extraire(app, 'triNum'), extraire(app, 'conflitsDeNumeros'), extraire(app, 'doublonsAReattribuer')].join('\n');
    // eslint-disable-next-line no-new-func
    N = new Function(code + '\nreturn { cleNum, conflitsDeNumeros, doublonsAReattribuer };')();
  });
  await essaie('la règle des annonces masquées existe (<masquees-regle>)', async () => {
    const code = [bloc(app, 'supprimees-regle'), bloc(app, 'enligne-regle'), bloc(app, 'masquees-regle')].join('\n');
    // eslint-disable-next-line no-new-func
    R = new Function(code + '\nreturn { enLigneDuCompte, masqueesDuCompte };')();
    dit(true, 'la règle des annonces masquées existe (<masquees-regle>)');
  });
  if (!N) return;
  R = R ? Object.assign({}, N, R) : Object.assign({}, N, { enLigneDuCompte: null, masqueesDuCompte: null });
  const ids = (l) => l.map((x) => String(x.id)).sort().join(',');

  if (R.masqueesDuCompte) await essaie('A', async () => {
    console.log('\n── A. Dressing frais : la masquée est présente, pas « en ligne »');
    const r = R.enLigneDuCompte({ items: [it(1), it(2, { is_hidden: true }), it(3, { is_closed: true, item_closing_action: 'sold' }), it(4, { is_hidden: true, is_draft: true })], cap: T22 }, null, {}, T22 + 60e3);
    dit(ids(r.enLigne) === '1', 'en ligne : seule l\'annonce visible', ids(r.enLigne));
    dit(ids(R.masqueesDuCompte(r.fermees, {}, T22)) === '2', 'présente : la masquée (ni la vendue, ni le brouillon)', ids(R.masqueesDuCompte(r.fermees, {}, T22)));
  });
  if (R.masqueesDuCompte) await essaie('B', async () => {
    console.log('\n── B. Le cas mesuré : dressing du 17/10, lecture publique du 22/10 vide');
    const pub = { complet: true, ids: [], items: [], cap: T22 };
    const r = R.enLigneDuCompte({ items: [it(51, { is_hidden: true }), it(52, { is_hidden: true }), it(9, { is_closed: true })], cap: T17 }, pub, {}, T22 + 3600e3);
    dit(r.source === 'public' && r.enLigne.length === 0, 'la lecture publique fait foi, rien en ligne', `${r.source} · ${r.enLigne.length}`);
    dit(ids(R.masqueesDuCompte(r.fermees, {}, T17)) === '51,52', 'les deux masquées restent PRÉSENTES', ids(R.masqueesDuCompte(r.fermees, {}, T17)));
    const pub2 = { complet: true, ids: ['52'], items: [{ id: 52, title: 'Paire 52' }], cap: T22 };
    const r2 = R.enLigneDuCompte({ items: [it(51, { is_hidden: true }), it(52, { is_hidden: true })], cap: T17 }, pub2, {}, T22 + 3600e3);
    const m2 = R.masqueesDuCompte(r2.fermees, {}, T17);
    dit(ids(r2.enLigne) === '52' && ids(m2) === '51', 'démasquée depuis : en ligne, et PAS comptée deux fois', `en ligne ${ids(r2.enLigne)} · masquées ${ids(m2)}`);
  });
  if (R.masqueesDuCompte) await essaie('C', async () => {
    console.log('\n── C. Suppressions');
    const f = [it(51, { is_hidden: true })];
    dit(R.masqueesDuCompte(f, { 51: new Date(T17 + 3600e3).toISOString() }, T17).length === 0, 'supprimée APRÈS la lecture : plus présente');
    dit(R.masqueesDuCompte(f, null, T17).length === 1, 'suppressions « pas su » : gardée (on n\'écarte rien)');
    dit(R.masqueesDuCompte(f, { 99: new Date(T22).toISOString() }, T17).length === 1, 'une suppression d\'une AUTRE annonce ne la retire pas');
  });
  await essaie('D', async () => {
    console.log('\n── D. La règle du 20 octobre, appliquée telle quelle');
    // Les porteurs ont la forme que `porteursNum` produit (une masquée est une annonce marquée).
    const fiches = {
      10347651986: { numero: '51', auto: true, numberedAt: '2026-10-14T15:47:09.775Z' },
      10339428900: { numero: '51', auto: true, numberedAt: '2026-10-18T08:26:45.251Z' },
    };
    const porteurs = { 51: [
      { type: 'annonce', titre: 'nike air max 1 patta waves', id: '10347651986', masquee: true },
      { type: 'annonce', titre: 'adidas samba blanc et argenté', id: '10339428900' },
    ] };
    const c = R.conflitsDeNumeros(porteurs);
    dit(c.length === 1, 'deux paires présentes sous le N°51 : un doublon', String(c.length));
    const a = R.doublonsAReattribuer(c, fiches);
    dit(a.length === 1 && a[0].id === '10339428900' && a[0].ancien === '51', 'la plus ancienne (la masquée) garde, l\'annonce en ligne du 18 change', JSON.stringify(a));
  });
  await essaie('E', async () => {
    console.log('\n── E. « Tout sur le N° » voit la masquée');
    const M = await charger(rech);
    const d = {
      fiches: { m51: { numero: '51', title: 'Patta masquée' }, e51: { numero: '51', title: 'Samba en ligne' } },
      pool: [51], enLigne: new Set(['e51']), aConfirmer: new Set(), masquees: new Set(['m51']), comptesOk: null,
      ventes: [], txnItem: {}, saleOv: {}, bordereaux: [], imprimes: {}, postes: {}, lbcVentes: [], ebayCommandes: [], ebayAnnonces: [], plan: { rooms: [] }, archive: '',
    };
    const o = { cleNum: R.cleNum, conflits: R.conflitsDeNumeros };
    const rn = M.toutSurLeNumero('51', d, o, []);
    const em = (rn.annonces || []).find((x) => x.id === 'm51');
    dit(!!em && em.etat === 'masquee', 'la masquée est dite « masquée », pas « plus en ligne »', em ? em.etat : '—');
    dit(rn.double === true, 'et le N°51 est signalé EN DOUBLE', String(rn.double));
  });
}

(async () => {
  const prouve = process.argv.includes('--prouve');
  if (!prouve) {
    await lancer(null);
    console.log(`\n${vu - ko} vert(s), ${ko} rouge(s).`);
    process.exit(ko ? 1 : 0);
  }
  let toutes = true;
  for (const [nom, mut] of Object.entries(MUTATIONS)) {
    ko = 0; vu = 0;
    console.log(`\n════ mutation « ${nom} »`);
    try { await lancer(mut); } catch (e) { dit(false, 'mutation appliquée', String(e.message)); }
    console.log(`  → ${ko ? `ROUGE (${ko})` : 'VERTE — la mutation n\'est pas attrapée'}`);
    if (!ko) toutes = false;
  }
  console.log(toutes ? '\n✅ chaque réaffaiblissement est attrapé' : '\n❌ une mutation passe au vert');
  process.exit(toutes ? 0 : 1);
})();
