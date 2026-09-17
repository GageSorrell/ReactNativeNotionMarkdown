/**
 * Native wrappers for the per-field editable coordinator introduced in milestone four.
 * `NotionTextField` mounts one editable native field (a block's rich_text/caption/cell);
 * `NotionSelectionOverlay` draws and drags the coordinator-owned handles once a selection
 * spans more than one field. Both are registered by the same native module as `NotionProofView`
 * (kept for milestone-one regression) under distinct view names. The native side omits the
 * `index` key entirely for fields without one, so it always arrives here as `undefined`,
 * matching `NotionSelectionPoint`'s convention elsewhere in the document model.
 *
 * @module react-native-notion-markdown/NotionEditorFields
 *
 * @file      NotionEditorFields.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type {
    NotionAutoScrollEvent,
    NotionCrossFieldSelectionEvent,
    NotionFieldBoundaryEvent,
    NotionFieldCommand,
    NotionFieldDescriptor,
    NotionFieldEditEvent,
    NotionFieldFocusEvent
} from "./document/fields.ts";
import type { ComponentType } from "react";
import type { ViewProps } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";

/**
 * Props accepted by one native editable field.
 *
 * @since 1.0.0
 */
export interface NotionTextFieldProps extends ViewProps
{
    readonly field: NotionFieldDescriptor;
    readonly command?: NotionFieldCommand;
    readonly dark?: boolean;
    readonly onEdit?: (event: { nativeEvent: NotionFieldEditEvent }) => void;
    readonly onBoundary?: (event: { nativeEvent: NotionFieldBoundaryEvent }) => void;
    readonly onFieldFocus?: (event: { nativeEvent: NotionFieldFocusEvent }) => void;
    readonly onFieldBlur?: (event: { nativeEvent: NotionFieldFocusEvent }) => void;
}

/**
 * One editable rich-text field -- a block's rich_text/caption/cell, not a whole document.
 * The document store remains authoritative; this field only edits its own text and marks
 * and reports revisioned edit and boundary transactions for the store to interpret.
 *
 * @since 1.0.0
 */
const NotionTextField: ComponentType<NotionTextFieldProps> =
    requireNativeViewManager("NotionMarkdown", "TextField");

/**
 * Props accepted by the coordinator-owned cross-field selection overlay.
 *
 * @since 1.0.0
 */
export interface NotionSelectionOverlayProps extends ViewProps
{
    readonly sessionId: string;
    readonly selection?: NotionCrossFieldSelectionEvent;
    readonly dark?: boolean;
    readonly onSelectionChange?: (event: { nativeEvent: NotionCrossFieldSelectionEvent }) => void;
    readonly onAutoScroll?: (event: { nativeEvent: NotionAutoScrollEvent }) => void;
}

/**
 * A transparent overlay that draws and drags selection handles once the active selection
 * spans more than one `NotionTextField`. Selection confined to one field uses that field's
 * own native handles instead. Actual list scrolling stays with the host; this overlay only
 * requests it via `onAutoScroll` while a handle is dragged near its edge.
 *
 * @since 1.0.0
 */
const NotionSelectionOverlay: ComponentType<NotionSelectionOverlayProps> =
    requireNativeViewManager("NotionMarkdown", "SelectionOverlay");

export { NotionSelectionOverlay, NotionTextField };
