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

export interface NotionRendererTheme
{
    readonly background: string;
    readonly surface: string;
    readonly foreground: string;
    readonly muted: string;
    readonly border: string;
    readonly accent: string;
    readonly codeBackground: string;
    readonly error: string;
    readonly fontSize: number;
    readonly spacing: number;
}

export interface NotionReferenceRequest
{
    readonly kind: string;
    readonly id?: string;
    readonly url?: string;
    readonly label?: string;
}

export interface NotionReferenceDisplay
{
    readonly label?: string;
    readonly icon?: string;
    readonly url?: string;
}

export interface NotionMediaRequest
{
    readonly block: NotionBlock;
    readonly kind: "image" | "audio" | "video" | "file" | "pdf";
    readonly url?: string;
}

export interface NotionBlockViewProps
{
    readonly block: NotionBlock;
    readonly children: ReactNode;
    readonly theme: NotionRendererTheme;
}

export type NotionBlockComponents = Partial<Record<
    NotionMarkdownBlockType,
    ComponentType<NotionBlockViewProps>
>>;

export interface NotionRendererOptions
{
    readonly colorScheme?: "light" | "dark" | "system";
    readonly theme?: Partial<NotionRendererTheme>;
    readonly components?: NotionBlockComponents;
    readonly onDiagnostics?: (diagnostics: ReadonlyArray<NotionDiagnostic>) => void;
    readonly onOpenUrl?: (url: string) => void;
    readonly resolveReference?: (request: NotionReferenceRequest) => Promise<NotionReferenceDisplay | null>;
    readonly resolveSyncedBlock?: (url: string) => Promise<NotionDocument | null>;
    readonly resolveMediaUrl?: (request: NotionMediaRequest) => Promise<string | null>;
    readonly testID?: string;
}

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
