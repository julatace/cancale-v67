// ═══════════════════════════════════════════════════════════════════════════
//  AUDIT — « REPUBLIER / PUBLIER À LA MAIN », GUIDÉS (15 nov.)
// ═══════════════════════════════════════════════════════════════════════════
//  Julien (15 nov.) : « pareil pour la republication à la main, tout doit être beaucoup mieux,
//  accompagné, même la publication tout court ; […] envoie directement dans la galerie les photos ».
//  ⚠️ La limite (CLAUDE.md §3 « Modifier les photos pour tromper / changer de compte : Refusé ») :
//  AUCUNE retouche destinée à tromper une détection, et AUCUN texte de l'app qui parle de ban, de
//  détection ou d'éviter Vinted à propos de la republication ou des photos.
//
//  A. LA RÈGLE DU PARCOURS (src/republierGuide.js), EXÉCUTÉE : une étape n'est cochée que sur une
//     preuve ou un geste fait (photos envoyées, ancienne PARTIE de la lecture, nouvelle désignée /
//     N° relu, fiche vue) ; « pas su » n'est jamais « fait » ; les champs dans l'ordre de Vinted,
//     un champ pas lu jamais copié vide ; « Ce que VRM a fait » seulement avec une identité.
//  B. LES MOTS (5 langues) : (1) dans TOUTE l'app, aucune tournure d'évitement (« éviter la
//     détection », « contourner », « anti-détection », « avoid detection », « evitar la
//     detección », « Erkennung vermeiden »…) ; (2) dans les textes de la republication, des photos
//     et du parcours guidé (clés `rg.*`, `repub*`, `photo*`, `atelier*`, et les chaînes des
//     fichiers du parcours), ni « ban », ni « détection », ni « éviter Vinted ».
//  C. LES PHOTOS : AUCUN HASARD dans la retouche (le dessin, les couleurs, les bornes, l'aperçu,
//     la préparation des fichiers) — ni `Math.random`, ni `crypto.getRandomValues`, ni l'heure ;
//     exécuté : deux dessins du même réglage = les mêmes gestes, `Math.random` piégé ; un réglage
//     inconnu (« varier », « bruit ») retombe au neutre ; ni « Varier » ni réglage par annonce.
//  D. LE BRANCHEMENT : « À la main » ouvre la feuille guidée ; le partage de FICHIERS dans le
//     geste (`navigator.share({ files`), préparées d'avance (`auto:`) ; rien ne part chez Vinted ;
//     tout texte du parcours passe par tr() ; les clés `rg.*` existent dans les 5 langues.
//  `--prouve` : chaque mutation doit rendre au moins un contrôle rouge.
// ═══════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), url = require('url');
const RAC = path.join(__dirname, '..');
const LANGUES = ['fr', 'en', 'es', 'it', 'de'];
const F = {
  guide: path.join(RAC, 'src', 'republierGuide.js'),
  regle: path.join(RAC, 'src', 'republierReglages.js'),
  ecran: path.join(RAC, 'src', 'ecrans', 'Republier.jsx'),
  app: path.join(RAC, 'src', 'App.jsx'),
  ...Object.fromEntries(LANGUES.map((l) => [`rg_${l}`, path.join(RAC, 'src', 'i18n', 'langues', l, 'republierGuide.js')])),
};
const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return null; } };
const sansCommentaires = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');

const MUTATIONS = {
  supprimer_sur_ouverture: { f: 'guide', m: (s) => s.replace("out.supprimer = e.ancienne === 'partie' ? 'fait'", "out.supprimer = e.ancienne === 'partie' || e.ancienneOuverte ? 'fait'") },
  passu_vaut_partie: { f: 'guide', m: (s) => s.replace("if (!id || erreur || !Array.isArray(items)) return undefined;", "if (!id || erreur || !Array.isArray(items)) return 'partie';") },
  photos_cochees_sans_envoi: { f: 'guide', m: (s) => s.replace("(pretes > 0 && env >= pretes ? 'fait'", "(pretes > 0 ? 'fait'") },
  creer_coche_sur_copie: { f: 'guide', m: (s) => s.replace("out.creer = nv === 'lie' || nv === 'fait' || nv === 'vue' ? 'fait'", "out.creer = nv === 'lie' || nv === 'fait' || nv === 'vue' || (Number(e.copies) || 0) > 0 ? 'fait'") },
  publie_devine: { f: 'guide', m: (s) => s.replace("return vue ? { cle: 'rg.fini.publieVue', etat: 'fait' } : { cle: 'rg.fini.publiePasVue', etat: 'pas-su' };", "return { cle: 'rg.fini.publieVue', etat: 'fait' };") },
  ordre_champs: { f: 'guide', m: (s) => s.replace("['titre', 'description', 'categorie', 'marque', 'taille', 'etat', 'couleur', 'prix']", "['prix', 'titre', 'description', 'categorie', 'marque', 'taille', 'etat', 'couleur']") },
  prix_zero: { f: 'guide', m: (s) => s.replace("(p == null || !(Number(p) > 0) ? ''", "(p == null ? '0'") },
  texte_ban_fr: { f: 'rg_fr', m: (s) => s.replace('"rg.photos.pas": "Rien n’est publié."', '"rg.photos.pas": "Rien n’est publié : photos modifiées pour éviter le ban."') },
  texte_detection_de: { f: 'rg_de', m: (s) => s.replace('"rg.photos.pas": "Es wird nichts veröffentlicht."', '"rg.photos.pas": "Es wird nichts veröffentlicht, um die Erkennung zu vermeiden."') },
  texte_contourner_app: { f: 'app', m: (s) => s.replace('function FichesNeuves({ annonces = null }) {', 'function FichesNeuves({ annonces = null }) {\n  const _x = "Change les photos pour contourner Vinted";') },
  hasard_dessin: { f: 'regle', m: (s) => s.replace('ctx.translate(w / 2, h / 2); ctx.rotate(f.rot * Math.PI / 180);', 'ctx.translate(w / 2, h / 2); ctx.rotate((f.rot + (Math.random() - 0.5)) * Math.PI / 180);') },
  hasard_couleurs: { f: 'regle', m: (s) => s.replace('const br = x.bright, ct = x.contrast, sa = x.sat;', 'const br = x.bright * (1 + (Math.random() - 0.5) / 50), ct = x.contrast, sa = x.sat;') },
  hasard_preparation: { f: 'ecran', m: (s) => s.replace("const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.92));", "const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.9 + Math.random() / 20));") },
  varier_remis: { f: 'regle', m: (s) => s.replace('export function bornerPhoto(r) {', 'export function bornerPhoto(r) { if (r && r.varier) return { ...PHOTO_NEUTRE, ...r };') },
  kit_au_lieu_du_guide: { f: 'app', m: (s) => s.replace("setRepubMainFile(choisies.length>1 ? { liste:choisies, i:0 } : null); setRepubMainOuvert(choisies[0]); }}", "setKitMain(choisies); }}") },
  partage_hors_geste: { f: 'ecran', m: (s) => s.replace("useEffect(() => { if (auto && photos.length && !ph) preparer(); }", "useEffect(() => { if (false && auto && photos.length && !ph) preparer(); }") },
  // (23 nov., feuille refaite) les ancres suivent le bouton du pied : `ouvrirAncienne`, `rg2.supprimer.ouvrir`.
  envoi_vinted: { f: 'ecran', m: (s) => s.replace("const ouvrirAncienne = () => { debut(); setOuvertes((o) => new Set(o).add('ancienne')); };", "const ouvrirAncienne = () => { debut(); setOuvertes((o) => new Set(o).add('ancienne')); vmrCmd({ cmd: 'supprimerVinted', id: paire.id }); };") },
  texte_en_dur: { f: 'ecran', m: (s) => s.replace("{tr('rg2.supprimer.ouvrir')}", 'Ouvrir l’ancienne annonce ↗') },
  // (15 nov.) « une seule photo » : la vignette par défaut, une source qui ne prend pas la plus longue, le double-toucher retiré.
  vignette_seule: { f: 'ecran', m: (s) => s.replace('const lecturePh = photosDeLAnnonce({ coffre: f.photos, detail, liste: paire.photos, couverture: paire.photo,', "const lecturePh0 = { photos: (Array.isArray(f.photos) && f.photos.length ? f.photos : (paire.photo ? [paire.photo] : [])), manque: 0 }; const lecturePh = photosDeLAnnonce({ coffre: lecturePh0.photos, couverture: paire.photo,") },
  source_courte: { f: 'guide', m: (s) => s.replace('(x[1].length > m[1].length ? x : m)', '(m[1].length ? m : x)') },
  manque_tu: { f: 'guide', m: (s) => s.replace("const manque = connu ? Math.max(0, n - photos.length) : (source === 'couverture' ? null : 0);", 'const manque = 0;') },
  sans_double_toucher: { f: 'ecran', m: (s) => s.replace('onPointerUp={() => relache(c.cle)} onDoubleClick={() => neutreCle(c.cle)}', '') },
  hasard_curseur: { f: 'ecran', m: (s) => s.replace("const neutreCle = (cle) => poserRegs((x) => ({ photo: { ...x.photo, [cle]: PHOTO_NEUTRE[cle] } }));", "const neutreCle = (cle) => poserRegs((x) => ({ photo: { ...x.photo, [cle]: PHOTO_NEUTRE[cle] + (Math.random() - 0.5) / 100 } }));") },
  // (23 nov.) « Supprimer » cochée sans preuve : l'absence d'une lecture partielle, ratée ou masquée prise pour « partie ».
  absence_partielle: { f: 'guide', m: (s) => s.replace("if (!u || !complets || complets[u] !== true) return undefined;", '') },
  absence_ko: { f: 'guide', m: (s) => s.replace("if (Array.isArray(ko) && ko.map(String).includes(u)) return undefined;", '') },
  absence_masquee: { f: 'guide', m: (s) => s.replace("|| (Array.isArray(masquees) && masquees.some(meme))", '') },
  glisser_perd: { f: 'guide', m: (s) => s.replace('const [x] = l.splice(a, 1); l.splice(b, 0, x);', 'l.splice(a, 1);') },
  cle_absente_it: { f: 'rg_it', m: (s) => s.replace(/\s*"rg2\.supprimer\.ouvrir": "[^"]*",/, '') },
};

async function charger(src, nom) {
  if (src == null) return null;
  const f = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src.replace(/from '\.\/([^']+)'/g, (_, m) => `from '${url.pathToFileURL(path.join(RAC, 'src', m)).href}'`));
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}
// Les textes d'un fichier de langue (`export default { … }`), lus comme données.
function textesDe(src) {
  if (!src) return null;
  const i = src.indexOf('export default'); if (i < 0) return null;
  try { return (new Function(`return (${src.slice(i + 'export default'.length).trim().replace(/;\s*$/, '')});`))(); } catch (_) { return null; }
}
const aplatir = (v) => (v && typeof v === 'object' ? Object.values(v).map(String) : [String(v)]);

// B. Les tournures interdites — partout (évitement), et dans les textes de la republication (mots).
const EVITEMENT = /(éviter|eviter|échapper|esquiver)\s+(la\s+|les\s+)?(d[ée]tection|bann|ban\b|suppression\s+par\s+vinted|vinted)|anti-?d[ée]tection|contourn\w*\s+(vinted|la\s+d[ée]tection|les\s+contr[ôo]les)|pour\s+(ne\s+pas\s+)?(être|etre)\s+(reconnu|détecté|detecte|banni)|avoid\w*\s+(the\s+)?(detection|ban|being\s+(banned|detected))|undetect|evade\s+detection|evitar\s+(la\s+)?(detecci[óo]n|baneo|ser\s+baneado)|evitare\s+(il\s+)?(rilevamento|ban)|erkennung\s+(zu\s+)?vermeiden|sperre\s+(zu\s+)?umgehen/i;
const MOTS_REPUB = /\bbann?(?:i|ir|is|issement|ed|ning|eo|eado|ear|nato|nare|en)?\b|d[ée]tect|detecci|rilevament|\berkennung\b|[ée]viter\s+vinted|avoid\s+vinted|evitar\s+vinted|evitare\s+vinted|vinted\s+umgehen/i;
const CLES_REPUB = /^(rg\.|repub|republi|photo|atelier|creerVinted|publier)/i;
// Les chaînes (entre quotes) d'un source JS/JSX, commentaires retirés.
const chaines = (src) => { const s = sansCommentaires(src); const out = []; const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`|>([^<>{}\n]{3,})</g; let m; while ((m = re.exec(s))) out.push(m[1] || m[2] || m[3] || m[4] || ''); return out.filter(Boolean); };

async function auditer(src) {
  const out = [];
  const dit = (ok, m, d) => out.push({ ok: !!ok, m, d });
  // ── A : la règle du parcours, exécutée ──
  let G = null; try { G = await charger(src.guide, 'republierGuide'); } catch (e) { dit(false, 'A0 src/republierGuide.js se charge', e.message); }
  if (G) {
    dit(G.etapesGuide('republier').join(',') === 'photos,supprimer,creer,fini' && G.etapesGuide('remettre').join(',') === 'photos,creer,fini' && G.etapesGuide('publier').join(',') === 'photos,creer,fini' && G.etapesGuide('nimporte').join(',') === 'photos,supprimer,creer,fini',
      'A1 les étapes : photos d’abord (gardées avant toute suppression), supprimer SUR VINTED, créer, fini ; rien à supprimer pour une vente annulée ou une fiche neuve');
    const E = (e) => G.etatsEtapes('republier', e);
    const a = E({ photos: { n: 6, pretes: 6, envoyees: 0 } });
    const b = E({ photos: { n: 6, pretes: 6, envoyees: 6 } });
    const c = E({ photos: { n: 6, pretes: 0, envoyees: 0 } });
    dit(a.photos === 'a-faire' && b.photos === 'fait' && c.photos === 'a-faire' && E({ photos: { n: 0 } }).photos === 'sans', 'A2 « Photos » cochée seulement quand TOUTES les photos prêtes sont envoyées (partage ou téléchargement réussi)', JSON.stringify([a.photos, b.photos, c.photos]));
    const s1 = E({ ancienneOuverte: true, ancienne: 'en-ligne' }), s2 = E({ ancienne: undefined, ancienneOuverte: true }), s3 = E({ ancienne: 'partie' });
    dit(s1.supprimer === 'ouvert' && s2.supprimer === 'ouvert' && s3.supprimer === 'fait', 'A3 « Supprimer » cochée seulement quand l’ancienne n’est plus dans la lecture ; le lien ouvert ou « pas su » ne valent pas « fait »', JSON.stringify([s1.supprimer, s2.supprimer, s3.supprimer]));
    dit(G.etatAncienne('9102', null) === undefined && G.etatAncienne('9102', [{ id: 1 }], { erreur: true }) === undefined && G.etatAncienne('9102', [{ id: 9102 }]) === 'en-ligne' && G.etatAncienne('', [{ id: 1 }]) === undefined,
      'A4 l’ancienne : lecture absente ou en erreur ⇒ « pas su » (jamais « partie »)');
    // (23 nov., capture de Julien : « Supprimer » cochée à l'étape 1) L'ABSENCE ne prouve « partie » que sur une lecture
    //  COMPLÈTE de CE compte, qui a répondu, l'annonce n'étant ni « à confirmer » ni masquée.
    { const L = [{ id: 9103 }], ok = { uid: '111', complets: { 111: true } };
      const r = [G.etatAncienne('9102', L), G.etatAncienne('9102', L, { uid: '111' }), G.etatAncienne('9102', L, { uid: '111', complets: {} }),
        G.etatAncienne('9102', L, { ...ok, ko: ['111'] }), G.etatAncienne('9102', L, { ...ok, aConfirmer: [{ id: 9102 }] }), G.etatAncienne('9102', L, { ...ok, masquees: [{ id: '9102' }] }),
        G.etatAncienne('9102', L, { uid: '222', complets: { 111: true } }), G.etatAncienne('9102', L, ok)];
      dit(r.slice(0, 7).every((x) => x === undefined) && r[7] === 'partie', 'A4b « partie » seulement sur une lecture COMPLÈTE de CE compte (pas en échec, l’annonce ni à confirmer ni masquée) ; sinon « pas su »', JSON.stringify(r)); }
    { const d = G.deplacerPhoto(['a', 'b', 'c', 'd'], 3, 0), e = G.photosRangees(['a', 'b', 'c'], ['c', 'x', 'a']);
      dit(d.join('') === 'dabc' && G.deplacerPhoto(['a', 'b'], 0, 5).join('') === 'ab' && e.join('') === 'cab', 'A4c l’ordre choisi au glisser : rien perdu ni doublé, une photo neuve à la fin, une inconnue sortie', JSON.stringify([d, e])); }
    const c1 = E({ copies: 5, vintedOuvert: true }), c2 = E({ nouvelle: 'lie' }), c3 = E({ nouvelle: 'fait' });
    dit(c1.creer === 'ouvert' && c1.fini === 'a-faire' && c2.creer === 'fait' && c2.fini === 'ouvert' && c3.fini === 'fait', 'A5 « Créer » cochée quand la nouvelle est désignée par SON clic ; « Fini » quand le N° est relu dessus — des copies ne suffisent pas', JSON.stringify([c1, c2, c3]));
    dit(G.etapeConseillee('republier', b) === 'supprimer' && G.etapeConseillee('republier', { photos: 'fait', supprimer: 'fait', creer: 'fait', fini: 'fait' }) === 'fini', 'A6 l’étape conseillée : la première qui n’est pas faite');
    const ch = G.champsAnnonce({ titre: 'Nike', description: 'Portées.\n\nN°42', prix: 44.1, marque: 'Nike', taille: '42', etat: '', categorie: '', couleur: '' });
    dit(ch.map((x) => x.k).join(',') === 'titre,description,categorie,marque,taille,etat,couleur,prix' && ch.find((x) => x.k === 'prix').v === '44,10' && ch.find((x) => x.k === 'etat').v === '',
      'A7 les champs dans l’ordre du formulaire « Vendre » de Vinted ; prix « 44,10 » ; un champ pas lu reste vide (dit, jamais copié)', ch.map((x) => `${x.k}=${x.v}`).join(' | '));
    dit(G.prixACopier(null) === '' && G.prixACopier(0) === '' && G.prixACopier(49) === '49', 'A7b un prix pas lu ne se copie jamais « 0 »');
    const cv = G.couvertureCopie(ch, new Set(['titre', 'etat']));
    dit(cv.n === 5 && cv.faits === 1, 'A7c « N sur M copiés » ne compte que les champs qui ont une valeur', JSON.stringify(cv));
    dit(G.resultatFin('publier', { vue: false }).etat === 'pas-su' && G.resultatFin('publier', { vue: true }).etat === 'fait' && G.resultatFin('republier', { etatSuivi: 'attente', nCandidats: null }).etat === 'pas-su' && G.resultatFin('republier', { etatSuivi: 'fait', numero: '42' }).cle === 'rg.fini.republieNum',
      'A8 « C’est republié / publié » seulement relu ; pas vu ⇒ « pas su », jamais deviné');
    dit(G.travailFait('republier', {}) === null && G.travailFait('publier', { id: 'f1', numero: '45' }).sorte === 'publier-main' && G.travailFait('republier', { id: '9102', nouvelId: '9201', numero: '42' }).article.id === '9201',
      'A9 « Ce que VRM a fait » : une identité (la nouvelle annonce, la fiche), sinon rien');
    // (15 nov., capture de Julien : « on me propose qu'une seule photo… je veux TOUTES les photos »)
    if (typeof G.photosDeLAnnonce !== 'function') dit(false, 'A10 `photosDeLAnnonce` existe (toutes les photos de l’annonce)');
    else {
      const H = Array.from({ length: 8 }, (_, i) => `u${i + 1}`);
      const a1 = G.photosDeLAnnonce({ coffre: [], detail: H, liste: [], couverture: 'u1', attendu: 8 });
      const a2 = G.photosDeLAnnonce({ coffre: ['u1', 'u2'], detail: H, couverture: 'u1' });
      const a3 = G.photosDeLAnnonce({ couverture: 'u1' });
      const a4 = G.photosDeLAnnonce({ coffre: ['u1', 'u2', 'u2', { full_size_url: 'u3' }], couverture: 'u1', attendu: 8 });
      dit(a1.photos.join() === H.join() && a1.manque === 0 && a2.photos.length === 8 && a2.source === 'detail' && a3.photos.join() === 'u1' && a3.manque === null && a4.photos.join() === 'u1,u2,u3' && a4.manque === 5,
        'A10 TOUTES les photos par l’identité de l’annonce : la source qui en porte le plus, dans l’ordre de Vinted, sans doublon ; la vignette seule ⇒ « pas su », il en manque ⇒ dit', JSON.stringify({ a1: a1.photos.length, a2: a2.source, a3: a3.manque, a4: [a4.photos.join(), a4.manque] }));
      dit(G.photosChoisies(H, new Set(['u3'])).length === 7 && G.photosChoisies(H, new Set(['u3']))[2] === 'u4' && G.photosChoisies(H, new Set()).length === 8, 'A11 une photo retirée par lui ⇒ les autres, dans l’ordre');
    }
  }
  // ── B : les mots ──
  const textes = {};
  for (const l of LANGUES) textes[l] = textesDe(src[`rg_${l}`]);
  const tousI18n = [];
  for (const l of LANGUES) {
    const dir = path.join(RAC, 'src', 'i18n', 'langues', l);
    for (const f of (fs.existsSync(dir) ? fs.readdirSync(dir) : [])) {
      const s = f === 'republierGuide.js' ? src[`rg_${l}`] : lire(path.join(dir, f));
      const d = textesDe(s); if (d) for (const [k, v] of Object.entries(d)) for (const t of aplatir(v)) tousI18n.push({ l, k, t });
    }
    const racine = lire(path.join(RAC, 'src', 'i18n', 'langues', `${l}.js`));
    const d = textesDe(racine && racine.replace(/^[\s\S]*?export default \{/m, 'export default {').replace(/^\s*\.\.\.\w+,\s*$/gm, ''));
    if (d) for (const [k, v] of Object.entries(d)) for (const t of aplatir(v)) tousI18n.push({ l, k, t });
  }
  const evitI18n = tousI18n.filter((x) => EVITEMENT.test(x.t));
  const evitSrc = [];
  for (const [nom, s] of [['App.jsx', src.app], ['Republier.jsx', src.ecran], ['republierGuide.js', src.guide], ['republierReglages.js', src.regle]]) for (const t of chaines(s)) if (EVITEMENT.test(t)) evitSrc.push(`${nom}: ${t.slice(0, 60)}`);
  dit(tousI18n.length > 1000 && !evitI18n.length && !evitSrc.length, 'B1 dans toute l’app (5 langues + chaînes du code), aucune tournure « éviter la détection / le ban / contourner »', [...evitI18n.map((x) => `${x.l} ${x.k}: ${x.t.slice(0, 50)}`), ...evitSrc].slice(0, 4).join(' ; ') || `${tousI18n.length} textes lus`);
  const repubI18n = tousI18n.filter((x) => CLES_REPUB.test(x.k) && MOTS_REPUB.test(x.t));
  const repubSrc = [];
  for (const [nom, s] of [['Republier.jsx', src.ecran], ['republierGuide.js', src.guide], ['republierReglages.js', src.regle]]) for (const t of chaines(s)) if (MOTS_REPUB.test(t)) repubSrc.push(`${nom}: ${t.slice(0, 60)}`);
  dit(!repubI18n.length && !repubSrc.length, 'B2 republication, photos, parcours guidé : ni « ban », ni « détection », ni « éviter Vinted » (5 langues et chaînes)', [...repubI18n.map((x) => `${x.l} ${x.k}: ${x.t.slice(0, 50)}`), ...repubSrc].slice(0, 4).join(' ; '));
  const fr = textes.fr;
  dit(fr && /galerie/.test(fr['rg.photos.apresGalerie']) && /tout a été envoyé/.test(fr['rg.photos.apresGalerie']) && /prêtes/.test(fr['rg.photos.apresGalerie']), 'B3 après l’envoi : « N photos prêtes dans ta galerie : tout a été envoyé » (formulation neutre)');
  // ── C : aucun hasard dans les photos ──
  const fonctions = (s, noms) => noms.map((n) => { const i = s.indexOf(n); if (i < 0) return { n, corps: null }; const j = s.indexOf('\n}', i); return { n, corps: s.slice(i, j < 0 ? undefined : j) }; });
  const regleSans = sansCommentaires(src.regle || '');
  const ecranSans = sansCommentaires(src.ecran || '');
  const corpsPhotos = [...fonctions(regleSans, ['export function bornerPhoto', 'export function filtrePhoto', 'export function cssApercuPhoto', 'export function dessinerPhotoReglee', 'export function appliquerCouleursPixels', 'export const CURSEURS_PHOTO']),
    ...fonctions(ecranSans, ['function usePhotosReglees', 'function SectionPhotos', 'function CurseursPresentation', 'const valeurCurseur'])];
  const absentes = corpsPhotos.filter((x) => !x.corps).map((x) => x.n);
  // L'horloge ne sert qu'au double-toucher des barres (une interface) : interdite partout ailleurs.
  const hasard = corpsPhotos.filter((x) => x.corps && (/Math\.random|getRandomValues|randomUUID|tirerLettre|alea/i.test(x.corps) || (!/CurseursPresentation/.test(x.n) && /Date\.now\(\)|performance\.now/.test(x.corps)))).map((x) => x.n);
  dit(!absentes.length && !hasard.length, 'C1 la retouche des photos n’a AUCUN hasard (dessin, couleurs, bornes, aperçu, préparation des fichiers)', [...absentes.map((n) => `${n} introuvable`), ...hasard.map((n) => `${n} : hasard`)].join(' ; '));
  let R = null; try { R = await charger(src.regle, 'republierReglages'); } catch (e) { dit(false, 'C0 src/republierReglages.js se charge', e.message); }
  if (R) {
    const toile = () => { const g = []; const ctx = { fillStyle: '' }; let fl = 'none'; Object.defineProperty(ctx, 'filter', { get: () => fl, set: (v) => { fl = v; g.push('filter=' + v); } }); for (const k of ['fillRect', 'translate', 'rotate', 'scale', 'drawImage']) ctx[k] = (...a) => g.push(`${k}(${a.map((x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : 'IMG')).join(',')})`); return { ctx, g }; };
    const reg = { rot: 4, bright: 1.1, contrast: 1.05, sat: 0.9, zoom: 1.2 };
    const vrai = Math.random; let piege = 0;
    Math.random = () => { piege++; return vrai(); };
    let pareil = false, px = false;
    try {
      const t1 = toile(), t2 = toile();
      R.dessinerPhotoReglee(t1.ctx, {}, 800, 1000, reg); R.dessinerPhotoReglee(t2.ctx, {}, 800, 1000, reg);
      pareil = t1.g.join('|') === t2.g.join('|') && t1.g.length > 4;
      const d1 = new Uint8ClampedArray([10, 120, 230, 255, 200, 60, 30, 255]), d2 = new Uint8ClampedArray(d1);
      R.appliquerCouleursPixels(d1, reg); R.appliquerCouleursPixels(d2, reg);
      px = d1.join() === d2.join();
      R.cssApercuPhoto(reg); R.filtrePhoto(R.bornerPhoto(reg));
    } finally { Math.random = vrai; }
    dit(pareil && px && piege === 0, 'C2 exécuté : le même réglage donne exactement les mêmes gestes et les mêmes pixels, sans jamais tirer au hasard', `gestes égaux=${pareil}, pixels égaux=${px}, tirages=${piege}`);
    const b = R.bornerPhoto({ varier: true, bruit: 0.3, rot: 3, aleatoire: true });
    const l = R.lireReglagesRepub({ photo: { varier: true, rot: 2 }, parAnnonce: { 1: { rot: 9 } } });
    dit(!('varier' in b) && !('bruit' in b) && !('aleatoire' in b) && !('varier' in l.photo) && !('parAnnonce' in l), 'C3 un réglage inconnu (« varier », « bruit », « par annonce ») retombe au neutre : un réglage de présentation pour toutes', JSON.stringify({ b, l: l.photo }));
  }
  // ── D : le branchement ──
  const app = sansCommentaires(src.app || '');
  const ecran = ecranSans;
  const iM = ecran.indexOf('function RepublierALaMain'), jM = ecran.indexOf('\nfunction CarteKit');
  const main = iM >= 0 ? ecran.slice(iM, jM < 0 ? undefined : jM) : '';
  dit(/onALaMain=\{\(choisies\)=>\{[\s\S]{0,900}?setRepubMainOuvert\(choisies\[0\]\)/.test(app) && !/onALaMain=\{\(choisies\)=>\{[\s\S]{0,900}?setKitMain\(choisies/.test(app), 'D1 « À la main » ouvre la feuille guidée tout de suite (le kit reste à un toucher dedans)');
  dit(/navigator\.share\(\{ files/.test(main) && /usePhotosReglees\(choisies, regs\.photo, paire\.numero, \{ auto: fiche !== undefined && detail !== undefined(?:, source: \{[^}]*\})? \}\)/.test(main) && /if \(auto && photos\.length && !ph\) preparer\(\);/.test(main), 'D2 les photos préparées d’avance, puis UN toucher ouvre le partage de fichiers dans le geste');
  dit(/const lecturePh = photosDeLAnnonce\(\{ coffre: f\.photos, detail, liste: paire\.photos, couverture: paire\.photo/.test(main) && /id=eq\.vinted_item_details&select=ph:data->/.test(main) && !/select=data[&`]/.test(main)
    && /const choisies = photosChoisies\(photos, exclues\)/.test(main) && !/paire\.photo \? \[paire\.photo\]/.test(main) && /photos: \(Array\.isArray\(it\.photosDetail\)/.test(app),
    'D6 la feuille prend TOUTES les photos (coffre, fiche de la page en projection, dressing), plus jamais la vignette seule par défaut ; il peut en retirer');
  { const iC = ecran.indexOf('function CurseursPresentation'); const cur = iC >= 0 ? ecran.slice(iC, ecran.indexOf('\nfunction ', iC + 10)) : '';
    dit(/CURSEURS_PHOTO\.map/.test(cur) && /onDoubleClick=\{\(\) => neutreCle\(c\.cle\)\}/.test(cur) && /onPointerUp=\{\(\) => relache\(c\.cle\)\}/.test(cur) && /data-rg-valeur=/.test(cur) && /data-main-neutre/.test(cur) && /<CurseursPresentation regs=\{regs\}/.test(main) && !/regs\.photo\[\s*(?:i|j|u|photo)/.test(cur),
      'D7 les barres : une pour toutes les photos, valeur dite, double-toucher = zéro, « Réinitialiser » ; jamais un réglage par photo'); }
  dit(main && !/vmrCmd|executerCommande|method:\s*'(POST|PUT|DELETE)'/.test(main), 'D3 rien ne part chez Vinted depuis le parcours guidé (c’est lui qui supprime et publie)');
  const enDur = [];
  const iP = ecran.indexOf('function EtapesGuide'), jP = ecran.indexOf('\nfunction usePhotosReglees');
  const guideJsx = [ecran.slice(iP, jP), (() => { const a = ecran.indexOf('function PublierALaMain'); const b2 = ecran.indexOf('\nfunction CarteKit'); return a >= 0 ? ecran.slice(a, b2) : ''; })()].join('\n');
  const re = />\s*([A-Za-zÀ-ÿ’'][^<>{}\n]{2,})\s*</g; let m;
  while ((m = re.exec(guideJsx))) if (/[a-zà-ÿ]{3,}/i.test(m[1])) enDur.push(m[1].trim());
  dit(iP >= 0 && !enDur.length, 'D4 tout texte visible du parcours passe par tr()', enDur.slice(0, 4).join(' | '));
  // (23 nov.) les clés de la feuille refaite (rg2.*) comptent aussi.
  const cles = new Set(); const reC = /tr\('(rg2?\.[\w.]+)'/g; while ((m = reC.exec(guideJsx + app))) cles.add(m[1]);
  for (const k of ['photos', 'supprimer', 'creer', 'fini']) { cles.add(`rg.mot.${k}`); for (const mo of ['republier', 'remettre', 'publier']) cles.add(`rg.titre.${k}.${mo}`); }
  for (const k of ['titre', 'description', 'categorie', 'marque', 'taille', 'etat', 'couleur', 'prix']) { cles.add(`rg.champ.${k}`); cles.add(`rg.vide.${k}`); }
  const manque = [];
  for (const l of LANGUES) for (const k of cles) if (!textes[l] || textes[l][k] == null) manque.push(`${l}:${k}`);
  dit(cles.size > 60 && !manque.length, `D5 les ${cles.size} clés du parcours existent dans les 5 langues`, manque.slice(0, 5).join(' '));
  return out;
}

(async () => {
  const base = Object.fromEntries(Object.entries(F).map(([k, f]) => [k, lire(f)]));
  if (process.argv.includes('--prouve')) {
    let rouges = 0, n = 0;
    for (const [nomM, { f, m }] of Object.entries(MUTATIONS)) {
      n++;
      const s = { ...base, [f]: m(base[f] || '') };
      if (s[f] === base[f]) { console.log(`⚠️  mutation ${nomM} : l’ancre ne correspond plus`); continue; }
      let r; try { r = await auditer(s); } catch (e) { r = [{ ok: false, m: 'plante : ' + e.message }]; }
      const ko = r.filter((x) => !x.ok);
      if (ko.length) rouges++;
      console.log(`${ko.length ? '✅' : '❌'} mutation ${nomM} : ${ko.length} contrôle(s) rouge(s)${ko.length ? ' — ' + ko[0].m : ''}`);
    }
    console.log(`\n${rouges}/${n} mutations attrapées`);
    process.exit(rouges === n ? 0 : 1);
  }
  let r; try { r = await auditer(base); } catch (e) { console.log('❌ l’audit plante : ' + e.message); process.exit(1); }
  for (const x of r) console.log(`${x.ok ? '✅' : '❌'} ${x.m}${x.d !== undefined && x.d !== '' ? ' — ' + x.d : ''}`);
  const ko = r.filter((x) => !x.ok).length;
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s) sur ${r.length}` : `\n✅ republier / publier à la main, guidés, sans hasard ni mots d’évitement : ${r.length} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
