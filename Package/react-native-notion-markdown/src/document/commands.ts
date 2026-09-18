/**
 * The domain command layer: insertion, deletion, conversion, movement, indentation,
 * formatting, links, mentions, Markdown shortcuts, and the Enter/Backspace/Delete/arrow
 * boundary semantics from a native field, all expressed as named functions over a
 * `NotionEditorStore` rather than ad hoc document splicing in UI code. Every command ends in
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
    type NotionFieldBoundaryEvent,
    type NotionFieldEditEvent,
    type NotionFieldKind,
    type NotionFieldRangeMarkKind,
    type NotionInlineMark,
    fieldMarksToRichText,
    mergeFieldMarks,
    richTextToFieldMarks,
    setFieldValueMark,
    splitFieldMarks,
    toggleFieldRangeMark
} from "./fields.ts";
import type {
    NotionBlock,
    NotionDocument,
    NotionEditableField,
    NotionMarkdownBlockType,
    NotionMarkdownColor,
    NotionRichText,
    NotionRichTextItem,
    NotionSelection,
    NotionSelectionPoint
} from "./types.ts";
import {
    appendNotionChild,
    findNotionBlockPath,
    getNotionBlock,
    getNotionBlockAtPath,
    getNotionBlockCaption,
    getNotionBlockCell,
    getNotionBlockRichText,
    indentNotionBlock,
    insertNotionBlockRelative,
    isNotionListBlockType,
    isNotionTextBearingBlockType,
    moveNotionBlock,
    outdentNotionBlock,
    removeNotionBlock,
    setNotionBlockCaption,
    setNotionBlockCell,
    setNotionBlockRichText,
    turnNotionBlockInto,
    updateNotionBlock
} from "./tree.ts";
import { getNotionEditableFields, notionSelectionPositionOf } from "./selection.ts";
import type { NotionEditorStore } from "./store.ts";
import { getNotionMarkdownMetadata } from "../internal.ts";

let nextBlockSequence = 0;

/**
 * A fresh, unique editor id for a block created at runtime by a command, distinct from the
 * parser's and adapters' path-derived default ids.
 *
 * @since 1.0.0
 */
export function generateNotionBlockId(): string
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
    block: NotionBlock,
    field: NotionFieldKind,
    index: number | undefined
): NotionRichText | undefined
{
    if (field === "rich_text")
    {
        return getNotionBlockRichText(block);
    }

    if (field === "caption")
    {
        return getNotionBlockCaption(block);
    }

    return index === undefined
        ? undefined
        : getNotionBlockCell(block, index);
}

/**
 * Return a copy of the given block with rich text written to an editable field.
 *
 * @category Functions
 * @since 1.0.0
 */
function writeFieldRichText(
    block: NotionBlock,
    field: NotionFieldKind,
    index: number | undefined,
    richText: NotionRichText
): NotionBlock
{
    if (field === "rich_text")
    {
        return setNotionBlockRichText(block, richText);
    }

    if (field === "caption")
    {
        return setNotionBlockCaption(block, richText);
    }

    return index === undefined
        ? block
        : setNotionBlockCell(block, index, richText);
}

/**
 * Create a selection point for the given block field and offset.
 *
 * @category Functions
 * @since 1.0.0
 */
function fieldPoint(
    blockId: string,
    field: NotionFieldKind,
    index: number | undefined,
    offset: number
): NotionSelectionPoint
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
function collapsedSelection(point: NotionSelectionPoint): NotionSelection
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
    field: NotionEditableField,
    blockId: string,
    kind: NotionFieldKind,
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
function defaultBlockPayload(type: NotionMarkdownBlockType): Record<string, unknown>
{
    switch (type)
    {
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
export function makeNotionBlock(
    type: NotionMarkdownBlockType,
    id: string = generateNotionBlockId()
): NotionBlock
{
    return {
        __notion_markdown: { editorId: id },
        id,
        type,
        [ type ]: defaultBlockPayload(type)
    } as unknown as NotionBlock;
}

/** One entry in the Insert/Turn-into catalog: a block type a host UI can offer to create. */
export interface NotionInsertableBlockOption
{
    readonly type: NotionMarkdownBlockType;
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
const notionInsertableBlockCatalog: ReadonlyArray<NotionInsertableBlockOption> = [
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
export function searchInsertableBlocks(query: string): ReadonlyArray<NotionInsertableBlockOption>
{
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) {return notionInsertableBlockCatalog;}

    return notionInsertableBlockCatalog.filter((option: NotionInsertableBlockOption) =>
        option.label.toLowerCase().includes(normalized) ||
        option.keywords.some((keyword: string) => keyword.includes(normalized)));
}

/* ------------------------------------------------------------------------------------------
 * Native field edit and boundary handling
 * ---------------------------------------------------------------------------------------- */

/**
 * Write a native field's current (text, marks) back into the document as real rich text, and
 * sync the store's selection to the field's reported caret. This is the point where a
 * `NotionFieldEditEvent` from `NotionTextField` becomes a real document transaction.
 *
 * @since 1.0.0
 */
export function applyFieldEdit(store: NotionEditorStore, event: NotionFieldEditEvent): void
{
    const richText = fieldMarksToRichText(event.text, event.marks);

    store.transact((document: NotionDocument) =>
        updateNotionBlock(document, event.blockId, (block: NotionBlock) =>
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
function fieldMarksOf(block: NotionBlock, field: NotionFieldKind, index: number | undefined): FieldMarks
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
function getNextSiblingBlock(document: NotionDocument, blockId: string): NotionBlock | undefined
{
    const path = findNotionBlockPath(document, blockId);
    if (path === undefined || path.length === 0) {return undefined;}

    const siblingPath = [ ...path.slice(0, -1), path[ path.length - 1 ]! + 1 ];
    return getNotionBlockAtPath(document, siblingPath);
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
function handleEnter(store: NotionEditorStore, event: NotionFieldBoundaryEvent): void
{
    if (event.field !== "rich_text") {return;}

    const document = store.getDocument();
    const block = getNotionBlock(document, event.blockId);
    if (block === undefined || !isNotionTextBearingBlockType(block.type)) {return;}

    const { marks, text } = fieldMarksOf(block, "rich_text", undefined);

    if (isNotionListBlockType(block.type) && event.offset === text.length)
    {
        const nextSibling = getNextSiblingBlock(document, event.blockId);
        if (nextSibling !== undefined && nextSibling.type === block.type)
        {
            const firstBlockId = generateNotionBlockId();
            const secondBlockId = generateNotionBlockId();
            const firstBlock = makeNotionBlock("paragraph", firstBlockId);
            const secondBlock = makeNotionBlock("paragraph", secondBlockId);

            store.transact((doc: NotionDocument) =>
            {
                const withSecond = insertNotionBlockRelative(doc, event.blockId, secondBlock, "after");
                const withFirst = insertNotionBlockRelative(withSecond, event.blockId, firstBlock, "before");
                return removeNotionBlock(withFirst, event.blockId);
            }, "user");

            store.setSelection(collapsedSelection(fieldPoint(firstBlockId, "rich_text", undefined, 0)));
            return;
        }
    }

    if (isNotionListBlockType(block.type) && text.length === 0)
    {
        store.transact((doc: NotionDocument) =>
            updateNotionBlock(doc, event.blockId, (b: NotionBlock) =>
                turnNotionBlockInto(b, "paragraph")), "user");
        store.setSelection(collapsedSelection(fieldPoint(event.blockId, "rich_text", undefined, 0)));
        return;
    }

    const [ before, after ] = splitFieldMarks(text, marks, event.offset);
    const newType: NotionMarkdownBlockType = block.type.startsWith("heading_") ? "paragraph" : block.type;
    const newBlockId = generateNotionBlockId();
    const newBlock = makeNotionBlock(newType, newBlockId);
    const newRichText = fieldMarksToRichText(after.text, after.marks);
    const filledNewBlock = writeFieldRichText(newBlock, "rich_text", undefined, newRichText);

    store.transact((doc: NotionDocument) =>
    {
        const withSplitCurrent = updateNotionBlock(doc, event.blockId, (b: NotionBlock) =>
            writeFieldRichText(b, "rich_text", undefined, fieldMarksToRichText(before.text, before.marks)));
        return insertNotionBlockRelative(withSplitCurrent, event.blockId, filledNewBlock, "after");
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
function handleBackspaceAtStart(store: NotionEditorStore, event: NotionFieldBoundaryEvent): void
{
    if (event.field !== "rich_text") {return;}

    const document = store.getDocument();
    const block = getNotionBlock(document, event.blockId);
    if (block === undefined) {return;}

    if (isNotionListBlockType(block.type))
    {
        const path = findNotionBlockPath(document, event.blockId);
        if (path !== undefined && path.length > 1)
        {
            store.transact((doc: NotionDocument) => outdentNotionBlock(doc, event.blockId), "user");
        }
        else
        {
            store.transact((doc: NotionDocument) =>
                updateNotionBlock(doc, event.blockId, (b: NotionBlock) =>
                    turnNotionBlockInto(b, "paragraph")), "user");
        }

        store.setSelection(collapsedSelection(fieldPoint(event.blockId, "rich_text", undefined, 0)));
        return;
    }

    const fields = getNotionEditableFields(document);
    const currentIndex = fields.findIndex((field: NotionEditableField) =>
        sameField(field, event.blockId, "rich_text", event.index));
    const previous = currentIndex > 0 ? fields[ currentIndex - 1 ] : undefined;
    if (previous === undefined || previous.field !== "rich_text") {return;}

    const previousBlock = getNotionBlock(document, previous.blockId);
    if (previousBlock === undefined || !isNotionTextBearingBlockType(previousBlock.type)) {return;}

    const joinOffset = previous.text.length;
    const mergedFieldMarks = mergeFieldMarks(
        richTextToFieldMarks(getNotionBlockRichText(previousBlock) ?? [ ]),
        richTextToFieldMarks(getNotionBlockRichText(block) ?? [ ])
    );
    const mergedChildren = [ ...(previousBlock.children ?? [ ]), ...(block.children ?? [ ]) ];
    const previousId = previous.blockId;

    store.transact((doc: NotionDocument) =>
    {
        const withoutCurrent = removeNotionBlock(doc, event.blockId);
        return updateNotionBlock(withoutCurrent, previousId, (b: NotionBlock) =>
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
function handleDeleteAtEnd(store: NotionEditorStore, event: NotionFieldBoundaryEvent): void
{
    if (event.field !== "rich_text") {return;}

    const document = store.getDocument();
    const block = getNotionBlock(document, event.blockId);
    if (block === undefined || !isNotionTextBearingBlockType(block.type)) {return;}

    const fields = getNotionEditableFields(document);
    const currentIndex = fields.findIndex((field: NotionEditableField) =>
        sameField(field, event.blockId, "rich_text", event.index));
    const next = currentIndex >= 0 ? fields[ currentIndex + 1 ] : undefined;
    if (next === undefined || next.field !== "rich_text") {return;}

    const nextBlock = getNotionBlock(document, next.blockId);
    if (nextBlock === undefined || !isNotionTextBearingBlockType(nextBlock.type)) {return;}

    const joinOffset = fieldMarksOf(block, "rich_text", undefined).text.length;
    const mergedFieldMarks = mergeFieldMarks(
        richTextToFieldMarks(getNotionBlockRichText(block) ?? [ ]),
        richTextToFieldMarks(getNotionBlockRichText(nextBlock) ?? [ ])
    );
    const mergedChildren = [ ...(block.children ?? [ ]), ...(nextBlock.children ?? [ ]) ];
    const nextId = next.blockId;

    store.transact((doc: NotionDocument) =>
    {
        const withoutNext = removeNotionBlock(doc, nextId);
        return updateNotionBlock(withoutNext, event.blockId, (b: NotionBlock) =>
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
function handleVerticalBoundary(store: NotionEditorStore, event: NotionFieldBoundaryEvent): void
{
    const document = store.getDocument();
    const fields = getNotionEditableFields(document);
    const currentIndex = fields.findIndex((field: NotionEditableField) =>
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
export function handleFieldBoundary(store: NotionEditorStore, event: NotionFieldBoundaryEvent): void
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
export function insertTextBlockAfter(store: NotionEditorStore, blockId: string): string
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
    store: NotionEditorStore,
    afterBlockId: string,
    type: NotionMarkdownBlockType
): string
{
    const id = generateNotionBlockId();
    const newBlock = makeNotionBlock(type, id);
    store.transact((document: NotionDocument) =>
        insertNotionBlockRelative(document, afterBlockId, newBlock, "after"), "user");
    store.setSelection(collapsedSelection(fieldPoint(id, "rich_text", undefined, 0)));
    return id;
}

/**
 * Delete a block by its stable editor identity.
 *
 * @since 1.0.0
 */
export function deleteBlock(store: NotionEditorStore, blockId: string): void
{
    store.transact((document: NotionDocument) => removeNotionBlock(document, blockId), "user");
}

/**
 * Convert a block to a different type, carrying its `rich_text` forward.
 *
 * @since 1.0.0
 */
export function turnInto(store: NotionEditorStore, blockId: string, type: NotionMarkdownBlockType): void
{
    store.transact((document: NotionDocument) =>
        updateNotionBlock(document, blockId, (block: NotionBlock) =>
            turnNotionBlockInto(block, type)), "user");
}

/**
 * Swap a block with its previous or next sibling.
 *
 * @since 1.0.0
 */
export function moveBlock(store: NotionEditorStore, blockId: string, direction: "up" | "down"): void
{
    store.transact((document: NotionDocument) => moveNotionBlock(document, blockId, direction), "user");
}

/**
 * Nest a block as the last child of its immediately preceding sibling.
 *
 * @since 1.0.0
 */
export function indent(store: NotionEditorStore, blockId: string): void
{
    store.transact((document: NotionDocument) => indentNotionBlock(document, blockId), "user");
}

/**
 * Un-nest a block to become the next sibling of its own parent.
 *
 * @since 1.0.0
 */
export function outdent(store: NotionEditorStore, blockId: string): void
{
    store.transact((document: NotionDocument) => outdentNotionBlock(document, blockId), "user");
}

/**
 * Regenerate the identifiers of a given block and all of its descendants.
 *
 * @category Functions
 * @since 1.0.0
 */
function regenerateBlockIds(block: NotionBlock): NotionBlock
{
    const id = generateNotionBlockId();
    const metadata = getNotionMarkdownMetadata(block);
    return {
        ...block,
        __notion_markdown: { ...metadata, editorId: id },
        children: block.children?.map(regenerateBlockIds),
        id
    } as NotionBlock;
}

/**
 * Duplicate a block (and its descendants) as the next sibling, with freshly generated editor
 * ids throughout so the copy is independently editable.
 *
 * @since 1.0.0
 */
export function duplicateBlock(store: NotionEditorStore, blockId: string): string | undefined
{
    const document = store.getDocument();
    const block = getNotionBlock(document, blockId);
    if (block === undefined) {return undefined;}

    const clone = regenerateBlockIds(block);
    const cloneId = clone.id;
    store.transact((doc: NotionDocument) => insertNotionBlockRelative(doc, blockId, clone, "after"), "user");
    return cloneId;
}

/**
 * Append a new, empty block of the given type as the last child of a block.
 *
 * @since 1.0.0
 */
export function appendChildBlock(
    store: NotionEditorStore,
    parentBlockId: string,
    type: NotionMarkdownBlockType
): string
{
    const id = generateNotionBlockId();
    const newBlock = makeNotionBlock(type, id);
    store.transact((document: NotionDocument) =>
        appendNotionChild(document, parentBlockId, newBlock), "user");
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
    store: NotionEditorStore,
    apply: (marks: ReadonlyArray<NotionInlineMark>, start: number, end: number) => Array<NotionInlineMark>
): void
{
    const selection = store.getSelection();
    if (selection === undefined) {return;}

    store.transact((document: NotionDocument) =>
    {
        const startPos = Math.min(
            notionSelectionPositionOf(document, selection.anchor),
            notionSelectionPositionOf(document, selection.focus)
        );
        const endPos = Math.max(
            notionSelectionPositionOf(document, selection.anchor),
            notionSelectionPositionOf(document, selection.focus)
        );
        if (startPos === endPos) {return document;}

        let next = document;
        let cursor = 0;

        for (const field of getNotionEditableFields(document))
        {
            const fieldStart = cursor;
            const fieldEnd = cursor + field.text.length;
            cursor = fieldEnd + 1;

            const overlapStart = Math.max(startPos, fieldStart);
            const overlapEnd = Math.min(endPos, fieldEnd);
            if (overlapStart >= overlapEnd) {continue;}

            const block = getNotionBlock(next, field.blockId);
            if (block === undefined) {continue;}

            const currentRichText = readFieldRichText(block, field.field, field.index);
            if (currentRichText === undefined) {continue;}

            const flattened = richTextToFieldMarks(currentRichText);
            const nextMarks = apply(flattened.marks, overlapStart - fieldStart, overlapEnd - fieldStart);
            const nextRichText = fieldMarksToRichText(flattened.text, nextMarks);
            next = updateNotionBlock(next, field.blockId, (b: NotionBlock) =>
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
export function toggleMark(store: NotionEditorStore, kind: NotionFieldRangeMarkKind): void
{
    applyRangeMarkCommand(store, (marks: ReadonlyArray<NotionInlineMark>, start: number, end: number) =>
        toggleFieldRangeMark(marks, kind, start, end));
}

/**
 * Set or clear the text color/background over the current selection, across every field it
 * touches.
 *
 * @since 1.0.0
 */
export function setColor(store: NotionEditorStore, color: NotionMarkdownColor | undefined): void
{
    applyRangeMarkCommand(store, (marks: ReadonlyArray<NotionInlineMark>, start: number, end: number) =>
        setFieldValueMark(marks, "color", start, end, color));
}

/**
 * Set or clear a link over the current selection, across every field it touches.
 *
 * @since 1.0.0
 */
export function setLink(store: NotionEditorStore, url: string | undefined): void
{
    applyRangeMarkCommand(store, (marks: ReadonlyArray<NotionInlineMark>, start: number, end: number) =>
        setFieldValueMark(marks, "link", start, end, url));
}

/* ------------------------------------------------------------------------------------------
 * Mentions
 * ---------------------------------------------------------------------------------------- */

/** A resolved mention candidate ready to insert, typically from a host's "@" search results. */
export interface NotionMentionCandidate
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
function mentionRichTextItem(candidate: NotionMentionCandidate): NotionRichTextItem
{
    const mention = candidate.kind === "user"
        ? { type: "user", user: { id: candidate.id } }
        : { [ candidate.kind ]: { id: candidate.id }, type: candidate.kind };

    return {
        __notion_markdown:
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
    } as NotionRichTextItem;
}

/**
 * Insert a resolved mention at a field position, replacing any selected text there. The
 * command layer's entry point for a host's "@" mention search -- resolving candidates from a
 * query is the host's own responsibility, this only splices the chosen one in.
 *
 * @since 1.0.0
 */
export function insertMention(
    store: NotionEditorStore,
    point: NotionSelectionPoint,
    candidate: NotionMentionCandidate,
    selectionEnd: number = point.offset
): void
{
    const item = mentionRichTextItem(candidate);
    const start = Math.min(point.offset, selectionEnd);
    const end = Math.max(point.offset, selectionEnd);

    store.transact((document: NotionDocument) =>
        updateNotionBlock(document, point.blockId, (block: NotionBlock) =>
        {
            const flattened = fieldMarksOf(block, point.field, point.index);
            const [ before, rest ] = splitFieldMarks(flattened.text, flattened.marks, start);
            const [ , after ] = splitFieldMarks(rest.text, rest.marks, end - start);
            const atomMark: NotionInlineMark =
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
export interface NotionMarkdownShortcutMatch
{
    readonly type: NotionMarkdownBlockType;
    readonly remainder: string;
}

interface NotionMarkdownShortcutRule
{
    readonly pattern: RegExp;
    readonly type: NotionMarkdownBlockType;
}

const markdownShortcuts: ReadonlyArray<NotionMarkdownShortcutRule> = [
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
export function matchNotionMarkdownShortcut(plainText: string): NotionMarkdownShortcutMatch | undefined
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
    store: NotionEditorStore,
    blockId: string,
    match: NotionMarkdownShortcutMatch
): void
{
    const remainderRichText: NotionRichText = match.remainder.length === 0
        ? [ ]
        : [ { text: { content: match.remainder }, type: "text" } as NotionRichTextItem ];

    store.transact((document: NotionDocument) =>
        updateNotionBlock(document, blockId, (block: NotionBlock) =>
        {
            const converted = turnNotionBlockInto(block, match.type);
            return writeFieldRichText(converted, "rich_text", undefined, remainderRichText);
        }), "user");

    const point = fieldPoint(blockId, "rich_text", undefined, match.remainder.length);
    store.setSelection(collapsedSelection(point));
}

/* ------------------------------------------------------------------------------------------
 * The bound command bundle
 * ---------------------------------------------------------------------------------------- */

/** The full command surface, bound to one document store. */
export interface NotionCommands
{
    applyFieldEdit(event: NotionFieldEditEvent): void;
    handleFieldBoundary(event: NotionFieldBoundaryEvent): void;
    insertTextBlockAfter(blockId: string): string;
    insertBlockOfType(afterBlockId: string, type: NotionMarkdownBlockType): string;
    appendChildBlock(parentBlockId: string, type: NotionMarkdownBlockType): string;
    deleteBlock(blockId: string): void;
    turnInto(blockId: string, type: NotionMarkdownBlockType): void;
    moveBlock(blockId: string, direction: "up" | "down"): void;
    indent(blockId: string): void;
    outdent(blockId: string): void;
    duplicateBlock(blockId: string): string | undefined;
    toggleMark(kind: NotionFieldRangeMarkKind): void;
    setColor(color: NotionMarkdownColor | undefined): void;
    setLink(url: string | undefined): void;
    insertMention(
        point: NotionSelectionPoint,
        candidate: NotionMentionCandidate,
        selectionEnd?: number
    ): void;
    applyMarkdownShortcut(blockId: string, match: NotionMarkdownShortcutMatch): void;
    setSelection(selection: NotionSelection | undefined): void;
    undo(): boolean;
    redo(): boolean;
}

/**
 * Bind the full command surface to one document store.
 *
 * @since 1.0.0
 */
export function createNotionCommands(store: NotionEditorStore): NotionCommands
{
    return {
        appendChildBlock: (parentBlockId: string, type: NotionMarkdownBlockType) =>
            appendChildBlock(store, parentBlockId, type),
        applyFieldEdit: (event: NotionFieldEditEvent) => applyFieldEdit(store, event),
        applyMarkdownShortcut: (blockId: string, match: NotionMarkdownShortcutMatch) =>
            applyMarkdownShortcut(store, blockId, match),
        deleteBlock: (blockId: string) => deleteBlock(store, blockId),
        duplicateBlock: (blockId: string) => duplicateBlock(store, blockId),
        handleFieldBoundary: (event: NotionFieldBoundaryEvent) => handleFieldBoundary(store, event),
        indent: (blockId: string) => indent(store, blockId),
        insertBlockOfType: (afterBlockId: string, type: NotionMarkdownBlockType) =>
            insertBlockOfType(store, afterBlockId, type),
        insertMention: (
            point: NotionSelectionPoint,
            candidate: NotionMentionCandidate,
            selectionEnd?: number
        ) => insertMention(store, point, candidate, selectionEnd),
        insertTextBlockAfter: (blockId: string) => insertTextBlockAfter(store, blockId),
        moveBlock: (blockId: string, direction: "up" | "down") => moveBlock(store, blockId, direction),
        outdent: (blockId: string) => outdent(store, blockId),
        redo: () => store.redo(),
        setColor: (color: NotionMarkdownColor | undefined) => setColor(store, color),
        setLink: (url: string | undefined) => setLink(store, url),
        setSelection: (selection: NotionSelection | undefined) => store.setSelection(selection),
        toggleMark: (kind: NotionFieldRangeMarkKind) => toggleMark(store, kind),
        turnInto: (blockId: string, type: NotionMarkdownBlockType) => turnInto(store, blockId, type),
        undo: () => store.undo()
    };
}
