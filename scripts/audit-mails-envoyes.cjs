#!/usr/bin/env node
// scripts/audit-mails-envoyes.cjs
// ════════════════════════════════════════════════════════════════════════════
// LES E-MAILS QUE VRM ENVOIE LUI-MÊME (8 nov., « fais des beaux mails à envoyer »)
// ════════════════════════════════════════════════════════════════════════════
// Le banc EXÉCUTE chaque fonction d'envoi contre un FAUX serveur SMTP local (le
// vrai client `api/_lib/smtp.js`, branché par `_banc.connecter`), relit le
// message MIME reçu, décode ses deux parties et vérifie :
//   1. chaque e-mail part en multipart : texte brut ET HTML, non vides ;
//   2. tout ce qui vient d'une donnée (titre d'article, pseudo, nom d'acheteur,
//      message du vendeur) est ÉCHAPPÉ : `<script>` n'entre jamais dans le HTML ;
//      une URL `javascript:` n'est jamais posée dans un lien ;
//   3. jamais « encaissé » ; jamais « 0,00 € » pour un chiffre pas su (« — ») ;
//   4. UN seul bouton (un seul lien d'action avant le filet du pied) ;
//   5. la forme commune : préentête caché, largeur 600 (11 nov. ; 520 avant), `color-scheme`, en-tête en mots (11 nov. ; logo avant)
//      avec texte de remplacement (ou le NOM du vendeur pour sa facture) ;
//   6. « Gérer mes e-mails » au pied des e-mails FACULTATIFS seulement ;
//   7. l'identité de l'éditeur au pied seulement si elle est remplie ;
//   8. « M'envoyer un e-mail d'essai » : à l'adresse DU COMPTE seulement,
//      3 par heure, rien sans configuration ni sur une base muette.
// Toutes les données sont INVENTÉES (aucune ligne de production).
//
// Preuves : `--mutations` rejoue le banc sur une copie où la règle est
// réaffaiblie (échappement retiré, « facultatif » oublié, plafond relâché…) :
// chaque mutation DOIT le faire rougir. Sur origin/main (avant ce chantier), le
// banc est rouge : `api/_lib/mail-gabarit.js` n'existe pas.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const { pathToFileURL } = require('url');

const RACINE = path.join(__dirname, '..');

// ── Le faux serveur SMTP ────────────────────────────────────────────────────
function fauxSmtp() {
  const recus = [];
  const serveur = net.createServer((s) => {
    let tampon = ''; let enData = false;
    s.write('220 faux.smtp.test\r\n');
    s.on('data', (d) => {
      tampon += d.toString('utf8');
      for (;;) {
        if (enData) {
          const i = tampon.indexOf('\r\n.\r\n');
          if (i < 0) return;
          recus.push(tampon.slice(0, i)); tampon = tampon.slice(i + 5); enData = false;
          s.write('250 ok\r\n'); continue;
        }
        const i = tampon.indexOf('\r\n');
        if (i < 0) return;
        const l = tampon.slice(0, i); tampon = tampon.slice(i + 2);
        if (/^EHLO/i.test(l)) s.write('250-faux.smtp.test\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (/^AUTH/i.test(l)) s.write('235 ok\r\n');
        else if (/^(MAIL|RCPT)/i.test(l)) s.write('250 ok\r\n');
        else if (/^DATA/i.test(l)) { s.write('354 go\r\n'); enData = true; }
        else if (/^QUIT/i.test(l)) { s.write('221 bye\r\n'); s.end(); }
        else s.write('250 ok\r\n');
      }
    });
    s.on('error', () => {});
  });
  return new Promise((ok) => serveur.listen(0, '127.0.0.1', () => ok({ serveur, recus, port: serveur.address().port })));
}
// Le message reçu : en-têtes, et les parties text/plain et text/html décodées.
function decoder(brut) {
  const tete = brut.split('\r\n\r\n')[0];
  const partie = (type) => {
    const re = new RegExp(`Content-Type: ${type}; charset=UTF-8\\r\\nContent-Transfer-Encoding: base64\\r\\n\\r\\n([A-Za-z0-9+/=\\r\\n]+?)\\r\\n--`);
    const m = re.exec(brut);
    return m ? Buffer.from(m[1].replace(/\r\n/g, ''), 'base64').toString('utf8') : '';
  };
  const sujet = (/^Subject: (.*(?:\r\n .*)*)$/m.exec(tete) || [])[1] || '';
  const sujetLu = sujet.replace(/\r\n /g, '').replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (_, b) => Buffer.from(b, 'base64').toString('utf8'));
  return { tete, texte: partie('text/plain'), html: partie('text/html'), sujet: sujetLu };
}

// ── Les contrôles d'un e-mail ───────────────────────────────────────────────
const corpsAvantPied = (html) => html.split('<hr')[0];
// « 0,00 € » seul (pas la fin de « 300,00 € ») : un zéro écrit pour un chiffre pas su.
const ZERO = /(?<![\d\u00a0\u202f ])0,00\s€/;
const boutons = (html) => (corpsAvantPied(html).match(/<a\s/g) || []).length;

async function banc(R, { silencieux = false } = {}) {
  let ok = 0, ko = 0;
  const dit = (c, m, d) => { if (c) { ok++; if (!silencieux) console.log('✅ ' + m); } else { ko++; if (!silencieux) console.log('❌ ' + m + (d ? ` — ${String(d).slice(0, 300)}` : '')); } };
  const imp = (p) => import(pathToFileURL(path.join(R, p)).href + `?v=${Date.now()}${Math.random()}`);
  // Chaque module se charge à part : un absent fait rougir SA section, pas tout le banc.
  const charger = async (p) => { try { return await imp(p); } catch (e) { dit(false, `${p} se charge`, e && e.message); return null; } };
  const smtp = await charger('api/_lib/smtp.js');
  if (!smtp) return { ok, ko };
  const G = await charger('api/_lib/mail-gabarit.js'), RE = await charger('api/_lib/relances-essai.js'), BM = await charger('api/_lib/bilan-mois.js');
  const PA = await charger('api/_lib/preuve-adresse.js'), FR = await charger('src/facturePro/regle.js'), ME = await charger('api/_lib/mail-essai.js'), FP = await charger('api/_lib/facture-pro.js');
  const section = async (nom, mods, fn) => { if (mods.some((m) => !m)) { dit(false, `${nom} : module absent`); return; } try { await fn(); } catch (e) { dit(false, `${nom} : le banc a levé`, e && e.stack); } };

  const f = await fauxSmtp();
  // Chaque module a SA copie de smtp.js (import avec ?v=) : on branche celle
  // qu'il utilise en passant `connecter` explicitement.
  const connecter = () => new Promise((ok2, ko2) => { const s = net.connect({ host: '127.0.0.1', port: f.port }, () => ok2(s)); s.once('error', ko2); });
  const transport = { hote: 'smtp.exemple.test', port: 465, utilisateur: 'u', motDePasse: 'p', de: 'noreply@vrm.exemple.test', nomDe: 'VRM', connecter };
  const envoyer = async (m) => { const r = await smtp.envoyerSmtp({ ...transport, ...m, connecter }); return r; };
  const dernier = () => decoder(f.recus[f.recus.length - 1] || '');
  const MAL = '<script>alert(1)</script>';
  const ENV = { SUPABASE_SERVICE_KEY: 'cle-de-service-inventee', RELANCES_SMTP_HOTE: 'smtp.exemple.test', RELANCES_SMTP_PORT: '465', RELANCES_SMTP_UTILISATEUR: 'u', RELANCES_SMTP_MOT_DE_PASSE: 'p', RELANCES_EXPEDITEUR: 'noreply@vrm.exemple.test' };
  globalThis.VRM_EDITEUR = undefined;   // l'éditeur pas rempli : aucune mention au pied

  // Les contrôles communs d'un e-mail reçu.
  const forme = (nom, m, { facultatif, bouton = 1, marque = false } = {}) => {
    dit(m.texte.length > 40 && m.html.length > 400, `${nom} : multipart, texte brut ET HTML`, `${m.texte.length} / ${m.html.length}`);
    dit(!/<script/i.test(m.html) && !/<script/i.test(m.tete), `${nom} : aucun <script> dans le HTML`);
    dit(!/encaiss/i.test(m.texte + m.html + m.sujet), `${nom} : jamais « encaissé »`);
    dit(boutons(m.html) === bouton, `${nom} : ${bouton ? 'UN seul bouton' : 'aucun bouton'} (liens avant le pied)`, boutons(m.html));
    dit(/display:none;max-height:0/.test(m.html) && /max-width:600px/.test(m.html) && /<!--\[if mso\]><table role="presentation" width="600"/.test(m.html) && /<meta name="color-scheme" content="light dark">/.test(m.html) && /prefers-color-scheme:dark/.test(m.html), `${nom} : préentête caché, largeur 600 (Outlook compris, 11 nov.), mode sombre toléré`);
    // (11 nov., lot emails-envoyes) Plus aucune image : l'en-tête est un MOT — « VRM » en
    // petit pour ses propres e-mails, le nom de la boutique pour la facture (rien de VRM).
    dit(!/<img\b/i.test(m.html) && (marque ? !/>VRM</.test(m.html) : />VRM<\/div>/.test(m.html)), `${nom} : ${marque ? 'le nom du vendeur en tête, rien de VRM' : 'le mot « VRM » en tête'}, aucune image`);
    if (facultatif !== undefined) dit(/Gérer mes e-mails/.test(m.html) === facultatif && /Gérer mes e-mails/.test(m.texte) === facultatif, `${nom} : « Gérer mes e-mails » ${facultatif ? 'au pied (e-mail facultatif)' : 'absent (e-mail non facultatif)'}`);
    dit(m.sujet.length > 0 && m.sujet.length <= 60, `${nom} : sujet court (${m.sujet.length} car.)`, m.sujet);
  };

  try {
    // ── 1. Les e-mails de l'essai (j1, j3, j6) ─────────────────────────────
    await section('essai', [RE], async () => {
    const fin = new Date(Date.now() + 3 * 86400e3).toISOString();
    for (const [etape, opts] of [['j1', {}], ['j3', { relie: { vinted: false, emails: true, notifications: false } }], ['j6', {}]]) {
      const lien = RE.lienDesinscription('0b6f2f4e-1111-4222-8333-444455556666', 'cle-de-service-inventee');
      const t = RE.texteRelance(etape, { fin, lien, ...opts });
      await envoyer({ a: 'vendeur@exemple.test', sujet: t.sujet, texte: t.texte, html: t.html });
      const m = dernier();
      forme(`essai ${etape}`, m, { facultatif: true });
      dit(/mode=relances/.test(m.html.split('<hr')[1] || '') && !/mode=relances/.test(corpsAvantPied(m.html)), `essai ${etape} : « ne plus recevoir » au pied seulement`);
    }
    {
      const t = RE.texteRelance('j3', { fin, relie: { vinted: true, emails: null, notifications: true }, lien: 'https://vrm.center/x' });
      dit(!/Tout est relié/.test(t.sujet), 'essai j3 : « pas su » ne donne jamais le sujet « Tout est relié »', t.sujet);
    }
    });

    // ── 2. Le bilan du mois (la vraie fonction du cron, `bilanMoisVendeur`) ─
    await section('bilan', [BM], async () => {
    const T = Date.parse('2026-11-01T06:00:00+01:00');
    const iso = (x) => new Date(x).toISOString();
    const d = {
      comptes: [{ uid: 'A', login: `vendeuse${MAL}` }],
      commandes: { A: { orders: [{ transaction_id: 901, title: `Paire inventée ${MAL}`, status: 'Commande finalisée', date: iso('2026-10-12T10:00:00+02:00'), price: { amount: '87.5' } }], cap: iso('2026-11-01T05:00:00+01:00') } },
      masquesTx: new Set(), masquesComptes: new Set(), panneau: {}, exclusAutres: {}, lbc: [], ebay: [], vestiaire: [], versements: { 901: iso('2026-10-20T10:00:00+02:00') },
    };
    let memo = null; const envois = [];
    const r = await BM.bilanMoisVendeur({
      owner: '0b6f2f4e-1111-4222-8333-444455556666', maintenant: T, compteur: { reste: 5 }, config: { pret: true }, service: 'cle-de-service-inventee',
      lireChoix: async () => ({ actif: true }), lireEnvois: async () => memo, ecrireEnvois: async (x) => { memo = x; return true; },
      lireDonnees: async () => d, lirePub: async () => null, adresse: async () => ({ etat: 'ok', email: 'vendeur@exemple.test' }),
      envoyer: async (msg) => { envois.push(msg); return envoyer(msg); },
    });
    dit(r && r.issue === 'envoye' && envois.length === 1, 'bilan : la fonction du cron envoie UN e-mail par le client SMTP', JSON.stringify(r));
    const mb = dernier();
    forme('bilan', mb, { facultatif: true });
    dit(/&lt;script&gt;/.test(mb.html), 'bilan : le titre de la plus belle vente est échappé (&lt;script&gt;)');
    dit(/Bénéfice brut : —/.test(mb.texte) && !ZERO.test(mb.texte + mb.html), 'bilan : bénéfice pas su ⇒ « — », jamais « 0,00 € »', mb.texte.split('\n').find((l) => /Bénéfice/.test(l)));
    dit(/font-variant-numeric:tabular-nums/.test(mb.html), 'bilan : chiffres alignés (tabular-nums)');
    dit(/Vendu :/.test(mb.texte) && /Reçu :/.test(mb.texte), 'bilan : vendu et reçu, l’un à côté de l’autre');
    // Un partiel : la couverture « sur N ventes de M » à côté du chiffre ; un partiel nul s'écrit « — ».
    const part = BM.texteBilanMois({ libelle: 'octobre 2026', vendu: { etat: 'su', n: 6, eur: 300 }, recu: { etat: 'partiel', eur: 0, manque: ['eBay (illisible)'] }, benefice: { etat: 'partiel', brut: 120, n: 6, nCout: 4, manque: ['2 prix d’achat manquent'] }, meilleure: null }, { lien: 'https://vrm.center/x' });
    // (13 nov., lot 53) Jamais « au moins » devant un bénéfice (src/beneficeNoms.js).
    dit(/Bénéfice brut : 120,00\s€ \(sur 4 ventes de 6 · 2 prix d’achat manquent\)/.test(part.texte) && !/Bénéfice brut : au moins/.test(part.texte), 'bilan : bénéfice partiel avec sa couverture « sur 4 ventes de 6 » et le manque nommé, sans « au moins »', part.texte.split('\n').find((l) => /Bénéfice/.test(l)));
    dit(/Reçu : —/.test(part.texte) && !ZERO.test(part.texte + part.html), 'bilan : un reçu partiel nul s’écrit « — » (jamais « au moins 0,00 € »)');
    const nul = BM.texteBilanMois({ libelle: 'octobre 2026', vendu: { etat: 'su', n: 1, eur: 50 }, recu: { etat: 'su', eur: 50 }, benefice: { etat: 'partiel', brut: 0, n: 2, nCout: 1, manque: ['1 prix d’achat manque'] }, meilleure: null }, {});
    dit(!/au moins 0/i.test(nul.texte) && /Bénéfice brut : —/.test(nul.texte), 'bilan : un bénéfice partiel nul s’écrit « — »', nul.texte.split('\n').find((l) => /Bénéfice/.test(l)));
    });

    // ── 3. Le lien de preuve d'adresse (le serveur l'écrit, le script Gmail l'envoie) ─
    await section('preuve', [PA], async () => {
      const e = PA.emailConfirmation(`x${MAL}@exemple.test`, 'https://vrm.center/?confirmer-adresse=abc');
      await envoyer({ a: 'vendeur@exemple.test', sujet: e.sujet, texte: e.texte, html: e.html });
      const m = dernier();
      forme('preuve d’adresse', m, { facultatif: false });
      dit(/confirme ton adresse/i.test(m.sujet), 'preuve d’adresse : le sujet garde « confirme ton adresse » (email-inbound le reconnaît)', m.sujet);
      dit(/&lt;script&gt;/.test(m.html), 'preuve d’adresse : l’adresse injectée est échappée');
    });

    // ── 4. La facture Pro (à l'acheteur) et l'essai de SA boîte ────────────
    await section('facture', [FR, FP], async () => {
      const contenu = { type: 'facture', numero: 'FA-2026-0007', vendeur: { nom: `Boutique ${MAL}` }, acheteur: { nom: `Acheteur ${MAL}` }, lignes: [{ designation: `Paire ${MAL}` }] };
      const mail = FR.emailFacture({ message: `Bonjour {acheteur},\n\nVoici {numero}.\n${MAL}` }, contenu, { via: 'vrm' });
      await envoyer({ a: 'acheteur@exemple.test', sujet: mail.sujet, texte: mail.texte, html: mail.html, nomDe: mail.nomExpediteur, pieces: [{ nom: 'Facture-FA-2026-0007.pdf', octets: Buffer.from('%PDF-1.4 banc') }] });
      const m = dernier();
      forme('facture Pro', m, { facultatif: false, bouton: 0, marque: true });
      dit(/&lt;script&gt;/.test(m.html) && /FA-2026-0007/.test(m.html) && /pièce jointe/.test(m.html), 'facture Pro : message et nom échappés, pièce jointe dite');
      dit(/^From: =\?UTF-8\?B\?/m.test(m.tete) && !/^From:.*<script/m.test(m.tete), 'facture Pro : un nom de vendeur à caractères spéciaux part encodé (l’adresse ne casse pas)', (/^From:.*$/m.exec(m.tete) || [])[0]);
      dit(/Content-Disposition: attachment; filename="Facture-FA-2026-0007.pdf"/.test(f.recus[f.recus.length - 1]), 'facture Pro : le PDF part en pièce jointe');
      const b = FP.mailBoiteEssai();
      await envoyer({ a: 'vendeur@exemple.test', sujet: 'Essai d’envoi de tes factures', ...b });
      forme('essai de la boîte des factures', dernier(), { facultatif: false, bouton: 0 });
    });

    // ── 5. « M'envoyer un e-mail d'essai » ─────────────────────────────────
    await section('mail-essai', [ME], async () => {
      const compteurs = new Map();
      const reserver = async (id, decider) => { const c = decider(compteurs.get(id) || null); if (c.data) compteurs.set(id, c.data); return { valeur: c.valeur }; };
      const owner = '0b6f2f4e-1111-4222-8333-444455556666';
      const env = { ...ENV };
      const avant = f.recus.length;
      const tHeure = Date.parse('2026-11-08T22:00:00Z');
      const essai = (o = {}) => ME.envoyerMailEssai({ owner, env, maintenant: tHeure, envoyer: (x) => envoyer(x), adresse: async () => ({ etat: 'ok', email: 'compte@exemple.test' }), reserver, ...o });
      const r1 = await essai();
      const m = dernier();
      dit(r1.code === 200 && r1.corps.ok && f.recus.length === avant + 1, 'e-mail d’essai : sur son clic, il part', JSON.stringify(r1));
      dit(/^To: <compte@exemple\.test>$/m.test(m.tete), 'e-mail d’essai : à l’adresse DU COMPTE (lue par le serveur)');
      forme('e-mail d’essai', m, { facultatif: false });
      await essai(); await essai();
      const r4 = await essai();
      dit(r4.code === 429 && f.recus.length === avant + 3, 'e-mail d’essai : 3 par heure, le 4e est refusé (rien ne part)', `${r4.code} · ${f.recus.length - avant}`);
      const r5 = await essai({ maintenant: tHeure + 3600e3 + 1000 });
      dit(r5.code === 200, 'e-mail d’essai : une heure après, il repart', r5.code);
      const n0 = f.recus.length;
      const rNc = await ME.envoyerMailEssai({ owner: 'aaaaaaaa-1111-4222-8333-444455556666', env: { ...ENV, RELANCES_SMTP_HOTE: '' }, envoyer: (x) => envoyer(x), adresse: async () => ({ etat: 'ok', email: 'x@exemple.test' }), reserver });
      const rMuette = await ME.envoyerMailEssai({ owner: 'bbbbbbbb-1111-4222-8333-444455556666', env, envoyer: (x) => envoyer(x), adresse: async () => ({ etat: 'ok', email: 'x@exemple.test' }), reserver: async () => null });
      const rNonConf = await ME.envoyerMailEssai({ owner: 'cccccccc-1111-4222-8333-444455556666', env, envoyer: (x) => envoyer(x), adresse: async () => ({ etat: 'non-confirmee' }), reserver });
      dit(rNc.code === 503 && rMuette.code === 503 && rNonConf.code === 409 && f.recus.length === n0, 'e-mail d’essai : pas configuré, base muette ou adresse non confirmée ⇒ rien ne part', `${rNc.code} ${rMuette.code} ${rNonConf.code}`);
      const src = fs.readFileSync(path.join(R, 'api', 'compte.js'), 'utf8');
      dit(/envoyerMailEssai\(\{\s*owner:\s*u\.id\s*\}\)/.test(src), 'e-mail d’essai : la route ne passe QUE l’identifiant de la session (aucune adresse du corps)');
    });

    // ── 6. Le gabarit lui-même ─────────────────────────────────────────────
    await section('gabarit', [G], async () => {
      const g = G.gabaritMail({ titre: MAL, paras: [MAL], chiffres: [[MAL, MAL, MAL]], liste: [MAL], bouton: { mot: MAL, url: 'javascript:alert(1)' }, pied: { texte: MAL, lien: 'javascript:alert(2)', motLien: MAL } });
      dit(!/<script/i.test(g.html) && !/javascript:/i.test(g.html), 'gabarit : tout est échappé, une URL javascript: n’est jamais posée dans un lien');
      dit(boutons(g.html) === 0, 'gabarit : un bouton sans URL sûre ne se dessine pas');
      const vide = G.gabaritMail({ titre: 't', paras: ['p'], bouton: { mot: 'Ouvrir', url: 'https://vrm.center' }, pied: { texte: 'x' } , editeur: { nom: null, adresse: null } });
      const plein = G.gabaritMail({ titre: 't', paras: ['p'], bouton: { mot: 'Ouvrir', url: 'https://vrm.center' }, pied: { texte: 'x' }, editeur: { nom: 'Éditeur inventé', forme: 'EI', adresse: '1 rue inventée' } });
      dit(((vide.html.split('<hr')[1] || '').match(/<p class="vrm-doux"/g) || []).length === 2 && vide.texte.split('—\n')[1].split('\n').length === 1 && !/Éditeur inventé/.test(vide.html) && /Éditeur inventé · EI/.test(plein.html) && /1 rue inventée/.test(plein.texte), 'gabarit : l’identité de l’éditeur au pied seulement si elle est remplie (rien d’inventé)');
      dit(/Le bouton ne marche pas \?/.test(plein.html.split('<hr')[1] || '') && /https:\/\/vrm\.center/.test(plein.texte), 'gabarit : le lien en clair de secours, au pied (et dans le texte brut)');
      dit(/line-height:44px/.test(plein.html) && /#0071e3/i.test(plein.html) && !/#(7c3aed|8b5cf6|a855f7|6d28d9)/i.test(plein.html), 'gabarit : bouton bleu Apple de 44 px, aucun violet');
    });
  } catch (e) {
    dit(false, 'le banc a levé', e && e.stack);
  } finally { f.serveur.close(); }
  return { ok, ko };
}

// ── Les mutations : chaque règle réaffaiblie DOIT faire rougir le banc ──────
const MUTATIONS = [
  ['échappement des chiffres retiré', 'api/_lib/mail-gabarit.js', 'font-feature-settings:\'tnum\'">${echapperHtml(v)}', 'font-feature-settings:\'tnum\'">${v}'],
  ['URL de bouton non vérifiée', 'api/_lib/mail-gabarit.js', "const urlBouton = bouton ? urlSure(bouton.url) : '';", "const urlBouton = bouton ? String(bouton.url) : '';"],
  ['bilan pas « facultatif »', 'api/_lib/bilan-mois.js', 'chiffres, suite, facultatif: true,', 'chiffres, suite,'],
  ['« au moins 0 » réautorisé pour le bénéfice', 'api/_lib/bilan-mois.js', "be.etat === 'pas-su' ? '—' : val(be.etat, be.brut, euros)", "be.etat === 'pas-su' ? '—' : `${be.etat === 'partiel' ? 'au moins ' : ''}${euros(be.brut)}`"],
  ['plafond des e-mails d’essai relâché', 'api/_lib/mail-essai.js', 'export const MAX_PAR_HEURE = 3;', 'export const MAX_PAR_HEURE = 30;'],
  ['lien en clair dans le corps (2e lien)', 'api/_lib/mail-gabarit.js', '    + btn\n', '    + btn + (urlBouton ? `<a href="${echapperHtml(urlBouton)}">${echapperHtml(urlBouton)}</a>` : \'\')\n'],
  ['nom d’expéditeur écrit brut', 'api/_lib/smtp.js', '`From: ${nomDe ? `${nomEncode(nomDe)} `', '`From: ${nomDe ? `${String(nomDe)} `'],
  ['mentions inventées', 'api/_lib/mail-gabarit.js', "  if (!nom) return [];", "  if (!nom) return ['VRM SAS · 1 rue de Paris'];"],
];
function copieArbre(dest) {
  for (const d of ['api', 'src/facturePro', 'public/legal']) fs.cpSync(path.join(RACINE, d), path.join(dest, d), { recursive: true });
  // Les modules de src/ que l'api importe (règles partagées).
  for (const fichier of fs.readdirSync(path.join(RACINE, 'src'))) if (/\.js$/.test(fichier)) fs.copyFileSync(path.join(RACINE, 'src', fichier), path.join(dest, 'src', fichier));
  fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(dest, 'package.json'));
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(dest, 'node_modules')); } catch (_) {}
}

(async () => {
  if (process.argv.includes('--mutations')) {
    let rouges = 0;
    for (const [nom, fichier, de, vers] of MUTATIONS) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mails-mut-'));
      try {
        copieArbre(tmp);
        const p = path.join(tmp, fichier); const s = fs.readFileSync(p, 'utf8');
        if (!s.includes(de)) { console.log(`❌ mutation « ${nom} » : texte introuvable`); rouges++; continue; }
        fs.writeFileSync(p, s.replace(de, vers));
        const r = await banc(tmp, { silencieux: true });
        if (r.ko > 0) console.log(`✅ mutation « ${nom} » ⇒ ${r.ko} rouge(s)`);
        else { console.log(`❌ mutation « ${nom} » : le banc reste VERT`); rouges++; }
      } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    }
    console.log(`\n${MUTATIONS.length - rouges}/${MUTATIONS.length} mutations détectées`);
    process.exit(rouges ? 1 : 0);
  }
  const r = await banc(process.argv[2] ? path.resolve(process.argv[2]) : RACINE);
  console.log(`\n${r.ok} ✅ · ${r.ko} ❌`);
  process.exit(r.ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); process.exit(1); });
