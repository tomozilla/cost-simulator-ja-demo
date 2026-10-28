// Cost simulator: reads rates.json (dated), takes a month of usage, shows the bill with the spend cap ON and OFF.
const $ = (id) => document.getElementById(id);
const USAGE_KEYS = ["egressGb", "cachedGb", "storageGb", "dbGb", "mau", "rtMessagesM", "rtPeak", "edgeM"];
const SPIKE_KEYS = ["egressGb", "cachedGb", "mau", "rtMessagesM", "rtPeak", "edgeM"]; // traffic-like items; storage and database don't jump 10x overnight
const DEFAULTS = {};
let data = null;
let adjusted = [];

const usd = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const nf = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

function num(id, min = 0) {
  const v = parseFloat($(id).value);
  if (Number.isFinite(v) && v >= min) return v;
  adjusted.push(`${$(id).previousElementSibling.textContent} -> ${min}`);
  return min;
}

function read() {
  adjusted = [];
  const usage = {};
  for (const k of USAGE_KEYS) usage[k] = num(k);
  const projects = Math.round(num("projects"));
  if (projects < 1) adjusted.push("Running projects -> 1"); // a bill needs at least one project: say so instead of fixing it silently
  return {
    plan: $("plan").value, compute: $("compute").value,
    projects: Math.max(1, projects), pitr: Math.round(num("pitr")), domains: Math.round(num("domains")),
    usage,
  };
}

function render() {
  if (!data) return;
  const a = read();
  const r = Sim.simulate(a, data);
  let html = "";
  if (adjusted.length) html += `<div class="warn">Some answers were empty, negative or not a number, so these were used instead:<br>${adjusted.join("<br>")}</div>`;
  if (!r.hasCap) html += `<div class="warn">Team has no spend cap (docs, read 2026-10-27): use past the quota is billed, never refused, so only one total is shown. I have not run a Team organization myself.</div>`;
  html += r.capOn
    ? `<div class="tot"><div class="box on">Spend cap ON<b>${usd(r.capOn.total)}</b>${r.capOn.restricted.length ? "use past the quota is refused for: " + r.capOn.restricted.join(", ") : "nothing refused"}</div>` +
      `<div class="box off">Spend cap OFF<b>${usd(r.capOff.total)}</b>${r.capOff.overage > 0 ? "includes " + usd(r.capOff.overage) + " of overage" : "no overage"}</div></div>`
    : `<div class="tot"><div class="box off">Estimated total (overage is billed)<b>${usd(r.capOff.total)}</b>${r.capOff.overage > 0 ? "includes " + usd(r.capOff.overage) + " of overage" : "no overage"}</div></div>`;
  html += `<b>Not covered by the cap (charged either way)</b><table>${r.fixed.map((l) => `<tr><td>${l.name}</td><td>${usd(l.usd)}</td></tr>`).join("")}<tr><td><b>Subtotal</b></td><td><b>${usd(r.fixedTotal)}</b></td></tr></table>`;
  html += `<b>${r.hasCap ? "Covered by the cap" : "Usage items (billed past the quota)"}</b><table><tr><th>Item</th><th>Used</th><th>Included</th>${r.hasCap ? "<th>Cap ON</th><th>Cap OFF</th>" : "<th>Billed</th>"}</tr>` +
    r.rows.map((x) => `<tr><td>${x.label}</td><td class="${x.over > 0 ? "over" : ""}">${nf(x.used)}</td><td>${nf(x.included)}</td>${r.hasCap ? `<td>${x.over > 0 ? "refused past quota" : "ok"}</td>` : ""}<td>${x.overageUsd > 0 ? "+" + usd(x.overageUsd) : "$0"}</td></tr>`).join("") + "</table>";
  $("result").innerHTML = html;
}

async function init() {
  for (const k of USAGE_KEYS.concat(["projects", "pitr", "domains"])) DEFAULTS[k] = $(k).value;
  try {
    const res = await fetch("rates.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    data = await res.json();
  } catch (e) {
    $("banner").innerHTML = `<div class="warn err">Could not load rates.json (${e.message}). Open this page through a local web server, not as a file.</div>`;
    return;
  }
  if ((Date.now() - new Date(data.asOf)) / 86400000 > 45) $("banner").innerHTML = `<div class="warn">The price data is from ${data.asOf}. It may be out of date: check the pricing page and update rates.json.</div>`;
  $("foot").textContent = `Rates as of ${data.asOf} (${data.source}). The cap covers the items in the second table; compute, PITR and custom domains are charged either way. Estimate only: tax and other add-ons are not included.`;
  $("form").addEventListener("input", render);
  $("form").addEventListener("submit", (e) => e.preventDefault());
  let baseline = null; // the values before the x10 what-if, so a second click goes back instead of compounding
  $("spike").addEventListener("click", () => {
    if (baseline) {
      for (const k of SPIKE_KEYS) $(k).value = baseline[k];
      baseline = null;
      $("spike").textContent = "What if traffic x10?";
    } else {
      baseline = {}; for (const k of SPIKE_KEYS) baseline[k] = parseFloat($(k).value) || 0;
      const up = Sim.scale(baseline, 10, SPIKE_KEYS);
      for (const k of SPIKE_KEYS) $(k).value = up[k];
      $("spike").textContent = "Back to normal";
    }
    render();
  });
  $("reset").addEventListener("click", () => { baseline = null; $("spike").textContent = "What if traffic x10?"; for (const k of Object.keys(DEFAULTS)) $(k).value = DEFAULTS[k]; render(); });
  render();
}
init();
