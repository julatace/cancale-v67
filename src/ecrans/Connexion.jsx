// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { QrOrdinateur } from '../ConnexionQr.jsx';
import React from 'react';
import { contactEmail, CONTACT_A_VENIR } from '../contact.js';
import { captchaActif, etatCaptcha, abonnerCaptcha, monterWidget, MSG_CAPTCHA_ERREUR } from '../captcha.js';
import { CLE_PARRAIN, CODE_PARRAIN_RE } from '../abonnement/etatAbonnement.js';
import { lireApercuParrain } from '../parrainage/parrainage.js';
import { codePartenaireGarde } from '../partenaires/lien.js';
import { langueNavigateur } from '../langueCompte.js';
import { tr } from '../i18n/index.js';
import { noterLienDemande } from '../lienEmail.js';
import { AUTH, AUTH_REDIRECT, AUTH_SETTINGS, AUTH_SETTINGS_ABONNES, AUTH_SETTINGS_ETAT, Bouton, BrandMark, C, CLOISONNE, DOCS_LEGAUX, Icon, MAIL_QUOTA, NAV, OAUTH_PROVIDERS, PARRAIN_DU_LIEN, PARTENAIRE_DU_LIEN, RECOVERY_PENDING, SCHEMA_MESURE, THEMES, VrmLogo, __lier, __lierConnexion, __lierRetourPerime, authCall, authSetPassword, authSignOut, avecRetour, delaiDemandeEmail, enTeteSession, etatMfa, loadAuthSettings, mapMailError, mfaLireFacteurs, mfaVerifierCodeParmi, oauthStart, oublierLierConnexion, providerEnabled, save, sessionFrom, sondeLectureSansCompte, texteDelaiEmail, totpNoms, useSecondesRestantes, writeSession } from '../App.jsx';

// ⟦← App.jsx #1⟧
// (11 nov., lot traduction) Les textes visibles passent par `tr()` (src/i18n/index.js) :
// `t` est pris partout dans ce fichier comme nom de variable, d'où l'alias `tr`.
import ChoixLangue from "../i18n/ChoixLangue.jsx";

// ⟦← App.jsx #2⟧   // (15 nov.) programme partenaire
const codeParrainGarde = () => { try { const c = String(localStorage.getItem(CLE_PARRAIN) || ''); return CODE_PARRAIN_RE.test(c) ? c : ''; } catch (_) { return ''; } };
// ⟦← App.jsx #3⟧

const authSignIn  = async (email, password) => {
  const r = await authCall('token?grant_type=password', { email: String(email).trim().toLowerCase(), password });
  if (!r.ok) {
    // « Email not confirmed » veut dire que le compte existe bel et bien : il
    // attend juste que le lien reçu par email soit cliqué. C'est une situation
    // qui se règle, pas une erreur de saisie — on le dit, et on propose de
    // renvoyer l'email plutôt que de laisser l'utilisateur devant un mur.
    if (/not confirmed/i.test(r.error)) return { ok: false, needsConfirm: true, error: "Ton compte existe, mais l'email n'est pas encore confirmé." };
    if (r.status>=500) return {ok:false,error:'Le service de connexion est momentanément indisponible. Réessaie dans un instant.'};
    if (r.status===429) return {ok:false,error:'Trop de tentatives de connexion. Patiente un moment avant de réessayer.'};
    if (/invalid|credential/i.test(r.error)) return { ok: false, error: 'E-mail ou mot de passe incorrect.' };
    return { ok: false, error: r.error };
  }
  // Un HTTP 200 ne suffit pas : ne jamais recharger vers une session vide.
  const j=r.json;
  if (!j || typeof j.access_token!=='string' || !j.access_token.trim()
      || typeof j.user?.id!=='string' || !j.user.id.trim()) {
    return {ok:false,error:'La connexion n’a pas pu être confirmée. Réessaie : tes identifiants sont conservés.'};
  }
  writeSession(sessionFrom(j));
  return { ok: true };
};
// ── CONFIRMER EN COLLANT LE LIEN REÇU ─────────────────────────────────────
// Le lien du mail passe par Supabase, qui renvoie ensuite vers l'adresse
// configurée dans le projet (« Site URL »). Si elle est restée sur la valeur
// d'usine (http://localhost:3000), le navigateur affiche « impossible d'accéder
// au site » — et selon le moment où ça casse, le compte n'est même pas confirmé.
//
// Plutôt que de dépendre de ce réglage, on accepte que le lien soit COLLÉ ici :
// on en extrait le jeton et on fait nous-mêmes la vérification. Aucune
// redirection, donc rien à casser.
const authConfirmFromLink = async (raw, email) => {
  const txt = String(raw || '').trim();
  if (!txt) return { ok: false, error: 'Colle le lien reçu par email.' };
  let q = null, typeFragment='';
  if (/^\d{6}$/.test(txt)) q = new URLSearchParams({ token: txt, type: 'signup' });  // code à 6 chiffres collé tel quel
  else {
    try { const u=new URL(txt);q=u.searchParams;typeFragment=new URLSearchParams(u.hash.slice(1)).get('type')||''; }
    catch (_) { const i = txt.indexOf('?'); if (i >= 0) q = new URLSearchParams(txt.slice(i + 1)); }
  }
  if (!q) return { ok: false, error: "Ce n'est ni un lien, ni un code à 6 chiffres." };
  const type = q.get('type') || 'signup';
  if(type==='recovery'||typeFragment==='recovery')return{ok:false,recovery:true,error:'Ce lien sert à changer ton mot de passe : ouvre-le directement depuis l’e-mail, sur cet appareil. Sinon, redemande un e-mail ci-dessous.'};
  const hash = q.get('token_hash');
  const token = q.get('token');
  if (!hash && !token) return { ok: false, error: "Ce lien ne contient pas de jeton de confirmation." };
  // ⚠️ PIÈGE : dans un lien d'email, le paramètre `token` contient DÉJÀ un jeton
  // haché — c'est la même chose qu'un `token_hash`. Si on l'envoie comme un code
  // à 6 chiffres (`{token, email}`), le serveur le hache une deuxième fois et le
  // rejette systématiquement. On ne prend ce format QUE pour un vrai code court
  // tapé à la main.
  const body = (!hash && /^\d{6}$/.test(String(token)))
    ? { type, token, email: String(email || '').trim().toLowerCase() }
    : { type, token_hash: hash || token };
  const r = await authCall('verify', body);
  if (!r.ok) {
    if (/expired|invalid/i.test(r.error)) return { ok: false, error: 'Lien expiré ou déjà utilisé. Redemande un e-mail, et colle le PLUS RÉCENT.' };
    return { ok: false, error: r.error };
  }
  const j=r.json;
  if (typeof j?.access_token==='string' && j.access_token.trim() && typeof j.user?.id==='string' && j.user.id.trim()) { writeSession(sessionFrom(j)); return {ok:true,connected:true}; }
  const u=j?.user||j;
  if (!j?.access_token && typeof u?.id==='string' && u.id.trim() && typeof u.email_confirmed_at==='string' && u.email_confirmed_at.trim()) return {ok:true,connected:false};
  return {ok:false,error:'La confirmation n’a pas pu être vérifiée. Réessaie avec le lien le plus récent.'};
};

// Renvoyer l'email de confirmation (le premier peut s'être perdu, ou avoir été
// bloqué par le quota du serveur d'envoi de test de Supabase).
const authResendConfirm = async (email) => {
  const r = await authCall(avecRetour('resend'), { type: 'signup', email: String(email).trim().toLowerCase() });
  if (!r.ok) return { ok: false, error: mapMailError(r.error), attente: delaiDemandeEmail(r.error) };
  noterLienDemande(localStorage);
  return { ok: true };
};

// LIEN DE CONNEXION PAR EMAIL (« magic link »). Utile quand le mot de passe est
// bon mais que le compte attend encore sa confirmation : ouvrir ce lien confirme
// l'adresse ET connecte, d'un coup. Comme le lien renvoie vers l'adresse
// configurée dans Supabase (souvent restée sur localhost), on le fait plutôt
// COLLER dans l'app, qui le vérifie elle-même.
const authMagicLink = async (email) => {
  const r = await authCall(avecRetour('otp'), { email: String(email).trim().toLowerCase(), create_user: false });
  if (!r.ok) return { ok: false, error: mapMailError(r.error), attente: delaiDemandeEmail(r.error) };
  noterLienDemande(localStorage);
  return { ok: true };
};
// ⟦← App.jsx #4⟧
const authSignUp  = async (email, password) => {
  // (8 nov.) `data.langue` : la langue des e-mails de compte (modèles Supabase).
  // (11 nov., sécurité) Le lien de confirmation ne s'ouvrira QUE dans ce navigateur (src/lienEmail.js).
  noterLienDemande(localStorage);
  // (13 nov., lot 54) Le code de parrainage suit le COMPTE (`user_metadata.parrain`) : le lien de
  // confirmation ouvert sur un autre appareil ne le perd plus. Le serveur décide toujours tout.
  const parrain = codeParrainGarde();
  const partenaire = codePartenaireGarde(localStorage);   // (15 nov.) le code partenaire suit aussi le compte
  // (25 nov.) « Montrer mon prénom à mon parrain », coché à l'inscription (décoché par défaut) : suit le compte.
  let montrerParrain = false; try { montrerParrain = !!parrain && localStorage.getItem('vrm_parrain_montrer') === '1'; } catch (_) {}
  const r = await authCall(avecRetour('signup'), { email: String(email).trim().toLowerCase(), password, data: { langue: langueNavigateur(), ...(parrain ? { parrain } : {}), ...(montrerParrain ? { parrain_montrer: true } : {}), ...(partenaire ? { partenaire } : {}) } });
  if (!r.ok) {
    if(r.captcha)return {ok:false,error:r.error};
    // On traduit les erreurs techniques de Supabase : « email rate limit
    // exceeded » ne veut rien dire pour quelqu'un qui essaie juste de créer un
    // compte, alors que la cause est précise et la solution simple.
    let msg = r.error;
    const attente = delaiDemandeEmail(r.error);
    if (attente) return { ok: false, error: texteDelaiEmail(attente), attente };
    if (/already registered/i.test(r.error)) msg = 'Un compte existe déjà avec cet email.';
    else if (/rate limit/i.test(r.error)) msg = MAIL_QUOTA;
    else if (/invalid/i.test(r.error) && /email/i.test(r.error)) msg = 'Cette adresse e-mail est refusée par le serveur.';
    else if (/signups? not allowed|disabled/i.test(r.error)) msg = 'Les inscriptions sont fermées pour le moment.';
    return { ok: false, incertain:r.status===0 || r.status>=500, error: r.status===0 || r.status>=500 ? 'Je ne peux pas confirmer le résultat de la création. Si tu as reçu un e-mail VRM, ton compte peut déjà être créé : confirme-le, puis utilise « Se connecter » ici.' : msg };
  }
  const j=r.json,uid=j?.user?.id||j?.id;
  if(typeof uid!=='string'||!uid.trim()||(j?.access_token&&(typeof j.access_token!=='string'||!j.access_token.trim()||typeof j.user?.id!=='string'||!j.user.id.trim())))return {ok:false,incertain:true,error:'La réponse du serveur est incomplète. Si tu as reçu un e-mail, confirme-le puis connecte-toi ici ; sinon réessaie dans un instant.'};
  // Si la confirmation par email est activée côté Supabase, il n'y a pas encore
  // de jeton : le compte n'existe vraiment qu'une fois le lien cliqué.
  if (r.json && r.json.access_token) { writeSession(sessionFrom(r.json)); return { ok: true }; }
  return { ok: true, needsConfirm: true };
};
const authReset   = (email) => { noterLienDemande(localStorage); return authCall(avecRetour('recover', '/recuperation.html'), { email: String(email).trim().toLowerCase() }); };
// ⟦← App.jsx #5⟧
const etatAuthSettings=()=>({statut:AUTH_SETTINGS_ETAT,reglages:AUTH_SETTINGS});
const onAuthSettingsChange=fn=>{AUTH_SETTINGS_ABONNES.add(fn);return()=>AUTH_SETTINGS_ABONNES.delete(fn);};
// ⟦← App.jsx #6⟧
// La création de compte attend-elle un email de confirmation ? Si oui, on le
// dit AVANT que la personne tape son mot de passe.
const confirmRequired = () => !!(AUTH_SETTINGS && AUTH_SETTINGS.mailer_autoconfirm === false);
// ⟦← App.jsx #7⟧
function LiensLegaux() {
  return (
    <nav aria-label={tr('legal.documents')} style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:'4px 14px',marginTop:16,fontSize:12}}>
      {DOCS_LEGAUX.map(([h,t]) => <a key={h} href={h} target="_blank" rel="noopener" style={{color:C.muted,textDecoration:'none'}}>{t}</a>)}
    </nav>
  );
}

// ── L'ÉCRAN DU CODE (double vérification) ─────────────────────────────────
// Monté par `App` À LA PLACE du cœur : rien n'est lu tant qu'il est là.
// `etatMfa` = 'verifier' : la session ne dit pas encore si un code est demandé
// (rangée avant cette fonction, ou arrivée par un lien email) — on demande à
// GoTrue. 'code' : on demande le code. Dans les deux cas, « pas su » (GoTrue
// injoignable) se DIT, avec « Réessayer » ; on ne déconnecte jamais tout seul.
// ── Compte créé par Discord/Google sans le savoir (30 octobre) ──────────────
// Julien avait relié Discord à son compte (pseudo seulement), puis « Se
// connecter avec Discord » a créé un SECOND compte VRM, vide. On le dit avant
// d'ouvrir l'app, et on propose de supprimer ce compte vide (la route « Supprimer
// mon compte », confirmée ici) pour pouvoir relier Discord au vrai compte.
function PorteNouveauOAuth({ fournisseur, email, onContinuer }) {
  const nom = fournisseur === 'google' ? 'Google' : 'Discord';
  const [etape, setEtape] = React.useState('choix');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  // Ce Discord est-il celui déjà affiché (vérifié) sur un AUTRE compte VRM ?
  // { email, pseudo } si oui · null sinon ou « pas su » (rien n'est dit).
  const [deja, setDeja] = React.useState(null);
  React.useEffect(() => {
    if (fournisseur !== 'discord') return;
    let fini = false;
    fetch('/api/compte?mode=discord-deja', { headers: { ...enTeteSession() } })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!fini && j && j.trouve === true && j.email) setDeja({ email: String(j.email), pseudo: String(j.pseudo || '') }); })
      .catch(() => {});
    return () => { fini = true; };
  }, [fournisseur]);
  const supprimer = async () => {
    setBusy(true); setErr('');
    try {
      // (9 nov.) La route de « Supprimer mon compte » : ce compte vient d'être ouvert par
      // Google/Discord (connexion de moins de 10 min), son clic ici est la confirmation.
      const r = await fetch('/api/compte?mode=supprimer', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ confirmation: 'SUPPRIMER' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j?.message || 'Le compte n’a pas pu être supprimé. Réessaie.'); setBusy(false); return; }
      // (13 nov., lot 51) Un compte qui n'est PAS vide part dans 30 jours (le serveur décide) : la phrase du serveur, telle quelle.
      if (j && j.prevue) { setErr(j.message || 'La suppression de ce compte est prévue dans 30 jours.'); setBusy(false); return; }
      setEtape('fait');
      setTimeout(() => { authSignOut(); }, 6000);
    } catch (_) { setErr('Le serveur ne répond pas. Rien n’a été supprimé, réessaie.'); setBusy(false); }
  };
  const boite = { maxWidth: 460, margin: '10vh auto 0', padding: 24, borderRadius: 14, background: C.card, color: C.text, border: `1px solid ${C.border}` };
  return <div data-porte-nouveau-oauth={etape} style={{ minHeight: '100vh', background: C.bg, padding: 16, boxSizing: 'border-box' }}>
    <div style={boite} role="dialog" aria-modal="true" aria-labelledby="vrm-nouveau-oauth-titre">
      {etape === 'choix' && <>
        <h1 id="vrm-nouveau-oauth-titre" style={{ fontSize: 20, margin: '0 0 10px' }}>{deja ? 'Ce Discord est déjà sur ton compte VRM' : 'Nouveau compte VRM ?'}</h1>
        {deja
          ? <p data-nouveau-oauth-deja={deja.email} style={{ fontSize: 15, lineHeight: 1.5, margin: '0 0 18px', color: C.muted }}>{deja.pseudo ? `« ${deja.pseudo} »` : 'Ce compte Discord'} sert de pseudo à <strong style={{ color: C.text }}>{deja.email}</strong>, pas pour te connecter. Ce nouveau compte est vide.</p>
          : <p style={{ fontSize: 15, lineHeight: 1.5, margin: '0 0 18px', color: C.muted }}>Ce compte {nom} n’était relié à aucun compte VRM : VRM vient d’en créer un nouveau, vide.</p>}
        <div style={{ display: 'grid', gap: 10 }}>
          {deja && <Bouton variante="primaire" plein  data-nouveau-oauth="existant" onClick={() => setEtape('confirmer')}>Supprimer ce compte vide et revenir au mien</Bouton>}
          <button type="button" className={`vrm-b ${deja ? 'vrm-b-discret' : 'vrm-b-primaire'} vrm-b-plein`} data-nouveau-oauth="continuer" onClick={onContinuer}>Oui, c’est un nouveau compte</button>
          {!deja && <Bouton variante="secondaire" plein  data-nouveau-oauth="existant" onClick={() => setEtape('confirmer')}>J’ai déjà un compte VRM</Bouton>}
        </div>
      </>}
      {etape === 'confirmer' && <>
        <h1 id="vrm-nouveau-oauth-titre" style={{ fontSize: 20, margin: '0 0 10px' }}>Supprimer ce compte vide ?</h1>
        <p style={{ fontSize: 15, lineHeight: 1.5, margin: '0 0 6px', color: C.muted }}>Ton vrai compte n’est pas touché. Ensuite :</p>
        <ol data-nouveau-oauth-etapes="" style={{ fontSize: 15, lineHeight: 1.5, margin: '0 0 18px', paddingLeft: 22, color: C.muted }}><li>connecte-toi {deja ? <>avec <strong>{deja.email}</strong></> : 'avec ton e-mail'} ;</li><li>ta photo de profil → Paramètres → Mon compte → « Relier {nom} ».</li></ol>
        {err && <p role="alert" style={{ fontSize: 13, color: C.warn || C.text, margin: '0 0 12px' }}>{err}</p>}
        <div style={{ display: 'grid', gap: 10 }}>
          <Bouton variante="primaire" plein  data-nouveau-oauth="supprimer" disabled={busy} onClick={supprimer}>{busy ? 'Suppression…' : 'Supprimer ce compte vide'}</Bouton>
          <Bouton variante="discret" plein  onClick={() => setEtape('choix')} disabled={busy}>Annuler</Bouton>
        </div>
      </>}
      {etape === 'fait' && <>
        <h1 id="vrm-nouveau-oauth-titre" style={{ fontSize: 20, margin: '0 0 10px' }}>C’est fait</h1>
        <p style={{ fontSize: 15, lineHeight: 1.5, margin: '0 0 6px', color: C.muted }}>Le compte vide est supprimé. Ensuite :</p>
        <ol style={{ fontSize: 15, lineHeight: 1.5, margin: '0 0 18px', paddingLeft: 22, color: C.muted }}><li>connecte-toi avec ton e-mail ;</li><li>ta photo de profil → Paramètres → Mon compte → « Relier {nom} ».</li></ol>
        <Bouton variante="primaire" plein  onClick={() => authSignOut()}>Aller à la connexion</Bouton>
      </>}
    </div>
  </div>;
}
function PorteMfa({ session }) {
  const etat = etatMfa(session);
  const [passu, setPassu] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [essai, setEssai] = React.useState(0);
  // 'verifier' : relire les facteurs, puis ranger la réponse dans la session.
  React.useEffect(() => {
    if (etat !== 'verifier') return;
    let mort = false;
    setPassu(false);
    (async () => {
      const f = await mfaLireFacteurs();
      if (mort) return;
      if (!f) { setPassu(true); return; }
      const cur = AUTH.session;
      if (!cur || cur.access_token !== session.access_token) return;
      writeSession({ ...cur, totp: f.verifies.map((x) => String(x.id)), totpNoms: totpNoms(f.user) });
    })();
    return () => { mort = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat, essai, session.access_token]);
  // « Pas su » : on réessaie aussi tout seul, toutes les 15 s (le bouton reste).
  React.useEffect(() => {
    if (etat !== 'verifier' || !passu) return;
    const t = setTimeout(() => setEssai((n) => n + 1), 15000);
    return () => clearTimeout(t);
  }, [etat, passu, essai]);
  const envoyer = async (e) => {
    e && e.preventDefault();
    if (busy) return;
    setErr(''); setPassu(false);
    const ids = Array.isArray(session.totp) ? session.totp : [];
    if (!ids.length) { setEssai((n) => n + 1); return; }
    setBusy(true);
    // Le code de N'IMPORTE LEQUEL de ses appareils (22 octobre) : on ne lui
    // demande pas lequel, on les essaie tous (`mfaVerifierCodeParmi`).
    let r = await mfaVerifierCodeParmi(ids, code);
    // Liste périmée (un appareil retiré depuis un autre écran) : on relit les
    // facteurs chez GoTrue et on réessaie UNE fois avec le même code — sinon
    // un code juste serait refusé pour toujours.
    if (r.introuvable) {
      const f = await mfaLireFacteurs();
      if (!f) { setBusy(false); setPassu(true); return; }
      const cur = AUTH.session;
      const frais = f.verifies.map((x) => String(x.id));
      if (cur && cur.access_token === session.access_token) writeSession({ ...cur, totp: frais, totpNoms: totpNoms(f.user) });
      if (!frais.length) { setBusy(false); return; }   // plus aucun appareil : `etatMfa` laisse entrer
      r = await mfaVerifierCodeParmi(frais, code);
    }
    setBusy(false);
    if (r.ok) return;            // la session passe en aal2 : `App` monte le cœur
    if (r.passu) { setPassu(true); return; }
    setErr(r.message || 'Code refusé.'); setCode('');
  };
  // Les appareils enregistrés, nommés (la session les porte — `totpNoms`).
  const noms = (Array.isArray(session.totp) ? session.totp : []).map((id) => (session.totpNoms && session.totpNoms[id]) || '').filter(Boolean);
  const plusieurs = Array.isArray(session.totp) && session.totp.length > 1;
  const contact = contactEmail();
  const field = { width:'100%', boxSizing:'border-box', border:`1px solid ${C.border}`, borderRadius:12, padding:'13px 14px', fontSize:20, letterSpacing:6, textAlign:'center',
    background:C.card, color:C.text, outline:'none', fontFamily:'inherit', fontVariantNumeric:'tabular-nums' };
  const lien = { background:'none', border:'none', color:C.muted, fontSize:13, cursor:'pointer', fontFamily:'inherit', padding:'10px 4px', minHeight:44, textDecoration:'underline' };
  return (
    <div data-porte-mfa={etat} data-mfa-passu={passu ? '1' : '0'} style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px 20px'}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{textAlign:'center',marginBottom:22}}><VrmLogo size={64}/></div>
        <form onSubmit={envoyer} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'20px 18px',boxShadow:C.shadow||'none'}}>
          {etat === 'verifier' ? (<>
            <div style={{fontSize:17,fontWeight:700,color:C.text,letterSpacing:-0.4,marginBottom:6}}>{passu ? 'Vérification impossible pour l’instant' : 'Vérification de ta connexion…'}</div>
            <div style={{fontSize:13,color:C.muted,lineHeight:1.5}}>
              {passu
                ? <>Service de connexion muet. Tu restes connecté : réessaie dans un instant.</>
                : <>Je regarde si ton compte demande un code de vérification.</>}
            </div>
            {passu && <button type="button" data-mfa-reessayer="" onClick={() => setEssai((n) => n + 1)} style={{marginTop:14,width:'100%',minHeight:46,border:'none',borderRadius:12,background:C.accent,color:C.onAccent||'#fff',fontSize:15,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Réessayer</button>}
          </>) : (<>
            <div style={{fontSize:17,fontWeight:700,color:C.text,letterSpacing:-0.4,marginBottom:4}}>Code de ton app d'authentification</div>
            <div data-mfa-appareils={Array.isArray(session.totp) ? session.totp.length : ''} style={{fontSize:13,color:C.muted,marginBottom:14,lineHeight:1.5}}>
              La double vérification est activée sur <b style={{color:C.text}}>{(session.user && session.user.email) || 'ton compte'}</b>. {plusieurs
                ? <>Ouvre l'app d'authentification de <b style={{color:C.text}}>l'un</b> de tes appareils{noms.length ? <> ({noms.join(' · ')})</> : null} et tape le code à 6 chiffres affiché pour VRM — celui de n'importe lequel marche.</>
                : <>Ouvre ton app d'authentification et tape le code à 6 chiffres affiché pour VRM.</>}
            </div>
            <input data-mfa-code="" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={7} autoFocus placeholder="000000"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={field}/>
            {err && <div data-mfa-erreur="" style={{fontSize:13,color:C.danger,marginTop:10,lineHeight:1.45}}>{err}</div>}
            {passu && <div data-mfa-injoignable="" style={{fontSize:13,color:C.text,background:`${C.warn}12`,border:`1px solid ${C.warn}44`,borderRadius:12,padding:'9px 11px',marginTop:10,lineHeight:1.45}}>Code pas vérifié (service muet). Tu restes connecté : réessaie.</div>}
            <button type="submit" data-mfa-valider="" disabled={busy || code.length !== 6}
              style={{marginTop:12,width:'100%',minHeight:46,border:'none',borderRadius:12,background:C.accent,color:C.onAccent||'#fff',fontSize:15,fontWeight:600,cursor:busy||code.length!==6?'default':'pointer',opacity:busy||code.length!==6?0.55:1,fontFamily:'inherit'}}>
              {busy ? 'Vérification…' : passu ? 'Réessayer' : 'Valider'}
            </button>
            <div data-mfa-perdu={plusieurs ? 'autre-appareil' : 'contact'} style={{fontSize:12,color:C.muted,marginTop:14,lineHeight:1.5,borderTop:`1px solid ${C.border}`,paddingTop:12}}>
              {plusieurs
                ? <><b style={{color:C.text}}>Un appareil perdu ou changé ?</b> Entre avec un AUTRE appareil, puis retire le perdu (Paramètres → Double vérification).</>
                : <><b style={{color:C.text}}>Plus accès à ton app (téléphone perdu ou changé) ?</b> La double vérification ne se retire pas depuis cet écran. Écris à VRM depuis l'adresse e-mail de ton compte : {contact
                  ? <a href={`mailto:${contact}`} style={{color:C.accentTexte,textDecoration:'none',display:'inline-flex',alignItems:'center',minHeight:44}}>{contact}</a>
                  : <span data-contact-absent="">{CONTACT_A_VENIR}</span>}.</>}
            </div>
          </>)}
        </form>
        <div style={{textAlign:'center',marginTop:8}}>
          <button type="button" data-mfa-deconnexion="" onClick={() => { authSignOut(); location.reload(); }} style={lien}>Se déconnecter</button>
        </div>
      </div>
    </div>
  );
}

// ── La vérification anti-robot de l'écran de connexion (src/captcha.js) ─────
// Rendue SEULEMENT quand une clé de site Turnstile est posée : sans clé, rien —
// ni widget, ni requête vers Cloudflare. Le widget se recharge sur « Réessayer ».
function useCaptcha() {
  const [e, setE] = React.useState(etatCaptcha);
  React.useEffect(() => abonnerCaptcha(setE), []);
  return e;
}
function CaptchaConnexion({ etat }) {
  const ref = React.useRef(null);
  const [essai, setEssai] = React.useState(0);
  React.useEffect(() => monterWidget(ref.current, { sombre: C === THEMES.dark }), [essai]);
  if (!captchaActif()) return null;
  return (
    <div data-captcha={etat.statut} style={{marginBottom:10}}>
      <div ref={ref} data-captcha-widget="" style={{minHeight:etat.statut==='erreur'?0:65}}/>
      {etat.statut === 'charge' && <div data-captcha-attente="" style={{fontSize:12,color:C.muted,lineHeight:1.45}}>{tr('auth.captcha.charge')}</div>}
      {etat.statut === 'interactif' && <div data-captcha-attente="" style={{fontSize:12,color:C.text,lineHeight:1.45}}>{tr('auth.captcha.interactif')}</div>}
      {etat.statut === 'erreur' && (
        <div data-captcha-erreur="" style={{fontSize:13,color:C.text,background:`${C.warn}12`,border:`1px solid ${C.warn}44`,borderRadius:12,padding:'9px 11px',lineHeight:1.45}}>
          {MSG_CAPTCHA_ERREUR}
          <div><button type="button" data-captcha-reessayer="" onClick={() => setEssai((n) => n + 1)}
            style={{marginTop:8,minHeight:46,border:`1px solid ${C.border}`,background:C.bg,color:C.text,borderRadius:12,padding:'0 14px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{tr('commun.reessayer')}</button></div>
        </div>
      )}
    </div>
  );
}

function AuthScreen() {
  // Trois états : `undefined` = on sonde · `true` = la clé publique lit encore
  // · `false` = fermée · `null` = pas su. Une seule requête, en lecture seule
  // (§2.3 : une sonde n'écrit jamais dans sa base).
  const [ouverte, setOuverte] = React.useState(undefined);
  const [moyensConnexion,setMoyensConnexion]=React.useState(etatAuthSettings);
  React.useEffect(()=>{
    const actualiser=()=>setMoyensConnexion(etatAuthSettings());
    const off=onAuthSettingsChange(actualiser);actualiser();return off;
  },[]);
  React.useEffect(() => {
    let stop = false;
    (async () => { const v = await sondeLectureSansCompte(); if (!stop) setOuverte(v); })();
    return () => { stop = true; };
  }, []);
  // `?inscription` = le bouton « Créer mon compte » de la page d'accueil : on
  // ouvre directement le bon formulaire (un clic de plus pour s'inscrire, c'est
  // des inscriptions en moins).
  const [mode, setMode] = React.useState(() => (RECOVERY_PENDING || (AUTH_REDIRECT && AUTH_REDIRECT.recovery)) ? 'newpw'
    : ((/[?&]inscription(=|&|$)/.test(window.location.search || '') || PARRAIN_DU_LIEN || PARTENAIRE_DU_LIEN) ? 'up'
    // 5.328 : « Mot de passe oublié ? » dans la carte de l'extension.
    : /[?&]mot-de-passe-oublie(=|&|$)/.test(window.location.search || '') ? 'reset' : 'in')); // in · up · reset · newpw
  const [email, setEmail] = React.useState('');
  // Le prénom demandé à l'inscription : il sert au bonjour de l'accueil, rien
  // d'autre. Rangé dans le même réglage synchronisé que le champ de Réglages
  // (§11) — un seul propriétaire, `vrm_prenom`.
  const [prenom, setPrenom] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [motDePasseVisible, setMotDePasseVisible] = React.useState(false);
  React.useEffect(()=>setMotDePasseVisible(false),[mode]);
  const [busy, setBusy] = React.useState(false);
  const [fournisseurEnCours,setFournisseurEnCours]=React.useState('');
  const demandeEnCours=React.useRef(false);
  const [err, setErr] = React.useState(() => (AUTH_REDIRECT && AUTH_REDIRECT.error) || '');
  const [info, setInfo] = React.useState('');
  // (13 nov., lot 54) « Offert par <nom choisi> » : lu SANS session par le code du lien (le nom seul).
  // `undefined` en cours · `null` pas su (rien n'est dit) · { ouvert, connu, nom }.
  const [apercuParrain, setApercuParrain] = React.useState(undefined);
  React.useEffect(() => { const c = codeParrainGarde(); if (!c) { setApercuParrain(null); return; } let stop = false; lireApercuParrain(c).then((x) => { if (!stop) setApercuParrain(x); }); return () => { stop = true; }; }, []);
  const [needConfirm, setNeedConfirm] = React.useState(false);   // compte créé, email pas encore confirmé
  const [confirmLink, setConfirmLink] = React.useState('');      // lien du mail, collé à la main
  const [resetEnvoye, setResetEnvoye] = React.useState('');      // (8 nov.) adresse à qui le lien vient de partir
  // 22 oct. : GoTrue a refusé un email redemandé trop tôt (« after N seconds »)
  // ⇒ les boutons qui envoient un email restent grisés jusqu'à `finAttente`, et
  // la phrase dit le temps qui reste. Une autre adresse tapée remet à zéro.
  const [finAttente, setFinAttente] = React.useState(0);
  const resteAttente = useSecondesRestantes(finAttente);
  const enAttenteEmail = resteAttente > 0;
  const attendreEmail = (r) => { if (r && r.attente) { setFinAttente(Date.now() + r.attente * 1000); setErr(''); return true; } return false; };
  const captcha = useCaptcha();
  // Sans jeton anti-robot, les appels protégés ne partent pas : le bouton le DIT.
  const attendCaptcha = captchaActif() && mode !== 'newpw' && captcha.statut !== 'pret';

  // Retour « en arrière » depuis Google/Discord : le navigateur restaure la page
  // depuis son cache (bfcache) avec l'état React FIGÉ — `busy` reste à true et le
  // bouton « Se connecter » reste bloqué sur « ... ». `pageshow`+`persisted` est
  // le seul signal d'une restauration bfcache : on débloque le bouton.
  React.useEffect(() => {
    const onShow = (e) => { if (e && e.persisted) {demandeEnCours.current=false;setBusy(false);setFournisseurEnCours('');} };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  const changerMode = (suivant) => {
    if(busy||demandeEnCours.current)return;
    setMode(suivant);setErr('');setInfo('');setNeedConfirm(false);setConfirmLink('');
    // L'attente posée par NOTRE envoi réussi ne suit pas sur un autre écran (un refus de Supabase, lui, garde la sienne).
    if(resetEnvoye){setResetEnvoye('');setFinAttente(0);}
  };

  const oauth = async (p, intention) => {
    if(busy||demandeEnCours.current)return;
    demandeEnCours.current=true;setErr('');setInfo('');setBusy(true);setFournisseurEnCours(p);
    try {
      const r=await oauthStart(p, intention||(mode==='up'?'inscription':'connexion'));
      if (!r.ok) {demandeEnCours.current=false;setErr(r.error);setBusy(false);setFournisseurEnCours('');}
    } catch (_) {demandeEnCours.current=false;setErr(tr('auth.err.ouverture'));setBusy(false);setFournisseurEnCours('');}
    // Le verrou reste pris pendant le départ chez le fournisseur ; pageshow
    // le libère si l’utilisateur revient en arrière avec le cache du navigateur.
  };
  // 8 nov. (5.325) : arrivé de l'extension par « Continuer avec Google /
  // Discord » (`__lierConnexion`, posé au chargement si aucune session) : on
  // part chez le fournisseur sans second clic — seulement s'il est ACTIVÉ chez
  // Supabase (lu, jamais supposé). Pas activé ⇒ cet écran, et la phrase.
  // « Pas su » (lecture ratée) ⇒ la phrase, la demande reste : « Réessayer »
  // la relance. Une fois, puis oubliée (deux minutes au plus après l'arrivée).
  const [lierFournisseur] = React.useState(() => (__lierConnexion && mode === 'in' && Date.now() - __lierConnexion.at < 2 * 60000) ? __lierConnexion.fournisseur : '');
  const [lierFournisseurMot, setLierFournisseurMot] = React.useState('');
  React.useEffect(() => {
    if (!lierFournisseur || !__lierConnexion) return;
    const nom = lierFournisseur === 'google' ? 'Google' : 'Discord';
    if (moyensConnexion.statut === 'pret') {
      oublierLierConnexion();
      if (providerEnabled(lierFournisseur)) { setLierFournisseurMot(''); oauth(lierFournisseur); }
      else setLierFournisseurMot(tr('auth.lier.pasOuverte', { nom }));
    } else if (moyensConnexion.statut === 'erreur') setLierFournisseurMot(tr('auth.lier.pasVerifie', { nom }));
    else if (moyensConnexion.statut === 'initial') loadAuthSettings();
  }, [moyensConnexion.statut]);

  const actionConfirmation = async (action) => {
    if(busy||demandeEnCours.current||(action!=='confirmer'&&enAttenteEmail))return;
    demandeEnCours.current=true;setBusy(true);setErr('');setInfo('');
    try {
      const r=await (action==='confirmer'?authConfirmFromLink(confirmLink,email):action==='renvoyer'?authResendConfirm(email):authMagicLink(email));
      if(!r.ok){if(r.recovery){setMode('reset');setNeedConfirm(false);setConfirmLink('');}if(!attendreEmail(r))setErr(r.error);return;}
      if(action==='confirmer'){
        setNeedConfirm(false);setConfirmLink('');
        setInfo(r.connected?tr('auth.info.compteConfirme'):tr('auth.info.adresseConfirmee'));
        if(r.connected)setTimeout(()=>location.reload(),800);
      } else if(action==='renvoyer')setInfo(tr('auth.info.nouvelEmail'));
      else setInfo(tr('auth.info.lienEnvoye'));
    } catch (_) {setErr(tr('auth.err.demande'));}
    finally {demandeEnCours.current=false;setBusy(false);}
  };

  const submit = async (e) => {
    e && e.preventDefault();
    if(busy||demandeEnCours.current)return;
    if (enAttenteEmail && (mode === 'up' || mode === 'reset')) return;
    setErr(''); setInfo('');
    if (mode !== 'newpw' && !email.trim()) { setErr(tr('auth.err.email')); return; }
    if (mode !== 'reset' && !pw) {setErr(tr('auth.err.motDePasse'));return;}
    if ((mode === 'up' || mode === 'newpw') && pw.length < 8) { setErr(tr('auth.err.court')); return; }
    // Un mot de passe qui protège une comptabilité mérite mieux que « 12345678 ».
    if ((mode === 'up' || mode === 'newpw') && /^(\d+|[a-z]+)$/i.test(pw)) { setErr(tr('auth.err.melange')); return; }
    demandeEnCours.current=true;setBusy(true);
    try {
      if (mode === 'newpw') {
        const r = await authSetPassword(pw);
        if (!r.ok) setErr(r.error);
        else { setInfo(tr('auth.info.mdpEnregistre')); setTimeout(()=>location.reload(), 900); }
      } else if (mode === 'reset') {
        const rr = await authReset(email);
        if (rr && rr.captcha) { setErr(rr.error); return; }
        if (rr && !rr.ok && attendreEmail({ attente: delaiDemandeEmail(rr.error) })) return;
        if(!rr?.ok){setErr(tr('auth.err.envoiLien'));return;}
        // Réponse volontairement identique que le compte existe ou non : sinon
        // ce formulaire dirait à n'importe qui quels emails sont inscrits.
        // (8 nov.) La phrase dit le geste ; « Renvoyer » attend l'intervalle de
        // Supabase (60 s) sur le bouton lui-même.
        const adresse=String(email).trim().toLowerCase();
        setResetEnvoye(adresse);setFinAttente(Date.now()+60*1000);
        setInfo(tr('auth.info.emailEnvoye', { adresse }));
      } else if (mode === 'up') {
        // On l'écrit AVANT de partir : `save` range dans le navigateur et le
        // nuage suivra à la première synchro. Écrit seulement s'il l'a donné —
        // on n'invente pas un prénom vide (§5 : mieux vaut un blanc qu'un faux).
        try { if (prenom.trim()) save('vrm_prenom', prenom.trim()); } catch (_) {}
        const r = await authSignUp(email, pw);
        if (!r.ok) { if(attendreEmail(r)){} else if(r.incertain){setMode('in');setInfo(r.error);}else setErr(r.error); }
        else if (r.needsConfirm) { setNeedConfirm(true); setMode('in'); setInfo(tr('auth.info.compteCree')); }
        else location.reload();
      } else {
        const r = await authSignIn(email, pw);
        if (!r.ok) { setErr(r.needsConfirm?'':r.error); setNeedConfirm(!!r.needsConfirm); }
        // Rechargement volontaire après connexion : l'app relit alors le cloud
        // du bon vendeur depuis un état propre. Sans ça, un composant déjà monté
        // pourrait garder en mémoire les données du vendeur précédent.
        else location.reload();
      }
    } catch (_) {setErr(tr('auth.err.demande'));}
    finally { demandeEnCours.current=false;setBusy(false); }
  };

  // 16 px : sous 16 px, Safari iPhone ZOOME la page au toucher d'un champ.
  const field = { width:'100%', boxSizing:'border-box', border:`1px solid ${C.border}`, borderRadius:12,
    padding:'0 14px', height:50, fontSize:17, background:C.card, color:C.text, outline:'none', fontFamily:'inherit' };

  // 21 oct. — « l'onglet connexion est nul » : un logo carré au milieu d'un
  // fond gris, sans dire où l'on est. Deux colonnes sur ordinateur (la marque
  // à gauche, sur l'ardoise de la page d'accueil ; le formulaire à droite),
  // un en-tête de marque sur téléphone. La logique ne change pas.
  return (
    <div className="vrm-cx" data-espace="autres" data-connexion="">
      <style>{`
.vrm-cx{min-height:100vh;min-height:100dvh;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto 1fr;background:${C.bg}}
.vrm-cx-marque{position:relative;overflow:hidden;background:#1D1D1F;color:#F5F5F7;padding:calc(18px + env(safe-area-inset-top)) 20px 64px}
.vrm-cx-marque:before{content:none}
.vrm-cx-haut{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px}
.vrm-cx-logo{display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit}
.vrm-cx-logo img{width:36px;height:36px;border-radius:12px;box-shadow:0 0 0 1px rgba(255,255,255,.12)}
.vrm-cx-logo b{font-size:20px;letter-spacing:-.04em;font-weight:700}
.vrm-cx-retour{display:inline-flex;align-items:center;min-height:44px;font-size:15px;color:#98989D;text-decoration:none;font-weight:400}
.vrm-cx-titre{position:relative;font-size:28px;line-height:1.15;letter-spacing:-.04em;font-weight:700;margin:22px 0 0}
.vrm-cx-titre span{display:block;color:#98989D}
.vrm-cx-points{display:none}
.vrm-cx-main{display:flex;justify-content:center;padding:0 16px 32px}
.vrm-cx-boite{width:100%;max-width:400px;margin-top:-44px;position:relative}
.vrm-cx-form{background:${C.card};border:0;border-radius:20px;padding:22px 20px;box-shadow:none}
.vrm-cx-form input:focus{border-color:${C.accent}!important;box-shadow:0 0 0 3px ${C.accent}26}
.vrm-cx-form button[type=submit]{min-height:50px;border-radius:999px!important;transition:transform 140ms cubic-bezier(0.23,1,0.32,1),opacity 140ms ease}
.vrm-cx-form button[type=submit]:active{transform:scale(.98)}
.vrm-cx-liens button{min-height:44px}
.vrm-cx-exemple{margin:14px 0 0;text-align:center}
.vrm-cx-exemple p{margin:0 0 8px;font-size:13px;line-height:1.45;color:${C.muted}}
.vrm-cx-exemple a{display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:999px;border:0;background:rgba(118,118,128,${C.bg==='#000000'||C.bg==='#000'?'.24':'.12'});color:${C.text};font-size:15px;font-weight:600;text-decoration:none}
.vrm-cx-exemple a:focus-visible{outline:2px solid ${C.accent};outline-offset:3px}
.vrm-cx-oublie{border:0;background:transparent;color:${C.accentTexte||C.accent};padding:4px 0;font:inherit;font-size:13px;font-weight:600;min-height:44px;cursor:pointer}
.vrm-cx-aide-confirmation{margin-top:12px;border-top:1px solid ${C.border};padding-top:10px}
.vrm-cx-aide-confirmation summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-weight:600;color:${C.accentTexte||C.accent}}
.vrm-cx-form button:disabled{cursor:default}
.vrm-cx-champ{display:block;margin-bottom:12px;font-size:13px;font-weight:600;color:${C.text}}
.vrm-cx-parrain{display:flex;gap:10px;align-items:flex-start;font-size:15px;line-height:1.45;color:${C.text};background:${C.accent}0D;border:1px solid ${C.accent}40;border-radius:12px;padding:10px 12px;margin-bottom:14px}
.vrm-cx-parrain-ic{display:flex;flex:none;color:${C.accentTexte||C.accent};margin-top:1px}
.vrm-cx-parrain b{display:block;font-weight:600;overflow-wrap:anywhere}
.vrm-cx-parrain-texte{display:block;color:${C.muted};font-size:13px}
.vrm-cx-parrain-montrer{display:flex;align-items:center;gap:8px;min-height:44px;margin-top:4px;font-size:14px;color:${C.text};cursor:pointer}
.vrm-cx-parrain-montrer input{width:20px;height:20px;margin:0;flex:none}
.vrm-cx-champ>span:first-child{display:block;margin-bottom:6px}
.vrm-cx-secret{position:relative;display:block}
.vrm-cx-secret button{position:absolute;right:4px;top:3px;min-height:44px;padding:0 10px;border:0;border-radius:6px;background:transparent;color:${C.accentTexte||C.accent};font-size:13px;font-weight:600;font-family:inherit;cursor:pointer}
.vrm-cx-form button:focus-visible,.vrm-cx-form a:focus-visible{outline:2px solid ${C.accent};outline-offset:3px}
.vrm-cx-regles{display:flex;flex-wrap:wrap;gap:5px 12px;margin:0 0 14px;padding:0;list-style:none;font-size:12px;line-height:1.5;color:${C.muted}}
.vrm-cx-regles [data-valide=true]{color:${C.accentTexte||C.accent}}
.vrm-cx-regles li:before{content:'○ ';font-weight:700}
.vrm-cx-regles [data-valide=true]:before{content:'✓ '}
.vrm-cx-form [role=status],.vrm-cx-form [role=alert]{overflow-wrap:anywhere}
@media (min-width:900px){
 .vrm-cx{grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:1fr}
 .vrm-cx-marque{display:flex;flex-direction:column;padding:40px 56px}
 .vrm-cx-titre{font-size:clamp(34px,3vw,44px);margin-top:auto}
 .vrm-cx-points{display:grid;gap:14px;margin:28px 0 auto;padding:0;list-style:none;max-width:420px;position:relative}
 .vrm-cx-points li{display:grid;grid-template-columns:28px 1fr;gap:10px;font-size:15px;line-height:1.5;color:#98989D}
 .vrm-cx-points li b{color:#F5F5F7;font-weight:600}
 .vrm-cx-points i{width:28px;height:28px;border-radius:12px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-style:normal;font-size:13px;color:#F5F5F7}
 .vrm-cx-pied{position:relative;font-size:13px;color:#98989D}
 .vrm-cx-main{align-items:center;padding:40px}
 .vrm-cx-boite{margin-top:0}
}
/* 27 oct. — Julien : « une animation sur l'onglet de connexion ». Une aurore lente
   derrière la marque (trois halos sauge et pétrole qui dérivent, transform seul),
   des étiquettes qui flottent (décor, aria-hidden, aucun chiffre : rien
   d'inventé), puis l'entrée : titre, points et formulaire arrivent en cascade.
   Rien si « réduire les animations ». */
.vrm-cx-aurore{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.vrm-cx-aurore i{position:absolute;border-radius:50%;filter:blur(50px);will-change:transform}
.vrm-cx-aurore i:nth-child(1){width:62%;aspect-ratio:1;left:-18%;top:-22%;background:#16181D;opacity:.32;animation:vrmCxDerive1 19s ease-in-out infinite alternate}
.vrm-cx-aurore i:nth-child(2){width:48%;aspect-ratio:1;right:-14%;top:18%;background:#6E6E73;opacity:.26;animation:vrmCxDerive2 23s ease-in-out infinite alternate}
.vrm-cx-aurore i:nth-child(3){width:56%;aspect-ratio:1;left:22%;bottom:-30%;background:#2C2C2E;opacity:.6;animation:vrmCxDerive3 27s ease-in-out infinite alternate}
@keyframes vrmCxDerive1{to{transform:translate3d(18%,14%,0) scale(1.12)}}
@keyframes vrmCxDerive2{to{transform:translate3d(-22%,10%,0) scale(.9)}}
@keyframes vrmCxDerive3{to{transform:translate3d(-12%,-18%,0) scale(1.15)}}
.vrm-cx-etiquettes{display:none}
.vrm-cx-titre,.vrm-cx-titre span,.vrm-cx-points li,.vrm-cx-boite{animation:vrmCxEntre .62s cubic-bezier(.23,1,.32,1) both}
.vrm-cx-titre span{animation-delay:.09s}
.vrm-cx-points li:nth-child(1){animation-delay:.18s}
.vrm-cx-points li:nth-child(2){animation-delay:.26s}
.vrm-cx-points li:nth-child(3){animation-delay:.34s}
.vrm-cx-boite{animation-name:vrmCxMonte;animation-delay:.12s}
@keyframes vrmCxEntre{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:none}}
@keyframes vrmCxMonte{from{opacity:0;transform:translate3d(0,18px,0) scale(.98)}to{opacity:1;transform:none}}
@media (min-width:1200px){
 .vrm-cx-etiquettes{display:block;position:absolute;inset:0;pointer-events:none}
 .vrm-cx-etiquettes span{position:absolute;display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:999px;font-size:13px;font-weight:600;color:#F5F5F7;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:vrmCxFlotte 7s ease-in-out infinite alternate,vrmCxEntre .7s cubic-bezier(.23,1,.32,1) both}
 .vrm-cx-etiquettes span:before{content:"";width:7px;height:7px;border-radius:50%;background:#F5F5F7;box-shadow:0 0 0 4px rgba(245,245,247,.14)}
 .vrm-cx-etiquettes span:nth-child(1){right:8%;top:13%;animation-delay:0s,.45s}
 .vrm-cx-etiquettes span:nth-child(2){right:36%;top:17%;animation-duration:8.5s,.7s;animation-delay:-2s,.55s}
 .vrm-cx-etiquettes span:nth-child(3){right:8%;bottom:22%;animation-duration:9s,.7s;animation-delay:-4s,.65s}
 .vrm-cx-etiquettes span:nth-child(4){right:32%;bottom:12%;animation-duration:7.8s,.7s;animation-delay:-1s,.75s}
}
@keyframes vrmCxFlotte{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,-12px,0)}}
@media (prefers-reduced-motion:reduce){
 .vrm-cx-form button[type=submit]{transition:none}
 .vrm-cx-aurore i,.vrm-cx-etiquettes span,.vrm-cx-titre,.vrm-cx-titre span,.vrm-cx-points li,.vrm-cx-boite{animation:none}
}
`}</style>
      <aside className="vrm-cx-marque">
        <div className="vrm-cx-aurore" aria-hidden="true" data-cx-aurore=""><i/><i/><i/></div>
        <div className="vrm-cx-etiquettes" aria-hidden="true"><span>{tr('auth.deco.colis')}</span><span>{tr('auth.deco.bordereau')}</span><span>{tr('auth.deco.vendu')}</span><span>{tr('auth.deco.retiree')}</span></div>
        {/* (15 nov., lot site-public) Sur un grand écran, l'app elle-même à côté de la phrase : la capture de Ma journée
            de la page d'accueil (mode exemple, au registre public/accueil/captures.json), dite « données d'exemple ». */}
        <figure className="vrm-cx-apercu" data-cx-apercu="">
          <span><picture><source srcSet="/accueil/journee-sombre.webp" media="(prefers-color-scheme: dark)" type="image/webp"/><img src="/accueil/journee-clair.webp" alt="" width="780" height="1688" loading="lazy" decoding="async"/></picture></span>
          <figcaption>{tr('accueil.capture.legende')}</figcaption>
        </figure>
        <div className="vrm-cx-haut">
          <a href="/" className="vrm-cx-logo" aria-label={tr('auth.logoAccueil')}>
            <img src="/vrm-logo-v5-192.png" alt="" width="36" height="36"/><b>VRM</b>
          </a>
          {/* Retour vers la page d'accueil publique (main.jsx l'affiche à qui n'a
              pas de session) : sans lui, l'écran de connexion est un cul-de-sac. */}
          <a href="/" data-retour-accueil="" className="vrm-cx-retour">← {tr('auth.decouvrir')}</a>
        </div>
        <h1 className="vrm-cx-titre">{mode==='up' ? <>{tr('auth.marque.bienvenue')}<span>{tr('auth.marque.espace')}</span></> : <>{tr('auth.marque.revoir')}<span>{tr('auth.marque.attend')}</span></>}</h1>
        <ul className="vrm-cx-points">
          <li><i>1</i><span><b>{tr('auth.point1.titre')}</b>{tr('auth.point1.texte')}</span></li>
          <li><i>2</i><span><b>{tr('auth.point2.titre')}</b>{tr('auth.point2.texte')}</span></li>
          <li><i>3</i><span><b>{tr('auth.point3.titre')}</b>{tr('auth.point3.texte')}</span></li>
        </ul>
        <div className="vrm-cx-pied vrm-cx-points">{tr('auth.pied')}</div>
      </aside>
      <main className="vrm-cx-main">
      <div className="vrm-cx-boite">
        <form onSubmit={submit} className="vrm-cx-form" aria-busy={busy} aria-labelledby="vrm-cx-titre-formulaire">
          <h2 id="vrm-cx-titre-formulaire" style={{fontSize:20,fontWeight:700,color:C.text,letterSpacing:-0.4,margin:'0 0 4px'}}>
            {mode==='up' ? tr('auth.titre.up') : mode==='reset' ? tr('auth.titre.reset') : mode==='newpw' ? tr('auth.titre.newpw') : tr('auth.titre.in')}
          </h2>
          <div style={{fontSize:15,color:C.muted,marginBottom:mode==='in'?14:18,lineHeight:1.5}}>
            {/* ⚠️ Ne PAS promettre l'isolation tant que la base ne la fait pas :
                sans la colonne `owner` (§12), un compte créé ici tombe dans les
                MÊMES données que le vendeur existant. Le dire avant, pas après. */}
            {/* (2 nov.) « Pas su » ne vaut pas « non » (§5) : la sonde de schéma
                qui n'a pas répondu (réseau, base lente) ne fait plus dire à une
                personne qui s'inscrit que ses données seront partagées — seul un
                « colonne absente » MESURÉ (400) le dit ; sinon, rien. */}
            {mode==='up' ? (CLOISONNE
              ? tr('auth.sous.cloisonne')
              : SCHEMA_MESURE ? tr('auth.sous.pasCloisonne') : null)
             : mode==='reset' ? tr('auth.sous.reset')
             : mode==='newpw' ? tr('auth.sous.newpw')
             : null /* « Ta boutique t'attend » est déjà dit au-dessus (§7) */}
          </div>
          {/* (13 nov., lot 54) Arrivé par un lien de parrainage : « Offert par <nom choisi> » — le nom que
              le parrain a CHOISI (jamais son pseudo Vinted), sinon « un vendeur VRM ». Programme fermé,
              code inconnu ou pas su : rien n'est promis. */}
          {(mode==='up'||mode==='in') && apercuParrain && apercuParrain.ouvert && apercuParrain.connu && (
            <div role="note" data-parrain-offert={apercuParrain.nom||''} className="vrm-cx-parrain">
              <span className="vrm-cx-parrain-ic" aria-hidden="true"><Icon name="cadeau" size={20}/></span>
              <span><b>{apercuParrain.nom ? tr('auth.parrain.offertPar', { nom: apercuParrain.nom }) : tr('auth.parrain.offertVendeur')}</b>
                <span className="vrm-cx-parrain-texte">{mode==='up' ? tr('auth.parrain.texte') : tr('auth.parrain.texteConnexion')}</span>
                {/* (25 nov.) Le filleul CHOISIT de montrer son prénom à son parrain — décoché par défaut. */}
                {mode==='up' && <label className="vrm-cx-parrain-montrer"><input type="checkbox" data-parrain-montrer="" defaultChecked={(() => { try { return localStorage.getItem('vrm_parrain_montrer') === '1'; } catch (_) { return false; } })()}
                  onChange={(e) => { try { if (e.target.checked) localStorage.setItem('vrm_parrain_montrer', '1'); else localStorage.removeItem('vrm_parrain_montrer'); } catch (_) {} }}/><span>{tr('auth.parrain.montrer')}</span></label>}</span>
            </div>
          )}
          {/* 11 octobre : on arrive ici depuis « Se connecter » dans l'extension.
              UNE connexion pour les deux : l'app connecte l'extension juste après. */}
          {__lier && (mode==='in' || mode==='up') && (
            <div data-lier-connexion="" style={{fontSize:13,color:C.text,background:`${C.accent}12`,border:`1px solid ${C.accent}55`,borderRadius:12,padding:'8px 10px',marginBottom:14,lineHeight:1.45}}>
              {tr('auth.lier.extension', { navigateur: NAV.de })}
            </div>
          )}
          {/* (11 nov., lot DJ6) « Continuer avec Discord » sans compte VRM : rien n'a été créé (annulé par le serveur). */}
          {AUTH_REDIRECT?.sansCompteFournisseur && mode==='in' && (()=>{ const p=AUTH_REDIRECT.sansCompteFournisseur, nom=p==='google'?'Google':'Discord'; return <div role="alert" data-sans-compte={p} style={{fontSize:15,color:C.text,border:`1px solid ${C.warn}66`,background:`${C.warn}10`,borderRadius:12,padding:'10px 12px',marginBottom:14,lineHeight:1.45}}>
            <div style={{fontWeight:600}}>{tr('auth.sansCompte.titre', { nom })}</div>
            <div style={{color:C.muted,marginTop:2}}>{tr('auth.sansCompte.texte', { nom })}</div>
            {providerEnabled(p) && <button type="button" data-sans-compte-creer={p} disabled={busy} onClick={()=>oauth(p,'inscription')} style={{display:'block',minHeight:44,padding:'8px 0 0',border:0,background:'transparent',color:C.accentTexte,font:'inherit',fontWeight:600,cursor:busy?'default':'pointer'}}>{tr('auth.sansCompte.creer', { nom })}</button>}
          </div>; })()}
          {lierFournisseurMot && (mode==='in' || mode==='up') && <div role="status" data-lier-fournisseur-mot={lierFournisseur} style={{fontSize:13,color:C.text,border:`1px solid ${C.border}`,borderRadius:12,padding:'8px 10px',marginBottom:14,lineHeight:1.45}}>{lierFournisseurMot}</div>}
          {__lierRetourPerime && (mode==='in' || mode==='up') && <div role="status" data-lier-retour-perime="" style={{fontSize:13,color:C.text,border:`1px solid ${C.border}`,borderRadius:12,padding:'8px 10px',marginBottom:14,lineHeight:1.45}}><div>{tr('auth.perime.1')}</div><div>{tr('auth.perime.2')}</div></div>}

          {(mode==='in'||mode==='up') && moyensConnexion.statut==='chargement' && <div role="status" style={{fontSize:12,color:C.muted,lineHeight:1.5,marginBottom:12}}>{tr('auth.moyens.chargement')}</div>}
          {(mode==='in'||mode==='up') && moyensConnexion.statut==='erreur' && <div data-auth-moyens-indisponibles="" style={{fontSize:12,color:C.text,lineHeight:1.5,marginBottom:14,padding:'10px 12px',border:`1px solid ${C.border}`,borderRadius:12}}>
            {tr('auth.moyens.erreur')}
            <button type="button" disabled={busy} onClick={()=>loadAuthSettings()} style={{display:'block',minHeight:44,padding:'8px 0 0',border:0,background:'transparent',color:C.accentTexte,font:'inherit',fontWeight:600,cursor:busy?'default':'pointer'}}>{tr('auth.moyens.reessayer')}</button>
          </div>}


          {/* Création de compte alors que la confirmation par email est active :
              on prévient AVANT, sinon on tape son mot de passe pour rien. */}
          {mode==='up' && confirmRequired() && (
            <div style={{fontSize:12,color:C.text,background:`${C.accent}08`,border:`1px solid ${C.border}`,borderRadius:12,padding:'9px 11px',marginBottom:14,lineHeight:1.5}}>
              {tr('auth.confirmer.avant')}<b>{tr('auth.confirmer.gras')}</b>{tr('auth.confirmer.apres')}
            </div>
          )}

          {/* ⚠️ LE PRÉNOM SE DEMANDE ICI, ET NULLE PART AILLEURS. L'accueil dit
              « Bonjour » tout court tant qu'on ne le connaît pas — c'est honnête
              mais froid, et aller le chercher dans Réglages, personne ne le
              fait. À la création du compte, c'est la question la plus naturelle
              du monde. Facultatif : un champ obligatoire de plus pour un
              bonjour serait un péage. */}
          {mode==='up' && (
            <label className="vrm-cx-champ"><span>{tr('auth.champ.prenom')} <span style={{fontWeight:400,color:C.muted}}>{tr('auth.champ.facultatif')}</span></span>
              <input type="text" autoComplete="given-name" placeholder={tr('auth.champ.prenomPlaceholder')}
                disabled={busy} value={prenom} onChange={e=>setPrenom(e.target.value.slice(0,24))} style={field}/>
            </label>
          )}
          {mode!=='newpw' && (
            <label className="vrm-cx-champ"><span>{tr('auth.champ.email')}</span>
              <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={tr('auth.champ.emailPlaceholder')} required
                disabled={busy} value={email} onChange={e=>{setEmail(e.target.value);setNeedConfirm(false);setConfirmLink('');setInfo('');setErr('');setFinAttente(0);setResetEnvoye('');}} style={field}/>
            </label>
          )}
          {mode!=='reset' && (
            <div className="vrm-cx-champ"><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:6}}>
                <label htmlFor="vrm-cx-password">{mode==='newpw'?tr('auth.titre.newpw'):tr('auth.champ.mdp')}</label>
                {mode==='in' && <button type="button" disabled={busy} onClick={()=>changerMode('reset')} className="vrm-cx-oublie">{tr('auth.oublie')}</button>}
              </div>
              <span className="vrm-cx-secret">
                <input id="vrm-cx-password" type={motDePasseVisible?'text':'password'} autoComplete={(mode==='up'||mode==='newpw')?'new-password':'current-password'} required
                  aria-describedby={(mode==='up'||mode==='newpw')?'vrm-cx-regles':undefined}
                  placeholder={mode==='newpw'?tr('auth.champ.nouveauMdpPlaceholder'):tr('auth.champ.mdp')}
                  disabled={busy} value={pw} onChange={e=>{setPw(e.target.value);setErr('');}} style={{...field,paddingRight:88}}/>
                <button type="button" disabled={busy} aria-label={motDePasseVisible?tr('auth.mdp.masquerLabel'):tr('auth.mdp.afficherLabel')} aria-pressed={motDePasseVisible} onClick={()=>setMotDePasseVisible(v=>!v)}>{motDePasseVisible?tr('commun.masquer'):tr('commun.afficher')}</button>
              </span>
            </div>
          )}
          {(mode==='up'||mode==='newpw') && <ul id="vrm-cx-regles" className="vrm-cx-regles" aria-label={tr('auth.regles.label')}>
            <li data-valide={pw.length>=8}>{tr('auth.regles.huit')}</li>
            <li data-valide={pw.length>0&&!/^(\d+|[a-z]+)$/i.test(pw)}>{tr('auth.regles.melange')}</li>
          </ul>}

          {mode!=='newpw' && <CaptchaConnexion etat={captcha}/>}
          {err  && <div role="alert" style={{fontSize:13,color:C.danger,background:`${C.danger}12`,border:`1px solid ${C.danger}44`,borderRadius:12,padding:'9px 11px',marginBottom:10,lineHeight:1.4}}>{err}</div>}
          {/* Le décompte vit sur le bouton qui envoie (inscription, mot de passe
              oublié, « Renvoyer » d'un compte pas confirmé) ; sinon dans la phrase. */}
          {enAttenteEmail && !(mode==='reset'&&resetEnvoye) && <div role="status" aria-live="polite" data-auth-attente={resteAttente} style={{fontSize:13,color:C.text,background:`${C.warn}12`,border:`1px solid ${C.warn}44`,borderRadius:12,padding:'9px 11px',marginBottom:10,lineHeight:1.4}}>{(mode==='up'||mode==='reset'||(mode==='in'&&needConfirm)) ? tr('auth.delai.bouton') : tr('auth.delai.secondes', { n: resteAttente })}</div>}
          {needConfirm && mode==='in' && (
            <div style={{fontSize:12,color:C.text,background:`${C.warn}10`,border:`1px solid ${C.warn}44`,borderRadius:12,padding:'10px 11px',marginBottom:10,lineHeight:1.5}}>
              {tr('auth.attente.avant')}<b>{email}</b>{tr('auth.attente.apres')}
              <div style={{display:'flex',gap:7,marginTop:8,flexWrap:'wrap'}}>
                <button type="button" data-auth-renvoyer="" disabled={busy||enAttenteEmail}
                  onClick={()=>actionConfirmation('renvoyer')}
                  style={{border:`1px solid ${C.warn}`,background:'transparent',color:C.warn,
                    borderRadius:12,padding:'9px 13px',fontSize:12,fontWeight:600,cursor:(busy||enAttenteEmail)?'default':'pointer',opacity:enAttenteEmail?0.5:1,fontFamily:'inherit'}}>
                  {enAttenteEmail ? tr('auth.renvoyerDans', { s: resteAttente }) : tr('auth.renvoyerEmail')}
                </button>
                <button type="button" data-auth-lien-connexion="" disabled={busy||enAttenteEmail}
                  onClick={()=>actionConfirmation('lien')}
                  style={{border:`1px solid ${C.border}`,background:'transparent',color:C.text,
                    borderRadius:12,padding:'9px 13px',fontSize:12,fontWeight:600,cursor:(busy||enAttenteEmail)?'default':'pointer',opacity:enAttenteEmail?0.5:1,fontFamily:'inherit'}}>
                  {tr('auth.lienConnexion')}
                </button>
              </div>
              <details className="vrm-cx-aide-confirmation">
                <summary>{tr('auth.lienAide.q')}</summary>
              <div style={{marginTop:8,fontSize:12,color:C.muted,lineHeight:1.5}}>
                {/* « il renvoie vers une adresse de test » : vrai le 5 octobre (Site URL
                    resté sur localhost:3000, mesuré dans les journaux), faux dès que
                    Julien règle Supabase. La phrase ne dit plus que ce qui reste vrai
                    dans les deux cas. */}
                {tr('auth.lienAide.1')}<i>{tr('auth.lienAide.2')}</i>{tr('auth.lienAide.3')}
                <b style={{color:C.text}}>{tr('auth.lienAide.4')}</b>{tr('auth.lienAide.5')}
              </div>
              <input aria-label={tr('auth.lienAide.label')} value={confirmLink} onChange={e=>setConfirmLink(e.target.value)} placeholder={tr('auth.lienAide.placeholder')}
                style={{width:'100%',boxSizing:'border-box',marginTop:8,border:`1px solid ${C.border}`,borderRadius:12,
                  padding:'10px 11px',fontSize:17,background:C.card,color:C.text,outline:'none',fontFamily:'inherit'}}/>
                <button type="button" disabled={busy||!confirmLink.trim()}
                  onClick={()=>actionConfirmation('confirmer')}
                  style={{border:'none',background:C.accent,color:C.onAccent||'#fff',borderRadius:12,padding:'9px 13px',
                    fontSize:12,fontWeight:600,cursor:(busy||!confirmLink.trim())?'default':'pointer',opacity:(busy||!confirmLink.trim())?0.5:1,fontFamily:'inherit'}}>
                  {tr('auth.lienAide.confirmer')}
                </button>
              </details>
            </div>
          )}
          {info && <div role="status" aria-live="polite" style={{fontSize:13,color:C.accentTexte,background:`${C.accent}12`,border:`1px solid ${C.accent}44`,borderRadius:12,padding:'9px 11px',marginBottom:10,lineHeight:1.4}}>{info}</div>}

          {/* (8 nov., Julien) « Tu as déjà un lien qui ne s'ouvre pas ? … colle le
              lien reçu » le déroutait : la page de récupération propose elle-même
              un nouvel e-mail (et la voie « coller ») quand un lien a échoué. */}
          {/* L'attente ne porte que sur ce qui ENVOIE un email (inscription, lien de
              mot de passe) — jamais sur « Se connecter ». */}
          {(()=>{ const bloque = busy || attendCaptcha || (enAttenteEmail && (mode==='up'||mode==='reset')); return (
          <button type="submit" data-auth-valider="" disabled={bloque} style={{width:'100%',border:'none',background:C.accent,color:C.onAccent||'#fff',
            borderRadius:999,padding:'13px',fontSize:15,fontWeight:600,cursor:bloque?'default':'pointer',opacity:bloque?0.6:1,fontFamily:'inherit'}}>
            {busy ? (fournisseurEnCours?tr('auth.bouton.ouverture'):mode==='up'?tr('auth.bouton.creation'):mode==='reset'?tr('auth.bouton.envoiLien'):mode==='newpw'?tr('auth.bouton.enregistrement'):tr('auth.bouton.connexion')) : (enAttenteEmail && mode==='reset' && resetEnvoye) ? tr('auth.renvoyerDans', { s: resteAttente }) : (enAttenteEmail && (mode==='up'||mode==='reset')) ? tr('auth.reessaieDans', { s: resteAttente }) : attendCaptcha ? (captcha.statut==='erreur' ? tr('auth.captcha.indisponible') : captcha.statut==='interactif' ? tr('auth.captcha.coche') : tr('auth.captcha.enCours')) : mode==='up' ? tr('auth.bouton.creer') : mode==='reset' ? (resetEnvoye ? tr('auth.bouton.renvoyer') : tr('auth.bouton.envoyerLien')) : mode==='newpw' ? tr('commun.enregistrer') : tr('auth.titre.in')}
          </button>);})()}
          {/* (15 nov., lot site-public) Google / Discord SOUS le formulaire, après un « ou » : l'e-mail et le
              mot de passe d'abord (le chemin que tout le monde a). On n'affiche QUE les fournisseurs
              réellement activés côté Supabase : un bouton qui mène à une page d'erreur JSON vaut moins
              que pas de bouton du tout. */}
          {mode!=='newpw' && mode!=='reset' && (()=>{
            const dispo = OAUTH_PROVIDERS.filter(p => providerEnabled(p.id));
            if (!dispo.length) return null;
            return (<div data-cx-fournisseurs="">
              <div style={{display:'flex',alignItems:'center',gap:10,margin:'14px 0 12px'}}>
                <span style={{flex:1,height:1,background:C.border}}/>
                <span style={{fontSize:13,color:C.muted,fontWeight:400}}>{tr('auth.ou')}</span>
                <span style={{flex:1,height:1,background:C.border}}/>
              </div>
              {dispo.map(p => (
                <button key={p.id} type="button" onClick={()=>oauth(p.id)} disabled={busy}
                  style={{width:'100%',minHeight:48,display:'flex',alignItems:'center',justifyContent:'center',gap:10,
                    border:`1px solid ${C.border}`,background:C.bg,color:C.text,borderRadius:999,padding:'12px',
                    fontSize:15,fontWeight:600,cursor:busy?'default':'pointer',marginBottom:9,fontFamily:'inherit'}}>
                  <BrandMark id={p.id}/> {fournisseurEnCours===p.id ? tr('auth.fournisseur.ouverture', { nom: p.label }) : mode==='up' ? tr('auth.fournisseur.creer', { nom: p.label }) : tr('auth.fournisseur.continuer', { nom: p.label })}
                </button>
              ))}
            </div>);
          })()}
          {/* Acceptation des conditions AVANT la création du compte (art. 1127-1
              C. civ., RGPD art. 13 : l'information est donnée au moment de la
              collecte). */}
          {mode==='up' && (
            <div style={{fontSize:12,color:C.muted,lineHeight:1.5,marginTop:10,textAlign:'center'}}>
              {tr('auth.cgu.1')}<a href="/legal/cgu.html" target="_blank" rel="noopener" style={{color:C.accentTexte}}>{tr('auth.cgu.2')}</a>{tr('auth.cgu.3')}
              <a href="/legal/confidentialite.html" target="_blank" rel="noopener" style={{color:C.accentTexte}}>{tr('auth.cgu.4')}</a>.
            </div>
          )}

          <div className="vrm-cx-liens" style={{display:mode==='newpw'?'none':'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginTop:8,flexWrap:'wrap'}}>
            {/* ⚠️ INSCRIPTIONS FERMÉES tant que la base ne sépare pas les
                vendeurs. Sinon la première personne qui crée un compte tombe
                directement dans les données de Julien : son garage, ses ventes,
                sa comptabilité. Le lien réapparaît seul après la migration. */}
            {mode!=='reset' && ((CLOISONNE || mode==='up') ? (
              <button type="button" disabled={busy} onClick={()=>changerMode(mode==='up'?'in':'up')}
                style={{border:'none',background:'transparent',color:C.accentTexte,fontSize:15,fontWeight:600,cursor:'pointer',padding:0,fontFamily:'inherit'}}>
                {mode==='up' ? tr('auth.dejaCompte') : tr('auth.creerCompte')}
              </button>
            ) : (
              <span style={{fontSize:15,color:C.muted,fontWeight:600}}>{tr('auth.inscriptionsBientot')}</span>
            ))}
            {mode==='reset' && (
              <button type="button" disabled={busy} onClick={()=>changerMode('in')}
                style={{border:'none',background:'transparent',color:C.muted,fontSize:15,fontWeight:600,cursor:'pointer',padding:0,fontFamily:'inherit'}}>
                {tr('commun.retour')}
              </button>
            )}
          </div>
        </form>
        {/* (13 nov., lot 48) VRM rempli de données INVENTÉES, sans compte (src/modeExemple.js) :
            un vrai lien, rien n'est enregistré ni envoyé ; le bandeau propose « Créer mon compte ». */}
        {/* (14 nov., lot 119) Se connecter avec l'iPhone déjà connecté : un QR, son clic, une session neuve (api/_lib/qr-connexion.js). */}
        {mode==='in' && !__lier && <details className="vrm-cx-qr" data-cx-qr="" style={{maxWidth:420,margin:'0 auto 16px',width:'100%'}}>
          <summary style={{cursor:'pointer',fontSize:15,fontWeight:600,color:C.accentTexte||C.accent,minHeight:44,display:'flex',alignItems:'center',justifyContent:'center'}}>{tr('confort.qr.ouvrir')}</summary>
          <QrOrdinateur onSession={(j)=>{ writeSession(sessionFrom(j)); }}/>
        </details>}
        {(mode==='in'||mode==='up') && !__lier && <div className="vrm-cx-exemple" data-cx-exemple="">
          <p>{tr('auth.exemple.note')}</p>
          <a href="/?exemple" data-cx-exemple-entrer="">{tr('auth.exemple')}</a>
        </div>}
        <LiensLegaux/>
        {/* (11 nov., lot traduction) La langue, avant même d'avoir un compte. */}
        <div style={{display:'flex',justifyContent:'center',color:C.muted,fontSize:12}}><ChoixLangue/></div>
        {/* ⚠️⚠️ CETTE PHRASE AFFIRMAIT UNE PROTECTION QUE `CLOISONNE` NE MESURE
            PAS. `CLOISONNE` dit seulement que la colonne `owner` EXISTE — et la
            migration autorise explicitement de s'arrêter là (« garde RLS
            désactivé, n'applique que l'étape 1 »). Dans cet état la porte
            promettait « chaque vendeur ne voit que ses propres données ·
            l'isolation est appliquée par la base » pendant que le panneau de
            Réglages disait, sur la MÊME base, « la clé publique permet encore
            de tout écrire et effacer ». Deux verdicts sur une notion (§11), et
            le faux était celui qu'une nouvelle personne lit en premier, juste
            avant de confier ses jetons Vinted.
            ⇒ On MESURE (`sondeLectureSansCompte`, la règle du panneau), et on
            ne dit rien tant qu'on ne sait pas : « pas su » ne vaut pas « oui ». */}
        <div style={{fontSize:11,color:C.muted,textAlign:'center',marginTop:16,lineHeight:1.5,minHeight:32}}>
          {!CLOISONNE
            ? <><b style={{color:C.warn}}>{tr('auth.isolation.inactive.titre')}</b><br/>{tr('auth.isolation.inactive.texte')}</>
            : ouverte === true
            ? <><b style={{color:C.warn}}>{tr('auth.isolation.ouverte.titre')}</b><br/>{tr('auth.isolation.ouverte.texte')}</>
            : ouverte === false
            ? <>{tr('auth.isolation.fermee.1')}<br/>{tr('auth.isolation.fermee.2')}</>
            : null /* en cours, ou pas su : on n'affirme rien */}
        </div>
      </div>
      </main>
    </div>
  );
}
export { AuthScreen, PorteMfa, PorteNouveauOAuth };
