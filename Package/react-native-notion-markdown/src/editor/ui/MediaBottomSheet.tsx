/**
 * Lazily loaded native insert-media bottom sheet.
 *
 * @module react-native-notion-markdown/editor/ui/MediaBottomSheet
 *
 * @file      MediaBottomSheet.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Optional native insert-media sheet.
 *
 * This module is loaded lazily by `NotionEditor`. Keeping the Expo ImagePicker import here means
 * applications that provide their own `onInsertMedia` handler do not need to install that peer.
 */

import * as ImagePicker from "expo-image-picker";
import { CameraIcon, GalleryIcon, VideoIcon } from "./mediaIcons.tsx";
import { Modal, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import type {
    NotionEditorComponents,
    NotionEditorIconProps,
    NotionEditorMediaAction,
    NotionEditorMediaSelection
} from "./NotionEditor.tsx";
import type { ComponentType } from "react";
import { useCallback } from "react";

/** Public props for the native insert-media sheet. */
export interface MediaBottomSheetProps
{
    readonly components?: NotionEditorComponents;
    readonly onDismiss: () => void;
    readonly onSelected: (selection: NotionEditorMediaSelection) => void | Promise<void>;
    readonly labels: {
        readonly captureVideo: string;
        readonly openGallery: string;
        readonly takePicture: string;
        readonly title: string;
    };
}

interface MediaOptionProps
{
    readonly action: NotionEditorMediaAction;
    readonly color: string;
    readonly icon: ComponentType<NotionEditorIconProps>;
    readonly label: string;
    readonly onPress: (action: NotionEditorMediaAction) => void;
}

type LucideModule = Record<string, ComponentType<NotionEditorIconProps>> &
{
    readonly default?: Record<string, ComponentType<NotionEditorIconProps>>;
};

const lucideNames: Readonly<Record<NotionEditorMediaAction, string>> =
    {
        gallery: "Image",
        picture: "Camera",
        video: "SquarePlay"
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
function getMediaIcon(
    action: NotionEditorMediaAction,
    components: MediaBottomSheetProps["components"]
): ComponentType<NotionEditorIconProps>
{
    const override = components?.[action];

    if (override !== undefined)
    {
        return override;
    }

    const lucideIcon = getLucideIcons()?.[lucideNames[action]];

    if (lucideIcon !== undefined)
    {
        return lucideIcon;
    }

    return action === "gallery"
        ? GalleryIcon
        : action === "picture" ? CameraIcon : VideoIcon;
}

/** Render one labeled media action. */
function MediaOption({ action, color, icon: Icon, label, onPress }: MediaOptionProps)
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
        onPress={ () => onPress(action) }
        style={ optionStyle }>
        <Icon
            color={ color }
            size={ 20 }
            strokeWidth={ 1.75 }
        />
        <Text style={ [ styles.optionLabel, { color } ] }>{ label }</Text>
    </Pressable>;
}

/** Convert Expo's picker result to the package's dependency-free public shape. */
function normalizeSelection(
    action: NotionEditorMediaAction,
    result: ImagePicker.ImagePickerResult
): NotionEditorMediaSelection
{
    return {
        action,
        assets: result.canceled
            ? undefined
            : result.assets?.map((asset: ImagePicker.ImagePickerAsset) => ({
                duration: asset.duration,
                fileName: asset.fileName,
                fileSize: asset.fileSize,
                height: asset.height,
                mimeType: asset.mimeType,
                type: asset.type,
                uri: asset.uri,
                width: asset.width
            })),
        canceled: result.canceled
    };
}

/** Render the native insert-media sheet. */
export function MediaBottomSheet({ components, labels, onDismiss, onSelected }: MediaBottomSheetProps)
{
    const dark = useColorScheme() === "dark";
    const foreground = dark ? "#F5F5F5" : "#2C2C2B";
    const muted = dark ? "#D0CDC7" : "#45433F";
    const surface = dark ? "#202020" : "#F9F8F6";
    const optionSurface = dark ? "#30302F" : "#FFFFFF";
    const divider = dark ? "rgba(255, 255, 255, 0.10)" : "#EEECE9";
    const scrim = dark ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.25)";

    const handleAction = useCallback(async (action: NotionEditorMediaAction) =>
    {
        const result = action === "gallery"
            ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: [ "images", "videos" ] })
            : await ImagePicker.launchCameraAsync({
                mediaTypes: action === "picture" ? [ "images" ] : [ "videos" ]
            });

        try
        {
            await onSelected(normalizeSelection(action, result));
        }
        finally
        {
            onDismiss();
        }
    }, [ onDismiss, onSelected ]);

    return <Modal
        animationType="slide"
        navigationBarTranslucent
        onRequestClose={ onDismiss }
        statusBarTranslucent
        transparent
        visible>
        <View style={ styles.modalRoot }>
            <Pressable
                accessibilityLabel="Dismiss insert media"
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
                    <View style={ [
                        styles.options,
                        { backgroundColor: optionSurface, borderColor: divider }
                    ] }>
                        <MediaOption action="gallery"
                            color={ muted }
                            icon={ getMediaIcon("gallery", components) }
                            label={ labels.openGallery }
                            onPress={ handleAction } />
                        <View style={ [ styles.divider, { backgroundColor: divider } ] } />
                        <MediaOption action="picture"
                            color={ muted }
                            icon={ getMediaIcon("picture", components) }
                            label={ labels.takePicture }
                            onPress={ handleAction } />
                        <View style={ [ styles.divider, { backgroundColor: divider } ] } />
                        <MediaOption action="video"
                            color={ muted }
                            icon={ getMediaIcon("video", components) }
                            label={ labels.captureVideo }
                            onPress={ handleAction } />
                    </View>
                </View>
            </View>
        </View>
    </Modal>;
}

const styles = StyleSheet.create({
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
