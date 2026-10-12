/**
 * Pure conversions between the recursive `MarkdownDocument` and the flat block list the native
 * editor exchanges with JavaScript. `MarkdownEditor` uses them for its `initial` and `onChange`
 * props; a host that mounts `NativeEditor` directly can use them the same way.
 *
 * The editor edits a subset of the document model. `toEditorBlocks` never emits a block the native
 * view or `AcceptEditorEvent` would reject, and reports everything it leaves out as a diagnostic.
 * Synced blocks, synced block references, and database references are not supported yet, and are
 * among the blocks it leaves out.
 *
 * @module react-native-notion-markdown/document/editorBlocks
 *
 * @file      editorBlocks.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type {
    EditorBlock,
    EditorColumnCount,
    EditorTable,
    EditorTableCell,
    EditorTableRow,
    EditorTextMark
} from "../prototype.ts";
import {
    MARKDOWN_ATOM_PLACEHOLDER,
    type MarkdownInlineMark,
    fieldMarksToRichText,
    richTextToFieldMarks
} from "./fields.ts";
import {
    MARKDOWN_MARKDOWN_METADATA,
    type MarkdownBlock,
    type MarkdownColor,
    type MarkdownDiagnostic,
    type MarkdownDocument,
    type MarkdownMetadata,
    type MarkdownRichText,
    type MarkdownRichTextItem,
    isMarkdownColor
} from "./types.ts";
import { asRecord, fromSdkColor, getMarkdownBlockPayload, getMarkdownMetadata } from "../internal.ts";
import { getMarkdownEditorBlockId } from "./selection.ts";

/** The editor's within-block line break; a rich-text `\n` on the document side. */
const softBreak = "\u2028";

/** The id of the block that stands in for a document with nothing the editor can show. */
const emptyDocumentBlockId = "editor:empty";

/**
 * Editor blocks and diagnostics returned by {@link toEditorBlocks}.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface ToEditorBlocksResult
{
    readonly blocks: Array<EditorBlock>;

    /** One warning for each thing the editor cannot represent and so left out. */
    readonly diagnostics: Array<MarkdownDiagnostic>;
}

interface ProjectionContext
{
    readonly blocks: Array<EditorBlock>;
    readonly diagnostics: Array<MarkdownDiagnostic>;
    readonly ids: Set<string>;
}

interface EditorText
{
    readonly text: string;
    readonly marks: Array<EditorTextMark>;

    /** How many inline atoms the editor cannot draw were removed. */
    readonly discarded: number;
}

/** The fields of an editor block that `emit` does not fill in itself. */
type EditorBlockFields = Omit<EditorBlock, "color" | "depth" | "id">;

/**
 * Add a warning about the given block to the projection's diagnostics.
 *
 * @category Functions
 * @since 1.0.0
 */
function report(
    context: ProjectionContext,
    block: MarkdownBlock,
    code: string,
    message: string,
    details: Readonly<Record<string, unknown>> = { }
): void
{
    const { source } = getMarkdownMetadata(block);

    context.diagnostics.push({
        code,
        details: { blockId: getMarkdownEditorBlockId(block), type: block.type, ...details },
        message,
        severity: "warning",
        ...(source === undefined ? { } : { source })
    });
}

/**
 * Return whether the editor has no way to draw the given rich-text item.
 *
 * @category Functions
 * @since 1.0.0
 */
function isDiscardedInline(item: MarkdownRichTextItem): boolean
{
    const value = asRecord(item);
    const meta = getMarkdownMetadata(item);

    if (value.type === "mention" || meta.mention !== undefined)
    {
        return true;
    }

    if (value.type === "equation")
    {
        const expression = asRecord(value.equation).expression;
        return typeof expression !== "string" || expression.trim().length === 0;
    }

    return meta.citationUrl !== undefined || meta.emojiName !== undefined;
}

/**
 * Order marks the way the native view reports them: by start, then end, then kind.
 *
 * @category Functions
 * @since 1.0.0
 */
function compareMarks(first: EditorTextMark, second: EditorTextMark): number
{
    return first.start - second.start
        || first.end - second.end
        || (first.kind < second.kind ? -1 : first.kind > second.kind ? 1 : 0);
}

/**
 * Flatten rich text into editor text and marks, dropping the atoms the editor cannot draw.
 *
 * @category Functions
 * @since 1.0.0
 */
function toEditorText(richText: unknown): EditorText
{
    const items = Array.isArray(richText) ? richText as MarkdownRichText : [ ];
    const kept = items.filter((item: MarkdownRichTextItem) => !isDiscardedInline(item));
    const flat = richTextToFieldMarks(kept);
    const marks: Array<EditorTextMark> = [ ];
    const runs = new Map<string, Array<EditorTextMark>>();

    for (const mark of flat.marks)
    {
        if (mark.kind === "atom")
        {
            marks.push({ end: mark.start + 1, expression: mark.label, kind: "equation", start: mark.start });
            continue;
        }

        const next: EditorTextMark =
            {
                end: mark.end,
                kind: mark.kind,
                start: mark.start,
                ...(mark.kind === "color" ? { color: mark.color } : { }),
                ...(mark.kind === "link" ? { url: mark.url } : { })
            };
        const key = `${ mark.kind }|${ mark.color ?? mark.url ?? "" }`;
        const run = runs.get(key) ?? [ ];
        const last = run[ run.length - 1 ];

        /* Rich text carries one annotation set per item, so one formatted range arrives as a mark
           per item. The native view reports it as a single mark. */
        if (last !== undefined && next.start <= last.end)
        {
            run[ run.length - 1 ] = { ...last, end: Math.max(last.end, next.end) };
        }
        else
        {
            run.push(next);
        }

        runs.set(key, run);
    }

    for (const run of runs.values())
    {
        marks.push(...run);
    }

    return {
        discarded: items.length - kept.length,
        marks: marks.sort(compareMarks),
        text: flat.text.replace(/\n/g, softBreak)
    };
}

/**
 * Split a text item at the editor's line breaks, leaving each break as its own unformatted item.
 *
 * The serializer wraps one item in one set of delimiters, and a `<br>` inside them does not parse
 * back, so `**a<br>b**` has to be written as `**a**<br>**b**`.
 *
 * @category Functions
 * @since 1.0.0
 */
function splitSoftBreaks(item: MarkdownRichTextItem): MarkdownRichText
{
    const value = asRecord(item);
    const text = asRecord(value.text);
    const content = text.content;

    if (value.type !== "text" || typeof content !== "string" || !content.includes(softBreak))
    {
        return [ item ];
    }

    const result: MarkdownRichText = [ ];
    const pieces = content.split(softBreak);

    pieces.forEach((piece: string, index: number) =>
    {
        if (piece !== "")
        {
            result.push({ ...value, text: { ...text, content: piece } } as MarkdownRichTextItem);
        }

        if (index < pieces.length - 1)
        {
            result.push({ text: { content: "\n" }, type: "text" } as MarkdownRichTextItem);
        }
    });

    return result;
}

/**
 * Rebuild rich text from editor text and marks.
 *
 * @category Functions
 * @since 1.0.0
 */
function fromEditorText(text: string, marks: ReadonlyArray<EditorTextMark> | undefined): MarkdownRichText
{
    const fieldMarks = (marks ?? [ ]).flatMap((mark: EditorTextMark): Array<MarkdownInlineMark> =>
    {
        const { end, start } = mark;

        if (mark.kind === "equation")
        {
            const { expression } = mark;

            return typeof expression === "string" && text[ start ] === MARKDOWN_ATOM_PLACEHOLDER
                ? [ {
                    atomKind: "equation",
                    end: start + 1,
                    item: { equation: { expression }, type: "equation" } as MarkdownRichTextItem,
                    kind: "atom",
                    label: expression,
                    start
                } ]
                : [ ];
        }

        if (mark.kind === "color")
        {
            return isMarkdownColor(mark.color) ? [ { color: mark.color, end, kind: "color", start } ] : [ ];
        }

        if (mark.kind === "link")
        {
            return typeof mark.url === "string" ? [ { end, kind: "link", start, url: mark.url } ] : [ ];
        }

        return [ { end, kind: mark.kind, start } ];
    });

    return fieldMarksToRichText(text, fieldMarks).flatMap(splitSoftBreaks);
}

/**
 * Return the given marks as an optional `marks` field, omitted when there are none.
 *
 * @category Functions
 * @since 1.0.0
 */
function marksField(marks: ReadonlyArray<EditorTextMark>): { readonly marks?: Array<EditorTextMark> }
{
    return marks.length === 0 ? { } : { marks: [ ...marks ] };
}

/**
 * Read a block's color from its metadata, falling back to its SDK payload.
 *
 * @category Functions
 * @since 1.0.0
 */
function blockColor(block: MarkdownBlock): MarkdownColor | undefined
{
    const { color } = getMarkdownMetadata(block);

    if (isMarkdownColor(color))
    {
        return color;
    }

    const payloadColor = fromSdkColor(getMarkdownBlockPayload(block).color);
    return isMarkdownColor(payloadColor) ? payloadColor : undefined;
}

/**
 * Read the URL of a media block's payload, or `undefined` when it has none.
 *
 * @category Functions
 * @since 1.0.0
 */
function mediaUrl(payload: Record<string, unknown>): string | undefined
{
    const url = [ asRecord(payload.external).url, asRecord(payload.file).url, payload.url ]
        .find((value: unknown) => typeof value === "string" && value.trim().length > 0);

    return typeof url === "string" ? url : undefined;
}

/**
 * Append an editor block for the given document block, and return the id it was given.
 *
 * The native view rejects a snapshot with a repeated id, so a repeat is made unique.
 *
 * @category Functions
 * @since 1.0.0
 */
function emit(
    context: ProjectionContext,
    block: MarkdownBlock,
    depth: number,
    fields: EditorBlockFields
): void
{
    const base = getMarkdownEditorBlockId(block) || "editor:block";
    let id = base;

    for (let suffix = 2; context.ids.has(id); suffix += 1)
    {
        id = `${ base }:${ suffix }`;
    }

    context.ids.add(id);

    const color = blockColor(block);

    context.blocks.push({
        ...(color === undefined ? { } : { color }),
        ...(depth > 0 ? { depth } : { }),
        id,
        ...fields
    });
}

/**
 * Convert a block's rich text for the editor, reporting any inline atoms that were removed.
 *
 * @category Functions
 * @since 1.0.0
 */
function blockText(context: ProjectionContext, block: MarkdownBlock, richText: unknown): EditorText
{
    const result = toEditorText(richText);

    if (result.discarded > 0)
    {
        report(
            context,
            block,
            "editor-discarded-inline",
            "Mentions, citations, and custom emoji cannot be edited and were removed.",
            { count: result.discarded }
        );
    }

    return result;
}

/**
 * Report a block the editor cannot represent at all.
 *
 * @category Functions
 * @since 1.0.0
 */
function discardBlock(context: ProjectionContext, block: MarkdownBlock, reason: string): void
{
    report(context, block, "editor-discarded-block", `${ reason } The block was removed.`);
}

/**
 * Split off the paragraph that carries a container's own hidden text, if its contents start with it.
 *
 * @category Functions
 * @since 1.0.0
 */
function splitLeadText(
    block: MarkdownBlock,
    contents: ReadonlyArray<MarkdownBlock>
): { readonly lead?: MarkdownBlock; readonly rest: ReadonlyArray<MarkdownBlock> }
{
    const first = contents[ 0 ];

    return first?.type === "paragraph"
        && (first.children ?? [ ]).length === 0
        && getMarkdownEditorBlockId(first) === `${ getMarkdownEditorBlockId(block) }:text`
        ? { lead: first, rest: contents.slice(1) }
        : { rest: contents };
}

/**
 * Convert a table block and its rows into the editor's table payload.
 *
 * @category Functions
 * @since 1.0.0
 */
function projectTable(context: ProjectionContext, block: MarkdownBlock, depth: number): void
{
    const rows = (block.children ?? [ ]).filter((child: MarkdownBlock) => child.type === "table_row");
    const cellsOf = (row: MarkdownBlock): Array<unknown> =>
    {
        const { cells } = getMarkdownBlockPayload(row);
        return Array.isArray(cells) ? cells : [ ];
    };
    const width = rows.reduce(
        (maximum: number, row: MarkdownBlock) => Math.max(maximum, cellsOf(row).length), 0
    );

    if (width === 0)
    {
        discardBlock(context, block, "A table needs at least one cell to be edited.");
        return;
    }

    const payload = getMarkdownBlockPayload(block);
    const tableMeta = getMarkdownMetadata(block).table ?? { };
    let discarded = 0;

    const editorRows = rows.map((row: MarkdownBlock, rowIndex: number): EditorTableRow =>
    {
        const rowMeta = getMarkdownMetadata(row).table ?? { };
        const rowCells = cellsOf(row);
        const rowColor = [ rowMeta.rowColor, tableMeta.rowColors?.[ rowIndex ] ].find(isMarkdownColor);
        const cells = Array.from({ length: width }, (_: unknown, columnIndex: number): EditorTableCell =>
        {
            const content = toEditorText(rowCells[ columnIndex ]);
            /* The parser keeps a row's cell colors on the row; table commands keep a grid on the
               table. */
            const cellColor = [
                Array.isArray(rowMeta.cellColors?.[ 0 ]) ? undefined : rowMeta.cellColors?.[ columnIndex ],
                asRecord(tableMeta.cellColors?.[ rowIndex ])[ columnIndex ]
            ].find(isMarkdownColor);
            discarded += content.discarded;

            return {
                ...(cellColor === undefined ? { } : { color: cellColor }),
                ...marksField(content.marks),
                text: content.text
            };
        });

        return { cells, ...(rowColor === undefined ? { } : { color: rowColor }) };
    });

    if (discarded > 0)
    {
        report(
            context,
            block,
            "editor-discarded-inline",
            "Mentions, citations, and custom emoji cannot be edited and were removed.",
            { count: discarded }
        );
    }

    /* A whole-table color has no attribute in the format, so it becomes the color of every column
       that has none of its own -- the same precedence the renderer gives it. */
    const columnColors = Array.from({ length: width }, (_: unknown, columnIndex: number) =>
        [ tableMeta.columnColors?.[ columnIndex ], tableMeta.tableColor ].find(isMarkdownColor));
    const table: EditorTable =
        {
            ...(columnColors.some(isMarkdownColor) ? { columnColors } : { }),
            fitPageWidth: tableMeta.fitPageWidth === true,
            headerColumn: tableMeta.headerColumn ?? payload.has_row_header === true,
            headerRow: tableMeta.headerRow ?? payload.has_column_header === true,
            rows: editorRows
        };

    emit(context, block, depth, { table, text: "", type: "table" });
}

/**
 * Convert an image, video, audio, file, or PDF block.
 *
 * @category Functions
 * @since 1.0.0
 */
function projectMedia(
    context: ProjectionContext,
    block: MarkdownBlock,
    depth: number,
    type: "audio" | "file" | "image" | "pdf" | "video"
): void
{
    const payload = getMarkdownBlockPayload(block);
    const url = mediaUrl(payload);

    if (url === undefined)
    {
        discardBlock(context, block, `The editor cannot show ${ type } content that has no URL.`);
        return;
    }

    const caption = toEditorText(payload.caption);

    if (type === "image" || type === "video")
    {
        if (caption.text.length > 0 || caption.discarded > 0)
        {
            report(
                context,
                block,
                "editor-discarded-caption",
                `The editor does not show ${ type } captions; the caption was removed.`
            );
        }

        emit(context, block, depth, { text: "", type, url });
        return;
    }

    if (caption.marks.length > 0 || caption.discarded > 0)
    {
        report(
            context,
            block,
            "editor-discarded-caption",
            `The editor shows the ${ type } caption as a plain file name; its formatting was removed.`
        );
    }

    const media = asRecord(getMarkdownMetadata(block).media);
    const fileName = caption.text.replaceAll(softBreak, " ").replaceAll(MARKDOWN_ATOM_PLACEHOLDER, "").trim();
    const isSize = (value: unknown): value is number =>
        typeof value === "number" && Number.isFinite(value) && value >= 0;
    const waveform = Array.isArray(media.waveform)
        ? media.waveform.filter((value: unknown): value is number =>
            typeof value === "number" && Number.isFinite(value))
        : [ ];

    emit(context, block, depth, {
        ...(type === "audio" && isSize(media.duration) ? { duration: media.duration } : { }),
        ...(fileName === "" ? { } : { fileName }),
        ...(isSize(media.fileSize) ? { fileSize: media.fileSize } : { }),
        ...(typeof media.mimeType === "string" ? { mimeType: media.mimeType } : { }),
        text: "",
        type,
        url,
        ...(type === "audio" && waveform.length > 0 ? { waveform } : { })
    });
}

/**
 * Convert the given sibling blocks, in order, at one depth.
 *
 * @category Functions
 * @since 1.0.0
 */
function projectBlocks(context: ProjectionContext, blocks: ReadonlyArray<MarkdownBlock>, depth: number): void
{
    for (const block of blocks)
    {
        projectBlock(context, block, depth);
    }
}

/**
 * Convert one document block, and its descendants, into editor blocks.
 *
 * @category Functions
 * @since 1.0.0
 */
function projectBlock(context: ProjectionContext, block: MarkdownBlock, depth: number): void
{
    const payload = getMarkdownBlockPayload(block);
    const meta = getMarkdownMetadata(block);
    const children = block.children ?? [ ];
    /* The block's type as a plain string, so imported blocks of a type the model does not name
       still reach the default branch. */
    const type: string = block.type;

    switch (block.type)
    {
        case "paragraph":
        case "bulleted_list_item":
        case "numbered_list_item":
        case "quote":
        {
            const content = blockText(context, block, payload.rich_text);
            emit(context, block, depth, {
                ...marksField(content.marks),
                text: content.text,
                type: block.type === "paragraph" ? "text" : block.type
            });
            projectBlocks(context, children, depth + 1);
            return;
        }
        case "heading_1":
        case "heading_2":
        case "heading_3":
        case "heading_4":
        {
            const content = blockText(context, block, payload.rich_text);
            const toggle = payload.is_toggleable === true || meta.toggle === true;
            emit(context, block, depth, {
                ...marksField(content.marks),
                text: content.text,
                ...(toggle ? { toggle } : { }),
                type: block.type
            });
            /* Only a toggle heading holds children, so anything nested under a plain one follows
               it as a sibling. */
            projectBlocks(context, children, toggle ? depth + 1 : depth);
            return;
        }
        case "to_do":
        {
            const content = blockText(context, block, payload.rich_text);
            emit(context, block, depth, {
                checked: payload.checked === true,
                ...marksField(content.marks),
                text: content.text,
                type: "to_do"
            });
            projectBlocks(context, children, depth + 1);
            return;
        }
        case "toggle":
        {
            const content = blockText(context, block, payload.rich_text);
            emit(context, block, depth, {
                ...marksField(content.marks),
                text: content.text,
                toggle: true,
                type: "toggle"
            });
            projectBlocks(context, children, depth + 1);
            return;
        }
        case "callout":
        {
            const content = blockText(context, block, payload.rich_text);
            const emoji = asRecord(payload.icon).emoji;
            const icon = typeof emoji === "string" ? emoji : meta.icon;
            emit(context, block, depth, {
                ...(typeof icon === "string" ? { icon } : { }),
                ...marksField(content.marks),
                text: content.text,
                type: "callout"
            });
            projectBlocks(context, children, depth + 1);
            return;
        }
        case "code":
        {
            const language = typeof payload.language === "string" && payload.language.trim().length > 0
                ? payload.language
                : "plain text";
            emit(context, block, depth, {
                language,
                text: toEditorText(payload.rich_text).text.replaceAll(MARKDOWN_ATOM_PLACEHOLDER, ""),
                type: "code"
            });
            projectBlocks(context, children, depth);
            return;
        }
        case "equation":
        {
            const expression = String(payload.expression ?? "").replace(/\n/g, softBreak);
            emit(context, block, depth, { expression, text: expression, type: "equation" });
            projectBlocks(context, children, depth);
            return;
        }
        case "divider":
        case "table_of_contents":
            emit(context, block, depth, { text: "", type: block.type });
            projectBlocks(context, children, depth);
            return;
        case "table":
            projectTable(context, block, depth);
            return;
        case "column_list":
        {
            const columns = children.filter((child: MarkdownBlock) => child.type === "column");
            const contents = children.flatMap((child: MarkdownBlock) =>
                child.type === "column" ? child.children ?? [ ] : [ child ]);
            const { lead, rest } = splitLeadText(block, contents);
            const content = lead === undefined
                ? undefined
                : blockText(context, lead, getMarkdownBlockPayload(lead).rich_text);

            if (columns.length > 5 || columns.slice(1).some((column: MarkdownBlock) =>
                (column.children ?? [ ]).length > 0))
            {
                report(
                    context,
                    block,
                    "editor-flattened-columns",
                    "The editor does not lay out columns; the content of every column is kept, " +
                    "and is returned in the first column.",
                    { columns: columns.length }
                );
            }

            emit(context, block, depth, {
                columnCount: Math.min(5, Math.max(2, columns.length)) as EditorColumnCount,
                ...marksField(content?.marks ?? [ ]),
                text: content?.text ?? "",
                type: "column_list"
            });
            projectBlocks(context, rest, depth + 1);
            return;
        }
        case "column":
            /* A column outside a column list has no editor block of its own; keep what it holds. */
            projectBlocks(context, children, depth);
            return;
        case "image":
        case "video":
        case "audio":
        case "file":
        case "pdf":
            projectMedia(context, block, depth, block.type);
            return;
        case "link_to_page":
        {
            const url = [ meta.referenceUrl, payload.page_id ]
                .find((value: unknown) => typeof value === "string" && value.trim().length > 0);

            if (payload.page_id === undefined || meta.mention?.kind === "database")
            {
                discardBlock(context, block, "The editor does not support database references yet.");
                return;
            }

            if (typeof url !== "string")
            {
                discardBlock(context, block, "The editor cannot show a page reference that has no URL.");
                return;
            }

            emit(context, block, depth, {
                ...(typeof meta.icon === "string" ? { icon: meta.icon } : { }),
                text: (meta.mention?.label ?? toEditorText(payload.rich_text).text)
                    .replace(/[\n\u2028]/g, " ")
                    .replaceAll(MARKDOWN_ATOM_PLACEHOLDER, ""),
                type: "link_to_page",
                url
            });
            return;
        }
        case "synced_block":
        case "synced_block_reference":
            /* The whole block goes, content included: keeping the content would save it back as
               plain blocks that are no longer synced. */
            discardBlock(context, block, "The editor does not support synced blocks yet.");
            return;
        default:
            discardBlock(context, block, `The editor cannot show "${ type }" blocks.`);
    }
}

/**
 * Convert a document into the flat block list the native editor edits.
 *
 * The result is always a valid editor document: block ids are unique, and a document with nothing
 * the editor can show becomes one empty text block. Content the editor cannot represent is left
 * out and reported in `diagnostics`, so a host can warn or decline to open the document for
 * editing. Remote ids and source locations are not carried through an edit.
 *
 * @since 1.0.0
 */
export function toEditorBlocks(document: MarkdownDocument): ToEditorBlocksResult
{
    const context: ProjectionContext = { blocks: [ ], diagnostics: [ ], ids: new Set() };

    projectBlocks(context, document.blocks, 0);

    if (context.blocks.length === 0)
    {
        context.blocks.push({ id: emptyDocumentBlockId, text: "", type: "text" });
    }

    return { blocks: context.blocks, diagnostics: context.diagnostics };
}

/**
 * Remove synced blocks, and the blocks nested under them, from a native editor block list.
 *
 * The editor does not support synced blocks yet. `MarkdownEditor` applies this to its `snapshot`
 * prop; {@link toEditorBlocks} already leaves them out. The given array is returned unchanged when
 * it holds no synced block, and a list left with nothing becomes one empty text block.
 *
 * @since 1.0.0
 */
export function stripSyncedEditorBlocks(blocks: ReadonlyArray<EditorBlock>): ReadonlyArray<EditorBlock>
{
    if (!blocks.some((block: EditorBlock) => block.type === "synced_block"))
    {
        return blocks;
    }

    const kept: Array<EditorBlock> = [ ];
    /* The depth of the synced block being skipped, while inside one. */
    let skippedDepth: number | undefined;

    for (const block of blocks)
    {
        const depth = typeof block.depth === "number" && block.depth > 0 ? block.depth : 0;

        if (skippedDepth !== undefined && depth > skippedDepth)
        {
            continue;
        }

        skippedDepth = block.type === "synced_block" ? depth : undefined;

        if (skippedDepth === undefined)
        {
            kept.push(block);
        }
    }

    return kept.length === 0 ? [ { id: emptyDocumentBlockId, text: "", type: "text" } ] : kept;
}

/** One editor block's own conversion, before its children are attached. */
interface ConvertedBlock
{
    readonly block: MarkdownBlock;

    /** Whether following, deeper editor blocks nest under this one. */
    readonly container: boolean;

    /** Hidden text a column list or synced block carries, as the paragraph that will hold it. */
    readonly lead?: MarkdownBlock;
}

interface TreeNode
{
    readonly converted: ConvertedBlock;
    readonly depth: number;
    readonly children: Array<TreeNode>;
}

/* `AcceptEditorEvent` reuses the objects of unchanged blocks, so a keystroke converts one block. */
const convertedBlocks = new WeakMap<EditorBlock, ConvertedBlock>();

/**
 * Create a document block with the given payload and editor identity.
 *
 * @category Functions
 * @since 1.0.0
 */
function makeBlock(
    id: string,
    type: MarkdownBlock["type"],
    payload: Record<string, unknown>,
    metadata: MarkdownMetadata = { },
    children?: Array<MarkdownBlock>
): MarkdownBlock
{
    return {
        id,
        [ type ]: payload,
        ...(children === undefined ? { } : { children }),
        [ MARKDOWN_MARKDOWN_METADATA ]: { editorId: id, ...metadata },
        type
    } as unknown as MarkdownBlock;
}

/**
 * Convert an editor table into a table block and its rows, in the shape the parser produces.
 *
 * @category Functions
 * @since 1.0.0
 */
function tableBlock(block: EditorBlock, table: EditorTable, metadata: MarkdownMetadata): MarkdownBlock
{
    const width = table.rows.reduce(
        (maximum: number, row: EditorTableRow) => Math.max(maximum, row.cells.length), 0
    );
    /* The native view reports an unset color as `null`, so read every color defensively. */
    const columnColors = Array.from({ length: width }, (_: unknown, columnIndex: number) =>
        [ table.columnColors?.[ columnIndex ], table.tableColor ].find(isMarkdownColor));
    const rows = table.rows.map((row: EditorTableRow, rowIndex: number) =>
    {
        const cellColors = row.cells.map((cell: EditorTableCell) =>
            isMarkdownColor(cell.color) ? cell.color : undefined);

        return makeBlock(
            `${ block.id }:row:${ rowIndex }`,
            "table_row",
            {
                cells: Array.from({ length: width }, (_: unknown, columnIndex: number) =>
                {
                    const cell = row.cells[ columnIndex ];
                    return cell === undefined ? [ ] : fromEditorText(cell.text, cell.marks);
                })
            },
            {
                table:
                {
                    ...(cellColors.some(isMarkdownColor) ? { cellColors } : { }),
                    ...(isMarkdownColor(row.color) ? { rowColor: row.color } : { })
                }
            }
        );
    });

    return makeBlock(
        block.id,
        "table",
        {
            has_column_header: table.headerRow === true,
            has_row_header: table.headerColumn === true,
            table_width: width
        },
        {
            ...metadata,
            table:
            {
                ...(columnColors.some(isMarkdownColor) ? { columnColors } : { }),
                fitPageWidth: table.fitPageWidth === true,
                headerColumn: table.headerColumn === true,
                headerRow: table.headerRow === true
            }
        },
        rows
    );
}

/**
 * Convert one editor block on its own, without the blocks nested under it.
 *
 * @category Functions
 * @since 1.0.0
 */
function convertBlock(block: EditorBlock): ConvertedBlock
{
    const { id } = block;
    const metadata: MarkdownMetadata = isMarkdownColor(block.color) ? { color: block.color } : { };
    const richText = (): MarkdownRichText => fromEditorText(block.text, block.marks);
    /* Dividers, tables of contents, and columns hold only the native view's invisible filler. */
    const hiddenText = block.text.replaceAll("\u200B", "");
    const lead = hiddenText === ""
        ? undefined
        : makeBlock(`${ id }:text`, "paragraph", { rich_text: fromEditorText(block.text, block.marks) });

    switch (block.type)
    {
        case "text":
            return {
                block: makeBlock(
                    id,
                    "paragraph",
                    { rich_text: richText() },
                    block.text === "" ? { ...metadata, empty: true } : metadata
                ),
                container: true
            };
        case "heading_1":
        case "heading_2":
        case "heading_3":
        case "heading_4":
        {
            const toggle = block.toggle === true;

            return {
                block: makeBlock(
                    id,
                    block.type,
                    { rich_text: richText(), ...(toggle ? { is_toggleable: true } : { }) },
                    toggle ? { ...metadata, toggle: true } : metadata
                ),
                container: toggle
            };
        }
        case "bulleted_list_item":
        case "numbered_list_item":
        case "quote":
        case "toggle":
            return { block: makeBlock(id, block.type, { rich_text: richText() }, metadata), container: true };
        case "to_do":
            return {
                block: makeBlock(
                    id,
                    "to_do",
                    { checked: block.checked === true, rich_text: richText() },
                    metadata
                ),
                container: true
            };
        case "callout":
            return {
                block: makeBlock(
                    id,
                    "callout",
                    {
                        ...(typeof block.icon === "string" && block.icon !== ""
                            ? { icon: { emoji: block.icon, type: "emoji" } }
                            : { }),
                        rich_text: richText()
                    },
                    metadata
                ),
                container: true
            };
        case "code":
            return {
                block: makeBlock(
                    id,
                    "code",
                    {
                        language: typeof block.language === "string" && block.language.trim().length > 0
                            ? block.language
                            : "plain text",
                        rich_text: block.text === ""
                            ? [ ]
                            : [ { text: { content: block.text.replaceAll(softBreak, "\n") }, type: "text" } ]
                    },
                    metadata
                ),
                container: false
            };
        case "equation":
            return {
                block: makeBlock(
                    id,
                    "equation",
                    { expression: (block.expression ?? block.text).replaceAll(softBreak, "\n") },
                    metadata
                ),
                container: false
            };
        case "divider":
        case "table_of_contents":
            return { block: makeBlock(id, block.type, { }, metadata), container: false };
        case "table":
            return {
                block: block.table === undefined
                    ? makeBlock(id, "paragraph", { rich_text: [ ] }, { ...metadata, empty: true })
                    : tableBlock(block, block.table, metadata),
                container: false
            };
        case "column_list":
        {
            const count = Math.min(5, Math.max(2, block.columnCount ?? 2));

            return {
                block: makeBlock(id, "column_list", { }, metadata, Array.from(
                    { length: count },
                    (_: unknown, index: number) =>
                        makeBlock(`${ id }:column:${ index }`, "column", { }, { }, [ ])
                )),
                container: true,
                lead
            };
        }
        case "image":
        case "video":
        case "audio":
        case "file":
        case "pdf":
        {
            const media =
                {
                    ...(block.duration === undefined ? { } : { duration: block.duration }),
                    ...(block.fileSize === undefined ? { } : { fileSize: block.fileSize }),
                    ...(block.mimeType === undefined ? { } : { mimeType: block.mimeType }),
                    ...(block.waveform === undefined ? { } : { waveform: [ ...block.waveform ] })
                };
            const fileName = block.type === "image" || block.type === "video" ? "" : block.fileName ?? "";

            return {
                block: makeBlock(
                    id,
                    block.type,
                    {
                        caption: fileName === "" ? [ ] : [ { text: { content: fileName }, type: "text" } ],
                        external: { url: block.url ?? "" },
                        type: "external"
                    },
                    Object.keys(media).length === 0 ? metadata : { ...metadata, media }
                ),
                container: false
            };
        }
        case "link_to_page":
            return {
                block: makeBlock(
                    id,
                    "link_to_page",
                    { page_id: block.url ?? "" },
                    {
                        ...metadata,
                        ...(typeof block.icon === "string" && block.icon !== "" ? { icon: block.icon } : { }),
                        mention: { kind: "page", label: block.text },
                        referenceUrl: block.url ?? ""
                    }
                ),
                container: false
            };
        case "synced_block":
            return {
                block: makeBlock(id, "synced_block", { synced_from: null }, metadata),
                container: true,
                lead
            };
        default:
            return {
                block: makeBlock(
                    id,
                    "paragraph",
                    { rich_text: richText() },
                    block.text === "" ? { ...metadata, empty: true } : metadata
                ),
                container: true
            };
    }
}

/**
 * Attach a node's converted children to its block.
 *
 * @category Functions
 * @since 1.0.0
 */
function assemble(node: TreeNode): MarkdownBlock
{
    const { block, lead } = node.converted;
    const nested = node.children.map(assemble);
    const contents = lead === undefined ? nested : [ lead, ...nested ];

    if (contents.length === 0)
    {
        return block;
    }

    /* The editor draws columns as one placeholder, so everything nested under it is returned in
       the first column. */
    const children = block.type === "column_list"
        ? (block.children ?? [ ]).map((column: MarkdownBlock, index: number) =>
            index === 0 ? { ...column, children: contents } as MarkdownBlock : column)
        : contents;

    return { ...block, children } as MarkdownBlock;
}

/**
 * Convert the native editor's flat block list back into a document.
 *
 * `depth` is free-form in the editor, so a block becomes a child of the nearest preceding
 * shallower block that can hold children. Plain headings, code, equations, dividers, tables,
 * media, page references, and tables of contents cannot, so blocks indented under them follow
 * them as siblings. A toggle's `collapsed` state is view state and is not part of the document.
 *
 * @since 1.0.0
 */
export function fromEditorBlocks(blocks: ReadonlyArray<EditorBlock>): MarkdownDocument
{
    const roots: Array<TreeNode> = [ ];
    const ancestors: Array<TreeNode> = [ ];

    for (const block of blocks)
    {
        let converted = convertedBlocks.get(block);

        if (converted === undefined)
        {
            converted = convertBlock(block);
            convertedBlocks.set(block, converted);
        }

        const depth = typeof block.depth === "number" && block.depth > 0 ? block.depth : 0;

        while (ancestors.length > 0 && ancestors[ ancestors.length - 1 ]!.depth >= depth)
        {
            ancestors.pop();
        }

        const parent = ancestors.findLast((ancestor: TreeNode) => ancestor.converted.container);
        const node: TreeNode = { children: [ ], converted, depth };

        (parent?.children ?? roots).push(node);
        ancestors.push(node);
    }

    return { blocks: roots.map(assemble), version: 1 };
}
