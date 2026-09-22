/**
 * Starts (or reuses) the Android Virtual Device configured for local development, waits
 * for it to finish booting, and opens the debug app onto it if it isn't already the
 * foreground activity.
 *
 * Reads `ANDROID_AVD_HOME`, `DEBUG_AVD`, and `PKG_NAME` from the monorepo root's
 * `.env.local`, falling back to the corresponding process environment variables for
 * whichever of these aren't defined there. If the named app isn't installed on the
 * device, this is logged rather than treated as an error.
 *
 * This script exits once the app has been opened (or logged as not installed) -- it does
 * not keep running alongside the emulator, which is left running as a detached process.
 *
 * @module @react-native-notion-markdown/start-emulator
 *
 * @file      index.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Console, Effect, FileSystem, Stream } from "effect";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { ChildProcess } from "effect/unstable/process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = dirname(dirname(packageDirectory));
const envFilePath = join(repositoryRoot, ".env.local");

/* Known absolute install locations on this workstation, used only when the tool isn't
   already resolvable on PATH -- see AGENTS.md and Script/maestro-recordings/record.mjs. */
const knownExecutablePaths =
    {
        adb: "C:\\Users\\Gage\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe",
        emulator: "C:\\Android\\Sdk-Quail3\\emulator\\emulator.exe"
    };

const bootTimeoutMilliseconds = 180_000;
const bootPollIntervalMilliseconds = 2_000;
const serialDiscoveryTimeoutMilliseconds = 30_000;
const serialDiscoveryPollIntervalMilliseconds = 1_000;

/** Print a `start-emulator:`-prefixed error and exit non-zero. */
function fail(message)
{
    return Effect.gen(function* ()
    {
        yield* Console.error(`start-emulator: ${ message }`);
        return yield* Effect.sync(() => process.exit(1));
    });
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

/** Parse a simple `.env`-style file into a plain object; `{}` if the file doesn't exist. */
function readEnvFile(path)
{
    return Effect.gen(function* ()
    {
        const fs = yield* FileSystem.FileSystem;

        if (!(yield* fs.exists(path)))
        {
            return { };
        }

        const contents = yield* fs.readFileString(path);
        const values = { };

        for (const line of contents.split(/\r?\n/))
        {
            const trimmedLine = line.trim();

            if (trimmedLine.length === 0 || trimmedLine.startsWith("#"))
            {
                continue;
            }

            const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmedLine);

            if (match === null)
            {
                continue;
            }

            const [ , name, rawValue ] = match;
            const isQuoted = rawValue.length >= 2
                && ((rawValue.startsWith("\"") && rawValue.endsWith("\""))
                    || (rawValue.startsWith("'") && rawValue.endsWith("'")));

            values[name] = isQuoted ? rawValue.slice(1, -1) : rawValue.trim();
        }

        return values;
    });
}

/** Resolve `name` from the parsed env file, falling back to `process.env`. */
function resolveConfigValue(envFileValues, name)
{
    const value = envFileValues[name] ?? process.env[name];
    return value === undefined || value.length === 0 ? undefined : value;
}

/** Resolve an executable via `where`, falling back to a known absolute path. */
function resolveExecutable(name, fallbackPath)
{
    return Effect.gen(function* ()
    {
        const fs = yield* FileSystem.FileSystem;
        const found = yield* runCaptured(ChildProcess.make("where", [ name ], { stdin: "ignore" })).pipe(
            Effect.orElseSucceed(() => ({ exitCode: 1, stderr: "", stdout: "" }))
        );

        if (found.exitCode === 0)
        {
            const firstMatch = found.stdout
                .split(/\r?\n/)
                .map((line) => line.trim())
                .find((line) => line.length > 0);

            if (firstMatch !== undefined)
            {
                return firstMatch;
            }
        }

        if (yield* fs.exists(fallbackPath))
        {
            return fallbackPath;
        }

        return yield* fail(`could not resolve "${ name }" -- checked PATH and "${ fallbackPath }".`);
    });
}

/** Run `adb devices -l` and return the serials for attached, authorized emulators. */
function listAttachedEmulatorSerials(adbPath)
{
    return Effect.gen(function* ()
    {
        const result = yield* runCaptured(ChildProcess.make(adbPath, [ "devices", "-l" ], { stdin: "ignore" }));

        if (result.exitCode !== 0)
        {
            return yield* fail(`"adb devices" failed: ${ result.stderr.trim() }`);
        }

        return result.stdout
            .split(/\r?\n/)
            .slice(1)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => line.split(/\s+/))
            .filter(([ , state ]) => state === "device")
            .map(([ serial ]) => serial)
            .filter((serial) => serial.startsWith("emulator-"));
    });
}

/** Ask a running emulator serial which AVD it is running, or `undefined` if that fails. */
function getRunningAvdName(adbPath, serial)
{
    return Effect.gen(function* ()
    {
        const result = yield* runCaptured(
            ChildProcess.make(adbPath, [ "-s", serial, "emu", "avd", "name" ], { stdin: "ignore" })
        );

        if (result.exitCode !== 0)
        {
            return undefined;
        }

        const [ firstLine ] = result.stdout.split(/\r?\n/);
        return firstLine?.trim();
    });
}

/** Find the serial of a currently-attached emulator running `avdName`, if any. */
function findRunningSerial(adbPath, avdName)
{
    return Effect.gen(function* ()
    {
        const serials = yield* listAttachedEmulatorSerials(adbPath);

        for (const serial of serials)
        {
            if ((yield* getRunningAvdName(adbPath, serial)) === avdName)
            {
                return serial;
            }
        }

        return undefined;
    });
}

const conhostPath = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "conhost.exe");
const powershellPath = join(
    process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"
);

/**
 * Launch `avdName` fully independent of this script and with no window of its own.
 *
 * `emulator.exe` is a console-subsystem binary that itself spawns `qemu-system-x86_64.exe`
 * as a plain child process. Spawning `emulator.exe` directly, even hidden, leaves that
 * grandchild with no console to inherit, so Windows allocates it a brand new one -- which,
 * with Windows 11's default-terminal handoff, surfaces as a visible Windows Terminal window
 * (closing it kills the emulator, same as closing any other console app's window).
 *
 * Wrapping the launch in a headless `conhost.exe` session avoids that, but only reliably
 * works when driven through PowerShell's `Start-Process`, and only when that PowerShell
 * process itself inherits a real console rather than being spawned headless in turn --
 * otherwise `conhost.exe --headless` silently no-ops without ever starting its target.
 * Both pieces of this were verified empirically; simpler combinations were tried first and
 * failed silently (exit code 0, no process, no error).
 */
function launchEmulator(emulatorPath, avdName, androidAvdHome)
{
    const script =
        "Start-Process -FilePath $env:START_EMULATOR_CONHOST "
        + "-ArgumentList '--headless','--',$env:START_EMULATOR_EXE,'-avd',$env:START_EMULATOR_AVD "
        + "-WindowStyle Hidden";

    return Effect.gen(function* ()
    {
        const result = yield* runCaptured(
            ChildProcess.make(
                powershellPath,
                [ "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script ],
                {
                    env: {
                        ANDROID_AVD_HOME: androidAvdHome,
                        START_EMULATOR_AVD: avdName,
                        START_EMULATOR_CONHOST: conhostPath,
                        START_EMULATOR_EXE: emulatorPath
                    },
                    extendEnv: true,
                    stderr: "inherit",
                    stdin: "inherit",
                    stdout: "inherit"
                }
            )
        );

        if (result.exitCode !== 0)
        {
            return yield* fail(`failed to launch the emulator: ${ result.stderr.trim() }`);
        }
    });
}

/** Poll `findRunningSerial` until the just-launched AVD shows up in `adb devices`. */
function waitForSerial(adbPath, avdName)
{
    return Effect.gen(function* ()
    {
        const deadline = Date.now() + serialDiscoveryTimeoutMilliseconds;

        while (true)
        {
            const serial = yield* findRunningSerial(adbPath, avdName);

            if (serial !== undefined)
            {
                return serial;
            }

            if (Date.now() >= deadline)
            {
                return yield* fail(
                    `"${ avdName }" did not appear in "adb devices" within `
                    + `${ serialDiscoveryTimeoutMilliseconds / 1000 }s of launching it.`
                );
            }

            yield* Effect.sleep(serialDiscoveryPollIntervalMilliseconds);
        }
    });
}

/** Poll `sys.boot_completed` until the device finishes booting. */
function waitForBoot(adbPath, serial)
{
    return Effect.gen(function* ()
    {
        const deadline = Date.now() + bootTimeoutMilliseconds;

        while (true)
        {
            const result = yield* runCaptured(
                ChildProcess.make(adbPath, [ "-s", serial, "shell", "getprop", "sys.boot_completed" ], {
                    stdin: "ignore"
                })
            );

            if (result.exitCode === 0 && result.stdout.trim() === "1")
            {
                return;
            }

            if (Date.now() >= deadline)
            {
                return yield* fail(
                    `"${ serial }" did not finish booting within ${ bootTimeoutMilliseconds / 1000 }s.`
                );
            }

            yield* Effect.sleep(bootPollIntervalMilliseconds);
        }
    });
}

/** Whether `packageName` is installed on `serial`. */
function isAppInstalled(adbPath, serial, packageName)
{
    return Effect.gen(function* ()
    {
        const result = yield* runCaptured(
            ChildProcess.make(adbPath, [ "-s", serial, "shell", "pm", "list", "packages", packageName ], {
                stdin: "ignore"
            })
        );

        if (result.exitCode !== 0)
        {
            return yield* fail(`"adb shell pm list packages" failed: ${ result.stderr.trim() }`);
        }

        return result.stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .some((line) => line === `package:${ packageName }`);
    });
}

/** Whether `packageName` is the current foreground (resumed) activity on `serial`. */
function isAppInForeground(adbPath, serial, packageName)
{
    return Effect.gen(function* ()
    {
        const result = yield* runCaptured(
            ChildProcess.make(adbPath, [ "-s", serial, "shell", "dumpsys", "activity", "activities" ], {
                stdin: "ignore"
            })
        );

        if (result.exitCode !== 0)
        {
            return yield* fail(`"adb shell dumpsys activity activities" failed: ${ result.stderr.trim() }`);
        }

        return result.stdout
            .split(/\r?\n/)
            .filter((line) => line.includes("ResumedActivity"))
            .some((line) => line.includes(`${ packageName }/`));
    });
}

/** Launch `packageName`'s default launcher activity on `serial`. */
function launchApp(adbPath, serial, packageName)
{
    return Effect.gen(function* ()
    {
        const result = yield* runCaptured(
            ChildProcess.make(
                adbPath,
                [ "-s", serial, "shell", "monkey", "-p", packageName, "-c", "android.intent.category.LAUNCHER", "1" ],
                { stdin: "ignore" }
            )
        );

        if (result.exitCode !== 0)
        {
            return yield* fail(`failed to launch "${ packageName }": ${ result.stderr.trim() }`);
        }
    });
}

const program = Effect.gen(function* ()
{
    const envFileValues = yield* readEnvFile(envFilePath);

    const androidAvdHome = resolveConfigValue(envFileValues, "ANDROID_AVD_HOME");
    const avdName = resolveConfigValue(envFileValues, "DEBUG_AVD");
    const packageName = resolveConfigValue(envFileValues, "PKG_NAME");

    const missingNames = [
        [ "ANDROID_AVD_HOME", androidAvdHome ],
        [ "DEBUG_AVD", avdName ],
        [ "PKG_NAME", packageName ]
    ]
        .filter(([ , value ]) => value === undefined)
        .map(([ name ]) => name);

    if (missingNames.length > 0)
    {
        return yield* fail(
            `missing ${ missingNames.join(", ") } -- set ${ missingNames.length === 1 ? "it" : "them" } in `
            + `"${ envFilePath }" or as an environment variable.`
        );
    }

    const adbPath = yield* resolveExecutable("adb", knownExecutablePaths.adb);

    let serial = yield* findRunningSerial(adbPath, avdName);

    if (serial === undefined)
    {
        const emulatorPath = yield* resolveExecutable("emulator", knownExecutablePaths.emulator);

        yield* Console.log(`start-emulator: launching "${ avdName }"...`);
        yield* launchEmulator(emulatorPath, avdName, androidAvdHome);
        serial = yield* waitForSerial(adbPath, avdName);
    }
    else
    {
        yield* Console.log(`start-emulator: "${ avdName }" is already running as "${ serial }".`);
    }

    yield* Console.log(`start-emulator: waiting for "${ serial }" to finish booting...`);
    yield* waitForBoot(adbPath, serial);

    if (!(yield* isAppInstalled(adbPath, serial, packageName)))
    {
        yield* Console.log(`start-emulator: "${ packageName }" is not installed on "${ serial }" -- nothing to launch.`);
        return;
    }

    if (yield* isAppInForeground(adbPath, serial, packageName))
    {
        yield* Console.log(`start-emulator: "${ packageName }" is already open on "${ serial }".`);
        return;
    }

    yield* Console.log(`start-emulator: launching "${ packageName }" on "${ serial }"...`);
    yield* launchApp(adbPath, serial, packageName);
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
