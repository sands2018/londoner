# Londoner

Modern rebuild of the Londoner roulette analysis tool.

The original static application is preserved in `legacy/` as the functional reference while the new frontend is rebuilt in `app/`.

## Development

The new app is planned as a Vite + React + TypeScript project.

```powershell
cd app
npm install
npm run dev
```

## Structure

- `legacy/`: Original static site, kept intact for behavior comparison.
- `app/src/core/`: Pure roulette domain logic and statistics.
- `app/src/storage/`: Storage adapters. Local-first now, cloud sync later.
- `app/src/ui/`: React UI components.

## Product Requirements

- Cross-platform visual consistency is a baseline requirement. Pages and dialogs should render as closely as possible across iPhone, Android, Chrome, Edge, Firefox, Safari, and installed PWA mode.
- Shared UI tokens in `app/src/ui/styles.css` should be preferred for fonts, weights, dialog titles, buttons, tables, and control sizing. New pages should not introduce one-off typography or platform-specific sizing unless there is a verified browser bug.
- Typography must use the shared font stack and standard embedded weights only. Avoid ad hoc weights such as 480/520/560/580 because mobile browsers synthesize those differently and make Android/iPhone diverge.
- Button typography must use the shared action/control tokens so dialog buttons, data-list buttons, and modal buttons keep the same font style and size unless a compact keyboard layout explicitly requires a separate control token.
- Viewport height may adjust available layout space, but it should not switch core typography tokens. Browser address bars change visible height on Android, so height-based font overrides make platforms look inconsistent.
- The legacy app in `legacy/` remains the behavioral reference. Modern UI can be refactored, but workflows should stay compatible unless a change is explicitly agreed.
