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
    NativeProofEditor,
    type NativePageReferencePressEvent,
    type NativeProofEditorProps
} from "./NativeProofEditor.tsx";
export { default as NotionMarkdown } from "./NotionMarkdownModule.ts";
export * from "./prototype.ts";

/** Per-field editable coordinator: one native view per block field, plus its selection overlay. */
export {
    NotionSelectionOverlay,
    NotionTextField,
    type NotionSelectionOverlayProps,
    type NotionTextFieldProps
} from "./NotionEditorFields.tsx";
