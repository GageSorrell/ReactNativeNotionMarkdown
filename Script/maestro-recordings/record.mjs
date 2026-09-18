/**
 * Records an MP4 for every Maestro flow under `maestro/flows/` (except the `_shared`
 * subflows they each `runFlow` into) against the already-built, already-installed
 * debug Storybook app on the `emulator-5554` AVD (`Pixel_10_Pro_XL`) used for local
 * development on this workstation. Every flow deep-links straight to its target story
 * via `notionmarkdownstorybook://open?STORYBOOK_STORY_ID=<id>`
 * (`@storybook/react-native`'s built-in Linking-based story override -- see the plan's
 * "Deterministic story navigation" section), so no on-device UI navigation is needed.
 *
 * Usage:
 *   node record.mjs                    -- records every flow
 *   node record.mjs --flow editor/default   -- records one flow (path relative to maestro/flows, no extension)
 *
 * @module maestro-recordings/record
 *
 * @file      record.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { dirname, join, relative, sep } from "node:path";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

/* eslint-disable no-console */

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const flowsRoot = join(packageDirectory, "maestro", "flows");
const outputRoot = join(packageDirectory, "output");
const appId = "com.gagesorrell.notionmarkdown.storybook";
const emulatorSerial = "emulator-5554";

/* Known absolute install locations on this workstation, used only when the tool isn't
   already resolvable on PATH -- see AGENTS.md and the plan's "Setup prerequisites". */
const fallbackPaths =
    {
        adb: "C:\\Users\\Gage\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe",
        javaHome: "C:\\Program Files\\Android\\Android Studio\\jbr",
        maestro: "C:\\Users\\Gage\\AppData\\Local\\mobile_dev\\maestro\\bin\\maestro.bat"
    };

/** Print a `record:`-prefixed error and exit non-zero. */
function fail(message)
{
    console.error(`record: ${ message }`);
    process.exit(1);
}

/** Resolve an executable via `where`, falling back to a known absolute path. */
function resolveExecutable(name, fallback)
{
    const found = spawnSync("where", [ name ], { encoding: "utf8" });
    const firstMatch = found.status === 0
        ? found.stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0)
        : undefined;

    if (firstMatch !== undefined)
    {
        return firstMatch;
    }

    if (existsSync(fallback))
    {
        return fallback;
    }

    fail(`could not resolve "${ name }" -- checked PATH and "${ fallback }".`);
}

const adb = resolveExecutable("adb", fallbackPaths.adb);
const maestro = resolveExecutable("maestro.bat", fallbackPaths.maestro);
const javaHome = existsSync(fallbackPaths.javaHome) ? fallbackPaths.javaHome : process.env.JAVA_HOME;

if (javaHome === undefined)
{
    fail("could not resolve a JDK for Maestro -- set JAVA_HOME.");
}

/** Run `adb devices -l` and return the serials reporting state "device". */
function listAttachedDevices()
{
    const devices = spawnSync(adb, [ "devices", "-l" ], { encoding: "utf8" });

    if (devices.status !== 0)
    {
        fail(`"adb devices" failed: ${ devices.stderr.trim() }`);
    }

    return devices.stdout
        .split(/\r?\n/)
        .slice(1)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.split(/\s+/))
        .filter(([ , state ]) => state === "device")
        .map(([ serial ]) => serial);
}

const attached = listAttachedDevices();

if (!attached.includes(emulatorSerial))
{
    fail(
        `"${ emulatorSerial }" isn't attached (saw: ${ attached.join(", ") || "none" }) -- boot the ` +
        `"Pixel_10_Pro_XL" AVD first, e.g.:\n  ANDROID_AVD_HOME="C:\\Android\\Quail3-User\\avd" ` +
        `"C:\\Android\\Sdk-Quail3\\emulator\\emulator.exe" -avd Pixel_10_Pro_XL`
    );
}

const packages = spawnSync(adb, [ "-s", emulatorSerial, "shell", "pm", "list", "packages", appId ], {
    encoding: "utf8"
});

if (!packages.stdout.includes(appId))
{
    fail(`"${ appId }" isn't installed on ${ emulatorSerial } -- build and install it first.`);
}

/** Recursively collect `.yaml` flow files under a directory, skipping `_shared`. */
function collectFlows(directory)
{
    const entries = readdirSync(directory, { withFileTypes: true });
    const flows = [ ];

    for (const entry of entries)
    {
        if (entry.name === "_shared")
        {
            continue;
        }

        const entryPath = join(directory, entry.name);

        if (entry.isDirectory())
        {
            flows.push(...collectFlows(entryPath));
        }
        else if (entry.name.endsWith(".yaml"))
        {
            flows.push(entryPath);
        }
    }

    return flows;
}

const requestedFlow = process.argv.includes("--flow")
    ? process.argv[process.argv.indexOf("--flow") + 1]
    : undefined;

/** Relative flow id as forward-slash-joined segments, independent of the host's path separator. */
function toFlowId(flow)
{
    return relative(flowsRoot, flow).replace(/\.yaml$/, "").split(sep).join("/");
}

const allFlows = collectFlows(flowsRoot).sort();
const flowsToRun = requestedFlow === undefined
    ? allFlows
    : allFlows.filter((flow) => toFlowId(flow) === requestedFlow.split(sep).join("/"));

if (flowsToRun.length === 0)
{
    fail(requestedFlow === undefined ? "no flows found under maestro/flows." : `no flow matched "${ requestedFlow }".`);
}

mkdirSync(outputRoot, { recursive: true });

const results = [ ];

for (const flow of flowsToRun)
{
    const relativeFlow = toFlowId(flow);
    const outputPath = join(outputRoot, `${ relativeFlow.split("/").join("-") }.mp4`);
    mkdirSync(dirname(outputPath), { recursive: true });

    console.log(`record: recording "${ relativeFlow }" -> ${ outputPath }`);

    const run = spawnSync(
        maestro,
        [ "--device", emulatorSerial, "record", "--local", flow, outputPath ],
        {
            env: { ...process.env, JAVA_HOME: javaHome },
            stdio: "inherit"
        }
    );

    results.push({ flow: relativeFlow, status: run.status === 0 });
}

console.log("\nrecord: summary");
for (const result of results)
{
    console.log(`  ${ result.status ? "PASS" : "FAIL" }  ${ result.flow }`);
}

const failureCount = results.filter((result) => !result.status).length;

if (failureCount > 0)
{
    fail(`${ failureCount } of ${ results.length } flow(s) failed.`);
}

console.log(`record: all ${ results.length } flow(s) recorded successfully.`);

/* eslint-enable no-console */
