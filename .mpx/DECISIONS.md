# Decisions

Settled architectural and design decisions for Přejeme si.

## Product & Domain

### Owner never sees reservation state

Decided: 2026-05-29
What: The wishlist owner cannot see which gifts are reserved, who reserved them, or any reservation counts.
Why: The surprise element is the core product differentiator — the owner should be genuinely surprised by their gifts.
Rejected: Partial visibility (e.g., showing counts but not names) — still leaks info and weakens the surprise.

### Sharing locks owner editing

Decided: 2026-05-29 — **Revised 2026-06-07** by "Post-share editing: per-field" below (blanket lock → per-field).
What: Once a wishlist is shared, the owner can only add new gifts. Edit and remove are locked for existing gifts.
Why: Prevents the owner from accidentally removing a reserved gift or inferring reservation state from blocked actions.
Rejected: Soft-delete approach (owner thinks they removed it but it persists) — too deceptive, confusing edge cases.

### Post-share editing: per-field, name is the identity anchor

Decided: 2026-06-07 (revises "Sharing locks owner editing"; delete grace revised 2026-07-02)
What: After sharing, the owner can still edit existing gifts' presentation/info fields — image (add/replace/remove/recrop), links (add/edit/remove), price/currency, priority, and description (append-only, see below). `name` is frozen — it is the gift's identity, what the gifter reserved against. Delete stays blocked after grace: pre-share gifts are deletable only during the initial 2-minute share grace, and gifts added after sharing are deletable only within 2 minutes of creation. Later edits never reopen delete/name grace. `quantity` is raise-only relative to its current value (never lowered). Unlocked fields are editable for ALL pre-share gifts uniformly — never conditional on reservation state.
Why: Owners legitimately need to add/fix an image, add alternative links, correct a price, or clarify details after sharing — none of these change what was reserved (the name). Uniform per-field unlock keeps the no-inference invariant intact. Lowering quantity is forbidden because clamping it to the reserved count would itself leak that count.
Rejected: Blanket lock (too rigid); reservation-conditional editing (leaks reservation state); editable name (gifter mismatch); quantity lowered with silent server clamp (the clamp leaks the reserved count); raise-only relative to reserved count rather than current value (same leak).

### Append-only description after sharing

Decided: 2026-06-07 (history display revised 2026-07-02)
What: At share time the existing `description` freezes (read-only). Post-share clarifications are added as immutable appended segments (`{ text, addedAt }`), rendered in an accent color with their date. The gifter always sees the original text they reserved against plus what changed since. If `description` was empty at share time, the first post-share text goes into the main field instead (nothing to preserve). Segments cannot be edited/deleted afterward — except within the grace window below. Gift cards, list rows, and the edit dialog show only the latest appended segment by default and expose a toggle for full history.
Why: Description is the field a gifter actually relies on; preserving the original + showing additions transparently protects them without forbidding clarification.
Rejected: Free editing with just an "edited" badge (loses the original the gifter relied on); structured revision history (over-engineered).

### Post-share grace window: 2-min scoped reversibility

Decided: 2026-06-07 (revised 2026-07-02)
What: Selected read-only transitions are reversible for 2 minutes. Sharing itself opens one initial full-edit window for pre-share gifts (`name` + delete included), but later gift edits do not reopen that window. Gifts added after sharing can be deleted only for 2 minutes after creation. Each appended description segment and the wishlist event date keep their own grace windows. A countdown communicates active full-edit or delete-only grace.
Why: Owners share, then immediately spot a typo or the wrong item. A short initial window allows last-minute corrections / undoing a premature lock without letting ordinary later edits resurrect destructive actions.
Rejected: Hard lock at the instant of sharing (no recovery from a premature share); edit-driven full-gift grace after later edits (reopens delete/name edit on already-shared gifts).

### Post-share edit transparency: uniform indicators, no notification

Decided: 2026-06-07
What: Edits made after sharing are surfaced to ALL visitors uniformly (never reservation-conditional): a per-gift "Upraveno po sdílení" badge driven by a dedicated `editedAfterShareAt` timestamp (not `updatedAt`, which reorder/mark-received also bump), plus the accent-colored description appends. No push/email notification fires — the scaffolded `RESERVED_GIFT_EDITED` type stays unused for owner edits. Per-field markers (e.g. price old→new) deferred.
Why: Gifters should notice a gift changed, but a notification per edit is noise; uniform visual indicators leak nothing and the owner sees identical UI whether or not the gift is reserved.
Rejected: Reservation-conditional indicators (inference leak); notifying gifters on every owner edit (noise); per-field diffs now (deferred).

### Net-zero grace-window revert clears the edit-transparency badge

Decided: 2026-07-12 (issue #124)
What: Byte-identical restoration of a gift's pre-edit state, made WITHIN the 2-minute post-share grace window (`isOwnerSharedGiftDeleteGraceOpen`: 2 min from `sharedAt` for pre-share gifts, 2 min from creation for post-share-created gifts), clears `editedAfterShareAt` (no badge). The pre-edit state is captured as a snapshot (`preEditShareSnapshot`) at the FIRST in-grace edit and compared against on every later in-grace edit — not against the immediately-preceding edit, so "A → B → A" clears but "A → B → C → B" does not. Once the grace window closes, any edit sets the badge permanently, even if it later "reverts" prior content — a post-grace revert (e.g. a week-later price change back to the original) is itself a change gifters should notice.
Why: "Kolo" → "Kolo horské" → "Kolo" within grace is a hasty correction, not information; permanently badging it is noise. Comparing against the original share-time snapshot (not the previous edit) keeps the rule precise: only a full round-trip back to what the gifter saw at share time counts as net-zero.
Rejected: Comparing against the immediately-preceding edit instead of the original snapshot (would let unrelated back-and-forth edits "cancel out"); extending net-zero clearing past the grace window (a stale, no-longer-forgivable edit history shouldn't retroactively un-badge).

### Single reservation state (no "bought" step)

Decided: 2026-05-29
What: Gifts have one binary state: free or reserved. No separate "bought" confirmation.
Why: Simpler model. The distinction between "reserved" and "bought" adds complexity without clear user value — the gifter knows whether they bought it.
Rejected: Two-step (reserve → bought) — unnecessary granularity.

### Like system for interest signaling

Decided: 2026-05-29
What: Visitors can "like" a gift to indicate interest. Likes are persistent (not auto-removed by reserving). If a liked gift is reserved by someone else, the liker is notified.
Why: Solves the "too many notifications" problem — only interested parties get notified, not all followers.
Rejected: Notify all followers on every reservation (too noisy), no notification system (users buy duplicates).

### Quantity field on gifts

Decided: 2026-05-29
What: Each gift has a max quantity (default 1, hidden when 1, optional unlimited). Visitors choose how many units to reserve.
Why: Supports real-world cases like "3 towels" without forcing duplicate gift entries.
Rejected: One entry = one reservation only (too limiting for fungible items).

### Open wishlist access

Decided: 2026-05-29
What: Anyone with the wishlist link can view and reserve gifts. No access control or invite-only mode.
Why: Simplicity — wishlists are shared with trusted people. Restricted mode adds friction without clear value for a family app.
Rejected: Invite-only mode (planned never — unnecessary for target audience).

### Manual archive only

Decided: 2026-05-29
What: Owner manually archives wishlists. If an event date is set, a prompt suggests archiving after the date passes.
Why: Auto-archive could catch users off guard (late gift-givers). Manual control is safer.
Rejected: Auto-archive after event date (too aggressive), time-based expiry (arbitrary).

## Roles & Permissions

### Owner can add gifts but not moderate by default

Decided: 2026-05-29 — **Superseded 2026-07-08** by "Recipient replaces owner" below (owner role dissolved into recipient + správce).
What: Owner adds gifts to their wishlist and marks received. They cannot edit, remove, or see reservation state unless they self-promote to moderator.
Why: Clean separation — the owner is the "recipient" role, not the "manager" role.
Rejected: Owner has full edit powers (breaks surprise mechanic if they notice blocked removals).

### Moderator assigned by owner only

Decided: 2026-05-29 — **Revised 2026-07-08** by "Správci can add and revoke správci" below.
What: Only the owner can promote users to moderator (via invite link with token or by email). Moderators cannot promote others. No limit on moderator count.
Why: Owner controls trust chain. Preventing moderator-to-moderator promotion avoids uncontrolled access spread.
Rejected: Moderators can promote others (security risk), single moderator limit (too restrictive for families).

### Owner self-promote to moderator with disclosure

Decided: 2026-05-29 — **Reworded 2026-07-08**: now "recipient self-promotes to správce"; mechanics (notification + permanent banner) unchanged.
What: Owner can opt into moderator role (seeing full state), but this triggers a notification to all visitors and shows a permanent banner on the wishlist.
Why: Maintains trust — visitors know the surprise is no longer protected for this wishlist.
Rejected: Silent self-promote (breaks trust), no self-promote option (too restrictive for some use cases).

### Recipient replaces owner: recipient + správce roles

Decided: 2026-07-08 — **Revised 2026-07-14** by "Recipient reassignment: linked → free-text flip" below (the no-conversion rule is relaxed one way).
What: The standalone "owner" role is dissolved. Every wishlist has a **Recipient** — the person gifts are for — either a linked user account or a free-text name (e.g. a child without email), plus one or more **Správci** (UI term for the `moderator` role). At creation the user picks "for me" (creator = linked recipient) or "for someone else" (creator = first správce, recipient = free-text name). No for-me ↔ for-someone conversion after creation; správci may rename a free-text recipient anytime. Nav: for-someone lists appear under Spravované for správci and under Moje seznamy for a linked recipient.
Why: A parent managing a kid's list was impossible — `ownerId` conflated manager and recipient, and moderators lacked management rights (share/archive/metadata). One model now covers both self-lists and lists for others.
Rejected: Display-only recipientName on top of the owner model (keeps the conflation); kid account as owner + parent as moderator (kids lack email; parent loses management rights); post-creation conversion (a self-list flip would silently grant reservation visibility).

### Rights matrix: recipient vs správce

Decided: 2026-07-08
What: Recipient (with account): add gifts, edit per post-share rules, mark received, edit metadata/theme/image, share, archive, delete, manage správci — but NEVER sees reservations/likes/gifter identities and cannot reserve. Správce: all recipient rights PLUS full reservation visibility and reserving gifts (on any list). Visitors unchanged (see reserved state, not gifter identity). Removing the last správce of a for-someone list is blocked (orphan guard — a free-text recipient cannot manage anything).
Why: "Správce sees everything, recipient sees no spoilers" is the entire role distinction; a family-trust app favors symmetric powers over hierarchy.
Rejected: Správce without share/archive/delete (recreates the owner bottleneck this feature removes); správce unable to reserve (a parent is also a gifter on their kid's list).

### Správci can add and revoke správci

Decided: 2026-07-08 (revises "Moderator assigned by owner only")
What: Any správce — and a linked recipient — can invite and revoke správci. Removing the last správce of a for-someone list is blocked.
Why: For-someone lists have no owner to gate the trust chain, and the creator may go inactive.
Rejected: Creator-only assignment (single point of failure).

### Recipient account linking via claim token (follow-up)

Decided: 2026-07-08 — **Refined 2026-07-14** by "Claim token: semantics and spoiler guards" below; ships with recipient reassignment, no longer a follow-up.
What: v1 ships free-text recipients only, but the schema carries a nullable `recipientUserId` from day one. A follow-up adds a "Pozvat obdarovaného" claim link (token-based, like moderator invites): claiming links the account, shows the list in the recipient's Moje seznamy with recipient rights, and strips reservation state from their view.
Why: Kids — the primary case — have no accounts. A claim link gives an explicit consent moment; email lookup at creation invites typos and surprises.
Rejected: Email lookup at creation; shipping linking inside the first release (delays the headline feature).

### Migration: existing lists become self-recipient

Decided: 2026-07-08
What: Existing wishlists map losslessly: former owner → linked recipient; `ownerIsModerator = true` → recipient-also-správce (disclosure banner kept, reworded „Obdarovaný je zároveň správcem"). Additive columns; renames via raw SQL (Drizzle push is interactive).
Why: Production data must be preserved; the old model is a strict subset of the new one.

### UI terminology: obdarovaný / správce; code keeps moderator

Decided: 2026-07-08
What: UI terms — cs „obdarovaný" / en "recipient"; cs „správce" / en "manager". Code and DB keep `moderator` identifiers (tables, role enum); owner→recipient identifiers are renamed during implementation.
Why: "Moderator" is unfamiliar to the target audience; renaming the prod moderator tables is churn without user-facing gain.
Rejected: Renaming moderator tables/enum; „příjemce" (postal register), „oslavenec" (birthday-only).

### Recipient reassignment: linked → free-text flip

Decided: 2026-07-14 (relaxes the "no for-me ↔ for-someone conversion" rule from 2026-07-08)
What: A linked recipient can convert their OWN list to a free-text recipient (the migrated-parent-list case, e.g. Martin → „Rosie"). Správci cannot (no evicting a linked recipient). On flip: `recipientUserId` cleared, `recipientName` set, ex-recipient gets an automatic active `moderator_assignment` row (keeps management, gains normal správce visibility), `recipientIsModerator` resets to false — the trust banner disappears; the always-visible „Spravuje {name}" line is the ongoing disclosure. Shared list: followers notified via the self-promote channel (email + in-app) that the actor now sees reservations. Draft: silent. Archived: rejected. Free-text rename unchanged (any správce). UI: pencil icon next to the header „Pro: {name}" (managers only; on linked lists only the linked recipient) + a recipient row in the settings modal — both open one dialog with consequence copy.
Why: Migrated production lists conflate creator and recipient. Actor-only flip builds consent in — the person gaining reservation visibility is the person clicking, and gifters are notified.
Rejected: správce-initiated flip (evicts a linked recipient, silently changes whose spoilers are protected); linked → linked transfer (claim token covers linking); permanent "recipient changed" banner (one-time notification + visible „Spravuje" line suffice).

### Claim token: semantics and spoiler guards

Decided: 2026-07-14 (implements + refines "Recipient account linking via claim token"; ships with recipient reassignment)
What: Any správce of a free-text-recipient list generates a claim link (token table mirroring `moderator_invite`; optional email send, both modes). Claiming (logged-in) sets `recipientUserId` = claimer and CLEARS `recipientName` — the account name becomes canonical. The list moves to the claimer's Moje seznamy; reservation state is stripped from their view. Guards: reject if the claimer ever held správce access after the list was shared (assignment history incl. soft-deleted rows — prevents flip → claim-back laundering of reservation visibility) and reject if the claimer has active reservations on the list (cancel first). Správci get an in-app notification on claim (no email). Správce panel shows a nudge: „Má obdarovaný vlastní účet? Pošlete mu odkaz na propojení."
Why: Explicit consent moment; the post-share-správce guard keeps "recipient never saw reservations" honest — otherwise flip + claim-back would erase the permanent-disclosure promise.
Rejected: keeping `recipientName` as display override after claim (two names for one person); allowing ex-správci to claim with a warning banner (complex, weak guarantee); friends/user-search system (heavy social graph; claim link covers the need).

### Revert to draft: správce when clean, admin when reserved

Decided: 2026-07-14
What: An active shared list can revert to draft. Zero reservations: any správce, silent (no notifications). With reservations: app admin only — cancels all reservations and notifies reservers (email to registered + anonymous-with-email; in-app for registered; anonymous without email is unreachable, accepted). The recipient NEVER sees the revert option (a self list without správce cannot be reverted at all). Revert clears `sharedAt` (full edit rights return, event-date lock released), clears „Upraveno po sdílení" badges, DISCARDS description appends (the share-time description text is kept), keeps likes + followers. Non-managers on `/w/<id>` see a friendly „Seznam se připravuje" page; the same URL works again after re-share. Re-share is a full share transition (fresh grace, name re-freeze). Archived lists must be unarchived first. UI: danger tab above delete; a non-admin správce sees the reserved variant disabled with „Seznam už má rezervace, vrácení může provést jen administrátor."
Why: Fixes premature-share mistakes. Hiding the option from recipients avoids the leak where seeing WHICH revert variant renders reveals whether reservations exist; admin gating keeps reservation-cancelling power away from every správce.
Rejected: recipient-accessible revert with uniform no-leak copy (hiding entirely is simpler and leak-free); správce-wide reserved revert (too destructive); notifying followers on a clean revert (nothing at stake).

### App admin via ADMIN_EMAILS env var

Decided: 2026-07-14
What: Comma-separated `ADMIN_EMAILS` env var; a server-side helper matches the session user's email. Grants: reserved-list revert + the settings gear visible on any list (danger/admin actions only), and — since issue #213 — releasing any SINGLE reservation on any list plus reading that list's reservation ledger. Both grants stop at the obdarovaný: an administrator gets nothing on a list they are the obdarovaný of, because the rendered control would leak whether their own surprise list holds reservations. The UI never learns who the administrator is; both surfaces switch on a server-computed capability (`resolveRevertCapability`, `resolveReservationReleaseCapability`). Admin is NOT a správce — never appears in headers or panels.
Why: Single-operator production app; zero schema change; changing admins = redeploy, which is rare and fine.
Rejected: `user.isAdmin` DB column (buys nothing without an admin UI); admin-implies-správce (too broad, would surface in list UI).

## Authentication & Users

### Auth: email/password + optional Google

Decided: 2026-05-29 — Revised by the magic-link removal decision.
What: BetterAuth supports email/password and optional Google sign-in. Magic-link sign-in is removed from both backend and UI. Email verification and password reset remain enabled; existing accounts, sessions, and verification storage are preserved. Anyone who previously relied on magic links can establish a password through password reset.
Why: Remove an unnecessary authentication method to reduce attack surface and maintenance. Anonymous reservations and Google still support low-friction participation. This does not replace keeping authentication dependencies patched.
Rejected: Hiding the magic-link UI while leaving its endpoints active; retaining an inactive implementation; deleting existing users or shared verification storage.

### Anonymous visitor mode

Decided: 2026-05-29
What: Anonymous users can visit wishlists and reserve gifts. They provide a display name (required) + email (optional). No persistence — no dashboard, no followed lists.
Why: Minimizes friction for one-time visitors (grandma who just wants to reserve a gift).
Rejected: Require account for all actions (too much friction), fully anonymous without any identifier (moderator can't see who reserved what).

## UI & Theming

### Dropdown viewport containment uses flip before unrestricted shift

Decided: 2026-09-05
What: Shared dropdown content and submenu wrappers use `sticky="always"`, an 8px collision boundary, and a viewport-only `max-height: calc(100dvh - 1rem)` with internal vertical scrolling. For explicitly always-sticky floating layers, the patched Bits UI middleware tries the preferred/opposite side before shifting on both axes; the package's default partial-sticky middleware order and limiter remain unchanged. Feature wrappers do not impose a shorter content cap based on space next to the trigger.
Why: A dropdown that fits in the usable viewport should remain full-height and may move away from ideal trigger alignment. Shifting before flipping with cross-axis movement disabled could leave a full-height menu clipped when neither anchored side fit, while available-height-driven sizing would introduce unnecessary scrolling and geometry feedback.
Removal criteria: Remove the dependency patch when Bits UI provides equivalent flip-before-unrestricted-shift behavior for always-sticky floating layers, with the shared viewport, submenu, and Select regression tests passing unchanged.
Rejected: Custom virtual-anchor geometry; available-height-dependent shrinking; changing partial-sticky behavior; applying the dropdown exception to Popover without a demonstrated need.

### ~~Per-wishlist themes with 5 presets + custom~~ (superseded)

Decided: 2026-05-29 — **Superseded 2026-07-10** by "Single theming system: 10 app palettes" below.
~~What: Each wishlist has a theme set by owner/moderator. Presets: Christmas, Birthday, Fun, Elegant, Default (yellow base). Custom = one color picker, palette auto-derived via OKLCH.~~
Replaced because: the Redesign 2026 palette system covers per-wishlist identity with 10 curated palettes; named presets and the custom color picker are removed.

### Dark/light/system mode per-user

Decided: 2026-05-29
What: Users toggle between dark, light, and system mode. This is independent of wishlist themes — it controls the app chrome and adapts theme colors.
Why: Standard accessibility expectation. Per-user because it's a display preference, not content.
Rejected: Per-wishlist mode (visitors should control their own viewing comfort).

### Wishlist settings use one staged draft and global save

Decided: 2026-09-01
What: The Details, Categories, Appearance, and Image/Crops tabs share one staged settings draft. A global Save button is visible from every tab, persists all dirty settings together, and closes only after complete success. Palette changes preview locally but persist only on Save. Tab switches preserve drafts; closing, leaving, launching Import, or starting a Danger action with unsaved changes offers Save and continue, Discard, or Continue editing. Import/Export and Danger remain immediate workflows rather than staged settings. Category editing refreshes usage on entry and stays disabled until a fresh snapshot is available; tab switches preserve the draft without refetching. Usage counts remain live query metadata rather than editable draft fields. Tab navigation is pinned in a shrink-proof, constant-height area above body-only scrolling; its labels are centered at equal-width desktop sizes, while narrower viewports keep one horizontally scrollable row. Tabs are ordered Details → Categories → Appearance → Image/Crops → Import/Export → Danger Zone.
Why: Per-tab persistence mixed immediate and staged behavior, making it unclear what was saved and allowing changes to be lost. One draft and one exit guard give every editable setting the same predictable lifecycle without incorrectly treating imports or destructive actions as form fields.
Rejected: Per-tab save buttons; immediate palette persistence; prompts while switching tabs; staging import and destructive actions; a stretched vertical tablet tablist.

### Color picker uses explicit local acceptance

Decided: 2026-09-05
What: The reusable color picker captures the accepted color whenever it opens. Presets, valid or invalid hex text, and native color-dialog results change only a picker-local draft. A valid changed draft reaches the owning form only through the picker's explicit Save; Cancel, Escape, outside dismissal, or becoming disabled discards it. Case-only differences are unchanged. In wishlist settings, accepting the picker still changes only the shared settings draft; the global settings Save remains the persistence boundary.
Why: Dismissal was an ambiguous confirmation gesture, and immediate swatch changes obscured the distinction between choosing a color and saving settings.
Rejected: Immediate commits from picker inputs; implicit acceptance on dismissal; making the reusable picker responsible for parent persistence.

### Three nav pages, no Dashboard

Decided: 2026-05-30 (revised from 2026-05-29) — **Revised 2026-08-07** by "Logged-in home: Přehled overview at /home" below (Moje seznamy is no longer the default/home page; the three nav pages themselves remain).
What: Three first-level nav items: Moje seznamy, Spravované, Sledované — each is a separate page. No separate "Dashboard" page. "Moje seznamy" is the default/home page. Each nav item doubles as a dropdown trigger (hover shows recent items + "Zobrazit vše" link). Nav layout: Logo | Moje seznamy | Spravované | Sledované | [gap] | Vytvořit | 🔔 | 🌙 | 👤
Why: Fills the nav naturally, no redundancy (Dashboard would duplicate the same content), each page owns its own filters/sorting, dropdowns provide quick access.
Rejected: Single dashboard with tabs (redundant), Dashboard + three sub-pages (4 nav items, Dashboard page adds nothing).

### Logged-in home: Přehled overview at /home

Decided: 2026-08-07 (revises "Three nav pages, no Dashboard" — field observation of real users overturned the "Dashboard is redundant" rejection)
What: A new overview page (`/home`, cs „Přehled", en "Overview") becomes the logged-in home: `/` redirects there, login/register default there (absent an explicit `redirect` param), and the logo links there. NOT a desktop nav item — the nav keeps its three pages, which survive unchanged as „Zobrazit vše" targets; the mobile drawer gains a „Přehled" entry at the top. Layout: up to four horizontal carousel rows with the next card peeking (desktop and mobile alike): „Nedávné" first, then fixed order Sledované → Spravované → Moje seznamy; empty rows collapse. Category rows cap at 10 cards with a trailing „Zobrazit vše" card. Cards reuse `WishlistCard` at a narrower width with today's per-role props (reservation progress on followed/moderated, gift count on own); archived lists are excluded (full pages only, behind the existing toggle). Category-row sort: upcoming event date ascending, then undated lists by recently opened (created-date fallback), past-dated unarchived last. A brand-new user (zero lists anywhere) sees a single onboarding hero: „Vytvořte první seznam" plus an explanation of following via shared links. No carousel primitive exists in the repo — one is added (embla-based shadcn-svelte Carousel is the candidate).
Why: Observed real usage — the dominant logged-in flow is "open a specific followed list and order a gift", but every entry point (`/`, post-login, logo) landed on Moje seznamy; the nav hover dropdowns were the only quick path, are undiscoverable, and don't exist on mobile.
Rejected: Sledované as default (wrong for recipients and správci); fourth desktop nav item (re-crowds the 390px header — may be promoted later if logo-as-home proves undiscoverable); icon-only home nav item (icons are exactly what low-tech users miss); adaptive row order (unpredictable for the users observed); vertical stacked sections on mobile (push lower rows below the fold); a dense special overview card (one card identity app-wide; revisit only if rows feel too tall on mobile); names „Domů" (sounds like a browser button) and „Nástěnka" (corporate).

### Nedávné row: visit-recency tracking

Decided: 2026-08-07
What: The top Přehled row „Nedávné" mixes all three roles (followed, moderated, own), sorted by last visit descending, capped at ~6, rendered as a normal row (no oversized hero). Recency comes from a `lastVisitedAt` timestamp upserted on any logged-in visit to `/w/<id>` — own lists included; edits and reservations need no separate tracking (they imply a visit). Cold start falls back to the follow date so the row isn't empty before visits accumulate (no backfill migration). Items are NOT deduped from the category rows below — „Nedávné" is a shortcut layer; category rows stay complete.
Why: The observed flow is returning to the list you were just at; since logged-in visitors auto-follow on first visit, the followed set already approximates "visited" — one timestamp column adds recency without a new concept.
Rejected: Followed-only recents (a parent's visit to their own kid's list counts too); dedup against category rows (rows look mysteriously incomplete); a single extra-large most-recent hero card (spooky-prominent, wastes the viewport the rows concept is saving).

### Gift sorting: primary + secondary criteria

Decided: 2026-05-29
What: Owner sets default display order (drag-and-drop). Visitors can sort by: owner's order, priority, price, name, date added. Primary + secondary sort (Grovekeeper-style).
Why: Flexible for visitors while respecting owner's intent.
Rejected: Fixed sort only (too rigid), no default order (owner can't influence presentation).

### Gift detail as modal/drawer

Decided: 2026-05-29
What: Gift list view with expandable detail modal on click. Full image, description, link, price, reservation status (for non-owners).
Why: Keeps single-page feel, avoids per-gift URL routing complexity.
Rejected: Inline accordion (too noisy for long descriptions), dedicated gift pages (over-engineered for v1).

## Sharing & Links

### Permanent visitor URL + revocable moderator invite tokens

Decided: 2026-05-29
What: Each wishlist has a permanent URL (`/w/<short-id>`) for visitors. Moderator access via separate invite links with one-time/revocable tokens. Owner can revoke moderators individually.
Why: Simple sharing (one link for visitors), controlled access (revocable tokens for moderators).
Rejected: Single link with role parameter (security risk), separate links per visitor (over-complicated).

### Social sharing via intent URLs

Decided: 2026-05-29
What: Share buttons use standard intent URLs (WhatsApp `wa.me/?text=`, `mailto:`, etc.) with pre-filled messages. No API integrations needed.
Why: Works universally, no third-party API keys or rate limits, covers WhatsApp/email/Messenger/Telegram/SMS.
Rejected: Deep API integrations (maintenance burden, API key management), copy-link only (misses the low-friction sharing opportunity).

## Notifications

### Email for critical, in-app for everything else

Decided: 2026-05-29
What: Critical events (liked gift reserved by someone else, reserved gift edited by moderator, wishlist archived) sent via email. Non-critical (gifts reserved on followed lists, new gifts added) batched in-app only.
Why: Prevents notification fatigue while ensuring important events aren't missed.
Rejected: All by email (too noisy), all in-app only (critical events missed by inactive users).

### Notification email locale resolves from recipient preference

Decided: 2026-07-17
What: Notification email copy and internal links resolve at dispatch from the recipient's stored locale; Czech is the fallback for missing preferences and unmatched email addresses. Auth-email locale handling is unchanged.
Why: Emails are delivered outside a request context and must respect the recipient's latest explicit choice without inferring a locale from the sender or event.
Rejected: Ambient request locale (unavailable and wrong recipient), sender locale (recipient mismatch), email-address lookup for email-only recipients (scope and semantics expansion).

## Data & Storage

### ~~Separate banner and thumbnail uploads per wishlist~~ (superseded)

Decided: 2026-05-29 — **Superseded 2026-06-02** by "Single image_key + image_slots per wishlist" below.
~~What: Owner uploads a hero banner (wishlist page) and a thumbnail (dashboard cards) separately.~~
Replaced because: separate `banner_image_key` / `thumbnail_image_key` columns were removed; wishlists now use a single `image_key` with per-slot crop metadata in `image_slots` JSON.

### Single image_key + image_slots per wishlist (replaces separate banner/thumbnail)

Decided: 2026-06-02
What: Wishlists store one uploaded image (`image_key`) plus a JSON `image_slots` column that holds independent crop metadata for each named slot (`card`, `thumbnail`, `banner`, `social`). `banner_image_key` and `thumbnail_image_key` columns are removed.
Why: A single upload with per-slot cropping covers all display contexts without requiring the owner to manage multiple files. Each slot's crop is fully independent, so banner and card framings can differ.
Rejected: Keeping separate upload columns (upload friction, storage duplication).

### Gift images: URL + upload

Decided: 2026-05-29
What: Gift images can be added via external URL (link from a store) or file upload.
Why: URL is quick for linking from stores; upload covers custom items and stores without stable image URLs.
Rejected: URL-only (too limiting), upload-only (unnecessary friction for store items).

## Platform & Infrastructure

### App name: Přejeme si

Decided: 2026-05-29
What: Final app name is "Přejeme si" (from Czech "dárečky" = presents/gifts).
Why: Personal project, Czech audience, meaningful name.
Rejected: N/A — personal choice.

### Czech primary, English secondary

Decided: 2026-05-29
What: Czech is the primary language; English is the only other supported language. Uses Paraglide JS i18n.
Why: Czech creator, Czech target audience, Czech app name. English for international friends/family.
Rejected: English-first (doesn't match audience), more languages (unnecessary scope for a family app).

### SEO exposure: localized landing pages, private bearer-link wishlists

Decided: 2026-08-28 (issue #103)
What: Each landing locale has its own canonical URL plus `cs`, `en`, and `x-default` alternates. Bearer-link wishlists emit `X-Robots-Tag: noindex, nofollow, noarchive` while retaining Open Graph and Twitter metadata for link unfurls. No wishlist sitemap is published until wishlists gain an explicit, revocable publication mode.
Why: Landing pages should be discoverable in the correct locale, while possession of a wishlist link is not consent to search indexing. Social sharing remains a core workflow and does not require indexing.
Rejected: Indexing permanent bearer-link wishlists by default; removing social metadata to enforce privacy; publishing a wishlist sitemap before owners can explicitly publish and later revoke publication.

### No GDPR/cookie banners

Decided: 2026-05-29
What: No cookie consent banners or GDPR compliance UI in v1.
Why: Family app scope — the overhead isn't justified for the target audience.
Rejected: Full GDPR compliance (over-engineered for personal project).

### Cloudflare Workers + Neon Postgres + R2 ($0/month)

Decided: 2026-05-30
What: Deploy on Cloudflare Workers (free) with Neon Postgres via Hyperdrive, R2 for images, Resend for email. All free tiers.
Why: $0/month is a hard requirement for a family app. Current template already uses adapter-cloudflare. `postgres` v3.4.8 supports Workers TCP via Hyperdrive. `better-auth/minimal` is edge-compatible. Neon has no pause/deletion risk (just 300-800ms cold starts after 5min idle).
Rejected: Railway ($5-7/mo), Fly.io (no free tier since 2024), Render (free Postgres expires in 30 days), Vercel (would require driver changes), adapter-node (all Node hosting costs money).

### SvelteKit remote functions as the default client-server boundary

Decided: 2026-05-30
What: Use `query` for reads, `form` for progressive-enhancement mutations, and `command` for JS-only actions. Do not use traditional load functions or `+server.ts` API routes as the general convention. Exceptions are the BetterAuth catch-all, the purpose-specific machine API below, and `/home`: its deliberate `+page.server.ts` load awaits authenticated parent layout data and directly calls a server-only overview database service.
Why: Remote functions provide type-safe, colocated, deduplicated client-server communication. Single-flight mutations reduce round-trips, and progressive enhancement via `form` supports diverse devices. `/home` needs a typed SSR first paint without eager SSR or global fetch, while its direct service call avoids a costly intra-server remote invocation.
Rejected: Traditional load functions and form actions as the general convention (worse DX, no colocation, no dedup); tRPC (extra dependency when remote functions are built in); a `/home` server-to-server remote call (unnecessary invocation overhead).

### Purpose-specific machine API exception

Decided: 2026-08-09
What: `POST /api/internal/v1/gift-ingestion` is a deliberate exception to the remote-functions-only convention. A dedicated bearer token is bound by deployment configuration to one wishlist and one actor, accepts only versioned add-only manifests, defaults to side-effect-free dry-run, and invokes the shared transactional gift creation service. Durable run/item rows provide audit and idempotency. No read, update, delete, arbitrary destination, SQL, environment selection, browser-cookie authentication, or infrastructure credential input exists.
Why: A fixed local CLI and automation skill need a stable non-browser boundary, while direct database or R2 access would bypass domain validation, notification digests, audit, and production safety.
Rejected: BetterAuth browser cookies for machine calls; SQL generation/direct Neon access; a general-purpose CRUD API; caller-selected destination wishlists; immediate R2 mirroring.

### Durable ingestion image mirroring

Decided: 2026-08-10
What: The fixed-target ingestion API prepares only validated manifest items and issues 10-minute exact-key/type/length R2 presigned PUT URLs under `gifts/ingestion/`. The CLI validates HTTPS/DNS/redirect safety, size, image signature, MIME, and dimensions before preparation, uploads directly without R2 credentials, and apply HEAD-verifies each object before atomically storing `imageKey`. Requested images are all-or-nothing. Uncommitted staged objects are cleaned best-effort; bounded orphan rows record cleanup failures. Dry-run and identical replay do no image I/O, and committed images are never compensating-deleted. The project workflow is `.agents/skills/add-gifts/SKILL.md` with evidence-ordered extraction and explicit production/HITL gates.
Why: Retailer hotlinks are unstable and privacy-sensitive, while Worker-held presigning keeps durable storage credentials out of local automation and preserves fixed-target/idempotency boundaries.
Rejected: Passing R2 credentials to the CLI; proxying bytes through the Worker; trusting declared MIME alone; partial image success by default; deleting images after a committed gift transaction.

### Guarded remote function wrappers for auth

Decided: 2026-05-30
What: Reusable `guardedQuery`, `guardedCommand`, `guardedForm` wrappers that call `getRequestEvent()` and check `locals.user` before executing. BetterAuth's API routes stay for auth operations; remote functions handle app logic.
Why: Avoids repeating auth checks in every remote function. BetterAuth handles auth flow (cookies, OAuth redirects, CSRF); remote functions handle app data.
Rejected: Inline auth checks in each function (repetitive, error-prone), replacing BetterAuth routes with remote functions (breaks cookie/redirect flow).

### Turnstile bot protection is fail-open (advisory, not a hard gate)

Decided: 2026-07-16
What: Anonymous gift reservation carries a Cloudflare Turnstile check, but the server only rejects a present-but-bad token (`invalid`, `expired_or_replayed`), or a missing token while the check is configured and running. When the check cannot run at all — secret unconfigured (`configuration`) or Cloudflare Siteverify unreachable (`unavailable`) — the reservation is allowed and logged (`[Turnstile] unverified anonymous reservation allowed (fail-open)`) instead of returning 503. The client widget degrades silently: with no site key, or when the challenge script is blocked (ad-blocker / antivirus), the submit button is not disabled.
Why: Turnstile is defense-in-depth for a low-stakes action (no money, no account). A hard gate turned a config gap into a full outage — the keys shipped on 2026-07-12 were never deployed, so every guest hit „Bezpečnostní kontrola je dočasně nedostupná" behind a permanently disabled button. Availability of the core flow outweighs perfect bot filtering during a Turnstile outage/misconfig. Cloudflare WAF rate limiting, the required display name, and the per-browser cancel cookie remain as backstops.
Rejected: Fail-closed (503 on config/outage) — takes reservation offline whenever Turnstile hiccups or is unconfigured, and dead-ends every visitor whose AV/ad-blocker blocks the challenge script. Test keys in production — Cloudflare forbids it and it grants no protection anyway.

## Repository Structure

### Domain modules at src/lib/modules/

Decided: 2026-05-30
What: Each domain concern gets a module directory: wishlists, gifts, reservations, likes, notifications, themes, sharing. Each module owns types, remote functions (.remote.ts), context (.context.svelte.ts), and index.ts public API.
Why: Proven pattern from Grovekeeper. Small interface, large implementation. Modules are self-contained and testable.
Rejected: Flat file structure (doesn't scale), feature-based routes (couples domain logic to routing).

### Component tiers: base / derived / blocks

Decided: 2026-05-30
What: Three tiers — `base/` (shadcn-managed primitives, do not edit), `derived/` (reusable wrappers combining base components), `blocks/` (feature-level composed UI like WishlistCard, GiftDetailModal).
Why: Clear ownership and abstraction layers. Matches Grovekeeper's proven pattern with naming aligned to the user's preference.
Rejected: Two tiers only (blocks get mixed with primitives), four tiers (over-engineered for this app's complexity).

### Fallow for dead-code detection (replaces knip)

Decided: 2026-05-30
What: Use fallow with regression baseline gating. Run in check:all, CI, and pre-push. Suppressions via `// fallow-ignore-next-line <rule>` and `/** @public */`. Stale suppressions are errors.
Why: Fallow provides richer analysis than knip (unused exports, circular deps, complexity, boundary violations). Grovekeeper uses it successfully.
Rejected: knip (less capable, being replaced across projects).

### Fast local pre-push; comprehensive CI checks

Decided: 2026-05-30 — Revised to target under a minute for local pre-push.
What: Pre-push prepares SvelteKit types, then runs typechecking and Fallow in parallel. Run the same gate manually with `pnpm run check:prepush`. A fresh checkout needs `pnpm run paraglide:compile` before these checks; regenerate translations after catalog changes. Pre-commit remains lint-staged (Oxlint + Prettier). Full ESLint and test suites no longer run on push. Comprehensive static analysis, migration checks, and unit/browser/E2E suites remain CI gates; `pnpm run check:all` and the test scripts remain available for explicit local verification.
Why: Measurements identified uncached ESLint and the test suite as the expensive parts. Typechecking and Fallow together met the local latency target while preserving useful type and dead-code feedback. The target is not a hard timeout or a guarantee on every machine.
Rejected: Keeping full lint/tests in pre-push (slow even in parallel), removing typechecking and Fallow (unnecessary loss of useful feedback), skipping failed checks to meet a timeout (false green).

### Symlink four rules from mpx-claude-code

Decided: 2026-05-30
What: Symlink svelte.md, shadcn-svelte.md, svelte-context.md, sveltekit-paths.md from mpx-claude-code/rules-per-project/ into .claude/rules/.
Why: Consistent Svelte conventions across projects. Rules are maintained centrally.
Rejected: Copy rules (drift risk), no rules (inconsistent conventions).

## Wishlist Page UI

### Three gift view modes: card, list, compact

Decided: 2026-05-30
What: Visitors can switch between Card (image grid), List (thumbnail + horizontal rows), and Compact (dense table — no images). View switcher is a 3-icon toggle group in the toolbar. All views show the same data; layout density changes.
Why: Different use cases — Card for browsing/visual appeal, List for scanning with context, Compact for quick overview of many items. Matches common e-commerce patterns.
Rejected: Single fixed layout (too rigid for diverse wishlists), two views only (compact table adds real value for long lists).

### Gift browse actions: received on surfaces, release in editor

Decided: 2026-08-12 (issue #255; supersedes issue #213's all-surface release UI placement only, not its authorization)
What: Mark received/unreceived is the primary manager action in card, list, and compact browse views. Marking a gift received enables the received filter so its updated action and badge remain visible. Privileged reservation release lives in the gift detail/editor dialog: správci use the edit form, while the app-admin override remains reachable from the read-only detail. Fully reserved gifts omit redundant disabled reservation actions.
Why: Completion must react visibly from refreshed browse state, while reservation status already communicates that a gift is unavailable and privileged release belongs in deliberate gift-detail management rather than routine browsing.

### Gift link always visible

Decided: 2026-05-30
What: Every gift shows a clickable link to the source store (external-link icon + truncated domain, e.g. "↗ alza.cz"). Items without a link show "Bez odkazu" grayed out. Link is visible in all three view modes.
Why: The primary action for visitors is to buy the gift — the link must be immediately accessible without expanding a detail view.
Rejected: Link hidden behind a click/hover (adds friction), full URL display (too noisy, domains are sufficient).

### Owner name prominent in wishlist header

Decided: 2026-05-30
What: The wishlist owner's name is displayed above the wishlist title in a large, primary-colored heading (`text-2xl`, bold). Visitors always see whose wishlist they're viewing.
Why: When a visitor arrives via a shared link, they need immediate context about who this list belongs to. Previously the name was small and easy to miss.
Rejected: Owner name in subtitle only (too subtle), owner name in nav bar (conflicts with logged-in user identity).

### Wishlist header: recipient-first on for-someone lists (variant A)

Decided: 2026-07-08 (extends "Owner name prominent in wishlist header") — **Revised 2026-07-14** by "Header: recipient-first on all lists" below (self lists no longer visually unchanged).
What: On for-someone lists the prominent name slot shows „Pro {recipient}" („Pro" in lighter weight, recipient bold), title unchanged, and the meta row gains „Spravuje {name}" / „Spravují {names}" in small muted text (`text-sm text-white/75`). Self-recipient lists are visually unchanged. OG description becomes „Seznam přání pro {recipient}". Dashboards/dropdowns/cards show the recipient as the person label (e.g. „Pro Rosie" chip).
Why: The prominent slot answers "whose gifts are these?" — for a kid's list that is the recipient, not the manager. Validated with live DOM mockups; the author-first variant buried the key fact in metadata.
Rejected: Author-first header with a small „Seznam pro Rosie" meta label (the current confusion, just annotated).

### Header: recipient-first on all lists, caption dedup, správci always visible

Decided: 2026-07-14 (revises variant A's "self-recipient lists visually unchanged")
What: Every wishlist header — self lists included — shows „Pro: {name}" (colon form, nominative) above the title. The polaroid caption drops the recipient name: event date only („červenec 2026") when set, otherwise no caption. The „Spravuje/Spravují {names}" meta line renders whenever správci exist, on self lists too, and INCLUDES a self-promoted recipient (the trust banner stays as well). OG description keeps the sentence form „Seznam přání pro {name}" on all lists (no colon in prose). Dashboard cards and nav dropdowns unchanged.
Why: One consistent answer to "whose gifts are these"; the caption duplicated `recipientDisplayName` verbatim next to the recipient line; managers should be visible everywhere, not only on for-someone lists.
Rejected: automatic Czech name declension for „Pro {name}" (not reliably possible; the colon form reads fine with nominative); „Pro" chips on self-list dashboard cards (noise on your own page).

### ~~Sort and filter as icon-only dropdown trigger~~ (superseded)

Decided: 2026-05-30 — **Superseded 2026-07-10** by "Toolbar: visible sort select + 'Pouze dostupné' chip" below.
~~What: Sorting and filtering are accessed via a single icon-only button (funnel/sliders icon) in the top-right toolbar. Clicking opens a dropdown with sort options (owner's order, priority, price, name) and filter toggles (available only, with link only).~~
Replaced because: availability filtering is the highest-value visitor action and was buried (#101); the redesign toolbar shows the sort select and the availability chip directly.

## Design — UI Review (2026-05-30)

### App Shell: Top navbar for desktop

Decided: 2026-05-30
What: Desktop layout uses a top horizontal navbar (56px height). Base: variant 1 with dropdown inspiration from variant 2. Sidebar layout reserved for mobile (variant 3 style, future).
Why: Clean, familiar pattern for desktop. Sidebar is better suited for mobile touch targets.
Rejected: Persistent sidebar (variant 4), breadcrumb-based nav (variant 5).
Reference: `designs/app-shell/variant-1.html` (primary), `variant-2.html` (dropdown ref), `variant-3.html` (mobile ref).

### App Shell: Logo with custom icon + dimmed TLD

Decided: 2026-05-30
What: Custom logo icon + "prejemesi" text + dimmed TLD suffix (e.g., ".cz") with visible gap between name and TLD. Both logo and text are links to the home/default page. Domain TBD — prejemesi.cz unavailable, may change name or TLD.
Why: The visual gap between name and suffix is distinctive. Linking both provides easy home navigation.

### App Shell: Nav items as links + dropdown triggers

Decided: 2026-05-30
What: Main navigation items (Moje seznamy, Spravované, Sledované) function as links (click navigates) AND have dropdown menus on hover showing recent items + "Zobrazit vše" link. No "Nový seznam" or "Archivované" in dropdowns.
Why: Dropdowns provide quick access without navigation. Separate "Vytvořit" button handles creation. Archive is a separate concern (TBD).
Rejected: Dropdowns containing "Nový seznam" or "Archivované" (cluttered).

### App Shell: Unified ghost button toolbar items

Decided: 2026-05-30
What: Notification bell and dark mode toggle use ghost button styling. "Vytvořit" uses primary button variant. Icons from Lucide library exclusively.
Why: Consistent visual weight for secondary actions. Primary button draws attention to the main CTA.

### App Shell: Google OAuth shows profile image

Decided: 2026-05-30
What: When user authenticates via Google, their Google profile image is shown as the avatar instead of initials.
Why: Personal, recognizable. Initials fallback for email/password users.

### App Shell: Page title + toolbar merged into single row

Decided: 2026-05-30
What: Each page has a single title row with the page name on the left and toolbar actions (sort, filter, view switcher) as ghost buttons on the right. No separate toolbar below the title — merge them.
Why: Prevents title duplication (nav shows section name, then title repeats it below). Single row is cleaner.
Rejected: Separate title + toolbar rows (duplicates page name).

### App Shell: Sorting via explicit buttons in page toolbar

Decided: 2026-05-30
What: Sorting uses explicit labeled buttons/presets in the page toolbar (top-right, same row as page title). More explicit than icon-only triggers.
Why: Sort is important enough to be visible and labeled, not hidden behind an ambiguous icon.
Rejected: Sort presets in nav dropdown (not discoverable), icon-only sort trigger (not explicit enough).

### Auth Pages: Split screen layout

Decided: 2026-05-30
What: Auth pages (login, register, password reset) use a split-screen layout — branding/illustration on the left, form on the right. Standalone layout, not inside the app shell.
Why: Warm, branded experience that establishes the app identity before the user enters.
Reference: `designs/auth-pages/variant-2.html`.

### Dashboard: Two switchable views (card + list)

Decided: 2026-05-30
What: Dashboard supports two view modes: card grid (variant 3 style) and list rows (variant 2 style). User can switch between them.
Why: Cards for visual browsing, list for quick scanning. Same pattern as wishlist gift views.
Reference: `designs/dashboard/variant-3.html` (cards), `designs/dashboard/variant-2.html` (list).

### Dashboard: Card design — variant 3 style

Decided: 2026-05-30
What: Wishlist cards use variant 3 design: title inside the banner image, theme tag inside card body, hover effect with ring/border + shadow increase + slight lift. No visible border between banner and card body. Creation date prefixed with "Vytvořeno" + last edited date on the same line. Gift count visible. All action buttons use consistent variant and icon style.
Why: Cleaner integration of title with banner. Unified button styling prevents visual confusion.
Rejected: Title below banner (variant 1), inconsistent button variants (some primary, some outline, some with icons, some without).

### Dashboard: Status badges must work on all backgrounds

Decided: 2026-05-30
What: Status badges (Sdíleno, Koncept, Archivováno) must be legible on all banner/background colors. Adapt Grovekeeper badge component pattern.
Why: Current design shows "Sdíleno" badge barely visible on teal banner backgrounds.

### Dashboard: Archived cards dimmed

Decided: 2026-05-30
What: Archived wishlist cards use desaturated/grayish treatment to visually distinguish them from active lists.
Why: Clear visual hierarchy — archived items should recede.

### Dashboard: Progress bar for moderated/followed views

Decided: 2026-05-30
What: Moderated and followed wishlist cards show a reservation progress bar (e.g., "7/12 rezervováno").
Why: Moderators and followers need at-a-glance reservation status. Owners NEVER see this.

### Archive display: Toggle filter per page

Decided: 2026-05-30
What: Each page (Moje seznamy, Spravované, Sledované) has a "Zobrazit archivované" toggle in the toolbar. Off by default. When on, archived cards appear dimmed at the bottom.
Why: Keeps the default view clean. Users with many archived lists aren't cluttered. Simple toggle is discoverable.
Rejected: Always visible dimmed at bottom (clutters view), separate archive tab (unnecessary nav item).

### Unfollowed wishlists: Toggle filter on Sledované

Decided: 2026-05-30
What: The Sledované page has a "Zobrazit opuštěné" toggle. Unfollowed lists appear dimmed with a "Znovu sledovat" button. This was missed during the original grilling.
Why: Users may want to revisit a list they previously unfollowed. Toggle keeps the default view clean while preserving access. Simpler than a separate section.
Rejected: No tracking (user may lose the link), separate "History" section (over-engineered), automatic "Recently visited" (too magical).

### Gift Detail Modal: Center modal 2-column

Decided: 2026-05-30
What: Gift detail uses a centered modal with 2-column layout — image on the left, details + actions on the right. Works on both desktop and mobile (stacks vertically).
Why: Keeps single-page feel, familiar e-commerce pattern, responsive-friendly.
Reference: `designs/gift-detail-modal/variant-1.html`.
Rejected: Right drawer (variant 2), bottom sheet (variant 3), full-width cinematic (variant 4), inline card expand (variant 5).

### Landing Page: Feature showcase layout

Decided: 2026-05-30
What: Landing page uses a feature showcase layout (variant 2) with alternating sections. Story-driven variant (variant 3) kept as secondary reference.
Why: Best balance of product communication and visual appeal.
Reference: `designs/landing-page/variant-2.html` (primary), `variant-3.html` (reference).
Rejected: Hero-centric (variant 1), social proof (variant 4), minimalist (variant 5).

### Sharing Flow: Multi-step wizard

Decided: 2026-05-30
What: Sharing uses a multi-step wizard (variant 2): Step 1 confirm lock → Step 2 choose sharing method → Step 3 success. Final step includes clear text: "Od tohoto momentu můžete seznam pouze prohlížet, přidávat nová přání, přidat moderátora nebo seznam sdílet."
Why: The sharing-locks-editing consequence is important enough to warrant explicit confirmation and clear post-share guidance.
Reference: `designs/sharing-flow/variant-2.html`.
Rejected: Single modal (variant 1), side sheet (variant 3), tabbed card (variant 4), bottom sheet (variant 5).

### Wishlist Page: E-commerce grid (variant 2) as base

Decided: 2026-05-30
What: Wishlist page uses the E-commerce grid layout (variant 2) as the starting point. Uniform card grid, 3-way view toggle (Card/List/Compact), sort/filter button in toolbar. Variant 3's priority-based featured layout (top gift large, then tier 2, then rest) is a candidate 4th view mode for the future.
Why: Simpler to implement, familiar e-commerce pattern, covers the core use cases. Priority layout from variant 3 adds visual interest but can be added later.
Reference: `designs/wishlist-page/variant-2.html` (primary), `variant-3.html` (future 4th view ref).

### Wishlist Page: Owner reorders gifts via drag-and-drop

Decided: 2026-05-30
What: The owner can set the display order of gifts by dragging them. This order is the default "Pořadí vlastníka" sort for visitors. Different from priority — this is manual visual ordering.
Why: Owner knows which gifts matter most to them. Manual ordering gives full control over presentation.

### Wishlist Page: Visitor view is the primary design target

Decided: 2026-05-30
What: The visitor view (seeing gifts, reserving, liking) is the primary design focus. Owner view (editing, reordering) and moderator view (full state) are secondary refinement targets.
Why: Most users of any given wishlist are visitors, not the owner. The visitor experience drives adoption.

### Dark mode toggle: Single cycling button

Decided: 2026-05-30
What: Dark mode toggle is a single ghost-style button that cycles through three states (light → dark → system). Uses a tooltip to show the current mode. NOT three separate icons displayed simultaneously.
Why: Saves horizontal space. Three separate icons are visually noisy for a simple preference toggle.

### General: Light mode is source of truth

Decided: 2026-05-30
What: All design mockups use light mode as the source of truth. Dark mode is auto-generated from design tokens — no need for manual dark variant designs.
Why: Reduces design work by 50%. OKLCH token system produces good dark mode automatically.

## V1 Scope & Routing

### V1: Single release, all features

Decided: 2026-05-30
What: All 16 core features ship in a single V1 release. No MVP/phased rollout within V1.
Why: Features are interconnected (sharing depends on gifts, notifications depend on reservations). Phasing would ship an incomplete product.
Rejected: MVP subset first (would leave holes in the core loop).

### English URL slugs

Decided: 2026-05-30 — **Revised 2026-08-07**: `/home` joins the slug set; logged-in `/` now redirects to `/home` (see "Logged-in home: Přehled overview at /home").
What: Routes use English slugs: `/login`, `/register`, `/reset-password`, `/home`, `/my-lists`, `/moderated`, `/followed`, `/w/<short-id>`, `/settings`. Logged-in users visiting `/` redirect to `/home`.
Why: Cleaner URLs, no encoding issues with Czech diacritics, consistent with tech conventions.
Rejected: Czech slugs (`/prihlaseni`, `/moje-seznamy`).

### Wishlist creation as modal

Decided: 2026-05-30
What: Creating a wishlist opens a modal with minimal fields: title (required), event date (optional), theme (optional, default preset). After creation, redirects to the wishlist page. Description, images, and custom theme are edited on the wishlist page itself.
Why: Fast creation flow — the modal keeps context, and most fields are optional at creation time.
Rejected: Separate page (`/new-list`), multi-step wizard (over-engineered for 1-3 fields).

### Creation modal: recipient choice as top segmented control

Decided: 2026-07-08
What: The create-wishlist modal gains a two-option segmented control at the top, above the title field: „Pro mě" (default) / „Pro někoho jiného". Selecting „Pro někoho jiného" reveals a required, autofocused „Jméno obdarovaného" text input (trimmed, max 100 chars) plus one muted helper line: „Seznam budete spravovat vy a uvidíte rezervace. Volbu nelze později změnit." No title auto-fill from the recipient name; no email/linking fields.
Why: The recipient defines the list's identity, so it is decided first. A segmented control fits a binary, glanceable choice; the „Pro mě" default keeps the common path at zero added friction. The helper line covers the two non-obvious consequences (creator = správce with full visibility; choice immutable).
Rejected: Select/radio group (heavier for two options); recipient field at the bottom (frames the title wrong); title auto-fill „Vánoce pro Rosie" (too magical); email lookup in the modal (claim-token follow-up covers linking).

## Authentication Flow

### Anonymous reservation: inline form in modal

Decided: 2026-05-30
What: When an anonymous visitor tries to reserve a gift, they see an inline form (display name required + email optional) within the reservation modal. Login/register options are also available in the same modal.
Why: Minimizes friction — the visitor is already in the reservation context. Separate auth page breaks flow.
Rejected: Auth page redirect (friction), prompt before viewing (blocks browsing).

### Anonymous → registered: auto-link by email

Decided: 2026-05-30
What: When a user registers with an email that matches anonymous reservations, those reservations are automatically linked to the new account.
Why: Preserves the anonymous user's actions without manual claim flow. Email is the natural linking key.
Rejected: Manual claim flow (too complex for V1), no linking (reservations orphaned).

### Password reset in V1

Decided: 2026-05-30
What: Password reset via email is a V1 feature. BetterAuth handles the flow natively.
Why: Essential if offering email/password auth. Users forget passwords.

## Data & Technical

### Owner-never-sees-reservations enforcement: API + UI

Decided: 2026-05-30
What: Remote functions strip reservation data before returning to the owner (API-level). UI components also conditionally hide reservation elements for the owner role (defense-in-depth). Role is derived from the server session, not from the client.
Why: API is the security boundary. UI is defense-in-depth to prevent accidental leaks via component bugs.
Rejected: DB-level views (unnecessary complexity), UI-only (insecure).

### ~~Client-side theme palette derivation~~ (superseded)

Decided: 2026-05-30 — **Superseded 2026-07-10** by "Single theming system: 10 app palettes" below.
~~What: Server returns theme name + custom color. Presets are predefined CSS variable sets. Custom themes use a JS utility to derive an OKLCH palette from a single input color and set CSS variables on the page wrapper. Live preview during editing.~~
Replaced because: custom single-color themes are removed; the 10 palettes are static primitive sets and all derived tokens are computed in CSS via `color-mix(in oklab, …)`, no JS derivation.

### ~~Server proxy for image uploads (revised from presigned R2 URLs)~~ (superseded)

Decided: 2026-06-01 (revised from 2026-05-30) — **Superseded 2026-07-11** by "Presigned direct R2 uploads + optimized delivery" below (issue #107).
~~What: Client uploads via a same-origin PUT to `/api/upload/[objectKey]`, which proxies to R2. HMAC token (signed `{objectKey, userId, expiresAt}`, derived from AUTH_SECRET) authorizes each upload/delete. Token passed as `X-Upload-Token` header, verified server-side before storage.~~
Replaced because: proxied uploads buffer every image in Worker memory (simultaneous max-size uploads can exhaust it), and R2 presigned browser uploads + CORS are confirmed supported on the free tier. The proxy route survives only as the local-dev/fallback path.

### Presigned direct R2 uploads + optimized image delivery

Decided: 2026-07-11 (issue #107; restores the PRD #1 original direction)
What: `authorizeUpload` validates target/content-type/size server-side, generates the object key, and returns a short-lived (10 min) presigned R2 PUT URL (aws4fetch SigV4, query-signed) that binds method, exact key, Content-Type, and Content-Length — the browser PUTs bytes straight to R2. Bucket CORS (`scripts/r2-cors.json`, applied via `wrangler r2 bucket cors set`) allows PUT from prod + localhost origins only. When R2 S3 credentials are absent (local dev, tests), the same-origin proxy route is used instead. Delivery: `PUBLIC_R2_URL` (client-readable rename of `R2_PUBLIC_URL`) serves originals; card/list/thumbnail/header surfaces load width-bounded `/cdn-cgi/image/` transformations (`format=auto,fit=scale-down`, `anim=false` for GIFs) with automatic client fallback to the original when a transformation fails (free tier: 5,000 unique transformations/month); detail views load originals (GIFs animate). All ImageFrame images are `loading="lazy"` `decoding="async"` except the eager header polaroid. Cleanup: replaced/removed/deleted images (gift, wishlist incl. its gifts, avatar, account deletion) are deleted from R2 server-side inside the owning mutations; cancelled/abandoned pre-save uploads are deleted client-side via an uploader-bound delete token (the arbitrary-key `authorizeDelete` command is removed — it let any logged-in user delete any known object key).
Why: Uploads must not transit or get buffered by the Worker; original multi-MB images dominated wishlist loading; orphaned R2 objects accumulated forever.
Rejected: Keeping the proxy for production (Worker memory ceiling); transforming external gift-image URLs (requires zone-wide any-origin resizing, quota risk); srcset/dpr variant matrices (multiplies unique transformations against the 5k/month free tier — one bounded width per surface suffices); R2 lifecycle rules for cleanup (cannot distinguish referenced from orphaned objects).

### Currencies: CZK, EUR, USD

Decided: 2026-05-30
What: Three supported currencies: CZK (default), EUR, USD. UI is a select dropdown next to the price field.
Why: CZK for Czech audience, EUR/USD for international family. Minimal effort (just a dropdown + stored string).
Rejected: CZK-only (limits international use), more currencies like GBP (unnecessary scope).

### Priority levels: predefined defaults

Decided: 2026-05-30
What: Each wishlist gets predefined priority levels (Vysoká / Střední / Nízká) auto-created on wishlist creation. Owner can rename or add custom levels.
Why: Sensible defaults reduce setup friction. Custom labels allow personalization for power users.
Rejected: No defaults (owner must create from scratch), fixed labels (too rigid).

## UX Patterns

### V1 email set

Decided: 2026-05-30
What: Auth emails via Resend are email verification and password reset. Notification emails cover liked gift reserved by someone else, reserved gift edited by moderator, wishlist archived, owner self-promoted to moderator, and moderator invite.
Why: Covers auth flows + critical notifications + moderator onboarding. No welcome email (low value).
Rejected: Welcome email (unnecessary).

### Loading: skeleton + toast + inline errors

Decided: 2026-05-30
What: Content loading uses skeleton components. Action errors (reserve failed, etc.) use toasts. Form validation uses inline field errors.
Why: Skeleton loading provides perceived performance. Toasts are non-blocking for action feedback. Inline errors are the standard form pattern.
Rejected: Spinners (less polished), full-page error states (too disruptive).

### Mobile: responsive adaptations, no dedicated mobile design

Decided: 2026-05-30
What: V1 uses responsive CSS: hamburger menu with slide-out nav on mobile, stacked card grids, gift detail modal becomes full-screen sheet on small screens. No dedicated mobile sidebar redesign.
Why: Family app — links shared via WhatsApp must work on phones. Responsive adaptations are sufficient; dedicated mobile design is V2 scope.
Rejected: Desktop-only (unacceptable for target audience), dedicated mobile layout (too much scope for V1).

### Auto-follow on first visit

Decided: 2026-05-30
What: Logged-in users automatically become followers of a wishlist on their first visit to `/w/<short-id>`. "Přestat sledovat" option available. The Sledované page shows all followed lists.
Why: Ensures the user can find lists they've interacted with. Explicit follow button adds friction.
Rejected: Explicit follow button (friction), auto-follow on reservation only (misses visitors who only browse).

### Gift creation/editing as modal

Decided: 2026-05-30
What: Adding/editing a gift uses a modal — the same GiftDetailModal component in "edit mode." 2-column layout: image upload left, fields right. Stacks on mobile.
Why: Reuses the detail modal component, consistent pattern, keeps single-page feel.
Rejected: Inline form (noisy), separate page (breaks flow), drawer (less space for image).

### Moderator management via wishlist settings

Decided: 2026-05-30
What: A gear/settings icon on the wishlist page header opens a panel/modal for moderator management: list moderators, generate invite link, revoke access.
Why: Contextual — moderators belong to a specific wishlist. No need for a global moderator page.
Rejected: Global settings page (wrong level), inside sharing flow (conflates two concerns).

### OG meta tags for wishlist pages

Decided: 2026-05-30
What: Public wishlist pages (`/w/<short-id>`) include OpenGraph meta tags (title, owner name, thumbnail). Landing page gets standard meta. Auth/dashboard pages get `noindex`.
Why: Shared links in WhatsApp/Messenger show rich preview cards — critical for a sharing-driven app.
Rejected: No OG tags (missed opportunity for viral sharing).

### Storybook: Grovekeeper pattern with play functions

Decided: 2026-05-30
What: Components use `addon-svelte-csf` with `defineMeta`, play functions for interaction tests, autodocs, and "All Variants" grid stories. `tailwind-variants` (`tv()`) for all new derived and block components. Stories for every component with significant complexity.
Why: Proven pattern from Grovekeeper. Play functions provide interaction testing without separate test files.
Rejected: CSF3 JS format (less ergonomic for Svelte), no play functions (misses testing opportunity).

### app.css as canonical design token source

Decided: 2026-05-30
What: `src/app.css` is the single source of truth for design tokens. Missing tokens from `designs/tokens.css` (typography scale, motion, z-index, shadows) must be migrated in. `designs/tokens.css` remains as design reference only.
Why: Tokens must be in the Tailwind pipeline to be usable. Two sources of truth causes drift.
Rejected: Importing designs/tokens.css directly (not wired to Tailwind @theme), keeping both in sync manually (drift risk).

### createContext API for all new code

Decided: 2026-05-30
What: All new module contexts use the `createContext` API (Svelte 5.40+). The old `getContext`/`setContext` pattern in the showcase is legacy and will not be replicated.
Why: `createContext` provides type-safe, key-free context with better DX. Consistent with project rules.
Rejected: Old getContext/setContext (manual key management, type-unsafe).

## Component Library

### Base components carried over from Grovekeeper

Decided: 2026-05-31
What: Upgrade base component library using Grovekeeper's mature implementations. Carry over GK versions for Button, Badge, Card, Input, Textarea, Alert, Tooltip. Keep Přejeme si versions for Dialog, Select, DropdownMenu, Sheet, Switch, Checkbox, Separator, Skeleton. Merge Label (GK typography + Přejeme si flex layout). Add 14 new components from GK: HelpText, SearchField, Toggle, ToggleGroup, Tabs, Accordion, Collapsible, Popover, Kbd, InputGroup, Progress, RadioGroup, Toast, Calendar/RangeCalendar.
Why: Grovekeeper has production-tested components with better variant systems, testing, and stories. Standardizing across projects reduces maintenance.
Rejected: Keeping Přejeme si's simpler components (missing error states, no variant files, fewer stories).

### Component naming: intent/tone instead of variant

Decided: 2026-05-31
What: Button uses `intent` prop (primary, secondary, ghost, ghost-overlay, danger, primary-destructive, outline, link). Badge and Alert use `tone` prop. Input/Textarea/Card use `state` prop.
Why: Semantic naming — `intent` describes what the button means to do, `tone` describes informational quality, `state` describes component condition. Avoids "everything is variant" ambiguity.
Rejected: Universal `variant` prop (ambiguous, conflicts between components).

### Separate \*-variants.ts files for tv() definitions

Decided: 2026-05-31
What: Components with `tv()` definitions extract them into a `*-variants.ts` file. Types and constants derived from the tv() config. Components without tv() variants (Dialog, Sheet, Select) don't need a variants file.
Why: Single source of truth for styling. Types stay in sync with variants. Index.ts re-exports from variants file, not from `<script module>`.
Rejected: Inline `<script module>` exports (couples types to component, harder to reuse).

### Design tokens: merge GK tokens into Přejeme si

Decided: 2026-05-31
What: Add GK surface/text/border tokens as aliases or new values: `--surface` (→ background), `--surface-2` (→ secondary), `--surface-3` (→ muted), `--surface-hover`, `--foreground-subtle`, `--border-strong`, `--primary-soft`. Keep all existing Přejeme si tokens. Keep `.light`/`.dark` class selector (not GK's `[data-theme]`). Keep Přejeme si fonts and spacing base.
Why: GK components reference these tokens. Aliases avoid duplicating values while maintaining compatibility with both naming conventions.
Rejected: Full GK token system replacement (would break existing Přejeme si code), translating every GK class to Přejeme si tokens (too much manual work, loses GK consistency).

### PascalCase component file naming

Decided: 2026-05-31
What: Folders lowercase (`button/`). Main component PascalCase (`Button.svelte`). Sub-components lowercase-prefixed (`dialog-content.svelte`). Variants lowercase (`button-variants.ts`). Stories PascalCase (`Button.stories.svelte`).
Why: Matches Grovekeeper convention. PascalCase for components is the Svelte community standard.
Rejected: All lowercase (harder to distinguish component files from sub-components).

### No native select — custom-only

Decided: 2026-05-31
What: The Select component uses only the custom bits-ui implementation. No native `<select>` fallback.
Why: Consistent styling and behavior. Native select cannot be styled to match the design system.
Rejected: GK's dual native + custom approach (unnecessary complexity, native select looks out of place).

### Select and DropdownMenu: merge best of both projects

Decided: 2026-05-31
What: Keep Přejeme si's styling and UX features (scroll buttons, size prop, bold focus, cursor-default, dark mode destructive). Add GK's structural improvements (state prop on Select trigger, SubContent defaults on DropdownMenu, destructive shortcut coloring). Create comprehensive stories with play tests from GK.
Why: Přejeme si's UX decisions (bold focus, OS-convention cursor) are better. GK's structural completeness (error states, proper defaults, testing) fills gaps.
Rejected: Taking either project's version wholesale (both have genuine strengths the other lacks).

## Import, Bulk Entry & Enrichment

### CSV / Google Sheets import via 3-step wizard

Decided: 2026-06-03
What: Import builds gifts through a shared wizard — Source (upload .csv/.tsv · paste cells · paste Google Sheets link) → Review (editable draft grid with smart column detection + manual role override, auto-skipped preamble/footer rows, per-row select/deselect, "možný duplikát" badges matched by normalized name OR link host+path) → Confirm. Two entry points reuse it: create-new-wishlist (title pre-filled from filename, editable) and append-to-existing. Parsing via PapaParse.
Why: One robust core covers clean exports (near-zero effort) and messy sheets (manual grid fixes). Family lists are small; a wizard makes the suggested gifts reviewable and dedupable before commit.
Rejected: Manual-only column mapping (tedious for clean files); a single cramped modal; a bespoke parser for one messy sheet's section-headers / alternate-link rows (the editable grid covers it).

### Import input methods; no Google OAuth

Decided: 2026-06-03
What: File upload (.csv/.tsv), paste-cells (textarea with HTML-table-aware paste + TSV/CSV fallback — copying a range from Excel/Sheets pastes as parseable TSV), and paste a Google Sheets share/published link (server converts to `export?format=csv` and fetches server-side; a private sheet or a Google Docs link yields a friendly error). Limits: 200 rows, 1 MB.
Why: Covers already-exported files + the lowest-friction "direct from Sheets". Server-side fetch avoids CORS; OAuth + Drive Picker is disproportionate for a family app and paste-cells already handles private sheets with zero auth.
Rejected: OAuth + Drive Picker (heavy: GCP app, consent-screen verification, API keys); Google Docs (non-tabular).

### Taken/"Vybráno" column and cell color ignored on import

Decided: 2026-06-03
What: Import creates gifts only. Any reservation/"taken" column is ignored; the owner instead deselects unwanted rows in the wizard. Cell background color (file #3's "taken" signal) is dropped by CSV export and is not supported.
Why: Preserves owner-never-sees-reservations and yields a clean list for re-claiming in-app. CSV cannot carry color.
Rejected: Importing taken rows as anonymous reservations (revisit only if mid-gifting migration is requested); mark-received (wrong semantics — "taken by a gifter" ≠ "owner received it").

### Multiple links per gift

Decided: 2026-06-03
What: Replace `gift.url` with `gift.links: { url, label? }[]` (jsonb), max 10 per gift. `links[0]` is primary (drives the domain chip, OG tags, "Bez odkazu"). Label optional, defaults to the domain. Reservations and likes remain per-gift.
Why: Real wishlists offer alternatives ("nebo tohle"). jsonb matches the existing imageMeta/imageSlots pattern and avoids a join on every gift fetch. App is in development → no back-compat shim.
Rejected: Separate `giftLink` table (join per fetch, heavier); keeping a single `url` (too limiting).

### Gift card: piece count beside title (role-conditional), links stacked at bottom

Decided: 2026-06-03
What: Piece count moves next to the title in a larger, muted style ("3 kusy"). The reserved portion is appended only for visitor/moderator ("3 kusy · 1 rezervováno"); the owner sees the piece count alone. Multiple links render stacked at the card bottom. Replaces the corner "x3" badge. Czech pluralization (kus/kusy/kusů) via Paraglide.
Why: Clearer than a badge, scales to multi-link, and keeps the owner-surprise invariant intact.
Rejected: The "x3" corner badge (cramped, doesn't scale to multi-link); showing the reserved count to the owner (breaks the core invariant).

### Metadata enrichment: per-item, progressive, offloaded

Decided: 2026-06-03
What: Gift drafts (and the single-gift modal) get a ✨ enrich action that fills image/price/title from a link. Each enrich is its OWN remote request, fired throttled from the browser, so each gets a fresh Cloudflare budget (free tier: 50 subrequests + 10 ms CPU per request — HTML parsing must NOT run in-Worker). Provider: a metadata API (Microlink free 50/day, callable client-side) behind an `enrichLink()` abstraction, with a DIY OG/JSON-LD fallback for plain sites. Available in the import grid, batch-add dialog, and single-gift modal.
Why: Progressive "cards fill in one by one" UX; stays in the free tier; offloads JS-rendering, bot-bypass, and parsing. (Reliability caveat: Alza actively blocks bots and Heureka links are aggregator pages, so quality varies; the provider's free daily quota — not Cloudflare — is the real ceiling.)
Rejected: Batch-scraping N pages in one Worker request (blows the 10 ms CPU limit); parsing HTML in-Worker; MCP servers (they run in the dev/agent environment, never in the production Worker serving end-users).

### Name-based enrichment deferred; blank names stay blank

Decided: 2026-06-03
What: Enriching link-less items by searching Alza/Heureka by name is a later, best-effort phase that presents candidate matches for the user to confirm — never silent auto-fill. Import rows with no name stay blank; their links are rendered clickable in the grid so the user opens them and types the name manually.
Why: No official product API + active bot protection make name→product matching unreliable and ambiguous.
Rejected: Silent name→product auto-fill; auto-filling the name from the URL domain (user rejected — prefers blank + clickable link).

### Bulk gift entry via large dialog

Decided: 2026-06-03
What: A standalone "batch add gifts" action opens a large dialog hosting the same editable draft grid as the import Review step (starting empty, manual rows) plus enrichment.
Why: The single-gift modal is too cramped for an N-row grid; reuse the import grid primitive.
Rejected: A dedicated full-width route (user prefers a dialog); extending the single-gift modal.

### Delivery phasing

Decided: 2026-06-03
What: Phase 1 — import core (parse → editable draft grid → dedup → commit; no enrichment). Phase 1b — multiple-links data model + card/modal display, plus the **manual-only batch-add dialog shell** (empty grid → `importGifts`; the draft-grid primitive already exists, so manual batch entry ships now). Phase 2 — enrichment (import grid, the batch-add dialog's ✨ action, single-gift modal). Phase 3 — name-based search (optional).
Why: Ship the robust headline import first; keep enrichment's external-quota and scraping-reliability risk off the critical path.
Rejected: Enrichment inside V1 proper (couples a robust import to fragile scraping).

## Image Fitting & Cropping

### Single shared ImageFrame renderer for all image presentation

Decided: 2026-06-02
What: One `ImageFrame` component handles all fixed-size image boxes across gifts, wishlist cards, and avatars. It accepts a fit mode and focal-point crop and applies them consistently.
Why: Avoids divergent crop/fit behavior across surfaces; one place to update rendering logic.
Rejected: Parallel per-surface image components (drift risk, duplicated crop logic).

### Focal point + zoom as canonical crop representation; cropRect persisted for editor restore only

Decided: 2026-06-02
What: The persisted crop value for any image slot is `{ x, y, zoom }` (focal point in percent + zoom ≥ 1). A normalized `cropRect` (0–1) is also persisted alongside it, but solely so the crop editor can restore the exact region the user drew. Only focal point + zoom is used for rendering.
Why: Focal point + zoom is resolution- and aspect-ratio-independent — it produces correct framing regardless of which slot ratio is being rendered. A raw cropRect breaks when rendered at a different aspect ratio.
Rejected: Persisting cropRect only (breaks rendering at different slot aspect ratios).

### ~~One-crop-all-slots for gifts; independent per-slot crops for wishlists~~ (superseded)

Decided: 2026-06-02 — **Superseded 2026-07-12** by "WYSIWYG per-target crops" below (issue #116, D2).
~~What: A gift's `image_meta` stores a single crop (focal point + zoom) applied to all display surfaces. Wishlists use `image_slots` with independent crop metadata per named slot (`card`, `thumbnail`, `banner`, `social`).~~
Replaced because: one crop across surfaces with very different aspects (card ~2.78:1 vs detail ~0.5) silently discarded parts of the drawn region (#116 F7); gifts now group consumers into per-target crops by aspect family.

### WYSIWYG per-target crops; exact focal derivation; banner slot retired (issue #116)

Decided: 2026-07-12
What: Manual crops are drawn PER TARGET on a stage whose window is locked to the target's real aspect ratio (single source: `crop_targets.ts`). Gift targets by aspect family: `card` (~2.78:1), `detail` (~0.5), `square` (list + reservation, 1:1), persisted as an additive `image_meta.targets` extension — only user-edited targets persist; everything else keeps automatic center cover-fit framing. Wishlist editor slots: `card` (~2.84:1), `thumbnail` (1:1), `social` (1.91:1); the orphan `banner` slot is removed from the editor (JSON retained). The header polaroid photo is exactly square and consumes the `thumbnail` slot; `card` is single-consumer (dashboard banner). Conversions are exact renderer inverses (`focal = origin/(1 − size)`, zoom binds the larger normalized side), so an aspect-matched rect round-trips losslessly — no crop can be silently discarded. Legacy focal/zoom rows render unchanged until re-edited.
Why: The pre-#116 editor was blind to target shapes (stage used the source-image ratio) and the center-based focal derivation misplaced off-center crops; per-target aspect-locked rects make WYSIWYG true by construction.
Rejected: One-crop-all-slots for gifts (F7 silent discard), aspect-locked rect over a full-image stage (stage shape would still not match the target), destructive `image_meta` migration (prod data must keep rendering unchanged).

### Three-mode editor model (Fill / Whole picture / Manual); legacy `auto` preserved until touched (#116 follow-up)

Decided: 2026-07-13
What: The gift and wishlist image editors offer exactly three display modes mapped by `editor_modes.ts`: Fill (`cover-crop`, automatic centered framing), Whole picture (`contain-padded`, entire image letterboxed on both axes), Manual (`cover-crop` plus drawn per-target/per-slot crops). The persisted fitMode enum is unchanged; `auto` is no longer selectable and a persisted `auto` row keeps its value verbatim until the user touches the mode or replaces the image. Per-target manual crops render only on a `cover-crop` base (Whole picture wins over stale targets) and leaving Manual drops manual crops on save. Preview tiles are buttons that jump to Manual with that target/slot active; a wheel gesture over a plain preview also promotes to Manual. The gift modal footer (create + edit share one `GiftDetailForm`) is pinned outside the scroll region (GiftDraftDialog pattern), and the preview strip sits below quantity/priority.
Why: `cover-crop` double-dutied as both the Fill rendering and the "manual editor open" flag; `contain-padded` was effectively unreachable (gated behind the auto heuristic's 2× divergence threshold, so gift cards cropped image height); zoom was dead UI outside crop mode.
Rejected: Renaming persisted fitMode values (pointless data migration); letterboxed manual crops (manual is cover geometry by definition — superseded by the round-2 zoom-out decision below); rewriting legacy `auto` rows on save (silent rendering changes on untouched forms).

### Manual zoom-out to the contain limit; floating gift previews; merged square tile (#116 round 2)

Decided: 2026-07-13
What: Manual crops can zoom out below 100 % down to the target's contain zoom: the crop window may extend past the image on ONE axis (invariant `min(w, h) ≤ 1` — never letterboxed on both axes), `focal = origin / (1 − size)` extends unchanged to oversized axes, and the persisted zoom floor drops to `IMAGE_ZOOM_OUT_MIN` (0.05, additive schema relaxation). Rendering zoom < 1 positions the image explicitly (`coverWindowLayout`) because CSS `object-fit: cover` clips to the element box, so `scale(z < 1)` would shrink the crop with fill on both axes instead of revealing more image. Gift form field order is Name → Description → Links → Price/Currency → Quantity → Priority → Image bundle; the preview strip is replaced by two floating tiles (card + ONE merged square tile for list + reservation, which share the `square` target) at the bottom of the image column — overlaying the plain preview, below the stage in Manual. The stage seeds an unframed (identity) rect as centered cover; non-identity rects snap extent-preservingly, so a wider-than-image extent restores as a zoomed-out letterbox instead of being cropped.
Why: Whole picture is all-or-nothing; users want to trim a bit while still seeing the entire subject (white space on one axis). The four-tile strip duplicated the square framing twice, claimed form space, and the detail tile duplicated the big left preview.
Rejected: CSS-only zoom-out via `transform: scale(z < 1)` (object-fit clipping makes it shrink-with-margins, not reveal); zoom-out below the contain zoom (white space on both axes is never a sensible framing); a separate reservation tile (same crop target as list).

### Tiles are the only crop-target switcher; mode toggle in the image column; „Whole picture" renamed „Fit" (#116 round 3)

Decided: 2026-07-13
What: The gift editor's per-target radio picker („Výřez pro") is removed — the floating preview tiles are the sole crop-target switcher, so a really narrow same-height detail tile (1:2, half the square tile's width) joins card + square as a switcher-first tile (the big left preview already previews the detail framing). The three-mode ToggleGroup moves from the form column into the image column, above the preview/stage it drives, leaving the form's image field as source input only. The second mode is renamed: en „Whole picture" → „Fit", cs „Celý obrázek" → „Přizpůsobit"; the internal editor-mode id is `fit` (message key `image_fit_fit`). Persisted fitMode values are untouched.
Why: Two parallel switchers (radios + clickable tiles) for the same thing confused the model; the mode control belongs next to the preview it affects; without a detail tile one of three targets was unreachable by tile click.
Rejected: Keeping the radio picker alongside clickable tiles (duplicated control); a full-size detail tile (duplicates the big left preview — the narrow tile is deliberately a switcher, not a spacious preview); renaming the persisted `contain-padded` fitMode (pointless migration).

### Separated token responsibilities: bg-theme / wishlist tokens / frame-fill

Decided: 2026-06-02
What: Three distinct token layers — `data-bg-theme` attribute controls app-shell background tint; `--wishlist-*` tokens express wishlist color identity on the wishlist page; `--frame-fill` controls the background behind letterboxed images. Each is set and scoped independently.
Why: Each concern is independently themeable and must not leak into the others (e.g., wishlist accent color must not affect the app shell).
Rejected: Shared token namespace (cross-contamination between app shell and wishlist themes).

### ~~App background theme applied server-side via data-bg-theme on <html>~~ (superseded)

Decided: 2026-06-02 — **Superseded 2026-07-10** by "Single theming system: 10 app palettes" + "Palette persistence" below.
~~What: The user's `app_background_theme` preference (`default` / `golden-hour` / `twilight`) is read in `hooks.server.ts` and written as a `data-bg-theme` attribute on `<html>` before the first byte is sent.~~
Replaced because: the background-theme axis is removed; the server-side-attribute pattern itself is retained and reused for `data-palette`.

### Native <input type=range> instead of bits-ui Slider for crop zoom control

Decided: 2026-06-02
What: The zoom slider in the crop editor uses a plain `<input type="range">` styled with Tailwind, not the bits-ui `Slider` component.
Why: bits-ui Slider threw a runtime error on single-value usage — its internal `ticksPropsArr` reads `value` as an array, which crashes when a scalar is passed. Native range input has no such issue and is sufficient for a single continuous value.
Rejected: bits-ui Slider (runtime crash on scalar value), patching bits-ui (not worth the maintenance overhead for this use case).

### Accepted a11y exception: gift crop canvas is pointer-only (WCAG 2.1.1)

Decided: 2026-06-03
What: `GiftImageCropCanvas` exposes a focusable `role="button"` crop region driven only by pointer events, with resize handles nested inside it. Keyboard move/resize and resolving the nested-interactive structure are deliberately NOT implemented. Issue #50, which scoped this work, was closed NOT_PLANNED.
Why: Keyboard crop operation was deprioritized for v1; the gap was reviewed and consciously accepted rather than silently shipped. Documented here and inline in the component so it is not mistaken for an oversight.
Rejected: Implementing keyboard nudge/resize now (deferred); silently leaving it undocumented (would read as a bug).
Revisit: If the crop editor becomes a primary owner workflow or an accessibility audit requires AA, reopen #50 and implement keyboard operation + fix the nested-interactive handles.

### Gift crop family: 4:3, WYSIWYG Fill/Fit previews, wider modals, natural detail photo (issue #183)

Decided: 2026-07-18
What: The gift `square` crop target's aspect changes from 1:1 to 4:3 (width:height) — it remains the ONLY editor crop target (no per-target switcher returns). The gift-card grid image area, the list-view thumbnail, and the editor's crop/preview stage all render at 4:3; the reservation-modal thumbnail keeps its small fixed square icon (an approximate, non-WYSIWYG consumer of the same persisted focal+zoom). Existing manual crops carry over automatically with no data migration: focal+zoom is resolution/aspect-independent (see above), so the SAME persisted values reproject onto the wider 4:3 window purely by changing the consuming surfaces' CSS aspect ratio. The editor's Fill/Fit previews are now a static, non-interactive rendering of the SAME Manual crop stage component (bordered 4:3 window, dimmed overhang outside it, no thirds grid, no label chip) instead of a plain unbounded `ImageFrame` preview, so they show exactly what the card/list actually render; a wheel gesture still promotes to Manual. The Manual stage's label/pixel chip is removed entirely (white border + thirds grid unchanged). The gift edit modal and the visitor gift detail modal both widen to ~1100px (edit: ~50/50 image/form column split, up from 45/55); the visitor detail modal drops out of the crop-target system entirely and shows the full photo at its natural aspect ratio inside a raised height cap (tall photos display tall, wide photos display wide).
Why: Square gift cards read as too tall for typical product photography; the Fill/Fit previews rendered in an arbitrary tall column matching no real surface, so users couldn't judge the actual framing before saving; the visitor detail view cropping a photo the recipient/gifter might want to see in full was needless information loss.
Rejected: Reintroducing a per-target aspect switcher (round 3 already settled on tiles-only, single-target editing); migrating persisted crop data to a new shape or key (focal+zoom already reprojects losslessly, and the `square` key must stay stable — renaming it would need a data migration issue #183 explicitly avoids); keeping the visitor detail view as a crop consumer (defeats the point of showing "the whole picture"); building a parallel preview component for Fill/Fit instead of reusing the Manual stage (would drift visually from Manual and duplicate the WYSIWYG windowing math).
Superseded (partial, issue #189): "remains the ONLY editor crop target (no per-target switcher returns)" is reversed — a second 1:1 `thumb` target and a two-tile switcher return (see next entry); the interim 4:3 list thumbnail becomes 1:1. Everything else here still holds (the `square` key stays a 4:3 misnomer, focal+zoom reprojects losslessly, the visitor detail stays out of the crop system).

### Gift two-target crop family + adaptive full-photo crop stage (issue #189, follow-up to #183)

Decided: 2026-07-18
What: The gift editor offers TWO crop targets, both consumed WYSIWYG: `square` (kept 4:3 misnomer key) for the grid card, and a NEW `thumb` key (true 1:1) for the wishlist list-view thumbnail and the reservation thumb. The editor shows two preview tiles — „Karta" (4:3 = `square`) and „Seznam a rezervace" (1:1 = `thumb`) — which are the ONLY crop-target switcher; clicking a tile jumps to Ručně with that target active. The list thumbnail reverts from the interim 4:3 to 1:1, and the reservation thumb (previously an approximate square consumer of the 4:3 focal+zoom) becomes an EXACT 1:1 consumer. Carry-over needs no migration: `thumb` reads `targets.thumb ?? targets.square` and reprojects the same persisted focal+zoom into the 1:1 window at render time (pre-#183 manual crops were drawn 1:1, so they render verbatim). The crop stage's sizing model is INVERTED: instead of a fixed-viewport window that scales the photo to fill it (and clips a tall portrait even at default zoom), the whole photo renders contained and ALWAYS fully visible — the stage adapts to the photo's natural aspect within min/max caps — with the active target's window overlaid on the photo (overhang dimmed, never clipped; Ručně zoom-in ≤300 % shrinks the window / tightens the crop). Fit letterboxes the whole photo inside a centered target-aspect window. The mode section gets an intentional photo-workshop sticker-panel treatment (no thin grey seam border). Link-editor rows adopt the accepted mockup styling with a visible „Viditelný popisek" label and drop the „Hlavní" badge (first link is primary by order). List-view rows align flush with the toolbar/hero edges.
Why: 4:3 does not fit list rows or the mobile list view — 1:1 is the right shape there — so a second target had to return; the fixed-viewport stage clipped tall portraits even at default zoom, so a WYSIWYG editor could not show the whole photo; the de-seamed full-bleed mat read as an unfinished wireframe.
Rejected: Renaming the `square` key to reflect its 4:3 shape (still needs a data migration, still rejected); migrating persisted crops for the new `thumb` target (render-time reprojection is lossless — no data change); keeping the reservation thumb as an approximate square consumer (now an exact 1:1 consumer); keeping the fixed-viewport stage-fills-photo sizing (clips portraits — the whole point being fixed); a secondary indication of the inactive target in the stage window (the tiles carry that — the window shows the active target only).
Revisit: If a third consumer aspect appears, extend `GIFT_CROP_TARGET_SPECS` + `GIFT_EDITOR_CROP_TARGETS` and add a tile; the two-tile switcher and adaptive stage generalize to N targets.

### Legacy `auto` fitMode: presented editor mode normalized to match the real render (issue #183 follow-up)

Decided: 2026-07-18
What: A gift row persisted with the legacy `fitMode: 'auto'` (every seeded gift) resolves to cover or contain PER IMAGE at real render time (`resolveAutoFit`, comparing the image's natural ratio against the target box ratio), while the editor's mode toggle reads every legacy `auto` row as Fill (`giftEditorModeFromMeta`) regardless of how it actually renders. Once the editor measures the image's natural ratio client-side, an untouched legacy `auto` row that would actually render letterboxed now PRESENTS (toggle selection + WYSIWYG preview) as Fit instead of Fill — without marking the form dirty or rewriting the persisted `auto` value: an untouched save still writes `auto` verbatim, exactly as before.
Why: The new WYSIWYG Fill/Fit previews (see above) must never contradict the real card render, or the honesty they were built for is undermined for every legacy row. Normalizing the PRESENTED mode (not the persisted data) on measurement keeps the toggle honest while preserving the existing "no silent metadata rewrite on an untouched form" invariant.
Rejected: Making the bordered preview literally re-derive `auto` at its own box ratio via a second code path (would duplicate `resolveAutoFit`'s resolution logic inside the new static stage instead of reusing one normalized mode value); silently rewriting the persisted `auto` fitMode to `contain-padded` on modal open (violates "no silent metadata rewrite," and would touch production rows nobody asked to change).

## Redesign 2026 — Anime Sky

### Visual base: anime-sky-final mockup

Decided: 2026-07-10
What: The whole app redesign is based on `designs/redesign-2026/anime-sky-final.html` — ink borders, hard offset "sticker" shadows, notebook motifs, DynaPuff display + Geist body, playful rotations, spring-lift hovers. Pre-redesign mockup references (designs/app-shell, dashboard, landing-page, …) remain valid for layout/structure; their visual style is superseded.
Why: Chosen from the redesign-2026 anime variants after iteration (banner padding, mint-style cards, dimmed reserved gifts, retuned hue-saturated dark mode).
Rejected: Other redesign-2026 variants (anime-mint, original anime-sky, brutalism, terracotta, modern, …).

### Single theming system: 10 app palettes

Decided: 2026-07-10 (supersedes per-wishlist theme presets + custom, `data-accent` accents, `data-bg-theme` backgrounds)
What: One palette system with 10 curated palettes — Obloha (sky, default), Máta, Broskev, Hrozen, Sakura, Oceán, Med, Malina, Matcha, Tužka. Each defines 4–6 primitives (`--p-brand`, `--p-deep`, `--p-ink`, `--p-bright`, `--p-accent`, `--p-on-accent`); ALL other tokens derive via `color-mix(in oklab, …)`. shadcn semantic token names are kept; only their values are re-derived. Dark mode derives from the same primitives (light mode stays source of truth). The owner picks one palette per wishlist (replaces Christmas/Birthday/… presets and the custom picker); the viewer's own palette themes every other surface. The 12-accent `data-accent` axis and 3-theme `data-bg-theme` axis are removed.
Why: Three parallel theming systems would have become four; one primitive-driven system covers user preference, wishlist identity, and dark mode with a single derivation.
Rejected: Palettes for chrome only (two coexisting systems); viewer palette everywhere (loses festive per-wishlist identity); keeping a custom picker (can return later by deriving primitives from one color).

### Palette persistence: user column + cookie + SSR attribute

Decided: 2026-07-10
What: Logged-in users persist the palette on the user row (like `preferred_locale`); a cookie mirror lets `hooks.server.ts` set `data-palette` on `<html>` before first byte (the pattern `data-bg-theme` used). Anonymous users: cookie only.
Why: Zero flash-of-wrong-palette, cross-device persistence for logged-in users, proven pattern.
Rejected: localStorage only (no SSR, no cross-device); DB only (flash on every load).

### Fonts: DynaPuff display + Geist body

Decided: 2026-07-10
What: Replace Figtree/Noto Sans with DynaPuff (headings) + Geist (body), self-hosted via fontsource with latin-ext subsets and metric-adjusted fallbacks (existing pattern). Czech diacritic coverage (ěščřžůď…) must be verified before committing to DynaPuff.
Why: The fonts carry the anime identity.
Rejected: DynaPuff-only with Figtree body (mixed identity); keeping current fonts (loses the character).

### Motion system: tokens + gated reveals

Decided: 2026-07-10
What: Motion tokens — ~200 ms standard, 300 ms transform ease, spring `cubic-bezier(.34,1.56,.64,1)` for lifts; raise the current 75 ms global default transition duration. Hover lifts/wiggles on cards and buttons, staggered fadeUp reveals on page headers/hero, all inside `@media (prefers-reduced-motion: no-preference)`. Svelte transitions only where bits-ui built-ins don't cover.
Why: The app has almost no motion today; the mockup's character depends on it.
Rejected: Micro-interactions only (loses the reveal charm); full-on FLIP/page transitions (perf risk on long lists).

### Motion continuity: travel requires a visible same-identity move

Decided: 2026-08-28
What: Coordinate capture includes only attached, rendered, non-zero elements present before and after. Filter-only insertion/removal appears or disappears at final coordinates with at most opacity. Continuously visible displaced siblings may FLIP. Cross-section flight is reserved for the same gift visibly moving between visible source and destination sections.
Why: Treating hidden or zero-size coordinates as origins made newly revealed filter results fly from screen edges and falsely implied movement.
Rejected: FLIP/translation for every keyed result regardless of visibility; off-screen or `0,0` travel for inserts/removals; disabling all sibling layout easing.

### Wishlist header: notebook page + taped polaroid + sticky countdown

Decided: 2026-07-10
What: The header becomes the spiral-notebook panel. The wishlist image (image-slots crop feature) appears as a taped polaroid photo on the notebook. The event countdown is a taped sticky note on desktop; below ~960 px it collapses into a chip in the meta row next to the absolute-date chip; hidden when no event date; "proběhlo" once passed (owner archive prompt takes over).
Why: Keeps the image upload/crop feature while adopting the notebook identity.
Rejected: Full-bleed banner stacked above the notebook (two heroes); dropping the header image (dead crop UI).

### Share UI: status chip + single button

Decided: 2026-07-10
What: A status chip (Koncept/Sdílený/Archivováno) in the header meta row + one "Sdílet" action button opening the share wizard (post-share it opens at the copy-link step). The full-width shared/draft strips are removed.
Why: Three overlapping share indicators collapse into two compact ones.
Rejected: Keeping restyled strips (heavy header); hiding share behind an overflow menu post-share.

### Reservation-visibility notices: subtle reassurance, loud warning

Decided: 2026-07-10
What: Two messages, one Alert-based component with tones — moderator reassurance ("you see reservations; the owner never will") is a calm tinted disclosure; the visitor trust warning (owner self-promoted to moderator) is an accent banner (bold, warning tone, NO tape — see round-2 deltas). The bespoke purple strip in WishlistHeader is removed.
Why: The trust warning is the one visitors must not miss; the reassurance is ambient.
Rejected: Both subtle (warning missable); both loud (shouty for moderators on every visit).

### ~~Reserver name visible to visitors and moderators~~ (superseded)

Decided: 2026-07-10 — **Superseded 2026-07-19 by issue #198**.
~~What: Gift cards/detail show who reserved ("rezervovala Babička") to all non-owner viewers. The owner continues to see nothing (core invariant, API-stripped). Requires exposing the reserver display name in gift queries for non-owner roles.~~
Why: Helps family coordination ("grandma has it covered"); lists are shared among trusted people.
Rejected: Moderators-only (loses the gifter-view value); keeping the anonymous "Reserved" badge.
Replaced because: reserver identity is personal data; any link holder could read authenticated users' real account names.

### Reserver names are moderator-only (issue #198)

Decided: 2026-07-19 (supersedes "Reserver name visible to visitors and moderators")
What: Visitors see only the anonymous reserved state ("Rezervováno" + counts, own-reservation UX untouched); reserver display names are emitted solely to správci (`canSeeReserverNames` = moderator-only). `GIFT_RESERVED`/`LIKED_GIFT_RESERVED` notifications no longer carry the actor's name. Recipient invariant unchanged.
Why: Reserver identity is personal data — the old rule exposed authenticated users' real account names to anyone holding the link. Gifter coordination does not require public names; správci retain full visibility.
Rejected: Names for all non-recipients (superseded decision — privacy leak); per-viewer pseudonyms (complexity without clear value); purging historical notification actorName rows in the same change (separate data-migration decision).

### ~~Toolbar: visible sort select + "Pouze dostupné" chip~~ (superseded)

Decided: 2026-07-10 (supersedes "Sort and filter as icon-only dropdown trigger") — **Superseded 2026-07-15 by issue #161**.
~~What: The sort select is visible in the wishlist toolbar; "Pouze dostupné" is a toggle chip (#101); the rare "s odkazem" filter moves to a small overflow menu. The toolbar flex-wraps on narrow screens.~~
Why: Availability filtering is the highest-value visitor action; burying it defeated it.
Rejected: Icon-only dropdown (buried filters); three visible chips (toolbar overflow).
Replaced because: unified filtering needs a shared interaction across wishlists and dashboards.

### Toolbar: one filter dropdown with active pills (issue #161)

Decided: 2026-07-15
What: One shared derived filter dropdown holds filter toggles. Active filters render as removable pills that fill the desktop gap after the toolbar; below 640 px pills are hidden and the trigger exposes an active count plus menu clear action. Role/auth filter gates and existing filtering semantics remain unchanged.
Why: Keeps controls compact while retaining visible active state, one-shot clear, and accessible mobile context.
Rejected: Per-page filter implementations; permanently visible filter chips.

### Navigation: pill states, landing anchor links, mobile control consolidation

Decided: 2026-07-10
What: Both navs use background-pill hover/active states (no underline). The landing header gains desktop-only section anchor links (no landing hamburger). Below ~768 px the palette/language/dark controls consolidate — app: into the MobileNav drawer; landing: into a single popover. The dark-mode toggle stays the 3-state cycle (light→dark→system), restyled as a bordered header button.
Why: Consistent nav language; 390 px headers are already crowded before the palette control arrives.
Rejected: Underline active states; all controls visible on mobile; 2-state dark toggle.

### Language switcher: text trigger, flags in dropdown

Decided: 2026-07-10
What: The trigger is a text shortcut ("CZ"/"EN") + chevron — no flag. The drawn `LanguageFlag` SVGs (never emoji — Windows renders emoji flags as letters) appear only inside the dropdown items.
Why: Lower visual weight in the header; flags stay for recognition where they don't shout.
Rejected: Flag trigger (too eye-catching); emoji flags (Windows fallback).

### Rollout: big-bang branch, single tracking issue, mockups first

Decided: 2026-07-10
What: One redesign branch merged to dev when complete, tracked by a single GitHub issue. Before implementation, dedicated anime-style mockups for: wishlist header (polaroid + share chip + alert variants), dashboard cards, gift detail modal, auth pages. Remaining surfaces are designed in code from the token system.
Why: Coherent reveal preferred over staged PRs; the four high-traffic/high-state surfaces are worth nailing visually first.
Rejected: Staged token-first PRs; feature-flag opt-in (double styling maintenance).

### Round-2 mockup deltas (all four mockups complete)

Decided: 2026-07-10 (round 2, after user review of the mockups)
What: All four mockups live in `designs/redesign-2026/sky-final/` (anime-sky-final, anime-dashboard, anime-gift-detail-modal, anime-auth). Deltas over the round-1 base:

- Primary buttons are FLAT stickers — `--brand-fill` background, ink border, hard offset shadow, white text, spring-lift hover. The gradient+glow primary (and glowPulse animation) is superseded.
- Tape appears only on paper-like artifacts (sticky note, polaroid). The loud trust warning keeps accent bg/bold/rotation but has NO tape.
- Gift images: real photos `object-fit: cover` by default; non-filling images letterbox with the dotted mat visible (`contain` + padding). Dotted gift-image background pans 0 0 → 24px 12px on hover (static for reserved/received).
- Like/heart control in the gift modal action bar is a full sticker-sized button (~52 px, 21 px heart), matching the reserve button.
- Visible Czech copy avoids em-dashes — comma, colon, or spaced en-dash instead.
- Static text hides the caret but stays selectable (`caret-color: transparent` on html, `auto` on form fields; never `user-select: none`). App-side caret investigation found no bug (Brave caret browsing, F7); app hardening optional.

Why: User review of round 1 flagged the glossy 3D primaries, misplaced tape, undersized heart, and em-dash copy; photo embeds + hover pan were requested additions.
Rejected: Glow kept as hover accent (still off-language); `user-select: none` for the caret (kills text selection).

### Request amplification: single-flight mutations, per-HTML preference reads, background email

Decided: 2026-07-12 (issue #108)
What: Four settled rules for Worker/Hyperdrive economy. (1) Mutating commands declare their own invalidations server-side via `singleFlightRefresh(query, arg)` (src/lib/server/remote.ts) — the fresh query result rides back on the command response and updates client-side tracked queries; the client never refreshes-then-refetches (resolves finding M6 in #79). Gift mutations refresh only the gift-list query — never wishlist metadata, likes, or dashboards. (2) Pages consume remote queries reactively (`$derived(query.current)` / SSR-awaited + tracked) so single-flight payloads land without follow-up fetches; dashboard list surfaces re-fetch when opened (nav dropdowns: throttled stale-while-revalidate refresh on hover; `refreshWishlistDashboards` is deleted). (3) Server hooks read stable presentation preferences (preferred locale + palette) in ONE combined statement, only for HTML document requests (GET + Accept text/html, not isDataRequest/isRemoteRequest) — remote functions, uploads, data and API requests pay zero preference statements. (4) `dispatchNotification` commits in-app rows durably, then delivers emails after the response via `runAfterResponse` (`platform.ctx.waitUntil`; detached in dev) — mutations never wait for Resend, failures log + leave `emailSent=false`. Budgets are pinned by tests: `tests/e2e/request-budgets.spec.ts` (dynamic-request counts per flow) and per-module statement-budget unit tests.
Why: One image-backed gift creation expanded into ~9 Worker invocations and dozens of Hyperdrive statements (auth + locale + palette reads on every request, refresh-then-refetch, three dashboard refreshes per mutation, synchronous email sends).
Rejected: better-auth `additionalFields` cookie-cache for preferences (staleness vs. explicit-switch semantics, larger blast radius); client-side `.updates()` single-flight (kit ≥2.56 requires server-side `requested()` acceptance — server-driven refreshes survive the upgrade); refreshing dashboards on every mutation (surfaces self-heal on open).

### Four-step control scale and form typography (issue #159)

Decided: 2026-07-18
What: Height-bearing controls use only `sm` 26 px, `md` 32 px, `lg` 38 px, or `xl` 48 px. Toolbars, navigation chrome, import, and the gift editor use `md`; standalone auth/settings/moderator/create-list form stacks use `lg`; landing and share CTAs use `xl`; compact secondary affordances use `sm`. Neighboring controls in one row or stack share a step. Textareas remain rows-driven. The heading ladder is: page headings clamp from 26–34 px; dialog, section, and empty-state headings use the 22 px `text-2xl` step; content-card headings use the 17 px `text-xl` step; dense and utility headings use the 14 px `text-base` step. Headings are semibold. `Label` is 12 px, semibold, and muted. Field help uses `HelpText` at 12 px muted. `muted-foreground` is the single secondary-text role; the duplicate `foreground-subtle`, `foreground-muted`, and `ink-soft` tokens/utilities are removed.
Why: One token-backed scale prevents accidental 36/44 px drift, aligns mixed controls, and makes the type hierarchy predictable across themes.
Rejected: Per-screen raw heights; state-specific Input sizes; parallel subtle-text tokens with nearly identical meanings.

### Ongoing wishlists are a first-class, additive copy option (issue #220)

Decided: 2026-08-01 (issue #220)
What: Wishlist copy treats an ongoing/eventless list as a first-class option, not an edge case — the event date is optional everywhere, and a list with no date is a normal, supported state rather than an unfinished occasion list. The governing principle is additive, not substitutive: wherever the UI enumerates kinds of lists, the ongoing list joins the enumeration alongside concrete occasion examples (Vánoce, narozeniny). Concrete examples are never replaced by an abstract "ongoing" label — e.g. „např. Vánoce 2026" stays a concrete example, with ongoing added beside it, not instead of it. Demo fixtures and seed data keep concrete occasions. Czech UI copy remains uniformly vykání (formal address) — tykání is not used anywhere, enforced by `pnpm check:vykani` (`scripts/check_vykani.mjs`) in `check:all`.
Why: Users create lists with no occasion in mind (a running "stuff I want" list) as often as occasion lists; hiding that option behind purely occasion-flavored copy makes the ongoing use case feel unsupported, while dropping concrete examples in favor of an abstract label would make the copy vaguer for the common occasion case.
Rejected: Rewriting the hero demo badge `landing_birthday` ("Narozeniny") to something abstract — loses a concrete, recognizable example for no gain; rewriting `wishlist_name_placeholder` — the occasion-flavored placeholder already reads fine as one example among others; rewriting `wishlist_create_description` — no substitution needed once the enumeration is additive; relabelling `create_more_settings` — unrelated to the date field; moving the event-date picker into the "Další nastavení" accordion — would reverse the "Wishlist creation as modal" minimal-fields decision above (event date is already optional and top-level); rewriting `landing_feat3_title` to promise per-list colours — overstates a minor feature and is out of scope for this copy pass.

### Reserved-gift ordering: role-aware bands within any sort

Decided: 2026-08-07
What: Non-recipient gift order is computed in three bands: (1) the viewer's own reservations pinned to the top under a small „Vaše rezervace" header (gifts move there, never duplicate); (2) available gifts; (3) fully reserved gifts sunk to the bottom as an invisible secondary modifier — no bottom section header, the dimmed overlay already communicates the state. The user's chosen sort applies within each band, and the availability filter keeps its existing semantics. Per-role defaults: recipient sees the owner order untouched (no reservation data reaches them, so bands are structurally a no-op); visitor/gifter gets all three bands; správce gets the own-reservation pin but NO reserved sinking — they curate the owner order and the dashboards' progress bar already summarizes reservation state.
Why: A shared list a week in otherwise greets every new visitor with a wall of reserved top gifts; the gifter's own reservation is the row they return for, so it anchors the top for every reserving role including správci.
Rejected: Reserved-at-top for správci (fights the curated owner order); a labeled bottom „Rezervované" section (duplicates the overlay's message); duplicating pinned gifts in both their band and their sorted position; making sinking a filter (hiding ≠ deprioritizing).

### ~~Priority grouping: optional flat sections, unprioritized ranks above the lowest level~~ (superseded)

Decided: 2026-08-07 — **Superseded 2026-08-13 by "Wishlist display controls" below.**
~~What: A „Seskupit podle priority" toggle renders flat section headers per priority level in the wishlist's level order, with the active sort applied within each group — no accordions/collapse. The toggle lives with the other display controls in the #161 filter dropdown, is persisted per device like `viewMode` (unlike sort/filters, which stay per-visit), defaults to off, and is hidden entirely when no gift on the list has a priority. Gifts without a priority form a „Bez priority" group placed above the lowest level (unprioritized means neutral, not last); the `priority` sort option adopts the same rank (replacing the sort-to-999 behavior). The own-reservation band stays above all priority groups.~~
Replaced because: grouping is now a separate visible selector that supports both priority and category, and no-priority/uncategorized groups are explicit no-value groups placed last.

### Wishlist display controls: separate grouping, facets, and per-list persistence

Decided: 2026-08-13 (issue #246)
What: Wishlist gift display has three independent control families. View mode remains the existing global per-device preference. Sort persists per wishlist on the current device. Grouping is a separate visible mutually exclusive selector (`none` / `priority` / `category`), also persisted per wishlist on the current device; unavailable grouping choices are disabled and an unavailable persisted grouping is coerced back to none. Filters live only for the current page visit. Category and priority filters are checkbox facets: multiple values within one facet are ORed, category/priority/existing facets are ANDed together, and explicit „Bez kategorie" / „Bez priority" options appear only when those gifts exist. Priority groups follow priority sort order with „Bez priority" last; category groups follow manager category sort order with „Bez kategorie" last. The chosen sort applies inside every structural section while preserving own-reservation, available/reserved, and received-final role behavior.
Why: Grouping is a display structure, not a filter; priority and category need equal first-class treatment, while filters should stay quick to clear and should not leak across visits.
Rejected: Keeping grouping inside the filter dropdown (confuses structure with inclusion); global grouping/sort persistence (viewers switch lists with different meanings); persisting filters (stale hidden gifts on return); treating no-priority/uncategorized as middle-ranked neutral values (explicit no-value groups read clearer at the end).

### Wishlist toolbar: labeled desktop controls, compact mobile command bar (mobile behavior superseded)

Decided: 2026-08-27 (issue #246 follow-up) — **Revised 2026-09-02 for narrow-screen sticky use; mobile behavior superseded 2026-09-04 by "Mobile wishlist command surfaces" below.**
What: At `sm` and wider, the wishlist toolbar keeps labeled 32 px `md` triggers for sort, grouping, and filtering, visually unifies them with leading semantic icons and trailing chevrons, and orders them as view → sort → grouping → filter → reset → visibly separated reorder. Management actions form an atomic, content-width cluster aligned right on the last row. Wide default state is one row; with active filters, pills stay adjacent to the controls and share the final wide row with management actions in separate collision-proof grid columns; medium layouts place filters before a dedicated final action row. Below `sm`, the sticky toolbar becomes an icon-only command bar capped at two rows: browsing controls occupy the first row, while reorder and role-gated management actions occupy the second row when present. Visitor states that fit remain one row. Sort, grouping, and filter triggers retain distinct semantic icons; filter exposes its active count on the trigger; active-filter pills and text labels are omitted from sticky mobile chrome. Reset remains adjacent to Filter and renders only when needed. Add gift remains the visually primary action even when icon-only. Every icon trigger has a state-specific accessible name and a minimum 40 px touch target. On mobile, Sort, Grouping, and Filter each open a dedicated, fully labeled bottom sheet using the shared Sheet primitive; this is the final interaction pattern rather than an anchored dropdown. Opening any sort, grouping, or filter sheet closes an open sibling.
Why: A naturally wrapping labeled toolbar can grow to six rows on a narrow phone, and because it is sticky it permanently consumes much of the viewport and makes browsing gifts impractical. The compact command bar bounds sticky chrome while preserving every action. Desktop labels still expose selected values where space allows; on mobile, semantic icons, active-count badges, accessible names, checked menu rows, and fully labeled overlay content carry the context without depending on hover.
Rejected: Natural mobile wrapping (unbounded sticky height); shortening translated labels (fragile and still value-dependent); a persistent or temporary sidebar (hides frequent browsing controls behind an extra navigation step); horizontally scrolling toolbar controls (important actions become undiscoverable); icon-only controls at desktop widths (unnecessary loss of visible state); independently wrapping management actions (splits Add gift from its peers); stretching Add gift on desktop; placing active filters after management actions; requiring an outside dismissal click before opening a sibling control; ad hoc height overrides instead of shared component size variants.

### Mobile wishlist command surfaces

Decided: 2026-09-04 (issue #340; supersedes the 2026-09-02 mobile three-trigger and fixed-two-row behavior)
What: Below `sm`, wishlist browse mode is one sticky row. View and one combined Display trigger remain direct; capability-available Settings remains direct; capability-available Add gift remains direct, primary, and rightmost. Reset, recipient-view preview, unfollow, multiselect, manual reorder, and batch add move into one capability-gated More sheet, with batch add lowest priority. Display opens one stable wishlist bottom sheet whose labeled Sort, Grouping, and Filter selectors switch sections in place while preserving all existing options and persistence semantics. Selection mode has an explicit count label and right-grouped Select all, Actions, and Cancel controls; Actions opens a non-cascading bulk bottom sheet with all existing fields and mixed/loading/disabled/pending states. Reorder mode has an explicit label and right-grouped Done action. Wishlist sheets derive a shared top-and-side-bounded, rounded, safe-area surface without changing the managed base Sheet primitive. The shared segmented control uses an accent tray without a strong group perimeter; only its selected item has the strong ink boundary, at 40 px on mobile and 32 px from `sm`. The mobile app bar keeps its 40 px tilted mark and core „přejeme si“ wordmark; only `.cz` may collapse at the narrowest width. Desktop toolbar behavior remains unchanged.
Why: One predictable command hierarchy prevents clipping and excess sticky height at narrow widths while keeping frequent, privileged actions direct and every eligible secondary action reachable. Stable labeled sheets improve touch use and state comprehension without changing display persistence, privacy gates, or the global Sheet primitive.
Rejected: Three independent mobile display triggers; a permanent second manager row; cascading bulk submenus; hiding Settings or Add gift under More; exposing capability-gated actions; modifying the managed base Sheet primitive; hiding the core wordmark.

### Reserved overlay parity: list view reuses the card sticker

Decided: 2026-08-07
What: The list view shows the same full-text „Rezervováno" sticker as the card view, centered on the 1:1 thumb, with the reserver-names line for správci. The row-wide dim is restructured to match card semantics: veil over the image + dimmed content columns, sticker crisp on top. Verified by implemented screenshots at desktop and mobile widths — the full sticker fits the 8–9.5rem thumb.
Why: The overlay is the fastest reserved signal and the two views should speak one language; the compact icon-only variant was screenshotted too but reads ambiguous (a bare check reads as "done/selected", not "reserved").
Rejected: Icon-only compact sticker on the thumb (ambiguous); keeping the text-line-only signal in list view (weakest signal, inconsistent).

### Hover elevation uses a stationary semantic owner and moving visual surface

Decided: 2026-09-23 (issue #346; narrow managed-base exception explicitly approved)
What: Raised interactions keep the native button/anchor/Bits trigger stationary as `.elevation-owner`; a direct `.elevation-surface` paints and moves. A static owner pseudo strip covers the resting lower shadow. Complex cards move an empty visual plate so nested controls are never transformed with an interactive ancestor. The shared managed Button, Select trigger, and ToggleGroup forwarding are edited only to expose this owner/surface contract.
Why: Real browser-zoom evidence showed repeated hover toggles and traversal gaps when the semantic target itself moved. An attempted inverse pseudo layer remained coupled to animated geometry and failed the zoom/depth matrix. Separating hit ownership from paint makes stability structural and preserves delegated refs, state, and native behavior.
Rejected: Further inverse/counter transforms, debouncing, JavaScript computed-style synchronization, CSS zoom substitutes, and removing elevation.
