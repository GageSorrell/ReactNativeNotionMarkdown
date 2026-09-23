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
    MarkdownBlock,
    MarkdownDiagnostic,
    MarkdownDocument,
    MarkdownBlockType
} from "../../document/types.ts";

/**
 * Colors and typography settings used by the Markdown renderer.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownRendererTheme
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
export interface MarkdownReferenceRequest
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
export interface MarkdownReferenceDisplay
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
export interface MarkdownMediaRequest
{
    readonly block: MarkdownBlock;
    readonly kind: "image" | "audio" | "video" | "file" | "pdf";
    readonly url?: string;
}

/**
 * Props supplied to a custom component for rendering a given block.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownBlockViewProps
{
    readonly block: MarkdownBlock;
    readonly children: ReactNode;
    readonly theme: MarkdownRendererTheme;
}

/**
 * Optional custom components keyed by corresponding Markdown block types.
 *
 * @category Types
 * @since 1.0.0
 */
export type MarkdownBlockComponents = Partial<Record<
    MarkdownBlockType,
    ComponentType<MarkdownBlockViewProps>
>>;

/** Props passed to a custom checkbox rendered for a to-do block. */
export interface MarkdownCheckboxProps
{
    readonly checked: boolean;
}

/** A checkbox-only component used by the renderer for to-do blocks. */
export type MarkdownCheckboxComponent = ComponentType<MarkdownCheckboxProps>;

/** Props for the fallback icon used when a page reference has no fetched page icon. */
export interface MarkdownReferenceIconProps
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
export type MarkdownReferenceIconComponent = ComponentType<MarkdownReferenceIconProps>;

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
export interface MarkdownRendererOptions
{
    readonly colorScheme?: "light" | "dark" | "system";
    readonly theme?: Partial<MarkdownRendererTheme>;

    /**
     * Hint shown when an expanded toggle has no content.
     */
    readonly emptyTogglePlaceholder?: string;
    readonly components?: MarkdownBlockComponents;
    readonly checkboxComponent?: MarkdownCheckboxComponent;
    readonly pageReferenceFallbackIcon?: MarkdownReferenceIconComponent;
    /** Icon used when an arbitrary link has no downloadable favicon. */
    readonly linkFallbackIcon?: MarkdownReferenceIconComponent;
    readonly onDiagnostics?: (diagnostics: ReadonlyArray<MarkdownDiagnostic>) => void;
    readonly onOpenUrl?: (url: string) => void;
    readonly resolveReference?: (request: MarkdownReferenceRequest) => Promise<MarkdownReferenceDisplay | null>;
    readonly resolveSyncedBlock?: (url: string) => Promise<MarkdownDocument | null>;
    readonly resolveMediaUrl?: (request: MarkdownMediaRequest) => Promise<string | null>;
    readonly testID?: string;
}

/**
 * Props accepted by the Markdown renderer component.
 *
 * @category Types
 * @since 1.0.0
 */
export type MarkdownRendererProps =
    MarkdownRendererOptions & (
        | {
            readonly markdown: string;
            readonly document?: never
        }
        | {
            readonly document: MarkdownDocument;
            readonly markdown?: never
        }
    );
