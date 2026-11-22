// ════════════════════════════════════════════════════════════════════════
//  CE QUE L'APP NE FAIT PLUS, L'EXTENSION LE PORTE (20 nov., ext. 5.410 — chantier actions-extension)
//  On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs) :
//   P. le PILOTE du mode auto des favoris : éteint ⇒ rien ; allumé ⇒ auto → suivant → envoi → terminer, au nom du
//      compte de l'onglet ; captcha ⇒ ARRÊT (rien demandé au serveur) ;
//   V. la VEILLE des republications programmées : à l'heure, conditions remplies ⇒ départ PRIS (CAS) et les paires
//      partent dans SON ordre avec SES réglages (prix -10 %) ; frein de Vinted ⇒ « pas partie », rien ne part ;
//      photo réglée ⇒ « pas partie » ; pas encore l'heure ⇒ rien ;
//   G. les GARDES recopiées (scripts/recopier-gardes-extension.cjs --verifie) : accepter une offre vendue ailleurs ⇒
//      refusé ; « pas su » ⇒ refusé sans son second toucher ; publier avec un problème ⇒ dit, sans son second
//      toucher rien ne part ; supprimer sur Leboncoin sans « sans retour » ⇒ rien ne part ;
//   F. les réglages des messages aux favoris écrits depuis le panneau (règle de l'app ; allumer le mode auto ⇒
//      confirmation).
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const SRC0 = process.env.BG_SRC ? path.resolve(process.env.BG_SRC) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const MUTATIONS = {
  pilote_captcha: ["if (av && av.stop) return fin(av.stop, { uid });", ''],
  pilote_eteint: ["if (!r.actif) return fin('eteint', { uid });", ''],
  veille_conditions: ["if (manques.length) { await modifierLigneCas", "if (false) { await modifierLigneCas"],
  veille_photo: ["...(p.reglages && p.reglages.photo && !GARDES_APP.photoNeutre(p.reglages.photo) ? { reglages: reglagesPhotoSurs(p.reglages.photo) } : {}),", ''],
  veille_cas: ["if (pris !== true) { faits.push({ id: p.id, etat: 'pas-pris' }); continue; }", ''],
  garde_bloque: ["if (av && av.bloque) return { ok: false, code: 'vendue-ailleurs', avis: av.texte, error: av.texte };", ''],
  garde_passu: ["if (av && av.pasSu && msg.avisVu !== true) return", "if (false) return"],
  verif_publier: ["if (verif.length && msg.verifVu !== true) return", "if (false) return"],
  sans_retour: ["if (msg.sansRetour !== true) return { accepte: false, code: 'sans-retour'", "if (false) return { accepte: false, code: 'sans-retour'"],
  favoris_regle: ["try { return GARDES_APP.validerReglagesFavoris(voulu); }", "try { return voulu; }"],
  prix_plancher: ["if (pl && vouluC < pl.c) { refus.push({ id, code: 'plancher'", "if (false) { refus.push({ id, code: 'plancher'"],
  prix_confirme: ["if (msg.confirme !== true) return { ok: false, code: 'confirmation', raison: 'Rien n’est parti : touche « Confirmer ».' };", ''],
  atelier_photo: ["reglages: a.photo, ...(a.reponses", "...(a.reponses"],
  atelier_verif: ["if (!perm.ok) return { ok: false, code: perm.raison", "if (false) return { ok: false, code: perm.raison"],
  atelier_arret: ["if (!fait) { a2.etat = 'arretee';", "if (false) { a2.etat = 'arretee';"],
  offre_liste: ["if (!off) return { ok: false, code: 'offre'", "if (false) return { ok: false, code: 'offre'"],
  contre_plancher: ["if (pl && pc < pl.c) return { ok: false, code: 'plancher'", "if (false) return { ok: false, code: 'plancher'"],
  publier_questions: ["if (plan.etat !== 'pret') return { ok: false, code: 'questions'", "if (false) return { ok: false, code: 'questions'"],
  hausse_confirme: ["if (hausse && (msg.hausseConfirmee !== true || vouluC > avantC * 10))", "if (false)"],
  hausse_regle: ["if (msg.hausse === true && msg.source !== 'regle')", "if (msg.hausse === true)"],
  retenir_reponses: ["return ligneAvecReglage(d, 'vrm_agent_publier', n.valeur, 'extension', Date.now());", "return undefined;"],
  auto_confirme: ["if (v.actif && a.actif !== true && msg.confirme !== true) return", "if (false) return"],
};
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
let SRC = SRC0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut]; const s = fs.readFileSync(SRC0, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  SRC = path.join(os.tmpdir(), `bg-porte-${mut}-${process.pid}.js`); fs.writeFileSync(SRC, s.split(a).join(b));
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 300) : '')); } };
const essai = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — exception', e && e.stack); } };
const UID = '111', MIN = 60000;
const TAB = { tab: { id: 7, url: 'https://www.vinted.fr/' } };

// Le faux serveur des favoris.
const serveurFavoris = (etat) => async (e) => {
  if (e.mode !== 'favoris') return null;
  if (e.methode === 'GET') return { status: 200, body: { ok: true, vue: { active: false, auto: { reglages: etat.auto } } } };
  const a = e.corps && e.corps.action;
  if (a === 'auto') return { status: 200, body: { ok: true, ajoute: etat.ajoute !== false, etat: 'libre' } };
  if (a === 'suivant') return { status: 200, body: { ok: true, travail: { jeton: 'jeton-1', itemId: '5001', recipientId: '77' } } };
  if (a === 'terminer') return { status: 200, body: { ok: true } };
  if (a === 'auto_regler') { etat.regle = e.corps; return { status: 200, body: { ok: true } }; }
  return { status: 200, body: { ok: true } };
};
const actions = (f) => f.j.vrmApi.filter((x) => x.methode === 'POST').map((x) => x.corps && x.corps.action);
const AUTO_ON = { version: 1, actif: true, attenteMin: 10, attenteMax: 60, heureDebut: 0, heureFin: 24, jours: [1, 2, 3, 4, 5, 6, 7], parJour: 30, parHeure: 12 };

(async () => {
  // ── P. LE PILOTE ───────────────────────────────────────────────────────
  await essai('pilote', async () => {
    const e1 = { auto: { ...AUTO_ON, actif: false } };
    const f1 = faireFond({ src: SRC, connecte: UID, lignes: { main: {} }, vrm: serveurFavoris(e1) });
    const exec1 = []; f1.ctx.executerPourAppCoeur = async (m) => { exec1.push(m); return { ok: true }; };
    const r1 = await f1.ctx.piloteFavorisTick(Date.now());
    dit(r1 && r1.etat === 'eteint' && !actions(f1).includes('auto') && exec1.length === 0, 'pilote : mode auto éteint ⇒ rien n’est demandé, rien ne part', JSON.stringify(r1));
    const e2 = { auto: AUTO_ON };
    const f2 = faireFond({ src: SRC, connecte: UID, lignes: { main: {} }, vrm: serveurFavoris(e2), store: { vrmOuverture: {} } });
    const exec2 = []; f2.ctx.executerPourAppCoeur = async (m) => { exec2.push(m); return { ok: true }; };
    f2.ctx.attenteAvantFavori = async () => null;   // les gardes de discrétion ont leurs audits ; ici le tour lui-même
    const r2 = await f2.ctx.piloteFavorisTick(Date.now());
    dit(r2 && r2.etat === 'envoye' && actions(f2).join(',') === 'auto,suivant,terminer' && exec2.length === 1 && exec2[0].uid === UID && exec2[0].endpoint === '/vrm/favoris' && exec2[0].body.jeton === 'jeton-1', 'pilote : allumé ⇒ auto → suivant → envoi (compte de l’onglet) → terminer', JSON.stringify({ r2, a: actions(f2), exec2 }));
    const r2b = await f2.ctx.piloteFavorisTick(Date.now() + 30000);
    dit(r2b && r2b.etat === 'attente', 'pilote : le tour suivant attend 2 à 5 min (tiré au hasard)', JSON.stringify(r2b));
    const st = f2.store.vrmPiloteFavoris; const ec = st && Number(st.prochain) - Number(st.dernier && st.dernier.at);
    dit(ec >= 2 * MIN && ec <= 5 * MIN, 'pilote : l’écart est entre 2 et 5 min', ec);
    const e3 = { auto: AUTO_ON };
    const f3 = faireFond({ src: SRC, connecte: UID, lignes: { main: {} }, vrm: serveurFavoris(e3), store: { vrmCaptcha: { [UID]: { depuis: Date.now() - MIN, quoi: 'captcha' } } } });
    const exec3 = []; f3.ctx.executerPourAppCoeur = async (m) => { exec3.push(m); return { ok: true }; };
    const r3 = await f3.ctx.piloteFavorisTick(Date.now());
    dit(r3 && /verification|onglet/.test(r3.etat) && !actions(f3).includes('auto') && exec3.length === 0, 'pilote : captcha ⇒ ARRÊT, rien n’est demandé au serveur, rien ne part', JSON.stringify(r3));
  });

  // ── V. LA VEILLE DES REPUBLICATIONS PROGRAMMÉES ─────────────────────────
  const ITEMS = [{ id: 5001, title: 'Paire A', price: { amount: '50.0' } }, { id: 5002, title: 'Paire B', price: { amount: '80.0' } }, { id: 5003, title: 'Paire C', price: { amount: '40.0' } }];
  const PHOTO0 = { rot: 0, bright: 1, contrast: 1, sat: 1, zoom: 1 };
  const prog = (o = {}) => ({ id: 'p1', uid: UID, compte: 'banc', action: 'modifier', ids: ['5002', '5001', '5999'], at: Date.now() - MIN, creeAt: Date.now() - 3600000, majAt: Date.now() - 3600000,
    reglages: { photo: PHOTO0, prix: { base: 'pct', delta: '-10', commun: '', arrondi: 'aucun', sens: 'proche', fin: 'aucune' }, titre: { mode: 'aucun', valeur: '', chercher: '', pos: '0' }, lettre: false }, etat: 'attente', raisons: [], ...o });
  const fondVeille = (p, repub) => {
    const f = faireFond({ src: SRC, connecte: UID, lignes: { main: { vinted_annonce_numeros: { 5001: { numero: '12' }, 5002: { numero: '13' } } }, vrm_repub_programme: { v: 1, rev: 1, programmes: { [UID]: p }, attentes: [{ uid: UID, id: p.id, at: new Date(p.at).toISOString() }] }, [`harvest_${UID}_listings`]: { capturedAt: new Date().toISOString(), payload: { items: ITEMS } } } });
    const cmds = []; f.ctx.executerCommande = async (m) => { cmds.push(m); return { accepte: true, etape: 'fait' }; };
    f.ctx.etatDepartRepub = async () => repub;
    return { f, cmds };
  };
  await essai('veille', async () => {
    const { f, cmds } = fondVeille(prog(), { onglet: true, frein: null });
    const r = await f.ctx.veilleRepubTick(Date.now());
    const p = f.lignes.vrm_repub_programme && f.lignes.vrm_repub_programme.programmes[UID];
    dit(cmds.length === 2 && cmds.map((c) => c.id).join(',') === '5002,5001' && cmds.every((c) => c.cmd === 'republierVinted' && c.uid === UID && c.programme === true && c.confirme === true), 'veille : à l’heure, les paires partent dans SON ordre (5999 vendue/retirée n’est jamais remplacée)', JSON.stringify(cmds));
    dit(cmds[0] && cmds[0].prix === 72 && cmds[1] && cmds[1].prix === 45, 'veille : SES réglages figés (prix −10 %) — la règle de l’app (apercuRepub)', JSON.stringify(cmds.map((c) => c.prix)));
    dit(p && p.etat === 'finie' && p.appareil, 'veille : départ PRIS par ce navigateur (comparer-et-échanger), puis « finie »', JSON.stringify(p));
    const v2 = fondVeille(prog(), { onglet: true, frein: { jusqua: Date.now() + 3600000, restreint: false } });
    await v2.f.ctx.veilleRepubTick(Date.now());
    const p2 = v2.f.lignes.vrm_repub_programme.programmes[UID];
    dit(v2.cmds.length === 0 && p2.etat === 'pas-partie' && p2.raisons.some((x) => x.cle === 'frein'), 'veille : frein de Vinted ⇒ « pas partie » avec la raison, rien ne part', JSON.stringify(p2));
    const v3 = fondVeille(prog({ action: 'recreer', reglages: { ...prog().reglages, photo: { ...PHOTO0, rot: 5, bright: 1.2 } } }), { onglet: true, frein: null });
    v3.f.ctx.republieesEnBase = async () => [];
    await v3.f.ctx.veilleRepubTick(Date.now());
    dit(v3.cmds.length === 2 && v3.cmds.every((c) => c.cmd === 'recreerVinted' && c.reglages && c.reglages.rot === 5 && c.reglages.bright === 1.2), 'veille : SON réglage photo part avec chaque paire (le fond retouche la photo, `photoReglee`) — jamais découvert au départ', JSON.stringify(v3.cmds.map((c) => c.reglages)));
    const v4 = fondVeille(prog({ at: Date.now() + 3600000 }), { onglet: true, frein: null });
    const r4 = await v4.f.ctx.veilleRepubTick(Date.now());
    dit(v4.cmds.length === 0 && v4.f.lignes.vrm_repub_programme.programmes[UID].etat === 'attente' && r4.etat === 'rien', 'veille : pas encore l’heure ⇒ rien (index léger seulement)', JSON.stringify(r4));
    const v6 = fondVeille(prog(), { onglet: true, frein: null });
    const casVrai = v6.f.ctx.modifierLigneCas;
    // Un AUTRE navigateur prend le départ entre la lecture et l'écriture : le comparer-et-échanger perd.
    v6.f.ctx.modifierLigneCas = async (id, fn, n) => { const d = v6.f.lignes[id]; const x = await fn(JSON.parse(JSON.stringify(d))); if (x && x.programmes && x.programmes[UID] && x.programmes[UID].etat === 'partie') return false; return casVrai(id, fn, n); };
    await v6.f.ctx.veilleRepubTick(Date.now());
    dit(v6.cmds.length === 0, 'veille : départ pris par un autre navigateur (comparer-et-échanger perdu) ⇒ rien ne part ici', v6.cmds.length);
    const v5 = fondVeille(prog(), { onglet: false, frein: null });
    await v5.f.ctx.veilleRepubTick(Date.now());
    dit(v5.cmds.length === 0 && v5.f.lignes.vrm_repub_programme.programmes[UID].etat === 'pas-partie', 'veille : onglet vinted.fr pas prêt ⇒ « pas partie »');
  });

  // ── G. LES GARDES RECOPIÉES ────────────────────────────────────────────
  await essai('gardes', async () => {
    let verif = ''; try { verif = execFileSync(process.execPath, [path.join(__dirname, 'recopier-gardes-extension.cjs'), '--verifie'], { encoding: 'utf8' }); } catch (e) { verif = String(e.stdout || 'rouge'); }
    dit(/✅/.test(verif) || mut, 'gardes : la copie de l’extension est celle de l’app (recopier-gardes-extension --verifie)', verif.trim());
    const ACC = '/api/v2/transactions/1/offer_requests/2/accept';
    const g1 = faireFond({ src: SRC, connecte: UID, lignes: { main: { vinted_offres_garde: { v: 1, at: new Date().toISOString(), complet: true, items: ['9001'] } } } });
    const r1 = await g1.ctx.executerPourAppCoeur({ uid: UID, method: 'PUT', endpoint: ACC, confirme: true, item: '9001', avisVu: true });
    dit(r1 && r1.code === 'vendue-ailleurs' && !g1.j.vinted.some((x) => x.methode === 'PUT'), 'garde : accepter une offre sur une paire vendue ailleurs ⇒ refusé, même avec son second toucher', JSON.stringify(r1));
    const g2 = faireFond({ src: SRC, connecte: UID, lignes: { main: {} } });
    const r2 = await g2.ctx.executerPourAppCoeur({ uid: UID, method: 'PUT', endpoint: ACC, confirme: true });
    dit(r2 && r2.code === 'avis' && /vérifie/.test(r2.avis) && !g2.j.vinted.some((x) => x.methode === 'PUT'), 'garde : « pas su » ⇒ dit, rien ne part sans son second toucher', JSON.stringify(r2));
    const r2b = await g2.ctx.executerPourAppCoeur({ uid: UID, method: 'PUT', endpoint: ACC, confirme: true, avisVu: true });
    dit(r2b && r2b.code !== 'avis' && r2b.code !== 'vendue-ailleurs', 'garde : « pas su » + son second toucher ⇒ passe la garde (les autres gardes suivent)', JSON.stringify(r2b));
    const g3 = faireFond({ src: SRC, connecte: UID, lignes: { main: {} } });
    g3.ctx.ficheAgentValide = () => ({ ok: true, ad: { id: 'fiche-12', numero: '12' } });
    const r3 = await g3.ctx.publierFicheSite({ site: 'leboncoin', fiche: { photos: ['https://images1.vinted.net/x.jpg'], titre: 'Paire', prix: 50, achat: 60 } });
    dit(r3 && r3.code === 'verification' && r3.problemes.some((x) => x.code === 'photos') && r3.problemes.some((x) => x.code === 'prix'), 'garde : publier avec 1 photo et un prix sous l’achat ⇒ dit (règle de l’app), rien ne part', JSON.stringify(r3));
    const r3b = await g3.ctx.publierFicheSite({ site: 'leboncoin', verifVu: true, fiche: { photos: ['https://images1.vinted.net/x.jpg'], titre: 'Paire', prix: 50, achat: 60 } });
    dit(r3b && r3b.code !== 'verification', 'garde : son second toucher ⇒ la vérification laisse passer', JSON.stringify(r3b && r3b.code));
    const r3c = g3.ctx.verifAvantPublier({ photos: ['a', 'b', 'c'], titre: 'Sac', famille: 'sacs' }, 'vestiaire');
    dit(r3c.some((x) => x.code === 'photos-vc'), 'garde : Vestiaire — les photos exigées (photosExigeesVc) sont dites', JSON.stringify(r3c));
    const g4 = faireFond({ src: SRC, connecte: UID, lignes: { main: {} } });
    const r4 = await g4.ctx.supprimeLbcDepuisApp({ id: '1234567', confirme: true, numero: '12', titre: 'Paire' });
    dit(r4 && r4.code === 'sans-retour' && /Leboncoin/.test(r4.confirmation.titre) && /sans retour/.test(r4.confirmation.sansRetour) && r4.confirmation.irreversible === true, 'garde : supprimer sur Leboncoin sans « sans retour » ⇒ la confirmation de l’app, rien ne part', JSON.stringify(r4));
    const r4b = await g4.ctx.supprimeLbcDepuisApp({ id: '1234567', confirme: true, sansRetour: true });
    dit(r4b && r4b.code !== 'sans-retour', 'garde : « Oui, supprimer de Leboncoin » ⇒ la garde laisse passer', JSON.stringify(r4b && r4b.code));
  });

  // ── F. LES RÉGLAGES DES MESSAGES AUX FAVORIS ────────────────────────────
  await essai('favoris', async () => {
    const f = faireFond({ src: SRC, connecte: UID, lignes: { main: {}, [`vrm_favoris_reglages_${UID}`]: { version: 1, message: 'Ancien', intervalleMinutes: 6, rythme: 'normal', pourcentage: 10, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMaxMinutes: null, envoisActifs: false } } });
    const r1 = await f.envoyer({ from: 'vrm-badge', action: 'reglagesFavoris', message: 'Bonjour {pseudo} !', variantes: ['Salut {pseudo}'], rythme: 'prudent' }, TAB);
    const d = f.lignes[`vrm_favoris_reglages_${UID}`];
    dit(r1 && r1.ok && d.message === 'Bonjour {pseudo} !' && d.variantes[0] === 'Salut {pseudo}' && d.rythme === 'prudent' && d.pourcentage === 10 && d.envoisActifs === false, 'favoris : textes et rythme écrits dans SA ligne, l’offre gardée', JSON.stringify({ r1, d }));
    const r2 = await f.envoyer({ from: 'vrm-badge', action: 'reglagesFavoris', message: 'Bonjour {inconnue}' }, TAB);
    dit(r2 && r2.ok === false && f.lignes[`vrm_favoris_reglages_${UID}`].message === 'Bonjour {pseudo} !', 'favoris : un texte que la règle de l’app refuse ⇒ rien n’a changé', JSON.stringify(r2));
    const e = { auto: { ...AUTO_ON, actif: false } };
    const g = faireFond({ src: SRC, connecte: UID, lignes: { main: {} }, vrm: serveurFavoris(e) });
    const a1 = await g.envoyer({ from: 'vrm-badge', action: 'favorisAuto', actif: true }, TAB);
    dit(a1 && a1.code === 'confirmation' && !e.regle, 'mode auto : allumer sans « Oui, allumer » ⇒ rien n’est envoyé', JSON.stringify(a1));
    const a2 = await g.envoyer({ from: 'vrm-badge', action: 'favorisAuto', actif: true, confirme: true }, TAB);
    dit(a2 && a2.ok && e.regle && e.regle.reglages.actif === true && e.regle.confirme === true && e.regle.reglages.parHeure === 12, 'mode auto : confirmé ⇒ `auto_regler` validé (ses horaires et quotas gardés)', JSON.stringify(e.regle));
  });
  // ── H. LES GESTES DU PANNEAU ───────────────────────────────────────────
  await essai('gestes', async () => {
    const T2 = { tab: { id: 7, url: 'https://www.vinted.fr/' } };
    const h = faireFond({ src: SRC, connecte: UID, lignes: { main: { vinted_annonce_numeros: { 5001: { numero: '12', min: '45' }, 5002: { numero: '13' } } } } });
    h.ctx.relaisSessionOwner = async () => 'owner-banc';
    let ticks = 0; h.ctx.prixAttenteTick = () => { ticks++; return Promise.resolve({}); };
    const p0 = await h.envoyer({ from: 'vrm-badge', action: 'prixCarte', items: [{ id: '5001', prix: '50', prixVu: 60 }] }, T2);
    dit(p0 && p0.ok === false && p0.code === 'confirmation', 'prix : sans « Confirmer », rien n’est rangé', JSON.stringify(p0));
    const p1 = await h.envoyer({ from: 'vrm-badge', action: 'prixCarte', confirme: true, items: [{ id: '5001', prix: '40', prixVu: 60 }, { id: '5002', prix: '70', prixVu: 60 }, { id: '5001', prix: '50', prixVu: 60 }] }, T2);
    const cmds = Object.entries(h.lignes).filter(([k]) => /^cmd_prix_/.test(k)).map(([, d]) => d);
    dit(p1 && p1.ranges.length === 1 && p1.refus.some((x) => x.code === 'plancher' && x.plancher === 45) && p1.refus.some((x) => x.code === 'hausse-confirmer') && cmds.length === 1 && cmds[0].source === 'panneau' && cmds[0].args.prixAvant === 60 && cmds[0].args.prix === 50 && cmds[0].confirme === true && ticks === 1,
      'prix : sous le plancher (prix mini 45) refusé, hausse sans confirmation refusée, le reste devient UNE commande `cmd_prix` (prix vu, confirmé) exécutée tout de suite', JSON.stringify({ p1, cmds }));
    // Atelier
    const g = faireFond({ src: SRC, connecte: UID, lignes: { main: { vinted_annonce_numeros: { 5001: { numero: '12' } } } } });
    const ex = []; let rep = { accepte: true, etape: 'fait' }; g.ctx.executerCommande = async (m) => { ex.push(m); return rep; };
    const a1 = await g.envoyer({ from: 'vrm-badge', action: 'atelierLancer', confirme: true, ids: ['5002', '5001'], espacement: { mode: 'aleatoire', min: 2, max: 5 }, photo: { bright: 1.2, rot: 3 }, lettre: true }, T2);
    await new Promise((r) => setTimeout(r, 30));
    dit(a1 && a1.ok && ex.length === 1 && ex[0].cmd === 'recreerVinted' && ex[0].id === '5002' && ex[0].reglages && ex[0].reglages.bright === 1.2 && ex[0].reglages.rot === 3 && /^[a-z]$/.test(ex[0].lettre), 'atelier : « Lancer » ⇒ la 1re paire de SON ordre part (coffre → brouillon → suppression → mise en ligne), SON réglage photo, la lettre', JSON.stringify({ a1: a1 && a1.ok, ex }));
    const st = g.store.vrmAtelierRepub; const ec = st && st.prochain - Date.now();
    dit(st && st.i === 1 && ec >= 2 * MIN - 2000 && ec <= 5 * MIN + 60000, 'atelier : la suivante attend SON espacement au hasard (2 à 5 min), la file vit dans chrome.storage.local', JSON.stringify({ i: st && st.i, ec }));
    const r0 = await g.ctx.atelierRepubTick(Date.now());
    dit(r0.etat === 'attente' && ex.length === 1, 'atelier : pas avant l’heure');
    rep = { accepte: false, code: 'frein-refus', raison: 'Vinted a freiné' };
    await g.ctx.atelierRepubTick(Date.now() + 6 * MIN);
    const st2 = g.store.vrmAtelierRepub;
    dit(ex.length === 2 && st2.etat === 'arretee' && st2.paires['5001'].etape === 'arret', 'atelier : un arrêt (frein, captcha, plafond) arrête la file, dit', JSON.stringify(st2.paires));
    rep = { accepte: true, etape: 'fait' };
    const rp = await g.envoyer({ from: 'vrm-badge', action: 'atelierReprendre', id: '5001' }, T2);
    dit(rp && rp.ok && ex[2] && ex[2].cmd === 'reprendreRepub' && ex[2].id === '5001' && g.store.vrmAtelierRepub.etat === 'finie', '« Reprendre » relit chez Vinted et finit la paire interrompue (`reprendreRepub`)', JSON.stringify({ rp, c: ex[2] }));
    // Contrôle avant de lancer (`verifierRepub`, règle de l'app) : à corriger ⇒ Lancer fermé ; absente ⇒ ne part pas ; SA réponse voyage avec SA paire.
    const gv = faireFond({ src: SRC, connecte: UID, lignes: { main: {} }, store: { vrmAtelierVerif: { v: 1, uid: UID, at: Date.now(), paires: { 5001: { id: '5001', etat: 'a-corriger', corrections: [], manque: ['la taille'], question: { champ: 'size_id', options: [['206', '42']] } }, 5002: { id: '5002', etat: 'absente', corrections: [], manque: [] }, 5003: { id: '5003', etat: 'ok', corrections: [], manque: [], rep: { size_id: '206' } } } } } });
    const exv = []; gv.ctx.executerCommande = async (m) => { exv.push(m); return { accepte: true, etape: 'fait' }; };
    const v1 = await gv.envoyer({ from: 'vrm-badge', action: 'atelierLancer', confirme: true, ids: ['5001', '5002', '5003'], espacement: { mode: 'fixe', min: 2 } }, T2);
    dit(v1 && v1.ok === false && v1.code === 'a-corriger' && exv.length === 0, 'atelier : une annonce « à corriger » ⇒ « Lancer » refusé, rien ne part', JSON.stringify(v1));
    const v2 = await gv.envoyer({ from: 'vrm-badge', action: 'atelierLancer', confirme: true, ids: ['5002', '5003'], espacement: { mode: 'fixe', min: 2 } }, T2);
    await new Promise((r) => setTimeout(r, 30));
    dit(v2 && v2.ok && exv.length === 1 && exv[0].id === '5003' && exv[0].reponses && exv[0].reponses.size_id === '206' && gv.store.vrmAtelierRepub.ids.join(',') === '5003', 'atelier : l’absente ne part jamais ; SA réponse (taille) part avec SA paire', JSON.stringify({ v2: v2 && v2.ok, exv }));
    // Offres
    const o = faireFond({ src: SRC, connecte: UID, lignes: { main: { vinted_annonce_numeros: { 5001: { numero: '12', min: '45' } } } } });
    // (intégration 21 nov.) Une offre tranchée ne se retranche pas (« chaque offre une fois », 5.414+ : `deja`) : la contre-offre
    // se juge sur une AUTRE offre en attente (902), plus sur celle qu'on vient d'accepter.
    o.ctx.offresEnAttente = async () => [{ conv: '1', prix: 40, tx: '900', oid: '901', item: '5001' }, { conv: '1', prix: 40, tx: '900', oid: '902', item: '5001' }];
    const eo = []; o.ctx.executerPourAppCoeur = async (m) => { eo.push(m); return { ok: true }; };
    const o1 = await o.envoyer({ from: 'vrm-badge', action: 'offreCarte', quoi: 'accept', tx: '900', oid: '999', confirme: true }, T2);
    dit(o1 && o1.code === 'offre' && eo.length === 0, 'offre : une offre qui n’est pas en attente sur CE compte ⇒ rien ne part');
    const o2 = await o.envoyer({ from: 'vrm-badge', action: 'offreCarte', quoi: 'accept', tx: '900', oid: '901', confirme: true }, T2);
    dit(o2 && o2.ok && eo[0].endpoint === '/api/v2/transactions/900/offer_requests/901/accept' && eo[0].confirme === true && eo[0].item === '5001' && !eo[0].avisVu, 'offre : accepter passe par la porte gardée (confirmation, garde anti double-vente sur SON annonce)', JSON.stringify(eo[0]));
    const o3 = await o.envoyer({ from: 'vrm-badge', action: 'offreCarte', quoi: 'contre', tx: '900', oid: '902', prix: '42', confirme: true }, T2);
    const o4 = await o.envoyer({ from: 'vrm-badge', action: 'offreCarte', quoi: 'contre', tx: '900', oid: '902', prix: '38', confirme: true }, T2);
    const o5 = await o.envoyer({ from: 'vrm-badge', action: 'offreCarte', quoi: 'contre', tx: '900', oid: '902', prix: '48', confirme: true }, T2);
    dit(o3.code === 'plancher' && o4.code === 'prix' && o5.ok && eo[1] && eo[1].endpoint === '/api/v2/transactions/900/offers' && eo[1].body.offer.price === '48.00', 'contre-offre : jamais sous ton plancher (45), toujours au-dessus de son offre (40)', JSON.stringify({ o3, o4, e: eo[1] }));
    // Publier
    const pf = faireFond({ src: SRC, connecte: UID, lignes: { main: { vinted_annonce_numeros: { 5001: { numero: '12' } } } } });
    pf.ctx.lireFicheAnnonce = async () => ({ photos: ['https://images1.vinted.net/a.jpg'], description: 'Belle paire', codes: {} });
    pf.ctx.dressingLu = async () => ({ items: [{ id: 5001, title: 'Paire A', price: { amount: '50.0' } }] });
    let pubs = 0; pf.ctx.publierFicheSite = async () => { pubs++; return { accepte: true }; };
    const q1 = await pf.envoyer({ from: 'vrm-badge', action: 'publierCarte', site: 'leboncoin', id: '5001' }, T2);
    dit(q1 && q1.code === 'questions' && q1.questions.some((x) => x.champ === 'categorie') && pubs === 0, 'publier : catégorie pas sûre ⇒ la question est posée dans le panneau, rien ne part (agent de l’app)', JSON.stringify(q1));
    const qc = q1 && q1.questions ? q1.questions.find((x) => x.champ === 'categorie') : null;
    const rep1 = qc && qc.choix[0];
    const q2 = await pf.envoyer({ from: 'vrm-badge', action: 'publierCarte', site: 'leboncoin', id: '5001', reponses: { categorie: rep1 } }, T2);
    const mem = pf.lignes.vrm_reglages_auto && pf.lignes.vrm_reglages_auto.cles && pf.lignes.vrm_reglages_auto.cles.vrm_agent_publier;
    const q3 = await pf.envoyer({ from: 'vrm-badge', action: 'publierCarte', site: 'leboncoin', id: '5001' }, T2);
    dit(rep1 && mem && JSON.stringify(mem).includes(rep1) && !(q3 && q3.code === 'questions' && q3.questions.some((x) => x.champ === 'categorie')), 'publier : SA réponse est RETENUE (ligne des réglages, jamais `main`) — la question ne se repose plus', JSON.stringify({ rep1, q2: q2 && q2.code, q3: q3 && (q3.code || q3.accepte) }));
    // Hausse : sur SON clic confirmé seulement ; jamais par une règle.
    const hh = faireFond({ src: SRC, connecte: UID, lignes: { main: { vinted_annonce_numeros: { 5001: { numero: '12', min: '45' } } } } });
    hh.ctx.relaisSessionOwner = async () => 'owner-banc'; hh.ctx.prixAttenteTick = () => Promise.resolve({});
    const h1 = await hh.envoyer({ from: 'vrm-badge', action: 'prixCarte', confirme: true, items: [{ id: '5001', prix: '70', prixVu: 60 }] }, T2);
    const h2 = await hh.envoyer({ from: 'vrm-badge', action: 'prixCarte', confirme: true, hausseConfirmee: true, items: [{ id: '5001', prix: '70', prixVu: 60 }] }, T2);
    const ch = Object.entries(hh.lignes).filter(([k]) => /^cmd_prix_/.test(k)).map(([, d]) => d);
    const pa = hh.ctx.prixAttCommande(ch[0] || {});
    const reg = hh.ctx.prixAttCommande({ v: 1, site: 'vinted', args: { uid: UID, id: '5001', prix: 70, prixAvant: 60 }, confirme: true, source: 'regle', hausse: true });
    dit(h1 && h1.refus.some((x) => x.code === 'hausse-confirmer') && h2 && h2.ranges.length === 1 && ch.length === 1 && ch[0].hausse === true && pa.msg && pa.msg.hausse === true && reg.refus === 'hausse' && hh.ctx.remisePermise({ confirme: true, hausse: true, source: 'regle' }, 6000, 7000) === false && hh.ctx.remisePermise({ confirme: true, hausse: true }, 6000, 7000) === true,
      'prix : une HAUSSE passe sur SON clic confirmé (« Monter à… ? ») ; jamais par une règle', JSON.stringify({ h1, h2, ch, reg }));
  });
  console.log(ko ? `\n❌ audit-extension-porte-app : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ audit-extension-porte-app : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
