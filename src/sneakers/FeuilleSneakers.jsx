// ── src/sneakers/FeuilleSneakers.jsx — « Sneakers » : cote, valeur du stock, entonnoir, étiquettes, en masse ─────────
// (28 nov. 2026, lot sneakers-cote — copié de Payout, Resellify, Sneaker Portal, SyncKicks, Retailed, Vendoo, Bleam)
// Ouverte par `vrm:sneakers` (Argent → Prix qui marche, Annonces, ⌘K). Lit À L'OUVERTURE les sources posées par l'app
// (`poserSourcesSneakers`) ; une source pas lue est « pas su », dite (jamais « aucune »).
//   · Valeur du stock : la cote VRM (SES ventes, src/sneakers/cote.js) de chaque paire présente, « N sur M cotées » —
//     une ESTIMATION, dite comme telle. StockX : pas sans clé, écarté sur décision du 28 nov.
//   · Entonnoir : vues → favoris → ventes par référence (src/sneakers/entonnoir.js).
//   · Étiquettes : créer, compter (src/sneakers/tags.js).
//   · En masse : cocher ⇒ −x % / prix / marque / pointure ⇒ récapitulatif ⇒ SON « Appliquer » (src/sneakers/masse.js).
// ⚠️ Jamais à la mise en ligne (§3) : cette feuille n'est montée par aucun écran de publication (audit-sneakers §C).
import React from 'react';
import { tr } from '../i18n/index.js';
import { Feuille, Groupe, Rangee, Bouton, Segmente, Tuiles, Tuile, Champ, Puce, Vide } from '../natif/index.js';
import { ouvrirPanneau } from '../ouvrirPanneau.js';
import { envoyerGeste } from '../agir/porte.js';   // LA FILE que l'extension exécute (geste 'baisser', file 'prix'), par la porte
import { valeurStockCote } from './cote.js';
import { entonnoirParModele } from './entonnoir.js';
import { compterTags, filtrerParTag, supprimerTag, tagsDe } from './tags.js';
import { planMasse, lireOperation, resumePlan, liensPanneau, appliquerEbay, appliquerFile, SITES_MASSE } from './masse.js';
import { sourcesSneakers, ventesPourCote, annoncesPourSneakers, prendrePreselectionSneakers, avecFiches, poserFiches, cleNumSneakers } from './stockage.js';
import { normaliserRef, normaliserPointure } from './reference.js';
import { useEtatSneakers, PucesTags } from './BlocFiche.jsx';
import './sneakers.css';

const NOM_SITE = { vinted: 'Vinted', ebay: 'eBay', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire' };
const eur = (c) => (c == null ? '—' : `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`);
const dateC = (ms) => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// Les paires présentes : une par N° (plusieurs sites = UNE paire), sinon une par annonce sans N°.
function stockDe(annonces, etat) {
  const vus = new Map();
  for (const a of annonces || []) {
    if (!a || !a.enLigne) continue;
    const n = a.num ? cleNumSneakers(a.num) : '';
    const k = n ? 'n:' + n : a.cle;
    if (vus.has(k)) continue;
    const f = n ? etat.fiches[n] : null;
    vus.set(k, { cle: k, num: n, titre: a.titre, taille: a.taille, ref: f && f.ref, pointure: f && f.pointure });
  }
  return [...vus.values()];
}

function TexteCote({ c }) {
  if (!c || c.medianeC == null) return null;
  return tr(c.niveau === 'pointure' ? 'snk.cote.pointure' : 'snk.cote.reference', { n: c.n, mois: Math.round(c.fenetreJours / 30.4) })
    + (c.derniere ? ' · ' + tr('snk.cote.derniere', { prix: eur(c.derniere.prixC), date: dateC(c.derniere.ms) }) : '')
    + (c.delaiJours != null ? ' · ' + tr('snk.cote.delai', { j: c.delaiJours, n: c.nDelai }) : '');
}

export default function FeuilleSneakers({ ouverte = true, onFermer, vue: vueDepart = 'valeur', load, save, confirmer }) {
  const [vue, setVue] = React.useState(vueDepart || 'valeur');
  const [etat, ecrire] = useEtatSneakers(load, save);
  const [ventes, setVentes] = React.useState(undefined);       // undefined lecture · null pas su · []
  const [annonces, setAnnonces] = React.useState(undefined);
  React.useEffect(() => { setVue(vueDepart || 'valeur'); }, [vueDepart]);
  React.useEffect(() => {
    if (!ouverte) return undefined;
    let vivant = true;
    ventesPourCote().then((v) => { if (vivant) setVentes(v); }, () => { if (vivant) setVentes(null); });
    annoncesPourSneakers().then((a) => { if (vivant) setAnnonces(Array.isArray(a) ? a : null); }, () => { if (vivant) setAnnonces(null); });
    return () => { vivant = false; };
  }, [ouverte]);
  const options = [{ cle: 'valeur', libelle: tr('snk.vue.valeur') }, { cle: 'entonnoir', libelle: tr('snk.vue.entonnoir') }, { cle: 'tags', libelle: tr('snk.vue.tags') }, { cle: 'masse', libelle: tr('snk.vue.masse') }];
  return (
    <Feuille ouverte={ouverte} onFermer={onFermer} titre={tr('snk.titre')} detente="pleine" attrs={{ 'data-snk-feuille': vue }}>
      <div className="snk-feuille">
        <div className="snk-marge-h"><Segmente options={options} valeur={vue} onChange={setVue} libelle={tr('snk.titre')}/></div>
        {vue === 'valeur' ? <VueValeur ventes={ventes} annonces={annonces} etat={etat}/> : null}
        {vue === 'entonnoir' ? <VueEntonnoir ventes={ventes} annonces={annonces} etat={etat}/> : null}
        {vue === 'tags' ? <VueTags annonces={annonces} etat={etat} ecrire={ecrire}/> : null}
        {vue === 'masse' ? <VueMasse annonces={annonces} etat={etat} ecrire={ecrire} confirmer={confirmer}/> : null}
      </div>
    </Feuille>
  );
}

function Lecture({ quoi }) {
  if (quoi === undefined) return <p className="snk-note" data-snk-lecture="">{tr('snk.lecture')}</p>;
  return <p className="snk-note" data-snk-passu="" role="note">— {tr('snk.passu')}</p>;
}

function VueValeur({ ventes, annonces, etat }) {
  if (!Array.isArray(ventes) || !Array.isArray(annonces)) return <Lecture quoi={!Array.isArray(ventes) ? ventes : annonces}/>;
  const v = avecFiches(ventes, etat);
  const stock = stockDe(annonces, etat);
  const r = valeurStockCote(stock, v);
  const parRef = new Map();
  for (const l of r.lignes) { if (!l.ref) continue; const x = parRef.get(l.ref) || { ref: l.ref, n: 0, cote: null }; x.n++; if (l.cote && l.cote.medianeC != null && (!x.cote || l.cote.n > x.cote.n)) x.cote = l.cote; parRef.set(l.ref, x); }
  const refs = [...parRef.values()].sort((a, b) => b.n - a.n || a.ref.localeCompare(b.ref)).slice(0, 60);
  return (
    <>
      <Tuiles titre={tr('snk.valeur.titre')} attrs={{ 'data-snk-valeur': r.valeurC == null ? '' : String(r.valeurC), 'data-snk-cotees': String(r.cotees), 'data-snk-total': String(r.total) }}>
        <Tuile libelle={tr('snk.valeur.estimee')} valeur={r.valeurC == null ? null : eur(r.valeurC).replace(' €', '')} unite="€" detail={r.valeurC == null ? tr('snk.valeur.aucune') : tr('snk.valeur.estimation')}/>
        <Tuile libelle={tr('snk.valeur.couverture')} valeur={tr('snk.valeur.nSurM', { n: r.cotees, m: r.total })} detail=""/>
      </Tuiles>
      <p className="snk-note snk-marge-h" data-snk-valeur-pied="">{tr('snk.valeur.detailNiveaux', { p: r.parNiveau.pointure, r: r.parNiveau.reference })} {tr('snk.valeur.pied', { sansRef: r.sansRef, sansVente: r.sansVente })} {tr('snk.stockx')}</p>
      {refs.length ? (
        <Groupe titre={tr('snk.valeur.parRef')} attrs={{ 'data-snk-refs': String(refs.length) }}>
          {refs.map((x) => (
            <Rangee key={x.ref} titre={x.ref} sousTitre={x.cote ? TexteCote({ c: x.cote }) : tr('snk.cote.aucune')} valeur={x.cote ? eur(x.cote.medianeC) : '—'}
              detailValeur={tr('snk.nPaires', { n: x.n })} lignes={2} attrs={{ 'data-snk-ref-ligne': x.ref, 'data-snk-ref-cote': x.cote ? String(x.cote.medianeC) : '', 'data-snk-ref-niveau': x.cote ? x.cote.niveau : 'aucune' }}/>
          ))}
        </Groupe>
      ) : <Vide phrase={tr('snk.valeur.sansRefTitre')} detail={tr('snk.valeur.sansRefTexte')}/>}
    </>
  );
}

function VueEntonnoir({ ventes, annonces, etat }) {
  if (!Array.isArray(annonces)) return <Lecture quoi={annonces}/>;
  const vinted = annonces.filter((a) => a && a.site === 'vinted');
  const vendus = new Set((Array.isArray(ventes) ? ventes : []).filter((v) => v && v.site === 'vinted' && v.itemId).map((v) => String(v.itemId)));
  const l = entonnoirParModele(vinted.map((a) => ({ id: a.id, titre: a.titre, vues: a.vues, favoris: a.favoris, ref: a.num && etat.fiches[cleNumSneakers(a.num)] ? etat.fiches[cleNumSneakers(a.num)].ref : '' })), vendus);
  if (!l.length) return <Vide phrase={tr('snk.ent.videTitre')} detail={tr('snk.ent.videTexte')}/>;
  return (
    <Groupe titre={tr('snk.ent.titre')} pied={tr('snk.ent.pied') + (Array.isArray(ventes) ? '' : ' ' + tr('snk.ent.ventesPasSues'))} attrs={{ 'data-snk-entonnoir': String(l.length) }}>
      {l.slice(0, 80).map((x) => (
        <Rangee key={x.ref || '-'} titre={x.ref || tr('snk.ent.sansRef')} lignes={2}
          sousTitre={tr('snk.ent.ligne', { a: x.annonces, v: x.nVues ? x.vues : '—', nv: x.nVues, f: x.nFavoris ? x.favoris : '—', nf: x.nFavoris })}
          valeur={Array.isArray(ventes) ? tr('snk.ent.ventes', { n: x.ventes }) : '—'}
          detailValeur={x.tauxFavoris != null ? tr('snk.ent.taux', { t: (Math.round(x.tauxFavoris * 1000) / 10).toString().replace('.', ',') }) : ''}
          attrs={{ 'data-snk-ent-ref': x.ref || '-', 'data-snk-ent-vues': String(x.vues), 'data-snk-ent-nvues': String(x.nVues), 'data-snk-ent-ventes': String(x.ventes) }}/>
      ))}
    </Groupe>
  );
}

function VueTags({ annonces, etat, ecrire }) {
  const presents = Array.isArray(annonces) ? stockDe(annonces, etat).filter((s) => s.num).map((s) => s.num) : null;
  const n = presents ? compterTags(etat, presents) : null;
  return (
    <>
      <Groupe titre={tr('snk.tags.titre')} pied={presents ? tr('snk.tags.pied', { n: presents.length, sans: n['-'] }) : tr('snk.passu')} attrs={{ 'data-snk-vue-tags': String(etat.tags.length) }}>
        {etat.tags.map((g) => (
          <Rangee key={g.id} titre={g.nom} valeur={n ? String(n[g.id] || 0) : '—'} vignette={<span className="snk-pastille snk-pastille-grande" data-snk-couleur={g.couleur} aria-hidden="true"/>}
            actions={[{ libelle: tr('snk.tags.supprimer'), ton: 'neutre', onClick: () => ecrire(supprimerTag(etat, g.id)) }]} attrs={{ 'data-snk-tag-ligne': g.id, 'data-snk-tag-n': n ? String(n[g.id] || 0) : '' }}/>
        ))}
        {!etat.tags.length ? <p className="snk-note">{tr('snk.tags.aucune')}</p> : null}
      </Groupe>
      <Groupe titre={tr('snk.tags.creerTitre')}><div className="snk-pad"><PucesTags etat={etat} cles={[]} onEcrire={ecrire}/></div></Groupe>
    </>
  );
}

const ETATS_MASSE = ['ok', 'sans-plancher', 'sous-plancher', 'hausse', 'inchange', 'pas-lu', 'devise'];
function VueMasse({ annonces, etat, ecrire, confirmer }) {
  const [coches, setCoches] = React.useState(() => new Set(prendrePreselectionSneakers() || []));
  const [site, setSite] = React.useState('tous');
  const [tag, setTag] = React.useState('');
  const [sorte, setSorte] = React.useState('pct');
  const [valeur, setValeur] = React.useState('');
  const [recap, setRecap] = React.useState(false);
  const [sansPlancher, setSansPlancher] = React.useState(false);
  const [res, setRes] = React.useState({});
  const [enCours, setEnCours] = React.useState(false);
  const [panneau, setPanneau] = React.useState([]);
  if (!Array.isArray(annonces)) return <Lecture quoi={annonces}/>;
  const enLigne = annonces.filter((a) => a && a.enLigne && SITES_MASSE.includes(a.site));
  const parSite = site === 'tous' ? enLigne : enLigne.filter((a) => a.site === site);
  const filtrees = tag ? parSite.filter((a) => a.num && filtrerParTag(etat, [cleNumSneakers(a.num)], tag).length) : parSite;
  const cochees = enLigne.filter((a) => coches.has(a.cle));
  const champVRM = sorte === 'marque' || sorte === 'pointure' || sorte === 'ref';
  const op = champVRM ? null : lireOperation(sorte, valeur);
  const plan = op ? planMasse(cochees, op) : [];
  const resume = resumePlan(plan, sansPlancher);
  const lisibleVRM = sorte === 'pointure' ? !!normaliserPointure(valeur) : sorte === 'ref' ? !!normaliserRef(valeur) : !!valeur.trim();
  const sansNum = cochees.filter((a) => !a.num).length;
  const basculer = (cle, oui) => setCoches((s) => { const x = new Set(s); if (oui) x.add(cle); else x.delete(cle); return x; });
  const surEtat = (cle, e) => setRes((r) => ({ ...r, [cle]: e }));
  const appliquer = async () => {
    if (champVRM) {
      const nums = [...new Set(cochees.filter((a) => a.num).map((a) => cleNumSneakers(a.num)))];
      ecrire(poserFiches(etat, nums, { [sorte]: valeur }));
      setRes(Object.fromEntries(cochees.map((a) => [a.cle, { etat: a.num ? 'vrm' : 'sans-num' }]))); setRecap(false); return;
    }
    const s = sourcesSneakers();
    const oui = confirmer ? await confirmer({ n: resume.partent, api: resume.api, file: resume.file }) : true;
    if (!oui) return;
    setEnCours(true);
    try {
      if (resume.api && typeof s.ebay === 'function') await appliquerEbay(plan, s.ebay, { avecSansPlancher: sansPlancher, surEtat });
      if (resume.file) { const f = await appliquerFile(plan, typeof s.file === 'function' ? s.file : envoyerGeste, { avecSansPlancher: sansPlancher, surEtat }); setPanneau(f.panneau); }
    } finally { setEnCours(false); }
  };
  const optsSite = [{ cle: 'tous', libelle: tr('snk.masse.tous') }, ...SITES_MASSE.filter((x) => enLigne.some((a) => a.site === x)).map((x) => ({ cle: x, libelle: NOM_SITE[x] }))];
  const hausses = plan.filter((l) => l.etat === 'hausse');
  const liens = liensPanneau([...panneau, ...hausses], op);
  return (
    <div className="snk-masse" data-snk-masse={String(cochees.length)} data-snk-recap={recap ? '1' : '0'}>
      <Groupe titre={tr('snk.masse.op')}>
        <div className="snk-pad">
          <Segmente libelle={tr('snk.masse.op')} valeur={sorte} onChange={(k) => { setSorte(k); setValeur(''); setRes({}); }}
            options={[{ cle: 'pct', libelle: tr('snk.masse.pct') }, { cle: 'prix', libelle: tr('snk.masse.prix') }, { cle: 'marque', libelle: tr('snk.masse.marque') }, { cle: 'pointure', libelle: tr('snk.pointure') }, { cle: 'ref', libelle: tr('snk.ref') }]}/>
          <Champ libelle={tr('snk.masse.valeur.' + sorte)} valeur={valeur} onChange={(v) => { setValeur(v); setRes({}); }} inputMode={sorte === 'pct' || sorte === 'prix' ? 'decimal' : 'text'} suffixe={sorte === 'pct' ? '%' : sorte === 'prix' ? '€' : ''} attrs={{ 'data-snk-masse-valeur': sorte }}/>
          <p className="snk-note">{tr(champVRM ? 'snk.masse.noteVRM' : 'snk.masse.notePrix')}</p>
        </div>
      </Groupe>
      {!recap ? (
        <Groupe titre={tr('snk.masse.choisir', { n: cochees.length })} action={filtrees.length ? <Bouton variante="texte" onClick={() => setCoches((s) => { const x = new Set(s); const tout = filtrees.every((a) => x.has(a.cle)); for (const a of filtrees) { if (tout) x.delete(a.cle); else x.add(a.cle); } return x; })} attrs={{ 'data-snk-tout': '' }}>{tr('snk.masse.tout')}</Bouton> : null}
          attrs={{ 'data-snk-masse-liste': String(filtrees.length) }}>
          <div className="snk-pad snk-filtres">
            {optsSite.map((o) => <Puce key={o.cle} presse={site === o.cle} className="snk-tag" onClick={() => setSite(o.cle)} attrs={{ 'data-snk-filtre-site': o.cle }}>{o.libelle}</Puce>)}
            {etat.tags.map((g) => <Puce key={g.id} presse={tag === g.id} className="snk-tag" attrs={{ 'data-snk-filtre-tag': g.id, 'data-snk-couleur': g.couleur }} onClick={() => setTag(tag === g.id ? '' : g.id)}><span className="snk-pastille" aria-hidden="true"/>{g.nom}</Puce>)}
          </div>
          {filtrees.slice(0, 300).map((a) => (
            <Rangee key={a.cle} titre={a.titre || tr('snk.sansTitre')} sousTitre={[NOM_SITE[a.site], a.num ? 'N° ' + a.num : '', a.num ? tagsDe(etat, cleNumSneakers(a.num)).map((g) => g.nom).join(', ') : ''].filter(Boolean).join(' · ')}
              valeur={a.prix != null ? eur(Math.round(Number(a.prix) * 100)) : '—'} selection={{ cochee: coches.has(a.cle), onChange: (o) => basculer(a.cle, o), libelle: a.titre || a.cle }}
              attrs={{ 'data-snk-annonce': a.cle, 'data-snk-coche': coches.has(a.cle) ? '1' : '0' }}/>
          ))}
          {!filtrees.length ? <p className="snk-note snk-pad">{tr('snk.masse.aucune')}</p> : null}
        </Groupe>
      ) : (
        <Groupe titre={tr('snk.masse.recap')} attrs={{ 'data-snk-recap-lignes': String(champVRM ? cochees.length : plan.length), 'data-snk-partent': String(champVRM ? cochees.length - sansNum : resume.partent) }}
          pied={champVRM ? (sansNum ? tr('snk.masse.sansNum', { n: sansNum }) : '') : tr('snk.masse.piedPrix', { api: resume.api, file: resume.file })}>
          {champVRM ? cochees.map((a) => <Rangee key={a.cle} titre={a.titre || tr('snk.sansTitre')} sousTitre={a.num ? 'N° ' + a.num : tr('snk.masse.etat.sans-num')} valeur={a.num ? valeur.trim() : '—'} attrs={{ 'data-snk-recap-ligne': a.cle, 'data-snk-recap-etat': a.num ? 'vrm' : 'sans-num' }}/>)
            : plan.map((l) => {
              const r = res[l.cle];
              return <Rangee key={l.cle} titre={l.titre || tr('snk.sansTitre')} lignes={2} ton={l.etat === 'sous-plancher' || l.etat === 'sans-plancher' ? 'ambre' : 'neutre'}
                sousTitre={[NOM_SITE[l.site], tr('snk.masse.etat.' + l.etat, { plancher: l.plancher ? eur(l.plancher.cents) : '' }), l.plancher ? tr('snk.masse.plancher.' + l.plancher.source, { m: eur(l.plancher.cents) }) : '', r ? tr('snk.masse.res.' + r.etat) : ''].filter(Boolean).join(' · ')}
                valeur={l.apresC != null ? eur(l.apresC) : '—'} detailValeur={l.avantC != null ? tr('snk.masse.avant', { m: eur(l.avantC) }) : ''}
                attrs={{ 'data-snk-recap-ligne': l.cle, 'data-snk-recap-etat': l.etat, 'data-snk-recap-apres': l.apresC == null ? '' : String(l.apresC), 'data-snk-recap-voie': l.voie, 'data-snk-res': r ? r.etat : '' }}/>;
            })}
          {!champVRM && (resume.parEtat['sans-plancher'] || 0) > 0 ? (
            <Rangee titre={tr('snk.masse.avecSansPlancher', { n: resume.parEtat['sans-plancher'] })} interrupteur={{ actif: sansPlancher, onChange: setSansPlancher }} attrs={{ 'data-snk-sans-plancher': sansPlancher ? '1' : '0' }}/>
          ) : null}
          {liens.length ? <div className="snk-pad" data-snk-liens={String(liens.length)}>
            <p className="snk-note">{tr('snk.masse.panneau')}</p>
            {liens.map((x) => <Bouton key={x.site + x.compte} variante="teinte" onClick={() => ouvrirPanneau({ site: x.site, compte: x.compte, page: x.page, ids: x.ids, action: x.action })} attrs={{ 'data-snk-lien-panneau': x.site, 'data-snk-lien-ids': x.ids.join(',') }}>{tr('snk.masse.ouvrirPanneau', { n: x.ids.length, site: NOM_SITE[x.site] })}</Bouton>)}
          </div> : null}
        </Groupe>
      )}
      <div className="snk-pad snk-pied-masse">
        {recap ? <Bouton variante="texte" onClick={() => { setRecap(false); setRes({}); setPanneau([]); }} attrs={{ 'data-snk-retour': '' }}>{tr('snk.masse.modifier')}</Bouton> : null}
        {!recap
          ? <Bouton variante="plein" indisponible={!cochees.length || (champVRM ? !lisibleVRM : !op)} raison={!cochees.length ? tr('snk.masse.raisonAucune') : tr('snk.masse.raisonValeur')} onClick={() => { setRecap(true); setRes({}); setPanneau([]); }} attrs={{ 'data-snk-revoir': '' }}>{tr('snk.masse.revoir', { n: cochees.length })}</Bouton>
          : <Bouton variante="plein" chargement={enCours} indisponible={champVRM ? !(cochees.length - sansNum) : !resume.partent} raison={tr('snk.masse.raisonRien')} onClick={appliquer} attrs={{ 'data-snk-appliquer': '' }}>{tr(champVRM ? 'snk.masse.appliquerVRM' : 'snk.masse.appliquer', { n: champVRM ? cochees.length - sansNum : resume.partent })}</Bouton>}
      </div>
    </div>
  );
}
export { ETATS_MASSE };
