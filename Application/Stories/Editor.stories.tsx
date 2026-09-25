/**
 * @module markdown-storybook/Stories/Editor.stories
 *
 * @file      Editor.stories.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { ComponentProps, ComponentType } from "react";
import {
    MarkdownEditor,
    type MarkdownEditorColorPanel,
    type MarkdownEditorCustomButton,
    type MarkdownEditorCustomPanelContext,
    type MarkdownEditorInsertContext,
    type MarkdownEditorInsertPanel,
    type MarkdownEditorToolbar,
    type MarkdownEditorTurnIntoPanel,
    type MarkdownMessageDescriptor,
    type MarkdownMessageId,
    MarkdownProvider,
    type MarkdownTranslate,
    defaultMarkdownEditorInsertSections,
    defaultMarkdownEditorToolbar
} from "react-native-notion-markdown/editor/ui";
import type { Meta, StoryObj } from "@storybook/react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CalendarDays, Sparkles, Star } from "lucide-react-native";
import {
    KeyboardToggleButton,
    ThemeOverrideProvider,
    ThemeToggleButton,
    useThemeOverride
} from "./themeToggle";
import { useEffect, useState } from "react";
import { Asset } from "expo-asset";
import type { EditorSnapshot } from "react-native-notion-markdown";
import { markdownEditorLucideIcons } from "react-native-notion-markdown/editor/ui/lucide-icons";
import { sepiaTheme } from "./customTheme";

/* Bundled Pexels stock photos used to seed the "With Images" story's starter document. */
const stockImageModules =
    {
        coffee: require("../fixtures/stock/editor-coffee.jpg"),
        laptop: require("../fixtures/stock/editor-laptop.jpg"),
        mountains: require("../fixtures/stock/editor-mountains.jpg")
    } as const;

type StockImageKey = keyof typeof stockImageModules;

/* Download the bundled stock photos and resolve each to a local file URI the native editor can
   decode -- it only reads `content`/`file` schemes, never a remote URL. */
async function resolveStockImageUris(): Promise<Record<StockImageKey, string>>
{
    const keys = Object.keys(stockImageModules) as Array<StockImageKey>;
    const entries = await Promise.all(keys.map(async (key: StockImageKey) =>
    {
        const asset = await Asset.fromModule(stockImageModules[key]).downloadAsync();
        return [ key, asset.localUri ?? asset.uri ] as const;
    }));
    return Object.fromEntries(entries) as Record<StockImageKey, string>;
}

/* Seed document for the "With Images" story: the three stock photos above, interleaved with a
   handful of other block types to show the editor starting from a populated page. */
function buildRichSnapshot(images: Record<StockImageKey, string>): EditorSnapshot
{
    const caption = "The ridge line just past the tree line.";
    const intro = "A few photos and a running list from Saturday's hike, dropped into the editor.";

    return {
        blocks:
        [
            { id: "rich:title", text: "Weekend trail notes", type: "heading_1" },
            { id: "rich:intro", text: intro, type: "text" },
            { id: "rich:mountains", text: "", type: "image", url: images.mountains },
            {
                id: "rich:caption",
                marks: [ { end: caption.length, kind: "italic", start: 0 } ],
                text: caption,
                type: "text"
            },
            { id: "rich:list-1", text: "Left the trailhead at sunrise", type: "bulleted_list_item" },
            { id: "rich:list-2", text: "Stopped for coffee at basecamp", type: "bulleted_list_item" },
            { id: "rich:coffee", text: "", type: "image", url: images.coffee },
            { id: "rich:divider", text: "", type: "divider" },
            { id: "rich:todo-heading", text: "Still to do", type: "heading_2" },
            { checked: true, id: "rich:todo-1", text: "Back up today's photos", type: "to_do" },
            { checked: false, id: "rich:todo-2", text: "Write up the trail notes", type: "to_do" },
            { id: "rich:laptop", text: "", type: "image", url: images.laptop },
            {
                icon: "🔋",
                id: "rich:callout",
                text: "Remember to charge the drone battery before next weekend.",
                type: "callout"
            },
            { id: "rich:callout-empty", text: "", type: "callout" }
        ],
        epoch: 1,
        revision: 0
    };
}

/** Content for the "AI Tools" custom panel -- demonstrates the render-context contract. */
function AiToolsPanel({ close, theme }: MarkdownEditorCustomPanelContext)
{
    const { background, foreground } = theme.editor.panel;

    return <View style={ { backgroundColor: background, flex: 1, gap: 12 } }>
        <Text style={ { color: foreground, fontSize: 15 } }>Custom panel content goes here.</Text>
        <Pressable onPress={ close }>
            <Text style={ { color: foreground } }>Close</Text>
        </Pressable>
    </View>;
}

const customButtons: Array<MarkdownEditorCustomButton> =
    [
        {
            icon: Star,
            id: "highlight",
            label: "Highlight",
            onPress: () => { }
        },
        {
            icon: Sparkles,
            id: "ai-tools",
            label: "AI Tools",
            panel:
            {
                height: 160,
                render: AiToolsPanel
            }
        }
    ];

/* Positions come from the toolbar list: "Highlight" right after "Insert", "AI Tools" right before
   the page-reference "Edit" button. */
const customButtonsToolbar: MarkdownEditorToolbar =
    {
        main: defaultMarkdownEditorToolbar.main.flatMap((id: string) =>
            id === "insert" ? [ id, "highlight" ] : id === "edit" ? [ "ai-tools", id ] : [ id ])
    };

/* The "Toolbar Layout" story: trimmed, reordered rows; a custom insert item; smaller pickers. */
const toolbarLayout: MarkdownEditorToolbar =
    {
        format: [ "bold", "italic", "link" ],
        main: [ "insert", "format", "turnInto", "highlight", "undo", "redo" ]
    };
const toolbarLayoutInsertPanel: MarkdownEditorInsertPanel =
    {
        sections:
        [
            {
                id: "favorites",
                items:
                [
                    "text",
                    "heading1",
                    "toDo",
                    "divider",
                    {
                        icon: CalendarDays,
                        id: "today",
                        label: "Today's date",
                        onPress: ({ close }: MarkdownEditorInsertContext) => close()
                    }
                ],
                title: "Favorites"
            },
            ...defaultMarkdownEditorInsertSections.filter((section: { readonly id: string }) => section.id === "media")
        ]
    };
const toolbarLayoutTurnInto: MarkdownEditorTurnIntoPanel = { items: [ "text", "heading_1", "heading_2" ] };
const toolbarLayoutColors: MarkdownEditorColorPanel =
    {
        background: [ "yellow", "green" ],
        showDefault: false,
        text: [ "red", "blue", "purple" ]
    };

/** Plain-object translations--no i18n framework required. */
const frenchMessages: Partial<Record<MarkdownMessageId, string>> =
    {
        "insertPanel.heading1": "Titre 1",
        "insertPanel.heading2": "Titre 2",
        "insertPanel.heading3": "Titre 3",
        "insertPanel.heading4": "Titre 4",
        "insertPanel.returnToKeyboard": "Retour au clavier",
        "insertPanel.text": "Bloc de texte",
        "insertPanel.title": "Blocs de base",
        "toolbar.back": "Retour",
        "toolbar.copy": "Copier",
        "toolbar.cut": "Couper",
        "toolbar.edit": "Modifier",
        "toolbar.hideKeyboard": "Masquer le clavier",
        "toolbar.insert": "Insérer",
        "toolbar.paste": "Coller"
    };

const translateFrench: MarkdownTranslate = (Message: MarkdownMessageDescriptor) =>
    frenchMessages[Message.id] ?? Message.defaultMessage;
const frenchLocalization = { translate: translateFrench };

/**
 * Renders the "With Images" story: same page chrome as {@link EditorStoryRender}, but the editor
 * doesn't mount until the bundled stock photos have downloaded to local file URIs, and it's seeded
 * with {@link buildRichSnapshot} instead of the package's plain three-block starter document.
 */
function RichDocumentEditorStory(args: ComponentProps<typeof MarkdownEditor>)
{
    const { override } = useThemeOverride();
    const dark = override === "system" ? args.colorScheme === "dark" : override === "dark";
    const [ snapshot, setSnapshot ] = useState<EditorSnapshot>();

    useEffect(() =>
    {
        let cancelled = false;
        resolveStockImageUris().then((images: Record<StockImageKey, string>) =>
        {
            if (!cancelled) { setSnapshot(buildRichSnapshot(images)); }
        });
        return () => { cancelled = true; };
    }, [ ]);

    return <View style={ [ styles.page, dark && styles.darkPage ] }>
        <View style={ styles.titleContainer }>
            <Text style={ [ styles.pageTitle, dark && styles.darkPageTitle ] }>Editor</Text>
            <View style={ styles.titleActions }>
                <KeyboardToggleButton dark={ dark } />
                <ThemeToggleButton dark={ dark } />
            </View>
        </View>
        {
            snapshot === undefined
                ? null
                : <MarkdownEditor
                    { ...args }
                    colorScheme={ dark ? "dark" : "light" }
                    snapshot={ snapshot }
                    style={ [ styles.editor, args.style ] }
                />
        }
    </View>;
}

/**
 * Renders the editor story page. The story's own `colorScheme` arg is the default appearance; the
 * upper-right `ThemeToggleButton`, opposite the "Editor" title, overrides it unless left on
 * "system".
 */
function EditorStoryRender(args: ComponentProps<typeof MarkdownEditor>)
{
    const { override } = useThemeOverride();
    const dark = override === "system" ? args.colorScheme === "dark" : override === "dark";

    return <View style={ [ styles.page, dark && styles.darkPage ] }>
        <View style={ styles.titleContainer }>
            <Text style={ [ styles.pageTitle, dark && styles.darkPageTitle ] }>Editor</Text>
            <View style={ styles.titleActions }>
                <KeyboardToggleButton dark={ dark } />
                <ThemeToggleButton dark={ dark } />
            </View>
        </View>
        <MarkdownEditor
            { ...args }
            colorScheme={ dark ? "dark" : "light" }
            style={ [ styles.editor, args.style ] }
        />
    </View>;
}

/** Gives every Editor story its own light/dark/system override, independent of other story files. */
const withThemeOverride = (StoryComponent: ComponentType) => (
    <ThemeOverrideProvider>
        <StoryComponent />
    </ThemeOverrideProvider>
);

const styles = StyleSheet.create({
    darkPage:
    {
        backgroundColor: "#191919"
    },
    darkPageTitle:
    {
        color: "#EEEEEE"
    },
    editor:
    {
        flex: 1
    },
    page:
    {
        backgroundColor: "#FFFFFF",
        flex: 1
    },
    pageTitle:
    {
        color: "#2C2C2B",
        fontSize: 36,
        fontWeight: "700",
        marginBottom: 16
    },
    titleActions:
    {
        flexDirection: "row",
        gap: 8
    },
    titleContainer:
    {
        alignItems: "flex-start",
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 28,
        paddingTop: 24
    }
});

const meta =
    {
        argTypes:
        {
            icons: { control: false },
            style: { control: false }
        },
        args:
        {
            icons: markdownEditorLucideIcons
        },
        component: MarkdownEditor,
        decorators: [ withThemeOverride ],
        parameters:
        {
            controls: { exclude: [ "icons", "style" ] },
            layout: "fullscreen"
        },
        render: EditorStoryRender,
        title: "Editor"
    } satisfies Meta<typeof MarkdownEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story =
    {
        args:
        {
            style: { flex: 1 }
        }
    };

export const Dark: Story =
    {
        args:
        {
            colorScheme: "dark",
            style: { flex: 1 }
        }
    };

export const CustomButtons: Story =
    {
        args:
        {
            customButtons,
            style: { flex: 1 },
            toolbar: customButtonsToolbar
        }
    };

export const ToolbarLayout: Story =
    {
        args:
        {
            colorPanel: toolbarLayoutColors,
            customButtons: [ customButtons[ 0 ] as MarkdownEditorCustomButton ],
            insertPanel: toolbarLayoutInsertPanel,
            style: { flex: 1 },
            toolbar: toolbarLayout,
            turnIntoPanel: toolbarLayoutTurnInto
        }
    };

export const CustomTheme: Story =
    {
        args:
        {
            style: { flex: 1 }
        },
        decorators:
        [
            (StoryComponent: ComponentType) => <MarkdownProvider theme={ sepiaTheme }>
                <StoryComponent />
            </MarkdownProvider>
        ]
    };

export const Localized: Story =
    {
        args:
        {
            style: { flex: 1 }
        },
        decorators:
        [
            (StoryComponent: ComponentType) => <MarkdownProvider
                localization={ frenchLocalization }>
                <StoryComponent />
            </MarkdownProvider>
        ]
    };

export const WithImages: Story =
    {
        args:
        {
            style: { flex: 1 }
        },
        render: (args: ComponentProps<typeof MarkdownEditor>) => <RichDocumentEditorStory { ...args } />
    };

export const Table: Story =
    {
        args:
        {
            snapshot:
            {
                blocks:
                [
                    {
                        id: "table:demo",
                        table:
                        {
                            columnColors: [ undefined, "blue_bg", undefined ],
                            fitPageWidth: true,
                            headerColumn: true,
                            headerRow: true,
                            rows:
                            [
                                {
                                    cells:
                                    [
                                        { text: "Feature", marks: [ { end: 7, kind: "bold", start: 0 } ] },
                                        { text: "Status", marks: [ { end: 6, kind: "bold", start: 0 } ] },
                                        { text: "Owner", marks: [ { end: 5, kind: "bold", start: 0 } ] }
                                    ]
                                },
                                {
                                    cells:
                                    [
                                        { text: "Editable cells" },
                                        { color: "green_bg", text: "Ready" },
                                        { text: "Ada" }
                                    ],
                                    color: "gray_bg"
                                },
                                {
                                    cells:
                                    [
                                        { text: "Rich text" },
                                        { color: "yellow_bg", text: "In progress" },
                                        { text: "Lin" }
                                    ]
                                }
                            ]
                        },
                        text: "",
                        type: "table"
                    },
                    { id: "table:after", text: "Tap a cell to edit it.", type: "text" }
                ],
                epoch: 1,
                revision: 0
            },
            style: { flex: 1 }
        }
    };

export const Callout: Story =
    {
        args:
        {
            snapshot:
            {
                blocks:
                [
                    { id: "callout:intro", text: "Paragraph block for layout measurements.", type: "text" },
                    {
                        color: "green_bg",
                        icon: "☝️",
                        id: "callout:tinted",
                        text: "Foo. Bar",
                        type: "callout"
                    },
                    { id: "callout:foreground", text: "Foreground color", type: "callout", color: "blue" },
                    { id: "callout:after", text: "Heading 1 block", type: "heading_1" }
                ],
                epoch: 1,
                revision: 0
            },
            style: { flex: 1 }
        }
    };

export const Quote: Story =
    {
        args:
        {
            snapshot:
            {
                blocks:
                [
                    { id: "quote:intro", text: "Paragraph block for layout measurements.", type: "text" },
                    { id: "quote:default", text: "Wisdom often comes in a plain quote.", type: "quote" },
                    { color: "purple", id: "quote:foreground", text: "A quote in purple.", type: "quote" },
                    {
                        id: "quote:long",
                        text: "A longer quote that wraps, to verify the border bar keeps its full height.",
                        type: "quote"
                    },
                    { id: "quote:after", text: "Heading 1 block", type: "heading_1" }
                ],
                epoch: 1,
                revision: 0
            },
            style: { flex: 1 }
        }
    };
