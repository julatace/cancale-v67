// « Ce compte Vinted est déjà relié à un autre compte VRM » — la carte (9 nov.).
// La règle et les mots : src/vintedDejaRelie.js. Ici : la lecture (injectée,
// `lire()` rend { litiges, pseudos } ou `null` = pas su ⇒ rien n'est dit) et la
// forme (classes existantes : `vrm-cl-alerte`, `vrm-b`, `vrm-lien-action`).
import React from 'react';
import { litigesAAfficher, texteDejaRelie, sujetSupport, CLE_MASQUES } from './vintedDejaRelie.js';

const lireMasques = () => { try { const o = JSON.parse(localStorage.getItem(CLE_MASQUES) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; } };

export function AlerteDejaRelie({ lire, comptes, contact = '', onChangerCompte, ou = '' }) {
  const [lu, setLu] = React.useState(undefined);
  const [masques, setMasques] = React.useState(lireMasques);
  React.useEffect(() => {
    let mort = false;
    Promise.resolve().then(() => lire()).then((x) => { if (!mort) setLu(x || null); }).catch(() => { if (!mort) setLu(null); });
    return () => { mort = true; };
  }, [lire]);
  if (!lu || !Array.isArray(lu.litiges)) return null;
  const montrer = litigesAAfficher(lu.litiges, comptes, masques);
  if (!montrer.length) return null;
  const masquer = (l) => { const m = { ...lireMasques(), [l.vid]: l.at }; try { localStorage.setItem(CLE_MASQUES, JSON.stringify(m)); } catch (_) {} setMasques(m); };
  return (
    <div data-deja-relie-liste={montrer.length} data-deja-relie-ou={ou || undefined}>
      {montrer.map((l) => {
        const t = texteDejaRelie(l, lu.pseudos && lu.pseudos[l.vid]);
        return (
          <div key={l.vid} className="vrm-cl-alerte" role="status" data-deja-relie={l.vid} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <span>{t.titre}</span>
            <span style={{ fontWeight: 400 }}>{t.phrase}</span>
            <span style={{ fontWeight: 400 }}>{t.geste}</span>
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {contact
                ? <a className="vrm-b vrm-b-secondaire" data-deja-relie-support="" href={`mailto:${contact}?subject=${encodeURIComponent(sujetSupport(l))}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', minHeight: 44 }}>Écrire au support</a>
                : <span style={{ fontWeight: 400 }}>Adresse du support à venir.</span>}
              {onChangerCompte && <button type="button" className="vrm-b vrm-b-discret" data-deja-relie-changer="" onClick={onChangerCompte} style={{ minHeight: 44 }}>Changer de compte VRM</button>}
              <button type="button" className="vrm-lien-action" data-deja-relie-masquer="" onClick={() => masquer(l)} style={{ minHeight: 44 }}>Masquer</button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
