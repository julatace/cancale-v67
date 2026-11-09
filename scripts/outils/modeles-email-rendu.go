// Rend les modèles d'e-mails Supabase avec le VRAI moteur de Go (celui de
// Supabase Auth), pour chaque langue et pour une langue absente.
//   go run scripts/outils/modeles-email-rendu.go <dossier-modeles> <dossier-sortie>
// Écrit <id>.<cas>.html et sujets-rendus.json ; sort en erreur au moindre
// modèle qui ne s'analyse pas ou ne s'exécute pas (html/template ET text/template).
package main

import (
	"bytes"
	"encoding/json"
	htmltpl "html/template"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	texttpl "text/template"
)

func donnees(cas string) map[string]interface{} {
	d := map[string]interface{}{
		"SiteURL":         "https://vrm.center",
		"ConfirmationURL": "https://lgonxzrzjcqthjtbdpzo.supabase.co/auth/v1/verify?token=pkce_0123456789abcdef&type=signup&redirect_to=https://vrm.center",
		"TokenHash":       "0123456789abcdef0123456789abcdef0123456789abcdef01234567",
		"Token":           "482913",
		"Email":           "client@exemple.test",
		"NewEmail":        "nouvelle@exemple.test",
		"RedirectTo":      "https://vrm.center",
	}
	switch cas {
	case "fr":
		d["Data"] = map[string]interface{}{"langue": "fr"}
	case "en":
		d["Data"] = map[string]interface{}{"langue": "en"}
	case "sans-langue":
		d["Data"] = map[string]interface{}{"prenom": "Julien"}
	case "sans-donnees":
		d["Data"] = map[string]interface{}(nil)
	}
	return d
}

func rendre(nom, source string, d map[string]interface{}) (string, error) {
	var b1, b2 bytes.Buffer
	t1, err := htmltpl.New(nom).Parse(source)
	if err != nil {
		return "", fmt.Errorf("html/template analyse %s : %w", nom, err)
	}
	if err := t1.Execute(&b1, d); err != nil {
		return "", fmt.Errorf("html/template exécution %s : %w", nom, err)
	}
	t2, err := texttpl.New(nom).Parse(source)
	if err != nil {
		return "", fmt.Errorf("text/template analyse %s : %w", nom, err)
	}
	if err := t2.Execute(&b2, d); err != nil {
		return "", fmt.Errorf("text/template exécution %s : %w", nom, err)
	}
	return b1.String(), nil
}

func main() {
	if len(os.Args) < 3 {
		fmt.Fprintln(os.Stderr, "usage : modeles-email-rendu <dossier-modeles> <dossier-sortie>")
		os.Exit(2)
	}
	src, out := os.Args[1], os.Args[2]
	os.MkdirAll(out, 0o755)
	fichiers, _ := filepath.Glob(filepath.Join(src, "*.html"))
	cas := []string{"fr", "en", "sans-langue", "sans-donnees", "sans-cle"}
	for _, f := range fichiers {
		b, err := os.ReadFile(f)
		if err != nil {
			panic(err)
		}
		id := strings.TrimSuffix(filepath.Base(f), ".html")
		for _, c := range cas {
			r, err := rendre(id, string(b), donnees(c))
			if err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			os.WriteFile(filepath.Join(out, id+"."+c+".html"), []byte(r), 0o644)
		}
	}
	var sujets map[string]map[string]string
	b, err := os.ReadFile(filepath.Join(src, "sujets.json"))
	if err != nil {
		panic(err)
	}
	json.Unmarshal(b, &sujets)
	rendus := map[string]map[string]string{}
	for id, s := range sujets {
		rendus[id] = map[string]string{}
		for _, c := range cas {
			var buf bytes.Buffer
			t, err := texttpl.New(id).Parse(s["sujet"])
			if err == nil {
				err = t.Execute(&buf, donnees(c))
			}
			if err != nil {
				fmt.Fprintln(os.Stderr, "sujet", id, err)
				os.Exit(1)
			}
			rendus[id][c] = buf.String()
		}
	}
	j, _ := json.MarshalIndent(rendus, "", "  ")
	os.WriteFile(filepath.Join(out, "sujets-rendus.json"), j, 0o644)
	fmt.Printf("%d modèles rendus × %d cas\n", len(fichiers), len(cas))
}
