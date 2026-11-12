// Audit : L'ENVOI VU DANS LE FIL — Leboncoin, Vestiaire, eBay (12 nov., « fais les messages
// Vestiaire, etc. »). Juge la règle pure `src/envoiFil.js` et que chaque site la prend :
//   · une réponse absente ou d'une forme inconnue n'est JAMAIS « Envoyé » ni « Pas envoyé »
//     (« pas su » ≠ « oui », §5) : 'incertain', sans « Réessayer » ;
//   · seul un refus SÛR (rien n'est parti) propose « Réessayer » ;
//   · un fil vide que la liste annonce est « pas encore lu », jamais « aucun message » ;
//   · Leboncoin et Vestiaire passent la réponse de l'extension par `etatEnvoiExtension`, eBay
//     l'erreur de la route par `etatEnvoiEbay` ; aucune règle d'envoi n'est touchée
//     (`lbcRepondre`, `vcRepondre` et la route `repondre` confirmée restent les seuls envois).
//   node scripts/audit-envoi-fil.cjs            — les contrôles
//   node scripts/audit-envoi-fil.cjs --prouve   — chaque règle réaffaiblie doit faire ROUGE
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

async function juger(src, code, dire) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envoi-fil-'));
  fs.writeFileSync(path.join(dir, 'envoiFil.mjs'), src);
  const M = await import(path.join(dir, 'envoiFil.mjs'));
  fs.rmSync(dir, { recursive: true, force: true });
  let ko = 0; const dit = (c, m, d) => { if (!c) ko++; if (dire) console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const E = M.etatEnvoiExtension;
  dit(E({ accepte: true, etape: 'fait', statut: 200 }) === 'ok', 'extension : fait ⇒ Envoyé');
  dit(E({ accepte: false, code: 'plafond', raison: 'déjà 50 actions' }) === 'refuse', 'extension : refusée avant tout envoi ⇒ Pas envoyé · Réessayer');
  dit(E({ accepte: true, etape: 'refuse', statut: 429 }) === 'refuse', 'extension : le site a dit non ⇒ Pas envoyé');
  dit(E({ accepte: true, etape: 'incertain' }) === 'incertain', 'extension : incertain ⇒ Pas confirmé');
  dit(E(null) === 'incertain' && E(undefined) === 'incertain', 'extension muette ⇒ Pas confirmé (jamais « envoyé », jamais « réessaie »)', String(E(null)));
  dit(E({ accepte: true, etape: 'en-cours' }) === 'incertain' && E({ ok: true }) === 'incertain', 'forme inconnue ⇒ Pas confirmé', E({ accepte: true, etape: 'en-cours' }) + ' / ' + E({ ok: true }));
  dit(M.etatEnvoiEbay(null) === 'ok', 'eBay : la route a répondu ⇒ Envoyé');
  dit(M.etatEnvoiEbay({ reason: 'incertain' }) === 'incertain', 'eBay : délai / coupure ⇒ Pas confirmé');
  dit(M.etatEnvoiEbay({ message: 'refus', status: 400 }) === 'refuse', 'eBay : refus net ⇒ Pas envoyé · Réessayer');
  dit(M.filPasLu([], true) === true && M.filPasLu(null, 'Je prends') === true, 'fil vide que la liste annonce ⇒ pas encore lu');
  dit(M.filPasLu([], false) === false && M.filPasLu([{ t: 'x' }], true) === false, 'fil lu ou rien annoncé ⇒ pas « pas lu »');
  const t0 = Date.parse('2026-11-12T10:00:00Z');
  dit(M.dejaDansFil([{ deMoi: true, t: 'Oui ', at: '2026-11-12T10:00:30Z' }], 'Oui', t0) === true, 'le message relu dans le fil n’est pas redit en bulle');
  dit(M.dejaDansFil([{ deMoi: false, t: 'Oui', at: '2026-11-12T10:00:30Z' }], 'Oui', t0) === false && M.dejaDansFil([{ deMoi: true, t: 'Oui', at: '2026-11-11T10:00:00Z' }], 'Oui', t0) === false,
    'un « Oui » de l’acheteur, ou un ancien « Oui » à lui, n’est pas l’envoi du jour');
  // Chaque site la prend (code lu, commentaires retirés).
  const lbc = sansCom(code.lbc), vc = sansCom(code.vc), eb = sansCom(code.eb);
  dit(/const etat = etatEnvoiExtension\(r\);/.test(lbc) && /<EnvoiDansFil envoi=\{envoiFil\}[^>]*site="Leboncoin"/.test(lbc) && /cmd: 'lbcRepondre', conv, texte: t/.test(lbc), 'Leboncoin : `lbcRepondre` inchangé, l’état par la règle, la bulle dans le fil');
  dit(/const etat = etatEnvoiExtension\(r\);/.test(vc) && /<EnvoiDansFil envoi=\{envoiFil\}[^>]*site="Vestiaire"/.test(vc) && /cmd: 'vcRepondre', conv, texte: t/.test(vc), 'Vestiaire : `vcRepondre` inchangé, l’état par la règle, la bulle dans le fil');
  dit(/etat:etatEnvoiEbay\(e\)/.test(eb) && /<EnvoiDansFil envoi=\{envoiFil\}[^>]*site="eBay"/.test(eb) && /call\('repondre',\{itemId:m\.itemId,messageId:m\.id,body:texte,confirme:true\},headers,\{write:true\}\)/.test(eb) && /if\(!await confirm\(/.test(eb), 'eBay : route `repondre` confirmée inchangée, l’état par la règle');
  dit(/filPasLu\(fil\.messages, annonce\)/.test(lbc) && /filPasLu\(fil\.messages, annonce\)/.test(vc) && /<FilPasLu onRelire=\{relireEchange\}\/>/.test(eb), 'les trois sites : fil vide annoncé ⇒ « pas encore lu · Relire »');
  dit(/<FilIllisible[^>]*'data-lbc-fil-etat': 'pas-su'/.test(lbc) && /<FilIllisible[^>]*'data-vc-fil': 'pas-su'/.test(vc) && /'data-ebay-lecture':'pas-su'/.test(eb), 'les trois sites : lecture ratée ⇒ « Réessayer »');
  dit(/offre=\{offreFil\}/.test(vc) && /offresDu\(\(p\) => p !== pidOuvert\)/.test(vc), 'Vestiaire : l’offre de l’article dans SA conversation (même productId), pas redite au-dessus');
  return ko;
}

(async () => {
  const src = lire('src/envoiFil.js');
  const code = { lbc: lire('src/ecrans/MessagesLeboncoin.jsx'), vc: lire('src/ecrans/Vestiaire.jsx'), eb: lire('src/ebayGestion.jsx') };
  if (!process.argv.includes('--prouve')) {
    const ko = await juger(src, code, true);
    console.log(ko ? `\n❌ envoi-fil : ${ko} rouge(s)` : '\n✅ envoi-fil : tout est vert');
    process.exit(ko ? 1 : 0);
  }
  const mutations = [
    ['muette = envoyé', src.replace("if (!r || typeof r !== 'object') return 'incertain';", "if (!r || typeof r !== 'object') return 'ok';")],
    ['forme inconnue = pas envoyé', src.replace("  return 'incertain';\n}\n\n// La route eBay", "  return 'refuse';\n}\n\n// La route eBay")],
    ['incertain eBay = refus', src.replace("erreur.reason === 'incertain' ? 'incertain' : 'refuse'", "'refuse'")],
    ['fil vide = rien', src.replace('return vide && !!annonce;', 'return false;')],
    ['un « Oui » de l’acheteur compte', src.replace('m && m.deMoi === true && ', 'm && ')],
  ];
  const mutCode = [
    ['Leboncoin : ancien résultat', { ...code, lbc: code.lbc.replace('const etat = etatEnvoiExtension(r);', 'const etat = r && r.accepte ? "ok" : "refuse";') }],
    ['Vestiaire : fil vide dit « aucun »', { ...code, vc: code.vc.replace('filPasLu(fil.messages, annonce)', 'false') }],
    ['eBay : pas de bulle', { ...code, eb: code.eb.replace('<EnvoiDansFil envoi={envoiFil}', '<span envoi={envoiFil}') }],
  ];
  let rates = 0;
  for (const [nom, s] of mutations) { if (s === src) { console.log('??  mutation sans effet : ' + nom); rates++; continue; } const ko = await juger(s, code, false); console.log((ko ? 'OK  rouge : ' : 'KO  reste vert : ') + nom); if (!ko) rates++; }
  for (const [nom, c] of mutCode) { const ko = await juger(src, c, false); console.log((ko ? 'OK  rouge : ' : 'KO  reste vert : ') + nom); if (!ko) rates++; }
  console.log(rates ? `\n❌ envoi-fil --prouve : ${rates} mutation(s) pas vue(s)` : `\n✅ envoi-fil --prouve : ${mutations.length + mutCode.length}/${mutations.length + mutCode.length} mutations rouges`);
  process.exit(rates ? 1 : 0);
})();
