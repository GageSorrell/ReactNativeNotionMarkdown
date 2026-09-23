/**
 *
 *
 * @module react-native-notion-markdown/renderer/ui/theme
 *
 * @file      theme.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { MarkdownColor } from "../../document/types.ts";
import type { MarkdownRendererTheme } from "./types.ts";
import { fromSdkColor } from "../../internal.ts";

export/**
       * The default light theme used by the Markdown renderer.
       *
       * @category Constants
       * @since 1.0.0
       */
const lightRendererTheme: MarkdownRendererTheme = Object.freeze({
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
    muted: "#737373",
    spacing: 12,
    surface: "#f7f7f5",
    titleFontFamily: "Inter-Black"
} as const);

export/**
       * The default dark theme used by the Markdown renderer.
       *
       * @category Constants
       * @since 1.0.0
       */
const darkRendererTheme: MarkdownRendererTheme = Object.freeze({
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
    muted: "#a0a0a0",
    spacing: 12,
    surface: "#252525",
    titleFontFamily: "Inter-Black"
} as const);

const lightColors: Record<string, string> =
    {
        blue: "#337ea9",
        brown: "#9f6b53",
        gray: "#6b6b6b",
        green: "#448361",
        orange: "#d9730d",
        pink: "#c14c8a",
        purple: "#9065b0",
        red: "#d44c47",
        yellow: "#c29200",

        blue_bg: "#d9eafa",
        brown_bg: "#eee0d6",
        gray_bg: "#e9e9e7",
        green_bg: "#daecdf",
        orange_bg: "#f9e1cc",
        pink_bg: "#f4dce8",
        purple_bg: "#e9dff1",
        red_bg: "#f8dedd",
        yellow_bg: "#f9edc5"
    };

const darkColors: Record<string, string> =
    {
        blue: "#6aaed8",
        brown: "#c08a70",
        gray: "#a6a6a6",
        green: "#75b88b",
        orange: "#f1a353",
        pink: "#df82ac",
        purple: "#b292d3",
        red: "#ef8883",
        yellow: "#dfbd54",

        blue_bg: "#2c4150",
        brown_bg: "#49372f",
        gray_bg: "#363636",
        green_bg: "#2d4435",
        orange_bg: "#4d3829",
        pink_bg: "#4a3441",
        purple_bg: "#403449",
        red_bg: "#4d3332",
        yellow_bg: "#4c442b"
    };

/**
 * Resolve a given Markdown color to its corresponding theme color.
 *
 * @category Functions
 * @since 1.0.0
 */
export function markdownColor(
    color: MarkdownColor | string | undefined,
    dark: boolean
): string | undefined
{
    if (!color || color === "default")
    {
        return undefined;
    }

    const normalized = fromSdkColor(color) as string;

    return (dark ? darkColors : lightColors)[normalized];
}
