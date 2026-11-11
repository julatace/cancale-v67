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
// Rien ici ne change une règle du moteur (CLAUDE.md §3).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { montant } from './format.js';
import { Numero } from './composants/Numero.jsx';
import JaugeActions, { useLignesActions } from './JaugeActions.jsx';
import { jaugeDuCompte, heureFr } from './jaugeActions.js';
import { requeteJsonBornee } from './requeteJsonBornee.js';
import { apercuMoteur, journalOffres, lignesSeuils, alertePlafond, journeeCalme, seuilsIllisibles, montantSeuil, LIBELLE_DECISION, RAISON_GARDE, DELAI_OFFRE_MIN, DELAI_OFFRE_MAX, OFFRES_PAR_VISITE } from './offresSures.js';
import { Bouton, Icon, Pourquoi, Segmente, askConfirm, toast, lireTout, sbAuth } from './App.jsx';
import './offres-auto.css';

const PAR_PAGE = 30;
const quand = (t) => {
  try {
    const d = new Date(t), auj = new Date();
    const hh = heureFr(t);
    if (d.toDateString() === auj.toDateString()) return hh;
    const hier = new Date(auj); hier.setDate(auj.getDate() - 1);
    if (d.toDateString() === hier.toDateString()) return `hier ${hh}`;
    return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })} ${hh}`;
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

export default function OffresAuto({ actif, basculer, refusMsg = '', setRefusMsg, annonces, numeros, offres, garde, comptes = [], uidOnglet = '', pause = null, freinsVus = [], poserSeuils, ouvrirSerie, eteindreOffres, PhotoVinted = null }) {
  const nomDe = React.useCallback((u) => { const a = (comptes || []).find((c) => String(c.uid) === String(u)); return a ? a.nom : ''; }, [comptes]);
  const uids = React.useMemo(() => new Set((comptes || []).map((c) => String(c.uid))), [comptes]);
  // 1. Le plafond du compte de l'onglet (la jauge, et l'alerte avant l'arrêt).
  const u = /^\d{1,20}$/.test(String(uidOnglet || '')) ? String(uidOnglet) : '';
  const [rowsJauge, tJauge] = useLignesActions(u, !!u);
  const alerte = u && rowsJauge !== undefined ? alertePlafond(jaugeDuCompte(rowsJauge, u, tJauge)) : null;
  const calme = journeeCalme(freinsVus);
  const pauseMin = pause && Number(pause.jusqua) > Date.now() ? Math.max(1, Math.ceil((Number(pause.jusqua) - Date.now()) / 60000)) : 0;
  // 2. L'aperçu (rien n'est envoyé).
  const apercu = apercuMoteur({ offres, numeros, garde, comptes: uids.size ? uids : null });
  // 3. Les paires.
  const [filtre, setFiltre] = React.useState('toutes');
  const [recherche, setRecherche] = React.useState('');
  const [max, setMax] = React.useState(PAR_PAGE);
  const [coches, setCoches] = React.useState(() => new Set());
  const lignes = lignesSeuils(annonces, numeros, { filtre, recherche });
  const illisibles = seuilsIllisibles(numeros);
  const nAvec = lignesSeuils(annonces, numeros, { filtre: 'avec' }).length;
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
    const ok = await askConfirm({ title: 'Tout arrêter ?', desc: 'Offres automatiques éteintes. Messages automatiques aux favoris arrêtés sur tous tes comptes Vinted.\n\nRien d’autre ne change. Tu rallumes quand tu veux.', ok: 'Tout arrêter', cancel: 'Annuler' });
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
    toast(r.ko.length ? `Offres auto éteintes · favoris : ${r.ko.length} compte${r.ko.length > 1 ? 's' : ''} pas confirmé${r.ko.length > 1 ? 's' : ''}` : 'Tout est arrêté');
  };
  const basculerCoche = (id) => setCoches((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const corrigerIllisibles = () => {
    const parId = new Map();
    for (const x of illisibles) { const o = parId.get(x.id) || { id: x.id }; o[x.champ] = montantSeuil(x.valeur); parId.set(x.id, o); }
    poserSeuils && poserSeuils([...parId.values()]);
  };

  return (
    <section className="vrm-oa" data-offres-auto-ecran={actif ? 'on' : 'off'}>
      {/* ── 1. L'INTERRUPTEUR ET LA SÉCURITÉ DU COMPTE ── */}
      <div className="vrm-oa-tete">
        <div className="vrm-oa-ligne">
          <span className="vrm-oa-icone" aria-hidden="true"><Icon name="tag" size={18}/></span>
          <div className="vrm-oa-texte">
            <b>Offres automatiques</b>
            <span data-oa-statut="">{actif ? `Allumées · ${nAvec} paire${nAvec > 1 ? 's' : ''} réglée${nAvec > 1 ? 's' : ''}` : 'Éteintes'}</span>
          </div>
          <button type="button" role="switch" aria-checked={!!actif} data-offres-auto-toggle={actif ? '1' : '0'} onClick={basculer} className="vrm-offres-auto-switch" aria-label="Acceptation automatique des offres">
            <span className="vrm-offres-auto-piste" aria-hidden="true"><span/></span>
          </button>
        </div>
        {actif && u ? <JaugeActions uid={u} nom={nomDe(u)}/> : null}
        {alerte ? <p className="vrm-oa-alerte" data-oa-plafond={alerte.niveau} role="status">{alerte.niveau === 'atteint' ? `${alerte.n}/${alerte.max} : VRM attend la prochaine heure.` : `${alerte.n}/${alerte.max} cette heure : ralentis tes clics.`}</p> : null}
        {pauseMin > 0 ? <p className="vrm-oa-alerte" data-oa-pause={pauseMin} role="status">Vinted a demandé de ralentir : rien ne part pendant {pauseMin} min.</p> : null}
        {calme && !pauseMin ? <p className="vrm-oa-alerte" data-oa-calme="" role="status">Vinted a freiné à {quand(calme.depuis)}. Journée calme conseillée.</p> : null}
        <div className="vrm-oa-arret">
          <Bouton variante="secondaire" data-oa-tout-arreter="" occupe={!!(arret && arret.enCours)} disabled={!!(arret && arret.enCours)} onClick={toutArreter}>Tout arrêter</Bouton>
          {arret && !arret.enCours ? <span className="vrm-oa-muet" data-oa-arret-ok={arret.ok.length} data-oa-arret-ko={arret.ko.length}>{arret.ko.length ? `Pas confirmé : ${arret.ko.map((c) => c.nom).join(', ')}. Réessaie.` : `Arrêté à ${heureFr(arret.at)}.`}</span>
            : <span className="vrm-oa-muet">Offres et favoris auto, d’un coup.</span>}
        </div>
      </div>

      {/* ── 2. CE QUE LE MOTEUR FERAIT ── */}
      <h3 className="vrm-oa-titre">{actif ? 'Offres en attente' : 'Si tu allumes'}</h3>
      <div className="vrm-oa-groupe" data-oa-apercu={apercu === undefined ? 'lecture' : apercu === null ? 'pas-su' : apercu.lignes.length}>
        {apercu === undefined ? <p className="vrm-oa-vide">Lecture des offres…</p>
          : apercu === null ? <p className="vrm-oa-vide">Offres pas lues : « — ». Ouvre Vinted sur ton compte.</p>
          : !apercu.lignes.length ? <p className="vrm-oa-vide">Aucune offre en attente.</p>
          : apercu.lignes.slice(0, 20).map((l) => (
            <div key={l.cle} className="vrm-oa-offre" data-oa-offre={l.cle} data-oa-decision={l.quoi}>
              <span className="vrm-oa-nom">{l.numero ? <Numero n={l.numero} taille="petit"/> : null}<span className="vrm-oa-titre-paire">{l.titre || 'Sans titre'}</span></span>
              <span className="vrm-oa-chiffres"><b>{montant(l.prix)}</b>{l.min != null ? <span> · dès {montant(l.min)}</span> : null}{l.refuse != null && l.quoi !== 'accepter' ? <span> · refus sous {montant(l.refuse)}</span> : null}</span>
              <span className={`vrm-oa-puce vrm-oa-puce-${l.quoi}`} data-oa-puce={l.quoi}>{LIBELLE_DECISION[l.quoi]}{l.quoi === 'garde' ? ` · ${RAISON_GARDE[l.raison] || 'pas vérifiée'}` : l.quoi === 'sans' && l.raison === 'illisible' ? ' · seuil illisible' : ''}</span>
              {nomDe(l.uid) ? <span className="vrm-oa-compte">{nomDe(l.uid)}</span> : null}
            </div>
          ))}
        {apercu && apercu.lignes.length > 20 ? <p className="vrm-oa-vide">Et {apercu.lignes.length - 20} autres.</p> : null}
        <div className="vrm-oa-pied" data-oa-rien-envoye="">Aperçu : rien n’est envoyé d’ici. <Pourquoi>Le moteur tourne dans l’extension, sur le compte ouvert dans l’onglet vinted.fr. Une offre au-dessus de « Accepter dès » est acceptée entre {DELAI_OFFRE_MIN} et {DELAI_OFFRE_MAX} min après qu’il l’a vue, tiré au hasard, {OFFRES_PAR_VISITE} au plus par visite, dans les 50 actions par heure. Sous « Refuser sous », elle est refusée (avec ton message s’il y en a un). Entre les deux, c’est toi qui négocies. Une paire vendue ailleurs n’est jamais acceptée.</Pourquoi></div>
      </div>

      {/* ── 3. TES PAIRES : LES SEUILS ── */}
      <h3 className="vrm-oa-titre">Tes paires</h3>
      {illisibles.length ? (
        <div className="vrm-oa-illisible" data-oa-illisibles={illisibles.length} role="status">
          <span>{illisibles.length} seuil{illisibles.length > 1 ? 's' : ''} avec virgule, ignoré{illisibles.length > 1 ? 's' : ''} par l’extension.</span>
          <Bouton variante="secondaire" data-oa-corriger="" onClick={corrigerIllisibles}>Corriger</Bouton>
        </div>
      ) : null}
      <div className="vrm-oa-outils">
        <Segmente label="Paires" value={filtre} onChange={(v) => { setFiltre(v); setMax(PAR_PAGE); }} options={[{ v: 'toutes', l: 'Toutes' }, { v: 'avec', l: 'Réglées' }, { v: 'sans', l: 'Sans seuil' }]}/>
        <input className="vrm-oa-cherche" type="search" value={recherche} onChange={(e) => { setRecherche(e.target.value); setMax(PAR_PAGE); }} placeholder="N° ou titre" aria-label="Chercher une paire"/>
      </div>
      <div className="vrm-oa-groupe" data-oa-paires={lignes.length}>
        {!Array.isArray(annonces) ? <p className="vrm-oa-vide">Annonces pas lues : « — ».</p>
          : !lignes.length ? <p className="vrm-oa-vide">{filtre === 'avec' ? 'Aucune paire réglée.' : 'Aucune paire.'}</p>
          : lignes.slice(0, max).map((l) => (
            <div key={l.id} className="vrm-oa-paire" data-oa-paire={l.id} data-oa-min={l.min == null ? '' : String(l.min)} data-oa-refus={l.refuse == null ? '' : String(l.refuse)} data-oa-incoherent={l.incoherent ? '1' : undefined}>
              <label className="vrm-oa-case"><input type="checkbox" checked={coches.has(l.id)} onChange={() => basculerCoche(l.id)} aria-label={`Choisir ${l.numero ? 'N°' + l.numero : l.titre || 'cette paire'}`}/></label>
              <span className="vrm-oa-paire-nom">
                <span className="vrm-oa-nom">{l.numero ? <Numero n={l.numero} taille="petit"/> : null}<span className="vrm-oa-titre-paire">{l.titre || 'Sans titre'}</span></span>
                <span className="vrm-oa-muet">{l.prix != null ? montant(l.prix) : '—'}{nomDe(l.uid) ? ` · ${nomDe(l.uid)}` : ''}{l.incoherent ? ' · refus au-dessus du mini' : ''}</span>
              </span>
              <span className="vrm-oa-seuils">
                <ChampSeuil label="Accepter dès" data="min" valeur={l.minBrut} onPoser={(v) => poserSeuils && poserSeuils([{ id: l.id, min: v }])}/>
                <ChampSeuil label="Refuser sous" data="refuse" valeur={l.refuseBrut} onPoser={(v) => poserSeuils && poserSeuils([{ id: l.id, refuse: v }])}/>
              </span>
            </div>
          ))}
        {Array.isArray(annonces) && lignes.length > max ? <button type="button" className="vrm-oa-plus" data-oa-plus="" onClick={() => setMax((m) => m + PAR_PAGE)}>Voir {Math.min(PAR_PAGE, lignes.length - max)} de plus</button> : null}
      </div>
      {coches.size > 0 ? (
        <div className="vrm-oa-serie" data-oa-serie={coches.size}>
          <Bouton variante="discret" onClick={() => setCoches(new Set())}>Décocher</Bouton>
          <Bouton variante="primaire" data-oa-serie-ouvrir={coches.size} onClick={() => ouvrirSerie && ouvrirSerie([...coches])}>Régler en série · {coches.size}</Bouton>
        </div>
      ) : null}

      {/* ── 4. HISTORIQUE (noté par l'extension) ── */}
      <h3 className="vrm-oa-titre">Historique</h3>
      <div className="vrm-oa-groupe" data-oa-historique={histo === undefined ? 'lecture' : histo === null ? 'pas-su' : histo.length}>
        {histo === undefined ? <p className="vrm-oa-vide">Lecture…</p>
          : histo === null ? <p className="vrm-oa-vide">Historique pas lu : « — ». <button type="button" className="vrm-pied-lien" onClick={lireJournal}>Réessayer</button></p>
          : !histo.length ? <p className="vrm-oa-vide">Aucune offre notée par l’extension.</p>
          : histo.map((h) => { const f = h.item ? (numeros || {})[h.item] : null; return (
            <div key={`${h.uid}:${h.t}:${h.tx || ''}:${h.sorte}`} className="vrm-oa-histo" data-oa-histo={h.sorte} data-oa-histo-auto={h.auto ? '1' : '0'}>
              <span className={`vrm-oa-puce vrm-oa-puce-${h.sorte === 'acceptee' ? 'accepter' : 'refuser'}`}>{h.sorte === 'acceptee' ? 'Acceptée' : 'Refusée'}{h.auto ? ' (auto)' : ''}</span>
              <span className="vrm-oa-nom">{f && f.numero ? <Numero n={f.numero} taille="petit"/> : null}<span className="vrm-oa-titre-paire">{(h.item && titreDe.get(h.item)) || (f && f.title) || (h.tx ? `commande ${h.tx}` : '')}</span></span>
              <span className="vrm-oa-chiffres">{h.prix != null ? <b>{montant(h.prix)}</b> : '—'} · {quand(h.t)}{nomDe(h.uid) ? ` · ${nomDe(h.uid)}` : ''}</span>
            </div>
          ); })}
        <p className="vrm-oa-pied">Noté par l’extension au moment du geste.</p>
      </div>

      {/* ── 5. LE MESSAGE DE REFUS (son texte, vide par défaut) ── */}
      <h3 className="vrm-oa-titre">Message de refus</h3>
      <div className="vrm-oa-groupe">
        <textarea className="vrm-oa-refus" data-oa-refus-msg="" rows={2} value={refusMsg} onChange={(e) => setRefusMsg && setRefusMsg(e.target.value)} placeholder="Vide : refus sans message." aria-label="Message envoyé quand VRM refuse une offre"/>
      </div>
    </section>
  );
}
