// ════════════════════════════════════════════════════════════════════════════
//  LA SIGNATURE DU NOUVEAU DESIGN (17 nov., Julien : « fais quelque chose d'original, de parfait, de nickel »).
//  Original ≠ décoratif : UNE identité tirée de SON métier — il écrit un N° sur chaque carton. Partagée par tous les
//  écrans du nouveau design (Annonces, Achats, Aujourd'hui ; Ventes, Argent et Stock la reprennent) :
//    1. `Etiquette`      — l'étiquette carton du N° (kraft clair, nuit kraft sombre, coin coupé, œillet percé) ;
//                          `double` = deux paires présentes sous ce N° : la MÊME étiquette, bord rouge (le seul rouge) ;
//    2. `ChiffreAffiche` — le chiffre utile de l'écran, 56/700 tabulaire, son mot sur la même ligne de base, une fois ;
//    3. `Ticket`         — un code de retrait est un ticket : bord perforé, code en 44 tabulaire, QR seulement s'il existe ;
//    4. `RangeeFaite`    — le seul mouvement : une rangée faite (imprimée, retirée, rangée) glisse et se replie en 220 ms
//                          avec un petit coche, puis le geste part ; mouvement réduit : un fondu.
//  Aucune règle ici : on reçoit le N° (par identité), le nombre, le code, déjà décidés par l'écran.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { nombre } from '../i18n/index.js';
import './signature.css';

// 1. L'ÉTIQUETTE N°. `taille` : 'petit' (rangée, 24 px), 'moyen' (photo, passe), 'grand' (une place du Stock).
export function Etiquette({ num, double = false, taille = 'petit', titre }) {
  if (!num) return null;
  return (
    <span className={'v2-etiquette is-' + taille + (double ? ' is-double' : '')} data-v2-etiquette={num} data-double={double ? '1' : undefined}
      title={titre || undefined} aria-label={'N° ' + num}>
      <i className="v2-etiquette-oeillet" aria-hidden="true"/>
      <small aria-hidden="true">N°</small><b aria-hidden="true">{num}</b>
    </span>
  );
}

// 2. LE CHIFFRE D'AFFICHE. `n` : un nombre (formaté fr-FR, espace fine), `null` = pas su (« — »).
//    `unite` (« € ») se pose collée au chiffre ; `mot` sur la même ligne de base ; `sous` en dessous (l'écart nommé).
//    `attente` : la lecture est EN COURS (≠ « pas su ») — un pavé de la taille du chiffre, la même boîte, la ligne du
//    dessous réservée : rien ne bouge quand le chiffre arrive (17 nov., « quand ça charge tout bouge bizarrement »).
export function ChiffreAffiche({ n, unite = '', mot, sous = '', ambre = false, attrs = {}, attente = false }) {
  const txt = n == null || !Number.isFinite(Number(n)) ? '—' : nombre(Number(n));
  return (
    <div className="v2-affiche-sig v2-affiche-reserve" data-v2-affiche={attente || n == null ? '' : String(n)} data-v2-attente={attente ? '1' : undefined} aria-busy={attente ? 'true' : undefined} {...attrs}>
      <div className="v2-affiche-sig-ligne">
        <b className="v2-affiche-sig-n">{attente ? <span className="v2-affiche-attente" aria-hidden="true"/> : txt}{unite && txt !== '—' ? <span className="v2-affiche-sig-unite">{' ' + unite}</span> : null}</b>
        {mot ? <span className="v2-affiche-sig-mot">{mot}</span> : null}
      </div>
      <div className={'v2-affiche-sig-sous' + (ambre && !attente ? ' is-ambre' : '')} data-v2-ecart="">{attente ? '\u00a0' : (sous || '\u00a0')}</div>
    </div>
  );
}

// 3. LE TICKET. `haut` : ce qui est au-dessus de la perforation (la date limite, AU-DESSUS du QR) ; `qr` : un nœud ou rien
//    (jamais fabriqué) ; `code` : le code en grand ; `children` : sous le code (la paire, les gestes).
export function Ticket({ haut = null, qr = null, code = '', codeVide = null, children, attrs = {} }) {
  return (
    <div className="v2-ticket" {...attrs}>
      {haut ? <div className="v2-ticket-haut">{haut}</div> : null}
      <div className="v2-ticket-perfo" aria-hidden="true"/>
      <div className="v2-ticket-corps">
        {qr}
        {code ? <b className="v2-ticket-code" data-v2-code-grand="">{code}</b> : codeVide}
        {children}
      </div>
    </div>
  );
}

// 4. LA RANGÉE FAITE. `fait` passe à vrai ⇒ coche + glisse + repli (220 ms), puis `onFin()` (le geste réel part alors).
//    Mouvement réduit : un fondu de 160 ms. Le compteur d'affiche descend quand la donnée change (rien d'inventé).
export function RangeeFaite({ fait = false, onFin, children, className = '', attrs = {} }) {
  const ref = React.useRef(null);
  const fini = React.useRef(false);
  React.useEffect(() => {
    if (!fait || fini.current) return undefined;
    const reduit = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } })();
    const t = setTimeout(() => { fini.current = true; if (onFin) onFin(); }, reduit ? 160 : 260);
    return () => clearTimeout(t);
  }, [fait, onFin]);
  return (
    <div ref={ref} className={'v2-faite' + (fait ? ' is-faite' : '') + (className ? ' ' + className : '')} data-v2-faite={fait ? '1' : '0'} {...attrs}>
      <div className="v2-faite-dedans">{children}</div>
      {fait ? <span className="v2-faite-coche" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span> : null}
    </div>
  );
}

// 5. LE SQUELETTE : la forme EXACTE des rangées (photo, titre, ligne de faits) pendant la lecture — jamais d'écran blanc.
//    `variante` 'A' (Liste, 88 px) ou 'C' (Détaillé, 120 px) ; un balayage lent, coupé en mouvement réduit.
export function SqueletteRangees({ variante = 'A', n = 8, label = '' }) {
  return (
    <div className={'v2-squelette v2-squelette-' + variante} role="status" aria-busy="true" aria-label={label || undefined} data-v2-squelette={variante}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="v2-squelette-rangee" aria-hidden="true">
          <span className="v2-squelette-photo"/>
          <span className="v2-squelette-txt"><span className="v2-squelette-l1"/><span className="v2-squelette-l2"/>{variante === 'C' ? <span className="v2-squelette-l3"/> : null}</span>
        </div>
      ))}
    </div>
  );
}

// 6. QUAND C'EST LU : rien n'est posé avant que les lectures d'un bloc soient arrivées, puis TOUT d'un coup, à sa place
//    (17 nov., « quand ça charge tout bouge bizarrement ») ; une lecture qui ne répond pas n'enferme rien : 10 s au plus.
//    Lu une fois, lu pour de bon (une relecture ne rend pas le bloc vide).
export function QuandLu({ pret, children, attente = null }) {
  const deja = React.useRef(false);
  const [delai, setDelai] = React.useState(false);
  React.useEffect(() => { if (pret) return undefined; const t = setTimeout(() => setDelai(true), 10000); return () => clearTimeout(t); }, [pret]);
  if (pret || delai) deja.current = true;
  return deja.current ? children : attente;
}
