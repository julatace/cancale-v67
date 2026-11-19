// ── LA FEUILLE « CHANGER LE PRIX » (3 nov.) — règle : src/prixPartout.js ────
// Un prix, une rangée par site où CE N° est en ligne (par identité), l'état de
// chaque site après « Appliquer ». Rien ne part avant ce clic.
//
// ⚠️⚠️ (19 nov., décision de Julien sur une capture de son iPhone : « ce genre de
// fonctionnalité qui pue, tu me les enlèves tout de suite : c'est à l'extension de
// baisser les prix, c'est pas à moi ») — UN GESTE : il tape le prix, touche
// « Appliquer », c'est SON clic pour chaque site coché. La baisse part par
// l'extension, ou ATTEND (src/prixAttente.js) et part seule. RETIRÉS, ne pas les
// remettre : l'état intermédiaire où il devait confirmer ailleurs, le second bouton
// de baisse sur la rangée, le plein qui changeait de nom après un envoi. Après un
// envoi la feuille se FERME si tout est fait ou en attente ; elle ne reste ouverte
// que s'il y a quelque chose à lire (refus, pas sûr, hausse).
// Disposition (« VRM natif », docs/design/NATIF.md) : une feuille, un champ, un groupe
// de rangées (nom du site · « 59 € → 58 € » sur UNE ligne · l'état dessous), UN plein.
import React from 'react';
import { createPortal } from 'react-dom';
import { prixTape, minisAuDessus, NOM_SITE, toutEstDit } from './prixPartout.js';
import { commandeCourante } from './prixAttente.js';
import { tr } from './i18n/index.js';
import './prix-partout.css';

// « 1 250 € », « 1 199,50 € » : milliers séparés par une espace fine insécable, jamais coupés.
const eur = (n) => { if (n == null) return '—'; const v = Math.round(n * 100) / 100; const [e, d] = v.toFixed(Number.isInteger(v) ? 0 : 2).split('.'); return `${e.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')}${d ? ',' + d : ''}\u00a0€`; };

// L'état d'une commande LUE dans sa base (une baisse rangée plus tôt, ou celle de cette feuille relue).
const etatDeCommande = (v, s, sait) => {
  if (!v) return null;
  if (v.etat === 'attente') return { etat: 'attente', prix: v.prix, idCmd: v.id, compte: s.compte || null, lue: true, maj: sait === false };
  if (v.etat === 'pris') return { etat: 'pris', prix: v.prix };
  if (v.etat === 'fait') return { etat: 'fait', prix: v.prix, relu: v.relu, prixRelu: v.prixVu };
  if (v.etat === 'perimee') return { etat: 'refuse', code: 'perimee', prix: v.prix };
  if (v.etat === 'incertain') return { etat: 'incertain', raison: v.raison || null, prix: v.prix };
  return { etat: 'refuse', code: v.code, raison: v.raison || null, prix: v.prix, prixRelu: v.prixVu };
};
// La phrase d'un état : UNE ligne courte et vraie. `ton` : calme · ok · geste (ambre : quelque chose à lire ou à faire).
function phrase(e, s, compteDe) {
  const site = NOM_SITE[s.site] || '';
  if (!e) return null;
  if (e.etat === 'envoi') return { ton: 'calme', texte: tr('prixPartout.envoi') };
  if (e.etat === 'fait') return { ton: 'ok', texte: e.inchange ? tr('prixPartout.etat.deja') : e.relu ? tr('prixPartout.etat.faitRelu', { prix: eur(e.prixRelu != null ? e.prixRelu : e.prix) }) : tr('prixPartout.etat.fait') };
  if (e.etat === 'pris') return { ton: 'calme', texte: tr('prixPartout.etat.pris') };
  if (e.etat === 'attente') {
    const nom = e.compte && compteDe ? compteDe(e.compte) : '';
    const texte = e.maj ? tr('prixPartout.etat.attenteMaj', { site }) : nom ? tr('prixPartout.etat.attente', { site, compte: nom }) : tr('prixPartout.etat.attenteSans', { site });
    return { ton: 'calme', texte: e.lue && e.prix != null ? `${eur(e.prix)} · ${texte}` : texte, annuler: !!e.idCmd };
  }
  if (e.etat === 'hausse') return { ton: 'geste', texte: tr('prixPartout.etat.hausse', { site }), lien: true };
  if (e.etat === 'a-faire') {
    const r = String(e.raison || '');
    const texte = r === 'recette' ? tr('prixPartout.etat.recette', { site }) : r === 'format' ? tr('prixPartout.etat.format', { site }) : r === 'compte introuvable' ? tr('prixPartout.etat.compte', { site })
      : r === 'prix actuel pas lu' ? tr('prixPartout.etat.prixPasLu', { site }) : /^annonce en [A-Z]{3}$/.test(r) ? tr('prixPartout.etat.devise', { site, devise: r.slice(-3) }) : tr('prixPartout.etat.aFaire', { site });
    return { ton: 'geste', texte, lien: true };
  }
  if (e.etat === 'refuse') {
    if (e.code === 'prix-change') return { ton: 'geste', texte: e.prixRelu != null ? tr('prixPartout.etat.change', { site, prix: eur(e.prixRelu) }) : tr('prixPartout.etat.changeSans', { site }), lien: true };
    if (e.code === 'perimee' || e.code === 'expiree') return { ton: 'geste', texte: tr('prixPartout.etat.perimee') };
    if (e.code === 'base') return { ton: 'geste', texte: tr('prixPartout.etat.base') };
    if (e.code === 'pas-appris' || e.code === 'pas-rejouable') return { ton: 'geste', texte: tr('prixPartout.etat.recette', { site }), lien: true };
    // L'extension n'a pas (ou plus) le corps que Vinted a accepté pour cette annonce : une phrase, pas son mode d'emploi.
    if (e.code === 'modele-absent' || e.code === 'modele-ancien' || e.code === 'coffre-absent') return { ton: 'geste', texte: tr('prixPartout.etat.format', { site }), lien: true };
    return { ton: 'geste', texte: tr('prixPartout.etat.refuse'), raison: e.raison || null, lien: true };
  }
  if (e.etat === 'incertain') return { ton: 'geste', texte: tr('prixPartout.etat.incertain'), raison: e.raison || null, lien: true };
  return null;
}

export default function PrixPartout({ num, sites = [], manques = [], lecture = false, onAppliquer, onFermer, Retour, prixDe = null, attentes = null, saitAttendre = true, compteDe = null, onAnnuler = null, dire = null }) {
  const [prix, setPrix] = React.useState('');
  const [coches, setCoches] = React.useState(() => new Set(sites.map((s) => s.cle)));
  const [etats, setEtats] = React.useState({});
  const [enCours, setEnCours] = React.useState(false);
  const [annule, setAnnule] = React.useState(null);     // la commande qu'il annule (un toucher, pas deux)
  const vus = React.useRef(new Set(sites.map((s) => s.cle)));
  React.useEffect(() => {   // un site arrivé après l'ouverture (lecture finie) : coché par défaut
    const neufs = sites.filter((s) => !vus.current.has(s.cle));
    if (!neufs.length) return;
    neufs.forEach((s) => vus.current.add(s.cle));
    setCoches((c) => { const n = new Set(c); neufs.forEach((s) => n.add(s.cle)); return n; });
  }, [sites]);
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented && !enCours) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer, enCours]);
  const p = prixTape(prix);
  const minis = minisAuDessus(sites, p);
  const nCoches = sites.filter((s) => coches.has(s.cle)).length;
  const basculer = (cle) => setCoches((c) => { const n = new Set(c); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
  const appliquer = async () => {
    if (p == null || !nCoches || enCours) return;
    setEnCours(true); setEtats({});
    let r = null;
    try { r = await onAppliquer({ coches: new Set(coches), prix: p, surEtat: (cle, e) => setEtats((x) => ({ ...x, [cle]: e })) }); }
    finally { setEnCours(false); }
    // Tout est fait ou en attente : rien à lire, la feuille se ferme et le dit en une ligne.
    if (r && r.res && toutEstDit(r.res)) {
      const enAttente = sites.filter((s) => r.res[s.cle] && r.res[s.cle].etat === 'attente');
      if (dire) { try { dire(enAttente.length ? tr('prixPartout.dit.attente', { num, prix: eur(p), sites: [...new Set(enAttente.map((s) => NOM_SITE[s.site]))].join(', ') }) : tr('prixPartout.dit.fait', { num, prix: eur(p) }), 'ok'); } catch (_) {} }
      onFermer();
    }
  };
  // L'état d'une rangée : celui de CET envoi, sinon celui de la baisse qui attend déjà pour cette annonce
  // (lue dans sa base), sinon ce que VRM ne peut pas faire pour elle (dit avant même d'appliquer).
  const etatDe = (s) => {
    const e = etats[s.cle] || null;
    const v = Array.isArray(attentes) ? commandeCourante(attentes, s.cle) : null;
    if (e && e.etat === 'attente') return v && v.id === e.idCmd && v.etat !== 'attente' ? etatDeCommande(v, s, saitAttendre) : e;
    if (e) return e;
    if (v && !enCours) return etatDeCommande(v, s, saitAttendre);
    if (s.mode === 'site' && s.raison) return { etat: 'a-faire', raison: s.raison, avant: true };
    return null;
  };
  const annuler = async (s, e) => {
    if (!onAnnuler || annule) return;
    setAnnule(e.idCmd);
    let ok = null;
    try { ok = await onAnnuler({ id: e.idCmd, cle: s.cle }); } catch (_) { ok = null; }
    setAnnule(null);
    if (ok === true) setEtats((x) => { const n = { ...x }; delete n[s.cle]; return n; });
  };
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="pp-voile" data-prix-partout={num} onClick={(e) => { if (e.target === e.currentTarget && !enCours) onFermer(); }}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="pp-feuille" role="dialog" aria-modal="true" aria-label={tr('prixPartout.aria', { num })}>
        <span className="pp-poignee" aria-hidden="true"/>
        <header className="pp-tete">
          <h2>{tr('prixPartout.titre')}</h2>
          <span className="pp-num">N°{num}</span>
          <button type="button" className="pp-x" aria-label={tr('prixPartout.fermer')} data-prix-fermer="" onClick={onFermer} disabled={enCours}><span aria-hidden="true">×</span></button>
        </header>
        <label className="pp-champ">
          <span>{tr('prixPartout.nouveau')}</span>
          <span className="pp-champ-saisie">
            <input inputMode="decimal" autoComplete="off" enterKeyHint="done" value={prix} onChange={(e) => { setPrix(e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); appliquer(); } }}
              disabled={enCours} data-prix-champ="" aria-invalid={prix !== '' && p == null ? 'true' : undefined}/>
            <b aria-hidden="true">€</b>
          </span>
        </label>
        <ul className="pp-groupe" data-prix-sites={sites.length}>
          {sites.map((s) => {
            const e = etatDe(s);
            const ph = phrase(e, s, compteDe);
            const coche = coches.has(s.cle);
            const cible = p == null ? null : (prixDe ? prixDe(s.site, p) : p);
            const change = cible != null && s.prix != null && Math.round(cible * 100) !== Math.round(s.prix * 100);
            return (
              <li key={s.cle} className="pp-rangee" data-prix-site={s.site} data-prix-cle={s.cle} data-prix-mode={s.mode} data-prix-etat={e && !e.avant ? e.etat : ''} data-prix-relu={e && e.relu ? '1' : ''}>
                <label className="pp-coche">
                  <input type="checkbox" checked={coche} onChange={() => basculer(s.cle)} disabled={enCours} data-prix-coche={s.cle} aria-label={NOM_SITE[s.site]}/>
                </label>
                <div className="pp-corps">
                  <div className="pp-ligne">
                    <b className="pp-site">{NOM_SITE[s.site]}</b>
                    <span className="pp-prix" data-prix-ligne="">{eur(s.prix)}{change ? <span data-prix-cible={cible}>{' → '}<b>{eur(cible)}</b></span> : null}</span>
                  </div>
                  {ph ? <p className={'pp-etat is-' + ph.ton} data-prix-phrase={e.etat} aria-live="polite">
                    {ph.texte}{ph.raison ? <span data-prix-raison="">{' — ' + ph.raison}</span> : null}
                  </p> : null}
                </div>
                {ph && ph.annuler && onAnnuler ? <button type="button" className="pp-geste" data-prix-annuler={e.idCmd} disabled={annule === e.idCmd || enCours} onClick={() => annuler(s, e)}>{tr('prixPartout.annuler')}</button>
                  : ph && ph.lien && s.lien ? <a className="pp-geste" href={s.lien} target="_blank" rel="noopener noreferrer" data-prix-lien={s.cle}>{tr('prixPartout.ouvrir')}</a> : null}
              </li>
            );
          })}
          {manques.map((m) => <li key={'m' + m} className="pp-rangee is-passu" data-prix-passu={m}><div className="pp-corps"><div className="pp-ligne"><b className="pp-site">{m}</b><span className="pp-prix">{tr('prixPartout.passu')}</span></div></div></li>)}
          {lecture ? <li className="pp-rangee is-passu" data-prix-lecture=""><div className="pp-corps"><div className="pp-ligne"><span className="pp-prix">…</span></div></div></li> : null}
        </ul>
        {!lecture && !sites.length && !manques.length ? <p className="pp-vide" data-prix-aucun="">{tr('prixPartout.aucune')}</p> : null}
        {minis.map((m) => <p key={m.cle} className="pp-mini" data-prix-mini={m.mini}>{tr('prixPartout.mini', { prix: eur(m.mini) })}</p>)}
        <button type="button" className="pp-plein" data-prix-appliquer="" disabled={p == null || !nCoches || enCours} onClick={appliquer}>
          {enCours ? tr('prixPartout.envoi') : tr('prixPartout.appliquer')}
        </button>
      </div>
    </div>, document.body);
}
