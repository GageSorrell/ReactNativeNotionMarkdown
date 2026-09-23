/**
 * The domain command layer: insertion, deletion, conversion, movement, indentation,
 * formatting, links, mentions, Markdown shortcuts, and the Enter/Backspace/Delete/arrow
 * boundary semantics from a native field, all expressed as named functions over a
 * `MarkdownEditorStore` rather than ad hoc document splicing in UI code. Every command ends in
 * a `store.transact(...)` (and often a `store.setSelection(...)`), so undo/redo and selection
 * mapping keep working for free.
 *
 * @module react-native-notion-markdown/document/commands
 *
 * @file      commands.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    type FieldMarks,
    type MarkdownFieldBoundaryEvent,
    type MarkdownFieldEditEvent,
    type MarkdownFieldKind,
    type MarkdownFieldRangeMarkKind,
    type MarkdownInlineMark,
    fieldMarksToRichText,
    mergeFieldMarks,
    richTextToFieldMarks,
    setFieldValueMark,
    splitFieldMarks,
    toggleFieldRangeMark
} from "./fields.ts";
import type {
    MarkdownBlock,
    MarkdownDocument,
    MarkdownEditableField,
    MarkdownBlockType,
    MarkdownColor,
    MarkdownRichText,
    MarkdownRichTextItem,
    MarkdownSelection,
    MarkdownSelectionPoint,
    MarkdownTableSelection
} from "./types.ts";
import {
    appendMarkdownChild,
    findMarkdownBlockPath,
    getMarkdownBlock,
    getMarkdownBlockAtPath,
    getMarkdownBlockCaption,
    getMarkdownBlockCell,
    getMarkdownBlockRichText,
    indentMarkdownBlock,
    insertMarkdownBlockRelative,
    isMarkdownListBlockType,
    isMarkdownTextBearingBlockType,
    moveMarkdownBlock,
    outdentMarkdownBlock,
    removeMarkdownBlock,
    setMarkdownBlockCaption,
    setMarkdownBlockCell,
    setMarkdownBlockRichText,
    turnMarkdownBlockInto,
    updateMarkdownBlock
} from "./tree.ts";
import { getMarkdownEditableFields, markdownSelectionPositionOf } from "./selection.ts";
import type { MarkdownEditorStore } from "./store.ts";
import { getMarkdownBlockPayload, getMarkdownMetadata } from "../internal.ts";

let nextBlockSequence = 0;

/**
 * A fresh, unique editor id for a block created at runtime by a command, distinct from the
 * parser's and adapters' path-derived default ids.
 *
 * @since 1.0.0
 */
export function generateMarkdownBlockId(): string
{
    nextBlockSequence += 1;
    return `editor:${ Date.now().toString(36) }:${ nextBlockSequence.toString(36) }`;
}

/**
 * Read rich text from the given editable field on a block.
 *
 * @category Functions
 * @since 1.0.0
 */
function readFieldRichText(
    block: MarkdownBlock,
    field: MarkdownFieldKind,
    index: number | undefined
): MarkdownRichText | undefined
{
    if (field === "rich_text")
    {
        return getMarkdownBlockRichText(block);
    }

    if (field === "caption")
    {
        return getMarkdownBlockCaption(block);
    }

    return index === undefined
        ? undefined
        : getMarkdownBlockCell(block, index);
}

/**
 * Return a copy of the given block with rich text written to an editable field.
 *
 * @category Functions
 * @since 1.0.0
 */
function writeFieldRichText(
    block: MarkdownBlock,
    field: MarkdownFieldKind,
    index: number | undefined,
    richText: MarkdownRichText
): MarkdownBlock
{
    if (field === "rich_text")
    {
        return setMarkdownBlockRichText(block, richText);
    }

    if (field === "caption")
    {
        return setMarkdownBlockCaption(block, richText);
    }

    return index === undefined
        ? block
        : setMarkdownBlockCell(block, index, richText);
}

/**
 * Create a selection point for the given block field and offset.
 *
 * @category Functions
 * @since 1.0.0
 */
function fieldPoint(
    blockId: string,
    field: MarkdownFieldKind,
    index: number | undefined,
    offset: number
): MarkdownSelectionPoint
{
    return {
        blockId,
        field,
        offset,
        ...(index === undefined ? { } : { index })
    } as const;
}

/**
 * Create a collapsed selection at the given point.
 *
 * @category Functions
 * @since 1.0.0
 */
function collapsedSelection(point: MarkdownSelectionPoint): MarkdownSelection
{
    return { anchor: point, focus: point } as const;
}

/**
 * Check whether a selection field belongs to the given block.
 *
 * @category Functions
 * @since 1.0.0
 */
function sameField(
    field: MarkdownEditableField,
    blockId: string,
    kind: MarkdownFieldKind,
    index: number | undefined
): boolean
{
    return field.blockId === blockId && field.field === kind && field.index === index;
}

/* ------------------------------------------------------------------------------------------
 * Default block payloads and the insertable-block catalog
 * ---------------------------------------------------------------------------------------- */

/**
 * Build the default payload for a given block type.
 *
 * @category Functions
 * @since 1.0.0
 */
function defaultBlockPayload(type: MarkdownBlockType): Record<string, unknown>
{
    switch (type)
    {
        case "table":
            return {
                has_column_header: false,
                has_row_header: false,
                table_width: 3,
                cells: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => [ ]))
            };
        case "divider":
        case "table_of_contents":
            return { };
        case "to_do":
            return { checked: false, rich_text: [ ] };
        case "code":
            return { language: "plain text", rich_text: [ ] };
        case "equation":
            return { expression: "" };
        default:
            return { rich_text: [ ] };
    }
}

/**
 * Build a new, empty block of the given type with a fresh editor id.
 *
 * @since 1.0.0
 */
export function makeMarkdownBlock(
    type: MarkdownBlockType,
    id: string = generateMarkdownBlockId()
): MarkdownBlock
{
    return {
        __markdown_markdown: { editorId: id },
        id,
        type,
        [ type ]: defaultBlockPayload(type)
    } as unknown as MarkdownBlock;
}

/** Create the default editable 3×3 table required by the enhanced-Markdown editor. */
export function makeMarkdownTableBlock(id: string = generateMarkdownBlockId()): MarkdownBlock
{
    const rows = Array.from({ length: 3 }, (_: unknown, rowIndex: number) =>
        ({
            id: `${ id }:row:${ rowIndex }`,
            table_row: { cells: Array.from({ length: 3 }, () => [ ]) },
            type: "table_row"
        }));
    return {
        __markdown_markdown: {
            editorId: id,
            table: { fitPageWidth: false, headerColumn: false, headerRow: false }
        },
        children: rows,
        id,
        table: { has_column_header: false, has_row_header: false, table_width: 3 },
        type: "table"
    } as unknown as MarkdownBlock;
}

/** One entry in the Insert/Turn-into catalog: a block type a host UI can offer to create. */
export interface MarkdownInsertableBlockOption
{
    readonly type: MarkdownBlockType;
    readonly label: string;
    readonly category: "basic" | "list" | "advanced";
    readonly keywords: ReadonlyArray<string>;
}

export/**
       * The block types a host's Insert/"Turn into" panel can offer, grouped by category.  Composite
       * types that need more than a single empty payload are intentionally excluded because they
       * need richer flows than inserting one empty block.
       *
       * @category Constants
       * @since 1.0.0
       */
const markdownInsertableBlockCatalog: ReadonlyArray<MarkdownInsertableBlockOption> = [
    { category: "basic", keywords: [ "text", "text block" ], label: "Text block", type: "paragraph" },
    { category: "basic", keywords: [ "heading", "h1", "title" ], label: "Heading 1", type: "heading_1" },
    { category: "basic", keywords: [ "heading", "h2" ], label: "Heading 2", type: "heading_2" },
    { category: "basic", keywords: [ "heading", "h3" ], label: "Heading 3", type: "heading_3" },
    { category: "basic", keywords: [ "heading", "h4" ], label: "Heading 4", type: "heading_4" },
    {
        category: "list",
        keywords: [ "bullet", "list", "ul" ],
        label: "Bulleted list",
        type: "bulleted_list_item"
    },
    {
        category: "list",
        keywords: [ "number", "list", "ol" ],
        label: "Numbered list",
        type: "numbered_list_item"
    },
    { category: "list", keywords: [ "todo", "checkbox", "task" ], label: "To-do list", type: "to_do" },
    { category: "list", keywords: [ "toggle", "collapse" ], label: "Toggle list", type: "toggle" },
    { category: "basic", keywords: [ "quote", "blockquote" ], label: "Quote", type: "quote" },
    { category: "basic", keywords: [ "callout", "note" ], label: "Callout", type: "callout" },
    { category: "basic", keywords: [ "table", "grid", "rows", "columns" ], label: "Table", type: "table" },
    { category: "advanced", keywords: [ "code", "snippet" ], label: "Code", type: "code" },
    {
        category: "advanced",
        keywords: [ "equation", "math", "latex" ],
        label: "Block equation",
        type: "equation"
    },
    { category: "basic", keywords: [ "divider", "separator", "hr" ], label: "Divider", type: "divider" },
    {
        category: "advanced",
        keywords: [ "toc", "contents" ],
        label: "Table of contents",
        type: "table_of_contents"
    }
];

/**
 * Filter the insertable-block catalog for a "/" insert search query. An empty query returns
 * the full catalog.
 *
 * @since 1.0.0
 */
export function searchInsertableBlocks(query: string): ReadonlyArray<MarkdownInsertableBlockOption>
{
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) {return markdownInsertableBlockCatalog;}

    return markdownInsertableBlockCatalog.filter((option: MarkdownInsertableBlockOption) =>
        option.label.toLowerCase().includes(normalized) ||
        option.keywords.some((keyword: string) => keyword.includes(normalized)));
}

/* ------------------------------------------------------------------------------------------
 * Native field edit and boundary handling
 * ---------------------------------------------------------------------------------------- */

/**
 * Write a native field's current (text, marks) back into the document as real rich text, and
 * sync the store's selection to the field's reported caret. This is the point where a
 * `MarkdownFieldEditEvent` from `MarkdownTextField` becomes a real document transaction.
 *
 * @since 1.0.0
 */
export function applyFieldEdit(store: MarkdownEditorStore, event: MarkdownFieldEditEvent): void
{
    const richText = fieldMarksToRichText(event.text, event.marks);

    store.transact((document: MarkdownDocument) =>
        updateMarkdownBlock(document, event.blockId, (block: MarkdownBlock) =>
            writeFieldRichText(block, event.field, event.index, richText)), "user");

    store.setSelection({
        anchor: fieldPoint(event.blockId, event.field, event.index, event.selectionStart),
        focus: fieldPoint(event.blockId, event.field, event.index, event.selectionEnd)
    });
}

/**
 * Read field marks from a given block field.
 *
 * @category Functions
 * @since 1.0.0
 */
function fieldMarksOf(block: MarkdownBlock, field: MarkdownFieldKind, index: number | undefined): FieldMarks
{
    return richTextToFieldMarks(readFieldRichText(block, field, index) ?? [ ]);
}

/**
 * Find the block that immediately follows the given block within its own parent's children
 * (i.e. the next sibling at the same nesting depth), or `undefined` if there is none.
 *
 * @category Functions
 * @since 1.0.0
 */
function getNextSiblingBlock(document: MarkdownDocument, blockId: string): MarkdownBlock | undefined
{
    const path = findMarkdownBlockPath(document, blockId);
    if (path === undefined || path.length === 0) {return undefined;}

    const siblingPath = [ ...path.slice(0, -1), path[ path.length - 1 ]! + 1 ];
    return getMarkdownBlockAtPath(document, siblingPath);
}

/**
 * Enter splits a text block at the caret. A list item continues as a new sibling item of the
 * same type; an empty list item exits the list instead of splitting. Headings always split
 * into (heading, text block); every other text-bearing type continues as its own type, matching
 * "Enter splits text" as the default with headings and lists as the stated exceptions. As a
 * further exception, pressing Enter at the end of a list item (empty or not) that is immediately
 * followed by a sibling list item of the same type replaces the current item with two empty
 * text blocks instead of continuing (or exiting) the list, since the list already resumes right
 * after them.
 *
 * @since 1.0.0
 */
function handleEnter(store: MarkdownEditorStore, event: MarkdownFieldBoundaryEvent): void
{
    if (event.field !== "rich_text") {return;}

    const document = store.getDocument();
    const block = getMarkdownBlock(document, event.blockId);
    if (block === undefined || !isMarkdownTextBearingBlockType(block.type)) {return;}

    const { marks, text } = fieldMarksOf(block, "rich_text", undefined);

    if (isMarkdownListBlockType(block.type) && event.offset === text.length)
    {
        const nextSibling = getNextSiblingBlock(document, event.blockId);
        if (nextSibling !== undefined && nextSibling.type === block.type)
        {
            const firstBlockId = generateMarkdownBlockId();
            const secondBlockId = generateMarkdownBlockId();
            const firstBlock = makeMarkdownBlock("paragraph", firstBlockId);
            const secondBlock = makeMarkdownBlock("paragraph", secondBlockId);

            store.transact((doc: MarkdownDocument) =>
            {
                const withSecond = insertMarkdownBlockRelative(doc, event.blockId, secondBlock, "after");
                const withFirst = insertMarkdownBlockRelative(withSecond, event.blockId, firstBlock, "before");
                return removeMarkdownBlock(withFirst, event.blockId);
            }, "user");

            store.setSelection(collapsedSelection(fieldPoint(firstBlockId, "rich_text", undefined, 0)));
            return;
        }
    }

    if (isMarkdownListBlockType(block.type) && text.length === 0)
    {
        store.transact((doc: MarkdownDocument) =>
            updateMarkdownBlock(doc, event.blockId, (b: MarkdownBlock) =>
                turnMarkdownBlockInto(b, "paragraph")), "user");
        store.setSelection(collapsedSelection(fieldPoint(event.blockId, "rich_text", undefined, 0)));
        return;
    }

    const [ before, after ] = splitFieldMarks(text, marks, event.offset);
    const newType: MarkdownBlockType = block.type.startsWith("heading_") ? "paragraph" : block.type;
    const newBlockId = generateMarkdownBlockId();
    const newBlock = makeMarkdownBlock(newType, newBlockId);
    const newRichText = fieldMarksToRichText(after.text, after.marks);
    const filledNewBlock = writeFieldRichText(newBlock, "rich_text", undefined, newRichText);

    store.transact((doc: MarkdownDocument) =>
    {
        const withSplitCurrent = updateMarkdownBlock(doc, event.blockId, (b: MarkdownBlock) =>
            writeFieldRichText(b, "rich_text", undefined, fieldMarksToRichText(before.text, before.marks)));
        return insertMarkdownBlockRelative(withSplitCurrent, event.blockId, filledNewBlock, "after");
    }, "user");

    store.setSelection(collapsedSelection(fieldPoint(newBlockId, "rich_text", undefined, 0)));
}

/**
 * Backspace at the very start of a field. A nested list item outdents; a top-level list item
 * loses its list styling and becomes a text block; any other text-bearing block merges into the
 * previous editable field in document order, if that field also belongs to a text-bearing
 * block, reparenting the removed block's children onto the survivor.
 *
 * @since 1.0.0
 */
function handleBackspaceAtStart(store: MarkdownEditorStore, event: MarkdownFieldBoundaryEvent): void
{
    if (event.field !== "rich_text") {return;}

    const document = store.getDocument();
    const block = getMarkdownBlock(document, event.blockId);
    if (block === undefined) {return;}

    if (isMarkdownListBlockType(block.type))
    {
        const path = findMarkdownBlockPath(document, event.blockId);
        if (path !== undefined && path.length > 1)
        {
            store.transact((doc: MarkdownDocument) => outdentMarkdownBlock(doc, event.blockId), "user");
        }
        else
        {
            store.transact((doc: MarkdownDocument) =>
                updateMarkdownBlock(doc, event.blockId, (b: MarkdownBlock) =>
                    turnMarkdownBlockInto(b, "paragraph")), "user");
        }

        store.setSelection(collapsedSelection(fieldPoint(event.blockId, "rich_text", undefined, 0)));
        return;
    }

    const fields = getMarkdownEditableFields(document);
    const currentIndex = fields.findIndex((field: MarkdownEditableField) =>
        sameField(field, event.blockId, "rich_text", event.index));
    const previous = currentIndex > 0 ? fields[ currentIndex - 1 ] : undefined;
    if (previous === undefined || previous.field !== "rich_text") {return;}

    const previousBlock = getMarkdownBlock(document, previous.blockId);
    if (previousBlock === undefined || !isMarkdownTextBearingBlockType(previousBlock.type)) {return;}

    const joinOffset = previous.text.length;
    const mergedFieldMarks = mergeFieldMarks(
        richTextToFieldMarks(getMarkdownBlockRichText(previousBlock) ?? [ ]),
        richTextToFieldMarks(getMarkdownBlockRichText(block) ?? [ ])
    );
    const mergedChildren = [ ...(previousBlock.children ?? [ ]), ...(block.children ?? [ ]) ];
    const previousId = previous.blockId;

    store.transact((doc: MarkdownDocument) =>
    {
        const withoutCurrent = removeMarkdownBlock(doc, event.blockId);
        return updateMarkdownBlock(withoutCurrent, previousId, (b: MarkdownBlock) =>
        {
            const withRichText = writeFieldRichText(
                b,
                "rich_text",
                undefined,
                fieldMarksToRichText(mergedFieldMarks.text, mergedFieldMarks.marks)
            );
            return mergedChildren.length > 0 ? { ...withRichText, children: mergedChildren } : withRichText;
        });
    }, "user");

    store.setSelection(collapsedSelection(fieldPoint(previousId, "rich_text", undefined, joinOffset)));
}

/**
 * Delete (forward) at the very end of a field: the mirror image of Backspace-at-start, merging
 * the next editable field's block into the current one instead.
 *
 * @since 1.0.0
 */
function handleDeleteAtEnd(store: MarkdownEditorStore, event: MarkdownFieldBoundaryEvent): void
{
    if (event.field !== "rich_text") {return;}

    const document = store.getDocument();
    const block = getMarkdownBlock(document, event.blockId);
    if (block === undefined || !isMarkdownTextBearingBlockType(block.type)) {return;}

    const fields = getMarkdownEditableFields(document);
    const currentIndex = fields.findIndex((field: MarkdownEditableField) =>
        sameField(field, event.blockId, "rich_text", event.index));
    const next = currentIndex >= 0 ? fields[ currentIndex + 1 ] : undefined;
    if (next === undefined || next.field !== "rich_text") {return;}

    const nextBlock = getMarkdownBlock(document, next.blockId);
    if (nextBlock === undefined || !isMarkdownTextBearingBlockType(nextBlock.type)) {return;}

    const joinOffset = fieldMarksOf(block, "rich_text", undefined).text.length;
    const mergedFieldMarks = mergeFieldMarks(
        richTextToFieldMarks(getMarkdownBlockRichText(block) ?? [ ]),
        richTextToFieldMarks(getMarkdownBlockRichText(nextBlock) ?? [ ])
    );
    const mergedChildren = [ ...(block.children ?? [ ]), ...(nextBlock.children ?? [ ]) ];
    const nextId = next.blockId;

    store.transact((doc: MarkdownDocument) =>
    {
        const withoutNext = removeMarkdownBlock(doc, nextId);
        return updateMarkdownBlock(withoutNext, event.blockId, (b: MarkdownBlock) =>
        {
            const withRichText = writeFieldRichText(
                b,
                "rich_text",
                undefined,
                fieldMarksToRichText(mergedFieldMarks.text, mergedFieldMarks.marks)
            );
            return mergedChildren.length > 0 ? { ...withRichText, children: mergedChildren } : withRichText;
        });
    }, "user");

    store.setSelection(collapsedSelection(fieldPoint(event.blockId, "rich_text", undefined, joinOffset)));
}

/**
 * An arrow key at the top or bottom edge of a field moves focus to the previous or next
 * editable field in document order, landing near where the caret would visually continue.
 *
 * @since 1.0.0
 */
function handleVerticalBoundary(store: MarkdownEditorStore, event: MarkdownFieldBoundaryEvent): void
{
    const document = store.getDocument();
    const fields = getMarkdownEditableFields(document);
    const currentIndex = fields.findIndex((field: MarkdownEditableField) =>
        sameField(field, event.blockId, event.field, event.index));
    if (currentIndex < 0) {return;}

    const target = event.kind === "arrow-up-at-top" ? fields[ currentIndex - 1 ] : fields[ currentIndex + 1 ];
    if (target === undefined) {return;}

    const offset = event.kind === "arrow-up-at-top" ? target.text.length : 0;
    store.setSelection(collapsedSelection(fieldPoint(target.blockId, target.field, target.index, offset)));
}

/**
 * Dispatch a structural boundary event a native field could not resolve on its own.
 *
 * @since 1.0.0
 */
export function handleFieldBoundary(store: MarkdownEditorStore, event: MarkdownFieldBoundaryEvent): void
{
    switch (event.kind)
    {
        case "enter":
            handleEnter(store, event);
            return;
        case "backspace-at-start":
            handleBackspaceAtStart(store, event);
            return;
        case "delete-at-end":
            handleDeleteAtEnd(store, event);
            return;
        case "arrow-up-at-top":
        case "arrow-down-at-bottom":
            handleVerticalBoundary(store, event);
            return;
        default:
            return;
    }
}

/* ------------------------------------------------------------------------------------------
 * Insertion, deletion, conversion, movement, indentation
 * ---------------------------------------------------------------------------------------- */

/**
 * Insert a new text block immediately after a block and select its start.
 *
 * @since 1.0.0
 */
export function insertTextBlockAfter(store: MarkdownEditorStore, blockId: string): string
{
    return insertBlockOfType(store, blockId, "paragraph");
}

/**
 * Insert a new, empty block of the given type immediately after another block, and select
 * its start.
 *
 * @since 1.0.0
 */
export function insertBlockOfType(
    store: MarkdownEditorStore,
    afterBlockId: string,
    type: MarkdownBlockType
): string
{
    const id = generateMarkdownBlockId();
    const newBlock = makeMarkdownBlock(type, id);
    store.transact((document: MarkdownDocument) =>
        insertMarkdownBlockRelative(document, afterBlockId, newBlock, "after"), "user");
    store.setSelection(collapsedSelection(fieldPoint(id, "rich_text", undefined, 0)));
    return id;
}

interface TableRowValue
{
    cells: Array<MarkdownRichText>;
    source?: MarkdownBlock;
}

function tableRowsOf(block: MarkdownBlock): Array<TableRowValue>
{
    return (block.children ?? [ ]).filter((child: MarkdownBlock) => child.type === "table_row").map(
        (row: MarkdownBlock) => ({
            cells: Array.isArray(getMarkdownBlockPayload(row).cells)
                ? (getMarkdownBlockPayload(row).cells as Array<MarkdownRichText>).map(
                    (cell: MarkdownRichText) => [ ...cell ])
                : [ ],
            source: row
        })
    );
}

function replaceTableRows(block: MarkdownBlock, rows: Array<TableRowValue>): MarkdownBlock
{
    const children = rows.map((row: TableRowValue, rowIndex: number) => ({
        __markdown_markdown: row.source?.__markdown_markdown ?? {
            editorId: `${ block.id }:row:${ rowIndex }`
        },
        id: row.source?.id ?? `${ block.id }:row:${ rowIndex }`,
        table_row: { cells: row.cells },
        type: "table_row"
    } as unknown as MarkdownBlock));
    const payload = getMarkdownBlockPayload(block);
    return {
        ...block,
        children,
        table: { ...payload, table_width: Math.max(0, ...rows.map((row) => row.cells.length)) }
    } as unknown as MarkdownBlock;
}

function tableSelectionBounds(selection: MarkdownTableSelection): {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
}
{
    return {
        bottom: Math.max(selection.anchor.row, selection.focus.row),
        left: Math.min(selection.anchor.column, selection.focus.column),
        right: Math.max(selection.anchor.column, selection.focus.column),
        top: Math.min(selection.anchor.row, selection.focus.row)
    };
}

/** Insert a blank 3×3 table after a block and select its first cell. */
export function insertTableAfter(store: MarkdownEditorStore, blockId: string): string
{
    const table = makeMarkdownTableBlock();
    store.transact((document: MarkdownDocument) =>
        insertMarkdownBlockRelative(document, blockId, table, "after"), "user");
    store.setSelection(collapsedSelection({
        blockId: table.id,
        field: "cell",
        index: 0,
        offset: 0
    } as MarkdownSelectionPoint));
    return table.id;
}

function updateTable(store: MarkdownEditorStore, blockId: string, updater: (block: MarkdownBlock) => MarkdownBlock): void
{
    store.transact((document: MarkdownDocument) => updateMarkdownBlock(document, blockId, updater), "user");
}

/** Toggle one of the three table-level boolean options. */
export function toggleTableOption(
    store: MarkdownEditorStore,
    blockId: string,
    option: "fitPageWidth" | "headerRow" | "headerColumn"
): void
{
    updateTable(store, blockId, (block: MarkdownBlock) => {
        const metadata = getMarkdownMetadata(block);
        const table = metadata.table ?? { };
        const next = !Boolean(table[ option ]);
        return {
            ...block,
            __markdown_markdown: { ...metadata, table: { ...table, [ option ]: next } }
        } as MarkdownBlock;
    });
}

/** Insert an empty row while keeping a table at least one row high. */
export function insertTableRow(
    store: MarkdownEditorStore,
    blockId: string,
    index: number,
    position: "above" | "below" = "below"
): void
{
    updateTable(store, blockId, (block: MarkdownBlock) => {
        const rows = tableRowsOf(block);
        const width = Math.max(1, ...rows.map((row) => row.cells.length));
        const insertAt = Math.max(0, Math.min(rows.length, index + (position === "below" ? 1 : 0)));
        rows.splice(insertAt, 0, { cells: Array.from({ length: width }, () => [ ]) });
        return replaceTableRows(block, rows);
    });
}

/** Insert an empty column while keeping a table at least one column wide. */
export function insertTableColumn(
    store: MarkdownEditorStore,
    blockId: string,
    index: number,
    position: "left" | "right" = "right"
): void
{
    updateTable(store, blockId, (block: MarkdownBlock) => {
        const rows = tableRowsOf(block);
        const insertAt = Math.max(0, Math.min(Math.max(1, ...rows.map((row) => row.cells.length)),
            index + (position === "right" ? 1 : 0)));
        rows.forEach((row) => row.cells.splice(insertAt, 0, [ ]));
        return replaceTableRows(block, rows);
    });
}

/** Duplicate one row, including its rich text and cell formatting. */
export function duplicateTableRow(
    store: MarkdownEditorStore,
    selection: MarkdownTableSelection
): void
{
    updateTable(store, selection.blockId, (block: MarkdownBlock) => {
        const rows = tableRowsOf(block);
        const index = Math.max(0, Math.min(rows.length - 1, selection.anchor.row));
        const source = rows[ index ];
        if (source === undefined) { return block; }
        rows.splice(index + 1, 0, { cells: source.cells.map((cell) => [ ...cell ]) });
        const metadata = getMarkdownMetadata(block);
        const table = metadata.table ?? { };
        const rowColors = [ ...(table.rowColors ?? [ ]) ];
        rowColors.splice(index + 1, 0, rowColors[ index ]);
        return {
            ...replaceTableRows(block, rows),
            __markdown_markdown: { ...metadata, table: { ...table, rowColors } }
        } as MarkdownBlock;
    });
}

/** Duplicate one column, including its rich text and cell formatting. */
export function duplicateTableColumn(
    store: MarkdownEditorStore,
    selection: MarkdownTableSelection
): void
{
    updateTable(store, selection.blockId, (block: MarkdownBlock) => {
        const rows = tableRowsOf(block);
        const width = Math.max(1, ...rows.map((row) => row.cells.length));
        const index = Math.max(0, Math.min(width - 1, selection.anchor.column));
        rows.forEach((row) => {
            const source = row.cells[ index ] ?? [ ];
            row.cells.splice(index + 1, 0, [ ...source ]);
        });
        const metadata = getMarkdownMetadata(block);
        const table = metadata.table ?? { };
        const columnColors = [ ...(table.columnColors ?? [ ]) ];
        columnColors.splice(index + 1, 0, columnColors[ index ]);
        return {
            ...replaceTableRows(block, rows),
            __markdown_markdown: { ...metadata, table: { ...table, columnColors } }
        } as MarkdownBlock;
    });
}

/** Clear selected cell contents while retaining all table/row/cell colors. */
export function clearTableContents(
    store: MarkdownEditorStore,
    selection: MarkdownTableSelection
): void
{
    const bounds = tableSelectionBounds(selection);
    updateTable(store, selection.blockId, (block: MarkdownBlock) => {
        const rows = tableRowsOf(block);
        rows.forEach((row, rowIndex) => row.cells = row.cells.map((cell, columnIndex) =>
            rowIndex >= bounds.top && rowIndex <= bounds.bottom
                && columnIndex >= bounds.left && columnIndex <= bounds.right ? [ ] : cell));
        return replaceTableRows(block, rows);
    });
}

/** Set a table, row, column, or rectangular-cell color. */
export function setTableColor(
    store: MarkdownEditorStore,
    selection: MarkdownTableSelection,
    scope: "table" | "row" | "column" | "cell",
    color: MarkdownColor | undefined
): void
{
    const bounds = tableSelectionBounds(selection);
    updateTable(store, selection.blockId, (block: MarkdownBlock) => {
        const metadata = getMarkdownMetadata(block);
        const current = metadata.table ?? { };
        if (scope === "table")
        {
            return { ...block, __markdown_markdown: { ...metadata, table: { ...current, tableColor: color } } } as MarkdownBlock;
        }
        const rowColors = [ ...(current.rowColors ?? [ ]) ];
        const columnColors = [ ...(current.columnColors ?? [ ]) ];
        const cellColors: Array<Array<MarkdownColor | undefined>> = Array.isArray(current.cellColors?.[ 0 ])
            ? (current.cellColors as Array<Array<MarkdownColor | undefined>>).map((row) => [ ...row ])
            : [ ];
        if (scope === "row")
        {
            for (let row = bounds.top; row <= bounds.bottom; row += 1) rowColors[ row ] = color;
        }
        if (scope === "column")
        {
            for (let column = bounds.left; column <= bounds.right; column += 1) columnColors[ column ] = color;
        }
        if (scope === "cell")
        {
            for (let row = bounds.top; row <= bounds.bottom; row += 1)
            {
                for (let column = bounds.left; column <= bounds.right; column += 1)
                {
                    const rowColorsAt = [ ...(cellColors[ row ] ?? [ ]) ];
                    rowColorsAt[ column ] = color;
                    cellColors[ row ] = rowColorsAt;
                }
            }
        }
        return {
            ...block,
            __markdown_markdown: {
                ...metadata,
                table: { ...current, cellColors, columnColors, rowColors }
            }
        } as MarkdownBlock;
    });
}

/**
 * Delete a block by its stable editor identity.
 *
 * @since 1.0.0
 */
export function deleteBlock(store: MarkdownEditorStore, blockId: string): void
{
    store.transact((document: MarkdownDocument) => removeMarkdownBlock(document, blockId), "user");
}

/**
 * Convert a block to a different type, carrying its `rich_text` forward.
 *
 * @since 1.0.0
 */
export function turnInto(store: MarkdownEditorStore, blockId: string, type: MarkdownBlockType): void
{
    store.transact((document: MarkdownDocument) =>
        updateMarkdownBlock(document, blockId, (block: MarkdownBlock) =>
            turnMarkdownBlockInto(block, type)), "user");
}

/**
 * Swap a block with its previous or next sibling.
 *
 * @since 1.0.0
 */
export function moveBlock(store: MarkdownEditorStore, blockId: string, direction: "up" | "down"): void
{
    store.transact((document: MarkdownDocument) => moveMarkdownBlock(document, blockId, direction), "user");
}

/**
 * Nest a block as the last child of its immediately preceding sibling.
 *
 * @since 1.0.0
 */
export function indent(store: MarkdownEditorStore, blockId: string): void
{
    store.transact((document: MarkdownDocument) => indentMarkdownBlock(document, blockId), "user");
}

/**
 * Un-nest a block to become the next sibling of its own parent.
 *
 * @since 1.0.0
 */
export function outdent(store: MarkdownEditorStore, blockId: string): void
{
    store.transact((document: MarkdownDocument) => outdentMarkdownBlock(document, blockId), "user");
}

/**
 * Regenerate the identifiers of a given block and all of its descendants.
 *
 * @category Functions
 * @since 1.0.0
 */
function regenerateBlockIds(block: MarkdownBlock): MarkdownBlock
{
    const id = generateMarkdownBlockId();
    const metadata = getMarkdownMetadata(block);
    return {
        ...block,
        __markdown_markdown: { ...metadata, editorId: id },
        children: block.children?.map(regenerateBlockIds),
        id
    } as MarkdownBlock;
}

/**
 * Duplicate a block (and its descendants) as the next sibling, with freshly generated editor
 * ids throughout so the copy is independently editable.
 *
 * @since 1.0.0
 */
export function duplicateBlock(store: MarkdownEditorStore, blockId: string): string | undefined
{
    const document = store.getDocument();
    const block = getMarkdownBlock(document, blockId);
    if (block === undefined) {return undefined;}

    const clone = regenerateBlockIds(block);
    const cloneId = clone.id;
    store.transact((doc: MarkdownDocument) => insertMarkdownBlockRelative(doc, blockId, clone, "after"), "user");
    return cloneId;
}

/**
 * Append a new, empty block of the given type as the last child of a block.
 *
 * @since 1.0.0
 */
export function appendChildBlock(
    store: MarkdownEditorStore,
    parentBlockId: string,
    type: MarkdownBlockType
): string
{
    const id = generateMarkdownBlockId();
    const newBlock = makeMarkdownBlock(type, id);
    store.transact((document: MarkdownDocument) =>
        appendMarkdownChild(document, parentBlockId, newBlock), "user");
    store.setSelection(collapsedSelection(fieldPoint(id, "rich_text", undefined, 0)));
    return id;
}

/* ------------------------------------------------------------------------------------------
 * Range formatting: bold/italic/underline/strikethrough/code, color, and links
 * ---------------------------------------------------------------------------------------- */

/**
 * Apply a range mark operation to the current selection in the editor store.
 *
 * @category Functions
 * @since 1.0.0
 */
function applyRangeMarkCommand(
    store: MarkdownEditorStore,
    apply: (marks: ReadonlyArray<MarkdownInlineMark>, start: number, end: number) => Array<MarkdownInlineMark>
): void
{
    const selection = store.getSelection();
    if (selection === undefined) {return;}

    store.transact((document: MarkdownDocument) =>
    {
        const startPos = Math.min(
            markdownSelectionPositionOf(document, selection.anchor),
            markdownSelectionPositionOf(document, selection.focus)
        );
        const endPos = Math.max(
            markdownSelectionPositionOf(document, selection.anchor),
            markdownSelectionPositionOf(document, selection.focus)
        );
        if (startPos === endPos) {return document;}

        let next = document;
        let cursor = 0;

        for (const field of getMarkdownEditableFields(document))
        {
            const fieldStart = cursor;
            const fieldEnd = cursor + field.text.length;
            cursor = fieldEnd + 1;

            const overlapStart = Math.max(startPos, fieldStart);
            const overlapEnd = Math.min(endPos, fieldEnd);
            if (overlapStart >= overlapEnd) {continue;}

            const block = getMarkdownBlock(next, field.blockId);
            if (block === undefined) {continue;}

            const currentRichText = readFieldRichText(block, field.field, field.index);
            if (currentRichText === undefined) {continue;}

            const flattened = richTextToFieldMarks(currentRichText);
            const nextMarks = apply(flattened.marks, overlapStart - fieldStart, overlapEnd - fieldStart);
            const nextRichText = fieldMarksToRichText(flattened.text, nextMarks);
            next = updateMarkdownBlock(next, field.blockId, (b: MarkdownBlock) =>
                writeFieldRichText(b, field.field, field.index, nextRichText));
        }

        return next;
    }, "user");
}

/**
 * Toggle a boolean formatting mark over the current selection, across every field it touches.
 * A no-op when the selection is collapsed or absent -- formatting a caret with no range applies
 * to the host's own pending-mark state, not the document, and belongs to the UI layer.
 *
 * @since 1.0.0
 */
export function toggleMark(store: MarkdownEditorStore, kind: MarkdownFieldRangeMarkKind): void
{
    applyRangeMarkCommand(store, (marks: ReadonlyArray<MarkdownInlineMark>, start: number, end: number) =>
        toggleFieldRangeMark(marks, kind, start, end));
}

/**
 * Set or clear the text color/background over the current selection, across every field it
 * touches.
 *
 * @since 1.0.0
 */
export function setColor(store: MarkdownEditorStore, color: MarkdownColor | undefined): void
{
    applyRangeMarkCommand(store, (marks: ReadonlyArray<MarkdownInlineMark>, start: number, end: number) =>
        setFieldValueMark(marks, "color", start, end, color));
}

/**
 * Set or clear a link over the current selection, across every field it touches.
 *
 * @since 1.0.0
 */
export function setLink(store: MarkdownEditorStore, url: string | undefined): void
{
    applyRangeMarkCommand(store, (marks: ReadonlyArray<MarkdownInlineMark>, start: number, end: number) =>
        setFieldValueMark(marks, "link", start, end, url));
}

/* ------------------------------------------------------------------------------------------
 * Mentions
 * ---------------------------------------------------------------------------------------- */

/** A resolved mention candidate ready to insert, typically from a host's "@" search results. */
export interface MarkdownMentionCandidate
{
    readonly kind: "user" | "page" | "database" | "data_source" | "agent";
    readonly id: string;
    readonly label: string;
    readonly url?: string;
}

/**
 * Convert a mention candidate into the corresponding rich-text item.
 *
 * @category Functions
 * @since 1.0.0
 */
function mentionRichTextItem(candidate: MarkdownMentionCandidate): MarkdownRichTextItem
{
    const mention = candidate.kind === "user"
        ? { type: "user", user: { id: candidate.id } }
        : { [ candidate.kind ]: { id: candidate.id }, type: candidate.kind };

    return {
        __markdown_markdown:
        {
            mention:
            {
                kind: candidate.kind,
                label: candidate.label,
                ...(candidate.url === undefined ? { } : { url: candidate.url })
            }
        },
        mention,
        type: "mention"
    } as MarkdownRichTextItem;
}

/**
 * Insert a resolved mention at a field position, replacing any selected text there. The
 * command layer's entry point for a host's "@" mention search -- resolving candidates from a
 * query is the host's own responsibility, this only splices the chosen one in.
 *
 * @since 1.0.0
 */
export function insertMention(
    store: MarkdownEditorStore,
    point: MarkdownSelectionPoint,
    candidate: MarkdownMentionCandidate,
    selectionEnd: number = point.offset
): void
{
    const item = mentionRichTextItem(candidate);
    const start = Math.min(point.offset, selectionEnd);
    const end = Math.max(point.offset, selectionEnd);

    store.transact((document: MarkdownDocument) =>
        updateMarkdownBlock(document, point.blockId, (block: MarkdownBlock) =>
        {
            const flattened = fieldMarksOf(block, point.field, point.index);
            const [ before, rest ] = splitFieldMarks(flattened.text, flattened.marks, start);
            const [ , after ] = splitFieldMarks(rest.text, rest.marks, end - start);
            const atomMark: MarkdownInlineMark =
                { atomKind: "mention", end: 1, item, kind: "atom", label: candidate.label, start: 0 };
            const atom: FieldMarks = { marks: [ atomMark ], text: "￼" };
            const merged = mergeFieldMarks(mergeFieldMarks(before, atom), after);
            const mergedRichText = fieldMarksToRichText(merged.text, merged.marks);
            return writeFieldRichText(block, point.field, point.index, mergedRichText);
        }), "user");

    store.setSelection(collapsedSelection(fieldPoint(point.blockId, point.field, point.index, start + 1)));
}

/* ------------------------------------------------------------------------------------------
 * Markdown shortcuts
 * ---------------------------------------------------------------------------------------- */

/** A Markdown shortcut match: convert the block and keep the text typed after the trigger. */
export interface MarkdownShortcutMatch
{
    readonly type: MarkdownBlockType;
    readonly remainder: string;
}

interface MarkdownShortcutRule
{
    readonly pattern: RegExp;
    readonly type: MarkdownBlockType;
}

const markdownShortcuts: ReadonlyArray<MarkdownShortcutRule> = [
    { pattern: /^#\s(.*)$/, type: "heading_1" },
    { pattern: /^##\s(.*)$/, type: "heading_2" },
    { pattern: /^###\s(.*)$/, type: "heading_3" },
    { pattern: /^####\s(.*)$/, type: "heading_4" },
    { pattern: /^[-*]\s(.*)$/, type: "bulleted_list_item" },
    { pattern: /^1\.\s(.*)$/, type: "numbered_list_item" },
    { pattern: /^\[\s?]\s(.*)$/, type: "to_do" },
    { pattern: /^>\s(.*)$/, type: "quote" }
];

/**
 * Test a field's current plain text against the Markdown shortcut patterns, longest trigger
 * first (headings before a bare "#", for example) so the most specific match wins.
 *
 * @since 1.0.0
 */
export function matchMarkdownShortcut(plainText: string): MarkdownShortcutMatch | undefined
{
    for (const shortcut of markdownShortcuts)
    {
        const match = plainText.match(shortcut.pattern);
        if (match !== null) {return { remainder: match[ 1 ] ?? "", type: shortcut.type };}
    }

    return undefined;
}

/**
 * Apply a matched Markdown shortcut: convert the block and replace its text with the remainder
 * typed after the trigger, selecting the end of that remainder.
 *
 * @since 1.0.0
 */
export function applyMarkdownShortcut(
    store: MarkdownEditorStore,
    blockId: string,
    match: MarkdownShortcutMatch
): void
{
    const remainderRichText: MarkdownRichText = match.remainder.length === 0
        ? [ ]
        : [ { text: { content: match.remainder }, type: "text" } as MarkdownRichTextItem ];

    store.transact((document: MarkdownDocument) =>
        updateMarkdownBlock(document, blockId, (block: MarkdownBlock) =>
        {
            const converted = turnMarkdownBlockInto(block, match.type);
            return writeFieldRichText(converted, "rich_text", undefined, remainderRichText);
        }), "user");

    const point = fieldPoint(blockId, "rich_text", undefined, match.remainder.length);
    store.setSelection(collapsedSelection(point));
}

/* ------------------------------------------------------------------------------------------
 * The bound command bundle
 * ---------------------------------------------------------------------------------------- */

/** The full command surface, bound to one document store. */
export interface MarkdownCommands
{
    applyFieldEdit(event: MarkdownFieldEditEvent): void;
    handleFieldBoundary(event: MarkdownFieldBoundaryEvent): void;
    insertTextBlockAfter(blockId: string): string;
    insertBlockOfType(afterBlockId: string, type: MarkdownBlockType): string;
    insertTableAfter(blockId: string): string;
    toggleTableOption(blockId: string, option: "fitPageWidth" | "headerRow" | "headerColumn"): void;
    insertTableRow(blockId: string, index: number, position?: "above" | "below"): void;
    insertTableColumn(blockId: string, index: number, position?: "left" | "right"): void;
    duplicateTableRow(selection: MarkdownTableSelection): void;
    duplicateTableColumn(selection: MarkdownTableSelection): void;
    clearTableContents(selection: MarkdownTableSelection): void;
    setTableColor(
        selection: MarkdownTableSelection,
        scope: "table" | "row" | "column" | "cell",
        color: MarkdownColor | undefined
    ): void;
    appendChildBlock(parentBlockId: string, type: MarkdownBlockType): string;
    deleteBlock(blockId: string): void;
    turnInto(blockId: string, type: MarkdownBlockType): void;
    moveBlock(blockId: string, direction: "up" | "down"): void;
    indent(blockId: string): void;
    outdent(blockId: string): void;
    duplicateBlock(blockId: string): string | undefined;
    toggleMark(kind: MarkdownFieldRangeMarkKind): void;
    setColor(color: MarkdownColor | undefined): void;
    setLink(url: string | undefined): void;
    insertMention(
        point: MarkdownSelectionPoint,
        candidate: MarkdownMentionCandidate,
        selectionEnd?: number
    ): void;
    applyMarkdownShortcut(blockId: string, match: MarkdownShortcutMatch): void;
    setSelection(selection: MarkdownSelection | undefined): void;
    undo(): boolean;
    redo(): boolean;
}

/**
 * Bind the full command surface to one document store.
 *
 * @since 1.0.0
 */
export function createMarkdownCommands(store: MarkdownEditorStore): MarkdownCommands
{
    return {
        appendChildBlock: (parentBlockId: string, type: MarkdownBlockType) =>
            appendChildBlock(store, parentBlockId, type),
        applyFieldEdit: (event: MarkdownFieldEditEvent) => applyFieldEdit(store, event),
        applyMarkdownShortcut: (blockId: string, match: MarkdownShortcutMatch) =>
            applyMarkdownShortcut(store, blockId, match),
        deleteBlock: (blockId: string) => deleteBlock(store, blockId),
        duplicateBlock: (blockId: string) => duplicateBlock(store, blockId),
        handleFieldBoundary: (event: MarkdownFieldBoundaryEvent) => handleFieldBoundary(store, event),
        indent: (blockId: string) => indent(store, blockId),
        insertBlockOfType: (afterBlockId: string, type: MarkdownBlockType) =>
            insertBlockOfType(store, afterBlockId, type),
        insertTableAfter: (blockId: string) => insertTableAfter(store, blockId),
        toggleTableOption: (
            blockId: string,
            option: "fitPageWidth" | "headerRow" | "headerColumn"
        ) => toggleTableOption(store, blockId, option),
        insertTableRow: (blockId: string, index: number, position?: "above" | "below") =>
            insertTableRow(store, blockId, index, position),
        insertTableColumn: (blockId: string, index: number, position?: "left" | "right") =>
            insertTableColumn(store, blockId, index, position),
        duplicateTableRow: (selection: MarkdownTableSelection) => duplicateTableRow(store, selection),
        duplicateTableColumn: (selection: MarkdownTableSelection) => duplicateTableColumn(store, selection),
        clearTableContents: (selection: MarkdownTableSelection) => clearTableContents(store, selection),
        setTableColor: (
            selection: MarkdownTableSelection,
            scope: "table" | "row" | "column" | "cell",
            color: MarkdownColor | undefined
        ) => setTableColor(store, selection, scope, color),
        insertMention: (
            point: MarkdownSelectionPoint,
            candidate: MarkdownMentionCandidate,
            selectionEnd?: number
        ) => insertMention(store, point, candidate, selectionEnd),
        insertTextBlockAfter: (blockId: string) => insertTextBlockAfter(store, blockId),
        moveBlock: (blockId: string, direction: "up" | "down") => moveBlock(store, blockId, direction),
        outdent: (blockId: string) => outdent(store, blockId),
        redo: () => store.redo(),
        setColor: (color: MarkdownColor | undefined) => setColor(store, color),
        setLink: (url: string | undefined) => setLink(store, url),
        setSelection: (selection: MarkdownSelection | undefined) => store.setSelection(selection),
        toggleMark: (kind: MarkdownFieldRangeMarkKind) => toggleMark(store, kind),
        turnInto: (blockId: string, type: MarkdownBlockType) => turnInto(store, blockId, type),
        undo: () => store.undo()
    };
}
