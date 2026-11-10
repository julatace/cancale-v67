// ════════════════════════════════════════════════════════════════════════════
//  L'ENVOI AUTOMATIQUE DES FACTURES PRO (10 nov., lot Q)
// ════════════════════════════════════════════════════════════════════════════
// Appelé par `api/ship-reminders.js?moment=factures` (GitHub, toutes les 30 min :
// .github/workflows/factures-auto.yml ; CRON_SECRET). Aucune nouvelle fonction api/.
//
// ÉTEINT PAR DÉFAUT. Seuls les vendeurs dont la fiche `vrm_pro_facture` porte
// `envoiAuto: true` ET une date `envoiAutoDepuis` (posées par SON geste dans « Ma
// facture ») sont visités. Pour chacun, dans l'ordre :
//   1. la PAUSE, dite et rien envoyé : fiche incomplète (le manque nommé), envoi par
//      VRM sans serveur d'envoi (`RELANCES_SMTP_*`), sans son e-mail (copie et
//      « répondre à »), ou boîte du vendeur pas connectée ;
//   2. les ventes Pro arrivées depuis qu'il a allumé (48 h au plus) : la preuve de
//      l'acheteur relue PAR LE SERVEUR (src/facturePro/rattachement.js) et la règle
//      d'éligibilité (src/facturePro/registre.js `eligibleAuto`) — jamais une
//      adresse devinée, jamais une vente annulée, chaque facture une seule fois ;
//   3. émettre puis envoyer par les MÊMES fonctions que son clic
//      (api/_lib/facture-pro.js : numéro par comparer-et-échanger, preuve relue,
//      plafond de 50 / jour, « en cours » posé avant d'envoyer) ;
//   4. le JOURNAL `vrm_facture_auto` (n° de transaction, issue, raison — aucun
//      e-mail d'acheteur), écrit par comparer-et-échanger ; lecture ratée ⇒ rien.
// Une base muette ⇒ le vendeur est laissé pour le passage suivant (« pas su »).
import { lireLigne, lireListe, lirePreuveEtCommandes, emettre, envoyer, configurationEnvoiVrm, lireBoite, creer, modifierSi, condRev, nouveauRev, ID_AUTO, idFacture } from './facture-pro.js';
import { manquantsVendeur, emailValide, adresseVintedLisible } from '../../src/facturePro/regle.js';
import { etatVentePro, eligibleAuto, autoAllume, AUTO_FENETRE_MS } from '../../src/facturePro/registre.js';
import { classifyOrderStatus } from './ventes-regle.js';

export const MAX_PAR_VENDEUR = 5;
const ESSAIS_MAX = 100;
const TX_RE = /^\d{4,20}$/;
const capture = () => { const r = { code: 0, corps: null }; r.status = (c) => { r.code = c; return { json: (j) => { r.corps = j; return r; } }; }; return r; };

// Pourquoi rien ne peut partir pour ce vendeur (null = rien n'empêche).
export function pauseAuto(cfg, env, boite) {
  const mv = manquantsVendeur(cfg || {});
  if (mv.length) return { code: 'fiche', texte: `Ta fiche « Ma facture » n'est pas complète : il manque ${mv.map((m) => m.l).join(', ')}. Rien n'est parti.` };
  if (cfg.envoiPar === 'boite') {
    if (boite === undefined) return { code: 'pas-su', texte: "La base n'a pas répondu. Rien n'est parti." };
    if (!boite) return { code: 'boite', texte: "Tu as choisi d'envoyer depuis ta boîte, mais elle n'est pas connectée. Rien n'est parti." };
    return null;
  }
  const conf = configurationEnvoiVrm(env);
  if (!conf.pret) return { code: 'smtp', texte: "L'envoi par VRM n'est pas encore ouvert : rien n'est parti. Choisis « Depuis ma propre boîte » pour envoyer." };
  if (!emailValide(cfg.email)) return { code: 'email', texte: "Ajoute ton e-mail dans « Ma facture » (copie et réponses). Rien n'est parti." };
  return null;
}

async function ecrireJournal(owner, lu, maj) {
  for (let i = 0; i < 3; i++) {
    const base = i === 0 ? lu : await lireLigne(ID_AUTO, owner, 'data');
    if (base === undefined) return false;
    const essais = { ...((base && base.essais) || {}), ...maj.essais };
    const garde = Object.entries(essais).sort((a, b) => String(b[1].at).localeCompare(String(a[1].at))).slice(0, ESSAIS_MAX);
    const data = { v: 1, at: maj.at, pause: maj.pause, essais: Object.fromEntries(garde), rev: nouveauRev() };
    const w = base ? await modifierSi(ID_AUTO, owner, condRev(base.rev), data) : await creer(ID_AUTO, owner, data);
    if (w === 'ok') return true;
    if (w === 'ko') return false;
  }
  return false;
}

// Un vendeur. Rend { fait, envoyees, refusees, pause, raison? }.
export async function factureAutoVendeur(owner, { maintenant = Date.now(), env = process.env } = {}) {
  const [cfg, journal] = await Promise.all([lireLigne('vrm_pro_facture', owner), lireLigne(ID_AUTO, owner, 'data')]);
  if (cfg === undefined || journal === undefined) return { fait: false, raison: 'pas-su' };
  if (!autoAllume(cfg)) return { fait: true, envoyees: 0, refusees: 0, eteint: true };
  const at = new Date(maintenant).toISOString();
  const boite = cfg.envoiPar === 'boite' ? await lireBoite(owner) : null;
  const pause = pauseAuto(cfg, env, boite);
  if (pause) { await ecrireJournal(owner, journal, { at, pause, essais: {} }); return { fait: pause.code !== 'pas-su', envoyees: 0, refusees: 0, pause: pause.code }; }
  // Les ventes Pro arrivées depuis qu'il a allumé, dans la fenêtre (projection scalaire).
  const depuis = new Date(Math.max(Date.parse(cfg.envoiAutoDepuis), maintenant - AUTO_FENETRE_MS) - 15 * 60 * 1000).toISOString();
  const mails = await lireListe(`id=like.email_sale_*&data->>pro=eq.true&data->>receivedAt=gte.${encodeURIComponent(depuis)}&select=transaction:data->>transaction,receivedAt:data->>receivedAt`, owner);
  if (mails === undefined) return { fait: false, raison: 'pas-su' };
  const txs = [...new Set(mails.map((m) => String((m && m.transaction) || '')).filter((t) => TX_RE.test(t)))];
  const essais = {};
  let envoyees = 0, refusees = 0, faits = 0, pauseFin = null;
  for (const tx of txs) {
    if (faits >= MAX_PAR_VENDEUR) break;
    const deja = journal && journal.essais && journal.essais[tx];
    const [facture, avoir] = await Promise.all([lireLigne(idFacture(tx), owner, 'id,emiseLe:data->>emiseLe,numero:data->>number,envoi:data->envoi,envois:data->envois,preuve:data->preuve->>tx,transaction:data->>transaction,buyerEmail:data->>buyerEmail'), lireLigne(idFacture(tx, true), owner, 'id,emiseLe:data->>emiseLe')]);
    if (facture === undefined || avoir === undefined) return { fait: false, raison: 'pas-su' };
    // Tentative déjà faite (à la main ou seule) : jamais retentée — sans relire la preuve.
    if (facture && Array.isArray(facture.envois) && facture.envois.length) continue;
    if (deja && deja.issue !== 'pas-prouvee') continue;
    const lu = await lirePreuveEtCommandes(owner, tx, facture);
    if (lu === undefined) return { fait: false, raison: 'pas-su' };
    const it = etatVentePro({ tx, mails: lu.mails, facture, avoir, commandes: lu.commandes, classer: classifyOrderStatus, adresseLisible: adresseVintedLisible });
    if (!eligibleAuto(it, { cfg, essai: deja || null, maintenant })) {
      if (it.etat === 'pas-prouvee' && !(deja && maintenant - (Date.parse(deja.at) || 0) < 2 * 3600 * 1000)) { essais[tx] = { issue: 'pas-prouvee', raison: it.raison, at }; faits++; }
      continue;
    }
    faits++;
    if (!it.emise) {
      const r1 = capture();
      await emettre(owner, { tx, confirme: true, compte: it.compte }, r1);
      if (r1.code !== 200) {
        essais[tx] = { issue: 'pas-emise', raison: String((r1.corps && r1.corps.message) || 'la facture n’a pas pu être émise').slice(0, 300), at };
        if (r1.code === 503) break;
        continue;
      }
    }
    const r2 = capture();
    await envoyer(owner, { tx, confirme: true }, r2, env, { auto: true });
    const c = r2.corps || {};
    if (c.issue === 'envoye') { envoyees++; essais[tx] = { issue: 'envoyee', raison: '', at }; continue; }
    refusees++;
    essais[tx] = { issue: c.issue === 'incertain' ? 'incertaine' : 'refusee', raison: String((c.envoi && c.envoi.message) || c.message || 'pas envoyée').slice(0, 300), at };
    if (r2.code === 429) { pauseFin = { code: 'plafond', texte: String(c.message || 'Plafond du jour atteint.') }; break; }
    if (r2.code === 503) { pauseFin = c.erreur === 'vrm-smtp' ? { code: 'smtp', texte: "L'envoi par VRM n'est pas encore ouvert : rien n'est parti. Choisis « Depuis ma propre boîte » pour envoyer." } : null; break; }
  }
  await ecrireJournal(owner, journal, { at, pause: pauseFin, essais });
  return { fait: true, envoyees, refusees, pause: pauseFin ? pauseFin.code : null };
}

// Le passage : les vendeurs qui ont ALLUMÉ l'envoi automatique, dans le temps donné.
export async function passageFacturesAuto({ lire, maintenant = Date.now(), budgetMs = 100000, env = process.env, exclus = [] } = {}) {
  const debut = Date.now();
  const rows = await lire('app_data?id=eq.vrm_pro_facture&data->>envoiAuto=eq.true&select=owner');
  if (!Array.isArray(rows)) return { fait: false, raison: 'pas-su' };
  const owners = [...new Set(rows.map((r) => String((r && r.owner) || '')).filter((o) => o && !exclus.includes(o)))];
  const bilan = { fait: true, vendeurs: owners.length, traites: 0, envoyees: 0, refusees: 0, pauses: 0, echecs: 0, budgetAtteint: false };
  for (const o of owners) {
    if (Date.now() - debut > budgetMs) { bilan.budgetAtteint = true; break; }
    let r;
    try { r = await factureAutoVendeur(o, { maintenant, env }); } catch (_) { r = { fait: false }; }
    bilan.traites++;
    if (!r.fait) { bilan.echecs++; continue; }
    bilan.envoyees += r.envoyees || 0; bilan.refusees += r.refusees || 0; if (r.pause) bilan.pauses++;
  }
  return bilan;
}
