// ══════════════════════════════════════════════════════════════════════════════
// « RELIER LA BOÎTE DE <COMPTE> » (6 nov., onglets C — demande de Julien :
// « on doit être beaucoup plus accompagné par l'app »)
// ══════════════════════════════════════════════════════════════════════════════
// Mesuré le 6 nov. sur sa base : 3 comptes Vinted sur 9 n'ont envoyé AUCUN e-mail
// à VRM depuis 30 jours (dont un avec 9 ventes en cours) ; les trois ont une
// adresse « Masquer mon adresse » d'Apple, et aucune ligne de réception n'a jamais
// porté une adresse relais. Leurs bordereaux, codes de retrait et messages
// n'arrivent donc pas.
//
// Ce module ne crée AUCUNE règle neuve (§11) : « ce compte n'envoie rien » est la
// règle des comptes muets (`etatEmailsComptes`, App.jsx — une PREUVE : des ventes
// qui auraient dû produire un e-mail et n'en ont produit aucun). Il la PROJETTE
// pour l'accompagnement :
//   · `comptesARelier`   — les comptes muets, avec leur adresse Vinted et la
//                          messagerie suggérée par son domaine ;
//   · `boitesQuiArrivent` — les boîtes qui arrivent DÉJÀ à VRM (adresses des
//                          comptes qui reçoivent ; jamais un relais) : la cible
//                          la plus simple pour un relais d'Apple ;
//   · `verifRelie`       — la VÉRIFICATION : « relié » seulement sur une preuve
//                          LUE (un e-mail rangé au nom de ce compte, plus récent
//                          que le dernier connu quand il a été jugé muet).
//                          Lecture ratée ⇒ `null` (pas su), jamais « relié ».
// Trois états partout : `undefined` en cours · `null` pas su · valeur lue.
// Pur : aucune lecture, aucun React.
// ══════════════════════════════════════════════════════════════════════════════
import { messagerieDeAdresse } from './relierBoite.js';
import { ligneEmailsCompte } from './emailsCompteLie.js';

// `etat` : le résultat de `etatEmailsComptes` ({ etat, lignes, muets }) ;
// `adresses` : `vinted_account_emails` ({ uid: adresse }).
export function comptesARelier(etat, adresses, maintenant = Date.now()) {
  if (etat === undefined || etat === null) return etat;
  if (etat.etat === 'encours') return undefined;
  if (etat.etat !== 'lu') return null;
  const adr = adresses && typeof adresses === 'object' ? adresses : {};
  return (Array.isArray(etat.muets) ? etat.muets : [])
    .filter((l) => l && l.statut === 'muet' && l.uid)
    .map((l) => {
      const adresse = String(adr[l.uid] || '').trim().toLowerCase();
      const ligne = ligneEmailsCompte('lu', l, maintenant);
      return {
        uid: String(l.uid), login: String(l.login || l.uid), adresse,
        messagerie: adresse ? messagerieDeAdresse(adresse) : 'autre',
        nSansEmail: Number(l.nSansEmail) || 0, jours: ligne && ligne.jours != null ? ligne.jours : null,
        jamais: !!l.jamais, dernier: l.last || '',
      };
    })
    .sort((a, b) => b.nSansEmail - a.nSansEmail || (a.login < b.login ? -1 : a.login > b.login ? 1 : 0));
}

// La phrase d'un compte à relier : la PREUVE, en mots (jamais une supposition).
export function phraseARelier(c) {
  if (!c) return '';
  const quand = c.jours != null ? `aucun e-mail depuis ${c.jours} j` : 'aucun e-mail reçu';
  const v = c.nSansEmail > 0 ? `${c.nSansEmail} vente${c.nSansEmail > 1 ? 's' : ''} sans ${c.nSansEmail > 1 ? 'leur' : 'son'} e-mail` : '';
  return [quand, v].filter(Boolean).join(' · ');
}

// Les boîtes qui arrivent DÉJÀ à VRM : l'adresse des comptes qui REÇOIVENT
// (statut `recoit` de la même règle), sans les relais d'Apple (un relais n'est pas
// une boîte). Une suggestion pour « Transférer à » — c'est lui qui choisit.
export function boitesQuiArrivent(etat, adresses) {
  if (!etat || etat.etat !== 'lu') return [];
  const adr = adresses && typeof adresses === 'object' ? adresses : {};
  const vues = new Set();
  for (const l of (Array.isArray(etat.lignes) ? etat.lignes : [])) {
    if (!l || l.statut !== 'recoit') continue;
    const a = String(adr[l.uid] || '').trim().toLowerCase();
    if (!a || !a.includes('@') || messagerieDeAdresse(a) === 'relais-apple') continue;
    vues.add(a);
  }
  return [...vues].sort();
}

// LA VÉRIFICATION. `dernier` : la date du dernier e-mail rangé au nom du compte,
// LUE à l'instant (`''` = aucun ; `null` = lecture ratée ; `undefined` = en cours).
// `repere` : le dernier e-mail connu quand le compte a été jugé muet (`''` = jamais).
// Rend 'encours' · 'passu' · 'attente' · 'relie'.
export function verifRelie(dernier, repere) {
  if (dernier === undefined) return 'encours';
  if (dernier === null) return 'passu';
  const t = Date.parse(dernier || '');
  if (!Number.isFinite(t)) return 'attente';
  const r = Date.parse(repere || '');
  return !Number.isFinite(r) || t > r ? 'relie' : 'attente';
}
