/**
 *
 *
 * @module react-native-notion-markdown/renderer/ui/FaviconIcon
 *
 * @file      FaviconIcon.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/** Favicon loading and fallback icon presentation for arbitrary web links. */

import { Image, Text, View } from "react-native";
import type { NotionReferenceIconComponent } from "./types.ts";
import { createElement, useEffect, useState } from "react";
import type { ComponentType } from "react";

interface FaviconIconProps
{
    readonly color: string;
    readonly fallbackIcon?: NotionReferenceIconComponent;
    readonly size: number;
    readonly textFallback?: string;
    readonly url: string;
}

type OptionalLucideModule = Record<string, ComponentType<{
    readonly color: string;
    readonly size: number;
    readonly strokeWidth: number;
}>> & { readonly default?: OptionalLucideModule };

let optionalLucide: OptionalLucideModule | null | undefined;

/** Resolve Lucide's document icon without making the package a hard dependency. */
function getDocumentIcon(): ComponentType<{
    readonly color: string;
    readonly size: number;
    readonly strokeWidth: number;
}> | undefined
{
    if (optionalLucide === undefined)
    {
        try
        {
            const optionalRequire = eval("require") as (moduleName: string) => OptionalLucideModule;
            const loaded = optionalRequire("lucide-react-native");
            optionalLucide = loaded.default ? { ...loaded, ...loaded.default } : loaded;
        }
        catch
        {
            optionalLucide = null;
        }
    }

    return optionalLucide?.FileText ?? optionalLucide?.FileTextIcon;
}

/** Resolve a favicon href from a link element in the fetched document. */
function hrefFromTag(tag: string, pageUrl: string): string | undefined
{
    const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[ 1 ] ?? "";
    if (!rel.split(/\s+/).some((value: string) =>
        value.toLowerCase() === "icon" || value.toLowerCase() === "shortcut" ||
        value.toLowerCase() === "apple-touch-icon"))
    {
        return undefined;
    }

    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[ 1 ];
    if (href === undefined) {return undefined;}
    try
    {
        return new URL(href, pageUrl).toString();
    }
    catch
    {
        return undefined;
    }
}

/** Find a declared favicon, falling back to the conventional root favicon when it responds. */
export async function resolveFaviconUrl(pageUrl: string): Promise<string | undefined>
{
    let parsed: URL;
    try
    {
        parsed = new URL(pageUrl);
    }
    catch
    {
        return undefined;
    }

    try
    {
        const response = await fetch(parsed.toString());
        if (response.ok)
        {
            const html = await response.text();
            const tags = html.match(/<link\b[^>]*>/gi) ?? [ ];
            const declared = tags.map((tag: string) => hrefFromTag(tag, parsed.toString()))
                .find((href: string | undefined): href is string => href !== undefined);
            if (declared !== undefined) {return declared;}
        }
    }
    catch
    {
        /* Try the conventional favicon URL below. */
    }

    const conventional = `${ parsed.origin }/favicon.ico`;
    try
    {
        const response = await fetch(conventional, { method: "HEAD" });
        return response.ok ? conventional : undefined;
    }
    catch
    {
        return undefined;
    }
}

/** Render a downloaded favicon, or the dependent/Lucide/document fallbacks. */
export function FaviconIcon({
    color,
    fallbackIcon: FallbackIcon,
    size,
    textFallback,
    url
}: FaviconIconProps)
{
    const [ favicon, setFavicon ] = useState<{ readonly url: string; readonly value?: string }>();
    const [ failedUrl, setFailedUrl ] = useState<string>();
    const LucideDocument = getDocumentIcon();

    useEffect(() =>
    {
        let live = true;
        void resolveFaviconUrl(url).then((value: string | undefined) =>
        {
            if (live)
            {
                setFavicon({ url, value });
                setFailedUrl(undefined);
            }
        });
        return () => { live = false; };
    }, [ url ]);

    if (favicon?.url === url && favicon.value !== undefined && failedUrl !== url)
    {
        return <Image
            accessibilityLabel="Web page favicon"
            onError={ () => setFailedUrl(url) }
            source={ { uri: favicon.value } }
            style={ { height: size, width: size } }
        />;
    }

    if (FallbackIcon !== undefined)
    {
        return createElement(FallbackIcon, { color, size, strokeWidth: 2 });
    }

    if (LucideDocument !== undefined)
    {
        return createElement(LucideDocument, { color, size, strokeWidth: 2 });
    }

    return textFallback !== undefined
        ? <Text style={ { color, fontSize: size } }>{ textFallback }</Text>
        : <View style={ { height: size, width: size } } />;
}
