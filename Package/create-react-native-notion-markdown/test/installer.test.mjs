import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
    createInstallPlan,
    dependenciesForSetup,
    detectPackageManager,
    generateEditorSnippet,
    normalizeFeatureValues,
    ordinaryInstallArguments
} from "../installer.mjs";

const entrypoint = fileURLToPath(new URL("../index.mjs", import.meta.url));

test("no editor setup installs only the main package", () =>
{
    assert.deepEqual(dependenciesForSetup("none"), [ "react-native-notion-markdown" ]);
});

test("full setup installs all non-host peers once", () =>
{
    const packages = dependenciesForSetup("full");

    assert.equal(packages[0], "react-native-notion-markdown");
    assert.equal(new Set(packages).size, packages.length);
    assert.equal(packages.includes("react"), false);
    assert.equal(packages.includes("react-native"), false);
    assert.equal(packages.includes("expo-modules-core"), true);
});

test("selective setup includes the editor core and deduplicates feature packages", () =>
{
    const packages = dependenciesForSetup("some", [ "audio", "rich-previews", "audio" ]);

    assert.deepEqual(packages.slice(0, 7), [
        "react-native-notion-markdown",
        "expo",
        "expo-document-picker",
        "expo-modules-core",
        "react-native-keyboard-controller",
        "react-native-reanimated",
        "react-native-svg"
    ]);
    assert.equal(packages.filter((name) => name === "expo-audio").length, 1);
    assert.equal(packages.includes("expo-video"), true);
});

test("feature values are validated and deduplicated", () =>
{
    assert.deepEqual(normalizeFeatureValues([ "media,audio", "media" ]), [ "media", "audio" ]);
    assert.throws(() => normalizeFeatureValues([ "unknown" ]), /unknown editor feature/);
});

test("package manager metadata takes precedence over lockfiles", () =>
{
    assert.equal(detectPackageManager({ packageManager: "pnpm@10.0.0" }, [ "package-lock.json" ]), "pnpm");
    assert.equal(detectPackageManager({}, [ "yarn.lock" ]), "yarn");
    assert.equal(detectPackageManager({}, [ "package-lock.json", "pnpm-lock.yaml" ]), "npm");
});

test("install commands use manager-specific verbs", () =>
{
    assert.deepEqual(ordinaryInstallArguments("npm", [ "one" ]), [ "install", "one" ]);
    assert.deepEqual(ordinaryInstallArguments("pnpm", [ "one" ]), [ "add", "one" ]);
    assert.deepEqual(createInstallPlan("yarn", [ "one" ]), { command: "yarn", args: [ "add", "one" ] });
    assert.deepEqual(createInstallPlan("npm", [ "one" ], { expoProject: true, expoCommand: "expo.cmd" }), {
        command: "expo.cmd",
        args: [ "install", "one" ]
    });
});

test("selective setup snippets document omitted integrations", () =>
{
    const snippet = generateEditorSnippet([ "media" ]);

    assert.match(snippet, /Installed batteries included features: Media picker/);
    assert.match(snippet, /Audio recording and playback was not installed/);
    assert.match(snippet, /onInsertAudio/);
    assert.match(snippet, /rebuild/);
    assert.match(snippet, /useCallback/);
});

test("the CLI reports a missing target package.json", async () =>
{
    const directory = await mkdtemp(join(tmpdir(), "create-rn-markdown-"));

    try
    {
        const result = spawnSync(process.execPath, [ entrypoint, "none" ], {
            cwd: directory,
            encoding: "utf8"
        });

        assert.notEqual(result.status, 0);
        assert.match(`${ result.stdout }${ result.stderr }`, /no package\.json found/);
    }
    finally
    {
        await rm(directory, { recursive: true, force: true });
    }
});

test("the CLI reports invalid target package.json content", async () =>
{
    const directory = await mkdtemp(join(tmpdir(), "create-rn-markdown-"));

    try
    {
        await writeFile(join(directory, "package.json"), "{ invalid json");
        const result = spawnSync(process.execPath, [ entrypoint, "none" ], {
            cwd: directory,
            encoding: "utf8"
        });

        assert.notEqual(result.status, 0);
        assert.match(`${ result.stdout }${ result.stderr }`, /could not parse .*package\.json/);
    }
    finally
    {
        await rm(directory, { recursive: true, force: true });
    }
});
