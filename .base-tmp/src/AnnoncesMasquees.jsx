// ═══════════════════════════════════════════════════════════════════════════
// ANNONCES · MASQUÉES PAR VINTED — par compte, avec le lien pour corriger (4 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// La règle : src/annoncesMasquees.js. Une masquée reste parmi les paires
// présentes (`<masquees-regle>`), jamais « en ligne ». Lecture de plus de 24 h ⇒
// « à confirmer ».
import React from 'react';

const ilYa = (t, maintenant = Date.now()) => { if (!t) return ''; const m = Math.max(0, Math.round((maintenant - t) / 60000)); return m < 60 ? `il y a ${m} min` : m < 48 * 60 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
const eur = (v) => (v == null ? '' : v.toLocaleString('fr-FR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €');

export default function AnnoncesMasquees({ res, Photo }) {
  if (!res || res.etat === 'encours') return <section className="vrm-qd vrm-mq" data-masquees-vue="encours"><div className="vrm-qd-vide">…</div></section>;
  if (res.etat === 'passu') return <section className="vrm-qd vrm-mq" data-masquees-vue="passu"><div className="vrm-qd-vide">—</div></section>;
  return (
    <section className="vrm-qd vrm-mq" data-masquees-vue="lu" data-masquees-n={res.n} data-masquees-a-confirmer={res.nAConfirmer}>
      <div className="vrm-qd-tete"><h2 className="vrm-display vrm-qd-titre">Masquées par Vinted<span className="vrm-qd-n">{res.n}</span></h2></div>
      {!res.n ? <div className="vrm-qd-vide" data-masquees-vide="">Aucune.</div> : res.groupes.map((g) => (
        <div key={g.uid} className="vrm-mq-groupe" data-masquees-compte={g.uid} data-masquees-compte-n={g.items.length}>
          <div className="vrm-mq-compte"><b>{g.nom}</b><span className={'vrm-mq-quand' + (g.aConfirmer ? ' is-vieux' : '')}>{g.aConfirmer ? `à confirmer${g.lu ? ' · ' + ilYa(g.lu) : ''}` : ilYa(g.lu)}</span></div>
          <ul className="vrm-qd-liste">
            {g.items.map((a) => (
              <li key={a.id} className="vrm-qd-ligne" data-masquee={a.id} data-masquee-a-confirmer={a.aConfirmer ? '1' : undefined}>
                {a.photo && Photo ? <Photo src={a.photo} className="vrm-qd-photo" alt=""/> : <span className="vrm-qd-photo" aria-hidden="true"/>}
                <span className="vrm-qd-centre">
                  <span className="vrm-qd-nom">{a.num ? <span className="vrm-qd-num">N°{a.num}</span> : null}{a.titre || 'Sans titre'}</span>
                  {a.prix != null ? <span className="vrm-qd-sous">{eur(a.prix)}</span> : null}
                </span>
                {a.lien ? <a className="vrm-qd-agir vrm-mq-lien" data-masquee-lien={a.id} href={a.lien} target="_blank" rel="noreferrer" aria-label={`Corriger ${a.titre || 'l’annonce'} sur Vinted`}>Corriger ↗</a> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
