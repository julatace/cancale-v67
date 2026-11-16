// ═══════════════════════════════════════════════════════════════════════════
// SES CLÉS DE SUIVI GRATUITES — Colissimo / La Poste et UPS (16 nov. 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Paramètres → Ventes et colis → « Suivi Colissimo et UPS ». Le vendeur colle SA clé gratuite
// (La Poste « Suivi v2 » : une clé Okapi ; UPS « Tracking » : Client ID + Client Secret). Elle part
// UNE fois au serveur (/api/compte?mode=cles-suivi, api/_lib/cles-transporteurs.js), qui la CHIFFRE
// dans son coffre ; l'app n'en revoit que les 4 derniers caractères, la date et ce que le transporteur
// a répondu. §2.9 : jamais la clé de Julien pour les autres vendeurs ; sans clé, rien n'est demandé
// au transporteur (la ligne du colis dit « suivi non lu chez ce transporteur »).
import React from 'react';
import { BoutonBase as Bouton } from '../composants/Bouton.jsx';
import { tr } from '../i18n/index.js';

export const ROUTE_CLES_SUIVI = '/api/compte?mode=cles-suivi';
export const TRANSPORTEURS_CLE = [
  { id: 'colissimo', nom: 'Colissimo / La Poste', lien: 'https://developer.laposte.fr/products/suivi/2', champs: [{ k: 'cle', lib: 'clesSuivi.champ.okapi' }] },
  { id: 'ups', nom: 'UPS', lien: 'https://developer.ups.com', champs: [{ k: 'id', lib: 'clesSuivi.champ.upsId' }, { k: 'secret', lib: 'clesSuivi.champ.upsSecret' }] },
];
// L'état d'une clé, en mots (la même source que la ligne : la réponse du serveur).
export function etatCleTexte(c) {
  if (!c || c.etat === 'aucune') return { cle: 'clesSuivi.etat.aucune', ton: '' };
  if (c.etat === 'illisible') return { cle: 'clesSuivi.etat.illisible', ton: 'ambre' };
  if (c.verif === 'refusee') return { cle: 'clesSuivi.etat.refusee', ton: 'ambre' };
  if (c.verif === 'ok') return { cle: 'clesSuivi.etat.ok', ton: '' };
  return { cle: 'clesSuivi.etat.pasEncore', ton: '' };
}
const dateCourte = (iso) => { const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return ''; try { return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };

export default function ClesSuivi({ enTete = () => ({}), toast = () => {}, envoyer }) {
  const f = envoyer || ((u, o) => fetch(u, o));
  const [s, setS] = React.useState(undefined);         // undefined en cours · null pas su · { colissimo, ups, coffre }
  const [val, setVal] = React.useState({});             // { 'colissimo.cle': '…', 'ups.id': '…' }
  const [occupe, setOccupe] = React.useState('');
  const [confirme, setConfirme] = React.useState('');
  const [msg, setMsg] = React.useState(null);            // { carrier, texte, ton }
  const lire = React.useCallback(async () => {
    try { const r = await f(ROUTE_CLES_SUIVI, { headers: { ...(enTete() || {}) }, cache: 'no-store' }); const j = r.ok ? await r.json() : null; setS(j && j.ok ? j : null); }
    catch (_) { setS(null); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { lire(); }, [lire]);
  const appel = async (corps) => {
    try {
      const r = await f(ROUTE_CLES_SUIVI, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(enTete() || {}) }, body: JSON.stringify(corps) });
      const j = await r.json().catch(() => ({}));
      return { code: r.status, j: j || {} };
    } catch (_) { return { code: 0, j: {} }; }
  };
  const poser = async (t) => {
    const corps = { action: 'poser', transporteur: t.id };
    for (const c of t.champs) corps[c.k] = String(val[`${t.id}.${c.k}`] || '').trim();
    setOccupe(t.id); setMsg(null);
    const { code, j } = await appel(corps);
    setOccupe('');
    if (code === 200 && j && j.ok) { setS(j); setVal((v) => { const o = { ...v }; for (const c of t.champs) delete o[`${t.id}.${c.k}`]; return o; }); toast(tr('clesSuivi.toast.rangee')); return; }
    setMsg({ carrier: t.id, ton: 'ambre', texte: (j && j.message) || tr('clesSuivi.msg.reseau') });
  };
  const retirer = async (t) => {
    setOccupe(t.id); setMsg(null);
    const { code, j } = await appel({ action: 'retirer', transporteur: t.id, confirme: true });
    setOccupe(''); setConfirme('');
    if (code === 200 && j && j.ok) { setS(j); toast(tr('clesSuivi.toast.retiree')); return; }
    setMsg({ carrier: t.id, ton: 'ambre', texte: (j && j.message) || tr('clesSuivi.msg.reseau') });
  };
  const champStyle = { flex: '1 1 200px', minWidth: 0, minHeight: 44, boxSizing: 'border-box', padding: '0 12px', borderRadius: 12, border: '1px solid var(--fu-filet, rgba(0,0,0,0.12))', background: 'var(--fu-carte, #fff)', color: 'var(--fu-encre, #1d1d1f)', fontSize: 17, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };
  return (
    <div className="vrm-sc" data-cles-suivi={s === undefined ? 'lecture' : s === null ? 'pas-su' : 'lu'}>
      <p className="vrm-sc-intro">{tr('clesSuivi.intro')}</p>
      {s === null ? <div className="vrm-sc-essai is-ambre" role="status" data-cles-suivi-passu="">{tr('clesSuivi.passu')}</div> : null}
      {s && s.coffre === false ? <div className="vrm-sc-sous" data-cles-suivi-sans-coffre="">{tr('clesSuivi.sansCoffre')}</div> : null}
      {TRANSPORTEURS_CLE.map((t) => {
        const c = s ? s[t.id] : null;
        const e = etatCleTexte(c);
        const posee = !!(c && c.etat === 'posee');
        const pret = t.champs.every((x) => String(val[`${t.id}.${x.k}`] || '').trim().length >= 8);
        return (
          <section key={t.id} className="vrm-sc-bloc" data-cle-transporteur={t.id} data-cle-etat={c ? c.etat : (s === undefined ? 'lecture' : 'pas-su')} data-cle-verif={(c && c.verif) || ''}>
            <h3 data-cle-nom="" style={{ margin: '6px 0 0', fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{t.nom}</h3>
            {s ? <div className={'vrm-sc-essai' + (e.ton ? ' is-ambre' : '')} data-cle-phrase="" role="status">
              {tr(e.cle, { nom: t.nom })}{posee && c.fin ? <> · <span data-cle-fin="">…{c.fin}</span>{dateCourte(c.at) ? ` · ${dateCourte(c.at)}` : ''}</> : null}
            </div> : null}
            {s && s.coffre !== false ? (
              <form onSubmit={(ev) => { ev.preventDefault(); if (pret && !occupe) poser(t); }} style={{ display: 'grid', gap: 8 }} data-cle-form={t.id}>
                {t.champs.map((x) => (
                  <label key={x.k} style={{ display: 'grid', gap: 4 }}>
                    <span className="vrm-sc-lib">{tr(x.lib)}</span>
                    <input type="password" autoComplete="off" spellCheck={false} autoCapitalize="off" data-cle-champ={`${t.id}.${x.k}`}
                      value={val[`${t.id}.${x.k}`] || ''} onChange={(ev) => setVal((v) => ({ ...v, [`${t.id}.${x.k}`]: ev.target.value }))} style={champStyle}/>
                  </label>
                ))}
                <div className="vrm-sc-gestes">
                  <Bouton variante="primaire" type="submit" data-cle-ranger={t.id} disabled={!pret || !!occupe} occupe={occupe === t.id}>{occupe === t.id ? tr('clesSuivi.bouton.enCours') : posee ? tr('clesSuivi.bouton.remplacer') : tr('clesSuivi.bouton.ranger')}</Bouton>
                  {posee ? <Bouton variante="discret" data-cle-retirer={t.id} disabled={!!occupe} onClick={() => setConfirme(t.id)}>{tr('clesSuivi.bouton.retirer')}</Bouton> : null}
                </div>
              </form>
            ) : null}
            {confirme === t.id ? (
              <div className="vrm-sc-confirme" role="alertdialog" aria-label={tr('clesSuivi.bouton.retirer')} data-cle-confirme={t.id}>
                <span>{tr('clesSuivi.confirme', { nom: t.nom })}</span>
                <div className="vrm-sc-gestes">
                  <Bouton variante="danger" data-cle-confirmer={t.id} onClick={() => retirer(t)}>{tr('clesSuivi.bouton.retirer')}</Bouton>
                  <Bouton variante="discret" onClick={() => setConfirme('')}>{tr('clesSuivi.bouton.annuler')}</Bouton>
                </div>
              </div>
            ) : null}
            {msg && msg.carrier === t.id ? <div className="vrm-sc-essai is-ambre" role="status" data-cle-msg={t.id}>{msg.texte}</div> : null}
            <details className="vrm-sc-detail" data-cle-aide={t.id}>
              <summary>{tr('clesSuivi.aide.titre', { nom: t.nom })}</summary>
              <ol className="vrm-sc-mots">
                {[1, 2, 3].map((i) => <li key={i}>{tr(`clesSuivi.aide.${t.id}.${i}`)}</li>)}
              </ol>
              <p className="vrm-sc-sous"><a href={t.lien} target="_blank" rel="noopener noreferrer" data-cle-lien={t.id}>{t.lien.replace(/^https:\/\//, '')}</a></p>
            </details>
          </section>
        );
      })}
      <p className="vrm-sc-sous" data-cles-suivi-pied="">{tr('clesSuivi.pied')}</p>
    </div>
  );
}
