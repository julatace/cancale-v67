// Only controlled categories are copied. Never include raw errors, account IDs,
// links, tokens or notification contents in a shared diagnostic.
export function controleOuvertureFavori(r){
 const meta=r?.controleOuverture||{},version=r?.data?.version||meta.version;
 const preuve=r?.ok===true&&['confirmee','non_confirmee','en_attente'].includes(r?.data?.preuve)?r.data.preuve:'ouverture_non_confirmee';
 const texte=String(r?.error||r?.data?.message||'');
 const motifs=[
  ['notifications_non_affichees',/Ouvre les notifications sur Vinted/],
  ['extension_a_actualiser',/nécessite l’extension|Installe puis recharge|code de l’extension ne correspond|code chargé|Installe la 5\./],
  ['compte_vrm_different',/même compte VRM|compte VRM de l’ouverture|session VRM a changé/],
  ['compte_vinted_different',/autre compte Vinted|compte connecté a changé/],
  ['compte_vinted_absent',/aucun compte Vinted n'est connecté|compte introuvable/],
  ['capture_indisponible',/historique ne peut pas être lu|historique ne confirme pas|capture ne confirme pas|capture est trop volumineuse/],
  ['lien_incompatible',/lien natif de ce favori n’est pas reconnu|lien de ce favori n’est pas unique/],
  ['extension_sans_reponse',/Aucune réponse|ne répond pas|Accusé de l’extension absent|L’ouverture n’a pas été confirmée/],
  ['verification_en_cours',/vérification des extensions est encore en cours/],
  ['ouverture_refusee',/L’ouverture dans Vinted n’a pas abouti/],
 ];
 const code=motifs.find(([,re])=>re.test(texte))?.[0]||(['vinted-pause','vinted-absent','vinted-autre','origine'].includes(r?.code)?r.code:r?.ok?'':'refus_non_classe');
 return {diagnostic:'VRM-favoris-controle-v1',extension:/^\d+\.\d+\.\d+$/.test(version||'')?version:'non_confirmee',ouvert:r?.ok===true&&r?.data?.ouvert===true,preuve,
  raison:['contexte_ou_format_incompatible','enregistrement_non_confirme','capture_pas_recue'].includes(r?.data?.raison)?r.data.raison:'',
  etape:['connexion','version','commande','transport','exception'].includes(meta.etape)?meta.etape:'retour_extension',code};
}
