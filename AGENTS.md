Use agent-device only for app/device automation tasks. Before planning commands, run `agent-device --version` and read `agent-device help workflow`. For TV, Fire TV, or Vega OS tasks, read `agent-device help tv`. For exploratory QA, read `agent-device help dogfood`. For logs, network, audio, traces, or runtime failures, read `agent-device help debugging`. For React Native component trees, props/state/hooks, slow renders, or rerenders, read `agent-device help react-devtools`. For React Native JavaScript heap growth, heap snapshots, or retained-object leaks, read `agent-device help cdp`. For React Native apps, overlays, Metro/Fast Refresh blockers, and routing to React DevTools or debugging evidence, read `agent-device help react-native`.

Use MCP tools or the CLI in the integrated terminal. If `agent-device` is not on PATH but the user installed it globally in another shell, resolve the command the same way the user would from a normal terminal session and run that absolute path instead. This may require inspecting shell startup behavior or package-manager/global bin locations; do not assume the agent process `PATH` is the user's `PATH`. Do not silently fall back to `npx -y agent-device@latest`; ask or use an exact version. MCP exposes structured tools backed by the agent-device client; it does not expose generic shell execution. Prefer `open -> snapshot -i -> act -> re-snapshot -> verify -> close` where the target supports capture and selectors; otherwise follow target-specific help. Use current refs such as `@e3` for exploration and selectors for durable replay. Keep mutating commands against one session serial. Capture screenshots, logs, network, audio, perf, traces, recordings, and `.ad` replay scripts only when they add evidence.

## Local Android SDK setup

> [!NOTE]
> `@TODO` Move this to a `.gitignore`'d document for local development.

On this workstation, the Android SDK's `adb` executable is installed at:

```text
C:\Users\Gage\AppData\Local\Android\Sdk\platform-tools\adb.exe
```

The integrated PowerShell session may have neither `ANDROID_HOME` nor
`ANDROID_SDK_ROOT` set, and `platform-tools` may be absent from `PATH`. If
`agent-device` reports `TOOL_MISSING: adb not found in PATH`, use the existing
installation rather than installing another copy:

```powershell
$env:PATH = "C:\Android\Sdk-Quail3\platform-tools;$env:PATH"
$env:AGENT_DEVICE_STATE_DIR = "C:\Users\Gage\.agent-device\noteferry-android"
agent-device devices --platform android
```

The separate state directory matters when the default `agent-device` daemon was already launched without `adb` on its inherited `PATH`; changing the calling shell's `PATH` does not update that running daemon's environment. Use the same two environment assignments for every subsequent `agent-device` command in that session.

The developer's machine has two Android Studio installations: the up-to-date version (Studio and the SDK) is installed in the usual location (to support VR development in the Unreal Engine; unrelated to NoteFerry), and a separate location at `C:\Android`, with Studio and the SDK present at this secondary location.

## Writing Markdown

Do not split sentences across multiple lines; do not worry about how many columns a line takes up: every time a Markdown file is viewed by a human, assume that line-wrapping is used.

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:

1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes

## React Native Style Guide

All React Native components should be written so that style objects (including `Array`s) and callbacks are not defined inline, and instead are defined in the component with `useMemo` or `useCallback`.
