/**
 * A pre-configured, "batteries included" editor UI.
 *
 * @module react-native-notion-markdown/editor/ui
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

export {
    MarkdownEditor,
    type MarkdownEditorAudioAction,
    type MarkdownEditorAudioAsset,
    type MarkdownEditorAudioSelection,
    type MarkdownEditorFileAsset,
    type MarkdownEditorFileSelection,
    type MarkdownEditorBlockActionsSelection,
    type MarkdownEditorButton,
    type MarkdownEditorComponents,
    type MarkdownEditorCustomButton,
    type MarkdownEditorCustomButtonPlacement,
    type MarkdownEditorCustomPanel,
    type MarkdownEditorCustomPanelContext,
    type MarkdownEditorIconProps,
    type MarkdownEditorLinkPromptResult,
    type MarkdownEditorLinkResult,
    type MarkdownEditorLinkSelection,
    type MarkdownEditorMediaAction,
    type MarkdownEditorMediaAsset,
    type MarkdownEditorMediaSelection,
    type MarkdownEditorPageReference,
    type MarkdownEditorPageReferenceSelection,
    type MarkdownEditorProps
} from "./MarkdownEditor.tsx";
export { type MarkdownEditorBlockAction, type MarkdownEditorTableAction } from "./ActionsBottomSheet.tsx";

/** Editor UI configuration -- currently localization, with room to grow to theming. */
export {
    MarkdownEditorConfigProvider,
    useMarkdownEditorConfig,
    useMarkdownEditorTranslate,
    type MarkdownEditorConfigProviderProps,
    type MarkdownEditorLocalization
} from "./config.tsx";
export {
    defaultEditorMessages,
    type EditorMessageId,
    type MarkdownEditorMessageDescriptor,
    type MarkdownEditorTranslate
} from "./messages.ts";
