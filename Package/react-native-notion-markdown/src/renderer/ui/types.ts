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
import type { MarkdownSharedConfig } from "../../provider/MarkdownProvider.tsx";
import type { MarkdownTheme } from "../../provider/theme.ts";

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
    readonly theme: MarkdownTheme;
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

/**
 * Fallback icons the renderer draws when a reference has no fetched icon.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownRendererIcons
{
    /** Icon used when a page reference has no fetched page icon. */
    readonly pageReference?: MarkdownReferenceIconComponent;

    /** Icon used when an arbitrary link has no downloadable favicon. */
    readonly link?: MarkdownReferenceIconComponent;
}

/**
 * Every configurable aspect of the renderer. Set app-wide through `MarkdownProvider`'s
 * `renderer` prop, or per instance as `MarkdownRenderer` props of the same names. A prop's
 * object-valued field merges key by key over the provider's; any other value replaces it.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownRendererConfig
{
    /** Custom components keyed by the block type they render. */
    readonly components?: MarkdownBlockComponents;
    readonly checkboxComponent?: MarkdownCheckboxComponent;
    readonly icons?: MarkdownRendererIcons;
    readonly resolveReference?: (request: MarkdownReferenceRequest) => Promise<MarkdownReferenceDisplay | null>;
    readonly resolveSyncedBlock?: (url: string) => Promise<MarkdownDocument | null>;
    readonly resolveMediaUrl?: (request: MarkdownMediaRequest) => Promise<string | null>;
}

/**
 * Options controlling document rendering: the shared provider-backed settings (color scheme,
 * theme, localization, link opening) and the renderer's configuration, each overriding
 * `MarkdownProvider` for this instance, plus per-document callbacks.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownRendererOptions extends MarkdownSharedConfig, MarkdownRendererConfig
{
    readonly onDiagnostics?: (diagnostics: ReadonlyArray<MarkdownDiagnostic>) => void;
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
