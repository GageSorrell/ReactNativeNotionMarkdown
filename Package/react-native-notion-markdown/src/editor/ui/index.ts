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
    NotionEditor,
    type NotionEditorAudioAction,
    type NotionEditorAudioAsset,
    type NotionEditorAudioSelection,
    type NotionEditorFileAsset,
    type NotionEditorFileSelection,
    type NotionEditorBlockActionsSelection,
    type NotionEditorButton,
    type NotionEditorComponents,
    type NotionEditorCustomButton,
    type NotionEditorCustomButtonPlacement,
    type NotionEditorCustomPanel,
    type NotionEditorCustomPanelContext,
    type NotionEditorIconProps,
    type NotionEditorLinkPromptResult,
    type NotionEditorLinkResult,
    type NotionEditorLinkSelection,
    type NotionEditorMediaAction,
    type NotionEditorMediaAsset,
    type NotionEditorMediaSelection,
    type NotionEditorPageReference,
    type NotionEditorPageReferenceSelection,
    type NotionEditorProps
} from "./NotionEditor.tsx";
export { type NotionEditorBlockAction } from "./ActionsBottomSheet.tsx";

/** Editor UI configuration -- currently localization, with room to grow to theming. */
export {
    NotionEditorConfigProvider,
    useNotionEditorConfig,
    useNotionEditorTranslate,
    type NotionEditorConfigProviderProps,
    type NotionEditorLocalization
} from "./config.tsx";
export {
    defaultEditorMessages,
    type EditorMessageId,
    type NotionEditorMessageDescriptor,
    type NotionEditorTranslate
} from "./messages.ts";
