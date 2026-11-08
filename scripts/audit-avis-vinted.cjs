// ════════════════════════════════════════════════════════════════════════════
//  LES AVIS VINTED REÇUS, LUS PAR L'EXTENSION (4 nov., 5.319) — lecture seule
//
//  L'app sait lire les avis (`lireAvis`, src/notesRecues.js : `rating` entier
//  1…5, `created_at`/`created_at_ts`). L'extension lit la PREMIÈRE page de
//  `/api/v2/user_feedbacks?user_id=…&page=1&per_page=20&by=all` et la range
//  dans `harvest_{uid}_feedbacks` (`payload.user_feedbacks[]`). La FORME de la
//  réponse n'a jamais été mesurée : l'audit la tolère et exige qu'une forme
//  inconnue n'écrive rien. VRAI background.js dans `_fond-vm.cjs`, réponses
//  FABRIQUÉES (le dépôt est public).
//   A1  le compte connecté seulement ; une autre session ⇒ aucune requête.
//   A2  budget de LECTURE (`vrmLectures`), jamais celui des actions ; plein ⇒ rien.
//   A3  une fois par 24 h et par compte.
//   A4  rangé : id, note, date, texte ; JAMAIS la personne (nom, photo, id).
//   A5  forme inconnue / refus ⇒ RIEN écrit (une ancienne ligne reste).
//   A6  une pause Vinted (429/403) ⇒ aucune requête.
//   A7  `capterAvis` est appelé par la visite ; `EXT_CAPACITES.avis` existe.
//  `--src` : une autre copie de background.js (preuve sur le code d'avant).
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();
const APP = path.join(__dirname, '..', 'src', 'App.jsx');
let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + det}`); };
const UID = '111', PID = 9001;
const PERSO = ['Jeanne Mouette', 'avatar-jeanne', 'jeanne_m', '424242'];
const AVIS = { user_feedbacks: [
  { id: 1, rating: 5, feedback: 'Parfait, merci !', created_at: '2026-11-02T10:00:00+01:00', created_at_ts: 1793610000, user: { id: 424242, login: 'jeanne_m', real_name: 'Jeanne Mouette', photo: { url: 'https://x/avatar-jeanne.jpg' } }, feedback_rate: 5 },
  { id: 2, rating: 3, feedback: 'Un peu long', created_at: '2026-10-20T10:00:00+01:00', user: { id: 424242, login: 'jeanne_m' } },
], pagination: { current_page: 1, total_pages: 3, total_entries: 47, per_page: 20 } };
const lignes = () => ({ [`harvest_${UID}_profile`]: { payload: { user: { id: PID } } } });
const vintedOk = (body) => (r) => (/\/api\/v2\/user_feedbacks\?/.test(r.chemin) ? { status: 200, body } : { status: 404, body: {} });
const req = (j) => j.vinted.filter((x) => /user_feedbacks/.test(x.chemin));

(async () => {
  try {
    const f = faireFond({ src: SRC, lignes: lignes(), vinted: vintedOk(AVIS) });
    if (typeof f.ctx.capterAvis !== 'function') { dit(false, 'A0 · `capterAvis` existe dans le fond'); throw new Error('absent'); }
    await f.ctx.capterAvis(UID);
    const r = req(f.j);
    dit(r.length === 1 && /user_id=9001&page=1&per_page=20&by=all$/.test(r[0].chemin) && r[0].methode === 'GET', 'A1 · UNE lecture GET de la première page, sur l’identifiant de PROFIL', JSON.stringify(r.map((x) => x.chemin)));
    const l = f.lignes[`harvest_${UID}_feedbacks`];
    const fb = l && l.payload && l.payload.user_feedbacks;
    dit(Array.isArray(fb) && fb.length === 2 && fb[0].rating === 5 && fb[0].created_at === '2026-11-02T10:00:00+01:00' && fb[0].feedback === 'Parfait, merci !' && fb[1].rating === 3, 'A4 · rangé dans `harvest_{uid}_feedbacks` (`payload.user_feedbacks[]`) : note, date, texte', JSON.stringify(fb));
    dit(l && l.uid === UID && !!l.capturedAt && l.nItems === 2, 'A4 · la ligne dit son compte et sa date de lecture', JSON.stringify(l && { uid: l.uid, n: l.nItems }));
    const s = JSON.stringify(l || {});
    dit(!PERSO.some((x) => s.includes(x)), 'A4 · la personne ne sort JAMAIS (nom, pseudo, photo, identifiant)', PERSO.filter((x) => s.includes(x)).join(','));
    const lec = ((f.store.vrmLectures || {})[UID] || []).length, act = ((f.store.vrmActions || {})[UID] || []).length;
    dit(lec === 1 && act === 0, 'A2 · compté sur le budget de LECTURE, jamais sur les actions', `lectures ${lec}, actions ${act}`);
    await f.ctx.capterAvis(UID);
    dit(req(f.j).length === 1, 'A3 · une seconde visite dans les 24 h ne relit pas', String(req(f.j).length));

    const g = faireFond({ src: SRC, lignes: lignes(), vinted: vintedOk(AVIS), connecte: '222' });
    await g.ctx.capterAvis(UID);
    dit(req(g.j).length === 0 && !g.lignes[`harvest_${UID}_feedbacks`], 'A1 · navigateur connecté à un AUTRE compte ⇒ aucune requête, rien écrit', String(req(g.j).length));

    const t = Date.now();
    const h = faireFond({ src: SRC, lignes: lignes(), vinted: vintedOk(AVIS), store: { vrmLectures: { [UID]: Array.from({ length: 20 }, () => t) } } });
    await h.ctx.capterAvis(UID);
    dit(req(h.j).length === 0, 'A2 · budget de lecture plein (20/h) ⇒ aucune requête', String(req(h.j).length));

    const avant = { type: 'feedbacks', uid: UID, capturedAt: '2026-10-01T00:00:00Z', payload: { user_feedbacks: [{ id: '9', rating: 4, created_at: '2026-09-01T00:00:00Z' }] } };
    for (const [nom, body, status] of [['forme inconnue', { feedbacks: [{ rating: 5 }] }, 200], ['tableau nu', [{ rating: 5 }], 200], ['refus 500', { message: 'x' }, 500]]) {
      const k = faireFond({ src: SRC, lignes: Object.assign(lignes(), { [`harvest_${UID}_feedbacks`]: JSON.parse(JSON.stringify(avant)) }), vinted: (r) => (/user_feedbacks/.test(r.chemin) ? { status, body } : { status: 404, body: {} }) });
      await k.ctx.capterAvis(UID);
      dit(JSON.stringify(k.lignes[`harvest_${UID}_feedbacks`]) === JSON.stringify(avant), `A5 · ${nom} ⇒ RIEN écrit, l’ancienne lecture reste`, JSON.stringify(k.lignes[`harvest_${UID}_feedbacks`]).slice(0, 160));
    }
    const vide = faireFond({ src: SRC, lignes: lignes(), vinted: vintedOk({ user_feedbacks: [], pagination: { total_entries: 0 } }) });
    await vide.ctx.capterAvis(UID);
    const lv = vide.lignes[`harvest_${UID}_feedbacks`];
    dit(lv && Array.isArray(lv.payload.user_feedbacks) && lv.payload.user_feedbacks.length === 0, 'A5 · `user_feedbacks: []` (forme connue) est une vraie lecture : aucun avis', JSON.stringify(lv && lv.payload));

    const p = faireFond({ src: SRC, lignes: lignes(), vinted: vintedOk(AVIS), store: { vrmPauseVinted: { jusqua: Date.now() + 3600e3, statut: 429, depuis: Date.now() } } });
    await p.ctx.capterAvis(UID);
    dit(req(p.j).length === 0, 'A6 · pause Vinted posée (429) ⇒ aucune requête', String(req(p.j).length));

    const bg = fs.readFileSync(SRC, 'utf8');
    const visite = bg.indexOf('await capterSuivisAchats(uid);');
    dit(visite > 0 && /await capterAvis\(uid\);/.test(bg.slice(visite, visite + 400)), 'A7 · la visite sur Vinted appelle `capterAvis` (après l’argent et les colis)');
    const app = fs.readFileSync(APP, 'utf8');
    const cap = /const EXT_CAPACITES\s*=\s*\{([^}]*)\}/.exec(app);
    dit(!!cap && /\bavis:\s*'5\.319\.0'/.test(cap[1]), 'A7 · `EXT_CAPACITES.avis` = 5.319.0');
    dit(!/rappel[^\n]{0,40}(évaluation|avis)/i.test(bg.slice(bg.indexOf('function capterAvis'), bg.indexOf('function capterAvis') + 4000).replace(/\/\/[^\n]*/g, '')), 'A7 · aucun rappel d’évaluation');
  } catch (e) { dit(false, 'l’audit a tourné jusqu’au bout', String((e && e.stack) || e).slice(0, 300)); }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ avis Vinted : tout est vert');
  process.exit(ko ? 1 : 0);
})();
