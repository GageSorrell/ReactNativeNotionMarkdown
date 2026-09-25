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
 * This module is loaded lazily by `MarkdownEditor`. Keeping the Expo ImagePicker import here means
 * applications that provide their own `onInsertMedia` handler do not need to install that peer.
 */

import * as ImagePicker from "expo-image-picker";
import { CameraIcon, GalleryIcon, VideoIcon } from "./mediaIcons.tsx";
import type { MarkdownEditorIconProps, MarkdownEditorIcons } from "./customization.ts";
import type { MarkdownEditorMediaAction, MarkdownEditorMediaSelection } from "./MarkdownEditor.tsx";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useCallback, useMemo } from "react";
import type { ComponentType } from "react";
import { editorFontStyle } from "./customization.ts";
import { useResolvedEditorConfig } from "../../provider/MarkdownProvider.tsx";
import { withAlpha } from "../../provider/theme.ts";

/** Public props for the native insert-media sheet. */
export interface MediaBottomSheetProps
{
    readonly onDismiss: () => void;
    readonly onSelected: (selection: MarkdownEditorMediaSelection) => void | Promise<void>;
    readonly labels: {
        readonly captureVideo: string;
        readonly dismiss: string;
        readonly openGallery: string;
        readonly takePicture: string;
        readonly title: string;
    };
}

interface MediaOptionProps
{
    readonly action: MarkdownEditorMediaAction;
    readonly color: string;
    readonly fontFamily?: string;
    readonly icon: ComponentType<MarkdownEditorIconProps>;
    readonly label: string;
    readonly onPress: (action: MarkdownEditorMediaAction) => void;
}

type LucideModule = Record<string, ComponentType<MarkdownEditorIconProps>> &
{
    readonly default?: Record<string, ComponentType<MarkdownEditorIconProps>>;
};

const lucideNames: Readonly<Record<MarkdownEditorMediaAction, string>> =
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
    action: MarkdownEditorMediaAction,
    icons: MarkdownEditorIcons | undefined
): ComponentType<MarkdownEditorIconProps>
{
    const override = icons?.[action];

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
function MediaOption({ action, color, fontFamily, icon: Icon, label, onPress }: MediaOptionProps)
{
    const optionStyle = useCallback(({ pressed }: { pressed: boolean }) => [
        styles.option,
        pressed
            ? { backgroundColor: withAlpha(color, 0.07) }
            : undefined
    ], [ color ]);
    const ripple = useMemo(() => ({ color: withAlpha(color, 0.13) }), [ color ]);
    const labelStyle = useMemo(() => [ styles.optionLabel, { color, fontFamily } ], [ color, fontFamily ]);

    return <Pressable accessibilityLabel={ label }
        accessibilityRole="button"
        android_ripple={ ripple }
        onPress={ () => onPress(action) }
        style={ optionStyle }>
        <Icon
            color={ color }
            size={ 20 }
            strokeWidth={ 1.75 }
        />
        <Text style={ labelStyle }>{ label }</Text>
    </Pressable>;
}

/** Convert Expo's picker result to the package's dependency-free public shape. */
function normalizeSelection(
    action: MarkdownEditorMediaAction,
    result: ImagePicker.ImagePickerResult
): MarkdownEditorMediaSelection
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
export function MediaBottomSheet({ labels, onDismiss, onSelected }: MediaBottomSheetProps)
{
    const { config, theme } = useResolvedEditorConfig();
    const { icons } = config;
    const { sheet } = theme.editor;
    const { fontFamily } = editorFontStyle(theme.editor);
    const foreground = sheet.foreground;
    const muted = sheet.muted;
    const surface = sheet.background;
    const optionSurface = sheet.card;
    const divider = sheet.divider;
    const scrim = sheet.scrim;

    const handleAction = useCallback(async (action: MarkdownEditorMediaAction) =>
    {
        const result = action === "gallery"
            ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: [ "images", "videos" ] })
            : await ImagePicker.launchCameraAsync({
                mediaTypes: action === "picture" ? [ "images" ] : [ "videos" ]
            });

        /* Close first: MarkdownEditor sends a focus command on dismissal. Sending the selected
           asset afterwards keeps insertImage/insertVideo as the final command in the batch. */
        onDismiss();
        await onSelected(normalizeSelection(action, result));
    }, [ onDismiss, onSelected ]);

    const scrimStyle = useMemo(() => [ styles.scrim, { backgroundColor: scrim } ], [ scrim ]);
    const sheetStyle = useMemo(() => [ styles.sheet, { backgroundColor: surface } ], [ surface ]);
    const titleStyle = useMemo(
        () => [ styles.title, { color: foreground, fontFamily } ],
        [ fontFamily, foreground ]
    );
    const galleryIcon = useMemo(() => getMediaIcon("gallery", icons), [ icons ]);
    const pictureIcon = useMemo(() => getMediaIcon("picture", icons), [ icons ]);
    const videoIcon = useMemo(() => getMediaIcon("video", icons), [ icons ]);
    const optionsStyle = useMemo(() => [
        styles.options,
        { backgroundColor: optionSurface, borderColor: divider }
    ], [ divider, optionSurface ]);
    const dividerStyle = useMemo(() => [ styles.divider, { backgroundColor: divider } ], [ divider ]);

    return <Modal
        animationType="slide"
        navigationBarTranslucent
        onRequestClose={ onDismiss }
        statusBarTranslucent
        transparent
        visible>
        <View style={ styles.modalRoot }>
            <Pressable
                accessibilityLabel={ labels.dismiss }
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
                    <View style={ optionsStyle }>
                        <MediaOption action="gallery"
                            color={ muted }
                            fontFamily={ fontFamily }
                            icon={ galleryIcon }
                            label={ labels.openGallery }
                            onPress={ handleAction } />
                        <View style={ dividerStyle } />
                        <MediaOption action="picture"
                            color={ muted }
                            fontFamily={ fontFamily }
                            icon={ pictureIcon }
                            label={ labels.takePicture }
                            onPress={ handleAction } />
                        <View style={ dividerStyle } />
                        <MediaOption action="video"
                            color={ muted }
                            fontFamily={ fontFamily }
                            icon={ videoIcon }
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
