/**
 * Pure adapters between the recursive document model and Notion SDK blocks.
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
    type FromNotionBlocksOptions,
    type FromNotionBlocksResult,
    NOTION_MARKDOWN_METADATA,
    type NotionBlock,
    NotionConversionError,
    type NotionDiagnostic,
    type NotionDocument,
    type NotionMarkdownBlockType,
    type NotionMarkdownMetadata,
    type ToNotionBlocksOptions,
    type ToNotionBlocksResult
} from "./types.ts";
import {
    asRecord,
    fromSdkColor,
    getNotionBlockPayload,
    getNotionMarkdownMetadata,
    toSdkColor
} from "../internal.ts";

type SdkRichTextContainer = Extract<BlockObjectRequest, { paragraph: unknown; }>;

type NotionSdkRichTextItemRequest =
    SdkRichTextContainer extends { paragraph: { rich_text: Array<infer Item>; }; }
        ? Item
        : never;

type SdkBlockInput =
    | BlockObjectResponse
    | PartialBlockObjectResponse;

function IsNotionId(value: unknown): value is string
{
    return typeof value === "string" && /^(?:[0-9a-f]{8}-?){4}[0-9a-f]{4}$/i.test(value.replace(/-/g, ""));
}

function IdFromUrl(value: unknown): string | undefined
{
    if (typeof value !== "string")
    {
        return undefined;
    }

    const uri = value.match(/\{\{(?:page|database|block|user):\/\/([^}]+)\}\}/i);

    return uri?.[1] ?? (IsNotionId(value) ? value : undefined);
}

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

function Diagnostic(
    diagnostics: Array<NotionDiagnostic>,
    code: string,
    message: string,
    severity: "error" | "warning" = "warning"
): void
{
    diagnostics.push({ code, message, severity });
}

function childrenOf(value: Record<string, unknown>): Array<SdkBlockInput>
{
    return Array.isArray(value.children) ? value.children as Array<SdkBlockInput> : [];
}

function fromBlock(
    input: SdkBlockInput,
    path: string,
    options: FromNotionBlocksOptions,
    diagnostics: Array<NotionDiagnostic>
): NotionBlock
{
    const value = asRecord(input);
    const type = typeof value.type === "string" ? value.type : "unsupported";
    const notionId = typeof value.id === "string" ? value.id : undefined;
    const editorId =
        options.idFactory?.(path, notionId) ??
        (notionId === undefined
            ? `notion:${ path }`
            : `notion:${ notionId }`
        );

    const blockMetadata: NotionMarkdownMetadata =
        {
            ...getNotionMarkdownMetadata(input),
            editorId,
            ...(notionId === undefined ? { } : { notionId })
        } as const;

    const GetChildFromBlock = (Child: SdkBlockInput, Index: number) => fromBlock(
        Child,
        `${ path }.${ Index }`,
        options,
        diagnostics
    );

    const children = childrenOf(value).map(GetChildFromBlock);

    const allowed: ReadonlySet<NotionMarkdownBlockType> = new Set<NotionMarkdownBlockType>([
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

    if (!allowed.has(type as NotionMarkdownBlockType))
    {
        Diagnostic(
            diagnostics,
            "unsupported-block",
            `The Notion block type '${ type }' was imported as an empty paragraph.`
        );

        return {
            [ NOTION_MARKDOWN_METADATA ]:
            {
                ...blockMetadata,
                unsupportedBlock: value,
                unsupportedType: type
            },
            children,
            id: notionId ?? `notion:${ path }`,
            paragraph: { rich_text: [ ] },
            type: "paragraph"
        } as NotionBlock;
    }

    const payload = NormalizeImportedPayload(value[type] ?? { });
    const payloadChildren = childrenOf(payload);
    const nestedChildren = children.length === 0 ? payloadChildren : [];
    delete payload.children;

    return {
        id: notionId ?? `notion:${ path }`,
        type,
        [ type ]: payload,
        ...(children.length === 0 && nestedChildren.length === 0
            ? { }
            : {
                children: children.length === 0
                    ? nestedChildren
                    : children
            }),
        [ NOTION_MARKDOWN_METADATA ]: blockMetadata
    } as NotionBlock;
}

/**
 * Import SDK response/request-shaped blocks without making network requests.
 *
 * @since 1.0.0
 */
export function fromNotionBlocks(
    blocks: ReadonlyArray<SdkBlockInput>,
    options: FromNotionBlocksOptions = { }
): FromNotionBlocksResult
{
    const diagnostics: Array<NotionDiagnostic> = [ ];

    const GetBlock = (Block: SdkBlockInput, Index: number) => fromBlock(
        Block,
        String(Index),
        options,
        diagnostics
    );

    const document: NotionDocument =
        {
            blocks: blocks.map(GetBlock),
            version: 1
        } as const;

    return {
        diagnostics,
        document
    } as const;
}

function ToRequestRichText(
    items: unknown,
    diagnostics: Array<NotionDiagnostic>
): ReadonlyArray<NotionSdkRichTextItemRequest>
{
    if (!Array.isArray(items))
    {
        return [ ] as const;
    }

    return items.map((item: unknown) =>
    {
        const value = asRecord(item);
        const itemMetadata = getNotionMarkdownMetadata(item);
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
            } as NotionSdkRichTextItemRequest;
        }
        if (value.type === "equation" && typeof asRecord(value.equation).expression === "string")
        {
            return {
                equation:
                {
                    expression: String(asRecord(value.equation).expression)
                },
                type: "equation"
            } as NotionSdkRichTextItemRequest;
        }
        if (value.type === "mention")
        {
            const mention = asRecord(value.mention);
            const kind = typeof mention.type === "string" ? mention.type : undefined;
            const source = kind === undefined ? { } : asRecord(mention[kind]);

            if (kind === "user" || kind === "page" || kind === "database")
            {
                if (!IsNotionId(source.id))
                {
                    Diagnostic(
                        diagnostics,
                        "unresolved-mention",
                        `The ${ kind } mention has no resolvable Notion ID.`,
                        "error"
                    );

                    return {
                        text:
                        {
                            content: String(itemMetadata.mention?.label ?? "")
                        },
                        type: "text"
                    } as NotionSdkRichTextItemRequest;
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
                } as NotionSdkRichTextItemRequest;
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
                } as NotionSdkRichTextItemRequest;
            }
        }

        Diagnostic(
            diagnostics,
            "unrepresentable-rich-text",
            "A rich-text item has no Notion SDK representation.",
            "error"
        );

        return {
            text:
            {
                content: String(value.plain_text ?? value.content ?? "")
            },
            type: "text"
        } as NotionSdkRichTextItemRequest;
    });
}

function ToBlock(block: NotionBlock, diagnostics: Array<NotionDiagnostic>): BlockObjectRequest | undefined
{
    const data = getNotionBlockPayload(block);

    const childRequests = (block.children ?? [ ])
        .map((child: NotionBlock) => ToBlock(child, diagnostics))
        .filter((child: BlockObjectRequest | undefined): child is BlockObjectRequest => child !== undefined);

    const copy = { ...data } as Record<string, unknown>;

    if (childRequests.length > 0)
    {
        copy.children = childRequests;
    }

    if (copy.color === undefined && getNotionMarkdownMetadata(block).color !== undefined)
    {
        copy.color = getNotionMarkdownMetadata(block).color;
    }

    if (block.type === "synced_block_reference")
    {
        Diagnostic(
            diagnostics,
            "unrepresentable-synced-reference",
            "A synced block reference URL cannot be converted to the SDK's synced_from.block_id " +
                "without a Notion block ID.",
            "error"
        );
        return undefined;
    }
    if (block.type === "link_to_page")
    {
        const blockMetadata = getNotionMarkdownMetadata(block);
        const dataId = data.page_id ?? data.database_id;
        const id = IdFromUrl(dataId) ?? IdFromUrl(blockMetadata.referenceUrl);

        if (id === undefined)
        {
            Diagnostic(
                diagnostics,
                "unresolved-page-reference",
                "A page/database reference has no resolvable Notion ID.",
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
            .map((child: NotionBlock) => ToBlock(child, diagnostics))
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

    if (block.type === "synced_block" && getNotionMarkdownMetadata(block).referenceUrl !== undefined)
    {
        const id = IdFromUrl(getNotionMarkdownMetadata(block).referenceUrl);

        if (id === undefined)
        {
            Diagnostic(
                diagnostics,
                "unresolved-synced-block",
                "A synced block URL cannot be converted to synced_from.block_id without a Notion block ID.",
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
 * @throws {NotionConversionError} Iff part of the document cannot be converted to a block.
 *
 * @since 1.0.0
 */
export function toNotionBlocks(
    document: NotionDocument,
    options: ToNotionBlocksOptions = { }
): ToNotionBlocksResult
{
    const diagnostics: Array<NotionDiagnostic> = [ ];
    const blocks = document.blocks.map((block: NotionBlock) =>
        ToBlock(block, diagnostics))
        .filter((block: BlockObjectRequest | undefined): block is BlockObjectRequest => block !== undefined);

    if (options.strict === true && diagnostics.some((item: NotionDiagnostic) => item.severity === "error"))
    {
        throw new NotionConversionError(diagnostics);
    }

    return { blocks, diagnostics };
}
