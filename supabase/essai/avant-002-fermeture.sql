-- Avant 002 sur la base d'essai (12 nov., agent2-fiabilite-prod) : 002 suppose
-- l'index unique `app_data_owner_id_uniq`, créé À LA MAIN sur la vraie base fin
-- septembre (jamais écrit dans une migration). Ici, sur une base vide, on le pose.
create unique index if not exists app_data_owner_id_uniq on public.app_data (owner, id);
