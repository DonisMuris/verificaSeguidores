# Verifica Seguidores

[![CI](https://github.com/DonisMuris/verificaSeguidores/actions/workflows/ci.yml/badge.svg)](https://github.com/DonisMuris/verificaSeguidores/actions/workflows/ci.yml)
[![Dependencies: none](https://img.shields.io/badge/dependencies-none-2f6df6)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-informational)](LICENSE)

Local-first web app that reads your own Instagram data export and shows who doesn't
follow you back. With two exports taken on different dates, it also identifies who
removed the follow after you reciprocated.

No login, no server, no dependencies. The app never contacts Instagram. It reads the
file Meta gives you when you request your own data.

[Live demo](https://verificaseguidores.dm-apps.workers.dev) ·
[Manual de uso (PT)](docs/USO.md) ·
[Arquitetura (PT)](docs/ARQUITETURA.md) ·
[Roadmap (PT)](docs/MELHORIAS.md)

![Main screen: four metric cards that double as tabs, showing who doesn't follow
back, who dropped you after you reciprocated, who you don't follow back, and mutuals,
above a list of profiles with verdict labels and risk scores](docs/imagens/tela-principal.png)

<sub>Every profile shown is synthetic. Screenshots never use real export data.</sub>

## The problem

When someone stops following you, their profile disappears from your followers
export. The record that they ever followed you is gone with it. A single export
cannot separate "never followed me" from "followed me and left", because both look
the same on disk: absence.

I tried to work around this with a heuristic. Cluster follows by time, then treat
unreciprocated follows that fall inside windows of confirmed reciprocal exchanges as
probable bait. Measured against a real export of a thousand-odd non-reciprocating
profiles, it recovered under 8% of cases even with a one-hour window, and the false
positives were indistinguishable from the hits. Discarded.

The information simply isn't in one file. So the app compares snapshots over time,
and states which mode it is operating in:

![Two snapshots compared: a profile present in the first followers list and absent
from the second is evidence of an unfollow, and the timestamps show who followed
first](docs/imagens/modelo-de-prova.svg)

Most apps in this category claim certainty they cannot have. This one shows a badge
in the header saying whether it is estimating or comparing.

## Notable implementation details

**No dependencies at runtime or build time.** Only Node built-ins and browser APIs.
Two places where that meant writing something instead of installing it:

`src/zip.js` reads the ZIP central directory and inflates entries with the browser's
native `DecompressionStream('deflate-raw')`. It pulls only the two files it needs out
of an archive with hundreds. About 150 lines.

`build.js` strips comments from the published artifact. A regex would break this
codebase specifically, since it is full of `'https://www.instagram.com/'` string
literals and regexes like `/instagram\.com\/(?:_u\/)?([^/?#]+)/i`. The implementation
is a state machine over code, strings, template literals and regex literals, with a
stack to decide whether a `}` closes a block or a `${…}` interpolation. It refuses to
write output that fails to parse or isn't idempotent.

**The privacy claim is enforced by the browser.** The deployed site sends
`Content-Security-Policy: connect-src 'none'`, so the page cannot make network
requests at all. Anyone can confirm it in the Network tab. The tradeoff is that
adding analytics later would mean giving that up.

**Two storage backends, one interface.** `storage.js` (HTTP API) and
`storage-local.js` (localStorage) expose the same contract, so `app.js` runs in both
modes without branching. The build swaps one for the other.

**Tabs named after questions, not verdicts.** They used to carry the engine's
vocabulary (*Iscas, Confirmadas, Te largaram, Não seguem, Te seguem*): five
overlapping categories, two of them hard to tell apart at a glance. Now there are
four, phrased as questions, and the metric cards are the tabs, so one control does
the job that two were doing.

## Stack

Vanilla JavaScript (ES Modules), Node.js for build and optional server, `node:test`
for tests, Cloudflare Workers for hosting. No framework, no bundler, no transpiler.

```
src/
  parser.js         reads Meta's export, preserving every timestamp
  zip.js            reads the .zip natively
  analysis.js       snapshot diffing and risk score       <- core
  ui.js             cards, list, pagination
  triagem.js        keyboard-driven one-by-one review
  storage.js        persistence via HTTP API (server mode)
  storage-local.js  persistence via localStorage (single-file mode)
  tema.js           light/dark
  icones.js         inline SVG, no icon font
build.js            inlines src/ + index.html into one self-contained file
server.js           optional local server, loopback only, session token
```

Profiles are stored as `Map<username, timestamp>` rather than `Set<string>`. The
timestamp in `followers_N.json` is when they followed you; the one in
`following.json` is when you did. The order between the two is what the whole
analysis rests on.

Design rationale in [docs/ARQUITETURA.md](docs/ARQUITETURA.md) (Portuguese).

## Running it

Node.js 20+ for the build and tests. The app itself needs only a browser.

```bash
git clone https://github.com/DonisMuris/verificaSeguidores.git
cd verificaSeguidores

npm test              # 52 tests, nothing to install
npm run build         # regenerates VerificaSeguidores.html
npm start             # optional server mode at http://127.0.0.1:3000
```

`VerificaSeguidores.html` is the main artifact: one self-contained file that runs by
double-clicking, offline. Request your Instagram export in **JSON**, selecting only
*Followers and following* over *All time*, then drag the `.zip` onto the page.

![Empty state: three numbered steps and a drop zone that takes the whole .zip
straight from Instagram](docs/imagens/estado-vazio.png)

Long lists are easier to handle one at a time. The review mode turns the list into a
keyboard-driven queue, and opening a profile reuses the same browser tab instead of
piling up one tab per profile.

![Review overlay showing one profile with its verdict, risk score, the reasons behind
it, and three keyboard actions](docs/imagens/triagem.png)

Marking a profile here never touches your Instagram account. It only removes the
profile from your working list.

Step by step in [docs/USO.md](docs/USO.md).

## Tests

```bash
npm test
```

52 tests on `node:test`, no test framework installed. Coverage follows risk rather
than a percentage target:

- `build.test.js` covers the comment scanner, where a bug shows up as a broken app in
  someone else's browser after deploy. Every real module gets stripped and checked to
  still parse, stay idempotent, and produce identical output.
- `analysis.test.js` covers verdicts, the guard that keeps mutual follows at zero
  risk, the partition of the three UI lists, and detection of date-clipped exports.
- `parser.test.js` covers timestamp preservation, `followers_1..N` merging, and the
  refusal to guess the type of an unknown array, since `close_friends.json` has the
  same shape as `followers_N.json`.
- `zip.test.js` runs against a real ZIP with a central directory and deflate, because
  the offset arithmetic is the part that can break.

CI runs on Node 20, 22 and 24, and checks that the committed single-file build still
matches what the source generates.

## Status

Working and deployed. The current state covers what it was built for, so the open
items in [docs/MELHORIAS.md](docs/MELHORIAS.md) are parked on purpose, each with the
reasoning for the decision.

## Privacy and legality

- Runs entirely in the browser. No account, no cloud, no telemetry, no cookies.
- Never connects to Instagram, so it cannot get an account banned.
- The followers list contains personal data of third parties who never consented.
  Processing it only on the client is what keeps this out of data-controller
  territory under Brazil's LGPD.
- Apps that show your followers list without asking for this export are scraping
  Instagram or using your login, which violates Meta's Terms and is the usual reason
  "unfollower apps" get accounts blocked. No official API returns the followers list.
- Not affiliated with, sponsored by, or endorsed by Instagram or Meta.

## Documentation

| Document | Audience |
|---|---|
| [docs/USO.md](docs/USO.md) | End users: step by step, reading the screen, shortcuts, troubleshooting |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Developers: design decisions, data model, what was tried and dropped |
| [docs/MELHORIAS.md](docs/MELHORIAS.md) | Open items and why each one is parked |
| [docs/USO-DE-IA.md](docs/USO-DE-IA.md) | Where AI assistance was used, what it wasn't, and how output is verified |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

## License

MIT. See [LICENSE](LICENSE).
