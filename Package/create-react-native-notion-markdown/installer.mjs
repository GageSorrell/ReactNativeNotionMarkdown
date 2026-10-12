import { Argument, Command, Prompt } from "effect/unstable/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { Console, Effect, Option } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

export const PACKAGE_NAME = "react-native-notion-markdown";

export const SETUP_CHOICES = [
    { title: "No editor setup", value: "none", description: "Install only react-native-notion-markdown." },
    { title: "Full batteries-included editor", value: "full", description: "Install every third-party peer used by the editor and renderer." },
    { title: "Some batteries-included features", value: "some", description: "Choose the editor features to install." }
];

const hostOwnedPeers = new Set([ "react", "react-native" ]);

/** The peer set is intentionally kept in sync with the library package manifest. */
export const libraryPeerDependencies = [
    "@expo-google-fonts/inter",
    "expo",
    "expo-audio",
    "expo-document-picker",
    "expo-font",
    "expo-image-picker",
    "expo-linking",
    "expo-modules-core",
    "expo-video",
    "lucide-react-native",
    "react-native-blob-util",
    "react-native-keyboard-controller",
    "react-native-pdf",
    "react-native-ratex",
    "react-native-reanimated",
    "react-native-svg",
    "react-native-webview",
    "react",
    "react-native"
];

export const editorCoreDependencies = [
    "expo",
    "expo-document-picker",
    "expo-modules-core",
    "react-native-keyboard-controller",
    "react-native-reanimated",
    "react-native-svg"
];

export const featureDefinitions = [
    {
        title: "Media picker",
        value: "media",
        description: "Gallery, camera, image, and video actions.",
        packages: [ "expo-image-picker" ],
        missingSupport: "Provide onInsertMedia and onMediaSelected callbacks."
    },
    {
        title: "Audio recording and playback",
        value: "audio",
        description: "Audio recording, picking, and playback.",
        packages: [ "expo-audio" ],
        missingSupport: "Provide onInsertAudio and onAudioSelected callbacks."
    },
    {
        title: "File and PDF support",
        value: "files-pdf",
        description: "File/PDF blocks, previews, and native file handling.",
        packages: [ "react-native-blob-util", "react-native-pdf" ],
        missingSupport: "Provide onFilePicker, onFileSelected, onPdfPicker, and onPdfSelected callbacks."
    },
    {
        title: "Equation support",
        value: "equations",
        description: "Inline and block equation rendering and editing.",
        packages: [ "react-native-ratex" ],
        missingSupport: "Provide onRequestEquation and an equation renderer if equations are used."
    },
    {
        title: "Links and page references",
        value: "links",
        description: "Open links and page-reference URLs with Expo Linking.",
        packages: [ "expo-linking" ],
        missingSupport: "Provide onOpenUrl and page-reference callbacks."
    },
    {
        title: "Lucide icons",
        value: "lucide-icons",
        description: "Use the package's ready-made Lucide icon set.",
        packages: [ "lucide-react-native" ],
        missingSupport: "The dependency-free SVG fallback remains available; provide custom icons if desired."
    },
    {
        title: "Inter fonts",
        value: "inter-fonts",
        description: "Load the Inter font families used by the default theme.",
        packages: [ "@expo-google-fonts/inter", "expo-font" ],
        missingSupport: "Use the system font or provide a custom MarkdownProvider theme."
    },
    {
        title: "Rich media previews",
        value: "rich-previews",
        description: "Video, Mermaid WebView, and media-preview integrations.",
        packages: [ "expo-audio", "expo-video", "react-native-webview" ],
        missingSupport: "Supply renderer media components or callbacks for unsupported preview types."
    }
];

const lockfileManagers = [
    [ "package-lock.json", "npm" ],
    [ "npm-shrinkwrap.json", "npm" ],
    [ "yarn.lock", "yarn" ],
    [ "pnpm-lock.yaml", "pnpm" ],
    [ "bun.lock", "bun" ],
    [ "bun.lockb", "bun" ]
];

const supportedPackageManagers = new Set([ "npm", "yarn", "pnpm", "bun" ]);

function unique(items)
{
    return [ ...new Set(items) ];
}

function hasDependency(appPackage, name)
{
    return Object.hasOwn(appPackage.dependencies ?? {}, name)
        || Object.hasOwn(appPackage.devDependencies ?? {}, name)
        || Object.hasOwn(appPackage.peerDependencies ?? {}, name);
}

export function normalizeFeatureValues(values)
{
    const known = new Set(featureDefinitions.map((feature) => feature.value));
    const result = [];

    for (const value of values.flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean))
    {
        if (!known.has(value))
        {
            throw new Error(`unknown editor feature "${ value }"; choose from ${ [ ...known ].join(", ") }.`);
        }

        if (!result.includes(value))
        {
            result.push(value);
        }
    }

    return result;
}

export function dependenciesForSetup(setup, selectedFeatures = [])
{
    if (setup === "none")
    {
        return [ PACKAGE_NAME ];
    }

    if (setup === "full")
    {
        return unique([
            PACKAGE_NAME,
            ...libraryPeerDependencies.filter((name) => !hostOwnedPeers.has(name))
        ]);
    }

    if (setup !== "some")
    {
        throw new Error(`unknown setup "${ setup }"; choose none, full, or some.`);
    }

    const selected = normalizeFeatureValues(selectedFeatures);
    const selectedPackages = featureDefinitions
        .filter((feature) => selected.includes(feature.value))
        .flatMap((feature) => feature.packages);

    return unique([ PACKAGE_NAME, ...editorCoreDependencies, ...selectedPackages ]);
}

export function detectPackageManager(appPackage, lockfiles = [])
{
    const declared = typeof appPackage.packageManager === "string"
        ? appPackage.packageManager.match(/^(npm|yarn|pnpm|bun)(?:@|$)/)?.[1]
        : undefined;

    if (declared !== undefined && supportedPackageManagers.has(declared))
    {
        return declared;
    }

    const detected = lockfiles
        .map((filename) => lockfileManagers.find(([ candidate ]) => candidate === filename)?.[1])
        .filter((manager) => manager !== undefined);

    return detected.length === 1 ? detected[0] : "npm";
}

export function ordinaryInstallArguments(manager, packages)
{
    return manager === "npm"
        ? [ "install", ...packages ]
        : [ "add", ...packages ];
}

export function createInstallPlan(manager, packages, { expoProject = false, expoCommand = "expo" } = {})
{
    if (expoProject)
    {
        return { command: expoCommand, args: [ "install", ...packages ] };
    }

    return { command: manager, args: ordinaryInstallArguments(manager, packages) };
}

export function generateEditorSnippet(selectedFeatures)
{
    const selected = normalizeFeatureValues(selectedFeatures);
    const selectedDefinitions = featureDefinitions.filter((feature) => selected.includes(feature.value));
    const omittedDefinitions = featureDefinitions.filter((feature) => !selected.includes(feature.value));
    const installedText = selectedDefinitions.length === 0
        ? "none beyond the editor core"
        : selectedDefinitions.map((feature) => feature.title).join(", ");

    const omittedComments = omittedDefinitions.map((feature) =>
        `    // ${ feature.title } was not installed: ${ feature.missingSupport }`
    );

    return [
        "// Generated by create-react-native-notion-markdown.",
        "// Installed batteries included features: " + installedText + ".",
        "// Native dependencies require a development-client/native rebuild.",
        "",
        "import { useCallback } from \"react\";",
        "import { StyleSheet } from \"react-native\";",
        "import type { MarkdownDocument } from \"react-native-notion-markdown\";",
        "import { MarkdownEditor } from \"react-native-notion-markdown/editor/ui\";",
        "",
        "export function NoteEditor()",
        "{",
        "    const handleChange = useCallback((document: MarkdownDocument) =>",
        "    {",
        "        // Persist the document or serialize it when the user saves.",
        "        void document;",
        "    }, [ ]);",
        "",
        ...omittedComments,
        "",
        "    return <MarkdownEditor",
        "        initial={ \"# Hello\\n\\nStart writing.\" }",
        "        onChange={ handleChange }",
        "        style={ styles.editor } />;",
        "}",
        "",
        "const styles = StyleSheet.create({",
        "    editor: {",
        "        flex: 1",
        "    }",
        "});",
        ""
    ].join("\n");
}

function fail(message)
{
    return Effect.fail(new Error(`create-react-native-notion-markdown: ${ message }`));
}

function readTargetPackage(fs, path, cwd)
{
    return Effect.gen(function* ()
    {
        const packagePath = path.join(cwd, "package.json");

        if (!(yield* fs.exists(packagePath)))
        {
            return yield* fail(`no package.json found in ${ cwd }.`);
        }

        const contents = yield* fs.readFileString(packagePath);

        try
        {
            return JSON.parse(contents);
        }
        catch (error)
        {
            const detail = error instanceof Error ? error.message : String(error);
            return yield* fail(`could not parse ${ packagePath }: ${ detail }`);
        }
    });
}

function readLockfiles(fs, path, cwd)
{
    return Effect.gen(function* ()
    {
        const present = [];

        for (const [filename] of lockfileManagers)
        {
            if (yield* fs.exists(path.join(cwd, filename)))
            {
                present.push(filename);
            }
        }

        return present;
    });
}

function localExpoCommand(fs, path, cwd)
{
    return Effect.gen(function* ()
    {
        const candidates = process.platform === "win32"
            ? [ path.join(cwd, "node_modules", ".bin", "expo.cmd"), path.join(cwd, "node_modules", ".bin", "expo") ]
            : [ path.join(cwd, "node_modules", ".bin", "expo") ];

        for (const candidate of candidates)
        {
            if (yield* fs.exists(candidate))
            {
                return candidate;
            }
        }

        return undefined;
    });
}

function chooseSetup(selection)
{
    if (Option.isSome(selection))
    {
        return Effect.succeed(selection.value);
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY)
    {
        return fail("choose a setup in non-interactive mode: none, full, or some.");
    }

    return Prompt.Select({
        choices: SETUP_CHOICES,
        message: "What kind of React Native Markdown setup do you want?"
    });
}

function chooseFeatures(setup, featureArgument)
{
    if (setup !== "some")
    {
        return Effect.succeed([]);
    }

    if (Option.isSome(featureArgument))
    {
        try
        {
            return Effect.succeed(normalizeFeatureValues([ featureArgument.value ]));
        }
        catch (error)
        {
            return fail(error instanceof Error ? error.message : String(error));
        }
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY)
    {
        return fail("the some setup requires a comma-separated feature list in non-interactive mode.");
    }

    return Prompt.MultiSelect({
        choices: featureDefinitions,
        min: 1,
        message: "Which batteries-included editor features should be installed?"
    });
}

function runInherited(command)
{
    return Effect.scoped(Effect.flatMap(command, (handle) => handle.exitCode));
}

function runInstall(fs, path, appPackage, setup, selectedFeatures, cwd)
{
    return Effect.gen(function* ()
    {
        const manager = detectPackageManager(appPackage, yield* readLockfiles(fs, path, cwd));
        const packages = dependenciesForSetup(setup, selectedFeatures);
        const expoProject = hasDependency(appPackage, "expo");
        let installPlan;

        if (expoProject)
        {
            const expoCommand = yield* localExpoCommand(fs, path, cwd);

            if (expoCommand === undefined)
            {
                return yield* fail(
                    "this app declares Expo, but no local Expo CLI was found in node_modules/.bin; install Expo first and rerun the command."
                );
            }

            installPlan = createInstallPlan(manager, packages, { expoProject: true, expoCommand });
        }
        else
        {
            installPlan = createInstallPlan(manager, packages);
        }

        yield* Console.log(`Installing with ${ manager }: ${ packages.join(" ") }`);

        const exitCode = yield* runInherited(ChildProcess.make(installPlan.command, installPlan.args, {
            cwd,
            shell: process.platform === "win32",
            stderr: "inherit",
            stdin: "inherit",
            stdout: "inherit"
        }));

        if (exitCode !== ChildProcessSpawner.ExitCode(0))
        {
            yield* Console.error(`The package manager exited with code ${ exitCode }.`);
            yield* Effect.sync(() => { process.exitCode = Number(exitCode); });
        }

        return { manager, packages, exitCode };
    });
}

const setupArgument = Argument.ChoiceWithValue("setup", [
    [ "none", "none" ],
    [ "full", "full" ],
    [ "some", "some" ]
]).pipe(
    Argument.optional,
    Argument.withDescription("Setup mode: none, full, or some. Omit to choose interactively.")
);

const featureArgument = Argument.String("features").pipe(
    Argument.optional,
    Argument.withDescription("Comma-separated features for some setup.")
);

export const command = Command.make(
    "create-react-native-notion-markdown",
    { setup: setupArgument, features: featureArgument },
    ({ setup, features }) => Effect.gen(function* ()
    {
        const chosenSetup = yield* chooseSetup(setup);
        const selectedFeatures = yield* chooseFeatures(chosenSetup, features);
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const cwd = process.cwd();
        const appPackage = yield* readTargetPackage(fs, path, cwd);
        const result = yield* runInstall(fs, path, appPackage, chosenSetup, selectedFeatures, cwd);

        if (chosenSetup === "some" && result.exitCode === ChildProcessSpawner.ExitCode(0))
        {
            yield* Console.log("\nAdd this starter component to your app:\n");
            yield* Console.log(generateEditorSnippet(selectedFeatures));
        }
    })
).pipe(
    Command.withDescription(
        "Install react-native-notion-markdown and a selected React Native editor setup in the current app."
    ),
    Command.withExamples([
        { command: "npx create-react-native-notion-markdown", description: "Prompt for the setup mode and, if needed, editor features." },
        { command: "npx create-react-native-notion-markdown none", description: "Install only the main package." },
        { command: "npx create-react-native-notion-markdown full", description: "Install the complete batteries-included peer set." },
        { command: "npx create-react-native-notion-markdown some media,audio", description: "Install the editor core plus selected features." }
    ])
);

