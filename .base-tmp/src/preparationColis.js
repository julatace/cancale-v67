export const empreinteColis=({owner='',compte='',transaction='',numero=''})=>JSON.stringify([String(owner),String(compte),String(transaction),String(numero).trim()]);
export function controlePreparation(lignes,coches,verifications={}){
 const selection=lignes.filter(l=>coches.has(l.cle));
 const verifies=selection.filter(l=>verifications[l.cle]===l.signature).length;
 return {selection:selection.length,verifies,reste:selection.length-verifies};
}
