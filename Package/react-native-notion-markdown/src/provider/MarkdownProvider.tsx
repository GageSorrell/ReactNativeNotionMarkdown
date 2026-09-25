/**
 * `MarkdownProvider` supplies app-wide theming, localization, and configuration to every
 * `MarkdownEditor` and `MarkdownRenderer` beneath it.
 *
 * Customization follows one rule for both components:
 *
 * - **Configuration** -- anything independent of a particular document (theme, color scheme,
 *   strings, icons, block components, toolbar and panel composition, layout, resolvers, URL
 *   opening) -- can be set app-wide here, or per instance as a component prop of the same name.
 * - **Instance props** -- anything that reads, changes, or reports on one document (`snapshot`,
 *   `onEdit`, `markdown`, `onDiagnostics`, ...) -- are component props only.
 *
 * Values merge in this order, later winning: built-in defaults, outer provider, inner provider,
 * component prop. The theme deep-merges per color scheme; other object-valued fields merge key by
 * key; everything else is replaced. The provider is optional -- without one, the defaults apply.
 *
 * @module react-native-notion-markdown/provider/MarkdownProvider
 *
 * @file      MarkdownProvider.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    type MarkdownColorScheme,
    type MarkdownColorSchemePreference,
    type MarkdownTheme,
    type MarkdownThemeOverride,
    mergeMarkdownThemeOverrides,
    resolveMarkdownTheme
} from "./theme.ts";
import type { MarkdownEditorConfig, MarkdownRendererConfig } from "./config.ts";
import {
    type MarkdownMessageId,
    type MarkdownTranslate,
    defaultMarkdownMessages,
    defaultMarkdownTranslate
} from "./messages.ts";
import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { mergeMarkdownConfig } from "./config.ts";
import { useColorScheme } from "react-native";

/**
 * Host-supplied localization. Both fields are optional -- supply `translate` alone and let
 * `locale` remain informational, or supply neither and get the package's built-in English.
 *
 * @since 1.0.0
 */
export interface MarkdownLocalization
{
    readonly locale?: string;
    readonly translate?: MarkdownTranslate;
}

/**
 * Opens a URL the user activated -- a renderer link, or a page reference tapped in the editor.
 *
 * @since 1.0.0
 */
export type MarkdownOpenUrl = (url: string) => void | Promise<void>;

/**
 * The provider-backed settings shared by both components. Each can also be passed to
 * `MarkdownEditor` or `MarkdownRenderer` directly to override the provider for that instance.
 *
 * @since 1.0.0
 */
export interface MarkdownSharedConfig
{
    /** Color scheme to render in. `"system"` (the default) follows the device setting. */
    readonly colorScheme?: MarkdownColorSchemePreference;

    /** Per-scheme theme overrides, deep-merged over the built-in light and dark themes. */
    readonly theme?: MarkdownThemeOverride;

    readonly localization?: MarkdownLocalization;

    /** Opens activated links. Falls back to the optional `expo-linking` peer. */
    readonly onOpenUrl?: MarkdownOpenUrl;
}

/**
 * Props for {@link MarkdownProvider}.
 *
 * @since 1.0.0
 */
export interface MarkdownProviderProps extends MarkdownSharedConfig
{
    readonly children: ReactNode;

    /** App-wide configuration for every `MarkdownEditor` beneath this provider. */
    readonly editor?: MarkdownEditorConfig;

    /** App-wide configuration for every `MarkdownRenderer` beneath this provider. */
    readonly renderer?: MarkdownRendererConfig;
}

/**
 * The merged configuration a provider makes available to its descendants.
 *
 * @since 1.0.0
 */
export interface MarkdownContextValue
{
    readonly colorScheme?: MarkdownColorSchemePreference;
    readonly editor: MarkdownEditorConfig;
    readonly localization: MarkdownLocalization;
    readonly onOpenUrl?: MarkdownOpenUrl;
    readonly renderer: MarkdownRendererConfig;
    readonly theme?: MarkdownThemeOverride;
}

const emptyContextValue: MarkdownContextValue =
    {
        editor: { },
        localization: { },
        renderer: { }
    };

const MarkdownContext = createContext<MarkdownContextValue>(emptyContextValue);

/**
 * Supplies theming, localization, and configuration to descendant editors and renderers. Nested
 * providers merge over their ancestors.
 *
 * @since 1.0.0
 */
export function MarkdownProvider({
    children,
    colorScheme,
    editor,
    localization,
    onOpenUrl,
    renderer,
    theme
}: MarkdownProviderProps)
{
    const parent = useContext(MarkdownContext);
    const value = useMemo<MarkdownContextValue>(() => (
        {
            colorScheme: colorScheme ?? parent.colorScheme,
            editor: mergeMarkdownConfig<MarkdownEditorConfig>(parent.editor, editor),
            localization: mergeMarkdownConfig<MarkdownLocalization>(parent.localization, localization),
            onOpenUrl: onOpenUrl ?? parent.onOpenUrl,
            renderer: mergeMarkdownConfig<MarkdownRendererConfig>(parent.renderer, renderer),
            theme: mergeMarkdownThemeOverrides(parent.theme, theme)
        }
    ), [ colorScheme, editor, localization, onOpenUrl, parent, renderer, theme ]);

    return <MarkdownContext.Provider value={ value }>{ children }</MarkdownContext.Provider>;
}

/**
 * Return the nearest provider's merged configuration, or the empty defaults outside a provider.
 *
 * @since 1.0.0
 */
export function useMarkdownConfig(): MarkdownContextValue
{
    return useContext(MarkdownContext);
}

/**
 * Resolve the color scheme to render in: `preference` if given, else the nearest provider's, else
 * the device setting.
 *
 * @since 1.0.0
 */
export function useMarkdownColorScheme(preference?: MarkdownColorSchemePreference): MarkdownColorScheme
{
    const systemScheme = useColorScheme();
    const context = useContext(MarkdownContext);
    const requested = preference ?? context.colorScheme ?? "system";
    if (requested !== "system")
    {
        return requested;
    }

    return systemScheme === "dark" ? "dark" : "light";
}

/**
 * Resolve the complete theme for the current color scheme: the built-in theme, then the provider
 * chain's overrides, then `override`.
 *
 * @since 1.0.0
 */
export function useMarkdownTheme(
    override?: MarkdownThemeOverride,
    colorScheme?: MarkdownColorSchemePreference
): MarkdownTheme
{
    const { theme } = useContext(MarkdownContext);
    const scheme = useMarkdownColorScheme(colorScheme);
    return useMemo(() => resolveMarkdownTheme(scheme, theme, override), [ override, scheme, theme ]);
}

/**
 * Resolves a message id to display text, interpolating any `{name}` placeholders from `Values`.
 *
 * @since 1.0.0
 */
export type MarkdownTranslateById = (
    Id: MarkdownMessageId,
    Values?: Readonly<Record<string, string | number>>
) => string;

/**
 * Return a function that resolves a {@link MarkdownMessageId} to display text, using `localization`
 * if given, else the nearest provider's, else the built-in English.
 *
 * @since 1.0.0
 */
export function useMarkdownTranslate(localization?: MarkdownLocalization): MarkdownTranslateById
{
    const context = useContext(MarkdownContext);
    const translate = localization?.translate ?? context.localization.translate ?? defaultMarkdownTranslate;

    return useCallback(
        (Id: MarkdownMessageId, Values?: Readonly<Record<string, string | number>>) =>
            translate(defaultMarkdownMessages[ Id ], Values),
        [ translate ]
    );
}

/**
 * Everything a component needs to render: resolved scheme, theme, translation, link opening, and
 * its merged configuration section.
 *
 * @since 1.0.0
 */
export interface ResolvedMarkdownContext<Config>
{
    readonly colorScheme: MarkdownColorScheme;
    readonly config: Config;
    readonly dark: boolean;
    readonly locale?: string;
    readonly onOpenUrl?: MarkdownOpenUrl;
    readonly t: MarkdownTranslateById;
    readonly theme: MarkdownTheme;
}

/** Resolve one component's context from the nearest provider. */
function useResolvedMarkdown<Section extends "editor" | "renderer">(
    section: Section
): ResolvedMarkdownContext<MarkdownContextValue[ Section ]>
{
    const context = useContext(MarkdownContext);
    const colorScheme = useMarkdownColorScheme();
    const theme = useMarkdownTheme(undefined, colorScheme);
    const t = useMarkdownTranslate();
    const config = context[ section ];
    const { locale } = context.localization;
    const { onOpenUrl } = context;

    return useMemo(() => (
        {
            colorScheme,
            config,
            dark: colorScheme === "dark",
            locale,
            onOpenUrl,
            t,
            theme
        }
    ), [ colorScheme, config, locale, onOpenUrl, t, theme ]);
}

/**
 * Resolve the editor's theme, translation, and configuration from the nearest provider.
 * `MarkdownEditor` wraps its content in a provider scoped to its own props, so within the editor
 * this reflects those per-instance overrides too.
 *
 * @since 1.0.0
 */
export function useResolvedEditorConfig(): ResolvedMarkdownContext<MarkdownEditorConfig>
{
    return useResolvedMarkdown("editor");
}

/**
 * Resolve the renderer's theme, translation, and configuration from the nearest provider.
 * `MarkdownRenderer` wraps its content in a provider scoped to its own props, so within the
 * renderer this reflects those per-instance overrides too.
 *
 * @since 1.0.0
 */
export function useResolvedRendererConfig(): ResolvedMarkdownContext<MarkdownRendererConfig>
{
    return useResolvedMarkdown("renderer");
}
