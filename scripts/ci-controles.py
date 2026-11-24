#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════════
#  LA LISTE DE CE QUE LA CI D'UNE PR EXÉCUTE — audit par audit, banc par banc
#  (24 nov., ci-rapide). Lit les workflows déclenchés par `pull_request` dans
#  .github/workflows/ (à une révision git, ou l'arbre de travail), déplie les
#  matrices, et rend UNE ligne par contrôle exécuté :
#      <workflow> · <sorte> · <nom> · <moteur/réglages> · bloquant|non bloquant
#  Le nom du JOB (« part 2/3 ») n'y est PAS : une répartition différente des
#  mêmes bancs donne la même liste. Ce qui compte : rien ne disparaît, rien ne
#  devient non bloquant.
#    python3 -I scripts/ci-controles.py                 # l'arbre de travail
#    python3 -I scripts/ci-controles.py origin/main     # une révision
#    python3 -I scripts/ci-controles.py --diff origin/main [HEAD|.]
#  --diff rend 1 si un contrôle de la première liste manque dans la seconde.
#  Besoin : PyYAML (python3-yaml). Ne lance rien, n'écrit rien.
# ════════════════════════════════════════════════════════════════════════════
import itertools, os, re, shlex, subprocess, sys

try:
    import yaml
except ImportError:
    sys.exit('PyYAML manque (apt install python3-yaml)')

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def lire(ref, chemin):
    if ref in (None, '.'):
        p = os.path.join(RACINE, chemin)
        return open(p, encoding='utf8').read() if os.path.exists(p) else None
    r = subprocess.run(['git', '-C', RACINE, 'show', f'{ref}:{chemin}'], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None


def lister_dossier(ref, dossier):
    if ref in (None, '.'):
        d = os.path.join(RACINE, dossier)
        return sorted(os.listdir(d)) if os.path.isdir(d) else []
    r = subprocess.run(['git', '-C', RACINE, 'ls-tree', '--name-only', f'{ref}:{dossier}'], capture_output=True, text=True)
    return sorted(r.stdout.split())


def audits_de_part(ref, part):
    """Même choix que scripts/lancer-audits.cjs : LOURDS d'abord, puis l'ordre alphabétique, i % n == k-1."""
    src = lire(ref, 'scripts/lancer-audits.cjs') or ''
    m = re.search(r'const LOURDS = \[(.*?)\];', src, re.S)
    lourds = re.findall(r"'([^']+)'", m.group(1)) if m else []
    tous = [f for f in lister_dossier(ref, 'scripts') if re.match(r'^audit-.*\.cjs$', f)]
    ordonnes = [f for f in lourds if f in tous] + [f for f in tous if f not in lourds]
    if not part:
        return ordonnes
    k, n = (int(x) for x in part.split('/'))
    return [f for i, f in enumerate(ordonnes) if i % n == k - 1]


def matrices(job):
    st = (job.get('strategy') or {}).get('matrix')
    if not st:
        return [{}]
    if isinstance(st, str):
        return [{}]
    axes = {k: v for k, v in st.items() if k not in ('include', 'exclude')}
    combos = [dict(zip(axes, vals)) for vals in itertools.product(*axes.values())] if axes else []
    for inc in st.get('include') or []:
        combos.append(dict(inc))
    return combos or [{}]


def subst(texte, mat):
    return re.sub(r'\$\{\{\s*matrix\.(\w+)\s*\}\}', lambda m: str(mat.get(m.group(1), '')), str(texte))


def commandes(script):
    """Les lignes de shell d'un `run:` (suites `\\` jointes, `;`/`&&` découpés hors guillemets)."""
    script = re.sub(r'\\\n\s*', ' ', script)
    out = []
    for ligne in script.split('\n'):
        ligne = ligne.strip()
        if not ligne or ligne.startswith('#'):
            continue
        out.append(ligne)
    return out


def controles_de_ligne(ref, ligne, env, boucle):
    res = []
    # for audit in a b c; do node "scripts/audit-$audit.cjs"
    m = re.match(r'for (\w+) in ([^;]+); do\s*(.*)$', ligne)
    if m:
        boucle[:] = [m.group(1), m.group(2).split()]
        if m.group(3):
            res += controles_de_ligne(ref, m.group(3), env, boucle)
        return res
    if ligne in ('done',) or ligne.startswith('done'):
        boucle[:] = []
        return res
    variantes = [ligne]
    if boucle:
        var, valeurs = boucle
        variantes = [ligne.replace('$' + var, v).replace('${' + var + '}', v) for v in valeurs]
    for l in variantes:
        try:
            mots = shlex.split(l, comments=True)
        except ValueError:
            mots = l.split()
        # préfixes VAR=valeur
        env_l = dict(env)
        while mots and re.match(r'^[A-Z_][A-Z0-9_]*=', mots[0]):
            k, v = mots.pop(0).split('=', 1)
            env_l[k] = v
        if not mots:
            continue
        prog = os.path.basename(mots[0])
        args = mots[1:]
        if prog == 'node':
            test = '--test' in args
            fichiers = [a for a in args if not a.startswith('-')]
            if not fichiers:
                continue
            f0 = fichiers[0]
            if f0.endswith('lancer-audits.cjs'):
                for a in audits_de_part(ref, env_l.get('AUDITS_PART')):
                    res.append(('audit', a[:-4], ''))
            elif f0.endswith('lancer-bancs.cjs'):
                nav = env_l.get('NAVIGATEUR', 'chromium')
                regl = ','.join(f'{k}={env_l[k]}' for k in ('LARGEURS', 'THEMES') if k in env_l)
                moteur = nav + (' ' + regl if regl else '')
                # « banc@VAR=a,b » : un MORCEAU du banc, rendu tel quel ici ; `lister` le compte
                # entier seulement si les morceaux du MÊME job (toutes ses parts) couvrent tout
                # le défaut de VAR, lu dans le banc (`liste('VAR', 'défaut')`).
                for b in fichiers[1:]:
                    m = re.match(r'^([a-z0-9-]+)@([A-Z][A-Z0-9_]*)=(\S+)$', b)
                    if m:
                        res.append(('morceau', (m.group(1), m.group(2), frozenset(m.group(3).split(','))), moteur))
                    else:
                        res.append(('banc', b, moteur))
            else:
                regl = ','.join(f'{k}={v}' for k, v in sorted(env_l.items()) if k in ('NAVIGATEUR', 'LARGEURS') or k.startswith('VRM_MESSAGES'))
                for f in (fichiers if test else fichiers[:1]):
                    res.append(('node --test' if test else 'node', f, regl))
        elif prog == 'npm' and args[:1] == ['run']:
            res.append(('npm run', ' '.join(args[1:2]), ''))
        elif prog in ('python3', 'python') and '-c' not in args:
            f = [a for a in args if not a.startswith('-')]
            if f:
                res.append(('python', f[0], ''))
    return res


def defaut_de(ref, banc, var):
    """Ce que le banc fait SANS la variable : l'ensemble que ses morceaux doivent couvrir."""
    src = lire(ref, f'scripts/bancs/{banc}.cjs') or ''
    d = re.search(r"liste\('" + var + r"',\s*'([^']*)'\)", src)            # liste('SCENARIOS', 'a,b')
    if d:
        return set(d.group(1).split(','))
    if var == 'BANC_LARGEUR':                                                # [390, 1512].filter((l) => !process.env.BANC_LARGEUR …
        d = re.search(r'\[([\d,\s]+)\]\.filter\(\(\w+\) => !process\.env\.BANC_LARGEUR', src)
        return set(x.strip() for x in d.group(1).split(',')) if d else None
    if var == 'ECRANS':                                                      # const ECRANS = [ ['journee', …], … ];
        d = re.search(r'const ECRANS = \[(.*?)\n\];', src, re.S)
        return set(re.findall(r"^\s*\['(\w+)',", d.group(1), re.M)) if d else None
    return None


def lister(ref):
    lignes = set()
    for nom in lister_dossier(ref, '.github/workflows'):
        if not nom.endswith(('.yml', '.yaml')):
            continue
        brut = lire(ref, f'.github/workflows/{nom}')
        if not brut:
            continue
        wf = yaml.safe_load(brut) or {}
        on = wf.get('on', wf.get(True))   # PyYAML lit la clé `on` comme True
        if not (on == 'pull_request' or (isinstance(on, list) and 'pull_request' in on) or (isinstance(on, dict) and 'pull_request' in on)):
            continue
        wnom = wf.get('name', nom)
        for jid, job in (wf.get('jobs') or {}).items():
            morceaux = {}
            for mat in matrices(job):
                bloquant = 'non bloquant' if str(subst(job.get('continue-on-error', False), mat)).lower() == 'true' else 'bloquant'
                env_job = {k: subst(v, mat) for k, v in (job.get('env') or {}).items()}
                for step in job.get('steps') or []:
                    if 'run' not in step:
                        continue
                    env = dict(env_job)
                    env.update({k: subst(v, mat) for k, v in (step.get('env') or {}).items()})
                    b_step = bloquant
                    if str(step.get('continue-on-error', False)).lower() == 'true' or step.get('if') not in (None, 'always()', '${{ always() }}', 'success()'):
                        b_step = 'non bloquant' if str(step.get('continue-on-error', False)).lower() == 'true' else f"si {step.get('if')}"
                    boucle = []
                    script = subst(step['run'], mat)
                    # `if [ "x" = "y" ]; then … fi` déplié par la matrice : seules les branches vraies comptent
                    script = re.sub(r'if \[ "([^"]*)" = "([^"]*)" \]; then(.*?)\n\s*fi', lambda m: m.group(3) if m.group(1) == m.group(2) else '', script, flags=re.S)
                    for l in commandes(script):
                        for sorte, quoi, regl in controles_de_ligne(ref, l, env, boucle):
                            if sorte == 'morceau':
                                b, var, vals = quoi
                                morceaux.setdefault((b, var, regl, b_step), set()).update(vals)
                                continue
                            lignes.add(f'{wnom} · {sorte} · {quoi} · {regl or "-"} · {b_step}')
            for (b, var, regl, b_step), vus in morceaux.items():
                defaut = defaut_de(ref, b, var)
                if defaut is not None and defaut <= vus:
                    lignes.add(f'{wnom} · banc · {b} · {regl or "-"} · {b_step}')
                else:
                    manque = ','.join(sorted((defaut or set()) - vus)) or 'défaut illisible'
                    lignes.add(f'{wnom} · banc · {b} · {regl or "-"} {var} INCOMPLET (manque {manque}) · {b_step}')
    return sorted(lignes)


def main(argv):
    if argv and argv[0] == '--diff':
        a = argv[1] if len(argv) > 1 else 'origin/main'
        b = argv[2] if len(argv) > 2 else '.'
        la, lb = set(lister(a)), set(lister(b))
        manque, neuf = sorted(la - lb), sorted(lb - la)
        print(f'{a} : {len(la)} contrôle(s) · {b} : {len(lb)} contrôle(s)')
        for l in manque:
            print('  − ' + l)
        for l in neuf:
            print('  + ' + l)
        if not manque and not neuf:
            print('  identiques : les mêmes contrôles, avec les mêmes réglages, aussi bloquants.')
        return 1 if manque else 0
    for l in lister(argv[0] if argv else '.'):
        print(l)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
