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
// ⚠️⚠️ (20 nov., décision de Julien : « toute action doit être faite dans l'extension ») Sur Vinted, Leboncoin et
// Vestiaire la rangée d'un site OUVRE le panneau de l'extension sur CETTE annonce (« Changer le prix dans
// l'extension ») : l'app n'envoie plus de baisse et n'en range plus. Seul eBay (API serveur, pas de panneau) se
// coche et part par « Appliquer ». La baisse par règle se règle dans l'extension ; la feuille en dit l'état.
// Disposition (« VRM natif », docs/design/NATIF.md) : une feuille, un champ, un groupe
// de rangées (nom du site · « 59 € → 58 € » sur UNE ligne · l'état dessous), UN plein.
import React from 'react';
import { Feuille, Groupe, Rangee, Bouton, Vide, Attente } from './natif/index.js';
import { RangeeExtension } from './BoutonExtension.jsx';
import { lienPanneau, ouvrirPanneau, extensionIci } from './ouvrirPanneau.js';
import { prixTape, minisAuDessus, NOM_SITE, toutEstDit } from './prixPartout.js';
import { commandeCourante } from './prixAttente.js';
import { gardePrixRegle } from './gardePrix.js';
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

export default function PrixPartout({ num, sites = [], manques = [], lecture = false, onAppliquer, onFermer, prixDe = null, attentes = null, saitAttendre = true, compteDe = null, onAnnuler = null, dire = null, regles = null, onRegle = null, focusPrix = false }) {
  // (19 nov., fiche directe) Ouvert en touchant LA VALEUR du prix : le champ reçoit le focus après la feuille (qui le prend au montage).
  const champPrixRef = React.useRef(null);
  React.useEffect(() => { if (!focusPrix) return undefined; const t = setTimeout(() => { try { if (champPrixRef.current) champPrixRef.current.focus(); } catch (_) {} }, 120); return () => clearTimeout(t); }, [focusPrix]);
  const [prix, setPrix] = React.useState('');
  const [coches, setCoches] = React.useState(() => new Set(sites.filter((s) => s.site === 'ebay').map((s) => s.cle)));
  const [etats, setEtats] = React.useState({});
  const [enCours, setEnCours] = React.useState(false);
  const [annule, setAnnule] = React.useState(null);     // la commande qu'il annule (un toucher, pas deux)
  // (21 nov., ext. 5.432 — choix A et B de Julien) « Sur tous les sites où elle est en ligne » : coché d'office s'il y a
  // plusieurs sites ; la garde du prix (src/gardePrix.js) : un prix suspect demande SA confirmation du chiffre, en grand.
  const nExt = sites.filter((x) => x.site !== 'ebay').length;
  const [tousChoisi, setTous] = React.useState(null);   // null : son choix pas encore fait ⇒ coché d'office à plusieurs sites
  const tous = tousChoisi == null ? sites.length > 1 : tousChoisi;
  const [gardeConf, setGardeConf] = React.useState(null);   // [{ cle, prixC, actuelC, garde }] à confirmer
  const gardeOk = React.useRef({});                          // { [cle]: centimes confirmés }
  const vus = React.useRef(new Set(sites.map((s) => s.cle)));
  React.useEffect(() => {   // un site arrivé après l'ouverture (lecture finie) : coché par défaut
    const neufs = sites.filter((s) => !vus.current.has(s.cle));
    if (!neufs.length) return;
    neufs.forEach((s) => vus.current.add(s.cle));
    setCoches((c) => { const n = new Set(c); neufs.filter((s) => s.site === 'ebay').forEach((s) => n.add(s.cle)); return n; });
  }, [sites]);
  const p = prixTape(prix);
  const minis = minisAuDessus(sites, p);
  const nCoches = sites.filter((s) => coches.has(s.cle)).length;
  const basculer = (cle) => setCoches((c) => { const n = new Set(c); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
  const appliquer = async () => {
    if (p == null || !nCoches || enCours) return;
    // La garde du prix (à la main) : chaque site coché, son prix final contre son prix actuel. Suspect ⇒ rien ne part.
    const suspects = sites.filter((s) => coches.has(s.cle)).map((s) => {
      const cible = prixDe ? prixDe(s.site, p) : p;
      const prixC = cible == null ? NaN : Math.round(cible * 100);
      const g = gardePrixRegle({ prixC, actuelC: s.prix != null ? Math.round(s.prix * 100) : null, plancher: null, mode: 'main', confirmeC: gardeOk.current[s.cle] });
      return g.ok ? null : { cle: s.cle, site: s.site, prixC, actuelC: g.actuelC, garde: g };
    }).filter(Boolean);
    if (suspects.length) { setGardeConf(suspects); return; }
    setEnCours(true); setEtats({});
    let r = null;
    try { r = await onAppliquer({ coches: new Set(coches), prix: p, gardeConfirme: { ...gardeOk.current }, surEtat: (cle, e) => setEtats((x) => ({ ...x, [cle]: e })) }); }
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
  const fermer = () => { if (!enCours) onFermer(); };
  const aAnnuler = [];   // les baisses qui attendent : « Annuler » sous le groupe (jamais un bouton DANS une rangée)
  const phraseExt = extensionIci() ? '' : tr('actionsExt.phrase', { site: NOM_SITE.vinted });
  const rangees = sites.map((s) => {
    const e = etatDe(s);
    const ph = phrase(e, s, compteDe);
    if (s.site !== 'ebay') {
      // Vinted, Leboncoin, Vestiaire : le prix lu, l'état d'une baisse rangée plus tôt (lecture), et LE lien du panneau.
      const cible = { site: s.site, page: 'prix', ids: [s.id], action: 'changer' };
      const url = lienPanneau(cible);
      if (ph && ph.annuler && onAnnuler) aAnnuler.push({ s, e });
      const sousExt = <span className="pp-etat is-calme">{[ph ? ph.texte : '', tr('actionsExt.changerPrix'), s.site === 'vinted' ? phraseExt : (extensionIci() ? '' : tr('actionsExt.phrase', { site: NOM_SITE[s.site] }))].filter(Boolean).join(' · ')}</span>;
      return (
        <Rangee key={s.cle} titre={<span className="pp-site">{NOM_SITE[s.site]}</span>} valeur={<span className="pp-prix" data-prix-ligne="">{eur(s.prix)}</span>} sousTitre={sousExt} sousLignes={2}
          fin="chevron" onClick={() => ouvrirPanneau(cible)} className="pp-rangee"
          attrs={{ 'data-prix-site': s.site, 'data-prix-cle': s.cle, 'data-prix-mode': 'extension', 'data-prix-etat': e && !e.avant ? e.etat : '', 'data-vrm-panneau': 'changerPrix', 'data-vrm-panneau-site': s.site, 'data-vrm-panneau-lien': url }}/>
      );
    }
    const coche = coches.has(s.cle);
    const cible = p == null ? null : (prixDe ? prixDe(s.site, p) : p);
    const change = coche && cible != null && s.prix != null && Math.round(cible * 100) !== Math.round(s.prix * 100);
    if (ph && ph.annuler && onAnnuler) aAnnuler.push({ s, e });
    // Quelque chose à faire SUR le site (hausse, refus, format pas appris) : la rangée entière l'ouvre (nouvel onglet).
    const lien = ph && ph.lien && s.lien ? s.lien : '';
    const valeur = <span className="pp-prix" data-prix-ligne="">{eur(s.prix)}{change ? <span data-prix-cible={cible}>{' → '}<b>{eur(cible)}</b></span> : null}</span>;
    const sous = ph ? <span className={'pp-etat is-' + ph.ton} data-prix-phrase={e.etat} aria-live="polite">{ph.texte}{ph.raison ? <span data-prix-raison="">{' — ' + ph.raison}</span> : null}</span> : '';
    return (
      <Rangee key={s.cle} titre={<span className="pp-site">{NOM_SITE[s.site]}</span>} valeur={valeur} valeurForte={change} sousTitre={sous} sousLignes={2}
        ton={ph && ph.ton === 'geste' ? 'ambre' : 'neutre'}
        fin={lien ? 'chevron' : coche ? 'coche' : <span className="pp-sans-coche" aria-hidden="true"/>}
        onClick={enCours ? null : lien ? () => { try { window.open(lien, '_blank', 'noopener,noreferrer'); } catch (_) {} } : () => basculer(s.cle)}
        className="pp-rangee"
        attrs={{ 'data-prix-site': s.site, 'data-prix-cle': s.cle, 'data-prix-mode': s.mode, 'data-prix-etat': e && !e.avant ? e.etat : '', 'data-prix-relu': e && e.relu ? '1' : '',
          'data-prix-coche': lien ? undefined : s.cle, 'data-prix-coche-etat': coche ? '1' : '0', ...(lien ? { 'data-prix-lien': s.cle } : {}) }}/>
    );
  });
  const raison = p == null ? tr('prixPartout.raisonPrix') : !nCoches ? tr('prixPartout.raisonSite') : '';
  const aEbay = sites.some((s) => s.site === 'ebay');
  return (
    <Feuille ouverte onFermer={fermer} titre={tr('prixPartout.aria', { num })} className="pp-feuille" attrs={{ 'data-prix-partout': num }}
      pied={aEbay && !(gardeConf && gardeConf.length) ? <Bouton variante="plein" className="pp-plein" chargement={enCours} indisponible={!enCours && !!raison} raison={raison} onClick={appliquer} attrs={{ 'data-prix-appliquer': '' }}>{tr('prixPartout.appliquerEbay')}</Bouton> : null}>
      {aEbay ? <label className="pp-champ">
        <span>{tr('prixPartout.nouveau')}</span>
        <span className="pp-champ-saisie">
          <input ref={champPrixRef} inputMode="decimal" autoComplete="off" autoFocus={focusPrix || undefined} enterKeyHint="done" value={prix} onChange={(e) => { setPrix(e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); appliquer(); } }}
            disabled={enCours} data-prix-champ="" aria-invalid={prix !== '' && p == null ? 'true' : undefined}/>
          <b aria-hidden="true">€</b>
        </span>
      </label> : null}
      {gardeConf && gardeConf.length ? (
        <div className="pp-garde" role="alertdialog" aria-live="assertive" data-prix-garde={gardeConf.length}>
          <p className="pp-garde-titre">{tr('prixPartout.garde.titre')}</p>
          {gardeConf.map((c) => (
            <div key={c.cle} className="pp-garde-l" data-prix-garde-ligne={c.cle}>
              <p><b className="pp-garde-chiffre" data-prix-garde-prix={c.prixC}>{eur(c.prixC / 100)}</b> <span>{c.actuelC != null ? tr('prixPartout.garde.auLieu', { avant: eur(c.actuelC / 100) }) : ''}</span> <small>{NOM_SITE[c.site] || ''}</small></p>
              <ul>
                {c.garde.raisons.includes('frappe') ? <li>{tr('prixPartout.garde.frappe')}</li> : null}
                {c.garde.raisons.includes('chute') ? <li>{tr('prixPartout.garde.chute', { pct: c.garde.chutePct, seuil: c.garde.seuil })}</li> : null}
              </ul>
            </div>
          ))}
          <div className="pp-garde-boutons">
            <Bouton variante="plein" onClick={() => { for (const c of gardeConf) gardeOk.current[c.cle] = c.prixC; setGardeConf(null); setTimeout(() => appliquer(), 0); }} attrs={{ 'data-prix-garde-oui': '' }}>{tr('prixPartout.garde.oui', { prix: gardeConf.map((c) => eur(c.prixC / 100)).join(', ') })}</Bouton>
            <Bouton variante="texte" onClick={() => { gardeOk.current = {}; setGardeConf(null); }} attrs={{ 'data-prix-garde-non': '' }}>{tr('prixPartout.garde.corriger')}</Bouton>
          </div>
        </div>
      ) : null}
      {nExt > 0 && sites.length > 1 ? (
        <Groupe attrs={{ 'data-prix-tous': tous ? '1' : '0' }}>
          <Rangee titre={tr('prixPartout.tousCourt')} sousTitre={tr('prixPartout.tousSous')} sousLignes={2} fin={tous ? 'coche' : <span className="pp-sans-coche" aria-hidden="true"/>} onClick={() => setTous(!tous)} attrs={{ 'data-prix-tous-coche': tous ? '1' : '0' }}/>
          {tous ? (() => { const s0 = sites.find((x) => x.site === 'vinted') || sites.find((x) => x.site !== 'ebay'); const cible = { site: s0.site, page: 'prix', ids: [s0.id], action: 'changer' };
            return <Rangee titre={tr('prixPartout.ouvrirTous')} fin="chevron" onClick={() => ouvrirPanneau(cible)} attrs={{ 'data-prix-tous-ouvrir': lienPanneau(cible), 'data-vrm-panneau': 'changerPrix' }}/>; })() : null}
        </Groupe>
      ) : null}
      {lecture && !sites.length ? <Attente forme="rangees" n={2}/> : (
        <Groupe attrs={{ 'data-prix-sites': sites.length }}>
          {rangees}
          {manques.map((m) => <Rangee key={'m' + m} titre={m} valeur={tr('prixPartout.passu')} attrs={{ 'data-prix-passu': m }}/>)}
          {lecture ? <Rangee titre="…" attrs={{ 'data-prix-lecture': '' }}/> : null}
        </Groupe>
      )}
      {aAnnuler.map(({ s, e }) => (
        <Bouton key={'a' + e.idCmd} variante="texte" large chargement={annule === e.idCmd} indisponible={enCours && annule !== e.idCmd} raison={tr('prixPartout.envoiEnCours')} onClick={() => annuler(s, e)} attrs={{ 'data-prix-annuler': e.idCmd, 'data-prix-annuler-cle': s.cle }}>
          {tr('prixPartout.annulerSite', { site: NOM_SITE[s.site] })}
        </Bouton>
      ))}
      {!lecture && !sites.length && !manques.length ? <div data-prix-aucun=""><Vide phrase={tr('prixPartout.aucune')}/></div> : null}
      {/* (19 nov., décision 1 de Julien) LA BAISSE PAR RÈGLE, par compte Vinted de ce N° : éteinte par défaut ;
          l'extension l'applique seule, dans ses plafonds (src/reglesAuto.js, background.js `regleBaisseTick`). */}
      {Array.isArray(regles) && regles.length ? (
        <Groupe titre={tr('prixPartout.regle.titre')} attrs={{ 'data-prix-regles': regles.length }}>
          {regles.map((r) => <Rangee key={'r' + r.uid} titre={tr('prixPartout.regle.compte', { compte: r.nom || r.uid })} sousTitre={r.actif ? tr('prixPartout.regle.resume', { pct: r.pct, jours: r.jours }) : tr('prixPartout.regle.eteinte')} sousLignes={2}
            attrs={{ 'data-prix-regle': r.uid, 'data-prix-regle-actif': r.actif ? '1' : '0' }}/>)}
          <RangeeExtension action="automatisations" site={String(regles[0].uid).startsWith('lbc:') ? 'leboncoin' : 'vinted'} ids={regles.map((r) => String(r.uid))}/>
        </Groupe>
      ) : null}
      {minis.map((m) => <p key={m.cle} className="pp-mini" data-prix-mini={m.mini}>{tr('prixPartout.mini', { prix: eur(m.mini) })}</p>)}
    </Feuille>
  );
}
