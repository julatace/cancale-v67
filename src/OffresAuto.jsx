// ═══════════════════════════════════════════════════════════════════════════
// MESSAGES → FAVORIS & OFFRES → « OFFRES AUTO » (11 nov., lot DJ8)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Pour les offres automatiques je pense que tu peux faire mieux. Tu
// peux regarder comment ne jamais te faire ban stp. »
// Un écran, de haut en bas :
//   1. l'interrupteur (le MÊME que la carte d'Annonces → Outils : éteint par
//      défaut, confirmation qui dit le risque), la jauge 50/h du compte de
//      l'onglet, l'alerte « proche du plafond », la journée calme conseillée
//      après un frein de Vinted, et « Tout arrêter » ;
//   2. « Si une offre arrive maintenant » : les offres EN ATTENTE et ce que le
//      moteur en ferait (src/offresSures.js, `decisionMoteur` — la même règle
//      que l'extension, comparée par scripts/audit-offres-sures.cjs). RIEN n'est
//      envoyé d'ici : c'est un aperçu ;
//   3. « Tes paires » : « Accepter dès » et « Refuser sous » par paire, modifiables
//      en place ou en série (la feuille « Prix mini » existante) ;
//   4. « Historique » : les offres acceptées / refusées NOTÉES par l'extension
//      (lot G, `journal_vrm_*`), jamais déduites ;
//   5. le message de refus (SON texte, vide par défaut).
// (11 nov., lot prix-mini) Refait : la règle en trois lignes sous l'interrupteur, « Prix
// mini manquants » (src/PrixMiniManquants.jsx) juste dessous, tous les textes par tr().
// Rien ici ne change une règle du moteur (CLAUDE.md §3).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { montant } from './format.js';
import { motsVendeur } from './profilVendeur.js';
import { Numero } from './composants/Numero.jsx';
import JaugeActions, { useLignesActions } from './JaugeActions.jsx';
import { jaugeDuCompte, heureFr } from './jaugeActions.js';
import { requeteJsonBornee } from './requeteJsonBornee.js';
import { apercuMoteur, journalOffres, lignesSeuils, alertePlafond, journeeCalme, seuilsIllisibles, montantSeuil, LIBELLE_DECISION, RAISON_GARDE, DELAI_OFFRE_MIN, DELAI_OFFRE_MAX, OFFRES_PAR_VISITE } from './offresSures.js';
import { Bouton, Icon, Pourquoi, Segmente, askConfirm, toast, lireTout, sbAuth } from './App.jsx';
import PrixMiniManquants from './PrixMiniManquants.jsx';
import { tr, localeCourante } from './i18n/index.js';
import './offres-auto.css';
import AutresVersions from './AutresVersions.jsx';
// (intégration g1) prix-mini (textes par tr) × vocabulaire-article (« paire » seulement pour un vendeur
// Sneakers) : les clés qui nomment l'article ont une variante `.art`, choisie par le vocabulaire du vendeur.
const tv = (k, p) => tr(motsVendeur().nom === 'paire' ? k : k + '.art', p);
import { erreurMessageAuto } from './messageSur.js';

const PAR_PAGE = 30;
const quand = (t) => {
  try {
    const d = new Date(t), auj = new Date();
    const hh = heureFr(t);
    if (d.toDateString() === auj.toDateString()) return hh;
    const hier = new Date(auj); hier.setDate(auj.getDate() - 1);
    if (d.toDateString() === hier.toDateString()) return `${tr('commun.hier')} ${hh}`;
    return `${d.toLocaleDateString(localeCourante(), { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })} ${hh}`;
  } catch (_) { return ''; }
};

// Un seuil modifiable en place : la saisie s'écrit au départ du champ (ou Entrée),
// normalisée pour que le MOTEUR la lise (« 45,5 » ⇒ « 45.5 »).
function ChampSeuil({ valeur, onPoser, label, data }) {
  // Affiché à la française (« 45,5 »), écrit avec un point (« 45.5 ») : le moteur le lit.
  const aff = (x) => String(x || '').replace('.', ',');
  const [v, setV] = React.useState(aff(valeur));
  React.useEffect(() => { setV(aff(valeur)); }, [valeur]);
  const poser = () => { const n = montantSeuil(v); if (n !== montantSeuil(valeur || '')) onPoser(n); else setV(aff(valeur)); };
  return (
    <label className="vrm-oa-seuil" data-oa-seuil={data}>
      <span className="vrm-oa-seuil-mot">{label}</span>
      <span className="vrm-oa-seuil-champ">
        <input value={v} inputMode="decimal" enterKeyHint="done" placeholder="—" aria-label={label}
          onChange={(e) => setV(e.target.value)} onBlur={poser} onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}/>
        <span aria-hidden="true">€</span>
      </span>
    </label>
  );
}

export default function OffresAuto({ actif, virguleLue = false, basculer, refusMsg = '', setRefusMsg, refusVariantes = [], setRefusVariantes, variantesOk = true, annonces, numeros, offres, lireGarde = () => null, comptes = [], uidOnglet = '', pause = null, freinsVus = [], poserSeuils, ouvrirSerie, eteindreOffres, PhotoVinted = null }) {
  const nomDe = React.useCallback((u) => { const a = (comptes || []).find((c) => String(c.uid) === String(u)); return a ? a.nom : ''; }, [comptes]);
  const uids = React.useMemo(() => new Set((comptes || []).map((c) => String(c.uid))), [comptes]);
  // 1. Le plafond du compte de l'onglet (la jauge, et l'alerte avant l'arrêt).
  const u = /^\d{1,20}$/.test(String(uidOnglet || '')) ? String(uidOnglet) : '';
  const [rowsJauge, tJauge] = useLignesActions(u, !!u);
  const alerte = u && rowsJauge !== undefined ? alertePlafond(jaugeDuCompte(rowsJauge, u, tJauge)) : null;
  const calme = journeeCalme(freinsVus);
  const pauseMin = pause && Number(pause.jusqua) > Date.now() ? Math.max(1, Math.ceil((Number(pause.jusqua) - Date.now()) / 60000)) : 0;
  // 2. L'aperçu (rien n'est envoyé). La garde est republiée par l'app (src/offresGarde.js) :
  //    relue à chaque écriture de `vinted_offres_garde` (`vrm:save`), jamais figée.
  const [garde, setGarde] = React.useState(() => lireGarde());
  React.useEffect(() => {
    setGarde(lireGarde());
    const f = (e) => { if (!e || !e.detail || e.detail.k === 'vinted_offres_garde') setGarde(lireGarde()); };
    window.addEventListener('vrm:save', f);
    return () => window.removeEventListener('vrm:save', f);
  }, [lireGarde]);
  const apercu = apercuMoteur({ offres, numeros, garde, comptes: uids.size ? uids : null, virgule: virguleLue === true });
  // 3. Les paires.
  const [filtre, setFiltre] = React.useState('toutes');
  const [recherche, setRecherche] = React.useState('');
  const [max, setMax] = React.useState(PAR_PAGE);
  const [coches, setCoches] = React.useState(() => new Set());
  const lignes = lignesSeuils(annonces, numeros, { filtre, recherche, virgule: virguleLue === true });
  const illisibles = seuilsIllisibles(numeros);
  const nAvec = lignesSeuils(annonces, numeros, { filtre: 'avec', virgule: virguleLue === true }).length;
  // 4. L'historique : les gestes notés par l'extension (une lecture, projetée).
  const [rowsJournal, setRowsJournal] = React.useState(undefined);
  const lireJournal = React.useCallback(() => {
    setRowsJournal(undefined);
    lireTout('id=like.journal_vrm_*&select=id,e:data->e').then((r) => setRowsJournal(Array.isArray(r) ? r : null), () => setRowsJournal(null));
  }, []);
  React.useEffect(() => { lireJournal(); }, [lireJournal]);
  const histo = journalOffres(rowsJournal, { uids: uids.size ? uids : null });
  const titreDe = React.useMemo(() => new Map((Array.isArray(annonces) ? annonces : []).map((x) => [String(x.id), x.titre || ''])), [annonces]);
  // 5. « Tout arrêter » : offres auto + mode auto des favoris (et sa file) sur chaque compte.
  const [arret, setArret] = React.useState(null);
  const toutArreter = async () => {
    const ok = await askConfirm({ title: tr('oa.arret.titre'), desc: tr('oa.arret.desc'), ok: tr('oa.toutArreter'), cancel: tr('oa.annuler') });
    if (!ok) return;
    eteindreOffres && eteindreOffres();
    const liste = (comptes || []).filter((c) => /^\d{1,20}$/.test(String(c.uid)));
    setArret({ at: Date.now(), enCours: true, ok: [], ko: [] });
    const res = await Promise.all(liste.map(async (c) => {
      try {
        const url = `/api/compte?mode=favoris&uid=${encodeURIComponent(c.uid)}`;
        const h = { ...sbAuth(), 'Content-Type': 'application/json' };
        const a = await requeteJsonBornee(url, { method: 'POST', headers: h, cache: 'no-store', body: JSON.stringify({ action: 'auto_stop' }) });
        const b = await requeteJsonBornee(url, { method: 'POST', headers: h, cache: 'no-store', body: JSON.stringify({ action: 'arreter' }) });
        return (a.ok && a.json && a.json.ok && b.ok && b.json && b.json.ok) ? { ok: c } : { ko: c };
      } catch (_) { return { ko: c }; }
    }));
    const r = { at: Date.now(), enCours: false, ok: res.filter((x) => x.ok).map((x) => x.ok), ko: res.filter((x) => x.ko).map((x) => x.ko) };
    setArret(r);
    try { window.dispatchEvent(new CustomEvent('vrm:favoris-auto', { detail: {} })); } catch (_) {}
    toast(r.ko.length ? tr('oa.arret.toastKo', { n: r.ko.length }) : tr('oa.arret.toastOk'));
  };
  const basculerCoche = (id) => setCoches((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const corrigerIllisibles = () => {
    const parId = new Map();
    for (const x of illisibles) { const o = parId.get(x.id) || { id: x.id }; o[x.champ] = montantSeuil(x.valeur); parId.set(x.id, o); }
    poserSeuils && poserSeuils([...parId.values()]);
  };

  return (
    <section className="vrm-oa" data-offres-auto-ecran={actif ? 'on' : 'off'}>
      {/* ── 1. L'INTERRUPTEUR, LA RÈGLE EN TROIS LIGNES, LA SÉCURITÉ DU COMPTE ── */}
      <div className="vrm-oa-tete">
        <div className="vrm-oa-ligne">
          <span className={'vrm-oa-icone' + (actif ? ' is-on' : '')} aria-hidden="true"><Icon name="tag" size={20}/></span>
          <div className="vrm-oa-texte">
            <b>{tr('oa.titre')}</b>
            <span data-oa-statut="">{actif ? tv('oa.allumees', { n: nAvec }) : tr('oa.eteintes')}</span>
          </div>
          <button type="button" role="switch" aria-checked={!!actif} data-offres-auto-toggle={actif ? '1' : '0'} onClick={basculer} className="vrm-offres-auto-switch" aria-label={tr('oa.interrupteur')}>
            <span className="vrm-offres-auto-piste" aria-hidden="true"><span/></span>
          </button>
        </div>
        <ul className="vrm-oa-regles" data-oa-regles="">
          <li><span className="vrm-oa-regle-icone is-oui" aria-hidden="true"><Icon name="check" size={14}/></span>{tr('oa.regle.accepte', { de: DELAI_OFFRE_MIN, a: DELAI_OFFRE_MAX })}</li>
          <li><span className="vrm-oa-regle-icone" aria-hidden="true"><Icon name="close" size={14}/></span>{tr('oa.regle.refuse')}</li>
          <li><span className="vrm-oa-regle-icone" aria-hidden="true"><Icon name="chat" size={14}/></span>{tr('oa.regle.toi')}</li>
        </ul>
        {actif && u ? <JaugeActions uid={u} nom={nomDe(u)}/> : null}
        {alerte ? <p className="vrm-oa-alerte" data-oa-plafond={alerte.niveau} role="status">{alerte.niveau === 'atteint' ? tr('oa.plafond.atteint', { n: alerte.n, max: alerte.max }) : tr('oa.plafond.proche', { n: alerte.n, max: alerte.max })}</p> : null}
        {pauseMin > 0 ? <p className="vrm-oa-alerte" data-oa-pause={pauseMin} role="status">{tr('oa.pause', { n: pauseMin })}</p> : null}
        {calme && !pauseMin ? <p className="vrm-oa-alerte" data-oa-calme="" role="status">{tr('oa.calme', { heure: quand(calme.depuis) })}</p> : null}
        <div className="vrm-oa-arret">
          <Bouton variante="secondaire" data-oa-tout-arreter="" occupe={!!(arret && arret.enCours)} disabled={!!(arret && arret.enCours)} onClick={toutArreter}>{tr('oa.toutArreter')}</Bouton>
          {arret && !arret.enCours ? <span className="vrm-oa-muet" data-oa-arret-ok={arret.ok.length} data-oa-arret-ko={arret.ko.length}>{arret.ko.length ? tr('oa.arret.ko', { noms: arret.ko.map((c) => c.nom).join(', ') }) : tr('oa.arret.ok', { heure: heureFr(arret.at) })}</span>
            : <span className="vrm-oa-muet">{tr('oa.arret.quoi')}</span>}
        </div>
      </div>

      {/* ── 2. PRIX MINI MANQUANTS (lot prix-mini) : la liste et la saisie en série ── */}
      <PrixMiniManquants annonces={annonces} numeros={numeros} virgule={virguleLue === true} poserSeuils={poserSeuils} PhotoVinted={PhotoVinted} nomDe={nomDe}/>

      {/* ── 3. CE QUE LE MOTEUR FERAIT ── */}
      <h3 className="vrm-oa-titre">{actif ? tr('oa.attente.titre') : tr('oa.attente.siAllume')}</h3>
      <div className="vrm-oa-groupe" data-oa-apercu={apercu === undefined ? 'lecture' : apercu === null ? 'pas-su' : apercu.lignes.length}>
        {apercu === undefined ? <p className="vrm-oa-vide">{tr('oa.attente.lecture')}</p>
          : apercu === null ? <p className="vrm-oa-vide">{tr('oa.attente.pasLues')}</p>
          : !apercu.lignes.length ? <p className="vrm-oa-vide">{tr('oa.attente.aucune')}</p>
          : apercu.lignes.slice(0, 20).map((l) => (
            <div key={l.cle} className="vrm-oa-offre" data-oa-offre={l.cle} data-oa-decision={l.quoi}>
              <span className="vrm-oa-nom">{l.numero ? <Numero n={l.numero} taille="petit"/> : null}<span className="vrm-oa-titre-paire">{l.titre || tr('oa.sansTitre')}</span></span>
              <span className="vrm-oa-chiffres"><b>{montant(l.prix)}</b>{l.min != null ? <span> · {tr('oa.des', { prix: montant(l.min) })}</span> : null}{l.refuse != null && l.quoi !== 'accepter' ? <span> · {tr('oa.refusSous', { prix: montant(l.refuse) })}</span> : null}</span>
              <span className={`vrm-oa-puce vrm-oa-puce-${l.quoi}`} data-oa-puce={l.quoi}>{LIBELLE_DECISION[l.quoi] ? tr(`oa.decision.${l.quoi}`, { de: DELAI_OFFRE_MIN, a: DELAI_OFFRE_MAX }) : ''}{l.quoi === 'garde' ? ` · ${RAISON_GARDE[l.raison] ? tr(`oa.garde.${l.raison}`) : tr('oa.pasVerifiee')}` : l.quoi === 'sans' && l.raison === 'illisible' ? ` · ${tr('oa.seuilIllisible')}` : ''}</span>
              {nomDe(l.uid) ? <span className="vrm-oa-compte">{nomDe(l.uid)}</span> : null}
            </div>
          ))}
        {apercu && apercu.lignes.length > 20 ? <p className="vrm-oa-vide">{tr('oa.attente.autres', { n: apercu.lignes.length - 20 })}</p> : null}
        <div className="vrm-oa-pied" data-oa-rien-envoye="">{tr('oa.apercu')} <Pourquoi>{tv('oa.apercu.pourquoi', { de: DELAI_OFFRE_MIN, a: DELAI_OFFRE_MAX, n: OFFRES_PAR_VISITE })}</Pourquoi></div>
      </div>

      {/* ── 4. TES PAIRES : LES SEUILS ── */}
      <h3 className="vrm-oa-titre">{tv('oa.paires.titre')}</h3>
      {illisibles.length ? (
        <div className="vrm-oa-illisible" data-oa-illisibles={illisibles.length} role="status">
          <span>{virguleLue === true ? tr('oa.virgule.point', { n: illisibles.length }) : tr('oa.virgule.ignore', { n: illisibles.length })}</span>
          <Bouton variante="secondaire" data-oa-corriger="" onClick={corrigerIllisibles}>{tr('oa.corriger')}</Bouton>
        </div>
      ) : null}
      <div className="vrm-oa-outils">
        <Segmente label={tv('oa.paires.filtre')} value={filtre} onChange={(v) => { setFiltre(v); setMax(PAR_PAGE); }} options={[{ v: 'toutes', l: tr('oa.paires.toutes') }, { v: 'avec', l: tr('oa.paires.reglees') }, { v: 'sans', l: tr('oa.paires.sans') }]}/>
        <input className="vrm-oa-cherche" type="search" value={recherche} onChange={(e) => { setRecherche(e.target.value); setMax(PAR_PAGE); }} placeholder={tr('oa.paires.cherche')} aria-label={tv('oa.paires.chercheLabel')}/>
      </div>
      <div className="vrm-oa-groupe" data-oa-paires={lignes.length}>
        {!Array.isArray(annonces) ? <p className="vrm-oa-vide">{tr('oa.paires.pasLues')}</p>
          : !lignes.length ? <p className="vrm-oa-vide">{filtre === 'avec' ? tv('oa.paires.aucuneReglee') : tv('oa.paires.aucune')}</p>
          : lignes.slice(0, max).map((l) => (
            <div key={l.id} className="vrm-oa-paire" data-oa-paire={l.id} data-oa-min={l.min == null ? '' : String(l.min)} data-oa-refus={l.refuse == null ? '' : String(l.refuse)} data-oa-incoherent={l.incoherent ? '1' : undefined}>
              <label className="vrm-oa-case"><input type="checkbox" checked={coches.has(l.id)} onChange={() => basculerCoche(l.id)} aria-label={tr('oa.paires.choisir', { quoi: l.numero ? 'N°' + l.numero : l.titre || tr('oa.sansTitre') })}/></label>
              <span className="vrm-oa-paire-nom">
                <span className="vrm-oa-nom">{l.numero ? <Numero n={l.numero} taille="petit"/> : null}<span className="vrm-oa-titre-paire">{l.titre || tr('oa.sansTitre')}</span></span>
                <span className="vrm-oa-muet">{l.prix != null ? montant(l.prix) : '—'}{nomDe(l.uid) ? ` · ${nomDe(l.uid)}` : ''}{l.incoherent ? ` · ${tr('oa.paires.incoherent')}` : ''}</span>
              </span>
              <span className="vrm-oa-seuils">
                <ChampSeuil label={tr('oa.accepterDes')} data="min" valeur={l.minBrut} onPoser={(v) => poserSeuils && poserSeuils([{ id: l.id, min: v }])}/>
                <ChampSeuil label={tr('oa.refuserSous')} data="refuse" valeur={l.refuseBrut} onPoser={(v) => poserSeuils && poserSeuils([{ id: l.id, refuse: v }])}/>
              </span>
            </div>
          ))}
        {Array.isArray(annonces) && lignes.length > max ? <button type="button" className="vrm-oa-plus" data-oa-plus="" onClick={() => setMax((m) => m + PAR_PAGE)}>{tr('oa.voirPlus', { n: Math.min(PAR_PAGE, lignes.length - max) })}</button> : null}
      </div>
      {coches.size > 0 ? (
        <div className="vrm-oa-serie" data-oa-serie={coches.size}>
          <Bouton variante="discret" onClick={() => setCoches(new Set())}>{tr('oa.decocher')}</Bouton>
          <Bouton variante="primaire" data-oa-serie-ouvrir={coches.size} onClick={() => ouvrirSerie && ouvrirSerie([...coches])}>{tr('oa.enSerie', { n: coches.size })}</Bouton>
        </div>
      ) : null}

      {/* ── 5. HISTORIQUE (noté par l'extension) ── */}
      <h3 className="vrm-oa-titre">{tr('oa.histo.titre')}</h3>
      <div className="vrm-oa-groupe" data-oa-historique={histo === undefined ? 'lecture' : histo === null ? 'pas-su' : histo.length}>
        {histo === undefined ? <p className="vrm-oa-vide">{tr('oa.histo.lecture')}</p>
          : histo === null ? <p className="vrm-oa-vide">{tr('oa.histo.pasLu')} <button type="button" className="vrm-pied-lien" onClick={lireJournal}>{tr('commun.reessayer')}</button></p>
          : !histo.length ? <p className="vrm-oa-vide">{tr('oa.histo.aucune')}</p>
          : histo.map((h) => { const f = h.item ? (numeros || {})[h.item] : null; return (
            <div key={`${h.uid}:${h.t}:${h.tx || ''}:${h.sorte}`} className="vrm-oa-histo" data-oa-histo={h.sorte} data-oa-histo-auto={h.auto ? '1' : '0'}>
              <span className={`vrm-oa-puce vrm-oa-puce-${h.sorte === 'acceptee' ? 'accepter' : 'refuser'}`}>{h.sorte === 'acceptee' ? tr('oa.histo.acceptee') : tr('oa.histo.refusee')}{h.auto ? ` ${tr('oa.histo.auto')}` : ''}{h.variante ? ' · ' + tr('oa.histo.version', { n: h.variante }) : ''}</span>
              <span className="vrm-oa-nom">{f && f.numero ? <Numero n={f.numero} taille="petit"/> : null}<span className="vrm-oa-titre-paire">{(h.item && titreDe.get(h.item)) || (f && f.title) || (h.tx ? tr('oa.histo.commande', { tx: h.tx }) : '')}</span></span>
              <span className="vrm-oa-chiffres">{h.prix != null ? <b>{montant(h.prix)}</b> : '—'} · {quand(h.t)}{nomDe(h.uid) ? ` · ${nomDe(h.uid)}` : ''}</span>
            </div>
          ); })}
        <p className="vrm-oa-pied">{tr('oa.histo.pied')}</p>
      </div>

      {/* ── 6. LE MESSAGE DE REFUS (son texte, vide par défaut) ── */}
      <h3 className="vrm-oa-titre">{tr('oa.refus.titre')}</h3>
      <div className="vrm-oa-groupe">
        <textarea className="vrm-oa-refus" data-oa-refus-msg="" rows={2} value={refusMsg} onChange={(e) => setRefusMsg && setRefusMsg(e.target.value)} placeholder={tr('oa.refus.vide')} aria-label={tr('oa.refus.label')}/>
        {/* (12 nov., ext. 5.369) Ses autres versions : une au hasard, jamais celle du refus précédent. */}
        {setRefusVariantes ? <AutresVersions nom="refus" premier={refusMsg} variantes={refusVariantes} onChange={setRefusVariantes} extOk={variantesOk}/> : null}
        {erreurMessageAuto(refusMsg) ? <p role="status" data-message-auto-refuse="" style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--vrm-warn, #B25000)' }}>{erreurMessageAuto(refusMsg)}</p> : null}
      </div>
    </section>
  );
}
