// ── « VOIR L'E-MAIL » D'UN COLIS À RETIRER (12 nov.) ─────────────────────────
// La ligne de suivi garde l'id de la ligne `email_reception_*` de l'e-mail qui
// l'a écrite (`emailRecu`, api/_lib/accuse-email.js). Sans lui (lignes rangées
// avant le 12 nov.) : rien n'est affiché — pas su, jamais un e-mail deviné.
// Le texte se lit sur le clic, un e-mail à la fois, par la route du journal
// (`/api/email-rattacher?mode=journal&texte=`, filtrée par SON owner) ; il
// s'affiche en TEXTE (React l'échappe) : aucun HTML actif.
import React, { useEffect, useState } from 'react';
import { requeteJsonBornee } from './requeteJsonBornee.js';

export const ID_EMAIL_RECU = /^email_reception_[0-9a-f]{16,64}$/;

function TexteEmailColis({ id, headers }) {
  const [tentative, setTentative] = useState(0);
  const [t, setT] = useState(undefined); // undefined en cours · null pas su · {texte}
  useEffect(() => {
    let vivant = true;
    setT(undefined);
    (async () => {
      try {
        const r = await requeteJsonBornee(`/api/email-rattacher?mode=journal&texte=${encodeURIComponent(id)}`, { headers: headers ? headers() : {}, cache: 'no-store' });
        if (!vivant) return;
        setT(r.ok && r.json && r.json.ok === true && r.json.id === id ? { texte: typeof r.json.texte === 'string' ? r.json.texte : null } : null);
      } catch (_) { if (vivant) setT(null); }
    })();
    return () => { vivant = false; };
  }, [id, headers, tentative]);
  if (t === undefined) return <p className="vrm-journal-texte-etat" role="status" data-colis-email-texte="en-cours">Lecture de l’e-mail…</p>;
  if (t === null) return <p className="vrm-journal-texte-etat" role="alert" data-colis-email-texte="pas-su">L’e-mail n’a pas pu être chargé. <button type="button" className="vrm-lien-action" style={LIEN} onClick={() => setTentative((n) => n + 1)}>Réessayer</button></p>;
  if (!t.texte) return <p className="vrm-journal-texte-etat" data-colis-email-texte="absent">Texte non gardé. L’original reste dans ta messagerie.</p>;
  return <pre className="vrm-journal-texte" data-colis-email-texte="lu">{t.texte}</pre>;
}

// Un lien d'action (une forme, §7) : pas de cadre, 44 px au doigt, sur sa propre ligne.
const LIEN = { display: 'inline-block', minHeight: 44, border: 0, background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600, cursor: 'pointer' };

export default function VoirEmailColis({ id, headers }) {
  const [ouvert, setOuvert] = useState(false);
  if (!ID_EMAIL_RECU.test(String(id || ''))) return null;
  return (
    <span className="vrm-colis-email" data-colis-email={id} style={{ display: 'block' }}>
      <button type="button" className="vrm-lien-action" aria-expanded={ouvert} data-colis-email-voir="" style={LIEN} onClick={() => setOuvert((v) => !v)}>{ouvert ? 'Masquer l’e-mail' : 'Voir l’e-mail'}</button>
      {ouvert ? <TexteEmailColis id={id} headers={headers}/> : null}
    </span>
  );
}
