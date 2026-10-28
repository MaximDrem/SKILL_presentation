# EDIT — modifying an existing deck

Editing an existing pptx in place is **not supported** by this skill's
tooling.

When the user asks to change, add or remove something in an existing deck:

1. Tell them direct editing is not supported.
2. Offer the supported alternatives:
   - **CLONE** (`clone.md`) — build a new deck in the same style with the
     updated content;
   - **CREATE** (`create.md`) — author a new deck from scratch.

Never rebuild the user's deck from its unpack dump and deliver it as an
"edited" copy — that loses masters, theme links and effects and breaks
the file. Never modify the user's original file.