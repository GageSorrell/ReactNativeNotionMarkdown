/**
 * The theme shared by the Markdown renderer and the "batteries included" editor. Every color,
 * font, and size either component draws comes from a resolved {@link MarkdownTheme}; nothing
 * presentational is hard-coded in UI code. See {@link MarkdownProvider} for how a theme is
 * supplied and merged.
 *
 * @module react-native-notion-markdown/provider/theme
 *
 * @file      theme.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { MarkdownColor } from "../document/types.ts";
import { fromSdkColor } from "../internal.ts";

/**
 * The nine named hues of the enhanced Markdown color palette, without the `_bg` suffix.
 *
 * @category Types
 * @since 1.0.0
 */
export type MarkdownColorName =
    | "gray"
    | "brown"
    | "orange"
    | "yellow"
    | "green"
    | "blue"
    | "purple"
    | "pink"
    | "red";

export/**
       * The palette's hue names, in the order the editor's color pickers present them.
       *
       * @category Constants
       * @since 1.0.0
       */
const markdownColorNames: ReadonlyArray<MarkdownColorName> =
    [ "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red" ];

/**
 * Colors, typography, and spacing for document content. The renderer draws with these, and the
 * editor's native WYSIWYG surface uses the same values so edited and rendered documents match.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownDocumentTheme
{
    readonly background: string;
    readonly surface: string;
    readonly foreground: string;
    readonly muted: string;

    /** Hint text shown in empty blocks, such as an empty toggle's placeholder. */
    readonly placeholder: string;
    readonly border: string;
    readonly accent: string;

    /** Foreground drawn on top of {@link accent}, e.g. a checked to-do's checkmark. */
    readonly onAccent: string;
    readonly codeBackground: string;

    /**
     * Background color of an inline `code` span, distinct from {@link codeBackground}'s fenced code
     * block.
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

    /** The font family used for inline code and code blocks. */
    readonly monospaceFontFamily: string;
}

/**
 * The enhanced Markdown color palette: one text color and one background color per hue.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownPalette
{
    readonly text: Readonly<Record<MarkdownColorName, string>>;
    readonly background: Readonly<Record<MarkdownColorName, string>>;
}

/**
 * Colors and metrics for the editor's own UI: the toolbar, its panels, the bottom sheets, and the
 * non-text blocks the native editor draws (media, audio, files, tables, callouts).
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownEditorTheme
{
    /**
     * Font family for the editor's toolbar, panels, and sheets. `null` uses the platform's system
     * font, which supports every weight the editor UI uses.
     */
    readonly fontFamily: string | null;

    /** Size of toolbar, panel, and sheet icons. */
    readonly iconSize: number;

    /** Stroke width passed to toolbar, panel, and sheet icons. */
    readonly iconStrokeWidth: number;

    /** Color of a drop shadow under floating editor UI. */
    readonly shadow: string;

    readonly toolbar:
    {
        readonly background: string;

        /** Hairline above the toolbar. */
        readonly border: string;

        /** Icon and fallback-label color. */
        readonly icon: string;

        /** Fill behind a toolbar button whose panel is open. */
        readonly activeBackground: string;

        /** Hairline separating the scrolling buttons from the trailing button. */
        readonly divider: string;
        readonly height: number;
    };

    readonly panel:
    {
        /** Recessed surface behind a panel's options. */
        readonly background: string;

        /** Raised card behind each option. */
        readonly card: string;

        /** Section-title color. */
        readonly title: string;

        /** Option-label color. */
        readonly label: string;

        /** Primary text color within a panel, e.g. color-panel labels. */
        readonly foreground: string;

        /** Height of the insert and turn-into panels. */
        readonly height: number;

        /** Height of the color panel. */
        readonly colorHeight: number;
    };

    readonly sheet:
    {
        readonly background: string;

        /** Surface of an option row, input field, or grouped card within a sheet. */
        readonly card: string;
        readonly foreground: string;

        /** Secondary text and icon color. */
        readonly muted: string;

        /** Tertiary text and placeholder color. */
        readonly subtle: string;
        readonly border: string;
        readonly divider: string;

        /** Dimming layer behind an open sheet. */
        readonly scrim: string;

        /** The drag handle at the top of a sheet. */
        readonly handle: string;

        /** Fill of the record button while recording. */
        readonly recording: string;
        readonly error: string;
    };

    /** The audio player, shared by the audio sheet and the editor's audio blocks. */
    readonly audio:
    {
        readonly surface: string;
        readonly accent: string;
        readonly onAccent: string;

        /** Waveform bars not yet played. Played bars use {@link accent}. */
        readonly waveformInactive: string;
    };

    /** File blocks drawn by the native editor. */
    readonly attachment:
    {
        /** Fill of the file card's document glyph. */
        readonly accent: string;
        readonly surface: string;
        readonly iconSurface: string;
        readonly foreground: string;
        readonly muted: string;
    };

    /** Image and video blocks drawn by the native editor. */
    readonly media:
    {
        /** Placeholder shown while an image loads. */
        readonly placeholder: string;

        /** Placeholder shown when an image fails to load. */
        readonly placeholderError: string;

        /** Scrim behind a video's play glyph. */
        readonly overlay: string;
        readonly overlayIcon: string;
    };

    readonly table:
    {
        readonly border: string;
        readonly headerBackground: string;

        /** The cell-actions button drawn beside a focused table cell. */
        readonly control: string;
    };

    readonly callout:
    {
        /** Outline drawn around a callout whose color is a text (not background) color. */
        readonly border: string;
    };

    readonly switch:
    {
        readonly trackOn: string;
        readonly trackOff: string;
        readonly thumb: string;
        readonly thumbBorder: string;
    };
}

/**
 * The complete theme for one color scheme.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownTheme
{
    readonly document: MarkdownDocumentTheme;
    readonly palette: MarkdownPalette;
    readonly editor: MarkdownEditorTheme;
}

/**
 * A recursive partial of `T`, used for theme overrides. Arrays and functions are replaced whole.
 *
 * @category Types
 * @since 1.0.0
 */
export type DeepPartial<Value> = Value extends ReadonlyArray<unknown> | ((...args: never) => unknown)
    ? Value
    : Value extends object
        ? { readonly [ Key in keyof Value ]?: DeepPartial<Value[ Key ]> }
        : Value;

/**
 * Per-scheme overrides applied on top of the built-in light and dark themes.
 *
 * @category Types
 * @since 1.0.0
 */
export interface MarkdownThemeOverride
{
    readonly light?: DeepPartial<MarkdownTheme>;
    readonly dark?: DeepPartial<MarkdownTheme>;
}

/**
 * A resolved color scheme.
 *
 * @category Types
 * @since 1.0.0
 */
export type MarkdownColorScheme = "light" | "dark";

/**
 * A requested color scheme; `"system"` follows the device setting.
 *
 * @category Types
 * @since 1.0.0
 */
export type MarkdownColorSchemePreference = MarkdownColorScheme | "system";

/** Deep-freeze a theme so the built-in defaults can never be mutated by a consumer. */
function freezeDeep<Value>(value: Value): Value
{
    if (value !== null && typeof value === "object")
    {
        Object.values(value as Record<string, unknown>).forEach(freezeDeep);
        Object.freeze(value);
    }
    return value;
}

export/**
       * The built-in light theme.
       *
       * @category Constants
       * @since 1.0.0
       */
const lightMarkdownTheme: MarkdownTheme = freezeDeep({
    document:
    {
        accent: "#2f6eab",
        background: "#ffffff",
        border: "#dededb",
        codeBackground: "#f1f1ef",
        danger: "#E56458",
        error: "#b42318",
        fontFamily: "Inter",
        fontSize: 16,
        foreground: "#2C2C2B",
        inlineCodeBackground: "rgba(33,27,23,.05)",
        inlineCodeForeground: "#CF5148",
        monospaceFontFamily: "monospace",
        muted: "#737373",
        onAccent: "#ffffff",
        placeholder: "#444444",
        spacing: 12,
        surface: "#f7f7f5",
        titleFontFamily: "Inter-Black"
    },
    editor:
    {
        attachment:
        {
            accent: "#337EA9",
            foreground: "#2C2C2B",
            iconSurface: "#ffffff",
            muted: "#787774",
            surface: "#f7f7f5"
        },
        audio:
        {
            accent: "#337EA9",
            onAccent: "#ffffff",
            surface: "#F0F6F8",
            waveformInactive: "#A9C9D8"
        },
        callout: { border: "#E6E5E2" },
        fontFamily: null,
        iconSize: 22,
        iconStrokeWidth: 2,
        media:
        {
            overlay: "rgba(0, 0, 0, 0.43)",
            overlayIcon: "#ffffff",
            placeholder: "#cccccc",
            placeholderError: "#444444"
        },
        panel:
        {
            background: "#f7f7f5",
            card: "#ffffff",
            colorHeight: 300,
            foreground: "#2C2C2B",
            height: 300,
            label: "#646464",
            title: "#8e8b86"
        },
        shadow: "#000000",
        sheet:
        {
            background: "#F9F8F6",
            border: "#D9D6D0",
            card: "#FFFFFF",
            divider: "#EEECE9",
            error: "#C23B32",
            foreground: "#2C2C2B",
            handle: "#E6E5E3",
            muted: "#45433F",
            recording: "#D44C47",
            scrim: "rgba(0, 0, 0, 0.25)",
            subtle: "#787774"
        },
        switch:
        {
            thumb: "#FFFFFF",
            thumbBorder: "rgba(15, 15, 15, 0.10)",
            trackOff: "#D0D0CC",
            trackOn: "#337EA9"
        },
        table:
        {
            border: "#dededb",
            control: "#37352F",
            headerBackground: "#f7f7f5"
        },
        toolbar:
        {
            activeBackground: "rgba(0, 0, 0, 0.06)",
            background: "#ffffff",
            border: "#888888",
            divider: "rgba(0, 0, 0, 0.12)",
            height: 48,
            icon: "#8e8b86"
        }
    },
    palette:
    {
        background:
        {
            blue: "#d9eafa",
            brown: "#eee0d6",
            gray: "#e9e9e7",
            green: "#daecdf",
            orange: "#f9e1cc",
            pink: "#f4dce8",
            purple: "#e9dff1",
            red: "#f8dedd",
            yellow: "#f9edc5"
        },
        text:
        {
            blue: "#337ea9",
            brown: "#9f6b53",
            gray: "#6b6b6b",
            green: "#448361",
            orange: "#d9730d",
            pink: "#c14c8a",
            purple: "#9065b0",
            red: "#d44c47",
            yellow: "#c29200"
        }
    }
} satisfies MarkdownTheme);

export/**
       * The built-in dark theme.
       *
       * @category Constants
       * @since 1.0.0
       */
const darkMarkdownTheme: MarkdownTheme = freezeDeep({
    document:
    {
        accent: "#81b8e7",
        background: "#191919",
        border: "#414141",
        codeBackground: "#2d2d2d",
        danger: "#E56458",
        error: "#ff938b",
        fontFamily: "Inter",
        fontSize: 16,
        foreground: "#ededed",
        inlineCodeBackground: "rgba(33,27,23,.05)",
        inlineCodeForeground: "#CF5148",
        monospaceFontFamily: "monospace",
        muted: "#a0a0a0",
        onAccent: "#ffffff",
        placeholder: "#cccccc",
        spacing: 12,
        surface: "#252525",
        titleFontFamily: "Inter-Black"
    },
    editor:
    {
        attachment:
        {
            accent: "#8EC1DB",
            foreground: "#ffffff",
            iconSurface: "#2D363B",
            muted: "#ADA9A3",
            surface: "#2D2D2C"
        },
        audio:
        {
            accent: "#8EC1DB",
            onAccent: "#ffffff",
            surface: "#2D363B",
            waveformInactive: "#5B7F94"
        },
        callout: { border: "#484846" },
        fontFamily: null,
        iconSize: 22,
        iconStrokeWidth: 2,
        media:
        {
            overlay: "rgba(0, 0, 0, 0.43)",
            overlayIcon: "#ffffff",
            placeholder: "#cccccc",
            placeholderError: "#444444"
        },
        panel:
        {
            background: "#2b2b2a",
            card: "#3a3a39",
            colorHeight: 300,
            foreground: "#eeeeee",
            height: 300,
            label: "#A8A8A8",
            title: "#ada9a3"
        },
        shadow: "#000000",
        sheet:
        {
            background: "#202020",
            border: "#4A4946",
            card: "#30302F",
            divider: "rgba(255, 255, 255, 0.10)",
            error: "#C23B32",
            foreground: "#F5F5F5",
            handle: "#3F3F3E",
            muted: "#D0CDC7",
            recording: "#D44C47",
            scrim: "rgba(0, 0, 0, 0.55)",
            subtle: "#ADA9A3"
        },
        switch:
        {
            thumb: "#FFFFFF",
            thumbBorder: "rgba(15, 15, 15, 0.10)",
            trackOff: "#5B5B59",
            trackOn: "#81B8E7"
        },
        table:
        {
            border: "#414141",
            control: "#F5F5F5",
            headerBackground: "#2D2D2C"
        },
        toolbar:
        {
            activeBackground: "rgba(255, 255, 255, 0.08)",
            background: "#191919",
            border: "#888888",
            divider: "rgba(255, 255, 255, 0.14)",
            height: 48,
            icon: "#ada9a3"
        }
    },
    palette:
    {
        background:
        {
            blue: "#2c4150",
            brown: "#49372f",
            gray: "#363636",
            green: "#2d4435",
            orange: "#4d3829",
            pink: "#4a3441",
            purple: "#403449",
            red: "#4d3332",
            yellow: "#4c442b"
        },
        text:
        {
            blue: "#6aaed8",
            brown: "#c08a70",
            gray: "#a6a6a6",
            green: "#75b88b",
            orange: "#f1a353",
            pink: "#df82ac",
            purple: "#b292d3",
            red: "#ef8883",
            yellow: "#dfbd54"
        }
    }
} satisfies MarkdownTheme);

/** Return whether a value is a plain object that should be merged key by key. */
function isMergeableObject(value: unknown): value is Record<string, unknown>
{
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Deep-merge `override` onto `base`. Plain objects merge key by key; every other value (including
 * `null` and arrays) replaces the base value. `undefined` entries are ignored.
 */
function mergeDeep<Value>(base: Value, override: unknown): Value
{
    if (override === undefined)
    {
        return base;
    }

    if (!isMergeableObject(base) || !isMergeableObject(override))
    {
        return override as Value;
    }

    const result: Record<string, unknown> = { ...base };
    for (const [ key, value ] of Object.entries(override))
    {
        if (value !== undefined)
        {
            result[ key ] = mergeDeep(result[ key ], value);
        }
    }

    return result as Value;
}

/**
 * Merge several theme overrides into one, later overrides winning. Useful for combining an outer
 * provider's override with an inner provider's or a component prop's.
 *
 * @category Functions
 * @since 1.0.0
 */
export function mergeMarkdownThemeOverrides(
    ...overrides: ReadonlyArray<MarkdownThemeOverride | undefined>
): MarkdownThemeOverride | undefined
{
    const present = overrides.filter(
        (override: MarkdownThemeOverride | undefined): override is MarkdownThemeOverride =>
            override !== undefined
    );

    if (present.length === 0)
    {
        return undefined;
    }

    return present.reduce(
        (merged: MarkdownThemeOverride, override: MarkdownThemeOverride) =>
            ({
                dark: mergeDeep<DeepPartial<MarkdownTheme>>(merged.dark ?? { }, override.dark),
                light: mergeDeep<DeepPartial<MarkdownTheme>>(merged.light ?? { }, override.light)
            }),
        { }
    );
}

/**
 * Resolve the complete theme for a color scheme: the built-in theme for that scheme, with each
 * override's matching scheme deep-merged on top, in order.
 *
 * @category Functions
 * @since 1.0.0
 */
export function resolveMarkdownTheme(
    scheme: MarkdownColorScheme,
    ...overrides: ReadonlyArray<MarkdownThemeOverride | undefined>
): MarkdownTheme
{
    const base = scheme === "dark" ? darkMarkdownTheme : lightMarkdownTheme;
    return overrides.reduce(
        (theme: MarkdownTheme, override: MarkdownThemeOverride | undefined) =>
            mergeDeep<MarkdownTheme>(theme, override?.[ scheme ]),
        base
    );
}

/** Parse a hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`) or `rgb()`/`rgba()` color to channels. */
function parseColor(color: string): { r: number; g: number; b: number; a: number } | undefined
{
    const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu.exec(color.trim());
    if (hex !== null)
    {
        const digits = hex[ 1 ] as string;
        const expanded = digits.length <= 4
            ? digits.split("").map((digit: string) => digit + digit).join("")
            : digits;
        const channel = (index: number): number => parseInt(expanded.slice(index * 2, index * 2 + 2), 16);
        return {
            a: expanded.length === 8 ? channel(3) / 255 : 1,
            b: channel(2),
            g: channel(1),
            r: channel(0)
        };
    }

    const functional = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/iu
        .exec(color.trim());
    if (functional !== null)
    {
        return {
            a: functional[ 4 ] === undefined ? 1 : Number(functional[ 4 ]),
            b: Number(functional[ 3 ]),
            g: Number(functional[ 2 ]),
            r: Number(functional[ 1 ])
        };
    }

    return undefined;
}

/**
 * Return `color` with its opacity multiplied by `alpha` (0-1), as an `rgba()` string. Colors in a
 * format this cannot parse (e.g. named colors) are returned unchanged.
 *
 * @category Functions
 * @since 1.0.0
 */
export function withAlpha(color: string, alpha: number): string
{
    const parsed = parseColor(color);
    if (parsed === undefined)
    {
        return color;
    }

    const opacity = Math.round(parsed.a * alpha * 1000) / 1000;
    return `rgba(${ parsed.r }, ${ parsed.g }, ${ parsed.b }, ${ opacity })`;
}

/**
 * Resolve a Markdown color name -- either suffix convention, `_bg` or `_background` -- to the
 * palette's corresponding color. Returns `undefined` for no color, `"default"`, or an unknown name.
 *
 * @category Functions
 * @since 1.0.0
 */
export function markdownColor(
    color: MarkdownColor | string | undefined,
    palette: MarkdownPalette
): string | undefined
{
    if (!color || color === "default")
    {
        return undefined;
    }

    const normalized = fromSdkColor(color) as string;
    const background = normalized.endsWith("_bg");
    const name = background ? normalized.slice(0, -3) : normalized;
    if (!(markdownColorNames as ReadonlyArray<string>).includes(name))
    {
        return undefined;
    }

    return (background ? palette.background : palette.text)[ name as MarkdownColorName ];
}
