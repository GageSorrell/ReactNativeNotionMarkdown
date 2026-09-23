/**
 * Transport shapes and pure conversions between the document's rich text and the flat
 * (text + marks) representation a native editable field understands. Native fields never
 * interpret Markdown SDK shapes directly -- they only edit text and track mark ranges, which
 * Android's own Spannable already reflows as text changes. These functions are the boundary
 * where that flat shape is translated to and from real `MarkdownRichText`.
 *
 * Also home to the split/merge/toggle operations the milestone-four command layer needs on
 * this same (text, marks) representation -- splitting a field for Enter, merging two for
 * Backspace, and toggling formatting over a range all stay here rather than duplicating the
 * atom/annotation bookkeeping in `editor/commands.ts`.
 *
 * @module react-native-notion-markdown/document/fields
 *
 * @file      fields.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    MARKDOWN_MARKDOWN_METADATA,
    type MarkdownBlock,
    type MarkdownColor,
    type MarkdownMetadata,
    type MarkdownRichText,
    type MarkdownRichTextItem,
    type MarkdownSelection,
    type MarkdownSelectionPoint
} from "./types.ts";
import { asRecord } from "../internal.ts";

/* eslint-disable @typescript-eslint/naming-convention */

export/** One UTF-16 code unit stands in for an entire atomic inline element in field text. */
const MARKDOWN_ATOM_PLACEHOLDER = "￼";

/* eslint-enable @typescript-eslint/naming-convention */

/** A kind of editable text field within a block. */
export type MarkdownFieldKind =
    | "rich_text"
    | "caption"
    | "cell";

/** A non-atomic inline formatting range within a field's flattened text. */
export interface MarkdownInlineRangeMark
{
    readonly kind:
        | "bold"
        | "italic"
        | "underline"
        | "strikethrough"
        | "code"
        | "color"
        | "link";
    readonly start: number;
    readonly end: number;
    readonly color?: MarkdownColor;
    readonly url?: string;
}

/** One atomic inline element (mention, citation, custom emoji, or equation). */
export interface MarkdownInlineAtomMark
{
    readonly kind: "atom";
    readonly start: number;
    readonly end: number;
    readonly atomKind:
        | "mention"
        | "equation"
        | "citation"
        | "emoji";
    readonly label: string;
    readonly item: MarkdownRichTextItem;
}

/** A formatting or atomic range over a field's flattened text. */
export type MarkdownInlineMark =
    | MarkdownInlineRangeMark
    | MarkdownInlineAtomMark;

/** The native description of one editable field, supplied by the host document. */
export interface MarkdownFieldDescriptor
{
    readonly sessionId: string;
    readonly order: number;
    readonly blockId: string;
    readonly field: MarkdownFieldKind;
    readonly index?: number;
    readonly text: string;
    readonly marks: ReadonlyArray<MarkdownInlineMark>;
    readonly epoch: number;
    readonly revision: number;
    readonly placeholder?: string;
}

/** An explicit start/end range within one field. */
export interface MarkdownFieldSelection
{
    readonly start: number;
    readonly end: number;
}

/** Actions understood by a native editable field. */
export type MarkdownFieldAction =
    | "focus"
    | "dismiss"
    | "selectAll"
    | "setSelection"
    | "copy"
    | "cut"
    | "paste";

/** A uniquely identified command sent to one native field. */
export interface MarkdownFieldCommand
{
    readonly id: number;
    readonly epoch: number;
    readonly action: MarkdownFieldAction;
    readonly selection?: MarkdownFieldSelection;
}

/** A revisioned edit reported by a native field. */
export interface MarkdownFieldEditEvent
{
    readonly blockId: string;
    readonly field: MarkdownFieldKind;
    readonly index?: number;
    readonly text: string;
    readonly marks: ReadonlyArray<MarkdownInlineMark>;
    readonly selectionStart: number;
    readonly selectionEnd: number;
    readonly composingStart: number;
    readonly composingEnd: number;
    readonly epoch: number;
    readonly revision: number;
    readonly source: string;
}

/** A structural signal a field cannot resolve locally; the command layer decides the outcome. */
export type MarkdownFieldBoundaryKind =
    | "enter"
    | "backspace-at-start"
    | "delete-at-end"
    | "arrow-up-at-top"
    | "arrow-down-at-bottom";

/** A boundary event reported by a native field. */
export interface MarkdownFieldBoundaryEvent extends MarkdownSelectionPoint
{
    readonly kind: MarkdownFieldBoundaryKind;
    readonly hasSelection: boolean;
    readonly epoch: number;
}

/** A focus/blur signal reported by a native field. */
export interface MarkdownFieldFocusEvent
{
    readonly blockId: string;
    readonly field: MarkdownFieldKind;
    readonly index?: number;
}

/** A cross-field selection reported by the selection overlay. Structurally a `MarkdownSelection`. */
export type MarkdownCrossFieldSelectionEvent = MarkdownSelection;

/** A request from the selection overlay to scroll the host's list while dragging a handle. */
export interface MarkdownAutoScrollEvent
{
    readonly direction: "up" | "down";
    readonly proximity: number;
}

/**
 * Return the atom kind stored in the given rich-text item, if it has one.
 *
 * @category Functions
 * @since 1.0.0
 */
function atomKindOf(item: MarkdownRichTextItem): MarkdownInlineAtomMark[ "atomKind" ] | undefined
{
    const asObject = asRecord(item);
    const meta = asObject[ MARKDOWN_MARKDOWN_METADATA ] as MarkdownMetadata | undefined;

    if (asObject.type === "mention")
    {
        return "mention";
    }

    if (asObject.type === "equation")
    {
        return "equation";
    }

    if (meta?.citationUrl !== undefined)
    {
        return "citation";
    }

    if (meta?.emojiName !== undefined)
    {
        return "emoji";
    }

    return undefined;
}

/**
 * Return the display label for the given rich-text atom.
 *
 * @category Functions
 * @since 1.0.0
 */
function atomLabel(item: MarkdownRichTextItem, atomKind: MarkdownInlineAtomMark[ "atomKind" ]): string
{
    const asObject = asRecord(item);
    const meta = asObject[ MARKDOWN_MARKDOWN_METADATA ] as MarkdownMetadata | undefined;

    if (atomKind === "mention")
    {
        const mentionType = asRecord(asObject.mention).type;
        return meta?.mention?.label ?? (typeof mentionType === "string" ? mentionType : "mention");
    }

    if (atomKind === "equation")
    {
        return String(asRecord(asObject.equation).expression ?? "");
    }

    if (atomKind === "citation")
    {
        return meta?.citationUrl ?? "";
    }

    return meta?.emojiName ?? "";
}

/**
 * Read plain text from the given rich-text item.
 *
 * @category Functions
 * @since 1.0.0
 */
function AsPlainText(item: MarkdownRichTextItem): string
{
    const asObject = asRecord(item);

    if (typeof asObject.plain_text === "string")
    {
        return asObject.plain_text;
    }

    const content = asRecord(asObject.text).content;

    return typeof content === "string" ? content : "";
}

/**
 * Read the link URL from the given rich-text item, if one is present.
 *
 * @category Functions
 * @since 1.0.0
 */
function AsLink(item: MarkdownRichTextItem): string | undefined
{
    const link = asRecord(asRecord(item).text).link;
    const url = asRecord(link).url;
    return typeof url === "string" ? url : undefined;
}

const annotationKinds = Object.freeze([
    "bold",
    "italic",
    "underline",
    "strikethrough",
    "code"
] as const);

/**
 * Text and inline marks used to edit one document field.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface FieldMarks
{
    readonly text: string;
    readonly marks: Array<MarkdownInlineMark>;
}

/**
 * Flatten a block's rich text into plain text plus formatting/atom marks for a native field.
 * Each atomic element occupies exactly one `MARKDOWN_ATOM_PLACEHOLDER` character.
 *
 * @since 1.0.0
 */
export function richTextToFieldMarks(richText: MarkdownRichText): FieldMarks
{
    let text = "";
    const marks: Array<MarkdownInlineMark> = [ ];

    for (const item of richText)
    {
        const atomKind = atomKindOf(item);

        if (atomKind !== undefined)
        {
            const start = text.length;
            text += MARKDOWN_ATOM_PLACEHOLDER;
            const label = atomLabel(item, atomKind);
            marks.push({ atomKind, end: start + 1, item, kind: "atom", label, start });
            continue;
        }

        const content = AsPlainText(item);

        if (content.length === 0)
        {
            continue;
        }

        const start = text.length;
        text += content;
        const end = start + content.length;
        const annotations = asRecord(item).annotations as Record<string, unknown> | undefined;

        for (const kind of annotationKinds)
        {
            if (annotations?.[ kind ] === true)
            {
                marks.push({ end, kind, start });
            }
        }

        if (typeof annotations?.color === "string" && annotations.color !== "default")
        {
            marks.push({
                color: annotations.color as MarkdownColor,
                end,
                kind: "color",
                start
            });
        }

        const url = AsLink(item);

        if (url !== undefined)
        {
            marks.push({
                end,
                kind: "link",
                start,
                url
            });
        }
    }

    return { marks, text } as const;
}

/**
 * Reconstruct rich text from a field's current (text, marks) state. Untouched atoms splice
 * their original item back in unchanged; overlapping range marks are flattened into runs so
 * each emitted item carries one consistent annotation set.
 *
 * @since 1.0.0
 */
export function fieldMarksToRichText(text: string, marks: ReadonlyArray<MarkdownInlineMark>): MarkdownRichText
{
    const result: MarkdownRichText = [ ];
    let cursor = 0;

    while (cursor < text.length)
    {
        const atom = marks.find((mark: MarkdownInlineMark): mark is MarkdownInlineAtomMark =>
            mark.kind === "atom" && mark.start === cursor);

        if (atom !== undefined)
        {
            result.push(atom.item);
            cursor = atom.end;
            continue;
        }

        const nextAtomStart = marks
            .filter((mark: MarkdownInlineMark): mark is MarkdownInlineAtomMark =>
                mark.kind === "atom" && mark.start > cursor)
            .reduce((min: number, mark: MarkdownInlineAtomMark) => Math.min(min, mark.start), text.length);

        const runMarks = marks.filter((mark: MarkdownInlineMark): mark is MarkdownInlineRangeMark =>
            mark.kind !== "atom" && mark.start < nextAtomStart && mark.end > cursor);

        const boundaries = new Set<number>([ cursor, nextAtomStart ]);
        for (const mark of runMarks)
        {
            if (mark.start > cursor && mark.start < nextAtomStart)
            {
                boundaries.add(mark.start);
            }
            if (mark.end > cursor && mark.end < nextAtomStart)
            {
                boundaries.add(mark.end);
            }
        }

        const points = [ ...boundaries ].sort((a: number, b: number) => a - b);

        for (let index = 0; index < points.length - 1; index ++)
        {
            const segmentStart = points[ index ]!;
            const segmentEnd = points[ index + 1 ]!;
            if (segmentStart === segmentEnd) {continue;}

            const active = runMarks.filter((mark: MarkdownInlineRangeMark) =>
                mark.start <= segmentStart && mark.end >= segmentEnd);
            const annotations: Record<string, boolean> = { };
            let color: MarkdownColor | undefined;
            let url: string | undefined;

            for (const mark of active)
            {
                if (mark.kind === "color") {color = mark.color;}
                else if (mark.kind === "link") {url = mark.url;}
                else {annotations[ mark.kind ] = true;}
            }

            const hasAnnotations = Object.keys(annotations).length > 0 || color !== undefined;

            result.push({
                text:
                {
                    content: text.slice(segmentStart, segmentEnd),
                    ...(url === undefined ? { } : { link: { url } })
                },
                type: "text",
                ...(hasAnnotations
                    ? {
                        annotations:
                        {
                            bold: false,
                            code: false,
                            italic: false,
                            strikethrough: false,
                            underline: false,
                            ...annotations,
                            ...(color === undefined ? { } : { color })
                        }
                    }
                    : { })
            } as MarkdownRichTextItem);
        }

        cursor = nextAtomStart;
    }

    return result;
}

/**
 * Shift the range of the given mark by a character delta.
 *
 * @category Functions
 * @since 1.0.0
 */
function ShiftMark(mark: MarkdownInlineMark, delta: number): MarkdownInlineMark
{
    return {
        ...mark,
        end: mark.end + delta,
        start: mark.start + delta
    } as MarkdownInlineMark;
}

/**
 * Split (text, marks) at a UTF-16 offset into two independent field states. A range mark
 * straddling the offset is clipped into two pieces; an atom cannot straddle a split point
 * since it occupies exactly one unit, so a split always lands on an atom's own boundary.
 *
 * @since 1.0.0
 */
export function splitFieldMarks(
    text: string,
    marks: ReadonlyArray<MarkdownInlineMark>,
    offset: number
): [ FieldMarks, FieldMarks ]
{
    const at = Math.max(0, Math.min(text.length, offset));
    const before: Array<MarkdownInlineMark> = [ ];
    const after: Array<MarkdownInlineMark> = [ ];

    for (const mark of marks)
    {
        if (mark.end <= at)
        {
            before.push(mark);
        }
        else if (mark.start >= at)
        {
            after.push(ShiftMark(mark, -at));
        }
        else
        {
            before.push({ ...mark, end: at } as MarkdownInlineMark);
            after.push(ShiftMark({ ...mark, start: at } as MarkdownInlineMark, -at));
        }
    }

    return [
        { marks: before, text: text.slice(0, at) },
        { marks: after, text: text.slice(at) }
    ];
}

/**
 * Concatenate two field states, shifting the second's marks past the first's text. The
 * inverse of {@link splitFieldMarks} for a split made at `first.text.length`.
 *
 * @since 1.0.0
 */
export function mergeFieldMarks(first: FieldMarks, second: FieldMarks): FieldMarks
{
    const offset = first.text.length;
    return {
        marks: [ ...first.marks, ...second.marks.map((mark: MarkdownInlineMark) => ShiftMark(mark, offset)) ],
        text: first.text + second.text
    };
}

/** Boolean formatting marks that toggle on/off over a range, as opposed to carrying a value. */
export type MarkdownFieldRangeMarkKind =
    | "bold"
    | "italic"
    | "underline"
    | "strikethrough"
    | "code";

type RangeInterval = readonly [ number, number ];

/**
 * Merge overlapping or adjacent intervals into corresponding continuous ranges.
 *
 * @category Functions
 * @since 1.0.0
 */
function MergeIntervals(intervals: ReadonlyArray<RangeInterval>): Array<RangeInterval>
{
    const sorted = [ ...intervals ].sort((a: RangeInterval, b: RangeInterval) => a[ 0 ] - b[ 0 ]);
    const result: Array<RangeInterval> = [ ];

    for (const interval of sorted)
    {
        const last = result[ result.length - 1 ];
        if (last !== undefined && interval[ 0 ] <= last[ 1 ])
        {
            result[ result.length - 1 ] = [ last[ 0 ], Math.max(last[ 1 ], interval[ 1 ]) ];
        }
        else
        {
            result.push(interval);
        }
    }

    return result;
}

/**
 * Check whether the given intervals fully cover a range.
 *
 * @category Functions
 * @since 1.0.0
 */
function CoversRange(intervals: ReadonlyArray<RangeInterval>, range: RangeInterval): boolean
{
    const [ start, end ] = range;
    if (start >= end) {return true;}

    let cursor = start;
    for (const interval of MergeIntervals(intervals))
    {
        if (interval[ 0 ] > cursor) {return false;}
        if (interval[ 1 ] > cursor) {cursor = interval[ 1 ];}
        if (cursor >= end) {return true;}
    }

    return cursor >= end;
}

/**
 * Remove the given range from a set of intervals.
 *
 * @category Functions
 * @since 1.0.0
 */
function SubtractRange(intervals: ReadonlyArray<RangeInterval>, range: RangeInterval): Array<RangeInterval>
{
    const [ start, end ] = range;
    const result: Array<RangeInterval> = [ ];

    for (const interval of intervals)
    {
        if (interval[ 1 ] <= start || interval[ 0 ] >= end)
        {
            result.push(interval);
            continue;
        }

        if (interval[ 0 ] < start)
        {
            result.push([ interval[ 0 ], start ]);
        }

        if (interval[ 1 ] > end)
        {
            result.push([ end, interval[ 1 ] ]);
        }
    }

    return result;
}

/**
 * Toggle a boolean formatting mark over `[start, end)`. When the range is already fully
 * covered by that mark, it is removed from the range; otherwise it is added, merging with any
 * adjacent or overlapping run of the same kind.
 *
 * @since 1.0.0
 */
export function toggleFieldRangeMark(
    marks: ReadonlyArray<MarkdownInlineMark>,
    kind: MarkdownFieldRangeMarkKind,
    start: number,
    end: number
): Array<MarkdownInlineMark>
{
    if (start >= end) {return [ ...marks ];}

    const others = marks.filter((mark: MarkdownInlineMark) => mark.kind !== kind);
    const existing = marks
        .filter((mark: MarkdownInlineMark): mark is MarkdownInlineRangeMark => mark.kind === kind)
        .map((mark: MarkdownInlineRangeMark): RangeInterval => [ mark.start, mark.end ]);

    const nextIntervals = CoversRange(existing, [ start, end ])
        ? SubtractRange(existing, [ start, end ])
        : MergeIntervals([ ...existing, [ start, end ] ]);

    return [
        ...others,
        ...nextIntervals.map((interval: RangeInterval): MarkdownInlineMark =>
            ({ end: interval[ 1 ], kind, start: interval[ 0 ] }))
    ];
}

/**
 * Set or clear a value-carrying mark (color or link) over `[start, end)`. Existing marks of
 * the same kind are clipped out of the range first; passing `undefined` simply clears it.
 *
 * @since 1.0.0
 */
export function setFieldValueMark(
    marks: ReadonlyArray<MarkdownInlineMark>,
    kind: "color" | "link",
    start: number,
    end: number,
    value: string | undefined
): Array<MarkdownInlineMark>
{
    if (start >= end) {return [ ...marks ];}

    const clipped = marks.flatMap((mark: MarkdownInlineMark): Array<MarkdownInlineMark> =>
    {
        if (mark.kind !== kind) {return [ mark ];}

        return SubtractRange([ [ mark.start, mark.end ] ], [ start, end ]).map(
            (piece: RangeInterval): MarkdownInlineMark =>
                ({ ...mark, end: piece[ 1 ], start: piece[ 0 ] }) as MarkdownInlineMark
        );
    });

    if (value === undefined) {return clipped;}

    const applied: MarkdownInlineMark = kind === "color"
        ? { color: value as MarkdownColor, end, kind: "color", start }
        : { end, kind: "link", start, url: value };

    return [ ...clipped, applied ];
}

/** A structured clipboard fragment carrying one field's rich text selection. */
export interface MarkdownFieldClipboardFragment
{
    readonly version: 1;
    readonly kind: "field";
    readonly text: string;
    readonly marks: ReadonlyArray<MarkdownInlineMark>;
}

/** A structured clipboard fragment carrying whole blocks, for cross-field selections. */
export interface MarkdownBlockClipboardFragment
{
    readonly version: 1;
    readonly kind: "blocks";
    readonly blocks: ReadonlyArray<MarkdownBlock>;
}

/**
 * Encode a single field's selected rich text for the structured clipboard.
 *
 * @since 1.0.0
 */
export function encodeMarkdownFieldClipboard(richText: MarkdownRichText): string
{
    const { marks, text } = richTextToFieldMarks(richText);
    const fragment: MarkdownFieldClipboardFragment = { kind: "field", marks, text, version: 1 };
    return JSON.stringify(fragment);
}

/**
 * Decode a structured field clipboard fragment, rejecting anything malformed or oversized.
 *
 * @since 1.0.0
 */
export function decodeMarkdownFieldClipboard(json: string): MarkdownRichText | undefined
{
    if (json.length > 1_000_000) {return undefined;}

    try
    {
        const parsed = JSON.parse(json) as Partial<MarkdownFieldClipboardFragment>;
        const isValid =
            parsed.version === 1 &&
            parsed.kind === "field" &&
            typeof parsed.text === "string" &&
            Array.isArray(parsed.marks);

        if (!isValid)
        {
            return undefined;
        }

        return fieldMarksToRichText(parsed.text, parsed.marks as ReadonlyArray<MarkdownInlineMark>);
    }
    catch
    {
        return undefined;
    }
}

/**
 * Encode whole blocks for the structured clipboard, used when a selection spans multiple fields.
 *
 * @since 1.0.0
 */
export function encodeMarkdownBlockClipboard(blocks: ReadonlyArray<MarkdownBlock>): string
{
    const fragment: MarkdownBlockClipboardFragment = { blocks, kind: "blocks", version: 1 };
    return JSON.stringify(fragment);
}

/**
 * Decode a structured block clipboard fragment, rejecting anything malformed or oversized.
 *
 * @since 1.0.0
 */
export function decodeMarkdownBlockClipboard(json: string): Array<MarkdownBlock> | undefined
{
    if (json.length > 1_000_000) {return undefined;}

    try
    {
        const parsed = JSON.parse(json) as Partial<MarkdownBlockClipboardFragment>;
        const isValid =
            parsed.version === 1 &&
            parsed.kind === "blocks" &&
            Array.isArray(parsed.blocks) &&
            parsed.blocks.length <= 10_000;

        if (!isValid)
        {
            return undefined;
        }

        return parsed.blocks as Array<MarkdownBlock>;
    }
    catch
    {
        return undefined;
    }
}
