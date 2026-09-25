/**
 * Read-only rich-text presentation shared by the renderer's block views.
 *
 * @module react-native-notion-markdown/renderer/ui/RichText
 *
 * @file      RichText.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { MarkdownMetadata, MarkdownRichText, MarkdownRichTextItem } from "../../document/types.ts";
import type {
    MarkdownReferenceDisplay,
    MarkdownReferenceIconComponent,
    MarkdownReferenceRequest
} from "./types.ts";
import type { MarkdownOpenUrl, MarkdownTranslateById } from "../../provider/MarkdownProvider.tsx";
import { type MarkdownTheme, markdownColor } from "../../provider/theme.ts";
import { Text, View, type ViewStyle } from "react-native";
import { asRecord, getMarkdownMetadata } from "../../internal.ts";
import { useEffect, useMemo, useState } from "react";
import { MarkdownMathView } from "./MathView.tsx";
import { useResolvedRendererConfig } from "../../provider/MarkdownProvider.tsx";
import { FaviconIcon } from "./FaviconIcon.tsx";

/**
 * Props for rendering a given rich-text collection. The theme, link icon, link opening, and
 * reference resolution default to the nearest `MarkdownProvider`'s; pass them to override.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownRichTextViewProps
{
    readonly items?: ReadonlyArray<MarkdownRichText[number]>;
    readonly linkFallbackIcon?: MarkdownReferenceIconComponent;
    readonly theme?: MarkdownTheme;
    readonly onOpenUrl?: MarkdownOpenUrl;
    readonly resolveReference?: (request: MarkdownReferenceRequest) => Promise<MarkdownReferenceDisplay | null>;
    readonly textStyle?:
    {
        readonly fontFamily?: string;
        readonly fontSize?: number;
        readonly fontWeight?: "normal" | "bold" | "600" | "700";
        readonly lineHeight?: number;
        readonly color?: string;

        /**
         * Forces a strikethrough decoration regardless of the item's own mark -- used for
         * checked to-do text.
         */
        readonly strikethrough?: boolean
    };
    readonly testID?: string;
}

/**
 * Return display content for the given rich-text item.
 *
 * @category Functions
 * @since 1.0.0
 */
function contentOf(item: MarkdownRichText[number], metadata: MarkdownMetadata): string
{
    const value = asRecord(item);
    const kind = String(value.type ?? "text");

    if (kind === "text")
    {
        return String(asRecord(value.text).content ?? value.plain_text ?? metadata.mention?.label ?? "");
    }

    if (kind === "mention")
    {
        const mention = asRecord(value.mention);
        if (mention.type === "date")
        {
            const date = asRecord(mention.date);
            return String(date.start ?? "Date");
        }

        return metadata.mention?.label ?? String(value.plain_text ?? mention.type ?? "Mention");
    }

    return String(value.plain_text ?? "");
}

/**
 * Render a given rich-text item with its corresponding marks and theme.
 *
 * @category Functions
 * @since 1.0.0
 */
function RichItem({
    item,
    theme,
    t,
    onOpenUrl,
    resolveReference,
    linkFallbackIcon,
    textStyle
}: MarkdownRichTextViewProps & {
    readonly item: MarkdownRichText[number];
    readonly t: MarkdownTranslateById;
    readonly theme: MarkdownTheme;
})
{
    const { document: documentTheme, palette } = theme;
    const value = asRecord(item);
    const metadata = getMarkdownMetadata(value);
    const annotation = asRecord(value.annotations);
    const text = contentOf(item, metadata);
    const rawUrl = asRecord(asRecord(value.text).link).url;
    const linkUrl = typeof rawUrl === "string" ? rawUrl : undefined;
    const url = linkUrl ?? metadata.citationUrl ?? metadata.mention?.url;
    const request = metadata.mention;
    const kind = request?.kind;
    const referenceUrl = request?.url;
    const label = request?.label;
    const requestKey = `${kind ?? ""}:${referenceUrl ?? ""}:${label ?? ""}`;
    const [ state, setState ] = useState<{ key: string; value: MarkdownReferenceDisplay | null }>();

    useEffect(() =>
    {
        if (!kind || !resolveReference)
        {
            return;
        }

        let live = true;
        void resolveReference({ kind, label, url: referenceUrl })
            .then((result: MarkdownReferenceDisplay | null) =>
            {
                if (live) {setState({ key: requestKey, value: result });}
            })
            .catch(() =>
            {
                if (live)
                {
                    setState({ key: requestKey, value: null });
                }
            });

        return () =>
        {
            live = false;
        };
    }, [ kind, referenceUrl, label, requestKey, resolveReference ]);

    const resolved = state?.key === requestKey ? state.value : undefined;

    const lineBreakStyle = useMemo(() => ({ height: 1, width: "100%" as const }), [ ]);
    const containerStyle = useMemo(
        () => ({ alignItems: "center" as const, flexDirection: "row" as const, flexShrink: 1 }),
        [ ]
    );

    const annotationColor = typeof annotation.color === "string" ? annotation.color : undefined;
    const annotationCode = annotation.code === true;
    const annotationItalic = annotation.italic === true;
    const annotationBold = annotation.bold === true;
    const annotationUnderline = annotation.underline === true;
    const annotationStrikethrough = annotation.strikethrough === true;
    const destination = resolved?.url ?? url;
    const baseFontSize = textStyle?.fontSize ?? documentTheme.fontSize;

    const display = metadata.citationUrl
        ? `↗ ${ text || metadata.citationUrl }`
        : metadata.emojiName
            ? (text || `:${ metadata.emojiName }:`)
            : (resolved?.label ?? text);

    // The renderer metadata is a mutable record by design; memoize against its scalar snapshots.
    /* eslint-disable react-hooks/preserve-manual-memoization */
    const richTextStyle = useMemo(() =>
    {
        const styleBackgroundColor = (
            annotationColor !== undefined &&
            (annotationColor.endsWith("_bg") || annotationColor.endsWith("_background"))
        )
            ? markdownColor(annotationColor, palette)
            : undefined;
        const styleForeground = annotationColor !== undefined && styleBackgroundColor === undefined
            ? markdownColor(annotationColor, palette)
            : undefined;
        const styleDestination = resolved?.url ?? url;
        const styleBaseFontSize = textStyle?.fontSize ?? documentTheme.fontSize;

        return {
            backgroundColor: annotationCode ? documentTheme.inlineCodeBackground : styleBackgroundColor,
            borderRadius: annotationCode ? 4 : 0,
            color: styleDestination
                ? documentTheme.accent
                : annotationCode
                    ? documentTheme.inlineCodeForeground
                    : (styleForeground ?? textStyle?.color ?? documentTheme.foreground),
            fontFamily: annotationCode
                ? documentTheme.monospaceFontFamily
                : textStyle?.fontFamily ?? documentTheme.fontFamily,
            fontSize: annotationCode ? styleBaseFontSize - 2 : styleBaseFontSize,
            fontStyle: annotationItalic ? "italic" as const : "normal" as const,
            fontWeight: annotationBold ? "bold" as const : textStyle?.fontWeight ?? "normal" as const,
            lineHeight: textStyle?.lineHeight,
            padding: annotationCode ? 4 : 0,
            textDecorationLine: [
                annotationUnderline || styleDestination ? "underline" : "",
                annotationStrikethrough || textStyle?.strikethrough ? "line-through" : ""
            ].filter(Boolean)
                .join(" ") as "none" | "underline" | "line-through" | "underline line-through"
        };
    }, [
        annotationBold,
        annotationCode,
        annotationColor,
        annotationItalic,
        annotationStrikethrough,
        annotationUnderline,
        documentTheme.accent,
        documentTheme.fontFamily,
        documentTheme.fontSize,
        documentTheme.foreground,
        documentTheme.inlineCodeBackground,
        documentTheme.inlineCodeForeground,
        documentTheme.monospaceFontFamily,
        palette,
        resolved?.url,
        textStyle?.color,
        textStyle?.fontFamily,
        textStyle?.fontSize,
        textStyle?.fontWeight,
        textStyle?.lineHeight,
        textStyle?.strikethrough,
        url
    ]);
    const handlePress = useMemo(
        () => destination && onOpenUrl ? () => void onOpenUrl(destination) : undefined,
        [ destination, onOpenUrl ]
    );
    /* eslint-enable react-hooks/preserve-manual-memoization */

    if (text === "\n")
    {
        return (
            <View
                accessibilityLabel={ t("renderer.lineBreak") }
                style={ lineBreakStyle }
            />
        );
    }

    if (value.type === "equation")
    {
        return (
            <MarkdownMathView
                expression={ String(asRecord(value.equation).expression ?? "") }
                theme={ theme }
            />
        );
    }
    return (
        <View style={ containerStyle }>
            {
                linkUrl !== undefined && <FaviconIcon
                    color={ documentTheme.accent }
                    fallbackIcon={ linkFallbackIcon }
                    size={ baseFontSize }
                    textFallback="↗"
                    url={ linkUrl }
                />
            }
            <Text
                accessibilityRole={ destination && onOpenUrl ? "link" : undefined }
                onPress={ handlePress }
                style={ richTextStyle }>
                { display }
            </Text>
        </View>
    );
}

/** Shared read-only rich-text presentation used by block views and future editor surfaces. */
export function MarkdownRichTextView({
    items,
    linkFallbackIcon,
    theme: suppliedTheme,
    onOpenUrl: suppliedOnOpenUrl,
    resolveReference: suppliedResolveReference,
    textStyle,
    testID
}: MarkdownRichTextViewProps)
{
    const resolved = useResolvedRendererConfig();
    const theme = suppliedTheme ?? resolved.theme;
    const fallbackIcon = linkFallbackIcon ?? resolved.config.icons?.link;
    const onOpenUrl = suppliedOnOpenUrl ?? resolved.onOpenUrl;
    const resolveReference = suppliedResolveReference ?? resolved.config.resolveReference;
    const RootStyle = useMemo((): ViewStyle => ({
        alignItems: "flex-start",
        flexDirection: "row",
        flexWrap: "wrap",
        minHeight: (textStyle?.lineHeight ?? (textStyle?.fontSize ?? theme.document.fontSize) * 1.5) + 4
    }), [ textStyle?.fontSize, textStyle?.lineHeight, theme.document.fontSize ]);

    return (
        <View
            style={ RootStyle }
            testID={ testID }>
            {
                (items ?? [ ]).map((item: MarkdownRichTextItem, index: number) => (
                    <RichItem item={ item }
                        key={ index }
                        linkFallbackIcon={ fallbackIcon }
                        onOpenUrl={ onOpenUrl }
                        resolveReference={ resolveReference }
                        t={ resolved.t }
                        textStyle={ textStyle }
                        theme={ theme }
                    />
                ))
            }
        </View>
    );
}
