/**
 * @module react-native-notion-markdown/prototype
 *
 * @file      prototype.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { NotionMarkdownColor } from "./document/types.ts";

/**
 * A block in the milestone-one transport model. This is not the public Notion AST.
 *
 * @since 1.0.0
 */
export interface ProofBlock
{
    /** Zero-based nesting depth used by the proof editor's structural actions. */
    readonly depth?: number;
    readonly id: string;
    /** Whether a heading block is a collapsible toggle header. */
    readonly toggle?: boolean;
    /** Whether a toggle header's child content is collapsed in the editor. */
    readonly collapsed?: boolean;
    readonly type:
        | "text"
        | "heading_1"
        | "heading_2"
        | "heading_3"
        | "heading_4"
        | "bulleted_list_item"
        | "numbered_list_item"
        | "to_do"
        | "callout"
        | "divider"
        | "table_of_contents"
        | "column_list"
        | "image"
        | "video"
        | "link_to_page";
    readonly text: string;
    /** URL opened when the page reference is tapped. */
    readonly url?: string;
    /** Optional icon: a page icon for `link_to_page`, or a callout's emoji. */
    readonly icon?: string;
    readonly color?: NotionMarkdownColor;
    /** Whether a to-do block is checked. */
    readonly checked?: boolean;
    /** Number of columns in a `column_list` block. */
    readonly columnCount?: ProofColumnCount;
    /** Inline formatting ranges contained by this block's text. */
    readonly marks?: ReadonlyArray<ProofTextMark>;
};

/** Boolean inline formatting marks supported by the proof editor's format sub-menu. */
export type ProofTextMarkKind =
    | "bold"
    | "italic"
    | "strikethrough"
    | "underline"
    | "code";

/** Supported column counts for a `column_list` block. */
export type ProofColumnCount = 2 | 3 | 4 | 5;

/** A UTF-16 range carrying one inline formatting mark. */
export interface ProofTextMark
{
    readonly end: number;
    readonly kind: ProofTextMarkKind | "link";
    readonly start: number;
    readonly url?: string;
}

/**
 * A UTF-16 selection point within a proof block.
 *
 * @since 1.0.0
 */
export interface ProofPoint
{
    readonly blockId: string;
    readonly field: "rich_text";
    readonly offset: number ;
}

/**
 * A revisioned document snapshot exchanged with the native editor.
 *
 * @since 1.0.0
 */
export interface ProofSnapshot
{
    readonly blocks: Array<ProofBlock>;
    readonly epoch: number;
    readonly revision: number;
}

/**
 * A native editor event containing the latest document and selection state.
 *
 * @since 1.0.0
 */
export interface ProofEvent extends ProofSnapshot
{
    readonly anchor: ProofPoint;
    readonly focus: ProofPoint;
    readonly composingStart: number;
    readonly composingEnd: number;
    readonly source: string;
};

/**
 * Actions understood by the milestone-one native editor coordinator.
 *
 * @since 1.0.0
 */
export type Action =
    | "focus"
    | "dismiss"
    | "selectAll"
    | "copy"
    | "cut"
    | "paste"
    | "split"
    | "backspace"
    | "softBreak"
    | "heading"
    | "divider"
    | "tableOfContents"
    | "columns"
    | "toDo"
    | "format"
    | "clearFormat"
    | "link"
    | "color"
    | "remove"
    | "turnInto"
    | "indent"
    | "outdent"
    | "moveBlockUp"
    | "moveBlockDown"
    | "insertImage"
    | "insertVideo"
    | "callout"
    | "compose"
    | "commit"
    | "insertAbove"
    | "insertBelow"
    | "duplicateBlock"
    | "deleteBlock";

/**
 * A uniquely identified command sent to the native editor coordinator.
 *
 * @since 1.0.0
 */
export interface ProofCommand
{
    readonly id: number;
    readonly epoch: number;
    readonly action: Action;

    /** Heading level for a `"heading"` action. Defaults to 1 when omitted. */
    readonly level?: 1 | 2 | 3 | 4;

    /** Block color for a `"color"` action. Omit (or clear) for the default color. */
    readonly color?: NotionMarkdownColor;

    /** Block type for a `"turnInto"` action. */
    readonly type?: ProofBlock["type"];

    /** Whether a `"heading"` action inserts a toggle header. */
    readonly toggle?: boolean;

    /** Inline formatting mark for a `"format"` action. */
    readonly mark?: ProofTextMarkKind;

    /** Number of columns for a `"columns"` action. Defaults to 2 when omitted. */
    readonly columnCount?: ProofColumnCount;

    /** URL for a `"link"` action. */
    readonly url?: string;

    /** Replacement label for a `"link"` action. Defaults to the selected text. */
    readonly label?: string;

    /**
     * Target block id for a `"insertAbove"`, `"insertBelow"`, `"duplicateBlock"`, or
     * `"deleteBlock"` action -- these act on the identified block directly rather than on the
     * current selection, since the block-actions sheet can be opened for a block (e.g. a divider)
     * that never receives the text cursor.
     */
    readonly blockId?: string;
};

/**
 * Create the default three-block proof document for the requested epoch.
 *
 * @since 1.0.0
 */
export function CreateProofDocument(epoch: number = 1): ProofSnapshot
{
    return {
        blocks:
        [
            {
                id: "proof:first",
                text: "First block. Try autocorrection, composing text, and emoji here.",
                type: "text"
            },
            {
                id: "proof:heading",
                text: "Second block heading",
                type: "heading_1"
            },
            {
                id: "proof:last",
                text: "Third block. Drag selection handles across the block boundaries.",
                type: "text"
            }
        ],
        epoch,
        revision: 0
    };
}

export/**
       * Backwards-compatible camel-case alias for the document factory.
       *
       * @since 1.0.0
       */
const createProofDocument = CreateProofDocument;

/* Valid ProofBlock types -- kept separate from the SDK's `NotionMarkdownBlockType` since this
   internal transport uses a smaller set of editable text and list block types. */
const validProofBlockTypes: ReadonlyArray<ProofBlock[ "type" ]> =
    [
        "text", "heading_1", "heading_2", "heading_3", "heading_4", "bulleted_list_item",
        "numbered_list_item", "divider",
        "to_do", "callout", "table_of_contents", "column_list", "image", "video", "link_to_page"
    ];

/* Valid ProofBlock colors, matching `NotionMarkdownColor` exactly. */
const validProofColors: ReadonlyArray<NotionMarkdownColor> =
    [
        "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red",
        "gray_bg", "brown_bg", "orange_bg", "yellow_bg", "green_bg",
        "blue_bg", "purple_bg", "pink_bg", "red_bg"
    ];

/**
 * Acknowledgements never replace the native composing buffer. Replacement changes epoch.
 *
 * @since 1.0.0
 */
export function AcceptProofEvent(current: ProofSnapshot, event: ProofEvent): ProofSnapshot
{
    if (event.epoch !== current.epoch || event.revision <= current.revision)
    {
        return current;
    }

    const ids = new Set(event.blocks.map((block: ProofBlock) => block.id));

    if (!event.blocks.length || ids.size !== event.blocks.length)
    {
        return current;
    }

    /**
     * Validate a block before accepting it into the document snapshot.
     *
     * @since 1.0.0
     */
    const IsBlockValid = (Block: ProofBlock) => !(
        !Block.id ||
        Block.text.includes("\n") ||
        !validProofBlockTypes.includes(Block.type) ||
        (Block.depth !== undefined && (!Number.isInteger(Block.depth) || Block.depth < 0)) ||
        (Block.toggle === true && !Block.type.startsWith("heading_")) ||
        (Block.collapsed === true && Block.toggle !== true) ||
        (Block.checked !== undefined && Block.type !== "to_do") ||
        (Block.columnCount !== undefined && (Block.type !== "column_list"
            || ![ 2, 3, 4, 5 ].includes(Block.columnCount))) ||
        (Block.url !== undefined && ((Block.type !== "link_to_page" && Block.type !== "image" && Block.type !== "video") || typeof Block.url !== "string")) ||
        (Block.icon !== undefined && (
            !(Block.type === "link_to_page" || Block.type === "callout") ||
            typeof Block.icon !== "string"
        )) ||
        ((Block.type === "link_to_page" || Block.type === "image" || Block.type === "video") && typeof Block.url !== "string") ||
        (Block.color !== undefined && !validProofColors.includes(Block.color)) ||
        (Block.marks !== undefined && Block.marks.some((mark: ProofTextMark) =>
            mark.start < 0 || mark.end <= mark.start || mark.end > Block.text.length ||
            (![ "bold", "italic", "strikethrough", "underline", "code" ].includes(mark.kind)
                && (mark.kind !== "link" || typeof mark.url !== "string" || mark.url.length === 0))
        ))
    );

    /**
     * Validate the complete event payload before accepting the revision.
     *
     * @since 1.0.0
     */
    const IsValid = event.blocks.every(IsBlockValid);

    if (!IsValid)
    {
        return current;
    }

    return {
        blocks: event.blocks.map((block: ProofBlock) =>
        {
            const previous = current.blocks.find((item: ProofBlock) => item.id === block.id);
            const marksEqual = (previous?.marks ?? []).length === (block.marks ?? []).length
                && (previous?.marks ?? []).every(
                    (mark: ProofTextMark, index: number) =>
                    {
                        const next = block.marks?.[ index ];
                        return next?.end === mark.end
                            && next.kind === mark.kind
                            && next.start === mark.start
                            && next.url === mark.url;
                    }
                );
            return previous?.text === block.text
                && previous.type === block.type
                && previous.depth === block.depth
                && previous.toggle === block.toggle
                && previous.collapsed === block.collapsed
                && previous.color === block.color
                && previous.checked === block.checked
                && previous.columnCount === block.columnCount
                && previous.url === block.url
                && previous.icon === block.icon
                && marksEqual
                ? previous
                : block;
        }),
        epoch: current.epoch,
        revision: event.revision
    };
}

export/**
       * Backwards-compatible camel-case alias for the event reducer.
       *
       * @since 1.0.0
       */
const acceptProofEvent = AcceptProofEvent;

/**
 * Native buffer uses newline boundaries and U+2028 for within-block soft breaks.
 *
 * @throws {Error} When the document has no blocks.
 *
 * @since 1.0.0
 */
export function proofPointAt(blocks: ReadonlyArray<ProofBlock>, position: number): ProofPoint
{
    if (!blocks.length)
    {
        throw new Error("A proof document needs at least one block.");
    }

    let remaining: number = Math.max(0, position);

    for (const block of blocks)
    {
        if (remaining <= block.text.length)
        {
            return {
                blockId: block.id,
                field: "rich_text",
                offset: remaining
            };
        }

        remaining -= block.text.length + 1;
    }

    const last = blocks[blocks.length - 1]!;

    return {
        blockId: last.id,
        field: "rich_text",
        offset: last.text.length
    };
}
