/**
 * Built-in block-actions bottom sheet, opened for blocks (e.g. a divider) that aren't otherwise
 * reachable by the text cursor.
 *
 * @module react-native-notion-markdown/editor/ui/ActionsBottomSheet
 *
 * @file      ActionsBottomSheet.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { CopyActionIcon, TrashActionIcon } from "./actionIcons.tsx";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { NotionEditorComponents, NotionEditorIconProps } from "./NotionEditor.tsx";
import type { ComponentType } from "react";
import { useCallback } from "react";

/** An action selected in the built-in block-actions sheet. */
export type NotionEditorBlockAction = "delete" | "duplicate" | "insertAbove" | "insertBelow";

/** Public props for the built-in block-actions sheet. */
export interface ActionsBottomSheetProps
{
    /** Translated display name of the target block, e.g. "Divider". */
    readonly blockName: string;
    readonly components?: NotionEditorComponents;
    readonly dark: boolean;
    readonly labels: {
        readonly delete: string;
        readonly duplicate: string;
        readonly insertAbove: string;
        readonly insertBelow: string;
        readonly title: string;
    };
    readonly onAction: (action: NotionEditorBlockAction) => void;
    readonly onDismiss: () => void;
    /** Hidden for block types (the divider) that can't take content above themselves. */
    readonly showInsertAbove: boolean;
}

interface ActionOptionProps
{
    readonly color: string;
    readonly icon?: ComponentType<NotionEditorIconProps>;
    readonly label: string;
    readonly onPress: () => void;
}

type LucideModule = Record<string, ComponentType<NotionEditorIconProps>> &
{
    readonly default?: Record<string, ComponentType<NotionEditorIconProps>>;
};

const lucideNames: Readonly<Record<"copy" | "remove", string>> =
    {
        copy: "Copy",
        remove: "Trash2"
    } as const;

let optionalLucide: LucideModule | null | undefined;

/** Load the optional Lucide peer without making it a required dependency of the editor UI. */
function getLucideIcons(): LucideModule | undefined
{
    if (optionalLucide !== undefined)
    {
        return optionalLucide ?? undefined;
    }

    try
    {
        /* Keep Metro from turning the optional peer into an unconditional module dependency. */
        const optionalRequire = eval("require") as (moduleName: string) => unknown;
        const loaded = optionalRequire("lucide-react-native") as LucideModule;
        optionalLucide = loaded.default ? { ...loaded, ...loaded.default } : loaded;
    }
    catch
    {
        optionalLucide = null;
    }

    return optionalLucide ?? undefined;
}

/** Resolve an override, an installed Lucide icon, or the dependency-free SVG fallback. */
function getActionIcon(
    button: "copy" | "remove",
    components: ActionsBottomSheetProps["components"]
): ComponentType<NotionEditorIconProps>
{
    const override = components?.[button];

    if (override !== undefined)
    {
        return override;
    }

    const lucideIcon = getLucideIcons()?.[lucideNames[button]];

    if (lucideIcon !== undefined)
    {
        return lucideIcon;
    }

    return button === "copy" ? CopyActionIcon : TrashActionIcon;
}

/** Render one labeled action row. */
function ActionOption({ color, icon: Icon, label, onPress }: ActionOptionProps)
{
    const optionStyle = useCallback(({ pressed }: { pressed: boolean }) => [
        styles.option,
        pressed
            ? { backgroundColor: `${ color }12` }
            : undefined
    ], [ color ]);

    return <Pressable accessibilityLabel={ label }
        accessibilityRole="button"
        android_ripple={ { color: `${ color }22` } }
        onPress={ onPress }
        style={ optionStyle }>
        {
            Icon !== undefined && <Icon
                color={ color }
                size={ 20 }
                strokeWidth={ 1.75 } />
        }
        <Text style={ [ styles.optionLabel, { color } ] }>{ label }</Text>
    </Pressable>;
}

/** Render the built-in block-actions sheet. */
export function ActionsBottomSheet({
    blockName,
    components,
    dark,
    labels,
    onAction,
    onDismiss,
    showInsertAbove
}: ActionsBottomSheetProps)
{
    const foreground = dark ? "#F5F5F5" : "#2C2C2B";
    const muted = dark ? "#D0CDC7" : "#45433F";
    const surface = dark ? "#202020" : "#F9F8F6";
    const optionSurface = dark ? "#30302F" : "#FFFFFF";
    const divider = dark ? "rgba(255, 255, 255, 0.10)" : "#EEECE9";
    const scrim = dark ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.25)";
    /* The package's "danger" color -- see NotionRendererTheme.danger -- deliberately the same
       hex in both themes, unlike the other colors on this sheet. */
    const danger = "#E56458";

    return <Modal
        animationType="slide"
        navigationBarTranslucent
        onRequestClose={ onDismiss }
        statusBarTranslucent
        transparent
        visible>
        <View style={ styles.modalRoot }>
            <Pressable
                accessibilityLabel="Dismiss actions"
                accessibilityRole="button"
                onPress={ onDismiss }
                style={ [ styles.scrim, { backgroundColor: scrim } ] } />
            <View accessibilityViewIsModal
                style={ [ styles.sheet, { backgroundColor: surface } ] }>
                <View style={ styles.content }>
                    <Text accessibilityRole="header"
                        style={ [ styles.title, { color: foreground } ] }>
                        { labels.title }
                    </Text>
                    <Text style={ [ styles.blockNameLabel, { color: muted } ] }>{ blockName }</Text>
                    <View style={ [
                        styles.options,
                        { backgroundColor: optionSurface, borderColor: divider }
                    ] }>
                        {
                            showInsertAbove && <ActionOption
                                color={ muted }
                                label={ labels.insertAbove }
                                onPress={ () => onAction("insertAbove") } />
                        }
                        {
                            showInsertAbove
                                && <View style={ [ styles.divider, { backgroundColor: divider } ] } />
                        }
                        <ActionOption
                            color={ muted }
                            label={ labels.insertBelow }
                            onPress={ () => onAction("insertBelow") } />
                    </View>
                    <View style={ styles.groupGap } />
                    <View style={ [
                        styles.options,
                        { backgroundColor: optionSurface, borderColor: divider }
                    ] }>
                        <ActionOption
                            color={ muted }
                            icon={ getActionIcon("copy", components) }
                            label={ labels.duplicate }
                            onPress={ () => onAction("duplicate") } />
                        <View style={ [ styles.divider, { backgroundColor: divider } ] } />
                        <ActionOption
                            color={ danger }
                            icon={ getActionIcon("remove", components) }
                            label={ labels.delete }
                            onPress={ () => onAction("delete") } />
                    </View>
                </View>
            </View>
        </View>
    </Modal>;
}

const styles = StyleSheet.create({
    blockNameLabel:
    {
        fontSize: 11,
        fontWeight: "600",
        /* Aligns flush with the icons in the rows below, not with the rows' own left edge --
           matching each `option`'s own 24px inset. */
        marginBottom: 6,
        marginLeft: 24,
        textTransform: "uppercase"
    },
    content:
    {
        paddingBottom: 64,
        paddingHorizontal: 16,
        paddingTop: 14
    },
    divider:
    {
        height: StyleSheet.hairlineWidth
    },
    groupGap:
    {
        height: 12
    },
    modalRoot:
    {
        flex: 1,
        justifyContent: "flex-end"
    },
    option:
    {
        alignItems: "center",
        flexDirection: "row",
        gap: 16,
        minHeight: 48,
        paddingHorizontal: 24
    },
    optionLabel:
    {
        fontSize: 16,
        fontWeight: "500"
    },
    options:
    {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: "hidden"
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
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: "hidden"
    },
    title:
    {
        fontSize: 16,
        fontWeight: "600",
        paddingBottom: 16,
        textAlign: "center"
    }
});
