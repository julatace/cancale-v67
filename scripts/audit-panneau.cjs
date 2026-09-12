// ⚠️⚠️ CONTRÔLE PERMANENT — LE PANNEAU SUR VINTED NE DOIT JAMAIS DIRE
//        « TOUT EST À JOUR » QUAND IL N'A RIEN PU LIRE.
//
// Treizième forme de « rien lu ne vaut pas rien », et sur la surface que Julien
// regarde TOUS LES JOURS : le panneau VRM, sur vinted.fr.
//
// Mesuré le 12 septembre, quatrième jour de base injoignable. `buildPanelData`
// fait vingt-deux lectures, toutes écrites `(rows && rows[0] && rows[0].data)
// || {}` ou `|| []` — or `sbGet` rend `null` quand la base n'a pas répondu.
// Tous les compteurs tombaient donc à 0, et le panneau affichait :
//
//     « ✅ Rien d'urgent : tout est à jour. Beau boulot. »
//
// avec 14 colis à expédier et 6 à retirer. Pire : la route répondait
// `{ ok: true, ...r }` par-dessus, donc le panneau n'avait AUCUN moyen de faire
// la différence — des compteurs à zéro sont exactement ce qu'il voit quand tout
// va bien et qu'il n'y a vraiment rien à faire.
//
// C'est le mensonge du 10 septembre (§ « quand la base ne répond pas, l'app
// disait tout va bien ») refait à l'identique dans l'extension, et il a tourné
// pendant toute la panne.
//
// ⚠️ CE CONTRÔLE VÉRIFIE LES DEUX SENS, comme `panne.cjs` : aucun mensonge
//    quand la base est tombée, et AUCUNE FAUSSE ALERTE en marche normale. Une
//    fausse alerte est ce qui fait cesser de lire les vraies.
//
// ⚠️ ET IL NE LIT AUCUN LIBELLÉ POUR JUGER (§6.5) : il exécute le VRAI
//    `buildPanelData` dans un `vm` et regarde l'information qu'il REND. Un
//    contrôle posé sur la phrase « Rien d'urgent » serait vert le jour où
//    quelqu'un la reformule — c'est déjà arrivé trois fois dans ce projet.
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };

// `quiEchoue` : null = rien n'échoue · 'tout' = la base est tombée ·
// une chaîne = seules les lectures qui la contiennent échouent (le cas le plus
// sournois : la base debout, UNE lecture qui expire).
function faireCtx(quiEchoue) {
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
    btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
      storage: { local: { get: dual({}), set: dual(undefined), remove: dual(undefined) } },
    },
    fetch: async (url, opts = {}) => {
      const u = String(url);
      const rep = (body) => ({ ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
      if ((opts.method || 'GET') === 'POST') return { ok: true, status: 201, json: async () => ({}), text: async () => '', headers: { get: () => 'application/json' } };
      const doitEchouer = quiEchoue === 'tout' || (quiEchoue && u.includes(quiEchoue));
      // ⚠️ LA VRAIE FORME DE LA PANNE : Cloudflare rend du HTML avec un 522,
      //    pas un JSON d'erreur. Servir un JSON mesurerait une fiction.
      if (doitEchouer) return { ok: false, status: 522, json: async () => { throw new Error('HTML'); }, text: async () => '<html>522</html>', headers: { get: () => 'text/html' } };
      return rep('[]');
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'background.js' });
  return ctx;
}

(async () => {
  // ── 1. LA BASE EST TOMBÉE ───────────────────────────────────────────────────
  {
    const ctx = faireCtx('tout');
    let d = null, erreur = null;
    try { d = await ctx.buildPanelData(); } catch (e) { erreur = e && e.message; }
    dit(!erreur, 'panne totale : le panneau se construit quand même', erreur || 'aucune exception');
    if (d) {
      dit(d.baseKO === true, 'panne totale : la réponse PORTE l\'échec de lecture',
        d.baseKO === true
          ? `${d.lecturesRatees} lecture(s) ratée(s) signalée(s)`
          : 'rien ne distingue « rien à faire » de « je n\'ai rien pu lire » → le panneau fête « tout est à jour »');
      // Et la preuve que le défaut est bien celui-là : tous les compteurs sont
      // à zéro. C'est exactement ce que le panneau voit un jour tranquille.
      const st = d.stats || {};
      const zeros = !(st.toShip || st.toPickup || st.unread || st.toPrint);
      dit(zeros, 'panne totale : les compteurs sont bien à 0 (c\'est ça, le piège)',
        'un zéro indiscernable d\'une journée calme — seul `baseKO` les sépare');
    }
  }

  // ── 2. UNE SEULE LECTURE QUI EXPIRE, LA BASE DEBOUT ─────────────────────────
  // Le cas le plus sournois, et le plus fréquent : ni panne ni erreur visible.
  // Même famille que « lecture KO, écriture OK » pour `push_subs`.
  for (const cible of ['orders_sold', 'email_track_', 'id=eq.main']) {
    const ctx = faireCtx(cible);
    let d = null; try { d = await ctx.buildPanelData(); } catch (_) {}
    dit(!!d && d.baseKO === true, `une seule lecture qui expire (${cible}) : c'est dit`,
      (d && d.baseKO === true) ? '' : 'le panneau présente une liste incomplète comme complète');
  }

  // ── 3. ET AUCUNE FAUSSE ALERTE EN MARCHE NORMALE ────────────────────────────
  // Sans ce contrôle, « baseKO: true » en dur passerait le reste au vert.
  {
    const ctx = faireCtx(null);
    let d = null, erreur = null;
    try { d = await ctx.buildPanelData(); } catch (e) { erreur = e && e.message; }
    dit(!erreur && !!d, 'marche normale : le panneau se construit', erreur || '');
    if (d) dit(d.baseKO === false, 'marche normale : AUCUNE alerte de lecture',
      d.baseKO === false ? 'base vide mais joignable → rien à signaler'
        : 'une fausse alerte est ce qui fait cesser de lire les vraies');
  }

  // ── 4. LE PANNEAU DOIT S'EN SERVIR ──────────────────────────────────────────
  // L'information rendue ne vaut rien si l'affichage l'ignore : c'est exactement
  // ce qui s'est passé avec le panneau de sécurité (`Ligne` savait afficher
  // l'attente, l'appelant écrasait l'information).
  // ⚠️ La règle, pas l'orthographe : est fautive une carte qui RASSURE sans
  //    qu'un `baseKO` soit lu dans la même expression.
  {
    const pan = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'vinted-panel.js'), 'utf8')
      .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    dit(/DATA\s*&&\s*DATA\.baseKO/.test(pan), 'le panneau LIT `baseKO`',
      'le fond le signale, l\'affichage l\'ignore — défaut du panneau de sécurité');
    // Toute affirmation rassurante doit être gardée. On cherche les phrases qui
    // AFFIRMENT, et on exige `baseKO` dans leur voisinage immédiat.
    const lignes = pan.split('\n');
    const fautives = [];
    lignes.forEach((l, i) => {
      if (!/tout est à jour|Rien d'urgent|Tout est à jour/i.test(l)) return;
      const autour = lignes.slice(Math.max(0, i - 6), i + 3).join('\n');
      if (!/baseKO/.test(autour)) fautives.push(i + 1);
    });
    dit(fautives.length === 0, 'aucune phrase « tout est à jour » sans la garde',
      fautives.length ? 'ligne(s) ' + fautives.join(', ') + ' : rassure sans savoir' : '');
    // Et le repli de `load()` : « pas su » doit valoir « pas su », pas « rien ».
    // ⚠️ SEPTIÈME FOIS QU'UN DE MES CONTRÔLES CRIE AU LOUP : le premier jet
    //    exigeait `baseKO` dans l'expression du repli, et le repli vaut
    //    `VIDE()` — un helper qui le porte très bien. La règle est « la valeur
    //    de repli porte l'échec », pas « elle l'écrit sur place » : on suit donc
    //    l'expression jusqu'à sa définition quand c'est un appel.
    const repli = /lastError\)\s*\{\s*DATA\s*=\s*([^;]+);/.exec(pan);
    let porte = false, detail = 'repli introuvable';
    if (repli) {
      const expr = repli[1].trim();
      detail = 'il rend ' + expr.slice(0, 40);
      if (/baseKO/.test(expr)) porte = true;
      else {
        const nom = (/^([A-Za-z_$][\w$]*)\s*\(/.exec(expr) || [])[1];
        if (nom) {
          const def = new RegExp('(?:const|let|var|function)\\s+' + nom + '\\s*=?[^\\n]*\\n?[^\\n]*');
          const m = def.exec(pan);
          if (m && /baseKO/.test(m[0])) { porte = true; detail += ' → ' + nom + ' porte bien l\'échec'; }
        }
      }
    }
    dit(porte, 'le repli de chargement porte aussi l\'échec', detail);
  }

  console.log(ko
    ? `\n${ko} contrôle(s) non conforme(s).`
    : '\nLe panneau sur Vinted ne fête plus une lecture qui a échoué.');
  process.exit(ko ? 1 : 0);
})();
