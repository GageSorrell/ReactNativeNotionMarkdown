/**
 * Shared ternary light/dark/system theme override for Storybook story files. `ThemeOverrideProvider`
 * holds the override state, `useThemeOverride`/`useEffectiveColorScheme` read it, and
 * `ThemeToggleButton` renders the control itself -- callers place the button (typically opposite a
 * story's title) and decide how "system" should resolve for their own default appearance.
 *
 * Storybook's on-device runtime has no dark-mode addon wired up here, so story files needing a
 * light/dark/system toggle share this module rather than reaching into the renderer's or editor's
 * own theming.
 *
 * @module markdown-storybook/Stories/themeToggle
 *
 * @file      themeToggle.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { ComponentType, ReactNode } from "react";
import { Keyboard, KeyboardOff, Monitor, Moon, Sun } from "lucide-react-native";
import { KeyboardController, useKeyboardState } from "react-native-keyboard-controller";
import { Pressable, StyleSheet, useColorScheme } from "react-native";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

/** The user's chosen appearance -- "system" defers to whatever each consumer treats as its default. */
export type ThemeOverride = "light" | "dark" | "system";

const themeOverrideCycle: ReadonlyArray<ThemeOverride> = [ "system", "light", "dark" ] as const;

const themeOverrideIcons: Record<ThemeOverride, ComponentType<{
    readonly color: string;
    readonly size: number;
    readonly strokeWidth: number;
}>> = {
    dark: Moon,
    light: Sun,
    system: Monitor
};

/** Selects only keyboard visibility so the toggle re-renders on show/hide events. */
function keyboardVisibilitySelector(state: { readonly isVisible: boolean }): boolean
{
    return state.isVisible;
}

interface ThemeOverrideContextValue
{
    readonly override: ThemeOverride;
    readonly setOverride: (override: ThemeOverride) => void;
}

const ThemeOverrideContext = createContext<ThemeOverrideContextValue>({
    override: "system",
    setOverride: () => undefined
});

interface ThemeOverrideProviderProps
{
    readonly children: ReactNode;
}

/** Owns the light/dark/system override state and makes it available to everything below it. */
export function ThemeOverrideProvider({ children }: ThemeOverrideProviderProps)
{
    const [ override, setOverride ] = useState<ThemeOverride>("system");
    const value = useMemo(() => ({ override, setOverride }), [ override ]);

    return <ThemeOverrideContext.Provider value={ value }>
        { children }
    </ThemeOverrideContext.Provider>;
}

/** Reads the current override and the setter that drives {@link ThemeToggleButton}. */
export function useThemeOverride(): ThemeOverrideContextValue
{
    return useContext(ThemeOverrideContext);
}

/** The effective scheme after applying the override -- "system" falls back to the OS setting. */
export function useEffectiveColorScheme(): "light" | "dark"
{
    const systemColorScheme = useColorScheme();
    const { override } = useThemeOverride();
    if (override === "system")
    {
        return systemColorScheme === "dark" ? "dark" : "light";
    }
    return override;
}

interface ThemeToggleButtonProps
{
    readonly dark: boolean;
}

/**
 * Ternary light/dark/system control. Tapping it cycles through system -> light -> dark ->
 * system, overriding the effective scheme for every consumer of {@link useThemeOverride} or
 * {@link useEffectiveColorScheme} below it in the tree, except while set back to "system".
 */
export function ThemeToggleButton({ dark }: ThemeToggleButtonProps)
{
    const { override, setOverride } = useThemeOverride();

    const handlePress = useCallback(
        () =>
        {
            const currentIndex = themeOverrideCycle.indexOf(override);
            const nextOverride = themeOverrideCycle[(currentIndex + 1) % themeOverrideCycle.length];
            setOverride(nextOverride);
        },
        [ override, setOverride ]
    );

    const buttonStyle = useMemo(
        () => [ themeToggleStyles.button, dark && themeToggleStyles.buttonDark ],
        [ dark ]
    );

    const Icon = themeOverrideIcons[override];
    const iconColor = dark ? "#e6e6e6" : "#2c2c2b";

    return <Pressable
        accessibilityLabel={ `Theme: ${ override }` }
        accessibilityRole="button"
        hitSlop={ 8 }
        onPress={ handlePress }
        style={ buttonStyle }>
        <Icon
            color={ iconColor }
            size={ 18 }
            strokeWidth={ 2 }
        />
    </Pressable>;
}

interface KeyboardToggleButtonProps
{
    readonly dark: boolean;
}

/** Toggles the active keyboard while reflecting visibility changes made elsewhere in the app. */
export function KeyboardToggleButton({ dark }: KeyboardToggleButtonProps)
{
    const isKeyboardVisible = useKeyboardState(keyboardVisibilitySelector);
    const handlePress = useCallback(() =>
    {
        if (isKeyboardVisible)
        {
            void KeyboardController.dismiss({ keepFocus: true });
        }
        else
        {
            KeyboardController.setFocusTo("current");
        }
    }, [ isKeyboardVisible ]);
    const Icon = isKeyboardVisible ? KeyboardOff : Keyboard;
    const iconColor = dark ? "#e6e6e6" : "#2c2c2b";
    const accessibilityLabel = isKeyboardVisible ? "Hide keyboard" : "Show keyboard";
    const buttonStyle = useMemo(
        () => [ themeToggleStyles.button, dark && themeToggleStyles.buttonDark ],
        [ dark ]
    );

    return <Pressable
        accessibilityLabel={ accessibilityLabel }
        accessibilityRole="button"
        hitSlop={ 8 }
        onPress={ handlePress }
        style={ buttonStyle }>
        <Icon
            color={ iconColor }
            size={ 18 }
            strokeWidth={ 2 }
        />
    </Pressable>;
}

const themeToggleStyles = StyleSheet.create({
    button:
    {
        alignItems: "center",
        backgroundColor: "#f1f1ef",
        borderRadius: 8,
        height: 32,
        justifyContent: "center",
        width: 32
    },
    buttonDark:
    {
        backgroundColor: "#2f2f2f"
    }
});
