import test from "node:test"
import assert from "node:assert/strict"
import { discoverExports } from "../dist/discovery.js"
import { REFERENCE_CONFIG } from "../dist/config.js"
import { snapshotId } from "../dist/snapshot.js"

test("discovers the configured code-bearing exports and excludes package.json", () => {
    const modules = discoverExports()
    assert.equal(modules.length, 9)
    assert.deepEqual(modules.map((module) => module.exportPath), REFERENCE_CONFIG.modules.map((module) => module.exportPath))
    assert.equal(modules.some((module) => module.exportPath === "./package.json"), false)
})

test("snapshot identity is deterministic", () => {
    const first = snapshotId("v1", { v1: "a" })
    const second = snapshotId("v1", { v1: "a" })
    assert.equal(first, second)
    assert.match(first, /^api-reference-[0-9a-f]{64}$/)
})
