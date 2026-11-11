# Fiscalité des revendeurs hors de France : étude et conception (11 nov. 2026)

> **Lot d'ÉTUDE.** Aucun code applicatif, aucune écriture en base, aucune PR.
> Branche `claude/fiscalite-pays`. Décision de Julien du 11 nov. : VRM traduit en anglais,
> espagnol, italien et allemand, « compta comprise ». Elle **remplace** celle du 28 oct.
> (« VRM reste sur la France », CLAUDE.md §3, ligne « International »). ⚠️ La ligne du §3 ne
> sera changée qu'avec le premier lot codé. Jusque-là, rien dans l'app ne change.

---

## 0. À lire d'abord : la fiabilité de ce document

**Aucune page officielle n'a été ouverte directement.** Le réseau de la session a refusé
tous les sites (ENOTFOUND sur boe.es, sede.agenciatributaria.gob.es, seg-social.es,
agenziaentrate.gov.it, inps.it, normattiva.it, gesetze-im-internet.de,
bundesfinanzministerium.de, gov.uk, revenue.ie).

Chaque chiffre ci-dessous vient d'un **extrait rendu par le moteur de recherche**. La
recherche était limitée aux domaines officiels, et chaque chiffre porte l'URL de son
document. Le texte entier n'a pas été relu.

Niveaux de certitude :
- **haute** : plusieurs documents officiels concordent ;
- **moyenne** : un seul extrait officiel ;
- **non vérifié** : aucun document officiel trouvé. Un tel chiffre n'est **pas** donné comme un fait.

Toutes les consultations datent du **11/11/2026**.

⚠️ **Règle pour le lot qui codera** (CLAUDE.md §2.3 et §5 « Les chiffres ») : aucun chiffre
de ce document n'entre dans `src/` sans avoir été **relu sur sa page officielle**, comme
`src/profilFiscal.js` l'a fait pour la France (« vérifié le … » recopié). Il faut d'abord
autoriser ces hôtes dans le réseau de la session (geste de Julien, Réglages de
l'environnement) : `www.boe.es`, `sede.agenciatributaria.gob.es`, `www.seg-social.es`,
`www.agenziaentrate.gov.it`, `www.inps.it`, `www.normattiva.it`,
`www.gazzettaufficiale.it`, `www.gesetze-im-internet.de`, `www.bundesfinanzministerium.de`,
`www.elster.de`, `www.bzst.de`, `www.revenue.ie`, `www.citizensinformation.ie`, `www.gov.uk`.

---

## 1. Ce qui est COMMUN aux quatre pays de l'UE (et utile tout de suite)

| règle | contenu | sources | certitude |
|---|---|---|---|
| **DAC7** | la plateforme déclare le vendeur sauf s'il a fait **moins de 30 ventes ET au plus 2 000 €** sur l'année. Donc 30 ventes, ou plus de 2 000 €, suffisent. Seuil **par plateforme**, par vendeur et non par compte (DE). | ES : boe.es BOE-A-2024-1771 (RD 117/2024), modelo 238 ; IT : agenziaentrate.gov.it `cs-21-novembre-2023` + FAQ gestori ; DE : gesetze-im-internet.de/psttg §4 + FAQ BZSt ; IE : revenue.ie `…/dac7/excluded-sellers.aspx` | haute (IT, IE) · moyenne (ES, DE) |
| **Être déclaré ≠ devoir de l'impôt** | DAC7 règle seulement la transmission ; il ne dit pas si les ventes sont imposables | DE : PStTG ; UK : gov.uk `reporting-rules-for-digital-platforms` | moyenne |
| **Régime de la marge sur l'occasion** | il existe partout (directive TVA 2006/112, art. 311 et suivants). TVA sur (prix de vente − prix d'achat), **jamais affichée** sur la facture, mention obligatoire, achats à des particuliers. | voir chaque pays | moyenne |
| **Pas de seuil chiffré particulier → pro** | partout, c'est un faisceau de critères (habitude, intention de profit, achat pour revendre). Aucun chiffre officiel. | ES : seg-social.es (« habitual, personal y directa ») ; IT : Risposta 426/2019, Ris. 41/2020 ; DE : §15 Abs.2 EStG ; UK : BIM20205 « badges of trade » | haute (IT) · moyenne |

⇒ Le même texte que la France vaut : **« VRM ne peut pas choisir à ta place »** (`AIDE_NEUTRE`).
Seules les sources changent.

---

## 2. Espagne (ES)

### Statuts
- **Autónomo** : affiliation au RETA (« habitual, personal y directa »), demandée **avant** le
  début, au plus 60 jours avant. Source : seg-social.es `…/Afiliacion/10548/32825`. Moyenne.
- **Alta censal** : modelo **036**, **avant** le début (case 111). L'activité commence dès le
  1er achat fait pour revendre. Source : sede.agenciatributaria.gob.es, guía 036 cap. 06
  « inicio-actividad ». Moyenne.
  - Le **037 serait supprimé** depuis le 3/2/2025 (Orden HAC/1526/2024, BOE-A-2025-410). Moyenne.
- **IRPF, estimación directa simplificada** : le cas ordinaire.
- **IRPF, módulos (estimación objetiva)** : seuils 2026 de 250 000 € (achats et recettes) et
  125 000 € (recettes facturées à des pros). L'épigraphe IAE 651.6 « comercio al por menor de
  calzado » figure dans l'ordre 2026 (Orden HAC/1425/2025, BOE-A-2025-25272). Moyenne.
  - ⚠️ L'AEAT dit le REBU « incompatible con el régimen simplificado » d'IVA, que les módulos
    exigent. On en **déduit** que les módulos sont fermés à qui applique le REBU. **Faible, à
    confirmer** par un conseiller.

### TVA (IVA)
- **Pas de franchise en base.** La directive 2020/285 n'est pas transposée au 11/11/2026 : le
  Plan de control tributario 2026 (BOE-A-2026-5843) parle encore d'une « previsible
  incorporación ». Moyenne.
- **Recargo de equivalencia** (5,2 % sur une IVA à 21 %) : obligatoire pour un détaillant
  personne physique, **mais il exclut les biens d'occasion**. Source : manual IVA 2025,
  cap. 06 « aplicacion-recargo-equivalencia ». Moyenne.
- **REBU** (Ley 37/1992, art. 135 et suivants, BOE-A-1992-28740) :
  - facultatif, on peut y renoncer opération par opération ;
  - base = marge moins l'IVA qu'elle contient ;
  - deux méthodes : opération par opération, ou marge globale par période. En marge globale,
    une marge négative donne 0 et se reporte ;
  - un document d'achat **signé par le vendeur particulier** est exigé.
  - Source : sede.agenciatributaria.gob.es `…/regimen-especial-bienes-usados/funcionamiento-rebu.html`.
    Moyenne. Les numéros d'articles ne sont pas vérifiés.
- **Taux normal 21 %** : vu seulement indirectement, dans la table du recargo. **À relire.**
- **Déclarations** : modelo **303** trimestriel (1er–20 avril, juillet, octobre ; 1er–30 janvier)
  et modelo **390** annuel (30 premiers jours de janvier). Source : sede, `modelo-390 …/plazos-presentacion`.
  Moyenne à haute.

### Impôt sur le revenu
- **Pago fraccionado, modelo 130** : 20 % du rendement net cumulé depuis le 1er janvier, aux
  mêmes dates que le 303. Un trimestre à zéro se déclare quand même. Source : sede, folleto
  actividades económicas 3.7, procédure G601. Moyenne à haute.
- **Date d'une recette** : par défaut l'**exigibilité (devengo)**, c'est-à-dire la date de VENTE,
  pas celle du versement. Option « cobros y pagos » (encaissement) cochée dans le modelo 100,
  pour au moins 3 ans (RD 439/2007). Moyenne. ⚠️ **C'est l'inverse de la France** : voir §6.

### Cotisations (RETA 2026)
- Cotisation par **tranches de revenus réels** : table réduite de 3 tranches et table générale
  de 12. Bases de 653,59 € à 5 101,20 €/mois (Orden PJC/297/2026, art. 8). Moyenne.
- **Taux et montants en euros : non vérifiés.**
- **Tarifa plana 2026 : non vérifiée.** Elle valait 80 €/mois en 2023-2025 ; depuis 2026, elle
  est « fijada por la Ley de Presupuestos ».

### Factures et registres
- **Facture simplifiée** : ≤ 400 € TTC, ou ≤ 3 000 € TTC pour la vente au détail à un
  consommateur (RD 1619/2012, art. 4 et 7, BOE-A-2012-14696). Moyenne à haute.
- **Mention REBU** : « Régimen especial de los bienes usados » (RD 1619/2012, art. 6.1.o).
  Moyenne.
- ⚠️ **Verifactu** (RD 1007/2023, reporté par le RDL 15/2025) : **1/7/2027 pour les
  autónomos**. Tout logiciel qui émet des factures devra être conforme. Source : sede, nota
  informativa « ampliación plazo ». Moyenne à haute.
  - Si VRM émet une facture espagnole après cette date, **VRM devient un « sistema informático
    de facturación »** soumis au décret. C'est un chantier à part entière.
- **Livres** : ventes, achats, biens d'investissement (Orden HAC/773/2019). Moyenne. Les livres
  d'IVA et le registre REBU ne sont pas vérifiés.

---

## 3. Italie (IT) — la mieux sourcée

### Statuts
- **Habituel = reddito d'impresa** (art. 55 TUIR) ; **occasionnel = redditi diversi**
  (art. 67 c.1 lett. i, rigo RL14). Sources : Risposta 426/2019, Ris. 41/2020, Ris. 126/2011.
  Haute.
- **Partita IVA** : modèle **AA9/12** dans les **30 jours** du début. Source : agenziaentrate,
  scheda `aa9_11-apertura…/quando-utilizzare`. Haute.
  - Pour une ditta individuale commerciale, il passe par la Comunicazione Unica. Moyenne.
- **Code ATECO 2025** : plus de code « vente en ligne » ; le classement se fait par marchandise
  (circ. ISA 11/E du 18/07/2025). Candidats **47.79.31** (vêtements d'occasion) ou **47.79.39**.
  Moyenne. Que des chaussures relèvent de 47.79.31 n'est pas vérifié.

### Regime forfettario (L. 190/2014, art. 1, c. 54-89) — l'équivalent de la micro-entreprise
| règle | valeur | source | certitude |
|---|---|---|---|
| seuil d'accès | **85 000 €** de ricavi l'année précédente | circ. 32/E du 05/12/2023 | haute |
| dépassé entre 85 000 et 100 000 € | sortie l'année **suivante** | idem | haute |
| dépassé au-delà de 100 000 € | sortie **immédiate** (TVA dès l'encaissement qui fait franchir) | idem, Risposta 149/2025 | haute |
| coefficient de rentabilité, commerce de détail | **40 %** | L. 145/2018, Allegato 2 (gazzettaufficiale.it) | haute (rattachement ATECO 2025 non vérifié) |
| impôt de substitution | **15 %**, **5 %** l'année du début et les 4 suivantes (3 conditions) | agenziaentrate scheda « nuova attività » ; Risposta 226/2024 | haute |
| date d'une recette | **encaissement (cassa)** | circ. 10/E/2016 | moyenne |
| revenu imposable | ricavi × 40 % − cotisations INPS versées | idem | moyenne |
| TVA | aucune TVA facturée ni versée, aucune déclaration IVA | comma 59 ; agenziaentrate « fattura elettronica per i forfettari » | haute |
| mention de facture | « Operazione effettuata ai sensi dell'art. 1, commi da 54 a 89, L. 190/2014 », régime fiscal **RF19** | idem | haute |
| marca da bollo | **2 €** sur une facture sans TVA **> 77,47 €** (« bollo virtuale ») | agenziaentrate, guide bollo fatture elettroniche ; Risposta 428/2022 | haute |

### Régime ordinaire
- **TVA 22 %** (agenziaentrate « norme generali e aliquote »). Haute.
- **Liquidations** : mensuelles, ou trimestrielles sur option jusqu'à 800 000 € (+1 %
  d'intérêt). Haute.
- **Regime del margine** (D.L. 41/1995, art. 36+) : méthode analytique, globale ou
  forfaitaire ; pas de TVA sur la facture, code nature **N5**. Sources : Ris. 73/2007,
  Risposta 215/2019, Risposta 497/2022. Moyenne.

### Factures
- ⚠️ **Facture électronique par le SdI obligatoire pour tous les forfettari depuis le
  1/1/2024**. Haute.
  - Une facture italienne est un **XML FatturaPA transmis au SdI**. Un PDF envoyé par e-mail,
    comme la Facture Pro de VRM aujourd'hui, **n'est pas une facture valable en Italie**.
- **Vente en ligne à un particulier, livrée par transporteur** (« commercio elettronico
  indiretto ») : **dispensée** de corrispettivi telematici (DM 10/05/2019, Risposta 416/2020).
  Moyenne : rien de postérieur à 2020.
  - Une facture n'est donc due que si l'acheteur la demande.

### Cotisations INPS (gestione commercianti, 2026)
- Revenu minimal **18 808 €** ; taux **24,48 %** jusqu'à 56 224 €, puis 25,48 % ; plus
  0,62 €/mois de maternité. Source : circolare INPS n. 14 du 09/02/2026. Haute.
- **Minimum annuel environ 4 600 €** : calcul de l'agent, **non vérifié comme montant officiel**.
- Échéances 2026 du minimum : 18/05, 20/08, 17/11/2026, puis 16/02/2027. Haute.
- **Réduction de 35 % pour les forfettari**, sur demande. Source : inps.it scheda « riduzione
  contributiva ». Haute. Délai de demande à l'ouverture : non vérifié.

### Calendrier
- **Solde et 1er acompte le 30 juin** (+30 jours avec 0,40 %), **2e acompte le 30 novembre**.
  Source : agenziaentrate « come si paga l'irpef ». Haute.
- **Redditi PF 2026** en ligne jusqu'au 02/11/2026. Haute.
- Report au 20/07/2026 (« D.L. 89/2026 ») : **non vérifié**.
- **Registres** : le forfettario est dispensé de registres IVA et de comptabilité ; il numérote
  et conserve ses factures d'achat. Haute.

---

## 4. Allemagne (DE)

### Statuts
- **Gewerbe** (§15 Abs.2 EStG) : activité durable, avec intention de profit, sur le marché.
  Déclaration au Gewerbeamt au début (§14 GewO, payante, transmise au Finanzamt). Moyenne.
- **Ventes privées** (§23 EStG) : exonérées sous une Freigrenze de **1 000 €** de gain par an
  depuis 2024. Les objets d'usage courant sont hors §23. Moyenne.

### TVA
- **Kleinunternehmer §19 UStG (depuis le 1/1/2025)** : pas de TVA si le CA de l'année
  précédente est ≤ **25 000 €** et celui de l'année en cours ≤ **100 000 €**. Source :
  gesetze-im-internet.de/ustg_1980/__19.html, lettre BMF du 18/03/2025. Moyenne.
  - Dépasser 100 000 € en cours d'année : la vente qui fait franchir est **déjà taxée**.
  - Dépasser 25 000 € : régime normal au 1er janvier suivant.
  - La renonciation engage pour 5 ans.
  - Le CA se compte en « vereinnahmte Entgelte » (sommes encaissées).
  - Une lettre BMF du 10/11/2025 existe sur ce régime ; **elle n'a pas été lue**.
- **Mention §19** : un renvoi à l'exonération, par exemple « steuerfreier Kleinunternehmer ».
  Une TVA affichée devient due (§14c). Moyenne.
- **Differenzbesteuerung §25a UStG** : pour un revendeur qui a acheté sans TVA déductible.
  Pas de TVA sur la facture. Enregistrement **article par article** (prix de vente, prix
  d'achat, base). Mention « **Gebrauchtgegenstände/Sonderregelung** » (§14a Abs.6). Source :
  UStAE 25a.1. Moyenne.
- **Taux normal 19 %** : **non vérifié** (page non ouverte).
- **Déclarations de TVA** (§18 Abs.2) : trimestrielles en règle générale, mensuelles au-delà de
  9 000 € de TVA l'année précédente, dispense possible sous 2 000 €. Moyenne.
  - Le mensuel obligatoire des créateurs est suspendu pour 2021-2026 ; 2027 et après : non vérifié.

### Impôt sur le revenu et Gewerbesteuer
- **EÜR** (§4 Abs.3 EStG) et **principe d'encaissement** (§11 EStG) : la recette compte l'année
  où l'argent arrive. Moyenne.
- **Grundfreibetrag 2026 : 12 348 €** (§32a EStG). Moyenne à haute.
  - Le barème est progressif et dépend de tout le foyer : **VRM ne peut pas estimer l'impôt**.
- **Gewerbesteuer** : abattement **24 500 €** pour une personne physique, Steuermesszahl 3,5 %,
  puis le taux de la commune (§11 GewStG). Moyenne à haute.
  - Le taux communal n'est pas connu de VRM : pas d'estimation.

### Cotisations
- **Pas de retraite obligatoire** pour un Gewerbetreibender hors artisanat. Cotisation
  volontaire 2026 de 112,16 € à 1 571,70 €/mois (deutsche-rentenversicherung.de). Moyenne.
- **Assurance maladie obligatoire**, avec un montant propre à chaque caisse. **Aucun taux
  calculable sur le CA** : rien comme l'URSSAF.

### Factures et registres
- **Kleinbetragsrechnung** ≤ **250 € TTC** (§33 UStDV). Moyenne.
- **E-Rechnung** : seulement **entre entreprises**. Depuis 2025, toute entreprise doit pouvoir
  en recevoir ; le papier reste admis jusqu'au 31/12/2026, ou 31/12/2027 sous 800 000 €. Le
  Kleinunternehmer est dispensé d'en émettre. Source : FAQ BMF E-Rechnung, lettre du
  15/10/2025. Moyenne. Une vente à un particulier n'est pas concernée.
- **Mentions §14 Abs.4 UStG : non vérifiées.**
- **§22 UStG** (registres) et **GoBD** (manuel AO 2026, annexe 33). Moyenne.

---

## 5. Royaume-Uni et Irlande (pour l'anglais)

### Royaume-Uni : ⛔ hors d'atteinte aujourd'hui
Tout y est en **livres** : trading allowance 1 000 £, TVA 90 000 £, MTD 50 000 £ (2026),
30 000 £ (2027), 20 000 £ (2028). L'année fiscale va du 6 avril au 5 avril.

Or VRM **écarte toute vente en GBP** (CLAUDE.md §3 : « jamais convertie ») : il ne saurait
même pas faire la somme. MTD exige en plus un logiciel reconnu par HMRC, avec des envois
trimestriels.

Sources (moyenne à haute) :
- gov.uk `tax-free-allowances-on-property-and-trading-income`, `become-sole-trader`,
  `self-assessment-tax-returns/deadlines`, `use-making-tax-digital-for-income-tax`,
  `vat-registration/when-to-register` ;
- gov.uk `self-employed-national-insurance-rates` : Class 4 à 6 % entre 12 570 et 50 270 £,
  Class 2 plus obligatoire depuis avril 2024 ;
- DAC7 britannique (SI 2023/817, IEIM901630) : mêmes seuils de 30 ventes / 2 000 €.

⇒ **L'anglais de l'interface, oui ; la compta britannique, non**, tant que VRM ne connaît que
l'euro. C'est une décision de Julien à prendre explicitement.

### Irlande : possible plus tard (euro)
- **Form 11, Pay and File** : 31/10, ou 18/11/2026 par ROS. **Preliminary tax** : 90 % / 100 % / 105 %.
- **PRSI Class S 4,35 %** depuis le 1/10/2026, exonérée sous 5 000 €. **USC** par tranches.
- **TVA** : seuil biens **85 000 €** (2025), régime de la marge (× 23/123), taux 23 % à confirmer.
- Sources : revenue.ie (filing, preliminary tax, margin scheme), citizensinformation.ie
  (PRSI, USC). Moyenne à haute.
- Aucun prélèvement forfaitaire sur le CA : comme en Allemagne, l'impôt est progressif et VRM
  ne peut pas l'estimer.

---

## 6. CONCEPTION pour VRM

### 6.1 Le principe : le PAYS devient une réponse, comme le statut
- **Nouvelle clé `vrm_pays_fiscal`** : `'FR' | 'ES' | 'IT' | 'DE' | 'IE' | null`, dans
  `SYNC_KEYS`, écrite **sur son clic seulement**.
  - **Absente** chez un vendeur qui a déjà un `vinted_regime` ⇒ `'FR'`. Ses régimes actuels
    (`micro`, `societe`, `marge`) sont des régimes **français** : ce n'est pas deviner, c'est
    lire ce qu'il a déjà choisi. Rien n'est écrit en base, aucune migration (§5).
  - Absente sans régime ⇒ `null` ⇒ la configuration demande le pays.
- **`vinted_regime` reste français.** Un régime étranger vit dans une clé à part,
  `vrm_regime_pays` = `{ pays, regime, options, at }`. Un vendeur italien ne peut donc jamais
  hériter par erreur du « micro » français, de ses 12,4 % et de ses rappels URSSAF. Les
  régimes possibles :
  - IT : `privato` · `forfettario` · `ordinario` · `margine` ;
  - DE : `privat` · `kleinunternehmer` · `regelbesteuerung` · `differenz` ;
  - ES : `particular` · `autonomo-directa` · `autonomo-rebu` ;
  - IE : `private` · `sole-trader` · `margin`.
- **`profilFiscal()` prend `pays`** et rend la même forme qu'aujourd'hui : `urssaf`,
  `cotisations`, `dac7`, `seuils`, `tva`, `mots`, `phrase`, `sources`. On y ajoute :
  - `datation: 'versement' | 'vente'` (voir 6.3) ;
  - `certitude: 'verifie' | 'a-verifier'`.
  - `cotisationsUrssaf()` reste vrai **seulement** pour (`FR`, `micro`). `audit-configuration-depart`
    doit l'exiger.

### 6.2 Une règle par pays, un fichier par pays, chaque chiffre sourcé
```
src/fiscal/
  commun.js       DAC7 (30 / 2 000 €, la règle actuelle de seuilsAnnee.js, DÉPLACÉE pas recopiée),
                  calcul de la TVA sur marge (marge × t/(100+t)), « au moins … sur N »
  fr.js           ce qui existe (profilFiscal + microEntreprise), inchangé, simplement rangé
  it.js · de.js · es.js · ie.js
```
Chaque chiffre est un objet `{ valeur, source: URL, lu: 'AAAA-MM-JJ', certitude }`. Un audit
`audit-fiscal-pays.cjs` refuse un chiffre sans source ou sans date de lecture.

Une année sans chiffres vérifiés rend `null` (comme `seuilsDe`) : la jauge se tait plutôt que
de comparer à un seuil périmé.

### 6.3 Ce qui reste COMMUN (déjà juste, rien à refaire)
- **Les ventes datées.** VRM a déjà les deux dates : VENDU = `ventesFaites` (date de vente),
  REÇU = `ventesDeclarables` (date de versement).
  - Encaissement = IT forfettario (cassa), DE EÜR (§11 EStG), IE et UK (cash basis), FR micro.
  - ⚠️ **ES par défaut = date de VENTE** (devengo), sauf option « cobros y pagos ».
  - ⇒ `profilFiscal.datation` choisit la liste, et l'écran dit laquelle (« daté au jour de la
    vente / du versement »). **Jamais un mélange.**
- **La couverture** « au moins … sur N », le manque NOMMÉ, « — » pour « pas su ».
- **DAC7** : déjà par plateforme (`verdictDac7`), mêmes seuils partout dans l'UE.
  - ⇒ **Un particulier ES/IT/DE/IE est servi dès le premier lot**, sans aucun nouveau chiffre fiscal.
- **L'export comptable** (`src/exportComptable.js`) : livre des recettes, registre des achats.
  - Seuls changent les libellés (traduits), le séparateur décimal (virgule en ES/IT/DE, point
    en IE) et la colonne de la date retenue.
- **Le registre des achats** : il sert la TVA sur marge partout, avec le prix d'achat saisi PAR
  LUI (§2.5). Prix manquant ⇒ marge non calculée pour cette paire, et c'est dit.

### 6.4 Ce qui CHANGE par pays (et ce que VRM a le droit d'en faire)
| pays | VRM peut calculer | VRM se contente de rappeler et d'exporter | VRM se tait |
|---|---|---|---|
| **IT forfettario** | jauge 85 000 / 100 000 € ; revenu imposable = recettes × 40 % ; impôt 15 % ou 5 % (sa réponse « années depuis le début ») ; INPS 24,48 % au-delà du minimum, −35 % si sa réponse est oui | échéances 30/06, 30/11, INPS 4 dates ; bollo 2 € > 77,47 € | le minimum INPS en euros tant qu'il n'est pas relu |
| **DE Kleinunternehmer** | jauge 25 000 € (année précédente) / 100 000 € (année en cours), datée à l'encaissement | mention §19 ; dates des déclarations de TVA | impôt sur le revenu, Gewerbesteuer (commune), assurance maladie |
| **DE §25a** | TVA sur marge par paire (19 % une fois relu) | registre article par article | idem |
| **ES autónomo** | IVA REBU par paire (21 % une fois relu) ; modelo 130 = 20 % du rendement cumulé (recettes − achats saisis, **au moins**) | dates 303/130/390 (20 avril, juillet, octobre, 30 janvier) | RETA (barème et taux non relus) ; módulos |
| **IE** | TVA sur marge (23 % une fois relu), jauge 85 000 € | Pay and File 31/10 | impôt, PRSI, USC (progressifs) |

**Ce qui n'est pas certain s'affiche avec « À vérifier avec ton comptable »** (et la source
officielle en lien), **jamais un montant**. C'est le pendant de « une sonde qui n'a pas
répondu n'est pas un feu vert ».

### 6.5 Les factures : le point le plus dangereux
- **IT** : une facture valable = **XML FatturaPA par le SdI**. La Facture Pro (PDF par e-mail)
  **ne doit pas être proposée** à un forfettario italien comme « facture ». Proposer plutôt :
  - « VRM prépare le fichier, ton intermédiaire SdI l'envoie » (comme Factur-X en France) ;
  - ou rien. Pour une vente en ligne livrée, rien n'est dû tant que l'acheteur ne demande pas
    de facture.
- **ES** : à partir du **1/7/2027**, Verifactu touche tout logiciel qui émet des factures.
  - Avant : facture simplifiée et mention REBU possibles.
  - Après : **pas de facture espagnole émise par VRM** sans un chantier Verifactu dédié.
- **DE** : vente à un particulier ⇒ Kleinbetragsrechnung ≤ 250 € et mention §19 ou §25a. C'est
  le pays où la Facture Pro se transpose le plus facilement, une fois le §14 Abs.4 relu.
  ⛔ Décision du 11 nov. : **le seul pays retenu pour la Facture Pro, et seulement sur le papier**
  tant qu'un Steuerberater n'a pas relu les mentions. Aucune facture allemande n'est émise par VRM d'ici là.
- **Langue** : la facture française reste bilingue (loi Toubon, `src/facturePro/anglais.js`).
  Pour un vendeur étranger, la facture est dans **sa** langue, avec les mentions de **son**
  pays, traduites une fois et **sans IA** (§2.9).

### 6.6 Écrans touchés
- **Configuration de départ** (`src/configurationDepart.js`, `ConfigurationDepart.jsx`) :
  nouvelle 1re étape fiscale « Dans quel pays déclares-tu ? ». L'étape `statut` montre alors
  les choix de CE pays. Les étapes `micro`/`societe` deviennent `options` par pays.
- **Réglages → Statut** (`src/ecrans/Reglages.jsx`) : pays + régime + sources.
- **Comptabilité** (`src/ecrans/Compta.jsx`) : la carte « Prochaine déclaration », la jauge
  des seuils (`seuilsAnnee.js`, `microEntreprise.js`) et le calendrier
  (`calendrierUrssaf` → `calendrierPays`).
- **Ma journée** : rappels (`rappelDac7Journee` est déjà neutre).
- **Export comptable**, **Facture Pro** (voir 6.5), **Livre de police**.
  - ⚠️ Le livre de police est une obligation **française** (Code pénal R321) : il ne doit pas
    être proposé ailleurs comme obligatoire.
- **Serveur** : `api/_lib/urssaf-regle.js` et les rappels (`ship-reminders`). Un vendeur hors
  FR ne reçoit **aucun** rappel URSSAF. C'est déjà le cas s'il n'a pas de `vinted_regime`
  `micro`, mais il faut le prouver par un banc.

### 6.7 Risques
1. **Un chiffre fiscal faux est grave** : il fait payer trop ou trop peu, ou il rate une sortie
   de régime. D'où les règles : relire chaque chiffre à la source, afficher « à vérifier »,
   et ne jamais calculer ce qui est progressif.
2. **L'héritage du français** : 12,4 %, URSSAF, « TVA non applicable, art. 293 B du CGI »,
   livre de police, CFE, case 5TA/5KO.
   - ⇒ un banc par pays qui cherche ces mots sur tous les écrans d'un vendeur IT/DE/ES et doit
     n'en trouver **aucun** (sur la règle `data-*`, pas sur le libellé, §6.4 de CLAUDE.md).
3. **La date de recette en Espagne** : par vente, pas par versement. Se tromper décale le CA
   d'un trimestre.
4. **Factures** : SdI (IT), Verifactu (ES). Une « facture » VRM non conforme est pire que pas de
   facture.
5. **La devise** : GBP impossible (UK). Les comptes Vinted IT/ES/DE sont en euros : rien ne change.
6. **Les CGV, l'abonnement Stripe et la TVA de VRM elle-même** sur un client étranger (OSS) :
   **hors de ce lot**, mais bloquants avant d'encaisser un vendeur étranger.

### 6.8 Découpage en lots, par valeur
| lot | contenu | chiffres nouveaux | valeur |
|---|---|---|---|
| **P0 · relire les sources** | session avec réseau ouvert : relire chaque chiffre de ce document sur sa page ; noter « lu le » ; corriger | — | prérequis absolu |
| **P1 · pays + particulier** | `vrm_pays_fiscal`, étape « Dans quel pays déclares-tu ? », régimes « particulier » ES/IT/DE/IE : DAC7 (déjà juste), aide neutre et sources du pays ; aucun mot français (banc) | aucun (DAC7 = UE) | haute, risque faible |
| **P2 · Italie forfettario** | jauge 85 000 / 100 000 €, revenu × 40 %, 15 % / 5 %, INPS avec « à vérifier » sur le minimum, calendrier 30/06 et 30/11, bollo | IT relus | haute (le plus proche de la micro, le mieux sourcé) |
| **P3 · Allemagne Kleinunternehmer + §25a** | jauge 25 000 / 100 000 €, TVA sur marge par paire, mention de facture, Kleinbetragsrechnung | DE relus | moyenne à haute |
| **P4 · export comptable par pays** | libellés, date retenue, format décimal | — | moyenne |
| **P5 · Espagne** | datation à la vente, IVA REBU, modelo 130 en « au moins », dates 303/130 ; RETA tue | ES relus | moyenne, la plus risquée |
| **P6 · factures étrangères** | ⛔ **tranché le 11 nov.** : Allemagne SEULE, et seulement dans l'étude — **rien de branché dans l'app tant qu'un expert local (Steuerberater) n'a pas relu** les mentions (§14 Abs.4, §19, §25a, Kleinbetragsrechnung). IT (SdI) et ES (Verifactu) : pas de facture | — | gelé jusqu'à la relecture |
| **P7 · Irlande** | marge, jauge 85 000 € ; impôt tu | IE relus | faible (peu de Vinted IE) |

---

## 7. Recommandation : commencer par l'ITALIE (après P0 et P1)

1. **C'est la mieux sourcée** : presque tout est « haute », sur des circulaires de l'Agenzia et
   de l'INPS datées de 2023 à 2026.
2. **Le forfettario a la même forme que la micro-entreprise française** :
   - un seuil (85 000 €) et une sortie immédiate (100 000 €) ;
   - une recette datée à l'**encaissement**, c'est-à-dire `ventesDeclarables` tel quel ;
   - un coefficient forfaitaire (40 %) et un taux fixe (15 % ou 5 %).
   - ⇒ VRM peut y rendre **le même service** qu'en France (« combien je mets de côté »), avec
     la même règle de datation, sans rien deviner.
3. **Vinted est très présent en Italie.**
4. Le gros piège (la facture SdI) **s'évite** en ne proposant pas la Facture Pro au début : une
   vente en ligne livrée n'exige pas de facture sauf si l'acheteur la demande.

**L'Allemagne vient ensuite** : le Kleinunternehmer est simple (deux seuils, une mention), mais
VRM n'y estime aucun impôt.

**L'Espagne en dernier** : pas de franchise, REBU, datation à la vente, RETA non vérifié,
Verifactu en 2027.

**Le Royaume-Uni est exclu** tant que VRM ne connaît que l'euro.

**Mais d'abord P1** : un particulier de n'importe quel pays de l'UE a déjà un VRM juste (DAC7),
pourvu qu'aucun mot français (URSSAF, micro) ne lui soit montré. C'est le lot le plus utile
et le moins risqué.

### Gestes de Julien
- **Autoriser les hôtes officiels** du §0 dans le réseau de l'environnement, pour que la
  session P0 relise les sources.
- **Confirmer** que la décision du 11 nov. remplace la ligne « International » du §3.
- **Trancher** : le Royaume-Uni (interface en anglais seulement, sans compta ?).
- ✅ **Tranché le 11 nov.** (la session qui pilote ce lot, sur délégation de Julien) : la Facture Pro
  hors de France commence par l'**Allemagne seule**, et **uniquement dans l'étude**. Rien n'est
  branché dans l'app tant qu'un expert local n'a pas relu les mentions (§6.5, lot P6).
