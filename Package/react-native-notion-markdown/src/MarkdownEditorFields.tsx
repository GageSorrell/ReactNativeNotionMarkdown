/**
 * Native wrappers for the per-field editable coordinator introduced in milestone four.
 * `MarkdownTextField` mounts one editable native field (a block's rich_text/caption/cell);
 * `MarkdownSelectionOverlay` draws and drags the coordinator-owned handles once a selection
 * spans more than one field. Both are registered by the same native module as `MarkdownEditorView`
 * (kept for milestone-one regression) under distinct view names. The native side omits the
 * `index` key entirely for fields without one, so it always arrives here as `undefined`,
 * matching `MarkdownSelectionPoint`'s convention elsewhere in the document model.
 *
 * @module react-native-notion-markdown/MarkdownEditorFields
 *
 * @file      MarkdownEditorFields.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type {
    MarkdownAutoScrollEvent,
    MarkdownCrossFieldSelectionEvent,
    MarkdownFieldBoundaryEvent,
    MarkdownFieldCommand,
    MarkdownFieldDescriptor,
    MarkdownFieldEditEvent,
    MarkdownFieldFocusEvent
} from "./document/fields.ts";
import type { ComponentType } from "react";
import type { ViewProps } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";

/**
 * Props accepted by one native editable field.
 *
 * @since 1.0.0
 */
export interface MarkdownTextFieldProps extends ViewProps
{
    readonly field: MarkdownFieldDescriptor;
    readonly command?: MarkdownFieldCommand;
    readonly dark?: boolean;
    readonly onEdit?: (event: { nativeEvent: MarkdownFieldEditEvent }) => void;
    readonly onBoundary?: (event: { nativeEvent: MarkdownFieldBoundaryEvent }) => void;
    readonly onFieldFocus?: (event: { nativeEvent: MarkdownFieldFocusEvent }) => void;
    readonly onFieldBlur?: (event: { nativeEvent: MarkdownFieldFocusEvent }) => void;
}

/**
 * One editable rich-text field -- a block's rich_text/caption/cell, not a whole document.
 * The document store remains authoritative; this field only edits its own text and marks
 * and reports revisioned edit and boundary transactions for the store to interpret.
 *
 * @since 1.0.0
 */
const MarkdownTextField: ComponentType<MarkdownTextFieldProps> =
    requireNativeViewManager("Markdown", "TextField");

/**
 * Props accepted by the coordinator-owned cross-field selection overlay.
 *
 * @since 1.0.0
 */
export interface MarkdownSelectionOverlayProps extends ViewProps
{
    readonly sessionId: string;
    readonly selection?: MarkdownCrossFieldSelectionEvent;
    readonly dark?: boolean;
    readonly onSelectionChange?: (event: { nativeEvent: MarkdownCrossFieldSelectionEvent }) => void;
    readonly onAutoScroll?: (event: { nativeEvent: MarkdownAutoScrollEvent }) => void;
}

/**
 * A transparent overlay that draws and drags selection handles once the active selection
 * spans more than one `MarkdownTextField`. Selection confined to one field uses that field's
 * own native handles instead. Actual list scrolling stays with the host; this overlay only
 * requests it via `onAutoScroll` while a handle is dragged near its edge.
 *
 * @since 1.0.0
 */
const MarkdownSelectionOverlay: ComponentType<MarkdownSelectionOverlayProps> =
    requireNativeViewManager("Markdown", "SelectionOverlay");

export { MarkdownSelectionOverlay, MarkdownTextField };
