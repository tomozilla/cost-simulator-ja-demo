// 費用シミュレーターの計算だけのファイル（画面に依存しない）。
// 答える問い：この使用量で、キャップON/OFFのとき、請求はどうなるか。
(function (root) {
  const round = (n) => Math.round(n * 100) / 100;

  // a = { plan, projects, compute, usage: {dbGb, egressGb, ...}, pitr (number of projects with PITR), domains }
  function simulate(a, data) {
    const plan = data.plans[a.plan];
    if (!plan) throw new Error("Unknown plan: " + a.plan);
    const per = data.compute[a.compute];
    if (per === undefined) throw new Error("Unknown compute size: " + a.compute);

    // キャップが守らない項目：キャップの設定に関係なく、かかる。
    const fixed = [{ name: a.plan === "pro" ? "Proプラン" : "Teamプラン", usd: plan.base }];
    const computeTotal = a.projects * per;
    fixed.push({ name: `Compute x${a.projects} (${a.compute})`, usd: computeTotal });
    fixed.push({ name: "プランに含まれるCompute", usd: -Math.min(plan.computeCredit, computeTotal) });
    if (a.pitr > 0) fixed.push({ name: `PITR x${a.pitr}`, usd: a.pitr * data.pitrPerProject });
    if (a.domains > 0) fixed.push({ name: `独自ドメイン x${a.domains}`, usd: a.domains * data.customDomain });
    const fixedTotal = round(fixed.reduce((s, l) => s + l.usd, 0));

    // キャップが守る項目：ONなら、枠を超えた分は課金ではなく「使えなくなる」。
    const rows = Object.entries(data.capped).map(([key, c]) => {
      const used = a.usage[key] || 0;
      const included = c.perProject ? c.included * a.projects : c.included;
      const over = Math.max(0, used - included);
      return { key, label: c.label, used, included, over, overageUsd: round(over * c.rate) };
    });
    const overageTotal = round(rows.reduce((s, r) => s + r.overageUsd, 0));
    const blocked = rows.filter((r) => r.over > 0).map((r) => r.label);

    return {
      fixed, fixedTotal, rows, blocked,
      capOn: plan.hasSpendCap === true ? { total: fixedTotal, restricted: blocked } : null,
      capOff: { total: round(fixedTotal + overageTotal), overage: overageTotal },
      hasCap: plan.hasSpendCap === true,
    };
  }

  function scale(usage, factor, keys) {
    const out = Object.assign({}, usage);
    for (const k of keys) out[k] = round((usage[k] || 0) * factor);
    return out;
  }

  const api = { simulate, scale };
  if (typeof module !== "undefined") module.exports = api; else root.Sim = api;
})(this);
