/**
 * One story per Notion-enhanced Markdown block. Each story builds a small Markdown snippet from
 * its Storybook controls and feeds it straight to the renderer, so every control change is a
 * live demonstration of how that block renders. `table_row` and `column`/`column_list` have no
 * standalone story since they only render meaningfully inside a `table` or `column_list` parent
 * -- the Table and Columns stories exercise them instead.
 *
 * @module notion-markdown-storybook/Stories/Blocks.stories
 *
 * @file      Blocks.stories.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Decorator, Meta, StoryObj } from "@storybook/react-native";
import { Text as StoryHeaderText, StyleSheet, View } from "react-native";
import type { NotionDocument } from "react-native-notion-markdown/document";
import { NotionMarkdownRenderer } from "react-native-notion-markdown/renderer/ui";
import type { ReactNode } from "react";
import { notionMarkdownInterFonts } from "react-native-notion-markdown/renderer/ui/inter-font";
import { parseNotionMarkdown } from "react-native-notion-markdown/renderer";
import { resolveFixture } from "./fixtures";
import { useCallback, useMemo } from "react";
import { useFonts } from "expo-font";

const colorOptions =
    [
        "default",
        "gray",
        "brown",
        "orange",
        "yellow",
        "green",
        "blue",
        "purple",
        "pink",
        "red",
        "gray_bg",
        "brown_bg",
        "orange_bg",
        "yellow_bg",
        "green_bg",
        "blue_bg",
        "purple_bg",
        "pink_bg",
        "red_bg"
    ] as const;

type ColorArg = typeof colorOptions[number];

const booleanArgType = { control: { type: "boolean" } } as const;
const textArgType = { control: { type: "text" } } as const;
const colorArgType = { control: { type: "select" }, options: colorOptions } as const;

function numberArgType(min: number, max: number)
{
    return { control: { max, min, type: "number" } } as const;
}

/** A trailing `{color="..."}` block attribute, as accepted after text/list/quote/heading lines. */
function lineColorAttr(color: ColorArg): string
{
    return color === "default" ? "" : ` {color="${ color }"}`;
}

/** A `color="..."` tag attribute, as accepted by container/media tags like `<callout>`. */
function tagColorAttr(color: ColorArg): string
{
    return color === "default" ? "" : ` color="${ color }"`;
}

interface BlockCanvasProps
{
    readonly dark: boolean;
    readonly markdown: string;
    readonly resolveSyncedBlock?: (url: string) => Promise<NotionDocument | null>;
}

/**
 * Small caption preceding each story's live example -- distinct from the big Notion-style page
 * title `StoryHeaderFrame` renders above it. React Native Storybook has no Docs/MDX addon here,
 * so there's no built-in way to label multiple examples within one story; this is a plain shared
 * component instead, reusable once per example if a story ever grows to show more than one.
 */
function ExampleLabel({ dark }: { readonly dark: boolean })
{
    return <StoryHeaderText style={ [ exampleStyles.label, dark && exampleStyles.labelDark ] }>
        Example
    </StoryHeaderText>;
}

/** Renders one block's Markdown through the real renderer, matching the story's dark-mode control. */
function BlockCanvas({ dark, markdown, resolveSyncedBlock }: BlockCanvasProps)
{
    return <View style={ { backgroundColor: dark ? "#191919" : "#fff", flex: 1 } }>
        <ExampleLabel dark={ dark } />
        <NotionMarkdownRenderer colorScheme={ dark ? "dark" : "light" }
            markdown={ markdown }
            resolveMediaUrl={ resolveFixture }
            resolveSyncedBlock={ resolveSyncedBlock } />
    </View>;
}

const exampleStyles = StyleSheet.create({
    label:
    {
        color: "#737373",
        fontSize: 12,
        fontWeight: "600",
        letterSpacing: 0.6,
        paddingBottom: 6,
        paddingHorizontal: 16,
        paddingTop: 14,
        textTransform: "uppercase"
    },
    labelDark:
    {
        color: "#a0a0a0"
    }
});

interface StoryHeaderFrameProps
{
    readonly children: ReactNode;
    readonly name: string;
}

/**
 * A "template page" shared by every story in this file: a fixed header styled like a Notion page
 * title, with the story's own render output filling the rest of the screen below it. Loads the
 * optional Inter Black face for that title via {@link notionMarkdownInterFonts} -- while it's
 * loading (or if the optional peers aren't installed at all), the title still reads as bold via
 * `fontWeight`, just in the platform's system font instead of true Inter Black.
 */
function StoryHeaderFrame({ children, name }: StoryHeaderFrameProps)
{
    const [ interLoaded ] = useFonts(notionMarkdownInterFonts);
    const titleStyle = useMemo(
        () => [ headerStyles.headerText, interLoaded && headerStyles.headerTextInter ],
        [ interLoaded ]
    );

    return <View style={ headerStyles.page }>
        <View style={ headerStyles.header }>
            <StoryHeaderText style={ titleStyle }>{ name }</StoryHeaderText>
        </View>
        <View style={ headerStyles.body }>
            { children }
        </View>
    </View>;
}

/**
 * Storybook decorators receive the story context as their second argument, which is where
 * `name` comes from--there is no per-story JSX change needed to get this.
 */
const withStoryHeader: Decorator = (StoryComponent: any, context: any) => (
    <StoryHeaderFrame name={ context.name }>
        <StoryComponent />
    </StoryHeaderFrame>
);

const headerStyles = StyleSheet.create({
    body: { flex: 1 },
    header:
    {
        backgroundColor: "#ff00ff",
        paddingHorizontal: 24,
        paddingTop: 28
    },
    headerText:
    {
        color: "#2C2C2B",
        fontSize: 40,
        fontWeight: "900",
        marginBottom: 24
    },
    headerTextInter:
    {
        fontFamily: "Inter-Black"
    },
    page: { flex: 1 }
});

const meta =
    {
        decorators: [ withStoryHeader ],
        parameters: { controls: { exclude: [ "components", "style" ] }, layout: "fullscreen" },
        title: "Renderer/Blocks"
    } satisfies Meta;
export default meta;

/**
 * Each story has its own args shape, so it types against a `Meta` of that shape rather than
 *  the shared, argument-less default export above.
 */
type BlockStory<Args> = StoryObj<Meta<Args>>;

//#region Text

interface TextArgs
{
    readonly bold: boolean;
    readonly code: boolean;
    readonly color: ColorArg;
    readonly dark: boolean;
    readonly italic: boolean;
    readonly strikethrough: boolean;
    readonly text: string;
    readonly underline: boolean;
}

function TextStory({ bold, code, color, dark, italic, strikethrough, text, underline }: TextArgs)
{
    let content = text;
    if (code) {content = `\`${ content }\``;}
    if (bold) {content = `**${ content }**`;}
    if (italic) {content = `*${ content }*`;}
    if (strikethrough) {content = `~~${ content }~~`;}
    if (underline) {content = `<span underline="true">${ content }</span>`;}
    return <BlockCanvas dark={ dark }
        markdown={ `${ content }${ lineColorAttr(color) }` } />;
}

export const Text: BlockStory<TextArgs> =
    {
        argTypes:
        {
            bold: booleanArgType,
            code: booleanArgType,
            color: colorArgType,
            dark: booleanArgType,
            italic: booleanArgType,
            strikethrough: booleanArgType,
            text: textArgType,
            underline: booleanArgType
        },
        args:
        {
            bold: true,
            code: false,
            color: "default",
            dark: false,
            italic: false,
            strikethrough: false,
            text: "The quick brown fox jumps over the lazy dog.",
            underline: false
        },
        render: (args: TextArgs) => <TextStory { ...args } />
    };

//#endregion Text
//#region Heading

const headingLevels = [ 1, 2, 3, 4 ] as const;

type HeadingLevel = typeof headingLevels[number];

const headingLevelArgType = { control: { type: "inline-radio" }, options: headingLevels } as const;

interface HeadingArgs
{
    readonly color: ColorArg;
    readonly dark: boolean;
    readonly level: HeadingLevel;
    readonly text: string;
}

function HeadingStory({ color, dark, level, text }: HeadingArgs)
{
    const markdown = `${ "#".repeat(level) } ${ text }${ lineColorAttr(color) }`;
    return <BlockCanvas dark={ dark }
        markdown={ markdown } />;
}

export const Heading: BlockStory<HeadingArgs> =
    {
        argTypes:
        {
            color: colorArgType,
            dark: booleanArgType,
            level: headingLevelArgType,
            text: textArgType
        },
        args:
        {
            color: "default",
            dark: false,
            level: 1,
            text: "Heading text"
        },
        render: (args: HeadingArgs) => <HeadingStory { ...args } />
    };

//#endregion Heading
//#region Toggle heading

interface ToggleHeadingArgs
{
    readonly childBulletText: string;
    readonly closingText: string;
    readonly color: ColorArg;
    readonly dark: boolean;
    readonly level: HeadingLevel;
    readonly openingText: string;
    readonly text: string;
}

function ToggleHeadingStory({
    childBulletText,
    closingText,
    color,
    dark,
    level,
    openingText,
    text
}: ToggleHeadingArgs)
{
    const attrs = color === "default" ? "toggle=\"true\"" : `toggle="true" color="${ color }"`;
    const headingLine = `${ "#".repeat(level) } ${ text } {${ attrs }}`;
    const children = [ `\t${ openingText }`, `\t- ${ childBulletText }`, `\t${ closingText }` ].join("\n");
    return <BlockCanvas dark={ dark }
        markdown={ `${ headingLine }\n${ children }` } />;
}

export const ToggleHeading: BlockStory<ToggleHeadingArgs> =
    {
        argTypes:
        {
            childBulletText: textArgType,
            closingText: textArgType,
            color: colorArgType,
            dark: booleanArgType,
            level: headingLevelArgType,
            openingText: textArgType,
            text: textArgType
        },
        args:
        {
            childBulletText: "Documented the toggle heading variant",
            closingText: "Thanks for reading!",
            color: "default",
            dark: false,
            level: 1,
            openingText: "Shipped the block gallery story.",
            text: "Release notes"
        },
        render: (args: ToggleHeadingArgs) => <ToggleHeadingStory { ...args } />
    };

//#endregion Toggle heading
//#region Bulleted list item

interface BulletedListItemArgs
{
    readonly color: ColorArg;
    readonly dark: boolean;
    readonly nestedText: string;
    readonly text: string;
}

function BulletedListItemStory({ color, dark, nestedText, text }: BulletedListItemArgs)
{
    const line = `- ${ text }${ lineColorAttr(color) }`;
    const markdown = nestedText === "" ? line : `${ line }\n\t- ${ nestedText }`;
    return <BlockCanvas dark={ dark }
        markdown={ markdown } />;
}

export const BulletedListItem: BlockStory<BulletedListItemArgs> =
    {
        argTypes:
        {
            color: colorArgType,
            dark: booleanArgType,
            nestedText: textArgType,
            text: textArgType
        },
        args:
        {
            color: "default",
            dark: false,
            nestedText: "Nested bullet",
            text: "Bulleted item"
        },
        render: (args: BulletedListItemArgs) => <BulletedListItemStory { ...args } />
    };

//#endregion Bulleted list item
//#region Numbered list item

interface NumberedListItemArgs
{
    readonly color: ColorArg;
    readonly dark: boolean;
    readonly firstText: string;
    readonly secondText: string;
}

function NumberedListItemStory({ color, dark, firstText, secondText }: NumberedListItemArgs)
{
    const first = `1. ${ firstText }${ lineColorAttr(color) }`;
    const second = `1. ${ secondText }${ lineColorAttr(color) }`;
    const markdown = `${ first }\n${ second }`;
    return <BlockCanvas dark={ dark }
        markdown={ markdown } />;
}

export const NumberedListItem: BlockStory<NumberedListItemArgs> =
    {
        argTypes:
        {
            color: colorArgType,
            dark: booleanArgType,
            firstText: textArgType,
            secondText: textArgType
        },
        args:
        {
            color: "default",
            dark: false,
            firstText: "First item",
            secondText: "Second item"
        },
        render: (args: NumberedListItemArgs) => <NumberedListItemStory { ...args } />
    };

//#endregion Numbered list item
//#region To-do

interface ToDoArgs
{
    readonly checked: boolean;
    readonly color: ColorArg;
    readonly dark: boolean;
    readonly text: string;
}

function ToDoStory({ checked, color, dark, text }: ToDoArgs)
{
    const markdown = `- [${ checked ? "x" : " " }] ${ text }${ lineColorAttr(color) }`;
    return <BlockCanvas dark={ dark }
        markdown={ markdown } />;
}

export const ToDo: BlockStory<ToDoArgs> =
    {
        argTypes:
        {
            checked: booleanArgType,
            color: colorArgType,
            dark: booleanArgType,
            text: textArgType
        },
        args:
        {
            checked: false,
            color: "default",
            dark: false,
            text: "Finish the block gallery"
        },
        render: (args: ToDoArgs) => <ToDoStory { ...args } />
    };

//#endregion To-do
//#region Quote

interface QuoteArgs
{
    readonly color: ColorArg;
    readonly dark: boolean;
    readonly text: string;
}

function QuoteStory({ color, dark, text }: QuoteArgs)
{
    return <BlockCanvas dark={ dark }
        markdown={ `> ${ text }${ lineColorAttr(color) }` } />;
}

export const Quote: BlockStory<QuoteArgs> =
    {
        argTypes:
        {
            color: colorArgType,
            dark: booleanArgType,
            text: textArgType
        },
        args:
        {
            color: "default",
            dark: false,
            text: "Simplicity is the ultimate sophistication."
        },
        render: (args: QuoteArgs) => <QuoteStory { ...args } />
    };

//#endregion Quote
//#region Toggle

interface ToggleArgs
{
    readonly body: string;
    readonly color: ColorArg;
    readonly dark: boolean;
    readonly summary: string;
}

function ToggleStory({ body, color, dark, summary }: ToggleArgs)
{
    const markdown = `<details${ tagColorAttr(color) }>\n`
        + `<summary>${ summary }</summary>\n\t${ body }\n</details>`;
    return <BlockCanvas dark={ dark }
        markdown={ markdown } />;
}

export const Toggle: BlockStory<ToggleArgs> =
    {
        argTypes:
        {
            body: textArgType,
            color: colorArgType,
            dark: booleanArgType,
            summary: textArgType
        },
        args:
        {
            body: "Hidden until the toggle is opened.",
            color: "default",
            dark: false,
            summary: "Tap to expand"
        },
        render: (args: ToggleArgs) => <ToggleStory { ...args } />
    };

//#endregion Toggle
//#region Callout

interface CalloutArgs
{
    readonly color: ColorArg;
    readonly dark: boolean;
    readonly icon: string;
    readonly text: string;
}

function CalloutStory({ color, dark, icon, text }: CalloutArgs)
{
    const markdown = `<callout icon="${ icon }"${ tagColorAttr(color) }>\n\t${ text }\n</callout>`;
    return <BlockCanvas dark={ dark }
        markdown={ markdown } />;
}

export const Callout: BlockStory<CalloutArgs> =
    {
        argTypes:
        {
            color: colorArgType,
            dark: booleanArgType,
            icon: textArgType,
            text: textArgType
        },
        args:
        {
            color: "yellow_bg",
            dark: false,
            icon: "💡",
            text: "Callouts draw attention to important context."
        },
        render: (args: CalloutArgs) => <CalloutStory { ...args } />
    };

//#endregion Callout
//#region Code

const codeLanguages =
    [
        "typescript",
        "javascript",
        "python",
        "json",
        "bash",
        "html",
        "css",
        "markdown",
        "plain text",
        "mermaid"
    ] as const;

interface CodeArgs
{
    readonly code: string;
    readonly dark: boolean;
    readonly language: typeof codeLanguages[number];
}

function CodeStory({ code, dark, language }: CodeArgs)
{
    return <BlockCanvas dark={ dark }
        markdown={ `\`\`\`${ language }\n${ code }\n\`\`\`` } />;
}

export const Code: BlockStory<CodeArgs> =
    {
        argTypes:
        {
            code: textArgType,
            dark: booleanArgType,
            language: { control: { type: "select" }, options: codeLanguages }
        },
        args:
        {
            code: "const answer = 42;\nconsole.log(answer);",
            dark: false,
            language: "typescript"
        },
        render: (args: CodeArgs) => <CodeStory { ...args } />
    };

//#endregion Code
//#region Equation

interface EquationArgs
{
    readonly dark: boolean;
    readonly expression: string;
}

function EquationStory({ dark, expression }: EquationArgs)
{
    return <BlockCanvas dark={ dark }
        markdown={ `$$\n${ expression }\n$$` } />;
}

export const Equation: BlockStory<EquationArgs> =
    {
        argTypes:
        {
            dark: booleanArgType,
            expression: textArgType
        },
        args:
        {
            dark: false,
            expression: "\\frac{1}{2}"
        },
        render: (args: EquationArgs) => <EquationStory { ...args } />
    };

//#endregion Equation
//#region Divider

interface DividerArgs
{
    readonly aboveText: string;
    readonly belowText: string;
    readonly dark: boolean;
}

function DividerStory({ aboveText, belowText, dark }: DividerArgs)
{
    return <BlockCanvas dark={ dark }
        markdown={ `${ aboveText }\n---\n${ belowText }` } />;
}

export const Divider: BlockStory<DividerArgs> =
    {
        argTypes:
        {
            aboveText: textArgType,
            belowText: textArgType,
            dark: booleanArgType
        },
        args:
        {
            aboveText: "Above the divider",
            belowText: "Below the divider",
            dark: false
        },
        render: (args: DividerArgs) => <DividerStory { ...args } />
    };

//#endregion Divider
//#region Table

interface TableArgs
{
    readonly columnCount: number;
    readonly dark: boolean;
    readonly fitPageWidth: boolean;
    readonly headerColor: ColorArg;
    readonly headerColumn: boolean;
    readonly headerRow: boolean;
    readonly rowCount: number;
}

function TableStory({
    columnCount,
    dark,
    fitPageWidth,
    headerColor,
    headerColumn,
    headerRow,
    rowCount
}: TableArgs)
{
    const rows: Array<string> = [ ];
    for (let row = 0; row < rowCount; row += 1)
    {
        const cells: Array<string> = [ ];
        for (let column = 0; column < columnCount; column += 1)
        {
            const label = row === 0 && headerRow ? `Header ${ column + 1 }` : `R${ row + 1 }C${ column + 1 }`;
            cells.push(`<td>${ label }</td>`);
        }
        const rowAttr = row === 0 && headerRow ? tagColorAttr(headerColor) : "";
        rows.push(`\t<tr${ rowAttr }>${ cells.join("") }</tr>`);
    }
    const markdown = `<table fit-page-width="${ fitPageWidth }" header-row="${ headerRow }" `
        + `header-column="${ headerColumn }">\n${ rows.join("\n") }\n</table>`;
    return <BlockCanvas dark={ dark }
        markdown={ markdown } />;
}

export const Table: BlockStory<TableArgs> =
    {
        argTypes:
        {
            columnCount: numberArgType(1, 4),
            dark: booleanArgType,
            fitPageWidth: booleanArgType,
            headerColor: colorArgType,
            headerColumn: booleanArgType,
            headerRow: booleanArgType,
            rowCount: numberArgType(1, 5)
        },
        args:
        {
            columnCount: 2,
            dark: false,
            fitPageWidth: true,
            headerColor: "default",
            headerColumn: true,
            headerRow: true,
            rowCount: 3
        },
        render: (args: TableArgs) => <TableStory { ...args } />
    };

//#endregion Table
//#region Columns (column_list / column)

interface ColumnsArgs
{
    readonly columnCount: number;
    readonly dark: boolean;
    readonly firstText: string;
    readonly secondText: string;
    readonly thirdText: string;
}

function ColumnsStory({ columnCount, dark, firstText, secondText, thirdText }: ColumnsArgs)
{
    const texts = [ firstText, secondText, thirdText ].slice(0, columnCount);
    const body = texts.flatMap((text: string) => [ "\t<column>", `\t\t${ text }`, "\t</column>" ]);
    return <BlockCanvas dark={ dark }
        markdown={ [ "<columns>", ...body, "</columns>" ].join("\n") } />;
}

export const Columns: BlockStory<ColumnsArgs> =
    {
        argTypes:
        {
            columnCount: numberArgType(2, 3),
            dark: booleanArgType,
            firstText: textArgType,
            secondText: textArgType,
            thirdText: textArgType
        },
        args:
        {
            columnCount: 2,
            dark: false,
            firstText: "Left column",
            secondText: "Right column",
            thirdText: "Third column"
        },
        render: (args: ColumnsArgs) => <ColumnsStory { ...args } />
    };

//#endregion Columns (column_list / column)
//#region Image

interface ImageArgs
{
    readonly caption: string;
    readonly dark: boolean;
    readonly url: string;
}

function ImageStory({ caption, dark, url }: ImageArgs)
{
    return <BlockCanvas dark={ dark }
        markdown={ `![${ caption }](${ url })` } />;
}

export const Image: BlockStory<ImageArgs> =
    {
        argTypes:
        {
            caption: textArgType,
            dark: booleanArgType,
            url: textArgType
        },
        args:
        {
            caption: "Local preview image",
            dark: false,
            url: "fixture://image"
        },
        render: (args: ImageArgs) => <ImageStory { ...args } />
    };

//#endregion Image
//#region Audio / Video / File / Pdf

interface MediaTagArgs
{
    readonly caption: string;
    readonly dark: boolean;
    readonly url: string;
}

function mediaTagStory(tag: "audio" | "video" | "file" | "pdf" | "embed" | "bookmark")
{
    return function MediaTagStory({ caption, dark, url }: MediaTagArgs)
    {
        const markdown = `<${ tag } src="${ url }">${ caption }</${ tag }>`;
        return <BlockCanvas dark={ dark }
            markdown={ markdown } />;
    };
}

const mediaTagArgTypes = { caption: textArgType, dark: booleanArgType, url: textArgType };

export const Audio: BlockStory<MediaTagArgs> =
    {
        argTypes: mediaTagArgTypes,
        args: { caption: "Local preview audio", dark: false, url: "fixture://audio" },
        render: (args: MediaTagArgs) => mediaTagStory("audio")(args)
    };

export const Video: BlockStory<MediaTagArgs> =
    {
        argTypes: mediaTagArgTypes,
        args: { caption: "Local preview video", dark: false, url: "fixture://video" },
        render: (args: MediaTagArgs) => mediaTagStory("video")(args)
    };

export const File: BlockStory<MediaTagArgs> =
    {
        argTypes: mediaTagArgTypes,
        args: { caption: "Local preview file", dark: false, url: "fixture://pdf" },
        render: (args: MediaTagArgs) => mediaTagStory("file")(args)
    };

export const Pdf: BlockStory<MediaTagArgs> =
    {
        argTypes: mediaTagArgTypes,
        args: { caption: "Local preview PDF", dark: false, url: "fixture://pdf" },
        render: (args: MediaTagArgs) => mediaTagStory("pdf")(args)
    };

//#endregion Audio / Video / File / Pdf
//#region Embed / Bookmark

export const Embed: BlockStory<MediaTagArgs> =
    {
        argTypes: mediaTagArgTypes,
        args: { caption: "Example embed", dark: false, url: "https://example.com/embed" },
        render: (args: MediaTagArgs) => mediaTagStory("embed")(args)
    };

export const Bookmark: BlockStory<MediaTagArgs> =
    {
        argTypes: mediaTagArgTypes,
        args: { caption: "Example bookmark", dark: false, url: "https://example.com" },
        render: (args: MediaTagArgs) => mediaTagStory("bookmark")(args)
    };

//#endregion Embed / Bookmark
//#region Link to page

interface LinkToPageArgs
{
    readonly dark: boolean;
    readonly kind: "page" | "database";
    readonly label: string;
    readonly url: string;
}

function LinkToPageStory({ dark, kind, label, url }: LinkToPageArgs)
{
    return <BlockCanvas dark={ dark }
        markdown={ `<${ kind } url="${ url }">${ label }</${ kind }>` } />;
}

export const LinkToPage: BlockStory<LinkToPageArgs> =
    {
        argTypes:
        {
            dark: booleanArgType,
            kind: { control: { type: "radio" }, options: [ "page", "database" ] },
            label: textArgType,
            url: textArgType
        },
        args:
        {
            dark: false,
            kind: "page",
            label: "Roadmap",
            url: "https://example.com/roadmap"
        },
        render: (args: LinkToPageArgs) => <LinkToPageStory { ...args } />
    };

//#endregion Link to page
//#region Table of contents

interface TableOfContentsArgs
{
    readonly color: ColorArg;
    readonly dark: boolean;
    readonly headingCount: number;
}

function TableOfContentsStory({ color, dark, headingCount }: TableOfContentsArgs)
{
    const headings = Array.from(
        { length: headingCount },
        (_value: unknown, index: number) => `## Heading ${ index + 1 }`
    ).join("\n");
    const prefix = headings === "" ? "" : `${ headings }\n`;
    const markdown = `${ prefix }<table_of_contents${ tagColorAttr(color) }/>`;
    return (
        <BlockCanvas
            dark={ dark }
            markdown={ markdown }
        />
    );
}

export const TableOfContents: BlockStory<TableOfContentsArgs> =
    {
        argTypes:
        {
            color: colorArgType,
            dark: booleanArgType,
            headingCount: numberArgType(0, 6)
        },
        args:
        {
            color: "default",
            dark: false,
            headingCount: 3
        },
        render: (args: TableOfContentsArgs) => <TableOfContentsStory { ...args } />
    };

//#endregion Table of contents
//#region Synced block

interface SyncedBlockArgs
{
    readonly content: string;
    readonly dark: boolean;
}

function SyncedBlockStory({ content, dark }: SyncedBlockArgs)
{
    const markdown = `<synced_block url="sync://demo">\n\t${ content }\n</synced_block>`;
    return <BlockCanvas dark={ dark }
        markdown={ markdown } />;
}

export const SyncedBlock: BlockStory<SyncedBlockArgs> =
    {
        argTypes:
        {
            content: textArgType,
            dark: booleanArgType
        },
        args:
        {
            content: "Shared local content",
            dark: false
        },
        render: (args: SyncedBlockArgs) => <SyncedBlockStory { ...args } />
    };

//#endregion Synced block
//#region Synced block reference

interface SyncedBlockReferenceArgs
{
    readonly dark: boolean;
    readonly resolved: boolean;
    readonly resolvedText: string;
    readonly url: string;
}

function SyncedBlockReferenceStory({ dark, resolved, resolvedText, url }: SyncedBlockReferenceArgs)
{
    const resolveSyncedBlock = useCallback(async () =>
    {
        if (!resolved) {return null;}
        return parseNotionMarkdown(resolvedText).document;
    }, [ resolved, resolvedText ]);

    const markdown = `<synced_block_reference url="${ url }">\n</synced_block_reference>`;

    return <BlockCanvas dark={ dark }
        markdown={ markdown }
        resolveSyncedBlock={ resolveSyncedBlock } />;
}

export const SyncedBlockReference: BlockStory<SyncedBlockReferenceArgs> =
    {
        argTypes:
        {
            dark: booleanArgType,
            resolved: booleanArgType,
            resolvedText: textArgType,
            url: textArgType
        },
        args:
        {
            dark: false,
            resolved: true,
            resolvedText: "Resolved synced text block",
            url: "sync://demo"
        },
        render: (args: SyncedBlockReferenceArgs) => <SyncedBlockReferenceStory { ...args } />
    };

//#endregion Synced block reference
