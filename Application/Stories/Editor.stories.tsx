/**
 * @module notion-markdown-storybook/Stories/Editor.stories
 *
 * @file      Editor.stories.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    type EditorMessageId,
    NotionEditor,
    NotionEditorConfigProvider,
    type NotionEditorCustomButton,
    type NotionEditorCustomPanelContext,
    type NotionEditorMessageDescriptor,
    type NotionEditorTranslate
} from "react-native-notion-markdown/editor/ui";
import type { Meta, StoryObj } from "@storybook/react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Sparkles, Star } from "lucide-react-native";
import type { ComponentProps, ComponentType } from "react";
import { notionEditorLucideIcons } from "react-native-notion-markdown/editor/ui/lucide-icons";

/** Content for the "AI Tools" custom panel -- demonstrates the render-context contract. */
function AiToolsPanel({ close, foreground, panelBackground }: NotionEditorCustomPanelContext)
{
    return <View style={ { backgroundColor: panelBackground, flex: 1, gap: 12 } }>
        <Text style={ { color: foreground, fontSize: 15 } }>Custom panel content goes here.</Text>
        <Pressable onPress={ close }>
            <Text style={ { color: foreground } }>Close</Text>
        </Pressable>
    </View>;
}

const customButtons: Array<NotionEditorCustomButton> =
    [
        {
            after: "insert",
            icon: Star,
            id: "highlight",
            label: "Highlight",
            onPress: () => { }
        },
        {
            before: "edit",
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

/** Plain-object translations--no i18n framework required. */
const frenchMessages: Partial<Record<EditorMessageId, string>> =
    {
        "insertPanel.heading1": "Titre 1",
        "insertPanel.heading2": "Titre 2",
        "insertPanel.heading3": "Titre 3",
        "insertPanel.heading4": "Titre 4",
        "insertPanel.text": "Bloc de texte",
        "insertPanel.returnToKeyboard": "Retour au clavier",
        "insertPanel.title": "Blocs de base",
        "toolbar.back": "Retour",
        "toolbar.copy": "Copier",
        "toolbar.cut": "Couper",
        "toolbar.edit": "Modifier",
        "toolbar.hideKeyboard": "Masquer le clavier",
        "toolbar.insert": "Insérer",
        "toolbar.paste": "Coller"
    };

const translateFrench: NotionEditorTranslate = (Message: NotionEditorMessageDescriptor) =>
    frenchMessages[Message.id] ?? Message.defaultMessage;
const frenchLocalization = { translate: translateFrench };

const editorStoryRender = (args: ComponentProps<typeof NotionEditor>) => (
    <View style={ [ styles.page, args.dark && styles.darkPage ] }>
        <View style={ styles.titleContainer }>
            <Text style={ [ styles.pageTitle, args.dark && styles.darkPageTitle ] }>Editor</Text>
        </View>
        <NotionEditor
            { ...args }
            style={ [ styles.editor, args.style ] }
        />
    </View>
);

const styles = StyleSheet.create({
    editor:
    {
        flex: 1
    },
    darkPage:
    {
        backgroundColor: "#191919"
    },
    darkPageTitle:
    {
        color: "#eeeeee"
    },
    page:
    {
        backgroundColor: "#ffffff",
        flex: 1
    },
    pageTitle:
    {
        color: "#2C2C2B",
        fontSize: 36,
        fontWeight: "700",
        marginBottom: 28
    },
    titleContainer:
    {
        paddingHorizontal: 20,
        paddingTop: 24
    }
});

const meta =
    {
        argTypes:
        {
            components: { control: false },
            style: { control: false }
        },
        args:
        {
            components: notionEditorLucideIcons
        },
        component: NotionEditor,
        parameters:
        {
            layout: "fullscreen"
        },
        render: editorStoryRender,
        title: "Editor"
    } satisfies Meta<typeof NotionEditor>;

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
            dark: true,
            style: { flex: 1 }
        }
    };

export const CustomButtons: Story =
    {
        args:
        {
            customButtons,
            style: { flex: 1 }
        }
    };

export const Localized: Story =
    {
        args:
        {
            style: { flex: 1 }
        },
        decorators:
        [
            (StoryComponent: ComponentType) => <NotionEditorConfigProvider
                localization={ frenchLocalization }>
                <StoryComponent />
            </NotionEditorConfigProvider>
        ]
    };
