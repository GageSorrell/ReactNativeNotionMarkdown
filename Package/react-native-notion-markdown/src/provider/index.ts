/**
 * `MarkdownProvider` and the shared theme, localization, and configuration API used by both the
 * "batteries included" editor and the renderer.
 *
 * @module react-native-notion-markdown/provider
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

export {
    MarkdownProvider,
    useMarkdownColorScheme,
    useMarkdownConfig,
    useMarkdownTheme,
    useMarkdownTranslate,
    useResolvedEditorConfig,
    useResolvedRendererConfig,
    type MarkdownContextValue,
    type MarkdownLocalization,
    type MarkdownOpenUrl,
    type MarkdownProviderProps,
    type MarkdownSharedConfig,
    type MarkdownTranslateById,
    type ResolvedMarkdownContext
} from "./MarkdownProvider.tsx";
export {
    darkMarkdownTheme,
    lightMarkdownTheme,
    markdownColor,
    markdownColorNames,
    mergeMarkdownThemeOverrides,
    resolveMarkdownTheme,
    withAlpha,
    type DeepPartial,
    type MarkdownColorName,
    type MarkdownColorScheme,
    type MarkdownColorSchemePreference,
    type MarkdownDocumentTheme,
    type MarkdownEditorTheme,
    type MarkdownPalette,
    type MarkdownTheme,
    type MarkdownThemeOverride
} from "./theme.ts";
export {
    defaultMarkdownMessages,
    defaultMarkdownTranslate,
    formatMarkdownMessage,
    type MarkdownMessageDescriptor,
    type MarkdownMessageId,
    type MarkdownTranslate
} from "./messages.ts";
export { mergeMarkdownConfig } from "./config.ts";
