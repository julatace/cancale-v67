// ── LE DOSSIER « À PUBLIER » (28 nov.) — la règle : src/aPublier/dossier.js ; les fichiers : src/aPublier/fichiers.js ────
// Julien : « faire un dossier avec les articles à publier » ; « ça permet aussi de pouvoir étiqueter avant ».
//   1. « Ajouter des photos » : une sélection (galerie du téléphone, fichiers ou dossier de l'ordinateur ; plusieurs
//      sélections à la suite) ⇒ la feuille « Regrouper » : 1 sélection = 1 article par défaut ; SON toucher sur une photo
//      commence un nouvel article ; VRM peut PROPOSER des coupures (heure de prise, dossier), jamais appliquées sans SON
//      « Appliquer ». « Créer N articles » range les photos (ligne du studio du brouillon), puis les brouillons.
//   2. Chaque brouillon : titre, taille, prix s'il veut ; « Relier à un achat » et « Prix minimum accepté » (le bloc commun) ;
//      « Donner un N° » (SON toucher : le prochain libre, jamais un trou) ; « Imprimer les étiquettes ».
//   3. Publié (par VRM ou à la main dans l'app Vinted) : reconnu par IDENTITÉ (N°, puis photo) — sinon « Publiée ? Relie-la »,
//      SON toucher parmi les nouvelles annonces. Il passe alors dans « Publiées », avec l'annonce qu'il est devenu.
import React from 'react';
import { Feuille, Groupe, Rangee, Bouton, Champ, Actions, Pourquoi } from '../natif/index.js';
import { tr } from '../i18n/index.js';
import { brouillonsOuverts, brouillonsPublies, decouper, proposerCoupures, proposerCoupuresDossier, brouillonsDeGroupes, fichiersEnDouble, PHOTOS_MAX_BROUILLON } from './dossier.js';
import { lireFichiersPhotos } from './fichiers.js';
import { etatAchat } from '../publier/avantPublier.js';
import { BlocAvantPublier, RelierAchatFeuille, texteAchat } from '../publier/AvantPublier.jsx';
import '../depot/preparer.css';

const eurC = (c) => (Number.isSafeInteger(c) ? `${(c / 100).toFixed(c % 100 ? 2 : 0).replace('.', ',')} €` : '—');
const miniC = (f) => { const n = Number(String((f && f.min) == null ? '' : f.min).replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null; };
const prixC = (f) => { const n = Number(f && f.prix); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null; };
const nouvelId = (i) => 'd' + Date.now().toString(36) + i.toString(36) + Math.random().toString(36).slice(2, 6);

function Regrouper({ photos, coupures, propose, onCouper, onUneParSelection, onProposer, onAppliquer, onAjouter, onCreer, onFermer, lecture }) {
  const groupes = decouper(photos, coupures);
  const debuts = new Set([0, ...coupures]);
  let k = 0; const numero = photos.map((p, i) => { if (i > 0 && coupures.has(i)) k += 1; return k + 1; });
  return (
    <Feuille ouverte onFermer={onFermer} titre={tr('dap.regrouper.titre', { n: String(photos.length) })} detente="pleine" attrs={{ 'data-dap-regrouper': String(photos.length), 'data-dap-groupes': String(groupes.length) }}
      pied={<Bouton variante="plein" large onClick={onCreer} indisponible={!photos.length || lecture} attrs={{ 'data-dap-creer': String(groupes.length) }}>{tr('dap.regrouper.creer', { n: String(groupes.length) })}</Bouton>}>
      <p className="dap-etat">{tr('dap.regrouper.phrase')}</p>
      <div className="dap-actions"><Actions elements={[
        { cle: 'une', libelle: tr('dap.regrouper.uneSelection'), onClick: onUneParSelection, attrs: { 'data-dap-une-selection': '' } },
        { cle: 'proposer', libelle: tr('dap.regrouper.proposer'), onClick: onProposer, attrs: { 'data-dap-proposer': '' } },
        { cle: 'ajouter', libelle: tr('dap.regrouper.ajouter'), onClick: onAjouter, attrs: { 'data-dap-ajouter-selection': '' } },
      ]}/></div>
      {propose ? <Groupe attrs={{ 'data-dap-proposition': String(decouper(photos, propose).length) }}>
        <Rangee titre={tr('dap.regrouper.proposition', { n: String(decouper(photos, propose).length) })} sousTitre={tr('dap.regrouper.propositionSous')}/>
        <div className="dap-actions"><Bouton variante="teinte" onClick={onAppliquer} attrs={{ 'data-dap-appliquer': '' }}>{tr('dap.regrouper.appliquer')}</Bouton></div>
      </Groupe> : null}
      <Groupe titre={tr('dap.regrouper.articles', { n: String(groupes.length) })}>
        <div className="dap-grille" role="list">
          {photos.map((p, i) => (
            <button key={p.id} type="button" role="listitem" className="dap-case" data-dap-photo={p.id} data-dap-article={String(numero[i])} data-dap-debut={debuts.has(i) ? '' : undefined}
              data-dap-propose={propose && propose.has(i) ? '' : undefined} aria-pressed={i > 0 && coupures.has(i) ? 'true' : 'false'}
              aria-label={i === 0 ? tr('dap.regrouper.premiere', { n: String(numero[i]) }) : coupures.has(i) ? tr('dap.regrouper.recoller', { i: String(i + 1) }) : tr('dap.regrouper.couper', { i: String(i + 1) })}
              onClick={() => { if (i > 0) onCouper(i); }}>
              <img src={p.vig || p.img} alt=""/>
              {debuts.has(i) ? <span className="dap-n" aria-hidden="true">{numero[i]}</span> : null}
            </button>
          ))}
        </div>
      </Groupe>
    </Feuille>
  );
}

export default function DossierAPublier({ neuves, nouvelles = [], ambigus = {}, outils = null, reglages = null, vignettes = {}, lecture = false,
  ecrirePhotos, creer, modifier, donnerNumeros, imprimer, lier, confirmer, ouvrirPreparer = null, poserMiniNum = null, ouvrirAnnonce = null, dire = null, Icon = null, annonceTitre = null }) {
  const ouverts = brouillonsOuverts(neuves);
  const publies = brouillonsPublies(neuves).slice(0, 30);
  const doubles = fichiersEnDouble(ouverts);
  const [sel, setSel] = React.useState(() => new Set());
  const [ouvert, setOuvert] = React.useState('');
  const [regroupe, setRegroupe] = React.useState(null);     // { photos, coupures:Set, propose:Set|null }
  const [lit, setLit] = React.useState('');
  const [relier, setRelier] = React.useState('');
  const [choix, setChoix] = React.useState('');
  const [champs, setChamps] = React.useState({ titre: '', taille: '', prix: '' });
  const refFichier = React.useRef(null), refDossier = React.useRef(null);
  const T = neuves || {};
  const b = ouvert ? T[ouvert] || null : null;
  React.useEffect(() => { if (b) setChamps({ titre: b.titre || '', taille: b.taille || '', prix: b.prix != null ? String(b.prix).replace('.', ',') : '' }); }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps
  const ic = (n) => (Icon ? <Icon name={n} size={18}/> : null);
  const dit = (t) => { if (dire) dire(t); };

  const choisirFichiers = (dossier = false) => { const el = dossier ? refDossier.current : refFichier.current; if (el) { el.value = ''; el.click(); } };
  const recevoir = async (ev) => {
    const files = ev && ev.target && ev.target.files; if (!files || !files.length) return;
    setLit(tr('dap.lecture', { n: String(files.length) }));
    const r = await lireFichiersPhotos(files);
    setLit('');
    if (r.rates) dit(tr('dap.illisibles', { n: String(r.rates) }));
    if (!r.photos.length) return;
    setRegroupe((g) => {
      if (!g) { const auto = r.photos.some((p) => p.chemin) ? proposerCoupuresDossier(r.photos) : null; return { photos: r.photos, coupures: new Set(), propose: auto && auto.size ? auto : null, sets: [0] }; }
      const base = g.photos.length; const c = new Set(g.coupures); c.add(base);
      return { ...g, photos: [...g.photos, ...r.photos], coupures: c, sets: [...(g.sets || [0]), base], propose: null };
    });
  };
  const creerArticles = async () => {
    if (!regroupe) return;
    const groupes = decouper(regroupe.photos, regroupe.coupures).map((g) => g.slice(0, PHOTOS_MAX_BROUILLON));
    const br = brouillonsDeGroupes(groupes, { idDe: nouvelId });
    // Les photos D'ABORD (la ligne du studio de chaque brouillon) ; une écriture ratée ⇒ ce brouillon n'est pas créé.
    const faits = [];
    for (let i = 0; i < br.length; i++) {
      const ok = await ecrirePhotos(br[i].fiche.dossier.cle, groupes[i].map((p, j) => ({ id: p.id, img: p.img, ...(j === 0 ? { vig: p.vig } : {}) })));
      if (ok) faits.push(br[i]);
    }
    if (faits.length < br.length) dit(tr('dap.pasRanges', { n: String(br.length - faits.length) }));
    if (faits.length) await creer(faits);
    setRegroupe(null);
  };
  const basculer = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const choisis = ouverts.filter((f) => sel.has(String(f.id)));
  const sansNum = choisis.filter((f) => !String(f.numero || '').trim());
  const avecNum = choisis.filter((f) => String(f.numero || '').trim());
  const donner = async (ids) => {
    const r = await donnerNumeros(ids);
    if (!r || !r.ok) { dit(tr(r && r.raison === 'moi' ? 'dap.num.moi' : 'dap.num.pasDonne')); return; }
    const l = Object.values(r.numeros || {});
    if (l.length) dit(tr('dap.num.donnes', { l: l.map((n) => 'N°' + n).join(', ') }));
    // Un prix mini posé AVANT le N° rejoint la clé par N° de la ligne des réglages (les moteurs le lisent par ce N°).
    if (poserMiniNum) for (const [id, n] of Object.entries(r.numeros || {})) { const f = T[id]; const c = miniC(f); if (c != null) poserMiniNum(n, c); }
  };
  const imprimerChoisis = async (liste) => {
    const l = liste.filter((f) => String(f.numero || '').trim());
    if (!l.length) return;
    const ok = await imprimer(l.map((f) => ({ num: String(f.numero), titre: f.titre || '' })));
    if (ok) dit(tr('dap.imprime', { n: String(l.length) }));
  };
  const enregistrerChamps = () => {
    if (!b) return;
    const n = Number(String(champs.prix || '').replace(',', '.'));
    const prix = String(champs.prix || '').trim() ? (Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : undefined) : null;
    if (prix === undefined) { dit(tr('dap.prixIllisible')); return; }
    modifier(String(b.id), { titre: String(champs.titre || '').trim().slice(0, 100), taille: String(champs.taille || '').trim().slice(0, 20), prix }, tr('dap.enregistre'));
  };
  const retirer = async (f) => {
    const ok = await confirmer({ titre: tr('dap.retirer.titre'), desc: f.numero ? tr('dap.retirer.numero', { n: String(f.numero) }) : tr('dap.retirer.sans'), ok: tr('dap.retirer.ok') });
    if (ok !== true) return;
    modifier(String(f.id), { retireeAt: new Date().toISOString() }, tr('dap.retire'));
    setOuvert('');
  };
  const sous = (f) => {
    const e = etatAchat(f); const m = miniC(f);
    return [f.numero ? 'N°' + f.numero : tr('dap.sansNum'), tr('dap.photos', { n: String(((f.dossier || {}).photos || []).length) }), e.etat !== 'aucun' ? texteAchat(e) : '', m != null ? tr('dap.min', { prix: eurC(m) }) : ''].filter(Boolean).join(' · ');
  };
  const enDouble = (f) => ((f.dossier || {}).photos || []).some((p) => p.h && doubles.has(p.h));

  return (
    <section className="vrm-dap" data-dossier-a-publier={String(ouverts.length)} data-dossier-publiees={String(publies.length)} aria-label={tr('dap.titre')}>
      <input ref={refFichier} className="dap-fichier" type="file" accept="image/*" multiple onChange={recevoir} tabIndex={-1} aria-hidden="true" data-dap-fichiers=""/>
      <input ref={refDossier} className="dap-fichier" type="file" accept="image/*" multiple webkitdirectory="" onChange={recevoir} tabIndex={-1} aria-hidden="true" data-dap-dossier=""/>
      <Groupe titre={tr('dap.titreN', { n: String(ouverts.length) })} attrs={{ 'data-dap-groupe': '' }}>
        <div className="dap-actions"><Actions elements={[
          { cle: 'ajouter', icone: ic('image'), libelle: tr('dap.ajouter'), onClick: () => choisirFichiers(false), indisponible: lecture, attrs: { 'data-dap-ajouter': '' } },
          { cle: 'dossier', icone: ic('ordi'), libelle: tr('dap.dossierOrdi'), onClick: () => choisirFichiers(true), indisponible: lecture, attrs: { 'data-dap-ajouter-dossier': '' } },
          sansNum.length ? { cle: 'numero', icone: ic('tag'), libelle: tr('dap.donnerN', { n: String(sansNum.length) }), onClick: () => donner(sansNum.map((f) => String(f.id))), attrs: { 'data-dap-donner': String(sansNum.length) } } : null,
          avecNum.length ? { cle: 'imprimer', icone: ic('printer'), libelle: tr('dap.imprimerN', { n: String(avecNum.length) }), onClick: () => imprimerChoisis(avecNum), attrs: { 'data-dap-imprimer': String(avecNum.length) } } : null,
        ]}/></div>
        {lit ? <p className="dap-etat" role="status" data-dap-lit="">{lit}</p> : null}
        {!ouverts.length ? <Rangee titre={tr('dap.vide')} attrs={{ 'data-dap-vide': '' }}/> : ouverts.map((f) => {
          const id = String(f.id); const amb = Array.isArray(ambigus[id]) && ambigus[id].length;
          const v = vignettes[(f.dossier || {}).cle];
          return <Rangee key={id} titre={f.titre || tr('dap.sansTitre')} sousTitre={sous(f)} note={amb ? tr('dap.publieeRelie') : enDouble(f) ? tr('dap.memeFichier') : ''}
            vignette={v ? <img className="dap-vig" src={v} alt=""/> : null} fin="chevron" onClick={() => setOuvert(id)}
            selection={{ cochee: sel.has(id), onChange: () => basculer(id), libelle: tr('dap.cocher', { t: f.titre || (f.numero ? 'N°' + f.numero : tr('dap.sansTitre')) }) }}
            attrs={{ 'data-dap-brouillon': id, 'data-dap-num': f.numero || '', 'data-dap-ambigu': amb ? String(ambigus[id].length) : undefined, 'data-dap-double': enDouble(f) ? '' : undefined }}/>;
        })}
        <div className="ap-pourquoi"><Pourquoi>{tr('dap.pourquoi')}</Pourquoi></div>
      </Groupe>
      {publies.length ? <Groupe titre={tr('dap.publiees', { n: String(publies.length) })} attrs={{ 'data-dap-publiees': String(publies.length) }}>
        {publies.map((f) => { const p = f.publiee || {}; const at = annonceTitre ? annonceTitre(p.id) : '';
          return <Rangee key={f.id} titre={f.titre || tr('dap.sansTitre')} sousTitre={[f.numero ? 'N°' + f.numero : '', tr('dap.devenue', { t: at ? '« ' + at.slice(0, 40) + ' »' : '#' + String(p.id || '') }), tr('dap.par.' + (p.de === 'numero' ? 'numero' : p.de === 'choix' ? 'choix' : 'photo'))].filter(Boolean).join(' · ')}
            fin={ouvrirAnnonce ? 'chevron' : null} onClick={ouvrirAnnonce ? () => ouvrirAnnonce(String(p.id)) : null} attrs={{ 'data-dap-publiee': String(f.id), 'data-dap-annonce': String(p.id || ''), 'data-dap-par': p.de || '' }}/>; })}
      </Groupe> : null}

      {regroupe ? <Regrouper photos={regroupe.photos} coupures={regroupe.coupures} propose={regroupe.propose} lecture={!!lit}
        onCouper={(i) => setRegroupe((g) => { const c = new Set(g.coupures); if (c.has(i)) c.delete(i); else c.add(i); return { ...g, coupures: c }; })}
        onUneParSelection={() => setRegroupe((g) => ({ ...g, coupures: new Set((g.sets || [0]).filter((x) => x > 0)), propose: null }))}
        onProposer={() => setRegroupe((g) => { const p = new Set([...proposerCoupures(g.photos), ...proposerCoupuresDossier(g.photos), ...(g.sets || []).filter((x) => x > 0)]); return { ...g, propose: p }; })}
        onAppliquer={() => setRegroupe((g) => (g.propose ? { ...g, coupures: new Set(g.propose), propose: null } : g))}
        onAjouter={() => choisirFichiers(false)} onCreer={creerArticles} onFermer={() => setRegroupe(null)}/> : null}

      {b ? <Feuille ouverte onFermer={() => setOuvert('')} titre={b.numero ? tr('dap.fiche.titreN', { n: String(b.numero) }) : tr('dap.fiche.titre')} detente="pleine"
        attrs={{ 'data-dap-fiche': String(b.id), 'data-dap-fiche-num': b.numero || '' }}>
        <Groupe titre={tr('dap.fiche.article')}>
          <div className="prep-champs">
            <Champ libelle={tr('dap.fiche.titreChamp')} valeur={champs.titre} onChange={(t) => setChamps((o) => ({ ...o, titre: t }))} attrs={{ 'data-dap-champ': 'titre' }}/>
            <Champ libelle={tr('dap.fiche.taille')} valeur={champs.taille} onChange={(t) => setChamps((o) => ({ ...o, taille: t }))} attrs={{ 'data-dap-champ': 'taille' }}/>
            <Champ libelle={tr('dap.fiche.prix')} valeur={champs.prix} onChange={(t) => setChamps((o) => ({ ...o, prix: t }))} inputMode="decimal" suffixe="€" attrs={{ 'data-dap-champ': 'prix' }}/>
          </div>
          <div className="dap-actions"><Bouton variante="teinte" onClick={enregistrerChamps} attrs={{ 'data-dap-enregistrer': '' }}>{tr('dap.fiche.enregistrer')}</Bouton></div>
        </Groupe>
        <BlocAvantPublier fiche={b} prixC={prixC(b)} reglages={reglages} confirmer={confirmer} onRelier={outils ? () => setRelier(String(b.id)) : null}
          onMini={async (c) => { const at = new Date().toISOString(); const ok = modifier(String(b.id), { min: c == null ? '' : String(c / 100), minAt: at }, c == null ? tr('ap.mini.efface') : tr('ap.mini.fait', { prix: eurC(c) }));
            if (ok !== false && b.numero && poserMiniNum) poserMiniNum(String(b.numero), c); return ok; }}/>
        <Groupe titre={tr('dap.fiche.gestes')}>
          <div className="dap-actions"><Actions elements={[
            !b.numero ? { cle: 'numero', icone: ic('tag'), libelle: tr('dap.donner'), onClick: () => donner([String(b.id)]), attrs: { 'data-dap-donner-un': String(b.id) } } : null,
            b.numero ? { cle: 'imprimer', icone: ic('printer'), libelle: tr('dap.imprimerUn'), onClick: () => imprimerChoisis([b]), attrs: { 'data-dap-imprimer-un': String(b.id) } } : null,
            b.numero && ouvrirPreparer ? { cle: 'preparer', icone: ic('pencil'), libelle: tr('dap.preparer'), onClick: () => ouvrirPreparer(b), attrs: { 'data-dap-preparer': String(b.id) } } : null,
            (nouvelles || []).length ? { cle: 'relie', icone: ic('link'), libelle: tr('dap.relieLa'), onClick: () => setChoix(String(b.id)), attrs: { 'data-dap-relie-la': String(b.id) } } : null,
            { cle: 'retirer', icone: ic('trash'), libelle: tr('dap.retirer'), onClick: () => retirer(b), attrs: { 'data-dap-retirer': String(b.id) } },
          ]}/></div>
        </Groupe>
      </Feuille> : null}

      {relier && T[relier] ? <RelierAchatFeuille outils={outils} cible={{ titre: T[relier].titre || '', taille: T[relier].taille || '', dateRef: new Date().toISOString() }}
        onFermer={() => setRelier('')} onRelier={(lien) => modifier(relier, { buyFromId: lien.buyFromId, buyFrom: lien.buyFrom, ...(lien.buyPrice != null && !(T[relier].buyPrice != null && String(T[relier].buyPrice).trim() !== '') ? { buyPrice: lien.buyPrice, buyPriceSource: lien.buyPriceSource } : {}) }, tr('ap.achat.relie'))}/> : null}

      {choix && T[choix] ? <Feuille ouverte onFermer={() => setChoix('')} titre={tr('dap.choix.titre')} detente="pleine" attrs={{ 'data-dap-choix': choix }}>
        <p className="dap-etat">{tr('dap.choix.phrase')}</p>
        <Groupe>
          {(() => { const amb = new Set(ambigus[choix] || []); const l = [...(nouvelles || [])].sort((x, y) => (amb.has(String(y.id)) ? 1 : 0) - (amb.has(String(x.id)) ? 1 : 0));
            return l.length ? l.slice(0, 40).map((a) => <Rangee key={a.id} titre={a.titre || '—'} sousTitre={[a.numero ? 'N°' + a.numero : tr('dap.sansNum'), amb.has(String(a.id)) ? tr('dap.choix.memePhoto') : ''].filter(Boolean).join(' · ')}
              vignette={a.photo ? <img className="dap-vig" src={a.photo} alt=""/> : null} onClick={async () => { const ok = await confirmer({ titre: tr('dap.choix.confirmer'), desc: a.titre || '', ok: tr('dap.choix.oui') }); if (ok === true) { await lier(T[choix], String(a.id)); setChoix(''); setOuvert(''); } }}
              attrs={{ 'data-dap-choix-annonce': String(a.id), 'data-dap-choix-photo': amb.has(String(a.id)) ? '' : undefined }}/>) : <Rangee titre={tr('dap.choix.aucune')}/>; })()}
        </Groupe>
      </Feuille> : null}
    </section>
  );
}
