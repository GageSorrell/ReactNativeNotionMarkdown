/**
 *
 *
 * @module react-native-notion-markdown/editor/ui/LinkBottomSheet
 *
 * @file      LinkBottomSheet.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Built-in URL and link-label prompt for the editor's inline link action.
 *
 * @module react-native-notion-markdown/editor/ui/LinkBottomSheet
 */

import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    useColorScheme
} from "react-native";
import type { NotionEditorLinkResult } from "./NotionEditor.tsx";
import { useMemo, useState } from "react";

interface LinkBottomSheetProps
{
    readonly dark: boolean;
    readonly initialLabel: string;
    readonly initialUrl?: string;
    readonly labels: {
        readonly apply: string;
        readonly cancel: string;
        readonly label: string;
        readonly title: string;
        readonly url: string;
    };
    readonly onDismiss: () => void;
    readonly onSubmit: (result: NotionEditorLinkResult) => void;
}

/** Normalize a user-entered URL, accepting hostnames without a scheme. */
function normalizeUrl(value: string): string | undefined
{
    const trimmed = value.trim();
    if (trimmed.length === 0) {return undefined;}

    try
    {
        return new URL(trimmed).toString();
    }
    catch
    {
        try
        {
            return new URL(`https://${ trimmed }`).toString();
        }
        catch
        {
            return undefined;
        }
    }
}

/** Render the built-in link prompt. */
export function LinkBottomSheet({
    dark,
    initialLabel,
    initialUrl,
    labels,
    onDismiss,
    onSubmit
}: LinkBottomSheetProps)
{
    const systemDark = useColorScheme() === "dark";
    const isDark = dark || systemDark;
    const foreground = isDark ? "#F5F5F5" : "#2C2C2B";
    const muted = isDark ? "#B8B5AF" : "#6D6A64";
    const surface = isDark ? "#202020" : "#F9F8F6";
    const fieldSurface = isDark ? "#30302F" : "#FFFFFF";
    const border = isDark ? "#4A4946" : "#D9D6D0";
    const accent = isDark ? "#81B8E7" : "#2F6EAB";
    const scrim = isDark ? "rgba(0, 0, 0, 0.60)" : "rgba(0, 0, 0, 0.28)";
    const [ url, setUrl ] = useState(initialUrl ?? "");
    const [ label, setLabel ] = useState(initialLabel);
    const normalizedUrl = normalizeUrl(url);
    const scrimStyle = useMemo(() => [ styles.scrim, { backgroundColor: scrim } ], [ scrim ]);
    const sheetStyle = useMemo(() => [ styles.sheet, { backgroundColor: surface } ], [ surface ]);
    const titleStyle = useMemo(() => [ styles.title, { color: foreground } ], [ foreground ]);
    const fieldLabelStyle = useMemo(() => [ styles.fieldLabel, { color: muted } ], [ muted ]);
    const inputStyle = useMemo(() => [ styles.input, {
        backgroundColor: fieldSurface, borderColor: border, color: foreground
    } ], [ border, fieldSurface, foreground ]);
    const cancelTextStyle = useMemo(() => [ styles.actionText, { color: muted } ], [ muted ]);
    const applyButtonStyle = useMemo(() => [ styles.action, { backgroundColor: accent } ], [ accent ]);
    const applyTextStyle = useMemo(() => [ styles.actionText, styles.applyText ], [ ]);

    return <Modal
        animationType="slide"
        onRequestClose={ onDismiss }
        statusBarTranslucent
        transparent
        visible>
        <KeyboardAvoidingView
            behavior={ Platform.OS === "ios" ? "padding" : undefined }
            style={ styles.root }>
            <Pressable
                accessibilityLabel={ labels.cancel }
                accessibilityRole="button"
                onPress={ onDismiss }
                style={ scrimStyle } />
            <View accessibilityViewIsModal
                style={ sheetStyle }>
                <Text accessibilityRole="header"
                    style={ titleStyle }>{ labels.title }</Text>
                <Text style={ fieldLabelStyle }>{ labels.url }</Text>
                <TextInput
                    autoCapitalize="none"
                    autoCorrect={ false }
                    autoFocus
                    keyboardType="url"
                    onChangeText={ setUrl }
                    placeholder="https://example.com"
                    placeholderTextColor={ muted }
                    style={ inputStyle }
                    value={ url }
                />
                <Text style={ fieldLabelStyle }>{ labels.label }</Text>
                <TextInput
                    onChangeText={ setLabel }
                    placeholder={ labels.label }
                    placeholderTextColor={ muted }
                    style={ inputStyle }
                    value={ label }
                />
                <View style={ styles.actions }>
                    <Pressable accessibilityRole="button"
                        onPress={ onDismiss }
                        style={ styles.action }>
                        <Text style={ cancelTextStyle }>{ labels.cancel }</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button"
                        disabled={ normalizedUrl === undefined || label.trim().length === 0 }
                        onPress={ () => normalizedUrl !== undefined
                            && onSubmit({ label: label.trim(), url: normalizedUrl }) }
                        style={ applyButtonStyle }>
                        <Text style={ applyTextStyle }>{ labels.apply }</Text>
                    </Pressable>
                </View>
            </View>
        </KeyboardAvoidingView>
    </Modal>;
}

const styles = StyleSheet.create({
    action:
    {
        alignItems: "center",
        borderRadius: 10,
        minWidth: 96,
        paddingHorizontal: 18,
        paddingVertical: 12
    },
    actionText:
    {
        fontSize: 15,
        fontWeight: "600"
    },
    actions:
    {
        flexDirection: "row",
        gap: 10,
        justifyContent: "flex-end",
        marginTop: 8
    },
    applyText:
    {
        color: "#FFFFFF"
    },
    fieldLabel:
    {
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 6,
        marginTop: 12,
        textTransform: "uppercase"
    },
    input:
    {
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        fontSize: 16,
        minHeight: 48,
        paddingHorizontal: 14,
        paddingVertical: 10
    },
    root:
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
    sheet:
    {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 32,
        paddingHorizontal: 18,
        paddingTop: 18
    },
    title:
    {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 2,
        textAlign: "center"
    }
});
