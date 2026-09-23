/**
 * @module react-native-notion-markdown/NativeEditor
 *
 * @file      NativeEditor.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { EditorBlock, EditorCommand, EditorEvent, EditorSnapshot } from "./prototype.ts";
import type { ComponentType } from "react";
import type { ViewProps } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";

/**
 * Native epoch/revision transport and editor editing events.
 *
 * @since 1.0.0
 */
export interface NativeEditorProps extends ViewProps
{
    readonly snapshot: EditorSnapshot;
    readonly command?: EditorCommand;
    readonly dark?: boolean;
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

    /**
     * Hint shown inside the empty child created for a toggle heading.
     */
    readonly emptyTogglePlaceholder?: string;
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
