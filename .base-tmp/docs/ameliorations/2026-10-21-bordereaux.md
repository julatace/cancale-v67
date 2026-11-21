# Bordereaux et retraits — 21 octobre 2026

La génération automatique des bordereaux Vinted est désormais **désactivée par défaut**. Ventes propose un interrupteur enregistré dans une ligne dédiée `vrm_bordereaux_auto`, appartenant au vendeur authentifié. Aucune préférence n'est reprise de l'ancien comportement automatique. Une lecture impossible ne vaut jamais une autorisation.

L'extension 5.204 relit la préférence avant le lot et juste avant chaque demande automatique d'étiquette. La génération manuelle et la récupération des PDF déjà émis restent possibles. Une demande déjà envoyée à Vinted ne peut pas être annulée par l'interrupteur. Les extensions antérieures doivent être remplacées pour respecter ce choix.

Les retraits confirmés par email sont conservés face aux rappels tardifs ; les photos sont rapprochées par suivi ou transaction, jamais par titre. Les tests utilisent exclusivement des données fictives. Le rapprochement reste conservateur : une ambiguïté laisse la photo absente.

Le correctif de protection de l'app (PR633) est déployé. La migration de droits Supabase 021 reste à appliquer par l'administrateur : aucun accès d'administration Supabase n'est disponible dans cet environnement. Ne pas confondre protection de l'interface et correction des droits en base.
