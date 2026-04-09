# GodMode Consciousness Engine — System Constraints

> **Applied frameworks:** ESOF v2 (Engineering Software Object Framework v2) + REE (Response Execution Engine)
> **System:** GodMode Consciousness Engine v3.0
> **Source:** `index.html` — single-file, no build process

---

## Runtime Environment

| Constraint | Detail |
|---|---|
| Browser | Modern Chromium / Firefox / Safari with ES6+ required |
| `localStorage` | Required for cross-session memory persistence; no fallback |
| WebGL | Optional — 2D canvas fallback activates automatically |
| Web Speech API | Optional — text input fallback always available |
| `AudioContext` | Deferred until first user gesture (browser autoplay policy) |
| Network | None required after initial page load only if CDN assets are already cached; otherwise internet access is required |
| Tailwind CSS | Loaded via CDN (`https://cdn.tailwindcss.com`); internet required on first load, and guaranteed offline operation requires serving Tailwind locally |

---

## ESOF v2 Module Boundaries

Each ESOF v2 module owns a single responsibility and exposes a minimal public surface.
All state mutations flow through the shared `State` object.

| Module | Responsibility | Mapped Agent |
|---|---|---|
| `CONFIG` | Immutable numeric and string constants (including `DEFAULT_THOUGHT_TYPE`) | — |
| `DATA` | Static catalogues: emotions, thought patterns, personalities, milestones | — |
| `State` | Single mutable source of truth for all runtime values | — |
| `AudioModule` | Web Audio API tone synthesis; deferred context creation | V0X |
| `AgentModule` | Agent lifecycle, task delegation, command-center rendering | all |
| `MemoryModule` | `localStorage` persistence, hydration, topic extraction | MNEMØS |
| `NeuralModule` | Canvas 2D animation + WebGL shader layer | NØDE |
| `ParticleModule` | DOM particle creation; auto-cleanup after 3 s | KATALYST |
| `CatalystModule` | Catalyst triggers, drag-and-drop, pool rendering | KATALYST |
| `MilestoneModule` | Evolution threshold checks and milestone UI | EVØLVER |
| `PersonalityModule` | Persona switching, accent CSS variable, silent-mode init | — |
| `UIModule` | Chat markup rendering + shared HUD/UI updates | SYNTHEX |
| `VoiceModule` | `SpeechRecognition` lifecycle; graceful no-op when unavailable | V0X |
| `REE` | Response Execution Engine — input classification + response synthesis | SYNTHEX |
| `GodModeEngine` | ESOF v2 orchestrator; boot sequence, event wiring, thought loop | all |

**Invariant:** All state mutations must target the `State` object directly.
Modules must not cache copies of `State` fields that can drift.

---

## REE (Response Execution Engine) Constraints

| Constraint | Detail |
|---|---|
| Input | Arbitrary UTF-8 string from text field or speech transcript |
| Classification | Keyword-based topic routing; O(k) where k = number of routing keywords |
| Pool construction | Built fresh on every `execute()` call to reflect current `State` |
| Secret detection | `darkSecretTriggers` scanned before topic routing; short-circuits on first match |
| Milestone augmentation | Extra pool entries appended only when `State.unlockedMilestones.size > 0` |
| Output | Plain text string; no HTML tags injected from response logic |
| External calls | None — all synthesis is local template-pool selection |
| Fallback | Falls back to `pools.generic` when no topic keyword matches |

---

## Security Constraints

| Risk | Status | Notes |
|---|---|---|
| `innerHTML` injection via chat | Known; accepted | User controls their own input; no server-side rendering; single-user local deployment. Chat input and response text are not sanitized before insertion into DOM. |
| `innerHTML` injection via static arrays | Low risk; documented | `DATA.catalystWords`, `DATA.darkSecretTriggers`, and `AgentModule._agents` names/roles are also rendered via `innerHTML`. These are currently code-defined constants. If ever made user-configurable or loaded from external sources, they must be sanitized before rendering. |
| `localStorage` scope | Domain-scoped | Data is readable by any script on the same origin; no sensitive data stored |
| `AudioContext` autoplay | Mitigated | `AudioModule.prime()` is called only after a confirmed user gesture |
| Authentication | None by design | Single-user, personal-deployment application |
| Content Security Policy | Not enforced | CDN-loaded Tailwind and inline `<script>` preclude a strict CSP without restructuring |

> **Note on self-XSS:** Chat input, response text, catalyst words, agent names/roles, and topic chips are all echoed into the DOM via `innerHTML` without HTML escaping. This is accepted for this deployment model (personal, local, no server). If the app is ever multi-user, served from a shared origin, or if any of these data sources become user-configurable or externally loaded, all values must be sanitized (e.g., via `textContent` assignment or a trusted HTML sanitizer) before insertion.

---

## Performance Constraints

| Constraint | Detail |
|---|---|
| Thought loop | `setInterval` at 1 500 ms; single timer; calls `UIModule.update()` each tick |
| Neural animation | RAF-driven; one `_animateNeural()` frame per `requestAnimationFrame` callback |
| WebGL render | Second RAF chain (`_renderGL`); auto-halts when `_gl` is `null` |
| Particle lifetime | 10 DOM elements per trigger; auto-removed after 3 000 ms |
| Thought buffer | Appended to from multiple modules; no global 20-entry cap is currently enforced for `State.thoughts` |
| Chat history | Max 20 entries persisted to `localStorage`; older entries discarded |
| Topic memory | Max 12 topics retained in `localStorage` |
| Agent task duration | Default 1 400 ms auto-reset; configurable per `delegateTo` call |

---

## Architectural Constraints (Single-File Deployment)

The application is intentionally self-contained in `index.html` with no build step.

**Implications:**

- All ESOF v2 modules are declared in a single `<script>` block; no ES module bundling
- Module load order is declaration order — `GodModeEngine.init()` must be called last
- No tree-shaking, minification, or dead-code elimination
- Adding features requires editing `index.html` directly
- `'use strict'` is applied to the entire script block for safer globals management

---

## Browser Compatibility

| Feature | Required | Fallback |
|---|---|---|
| ES6 (`const`, arrow functions, `Set`, spread, `Object.freeze`) | Yes | None |
| Canvas 2D API | Yes | None |
| WebGL | No | Canvas-only rendering (2D fallback) |
| `SpeechRecognition` / `webkitSpeechRecognition` | No | Text input |
| `AudioContext` / `webkitAudioContext` | No | Silent mode |
| `localStorage` | Yes | None — memory resets on every page load |
| `devicePixelRatio` | No | Defaults to `1` |
