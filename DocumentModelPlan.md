# Connect `MarkdownEditor` to the document model

## Context

The claim is accurate.
`MarkdownEditor` accepts only the flat `EditorSnapshot` transport from [prototype.ts](Package/react-native-notion-markdown/src/prototype.ts), and nothing converts between that and `MarkdownDocument`, so Markdown cannot be loaded into the editor or read back out.
The docs' [editor guide](Documentation/src/content/docs/v1/guides/editor.mdx) nevertheless says the editor "builds on the same document representation as the renderer".
The pure store (`createMarkdownEditor`, `MarkdownEditorProvider`) exists but was built for the per-field `MarkdownTextField` path and is not what `MarkdownEditor` runs on.

This change adds a pure, tested converter pair between `MarkdownDocument` and editor blocks, gives `MarkdownEditor` document-level `initial` / `onChange` props on top of it, and rewrites the guide to describe what actually exists.
It is JS-only: no Kotlin changes and no dev-client rebuild.

Decisions confirmed with you:

- **Props only.** `MarkdownEditor` gains `initial` and `onChange` and keeps its private snapshot undo history. It is not wired to `MarkdownEditorStore` / `MarkdownEditorProvider`.
- **Discard unsupported inline atoms.** Mentions, date mentions, citations and custom emoji are dropped when a document is loaded into the editor (inline equations are kept, since the editor draws them).

## Design

### 1. Converters: new `src/document/editorBlocks.ts`

Pure module, exported through [document/index.ts](Package/react-native-notion-markdown/src/document/index.ts) (and so from `./renderer` and the package root).
It imports only types from `prototype.ts`, so there is no runtime cycle.
Names follow the existing `fromMarkdownBlocks` / `toMarkdownBlocks` adapters.

```ts
toEditorBlocks(document: MarkdownDocument): { blocks: Array<EditorBlock>; diagnostics: Array<MarkdownDiagnostic> }
fromEditorBlocks(blocks: ReadonlyArray<EditorBlock>): MarkdownDocument
```

Contract: `toEditorBlocks` never emits a snapshot the native view or `AcceptEditorEvent` would reject, and reports everything it leaves out as a `warning` diagnostic (carrying the block's `source` location when it has one), so a host can warn or refuse to open a document for editing.

Block mapping (recursive tree to flat list with `depth`, and back):

| `MarkdownBlock` | `EditorBlock` |
| --- | --- |
| `paragraph` | `text`; an empty one round-trips as `<empty-block/>` (`metadata.empty`) |
| `heading_1..4` (+ `is_toggleable` / `metadata.toggle`) | same type (+ `toggle`) |
| `bulleted_list_item`, `numbered_list_item`, `quote`, `to_do` (`checked`) | same |
| `toggle` | `toggle` with `toggle: true` (loaded expanded; `collapsed` is view state and ignored on the way back) |
| `callout` (`icon.emoji`) | `callout` + `icon` |
| `code` (`language`, literal text) | `code` + `language`, no marks |
| `equation` (`expression`) | `equation` + `text` / `expression` |
| `divider`, `table_of_contents` | same |
| `table` + `table_row` children | `table` payload: cells as text + marks, flags, column / row / cell colors |
| `column_list` + `column` children | `column_list` + `columnCount`; column contents become nested blocks |
| `image`, `video` | same + `url` |
| `audio`, `file` | same + `url`; caption text maps to `fileName`; duration / waveform / MIME type / size live in `metadata.media` |
| `link_to_page` (page) | `link_to_page` + `text` (label), `url`, `icon` |
| `synced_block` | `synced_block`, children nested |

Rules:

- **Identity.** An editor block's `id` is `getMarkdownEditorBlockId(block)` ([selection.ts](Package/react-native-notion-markdown/src/document/selection.ts)); duplicates are made unique, and an empty document yields one empty `text` block, because the native view rejects duplicate ids and empty snapshots.
- **Rich text.** Reuse `richTextToFieldMarks` / `fieldMarksToRichText` from [fields.ts](Package/react-native-notion-markdown/src/document/fields.ts). Range marks map one to one; an inline equation is one `U+FFFC` with an `equation` mark; other atoms are removed and later marks shifted. `\n` in rich text is `U+2028` in editor text. Marks are merged and sorted `(start, end, kind)` to match what the native view echoes back, so unchanged blocks keep their identity through `AcceptEditorEvent`. On the way back, each line break becomes its own unannotated item so the serializer emits `**a**<br>**b**`, not a `<br>` inside the emphasis.
- **Nesting.** `depth` is free-form natively (indent just adds one), so a block becomes a child of the nearest preceding shallower block *that can hold children*. Non-toggle headings, code, equations, dividers, tables, media, page references and tables of contents cannot (the spec: "Headings do not support children"), so blocks nested under them are hoisted.
- **Block color** maps to `metadata.color` for every type (read falls back to the SDK payload `color`).
- **Tables.** Rows are padded to a rectangle. Written in the parser's shape (table `metadata.table` flags + `columnColors`, row `metadata.table.rowColor` / `cellColors`, payload `has_column_header` / `has_row_header` / `table_width`) so `serializeMarkdown` emits all of it; read also accepts the table-level `rowColors` / 2-D `cellColors` that [commands.ts](Package/react-native-notion-markdown/src/document/commands.ts) writes. The editor's `tableColor` has no spec attribute, so it is folded into uncolored columns.
- **Derived ids** are deterministic: `${id}:row:${n}`, `${id}:column:${n}`, and `${id}:text` for hidden text a `column_list` / `synced_block` carries after "turn into".
- `fromEditorBlocks` memoizes each block's own conversion in a module-level `WeakMap<EditorBlock, …>`; `AcceptEditorEvent` already reuses unchanged block objects, so a keystroke reconverts one block.

Fidelity: what loading a document into the editor loses (each is a diagnostic):

| Content | Outcome | Code |
| --- | --- | --- |
| Mentions, date mentions, citations, custom emoji | Removed (your decision) | `editor-discarded-inline` |
| Image / video captions; formatting inside audio / file captions | Removed | `editor-discarded-caption` |
| `pdf`, `embed`, `bookmark`, `synced_block_reference`, database references, SDK-unsupported blocks, media or page references with no URL, empty tables | Block removed | `editor-discarded-block` |
| Content in columns after the first | Kept, but returned in the first column (the native columns block is a placeholder with a count) | `editor-flattened-columns` |
| A synced block's source URL | Dropped; contents kept | `editor-discarded-attribute` |

Remote ids (`metadata.markdownId`) and source locations are not carried through an edit.

### 2. `MarkdownEditor` props: [MarkdownEditor.tsx](Package/react-native-notion-markdown/src/editor/ui/MarkdownEditor.tsx)

```ts
/** Initial content: enhanced Markdown or a parsed document. Read once, at mount. */
readonly initial?: MarkdownDocumentInput;
/** Receives the document after each user edit, undo, or redo. */
readonly onChange?: (document: MarkdownDocument) => void;
/** Receives the parser's and the editor conversion's diagnostics for `initial`. */
readonly onDiagnostics?: (diagnostics: ReadonlyArray<MarkdownDiagnostic>) => void;
```

- The starter snapshot becomes `useState(() => …)`: with `initial`, `parseMarkdown` (for a string) then `toEditorBlocks`, at epoch 1; without it, `CreateEditorDocument()` exactly as today. `initial` is read once; remount with a new `key` to load another document.
- `onDiagnostics` fires from an effect, mirroring `MarkdownRendererContent`.
- `onChange(fromEditorBlocks(blocks))` fires in the three places the internal document changes: in `receiveEdit` under the existing `source !== "replacement" && blocksChanged` condition (the same one that pushes an undo entry, so the native view's echo of a load never counts as a change), and in `handleUndo` / `handleRedo`.
- Internal state management is today disabled whenever `onEdit` is passed. It stays on when `initial` or `onChange` is used, so `onEdit` can still observe. A supplied `snapshot` keeps taking precedence and behaves exactly as now.
- The three props are destructured in `MarkdownEditorContent` so they do not leak into the root `View`. New callbacks and styles use `useCallback` / `useMemo` per the style guide.
- `EditorBlock`'s doc comment in `prototype.ts` ("not the public Markdown AST") gains a pointer to the converters.

### 3. Supporting fixes the new path depends on

- **Table events are rejected today.** `EditorTable.payload()` in `MarkdownEditorView.kt` sends `tableColor: null` (Expo's `putNull`) and `null` entries in `columnColors`, while `validEditorTable` in `prototype.ts` only accepts `undefined`. In internally managed mode every event from a document containing a table is therefore dropped by `AcceptEditorEvent`, which would make `onChange` never fire for such documents. It is invisible today because the Table story supplies `snapshot`. Fix: accept `null` as absent in `validEditorTable` (JS-only), and treat it the same in `fromEditorBlocks`. To be confirmed on device.
- **Paragraph children.** The spec allows `Rich text` + indented `Children`, and the serializer already writes them, but the parser's paragraph branch never calls `followingChildren`, so an indented block under a text block (the editor's most common nesting) is dropped on reload with `unexpected-indentation`. Add the call in [parser.ts](Package/react-native-notion-markdown/src/document/parser.ts), leaving `children` absent when there are none so existing shapes do not change.

### 4. Documentation

- Rewrite [guides/editor.mdx](Documentation/src/content/docs/v1/guides/editor.mdx): loading and saving with `initial` / `onChange` (with `serializeMarkdown`), handing the same `MarkdownDocument` to `MarkdownRenderer`, the supported-block table, what is discarded and how to read `onDiagnostics`, and the `snapshot` / `onEdit` transport plus `toEditorBlocks` / `fromEditorBlocks` for hosts that mount `NativeEditor` directly. State plainly that `MarkdownEditor` does not use `MarkdownEditorStore`.
- Correct the matching sentence in [guides/entry-points.mdx](Documentation/src/content/docs/v1/guides/entry-points.mdx), and add a short note on the converters to [ReadMe.md](ReadMe.md).
- One sentence per line, per AGENTS.md.

### 5. Storybook

Append a `FromMarkdown` story to [Editor.stories.tsx](Application/Stories/Editor.stories.tsx): the editor seeded from a Markdown string covering the supported blocks (nesting, a toggle, a callout, a table, inline math, a to-do), with a header control that switches between the editor, the serialized Markdown from `onChange`, and a `MarkdownRenderer` preview of the same document.
This is the on-device proof of the path in and back out.

### 6. Tests: new `test/editorBlocks.test.mjs`

Node tests against the built package, like the existing suites.

- Every projection is accepted: feed `toEditorBlocks(parseMarkdown(md).document).blocks` through `acceptEditorEvent` and assert it is not rejected.
- Markdown round trip: `serializeMarkdown(fromEditorBlocks(toEditorBlocks(parse(md)).blocks))` equals the serializer's canonical output for the supported subset (marks, colors, links, soft breaks, inline and block equations, code, toggles and toggle headings, callouts, to-dos, nested lists, paragraph children, tables with flags and colors, media, page references).
- Editor round trip: `toEditorBlocks(fromEditorBlocks(blocks)).blocks` deep-equals `blocks` for editor-native fixtures (the Table, Inline Math, Callout and Quote story snapshots).
- Discards and their diagnostics; column flattening; depth jumps and non-container parents; duplicate ids; the empty document.
- `acceptEditorEvent` accepts a table event carrying `tableColor: null` and `null` column colors.
- Parser: a paragraph with indented children round-trips.

## Verification

1. `npm run test --workspace react-native-notion-markdown` (builds, then runs every Node suite).
2. `npm run typecheck --workspace markdown-storybook`, and `npm run lint` in both `react-native-notion-markdown` and `markdown-storybook`.
3. `npm run docs:check` for the MDX changes.
4. On device, with the existing dev client (no native rebuild): open **Editor / From Markdown** through `agent-device` (following the AGENTS.md setup for `adb` and the state directory), confirm the blocks render, type in a paragraph and in a table cell, undo, and check that the Markdown and preview views reflect each step. If no device is attached I will say so rather than claim it.

## Notes

- `parser.ts`, `serializer.ts`, `MarkdownRenderer.tsx` and others gained uncommitted changes while I was reading, so something else is editing this tree. I will re-read each shared file immediately before touching it and keep my hunks small (`parser.ts`: one branch; `prototype.ts`: the table validator and a comment).
- Out of scope, as decided: store / provider integration, and a native atom mark that would let mentions survive editing.
