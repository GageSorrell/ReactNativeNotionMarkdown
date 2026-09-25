/**
 * On-demand media previews for image, audio, video, file, and PDF blocks.
 *
 * @module react-native-notion-markdown/renderer/ui/Previews
 *
 * @file      Previews.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Image, Pressable, Text, View } from "react-native";
import type { MarkdownBlock, MarkdownRichText } from "../../document/types.ts";
import type { MarkdownDocumentTheme, MarkdownTheme } from "../../provider/theme.ts";
import type { MarkdownMessageId } from "../../provider/messages.ts";
import type { MarkdownMediaRequest } from "./types.ts";
import type { MarkdownOpenUrl } from "../../provider/MarkdownProvider.tsx";
import { type StatusChangeEventPayload, VideoView, useVideoPlayer } from "expo-video";
import { asRecord, getMarkdownBlockPayload } from "../../internal.ts";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MarkdownRichTextView } from "./RichText.tsx";
import Pdf from "react-native-pdf";
import { useResolvedRendererConfig } from "../../provider/MarkdownProvider.tsx";

/**
 * Media kinds supported by the renderer previews.
 *
 * @category Types
 * @since 1.0.0
 */
export type MediaKind = MarkdownMediaRequest["kind"];

/** The message naming each media kind in preview labels. */
const mediaKindMessageIds: Readonly<Record<MediaKind, MarkdownMessageId>> =
    {
        audio: "renderer.mediaKindAudio",
        file: "renderer.mediaKindFile",
        image: "renderer.mediaKindImage",
        pdf: "renderer.mediaKindPdf",
        video: "renderer.mediaKindVideo"
    };

/**
 * Props for rendering media belonging to a given block. The theme, link opening, and media URL
 * resolution default to the nearest `MarkdownProvider`'s; pass them to override.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownMediaViewProps
{
    readonly block: MarkdownBlock;
    readonly kind: MediaKind;
    readonly theme?: MarkdownTheme;
    readonly onOpenUrl?: MarkdownOpenUrl;
    readonly resolveMediaUrl?: (request: MarkdownMediaRequest) => Promise<string | null>;
}

/**
 * Read the media URL and caption from a given block.
 *
 * @category Functions
 * @since 1.0.0
 */
function sourceOf(block: MarkdownBlock): { url?: string; caption?: MarkdownRichText }
{
    const data = getMarkdownBlockPayload(block);
    const source = asRecord(data.file).url ?? asRecord(data.external).url ?? data.url;
    return {
        caption: Array.isArray(data.caption) ? data.caption as MarkdownRichText : undefined,
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
    readonly theme: MarkdownDocumentTheme;
    readonly retry?: () => void
})
{
    const { t } = useResolvedRendererConfig();
    const rootStyle = useMemo(
        () => ({ backgroundColor: theme.surface, borderRadius: 6, padding: theme.spacing }),
        [ theme.spacing, theme.surface ]
    );
    const textStyle = useMemo(
        () => ({ color: theme.muted, fontFamily: theme.fontFamily, fontSize: theme.fontSize }),
        [ theme.fontFamily, theme.fontSize, theme.muted ]
    );
    const retryStyle = useMemo(() => ({ paddingVertical: 8 }), [ ]);
    const retryTextStyle = useMemo(
        () => ({ color: theme.accent, fontFamily: theme.fontFamily }),
        [ theme.accent, theme.fontFamily ]
    );

    return (
        <View style={ rootStyle }>
            <Text style={ textStyle }>
                { text }
            </Text>
            {
                retry && (
                    <Pressable
                        accessibilityLabel={ t("renderer.retryPreview") }
                        accessibilityRole="button"
                        onPress={ retry }
                        style={ retryStyle }>
                        <Text style={ retryTextStyle }>
                            { t("renderer.retry") }
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
    readonly theme: MarkdownDocumentTheme;
    readonly onUnavailable: () => void;
})
{
    const { t } = useResolvedRendererConfig();
    const player = useAudioPlayer({ uri: url });
    const status = useAudioPlayerStatus(player);
    useEffect(() =>
    {
        if (status.error)
        {
            onUnavailable();
        }
    }, [ status.error, onUnavailable ]);

    const rootStyle = useMemo(
        () => ({ backgroundColor: theme.surface, padding: theme.spacing }),
        [ theme.spacing, theme.surface ]
    );
    const textStyle = useMemo(() => ({
        color: theme.foreground,
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize
    }), [ theme.fontFamily, theme.fontSize, theme.foreground ]);

    if (status.error)
    {
        return (
            <Message
                text={ t("renderer.audioUnavailable") }
                theme={ theme }
            />
        );
    }
    return (
        <Pressable
            accessibilityLabel={ t(status.playing ? "renderer.pauseAudio" : "renderer.playAudio") }
            accessibilityRole="button"
            onPress={ () => status.playing ? player.pause() : player.play() }
            style={ rootStyle }>
            <Text style={ textStyle }>
                {
                    t(status.playing ? "renderer.audioStatusPlaying" : "renderer.audioStatusPaused", {
                        current: Math.floor(status.currentTime),
                        duration: Math.floor(status.duration)
                    })
                }
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
    const videoStyle = useMemo(() => ({ height: 230, width: "100%" as const }), [ ]);

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
            style={ videoStyle }
        />
    );
}

/** On-demand native media adapter. Unmounting the child releases its playback/PDF resources. */
export function MarkdownMediaView({
    block,
    kind,
    theme: suppliedTheme,
    onOpenUrl: suppliedOnOpenUrl,
    resolveMediaUrl: suppliedResolveMediaUrl
}: MarkdownMediaViewProps)
{
    const resolved = useResolvedRendererConfig();
    const { t } = resolved;
    const fullTheme = suppliedTheme ?? resolved.theme;
    const theme = fullTheme.document;
    const onOpenUrl = suppliedOnOpenUrl ?? resolved.onOpenUrl;
    const resolveMediaUrl = suppliedResolveMediaUrl ?? resolved.config.resolveMediaUrl;
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
                        error: t("renderer.resourceUnavailableOrInvalid"),
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
                        error: t("renderer.resourceUnavailable"),
                        key: requestKey
                    });
                }
            });

        return () =>
        {
            live = false;
        };
    }, [ active, block, kind, resolveMediaUrl, retry, source.url, requestKey, t ]);

    const restart = useCallback(() => setRetry((value: number) => value + 1), [ ]);
    const failed = (message: string) => { setResult({ error: message, key: requestKey }); };
    const heading = t(mediaKindMessageIds[ kind ]);
    const rootStyle = useMemo(() => ({ marginVertical: 6 }), [ ]);
    const loadStyle = useMemo(
        () => ({ backgroundColor: theme.surface, borderRadius: 6, padding: theme.spacing }),
        [ theme.spacing, theme.surface ]
    );
    const loadTextStyle = useMemo(() => ({
        color: theme.accent,
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize
    }), [ theme.accent, theme.fontFamily, theme.fontSize ]);
    const imageStyle = useMemo(
        () => ({ backgroundColor: theme.surface, height: 240, width: "100%" as const }),
        [ theme.surface ]
    );
    const pdfStyle = useMemo(
        () => ({ backgroundColor: theme.surface, height: 360, width: "100%" as const }),
        [ theme.surface ]
    );
    const fileStyle = useMemo(
        () => ({ backgroundColor: theme.surface, borderRadius: 6, padding: theme.spacing }),
        [ theme.spacing, theme.surface ]
    );
    const fileTextStyle = useMemo(() => ({
        color: theme.accent,
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize
    }), [ theme.accent, theme.fontFamily, theme.fontSize ]);
    const closeStyle = useMemo(() => ({ paddingVertical: 8 }), [ ]);
    const closeTextStyle = useMemo(
        () => ({ color: theme.muted, fontFamily: theme.fontFamily }),
        [ theme.fontFamily, theme.muted ]
    );
    const loadingTextStyle = closeTextStyle;
    const captionTextStyle = useMemo(
        () => ({ color: theme.muted, fontSize: theme.fontSize * 0.88 }),
        [ theme.fontSize, theme.muted ]
    );

    return (
        <View
            style={ rootStyle }
            testID={ `media-${block.id}` }>
            {!active && (
                <Pressable accessibilityLabel={ t("renderer.loadMediaPreview", { kind: heading }) }
                    accessibilityRole="button"
                    onPress={ () => setOpenedKey(activeKey) }
                    style={ loadStyle }>
                    <Text style={ loadTextStyle }>
                        { t("renderer.loadMediaPreview", { kind: heading }) }
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
                        text={ t("renderer.loadingMedia", { kind: heading }) }
                        theme={ theme }
                    />
                )
            }
            {
                active && !error && url && kind === "image" && (
                    <Image
                        accessibilityLabel={ t(source.caption?.length ? "renderer.imageWithCaption" : "renderer.image") }
                        onError={ () => failed(t("renderer.imageUnavailable")) }
                        onLoad={ () => setResult({ key: requestKey, loaded: true, url }) }
                        resizeMode="contain"
                        source={ { uri: url } }
                        style={ imageStyle }
                    />
                )
            }
            {
                active && !error && url && kind === "pdf" && (
                    <Pdf
                        onError={ () => failed(t("renderer.pdfUnavailable")) }
                        onLoadComplete={ () => setResult({ key: requestKey, url, loaded: true }) }
                        source={ { cache: true, uri: url } }
                        style={ pdfStyle }
                    />
                )
            }
            {
                active && !error && url && kind === "audio" && (
                    <AudioPreview
                        onUnavailable={ () => failed(t("renderer.audioUnavailable")) }
                        theme={ theme }
                        url={ url }
                    />
                )
            }
            {
                active && !error && url && kind === "video" && (
                    <VideoPreview
                        onUnavailable={ () => failed(t("renderer.videoUnavailable")) }
                        url={ url }
                    />
                )
            }
            {
                active && !error && url && kind === "file" && (
                    <Pressable
                        accessibilityLabel={ t("renderer.openFile") }
                        accessibilityRole="link"
                        onPress={ () => void onOpenUrl?.(url) }
                        style={ fileStyle }>
                        <Text style={ fileTextStyle }>
                            { t("renderer.openFile") }
                        </Text>
                    </Pressable>
                )
            }
            {
                active && url && !error && (kind === "pdf" || kind === "audio" || kind === "video") && (
                    <Pressable
                        accessibilityLabel={ t("renderer.closeMediaPreview", { kind: heading }) }
                        accessibilityRole="button"
                        onPress={ () => setOpenedKey(undefined) }
                        style={ closeStyle }>
                        <Text style={ closeTextStyle }>
                            { t("renderer.closePreview") }
                        </Text>
                    </Pressable>
                )
            }
            {
                active && url && !loaded && !error && (kind === "image" || kind === "pdf") && (
                    <Text style={ loadingTextStyle }>
                        { t("renderer.loading") }
                    </Text>
                )
            }
            {
                source.caption && (
                    <MarkdownRichTextView
                        items={ source.caption }
                        onOpenUrl={ onOpenUrl }
                        textStyle={ captionTextStyle }
                        theme={ fullTheme }
                    />
                )
            }
        </View>
    );
}
