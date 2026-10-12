/**
 * Canonical serializer for the Markdown-enhanced content document model.
 *
 * @module react-native-notion-markdown/document/serializer
 *
 * @file      serializer.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    type MarkdownBlock,
    type MarkdownColor,
    type MarkdownDocument,
    type MarkdownMetadata,
    type MarkdownRichText,
    type SerializeMarkdownOptions,
    isMarkdownColor
} from "./types.ts";
import { asRecord, getMarkdownBlockPayload, getMarkdownMetadata } from "../internal.ts";

/**
 * Escape Markdown-significant characters in the given text.
 *
 * @category Functions
 * @since 1.0.0
 */
function escapeText(value: string): string
{
    /* eslint-disable-next-line no-useless-escape */
    return value.replace(/[\\*~`$\[\]<>\{\}\|\^]/g, "\\$&").replace(/\n/g, "<br>");
}

/**
 * Quote and escape the given attribute value.
 *
 * @category Functions
 * @since 1.0.0
 */
function quoteAttribute(value: string): string
{
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

/** One inline format that wraps the content of every run it covers. */
interface InlineMark
{
    /** Identifies the mark; two marks with the same key are one format. */
    readonly key: string;
    readonly open: string;
    readonly close: string;

    /** Whether the mark is a delimiter run, which Markdown does not recognize next to whitespace. */
    readonly delimiter: boolean;

    /** Nesting order among marks that cover the same runs; the lowest is outermost. */
    readonly rank: number;
}

/** One rich-text item, reduced to its content and the marks that wrap it. */
interface InlineRun
{
    /** Unescaped text for a `"text"` run; finished Markdown for the other kinds. */
    readonly content: string;
    readonly kind: "atom" | "code" | "text";
    readonly marks: ReadonlyArray<InlineMark>;
}

const strikethroughMark: InlineMark = { close: "~~", delimiter: true, key: "~~", open: "~~", rank: 1 };
const italicMark: InlineMark = { close: "*", delimiter: true, key: "*", open: "*", rank: 2 };
const boldMark: InlineMark = { close: "**", delimiter: true, key: "**", open: "**", rank: 3 };

/**
 * Return whether the given run is wrapped by the given mark.
 *
 * @category Functions
 * @since 1.0.0
 */
function hasMark(run: InlineRun, mark: InlineMark): boolean
{
    return run.marks.some((other: InlineMark) => other.key === mark.key);
}

/**
 * Serialize the given rich-text item if it is a mention, citation, custom emoji, or equation.
 *
 * @category Functions
 * @since 1.0.0
 */
function atomMarkdown(item: MarkdownRichText[number]): string | undefined
{
    const value = asRecord(item);
    const itemMetadata = getMarkdownMetadata(item);
    const mention = itemMetadata.mention;

    if (mention !== undefined)
    {
        const kind = mention.kind.replace("data_source", "data-source");
        const url = mention.url === undefined ? "" : ` url=${quoteAttribute(mention.url)}`;
        const label = mention.label === undefined ? "" : escapeText(mention.label);
        if (kind === "date") {return `<mention-date${url}/>`;}
        return `<mention-${kind}${url}>${label}</mention-${kind}>`;
    }

    if (value.type === "mention")
    {
        const rawMention = asRecord(value.mention);
        if (rawMention.type === "date")
        {
            const date = asRecord(rawMention.date);
            const start = String(date.start ?? "");
            const separator = start.indexOf("T");
            const attrs = [ `start=${quoteAttribute(separator < 0 ? start : start.slice(0, separator))}` ];
            if (date.end !== undefined)
            {
                attrs.push(`end=${ quoteAttribute(String(date.end)) }`);
            }

            if (separator >= 0)
            {
                attrs.push(`startTime=${ quoteAttribute(start.slice(separator + 1)) }`);
            }

            if (date.time_zone !== undefined)
            {
                attrs.push(`timeZone=${quoteAttribute(String(date.time_zone))}`);
            }

            return `<mention-date ${ attrs.join(" ") }/>`;
        }
    }

    if (itemMetadata.citationUrl !== undefined)
    {
        return `[^${itemMetadata.citationUrl}]`;
    }

    if (itemMetadata.emojiName !== undefined)
    {
        return `:${ itemMetadata.emojiName }:`;
    }

    if (value.equation !== undefined)
    {
        return `$${ String(asRecord(value.equation).expression ?? "") }$`;
    }

    return undefined;
}

/**
 * Reduce the given rich-text item to a run, or `undefined` if it has no content.
 *
 * @category Functions
 * @since 1.0.0
 */
function inlineRun(item: MarkdownRichText[number]): InlineRun | undefined
{
    const atom = atomMarkdown(item);

    if (atom !== undefined)
    {
        return { content: atom, kind: "atom", marks: [ ] };
    }

    const value = asRecord(item);
    const textValue = asRecord(value.text);
    const content = typeof textValue.content === "string"
        ? textValue.content
        : (typeof value.plain_text === "string" ? value.plain_text : "");

    if (content === "")
    {
        return undefined;
    }

    const annotations = asRecord(value.annotations);
    const marks: Array<InlineMark> = [ ];
    const spanAttributes: Array<string> = [ ];

    if (annotations.underline === true)
    {
        spanAttributes.push(`underline=${quoteAttribute("true")}`);
    }

    if (isMarkdownColor(annotations.color))
    {
        spanAttributes.push(`color=${quoteAttribute(annotations.color)}`);
    }

    if (spanAttributes.length > 0)
    {
        const open = `<span ${ spanAttributes.join(" ") }>`;
        marks.push({ close: "</span>", delimiter: false, key: open, open, rank: 0 });
    }

    if (annotations.strikethrough === true)
    {
        marks.push(strikethroughMark);
    }

    if (annotations.italic === true)
    {
        marks.push(italicMark);
    }

    if (annotations.bold === true)
    {
        marks.push(boldMark);
    }

    const link = asRecord(textValue.link).url;
    if (typeof link === "string")
    {
        const close = `](${ link })`;
        marks.push({ close, delimiter: false, key: close, open: "[", rank: 4 });
    }

    return annotations.code === true
        ? { content: `\`${ escapeText(content).replace(/`/g, "\\`") }\``, kind: "code", marks }
        : { content, kind: "text", marks };
}

/**
 * Give each mention, citation, custom emoji, and equation the marks shared by the text on both
 * sides of it, so that formatting around one is written once rather than closed and reopened.
 *
 * @category Functions
 * @since 1.0.0
 */
function bridgeAtoms(runs: ReadonlyArray<InlineRun>): Array<InlineRun>
{
    return runs.map((run: InlineRun, index: number) =>
    {
        if (run.kind !== "atom")
        {
            return run;
        }

        const before = runs.slice(0, index).findLast((other: InlineRun) => other.kind !== "atom");
        const after = runs.slice(index + 1).find((other: InlineRun) => other.kind !== "atom");

        return before === undefined || after === undefined
            ? run
            : { ...run, marks: before.marks.filter((mark: InlineMark) => hasMark(after, mark)) };
    });
}

/**
 * Split the whitespace off both ends of each text run, so that a text run is either all
 * whitespace or neither starts nor ends with any.
 *
 * @category Functions
 * @since 1.0.0
 */
function splitEdgeSpace(runs: ReadonlyArray<InlineRun>): Array<InlineRun>
{
    return runs.flatMap((run: InlineRun) =>
    {
        if (run.kind !== "text")
        {
            return [ run ];
        }

        const { content } = run;
        const start = content.length - content.trimStart().length;
        const end = Math.max(start, content.trimEnd().length);

        return [ content.slice(0, start), content.slice(start, end), content.slice(end) ]
            .filter((piece: string) => piece !== "")
            .map((piece: string) => ({ ...run, content: piece }));
    });
}

/**
 * Return whether the given run is text made only of whitespace.
 *
 * @category Functions
 * @since 1.0.0
 */
function isSpace(run: InlineRun): boolean
{
    return run.kind === "text" && run.content.trim() === "";
}

/**
 * Serialize the given rich-text collection to Markdown.
 *
 * Adjacent items that share a format are wrapped in it once: bold text holding a link is
 * `**a [b](url) c**`, not three separately delimited pieces.
 *
 * @category Functions
 * @since 1.0.0
 */
function richText(items: unknown): string
{
    if (!Array.isArray(items))
    {
        return "";
    }

    const runs = splitEdgeSpace(bridgeAtoms((items as MarkdownRichText)
        .map(inlineRun)
        .filter((run: InlineRun | undefined): run is InlineRun => run !== undefined)));

    const open: Array<InlineMark> = [ ];
    let result = "";

    // The depth of the outermost open mark that does not cover the given run, or the end of it all.
    const endedAt = (run: InlineRun | undefined): number =>
    {
        const ended = open.findIndex((mark: InlineMark) => run === undefined || !hasMark(run, mark));
        return ended < 0 ? open.length : ended;
    };

    runs.forEach((run: InlineRun, index: number) =>
    {
        const space = isSpace(run);
        let ended = endedAt(run);

        if (space)
        {
            /* `**bold **` is not bold in Markdown: a delimiter must touch the text it wraps. So one
               that closes before the next text closes before this whitespace instead. */
            let next = index + 1;
            let closing = Math.min(ended, endedAt(runs[ next ]));

            while (next < runs.length && isSpace(runs[ next ]!))
            {
                next += 1;
                closing = Math.min(closing, endedAt(runs[ next ]));
            }

            const delimiter = open.findIndex((mark: InlineMark, depth: number) =>
                depth >= closing && mark.delimiter);
            ended = delimiter < 0 ? ended : Math.min(ended, delimiter);
        }

        // Marks nest, so closing one closes every mark opened inside of it.
        while (open.length > ended)
        {
            result += open.pop()!.close;
        }

        const reach = (mark: InlineMark): number =>
        {
            let end = index + 1;
            while (end < runs.length && hasMark(runs[ end ]!, mark)) {end += 1;}
            return end;
        };

        // The mark that runs the furthest is opened first, so the others can close inside of it.
        const opening = run.marks
            .filter((mark: InlineMark) =>
                // For the same reason, a delimiter waits for text rather than open on whitespace.
                !(space && mark.delimiter) && !open.some((other: InlineMark) => other.key === mark.key))
            .sort((first: InlineMark, second: InlineMark) =>
                reach(second) - reach(first) || first.rank - second.rank);

        for (const mark of opening)
        {
            open.push(mark);
            result += mark.open;
        }

        result += run.kind === "text" ? escapeText(run.content) : run.content;
    });

    while (open.length > 0)
    {
        result += open.pop()!.close;
    }

    return result;
}

/** Serialize fenced-code content literally; code blocks do not escape Markdown characters. */
function codeText(items: unknown): string
{
    return Array.isArray(items)
        ? items.map((item: unknown) =>
        {
            const value = asRecord(item);
            const text = asRecord(value.text);
            return typeof text.content === "string"
                ? text.content
                : typeof value.plain_text === "string" ? value.plain_text : "";
        }).join("")
        : "";
}

/**
 * Serialize block attributes from the given metadata.
 *
 * @category Functions
 * @since 1.0.0
 */
function blockAttributes(meta: MarkdownMetadata, includeToggle: boolean = false): string
{
    const attrs: Array<string> = [ ];
    if (isMarkdownColor(meta.color))
    {
        attrs.push(`color=${ quoteAttribute(meta.color) }`);
    }

    if (includeToggle && meta.toggle === true)
    {
        attrs.push(`toggle=${ quoteAttribute("true") }`);
    }

    return attrs.length === 0
        ? ""
        : ` {${ attrs.join(" ") }}`;
}

/**
 * Serialize inline tag attributes from the given metadata.
 *
 * @category Functions
 * @since 1.0.0
 */
function tagAttributes(meta: MarkdownMetadata): string
{
    const attrs: Array<string> = [ ];
    if (isMarkdownColor(meta.color))
    {
        attrs.push(`color=${quoteAttribute(meta.color)}`);
    }

    if (meta.inline === true)
    {
        attrs.push(`inline=${quoteAttribute("true")}`);
    }

    if (meta.icon !== undefined)
    {
        attrs.push(`icon=${quoteAttribute(meta.icon)}`);
    }

    return attrs.length === 0 ? "" : ` ${attrs.join(" ")}`;
}

/**
 * Serialize the given block and its descendants to Markdown lines.
 *
 * @category Functions
 * @since 1.0.0
 */
function serializeBlock(
    block: MarkdownBlock,
    indent: number,
    options: SerializeMarkdownOptions
): Array<string>
{
    const data = getMarkdownBlockPayload(block);
    const meta = getMarkdownMetadata(block);
    const children = block.children ?? [ ];
    const childLines = children.flatMap((child: MarkdownBlock) =>
        serializeBlock(child, indent + 1, options));
    const line = (value: string): Array<string> => [ `${"\t".repeat(indent)}${value}` ];
    const withChildren = (value: string): Array<string> => [ ...line(value), ...childLines ];
    switch (block.type)
    {
        case "paragraph":
            return withChildren(meta.empty === true
                ? "<empty-block/>"
                : `${richText(data.rich_text)}${blockAttributes(meta)}`);
        case "heading_1":
        case "heading_2":
        case "heading_3":
        case "heading_4":
            return withChildren(
                "#".repeat(Number(block.type.slice(-1))) +
                " " +
                richText(data.rich_text) +
                blockAttributes(meta, data.is_toggleable === true)
            );
        case "bulleted_list_item":
            return withChildren(`- ${ richText(data.rich_text) }${ blockAttributes(meta) }`);
        case "numbered_list_item":
            return withChildren(`1. ${ richText(data.rich_text) }${ blockAttributes(meta) }`);
        case "to_do":
            return withChildren(
                `- [${ data.checked === true ? "x" : " " }] ` +
                richText(data.rich_text) +
                blockAttributes(meta)
            );
        case "quote":
            return withChildren(`> ${richText(data.rich_text)}${blockAttributes(meta)}`);
        case "toggle":
            return [
                "\t".repeat(indent) + `<details${ tagAttributes(meta) }>`,
                "\t".repeat(indent) + `<summary>${ richText(data.rich_text) }</summary>`,
                ...childLines,
                "\t".repeat(indent) + "</details>"
            ];
        case "callout":
        {
            // The parser records the icon in both the payload and the metadata; emit it only once.
            const { icon: metaIcon, ...tagMeta } = meta;
            const emoji = asRecord(data.icon).emoji;
            const icon = typeof emoji === "string" ? emoji : metaIcon;
            const iconAttribute = icon === undefined ? "" : ` icon=${quoteAttribute(icon)}`;
            return [
                "\t".repeat(indent) + `<callout${ iconAttribute }${ tagAttributes(tagMeta) }>`,
                "\t".repeat(indent + 1) + richText(data.rich_text),
                ...childLines,
                "\t".repeat(indent) + "</callout>"
            ];
        }
        case "code":
        {
            const language = typeof data.language === "string" ? data.language : "plain text";
            const code = codeText(data.rich_text);
            const theme = options.includeCodeBlockThemeNull === true ? " theme={null}" : "";

            return [
                `${"\t".repeat(indent)}\`\`\`${ language }${ theme }`,
                ...code.split("\n").map((value: string) => `${ "\t".repeat(indent) }${ value }`),
                `${"\t".repeat(indent)}\`\`\``
            ];
        }
        case "equation":
            return [
                `${"\t".repeat(indent)}$$`,
                `${"\t".repeat(indent)}${String(data.expression ?? "")}`,
                `${"\t".repeat(indent)}$$`
            ];
        case "divider":
            return line("---");
        case "column_list":
            return [ `${"\t".repeat(indent)}<columns>`, ...childLines, `${"\t".repeat(indent)}</columns>` ];
        case "column":
            return [ `${"\t".repeat(indent)}<column>`, ...childLines, `${"\t".repeat(indent)}</column>` ];
        case "table":
        {
            const tableMeta = meta.table ?? { };
            const tableAttrs =
                [
                    tableMeta.fitPageWidth === true ? `fit-page-width=${quoteAttribute("true")}` : "",
                    tableMeta.headerRow === true ? `header-row=${quoteAttribute("true")}` : "",
                    tableMeta.headerColumn === true ? `header-column=${quoteAttribute("true")}` : ""
                ]
                    .filter(Boolean)
                    .join(" ");

            const columnColors = tableMeta.columnColors ?? [ ];
            const columns = columnColors.length === 0 ? [ ] : [
                `${"\t".repeat(indent + 1)}<colgroup>`,
                ...columnColors.map((color: MarkdownColor | undefined) =>
                    "\t".repeat(indent + 2) +
                    `<col${isMarkdownColor(color) ? ` color=${ quoteAttribute(color) }` : "" }>`),
                `${"\t".repeat(indent + 1)}</colgroup>`
            ];

            return [
                "\t".repeat(indent) +
                `<table${ tableAttrs.length === 0 ? "" : ` ${ tableAttrs }` }>`,
                ...columns,
                ...children.flatMap((row: MarkdownBlock) => serializeTableRow(row, indent + 1)),
                `${"\t".repeat(indent)}</table>`
            ];
        }
        case "table_row":
            return serializeTableRow(block, indent);
        case "image":
        {
            const external = asRecord(data.external).url;
            const url = typeof external === "string" ? external : String(data.url ?? "");
            return line(`![${richText(data.caption)}](${url})${blockAttributes(meta)}`);
        }
        case "audio":
        case "video":
        case "file":
        case "pdf":
        case "embed":
        case "bookmark":
        {
            const external = asRecord(data.external).url;
            const url = typeof external === "string" ? external : String(data.url ?? "");
            const caption = richText(data.caption);
            return line(
                `<${ block.type } ` +
                `src=${ quoteAttribute(url) }${ tagAttributes(meta) }>${ caption }</${ block.type }>`
            );
        }
        case "link_to_page":
        {
            const url = meta.referenceUrl ?? String(data.page_id ?? data.database_id ?? "");
            const kind = data.database_id === undefined ? "page" : "database";
            const label = meta.mention?.label ?? richText(data.rich_text);
            return line(
                `<${ kind } url=${  quoteAttribute(url) }${ tagAttributes(meta) }>${ label }</${ kind }>`
            );
        }
        case "table_of_contents":
            return line(`<table_of_contents${tagAttributes(meta)}/>`);
        case "synced_block":
        case "synced_block_reference":
        {
            const url = meta.referenceUrl;
            const tag = block.type === "synced_block" ? "synced_block" : "synced_block_reference";
            return [
                "\t".repeat(indent) +
                `<${ tag }${ url === undefined ? "" : ` url=${ quoteAttribute(url) }` }>`,
                ...childLines,
                "\t".repeat(indent) + `</${ tag }>`
            ];
        }
        default:
            return line(richText(data.rich_text));
    }
}

/**
 * Serialize the given table row to Markdown lines.
 *
 * @category Functions
 * @since 1.0.0
 */
function serializeTableRow(block: MarkdownBlock, indent: number): Array<string>
{
    const data = getMarkdownBlockPayload(block);
    const rowMeta = getMarkdownMetadata(block);
    const cells = Array.isArray(data.cells) ? data.cells : [ ];
    const cellColors = rowMeta.table?.cellColors;
    const rowColor = !isMarkdownColor(rowMeta.table?.rowColor)
        ? ""
        : ` color=${ quoteAttribute(rowMeta.table.rowColor) }`;

    return [
        `${ "\t".repeat(indent) }<tr${ rowColor }>${ cells.map((cell: unknown, cellIndex: number) =>
        {
            const cellColor = Array.isArray(cellColors?.[ 0 ])
                ? undefined
                : cellColors?.[ cellIndex ] as MarkdownColor | undefined;

            return (
                `<td${ isMarkdownColor(cellColor) ? ` color=${ quoteAttribute(cellColor) }` : "" }>` +
                `${ richText(cell) }</td>`
            );
        }).join("") }</tr>`
    ];
}

/** Serialize a document into canonical enhanced Markdown. */
export function serializeMarkdown(
    document: MarkdownDocument,
    options: SerializeMarkdownOptions = { }
): string
{
    return document.blocks
        .flatMap((block: MarkdownBlock) => serializeBlock(block, 0, options))
        .join("\n");
}
