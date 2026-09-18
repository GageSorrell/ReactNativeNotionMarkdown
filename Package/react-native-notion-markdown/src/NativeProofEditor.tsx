/**
 * @module react-native-notion-markdown/NativeProofEditor
 *
 * @file      NativeProofEditor.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { ProofBlock, ProofCommand, ProofEvent, ProofSnapshot } from "./prototype.ts";
import type { ComponentType } from "react";
import type { ViewProps } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";

/**
 * Native epoch/revision transport and proof editing events.
 *
 * @since 1.0.0
 */
export interface NativeProofEditorProps extends ViewProps
{
    readonly snapshot: ProofSnapshot;
    readonly command?: ProofCommand;
    readonly dark?: boolean;
    readonly onEdit?: (Event: { nativeEvent: ProofEvent }) => void;
    readonly onPageReferencePress?: (
        Event: { nativeEvent: NativePageReferencePressEvent }
    ) => void;
    /** Fired when a block that opens the actions sheet (e.g. a divider) is tapped. */
    readonly onBlockActionsPress?: (
        Event: { nativeEvent: NativeBlockActionsPressEvent }
    ) => void;
    /** Optional glyph used by the native proof view when a page has no fetched icon. */
    readonly pageReferenceFallbackIcon?: string;

    /** Maximum rendered width of image and video blocks, in logical pixels. */
    readonly imageMaxWidth?: number;

    /**
     * Hint shown inside the empty child created for a toggle heading.
     */
    readonly emptyTogglePlaceholder?: string;
}

/**
 * Data emitted when a page reference is pressed in the native proof editor.
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
 * native proof editor.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NativeBlockActionsPressEvent
{
    readonly id: string;
    readonly type: ProofBlock["type"];
}

/**
 * Android-only native coordinator. One shared buffer is intentional for this proof.
 *
 * @since 1.0.0
 */
const NativeProofEditor: ComponentType<NativeProofEditorProps> =
    requireNativeViewManager("NotionMarkdown");

export { NativeProofEditor };
