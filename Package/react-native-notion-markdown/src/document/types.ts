/**
 * Public document contracts for Markdown-enhanced content.
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
const MARKDOWN_MARKDOWN_METADATA = "__markdown_markdown" as const;

/* eslint-enable @typescript-eslint/naming-convention */

/** Colors accepted by the enhanced Markdown format. */
export type MarkdownColor =
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

/** Every foreground and background color name accepted by enhanced Markdown. */
/* eslint-disable-next-line jsdoc/require-jsdoc */
export const markdownColors: ReadonlyArray<MarkdownColor> = Object.freeze([
    "gray",
    "brown",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
    "red",
    "gray_bg",
    "brown_bg",
    "orange_bg",
    "yellow_bg",
    "green_bg",
    "blue_bg",
    "purple_bg",
    "pink_bg",
    "red_bg"
]);

/** Return whether a runtime value is an enhanced Markdown color. */
export function isMarkdownColor(value: unknown): value is MarkdownColor
{
    return typeof value === "string" && markdownColors.includes(value as MarkdownColor);
}

/** Return whether a color name denotes a background color. */
export function isMarkdownBackgroundColor(value: unknown): boolean
{
    return typeof value === "string" && value.endsWith("_bg") && isMarkdownColor(value);
}

/** A source location in the original Markdown string. Lines and columns are one-based. */
export interface MarkdownSourceLocation
{
    readonly line: number;
    readonly column: number;
    readonly offset?: number;
}

/** A parser or conversion diagnostic. */
export interface MarkdownDiagnostic
{
    readonly severity: "error" | "warning";
    readonly message: string;
    readonly code: string;
    readonly source?: MarkdownSourceLocation;
    readonly details?: Readonly<Record<string, unknown>>;
}

/** Data retained for Markdown-only features and editor identity. */
export interface MarkdownMetadata
{
    /** Stable identity used by the editor, distinct from a remote Markdown ID. */
    readonly editorId?: string;

    /** A remote Markdown ID supplied during import. */
    readonly markdownId?: string;

    readonly source?: MarkdownSourceLocation;
    readonly color?: MarkdownColor;
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
        readonly columnColor?: MarkdownColor;
        readonly columnColors?: Array<MarkdownColor | undefined>;
        readonly tableColor?: MarkdownColor;
        readonly rowColor?: MarkdownColor;
        readonly rowColors?: Array<MarkdownColor | undefined>;
        readonly cellColor?: MarkdownColor;
        readonly cellColors?: Array<MarkdownColor | undefined> | Array<Array<MarkdownColor | undefined>>;
    };
    readonly unresolved?: boolean;
    readonly [key: string]: unknown;
}

/** A rich-text item with an additive, namespaced metadata field. */
export type MarkdownRichTextItem =
    (
        | SdkRichTextItemRequest
        | RichTextItemResponse
    ) &
    {
        readonly [ MARKDOWN_MARKDOWN_METADATA ]?: MarkdownMetadata;
    };

/** Rich text accepted by the document model. */
export type MarkdownRichText = Array<MarkdownRichTextItem>;

/** Block names supported by the enhanced Markdown format. */
export type MarkdownBlockType =
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
export type SdkBlockPayload<Type extends MarkdownBlockType> =
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
type MarkdownBlockPayload<Type extends MarkdownBlockType> =
    {
        readonly [ Key in Type ]: SdkBlockPayload<Key>;
    };

/**
 * A recursive document block with a given Markdown block type and additive metadata.
 *
 * @category Types
 * @since 1.0.0
 */
export type MarkdownBlock<Type extends MarkdownBlockType = MarkdownBlockType> =
    Type extends MarkdownBlockType
        ? (
            {
                readonly id: string;
                readonly type: Type;
            } &
            MarkdownBlockPayload<Type> &
            {
                readonly children?: Array<MarkdownBlock>;
                readonly [MARKDOWN_MARKDOWN_METADATA]?: MarkdownMetadata;
            }
        )
        : never;

/** A versioned, recursive document tree. */
export interface MarkdownDocument
{
    readonly version: 1;
    readonly blocks: Array<MarkdownBlock>;
}

/**
 * Input accepted by the document parser and editor store.
 *
 * @category Types
 * @since 1.0.0
 */
export type MarkdownDocumentInput =
    | string
    | MarkdownDocument;

/**
 * Options for parsing Markdown-enhanced content.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface ParseMarkdownOptions
{
    readonly idFactory?: (path: string, type: MarkdownBlockType) => string;
    readonly rules?: Array<MarkdownParserRule>;
}

/** Options controlling canonical enhanced-Markdown serialization. */
export interface SerializeMarkdownOptions
{
    /** Include Notion's optional `theme={null}` attribute on fenced code blocks. */
    readonly includeCodeBlockThemeNull?: boolean;
}

/** An optional structural parser extension evaluated before built-in block rules. */
export interface MarkdownParserRule
{
    readonly name: string;
    readonly test: (line: string) => boolean;
    readonly parse: (input: {
        readonly line: string;
        readonly path: string;
        readonly source: MarkdownSourceLocation;
    }) => MarkdownBlock | undefined;
}

/**
 * Document and diagnostics returned by the Markdown parser.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface ParseMarkdownResult
{
    readonly document: MarkdownDocument;
    readonly diagnostics: Array<MarkdownDiagnostic>;
}

/**
 * Options for importing blocks from the Markdown SDK shape.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface FromMarkdownBlocksOptions
{
    readonly idFactory?: (path: string, markdownId?: string) => string;
}

/**
 * Document and diagnostics returned by a Markdown block import.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface FromMarkdownBlocksResult
{
    readonly document: MarkdownDocument;
    readonly diagnostics: Array<MarkdownDiagnostic>;
}

/**
 * Options for exporting document blocks to the Markdown SDK shape.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface ToMarkdownBlocksOptions
{
    /** When true, throw MarkdownConversionError if any block cannot be represented. */
    readonly strict?: boolean;
}

/**
 * SDK blocks and diagnostics returned by a Markdown block export.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface ToMarkdownBlocksResult
{
    readonly blocks: Array<BlockObjectRequest>;
    readonly diagnostics: Array<MarkdownDiagnostic>;
}

/** An SDK conversion failure that retains every diagnostic. */
export class MarkdownConversionError extends Error
{
    readonly diagnostics: Array<MarkdownDiagnostic>;

    public constructor(diagnostics: Array<MarkdownDiagnostic>)
    {
        super(diagnostics.map((diagnostic: MarkdownDiagnostic) =>
            `${ diagnostic.code }: ${ diagnostic.message }`).join("; "));
        this.name = "MarkdownConversionError";
        this.diagnostics = diagnostics;
    }
}

/**
 * A field that can be edited on a given document block.
 *
 * @category Types
 * @since 1.0.0
 */
export type MarkdownEditableField =
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
export interface MarkdownSelectionPoint
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
export interface MarkdownSelection
{
    readonly anchor: MarkdownSelectionPoint;
    readonly focus: MarkdownSelectionPoint;
}

/** A rectangular table selection used by table-scoped editor commands. */
export interface MarkdownTableSelection
{
    readonly blockId: string;
    readonly anchor: { readonly row: number; readonly column: number; };
    readonly focus: { readonly row: number; readonly column: number; };
}

/**
 * The source label associated with a document transaction.
 *
 * @category Types
 * @since 1.0.0
 */
export type MarkdownTransactionOrigin =
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
export interface MarkdownTransaction
{
    readonly before: MarkdownDocument;
    readonly after: MarkdownDocument;
    readonly origin: MarkdownTransactionOrigin;
    readonly revision: number;
}

/**
 * The current document, selection, revision, and history availability.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownEditorState
{
    readonly document: MarkdownDocument;
    readonly revision: number;
    readonly selection?: MarkdownSelection;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
}

/**
 * A listener called with the current editor state and corresponding transaction.
 *
 * @category Types
 * @since 1.0.0
 */
export type MarkdownEditorListener = (state: MarkdownEditorState, transaction?: MarkdownTransaction) => void;
