# 23 nov. 2026 — Les 7 prochains jours des colis (lot `claude/calendrier-semaine`)

Validé par Julien le 23 nov. (n° 2) : « vue jour par jour des colis à envoyer, retraits et leurs dates limites LUES
(estimations marquées comme telles) ; touche ⇒ fiche ».

## Ce qui est fait

- **Où** : Aujourd'hui › carte « Colis » › rangée « Les 7 prochains jours › » (seulement s'il y a un colis à envoyer ou
  à retirer) ⇒ une feuille (`src/calendrierSemaine/CalendrierSemaine.jsx`, montée par `src/aujourdhui/Branche.jsx`).
- **Jour par jour** (jour de PARIS, aujourd'hui + 6) : les envois puis les retraits, chacun avec sa date limite ; une
  date estimée porte la pastille « estimée ». À part, jamais cachés : « En retard » (une limite LUE dépassée),
  « Estimation passée » (date estimée, pas lue : « vérifie sur le site » — jamais « en retard »), « Plus tard »,
  « Sans date limite connue » (+ le NOMBRE de colis eBay / Leboncoin / Vestiaire à envoyer, dont la liste datée n'est
  pas publiée : « leur date limite est dans Colis »).
- **Toucher** : un envoi ouvre la fiche de SON N° (`vrm:fiche-paire`, le N° de la fiche ou le tampon de son lot) ;
  sans N°, Colis ; un retrait ouvre « À retirer ».
- **Aucune règle neuve** (`src/calendrierSemaine.js`, pur) : il RANGE les publications des écrans propriétaires —
  envois : `vrm_colis_aposter.liste` (`limiteExpedition` : e-mail du bordereau, sinon vente + 7 j estimée) ; retraits :
  `vrm_colis_retirer.colis` (limite lue `[0]`, sinon le jour de Paris de `limiteAt`, sinon `limiteEstimee` = arrivée +
  la garde mesurée de SON transporteur, sinon « sans date »). Publication absente ⇒ « pas encore lus : ouvre Colis /
  Achats », jamais une semaine vide prise pour « rien ».
- Textes `cal.*` dans `src/i18n/langues/{fr,en,es,it,de}/colisplus.js` ; Quoi de neuf `calendrier-semaine`.

## Preuves

- `node scripts/audit-calendrier-semaine.cjs` : **17 verts** sur des publications inventées à la forme réelle (dont
  23 h 30 UTC = le lendemain à Paris, `limiteAt` 23 h 15 UTC, Colissimo sans garde mesurée). Mutations rouges (7/7) :
  `estimee-retard`, `garde-pretee`, `utc`, `perdu`, `passu`, `vue-date`, `titre`. Code d'avant : le module n'existe pas.
- Banc de rendu : voir « ÉTAT À LA REPRISE ».

## ÉTAT À LA REPRISE

- Branche poussée ; banc 390/1512 et PR après 15:30 UTC ; fusion pas avant le 24 nov. 07:00 UTC.
- Ce qui reste : les envois eBay / Leboncoin / Vestiaire ne sont que comptés (leur liste datée n'est pas publiée par
  Colis) ; les publier demanderait d'étendre `vrm_colis_aposter` (même règle `colisAutres`) — pas fait ici.

Geste de Julien : aucun.
