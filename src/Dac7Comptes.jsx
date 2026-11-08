// ═══════════════════════════════════════════════════════════════════════════
// COMPTA · DAC7 COMPTE PAR COMPTE (5 nov.) — l'écran. La règle : src/dac7Comptes.js.
// ═══════════════════════════════════════════════════════════════════════════
// Une carte par compte et par plateforme : ventes N / 30, montant / 2 000 €,
// au-dessus ou non (par le MOT, en gras — ton informatif, aucun ambre), « au
// moins » et le manque NOMMÉ quand des ventes manquent, « — » quand la lecture a
// échoué. Le rapport de la plateforme quand VRM l'a reçu, sinon où le trouver.
// Ambre seulement pour un geste à faire : Vinted bloque un compte faute
// d'informations fiscales (`taxpayer_restricted`, lu dans le porte-monnaie).
// Les nombres sont portés en `data-*` pour le banc (§6.4).
import React from 'react';
import { DAC7, OU_TROUVER, PLATEFORMES } from './dac7Comptes.js';
import { montant } from './format.js';

// (6 nov., finition) l'écriture unique des euros (montant) : « 665 € », jamais « 665,00 € ».
const eur = (c) => (c == null ? '—' : montant(c, { enCentimes: true }));
const eurRond = (c) => (c / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
const jour = (t) => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); };
const NOM_P = { Vinted: 'Vinted', Leboncoin: 'Leboncoin', eBay: 'eBay', Vestiaire: 'Vestiaire Collective' };

function Barre({ pct, attr }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="vrm-d7-barre" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)} {...(attr || {})}>
      <div className="vrm-d7-barre-plein" style={{ width: `${p}%` }} />
    </div>
  );
}

const VERDICT = { atteint: 'Au-dessus du seuil', atteintSi: 'Au-dessus si les ventes à dater comptent', sous: 'Sous le seuil' };

function Carte({ k, annee, blocage, onExport, enCours }) {
  const lu = k.etat === 'lu';
  const am = lu && k.partiel ? 'au moins ' : '';
  const verdict = !lu ? (k.etat === 'encours' ? '…' : 'Ventes pas lues') : (VERDICT[k.verdict] || 'Pas encore sûr');
  const id = `${k.plateforme}|${k.cle}`;
  return (
    <li className="vrm-d7-carte" data-dac7-compte={id} data-plateforme={k.plateforme} data-etat={k.etat} data-n={lu ? k.n : ''} data-cts={lu ? k.centimes : ''}
      data-verdict={k.verdict || ''} data-a-dater={lu ? k.nAd : ''} data-cts-a-dater={lu ? k.ctsAd : ''} data-nc={lu ? k.nNc : ''} data-partiel={lu && k.partiel ? '1' : ''}>
      <div className="vrm-d7-carte-tete">
        <span className="vrm-d7-nom">{k.nom}</span>
        <span className={'vrm-d7-verdict' + (k.verdict === 'atteint' ? ' is-atteint' : '')} data-dac7-verdict-texte="">{verdict}</span>
      </div>
      <div className="vrm-d7-mesures">
        <div className="vrm-d7-mesure">
          <div className="vrm-d7-mesure-l"><span>Ventes</span><b data-dac7-ventes="">{lu ? `${am}${k.n} / ${DAC7.ventes}` : '—'}</b></div>
          {lu ? <Barre pct={(k.n / DAC7.ventes) * 100} attr={{ 'data-dac7-jauge-ventes': id }} /> : null}
        </div>
        <div className="vrm-d7-mesure">
          <div className="vrm-d7-mesure-l"><span>Montant</span><b data-dac7-montant="">{lu ? <>{am}{eur(k.centimes)}<small> / {eurRond(DAC7.centimes)}</small></> : '—'}</b></div>
          {lu ? <Barre pct={(k.centimes / DAC7.centimes) * 100} attr={{ 'data-dac7-jauge-montant': id }} /> : null}
        </div>
      </div>
      {lu && k.manque.length > 0 ? <div className="vrm-d7-manque" data-dac7-manque="">Il manque {k.manque.join(' · ')}</div> : null}
      {lu && k.verdict === 'sous' && k.reste ? <div className="vrm-d7-reste" data-dac7-reste-n={k.reste.n} data-dac7-reste-cts={k.reste.centimes}>Encore {k.reste.n} vente{k.reste.n > 1 ? 's' : ''} ou {eur(k.reste.centimes)}</div> : null}
      {blocage && blocage.bloque ? (
        <div className="vrm-d7-bloque" data-dac7-bloque="1">
          <span>Vinted bloque ce compte tant que tes informations fiscales ne sont pas remplies{blocage.at ? ` (lu le ${jour(blocage.at)})` : ''}.</span>
          <a className="vrm-d7-lien" href={OU_TROUVER.Vinted.lien} target="_blank" rel="noreferrer">Les remplir sur Vinted ↗</a>
        </div>
      ) : blocage && blocage.bloque === false ? (
        <div className="vrm-d7-note" data-dac7-bloque="0">Informations fiscales : aucun blocage chez Vinted{blocage.at ? ` · lu le ${jour(blocage.at)}` : ''}</div>
      ) : null}
      <div className="vrm-d7-gestes">
        <button type="button" className="vrm-d7-btn" data-dac7-pdf={id} aria-label={`Télécharger le relevé DAC7 de ${k.nom} en PDF`} title={`Télécharger le relevé DAC7 de ${k.nom} en PDF`} disabled={!lu || !!enCours} onClick={() => onExport(k, 'pdf')}>{enCours === id + 'pdf' ? '…' : 'PDF'}</button>
        <button type="button" className="vrm-d7-btn" data-dac7-csv={id} aria-label={`Télécharger le relevé DAC7 de ${k.nom} en tableur`} title={`Télécharger le relevé DAC7 de ${k.nom} en tableur`} disabled={!lu || !!enCours} onClick={() => onExport(k, 'csv')}>{enCours === id + 'csv' ? '…' : 'Tableur'}</button>
      </div>
    </li>
  );
}

function Rapport({ plateforme, emails }) {
  const ou = OU_TROUVER[plateforme] || { lien: '', texte: '' };
  if (emails === undefined) return <div className="vrm-d7-rapport" data-dac7-rapport="encours">…</div>;
  const liste = Array.isArray(emails) ? emails : [];
  const rapport = liste.find((e) => e.nature === 'rapport');
  const fiscal = liste.filter((e) => e.nature === 'fiscal');
  return (
    <div className="vrm-d7-rapport" data-dac7-rapport={emails === null ? 'passu' : rapport ? 'recu' : 'aucun'} data-dac7-rapport-p={plateforme} data-dac7-fiscaux={fiscal.length}>
      {rapport ? (
        <div className="vrm-d7-rapport-l"><b>Rapport reçu{rapport.at ? ` le ${jour(rapport.at)}` : ''}</b><span className="vrm-d7-sujet">« {rapport.sujet} »{rapport.a ? ` · sur ${rapport.a}` : ''}</span></div>
      ) : (
        <div className="vrm-d7-rapport-l">
          <b>{emails === null ? 'Rapport : e-mails pas lus' : 'Aucun rapport reconnu dans tes e-mails'}</b>
          <span className="vrm-d7-sujet">{ou.lien ? <a className="vrm-d7-lien" href={ou.lien} target="_blank" rel="noreferrer" data-dac7-ou={plateforme}>{ou.texte} ↗</a> : <span data-dac7-ou={plateforme}>{ou.texte}</span>}</span>
        </div>
      )}
      {fiscal.map((e) => (
        <div key={e.id || e.sujet} className="vrm-d7-rapport-l is-fiscal" data-dac7-fiscal="">
          <span>E-mail fiscal{e.at ? ` du ${jour(e.at)}` : ''}</span><span className="vrm-d7-sujet">« {e.sujet} »</span>
        </div>
      ))}
    </div>
  );
}

export default function Dac7Comptes({ R, annee, annees = [], onAnnee, emails, blocages, onExport, enCours = '' }) {
  const tete = (
    <div className="vrm-d7-tete">
      <span className="vrm-d7-regle">Au moins {DAC7.ventes} ventes ou plus de {eurRond(DAC7.centimes)} dans l'année sur une plateforme : elle transmet tes ventes aux impôts et t'envoie son rapport avant le 31 janvier. Chaque compte est jugé seul.</span>
      {annees.length > 1 ? (
        <select className="vrm-d7-annee" aria-label="Année DAC7" data-dac7-annee-choix="" value={String(annee)} onChange={(e) => onAnnee && onAnnee(Number(e.target.value))}>
          {annees.map((a) => <option key={a} value={String(a)}>{a}</option>)}
        </select>
      ) : null}
    </div>
  );
  if (!R || R.etat === 'encours') return <div className="vrm-d7" data-dac7-comptes={annee} data-dac7-etat="encours">{tete}<div className="vrm-d7-vide">…</div></div>;
  if (R.etat === 'passu') return <div className="vrm-d7" data-dac7-comptes={annee} data-dac7-etat="passu">{tete}<div className="vrm-d7-vide">— tes ventes n'ont pas pu être lues</div></div>;
  const groupes = PLATEFORMES.map((p) => ({ p, cartes: R.cartes.filter((k) => k.plateforme === p) })).filter((g) => g.cartes.length);
  return (
    <div className="vrm-d7" data-dac7-comptes={annee} data-dac7-etat="lu" data-dac7-n={R.cartes.length}>
      {tete}
      {!groupes.length ? <div className="vrm-d7-vide" data-dac7-aucun="">Aucun compte relié</div> : null}
      {groupes.map((g) => (
        <section key={g.p} className="vrm-d7-plateforme" data-dac7-p={g.p}>
          <h3 className="vrm-d7-p-titre">{NOM_P[g.p] || g.p}<span className="vrm-d7-p-n">{g.cartes.length} compte{g.cartes.length > 1 ? 's' : ''}</span></h3>
          <Rapport plateforme={g.p} emails={emails === undefined ? undefined : emails === null ? null : (emails[g.p] || [])} />
          <ul className="vrm-d7-liste">
            {g.cartes.map((k) => <Carte key={k.cle || '_'} k={k} annee={annee} blocage={g.p === 'Vinted' && blocages ? blocages[k.cle] : null} onExport={onExport} enCours={enCours} />)}
          </ul>
        </section>
      ))}
      {R.exclus.length > 0 ? (
        <div className="vrm-d7-note" data-dac7-exclus={R.exclus.map((c) => `${c.plateforme}|${c.cle}`).join(',')}>
          Pas comptés, exclus de tes totaux : {R.exclus.map((c) => `${c.nom} (${c.plateforme})`).join(', ')}
        </div>
      ) : null}
    </div>
  );
}
