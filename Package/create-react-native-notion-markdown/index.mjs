#!/usr/bin/env node

import { Command, Argument, Prompt } from "effect/unstable/cli";
import { Console, Effect, FileSystem, Option } from "effect";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { ChildProcess } from "effect/unstable/process";
import { join } from "node:path";

const packageName = "react-native-notion-markdown";
const choices = [ "all", "no-icons", "icons" ];
const optionalPeers = [
    "@expo-google-fonts/inter",
    "expo-font",
    "expo-image-picker",
    "expo-document-picker",
    "expo-linking",
    "lucide-react-native"
];
const peerSets = {
    all: optionalPeers,
    "no-icons": optionalPeers.filter((name) => name !== "lucide-react-native"),
    icons: [ "lucide-react-native" ]
};
const lockfileManagers = new Map([
    [ "package-lock.json", "npm" ],
    [ "npm-shrinkwrap.json", "npm" ],
    [ "yarn.lock", "yarn" ],
    [ "pnpm-lock.yaml", "pnpm" ],
    [ "bun.lock", "bun" ],
    [ "bun.lockb", "bun" ]
]);

function fail(message)
{
    return Effect.gen(function* ()
    {
        yield* Console.error(`create-react-native-notion-markdown: ${ message }`);
        yield* Effect.sync(() => process.exit(1));
    });
}

function choosePeerSet(selection)
{
    if (Option.isSome(selection))
    {
        return Effect.succeed(selection.value);
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY)
    {
        return fail("choose a peer set in noninteractive mode: all, no-icons, or icons.");
    }

    return Prompt.Select({
        choices: [
            { title: "All optional peers", value: "all", description: "Expo integrations and Lucide icons." },
            { title: "No icons", value: "no-icons", description: "Expo integrations without Lucide icons." },
            { title: "Icons only", value: "icons", description: "Lucide icons without the optional Expo integrations." }
        ],
        message: "Which optional dependencies should be installed?"
    });
}

function readTargetPackage(fs)
{
    return Effect.gen(function* ()
    {
        const path = join(process.cwd(), "package.json");
        const exists = yield* fs.exists(path);

        if (!exists)
        {
            return yield* fail(`no package.json found in ${ process.cwd() }.`);
        }

        try
        {
            return JSON.parse(yield* fs.readFileString(path));
        }
        catch (error)
        {
            return yield* fail(`could not read ${ path }: ${ error.message }`);
        }
    });
}

function detectPackageManager(fs, appPackage)
{
    const declared = appPackage.packageManager?.split("@")[0];
    if ([ "npm", "yarn", "pnpm", "bun" ].includes(declared))
    {
        return Effect.succeed(declared);
    }

    return Effect.gen(function* ()
    {
        const present = [];
        for (const [ filename, manager ] of lockfileManagers)
        {
            if (yield* fs.exists(join(process.cwd(), filename)))
            {
                present.push(manager);
            }
        }

        return present.length === 1 ? present[0] : "npm";
    });
}

function runInherited(command)
{
    return Effect.scoped(Effect.flatMap(command, (handle) => handle.exitCode));
}

function installCommand(manager, packages)
{
    const args = manager === "npm"
        ? [ "install", ...packages ]
        : [ "add", ...packages ];

    return ChildProcess.make(manager, args, {
        cwd: process.cwd(),
        shell: process.platform === "win32",
        stderr: "inherit",
        stdin: "inherit",
        stdout: "inherit"
    });
}

function expoCliPath(fs)
{
    return Effect.gen(function* ()
    {
        const candidates = process.platform === "win32"
            ? [ join(process.cwd(), "node_modules", ".bin", "expo.cmd"), join(process.cwd(), "node_modules", ".bin", "expo") ]
            : [ join(process.cwd(), "node_modules", ".bin", "expo") ];

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

function runInstall(fs, appPackage, selected)
{
    return Effect.gen(function* ()
    {
        const packages = [ packageName, ...peerSets[selected] ];
        const needsExpo = peerSets[selected].some((name) => name.startsWith("expo-"))
            || Object.hasOwn(appPackage.dependencies ?? {}, "expo");

        if (needsExpo)
        {
            const expoCli = yield* expoCliPath(fs);
            if (expoCli === undefined)
            {
                return yield* fail(
                    "Expo is needed to install the selected packages, but no local Expo CLI was found. "
                    + "Install Expo in this app first (for example, `npm install expo`) and rerun this command."
                );
            }

            const exitCode = yield* runInherited(ChildProcess.make(expoCli, [ "install", ...packages ], {
                cwd: process.cwd(),
                shell: process.platform === "win32",
                stderr: "inherit",
                stdin: "inherit",
                stdout: "inherit"
            }));
            yield* Effect.sync(() => { process.exitCode = exitCode; });
            return;
        }

        const manager = yield* detectPackageManager(fs, appPackage);
        const exitCode = yield* runInherited(installCommand(manager, packages));
        yield* Effect.sync(() => { process.exitCode = exitCode; });
    });
}

const selection = Argument.ChoiceWithValue("peer-set", [
    [ "all", "all" ],
    [ "no-icons", "no-icons" ],
    [ "icons", "icons" ]
]).pipe(
    Argument.optional,
    Argument.withDescription("Optional peer set to install: all, no-icons, or icons. Omit to choose interactively.")
);

const command = Command.make(
    "create-react-native-notion-markdown",
    { selection },
    ({ selection: selected }) => Effect.gen(function* ()
    {
        const chosen = yield* choosePeerSet(selected);
        const fs = yield* FileSystem.FileSystem;
        const appPackage = yield* readTargetPackage(fs);
        yield* runInstall(fs, appPackage, chosen);
    })
).pipe(
    Command.withDescription(
        "Install react-native-notion-markdown and a selected set of its optional peer dependencies in the current React Native app."
    ),
    Command.withExamples([
        { command: "npx create-react-native-notion-markdown", description: "Prompt for the optional peer set." },
        { command: "npx create-react-native-notion-markdown all", description: "Install every optional peer." },
        { command: "npx create-react-native-notion-markdown no-icons", description: "Install Expo integrations without Lucide icons." },
        { command: "npx create-react-native-notion-markdown icons", description: "Install Lucide icons only." }
    ])
);

NodeRuntime.runMain(Command.run(command, { version: "0.0.1" }).pipe(Effect.provide(NodeServices.layer)));
