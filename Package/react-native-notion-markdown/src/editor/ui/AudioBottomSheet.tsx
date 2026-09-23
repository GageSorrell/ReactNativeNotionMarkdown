/**
 * @module react-native-notion-markdown/editor/ui/AudioBottomSheet
 *
 * @file      AudioBottomSheet.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Audio insertion and replacement workflow.
 *
 * The document picker and recorder stay in this lazily loaded module so applications that
 * provide `onInsertAudio` do not need the optional picker peer at runtime.
 */

import * as DocumentPicker from "expo-document-picker";
import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
    useAudioRecorder,
    useAudioRecorderState
} from "expo-audio";
import {
    AudioFileIcon,
    CancelIcon,
    CheckIcon,
    MicrophoneIcon,
    PauseIcon,
    PlayIcon,
    StopIcon
} from "./audioIcons.tsx";
import {
    createFallbackAudioWaveform,
    finalizeAudioWaveform,
    formatAudioTime,
    normalizeAudioMetering
} from "./audioWaveform.ts";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import type {
    MarkdownEditorAudioAction,
    MarkdownEditorAudioAsset,
    MarkdownEditorAudioSelection,
    MarkdownEditorComponents,
    MarkdownEditorIconProps
} from "./MarkdownEditor.tsx";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface AudioBottomSheetProps
{
    readonly components?: MarkdownEditorComponents;
    readonly initialAction?: MarkdownEditorAudioAction;
    readonly replacement?: boolean;
    readonly labels: {
        readonly cancel: string;
        readonly chooseFile: string;
        readonly confirm: string;
        readonly error: string;
        readonly noAudio: string;
        readonly permissionDenied: string;
        readonly pause: string;
        readonly play: string;
        readonly preparing: string;
        readonly preview: string;
        readonly record: string;
        readonly recording: string;
        readonly replace: string;
        readonly start: string;
        readonly stop: string;
        readonly title: string;
    };
    readonly onDismiss: () => void;
    readonly onSelected: (selection: MarkdownEditorAudioSelection) => void | Promise<void>;
}

type Phase = "choice" | "recorder" | "confirmation";

const recordingOptions = {
    ...RecordingPresets.HIGH_QUALITY,
    directory: "document" as const,
    isMeteringEnabled: true
};

function formatDuration(seconds: number): string
{
    const safe = Math.max(0, Math.round(seconds));
    return `${ Math.floor(safe / 60) }:${ String(safe % 60).padStart(2, "0") }`;
}

function errorMessage(error: unknown, fallback: string): string
{
    return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}

/** Invoke an Expo shared-object command without allowing a native rejection to escape. */
function invokePlayerCommand(command: () => void): void
{
    try
    {
        void Promise.resolve(command()).catch(() => undefined);
    }
    catch
    {
        // The player may be released while the sheet is closing.
    }
}

interface AudioOptionProps
{
    readonly action: "choose" | "record";
    readonly color: string;
    readonly icon: ComponentType<MarkdownEditorIconProps>;
    readonly label: string;
    readonly onPress: (action: "choose" | "record") => void;
}

type LucideModule = Record<string, ComponentType<MarkdownEditorIconProps>> &
{
    readonly default?: Record<string, ComponentType<MarkdownEditorIconProps>>;
};

type AudioIconName = "choose" | "record" | "stop" | "cancel" | "check" | "play" | "pause";

const lucideNames: Readonly<Record<AudioIconName, string>> =
    {
        cancel: "CircleX",
        check: "Check",
        choose: "FileAudio",
        pause: "Pause",
        play: "Play",
        record: "Mic",
        stop: "Square"
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

/** Resolve a host override, optional Lucide icon, or dependency-free SVG fallback. */
function getAudioIcon(
    action: "choose" | "record",
    components: MarkdownEditorComponents | undefined
): ComponentType<MarkdownEditorIconProps>
{
    const override = action === "choose"
        ? components?.filePicker
        : components?.record ?? components?.speech;

    if (override !== undefined)
    {
        return override;
    }

    const lucideIcon = getLucideIcons()?.[lucideNames[action]];

    if (lucideIcon !== undefined)
    {
        return lucideIcon;
    }

    return action === "choose" ? AudioFileIcon : MicrophoneIcon;
}

/** Resolve a recorder-control override, optional Lucide icon, or dependency-free SVG fallback. */
function getRecordingIcon(
    action: "record" | "stop" | "cancel" | "check" | "play" | "pause",
    components: MarkdownEditorComponents | undefined
): ComponentType<MarkdownEditorIconProps>
{
    const override = action === "record"
        ? components?.record ?? components?.speech
        : action === "stop"
            ? components?.stop
            : action === "cancel"
                ? components?.cancel ?? components?.close
                : action === "check" ? components?.check : action === "play" ? components?.play : components?.pause;

    if (override !== undefined)
    {
        return override;
    }

    const lucideIcon = getLucideIcons()?.[lucideNames[action]];

    if (lucideIcon !== undefined)
    {
        return lucideIcon;
    }

    return action === "record"
        ? MicrophoneIcon
        : action === "stop"
            ? StopIcon
            : action === "cancel" ? CancelIcon : action === "check" ? CheckIcon : action === "play" ? PlayIcon : PauseIcon;
}

/** Render one labeled audio action. */
function AudioOption({ action, color, icon: Icon, label, onPress }: AudioOptionProps)
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

function Waveform({ amplitude, isRecording, label }: { readonly amplitude: number; readonly isRecording: boolean; readonly label: string })
{
    const bars = useMemo(
        () => Array.from({ length: nineBars }, (_unused: unknown, index: number) => index), [ ]
    );
    return <View accessibilityLabel={ label }
        accessibilityRole="image"
        style={ styles.waveform }>
        { bars.map((index: number) => <WaveformBar amplitude={ amplitude }
            isRecording={ isRecording }
            index={ index }
            key={ index } />) }
    </View>;
}

const nineBars = 9;

function WaveformBar({ amplitude, isRecording, index }: { readonly amplitude: number; readonly isRecording: boolean; readonly index: number })
{
    const soundPulse = useMemo(() => new Animated.Value(0), [ ]);
    const quietPulse = useMemo(() => new Animated.Value(0), [ ]);
    const quietPulseGeneration = useRef(0);
    const isQuiet = amplitude === 0;
    const animateQuietPulse = useCallback((generation: number): void =>
    {
        const animation = Animated.timing(quietPulse, {
            duration: 420 + index * 37 + Math.random() * 220,
            easing: Easing.inOut(Easing.ease),
            toValue: Math.random(),
            useNativeDriver: true
        });
        animation.start(({ finished }) =>
        {
            if (finished && quietPulseGeneration.current === generation)
            {
                animateQuietPulse(generation);
            }
        });
    }, [ index, quietPulse, quietPulseGeneration ]);
    useEffect(() =>
    {
        if (!isRecording)
        {
            soundPulse.stopAnimation();
            soundPulse.setValue(0);
            return () => soundPulse.stopAnimation();
        }
        const animation = Animated.loop(Animated.sequence([
            Animated.timing(soundPulse, {
                duration: 520 + index * 37,
                easing: Easing.inOut(Easing.ease),
                toValue: 1,
                useNativeDriver: true
            }),
            Animated.timing(soundPulse, {
                duration: 520 + index * 37,
                easing: Easing.inOut(Easing.ease),
                toValue: 0,
                useNativeDriver: true
            })
        ]));
        animation.start();
        return () => animation.stop();
    }, [ index, isRecording, soundPulse ]);
    useEffect(() =>
    {
        const generation = ++quietPulseGeneration.current;
        quietPulse.stopAnimation();
        quietPulse.setValue(0);
        if (!isRecording || !isQuiet)
        {
            return () =>
            {
                ++quietPulseGeneration.current;
                quietPulse.stopAnimation();
            };
        }
        animateQuietPulse(generation);
        return () =>
        {
            ++quietPulseGeneration.current;
            quietPulse.stopAnimation();
        };
    }, [ animateQuietPulse, isQuiet, isRecording, quietPulse, quietPulseGeneration ]);
    const soundScale = soundPulse.interpolate({
        inputRange: [ 0, 1 ],
        outputRange: [ 0.25, 0.25 + Math.max(0, Math.min(1, amplitude)) * 0.75 ]
    });
    const quietScale = quietPulse.interpolate({
        inputRange: [ 0, 1 ],
        outputRange: [ 0.25, 0.37 ]
    });
    const scale = isRecording && isQuiet ? quietScale : soundScale;
    const barStyle = useMemo(() => [ styles.waveBar, { transform: [ { scaleY: scale } ] } ], [ scale ]);
    return <Animated.View style={ barStyle } />;
}

interface FinalWaveformProps
{
    readonly bars: ReadonlyArray<number>;
    readonly cursor: Animated.Value;
    readonly darkColor: string;
    readonly lightColor: string;
}

function FinalWaveform({ bars, cursor, darkColor, lightColor }: FinalWaveformProps)
{
    return <View accessibilityRole="image"
        style={ styles.finalWaveform }>
        { bars.map((amplitude: number, index: number) => <FinalWaveformBar amplitude={ amplitude }
            bars={ bars.length }
            cursor={ cursor }
            darkColor={ darkColor }
            index={ index }
            key={ index }
            lightColor={ lightColor } />) }
    </View>;
}

interface FinalWaveformBarProps
{
    readonly amplitude: number;
    readonly bars: number;
    readonly cursor: Animated.Value;
    readonly darkColor: string;
    readonly index: number;
    readonly lightColor: string;
}

function FinalWaveformBar({ amplitude, bars, cursor, darkColor, index, lightColor }: FinalWaveformBarProps)
{
    const start = index / bars;
    const end = (index + 1) / bars;
    const color = cursor.interpolate({
        extrapolate: "clamp",
        inputRange: [ start, end ],
        outputRange: [ lightColor, darkColor ]
    });
    const barStyle = useMemo(() => [
        styles.finalWaveformBar,
        { backgroundColor: color, height: 8 + Math.max(0.18, Math.min(1, amplitude)) * 20 }
    ], [ amplitude, color ]);
    return <Animated.View style={ barStyle } />;
}

interface AudioPlayerCardProps
{
    readonly accent: string;
    readonly asset: MarkdownEditorAudioAsset;
    readonly currentTime: number;
    readonly darkColor: string;
    readonly foreground: string;
    readonly lightColor: string;
    readonly muted: string;
    readonly onPress: () => void;
    readonly pauseIcon: ComponentType<MarkdownEditorIconProps>;
    readonly playIcon: ComponentType<MarkdownEditorIconProps>;
    readonly playing: boolean;
    readonly surface: string;
    readonly label: string;
}

function AudioPlayerCard({
    accent,
    asset,
    currentTime,
    darkColor,
    foreground,
    lightColor,
    muted,
    onPress,
    pauseIcon: Pause,
    playIcon: Play,
    playing,
    surface,
    label
}: AudioPlayerCardProps)
{
    const bars = useMemo(() =>
    {
        const supplied = asset.waveform?.filter((value: number) => Number.isFinite(value))
            .map((value: number) => Math.max(0, Math.min(1, value)));
        return supplied !== undefined && supplied.length > 0
            ? supplied
            : createFallbackAudioWaveform(asset.fileName ?? asset.uri);
    }, [ asset.fileName, asset.uri, asset.waveform ]);
    const duration = Math.max(0, asset.duration ?? 0);
    const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
    const cursor = useRef(new Animated.Value(progress)).current;
    useEffect(() =>
    {
        const animation = Animated.timing(cursor, {
            duration: playing ? 180 : 0,
            toValue: progress,
            useNativeDriver: false
        });
        animation.start();
        return () => animation.stop();
    }, [ cursor, playing, progress ]);
    const cardStyle = useMemo(() => [ styles.audioPlayerCard, { backgroundColor: surface } ], [ surface ]);
    const playButtonStyle = useMemo(() => [ styles.audioPlayerButton, { backgroundColor: accent } ], [ accent ]);
    const timeStyle = useMemo(() => [ styles.audioPlayerTime, { color: muted } ], [ muted ]);
    const fileNameStyle = useMemo(() => [ styles.audioPlayerFileName, { color: foreground } ], [ foreground ]);
    const Icon = playing ? Pause : Play;
    return <View style={ cardStyle }>
        <Pressable accessibilityLabel={ label }
            accessibilityRole="button"
            onPress={ onPress }
            style={ playButtonStyle }>
            <Icon color="#FFFFFF"
                size={ 20 }
                strokeWidth={ 2.25 } />
        </Pressable>
        <View style={ styles.audioPlayerDetails }>
            <Text numberOfLines={ 1 }
                style={ fileNameStyle }>{ asset.fileName ?? "Audio" }</Text>
            <FinalWaveform bars={ bars }
                cursor={ cursor }
                darkColor={ darkColor }
                lightColor={ lightColor } />
            <Text style={ timeStyle }>{ formatAudioTime(Math.min(currentTime, duration)) } / { formatAudioTime(duration) }</Text>
        </View>
    </View>;
}

/** Render the audio workflow. */
export function AudioBottomSheet({ components, initialAction, labels, onDismiss, onSelected, replacement = false }: AudioBottomSheetProps)
{
    const dark = useColorScheme() === "dark";
    const [ phase, setPhase ] = useState<Phase>(initialAction === undefined ? "choice" : "recorder");
    const [ error, setError ] = useState<string>();
    const [ prepared, setPrepared ] = useState(false);
    const [ recordingAsset, setRecordingAsset ] = useState<MarkdownEditorAudioSelection["asset"]>();
    const recorder = useAudioRecorder(recordingOptions);
    const recorderState = useAudioRecorderState(recorder, 100);
    const previewPlayer = useAudioPlayer(recordingAsset?.uri ?? null, { updateInterval: 250 });
    const previewStatus = useAudioPlayerStatus(previewPlayer);
    const closed = useRef(false);
    const recordingMetering = useRef<number[]>([]);

    useEffect(() =>
    {
        if (recorderState.isRecording && recorderState.metering !== undefined)
        {
            recordingMetering.current.push(normalizeAudioMetering(recorderState.metering));
        }
    }, [ recorderState.isRecording, recorderState.metering ]);

    const reportAndClose = useCallback(async (selection: MarkdownEditorAudioSelection) =>
    {
        if (closed.current) {return;}
        closed.current = true;
        onDismiss();
        await onSelected(selection);
    }, [ onDismiss, onSelected ]);

    const stopAndDiscard = useCallback(async () =>
    {
        if (recorderState.isRecording)
        {
            await recorder.stop().catch(() => undefined);
        }
    }, [ recorder, recorderState.isRecording ]);

    useEffect(() => () =>
    {
        void stopAndDiscard();
    }, [ stopAndDiscard ]);

    const chooseFile = useCallback(async () =>
    {
        setError(undefined);
        try
        {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                multiple: false,
                type: "audio/*"
            });
            if (result.canceled)
            {
                await reportAndClose({ action: "picked", canceled: true });
                return;
            }
            const asset = result.assets[ 0 ];
            if (asset === undefined)
            {
                await reportAndClose({ action: "picked", canceled: true });
                return;
            }
            await reportAndClose({
                action: "picked",
                asset:
                {
                    fileName: asset.name,
                    fileSize: asset.size,
                    mimeType: asset.mimeType,
                    uri: asset.uri
                },
                canceled: false
            });
        }
        catch (caught)
        {
            const message = errorMessage(caught, labels.error);
            setError(message);
            await onSelected({ action: "picked", canceled: false, error: message });
        }
    }, [ labels.error, onSelected, reportAndClose ]);

    const prepareRecorder = useCallback(async () =>
    {
        setError(undefined);
        setPhase("recorder");
        try
        {
            const permission = await requestRecordingPermissionsAsync();
            if (!permission.granted)
            {
                setError(labels.permissionDenied);
                void onSelected({ action: "recorded", canceled: false, error: labels.permissionDenied });
                return;
            }
            await recorder.prepareToRecordAsync();
            setPrepared(true);
        }
        catch (caught)
        {
            const message = errorMessage(caught, labels.error);
            setError(message);
            void onSelected({ action: "recorded", canceled: false, error: message });
        }
    }, [ labels.error, labels.permissionDenied, onSelected, recorder ]);

    const handleChoice = useCallback((action: "choose" | "record") =>
    {
        if (action === "choose") {void chooseFile();}
        else {void prepareRecorder();}
    }, [ chooseFile, prepareRecorder ]);

    useEffect(() =>
    {
        if (initialAction === "picked") {void chooseFile();}
        if (initialAction === "recorded") {void prepareRecorder();}
    }, [ chooseFile, initialAction, prepareRecorder ]);

    const startRecording = useCallback(() =>
    {
        if (!prepared) {return;}
        setError(undefined);
        recordingMetering.current = [];
        try { recorder.record(); }
        catch (caught)
        {
            const message = errorMessage(caught, labels.error);
            setError(message);
            void onSelected({ action: "recorded", canceled: false, error: message });
        }
    }, [ labels.error, prepared, recorder ]);

    const stopRecording = useCallback(async () =>
    {
        try
        {
            const duration = Math.max(recorder.currentTime, recorderState.durationMillis / 1000);
            await recorder.stop();
            if (recorder.uri === null)
            {
                setError(labels.error);
                void onSelected({ action: "recorded", canceled: false, error: labels.error });
                return;
            }
            setRecordingAsset({
                duration,
                fileName: `recording-${ Date.now() }.m4a`,
                mimeType: "audio/mp4",
                waveform: finalizeAudioWaveform(recordingMetering.current),
                uri: recorder.uri
            });
            setPhase("confirmation");
        }
        catch (caught)
        {
            const message = errorMessage(caught, labels.error);
            setError(message);
            void onSelected({ action: "recorded", canceled: false, error: message });
        }
    }, [ labels.error, onSelected, recorder, recorderState.durationMillis ]);

    const cancel = useCallback(async () =>
    {
        await stopAndDiscard();
        onDismiss();
    }, [ onDismiss, stopAndDiscard ]);

    const recordButtonPress = useCallback(() =>
    {
        if (recorderState.isRecording)
        {
            void stopRecording();
            return;
        }
        startRecording();
    }, [ recorderState.isRecording, startRecording, stopRecording ]);

    const togglePreview = useCallback(() =>
    {
        invokePlayerCommand(() => previewStatus.playing ? previewPlayer.pause() : previewPlayer.play());
    }, [ previewPlayer, previewStatus.playing ]);

    const confirm = useCallback(async () =>
    {
        if (recordingAsset === undefined) {return;}
        await reportAndClose({ action: "recorded", asset: recordingAsset, canceled: false });
    }, [ recordingAsset, reportAndClose ]);
    const confirmPress = useCallback(() =>
    {
        void confirm();
    }, [ confirm ]);

    const amplitude = recorderState.metering === undefined
        ? 0
        : normalizeAudioMetering(recorderState.metering);
    const foreground = dark ? "#F5F5F5" : "#2C2C2B";
    const muted = dark ? "#D0CDC7" : "#45433F";
    const surface = dark ? "#202020" : "#F9F8F6";
    const optionSurface = dark ? "#30302F" : "#FFFFFF";
    const divider = dark ? "rgba(255, 255, 255, 0.10)" : "#EEECE9";
    const scrim = dark ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.25)";
    const accent = "#337EA9";

    const scrimStyle = useMemo(() => [ styles.scrim, { backgroundColor: scrim } ], [ scrim ]);
    const sheetStyle = useMemo(() => [ styles.sheet, { backgroundColor: surface } ], [ surface ]);
    const contentStyle = useMemo(() => [ styles.content ], [ ]);
    const titleStyle = useMemo(() => [ styles.title, { color: foreground } ], [ foreground ]);
    const optionsStyle = useMemo(() => [
        styles.options,
        { backgroundColor: optionSurface, borderColor: divider }
    ], [ divider, optionSurface ]);
    const dividerStyle = useMemo(() => [ styles.divider, { backgroundColor: divider } ], [ divider ]);
    const chooseIcon = useMemo(() => getAudioIcon("choose", components), [ components ]);
    const recordIcon = useMemo(() => getAudioIcon("record", components), [ components ]);
    const startRecordingIcon = useMemo(() => getRecordingIcon("record", components), [ components ]);
    const stopRecordingIcon = useMemo(() => getRecordingIcon("stop", components), [ components ]);
    const CancelRecordingIcon = useMemo(() => getRecordingIcon("cancel", components), [ components ]);
    const CheckRecordingIcon = useMemo(() => getRecordingIcon("check", components), [ components ]);
    const PlayRecordingIcon = useMemo(() => getRecordingIcon("play", components), [ components ]);
    const PauseRecordingIcon = useMemo(() => getRecordingIcon("pause", components), [ components ]);
    const RecordingIcon = recorderState.isRecording ? stopRecordingIcon : startRecordingIcon;
    const recordButtonStyle = useMemo(() => [
        styles.recordButton,
        { backgroundColor: recorderState.isRecording ? "#D44C47" : accent },
        !prepared ? styles.recordButtonDisabled : undefined
    ], [ accent, prepared, recorderState.isRecording ]);
    const cancelButtonStyle = useMemo(() => [
        styles.cancelButton,
        { backgroundColor: optionSurface, borderColor: divider }
    ], [ divider, optionSurface ]);
    const confirmationCancelStyle = useMemo(() => [
        styles.confirmationCancel,
        { backgroundColor: optionSurface, borderColor: divider }
    ], [ divider, optionSurface ]);
    const confirmationConfirmStyle = useMemo(() => [
        styles.confirmationConfirm,
        { backgroundColor: accent }
    ], [ accent ]);

    return <Modal animationType="slide"
        navigationBarTranslucent
        onRequestClose={ cancel }
        statusBarTranslucent
        transparent
        visible>
        <View style={ styles.modalRoot }>
            <Pressable accessibilityLabel="Dismiss insert audio"
                accessibilityRole="button"
                onPress={ cancel }
                style={ scrimStyle } />
            <View accessibilityViewIsModal
                style={ sheetStyle }>
                <View style={ contentStyle }>
                <Text accessibilityRole="header"
                    style={ titleStyle }>
                    { phase === "confirmation" ? (replacement ? labels.replace : labels.confirm) : labels.title }
                </Text>
                { phase === "choice" && <View style={ optionsStyle }>
                    <AudioOption action="choose"
                        color={ muted }
                        icon={ chooseIcon }
                        label={ labels.chooseFile }
                        onPress={ handleChoice } />
                    <View style={ dividerStyle } />
                    <AudioOption action="record"
                        color={ muted }
                        icon={ recordIcon }
                        label={ labels.record }
                        onPress={ handleChoice } />
                </View> }
                { phase === "recorder" && <View style={ styles.recorder }>
                    <Waveform amplitude={ recorderState.isRecording ? amplitude : 0.18 }
                        isRecording={ recorderState.isRecording }
                        label={ labels.recording } />
                    <Text style={ [ styles.recordingDuration, { color: muted } ] }>{ formatDuration(recorderState.durationMillis / 1000) }</Text>
                    <Pressable
                        accessibilityLabel={ recorderState.isRecording ? labels.stop : labels.start }
                        accessibilityRole="button"
                        accessibilityState={ { disabled: !prepared } }
                        disabled={ !prepared }
                        onPress={ recordButtonPress }
                        style={ recordButtonStyle }>
                        <RecordingIcon color="#FFFFFF"
                            size={ 28 }
                            strokeWidth={ 2 } />
                    </Pressable>
                    <Pressable accessibilityLabel={ labels.cancel }
                        accessibilityRole="button"
                        onPress={ cancel }
                        style={ cancelButtonStyle }>
                        <CancelRecordingIcon color={ muted }
                            size={ 22 }
                            strokeWidth={ 2 } />
                    </Pressable>
                </View> }
                { phase === "confirmation" && recordingAsset !== undefined && <View style={ styles.confirmation }>
                    <AudioPlayerCard accent={ accent }
                        asset={ recordingAsset }
                        currentTime={ previewStatus.currentTime }
                        darkColor={ accent }
                        foreground={ foreground }
                        label={ `${ labels.preview } · ${ previewStatus.playing ? labels.pause : labels.play }` }
                        lightColor={ dark ? "#5B7F94" : "#A9C9D8" }
                        muted={ muted }
                        onPress={ togglePreview }
                        pauseIcon={ PauseRecordingIcon }
                        playIcon={ PlayRecordingIcon }
                        playing={ previewStatus.playing }
                        surface={ dark ? "#2D363B" : "#F0F6F8" } />
                    { error !== undefined && <Text style={ styles.error }>{ error }</Text> }
                    <View style={ styles.confirmationActions }>
                        <Pressable accessibilityLabel={ labels.cancel }
                            accessibilityRole="button"
                            onPress={ cancel }
                            style={ confirmationCancelStyle }>
                            <CancelRecordingIcon color={ muted }
                                size={ 22 }
                                strokeWidth={ 2 } />
                        </Pressable>
                        <Pressable accessibilityLabel={ replacement ? labels.replace : labels.confirm }
                            accessibilityRole="button"
                            onPress={ confirmPress }
                            style={ confirmationConfirmStyle }>
                            <CheckRecordingIcon color="#FFFFFF"
                                size={ 26 }
                                strokeWidth={ 2.25 } />
                        </Pressable>
                    </View>
                </View> }
                { error !== undefined && phase !== "confirmation" && <Text accessibilityRole="alert"
                    style={ styles.error }>{ error }</Text> }
                </View>
            </View>
        </View>
    </Modal>;
}

const styles = StyleSheet.create({
    audioPlayerButton: { alignItems: "center", borderRadius: 24, height: 48, justifyContent: "center", width: 48 },
    audioPlayerCard: { alignItems: "center", borderRadius: 12, flexDirection: "row", minHeight: 88, paddingHorizontal: 14, paddingVertical: 12, width: "100%" },
    audioPlayerDetails: { flex: 1, marginLeft: 12, minWidth: 0 },
    audioPlayerFileName: { fontSize: 16, fontWeight: "600" },
    audioPlayerTime: { fontSize: 12, fontVariant: [ "tabular-nums" ], marginTop: 3 },
    finalWaveform: { alignItems: "center", flexDirection: "row", gap: 2, height: 28, marginTop: 3, overflow: "hidden" },
    finalWaveformBar: { borderRadius: 1, minWidth: 1.5, width: 1.5 },
    cancelButton: { alignItems: "center", borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, height: 48, justifyContent: "center", marginTop: 12, width: 48 },
    confirmation: { alignItems: "center" },
    confirmationActions: { alignItems: "center", flexDirection: "row", gap: 16, justifyContent: "center", marginTop: 22, width: "100%" },
    confirmationCancel: { alignItems: "center", borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, height: 56, justifyContent: "center", width: 56 },
    confirmationConfirm: { alignItems: "center", borderRadius: 28, height: 56, justifyContent: "center", width: 56 },
    content: { paddingBottom: 64, paddingHorizontal: 16, paddingTop: 14 },
    divider: { backgroundColor: "#EEECE9", height: StyleSheet.hairlineWidth },
    error: { color: "#C23B32", fontSize: 13, marginTop: 12, textAlign: "center" },
    modalRoot: { flex: 1, justifyContent: "flex-end" },
    option: { alignItems: "center", flexDirection: "row", gap: 16, minHeight: 48, paddingHorizontal: 24 },
    optionLabel: { fontSize: 16, fontWeight: "500" },
    options: { borderColor: "#EEECE9", borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
    recorder: { alignItems: "center" },
    recordButton: { alignItems: "center", borderRadius: 32, height: 64, justifyContent: "center", width: 64 },
    recordButtonDisabled: { opacity: 0.45 },
    recordingDuration: { fontSize: 17, fontVariant: [ "tabular-nums" ], marginBottom: 24, marginTop: 8, opacity: 0.65 },
    scrim: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
    sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: "hidden" },
    title: { fontSize: 16, fontWeight: "600", paddingBottom: 16, textAlign: "center" },
    waveform: { alignItems: "center", flexDirection: "row", gap: 7, height: 90, justifyContent: "center", marginBottom: 8 },
    waveBar: { backgroundColor: "#337EA9", borderRadius: 5, height: 70, width: 8 }
});
