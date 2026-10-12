# Inline math in the editor: milestones

This breaks [InlineMathPlan.md](InlineMathPlan.md) into five milestones that are implemented in order.
Each milestone leaves the package building, linted and tested, and ends in something that can be checked on its own.
The plan remains the reference for the design and for the detail of each change; section numbers below ("plan §4") refer to its "Changes" section.

| # | Milestone | Outcome | Depends on |
|---|-----------|---------|------------|
| 1 | Snapshot transport | An `EditorSnapshot` can carry inline equations and rejects malformed ones. | — |
| 2 | Native rendering in text blocks | Equations in a snapshot render as math and survive ordinary editing. | 1 |
| 3 | Create and edit | A format-row button and a bottom sheet create equations; tapping one edits it. | 2 |
| 4 | Table cells | Everything from milestones 2 and 3 also works inside table cells. | 3 |
| 5 | Plain-text interop, literal blocks, final pass | Equations leave the editor as `$…$`, and the whole feature is verified end to end. | 4 |

## Shared ground

These hold across every milestone, so that work done in one matches the next.

- An inline equation is one `U+FFFC` character in the text (`MARKDOWN_ATOM_PLACEHOLDER` from [fields.ts](Package/react-native-notion-markdown/src/document/fields.ts)) covered by a mark `{ kind: "equation", start, end: start + 1, expression }`.
- A mark is valid only when it covers exactly that one character, its `expression` is a non-blank string, and no other equation mark shares its offset. JS and Kotlin apply the same rule.
- Names used throughout: the `equations` prop and `onEquationRequest` event on `NativeEditor`; the `requestEquation` and `equation` command actions with `EditorCommand.expression`; `InlineMathSpan` and `MathLayout` in Kotlin; `useEditorEquationLayouts` and `EquationBottomSheet` in the editor UI; the `equation` toolbar id; the `onRequestEquation` host override.
- The RaTeX DisplayList conventions (units, baseline, the four item types, `Line.y` being the rule's center) are recorded in the plan's "Design" section and were verified against RaTeX's own SVG output.
- Repo rules from [AGENTS.md](AGENTS.md) apply: React Native style objects and callbacks are defined with `useMemo` / `useCallback`, never inline; Markdown sentences are not split across lines; device work goes through `agent-device` with the `PATH` and `AGENT_DEVICE_STATE_DIR` setup described there.

Every milestone finishes with the same three package checks, all of which must pass:

```sh
npm run typecheck --workspace react-native-notion-markdown
npm run lint --workspace react-native-notion-markdown
npm test --workspace react-native-notion-markdown
```

Milestones 2 to 5 also need the Storybook app built and installed from `Application` (`npm run android`), because they change native code.

## Milestone 1: Snapshot transport

**Goal.** The pure TypeScript transport understands inline equations. Nothing visible changes yet.

**Scope** (plan §1, and the tests in §6), all in [prototype.ts](Package/react-native-notion-markdown/src/prototype.ts) and [prototype.test.mjs](Package/react-native-notion-markdown/test/prototype.test.mjs):

- [ ] `EditorTextMark` accepts `kind: "equation"` and an optional `expression`.
- [ ] `validEditorMarks` enforces the validity rule above. Table cells are covered through `validEditorTable`.
- [ ] `AcceptEditorEvent` compares `expression` in `marksEqual`, so a change to an equation's source alone is not mistaken for "unchanged".
- [ ] New pure helper `editorEquationExpressions(blocks)` returns the unique expressions across block marks and table-cell marks, in document order.
- [ ] Tests: a valid equation mark round-trips through `acceptEditorEvent`; an expression-only change is accepted; each malformed shape (wrong length, not on `U+FFFC`, blank expression, duplicate offset) is rejected in a block and in a table cell; `editorEquationExpressions` dedupes across blocks and cells.

**Done when.** The three package checks pass with the new tests included.

**Known gap until milestone 2.** The native view ignores mark kinds it does not know, so a snapshot holding an equation shows the bare placeholder character and loses the mark on the next edit.

## Milestone 2: Native rendering in text blocks

**Goal.** Equations already present in a snapshot render as real math inside text blocks and behave as one character while the user edits around them. There is still no way to create one from the UI.

**Scope** (plan §2 without the event, §3, the non-command and non-cell parts of §4, the hook from §5, the story from §6):

- [ ] [NativeEditor.tsx](Package/react-native-notion-markdown/src/NativeEditor.tsx): the `equations` prop, and an `error` color in `NativeEditorColorName` / `nativeEditorTheme`.
- [ ] [MarkdownModule.kt](Package/react-native-notion-markdown/android/src/main/java/expo/modules/markdown/MarkdownModule.kt) and [EditorTheme.kt](Package/react-native-notion-markdown/android/src/main/java/expo/modules/markdown/EditorTheme.kt): `Prop("equations")` and the `error` color.
- [ ] New `InlineMathSpan.kt`: `MathLayout.parse`, the KaTeX typeface cache, and `InlineMathSpan` with its measuring, drawing, color and fallback rules.
- [ ] [MarkdownEditorView.kt](Package/react-native-notion-markdown/android/src/main/java/expo/modules/markdown/MarkdownEditorView.kt): `expression` on `EditorMark` and `EditorInlineMarkSpan`; equation marks parsed in `setSnapshot` and written by `EditorBlock.payload`; equation marks carried through the structured `copy` / `paste` fragment; `styleBlocks` and `captureInlineMarks` handling; `setEquations` refreshing spans on the main input without calling `styleBlocks()`.
- [ ] New `equationLayouts.ts` with `useEditorEquationLayouts`, exported from [editor/ui/index.ts](Package/react-native-notion-markdown/src/editor/ui/index.ts) so hosts that mount `NativeEditor` directly can supply the prop; [MarkdownEditor.tsx](Package/react-native-notion-markdown/src/editor/ui/MarkdownEditor.tsx) passes its result as `equations`.
- [ ] [Editor.stories.tsx](Application/Stories/Editor.stories.tsx): an `InlineMath` story with equations in a paragraph, a heading and a list item, plus one invalid expression.

**Done when,** on a device in the `InlineMath` story:

- [ ] Equations sit on the text baseline, scale with the heading, and a fraction grows its line instead of overlapping neighbors.
- [ ] `\frac{a}{b}`, `\sqrt{x+1}`, `\vec{v}` and `\cancel{x}` match the same expressions in the renderer's math story for glyph, rule and path placement.
- [ ] The invalid expression shows its source in the error color, and the dark theme recolors valid ones.
- [ ] Typing on either side leaves an equation intact, one backspace removes it whole, and undo and redo restore it.
- [ ] Copying a range that contains an equation and pasting it elsewhere in the editor keeps the equation.
- [ ] The three package checks pass.

## Milestone 3: Create and edit

**Goal.** Users can insert an equation, turn selected text into one, and edit an existing one, all in text blocks.

**Scope** (the `Action` / `EditorCommand` additions from plan §1, the event from §2, the commands and taps from §4, and the rest of §5):

- [ ] [prototype.ts](Package/react-native-notion-markdown/src/prototype.ts): the `requestEquation` and `equation` actions and `EditorCommand.expression`.
- [ ] Native: the `onEquationRequest` event registered in `MarkdownModule.kt`; `requestEquation` resolving the real selection inside one eligible block; `equation` updating the selected equation or replacing the selection with a new one, then leaving the caret after it and re-requesting the keyboard; tap detection in `EditorInput.onTouchEvent` that does not consume `ACTION_DOWN`.
- [ ] [NativeEditor.tsx](Package/react-native-notion-markdown/src/NativeEditor.tsx): the `onEquationRequest` prop and `NativeEquationRequestEvent`, re-exported from [editor/index.ts](Package/react-native-notion-markdown/src/editor/index.ts).
- [ ] [customization.ts](Package/react-native-notion-markdown/src/editor/ui/customization.ts): the `equation` button and format-toolbar id, placed between `code` and `link` in the default row.
- [ ] New `EquationBottomSheet.tsx`, modeled on [LinkBottomSheet.tsx](Package/react-native-notion-markdown/src/editor/ui/LinkBottomSheet.tsx), with a live `MarkdownMathView` preview.
- [ ] [MarkdownEditor.tsx](Package/react-native-notion-markdown/src/editor/ui/MarkdownEditor.tsx): the toolbar model, the request and result handlers, `expression` in the `send` / `onCommand` extras, and the `onRequestEquation` override with its exported types.
- [ ] [messages.ts](Package/react-native-notion-markdown/src/provider/messages.ts) and [lucideIcons.ts](Package/react-native-notion-markdown/src/editor/ui/lucideIcons.ts): the `toolbar.equation` and `equationSheet.*` messages, and `equation: Radical`.

**Done when,** on a device:

- [ ] With a word selected, `Aa` → Inline equation opens the sheet prefilled with that word, and Apply replaces the word with the rendered equation.
- [ ] With a collapsed cursor the sheet opens empty and Apply inserts at the cursor.
- [ ] Tapping an equation opens the sheet with its source, and Apply updates it in place; Cancel changes nothing and returns focus to the editor.
- [ ] Tapping beside an equation still places the cursor, and long-press selection and scrolling that start on an equation still work.
- [ ] The button is disabled when the selection spans blocks or sits in a block that cannot hold one (code, block equation, page reference, media, divider).
- [ ] Supplying `onRequestEquation` replaces the sheet and its result is applied (checked with a throwaway callback, not committed).
- [ ] The three package checks pass, and the existing editor Maestro flows are unaffected by the new format-row button.

## Milestone 4: Table cells

**Goal.** Table cells render, create, edit and delete equations the same way text blocks do.

**Scope** (the cell parts of plan §4 and §5, and the cell in the §6 story):

- [ ] `parseEditorTable` accepts equation marks and `EditorTableCell.payload` writes them.
- [ ] `applyCellSpans` adds `InlineMathSpan`, and `setEquations` also refreshes spans in cell editors.
- [ ] `updateCellMarksAfterEdit` drops an equation mark whose character was deleted, instead of sliding it onto the next character.
- [ ] `requestEquation` resolves the focused cell's selection, and `applyCellEquation` applies the result, following `applyCellLink`.
- [ ] Tap detection in `TableCellEditor.onTouchEvent`, sharing the hit test with the main input.
- [ ] The toolbar button is enabled while a table cell has the cursor.
- [ ] The `InlineMath` story gains a table with an equation in a cell.

**Done when,** on a device:

- [ ] The cell equation renders, can be edited by tapping it, and a new one can be inserted from the toolbar.
- [ ] One backspace removes a cell equation whole and leaves the neighboring character unmarked.
- [ ] A freshly inserted cell equation renders without the cell losing focus or its cursor jumping to the end of the cell.
- [ ] Duplicating a row or column keeps its equations, and clearing cells removes them.
- [ ] The existing `Table` story behaves as before.
- [ ] The three package checks pass.

## Milestone 5: Plain-text interop, literal blocks, final pass

**Goal.** Equations degrade sensibly wherever they leave the rich model, and the full feature is verified.

**Scope** (the last two bullets of plan §4, then the plan's "Verification" section):

- [ ] `copy`, for both the document and a table cell, writes each equation into the plain-text clip as `$expression$`.
- [ ] Plain-text paste drops stray `U+FFFC` characters, in the document and in cells.
- [ ] `turnIntoBlocks` to `code` or `equation` expands each inline equation back to `$expression$` text and removes its mark.

**Done when:**

- [ ] Copying text with an equation and pasting it into another app yields the `$…$` source.
- [ ] Turning a paragraph with an equation into a code block shows the literal `$…$`, and no rendered token remains.
- [ ] Every item in the plan's "Verification" section passes in one sitting, in both the light and dark themes, with screenshots captured as evidence.
- [ ] The three package checks pass.

## Not part of these milestones

Rendering the block `equation` type as math in the editor, wiring the "Block equation" insert option, typing shortcuts such as `$$…$$`, the unused per-field path (`MarkdownTextFieldView` / `MarkdownAtomSpan`), and iOS.
