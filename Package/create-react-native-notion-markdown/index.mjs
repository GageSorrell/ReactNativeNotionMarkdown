#!/usr/bin/env node

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Command } from "effect/unstable/cli";
import { Effect } from "effect";
import { command } from "./installer.mjs";

NodeRuntime.runMain(Command.run(command, { version: "0.0.1" }).pipe(Effect.provide(NodeServices.layer)));
