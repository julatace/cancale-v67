// « Protège ton compte VRM » — UNE carte discrète dans Paramètres (12 nov., sécurité des comptes).
// (14 nov., passe design) Une carte du système : rayon 20, l'ombre posée (aucune la nuit), AUCUN cadre — le
// cadre 1 px écrit ici ne tenait que par la règle du système (styles-systeme.css §2.2).
// Montrée seulement quand la double vérification est LUE inactive (la session porte
// `totp: []`) ; « pas su » (pas de liste) ⇒ rien. Jamais au démarrage, jamais forcée
// (décision du 21 oct.) : « Plus tard » la range pour de bon sur cet appareil.
// « Activer » ouvre le panneau existant (Paramètres → Compte → Double vérification).
import React from 'react';
import { AUTH, Bouton, C, DEMANDE_REGLAGE_SOUS, Icon } from './App.jsx';

export const CLE_CARTE_MFA = 'vrm_carte_mfa_rangee';
// 'inactive' · 'active' · null (pas su) — lu sur la session, jamais deviné.
export const etatDoubleVerif = (session) => {
  const t = session && session.totp;
  if (!Array.isArray(t)) return null;
  return t.length ? 'active' : 'inactive';
};
const lireRangee = () => { try { return window.localStorage.getItem(CLE_CARTE_MFA) === '1'; } catch (_) { return false; } };

export default function CarteDoubleVerif() {
  const [rangee, setRangee] = React.useState(lireRangee);
  if (rangee || etatDoubleVerif(AUTH.session) !== 'inactive') return null;
  const ranger = () => { try { window.localStorage.setItem(CLE_CARTE_MFA, '1'); } catch (_) {} setRangee(true); };
  const activer = () => { DEMANDE_REGLAGE_SOUS.id = 'double'; try { window.dispatchEvent(new Event('vrm:reglage-sous')); } catch (_) {} };
  const etape = { display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, lineHeight: 1.45, color: C.text };
  const n = { flex: '0 0 auto', width: 20, height: 20, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: C.card2 || C.border, color: C.text };
  return (
    <section className="vrm-carte-mfa" data-carte-mfa="" aria-label="Protège ton compte VRM" style={{ margin: '0 0 12px', padding: 16, borderRadius: 'var(--d-r-carte)', border: 0, boxShadow: 'var(--d-ombre-carte)', background: C.card }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="lock" size={18}/>
        <strong style={{ fontSize: 15, color: C.text }}>Protège ton compte VRM</strong>
      </div>
      <p style={{ margin: '6px 0 10px', fontSize: 13, lineHeight: 1.45, color: C.muted }}>Active la double vérification : 2 minutes.</p>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <li style={etape}><span style={n}>1</span><span>Installe une app de codes (Google Authenticator, Mots de passe d’Apple…).</span></li>
        <li style={etape}><span style={n}>2</span><span>Touche « Activer », puis scanne le code avec l’app.</span></li>
        <li style={etape}><span style={n}>3</span><span>Tape le code à 6 chiffres affiché.</span></li>
      </ol>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Bouton variante="secondaire" data-carte-mfa-activer="" onClick={activer} style={{ minHeight: 44 }}>Activer</Bouton>
        <Bouton variante="discret" data-carte-mfa-plus-tard="" onClick={ranger} style={{ minHeight: 44 }}>Plus tard</Bouton>
      </div>
    </section>
  );
}
