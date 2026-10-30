// ════════════════════════════════════════════════════════════════════════════
// Découpé d'App.jsx (29 octobre) : VintedAccounts et ce qu'eux SEULS utilisent,
// chargés à l'ouverture de l'écran (React.lazy) au lieu du démarrage de l'app.
// Le code n'a pas changé ; ce qu'il partage avec le reste vient d'App.jsx.
// ════════════════════════════════════════════════════════════════════════════
import { conflitAdresseCompte } from "./receptionEmail.js";
import React, { useState, useMemo, useEffect } from "react";
import { ANNONCES_RETIREES, C, FermeAuRetour, GuideReglage, Icon, LignePanne, MESSAGES_RETIRES, PhotoVinted, SUPABASE_URL, ScreenHead, askConfirm, deleteVintedAccount, enTeteSession, fetchVintedAccounts, harvestTs, ligneDeSaSession, lireTout, load, onCloudReady, save, sbAuth, toast, vintedDeChrome, withOwner } from "./App.jsx";


function typeCompteVinted(json) {
  const u = json && typeof json === 'object' ? (json.user && typeof json.user === 'object' ? json.user : null) : null;
  if (!u) return null;
  const ba = u.business_account;
  const baid = u.business_account_id;
  if (u.business === true || (ba && typeof ba === 'object') || (baid != null && baid !== 0 && baid !== '')) return true;
  if (u.business === false && (ba == null) && (baid == null || baid === 0 || baid === '')) return false;
  return null;
}

const familiesDeCompte = (uid, id, scopes) => {
  const hp = `harvest_${uid}_`, cp = `coffre_${uid}_`;
  if (id.startsWith(cp)) return scopes.annonces;          // le coffre = annonces archivées
  if (!id.startsWith(hp)) return false;                   // garde EXACTE (pas de 35→352)
  const r = id.slice(hp.length);
  if (/^(listings$|enligne$|item_)/.test(r)) return scopes.annonces;   // `enligne` : la relecture publique (5.170)
  if (/^label/.test(r)) return scopes.bordereaux;          // les bordereaux captés (PDF) — séparés des ventes (26 oct.)
  if (/^releve_/.test(r)) return scopes.releves;           // les relevés de versement — séparés des ventes
  if (/^(orders_sold$|txn_|billing$)/.test(r)) return scopes.ventes;
  if (/^(orders_purchased$)/.test(r)) return scopes.achats;
  if (/^(conv_)/.test(r)) return scopes.messages;
  // Le reste (seen_urls, diag, offer_statuts…) ne part qu'avec « tout le compte ».
  return !!scopes.compte;
};
const supprimerDonneesCompte = async (uid0, login, scopes) => {
  const uid = String(uid0 || '').trim();
  if (!uid) return { ok: false, n: 0 };
  let n = 0;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?or=(id.like.harvest_${uid}_*,id.like.coffre_${uid}_*)&select=id`, { headers: sbAuth(), vrmVoirSupprimes: true });
    if (!r.ok) return { ok: false, n: 0 };               // « pas su » : on n'efface rien à l'aveugle
    const rows = await r.json();
    if (!Array.isArray(rows)) return { ok: false, n: 0 };
    const cibles = rows.filter(x => familiesDeCompte(uid, String(x.id), scopes));
    if (cibles.length) {
      const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
        method: 'POST',
        headers: sbAuth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(cibles.map(x => withOwner({ id: x.id, data: { supprime: true, uid, purgedAt: new Date().toISOString() } }))),
      });
      if (!w.ok) return { ok: false, n: 0 };
      n = cibles.length;
    }
    // « Le compte et ses jetons » : la ligne vinted_accounts (DELETE marche là,
    // autre table). Récupérable en reconnectant l'extension sur ce compte.
    if (scopes.compte) {
      try { await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?vinted_user_id=eq.${uid}`, { method: 'DELETE', headers: sbAuth({ Prefer: 'return=minimal' }) }); } catch (_) {}
    }
    return { ok: true, n };
  } catch (_) { return { ok: false, n: 0 }; }
};

function VintedAccounts({ accounts, setAccounts, baseKO, onRetour }) {
  const [loading, setLoading] = useState(false);

  const [labels, setLabels] = useState(() => load('vinted_account_labels', {}));
  const [editingLabel, setEditingLabel] = useState(null);
  const [labelDraft, setLabelDraft] = useState('');
  // Email associé à chaque compte (l'adresse à laquelle Vinted écrit — masquée
  // iCloud ou classique). Sert au serveur pour attribuer chaque email de vente/
  // bordereau au bon compte. Synchronisé (vinted_account_emails).
  const [acctEmails, setAcctEmails] = useState(() => load('vinted_account_emails', {}));
  // Téléphone de chaque compte (Julien, 30 sept. : « pour ceux qui font du
  // multi-compte, savoir si les numéros ont servi »). Saisi à la main — Vinted
  // ne l'expose pas dans ce qu'on capte, on ne le devine pas. Synchronisé.
  const [acctPhones, setAcctPhones] = useState(() => load('vinted_account_phones', {}));
  // §5.49 : étiquettes/emails/téléphones des comptes, synchronisés, lus au
  // montage → froids sur un appareil neuf. Cartes : on ne remplit que si vide,
  // jamais par-dessus une saisie faite pendant le chargement.
  useEffect(() => onCloudReady(() => {
    const vide = (o) => !o || Object.keys(o).length === 0;
    setLabels(n => vide(n) ? load('vinted_account_labels', {}) : n);
    setAcctEmails(n => vide(n) ? load('vinted_account_emails', {}) : n);
    setAcctPhones(n => vide(n) ? load('vinted_account_phones', {}) : n);
  }), []);
  const setAcctPhone = (uid, val) => {
    const u = { ...acctPhones, [String(uid)]: val };
    if (!String(val).trim()) delete u[String(uid)];
    setAcctPhones(u); save('vinted_account_phones', u);
  };
  // Même numéro sur deux comptes : la comparaison se fait chiffres seuls
  // (« 06 12… » et « +33 6 12… » sont le même numéro).
  const telNorm = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.startsWith('33') && d.length === 11 ? '0' + d.slice(2) : d; };
  const [reput, setReput] = useState({}); // { uid: { rating, count, pos, neg } } — note vendeur captée
  const [typesProfil, setTypesProfil] = useState({}); // { uid: true (pro) | false (particulier) } — lu dans le profil capté
  const [photosProfil, setPhotosProfil] = useState({}); // { uid: adresse de la photo de profil Vinted } — lue dans le profil capté
  const setAcctEmail = (uid, val) => {
    const conflit=conflitAdresseCompte(acctEmails,uid,val);
    if(conflit){const autre=accounts.find(a=>String(a.vinted_user_id)===conflit);toast(`Cette adresse est déjà associée à ${autre?.login||'un autre compte Vinted'}. Chaque compte doit avoir son adresse.`);return;}
    const u = { ...acctEmails, [String(uid)]: val.trim() };
    if (!u[String(uid)]) delete u[String(uid)];
    setAcctEmails(u); save('vinted_account_emails', u);
  };
  // Auto-remplissage : l'extension capte le profil Vinted (users/current) qui
  // contient l'email du compte. On remplit les champs vides automatiquement —
  // la saisie manuelle reste possible et n'est jamais écrasée.
  useEffect(() => { (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.harvest_*_profile&select=id,data`, {
        headers: sbAuth(),
      });
      if (!res.ok) return;
      const rows = await res.json();
      // Note vendeur (feedback_reputation 0..1) + nb d'avis, si Vinted les fournit.
      const rep = {};
      rows.forEach(r => {
        const uid = String((r.data && r.data.uid) || ((r.id || '').match(/^harvest_(\d+)_profile$/) || [])[1] || '');
        const usr = r.data && r.data.payload && r.data.payload.user;
        if (uid && usr) {
          const rating = typeof usr.feedback_reputation === 'number' ? usr.feedback_reputation : null;
          const count = Number.isFinite(usr.feedback_count) ? usr.feedback_count : null;
          if (rating != null || count != null) rep[uid] = { rating, count, pos: usr.positive_feedback_count, neg: usr.negative_feedback_count };
        }
      });
      if (Object.keys(rep).length) setReput(rep);
      // Photo de profil Vinted (Julien, 27 oct. : « dans Comptes liés, la photo
      // de profil, pour tous les comptes »). Le profil capté la porte déjà ;
      // un compte sans photo sur Vinted garde son initiale.
      const ph = {};
      rows.forEach(r => {
        const uid = String((r.data && r.data.uid) || ((r.id || '').match(/^harvest_(\d+)_profile$/) || [])[1] || '');
        const photo = r.data && r.data.payload && r.data.payload.user && r.data.payload.user.photo;
        if (!uid || !photo || typeof photo !== 'object') return;
        const th = Array.isArray(photo.thumbnails) ? photo.thumbnails : [];
        const petit = th.find(t => t && /100|150|thumb/.test(String(t.type || '')) && t.url);
        const u = (petit && petit.url) || photo.url || photo.full_size_url || '';
        if (/^https:\/\//.test(u)) ph[uid] = u;
      });
      if (Object.keys(ph).length) setPhotosProfil(ph);
      const typ = {};
      rows.forEach(r => {
        const uid = String((r.data && r.data.uid) || ((r.id || '').match(/^harvest_(\d+)_profile$/) || [])[1] || '');
        const t = typeCompteVinted(r.data && r.data.payload);
        if (uid && typeof t === 'boolean') typ[uid] = t;
      });
      if (Object.keys(typ).length) setTypesProfil(typ);
      setAcctEmails(prev => {
        const u = { ...prev }; let changed = false;
        rows.forEach(r => {
          const uid = String((r.data && r.data.uid) || ((r.id || '').match(/^harvest_(\d+)_profile$/) || [])[1] || '');
          const email = r.data && r.data.payload && r.data.payload.user && r.data.payload.user.email;
          if (uid && email && !u[uid] && !conflitAdresseCompte(u,uid,email)) { u[uid] = email; changed = true; }
        });
        if (changed) save('vinted_account_emails', u);
        return changed ? u : prev;
      });
    } catch (_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })(); }, []);
  // ── DIAGNOSTIC : santé de chaque compte (dernière capture par l'extension) ──
  // Requête LÉGÈRE : on ne lit que la colonne updated_at des lignes harvest_* (pas
  // les gros payloads) → pour chaque compte, la date de dernière capture. Croisé
  // avec updated_at du compte (fraîcheur du token) et la liste des bloqués.
  const [lastCap, setLastCap] = useState({}); // uid -> ms de la dernière capture
  const blockedAccts = useMemo(() => new Set((load('vinted_accounts_blocked', []) || []).map(String)), []);
  useEffect(() => { (async () => {
    try {
      // ⚠️ 1 127 lignes `harvest_*` en base : au-delà de 1 000, Supabase tronque
      // en silence et des comptes n'auraient JAMAIS de fraîcheur (§A1).
      // On écarte aussi les lignes vidées (comptes supprimés) : elles ne disent
      // plus rien sur la fraîcheur d'un compte vivant.
      const rows = await lireTout('id=like.harvest_*&select=id,updated_at,cap:meta->>capturedAt&meta->>supprime=is.null');
      if (!rows) return; const by = {};
      // ⚠️ Revue de la 5.167 : `harvest_{uid}_enligne` est la lecture PUBLIQUE de
      //    son dressing, faite avec la session d'un AUTRE compte (5.167) — ni ses
      //    ventes, ni sa messagerie, ni son porte-monnaie n'ont été lus. Comptée, elle
      //    faisait dire « À jour » à un compte figé depuis trois jours, en permanence
      //    (c'est l'écran qui dit sur quel compte repasser). `ligneDeSaSession`.
      rows.forEach(r => { const m = ligneDeSaSession(r && r.id); if (!m) return; const t = harvestTs(r) || 0; if (t && (!by[m[1]] || t > by[m[1]])) by[m[1]] = t; });
      setLastCap(by);
    } catch (_) {}
  })(); }, []);
  // ÉTAT ÉVALUÉ PAR L'EXTENSION (5.181, `noterEtatCompte`) : actif / banni, lu
  // dans le champ `is_account_banned` du profil Vinted qu'elle reçoit déjà.
  // Trois états : `undefined` en cours · `null` pas su (lecture ratée) · objet lu.
  // « Pas su » ne fait jamais « banni » : on retombe sur ce qu'on savait déjà.
  const [etatExt, setEtatExt] = useState(undefined);
  useEffect(() => {
    let mort = false, t = null;
    const lire = async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_comptes_etat&select=data`, { headers: sbAuth() });
        if (!r.ok) { if (!mort) setEtatExt(null); return; }
        const rows = await r.json();
        if (!Array.isArray(rows)) { if (!mort) setEtatExt(null); return; }
        const d = (rows[0] && rows[0].data) || {};
        if (!mort) setEtatExt((d.comptes && typeof d.comptes === 'object') ? d.comptes : {});
      } catch (_) { if (!mort) setEtatExt(null); }
    };
    lire();
    const f = (e) => { const d = e && e.detail; if (!d || d.type !== 'maj' || d.quoi !== 'etatcompte') return; clearTimeout(t); t = setTimeout(lire, 800); };
    window.addEventListener('vrm:ext', f);
    return () => { mort = true; clearTimeout(t); window.removeEventListener('vrm:ext', f); };
  }, []);
  // ⚠️ 1 compte Vinted = 1 compte VRM (verrou en base, index unique global).
  // Si le compte Vinted ouvert dans TON Chrome n'est pas dans tes comptes liés
  // ET appartient déjà à un AUTRE compte VRM, VRM ne captera rien pour lui :
  // on le DIT clairement (sinon l'écran reste vide, sans explication). Le
  // serveur ne répond qu'un oui/non — jamais QUI le possède. « Pas su » (pas de
  // clé de service, lecture ratée, compte à soi, compte libre) ⇒ pas d'alerte.
  const [vintedPris, setVintedPris] = useState(false);
  const prisRef = React.useRef('');
  useEffect(() => {
    let mort = false;
    const verifier = () => {
      const v = vintedDeChrome();
      const uid = v && v.uid ? String(v.uid) : '';
      if (!uid || accounts.some(a => String(a.vinted_user_id) === uid)) { prisRef.current = ''; setVintedPris(false); return; }
      if (prisRef.current === uid) return; // déjà vérifié ce compte
      prisRef.current = uid;
      fetch(`/api/compte?mode=vinted-pris&id=${encodeURIComponent(uid)}`, { headers: enTeteSession() })
        .then(r => (r.ok ? r.json() : null))
        .then(j => { if (!mort) setVintedPris(j && j.pris ? { login: (v.login || ''), uid } : false); })
        .catch(() => { if (!mort) setVintedPris(false); });
    };
    verifier();
    const f = () => verifier();
    window.addEventListener('vrm:ext', f);
    return () => { mort = true; window.removeEventListener('vrm:ext', f); };
  }, [accounts]);
  const acctHealth = (acc) => {
    const uid = String(acc.vinted_user_id);
    const ev = etatExt && etatExt[uid];
    const evLu = ev && (ev.etat === 'banni' || ev.etat === 'actif') ? ev : null;
    const evQuand = evLu && evLu.at ? (() => { try { return new Date(evLu.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); } catch (_) { return ''; } })() : '';
    // ⚠️⚠️ UN CHOIX N'EST PAS UNE PANNE. Vu en capture le 9 septembre :
    // l'en-tête annonçait « 2 en panne » en ROUGE, et l'un des deux était
    // `liliand653` — le compte que Julien a lui-même EXCLU de l'application
    // (le bandeau juste au-dessus le dit : « 1 compte est exclu »). Sa carte
    // affichait donc « Masqué (annonces + compta) » ET « Pas capté (il y a
    // 38 j) » en rouge, avec le conseil « repasse sur vinted.fr » — c'est-à-dire
    // exactement ce qu'il ne faut PAS faire pour un compte qu'on a mis de côté.
    // Même famille que le panneau de sécurité : une fausse alerte est ce qui
    // fait cesser de lire les vraies. Un compte exclu n'a plus d'état de
    // fraîcheur — il est simplement hors de l'app, en gris, sans consigne.
    // ⚠️ Cette branche vient EN PREMIER, avant même « refusé par Vinted » :
    // masquer un compte est très souvent la RÉPONSE à un blocage (le bouton le
    // dit : « idéal pour un compte bloqué ou fermé »). Une fois le geste fait,
    // l'app n'a plus à le réclamer. La raison reste écrite dans l'infobulle.
    if (hiddenAccts.has(uid)) return { etat: 'exclu', ic: 'eyeOff', label: 'Exclu de l\'app', color: C.muted,
      hint: `Tu as masqué ce compte : ses annonces, ses ventes et ses achats n'apparaissent nulle part.${blockedAccts.has(uid) ? ' (Vinted l\'avait aussi refusé.)' : ''} Sa date de capture ne veut donc plus rien dire ici — rien à rattraper.` };
    // L'extension l'a LU dans le profil Vinted : c'est la preuve la plus forte,
    // elle passe avant la liste locale (un refus 403 vu par cet appareil).
    if (evLu && evLu.etat === 'banni') return { etat: 'bad', source: 'extension', ic: 'alert', label: 'Banni par Vinted', color: C.danger, hint: `Vinted le dit lui-même dans le profil du compte (lu par l'extension${evQuand ? ` le ${evQuand}` : ''}). Rien n'est masqué tout seul : masque-le si tu ne veux plus voir ses annonces.` };
    if (!evLu && blockedAccts.has(uid)) return { etat: 'bad', source: 'appareil', ic: 'alert', label: 'Accès refusé', color: C.warn, hint: 'Vinted a refusé un accès à ce compte. Ce refus ne suffit pas à confirmer un blocage : reconnecte ce compte sur Vinted pour actualiser son état.' };
    // (16 oct.) Julien : « juste s'il est actif ou banni, l'extension doit
    // évaluer l'état du compte ». Deux états sur la pastille ; la fraîcheur de
    // la capture n'est plus une alerte, seulement une ligne grise (`ago`).
    const cap = lastCap[uid];
    const ageH = cap ? (Date.now() - cap) / 3600000 : null;
    const ago = ageH == null ? 'pas encore capté' : ageH < 1 ? 'capté il y a moins d\'une heure' : ageH < 48 ? `capté il y a ${Math.round(ageH)} h` : `capté il y a ${Math.round(ageH / 24)} j`;
    const lu = evLu ? ` · état lu par l'extension${evQuand ? ` le ${evQuand}` : ''}` : '';
    if (!evLu) return { etat: 'inconnu', source: '', ic: 'info', label: 'État non vérifié', color: C.muted, hint: `Le statut de ce compte n'a pas encore pu être confirmé. Ouvre ce compte sur Vinted avec l'extension connectée pour l'actualiser · ${ago}.`, ago };
    return { etat: 'ok', source: evLu ? 'extension' : '', ic: 'check', label: 'Actif', color: C.text, hint: `Compte actif · ${ago}${lu}.`, ago };
  };
  // Comptes exclus de la comptabilité (leurs ventes ne comptent pas).
  const [hiddenAccts, setHiddenAccts] = useState(() => new Set((load('vinted_accounts_hidden', []) || []).map(String)));
  // ⚠️ MASQUER SE DEMANDE, RÉAFFICHER NON. La confirmation vivait sur les puces
  // de l'écran Annonces (Julien masquait des comptes en croyant FILTRER —
  // vérifié en base) ; ces puces sont parties ici le 2 octobre (H1), la
  // confirmation les suit. Le geste retire le compte de partout, sur tous les
  // appareils.
  const toggleAcctCompta = async (uid) => {
    const k = String(uid);
    if (!hiddenAccts.has(k)) {
      const a = (accounts || []).find(x => String(x.vinted_user_id) === k);
      const nom = a ? (labels[a.vinted_user_id] || a.login || `#${k}`) : `#${k}`;
      const ok = await askConfirm({
        title: `Masquer « ${nom} » ?`,
        desc: "Ses annonces disparaissent de l'écran Annonces et ses ventes ne comptent plus dans la comptabilité, sur tous tes appareils. À réserver à un compte fermé ou abandonné — un nouveau tap le réaffiche.",
        ok: 'Masquer', cancel: 'Annuler', danger: true,
      });
      if (!ok) return;
    }
    setHiddenAccts(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); save('vinted_accounts_hidden', [...n]); return n; });
  };

  const startEditLabel = (acc) => { setEditingLabel(acc.vinted_user_id); setLabelDraft(labels[acc.vinted_user_id] || acc.login || ''); };
  const commitLabel = (acc) => {
    const u = { ...labels, [acc.vinted_user_id]: labelDraft.trim() };
    if (!u[acc.vinted_user_id]) delete u[acc.vinted_user_id];
    setLabels(u); save('vinted_account_labels', u);
    setEditingLabel(null);
  };
  const accountName = (acc) => labels[acc.vinted_user_id] || acc.login || `Compte #${acc.vinted_user_id}`;

  // Déconnecter un compte : le retire de l'app (Supabase + state). Utile quand un
  // compte est bloqué/fermé définitivement. On garde son étiquette au cas où.
  const [removing, setRemoving] = useState(null);
  const disconnectAccount = async (acc) => {
    if (!await askConfirm({
      title: `Supprimer « ${accountName(acc)} » ?`,
      // On dit exactement ce qui part, et ce qui reste. « Déconnecter » laissait
      // croire à un simple débranchement — Julien veut choisir ses comptes et
      // supprimer les autres pour de bon.
      desc: "Ses jetons, ses annonces, ses ventes et ses achats captés sont effacés, et l'extension ne le recaptera plus (avant, il revenait tout seul au bout de 10 minutes). Son chiffre d'affaires passé reste dans tes statistiques — c'est de l'argent réellement gagné. Tes numéros de garage et tes factures ne bougent pas. Réversible depuis « Tout réafficher ».",
      ok: 'Supprimer', cancel: 'Garder', danger: true,
    })) return;
    // ⚠️ UNE SEULE QUESTION. Une deuxième feuille s'ouvrait juste après la
    // première (« garder son chiffre d'affaires passé ? ») : deux boîtes à la
    // suite pour un seul geste, et surtout — mesuré au banc — tant qu'on n'y
    // répondait pas, LA SUPPRESSION NE PARTAIT PAS. On garde le comportement
    // sensé par défaut : ses ventes passées restent dans le chiffre d'affaires,
    // parce que c'est de l'argent réellement gagné. Ça ne se devine pas, c'est
    // écrit dans la confirmation ci-dessus.
    const login = String(acc.login || '').trim().toLowerCase();
    if (login) {
      const cur = (load('vinted_ca_keep_removed', []) || []).map(String);
      save('vinted_ca_keep_removed', [...new Set([...cur, login])]);
    }
    // ⚠️ On MASQUE aussi le compte de façon permanente (vinted_accounts_hidden,
    // clé synchronisée). Supprimer la ligne Supabase ne suffit pas : un compte
    // encore connecté dans Chrome est RE-CAPTURÉ par l'extension au prochain
    // passage sur Vinted, et il revenait dans les annonces + les stats (plainte
    // de Julien : « je l'ai supprimé mais il est toujours là »). Le masque, lui,
    // survit à la re-capture (il est posé sur l'uid, pas sur la ligne du compte)
    // → annonces ET stats l'excluent pour de bon (skipAcc / acctOff).
    // ⚠️ ON NE MASQUE PLUS EN PLUS DE SUPPRIMER. `deleteVintedAccount` inscrit
    // désormais le compte dans `vrm_blocked_accounts` (l'extension refuse de le
    // recapter) ET vide ses lignes moissonnées. Ajouter en prime son uid à
    // `vinted_accounts_hidden` — une clé SYNCHRONISÉE — le faisait apparaître
    // « masqué » sur tous les appareils alors qu'il était supprimé : c'est la
    // moitié de la confusion « mes comptes sont tous masqués » (§5.09/§5.10).
    setRemoving(acc.vinted_user_id);
    const r = await deleteVintedAccount(acc.vinted_user_id, acc.login);
    setRemoving(null);
    // ⚠️ Le mémo « ne le recapte plus » et la suppression des jetons sont DEUX
    //    choses. Quand le mémo n'a pas pu être écrit (base injoignable), le
    //    compte est bien parti mais l'extension peut le ramener : on le dit, et
    //    on dit le geste. Se taire, c'est le défaut d'origine (« je l'ai
    //    supprimé mais il est toujours là »).
    toast(!r.ok ? 'Échec de la suppression — réessaie.'
      : r.memo ? `« ${accountName(acc)} » supprimé.`
      : `« ${accountName(acc)} » supprimé — mais la base n'a pas répondu pour le mémo. S'il réapparaît, resupprime-le.`);
    setAccounts(prev => prev.filter(a => a.vinted_user_id !== acc.vinted_user_id));
  };

  // ── ANNONCES RETIRÉES POUR DE BON (26 oct.) — voir `annoncesRetirees` ─────────
  const [retireesAnn, setRetireesAnn] = useState(() => { const m = load(ANNONCES_RETIREES, {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; });
  useEffect(() => onCloudReady(() => setRetireesAnn((v) => (Object.keys(v || {}).length ? v : ((() => { const m = load(ANNONCES_RETIREES, {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; })())))), []);
  const retirerAnnoncesPourDeBon = async (acc) => {
    if (!acc) return;
    if (!await askConfirm({
      title: `Retirer les annonces de « ${accountName(acc)} » ?`,
      desc: "Ses annonces sortent de VRM pour de bon — elles ne reviennent pas, même si l'extension recapte ce compte. Ses ventes, sa compta, ses achats et ses messages restent. Rien n'est supprimé sur Vinted. Tu peux les remettre depuis cette carte.",
      ok: 'Retirer ses annonces', cancel: 'Annuler',
    })) return;
    const uid = String(acc.vinted_user_id);
    const suivant = { ...retireesAnn, [uid]: { at: new Date().toISOString(), login: acc.login || '' } };
    setRetireesAnn(suivant); save(ANNONCES_RETIREES, suivant);
    setDelCible(null);
    toast(`Annonces de « ${accountName(acc)} » retirées — rouvre l'onglet Annonces.`);
  };
  const remettreAnnonces = (acc) => {
    const uid = String(acc.vinted_user_id);
    const suivant = { ...retireesAnn }; delete suivant[uid];
    setRetireesAnn(suivant); save(ANNONCES_RETIREES, suivant);
    toast(`Annonces de « ${accountName(acc)} » remises.`);
  };

  // ── MESSAGES RETIRÉS POUR DE BON (26 oct.) — voir `messagesRetires` ──────────
  const [retiresMsg, setRetiresMsg] = useState(() => { const m = load(MESSAGES_RETIRES, {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; });
  useEffect(() => onCloudReady(() => setRetiresMsg((v) => (Object.keys(v || {}).length ? v : ((() => { const m = load(MESSAGES_RETIRES, {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; })())))), []);
  const retirerMessagesPourDeBon = async (acc) => {
    if (!acc) return;
    if (!await askConfirm({
      title: `Retirer les messages de « ${accountName(acc)} » ?`,
      desc: "Ses conversations sortent de VRM pour de bon — elles ne reviennent pas, même si l'extension recapte ce compte. Ses ventes, sa compta, ses achats et ses annonces restent. Rien n'est supprimé sur Vinted. Tu peux les remettre depuis cette carte.",
      ok: 'Retirer ses messages', cancel: 'Annuler',
    })) return;
    const uid = String(acc.vinted_user_id);
    const suivant = { ...retiresMsg, [uid]: { at: new Date().toISOString(), login: acc.login || '' } };
    setRetiresMsg(suivant); save(MESSAGES_RETIRES, suivant);
    setDelCible(null);
    toast(`Messages de « ${accountName(acc)} » retirés — rouvre l'onglet Messages.`);
  };
  const remettreMessages = (acc) => {
    const uid = String(acc.vinted_user_id);
    const suivant = { ...retiresMsg }; delete suivant[uid];
    setRetiresMsg(suivant); save(MESSAGES_RETIRES, suivant);
    toast(`Messages de « ${accountName(acc)} » remis.`);
  };

  // ── SUPPRESSION CIBLÉE (modale, récupérable) ────────────────────────────────
  // Julien : « on doit pouvoir sélectionner si on veut tout enlever — la compta,
  // les ventes, les achats, les annonces » + « pour récupérer, je reconnecte
  // l'extension ». La modale efface les lignes CHOISIES (récupérables à la
  // prochaine capture) ; elle n'écrit JAMAIS la liste noire. La compta se
  // calcule sur les ventes : la modale le dit, pas de fausse case qui
  // dupliquerait « ventes ». Le blocage définitif reste une option à part.
  const [delCible, setDelCible] = useState(null);     // le compte visé, ou null
  const [delScopes, setDelScopes] = useState({ annonces: true, ventes: true, bordereaux: true, releves: true, achats: true, messages: true, compte: true });
  const [delBusy, setDelBusy] = useState(false);
  const ouvrirSuppression = (acc) => { setDelScopes({ annonces: true, ventes: true, bordereaux: true, releves: true, achats: true, messages: true, compte: true }); setDelCible(acc); };
  const rienCoche = !delScopes.annonces && !delScopes.ventes && !delScopes.bordereaux && !delScopes.releves && !delScopes.achats && !delScopes.messages && !delScopes.compte;
  const confirmerSuppression = async () => {
    const acc = delCible; if (!acc || rienCoche) return;
    setDelBusy(true);
    const r = await supprimerDonneesCompte(acc.vinted_user_id, acc.login, delScopes);
    setDelBusy(false);
    if (!r.ok) { toast('Échec de la suppression — réessaie.'); return; }
    toast(delScopes.compte
      ? `« ${accountName(acc)} » retiré. Pour le récupérer : reconnecte l'extension sur ce compte Vinted.`
      : `Données effacées pour « ${accountName(acc)} ». Elles reviendront à ta prochaine visite sur Vinted avec ce compte.`);
    // Si on a retiré le compte lui-même, il quitte la liste ; sinon il reste
    // (ses lignes effacées se re-captent).
    if (delScopes.compte) setAccounts(prev => prev.filter(a => a.vinted_user_id !== acc.vinted_user_id));
    setDelCible(null);
  };
  // Blocage DÉFINITIF (option à part, dans la modale) : compte fermé par Vinted
  // — l'extension ne doit plus JAMAIS le recapter. On DÉLÈGUE à
  // `disconnectAccount`, le chemin éprouvé (sa propre confirmation, l'écriture
  // `vrm_blocked_accounts`, le `vinted_ca_keep_removed`, le toast) : pas de
  // logique dupliquée, et `disconnectAccount` reste vivant (pas de code mort).
  const bloquerDefinitif = async () => {
    const acc = delCible; if (!acc) return;
    setDelCible(null);
    await disconnectAccount(acc);
  };

  const refreshAccounts = async () => {
    setLoading(true);
    const list = await fetchVintedAccounts();
    // ⚠️ Un échec ne doit pas EFFACER la liste affichée : sinon un « ↻ Actualiser »
    //    pendant une panne fait disparaître ses neuf comptes sous ses yeux.
    if (Array.isArray(list)) setAccounts(list);
    setLoading(false);
  };
  useEffect(() => { refreshAccounts(); /* eslint-disable-next-line */ }, []);


  // ── TOUT REMETTRE : le seul écran qui décide de ce qui manque ──────────────
  // Demande de Julien : « mets TOUTES les annonces et TOUTES les ventes dans
  // l'application ». Relevé du 15 août : 9 annonces et 153 ventes visibles,
  // pour **112 annonces et 514 ventes réellement captées** — l'écart n'est pas
  // une perte de données, c'est trois comptes masqués (des puces tapées par
  // erreur, §5.10) et un compte retiré qui porte à lui seul 96 annonces et
  // 284 ventes. Un bouton remet tout, au lieu de chercher où ça coince.
  const [retires, setRetires] = useState(null);   // { uids:[], logins:[] }
  const [remise, setRemise] = useState(false);
  useEffect(() => { (async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vrm_blocked_accounts&select=data`, { headers: sbAuth() });
      if (!r.ok) return;
      const j = await r.json();
      setRetires((j[0] && j[0].data) || { uids: [], logins: [] });
    } catch (_) { /* pas bloquant */ }
  })(); }, []);
  const nbExclus = hiddenAccts.size + ((retires && retires.uids) || []).length;
  const toutAfficher = async () => {
    if (!await askConfirm({
      title: 'Tout réafficher ?',
      desc: "Les comptes masqués et les comptes retirés reviennent, avec leurs annonces, leurs ventes et leurs achats. Tu pourras en remasquer un ensuite si besoin.",
      ok: 'Tout réafficher', cancel: 'Annuler',
    })) return;
    setRemise(true);
    setHiddenAccts(new Set()); save('vinted_accounts_hidden', []);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vrm_blocked_accounts`, {
        method: 'PATCH',
        headers: sbAuth({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ data: { uids: [], logins: [], note: 'tout réaffiché depuis l\'app' } }),
      });
      setRetires({ uids: [], logins: [] });
    } catch (_) { /* le démasquage local est déjà fait */ }
    // ⚠️ Ici `blockedAccts` est un useMemo (pas d'état) : on écrit la clé, et
    // l'app la relit au prochain démarrage. Appeler un `setBlockedAccts`
    // inexistant dans CE composant planterait l'écran (même famille de bug
    // qu'en §26 : un identifiant absent que le build ne voit pas).
    save('vinted_accounts_blocked', []);
    await refreshAccounts();
    setRemise(false);
    toast('Tous les comptes sont réaffichés — rouvre l\'onglet Annonces');
  };

  return (
    <div style={{padding:'16px 14px 40px'}}>
      {onRetour && <button type="button" className="vrm-settings-back" onClick={onRetour} style={{color:C.accent,borderColor:C.border}}>← Retour aux paramètres</button>}
      <GuideReglage titre="Relier et vérifier un compte" etapes={[
        ['Connecte ton compte', 'Ouvre Vinted avec l’extension VRM active, puis actualise cette liste.'],
        ['Vérifie son identité', 'Contrôle le pseudo et associe l’adresse qui reçoit les emails de ce compte.'],
        ['Consulte ses données', 'Ses annonces, ventes et messages se trouvent dans les onglets Vinted.']
      ]}/>
      {vintedPris && (
        <div data-vinted-pris={vintedPris.uid} style={{border:`1px solid ${C.warn}`,background:`${C.warn}14`,borderRadius:10,padding:'12px 13px',marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>
            Ce compte Vinted est déjà rattaché à un autre compte VRM
          </div>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>
            Le compte {vintedPris.login ? <b style={{color:C.text}}>{vintedPris.login}</b> : 'Vinted'} ouvert dans ton navigateur appartient déjà à un autre compte VRM. Un compte Vinted ne peut servir que sur <b style={{color:C.text}}>un seul</b> compte VRM : VRM ne captera donc rien pour lui ici. Pour l'utiliser, connecte-toi sur Vinted avec un autre compte, ou ouvre VRM avec le compte qui le possède déjà.
          </div>
        </div>
      )}
      {nbExclus > 0 && (
        <div style={{border:`1px solid ${C.warn}`,background:`${C.warn}14`,borderRadius:10,padding:'12px 13px',marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>
            {nbExclus} compte{nbExclus>1?'s':''} {nbExclus>1?'sont exclus':'est exclu'} de l'application
          </div>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.5,marginBottom:9}}>
            Leurs annonces, leurs ventes et leurs achats n'apparaissent nulle part — ni dans les onglets, ni dans les totaux.
            {(retires && retires.logins && retires.logins.length)
              ? ` Retiré${retires.logins.length>1?'s':''} : ${retires.logins.join(', ')}.` : ''}
          </div>
          <button type="button" onClick={toutAfficher} disabled={remise}
            style={{width:'100%',border:'none',background:C.accent,color:C.onAccent||'#fff',borderRadius:10,padding:'11px',fontSize:13,fontWeight:600,cursor:remise?'default':'pointer',fontFamily:'inherit'}}>
            {remise ? '…' : 'Tout réafficher'}
          </button>
        </div>
      )}
      <ScreenHead icon="link" title="Comptes Vinted liés"
        desc="Ceux que l'extension Chrome capte quand tu navigues sur Vinted. Annonces, ventes, achats et messages se consultent dans leurs onglets."
        right={<button type="button" onClick={refreshAccounts} title="Recharge la liste des comptes captés par l'extension" style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:12,fontWeight:500,color:C.text}}>
          {loading ? '…' : '↻ Actualiser'}
        </button>}/>

      {/* ⚠️ « Aucun compte détecté · installe l'extension » à quelqu'un qui en a
          NEUF : c'est ce que cet écran affichait quand la base ne répondait pas.
          Et ce n'était pas seulement faux, c'était une consigne à ne SURTOUT
          pas suivre — réinstaller l'extension ne répare pas une panne de
          lecture. Une liste vide parce qu'on n'a pas pu lire n'est pas une
          liste vide. */}
      {accounts.length === 0 && (baseKO
        ? <LignePanne>Je n'ai pas pu lire la liste de tes comptes — elle est vide parce que la lecture a échoué, pas parce qu'aucun compte n'est lié. Rien n'est perdu.</LignePanne>
        : (
        <div style={{padding:16,borderRadius:10,background:C.card,border:`1px solid ${C.border}`,fontSize:13,color:C.muted,lineHeight:1.5}}>
          Aucun compte détecté pour l'instant. Installe l'extension VRM,
          connecte-toi sur vinted.fr, puis clique sur « Actualiser ».
        </div>
      ))}

      {/* Diagnostic global : combien de comptes à jour / à rafraîchir / bloqués. */}
      {accounts.length > 0 && (()=>{
        const st = accounts.map(acctHealth);
        // ⚠️ ON NE COMPTE QUE LES COMPTES QUI SONT DANS L'APP. Les exclus ont
        //    leur mention à part, en gris : ils ne sont ni « à jour » ni « en
        //    panne », ils sont ailleurs. Les mêler aux autres, c'était annoncer
        //    « 2 en panne » pour une panne réelle et un choix assumé.
        const ok    = st.filter(s=>s.etat==='ok').length;
        const warn  = st.filter(s=>s.etat==='warn').length;
        const bad   = st.filter(s=>s.etat==='bad').length;
        const exclu = st.filter(s=>s.etat==='exclu').length;
        return (
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:10,background:C.card,marginBottom:14,fontSize:13,fontWeight:600}}>
            <span style={{color:C.text}}>Tes comptes :</span>
            <span data-comptes-actifs={ok} style={{display:'inline-flex',alignItems:'center',gap:4,color:C.text}}><Icon name="check" size={13}/>{ok} actif{ok>1?'s':''}</span>
            {bad>0 && <span data-comptes-bannis={bad} style={{display:'inline-flex',alignItems:'center',gap:4,color:C.danger}}><Icon name="alert" size={13}/>{bad} banni{bad>1?'s':''} par Vinted</span>}
            {exclu>0 && <span style={{display:'inline-flex',alignItems:'center',gap:4,color:C.muted}}><Icon name="eyeOff" size={13}/>{exclu} masqué{exclu>1?'s':''} — ton choix</span>}
          </div>
        );
      })()}

      {accounts.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {accounts.map(acc => {
            return (
              <div key={acc.vinted_user_id} style={{borderRadius:10,border:`1px solid ${C.border}`,background:C.card,boxShadow:C.shadow||'none',padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
                <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>
                  <span data-compte-photo={photosProfil[String(acc.vinted_user_id)] ? 'oui' : 'non'} style={{width:40,height:40,flexShrink:0,borderRadius:999,overflow:'hidden',background:C.border,color:C.text,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700}}>
                    {photosProfil[String(acc.vinted_user_id)]
                      ? <PhotoVinted src={photosProfil[String(acc.vinted_user_id)]} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      : accountName(acc).slice(0,1).toUpperCase()}
                  </span>
                  <div style={{minWidth:0}}>
                    {editingLabel === acc.vinted_user_id ? (
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <input autoFocus value={labelDraft} onChange={e=>setLabelDraft(e.target.value)}
                          onKeyDown={e=>{ if(e.key==='Enter') commitLabel(acc); if(e.key==='Escape') setEditingLabel(null); }}
                          placeholder={acc.login || `Compte #${acc.vinted_user_id}`}
                          style={{fontSize:15,fontWeight:600,color:C.text,background:C.surface,border:`1px solid ${C.accent}`,borderRadius:8,padding:'3px 8px',width:170}}/>
                        <button type="button" onClick={()=>commitLabel(acc)} style={{background:C.accent,color:C.onAccent,border:'none',borderRadius:8,padding:'4px 8px',cursor:'pointer',fontSize:11,fontWeight:500}}>OK</button>
                      </div>
                    ) : (
                      <div style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer'}} onClick={()=>startEditLabel(acc)} title="Cliquer pour renommer">
                        <div className="vrm-sensible" style={{fontWeight:600,color:C.text,fontSize:15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{accountName(acc)}</div>
                        <span style={{color:C.muted,display:'inline-flex'}}><Icon name="pencil" size={12}/></span>
                      </div>
                    )}
                    <div style={{fontSize:11,color:C.muted,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {acc.login && acc.login !== accountName(acc) ? `@${acc.login} · ` : ''}
                      {/* ⚠️ « maj » est de l'abréviation d'informaticien (§7), et
                          l'heure À LA SECONDE ne sert à rien : on lit cette ligne
                          pour savoir si c'est frais, pas pour horodater. */}
                      {/* (20 oct., audit sur données réelles) « lié le » lisait
                          `updated_at` — la date du dernier RENOUVELLEMENT des
                          jetons (§4.3 : `updated_at` ment) : ses sept comptes,
                          liés en juillet et août, se disaient « liés le
                          20/10/2026 ». La date de liaison est `created_at`. */}
                      {acc.created_at ? `lié le ${new Date(acc.created_at).toLocaleDateString('fr-FR')}` : 'date de liaison inconnue'}
                    </div>
                    {(()=>{ const h=acctHealth(acc); return (<>
                      <div data-etat-compte={h.etat==='bad'?'banni':h.etat==='exclu'?'masque':'actif'} data-etat-source={h.source||''} title={h.hint} style={{display:'inline-flex',alignItems:'center',gap:5,marginTop:4,fontSize:11,fontWeight:600,color:h.color,background:h.etat==='ok'?C.bg:`${h.color}14`,border:`1px solid ${h.etat==='ok'?C.border:h.color+'44'}`,borderRadius:8,padding:'2px 9px'}}><Icon name={h.ic} size={12}/>{h.label}</div>
                      {h.ago && <span style={{fontSize:11,color:C.muted,marginLeft:8}}>{h.ago}</span>}
                      {(() => {
                        // Pro / particulier : ce que l'extension a publié d'abord
                        // (`panel_comptes_etat`, 5.185), sinon le profil capté —
                        // la même règle. Pas su ⇒ rien (jamais « particulier » par défaut).
                        const uid = String(acc.vinted_user_id);
                        const ev = etatExt && etatExt[uid];
                        const pro = ev && typeof ev.pro === 'boolean' ? ev.pro : (typeof typesProfil[uid] === 'boolean' ? typesProfil[uid] : null);
                        if (pro == null) return null;
                        return <span data-type-compte={pro ? 'pro' : 'particulier'} title={pro ? 'Compte Vinted Pro : Vinted t\'envoie les coordonnées de l\'acheteur, une facture est possible.' : 'Compte particulier : Vinted ne transmet pas les coordonnées de l\'acheteur, aucune facture n\'est faite.'}
                          style={{display:'inline-flex',alignItems:'center',marginTop:4,marginLeft:8,fontSize:11,fontWeight:600,color:C.text,border:`1px solid ${C.border}`,borderRadius:8,padding:'2px 8px'}}>{pro ? 'Pro' : 'Particulier'}</span>;
                      })()}
                    </>); })()}
                    {(()=>{ const r=reput[String(acc.vinted_user_id)]; if(!r||(r.rating==null&&r.count==null)) return null; const stars=r.rating!=null?(r.rating*5):null; return (
                      <div style={{fontSize:12,marginTop:3,fontWeight:600,color:C.warn}} title="Note vendeur et nombre d'avis (Vinted)">
                        {stars!=null?<>⭐ {stars.toFixed(2)}/5</>:''}
                        {stars!=null&&r.count!=null?' · ':''}
                        {r.count!=null?<span style={{color:C.muted,fontWeight:500}}>{r.count} avis</span>:''}
                        {r.neg>0?<span style={{color:C.danger,fontWeight:500}}> · {r.neg} négatif{r.neg>1?'s':''}</span>:''}
                      </div>
                    ); })()}
                  </div>
                </div>
                <details data-gerer-compte="" style={{flex:'1 1 100%'}}>
                  <summary style={{cursor:'pointer',fontSize:12,fontWeight:600,color:C.muted,padding:'2px 0',display:'flex',alignItems:'center'}}>Gérer ce compte</summary>
                  <div style={{paddingTop:8}}>
                    <input
                      value={acctEmails[String(acc.vinted_user_id)] || ''}
                      onChange={e=>setAcctEmail(acc.vinted_user_id, e.target.value)}
                      placeholder="Email du compte"
                      title="L'adresse à laquelle Vinted écrit pour ce compte. Permet d'attribuer automatiquement les emails (ventes, bordereaux) au bon compte."
                      style={{marginTop:6,width:'100%',maxWidth:280,boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 9px',fontSize:12,fontFamily:'inherit',background:C.surface,color:C.text,outline:'none'}}
                      onFocus={e=>e.target.style.borderColor=C.accent}
                      onBlur={e=>e.target.style.borderColor=C.border}
                    />
                    <input
                      type="tel" inputMode="tel"
                      value={acctPhones[String(acc.vinted_user_id)] || ''}
                      onChange={e=>setAcctPhone(acc.vinted_user_id, e.target.value)}
                      placeholder="Téléphone du compte"
                      title="Le numéro utilisé pour ce compte Vinted. Si tu le mets aussi sur un autre compte, l'app te le signale."
                      style={{display:'block',marginTop:6,width:'100%',maxWidth:280,boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 9px',fontSize:12,fontFamily:'inherit',background:C.surface,color:C.text,outline:'none'}}
                      onFocus={e=>e.target.style.borderColor=C.accent}
                      onBlur={e=>e.target.style.borderColor=C.border}
                    />
                    {(()=>{ const n=telNorm(acctPhones[String(acc.vinted_user_id)]); if(n.length<9) return null;
                      const autres=(accounts||[]).filter(o=>String(o.vinted_user_id)!==String(acc.vinted_user_id) && telNorm(acctPhones[String(o.vinted_user_id)])===n).map(o=>labels[String(o.vinted_user_id)]||o.login||`#${o.vinted_user_id}`);
                      return autres.length ? <div style={{fontSize:11,color:C.warn,marginTop:3}}>Ce numéro sert aussi sur {autres.join(', ')}.</div> : null; })()}
                  <div style={{marginTop:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  {(() => { const off = hiddenAccts.has(String(acc.vinted_user_id)); return (
                    <button type="button" onClick={()=>toggleAcctCompta(acc.vinted_user_id)} title={off?'Ce compte est MASQUÉ : ses annonces et ses ventes/achats n’apparaissent nulle part (annonces + compta). Idéal pour un compte bloqué ou fermé.':'Ce compte est ACTIF : ses annonces et sa compta sont visibles. Clique pour le masquer partout (compte bloqué/fermé).'}
                      style={{background:off?'transparent':`${C.accent}14`,border:`1px solid ${off?C.border:C.accent}`,borderRadius:8,padding:'5px 12px',cursor:'pointer',fontSize:11,fontWeight:500,color:off?C.muted:C.accent}}>
                      {off ? <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Icon name="eyeOff" size={12}/>Masqué (annonces + compta)</span>
                           : <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Icon name="check" size={12}/>Actif</span>}
                    </button>
                  ); })()}
                  {retireesAnn[String(acc.vinted_user_id)] && (
                    <span data-annonces-retirees={String(acc.vinted_user_id)} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11,color:C.muted}}>
                      <Icon name="eyeOff" size={12}/>Annonces retirées
                      <button type="button" className="vrm-lien-action" onClick={()=>remettreAnnonces(acc)} style={{border:'none',background:'transparent',color:C.accent,fontSize:11,fontWeight:600,cursor:'pointer',padding:0,fontFamily:'inherit'}}>Les remettre</button>
                    </span>
                  )}
                  {retiresMsg[String(acc.vinted_user_id)] && (
                    <span data-messages-retires={String(acc.vinted_user_id)} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11,color:C.muted}}>
                      <Icon name="eyeOff" size={12}/>Messages retirés
                      <button type="button" className="vrm-lien-action" onClick={()=>remettreMessages(acc)} style={{border:'none',background:'transparent',color:C.accent,fontSize:11,fontWeight:600,cursor:'pointer',padding:0,fontFamily:'inherit'}}>Les remettre</button>
                    </span>
                  )}
                  <button type="button" onClick={()=>ouvrirSuppression(acc)} title="Supprimer les données de ce compte — tu choisis quoi effacer (annonces, ventes, achats, messages, le compte). Récupérable en reconnectant l'extension."
                    style={{background:'transparent',border:`1px solid ${C.danger}`,borderRadius:8,padding:'5px 12px',cursor:'pointer',fontSize:11,fontWeight:500,color:C.danger}}>
                    <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Icon name="trash" size={12}/>Supprimer des données…</span>
                  </button>
                </div>
                  </div>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODALE : SUPPRIMER LES DONNÉES D'UN COMPTE (ciblé, récupérable) ──── */}
      {delCible && (()=>{ const acc = delCible;
        const Case = ({ k, titre, sous }) => (
          <label style={{display:'flex',gap:10,alignItems:'flex-start',padding:'10px 12px',border:`1px solid ${delScopes[k]?C.accent:C.border}`,background:delScopes[k]?`${C.accent}0d`:'transparent',borderRadius:10,cursor:'pointer',marginBottom:8}}>
            <input type="checkbox" checked={!!delScopes[k]} onChange={e=>setDelScopes(s=>({...s,[k]:e.target.checked}))} style={{marginTop:2,width:17,height:17,accentColor:C.accent,flexShrink:0}}/>
            <span style={{minWidth:0}}>
              <span style={{display:'block',fontSize:13.5,fontWeight:600,color:C.text}}>{titre}</span>
              <span style={{display:'block',fontSize:11.5,color:C.muted,lineHeight:1.45,marginTop:1}}>{sous}</span>
            </span>
          </label>
        );
        const tout = delScopes.annonces && delScopes.ventes && delScopes.bordereaux && delScopes.releves && delScopes.achats && delScopes.messages && delScopes.compte;
        return (
        <div onClick={()=>!delBusy&&setDelCible(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1300,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'0'}}>
          <FermeAuRetour fermer={()=>!delBusy&&setDelCible(null)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:520,maxHeight:'92vh',borderRadius:'14px 14px 0 0',display:'flex',flexDirection:'column',overflow:'hidden',paddingBottom:'env(safe-area-inset-bottom)',}}>
            <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:10}}>
              <span style={{flexShrink:0,width:34,height:34,borderRadius:8,background:`${C.danger}14`,color:C.danger,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="trash" size={17}/></span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>Supprimer les données de « {accountName(acc)} »</div>
                <div style={{fontSize:11.5,color:C.muted}}>Choisis ce que tu effaces. Rien ne part tant que tu n'as pas confirmé.</div>
              </div>
              <button type="button" onClick={()=>!delBusy&&setDelCible(null)} aria-label="Fermer" style={{flexShrink:0,border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:'14px 16px'}}>
              {/* Tout sélectionner / désélectionner */}
              <label style={{display:'flex',gap:10,alignItems:'center',padding:'8px 12px',borderRadius:10,cursor:'pointer',marginBottom:10,background:C.card,border:`1px solid ${C.border}`}}>
                <input type="checkbox" checked={tout} onChange={e=>{ const v=e.target.checked; setDelScopes({annonces:v,ventes:v,bordereaux:v,releves:v,achats:v,messages:v,compte:v}); }} style={{width:17,height:17,accentColor:C.accent}}/>
                <span style={{fontSize:13,fontWeight:700,color:C.text}}>Tout supprimer</span>
              </label>
              <Case k="annonces" titre="Annonces" sous="Le dressing capté, les photos et descriptions, le coffre."/>
              <Case k="ventes" titre="Ventes" sous="Les ventes, transactions et porte-monnaie. La compta (CA, URSSAF) se recalcule dessus : la retirer la met à jour."/>
              <Case k="bordereaux" titre="Bordereaux" sous="Les étiquettes d'envoi (PDF) captées sur ce compte. Les ventes et la compta ne bougent pas."/>
              <Case k="releves" titre="Relevés" sous="Les relevés de versement captés sur ce compte. Les ventes et la compta ne bougent pas."/>
              <Case k="achats" titre="Achats" sous="Les commandes achetées sur ce compte."/>
              <Case k="messages" titre="Messages" sous="Les conversations captées de ce compte."/>
              <Case k="compte" titre="Le compte et ses jetons" sous="Retire le compte de la liste. Tu le récupères en reconnectant l'extension dessus sur Vinted."/>
              <div style={{fontSize:12,color:C.muted,lineHeight:1.5,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px',marginTop:4}}>
                ↩︎ <b style={{color:C.text}}>Rien n'est perdu pour de bon</b> : ce que tu effaces ici revient tout seul à ta prochaine visite sur Vinted avec ce compte (l'extension recapte). Pour qu'un compte ne revienne <b>jamais</b> (fermé par Vinted), utilise le blocage ci-dessous.
              </div>
            </div>
            <div style={{borderTop:`1px solid ${C.border}`,padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
              <div style={{display:'flex',gap:8}}>
                <button type="button" onClick={()=>!delBusy&&setDelCible(null)} style={{flex:1,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:10,padding:'12px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
                <button type="button" onClick={confirmerSuppression} disabled={delBusy||rienCoche} style={{flex:2,border:'none',background:rienCoche?C.border:C.danger,color:'#fff',borderRadius:10,padding:'12px',fontSize:14,fontWeight:700,cursor:(delBusy||rienCoche)?'default':'pointer',fontFamily:'inherit',opacity:delBusy?0.6:1}}>{delBusy?'…':rienCoche?'Coche au moins une case':'Supprimer'}</button>
              </div>
              {/* ── POUR DE BON : par catégorie (26 oct., demande de Julien) ──────
                  « Annonce + message, pas les ventes. » Ne revient jamais, même
                  recapté. Seules les annonces et les messages : ni les ventes (ta
                  compta/URSSAF en dépend), ni les achats (ton repère de prix).
                  Réactivable ici et sur la carte du compte. */}
              {(()=>{ const uid=String(acc.vinted_user_id); const annR=!!retireesAnn[uid]; const msgR=!!retiresMsg[uid];
                const BtnPDB = ({ retire, onRetirer, onRemettre, label, attr }) => (
                  <button type="button" {...attr} onClick={()=>!delBusy&&(retire?onRemettre(acc):onRetirer(acc))} disabled={delBusy}
                    style={{flex:1,border:`1px solid ${retire?C.accent:C.border}`,background:retire?`${C.accent}0d`:'transparent',color:retire?C.accent:C.text,borderRadius:10,padding:'9px 10px',fontSize:12.5,fontWeight:600,cursor:delBusy?'default':'pointer',fontFamily:'inherit',lineHeight:1.3}}>
                    {retire ? `${label} retirées ✓ — les remettre` : `Retirer les ${label.toLowerCase()}`}
                  </button>
                );
                return (
                <div style={{border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px'}}>
                  <div style={{fontSize:12.5,fontWeight:700,color:C.text}}>Pour de bon <span style={{fontWeight:500,color:C.muted}}>— ne revient jamais, même recapté</span></div>
                  <div className="vrm-aide" style={{fontSize:11,color:C.muted,lineHeight:1.45,margin:'3px 0 8px'}}>Compte bloqué par Vinted ? Sors ses annonces ou ses messages pour de bon. Ses ventes, sa compta et ses achats restent (le CA et tes prix d'achat en dépendent).</div>
                  <div style={{display:'flex',gap:8}}>
                    <BtnPDB retire={annR} onRetirer={retirerAnnoncesPourDeBon} onRemettre={remettreAnnonces} label="Annonces" attr={{'data-retirer-annonces':true}}/>
                    <BtnPDB retire={msgR} onRetirer={retirerMessagesPourDeBon} onRemettre={remettreMessages} label="Messages" attr={{'data-retirer-messages':true}}/>
                  </div>
                </div>
                ); })()}
              <button type="button" onClick={bloquerDefinitif} disabled={delBusy} style={{border:'none',background:'transparent',color:C.muted,borderRadius:10,padding:'4px',fontSize:12,fontWeight:500,cursor:delBusy?'default':'pointer',fontFamily:'inherit',textDecoration:'underline'}}>Compte fermé par Vinted ? Le bloquer définitivement</button>
            </div>
          </div>
        </div>
      ); })()}
    </div>
  );
}

export default VintedAccounts;
