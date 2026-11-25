"""Le paquet Orion reste la base validée sur l'appareil de Julien (5.319.0),
plus SEULEMENT ce que la base commune de l'extension a changé depuis.

Histoire (docs/passation/2026-11-05-orion-base-validee.md) : Julien a confirmé
que l'archive 5.319.0 s'installe dans Orion ; la 5.322 y a appliqué la seule
demande (popup.js) « sans créer un moteur Orion séparé qui pourrait diverger des
prochaines versions ». La première version de ce contrôle comparait membre à
membre à la 5.319 et refusait tout changement hors popup.js : elle ne pouvait
plus passer dès la 5.323 (chaque version de l'extension change background.js,
vc.js…), alors que ces changements sont ceux de la base COMMUNE, publiés
partout. (8 nov., CI verte) La règle jugée est désormais :

  1. membres de la référence + oauth-retour.js de la base commune (5.328) ;
  2. l'adaptateur Orion (`compat-orion.js`) identique octet pour octet à la
     référence, et `orion-main.js` celui du dépôt ;
  3. le manifeste Orion identique à celui de la référence, version et description
     communes exceptées, avec le seul retour OAuth sur les hôtes VRM existants
     (MV2, identifiant, permissions, autres scripts de démarrage,
     ressources : la forme que Julien a vue s'installer) ;
  4. chaque autre membre est EXACTEMENT le fichier de `vinted-sync-extension/`
     (popup.html : plus la seule balise compat-orion) — aucun changement propre
     à Orion, et un paquet régénéré d'une extension périmée est refusé ;
  5. la version du paquet est celle du manifeste de l'extension.

(11 nov.) Deux changements de la base COMMUNE, publiés partout, sont approuvés
nommément (un autre ajout reste refusé) :
  · 5.339 : `vrm-regles-achat.js` + `vinted-infos.js` sur les pages Vinted
    (infos sous ses annonces, calculette) — même bloc que la base commune ;
  · politique des hôtes : un hôte RETIRÉ de la base commune (ex.
    cancale-v67-ten.vercel.app) l'est aussi du paquet Orion. Seul un retrait
    passe : un hôte ajouté ou élargi reste refusé.
  · 5.347 (lot vocabulaire-article) : `vrm-mots.js` (« paire » / « article »)
    EN TÊTE des blocs de pages qui le portent dans la base commune, juste
    après compat-orion.js — exactement ces blocs-là, rien d'autre ne bouge.
  · 5.406 (lot extension-carte-v2) : `vrm-ui.js` (surfaces communes de
    l'extension) EN TÊTE des blocs de pages qui le portent dans la base commune,
    juste après compat-orion.js ; `vrm-action.js` (écran d'action plein) à la
    FIN du bloc des infos Vinted — exactement ces blocs-là, rien d'autre.
  · 5.410.3 (lot comme-bleam, 20 nov.) : `vrm-dressing.js` (dressing amélioré) APRÈS
    vrm-action.js à la fin du bloc des infos Vinted, et `vrm-formulaire.js` (republication
    par le formulaire de Vinted) membre du paquet, injecté par background.js
    (`chrome.scripting.executeScript`, aucun bloc du manifeste) — rien d'autre.
    (21 nov., ci-offres-panneau : ce contrôle était rouge sur main depuis la 5.410.3.)
  · 5.420.0 (21 nov., ext-5420, « bordereaux en un seul PDF ») : `pdf-lib.min.js` (pdf-lib 1.17.1, MIT, le fichier
    dist tel quel), `pdf-lib.LICENSE.txt` (ses licences) et `vrm-pdf.js` (l'assembleur) membres du paquet, injectés À LA
    DEMANDE par background.js (`chrome.scripting.executeScript`, `files`, aucun bloc du manifeste) — rien d'autre.
  · (24 nov., main-rouges-24nov : ce contrôle était rouge sur main depuis la 5.418 — chaque lot a livré son
    fichier dans la base commune ET le paquet Orion sans l'approuver ici) ajouts de la base commune, approuvés
    nommément, chacun exactement comme dans `vinted-sync-extension/manifest.json` :
      5.418 `lbc-ecrire.js` (Leboncoin par l'interface) : nouveau bloc leboncoin [lbc-ecrire.js, vrm-depot-aussi.js] ;
      5.412 `vc-ecrire.js` (Vestiaire par l'interface) + 5.424 `vrm-depot-aussi.js` : APRÈS vc-depot.js dans son bloc ;
      5.429 `vrm-depot.js` (dépôt par l'interface) : juste AVANT vrm-badge.js dans son bloc ;
      5.433 `vrm-appris.js` et 5.440 `vrm-trouver.js` : injectés À LA DEMANDE par background.js
      (`chrome.scripting.executeScript`, aucun bloc du manifeste) — rien d'autre.
"""
from pathlib import Path
import zipfile
import json
root = Path(__file__).resolve().parents[2]
ext = root / 'vinted-sync-extension'
adapt = root / 'scripts' / 'extension-orion'
with zipfile.ZipFile(root/'public/VRM-Orion-reference-5.319.0.xpi') as ancien, zipfile.ZipFile(root/'public/VRM-Orion.xpi') as nouveau:
    noms = set(nouveau.namelist())
    AJOUTS_COMMUNS = [  # blocs de la base commune approuvés après la 5.319 (sans compat-orion.js)
        ['vrm-regles-achat.js', 'vinted-infos.js'],
        ['lbc-ecrire.js', 'vrm-depot-aussi.js'],  # 5.418 / 5.424 (24 nov., main-rouges-24nov)
    ]
    membres_attendus = set(ancien.namelist()) | {'oauth-retour.js'} | {n for b in AJOUTS_COMMUNS for n in b} | {'vrm-mots.js'} | {'vrm-ui.js', 'vrm-action.js'} | {'vrm-dressing.js', 'vrm-formulaire.js'} | {'pdf-lib.min.js', 'pdf-lib.LICENSE.txt', 'vrm-pdf.js'} | {'vc-ecrire.js', 'vrm-depot.js', 'vrm-appris.js', 'vrm-trouver.js'}
    assert membres_attendus == noms, f'Membres ajoutés ou retirés : {sorted(membres_attendus ^ noms)}'
    version = json.loads(nouveau.read('manifest.json'))['version']
    attendue = json.loads((ext/'manifest.json').read_text('utf8'))['version']
    assert version == attendue, f'Paquet Orion {version} ≠ extension {attendue} : paquet à régénérer (node scripts/zip-extension.cjs)'
    assert ancien.read('compat-orion.js') == nouveau.read('compat-orion.js'), "L'adaptateur Orion a changé par rapport à la référence installable"
    # 5.361 (canal privé sur Orion) : le paquet pose la source d'inject.js EN LIGNE à la place du marqueur
    # (scripts/zip-extension.cjs, sourcesEnLigne) — exactement celle-là, rien d'autre ne change.
    _marque = 'null;/*__VRM_SOURCES_PAGE__*/'
    _depot = (adapt/'orion-main.js').read_text('utf8')
    # 5.374 (vente Vestiaire mal captée sur Orion iPhone) : la source de vc-inject.js du paquet aussi, en ligne
    # (approuvé nommément : le capteur Vestiaire posé par `src` arrivait après la liste des ventes) — rien d'autre.
    _sources = {'inject.js': nouveau.read('inject.js').decode('utf8'), 'vc-inject.js': nouveau.read('vc-inject.js').decode('utf8')}
    _attendu = _depot.replace(_marque, json.dumps(_sources, ensure_ascii=False, separators=(',', ':')) + ';') if _marque in _depot else _depot
    assert nouveau.read('orion-main.js').decode('utf8') == _attendu, 'orion-main.js ne vient pas du dépôt (ou ses sources en ligne ne sont pas inject.js + vc-inject.js du paquet)'
    m_ancien = json.loads(ancien.read('manifest.json')); m_nouveau = json.loads(nouveau.read('manifest.json'))
    m_ancien.pop('version'); m_nouveau.pop('version')
    commun = json.loads((ext/'manifest.json').read_text('utf8'))
    # 5.406 : `vrm-ui.js` en tête des blocs qui le portent (avant vrm-mots.js) et `vrm-action.js`
    # à la fin du bloc des infos Vinted — dans la base commune ET dans le paquet Orion, retirés ici
    # avant les autres contrôles (qui jugent donc le reste exactement comme avant).
    UI, ACTION = 'vrm-ui.js', 'vrm-action.js'
    assert all(c['js'][0] == UI for c in commun['content_scripts'] if UI in c['js']), f'{UI} doit ouvrir chaque bloc commun qui le porte'
    ui_communs = sorted(json.dumps(c['js'][1:]) for c in commun['content_scripts'] if UI in c['js'])
    ui_orion = []
    for c in m_nouveau['content_scripts']:
        if UI in c['js']:
            assert c['js'][:2] == ['compat-orion.js', UI], f'{UI} doit suivre compat-orion.js : {c["js"]}'
            ui_orion.append(json.dumps(c['js'][2:]))
            c['js'] = [x for x in c['js'] if x != UI]
    assert sorted(ui_orion) == ui_communs, f'{UI} : blocs Orion {sorted(ui_orion)} ≠ blocs communs {ui_communs}'
    for c in commun['content_scripts']:
        c['js'] = [x for x in c['js'] if x != UI]
    DRESSING = 'vrm-dressing.js'
    for blocs, pre in ((commun['content_scripts'], []), (m_nouveau['content_scripts'], ['compat-orion.js'])):
        assert sum(DRESSING in c['js'] for c in blocs) <= 1, f'{DRESSING} : un seul bloc'
        avec = [c for c in blocs if ACTION in c['js']]
        assert len(avec) == 1 and avec[0]['js'] == [*pre, 'vrm-mots.js', 'vrm-regles-achat.js', 'vinted-infos.js', ACTION, DRESSING], f'{ACTION} puis {DRESSING} : seulement à la fin du bloc des infos Vinted ({[c["js"] for c in avec]})'
        avec[0]['js'] = avec[0]['js'][:-2]
    # 5.347 : `vrm-mots.js` en tête des blocs qui le portent dans la base commune (et seulement eux).
    MOTS = 'vrm-mots.js'
    sans_mots = lambda js: [x for x in js if x != MOTS]
    avec_mots = sorted(json.dumps(sans_mots(c['js'])) for c in commun['content_scripts'] if MOTS in c['js'])
    assert all(c['js'][0] == MOTS for c in commun['content_scripts'] if MOTS in c['js']), f'{MOTS} doit ouvrir chaque bloc commun qui le porte'
    orion_mots = []
    for c in m_nouveau['content_scripts']:
        if MOTS in c['js']:
            assert c['js'][:2] == ['compat-orion.js', MOTS], f'{MOTS} doit suivre compat-orion.js : {c["js"]}'
            orion_mots.append(json.dumps(sans_mots(c['js'])[1:]))
            c['js'] = sans_mots(c['js'])
    assert sorted(orion_mots) == avec_mots, f'{MOTS} : blocs Orion {sorted(orion_mots)} ≠ blocs communs {avec_mots}'
    for c in commun['content_scripts']:
        c['js'] = sans_mots(c['js'])
    # 5.412–5.429 : fichiers insérés dans un bloc EXISTANT de la base commune — le même bloc, à la même place, dans
    # la base commune et dans le paquet Orion (une fois chacun), retirés ici avant la comparaison à la référence.
    for avant, ajout, apres in ((['vc-depot.js'], ['vc-ecrire.js', 'vrm-depot-aussi.js'], []),
                                ([], ['vrm-depot.js'], ['vrm-badge.js'])):
        for blocs, pre in ((commun['content_scripts'], []), (m_nouveau['content_scripts'], ['compat-orion.js'])):
            avec = [c for c in blocs if c['js'] == [*pre, *avant, *ajout, *apres]]
            assert len(avec) == 1, f'{ajout} : attendu une fois, exactement {[*pre, *avant, *ajout, *apres]} ({[c["js"] for c in blocs if ajout[0] in c["js"]]})'
            avec[0]['js'] = [*pre, *avant, *apres]
    # Hôtes que la base commune a RETIRÉS depuis la référence (jamais ajoutés).
    hotes_communs = set(commun.get('host_permissions', [])) | {h for c in commun['content_scripts'] for h in c['matches']}
    retires = {h for h in m_ancien['permissions'] if h.startswith('https://') and h not in hotes_communs}
    retires |= {h for c in m_ancien['content_scripts'] for h in c['matches'] if h not in hotes_communs}
    m_ancien['permissions'] = [h for h in m_ancien['permissions'] if h not in retires]
    for c in m_ancien['content_scripts']:
        c['matches'] = [h for h in c['matches'] if h not in retires]
    oauth = {'matches': ['https://vrm.center/*'], 'js': ['oauth-retour.js'], 'run_at': 'document_start', 'all_frames': False}
    assert [c for c in commun['content_scripts'] if 'oauth-retour.js' in c.get('js', [])] == [oauth], 'La déclaration OAuth commune a changé : revue nécessaire'
    attendu_oauth = {**oauth, 'js': ['compat-orion.js', 'oauth-retour.js']}
    bridge = next(i for i, c in enumerate(m_ancien['content_scripts']) if c['js'] == ['compat-orion.js', 'bridge.js'])
    m_ancien['content_scripts'].insert(bridge + 1, attendu_oauth)
    for bloc in AJOUTS_COMMUNS:
        source = [c for c in commun['content_scripts'] if c['js'] == bloc]
        assert len(source) == 1, f'Bloc commun {bloc} introuvable ou en double dans la base commune'
        m_ancien['content_scripts'].append({**source[0], 'js': ['compat-orion.js', *bloc]})
    m_ancien['description'] = commun['description']
    # 5.371 (lot ext-boutique) : la page d'accueil de l'extension, la même dans la base commune — vrm.center seulement.
    if 'homepage_url' in commun:
        assert commun['homepage_url'] == 'https://vrm.center', f"homepage_url commune inattendue : {commun['homepage_url']}"
        m_ancien['homepage_url'] = commun['homepage_url']
    # L'ordre ENTRE blocs ne change pas ce qui est injecté ; le contenu de chaque bloc, si.
    cle = lambda c: json.dumps(c, sort_keys=True)
    m_ancien['content_scripts'] = sorted(m_ancien['content_scripts'], key=cle)
    m_nouveau['content_scripts'] = sorted(m_nouveau['content_scripts'], key=cle)
    assert m_ancien == m_nouveau, 'Le manifeste Orion a changé de forme (permissions, hôtes, scripts, ressources) par rapport à la référence installable'
    propres = []
    for nom in sorted(noms - {'manifest.json', 'compat-orion.js', 'orion-main.js'}):
        if nom.endswith('/'):
            continue
        source = (ext/nom).read_bytes()
        if nom == 'popup.html':
            texte = source.decode('utf8')
            i = texte.lower().find('<script')
            source = (texte[:i] + '<script src="compat-orion.js"></script>\n' + texte[i:]).encode('utf8')
        if nouveau.read(nom) != source:
            propres.append(nom)
    assert not propres, f'Changements propres à Orion (hors base commune de l’extension) : {propres}'
    print(f'OK : paquet Orion {version} = base commune de l’extension ; adaptateur et structure 5.319.0 conservés ; ajouts approuvés : retour OAuth commun 5.328, infos Vinted 5.339, surfaces 5.406, dressing et formulaire 5.410.3, PDF 5.420, écriture par l’interface et dépôt 5.412–5.440 ; hôtes seulement retirés ; vérifié octet pour octet.')
