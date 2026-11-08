// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — RETRAITS : LE SUIVI LU PAR VRM, ET CE QU'IL EN DIT (8 nov.)
//  Julien (8 nov.) : « Améliore ça pour les colis pour le retrait parce que je vois
//  qu'il y a encore des erreurs, l'application doit pouvoir lire les informations
//  de suivi afin de pouvoir enlever si nécessaire. »
//  EXÉCUTE les vraies règles (copiées dans un dossier temporaire, pour les mutations)
//  sur des cas INVENTÉS de la vraie forme (docs/passation/2026-11-08-retraits-suivi.md) :
//   A. api/_lib/transporteurs.js `suivisAInterroger` — un e-mail rangé sous un
//      transporteur par défaut (`vinted`, `autre`) à n° de forme propre est lu ; un
//      transporteur NOMMÉ non lu ne l'est jamais ; la ligne abandonnée d'un AUTRE
//      transporteur ne ferme pas le n° ; une dernière lecture après la fenêtre de 30 j ;
//   B. `indexTranspParSuivi` — deux lignes pour un n° : la lue, quel que soit l'ordre ;
//   C. api/_lib/suivi-colis.js `rappelsRetraitDuJour` — un « retiré » sur l'une des
//      deux lignes coupe le rappel du matin ;
//   D. src/retraitSuivi.js — la phrase d'une sortie et le pourquoi d'un « pas lu » ;
//   (le widget et un n° de ses bordereaux : exécuté par audit-statut-transporteurs §8.)
//  `--prouve` : chaque règle affaiblie (copie mutée) doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// Une copie de api/_lib et de src/retraitSuivi.js, une mutation éventuelle appliquée.
function copie(mutation) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-retraits-suivi-'));
  fs.mkdirSync(path.join(dir, 'api', '_lib'), { recursive: true }); fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  for (const f of fs.readdirSync(path.join(RACINE, 'api', '_lib'))) if (f.endsWith('.js')) fs.copyFileSync(path.join(RACINE, 'api', '_lib', f), path.join(dir, 'api', '_lib', f));
  fs.copyFileSync(path.join(RACINE, 'src', 'retraitSuivi.js'), path.join(dir, 'src', 'retraitSuivi.js'));
  const textes = { widget: fs.readFileSync(path.join(RACINE, 'api', 'widget.js'), 'utf8'), app: fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8') };
  if (mutation) {
    const f = path.join(dir, mutation.fichier);
    if (mutation.fichier === 'widget') textes.widget = remplace(textes.widget, mutation);
    else if (mutation.fichier === 'app') textes.app = remplace(textes.app, mutation);
    else fs.writeFileSync(f, remplace(fs.readFileSync(f, 'utf8'), mutation));
  }
  return { dir, textes };
}
function remplace(s, m) { if (!s.includes(m.de)) throw new Error(`mutation « ${m.nom} » : motif absent`); return s.split(m.de).join(m.vers); }

async function controles({ dir, textes }, dit) {
  const imp = (r) => import(pathToFileURL(path.join(dir, r)).href + '?v=' + Math.random());
  let T, S, R;
  try { T = await imp('api/_lib/transporteurs.js'); S = await imp('api/_lib/suivi-colis.js'); R = await imp('src/retraitSuivi.js'); }
  catch (e) { dit(false, 'les modules se chargent', String(e.message || e).slice(0, 200)); return; }
  const maintenant = Date.parse('2026-11-06T09:00:00Z');
  const Z = (s) => `2026-${s}:00.000Z`;
  const J = JSON.stringify;
  const ligne = (carrier, suivi, o) => ({ id: `email_track_${carrier}_${suivi}`, carrier, suivi, status: 'available', subject: `Votre colis ${suivi} est disponible`, lieu: 'MAISON TEST, 40 RUE DU PORT, 35260 CANCALE', emailAt: Z('11-05T09:00'), receivedAt: Z('11-05T09:01'), arriveLe: Z('11-05T09:00'), ...o });
  const lit = (o) => T.suivisAInterroger({ maintenant, max: 50, parTransporteur: 50, ...o });
  const a = (items, k) => items.find((x) => x.suivi === k);

  // ── A. Quels n° le serveur interroge ──────────────────────────────────────
  { const r = a(lit({ lignes: [ligne('vinted', '83000001')] }), '83000001');
    dit(!!r && r.carrier === 'mondialrelay' && r.cp === '35260', 'A1 e-mail rangé « vinted » (expéditeur par défaut) à n° de 8 chiffres ⇒ lu chez Mondial Relay, code postal de l’e-mail', J(r)); }
  { const r = a(lit({ lignes: [ligne('autre', 'XW300000002TS')] }), 'XW300000002TS');
    dit(!!r && r.carrier === 'chronopost', 'A2 e-mail « autre » à n° Chronopost propre (XW…TS) ⇒ lu chez Chronopost', J(r)); }
  { const r = a(lit({ lignes: [ligne('colissimo', '83000003'), ligne('dpd', 'XW300000003TS')] }), '83000003') || a(lit({ lignes: [ligne('dpd', 'XW300000003TS')] }), 'XW300000003TS');
    dit(!r, 'A3 un transporteur NOMMÉ que VRM ne lit pas (Colissimo, DPD) ne se remplace jamais par la forme du n°', J(r)); }
  { const vieux = { suivi: 'XW300000004TS', carrier: 'vinted', essaiRes: 'introuvable', essais: 3, fini: true, essai: Z('10-20T10:00') };
    const r = a(lit({ lignes: [ligne('chronopost', 'XW300000004TS')], transp: new Map([['XW300000004TS', vieux]]) }), 'XW300000004TS');
    dit(!!r && r.carrier === 'chronopost', 'A4 la ligne abandonnée d’un AUTRE transporteur (Vinted Go, introuvable ×3) ne ferme pas le n° chez Chronopost', J(r));
    const memes = { ...vieux, carrier: 'chronopost' };
    const r2 = a(lit({ lignes: [ligne('chronopost', 'XW300000004TS')], transp: new Map([['XW300000004TS', memes]]) }), 'XW300000004TS');
    dit(!r2, 'A4b …mais SA propre ligne abandonnée (Chronopost, introuvable ×3) le ferme toujours', J(r2)); }
  { const vieil = { emailAt: Z('09-20T09:00'), receivedAt: Z('09-20T09:01'), arriveLe: Z('09-20T09:00') };
    const t = (lu, etat = 'disponible', fini = false) => ({ suivi: '83000005', carrier: 'mondialrelay', etat, etatAt: Z('09-20T08:00'), lu, essai: lu, essaiRes: 'ok', essais: 0, cp: '35260', fini });
    const r = a(lit({ lignes: [ligne('mondialrelay', '83000005', vieil)], transp: new Map([['83000005', t(Z('09-28T10:00'))]]) }), '83000005');
    dit(!!r && r.raison === 'fermeture', 'A5 lu « disponible » pendant sa fenêtre, plus rien depuis 30 j ⇒ UNE dernière lecture (fermeture)', J(r));
    const r2 = a(lit({ lignes: [ligne('mondialrelay', '83000005', vieil)], transp: new Map([['83000005', t(Z('11-01T10:00'))]]) }), '83000005');
    dit(!r2, 'A5b déjà relu après la fin de sa fenêtre ⇒ plus rien (une seule fois)', J(r2));
    const r3 = a(lit({ lignes: [ligne('mondialrelay', '83000005', vieil)], transp: new Map([['83000005', t(Z('09-28T10:00'), 'retire', true)]]) }), '83000005');
    dit(!r3, 'A6 lu « retiré » (fini) ⇒ jamais relu', J(r3)); }
  { const r = a(lit({ lignes: [ligne('vinted', '83000007', { sens: 'sortant' })] }), '83000007');
    dit(!r, 'A7 jamais un n° sortant, même lisible par la forme', J(r)); }

  // ── B. Deux lignes pour un n° ─────────────────────────────────────────────
  { const v = { suivi: 'XW300000010TS', carrier: 'vinted', essaiRes: 'passu', essais: 4, essai: Z('11-06T08:30') };
    const c = { suivi: 'XW300000010TS', carrier: 'chronopost', etat: 'retire', etatAt: Z('11-05T10:00'), lu: Z('11-06T08:20'), essai: Z('11-06T08:20'), essaiRes: 'ok' };
    const m1 = T.indexTranspParSuivi([v, c]).get('XW300000010TS'), m2 = T.indexTranspParSuivi([c, v]).get('XW300000010TS');
    dit(m1 === c && m2 === c, 'B1 deux lignes pour un n° ⇒ la LUE, quel que soit l’ordre de la base', J([m1 && m1.carrier, m2 && m2.carrier]));
    const c2 = { ...c, carrier: 'mondialrelay', lu: Z('11-06T08:50') };
    dit(T.indexTranspParSuivi([c, c2]).get('XW300000010TS') === c2 && T.indexTranspParSuivi([c2, c]).get('XW300000010TS') === c2, 'B2 deux lectures ⇒ la plus RÉCENTE', ''); }

  // ── C. Le rappel du matin ─────────────────────────────────────────────────
  { const l = ligne('chronopost', 'XW300000011TS', { limite: '2026-11-06' });
    const lignes = [{ ...l, s: 'available' }];
    const retire = { suivi: 'XW300000011TS', carrier: 'chronopost', etat: 'retire', etatAt: Z('11-05T16:00'), lu: Z('11-05T17:00'), essai: Z('11-05T17:00'), essaiRes: 'ok', fini: true };
    const dispo = { suivi: 'XW300000011TS', carrier: 'vinted', etat: 'disponible', etatAt: Z('11-04T10:00'), lu: Z('11-04T11:00'), essai: Z('11-04T11:00'), essaiRes: 'ok' };
    const r1 = S.rappelsRetraitDuJour({ lignes, transp: [retire, dispo], maintenant, aujourdhui: '2026-11-06' });
    const r2 = S.rappelsRetraitDuJour({ lignes, transp: [dispo, retire], maintenant, aujourdhui: '2026-11-06' });
    const r0 = S.rappelsRetraitDuJour({ lignes, transp: [], maintenant, aujourdhui: '2026-11-06' });
    dit(r0.length === 1 && !r1.length && !r2.length, 'C1 « dernier jour » coupé dès qu’UNE des lignes du transporteur dit « retiré » (quel que soit l’ordre)', J({ sans: r0.length, a: r1.length, b: r2.length })); }

  // ── D. Les phrases ────────────────────────────────────────────────────────
  { const tpm = new Map([['83000020', { suivi: '83000020', carrier: 'mondialrelay', etat: 'retire', etatAt: Z('11-05T15:00'), lu: Z('11-05T16:00') }]]);
    const f = R.finDatee(['83000020'], { tpm });
    dit(R.texteSortie(f) === 'Mondial Relay : retiré le 5 nov.', 'D1 « Mondial Relay : retiré le 5 nov. » (la lecture du transporteur, sa date, heure de Paris)', R.texteSortie(f));
    const fe = R.finDatee(['83000021'], { lignes: [ligne('chronopost', '83000021', { status: 'delivered', retireLe: Z('11-05T22:30') })] });
    dit(R.texteSortie(fe) === 'E-mail de Chronopost : retiré le 5 nov.', 'D2 une fin lue dans l’e-mail se dit comme telle (son jour à Paris)', R.texteSortie(fe));
    const fr = R.finDatee(['83000022'], { tpm: new Map([['83000022', { suivi: '83000022', carrier: 'vinted', etat: 'retour_expediteur', etatAt: Z('11-04T10:00'), lu: Z('11-04T11:00') }]]), lignes: [ligne('vinted', '83000022', { status: 'delivered', retireLe: Z('11-03T10:00') })] });
    dit(fr && fr.etat === 'retire' && fr.source === 'email', 'D3 un « retiré » gagne toujours sur un « retour » (la règle des fins)', J(fr));
    dit(R.sortiRecent(f, { maintenant }) && !R.sortiRecent({ ...f, at: Date.parse(Z('10-30T10:00')) }, { maintenant }), 'D4 dit 3 jours, plus après', '');
    const pl = (o) => (R.pourquoiPasLu(o) || {}).code || null;
    dit(pl({ suivi: '83000030', carrier: 'vinted' }) === 'jamais' && /Mondial Relay/.test(R.pourquoiPasLu({ suivi: '83000030', carrier: 'vinted' }).texte), 'D5 n° de 8 chiffres sous « vinted » ⇒ « Mondial Relay : pas encore lu »', J(R.pourquoiPasLu({ suivi: '83000030', carrier: 'vinted' })));
    dit(pl({ suivi: '6A30000000031', carrier: 'colissimo' }) === 'non-lu' && pl({ suivi: 'CP300000032IE', carrier: '' }) === 'international' && pl({ suivi: '', carrier: 'mondialrelay' }) === 'sans-numero', 'D6 Colissimo ⇒ non lu · S10 irlandais ⇒ international · sans n° ⇒ dit', '');
    dit(pl({ suivi: 'XW300000033TS', carrier: 'chronopost', t: { carrier: 'chronopost', essaiRes: 'introuvable', essais: 3, fini: true } }) === 'abandonne'
      && pl({ suivi: 'XW300000033TS', carrier: 'chronopost', t: { carrier: 'chronopost', etat: 'disponible', lu: Z('11-05T10:00') } }) === null
      && pl({ suivi: 'XW300000033TS', carrier: 'chronopost', t: { carrier: 'chronopost', essaiRes: 'passu', essais: 1 } }) === null, 'D7 abandonné ⇒ dit ; lu ou en cours ⇒ rien (la ligne du transporteur le dit)', ''); }

}

const MUTATIONS = [
  { nom: 'transporteur par défaut jamais remplacé par la forme', fichier: 'api/_lib/transporteurs.js', de: "if (!CARRIER_PAR_DEFAUT.test(String(carrier || '').trim().toLowerCase())) return null;", vers: 'return null;' },
  { nom: 'transporteur nommé remplacé par la forme', fichier: 'api/_lib/transporteurs.js', de: "if (!CARRIER_PAR_DEFAUT.test(String(carrier || '').trim().toLowerCase())) return null;", vers: '' },
  { nom: 'la ligne abandonnée d’un autre transporteur ferme le n°', fichier: 'api/_lib/transporteurs.js', de: 'if (t && t.carrier && t.carrier !== e.carrier && t.fini && !t.lu && !t.etat) t = null;', vers: '' },
  { nom: 'aucune lecture après la fenêtre', fichier: 'api/_lib/transporteurs.js', de: 'return lu != null && lu < finFenetre;', vers: 'return false;' },
  { nom: 'relu sans fin après la fenêtre', fichier: 'api/_lib/transporteurs.js', de: 'return lu != null && lu < finFenetre;', vers: 'return true;' },
  { nom: 'la première ligne gagne', fichier: 'api/_lib/transporteurs.js', de: '  if (!b) return a;\n  const luA', vers: '  return a;\n  const luA' },
  { nom: 'rappel : fins sur la seule ligne préférée', fichier: 'api/_lib/suivi-colis.js', de: 'transp: Array.isArray(transp) ? transp : [...tMap.values()] });', vers: "transp: [...new Map((Array.isArray(transp) ? transp : []).map((t) => [t.suivi, t])).values()] });" },
  { nom: 'sortie sans sa date', fichier: 'src/retraitSuivi.js', de: "const date = jour ? (f.etat === 'retour' ? ` depuis le ${jour}` : ` le ${jour}`) : '';", vers: "const date = '';" },
  { nom: 'un retour gagne sur un retiré', fichier: 'src/retraitSuivi.js', de: "rang: f === 'delivered' ? 1 : 3 });", vers: "rang: f === 'delivered' ? 9 : 3 });" },
  { nom: 'pas lu : Colissimo passé sous silence', fichier: 'src/retraitSuivi.js', de: "if (nl) return { code: 'non-lu'", vers: "if (false) return { code: 'non-lu'" },
];

(async () => {
  const prouve = process.argv.includes('--prouve');
  let rouges = 0;
  const lignes = [];
  await controles(copie(null), (c, m, d) => { if (!c) rouges++; lignes.push((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + d : '')); });
  for (const l of lignes) console.log(l);
  console.log(rouges ? `\n❌ ${rouges} rouge(s)` : `\n✅ Les retraits suivent le suivi lu : lu quand c'est possible, dit quand ça ne l'est pas, jamais un colis qu'il envoie.`);
  if (!prouve) process.exit(rouges ? 1 : 0);
  if (rouges) { console.log('--prouve : l’audit doit d’abord être vert.'); process.exit(1); }
  let tenues = 0;
  for (const m of MUTATIONS) {
    let r = 0; let erreur = '';
    try { await controles(copie(m), (c) => { if (!c) r++; }); } catch (e) { erreur = String(e.message || e); }
    const ok = r > 0 && !erreur;
    if (ok) tenues++;
    console.log(`${ok ? '✅' : '❌'} mutation « ${m.nom} » ⇒ ${erreur ? 'ERREUR ' + erreur : r + ' rouge(s)'}`);
  }
  console.log(`\n${tenues}/${MUTATIONS.length} mutations rendent l’audit rouge.`);
  process.exit(tenues === MUTATIONS.length ? 0 : 1);
})();
