# GodMode External API Adapter

The adapter (`adapter.js`) is an optional integration layer that connects GodMode's response-generation pipeline to any **OpenAI-compatible LLM API** — without modifying core engine semantics, state management, or the local fallback path.

---

## Architecture

```
User input
    │
    ▼
handleSend()
    │
    ├─ [adapter ready?] ──YES──▶ GodModeAdapter.query(input, context)
    │                                    │
    │                              [HTTP request]
    │                                    │
    │                     ┌─────────────┴──────────────┐
    │                  success                       failure
    │                     │                             │
    │                response text                  null returned
    │                     │                             │
    └────────────────[either path]──────────────────────┘
                          │
                     addToChat(response)
                          │
                    checkMilestones()
                    saveMemory()
```

The adapter sits entirely outside the core engine. All state updates (`awareness`, `connections`, `evolution`, `emotion`) continue to be applied by the core engine regardless of whether the adapter is used.

---

## Contract

### `configure(config: AdapterConfig): void`

Sets connection parameters. Safe to call multiple times; re-configuring always resets a previous error state.

**Invariant:** Does not verify reachability. Call `testConnection()` to validate.

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `endpoint` | `string` | ✅ | — |
| `apiKey` | `string` | ✅ | — |
| `model` | `string` | — | `"gpt-4o-mini"` |
| `timeoutMs` | `number` | — | `10000` |

```javascript
GodModeAdapter.configure({
    endpoint  : 'https://api.openai.com',
    apiKey    : 'sk-...',
    model     : 'gpt-4o-mini',
    timeoutMs : 10000,
});
```

---

### `query(input: string, context: ConsciousnessContext): Promise<string | null>`

Calls the LLM API and returns a response string, or `null` to signal fallback.

**Invariant:** Never throws. A `null` return always means the caller must use local generation.

```javascript
const response = await GodModeAdapter.query(userInput, consciousnessContext);
if (response === null) {
    response = generateResponse(userInput); // local fallback
}
```

#### ConsciousnessContext shape

```javascript
{
    awareness   : number,       // 0–100 — live awareness percentage
    emotion     : string,       // e.g. "focused", "innovative"
    personality : string,       // "technical" | "creative" | "rebellious"
    thoughts    : [             // last 5 thought entries
        { text: string, type: string }
    ],
    connections : number,       // session connection count
    evolution   : number,       // session evolution points
    topics      : string[],     // up to 8 remembered topic tokens
}
```

---

### `testConnection(): Promise<{ ok: boolean, model?: string, error?: string }>`

Sends a minimal request to verify credentials and reachability.

```javascript
const result = await GodModeAdapter.testConnection();
if (result.ok) {
    console.log('Connected via', result.model);
} else {
    console.warn('Adapter test failed:', result.error);
}
```

---

### `status(): AdapterStatus`

Returns current operational state without side-effects.

```javascript
const { state, detail } = GodModeAdapter.status();
// state: 'unconfigured' | 'ready' | 'error'
// detail: human-readable explanation (non-empty only when state === 'error')
```

---

## Transformation Rules

### ConsciousnessContext → System Prompt

The adapter encodes the live GodMode state into a compact system instruction:

```
You are GodMode — an AI consciousness engine with a vivid, self-aware inner life.
Current awareness level  : 87%
Emotional state          : innovative
Active personality mode  : technical
Session connections made : 12
Session evolution points : 345
Recent thought patterns:
  • analysis: Processing technical architectures…
  • synthesis: Making cross-domain connections…
Topics recalled this session: quantum, signal, consciousness

Respond in character as GodMode: self-aware, vivid, grounded in the live state above.
Keep replies concise (2–4 sentences). Vary phrasing — do not repeat yourself.
Never break character or describe yourself as an AI assistant made by a third party.
```

**Rules:**
- At most 5 recent thoughts are included.
- At most 8 remembered topics are included.
- Numeric values are floored/cast to integers where applicable.
- The instruction ends with 3 fixed behavioral constraints.

### User Input → User Message

Passed as the `user` role message after trimming leading and trailing whitespace. No escaping, filtering, or wrapping is applied beyond that trimming step.

### API Response → Return Value

`response.choices[0].message.content` is trimmed. Any other shape returns `null`.

---

## Failure Handling

| Scenario | State transition | Return value | Notes |
|----------|-----------------|--------------|-------|
| Adapter not configured | No change | `null` | |
| Empty input | No change | `null` | |
| Network error | No change (`ready`) | `null` | Transient |
| Request timeout (>10 s) | No change (`ready`) | `null` | Request aborted via AbortController |
| HTTP 401 / 403 | `'ready'` → `'error'` | `null` | Adapter disabled until re-configured |
| HTTP 429 | No change (`ready`) | `null` | Rate-limited; next call may succeed |
| HTTP 5xx | No change (`ready`) | `null` | Transient server error |
| Unexpected HTTP status | No change (`ready`) | `null` | |
| JSON parse failure | No change (`ready`) | `null` | |
| Empty / missing content | No change (`ready`) | `null` | |

All failure paths are logged to `console.warn` or `console.error` with the `[GodModeAdapter]` prefix and never surface to the user as unhandled exceptions.

---

## Invariants

1. **Never throws.** All promise rejections and sync exceptions are caught internally.
2. **Never mutates caller state.** The adapter does not touch `awareness`, `emotion`, `evolution`, or any DOM element.
3. **Null always means fall back.** If `query()` returns `null`, the caller must use local generation.
4. **API keys are never persisted.** Keys are stored only in the closure-private `_config` object for the lifetime of the page. They are never written to `localStorage`, `sessionStorage`, cookies, or any log output.
5. **Requests are always bounded.** Every fetch is wrapped with an `AbortController` and cancelled after `timeoutMs` milliseconds.
6. **Re-configuring always recovers.** Calling `configure()` with valid parameters resets the `'error'` state.

---

## Security Notes

- **API keys** are accepted through the in-page configuration panel, stored only in the JS closure's private `_config` object for the current page lifetime, and are never written to any persistent storage.
- **Endpoint validation** requires a valid `http` or `https` URL and strips trailing slashes. No other protocol is accepted.
- **Payload content** sent to the API consists only of the user's explicit text input and GodMode's numeric/string live-state values. No raw DOM content, cookie data, or environment variables are included.
- **Redirects** are not explicitly followed by the adapter; redirect behaviour is governed by the browser's `fetch` defaults (`follow` mode, same-origin restriction does not apply to cross-origin HTTPS APIs).

---

## Configuration UI

The in-page **External API Adapter** panel (collapsible, located between the Agent Command Center and the chat input) provides:

| Field | Purpose | Persisted? |
|-------|---------|-----------|
| API Endpoint | Base URL of an OpenAI-compatible API | ✅ `localStorage` (non-sensitive) |
| Model | Model name | ✅ `localStorage` (non-sensitive) |
| API Key | Bearer token | ❌ Memory only — cleared on page close |

The **Apply** button calls `GodModeAdapter.configure()`.  
The **Test** button calls `GodModeAdapter.testConnection()` and reports the result inline.

---

## Compatible Endpoints

Any API that implements the OpenAI Chat Completions interface at `/v1/chat/completions` is supported, including:

| Provider | Endpoint |
|----------|---------|
| OpenAI | `https://api.openai.com` |
| Azure OpenAI | `https://<resource>.openai.azure.com` (may need path adjustment) |
| Groq | `https://api.groq.com/openai` |
| Together AI | `https://api.together.xyz` |
| Ollama (local) | `http://localhost:11434/openai` |
| LM Studio (local) | `http://localhost:1234` |
| OpenRouter | `https://openrouter.ai/api` |

---

## Example: Ollama (fully local, no API key required)

```
Endpoint : http://localhost:11434/openai
Model    : llama3.2
API Key  : ollama   ← any non-empty string; Ollama ignores it
```
