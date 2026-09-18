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

import type { EditorMessageId, NotionEditorMessageDescriptor, NotionEditorTranslate } from "./messages.ts";
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
export interface NotionEditorLocalization
{
    readonly locale?: string;
    readonly translate?: NotionEditorTranslate;
}

interface ResolvedNotionEditorLocalization
{
    readonly locale?: string;
    readonly translate: NotionEditorTranslate;
}

interface NotionEditorConfigContextValue
{
    readonly localization: ResolvedNotionEditorLocalization;
}

/** Props for {@link NotionEditorConfigProvider}. */
export interface NotionEditorConfigProviderProps
{
    readonly children: ReactNode;
    readonly localization?: NotionEditorLocalization;
}

const englishTranslate: NotionEditorTranslate = (Message: NotionEditorMessageDescriptor) =>
    Message.defaultMessage;

const defaultContextValue: NotionEditorConfigContextValue =
    {
        localization: { translate: englishTranslate }
    };

const NotionEditorConfigContext = createContext<NotionEditorConfigContextValue>(defaultContextValue);

/**
 * Configures editor UI concerns -- currently localization -- for descendant editors. Optional:
 * `NotionEditor` renders built-in English when used outside this provider.
 *
 * @since 1.0.0
 */
export function NotionEditorConfigProvider({ children, localization }: NotionEditorConfigProviderProps)
{
    const value = useMemo<NotionEditorConfigContextValue>(() => (
        {
            localization:
            {
                locale: localization?.locale,
                translate: localization?.translate ?? englishTranslate
            }
        }
    ), [ localization?.locale, localization?.translate ]);

    return createElement(NotionEditorConfigContext.Provider, { value }, children);
}

/** Return the nearest editor UI configuration, or the built-in English default. */
export function useNotionEditorConfig(): NotionEditorConfigContextValue
{
    return useContext(NotionEditorConfigContext);
}

/** Return a function that resolves an {@link EditorMessageId} to display text. */
export function useNotionEditorTranslate(): (
    Id: EditorMessageId,
    Values?: Readonly<Record<string, string | number>>
) => string
{
    const { localization } = useNotionEditorConfig();
    const { translate } = localization;

    return useCallback(
        (Id: EditorMessageId, Values?: Readonly<Record<string, string | number>>) =>
            translate(defaultEditorMessages[Id], Values),
        [ translate ]
    );
}
