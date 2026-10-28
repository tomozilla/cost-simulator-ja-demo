// Pure logic for the cost simulator (no DOM).
// Question it answers: for this usage, what does the bill look like with the spend cap ON and OFF?
(function (root) {
  const round = (n) => Math.round(n * 100) / 100;

  // a = { plan, projects, compute, usage: {dbGb, egressGb, ...}, pitr (number of projects with PITR), domains }
  function simulate(a, data) {
    const plan = data.plans[a.plan];
    if (!plan) throw new Error("Unknown plan: " + a.plan);
    const per = data.compute[a.compute];
    if (per === undefined) throw new Error("Unknown compute size: " + a.compute);

    // Items the cap does NOT cover: they are charged whatever the cap says.
    const fixed = [{ name: a.plan === "pro" ? "Pro plan" : "Team plan", usd: plan.base }];
    const computeTotal = a.projects * per;
    fixed.push({ name: `Compute x${a.projects} (${a.compute})`, usd: computeTotal });
    fixed.push({ name: "Compute included in plan", usd: -Math.min(plan.computeCredit, computeTotal) });
    if (a.pitr > 0) fixed.push({ name: `PITR x${a.pitr}`, usd: a.pitr * data.pitrPerProject });
    if (a.domains > 0) fixed.push({ name: `Custom domain x${a.domains}`, usd: a.domains * data.customDomain });
    const fixedTotal = round(fixed.reduce((s, l) => s + l.usd, 0));

    // Items the cap DOES cover: with the cap on, use past the quota is refused instead of billed.
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
