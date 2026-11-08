#!/usr/bin/env python3
"""Génère index.html : le jeu complet en un seul fichier, jouable hors ligne en double-cliquant.

Utilisation :  python tools/build.py

Le navigateur refuse de charger des modules séparés depuis un fichier local (file://).
Ce script rassemble donc src/*.js, les styles, la police, le logo et Three.js dans une seule page.
Aucune dépendance : Python suffit.
"""
import base64
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"

IMPORT_RE = re.compile(r"^import\s+(?P<what>[^;'\"]+?)\s+from\s+['\"](?P<path>[^'\"]+)['\"];?\s*$", re.M)
EXPORT_LIST_RE = re.compile(r"^export\s*\{(?P<names>[^}]*)\};?\s*$", re.M)
EXPORT_DECL_RE = re.compile(r"^export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)", re.M)


def data_url(path, mime):
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def read_module(name, modules, order):
    """Lit un module et ses dépendances, en plaçant les dépendances d'abord."""
    if name in modules:
        return
    text = (SRC / name).read_text(encoding="utf-8")
    deps = []
    for m in IMPORT_RE.finditer(text):
        if m["path"].startswith("./"):
            deps.append(m["path"][2:])
    modules[name] = text
    for dep in deps:
        read_module(dep, modules, order)
    order.append(name)


def var_name(module):
    return "__m_" + re.sub(r"\W", "_", module)


def convert(name, text):
    """Transforme un module en fonction immédiatement exécutée, qui renvoie ses exports."""
    exports = EXPORT_DECL_RE.findall(text)
    for m in EXPORT_LIST_RE.finditer(text):
        exports += [n.strip() for n in m["names"].split(",") if n.strip()]

    bindings = []

    def replace_import(m):
        path, what = m["path"], m["what"].strip()
        if not path.startswith("./"):
            return ""                       # 'three' est importé une seule fois en tête
        source = var_name(path[2:])
        names = what.strip("{} ").replace(" as ", ": ")
        bindings.append(f"const {{ {names} }} = {source};")
        return ""

    body = IMPORT_RE.sub(replace_import, text)
    body = EXPORT_LIST_RE.sub("", body)
    body = re.sub(r"^export\s+", "", body, flags=re.M)
    head = "\n".join(bindings)
    tail = "return { " + ", ".join(dict.fromkeys(exports)) + " };"
    return f"// ===== {name} =====\nconst {var_name(name)} = (() => {{\n{head}\n{body}\n{tail}\n}})();\n"


def build():
    modules, order = {}, []
    read_module("main.js", modules, order)
    bundle = "import * as THREE from 'three';\n" + "\n".join(convert(n, modules[n]) for n in order)
    if "</script" in bundle.lower():
        raise SystemExit("Le code contient </script> : la page serait cassée.")

    three_url = data_url(ROOT / "vendor" / "three.module.js", "text/javascript")
    logo_url = data_url(SRC / "logo.svg", "image/svg+xml")
    font_url = data_url(ROOT / "vendor" / "fonts" / "outfit-latin.woff2", "font/woff2")

    html = (SRC / "index.html").read_text(encoding="utf-8")
    css = (SRC / "turbonix.css").read_text(encoding="utf-8") + "\n" + (SRC / "style.css").read_text(encoding="utf-8")
    css = css.replace("../vendor/fonts/outfit-latin.woff2", font_url)

    def section(tag, content, text):
        pattern = re.compile(rf"<!-- build:{tag} -->.*?<!-- /build:{tag} -->", re.S)
        if not pattern.search(text):
            raise SystemExit(f"Repère build:{tag} introuvable dans src/index.html")
        return pattern.sub(lambda _: content, text)

    html = section("css", f"<style>\n{css}\n</style>", html)
    html = section("importmap", f'<script type="importmap">{{ "imports": {{ "three": "{three_url}" }} }}</script>', html)
    html = section("main", f'<script type="module">\n{bundle}\n</script>', html)
    # Le journal des nouveautés est intégré à la page : il s'affiche aussi hors ligne
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    if "</script" in changelog.lower():
        raise SystemExit("CHANGELOG.md contient </script> : la page serait cassée.")
    html = section("changelog", f'<script type="text/markdown" id="changelog-src">\n{changelog}\n</script>', html)
    html = html.replace("./logo.svg", logo_url)
    banner = "<!-- Fichier généré par tools/build.py : modifier src/ puis relancer le script. -->\n"
    html = html.replace("<!DOCTYPE html>\n", "<!DOCTYPE html>\n" + banner, 1)

    out = ROOT / "index.html"
    out.write_text(html, encoding="utf-8", newline="\n")
    print(f"index.html généré : {out.stat().st_size / 1024 / 1024:.2f} Mo, {len(order)} modules")


if __name__ == "__main__":
    build()
