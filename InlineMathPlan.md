# Inline math in the editor

## Context

The renderer already draws inline math (`$equation$` in the spec, an `equation` rich-text item rendered by `MarkdownMathView`), but the editor cannot represent it at all.
`MarkdownEditor` runs on the shared-buffer `NativeEditor` (`MarkdownEditorView.kt`), whose `EditorSnapshot` transport only knows the range marks bold/italic/underline/strikethrough/code/color/link.
This change adds inline equations to that transport, renders them as real math inside the native `EditText`, and gives users a way to create and edit them.

Decisions confirmed with you: creation and editing go through a format-row button plus a bottom sheet (tap an equation to reopen it), and table cells are supported alongside text blocks.

## Design

- **Atomic token.** An inline equation is one `U+FFFC` character in the block text, covered by a mark `{ kind: "equation", start, end: start + 1, expression }`. This is the existing atom convention (`MARKDOWN_ATOM_PLACEHOLDER` in [fields.ts](Package/react-native-notion-markdown/src/document/fields.ts), `MarkdownAtomSpan.kt`), so caret movement, selection and soft-keyboard backspace are atomic with no boundary-guarding code.
- **Native rendering from RaTeX's DisplayList.** RaTeX is only reachable through JSI, so JS calls `renderToView(expression, false)` from `react-native-ratex` (already a required peer) and hands the resulting JSON to the native view through a new `equations` prop keyed by expression. Kotlin draws it on the `Canvas` in a `ReplacementSpan`. The DisplayList (unlike `renderToSvg`) carries `height`/`depth` in em, which is what makes baseline alignment possible. Glyphs come from the `fonts/KaTeX_*.ttf` assets `react-native-ratex` already ships in the APK.
- **Native owns the selection.** The toolbar button and a tap on an equation both end in one native event, `onEquationRequest { expression, editing }`, resolved from the real native selection (block or table cell). JS shows the sheet and answers with an `equation` command. This avoids re-deriving ranges in JS, where table-cell range selections are not reported.

DisplayList facts verified by running RaTeX's WASM build in Node (so implementation does not need to rediscover them): root is `{ version: 1, width, height, depth, items }` in em with the baseline at `y = height`; items are `GlyphPath { font, char_code, scale, x, y(baseline), color }`, `Line { x, y, width, thickness, dashed }` where `y` is the rule's **center**, `Rect { x, y, width, height }` (top-left), and `Path { x, y, fill, commands }` with `MoveTo`/`LineTo`/`CubicTo`/`Close` relative to the item origin; `font` values look like `Main-Regular`, `Math-Italic`, `Size1-Regular`, `AMS-Regular`; invalid LaTeX throws.

## Changes

### 1. Transport — [prototype.ts](Package/react-native-notion-markdown/src/prototype.ts)

- `EditorTextMark`: add `"equation"` to `kind` and an optional `expression`.
- `validEditorMarks`: an equation mark is valid only when `end === start + 1`, `text[start]` is `MARKDOWN_ATOM_PLACEHOLDER` (import it from `document/fields.ts`), `expression` is a non-blank string, and no two equation marks share an offset. Table cells are covered automatically through `validEditorTable`.
- `AcceptEditorEvent`: include `expression` in `marksEqual`. Without this, editing an equation's source in place (same range) is treated as "unchanged" and the edit is dropped.
- `Action`: add `"requestEquation"` and `"equation"`; `EditorCommand`: add `expression?: string`.
- New pure helper `editorEquationExpressions(blocks)`: unique expressions across block marks and table-cell marks, in document order.

### 2. JS ↔ native surface

- [NativeEditor.tsx](Package/react-native-notion-markdown/src/NativeEditor.tsx): add props `equations?: Readonly<Record<string, string | null>>` (DisplayList JSON, or `null` when RaTeX rejected the expression) and `onEquationRequest`, plus the `NativeEquationRequestEvent` type; add an `error` entry to `NativeEditorColorName` / `nativeEditorTheme` (from `document.error`). Re-export the new type from [editor/index.ts](Package/react-native-notion-markdown/src/editor/index.ts).
- [MarkdownModule.kt](Package/react-native-notion-markdown/android/src/main/java/expo/modules/markdown/MarkdownModule.kt): register the `onEquationRequest` event and `Prop("equations")`.
- [EditorTheme.kt](Package/react-native-notion-markdown/android/src/main/java/expo/modules/markdown/EditorTheme.kt): add the `error` color with the light-theme default.

### 3. Native rendering — new `InlineMathSpan.kt` (next to `InlineCodeSpan.kt`)

- `MathLayout.parse(json)`: parses the DisplayList into plain Kotlin items once per expression; returns `null` for malformed input or an unknown `version`.
- KaTeX typeface cache: `Typeface.createFromAsset(assets, "fonts/KaTeX_$font.ttf")`, wrapped in `runCatching`.
- `InlineMathSpan(expression, lookup, colors) : ReplacementSpan`, using `paint.textSize` as the em so equations scale inside headings.
  - `getSize`: width from the layout plus a small horizontal margin; widens `fm` ascent/descent to `height`/`depth` so tall math (fractions) grows its line.
  - `draw`: glyphs via `drawText` with the KaTeX typeface at `scale * em`, rules and rects as filled rects, paths as `android.graphics.Path` (filled, or stroked when `fill` is false). Default-black items take the span's text color (inline color mark → block color → theme foreground); explicit `\color` values are kept.
  - Fallbacks mirroring `MarkdownMathView`: layout not delivered yet → the raw source in monospace/muted; `null` layout → the source in the theme's error color.
  - Records its last drawn bounds for tap hit-testing.

### 4. Native editing — [MarkdownEditorView.kt](Package/react-native-notion-markdown/android/src/main/java/expo/modules/markdown/MarkdownEditorView.kt)

- `EditorMark` and `EditorInlineMarkSpan` gain `expression`. Extend the mark parsing sites (`setSnapshot`, `parseEditorTable`, structured `paste`) and payload sites (`EditorBlock.payload`, `EditorTableCell.payload`, structured `copy`) with the equation kind, using the same validity rule as JS.
- `styleBlocks`: strip `InlineMathSpan`s with the other spans and add one per equation mark. `captureInlineMarks`: carry `expression` and drop any equation mark that no longer covers exactly one `U+FFFC`.
- `setEquations(value)`: update the parsed-layout cache, then re-set the existing `InlineMathSpan`s on the main input and on cell editors so their lines re-measure. This deliberately avoids `styleBlocks()`, which rebuilds every table-cell editor through `tableOverlay.sync()` and would reset an active cell's selection.
- Commands:
  - `requestEquation`: for a selection inside one eligible block (text, headings, lists, to-do, toggle, quote, callout) or the focused cell, emit `onEquationRequest` with the selected equation's expression (`editing: true`) or the selected plain text as a prefill (`editing: false`).
  - `equation`: update the selected equation's expression, or replace the selection with one `U+FFFC` plus a new mark; leave the caret after the token and re-request the keyboard. `applyCellEquation` is the cell twin, following `applyCellLink`.
- Taps: in `EditorInput.onTouchEvent` and `TableCellEditor.onTouchEvent`, arm on `ACTION_DOWN` without consuming it (so cursor placement, long-press and scrolling keep working), and on a slop-free `ACTION_UP` over the same span select the token and emit `onEquationRequest`, skipping the usual `requestKeyboard()`.
- Table cells: `applyCellSpans` adds the span; `updateCellMarksAfterEdit` drops equation marks whose character was deleted (its current clamp would otherwise slide the mark onto the next character).
- Plain text: `copy` (document and cell) writes each token as `$expression$`, the spec's inline syntax; plain-text paste drops stray `U+FFFC`.
- `turnIntoBlocks` to `code` or `equation` expands tokens back to `$expression$` text, since those blocks are literal.

### 5. Editor UI

- New [equationLayouts.ts](Package/react-native-notion-markdown/src/editor/ui/) with `useEditorEquationLayouts(blocks)`: memoizes on the joined expression list (so ordinary typing does not recompute), calls `renderToView` after `uniffiInitAsync()` exactly as [MathView.tsx](Package/react-native-notion-markdown/src/renderer/ui/MathView.tsx) does, and caches per expression at module level (layouts are theme-independent).
- New `EquationBottomSheet.tsx`, modeled on [LinkBottomSheet.tsx](Package/react-native-notion-markdown/src/editor/ui/LinkBottomSheet.tsx): a monospace multiline LaTeX field (no autocorrect/autocapitalize), a live preview using the existing `MarkdownMathView`, and Cancel/Apply (Apply disabled while blank). Styles and callbacks go through `useMemo`/`useCallback` per the repo style guide.
- [customization.ts](Package/react-native-notion-markdown/src/editor/ui/customization.ts): add `"equation"` to `MarkdownEditorButton` and `MarkdownEditorFormatToolbarItem`, and to the default format row between `code` and `link`.
- [MarkdownEditor.tsx](Package/react-native-notion-markdown/src/editor/ui/MarkdownEditor.tsx): the `equation` format-row model (enabled when the selection sits in one eligible block or a table cell; sends `requestEquation`); `handleEquationRequest` / `handleEquationResult` mirroring the link handlers; pass `equations` and `onEquationRequest` to `NativeEditor`; add `expression` to the `send` / `onCommand` extras; and a host override `onRequestEquation`, parallel to `onRequestLink`, with `MarkdownEditorEquationSelection` / `Result` / `PromptResult` types exported from [editor/ui/index.ts](Package/react-native-notion-markdown/src/editor/ui/index.ts).
- [messages.ts](Package/react-native-notion-markdown/src/provider/messages.ts): `toolbar.equation` and `equationSheet.{title,expression,placeholder,preview,cancel,apply}`.
- [lucideIcons.ts](Package/react-native-notion-markdown/src/editor/ui/lucideIcons.ts): `equation: Radical` (present in the installed `lucide-react-native`).

### 6. Story and tests

- [Editor.stories.tsx](Application/Stories/Editor.stories.tsx): an `InlineMath` story whose snapshot has equations in a paragraph, a heading, a list item and a table cell, plus one invalid expression.
- [prototype.test.mjs](Package/react-native-notion-markdown/test/prototype.test.mjs): equation marks round-trip through `acceptEditorEvent`; an expression-only change is accepted; malformed marks (wrong length, not on `U+FFFC`, blank expression, duplicate offset) are rejected in blocks and table cells; `editorEquationExpressions` dedupes across blocks and cells.

## Out of scope

- The block `equation` type still shows its LaTeX source in the editor, and the "Block equation" insert option stays unwired.
- Typing shortcuts such as `$$…$$`.
- The unused per-field path (`MarkdownTextFieldView` / `MarkdownAtomSpan`), which keeps its label pill; it can adopt `InlineMathSpan` later.
- iOS (the module is Android-only).

## Verification

1. In `Package/react-native-notion-markdown`: `npm run typecheck`, `npm run lint`, `npm test`.
2. Build and install the Storybook app from `Application` (`npm run android`), then drive the `Editor / InlineMath` story on the device with `agent-device` following AGENTS.md (version check, `help workflow`, `help react-native`, and the `PATH` / `AGENT_DEVICE_STATE_DIR` setup), capturing screenshots as evidence:
   - Equations render as math on the text baseline in the paragraph, heading, list item and table cell; a fraction grows its line; the invalid one shows its source in the error color; dark theme recolors them.
   - Compare a few expressions (`\frac{a}{b}`, `\sqrt{x+1}`, `\vec{v}`, `\cancel{x}`) against the same expressions in the renderer's math story to confirm glyph, rule and path placement.
   - Tap an equation → sheet opens prefilled → edit → Apply updates it in place.
   - Select a word, `Aa` → Inline equation → sheet prefilled with the word → Apply replaces it; repeat with a collapsed cursor and inside a table cell.
   - One backspace removes a whole equation; typing on either side leaves it intact; undo and redo restore it; copy and paste within the editor keeps it, and pasting into another app yields `$…$`.
