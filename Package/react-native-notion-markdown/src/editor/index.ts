/**
 * The WYSIWYG editor for Markdown-enhanced content.
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
export { default as Markdown } from "../MarkdownModule.ts";

/** Pure store and React bindings for composable editors. */
export {
    MarkdownEditorProvider,
    useMarkdownEditor,
    useMarkdownEditorState,
    type MarkdownEditorProviderProps
} from "./state.tsx";
