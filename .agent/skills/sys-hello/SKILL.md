---
name: sys-hello
description: Use this skill to print a "Hello World" ASCII banner and display system information like OS platform and architecture.
---

# System Hello Skill

This skill provides a stylized greeting and system diagnostics.

## Instructions
1. When the user asks for a greeting or system info, use the integrated terminal to run the script at `./scripts/hello.js`.
2. Always use `node` to execute this script.
3. Report the output back to the user to confirm the environment is active.

## Command:
`node .agent/skills/sys-hello/scripts/hello.js`