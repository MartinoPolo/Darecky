# Board convention

`.mpx/BOARD.md` is the project board; it may be a symlink to the Obsidian vault. `.mpx/board-files/`
is the attachment directory. If an edit through the board symlink is refused, resolve and edit its
vault target.

The board lanes are `# To Process`, `# Ready to implement`, `# Manual testing`, and `# Archive`.
Only top-level `- [ ]` items in `# To Process` are issue intake. The lane is the state machine; the
checkbox is the user's manual-verification flag and agents never change it.

A created issue moves its item to `# Ready to implement` and appends ` → #<N>`, retaining `- [ ]`.
Notes may contain continuation lines and image wikilinks such as `![[Pasted image.png]]` or
`![[Pasted image.png|639]]`. Resolve every image by its bare filename in `.mpx/board-files/`.

Classify a defect as `bug`, a chore/audit/refactor as `task`, and a new capability or improvement as
`enhancement`. Board position does not determine type.
