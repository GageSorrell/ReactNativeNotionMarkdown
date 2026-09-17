/**
 * @module notion-markdown-storybook/Application/Stories/NotionMarkdown.stories
 *
 * @file      NotionMarkdown.stories.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Meta, StoryObj } from "@storybook/react-native";
import { StyleSheet, Text, View } from "react-native";
import { CreateProofDocument } from "react-native-notion-markdown";
import { NativeProofEditor } from "react-native-notion-markdown/native";

const meta = {
    parameters: { layout: "centered" },
    render: () => (
        <View style={ styles.container }>
            <Text style={ styles.title }>NotionMarkdown</Text>
            <NativeProofEditor snapshot={ CreateProofDocument() }
                style={ styles.editor } />
        </View>
    ),
    title: "Native module/NotionMarkdown"
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Hello: Story = { };

/** Styles for the native smoke story. */
const styles = StyleSheet.create({
    container: { alignItems: "center", gap: 12, padding: 24 },
    editor: { height: 320, width: 300 },
    title: { fontSize: 20, fontWeight: "600" }
});
