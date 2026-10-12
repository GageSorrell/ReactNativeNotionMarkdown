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
import {
    Animated,
    Easing,
    type GestureResponderEvent,
    type LayoutChangeEvent,
    Modal,
    PanResponder,
    type PanResponderGestureState,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    View,
    useWindowDimensions
} from "react-native";
import { CameraIcon, GalleryIcon } from "./mediaIcons.tsx";
import { ChevronRightActionIcon, CopyActionIcon, TrashActionIcon } from "./actionIcons.tsx";
import { type ComponentType, createElement } from "react";
import {
    type EditorColorChoice,
    type MarkdownEditorIconProps,
    type MarkdownEditorIcons,
    editorColorChoices,
    editorFontStyle
} from "./customization.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorBlockActionScope } from "../../prototype.ts";
import type { MarkdownColor } from "../../document/types.ts";
import type { MarkdownEditorAudioAction } from "./MarkdownEditor.tsx";
import { Switch } from "./Switch.tsx";
import { useResolvedEditorConfig } from "../../provider/MarkdownProvider.tsx";
import { withAlpha } from "../../provider/theme.ts";

/** An action selected in the built-in block-actions sheet. */
export type MarkdownEditorBlockAction = "delete" | "duplicate" | "insertAbove" | "insertBelow";

/** An action selected in the built-in table-actions section. */
export type MarkdownEditorTableAction =
    | "toggleFitTableWidth"
    | "toggleHeaderRow"
    | "toggleHeaderColumn"
    | "insertTableRowAbove"
    | "insertTableRowBelow"
    | "insertTableColumnLeft"
    | "insertTableColumnRight"
    | "deleteTableRow"
    | "deleteTableColumn"
    | "clearTableContents"
    | "clearTableRow"
    | "clearTableColumn"
    | "clearTableCells";

/** Public props for the built-in block-actions sheet. */
export interface ActionsBottomSheetProps
{
    /** Translated display name of the target block, e.g. "Divider". */
    readonly blockName: string;
    readonly labels: {
        readonly delete: string;
        readonly dismiss: string;
        readonly duplicate: string;
        readonly fitTableWidth: string;
        readonly headerRow: string;
        readonly headerColumn: string;
        readonly insertTableRowAbove: string;
        readonly insertTableRowBelow: string;
        readonly insertTableColumnLeft: string;
        readonly insertTableColumnRight: string;
        readonly deleteTableRow: string;
        readonly deleteTableColumn: string;
        readonly clearTableContents: string;
        readonly color: string;
        readonly editIcon: string;
        readonly chooseColor: string;
        readonly text: string;
        readonly background: string;
        readonly defaultColor: string;
        readonly insertAbove: string;
        readonly insertBelow: string;
        readonly openGallery: string;
        readonly chooseAudio: string;
        readonly recordAudio: string;
        readonly takePicture: string;
        readonly title: string;
    };
    readonly onAction: (action: MarkdownEditorBlockAction) => void;
    readonly onTableAction?: (action: MarkdownEditorTableAction) => void;
    readonly onTableColor?: (color: MarkdownColor | undefined) => void;
    readonly tableActionScope?: EditorBlockActionScope;
    readonly tableFitPageWidth?: boolean;
    readonly onDismiss: () => void;
    /** Opens the callout emoji picker from the callout action sheet. */
    readonly onEditIcon?: () => void;
    /** Called when a block-level color is selected. */
    readonly onColor?: (color: MarkdownColor | undefined) => void;
    /** Called with the picked asset's local URI once a replacement image is chosen. */
    readonly onReplaceImage?: (url: string) => void | Promise<void>;
    /** Opens the shared audio workflow in replacement mode. */
    readonly onReplaceAudio?: (action: MarkdownEditorAudioAction) => void;
    /** Hidden for block types (the divider) that can't take content above themselves. */
    readonly showInsertAbove: boolean;
    /** Callout actions use the Markdown-specific color/icon layout. */
    readonly showCalloutActions?: boolean;
    /** Shows the block-level color action for other colorable blocks. */
    readonly showBlockColorActions?: boolean;
    /** Shows the built-in table operations for a table block. */
    readonly showTableActions?: boolean;
    /** Shown only for the image block -- offers to replace its source via gallery or camera. */
    readonly showReplaceImage: boolean;
    /** Shown only for audio blocks. */
    readonly showReplaceAudio?: boolean;
}

interface ActionOptionProps
{
    readonly color: string;
    readonly icon?: ComponentType<MarkdownEditorIconProps>;
    readonly label: string;
    readonly onPress: () => void;
    readonly trailingIcon?: ComponentType<MarkdownEditorIconProps>;
    readonly trailingIconColor?: string;
}

interface ActionSwitchOptionProps
{
    readonly color: string;
    readonly icon: ComponentType<MarkdownEditorIconProps>;
    readonly label: string;
    readonly onValueChange: (value: boolean) => void;
    readonly value: boolean;
}

type LucideModule = Record<string, ComponentType<MarkdownEditorIconProps>> &
{
    readonly default?: Record<string, ComponentType<MarkdownEditorIconProps>>;
};

const lucideNames: Readonly<Record<
    "audio" | "back" | "clearContents" | "color" | "copy" | "edit" | "fitTableWidth" | "gallery"
    | "headerColumn" | "headerRow" | "insertAbove" | "insertBelow" | "insertLeft" | "insertRight"
    | "more" | "picture" | "remove" | "table" | "chevronRight", string
>> =
    {
        audio: "AudioLines",
        back: "ChevronLeft",
        chevronRight: "ChevronRight",
        clearContents: "CircleX",
        color: "Palette",
        copy: "Copy",
        edit: "Pencil",
        fitTableWidth: "MoveHorizontal",
        gallery: "Image",
        headerColumn: "PanelLeft",
        headerRow: "PanelTop",
        insertAbove: "ArrowUp",
        insertBelow: "ArrowDown",
        insertLeft: "ArrowLeft",
        insertRight: "ArrowRight",
        more: "Ellipsis",
        picture: "Camera",
        remove: "Trash2",
        table: "Table2"
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
    "audio" | "back" | "clearContents" | "color" | "copy" | "edit" | "fitTableWidth" | "gallery"
    | "headerColumn" | "headerRow" | "insertAbove" | "insertBelow" | "insertLeft" | "insertRight"
    | "more" | "picture" | "remove" | "table" | "chevronRight",
    ComponentType<MarkdownEditorIconProps>>> =
    {
        audio: CopyActionIcon,
        back: CopyActionIcon,
        chevronRight: ChevronRightActionIcon,
        clearContents: CopyActionIcon,
        color: CopyActionIcon,
        copy: CopyActionIcon,
        edit: CopyActionIcon,
        fitTableWidth: CopyActionIcon,
        gallery: GalleryIcon,
        headerColumn: CopyActionIcon,
        headerRow: CopyActionIcon,
        insertAbove: CopyActionIcon,
        insertBelow: CopyActionIcon,
        insertLeft: CopyActionIcon,
        insertRight: CopyActionIcon,
        more: CopyActionIcon,
        picture: CameraIcon,
        remove: TrashActionIcon,
        table: CopyActionIcon
    };

/** Resolve an override, an installed Lucide icon, or the dependency-free SVG fallback. */
function getActionIcon(
    button: keyof typeof lucideNames,
    icons: MarkdownEditorIcons | undefined
): ComponentType<MarkdownEditorIconProps>
{
    const override = icons?.[button as keyof MarkdownEditorIcons];

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
function ActionOption({
    color,
    icon: Icon,
    label,
    onPress,
    trailingIcon: TrailingIcon,
    trailingIconColor
}: ActionOptionProps)
{
    const { theme } = useResolvedEditorConfig();
    const { fontFamily } = editorFontStyle(theme.editor);
    const optionStyle = useCallback(({ pressed }: { pressed: boolean }) => [
        styles.option,
        pressed
            ? { backgroundColor: withAlpha(color, 0.07) }
            : undefined
    ], [ color ]);
    const labelStyle = useMemo(
        () => [ styles.optionLabel, styles.optionLabelExpanded, { color, fontFamily } ],
        [ color, fontFamily ]
    );
    const ripple = useMemo(() => ({ color: withAlpha(color, 0.13) }), [ color ]);

    return <Pressable accessibilityLabel={ label }
        accessibilityRole="button"
        android_ripple={ ripple }
        onPress={ onPress }
        style={ optionStyle }>
        {
            Icon !== undefined && <Icon
                color={ color }
                size={ 20 }
                strokeWidth={ 1.75 } />
        }
        <Text style={ labelStyle }>{ label }</Text>
        {
            TrailingIcon !== undefined && <View style={ styles.trailingIcon }>
                <TrailingIcon
                    color={ trailingIconColor ?? theme.editor.sheet.subtle }
                    size={ 18 }
                    strokeWidth={ 2 } />
            </View>
        }
    </Pressable>;
}

/** Render a switch row with the same dimensions and spacing as an action button. */
function ActionSwitchOption({
    color,
    icon: Icon,
    label,
    onValueChange,
    value
}: ActionSwitchOptionProps)
{
    const { theme } = useResolvedEditorConfig();
    const { fontFamily } = editorFontStyle(theme.editor);
    const labelStyle = useMemo(
        () => [ styles.optionLabel, styles.optionLabelExpanded, { color, fontFamily } ],
        [ color, fontFamily ]
    );

    return <View style={ styles.option }>
        <Icon
            color={ color }
            size={ 20 }
            strokeWidth={ 1.75 }
        />
        <Text style={ labelStyle }>{ label }</Text>
        <Switch
            accessibilityLabel={ label }
            onValueChange={ onValueChange }
            size="medium"
            value={ value } />
    </View>;
}

/** Render one selectable callout or table foreground/background color. */
function ColorOption({
    choice,
    onSelect
}: {
    readonly choice: EditorColorChoice;
    readonly onSelect: (color: MarkdownColor | undefined) => void;
})
{
    const { theme } = useResolvedEditorConfig();
    const { sheet } = theme.editor;
    const { fontFamily } = editorFontStyle(theme.editor);
    const hueText = choice.hue === undefined ? undefined : theme.palette.text[ choice.hue ];
    const swatchBackground = choice.hue === undefined
        ? sheet.card
        : choice.background ? theme.palette.background[ choice.hue ] : sheet.card;
    const swatchStyle = useMemo(() => [
        styles.colorSwatch,
        { backgroundColor: swatchBackground, borderColor: hueText ?? sheet.muted }
    ], [ hueText, sheet.muted, swatchBackground ]);
    const swatchTextStyle = useMemo(
        () => [ styles.colorSwatchText, { color: hueText ?? sheet.foreground, fontFamily } ],
        [ fontFamily, hueText, sheet.foreground ]
    );
    const labelStyle = useMemo(
        () => [ styles.colorOptionLabel, { color: sheet.foreground, fontFamily } ],
        [ fontFamily, sheet.foreground ]
    );
    const handlePress = useCallback(() => onSelect(choice.color), [ choice.color, onSelect ]);

    return <Pressable accessibilityLabel={ choice.accessibilityLabel }
        accessibilityRole="button"
        onPress={ handlePress }
        style={ styles.colorOption }>
        <View style={ swatchStyle }>
            <Text style={ swatchTextStyle }>A</Text>
        </View>
        <Text style={ labelStyle }>
            { choice.label }
        </Text>
    </Pressable>;
}

/** A resting position of the sheet. */
type SheetSnap = "full" | "half";

/** The sheet's `translateY` at each resting position, and when fully dismissed. */
type SheetSnapPoints = Readonly<Record<SheetSnap | "closed", number>>;

/** Gap left between the status bar and the top of the fully-expanded sheet. */
const sheetTopGap = 8;

/** Fraction of the screen covered by the sheet at its half-height snap point. */
const halfSnapFraction = 0.5;

/** How far ahead (in ms) a release's velocity is projected when picking the snap point. */
const flingProjectionMs = 120;

/** Vertical travel (in px) before a drag is taken from the sheet's rows. */
const dragSlop = 8;

/** Downward speed (in px/ms) at which releasing the handlebar counts as a swipe. */
const handlebarFlingVelocity = 0.2;

/** Height of the sheet at its full-height snap point, within a modal of `containerHeight`. */
function getSheetHeight(containerHeight: number): number
{
    return Math.max(0, containerHeight - (StatusBar.currentHeight ?? 0) - sheetTopGap);
}

/** Resolve each snap point's `translateY` within a modal of `containerHeight`. */
function getSnapPoints(containerHeight: number): SheetSnapPoints
{
    const sheetHeight = getSheetHeight(containerHeight);

    return {
        closed: sheetHeight,
        full: 0,
        half: Math.max(0, sheetHeight - containerHeight * halfSnapFraction)
    };
}

/** Whether a move is a deliberate vertical drag, rather than a tap or horizontal motion. */
function isVerticalDrag(gesture: PanResponderGestureState): boolean
{
    return Math.abs(gesture.dy) > dragSlop && Math.abs(gesture.dy) > Math.abs(gesture.dx);
}

/** Render the built-in block-actions sheet. */
export function ActionsBottomSheet({
    blockName,
    labels,
    onAction: InOnAction,
    onTableAction: InOnTableAction,
    onTableColor,
    onDismiss,
    onEditIcon,
    onColor,
    onReplaceImage,
    onReplaceAudio: InOnReplaceAudio,
    showInsertAbove,
    showCalloutActions = false,
    showBlockColorActions = false,
    showTableActions = false,
    tableActionScope = "table",
    tableFitPageWidth = false,
    showReplaceImage,
    showReplaceAudio = false
}: ActionsBottomSheetProps)
{
    const tableAction = useCallback((action: MarkdownEditorTableAction) =>
    {
        return () => InOnTableAction?.(action);
    }, [ InOnTableAction ]);

    const onReplaceAudio = useCallback((action: MarkdownEditorAudioAction) =>
    {
        return () => InOnReplaceAudio?.(action);
    }, [ InOnReplaceAudio ]);

    const onAction = useCallback((action: MarkdownEditorBlockAction) =>
    {
        return () => InOnAction?.(action);
    }, [ InOnAction ]);

    const [ choosingColor, setChoosingColor ] = useState(false);
    const [ choosingTableColor, setChoosingTableColor ] = useState(false);
    const { config, t, theme } = useResolvedEditorConfig();
    const { icons } = config;
    const { sheet } = theme.editor;
    const { fontFamily } = editorFontStyle(theme.editor);
    const foreground = sheet.foreground;
    const muted = sheet.muted;
    const surface = sheet.background;
    const optionSurface = sheet.card;
    const divider = sheet.divider;
    const scrim = sheet.scrim;
    const handlebarColor = sheet.handle;
    const danger = theme.document.danger;

    const { height: windowHeight } = useWindowDimensions();
    const [ containerHeight, setContainerHeight ] = useState<number>();
    /* Starts off-screen; the sheet slides up to full height once the modal has been measured. */
    const [ translateY ] = useState(() => new Animated.Value(windowHeight));
    const snapPoints = useRef<SheetSnapPoints | undefined>(undefined);
    const currentSnap = useRef<SheetSnap>("full");
    const dragOrigin = useRef(windowHeight);
    const dismissing = useRef(false);
    const onDismissRef = useRef(onDismiss);

    useEffect(() =>
    {
        onDismissRef.current = onDismiss;
    }, [ onDismiss ]);

    const animateTo = useCallback((snap: SheetSnap, velocity: number = 0) =>
    {
        const points = snapPoints.current;
        if (points === undefined) { return; }

        currentSnap.current = snap;
        dragOrigin.current = points[ snap ];
        Animated.spring(translateY, {
            damping: 28,
            mass: 0.8,
            overshootClamping: true,
            stiffness: 260,
            toValue: points[ snap ],
            useNativeDriver: true,
            /* Gesture velocity is px/ms; the spring expects px/s. */
            velocity: velocity * 1000
        }).start();
    }, [ translateY ]);

    const closeSheet = useCallback(() =>
    {
        if (dismissing.current) { return; }
        dismissing.current = true;

        const points = snapPoints.current;
        if (points === undefined)
        {
            onDismissRef.current();
            return;
        }

        Animated.timing(translateY, {
            duration: 180,
            easing: Easing.out(Easing.quad),
            toValue: points.closed,
            useNativeDriver: true
        }).start(() => onDismissRef.current());
    }, [ translateY ]);

    /** Settle a released drag on the snap point nearest its velocity-projected position. */
    const settle = useCallback((position: number, velocity: number) =>
    {
        const points = snapPoints.current;
        if (points === undefined) { return; }

        const projected = position + velocity * flingProjectionMs;
        const nearest = ([ "full", "half", "closed" ] as const).reduce(
            (best: keyof SheetSnapPoints, snap: keyof SheetSnapPoints) =>
                Math.abs(points[ snap ] - projected) < Math.abs(points[ best ] - projected) ? snap : best
        );

        if (nearest === "closed")
        {
            closeSheet();
        }
        else
        {
            animateTo(nearest, velocity);
        }
    }, [ animateTo, closeSheet ]);

    const shouldDrag = useCallback(
        (_event: GestureResponderEvent, gesture: PanResponderGestureState) =>
            !dismissing.current && isVerticalDrag(gesture),
        [ ]
    );
    const handleDragGrant = useCallback(() =>
    {
        translateY.stopAnimation((value: number) =>
        {
            dragOrigin.current = value;
        });
    }, [ translateY ]);
    const handleDragMove = useCallback(
        (_event: GestureResponderEvent, gesture: PanResponderGestureState) =>
        {
            /* The full-height snap point is the top limit. */
            translateY.setValue(Math.max(0, dragOrigin.current + gesture.dy));
        },
        [ translateY ]
    );
    const handleDragEnd = useCallback(
        (_event: GestureResponderEvent, gesture: PanResponderGestureState) =>
            settle(Math.max(0, dragOrigin.current + gesture.dy), gesture.vy),
        [ settle ]
    );
    /* PanResponder.create only stores these handlers; they read refs during gestures, never
       during render, which the compiler can't see through the call. */
    /* eslint-disable-next-line react-hooks/refs */
    const panResponder = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: shouldDrag,
        /* Capture so a vertical drag that starts on an action row moves the sheet instead. */
        onMoveShouldSetPanResponderCapture: shouldDrag,
        onPanResponderGrant: handleDragGrant,
        onPanResponderMove: handleDragMove,
        onPanResponderRelease: handleDragEnd,
        onPanResponderTerminate: handleDragEnd,
        onPanResponderTerminationRequest: () => false
    }), [ handleDragEnd, handleDragGrant, handleDragMove, shouldDrag ]);

    /* The handlebar takes its gesture from the first touch, and a downward swipe on it always
       dismisses the sheet -- unlike a drag on the sheet's body, which settles on the nearest
       snap point and so stops at half height first. */
    const claimHandlebar = useCallback(() => !dismissing.current, [ ]);
    const handleHandlebarEnd = useCallback(
        (_event: GestureResponderEvent, gesture: PanResponderGestureState) =>
        {
            if (gesture.dy > dragSlop && gesture.vy >= 0
                || gesture.vy > handlebarFlingVelocity)
            {
                closeSheet();
            }
            else
            {
                settle(Math.max(0, dragOrigin.current + gesture.dy), gesture.vy);
            }
        },
        [ closeSheet, settle ]
    );
    /* eslint-disable-next-line react-hooks/refs */
    const handlebarResponder = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: claimHandlebar,
        onPanResponderGrant: handleDragGrant,
        onPanResponderMove: handleDragMove,
        onPanResponderRelease: handleHandlebarEnd,
        onPanResponderTerminate: handleHandlebarEnd,
        /* Otherwise the sheet's own responder captures the drag as soon as it moves. */
        onPanResponderTerminationRequest: () => false,
        onStartShouldSetPanResponder: claimHandlebar
    }), [ claimHandlebar, handleDragGrant, handleDragMove, handleHandlebarEnd ]);

    const handleLayout = useCallback((event: LayoutChangeEvent) =>
    {
        setContainerHeight(event.nativeEvent.layout.height);
    }, [ ]);

    useEffect(() =>
    {
        if (containerHeight === undefined || dismissing.current) { return; }

        const points = getSnapPoints(containerHeight);
        const opening = snapPoints.current === undefined;
        snapPoints.current = points;

        if (opening)
        {
            translateY.setValue(points.closed);
            animateTo("full");
        }
        else
        {
            /* E.g. a rotation: stay on the same snap point at the new size. */
            dragOrigin.current = points[ currentSnap.current ];
            translateY.setValue(points[ currentSnap.current ]);
        }
    }, [ animateTo, containerHeight, translateY ]);

    const sheetHeight = containerHeight === undefined
        ? windowHeight
        : getSheetHeight(containerHeight);
    /* The scrim stays fully opaque down to the half-height snap point, then fades out with the
       sheet as it is dragged toward dismissal. */
    const scrimOpacity = useMemo(() =>
    {
        if (containerHeight === undefined) { return 0; }

        const points = getSnapPoints(containerHeight);

        return translateY.interpolate({
            extrapolate: "clamp",
            inputRange: [ points.half, Math.max(points.half + 1, points.closed) ],
            outputRange: [ 1, 0 ]
        });
    }, [ containerHeight, translateY ]);

    const handleReplace = useCallback(async (action: "gallery" | "picture") =>
    {
        const result = action === "gallery"
            ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: [ "images" ] })
            : await ImagePicker.launchCameraAsync({ mediaTypes: [ "images" ] });

        if (result.canceled) { return; }
        const uri = result.assets?.[ 0 ]?.uri;
        if (uri === undefined) { return; }

        /* Close first, matching MediaBottomSheet: MarkdownEditor sends a focus command on
           dismissal, so the replace command lands as the final command in the batch. */
        onDismiss();
        await onReplaceImage?.(uri);
    }, [ onDismiss, onReplaceImage ]);

    const onHandleReplace = useCallback((action: "gallery" | "picture") =>
    {
        return () => void handleReplace(action);
    }, [ handleReplace ]);

    const handleColor = useCallback((color: MarkdownColor | undefined) =>
    {
        setChoosingColor(false);
        if (choosingTableColor)
        {
            setChoosingTableColor(false);
            onTableColor?.(color);
        }
        else
        {
            onColor?.(color);
        }
    }, [ choosingTableColor, onColor, onTableColor ]);
    const handleTableColor = useCallback(() =>
    {
        setChoosingTableColor(true);
        setChoosingColor(true);
    }, [ ]);
    const handleEditIcon = useCallback(() => onEditIcon?.(), [ onEditIcon ]);

    const colorOptions = useMemo(
        () => editorColorChoices(config.colorPanel, t, labels.defaultColor),
        [ config.colorPanel, labels.defaultColor, t ]
    );
    const scrimStyle = useMemo(
        () => [ styles.scrim, { backgroundColor: scrim, opacity: scrimOpacity } ],
        [ scrim, scrimOpacity ]
    );
    const sheetStyle = useMemo(() => [
        styles.sheet,
        { backgroundColor: surface, height: sheetHeight, transform: [ { translateY } ] }
    ], [ sheetHeight, surface, translateY ]);
    const handlebarStyle = useMemo(
        () => [ styles.handlebar, { backgroundColor: handlebarColor } ],
        [ handlebarColor ]
    );
    const titleStyle = useMemo(
        () => [ styles.title, { color: foreground, fontFamily } ],
        [ fontFamily, foreground ]
    );
    const sectionTitleStyle = useMemo(
        () => [ styles.sectionTitle, { color: muted, fontFamily } ],
        [ fontFamily, muted ]
    );
    const blockNameLabelStyle = useMemo(
        () => [ styles.blockNameLabel, { color: muted, fontFamily } ],
        [ fontFamily, muted ]
    );
    const optionsStyle = useMemo(() => [
        styles.options,
        { backgroundColor: optionSurface, borderColor: divider }
    ], [ divider, optionSurface ]);
    const dividerStyle = useMemo(() => [ styles.divider, { backgroundColor: divider } ], [ divider ]);

    const onSetColorTrue = useCallback(() => setChoosingColor(true), [ ]);

    /* The sheet's slide is driven by `translateY` (so it can follow drags and snap); the modal
       itself only fades, which also covers dismissals that unmount the sheet directly. */
    return <Modal
        animationType="fade"
        navigationBarTranslucent
        onRequestClose={ closeSheet }
        statusBarTranslucent
        transparent
        visible>
        <View onLayout={ handleLayout }
            style={ styles.modalRoot }>
            <Animated.View style={ scrimStyle }>
                <Pressable
                    accessibilityLabel={ labels.dismiss }
                    accessibilityRole="button"
                    onPress={ closeSheet }
                    style={ styles.scrimPressable } />
            </Animated.View>
            <Animated.View accessibilityViewIsModal
                style={ sheetStyle }
                { ...panResponder.panHandlers }>
                <View style={ styles.handlebarArea }
                    { ...handlebarResponder.panHandlers }>
                    <View style={ handlebarStyle } />
                </View>
                <View style={ styles.content }>
                    <View style={ styles.header }>
                        {
                            choosingColor && <Pressable
                                accessibilityLabel={ labels.title }
                                accessibilityRole="button"
                                onPress={ onSetColorTrue }
                                style={ styles.backButton }>
                                {
                                    createElement(getActionIcon("back", icons), {
                                        color: muted,
                                        size: 22,
                                        strokeWidth: 2
                                    })
                                }
                            </Pressable>
                        }
                        <Text accessibilityRole="header"
                            style={ titleStyle }>
                            { choosingColor ? labels.chooseColor : labels.title }
                        </Text>
                    </View>
                    {
                        choosingColor
                            ? <View style={ styles.colorContent }>
                                <Text style={ sectionTitleStyle }>
                                    { labels.text }
                                </Text>
                                <View style={ styles.colorGrid }>
                                    { colorOptions.text.map((choice: EditorColorChoice) =>
                                        <ColorOption
                                            choice={ choice }
                                            key={ choice.color ?? "text-default" }
                                            onSelect={ handleColor } />) }
                                </View>
                                <Text style={ sectionTitleStyle }>
                                    { labels.background }
                                </Text>
                                <View style={ styles.colorGrid }>
                                    { colorOptions.background.map((choice: EditorColorChoice) =>
                                        <ColorOption
                                            choice={ choice }
                                            key={ choice.color ?? "background-default" }
                                            onSelect={ handleColor } />) }
                                </View>
                            </View>
                            : <>
                                <Text style={ blockNameLabelStyle }>{ blockName }</Text>
                                {
                                    (
                                        showCalloutActions ||
                                        showBlockColorActions
                                    ) && <View style={ optionsStyle }>
                                        <ActionOption
                                            color={ muted }
                                            icon={ getActionIcon("color", icons) }
                                            label={ labels.color }
                                            onPress={ onSetColorTrue }
                                            trailingIcon={ getActionIcon("chevronRight", icons) }
                                        />
                                        {
                                            showCalloutActions && <>
                                                <View style={ dividerStyle } />
                                                <ActionOption
                                                    color={ muted }
                                                    icon={ getActionIcon("edit", icons) }
                                                    label={ labels.editIcon }
                                                    onPress={ handleEditIcon } />
                                            </>
                                        }
                                    </View> }
                                { showCalloutActions && <View style={ styles.groupGap } /> }
                                {
                                    showTableActions
                                        ? <>
                                            <View style={ styles.groupGap } />
                                            <View style={ optionsStyle }>
                                                {
                                                    tableActionScope === "table" && <>
                                                        <ActionSwitchOption
                                                            color={ muted }
                                                            icon={ getActionIcon("fitTableWidth", icons) }
                                                            label={ labels.fitTableWidth }
                                                            onValueChange={
                                                                tableAction("toggleFitTableWidth") }
                                                            value={ tableFitPageWidth } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("headerRow", icons) }
                                                            label={ labels.headerRow }
                                                            onPress={ tableAction("toggleHeaderRow") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("headerColumn", icons) }
                                                            label={ labels.headerColumn }
                                                            onPress={ tableAction("toggleHeaderColumn") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("insertBelow", icons) }
                                                            label={ labels.insertBelow }
                                                            onPress={ onAction("insertBelow") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("color", icons) }
                                                            label={ labels.color }
                                                            onPress={ handleTableColor }
                                                            trailingIcon={
                                                                getActionIcon("chevronRight", icons) }
                                                        />
                                                    </>
                                                }
                                                {
                                                    tableActionScope === "row" && <>
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("color", icons) }
                                                            label={ labels.color }
                                                            onPress={ handleTableColor }
                                                            trailingIcon={
                                                                getActionIcon("chevronRight", icons) }
                                                        />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("insertAbove", icons) }
                                                            label={ labels.insertTableRowAbove }
                                                            onPress={
                                                                tableAction("insertTableRowAbove") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("insertBelow", icons) }
                                                            label={ labels.insertTableRowBelow }
                                                            onPress={
                                                                tableAction("insertTableRowBelow") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("clearContents", icons) }
                                                            label={ labels.clearTableContents }
                                                            onPress={ tableAction("clearTableRow") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ danger }
                                                            icon={ getActionIcon("remove", icons) }
                                                            label={ labels.deleteTableRow }
                                                            onPress={ tableAction("deleteTableRow") } />
                                                    </>
                                                }
                                                {
                                                    tableActionScope === "column" && <>
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("color", icons) }
                                                            label={ labels.color }
                                                            onPress={ handleTableColor }
                                                            trailingIcon={
                                                                getActionIcon("chevronRight", icons) }
                                                        />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("insertLeft", icons) }
                                                            label={ labels.insertTableColumnLeft }
                                                            onPress={
                                                                tableAction("insertTableColumnLeft") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("insertRight", icons) }
                                                            label={ labels.insertTableColumnRight }
                                                            onPress={
                                                                tableAction("insertTableColumnRight") }
                                                        />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("clearContents", icons) }
                                                            label={ labels.clearTableContents }
                                                            onPress={ tableAction("clearTableColumn") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ danger }
                                                            icon={ getActionIcon("remove", icons) }
                                                            label={ labels.deleteTableColumn }
                                                            onPress={ tableAction("deleteTableColumn") } />
                                                    </>
                                                }
                                                {
                                                    (
                                                        tableActionScope === "cell" ||
                                                        tableActionScope === "cells") && <>
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("color", icons) }
                                                            label={ labels.color }
                                                            onPress={ handleTableColor }
                                                            trailingIcon={
                                                                getActionIcon("chevronRight", icons) }
                                                        />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("clearContents", icons) }
                                                            label={ labels.clearTableContents }
                                                            onPress={ tableAction("clearTableCells") } />
                                                    </>
                                                }
                                            </View>
                                        </>
                                        : <View style={ optionsStyle }>
                                            {
                                                showInsertAbove && <ActionOption
                                                    color={ muted }
                                                    icon={ getActionIcon("insertAbove", icons) }
                                                    label={ labels.insertAbove }
                                                    onPress={ onAction("insertAbove") } />
                                            }
                                            {
                                                showInsertAbove && <View style={ dividerStyle } />
                                            }
                                            <ActionOption
                                                color={ muted }
                                                icon={ getActionIcon("insertBelow", icons) }
                                                label={ labels.insertBelow }
                                                onPress={ onAction("insertBelow") }
                                            />
                                        </View>
                                }
                                {
                                    showReplaceImage && <>
                                        <View style={ styles.groupGap } />
                                        <View style={ optionsStyle }>
                                            <ActionOption
                                                color={ muted }
                                                icon={ getActionIcon("gallery", icons) }
                                                label={ labels.openGallery }
                                                onPress={ onHandleReplace("gallery") } />
                                            <View style={ dividerStyle } />
                                            <ActionOption
                                                color={ muted }
                                                icon={ getActionIcon("picture", icons) }
                                                label={ labels.takePicture }
                                                onPress={ onHandleReplace("picture") } />
                                        </View>
                                    </>
                                }
                                {
                                    showReplaceAudio && <>
                                        <View style={ styles.groupGap } />
                                        <View style={ optionsStyle }>
                                            <ActionOption
                                                color={ muted }
                                                icon={ getActionIcon("audio", icons) }
                                                label={ labels.chooseAudio }
                                                onPress={ onReplaceAudio("picked") } />
                                            <View style={ dividerStyle } />
                                            <ActionOption
                                                color={ muted }
                                                icon={ getActionIcon("audio", icons) }
                                                label={ labels.recordAudio }
                                                onPress={ onReplaceAudio("recorded") } />
                                        </View>
                                    </>
                                }
                                {
                                    (!showTableActions || tableActionScope === "table") && <>
                                        <View style={ styles.groupGap } />
                                        <View style={ optionsStyle }>
                                            {
                                                !showCalloutActions && <>
                                                    <ActionOption
                                                        color={ muted }
                                                        icon={ getActionIcon("copy", icons) }
                                                        label={ labels.duplicate }
                                                        onPress={ onAction("duplicate") } />
                                                    <View style={ dividerStyle } />
                                                </>
                                            }
                                            <ActionOption
                                                color={ danger }
                                                icon={ getActionIcon("remove", icons) }
                                                label={ labels.delete }
                                                onPress={ onAction("delete") } />
                                        </View>
                                    </>
                                }
                            </>
                    }
                </View>
            </Animated.View>
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
    content:
    {
        paddingBottom: 64,
        paddingHorizontal: 16
    },
    divider:
    {
        height: StyleSheet.hairlineWidth
    },
    groupGap:
    {
        height: 12
    },
    /* Measured from Notion's Actions sheet: a ~52x6dp pill, ~7dp below the sheet's top edge. */
    handlebar:
    {
        borderRadius: 3,
        height: 6,
        width: 52
    },
    /* The area is the handlebar's touch target, so it is taller than the pill. Its bottom padding
       also places the title where Notion's sits (~34dp from the sheet's top). */
    handlebarArea:
    {
        alignItems: "center",
        paddingBottom: 10,
        paddingTop: 7
    },
    header:
    {
        alignItems: "center",
        justifyContent: "center",
        minHeight: 34
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
    optionLabelExpanded:
    {
        flex: 1
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
    scrimPressable:
    {
        flex: 1
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
    },
    trailingIcon:
    {
        alignItems: "center",
        justifyContent: "center"
    }
});
