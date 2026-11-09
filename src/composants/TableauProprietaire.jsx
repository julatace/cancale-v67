// ════════════════════════════════════════════════════════════════════════════
//  « TON ENTREPRISE » — LE TABLEAU DE BORD DU PROPRIÉTAIRE (9 nov. 2026)
// ════════════════════════════════════════════════════════════════════════════
// Réglages → Aide (entrée visible pour le PROPRIÉTAIRE de l'installation seul ;
// la route refuse tout autre compte, 403) : `/api/compte?mode=pilotage`
// (api/_lib/pilotage.js). Des comptes et des totaux — jamais un vendeur nommé.
// Trois états partout (§5) : en cours · pas su (« — » et la raison) · lu.
// Une seule couleur d'accent (la courbe) ; ambre seulement quand il y a quelque
// chose à rattraper (incident ouvert, impayé, écran tombé). Les courbes : une
// série chacune, le titre la nomme, survol/doigt/flèches donnent la valeur du
// jour, et « Voir les chiffres » donne le tableau (lecteur d'écran, impression).
import React from 'react';

const S = {
  muet: { color: 'var(--vrm-muted)', fontSize: 13, lineHeight: 1.45, margin: 0 },
  titre: { fontSize: 17, fontWeight: 600, margin: '24px 0 8px', color: 'var(--vrm-ink)' },
  carte: { background: 'var(--vrm-surface)', borderRadius: 14, boxShadow: '0 0 0 .5px var(--vrm-line)', padding: '14px 16px', minWidth: 0 },
  grille: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 },
  chiffre: { fontSize: 28, fontWeight: 600, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: 'var(--vrm-ink)', margin: '6px 0 2px', overflowWrap: 'anywhere' },
  lib: { fontSize: 13, color: 'var(--vrm-muted)', margin: 0 },
};
const RAISONS = {
  'comptes-illisibles': 'la liste des comptes n’a pas répondu',
  'signes-illisibles': 'les signes de vie n’ont pas été lus',
  base: 'la base n’a pas répondu',
  'stripe-muet': 'Stripe n’a pas répondu',
  'sondes-absentes': 'les sondes de /statut n’ont encore rien rangé',
  concurrence: 'écrit en même temps ailleurs',
};
const NOMS_COMPOSANTS = { base: 'la base', connexion: 'la connexion', emails: 'la réception des e-mails', envoi: 'l’envoi des e-mails', notifications: 'les notifications', extension: 'l’extension' };
const nombre = (n) => new Intl.NumberFormat('fr-FR').format(n);
const euros = (c) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);
const jourCourt = (j) => { try { return new Date(j + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', ''); } catch (_) { return j; } };
const jourLong = (j) => { try { return new Date(j + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (_) { return j; } };
const dateHeure = (iso) => { try { return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
const pasSu = (raisons, cle) => `Pas su : ${RAISONS[(raisons || {})[cle]] || 'pas lu'}.`;

function Tuile({ cle, lib, valeur, sous, alerte = false }) {
  const inconnu = valeur == null;
  return (
    <div style={S.carte} data-pilotage-tuile={cle} data-valeur={inconnu ? '' : String(valeur)}>
      <p style={S.lib}>{lib}</p>
      <p style={{ ...S.chiffre, color: inconnu ? 'var(--vrm-muted)' : 'var(--vrm-ink)' }}>{inconnu ? '—' : valeur}</p>
      {sous ? <p style={{ ...S.muet, color: alerte ? 'var(--vrm-warn)' : 'var(--vrm-muted)' }}>{alerte ? <span aria-hidden="true">● </span> : null}{sous}</p> : null}
    </div>
  );
}

// Une courbe, une série. `points` : [{ jour, n }] ; `format(n)` pour la valeur.
export function Courbe({ cle, titre, points, format = nombre, vide }) {
  const n = Array.isArray(points) ? points.length : 0;
  const [i, setI] = React.useState(null);
  const ref = React.useRef(null);
  const W = 300, H = 96, PAD = 4;
  if (n < 2) {
    return (
      <div style={S.carte} data-pilotage-courbe={cle} data-points={n}>
        <p style={{ ...S.lib, color: 'var(--vrm-ink)', fontWeight: 600 }}>{titre}</p>
        <p style={{ ...S.muet, marginTop: 6 }}>{vide}</p>
      </div>
    );
  }
  const vals = points.map((p) => p.n);
  const max = Math.max(1, ...vals);
  const x = (k) => PAD + (k * (W - 2 * PAD)) / (n - 1);
  const y = (v) => H - PAD - (v / max) * (H - 2 * PAD);
  const trace = points.map((p, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(p.n).toFixed(1)}`).join(' ');
  const choisi = i == null ? n - 1 : i;
  const p = points[choisi];
  const sous = (e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const k = Math.round(((e.clientX - r.left) / Math.max(1, r.width)) * (n - 1));
    setI(Math.max(0, Math.min(n - 1, k)));
  };
  const clavier = (e) => {
    const k = e.key === 'ArrowLeft' ? choisi - 1 : e.key === 'ArrowRight' ? choisi + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
    if (k == null) return;
    e.preventDefault(); setI(Math.max(0, Math.min(n - 1, k)));
  };
  return (
    <div style={S.carte} data-pilotage-courbe={cle} data-points={n} data-choisi={choisi}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <p style={{ ...S.lib, color: 'var(--vrm-ink)', fontWeight: 600 }}>{titre}</p>
        <p style={{ ...S.muet, fontVariantNumeric: 'tabular-nums' }} aria-live="polite" data-pilotage-courbe-valeur={p.n}>
          <b style={{ color: 'var(--vrm-ink)', fontWeight: 600 }}>{format(p.n)}</b> · {jourCourt(p.jour)}
        </p>
      </div>
      <div ref={ref} role="img" tabIndex={0} aria-label={`${titre} : ${format(points[n - 1].n)} le ${jourLong(points[n - 1].jour)}. Flèches gauche et droite pour parcourir.`}
        onPointerMove={sous} onPointerDown={sous} onPointerLeave={() => setI(null)} onKeyDown={clavier}
        style={{ position: 'relative', marginTop: 8, touchAction: 'pan-y', outlineOffset: 2, cursor: 'crosshair' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
          {[0, 0.5, 1].map((f) => <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--vrm-line)" strokeWidth={1} vectorEffect="non-scaling-stroke"/>)}
          <path d={trace} fill="none" stroke="var(--vrm-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
          <line x1={x(choisi)} x2={x(choisi)} y1={0} y2={H} stroke="var(--vrm-muted)" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke"/>
        </svg>
        {/* Le point du jour choisi : un cercle HTML (un cercle SVG s'étirerait avec le graphique). */}
        <span aria-hidden="true" style={{ position: 'absolute', left: `${(x(choisi) / W) * 100}%`, top: y(p.n) - 5, width: 10, height: 10, marginLeft: -5, borderRadius: '50%', background: 'var(--vrm-accent)', boxShadow: '0 0 0 2px var(--vrm-surface)' }}/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...S.muet, fontSize: 12, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        <span>{jourCourt(points[0].jour)}</span><span>max {format(max)}</span><span>{jourCourt(points[n - 1].jour)}</span>
      </div>
      <details style={{ marginTop: 6 }}>
        <summary style={{ ...S.muet, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Voir les chiffres</summary>
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            <thead><tr><th style={{ textAlign: 'left', fontWeight: 600, color: 'var(--vrm-muted)', padding: '4px 0' }}>Jour</th><th style={{ textAlign: 'right', fontWeight: 600, color: 'var(--vrm-muted)', padding: '4px 0' }}>{titre}</th></tr></thead>
            <tbody>{points.slice().reverse().map((q) => <tr key={q.jour}><td style={{ padding: '3px 0', color: 'var(--vrm-ink)' }}>{jourCourt(q.jour)}</td><td style={{ padding: '3px 0', textAlign: 'right', color: 'var(--vrm-ink)' }}>{format(q.n)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function TableauProprietaire({ entetes, fetcher = (typeof fetch === 'function' ? fetch : null), PanneEl = null }) {
  const [d, setD] = React.useState(undefined);
  const [raison, setRaison] = React.useState('');
  const lire = React.useCallback(async () => {
    setD(undefined);
    try {
      const r = await fetcher('/api/compte?mode=pilotage', { headers: entetes ? entetes() : {}, cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok === true) { setD(j); return; }
      setRaison(r.status === 403 ? 'Réservé au propriétaire de l’installation.' : 'Le serveur n’a pas rendu le tableau.');
    } catch (_) { setRaison('Pas de connexion.'); }
    setD(null);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { lire(); }, [lire]);

  const tete = (
    <header style={{ marginBottom: 4 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0', color: 'var(--vrm-ink)' }}>Ton entreprise</h2>
      <p style={S.muet}>Les vendeurs de VRM en comptes et en totaux — jamais un nom, jamais une adresse.</p>
    </header>
  );
  if (d === undefined) return <div data-pilotage="lecture">{tete}<p style={{ ...S.muet, marginTop: 12 }}>Lecture…</p></div>;
  if (d === null) return <div data-pilotage="pas-su">{tete}{PanneEl ? <PanneEl quoi="Le tableau de ton entreprise" raison={raison} onReessayer={lire}/> : <p style={S.muet}>Pas su pour l’instant. {raison} <button type="button" className="vrm-lien-action" onClick={lire}>Réessayer</button></p>}</div>;

  const R = d.raisons || {};
  const ins = d.inscrits, act = d.actifs, ab = d.abonnes, es = d.essais, rev = d.revenus || {}, des = d.desabonnements, inc = d.incidents, pl = d.plantages, sat = d.satisfaction, h = d.historique;
  const revValeur = rev.etat === 'ok' ? euros(rev.mensuelCentimes) : null;
  const revSous = rev.etat === 'stripe-absent' ? 'Stripe pas branché'
    : rev.etat === 'pas-su' ? pasSu(R, 'revenus')
    : [`${nombre(rev.abonnements)} abonnement${rev.abonnements > 1 ? 's' : ''} payé${rev.abonnements > 1 ? 's' : ''}`, rev.modeTest ? 'mode test' : '', rev.avecRemise ? `${rev.avecRemise} avec remise, comptés avant remise` : '', rev.ecartes ? `${rev.ecartes} écarté${rev.ecartes > 1 ? 's' : ''} (autre devise)` : ''].filter(Boolean).join(' · ');
  const depuis = h && h.depuis ? `Un point par jour depuis le ${jourLong(h.depuis)} ; la courbe se dessine dès le deuxième.` : 'Un point par jour à partir d’aujourd’hui ; la courbe se dessine dès le deuxième.';

  return (
    <div data-pilotage="lu" data-pilotage-at={d.at}>
      {tete}
      <p style={{ ...S.muet, marginTop: 2 }}>Lu le {dateHeure(d.at)} · <button type="button" data-pilotage-relire="" onClick={lire} style={{ minHeight: 44, padding: '0 4px', background: 'none', border: 0, color: 'var(--vrm-accent)', fontSize: 13, cursor: 'pointer' }}>Relire</button></p>

      <h3 style={S.titre}>Vendeurs</h3>
      <div style={S.grille}>
        <Tuile cle="inscrits" lib="Inscrits" valeur={ins ? nombre(ins.total) : null} sous={ins ? `+${nombre(ins.nouveaux30)} en 30 jours` : pasSu(R, 'inscrits')}/>
        <Tuile cle="actifs7" lib="Actifs sur 7 jours" valeur={act ? nombre(act.j7) : null} sous={act ? (ins ? `sur ${nombre(ins.total)} inscrits` : null) : pasSu(R, 'actifs')}/>
        <Tuile cle="actifs30" lib="Actifs sur 30 jours" valeur={act ? nombre(act.j30) : null} sous={act ? 'app ouverte, extension ou connexion' : pasSu(R, 'actifs')}/>
      </div>

      <h3 style={S.titre}>Abonnements</h3>
      <div style={S.grille}>
        <Tuile cle="essais" lib="Essais en cours" valeur={es ? nombre(es.enCours) : null} sous={es ? `${nombre(es.finis)} fini${es.finis > 1 ? 's' : ''} · ${nombre(es.convertis)} devenu${es.convertis > 1 ? 's' : ''} abonné${es.convertis > 1 ? 's' : ''}` : pasSu(R, 'essais')}/>
        <Tuile cle="abonnes" lib="Abonnés" valeur={ab ? nombre(ab.total) : null} alerte={!!(ab && ab.impayes)}
          sous={ab ? [ab.impayes ? `${ab.impayes} impayé${ab.impayes > 1 ? 's' : ''}` : '', ab.resiliationsProgrammees ? `${ab.resiliationsProgrammees} ${ab.resiliationsProgrammees > 1 ? 'partiront' : 'partira'} en fin de période` : ''].filter(Boolean).join(' · ') || 'aucun impayé' : pasSu(R, 'abonnes')}/>
        <Tuile cle="revenus" lib="Revenus mensuels récurrents" valeur={revValeur} sous={revSous}/>
        <Tuile cle="desabonnements" lib="Désabonnements ce mois" valeur={des ? nombre(des.n) : null} sous={des ? (des.source === 'stripe' ? 'lus chez Stripe' : 'lus dans VRM') : pasSu(R, 'desabonnements')}/>
      </div>
      {ab && Array.isArray(ab.parPlan) && ab.parPlan.length ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', ...S.carte }} data-pilotage-plans={ab.parPlan.length}>
          {ab.parPlan.map((p, k) => <li key={p.plan} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderTop: k ? '.5px solid var(--vrm-line)' : 0, fontSize: 15, color: 'var(--vrm-ink)' }}><span style={{ overflowWrap: 'anywhere' }}>{p.plan}</span><b style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{nombre(p.n)}</b></li>)}
        </ul>
      ) : null}

      <h3 style={S.titre}>90 derniers jours</h3>
      <div style={{ ...S.grille, gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
        <Courbe cle="inscrits" titre="Inscrits" points={ins ? ins.courbe : []} vide={pasSu(R, 'inscrits')}/>
        <Courbe cle="actifs7" titre="Actifs sur 7 jours" points={h ? h.actifs7 : []} vide={h ? depuis : pasSu(R, 'historique')}/>
        <Courbe cle="abonnes" titre="Abonnés" points={h ? h.abonnes : []} vide={h ? depuis : pasSu(R, 'historique')}/>
        {rev.etat === 'ok' || (h && h.mensuelCentimes && h.mensuelCentimes.length) ? <Courbe cle="revenus" titre="Revenus mensuels récurrents" points={h ? h.mensuelCentimes : []} format={euros} vide={h ? depuis : pasSu(R, 'historique')}/> : null}
      </div>

      <h3 style={S.titre}>Fiabilité</h3>
      <div style={S.grille}>
        <Tuile cle="incidents" lib="Incidents ouverts" valeur={inc ? nombre(inc.ouverts.length) : null} alerte={!!(inc && inc.ouverts.length)}
          sous={!inc ? pasSu(R, 'incidents')
            : inc.ouverts.length ? inc.ouverts.map((o) => `${NOMS_COMPOSANTS[o.composant] || o.composant} depuis ${dateHeure(o.debut)}`).join(' · ')
            : inc.sondesArretees ? 'les sondes ne tournent plus : pas su au-delà'
            : `${nombre(inc.fermes30)} fermé${inc.fermes30 > 1 ? 's' : ''} en 30 jours${inc.dernier ? ` · dernier : ${NOMS_COMPOSANTS[inc.dernier.composant] || inc.dernier.composant}, ${inc.dernier.dureeMin || '?'} min` : ''}`}/>
        <Tuile cle="plantages" lib="Plantages sur 7 jours" valeur={pl ? nombre(pl.n) : null} alerte={!!(pl && pl.tombes)}
          sous={pl ? (pl.n ? `${nombre(pl.types)} sorte${pl.types > 1 ? 's' : ''} d’erreur${pl.tombes ? ` · ${nombre(pl.tombes)} écran${pl.tombes > 1 ? 's' : ''} tombé${pl.tombes > 1 ? 's' : ''}` : ''} · détail : Sécurité des données` : 'aucun remonté') : pasSu(R, 'plantages')}/>
      </div>

      <h3 style={S.titre}>Satisfaction</h3>
      {!sat ? <p style={S.muet} data-pilotage-satisfaction="pas-su">— {pasSu(R, 'satisfaction')}</p> : (
        <div style={S.carte} data-pilotage-satisfaction={sat.n} data-moyenne={sat.moyenne == null ? '' : sat.moyenne}>
          <p style={S.lib}>« VRM t’aide-t-il ? » — demandé une fois, après 14 jours d’usage</p>
          <p style={S.chiffre}>{sat.moyenne == null ? '—' : `${String(sat.moyenne).replace('.', ',')} / 5`}</p>
          <p style={S.muet}>{sat.n ? `${nombre(sat.n)} réponse${sat.n > 1 ? 's' : ''}` : 'Aucune réponse pour l’instant.'}</p>
          {sat.n ? (
            <div style={{ marginTop: 10 }} data-pilotage-repartition={sat.repartition.join(',')}>
              {[5, 4, 3, 2, 1].map((note) => {
                const k = sat.repartition[note - 1] || 0;
                const max = Math.max(1, ...sat.repartition);
                return (
                  <div key={note} style={{ display: 'grid', gridTemplateColumns: '16px 1fr 32px', alignItems: 'center', gap: 8, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--vrm-muted)', margin: '3px 0' }}>
                    <span>{note}</span>
                    <span style={{ height: 8, borderRadius: 4, background: 'var(--vrm-line)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${(k / max) * 100}%`, background: 'var(--vrm-accent)', borderRadius: 4 }}/></span>
                    <span style={{ textAlign: 'right', color: 'var(--vrm-ink)' }}>{k}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
          {sat.commentaires && sat.commentaires.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }} data-pilotage-commentaires={sat.commentaires.length}>
              {sat.commentaires.map((c, k) => (
                <li key={k} style={{ padding: '8px 0', borderTop: '.5px solid var(--vrm-line)' }}>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--vrm-ink)', overflowWrap: 'anywhere' }}>« {c.mot} »</p>
                  <p style={{ ...S.muet, marginTop: 2 }}>{c.note} / 5{c.jour ? ` · ${jourCourt(c.jour)}` : ''}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
export default TableauProprietaire;
