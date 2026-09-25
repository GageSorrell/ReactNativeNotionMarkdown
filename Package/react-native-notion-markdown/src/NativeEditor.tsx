/**
 * @module react-native-notion-markdown/NativeEditor
 *
 * @file      NativeEditor.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type {
    EditorBlock,
    EditorBlockActionScope,
    EditorCommand,
    EditorEvent,
    EditorSnapshot,
    EditorTableSelection
} from "./prototype.ts";
import { type MarkdownColorName, type MarkdownTheme, markdownColorNames } from "./provider/theme.ts";
import { type ViewProps, processColor } from "react-native";
import type { ComponentType } from "react";
import { requireNativeViewManager } from "expo-modules-core";

/**
 * The colors the native editor view draws with, by name.
 *
 * @since 1.0.0
 */
export type NativeEditorColorName =
    | "accent"
    | "attachmentAccent"
    | "attachmentForeground"
    | "attachmentIconSurface"
    | "attachmentMuted"
    | "attachmentSurface"
    | "audioAccent"
    | "audioOnAccent"
    | "audioSurface"
    | "audioWaveformInactive"
    | "background"
    | "border"
    | "calloutBorder"
    | "foreground"
    | "inlineCodeBackground"
    | "inlineCodeForeground"
    | "mediaOverlay"
    | "mediaOverlayIcon"
    | "mediaPlaceholder"
    | "mediaPlaceholderError"
    | "muted"
    | "onAccent"
    | "placeholder"
    | "shadow"
    | "surface"
    | "switchThumb"
    | "switchTrackOff"
    | "switchTrackOn"
    | "tableBorder"
    | "tableControl"
    | "tableHeaderBackground";

/**
 * The theme as the native editor view receives it: every color as an ARGB integer, plus the
 * document typography.
 *
 * @since 1.0.0
 */
export interface NativeEditorTheme
{
    readonly colors: Readonly<Record<NativeEditorColorName, number>>;
    readonly paletteBackground: Readonly<Record<MarkdownColorName, number>>;
    readonly paletteText: Readonly<Record<MarkdownColorName, number>>;
    readonly fontFamily: string;
    readonly fontSize: number;
    readonly monospaceFontFamily: string;
    readonly titleFontFamily: string;
}

/**
 * The strings the native editor view draws or announces.
 *
 * @since 1.0.0
 */
export interface NativeEditorLabels
{
    readonly audio: string;
    readonly editableTableCells: string;
    readonly emptyToDoPlaceholder: string;
    readonly emptyTogglePlaceholder: string;
    readonly file: string;
    readonly fitTableWidth: string;
    readonly selectTableColumn: string;
    readonly selectTableRow: string;

    /** Accessibility label of a table cell; `{row}` and `{column}` are its 1-based position. */
    readonly tableCell: string;
    readonly tableActions: string;
    readonly tableOfContents: string;
    readonly tableSelectionEnd: string;
    readonly tableSelectionStart: string;
    readonly unknownFileSize: string;
}

/** Convert a CSS-style color to the ARGB integer the native view expects. */
function nativeColor(color: string): number
{
    const processed = processColor(color);
    return typeof processed === "number" ? processed : 0;
}

/** Convert each hue of a palette section to a native color. */
function nativePalette(
    section: Readonly<Record<MarkdownColorName, string>>
): Record<MarkdownColorName, number>
{
    return Object.fromEntries(
        markdownColorNames.map((hue: MarkdownColorName) => [ hue, nativeColor(section[ hue ]) ])
    ) as Record<MarkdownColorName, number>;
}

/**
 * Flatten a resolved {@link MarkdownTheme} into the primitives the native editor view reads.
 *
 * @since 1.0.0
 */
export function nativeEditorTheme(theme: MarkdownTheme): NativeEditorTheme
{
    const { document, editor, palette } = theme;
    const colors: Record<NativeEditorColorName, string> =
        {
            accent: document.accent,
            attachmentAccent: editor.attachment.accent,
            attachmentForeground: editor.attachment.foreground,
            attachmentIconSurface: editor.attachment.iconSurface,
            attachmentMuted: editor.attachment.muted,
            attachmentSurface: editor.attachment.surface,
            audioAccent: editor.audio.accent,
            audioOnAccent: editor.audio.onAccent,
            audioSurface: editor.audio.surface,
            audioWaveformInactive: editor.audio.waveformInactive,
            background: document.background,
            border: document.border,
            calloutBorder: editor.callout.border,
            foreground: document.foreground,
            inlineCodeBackground: document.inlineCodeBackground,
            inlineCodeForeground: document.inlineCodeForeground,
            mediaOverlay: editor.media.overlay,
            mediaOverlayIcon: editor.media.overlayIcon,
            mediaPlaceholder: editor.media.placeholder,
            mediaPlaceholderError: editor.media.placeholderError,
            muted: document.muted,
            onAccent: document.onAccent,
            placeholder: document.placeholder,
            shadow: editor.shadow,
            surface: document.surface,
            switchThumb: editor.switch.thumb,
            switchTrackOff: editor.switch.trackOff,
            switchTrackOn: editor.switch.trackOn,
            tableBorder: editor.table.border,
            tableControl: editor.table.control,
            tableHeaderBackground: editor.table.headerBackground
        };

    return {
        colors: Object.fromEntries(
            Object.entries(colors).map((entry: [ string, string ]) => [ entry[ 0 ], nativeColor(entry[ 1 ]) ])
        ) as Record<NativeEditorColorName, number>,
        fontFamily: document.fontFamily,
        fontSize: document.fontSize,
        monospaceFontFamily: document.monospaceFontFamily,
        paletteBackground: nativePalette(palette.background),
        paletteText: nativePalette(palette.text),
        titleFontFamily: document.titleFontFamily
    };
}

/**
 * Native epoch/revision transport and editor editing events.
 *
 * @since 1.0.0
 */
export interface NativeEditorProps extends ViewProps
{
    readonly snapshot: EditorSnapshot;
    readonly command?: EditorCommand;
    readonly onEdit?: (Event: { nativeEvent: EditorEvent }) => void;
    readonly onPageReferencePress?: (
        Event: { nativeEvent: NativePageReferencePressEvent }
    ) => void;
    /** Fired when a block that opens the actions sheet (e.g. a divider) is tapped. */
    readonly onBlockActionsPress?: (
        Event: { nativeEvent: NativeBlockActionsPressEvent }
    ) => void;

    /**
     * Fired whenever the native text layout's own content height changes, in dp -- lets the RN
     * side size this view to its true content (e.g. tall images) instead of clipping it.
     */
    readonly onContentSize?: (
        Event: { nativeEvent: NativeContentSizeEvent }
    ) => void;
    /** Optional glyph used by the native editor view when a page has no fetched icon. */
    readonly pageReferenceFallbackIcon?: string;

    /** Maximum rendered width of image and video blocks, in logical pixels. */
    readonly imageMaxWidth?: number;

    /** Colors and typography; see {@link nativeEditorTheme}. Defaults to the built-in light theme. */
    readonly theme?: NativeEditorTheme;

    /** Strings the view draws or announces. Defaults to the built-in English. */
    readonly labels?: NativeEditorLabels;
}

/**
 * Data emitted when a page reference is pressed in the native editor.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NativePageReferencePressEvent
{
    readonly id: string;
    readonly text: string;
    readonly url: string;
    readonly icon?: string;
}

/**
 * Data emitted when a block that opens the actions sheet (e.g. a divider) is tapped in the
 * native editor.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NativeBlockActionsPressEvent
{
    readonly id: string;
    readonly type: EditorBlock["type"];
    readonly scope?: EditorBlockActionScope;
    readonly selection?: EditorTableSelection;
}

/**
 * Data emitted when the native editor's own content height changes.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NativeContentSizeEvent
{
    /** The text layout's true content height, in dp. */
    readonly height: number;
}

/**
 * Android-only native coordinator. One shared buffer is intentional for this editor.
 *
 * @since 1.0.0
 */
const NativeEditor: ComponentType<NativeEditorProps> =
    requireNativeViewManager("Markdown");

export { NativeEditor };
