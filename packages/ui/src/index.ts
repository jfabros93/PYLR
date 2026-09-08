// The "Modernist" design system (Phase 2.1 design update) — see
// tokens.css/globals.css for the underlying tokens each of these reads.
// Consuming apps import "@pylr/ui/src/globals.css" once in their root
// layout (a plain CSS import Next.js resolves through the workspace
// symlink, same as any node_modules package) and load these components
// from here. Unlike @pylr/{db,schemas,auth}, this package ships raw
// source with no build step (same bundler consumes it — see this
// package's original comment and AGENTS.md), so imports here use
// extensionless specifiers under "moduleResolution": "Bundler", not the
// NodeNext `.js`-suffixed style those packages use.
export * from "./Badge";
export * from "./Button";
export * from "./CalendarBlock";
export * from "./FormField";
export * from "./PageHeader";
export * from "./Panel";
export * from "./Sidebar";
export * from "./StatTile";
export * from "./Table";
