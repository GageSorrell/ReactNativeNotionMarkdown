/**
 * Public document contracts for Notion-enhanced Markdown.
 *
 * @module react-native-notion-markdown/document/types
 *
 * @file      types.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type {
    BlockObjectRequest,
    RichTextItemResponse
} from "@notionhq/client";

type SdkRichTextContainer = Extract<BlockObjectRequest, { paragraph: unknown; }>;

type SdkRichTextItemRequest =
    SdkRichTextContainer extends { paragraph: { rich_text: Array<infer Item>; }; }
        ? Item
        : never;

/* eslint-disable @typescript-eslint/naming-convention */

export/**
       * The key used for data that is meaningful to Markdown and editor clients only.
       *
       * @category Constants
       * @since 1.0.0
       */
const NOTION_MARKDOWN_METADATA = "__notion_markdown" as const;

/* eslint-enable @typescript-eslint/naming-convention */

/** Colors accepted by the enhanced Markdown format. */
export type NotionMarkdownColor =
    | "gray"
    | "brown"
    | "orange"
    | "yellow"
    | "green"
    | "blue"
    | "purple"
    | "pink"
    | "red"
    | "gray_bg"
    | "brown_bg"
    | "orange_bg"
    | "yellow_bg"
    | "green_bg"
    | "blue_bg"
    | "purple_bg"
    | "pink_bg"
    | "red_bg";

/** A source location in the original Markdown string. Lines and columns are one-based. */
export interface NotionSourceLocation
{
    readonly line: number;
    readonly column: number;
    readonly offset?: number;
}

/** A parser or conversion diagnostic. */
export interface NotionDiagnostic
{
    readonly severity: "error" | "warning";
    readonly message: string;
    readonly code: string;
    readonly source?: NotionSourceLocation;
    readonly details?: Readonly<Record<string, unknown>>;
}

/** Data retained for Markdown-only features and editor identity. */
export interface NotionMarkdownMetadata
{
    /** Stable identity used by the editor, distinct from a remote Notion ID. */
    readonly editorId?: string;

    /** A remote Notion ID supplied during import. */
    readonly notionId?: string;

    readonly source?: NotionSourceLocation;
    readonly color?: NotionMarkdownColor;
    readonly toggle?: boolean;
    readonly referenceUrl?: string;
    readonly mention?:
    {
        readonly kind: string;
        readonly url?: string;
        readonly label?: string;
    };
    readonly citationUrl?: string;
    readonly emojiName?: string;
    readonly inline?: boolean;
    readonly icon?: string;
    readonly table?:
    {
        readonly fitPageWidth?: boolean;
        readonly headerRow?: boolean;
        readonly headerColumn?: boolean;
        readonly columnColor?: NotionMarkdownColor;
        readonly columnColors?: Array<NotionMarkdownColor | undefined>;
        readonly rowColor?: NotionMarkdownColor;
        readonly cellColor?: NotionMarkdownColor;
        readonly cellColors?: Array<NotionMarkdownColor | undefined>;
    };
    readonly unresolved?: boolean;
    readonly [key: string]: unknown;
}

/** A rich-text item with an additive, namespaced metadata field. */
export type NotionRichTextItem =
    (
        | SdkRichTextItemRequest
        | RichTextItemResponse
    ) &
    {
        readonly [ NOTION_MARKDOWN_METADATA ]?: NotionMarkdownMetadata;
    };

/** Rich text accepted by the document model. */
export type NotionRichText = Array<NotionRichTextItem>;

/** Block names supported by the enhanced Markdown format. */
export type NotionMarkdownBlockType =
    | "paragraph"
    | "heading_1"
    | "heading_2"
    | "heading_3"
    | "heading_4"
    | "bulleted_list_item"
    | "numbered_list_item"
    | "to_do"
    | "quote"
    | "toggle"
    | "callout"
    | "code"
    | "equation"
    | "divider"
    | "table"
    | "table_row"
    | "column_list"
    | "column"
    | "image"
    | "audio"
    | "video"
    | "file"
    | "pdf"
    | "embed"
    | "bookmark"
    | "link_to_page"
    | "table_of_contents"
    | "synced_block"
    | "synced_block_reference";

/** SDK request variants are the source of truth for payload shapes. */
type SdkRequestVariant<Type extends string> = Extract<BlockObjectRequest, { type?: Type; }>;

/** The SDK payload for one block type, excluding the envelope and children. */
export type SdkBlockPayload<Type extends NotionMarkdownBlockType> =
    Type extends "synced_block_reference"
        ? {
            readonly synced_from: null;
        }
        : SdkRequestVariant<Type> extends infer Variant
            ? Variant extends Record<Type, infer Payload>
                ? Payload
                : never
            : never;

/** A recursive SDK-shaped document block with additive metadata. */
type NotionBlockPayload<Type extends NotionMarkdownBlockType> =
    {
        readonly [ Key in Type ]: SdkBlockPayload<Key>;
    };

/**
 * A recursive document block with a given Notion block type and additive metadata.
 *
 * @category Types
 * @since 1.0.0
 */
export type NotionBlock<Type extends NotionMarkdownBlockType = NotionMarkdownBlockType> =
    Type extends NotionMarkdownBlockType
        ? (
            {
                readonly id: string;
                readonly type: Type;
            } &
            NotionBlockPayload<Type> &
            {
                readonly children?: Array<NotionBlock>;
                readonly [NOTION_MARKDOWN_METADATA]?: NotionMarkdownMetadata;
            }
        )
        : never;

/** A versioned, recursive document tree. */
export interface NotionDocument
{
    readonly version: 1;
    readonly blocks: Array<NotionBlock>;
}

/**
 * Input accepted by the document parser and editor store.
 *
 * @category Types
 * @since 1.0.0
 */
export type NotionDocumentInput =
    | string
    | NotionDocument;

/**
 * Options for parsing Notion-enhanced Markdown.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface ParseNotionMarkdownOptions
{
    readonly idFactory?: (path: string, type: NotionMarkdownBlockType) => string;
    readonly rules?: Array<NotionMarkdownParserRule>;
}

/** An optional structural parser extension evaluated before built-in block rules. */
export interface NotionMarkdownParserRule
{
    readonly name: string;
    readonly test: (line: string) => boolean;
    readonly parse: (input: {
        readonly line: string;
        readonly path: string;
        readonly source: NotionSourceLocation;
    }) => NotionBlock | undefined;
}

/**
 * Document and diagnostics returned by the Markdown parser.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface ParseNotionMarkdownResult
{
    readonly document: NotionDocument;
    readonly diagnostics: Array<NotionDiagnostic>;
}

/**
 * Options for importing blocks from the Notion SDK shape.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface FromNotionBlocksOptions
{
    readonly idFactory?: (path: string, notionId?: string) => string;
}

/**
 * Document and diagnostics returned by a Notion block import.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface FromNotionBlocksResult
{
    readonly document: NotionDocument;
    readonly diagnostics: Array<NotionDiagnostic>;
}

/**
 * Options for exporting document blocks to the Notion SDK shape.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface ToNotionBlocksOptions
{
    /** When true, throw NotionConversionError if any block cannot be represented. */
    readonly strict?: boolean;
}

/**
 * SDK blocks and diagnostics returned by a Notion block export.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface ToNotionBlocksResult
{
    readonly blocks: Array<BlockObjectRequest>;
    readonly diagnostics: Array<NotionDiagnostic>;
}

/** An SDK conversion failure that retains every diagnostic. */
export class NotionConversionError extends Error
{
    readonly diagnostics: Array<NotionDiagnostic>;

    public constructor(diagnostics: Array<NotionDiagnostic>)
    {
        super(diagnostics.map((diagnostic: NotionDiagnostic) =>
            `${ diagnostic.code }: ${ diagnostic.message }`).join("; "));
        this.name = "NotionConversionError";
        this.diagnostics = diagnostics;
    }
}

/**
 * A field that can be edited on a given document block.
 *
 * @category Types
 * @since 1.0.0
 */
export type NotionEditableField =
    | {
        readonly blockId: string;
        readonly field: "rich_text";
        readonly index?: undefined;
        readonly text: string;
    }
    | {
        readonly blockId: string;
        readonly field: "caption";
        readonly index?: undefined;
        readonly text: string;
    }
    | {
        readonly blockId: string;
        readonly field: "cell";
        readonly index: number;
        readonly text: string;
    };

/**
 * A UTF-16 selection point within a given editable field.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionSelectionPoint
{
    readonly blockId: string;
    readonly field:
        | "rich_text"
        | "caption"
        | "cell";
    readonly index?: number;

    /** UTF-16 offset within the selected field. */
    readonly offset: number;
}

/**
 * The anchor and focus points of a document selection.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionSelection
{
    readonly anchor: NotionSelectionPoint;
    readonly focus: NotionSelectionPoint;
}

/**
 * The source label associated with a document transaction.
 *
 * @category Types
 * @since 1.0.0
 */
export type NotionTransactionOrigin =
    | "user"
    | "paste"
    | "history"
    | "remote"
    | "system"
    | string;

/**
 * A document change with its corresponding source and revision.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionTransaction
{
    readonly before: NotionDocument;
    readonly after: NotionDocument;
    readonly origin: NotionTransactionOrigin;
    readonly revision: number;
}

/**
 * The current document, selection, revision, and history availability.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionEditorState
{
    readonly document: NotionDocument;
    readonly revision: number;
    readonly selection?: NotionSelection;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
}

/**
 * A listener called with the current editor state and corresponding transaction.
 *
 * @category Types
 * @since 1.0.0
 */
export type NotionEditorListener = (state: NotionEditorState, transaction?: NotionTransaction) => void;
