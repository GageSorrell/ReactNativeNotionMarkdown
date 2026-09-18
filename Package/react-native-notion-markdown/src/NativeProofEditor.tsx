/**
 * @module react-native-notion-markdown/NativeProofEditor
 *
 * @file      NativeProofEditor.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { ProofCommand, ProofEvent, ProofSnapshot } from "./prototype.ts";
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
    /** Optional glyph used by the native proof view when a page has no fetched icon. */
    readonly pageReferenceFallbackIcon?: string;

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
 * Android-only native coordinator. One shared buffer is intentional for this proof.
 *
 * @since 1.0.0
 */
const NativeProofEditor: ComponentType<NativeProofEditorProps> =
    requireNativeViewManager("NotionMarkdown");

export { NativeProofEditor };
