// ════════════════════════════════════════════════════════════════════════════
//  « ACTIF OU BANNI » — L'EXTENSION ÉVALUE L'ÉTAT DU COMPTE (5.181).
//
//  Julien (16 oct.) : « Ne mets pas tester la connexion, l'extension doit être
//  capable d'évaluer l'état du compte ; il doit juste y avoir s'il est actif ou
//  banni. »
//
//  MESURÉ le 16 octobre sur sa base (lecture seule, noms de champs et booléens) :
//  le profil `/api/v2/users/current` que l'extension range DÉJÀ
//  (`harvest_{uid}_profile`) porte `is_account_banned` et `account_status`. Les
//  trois comptes bloqués connus (dont `vanessa5723`) valent `true` / 8, les sept
//  vivants `false` / 0 — et Vinted RÉPOND `/users/current` à un compte banni.
//  ⇒ aucune requête de plus (§3) : `noterEtatCompte` lit cette réponse-là.
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`) et on juge ce qui est
//  écrit dans `panel_comptes_etat` :
//   1. profil `is_account_banned: true` (moisson active) ⇒ « banni » publié ;
//   2. profil `false` ⇒ « actif » ;
//   3. `/users/current` → 429 (frein) ⇒ JAMAIS « banni » ;
//   4. → 401 (session expirée) ⇒ JAMAIS « banni » ;
//   5. → 403 ⇒ JAMAIS « banni » (un 403 est aussi un frein, §5.162) ;
//   6. capture PASSIVE du même profil ⇒ « banni » ;
//   7. lecture de la ligne ratée (lecture KO, écriture OK) ⇒ rien n'est écrit ;
//   8. profil sans le champ ⇒ « passu », et il n'efface pas un verdict lu ;
//   9. aucune requête Vinted de plus qu'une moisson sans ce code.
//  Données inventées. Aucune requête réseau.
//  Usage : node scripts/audit-etat-compte.cjs [--src f] [--mutation nom]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), os = require('os'), path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

const MUTATIONS = {
  // le doute (pas de profil lisible : 429, 401, 403) compterait comme « banni »
  doutebanni: [[`  if (!u) return { etat: 'passu', preuve: 'profil illisible' };`, `  if (!u) return { etat: 'banni', preuve: 'profil illisible' };`]],
  // une lecture ratée de la ligne repartirait d'un objet vide
  lecture: [[`      if (rows === null) { noterDiag('etat_compte_lecture_ratee'); return false; }   // pas su : on n'écrit rien (§5)`, ``]],
  // le moindre champ « vrai » ferait « banni » (ressemblance au lieu du champ explicite)
  champ: [[`  if (u.is_account_banned === true) return`, `  if (u.is_account_banned === true || u.account_status) return`]],
};
function sourceAJuger() {
  const src = cheminSource();
  const i = process.argv.indexOf('--mutation');
  if (i < 0) return { src, mutation: '' };
  const nom = process.argv[i + 1];
  const regles = MUTATIONS[nom];
  if (!regles) { console.log(`mutation inconnue : ${nom} (${Object.keys(MUTATIONS).join(', ')})`); process.exit(2); }
  let s = fs.readFileSync(src, 'utf8');
  for (const [de, vers] of regles) {
    const n = s.split(de).length - 1;
    if (n !== 1) { console.log(`❌ mutation ${nom} : ancre trouvée ${n} fois — mets la mutation à jour`); process.exit(1); }
    s = s.replace(de, vers);
  }
  const f = path.join(os.tmpdir(), `vrm-mut-etat-${nom}-${process.pid}.js`);
  fs.writeFileSync(f, s);
  return { src: f, mutation: nom };
}
const { src: SRC, mutation } = sourceAJuger();
console.log(`source : ${path.relative(process.cwd(), SRC) || SRC}${mutation ? ` (mutation « ${mutation} »)` : ''}`);

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); return null; } };

const UID = '111';
const ROW = 'panel_comptes_etat';
// Un Vinted dont `/users/current` répond ce qu'on veut ; le reste est vide.
function monter({ profil, lignes = {}, lectureLigneKO = false }) {
  const f = faireFond({
    src: SRC, lignes, connecte: UID,
    lectureKO: (u) => lectureLigneKO && u.includes(`id=eq.${ROW}`),
    vinted: (r) => {
      if (/\/api\/v2\/users\/current/.test(r.chemin)) return profil;
      if (/\/wardrobe\//.test(r.chemin)) return { status: 200, body: { items: [], pagination: { total_entries: 0, total_pages: 0 } } };
      if (/\/my_orders/.test(r.chemin)) return { status: 200, body: { my_orders: [], pagination: { total_entries: 0, total_pages: 0 } } };
      if (/\/inbox/.test(r.chemin)) return { status: 200, body: { conversations: [] } };
      return { status: 404, body: {} };
    },
  });
  return f;
}
const etatDe = (f, uid = UID) => { const d = f.lignes[ROW]; return d && d.comptes && d.comptes[uid] ? d.comptes[uid].etat : undefined; };
const attendre = () => new Promise((r) => setTimeout(r, 30));
const profil = (banni) => ({ status: 200, body: { user: { id: 9001, login: 'compte_banc', is_account_banned: banni, account_status: banni ? 8 : 0 } } });

(async () => {
  console.log('\n── 1. Profil explicitement banni (moisson active)');
  await essaie('banni', async () => {
    const f = monter({ profil: profil(true) });
    await f.ctx.runActive(); await attendre();
    dit(etatDe(f) === 'banni', '« banni » est publié pour ce compte', `état=${etatDe(f)}`);
    const p = f.lignes[ROW] && f.lignes[ROW].comptes && f.lignes[ROW].comptes[UID];
    dit(!!(p && /is_account_banned/.test(p.preuve || '') && p.at), 'avec sa preuve (le champ du profil) et sa date', JSON.stringify(p || null));
  });

  console.log('\n── 2. Profil sain');
  await essaie('actif', async () => {
    const f = monter({ profil: profil(false) });
    await f.ctx.runActive(); await attendre();
    dit(etatDe(f) === 'actif', '« actif » est publié', `état=${etatDe(f)}`);
    // Seul le champ EXPLICITE juge : un `account_status` d'une valeur jamais vue
    // n'est pas une preuve de bannissement (on ne devine pas son code).
    const g = monter({ profil: { status: 200, body: { user: { id: 9001, login: 'compte_banc', is_account_banned: false, account_status: 3 } } } });
    await g.ctx.runActive(); await attendre();
    dit(etatDe(g) === 'actif', 'un `account_status` inconnu ne fait pas « banni »', `état=${etatDe(g)}`);
  });

  for (const [n, st, nom] of [[3, 429, 'frein (429)'], [4, 401, 'session expirée (401)'], [5, 403, 'refus (403)']]) {
    console.log(`\n── ${n}. /users/current → ${nom}`);
    await essaie(nom, async () => {
      const f = monter({ profil: { status: st, body: { message: 'x' } } });
      await f.ctx.runActive(); await attendre();
      dit(etatDe(f) !== 'banni', `${nom} ne fait JAMAIS « banni »`, `état=${etatDe(f)}`);
      // L'autre sens : la passive aussi, sur une réponse d'erreur (pas de `user`).
      await f.ctx.storeHarvest('www.vinted.fr', 'profile', null, JSON.stringify({ message: 'x', code: st }));
      await attendre();
      dit(etatDe(f) !== 'banni', `${nom} capté en passant : toujours pas « banni »`, `état=${etatDe(f)}`);
    });
  }

  console.log('\n── 6. Capture PASSIVE du profil (la page charge /users/current)');
  await essaie('passive', async () => {
    const f = monter({ profil: { status: 404, body: {} } });
    await f.ctx.storeHarvest('www.vinted.fr', 'profile', null, JSON.stringify(profil(true).body));
    await attendre();
    dit(etatDe(f) === 'banni', '« banni » est publié depuis la capture passive', `état=${etatDe(f)}`);
  });

  console.log('\n── 7. Lecture de la ligne ratée (lecture KO, écriture OK)');
  await essaie('lecture ko', async () => {
    const avant = { comptes: { '222': { etat: 'banni', at: new Date().toISOString(), preuve: 'champ profil is_account_banned' } } };
    const f = monter({ profil: profil(false), lignes: { [ROW]: JSON.parse(JSON.stringify(avant)) }, lectureLigneKO: true });
    await f.ctx.runActive(); await attendre();
    const ecrit = f.j.posts.some((ids) => ids.includes(ROW));
    dit(!ecrit, 'rien n\'est écrit dans la ligne', ecrit ? 'une écriture est partie' : '');
    dit(etatDe(f, '222') === 'banni', 'le « banni » de l\'autre compte reste', `état 222=${etatDe(f, '222')}`);
  });

  console.log('\n── 8. Profil sans le champ ⇒ « passu », jamais par-dessus un verdict lu');
  await essaie('passu', async () => {
    const f = monter({ profil: { status: 200, body: { user: { id: 9001, login: 'compte_banc' } } } });
    await f.ctx.runActive(); await attendre();
    dit(etatDe(f) === 'passu', 'sans le champ : « passu »', `état=${etatDe(f)}`);
    const avant = { comptes: { [UID]: { etat: 'banni', at: new Date(Date.now() - 3 * 3600e3).toISOString(), preuve: 'champ profil is_account_banned' } } };
    const g = monter({ profil: { status: 200, body: { user: { id: 9001, login: 'compte_banc' } } }, lignes: { [ROW]: avant } });
    await g.ctx.runActive(); await attendre();
    dit(etatDe(g) === 'banni', 'un profil sans le champ n\'efface pas le « banni » lu', `état=${etatDe(g)}`);
  });

  console.log('\n── 9. Aucune requête Vinted de plus');
  await essaie('requetes', async () => {
    const f = monter({ profil: profil(true) });
    await f.ctx.runActive(); await attendre();
    const n = f.j.vinted.filter((r) => /\/users\/current/.test(r.chemin)).length;
    dit(n === 1, '/users/current lu UNE fois (celle de la moisson)', `n=${n}`);
    const autres = f.j.vinted.filter((r) => /ban|status|account/i.test(r.chemin) && !/\/users\/current/.test(r.chemin));
    dit(!autres.length, 'aucun chemin « état du compte » inventé', autres.map((r) => r.chemin).join(', '));
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
