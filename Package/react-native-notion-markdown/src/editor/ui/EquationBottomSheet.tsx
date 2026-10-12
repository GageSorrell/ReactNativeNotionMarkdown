/**
 * Built-in LaTeX prompt for the editor's inline equation action.
 *
 * @module react-native-notion-markdown/editor/ui/EquationBottomSheet
 *
 * @file      EquationBottomSheet.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { useCallback, useMemo, useState } from "react";
import type { MarkdownEditorEquationResult } from "./MarkdownEditor.tsx";
import { MarkdownMathView } from "../../renderer/ui/MathView.tsx";
import { editorFontStyle } from "./customization.ts";
import { useResolvedEditorConfig } from "../../provider/MarkdownProvider.tsx";

interface EquationBottomSheetProps
{
    readonly initialExpression: string;
    readonly labels: {
        readonly apply: string;
        readonly cancel: string;
        readonly expression: string;
        readonly placeholder: string;
        readonly preview: string;
        readonly title: string;
    };
    readonly onDismiss: () => void;
    readonly onSubmit: (result: MarkdownEditorEquationResult) => void;
}

/** Render the built-in inline equation prompt. */
export function EquationBottomSheet({
    initialExpression,
    labels,
    onDismiss,
    onSubmit
}: EquationBottomSheetProps)
{
    const { theme } = useResolvedEditorConfig();
    const { sheet } = theme.editor;
    const { fontFamily } = editorFontStyle(theme.editor);
    const monospaceFontFamily = theme.document.monospaceFontFamily;
    const foreground = sheet.foreground;
    const muted = sheet.subtle;
    const surface = sheet.background;
    const fieldSurface = sheet.card;
    const border = sheet.border;
    const accent = theme.document.accent;
    const onAccent = theme.document.onAccent;
    const scrim = sheet.scrim;
    const previewSurface = theme.document.background;
    const [ expression, setExpression ] = useState(initialExpression);
    const trimmed = expression.trim();
    const blank = trimmed.length === 0;
    const scrimStyle = useMemo(() => [ styles.scrim, { backgroundColor: scrim } ], [ scrim ]);
    const sheetStyle = useMemo(() => [ styles.sheet, { backgroundColor: surface } ], [ surface ]);
    const titleStyle = useMemo(
        () => [ styles.title, { color: foreground, fontFamily } ],
        [ fontFamily, foreground ]
    );
    const fieldLabelStyle = useMemo(
        () => [ styles.fieldLabel, { color: muted, fontFamily } ],
        [ fontFamily, muted ]
    );
    const inputStyle = useMemo(() => [ styles.input, {
        backgroundColor: fieldSurface, borderColor: border, color: foreground, fontFamily: monospaceFontFamily
    } ], [ border, fieldSurface, foreground, monospaceFontFamily ]);
    const previewStyle = useMemo(
        () => [ styles.preview, { backgroundColor: previewSurface, borderColor: border } ],
        [ border, previewSurface ]
    );
    const cancelTextStyle = useMemo(
        () => [ styles.actionText, { color: muted, fontFamily } ],
        [ fontFamily, muted ]
    );
    const applyButtonStyle = useMemo(
        () => [ styles.action, { backgroundColor: accent }, blank && styles.disabledAction ],
        [ accent, blank ]
    );
    const applyTextStyle = useMemo(
        () => [ styles.actionText, { color: onAccent, fontFamily } ],
        [ fontFamily, onAccent ]
    );
    const handleApply = useCallback(() =>
    {
        if (!blank)
        {
            onSubmit({ expression: trimmed });
        }
    }, [ blank, onSubmit, trimmed ]);

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
                <Text style={ fieldLabelStyle }>{ labels.expression }</Text>
                <TextInput
                    accessibilityLabel={ labels.expression }
                    autoCapitalize="none"
                    autoCorrect={ false }
                    autoFocus
                    multiline
                    onChangeText={ setExpression }
                    placeholder={ labels.placeholder }
                    placeholderTextColor={ muted }
                    spellCheck={ false }
                    style={ inputStyle }
                    value={ expression }
                />
                <Text style={ fieldLabelStyle }>{ labels.preview }</Text>
                <View accessibilityLabel={ labels.preview }
                    style={ previewStyle }>
                    {
                        blank ? null : <MarkdownMathView expression={ trimmed }
                            theme={ theme } />
                    }
                </View>
                <View style={ styles.actions }>
                    <Pressable accessibilityRole="button"
                        onPress={ onDismiss }
                        style={ styles.action }>
                        <Text style={ cancelTextStyle }>{ labels.cancel }</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button"
                        disabled={ blank }
                        onPress={ handleApply }
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
        marginTop: 16
    },
    disabledAction:
    {
        opacity: 0.4
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
        maxHeight: 140,
        minHeight: 72,
        paddingHorizontal: 14,
        paddingVertical: 10,
        textAlignVertical: "top"
    },
    preview:
    {
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        justifyContent: "center",
        minHeight: 56,
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
