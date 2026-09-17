/**
 * Structural operations over the recursive block tree: locating a block, replacing it with
 * structural sharing along the path to it, and the insert/remove/move/indent/outdent
 * primitives the milestone-four command layer builds its commands from. Blocks are matched by
 * their stable editor identity (`getNotionEditorBlockId`), not `block.id`, so commands keep
 * working on locally-created blocks that have no remote Notion id yet.
 *
 * @module react-native-notion-markdown/document/tree
 *
 * @file      tree.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type {
    NotionBlock,
    NotionDocument,
    NotionMarkdownBlockType,
    NotionRichText
} from "./types.ts";
import { getNotionBlockPayload } from "../internal.ts";
import { getNotionEditorBlockId } from "./selection.ts";

/** A sequence of child-array indices from the document root down to one block. */
export type NotionBlockPath = ReadonlyArray<number>;

/**
 * Find the path to a block by its stable editor identity, searching depth-first.
 *
 * @since 1.0.0
 */
export function findNotionBlockPath(document: NotionDocument, blockId: string): NotionBlockPath | undefined
{
    function search(
        blocks: ReadonlyArray<NotionBlock>,
        prefix: ReadonlyArray<number>
    ): NotionBlockPath | undefined
    {
        for (let index = 0; index < blocks.length; index += 1)
        {
            const block = blocks[ index ]!;
            if (getNotionEditorBlockId(block) === blockId) {return [ ...prefix, index ];}

            if (block.children !== undefined)
            {
                const found = search(block.children, [ ...prefix, index ]);
                if (found !== undefined) {return found;}
            }
        }

        return undefined;
    }

    return search(document.blocks, [ ]);
}

/**
 * Read the block at a known path, without searching.
 *
 * @since 1.0.0
 */
export function getNotionBlockAtPath(document: NotionDocument, path: NotionBlockPath): NotionBlock | undefined
{
    let blocks: ReadonlyArray<NotionBlock> = document.blocks;
    let block: NotionBlock | undefined;

    for (const index of path)
    {
        block = blocks[ index ];
        if (block === undefined) {return undefined;}
        blocks = block.children ?? [ ];
    }

    return block;
}

/**
 * Find a block by its stable editor identity.
 *
 * @since 1.0.0
 */
export function getNotionBlock(document: NotionDocument, blockId: string): NotionBlock | undefined
{
    const path = findNotionBlockPath(document, blockId);
    return path === undefined ? undefined : getNotionBlockAtPath(document, path);
}

type NotionContainerTransform = (container: ReadonlyArray<NotionBlock>) => ReadonlyArray<NotionBlock>;

/**
 * Rebuild the tree with `transform` applied to the children array at `containerPath` -- the
 * top-level `document.blocks` array when `containerPath` is empty, or the `.children` of the
 * block at `containerPath` otherwise. Every other branch of the tree keeps its identity.
 *
 * @since 1.0.0
 */
function updateNotionContainer(
    blocks: ReadonlyArray<NotionBlock>,
    containerPath: NotionBlockPath,
    transform: NotionContainerTransform
): Array<NotionBlock>
{
    if (containerPath.length === 0) {return [ ...transform(blocks) ];}

    const [ head, ...rest ] = containerPath;

    return blocks.map((block: NotionBlock, index: number): NotionBlock =>
    {
        if (index !== head) {return block;}
        return { ...block, children: updateNotionContainer(block.children ?? [ ], rest, transform) };
    });
}

/**
 * Replace or remove one block by its stable editor identity. Returning `undefined` from
 * `updater` removes the block; any other document with no matching block is returned unchanged.
 *
 * @since 1.0.0
 */
export function updateNotionBlock(
    document: NotionDocument,
    blockId: string,
    updater: (block: NotionBlock) => NotionBlock | undefined
): NotionDocument
{
    const path = findNotionBlockPath(document, blockId);
    if (path === undefined) {return document;}

    const index = path[ path.length - 1 ]!;
    const containerPath = path.slice(0, -1);

    const transform: NotionContainerTransform = (container: ReadonlyArray<NotionBlock>) =>
    {
        const target = container[ index ];
        if (target === undefined) {return container;}

        const next = updater(target);
        return next === undefined
            ? container.filter((_: NotionBlock, itemIndex: number) => itemIndex !== index)
            : container.map((block: NotionBlock, itemIndex: number) => (itemIndex === index ? next : block));
    };

    const blocks = updateNotionContainer(document.blocks, containerPath, transform);
    return { blocks, version: 1 };
}

/**
 * Remove one block by its stable editor identity.
 *
 * @since 1.0.0
 */
export function removeNotionBlock(document: NotionDocument, blockId: string): NotionDocument
{
    return updateNotionBlock(document, blockId, () => undefined);
}

/**
 * Insert a new block immediately before or after an existing one, as its sibling.
 *
 * @since 1.0.0
 */
export function insertNotionBlockRelative(
    document: NotionDocument,
    anchorBlockId: string,
    newBlock: NotionBlock,
    position: "before" | "after"
): NotionDocument
{
    const path = findNotionBlockPath(document, anchorBlockId);
    if (path === undefined) {return document;}

    const index = path[ path.length - 1 ]!;
    const containerPath = path.slice(0, -1);
    const insertAt = position === "before" ? index : index + 1;

    const transform: NotionContainerTransform = (container: ReadonlyArray<NotionBlock>) =>
    {
        const next = [ ...container ];
        next.splice(insertAt, 0, newBlock);
        return next;
    };

    const blocks = updateNotionContainer(document.blocks, containerPath, transform);
    return { blocks, version: 1 };
}

/**
 * Append a new block as the last child of an existing block.
 *
 * @since 1.0.0
 */
export function appendNotionChild(
    document: NotionDocument,
    parentBlockId: string,
    newBlock: NotionBlock
): NotionDocument
{
    const parentPath = findNotionBlockPath(document, parentBlockId);
    if (parentPath === undefined) {return document;}

    const transform: NotionContainerTransform =
        (children: ReadonlyArray<NotionBlock>) => [ ...children, newBlock ];
    const blocks = updateNotionContainer(document.blocks, parentPath, transform);
    return { blocks, version: 1 };
}

/**
 * Swap a block with its previous or next sibling. A no-op at either end of the sibling list.
 *
 * @since 1.0.0
 */
export function moveNotionBlock(
    document: NotionDocument,
    blockId: string,
    direction: "up" | "down"
): NotionDocument
{
    const path = findNotionBlockPath(document, blockId);
    if (path === undefined) {return document;}

    const index = path[ path.length - 1 ]!;
    const containerPath = path.slice(0, -1);
    const swapWith = direction === "up" ? index - 1 : index + 1;

    const transform: NotionContainerTransform = (container: ReadonlyArray<NotionBlock>) =>
    {
        if (swapWith < 0 || swapWith >= container.length) {return container;}

        const next = [ ...container ];
        const displaced = next[ index ]!;
        next[ index ] = next[ swapWith ]!;
        next[ swapWith ] = displaced;
        return next;
    };

    const blocks = updateNotionContainer(document.blocks, containerPath, transform);
    return { blocks, version: 1 };
}

/**
 * Nest a block as the last child of its immediately preceding sibling. A no-op when the block
 * is already first in its container, since there is no preceding sibling to become its parent.
 *
 * @since 1.0.0
 */
export function indentNotionBlock(document: NotionDocument, blockId: string): NotionDocument
{
    const path = findNotionBlockPath(document, blockId);
    if (path === undefined) {return document;}

    const index = path[ path.length - 1 ]!;
    if (index === 0) {return document;}

    const containerPath = path.slice(0, -1);

    const transform: NotionContainerTransform = (container: ReadonlyArray<NotionBlock>) =>
    {
        const target = container[ index ]!;
        const previous = container[ index - 1 ]!;
        const nestedPrevious: NotionBlock =
            { ...previous, children: [ ...(previous.children ?? [ ]), target ] };
        const withoutTarget = container.filter((_: NotionBlock, itemIndex: number) => itemIndex !== index);
        return withoutTarget.map((block: NotionBlock, itemIndex: number) =>
            (itemIndex === index - 1 ? nestedPrevious : block));
    };

    const blocks = updateNotionContainer(document.blocks, containerPath, transform);
    return { blocks, version: 1 };
}

/**
 * Un-nest a block to become the next sibling of its own parent. A no-op for a top-level block,
 * since it has no parent to become a sibling of.
 *
 * @since 1.0.0
 */
export function outdentNotionBlock(document: NotionDocument, blockId: string): NotionDocument
{
    const path = findNotionBlockPath(document, blockId);
    if (path === undefined || path.length < 2) {return document;}

    const index = path[ path.length - 1 ]!;
    const parentPath = path.slice(0, -1);
    const parentIndexInGrandparent = parentPath[ parentPath.length - 1 ]!;
    const grandparentContainerPath = parentPath.slice(0, -1);

    let removed: NotionBlock | undefined;
    const removeTransform: NotionContainerTransform = (children: ReadonlyArray<NotionBlock>) =>
    {
        removed = children[ index ];
        return children.filter((_: NotionBlock, itemIndex: number) => itemIndex !== index);
    };

    const withoutTarget = updateNotionContainer(document.blocks, parentPath, removeTransform);
    if (removed === undefined) {return document;}

    const capturedRemoved = removed;
    const insertTransform: NotionContainerTransform = (container: ReadonlyArray<NotionBlock>) =>
    {
        const next = [ ...container ];
        next.splice(parentIndexInGrandparent + 1, 0, capturedRemoved);
        return next;
    };

    const blocks = updateNotionContainer(withoutTarget, grandparentContainerPath, insertTransform);
    return { blocks, version: 1 };
}

/**
 * Read a block's own `rich_text` payload, for block types that have one.
 *
 * @since 1.0.0
 */
export function getNotionBlockRichText(block: NotionBlock): NotionRichText | undefined
{
    const payload = getNotionBlockPayload(block);
    return Array.isArray(payload.rich_text) ? payload.rich_text as NotionRichText : undefined;
}

/**
 * Return a copy of a block with its `rich_text` payload replaced, for block types that have one.
 *
 * @since 1.0.0
 */
export function setNotionBlockRichText(block: NotionBlock, richText: NotionRichText): NotionBlock
{
    const key = block.type;
    const payload = getNotionBlockPayload(block);
    return { ...block, [ key ]: { ...payload, rich_text: richText } } as NotionBlock;
}

/**
 * Read a block's own `caption` payload, for block types that have one.
 *
 * @since 1.0.0
 */
export function getNotionBlockCaption(block: NotionBlock): NotionRichText | undefined
{
    const payload = getNotionBlockPayload(block);
    return Array.isArray(payload.caption) ? payload.caption as NotionRichText : undefined;
}

/**
 * Return a copy of a block with its `caption` payload replaced, for block types that have one.
 *
 * @since 1.0.0
 */
export function setNotionBlockCaption(block: NotionBlock, richText: NotionRichText): NotionBlock
{
    const key = block.type;
    const payload = getNotionBlockPayload(block);
    return { ...block, [ key ]: { ...payload, caption: richText } } as NotionBlock;
}

/**
 * Read one cell's rich text from a `table_row` block.
 *
 * @since 1.0.0
 */
export function getNotionBlockCell(block: NotionBlock, index: number): NotionRichText | undefined
{
    const payload = getNotionBlockPayload(block);
    const cells = Array.isArray(payload.cells) ? payload.cells as Array<NotionRichText> : undefined;
    return cells?.[ index ];
}

/**
 * Return a copy of a `table_row` block with one cell's rich text replaced.
 *
 * @since 1.0.0
 */
export function setNotionBlockCell(block: NotionBlock, index: number, richText: NotionRichText): NotionBlock
{
    const key = block.type;
    const payload = getNotionBlockPayload(block);
    const cells = Array.isArray(payload.cells) ? [ ...payload.cells ] : [ ];
    cells[ index ] = richText;
    return { ...block, [ key ]: { ...payload, cells } } as NotionBlock;
}

/**
 * Convert a block to a different type, carrying its `rich_text` forward and discarding the
 * old type's payload. Children, id, and metadata are preserved untouched.
 *
 * @since 1.0.0
 */
export function turnNotionBlockInto(block: NotionBlock, type: NotionMarkdownBlockType): NotionBlock
{
    if (block.type === type) {return block;}

    const richText = getNotionBlockRichText(block) ?? [ ];
    const rest = { ...(block as unknown as Record<string, unknown>) };
    delete rest[ block.type ];
    rest.type = type;
    rest[ type ] = { rich_text: richText };
    return rest as unknown as NotionBlock;
}

/** Block types that carry an editable `rich_text` field directly on the block payload. */
const textBearingBlockTypes: ReadonlySet<NotionMarkdownBlockType> = new Set([
    "paragraph",
    "heading_1",
    "heading_2",
    "heading_3",
    "heading_4",
    "bulleted_list_item",
    "numbered_list_item",
    "to_do",
    "quote",
    "toggle",
    "callout"
]);

/**
 * Whether a block type has its own editable `rich_text` field, as opposed to carrying text
 * only through children or table cells.
 *
 * @since 1.0.0
 */
export function isNotionTextBearingBlockType(type: NotionMarkdownBlockType): boolean
{
    return textBearingBlockTypes.has(type);
}

/** List block types that continue as a new sibling item on Enter. */
const listBlockTypes: ReadonlySet<NotionMarkdownBlockType> = new Set([
    "bulleted_list_item",
    "numbered_list_item",
    "to_do"
]);

/**
 * Whether a block type is a list item that continues the list on Enter and outdents on
 * Backspace-at-start, rather than merging with the previous block.
 *
 * @since 1.0.0
 */
export function isNotionListBlockType(type: NotionMarkdownBlockType): boolean
{
    return listBlockTypes.has(type);
}
