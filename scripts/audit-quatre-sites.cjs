#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « METTRE AUSSI SUR… » — 1 PAIRE → 4 SITES (24 nov.)
//        node scripts/audit-quatre-sites.cjs [--prouve]
//
//  La VRAIE règle (src/publier/quatreSites.js, importée depuis une copie mutable de src/) et l'hôte (App.jsx,
//  `HoteMettreAussiSur`, lu sans ses commentaires) :
//   C  chaque site reçoit EXACTEMENT ses champs (`CHAMPS_QUATRE`) ;
//   E  eBay : jamais un champ de port / livraison gratuite / étiquette (§2.8), le SKU `VRM-{N°}` est posé ;
//   N  Leboncoin : la description finit par « N°{n} », relue par la règle #1354 (`lireNumeroTexte`) = CE N° ;
//      un autre N° dans la description ⇒ refus ; Vestiaire : « Réf. VRM-{n} » ;
//   P  le prix Vinted est RELU avant chaque envoi : changé, pas su, retirée ⇒ ce site s'arrête et RIEN ne part ;
//   U  un compte pas relié (ou pas lu, ou une extension pas à jour) ⇒ rien n'est envoyé, même coché ;
//   O  un site à la fois (jamais deux envois en vol) ;
//   R  « retirer ailleurs » : seulement une vente PROUVÉE, jamais un geste de l'hôte sans SON toucher ;
//   I  l'identité n'est jamais le titre : 50 annonces au même titre ⇒ chacune SON N°, SON id, SES photos ;
//   L  le lien du panneau (`action=aussi`, sites, pct) et l'extension 5.451 : pré-ouvre, ne lance jamais.
//  `--prouve` : chaque règle réaffaiblie rend l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const F_Q = 'src/publier/quatreSites.js';

const MUTATIONS = {
  ebayLivraison: ["return { ok: true, envoi: { ...commun, sku: skuQuatre(numero), description: desc } };", "return { ok: true, envoi: { ...commun, sku: skuQuatre(numero), description: desc, livraison: 'gratuite' } };"],
  skuAbsent: ["export const skuQuatre = (num) => { const k = cleNumero(num); return k && NUM_OK.test(k) ? 'VRM-' + k : ''; };", "export const skuQuatre = (num) => '';"],
  numeroOublie: ["  const texte = lu.etat === 'lu' && lu.cle === k ? t : (t ? t + '\\n\\n' : '') + 'N°' + k;\n  const relu = lireNumeroTexte(texte, 'description');\n  if (!(relu.etat === 'lu' && relu.cle === k)) return { ok: false, code: 'autre-numero', autres: relu.cles || [] };", "  const texte = t;"],
  // Deux gardes l'une sur l'autre (les N° de la description, puis la relecture #1354) : retirées ensemble.
  autreNumeroAccepte: [["  const autres = [...new Set(numerosMarques(t).map((o) => o.cle))].filter((c) => c !== k);\n  if (autres.length) return { ok: false, code: 'autre-numero', autres };\n  const lu =", "  const lu ="],
    ["  if (!(relu.etat === 'lu' && relu.cle === k)) return { ok: false, code: 'autre-numero', autres: relu.cles || [] };", '']],
  pasDeRelecture: ["    if (vu == null || Math.abs(Number(lu) - Number(vu)) > 0.005) { dire(pas.sites, { etat: 'arrete', code: 'prix-change', avant: vu, apres: Number(lu) }); continue; }", ''],
  prixPasSuPasse: ["    if (!(Number(lu) > 0)) { dire(pas.sites, { etat: 'arrete', code: 'prix-pas-relu' }); continue; }", "    if (lu == null) lu = vu;"],
  compteIgnore: ["    if (!vivants.length) return non(site === 'leboncoin' ? 'lbc-compte' : 'vc-compte', site === 'leboncoin' ? 'ouvrirLbc' : 'ouvrirVc');", ''],
  extIgnoree: ["    if (e.aussi !== 'ok') return non(e.aussi === 'retard' ? 'ext-retard' : 'ext-absente', 'extension');", ''],
  comptesPasSuOk: ["  if (comptes === null) return non('comptes-pas-su', 'relire');", "  if (comptes === null) return { possible: true, code: 'ok', raison: '', geste: '' };"],
  planSansDispo: ["  const ok = (s) => !!(coches && coches[s]) && !!(dispo && dispo[s] && dispo[s].possible === true);", "  const ok = (s) => !!(coches && coches[s]);"],
  retraitDouteux: ["  if (!art || art.douteuse !== false) return null;", "  if (!art) return null;"],
  enParallele: ["    try { r = await f(pas); } catch (_) { r = { accepte: false, code: 'coupe' }; }", "    r = { accepte: true, etat: 'envoi' }; f(pas).catch(() => {});"],
  titreTronqueSansLimite: ["  const titre = str(forme.titre).slice(0, TITRE_MAX_QUATRE[site]);", "  const titre = str(forme.titre);"],
};
const args = process.argv.slice(2);
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 600) : '')); } };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  if (!fs.existsSync(path.join(R, F_Q))) { dit(false, 'src/publier/quatreSites.js existe'); console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(1); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-q4-'));
  const copier = (rel, txt) => { const d = path.join(dir, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, txt != null ? txt : fs.readFileSync(path.join(R, rel), 'utf8')); };
  for (const f of ['src/publier/aussi.js', 'src/publier/agent.js', 'src/publier/tables.js', 'src/publier/listes.js', 'src/correspondances.js', 'src/annonceVinted.js', 'src/numeroEcrit.js']) copier(f);
  for (const m of fs.readFileSync(path.join(R, 'src/annonceVinted.js'), 'utf8').matchAll(/from\s+['"](\.\/[^'"]+\.js)['"]/g)) copier(path.posix.join('src', m[1]));
  let q = fs.readFileSync(path.join(R, F_Q), 'utf8');
  if (mut) {
    const m0 = MUTATIONS[mut]; const paires = m0 && Array.isArray(m0[0]) ? m0 : m0 ? [m0] : [];
    if (!paires.length) { console.log('mutation introuvable : ' + mut); process.exit(2); }
    for (const [a, b] of paires) { if (!q.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); } q = q.replace(a, b); }
  }
  copier(F_Q, q);
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const Q = await import(pathToFileURL(path.join(dir, F_Q)).href);
  const NE = await import(pathToFileURL(path.join(dir, 'src/numeroEcrit.js')).href);
  const app = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
  const a0 = app.indexOf('function HoteMettreAussiSur('), a1 = app.indexOf('function HotePublierPartout(', a0);
  const hote = a0 >= 0 && a1 > a0 ? sansCommentaires(app.slice(a0, a1)) : '';
  dit(!!hote, 'l’hôte HoteMettreAussiSur est dans App.jsx');

  // 50 annonces au même titre : la source de chacune par SON identifiant.
  const IDS = Array.from({ length: 50 }, (_, i) => String(5100000100 + i * 17));
  const paire = (i, o = {}) => Object.assign({ id: IDS[i], num: String(400 + i), title: 'Nike Air Max 90 blanche', desc: 'Portées deux fois.', taille: '42', etat: 'Très bon état', marque: 'Nike',
    photos: [1, 2, 3].map((k) => `https://images1.vinted.net/t/a/f800/${IDS[i]}-${k}.jpeg`), prix: 59, uid: '777' }, o);
  const forme = (i, o, f) => { const r = Q.formeDepuisVinted(paire(i, o), f || { prixMini: 40 }); return r.ok ? r.forme : null; };
  const FRAIS = { leboncoin: { etat: 'zero' }, vestiaire: { etat: 'pasLu' }, ebay: { etat: 'taux', taux: 129 } };

  // ── C : exactement ses champs ──
  { const f = forme(7); const fautes = [];
    for (const s of Q.SITES_QUATRE) { const e = Q.envoiSite(s, f, FRAIS[s]); if (!e.ok) { fautes.push(s + ' refusé ' + e.code); continue; }
      const k = Object.keys(e.envoi).sort().join(','), voulu = [...Q.CHAMPS_QUATRE[s]].sort().join(','); if (k !== voulu) fautes.push(s + ' : ' + k + ' ≠ ' + voulu); }
    dit(!fautes.length, 'C1 — chaque site reçoit EXACTEMENT ses champs (Leboncoin, Vestiaire, eBay)', fautes.join(' · '));
    const lbc = Q.envoiSite('leboncoin', Q.modifierForme(f, 'titre', 'x'.repeat(120)), FRAIS.leboncoin), eb = Q.envoiSite('ebay', Q.modifierForme(f, 'titre', 'x'.repeat(120)), FRAIS.ebay);
    dit(lbc.ok && lbc.envoi.titre.length === 50 && eb.ok && eb.envoi.titre.length === 80, 'C2 — le titre à la longueur du site (Leboncoin 50, eBay 80)', JSON.stringify([lbc.envoi && lbc.envoi.titre.length, eb.envoi && eb.envoi.titre.length]));
    const ph = Q.envoiSite('leboncoin', Q.modifierForme(f, 'photos', ['https://evil.example/x.jpg']), FRAIS.leboncoin);
    dit(ph.ok && ph.envoi.photos.every((u) => u.includes(IDS[7])), 'C3 — une photo qui ne vient pas de l’annonce n’entre jamais', JSON.stringify(ph.envoi && ph.envoi.photos)); }

  // ── E : eBay, l'acheteur paie le bordereau ──
  { const f = forme(3); const e = Q.envoiSite('ebay', f, FRAIS.ebay);
    const txt = e.ok ? JSON.stringify(Object.keys(e.envoi)) + Object.entries(e.envoi).filter(([k]) => k !== 'description' && k !== 'titre' && k !== 'photos').map(([, v]) => String(v)).join('|') : '';
    dit(e.ok && !Q.INTERDIT_EBAY.test(txt), 'E1 — eBay : aucun champ de port, de livraison gratuite ni d’étiquette dans l’envoi', txt);
    dit(e.ok && e.envoi.sku === 'VRM-403', 'E2 — eBay : le SKU VRM-{N°} est posé', e.envoi && e.envoi.sku);
    const corpsEbay = (hote.match(/ebay: async \(\) => \{[\s\S]*?\n {6}\},/) || [''])[0];
    dit(!!corpsEbay && /preparerBrouillonPartout/.test(corpsEbay) && !/livraison|shipping|freeShipping|gratuit|etiquette|label|acheterEtiquette|fulfillment/i.test(corpsEbay),
      'E3 — l’hôte passe par le brouillon eBay existant, sans aucun port ni étiquette', corpsEbay.slice(0, 300));
    dit(!/action:\s*'publier'|publierBrouillonEbay|programmer/.test(corpsEbay), 'E4 — rien n’est MIS EN LIGNE d’ici : la mise en ligne reste sa confirmation dans les brouillons', corpsEbay.slice(0, 200)); }

  // ── N : le N° écrit ──
  { const f = forme(12); const e = Q.envoiSite('leboncoin', f, FRAIS.leboncoin);
    const lu = e.ok ? NE.lireNumeroTexte(e.envoi.description, 'description') : null;
    dit(e.ok && lu && lu.etat === 'lu' && lu.cle === '412', 'N1 — Leboncoin : la description finit par « N°412 », relue par la règle #1354 = ce N°', JSON.stringify([e.envoi && e.envoi.description, lu]));
    const deux = Q.envoiSite('leboncoin', Q.modifierForme(f, 'description', 'Rangée N°77 au garage.'), FRAIS.leboncoin);
    dit(!deux.ok && deux.code === 'autre-numero', 'N2 — une description qui porte un AUTRE N° ⇒ refus (jamais deux numéros)', JSON.stringify(deux));
    const deja = Q.envoiSite('leboncoin', Q.modifierForme(f, 'description', 'Belle paire.\n\nN°412'), FRAIS.leboncoin);
    dit(deja.ok && (deja.envoi.description.match(/412/g) || []).length === 1, 'N3 — un N° déjà écrit à la fin n’est pas doublé', deja.envoi && deja.envoi.description);
    const vc = Q.envoiSite('vestiaire', f, FRAIS.vestiaire);
    dit(vc.ok && /Réf\. VRM-412$/.test(vc.envoi.description) && vc.envoi.reference === 'VRM-412', 'N4 — Vestiaire : « Réf. VRM-412 » (la référence que la voie existante relit)', vc.envoi && vc.envoi.description);
    dit(!Q.formeDepuisVinted(paire(1, { num: '' })).ok, 'N5 — sans N°, aucune fiche (rien ne part sans identité)'); }

  // ── P : le prix relu avant chaque envoi ──
  { const f = forme(5);
    const tourne = async (relu) => { const appels = []; const r = await Q.executerQuatre({ plan: [{ voie: 'panneau', sites: ['leboncoin', 'vestiaire'] }, { voie: 'ebay', sites: ['ebay'] }], forme: f,
      relirePrix: async () => { appels.push('relu'); return typeof relu === 'function' ? relu() : relu; }, envoyer: { panneau: async () => { appels.push('panneau'); return { accepte: true, etat: 'panneau' }; }, ebay: async () => { appels.push('ebay'); return { accepte: true, etat: 'brouillon' }; } } });
      return { r, appels }; };
    const meme = await tourne(59);
    dit(meme.appels.join(',') === 'relu,panneau,relu,ebay' && meme.r.ebay.etat === 'brouillon' && meme.r.leboncoin.etat === 'panneau', 'P1 — le prix est relu AVANT chaque envoi (relu, panneau, relu, eBay)', meme.appels.join(','));
    const change = await tourne(49);
    dit(!change.appels.includes('panneau') && !change.appels.includes('ebay') && change.r.ebay.etat === 'arrete' && change.r.ebay.code === 'prix-change', 'P2 — prix Vinted changé (59 → 49) ⇒ arrêté, RIEN ne part', JSON.stringify(change));
    const pasSu = await tourne(null), partie = await tourne('absente');
    dit(!pasSu.appels.some((x) => x !== 'relu') && pasSu.r.leboncoin.code === 'prix-pas-relu' && !partie.appels.some((x) => x !== 'relu') && partie.r.ebay.code === 'plus-en-ligne',
      'P3 — prix pas relu, ou annonce plus en ligne ⇒ arrêté, rien ne part', JSON.stringify([pasSu.r, partie.r]));
    const pl = Q.prixSite(Q.modifierForme(f, 'prixEbay', '30'), 'ebay', FRAIS.ebay);
    dit(!pl.ok && pl.code === 'sous-plancher', 'P4 — eBay : jamais sous le plancher (prix mini)', JSON.stringify(pl));
    const fr = Q.prixSite(f, 'ebay', FRAIS.ebay), fv = Q.prixSite(f, 'vestiaire', FRAIS.vestiaire);
    dit(fr.ok && fr.frais.montant === 7.61 && fr.net === 51.39 && fv.frais.etat === 'pasLu' && fv.frais.montant === null, 'P5 — les frais : eBay au taux lu (12,9 %), Vestiaire « pas lus » (jamais 0)', JSON.stringify([fr, fv]));
    dit(/relirePrix/.test(hote) && /lireAnnoncesVintedEnLigne/.test(hote) && /executerQuatre/.test(hote), 'P6 — l’hôte relit le prix (dressing du compte) et passe par executerQuatre'); }

  // ── U : rien vers un compte pas relié ──
  { const base = { comptes: { leboncoin: [{ id: 'a' }], vestiaire: [{ id: 'b' }], ebay: [{ id: 'principal' }] }, ext: { aussi: 'ok', lien: 'ok' }, deja: { leboncoin: false, vestiaire: false, ebay: false } };
    const tous = Object.fromEntries(Q.SITES_QUATRE.map((s) => [s, Q.dispoSite(s, base)]));
    dit(Q.SITES_QUATRE.every((s) => tous[s].possible), 'U1 — tout relié, tout lu : les trois sites sont possibles', JSON.stringify(tous));
    const cas = [
      ['aucun compte Leboncoin', 'leboncoin', { ...base, comptes: { ...base.comptes, leboncoin: [] } }],
      ['comptes Vestiaire pas lus', 'vestiaire', { ...base, comptes: { ...base.comptes, vestiaire: null } }],
      ['eBay délié', 'ebay', { ...base, comptes: { ...base.comptes, ebay: [{ id: 'principal', delie: true }] } }],
      ['extension pas à jour', 'leboncoin', { ...base, ext: { aussi: 'retard' } }],
      ['extension absente', 'vestiaire', { ...base, ext: { aussi: 'absente' } }],
      ['déjà là : pas su', 'ebay', { ...base, deja: { ...base.deja, ebay: null } }],
      ['déjà en ligne', 'leboncoin', { ...base, deja: { ...base.deja, leboncoin: true } }],
      ['vendue', 'ebay', { ...base, vendue: true }],
    ];
    const fautes = [];
    for (const [nom, s, ctx] of cas) {
      const d = Object.fromEntries(Q.SITES_QUATRE.map((x) => [x, Q.dispoSite(x, ctx)]));
      const plan = Q.planQuatre({ leboncoin: true, vestiaire: true, ebay: true }, d);
      if (d[s].possible || plan.some((p) => p.sites.includes(s))) fautes.push(nom);
      if (!d[s].raison || (d[s].geste == null)) fautes.push(nom + ' sans raison');
    }
    dit(!fautes.length, 'U2 — pas relié / pas lu / extension pas à jour / déjà là / vendue ⇒ grisé avec la raison, et JAMAIS dans la file même coché', fautes.join(' · '));
    const plan = Q.planQuatre({ leboncoin: true, vestiaire: false, ebay: true }, tous);
    dit(JSON.stringify(plan) === JSON.stringify([{ voie: 'panneau', sites: ['leboncoin'] }, { voie: 'ebay', sites: ['ebay'] }]), 'U3 — seuls les sites COCHÉS partent (Vestiaire décoché ⇒ absent)', JSON.stringify(plan)); }

  // ── O : un à la fois ──
  { let enVol = 0, max = 0; const f = forme(9);
    const lent = async () => { enVol++; max = Math.max(max, enVol); await new Promise((r) => setTimeout(r, 30)); enVol--; return { accepte: true, etat: 'panneau' }; };
    await Q.executerQuatre({ plan: [{ voie: 'panneau', sites: ['leboncoin'] }, { voie: 'ebay', sites: ['ebay'] }], forme: f, relirePrix: async () => 59, envoyer: { panneau: lent, ebay: lent } });
    dit(max === 1, 'O1 — un site à la fois : jamais deux envois en vol', 'max=' + max); }

  // ── R : retirer ailleurs ──
  { const art = (o) => Object.assign({ numero: '412', titre: 't', venduSur: ['Vinted'], douteuse: false, sites: [{ plateforme: 'Leboncoin', voie: 'auto', etat: 'aRetirer' }, { plateforme: 'eBay', voie: 'auto', etat: 'aRetirer' }, { plateforme: 'Vestiaire', voie: 'verifier', etat: 'verifier' }] }, o);
    const q = Q.questionRetrait(art());
    dit(q && q.ailleurs.join() === 'Leboncoin,eBay' && q.aVerifier.join() === 'Vestiaire' && q.venduSur.join() === 'Vinted', 'R1 — vente prouvée ⇒ « Vendue sur Vinted — retirer de Leboncoin et eBay ? » (Vestiaire : à vérifier)', JSON.stringify(q));
    dit(Q.questionRetrait(art({ douteuse: true })) === null && Q.questionRetrait(art({ douteuse: undefined })) === null, 'R2 — vente pas prouvée (ou pas su) ⇒ aucune question de retrait');
    dit(!/retirerUnSiteRA\(|gesteRA\(|toutRetirerRA\(|action:\s*'retirer'|lbcSupprime|supprimeLbc/.test(hote) && /<BlocARetirerAilleurs numero=/.test(hote),
      'R3 — l’hôte ne retire RIEN lui-même : il montre le bloc existant (SON toucher, confirmé)');
    dit(/vendue: !!question/.test(hote), 'R4 — vendue ⇒ aucune création (dispoSite reçoit la vente)'); }

  // ── I : jamais par le titre ──
  { const fs50 = IDS.map((_, i) => Q.envoiSite('ebay', forme(i), FRAIS.ebay));
    const bons = fs50.filter((e, i) => e.ok && e.envoi.annonceVinted === IDS[i] && e.envoi.sku === 'VRM-' + (400 + i) && e.envoi.photos.every((u) => u.includes(IDS[i])));
    dit(bons.length === 50, 'I1 — 50 annonces au même titre : chacune SON id, SON N°, SES photos', bons.length + '/50');
    dit(!/\.title\s*===|titre\s*===|\.title\)\s*===|chercherPaires/.test(hote) && /cleNum\(p\.num\) === k/.test(hote) && /enLigneSur\(/.test(hote),
      'I2 — l’hôte choisit la paire par son N° et juge « déjà là » par identité (enLigneSur), jamais par un titre'); }

  // ── L : le lien et l'extension ──
  { const OP = await import(pathToFileURL(path.join(R, 'src/ouvrirPanneau.js')).href);
    const u = OP.lienPanneau({ site: 'vinted', page: 'publier', ids: ['5100000100'], action: 'aussi', sites: ['leboncoin', 'vestiaire', 'ebay'], pct: { leboncoin: 10, vestiaire: 7 } });
    dit(/action=aussi/.test(u) && /sites=leboncoin,vestiaire(&|$)/.test(u) && /pct=leboncoin:10(&|$)/.test(u) && !/ebay|vestiaire:7/.test(u), 'L1 — le lien : action=aussi, sites (jamais eBay), pct dans les choix de la voie', u);
    const badge = fs.readFileSync(path.join(R, 'vinted-sync-extension/vrm-badge.js'), 'utf8');
    const f0 = badge.indexOf('function aussiDepuisLien('), corps = f0 >= 0 ? badge.slice(f0, badge.indexOf('\n  }\n', f0)) : '';
    dit(!!corps && /ouvrirAussi6\(/.test(corps) && !/publierAussiLancer|confirme\s*:\s*true|sendMessage/.test(corps), 'L2 — extension : le lien OUVRE « Publier aussi sur… », il ne lance jamais rien (SA confirmation reste due)', corps.slice(0, 300));
    dit(/'relancer', 'aussi'\]/.test(badge) && /'sites', 'pct'\]\) p\.delete/.test(badge), 'L3 — extension : `aussi` est une action du lien, sites et pct retirés de l’adresse'); }

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
