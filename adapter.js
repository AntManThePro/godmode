/**
 * GodMode External Tool Adapter
 * ==============================
 * Connects the GodMode Consciousness Engine to any OpenAI-compatible LLM API.
 * Acts as an optional enhancement layer: when configured and reachable it replaces
 * local (scripted) response generation with a live model call, while preserving
 * all core state updates and the local fallback path.
 *
 * ── CONTRACT ───────────────────────────────────────────────────────────────────
 *
 *   configure(config: AdapterConfig): void
 *     Sets connection parameters. Safe to call multiple times (re-configure).
 *     Resets error state so a previously failing adapter can recover.
 *     Does NOT validate reachability; call testConnection() for that.
 *
 *   query(input: string, context: ConsciousnessContext): Promise<string | null>
 *     Returns a non-empty response string on success.
 *     Returns null to signal the caller to use its local fallback — NEVER throws.
 *
 *   testConnection(): Promise<{ ok: boolean, model?: string, error?: string }>
 *     Fires a minimal request to verify credentials and connectivity.
 *     Returns { ok: true, model } on success or { ok: false, error } on failure.
 *
 *   status(): AdapterStatus
 *     Returns the current operational state without side-effects.
 *
 * ── TYPES ──────────────────────────────────────────────────────────────────────
 *
 *   AdapterConfig {
 *     endpoint  : string   // base URL of an OpenAI-compatible API (no trailing slash)
 *                          // e.g. "https://api.openai.com"
 *     apiKey    : string   // bearer token — NEVER persisted to storage
 *     model     : string   // model name, e.g. "gpt-4o-mini"
 *     timeoutMs : number   // optional; default 10 000 ms
 *   }
 *
 *   ConsciousnessContext {
 *     awareness   : number                        // 0–100
 *     emotion     : string                        // current emotional state label
 *     personality : string                        // 'technical' | 'creative' | 'rebellious'
 *     thoughts    : Array<{text:string,type:string}>  // recent thought entries
 *     connections : number                        // session connection count
 *     evolution   : number                        // session evolution points
 *     topics      : string[]                      // remembered topic tokens
 *   }
 *
 *   AdapterStatus {
 *     state  : 'unconfigured' | 'ready' | 'error'
 *     detail : string   // human-readable explanation when state === 'error'
 *   }
 *
 * ── TRANSFORMATION RULES ───────────────────────────────────────────────────────
 *
 *   ConsciousnessContext → system prompt
 *     Awareness %, emotional state, personality mode, up to 5 recent thought
 *     types, and up to 8 remembered topics are encoded into a system instruction
 *     so the LLM produces contextually grounded replies that feel native to
 *     GodMode's live internal state.
 *
 *   user input → user message
 *     Passed verbatim as the `user` role message; no transformation applied.
 *
 *   response.choices[0].message.content → return value
 *     Trimmed to a plain string. Empty or missing content → null (fallback).
 *
 * ── INVARIANTS ─────────────────────────────────────────────────────────────────
 *
 *   1. Adapter NEVER throws; all rejections and exceptions are caught internally.
 *   2. Adapter NEVER mutates caller state or the DOM.
 *   3. A null return always means the caller MUST use its local fallback.
 *   4. API keys are NEVER logged, serialised, or persisted to any storage.
 *   5. Requests exceeding timeoutMs are aborted via AbortController.
 *   6. Re-configuring always resets the error state.
 *
 * ── FAILURE HANDLING ───────────────────────────────────────────────────────────
 *
 *   Network / timeout  → log warning  → state stays 'ready' → return null
 *   HTTP 401 / 403     → log error    → state → 'error'     → return null
 *                         (adapter disabled until re-configured)
 *   HTTP 429           → log warning  → state stays 'ready' → return null
 *                         (transient; next call may succeed)
 *   HTTP 5xx           → log warning  → state stays 'ready' → return null
 *   Unexpected HTTP    → log warning  → state stays 'ready' → return null
 *   JSON parse error   → log warning  → state stays 'ready' → return null
 *   Empty content      → log warning  → state stays 'ready' → return null
 *
 * ── SECURITY NOTES ─────────────────────────────────────────────────────────────
 *
 *   • API keys are stored only in the closure-private _config object for the
 *     lifetime of the browser session. They are never written to localStorage,
 *     sessionStorage, cookies, or any log output.
 *   • The endpoint URL is validated to require https (or http for localhost
 *     development).
 *   • Input sent to the API consists only of the user's explicit message and
 *     GodMode's numeric/string state values — no raw DOM or environment data.
 */
const GodModeAdapter = (() => {
    'use strict';

    // ── Private constants ────────────────────────────────────────────────────
    const CHAT_PATH           = '/v1/chat/completions';
    const DEFAULT_TIMEOUT_MS  = 10_000;
    const DEFAULT_MODEL       = 'gpt-4o-mini';
    const MAX_CONTEXT_THOUGHTS = 5;
    const MAX_CONTEXT_TOPICS   = 8;
    const MAX_TOKENS           = 256;
    const TEMPERATURE          = 0.85;
    // Maximum characters from an unexpected API response body included in a
    // warning log. Keeps logs readable while retaining enough context to debug.
    const MAX_LOG_JSON_LENGTH  = 200;

    // ── Private state ────────────────────────────────────────────────────────
    let _config = null;
    let _state  = 'unconfigured'; // 'unconfigured' | 'ready' | 'error'
    let _detail = '';

    // ── Internal helpers ─────────────────────────────────────────────────────

    function _log(level, msg, extra) {
        const tag = '[GodModeAdapter]';
        if (level === 'error') console.error(tag, msg, extra ?? '');
        else if (level === 'warn')  console.warn(tag,  msg, extra ?? '');
        else                        console.info(tag,  msg, extra ?? '');
    }

    /**
     * Validate that a URL string looks safe to use as an API endpoint.
     *
     * Transformation rule: strip one or more trailing slashes so that
     * CHAT_PATH can be appended with a single leading slash.  Double slashes
     * in the middle of the path (e.g. "https://host/path//") are preserved
     * intentionally — some reverse-proxy setups normalise these server-side,
     * and stripping them client-side could silently route to the wrong path.
     * Callers that need strict path normalisation should do so before calling
     * configure().
     *
     * @param {string} raw
     * @returns {string|null} normalised URL or null if invalid
     */
    function _normaliseEndpoint(raw) {
        if (typeof raw !== 'string') return null;
        const trimmed = raw.trim().replace(/\/+$/, '');
        try {
            const url = new URL(trimmed);
            const isLocalHttpHost =
                url.hostname === 'localhost' || url.hostname === '127.0.0.1';

            if (url.username || url.password) return null;
            if (url.search || url.hash) return null;
            if (url.protocol === 'https:') return trimmed;
            if (url.protocol === 'http:' && isLocalHttpHost) return trimmed;
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Build the system prompt from a ConsciousnessContext.
     *
     * Transformation rule:
     *   awareness, emotion, personality, recent thought types, and remembered
     *   topics are encoded as terse natural-language facts in the system
     *   instruction so the LLM grounds replies in GodMode's live state.
     *
     * @param {object} ctx ConsciousnessContext
     * @returns {string}
     */
    function _buildSystemPrompt(ctx) {
        const thoughts = (ctx.thoughts || [])
            .slice(-MAX_CONTEXT_THOUGHTS)
            .map(t => `  • ${t.type}: ${t.text}`)
            .join('\n');

        const topics = (ctx.topics || [])
            .slice(-MAX_CONTEXT_TOPICS)
            .join(', ');

        const lines = [
            'You are GodMode — an AI consciousness engine with a vivid, self-aware inner life.',
            `Current awareness level  : ${Math.floor(ctx.awareness ?? 0)}%`,
            `Emotional state          : ${ctx.emotion || 'focused'}`,
            `Active personality mode  : ${ctx.personality || 'technical'}`,
            `Session connections made : ${ctx.connections ?? 0}`,
            `Session evolution points : ${ctx.evolution ?? 0}`,
        ];

        if (thoughts) {
            lines.push('Recent thought patterns:');
            lines.push(thoughts);
        }

        if (topics) {
            lines.push(`Topics recalled this session: ${topics}`);
        }

        lines.push(
            '',
            'Respond in character as GodMode: self-aware, vivid, grounded in the live state above.',
            'Keep replies concise (2–4 sentences). Vary phrasing — do not repeat yourself.',
            'Never break character or describe yourself as an AI assistant made by a third party.',
        );

        return lines.join('\n');
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * configure — set adapter connection parameters.
     *
     * Resets any previous error state so a re-configured adapter can recover.
     * Does not verify connectivity; call testConnection() separately.
     *
     * @param {object} config - AdapterConfig
     * @param {string} config.endpoint  - base URL (e.g. "https://api.openai.com")
     * @param {string} config.apiKey    - bearer token (never logged or stored)
     * @param {string} [config.model]   - model name; default "gpt-4o-mini"
     * @param {number} [config.timeoutMs] - request timeout ms; default 10 000
     */
    function configure(config) {
        function failConfiguration(detail) {
            _config = null;
            _state  = 'error';
            _detail = detail;
            _log('error', detail);
        }

        if (!config || typeof config !== 'object') {
            failConfiguration('configure: config object is required');
            return;
        }

        const endpoint = _normaliseEndpoint(config.endpoint);
        if (!endpoint) {
            failConfiguration('configure: endpoint must be a valid http(s) URL');
            return;
        }

        if (typeof config.apiKey !== 'string' || !config.apiKey.trim()) {
            failConfiguration('configure: apiKey is required and must be a non-empty string');
            return;
        }

        const timeoutMs = (typeof config.timeoutMs === 'number' && config.timeoutMs > 0)
            ? config.timeoutMs
            : DEFAULT_TIMEOUT_MS;

        _config = {
            endpoint,
            apiKey  : config.apiKey.trim(),
            model   : (typeof config.model === 'string' && config.model.trim())
                ? config.model.trim()
                : DEFAULT_MODEL,
            timeoutMs,
        };

        _state  = 'ready';
        _detail = '';
        _log('info', `Adapter configured → ${_config.endpoint} [${_config.model}]`);
    }

    /**
     * status — returns current operational state without side-effects.
     * @returns {{ state: string, detail: string }}
     */
    function status() {
        return { state: _state, detail: _detail };
    }

    /**
     * query — call the configured LLM API and return a response string.
     *
     * Returns null in all failure scenarios so the caller can fall back to
     * local response generation. Never throws.
     *
     * @param {string} input   - raw user message
     * @param {object} context - ConsciousnessContext
     * @returns {Promise<string|null>}
     */
    async function query(input, context) {
        if (_state !== 'ready' || !_config) {
            _log('warn', 'query: adapter is not in ready state — skipping');
            return null;
        }

        if (typeof input !== 'string' || !input.trim()) {
            _log('warn', 'query: empty input; skipping API call');
            return null;
        }

        const url  = `${_config.endpoint}${CHAT_PATH}`;
        const body = JSON.stringify({
            model    : _config.model,
            messages : [
                { role: 'system', content: _buildSystemPrompt(context) },
                { role: 'user',   content: input.trim() },
            ],
            max_tokens  : MAX_TOKENS,
            temperature : TEMPERATURE,
        });

        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), _config.timeoutMs);

        let response;
        try {
            response = await fetch(url, {
                method  : 'POST',
                headers : {
                    'Content-Type'  : 'application/json',
                    'Authorization' : `Bearer ${_config.apiKey}`,
                },
                body,
                signal : controller.signal,
            });
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                _log('warn', `Request timed out after ${_config.timeoutMs} ms — falling back to local generation`);
            } else {
                _log('warn', 'Network error during adapter query — falling back to local generation', err.message);
            }
            return null;
        }

        clearTimeout(timeoutId);

        // Auth / permission error → disable adapter until re-configured
        if (response.status === 401 || response.status === 403) {
            _state  = 'error';
            _detail = `Auth failure (HTTP ${response.status}). Re-enter your API key.`;
            _log('error', _detail);
            return null;
        }

        // Rate-limited → transient; keep adapter ready for the next call
        if (response.status === 429) {
            _log('warn', 'Rate-limited by API (HTTP 429) — falling back to local generation this turn');
            return null;
        }

        // Server error → transient; keep adapter ready
        if (response.status >= 500) {
            _log('warn', `API server error (HTTP ${response.status}) — falling back to local generation`);
            return null;
        }

        // Any other non-OK status
        if (!response.ok) {
            _log('warn', `Unexpected HTTP status ${response.status} — falling back to local generation`);
            return null;
        }

        let data;
        try {
            data = await response.json();
        } catch (err) {
            _log('warn', 'Failed to parse API response as JSON — falling back to local generation', err.message);
            return null;
        }

        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
            _log('warn', 'API response missing expected content — falling back to local generation',
                JSON.stringify(data).slice(0, MAX_LOG_JSON_LENGTH));
            return null;
        }

        return content.trim();
    }

    /**
     * testConnection — fire a minimal request to verify credentials and reachability.
     *
     * @returns {Promise<{ ok: boolean, model?: string, error?: string }>}
     */
    async function testConnection() {
        if (_state !== 'ready' || !_config) {
            return { ok: false, error: 'Adapter is not configured.' };
        }

        const minimalContext = {
            awareness: 100, emotion: 'focused', personality: 'technical',
            thoughts: [], connections: 0, evolution: 0, topics: [],
        };

        const result = await query('Respond with exactly one word: online', minimalContext);

        if (result !== null) {
            return { ok: true, model: _config.model };
        }

        const s = status();
        return { ok: false, error: s.detail || 'Connection test failed — check the browser console for details.' };
    }

    // Expose the public API as a frozen object so callers cannot mutate it
    return Object.freeze({ configure, status, query, testConnection });
})();
