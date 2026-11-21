// ══════════════════════════════════════════════════════════════════════════════
//  « ACHAT SAISI DEUX FOIS » — la FORME seulement (10 nov., lot BH)
// ══════════════════════════════════════════════════════════════════════════════
// La règle (identité seulement, jamais la ressemblance) est src/achatsDoubles.js ;
// l'écran Achats (App.jsx) passe les groupes et le geste. Pour chaque groupe : les
// fiches CÔTE À CÔTE (photo, nom, d'où, prix, date) et sous chacune « Garder
// celle-ci » — l'autre est masquée (geste annulable 5 s, rien supprimé). Ambre = le
// geste à faire (§7). En bas, les achats hors plateforme déjà masqués comme double,
// chacun avec « Réafficher ».
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import './styles-achats-doubles.css';

const eur = (n) => (n == null || !isFinite(n) ? '—' : `${Number(n).toFixed(2).replace('.', ',')} €`);
const jour = (ms) => (Number.isFinite(ms) ? new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
// La référence montrée (la même pour tout le groupe) : coupée au milieu si elle est longue.
const refCourte = (r) => { const s = String(r || ''); return s.length > 14 ? `${s.slice(0, 5)}…${s.slice(-5)}` : s; };

export function AchatsEnDouble({ groupes = [], masques = [], onGarder, onReafficher, photo = null, prixAchat, compte, quand, Photo = null, Icon = null }) {
  const n = Array.isArray(groupes) ? groupes.length : 0;
  const m = Array.isArray(masques) ? masques.length : 0;
  if (!n && !m) return null;
  return (
    <section className="vrm-doubles" data-achats-doubles={n} aria-label="Achats saisis deux fois">
      {n > 0 && <header className="vrm-doubles-tete">
        <span className="vrm-doubles-pastille" aria-hidden="true">{n}</span>
        <span className="vrm-doubles-titre">{n > 1 ? 'Achats saisis deux fois' : 'Achat saisi deux fois'}</span>
      </header>}
      {(groupes || []).map((g) => (
        <div key={g.ref} className="vrm-doubles-groupe" data-double-ref={g.ref} data-double-n={g.achats.length}>
          <p className="vrm-doubles-ref">Même n° <b>{refCourte(g.ref)}</b> · garde le bon</p>
          <div className="vrm-doubles-paire">
            {g.achats.map((a) => {
              const src = photo ? photo(a) : '';
              const t = quand ? quand(a) : null;
              const cpt = compte ? compte(a) : '';
              const ou = a.source === 'vinted' ? (cpt ? `Vinted · ${cpt}` : 'Vinted') : (String((a.achat && a.achat.source) || '').trim() || 'Hors plateforme');
              return (
                <article key={a.id} className="vrm-doubles-fiche" data-double-achat={a.id} data-double-source={a.source}>
                  <span className="vrm-doubles-photo">
                    {src && Photo ? <Photo src={src} alt="" loading="lazy" decoding="async"/> : (Icon ? <Icon name={a.source === 'vinted' ? 'bag' : 'tag'} size={22}/> : null)}
                  </span>
                  <span className="vrm-doubles-nom">{(a.achat && a.achat.title) || 'Achat'}</span>
                  <span className="vrm-doubles-ou">{ou}</span>
                  <span className="vrm-doubles-prix" data-double-prix={prixAchat ? String(prixAchat(a) ?? '') : ''}>{eur(prixAchat ? prixAchat(a) : null)}</span>
                  {t ? <span className="vrm-doubles-date">{jour(t)}</span> : <span className="vrm-doubles-date">—</span>}
                  <button type="button" className="vrm-doubles-garder" data-double-garder={a.id} onClick={() => onGarder && onGarder(g, a.id)}>Garder celle-ci</button>
                </article>
              );
            })}
          </div>
        </div>
      ))}
      {m > 0 && <details className="vrm-doubles-masques" data-doubles-masques={m}>
        <summary>{m > 1 ? `${m} achats masqués comme double` : '1 achat masqué comme double'}</summary>
        {masques.map((b) => (
          <div key={b.id} className="vrm-doubles-masque" data-double-masque={b.id}>
            <span className="vrm-doubles-masque-nom">{b.title || 'Achat'}</span>
            <button type="button" className="vrm-lien-action" data-double-reafficher={b.id} onClick={() => onReafficher && onReafficher(b.id)}>Réafficher</button>
          </div>
        ))}
      </details>}
    </section>
  );
}
