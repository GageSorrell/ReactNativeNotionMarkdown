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

/* eslint-disable sort-keys */

import type { Decorator, Meta, StoryObj } from "@storybook/react-native";
import { Text as StoryHeaderText, StyleSheet, View, type ViewStyle } from "react-native";
import { ThemeOverrideProvider, ThemeToggleButton, useEffectiveColorScheme } from "./themeToggle";
import { useCallback, useMemo } from "react";
import type { NotionDocument } from "react-native-notion-markdown/document";
import { NotionMarkdownRenderer } from "react-native-notion-markdown/renderer/ui";
import type { ReactNode } from "react";
import { notionMarkdownInterFonts } from "react-native-notion-markdown/renderer/ui/inter-font";
import { parseNotionMarkdown } from "react-native-notion-markdown/renderer";
import { resolveFixture } from "./fixtures";
import { useFonts } from "expo-font";

const Color =
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

/* eslint-disable-next-line @typescript-eslint/no-redeclare */
type Color = typeof Color[number];

const BooleanArg = { control: { type: "boolean" } } as const;
const TextArg = { control: { type: "text" } } as const;
const ColorArg =
    {
        control:
        {
            type: "select",
            labels:
            {
                default: "Default",
                gray: "Gray Text",
                brown: "Brown Text",
                orange: "Orange Text",
                yellow: "Yellow Text",
                green: "Green Text",
                blue: "Blue Text",
                purple: "Purple Text",
                pink: "Pink Text",
                red: "Red Text",
                gray_bg: "Gray Background",
                brown_bg: "Brown Background",
                orange_bg: "Orange Background",
                yellow_bg: "Yellow Background",
                green_bg: "Green Background",
                blue_bg: "Blue Background",
                purple_bg: "Purple Background",
                pink_bg: "Pink Background",
                red_bg: "Red Background"
            }
        },
        options: Color
    } as const;

function numberArgType(min: number, max: number)
{
    return { control: { max, min, type: "number" } } as const;
}

/** A trailing `{color="..."}` block attribute, as accepted after text/list/quote/heading lines. */
function lineColorAttr(color: Color): string
{
    return color === "default" ? "" : ` {color="${ color }"}`;
}

/** A `color="..."` tag attribute, as accepted by container/media tags like `<callout>`. */
function tagColorAttr(color: Color): string
{
    return color === "default" ? "" : ` color="${ color }"`;
}

interface BlockCanvasProps extends ExampleLabelProps
{
    readonly markdown: string;
    readonly resolveSyncedBlock?: (url: string) => Promise<NotionDocument | null>;
}

interface ExampleLabelProps
{
    readonly Label?: string;
}

/**
 * Small caption preceding each story's live example -- distinct from the big Notion-style page
 * title `StoryHeaderFrame` renders above it. React Native Storybook has no Docs/MDX addon here,
 * so there's no built-in way to label multiple examples within one story; this is a plain shared
 * component instead, reusable once per example if a story ever grows to show more than one.
 */
function ExampleLabel({ Label = "Example" }: ExampleLabelProps)
{
    const colorScheme = useEffectiveColorScheme();
    const dark = colorScheme === "dark";

    const Style = useMemo(
        () => [ exampleStyles.label, dark && exampleStyles.labelDark ],
        [ dark ]
    );
    return <StoryHeaderText style={ Style }>
        { Label }
    </StoryHeaderText>;
}

interface BlockCanvasContainerProps
{
    readonly Blocks: ReadonlyArray<BlockCanvasProps>;
}

function BlockCanvasContainer({ Blocks }: BlockCanvasContainerProps)
{
    const RootStyle = useMemo(
        (): ViewStyle => ({ flex: 1, alignItems: "stretch", justifyContent: "flex-start" }),
        [ ]
    );

    return (
        <View style={ RootStyle }>
            {
                Blocks.map(({
                    Label = "Example",
                    markdown,
                    resolveSyncedBlock
                }: BlockCanvasProps,
                Index: number
                ) => (
                    <BlockCanvas
                        Label={ Label }
                        key={ `${markdown.slice(0, 48)}-${ Index }` }
                        markdown={ markdown }
                        resolveSyncedBlock={ resolveSyncedBlock }
                    />
                ))
            }
        </View>
    );
}

/** Renders one block's Markdown through the real renderer, matching the story's dark-mode control. */
function BlockCanvas({ Label = "Example", markdown, resolveSyncedBlock }: BlockCanvasProps)
{
    const ColorScheme = useEffectiveColorScheme();
    const dark = ColorScheme === "dark";

    const RootStyle = useMemo(
        () => ({ backgroundColor: dark ? "#191919" : "#fff", flex: 1 }),
        [ dark ]
    );

    return (
        <View style={ RootStyle }>
            <ExampleLabel Label={ Label } />
            <View style={ { height: "100%" } }>
                <NotionMarkdownRenderer
                    colorScheme={ dark ? "dark" : "light" }
                    markdown={ markdown }
                    resolveMediaUrl={ resolveFixture }
                    resolveSyncedBlock={ resolveSyncedBlock }
                />
            </View>
        </View>
    );
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
 * `fontWeight`, just in the platform's system font instead of true Inter Black. The upper-right
 * `ThemeToggleButton`, opposite the title, overrides `useColorScheme` for every story canvas.
 */
function StoryHeaderFrame({ children, name }: StoryHeaderFrameProps)
{
    const [ interLoaded ] = useFonts(notionMarkdownInterFonts);
    const dark = useEffectiveColorScheme() === "dark";
    const titleStyle = useMemo(
        () => [ headerStyles.headerText, interLoaded && headerStyles.headerTextInter ],
        [ interLoaded ]
    );

    return <View style={ headerStyles.page }>
        <View style={ headerStyles.header }>
            <StoryHeaderText style={ titleStyle }>{ name }</StoryHeaderText>
            <ThemeToggleButton dark={ dark } />
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
    <ThemeOverrideProvider>
        <StoryHeaderFrame name={ context.name }>
            <StoryComponent />
        </StoryHeaderFrame>
    </ThemeOverrideProvider>
);

const headerStyles = StyleSheet.create({
    body: { flex: 1 },
    header:
    {
        alignItems: "flex-start",
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 24,
        paddingTop: 28
    },
    headerText:
    {
        color: "#2C2C2B",
        flexShrink: 1,
        fontSize: 40,
        fontWeight: "900",
        marginBottom: 24,
        marginRight: 12
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
    readonly Text: string;
    readonly Bold: boolean;
    readonly Color: Color;
    readonly InlineCode: boolean;
    readonly Italic: boolean;
    readonly Strikethrough: boolean;
    readonly Underline: boolean;
}

/* eslint-disable-next-line */
const LoremIpsum = "Lorem ipsum dolor sit amet consectetur adipiscing elit. Temporibus est anim magna dignissimos amet. Mollitia laboris corrupti sint possimus est dolore aliquip accusamus. Sint officia cillum autem assumenda irure duis libero praesentium ut dolore sint. Fuga autem aut dolores temporibus culpa praesentium nisi dolorum autem. Deserunt minim optio id adipiscing qui. Voluptate facilis exercitation provident dolor eiusmod nam. Dolores dolorum eiusmod ad quibusdam qui repellendus quod temporibus cupiditate. Autem possimus occaecat sit labore repellendus nihil aliquip voluptatum. Reprehenderit voluptas et deleniti similique libero dolorem veniam cupidatat consectetur assumenda culpa. Officia quas et omnis vel similique sint cupidatat nulla possimus. Quis mollit omnis id cumque placeat facere enim soluta dolorem.";

function TextStory({ Bold, Color, InlineCode, Italic, Strikethrough, Text: InText, Underline }: TextArgs)
{
    let content = InText;
    let loremIpsumContent = LoremIpsum;
    if (InlineCode)
    {
        content = `\`${ content }\``;
        loremIpsumContent = `\`${ loremIpsumContent }\``;
    }

    if (Bold)
    {
        content = `**${ content }**`;
        loremIpsumContent = `**${ loremIpsumContent }**`;
    }

    if (Italic)
    {
        content = `*${ content }*`;
        loremIpsumContent = `*${ loremIpsumContent }*`;
    }

    if (Strikethrough)
    {
        content = `~~${ content }~~`;
        loremIpsumContent = `~~${ loremIpsumContent }~~`;
    }

    if (Underline)
    {
        content = `<span underline="true">${ content }</span>`;
        loremIpsumContent = `<span underline="true">${ loremIpsumContent }</span>`;
    }

    const CustomTextExample = `${ content }${ lineColorAttr(Color) }`;
    const LoremIpsumExample = `${ loremIpsumContent }${ lineColorAttr(Color) }`;

    const Blocks: ReadonlyArray<BlockCanvasProps> =
        [
            {
                Label: "Custom Text",
                markdown: CustomTextExample
            },
            {
                Label: "Lorem Ipsum Sample",
                markdown: LoremIpsumExample
            }
        ] as const;

    return <BlockCanvasContainer Blocks={ Blocks } />;
}

export const Text: BlockStory<TextArgs> =
    {
        argTypes:
        {
            Text: TextArg,
            Color: ColorArg,
            Bold: BooleanArg,
            InlineCode:
            {
                ...BooleanArg,
                name: "Inline Code"
            },
            Italic: BooleanArg,
            Strikethrough: BooleanArg,
            Underline: BooleanArg
        },
        args:
        {
            Text: "The quick brown fox jumps over the lazy dog.",
            Color: "default",
            Bold: false,
            InlineCode: false,
            Italic: false,
            Strikethrough: false,
            Underline: false
        },
        render: (args: TextArgs) => <TextStory { ...args } />
    };

//#endregion Text
//#region Heading

const headingLevels = [ 1, 2, 3, 4 ] as const;

type HeadingLevel = typeof headingLevels[number];

const HeadingLevelArgType = { control: { type: "inline-radio" }, options: headingLevels } as const;

interface HeadingArgs
{
    readonly Text: string;
    readonly Color: Color;
    readonly Level: HeadingLevel;
}

function HeadingStory({ Color, Level, Text: InText }: HeadingArgs)
{
    const markdown = `${ "#".repeat(Level) } ${ InText }${ lineColorAttr(Color) }`;
    return <BlockCanvas markdown={ markdown } />;
}

export const Heading: BlockStory<HeadingArgs> =
    {
        argTypes:
        {
            Text: TextArg,
            Color: ColorArg,
            Level: HeadingLevelArgType
        },
        args:
        {
            Text: "Heading text",
            Color: "default",
            Level: 1
        },
        render: (args: HeadingArgs) => <HeadingStory { ...args } />
    };

//#endregion Heading
//#region Toggle heading

interface ToggleHeadingArgs
{
    readonly Text: string;
    readonly ChildBulletText: string;
    readonly ClosingText: string;
    readonly Color: Color;
    readonly Level: HeadingLevel;
    readonly OpeningText: string;
}

function ToggleHeadingStory({
    ChildBulletText,
    ClosingText,
    Color,
    Level,
    OpeningText,
    Text: InText
}: ToggleHeadingArgs)
{
    const attrs = Color === "default" ? "toggle=\"true\"" : `toggle="true" color="${ Color }"`;
    const headingLine = `${ "#".repeat(Level) } ${ InText } {${ attrs }}`;
    const children = [ `\t${ OpeningText }`, `\t- ${ ChildBulletText }`, `\t${ ClosingText }` ].join("\n");
    return <BlockCanvas markdown={ `${ headingLine }\n${ children }` } />;
}

export const ToggleHeading: BlockStory<ToggleHeadingArgs> =
    {
        argTypes:
        {
            Text: TextArg,
            ChildBulletText: TextArg,
            ClosingText: TextArg,
            Color: ColorArg,
            Level: HeadingLevelArgType,
            OpeningText: TextArg
        },
        args:
        {
            Text: "Release notes",
            ChildBulletText: "Documented the toggle heading variant",
            ClosingText: "Thanks for reading!",
            Color: "default",
            Level: 1,
            OpeningText: "Shipped the block gallery story."
        },
        render: (args: ToggleHeadingArgs) => <ToggleHeadingStory { ...args } />
    };

//#endregion Toggle heading
//#region Bulleted list item

interface BulletedListItemArgs
{
    readonly Text: string;
    readonly NestedText: string;
    readonly Color: Color;
}

function BulletedListItemStory({ Color, NestedText, Text: InText }: BulletedListItemArgs)
{
    const line = `- ${ InText }${ lineColorAttr(Color) }`;
    const markdown = NestedText === "" ? line : `${ line }\n\t- ${ NestedText }\n\t\t- ${ NestedText }`;
    return <BlockCanvas markdown={ markdown } />;
}

export const BulletedListItem: BlockStory<BulletedListItemArgs> =
    {
        argTypes:
        {
            Text: TextArg,
            NestedText: TextArg,
            Color: ColorArg
        },
        args:
        {
            Text: "Bulleted item",
            NestedText: "Nested bullet",
            Color: "default"
        },
        render: (args: BulletedListItemArgs) => <BulletedListItemStory { ...args } />
    };

//#endregion Bulleted list item
//#region Numbered list item

interface NumberedListItemArgs
{
    readonly FirstText: string;
    readonly SecondText: string;
    readonly Color: Color;
}

function NumberedListItemStory({ Color, FirstText, SecondText }: NumberedListItemArgs)
{
    const first = `1. ${ FirstText }${ lineColorAttr(Color) }`;
    const second = `1. ${ SecondText }${ lineColorAttr(Color) }`;
    const markdown = `${ first }\n${ second }`;
    return <BlockCanvas markdown={ markdown } />;
}

export const NumberedListItem: BlockStory<NumberedListItemArgs> =
    {
        argTypes:
        {
            Color: ColorArg,
            FirstText: TextArg,
            SecondText: TextArg
        },
        args:
        {
            Color: "default",
            FirstText: "First item",
            SecondText: "Second item"
        },
        render: (args: NumberedListItemArgs) => <NumberedListItemStory { ...args } />
    };

//#endregion Numbered list item
//#region To-do

interface ToDoArgs
{
    readonly Text: string;
    readonly Checked: boolean;
    readonly Color: Color;
}

function ToDoStory({ Checked, Color, Text: InText }: ToDoArgs)
{
    const markdown = `- [${ Checked ? "x" : " " }] ${ InText }${ lineColorAttr(Color) }`;
    return <BlockCanvas markdown={ markdown } />;
}

export const ToDo: BlockStory<ToDoArgs> =
    {
        argTypes:
        {
            Text: TextArg,
            Checked: BooleanArg,
            Color: ColorArg
        },
        args:
        {
            Text: "Finish the block gallery",
            Checked: false,
            Color: "default"
        },
        render: (args: ToDoArgs) => <ToDoStory { ...args } />
    };

//#endregion To-do
//#region Quote

interface QuoteArgs
{
    readonly Text: string;
    readonly Color: Color;
}

function QuoteStory({ Color, Text: text }: QuoteArgs)
{
    return <BlockCanvas markdown={ `> ${ text }${ lineColorAttr(Color) }` } />;
}

export const Quote: BlockStory<QuoteArgs> =
    {
        argTypes:
        {
            Text: TextArg,
            Color: ColorArg
        },
        args:
        {
            Text: "Simplicity is the ultimate sophistication.",
            Color: "default"
        },
        render: (args: QuoteArgs) => <QuoteStory { ...args } />
    };

//#endregion Quote
//#region Toggle

interface ToggleArgs
{
    readonly Body: string;
    readonly Color: Color;
    readonly Summary: string;
}

function ToggleStory({ Body: body, Color: color, Summary: summary }: ToggleArgs)
{
    const markdown = `<details${ tagColorAttr(color) }>\n`
        + `<summary>${ summary }</summary>\n\t${ body }\n</details>`;
    return <BlockCanvas markdown={ markdown } />;
}

export const Toggle: BlockStory<ToggleArgs> =
    {
        argTypes:
        {
            Body: TextArg,
            Color: ColorArg,
            Summary: TextArg
        },
        args:
        {
            Body: "Hidden until the toggle is opened.",
            Color: "default",
            Summary: "Tap to expand"
        },
        render: (args: ToggleArgs) => <ToggleStory { ...args } />
    };

//#endregion Toggle
//#region Callout

interface CalloutArgs
{
    readonly Text: string;
    readonly Color: Color;
    readonly Icon: string;
}

function CalloutStory({ Color: color, Icon: icon, Text: text }: CalloutArgs)
{
    const markdown = `<callout icon="${ icon }"${ tagColorAttr(color) }>\n\t${ text }\n</callout>`;
    return <BlockCanvas markdown={ markdown } />;
}

export const Callout: BlockStory<CalloutArgs> =
    {
        argTypes:
        {
            Text: TextArg,
            Color: ColorArg,
            Icon: TextArg
        },
        args:
        {
            Text: "Callouts draw attention to important context.",
            Color: "purple_bg",
            Icon: "💡"
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
    readonly language: typeof codeLanguages[number];
}

function CodeStory({ code, language }: CodeArgs)
{
    return <BlockCanvas markdown={ `\`\`\`${ language }\n${ code }\n\`\`\`` } />;
}

export const Code: BlockStory<CodeArgs> =
    {
        argTypes:
        {
            code: TextArg,
            language: { control: { type: "select" }, options: codeLanguages }
        },
        args:
        {
            code: "const answer = 42;\nconsole.log(answer);",
            language: "typescript"
        },
        render: (args: CodeArgs) => <CodeStory { ...args } />
    };

//#endregion Code
//#region Equation

interface EquationArgs
{
    readonly expression: string;
}

function EquationStory({ expression }: EquationArgs)
{
    return <BlockCanvas markdown={ `$$\n${ expression }\n$$` } />;
}

export const Equation: BlockStory<EquationArgs> =
    {
        argTypes:
        {
            expression: TextArg
        },
        args:
        {
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
}

function DividerStory({ aboveText, belowText }: DividerArgs)
{
    return <BlockCanvas markdown={ `${ aboveText }\n---\n${ belowText }` } />;
}

export const Divider: BlockStory<DividerArgs> =
    {
        argTypes:
        {
            aboveText: TextArg,
            belowText: TextArg
        },
        args:
        {
            aboveText: "Above the divider",
            belowText: "Below the divider"
        },
        render: (args: DividerArgs) => <DividerStory { ...args } />
    };

//#endregion Divider
//#region Table

interface TableArgs
{
    readonly columnCount: number;
    readonly fitPageWidth: boolean;
    readonly headerColor: Color;
    readonly headerColumn: boolean;
    readonly headerRow: boolean;
    readonly rowCount: number;
}

function TableStory({
    columnCount,
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
    return <BlockCanvas markdown={ markdown } />;
}

export const Table: BlockStory<TableArgs> =
    {
        argTypes:
        {
            columnCount: numberArgType(1, 4),
            fitPageWidth: BooleanArg,
            headerColor: ColorArg,
            headerColumn: BooleanArg,
            headerRow: BooleanArg,
            rowCount: numberArgType(1, 5)
        },
        args:
        {
            columnCount: 2,
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
    readonly firstText: string;
    readonly secondText: string;
    readonly thirdText: string;
}

function ColumnsStory({ columnCount, firstText, secondText, thirdText }: ColumnsArgs)
{
    const texts = [ firstText, secondText, thirdText ].slice(0, columnCount);
    const body = texts.flatMap((text: string) => [ "\t<column>", `\t\t${ text }`, "\t</column>" ]);
    return <BlockCanvas markdown={ [ "<columns>", ...body, "</columns>" ].join("\n") } />;
}

export const Columns: BlockStory<ColumnsArgs> =
    {
        argTypes:
        {
            columnCount: numberArgType(2, 3),
            firstText: TextArg,
            secondText: TextArg,
            thirdText: TextArg
        },
        args:
        {
            columnCount: 2,
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
    readonly url: string;
}

function ImageStory({ caption, url }: ImageArgs)
{
    return <BlockCanvas markdown={ `![${ caption }](${ url })` } />;
}

export const Image: BlockStory<ImageArgs> =
    {
        argTypes:
        {
            caption: TextArg,
            url: TextArg
        },
        args:
        {
            caption: "Local preview image",
            url: "fixture://image"
        },
        render: (args: ImageArgs) => <ImageStory { ...args } />
    };

//#endregion Image
//#region Audio / Video / File / Pdf

interface MediaTagArgs
{
    readonly caption: string;
    readonly url: string;
}

function mediaTagStory(tag: "audio" | "video" | "file" | "pdf" | "embed" | "bookmark")
{
    return function MediaTagStory({ caption, url }: MediaTagArgs)
    {
        const markdown = `<${ tag } src="${ url }">${ caption }</${ tag }>`;
        return <BlockCanvas markdown={ markdown } />;
    };
}

const mediaTagArgTypes = { caption: TextArg, url: TextArg };

export const Audio: BlockStory<MediaTagArgs> =
    {
        argTypes: mediaTagArgTypes,
        args: { caption: "Local preview audio", url: "fixture://audio" },
        render: (args: MediaTagArgs) => mediaTagStory("audio")(args)
    };

export const Video: BlockStory<MediaTagArgs> =
    {
        argTypes: mediaTagArgTypes,
        args: { caption: "Local preview video", url: "fixture://video" },
        render: (args: MediaTagArgs) => mediaTagStory("video")(args)
    };

export const File: BlockStory<MediaTagArgs> =
    {
        argTypes: mediaTagArgTypes,
        args: { caption: "Local preview file", url: "fixture://pdf" },
        render: (args: MediaTagArgs) => mediaTagStory("file")(args)
    };

export const Pdf: BlockStory<MediaTagArgs> =
    {
        argTypes: mediaTagArgTypes,
        args: { caption: "Local preview PDF", url: "fixture://pdf" },
        render: (args: MediaTagArgs) => mediaTagStory("pdf")(args)
    };

//#endregion Audio / Video / File / Pdf
//#region Embed / Bookmark

export const Embed: BlockStory<MediaTagArgs> =
    {
        argTypes: mediaTagArgTypes,
        args: { caption: "Example embed", url: "https://example.com/embed" },
        render: (args: MediaTagArgs) => mediaTagStory("embed")(args)
    };

export const Bookmark: BlockStory<MediaTagArgs> =
    {
        argTypes: mediaTagArgTypes,
        args: { caption: "Example bookmark", url: "https://example.com" },
        render: (args: MediaTagArgs) => mediaTagStory("bookmark")(args)
    };

//#endregion Embed / Bookmark
//#region Link to page

interface LinkToPageArgs
{
    readonly kind: "page" | "database";
    readonly label: string;
    readonly url: string;
}

function LinkToPageStory({ kind, label, url }: LinkToPageArgs)
{
    return <BlockCanvas markdown={ `<${ kind } url="${ url }">${ label }</${ kind }>` } />;
}

export const LinkToPage: BlockStory<LinkToPageArgs> =
    {
        argTypes:
        {
            kind: { control: { type: "radio" }, options: [ "page", "database" ] },
            label: TextArg,
            url: TextArg
        },
        args:
        {
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
    readonly Color: Color;
    readonly headingCount: number;
}

function TableOfContentsStory({ Color: color, headingCount }: TableOfContentsArgs)
{
    const headings = Array.from(
        { length: headingCount },
        (_value: unknown, index: number) => `## Heading ${ index + 1 }`
    ).join("\n");
    const prefix = headings === "" ? "" : `${ headings }\n`;
    const markdown = `${ prefix }<table_of_contents${ tagColorAttr(color) }/>`;
    return (
        <BlockCanvas markdown={ markdown } />
    );
}

export const TableOfContents: BlockStory<TableOfContentsArgs> =
    {
        argTypes:
        {
            Color: ColorArg,
            headingCount: numberArgType(0, 6)
        },
        args:
        {
            Color: "default",
            headingCount: 3
        },
        render: (args: TableOfContentsArgs) => <TableOfContentsStory { ...args } />
    };

//#endregion Table of contents
//#region Synced block

interface SyncedBlockArgs
{
    readonly content: string;
}

function SyncedBlockStory({ content }: SyncedBlockArgs)
{
    const markdown = `<synced_block url="sync://demo">\n\t${ content }\n</synced_block>`;
    return <BlockCanvas markdown={ markdown } />;
}

export const SyncedBlock: BlockStory<SyncedBlockArgs> =
    {
        argTypes:
        {
            content: TextArg
        },
        args:
        {
            content: "Shared local content"
        },
        render: (args: SyncedBlockArgs) => <SyncedBlockStory { ...args } />
    };

//#endregion Synced block
//#region Synced block reference

interface SyncedBlockReferenceArgs
{
    readonly resolved: boolean;
    readonly resolvedText: string;
    readonly url: string;
}

function SyncedBlockReferenceStory({ resolved, resolvedText, url }: SyncedBlockReferenceArgs)
{
    const resolveSyncedBlock = useCallback(async () =>
    {
        if (!resolved) {return null;}
        return parseNotionMarkdown(resolvedText).document;
    }, [ resolved, resolvedText ]);

    const markdown = `<synced_block_reference url="${ url }">\n</synced_block_reference>`;

    return <BlockCanvas markdown={ markdown }
        resolveSyncedBlock={ resolveSyncedBlock } />;
}

export const SyncedBlockReference: BlockStory<SyncedBlockReferenceArgs> =
    {
        argTypes:
        {
            resolved: BooleanArg,
            resolvedText: TextArg,
            url: TextArg
        },
        args:
        {
            resolved: true,
            resolvedText: "Resolved synced text block",
            url: "sync://demo"
        },
        render: (args: SyncedBlockReferenceArgs) => <SyncedBlockReferenceStory { ...args } />
    };

//#endregion Synced block reference
