# `react-native-notion-markdown`

The `Application` workspace is an Expo development build whose only interface is the on-device Storybook catalog.

## Milestone 1: foundation and native proof

Open **Milestone 1 / Native editing proof / Three Blocks** in Storybook. The prototype starts with a paragraph, a heading, and another paragraph. Its diagnostic header displays native revisions, composing ranges, and block-relative UTF-16 selection endpoints. The diagnostic actions split/merge blocks, insert soft breaks, select all, and replace the document with a new epoch. Copy/cut/paste work from the toolbar and Android's system selection menu; the clipboard contains interoperable plain text and a versioned package-specific fragment preserving paragraph/heading types. The Insert panel bookmarks selection by retaining the native buffer, hides the keyboard, and restores editing when closed. The Aa button proves switching toolbar modes, not the later formatting catalog.

The proof intentionally uses a single coordinated Android `EditText`/`Editable`, with block boundaries mapped to stable editor IDs and headings rendered using spans. Android owns its continuous selection handles, scrolling, composing buffer, and `InputConnection`. JavaScript accepts revisioned snapshots without resetting the buffer; replacement changes epoch, restarts input, and rejects writes from old input connections. This is a proof transport model, **not** the milestone-2 public Notion document model or the complete editor. Selection coordination between separately mounted native fields, heterogeneous/atomic blocks, and the full formatting UI remain unproven and must be addressed before expanding the catalog.

The **Compose Japanese** and **Commit composition** actions in the Insert panel exercise the actual native input connection with `にほん` → `日本`. They make composing-range retention across JavaScript acknowledgements reproducible without installing a CJK keyboard. They do not replace testing real keyboard composition, autocorrection, or selection-handle gestures.

Dependencies follow `node_modules/expo/bundledNativeModules.json` for the installed Expo **57.0.22**, including React **19.2.3**, React Native **0.86.3**, Reanimated **4.5.1**, Worklets **0.10.1**, and Keyboard Controller **1.21.9**. One publication exception is pinned: that manifest requests `expo-dev-client ~57.0.19`, but npm only publishes **57.0.18** at implementation time. Expo's online compatibility check also recommends upgrading Expo itself to **57.0.23**; this milestone retains the requested installed baseline instead. `expo-system-ui ~57.0.4` is also unpublished, so prebuild warns about automatic system UI styling; the proof still reads the system color scheme and supplies its own colors.

## Package entry points

`react-native-notion-markdown/renderer` exports renderer/core helpers without loading React Native or Expo. `react-native-notion-markdown/editor` exports fundamental editor primitives, while `react-native-notion-markdown/editor/ui` is the only entry point for the fully configured, ready-to-go editor UI. The package root combines the renderer and fundamental editor exports; use the narrower paths when bundle size matters. `react-native-notion-markdown/native` remains available for the low-level native module surface.

The editor UI uses Lucide icons when `lucide-react-native` is installed. Lucide is an optional peer dependency; applications can omit it and provide `NotionEditorComponents` icon overrides or use the accessible text fallback.

## Checks

Run `npm run test --workspace react-native-notion-markdown`, `npm run typecheck --workspace notion-markdown-storybook`, and the `lint` script in either workspace. Application typechecking builds the package first. `npm pack --dry-run --json --workspace react-native-notion-markdown` verifies publish contents without publishing anything. Native changes require a rebuilt dev client, not Expo Go.

See [milestone-1 verification](Application/Milestone1.md) for observed emulator results and remaining acceptance gates.

## Milestone 2: format and document engine

The pure document engine is available from `react-native-notion-markdown/renderer` or the narrower `react-native-notion-markdown/document` entry point.

`parseNotionMarkdown` returns a versioned recursive `NotionDocument` and source-located diagnostics for the enhanced Markdown format in `Local/NotionMarkdownSpec.md`.

`serializeNotionMarkdown` produces canonical tab-indented enhanced Markdown, while `fromNotionBlocks` and `toNotionBlocks` import and export SDK-shaped block trees without network access.

`createNotionEditor` provides immutable transactions, grouped undo/redo, revisioned subscriptions, Markdown serialization on demand, and selection mapping across nested blocks, captions, and table cells.

`NotionEditorProvider`, `useNotionEditor`, and `useNotionEditorState` expose the same store to composable React editor surfaces.

SDK conversion diagnostics are returned by default and become `NotionConversionError` exceptions when `toNotionBlocks` is called with `{ strict: true }`.

## Installation

Run `npm install` from the repository root. This links the local `react-native-notion-markdown` workspace into the application and installs the Expo-compatible native dependencies.

## First Android build

Run `npm run prebuild:android --workspace notion-markdown-storybook` and then `npm run android --workspace notion-markdown-storybook`. The first build generates the native Android project and installs the development client.

## Subsequent launches

Run `npm run start --workspace notion-markdown-storybook` and open the installed development build, or use `npm run android --workspace notion-markdown-storybook` to build and launch it directly.

## Native changes

Run the Android build again after changing the module's Kotlin source or native configuration. The generated application Android directory is ignored; the module Android source remains tracked.
