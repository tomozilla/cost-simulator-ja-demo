// 費用シミュレーター：rates.json（日付つき）を読み、1か月の使用量から、キャップON/OFFの請求を出す。
const $ = (id) => document.getElementById(id);
const USAGE_KEYS = ["egressGb", "cachedGb", "storageGb", "dbGb", "mau", "rtMessagesM", "rtPeak", "edgeM"];
const SPIKE_KEYS = ["egressGb", "cachedGb", "mau", "rtMessagesM", "rtPeak", "edgeM"]; // 通信などの項目だけ。保存量やDBは一晩で10倍にならない
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
  if (projects < 1) adjusted.push("動かしているプロジェクト数 -> 1"); // 請求にはプロジェクトが最低1つ。黙って直さず、言う
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
  if (adjusted.length) html += `<div class="warn">空欄・マイナス・数字以外があったので、次の値で計算しました：<br>${adjusted.join("<br>")}</div>`;
  if (!r.hasCap) html += `<div class="warn">Teamプランにスペンドキャップはありません（ドキュメント、2026-10-27確認）。枠を超えた分は、使えなくなるのではなく課金されます。そのため合計は1つだけ表示しています。Teamの組織は自分では動かしていません。</div>`;
  html += r.capOn
    ? `<div class="tot"><div class="box on">スペンドキャップ ON<b>${usd(r.capOn.total)}</b>${r.capOn.restricted.length ? "枠を超えると使えなくなる項目：" + r.capOn.restricted.join(", ") : "使えなくなる項目はなし"}</div>` +
      `<div class="box off">スペンドキャップ OFF<b>${usd(r.capOff.total)}</b>${r.capOff.overage > 0 ? "超過分 " + usd(r.capOff.overage) + " を含む" : "超過なし"}</div></div>`
    : `<div class="tot"><div class="box off">合計の目安（超過分は課金）<b>${usd(r.capOff.total)}</b>${r.capOff.overage > 0 ? "超過分 " + usd(r.capOff.overage) + " を含む" : "超過なし"}</div></div>`;
  html += `<b>キャップが守らないもの（ON/OFFどちらでもかかる）</b><table>${r.fixed.map((l) => `<tr><td>${l.name}</td><td>${usd(l.usd)}</td></tr>`).join("")}<tr><td><b>小計</b></td><td><b>${usd(r.fixedTotal)}</b></td></tr></table>`;
  html += `<b>${r.hasCap ? "キャップが守るもの" : "使用量の項目（枠を超えると課金）"}</b><table><tr><th>項目</th><th>使用量</th><th>含まれる量</th>${r.hasCap ? "<th>キャップON</th><th>キャップOFF</th>" : "<th>課金</th>"}</tr>` +
    r.rows.map((x) => `<tr><td>${x.label}</td><td class="${x.over > 0 ? "over" : ""}">${nf(x.used)}</td><td>${nf(x.included)}</td>${r.hasCap ? `<td>${x.over > 0 ? "枠を超えた分は使えない" : "OK"}</td>` : ""}<td>${x.overageUsd > 0 ? "+" + usd(x.overageUsd) : "$0"}</td></tr>`).join("") + "</table>";
  $("result").innerHTML = html;
}

async function init() {
  for (const k of USAGE_KEYS.concat(["projects", "pitr", "domains"])) DEFAULTS[k] = $(k).value;
  try {
    const res = await fetch("rates.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    data = await res.json();
  } catch (e) {
    $("banner").innerHTML = `<div class="warn err">rates.json を読み込めません（${e.message}）。ファイルを直接開かず、ローカルのWebサーバー経由で開いてください。</div>`;
    return;
  }
  if ((Date.now() - new Date(data.asOf)) / 86400000 > 45) $("banner").innerHTML = `<div class="warn">料金データは ${data.asOf} 時点です。古い可能性があります。料金ページを確認して rates.json を更新してください。</div>`;
  $("foot").textContent = `料金データの時点：${data.asOf}（${data.source}）。キャップが守るのは2つ目の表の項目です。Compute・PITR・独自ドメインは、どちらでもかかります。目安です。税・その他のアドオンは含みません。`;
  $("form").addEventListener("input", render);
  $("form").addEventListener("submit", (e) => e.preventDefault());
  let baseline = null; // 10倍にする前の値。2回目のクリックは、さらに10倍にせず元に戻す
  $("spike").addEventListener("click", () => {
    if (baseline) {
      for (const k of SPIKE_KEYS) $(k).value = baseline[k];
      baseline = null;
      $("spike").textContent = "通信量が10倍になったら？";
    } else {
      baseline = {}; for (const k of SPIKE_KEYS) baseline[k] = parseFloat($(k).value) || 0;
      const up = Sim.scale(baseline, 10, SPIKE_KEYS);
      for (const k of SPIKE_KEYS) $(k).value = up[k];
      $("spike").textContent = "元に戻す";
    }
    render();
  });
  $("reset").addEventListener("click", () => { baseline = null; $("spike").textContent = "通信量が10倍になったら？"; for (const k of Object.keys(DEFAULTS)) $(k).value = DEFAULTS[k]; render(); });
  render();
}
init();
