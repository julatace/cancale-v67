// Audit : « REPUBLIER À LA MAIN » CONSEILLÉ ET LE KIT DE PLUSIEURS ANNONCES (10 nov., lot AP).
// Julien (9 nov., demande 17) : « la conseiller (moins risquée) et la rendre attirante ;
// transmettre les photos retouchées à la galerie du téléphone ; … comment gérer les
// descriptions en sélection multiple ».
//
//   A. la règle (src/republierKit.js, EXÉCUTÉE) : le N° à copier est l'étiquette telle
//      qu'écrite dans l'annonce, sinon « N°42 », jamais inventé ; une description pas lue
//      est DITE (jamais copiée vide) ; « Tout copier » garde l'ordre de ses clics ; la
//      couverture dit « 2 sur 3 », pas « tout est prêt » ;
//   B. le branchement : la vue Republier offre « À la main » en bouton principal (conseil
//      en tête) et « Par VRM » en second ; le kit calcule chaque texte par LA règle de
//      l'atelier (`annonceRepubliee`), ses photos par LE dessin commun (`usePhotosReglees`,
//      une à une ou toutes, menu de partage avec fichiers) ; rien ne part chez Vinted ;
//      « À la main » passe par la règle de la tuile (`actionsPossibles` … 'main') ; le N°
//      ne suit la paire que par SON clic (suivi `poserRepubMain`, jamais par ressemblance).
// --prouve : chaque mutation (règle affaiblie ou branchement retiré) doit rendre un rouge.
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), url = require('url');
const RAC = path.join(__dirname, '..');
const F = { kit: path.join(RAC, 'src', 'republierKit.js'), app: path.join(RAC, 'src', 'App.jsx') };

const MUTATIONS = {
  num_invente: { f: 'kit', m: (s) => s.replace("if (!n) return '';", "if (!n) return 'N°?';") },
  etiquette_ignoree: { f: 'kit', m: (s) => s.replace("return t || `N°${n}`;", 'return `N°${n}`;') },
  desc_vide_copiee: { f: 'kit', m: (s) => s.replace("const corps = desc.trim() ? desc : (x.lue === false || x.lue === undefined ? DESC_PAS_LUE : 'Pas de description.');", 'const corps = desc;') },
  couverture_toutes: { f: 'kit', m: (s) => s.replace('lues: l.filter((p) => p && p.lue === true).length', 'lues: l.length') },
  ordre_trie: { f: 'kit', m: (s) => s.replace('return (Array.isArray(paires) ? paires : []).map(blocPaire)', 'return (Array.isArray(paires) ? paires : []).slice().sort((a, b) => String(a.numero).localeCompare(String(b.numero))).map(blocPaire)') },
  main_secondaire: { f: 'app', m: (s) => s.replace('<Bouton variante="primaire" icone="shield" data-republier-main-lancer', '<Bouton variante="secondaire" icone="shield" data-republier-main-lancer') },
  sans_conseil: { f: 'app', m: (s) => s.replace('data-republier-conseil="main"', 'data-x=""') },
  kit_copie_texte: { f: 'app', m: (s) => s.replace('const annK = annonceRepubliee(', 'const annK0 = annonceRepubliee(').replace('    return { k, p, f, ann: annK, photos, lue };', '    const annK = { ...annK0, description: String(fo.desc || \'\') };\n    return { k, p, f, ann: annK, photos, lue };') },
  kit_photos_brutes: { f: 'app', m: (s) => s.replace('const { ph, pretes, enregistrer, libelle } = usePhotosReglees(photos, regs.photo, p.numero);', 'const ph = null, pretes = false, libelle = \'Photos\'; const enregistrer = () => photos.forEach((u) => window.open(u));') },
  une_photo_retiree: { f: 'app', m: (s) => s.replace('data-main-photo-une={i}', 'data-x={i}') },
  kit_envoie: { f: 'app', m: (s) => s.replace("onClick={() => onOuvrirVinted && onOuvrirVinted()}", "onClick={() => { onOuvrirVinted && onOuvrirVinted(); vmrCmd({ cmd: 'recreerVinted' }); }}") },
  main_sans_regle: { f: 'app', m: (s) => s.replace(".find(x=>x.k==='main');\n              if (!r || !r.ok) { toast((r && r.raison) || 'À la main n’est pas possible pour cette sélection.'); return; }", ".find(x=>x.k==='main');") },
  num_par_titre: { f: 'app', m: (s) => s.replace("if (p.numero && !repubMain[String(p.id)]) poserRepubMain(String(p.id),", "if (p.numero && !repubMain[String(p.id)]) poserRepubMain(String((annSelectionnables.find(x=>x.titre===p.titre)||p).id),") },
};

async function chargerModule(src) {
  const f = path.join(os.tmpdir(), `republierKit-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(url.pathToFileURL(f).href); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const tranche = (s, a, b) => { const i = s.indexOf(a); if (i < 0) return ''; const j = s.indexOf(b, i + a.length); return s.slice(i, j < 0 ? undefined : j); };

async function auditer(src) {
  const out = []; const dit = (ok, m, d) => out.push({ ok: !!ok, m, d });
  // ── A : la règle, exécutée ──
  const K = await chargerModule(src.kit);
  dit(K.numeroACopier('42', { pose: true, texte: 'Réf. 42' }) === 'Réf. 42', 'A1 le N° à copier est l’étiquette telle qu’écrite dans l’annonce');
  dit(K.numeroACopier('42', { pose: false }) === 'N°42' && K.numeroACopier(' 7 ', null) === 'N°7', 'A2 sans étiquette posée : « N°42 »');
  dit(K.numeroACopier('', { pose: true, texte: 'N°' }) === '' && K.numeroACopier(null) === '', 'A3 pas de N° ⇒ rien (jamais inventé)');
  const pasLue = K.blocPaire({ numero: '42', titre: 'Nike', description: '', lue: false });
  const enCours = K.blocPaire({ numero: '42', titre: 'Nike', description: '' });
  dit(pasLue.includes(K.DESC_PAS_LUE) && enCours.includes(K.DESC_PAS_LUE) && /^N°42 · Nike\n\n/.test(pasLue), 'A4 description pas lue (ou en cours) : DITE, jamais copiée vide', JSON.stringify(pasLue));
  const lue = K.blocPaire({ numero: '43', titre: 'Adidas', description: 'Belle paire.\n\nN°43', lue: true });
  dit(lue === 'N°43 · Adidas\n\nBelle paire.\n\nN°43', 'A5 description lue : copiée mot pour mot', JSON.stringify(lue));
  const tout = K.texteKit([{ numero: '9', titre: 'B', description: 'b', lue: true }, { numero: '10', titre: 'A', description: 'a', lue: true }]);
  dit(tout === 'N°9 · B\n\nb' + K.SEPARATEUR_KIT + 'N°10 · A\n\na', 'A6 « Tout copier » : un bloc par paire, dans l’ordre de ses clics', JSON.stringify(tout));
  const cv = K.couvertureKit([{ lue: true }, { lue: false }, { lue: undefined }]);
  dit(cv.n === 3 && cv.lues === 1 && cv.enCours === 1, 'A7 la couverture dit « 1 sur 3 » (pas lue et en cours ne comptent pas)', JSON.stringify(cv));
  // ── B : le branchement ──
  const app = sansCommentaires(src.app);
  const vue = tranche(app, 'function ChoixAnnoncesVinted(', '\nfunction ActionsSelectionFeuille(');
  const kit = tranche(app, 'function CarteKit(', '\nfunction RepublierVinted(');
  const hook = tranche(app, 'function usePhotosReglees(', '\nfunction CarteKit(');
  const main = tranche(app, 'function RepublierALaMain(', '\nfunction usePhotosReglees(');
  dit(vue && kit && hook && main, 'B0 la vue, le kit, les photos et la feuille pas à pas sont dans l’app', `${vue.length}/${kit.length}/${hook.length}/${main.length}`);
  dit(/data-republier-conseil="main"/.test(vue) && /<Bouton variante="primaire" icone="shield" data-republier-main-lancer/.test(vue) && /<Bouton variante="secondaire" data-republier-lancer/.test(vue), 'B1 vue Republier : « À la main » conseillé, bouton principal ; « Par VRM » en second');
  dit(/const annK = annonceRepubliee\(/.test(kit) && /ann: annK/.test(kit) && !/lotAppliquePrix\(|lotAppliqueTitre\(|brightness\(|\.rotate\(/.test(kit), 'B2 le kit écrit chaque texte par LA règle de l’atelier (aucune copie)');
  dit(/usePhotosReglees\(photos, regs\.photo, p\.numero\)/.test(kit) && /usePhotosReglees\(photos, regs\.photo, paire\.numero\)/.test(main) && /dessinerPhotoReglee\(ctx, img, w, h, r\)/.test(hook) && /navigator\.share\(\{ files/.test(hook), 'B3 les photos du kit et du pas à pas : LE même dessin, menu de partage avec fichiers');
  dit(/enregistrerUne/.test(hook) && /data-main-photo-une=\{i\}/.test(main) && /onClick=\{\(\) => enregistrerUne\(i\)\}/.test(main), 'B4 une photo préparée s’enregistre aussi seule');
  dit(/data-kit-copier-num/.test(kit) && /data-kit-copier-desc/.test(kit) && /copier\('tout', texteKit\(kit\)\)/.test(kit) && /description: x\.lue === true \? x\.ann\.description : ''/.test(kit), 'B5 N° et description à copier, une à une ou toutes (une description pas lue n’est pas copiée)');
  dit(!/vmrCmd|executerCommande|method:\s*'(POST|PUT|DELETE|PATCH)'/.test(kit + hook), 'B6 rien ne part chez Vinted depuis le kit (c’est lui qui publie)');
  dit(/select=title:data->>title,desc:data->>desc,price:data->>price,photos:data->photos/.test(kit) && !/select=data[&`]/.test(kit), 'B7 la fiche se lit en projection (jamais select=data)');
  dit(/\.find\(x=>x\.k==='main'\);\s*if \(!r \|\| !r\.ok\) \{ toast/.test(app) && /<PreparerALaMain paires=\{kitMain\}/.test(app) && /setRepubMainFile\(l\.length>1 \? \{ liste:l, i:0 \} : null\); setRepubMainOuvert\(l\[0\]\)/.test(app), 'B8 « À la main » : la règle de la tuile ; « Pas à pas » ouvre la feuille en cinq étapes sur la même liste');
  dit(/if \(p\.numero && !repubMain\[String\(p\.id\)\]\) poserRepubMain\(String\(p\.id\),/.test(app), 'B9 le N° suit la paire par SON identité (suivi posé sur l’id, le lien reste son clic)');
  return out;
}

(async () => {
  const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } };
  const base = { kit: lire(F.kit), app: lire(F.app) };
  if (process.argv.includes('--prouve')) {
    let rouges = 0, n = 0;
    for (const [nomM, { f, m }] of Object.entries(MUTATIONS)) {
      n++;
      const s = { ...base, [f]: m(base[f]) };
      if (s[f] === base[f]) { console.log(`⚠️  mutation ${nomM} : l’ancre ne correspond plus`); continue; }
      let r; try { r = await auditer(s); } catch (e) { r = [{ ok: false, m: 'plante : ' + e.message }]; }
      const ko = r.filter((x) => !x.ok);
      if (ko.length) rouges++;
      console.log(`${ko.length ? '✅' : '❌'} mutation ${nomM} : ${ko.length} rouge(s)${ko.length ? ' — ' + ko[0].m : ''}`);
    }
    console.log(`\n${rouges}/${n} mutations attrapées`);
    process.exit(rouges === n ? 0 : 1);
  }
  let r; try { r = await auditer(base); } catch (e) { console.log('❌ l’audit plante : ' + e.message); process.exit(1); }
  for (const x of r) console.log(`${x.ok ? '✅' : '❌'} ${x.m}${x.d !== undefined && x.d !== '' && !x.ok ? ' — ' + x.d : ''}`);
  const ko = r.filter((x) => !x.ok).length;
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s) sur ${r.length}` : `\n✅ à la main conseillé, kit de plusieurs annonces : ${r.length} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
