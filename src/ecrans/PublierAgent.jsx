// ══════════════════════════════════════════════════════════════════════════
//  « PUBLIER SUR… » — L'AGENT DE PUBLICATION, SANS IA (19 nov. 2026)
//
//  Julien : « il faut un agent capable de poster, peu importe ; s'il y a un doute il regarde, et
//  s'il ne trouve pas il demande l'information à l'utilisateur » — « sans IA » — « c'est
//  l'extension qui va publier dans tous les cas ».
//
//  Ici : les LECTURES (fiches des pages Vinted, annonces Leboncoin et eBay), la MÉMOIRE (ses réponses,
//  `vrm_agent_publier`, écrite sur SON toucher), l'ENVOI (commande `publierFiche` de l'extension, l'une
//  après l'autre ; eBay : un brouillon) et la RELECTURE. Toutes les règles sont dans src/publier/agent.js.
//  Design natif (docs/design/NATIF.md §2 bis) : barre d'outils (vue · sites · relire), « N articles »,
//  un TABLEAU à l'ordinateur (article · catégorie · un état par site), des rangées au téléphone ;
//  UNE question groupée par article (une feuille) ; UN plein « Publier N annonces ».
// ══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { PagePoussee } from '../natif/Page.jsx';
import { Groupe } from '../natif/Groupe.jsx';
import { Rangee, Vignette } from '../natif/Rangee.jsx';
import { Bouton } from '../natif/Bouton.jsx';
import { Segmente } from '../natif/Segmente.jsx';
import { Feuille } from '../natif/Feuille.jsx';
import { Plaque } from '../natif/Plaque.jsx';
import { Vide } from '../natif/Vide.jsx';
import { Attente } from '../natif/Attente.jsx';
import { useOrdinateur } from '../natif/Coque.jsx';
import { ficheArticle, planSite, questionsArticle, retenirReponses, envoiPour, noterEnvoi, relireEnvoi, couverture, lireMemoireAgent, CLE_AGENT, SITES_AGENT } from '../publier/agent.js';
import { CATEGORIES_VRM, CLES_VRM } from '../publier/tables.js';
import { CLE_CORRESPONDANCES } from '../correspondances.js';
import { lireFichesPage, lireBaseRelue, SUPABASE_URL, lireEbayTous, SEL_EBAY_ANNONCES, vmrCmd, extSait, relaisVivant, load, save, isCloudReady, appelEbay, __vmrJobs, __vmrNotifier } from '../App.jsx';
import '../natif/jetons.css';
import '../natif/natif.css';
import './publierAgent.css';

const NOM = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' };
const arr = (a) => (Array.isArray(a) ? a : []);
export const libelleCategorie = (cle) => { const c = CATEGORIES_VRM[cle]; if (!c) return tr('agent.sansCategorie'); return [tr('agent.type.' + c.type), c.genre ? tr('agent.genre.' + c.genre) : ''].filter(Boolean).join(' · '); };
const TON = { pret: 'accent', question: 'ambre', refus: 'neutre', deja: 'neutre', envoi: 'neutre', parti: 'neutre', attente: 'neutre', echec: 'ambre', ok: 'neutre', ecart: 'ambre', pasEncore: 'neutre', nonRelisible: 'neutre' };
function Etiquette({ etat, n = 0 }) {
  return <span className="n-pa-etiquette" data-pa-ton={TON[etat] || 'neutre'} data-pa-etat={etat}>{etat === 'question' && n ? tr('agent.questions', { n }) : tr('agent.etat.' + etat)}</span>;
}
// Attendre la fin d'un dépôt de l'extension (« fait » / « abandonné ») — un seul dépôt à la fois.
function attendreFin(jobId, ms = 20 * 60000) {
  return new Promise((ok) => { const t0 = Date.now(); const tic = () => { const j = __vmrJobs[jobId]; const e = j && String(j.etape || '');
    if (e === 'fait' || e === 'abandonne' || e === 'echec') { ok(e); return; } if (Date.now() - t0 > ms) { ok('delai'); return; } setTimeout(tic, 1500); }; setTimeout(tic, 1500); });
}

// Les lectures : fiches des pages Vinted (projetées, par clé), annonces Leboncoin et eBay. `null` = pas su.
export async function lireSources(articles) {
  const ids = [...new Set(arr(articles).flatMap((a) => arr(a.annonces).filter((x) => x.site === 'vinted').map((x) => String(x.id))))];
  const [vinted, lbc, eb] = await Promise.all([
    ids.length ? lireFichesPage(ids).catch(() => null) : Promise.resolve({}),
    lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_listings&select=items:data->items`).catch(() => null),
    lireEbayTous('ebay_listings', SEL_EBAY_ANNONCES, 'items').catch(() => null),
  ]);
  const ebay = eb && Array.isArray(eb.items) ? Object.fromEntries(eb.items.filter((x) => x && x.itemId != null).map((x) => [String(x.itemId), x.detail || {}])) : null;
  return { vinted: vinted || {}, leboncoin: Array.isArray(lbc) ? ((lbc[0] && lbc[0].items) || {}) : null, ebay, ebayItems: eb && Array.isArray(eb.items) ? eb.items : null, manque: [vinted ? '' : 'vinted', Array.isArray(lbc) ? '' : 'leboncoin', ebay ? '' : 'ebay'].filter(Boolean) };
}

// La feuille de la question groupée d'un article.
function FeuilleQuestion({ cible, onFermer, onEnregistrer }) {
  const [rep, setRep] = React.useState({});
  const [ebay, setEbay] = React.useState(undefined);       // undefined pas cherché · 'cherche' · null pas su · [cats]
  React.useEffect(() => { setRep({}); setEbay(undefined); }, [cible && cible.fiche.cle]);
  if (!cible) return <Feuille ouverte={false} onFermer={onFermer}/>;
  const { fiche, q } = cible;
  const cle = (x) => (x.site || '') + ':' + x.champ;
  const poser = (x, val) => setRep((r) => ({ ...r, [cle(x)]: val }));
  const chercherEbay = async (x) => {
    setEbay('cherche');
    const plan = cible.plans.find((p) => p.site === 'ebay');
    try { const { j } = await appelEbay({ action: 'parametres', q: String((plan && plan.requete) || (fiche.champs.titre && fiche.champs.titre.v) || '').slice(0, 80) }); setEbay(j && j.ok && Array.isArray(j.categories) ? j.categories : null); }
    catch (_) { setEbay(null); }
    poser(x, undefined);
  };
  const enregistrer = () => {
    const reponses = q.questions.map((x) => ({ champ: x.champ, site: x.site, valeur: rep[cle(x)] })).filter((x) => x.valeur != null && x.valeur !== '');
    onEnregistrer(fiche, reponses);
  };
  const nRep = q.questions.filter((x) => rep[cle(x)] != null && rep[cle(x)] !== '').length;
  const libChamp = (x) => tr('agent.champ.' + x.champ) + (x.bloque ? '' : ' · ' + tr('agent.facultatif'));
  const champ = (x) => {
    const id = 'pa-' + cle(x).replace(/[^\w]/g, '-');
    if (x.champ === 'categorieEbay') {
      return <div className="n-pa-q" key={cle(x)} data-pa-q={cle(x)}>
        <span className="n-pa-q-nom">{libChamp(x)}</span>
        {Array.isArray(ebay) ? (ebay.length ? <Groupe nu>{ebay.slice(0, 8).map((c) => <Rangee key={c.id} titre={c.nom || c.name || String(c.id)} sousTitre={c.chemin || c.path || ''} lignes={2}
            fin={rep[cle(x)] && String(rep[cle(x)].id) === String(c.id) ? 'coche' : null} onClick={() => poser(x, { id: String(c.id), nom: c.nom || c.name || '', chemin: c.chemin || c.path || '' })} attrs={{ 'data-pa-ebay': String(c.id) }}/>)}</Groupe>
          : <p className="n-pa-aide">{tr('agent.ebayAucune')}</p>)
          : <Bouton variante="teinte" chargement={ebay === 'cherche'} onClick={() => chercherEbay(x)} attrs={{ 'data-pa-ebay-chercher': '' }}>{tr('agent.ebayChercher')}</Bouton>}
        {ebay === null ? <p className="n-pa-aide" role="alert">{tr('agent.ebayPasSu')}</p> : null}
      </div>;
    }
    if (x.saisie === 'pointure' || x.saisie === 'texte') {
      return <label className="n-pa-q n-pa-q-ligne" key={cle(x)} htmlFor={id} data-pa-q={cle(x)}>
        <span className="n-pa-q-nom">{libChamp(x)}</span>
        <input id={id} className="n-pa-entree" type="text" inputMode={x.saisie === 'pointure' ? 'decimal' : 'text'} autoComplete="off" placeholder={x.saisie === 'pointure' ? tr('agent.pointure.aide') : ''}
          value={rep[cle(x)] || ''} onChange={(e) => poser(x, e.target.value)}/>
      </label>;
    }
    const lib = (val) => (x.champ === 'categorie' ? libelleCategorie(val) : val);
    const cands = x.champ === 'categorie' && arr(x.candidates).length ? x.candidates : null;
    return <label className="n-pa-q n-pa-q-ligne" key={cle(x)} htmlFor={id} data-pa-q={cle(x)}>
      <span className="n-pa-q-nom">{libChamp(x)}</span>
      <select id={id} className="n-pa-choix" value={rep[cle(x)] || ''} onChange={(e) => poser(x, e.target.value)}>
        <option value="">{tr('agent.choisir')}</option>
        {cands ? <optgroup label={tr('agent.candidates')}>{cands.map((c) => <option key={'c' + c} value={c}>{lib(c)}</option>)}</optgroup> : null}
        {(cands ? x.choix.filter((c) => !cands.includes(c)) : x.choix).map((c) => <option key={c} value={c}>{lib(c)}</option>)}
      </select>
    </label>;
  };
  const tous = q.questions.filter((x) => !x.site);
  const parSite = SITES_AGENT.map((s) => [s, q.questions.filter((x) => x.site === s)]).filter(([, l]) => l.length);
  const refus = cible.plans.filter((p) => p.refus && p.refus.code === 'marque-hors-liste');
  return (
    <Feuille ouverte onFermer={onFermer} titre={fiche.numero ? tr('agent.question.titre', { n: fiche.numero }) : tr('agent.question.titreSans')} detentes={['moitie', 'pleine']} attrs={{ 'data-pa-question': fiche.cle }}
      pied={<Bouton variante="plein" indisponible={!nRep} raison={!nRep ? tr('agent.question.aucune') : ''} onClick={enregistrer} attrs={{ 'data-pa-enregistrer': String(nRep) }}>{tr('agent.enregistrer')}</Bouton>}>
      {tous.length ? <Groupe titre={tr('agent.question.pourTous')}><div className="n-pa-qs">{tous.map(champ)}</div></Groupe> : null}
      {parSite.map(([s, l]) => <Groupe key={s} titre={tr('agent.question.pourSite', { site: NOM[s] })}
        pied={s === 'vestiaire' && refus.length ? tr('agent.refus.marque-hors-liste', { marque: refus[0].refus.marque }) : ''}><div className="n-pa-qs">{l.map(champ)}</div></Groupe>)}
      <Groupe nu pied={tr('agent.question.retenu')}/>
    </Feuille>
  );
}

export default function PublierAgent({ ouverte = true, articles = [], onRetour }) {
  const ordinateur = useOrdinateur();
  const [vue, setVue] = React.useState('articles');
  const [lu, setLu] = React.useState(undefined);
  const [tic, setTic] = React.useState(0);
  const [mem, setMem] = React.useState(() => lireMemoireAgent(load(CLE_AGENT, null)));
  const [choix, setChoix] = React.useState(() => new Set(SITES_AGENT));
  const [menuSites, setMenuSites] = React.useState(false);
  const [question, setQuestion] = React.useState('');
  const [envois, setEnvois] = React.useState({});           // 'cle|site' → { etat, texte }
  const [enCours, setEnCours] = React.useState(false);
  const arret = React.useRef(false);
  const cleListe = arr(articles).map((a) => a.cle).join(',');
  React.useEffect(() => { let vivant = true; setLu(undefined); lireSources(articles).then((r) => { if (vivant) setLu(r); }).catch(() => { if (vivant) setLu(null); }); return () => { vivant = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleListe, tic]);
  const extOk = (relaisVivant() ? 'ok' : extSait('publierfiche')) === 'ok';
  const corr = load(CLE_CORRESPONDANCES, null);
  const lignes = React.useMemo(() => {
    if (!lu) return lu;
    return arr(articles).map((a) => {
      const f = ficheArticle(a, lu, mem);
      const deja = Object.fromEntries(SITES_AGENT.map((s) => [s, arr(a.annonces).some((x) => x.site === s && ['enligne', 'aconfirmer', 'masquee', 'pause'].includes(x.etat))]));
      const plans = SITES_AGENT.filter((s) => choix.has(s)).map((s) => planSite(f, s, mem, { corr, ext: { leboncoin: extOk, vestiaire: extOk }, deja }));
      return { a, f, plans, q: questionsArticle(f, plans) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lu, mem, choix, extOk]);
  const etatCase = (l, p) => {
    const e = envois[l.f.cle + '|' + p.site]; if (e) return e.etat;
    const env = l.f.numero ? mem.envois[p.site + ':' + l.f.numero] : null;
    if (env && lu) { const r = relireEnvoi(env, { leboncoin: lu.leboncoin, ebay: lu.ebayItems }); return { ok: 'ok', ecart: 'ecart', 'pas-encore': 'pasEncore', 'non-relisible': 'nonRelisible', 'pas-su': 'pasEncore' }[r.etat] || 'pasEncore'; }
    return p.etat;
  };
  const texteRelu = (l, p) => {
    const env = l.f.numero ? mem.envois[p.site + ':' + l.f.numero] : null;
    if (!env || !lu || envois[l.f.cle + '|' + p.site]) return (envois[l.f.cle + '|' + p.site] || {}).texte || '';
    const r = relireEnvoi(env, { leboncoin: lu.leboncoin, ebay: lu.ebayItems });
    if (r.etat === 'ok') return tr('agent.relu.ok', { site: NOM[p.site], cat: (r.relu && (r.relu.categorie || r.relu.nom)) || '' });
    if (r.etat === 'ecart') return tr('agent.relu.ecart', { site: NOM[p.site], relu: (r.relu && (r.relu.categorie || r.relu.nom || r.relu.id)) || '', voulu: (r.voulu && (r.voulu.categorie || r.voulu.nom || r.voulu.id)) || '' });
    if (r.etat === 'non-relisible') return tr('agent.relu.nonRelisible');
    return tr('agent.relu.pasEncore', { site: NOM[p.site] });
  };
  const prets = (lignes || []).flatMap((l) => l.plans.filter((p) => p.etat === 'pret' && !envois[l.f.cle + '|' + p.site]).map((p) => ({ l, p })));
  const marquer = (l, site, etat, texte = '') => setEnvois((x) => ({ ...x, [l.f.cle + '|' + site]: { etat, texte } }));
  const publier = async () => {
    if (enCours || !prets.length) return;
    setEnCours(true); arret.current = false;
    const file = prets.slice();
    file.forEach(({ l, p }) => marquer(l, p.site, 'attente'));
    for (const { l, p } of file) {
      if (arret.current) break;
      marquer(l, p.site, 'envoi');
      const e = envoiPour(l.f, p);
      if (!e) { marquer(l, p.site, 'echec'); continue; }
      let r = null;
      if (e.voie === 'extension') {
        try { r = await vmrCmd(e.msg, 30000); } catch (_) { r = null; }
        if (r && r.accepte && r.jobId) {
          __vmrJobs[r.jobId] = { ...(__vmrJobs[r.jobId] || {}), etape: r.etape, at: Date.now() }; __vmrNotifier();
          const m2 = noterEnvoi(load(CLE_AGENT, null), p.site, l.f.numero, p); if (isCloudReady()) save(CLE_AGENT, m2); setMem(m2);
          marquer(l, p.site, 'parti', tr('agent.envoi.parti', { site: NOM[p.site] }));
          const fin = await attendreFin(r.jobId);                // un dépôt à la fois : le suivant attend la fin de celui-ci
          marquer(l, p.site, fin === 'fait' ? 'parti' : 'echec', fin === 'fait' ? tr('agent.envoi.fini', { site: NOM[p.site] }) : tr('agent.envoi.abandonne', { site: NOM[p.site] }));
        } else marquer(l, p.site, 'echec', (r && r.raison) || tr('agent.pasSu'));
      } else {
        try { const m = await import('./Ebay.jsx'); r = await m.preparerBrouillonPartout(e.p, { prix: l.f.champs.prix.v, titre: e.p.title, categorie: e.categorie }); } catch (_) { r = null; }
        if (r && r.accepte) { const m2 = noterEnvoi(load(CLE_AGENT, null), 'ebay', l.f.numero, p); if (isCloudReady()) save(CLE_AGENT, m2); setMem(m2); marquer(l, 'ebay', 'parti', tr('agent.envoi.brouillon')); }
        else marquer(l, 'ebay', 'echec', (r && r.raison) || tr('agent.pasSu'));
      }
    }
    setEnCours(false);
  };
  const enregistrer = (fiche, reponses) => {
    const m2 = retenirReponses(load(CLE_AGENT, null), fiche, reponses);
    if (isCloudReady()) save(CLE_AGENT, m2);
    setMem(m2); setQuestion('');
  };
  const lq = question && lignes ? lignes.find((l) => l.f.cle === question) : null;
  const sitesVus = SITES_AGENT.filter((s) => choix.has(s));
  const cellule = (l, p) => { const e = etatCase(l, p); const nq = p.questions.filter((x) => x.bloque).length;
    return <td key={p.site} className="n-pa-td" data-pa-col={p.site} data-pa-etat={e} title={p.refus ? tr('agent.refus.' + p.refus.code, { marque: p.refus.marque || '' }) : texteRelu(l, p) || undefined}><Etiquette etat={e} n={nq}/></td>; };
  const ouvrir = (l) => setQuestion(l.f.cle);
  // Au téléphone : la catégorie, puis les sites prêts ; l'étiquette dit ce qui reste à faire (une question l'emporte).
  const sousDe = (l) => { const prets = l.plans.filter((p) => etatCase(l, p) === 'pret').map((p) => NOM[p.site]);
    return [l.f.champs.categorie ? libelleCategorie(l.f.champs.categorie.v) : tr('agent.sansCategorie'), prets.length ? tr('agent.etat.pret') + ' : ' + prets.join(', ') : ''].filter(Boolean).join(' · '); };
  const resume = (l) => { const e = l.plans.map((p) => etatCase(l, p)); const nq = l.q.questions.filter((x) => x.bloque).length;
    if (e.includes('question') && nq) return <Etiquette etat="question" n={nq}/>; if (e.includes('ecart')) return <Etiquette etat="ecart"/>;
    for (const k of ['envoi', 'attente', 'parti', 'pret', 'ok', 'echec', 'pasEncore', 'nonRelisible', 'deja', 'refus']) if (e.includes(k)) return <Etiquette etat={k}/>; return null; };

  const outils = (
    <div className="n-pa-outils" data-pa-outils="">
      <Segmente libelle={tr('agent.vue.libelle')} valeur={vue} onChange={setVue} options={[{ cle: 'articles', libelle: tr('agent.vue.articles') }, { cle: 'couverture', libelle: tr('agent.vue.couverture') }]}/>
      <div className="n-pa-outils-d">
        <Bouton variante="teinte" onClick={() => setMenuSites(true)} attrs={{ 'data-pa-sites': sitesVus.join(',') }}>{tr('agent.sitesChoisis', { liste: ordinateur ? (sitesVus.map((s) => NOM[s]).join(', ') || '—') : String(sitesVus.length) })}</Bouton>
        <Bouton variante="texte" onClick={() => setTic((t) => t + 1)} attrs={{ 'data-pa-relire': '' }}>{tr('agent.relire')}</Bouton>
      </div>
    </div>
  );
  const nPret = prets.length;
  const plein = vue === 'articles' && Array.isArray(lignes) && lignes.length
    ? (enCours ? <Bouton variante="plein" onClick={() => { arret.current = true; }} attrs={{ 'data-pa-arreter': '' }}>{tr('egalite.selection.annuler')}</Bouton>
      : <Bouton variante="plein" indisponible={!nPret} raison={!nPret ? tr('agent.rienAPublier') : ''} onClick={publier} attrs={{ 'data-pa-publier': String(nPret) }}>{tr('agent.publier', { n: nPret })}</Bouton>)
    : null;

  const tableau = () => (
    <Groupe attrs={{ 'data-pa-tableau': '' }}>
      <table className="n-pa-table">
        <thead><tr>
          <th scope="col" className="n-pa-th">{tr('agent.col.article')}</th>
          <th scope="col" className="n-pa-th">{tr('agent.col.categorie')}</th>
          {sitesVus.map((s) => <th key={s} scope="col" className="n-pa-th" data-pa-th={s}>{NOM[s]}</th>)}
        </tr></thead>
        <tbody>{lignes.map((l) => (
          <tr key={l.f.cle} className="n-pa-tr" tabIndex={0} data-pa-article={l.f.cle} data-pa-questions={String(l.q.questions.length)} onClick={() => ouvrir(l)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(l); } }}>
            <td className="n-pa-td"><div className="n-pa-td-article"><Vignette src={l.a.photo || ''} alt="" taille={44}/><span className="n-pa-article"><span className="n-pa-article-titre">{l.a.titre || '—'}</span>
              <span className="n-pa-article-sous">{[l.f.numero ? 'N°' + l.f.numero : '', l.f.champs.pointure ? l.f.champs.pointure.v : '', l.f.champs.marque ? l.f.champs.marque.v : ''].filter(Boolean).join(' · ') || ' '}</span></span></div></td>
            <td className="n-pa-td" data-pa-col="categorie" data-pa-vide={l.f.champs.categorie ? undefined : '1'}>{l.f.champs.categorie ? libelleCategorie(l.f.champs.categorie.v) : tr('agent.sansCategorie')}</td>
            {l.plans.map((p) => cellule(l, p))}
          </tr>))}</tbody>
      </table>
    </Groupe>
  );
  const rangees = () => (
    <Groupe attrs={{ 'data-pa-liste': '' }}>{lignes.map((l) => <Rangee key={l.f.cle} vignette={<Vignette src={l.a.photo || ''} alt=""/>} titre={l.a.titre || '—'} lignes={2} sousTitre={sousDe(l)} sousLignes={2}
      plaque={l.f.numero ? <Plaque numero={l.f.numero}/> : null} pastille={resume(l)} fin="chevron" onClick={() => ouvrir(l)}
      attrs={{ 'data-pa-article': l.f.cle, 'data-pa-questions': String(l.q.questions.length) }}/>)}</Groupe>
  );
  const cv = Array.isArray(lignes) ? couverture(lignes.map((l) => l.f), mem, { corr }) : null;
  const vueCouverture = () => (!cv || !cv.lignes.length ? <Vide phrase={tr('agent.couv.vide')}/> : ordinateur ? (
    <Groupe pied={tr('agent.couv.pied')} attrs={{ 'data-pa-couverture': String(cv.lignes.length) }}>
      <table className="n-pa-table">
        <thead><tr><th scope="col" className="n-pa-th">{tr('agent.col.categorie')}</th><th scope="col" className="n-pa-th n-pa-th-n">{tr('agent.vue.articles')}</th>
          {SITES_AGENT.map((s) => <th key={s} scope="col" className="n-pa-th">{NOM[s]}</th>)}</tr></thead>
        <tbody>{cv.lignes.map((x) => <tr key={x.cle} className="n-pa-tr n-pa-tr-fixe" data-pa-cat={x.cle}>
          <td className="n-pa-td"><span className="n-pa-article-titre">{libelleCategorie(x.cle)}</span><span className="n-pa-article-sous">{x.chemin}</span></td>
          <td className="n-pa-td n-pa-td-n">{x.n}</td>
          {SITES_AGENT.map((s) => <td key={s} className="n-pa-td" data-pa-couv={s + ':' + x.sites[s]}><span className="n-pa-etiquette" data-pa-ton={x.sites[s] === 'sure' ? 'accent' : x.sites[s] === 'demander' ? 'ambre' : 'neutre'}>{tr('agent.couv.' + x.sites[s])}</span></td>)}
        </tr>)}</tbody>
      </table>
    </Groupe>
  ) : (
    <Groupe pied={tr('agent.couv.pied')} attrs={{ 'data-pa-couverture': String(cv.lignes.length) }}>{cv.lignes.map((x) => <Rangee key={x.cle} titre={libelleCategorie(x.cle)} valeur={String(x.n)} lignes={2} sousLignes={2}
      sousTitre={SITES_AGENT.map((s) => NOM[s] + ' ' + tr('agent.couv.' + x.sites[s]).toLowerCase()).join(' · ')} attrs={{ 'data-pa-cat': x.cle }}/>)}</Groupe>
  ));

  return (
    <>
      <PagePoussee ouverte={ouverte} titre={tr('agent.titre')} libelleRetour={tr('agent.retour')} onRetour={onRetour} plein={plein} attrs={{ 'data-pa-ecran': '', 'data-pa-vue': vue, 'data-pa-mise': ordinateur ? 'tableau' : 'liste' }}>
        {outils}
        {lignes === undefined ? <Attente forme="rangees" n={4} vignette={56} titre/>
          : lignes === null ? <Vide phrase={tr('agent.pasSu')}/>
          : !lignes.length ? <Vide phrase={tr('agent.vide')}/>
          : <>
            <p className="n-pa-compte" data-pa-n={String(lignes.length)}>{tr('agent.n', { n: lignes.length })}</p>
            {vue === 'couverture' ? vueCouverture() : ordinateur ? tableau() : rangees()}
            {vue === 'articles' && cv && cv.sansCategorie ? <Groupe nu pied={tr('agent.couv.sans', { n: cv.sansCategorie })}/> : null}
          </>}
      </PagePoussee>
      <Feuille ouverte={menuSites} onFermer={() => setMenuSites(false)} titre={tr('agent.sites')} attrs={{ 'data-pa-menu-sites': '' }}>
        <Groupe>{SITES_AGENT.map((s) => <Rangee key={s} titre={NOM[s]} fin={choix.has(s) ? 'coche' : null}
          onClick={() => setChoix((c) => { const n = new Set(c); if (n.has(s)) n.delete(s); else n.add(s); return n; })} attrs={{ 'data-pa-site-choix': s, 'data-pa-coche': choix.has(s) ? '1' : '0' }}/>)}</Groupe>
      </Feuille>
      {lq ? <FeuilleQuestionOuFiche l={lq} onFermer={() => setQuestion('')} onEnregistrer={enregistrer} texteRelu={texteRelu} etatCase={etatCase}/> : null}
    </>
  );
}

// Un article sans question : sa fiche neutre (ce qui est lu, d'où) et l'état de chaque site.
function FeuilleQuestionOuFiche({ l, onFermer, onEnregistrer, texteRelu, etatCase }) {
  if (l.q.questions.length) return <FeuilleQuestion cible={{ fiche: l.f, q: l.q, plans: l.plans }} onFermer={onFermer} onEnregistrer={onEnregistrer}/>;
  const ch = l.f.champs;
  const val = (k) => { const x = ch[k]; if (!x) return null; const v = Array.isArray(x.v) ? (k === 'photos' ? String(x.v.length) : x.v.join(', ')) : k === 'categorie' ? libelleCategorie(x.v) : String(x.v); return v; };
  const de = (k) => (ch[k] ? (ch[k].de === 'reponse' ? tr('agent.fiche.reponse') : tr('agent.fiche.lu', { site: NOM[String(ch[k].de).replace(/-vignette$/, '')] || ch[k].de })) : tr('agent.fiche.pasLu'));
  return (
    <Feuille ouverte onFermer={onFermer} titre={tr('agent.fiche.titre')} detentes={['moitie', 'pleine']} attrs={{ 'data-pa-fiche': l.f.cle }}>
      <Groupe>{['categorie', 'marque', 'pointure', 'etat', 'couleurs', 'matieres', 'photos', 'prix'].map((k) => <Rangee key={k} titre={tr('agent.champ.' + k)}
        sousTitre={de(k)} valeur={val(k) || '—'} attrs={{ 'data-pa-champ': k, 'data-pa-lu': ch[k] ? '1' : '0' }}/>)}</Groupe>
      <Groupe>{l.plans.map((p) => <Rangee key={p.site} titre={tr('agent.fiche.sur', { site: NOM[p.site] })} lignes={2} sousLignes={3}
        sousTitre={p.refus ? tr('agent.refus.' + p.refus.code, { marque: p.refus.marque || '' }) : texteRelu(l, p) || Object.entries(p.valeurs).filter(([k, v]) => typeof v === 'string' && !['rubrique', 'sous'].includes(k)).map(([k, v]) => v + ' (' + tr('agent.origine.' + (p.origine[k] || 'fiche')) + ')').join(' · ')}
        pastille={<Etiquette etat={etatCase(l, p)}/>} attrs={{ 'data-pa-plan': p.site }}/>)}</Groupe>
    </Feuille>
  );
}
