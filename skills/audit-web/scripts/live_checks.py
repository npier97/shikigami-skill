#!/usr/bin/env python3
"""Tests partagés du site en ligne : lancés une fois, puis remis à chaque sous-agent.

Utilisation (depuis la racine du dépôt client) :
  live_checks.py --out DOSSIER [--dir .audit-web] [--no-links]

Lit config.json (urls.site, urls.pages) et écrit dans DOSSIER :
  live-checks.txt   redirections http/https/www, en-têtes de sécurité, 404, robots, sitemap,
                    compression, cache des ressources, listes de répertoires, certificat, SPF/DKIM/DMARC
  pages/<page>.html + .headers   HTML brut et en-têtes de chaque page de l'échantillon (et d'une 404)
  dom-summary.txt   par page : titre, lang, meta, titres, identifiants en double, images et alt,
                    liens (sans intitulé, target, rel, aria-current, hôtes externes), boutons,
                    étiquettes, champs, formulaires, médias, scripts et SRI
  links.txt         statut de chaque lien interne trouvé dans l'échantillon (sauf --no-links)
Nécessite curl, dig et openssl. Bibliothèque standard uniquement.
"""
import argparse, collections, json, pathlib, re, subprocess, time, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser

TIMEOUT_S = 15
DKIM_SELECTORS = ["default", "google", "selector1", "selector2", "k1", "mandrill", "s1", "s2", "mail", "dkim"]
LINK_WORKERS = 8


def run(cmd, timeout=TIMEOUT_S):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return (p.stdout + p.stderr).strip()
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        return f"[{cmd[0]} failed: {e}]"


def curl(*args):
    return run(["curl", "-s", "--max-time", str(TIMEOUT_S), *args])


def slug(path):
    s = re.sub(r"[^a-zA-Z0-9]+", "_", path.strip("/")).strip("_")
    return s or "index"


class Page(HTMLParser):
    TEXT_TAGS = {"a", "button", "label", "title", "h1", "h2", "h3", "h4", "h5", "h6"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.d = collections.defaultdict(list)
        self.ids = collections.Counter()
        self.open = []  # stack of (tag, attrs, text parts) for tags whose text we collect
        self.in_svg = 0

    def handle_starttag(self, t, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids[a["id"]] += 1
        if t == "svg":
            self.in_svg += 1
            if a.get("role") == "img":
                self.d["svg_img"].append(a.get("aria-label") or "(no aria-label)")
        if t == "html":
            self.d["lang"].append(a.get("lang"))
        elif t == "meta":
            if a.get("name") in ("description", "viewport", "robots"):
                self.d["meta " + a["name"]].append(a.get("content"))
            if "charset" in a:
                self.d["charset"].append(a["charset"])
        elif t == "link" and a.get("rel") in ("canonical", "alternate"):
            self.d["link " + a["rel"]].append(f"{a.get('href')} {a.get('hreflang') or ''}".strip())
        elif t == "img":
            img = {k: a.get(k) for k in ("src", "width", "height", "loading", "aria-hidden", "role")}
            # A bare `alt` attribute parses as None: it is an empty (decorative) alt, not a missing one.
            img["alt"] = (a["alt"] or "") if "alt" in a else None
            self.d["img"].append(img)
        elif t in ("input", "select", "textarea"):
            self.d["field"].append({k: v for k, v in a.items() if k in ("type", "name", "id", "autocomplete", "aria-required", "required", "aria-describedby", "aria-invalid", "inputmode", "placeholder")} | {"tag": t})
        elif t == "form":
            self.d["form"].append({k: a.get(k) for k in ("method", "action", "novalidate")})
        elif t in ("video", "audio", "iframe"):
            self.d["media"].append({"tag": t, "src": (a.get("src") or "")[:100], "title": a.get("title"), "autoplay": "autoplay" in a, "controls": "controls" in a})
        elif t == "time":
            self.d["time"].append(a.get("datetime"))
        elif t == "script" and a.get("src"):
            self.d["script"].append({"src": a["src"][:100], "integrity": "integrity" in a})
        elif t == "table":
            self.d["table"].append(a.get("role") or "")
        if a.get("tabindex") not in (None, "0", "-1"):
            self.d["positive tabindex"].append(a["tabindex"])
        if t in self.TEXT_TAGS and not (t == "title" and self.in_svg):
            self.open.append((t, a, []))

    def handle_data(self, x):
        for _, _, parts in self.open:
            parts.append(x)

    def handle_endtag(self, t):
        if t == "svg":
            self.in_svg = max(0, self.in_svg - 1)
        for i in range(len(self.open) - 1, -1, -1):
            if self.open[i][0] == t:
                tag, a, parts = self.open.pop(i)
                text = re.sub(r"\s+", " ", "".join(parts)).strip()
                if tag == "a":
                    self.d["a"].append({"href": a.get("href"), "text": text[:70], "aria-label": a.get("aria-label"),
                                        "target": a.get("target"), "rel": a.get("rel"), "hreflang": a.get("hreflang"),
                                        "aria-current": a.get("aria-current"), "download": a.get("download")})
                elif tag == "title":
                    self.d["title"].append(text)
                elif tag == "button":
                    self.d["button"].append({"text": text[:50], "aria-label": a.get("aria-label"), "type": a.get("type"), "aria-expanded": a.get("aria-expanded")})
                elif tag == "label":
                    self.d["label"].append({"text": text[:50], "for": a.get("for")})
                else:
                    self.d["headings"].append(f"{tag} {text[:80]}")
                break


def summarize(name, html, host):
    p = Page()
    p.feed(html)
    d = p.d
    out = [f"\n###### {name}"]
    for k in ("title", "lang", "charset", "meta description", "meta viewport", "meta robots", "link canonical", "link alternate"):
        out.append(f"{k}: {d.get(k)}")
    out.append("headings:")
    out += [f"  {h}" for h in d["headings"]]
    out.append(f"duplicate ids: {[i for i, n in p.ids.items() if n > 1]}")
    imgs = d["img"]
    out.append(f"images: {len(imgs)}, without alt: {[i['src'] for i in imgs if i['alt'] is None][:8]}")
    out.append(f"  sample: {imgs[:6]}")
    if d["svg_img"]:
        out.append(f"svg role=img: {d['svg_img'][:8]}")
    links = d["a"]
    out.append(f"links: {len(links)}")
    out.append(f"  no accessible name: {[l['href'] for l in links if not l['text'] and not l['aria-label']][:8]}")
    out.append(f"  target=_blank: {[(l['href'], l['text'] or l['aria-label'], l['rel']) for l in links if l['target'] == '_blank'][:12]}")
    out.append(f"  aria-current: {[(l['href'], l['aria-current']) for l in links if l['aria-current']][:5]}")
    out.append(f"  downloads/PDF: {[(l['href'], l['text']) for l in links if l['download'] is not None or (l['href'] or '').lower().endswith('.pdf')][:8]}")
    ext = sorted({urllib.parse.urlparse(l["href"]).hostname for l in links if (l["href"] or "").startswith("http") and urllib.parse.urlparse(l["href"]).hostname != host})
    out.append(f"  external hosts: {ext}")
    by_name = collections.defaultdict(set)
    for l in links:
        by_name[(l["aria-label"] or l["text"]).lower()].add(l["href"])
    out.append(f"  same name, different targets: {dict((k, sorted(v)[:3]) for k, v in by_name.items() if k and len(v) > 1)}")
    for k in ("button", "label", "field", "form", "media", "time", "script", "table", "positive tabindex"):
        if d.get(k):
            out.append(f"{k}: {d[k][:15]}")
    return "\n".join(out), [l["href"] for l in links]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default=".audit-web")
    ap.add_argument("--out", required=True)
    ap.add_argument("--no-links", action="store_true", help="skip checking every internal link")
    args = ap.parse_args()
    cfg = json.loads((pathlib.Path(args.dir) / "config.json").read_text(encoding="utf-8"))
    site = cfg["urls"]["site"].rstrip("/")
    host = urllib.parse.urlparse(site).hostname
    bare = host[4:] if host.startswith("www.") else host
    pages = cfg["urls"].get("pages") or ["/"]
    out = pathlib.Path(args.out)
    (out / "pages").mkdir(parents=True, exist_ok=True)

    # 1. Pages first: the HTML also tells us which asset to probe for caching.
    started = time.time()
    fetched = {}

    def fetch(path):
        f = out / "pages" / slug(path)
        status = curl("-D", f"{f}.headers", "-o", f"{f}.html", "-w", "%{http_code} %{size_download}B %{time_total}s", site + path)
        return path, status

    rand404 = f"/page-inexistante-{int(time.time())}"
    with ThreadPoolExecutor(LINK_WORKERS) as ex:
        for path, status in ex.map(fetch, pages + [rand404]):
            fetched[path] = status
    (out / "pages" / f"{slug(rand404)}.html").rename(out / "pages" / "404.html")
    (out / "pages" / f"{slug(rand404)}.headers").rename(out / "pages" / "404.headers")

    home = (out / "pages" / "index.html").read_text(errors="replace") if (out / "pages" / "index.html").exists() else ""
    asset = next(iter(re.findall(r'(?:src|href)="(/[^"]+\.(?:js|css))"', home)), None)

    # 2. Server, headers, DNS.
    sections = [("Pages (status, size, time)", "\n".join(f"{p} {s}" for p, s in fetched.items()))]
    for url in (f"http://{bare}/", f"http://www.{bare}/", f"https://www.{bare}/", f"https://{bare}/"):
        sections.append((f"HEAD {url}", curl("-I", url)))
    sections += [
        ("Random URL (must be 404)", fetched[rand404]),
        ("robots.txt", curl(f"{site}/robots.txt")),
        ("sitemap", "\n".join(f"{p}: " + curl("-o", "/dev/null", "-w", "%{http_code} %{content_type}", site + p) for p in ("/sitemap.xml", "/sitemap-index.xml"))),
        ("Compression (Accept-Encoding: br, gzip)", "\n".join(l for l in curl("-I", "-H", "Accept-Encoding: br, gzip", site + "/").splitlines() if re.match(r"(?i)content-encoding|vary", l))),
        (f"Asset caching {asset}", curl("-I", site + asset) if asset else "no local js/css found on the home page"),
        ("Directory listings", "\n".join(f"{d} " + curl("-o", "/dev/null", "-w", "%{http_code}", site + d) for d in ("/assets/", "/images/", "/static/", "/_astro/", "/.git/"))),
        ("Pages without trailing slash", "\n".join(f"{p.rstrip('/')} → " + curl("-o", "/dev/null", "-w", "%{http_code} %{redirect_url}", site + p.rstrip("/")) for p in pages if p.endswith("/") and p != "/")),
        ("TLS certificate", run(["sh", "-c", f"echo | openssl s_client -connect {host}:443 -servername {host} 2>/dev/null | openssl x509 -noout -issuer -dates"])),
        ("DNS TXT (SPF)", run(["dig", "+short", "TXT", bare])),
        ("DNS DMARC", run(["dig", "+short", "TXT", f"_dmarc.{bare}"])),
        ("DNS MX", run(["dig", "+short", "MX", bare])),
        ("DKIM (common selectors)", "\n".join(f"{s}: {r}" for s in DKIM_SELECTORS if (r := run(['dig', '+short', 'TXT', f'{s}._domainkey.{bare}'])[:90]))),
    ]
    (out / "live-checks.txt").write_text("\n\n".join(f"=== {t}\n{b}" for t, b in sections) + "\n", encoding="utf-8")

    # 3. DOM summary of each page.
    blocks, internal = [], set()
    for f in sorted((out / "pages").glob("*.html")):
        text, hrefs = summarize(f.name, f.read_text(errors="replace"), host)
        blocks.append(text)
        for h in hrefs:
            if h and not h.startswith(("#", "mailto:", "tel:", "javascript:")):
                u = urllib.parse.urljoin(site + "/", h)
                if urllib.parse.urlparse(u).hostname == host:
                    internal.add(u.split("#")[0])
    (out / "dom-summary.txt").write_text("\n".join(blocks) + "\n", encoding="utf-8")

    # 4. Every internal link on the sample: broken links and avoidable redirects.
    if not args.no_links:
        with ThreadPoolExecutor(LINK_WORKERS) as ex:
            rows = list(ex.map(lambda u: (u, curl("-o", "/dev/null", "-w", "%{http_code} %{redirect_url}", u)), sorted(internal)))
        bad = [f"{u} → {s}" for u, s in rows if not s.startswith("200")]
        (out / "links.txt").write_text(f"{len(rows)} liens internes testés, {len(bad)} ne répondent pas 200 :\n" + "\n".join(bad) + "\n", encoding="utf-8")

    print(f"Tests en ligne de {site} écrits dans {out} en {time.time() - started:.0f} s "
          f"({len(pages)} pages{'' if args.no_links else f', {len(internal)} liens internes'}).")


if __name__ == "__main__":
    main()
