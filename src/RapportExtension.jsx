// ═══════════════════════════════════════════════════════════════════════════
// L'EXTENSION 5.371 DANS L'APP (12 nov., lot agent2-ext-boutique)
//   · `BoutonRapportExtension` — Paramètres → « Tout va bien ? » : « Envoyer un
//     rapport ». C'est l'EXTENSION qui l'envoie (commande `rapportExtension`) :
//     l'état technique seulement, rejoué par la liste blanche du serveur
//     (api/_lib/rapport-extension.js). Jamais un texte, un pseudo, une adresse,
//     un e-mail, un montant.
//   · `RapportsExtensionProprio` — au PROPRIÉTAIRE seul, à côté des alertes de
//     production : la dernière version, le navigateur et la session de chaque
//     vendeur qui a envoyé un rapport ; le détail d'un vendeur à la demande.
//   · `FileReseauExt` — les gestes lancés hors ligne qui attendent le réseau dans
//     l'extension (sorte, heure, « Annuler ») ; rien ⇒ rien d'affiché.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { vmrCmd, vmrExtPresent, onVmrExt, __vmrEtat, enTeteSession, EXT_CAPACITES, vmrExtVersion } from './App.jsx';
import './styles-rapport-extension.css';

const cmpV = (a, b) => { const x = String(a || '').split('.').map(Number), y = String(b || '').split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
const extA = (cap) => { try { return vmrExtPresent() && cmpV(vmrExtVersion(), EXT_CAPACITES[cap]) >= 0; } catch (_) { return false; } };
const heureFr = (t) => { try { return new Date(Number(t)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
const dateFr = (t) => { try { return new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return '—'; } };

export function BoutonRapportExtension() {
  const [etat, setEtat] = React.useState('');   // '' · 'envoi' · 'ok' · 'ko'
  const [raison, setRaison] = React.useState('');
  const possible = extA('rapportext');
  const envoyer = async () => {
    setEtat('envoi'); setRaison('');
    let r = null; try { r = await vmrCmd({ cmd: 'rapportExtension' }, 15000); } catch (_) { r = null; }
    if (r && r.accepte) { setEtat('ok'); return; }
    setEtat('ko'); setRaison((r && r.raison) || 'L’extension n’a pas répondu.');
  };
  return (
    <div className="vrm-rapext" data-rapport-ext={etat || 'pret'}>
      <button type="button" className="vrm-b vrm-b-secondaire" data-rapport-ext-envoyer="" disabled={!possible || etat === 'envoi'} onClick={envoyer}>
        {etat === 'envoi' ? 'Envoi…' : 'Envoyer un rapport de l’extension'}
      </button>
      <p className="vrm-rapext-note">
        {!possible ? 'Il faut l’extension 5.371 dans ce navigateur.'
          : etat === 'ok' ? 'Rapport envoyé ✓'
          : etat === 'ko' ? raison
          : 'État technique seulement. Jamais tes messages, pseudos ou montants.'}
      </p>
    </div>
  );
}

// Les gestes en attente de réseau, dits par l'extension de CE navigateur.
const SORTES = { reponse: 'Réponse', offre: 'Offre', refus: 'Refus d’offre', favori: 'Message favori', geste: 'Geste' };
export function FileReseauExt() {
  const [, force] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => onVmrExt(force), []);
  const [annule, setAnnule] = React.useState({});
  const e = __vmrEtat;   // liaison vivante (ESM) : l'état du battement de l'extension
  const file = e && e.ok && Array.isArray(e.fileReseau) ? e.fileReseau.filter((x) => x && x.id && !annule[x.id]) : [];
  if (!file.length) return null;
  const annuler = async (id) => {
    setAnnule((a) => ({ ...a, [id]: 'envoi' }));
    let r = null; try { r = await vmrCmd({ cmd: 'fileReseauAnnuler', id }, 8000); } catch (_) { r = null; }
    if (!(r && r.accepte)) setAnnule((a) => { const b = { ...a }; delete b[id]; return b; });
  };
  return (
    <div className="vrm-filereseau" role="status" data-file-reseau={file.length}>
      <b className="vrm-filereseau-titre">{file.length > 1 ? `${file.length} gestes en attente de réseau` : '1 geste en attente de réseau'}</b>
      <ul>
        {file.slice(0, 5).map((x) => (
          <li key={x.id} data-file-reseau-id={x.id}>
            <span>{SORTES[x.sorte] || SORTES.geste} · lancé à {heureFr(x.at)}</span>
            <button type="button" className="vrm-lien-action" data-file-reseau-annuler={x.id} onClick={() => annuler(x.id)}>Annuler</button>
          </li>
        ))}
      </ul>
      <span className="vrm-filereseau-sous">Ils repartent seuls au retour du réseau (24 h au plus).</span>
    </div>
  );
}

// Au PROPRIÉTAIRE : un rapport par vendeur (la ligne la plus récente), le détail à la demande.
export function RapportsExtensionProprio({ fetcher = (typeof fetch === 'function' ? fetch.bind(globalThis) : null) }) {
  const [liste, setListe] = React.useState(undefined);   // undefined lecture · null pas su · []
  const [ouvert, setOuvert] = React.useState(null);
  const [detail, setDetail] = React.useState(undefined);
  React.useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const r = await fetcher('/api/compte?mode=rapport-extension', { headers: enTeteSession ? enTeteSession() : {}, cache: 'no-store' });
        const j = r.ok ? await r.json() : null;
        if (vivant) setListe(j && j.ok && Array.isArray(j.vendeurs) ? j.vendeurs : null);
      } catch (_) { if (vivant) setListe(null); }
    })();
    return () => { vivant = false; };
  }, []);
  const voir = async (de) => {
    if (ouvert === de) { setOuvert(null); return; }
    setOuvert(de); setDetail(undefined);
    try {
      const r = await fetcher('/api/compte?mode=rapport-extension&de=' + encodeURIComponent(de), { headers: enTeteSession ? enTeteSession() : {}, cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      setDetail(j && j.ok && Array.isArray(j.rapports) ? j.rapports : null);
    } catch (_) { setDetail(null); }
  };
  if (liste === undefined) return null;
  return (
    <div className="vrm-rapext-proprio" data-rapports-ext={liste === null ? 'pas-su' : liste.length}>
      <b className="vrm-rapext-titre">Rapports de l’extension</b>
      {liste === null ? <p className="vrm-rapext-note">Pas lus — réessaie plus tard.</p>
        : !liste.length ? <p className="vrm-rapext-note">Aucun rapport reçu.</p>
        : (
          <ul>
            {liste.slice(0, 30).map((v) => (
              <li key={v.de} data-rapport-ext-de={v.de}>
                <button type="button" className="vrm-rapext-ligne" aria-expanded={ouvert === v.de ? 'true' : 'false'} onClick={() => voir(v.de)}>
                  <span>{dateFr(v.at)} · {v.version || '—'} · {v.navigateur} · session {v.session}{v.origine === 'boutique' ? ' · boutique' : ''}</span>
                </button>
                {ouvert === v.de ? (
                  detail === undefined ? <p className="vrm-rapext-note">Lecture…</p>
                    : detail === null ? <p className="vrm-rapext-note">Pas lu.</p>
                    : <pre className="vrm-rapext-detail" data-rapport-ext-detail="">{JSON.stringify(detail[detail.length - 1] || {}, null, 1)}</pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
