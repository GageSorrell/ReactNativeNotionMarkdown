/**
 * Internal helpers shared across the document and renderer modules. Each function here used to
 * exist as a near-identical, independently maintained copy in several modules (a safe object
 * cast, a metadata-bag reader, a block-payload reader, and the SDK/Markdown color-suffix
 * conversion); this module gives each one a single definition instead.
 *
 * Not part of the public API -- nothing here is re-exported from `index.ts`.
 *
 * @module react-native-notion-markdown/internal
 *
 * @file      internal.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    NOTION_MARKDOWN_METADATA,
    type NotionBlock,
    type NotionMarkdownMetadata
} from "./document/types.ts";

/**
 * Safely widen an unknown value to a plain object record, so its properties can be read without
 * a `typeof`/`null` guard at every call site. Non-object values, including `null`, become `{}`.
 *
 * @since 1.0.0
 */
export function asRecord(value: unknown): Record<string, unknown>
{
    return (value !== null && typeof value === "object" ? value : { }) as Record<string, unknown>;
}

/**
 * Read the `__notion_markdown` metadata bag off a block or rich-text item, defaulting to `{}`
 * when the value carries none.
 *
 * @since 1.0.0
 */
export function getNotionMarkdownMetadata(value: unknown): NotionMarkdownMetadata
{
    return asRecord(value)[ NOTION_MARKDOWN_METADATA ] as NotionMarkdownMetadata ?? { };
}

/**
 * Read a block's own type-keyed payload -- e.g. a paragraph block's `paragraph` field -- the
 * object that carries that block type's `rich_text`, `caption`, `cells`, or other data.
 *
 * @since 1.0.0
 */
export function getNotionBlockPayload(block: NotionBlock): Record<string, unknown>
{
    return asRecord(asRecord(block)[ block.type ]);
}

/**
 * Convert a color from the Notion SDK's `_background` suffix to the enhanced Markdown format's
 * `_bg` suffix. Values that are not background colors, or not strings, pass through unchanged.
 *
 * @since 1.0.0
 */
export function fromSdkColor(value: unknown): unknown
{
    return typeof value === "string" && value.endsWith("_background")
        ? `${ value.slice(0, -11) }_bg`
        : value;
}

/**
 * Convert a color from the enhanced Markdown format's `_bg` suffix to the Notion SDK's
 * `_background` suffix. Values that are not background colors, or not strings, pass through
 * unchanged. The inverse of {@link fromSdkColor}.
 *
 * @since 1.0.0
 */
export function toSdkColor(value: unknown): unknown
{
    return typeof value === "string" && value.endsWith("_bg")
        ? `${ value.slice(0, -3) }_background`
        : value;
}
