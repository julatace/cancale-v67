// Audit : PARLER À LA LOUPE (11 nov.) — src/dicteeNavigateur.js, ficheDeLaVoix
// (src/rechercheVocale.js) et leur branchement (loupe, champs de recherche).
// EXÉCUTE le moteur avec une FAUSSE reconnaissance (la vraie est celle du
// navigateur, pas du code de VRM) :
//   · pas d'API ⇒ pas de micro ; l'API ⇒ `fr-FR`, transcription EN DIRECT ;
//   · le texte final part UNE fois ; un arrêt sans tranche finale garde l'entendu ;
//   · micro refusé ⇒ code « refus », phrase qui dit quoi faire, plus de micro ;
//   · un N° dit ouvre SA fiche seulement si l'identité est UNIQUE (cleNum) et
//     d'un compte affiché ; sinon la liste ;
//   · aucun son enregistré ni envoyé par VRM ; le « Pourquoi ? » dit le service
//     de l'éditeur du navigateur.
// `--prouve` : chaque règle réaffaiblie doit faire passer l'audit au rouge.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
const { sourceApp } = require('./_source-app.cjs');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');

const FICHIERS = {
  moteur: 'src/dicteeNavigateur.js',
  vocale: 'src/rechercheVocale.js',
  champ: 'src/composants/ChampRecherche.jsx',
  ligne: 'src/composants/voix.jsx',
};

// cleNum de l'app (recopiée telle quelle depuis App.jsx : la même règle).
function cleNumDe(app) {
  const m = /const cleNum = \(v\) => \{[\s\S]*?\n\};/.exec(app);
  if (!m) throw new Error('cleNum introuvable dans App.jsx');
  return new Function(m[0] + '\nreturn cleNum;')();
}

async function charger(src, nom) {
  const f = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

// La fausse reconnaissance : chaque instance est pilotée à la main par le test.
function installerFausse() {
  const vues = [];
  class FausseSR {
    constructor() { this.demarree = false; this.arretee = false; vues.push(this); }
    start() { this.demarree = true; }
    stop() { this.arretee = true; setTimeout(() => this.onend && this.onend(), 0); }
    abort() { this.arretee = true; this.onend && this.onend(); }
    // aides de test
    dire(tranches) { this.onresult && this.onresult({ results: tranches.map(([t, fin]) => Object.assign([{ transcript: t }], { isFinal: fin })) }); }
    erreur(code) { this.onerror && this.onerror({ error: code }); this.onend && this.onend(); }
    fin() { this.onend && this.onend(); }
  }
  global.window = { webkitSpeechRecognition: FausseSR };
  return vues;
}

async function audit(src, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
  const cleNum = cleNumDe(src.app);
  let M, V;
  try { delete global.window; M = await charger(src.moteur, 'dictee'); V = await charger(src.vocale, 'vocale'); } catch (e) { dit(false, 'les modules se chargent', e.message); return ko || 1; }

  // ── 1. Sans API : pas de micro ──────────────────────────────────────────────
  delete global.window;
  dit(M.voixDisponible() === false, 'sans reconnaissance dans le navigateur : pas de micro (`voixDisponible` faux)');
  dit(M.ecouter({ canal: 'x' }) === false, 'sans reconnaissance : `ecouter` ne démarre rien');

  // ── 2. Transcription en direct, puis le texte final UNE fois ────────────────
  const vues = installerFausse();
  dit(M.voixDisponible() === true, 'avec la reconnaissance : le micro existe');
  const directs = [], finals = [], erreurs = [];
  const ok = M.ecouter({ canal: 'loupe', onDirect: (t, f) => directs.push([t, f]), onFinal: (t) => finals.push(t), onErreur: (c) => erreurs.push(c) });
  const r1 = vues[vues.length - 1];
  dit(ok === true && r1 && r1.demarree, 'toucher le micro démarre la reconnaissance');
  dit(r1 && r1.lang === 'fr-FR', 'la reconnaissance écoute en français (fr-FR)', r1 && r1.lang);
  dit(r1 && r1.interimResults === true, 'la transcription arrive EN DIRECT (interimResults)');
  dit(M.etatVoix('loupe').ecoute === true, 'l’état dit « j’écoute »');
  r1.dire([['cent', false]]);
  r1.dire([['cent vingt', false]]);
  dit(M.etatVoix('loupe').direct === 'cent vingt', 'ce qui est entendu s’affiche au fil de la voix', M.etatVoix('loupe').direct);
  dit(directs.length === 2 && finals.length === 0, 'pas de texte final tant que la voix continue', JSON.stringify(directs));
  r1.dire([['cent vingt-quatre', true]]);
  r1.dire([['cent vingt-quatre', true]]);
  r1.fin();
  dit(finals.length === 1 && finals[0] === 'cent vingt-quatre', 'le texte final part UNE fois', JSON.stringify(finals));
  dit(M.etatVoix('loupe').ecoute === false && M.etatVoix('loupe').direct === '', 'à la fin, l’état se vide');

  // ── 3. Arrêt sans tranche finale : l'entendu vaut ───────────────────────────
  const f2 = [];
  M.ecouter({ canal: 'c2', onFinal: (t) => f2.push(t) });
  const r2 = vues[vues.length - 1];
  r2.dire([['nike rouge', false]]); r2.fin();
  dit(f2.length === 1 && f2[0] === 'nike rouge', 'arrêt sans tranche finale : ce qui a été entendu est cherché', JSON.stringify(f2));

  // ── 4. Re-toucher = « j'ai fini » (pas une 2e écoute) ───────────────────────
  const n0 = vues.length;
  M.ecouter({ canal: 'c3' }); const r3 = vues[vues.length - 1];
  M.ecouter({ canal: 'c3' });
  dit(vues.length === n0 + 1 && r3.arretee, 're-toucher le micro arrête l’écoute (une seule à la fois)');
  await new Promise((r) => setTimeout(r, 5));

  // ── 5. Les erreurs : un code, une phrase ; aborted = rien à dire ───────────
  const e5 = []; M.ecouter({ canal: 'c5', onErreur: (c) => e5.push(c) }); vues[vues.length - 1].erreur('no-speech');
  dit(e5[0] === 'aucun-son' && /rien entendu/i.test(M.PHRASES_VOIX['aucun-son']), '« rien entendu » est dit', e5.join());
  const e6 = []; M.ecouter({ canal: 'c6', onErreur: (c) => e6.push(c) }); vues[vues.length - 1].erreur('aborted');
  dit(e6.length === 0, 'un arrêt voulu (aborted) ne dit rien');
  dit(M.codeErreurVoix({ error: 'network' }) === 'reseau' && M.codeErreurVoix({ error: 'audio-capture' }) === 'materiel', 'réseau, micro absent : chacun son code');

  // ── 6. Micro refusé : la phrase claire, puis plus de micro ─────────────────
  const e7 = []; M.ecouter({ canal: 'c7', onErreur: (c) => e7.push(c) }); vues[vues.length - 1].erreur('not-allowed');
  dit(e7[0] === 'refus' && M.etatVoix('c7').erreur === 'refus', 'micro refusé ⇒ code « refus », gardé dans l’état', e7.join());
  dit(/refus/i.test(M.PHRASES_VOIX.refus) && /autorise/i.test(M.PHRASES_VOIX.refus) && /tape/i.test(M.PHRASES_VOIX.refus), 'la phrase dit quoi faire (autoriser le micro, ou taper)', M.PHRASES_VOIX.refus);
  dit(M.VOIX.refus === true && M.ecouter({ canal: 'c8' }) === false, 'après un refus, plus de micro de la session (jamais un bouton mort)');

  // ── 7. Le « Pourquoi ? » ────────────────────────────────────────────────────
  dit(/navigateur/.test(M.POURQUOI_VOIX) && /aucun son/i.test(M.POURQUOI_VOIX) && /éditeur/.test(M.POURQUOI_VOIX) && /Google|Microsoft|Apple/.test(M.POURQUOI_VOIX), '« Pourquoi ? » : VRM n’envoie aucun son ; le navigateur peut utiliser le service de son éditeur');

  // ── 8. Un N° dit ouvre SA fiche seulement si l'identité est UNIQUE ─────────
  const fiches = {
    a: { numero: '124', accountId: '111' }, b: { numero: 'B125', accountId: '111' }, c: { numero: '125', accountId: '111' },
    d: { numero: '7', accountId: '111' }, e: { numero: '007', accountId: '222' },      // « 007 » = « 7 » : deux fiches
    f: { numero: '300', accountId: '999' },                                            // compte écarté
  };
  for (let i = 0; i < 50; i++) fiches['jum' + i] = { numero: String(500 + i), title: 'Nike Dunk Low noire 42', accountId: '111' };
  const ok2 = new Set(['111', '222']);
  const via = (dite) => { const r = V.requeteDeLaVoix(dite); return r.numero ? V.ficheDeLaVoix(r.requete, fiches, cleNum, ok2) : null; };
  dit(via('cent vingt-quatre') === '124', '« cent vingt-quatre » ⇒ la fiche N°124 (unique)', via('cent vingt-quatre'));
  dit(via('numéro B 125') === 'B125', '« numéro B 125 » ⇒ la fiche B125 (pas la 125)', via('numéro B 125'));
  dit(via('cent vingt-cinq') === '125', '« cent vingt-cinq » ⇒ la 125 (pas la B125)', via('cent vingt-cinq'));
  dit(via('sept') === null, 'deux fiches au même N° (« 7 » et « 007 ») ⇒ rien ouvert, la liste', via('sept'));
  dit(via('trois cents') === null, 'la fiche d’un compte écarté ⇒ rien ouvert', via('trois cents'));
  dit(via('neuf cent quatre-vingt-dix-neuf') === null, 'un N° qu’aucune fiche ne porte ⇒ rien ouvert');
  dit(via('Nike Dunk Low noire quarante-deux') === null && V.requeteDeLaVoix('Nike Dunk Low noire quarante-deux').requete === 'Nike Dunk Low noire 42', 'un texte (50 paires au même titre) ⇒ la recherche normale, jamais une fiche', V.requeteDeLaVoix('Nike Dunk Low noire quarante-deux').requete);
  dit(V.ficheDeLaVoix('124', fiches, cleNum, null) === '124', 'sans liste de comptes : l’unicité seule décide');

  // ── 9. Branchement ─────────────────────────────────────────────────────────
  const sans = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');
  const app = sans(src.app), champ = sans(src.champ), ligne = sans(src.ligne), moteur = sans(src.moteur);
  dit(/const dicterRecherche = \(t\) => \{[\s\S]{0,400}?if \(r\.numero\) \{[\s\S]{0,300}?ficheDeLaVoix\(r\.requete, load\('vinted_annonce_numeros'[\s\S]{0,200}?comptesRecherche\(vintedAccounts\)\);[\s\S]{0,120}?if \(n\) \{[^}]*setFicheNum\(n\)/.test(app), 'la loupe : un N° dit unique ⇒ setFicheNum (sa fiche), par `ficheDeLaVoix`');
  dit(/const directRecherche = \(t\) => \{ setGsQ\(t\)/.test(app) && /onDirect=\{directRecherche\}/.test(app), 'la loupe : la transcription en direct s’écrit dans le champ');
  dit(/data-recherche-loupe=""[^>]*onPointerDown=\{[\s\S]{0,400}?setTimeout\(\(\)=>\{ appuiLoupe\.current\.long=true;[\s\S]{0,120}?dicterLoupe\(\)/.test(app), 'au téléphone : l’appui long sur la loupe ouvre et écoute');
  dit(/onClick=\{\(\)=>\{ if\(appuiLoupe\.current\.long\)\{ appuiLoupe\.current\.long=false; return; \}/.test(app), 'l’appui long ne referme pas la loupe en relâchant');
  dit(/<LigneVoix canal="loupe" Pourquoi=\{Pourquoi\}/.test(app), 'la loupe affiche « J’écoute… », l’entendu, l’erreur et le « Pourquoi ? »');
  dit(/data-voix-erreur=\{code\}/.test(ligne) && /VOIX\.refus \? 'refus'/.test(ligne) && /data-voix-entendu/.test(ligne), 'la ligne de la loupe garde la phrase du refus');
  dit(/ecouter\(\{ canal,[\s\S]{0,200}?onDirect:[\s\S]{0,200}?onFinal: \(t\) => \{ const texte = voix === 'brut' \? String\(t\)\.trim\(\) : requeteDeLaVoix\(t\)\.requete;/.test(champ), 'chaque champ de recherche : moteur commun, en direct, puis `requeteDeLaVoix`');
  dit(/const avecMicro = micro && voixDisponible\(\) && !VOIX\.refus;/.test(champ) && /\{phrase \? <span className="vrm-champ-recherche-voix" data-voix-erreur=\{phrase\}/.test(champ), 'champ : pas de micro sans API ou refusé ; la phrase du refus s’affiche');
  dit(/micro data-ventes-recherche=""\/>/.test(app) && /placeholder="Rechercher une vente" micro/.test(app), 'Ventes : le champ de recherche a son micro');
  const nMicros = (app.match(/<ChampRecherche[^>]*\smicro[\s>]/g) || []).length;
  dit(nMicros >= 4, 'les champs de liste (Annonces, Messages, Ventes…) ont leur micro', String(nMicros));
  dit(/if \(!DICTEE_OK \|\| refus\) return null;/.test(app) && /const refus = VOIX\.refus;/.test(app), 'MicDictee : pas de bouton sans API ou micro refusé');
  dit(/onErreur: \(code\) => \{ if \(onErreur\) onErreur\(code\); else toast\(PHRASES_VOIX\[code\]/.test(app), 'MicDictee : l’erreur est DITE (plus jamais « sans un mot »)');
  const tout = [app, champ, ligne, moteur].join('\n');
  dit(!/MediaRecorder|getUserMedia|AudioContext/.test(tout) && !/fetch\([^)]*(speech|whisper|transcri|audio)/i.test(tout), 'aucun son enregistré ni envoyé par VRM (ni MediaRecorder, ni getUserMedia, ni appel de transcription)');
  return ko;
}

function sources(racine = R) {
  const s = {}; for (const [k, f] of Object.entries(FICHIERS)) s[k] = fs.readFileSync(path.join(racine, f), 'utf8');
  s.app = sourceApp(racine); return s;
}

const MUTATIONS = {
  pas_en_direct: ['moteur', "rec.interimResults = true;", "rec.interimResults = false;"],
  final_deux_fois: ['moteur', "if (fini) return; fini = true;", "fini = true;"],
  refus_oublie: ['moteur', "if (code === 'refus') VOIX.refus = true;", ''],
  fin_perd_entendu: ['moteur', "if (!fini && dernier) finir(dernier);", ''],
  aborted_dit: ['moteur', "if (c === 'aborted') return null;", ''],
  langue: ['moteur', "rec.lang = 'fr-FR';", "rec.lang = 'en-US';"],
  pourquoi_muet: ['moteur', "Selon le navigateur, la reconnaissance peut passer par le service de son éditeur (Google pour Chrome, Microsoft pour Edge, Apple pour Safari). ", ''],
  premiere_fiche: ['vocale', "if (fs.length !== 1) return null;", "if (!fs.length) return null;"],
  compte_ignore: ['vocale', "if (okUid && f.accountId && !okUid.has(String(f.accountId))) return null;", ''],
  sans_cle: ['vocale', "cleNum(String(f.numero)) === k", "String(f.numero) === String(requete)"],
  loupe_sans_fiche: ['app', "if (n) { setGsQ(r.requete); setGsRecents(noterRecent(r.requete)); setGsOpen(false); setFicheNum(n); return; }", ''],
  sans_appui_long: ['app', "appuiLoupe.current.t=setTimeout(()=>{ appuiLoupe.current.long=true; flushSync(()=>setGsOpen(true)); if(!ecouteEnCours('loupe')) dicterLoupe(); }, 550);", ''],
  champ_muet: ['champ', "{phrase ? <span className=\"vrm-champ-recherche-voix\" data-voix-erreur={phrase}", "{false ? <span className=\"vrm-champ-recherche-voix\" data-voix-erreur={phrase}"],
  champ_brut: ['champ', ": requeteDeLaVoix(t).requete; if (onChange) onChange(texte);", ": String(t); if (onChange) onChange(texte);"],
  mic_sans_mot: ['app', "if (onErreur) onErreur(code); else toast(PHRASES_VOIX[code] || PHRASES_VOIX.autre);", ''],
};

(async () => {
  if (process.argv.includes('--prouve')) {
    const src = sources();
    let rate = 0;
    for (const [nom, [cle, de, vers]] of Object.entries(MUTATIONS)) {
      if (!src[cle].includes(de)) { console.log(`❌ mutation ${nom} : ancre introuvable (comptée ROUGE de la preuve)`); rate++; continue; }
      const m = { ...src, [cle]: src[cle].replace(de, vers) };
      const ko = await audit(m, false);
      console.log(`${ko ? '✅' : '❌'} mutation ${nom} : ${ko ? ko + ' rouge(s)' : 'AUCUN rouge'}`);
      if (!ko) rate++;
    }
    console.log(rate ? `\n❌ ${rate} mutation(s) non détectée(s)` : `\n✅ toutes les mutations (${Object.keys(MUTATIONS).length}) sont rouges`);
    process.exit(rate ? 1 : 0);
  }
  const racine = process.argv.includes('--racine') ? process.argv[process.argv.indexOf('--racine') + 1] : R;
  let s;
  try { s = sources(racine); } catch (e) { console.log('❌ les fichiers du lot n’existent pas : ' + e.message.split('\n')[0]); process.exit(1); }
  const ko = await audit(s, true);
  console.log(ko ? `\n❌ audit-parler-loupe : ${ko} rouge(s)` : '\n✅ audit-parler-loupe : tout vert');
  process.exit(ko ? 1 : 0);
})();
