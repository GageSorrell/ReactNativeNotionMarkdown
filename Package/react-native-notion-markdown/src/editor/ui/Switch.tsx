/**
 * @module react-native-notion-markdown/editor/ui/Switch
 *
 * @file      Switch.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Small animated binary switch used by the editor action surfaces.
 *
 * This follows NoteFerry's Switch primitive closely: the track and thumb dimensions, animated
 * thumb travel, pressed semantics, and accessibility state are intentionally kept compatible.
 * The package version is dependency-free so it can be used without NoteFerry's theme system.
 */

import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useCallback, useEffect, useMemo, useRef } from "react";

export type SwitchSize = "medium" | "small";

export interface SwitchProps
{
    readonly accessibilityLabel?: string;
    readonly dark?: boolean;
    readonly disabled?: boolean;
    readonly onValueChange?: (value: boolean) => void;
    readonly size?: SwitchSize;
    readonly style?: StyleProp<ViewStyle>;
    readonly value?: boolean;
}

interface SwitchDimensions
{
    readonly height: number;
    readonly thumb: number;
    readonly travel: number;
    readonly width: number;
}

const dimensionsBySize: Readonly<Record<SwitchSize, SwitchDimensions>> =
    {
        medium: { height: 34, thumb: 30, travel: 20, width: 54 },
        small: { height: 22, thumb: 18, travel: 14, width: 36 }
    };

/** A compact, animated binary switch. */
export function Switch({
    accessibilityLabel,
    dark = false,
    disabled = false,
    onValueChange,
    size = "medium",
    style,
    value = false
}: SwitchProps): React.JSX.Element
{
    const dimensions = dimensionsBySize[ size ];
    const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
    const trackColor = value ? (dark ? "#81B8E7" : "#337EA9") : (dark ? "#5B5B59" : "#D0D0CC");
    const pressStyle = useCallback(({ pressed }: { pressed: boolean }) => [
        styles.track,
        {
            backgroundColor: trackColor,
            borderRadius: dimensions.height / 2,
            height: dimensions.height,
            opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
            width: dimensions.width
        },
        style
    ], [ dimensions.height, dimensions.width, disabled, style, trackColor ]);
    const thumbStyle = useMemo(() => [
        styles.thumb,
        {
            borderRadius: dimensions.thumb / 2,
            height: dimensions.thumb,
            width: dimensions.thumb
        }
    ], [ dimensions.thumb ]);
    const onPress = useCallback(() => onValueChange?.(!value), [ onValueChange, value ]);

    useEffect(() =>
    {
        Animated.timing(progress, {
            duration: 150,
            toValue: value ? 1 : 0,
            useNativeDriver: true
        }).start();
    }, [ progress, value ]);

    return <Pressable
        accessibilityLabel={ accessibilityLabel }
        accessibilityRole="switch"
        accessibilityState={ { checked: value, disabled } }
        disabled={ disabled }
        onPress={ onPress }
        style={ pressStyle }>
        <View pointerEvents="none" style={ styles.thumbViewport }>
            <Animated.View
                style={ [
                    thumbStyle,
                    {
                        transform: [ {
                            translateX: progress.interpolate({
                                inputRange: [ 0, 1 ],
                                outputRange: [ 0, dimensions.travel ]
                            })
                        } ]
                    }
                ] } />
        </View>
    </Pressable>;
}

const styles = StyleSheet.create({
    thumb:
    {
        backgroundColor: "#FFFFFF",
        borderColor: "rgba(15, 15, 15, 0.10)",
        borderWidth: StyleSheet.hairlineWidth,
        elevation: 2,
        shadowColor: "#000000",
        shadowOffset: { height: 1, width: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 1.5
    },
    thumbViewport:
    {
        justifyContent: "center",
        padding: 2
    },
    track:
    {
        justifyContent: "center",
        padding: 2
    }
});
