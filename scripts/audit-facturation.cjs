// ════════════════════════════════════════════════════════════════════════════
//  PROFIL D'ENTREPRISE ET FACTURES — LA RÈGLE PARTAGÉE ET LA VRAIE ROUTE
//        node scripts/audit-facturation.cjs [--src dossier]
// ════════════════════════════════════════════════════════════════════════════
// Julien, 15 octobre : « pour les factures, il va falloir faire ça parfaitement ».
// Ce que ce contrôle exige — en EXÉCUTANT le code, jamais en lisant son texte :
//
//  A. La règle (api/_lib/facturation.js, lue par l'app ET le serveur) :
//     · SIREN / SIRET / n° de TVA vérifiés par leur clé — et RIEN déduit du
//       SIREN (ni forme, ni TVA, ni marge, ni versement libératoire) ;
//     · la mention suit le régime DÉCLARÉ : 293 B en franchise, « Régime
//       particulier – Biens d'occasion » et AUCUNE TVA affichée au régime de la
//       marge, HT/TVA/TTC sinon ;
//     · chaque règle affichée porte une source et une date ;
//     · un numéro n'est donné qu'une fois, sans trou, et jamais sur une liste
//       qu'on n'a pas pu lire ; un document réécrit ne passe plus pour intact.
//
//  B. La route `api/email-inbound` (facture Pro préparée à l'arrivée d'une
//     vente), dans une fausse base À ÉTAT — boîte noire, les mêmes contrôles
//     tournent sur le code d'avant :
//     · un email REJOUÉ ne change ni le numéro, ni l'état d'une facture déjà
//       envoyée (avant : nouveau numéro, et « à envoyer » de nouveau) ;
//     · une lecture ratée n'émet RIEN et répond 503 (avant : le compteur
//       illisible redonnait le n° 1) ;
//     · deux sources (l'app, le serveur) partagent UNE suite ;
//     · un numéro pris entre la lecture et l'écriture n'est jamais écrasé ;
//     · au régime de la marge, la facture n'affiche aucune TVA.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 200)); } };
const HTML522 = '<!DOCTYPE html><html><head><title>522: Connection timed out</title></head><body>Connection timed out</body></html>';

(async () => {
  const FACT_PATH = path.join(RACINE, 'api', '_lib', 'facturation.js');
  let F = null;
  await essaie('le module de facturation se charge', async () => {
    dit(fs.existsSync(FACT_PATH), 'la règle partagée existe (api/_lib/facturation.js)');
    if (fs.existsSync(FACT_PATH)) F = await import('file://' + FACT_PATH);
  });

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n── A. LA RÈGLE');
  await essaie('SIREN', async () => {
    dit(F.etatSiren('123456782') === 'ok' && F.etatSiren('123 456 782') === 'ok', 'un SIREN dont la clé est juste est reconnu (espaces admis)');
    dit(F.etatSiren('123456789') === 'cle', 'une faute de frappe (clé de Luhn fausse) est signalée', F.etatSiren('123456789'));
    dit(F.etatSiren('12345') === 'format' && F.etatSiren('') === 'vide', 'un SIREN incomplet n\'est pas pris pour un SIREN');
    dit(F.etatSiret('12345678200002', '123456782') === 'ok', 'un SIRET juste est reconnu');
    dit(F.etatSiret('98765432400003', '123456782') === 'autre_siren', 'un SIRET d\'une autre entreprise est signalé', F.etatSiret('98765432400003', '123456782'));
    dit(F.etatSiret('35600000000001', '356000000') === 'ok' && F.etatSiret('35600000000002', '356000000') === 'cle', 'l\'exception de La Poste (somme multiple de 5) est tenue');
    dit(F.tvaIntraDuSiren('123456782') === 'FR11123456782', 'le n° de TVA se calcule depuis le SIREN', F.tvaIntraDuSiren('123456782'));
    dit(F.etatTvaIntra('FR12123456782', '123456782') === 'cle', 'un n° de TVA à la clé fausse est signalé');
  });
  await essaie('rien n\'est déduit du SIREN', async () => {
    const p = F.normProfil({ siren: '123456782', nom: 'X' });
    dit(p.forme === '' && p.tva === '' && p.marge === null && p.vl === null, 'un SIREN valide ne décide NI la forme, NI la TVA, NI la marge, NI le versement libératoire',
      JSON.stringify({ forme: p.forme, tva: p.tva, marge: p.marge, vl: p.vl }));
    const a = F.normProfil({}, { regime: 'micro' });
    dit(a.forme === 'micro' && a.tva === '', 'l\'ancien choix « micro » garde la forme, et la TVA reste à préciser (l\'ancien « pas de TVA » était une phrase de l\'app)', `tva=${JSON.stringify(a.tva)}`);
    const m = F.normProfil({}, { regime: 'marge' });
    dit(m.forme === 'societe' && m.tva === 'assujetti' && m.marge === true, 'l\'ancien choix explicite « société au régime de la marge » est repris tel quel');
    dit(F.lienAnnuaire('123456782').startsWith('https://annuaire-entreprises.data.gouv.fr/') && F.lienAnnuaire('123') === '',
      'la consultation publique est un LIEN vers le site de l\'État, seulement pour un SIREN valide');
  });
  const base = { siren: '123456782', nom: 'Julie Test', adresse: '1 rue de la Mer', cp: '35260', ville: 'Cancale' };
  const franchise = () => F.normProfil({ ...base, forme: 'micro', tva: 'franchise' });
  const marge = () => F.normProfil({ ...base, forme: 'societe', tva: 'assujetti', marge: true, tvaIntra: 'FR11123456782', formeJuridique: 'SAS', capital: '1000', rcs: 'Saint-Malo' });
  const normale = () => F.normProfil({ ...base, forme: 'ei_reel', tva: 'assujetti', marge: false, tvaIntra: 'FR11123456782' });
  await essaie('mentions et montants', async () => {
    dit(JSON.stringify(F.mentionsLegales(franchise())) === JSON.stringify(['TVA non applicable, art. 293 B du CGI']), 'franchise : « TVA non applicable, art. 293 B du CGI »');
    const mm = F.mentionsLegales(marge());
    dit(mm.length === 1 && /Régime particulier – Biens d'occasion/.test(mm[0]) && !mm.some((x) => /293 B/.test(x)), 'marge : « Régime particulier – Biens d\'occasion », jamais la mention 293 B', JSON.stringify(mm));
    dit(F.mentionsLegales(normale()).length === 0, 'TVA facturée hors marge : aucune mention d\'exonération');
    const mt = F.montantsDocument(5400, normale(), 20);
    dit(mt && mt.htC === 4500 && mt.tvaC === 900 && mt.ttcC === 5400, 'TVA 20 % sur 54,00 € : HT 45,00 + TVA 9,00 = 54,00 (centimes entiers, un arrondi)', JSON.stringify(mt));
    const mg = F.montantsDocument(5400, marge(), 20);
    dit(mg && mg.htC === null && mg.tvaC === null && mg.ttcC === 5400, 'marge : aucun montant de TVA n\'existe sur la facture', JSON.stringify(mg));
    dit(F.montantsDocument(5400, normale(), null) === null, 'TVA facturée sans taux choisi : pas de montant inventé (20 % n\'est pas supposé)');
    dit(F.nomVendeur(franchise()) === 'Julie Test EI' && F.nomVendeur(F.normProfil({ ...base, nom: 'EI Julie', forme: 'micro' })) === 'EI Julie', 'un entrepreneur individuel porte « EI », une seule fois');
  });
  await essaie('règles datées et sourcées', async () => {
    for (const [nom, p] of [['franchise', franchise()], ['marge', marge()], ['normale', normale()], ['vl', F.normProfil({ ...base, forme: 'micro', tva: 'franchise', vl: true })]]) {
      const r = F.reglesDuProfil(p, { tauxUrssaf: 13.5 });
      const sans = r.filter((x) => !x.source || !/^\d{4}-\d{2}-\d{2}$/.test(x.verifieLe || ''));
      dit(r.length > 0 && sans.length === 0, `profil ${nom} : ${r.length} règles, chacune avec sa source et sa date`, sans.map((x) => x.id).join(','));
    }
    const ids = (p) => F.reglesDuProfil(p, { tauxUrssaf: 13.5 }).map((x) => x.id);
    dit(!ids(F.normProfil({ ...base, forme: 'micro', tva: 'franchise', vl: false })).includes('vl') && ids(F.normProfil({ ...base, forme: 'micro', tva: 'franchise', vl: true })).includes('vl'),
      'le versement libératoire n\'est dit QUE s\'il l\'a déclaré');
    dit(!ids(marge()).includes('urssaf') && ids(marge()).includes('reel'), 'une société ne reçoit aucune règle URSSAF de micro-entreprise');
    dit(!ids(franchise()).some((x) => /^marge/.test(x)), 'une franchise ne reçoit aucune règle de marge');
  });
  await essaie('un profil incomplet n\'émet rien', async () => {
    const vide = F.normProfil({ siren: '123456782', nom: 'X' });
    const m = F.manquePourFacturer(vide);
    dit(m.length >= 3, 'il manque la forme, la TVA, l\'adresse…', m.join(' · '));
    const { doc } = F.construireDocument({ profil: vide, annee: 2026, rang: 1, emiseLe: new Date().toISOString(), ttcC: 4200, designation: 'Paire' });
    dit(doc === null, 'et aucun document n\'est construit (une mention fausse sur un document légal est pire qu\'un bouton grisé)');
    dit(F.manquePourFacturer(franchise()).length === 0 && F.manquePourFacturer(marge()).length === 0 && F.manquePourFacturer(normale(), { tauxTva: 20 }).length === 0,
      'les trois profils complets peuvent émettre');
  });
  await essaie('numérotation et empreinte', async () => {
    dit(F.prochainRang(['facture_2026_000001', 'facture_2026_000002', 'facture_2025_000009'], 2026) === 3, 'le rang suivant se lit dans l\'année, à la suite du dernier');
    dit(F.continuite(['facture_2026_000001', 'facture_2026_000003'])[0].manquants.join() === '2', 'un trou dans la suite est vu et nommé');
    const { doc } = F.construireDocument({ profil: franchise(), annee: 2026, rang: 1, emiseLe: '2026-10-15T10:00:00.000Z', ttcC: 4200, designation: 'Paire', client: { nom: 'A' } });
    doc.empreinte = await F.empreinte(doc);
    dit(await F.empreinteIntacte(doc) === true, 'un document émis est « intact »');
    dit(await F.empreinteIntacte({ ...doc, _id: 'facture_2026_000001' }) === true, 'la marque d\'un lecteur (`_id`) ne le fait pas passer pour modifié (vu au rendu : fausse alerte)');
    const re = { ...doc, ttcC: 100 };
    dit(await F.empreinteIntacte(re) === false, 'un montant réécrit en base ne passe plus pour intact');
  });
  await essaie('la boucle d\'émission', async () => {
    const store = new Set();
    const lire = async (a) => [...store].filter((id) => id.startsWith(`facture_${a}_`));
    const inserer = async (id) => { if (store.has(id)) return 'pris'; store.add(id); return 'ok'; };
    const prep = async (rang) => ({ numero: F.numeroDocument(2026, rang), jeton: 'j' + rang });
    const r1 = await F.emettre({ annee: 2026, preparer: prep, lireIds: lire, inserer });
    const r2 = await F.emettre({ annee: 2026, preparer: prep, lireIds: lire, inserer });
    dit(r1.ok && r2.ok && r1.doc.numero === '2026-000001' && r2.doc.numero === '2026-000002', 'deux émissions : n° 1 puis n° 2');
    // Un autre appareil prend le n° 3 ENTRE la lecture et l'écriture.
    let premier = true;
    const course = async (id) => { if (premier) { premier = false; store.add(id); return 'pris'; } return inserer(id); };
    const r3 = await F.emettre({ annee: 2026, preparer: prep, lireIds: lire, inserer: course });
    dit(r3.ok && r3.doc.numero === '2026-000004', 'un numéro pris entre-temps n\'est pas réutilisé : la boucle prend le suivant', r3.doc && r3.doc.numero);
    let ecrits = 0;
    const r4 = await F.emettre({ annee: 2026, preparer: prep, lireIds: async () => null, inserer: async () => { ecrits++; return 'ok'; } });
    dit(!r4.ok && r4.raison === 'lecture' && ecrits === 0, 'liste des factures illisible : rien n\'est émis (pas su ≠ aucune)', JSON.stringify(r4));
    let essais = 0;
    const r5 = await F.emettre({ annee: 2026, preparer: prep, lireIds: lire, inserer: async () => { essais++; return 'incertain'; }, trouverParJeton: async () => ({ numero: 'trouvé' }) });
    dit(r5.ok && essais === 1 && r5.doc.numero === 'trouvé', 'écriture sans réponse puis retrouvée par son jeton : une seule écriture');
    const r6 = await F.emettre({ annee: 2026, preparer: prep, lireIds: lire, inserer: async () => 'incertain', trouverParJeton: async () => null });
    dit(!r6.ok && r6.raison === 'incertain', 'écriture sans réponse et jeton illisible : on s\'arrête (jamais un second essai à l\'aveugle)');
  });
  // (relecture du 16 octobre) Les règles ajoutées après la revue du lot.
  await essaie('un jeton STABLE n\'émet jamais deux fois', async () => {
    // Le jeton est posé PAR L'APPELANT (le formulaire, la réclamation du
    // serveur) : un document déjà écrit sous ce jeton EST l'émission — le
    // second clic (ou le second traitement du même email) le retrouve.
    const docs = new Map();      // jeton → doc écrit
    const store = new Set();
    const lire = async (a) => [...store].filter((id) => id.startsWith(`facture_${a}_`));
    const prep = (jeton) => async (rang) => { const d = { numero: F.numeroDocument(2026, rang), jeton }; return d; };
    const insererEtRetenir = async (id, doc) => { if (store.has(id)) return 'pris'; store.add(id); docs.set(doc.jeton, doc); return 'ok'; };
    const parJeton = async (j) => (docs.has(j) ? docs.get(j) : false);
    const a1 = await F.emettre({ annee: 2026, jeton: 'stable1', preparer: prep('stable1'), lireIds: lire, inserer: insererEtRetenir, trouverParJeton: parJeton });
    const a2 = await F.emettre({ annee: 2026, jeton: 'stable1', preparer: prep('stable1'), lireIds: lire, inserer: insererEtRetenir, trouverParJeton: parJeton });
    dit(a1.ok && a2.ok && a2.deja === true && a2.doc.numero === a1.doc.numero && store.size === 1,
      'le même jeton rejoué rend le document DÉJÀ écrit (`deja`), jamais un deuxième', JSON.stringify({ n1: a1.doc && a1.doc.numero, n2: a2.doc && a2.doc.numero, ecrits: store.size }));
    const a3 = await F.emettre({ annee: 2026, jeton: 'stable2', preparer: prep('stable2'), lireIds: lire, inserer: insererEtRetenir, trouverParJeton: async () => null });
    dit(!a3.ok && a3.raison === 'lecture' && store.size === 1, 'jeton illisible AVANT d\'émettre : rien n\'est écrit (pas su ≠ absent)', JSON.stringify(a3));
  });
  await essaie('les anciens numéros ne se redonnent jamais', async () => {
    dit(F.prochainRang([], 2026, F.rangsReserves([{ number: '2026-000001' }, { number: '2026-000002' }], 2026)) === 3,
      'une suite neuve continue APRÈS les anciennes factures de l\'année (2026-000001/2 ⇒ n° 3)');
    dit(F.rangsReserves([{ number: '2025-000009' }, { number: 'FA-2026-0007' }, { number: '' }], 2026).length === 0,
      'une ancienne facture d\'une autre année, ou à numéro libre, ne réserve rien');
  });
  await essaie('le client est une mention de la facture', async () => {
    const { doc, erreurs } = F.construireDocument({ type: 'facture', profil: franchise(), annee: 2026, rang: 1, emiseLe: '2026-10-16T10:00:00.000Z', ttcC: 4200, designation: 'Paire', client: { nom: '', email: '', adresse: '' } });
    dit(doc === null && erreurs.includes('client'), 'une facture SANS nom ni email de client ne se construit pas (elle imprimait « Client » à la place du nom)', erreurs.join(','));
    const ok1 = F.construireDocument({ type: 'facture', profil: franchise(), annee: 2026, rang: 1, emiseLe: '2026-10-16T10:00:00.000Z', ttcC: 4200, designation: 'Paire', client: { email: 'c@exemple.test' } });
    dit(!!ok1.doc, 'un email de client suffit (les ventes Pro par email n\'ont pas toujours le nom)');
    const av = F.construireDocument({ type: 'avoir', profil: franchise(), annee: 2026, rang: 2, emiseLe: '2026-10-16T10:00:00.000Z', ttcC: 4200, designation: 'Paire', origineNumero: '2026-000001', client: {} });
    dit(!!av.doc, 'un avoir copie le client de SA facture : il n\'est pas bloqué par un client vide d\'avant la règle');
    const html = F.corpsHtmlDocument({ type: 'facture', numero: '2026-000001', jour: '2026-10-16', mode: 'franchise', ttcC: 4200, vendeur: { nom: 'X', siren: '123456782' }, client: {}, lignes: [{ designation: 'Paire', ttcC: 4200 }], mentions: [] });
    dit(!/Client<\/div><b>Client</.test(html.replace(/\s|style="[^"]*"/g, '')) && /non renseigné/.test(html),
      'un document d\'AVANT la règle n\'imprime plus « Client Client » : « (non renseigné) »');
  });
  await essaie('le suffixe « EI » ne se double jamais', async () => {
    const p = (nom) => F.normProfil({ ...base, nom, forme: 'micro' });
    dit(F.nomVendeur(p('Julie Exemple (EI)')) === 'Julie Exemple (EI)', '« (EI) » déjà écrit : aucun « EI » ajouté', F.nomVendeur(p('Julie Exemple (EI)')));
    dit(F.nomVendeur(p('Julie Exemple EI.')) === 'Julie Exemple EI.', '« EI. » déjà écrit : aucun « EI » ajouté', F.nomVendeur(p('Julie Exemple EI.')));
    dit(F.nomVendeur(p('Julie Exemple')) === 'Julie Exemple EI', 'et sans « EI », le suffixe reste ajouté (l\'autre sens)');
  });
  await essaie('le régime effectif et les coordonnées', async () => {
    dit(F.regimeEffectif(null, null) === 'micro' && F.regimeEffectif(null, 'micro') === 'micro', 'pas de profil déclaré ⇒ micro (le comportement d\'avant, rien ne change en silence)');
    dit(F.regimeEffectif({ forme: 'societe', tva: 'assujetti', marge: false }, null) === 'reel' && F.regimeEffectif(null, 'reel') === 'reel' && F.regimeEffectif(null, 'marge') === 'marge',
      'société/EI au réel ⇒ « reel », même si seul le réglage publié est lisible');
    const det = F.manquePourFacturerDetaille(F.normProfil({ siren: '123456782' }));
    const coords = det.filter((x) => x.coord).map((x) => x.texte);
    const choix = det.filter((x) => !x.coord).map((x) => x.texte);
    dit(choix.some((t) => /régime de TVA/.test(t)) && choix.some((t) => /forme d'entreprise/.test(t)) && !coords.some((t) => /régime de TVA/.test(t)),
      'le régime de TVA et la forme ne comptent pas comme des COORDONNÉES (l\'en-tête « N à compléter » ne les compte plus)', JSON.stringify({ coords, choix }));
    dit(JSON.stringify(det.map((x) => x.texte)) === JSON.stringify(F.manquePourFacturer(F.normProfil({ siren: '123456782' }))),
      'et la liste détaillée dit EXACTEMENT les mêmes manques que la liste plate (§11)');
  });

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n── B. LA ROUTE api/email-inbound (facture Pro, boîte noire)');
  // Une fausse base À ÉTAT : lectures `id=eq` / `id=like` / `meta->>` (→ data),
  // projection `select=`, pages `Range`, écritures `merge-duplicates`
  // (remplace) ou `ignore-duplicates` (n'écrit que si absent).
  const store = new Map();
  let echecs = [];            // motifs d'URL dont la LECTURE échoue (522)
  let avantInsertion = null;  // simule un autre appareil qui prend un numéro
  const projeter = (row, select) => {
    if (!select || select === '*') return row;
    const out = {};
    for (const part of select.split(',')) {
      const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
      const src = m[2]; const alias = m[1] || src.split(/->>|->/).pop();
      if (src === 'id' || src === 'owner') { out[alias] = row[src]; continue; }
      if (src === 'data') { out[alias] = row.data; continue; }
      if (/^(data|meta)(->|->>)/.test(src)) {
        let v = row.data;
        for (const seg of src.replace(/^(data|meta)(->>|->)/, '').split(/->>|->/)) v = (v == null ? null : v[seg]);
        out[alias] = v == null ? null : ((/->>[^>]*$/.test(src) && typeof v === 'object') ? JSON.stringify(v) : v); continue;
      }
      out[alias] = row[src];
    }
    return out;
  };
  const filtrer = (q) => {
    let rows = [...store.values()];
    const eq = /(?:^|&)id=eq\.([^&]*)/.exec(q); if (eq) rows = rows.filter((r) => r.id === decodeURIComponent(eq[1]));
    const like = /(?:^|&)id=like\.([^&]*)/.exec(q);
    if (like) { const re = new RegExp('^' + decodeURIComponent(like[1]).replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); rows = rows.filter((r) => re.test(r.id)); }
    for (const m of q.matchAll(/(?:^|&)(?:meta|data)->>([A-Za-z_]+)=eq\.([^&]*)/g)) {
      const k = m[1], v = decodeURIComponent(m[2]);
      rows = rows.filter((r) => r.data && r.data[k] != null && String(r.data[k]) === v);
    }
    return rows.sort((a, b) => a.id.localeCompare(b.id));
  };
  const ecritures = [];
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    const meth = (opts.method || 'GET').toUpperCase();
    if (!u.includes('/rest/v1/')) return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    if (/select=owner/.test(u)) return new Response('{"code":"42703"}', { status: 400, headers: { 'content-type': 'application/json' } });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    const q = u.split('?')[1] || '';
    if (meth === 'GET') {
      if (echecs.some((re) => re.test(u))) return new Response(HTML522, { status: 522, headers: { 'content-type': 'text/html' } });
      const sel = (/(?:^|&)select=([^&]*)/.exec(q) || [])[1];
      let rows = filtrer(q).map((r) => projeter(r, sel));
      const rg = opts.headers && (opts.headers.Range || opts.headers.range);
      if (rg) { const m = /(\d+)-(\d+)/.exec(rg); if (m) rows = rows.slice(Number(m[1]), Number(m[2]) + 1); }
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (meth === 'POST') {
      const prefer = String((opts.headers && (opts.headers.Prefer || opts.headers.prefer)) || '');
      const lot = JSON.parse(opts.body || '[]');
      const ignore = /ignore-duplicates/.test(prefer);
      const rendus = [];
      for (const r of lot) {
        if (ignore && avantInsertion) avantInsertion(r.id);
        ecritures.push({ id: r.id, ignore });
        if (ignore && store.has(r.id)) continue;
        store.set(r.id, { id: r.id, data: r.data });
        rendus.push(r);
      }
      return new Response(/return=representation/.test(prefer) ? JSON.stringify(rendus) : '', { status: 201, headers: { 'content-type': 'application/json' } });
    }
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };
  const EMAIL = (pseudo, article, prix) => ({
    from: 'no-reply@vinted.fr', to: 'recu@exemple.test', subject: 'Ton article est vendu !',
    text: `${pseudo} a acheté [${article}] ${prix} €\nAdresse : Jean Martin, 1 rue de la Paix, 35260 Cancale\nAdresse e-mail : client@exemple.test\nPrépare ton colis.`,
    html: '<p>Ton article est vendu</p>', attachments: [],
  });
  const poserBase = (profil, tva) => {
    store.clear(); echecs = []; avantInsertion = null; ecritures.length = 0;
    store.set('main', { id: 'main', data: { vrm_profil_entreprise: profil, vinted_regime: profil ? (profil.forme === 'micro' ? 'micro' : (profil.marge ? 'marge' : 'reel')) : 'micro', ...(tva != null ? { vinted_tva: tva } : {}) } });
    // `tauxTva` à 20 dans la facturation Pro : c'est ce qui faisait afficher
    // « TVA 20 % » au régime de la marge sur le code d'avant.
    store.set('vrm_pro_facture', { id: 'vrm_pro_facture', data: { actif: true, autoSend: false, prefixe: 'FA', tauxTva: profil && profil.tva === 'assujetti' ? '20' : '0', mentions: '', logo: '', nom: 'Julie Test' } });
  };
  const factures = () => [...store.keys()].filter((k) => /^facture_\d{4}_\d{6}$/.test(k)).sort();
  const envois = () => [...store.entries()].filter(([k]) => /^email_invoice_/.test(k)).map(([, v]) => v.data);
  const tout = () => [...factures().map((k) => store.get(k).data), ...envois()];
  let inbound = null;
  await essaie('la route se charge', async () => { inbound = await import('file://' + path.join(RACINE, 'api', 'email-inbound.js')); dit(!!inbound.default, 'la route se charge'); });
  const envoyer = async (mail) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, body: JSON.parse(JSON.stringify(mail)) }, res); return res; };
  const PF = { forme: 'micro', tva: 'franchise', marge: null, vl: false, ...base };
  // L'année À PARIS, calculée ici (pas par le module) : la partie B tourne aussi
  // sur le code d'avant, qui n'a pas ce module.
  const anneeP = () => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric' }).format(new Date()));

  await essaie('B1 — une vente Pro : une facture, dans la suite, avec la bonne mention', async () => {
    poserBase(PF);
    const r = await envoyer(EMAIL('acheteuse1', 'Nike Air Max', '42,00'));
    dit(r.code === 200, 'la route répond 200', `HTTP ${r.code}`);
    const f = factures();
    dit(f.length === 1 && f[0].endsWith('_000001'), 'un document figé est émis dans la suite (facture_AAAA_000001)', f.join(','));
    const e = envois();
    dit(e.length === 1 && f.length === 1 && e[0].number === store.get(f[0]).data.numero, 'la ligne d\'envoi porte le MÊME numéro que le document', e.map((x) => x.number).join(','));
    dit(e.length === 1 && /TVA non applicable.{1,4}art\.? ?293 ?B/.test(e[0].html || ''), 'franchise : la mention 293 B est sur la facture envoyée');
  });
  await essaie('B2 — le même email REJOUÉ trois fois', async () => {
    const avant = envois()[0] || {};
    const id = [...store.keys()].find((k) => /^email_invoice_/.test(k));
    if (id) store.get(id).data = { ...store.get(id).data, status: 'sent', sentAt: '2026-10-15T09:00:00.000Z' };
    for (let i = 0; i < 3; i++) await envoyer(EMAIL('acheteuse1', 'Nike Air Max', '42,00'));
    const apres = id ? store.get(id).data : {};
    dit(apres.number === avant.number, 'le numéro ne change pas au rejeu (un trou dans la suite sinon)', `${avant.number} → ${apres.number}`);
    dit(apres.status === 'sent', 'une facture DÉJÀ ENVOYÉE n\'est pas remise « à envoyer » (elle repartirait chez l\'acheteur)', `état : ${apres.status}`);
    dit(factures().length <= 1, 'et aucun second document n\'est émis', factures().join(','));
  });
  await essaie('B3 — l\'app et le serveur partagent UNE suite', async () => {
    // Une facture émise depuis l'app occupe le n° 2.
    const an = anneeP();
    store.set(`facture_${an}_000002`, { id: `facture_${an}_000002`, data: { type: 'facture', numero: `${an}-000002`, creeVia: 'app', jeton: 'app' } });
    await envoyer(EMAIL('acheteuse2', 'Adidas Samba', '55,00'));
    const e = envois().map((x) => x.number).filter(Boolean).sort();
    dit(e.includes(`${an}-000003`), 'la vente suivante prend le n° 3, après la facture de l\'app', e.join(','));
    dit(store.get(`facture_${an}_000002`).data.creeVia === 'app', 'et la facture de l\'app n\'est pas touchée');
  });
  await essaie('B4 — un autre appareil prend le numéro entre la lecture et l\'écriture', async () => {
    const an = anneeP();
    let fait = false;
    avantInsertion = (id) => { if (!fait && /^facture_/.test(id)) { fait = true; store.set(id, { id, data: { type: 'facture', numero: 'AUTRE', creeVia: 'app', jeton: 'autre' } }); } };
    await envoyer(EMAIL('acheteuse3', 'Asics Gel', '60,00'));
    avantInsertion = null;
    const pris = store.get(`facture_${an}_000004`);
    dit(pris && pris.data.numero === 'AUTRE', 'le document de l\'autre appareil n\'est PAS écrasé', pris ? pris.data.numero : 'absent');
    const e = envois().map((x) => x.number);
    dit(e.includes(`${an}-000005`) && !e.includes(`${an}-000004`), 'la facture prend le numéro suivant, libre', e.join(','));
  });
  await essaie('B5 — la base ne répond pas sur les factures (lecture ratée)', async () => {
    poserBase(PF);
    echecs = [/facture_/, /vrm_invoice_counter/];
    const r = await envoyer(EMAIL('acheteuse4', 'Puma Suede', '38,00'));
    dit(tout().length === 0, 'aucune facture n\'est émise sur une liste illisible (avant : le compteur illisible redonnait le n° 1)',
      tout().map((x) => x.number || x.numero).join(','));
    dit(r.code >= 500, 'et la route répond 503 : l\'email sera rejoué, la facture partira au passage suivant', `HTTP ${r.code}`);
  });
  await essaie('B6 — profil incomplet (pas de SIREN) : le geste, pas une facture fausse', async () => {
    poserBase({ forme: 'micro', tva: 'franchise', nom: 'Julie Test', adresse: '1 rue', cp: '35260', ville: 'Cancale' });
    const r = await envoyer(EMAIL('acheteuse5', 'New Balance', '70,00'));
    // (16 octobre) La vente n'est plus perdue : sa ligne d'envoi est GARDÉE en
    // « profil » — mais toujours AUCUNE facture, aucun numéro (voir B9).
    dit(factures().length === 0 && envois().every((e) => e.status === 'profil' && !e.number), 'aucune facture émise sans SIREN (la vente est gardée, sans numéro)', tout().map((x) => x.number || x.numero || x.status).join(','));
    dit(r.code === 200, 'et la route ne fait pas rejouer l\'email pour rien (200)', `HTTP ${r.code}`);
  });
  await essaie('B7 — société au régime de la marge', async () => {
    poserBase({ forme: 'societe', tva: 'assujetti', marge: true, vl: null, tvaIntra: 'FR11123456782', formeJuridique: 'SAS', capital: '1000', rcs: 'Saint-Malo', ...base }, 20);
    await envoyer(EMAIL('acheteuse6', 'Salomon XT-6', '99,00'));
    const h = (envois()[0] || {}).html || '';
    dit(/Régime particulier – Biens d(?:'|&#39;|&apos;)occasion/.test(h), 'la facture porte « Régime particulier – Biens d\'occasion »', h ? '' : 'aucune facture');
    dit(h && !/TVA\s*20\s*%/.test(h) && !/293 B/.test(h), 'et n\'affiche ni TVA ni la mention de franchise (art. 297 E)', /TVA\s*20\s*%/.test(h) ? 'TVA 20 % affichée' : /293 B/.test(h) ? 'mention 293 B' : '');
  });

  await essaie('B8 — le même email traité deux fois EN MÊME TEMPS (16 octobre)', async () => {
    // Reproduit par la relecture : `Promise.all` sur le même email émettait
    // DEUX factures pour une vente (le contrôle par sourceId ne protège que des
    // rejeux successifs). La réclamation `source_facture_{key}` est atomique
    // (`ignore-duplicates`) : UN traitement émet, l'autre répond 503 (rejoué,
    // il retrouvera la facture par sa source) — jamais un second document.
    poserBase(PF);
    const E = EMAIL('acheteuse7', 'Salomon XT-6', '99,00');
    const [a, bq] = await Promise.all([envoyer(E), envoyer(E)]);
    const f = factures();
    dit(f.length === 1, 'UN seul document émis pour les deux traitements simultanés', JSON.stringify(f));
    dit([a.code, bq.code].filter((c) => c === 200).length >= 1 && [a.code, bq.code].every((c) => c === 200 || c >= 500),
      'une réponse 200 (la facture), l\'autre 200 ou 5xx (rejouée) — jamais deux 200 avec deux documents', `${a.code} / ${bq.code}`);
    const e = envois();
    dit(e.length === 1 && e[0].number === store.get(f[0]).data.numero, 'une seule ligne d\'envoi, qui pointe la facture émise');
    // Et un REJEU après coup retrouve la même facture (rien de neuf).
    await envoyer(E);
    dit(factures().length === 1, 'un rejeu tardif ne crée toujours rien', factures().join(','));
  });
  await essaie('B9 — vente arrivée profil incomplet : GARDÉE, puis facturée (16 octobre)', async () => {
    // Reproduit par la relecture : la vente « New Balance » reçue sans SIREN
    // n'était JAMAIS facturée, même une fois le profil complété — et la
    // notification laissait croire le contraire. Elle est maintenant GARDÉE
    // dans sa ligne d'envoi (status 'profil') : l'app l'émet d'un clic (banc
    // fiscal.cjs, section L), et un rejeu de l'email l'émet aussi.
    poserBase({ forme: 'micro', tva: 'franchise', nom: 'Julie Test', adresse: '1 rue', cp: '35260', ville: 'Cancale' });
    const E = EMAIL('acheteuse8', 'New Balance 990', '70,00');
    const r1 = await envoyer(E);
    dit(r1.code === 200 && factures().length === 0, 'sans SIREN : aucune facture (rien d\'inventé), et pas de rejeu forcé', `HTTP ${r1.code}`);
    const attente = envois()[0];
    dit(!!attente && attente.status === 'profil' && !attente.number && attente.sourceId && attente.buyerEmail === 'client@exemple.test',
      'la vente est GARDÉE : ligne d\'envoi « profil », avec la vente (acheteur, source) et SANS numéro', JSON.stringify(attente && { status: attente.status, src: !!attente.sourceId }));
    // Le profil est complété, l'email revient (fil renvoyé par le script Gmail).
    const m = store.get('main'); m.data = { ...m.data, vrm_profil_entreprise: { ...m.data.vrm_profil_entreprise, siren: '123456782' } };
    await envoyer(E);
    const f = factures();
    const ligne = envois()[0];
    dit(f.length === 1 && ligne && ligne.status !== 'profil' && ligne.number === store.get(f[0]).data.numero,
      'au rejeu, SA facture est émise et la ligne d\'envoi devient réelle (numéro + état d\'envoi)', JSON.stringify({ f, status: ligne && ligne.status, n: ligne && ligne.number }));
    await envoyer(E);
    dit(factures().length === 1, 'et un troisième passage ne crée rien de plus');
  });
  await essaie('B10 — les anciens numéros (`vinted_invoices`) jamais redonnés par le serveur', async () => {
    poserBase(PF);
    const an = anneeP();
    const m = store.get('main');
    m.data = { ...m.data, vinted_invoices: [{ id: 'inv_1', number: `${an}-000001`, itemName: 'Ancienne A', sellPrice: 40 }, { id: 'inv_2', number: `${an}-000002`, itemName: 'Ancienne B', sellPrice: 55 }] };
    await envoyer(EMAIL('acheteuse9', 'Puma Palermo', '45,00'));
    const f = factures();
    dit(f.length === 1 && f[0] === `facture_${an}_000003`, 'la facture Pro prend le n° 3 — jamais un numéro qu\'une ancienne facture de l\'année porte (même règle que l\'app, §11)', f.join(','));
  });

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n── C. LE RAPPEL URSSAF DU 1ᵉʳ (api/ship-reminders) SUIT LE RÉGIME');
  // Reproduit par la relecture du 16 octobre : « pense à déclarer ton chiffre
  // d'affaires sur autoentrepreneur.urssaf.fr » partait chez une SOCIÉTÉ au
  // réel. La route est EXÉCUTÉE (pas relue), la date forcée au 1ᵉʳ du mois.
  await essaie('C — le rappel URSSAF suit le régime', async () => {
    const VraieDate = Date;
    const FIXE = VraieDate.parse('2026-11-01T08:00:00Z');
    // eslint-disable-next-line no-global-assign
    global.Date = class extends VraieDate { constructor(...a) { if (a.length === 0) super(FIXE); else super(...a); } static now() { return FIXE; } };
    try {
      const faireRappel = async ({ main, mainKO }) => {
        const ecrits = []; let pushes = 0;
        global.fetch = async (url, opts = {}) => {
          const u = String(url);
          const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
          if (/^https:\/\/push\//.test(u)) { pushes++; return new Response('', { status: 201 }); }
          if ((opts.method || 'GET') === 'POST') { try { JSON.parse(opts.body || '[]').forEach((r) => ecrits.push(r.id)); } catch (_) {} return new Response('', { status: 201 }); }
          if (/select=owner&limit=1/.test(u)) return J([{ owner: 'A' }]);
          if (/id=eq\.main/.test(u) && /select=owner/.test(u) && !/owner=eq\./.test(u)) return J([{ owner: 'A' }]);
          if (/id=eq\.main/.test(u) && mainKO) return new Response(HTML522, { status: 522, headers: { 'content-type': 'text/html' } });
          if (/id=eq\.main/.test(u)) return J([{ data: main }]);
          if (/id=eq\.push_prefs/.test(u)) return J([{ data: { urssaf: true } }]);
          if (/id=eq\.push_subs/.test(u)) return J([{ data: { subs: [{ endpoint: 'https://push/A1' }] } }]);
          if (/urssaf_reminder_dedup|ship_reminder_dedup|panel_bords_done/.test(u)) return J([{ data: {} }]);
          return J([]);
        };
        const mod = await import('file://' + path.join(RACINE, 'api', 'ship-reminders.js'));
        const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
        await mod.default({ method: 'GET', headers: {}, query: {} }, res);
        const bilan = (res.corps && res.corps.bilans && res.corps.bilans[0]) || res.corps || {};
        return { urssaf: bilan.urssaf, dedup: ecrits.includes('urssaf_reminder_dedup'), pushes };
      };
      // (les octets de la notification passent par web-push, absent de ce
      // harnais sans clés VAPID : le verdict est `urssaf` + le mémo, pas
      // l'aller réseau.)
      const micro = await faireRappel({ main: { vinted_regime: 'micro' } });
      dit(micro.urssaf === 'envoyé' && micro.dedup, 'micro (ou rien de déclaré) : le rappel part, le mémo est écrit — rien ne s\'éteint en silence', JSON.stringify(micro));
      const soc = await faireRappel({ main: { vinted_regime: 'reel', vrm_profil_entreprise: { v: 1, forme: 'societe', tva: 'assujetti', marge: false, siren: '123456782', nom: 'Exemple SAS' } } });
      dit(/pas une micro/.test(String(soc.urssaf)) && !soc.dedup && soc.pushes === 0, 'société au réel : AUCUN rappel « déclare sur autoentrepreneur.urssaf.fr », aucun mémo', JSON.stringify(soc));
      const ko2 = await faireRappel({ main: null, mainKO: true });
      dit(/pas lu/.test(String(ko2.urssaf)) && !ko2.dedup && ko2.pushes === 0, 'profil illisible : on se tait (envoyer le MAUVAIS geste à une société coûte plus qu\'un rappel manqué)', JSON.stringify(ko2));
    } finally { global.Date = VraieDate; }
  });

  console.log(ko ? `\n❌ audit-facturation : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-facturation : ${ok} contrôles — profil et factures tenus`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ audit-facturation est tombé :', e && e.message); process.exit(1); });
