# Changelog

All notable changes to this project are documented here.

## 0.2.1 - 2026-08-29

- Preserve native CodeMirror list indentation by replacing only table content, rather than the entire source line.
- Remove `text-indent` overrides and all `!important` declarations from the plugin stylesheet.
- Remove the broad `:has()` selector that caused unnecessary style invalidation.
- Keep table layout, source reveal, nested indentation, and callout behavior unchanged.

## 0.2.0 - 2026-08-29

- Render indented GFM tables as semantic HTML tables in Live Preview.
- Support optional leading and trailing pipes, escaped pipes, alignment markers, and single-column tables.
- Reveal table source when the user clicks a rendered table or moves the cursor into it.
- Repair indented callouts that Obsidian renders as code blocks in Live Preview.
- Preserve folded callout state and clean up editor resources on unload.
