/**
 * Editor UI configuration -- currently localization, with the context value namespaced so a
 * `theme` concern can be added alongside it later without restructuring this provider.
 *
 * @module react-native-notion-markdown/editor/ui/config
 *
 * @file      config.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { EditorMessageId, MarkdownEditorMessageDescriptor, MarkdownEditorTranslate } from "./messages.ts";
import { createContext, createElement, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { defaultEditorMessages } from "./messages.ts";

/**
 * Host-supplied localization. Both fields are optional -- an application can override `translate`
 * alone and let `locale` remain informational, or supply neither and get the package's built-in
 * English.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorLocalization
{
    readonly locale?: string;
    readonly translate?: MarkdownEditorTranslate;
}

interface ResolvedMarkdownEditorLocalization
{
    readonly locale?: string;
    readonly translate: MarkdownEditorTranslate;
}

interface MarkdownEditorConfigContextValue
{
    readonly localization: ResolvedMarkdownEditorLocalization;
}

/** Props for {@link MarkdownEditorConfigProvider}. */
export interface MarkdownEditorConfigProviderProps
{
    readonly children: ReactNode;
    readonly localization?: MarkdownEditorLocalization;
}

const englishTranslate: MarkdownEditorTranslate = (Message: MarkdownEditorMessageDescriptor) =>
    Message.defaultMessage;

const defaultContextValue: MarkdownEditorConfigContextValue =
    {
        localization: { translate: englishTranslate }
    };

const MarkdownEditorConfigContext = createContext<MarkdownEditorConfigContextValue>(defaultContextValue);

/**
 * Configures editor UI concerns -- currently localization -- for descendant editors. Optional:
 * `MarkdownEditor` renders built-in English when used outside this provider.
 *
 * @since 1.0.0
 */
export function MarkdownEditorConfigProvider({ children, localization }: MarkdownEditorConfigProviderProps)
{
    const value = useMemo<MarkdownEditorConfigContextValue>(() => (
        {
            localization:
            {
                locale: localization?.locale,
                translate: localization?.translate ?? englishTranslate
            }
        }
    ), [ localization?.locale, localization?.translate ]);

    return createElement(MarkdownEditorConfigContext.Provider, { value }, children);
}

/** Return the nearest editor UI configuration, or the built-in English default. */
export function useMarkdownEditorConfig(): MarkdownEditorConfigContextValue
{
    return useContext(MarkdownEditorConfigContext);
}

/** Return a function that resolves an {@link EditorMessageId} to display text. */
export function useMarkdownEditorTranslate(): (
    Id: EditorMessageId,
    Values?: Readonly<Record<string, string | number>>
) => string
{
    const { localization } = useMarkdownEditorConfig();
    const { translate } = localization;

    return useCallback(
        (Id: EditorMessageId, Values?: Readonly<Record<string, string | number>>) =>
            translate(defaultEditorMessages[Id], Values),
        [ translate ]
    );
}
