/**
 * @module react-native-notion-markdown/renderer/ui/NotionMarkdownRenderer
 *
 * @file      NotionMarkdownRenderer.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type {
    NotionBlock,
    NotionDocument,
    NotionRichText,
    NotionRichTextItem
} from "../../document/types.ts";
import type {
    NotionMarkdownRendererProps,
    NotionReferenceDisplay,
    NotionRendererTheme
} from "./types.ts";
import { defaultEmptyTogglePlaceholder } from "./types.ts";
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from "react-native";
import { asRecord, getNotionBlockPayload, getNotionMarkdownMetadata } from "../../internal.ts";
import { darkRendererTheme, lightRendererTheme, notionColor } from "./theme.ts";
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NotionMathView } from "./MathView.tsx";
import { NotionMediaView } from "./Previews.tsx";
import { NotionMermaidView } from "./MermaidView.tsx";
import { NotionRichTextView } from "./RichText.tsx";
import { FaviconIcon } from "./FaviconIcon.tsx";
import type { ReactNode } from "react";
import { parseNotionMarkdown } from "../../document/parser.ts";
import { openPageReferenceUrl } from "../../openPageReference.ts";

/**
 * Read rich text from the given unknown block payload.
 *
 * @category Functions
 * @since 1.0.0
 */
function rich(value: unknown): NotionRichText
{
    return Array.isArray(value) ? value as NotionRichText : [ ];
}

const emptyDocument: NotionDocument =
    {
        blocks: [ ],
        version: 1
    } as const;

/**
 * Convert the given rich-text payload to plain display text.
 *
 * @category Functions
 * @since 1.0.0
 */
function plain(value: unknown): string
{
    return rich(value).map((item: NotionRichTextItem) =>
    {
        const itemValue = asRecord(item);
        return String(asRecord(itemValue.text).content ?? itemValue.plain_text ?? "");
    }).join("");
}

/**
 * Resolve the corresponding renderer color for a given block.
 *
 * @category Functions
 * @since 1.0.0
 */
function blockColor(block: NotionBlock): string | undefined
{
    const payloadColor = getNotionBlockPayload(block).color;
    return getNotionMarkdownMetadata(block).color ??
        (typeof payloadColor === "string" ? payloadColor : undefined);
}

interface HeadingEntry
{
    readonly block: NotionBlock;
    readonly depth: number;
    readonly text: string;
}

/**
 * Collect heading entries from the given block tree.
 *
 * @category Functions
 * @since 1.0.0
 */
function collectHeadings(blocks: ReadonlyArray<NotionBlock>, depth = 0): Array<HeadingEntry>
{
    return blocks.flatMap((block: NotionBlock) => [
        ...(block.type.startsWith("heading_")
            ? [ { block, depth, text: plain(getNotionBlockPayload(block).rich_text) } ]
            : [ ]),
        ...collectHeadings(block.children ?? [ ], depth + 1)
    ]);
}

/**
 * Collect synced-block definitions from the given block tree.
 *
 * @category Functions
 * @since 1.0.0
 */
function collectSynced(
    blocks: ReadonlyArray<NotionBlock>,
    found = new Map<string, ReadonlyArray<NotionBlock>>()
): Map<string, ReadonlyArray<NotionBlock>>
{
    for (const block of blocks)
    {
        const url = getNotionMarkdownMetadata(block).referenceUrl;
        if (block.type === "synced_block" && url && block.children) {found.set(url, block.children);}
        collectSynced(block.children ?? [ ], found);
    }

    return found;
}

interface RenderContext
{
    readonly document: NotionDocument;
    readonly props: NotionMarkdownRendererProps;
    readonly theme: NotionRendererTheme;
    readonly dark: boolean;
    readonly narrow: boolean;
    readonly availableWidth: number;
    readonly headings: ReadonlyArray<HeadingEntry>;
    readonly synced: ReadonlyMap<string, ReadonlyArray<NotionBlock>>;
    readonly registerHeading: (id: string, view: View | null) => void;
    readonly goToHeading: (id: string) => void;
    readonly targetHeading?: string;
}

/** Count consecutive numbered siblings ending at this index. */
function numberedOrdinal(blocks: ReadonlyArray<NotionBlock>, index: number): number
{
    if (blocks[index]?.type !== "numbered_list_item") {return 0;}
    let start = index;
    while (start > 0 && blocks[start - 1]?.type === "numbered_list_item") {start -= 1;}
    return index - start + 1;
}

/**
 * Check whether the given block tree contains a heading with the given identifier.
 *
 * @category Functions
 * @since 1.0.0
 */
function containsHeading(blocks: ReadonlyArray<NotionBlock>, id: string): boolean
{
    return blocks.some((block: NotionBlock) => block.id === id || containsHeading(block.children ?? [ ], id));
}

/**
 * Render rich text with the corresponding context, size, color, and weight.
 *
 * @category Functions
 * @since 1.0.0
 */
function Rich({ value, context, size, color, weight, family, lineHeight, strikethrough }: {
    readonly value: unknown;
    readonly context: RenderContext;
    readonly size?: number;
    readonly color?: string;
    readonly weight?: "normal" | "bold" | "600" | "700";
    readonly family?: string;
    readonly lineHeight?: number;
    readonly strikethrough?: boolean;
})
{
    return (
        <NotionRichTextView
            dark={ context.dark }
            items={ rich(value) }
            linkFallbackIcon={ context.props.linkFallbackIcon }
            onOpenUrl={ context.props.onOpenUrl }
            resolveReference={ context.props.resolveReference }
            textStyle={ { color, fontFamily: family, fontSize: size, fontWeight: weight, lineHeight, strikethrough } }
            theme={ context.theme }
        />
    );
}

/**
 * Render the given block list at the corresponding nesting depth.
 *
 * @category Functions
 * @since 1.0.0
 */
function BlockList({ blocks, context, depth = 0, seen = new Set<string>() }: {
    readonly blocks: ReadonlyArray<NotionBlock>;
    readonly context: RenderContext;
    readonly depth?: number;
    readonly seen?: ReadonlySet<string>;
})
{
    return (
        <View>
            {
                blocks.map((block: NotionBlock, index: number) =>
                {
                    const ordinal = numberedOrdinal(blocks, index);
                    return (
                        <NotionBlockView block={ block }
                            context={ context }
                            depth={ depth }
                            key={ getNotionMarkdownMetadata(block).editorId ?? block.id }
                            ordinal={ ordinal }
                            seen={ seen }
                        />
                    );
                })
            }
        </View>
    );
}

/**
 * Render the children of a given block.
 *
 * @category Functions
 * @since 1.0.0
 */
function Children({ block, context, depth, seen }: {
    readonly block: NotionBlock;
    readonly context: RenderContext;
    readonly depth: number;
    readonly seen: ReadonlySet<string>;
})
{
    return block.children?.length
        ? (
            <BlockList blocks={ block.children }
                context={ context }
                depth={ depth + 1 }
                seen={ seen }
            />
        )
        : null;
}

/**
 * Return whether the given block is the empty child of a toggle.
 */
function isEmptyToggleChild(block: NotionBlock): boolean
{
    return block.type === "paragraph" &&
        !block.children?.length &&
        plain(getNotionBlockPayload(block).rich_text).length === 0;
}

/**
 * Render the collapsible content for a given toggle block.
 *
 * @category Functions
 * @since 1.0.0
 */
function ToggleContent({ block, context, depth, seen, title }: {
    readonly block: NotionBlock;
    readonly context: RenderContext;
    readonly depth: number;
    readonly seen: ReadonlySet<string>;
    readonly title: ReactNode;
})
{
    const [ localExpansion, setLocalExpansion ] = useState<{ block: NotionBlock; value: boolean }>();

    const revealed = context.targetHeading
        ? containsHeading(block.children ?? [ ], context.targetHeading)
        : false;

    const expanded = revealed || (localExpansion?.block === block && localExpansion.value === true);
    const children = block.children ?? [ ];
    const empty = children.length === 0 ||
        (children.length === 1 && children[0] !== undefined && isEmptyToggleChild(children[0]));
    return <View>
        <Pressable
            accessibilityLabel={ expanded ? "Collapse toggle" : "Expand toggle" }
            accessibilityRole="button"
            accessibilityState={ { expanded } }
            onPress={ () => setLocalExpansion({ block, value: !expanded }) }
            style={ { alignItems: "flex-start", flexDirection: "row", minHeight: 35 } }>
            <Text style={ {
                color: context.theme.muted,
                fontFamily: context.theme.fontFamily,
                fontSize: context.theme.fontSize * 1.25,
                opacity: 0.65,
                width: 24
            } }>
                { expanded ? "▼" : "▶" }
            </Text>
            <View style={ { flex: 1 } }>
                { title }
            </View>
        </Pressable>
        {
            expanded && (
                <View style={ { paddingLeft: 32 } }>
                    {
                        empty
                            ? <Text style={ {
                                color: context.theme.muted,
                                fontFamily: context.theme.fontFamily,
                                fontSize: context.theme.fontSize,
                                opacity: 0.6,
                                paddingVertical: 4
                            } }>
                                { context.props.emptyTogglePlaceholder ?? defaultEmptyTogglePlaceholder }
                            </Text>
                            : <Children block={ block }
                                context={ context }
                                depth={ depth }
                                seen={ seen }
                            />
                    }
                </View>
            )
        }
    </View>;
}

/**
 * Render a reference card for the given block.
 *
 * @category Functions
 * @since 1.0.0
 */
function ReferenceCard({ block, context }: {
    readonly block: NotionBlock;
    readonly context: RenderContext
})
{
    const metadata = getNotionMarkdownMetadata(block);
    const payload = getNotionBlockPayload(block);
    const kind = metadata.mention?.kind ?? (payload.database_id ? "database" : block.type);
    const rawUrl = metadata.referenceUrl ?? payload.url ?? payload.page_id ?? payload.database_id;
    const url = typeof rawUrl === "string" ? rawUrl : undefined;
    const label = metadata.mention?.label ?? String(payload.title ?? kind);
    const resolver = context.props.resolveReference;
    const requestKey = `${kind}:${url ?? ""}:${label}`;
    const [ resolved, setResolved ] = useState<{ key: string; value: NotionReferenceDisplay | null }>();
    useEffect(() =>
    {
        if (!resolver) {return;}
        let live = true;
        void resolver({ kind, label, url })
            .then((value: NotionReferenceDisplay | null) =>
            {
                if (live)
                {
                    setResolved({ key: requestKey, value });
                }
            })
            .catch(() =>
            {
                if (live)
                {
                    setResolved({ key: requestKey, value: null });
                }
            });
        return () => { live = false; };
    }, [ resolver, requestKey, kind, url, label ]);

    const result = resolved?.key === requestKey ? resolved.value : undefined;
    const destination = result?.url ?? url;
    const isPageReference = block.type === "link_to_page";
    const pageIcon = result?.icon
        ?? metadata.icon
        ?? (typeof payload.icon === "string" ? payload.icon : undefined);
    const FallbackIcon = context.props.pageReferenceFallbackIcon;

    const HandlePress = destination
        ? () => context.props.onOpenUrl !== undefined
            ? context.props.onOpenUrl(destination)
            : void openPageReferenceUrl(destination)
        : undefined;

    const RootStyle = useMemo(() => isPageReference
        ? {
            alignItems: "center" as const,
            flexDirection: "row" as const,
            marginVertical: 4,
            minHeight: context.theme.fontSize * 1.6,
            paddingVertical: 2
        }
        : {
            backgroundColor: context.theme.surface,
            borderRadius: 6,
            marginVertical: 4,
            padding: context.theme.spacing
        }, [ context.theme.fontSize, context.theme.spacing, context.theme.surface, isPageReference ]);

    const BodyStyle = useMemo(() => ({
        color: isPageReference ? context.theme.accent : context.theme.foreground,
        fontFamily: context.theme.fontFamily,
        fontSize: context.theme.fontSize
    }), [
        context.theme.accent,
        context.theme.fontFamily,
        context.theme.fontSize,
        context.theme.foreground,
        isPageReference
    ]);

    const MutedStyle = useMemo(
        () => ({ color: context.theme.muted, fontFamily: context.theme.fontFamily }),
        [ context.theme.fontFamily, context.theme.muted ]
    );

    return (
        <Pressable accessibilityLabel={ `${kind}: ${result?.label ?? label}` }
            accessibilityRole={ destination ? "link" : undefined }
            onPress={ HandlePress }
            style={ RootStyle }>
            {
                isPageReference && pageIcon !== undefined
                    ? <Text style={ [ BodyStyle, { marginRight: context.theme.spacing / 2 } ] }>
                        { pageIcon }
                    </Text>
                    : isPageReference && FallbackIcon !== undefined
                        ? createElement(FallbackIcon, {
                            color: context.theme.accent,
                            size: context.theme.fontSize,
                            strokeWidth: 2
                        })
                        : !isPageReference && destination !== undefined && <FaviconIcon
                            color={ context.theme.foreground }
                            fallbackIcon={ context.props.linkFallbackIcon }
                            size={ context.theme.fontSize }
                            textFallback={ result?.icon ?? "↗" }
                            url={ destination }
                        />
            }
            <Text style={ isPageReference
                ? [ BodyStyle, { textDecorationLine: "underline" as const } ]
                : BodyStyle }>
                { result?.label ?? label }
            </Text>
            {
                !destination && (
                    <Text style={ MutedStyle }>
                        Reference unavailable
                    </Text>
                )
            }
        </Pressable>
    );
}

/**
 * Render the corresponding content for a synced block.
 *
 * @category Functions
 * @since 1.0.0
 */
function SyncedContent({ block, context, depth, seen }: {
    readonly block: NotionBlock;
    readonly context: RenderContext;
    readonly depth: number;
    readonly seen: ReadonlySet<string>;
})
{
    const url = getNotionMarkdownMetadata(block).referenceUrl;
    const local = url ? context.synced.get(url) : undefined;
    const own = block.children?.length ? block.children : undefined;
    const [ resolved, setResolved ] = useState<{ key: string; value: NotionDocument | null }>();
    const [ retry, setRetry ] = useState(0);
    const cycle = url ? seen.has(url) : false;
    const resolver = context.props.resolveSyncedBlock;
    const requestKey = `${url ?? ""}:${retry}`;
    useEffect(() =>
    {
        if (own || local || !url || !resolver || cycle)
        {
            return;
        }
        let live = true;
        void resolver(url).then((value: NotionDocument | null) =>
        {
            if (live)
            {
                setResolved({ key: requestKey, value });
            }
        })
            .catch(() =>
            {
                if (live)
                {
                    setResolved({ key: requestKey, value: null });
                }
            });
        return () => { live = false; };
    }, [ own, local, url, resolver, cycle, requestKey ]);

    const RootStyle = useMemo(() => ({
        borderLeftColor: context.theme.border,
        borderLeftWidth: 2,
        paddingLeft: context.theme.spacing
    }), [ context.theme.border, context.theme.spacing ]);

    const remote = resolved?.key === requestKey ? resolved.value : undefined;

    const ErrorStyle = useMemo(
        () => ({ color: context.theme.error, fontFamily: context.theme.fontFamily }),
        [ context.theme.error, context.theme.fontFamily ]
    );
    const MutedStyle = useMemo(
        () => ({ color: context.theme.muted, fontFamily: context.theme.fontFamily }),
        [ context.theme.fontFamily, context.theme.muted ]
    );
    const AccentStyle = useMemo(
        () => ({ color: context.theme.accent, fontFamily: context.theme.fontFamily }),
        [ context.theme.accent, context.theme.fontFamily ]
    );

    const SyncedUnavailableRootStyle = useMemo(() => ({
        backgroundColor: context.theme.surface,
        padding: context.theme.spacing
    }), [ context.theme.spacing, context.theme.surface ]);

    const HandleRetry = useCallback(() => setRetry((value: number) => value + 1), [ setRetry ]);

    if (cycle)
    {
        return (
            <Text style={ ErrorStyle }>
                Circular synced reference
            </Text>
        );
    }

    const blocks = own ?? local ?? remote?.blocks;

    if (!blocks)
    {
        return (
            <View style={ SyncedUnavailableRootStyle }>
                <Text style={ MutedStyle }>
                    {
                        !url || !context.props.resolveSyncedBlock
                            ? "Synced content unavailable"
                            : remote === null
                                ? "Synced content unavailable"
                                : "Loading synced content…"
                    }
                </Text>
                {
                    remote === null && (
                        <Pressable accessibilityLabel="Retry synced content"
                            accessibilityRole="button"
                            onPress={ HandleRetry }>
                            <Text style={ AccentStyle }>
                                Retry
                            </Text>
                        </Pressable>
                    )
                }
            </View>
        );
    }

    const next = new Set(seen);

    if (url)
    {
        next.add(url);
    }

    return (
        <View style={ RootStyle }>
            <BlockList blocks={ blocks }
                context={ context }
                depth={ depth + 1 }
                seen={ next }
            />
        </View>
    );
}

/**
 * Render the table represented by the given block.
 *
 * @category Functions
 * @since 1.0.0
 */
function TableView({ block, context }: { readonly block: NotionBlock; readonly context: RenderContext })
{
    const table = getNotionMarkdownMetadata(block).table;
    const payload = getNotionBlockPayload(block);
    const rows = (block.children ?? [ ]).filter((row: NotionBlock) => row.type === "table_row");
    const headerRow = table?.headerRow ?? payload.has_column_header === true;
    const headerColumn = table?.headerColumn ?? payload.has_row_header === true;
    const width = typeof payload.table_width === "number"
        ? payload.table_width
        : Math.max(0, ...rows.map((row: NotionBlock) =>
        {
            const cells = getNotionBlockPayload(row).cells;
            return Array.isArray(cells) ? cells.length : 0;
        }));
    const cellWidth = table?.fitPageWidth ? Math.max(64, context.availableWidth / Math.max(1, width)) : 140;

    const RootStyle = useMemo(() => ({
        borderColor: context.theme.border,
        borderWidth: 1,
        marginVertical: 8
    }), [ context.theme.border ]);

    return (
        <ScrollView
            horizontal={ !table?.fitPageWidth || cellWidth * width > context.availableWidth }
            style={ RootStyle }>
            <View>
                {
                    rows.map((row: NotionBlock, rowIndex: number) =>
                    {
                        const cells = Array.isArray(getNotionBlockPayload(row).cells)
                            ? getNotionBlockPayload(row).cells as Array<unknown>
                            : [ ];

                        const rowMeta = getNotionMarkdownMetadata(row).table;

                        return (
                            <View
                                key={ row.id }
                                style={ { flexDirection: "row" } }>
                                {
                                    Array.from({ length: width }, (_: unknown, columnIndex: number) =>
                                    {
                                        const color =
                                            rowMeta?.cellColors?.[columnIndex] ??
                                            rowMeta?.rowColor ??
                                            table?.columnColors?.[columnIndex];

                                        const backgroundColor =
                                            notionColor(color, context.dark) ??
                                            ((headerRow && rowIndex === 0) ||
                                            (headerColumn && columnIndex === 0)
                                                ? context.theme.surface
                                                : context.theme.background
                                            );

                                        const RootStyle =
                                            {
                                                backgroundColor,
                                                borderBottomWidth: 1,
                                                borderColor: context.theme.border,
                                                borderRightWidth: 1,
                                                minHeight: 44,
                                                padding: 7,
                                                width: cellWidth
                                            } as const;

                                        const weight = (
                                            (headerRow && rowIndex === 0) ||
                                            (headerColumn && columnIndex === 0)
                                        )
                                            ? "bold"
                                            : "normal";

                                        return (
                                            <View
                                                key={ columnIndex }
                                                style={ RootStyle }>
                                                <Rich
                                                    context={ context }
                                                    value={ cells[columnIndex] }
                                                    weight={ weight }
                                                />
                                            </View>
                                        );
                                    })
                                }
                            </View>
                        );
                    })
                }
            </View>
        </ScrollView>
    );
}

/** Reusable recursive block presentation. */
export function NotionBlockView({ block, context, depth = 0, ordinal = 0, seen = new Set<string>() }: {
    readonly block: NotionBlock;
    readonly context: RenderContext;
    readonly depth?: number;
    readonly ordinal?: number;
    readonly seen?: ReadonlySet<string>;
})
{
    const payload = getNotionBlockPayload(block);
    const metadata = getNotionMarkdownMetadata(block);
    const color = blockColor(block);
    const mapped = notionColor(color, context.dark);
    const backgroundColor = color?.endsWith("_bg") || color?.endsWith("_background") ? mapped : undefined;
    const foreground = backgroundColor ? undefined : mapped;
    const override = context.props.components?.[block.type];
    const childView = (
        <Children block={ block }
            context={ context }
            depth={ depth }
            seen={ seen }
        />
    );

    if (override)
    {
        const Component = override;
        return (
            <Component
                block={ block }
                theme={ context.theme }>
                { childView }
            </Component>
        );
    }
    if (metadata.unsupportedType)
    {
        return (
            <View style={ {
                backgroundColor: context.theme.surface,
                borderRadius: 6,
                marginVertical: 4,
                padding: context.theme.spacing
            } }>
                <Text style={ { color: context.theme.error, fontFamily: context.theme.fontFamily } }>
                    Unsupported block: { String(metadata.unsupportedType) }
                </Text>
                { childView }
            </View>
        );
    }
    const base = { marginVertical: 0, paddingHorizontal: 6, backgroundColor };
    const text = (
        value: unknown,
        size?: number,
        weight?: "normal" | "bold" | "600" | "700",
        family?: string,
        overrides?: { readonly color?: string; readonly strikethrough?: boolean },
        lineHeight?: number) =>
        <Rich
            color={ overrides?.color ?? foreground }
            context={ context }
            family={ family }
            lineHeight={ lineHeight }
            size={ size }
            strikethrough={ overrides?.strikethrough }
            value={ value }
            weight={ weight }
        />;

    switch (block.type)
    {
        case "paragraph":
            return (
                <View
                    style={ { ...base, paddingVertical: 6 } }
                    testID={ `block-${ block.id }` }>
                    {
                        metadata.empty
                            ? (
                                <View
                                    accessibilityLabel="Empty block"
                                    style={ { minHeight: context.theme.fontSize * 1.5 } }
                                />
                            )
                            : text(payload.rich_text)
                    }
                    { childView }
                </View>
            );
        case "heading_1":
        case "heading_2":
        case "heading_3":
        case "heading_4":
        {
            const level = Number(block.type.slice(-1));
            const headingFontSize = context.theme.fontSize * ([ 30 / 16, 24 / 16, 20 / 16, 16 / 16 ][ level - 1 ] ?? 1);
            const headingLineHeight = context.theme.fontSize * ([ 39 / 16, 31.2 / 16, 26 / 16, 24 / 16 ][ level - 1 ] ?? 1.5);
            const headingPaddingTop = 30 - (level - 1) * 4;
            const heading = text(
                payload.rich_text,
                headingFontSize,
                "bold",
                level === 1 ? context.theme.titleFontFamily : undefined,
                undefined,
                headingLineHeight
            );

            return (
                <View
                    accessibilityRole="header"
                    ref={ (view: View | null) => context.registerHeading(block.id, view) }
                    style={ {
                        ...base,
                        paddingBottom: 6,
                        paddingTop: headingPaddingTop
                    } }
                    testID={ `heading-${block.id}` }>
                    {
                        payload.is_toggleable === true || metadata.toggle === true
                            ? (
                                <ToggleContent block={ block }
                                    context={ context }
                                    depth={ depth }
                                    seen={ seen }
                                    title={ heading }
                                />
                            )
                            : heading
                    }
                </View>
            );
        }
        case "bulleted_list_item": case "numbered_list_item": {
            const marker = block.type === "bulleted_list_item"
                ? "•"
                : `${ ordinal }.`;

            return (
                <View style={ { ...base, paddingBottom: 1, paddingLeft: 6 + depth * 32, paddingTop: 1 } }>
                    <View style={ { alignItems: "flex-start", flexDirection: "row", paddingLeft: 2 } }>
                        <Text style={ {
                            color: foreground ?? context.theme.foreground,
                            fontFamily: context.theme.fontFamily,
                            fontSize: context.theme.fontSize,
                            width: 24
                        } }>
                            { marker }
                        </Text>
                        <View style={ { flex: 1 } }>
                            { text(payload.rich_text) }
                        </View>
                    </View>
                    <View style={ { paddingLeft: 24 } }>
                        { childView }
                    </View>
                </View>
            );
        }
        case "to_do": {
            const checked = payload.checked === true;
            const Checkbox = context.props.checkboxComponent;

            return (
                <View style={ { ...base, paddingBottom: 1, paddingLeft: 6 + depth * 32, paddingTop: 1 } }>
                    <View style={ { alignItems: "flex-start", flexDirection: "row", paddingLeft: 2 } }>
                        <View
                            accessibilityLabel={ checked ? "Checked" : "Unchecked" }
                            accessibilityRole="checkbox"
                            accessibilityState={ { checked } }
                            style={ {
                                alignItems: "center",
                                height: context.theme.fontSize * 1.5,
                                justifyContent: "center",
                                width: 24
                            } }>
                            {
                                Checkbox === undefined
                                    ? <View style={ {
                                        alignItems: "center",
                                        backgroundColor: checked ? context.theme.accent : "transparent",
                                        borderColor: checked ? context.theme.accent : context.theme.border,
                                        borderRadius: 4,
                                        borderWidth: 1.5,
                                        height: 18,
                                        justifyContent: "center",
                                        width: 18
                                    } }>
                                        {
                                            checked && <Text style={ {
                                                color: "#ffffff",
                                                fontSize: 12,
                                                fontWeight: "700",
                                                lineHeight: 14
                                            } }>✓</Text>
                                        }
                                    </View>
                                    : createElement(Checkbox, { checked })
                            }
                        </View>
                        <View style={ { flex: 1 } }>
                            {
                                text(payload.rich_text, undefined, undefined, undefined, checked
                                    ? { color: context.theme.muted, strikethrough: true }
                                    : undefined)
                            }
                        </View>
                    </View>
                    <View style={ { paddingLeft: 24 } }>
                        { childView }
                    </View>
                </View>
            );
        }
        case "quote":
            return (
                <View style={ {
                    ...base,
                    borderLeftColor: context.theme.border,
                    borderLeftWidth: 3,
                    paddingBottom: 6,
                    paddingLeft: 14,
                    paddingRight: 8,
                    paddingTop: 6
                } }>
                    { text(payload.rich_text) }
                    { childView }
                </View>
            );
        case "toggle":
            return (
                <View style={ base }>
                    <ToggleContent
                        block={ block }
                        context={ context }
                        depth={ depth }
                        seen={ seen }
                        title={ text(payload.rich_text) }
                    />
                </View>
            );
        case "callout":
            return <View style={ { ...base, padding: 8 } }>
                <View style={ {
                    backgroundColor: backgroundColor ?? context.theme.surface,
                    borderColor: context.theme.border,
                    borderRadius: 10,
                    borderWidth: StyleSheet.hairlineWidth,
                    flexDirection: "row",
                    minHeight: context.theme.fontSize * 2,
                    padding: 12
                } }>
                    <View style={ { marginTop: context.theme.fontSize * 0.47, width: 24 } }>
                        <Text style={ { fontSize: context.theme.fontSize * 1.3 } }>
                            { String(asRecord(payload.icon).emoji ?? metadata.icon ?? "💬") }
                        </Text>
                    </View>
                    <View style={ { flex: 1, minHeight: context.theme.fontSize * 2 } }>
                        { text(payload.rich_text) }
                        { childView }
                    </View>
                </View>
            </View>;
        case "code":
        {
            const source = plain(payload.rich_text);
            if (payload.language === "mermaid")
            {
                return <NotionMermaidView source={ source }
                    theme={ context.theme } />;
            }
            return (
                <View style={ {
                    ...base,
                    backgroundColor: context.theme.codeBackground,
                    borderRadius: 6,
                    padding: context.theme.spacing
                } }>
                    <Text style={ {
                        color: context.theme.muted,
                        fontFamily: context.theme.fontFamily,
                        fontSize: context.theme.fontSize * 0.75
                    } }>
                        { String(payload.language ?? "") }
                    </Text>
                    <Text
                        selectable
                        style={ {
                            color: context.theme.foreground,
                            fontFamily: "monospace",
                            fontSize: context.theme.fontSize
                        } }>
                        { source }
                    </Text>
                </View>
            );
        }
        case "equation": return <View style={ base }><NotionMathView display
            expression={ String(payload.expression ?? "") }
            theme={ context.theme } /></View>;
        case "divider":
            return (
                <View accessibilityLabel="Divider"
                    style={ {
                        alignSelf: "stretch",
                        backgroundColor: context.theme.border,
                        height: StyleSheet.hairlineWidth,
                        marginBottom: context.theme.spacing * 1.5,
                        marginHorizontal: context.theme.spacing / 2,
                        marginTop: context.theme.spacing,
                        opacity: 0.55
                    } }
                />
            );
        case "column_list":
            return (
                <View style={ {
                    flexDirection: context.narrow ? "column" : "row",
                    gap: context.theme.spacing
                } }>
                    {
                        (block.children ?? [ ]).map((column: NotionBlock) => (
                            <View
                                key={ column.id }
                                style={ { flex: context.narrow ? undefined : 1 } }>
                                <NotionBlockView
                                    block={ column }
                                    context={ context }
                                    depth={ depth + 1 }
                                    seen={ seen }
                                />
                            </View>))
                    }
                </View>
            );
        case "column": return <View style={ base }>{childView}</View>;
        case "table":
            return (
                <TableView
                    block={ block }
                    context={ context }
                />
            );
        case "table_row":
            return (
                <View style={ base }>
                    { text((payload.cells as Array<unknown> | undefined)?.flat() ?? [ ]) }
                </View>
            );
        case "table_of_contents":
            return (
                <View style={ {
                    ...base,
                    backgroundColor: context.theme.surface,
                    borderRadius: 6,
                    padding: context.theme.spacing
                } }>
                    <Text style={ {
                        color: context.theme.foreground,
                        fontFamily: context.theme.fontFamily,
                        fontSize: context.theme.fontSize,
                        fontWeight: "bold"
                    } }>
                        Table of contents
                    </Text>
                    {
                        context.headings.map((entry: HeadingEntry) => (
                            <Pressable accessibilityLabel={ `Go to ${ entry.text }` }
                                accessibilityRole="link"
                                key={ entry.block.id }
                                onPress={ () => context.goToHeading(entry.block.id) }
                                style={ {
                                    paddingLeft: Math.min(entry.depth, 4) * 12,
                                    paddingVertical: 5
                                } }>
                                <Text style={ {
                                    color: context.theme.accent,
                                    fontFamily: context.theme.fontFamily,
                                    fontSize: context.theme.fontSize
                                } }>
                                    { entry.text }
                                </Text>
                            </Pressable>
                        ))
                    }
                </View>
            );
        case "image":
        case "audio":
        case "video":
        case "file":
        case "pdf":
            return (
                <NotionMediaView
                    block={ block }
                    dark={ context.dark }
                    kind={ block.type }
                    onOpenUrl={ context.props.onOpenUrl }
                    resolveMediaUrl={ context.props.resolveMediaUrl }
                    theme={ context.theme }
                />
            );
        case "embed":
        case "bookmark":
        case "link_to_page":
            return (
                <ReferenceCard
                    block={ block }
                    context={ context }
                />
            );
        case "synced_block":
        case "synced_block_reference":
            return (
                <SyncedContent block={ block }
                    context={ context }
                    depth={ depth }
                    seen={ seen }
                />
            );
        default:
            return (
                <View style={ base }>
                    { text(payload.rich_text) }
                    { childView }
                </View>
            );
    }
}

/** Render enhanced Markdown or a supplied document without mutating the AST. */
export function NotionMarkdownRenderer(props: NotionMarkdownRendererProps)
{
    useEffect(() =>
    {
        /* eslint-disable no-console */
        console.log("M3_RENDERER_MOUNT");
        return () => console.log("M3_RENDERER_UNMOUNT");
        /* eslint-enable no-console */
    }, [ ]);
    const parsed = useMemo(() => props.markdown === undefined
        ? undefined
        : parseNotionMarkdown(props.markdown),
    [ props.markdown ]
    );
    const document = useMemo(
        () => props.document ?? parsed?.document ?? emptyDocument,
        [ props.document, parsed ]
    );
    const diagnostics = parsed?.diagnostics;
    const onDiagnostics = props.onDiagnostics;
    useEffect(() => { onDiagnostics?.(diagnostics ?? []); }, [ diagnostics, onDiagnostics ]);
    const systemDark = useColorScheme() === "dark";
    const dark = props.colorScheme === "dark" || (props.colorScheme !== "light" && systemDark);
    const theme = useMemo(() => ({
        ...(dark ? darkRendererTheme : lightRendererTheme),
        ...props.theme
    }), [ dark, props.theme ]);
    const { width } = useWindowDimensions();
    const availableWidth = Math.max(120, width - theme.spacing * 2);
    const scroll = useRef<ScrollView>(null);
    const content = useRef<View>(null);
    const headings = useRef(new Map<string, View>());
    const [ target, setTarget ] = useState<{ document: NotionDocument; id: string }>();
    const targetHeading = target?.document === document ? target.id : undefined;
    const registerHeading = (id: string, view: View | null) =>
    {
        if (view)
        {
            headings.current.set(id, view);
        }
        else
        {
            headings.current.delete(id);
        }
    };
    const goToHeading = (id: string) =>
    {
        setTarget({ document, id });
        setTimeout(() =>
        {
            const heading = headings.current.get(id);
            if (heading && content.current)
            {
                heading.measureLayout(
                    content.current,
                    (_x: number, y: number) => scroll.current?.scrollTo({ animated: true, y })
                );
            }
        }, 150);
    };
    const context: RenderContext =
        {
            availableWidth,
            dark,
            document,
            goToHeading,
            headings: collectHeadings(document.blocks),
            narrow: width < 600,
            props,
            registerHeading,
            synced: collectSynced(document.blocks),
            targetHeading,
            theme
        };

    return (
        <ScrollView
            ref={ scroll }
            style={ { backgroundColor: theme.background, flex: 1 } }
            testID={ props.testID ?? "notion-markdown-renderer" }>
            <View
                ref={ content }
                style={ { padding: theme.spacing } }>
                <BlockList
                    blocks={ document.blocks }
                    context={ context }
                />
            </View>
        </ScrollView>
    );
}
