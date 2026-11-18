# Roadmap

The steps of Grand Livre, in the order they are built. A step is ticked once merged into `dev`. The product decisions behind them are in the "Project" section of [`CLAUDE.md`](../CLAUDE.md).

## Next, in order

- [x] The hand cursor on everything clickable.
- [x] The household's page as settings (General, Members), its members and invitations apart.
- [x] Styled emails, in the default theme's colors and with the logo.
- [x] A first deployment as a pre-launch, on 2026-11-17: `https://grandlivre.romain.re` (Railway, see [deployment.md](deployment.md)). Until the launch is declared, the production database is disposable: it can be reset at will.
- [ ] The checks after the deployment, on a phone too: voice entry in Brave on Android, the photo editor by touch, the import review with hundreds of lines.
- [ ] The dashboard as a grid, with a few charts that don't weigh on the page.
- [ ] A private mode, per device, hiding what is sensitive on screen (amounts, balances, payees, charts) to show the app to someone.
- [ ] A demo mode: a household of made-up data, to try the app or show it without one's own.
- [ ] Nightly backups of the production database: a Railway cron service runs `pg_dump` over the private network and sends it to a private Cloudflare R2 bucket, outside Railway, kept 30 days; the restore written down in [deployment.md](deployment.md) and tried once on an empty database. Railway's own backups need its Pro plan.
- [ ] The launch: the production database emptied once, real data from then on. From that point, migrations must keep the data in place.

## Postponed

- **OFX import**, until a bank offers only OFX. Desjardins' OFX holds the same lines as its CSV but cuts descriptions at 32 characters, losing "Remises Visa Desjardins" (which tells a card payment) and the account numbers of transfers, so its CSV stays the better source. Its `FITID` would be a line's identity; lines imported from a CSV before would need matching by day, amount and the start of their description.
- **A direct bank connection** through an aggregator.

## Done

### Foundations
- [x] Households and members: invitations by email, owners and plain members.
- [x] Accounts and the consolidated view: account types, holders, visibility (details or balance only), opening balance, archiving, assets, liabilities and net balance.
- [x] Tags and transactions: a hierarchy of tags named in every language, a set of suggested tags for a household starting out; expenses, incomes and transfers split into lines.
- [x] Real time: Server-Sent Events from the API, the front end reloading what changed.
- [x] Reports: expenses and incomes by tag over a period, rolled up to the parents, and the twelve months' trend.

### Entering transactions
- [x] Natural-language entry, drafted by the Claude API, always confirmed by the member.
- [x] Receipt scan: the photo read by the Claude API, then dropped; the items grouped by tag, the taxes shared out.
- [x] Hiding sensitive parts of a photo before it is sent: crop, quarter turns, zoom and masks burnt into the image; the original stays in the browser.
- [x] Voice entry through the microphone: the audio transcribed by Mistral's Voxtral, then dropped; the member reads the text before it is drafted.

### Planning and sharing
- [x] Recurring transactions: recorded on their day or waiting for a member to confirm them.
- [x] Budgets per tag, month by month.
- [x] Settling shared expenses, opt-in per household: splits, balances, the fewest payments, settlements.
- [x] Cash: a wallet account per member, withdrawals as transfers to it, counting the wallet to record what wasn't noted.

### Bank statements
- [x] Statement import (Desjardins' accounts and cards CSV): an account created from a statement with its opening balance and history, duplicates spotted (transactions already entered, receipts, recurring days, a transfer's other side entered in another account), all or nothing, undone by the member who made it.
- [x] Spotting recurring transactions in the imported history, suggested to the member.
- [x] Tags suggested by the assistant when sorting by payee.
- [x] The import review made easier to go through with many lines: a summary with the amounts, a tab per account of the file, filters and a search by payee.

### Getting around
- [x] Getting started: where a new household lands, its steps computed from its data, and sorting the imported history by payee.
- [x] Help: a "?" explaining a notion where it shows, a help page by section, a searchable FAQ.
- [x] Switching households, the one chosen kept per device.
- [x] New themes, replacing the starter's, and the logo.
