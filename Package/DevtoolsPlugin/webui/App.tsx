/**
 *
 *
 * @module @react-native-notion-markdown/devtools-plugin-webui/App
 *
 * @file      App.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Header, type TabName } from "./components/Header";
import { StyleSheet, View } from "react-native";
import { BlocksPanel } from "./components/BlocksPanel";
import { ConsolePanel } from "./components/ConsolePanel";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { StatusBar } from "expo-status-bar";
import { TimelinePanel } from "./components/TimelinePanel";
import { theme } from "./theme";
import { useDevToolsBridge } from "./hooks/useDevToolsBridge";
import { useState } from "react";

export default function App()
{
    const bridge = useDevToolsBridge();
    const [ activeTab, setActiveTab ] = useState<TabName>("Blocks");

    return (
        <View style={ styles.root }>
            <Header
                activeTab={ activeTab }
                connected={ bridge.connected }
                dark={ bridge.dark }
                lastMessageAt={ bridge.lastMessageAt }
                onSelectTab={ setActiveTab }
                snapshot={ bridge.snapshot }
            />
            <View style={ styles.body }>
                {activeTab === "Blocks" && <BlocksPanel snapshot={ bridge.snapshot } />}
                {activeTab === "Timeline" && (
                    <TimelinePanel
                        entries={ bridge.timeline }
                        onClear={ bridge.clearTimeline }
                    />
                )}
                {activeTab === "Console" && (
                    <ConsolePanel
                        onReplaceDocument={ bridge.replaceDocument }
                        onSendCommand={ bridge.sendCommand }
                        snapshot={ bridge.snapshot }
                    />
                )}
                {activeTab === "Diagnostics" && (
                    <DiagnosticsPanel
                        dark={ bridge.dark }
                        errors={ bridge.errors }
                        onClearErrors={ bridge.clearErrors }
                        onClearTimeline={ bridge.clearTimeline }
                        snapshot={ bridge.snapshot }
                        timeline={ bridge.timeline }
                    />
                )}
            </View>
            <StatusBar style="light" />
        </View>
    );
}

const styles = StyleSheet.create({
    body: { flex: 1 },
    root: { backgroundColor: theme.background, flex: 1 }
});
