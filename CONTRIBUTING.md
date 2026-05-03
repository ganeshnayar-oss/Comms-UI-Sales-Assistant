# Contributing

## Branching

- `main` is the stable branch.
- Use `codex/<short-task-name>` branches for feature work and fixes.
- Keep branches short-lived and task-specific.

## Pull requests

- Open a PR for every change.
- Keep PRs focused.
- Include a short testing note in the PR description.
- Merge only after build validation passes.

## Codex collaboration rules

- Pull or rebase from `main` before starting new work.
- Let Codex work only inside your active branch.
- Do not ask multiple Codex sessions to edit the same files at the same time.
- Prefer small patches over large refactors unless the task requires it.

## Local verification

Before opening a PR:

```bash
npm run build
```

If you touched Siebel-backed flows, also validate the runtime behavior locally:

```bash
npm run start:runtime
```

## Secrets

- Never commit `.env.local`.
- Keep customer credentials and tokens outside the repo.
- Update `.env.example` when new environment variables are added.
