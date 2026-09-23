/**
 * Pure adapters between the recursive document model and Markdown SDK blocks.
 *
 * @module react-native-notion-markdown/document/adapters
 *
 * @file      adapters.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type {
    BlockObjectRequest,
    BlockObjectResponse,
    PartialBlockObjectResponse
} from "@notionhq/client";
import {
    type FromMarkdownBlocksOptions,
    type FromMarkdownBlocksResult,
    MARKDOWN_MARKDOWN_METADATA,
    type MarkdownBlock,
    MarkdownConversionError,
    type MarkdownDiagnostic,
    type MarkdownDocument,
    type MarkdownBlockType,
    type MarkdownMetadata,
    type ToMarkdownBlocksOptions,
    type ToMarkdownBlocksResult
} from "./types.ts";
import {
    asRecord,
    fromSdkColor,
    getMarkdownBlockPayload,
    getMarkdownMetadata,
    toSdkColor
} from "../internal.ts";

type SdkRichTextContainer = Extract<BlockObjectRequest, { paragraph: unknown; }>;

type MarkdownSdkRichTextItemRequest =
    SdkRichTextContainer extends { paragraph: { rich_text: Array<infer Item>; }; }
        ? Item
        : never;

type SdkBlockInput =
    | BlockObjectResponse
    | PartialBlockObjectResponse;

/**
 * Check whether a given value is a canonical Markdown identifier.
 *
 * @category Functions
 * @since 1.0.0
 */
function IsMarkdownId(value: unknown): value is string
{
    return typeof value === "string" && /^(?:[0-9a-f]{8}-?){4}[0-9a-f]{4}$/i.test(value.replace(/-/g, ""));
}

/**
 * Extract a Markdown identifier from a reference URL or identifier value.
 *
 * @category Functions
 * @since 1.0.0
 */
function IdFromUrl(value: unknown): string | undefined
{
    if (typeof value !== "string")
    {
        return undefined;
    }

    const uri = value.match(/\{\{(?:page|database|block|user):\/\/([^}]+)\}\}/i);

    return uri?.[1] ?? (IsMarkdownId(value) ? value : undefined);
}

/**
 * Normalize an imported payload and convert SDK color names to Markdown color names.
 *
 * @category Functions
 * @since 1.0.0
 */
function NormalizeImportedPayload(value: unknown): Record<string, unknown>
{
    const result = { ...asRecord(value) };

    if (result.color !== undefined)
    {
        result.color = fromSdkColor(result.color);
    }

    if (result.annotations !== undefined)
    {
        result.annotations = {
            ...asRecord(result.annotations),
            color: fromSdkColor(asRecord(result.annotations).color)
        };
    }

    return result;
}

/**
 * Append a conversion diagnostic with the given severity.
 *
 * @category Functions
 * @since 1.0.0
 */
function Diagnostic(
    diagnostics: Array<MarkdownDiagnostic>,
    code: string,
    message: string,
    severity: "error" | "warning" = "warning"
): void
{
    diagnostics.push({ code, message, severity });
}

/**
 * Read child blocks from a value when its children property is an array.
 *
 * @category Functions
 * @since 1.0.0
 */
function childrenOf(value: Record<string, unknown>): Array<SdkBlockInput>
{
    return Array.isArray(value.children) ? value.children as Array<SdkBlockInput> : [];
}

/**
 * Convert one SDK block and its descendants into a document block.
 *
 * @category Functions
 * @since 1.0.0
 */
function fromBlock(
    input: SdkBlockInput,
    path: string,
    options: FromMarkdownBlocksOptions,
    diagnostics: Array<MarkdownDiagnostic>
): MarkdownBlock
{
    const value = asRecord(input);
    const type = typeof value.type === "string" ? value.type : "unsupported";
    const markdownId = typeof value.id === "string" ? value.id : undefined;
    const editorId =
        options.idFactory?.(path, markdownId) ??
        (markdownId === undefined
            ? `markdown:${ path }`
            : `markdown:${ markdownId }`
        );

    const blockMetadata: MarkdownMetadata =
        {
            ...getMarkdownMetadata(input),
            editorId,
            ...(markdownId === undefined ? { } : { markdownId })
        } as const;

    const GetChildFromBlock = (Child: SdkBlockInput, Index: number) => fromBlock(
        Child,
        `${ path }.${ Index }`,
        options,
        diagnostics
    );

    const children = childrenOf(value).map(GetChildFromBlock);

    const allowed: ReadonlySet<MarkdownBlockType> = new Set<MarkdownBlockType>([
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
        "synced_block"
    ]);

    if (!allowed.has(type as MarkdownBlockType))
    {
        Diagnostic(
            diagnostics,
            "unsupported-block",
            `The Markdown block type '${ type }' was imported as an empty text block.`
        );

        return {
            [ MARKDOWN_MARKDOWN_METADATA ]:
            {
                ...blockMetadata,
                unsupportedBlock: value,
                unsupportedType: type
            },
            children,
            id: markdownId ?? `markdown:${ path }`,
            paragraph: { rich_text: [ ] },
            type: "paragraph"
        } as MarkdownBlock;
    }

    const payload = NormalizeImportedPayload(value[type] ?? { });
    const payloadChildren = childrenOf(payload);
    const nestedChildren = children.length === 0 ? payloadChildren : [];
    delete payload.children;

    return {
        id: markdownId ?? `markdown:${ path }`,
        type,
        [ type ]: payload,
        ...(children.length === 0 && nestedChildren.length === 0
            ? { }
            : {
                children: children.length === 0
                    ? nestedChildren
                    : children
            }),
        [ MARKDOWN_MARKDOWN_METADATA ]: blockMetadata
    } as MarkdownBlock;
}

/**
 * Import SDK response/request-shaped blocks without making network requests.
 *
 * @since 1.0.0
 */
export function fromMarkdownBlocks(
    blocks: ReadonlyArray<SdkBlockInput>,
    options: FromMarkdownBlocksOptions = { }
): FromMarkdownBlocksResult
{
    const diagnostics: Array<MarkdownDiagnostic> = [ ];

    const GetBlock = (Block: SdkBlockInput, Index: number) => fromBlock(
        Block,
        String(Index),
        options,
        diagnostics
    );

    const document: MarkdownDocument =
        {
            blocks: blocks.map(GetBlock),
            version: 1
        } as const;

    return {
        diagnostics,
        document
    } as const;
}

/**
 * Convert rich-text items into SDK request items and record unsupported features.
 *
 * @category Functions
 * @since 1.0.0
 */
function ToRequestRichText(
    items: unknown,
    diagnostics: Array<MarkdownDiagnostic>
): ReadonlyArray<MarkdownSdkRichTextItemRequest>
{
    if (!Array.isArray(items))
    {
        return [ ] as const;
    }

    return items.map((item: unknown) =>
    {
        const value = asRecord(item);
        const itemMetadata = getMarkdownMetadata(item);
        const text = asRecord(value.text);
        if (value.type === "text" || text.content !== undefined)
        {
            if (itemMetadata.unresolved === true)
            {
                Diagnostic(
                    diagnostics,
                    "unresolved-rich-text",
                    "A Markdown-only rich-text item was exported as a text fallback.",
                    "error"
                );
            }
            if (itemMetadata.citationUrl !== undefined || itemMetadata.emojiName !== undefined)
            {
                Diagnostic(
                    diagnostics,
                    "rich-text-metadata-loss",
                    "A Markdown-only citation or custom emoji was exported as its text fallback."
                );
            }
            return {
                text:
                {
                    content: typeof text.content === "string"
                        ? text.content
                        : String(value.plain_text ?? ""),
                    ...(asRecord(text.link).url === undefined
                        ? { }
                        : {
                            link:
                            {
                                url: String(asRecord(text.link).url)
                            }
                        })
                },
                type: "text",
                ...(value.annotations === undefined
                    ? { }
                    : {
                        annotations:
                        {
                            ...asRecord(value.annotations),
                            color: toSdkColor(asRecord(value.annotations).color)
                        }
                    }
                )
            } as MarkdownSdkRichTextItemRequest;
        }
        if (value.type === "equation" && typeof asRecord(value.equation).expression === "string")
        {
            return {
                equation:
                {
                    expression: String(asRecord(value.equation).expression)
                },
                type: "equation"
            } as MarkdownSdkRichTextItemRequest;
        }
        if (value.type === "mention")
        {
            const mention = asRecord(value.mention);
            const kind = typeof mention.type === "string" ? mention.type : undefined;
            const source = kind === undefined ? { } : asRecord(mention[kind]);

            if (kind === "user" || kind === "page" || kind === "database")
            {
                if (!IsMarkdownId(source.id))
                {
                    Diagnostic(
                        diagnostics,
                        "unresolved-mention",
                        `The ${ kind } mention has no resolvable Markdown ID.`,
                        "error"
                    );

                    return {
                        text:
                        {
                            content: String(itemMetadata.mention?.label ?? "")
                        },
                        type: "text"
                    } as MarkdownSdkRichTextItemRequest;
                }

                return {
                    mention:
                    {
                        [ kind ]:
                        {
                            id: source.id
                        },
                        type: kind
                    },
                    type: "mention"
                } as MarkdownSdkRichTextItemRequest;
            }
            if (kind === "date" && asRecord(mention.date).start !== undefined)
            {
                return {
                    mention:
                    {
                        date: asRecord(mention.date),
                        type: "date"
                    },
                    type: "mention"
                } as MarkdownSdkRichTextItemRequest;
            }
        }

        Diagnostic(
            diagnostics,
            "unrepresentable-rich-text",
            "A rich-text item has no Markdown SDK representation.",
            "error"
        );

        return {
            text:
            {
                content: String(value.plain_text ?? value.content ?? "")
            },
            type: "text"
        } as MarkdownSdkRichTextItemRequest;
    });
}

/**
 * Convert one document block into an SDK request block when it is representable.
 *
 * @category Functions
 * @since 1.0.0
 */
function ToBlock(block: MarkdownBlock, diagnostics: Array<MarkdownDiagnostic>): BlockObjectRequest | undefined
{
    const data = getMarkdownBlockPayload(block);

    const childRequests = (block.children ?? [ ])
        .map((child: MarkdownBlock) => ToBlock(child, diagnostics))
        .filter((child: BlockObjectRequest | undefined): child is BlockObjectRequest => child !== undefined);

    const copy = { ...data } as Record<string, unknown>;

    if (childRequests.length > 0)
    {
        copy.children = childRequests;
    }

    if (copy.color === undefined && getMarkdownMetadata(block).color !== undefined)
    {
        copy.color = getMarkdownMetadata(block).color;
    }

    if (block.type === "synced_block_reference")
    {
        Diagnostic(
            diagnostics,
            "unrepresentable-synced-reference",
            "A synced block reference URL cannot be converted to the SDK's synced_from.block_id " +
                "without a Markdown block ID.",
            "error"
        );
        return undefined;
    }
    if (block.type === "link_to_page")
    {
        const blockMetadata = getMarkdownMetadata(block);
        const dataId = data.page_id ?? data.database_id;
        const id = IdFromUrl(dataId) ?? IdFromUrl(blockMetadata.referenceUrl);

        if (id === undefined)
        {
            Diagnostic(
                diagnostics,
                "unresolved-page-reference",
                "A page/database reference has no resolvable Markdown ID.",
                "error"
            );

            return undefined;
        }

        const kind = data.database_id === undefined ? "page_id" : "database_id";

        return {
            link_to_page:
            {
                [ kind ]: id
            },
            type: "link_to_page"
        } as unknown as BlockObjectRequest;
    }
    if (block.type === "table_row")
    {
        copy.cells = Array.isArray(data.cells)
            ? data.cells.map((cell: unknown) => ToRequestRichText(cell, diagnostics))
            : [ ];

        delete copy.children;

        return {
            table_row: copy,
            type: "table_row"
        } as unknown as BlockObjectRequest;
    }
    if (block.type === "table")
    {
        copy.children = (block.children ?? [ ])
            .map((child: MarkdownBlock) => ToBlock(child, diagnostics))
            .filter((child: BlockObjectRequest | undefined): child is BlockObjectRequest =>
                child !== undefined
            );

        return {
            table: copy,
            type: "table"
        } as unknown as BlockObjectRequest;
    }

    if (copy.color !== undefined)
    {
        copy.color = toSdkColor(copy.color);
    }

    if ("rich_text" in copy)
    {
        copy.rich_text = ToRequestRichText(copy.rich_text, diagnostics);
    }

    if ("caption" in copy)
    {
        copy.caption = ToRequestRichText(copy.caption, diagnostics);
    }

    if (block.type === "synced_block" && getMarkdownMetadata(block).referenceUrl !== undefined)
    {
        const id = IdFromUrl(getMarkdownMetadata(block).referenceUrl);

        if (id === undefined)
        {
            Diagnostic(
                diagnostics,
                "unresolved-synced-block",
                "A synced block URL cannot be converted to synced_from.block_id without a Markdown block ID.",
                "error"
            );

            return undefined;
        }
        copy.synced_from = { block_id: id };
    }
    return { type: block.type, [block.type]: copy } as unknown as BlockObjectRequest;
}

/**
 * Export SDK request payloads and retain explicit conversion diagnostics.
 *
 * @throws {MarkdownConversionError} Iff part of the document cannot be converted to a block.
 *
 * @since 1.0.0
 */
export function toMarkdownBlocks(
    document: MarkdownDocument,
    options: ToMarkdownBlocksOptions = { }
): ToMarkdownBlocksResult
{
    const diagnostics: Array<MarkdownDiagnostic> = [ ];
    const blocks = document.blocks.map((block: MarkdownBlock) =>
        ToBlock(block, diagnostics))
        .filter((block: BlockObjectRequest | undefined): block is BlockObjectRequest => block !== undefined);

    if (options.strict === true && diagnostics.some((item: MarkdownDiagnostic) => item.severity === "error"))
    {
        throw new MarkdownConversionError(diagnostics);
    }

    return { blocks, diagnostics };
}
