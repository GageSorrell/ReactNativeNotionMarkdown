/* Fixture examples retain source ordering and complete Markdown lines. */
/* eslint-disable sort-imports, sort-keys, @stylistic/max-len */

/**
 *
 *
 * @module notion-markdown-storybook/Stories/Renderer.stories
 *
 * @file      Renderer.stories.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { useCallback, useMemo, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-native";
import { Asset } from "expo-asset";
import { Pressable, ScrollView, Text, View } from "react-native";
import { fromNotionBlocks, parseNotionMarkdown } from "react-native-notion-markdown/renderer";
import { NotionMarkdownRenderer } from "react-native-notion-markdown/renderer/ui";
import type { NotionMediaRequest } from "react-native-notion-markdown/renderer/ui";

const catalog = [
    "# Renderer catalog {color=\"blue\"}",
    "<table_of_contents/>",
    "Paragraph **bold** *italic* ~~strike~~ <span underline=\"true\">underlined</span> <span color=\"red\">red</span> <span color=\"yellow_bg\">highlighted</span> `code` [link](https://example.com).",
    "Inline $x^2 + y^2$ <mention-user url=\"{{user://abc123}}\">Ada</mention-user> <mention-date start=\"2026-09-16\"/> :sparkles: [^https://example.com/source] <br>next line.",
    "<mention-page url=\"page://demo\">Demo page</mention-page> <mention-database url=\"database://demo\">Demo database</mention-database> <mention-data-source url=\"source://demo\">Source</mention-data-source> <mention-agent url=\"agent://demo\">Agent</mention-agent>.",
    "<empty-block/>",
    "## Lists and containers",
    "- Bullet",
    "\t- Nested bullet",
    "1. First",
    "1. Second",
    "- [x] Finished task",
    "- [ ] Pending task",
    "> Quote one<br>quote two",
    "<details color=\"gray_bg\">",
    "<summary>Tap to expand</summary>",
    "\tHidden paragraph",
    "</details>",
    "### Toggle heading {toggle=\"true\"}",
    "\tHeading child",
    "#### Fourth-level heading",
    "<callout icon=\"💡\" color=\"yellow_bg\">",
    "\tCallout text",
    "\t- Callout child",
    "</callout>",
    "---",
    "```typescript",
    "const answer = 42;",
    "```",
    "## Table and columns",
    "<table fit-page-width=\"true\" header-row=\"true\" header-column=\"true\">",
    "\t<colgroup>",
    "\t\t<col color=\"blue_bg\">",
    "\t</colgroup>",
    "\t<tr color=\"green_bg\"><td color=\"red_bg\">Cell wins</td><td>Row wins</td></tr>",
    "\t<tr><td>Column wins</td><td>Plain cell</td></tr>",
    "</table>",
    "<columns>",
    "\t<column>",
    "\t\tLeft column",
    "\t</column>",
    "\t<column>",
    "\t\tRight column",
    "\t</column>",
    "</columns>",
    "## References and previews",
    "<page url=\"https://example.com/page\">Local page</page>",
    "<database url=\"https://example.com/database\" inline=\"true\">Local database</database>",
    "<bookmark src=\"https://example.com\">Example bookmark</bookmark>",
    "<embed src=\"https://example.com/embed\">Example embed</embed>",
    "<synced_block url=\"sync://demo\">",
    "\tShared local content",
    "</synced_block>",
    "<synced_block_reference url=\"sync://demo\">",
    "</synced_block_reference>",
    "![Local image](fixture://image)",
    "<audio src=\"fixture://audio\">Local audio</audio>",
    "<video src=\"fixture://video\">Local video</video>",
    "<file src=\"fixture://pdf\">Local file</file>",
    "<pdf src=\"fixture://pdf\">Local PDF</pdf>",
    "$$",
    "\\frac{1}{2}",
    "$$",
    "```mermaid",
    "flowchart LR",
    "  A[Start] --> B[Done]",
    "```"
].join("\n");

const fixtures: Record<string, number> = {
    "fixture://image": require("../fixtures/preview.png"),
    "fixture://audio": require("../fixtures/preview.wav"),
    "fixture://video": require("../fixtures/preview.mp4"),
    "fixture://pdf": require("../fixtures/preview.pdf")
};

async function resolveFixture(request: NotionMediaRequest): Promise<string | null>
{
    const module = request.url ? fixtures[request.url] : undefined;
    if (!module) {return null;}
    const asset = await Asset.fromModule(module).downloadAsync();
    return asset.localUri ?? asset.uri;
}

function CatalogStory()
{
    const [ useDocument, setUseDocument ] = useState(false);
    const [ dark, setDark ] = useState(false);
    const [ diagnostics, setDiagnostics ] = useState(0);
    const document = useMemo(() => parseNotionMarkdown(catalog).document, []);
    const onDiagnostics = useCallback((items: ReadonlyArray<unknown>) => setDiagnostics(items.length), []);
    return <View style={ { flex: 1, backgroundColor: dark ? "#191919" : "#fff" } }>
        <View style={ { flexDirection: "row", gap: 12, padding: 8 } }>
            <Pressable accessibilityLabel="Switch renderer input"
                accessibilityRole="button"
                onPress={ () => setUseDocument((value) => !value) }>
                <Text style={ { color: dark ? "#fff" : "#222" } }>Input: {useDocument ? "document" : "markdown"}</Text>
            </Pressable>
            <Pressable accessibilityLabel="Toggle dark mode"
                accessibilityRole="button"
                onPress={ () => setDark((value) => !value) }>
                <Text style={ { color: dark ? "#fff" : "#222" } }>{dark ? "Light" : "Dark"} · {diagnostics} diagnostics</Text>
            </Pressable>
        </View>
        {useDocument
            ? <NotionMarkdownRenderer colorScheme={ dark ? "dark" : "light" }
                document={ document }
                onDiagnostics={ onDiagnostics }
                resolveMediaUrl={ resolveFixture } />
            : <NotionMarkdownRenderer colorScheme={ dark ? "dark" : "light" }
                markdown={ catalog }
                onDiagnostics={ onDiagnostics }
                resolveMediaUrl={ resolveFixture } />}
    </View>;
}

function FailureStory()
{
    const markdown = "# Failure states\n![Missing image](fixture://missing)\n<audio src=\"fixture://missing\">Missing audio</audio>\n<video src=\"fixture://missing\">Missing video</video>\n<file src=\"fixture://missing\">Missing file</file>\n<pdf src=\"fixture://missing\">Missing PDF</pdf>\n$$\n\\invalid{\n$$\n```mermaid\nnot a diagram\n```";
    return <View style={ { flex: 1 } }><NotionMarkdownRenderer markdown={ markdown }
        resolveMediaUrl={ resolveFixture } /></View>;
}

function ResolverStory()
{
    const [ replace, setReplace ] = useState(false);
    const expiredCalls = useRef(0);
    const markdown = replace ? "# Replacement document\nNo stale reference should appear." : "# Resolver state\n<page url=\"page://remote\">Loading page</page>\n<synced_block_reference url=\"sync://remote\">\n</synced_block_reference>\n![Remote image](https://example.com/remote-image.png)\n<file src=\"expired://file\">Expired file URL; retry after resolution</file>";
    const resolveReference = useCallback(async () =>
    {
        await new Promise((done) => setTimeout(done, 500));
        return { label: "Resolved page", url: "https://example.com/page" };
    }, []);
    const resolveSyncedBlock = useCallback(async () =>
    {
        await new Promise((done) => setTimeout(done, 500));
        return parseNotionMarkdown("Resolved synced paragraph").document;
    }, []);
    const resolveMediaUrl = useCallback(async (request: NotionMediaRequest) =>
    {
        if (request.url === "expired://file")
        {
            expiredCalls.current += 1;
            return expiredCalls.current === 1 ? null : resolveFixture({ ...request, url: "fixture://pdf" });
        }
        return request.url ?? null;
    }, []);
    return <View style={ { flex: 1 } }>
        <Pressable accessibilityLabel="Replace document"
            accessibilityRole="button"
            onPress={ () => setReplace((value) => !value) }
            style={ { padding: 12 } }>
            <Text>Replace document</Text>
        </Pressable>
        <NotionMarkdownRenderer markdown={ markdown }
            resolveMediaUrl={ resolveMediaUrl }
            resolveReference={ resolveReference }
            resolveSyncedBlock={ resolveSyncedBlock } />
    </View>;
}

function MediaStory()
{
    console.log("M3_STORY_RENDER");
    const markdown = "# Offline media previews\n<audio src=\"fixture://audio\">Local audio</audio>\n<video src=\"fixture://video\">Local video</video>\n<file src=\"fixture://pdf\">Local file</file>\n<pdf src=\"fixture://pdf\">Local PDF</pdf>";
    return <NotionMarkdownRenderer markdown={ markdown }
        resolveMediaUrl={ resolveFixture } />;
}

function MathDiagramStory()
{
    const markdown = "# Equation and diagram previews\n$$\n\\frac{1}{2}\n$$\n```mermaid\nflowchart LR\n  A[Start] --> B[Done]\n```";
    return <NotionMarkdownRenderer markdown={ markdown } />;
}

function LayoutStory()
{
    const markdown = "# Layout and table precedence\n<columns>\n\t<column>\n\t\tFirst column\n\t</column>\n\t<column>\n\t\tSecond column\n\t</column>\n</columns>\n<table fit-page-width=\"true\" header-row=\"true\" header-column=\"true\">\n\t<colgroup>\n\t\t<col color=\"blue_bg\">\n\t</colgroup>\n\t<tr color=\"green_bg\"><td color=\"red_bg\">Cell wins</td><td>Row wins</td></tr>\n\t<tr><td>Column wins</td><td>Plain cell</td></tr>\n</table>";
    const imported = useMemo(() => fromNotionBlocks([ { id: "unsupported-demo", type: "widget", widget: { source: "imported fixture" } } ] as unknown as Parameters<typeof fromNotionBlocks>[0]).document, []);
    return <ScrollView horizontal>
        <View style={ { width: 320, height: 700, borderRightWidth: 1 } }>
            <Text>Narrow 320 px</Text>
            <NotionMarkdownRenderer markdown={ markdown } />
            <NotionMarkdownRenderer document={ imported } />
        </View>
        <View style={ { width: 800, height: 700 } }>
            <Text>Wide 800 px</Text>
            <NotionMarkdownRenderer markdown={ markdown } />
        </View>
    </ScrollView>;
}

const meta = { parameters: { layout: "fullscreen" }, title: "Milestone 3/Renderer" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const Catalog: Story = { render: () => <CatalogStory /> };
export const FailureStates: Story = { render: () => <FailureStory /> };
export const Resolvers: Story = { render: () => <ResolverStory /> };
export const MediaPreviews: Story = { render: () => <MediaStory /> };
export const MathAndMermaid: Story = { render: () => <MathDiagramStory /> };
export const LayoutAndImported: Story = { render: () => <LayoutStory /> };
