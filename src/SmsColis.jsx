// ══════════════════════════════════════════════════════════════════════════════
// « RECEVOIR LES SMS MONDIAL RELAY » — Réglages → Mes e-mails (6 novembre ; avec les e-mails le 10 nov.)
// ══════════════════════════════════════════════════════════════════════════════
// Les colis en casier (« LOCKER 24/7 ») que Mondial Relay n'annonce que par SMS.
// Le jeton (afficher / copier / régénérer / couper), l'adresse exacte, le
// pas-à-pas illustré de l'automatisation Raccourcis, et « Tester » : un SMS
// d'exemple INVENTÉ envoyé en mode essai (rien n'est rangé). La règle :
// src/smsColis.js ; le serveur : api/_lib/sms-mondialrelay.js.
import React from 'react';
import './design/sms-colis.css';
import { BoutonBase as Bouton } from './composants/Bouton.jsx';
import { ETAPES_RACCOURCI, EXPEDITEURS_SMS, SMS_EXEMPLE, etatJetonSms, nouveauJetonSms, urlSms, texteEssai, JETON_COUPE } from './smsColis.js';

const DessinOnglet = () => (
  <svg viewBox="0 0 120 84" aria-hidden="true" focusable="false">
    <rect className="sc-ecran" x="20" y="4" width="80" height="80" rx="12" />
    <rect className="sc-ligne" x="30" y="16" width="40" height="7" rx="3.5" />
    <circle className="sc-accent" cx="88" cy="19" r="6" />
    <path className="sc-blanc" d="M88 16v6M85 19h6" />
    <rect className="sc-ligne sc-pale" x="30" y="32" width="60" height="10" rx="5" />
    <path className="sc-barre" d="M20 64h80v8a12 12 0 0 1-12 12H32a12 12 0 0 1-12-12z" />
    <rect className="sc-ligne sc-pale" x="32" y="70" width="14" height="5" rx="2.5" />
    <rect className="sc-accent" x="53" y="70" width="14" height="5" rx="2.5" />
    <rect className="sc-ligne sc-pale" x="74" y="70" width="14" height="5" rx="2.5" />
  </svg>
);
const DessinMessage = () => (
  <svg viewBox="0 0 120 84" aria-hidden="true" focusable="false">
    <rect className="sc-ecran" x="20" y="4" width="80" height="80" rx="12" />
    <rect className="sc-ligne sc-pale" x="28" y="14" width="64" height="10" rx="5" />
    <rect className="sc-choix" x="26" y="30" width="68" height="16" rx="6" />
    <path className="sc-trait-accent" d="M33 35h10v7l-3-2h-7z" />
    <rect className="sc-ligne" x="48" y="35" width="38" height="6" rx="3" />
    <rect className="sc-ligne sc-pale" x="28" y="52" width="64" height="10" rx="5" />
    <rect className="sc-ligne sc-pale" x="28" y="68" width="64" height="10" rx="5" />
  </svg>
);
const DessinImmediat = () => (
  <svg viewBox="0 0 120 84" aria-hidden="true" focusable="false">
    <rect className="sc-ecran" x="20" y="4" width="80" height="80" rx="12" />
    <rect className="sc-choix" x="26" y="16" width="68" height="16" rx="6" />
    <circle className="sc-accent" cx="35" cy="24" r="4.5" />
    <path className="sc-blanc" d="M33 24l1.5 1.5 3-3" />
    <rect className="sc-ligne" x="44" y="21" width="42" height="6" rx="3" />
    <rect className="sc-ligne sc-pale" x="28" y="40" width="64" height="12" rx="6" />
    <circle className="sc-rond" cx="35" cy="46" r="4" />
    <rect className="sc-ligne sc-pale" x="28" y="62" width="64" height="12" rx="6" />
  </svg>
);
const DessinUrl = () => (
  <svg viewBox="0 0 120 84" aria-hidden="true" focusable="false">
    <rect className="sc-ecran" x="20" y="4" width="80" height="80" rx="12" />
    <rect className="sc-choix" x="26" y="16" width="68" height="28" rx="7" />
    <rect className="sc-ligne" x="32" y="22" width="44" height="5" rx="2.5" />
    <rect className="sc-accent" x="32" y="32" width="54" height="6" rx="3" />
    <path className="sc-trait" d="M87 22l3 3-3 3" />
    <rect className="sc-ligne sc-pale" x="28" y="54" width="64" height="10" rx="5" />
  </svg>
);
const DessinJson = () => (
  <svg viewBox="0 0 120 84" aria-hidden="true" focusable="false">
    <rect className="sc-ecran" x="20" y="4" width="80" height="80" rx="12" />
    <rect className="sc-ligne sc-pale" x="28" y="12" width="26" height="6" rx="3" />
    <rect className="sc-accent" x="66" y="12" width="26" height="6" rx="3" />
    <rect className="sc-ligne sc-pale" x="28" y="26" width="26" height="6" rx="3" />
    <rect className="sc-accent" x="66" y="26" width="26" height="6" rx="3" />
    <rect className="sc-choix" x="26" y="42" width="68" height="16" rx="6" />
    <rect className="sc-ligne" x="32" y="47" width="18" height="6" rx="3" />
    <rect className="sc-accent" x="56" y="46" width="32" height="8" rx="4" />
    <rect className="sc-ligne sc-pale" x="28" y="66" width="64" height="8" rx="4" />
  </svg>
);
const DESSINS = { onglet: DessinOnglet, message: DessinMessage, immediat: DessinImmediat, url: DessinUrl, json: DessinJson };

// jeton : la valeur de `vrm_sms_token` · onJeton(v) : l'enregistrer (synchronisé) ·
// toast(msg, type) · origine : l'adresse de VRM (banc) · envoyer : fetch (banc).
export default function SmsColisSetting({ jeton = '', onJeton, toast = () => {}, origine, envoyer }) {
  const etat = etatJetonSms(jeton);
  const url = urlSms(jeton, origine);
  const [voir, setVoir] = React.useState(false);
  const [essai, setEssai] = React.useState(null);     // null · { busy } · { ok, t }
  const [confirme, setConfirme] = React.useState('');  // '' · 'regenerer' · 'couper'
  const creer = () => { try { onJeton && onJeton(nouveauJetonSms()); setEssai(null); setConfirme(''); toast('Jeton créé'); } catch (_) { toast('Création impossible sur cet appareil', 'error'); } };
  const couper = () => { onJeton && onJeton(JETON_COUPE); setEssai(null); setConfirme(''); setVoir(false); toast('Réception des SMS coupée'); };
  const copier = (v, quoi) => { try { navigator.clipboard.writeText(v); toast(`✓ ${quoi} copié${quoi === 'Adresse' ? 'e' : ''}`); } catch (_) { toast('Copie impossible', 'error'); } };
  const tester = async () => {
    if (!url) return;
    setEssai({ busy: true });
    try {
      const f = envoyer || ((u, o) => fetch(u, o));
      const r = await f(urlSms(jeton, ''), {   // même origine que l'app (la CSP n'a rien à autoriser)
       method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texte: SMS_EXEMPLE, expediteur: 'MRELAY', date: new Date().toISOString(), essai: true }) });
      let j = null; try { j = await r.json(); } catch (_) {}
      setEssai(texteEssai(r.status, j));
    } catch (_) { setEssai(texteEssai(0, null)); }
  };
  const masque = jeton ? `${String(jeton).slice(0, 4)}${'•'.repeat(12)}${String(jeton).slice(-4)}` : '';
  // (10 nov., Julien : « Pour les SMS Mondial Relay, fais quelque chose de plus clair et mets ça avec
  // les e-mails ») UNE phrase, le bouton qui copie, les étapes en liste courte numérotée ; le détail
  // (dessins, mots exacts de chaque écran, expéditeurs lus) replié, à la demande. Rien de retiré.
  return (
    <div className="vrm-sc" data-sms-colis={etat}>
      <p className="vrm-sc-intro">
        Tes <b>SMS de colis</b> (Mondial Relay en casier, Vinted Go, Pickup) arrivent dans VRM comme tes e-mails : une automatisation de ton iPhone les transfère, le colis apparaît dans Colis → À retirer avec son code.
      </p>
      {etat !== 'actif' ? (
        <div className="vrm-sc-bloc">
          <div className="vrm-sc-etat" data-sms-etat={etat}>{etat === 'coupe' ? 'Réception coupée : aucun SMS n’est accepté.' : 'Pas encore activé.'}</div>
          <Bouton variante="primaire" data-sms-creer="" onClick={creer}>{etat === 'coupe' ? 'Créer une nouvelle adresse' : 'Créer mon adresse SMS'}</Bouton>
        </div>
      ) : (
        <div className="vrm-sc-bloc">
          <div className="vrm-sc-gestes">
            <Bouton variante="primaire" data-sms-copier-url="" onClick={() => copier(url, 'Adresse')}>Copier l’adresse</Bouton>
            <Bouton variante="secondaire" data-sms-tester="" occupe={!!(essai && essai.busy)} disabled={!!(essai && essai.busy)} onClick={tester}>{essai && essai.busy ? 'Essai…' : 'Tester'}</Bouton>
          </div>
          <div className="vrm-sc-code" data-sms-url="">{voir ? url : url.replace(jeton, masque)}</div>
          {essai && !essai.busy ? <div className={'vrm-sc-essai' + (essai.ok ? '' : ' is-ambre')} role="status" data-sms-essai={essai.ok ? 'ok' : 'ko'}>{essai.t}</div> : null}
          <div className="vrm-sc-gestes vrm-sc-jeton" data-sms-jeton={voir ? 'visible' : 'masque'}>
            <Bouton variante="discret" data-sms-voir="" onClick={() => setVoir((v) => !v)}>{voir ? 'Masquer' : 'Afficher'}</Bouton>
            <Bouton variante="discret" data-sms-copier-jeton="" onClick={() => copier(jeton, 'Jeton')}>Copier le jeton</Bouton>
            <Bouton variante="discret" data-sms-regenerer="" onClick={() => setConfirme('regenerer')}>Régénérer</Bouton>
            <Bouton variante="discret" data-sms-couper="" onClick={() => setConfirme('couper')}>Couper</Bouton>
          </div>
          {confirme ? (
            <div className="vrm-sc-confirme" role="alertdialog" aria-label="Confirmer" data-sms-confirme={confirme}>
              <span>{confirme === 'regenerer' ? 'L’ancienne adresse ne marchera plus : il faudra recoller la nouvelle dans Raccourcis.' : 'Plus aucun SMS ne sera accepté tant que tu ne crées pas de nouvelle adresse.'}</span>
              <div className="vrm-sc-gestes">
                <Bouton variante="danger" data-sms-confirmer="" onClick={confirme === 'regenerer' ? creer : couper}>{confirme === 'regenerer' ? 'Régénérer' : 'Couper'}</Bouton>
                <Bouton variante="discret" onClick={() => setConfirme('')}>Annuler</Bouton>
              </div>
            </div>
          ) : null}
          <div className="vrm-sc-sous">L’adresse contient ton jeton : elle suffit pour ranger des colis chez toi, ne la partage pas. « Tester » envoie un SMS d’exemple inventé : rien n’est rangé.</div>
        </div>
      )}
      <ol className="vrm-sc-court" aria-label="Transférer les SMS en 5 étapes" data-sms-court="">
        {ETAPES_RACCOURCI.map((e) => <li key={e.cle} data-sms-etape={e.cle}>{e.court || e.titre}</li>)}
      </ol>
      <details className="vrm-sc-detail" data-sms-detail="">
        <summary>Voir chaque écran en détail</summary>
        <ol className="vrm-sc-etapes" aria-label="Créer l’automatisation Raccourcis">
          {ETAPES_RACCOURCI.map((e, i) => {
            const D = DESSINS[e.dessin];
            return (
              <li key={e.cle} className="vrm-sc-etape" data-sms-etape-detail={e.cle}>
                <div className="vrm-sc-dessin">{D ? <D /> : null}</div>
                <div className="vrm-sc-texte">
                  <span className="vrm-sc-n" aria-hidden="true">{i + 1}</span>
                  <b className="vrm-sc-etape-titre">{e.titre}</b>
                  <ul className="vrm-sc-mots">{e.mots.map((m) => <li key={m}>{m}</li>)}</ul>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="vrm-sc-sous">Il faut iOS 17 ou plus récent. Si le colis arrive sans texte, touche la variable « Entrée du raccourci » dans le champ et choisis « Contenu ». Les codes de vérification ne sont jamais rangés ; un SMS d’un autre expéditeur est ignoré.</p>
        <ul className="vrm-sc-mots" data-sms-expediteurs="">{EXPEDITEURS_SMS.map((x) => <li key={x.nom} data-sms-expediteur={x.nom}><b>{x.nom}</b> — {x.quoi}</li>)}</ul>
      </details>
    </div>
  );
}
