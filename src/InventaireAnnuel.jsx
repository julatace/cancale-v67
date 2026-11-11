// ════════════════════════════════════════════════════════════════════════════
//  L'INVENTAIRE DE FIN D'ANNÉE — Stock → « Inventaire de fin d'année » (10 nov., lot W)
//  La valeur au prix d'achat SAISI des paires présentes (au 31 décembre ou à la
//  date choisie), la vérification dans les cartons (le mode inventaire du Stock,
//  caméra ou clavier), les écarts listés, l'export daté PDF / CSV.
//  ⚠️ Aucune règle ici : liste, total, écarts et exports sont dans
//     src/inventaireAnnuel.js. La liste est PUBLIÉE par le composant qui tient
//     `annoncesPresentes` (App.jsx) ; cet écran la lit, jamais ne la refait.
//  ⚠️ Rien n'est changé : aucun numéro, aucune fiche, aucune annonce.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { texteValeurStock, eurosStock } from './coutVente.js';
import {
  lireInventaireAnnuel, EVT_INVENTAIRE_ANNUEL, CLE_INVENTAIRE_ANNUEL, ecartsInventaire, sessionAComparer,
  dateParDefaut, phraseDate, csvInventaire, pdfInventaire, nomFichier,
} from './inventaireAnnuel.js';
import { normaliserInventaire, fusionnerInventaire, inventaireVide } from './inventaire.js';
import { Numero } from './composants/Numero.jsx';
import './styles-inventaire-annuel.css';

const lireLocal = (owner) => { try { const v = localStorage.getItem('vrm_inventaire_local_' + (owner || 'anon')); return v ? normaliserInventaire(JSON.parse(v)) : inventaireVide(); } catch (_) { return inventaireVide(); } };
const telecharger = (contenu, nom, type) => {
  const blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
};

// La liste publiée, pour CE compte VRM ; suit chaque publication.
export function useInventaireAnnuel(owner, cle) {
  const [inv, setInv] = React.useState(() => lireInventaireAnnuel(owner, cle));
  React.useEffect(() => {
    const relire = () => setInv(lireInventaireAnnuel(owner, cle));
    relire();
    const surStockage = (e) => { if (!e || e.key == null || e.key === CLE_INVENTAIRE_ANNUEL) relire(); };
    window.addEventListener(EVT_INVENTAIRE_ANNUEL, relire); window.addEventListener('storage', surStockage);
    return () => { window.removeEventListener(EVT_INVENTAIRE_ANNUEL, relire); window.removeEventListener('storage', surStockage); };
  }, [owner, cle]);
  return inv;
}

// Les N° vus dans les cartons : la copie de cet appareil, fusionnée avec la ligne du nuage.
function useVerification(owner, lire) {
  const [d, setD] = React.useState(() => lireLocal(owner));
  const [relu, setRelu] = React.useState(lire ? 'lecture' : 'ok');
  React.useEffect(() => {
    let vivant = true;
    const go = async () => {
      const local = lireLocal(owner);
      if (!lire) { setD(local); return; }
      const r = await lire().catch(() => null);
      if (!vivant) return;
      if (r && r.data) { setD(fusionnerInventaire(r.data, local)); setRelu('ok'); } else { setD(local); setRelu('ko'); }
    };
    go();
    window.addEventListener('vrm:inventaire', go);
    return () => { vivant = false; window.removeEventListener('vrm:inventaire', go); };
  }, [owner, lire]);
  return { session: sessionAComparer(d), relu };
}

const plur = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
const jour = (t) => { try { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); } catch (_) { return ''; } };
const MAX_LISTE = 40;

export function InventaireAnnuel({ owner = '', cle, Feuille, onFermer, onSaisirPrix = null, onVerifier = null, onAnnonces = null, lire = null, maintenant = null }) {
  const inv = useInventaireAnnuel(owner, cle);
  const { session, relu } = useVerification(owner, lire);
  const [date, setDate] = React.useState(() => dateParDefaut(maintenant || Date.now()));
  const [tout, setTout] = React.useState({});
  const [exp, setExp] = React.useState('');
  const ecarts = React.useMemo(() => (inv ? ecartsInventaire(inv.lignes, session, cle) : null), [inv, session, cle]);
  const trouve = React.useMemo(() => new Set(ecarts ? ecarts.trouvees.map((l) => l.id) : []), [ecarts]);
  const t = inv ? texteValeurStock(inv.v, { partiel: inv.partiel }) : null;
  const pct = inv && inv.v.n ? Math.round((inv.v.nPrix / inv.v.n) * 100) : 0;
  const nCochables = inv ? inv.lignes.filter((l) => l.cle).length : 0;

  const exporter = async (q) => {
    if (!inv || exp) return;
    setExp(q);
    try {
      if (q === 'csv') telecharger(csvInventaire(inv, { date, ecarts }), nomFichier(date, 'csv'), 'text/csv;charset=utf-8');
      else telecharger(new Blob([await pdfInventaire(inv, { date, ecarts })], { type: 'application/pdf' }), nomFichier(date, 'pdf'), 'application/pdf');
    } catch (_) { /* rien à faire de plus : le bouton redevient disponible */ }
    setExp('');
  };

  const liste = (id, titre, l, rendu, aide, ton) => (l.length ? (() => {
    const montre = tout[id] ? l : l.slice(0, MAX_LISTE);
    return (
      <section className="vrm-ia-ecart" data-ia-ecart={id} data-ia-ecart-n={l.length}>
        <h4><span>{titre}</span><b data-ia-ton={ton || ''}>{l.length}</b></h4>
        {aide ? <p className="vrm-ia-aide">{aide}</p> : null}
        <ul>{montre.map(rendu)}</ul>
        {l.length > montre.length ? <button type="button" className="vrm-ia-lien" onClick={() => setTout((x) => ({ ...x, [id]: true }))}>Voir les {l.length}</button> : null}
      </section>);
  })() : null);
  const ligneEcart = (l) => (
    <li key={l.id} className="vrm-ia-l" data-ia-ecart-ligne={l.cle || l.id}>
      {l.numero ? <Numero n={l.numero} taille="petit"/> : <span className="vrm-ia-sans-n">sans N°</span>}
      <span className="vrm-ia-l-t">{l.titre || 'Sans titre'}{l.compte ? <small>{l.compte}</small> : null}</span>
    </li>);

  const verif = !inv ? null : (
    <section className="vrm-ia-carte" data-ia-verif={ecarts ? 'oui' : 'non'} aria-label="Vérification du rangement">
      <div className="vrm-ia-tete">Dans ton rangement</div>
      {ecarts ? (
        <div className="vrm-ia-montant" data-ia-trouvees={ecarts.trouvees.length} data-ia-cochables={nCochables}><b>{ecarts.trouvees.length}</b><span> trouvées sur {nCochables}</span></div>
      ) : <div className="vrm-ia-montant"><b>—</b><span> pas encore vérifié</span></div>}
      {session ? <p className="vrm-ia-sous">Vérification du {jour(Number(session.finAt) || Number(session.debut) || 0)}{relu === 'ko' ? ' · cet appareil seulement' : ''}</p> : null}
      {onVerifier ? <button type="button" className="vrm-b vrm-b-secondaire vrm-ia-large" data-ia-verifier="" onClick={onVerifier}>Je vérifie mon rangement</button> : null}
      {ecarts ? (<>
        {liste('doublons', 'Deux paires sous un même N°', ecarts.doublons.map((k) => ({ id: k, cle: k, numero: k, titre: 'Porté par deux paires', compte: '' })),
          (l) => <li key={l.id} className="vrm-ia-l vrm-ia-double" data-ia-ecart-ligne={l.cle}><Numero n={l.numero} taille="petit" etat="doublon"/><span className="vrm-ia-l-t">Porté par deux paires</span></li>, null, 'doublon')}
        {liste('pas-trouvees', 'Pas trouvées', ecarts.pasTrouvees, ligneEcart, 'Dans VRM, pas vues au rangement.', 'geste')}
        {liste('hors-liste', 'Trouvées, pas dans la liste', ecarts.horsListe.map((k) => ({ id: k, cle: k, numero: k, titre: '', compte: '' })),
          (l) => <li key={l.id} className="vrm-ia-l" data-ia-ecart-ligne={l.cle}><Numero n={l.numero} taille="petit"/><span className="vrm-ia-l-t">Vue au rangement</span></li>,
          inv.partiel ? 'Une lecture d’annonces manque : vérifie avant de conclure.' : 'Vues au rangement, absentes de la liste.', 'geste')}
        {ecarts.sansNumero.length ? <p className="vrm-ia-aide" data-ia-sans-numero={ecarts.sansNumero.length}>{plur(ecarts.sansNumero.length, 'paire', 'paires')} sans N° : impossible à cocher.</p> : null}
        <p className="vrm-ia-aide">Rien n’est changé dans VRM.</p>
      </>) : null}
    </section>);

  return (
    <Feuille onClose={onFermer} titre="Inventaire de fin d’année" sousTitre="Ton stock au prix d’achat" maxWidth={600} data-inventaire-annuel="" className="vrm-ia-feuille">
      <div className="vrm-ia" data-ia-etat={inv ? (inv.v.centimes == null ? 'passu' : 'ok') : 'jamais'}>
        <label className="vrm-ia-date">
          <span>Au</span>
          <input type="date" value={date} onChange={(e) => { if (e.target.value) setDate(e.target.value); }} data-ia-date="" aria-label="Date de l’inventaire"/>
        </label>
        <p className="vrm-ia-lue" data-ia-lue={inv ? inv.at : 0}>{phraseDate(date, inv ? inv.at : 0)}</p>

        <section className="vrm-ia-carte" aria-label="Valeur du stock" data-ia-valeur={inv ? (inv.v.centimes == null ? 'passu' : String(inv.v.centimes)) : 'jamais'} data-ia-au-moins={t && t.auMoins ? '1' : '0'}>
          <div className="vrm-ia-tete">Valeur au prix d’achat</div>
          <div className="vrm-ia-montant">{t && t.auMoins ? <span className="vrm-ia-borne">au moins </span> : null}<b>{t ? t.montant : '—'}</b></div>
          {inv && inv.v.n ? <div className="vrm-ia-jauge" role="img" aria-label={`${inv.v.nPrix} sur ${inv.v.n} avec un prix d’achat`}><span style={{ width: `${pct}%` }}/></div> : null}
          <div className="vrm-ia-sous">
            {!inv ? <span data-ia-jamais="">Annonces pas encore lues</span> : null}
            {t && t.sur ? <span data-ia-sur={inv.v.n}>{t.sur}</span> : null}
            {t && t.sans ? (onSaisirPrix ? <button type="button" className="vrm-cv-porte" data-ia-saisir={inv.v.nSans} onClick={onSaisirPrix}>{t.sans} ›</button> : <span>{t.sans}</span>) : null}
          </div>
          {inv && inv.partiel ? <p className="vrm-ia-aide" data-ia-partiel="">Une lecture d’annonces manque.</p> : null}
          {!inv && onAnnonces ? <button type="button" className="vrm-b vrm-b-secondaire vrm-ia-large" data-ia-annonces="" onClick={onAnnonces}>Ouvrir Annonces</button> : null}
        </section>

        {verif}

        {inv ? (
          <div className="vrm-ia-exports" data-ia-exports="">
            <button type="button" className="vrm-b vrm-b-primaire" data-ia-export="pdf" disabled={!!exp} onClick={() => exporter('pdf')}>{exp === 'pdf' ? 'PDF…' : 'Télécharger le PDF'}</button>
            <button type="button" className="vrm-b vrm-b-secondaire" data-ia-export="csv" disabled={!!exp} onClick={() => exporter('csv')}>CSV</button>
          </div>) : null}

        {inv && inv.lignes.length ? (
          <section className="vrm-ia-carte vrm-ia-liste" aria-label="Les paires" data-ia-lignes={inv.lignes.length}>
            <div className="vrm-ia-tete">Les paires · {inv.lignes.length}</div>
            <ul>{(tout.paires ? inv.lignes : inv.lignes.slice(0, MAX_LISTE)).map((l) => (
              <li key={l.id} className="vrm-ia-l" data-ia-ligne={l.id} data-ia-ligne-prix={l.achat == null ? 'sans' : String(l.achat)} data-ia-ligne-trouvee={ecarts ? (trouve.has(l.id) ? '1' : '0') : ''}>
                {l.numero ? <Numero n={l.numero} taille="petit"/> : <span className="vrm-ia-sans-n">sans N°</span>}
                <span className="vrm-ia-l-t">{l.titre || 'Sans titre'}{l.compte ? <small>{l.compte}</small> : null}</span>
                <span className="vrm-ia-l-prix">{l.achat == null ? '—' : eurosStock(l.achat)}</span>
                {ecarts ? <span className="vrm-ia-l-coche" aria-label={trouve.has(l.id) ? 'Trouvée' : 'Pas trouvée'}>{trouve.has(l.id) ? '✓' : ''}</span> : null}
              </li>))}</ul>
            {!tout.paires && inv.lignes.length > MAX_LISTE ? <button type="button" className="vrm-ia-lien" data-ia-tout="" onClick={() => setTout((x) => ({ ...x, paires: true }))}>Voir les {inv.lignes.length}</button> : null}
          </section>) : null}
      </div>
    </Feuille>
  );
}

export default InventaireAnnuel;
