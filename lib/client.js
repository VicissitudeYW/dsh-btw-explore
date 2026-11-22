window.__ModuleLoader__.load({
  id: 'dsh-btw-explore',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const EXPLORE_CSS = "[data-conversation-content]:has(.dsh-btw-explore:not(.dsh-btw-explore-page)) [data-composer-seat] { display: none; }\n\n.dsh-btw-explore, .dsh-btw-overlay {\n  --btw-bg: var(--dsw-alias-bg-base, #fff);\n  --btw-raised: var(--dsw-alias-bg-layer-1, #fff);\n  --btw-side: var(--dsw-specific-sidebar-fill, #f7f7f8);\n  --btw-ink: var(--dsw-alias-label-primary, #202024);\n  --btw-muted: var(--dsw-alias-label-secondary, #62626a);\n  --btw-line: var(--dsw-alias-border-l2, #e3e3e6);\n  --btw-hairline: var(--dsw-alias-border-l1, #ededf0);\n  --btw-accent: var(--dsw-alias-brand-primary, #29292e);\n  --btw-error: var(--dsw-alias-state-error-primary, #ba343e);\n  --btw-hover: color-mix(in srgb, var(--btw-ink) 5%, transparent);\n  --btw-selected: color-mix(in srgb, var(--btw-accent) 8%, transparent);\n}\n\n.dsh-btw-explore {\n  box-sizing: border-box;\n  container: btw-explore / inline-size;\n  height: 100%;\n  min-height: 320px;\n  width: 100%;\n  color: var(--btw-ink);\n  background: var(--btw-bg);\n  font: 13px/1.5 var(--dsw-font-family, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif);\n  overflow: hidden;\n  text-align: start;\n  color-scheme: inherit;\n}\n\n.dsh-btw-explore *, .dsh-btw-explore *::before, .dsh-btw-explore *::after { box-sizing: border-box; }\n.dsh-btw-explore ::selection { color: var(--btw-ink); background: color-mix(in srgb, var(--btw-accent) 19%, transparent); }\n.dsh-btw-explore button:where(:not([data-text-interaction-surface] *)),\n.dsh-btw-explore textarea, .dsh-btw-explore input { font: inherit; }\n.dsh-btw-explore button { touch-action: manipulation; }\n.dsh-btw-explore button:where(:not([data-text-interaction-surface] *, .dsh-btw-selection-button)):focus-visible,\n.dsh-btw-explore input:focus-visible { outline: 2px solid var(--btw-accent); outline-offset: 3px; }\n.dsh-btw-explore button:disabled { cursor: default; opacity: .42; }\n.dsh-btw-explore a { color: inherit; text-underline-offset: 3px; }\n\n.dsh-btw-layout { display: grid; grid-template-columns: 222px minmax(0, 1fr); height: 100%; min-height: inherit; }\n.dsh-btw-sidebar { display: flex; min-width: 0; min-height: 0; flex-direction: column; background: var(--btw-side); border-right: 1px solid var(--btw-hairline); }\n.dsh-btw-side-head { display: flex; align-items: center; flex-shrink: 0; gap: 8px; min-height: 56px; padding: 12px 12px 10px 18px; }\n.dsh-btw-side-title { font-size: 13px; font-weight: 600; margin: 0; }\n.dsh-btw-card-count { color: var(--btw-muted); font-size: 12px; font-variant-numeric: tabular-nums; }\n.dsh-btw-side-head > .dsh-btw-button { margin-inline-start: auto; }\n.dsh-btw-mobile-tree-button { display: none; }\n.dsh-btw-tree { min-height: 0; padding: 2px 8px 24px; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }\n.dsh-btw-roots, .dsh-btw-children { list-style: none; margin: 0; padding: 0; }\n.dsh-btw-node { position: relative; min-width: 0; }\n.dsh-btw-node-line { display: flex; align-items: center; min-height: 36px; border-radius: 7px; padding: 2px 4px 2px 2px; gap: 1px; }\n.dsh-btw-node-line:hover { background: var(--btw-hover); }\n.dsh-btw-node-line.is-current { background: var(--btw-selected); }\n.dsh-btw-node-line.is-current .dsh-btw-node-name { font-weight: 600; }\n.dsh-btw-node-link { flex: 1; display: flex; gap: 8px; align-items: center; width: 0; min-width: 0; min-height: 30px; border: 0; padding: 2px 4px 2px 0; border-radius: 4px; text-align: start; color: inherit; background: none; cursor: pointer; }\n.dsh-btw-node-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }\n.dsh-btw-node-status { flex-shrink: 0; font-size: 11px; color: var(--btw-muted); }\n.dsh-btw-fold, .dsh-btw-fold-space { width: 18px; height: 26px; flex-shrink: 0; }\n.dsh-btw-fold { color: var(--btw-muted); border: 0; border-radius: 4px; padding: 0; background: none; cursor: pointer; display: grid; place-items: center; }\n.dsh-btw-fold:hover { color: var(--btw-ink); }\n.dsh-btw-fold::before, .dsh-btw-chevron::before { content: \"\"; display: block; width: 5px; height: 5px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); }\n.dsh-btw-fold.is-open::before { transform: translateY(-2px) rotate(45deg); }\n.dsh-btw-node-mark { flex-shrink: 0; width: 8px; height: 8px; border: 1px solid var(--btw-muted); border-radius: 2px; }\n.dsh-btw-mark-child { border-radius: 50%; }\n.dsh-btw-mark-branch { width: 7px; height: 7px; transform: rotate(45deg); border-radius: 1px; }\n.dsh-btw-children { position: relative; margin-inline-start: 11px; padding-inline-start: 11px; }\n.dsh-btw-children::before { content: \"\"; position: absolute; inset: -2px auto 17px 0; border-inline-start: 1px solid var(--btw-line); }\n.dsh-btw-children > .dsh-btw-node::before { content: \"\"; position: absolute; top: 18px; left: -11px; width: 11px; border-top: 1px solid var(--btw-line); }\n.dsh-btw-tree-empty { margin: 20px 10px; color: var(--btw-muted); font-size: 12px; }\n.dsh-btw-working-dot { display: block; flex-shrink: 0; width: 5px; height: 5px; border-radius: 50%; background: var(--btw-accent); animation: dsh-btw-breathe 1.5s ease-in-out infinite; }\n.dsh-btw-incomplete-dot { display: block; flex-shrink: 0; width: 5px; height: 5px; border-radius: 50%; border: 1px solid var(--btw-muted); }\n\n.dsh-btw-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; position: relative; }\n.dsh-btw-head { flex-shrink: 0; padding: 16px 24px 14px; border-bottom: 1px solid var(--btw-hairline); }\n.dsh-btw-head-path { display: flex; align-items: center; justify-content: space-between; min-width: 0; gap: 16px; margin-bottom: 12px; }\n.dsh-btw-head-path > .dsh-btw-button { white-space: nowrap; font-size: 12px; }\n.dsh-btw-crumbs { display: flex; flex: 1; align-items: center; gap: 7px; min-width: 0; overflow-x: auto; color: var(--btw-muted); font-size: 12px; scrollbar-width: none; white-space: nowrap; }\n.dsh-btw-crumb { display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0; }\n.dsh-btw-crumbs > span:first-child { padding-inline: 1px; }\n.dsh-btw-crumb .dsh-btw-button { max-width: 132px; min-height: 24px; overflow: hidden; text-overflow: ellipsis; font-size: 12px; padding: 0 3px; }\n.dsh-btw-crumb-divider { width: 5px; height: 5px; border-top: 1px solid currentColor; border-right: 1px solid currentColor; transform: rotate(45deg); opacity: .65; }\n.dsh-btw-head-title { display: flex; align-items: start; justify-content: space-between; gap: 16px; }\n.dsh-btw-head-title h2 { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; }\n.dsh-btw-head-title > .dsh-btw-button { flex-shrink: 0; }\n.dsh-btw-card-meta { margin: 5px 0 0; color: var(--btw-muted); font-size: 11px; }\n.dsh-btw-button { display: inline-flex; justify-content: center; align-items: center; flex-shrink: 0; min-height: 30px; max-width: 100%; padding: 4px 10px; color: var(--btw-ink); background: transparent; border: 1px solid var(--btw-line); border-radius: 6px; font-weight: 500; line-height: 1.4; cursor: pointer; }\n.dsh-btw-button:hover:not(:disabled) { background: var(--btw-hover); }\n.dsh-btw-button.dsh-btw-primary { color: var(--btw-bg); background: var(--btw-accent); border-color: var(--btw-accent); }\n.dsh-btw-button.dsh-btw-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--btw-accent) 85%, var(--btw-bg)); }\n.dsh-btw-button.dsh-btw-quiet { border-color: transparent; color: var(--btw-muted); }\n.dsh-btw-button.dsh-btw-quiet:hover:not(:disabled) { color: var(--btw-ink); }\n.dsh-btw-button.dsh-btw-danger { color: var(--btw-error); border-color: color-mix(in srgb, var(--btw-error) 30%, var(--btw-line)); }\n.dsh-btw-inline-actions { display: flex; align-items: center; flex-shrink: 0; gap: 6px; }\n.dsh-btw-banner { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; gap: 12px; border-bottom: 1px solid var(--btw-hairline); background: var(--btw-side); padding: 10px 24px; font-size: 12px; }\n.dsh-btw-banner > span { min-width: 0; overflow-wrap: anywhere; }\n.dsh-btw-banner.dsh-btw-error { color: var(--btw-error); }\n.dsh-btw-error .dsh-btw-button { color: var(--btw-ink); }\n.dsh-btw-banner .dsh-btw-button { min-height: 28px; font-size: 12px; }\n.dsh-btw-scroller { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; overflow-anchor: none; scrollbar-gutter: stable; }\n.dsh-btw-read-column { width: min(100%, 760px); margin-inline: auto; padding: 24px; overflow-wrap: anywhere; }\n.dsh-btw-source { margin-bottom: 24px; padding: 12px 14px; border-radius: 7px; border: 1px solid var(--btw-line); background: var(--btw-side); }\n.dsh-btw-source-head { display: flex; align-items: center; justify-content: space-between; min-width: 0; gap: 12px; }\n.dsh-btw-source-label { display: block; min-width: 0; color: var(--btw-muted); font-size: 11px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n.dsh-btw-source-head .dsh-btw-button { font-size: 11px; min-height: 22px; padding: 0 3px; }\n.dsh-btw-quoted { margin: 7px 0 0; color: var(--btw-muted); font-size: 12px; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }\n.dsh-btw-quoted summary { cursor: pointer; list-style-position: inside; }\n.dsh-btw-quoted-full { padding-top: 8px; }\n.dsh-btw-start-copy { color: var(--btw-muted); margin: 0; max-width: 60ch; font-size: 13px; line-height: 1.8; }\n.dsh-btw-turn { margin: 0; outline-offset: 6px; scroll-margin-top: 16px; }\n.dsh-btw-turn + .dsh-btw-turn { margin-top: 30px; padding-top: 26px; border-top: 1px solid var(--btw-hairline); }\n.dsh-btw-turn-label { margin: 0 0 8px; font-size: 11px; color: var(--btw-muted); font-weight: 500; font-variant-numeric: tabular-nums; }\n.dsh-btw-question { margin: 0 0 20px; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 15px; line-height: 1.75; font-weight: 500; }\n.dsh-btw-answer { position: relative; font-size: var(--dsh-content-font-size, 14px); line-height: 1.75; min-width: 0; }\n.dsh-btw-answer > :first-child { margin-top: 0; }\n.dsh-btw-answer > :last-child { margin-bottom: 0; }\n.dsh-btw-answer pre { overflow-x: auto; max-width: 100%; }\n.dsh-btw-answer img { max-width: 100%; height: auto; }\n.dsh-btw-plain-answer { white-space: pre-wrap; }\n.dsh-btw-answer-selection {\n  --btw-selection-width: 166px;\n  position: absolute; z-index: 2; justify-content: center; user-select: none;\n  left: clamp(0px, calc(var(--btw-selection-x) - var(--btw-selection-width) / 2), calc(100% - min(100%, var(--btw-selection-width))));\n  width: min(var(--btw-selection-width), 100%);\n}\n.dsh-btw-turn-state { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 16px; color: var(--btw-muted); font-size: 12px; }\n.dsh-btw-turn-state > span { overflow-wrap: anywhere; }\n.dsh-btw-turn-state .dsh-btw-button { font-size: 12px; min-height: 28px; }\n.dsh-btw-empty { padding-block: 28px 50px; color: var(--btw-muted); }\n.dsh-btw-empty h3 { font-size: 16px; color: var(--btw-ink); font-weight: 500; margin: 0 0 8px; }\n.dsh-btw-empty p { font-size: 13px; line-height: 1.8; margin: 0 0 18px; max-width: 48ch; }\n\n.dsh-btw-compose-wrap { flex-shrink: 0; padding: 12px 24px 18px; border-top: 1px solid var(--btw-hairline); }\n.dsh-btw-compose { border: 1px solid var(--btw-line); border-radius: 9px; background: var(--btw-raised); max-width: 712px; margin-inline: auto; }\n.dsh-btw-compose:focus-within { border-color: color-mix(in srgb, var(--btw-ink) 48%, var(--btw-line)); }\n.dsh-btw-compose textarea { display: block; resize: vertical; min-height: 76px; max-height: min(240px, 35vh); width: 100%; border: 0; background: none; padding: 12px 13px 8px; outline: 0; color: var(--btw-ink); caret-color: var(--btw-accent); font-size: 13px; line-height: 1.65; }\n.dsh-btw-compose textarea::placeholder { color: var(--btw-muted); opacity: 1; }\n.dsh-btw-compose textarea:disabled { opacity: .65; }\n.dsh-btw-compose-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px 8px 12px; min-height: 44px; }\n.dsh-btw-compose-actions .dsh-btw-button { font-size: 12px; }\n.dsh-btw-preview-toggle { display: flex; align-items: center; gap: 6px; color: var(--btw-muted); font-size: 12px; cursor: pointer; white-space: nowrap; }\n.dsh-btw-preview-toggle input { accent-color: var(--btw-accent); width: 13px; height: 13px; margin: 0; cursor: pointer; }\n.dsh-btw-shortcut { color: var(--btw-muted); font-size: 11px; }\n\n[data-text-interaction-surface]:has([data-dsh-btw-selection]), .dsh-btw-answer-selection {\n  display: flex; flex-wrap: wrap; align-items: center; gap: 6px;\n}\n.dsh-btw-selection-actions { display: contents; }\n/* Match DSH's QuoteSelection action with its theme tokens, not its generated class name. */\nbutton.dsh-btw-selection-button {\n  padding: 5px 10px;\n  border: none;\n  border-radius: 999px;\n  corner-shape: round;\n  background: var(--dsw-alias-button-floating-fill, Canvas);\n  --dsw-elevation-stroke-color: var(--dsw-alias-border-l3);\n  box-shadow: var(--dsw-elevation-panel, 0 0 0 .5px rgb(127 127 127 / 40%), 0 3px 8px rgb(0 0 0 / 12%));\n  color: var(--dsw-alias-label-primary, CanvasText);\n  font: var(--dsw-font-xs-13, 400 13px/20px system-ui, sans-serif);\n  cursor: pointer;\n}\nbutton.dsh-btw-selection-button:focus-visible {\n  background: var(--dsw-alias-button-floating-hover, ButtonFace);\n}\n@media (hover: hover) {\n  button.dsh-btw-selection-button:hover:not(:disabled) {\n    background: var(--dsw-alias-button-floating-hover, ButtonFace);\n  }\n}\n\n.dsh-btw-overlay {\n  --btw-page-inset: clamp(14px, 5dvh, 44px);\n  --btw-page-edge: clamp(10px, 2vw, 28px);\n  --btw-chat-left: 0px;\n  --btw-chat-right: 0px;\n  --btw-chat-width: calc(100% - var(--btw-chat-left) - var(--btw-chat-right));\n  --btw-map-base: 144px;\n  --btw-map-limit: min(32dvw, max(64px, calc(var(--btw-chat-width) - 2 * var(--btw-page-edge) - var(--btw-map-gap) - 280px)));\n  --btw-map-width: clamp(min(var(--btw-map-base), var(--btw-map-limit)), var(--btw-map-content-width, 0px), var(--btw-map-limit));\n  --btw-map-gap: 18px;\n  --btw-map-reserve: 0px;\n  position: fixed;\n  inset: 0;\n  z-index: 100;\n  background: rgb(14 15 21 / 34%);\n}\n.dsh-btw-overlay[data-btw-has-map] { --btw-map-reserve: calc(var(--btw-map-width) + var(--btw-map-gap)); }\n.dsh-btw-backdrop { position: absolute; inset: 0; }\n\n.dsh-btw-page {\n  position: absolute;\n  top: var(--btw-drag-y, 0px);\n  bottom: calc(-1 * var(--btw-drag-y, 0px));\n  left: calc(var(--btw-chat-left) + var(--btw-page-edge) + var(--btw-map-reserve) + var(--btw-drag-x, 0px));\n  right: calc(var(--btw-chat-right) + var(--btw-page-edge) - var(--btw-drag-x, 0px));\n  margin: auto;\n  box-sizing: border-box;\n  width: min(840px, calc(var(--btw-chat-width) - 2 * var(--btw-page-edge) - var(--btw-map-reserve)));\n  height: min(860px, calc(100dvh - 2 * var(--btw-page-inset)));\n  outline: none;\n  overflow: hidden;\n  background: var(--btw-bg);\n  border: 1px solid var(--btw-line);\n  border-radius: 14px;\n  box-shadow: 0 16px 56px rgb(14 15 21 / 26%);\n}\n.dsh-btw-page[data-btw-top] { cursor: grab; }\n.dsh-btw-page :is([data-chat-flow-kind], [data-btw-turn], [data-composer-seat], [data-composer-card]) { cursor: auto; }\n.dsh-btw-page .dsh-btw-head-path { touch-action: none; }\n.dsh-btw-overlay[data-btw-dragging],\n.dsh-btw-overlay[data-btw-dragging] .dsh-btw-page[data-btw-top] { cursor: grabbing; }\n.dsh-btw-explore-page { min-height: 0; }\n.dsh-btw-explore-page .dsh-btw-layout { grid-template-columns: minmax(0, 1fr); }\n.dsh-btw-explore-page .dsh-btw-crumb > span:last-child { max-width: 180px; overflow: hidden; text-overflow: ellipsis; }\n.dsh-btw-explore-page .dsh-btw-head-path > .dsh-btw-button { min-height: 36px; }\n\n.dsh-btw-native { min-width: 0; min-height: 0; display: flex; flex: 1; }\n.dsh-btw-native-source { padding: 10px 16px 0; flex-shrink: 0; }\n.dsh-btw-native-source:empty { display: none; }\n.dsh-btw-native-source .dsh-btw-source { max-height: 114px; overflow: auto; margin-bottom: 4px; }\n.dsh-btw-native-status { padding-inline: 16px; color: var(--btw-muted); }\n\n@keyframes dsh-btw-breathe { 0%, 100% { opacity: .45; } 50% { opacity: 1; } }\n@media (max-width: 900px) {\n  .dsh-btw-overlay { --btw-map-base: 108px; --btw-map-gap: 12px; }\n}\n@media (max-width: 600px) {\n  .dsh-btw-overlay {\n    --btw-page-edge: 6px;\n    --btw-map-base: 72px;\n    --btw-map-gap: 8px;\n  }\n  .dsh-btw-page { border-radius: 10px; }\n}\n@media (max-height: 520px) {\n  .dsh-btw-overlay { --btw-page-inset: 6px; }\n  .dsh-btw-explore-page .dsh-btw-head { padding-block: 7px 9px; }\n  .dsh-btw-explore-page .dsh-btw-head-path { margin-bottom: 4px; }\n  .dsh-btw-explore-page .dsh-btw-compose textarea { min-height: 48px; }\n}\n@media (prefers-reduced-motion: reduce) {\n  .dsh-btw-working-dot { animation: none; }\n}\n\n@container btw-explore (max-width: 700px) {\n  .dsh-btw-layout { display: flex; flex-direction: column; }\n  .dsh-btw-sidebar { flex-shrink: 0; border-right: 0; border-bottom: 1px solid var(--btw-hairline); }\n  .dsh-btw-side-head { padding: 8px 12px 8px 16px; min-height: 46px; }\n  .dsh-btw-side-title { display: none; }\n  .dsh-btw-mobile-tree-button { display: inline-flex; align-items: center; gap: 10px; min-height: 30px; padding: 2px 0; color: var(--btw-ink); background: transparent; border: 0; font-weight: 600; cursor: pointer; }\n  .dsh-btw-chevron { display: inline-grid; width: 12px; height: 12px; place-items: center; }\n  .dsh-btw-chevron::before { transform: translateY(-2px) rotate(45deg); }\n  .dsh-btw-chevron.is-open::before { transform: translateY(1px) rotate(-135deg); }\n  .dsh-btw-tree { display: none; max-height: min(300px, 40vh); padding-top: 0; padding-bottom: 12px; }\n  .dsh-btw-sidebar.is-mobile-open .dsh-btw-tree { display: block; }\n  .dsh-btw-main { flex: 1; }\n  .dsh-btw-head { padding: 13px 16px; }\n  .dsh-btw-head-path { margin-bottom: 7px; gap: 10px; }\n  .dsh-btw-read-column { padding: 20px 16px; }\n  .dsh-btw-banner { padding: 10px 16px; flex-wrap: wrap; gap: 8px; }\n  .dsh-btw-compose-wrap { padding: 10px 12px 12px; }\n}\n\n@container btw-explore (max-width: 390px) {\n  .dsh-btw-head-title h2 { font-size: 16px; }\n  .dsh-btw-head-path { align-items: start; }\n  .dsh-btw-head-path > .dsh-btw-button { padding-inline: 4px; font-size: 11px; }\n  .dsh-btw-shortcut { display: none; }\n  .dsh-btw-compose-actions { justify-content: flex-end; padding-inline-start: 10px; }\n  .dsh-btw-compose-actions .dsh-btw-inline-actions { margin-inline-start: auto; }\n}\n\n.dsh-btw-head {\n  padding: 16px 24px 15px;\n}\n\n.dsh-btw-head-path {\n  gap: 12px;\n  margin-bottom: 10px;\n}\n\n.dsh-btw-head-actions {\n  display: flex;\n  align-items: center;\n  flex-shrink: 0;\n  gap: 2px;\n}\n\n.dsh-btw-crumbs {\n  gap: 8px;\n  line-height: 1.4;\n}\n\n.dsh-btw-crumb-origin,\n.dsh-btw-source-origin {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n}\n\n.dsh-btw-crumb-origin {\n  flex-shrink: 0;\n}\n\n.dsh-btw-chrome-icon {\n  display: block;\n  flex: none;\n  width: 16px;\n  height: 16px;\n}\n\n.dsh-btw-crumb-origin .dsh-btw-chrome-icon {\n  width: 15px;\n  height: 15px;\n  opacity: .8;\n}\n\n.dsh-btw-crumb {\n  gap: 8px;\n  min-width: 0;\n  max-width: 180px;\n}\n\n.dsh-btw-crumb > span:last-child {\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.dsh-btw-crumb-divider {\n  flex: none;\n  width: 4px;\n  height: 4px;\n  opacity: .6;\n}\n\n.dsh-btw-head-title {\n  align-items: start;\n  gap: 12px;\n}\n\n.dsh-btw-head-title h2 {\n  padding-block: 2px;\n  font-size: 18px;\n  line-height: 1.5;\n  font-weight: 600;\n}\n\n.dsh-btw-quote-title {\n  margin: 0;\n  min-width: 0;\n  color: var(--btw-ink);\n  font-size: 23px;\n  font-weight: 600;\n  line-height: 1.32;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n}\n\n.dsh-btw-quote-details {\n  width: 100%;\n  min-width: 0;\n}\n\n.dsh-btw-quote-details summary {\n  display: flex;\n  align-items: start;\n  justify-content: space-between;\n  gap: 8px;\n  border-radius: 4px;\n  cursor: pointer;\n}\n\n.dsh-btw-quote-details summary::-webkit-details-marker {\n  display: none;\n}\n\n.dsh-btw-quote-details summary::after {\n  content: '';\n  flex: 0 0 6px;\n  height: 6px;\n  margin: 9px 6px 0 1px;\n  border: solid var(--btw-muted);\n  border-width: 0 1.5px 1.5px 0;\n  transform: rotate(45deg);\n}\n\n.dsh-btw-quote-details[open] summary::after {\n  transform: translateY(3px) rotate(225deg);\n}\n\n.dsh-btw-quote-details .dsh-btw-quote-title {\n  display: -webkit-box;\n  overflow: hidden;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n}\n\n.dsh-btw-quote-details .dsh-btw-quoted-full {\n  max-height: min(116px, 18dvh);\n  margin: 6px 0 0;\n  padding: 0;\n  overflow: auto;\n  color: var(--btw-muted);\n  font-size: 13px;\n  line-height: 1.55;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n}\n\n.dsh-btw-explore .dsh-btw-chrome-action {\n  gap: 6px;\n  min-height: 32px;\n  padding: 5px 8px;\n  border-radius: 6px;\n  color: var(--btw-muted);\n  font-size: 12px;\n  font-weight: 400;\n  white-space: nowrap;\n}\n\n.dsh-btw-control-label {\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.dsh-btw-explore .dsh-btw-chrome-action:hover:not(:disabled) {\n  color: var(--btw-ink);\n  background: var(--btw-hover);\n}\n\n.dsh-btw-explore .dsh-btw-chrome-action:active:not(:disabled) {\n  background: var(--btw-selected);\n}\n\n.dsh-btw-explore .dsh-btw-chrome-action:focus-visible {\n  outline-offset: 1px;\n}\n\n.dsh-btw-explore-page .dsh-btw-head-path > .dsh-btw-chrome-action {\n  min-height: 32px;\n}\n\n.dsh-btw-head-title > .dsh-btw-remove {\n  margin-inline-end: -8px;\n}\n\n.dsh-btw-explore .dsh-btw-head-actions .dsh-btw-remove {\n  width: 32px;\n  padding: 0;\n}\n\n.dsh-btw-head-actions .dsh-btw-remove .dsh-btw-control-label {\n  display: none;\n}\n\n.dsh-btw-explore .dsh-btw-remove:hover:not(:disabled),\n.dsh-btw-explore .dsh-btw-remove:active:not(:disabled) {\n  color: var(--btw-error);\n  background: color-mix(in srgb, var(--btw-error) 7%, transparent);\n}\n\n.dsh-btw-source {\n  margin-bottom: 22px;\n  padding: 0;\n  border: 0;\n  border-radius: 0;\n  background: transparent;\n}\n\n.dsh-btw-source-head {\n  gap: 12px;\n  min-height: 32px;\n}\n\n.dsh-btw-source-origin {\n  flex: 1;\n  color: var(--btw-muted);\n}\n\n.dsh-btw-source-origin > .dsh-btw-chrome-icon {\n  opacity: .8;\n}\n\n.dsh-btw-source-label {\n  font-size: 12px;\n  line-height: 1.5;\n}\n\n.dsh-btw-source-head .dsh-btw-source-return {\n  gap: 5px;\n  min-height: 32px;\n  padding: 4px 6px;\n  margin-inline-end: -6px;\n  font-size: 12px;\n}\n\n.dsh-btw-source-return .dsh-btw-chrome-icon {\n  width: 14px;\n  height: 14px;\n}\n\n.dsh-btw-quoted {\n  margin: 3px 0 0 24px;\n  max-width: 66ch;\n  font-size: 12px;\n  line-height: 1.7;\n}\n\n.dsh-btw-quoted summary {\n  list-style-position: outside;\n}\n\n.dsh-btw-quote-preview {\n  display: -webkit-box;\n  overflow: hidden;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 2;\n}\n\n.dsh-btw-quoted-full {\n  padding-top: 10px;\n}\n\n.dsh-btw-head > .dsh-btw-source {\n  margin: 5px 0 0;\n}\n\n.dsh-btw-head .dsh-btw-source-head {\n  min-height: 24px;\n}\n\n.dsh-btw-head .dsh-btw-source-return {\n  min-height: 28px;\n}\n\n/* Resize only the native composer inside a card. Its controls and editor stay native. */\n.dsh-btw-native [data-composer-card] {\n  max-inline-size: min(100%, 600px);\n  row-gap: 2px;\n  padding-block-start: 3px;\n}\n\n.dsh-btw-native [data-composer-input] {\n  min-block-size: calc(24px + var(--dsh-content-font-delta, 0px));\n  padding-block-start: 2px;\n}\n\n.dsh-btw-native [data-input-scroll] {\n  max-block-size: min(var(--dsh-composer-text-max-height, 336px), max(88px, 23dvh));\n}\n\n@container btw-explore (max-width: 700px) {\n  .dsh-btw-head {\n    padding: 12px 16px 13px;\n  }\n\n  .dsh-btw-head-path {\n    gap: 8px;\n    margin-bottom: 8px;\n  }\n\n  .dsh-btw-head-title h2 {\n    font-size: 17px;\n  }\n\n  .dsh-btw-quote-title {\n    font-size: 21px;\n  }\n}\n\n@container btw-explore (max-width: 390px) {\n  .dsh-btw-head-path {\n    align-items: center;\n    gap: 6px;\n  }\n\n  .dsh-btw-head-path .dsh-btw-crumb-origin > .dsh-btw-chrome-icon {\n    display: none;\n  }\n\n  .dsh-btw-explore .dsh-btw-chrome-action {\n    gap: 4px;\n    padding-inline: 5px;\n  }\n\n  .dsh-btw-head-title h2 {\n    font-size: 16px;\n  }\n\n  .dsh-btw-quote-title {\n    font-size: 19px;\n  }\n}\n\n.dsh-btw-map {\n  --btw-map-ease: cubic-bezier(.16, 1, .3, 1);\n  --btw-map-dot-ink: color-mix(in srgb, var(--btw-ink) 75%, var(--btw-bg));\n  --btw-map-path-ink: color-mix(in srgb, var(--btw-ink) 85%, var(--btw-bg));\n  --btw-map-link-ink: color-mix(in srgb, var(--btw-ink) 64%, var(--btw-bg));\n  display: block;\n  position: absolute;\n  z-index: 2;\n  left: calc(var(--btw-chat-left) + var(--btw-page-edge));\n  inset-block-start: 50%;\n  transform: translateY(-50%);\n  box-sizing: border-box;\n  width: var(--btw-map-width);\n  height: min(60dvh, 480px, max(200px, var(--btw-map-content-height, 200px)));\n  font: 12px/1.45 var(--dsw-font-family, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif);\n  color: var(--btw-ink);\n  animation: dsh-btw-map-appear 260ms var(--btw-map-ease);\n}\n.dsh-btw-map-viewport {\n  width: 100%;\n  height: 100%;\n  overflow: auto;\n  scrollbar-width: none;\n  overflow-anchor: none;\n  overscroll-behavior: contain;\n  touch-action: none;\n  cursor: grab;\n  user-select: none;\n  -webkit-mask-image: linear-gradient(to right, transparent, #000 10px, #000 calc(100% - 10px), transparent), linear-gradient(transparent, #000 20px, #000 calc(100% - 20px), transparent);\n  -webkit-mask-composite: source-in;\n  mask-image: linear-gradient(to right, transparent, #000 10px, #000 calc(100% - 10px), transparent), linear-gradient(transparent, #000 20px, #000 calc(100% - 20px), transparent);\n  mask-composite: intersect;\n}\n.dsh-btw-map-viewport::-webkit-scrollbar { display: none; }\n.dsh-btw-map:is([data-btw-near], :has(.dsh-btw-map-node:focus-visible)) {\n  --btw-map-dot-ink: var(--btw-ink);\n  --btw-map-path-ink: var(--btw-ink);\n  --btw-map-link-ink: color-mix(in srgb, var(--btw-ink) 82%, var(--btw-bg));\n}\n.dsh-btw-map:not(:hover, :has(.dsh-btw-map-node:focus-visible)) .dsh-btw-map-hint { visibility: hidden; }\n.dsh-btw-map-viewport[data-btw-dragging] { cursor: grabbing; }\n.dsh-btw-map-stage { box-sizing: content-box; width: max-content; }\n.dsh-btw-map-graph { position: relative; flex: none; }\n.dsh-btw-map-current, .dsh-btw-map-node,\n.dsh-btw-map-halo, .dsh-btw-map-dot { corner-shape: round; }\n\n.dsh-btw-map-lines { position: absolute; inset: 0; overflow: visible; pointer-events: none; }\n.dsh-btw-map-lines path {\n  fill: none;\n  stroke: var(--btw-map-link-ink);\n  stroke-width: 1.75;\n  stroke-linecap: round;\n  vector-effect: non-scaling-stroke;\n  transition: stroke 200ms ease-out, stroke-width 200ms ease-out, d 320ms var(--btw-map-ease);\n}\n.dsh-btw-map-lines path[data-btw-on-path] { stroke: var(--btw-map-path-ink); stroke-width: 2; }\n.dsh-btw-map-current {\n  position: absolute;\n  left: -12px;\n  top: -12px;\n  width: 24px;\n  height: 24px;\n  border-radius: 50%;\n  background: var(--btw-ink);\n  opacity: .28;\n  filter: blur(5px);\n  pointer-events: none;\n  transition: transform 320ms var(--btw-map-ease);\n}\n.dsh-btw-map-node {\n  position: absolute;\n  display: grid;\n  place-items: center;\n  width: 36px;\n  height: 36px;\n  transform: translate(-50%, -50%);\n  border: 0;\n  border-radius: 50%;\n  padding: 0;\n  color: var(--btw-muted);\n  background: transparent;\n  cursor: pointer;\n  touch-action: none;\n  isolation: isolate;\n  outline: none;\n  transition: left 320ms var(--btw-map-ease), top 320ms var(--btw-map-ease);\n}\n.dsh-btw-map-node:hover, .dsh-btw-map-node:focus-visible { color: var(--btw-ink); background: transparent; outline: none; }\n.dsh-btw-map-node .dsh-btw-map-halo {\n  box-sizing: border-box;\n  position: absolute;\n  width: 36px;\n  height: 36px;\n  border: 1px solid var(--btw-accent);\n  border-radius: 50%;\n  background: color-mix(in srgb, var(--btw-accent) 8%, transparent);\n  opacity: 0;\n  transform: scale(.86);\n  transition: opacity 160ms ease-out, transform 200ms var(--btw-map-ease);\n}\n.dsh-btw-map-node .dsh-btw-map-dot {\n  box-sizing: border-box;\n  width: 24px;\n  height: 24px;\n  border: 1.75px solid var(--btw-map-dot-ink);\n  border-radius: 50%;\n  background: transparent;\n  transition: transform 160ms var(--btw-map-ease), background-color 200ms ease-out, border-color 200ms ease-out, border-width 200ms ease-out, box-shadow 200ms ease-out;\n}\n.dsh-btw-map-node[data-btw-relation=\"home\"] .dsh-btw-map-dot { width: 28px; height: 28px; border-width: 2px; }\n.dsh-btw-map-node[data-btw-on-path] .dsh-btw-map-dot { border: 2.5px solid var(--btw-map-path-ink); }\n.dsh-btw-map-node:not([aria-current]):hover .dsh-btw-map-dot { border: 3px solid var(--btw-accent); }\n.dsh-btw-map-node[aria-current=\"page\"] .dsh-btw-map-dot {\n  background: var(--btw-map-path-ink);\n  border: 2px solid var(--btw-map-path-ink);\n  box-shadow: 0 0 5px color-mix(in srgb, var(--btw-ink) 55%, transparent);\n}\n.dsh-btw-map-node:focus-visible .dsh-btw-map-halo { opacity: 1; transform: scale(1); }\n.dsh-btw-map-node:active .dsh-btw-map-dot { transform: scale(.9); }\n.dsh-btw-map-viewport[data-btw-dragging] .dsh-btw-map-node { cursor: grabbing; }\n.dsh-btw-map-viewport[data-btw-dragging] .dsh-btw-map-node .dsh-btw-map-dot { transform: none; }\n.dsh-btw-map-hint {\n  position: absolute;\n  inset-inline-start: calc(100% + 8px);\n  top: clamp(16px, var(--btw-map-hint-y), calc(100% - 16px));\n  width: max-content;\n  max-width: min(250px, calc(100dvw - var(--btw-map-width) - 32px));\n  padding: 7px 10px;\n  border: 1px solid var(--btw-line);\n  border-radius: 7px;\n  color: var(--btw-ink);\n  background: var(--btw-raised);\n  box-shadow: 0 4px 18px rgb(14 15 21 / 16%);\n  pointer-events: none;\n  transform: translateY(-50%);\n  animation: dsh-btw-map-hint-in 160ms var(--btw-map-ease);\n}\n.dsh-btw-map-hint-title { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 500; font-size: 12px; }\n@keyframes dsh-btw-map-appear { from { translate: -6px 0; } }\n@keyframes dsh-btw-map-hint-in { from { opacity: 0; translate: -4px 0; } }\n@media (prefers-reduced-motion: reduce) {\n  .dsh-btw-map, .dsh-btw-map-hint { animation: none; }\n  .dsh-btw-map-viewport, .dsh-btw-map-current, .dsh-btw-map-node, .dsh-btw-map-lines path,\n  .dsh-btw-map-node .dsh-btw-map-dot, .dsh-btw-map-node .dsh-btw-map-halo { transition: none; }\n}\n\n/* Only the first entrance and final exit move the frame. In-deck navigation\n   keeps a single opaque card over the chat and animates only its contents. */\n.dsh-btw-overlay .dsh-btw-page { transition: none; }\n.dsh-btw-overlay .dsh-btw-page[data-btw-top] { animation: none; z-index: 2; }\n.dsh-btw-page-content { height: 100%; }\n.dsh-btw-overlay .dsh-btw-page[data-btw-motion-surface=\"frame\"] {\n  transform-origin: var(--btw-motion-origin-x, 50%) var(--btw-motion-origin-y, 50%);\n  will-change: translate, scale, opacity;\n}\n.dsh-btw-page[data-btw-motion-surface=\"content\"] > .dsh-btw-page-content { will-change: translate, opacity; }\n.dsh-btw-overlay:not([data-btw-closing]) .dsh-btw-page:not([data-btw-top]) { visibility: hidden; }\n.dsh-btw-overlay .dsh-btw-page[data-btw-leaving] {\n  z-index: 1;\n  transform: none;\n  pointer-events: none;\n}\n.dsh-btw-overlay[data-btw-closing] { pointer-events: none; }\n\n@media (prefers-reduced-motion: reduce) {\n  .dsh-btw-overlay .dsh-btw-page[data-btw-motion-surface=\"frame\"],\n  .dsh-btw-page[data-btw-motion-surface=\"content\"] > .dsh-btw-page-content { will-change: auto; }\n}\n";
    const EXPLORE_QUESTION_LIMIT = 8000;
const EXPLORE_QUOTE_LIMIT = 4000;
const EXPLORE_EMPTY_CARDS = [];
const exploreChangeListeners = new Map();
const EXPLORE_TURN_ERRORS = {
  failed: '回答未完成，可以重试本轮。',
  cancelled: '已停止生成。',
  interrupted: '生成已中断，可以重试本轮。',
};

function exploreTitle(card) {
  return card?.title?.trim() || '未命名卡片';
}

function exploreTrail(card, byId) {
  const trail = [];
  const visited = new Set();
  for (let node = card; node && !visited.has(node.id); node = byId.get(node.parentId)) {
    trail.push(node);
    visited.add(node.id);
  }
  return trail.reverse();
}

function explorePreferences(sessionId) {
  try {
    const prefs = JSON.parse(window.localStorage.getItem(`dsh-btw-explore:view:${sessionId}`));
    return {
      selected: typeof prefs?.selected === 'string' ? prefs.selected : null,
      collapsed: new Set(Array.isArray(prefs?.collapsed) ? prefs.collapsed : []),
    };
  } catch {
    return { selected: null, collapsed: new Set() };
  }
}

function exploreRootDraft(entry) {
  const quote = (entry?.quote || '').trim().slice(0, EXPLORE_QUOTE_LIMIT);
  return { key: 'root', relation: 'root', source: entry?.source, quote, preview: Boolean(quote) };
}

function exploreButton(label, props = {}, tone = '') {
  return h('button', { type: 'button', className: `dsh-btw-button${tone ? ` dsh-btw-${tone}` : ''}`, ...props }, label);
}

function exploreChromeIcon(name) {
  const paths = {
    explore: ['M7 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3', 'M8 7h12v14H8z'],
    back: ['M19 12H5', 'm11 6-6 6 6 6'],
    source: ['M9 5H4v5h5V5Zm0 5c0 4-1 6-4 8', 'M20 5h-5v5h5V5Zm0 5c0 4-1 6-4 8'],
    return: ['m9 5-5 5 5 5', 'M4 10h10a5 5 0 0 1 5 5v4'],
    remove: ['M4 7h16', 'M9 7V4h6v3', 'm6 7 1 13h10l1-13', 'M10 11v5', 'M14 11v5'],
  };
  return h('svg', { className: 'dsh-btw-chrome-icon', key: 'icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
  }, (paths[name] ?? paths.back).map((d, index) => h('path', { d, key: index })));
}

function exploreChromeButton(label, icon, props = {}, variant = '') {
  return exploreButton([
    exploreChromeIcon(icon),
    h('span', { className: 'dsh-btw-control-label', key: 'label' }, label),
  ], { ...props, className: `dsh-btw-button dsh-btw-quiet dsh-btw-chrome-action${variant ? ` dsh-btw-${variant}` : ''}` });
}

function isCoveredExploreReader(element) {
  const page = element.closest('.dsh-btw-page');
  return page ? !page.hasAttribute('data-btw-top') : Boolean(document.querySelector('.dsh-btw-overlay'));
}

// The client build supplies the renderer's React instance, including the Markdown renderer.
function ExploreView({ sessionId, initialDraft = null, initialCardId, onBindCard, onReadCards, onNavigate, onChat, onClosePage,
  pageTitleId, returnLabel, request, Markdown, renderNative, nativeCards = Boolean(renderNative), isPageClosing = false }) {
  const { useEffect, useLayoutEffect, useMemo, useRef, useState } = React;
  const isPage = Boolean(onClosePage);
  const preferences = useMemo(() => isPage ? null : explorePreferences(sessionId), [sessionId, isPage]);
  const [selectedId, setSelectedId] = useState(initialCardId ?? preferences?.selected ?? null);
  const [collapsed, setCollapsed] = useState(() => preferences?.collapsed ?? new Set());
  const [composer, setComposer] = useState(initialDraft);
  const [drafts, setDrafts] = useState(() => new Map());
  const [reading, setReading] = useState(null);
  const [readError, setReadError] = useState('');
  const [operationError, setOperationError] = useState('');
  const [pending, setPending] = useState('');
  const [reload, setReload] = useState(0);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [quoteSelection, setQuoteSelection] = useState(null);
  const [anchor, setAnchor] = useState(null);
  const currentId = useRef(selectedId);
  const currentComposer = useRef(composer);
  const active = useRef(false);
  const mutation = useRef(null);
  const attempts = useRef(new Map());
  const nativeDraftId = useRef(null);
  const readRevision = useRef(0);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const scroll = useRef({ key: null, anchor: null, follow: true, explicitFollow: null, positions: new Map() });

  const cards = reading?.data.cards ?? EXPLORE_EMPTY_CARDS;
  const card = reading?.data.card?.id === selectedId ? reading.data.card : null;
  const { byId, children, roots } = useMemo(() => {
    const index = new Map(cards.map((item) => [item.id, item]));
    const subtrees = new Map();
    const top = [];
    for (const item of cards) {
      if (!index.has(item.parentId)) {
        top.push(item);
        continue;
      }
      if (!subtrees.has(item.parentId)) subtrees.set(item.parentId, []);
      subtrees.get(item.parentId).push(item);
    }
    return { byId: index, children: subtrees, roots: top };
  }, [cards]);
  const trail = exploreTrail(card, byId);
  const rootSource = (composer?.parentId ? exploreTrail(byId.get(composer.parentId), byId)[0] : trail[0])?.source;
  const lastTurn = card?.turns.at(-1);
  const draftKey = composer?.key ?? (card ? `ask:${card.id}` : null);
  const question = drafts.get(draftKey) ?? '';
  const bodyKey = composer ? `draft:${composer.key}` : card?.id ?? null;
  const refreshing = reading?.revision !== reload;
  const blocked = Boolean(pending) || refreshing;
  const preparingNative = Boolean(isPage && composer && renderNative);
  const readyToPrepare = preparingNative && !refreshing && !isPageClosing;

  function updateSelected(id) {
    currentId.current = id;
    setSelectedId(id);
  }

  function updateComposer(draft) {
    currentComposer.current = draft;
    setComposer(draft);
  }

  function refresh() {
    setReadError('');
    readRevision.current += 1;
    setReload(readRevision.current);
  }

  function selectCard(id, turnId = null) {
    updateComposer(null);
    setOperationError('');
    setConfirmRemove(null);
    setQuoteSelection(null);
    setMobileTreeOpen(false);
    setAnchor(turnId ? { cardId: id, turnId } : null);
    updateSelected(id);
    onBindCard?.(id);
    const parents = exploreTrail(byId.get(id), byId).slice(0, -1);
    if (parents.some((parent) => collapsed.has(parent.id))) {
      setCollapsed((previous) => {
        const next = new Set(previous);
        for (const parent of parents) next.delete(parent.id);
        return next;
      });
    }
  }

  function navigateTo(id) {
    if (!id) { onNavigate([]); return; }
    const trail = exploreTrail(byId.get(id), byId);
    if (trail.length) onNavigate(trail);
  }

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    if (!sessionId) return undefined;
    let listeners = exploreChangeListeners.get(sessionId);
    if (!listeners) exploreChangeListeners.set(sessionId, listeners = new Set());
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
      if (!listeners.size) exploreChangeListeners.delete(sessionId);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || isPage) return;
    try {
      window.localStorage.setItem(`dsh-btw-explore:view:${sessionId}`, JSON.stringify({
        selected: selectedId,
        collapsed: [...collapsed],
      }));
    } catch {
      // A disabled storage area does not prevent reading or creating cards.
    }
  }, [sessionId, selectedId, collapsed, isPage]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const controller = new AbortController();
    let timer;
    let hadRunningCards = false;
    const outdated = () => controller.signal.aborted || currentId.current !== selectedId || readRevision.current !== reload;

    async function load() {
      try {
        const data = await request(sessionId, { cardId: selectedId ?? undefined, signal: controller.signal });
        if (outdated()) return;
        setReading({ data, revision: reload, cardId: selectedId });
        onReadCards?.(data.cards);
        setReadError('');
        if (!isPage && !data.card && data.cards.length) {
          const mostRecent = data.cards.reduce((a, b) => a.updatedAt >= b.updatedAt ? a : b);
          updateSelected(mostRecent.id);
          return;
        }
        if (!isPage && !data.card && selectedId) {
          updateSelected(null);
          return;
        }
        hadRunningCards = isPage ? data.card?.status === 'running' || Boolean(data.card?.nativeSessionId)
          : data.cards.some((item) => item.status === 'running');
        if (hadRunningCards) timer = setTimeout(load, document.hidden ? 2500 : data.card?.nativeSessionId ? 1800 : 700);
      } catch {
        if (outdated()) return;
        setReadError('无法加载探索卡片。');
        if (hadRunningCards) timer = setTimeout(load, 2200);
      }
    }

    load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [sessionId, selectedId, reload, request, isPage, onReadCards]);

  useEffect(() => {
    if (composer?.key) inputRef.current?.focus({ preventScroll: true });
  }, [composer?.key]);

  useEffect(() => {
    if (readyToPrepare && !nativeDraftId.current) prepareNative();
  }, [readyToPrepare]);

  useEffect(() => {
    if (!card?.saved || composer) return undefined;
    const onSelection = () => {
      const selection = window.getSelection();
      const scope = bodyRef.current;
      const answerFor = (node) => {
        const element = node?.nodeType === 1 ? node : node?.parentElement;
        if (element?.closest('button, [contenteditable="true"], [inert], [aria-hidden="true"]')) return null;
        return element?.closest('[data-btw-answer]');
      };
      const start = answerFor(selection?.anchorNode);
      const end = answerFor(selection?.focusNode);
      const quote = selection?.toString().trim().slice(0, EXPLORE_QUOTE_LIMIT);
      let next = null;
      if (quote && selection.rangeCount === 1 && start && start === end && scope?.contains(start)) {
        const range = selection.getRangeAt(0);
        const rect = range.getClientRects?.()[0] ?? range.getBoundingClientRect?.();
        const answerRect = start.getBoundingClientRect();
        const scrollerRect = scope.getBoundingClientRect();
        next = { cardId: card.id, turnId: start.dataset.btwAnswer, quote,
          x: rect ? (rect.left + rect.right) / 2 - answerRect.left : 0,
          y: rect ? (rect.top - scrollerRect.top >= 38 ? rect.top - 38 : rect.bottom + 8) - answerRect.top : 0 };
      }
      setQuoteSelection((previous) => previous?.cardId === next?.cardId && previous?.turnId === next?.turnId
        && previous?.quote === next?.quote && previous?.x === next?.x && previous?.y === next?.y ? previous : next);
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, [card?.id, card?.saved, composer]);

  function rememberScroll() {
    const element = bodyRef.current;
    if (!element || !bodyKey || scroll.current.key !== bodyKey) return;
    scroll.current.follow = element.scrollHeight - element.clientHeight - element.scrollTop < 64;
    scroll.current.positions.set(bodyKey, element.scrollTop);
  }

  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (!element || !bodyKey) return;
    const state = scroll.current;
    const switched = state.key !== bodyKey;
    const scrollToTurn = anchor?.cardId === bodyKey && anchor !== state.anchor;
    state.key = bodyKey;
    if (scrollToTurn) {
      const turn = [...element.querySelectorAll('[data-btw-turn]')].find((item) => item.dataset.btwTurn === anchor.turnId);
      if (turn) {
        element.scrollTop += turn.getBoundingClientRect().top - element.getBoundingClientRect().top - 12;
        turn.focus({ preventScroll: true });
      }
      state.anchor = anchor;
    } else if (state.explicitFollow === bodyKey) {
      element.scrollTop = element.scrollHeight;
      state.explicitFollow = null;
    } else if (switched) {
      element.scrollTop = state.positions.get(bodyKey) ?? 0;
    } else if (state.follow && !composer && !isCoveredExploreReader(element)) {
      element.scrollTop = element.scrollHeight;
    }
    rememberScroll();
  }, [bodyKey, anchor, lastTurn?.id, lastTurn?.answer, lastTurn?.status]);

  async function mutate(action, body, onSuccess) {
    if (!sessionId || mutation.current || blocked) return;
    const token = {};
    mutation.current = token;
    setPending(action);
    setOperationError('');
    try {
      const result = await request(sessionId, { action, body });
      if (!active.current || mutation.current !== token) return;
      onSuccess?.(result);
    } catch (error) {
      if (!active.current || mutation.current !== token) return;
      setOperationError(typeof error?.message === 'string' && error.message.trim()
        ? error.message.slice(0, 240) : '操作没有完成，请重试。');
    } finally {
      if (mutation.current === token) {
        mutation.current = null;
        if (active.current) setPending('');
        // A dismissed page can still finish creating a card on the host.
        for (const update of exploreChangeListeners.get(sessionId) ?? []) update();
      }
    }
  }

  function writeDraft(value) {
    if (!draftKey) return;
    setDrafts((previous) => {
      const next = new Map(previous);
      if (value) next.set(draftKey, value.slice(0, EXPLORE_QUESTION_LIMIT));
      else next.delete(draftKey);
      return next;
    });
  }

  function startDraft(draft) {
    updateComposer(draft);
    setMobileTreeOpen(false);
    setConfirmRemove(null);
    setOperationError('');
    setQuoteSelection(null);
  }

  function startRoot(event) {
    const draft = exploreRootDraft(null);
    if (nativeCards) openExplorerPage(sessionId, draft, event.currentTarget);
    else startDraft(draft);
  }

  function prepareNative() {
    if (isPageClosing) return;
    const draft = currentComposer.current;
    const id = nativeDraftId.current ??= crypto.randomUUID();
    const body = draft ? { cardId: id, relation: draft.relation, source: draft.source,
      quote: draft.quote, parentId: draft.parentId, anchorTurnId: draft.anchorTurnId } : { cardId: selectedId };
    void mutate('open-native', body, (result) => selectCard(result.cardId));
  }

  function startFromTurn(relation, turn, turnNumber, opener, quote = '') {
    if (!card?.saved || turn.status !== 'done') return;
    openExplorerPage(sessionId, {
      key: `${relation}:${card.id}:${turn.id}`,
      relation,
      parentId: card.id,
      anchorTurnId: turn.id,
      anchorQuestion: turn.question,
      turnNumber,
      quote,
      preview: relation === 'child' && Boolean(quote),
    }, opener);
    window.getSelection()?.removeAllRanges();
  }

  function submit(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text || blocked || mutation.current) return;
    if (composer) {
      if (composer.parentId && !byId.get(composer.parentId)?.saved) {
        setOperationError('来源卡片已不可用，可以复制问题后新建一张探索卡片。');
        return;
      }
      const { relation, parentId, anchorTurnId, source, quote, preview } = composer;
      const body = { relation, question: text, preview };
      if (parentId) Object.assign(body, { parentId, anchorTurnId });
      if (source) body.source = source;
      if (quote) body.quote = quote;
      const attempt = reuseAttempt('create', body);
      const submittedComposer = composer;
      mutate('create', attempt, (result) => {
        attempts.current.delete(`create:${draftKey}`);
        writeDraft('');
        if (currentComposer.current !== submittedComposer) return;
        scroll.current.explicitFollow = result.cardId;
        selectCard(result.cardId);
        if (parentId) toggleNode(parentId, false);
      });
    } else if (card?.saved && lastTurn?.status === 'done') {
      const attempt = reuseAttempt('ask', { cardId: card.id, question: text });
      mutate('ask', attempt, () => {
        attempts.current.delete(`ask:${draftKey}`);
        writeDraft('');
        if (currentId.current === card.id) scroll.current.explicitFollow = card.id;
      });
    }
  }

  function reuseAttempt(action, body) {
    const key = `${action}:${draftKey}`;
    const signature = JSON.stringify(body);
    const previous = attempts.current.get(key);
    if (previous?.signature === signature) return previous.body;
    const next = { ...body, turnId: crypto.randomUUID() };
    if (action === 'create') next.cardId = crypto.randomUUID();
    attempts.current.set(key, { signature, body: next });
    return next;
  }

  function toggleNode(id, forceClosed) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (forceClosed ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function gotoChat() {
    const source = composer?.relation === 'root' ? { ...composer.source, quote: composer.quote } : rootSource;
    onChat(source && (source.messageId || source.turn != null || source.quote) ? {
      ...(source.turn == null ? {} : { turn: source.turn }),
      ...(source.messageId ? { messageId: source.messageId } : {}),
      ...(source.role ? { role: source.role } : {}),
      ...(source.quote ? { quote: source.quote } : {}),
    } : null);
  }

  function renderNodes(items, depth = 0) {
    return h('ul', { className: depth ? 'dsh-btw-children' : 'dsh-btw-roots' }, items.map((item) => {
      const descendants = children.get(item.id);
      const hasChildren = Boolean(descendants?.length);
      const open = !collapsed.has(item.id);
      const chosen = !composer && selectedId === item.id;
      const name = exploreTitle(item);
      return h('li', { key: item.id, className: 'dsh-btw-node' },
        h('div', { className: `dsh-btw-node-line${chosen ? ' is-current' : ''}` },
          hasChildren ? h('button', {
            type: 'button', className: `dsh-btw-fold${open ? ' is-open' : ''}`,
            'aria-label': `${open ? '折叠' : '展开'} ${name}`, 'aria-expanded': open,
            onClick: () => toggleNode(item.id),
          }) : h('span', { className: 'dsh-btw-fold-space' }),
          h('button', {
            type: 'button', className: 'dsh-btw-node-link', 'aria-current': chosen ? 'page' : undefined,
            onClick: (event) => {
              selectCard(item.id);
              if (item.nativeSessionId) openSavedExplorerPage(sessionId, item.id, event.currentTarget);
            },
            title: name,
          },
          h('span', { className: `dsh-btw-node-mark dsh-btw-mark-${item.relation}`, 'aria-hidden': true }),
          h('span', { className: 'dsh-btw-node-name' }, name),
          !item.saved && h('span', { className: 'dsh-btw-node-status' }, '预览'),
          item.status === 'running' && h('span', { className: 'dsh-btw-working-dot', role: 'img', 'aria-label': '正在生成' }),
          item.status in EXPLORE_TURN_ERRORS && h('span', { className: 'dsh-btw-incomplete-dot', role: 'img', 'aria-label': '尚未完成', title: '尚未完成' }),
          ),
        ),
        hasChildren && open && renderNodes(descendants, depth + 1),
      );
    }));
  }

  function sourceBlock(source, parentId, turnId, anchorQuestion, turnNumber) {
    const quote = source?.quote;
    const parent = byId.get(parentId);
    const mainAnchor = source?.role || source?.turn != null || source?.messageId;
    if (!quote && !parent && !mainAnchor) return null;
    const label = parent ? `来自 ${exploreTitle(parent)}${turnNumber ? ` · 第 ${turnNumber} 轮` : ''}`
      : source?.role === 'user' ? '来自主聊天的提问' : source?.role === 'assistant' ? '来自主聊天的回答' : '来自主聊天';
    const excerpt = quote || anchorQuestion;
    return h('div', { className: 'dsh-btw-source' },
      h('div', { className: 'dsh-btw-source-head' },
        h('div', { className: 'dsh-btw-source-origin', title: label },
          exploreChromeIcon('source'),
          h('span', { className: 'dsh-btw-source-label' }, label),
        ),
        parent && (isPage
          ? exploreChromeButton('返回来源', 'return', { onClick: () => onNavigate ? navigateTo(parent.id) : onClosePage() }, 'source-return')
          : exploreChromeButton('查看来源', 'return', { onClick: () => selectCard(parent.id, turnId) }, 'source-return')),
      ),
      !isPage && excerpt && h('blockquote', { className: 'dsh-btw-quoted' },
        excerpt.length <= 240 ? excerpt : h('details', null,
          h('summary', null, h('span', { className: 'dsh-btw-quote-preview' }, `${excerpt.slice(0, 160)}…`)),
          h('div', { className: 'dsh-btw-quoted-full' }, excerpt),
        )),
    );
  }

  function renderTurn(turn, index) {
    const running = turn.status === 'running';
    const selected = card.saved && turn.status === 'done' && quoteSelection?.cardId === card.id
      && quoteSelection.turnId === turn.id ? quoteSelection : null;
    return h('article', { className: 'dsh-btw-turn', key: turn.id, 'data-btw-turn': turn.id, tabIndex: -1 },
      h('h3', { className: 'dsh-btw-turn-label' }, `第 ${index + 1} 轮`),
      h('p', { className: 'dsh-btw-question' }, turn.question),
      turn.answer && h('div', { className: 'dsh-btw-answer', 'data-btw-answer': turn.id },
        Markdown ? h(Markdown, { text: turn.answer, labels: {}, streaming: running, variant: 'body' })
          : h('div', { className: 'dsh-btw-plain-answer' }, turn.answer),
        selected && h('div', { className: 'dsh-btw-answer-selection', 'aria-label': '选区操作', role: 'group',
          style: { '--btw-selection-x': `${selected.x}px`, top: selected.y } },
          [['child', '探索引用'], ['branch', '从此轮分支']].map(([relation, label]) => h('button', {
            key: relation, type: 'button', className: 'dsh-btw-selection-button', disabled: Boolean(pending), 'aria-haspopup': 'dialog',
            onPointerDown: (event) => event.preventDefault(),
            onClick: (event) => {
              const answer = event.currentTarget.closest('[data-btw-answer]');
              const range = window.getSelection();
              if (answer?.contains(range?.anchorNode) && answer.contains(range?.focusNode) && range.toString().trim().slice(0, EXPLORE_QUOTE_LIMIT) === selected.quote) {
                startFromTurn(relation, turn, index + 1, answer, selected.quote);
              }
              setQuoteSelection(null);
            },
          }, label)),
        ),
      ),
      (running || turn.status in EXPLORE_TURN_ERRORS) && h('div', { className: 'dsh-btw-turn-state' },
        h('span', { role: 'status' }, running ? '正在生成…' : (turn.error || EXPLORE_TURN_ERRORS[turn.status])),
        running ? exploreButton('停止生成', {
          disabled: blocked, onClick: () => mutate('stop', { cardId: card.id, turnId: turn.id }),
        }) : index === card.turns.length - 1 && exploreButton('重试本轮', {
          disabled: blocked, onClick: () => mutate('retry', { cardId: card.id, turnId: turn.id }, () => {
            if (currentId.current === card.id) scroll.current.explicitFollow = card.id;
          }),
        }),
      ),
    );
  }

  const promptAllowed = !preparingNative && !card?.nativeSessionId && Boolean(composer || (card?.saved && lastTurn?.status === 'done'));
  const title = composer ? '新建探索卡片' : card ? exploreTitle(card) : '探索';
  const source = composer ? { ...composer.source, quote: composer.quote } : card?.source;
  const sourceParentId = composer ? composer.parentId : card?.source?.cardId || card?.parentId;
  const sourceTurnId = composer ? composer.anchorTurnId : card?.source?.turnId || card?.anchorTurnId;
  const quoteHeading = isPage && source?.quote;
  const quoteChars = quoteHeading ? Array.from(quoteHeading.replace(/\s+/gu, ' ').trim()) : [];
  const expandQuote = quoteChars.length > 40 || quoteHeading && /[\r\n]/u.test(quoteHeading);
  const titleText = quoteChars.length > 40 ? `${quoteChars.slice(0, 40).join('')}…` : expandQuote ? quoteChars.join('') : quoteHeading;
  const quoteTitle = quoteHeading && h('h1', { id: pageTitleId, className: 'dsh-btw-quote-title' }, titleText);
  const removeAction = !composer && card?.saved && exploreChromeButton(card.nativeSessionId ? '移除' : '删除', 'remove', {
    disabled: blocked || card.status === 'running',
    'aria-label': card.nativeSessionId ? '从树中移除卡片和后代' : '删除卡片和后代',
    title: card.nativeSessionId ? '从树中移除' : '删除',
    onClick: () => setConfirmRemove(card.id),
  }, 'remove');
  const removal = { count: 0, running: card?.status === 'running', hasNativeSession: Boolean(card?.nativeSessionId) };
  if (card && confirmRemove === card.id) {
    const unchecked = [...(children.get(card.id) ?? [])];
    const checked = new Set([card.id]);
    while (unchecked.length) {
      const descendant = unchecked.pop();
      if (checked.has(descendant.id)) continue;
      checked.add(descendant.id);
      removal.count += 1;
      removal.running ||= descendant.status === 'running';
      removal.hasNativeSession ||= Boolean(descendant.nativeSessionId);
      unchecked.push(...(children.get(descendant.id) ?? []));
    }
  }

  function removeSelected() {
    mutate('remove', { cardId: card.id }, () => {
      if (currentId.current !== card.id) return;
      if (onClosePage) onClosePage();
      else if (!currentComposer.current) selectCard(card.parentId);
      else updateSelected(card.parentId);
    });
  }

  return h('div', { className: isPage ? 'dsh-btw-explore dsh-btw-explore-page' : 'dsh-btw-explore' },
    h('div', { className: 'dsh-btw-layout' },
      !isPage && h('aside', { className: `dsh-btw-sidebar${mobileTreeOpen ? ' is-mobile-open' : ''}` },
        h('div', { className: 'dsh-btw-side-head' },
          h('h2', { className: 'dsh-btw-side-title' }, '卡片树'),
          h('button', {
            type: 'button', className: 'dsh-btw-mobile-tree-button', 'aria-expanded': mobileTreeOpen,
            onClick: () => setMobileTreeOpen((value) => !value),
          }, '卡片树', h('span', { className: `dsh-btw-chevron${mobileTreeOpen ? ' is-open' : ''}`, 'aria-hidden': true })),
          h('span', { className: 'dsh-btw-card-count', 'aria-label': `${cards.length} 张卡片` }, cards.length),
          exploreButton('新建', { 'aria-label': '新建探索卡片', disabled: !sessionId, onClick: startRoot }, 'quiet'),
        ),
        h('nav', { className: 'dsh-btw-tree', 'aria-label': '探索卡片树' },
          roots.length ? renderNodes(roots) : h('p', { className: 'dsh-btw-tree-empty' },
            readError ? '卡片树未加载' : reading ? '这里还没有卡片' : '正在加载…'),
        ),
      ),
      h('section', { className: 'dsh-btw-main', 'aria-label': '探索对话' },
        h('header', { className: 'dsh-btw-head' },
          h('div', { className: 'dsh-btw-head-path' },
            h('nav', { className: 'dsh-btw-crumbs', 'aria-label': '卡片路径' },
              h('span', { className: 'dsh-btw-crumb-origin' }, exploreChromeIcon('explore'),
                h('span', null, returnLabel === '返回主聊天' ? '主聊天 / 探索' : '探索')),
              (composer ? exploreTrail(byId.get(composer.parentId), byId) : trail.slice(0, -1)).map((parent) =>
                h('span', { className: 'dsh-btw-crumb', key: parent.id },
                  h('span', { className: 'dsh-btw-crumb-divider', 'aria-hidden': true }),
                  isPage ? h('span', { title: exploreTitle(parent) }, exploreTitle(parent))
                    : exploreButton(exploreTitle(parent), { onClick: () => selectCard(parent.id), title: exploreTitle(parent) }, 'quiet'),
                )),
            ),
            isPage ? h('div', { className: 'dsh-btw-head-actions' },
              exploreChromeButton(returnLabel, 'back', { onClick: onClosePage, title: 'Esc' }, 'return'),
              removeAction)
              : onChat && exploreChromeButton('回到主聊天', 'back', { onClick: gotoChat }, 'return'),
          ),
          h('div', { className: 'dsh-btw-head-title' },
            quoteTitle ? expandQuote ? h('details', { className: 'dsh-btw-quote-details' },
              h('summary', { title: '查看完整引用' }, quoteTitle),
              h('blockquote', { className: 'dsh-btw-quoted-full' }, quoteHeading)) : quoteTitle
              : h('h2', { id: pageTitleId, title }, title),
            !isPage && removeAction,
          ),
          isPage && sourceBlock(source, sourceParentId, sourceTurnId, null, composer?.turnNumber),
        ),
        readError && h('div', { className: 'dsh-btw-banner dsh-btw-error', role: 'alert' },
          h('span', null, readError), exploreButton('重新加载', { onClick: refresh })),
        operationError && h('div', { className: 'dsh-btw-banner dsh-btw-error', role: 'alert' }, operationError),
        !composer && card && confirmRemove === card.id && h('div', { className: 'dsh-btw-banner' },
          h('span', { role: 'status' }, removal.running ? '请先停止这一支中正在生成的回答。'
            : `${removal.count ? `从树中移除这张卡及其 ${removal.count} 张后代？` : '从树中移除这张卡片？'}${
              removal.hasNativeSession ? ' 对话记录仍可在 DSH 会话列表中查看。' : ''}`),
          h('div', { className: 'dsh-btw-inline-actions' },
            exploreButton('取消', { onClick: () => setConfirmRemove(null) }, 'quiet'),
            exploreButton('确认删除', { onClick: removeSelected, disabled: blocked || removal.running }, 'danger'),
          )),
        !composer && card && !card.saved && h('div', { className: 'dsh-btw-banner dsh-btw-preview' },
          h('span', null, card.turns[0]?.status === 'done' ? '保存后可继续提问，也可以创建子卡。' : '预览 · 首轮回答完成后可保存。'),
          h('div', { className: 'dsh-btw-inline-actions' },
            confirmRemove !== card.id && exploreButton('丢弃', {
              disabled: blocked || card.status === 'running', onClick: () => setConfirmRemove(card.id),
            }, 'quiet'),
            exploreButton('保存卡片', { disabled: blocked || card.turns[0]?.status !== 'done', onClick: () => mutate('save', { cardId: card.id }) }, 'primary'),
          )),
        card?.nativeSessionId && isPage && renderNative ? h(React.Fragment, null,
          card.nativeReady ? renderNative(card, sessionId)
            : h('div', { className: 'dsh-btw-banner' }, '对话尚未打开，请重试。',
              exploreButton('打开对话', { disabled: blocked, onClick: prepareNative })),
        ) : h('div', { className: 'dsh-btw-scroller', ref: bodyRef, onScroll: rememberScroll },
          h('div', { className: 'dsh-btw-read-column' },
            composer ? h(React.Fragment, null,
              !isPage && sourceBlock(source, sourceParentId, sourceTurnId, composer.anchorQuestion, composer.turnNumber),
              preparingNative ? operationError
                ? exploreButton('重试打开', { disabled: blocked, onClick: prepareNative })
                : h('p', { className: 'dsh-btw-start-copy', role: 'status' }, '正在打开对话…')
                : h('p', { className: 'dsh-btw-start-copy' }, composer.relation === 'branch'
                ? '从选定轮次接着问，后续问答会记录在这条分支。'
                : composer.relation === 'child' ? '围绕选定的回答提一个新问题。'
                  : composer.quote ? '可以围绕引用追问细节、例子或相关概念。' : '提出一个想在探索里单独讨论的问题。'),
            ) : card ? h(React.Fragment, null,
              !isPage && sourceBlock(source, sourceParentId, sourceTurnId),
              card.nativeSessionId && exploreButton('打开对话', { onClick: (event) => openSavedExplorerPage(sessionId, card.id, event.currentTarget) }, 'primary'),
              card.turns.map(renderTurn),
            ) : h('div', { className: 'dsh-btw-empty' },
              isPage && selectedId && reading?.cardId === selectedId && !readError ? h('p', { role: 'status' }, '这张卡片已移除。')
                : !sessionId ? h('p', null, '打开一个聊天后即可开始探索。')
                : !readError && (!reading || selectedId) ? h('p', { role: 'status' }, '正在加载卡片…')
                  : !readError && h(React.Fragment, null, h('h3', null, '还没有探索卡片'),
                    h('p', null, '在主聊天选中文字，或在这里提一个新问题。'),
                    exploreButton('新建探索卡片', { onClick: startRoot }, 'primary'),
                  ),
            ),
          ),
        ),
        promptAllowed && h('div', { className: 'dsh-btw-compose-wrap' },
          h('form', { className: 'dsh-btw-compose', onSubmit: submit },
            h('textarea', {
              ref: inputRef, rows: 2, maxLength: EXPLORE_QUESTION_LIMIT, value: question,
              disabled: pending === 'create' || pending === 'ask',
              'aria-label': composer ? '探索问题' : '继续提问',
              placeholder: composer ? '输入你的问题…' : '在这张卡片里继续提问…',
              onChange: (event) => writeDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) submit(event);
              },
            }),
            h('div', { className: 'dsh-btw-compose-actions' },
              composer ? h('label', { className: 'dsh-btw-preview-toggle' },
                h('input', {
                  type: 'checkbox', checked: composer.preview, disabled: pending === 'create',
                  onChange: (event) => updateComposer({ ...composer, preview: event.target.checked }),
                }), '先预览',
              ) : h('span', { className: 'dsh-btw-shortcut' }, 'Ctrl / ⌘ + Enter'),
              h('div', { className: 'dsh-btw-inline-actions' },
                composer && exploreButton('取消', { disabled: pending === 'create', onClick: () => {
                  if (onClosePage) onClosePage();
                  else {
                    updateComposer(null);
                    setOperationError('');
                  }
                } }, 'quiet'),
                exploreButton(pending === 'create' || pending === 'ask' ? '正在提交…'
                  : composer ? composer.preview ? '生成预览' : '创建卡片' : '继续提问', {
                  type: 'submit', disabled: blocked || !question.trim() || !sessionId,
                }, 'primary'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

    const EXPLORE_NODE_STEP = 38;
const EXPLORE_LAYER_STEP = 72;
const EXPLORE_MAP_PADDING = 24;
const EXPLORE_MAP_X_MARGIN = 18 + 10; // Node hit radius plus the horizontal fade.
const EXPLORE_MAP_Y_MARGIN = 18 + 20;

function exploreNodeLayout(cards) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const home = { card: null, depth: 0, parent: null };
  const nodes = [home, ...[...byId.values()].map((card) => ({ card, parent: null, depth: 0 }))];
  const nodeById = new Map(nodes.slice(1).map((node) => [node.card.id, node]));
  const resolved = new Set();
  const visiting = new Set();
  function resolve(node) {
    if (resolved.has(node)) return node;
    if (visiting.has(node)) return home;
    visiting.add(node);
    const source = nodeById.get(node.card.parentId);
    node.parent = source ? resolve(source) : home;
    node.depth = node.parent.depth + (node.card.relation === 'branch' && node.parent.card ? 0 : 1);
    visiting.delete(node);
    resolved.add(node);
    return node;
  }
  for (const node of nodes.slice(1)) resolve(node);

  const rows = new Map();
  const branches = new Map();
  for (const node of nodes) {
    if (!rows.has(node.depth)) rows.set(node.depth, []);
    if (node.parent?.depth === node.depth) {
      if (!branches.has(node.parent)) branches.set(node.parent, []);
      branches.get(node.parent).push(node);
    }
  }
  function append(node) {
    for (const branch of branches.get(node) ?? []) append(branch);
    rows.get(node.depth).push(node);
  }
  const depth = Math.max(...rows.keys());
  for (let level = 0; level <= depth; level += 1) {
    const parentOrder = new Map((rows.get(level - 1) ?? []).map((node, index) => [node, index]));
    const starts = nodes.filter((node) => node.depth === level && node.parent?.depth !== level);
    starts.sort((a, b) => (parentOrder.get(a.parent) ?? 0) - (parentOrder.get(b.parent) ?? 0));
    for (const node of starts) append(node);
  }
  const width = EXPLORE_MAP_PADDING * 2 + (Math.max(...[...rows.values()].map((row) => row.length)) - 1) * EXPLORE_NODE_STEP;
  const height = EXPLORE_MAP_PADDING * 2 + depth * EXPLORE_LAYER_STEP;
  for (const [level, row] of rows) {
    row.forEach((node, index) => {
      node.x = (width - (row.length - 1) * EXPLORE_NODE_STEP) / 2 + index * EXPLORE_NODE_STEP;
      node.y = EXPLORE_MAP_PADDING + level * EXPLORE_LAYER_STEP;
    });
  }
  const fitWidth = width + 2 * (EXPLORE_MAP_X_MARGIN - EXPLORE_MAP_PADDING);
  return { nodes, byId, width, height, fitWidth };
}

function exploreEdge(node) {
  const source = node.parent;
  const radius = source.card ? 12 : 14;
  if (node.depth !== source.depth) {
    const fromY = source.y + radius;
    const toY = node.y - 12;
    const middle = (fromY + toY) / 2;
    return `M ${source.x} ${fromY} C ${source.x} ${middle} ${node.x} ${middle} ${node.x} ${toY}`;
  }
  const direction = Math.sign(node.x - source.x);
  const fromX = source.x + direction * radius;
  const toX = node.x - direction * 12;
  const distance = Math.abs(node.x - source.x);
  if (distance > EXPLORE_NODE_STEP) {
    const fromY = source.y - radius;
    const toY = node.y - 12;
    const lane = source.y - 28;
    const shoulder = direction * 24;
    return `M ${source.x} ${fromY} C ${source.x} ${lane} ${source.x + shoulder / 2} ${lane} ${source.x + shoulder} ${lane}`
      + ` C ${source.x + shoulder} ${lane} ${node.x - shoulder} ${lane} ${node.x - shoulder} ${lane}`
      + ` C ${node.x - shoulder / 2} ${lane} ${node.x} ${lane} ${node.x} ${toY}`;
  }
  return `M ${fromX} ${source.y} C ${fromX + direction * 6} ${source.y} ${toX - direction * 6} ${node.y} ${toX} ${node.y}`;
}

function ExploreNavigation({ graph, activeId, onNavigate, returnLabel }) {
  const { nodes, byId, width, height, fitWidth } = graph;
  const hasCards = nodes.length > 1;
  const map = React.useRef(null);
  const viewport = React.useRef(null);
  const stage = React.useRef(null);
  const buttons = React.useRef(new Map());
  const layout = React.useRef(null);
  const drag = React.useRef(null);
  const suppressClick = React.useRef(false);
  const updateViewport = React.useRef(null);
  const [hovered, setHovered] = React.useState(null);
  const [focused, setFocused] = React.useState(null);
  const [tabKey, setTabKey] = React.useState(null);
  const [dragging, setDragging] = React.useState(false);
  const [view, setView] = React.useState({ left: 0, top: 0, width: 0, height: 0, padX: 0, padY: 0 });
  const hintId = React.useId();
  const keyFor = (node) => node.card?.id ?? 'home';
  const currentNode = activeId === null ? nodes[0] : nodes.find((node) => node.card && node.card.id === activeId);
  const rovingKey = nodes.some((node) => keyFor(node) === tabKey) ? tabKey : keyFor(currentNode ?? nodes[0]);

  React.useEffect(() => {
    const element = map.current;
    if (!element) return;
    const reach = 24;
    // Observe proximity without enlarging the map's hit area over the backdrop.
    function update(event) {
      const { left, top, right, bottom } = element.getBoundingClientRect();
      element.toggleAttribute('data-btw-near', event.pointerType === 'mouse'
        && event.clientX >= left - reach && event.clientX <= right + reach
        && event.clientY >= top - reach && event.clientY <= bottom + reach);
    }
    const clear = () => element.removeAttribute('data-btw-near');
    window.addEventListener('pointermove', update, { passive: true });
    document.documentElement.addEventListener('pointerleave', clear);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('pointermove', update);
      document.documentElement.removeEventListener('pointerleave', clear);
      window.removeEventListener('blur', clear);
      clear();
    };
  }, [hasCards]);

  function readScroll() {
    const area = viewport.current;
    if (!area) return;
    const metrics = layout.current?.metrics ?? view;
    const next = { ...metrics, left: area.scrollLeft, top: area.scrollTop };
    if (layout.current) layout.current.metrics = next;
    setView((previous) => Object.keys(next).every((key) => next[key] === previous[key]) ? previous : next);
  }

  function scrollTo(left, top, metrics = layout.current?.metrics) {
    const area = viewport.current;
    if (!area || !metrics) return;
    area.scrollLeft = Math.max(0, Math.min(left, layout.current.width + metrics.padX * 2 - metrics.width));
    area.scrollTop = Math.max(0, Math.min(top, layout.current.height + metrics.padY * 2 - metrics.height));
    readScroll();
  }

  function bringIntoView(node, center = false) {
    const area = viewport.current;
    const metrics = layout.current?.metrics;
    if (!area || !metrics) return;
    const x = node.x + metrics.padX;
    const y = node.y + metrics.padY;
    const moveX = !metrics.fitsX && (center || x - EXPLORE_MAP_X_MARGIN < area.scrollLeft
      || x + EXPLORE_MAP_X_MARGIN > area.scrollLeft + metrics.width);
    const moveY = !metrics.fitsY && (center || y - EXPLORE_MAP_Y_MARGIN < area.scrollTop
      || y + EXPLORE_MAP_Y_MARGIN > area.scrollTop + metrics.height);
    if (moveX || moveY) scrollTo(moveX ? x - metrics.width / 2 : area.scrollLeft,
      moveY ? y - metrics.height / 2 : area.scrollTop);
  }

  function finishDrag(event) {
    const state = drag.current;
    if (!state || (event?.pointerId !== undefined && event.pointerId !== state.id)) return;
    drag.current = null;
    setDragging(false);
    if (state.moved) suppressClick.current = true;
    if (state.capture.hasPointerCapture?.(state.id)) state.capture.releasePointerCapture(state.id);
  }

  updateViewport.current = (forceCenter = false) => {
    const area = viewport.current;
    const surface = stage.current;
    if (!area || !surface) { layout.current = null; return; }
    const previous = layout.current;
    const fitsX = area.clientWidth >= fitWidth;
    const fitsY = area.clientHeight >= height + 2 * (EXPLORE_MAP_Y_MARGIN - EXPLORE_MAP_PADDING);
    const metrics = { width: area.clientWidth, height: area.clientHeight, fitsX, fitsY,
      padX: fitsX ? (area.clientWidth - width) / 2 : Math.max(0, area.clientWidth / 2 - EXPLORE_MAP_PADDING),
      padY: fitsY ? (area.clientHeight - height) / 2 : Math.max(0, area.clientHeight / 2 - EXPLORE_MAP_PADDING),
      left: area.scrollLeft, top: area.scrollTop };
    surface.style.paddingLeft = surface.style.paddingRight = `${metrics.padX}px`;
    surface.style.paddingTop = surface.style.paddingBottom = `${metrics.padY}px`;
    const resized = previous && (metrics.width !== previous.metrics.width || metrics.height !== previous.metrics.height);
    const dataChanged = previous && previous.nodes !== nodes;
    const switched = previous && previous.activeId !== activeId;
    const appeared = currentNode && !previous?.currentNode;
    layout.current = { nodes, currentNode, activeId, metrics, width, height };
    if (!previous || switched || (resized && !dataChanged) || forceCenter || appeared) {
      finishDrag();
      const target = currentNode ?? (!previous ? nodes[0] : null);
      if (target) bringIntoView(target, true);
      if (switched && !area.contains(document.activeElement)) setTabKey(keyFor(currentNode ?? nodes[0]));
    } else if (dataChanged) {
      const focusKey = area.contains(document.activeElement) ? document.activeElement.dataset.btwNodeKey : null;
      const surviving = new Map(nodes.map((node) => [keyFor(node), node]));
      const visible = previous.nodes.filter((node) => {
        const x = node.x + previous.metrics.padX - previous.metrics.left;
        const y = node.y + previous.metrics.padY - previous.metrics.top;
        return surviving.has(keyFor(node)) && x + 18 > 0 && x - 18 < previous.metrics.width
          && y + 18 > 0 && y - 18 < previous.metrics.height;
      });
      const distanceFromCenter = (node) => Math.hypot(
        node.x + previous.metrics.padX - previous.metrics.left - previous.metrics.width / 2,
        node.y + previous.metrics.padY - previous.metrics.top - previous.metrics.height / 2);
      const fullyVisible = (node) => {
        const x = node.x + previous.metrics.padX - previous.metrics.left;
        const y = node.y + previous.metrics.padY - previous.metrics.top;
        return x >= 18 && x <= previous.metrics.width - 18 && y >= 18 && y <= previous.metrics.height - 18;
      };
      const oldAnchor = visible.find((node) => keyFor(node) === focusKey)
        ?? visible.find((node) => node === previous.currentNode)
        ?? visible.sort((a, b) => Number(fullyVisible(b)) - Number(fullyVisible(a)) || distanceFromCenter(a) - distanceFromCenter(b))[0]
        ?? previous.nodes.filter((node) => surviving.has(keyFor(node))).sort((a, b) => distanceFromCenter(a) - distanceFromCenter(b))[0];
      const newAnchor = oldAnchor && surviving.get(keyFor(oldAnchor));
      const paddingX = metrics.padX - previous.metrics.padX;
      const paddingY = metrics.padY - previous.metrics.padY;
      if (newAnchor && (newAnchor.x !== oldAnchor.x || newAnchor.y !== oldAnchor.y || paddingX || paddingY)) {
        finishDrag();
        scrollTo(previous.metrics.left + newAnchor.x - oldAnchor.x + paddingX,
          previous.metrics.top + newAnchor.y - oldAnchor.y + paddingY, metrics);
      }
    }
    if (fitsX && area.scrollLeft !== 0) area.scrollLeft = 0;
    if (fitsY && area.scrollTop !== 0) area.scrollTop = 0;
    readScroll();
    if (focused && !nodes.some((node) => keyFor(node) === focused) && document.activeElement === document.body) {
      let target = previous?.nodes.find((node) => keyFor(node) === focused)?.parent;
      while (target && !nodes.some((node) => keyFor(node) === keyFor(target))) target = target.parent;
      buttons.current.get(keyFor(target ?? currentNode ?? nodes[0]))?.focus({ preventScroll: true });
    }
  };

  React.useLayoutEffect(() => { updateViewport.current(); }, [nodes, activeId]);
  React.useLayoutEffect(() => {
    const area = viewport.current;
    if (!area) return;
    const resize = () => updateViewport.current(true);
    const observer = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(() => updateViewport.current()) : null;
    observer?.observe(area);
    const wheel = (event) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? area.clientHeight : 1;
      const x = event.shiftKey ? event.deltaX || event.deltaY : event.deltaX;
      const y = event.shiftKey ? 0 : event.deltaY;
      scrollTo(area.scrollLeft + x * scale, area.scrollTop + y * scale);
    };
    // React wheel listeners are passive; handle native scrolling once so Shift
    // and vertical wheels share the same two-axis viewport without a double move.
    area.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('resize', resize);
    window.addEventListener('blur', finishDrag);
    return () => {
      observer?.disconnect();
      area.removeEventListener('wheel', wheel);
      window.removeEventListener('resize', resize);
      window.removeEventListener('blur', finishDrag);
      finishDrag();
    };
  }, [hasCards]);
  if (!hasCards) return null;
  const activePath = new Set();
  for (let node = currentNode; node && !activePath.has(node); node = node.parent) activePath.add(node);
  const connected = nodes.filter((node) => node.parent);
  const hintNode = nodes.find((node) => keyFor(node) === (hovered ?? focused));
  const hintX = hintNode ? hintNode.x + view.padX - view.left : 0;
  const hintY = hintNode ? hintNode.y + view.padY - view.top : 0;
  const hintVisible = !dragging && hintNode && hintX >= 0 && hintX <= view.width && hintY >= 0 && hintY <= view.height;

  function moveFocus(event, node) {
    let target;
    if (event.key === 'Home') target = nodes[0];
    else if (event.key === 'End') target = [...nodes].sort((a, b) => b.depth - a.depth || b.x - a.x)[0];
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const row = nodes.filter((item) => item.depth === node.depth).sort((a, b) => a.x - b.x);
      target = row[row.indexOf(node) + (event.key === 'ArrowLeft' ? -1 : 1)] ?? node;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (event.key === 'ArrowUp') {
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (parent.depth < node.depth) { target = parent; break; }
        }
      }
      const candidates = event.key === 'ArrowDown'
        ? nodes.filter((item) => item.parent === node && item.depth > node.depth) : [];
      const nearby = candidates.length ? candidates : nodes.filter((item) => event.key === 'ArrowDown' ? item.depth > node.depth : item.depth < node.depth);
      target ??= nearby.sort((a, b) => Math.abs(a.depth - node.depth) - Math.abs(b.depth - node.depth)
        || Math.abs(a.x - node.x) - Math.abs(b.x - node.x) || a.x - b.x)[0] ?? node;
    } else return;
    event.preventDefault();
    setHovered(null);
    setTabKey(keyFor(target));
    buttons.current.get(keyFor(target))?.focus({ preventScroll: true });
    bringIntoView(target);
  }

  return h('nav', { ref: map, className: 'dsh-btw-map', 'aria-label': '探索卡片关系导航',
    style: { '--btw-map-content-height': `${height + 48}px` } },
    h('div', { className: 'dsh-btw-map-viewport', ref: viewport, 'data-btw-dragging': dragging || undefined,
      onScroll: readScroll,
      onPointerDown: (event) => {
        if (drag.current || event.isPrimary === false || event.button !== 0) return;
        suppressClick.current = false;
        const capture = event.target.closest('.dsh-btw-map-node') ?? event.currentTarget;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
          left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop, moved: false, capture };
        capture.setPointerCapture?.(event.pointerId);
      },
      onPointerMove: (event) => {
        const state = drag.current;
        if (!state || state.id !== event.pointerId) return;
        const dx = event.clientX - state.x;
        const dy = event.clientY - state.y;
        if (!state.moved && Math.hypot(dx, dy) < 5) return;
        state.moved = true;
        event.preventDefault();
        setDragging(true);
        setHovered(null);
        scrollTo(state.left - dx, state.top - dy);
      },
      onPointerUp: finishDrag, onPointerCancel: finishDrag, onLostPointerCapture: finishDrag,
      onClickCapture: (event) => {
        if (!suppressClick.current || event.detail === 0) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      } },
      h('div', { className: 'dsh-btw-map-stage', ref: stage, style: { width } },
        h('div', { className: 'dsh-btw-map-graph', style: { width, height } },
          h('svg', { className: 'dsh-btw-map-lines', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': true },
            connected.map((node) => h('path', { key: node.card.id, d: exploreEdge(node),
              'data-btw-node-key': keyFor(node), 'data-btw-on-path': activePath.has(node) || undefined })),
          ),
          currentNode && h('span', { className: 'dsh-btw-map-current', 'aria-hidden': true,
            style: { transform: `translate(${currentNode.x}px, ${currentNode.y}px)` } }),
          nodes.map((node) => {
            const name = node.card ? exploreTitle(node.card) : returnLabel;
            const key = keyFor(node);
            return h('button', { key, type: 'button', className: 'dsh-btw-map-node', tabIndex: key === rovingKey ? 0 : -1,
              ref: (button) => { if (button) buttons.current.set(key, button); else buttons.current.delete(key); },
              style: { left: node.x, top: node.y }, 'aria-label': `卡片节点 · ${name}`,
              'aria-describedby': hintVisible && hintNode === node ? hintId : undefined,
              'aria-current': node === currentNode ? 'page' : undefined,
              'data-btw-node-key': key, 'data-btw-depth': node.depth,
              'data-btw-relation': node.card?.relation ?? 'home', 'data-btw-on-path': activePath.has(node) || undefined,
              onPointerEnter: (event) => { if (event.pointerType !== 'touch' && !drag.current?.moved) setHovered(key); },
              onPointerLeave: () => setHovered(null),
              onFocus: () => { setHovered(null); setFocused(key); setTabKey(key); if (!drag.current) bringIntoView(node); },
              onBlur: () => setFocused(null),
              onKeyDown: (event) => moveFocus(event, node),
              onClick: (event) => {
                event.currentTarget.focus({ preventScroll: true });
                onNavigate(exploreTrail(node.card, byId));
              },
            }, h('span', { className: 'dsh-btw-map-halo', 'aria-hidden': true }),
            h('span', { className: 'dsh-btw-map-dot', 'aria-hidden': true }));
          }),
        ),
      ),
    ),
    hintVisible && h('div', { id: hintId, role: 'tooltip', className: 'dsh-btw-map-hint', style: { '--btw-map-hint-y': `${hintY}px` } },
      h('span', { className: 'dsh-btw-map-hint-title' }, hintNode.card ? exploreTitle(hintNode.card) : returnLabel),
    ),
  );
}

    function installExplorerDeckDrag(overlay) {
  const foreground = '.dsh-btw-page[data-btw-top]';
  const interactive = '[data-chat-flow-kind], [data-btw-turn], [data-composer-seat], [data-composer-card], '
    + 'a, button, input, select, textarea, label, details, [contenteditable], [draggable="true"], '
    + '[role="button"], [role="checkbox"], [role="menu"], [role="listbox"], [role="slider"], [role="tab"]';
  const padding = 8;
  let x = 0;
  let y = 0;
  let gesture;

  function move(frame, nextX, nextY) {
    const box = frame.getBoundingClientRect();
    const viewport = overlay.getBoundingClientRect();
    if (!box.width || !box.height || !viewport.width || !viewport.height) return;
    const rail = overlay.querySelector('.dsh-btw-map')?.getBoundingClientRect();
    const left = Math.max(viewport.left, rail?.right ?? viewport.left) + padding;
    const dxMin = left - (box.left - x);
    const dxMax = viewport.right - padding - (box.right - x);
    const dyMin = viewport.top + padding - (box.top - y);
    const dyMax = viewport.bottom - padding - (box.bottom - y);
    // At very small sizes the layout itself fits more tightly than this margin.
    const clamp = (value, min, max) => min > max ? 0 : Math.max(min, Math.min(value, max));
    const clampedX = clamp(nextX, dxMin, dxMax);
    const clampedY = clamp(nextY, dyMin, dyMax);
    if (clampedX !== x) overlay.style.setProperty('--btw-drag-x', `${clampedX}px`);
    if (clampedY !== y) overlay.style.setProperty('--btw-drag-y', `${clampedY}px`);
    x = clampedX;
    y = clampedY;
  }

  function end(event) {
    if (!gesture || (event && event.pointerId !== gesture.id)) return;
    const { id } = gesture;
    gesture = undefined;
    overlay.removeAttribute('data-btw-dragging');
    if (overlay.hasPointerCapture?.(id)) overlay.releasePointerCapture(id);
  }

  function begin(event) {
    if (gesture || event.defaultPrevented || event.button !== 0 || event.isPrimary === false) return;
    const target = event.target;
    const frame = target.closest?.(foreground);
    if (!frame || frame.hasAttribute('data-btw-motion') || target.closest(interactive)) return;
    try { overlay.setPointerCapture(event.pointerId); } catch { return; }
    event.preventDefault();
    gesture = { frame, id: event.pointerId, x, y, startX: event.clientX, startY: event.clientY };
    overlay.setAttribute('data-btw-dragging', '');
  }

  function update(event) {
    if (event.pointerId !== gesture?.id) return;
    if (overlay.querySelector(foreground) !== gesture.frame || gesture.frame.hasAttribute('data-btw-motion')) {
      end();
      return;
    }
    move(gesture.frame, gesture.x + event.clientX - gesture.startX, gesture.y + event.clientY - gesture.startY);
  }

  function reconcile() {
    const frame = overlay.querySelector(foreground);
    if (gesture && (frame !== gesture.frame || frame?.hasAttribute('data-btw-motion'))) end();
    if (frame && !frame.hasAttribute('data-btw-motion-surface') && (x || y)) move(frame, x, y);
  }

  const onResize = () => { end(); reconcile(); };
  const onBlur = () => end();
  const events = { pointerdown: begin, pointermove: update, pointerup: end, pointercancel: end, lostpointercapture: end };
  for (const [name, callback] of Object.entries(events)) overlay.addEventListener(name, callback);
  window.addEventListener('resize', onResize);
  window.addEventListener('blur', onBlur);
  return { reconcile, dispose() {
    end();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('blur', onBlur);
    for (const [name, callback] of Object.entries(events)) overlay.removeEventListener(name, callback);
    overlay.style.removeProperty('--btw-drag-x');
    overlay.style.removeProperty('--btw-drag-y');
  } };
}

function useExplorerDeckLayout(overlay, owner, visible) {
  const drag = React.useRef(null);
  React.useLayoutEffect(() => {
    const layer = overlay.current;
    if (!visible || !layer) return;
    // The portal covers the entire window, but its header owner sits in the conversation column.
    const header = owner?.current?.closest('header');
    function measure() {
      if (!header) return;
      const bounds = header.getBoundingClientRect();
      const viewport = layer.getBoundingClientRect();
      if (!bounds.width || !viewport.width) return;
      layer.style.setProperty('--btw-chat-left', `${Math.max(0, bounds.left - viewport.left)}px`);
      layer.style.setProperty('--btw-chat-right', `${Math.max(0, viewport.right - bounds.right)}px`);
      drag.current?.reconcile();
    }
    measure();
    drag.current = installExplorerDeckDrag(layer);
    const observer = header && window.ResizeObserver ? new window.ResizeObserver(measure) : null;
    observer?.observe(header);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      drag.current.dispose();
      drag.current = null;
    };
  }, [overlay, owner, visible]);
  React.useLayoutEffect(() => { drag.current?.reconcile(); });
}

    const explorerPageHosts = new Map();

function explorerPageOrigin(opener) {
  const source = opener?.closest('[data-btw-turn], [data-chat-flow-kind]');
  const scroller = opener?.closest('.dsh-btw-scroller, [data-conversation-scroll]');
  const selection = document.getSelection();
  let rect;
  if (selection && !selection.isCollapsed && selection.rangeCount === 1) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    if ((source ?? opener)?.contains(container)) rect = range.getBoundingClientRect?.();
  }
  rect ??= opener?.getBoundingClientRect?.();
  const motionSource = rect && [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
    && (rect.width > 0 || rect.height > 0)
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
  return { source, scroller, scrollTop: scroller?.scrollTop, motionSource };
}

function openExplorerPage(sessionId, draft, opener, origin = 'card') {
  const open = explorerPageHosts.get(sessionId);
  if (!open) return;
  open({ key: crypto.randomUUID(), draft, opener, origin, ...explorerPageOrigin(opener) });
}

function openSavedExplorerPage(sessionId, cardId, opener) {
  explorerPageHosts.get(sessionId)?.({ key: crypto.randomUUID(), cardId, opener, origin: 'card', ...explorerPageOrigin(opener) });
}

function restoreExplorerFocus(element) {
  if (!element?.isConnected) return false;
  // A selection action disappears after it is clicked, so return focus to the message.
  const needsTabIndex = element.tabIndex < 0 && !element.hasAttribute('tabindex');
  if (needsTabIndex) element.setAttribute('tabindex', '-1');
  element.focus({ preventScroll: true });
  const focused = document.activeElement === element;
  if (needsTabIndex) {
    const release = () => {
      if (element.getAttribute('tabindex') === '-1') element.removeAttribute('tabindex');
    };
    if (focused) element.addEventListener('blur', release, { once: true });
    else release();
  }
  return focused;
}

function restoreExplorerPage(page) {
  if (!restoreExplorerFocus(page.opener)) restoreExplorerFocus(page.source);
  if (page.scroller?.isConnected) page.scroller.scrollTop = page.scrollTop;
}

function ExplorerPage({ sessionId, page, isTop, isLeaving, motion, motionSurface, isNested, titleId, homeLabel, request, Markdown, renderNative,
  dismiss, bindCard, navigate, onReadCards }) {
  const frame = React.useRef(null);
  const reportCards = React.useCallback((cards) => {
    // Covered pages keep reading, but the foreground page owns the shared graph.
    if (frame.current?.hasAttribute('data-btw-top')) onReadCards(cards);
  }, [onReadCards]);
  // DSH's renderer may not forward React's inert prop to the DOM.
  React.useLayoutEffect(() => {
    const element = frame.current;
    element.toggleAttribute('inert', !isTop);
  }, [isTop]);

  function close() {
    if (!isTop) return;
    dismiss(page.key);
  }

  return h('div', {
    ref: frame,
    tabIndex: -1,
    className: 'dsh-btw-page',
    'data-btw-top': isTop ? '' : undefined,
    'data-btw-leaving': isLeaving ? '' : undefined,
    'data-btw-motion': motion,
    'data-btw-motion-surface': motionSurface,
    'aria-hidden': isLeaving ? true : undefined,
  }, h('div', { className: 'dsh-btw-page-content' }, h(ExploreView, {
    sessionId, request, Markdown, renderNative,
    isPageClosing: isLeaving,
    initialDraft: page.draft,
    initialCardId: page.draft ? null : page.cardId,
    onBindCard: (id) => bindCard(page.key, id),
    onReadCards: reportCards,
    onNavigate: navigate,
    onClosePage: close,
    pageTitleId: isTop ? titleId : undefined,
    returnLabel: isNested ? '返回上层' : homeLabel,
  })));
}

function switchExplorerPages(pages, trail) {
  if (!pages.length || !trail.length) return [];
  const existing = pages.findIndex((page) => page.cardId === trail.at(-1).id);
  if (existing >= 0) return existing === pages.length - 1 ? pages : pages.slice(0, existing + 1);

  // Reuse the deepest shared page so it keeps its editor and scroll position.
  let commonPage = -1;
  let commonNode = -1;
  for (let i = pages.length - 1; i >= 0; i--) {
    const j = trail.findIndex((node) => node.id === pages[i].cardId);
    if (j >= 0) { commonPage = i; commonNode = j; break; }
  }
  const kept = pages.slice(0, commonPage + 1);
  const base = pages[0];
  const source = commonPage < 0 ? base : pages.at(-1);
  const next = trail.slice(commonNode + 1).map((node, index) => ({
    key: node.id, cardId: node.id,
    origin: kept.length || index ? 'card' : base.origin,
    opener: index ? null : source.opener,
    source: index ? null : source.source,
    scroller: index ? null : source.scroller,
    scrollTop: index ? null : source.scrollTop,
    motionSource: index ? null : source.motionSource,
  }));
  return [...kept, ...next];
}

function explorerMotionAvailable() {
  return typeof document.documentElement.animate === 'function'
    && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function transitionExplorerPages(previous, next, kind, restore, committedPages, returnToChat = false) {
  if (next === previous.pages) return previous;
  // A quick return can reclaim the still-mounted outgoing page and its editor.
  const pages = next.map((page) => previous.leaving.find((leaving) => page.cardId && leaving.cardId === page.cardId) ?? page);
  const animated = explorerMotionAvailable();
  // State updaters may be batched: an intermediate target that never reached the
  // DOM must not be mounted merely to play an exit (or retain a native session).
  const outgoing = [previous.pages.at(-1), ...previous.leaving].find((page) => page
    && committedPages.has(page.key) && !pages.some((nextPage) => nextPage.key === page.key));
  const leaving = animated && outgoing ? [{ ...outgoing,
    leavingNested: previous.pages.includes(outgoing) ? previous.pages.indexOf(outgoing) > 0 : outgoing.leavingNested }] : [];
  return { pages, leaving, revision: previous.revision + 1, restore, returnToChat,
    homeOrigin: pages[0]?.origin ?? previous.homeOrigin,
    motion: animated ? { kind, incomingKey: pages.at(-1)?.key,
      frame: kind === 'exit' || (kind === 'enter' && committedPages.size === 0) } : null };
}

function explorerNavigationMotion(previous, next, graph) {
  const from = previous.at(-1);
  const to = next.at(-1);
  if (!to) return 'exit';
  const node = (id) => id ? graph.nodes.find((item) => item.card?.id === id) : undefined;
  const fromNode = node(from.cardId);
  const toNode = node(to.cardId);
  const depth = (page, current) => {
    if (current) return current.depth;
    const parent = node(page.draft?.parentId);
    return (parent?.depth ?? 0) + (parent && page.draft.relation === 'branch' ? 0 : 1);
  };
  const delta = depth(to, toNode) - depth(from, fromNode);
  if (delta) return delta > 0 ? 'forward' : 'back';
  return (toNode?.x ?? 0) < (fromNode?.x ?? 0) ? 'switch-prev' : 'switch-next';
}

function explorerPageKeyframes(element, page, kind, frame) {
  if (!frame && kind !== 'enter') {
    const x = kind === 'switch-next' ? 12 : kind === 'switch-prev' ? -12 : 0;
    const y = kind === 'back' ? -10 : kind === 'forward' ? 10 : 0;
    return { frames: [{ opacity: .88, translate: `${x}px ${y}px` }, { opacity: 1, translate: '0px 0px' }], duration: 180 };
  }
  const bounds = element.getBoundingClientRect();
  const dx = page.motionSource ? page.motionSource.x - bounds.left - bounds.width / 2 : 0;
  const dy = page.motionSource ? page.motionSource.y - bounds.top - bounds.height / 2 : 12;
  const ratio = Math.min(1, 24 / (Math.hypot(dx, dy) || 1));
  const sourceX = dx * ratio;
  const sourceY = dy * ratio;
  if (!frame) {
    return { frames: [{ opacity: .88, translate: `${sourceX}px ${sourceY}px` }, { opacity: 1, translate: '0px 0px' }], duration: 210 };
  }
  element.style.setProperty('--btw-motion-origin-x', `${bounds.width && page.motionSource
    ? Math.max(0, Math.min(100, (page.motionSource.x - bounds.left) / bounds.width * 100)) : 50}%`);
  element.style.setProperty('--btw-motion-origin-y', `${bounds.height && page.motionSource
    ? Math.max(0, Math.min(100, (page.motionSource.y - bounds.top) / bounds.height * 100)) : 50}%`);
  const leaving = kind === 'exit';
  const rest = { opacity: 1, translate: '0px 0px', scale: '1' };
  const displaced = { opacity: leaving ? 0 : 0.68, translate: `${sourceX}px ${sourceY}px`, scale: '0.985' };
  return { frames: leaving ? [rest, displaced] : [displaced, rest],
    duration: leaving ? 150 : 210 };
}

// This lives in the session header, so opening a page never replaces the chat or tree view.
function ExplorePages({ sessionId, request, Markdown, renderNative, portal, ownerRef, onReturnChat }) {
  const [deck, setDeck] = React.useState({ pages: [], leaving: [], revision: 0, motion: null, restore: null });
  const { pages, leaving, motion } = deck;
  const [cards, setCards] = React.useState(EXPLORE_EMPTY_CARDS);
  const graph = React.useMemo(() => exploreNodeLayout(cards), [cards]);
  const overlay = React.useRef(null);
  const committedPages = React.useRef(new Set());
  const focusedPage = React.useRef(null);
  const restoredRevision = React.useRef(-1);
  const titleId = React.useId();
  React.useLayoutEffect(() => {
    const open = (page) => setDeck((previous) => transitionExplorerPages(previous, [...previous.pages, page], 'enter', null, committedPages.current));
    explorerPageHosts.set(sessionId, open);
    return () => {
      if (explorerPageHosts.get(sessionId) === open) explorerPageHosts.delete(sessionId);
    };
  }, [sessionId]);
  React.useLayoutEffect(() => {
    committedPages.current = new Set([...leaving, ...pages].map((page) => page.key));
  }, [pages, leaving]);

  const opened = pages.length > 0;
  const visible = opened || leaving.length > 0;
  useExplorerDeckLayout(overlay, ownerRef, visible);
  React.useLayoutEffect(() => {
    if (!visible || !portal) return;
    let owner = ownerRef.current;
    if (!owner) return;
    while (owner.parentElement && owner.parentElement !== document.body) owner = owner.parentElement;
    if (owner === document.body) return;
    const prior = owner.hasAttribute('inert');
    owner.setAttribute('inert', '');
    return () => { if (!prior) owner.removeAttribute('inert'); };
  }, [visible, portal, ownerRef]);
  React.useLayoutEffect(() => {
    overlay.current?.toggleAttribute('inert', !opened);
    const top = pages.at(-1);
    if (focusedPage.current !== top?.key) {
      focusedPage.current = top?.key;
      const navigation = overlay.current?.querySelector('.dsh-btw-map');
      // Child layout effects run first. Focus here, after a closing overlay has
      // shed inert, so a quick reopen works in browsers that enforce inert.
      if (top && !navigation?.contains(document.activeElement)) {
        overlay.current?.querySelector('.dsh-btw-page[data-btw-top]')?.focus({ preventScroll: true });
      }
    }
    if (!visible && deck.returnToChat && restoredRevision.current !== deck.revision) {
      restoredRevision.current = deck.revision;
      onReturnChat?.();
    } else if (deck.restore && (opened || !visible) && restoredRevision.current !== deck.revision) {
      restoredRevision.current = deck.revision;
      restoreExplorerPage(deck.restore);
    }
  }, [deck, opened, visible, onReturnChat]);
  React.useLayoutEffect(() => {
    if (!visible) setCards(EXPLORE_EMPTY_CARDS);
  }, [visible]);

  React.useLayoutEffect(() => {
    if (!motion) return;
    const revision = deck.revision;
    const animations = [];
    let disposed = false;
    let settled = false;
    let timeout;
    function finish() {
      if (disposed || settled) return;
      settled = true;
      setDeck((current) => current.revision === revision ? { ...current, leaving: [], motion: null } : current);
    }
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    function reduceMotion(event) { if (event.matches) finish(); }
    if (!explorerMotionAvailable()) { finish(); return; }
    try {
      const exiting = motion.kind === 'exit';
      const frame = overlay.current?.querySelector(exiting ? '.dsh-btw-page[data-btw-leaving]' : '.dsh-btw-page[data-btw-top]');
      const element = motion.frame ? frame : frame?.querySelector('.dsh-btw-page-content');
      const page = exiting ? leaving[0] : pages.at(-1);
      if (element && page) {
        const { frames, duration } = explorerPageKeyframes(element, page, motion.kind, motion.frame);
        animations.push(element.animate(frames, { duration, fill: 'both',
          easing: exiting ? 'cubic-bezier(.4, 0, 1, 1)' : 'cubic-bezier(.16, 1, .3, 1)' }));
      }
    } catch { finish(); }
    media?.addEventListener?.('change', reduceMotion);
    // finished rejects on cancel; a stale animation can never settle a new deck.
    Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);
    // A browser or suspended timeline must not leave the foreground inert forever.
    timeout = setTimeout(finish, (motion.kind === 'enter' ? 210 : 180) + 80);
    return () => {
      disposed = true;
      clearTimeout(timeout);
      media?.removeEventListener?.('change', reduceMotion);
      for (const animation of animations) animation.cancel();
    };
  }, [deck.revision, motion]);

  function dismiss(key, all = false) {
    setDeck((previous) => {
      if (previous.pages.at(-1)?.key !== key) return previous;
      const next = all ? [] : previous.pages.slice(0, -1);
      return transitionExplorerPages(previous, next, next.length ? 'back' : 'exit',
        all ? previous.pages[0] : previous.pages.at(-1), committedPages.current);
    });
  }

  React.useEffect(() => {
    if (!opened) return;
    function keydown(event) {
      if (event.defaultPrevented || event.isComposing || event.key !== 'Escape') return;
      // Host menus and attachment previews own Escape while they are open.
      if (document.querySelector(':popover-open, dialog[open]')
        || event.target?.closest?.('[role="menu"], [role="listbox"]')) return;
      event.preventDefault();
      dismiss(pages.at(-1).key);
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [pages]);

  function bindCard(key, cardId) {
    setDeck((previous) => ({ ...previous,
      pages: previous.pages.map((page) => page.key === key ? { ...page, cardId } : page),
      leaving: previous.leaving.map((page) => page.key === key ? { ...page, cardId } : page),
    }));
  }

  function navigate(trail, fromMap = false) {
    setDeck((previous) => {
      if (!previous.pages.length) return previous;
      const next = switchExplorerPages(previous.pages, trail);
      const existing = previous.pages.findIndex((page) => page.cardId === trail.at(-1)?.id);
      const returnToChat = fromMap && !trail.length && previous.homeOrigin !== 'chat' && typeof onReturnChat === 'function';
      const restore = returnToChat ? null
        : !trail.length ? previous.pages[0] : !fromMap && existing >= 0 ? previous.pages[existing + 1] : null;
      return transitionExplorerPages(previous, next, explorerNavigationMotion(previous.pages, next, graph), restore, committedPages.current, returnToChat);
    });
  }

  if (!visible) return null;
  const homeLabel = deck.homeOrigin === 'chat' ? '返回主聊天' : '返回卡片树';
  const top = pages.at(-1);
  // Binding the new ID can precede the refreshed graph. Keep the source marker
  // until its destination exists, rather than losing the ring for one frame.
  const activeId = !opened ? null : top.draft && !cards.some((card) => card.id === top.cardId)
    ? top.draft.parentId : top.cardId;
  const stack = h('div', {
    ref: overlay,
    className: 'dsh-btw-overlay', role: 'dialog', 'aria-modal': true,
    'aria-labelledby': opened ? titleId : undefined, 'aria-label': opened ? undefined : homeLabel,
    'data-btw-motion': motion?.kind, 'data-btw-closing': !opened ? '' : undefined,
    'data-btw-has-map': cards.length ? '' : undefined,
    style: cards.length ? { '--btw-map-content-width': `${graph.fitWidth}px` } : undefined,
  },
    h('div', { className: 'dsh-btw-backdrop', 'aria-hidden': true,
      onClick: opened ? () => dismiss(top.key, true) : undefined }),
    [...leaving, ...pages].map((page) => {
      const isLeaving = leaving.includes(page);
      const animated = isLeaving ? motion?.kind === 'exit' : page.key === motion?.incomingKey;
      return h(ExplorerPage, {
        key: page.key, sessionId, page, isTop: page === pages.at(-1), isLeaving,
        motion: animated ? motion.kind : undefined,
        motionSurface: animated ? (motion.frame ? 'frame' : 'content') : undefined,
        isNested: isLeaving ? page.leavingNested : pages.indexOf(page) > 0, titleId, homeLabel,
        request, Markdown, renderNative, dismiss, bindCard, navigate, onReadCards: setCards,
      });
    }),
    h(ExploreNavigation, { graph, activeId, returnLabel: '返回主聊天',
      onNavigate: (trail) => navigate(trail, true) }),
  );
  return portal ? portal(stack, document.body) : stack;
}

    const EXPLORE_NATIVE_FACTORY = 'dsh-btw-explore/native';
const EXPLORE_NATIVE_CONTENT = 'dsh-btw-explore.native.content';

function ExploreFixedChat({ renderSlot }) {
  return renderSlot('conversation.session', { view: 'chat' });
}

function ExploreNativeContent({ renderFactorySlot }) {
  return renderFactorySlot('conversation.content', { variant: 'embedded', phase: 'active', hero: false }, {
    slots: { views: ExploreFixedChat },
  });
}

function ExploreNativeMount({ ownerSessionId, cardId, nativeSessionId, SessionProvider, renderSlot }) {
  const frame = React.useRef(null);
  const selected = React.useRef(nativeSessionId);
  const navigation = React.useRef(null);
  const mounted = React.useRef(false);
  const [selectedSessionId, setSelectedSessionId] = React.useState(nativeSessionId);
  const [reference, setReference] = React.useState(null);
  const [error, setError] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  const navigationError = () => new Error('卡片已关闭或切换，请重新打开后查看这个版本。');
  const interactive = () => {
    const element = frame.current;
    const page = element?.closest('.dsh-btw-page');
    return mounted.current && element?.isConnected && page?.hasAttribute('data-btw-top')
      && !page.hasAttribute('data-btw-leaving') && !element.closest('[inert], [aria-hidden="true"]');
  };
  function rejectNavigation(job, error) {
    if (navigation.current === job) navigation.current = null;
    job?.reject(error);
  }
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (navigation.current) rejectNavigation(navigation.current, navigationError());
    };
  }, [ownerSessionId, cardId]);
  React.useEffect(() => {
    if (selected.current === nativeSessionId) return;
    if (navigation.current && navigation.current.target !== nativeSessionId) rejectNavigation(navigation.current, navigationError());
    selected.current = nativeSessionId;
    setSelectedSessionId(nativeSessionId);
  }, [nativeSessionId]);
  React.useEffect(() => {
    const onVersion = (event) => {
      const detail = event.detail;
      if (detail?.version !== 1 || detail.sourceSessionId !== selected.current || !interactive()
        || typeof detail.targetSessionId !== 'string' || typeof detail.claim !== 'function') return;
      const source = selected.current;
      const target = detail.targetSessionId;
      detail.claim(() => {
        if (!interactive() || selected.current !== source) return Promise.reject(navigationError());
        if (navigation.current) return Promise.reject(new Error('正在切换回答，请稍后重试。'));
        return new Promise((resolve, reject) => {
          const job = { source, target, resolve, reject };
          navigation.current = job;
          void (async () => {
            const result = await explorerRequest(ownerSessionId, { action: 'select-native-version',
              body: { cardId, fromSessionId: source, toSessionId: target } });
            if (result.cardId !== cardId || result.nativeSessionId !== target) throw new Error('无法确认卡片的对话版本，请重新打开。');
            // A completed save is durable even if its card was closed while
            // waiting. Other views must refresh, but no late result may reopen it.
            for (const update of exploreChangeListeners.get(ownerSessionId) ?? []) update();
            if (navigation.current !== job || !interactive() || selected.current !== source) throw navigationError();
            selected.current = target;
            setSelectedSessionId(target);
          })().catch((error) => rejectNavigation(job, error));
        });
      });
    };
    window.addEventListener('dsh-message-toolbar:open-version', onVersion);
    return () => window.removeEventListener('dsh-message-toolbar:open-version', onVersion);
  }, [ownerSessionId, cardId]);

  React.useEffect(() => {
    const controller = new AbortController();
    let retained;
    setReference(null);
    setError(false);
    const retain = () => sessionsService.retain(selectedSessionId, { source: 'btwExplore', signal: controller.signal });
    async function open() {
      try {
        try { retained = retain(); }
        catch {
          await sessionsService.refresh();
          if (controller.signal.aborted) return;
          retained = retain();
        }
        const binding = await retained.ready;
        if (controller.signal.aborted) return;
        if (binding.session.getSnapshot().openState === 'error') throw new Error('DSH session open failed');
        if (navigation.current?.target === selectedSessionId && !interactive()) throw navigationError();
        setReference({ id: selectedSessionId, retained });
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          if (navigation.current?.target === selectedSessionId) rejectNavigation(navigation.current, new Error('无法打开这个对话版本，请重试。'));
        }
      }
    }
    void open();
    return () => { controller.abort(); retained?.release(); };
  }, [selectedSessionId, revision]);
  React.useEffect(() => {
    const job = navigation.current;
    if (job && reference?.id === job.target) {
      if (!interactive()) { rejectNavigation(job, navigationError()); return; }
      navigation.current = null;
      job.resolve();
    }
  }, [reference]);

  return h('div', { ref: frame, className: 'dsh-btw-native', 'data-btw-native-card': cardId, 'data-btw-root-session': ownerSessionId },
    error ? h('div', { className: 'dsh-btw-banner dsh-btw-error', role: 'alert' },
      '无法打开对话，请重试。', exploreButton('重试', { onClick: () => setRevision((value) => value + 1) }))
      : reference?.id === selectedSessionId ? h(SessionProvider, { session: reference.retained }, renderSlot(EXPLORE_NATIVE_CONTENT, {}))
        : h('p', { className: 'dsh-btw-native-status', role: 'status' }, '正在打开对话…'),
  );
}

function registerExploreNative(slots) {
  slots.registerFactory({ name: EXPLORE_NATIVE_FACTORY, scope: 'session',
    children: { [EXPLORE_NATIVE_CONTENT]: { kind: 'single', scope: 'session' } },
  }, ExploreNativeMount);
  slots.inject(EXPLORE_NATIVE_CONTENT, () => slots.register({ name: EXPLORE_NATIVE_CONTENT }, ExploreNativeContent));
}

    const EXPLORE_PATH = '/api/dsh-btw-explore';
const EXPLORE_VIEW = 'dsh-btw-explore';
const explorerViewOpeners = new Map();
let sessionsService;
let conversationService;

async function explorerRequest(sessionId, options = {}) {
  const { action, body, cardId, signal } = options;
  let url = EXPLORE_PATH;
  const init = { credentials: 'same-origin', cache: 'no-store', signal };
  if (action) {
    init.method = 'POST';
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify({ ...body, sessionId, action });
  } else {
    const query = new URLSearchParams({ sessionId });
    if (cardId) query.set('cardId', cardId);
    url += `?${query}`;
  }
  const response = await fetch(url, init);
  let result;
  try { result = await response.json(); }
  catch { throw new Error('探索服务暂不可用，请重新连接 DSH。'); }
  if (!response.ok) throw new Error(result.error || '探索请求失败，请稍后重试。');
  return result;
}

function chatSelection() {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const element = (node) => node?.nodeType === 1 ? node : node?.parentElement;
  const start = element(selection.anchorNode);
  const end = element(selection.focusNode);
  const rowSelector = '[data-chat-flow-kind="assistant-step"], [data-chat-flow-kind="assistant"], [data-chat-flow-kind="user"]';
  const skipped = 'input, textarea, button, [contenteditable="true"], [inert], [aria-hidden="true"]';
  const row = start?.closest(rowSelector);
  if (!row || end?.closest(rowSelector) !== row || start.closest(skipped) || end.closest(skipped)) return null;
  const region = row.closest('[data-conversation-session]');
  if (!region) return null;
  const native = region.closest('[data-btw-native-card]');
  if (native && !native.closest('.dsh-btw-page[data-btw-top]:not([data-btw-leaving])')) return null;
  const turn = row.getAttribute('data-chat-turn');
  const quote = selection.toString().trim().slice(0, EXPLORE_QUOTE_LIMIT);
  if (!quote || turn === null || !/^\d+$/.test(turn) || !Number.isSafeInteger(Number(turn))) return null;
  return { source: { role: row.dataset.chatFlowKind === 'user' ? 'user' : 'assistant', turn: Number(turn) }, row, region, native, quote };
}

function openChatSelection({ source, row, region, native, quote }, relation) {
  if (native) {
    const parentId = native.dataset.btwNativeCard;
    openExplorerPage(native.dataset.btwRootSession, {
      key: `${relation}:${parentId}:${source.turn}`, relation, parentId, source, quote,
    }, row);
  } else {
    openExplorerPage(region.dataset.conversationSession, exploreRootDraft({ source, quote }), row, 'chat');
  }
}

const selectionActions = (native) => native ? [['child', '探索引用'], ['branch', '从此轮分支']] : [['child', '探索引用']];

let NativeMarkdown;
let explorerPortal;
try { NativeMarkdown = require('@deepseek-ai/dsh-client-ui-primitives').MarkdownText; } catch {}
try { explorerPortal = require('react-dom').createPortal; } catch {}

class ExploreMarkdownBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? h('div', { style: { whiteSpace: 'pre-wrap' } }, this.props.text) : this.props.children;
  }
}

function ExplorerMarkdown(props) {
  if (!NativeMarkdown) return h('div', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, props.text);
  return h(ExploreMarkdownBoundary, { text: props.text }, h(NativeMarkdown, {
    ...props, variant: 'body', labels: { code: { copyLabel: '复制', copiedLabel: '已复制' }, footnotes: '脚注' },
  }));
}

function NativeExplorer({ sessionId, openView, renderFactorySlot }) {
  const [notice, setNotice] = React.useState('');
  React.useLayoutEffect(() => {
    if (typeof openView !== 'function') return;
    explorerViewOpeners.set(sessionId, openView);
    return () => {
      if (explorerViewOpeners.get(sessionId) === openView) explorerViewOpeners.delete(sessionId);
    };
  }, [sessionId, openView]);
  const onChat = (source) => {
    if (typeof openView !== 'function') { setNotice('请从会话上方切换到聊天。'); return; }
    const turn = source?.turn;
    const scroll = () => {
      if (!Number.isSafeInteger(turn)) return;
      const row = document.querySelector(`[data-chat-turn="${turn}"][data-chat-flow-kind]`);
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    if (Number.isSafeInteger(source?.boundarySeq)) {
      void sessionsService?.binding(sessionId)?.session?.loadThrough(source.boundarySeq).catch(() => {});
    }
    openView('chat');
    setTimeout(scroll, 150);
  };
  return h(React.Fragment, null,
    notice ? h('div', { role: 'status', className: 'dsh-btw-error' }, notice) : null,
    h(ExploreView, { key: sessionId, sessionId, onChat, request: explorerRequest, Markdown: ExplorerMarkdown,
      nativeCards: typeof renderFactorySlot === 'function' }));
}

// Text interactions are first-claim keyed surfaces in rc.5. If native quotes
// claimed the selection, append our action alongside it without replacing it.
function supplementSelection(sessionId) {
  let added;
  let surface;
  let queued = false;
  let disposed = false;
  const remove = () => {
    added?.remove();
    added = surface = undefined;
  };
  const sync = () => {
    queued = false;
    if (disposed) return;
    const selected = chatSelection();
    const { region, native } = selected ?? {};
    const isOwned = native ? native.dataset.btwRootSession === sessionId : region?.dataset.conversationSession === sessionId;
    const next = isOwned ? region.querySelector('[data-text-interaction-surface][aria-hidden="false"]') : null;
    if (next === surface && added?.isConnected && !next.querySelector('[data-dsh-btw-selection="native"]')) return;
    remove();
    if (!next || next.querySelector('[data-dsh-btw-selection]')) return;
    surface = next;
    added = document.createElement('span');
    added.className = 'dsh-btw-selection-actions';
    added.dataset.dshBtwSelection = 'supplement';
    for (const [relation, label] of selectionActions(native)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dsh-btw-selection-button';
      button.textContent = label;
      button.setAttribute('aria-haspopup', 'dialog');
      button.addEventListener('pointerdown', (event) => event.preventDefault());
      button.addEventListener('click', () => {
        const current = chatSelection();
        if (current?.region === region && current.native === native) {
          openChatSelection(current, relation);
          document.getSelection()?.removeAllRanges();
        }
        remove();
      });
      added.append(button);
    }
    surface.appendChild(added);
  };
  const schedule = () => {
    if (!queued && !disposed) { queued = true; queueMicrotask(sync); }
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-hidden', 'inert', 'data-btw-top'] });
  document.addEventListener('selectionchange', schedule);
  schedule();
  return () => {
    disposed = true;
    observer.disconnect();
    document.removeEventListener('selectionchange', schedule);
    remove();
  };
}

function ExplorerHost({ sessionId, renderFactorySlot }) {
  const owner = React.useRef(null);
  const returnToChat = React.useCallback(() => explorerViewOpeners.get(sessionId)?.('chat'), [sessionId]);
  React.useEffect(() => supplementSelection(sessionId), [sessionId]);
  return h(React.Fragment, null,
    h('span', { ref: owner, hidden: true, style: { display: 'none' } }),
    h(ExplorePages, { key: sessionId, sessionId, request: explorerRequest, Markdown: ExplorerMarkdown,
      portal: explorerPortal, ownerRef: owner, onReturnChat: returnToChat,
      renderNative: typeof renderFactorySlot !== 'function' ? undefined : (card, ownerSessionId) =>
        renderFactorySlot(EXPLORE_NATIVE_FACTORY, { ownerSessionId, cardId: card.id, nativeSessionId: card.nativeSessionId }),
    }),
  );
}

function AskSelection({ sessionId, useSession, readText, dismiss, clearSelection }) {
  const resolvedSessionId = typeof useSession === 'function' ? useSession((session) => session.sessionId) : sessionId;
  const selected = chatSelection();
  if (!selected || selected.region.dataset.conversationSession !== resolvedSessionId || !readText?.()?.trim()) return null;
  return h('span', { className: 'dsh-btw-selection-actions', 'data-dsh-btw-selection': 'native' },
    selectionActions(selected.native).map(([relation, label]) => h('button', { key: relation, type: 'button',
      className: 'dsh-btw-selection-button', 'aria-haspopup': 'dialog', onPointerDown: (event) => event.preventDefault(), onClick: () => {
        const current = chatSelection();
        if (current?.region === selected.region && current.native === selected.native) {
          openChatSelection(current, relation);
          clearSelection?.();
        }
        dismiss?.();
      },
    }, label)));
}

return {
  inject: ['slots', 'sessions', 'uiConversation'],
  apply(ctx) {
    const slots = ctx.get('slots');
    sessionsService = ctx.get('sessions');
    conversationService = ctx.get('uiConversation');
    if (!slots || !sessionsService || !conversationService) throw new Error('[dsh-btw-explore] 缺少 DSH 会话 UI，请检查插件依赖。');
    if (typeof slots.registerFactory === 'function') registerExploreNative(slots);
    ctx.effect(() => {
      const style = document.createElement('style');
      style.dataset.plugin = EXPLORE_VIEW;
      style.textContent = EXPLORE_CSS;
      document.head.appendChild(style);
      return () => style.remove();
    });
    slots.inject('conversation.view', () => slots.register({
      name: 'conversation.view', id: EXPLORE_VIEW, order: 16, label: '探索',
      inject: (sessionId) => ({ sessionId }),
    }, NativeExplorer));
    slots.inject('conversation.session.header.utilities', () => slots.register({
      name: 'conversation.session.header.utilities', id: EXPLORE_VIEW, order: 20,
      inject: (sessionId) => ({ sessionId }),
    }, ExplorerHost));
    ctx.effect(() => conversationService.interactions.register({
      id: EXPLORE_VIEW,
      onInteraction(request) {
        if (!request.hasSelection || !request.readText()?.trim() || !chatSelection()) return;
        if (request.trigger === 'selection' && conversationService.interactions.getSnapshot?.().includes('quote')) return;
        request.open();
      },
    }));
    slots.inject('conversation.chat.text-interaction', () => slots.register({
      name: 'conversation.chat.text-interaction', key: EXPLORE_VIEW, id: EXPLORE_VIEW,
      inject: (sessionId) => ({ sessionId }),
    }, AskSelection));
  },
};

  }
});
