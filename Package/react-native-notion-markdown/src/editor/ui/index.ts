/**
 * A pre-configured, "batteries included" editor UI, themed and configured through
 * `MarkdownProvider` (re-exported here).
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
export { Switch, type SwitchProps, type SwitchSize } from "./Switch.tsx";

/** Toolbar, panel, icon, and layout customization -- see `MarkdownEditorConfig`. */
export {
    defaultMarkdownEditorInsertSections,
    defaultMarkdownEditorToolbar,
    defaultMarkdownEditorTurnIntoItems,
    resolveToolbarItems,
    type MarkdownEditorButton,
    type MarkdownEditorColorPanel,
    type MarkdownEditorConfig,
    type MarkdownEditorCustomButton,
    type MarkdownEditorCustomInsertItem,
    type MarkdownEditorCustomPanel,
    type MarkdownEditorCustomPanelContext,
    type MarkdownEditorFormatToolbarItem,
    type MarkdownEditorIconProps,
    type MarkdownEditorIcons,
    type MarkdownEditorInsertContext,
    type MarkdownEditorInsertItem,
    type MarkdownEditorInsertPanel,
    type MarkdownEditorInsertSection,
    type MarkdownEditorLayout,
    type MarkdownEditorMainToolbarItem,
    type MarkdownEditorToolbar,
    type MarkdownEditorTurnIntoItem,
    type MarkdownEditorTurnIntoPanel,
    type ResolvedToolbarItem
} from "./customization.ts";

/** Theme, localization, and configuration shared with the renderer. */
export * from "../../provider/index.ts";
