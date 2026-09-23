/**
 * Download a Notion page as Notion-enhanced Markdown into the repository's Local directory.
 *
 * @module @react-native-notion-markdown/download-notion-page
 * @file      index.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@notionhq/client";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, Option } from "effect";
import { Command, Flag, Prompt } from "effect/unstable/cli";

const execFileAsync = promisify(execFile);
const packageDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = dirname(dirname(packageDirectory));
const localDirectory = join(repositoryRoot, "Local");
const defaultOutputName = "notion-page.md";
const compactPageIdPattern = /^[0-9a-f]{32}$/i;
const dashedPageIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Convert a compact or dashed Notion ID to the dashed form accepted by the API. */
function normalizePageId(value) {
    const trimmed = value.trim();

    if (!compactPageIdPattern.test(trimmed) && !dashedPageIdPattern.test(trimmed)) {
        return undefined;
    }

    const compact = trimmed.replaceAll("-", "").toLowerCase();
    return `${ compact.slice(0, 8) }-${ compact.slice(8, 12) }-${ compact.slice(12, 16) }-`
        + `${ compact.slice(16, 20) }-${ compact.slice(20) }`;
}

/** Extract a page ID from a Notion URL or return a directly supplied page ID. */
function extractPageId(value) {
    const trimmed = value.trim();
    const directId = normalizePageId(trimmed);

    if (directId !== undefined) {
        return directId;
    }

    let url;

    try {
        url = new URL(trimmed);
    } catch {
        return undefined;
    }

    const hostname = url.hostname.toLowerCase();
    const isNotionHost = hostname === "notion.so"
        || hostname.endsWith(".notion.so")
        || hostname === "notion.site"
        || hostname.endsWith(".notion.site");

    if (!isNotionHost) {
        return undefined;
    }

    const pageIdMatch = url.pathname.match(/[0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i);
    return pageIdMatch === null ? undefined : normalizePageId(pageIdMatch[0]);
}

/** Read the current clipboard using the native clipboard utility for this platform. */
function readClipboard() {
    const commands = process.platform === "win32"
        ? [["powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Get-Clipboard -Raw"]]]
        : process.platform === "darwin"
            ? [["pbpaste", []]]
            : [["wl-paste", ["--no-newline"]], ["xclip", ["-selection", "clipboard", "-o"]], ["xsel", ["--clipboard", "--output"]]];

    return Effect.tryPromise({
        try: async () => {
            for (const [command, args] of commands) {
                try {
                    const result = await execFileAsync(command, args, {
                        encoding: "utf8",
                        windowsHide: true
                    });
                    return result.stdout.trim();
                } catch {
                    // Try the next native clipboard utility when one is unavailable.
                }
            }

            return "";
        },
        catch: () => new Error("could not read the clipboard")
    });
}

/** Ask for a Notion URL or page ID, validating and normalizing the answer. */
function promptForPageId() {
    return Prompt.String({
        message: "Notion document link or page ID:",
        validate: (value) => {
            const pageId = extractPageId(value);
            return pageId === undefined
                ? Effect.fail("Enter a Notion document link or a 32-character page ID.")
                : Effect.succeed(pageId);
        }
    });
}

/** Return a file name that stays within Local and is not empty or a path. */
function validateOutputName(value) {
    const trimmed = value.trim();

    if (trimmed.length === 0 || trimmed === "." || trimmed === "..") {
        return "File name cannot be empty.";
    }

    if (trimmed !== parse(trimmed).base || trimmed.includes("/") || trimmed.includes("\\")) {
        return "Enter a file name, not a path.";
    }

    return undefined;
}

/** Ask for the output file name. */
function promptForOutputName() {
    return Prompt.String({
        message: "Output file name:",
        default: defaultOutputName,
        validate: (value) => {
            const error = validateOutputName(value);
            return error === undefined ? Effect.succeed(value.trim()) : Effect.fail(error);
        }
    });
}

/** Write without overwriting, adding ` (n)` before the extension when necessary. */
async function writeUniqueMarkdown(outputName, markdown) {
    await mkdir(localDirectory, { recursive: true });

    const { name, ext } = parse(outputName);
    let suffix = 0;

    while (true) {
        const candidateName = suffix === 0 ? outputName : `${ name } (${ suffix })${ ext }`;
        const candidatePath = join(localDirectory, candidateName);

        try {
            await writeFile(candidatePath, markdown, { encoding: "utf8", flag: "wx" });
            return candidatePath;
        } catch (error) {
            if (error?.code !== "EEXIST") {
                throw error;
            }

            suffix += 1;
        }
    }
}

/** Print a user-facing error and terminate the command with a failure status. */
function fail(message) {
    return Effect.gen(function* () {
        yield* Console.error(`download-notion-page: ${ message }`);
        return yield* Effect.sync(() => process.exit(1));
    });
}

const download = Command.make(
    "download-notion-page",
    {
        id: Flag.String("id").pipe(
            Flag.withDescription("Notion document link or page ID"),
            Flag.optional
        ),
        out: Flag.String("out").pipe(
            Flag.withDescription("Output file name in the repository's Local directory"),
            Flag.optional
        )
    },
    ({ id, out }) => Effect.gen(function* () {
        const suppliedId = Option.getOrUndefined(id);
        const suppliedOutputName = Option.getOrUndefined(out);

        if (process.env.NOTION_TOKEN === undefined || process.env.NOTION_TOKEN.trim().length === 0) {
            return yield* fail("NOTION_TOKEN is not set.");
        }

        const pageId = suppliedId === undefined
            ? yield* readClipboard().pipe(
                Effect.map(extractPageId),
                Effect.flatMap((clipboardPageId) => clipboardPageId === undefined
                    ? promptForPageId()
                    : Effect.succeed(clipboardPageId))
            )
            : extractPageId(suppliedId);

        if (pageId === undefined) {
            return yield* fail("--id must be a Notion document link or a 32-character page ID.");
        }

        const outputName = suppliedOutputName === undefined
            ? yield* promptForOutputName()
            : suppliedOutputName.trim();
        const outputError = validateOutputName(outputName);

        if (outputError !== undefined) {
            return yield* fail(`--out is invalid: ${ outputError }`);
        }

        const notion = new Client({ auth: process.env.NOTION_TOKEN });
        yield* Console.log(`Downloading Notion page ${ pageId }...`);

        const response = yield* Effect.tryPromise({
            try: () => notion.pages.retrieveMarkdown({ page_id: pageId }),
            catch: (error) => new Error(error instanceof Error ? error.message : String(error))
        }).pipe(
            Effect.mapError((error) => new Error(`could not retrieve the Notion page: ${ error.message }`))
        );

        const outputPath = yield* Effect.tryPromise({
            try: () => writeUniqueMarkdown(outputName, response.markdown),
            catch: (error) => new Error(error instanceof Error ? error.message : String(error))
        }).pipe(
            Effect.mapError((error) => new Error(`could not write the Markdown file: ${ error.message }`))
        );

        yield* Console.log(`Saved enhanced Markdown to ${ outputPath }.`);
    })
);

NodeRuntime.runMain(
    Command.run(download, { version: "0.1.0" }).pipe(Effect.provide(NodeServices.layer))
);
