/**
 * @module react-native-notion-markdown/prototype
 *
 * @file      prototype.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { MarkdownColor } from "./document/types.ts";

/**
 * A block in the milestone-one transport model. This is not the public Markdown AST.
 *
 * @since 1.0.0
 */
export interface EditorBlock
{
    /** Zero-based nesting depth used by the editor's structural actions. */
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
        | "quote"
        | "divider"
        | "table_of_contents"
        | "column_list"
        | "image"
        | "audio"
        | "video"
        | "file"
        | "link_to_page";
    readonly text: string;
    /** URL opened when the page reference is tapped. */
    readonly url?: string;
    /** Optional media metadata retained for audio and file blocks. */
    readonly duration?: number;
    readonly waveform?: ReadonlyArray<number>;
    readonly mimeType?: string;
    readonly fileName?: string;
    readonly fileSize?: number;
    /** Optional icon: a page icon for `link_to_page`, or a callout's emoji. */
    readonly icon?: string;
    readonly color?: MarkdownColor;
    /** Whether a to-do block is checked. */
    readonly checked?: boolean;
    /** Number of columns in a `column_list` block. */
    readonly columnCount?: EditorColumnCount;
    /** Inline formatting ranges contained by this block's text. */
    readonly marks?: ReadonlyArray<EditorTextMark>;
};

/** Boolean inline formatting marks supported by the editor's format sub-menu. */
export type EditorTextMarkKind =
    | "bold"
    | "italic"
    | "strikethrough"
    | "underline"
    | "code";

/** Supported column counts for a `column_list` block. */
export type EditorColumnCount = 2 | 3 | 4 | 5;

/** A UTF-16 range carrying one inline formatting mark. */
export interface EditorTextMark
{
    readonly end: number;
    readonly kind: EditorTextMarkKind | "link";
    readonly start: number;
    readonly url?: string;
}

/**
 * A UTF-16 selection point within an editor block.
 *
 * @since 1.0.0
 */
export interface EditorPoint
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
export interface EditorSnapshot
{
    readonly blocks: Array<EditorBlock>;
    readonly epoch: number;
    readonly revision: number;
}

/**
 * A native editor event containing the latest document and selection state.
 *
 * @since 1.0.0
 */
export interface EditorEvent extends EditorSnapshot
{
    readonly anchor: EditorPoint;
    readonly focus: EditorPoint;
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
    | "bulletedList"
    | "numberedList"
    | "heading"
    | "divider"
    | "tableOfContents"
    | "columns"
    | "toDo"
    | "format"
    | "clearFormat"
    | "link"
    | "color"
    | "icon"
    | "remove"
    | "turnInto"
    | "indent"
    | "outdent"
    | "moveBlockUp"
    | "moveBlockDown"
    | "insertImage"
    | "insertAudio"
    | "insertVideo"
    | "insertFile"
    | "callout"
    | "quote"
    | "compose"
    | "commit"
    | "insertAbove"
    | "insertBelow"
    | "duplicateBlock"
    | "deleteBlock"
    | "replaceImage"
    | "replaceAudio";

/**
 * A uniquely identified command sent to the native editor coordinator.
 *
 * @since 1.0.0
 */
export interface EditorCommand
{
    readonly id: number;
    readonly epoch: number;
    readonly action: Action;

    /** Heading level for a `"heading"` action. Defaults to 1 when omitted. */
    readonly level?: 1 | 2 | 3 | 4;

    /** Block color for a `"color"` action. Omit (or clear) for the default color. */
    readonly color?: MarkdownColor;

    /** Emoji icon for a callout `"icon"` action. */
    readonly icon?: string;

    /** Block type for a `"turnInto"` action. */
    readonly type?: EditorBlock["type"];

    /** Whether a `"heading"` action inserts a toggle header. */
    readonly toggle?: boolean;

    /** Inline formatting mark for a `"format"` action. */
    readonly mark?: EditorTextMarkKind;

    /** Number of columns for a `"columns"` action. Defaults to 2 when omitted. */
    readonly columnCount?: EditorColumnCount;

    /** URL for a `"link"` action. */
    readonly url?: string;

    /** Replacement label for a `"link"` action. Defaults to the selected text. */
    readonly label?: string;

    /**
     * Target block id for a `"insertAbove"`, `"insertBelow"`, `"duplicateBlock"`,
     * `"deleteBlock"`, or `"replaceImage"` action -- these act on the identified block directly
     * rather than on the current selection, since the block-actions sheet can be opened for a
     * block (e.g. a divider or an image) that never receives the text cursor.
     */
    readonly blockId?: string;

    /** Audio metadata for an `insertAudio` or `replaceAudio` action. */
    readonly duration?: number;
    readonly waveform?: ReadonlyArray<number>;
    readonly mimeType?: string;
    readonly fileName?: string;
    readonly fileSize?: number;
};

/**
 * Create the default three-block editor document for the requested epoch.
 *
 * @since 1.0.0
 */
export function CreateEditorDocument(epoch: number = 1): EditorSnapshot
{
    return {
        blocks:
        [
            {
                id: "editor:first",
                text: "First block. Try autocorrection, composing text, and emoji here.",
                type: "text"
            },
            {
                id: "editor:heading",
                text: "Second block heading",
                type: "heading_1"
            },
            {
                id: "editor:last",
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
const createEditorDocument = CreateEditorDocument;

/* Valid EditorBlock types -- kept separate from the SDK's `MarkdownBlockType` since this
   internal transport uses a smaller set of editable text and list block types. */
const validEditorBlockTypes: ReadonlyArray<EditorBlock[ "type" ]> =
    [
        "text", "heading_1", "heading_2", "heading_3", "heading_4", "bulleted_list_item",
        "numbered_list_item", "divider",
        "to_do", "callout", "quote", "table_of_contents", "column_list", "image", "audio", "video", "file",
        "link_to_page"
    ];

/* Valid EditorBlock colors, matching `MarkdownColor` exactly. */
const validEditorColors: ReadonlyArray<MarkdownColor> =
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
export function AcceptEditorEvent(current: EditorSnapshot, event: EditorEvent): EditorSnapshot
{
    if (event.epoch !== current.epoch || event.revision <= current.revision)
    {
        return current;
    }

    const ids = new Set(event.blocks.map((block: EditorBlock) => block.id));

    if (!event.blocks.length || ids.size !== event.blocks.length)
    {
        return current;
    }

    /**
     * Validate a block before accepting it into the document snapshot.
     *
     * @since 1.0.0
     */
    const IsBlockValid = (Block: EditorBlock) => !(
        !Block.id ||
        Block.text.includes("\n") ||
        !validEditorBlockTypes.includes(Block.type) ||
        (Block.depth !== undefined && (!Number.isInteger(Block.depth) || Block.depth < 0)) ||
        (Block.toggle === true && !Block.type.startsWith("heading_")) ||
        (Block.collapsed === true && Block.toggle !== true) ||
        (Block.checked !== undefined && Block.type !== "to_do") ||
        (Block.columnCount !== undefined && (Block.type !== "column_list"
            || ![ 2, 3, 4, 5 ].includes(Block.columnCount))) ||
        (Block.url !== undefined && (
            (Block.type !== "link_to_page" && Block.type !== "image" && Block.type !== "audio"
                && Block.type !== "video" && Block.type !== "file") || typeof Block.url !== "string"
        )) ||
        (Block.icon !== undefined && (
            !(Block.type === "link_to_page" || Block.type === "callout") ||
            typeof Block.icon !== "string"
        )) ||
        ((Block.type === "link_to_page" || Block.type === "image" || Block.type === "audio"
            || Block.type === "video" || Block.type === "file")
            && (typeof Block.url !== "string" || Block.url.trim().length === 0)) ||
        (Block.duration !== undefined && (Block.type !== "audio" || !Number.isFinite(Block.duration)
            || Block.duration < 0)) ||
        (Block.mimeType !== undefined && ((Block.type !== "audio" && Block.type !== "file")
            || typeof Block.mimeType !== "string")) ||
        (Block.fileName !== undefined && ((Block.type !== "audio" && Block.type !== "file")
            || typeof Block.fileName !== "string")) ||
        (Block.fileSize !== undefined && ((Block.type !== "audio" && Block.type !== "file")
            || !Number.isFinite(Block.fileSize) || Block.fileSize < 0)) ||
        (Block.color !== undefined && !validEditorColors.includes(Block.color)) ||
        (Block.marks !== undefined && Block.marks.some((mark: EditorTextMark) =>
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
        blocks: event.blocks.map((block: EditorBlock) =>
        {
            const previous = current.blocks.find((item: EditorBlock) => item.id === block.id);
            const marksEqual = (previous?.marks ?? []).length === (block.marks ?? []).length
                && (previous?.marks ?? []).every(
                    (mark: EditorTextMark, index: number) =>
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
                && previous.duration === block.duration
                && previous.mimeType === block.mimeType
                && previous.fileName === block.fileName
                && previous.fileSize === block.fileSize
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
const acceptEditorEvent = AcceptEditorEvent;

/**
 * Native buffer uses newline boundaries and U+2028 for within-block soft breaks.
 *
 * @throws {Error} When the document has no blocks.
 *
 * @since 1.0.0
 */
export function editorPointAt(blocks: ReadonlyArray<EditorBlock>, position: number): EditorPoint
{
    if (!blocks.length)
    {
        throw new Error("An editor document needs at least one block.");
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
