---
name: sk-test-audit
description:
    'Audit and improve the test suite — flag low-value tests, identify anti-patterns, and clean up.
    Use when: "audit tests", "test quality", "review tests", "test cleanup", "improve tests"'
argument-hint: '[scope: unit | storybook | e2e | all]'
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
metadata:
    author: MartinoPolo
    version: '0.1'
    category: code-review
---

# Test Suite Audit

Audit and improve the test suite. Default scope is `all`; pass `unit`, `storybook`, or `e2e` to
narrow.

## Judging Rules

Load these into context before evaluating any test.

### Good Tests

1. Test observable behavior through public APIs — not internal wiring
2. Describe WHAT, not HOW — test name reads as a requirement
3. Survive internal refactors — if behavior stays the same, tests stay green
4. One logical assertion per test — clear failure message, obvious what broke
5. Integration-style by default — exercise the real path users/callers take

### Anti-Patterns (flag for removal)

1. **Constant-shape tests**: asserting keys/values of `as const satisfies Record` objects —
   TypeScript already enforces this
2. **CSS class assertions**: asserting exact Tailwind classes, `tv()` output, animation classes, or
   `classList.contains()` checks — breaks on any design change. Test observable behavior instead
   (visibility, aria attributes, computed styles)
3. **Type-check tests**: verifying that a TypeScript interface is importable/usable — the compiler
   does this
4. **Mock-what-you-own**: mocking internal collaborators instead of system boundaries
5. **Call-count assertions**: `toHaveBeenCalledTimes(1)` on internal methods
6. **Test-only code**: functions defined inline in test files, tested as if production code
7. **No-op function tests**: testing functions that currently return input unchanged
8. **Magic-number counts**: `array.length === 15` on growing collections — use `toBeGreaterThan(0)`
   or dynamic checks
9. **Duplicate tests**: identical inputs and expectations with different names

### Mocking Rules

Mock at system boundaries only (external APIs, time, randomness, file system). Never mock what you
own. If you need to mock your own code, the design is wrong.

Decision rule: "Can I swap this dependency in production for a different provider?" If yes → mock.
If no → test the real thing.

## Process

### Step 1: Discover Tests

```bash
# Unit tests
find src -name "*.test.ts" | sort

# Storybook stories with play functions
grep -rl "play:" src --include="*.stories.svelte" | sort

# E2E tests
find tests -name "*.test.ts" -o -name "*.spec.ts" | sort

# Run tests to find failures
pnpm test 2>&1 | tail -50
```

### Step 2: Spawn Parallel Reviewers

Split test files into groups of 10-15. For each group, spawn an Agent that:

1. Reads every test file in full
2. Reads the corresponding source file to understand public API vs internals
3. Evaluates each test against the judging rules
4. Reports per-file: path, test count, verdict (KEEP / REMOVE / IMPROVE), specific issues

Use this prompt template for each reviewer agent:

> You are auditing test quality. Read each file IN FULL and its source module. For each file report:
> File, Test count, Verdict (KEEP/REMOVE/IMPROVE), Issues, Value assessment. Rules: [paste judging >
> rules above] Files: [list of 10-15 files]

For storybook, check:

- Which stories have play functions vs are pure visual docs
- Whether play functions test user-visible behavior
- Import/runtime errors from the vitest-storybook integration

### Step 3: Compile Findings

Merge all reviewer reports into a single table:

| File | Tests | Verdict | Issues |
| ---- | ----- | ------- | ------ |

Group into:

- **DELETE**: entire file is zero-value
- **IMPROVE**: remove specific tests, fix weak assertions, deduplicate
- **KEEP**: no changes needed
- **INFRASTRUCTURE**: tooling issues (import errors, flaky tests)

### Step 4: Present Report and Confirm

Present the compiled report to the user. Include:

- Summary stats (total tests, tests to remove, tests to improve)
- DELETE list with reasoning
- IMPROVE list with specific changes
- KEEP list (just file names)
- Infrastructure issues

Ask the user to confirm before making changes.

### Step 5: Execute Changes

After confirmation, spawn parallel executor agents:

- One agent per DELETE/IMPROVE group
- Use `git rm` for file deletions
- Use Edit for targeted test removal
- Clean up unused imports after removals

### Step 6: Verify

```bash
pnpm test 2>&1 | tail -30
```

Confirm remaining tests still pass. Report final test count vs starting count.

## Verdict Criteria

| Verdict      | When                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| DELETE file  | Every test in the file matches an anti-pattern; zero behavioral value     |
| REMOVE test  | Individual test matches an anti-pattern within an otherwise good file     |
| IMPROVE test | Test has value but weak assertions, duplicate inputs, or brittle coupling |
| KEEP         | Tests observable behavior through public API; survives refactors          |

## Output

Report as markdown with the summary table, grouped actions, and verification results.
