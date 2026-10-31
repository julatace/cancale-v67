// ⚠️⚠️ CONTRÔLE PERMANENT — « TERMINER LE SITE » (31 octobre).
//
//  A. La phrase du CA eBay (Tableau de bord, « par plateforme ») disait « total
//     des ventes payées en euros indisponible » quand eBay était LU à 0
//     commande (audit du 20 oct.) : un « pas su » affiché sur une mesure faite.
//     `caParPlateforme` reçoit les commandes et dit ce qui est mesuré :
//     encours · passu · aucune · illisible · lu (§5).
//  B. « Non lues » : une règle pour Messages, Ma journée et le point de
//     l'onglet (src/messagesNonLus.js, §11) — Messages disait 156 quand Ma
//     journée disait 8.
//  C. Le vert menthe #0F8A6A (INV_STATUS.online.color) hors palette (§7) :
//     l'état « OK » suit l'encre du thème ; jamais en fond sous un texte blanc.
//
// Exécute les vraies fonctions d'App.jsx dans un `vm`. `--prouve` réaffaiblit
// chaque correctif : au moins un contrôle doit passer au ROUGE à chaque fois.
const fs = require('fs'), vm = require('vm'), path = require('path');
const RACINE = path.join(__dirname, '..');
const APP0 = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
const MSG0 = fs.existsSync(path.join(RACINE, 'src', 'messagesNonLus.js')) ? fs.readFileSync(path.join(RACINE, 'src', 'messagesNonLus.js'), 'utf8') : '';

function extraire(src, nom) {
  const re = new RegExp(`^( *)(?:async )?function ${nom}\\(|^( *)const ${nom} = `, 'm');
  const m = re.exec(src);
  if (!m) return '';
  let i = m.index, prof = 0, vuCorps = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (prof === 0 && vuCorps) { i++; break; } }
  }
  while (src[i] === ';') i++;
  return src.slice(m.index, i);
}
// Les lignes de commentaire seules (un bloc `/* */` à travers du JSX se lit mal
// par expression régulière : on ne retire que les lignes qui commencent par //).
const sansCommentaires = (t) => t.split('\n').map((l) => (/^\s*\/\//.test(l) ? '' : l)).join('\n');

function controle(APP, MSG) {
  let ko = 0, n = 0;
  const dit = (ok, quoi, detail) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${quoi}${!ok && detail ? ' — ' + detail : ''}`); };
  // ── A ─────────────────────────────────────────────────────────────────────
  const ctx = vm.createContext({ console, Math, Number, String, Array, Object, JSON, Date });
  for (const nom of ['commandeEbayEngagee', 'montantRecuEbay', 'caEbayPayees', 'etatCaEbay', 'NOTE_CA_EBAY', 'lbcAnnulee', 'lbcFinalisee', 'caParPlateforme']) {
    const t = extraire(APP, nom);
    try { vm.runInContext(t.replace(/^ *const /, 'var ') + `\n;this.${nom} = ${nom};`, ctx); } catch (_) {}
  }
  const caPP = (cmd) => { try { const l = ctx.caParPlateforme({ caEncaisse: 100 }, { ventes: [] }, ctx.caEbayPayees(cmd || []), cmd); return l.find((x) => x.nom === 'eBay'); } catch (e) { return { note: 'ERREUR ' + e.message }; } };
  const paye = { orderId: '1', orderPaymentStatus: 'PAID', paymentSummary: { totalDueSeller: { value: '100.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '12.00', currency: 'EUR' } };
  const sansFrais = { orderId: '2', orderPaymentStatus: 'PAID', paymentSummary: { totalDueSeller: { value: '50.00', currency: 'EUR' } } };
  const l0 = caPP([]);
  dit(l0 && l0.ca == null && /pas encore de vente/i.test(l0.note) && !/indisponible/i.test(l0.note), 'A. eBay lu, 0 commande : « pas encore de vente payée », pas « indisponible »', l0 && l0.note);
  const lNP = caPP([{ orderId: '3', orderPaymentStatus: 'PENDING' }]);
  dit(lNP && /pas encore de vente/i.test(lNP.note), 'A. eBay lu, aucune commande payée : même phrase', lNP && lNP.note);
  const lu = caPP([paye]);
  dit(lu && lu.ca === 88 && /ventes payées/.test(lu.note), 'A. une commande payée : 88 € reçus, « ventes payées »', lu && `${lu.ca} · ${lu.note}`);
  const ill = caPP([paye, sansFrais]);
  dit(ill && ill.ca == null && /indisponible/i.test(ill.note), 'A. une commande payée illisible : le montant est dit indisponible (jamais un total partiel)', ill && ill.note);
  let ps; try { ps = ctx.caParPlateforme({ caEncaisse: 1 }, { ventes: [] }, null, null).find((x) => x.nom === 'eBay'); } catch (e) { ps = { note: 'ERREUR' }; }
  dit(ps && /pas lues/i.test(ps.note), 'A. commandes eBay illisibles (null) : « pas lues », jamais « pas encore de vente »', ps && ps.note);
  let ec; try { ec = ctx.caParPlateforme({ caEncaisse: 1 }, { ventes: [] }, null, undefined).find((x) => x.nom === 'eBay'); } catch (e) { ec = { note: 'ERREUR' }; }
  dit(ec && /en cours/i.test(ec.note), 'A. lecture pas finie : « lecture en cours »', ec && ec.note);
  dit(/<Dashboard [^>]*ebayCommandes=\{ebayCommandes\}/.test(APP), 'A. la coque passe les commandes eBay au Tableau de bord');

  // ── B ─────────────────────────────────────────────────────────────────────
  let regle = null;
  try {
    const code = MSG.replace(/^export /gm, '') + '\n;this.r={conversationNonLue,conversationNonLueAncienne,messageRecent};';
    const c2 = vm.createContext({ Date, Number }); vm.runInContext(code, c2); regle = c2.r;
  } catch (_) {}
  const now = Date.parse('2026-10-31T12:00:00Z'), iso = (h) => new Date(now - h * 3600e3).toISOString();
  dit(!!regle, 'B. la règle « non lue » existe (src/messagesNonLus.js)');
  if (regle) {
    dit(regle.conversationNonLue({ unread: true, updated_at: iso(30) }, now) === true, 'B. non lue de 30 h : comptée');
    dit(regle.conversationNonLue({ unread: true, updated_at: iso(24 * 42) }, now) === false, 'B. non lue de 42 jours : pas comptée');
    dit(regle.conversationNonLue({ unread: true, updated_at: 'n/a' }, now) === false, 'B. date illisible : ancienne, jamais récente par défaut');
    dit(regle.conversationNonLueAncienne({ unread: true, updated_at: iso(24 * 42) }, now) === true, 'B. elle est comptée à part (dite)');
    dit(regle.conversationNonLue({ unread: false, updated_at: iso(1) }, now) === false, 'B. lue : jamais comptée');
  }
  const code = sansCommentaires(APP);
  dit(!/\.filter\(c\s*=>\s*c\.unread\)/.test(code), 'B. aucun compte de non-lues par le seul drapeau `c.unread` (Messages)');
  dit(!/c\.unread\s*&&\s*\(Date\.now\(\)/.test(code), 'B. Ma journée ne garde pas sa propre fenêtre de 7 jours (une seule règle)');
  dit(/messageFilter==='offres'\?!!offreDeConv\(c\):conversationNonLue\(c\)/.test(code), 'B. le filtre « Non lues » lit la règle');
  dit(/unreadConvs\.filter\(x=>[^\n]*messageRecent\(x\.updated_at\)/.test(code), 'B. le point « nouveau » de l’onglet lit la règle');

  // ── C ─────────────────────────────────────────────────────────────────────
  dit(!/#0F8A6A/i.test(code), 'C. plus aucun vert menthe #0F8A6A dans le code de l’app (§7)');
  const inv = extraire(APP, 'INV_STATUS');
  let col = { clair: null, sombre: null };
  try {
    const c3 = vm.createContext({}); vm.runInContext('var C = { text: "#0B0F15" };\n' + inv.replace(/^ *const /, 'var ') + '\n;this.I = INV_STATUS;', c3);
    col.clair = c3.I.online.color; vm.runInContext('C.text = "#F2F5FA";', c3); col.sombre = c3.I.online.color;
  } catch (_) {}
  dit(col.clair === '#0B0F15' && col.sombre === '#F2F5FA', 'C. l’état « OK » suit l’encre du thème courant (clair et sombre)', JSON.stringify(col));
  dit(!/background:\s*(?:[^,{}]*\?\s*[^,{}:]*:\s*)?INV_STATUS\.online\.color\s*,[^}]*color:\s*'#fff'/.test(code), 'C. jamais en fond sous un texte blanc (blanc sur blanc en sombre)');
  return { ko, n };
}

const r = controle(APP0, MSG0);
console.log(r.ko ? `\n❌ finir-compta : ${r.ko} rouge(s) sur ${r.n}` : `\n✅ finir-compta : ${r.n} contrôles verts`);

if (process.argv.includes('--prouve')) {
  const mutations = {
    'ebay-ancienne-phrase': [APP0.replace("NOTE_CA_EBAY[etatCaEbay(ebayCommandes)] }", "'total des ventes payées en euros indisponible' }"), MSG0],
    'ebay-aucune-vaut-passu': [APP0.replace("? 'illisible' : 'aucune';", "? 'illisible' : 'passu';"), MSG0],
    'messages-drapeau-seul': [APP0.replace('const nonLus = liste.filter(c=>conversationNonLue(c)).length;', 'const nonLus = liste.filter(c=>c.unread).length;'), MSG0],
    'regle-sans-fenetre': [APP0, MSG0.replace('return now - ms < MSG_RECENT_MS;', 'return true;')],
    'date-illisible-recente': [APP0, MSG0.replace('if (!Number.isFinite(ms)) return false;', 'if (!Number.isFinite(ms)) return true;')],
    'menthe-revenue': [APP0.replace("get color() { return C.text; }", "color: '#0F8A6A'"), MSG0],
    'fond-blanc-sur-encre': [APP0.replace("border:'none',background:C.accent,color:C.onAccent,borderRadius:8", "border:'none',background:INV_STATUS.online.color,color:'#fff',borderRadius:8"), MSG0],
  };
  let vertes = 0;
  for (const [nom, [a, m]] of Object.entries(mutations)) {
    if (a === APP0 && m === MSG0) { console.log(`⚠️ mutation ${nom} : ancre introuvable`); vertes++; continue; }
    console.log(`\n── mutation ${nom}`);
    const x = controle(a, m);
    if (!x.ko) { vertes++; console.log(`❌ mutation ${nom} restée VERTE`); } else console.log(`✅ mutation ${nom} : ${x.ko} rouge(s)`);
  }
  console.log(vertes ? `\n❌ ${vertes} mutation(s) non attrapée(s)` : `\n✅ --prouve : ${Object.keys(mutations).length}/${Object.keys(mutations).length} mutations rouges`);
  process.exit(vertes || r.ko ? 1 : 0);
}
process.exit(r.ko ? 1 : 0);
