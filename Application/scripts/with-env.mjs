/**
 * Runs a command after loading `Application/.env` (if present) into its environment --
 * `expo run:android` and the Gradle build it shells out to need `JAVA_HOME` and the
 * `ANDROID_*` SDK variables, which this workstation's ambient shell doesn't always set
 * (see `AGENTS.md`). A `.env` value never overrides one already set in the calling
 * shell; it only fills in what's missing. When `JAVA_HOME`/`ANDROID_HOME`/
 * `ANDROID_SDK_ROOT` end up set (from `.env` or the shell), their `bin`/
 * `platform-tools`/`emulator`/`cmdline-tools` directories are prepended to `PATH` if
 * not already on it, so `java`/`adb`/`emulator` resolve without further setup.
 *
 * Usage: `node scripts/with-env.mjs <command> [...args]`
 *
 * @module markdown-storybook/scripts/with-env
 *
 * @file      with-env.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

/* eslint-disable no-console */

const applicationDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(applicationDirectory, ".env");

/** Print a `with-env:`-prefixed error and exit non-zero. */
function fail(message)
{
    console.error(`with-env: ${ message }`);
    process.exit(1);
}

/** Parse simple `KEY=VALUE` lines from a `.env` file's text, ignoring blanks and `#` comments. */
function parseEnvFile(text)
{
    const values = { };

    for (const rawLine of text.split(/\r?\n/))
    {
        const line = rawLine.trim();

        if (line === "" || line.startsWith("#"))
        {
            continue;
        }

        const separatorIndex = line.indexOf("=");

        if (separatorIndex === -1)
        {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();

        const quoted = (value.startsWith("\"") && value.endsWith("\""))
            || (value.startsWith("'") && value.endsWith("'"));

        if (quoted)
        {
            value = value.slice(1, -1);
        }

        values[key] = value;
    }

    return values;
}

/** Merge parsed `.env` values into `env`, without overriding anything already set. */
function applyEnvFile(env)
{
    if (!existsSync(envPath))
    {
        return;
    }

    const parsed = parseEnvFile(readFileSync(envPath, "utf8"));

    for (const [ key, value ] of Object.entries(parsed))
    {
        if (env[key] === undefined || env[key] === "")
        {
            env[key] = value;
        }
    }
}

/**
 * Find the actual `PATH` key in `env`. Windows environment blocks are
 * case-insensitive, but `process.env`'s special case-insensitive lookup is
 * lost once it's spread into a plain object (`{ ...process.env }`), and the
 * key is spelled `Path`/`path`/`PATH` depending on shell. Resolving it here
 * (instead of hardcoding `PATH`) avoids creating a second, differently-cased
 * `PATH` key that shadows or gets shadowed by the real one in the child
 * process's environment.
 */
function findPathKey(env)
{
    return Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
}

/** Prepend a directory to `PATH` if it exists on disk and isn't already on it. */
function prependToPath(env, directory)
{
    if (!existsSync(directory))
    {
        return;
    }

    const pathKey = findPathKey(env);
    const entries = (env[pathKey] ?? "").split(";").filter((entry) => entry.length > 0);

    if (entries.some((entry) => entry.toLowerCase() === directory.toLowerCase()))
    {
        return;
    }

    env[pathKey] = [ directory, ...entries ].join(";");
}

/** Add the well-known `bin`/SDK-tool subdirectories of `JAVA_HOME`/`ANDROID_HOME` to `PATH`. */
function extendPathFromSdkVariables(env)
{
    if (env.JAVA_HOME)
    {
        prependToPath(env, join(env.JAVA_HOME, "bin"));
    }

    const androidHome = env.ANDROID_HOME ?? env.ANDROID_SDK_ROOT;

    if (androidHome)
    {
        prependToPath(env, join(androidHome, "platform-tools"));
        prependToPath(env, join(androidHome, "emulator"));
        prependToPath(env, join(androidHome, "cmdline-tools", "latest", "bin"));
    }
}

const [ command, ...args ] = process.argv.slice(2);

if (command === undefined)
{
    fail("usage: node scripts/with-env.mjs <command> [...args]");
}

const env = { ...process.env };
applyEnvFile(env);
extendPathFromSdkVariables(env);

const result = spawnSync(command, args, { env, shell: process.platform === "win32", stdio: "inherit" });

if (result.error)
{
    fail(`could not run "${ command }": ${ result.error.message }`);
}

process.exit(result.status ?? 1);

/* eslint-enable no-console */
