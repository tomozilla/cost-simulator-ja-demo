# cost-simulator-ja-demo

English | [日本語](README.ja.md)

A small learning demo: enter one month of usage and see the Supabase bill with the **spend cap ON and OFF** side by side, including which items the cap does not cover (compute, PITR, custom domains). Plain HTML + JavaScript. No server, no keys, no Supabase project needed.

> **A personal learning project.** Not an official tool of any company, not a quote. Rates are what I read on the pricing page and in the docs on 2026-10-27; the covered / not-covered split follows the "Control your costs" docs page.

This is the code for two Japanese articles on Qiita: a how-to on reading the bill and the spend cap, and a web-app article about this simulator.

Page/UI texts and comments are English. Japanese copies (Japanese comments and UI) are in [`ja/`](ja/).

## Files

| File | What it is |
|---|---|
| `app/sim.js` | Pure calculation (no DOM) |
| `app/rates.json` | Dated rates and the list of cap-covered items. **Update by hand** |
| `app/index.html`, `app/app.js` | The page |
| `app/test.js`, `app/package.json` | 14 checks (`node test.js`) |
| `ja/app/` | Same app with Japanese comments and UI |

## Cost

- Running the page costs nothing.
- The amounts on screen are **estimates**: Pro $25 / Team $599 plan fee, compute per project (Micro $10 ... XL $210 per month, billed hourly, $10 included in paid plans), PITR $100 per month per project (7 days), custom domain $10 per month, and the overage rates in `rates.json`. Only one number was checked against my own invoice: Micro compute for 478 hours = $6.42. Tax and other add-ons are not included.

## Run

```bash
cd app
python3 -m http.server 8000
# open http://localhost:8000/
node test.js        # 14 checks
```

## Limits (read this)

- With the cap ON the page shows the **fixed items only** and lists what would be **refused**. It cannot show what the service actually does at the quota (pause, read-only, errors); I did not test that.
- I could not confirm a spend cap exists on Team (the pricing page lists it under Pro), so for Team the page says so.
- The cap has no per-item budget and no notification (per the docs). The page does not simulate alerts.

## What was verified (2026-10-27) and what was not

- Verified: `node test.js` passes; in a clean copy: the default screen, a x10 traffic case (hand-checked: $25 + $31.50 + $162.50 = $219), a case with 3 Medium projects + PITR + a custom domain ($305 either way), and invalid input.
- Not verified: Team plan details, tax, hundreds of projects, phone-width layout, opening the page as a file.

## Cleanup

Stop the local server. Nothing else was created.

## License

MIT (see `LICENSE`).
