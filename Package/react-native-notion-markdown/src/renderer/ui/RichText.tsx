/**
 *
 *
 * @module react-native-notion-markdown/renderer/ui/RichText
 *
 * @file      RichText.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { NotionMarkdownMetadata, NotionRichText, NotionRichTextItem } from "../../document/types.ts";
import type { NotionReferenceDisplay, NotionReferenceRequest, NotionRendererTheme } from "./types.ts";
import { Text, View, type ViewStyle } from "react-native";
import { asRecord, getNotionMarkdownMetadata } from "../../internal.ts";
import { useEffect, useMemo, useState } from "react";
import { NotionMathView } from "./MathView.tsx";
import { notionColor } from "./theme.ts";

export interface NotionRichTextViewProps
{
    readonly items?: ReadonlyArray<NotionRichText[number]>;
    readonly theme: NotionRendererTheme;
    readonly dark: boolean;
    readonly onOpenUrl?: (url: string) => void;
    readonly resolveReference?: (request: NotionReferenceRequest) => Promise<NotionReferenceDisplay | null>;
    readonly textStyle?:
    {
        readonly fontSize?: number;
        readonly fontWeight?: "normal" | "bold" | "600" | "700";
        readonly color?: string
    };
    readonly testID?: string;
}

function contentOf(item: NotionRichText[number], metadata: NotionMarkdownMetadata): string
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

function RichItem({
    item,
    theme,
    dark,
    onOpenUrl,
    resolveReference,
    textStyle
}: NotionRichTextViewProps & { readonly item: NotionRichText[number]; })
{
    const value = asRecord(item);
    const metadata = getNotionMarkdownMetadata(value);
    const annotation = asRecord(value.annotations);
    const text = contentOf(item, metadata);
    const rawUrl = asRecord(asRecord(value.text).link).url;
    const url = typeof rawUrl === "string" ? rawUrl : metadata.citationUrl ?? metadata.mention?.url;
    const request = metadata.mention;
    const kind = request?.kind;
    const referenceUrl = request?.url;
    const label = request?.label;
    const requestKey = `${kind ?? ""}:${referenceUrl ?? ""}:${label ?? ""}`;
    const [ state, setState ] = useState<{ key: string; value: NotionReferenceDisplay | null }>();

    useEffect(() =>
    {
        if (!kind || !resolveReference)
        {
            return;
        }

        let live = true;
        void resolveReference({ kind, label, url: referenceUrl })
            .then((result: NotionReferenceDisplay | null) =>
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

    if (text === "\n")
    {
        return (
            <View
                accessibilityLabel="Line break"
                style={ { height: 1, width: "100%" } }
            />
        );
    }

    if (value.type === "equation")
    {
        return (
            <NotionMathView
                expression={ String(asRecord(value.equation).expression ?? "") }
                theme={ theme }
            />
        );
    }
    const backgroundColor = (
        typeof annotation.color === "string" &&
        (annotation.color.endsWith("_bg") || annotation.color.endsWith("_background"))
    )
        ? notionColor(annotation.color, dark)
        : undefined;

    const foreground = typeof annotation.color === "string" && backgroundColor === undefined
        ? notionColor(annotation.color, dark)
        : undefined;

    const destination = resolved?.url ?? url;

    const display = metadata.citationUrl
        ? `↗ ${ text || metadata.citationUrl }`
        : metadata.emojiName
            ? (text || `:${ metadata.emojiName }:`)
            : (resolved?.label ?? text);

    return (
        <Text
            accessibilityRole={ destination && onOpenUrl ? "link" : undefined }
            onPress={ destination && onOpenUrl ? () => onOpenUrl(destination) : undefined }
            style={ {
                backgroundColor,
                color: destination ? theme.accent : (foreground ?? textStyle?.color ?? theme.foreground),
                fontFamily: annotation.code ? "monospace" : undefined,
                fontSize: textStyle?.fontSize ?? theme.fontSize,
                fontStyle: annotation.italic ? "italic" : "normal",
                fontWeight: annotation.bold ? "bold" : textStyle?.fontWeight ?? "normal",
                paddingHorizontal: annotation.code ? 2 : 0,
                textDecorationLine: [
                    annotation.underline || destination ? "underline" : "",
                    annotation.strikethrough ? "line-through" : ""
                ].filter(Boolean)
                    .join(" ") as "none" | "underline" | "line-through" | "underline line-through"
            } }>
            { display }
        </Text>
    );
}

/** Shared read-only rich-text presentation used by block views and future editor surfaces. */
export function NotionRichTextView({
    items,
    theme,
    dark,
    onOpenUrl,
    resolveReference,
    textStyle,
    testID
}: NotionRichTextViewProps)
{
    const RootStyle = useMemo((): ViewStyle => ({
        alignItems: "center",
        flexDirection: "row",
        flexWrap: "wrap",
        minHeight: (textStyle?.fontSize ?? theme.fontSize) * 1.4
    }), [ textStyle?.fontSize, theme.fontSize ]);

    return (
        <View
            style={ RootStyle }
            testID={ testID }>
            {
                (items ?? [ ]).map((item: NotionRichTextItem, index: number) => (
                    <RichItem dark={ dark }
                        item={ item }
                        key={ index }
                        onOpenUrl={ onOpenUrl }
                        resolveReference={ resolveReference }
                        textStyle={ textStyle }
                        theme={ theme }
                    />
                ))
            }
        </View>
    );
}
