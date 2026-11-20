#!/usr/bin/env python3
"""Générateur du rapport d'audit web (Opquast + correspondances RGAA/WCAG). Bibliothèque standard uniquement.

Utilisation (depuis la racine du dépôt client ; --dir vaut .audit-web par défaut) :
  build.py init-audit                       crée audit.json : règles hors périmètre (config.scope) en N/A, les autres en "todo"
  build.py batches --out DOSSIER            écrit un lot de règles "todo" par sous-agent (avec leur nom pour l'outil Agent)
  build.py merge FICHIER...                 fusionne les résultats JSON des sous-agents dans audit.json
  build.py validate [--draft]               vérifie config.json et audit.json (--draft tolère les règles "todo")
  build.py snapshot --commit SHA [--branch B] [--date AAAA-MM-JJ]
                                            enregistre un passage : comptes, historique par règle, état du plan
  build.py diff                             affiche ce qui a changé entre les deux derniers passages
  build.py render [--out FICHIER]           valide puis écrit le rapport HTML (par défaut .audit-web/report.html)
"""
import argparse, base64, datetime, json, mimetypes, pathlib, sys

SKILL = pathlib.Path(__file__).resolve().parent.parent
CATALOGUE = SKILL / "references" / "rules-v5.json"
TEMPLATE = SKILL / "assets" / "template.html"
STATUSES = {"pass", "partial", "fail", "check", "na"}
SEVERITIES = {"critical", "high", "medium", "low"}
EFFORTS = {"simple", "moderate", "complex"}
LANGS = {"fr", "en"}
RANK = {"fail": 0, "partial": 1, "check": 1, "pass": 2}

# Rules that are N/A by construction when a config.scope flag is false. Kept conservative:
# only rules that cannot apply without the feature. Rule 46 (terms of use) always applies.
SCOPE_NA = {
    "shop": [i for i in range(30, 69) if i != 46] + [208],
    "accounts": [17, 18, 19, 20, 21, 22, 23, 26, 201, 202, 203, 204, 205],
    "newsletter": list(range(173, 180)),
    "publicSpaces": [9, 10, 11],
    "video": [121, 122, 123, 124],
    "pdfs": [240, 241],
    "dataTables": [242, 243],
}
NA_REASON = {
    "fr": {"shop": "Rien n'est vendu : ni panier, ni commande, ni paiement.",
           "accounts": "Aucun compte utilisateur.",
           "newsletter": "Aucune lettre d'information.",
           "publicSpaces": "Aucun espace public de contribution.",
           "video": "Aucun contenu vidéo ou audio.",
           "pdfs": "Aucun PDF publié.",
           "dataTables": "Aucun tableau de données."},
    "en": {"shop": "Nothing is sold: no cart, order or payment.",
           "accounts": "No user accounts.",
           "newsletter": "No newsletter.",
           "publicSpaces": "No public contribution space.",
           "video": "No video or audio content.",
           "pdfs": "No PDFs published.",
           "dataTables": "No data tables."},
}
# One batch per subagent. Names match the live view's characters (see viewer/README.md).
BATCHES = [
    ("Contenus & formulaires", [1, 3, 4, 5, 10]),
    ("Liens & médias", [6, 7, 8, 15]),
    ("Navigation & présentation", [9, 11]),
    ("Sécurité & serveur", [2, 12, 13, 14]),
]


def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        sys.exit(f"Fichier introuvable : {path}")
    except json.JSONDecodeError as e:
        sys.exit(f"{path} n'est pas un JSON valide : {e}")


def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def catalogue():
    return load(CATALOGUE)


def counts(rules):
    c = {s: 0 for s in STATUSES}
    for r in rules:
        if isinstance(r["id"], int) and r.get("status") in c:
            c[r["status"]] += 1
    return c


def validate(cfg, audit, final=True):
    errors, warnings = [], []
    for k in ("client", "product"):
        if not cfg.get(k):
            errors.append(f"config.{k} est obligatoire")
    if cfg.get("lang", "fr") not in LANGS:
        errors.append(f"config.lang={cfg.get('lang')!r} : valeurs possibles {sorted(LANGS)}")
    cat_ids = [r["id"] for r in catalogue()["rules"]]
    seen = {}
    for r in audit.get("rules", []):
        rid = r.get("id")
        seen[rid] = seen.get(rid, 0) + 1
        st = r.get("status")
        if st not in STATUSES:
            (errors if final else warnings).append(f"règle {rid} : statut {st!r} hors de {sorted(STATUSES)}")
        if st in STATUSES and not (r.get("finding") or "").strip():
            errors.append(f"règle {rid} : le statut {st} exige un constat (pour N/A, la raison)")
        if st in ("fail", "partial") and not (r.get("fix") or "").strip():
            errors.append(f"règle {rid} : le statut {st} exige un correctif")
    for rid in cat_ids:
        if rid not in seen:
            errors.append(f"règle {rid} absente de audit.json")
    for rid, n in seen.items():
        if n > 1:
            errors.append(f"règle {rid} présente {n} fois")
        if rid not in cat_ids:
            errors.append(f"règle {rid} inconnue du catalogue")
    for i, p in enumerate(audit.get("plan", [])):
        if p.get("severity") not in SEVERITIES:
            errors.append(f"plan[{i}] {p.get('title')!r} : severity doit valoir {sorted(SEVERITIES)}")
        if p.get("effort") and p["effort"] not in EFFORTS:
            errors.append(f"plan[{i}] {p.get('title')!r} : effort doit valoir {sorted(EFFORTS)}")
        if p.get("state", "open") not in ("open", "done"):
            errors.append(f"plan[{i}] : state doit valoir open ou done")
        for rid in p.get("rules", []):
            if rid not in cat_ids:
                errors.append(f"plan[{i}] {p.get('title')!r} : règle inconnue {rid}")
        jira = p.get("jira", [])
        if not isinstance(jira, list):
            errors.append(f"plan[{i}] {p.get('title')!r} : jira doit être une liste de tickets")
        else:
            for t in jira:
                if not isinstance(t, dict) or not t.get("key") or not str(t.get("url", "")).startswith("https://"):
                    errors.append(f"plan[{i}] {p.get('title')!r} : chaque ticket jira a besoin de key et d'une url https")
    j = cfg.get("jira")
    if j is not None and not (isinstance(j, dict) and j.get("project")):
        errors.append("config.jira doit contenir au moins project (clé du projet)")
    return errors, warnings


def report(errors, warnings):
    for w in warnings:
        print("attention :", w, file=sys.stderr)
    if errors:
        print(f"{len(errors)} erreur(s) :", file=sys.stderr)
        for e in errors[:60]:
            print("  -", e, file=sys.stderr)
        sys.exit(1)


def data_uri(ref, base):
    if not ref:
        return None
    if ref.startswith("data:"):
        return ref
    if ref.startswith(("http://", "https://")):
        print(f"attention : le logo {ref} est une URL distante ; les artifacts bloquent la plupart des images externes. Téléchargez-le dans le dossier de l'audit.", file=sys.stderr)
        return ref
    p = (base / ref).expanduser()
    if not p.exists():
        sys.exit(f"Logo introuvable : {p}")
    mime = mimetypes.guess_type(p.name)[0] or ("image/svg+xml" if p.suffix == ".svg" else "application/octet-stream")
    raw = p.read_bytes()
    if len(raw) > 400_000:
        print(f"attention : {p.name} pèse {len(raw)//1024} Ko ; moins de 100 Ko suffit pour un logo.", file=sys.stderr)
    return f"data:{mime};base64,{base64.b64encode(raw).decode()}"


def changes(audit):
    runs = audit.get("runs", [])
    if len(runs) < 2:
        return []
    prev = runs[-2]["id"]
    out = []
    for r in audit["rules"]:
        h = next((x for x in r.get("history", []) if x["run"] == prev), None)
        if h and h["status"] != r["status"]:
            a, b = RANK.get(h["status"]), RANK.get(r["status"])
            kind = "modifiée" if a is None or b is None else "régression" if b < a else "corrigée" if r["status"] == "pass" else "améliorée" if b > a else "modifiée"
            out.append((kind, r["id"], h["status"], r["status"]))
    return out


def cmd_snapshot(d, args):
    cfg, audit = load(d / "config.json"), load(d / "audit.json")
    report(*validate(cfg, audit))
    runs = audit.setdefault("runs", [])
    rid = (runs[-1]["id"] + 1) if runs else 1
    date = args.date or datetime.date.today().isoformat()
    by_id = {r["id"]: r for r in audit["rules"]}
    for p in audit.get("plan", []):
        ids = p.get("rules", [])
        all_ok = bool(ids) and all(by_id[i]["status"] in ("pass", "na") for i in ids)
        old = p.get("state", "open")
        p["state"] = "done" if all_ok else "open"
        if old != p["state"]:
            p.setdefault("log", []).append({"run": rid, "date": date, "state": p["state"]})
            print(f"plan : {p['title']!r} -> {'terminé' if p['state'] == 'done' else 'rouvert'}")
    for r in audit["rules"]:
        r.setdefault("history", []).append({"run": rid, "status": r["status"]})
    runs.append({"id": rid, "date": date, "commit": args.commit, "branch": args.branch, "counts": counts(audit["rules"])})
    save(d / "audit.json", audit)
    print(f"Passage {rid} enregistré ({date}) : {runs[-1]['counts']}")
    cmd_diff(d, args)


def cmd_diff(d, args):
    audit = load(d / "audit.json")
    if len(audit.get("runs", [])) < 2:
        print("Un seul passage pour l'instant : rien à comparer.")
        return
    ch = changes(audit)
    if not ch:
        print("Aucune règle n'a changé de statut depuis le passage précédent.")
    for kind, rid, a, b in sorted(ch, key=lambda x: ["régression", "corrigée", "améliorée", "modifiée"].index(x[0])):
        print(f"{kind:10} {rid} : {a} -> {b}")


def cmd_render(d, args):
    cfg, audit = load(d / "config.json"), load(d / "audit.json")
    report(*validate(cfg, audit))
    lang = cfg.get("lang", "fr")
    cat = catalogue()
    text = {r["id"]: r for r in cat["rules"]}
    order = {r["id"]: i for i, r in enumerate(cat["rules"])}
    rules = []
    for r in sorted(audit["rules"], key=lambda r: order[r["id"]]):
        c = text[r["id"]]
        e = {"id": r["id"], "theme": c["theme"], "rule": r.get("rule") or (c["rule_en"] if lang == "en" else c["rule"]),
             "status": r["status"], "finding": r.get("finding", ""), "fix": r.get("fix", ""), "history": r.get("history", [])}
        if c.get("a11y"):
            e["a11y"] = c["a11y"]
        if r.get("impact"):
            e["impact"] = r["impact"]
        rules.append(e)
    base = d.resolve()
    auditor = dict(cfg.get("auditor") or {})
    if auditor.get("logo"):
        auditor["logo"] = data_uri(auditor["logo"], base)
    payload = {
        "client": cfg["client"], "product": cfg["product"], "lang": lang,
        "site": (cfg.get("urls") or {}).get("site"),
        "logo": data_uri(cfg.get("logo"), base), "logoDark": data_uri(cfg.get("logoDark"), base),
        "auditor": auditor, "meta": audit.get("meta", {}), "runs": audit.get("runs", []),
        "rules": rules, "plan": audit.get("plan", []), "corrections": audit.get("corrections", []),
        "jiraEpic": ((cfg.get("jira") or {}).get("epic") or None),
    }
    if not payload["runs"]:
        print("attention : aucun passage enregistré ; lancez `snapshot` d'abord pour afficher la date et le commit.", file=sys.stderr)
    blob = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/").replace("<!--", "<\\!--")
    title = cfg.get("title") or (f"{cfg['product']} web audit" if lang == "en" else f"Audit web {cfg['product']}")
    html = TEMPLATE.read_text(encoding="utf-8")
    html = html.replace("__TITLE__", title.replace("&", "&amp;").replace("<", "&lt;")).replace("__LANG__", lang)
    html = html.replace("__AUDIT_DATA__", blob, 1)
    out = pathlib.Path(args.out) if args.out else d / "report.html"
    out.write_text(html, encoding="utf-8")
    print(f"Rapport écrit : {out} ({len(html)//1024} Ko). Règles V5 : {counts(rules)}")
    if cfg.get("artifactUrl"):
        print(f"Publier sur l'artifact existant : {cfg['artifactUrl']}")
    else:
        print("Pas encore d'artifactUrl dans config.json : publier un nouvel artifact puis enregistrer son URL.")


def cmd_validate(d, args):
    cfg, audit = load(d / "config.json"), load(d / "audit.json")
    errors, warnings = validate(cfg, audit, final=not args.draft)
    todo = sum(1 for r in audit.get("rules", []) if r.get("status") not in STATUSES)
    report(errors, warnings)
    print(f"OK. {len(audit.get('rules', []))} règles, {todo} encore à évaluer.")


def scope_na(cfg):
    """{rule id: (flag, reason)} for rules out of scope according to config.scope."""
    scope, reasons = cfg.get("scope") or {}, NA_REASON.get(cfg.get("lang", "fr"), NA_REASON["fr"])
    out = {}
    for flag, ids in SCOPE_NA.items():
        if scope.get(flag) is False:
            for rid in ids:
                out.setdefault(rid, (flag, reasons[flag]))
    return out


def cmd_init_audit(d, args):
    p = d / "audit.json"
    if p.exists() and not args.force:
        sys.exit(f"{p} existe déjà. Utilisez --force pour l'écraser.")
    cat = catalogue()
    cfg_path = d / "config.json"
    na = scope_na(load(cfg_path)) if cfg_path.exists() else {}
    rules = []
    for r in cat["rules"]:
        if r["id"] in na:
            flag, reason = na[r["id"]]
            rules.append({"id": r["id"], "status": "na", "finding": reason, "fix": "", "evidence": [f"config.json : scope.{flag} = false"]})
        else:
            rules.append({"id": r["id"], "status": "todo", "finding": "", "fix": "", "evidence": []})
    audit = {"schema": 1, "meta": {"lede": "", "verdict": "", "method": ""}, "runs": [],
             "rules": rules, "plan": [], "corrections": []}
    d.mkdir(parents=True, exist_ok=True)
    save(p, audit)
    print(f"{p} créé : {len(rules) - len(na)} règles à évaluer, {len(na)} hors périmètre (N/A d'après config.scope).")


def cmd_batches(d, args):
    audit = load(d / "audit.json")
    todo = {r["id"] for r in audit["rules"] if r.get("status") not in STATUSES}
    if args.ids:
        todo &= {int(x) if x.isdigit() else x for x in args.ids.split(",")}
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    cat = catalogue()["rules"]
    for i, (name, themes) in enumerate(BATCHES, 1):
        rules = [r for r in cat if r["theme"] in themes and r["id"] in todo]
        if not rules:
            continue
        f = out / f"lot-{i}.json"
        save(f, rules)
        print(f"{f}\tOpquast · {name} ({len(rules)})")


def cmd_merge(d, args):
    p = d / "audit.json"
    audit = load(p)
    by_id = {r["id"]: r for r in audit["rules"]}
    merged, problems = 0, []
    for f in args.files:
        for e in load(pathlib.Path(f)):
            rid = e.get("id")
            if isinstance(rid, str) and rid.isdigit():
                rid = int(rid)
            if rid not in by_id:
                problems.append(f"{f} : règle inconnue {rid!r}")
                continue
            if e.get("status") not in STATUSES:
                problems.append(f"{f} : règle {rid} : statut {e.get('status')!r}")
                continue
            r = by_id[rid]
            for k in ("status", "finding", "fix", "evidence"):
                r[k] = e.get(k, "" if k != "evidence" else [])
            if e.get("impact"):
                r["impact"] = e["impact"]
            else:
                r.pop("impact", None)
            merged += 1
    save(p, audit)
    left = sum(1 for r in audit["rules"] if r.get("status") not in STATUSES)
    for msg in problems:
        print("ATTENTION", msg)
    print(f"{merged} règles fusionnées, {left} encore à évaluer.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default=".audit-web", help="dossier contenant config.json et audit.json")
    sub = ap.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("validate"); v.add_argument("--draft", action="store_true")
    s = sub.add_parser("snapshot"); s.add_argument("--commit"); s.add_argument("--branch"); s.add_argument("--date")
    sub.add_parser("diff")
    r = sub.add_parser("render"); r.add_argument("--out")
    i = sub.add_parser("init-audit"); i.add_argument("--force", action="store_true")
    b = sub.add_parser("batches"); b.add_argument("--out", required=True); b.add_argument("--ids", help="limiter aux règles listées (relance), séparées par des virgules")
    m = sub.add_parser("merge"); m.add_argument("files", nargs="+")
    args = ap.parse_args()
    d = pathlib.Path(args.dir)
    {"validate": cmd_validate, "snapshot": cmd_snapshot, "diff": cmd_diff, "render": cmd_render, "init-audit": cmd_init_audit,
     "batches": cmd_batches, "merge": cmd_merge}[args.cmd](d, args)


if __name__ == "__main__":
    main()
