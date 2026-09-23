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
import type { MarkdownEditorAudioAction, MarkdownEditorComponents, MarkdownEditorIconProps } from "./MarkdownEditor.tsx";
import { createElement, type ComponentType } from "react";
import type { MarkdownColor } from "../../document/types.ts";
import type { EditorBlockActionScope } from "../../prototype.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Switch } from "./Switch.tsx";

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
    readonly components?: MarkdownEditorComponents;
    readonly dark: boolean;
    readonly labels: {
        readonly delete: string;
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
    /** Called when a color is selected for a callout. */
    readonly onColor?: (color: MarkdownColor | undefined) => void;
    /** Called with the picked asset's local URI once a replacement image is chosen. */
    readonly onReplaceImage?: (url: string) => void | Promise<void>;
    /** Opens the shared audio workflow in replacement mode. */
    readonly onReplaceAudio?: (action: MarkdownEditorAudioAction) => void;
    /** Hidden for block types (the divider) that can't take content above themselves. */
    readonly showInsertAbove: boolean;
    /** Callout actions use the Markdown-specific color/icon layout. */
    readonly showCalloutActions?: boolean;
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
}

interface ActionSwitchOptionProps
{
    readonly color: string;
    readonly dark: boolean;
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
    "audio" | "back" | "clear" | "color" | "copy" | "edit" | "fit" | "gallery" | "headerColumn"
    | "headerRow" | "insertAbove" | "insertBelow" | "insertLeft" | "insertRight"
    | "more" | "picture" | "remove" | "table", string
>> =
    {
        back: "ChevronLeft",
        audio: "AudioLines",
        clear: "Eraser",
        color: "Palette",
        copy: "Copy",
        edit: "Pencil",
        fit: "Maximize2",
        gallery: "Image",
        headerColumn: "Columns3",
        headerRow: "Rows3",
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
    "audio" | "back" | "clear" | "color" | "copy" | "edit" | "fit" | "gallery" | "headerColumn"
    | "headerRow" | "insertAbove" | "insertBelow" | "insertLeft" | "insertRight"
    | "more" | "picture" | "remove" | "table",
    ComponentType<MarkdownEditorIconProps>>> =
    {
        back: CopyActionIcon,
        audio: CopyActionIcon,
        clear: CopyActionIcon,
        color: CopyActionIcon,
        copy: CopyActionIcon,
        edit: CopyActionIcon,
        fit: CopyActionIcon,
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
    components: ActionsBottomSheetProps["components"]
): ComponentType<MarkdownEditorIconProps>
{
    const override = components?.[button as keyof MarkdownEditorComponents];

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
    const labelStyle = useMemo(() => [ styles.optionLabel, { color } ], [ color ]);

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
        <Text style={ labelStyle }>{ label }</Text>
    </Pressable>;
}

/** Render a switch row with the same dimensions and spacing as an action button. */
function ActionSwitchOption({
    color,
    dark,
    icon: Icon,
    label,
    onValueChange,
    value
}: ActionSwitchOptionProps)
{
    const labelStyle = useMemo(() => [ styles.optionLabel, { color } ], [ color ]);

    return <View style={ styles.option }>
        <Icon color={ color } size={ 20 } strokeWidth={ 1.75 } />
        <Text style={ labelStyle }>{ label }</Text>
        <Switch
            accessibilityLabel={ label }
            dark={ dark }
            onValueChange={ onValueChange }
            size="medium"
            value={ value } />
    </View>;
}

interface CalloutColorOption
{
    readonly color: MarkdownColor | undefined;
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

/** Render one selectable callout foreground/background color. */
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
    const swatchStyle = useMemo(() => [
        styles.colorSwatch,
        { backgroundColor: swatchBackground, borderColor: option.hex ?? muted }
    ], [ muted, option.hex, swatchBackground ]);
    const swatchTextStyle = useMemo(
        () => [ styles.colorSwatchText, { color: option.hex ?? foreground } ],
        [ foreground, option.hex ]
    );
    const labelStyle = useMemo(
        () => [ styles.colorOptionLabel, { color: foreground } ],
        [ foreground ]
    );

    return <Pressable accessibilityLabel={ option.color === undefined ? defaultLabel : option.label }
        accessibilityRole="button"
        onPress={ onPress }
        style={ styles.colorOption }>
        <View style={ swatchStyle }>
            <Text style={ swatchTextStyle }>
                { option.color === undefined ? "A" : "A" }
            </Text>
        </View>
        <Text style={ labelStyle }>
            { option.color === undefined ? defaultLabel : option.label }
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
    components,
    dark,
    labels,
    onAction,
    onTableAction,
    onTableColor,
    onDismiss,
    onEditIcon,
    onColor,
    onReplaceImage,
    onReplaceAudio,
    showInsertAbove,
    showCalloutActions = false,
    showTableActions = false,
    tableActionScope = "table",
    tableFitPageWidth = false,
    showReplaceImage,
    showReplaceAudio = false
}: ActionsBottomSheetProps)
{
    const [ choosingColor, setChoosingColor ] = useState(false);
    const [ choosingTableColor, setChoosingTableColor ] = useState(false);
    const foreground = dark ? "#F5F5F5" : "#2C2C2B";
    const muted = dark ? "#D0CDC7" : "#45433F";
    const surface = dark ? "#202020" : "#F9F8F6";
    const optionSurface = dark ? "#30302F" : "#FFFFFF";
    const divider = dark ? "rgba(255, 255, 255, 0.10)" : "#EEECE9";
    const scrim = dark ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.25)";
    /* Sampled from Notion's own Actions sheet handlebar in light mode. */
    const handlebarColor = dark ? "#3F3F3E" : "#E6E5E3";
    /* The package's "danger" color -- see MarkdownRendererTheme.danger -- deliberately the same
       hex in both themes, unlike the other colors on this sheet. */
    const danger = "#E56458";

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

    const colorOptions = useMemo(() => ({
        background: calloutBackgroundColors,
        text: calloutTextColors
    }), [ ]);
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
    const titleStyle = useMemo(() => [ styles.title, { color: foreground } ], [ foreground ]);
    const sectionTitleStyle = useMemo(() => [ styles.sectionTitle, { color: muted } ], [ muted ]);
    const blockNameLabelStyle = useMemo(
        () => [ styles.blockNameLabel, { color: muted } ],
        [ muted ]
    );
    const optionsStyle = useMemo(() => [
        styles.options,
        { backgroundColor: optionSurface, borderColor: divider }
    ], [ divider, optionSurface ]);
    const dividerStyle = useMemo(() => [ styles.divider, { backgroundColor: divider } ], [ divider ]);

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
                    accessibilityLabel="Dismiss actions"
                    accessibilityRole="button"
                    onPress={ closeSheet }
                    style={ styles.scrimPressable } />
            </Animated.View>
            <Animated.View accessibilityViewIsModal
                style={ sheetStyle }
                { ...panResponder.panHandlers }>
                <View style={ styles.handlebarArea }>
                    <View style={ handlebarStyle } />
                </View>
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
                                    { colorOptions.text.map((option: CalloutColorOption) =>
                                        <ColorOption
                                            dark={ dark }
                                            defaultLabel={ labels.defaultColor }
                                            key={ option.color ?? "text-default" }
                                            onPress={ () => handleColor(option.color) }
                                            option={ option } />) }
                                </View>
                                <Text style={ sectionTitleStyle }>
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
                                <Text style={ blockNameLabelStyle }>{ blockName }</Text>
                                {
                                    showCalloutActions && <View style={ optionsStyle }>
                                        <ActionOption
                                            color={ muted }
                                            icon={ getActionIcon("color", components) }
                                            label={ labels.color }
                                            onPress={ () => setChoosingColor(true) } />
                                        <View style={ dividerStyle } />
                                        <ActionOption
                                            color={ muted }
                                            icon={ getActionIcon("edit", components) }
                                            label={ labels.editIcon }
                                            onPress={ handleEditIcon } />
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
                                                            dark={ dark }
                                                            icon={ getActionIcon("fit", components) }
                                                            label={ labels.fitTableWidth }
                                                            onValueChange={ () => onTableAction?.("toggleFitTableWidth") }
                                                            value={ tableFitPageWidth } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("headerRow", components) }
                                                            label={ labels.headerRow }
                                                            onPress={ () => onTableAction?.("toggleHeaderRow") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("headerColumn", components) }
                                                            label={ labels.headerColumn }
                                                            onPress={ () => onTableAction?.("toggleHeaderColumn") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("insertBelow", components) }
                                                            label={ labels.insertBelow }
                                                            onPress={ () => onAction("insertBelow") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("color", components) }
                                                            label={ labels.color }
                                                            onPress={ handleTableColor } />
                                                    </>
                                                }
                                                {
                                                    tableActionScope === "row" && <>
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("color", components) }
                                                            label={ labels.color }
                                                            onPress={ handleTableColor } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("insertAbove", components) }
                                                            label={ labels.insertTableRowAbove }
                                                            onPress={ () => onTableAction?.("insertTableRowAbove") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("insertBelow", components) }
                                                            label={ labels.insertTableRowBelow }
                                                            onPress={ () => onTableAction?.("insertTableRowBelow") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("clear", components) }
                                                            label={ labels.clearTableContents }
                                                            onPress={ () => onTableAction?.("clearTableRow") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ danger }
                                                            icon={ getActionIcon("remove", components) }
                                                            label={ labels.deleteTableRow }
                                                            onPress={ () => onTableAction?.("deleteTableRow") } />
                                                    </>
                                                }
                                                {
                                                    tableActionScope === "column" && <>
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("color", components) }
                                                            label={ labels.color }
                                                            onPress={ handleTableColor } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("insertLeft", components) }
                                                            label={ labels.insertTableColumnLeft }
                                                            onPress={ () => onTableAction?.("insertTableColumnLeft") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("insertRight", components) }
                                                            label={ labels.insertTableColumnRight }
                                                            onPress={ () => onTableAction?.("insertTableColumnRight") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("clear", components) }
                                                            label={ labels.clearTableContents }
                                                            onPress={ () => onTableAction?.("clearTableColumn") } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ danger }
                                                            icon={ getActionIcon("remove", components) }
                                                            label={ labels.deleteTableColumn }
                                                            onPress={ () => onTableAction?.("deleteTableColumn") } />
                                                    </>
                                                }
                                                {
                                                    (tableActionScope === "cell" || tableActionScope === "cells") && <>
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("color", components) }
                                                            label={ labels.color }
                                                            onPress={ handleTableColor } />
                                                        <View style={ dividerStyle } />
                                                        <ActionOption
                                                            color={ muted }
                                                            icon={ getActionIcon("clear", components) }
                                                            label={ labels.clearTableContents }
                                                            onPress={ () => onTableAction?.("clearTableCells") } />
                                                    </>
                                                }
                                            </View>
                                        </>
                                        : <View style={ optionsStyle }>
                                            {
                                                showInsertAbove && <ActionOption
                                                    color={ muted }
                                                    icon={ getActionIcon("insertAbove", components) }
                                                    label={ labels.insertAbove }
                                                    onPress={ () => onAction("insertAbove") } />
                                            }
                                            {
                                                showInsertAbove && <View style={ dividerStyle } />
                                            }
                                            <ActionOption
                                                color={ muted }
                                                icon={ getActionIcon("insertBelow", components) }
                                                label={ labels.insertBelow }
                                                onPress={ () => onAction("insertBelow") } />
                                        </View>
                                }
                                {
                                    showReplaceImage && <>
                                        <View style={ styles.groupGap } />
                                        <View style={ optionsStyle }>
                                            <ActionOption
                                                color={ muted }
                                                icon={ getActionIcon("gallery", components) }
                                                label={ labels.openGallery }
                                                onPress={ () => void handleReplace("gallery") } />
                                            <View style={ dividerStyle } />
                                            <ActionOption
                                                color={ muted }
                                                icon={ getActionIcon("picture", components) }
                                                label={ labels.takePicture }
                                                onPress={ () => void handleReplace("picture") } />
                                        </View>
                                    </>
                                }
                                {
                                    showReplaceAudio && <>
                                        <View style={ styles.groupGap } />
                                        <View style={ optionsStyle }>
                                            <ActionOption
                                                color={ muted }
                                                icon={ getActionIcon("audio", components) }
                                                label={ labels.chooseAudio }
                                                onPress={ () => onReplaceAudio?.("picked") } />
                                            <View style={ dividerStyle } />
                                            <ActionOption
                                                color={ muted }
                                                icon={ getActionIcon("audio", components) }
                                                label={ labels.recordAudio }
                                                onPress={ () => onReplaceAudio?.("recorded") } />
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
                                                icon={ getActionIcon("copy", components) }
                                                label={ labels.duplicate }
                                                onPress={ () => onAction("duplicate") } />
                                            <View style={ dividerStyle } />
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
    content:
    {
        paddingBottom: 64,
        paddingHorizontal: 16,
        /* With the handlebar above, places the title where Notion's sits (~34dp from the top). */
        paddingTop: 10
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
    /* Measured from Notion's Actions sheet: a ~52x6dp pill, ~7dp below the sheet's top edge. */
    handlebar:
    {
        borderRadius: 3,
        height: 6,
        width: 52
    },
    handlebarArea:
    {
        alignItems: "center",
        paddingTop: 7
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
    }
});
