/**
 * @module react-native-notion-markdown/renderer/ui/types
 *
 * @file      types.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { ComponentType, ReactNode } from "react";
import type {
    NotionBlock,
    NotionDiagnostic,
    NotionDocument,
    NotionMarkdownBlockType
} from "../../document/types.ts";

/**
 * Colors and typography settings used by the Notion renderer.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionRendererTheme
{
    readonly background: string;
    readonly surface: string;
    readonly foreground: string;
    readonly muted: string;
    readonly border: string;
    readonly accent: string;
    readonly codeBackground: string;

    /**
     * Background color of an inline `code` span, distinct from {@link codeBackground}'s fenced code block.
     */
    readonly inlineCodeBackground: string;

    /** Text color of an inline `code` span. */
    readonly inlineCodeForeground: string;
    readonly error: string;

    /** Color used for destructive actions and labels (e.g. a "Delete" button). */
    readonly danger: string;
    readonly fontSize: number;
    readonly spacing: number;

    /**
     * The font family used for all non-monospace text. Defaults to `"Inter"`, which renders
     * using the platform's system font unless the optional `Inter` peer dependency is installed
     * and loaded -- see `renderer/ui/inter-font`. Override to use a different font entirely.
     */
    readonly fontFamily: string;

    /**
     * The font family used for page-title-equivalent text (`heading_1`). Defaults to
     * `"Inter-Black"`, the heaviest Inter weight -- see `renderer/ui/inter-font`. Falls back to
     * the platform's bold system font when that family isn't loaded.
     */
    readonly titleFontFamily: string;
}

/**
 * Request data for resolving a page, database, or block reference.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionReferenceRequest
{
    readonly kind: string;
    readonly id?: string;
    readonly url?: string;
    readonly label?: string;
}

/**
 * Display data returned for a resolved reference.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionReferenceDisplay
{
    readonly label?: string;
    readonly icon?: string;
    readonly url?: string;
}

/**
 * Request data for loading media belonging to a given block.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionMediaRequest
{
    readonly block: NotionBlock;
    readonly kind: "image" | "audio" | "video" | "file" | "pdf";
    readonly url?: string;
}

/**
 * Props supplied to a custom component for rendering a given block.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionBlockViewProps
{
    readonly block: NotionBlock;
    readonly children: ReactNode;
    readonly theme: NotionRendererTheme;
}

/**
 * Optional custom components keyed by corresponding Notion block types.
 *
 * @category Types
 * @since 1.0.0
 */
export type NotionBlockComponents = Partial<Record<
    NotionMarkdownBlockType,
    ComponentType<NotionBlockViewProps>
>>;

/** Props passed to a custom checkbox rendered for a to-do block. */
export interface NotionCheckboxProps
{
    readonly checked: boolean;
}

/** A checkbox-only component used by the renderer for to-do blocks. */
export type NotionCheckboxComponent = ComponentType<NotionCheckboxProps>;

/** Props for the fallback icon used when a page reference has no fetched page icon. */
export interface NotionReferenceIconProps
{
    readonly color: string;
    readonly size: number;
    readonly strokeWidth: number;
}

/**
 * Component type used to render a reference icon.
 *
 * @category Types
 * @since 1.0.0
 */
export type NotionReferenceIconComponent = ComponentType<NotionReferenceIconProps>;

export/**
       * The default hint shown inside an empty toggle child.
       *
       * @category Constants
       * @since 1.0.0
       */
const defaultEmptyTogglePlaceholder = "Empty toggle.  Tap to edit.";

/**
 * Options controlling document rendering and reference handling.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionRendererOptions
{
    readonly colorScheme?: "light" | "dark" | "system";
    readonly theme?: Partial<NotionRendererTheme>;

    /**
     * Hint shown when an expanded toggle has no content.
     */
    readonly emptyTogglePlaceholder?: string;
    readonly components?: NotionBlockComponents;
    readonly checkboxComponent?: NotionCheckboxComponent;
    readonly pageReferenceFallbackIcon?: NotionReferenceIconComponent;
    /** Icon used when an arbitrary link has no downloadable favicon. */
    readonly linkFallbackIcon?: NotionReferenceIconComponent;
    readonly onDiagnostics?: (diagnostics: ReadonlyArray<NotionDiagnostic>) => void;
    readonly onOpenUrl?: (url: string) => void;
    readonly resolveReference?: (request: NotionReferenceRequest) => Promise<NotionReferenceDisplay | null>;
    readonly resolveSyncedBlock?: (url: string) => Promise<NotionDocument | null>;
    readonly resolveMediaUrl?: (request: NotionMediaRequest) => Promise<string | null>;
    readonly testID?: string;
}

/**
 * Props accepted by the Notion Markdown renderer component.
 *
 * @category Types
 * @since 1.0.0
 */
export type NotionMarkdownRendererProps =
    NotionRendererOptions & (
        | {
            readonly markdown: string;
            readonly document?: never
        }
        | {
            readonly document: NotionDocument;
            readonly markdown?: never
        }
    );
