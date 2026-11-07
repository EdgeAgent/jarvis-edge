// Preload — intentionally empty of powers. The console needs no Node access;
// context isolation stays on and no bridge is exposed. Jarvis-Edge's rule:
// the UI asks, the operator approves, and privileged action stays outside
// the page. (Stage-2 desktop workers will arrive as separate, gated
// processes — see docs/ROADMAP-95.md.)
"use strict";
