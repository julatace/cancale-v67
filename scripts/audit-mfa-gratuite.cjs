// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « DOUBLE VÉRIFICATION GRATUITE » (22 octobre).
//
//  ⛔ Décision de Julien : PAS de SMS — c'est payant (75 $/mois chez Supabase
//  pour le facteur téléphone, plus chaque SMS facturé ; §2.9). La branche
//  `codex/mfa-sms` n'a pas été gardée. Le chemin de secours est un SECOND
//  APPAREIL d'authentification (TOTP, gratuit).
//
//  1. Aucun code (commentaires retirés) n'enrôle un facteur téléphone ni ne
//     demande un SMS — sinon une session future « complète la symétrie » et
//     branche le payant sans qu'il l'ait voulu.
//  2. La règle « le code de N'IMPORTE LEQUEL de ses appareils » est EXÉCUTÉE
//     (le vrai `mfaVerifierCodeParmi` d'App.jsx dans un `vm`, contre un faux
//     GoTrue où chaque facteur a SON code) : le code du second appareil passe ;
//     un facteur injoignable donne « pas su », jamais « faux » ; un 429 donne
//     « trop d'essais » et arrête ; une liste entièrement périmée le dit.
//  `--mutation=premier` (ne défier que le premier), `--mutation=trop` (429 lu
//  comme « faux »), `--mutation=passu` (une panne lue comme « faux ») : chacune
//  doit faire passer l'audit au ROUGE (§6.1).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const RACINE = path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, n = 0;
const dit = (bon, quoi, detail) => { n++; if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };
// Les commentaires ne sont pas du code (ils citent l'ancienne règle) : on les
// neutralise en gardant les retours à la ligne, pour nommer la vraie ligne.
const sansCommentaires = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length));
const fichiers = (dir, ext) => {
  const out = [];
  const tour = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(e.name)) tour(p); } else if (ext.test(e.name)) out.push(p);
  } };
  if (fs.existsSync(dir)) tour(dir);
  return out;
};

(async () => {
  console.log('── 1. Aucun SMS, aucun facteur téléphone (décision de Julien : payant)');
  {
    const MOTIFS = [
      [/factor_type\s*:\s*['"`]phone['"`]/, "enrôlement d'un facteur téléphone"],
      [/channel\s*:\s*['"`](sms|whatsapp)['"`]/i, "demande d'un code par SMS"],
      [/\[\s*['"`]totp['"`]\s*,\s*['"`]phone['"`]\s*\]|\[\s*['"`]phone['"`]\s*,\s*['"`]totp['"`]\s*\]/, 'facteurs « totp + phone » traités ensemble'],
      [/from\s+['"`][^'"`]*(mfaSms|VerificationSms)[^'"`]*['"`]/, 'module SMS importé'],
    ];
    const trouves = [];
    for (const f of [...fichiers(path.join(RACINE, 'src'), /\.(jsx?|mjs)$/), ...fichiers(path.join(RACINE, 'api'), /\.(js|mjs)$/)]) {
      const lignes = sansCommentaires(fs.readFileSync(f, 'utf8')).split('\n');
      lignes.forEach((l, i) => { for (const [re, quoi] of MOTIFS) if (re.test(l)) trouves.push(`${path.relative(RACINE, f)}:${i + 1} (${quoi})`); });
    }
    for (const f of ['src/mfaSms.js', 'src/VerificationSms.jsx']) if (fs.existsSync(path.join(RACINE, f))) trouves.push(f + ' (fichier SMS présent)');
    dit(!trouves.length, "ni l'app ni le serveur ne proposent le SMS", trouves.slice(0, 6).join(' · '));
  }

  console.log("── 2. Le code de N'IMPORTE LEQUEL de ses appareils (règle exécutée)");
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const a = app.indexOf('const MFA_CODE_FAUX'), b = app.indexOf('const authValid', a);
  if (a < 0 || b < 0) { dit(false, 'la règle `mfaVerifierCodeParmi` est trouvée dans App.jsx', 'introuvable'); return fin(); }
  let code = app.slice(a, b);
  if (MUT === 'premier') code = code.replace('for (const id of liste) {', 'for (const id of liste.slice(0, 1)) {');
  if (MUT === 'trop') code = code.replace(/if \(r\.trop\) return r;/, '');
  if (MUT === 'passu') code = code.replace('if (passu) return { ok: false, passu: true };', '');
  // Un faux GoTrue : chaque facteur a SON code ; `etats[id]` force une réponse.
  const essai = async (facteurs, etats, saisi) => {
    const journal = [];
    const ctx = vm.createContext({
      console, Array, Set, String, Object, JSON, encodeURIComponent,
      writeSession: () => {},
      sessionFrom: (j) => ({ access_token: j.access_token, totp: [], totpNoms: {} }),
      mfaInjoignable: (r) => !r || r.status === 0 || r.status >= 500,
      mfaAppel: async (m, chemin) => {
        const mm = /^factors\/([^/]+)\/(challenge|verify)$/.exec(chemin);
        const id = mm && decodeURIComponent(mm[1]);
        journal.push(`${mm && mm[2]}:${id}`);
        const forcer = etats[id];
        if (forcer === 'absent') return { ok: false, status: 404, json: { code: 'mfa_factor_not_found' } };
        if (forcer === 'panne') return { ok: false, status: 503, json: {} };
        if (forcer === 'trop') return { ok: false, status: 429, json: { msg: 'Too many requests' } };
        if (mm[2] === 'challenge') return { ok: true, status: 200, json: { id: 'ch-' + id } };
        return facteurs[id] === saisi ? { ok: true, status: 200, json: { access_token: 'aal2' } } : { ok: false, status: 422, json: { code: 'mfa_verification_failed' } };
      },
    });
    vm.runInContext(code + ';globalThis.__parmi = mfaVerifierCodeParmi;', ctx);
    let r;
    try { r = await ctx.__parmi(Object.keys(facteurs), saisi); } catch (e) { r = { erreur: String(e && e.message) }; }
    return { r, journal };
  };
  const deux = { tel: '111111', ipad: '222222' };
  const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String(e && e.message).slice(0, 120)); } };
  await essaie('second appareil', async () => {
    const { r, journal } = await essai(deux, {}, '222222');
    dit(r.ok === true && r.factorId === 'ipad', "le code du SECOND appareil fait entrer", JSON.stringify(r) + ' · ' + journal.join(' '));
  });
  await essaie('premier appareil', async () => {
    const { r, journal } = await essai(deux, {}, '111111');
    dit(r.ok === true && r.factorId === 'tel' && journal.length === 2, 'le code du premier fait entrer sans défier le second', journal.join(' '));
  });
  await essaie('code faux', async () => {
    const { r } = await essai(deux, {}, '000000');
    dit(r.ok === false && r.faux === true, "un code qui ne vaut pour aucun appareil est « faux »", JSON.stringify(r).slice(0, 80));
  });
  await essaie('panne', async () => {
    const { r } = await essai(deux, { ipad: 'panne' }, '000000');
    dit(r.ok === false && r.passu === true && !r.faux, "un appareil injoignable ⇒ « pas su », jamais « faux » (le code était peut-être le sien)", JSON.stringify(r).slice(0, 80));
  });
  await essaie('429', async () => {
    const { r, journal } = await essai(deux, { tel: 'trop' }, '222222');
    dit(r.ok === false && r.trop === true && !journal.some((x) => /ipad/.test(x)), "un 429 ⇒ « trop d'essais », et on s'arrête (un essai de plus aggraverait l'attente)", JSON.stringify(r).slice(0, 60) + ' · ' + journal.join(' '));
  });
  await essaie('périmée', async () => {
    const { r } = await essai(deux, { tel: 'absent', ipad: 'absent' }, '222222');
    dit(r.ok === false && r.introuvable === true, 'tous les appareils ont disparu ⇒ « liste périmée » (la porte relit), pas « faux »', JSON.stringify(r).slice(0, 80));
  });
  await essaie('un absent', async () => {
    const { r } = await essai(deux, { tel: 'absent' }, '222222');
    dit(r.ok === true && r.factorId === 'ipad', "un appareil retiré ailleurs n'empêche pas l'autre de faire entrer", JSON.stringify(r).slice(0, 80));
  });
  fin();
})();
function fin() {
  console.log(ko ? `\n❌ double vérification gratuite : ${ko} rouge(s) sur ${n}${MUT ? ' (mutation ' + MUT + ')' : ''}` : `\n✅ double vérification gratuite : ${n} contrôles verts`);
  process.exit(ko ? 1 : 0);
}
