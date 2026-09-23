/**
 * Parser for the tab-indented Markdown-enhanced content format.
 *
 * @module react-native-notion-markdown/document/parser
 *
 * @file      parser.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    MARKDOWN_MARKDOWN_METADATA,
    type MarkdownBlock,
    type MarkdownBlockType,
    type MarkdownColor,
    type MarkdownDiagnostic,
    type MarkdownDocument,
    type MarkdownMetadata,
    type MarkdownRichText,
    type ParseMarkdownOptions,
    type ParseMarkdownResult
} from "./types.ts";
import MarkdownIt from "markdown-it";
import { asRecord } from "../internal.ts";

interface SourceLine
{
    readonly raw: string;
    readonly text: string;
    readonly indent: number;
    readonly number: number;
}

interface InlineToken
{
    readonly type: string;
    readonly content: string;
    readonly attrGet: (name: string) => string | null;
}

interface ParseContext
{
    readonly lines: Array<SourceLine>;
    readonly diagnostics: Array<MarkdownDiagnostic>;
    readonly idFactory: (path: string, type: MarkdownBlockType) => string;
    readonly rules: Array<NonNullable<ParseMarkdownOptions["rules"]>[number]>;
}

/**
 * Parse inline Markdown in the given value into renderer-neutral tokens.
 *
 * @category Functions
 * @since 1.0.0
 */
function inlineTokens(value: string): Array<InlineToken>
{
    const tokens = markdown.parseInline(value, { }) as unknown as Array<InlineToken>;
    const first = tokens[0] as unknown as { children?: Array<InlineToken>; } | undefined;

    return first?.children ?? [ ];
}

interface AnnotationState
{
    readonly bold?: boolean;
    readonly italic?: boolean;
    readonly strikethrough?: boolean;
    readonly underline?: boolean;
    readonly code?: boolean;
    readonly color?: MarkdownColor;
}

const markdown = new MarkdownIt({
    breaks: false,
    html: false,
    linkify: false,
    typographer: false
});

const blockTypes: ReadonlySet<string> = new Set([
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
    "callout",
    "code",
    "equation",
    "divider",
    "table",
    "table_row",
    "column_list",
    "column",
    "image",
    "audio",
    "video",
    "file",
    "pdf",
    "embed",
    "bookmark",
    "link_to_page",
    "table_of_contents",
    "synced_block",
    "synced_block_reference"
]);
const inlineTagNames: ReadonlySet<string> = new Set([
    "span",
    "br",
    "mention-user",
    "mention-page",
    "mention-database",
    "mention-data-source",
    "mention-agent",
    "mention-date",
    "page",
    "database"
]);

/**
 * Add a parser diagnostic for the given source line and message.
 *
 * @category Functions
 * @since 1.0.0
 */
function diagnostic(
    context: ParseContext,
    line: SourceLine | undefined,
    code: string,
    message: string,
    severity: "error" | "warning" = "warning"
): void
{
    context.diagnostics.push({
        code,
        message,
        severity,
        source: line === undefined
            ? undefined
            : {
                column: line.indent + 1,
                line: line.number
            }
    });
}

/**
 * Parse trailing key-value attributes from the given source text.
 *
 * @category Functions
 * @since 1.0.0
 */
function attributes(value: string): Record<string, string>
{
    const result: Record<string, string> = { };
    const source = value.trim().replace(/^\{/, "").replace(/\}$/, "");
    const pattern = /([A-Za-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;

    let match: RegExpExecArray | null;

    while ((match = pattern.exec(source)) !== null)
    {
        result[match[1]!] =
            match[2] ??
            match[3] ??
            match[4] ??
            "";
    }

    return result;
}

/**
 * Build metadata for a block parsed from the given source line.
 *
 * @category Functions
 * @since 1.0.0
 */
function blockMetadata(
    line: SourceLine,
    attrs: Record<string, string>,
    extra: MarkdownMetadata = { }
): MarkdownMetadata
{
    const color = attrs.color as MarkdownColor | undefined;

    return {
        ...extra,
        [ "source" ]:
        {
            column: line.indent + 1,
            line: line.number
        },
        ...(color === undefined ? { } : { color }),
        ...(attrs.toggle === "true" ? { toggle: true } : { }),
        ...(attrs.inline === "true" ? { inline: true } : { }),
        ...(attrs.icon === undefined ? { } : { icon: attrs.icon })
    };
}

/**
 * Create a block of the given type with parser metadata and optional children.
 *
 * @category Functions
 * @since 1.0.0
 */
function makeBlock<BlockType extends MarkdownBlockType>(
    context: ParseContext,
    type: BlockType,
    path: string,
    payload: unknown,
    line: SourceLine,
    attrs: Record<string, string> = { },
    children?: Array<MarkdownBlock>,
    extraMetadata: MarkdownMetadata = { }
): MarkdownBlock<BlockType>
{
    const key = type as string;
    const generatedId = context.idFactory(path, type);
    return {
        id: generatedId,
        [ key ]: payload,
        ...(children === undefined ? { } : { children }),
        [ MARKDOWN_MARKDOWN_METADATA ]: blockMetadata(
            line,
            attrs,
            {
                editorId: generatedId,
                ...extraMetadata
            }),
        type
    } as MarkdownBlock<BlockType>;
}

/**
 * Convert inline content into plain text while preserving supported metadata.
 *
 * @category Functions
 * @since 1.0.0
 */
function plainText(
    content: string,
    state: AnnotationState = { },
    metadata?: MarkdownMetadata
): MarkdownRichText[number]
{
    const annotations = Object.keys(state).length === 0
        ? undefined
        : {
            bold: state.bold ?? false,
            code: state.code ?? false,
            italic: state.italic ?? false,
            strikethrough: state.strikethrough ?? false,
            underline: state.underline ?? false,
            ...(state.color === undefined ? { } : { color: state.color })
        };

    return {
        text: { content },
        type: "text",
        ...(annotations === undefined ? { } : { annotations }),
        ...(metadata === undefined ? { } : { [ MARKDOWN_MARKDOWN_METADATA ]: metadata })
    } as MarkdownRichText[number];
}

/**
 * Extract an identifier of the given kind from a Markdown reference URL.
 *
 * @category Functions
 * @since 1.0.0
 */
function extractId(url: string | undefined, kind: string): string | undefined
{
    if (url === undefined)
    {
        return undefined;
    }

    const match = url.match(new RegExp(`(?:\\{\\{)?${kind}://([^}]+)`));
    return match?.[1];
}

/**
 * Build a rich-text item for a supported custom inline tag.
 *
 * @category Functions
 * @since 1.0.0
 */
function customRichText(
    tag: string,
    attrs: Record<string, string>,
    body: string | undefined,
    context: ParseContext,
    line: SourceLine
): MarkdownRichText
{
    const content = body ?? attrs.title ?? "";

    if (tag === "br")
    {
        return [ plainText("\n") ];
    }

    if (tag === "span")
    {
        return parseInline(
            content,
            context,
            line,
            {
                ...(attrs.underline === "true" ? { underline: true } : { }),
                ...(attrs.color === undefined ? { } : { color: attrs.color as MarkdownColor })
            }
        );
    }

    if (tag === "mention-date")
    {
        const start = attrs.start;
        if (start === undefined)
        {
            diagnostic(
                context,
                line,
                "mention-date-start",
                "A mention-date requires a start attribute.", "error"
            );

            return [ plainText(content, { }, { mention: { kind: "date" }, unresolved: true }) ];
        }

        const startValue = attrs.startTime === undefined ? start : `${start}T${attrs.startTime}`;
        const date: Record<string, string> = { start: startValue };

        if (attrs.end !== undefined)
        {
            date.end = attrs.end;
        }

        if (attrs.timeZone !== undefined)
        {
            date.time_zone = attrs.timeZone;
        }

        return [ {
            mention:
            {
                date,
                type: "date"
            },
            type: "mention"
        } as MarkdownRichText[number] ];
    }

    const mentionKinds: Readonly<Record<string, string>> =
        {
            "mention-agent": "agent",
            "mention-data-source": "data_source",
            "mention-database": "database",
            "mention-page": "page",
            "mention-user": "user"
        } as const;

    const mentionKind = mentionKinds[tag];
    if (mentionKind !== undefined)
    {
        const url = attrs.url;
        const id = extractId(url, mentionKind.replace("data_source", "data-source"));
        const metadata: MarkdownMetadata =
            {
                mention:
                {
                    kind: mentionKind,
                    ...(url === undefined ? { } : { url }),
                    ...(content === "" ? { } : { label: content })
                },
                ...(id === undefined ? { unresolved: true } : { })
            };

        if (id !== undefined && [ "user", "page", "database" ].includes(mentionKind))
        {
            const mention = mentionKind === "user"
                ? {
                    mention:
                    {
                        type: "user",
                        user: { id }
                    },
                    type: "mention"
                }
                : {
                    mention:
                    {
                        [ mentionKind ]: { id },
                        type: mentionKind
                    },
                    type: "mention"
                };

            return [ {
                ...mention,
                [ MARKDOWN_MARKDOWN_METADATA ]: metadata
            } as MarkdownRichText[number] ];
        }

        return [ plainText(content || url || tag, { }, metadata) ] as const;
    }

    if (tag === "page" || tag === "database")
    {
        const url = attrs.url;
        const id = extractId(url, tag);
        const metadata: MarkdownMetadata =
            {
                mention:
                {
                    kind: tag,
                    ...(url === undefined ? { } : { url }),
                    ...(content === "" ? { } : { label: content })
                },
                referenceUrl: url,
                ...(id === undefined ? { unresolved: true } : { })
            };
        if (id !== undefined)
        {
            return [ {
                [ MARKDOWN_MARKDOWN_METADATA ]: metadata,
                mention:
                {
                    [ tag ]: { id },
                    type: tag
                },
                type: "mention"
            } as MarkdownRichText[number] ];
        }
        return [ plainText(content || url || tag, {}, metadata) ];
    }
    return [ plainText(content) ];
}

/**
 * Convert inline Markdown tokens into document rich-text items.
 *
 * @category Functions
 * @since 1.0.0
 */
function parseMarkdownTokens(
    tokens: Array<InlineToken>,
    context: ParseContext,
    line: SourceLine,
    state: AnnotationState = { }
): MarkdownRichText
{
    const result: MarkdownRichText = [ ];
    const marks: Array<AnnotationState> = [ state ];
    let link: string | undefined;
    const current = (): AnnotationState => marks[marks.length - 1]!;
    for (const token of tokens)
    {
        switch (token.type)
        {
            case "text":
                if (token.content !== "")
                {
                    const item = plainText(token.content, current());
                    result.push(link === undefined ? item : {
                        ...(item as unknown as Record<string, unknown>),
                        text:
                        {
                            ...asRecord((item as unknown as Record<string, unknown>).text),
                            link: { url: link }
                        }
                    } as MarkdownRichText[number]);
                }
                break;
            case "code_inline":
            {
                const item = plainText(token.content, { ...current(), code: true });
                result.push(link === undefined ? item : {
                    ...(item as unknown as Record<string, unknown>),
                    text:
                    {
                        ...asRecord((item as unknown as Record<string, unknown>).text),
                        link: { url: link }
                    }
                } as MarkdownRichText[number]);
                break;
            }
            case "softbreak":
            case "hardbreak":
                result.push(plainText("\n", current()));
                break;
            case "strong_open":
                marks.push({ ...current(), bold: true });
                break;
            case "strong_close":
                marks.pop();
                break;
            case "em_open":
                marks.push({ ...current(), italic: true });
                break;
            case "em_close":
                marks.pop();
                break;
            case "s_open":
                marks.push({ ...current(), strikethrough: true });
                break;
            case "s_close":
                marks.pop();
                break;
            case "link_open":
                link = token.attrGet("href") ?? undefined;
                break;
            case "link_close":
                link = undefined;
                break;
            default:
                if (token.content !== "")
                {
                    result.push(plainText(token.content, current()));
                }

                break;
        }
    }

    return result;
}

/**
 * Parse inline Markdown and return rich text with the given source location.
 *
 * @category Functions
 * @since 1.0.0
 */
function parseInline(
    value: string,
    context: ParseContext,
    line: SourceLine,
    state: AnnotationState = { }
): MarkdownRichText
{
    const result: MarkdownRichText = [ ];
    let cursor = 0;

    /* eslint-disable-next-line @stylistic/max-len */
    const special = /<span\b([^>]*)>([\s\S]*?)<\/span>|<br\s*\/?\s*>|<(mention-(?:user|page|database|data-source|agent|date))\b([^>]*)>([\s\S]*?)<\/\3\s*>|<(mention-date)\b([^>]*)\s*\/?\s*>|<(page|database)\b([^>]*)>([\s\S]*?)<\/\8\s*>|\[\^([^\]]+)\]|\$([^$\n]+)\$|:([A-Za-z0-9_+-]+):|<(mention-(?:user|page|database|data-source|agent))\b([^>]*)\s*\/>/gi;

    let match: RegExpExecArray | null;
    while ((match = special.exec(value)) !== null)
    {
        const preceding = value.slice(0, match.index).match(/\\+$/)?.[0].length ?? 0;
        if (preceding % 2 === 1)
        {
            continue;
        }

        if (match.index > cursor)
        {
            result.push(...parseMarkdownTokens(
                inlineTokens(value.slice(cursor, match.index)),
                context,
                line,
                state
            ));
        }

        const full = match[0];

        if (full.toLowerCase().startsWith("<span"))
        {
            result.push(...parseInline(match[2] ?? "", context, line, {
                ...state,
                ...(attributes(match[1] ?? "").underline === "true" ? { underline: true } : { }),
                ...(attributes(match[1] ?? "").color === undefined
                    ? { }
                    : { color: attributes(match[1] ?? "").color as MarkdownColor }
                )
            }));
        }
        else if (full.toLowerCase().startsWith("<br")) {result.push(plainText("\n", state));}
        else if (match[3] !== undefined)
        {
            result.push(...customRichText(
                match[3].toLowerCase(),
                attributes(match[4] ?? ""),
                match[5],
                context,
                line
            ));
        }
        else if (match[6] !== undefined)
        {
            result.push(...customRichText(
                match[6]!.toLowerCase(),
                attributes(match[7] ?? ""),
                undefined,
                context,
                line
            ));
        }
        else if (match[8] !== undefined)
        {
            result.push(...customRichText(
                match[8].toLowerCase(),
                attributes(match[9] ?? ""),
                match[10],
                context,
                line
            ));
        }
        else if (match[14] !== undefined)
        {
            result.push(...customRichText(
                match[14].toLowerCase(),
                attributes(match[15] ?? ""),
                undefined,
                context,
                line
            ));
        }
        else if (match[11] !== undefined)
        {
            result.push(plainText(match[11], { }, { citationUrl: match[11] }));
        }
        else if (match[12] !== undefined)
        {
            result.push({
                equation: { expression: match[12] },
                type: "equation"
            } as MarkdownRichText[number]);
        }
        else if (match[13] !== undefined)
        {
            result.push(plainText(match[13], {}, { emojiName: match[13] }));
        }
        cursor = match.index + full.length;
    }

    if (cursor < value.length)
    {
        result.push(...parseMarkdownTokens(inlineTokens(value.slice(cursor)), context, line, state));
    }

    return result;
}

/**
 * Separate trailing attributes from the given source value.
 *
 * @category Functions
 * @since 1.0.0
 */
function removeTrailingAttributes(value: string): { text: string; attrs: Record<string, string> }
{
    const match = value.match(/^(.*?)(?:\s+\{([^{}]*)\})?$/);
    return { text: (match?.[1] ?? value).trimEnd(), attrs: attributes(match?.[2] ?? "") };
}

/**
 * Find the minimum indentation of child lines after the given starting index.
 *
 * @category Functions
 * @since 1.0.0
 */
function minChildIndent(
    lines: Array<SourceLine>,
    start: number,
    end: number,
    parentIndent: number
): number | undefined
{
    const indents = lines
        .slice(start, end)
        .filter((line: SourceLine) => line.text.trim() !== "" && line.indent > parentIndent)
        .map((line: SourceLine) => line.indent);

    return indents.length === 0 ? undefined : Math.min(...indents);
}

/** Extract a code-fence language while tolerating Notion's optional `theme={null}` suffix. */
function codeFenceLanguage(value: string): string
{
    const info = value.slice(3).trim();
    const language = info.replace(/(?:^|\s+)theme=\{null\}\s*$/, "").trim();
    return language || "plain text";
}

/**
 * Find the corresponding closing line for a fenced or delimited block.
 *
 * @category Functions
 * @since 1.0.0
 */
function findClosing(
    lines: Array<SourceLine>,
    start: number,
    end: number,
    tag: string,
    indent: number
): number
{
    const close = new RegExp(`^</${ tag }\\s*>$`, "i");
    for (let index: number = start; index < end; index += 1)
    {
        if (lines[index]!.indent === indent && close.test(lines[index]!.text.trim()))
        {
            return index;
        }
    }

    return end;
}

/**
 * Parse child blocks beginning at the given source index.
 *
 * @category Functions
 * @since 1.0.0
 */
function parseChildren(
    context: ParseContext,
    start: number,
    end: number,
    parentIndent: number,
    path: string
): Array<MarkdownBlock>
{
    const indent = minChildIndent(context.lines, start, end, parentIndent);

    if (indent === undefined)
    {
        return [ ];
    }

    const childStart = context.lines.findIndex((line: SourceLine, index: number) =>
        index >= start &&
        index < end &&
        line.text.trim() !== "" &&
        line.indent >= indent
    );

    return parseSequence(context, childStart < 0 ? start : childStart, end, indent, path);
}

/**
 * Parse child blocks that follow the given parent block.
 *
 * @category Functions
 * @since 1.0.0
 */
function followingChildren(
    context: ParseContext,
    start: number,
    end: number,
    parentIndent: number,
    path: string
): {
    children: Array<MarkdownBlock>;
    next: number;
}
{
    let first = start;
    while (first < end && context.lines[first]!.text.trim() === "") {first += 1;}
    if (first >= end || context.lines[first]!.indent <= parentIndent) {return { children: [], next: start };}
    let childEnd = first;
    while (
        childEnd < end &&
        (
            context.lines[childEnd]!.text.trim() === "" ||
            context.lines[childEnd]!.indent > parentIndent
        )
    )
    {
        childEnd += 1;
    }
    return {
        children: parseChildren(context, first, childEnd, parentIndent, path), next: childEnd
    };
}

/**
 * Parse a table beginning at the given source index.
 *
 * @category Functions
 * @since 1.0.0
 */
function parseTable(
    context: ParseContext,
    start: number,
    end: number,
    line: SourceLine,
    path: string,
    attrs: Record<string, string>
): { block: MarkdownBlock; next: number }
{
    const close = findClosing(context.lines, start + 1, end, "table", line.indent);
    const rows: Array<MarkdownBlock> = [ ];
    const bodyEnd = close === end ? end : close;
    const rowPattern = /^<tr(?:\s+([^>]*))?>([\s\S]*)<\/tr>$/i;
    const columnColors: Array<MarkdownColor | undefined> = [];
    const columnPattern = /<col(?:\s+([^>]*))?\s*\/?\s*>/gi;
    const tableBody = context.lines.slice(start + 1, bodyEnd).map((bodyLine) => bodyLine.text).join("\n");
    let columnMatch: RegExpExecArray | null;
    while ((columnMatch = columnPattern.exec(tableBody)) !== null)
    {
        columnColors.push(attributes(columnMatch[1] ?? "").color as MarkdownColor | undefined);
    }
    for (let index = start + 1, rowIndex = 0; index < bodyEnd; index += 1)
    {
        const rowLine = context.lines[index]!;
        const rowMatch = rowLine.text.trim().match(rowPattern);
        if (rowMatch === null)
        {
            continue;
        }

        const cells: Array<MarkdownRichText> = [ ];
        const cellPattern = /<td(?:\s+([^>]*))?>([\s\S]*?)<\/td>/gi;
        let cellMatch: RegExpExecArray | null;
        const cellColors: Array<MarkdownColor | undefined> = [ ];

        while ((cellMatch = cellPattern.exec(rowMatch[2] ?? "")) !== null)
        {
            const cellAttrs = attributes(cellMatch[1] ?? "");
            const cell = parseInline(cellMatch[2]!, context, rowLine);
            cells.push(cell);
            cellColors.push(cellAttrs.color as MarkdownColor | undefined);
        }

        const rowAttrs = attributes(rowMatch[1] ?? "");
        rows.push(makeBlock(context, "table_row", `${path}.${rowIndex}`, { cells }, rowLine, {}, undefined, {
            table:
            {
                ...(rowAttrs.color === undefined ? {} : { rowColor: rowAttrs.color as MarkdownColor }),
                ...(cellColors.some((color: MarkdownColor | undefined) => color !== undefined)
                    ? { cellColors }
                    : { }
                )
            }
        }));

        rowIndex += 1;
    }

    if (close === end)
    {
        diagnostic(
            context,
            line,
            "unclosed-table",
            "The table has no closing </table> tag.",
            "error"
        );
    }

    const width = rows.reduce(
        (maximum: number, row: MarkdownBlock) =>
            Math.max(
                maximum,
                (((row as unknown as { readonly table_row: unknown; })
                    .table_row as { cells: ReadonlyArray<unknown>; }).cells).length),
        0
    );
    const tablePayload = {
        has_column_header: attrs["header-row"] === "true",
        has_row_header: attrs["header-column"] === "true",
        table_width: width
    };
    const block = makeBlock(
        context,
        "table",
        path,
        tablePayload,
        line,
        { },
        rows,
        {
            table:
            {
                fitPageWidth: attrs["fit-page-width"] === "true",
                headerColumn: attrs["header-column"] === "true",
                headerRow: attrs["header-row"] === "true",
                ...(columnColors.length === 0 ? { } : { columnColors })
            }
        }
    );

    return {
        block,
        next: close === end ? end : close + 1
    } as const;
}

/**
 * Parse a pipe-delimited table beginning at the given source index.
 *
 * @category Functions
 * @since 1.0.0
 */
function parsePipeTable(
    context: ParseContext,
    start: number,
    end: number,
    path: string
): {
    readonly block: MarkdownBlock;
    readonly next: number;
}
{
    const source = context.lines[start]!;
    const rows: Array<Array<string>> = [ ];
    let index = start;
    let hasHeader = false;
    while (index < end &&
        context.lines[index]!.indent === source.indent &&
        context.lines[index]!.text.trim().startsWith("|")
    )
    {
        const value = context.lines[index]!.text.trim();
        const cells = value
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell: string) => cell.trim());

        if (index === start + 1 && cells.every((cell: string) => /^:?-{3,}:?$/.test(cell)))
        {
            hasHeader = true;
        }
        else
        {
            rows.push(cells);
        }

        index += 1;
    }

    const children = rows.map((cells: ReadonlyArray<string>, rowIndex: number) =>
        makeBlock(
            context,
            "table_row",
            `${ path }.${ rowIndex }`,
            {
                cells: cells.map((cell: string) => parseInline(cell, context, source))
            },
            source
        )
    );

    const width = rows.reduce(
        (maximum: number, row: ReadonlyArray<string>) => Math.max(maximum, row.length), 0
    );

    return {
        block: makeBlock(
            context,
            "table",
            path,
            {
                has_column_header: hasHeader,
                has_row_header: false,
                table_width: width
            },
            source,
            { },
            children,
            {
                table:
                {
                    fitPageWidth: false,
                    headerColumn: false,
                    headerRow: hasHeader
                }
            }),
        next: index
    };
}

/**
 * Parse a sequence of block lines beginning at the given source index.
 *
 * @category Functions
 * @since 1.0.0
 */
function parseSequence(
    context: ParseContext,
    start: number,
    end: number,
    indent: number,
    path: string
): Array<MarkdownBlock>
{
    const result: Array<MarkdownBlock> = [ ];
    let index = start;

    while (index < end)
    {
        const line = context.lines[index]!;

        if (line.text.trim() === "")
        {
            index += 1;
            continue;
        }

        if (line.indent < indent)
        {
            break;
        }

        if (line.indent > indent)
        {
            diagnostic(context, line, "unexpected-indentation", "Child blocks must be nested with tabs.");
            index += 1;
            continue;
        }

        const value = line.text.trim();
        const pathValue = `${ path }.${ result.length }`;
        let extended = false;
        for (const rule of context.rules)
        {
            if (!rule.test(value))
            {
                continue;
            }

            try
            {
                const block = rule.parse({
                    line: value,
                    path: pathValue,
                    source:
                    {

                        column: line.indent + 1,
                        line: line.number
                    }
                });

                if (block !== undefined)
                {
                    result.push(block);
                }

                extended = true;
            }
            catch (error)
            {
                diagnostic(
                    context,
                    line,
                    "parser-extension-error",
                    `Parser extension '${ rule.name }' failed: ${ String(error) }`,
                    "error"
                );

                extended = true;
            }
            break;
        }
        if (extended)
        {
            index += 1;
            continue;
        }
        if (/^```/.test(value))
        {
            const language = codeFenceLanguage(value);

            let close = index + 1;
            while (close < end && !/^\s*```\s*$/.test(context.lines[close]!.text)) {close += 1;}
            const content = context.lines
                .slice(index + 1, close)
                .map((codeLine: SourceLine) => codeLine.indent > indent
                    ? codeLine.raw.slice(indent + 1)
                    : codeLine.raw)
                .join("\n");

            result.push(makeBlock(
                context,
                "code",
                pathValue,
                {
                    language,
                    rich_text: [ plainText(content) ]
                },
                line
            ));

            if (close === end)
            {
                diagnostic(
                    context,
                    line,
                    "unclosed-code",
                    "The fenced code block has no closing fence.",
                    "error"
                );
            }

            index = close === end ? end : close + 1;

            continue;
        }
        if (value === "$$")
        {
            let close = index + 1;
            while (close < end && context.lines[close]!.text.trim() !== "$$")
            {
                close += 1;
            }

            const expression = context.lines
                .slice(index + 1, close)
                .map((equationLine: SourceLine) => equationLine.text)
                .join("\n");

            result.push(makeBlock(context, "equation", pathValue, { expression }, line));

            if (close === end)
            {
                diagnostic(
                    context,
                    line,
                    "unclosed-equation",
                    "The equation has no closing $$ delimiter.",
                    "error"
                );
            }

            index = close === end ? end : close + 1;
            continue;
        }

        if (/^\|/.test(value))
        {
            const table = parsePipeTable(context, index, end, pathValue);
            result.push(table.block);
            index = table.next;
            continue;
        }

        const tableMatch = value.match(/^<table(?:\s+([^>]*))?>$/i);

        if (tableMatch !== null)
        {
            const table = parseTable(context, index, end, line, pathValue, attributes(tableMatch[1] ?? ""));
            result.push(table.block);
            index = table.next;
            continue;
        }

        const container = value.match(
            /^<(callout|details|columns|column|synced_block|synced_block_reference)(?:\s+([^>]*))?>$/i
        );

        if (container !== null)
        {
            const tag = container[1]!.toLowerCase();
            const attrs = attributes(container[2] ?? "");
            const close = findClosing(context.lines, index + 1, end, tag, indent);
            const bodyEnd = close === end ? end : close;
            const children = parseChildren(context, index + 1, bodyEnd, indent, pathValue);
            let block: MarkdownBlock;
            if (tag === "columns" || tag === "column")
            {
                block = makeBlock(
                    context,
                    tag === "columns" ? "column_list" : "column",
                    tag === "columns" ? pathValue : pathValue,
                    // @TODO Should this ternary return something else?
                    tag === "columns" ? { } : { },
                    line,
                    attrs,
                    children
                );
            }
            else if (tag === "details")
            {
                const summary = context.lines
                    .slice(index + 1, bodyEnd)
                    .find((bodyLine: SourceLine) => /^<summary>/.test(bodyLine.text.trim()));
                const title = summary?.text
                    .trim()
                    .replace(/^<summary>/i, "")
                    .replace(/<\/summary>$/i, "") ?? "";

                block = makeBlock(
                    context,
                    "toggle",
                    pathValue,
                    {
                        rich_text: parseInline(title, context, summary ?? line)
                    },
                    line,
                    attrs,
                    children
                );
            }
            else if (tag === "callout")
            {
                const first = context.lines
                    .slice(index + 1, bodyEnd)
                    .find((bodyLine: SourceLine) => bodyLine.text.trim() !== "");

                const rich = first === undefined
                    ? [ ]
                    : parseInline(first.text.trim(), context, first);

                const childStart = first === undefined
                    ? index + 1
                    : context.lines.indexOf(first) + 1;

                const remainingChildren = first === undefined
                    ? children
                    : parseChildren(context, childStart, bodyEnd, indent, `${ pathValue }.children`);

                block = makeBlock(
                    context,
                    "callout",
                    pathValue,
                    {
                        icon:
                        {
                            emoji: attrs.icon ?? "💬",
                            type: "emoji"
                        },
                        rich_text: rich
                    },
                    line,
                    attrs,
                    remainingChildren
                );
            }
            else
            {
                const url = attrs.url;
                const metadata = { referenceUrl: url, ...(url === undefined ? { unresolved: true } : {}) };
                block = makeBlock(
                    context,
                    tag === "synced_block"
                        ? "synced_block"
                        : "synced_block_reference",
                    pathValue,
                    { synced_from: null },
                    line,
                    attrs,
                    children,
                    metadata
                );
            }
            result.push(block);

            if (close === end)
            {
                diagnostic(
                    context,
                    line,
                    "unclosed-container",
                    `The <${ tag }> block has no closing tag.`,
                    "error"
                );
            }

            index = close === end ? end : close + 1;
            continue;
        }
        if (/^<(empty-block)\s*\/>$/i.test(value))
        {
            result.push(makeBlock(
                context,
                "paragraph",
                pathValue,
                {
                    rich_text: [ ]
                },
                line,
                { },
                undefined,
                { empty: true }
            ));

            index += 1;
            continue;
        }

        if (/^<table_of_contents(?:\s+([^>]*))?\s*\/>$/i.test(value))
        {
            const match = value.match(/^<table_of_contents(?:\s+([^>]*))?\s*\/>$/i)!;
            const tocAttrs = attributes(match[1] ?? "");

            result.push(makeBlock(
                context,
                "table_of_contents",
                pathValue,
                {
                    color: tocAttrs.color as MarkdownColor | undefined
                },
                line,
                tocAttrs
            ));

            index += 1;
            continue;
        }

        if (/^---\s*$/.test(value))
        {
            result.push(makeBlock(context, "divider", pathValue, {}, line));
            index += 1;
            continue;
        }

        const heading = value.match(/^(#{1,6})\s+(.+)$/);

        if (heading !== null)
        {
            const level = Math.min(4, heading[1]!.length);
            const parsed = removeTrailingAttributes(heading[2]!);
            const nested = parsed.attrs.toggle === "true"
                ? followingChildren(context, index + 1, end, indent, `${ pathValue }.children`)
                : { children: [ ], next: index + 1 };

            result.push(makeBlock(
                context,
                `heading_${ level }` as MarkdownBlockType,
                pathValue,
                {
                    rich_text: parseInline(parsed.text, context, line),
                    ...(parsed.attrs.toggle === "true" ? { is_toggleable: true } : { })
                },
                line,
                parsed.attrs,
                parsed.attrs.toggle === "true" ? nested.children : undefined
            ));

            index = nested.next;
            continue;
        }
        const todo = value.match(/^- \[([ xX])\]\s*(.*)$/);
        if (todo !== null)
        {
            const parsed = removeTrailingAttributes(todo[2]!);
            const nested = followingChildren(context, index + 1, end, indent, `${ pathValue }.children`);

            result.push(makeBlock(
                context,
                "to_do",
                pathValue,
                {
                    checked: todo[1]!.toLowerCase() === "x",
                    rich_text: parseInline(parsed.text, context, line)
                },
                line,
                parsed.attrs,
                nested.children
            ));

            index = nested.next === index + 1 ? index + 1 : nested.next;
            continue;
        }

        const bullet = value.match(/^-\s+(.*)$/);
        if (bullet !== null)
        {
            const parsed = removeTrailingAttributes(bullet[1]!);
            const nested = followingChildren(context, index + 1, end, indent, `${pathValue}.children`);
            result.push(makeBlock(
                context,
                "bulleted_list_item",
                pathValue,
                {
                    rich_text: parseInline(parsed.text, context, line)
                },
                line,
                parsed.attrs,
                nested.children
            ));

            index = nested.next === index + 1 ? index + 1 : nested.next;

            continue;
        }

        const numbered = value.match(/^\d+[.)]\s+(.*)$/);

        if (numbered !== null)
        {
            const parsed = removeTrailingAttributes(numbered[1]!);
            const nested = followingChildren(context, index + 1, end, indent, `${pathValue}.children`);
            result.push(makeBlock(
                context,
                "numbered_list_item",
                pathValue,
                {
                    rich_text: parseInline(parsed.text, context, line)
                },
                line,
                parsed.attrs,
                nested.children
            ));

            index = nested.next === index + 1 ? index + 1 : nested.next;

            continue;
        }

        const quote = value.match(/^>\s?(.*)$/);

        if (quote !== null)
        {
            const parsed = removeTrailingAttributes(quote[1]!);
            const nested = followingChildren(context, index + 1, end, indent, `${pathValue}.children`);
            result.push(makeBlock(
                context,
                "quote",
                pathValue,
                {
                    rich_text: parseInline(parsed.text, context, line)
                },
                line,
                parsed.attrs,
                nested.children
            ));

            index = nested.next === index + 1 ? index + 1 : nested.next;

            continue;
        }

        const media = value.match(/^!\[([^\]]*)\]\(([^)]+)\)(?:\s+\{([^{}]*)\})?$/);

        if (media !== null)
        {
            const parsed = removeTrailingAttributes(media[1]!);
            result.push(makeBlock(
                context,
                "image",
                pathValue,
                {
                    caption: parseInline(parsed.text, context, line),
                    external: { url: media[2]! },
                    type: "external"
                },
                line,
                attributes(media[3] ?? "")
            ));

            index += 1;

            continue;
        }

        const mediaTag = value.match(/^<(audio|video|file|pdf|embed|bookmark)\s+([^>]*)>([\s\S]*?)<\/\1>$/i);

        if (mediaTag !== null)
        {
            const mediaAttrs = attributes(mediaTag[2]!);
            const payload = mediaTag[1] === "embed" || mediaTag[1] === "bookmark"
                ? {
                    caption: parseInline(mediaTag[3]!, context, line),
                    url: mediaAttrs.src ?? mediaAttrs.url ?? ""
                }
                : {
                    caption: parseInline(mediaTag[3]!, context, line),
                    external:
                    {
                        url: mediaAttrs.src ?? ""
                    },
                    type: "external"
                };

            result.push(makeBlock(
                context,
                mediaTag[1]!.toLowerCase() as MarkdownBlockType,
                pathValue,
                payload,
                line,
                mediaAttrs
            ));

            index += 1;

            continue;
        }
        const reference = value.match(/^<(page|database)\s+([^>]*)>([\s\S]*?)<\/\1>$/i);
        if (reference !== null)
        {
            const referenceAttrs = attributes(reference[2]!);
            result.push(makeBlock(
                context,
                "link_to_page",
                pathValue,
                reference[1]!.toLowerCase() === "database"
                    ? { database_id: referenceAttrs.url ?? "" }
                    : { page_id: referenceAttrs.url ?? "" },
                line,
                referenceAttrs,
                undefined,
                {
                    mention:
                    {
                        kind: reference[1]!,
                        label: reference[3]
                    },
                    referenceUrl: referenceAttrs.url
                }
            ));

            index += 1;

            continue;
        }

        const parsed = removeTrailingAttributes(value);
        const unknownTag = value.match(/^<([A-Za-z][\w-]*)\b/);

        if (
            unknownTag !== null &&
            !blockTypes.has(unknownTag[1]!.toLowerCase()) &&
            !inlineTagNames.has(unknownTag[1]!.toLowerCase())
        )
        {
            diagnostic(
                context,
                line,
                "unknown-block",
                `Unknown block tag <${ unknownTag[1] }> preserved as text block content.`
            );
        }

        result.push(makeBlock(
            context,
            "paragraph",
            pathValue,
            {
                rich_text: parseInline(parsed.text, context, line)
            },
            line,
            parsed.attrs
        ));

        index += 1;
    }
    return result;
}

/**
 * Parse enhanced Markdown into the versioned Markdown document model.
 *
 * @since 1.0.0
 */
export function parseMarkdown(
    markdownText: string, options
    : ParseMarkdownOptions = { }
): ParseMarkdownResult
{
    const lines: Array<SourceLine> = markdownText
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((raw: string, index: number) =>
        {
            const match = raw.match(/^(\t*)(.*)$/)!;
            return {
                indent: match[1]!.length,
                number: index + 1,
                raw,
                text: match[2]!
            };
        });

    const context: ParseContext =
        {
            diagnostics: [ ],
            idFactory:
                options.idFactory ??
                ((path: string, type: MarkdownBlockType) => `md:${ type }:${ path }`),
            lines,
            rules: options.rules ?? [ ]
        };

    const document: MarkdownDocument =
        {
            blocks: parseSequence(context, 0, lines.length, 0, "0"),
            version: 1
        };

    return {
        diagnostics: context.diagnostics,
        document
    } as const;
}
