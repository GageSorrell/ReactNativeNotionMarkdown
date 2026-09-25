/**
 * Offline, preview-only Mermaid diagrams.
 *
 * @module react-native-notion-markdown/renderer/ui/MermaidView
 *
 * @file      MermaidView.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Pressable, Text, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { useCallback, useMemo, useState } from "react";
import { MERMAID_RUNTIME } from "./mermaidRuntime.ts";
import type { MarkdownTheme } from "../../provider/theme.ts";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { useResolvedRendererConfig } from "../../provider/MarkdownProvider.tsx";

/**
 * Props for rendering a given Mermaid diagram source.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownMermaidViewProps
{
    readonly source: string;

    /** Overrides the nearest `MarkdownProvider`'s theme. */
    readonly theme?: MarkdownTheme;
}

/** Strip characters that could end the inline stylesheet's declaration. */
function cssValue(value: string): string
{
    return value.replace(/[<>{};]/g, "");
}

/**
 * Build the HTML document used to render the given Mermaid source.
 *
 * @category Functions
 * @since 1.0.0
 */
function htmlFor(source: string, foreground: string): string
{
    const safeSource = JSON.stringify(source).replace(/</g, "\\u003c");

    /* eslint-disable @stylistic/max-len */
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>body{margin:0;padding:8px;background:transparent;color:${ cssValue(foreground) }}#diagram{pointer-events:none}svg{max-width:100%;height:auto}</style></head><body><div id="diagram"></div>
<script>${ MERMAID_RUNTIME }</script><script>(async()=>{try{const svg=await window.__renderMarkdownMermaid(${safeSource},'markdown-mermaid');document.getElementById('diagram').innerHTML=svg;window.ReactNativeWebView.postMessage(JSON.stringify({ok:true,height:Math.max(80,document.body.scrollHeight)}));}catch(error){window.ReactNativeWebView.postMessage(JSON.stringify({ok:false,message:String(error)}));}})();</script></body></html>`;
    /* eslint-enable @stylistic/max-len */
}

/** Offline, preview-only Mermaid WebView. Diagram text never runs as application script. */
export function MarkdownMermaidView({ source, theme: suppliedTheme }: MarkdownMermaidViewProps)
{
    const { t, theme: resolvedTheme } = useResolvedRendererConfig();
    const { document: theme } = suppliedTheme ?? resolvedTheme;
    const [ active, setActive ] = useState(false);
    const [ error, setError ] = useState<string>();
    const [ height, setHeight ] = useState(160);
    const [ attempt, setAttempt ] = useState(0);
    const html = useMemo(() => htmlFor(source, theme.foreground), [ source, theme.foreground ]);
    const invalid = !source.trim();

    const RootStyle = useMemo(() => ({
        backgroundColor: theme.surface,
        borderRadius: 6,
        marginVertical: 6,
        padding: 8
    }), [ theme.surface ]);

    const ErrorStyle = useMemo(() => ({ color: theme.error }), [ theme.error ]);
    const AccentStyle = useMemo(() => ({ color: theme.accent }), [ theme.accent ]);

    const HandleLoadPreview = useCallback(() =>
    {
        setError(undefined);
        setActive(true);
    }, [ ]);

    const HandleMessage = useCallback((event: WebViewMessageEvent) =>
    {
        try
        {
            interface Message
            {
                readonly ok: boolean;
                readonly height?: number;
                readonly message?: string;
            }

            const message = JSON.parse(event.nativeEvent.data) as Message;

            if (message.ok)
            {
                setHeight(Math.min(1200, Math.max(80, message.height ?? 160)));
            }
            else
            {
                setError(message.message ?? t("renderer.invalidMermaidSource"));
            }
        }
        catch
        {
            setError(t("renderer.mermaidPreviewFailed"));
        }
    }, [ t ]);

    const HandleRetry = useCallback(() =>
    {
        setAttempt((value: number) => value + 1);
        setError(undefined);
    }, [ ]);

    const RetryStyle = useMemo(() => ({ color: theme.accent, paddingVertical: 8 }), [ theme.accent ]);

    const OriginWhitelist = useMemo(() => [ "about:blank" ], [ ]);

    const SourceStyle = useMemo(() => ({
        color: theme.muted,
        fontFamily: theme.monospaceFontFamily,
        fontSize: theme.fontSize * 0.8,
        marginTop: 6
    }), [ theme.fontSize, theme.monospaceFontFamily, theme.muted ]);

    const HandleClose = useCallback(() => setActive(false), [ ]);

    const CloseStyle = useMemo(() => ({ color: theme.muted, paddingVertical: 8 }), [ theme.muted ]);

    const HandleError = useCallback(() => setError(t("renderer.mermaidPreviewFailed")), [ t ]);

    const HandleShouldStartLoadWithRequest = useCallback(
        (request: ShouldStartLoadRequest) => request.url === "about:blank",
        [ ]
    );

    const WebViewSource = useMemo(() => ({
        baseUrl: "about:blank",
        html
    }), [ html ]);

    const WebViewStyle = useMemo(() => ({
        backgroundColor: theme.surface,
        height
    }), [ height, theme.surface ]);

    return <View style={ RootStyle }>
        {
            invalid && (
                <Text style={ ErrorStyle }>
                    { t("renderer.invalidMermaidSource") }
                </Text>
            )
        }
        {
            !invalid && !active && (
                <Pressable accessibilityLabel={ t("renderer.loadMermaidPreview") }
                    accessibilityRole="button"
                    onPress={ HandleLoadPreview }>
                    <Text style={ AccentStyle }>
                        { t("renderer.loadMermaidPreview") }
                    </Text>
                </Pressable>
            )
        }
        {
            !invalid && active && !error && (
                <WebView
                    allowFileAccess={ false }
                    domStorageEnabled={ false }
                    javaScriptCanOpenWindowsAutomatically={ false }
                    javaScriptEnabled
                    key={ `${ source }:${ attempt }` }
                    mixedContentMode="never"
                    onError={ HandleError }
                    onMessage={ HandleMessage }
                    onShouldStartLoadWithRequest={ HandleShouldStartLoadWithRequest }
                    originWhitelist={ OriginWhitelist }
                    setSupportMultipleWindows={ false }
                    source={ WebViewSource }
                    style={ WebViewStyle }
                />
            )}
        {
            error && (
                <View>
                    <Text
                        accessibilityLabel={ t("renderer.mermaidPreviewError") }
                        style={ ErrorStyle }>
                        { t("renderer.invalidMermaidSourceWithError", { error }) }
                    </Text>
                    <Pressable
                        accessibilityLabel={ t("renderer.retryMermaidPreview") }
                        accessibilityRole="button"
                        onPress={ HandleRetry }>
                        <Text style={ RetryStyle }>
                            { t("renderer.retry") }
                        </Text>
                    </Pressable>
                </View>
            )
        }
        <Text
            selectable
            style={ SourceStyle }>
            { source }
        </Text>
        {
            active && (
                <Pressable
                    accessibilityLabel={ t("renderer.closeMermaidPreview") }
                    accessibilityRole="button"
                    onPress={ HandleClose }>
                    <Text style={ CloseStyle }>
                        { t("renderer.closePreview") }
                    </Text>
                </Pressable>
            )
        }
    </View>;
}
