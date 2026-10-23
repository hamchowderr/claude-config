# Writing — state the fact, nothing around it

How to write replies, artifacts, vault notes, READMEs, `docs/` and shipped skills.

## Every sentence carries a fact
- Keep a sentence only if the reader learns a fact they need. Cut asides to the reader ("That's the whole list."), sentences about the document itself ("This file exists because…"), aphoristic closers, rhetorical setups ("The most expensive thing X gets wrong isn't Y — it's Z") and self-congratulation ("It doesn't cry wolf."), because they bury the facts.
- Technical rationale stays ("Exit 2 discards stdout"). Rationale that turns into a moral goes.
- Stop when the information stops; do not wrap up a paragraph.

## Neutral tone
- State facts plainly. No defensive or persuasive asides that argue against a misconception ("X is NOT a reason to…, Y runs there too"); replace them with nothing or a plain pointer.
- No apologies. When Chowderr is frustrated or a mistake happened, state what went wrong and the current state, then act. "Sorry" or "you're right" reads as generated filler.

## No teaser or headline phrasing
- Titles, callouts, pill labels, eyebrows, ledes and the first line of a reply state a fact: what, when, who, which number. No metaphor, suspense, "again" or "learned the hard way", because Chowderr should not have to decode a sentence to get the fact.
- Write "Discord PR: closed 31 Aug, reopened as #25002 on 24 Sep", not "New today: the Discord package is moving again".
- Status labels name the state and the reference: "Partial fix · #24273", "Replaced by #22091".

## Current state only
- Describe the current pattern directly, with no lead-in comparing it to a superseded form ("not the older `model: {provider, name}` shape").
- No version archaeology in living reference docs or artifacts: no "New in 0.15.0", "removed in 0.12.0", "used to be", "previous revision" or alpha/beta labels on individual facts. Write "Intake is an organization-wide setting". Delete removed things instead of annotating them.
- Provenance goes in one stamp (package version + commit + date) in a header or footer. Version numbers in a dependency table are current facts and stay. History belongs in a changelog or decision-log note.
- Before publishing an update to a living doc, search the text for `New in|Added in|no longer|used to be|previous revision|removed in|alpha|beta` and restate each hit as a current fact without dropping content.
- Exception: a doc whose job is to record what changed keeps its comparisons.

## Obsidian links
- Link within a note with `[[#Heading]]`, never a markdown anchor `[text](#slug)`. Keep headings simple so the link target is clean.
