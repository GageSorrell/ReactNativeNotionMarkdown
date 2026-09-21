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

import * as ImagePicker from "expo-image-picker";
import { CameraIcon, GalleryIcon } from "./mediaIcons.tsx";
import { CopyActionIcon, TrashActionIcon } from "./actionIcons.tsx";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { NotionEditorComponents, NotionEditorIconProps } from "./NotionEditor.tsx";
import { createElement, type ComponentType } from "react";
import type { NotionMarkdownColor } from "../../document/types.ts";
import { useCallback, useMemo, useState } from "react";

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
        readonly color: string;
        readonly editIcon: string;
        readonly chooseColor: string;
        readonly text: string;
        readonly background: string;
        readonly defaultColor: string;
        readonly insertAbove: string;
        readonly insertBelow: string;
        readonly openGallery: string;
        readonly takePicture: string;
        readonly title: string;
    };
    readonly onAction: (action: NotionEditorBlockAction) => void;
    readonly onDismiss: () => void;
    /** Called when a color is selected for a callout. */
    readonly onColor?: (color: NotionMarkdownColor | undefined) => void;
    /** Called with the picked asset's local URI once a replacement image is chosen. */
    readonly onReplaceImage?: (url: string) => void | Promise<void>;
    /** Hidden for block types (the divider) that can't take content above themselves. */
    readonly showInsertAbove: boolean;
    /** Callout actions use the Notion-specific color/icon layout. */
    readonly showCalloutActions?: boolean;
    /** Shown only for the image block -- offers to replace its source via gallery or camera. */
    readonly showReplaceImage: boolean;
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

const lucideNames: Readonly<Record<
    "copy" | "remove" | "gallery" | "picture" | "color" | "edit" | "back", string
>> =
    {
        back: "ChevronLeft",
        color: "Palette",
        copy: "Copy",
        edit: "Pencil",
        gallery: "Image",
        picture: "Camera",
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

const actionIconFallbacks: Readonly<Record<
    "copy" | "remove" | "gallery" | "picture" | "color" | "edit" | "back",
    ComponentType<NotionEditorIconProps>>> =
    {
        back: CopyActionIcon,
        color: CopyActionIcon,
        copy: CopyActionIcon,
        edit: CopyActionIcon,
        gallery: GalleryIcon,
        picture: CameraIcon,
        remove: TrashActionIcon
    };

/** Resolve an override, an installed Lucide icon, or the dependency-free SVG fallback. */
function getActionIcon(
    button: "copy" | "remove" | "gallery" | "picture" | "color" | "edit" | "back",
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

    return actionIconFallbacks[button];
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

interface CalloutColorOption
{
    readonly color: NotionMarkdownColor | undefined;
    readonly hex?: string;
    readonly label: string;
}

const calloutTextColors: ReadonlyArray<CalloutColorOption> =
    [
        { color: undefined, label: "default" },
        { color: "gray", hex: "#787774", label: "gray" },
        { color: "brown", hex: "#9F6B53", label: "brown" },
        { color: "orange", hex: "#D9730D", label: "orange" },
        { color: "yellow", hex: "#CB912F", label: "yellow" },
        { color: "green", hex: "#448361", label: "green" },
        { color: "blue", hex: "#337EA9", label: "blue" },
        { color: "purple", hex: "#9065B0", label: "purple" },
        { color: "pink", hex: "#C14C8A", label: "pink" },
        { color: "red", hex: "#D44C47", label: "red" }
    ];

const calloutBackgroundColors: ReadonlyArray<CalloutColorOption> =
    [
        { color: undefined, label: "default" },
        { color: "gray_bg", hex: "#787774", label: "gray" },
        { color: "brown_bg", hex: "#9F6B53", label: "brown" },
        { color: "orange_bg", hex: "#D9730D", label: "orange" },
        { color: "yellow_bg", hex: "#CB912F", label: "yellow" },
        { color: "green_bg", hex: "#448361", label: "green" },
        { color: "blue_bg", hex: "#337EA9", label: "blue" },
        { color: "purple_bg", hex: "#9065B0", label: "purple" },
        { color: "pink_bg", hex: "#C14C8A", label: "pink" },
        { color: "red_bg", hex: "#D44C47", label: "red" }
    ];

function ColorOption({
    dark,
    option,
    onPress,
    defaultLabel
}: {
    readonly dark: boolean;
    readonly defaultLabel: string;
    readonly onPress: () => void;
    readonly option: CalloutColorOption;
})
{
    const foreground = dark ? "#F5F5F5" : "#2C2C2B";
    const muted = dark ? "#D0CDC7" : "#45433F";
    const swatch = option.hex ?? (dark ? "#30302F" : "#FFFFFF");
    const swatchBackground = option.color?.endsWith("_bg") === true
        ? `${ swatch }38`
        : swatch;

    return <Pressable accessibilityLabel={ option.color === undefined ? defaultLabel : option.label }
        accessibilityRole="button"
        onPress={ onPress }
        style={ styles.colorOption }>
        <View style={ [
            styles.colorSwatch,
            { backgroundColor: swatchBackground, borderColor: option.hex ?? muted }
        ] }>
            <Text style={ [ styles.colorSwatchText, { color: option.hex ?? foreground } ] }>
                { option.color === undefined ? "A" : "A" }
            </Text>
        </View>
        <Text style={ [ styles.colorOptionLabel, { color: foreground } ] }>
            { option.color === undefined ? defaultLabel : option.label }
        </Text>
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
    onColor,
    onReplaceImage,
    showInsertAbove,
    showCalloutActions = false,
    showReplaceImage
}: ActionsBottomSheetProps)
{
    const [ choosingColor, setChoosingColor ] = useState(false);
    const foreground = dark ? "#F5F5F5" : "#2C2C2B";
    const muted = dark ? "#D0CDC7" : "#45433F";
    const surface = dark ? "#202020" : "#F9F8F6";
    const optionSurface = dark ? "#30302F" : "#FFFFFF";
    const divider = dark ? "rgba(255, 255, 255, 0.10)" : "#EEECE9";
    const scrim = dark ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.25)";
    /* The package's "danger" color -- see NotionRendererTheme.danger -- deliberately the same
       hex in both themes, unlike the other colors on this sheet. */
    const danger = "#E56458";

    const handleReplace = useCallback(async (action: "gallery" | "picture") =>
    {
        const result = action === "gallery"
            ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: [ "images" ] })
            : await ImagePicker.launchCameraAsync({ mediaTypes: [ "images" ] });

        if (result.canceled) { return; }
        const uri = result.assets?.[ 0 ]?.uri;
        if (uri === undefined) { return; }

        /* Close first, matching MediaBottomSheet: NotionEditor sends a focus command on
           dismissal, so the replace command lands as the final command in the batch. */
        onDismiss();
        await onReplaceImage?.(uri);
    }, [ onDismiss, onReplaceImage ]);

    const handleColor = useCallback((color: NotionMarkdownColor | undefined) =>
    {
        setChoosingColor(false);
        onColor?.(color);
    }, [ onColor ]);

    const colorOptions = useMemo(() => ({
        background: calloutBackgroundColors,
        text: calloutTextColors
    }), [ ]);

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
                    <View style={ styles.header }>
                        {
                            choosingColor && <Pressable
                                accessibilityLabel={ labels.title }
                                accessibilityRole="button"
                                onPress={ () => setChoosingColor(false) }
                                style={ styles.backButton }>
                                {
                                    createElement(getActionIcon("back", components), {
                                        color: muted,
                                        size: 22,
                                        strokeWidth: 2
                                    })
                                }
                            </Pressable>
                        }
                        <Text accessibilityRole="header"
                            style={ [ styles.title, { color: foreground } ] }>
                            { choosingColor ? labels.chooseColor : labels.title }
                        </Text>
                    </View>
                    {
                        choosingColor
                            ? <View style={ styles.colorContent }>
                                <Text style={ [ styles.sectionTitle, { color: muted } ] }>
                                    { labels.text }
                                </Text>
                                <View style={ styles.colorGrid }>
                                    { colorOptions.text.map((option: CalloutColorOption) =>
                                        <ColorOption
                                            dark={ dark }
                                            defaultLabel={ labels.defaultColor }
                                            key={ option.color ?? "text-default" }
                                            onPress={ () => handleColor(option.color) }
                                            option={ option } />) }
                                </View>
                                <Text style={ [ styles.sectionTitle, { color: muted } ] }>
                                    { labels.background }
                                </Text>
                                <View style={ styles.colorGrid }>
                                    { colorOptions.background.map((option: CalloutColorOption) =>
                                        <ColorOption
                                            dark={ dark }
                                            defaultLabel={ labels.defaultColor }
                                            key={ option.color ?? "background-default" }
                                            onPress={ () => handleColor(option.color) }
                                            option={ option } />) }
                                </View>
                            </View>
                            : <>
                                <Text style={ [ styles.blockNameLabel, { color: muted } ] }>{ blockName }</Text>
                                {
                                    showCalloutActions && <View style={ [
                                        styles.options,
                                        { backgroundColor: optionSurface, borderColor: divider }
                                    ] }>
                                        <ActionOption
                                            color={ muted }
                                            icon={ getActionIcon("color", components) }
                                            label={ labels.color }
                                            onPress={ () => setChoosingColor(true) } />
                                        <View style={ [ styles.divider, { backgroundColor: divider } ] } />
                                        <ActionOption
                                            color={ muted }
                                            icon={ getActionIcon("edit", components) }
                                            label={ labels.editIcon }
                                            onPress={ () => { } } />
                                    </View> }
                                { showCalloutActions && <View style={ styles.groupGap } /> }
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
                                {
                                    showReplaceImage && <>
                                        <View style={ styles.groupGap } />
                                        <View style={ [
                                            styles.options,
                                            { backgroundColor: optionSurface, borderColor: divider }
                                        ] }>
                                            <ActionOption
                                                color={ muted }
                                                icon={ getActionIcon("gallery", components) }
                                                label={ labels.openGallery }
                                                onPress={ () => void handleReplace("gallery") } />
                                            <View style={ [ styles.divider, { backgroundColor: divider } ] } />
                                            <ActionOption
                                                color={ muted }
                                                icon={ getActionIcon("picture", components) }
                                                label={ labels.takePicture }
                                                onPress={ () => void handleReplace("picture") } />
                                        </View>
                                    </>
                                }
                                <View style={ styles.groupGap } />
                                <View style={ [
                                    styles.options,
                                    { backgroundColor: optionSurface, borderColor: divider }
                                ] }>
                                    {
                                        !showCalloutActions && <>
                                            <ActionOption
                                                color={ muted }
                                                icon={ getActionIcon("copy", components) }
                                                label={ labels.duplicate }
                                                onPress={ () => onAction("duplicate") } />
                                            <View style={ [ styles.divider, { backgroundColor: divider } ] } />
                                        </>
                                    }
                                    <ActionOption
                                        color={ danger }
                                        icon={ getActionIcon("remove", components) }
                                        label={ labels.delete }
                                        onPress={ () => onAction("delete") } />
                                </View>
                            </>
                    }
                </View>
            </View>
        </View>
    </Modal>;
}

const styles = StyleSheet.create({
    backButton:
    {
        alignItems: "center",
        height: 40,
        justifyContent: "center",
        left: 0,
        position: "absolute",
        top: -6,
        width: 40,
        zIndex: 1
    },
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
    colorContent:
    {
        paddingTop: 4
    },
    colorGrid:
    {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 18
    },
    colorOption:
    {
        alignItems: "center",
        gap: 4,
        minWidth: 48,
        paddingVertical: 4
    },
    colorOptionLabel:
    {
        fontSize: 10,
        textTransform: "capitalize"
    },
    colorSwatch:
    {
        alignItems: "center",
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        height: 32,
        justifyContent: "center",
        width: 32
    },
    colorSwatchText:
    {
        fontSize: 18,
        fontWeight: "600"
    },
    divider:
    {
        height: StyleSheet.hairlineWidth
    },
    groupGap:
    {
        height: 12
    },
    header:
    {
        alignItems: "center",
        minHeight: 34,
        justifyContent: "center"
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
    sectionTitle:
    {
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 8,
        textTransform: "uppercase"
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
