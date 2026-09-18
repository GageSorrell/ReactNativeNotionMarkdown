/**
 *
 *
 * @module react-native-notion-markdown/openPageReference
 *
 * @file      openPageReference.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Linking as NativeLinking } from "react-native";

interface OptionalLinkingModule
{
    readonly openURL?: (url: string) => Promise<unknown> | unknown;
}

declare const require: ((moduleName: string) => unknown) | undefined;

/** Open a page URL through Expo Linking when the optional peer is available. */
export async function openPageReferenceUrl(url: string): Promise<void>
{
    try
    {
        const moduleName = "expo-linking";
        const linking = typeof require === "function"
            ? require(moduleName) as OptionalLinkingModule
            : undefined;
        if (typeof linking?.openURL === "function")
        {
            await linking.openURL(url);
            return;
        }
    }
    catch
    {
        /* Fall through to React Native's built-in URL handler. */
    }

    await NativeLinking.openURL(url);
}
