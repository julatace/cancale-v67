// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : SÉANCE PHOTO, NOTE VOCALE, CERTIFICAT (14 nov., propositions 103, 105, 106)
//   node scripts/audit-atelier-paire.cjs
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE les vraies règles (src/seancePhoto.js, src/noteVocale.js, src/certificatPaire.js)
// sur des données INVENTÉES (50 paires au même titre) :
//   103 · la liste = paires présentes sans photo, avec moins de N photos, ou une photo
//         signalée floue / sombre ; dans l'ordre des N° (jamais du titre) ; figée au départ ;
//         la coche se pose par IDENTITÉ (clé du N° : « 007 » = « 7 ») et se défait ; une
//         lecture ratée du studio ne fabrique PAS 50 paires « sans photo » (pas su) ; la
//         lecture du studio est PROJETÉE (jamais les images, §4.4) ;
//   105 · la dictée s'AJOUTE à la note (jamais n'écrase), ce qui dépasse 200 caractères est
//         dit ; sans reconnaissance ou micro refusé, une raison ; la reconnaissance est celle
//         du NAVIGATEUR (aucun MediaRecorder, getUserMedia, ni envoi de son) ;
//   106 · la clé du certificat est l'identité de la paire (N°, sinon annonce ; jamais un
//         titre) ; PDF ou photo, 4 Mo ; la liste ne lit que des scalaires, le contenu par SON
//         id ; « Retirer » vide la ligne (jamais DELETE) ; une lecture ratée rend null (pas
//         su), jamais « aucun » ; l'envoi passe par le téléphone (feuille de partage, sinon
//         téléchargement) — aucun lien public créé ;
// AUDIT_MUTATION=ordre | coche | ecrase | titre | passu : la règle réaffaiblie ⇒ rouge.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const MUT = process.env.AUDIT_MUTATION || '';
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const MUTATIONS = {
  ordre: ['seancePhoto.js', 'cles.sort(triNumSeance);', 'cles.sort();'],
  coche: ['seancePhoto.js', "const id = 'c:' + cle;", "const id = 'c:' + String(cle).toLowerCase() + 'x';"],
  passu: ['seancePhoto.js', "if (!(studio instanceof Map)) return { ok: false, raison: 'passu' };", 'if (!(studio instanceof Map)) studio = new Map();'],
  ecrase: ['noteVocale.js', 'const voulu = a + sep + d.charAt(0).toUpperCase() + d.slice(1);', 'const voulu = d.charAt(0).toUpperCase() + d.slice(1);'],
  titre: ['certificatPaire.js', "  const a = String(p.itemId == null ? '' : p.itemId).trim();\n  return /^\\d{3,20}$/.test(a) ? 'a_' + a : '';", "  const a = String(p.titre || p.itemId || '').trim();\n  return a ? 'a_' + a.replace(/\\W+/g, '') : '';"],
};
const sansCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const lire = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
(async () => {
  for (const f of ['seancePhoto.js', 'noteVocale.js', 'certificatPaire.js']) if (!fs.existsSync(path.join(RACINE, 'src', f))) { dit(false, `src/${f} existe`, 'absent sur cet arbre'); return fin(); }
  // Une copie de src/ (les modules s'importent entre eux) où la mutation est appliquée.
  let dossier = path.join(RACINE, 'src');
  if (MUT) {
    const m = MUTATIONS[MUT]; if (!m) { console.log('KO  mutation inconnue : ' + MUT); process.exit(2); }
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-atelier-'));
    for (const f of ['seancePhoto.js', 'noteVocale.js', 'certificatPaire.js', 'notePaire.js', 'profilVendeur.js']) { if (fs.existsSync(path.join(RACINE, 'src', f))) fs.copyFileSync(path.join(RACINE, 'src', f), path.join(d, f)); }
    const p = path.join(d, m[0]); const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(m[1])) { console.log('KO  mutation plus applicable : ' + MUT); process.exit(2); }
    fs.writeFileSync(p, s.replace(m[1], m[2]));
    fs.writeFileSync(path.join(d, 'package.json'), '{"type":"module"}');
    dossier = d; console.log('── mutation : ' + MUT);
  }
  const S = await import(path.join(dossier, 'seancePhoto.js'));
  const V = await import(path.join(dossier, 'noteVocale.js'));
  const K = await import(path.join(dossier, 'certificatPaire.js'));

  // ── 103 ──
  const paires = Array.from({ length: 50 }, (_, i) => ({ num: String(250 - i), titre: 'Nike Dunk Low Panda 42' }));
  paires.push({ num: 'B12', titre: 'Nike Dunk Low Panda 42' }, { num: '007', titre: 'Nike Dunk Low Panda 42' });
  // Ce que la base rend (projection) : N°201..230 ont des photos (1 à 4), 205 a une photo floue.
  const rows = [];
  for (let n = 201; n <= 230; n++) { const k = (n % 4) + 1; const r = { id: 'studio_photos_' + n, num: String(n) }; for (let i = 0; i < 6; i++) { r['a' + i] = i < k ? '2026-11-1' + i + 'T10:00:00Z' : null; r['q' + i] = i < k ? (n === 205 && i === 0 ? 'flou' : 'ok') : null; } rows.push(r); }
  const st = S.etatStudio(rows);
  dit(st instanceof Map && st.get('205').douteuses === 1 && st.get('203').n === 4, '103. l’état du studio se lit de la projection (nombre de photos, signalées)');
  const sel = S.selectStudio();
  dit(!/(^|,)data(,|$)/.test(sel) && /data->photos->0->>at/.test(sel) && /qualite->>juge/.test(sel) && !/->>img|->img/.test(sel), '103. la lecture du studio est PROJETÉE : jamais les images (§4.4)', sel.slice(0, 60));
  const s = S.nouvelleSeance({ paires, studio: st, n: 3, maintenant: '2026-11-14T10:00:00Z' });
  const cles = s.ok ? s.seance.cles : [];
  const attendu = []; for (let n = 7; n <= 250; n++) { if (!paires.some((p) => S.triNumSeance && String(parseInt(p.num, 10)) === String(n))) continue; const e = st.get(String(n)); const r = S.raisonSeance(e, 3); if (r) attendu.push(String(n)); }
  attendu.push('B12');
  dit(s.ok && JSON.stringify(cles) === JSON.stringify(attendu), '103. la liste : sans photo, < 3 photos, ou photo floue — dans l’ordre des N° (7, 201…, puis B12)', cles.slice(0, 6).join(',') + '…');
  dit(cles.includes('205') && !cles.includes('203') && cles.includes('204') && cles.includes('231') && cles[0] === '7', '103. N°205 (floue) dedans ; N°203 (4 photos) dehors ; N°231 (aucune) dedans ; « 007 » rangé comme 7');
  dit(S.nouvelleSeance({ paires, studio: null, n: 3 }).ok === false, '103. photos du studio pas lues ⇒ PAS de liste (pas su ≠ aucune photo)');
  let v = {};
  const appl = (val, ops) => { let o = { ...val }; for (const op of ops) { if (op.apres === undefined) delete o[op.id]; else o[op.id] = op.apres; } return o; };
  v = appl(v, S.opsNouvelleSeance(v, s.seance));
  let l = S.lignesSeance(v, { studio: st, paires });
  dit(l && l.total === cles.length && l.faites === 0, '103. la séance commence : rien de coché');
  v = appl(v, [S.opCoche(v, '7', true, '2026-11-14T10:05:00Z')]);
  l = S.lignesSeance(v, { studio: st, paires });
  const r7 = l.lignes.find((x) => x.cle === '7');
  dit(r7 && r7.coche && l.faites === 1 && l.lignes.filter((x) => x.coche).length === 1, '103. cocher « 7 » coche CETTE paire (le « 007 ») et elle seule, par identité');
  dit(S.opCoche(v, '7', true) === null, '103. cocher deux fois : rien de plus');
  v = appl(v, [S.opCoche(v, '7', false)]);
  dit(S.lignesSeance(v, { studio: st, paires }).faites === 0, '103. décocher : la coche part');
  // Une photo rangée pendant la séance : la paire reste dans la liste (figée), « photos faites ».
  const st2 = new Map(st); st2.set('231', { n: 3, douteuses: 0 });
  const l2 = S.lignesSeance(v, { studio: st2, paires });
  dit(l2.lignes.some((x) => x.cle === '231' && x.raison === 'faite'), '103. la liste est figée : une paire photographiée reste, « photos faites »');
  v = appl(v, S.opsNouvelleSeance(v, S.nouvelleSeance({ paires, studio: st2, n: 3 }).seance));
  dit(!S.lignesSeance(v, { studio: st2, paires }).lignes.some((x) => x.cle === '231'), '103. « Nouvelle séance » recalcule (et retire les coches d’avant)');

  // ── 105 ──
  const ancienne = 'Petite tache semelle gauche.';
  const r1 = V.ajouterDictee(ancienne, 'taille petit');
  dit(r1.texte.startsWith(ancienne) && /Taille petit$/.test(r1.texte) && !r1.coupe, '105. la dictée s’AJOUTE à la note (jamais n’écrase)', r1.texte);
  dit(V.ajouterDictee('', 'lacets neufs').texte === 'Lacets neufs', '105. sans note : la dictée devient la note');
  const long = 'x'.repeat(190);
  const r2 = V.ajouterDictee(long, 'boîte abîmée sur un côté');
  dit(Array.from(r2.texte).length === 200 && r2.coupe, '105. au-delà de 200 caractères : coupé ET dit');
  dit(V.ajouterDictee(ancienne, '   ').vide && V.ajouterDictee(ancienne, '   ').texte === ancienne, '105. rien entendu : la note ne change pas');
  dit(V.raisonSansDictee({ api: false, refus: false }) === 'navigateur' && V.raisonSansDictee({ api: true, refus: true }) === 'refus' && V.raisonSansDictee({ api: true, refus: false }) === null, '105. sans reconnaissance du navigateur ou micro refusé : le bouton dit pourquoi');
  const at = sansCom(lire('src/AtelierPaire.jsx')) + sansCom(lire('src/noteVocale.js'));
  dit(at && !/MediaRecorder|getUserMedia|AudioContext|fetch\(/.test(at), '105. aucun son enregistré ni envoyé par VRM (la reconnaissance du navigateur seulement)');
  dit(/aria-disabled=\{raison \? 'true' : undefined\}/.test(lire('src/AtelierPaire.jsx')) && /data-atelier-dictee-raison/.test(lire('src/AtelierPaire.jsx')), '105. sans dictée, le bouton reste et DIT la raison (jamais un bouton mort muet)');
  dit(/lang: dictee\.lang\(\)/.test(lire('src/AtelierPaire.jsx')) && /rec\.lang = \/\^\[a-z\]\{2\}-\[A-Z\]\{2\}\$\/\.test/.test(lire('src/dicteeNavigateur.js')), '105. la dictée écoute dans la langue de VRM');

  // ── 106 ──
  dit(K.cleCertificat({ numero: '007' }) === 'n_7' && K.cleCertificat({ numero: 'b 125' }) === 'n_B125', '106. la clé est le N° (clé N° : « 007 » = « 7 », « b 125 » = « B125 »)');
  dit(K.cleCertificat({ itemId: '4567890123' }) === 'a_4567890123' && K.cleCertificat({ titre: 'Nike Dunk Low Panda 42' }) === '' && K.cleCertificat({ itemId: 'Nike Dunk' , titre: 'x'}) === '', '106. sans N° : l’annonce ; jamais un titre (aucune identité ⇒ aucun certificat)');
  dit(K.verifierFichier({ type: 'application/pdf', taille: 1000, nom: 'a.pdf' }).genre === 'pdf' && K.verifierFichier({ type: 'image/heic', taille: 1000 }).genre === 'image' && K.verifierFichier({ type: 'text/plain', taille: 5 }).raison === 'type' && K.verifierFichier({ type: 'application/pdf', taille: 5 * 1024 * 1024 }).raison === 'taille', '106. PDF ou photo, 4 Mo au plus');
  dit(K.contenuValide('data:application/pdf;base64,JVBERi0xLjQ=', 'pdf') && !K.contenuValide('data:application/pdf;base64,AAAA', 'pdf') && !K.contenuValide('data:image/jpeg;base64,' + 'A'.repeat(K.MAX_DATAURL), 'image'), '106. un PDF commence par %PDF ; le contenu rangé reste sous le plafond');
  // La base, à la VRAIE forme (PostgREST : projection, in.(…), on_conflict).
  const appels = [];
  const faux = (rep) => async (url, o = {}) => { appels.push({ url, o }); return rep(url, o); };
  const base = (rep) => ({ fetch: faux(rep), url: 'https://x.supabase.co', auth: (x) => ({ apikey: 'k', ...(x || {}) }), withOwner: (r) => ({ ...r, owner: 'u1' }), conflit: 'owner,id', owner: 'u1' });
  const ok = await K.ecrireCertificat({ cle: 'n_124', dataUrl: 'data:application/pdf;base64,JVBERi0xLjQ=', genre: 'pdf', nom: 'legit.pdf', taille: 30, numero: '124' }, base(async () => ({ ok: true })));
  const w = appels.pop();
  dit(ok && /on_conflict=owner,id/.test(w.url) && JSON.parse(w.o.body)[0].id === 'certificat_paire_n_124' && JSON.parse(w.o.body)[0].owner === 'u1', '106. écrit SA ligne `certificat_paire_n_124` (withOwner, on_conflict)');
  await K.retirerCertificat('n_124', base(async () => ({ ok: true })));
  const rt = appels.pop();
  dit(rt.o.method === 'POST' && JSON.parse(rt.o.body)[0].data.b64 === null && JSON.parse(rt.o.body)[0].data.supprime === true, '106. « Retirer » VIDE la ligne (jamais DELETE)');
  const m = await K.lireCertificats(['n_124', 'n_125'], base(async () => ({ ok: true, json: async () => [{ id: 'certificat_paire_n_124', type: 'pdf', nom: 'legit.pdf', taille: '30', at: 'x', supprime: null }, { id: 'certificat_paire_n_125', type: null, supprime: 'true' }] })));
  const lu = appels.pop();
  dit(m && m.n_124 && m.n_124.type === 'pdf' && !m.n_125 && /select=id,type:data->>type/.test(lu.url) && !/b64/.test(lu.url) && /id=in\.\(/.test(lu.url) && /owner=eq\.u1/.test(lu.url), '106. la liste ne lit que des scalaires (jamais le contenu), par ses ids, ses lignes');
  dit(await K.lireCertificats(['n_124'], base(async () => ({ ok: false, status: 503 }))) === null && await K.lireCertificats(['n_124'], base(async () => { throw new Error('réseau'); })) === null, '106. lecture ratée ⇒ null (pas su), jamais « aucun certificat »');
  const ct = await K.lireContenuCertificat('n_124', base(async () => ({ ok: true, json: async () => [{ b64: 'data:application/pdf;base64,JVBERi0xLjQ=', type: 'pdf', nom: 'legit.pdf' }] })));
  dit(ct && ct.type === 'pdf' && /id=eq\.certificat_paire_n_124/.test(appels.pop().url), '106. le contenu se lit par SON id, au toucher');
  dit(K.nomFichierCertificat('n_124', 'pdf') === 'Certificat-N124.pdf', '106. le fichier envoyé s’appelle « Certificat-N124.pdf » (jamais le nom d’un acheteur)');
  const ap = sansCom(lire('src/AtelierPaire.jsx'));
  dit(/navigator\.canShare/.test(ap) && /a\.download = nom/.test(ap) && !/createSignedUrl|\/storage\/v1|api\/compte/.test(ap + sansCom(lire('src/certificatPaire.js'))), '106. envoyer : la feuille de partage du téléphone, sinon le téléchargement — aucun lien public créé');
  const equipe = lire('supabase/migrations/016_equipe.sql') + lire('api/compte.js');
  dit(!/certificat_paire/.test(equipe), '106. le mode équipe ne voit pas les certificats (pas dans sa liste blanche)');
  fin();
})().catch((e) => { console.log('KO  exception : ' + (e && e.stack || e)); process.exit(1); });
function fin() { console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTout est vert'); process.exit(ko ? 1 : 0); }
