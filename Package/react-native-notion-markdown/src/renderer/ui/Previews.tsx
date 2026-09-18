/**
 * @module react-native-notion-markdown/renderer/ui/Previews
 *
 * @file      Previews.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Image, Pressable, Text, View } from "react-native";
import type { NotionBlock, NotionRichText } from "../../document/types.ts";
import type { NotionMediaRequest, NotionRendererTheme } from "./types.ts";
import { type StatusChangeEventPayload, VideoView, useVideoPlayer } from "expo-video";
import { asRecord, getNotionBlockPayload } from "../../internal.ts";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NotionRichTextView } from "./RichText.tsx";
import Pdf from "react-native-pdf";

/**
 * Media kinds supported by the renderer previews.
 *
 * @category Types
 * @since 1.0.0
 */
export type MediaKind = NotionMediaRequest["kind"];

/**
 * Props for rendering media belonging to a given block.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionMediaViewProps
{
    readonly block: NotionBlock;
    readonly kind: MediaKind;
    readonly theme: NotionRendererTheme;
    readonly dark: boolean;
    readonly onOpenUrl?: (url: string) => void;
    readonly resolveMediaUrl?: (request: NotionMediaRequest) => Promise<string | null>;
}

/**
 * Read the media URL and caption from a given block.
 *
 * @category Functions
 * @since 1.0.0
 */
function sourceOf(block: NotionBlock): { url?: string; caption?: NotionRichText }
{
    const data = getNotionBlockPayload(block);
    const source = asRecord(data.file).url ?? asRecord(data.external).url ?? data.url;
    return {
        caption: Array.isArray(data.caption) ? data.caption as NotionRichText : undefined,
        url: typeof source === "string" ? source : undefined
    } as const;
}

/**
 * Render a preview message with an optional retry action.
 *
 * @category Functions
 * @since 1.0.0
 */
function Message({ text, theme, retry }: {
    readonly text: string;
    readonly theme: NotionRendererTheme;
    readonly retry?: () => void
})
{
    return (
        <View style={ { backgroundColor: theme.surface, borderRadius: 6, padding: theme.spacing } }>
            <Text style={ { color: theme.muted, fontFamily: theme.fontFamily, fontSize: theme.fontSize } }>
                { text }
            </Text>
            {
                retry && (
                    <Pressable
                        accessibilityLabel="Retry preview"
                        accessibilityRole="button"
                        onPress={ retry }
                        style={ { paddingVertical: 8 } }>
                        <Text style={ { color: theme.accent, fontFamily: theme.fontFamily } }>
                            Retry
                        </Text>
                    </Pressable>
                )
            }
        </View>
    );
}

/**
 * Render an audio preview for the given URL.
 *
 * @category Functions
 * @since 1.0.0
 */
function AudioPreview({ url, theme, onUnavailable }: {
    readonly url: string;
    readonly theme: NotionRendererTheme;
    readonly onUnavailable: () => void;
})
{
    const player = useAudioPlayer({ uri: url });
    const status = useAudioPlayerStatus(player);
    useEffect(() =>
    {
        if (status.error)
        {
            onUnavailable();
        }
    }, [ status.error, onUnavailable ]);

    if (status.error)
    {
        return (
            <Message
                text="Audio unavailable"
                theme={ theme }
            />
        );
    }
    return (
        <Pressable
            accessibilityLabel={ status.playing ? "Pause audio" : "Play audio" }
            accessibilityRole="button"
            onPress={ () => status.playing ? player.pause() : player.play() }
            style={ { backgroundColor: theme.surface, padding: theme.spacing } }>
            <Text style={ {
                color: theme.foreground,
                fontFamily: theme.fontFamily,
                fontSize: theme.fontSize
            } }>
                { status.playing ? "Pause" : "Play" } audio · { Math.floor(status.currentTime) }s /{ " " }
                { Math.floor(status.duration) }s
            </Text>
        </Pressable>
    );
}

/**
 * Render a video preview for the given URL.
 *
 * @category Functions
 * @since 1.0.0
 */
function VideoPreview({ url, onUnavailable }: { readonly url: string; readonly onUnavailable: () => void })
{
    const player = useVideoPlayer({ uri: url });

    useEffect(() =>
    {
        const listener = player.addListener(
            "statusChange",
            ({ status }: StatusChangeEventPayload) =>
            {
                if (status === "error")
                {
                    onUnavailable();
                }
            });
        return listener.remove;
    }, [ player, onUnavailable ]);

    return (
        <VideoView
            nativeControls
            player={ player }
            style={ { height: 230, width: "100%" } }
        />
    );
}

/** On-demand native media adapter. Unmounting the child releases its playback/PDF resources. */
export function NotionMediaView({
    block,
    kind,
    theme,
    dark,
    onOpenUrl,
    resolveMediaUrl
}: NotionMediaViewProps)
{
    const source = sourceOf(block);
    const activeKey = `${block.id}:${kind}:${source.url ?? ""}`;
    const [ openedKey, setOpenedKey ] = useState<string>();
    const [ retry, setRetry ] = useState(0);
    const active = kind === "image" || openedKey === activeKey;
    const requestKey = useMemo(
        () => ({ active, block, kind, resolveMediaUrl, retry }),
        [ active, block, kind, resolveMediaUrl, retry ]
    );

    interface Result
    {
        readonly key: object;
        readonly url?: string;
        readonly error?: string;
        readonly loaded?: boolean;
    }

    const [ result, setResult ] = useState<Result>();

    if (kind === "audio")
    {
        /* eslint-disable-next-line no-console */
        console.log("M3_MEDIA_RENDER", block.id, openedKey, activeKey, active);
    }

    useEffect(() =>
    {
        if (kind === "audio")
        {
            /* eslint-disable no-console */
            console.log("M3_MEDIA_MOUNT", block.id);
            return () => console.log("M3_MEDIA_UNMOUNT", block.id);
            /* eslint-enable no-console */
        }

        return;
    }, [ block.id, kind ]);

    const current = result?.key === requestKey ? result : undefined;
    const url = current?.url;
    const error = current?.error;
    const loaded = current?.loaded ?? false;

    useEffect(() =>
    {
        if (!active)
        {
            return;
        }

        let live = true;
        const resolve = resolveMediaUrl
            ? resolveMediaUrl({ block, kind, url: source.url })
            : Promise.resolve(source.url ?? null);
        void resolve
            .then((result: string | null) =>
            {
                if (!live) {return;}
                if (!result || !/^(https?:|file:|content:|data:)/i.test(result))
                {
                    setResult({
                        error: "Resource unavailable or URL invalid",
                        key: requestKey
                    });
                }
                else
                {
                    setResult({
                        key: requestKey,
                        url: result
                    });
                }
            })
            .catch(() =>
            {
                if (live)
                {
                    setResult({
                        error: "Resource unavailable",
                        key: requestKey
                    });
                }
            });

        return () =>
        {
            live = false;
        };
    }, [ active, block, kind, resolveMediaUrl, retry, source.url, requestKey ]);

    const restart = useCallback(() => setRetry((value: number) => value + 1), [ ]);
    const failed = (message: string) => { setResult({ error: message, key: requestKey }); };
    const heading = kind === "pdf"
        ? "PDF"
        : kind.slice(0, 1).toUpperCase() + kind.slice(1);

    return (
        <View
            style={ { marginVertical: 6 } }
            testID={ `media-${block.id}` }>
            {!active && (
                <Pressable accessibilityLabel={ `Load ${heading} preview` }
                    accessibilityRole="button"
                    onPress={ () => setOpenedKey(activeKey) }
                    style={ { backgroundColor: theme.surface, borderRadius: 6, padding: theme.spacing } }>
                    <Text style={ {
                        color: theme.accent,
                        fontFamily: theme.fontFamily,
                        fontSize: theme.fontSize
                    } }>
                        Load { heading } preview
                    </Text>
                </Pressable>
            )
            }
            {
                active && error && (
                    <Message retry={ restart }
                        text={ error }
                        theme={ theme }
                    />
                )
            }
            {
                active && !error && !url && (
                    <Message
                        text={ `Loading ${heading.toLowerCase()}…` }
                        theme={ theme }
                    />
                )
            }
            {
                active && !error && url && kind === "image" && (
                    <Image
                        accessibilityLabel={ source.caption?.length ? "Image with caption" : "Image" }
                        onError={ () => failed("Image unavailable") }
                        onLoad={ () => setResult({ key: requestKey, loaded: true, url }) }
                        resizeMode="contain"
                        source={ { uri: url } }
                        style={ { width: "100%", height: 240, backgroundColor: theme.surface } }
                    />
                )
            }
            {
                active && !error && url && kind === "pdf" && (
                    <Pdf
                        onError={ () => failed("PDF unavailable") }
                        onLoadComplete={ () => setResult({ key: requestKey, url, loaded: true }) }
                        source={ { cache: true, uri: url } }
                        style={ { backgroundColor: theme.surface, height: 360, width: "100%" } }
                    />
                )
            }
            {
                active && !error && url && kind === "audio" && (
                    <AudioPreview
                        onUnavailable={ () => failed("Audio unavailable") }
                        theme={ theme }
                        url={ url }
                    />
                )
            }
            {
                active && !error && url && kind === "video" && (
                    <VideoPreview
                        onUnavailable={ () => failed("Video unavailable") }
                        url={ url }
                    />
                )
            }
            {
                active && !error && url && kind === "file" && (
                    <Pressable
                        accessibilityLabel="Open file"
                        accessibilityRole="link"
                        onPress={ () => onOpenUrl?.(url) }
                        style={ { backgroundColor: theme.surface, borderRadius: 6, padding: theme.spacing } }>
                        <Text style={ {
                            color: theme.accent,
                            fontFamily: theme.fontFamily,
                            fontSize: theme.fontSize
                        } }>
                            Open file
                        </Text>
                    </Pressable>
                )
            }
            {
                active && url && !error && (kind === "pdf" || kind === "audio" || kind === "video") && (
                    <Pressable
                        accessibilityLabel={ `Close ${ heading } preview` }
                        accessibilityRole="button"
                        onPress={ () => setOpenedKey(undefined) }
                        style={ { paddingVertical: 8 } }>
                        <Text style={ { color: theme.muted, fontFamily: theme.fontFamily } }>
                            Close preview
                        </Text>
                    </Pressable>
                )
            }
            {
                active && url && !loaded && !error && (kind === "image" || kind === "pdf") && (
                    <Text style={ { color: theme.muted, fontFamily: theme.fontFamily } }>
                        Loading…
                    </Text>
                )
            }
            {
                source.caption && (
                    <NotionRichTextView
                        dark={ dark }
                        items={ source.caption }
                        onOpenUrl={ onOpenUrl }
                        textStyle={ { color: theme.muted, fontSize: theme.fontSize * 0.88 } }
                        theme={ theme }
                    />
                )
            }
        </View>
    );
}
