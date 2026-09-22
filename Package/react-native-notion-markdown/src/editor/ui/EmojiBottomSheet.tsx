/**
 * Built-in emoji picker bottom sheet for callout icons.
 *
 * @module react-native-notion-markdown/editor/ui/EmojiBottomSheet
 *
 * @file      EmojiBottomSheet.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useColorScheme
} from "react-native";
import { useCallback, useMemo, useState } from "react";

/** Public props for the built-in callout emoji picker. */
export interface EmojiBottomSheetProps
{
    readonly dark?: boolean;
    readonly labels: {
        readonly common: string;
        readonly filter: string;
        readonly title: string;
    };
    readonly onDismiss: () => void;
    readonly onSelected: (emoji: string) => void;
}

interface EmojiChoice
{
    readonly emoji: string;
    readonly keywords: ReadonlyArray<string>;
}

const commonEmojis: ReadonlyArray<EmojiChoice> =
    [
        { emoji: "✨", keywords: [ "sparkles", "magic" ] },
        { emoji: "📝", keywords: [ "memo", "note", "write" ] },
        { emoji: "💬", keywords: [ "speech", "comment", "message" ] },
        { emoji: "🎯", keywords: [ "target", "goal" ] },
        { emoji: "🚀", keywords: [ "rocket", "launch" ] },
        { emoji: "🌟", keywords: [ "star", "favorite" ] },
        { emoji: "❤️", keywords: [ "heart", "love" ] },
        { emoji: "🤔", keywords: [ "thinking", "question" ] },
        { emoji: "🎉", keywords: [ "party", "celebrate" ] },
        { emoji: "🔍", keywords: [ "search", "find" ] },
        { emoji: "🧭", keywords: [ "compass", "direction" ] },
        { emoji: "🌈", keywords: [ "rainbow", "color" ] },
        { emoji: "🧠", keywords: [ "brain", "idea", "think" ] },
        { emoji: "🌱", keywords: [ "seedling", "grow", "growth" ] },
        { emoji: "🏠", keywords: [ "house", "home" ] },
        { emoji: "📚", keywords: [ "books", "read", "learn" ] }
    ];

const shuffleRipple = { color: "rgba(128, 128, 128, 0.18)" };

interface EmojiOptionProps
{
    readonly choice: EmojiChoice;
    readonly onPress: (emoji: string) => void;
}

/** Render one large, evenly spaced emoji choice. */
function EmojiOption({ choice, onPress }: EmojiOptionProps)
{
    const handlePress = useCallback(() => onPress(choice.emoji), [ choice.emoji, onPress ]);

    return <Pressable
        accessibilityLabel={ choice.keywords.join(", ") }
        accessibilityRole="button"
        onPress={ handlePress }
        style={ styles.emojiOption }>
        <Text style={ styles.emoji }>{ choice.emoji }</Text>
    </Pressable>;
}

/** Render the callout emoji picker sheet. */
export function EmojiBottomSheet({ dark: suppliedDark, labels, onDismiss, onSelected }: EmojiBottomSheetProps)
{
    const systemDark = useColorScheme() === "dark";
    const dark = suppliedDark ?? systemDark;
    const [ query, setQuery ] = useState("");
    const [ choices, setChoices ] = useState(commonEmojis);
    const foreground = dark ? "#F5F5F5" : "#2C2C2B";
    const muted = dark ? "#ADA9A3" : "#787774";
    const surface = dark ? "#202020" : "#F9F8F6";
    const inputSurface = dark ? "#30302F" : "#FFFFFF";
    const divider = dark ? "rgba(255, 255, 255, 0.10)" : "#EEECE9";
    const scrim = dark ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.25)";

    const filteredChoices = useMemo(() =>
    {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        if (normalizedQuery.length === 0)
        {
            return choices;
        }

        return choices.filter((choice: EmojiChoice) => choice.keywords.some(
            (keyword: string) => keyword.includes(normalizedQuery) || choice.emoji.includes(query.trim())
        ));
    }, [ choices, query ]);
    const handleShuffle = useCallback(() =>
    {
        setChoices((current: ReadonlyArray<EmojiChoice>) => [ ...current ].sort(
            () => Math.random() - 0.5
        ));
    }, [ ]);
    const handleSelected = useCallback((emoji: string) =>
    {
        /* Close first so the editor's focus command cannot land after the icon update. */
        onDismiss();
        onSelected(emoji);
    }, [ onDismiss, onSelected ]);
    const scrimStyle = useMemo(() => [ styles.scrim, { backgroundColor: scrim } ], [ scrim ]);
    const sheetStyle = useMemo(() => [ styles.sheet, { backgroundColor: surface } ], [ surface ]);
    const titleStyle = useMemo(() => [ styles.title, { color: foreground } ], [ foreground ]);
    const sectionTitleStyle = useMemo(() => [ styles.sectionTitle, { color: muted } ], [ muted ]);
    const filterStyle = useMemo(() => [
        styles.filter,
        { backgroundColor: inputSurface, borderColor: divider, color: foreground }
    ], [ divider, foreground, inputSurface ]);
    const shuffleStyle = useMemo(() => [ styles.shuffle, { borderColor: divider } ], [ divider ]);

    return <Modal
        animationType="slide"
        navigationBarTranslucent
        onRequestClose={ onDismiss }
        statusBarTranslucent
        transparent
        visible>
        <View style={ styles.modalRoot }>
            <Pressable
                accessibilityLabel="Dismiss emoji picker"
                accessibilityRole="button"
                onPress={ onDismiss }
                style={ scrimStyle } />
            <View accessibilityViewIsModal
                style={ sheetStyle }>
                <View style={ styles.content }>
                    <Text accessibilityRole="header"
                        style={ titleStyle }>
                        { labels.title }
                    </Text>
                    <View style={ styles.filterRow }>
                        <View style={ styles.filterContainer }>
                            <Text style={ styles.searchGlyph }>⌕</Text>
                            <TextInput
                                accessibilityLabel={ labels.filter }
                                autoCapitalize="none"
                                onChangeText={ setQuery }
                                placeholder={ labels.filter }
                                placeholderTextColor={ muted }
                                style={ filterStyle }
                                value={ query } />
                        </View>
                        <Pressable
                            accessibilityLabel="Shuffle emoji"
                            accessibilityRole="button"
                            android_ripple={ shuffleRipple }
                            onPress={ handleShuffle }
                            style={ shuffleStyle }>
                            <Text style={ styles.shuffleGlyph }>🔀</Text>
                        </Pressable>
                    </View>
                    <Text style={ sectionTitleStyle }>{ labels.common }</Text>
                    <ScrollView
                        contentContainerStyle={ styles.gridContent }
                        keyboardShouldPersistTaps="always"
                        showsVerticalScrollIndicator={ false }>
                        <View style={ styles.grid }>
                            { filteredChoices.map((choice: EmojiChoice) => <EmojiOption
                                choice={ choice }
                                key={ choice.emoji }
                                onPress={ handleSelected } />) }
                        </View>
                    </ScrollView>
                </View>
            </View>
        </View>
    </Modal>;
}

const styles = StyleSheet.create({
    content:
    {
        flex: 1,
        paddingBottom: 24,
        paddingHorizontal: 16,
        paddingTop: 14
    },
    emoji:
    {
        fontSize: 34,
        lineHeight: 42,
        textAlign: "center"
    },
    emojiOption:
    {
        alignItems: "center",
        justifyContent: "center",
        minHeight: 58,
        width: "12.5%"
    },
    filter:
    {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        flex: 1,
        fontSize: 17,
        height: 52,
        paddingHorizontal: 42,
        paddingVertical: 0
    },
    filterContainer:
    {
        flex: 1,
        justifyContent: "center"
    },
    filterRow:
    {
        alignItems: "center",
        flexDirection: "row",
        gap: 10,
        marginBottom: 22
    },
    grid:
    {
        flexDirection: "row",
        flexWrap: "wrap",
        width: "100%"
    },
    gridContent:
    {
        paddingBottom: 24
    },
    modalRoot:
    {
        flex: 1,
        justifyContent: "flex-end"
    },
    scrim:
    {
        bottom: 0,
        left: 0,
        position: "absolute",
        right: 0,
        top: 0
    },
    searchGlyph:
    {
        color: "#8E8B86",
        fontSize: 30,
        left: 14,
        lineHeight: 32,
        position: "absolute",
        top: 10,
        zIndex: 1
    },
    sectionTitle:
    {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 10
    },
    sheet:
    {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: "82%",
        overflow: "hidden"
    },
    shuffle:
    {
        alignItems: "center",
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        height: 52,
        justifyContent: "center",
        width: 56
    },
    shuffleGlyph:
    {
        fontSize: 24
    },
    title:
    {
        fontSize: 18,
        fontWeight: "700",
        paddingBottom: 18,
        textAlign: "center"
    }
});
