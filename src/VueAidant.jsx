// ════════════════════════════════════════════════════════════════════════════
//  LA PAGE DE L'AIDANT — le stock en lecture seule (16 nov., lot partage-aidant)
//  `https://vrm.center/a/<jeton>` → `/?aidant=<jeton>` : cette page, SANS l'app, sans
//  session, sans aucune écriture. Elle lit `/api/compte?mode=aidant&j=` et montre ce que
//  le serveur a gardé (api/_lib/aidant-lien.js `vueAidant` : N°, lieu, titre, photo —
//  jamais un prix, un pseudo, une adresse). Expiré ou révoqué (410), inconnu (404) ⇒
//  « Ce lien n'est plus valable » ; base injoignable ⇒ « Réessayer » (jamais un stock vide).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, ajouterSourceApp, date as dateLoc } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import frAidant from './i18n/langues/fr/aidant.js';
import './vue-aidant.css';

ajouterSourceApp(frAidant);
export const jetonDeLAdresse = () => { try { const j = new URLSearchParams(window.location.search).get('aidant') || ''; return /^[A-Za-z0-9_.-]{40,80}$/.test(j) ? j : ''; } catch (_) { return ''; } };
const sansAccent = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function VueAidant() {
  useLangue();
  const [R, setR] = React.useState(undefined);
  const [essai, setEssai] = React.useState(0);
  const [q, setQ] = React.useState('');
  React.useEffect(() => {
    try { const m = document.createElement('meta'); m.name = 'referrer'; m.content = 'no-referrer'; document.head.appendChild(m); const r = document.createElement('meta'); r.name = 'robots'; r.content = 'noindex'; document.head.appendChild(r); } catch (_) {}
    const j = jetonDeLAdresse();
    if (!j) { setR({ etat: 'lien' }); return undefined; }
    let mort = false;
    setR(undefined);
    fetch(`/api/compte?mode=aidant&j=${encodeURIComponent(j)}`, { cache: 'no-store', credentials: 'omit' })
      .then(async (r) => {
        const b = await r.json().catch(() => null);
        if (mort) return;
        setR(r.status === 404 || r.status === 410 ? { etat: 'lien' } : r.status === 429 ? { etat: 'trop' } : r.ok && b && b.vue && Array.isArray(b.vue.items) ? { etat: 'lu', ...b } : { etat: 'panne' });
      })
      .catch(() => { if (!mort) setR({ etat: 'panne' }); });
    return () => { mort = true; };
  }, [essai]);
  if (R === undefined) return <main className="vrm-aid" data-vue-aidant="encours"><p className="vrm-aid-note" role="status">{tr('aidant.page.lecture')}</p></main>;
  if (R.etat !== 'lu') {
    return (
      <main className="vrm-aid" data-vue-aidant={R.etat}>
        <h1>{tr('aidant.page.titre')}</h1>
        <p className="vrm-aid-note">{R.etat === 'lien' ? tr('aidant.page.lien') : R.etat === 'trop' ? tr('aidant.page.trop') : tr('aidant.page.panne')}</p>
        {R.etat !== 'lien' ? <button type="button" className="vrm-aid-bouton" data-aidant-reessayer="" onClick={() => setEssai((x) => x + 1)}>{tr('aidant.page.reessayer')}</button> : null}
      </main>
    );
  }
  const items = R.vue.items;
  const qn = sansAccent(q.trim());
  const vus = qn ? items.filter((it) => sansAccent(`${it.num} ${it.titre} ${it.lieu}`).includes(qn)) : items;
  return (
    <main className="vrm-aid" data-vue-aidant="lu" data-aidant-n={items.length}>
      <h1>{tr('aidant.page.titre')}</h1>
      <p className="vrm-aid-note" data-aidant-exp={R.exp || ''}>{tr('aidant.page.n', { n: items.length })} · {tr('aidant.page.note', { date: R.exp ? dateLoc(new Date(R.exp), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—' })}</p>
      {items.length ? <input className="vrm-aid-champ" type="search" data-aidant-cherche="" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('aidant.page.cherche')} aria-label={tr('aidant.page.cherche')}/> : <p className="vrm-aid-note">{tr('aidant.page.rien')}</p>}
      <ul className="vrm-aid-liste">
        {vus.slice(0, 500).map((it, i) => (
          <li key={it.num + '|' + it.lieu + '|' + i} className="vrm-aid-ligne" data-aidant-num={it.num}>
            <span className="vrm-aid-photo">{it.photo ? <img src={it.photo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"/> : null}</span>
            <span className="vrm-aid-textes"><b className="vrm-aid-num">N°{it.num}</b><span className="vrm-aid-titre">{it.titre}</span><span className="vrm-aid-lieu" data-aidant-lieu="">{it.lieu}</span></span>
          </li>
        ))}
      </ul>
      {qn && !vus.length ? <p className="vrm-aid-note">{tr('aidant.page.aucun')}</p> : null}
    </main>
  );
}
