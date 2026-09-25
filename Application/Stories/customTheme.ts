/**
 * A deliberately distinctive theme shared by the "Custom Theme" stories, so a reviewer can see at a
 * glance that every surface -- document text, toolbar, panels, sheets, native blocks, and the
 * renderer -- follows `MarkdownProvider`'s theme rather than the built-in colors.
 *
 * @module markdown-storybook/Stories/customTheme
 *
 * @file      customTheme.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { MarkdownThemeOverride } from "react-native-notion-markdown/provider";

export/**
       * A warm "sepia" theme, in light and dark variants, using the platform serif font.
       */
const sepiaTheme: MarkdownThemeOverride =
    {
        dark:
        {
            document:
            {
                accent: "#E0915F",
                background: "#221B15",
                border: "#4A3C30",
                fontFamily: "serif",
                foreground: "#F1E4D0",
                muted: "#B39E86",
                surface: "#2E251D",
                titleFontFamily: "serif"
            },
            editor:
            {
                audio: { accent: "#E0915F", surface: "#3A2E24" },
                fontFamily: "serif",
                panel:
                {
                    background: "#2E251D",
                    card: "#3A2E24",
                    foreground: "#F1E4D0",
                    label: "#E5D3BB",
                    title: "#C9A983"
                },
                sheet: { background: "#2A211A", card: "#3A2E24", foreground: "#F1E4D0", muted: "#D8C3A8" },
                switch: { trackOn: "#E0915F" },
                toolbar:
                {
                    activeBackground: "rgba(224, 145, 95, 0.18)",
                    background: "#2A211A",
                    icon: "#C9A983"
                }
            }
        },
        light:
        {
            document:
            {
                accent: "#B4532A",
                background: "#FBF4E6",
                border: "#E2D2B4",
                fontFamily: "serif",
                fontSize: 17,
                foreground: "#3B2F2F",
                muted: "#8A7560",
                surface: "#F3E7CF",
                titleFontFamily: "serif"
            },
            editor:
            {
                audio: { accent: "#B4532A", surface: "#F3E7CF" },
                fontFamily: "serif",
                panel:
                {
                    background: "#EFE0C2",
                    card: "#FBF4E6",
                    foreground: "#3B2F2F",
                    label: "#5C4533",
                    title: "#8A5A3C"
                },
                sheet: { background: "#FBF4E6", card: "#FFFDF8", foreground: "#3B2F2F", muted: "#6B5442" },
                switch: { trackOn: "#B4532A" },
                toolbar:
                {
                    activeBackground: "rgba(180, 83, 42, 0.14)",
                    background: "#F3E7CF",
                    icon: "#8A5A3C"
                }
            },
            palette:
            {
                text: { blue: "#2E6F8E" }
            }
        }
    };
