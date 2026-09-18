/**
 * Selection mapping across the recursive document tree.
 *
 * @module react-native-notion-markdown/document/selection
 *
 * @file      selection.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    type NotionBlock,
    type NotionDocument,
    type NotionEditableField,
    type NotionSelectionPoint
} from "./types.ts";
import { asRecord, getNotionBlockPayload, getNotionMarkdownMetadata } from "../internal.ts";

/**
 * Read display text from the given rich-text value.
 *
 * @category Functions
 * @since 1.0.0
 */
function itemText(value: unknown): string
{
    const item = asRecord(value);
    const text = asRecord(item.text).content;

    if (typeof text === "string")
    {
        return text;
    }

    if (typeof item.plain_text === "string")
    {
        return item.plain_text;
    }

    if (typeof asRecord(item.equation).expression === "string")
    {
        return String(asRecord(item.equation).expression);
    }

    const mention = asRecord(getNotionMarkdownMetadata(item).mention);
    return typeof mention.label === "string" ? String(mention.label) : "";
}

/**
 * Join the display text of the given rich-text collection.
 *
 * @category Functions
 * @since 1.0.0
 */
function richTextText(value: unknown): string
{
    return Array.isArray(value) ? value.map(itemText).join("") : "";
}

/**
 * Return the editor identifier for a given block.
 *
 * @category Functions
 * @since 1.0.0
 */
function editorId(block: NotionBlock): string
{
    const meta = getNotionMarkdownMetadata(block);
    return typeof meta.editorId === "string" ? meta.editorId : block.id;
}

/**
 * Return the stable editor identity for a block.
 *
 * @since 1.0.0
 */
export function getNotionEditorBlockId(block: NotionBlock): string
{
    return editorId(block);
}

/**
 * Return editable fields exposed by a given block.
 *
 * @category Functions
 * @since 1.0.0
 */
function fields(block: NotionBlock): Array<NotionEditableField>
{
    const value = getNotionBlockPayload(block);

    const result: Array<NotionEditableField> = [ ];

    if (Array.isArray(value.rich_text))
    {
        result.push({ blockId: editorId(block), field: "rich_text", text: richTextText(value.rich_text) });
    }

    if (Array.isArray(value.caption))
    {
        result.push({ blockId: editorId(block), field: "caption", text: richTextText(value.caption) });
    }

    if (block.type === "table_row" && Array.isArray(value.cells))
    {
        value.cells.forEach((cell: unknown, index: number) => result.push({
            blockId: editorId(block),
            field: "cell",
            index,
            text: richTextText(cell)
        }));
    }
    return result;
}

/**
 * Walk the given block tree and append its editable fields to the result.
 *
 * @category Functions
 * @since 1.0.0
 */
function walk(blocks: Array<NotionBlock>, result: Array<NotionEditableField>): void
{
    for (const block of blocks)
    {
        result.push(...fields(block));
        if (block.children !== undefined) {walk(block.children, result);}
    }
}

/**
 * List editable fields in document order, including nested and table-cell fields.
 *
 * @since 1.0.0
 */
export function getNotionEditableFields(document: NotionDocument): Array<NotionEditableField>
{
    const result: Array<NotionEditableField> = [ ];
    walk(document.blocks, result);
    return result;
}

/**
 * Create a selection point at the given field offset.
 *
 * @category Functions
 * @since 1.0.0
 */
function point(field: NotionEditableField, offset: number): NotionSelectionPoint
{
    return {
        blockId: field.blockId,
        field: field.field,
        ...(field.index === undefined ? { } : { index: field.index }),
        offset: Math.max(0, Math.min(field.text.length, offset))
    };
}

/**
 * Map a flattened UTF-16 position to a field endpoint. Separators occupy one unit.
 *
 * @throws {Error} When the given document has no editable fields.
 *
 * @since 1.0.0
 */
export function notionSelectionPointAt(document: NotionDocument, position: number): NotionSelectionPoint
{
    const fieldsInOrder = getNotionEditableFields(document);
    if (fieldsInOrder.length === 0) {throw new Error("A document needs at least one editable field.");}
    let remaining = Math.max(0, position);
    for (const field of fieldsInOrder)
    {
        if (remaining <= field.text.length) {return point(field, remaining);}
        remaining -= field.text.length + 1;
    }
    const last = fieldsInOrder[fieldsInOrder.length - 1]!;
    return point(last, last.text.length);
}

/**
 * Map a field endpoint to its flattened UTF-16 position.
 *
 * @throws {Error} When the selection endpoint is not in the given document.
 *
 * @since 1.0.0
 */
export function notionSelectionPositionOf(
    document: NotionDocument,
    selectionPoint: NotionSelectionPoint
): number
{
    let position = 0;
    for (const field of getNotionEditableFields(document))
    {
        if (
            field.blockId === selectionPoint.blockId &&
            field.field === selectionPoint.field &&
            field.index === selectionPoint.index
        )
        {
            return position + Math.max(0, Math.min(field.text.length, selectionPoint.offset));
        }

        position += field.text.length + 1;
    }

    throw new Error(`The selection endpoint '${ selectionPoint.blockId }' is not present in the document.`);
}

/**
 * Map an existing endpoint to a replacement document, clamping when its field disappeared.
 *
 * @throws {Error} When the given document has no editable fields.
 *
 * @since 1.0.0
 */
export function mapNotionSelectionPoint(
    document: NotionDocument,
    selectionPoint: NotionSelectionPoint
): NotionSelectionPoint
{
    const fieldsInOrder = getNotionEditableFields(document);
    const exact = fieldsInOrder.find((field: NotionEditableField) =>
        field.blockId === selectionPoint.blockId &&
        field.field === selectionPoint.field &&
        field.index === selectionPoint.index
    );

    if (exact !== undefined)
    {
        return point(exact, selectionPoint.offset);
    }

    if (fieldsInOrder.length === 0)
    {
        throw new Error("A document needs at least one editable field.");
    }

    return point(
        fieldsInOrder[fieldsInOrder.length - 1]!,
        fieldsInOrder[fieldsInOrder.length - 1]!.text.length
    );
}
