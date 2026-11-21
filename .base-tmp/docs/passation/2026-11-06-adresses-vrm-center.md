# 6 nov. — Adresses @vrm.center (réception par ImprovMX)

Julien : « au lieu de vrm.vinted, on peut faire autre chose, comme ça je peux me servir de l'adresse partout ».

Constat : le domaine `vrm.center` (DNS chez Vercel, `ns1/ns2.vercel-dns.com`) n'avait AUCUN
enregistrement MX : aucune adresse @vrm.center ne recevait. La boîte collectrice reste
`vrm.vinted35@gmail.com` (`api/_lib/proprietaire-email.js`, `ADRESSE_COLLECTRICE`), où tourne le
script `scripts/gmail-forwarder.gs`.

Posé le 6 nov. (Vercel → DNS de vrm.center, via l'outil Vercel) :
- MX `mx1.improvmx.com` (priorité 10) et `mx2.improvmx.com` (20) ;
- TXT `v=spf1 include:spf.improvmx.com ~all` (y ajouter Brevo/SES quand l'envoi sera branché :
  un SEUL enregistrement SPF par domaine, compléter celui-ci).

Sans effet tant que Julien n'a pas créé son compte ImprovMX (gratuit) avec `vrm.vinted35@gmail.com`
et ajouté le domaine `vrm.center`. Alias prévus, tous vers `vrm.vinted35@gmail.com` :
`contact@`, `factures@`, `recu@` (et `*@` en attrape-tout si voulu).

Bascule de l'app — SEULEMENT après un e-mail d'essai vers `recu@vrm.center` vu arriver en base
(`email_reception_*`) : `ADRESSE_COLLECTRICE` et l'adresse montrée dans « Relier ma boîte »,
`public/legal/editeur.js` + `src/contact.js` (`contact@vrm.center`, les deux identiques —
`audit-lancement`). L'ancienne adresse Gmail reste acceptée (transferts existants).
