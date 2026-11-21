export function inspectionFavoriSure(v){
 const r={};for(const k of ['liensFavoris','memeArticle','exacts','visibles','natifsMemeArticle','natifs','natifsVisibles'])if(Number.isSafeInteger(v?.[k])&&v[k]>=0&&v[k]<=10000)r[k]=v[k];return r;
}
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
 const codes=['cloche_introuvable','cloche_indisponible','favori_non_trouve','favori_lien_ambigu','favori_destinataire_different','favoris_relais_indisponible','favoris_relais_sans_reponse','favoris_relais_origine','favoris_relais_invalide'];
 const code=codes.includes(r?.data?.code)?r.data.code:motifs.find(([,re])=>re.test(texte))?.[0]||(['vinted-pause','vinted-absent','vinted-autre','origine'].includes(r?.code)?r.code:r?.ok?'':'refus_non_classe');
 return {diagnostic:'VRM-favoris-controle-v1',extension:/^\d+\.\d+\.\d+$/.test(version||'')?version:'non_confirmee',ouvert:r?.ok===true&&r?.data?.ouvert===true,preuve,
  raison:['contexte_ou_format_incompatible','enregistrement_non_confirme','capture_pas_recue','destinataire_different','navigation_non_confirmee','compte_different'].includes(r?.data?.raison)?r.data.raison:'',
  etape:['connexion','version','commande','transport','exception'].includes(meta.etape)?meta.etape:'retour_extension',code,...(r?.data?.inspection?{inspection:inspectionFavoriSure(r.data.inspection)}:{})};
}

export function echecVerificationFavori(r){
 if(r?.ok!==true||r?.data?.preuve!=='non_confirmee')return '';
 if(r.data.raison==='contexte_ou_format_incompatible')return 'La réponse observée sur Vinted ne permet pas de confirmer le destinataire de ce favori. La vérification est arrêtée. Aucun message envoyé.';
 if(r.data.raison==='enregistrement_non_confirme')return 'Le lien observé sur Vinted n’a pas pu être enregistré dans VRM. La vérification est arrêtée. Aucun message envoyé.';
 if(r.data.raison==='destinataire_different')return 'Vinted a ouvert la page d’un autre destinataire ou d’un autre article. Rien n’est enregistré, aucun message envoyé.';
 if(r.data.raison==='navigation_non_confirmee')return 'Le favori a été cliqué, mais l’onglet n’a pas montré sa page de message dans les 6 secondes. Rien n’est enregistré, aucun message envoyé.';
 if(r.data.raison==='compte_different')return 'Le compte connecté a changé pendant l’ouverture. Rien n’est enregistré, aucun message envoyé.';
 return 'La liaison entre ce favori et sa conversation n’a pas été confirmée. Aucun message envoyé.';
}

// The technical report and the opening result belong to the same React account
// scope. Keep only controlled categories; never copy arbitrary extension data.
export function rapportAssistanceFavoris(rapport,controle,lancement){
 const verification=controle?{
  extension:/^\d+\.\d+\.\d+$/.test(controle.extension||'')?controle.extension:'non_confirmee',
  ouvert:controle.ouvert===true,
  preuve:['confirmee','non_confirmee','en_attente','ouverture_non_confirmee'].includes(controle.preuve)?controle.preuve:'ouverture_non_confirmee',
  etape:['connexion','version','commande','transport','exception','retour_extension'].includes(controle.etape)?controle.etape:'non_confirmee',
  code:['cloche_introuvable','cloche_indisponible','favori_non_trouve','favori_lien_ambigu','favori_destinataire_different','favoris_relais_indisponible','favoris_relais_sans_reponse','favoris_relais_origine','favoris_relais_invalide','notifications_non_affichees','extension_a_actualiser','compte_vrm_different','compte_vinted_different','compte_vinted_absent','capture_indisponible','lien_incompatible','extension_sans_reponse','verification_en_cours','ouverture_refusee','vinted-pause','vinted-absent','vinted-autre','origine','refus_non_classe'].includes(controle.code)?controle.code:'',
  raison:['contexte_ou_format_incompatible','enregistrement_non_confirme','capture_pas_recue','destinataire_different','navigation_non_confirmee','compte_different'].includes(controle.raison)?controle.raison:'',
  ...(controle.inspection?{inspection:inspectionFavoriSure(controle.inspection)}:{})
 }:{etat:'aucune_verification_dans_cette_vue'};
 const sortie={...rapport,verification};
 if(lancement){
  const diagnostic={};for(const k of ['notifications','tracesNatives','pairesNatives','formesUserId','liensExacts','parametresConfirmes','selection'])if(Number.isSafeInteger(lancement.diagnostic?.[k])&&lancement.diagnostic[k]>=0&&lancement.diagnostic[k]<=10000)diagnostic[k]=lancement.diagnostic[k];
  sortie.lancement={code:['favoris_preuve_absente','favoris_identite_non_unique'].includes(lancement.code)?lancement.code:'non_precise',diagnostic};
 }
 return sortie;
}

export function bilanOuvertureFavori(controle){
 if(!controle)return 'Aucune vérification d’ouverture dans cette vue. La capture des notifications ne prouve pas que leur destinataire est confirmé.';
 const version=/^\d+\.\d+\.\d+$/.test(controle.extension||'')?'Extension '+controle.extension+' · ':'';
 if(controle.preuve==='confirmee')return version+'Lien avec le destinataire enregistré. Cette vérification n’envoie aucun message.';
 if(controle.code==='cloche_introuvable'||controle.code==='cloche_indisponible')return version+'Blocage : la cloche Vinted n’a pas pu être reconnue ou activée.';
 if(controle.code==='favori_lien_ambigu')return version+'Blocage : plusieurs liens visibles correspondent au favori. Aucun clic ambigu effectué.';
 if(controle.code==='favori_non_trouve'||controle.code==='notifications_non_affichees')return version+'Blocage : le favori n’a pas été retrouvé dans la liste affichée sur Vinted.';
 if(/^favoris_relais_/.test(controle.code||'')||controle.code==='extension_sans_reponse')return version+'Blocage : la commande à la page Vinted n’a pas été confirmée.';
 if(controle.raison==='enregistrement_non_confirme')return version+'Blocage : l’enregistrement du lien dans VRM n’est pas confirmé.';
 if(controle.ouvert)return version+'Vinted a été activé ; le lien avec le destinataire reste non confirmé.';
 return version+'L’ouverture du favori n’est pas confirmée. Aucun message envoyé.';
}
