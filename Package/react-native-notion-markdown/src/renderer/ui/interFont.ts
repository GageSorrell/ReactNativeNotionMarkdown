/**
 * A font map for `expo-font`'s `useFonts`, backed by the optional `@expo-google-fonts/inter` peer.
 *
 * This lives in its own module, deliberately never imported by `renderer/ui`'s main entry point
 * (`index.ts`), so that Metro only needs to resolve the optional `@expo-google-fonts/inter` peer
 * for consumers who import this file specifically. The renderer itself cannot auto-detect and
 * load an optional peer: Metro resolves every `require`/`import` specifier at build time, so a
 * statically visible import of `@expo-google-fonts/inter` in a module every consumer touches
 * would force all of them to install it, regardless of a runtime `try`/`catch`. Importing this
 * file is the opt-in -- do it only from an app that actually declares `@expo-google-fonts/inter`
 * and `expo-font` as dependencies.
 *
 * The renderer's default theme already names its font families `"Inter"` and `"Inter-Black"`
 * (see `theme.ts`); passing this map straight to `useFonts` registers those exact families, so
 * body text and `heading_1` titles start rendering in Inter as soon as loading finishes. Until
 * then -- or if this module is never imported at all -- the renderer falls back to the platform's
 * system font, since React Native silently ignores an unregistered `fontFamily` name.
 *
 * Usage: `useFonts(notionMarkdownInterFonts)`, from `expo-font`, in an app that has installed
 * both optional peers.
 *
 * @module react-native-notion-markdown/renderer/ui/interFont
 *
 * @file      interFont.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Inter_400Regular, Inter_900Black } from "@expo-google-fonts/inter";

export/**
       * Pass this to `expo-font`'s `useFonts` to register the font families the renderer's
       * default theme expects: `"Inter"` for body text and `"Inter-Black"` for page titles.
       *
       * @since 1.0.0
       */
const notionMarkdownInterFonts =
    {
        Inter: Inter_400Regular,
        "Inter-Black": Inter_900Black
    } as const;
