# Future: Rich Terminal UI for Output

## The Idea

Replace plain markdown terminal output (L1 summary) with rich interactive widgets rendered inside Claude Code's terminal. Think: colored severity bars, collapsible persona cards, inline passage highlighting.

## How It Could Work

Blog post reverse-engineering Claude Code's generative UI: https://michaellivs.com/blog/reverse-engineering-claude-generative-ui

Key mechanism:
- Claude Code extensions can define custom tools (`show_widget`) that render HTML directly in the terminal
- Uses DOM injection (not iframes) with streaming progressive rendering
- `morphdom` library for smooth DOM diffing (no flashing on updates)
- Sub-50ms native macOS WKWebView windows via Glimpse for interactive content

## What We'd Build

A Claude Code extension with:
1. A `show_widget` tool that renders the L1 summary as a rich HTML widget
2. Persona cards with color-coded severity
3. Collapsible sections for L2/L3 detail
4. Possibly inline text highlighting showing where each persona stumbled

## When to Do This

After the core engine is validated — personas produce useful feedback, output format is stable, and the tool is being used regularly. This is a polish/delight layer, not core functionality.

## Prerequisites

- Working v1 with stable output format
- Understanding of Claude Code extension API (may not be public yet)
- Decision on whether to build as extension vs. standalone CLI with rich terminal output (e.g., using Rich/Textual in Python)
