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
    ]
    membres_attendus = set(ancien.namelist()) | {'oauth-retour.js'} | {n for b in AJOUTS_COMMUNS for n in b} | {'vrm-mots.js'}
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
    print(f'OK : paquet Orion {version} = base commune de l’extension ; adaptateur et structure 5.319.0 conservés ; ajouts approuvés : retour OAuth commun 5.328, infos Vinted 5.339 ; hôtes seulement retirés ; vérifié octet pour octet.')
