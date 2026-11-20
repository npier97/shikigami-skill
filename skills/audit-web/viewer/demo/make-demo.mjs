#!/usr/bin/env node
// Writes a scripted demo run (events JSON) for previews: no real client, site or finding.
// About 20 s: Kantoku sets up, four agents walk in, work, visit the shelf or the printer,
// hand in their results and cheer at the table.
//
//   node viewer/demo/make-demo.mjs > demo-run.json
//   node viewer/export-replay.mjs --events demo-run.json --out demo.html   # open with ?walk=1.5

const T0 = Date.UTC(2026, 0, 1, 9, 0, 0);
const events = [];
const at = (s, ev) => events.push({ t: T0 + Math.round(s * 1000), ...ev });
const tool = (s, agentId, icon, text, extra = {}) => at(s, { kind: "tool", agentId, tool: "Bash", icon, text, ...extra });

// The lead: prepares the batches, checks the site once, launches the agents.
at(0, { kind: "spawn", agentId: "lead", label: "Coordination", lead: true });
tool(4.2, "lead", "write", "Prépare les lots de règles");
tool(5.4, "lead", "web", "Teste le site en ligne");

const AGENTS = [
  {
    id: "fumi", label: "Opquast · Contenus & formulaires (12)", spawn: 1.0,
    trip: { at: 6.6, place: "shelf", icon: "read", text: "Lit la méthode d'audit", back: 8.6 },
    rules: [[3, "Relève les meta descriptions"], [5, "Cherche les sigles"], [6, "Vérifie les dates"], [15, "Lit la confidentialité"],
      [28, "Vérifie les URL sensibles"], [46, "Cherche les CGU"], [71, "Lit les formulaires"], [74, "Vérifie les formats"],
      [95, "Teste les erreurs"], [56, "Vérifie les prix"]],
    error: 11.8, done: 14.8, summary: { pass: 5, partial: 4, fail: 3, check: 0, na: 0 },
  },
  {
    id: "tsuna", label: "Opquast · Liens & médias (14)", spawn: 1.3,
    trip: { at: 7.0, place: "shelf", icon: "read", text: "Lit les correspondances RGAA", back: 9.0 },
    rules: [[101, "Lit les mentions légales"], [116, "Vérifie les alternatives"], [126, "Cherche les animations"],
      [129, "Vérifie la langue"], [138, "Vérifie les liens externes"], [141, "Compare les intitulés"],
      [142, "Teste les nouvelles fenêtres"], [146, "Vérifie les téléchargements"], [150, "Mesure les PDF"],
      [152, "Teste les liens internes"], [148, "Lit les fichiers PDF"]],
    done: 15.6, summary: { pass: 6, partial: 5, fail: 2, check: 1, na: 0 },
  },
  {
    id: "michi", label: "Opquast · Navigation & présentation (11)", spawn: 1.6,
    rules: [[153, "Vérifie le lien d'accueil"], [157, "Cherche la page active"], [165, "Teste le menu mobile"],
      [168, "Vérifie le focus visible"], [182, "Mesure les contrastes"], [186, "Mesure les cibles"],
      [187, "Cherche l'info par couleur"], [189, "Teste le zoom"], [196, "Vérifie l'impression"]],
    done: 12.2, summary: { pass: 7, partial: 3, fail: 1, check: 0, na: 0 },
  },
  {
    id: "mamo", label: "Opquast · Sécurité & serveur (16)", spawn: 1.9,
    rules: [[197, "Vérifie la redirection HTTPS"], [199, "Lit le certificat"], [200, "Vérifie HSTS"],
      [206, "Vérifie nosniff"], [210, "Lit la CSP"], [214, "Cherche le SRI"], [218, "Teste www et domaine nu"],
      [222, "Teste une page inconnue"], [225, "Vérifie la page 404"], [227, "Vérifie le cache"],
      [228, "Lit le charset"], [232, "Vérifie le balisage"], [241, "Contrôle les PDF"]],
    trip: { at: 13.0, place: "printer", icon: "write", text: "Imprime ses résultats" },
    done: 16.4, summary: { pass: 12, partial: 3, fail: 1, check: 0, na: 0 },
  },
];

tool(5.9, "lead", "run", "Lance les quatre agents");

for (const a of AGENTS) {
  at(a.spawn, { kind: "spawn", agentId: a.id, label: a.label });
  if (a.trip) tool(a.trip.at, a.id, a.trip.icon, a.trip.text, { place: a.trip.place });
  // Spread the rule checks over the time the agent is at its desk.
  const start = a.trip?.back ?? 6.4 + (a.spawn - 1) * 1.5;
  const end = a.trip && !a.trip.back ? a.trip.at - 0.3 : a.done - 0.4;
  const step = (end - start) / a.rules.length;
  a.rules.forEach(([rule, text], i) => {
    const s = start + i * step;
    const icon = /Teste|Vérifie la redirection|Lit le certificat|Vérifie HSTS/.test(text) ? "web" : i % 3 === 2 ? "run" : "read";
    tool(s, a.id, icon, `R${rule} · ${text}`, { rule: String(rule) });
    if (i % 4 === 1) at(s + step * 0.5, { kind: "think", agentId: a.id, ms: 900 });
  });
  if (a.error) at(a.error, { kind: "error", agentId: a.id, text: "Échec : Lit le lot de règles" });
  at(a.done, { kind: "done", agentId: a.id, summary: a.summary });
}

tool(17.2, "lead", "write", "Fusionne les copies");
// Late enough that Kantoku has reached the table before the run ends.
tool(21.0, "lead", "web", "Publie le rapport");
events.sort((x, y) => x.t - y.t);
process.stdout.write(JSON.stringify(events, null, 1) + "\n");
