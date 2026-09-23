/**
 * Backward-compatible low-level entry for consumers that need the native module surface.
 *
 * @module react-native-notion-markdown/native
 *
 * @file      native.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

export {
    NativeEditor,
    type NativePageReferencePressEvent,
    type NativeEditorProps
} from "./NativeEditor.tsx";
export { default as Markdown } from "./MarkdownModule.ts";
export * from "./prototype.ts";

/** Per-field editable coordinator: one native view per block field, plus its selection overlay. */
export {
    MarkdownSelectionOverlay,
    MarkdownTextField,
    type MarkdownSelectionOverlayProps,
    type MarkdownTextFieldProps
} from "./MarkdownEditorFields.tsx";
