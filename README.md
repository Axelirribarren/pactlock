<p align="center"><img src="docs/assets/hero.png" alt="pactlock" width="640"></p>

# pactlock

*(formerly SyntaX)*

**A compiler for agent environments: one manifest, every runtime, with cost and loss measured
before anything is applied.**

An agent environment — skills, MCP servers, rules, agents, hooks, permissions — is declared once
and compiled to each runtime. Before writing anything, pactlock answers three questions no other
tool answers today:

- **What does this environment cost me?** Every MCP server injects its tool schemas at every
  startup. Nobody shows that number, and it is the direct cause of adding tools making an agent
  worse.
- **What breaks if I move it to another runtime?** Runtimes are not equivalent. Whatever a target
  cannot express is reported, not papered over.
- **Is the environment I'm running the one we agreed on?** Without pins or verification, two
  people on the same repo run different things and nobody finds out.

One dependency (`yaml`), and `doctor` doesn't even load it.

> The CLI speaks Spanish, and so does the internal documentation. The sample output below is real,
> unedited output — translating it would show you something the tool doesn't print.

## Getting started

Nothing to adopt. `doctor` is read-only and runs against any project that already has a
`.claude/`, an `.mcp.json` or an `AGENTS.md` put together by hand:

```bash
node src/cli.js doctor /path/to/your/project
node src/cli.js doctor --deep          # also measures the MCP servers for real
```

Real output from this very repo:

```
  Claude Code    9 skills · 3 MCP servers · 1 archivo de reglas
  Codex          3 skills · 1 archivo de reglas
                 · MCP de Codex no auditado: vive en la config de usuario, fuera del repo.

  Costo de arranque, por runtime
    Claude Code              ≈14.887 tokens
      schemas de herramientas MCP   ≈12.296   55 herramientas en 3 servers
        chrome-devtools         ≈6.451   29 herramientas
        playwright              ≈4.630   24 herramientas
        context7                ≈1.215   2 herramientas
      reglas                      ≈2.006   CLAUDE.md
      descripciones de skills       ≈585   9 skills
    Codex                     ≈2.145 tokens
      reglas                      ≈1.959   AGENTS.md
      descripciones de skills       ≈186   3 skills

  Drift entre runtimes
    x 6 skills de Claude Code que no están en Codex

  Providers duplicados
    x Control e inspección de navegador: 2 providers instalados
      Quedarte con uno ahorra entre ≈4.630 y ≈6.451 tokens por arranque.
      - chrome-devtools (Claude Code) — ≈6.451 tokens
      - playwright (Claude Code) — ≈4.630 tokens

  Pérdida al compilar
    Codex: La config de MCP de Codex es de usuario, no de proyecto: no viaja con el repo.
```

Two things that report makes visible and nothing else does:

**74% of Claude Code's startup is two servers doing the same job.** Redundancy stops being a style
opinion and gets a price tag.

**A team that shares `AGENTS.md` believes it shares an environment, and it may not share its MCP
servers.** Codex adds each person's user-level MCP servers, which never travel with the repo, to the
project's `.codex/config.toml`, which does travel but only loads for people who marked the project
as trusted. Same repo, different agents, and nothing tells you.

> The sample output above was captured before two corrections: the rename to pactlock, and the
> Codex caveat, which used to say that Codex's MCP config is user-only. It will be re-captured
> with the English CLI (see `docs/implementation-plan.md`, phase 1).

`--deep` starts each MCP server over stdio and asks for its tool list. Without it, the cost is
reported as partial and the schemas — the largest slice — as unmeasured. It runs the commands
declared in the audited project's `.mcp.json`, so it is opt-in and warns first. `--json` returns
the full report for programmatic use.

## Adopt an environment, then hold it to its word

```bash
node src/cli.js import     # observe what's on disk and write the contract
node src/cli.js verify     # is it still true?
node src/cli.js accept     # authorize a change, on purpose
```

**`import` observes; it does not infer intent.** It adopts each skill in the targets where it
actually lives, so the first `verify` comes back clean. Requiring the union to exist in every
target is a *convergence policy* that cannot be derived from disk: you ask for it with `--mirror`,
and it is written into the manifest as `targetPolicy`. The tool distinguishes *"I found this"*
from *"the team wants this"*, and it never says *"I assumed the team wants this"*.

In this repo the distinction shows up immediately:

```
$ pactlock import && pactlock verify
  Entorno verificado: coincide con el contrato (política faithful).      exit 0

$ pactlock import --mirror && pactlock verify
  missing — declaradas y no instaladas
    x a11y-audit en codex
    … 6 in total                                                          exit 1
```

`verify` compares four things and **never fixes anything**:

| | | Default |
|---|---|---|
| `missing` | declared, not installed | fails |
| `modified` | content doesn't match the lock | fails |
| `diverged` | same id, different content across targets | fails |
| `unexpected` | installed, not declared | warns; fails with `--strict` |

Exit codes: `0` clean · `1` differences · `2` error. That is what makes it a CI line rather than
one more report.

### `accept` is a trust boundary, not a hash updater

Accepting an `unexpected` skill is not updating a record — it is **authorizing a new executable
capability for the agent**. A `modified` skill may be an honest edit or a malicious one, and the
hash cannot tell you which. So:

- **Nothing is accepted in bulk without being seen.** Bare `accept` walks you through each change
  and asks. Without a TTY it modifies nothing at all — authorization comes from a person.
- **The action is named, never inferred.** `accept <id>` accepts modified content. Retiring a
  declaration needs `--remove --target X`; adopting something new needs `--adopt`; allowing
  per-target variants needs `--allow-divergence --why "…"`. The same command can't delete a
  declaration on one machine and refresh a digest on another.
- **You see what changed**, file by file, before you confirm:

```
  aceptar   theme-factory en claude-code   .claude/skills/theme-factory
    sha256:69b9992c80a52ff7…  ->  sha256:cab52c82f94205fb…
    ~ SKILL.md
```

For automation, `--all-modified` and `--all-unexpected` are deliberately separate flags. There is
no generic `--all`: mixing "content I already authorized changed" with "something I never
authorized appeared" is exactly how a tool turns into a rubber stamp.

`accept` edits the manifest surgically, so your `why:` fields and comments survive. That is the
whole reason it exists instead of a destructive `--force`.

### The three layers

| Layer | File | Written by |
|---|---|---|
| Observation | *(in memory)* | the adapters |
| Contract | `pactlock.yaml` | people |
| Integrity | `pactlock.lock` | the tool |

A digest answers *"did this change?"* — not *"which version is this?"*. And it is **not** byte-level
integrity: it normalizes line endings, BOM and path Unicode, because without that the same skill
on Windows and macOS would produce different digests and `verify` would flag everything as
modified on day one. The spec, with published test vectors, is in [`docs/digest.md`](docs/digest.md).

## Status

| Command | What it does | |
|---|---|---|
| `doctor` | Audits the environment. Read-only. | ✅ |
| `doctor --deep` | Starts each MCP server and measures its schemas for real | ✅ |
| `import` | Writes `pactlock.yaml` and `pactlock.lock` from what's on disk | ✅ |
| `verify` | Fails if the environment drifted from the contract. For CI. | ✅ |
| `accept` | Authorizes changes, one at a time and on purpose | ✅ |
| `build --target <rt>` | Compiles the manifest to a runtime, with a loss report | ⬜ |
| `lock` | Adds origin resolution so it can be reinstalled identically | ⬜ |
| `rollback` | Reverts the last application | ⬜ |

Runtimes with an adapter: **Claude Code** and **Codex**, both read-only. Others are detected and
reported as present but unsupported.

`import`, `verify` and `accept` currently cover **skills**. MCP servers, rules and the remaining
objects come later, on top of a slice that already proved the whole model end to end.

## How it works

The manifest is **capability-first**. `capabilities` declares what is needed (browser control);
`components` declares how it is satisfied (`chrome-devtools-mcp`, falling back to
`playwright-mcp`). A target picks a provider it supports instead of failing: non-equivalence
between runtimes is the mechanism of the design, not an error case.

Each adapter declares, **as data**, which objects it knows how to express:

```js
supports: {
  skill:      { dir: '.claude/skills' },
  mcp:        { file: '.mcp.json', key: 'mcpServers' },
  rule:       { file: 'CLAUDE.md', mode: 'merge-markdown' },
  hook:       { file: '.claude/settings.json', key: 'hooks' },
  permission: { file: '.claude/settings.json', key: 'permissions' }
}
```

The loss report falls out of that, with no per-runtime-pair code — which is what keeps migrating
across N runtimes from costing N².

The eight universal objects: `Skill` · `MCP` · `Agent` · `Rule` · `Command` · `Hook` ·
`Permission` · `Env/Secret`. The last four are the ones that break portability, which is exactly
why they are there.

## Adding a runtime

This is the most common extension and it is cheap on purpose. One file under `src/targets/`
exporting `id`, `label`, `detect(root)`, `supports` and `read(root)`, plus one line in
`src/targets/index.js`. Nothing else: the loss report and the drift check are derived from the
declared `supports`.

Full details in [`docs/agent-brief.md`](docs/agent-brief.md).

## Development

```bash
npm test          # node --test
npm run doctor    # audit this very repo (the dogfood)
npm run verify    # hold this repo to its own contract
npm run docs      # regenerate CLAUDE.md and AGENTS.md from the brief
```

Agent documentation has a **single source**: [`docs/agent-brief.md`](docs/agent-brief.md).
`CLAUDE.md` and `AGENTS.md` are generated from it, each with its own runtime-specific section, and
a test fails if they drift apart. It is the first target adapter in miniature, and the reason any
IDE that opens this repo understands the same thing.

CI runs the suite on Linux, macOS and Windows. The matrix is not cosmetic: the digest spec promises
cross-platform determinism, and without running it on all three that promise has no evidence behind
it. CI also reports which line endings each checkout actually produced, because assuming "Windows
converts to CRLF" would be assuming too much.

- [`docs/backlog.md`](docs/backlog.md) — open work, debt and known risks
- [`docs/digest.md`](docs/digest.md) — digest spec, with test vectors
- [`docs/direction.md`](docs/direction.md) — why the project stopped being a skill finder
- [`docs/licensing.md`](docs/licensing.md) — skill licensing and what not to break when copying

## License

MIT.
