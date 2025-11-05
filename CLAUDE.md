<div align="center">

# AGENTS.md — Agent Guide for the valtio-y Monorepo

</div>

> **Goal:** Give you (the AI agent) a predictable playbook for working inside this Bun workspace. If you ever feel stuck, skim this file first.

---

## 🧭 Quick Start Cheat Sheet

| If you need to…               | Run this command (from root)     |
| ----------------------------- | -------------------------------- |
| Lint code                     | `bun run lint`                   |
| Fix lint issues automatically | `bun run lint:fix`               |
| Format code                   | `bun run format`                 |
| Build all packages            | `bun run build` (uses turbo)     |
| Test all packages             | `bun run test` (uses turbo)      |
| Type check all packages       | `bun run typecheck` (uses turbo) |
| Dev mode all packages         | `bun run dev` (uses turbo)       |
| Create a changeset            | `bun changeset`                  |

Keep these commands nearby—most tasks you perform will be a combination of them.

---

## 🗺️ Table of Contents

1. [Standard Agent Workflow](#agent-workflow)
2. [Guiding Human Developers](#human-workflow)
3. [Git Workflow & Commit Conventions](#git-workflow)
4. [Command Reference Library](#command-reference)
5. [Project Overview](#project-overview)
6. [Critical Rules for AI Agents](#critical-rules)
7. [Documentation Reference](#documentation)
8. [Quick Wins](#quick-wins)
9. [Need Help?](#need-help)

Use the links above to jump directly to the guidance you need.

---

<a id="agent-workflow"></a>

## 🛠️ Standard Agent Workflow

This monorepo is designed so you can verify correctness entirely through static checks and targeted tests.

1. **Execute targeted tests** – Use `cd valtio-y && bun run test` to run all tests, or `bun vitest --run src/path/to/test.ts` to run specific test files. Avoid watch mode unless explicitly requested.

2. **Type check** – `cd valtio-y && bun run typecheck` ensures TypeScript correctness and catches type errors, const reassignments, type mismatches, and other compilation errors. **This is equally important as linting** – both tools serve different purposes.

3. **Lint + Format** – Run `bun run lint:fix` to fix lint issues automatically, then `bun run format` to format code. Both commands are fast enough to run across the whole repo when needed. Use `bun run check` to run both formatting and linting in one command.

4. **Repeat as Needed** – After changes, re-run the relevant steps. If you touch multiple packages, rebuild and verify each affected project.

**Important:** Use **both** type checking and linting in equal parts:

- **Type checking (`bun run typecheck`)** catches type errors, const violations, duplicate declarations
- **Linting (`bun run lint`)** catches code style, patterns, and best practices

These tools are complementary, not redundant. Your IDE may show both types of errors, but you need to run both commands to verify correctness.

This is **your** loop. You do **not** need to run dev servers or browsers to verify your work.

---

<a id="human-workflow"></a>

## 🧑‍🤝‍🧑 Guiding Human Developers

When answering questions from humans, point them to the development workflow:

**For testing:**

```bash
cd valtio-y && bun run test
```

**For development with watch mode:**

```bash
cd valtio-y && bun run dev
```

**For building:**

```bash
cd valtio-y && bun run build
```

**For running examples:**
Each example directory has its own setup. Navigate to the example directory and follow its README or package.json scripts.

---

<a id="git-workflow"></a>

## 🌿 Git Workflow & Commit Conventions

### Branch Naming

Use descriptive branch names that follow this pattern:

```
<type>/<short-description>
```

**Common types:**

- `feat/` - New features
- `fix/` - Bug fixes
- `chore/` - Maintenance tasks (dependencies, tooling, etc.)
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or updates
- `perf/` - Performance improvements

**Examples:**

```bash
git checkout -b feat/partykit-provider
git checkout -b fix/array-sync-bug
git checkout -b chore/readme-updates
git checkout -b docs/architecture-guide
```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**⚠️ IMPORTANT: Scope is REQUIRED. All commits and PR titles must include a scope.**

**Type:**

- `feat` - New feature
- `fix` - Bug fix
- `chore` - Maintenance tasks
- `docs` - Documentation changes
- `refactor` - Code refactoring
- `test` - Test updates
- `perf` - Performance improvements
- `ci` - CI/CD changes

**Scope** (REQUIRED - indicates what part of the codebase):

- `core` - Main valtio-y package
- `docs` - Documentation
- `examples` - Example applications
- `ci` - CI/CD pipeline
- `deps` - Dependency updates
- `tests` - Test infrastructure
- `repo` - Repository-wide changes (tooling, configuration, etc.)

**Examples:**

```bash
feat(core): add Y.Text integration support
fix(core): resolve array sync race condition
chore(docs): clarify provider setup in README
docs(architecture): add data flow diagrams
feat(examples): add PartyKit todo example
fix(ci): update Node version in GitHub Actions
chore(deps): upgrade Valtio to 2.1.8
test(core): add benchmarks for bulk operations
chore(repo): update release-please configuration
```

**Guidelines:**

- **Scope is mandatory** - PR titles without a scope will be rejected by CI
- Keep the description concise (≤72 characters)
- Use present tense ("add" not "added")
- Don't capitalize the first letter of description
- No period at the end of description
- Use the body to explain **what** and **why**, not **how**

**Example with body:**

```
feat(core): add custom message support for providers

Enables sending custom string messages over the same WebSocket
connection used for Yjs sync. Useful for chat features and
function calling patterns.

Closes #42
```

### Workflow

1. **Create a branch** from `main`:

   ```bash
   git checkout main
   git pull
   git checkout -b type/description
   ```

2. **Make changes** and commit following conventions:

   ```bash
   # Make changes
   git add .
   git commit -m "feat(core): add new feature"
   ```

3. **Run quality checks** before pushing:

   ```bash
   bun run check              # Format + lint
   cd valtio-y && bun run typecheck
   cd valtio-y && bun run test
   ```

4. **Push and create PR**:

   ```bash
   git push -u origin type/description
   # Create PR on GitHub
   ```

5. **PR Title** must follow conventional commits with scope (enforced by CI):
   ```
   feat(core): add PartyKit provider support
   fix(docs): correct installation instructions
   chore(ci): update deployment workflow
   ```

   **Note:** PR titles without a scope will be rejected. See `.github/workflows/pr-title.yml` for enforcement details.

### Release Workflow

This project uses **Changesets** with **Turbo** to manage versioning and releases, providing explicit control over changelogs.

**How it works:**

1. **Create a changeset** - When making changes, run `bun changeset` to create a changeset file:
   ```bash
   bun changeset
   ```
   This prompts you to:
   - Select the packages to version (usually `valtio-y`)
   - Choose the version bump type (major, minor, patch)
   - Write a user-focused description for the changelog

2. **Commit the changeset** - The changeset file (`.changeset/*.md`) should be committed with your changes:
   ```bash
   git add .changeset/
   git commit -m "feat(core): add new feature"
   ```

3. **Version PR created** - When merged to main, the Release workflow automatically creates/updates a "Version Packages" PR with:
   - Runs: `bun run version` → `changeset version && bun update`
   - Updates package.json versions and CHANGELOG.md files
   - **Bun workaround**: `bun update` fixes the lockfile to resolve `workspace:*` references
   - Version PR is ready for review

4. **Merge to publish** - When you merge the Version Packages PR:
   - The workflow runs all quality checks (typecheck, lint, test, build)
   - Runs: `bun run release` → `turbo run publish --filter='valtio-*' && changeset tag`
   - Turbo runs the `publish` script in each `valtio-*` package
   - Each package publishes with: `npm publish --access public --provenance`
   - Git tags are created for published versions

**For AI agents:**

**When to create a changeset:**

Create a changeset ONLY for changes that affect the published npm package:

✅ **Need a changeset:**
- `feat(core)` - New features, APIs, exports
- `fix(core)` - Bug fixes users will notice
- `perf(core)` - Performance improvements
- Breaking changes to published APIs

❌ **NO changeset needed:**
- `chore(ci)` - CI/CD, workflows, build config
- `chore(repo)` - Dev tooling, linting, formatting
- `feat(examples)` - Examples don't get published
- `docs(repo)` - CLAUDE.md, CONTRIBUTING.md, etc.
- `test(core)` - Test files and utilities
- `refactor(core)` - Internal changes with no API impact

**Rule of thumb:** Ask "Does this affect someone using `valtio-y` from npm?" If yes → changeset. If no → skip.

**Workflow:**

1. Make the code changes
2. **IF user-facing:** Create a changeset using `bun changeset`
3. Commit both the code changes and the changeset file together
4. The changeset description should be user-focused, not code-focused

**Examples:**

```bash
# feat(core) - NEEDS changeset
# Changes: src/index.ts exports new function
bun changeset  # Select valtio-y, minor, describe feature
git commit -m "feat(core): add useYjsProxy hook"

# chore(ci) - NO changeset
# Changes: .github/workflows/
git commit -m "chore(ci): optimize test workflow"
# Skip bun changeset!

# fix(core) - NEEDS changeset
# Changes: src/synchronizer.ts fixes bug
bun changeset  # Select valtio-y, patch, describe fix
git commit -m "fix(core): resolve array sync race condition"
```

**Adding new packages:**

To make a new package publishable:

1. Add a `publish` script to the package's `package.json`:
   ```json
   {
     "scripts": {
       "publish": "npm publish --access public --provenance"
     }
   }
   ```

2. Ensure the package name matches `valtio-*` pattern
3. Turbo will automatically discover and publish it in the correct order

**Technical details:**

- **Root scripts**:
  - `version`: `changeset version && bun update` (updates versions + fixes Bun lockfile)
  - `release`: `turbo run publish --filter='valtio-*' && changeset tag` (publishes packages + creates tags)
- **Bun workaround**: `bun update` after `changeset version` is required because changesets doesn't natively support Bun workspaces. This resolves `workspace:*` references in the lockfile.
- **Turbo filter**: `--filter='valtio-*'` ensures only `valtio-y` and future `valtio-*` packages are published, never examples

**Version bumping rules:**

- `major` → Breaking changes (1.0.0 → 2.0.0)
- `minor` → New features (1.0.0 → 1.1.0)
- `patch` → Bug fixes (1.0.0 → 1.0.1)

**Example changeset file (`.changeset/cool-feature.md`):**

```md
---
"valtio-y": minor
---

Add custom message support for providers. You can now send custom string messages over the same WebSocket connection used for Yjs sync, enabling chat features and function calling patterns.
```

**Related workflows:**

- `.github/workflows/release.yml` - Creates version PRs and publishes to npm
- `.github/workflows/pr-title.yml` - Enforces conventional commit format for PR titles

**Why changesets over release-please?**

- **Explicit control**: Changelog entries are written intentionally, not inferred from commits
- **Better quality**: Changeset descriptions can be detailed and user-focused
- **Reviewable**: Changelog entries are reviewed as part of the PR
- **Easy to fix**: Mistakes in changesets can be fixed by editing the `.changeset/*.md` file

---

<a id="command-reference"></a>

## 🧰 Command Reference Library

Below is a categorized command index. Skim the left column to find the action you need, then run the command in the right column.

| Area         | Situation                       | Command                                               |
| ------------ | ------------------------------- | ----------------------------------------------------- |
| Development  | Build package                   | `cd valtio-y && bun run build`                        |
|              | Watch mode (dev)                | `cd valtio-y && bun run dev`                          |
| Testing      | Run all tests                   | `cd valtio-y && bun run test`                         |
|              | Run a single test file          | `cd valtio-y && bun vitest --run src/path/to/test.ts` |
|              | Run benchmarks                  | `cd valtio-y && bun run bench`                        |
| Type Safety  | Run TypeScript checks           | `cd valtio-y && bun run typecheck`                    |
| Linting      | Check lint issues               | `bun run lint`                                        |
|              | Fix lint issues automatically   | `bun run lint:fix`                                    |
| Formatting   | Auto-format files               | `bun run format`                                      |
|              | Check formatting without fixing | `bun run format:check`                                |
| Code Quality | Format + lint (full check)      | `bun run check`                                       |

💡 **Usage tips**

- After editing files, run `bun run check` (which runs `format` + `lint:fix`) before committing.
- Never invoke underlying tools (e.g., `vitest`, `tsc`) directly unless necessary—use the package.json scripts to respect project configuration.
- When working in the `valtio-y` package, make sure to `cd valtio-y` first or use relative paths.

---

<a id="project-overview"></a>

## Project Overview

TypeScript monorepo using **Bun** (package manager) for a library that syncs **Valtio** state with **Yjs** CRDTs.

**Key principle**: Two-way sync between Valtio proxies and Yjs CRDTs for building multi-user apps with minimal effort.

### Tech Stack

- **TypeScript 5.9+** - Strict mode with project references
- **Bun 1.3.1+** - Package manager with workspace support
- **Valtio 2.1.8+** - Reactive state management
- **Yjs 13.6.27+** - CRDT library for collaboration
- **Vitest 3.2+** - Testing framework
- **tsdown** - TypeScript bundler for packages
- **oxlint** - Fast linter
- **Prettier** - Code formatter

### Folder Structure

```text
/Users/alex/code/valtio-yjs/

├── valtio-y/            # Main package
│   ├── src/             # Source code
│   ├── tests/           # Test files
│   ├── benchmarks/      # Performance benchmarks
│   └── dist/            # Built artifacts
├── examples/            # Example applications
│   ├── 01_obj/          # Object sync example
│   ├── 02_array/        # Array sync example
│   ├── 03_minecraft/    # Minecraft clone example
│   ├── 04_todos/        # Todo app example
│   └── 05_todos_simple/ # Simple todos example
└── docs/                # Documentation
    └── architecture/    # Architecture docs (architecture, data flow, limitations, ADRs)
```

**⚠️ Caution**: Changes to the main `valtio-y` package affect all examples. Test thoroughly before committing.

### Important Notes

- **Y.Text Integration**: Y.Text and XML types have been removed from the main branch. The library focuses on shared application state (objects, arrays, primitives), not text editors. Y.Text research is preserved in the `research/ytext-integration` branch.
- **Scope**: valtio-y is for collaborative data structures, not for building text editors. Text editor builders should use native Yjs integrations (Lexical, TipTap, ProseMirror).

---

<a id="critical-rules"></a>

## Critical Rules for AI Agents

1. ⚠️ **Always use `bun run` for scripts** - Use `bun run` to ensure you're using the installed versions and respecting package.json scripts

2. ⚠️ **Run tests from the valtio-y directory** - Most test commands need to be run from `cd valtio-y` first

3. ⚠️ **Use `--run` flag with vitest** - When running vitest directly, use `--run` flag to avoid watch mode

4. ⚠️ **Always use BOTH typecheck AND lint equally** - Type checking and linting serve different purposes and are equally important:

   - `cd valtio-y && bun run typecheck` catches **type errors** (const reassignment, type mismatches, duplicate declarations)
   - `bun run lint` catches **code patterns** (unused vars, floating promises, style issues)
   - Your IDE may show both, but you must run both commands to verify correctness

5. ⚠️ **Use format and lint aggressively** - After editing files, run `bun run check` (which runs `format` + `lint:fix`) to ensure code quality. It's fast enough to run on entire packages or the whole repo whenever you want a clean slate.

6. ⚠️ **Follow the workspace structure** - The main package is in `valtio-y/`, examples are in `examples/`. Respect the boundaries.

7. ⚠️ **Follow git conventions** - Use conventional commit format (`type(scope): description`) and create feature branches with descriptive names (`type/description`). See [Git Workflow](#git-workflow) for details.

8. ✅ **Test changes thoroughly** - Run tests before committing changes to ensure nothing breaks

9. ✅ **Check documentation** - Review `docs/` directory for architectural decisions and limitations

10. ✅ **Respect limitations** - See README.md and docs/limitations.md for what's supported and what's not

11. ✅ **Use examples for reference** - Examples demonstrate real-world usage patterns

---

<a id="documentation"></a>

## Documentation Reference

Use the `docs/architecture/` directory as your deep-dive companion. Start with the topic that matches your task:

| Topic        | File                                           | Why you'd open it                       | Representative Guides                                        |
| ------------ | ---------------------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| Architecture | `docs/architecture/architecture.md`            | Understanding how valtio-y syncs state  | High-level architecture, data flow, synchronization patterns |
| Data Flow    | `docs/architecture/data-flow.md`               | Understanding how changes propagate     | Bidirectional sync, Yjs to Valtio, Valtio to Yjs             |
| Limitations  | `docs/architecture/limitations.md`             | Knowing what's supported and what's not | What works, what doesn't, edge cases                         |
| ADRs         | `docs/architecture/architectural-decisions.md` | Understanding design decisions          | Key architectural choices and rationale                      |

When unsure where to dig next, skim the relevant file or check the README.md for overview information.

---

<a id="quick-wins"></a>

## Quick Wins

### Discovery

- Check `package.json` `name` field for package names
- Look at `valtio-y/package.json` for main package scripts
- Review examples in `examples/` directory for usage patterns

### Package Management

- Use `bun add <package>` (not `npm` or `pnpm`)
- Workspace dependencies are managed via Bun workspaces
- Check `package.json` files for dependencies

### Testing

- Tests are in `valtio-y/tests/` directory
- Unit tests are co-located with source files (`src/**/*.test.ts`)
- Integration tests: `tests/integration/**/*.spec.{ts,tsx}`
- E2E tests: `tests/e2e/**/*.spec.{ts,tsx}`
- Basic examples: `tests/basic/**/*.spec.ts`

### Common Pitfalls

- ❌ Running tests from root → ✅ `cd valtio-y && bun run test`
- ❌ Tests hang in watch mode → ✅ Always use `--run` flag when running vitest directly
- ❌ Lint errors but IDE shows clean → ✅ Run `bun run lint` to catch actual lint issues
- ❌ IDE shows error but lint doesn't → ✅ That's a **type error**, not a linting issue. Run `cd valtio-y && bun run typecheck` to catch it
- ❌ Formatting inconsistencies → ✅ Run `bun run format` to auto-fix
- ❌ Forgetting to check both lint and typecheck → ✅ Always run both `bun run check` and `cd valtio-y && bun run typecheck`

---

<a id="need-help"></a>

## Need Help?

1. Check `docs/` for detailed implementation guidelines
2. Review `README.md` for usage examples and quick start
3. Look at `examples/` directory for real-world usage patterns
4. Check `valtio-y/package.json` for available scripts
5. Review test files for examples of how things work

**Version**: 1.0.0 | **Last Updated**: January 2025
