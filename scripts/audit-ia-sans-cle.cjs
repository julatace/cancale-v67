#!/usr/bin/env node
// Audit : « TOUTES LES FONCTIONS IA SANS AUCUNE CLÉ » (28 nov. 2026, lot ia-sans-cle). Récit : docs/passation/2026-11-28-ia-sans-cle.md.
// Julien : « je ne veux pas avoir à mettre de clé, ni pour moi ni pour les utilisateurs, débrouille-toi ». CLAUDE.md §2.9.
//   A  aucune interface ne demande une clé IA : ni `vrm_ai_key`, ni `ia-cle`, ni « sk-ant », ni texte traduit qui parle
//      d'une clé IA/Anthropic, ni appel de l'app à `/api/ai` hors détourage (code lu, commentaires retirés) ;
//   B  api/ai.js EXÉCUTÉ (fetch espionné) : rédaction, `reply`, `rangement`, GET ⇒ 410 `retire`, AUCUN appel sortant,
//      même avec `AI_API_KEY` posée et pour le propriétaire de l'installation ; le détourage reste routé ;
//      /api/compte?mode=ia-cle n'existe plus ;
//   C  chaque fonction IA a son moteur SANS CLÉ : rangement (modèle du navigateur ⇒ assistant guidé, audit-agent-rangement),
//      réponses (réponses rapides par mots-clés + « ✦ Proposer » du modèle du navigateur), traduction (Translator de Chrome,
//      sinon dit) ;
//   D  « ✦ Proposer » : une sortie SIMULÉE valide est posée ; texte vide, trou {…}, lien, e-mail, téléphone, clé en plus,
//      message refusé par la règle des messages ⇒ rien n'est posé ; la conversation finie par le vendeur ⇒ rien proposé ;
//      sans modèle ⇒ pas de puce.
// `--mutation` : réaffaiblit chaque règle dans une copie et vérifie que l'audit rougit.
const fs = require('fs'), path = require('path'), os = require('os');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const NM = path.join(__dirname, '..', 'node_modules');
const esbuild = require(path.join(NM, 'esbuild'));

const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`])\/\/.*$/gm, '$1');
function fichiers(dir, ext) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiers(p, ext)); else if (ext.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}
function charger(racine) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ia-sans-cle-'));
  const entree = path.join(dir, 'e.js');
  fs.writeFileSync(entree, `export * as rep from ${JSON.stringify(path.join(racine, 'src/reponseNavigateur.js'))};
export * as nav from ${JSON.stringify(path.join(racine, 'src/iaNavigateur.js'))};
export * as rr from ${JSON.stringify(path.join(racine, 'src/reponsesRapides.js'))};
export * as sur from ${JSON.stringify(path.join(racine, 'src/messageSur.js'))};`);
  const out = path.join(dir, 'b.cjs');
  esbuild.buildSync({ entryPoints: [entree], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent', nodePaths: [NM] });
  return require(out);
}

async function juger(racine, bavard = true) {
  let ok = 0, ko = 0;
  const dit = (c, nom, detail) => { if (c) { ok++; if (bavard) console.log('  ✓ ' + nom); } else { ko++; if (bavard) console.log('  ✗ ' + nom + (detail ? '\n     ' + String(detail).slice(0, 300) : '')); } };

  // ── A. Aucune demande de clé IA dans l'interface ──
  {
    const src = fichiers(path.join(racine, 'src'), ['.js', '.jsx']).filter((f) => !f.includes(path.join('src', 'i18n')));
    const fautes = [];
    for (const f of src) {
      const t = sansCommentaires(fs.readFileSync(f, 'utf8'));
      const rel = path.relative(racine, f);
      if (/vrm_ai_key/.test(t)) fautes.push(rel + ' : vrm_ai_key');
      if (/mode=ia-cle|ia-cle'/.test(t)) fautes.push(rel + ' : ia-cle');
      if (/sk-ant/.test(t)) fautes.push(rel + ' : sk-ant');
      if (/['"`]\/api\/ai(\?usage=[a-z]+)?['"`]/.test(t)) fautes.push(rel + ' : appel /api/ai (hors détourage)');
    }
    dit(!fautes.length, 'A aucun écran ne lit, ne demande ni n\'envoie une clé IA, aucun appel à l\'IA du serveur', fautes.join(' · '));
    const i18n = fichiers(path.join(racine, 'src', 'i18n', 'langues'), ['.js']);
    const textes = [];
    const CLE = /(clé|cle) (ia|api ia|anthropic)|ta clé ia|ai key|your key[^"]*anthropic|anthropic|sk-ant|clave de (ia|la ia)|tu clave[^"]*ia|chiave (ia|dell)|ki-schlüssel|dein(en)? schlüssel[^"]*ki/i;
    for (const f of i18n) for (const [, k, v] of fs.readFileSync(f, 'utf8').matchAll(/^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/gm)) if (CLE.test(v)) textes.push(path.relative(racine, f) + ' ' + k);
    dit(!textes.length, 'A aucun texte (5 langues) ne parle d\'une clé IA', textes.slice(0, 8).join(' · '));
    const leg = fs.readFileSync(path.join(racine, 'public', 'legal', 'confidentialite.html'), 'utf8');
    dit(!/Anthropic/.test(leg), 'A la politique de confidentialité ne nomme plus de fournisseur d\'IA (aucune donnée n\'y part)', '');
  }

  // ── B. api/ai.js exécuté : plus aucune IA serveur ──
  {
    const sorties = [];
    const fetchAvant = globalThis.fetch;
    globalThis.fetch = async (u) => { sorties.push(String(u)); return new Response('{}', { status: 200 }); };
    process.env.AI_API_KEY = 'cle-de-julien'; process.env.ANTHROPIC_API_KEY = 'cle-de-julien'; process.env.VRM_OWNER_UID = '11111111-1111-4111-8111-111111111111';
    let ai = null;
    try { ai = await import('file://' + path.join(racine, 'api', 'ai.js') + '?t=' + Date.now()); } catch (e) { dit(false, 'B api/ai.js se charge', e.message); }
    const res = () => { const r = { code: 0, corps: null, h: {}, setHeader(k, v) { r.h[k] = v; }, status(c) { r.code = c; return r; }, json(o) { r.corps = o; return r; }, end() { return r; }, send(o) { r.corps = o; return r; } }; return r; };
    if (ai) {
      const cas = [
        ['rédaction', { method: 'POST', query: {}, headers: { authorization: 'Bearer a.b.c' }, body: { title: 'Nike', key: 'sk-ant-du-vendeur-0123456789abcdef' } }],
        ['aide à la réponse', { method: 'POST', query: {}, headers: { authorization: 'Bearer a.b.c' }, body: { mode: 'reply', message: 'dispo ?' } }],
        ['rangement', { method: 'POST', query: {}, headers: { authorization: 'Bearer a.b.c' }, body: { mode: 'rangement', historique: [] } }],
        ['sonde GET', { method: 'GET', query: {}, headers: {} }],
        ['sonde du rangement', { method: 'GET', query: { usage: 'rangement' }, headers: { authorization: 'Bearer a.b.c' } }],
      ];
      for (const [nom, req] of cas) {
        sorties.length = 0; const r = res();
        try { await ai.default(req, r); } catch (e) { r.code = -1; r.corps = { e: e.message }; }
        dit(r.code === 410 && r.corps && r.corps.reason === 'retire' && r.corps.ready !== true && sorties.length === 0, `B ${nom} ⇒ 410 « retire », aucun appel sortant (même AI_API_KEY posée)`, `HTTP ${r.code} ${JSON.stringify(r.corps)} sorties=${JSON.stringify(sorties)}`);
      }
      const src = sansCommentaires(fs.readFileSync(path.join(racine, 'api', 'ai.js'), 'utf8'));
      dit(/mode === 'detourage'\) return handleDetourage\(req, res\)/.test(src), 'B le détourage reste routé (/api/detourage)', '');
    }
    globalThis.fetch = fetchAvant;
    delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
    const compte = sansCommentaires(fs.readFileSync(path.join(racine, 'api', 'compte.js'), 'utf8'));
    dit(!/mode === 'ia-cle'/.test(compte) && !fs.existsSync(path.join(racine, 'api', '_lib', 'ia-cle.js')), 'B /api/compte?mode=ia-cle et le coffre de clé IA n\'existent plus', '');
    const nApi = fs.readdirSync(path.join(racine, 'api')).filter((f) => f.endsWith('.js')).length;
    dit(nApi <= 12, 'B toujours ≤ 12 fonctions api/', nApi);
  }

  // ── C. Chaque fonction IA a son moteur sans clé ──
  {
    const lire = (f) => sansCommentaires(fs.readFileSync(path.join(racine, f), 'utf8'));
    const ar = lire('src/rangement/AssistantRangement.jsx');
    dit(/etatModele\(/.test(ar) && /demarrer\(ctx\)/.test(ar), 'C rangement : modèle du navigateur, sinon l\'assistant guidé (entretien.js)', '');
    const rra = lire('src/ReponsesRapidesApp.jsx');
    dit(/rrPropositions\(/.test(rra) && /<ReponseNavigateur /.test(rra), 'C réponses : réponses rapides par mots-clés + « ✦ Proposer » du modèle du navigateur', '');
    const tl = lire('src/TraduireLocal.jsx');
    dit(/window\.Translator\.create/.test(tl) && /TraductionAbsente/.test(tl) && !/fetch\s*\(/.test(tl), 'C traduction : le Translator intégré au navigateur, sinon dit — aucun réseau', '');
    const rn = lire('src/ReponseNavigateur.jsx') + lire('src/reponseNavigateur.js') + lire('src/iaNavigateur.js');
    dit(!/fetch\s*\(|XMLHttpRequest|sendBeacon/.test(rn), 'C le modèle du navigateur : aucun appel réseau (rien ne part chez un tiers)', '');
    dit(/modele !== 'disponible'/.test(lire('src/ReponseNavigateur.jsx')), 'C « ✦ Proposer » n\'apparaît que si le modèle est prêt (jamais un bouton mort)', '');
  }

  // ── D. « ✦ Proposer » : la validation ──
  {
    let M = null;
    try { M = charger(racine); } catch (e) { dit(false, 'D les modules se chargent', e.message); }
    if (M) {
      const { rep: P, nav: N, sur: S } = M;
      const sur = (t) => !S.risquesMessage(String(t || ''), 'vinted').length;
      const msgs = [{ deMoi: false, texte: 'Bonjour, elle taille comment ?' }];
      const faux = (sortie) => ({ LanguageModel: { availability: async () => 'available', create: async () => ({ prompt: async () => sortie, destroy() {} }) } });
      const s = await N.ouvrirSession({ systeme: P.consigneReponse('fr'), w: faux('{"texte":"Bonjour ! Elle taille normalement, prends ta pointure habituelle."}') });
      const j = await N.demanderJSON(s, P.messageReponse({ messages: msgs, vars: { article: 'Nike Air Max 90', taille: '42' } }), P.SCHEMA_REPONSE_MESSAGE);
      const t = j.ok ? P.lireReponse(j.objet, { sur }) : null;
      dit(t === 'Bonjour ! Elle taille normalement, prends ta pointure habituelle.', 'D une réponse simulée valide est posée dans le champ', JSON.stringify(j));
      const mauvais = [
        ['vide', { texte: '  ' }], ['trou {pseudo}', { texte: 'Salut {pseudo} !' }], ['trou [prix]', { texte: 'Je te la fais à [prix]' }],
        ['lien', { texte: 'Regarde https://exemple.test/x' }], ['e-mail', { texte: 'Écris-moi à moi@exemple.fr' }],
        ['téléphone', { texte: 'Appelle le 06 12 34 56 78' }], ['clé en plus', { texte: 'Ok', envoyer: true }], ['trop long', { texte: 'a'.repeat(700) }],
        ['pas un objet', 'Bonjour'],
      ];
      for (const [nom, o] of mauvais) dit(P.lireReponse(o, { sur: () => true }) === null, 'D refusé par VRM même si la règle des messages laissait passer : ' + nom, JSON.stringify(o).slice(0, 80));
      dit(P.lireReponse({ texte: 'Paie-moi par virement en dehors de la plateforme' }, { sur: () => false }) === null, 'D refusé : la règle des messages dit non', '');
      dit(P.aRepondre(msgs) === true && P.aRepondre([...msgs, { deMoi: true, texte: 'Normal.' }]) === false && P.aRepondre([]) === false, 'D rien à proposer quand le dernier mot est le sien (ou fil vide)', '');
      const m = P.messageReponse({ messages: msgs, vars: { article: 'Nike', prix: 50 } });
      dit(/"prix":"50 €"/.test(m) && !/prix_mini|undefined|null/.test(m), 'D le modèle ne reçoit que ce qui est SU (jamais le prix mini)', m.slice(0, 160));
      dit(await N.etatModele({ w: {} }) === 'absente', 'D sans modèle ⇒ absente ⇒ pas de puce', '');
    }
  }
  return { ok, ko };
}

const MUTATIONS = [
  ['src/reponseNavigateur.js', "if (/[{}<>]|\\[\\s*[A-Za-zÀ-ÿ_]+\\s*\\]/.test(t)) return null;", '', 'un trou {…} est posé'],
  ['src/reponseNavigateur.js', "if (/https?:\\/\\/|www\\.|@[a-z0-9-]+\\.[a-z]{2,}/i.test(t)) return null;", '', 'un lien est posé'],
  ['src/reponseNavigateur.js', "try { if (!sur(t)) return null; } catch (_) { return null; }", '', 'la règle des messages est ignorée'],
  ['src/reponseNavigateur.js', "if (Object.keys(o).some((k) => k !== 'texte')) return null;", '', 'une clé en plus passe'],
  ['src/ReponseNavigateur.jsx', "if (modele !== 'disponible' || !onChoisir || !aRepondre(messages)) return null;", "if (!onChoisir) return null;", 'la puce s\'affiche sans modèle'],
  ['api/ai.js', "res.status(410).json({ ok: false, ready: false, reason: 'retire'", "await fetch('https://api.anthropic.com/v1/messages', { headers: { 'x-api-key': process.env.AI_API_KEY } }); res.status(410).json({ ok: false, ready: false, reason: 'retire'", 'api/ai.js rappelle un fournisseur d\'IA'],
  ['src/i18n/langues/fr/rangement.js', '"rgt.modele.b": "Télécharger",', '"rgt.modele.b": "Ajouter ma clé IA",', 'un texte redemande une clé IA'],
];

(async () => {
  console.log('audit-ia-sans-cle');
  const r = await juger(R);
  if (process.argv.includes('--mutation')) {
    let rouges = 0;
    for (const [f, de, vers, nom] of MUTATIONS) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-iasc-'));
      for (const x of ['src', 'api', 'public/legal']) fs.cpSync(path.join(R, x), path.join(dir, x), { recursive: true });
      const p = path.join(dir, f); const s = fs.readFileSync(p, 'utf8');
      if (!s.includes(de)) { console.log('  ? mutation introuvable : ' + nom); continue; }
      fs.writeFileSync(p, s.replace(de, vers));
      let m; try { m = await juger(dir, false); } catch (e) { m = { ko: 1 }; }
      if (m.ko > 0) { rouges++; console.log(`  ✓ mutation rouge (${m.ko}) : ${nom}`); } else console.log('  ✗ mutation VERTE : ' + nom);
      fs.rmSync(dir, { recursive: true, force: true });
    }
    console.log(`mutations : ${rouges}/${MUTATIONS.length} rouges`);
    if (rouges !== MUTATIONS.length) r.ko++;
  }
  console.log(`\naudit-ia-sans-cle : ${r.ok} vert(s), ${r.ko} rouge(s)`);
  process.exit(r.ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
