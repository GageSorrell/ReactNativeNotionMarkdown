/**
 * Interactively builds, installs, and launches the Application's debug Android APK on
 * one or more connected devices and/or emulators, then optionally starts Metro. Lists
 * every device or emulator reported by `adb devices -l` (filterable via `--real` /
 * `--emulator`), lets the user choose which to install to, builds the debug APK
 * silently if it isn't already built, installs to each selection (retrying past a
 * signature mismatch by uninstalling first), lets the user choose which of the
 * successfully installed devices should launch the app, and finally starts the Metro
 * dev server unless `--no-metro` is passed.
 *
 * @module @react-native-notion-markdown/install-android-device
 *
 * @file      index.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Command, Flag, Prompt } from "effect/unstable/cli";
import { Console, Effect, FileSystem, Stream } from "effect";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { dirname, join } from "node:path";
import { ChildProcess } from "effect/unstable/process";
import { fileURLToPath } from "node:url";

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const applicationDirectory = join(dirname(dirname(packageDirectory)), "Application");
const apkPath = join(
    applicationDirectory, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"
);

/** Print an `install-android-device:`-prefixed error and exit non-zero. */
function fail(message)
{
    return Effect.gen(function* ()
    {
        yield* Console.error(`install-android-device: ${ message }`);
        return yield* Effect.sync(() => process.exit(1));
    });
}

/** Print an `install-android-device:`-prefixed error without exiting. */
function warn(message)
{
    return Console.error(`install-android-device: ${ message }`);
}

/** Run a command, capturing its stdout/stderr/exit code instead of inheriting them. */
function runCaptured(command)
{
    return Effect.scoped(
        Effect.gen(function* ()
        {
            const handle = yield* command;
            const [ stdout, stderr, exitCode ] = yield* Effect.all(
                [
                    handle.stdout.pipe(Stream.decodeText, Stream.mkString),
                    handle.stderr.pipe(Stream.decodeText, Stream.mkString),
                    handle.exitCode
                ],
                { concurrency: "unbounded" }
            );
            return { exitCode, stderr, stdout };
        })
    );
}

/** Run a command with stdio fully inherited, resolving to its exit code. */
function runInherited(command)
{
    return Effect.scoped(Effect.flatMap(command, (handle) => handle.exitCode));
}

/** Run `adb` with the given arguments, echoing its captured output as it completes. */
function runAdb(args)
{
    return Effect.gen(function* ()
    {
        const result = yield* runCaptured(ChildProcess.make("adb", args, { stdin: "ignore" }));
        yield* Effect.sync(() => process.stdout.write(result.stdout));
        yield* Effect.sync(() => process.stderr.write(result.stderr));
        return result;
    });
}

/** Parse `adb devices -l` output into the attached, authorized devices. */
function parseDevices(stdout)
{
    return stdout
        .split(/\r?\n/)
        .slice(1)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.split(/\s+/))
        .filter(([ , state ]) => state === "device")
        .map(([ serial, , ...rest ]) =>
        {
            const isEmulator = serial.startsWith("emulator-");
            const isWireless = /^\d+\.\d+\.\d+\.\d+:\d+$/.test(serial);
            const modelToken = rest.find((token) => token.startsWith("model:"));
            const model = modelToken === undefined ? serial : modelToken.slice("model:".length);
            const label = `${ model } (${ serial }) — ${ isEmulator ? "emulator" : "real device" }, `
                + `${ isWireless ? "wireless" : "wired" }`;
            return { isEmulator, label, serial };
        });
}

/**
 * Ask the user which of `candidates` to act on: a yes/no confirm for exactly one
 * candidate, or a multi-select (at least one required) for more than one.
 */
function selectDevices(candidates, action)
{
    return Effect.gen(function* ()
    {
        if (candidates.length === 1)
        {
            const [ only ] = candidates;
            const confirmed = yield* Prompt.Confirm({
                initial: true,
                message: `${ action } on ${ only.label }?`
            });

            if (!confirmed)
            {
                return yield* fail(`nothing selected to ${ action.toLowerCase() }.`);
            }

            return [ only ];
        }

        return yield* Prompt.MultiSelect({
            choices: candidates.map((device) => ({ title: device.label, value: device })),
            message: `Select device(s) to ${ action.toLowerCase() }:`,
            min: 1
        });
    });
}

/** Install the debug APK onto one device, retrying past a signature mismatch. */
function installOnDevice(device, packageName)
{
    return Effect.gen(function* ()
    {
        yield* Console.log(`install-android-device: installing on ${ device.label }...`);

        let attempt = yield* runAdb([ "-s", device.serial, "install", "-r", apkPath ]);
        const mismatch = attempt.exitCode !== 0
            && /INSTALL_FAILED_UPDATE_INCOMPATIBLE/.test(`${ attempt.stdout }${ attempt.stderr }`);

        if (mismatch)
        {
            yield* Console.log(
                "install-android-device: installed app has a different signature -- uninstalling and "
                + "retrying..."
            );

            const uninstall = yield* runAdb([ "-s", device.serial, "uninstall", packageName ]);

            if (uninstall.exitCode !== 0)
            {
                yield* warn(`adb uninstall failed on ${ device.label }.`);
                return false;
            }

            attempt = yield* runAdb([ "-s", device.serial, "install", "-r", apkPath ]);
        }

        if (attempt.exitCode !== 0)
        {
            yield* warn(`adb install failed on ${ device.label }.`);
            return false;
        }

        return true;
    });
}

/** Launch the app on one device, warning (without aborting) if it fails. */
function launchOnDevice(device, packageName)
{
    return Effect.gen(function* ()
    {
        yield* Console.log(`install-android-device: launching ${ packageName } on ${ device.label }...`);

        const launch = ChildProcess.make(
            "adb",
            [
                "-s", device.serial, "shell", "monkey", "-p", packageName, "-c",
                "android.intent.category.LAUNCHER", "1"
            ],
            { stderr: "inherit", stdin: "inherit", stdout: "inherit" }
        );
        const exitCode = yield* runInherited(launch);

        if (exitCode !== 0)
        {
            yield* warn(`failed to launch the app on ${ device.label }.`);
        }
    });
}

const install = Command.make(
    "install-android-device",
    {
        emulator: Flag.Boolean("emulator").pipe(Flag.withDefault(false)),
        metro: Flag.Boolean("metro").pipe(Flag.withDefault(true)),
        real: Flag.Boolean("real").pipe(Flag.withDefault(false))
    },
    (config) => Effect.gen(function* ()
    {
        if (config.real && config.emulator)
        {
            return yield* fail("using both --real and --emulator at once is not sensible.");
        }

        const fs = yield* FileSystem.FileSystem;
        const appConfig = JSON.parse(yield* fs.readFileString(join(applicationDirectory, "app.json")));
        const packageName = appConfig.expo?.android?.package;

        if (packageName === undefined)
        {
            return yield* fail("no \"expo.android.package\" found in app.json.");
        }

        const devices = yield* runCaptured(
            ChildProcess.make("adb", [ "devices", "-l" ], { stdin: "ignore" })
        );

        if (devices.exitCode !== 0)
        {
            return yield* fail(`"adb devices" failed: ${ devices.stderr.trim() }`);
        }

        const allDevices = parseDevices(devices.stdout);
        const candidates = config.real
            ? allDevices.filter((device) => !device.isEmulator)
            : config.emulator
                ? allDevices.filter((device) => device.isEmulator)
                : allDevices;

        if (candidates.length === 0)
        {
            const filterDescription = config.real
                ? "real devices"
                : config.emulator ? "emulators" : "devices";
            return yield* fail(
                `no ${ filterDescription } attached -- plug one in, pair over wireless adb, or start an `
                + "emulator, and try again."
            );
        }

        const selectedForInstall = yield* selectDevices(candidates, "Install");
        const apkExists = yield* fs.exists(apkPath);

        if (!apkExists)
        {
            yield* Console.log(
                "install-android-device: no debug APK found -- building one (\"npm run android\")..."
            );

            const build = yield* runCaptured(
                ChildProcess.make("npm", [ "run", "android" ], {
                    cwd: applicationDirectory,
                    shell: process.platform === "win32",
                    stdin: "ignore"
                })
            );

            if (build.exitCode !== 0)
            {
                yield* Effect.sync(() => process.stdout.write(build.stdout));
                yield* Effect.sync(() => process.stderr.write(build.stderr));
                return yield* fail("building the debug APK failed (\"npm run android\").");
            }
        }

        const installOutcomes = yield* Effect.forEach(
            selectedForInstall,
            (device) => installOnDevice(device, packageName).pipe(
                Effect.map((succeeded) => ({ device, succeeded }))
            ),
            { concurrency: 1 }
        );
        const installedDevices = installOutcomes
            .filter((outcome) => outcome.succeeded)
            .map((outcome) => outcome.device);

        if (installedDevices.length === 0)
        {
            return yield* fail("installation failed on every selected device.");
        }

        const selectedForLaunch = yield* selectDevices(installedDevices, "Launch");

        yield* Effect.forEach(
            selectedForLaunch,
            (device) => launchOnDevice(device, packageName),
            { concurrency: 1 }
        );

        if (config.metro)
        {
            yield* Console.log("install-android-device: starting Metro (\"npm run dev\")...");
            yield* runInherited(
                ChildProcess.make("npm", [ "run", "dev" ], {
                    cwd: applicationDirectory,
                    shell: process.platform === "win32",
                    stderr: "inherit",
                    stdin: "inherit",
                    stdout: "inherit"
                })
            );
        }
    })
);

NodeRuntime.runMain(Command.run(install, { version: "0.1.0" }).pipe(Effect.provide(NodeServices.layer)));
