/**
 * @module notion-markdown-storybook/Application/App
 *
 * @file      App.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { view } from "./.rnstorybook/storybook.requires";

const StorybookUIRoot = view.getStorybookUI({
    initialSelection: "editor--default",
    shouldPersistSelection: true,
    storage:
    {
        getItem: AsyncStorage.getItem,
        setItem: AsyncStorage.setItem
    }
});

const rootStyle = { flex: 1 } as const;

/** Mount the native gesture, safe-area, and keyboard integrations around Storybook. */
export default function App()
{
    return (
        <GestureHandlerRootView style={ rootStyle }>
            <SafeAreaProvider>
                <KeyboardProvider>
                    <StorybookUIRoot />
                </KeyboardProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
