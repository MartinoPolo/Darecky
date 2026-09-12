---
name: mp-board-to-issues
description:
    Convert Obsidian board notes in the To Process lane into deduplicated, labelled GitHub issues,
    then move created items to Ready to implement. Use when processing the project board or turning
    board notes into GitHub issues.
argument-hint: '[optional guidance]'
disable-model-invocation: true
allowed-tools: Read Edit AskUserQuestion Bash(gh *)
metadata:
    author: MartinoPolo
    version: '0.5-project-workaround'
    category: project-management
---

# Board to Issues

Turn board notes into well-formed GitHub issues. `$ARGUMENTS` is optional free-text guidance, such
as `only the login bug`; it is never a section selector.

Read [the board convention](references/BOARD_CONVENTION.md) and
[the issue template](references/GITHUB_ISSUE_TEMPLATE.md) before processing items.

## Rules

- Conversion is not blindly 1:1: merge related bullets into one issue and skip notes that duplicate
  an existing open issue.
- Use HITL only for genuine unanswered requirement questions. Visual inspection, manual testing, and
  QA do not make an issue HITL.
- The board lane, not the checkbox, defines state. Never change a board checkbox.

## Process

1. Read `.mpx/BOARD.md`. Process only `- [ ]` bullets in `# To Process`; skip bullets already
   annotated `→ #<N>` and all other lanes.
2. Preserve each item's text, continuation lines, and every `![[...]]` image wikilink. Read each
   referenced image from `.mpx/board-files/<filename>`; remove an optional `|<width>` suffix from
   the filename.
3. Group related bullets. Search existing open issues with
   `gh issue list --state open --search "<keywords>"`, using `gh search issues` when useful. Mark
   likely duplicates with their existing issue numbers.
4. Draft each proposed issue:
    - Use the template sections: `## Description`, `## Requirements` (`REQ-1` onward),
      `## Acceptance Criteria`, and `## Notes`. Mention screenshots in Notes.
    - Estimate `size:S` for a few local changes, `size:M` for a contained multi-file change, or
      `size:L` for cross-cutting work.
    - Infer `bug` for a defect, `task` for a chore/audit/refactor, or `enhancement` for a
      capability/improvement.
    - Apply the inferred type, exactly one of `AFK` or `HITL`, exactly one `size:<X>`, and inferred
      `area:*` labels.
    - Add the template's unanswered-questions block only to HITL issues.
5. Before creating anything, present the complete mapping from board bullets to proposed issues,
   including labels, size, AFK/HITL status, merges, and skipped duplicates. Use `AskUserQuestion` to
   obtain explicit confirmation; accept corrections to the plan.
6. Create only confirmed issues, assigning each to `@me`:

```bash
gh issue create --title "<title>" --label "<type>,<AFK|HITL>,size:<X>,area:<area>" --assignee @me --body "$(cat <<'EOF'
<body per the bundled issue template>
EOF
)"
```

7. For every created issue, move its original item from `# To Process` to `# Ready to implement` in
   `.mpx/BOARD.md`, append ` → #<N>`, and leave its `- [ ]` marker unchanged. If writing through the
   board symlink fails, resolve its vault target and edit that real file.
8. If any HITL issues were created, offer to resolve their unanswered questions now.

## Report

List created issues (number, title, labels, size), merged bullets, skipped duplicates with their
existing issue numbers, and HITL issues awaiting resolution.
