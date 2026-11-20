# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

Wayfinder has no application code yet, only Claude Code configuration. There are no build, lint, or test commands, and no git repository. Update this file once a stack is chosen and code exists.

## Product

Wayfinder is a React Native (Expo) app with a NestJS API. It combines flight search (Skyscanner-style), stays on a map (Booking-style) and attraction/trip planning (Tripadvisor-style). It **never processes payments**: "booking" is an outbound link to the provider. All data comes from SerpAPI, called server-side only. The app talks to our normalized API, never to raw SerpAPI.

Planning docs (drafts, with open decisions flagged): `docs/tech-stack.md`, `docs/architecture.md`, `docs/planning.md` (by quarter).

SerpAPI usage rules and engine map: @.claude/serpapi-guide.md. Follow it before making any SerpAPI call, because each uncached search costs a credit.

## Claude Code setup

- `.mcp.json` defines the `serpapi` HTTP MCP server (tools: `search`, `extract`, `search_dashboard`, `search_table`). The URL embeds an access token, so keep this file out of version control, or move the URL to an env var.
- `.claude/settings.json` approves only the `serpapi` project MCP server (`enableAllProjectMcpServers` is false) and pins the enabled plugins: superpowers, frontend-design, context7, typescript-lsp, claude-code-setup, supabase, figma, the React/React Native skills pack, and ponytail.
- SerpAPI engine names come from the `serpapi://engines` MCP resource, and per-engine parameters from `serpapi://engines/{engine_name}`.
