/**
 * The WYSIWYG editor for Notion-enhanced markdown.
 *
 * @module react-native-notion-markdown/editor
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

export {
    NativeEditor,
    type NativePageReferencePressEvent,
    type NativeEditorProps
} from "../NativeEditor.tsx";
export { default as NotionMarkdown } from "../NotionMarkdownModule.ts";

/** Pure store and React bindings for composable editors. */
export {
    NotionEditorProvider,
    useNotionEditor,
    useNotionEditorState,
    type NotionEditorProviderProps
} from "./state.tsx";
