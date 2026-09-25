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

/**
 * Serialize the given rich-text item to Markdown.
 *
 * @category Functions
 * @since 1.0.0
 */
function richTextItem(item: MarkdownRichText[number]): string
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
            const attrs = [`start=${quoteAttribute(separator < 0 ? start : start.slice(0, separator))}`];
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

    const textValue = asRecord(value.text);

    let content = typeof textValue.content === "string"
        ? textValue.content
        : (typeof value.plain_text === "string" ? value.plain_text : "");

    content = escapeText(content);
    const link = asRecord(textValue.link).url;
    if (typeof link === "string")
    {
        content = `[${ content }](${ link })`;
    }

    const annotations = asRecord(value.annotations);

    if (annotations.code === true)
    {
        return `\`${ content.replace(/`/g, "\\`") }\``;
    }

    if (annotations.bold === true)
    {
        content = `**${ content }**`;
    }

    if (annotations.italic === true)
    {
        content = `*${ content }*`;
    }

    if (annotations.strikethrough === true)
    {
        content = `~~${ content }~~`;
    }

    const spanAttributes: Array<string> = [ ];

    if (annotations.underline === true)
    {
        spanAttributes.push(`underline=${quoteAttribute("true")}`);
    }

    if (isMarkdownColor(annotations.color))
    {
        spanAttributes.push(`color=${quoteAttribute(annotations.color)}`);
    }

    return spanAttributes.length === 0
        ? content
        : `<span ${ spanAttributes.join(" ") }>${ content }</span>`;
}

/**
 * Serialize the given rich-text collection to Markdown.
 *
 * @category Functions
 * @since 1.0.0
 */
function richText(items: unknown): string
{
    return Array.isArray(items)
        ? items
            .map((item: unknown) => richTextItem(item as MarkdownRichText[number]))
            .join("")
        : "";
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
function blockAttributes(meta: MarkdownMetadata, includeToggle = false): string
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
    if (isMarkdownColor(meta.color)) {
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
            return meta.empty === true
                ? line("<empty-block/>")
                : withChildren(`${richText(data.rich_text)}${blockAttributes(meta)}`);
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
                "\t".repeat(indent + 1) + `<summary>${ richText(data.rich_text) }</summary>`,
                ...childLines,
                "\t".repeat(indent) + "</details>"
            ];
        case "callout":
        {
            const icon = asRecord(data.icon).emoji;
            const iconAttribute = typeof icon === "string" ? ` icon=${quoteAttribute(icon)}` : "";
            return [
                "\t".repeat(indent) + `<callout${ iconAttribute }${ tagAttributes(meta) }>`,
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
            const cellValue = Array.isArray(cell)
                ? (cell as Array<unknown>)
                    .map((item: unknown) => richTextItem(item as MarkdownRichText[number]))
                    .join("")
                : "";

            return (
                `<td${ isMarkdownColor(cellColor) ? ` color=${ quoteAttribute(cellColor) }` : "" }>` +
                `${cellValue}</td>`
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
