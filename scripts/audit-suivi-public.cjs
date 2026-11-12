#!/usr/bin/env node
// LES TRANSPORTEURS SANS VOIE (12 nov.) — api/_lib/suivi-public.js : chaque transporteur non lu a sa voie SERVEUR,
// sa clé (ou son absence) et son geste écrits ; la règle qui tranche l'état depuis les événements lus (données
// INVENTÉES, phrases des transporteurs déjà mesurées sur leurs e-mails), et sa ligne entre dans la règle commune
// (`fusionTransporteur` : le transporteur tranche). `--mutations` : chaque garde réaffaiblie ⇒ rouge.
const path = require('path'), fs = require('fs'), os = require('os');
const R = path.join(__dirname, '..');
async function suite(lib, quiet) {
  let ko = 0;
  const ok = (c, m, d) => { if (!c) ko++; if (!quiet || !c) console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
  const { etatDepuisEvenements: E, VOIES_A_OUVRIR: V } = lib;
  for (const k of ['colissimo', 'dpd', 'ups', 'gls', 'relaiscolis', 'shop2shop']) ok(V && V[k] && /^https:\/\//.test(V[k].page) && V[k].cle && V[k].voie && V[k].geste && !/extension/i.test(V[k].voie), `V ${k} : voie serveur, clé et geste écrits (jamais l’extension)`);
  const ev = (...l) => l.map(([d, t]) => ({ date: `2026-11-${d}T10:00:00Z`, texte: t }));
  ok(E({ carrier: 'colissimo', suivi: '6A 12345678901', evenements: ev(['10', 'Votre colis est pris en charge'], ['11', 'Votre colis a été livré']) }).etat === 'retire', 'A1 le plus récent « livré » ⇒ retiré (n° normalisé)');
  ok(E({ evenements: ev(['10', 'En cours d’acheminement'], ['11', 'Votre colis est disponible en point de retrait']) }).etat === 'disponible', 'A2 « disponible en point de retrait » ⇒ disponible');
  ok(E({ evenements: ev(['11', 'Colis retourné à l’expéditeur']) }).etat === 'retour_expediteur', 'A3 retour à l’expéditeur ⇒ reparti');
  ok(E({ evenements: ev(['11', 'Votre colis sera livré demain']) }).etat !== 'retire', 'A4 un futur (« sera livré demain ») ne constate rien');
  ok(E({ evenements: ev(['11', 'Si le colis est livré en votre absence, un avis de passage est déposé']) }).etat === 'inconnu', 'A5 une condition ne constate rien ⇒ inconnu');
  ok(E({ evenements: [] }).etat === 'inconnu' && E({ evenements: ev(['11', 'Bonjour']) }).etat === 'inconnu', 'A6 rien de reconnu ⇒ inconnu (pas su ≠ oui)');
  ok(E({ evenements: ev(['12', 'En cours de livraison'], ['10', 'Livré']) }).etat === 'en_route', 'A7 le plus RÉCENT tranche (la date, pas l’ordre de la page)');
  const S = await import('file://' + path.join(R, 'api/_lib/suivi-colis.js'));
  const t = { ...E({ carrier: 'gls', suivi: '12345678901', evenements: ev(['11', 'Le colis a été livré']) }), lu: '2026-11-12T08:00:00Z' };
  // (12 nov., intégration #1140) Le transporteur TRANCHE une ligne en contradiction (`aVerifierTransporteur`) ;
  // sans contradiction, la ligne garde son état et la sortie passe par la règle des fins (« Sortis de à retirer »,
  // source transporteur — banc retraits-suivi R1).
  const f = S.fusionTransporteur({ suivi: '12345678901', carrier: 'gls', status: 'transit', aVerifierTransporteur: 'Retiré puis « changé de plan »' }, t, Date.parse('2026-11-12T09:00:00Z'));
  ok(f.status === 'delivered' && !f.aVerifierTransporteur, 'B1 la ligne lue entre dans la règle commune : le transporteur tranche (retiré) une contradiction', f.status);
  const f0 = S.fusionTransporteur({ suivi: '12345678901', carrier: 'gls', status: 'transit' }, t, Date.parse('2026-11-12T09:00:00Z'));
  ok(f0.status === 'transit', 'B1 sans contradiction, la ligne garde son état (la sortie est dite par les fins datées)', f0.status);
  return ko;
}
(async () => {
  const LIB = path.join(R, 'api/_lib/suivi-public.js');
  if (!fs.existsSync(LIB)) { console.log('❌ api/_lib/suivi-public.js absent'); process.exit(1); }
  let ko = await suite(await import('file://' + LIB), false);
  if (process.argv.includes('--mutations')) {
    const src = fs.readFileSync(LIB, 'utf8');
    const M = [['futur constaté', (s) => s.replace('CONDITION.test(e.t) || FUTUR.test(e.t)', 'CONDITION.test(e.t)')],
      ['condition constatée', (s) => s.replace('CONDITION.test(e.t) || FUTUR.test(e.t)', 'FUTUR.test(e.t)')],
      ['ordre de la page', (s) => s.replace('.sort((a, b) => b.ms - a.ms)', '')],
      ['pas su = livré', (s) => s.replace("etat: 'inconnu', etatAt: null", "etat: 'retire', etatAt: null")]];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'suivi-public-'));
    for (const f of fs.readdirSync(path.dirname(LIB))) if (f.endsWith('.js') && f !== 'suivi-public.js') fs.symlinkSync(path.join(path.dirname(LIB), f), path.join(tmp, f));
    fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
    let i = 0;
    for (const [nom, mut] of M) {
      const m = mut(src);
      if (m === src) { ko++; console.log(`❌ mutation « ${nom} » : motif introuvable`); continue; }
      const f = path.join(tmp, `m${++i}.js`); fs.writeFileSync(f, m);
      const k = await suite(await import('file://' + f), true).catch(() => 1);
      if (!k) ko++;
      console.log(`${k ? '✅' : '❌'} mutation « ${nom} » ⇒ ${k ? k + ' rouge(s)' : 'RIEN ne rougit'}`);
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(ko ? `\n❌ audit-suivi-public : ${ko} rouge(s)` : '\n✅ audit-suivi-public : tout est vert');
  process.exit(ko ? 1 : 0);
})();
