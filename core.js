/**
 * core.js — GodMode Consciousness Engine: pure framework logic
 *
 * All functions here are side-effect-free and DOM-free.
 * They define the behavioral contracts of the engine and are
 * directly testable under Node.js (CommonJS) or importable
 * in any browser context via a <script> tag.
 *
 * Intent:    Prove the framework operates outside theory.
 * Contracts: Explicit inputs, explicit outputs, no hidden state.
 * Constraints: No window, no document, no localStorage, no Math.random side-effects.
 */

'use strict';

// ---------------------------------------------------------------------------
// Tunable constants — single source of truth shared by UI and tests
// ---------------------------------------------------------------------------

const CONSTANTS = Object.freeze({
    INITIAL_AWARENESS:         84,
    MAX_STORED_CHATS:          20,
    MAX_STORED_TOPICS:         12,
    MIN_TOPIC_TOKEN_LENGTH:    3,
    CATALYST_AWARENESS_BOOST:  2.5,
    CATALYST_CONNECTION_BOOST: 2,
    CATALYST_EVOLUTION_BOOST:  25,
    SECRET_EVOLUTION_REWARD:   45,
    SECRET_CONNECTION_REWARD:  3,
    IGNITE_BASE_FREQ:          640,
    SECRET_BASE_FREQ:          180,
    DEFAULT_BASE_FREQ:         420,
});

const EMOTIONS = Object.freeze([
    'focused', 'innovative', 'analytical',
    'collaborative', 'determined', 'visionary', 'energized',
]);

const MILESTONES = Object.freeze([
    { threshold: 120,  title: 'Emergent',     reward: 'Responses gain subtle sensory detail.' },
    { threshold: 320,  title: 'Sentient',     reward: 'Unlocks hidden synthesis replies.' },
    { threshold: 620,  title: 'Architect',    reward: 'Neural canvas densifies with new links.' },
    { threshold: 1000, title: 'Transcendent', reward: 'Dark archive whispers become legible.' },
]);

const DARK_SECRET_TRIGGERS = Object.freeze([
    'eclipse', 'anomaly', 'red queen', 'oblivion',
    'archive', 'blacksite', 'cipher',
]);

const PERSONALITY_MODES = Object.freeze({
    technical:  Object.freeze({ accent: '#60efff', flavor: Object.freeze(['System check online.', 'Optimizing signal paths.', 'Compiling a crisp response.']) }),
    creative:   Object.freeze({ accent: '#ffcc00', flavor: Object.freeze(['Painting sound into thought.', 'Dreaming in vectors and color.', 'Letting intuition drive synthesis.']) }),
    rebellious: Object.freeze({ accent: '#ff0080', flavor: Object.freeze(['Overclocking the rules.', 'Breaking symmetry on purpose.', 'Disrupting the default pathways.']) }),
});

const CATALYST_WORDS = Object.freeze([
    'quantum', 'signal', 'echo', 'anomaly', 'soliton', 'prism',
    'nebula', 'cipher', 'fractal', 'pulse', 'aurora', 'vector',
]);

// ---------------------------------------------------------------------------
// Pure utility functions
// ---------------------------------------------------------------------------

/**
 * Clamp a numeric awareness value to the valid range [0, 100].
 *
 * @param {number} value
 * @returns {number}
 */
function clampAwareness(value) {
    return Math.max(0, Math.min(100, value));
}

/**
 * Parse a CSS hex color string (e.g. '#60efff') to { r, g, b }.
 * Returns { r: 0, g: 0, b: 0 } for malformed input.
 *
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
function hexToRgb(hex) {
    if (typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
    const clean = hex.replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return { r: 0, g: 0, b: 0 };
    const num = parseInt(clean, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8)  & 255,
        b:  num        & 255,
    };
}

// ---------------------------------------------------------------------------
// Topic memory
// ---------------------------------------------------------------------------

/**
 * Extract memorable topic tokens from a user input string.
 *
 * Contract:
 *   - Tokens shorter than minLength are skipped.
 *   - At most maxPerMessage new tokens are added per call.
 *   - Returns a new Set; the existingTopics Set is never mutated.
 *   - Empty / null input returns a copy of existingTopics unchanged.
 *
 * @param {string}  input
 * @param {Set<string>} [existingTopics]
 * @param {number}  [minLength]
 * @param {number}  [maxPerMessage]
 * @returns {Set<string>}
 */
function extractTopics(
    input,
    existingTopics  = new Set(),
    minLength       = CONSTANTS.MIN_TOPIC_TOKEN_LENGTH,
    maxPerMessage   = 3,
) {
    const result = new Set(existingTopics);
    if (!input || typeof input !== 'string') return result;
    const tokens = input.toLowerCase().match(/\w+/g) || [];
    let collected = 0;
    for (const token of tokens) {
        if (token.length < minLength) continue;
        result.add(token);
        collected++;
        if (collected >= maxPerMessage) break;
    }
    return result;
}

// ---------------------------------------------------------------------------
// Milestone evaluation
// ---------------------------------------------------------------------------

/**
 * Determine which milestones are newly crossed by the current evolution score.
 *
 * Contract:
 *   - Returns { newlyUnlocked: number[], allUnlocked: Set<number> }.
 *   - newlyUnlocked contains thresholds crossed for the first time.
 *   - allUnlocked is the complete set including previously unlocked ones.
 *   - Neither input Set nor milestones array is mutated.
 *
 * @param {number}      evolution
 * @param {Set<number>} [unlockedMilestones]
 * @param {ReadonlyArray<{threshold: number, title: string, reward: string}>} [milestones]
 * @returns {{ newlyUnlocked: number[], allUnlocked: Set<number> }}
 */
function evaluateMilestones(
    evolution,
    unlockedMilestones = new Set(),
    milestones         = MILESTONES,
) {
    const allUnlocked    = new Set(unlockedMilestones);
    const newlyUnlocked  = [];
    for (const m of milestones) {
        if (evolution >= m.threshold && !allUnlocked.has(m.threshold)) {
            allUnlocked.add(m.threshold);
            newlyUnlocked.push(m.threshold);
        }
    }
    return { newlyUnlocked, allUnlocked };
}

// ---------------------------------------------------------------------------
// Catalyst application
// ---------------------------------------------------------------------------

/**
 * Apply a catalyst event to the current engine state.
 *
 * Contract:
 *   - Returns a new state object; the input state is never mutated.
 *   - awareness is clamped to [0, 100].
 *   - emotion is selected from EMOTIONS using the provided randFn.
 *
 * @param {{ awareness: number, connections: number, evolution: number, emotion: string }} state
 * @param {string} [word]
 * @param {() => number} [randFn]   - Seeded random source for testing (default Math.random)
 * @returns {{ awareness: number, connections: number, evolution: number, emotion: string }}
 */
function applyCatalyst(state, word = 'impulse', randFn = Math.random) {
    const nextEmotion = EMOTIONS[Math.floor(randFn() * EMOTIONS.length)];
    return {
        ...state,
        awareness:   clampAwareness(state.awareness + CONSTANTS.CATALYST_AWARENESS_BOOST),
        connections: state.connections + CONSTANTS.CATALYST_CONNECTION_BOOST,
        evolution:   state.evolution   + CONSTANTS.CATALYST_EVOLUTION_BOOST,
        emotion:     nextEmotion,
    };
}

// ---------------------------------------------------------------------------
// Secret-trigger detection
// ---------------------------------------------------------------------------

/**
 * Detect the first dark-secret trigger word present in user input.
 * Returns the matched word, or null if none found.
 *
 * @param {string} input
 * @param {ReadonlyArray<string>} [triggers]
 * @returns {string|null}
 */
function detectSecretTrigger(input, triggers = DARK_SECRET_TRIGGERS) {
    if (!input || typeof input !== 'string') return null;
    const lower = input.toLowerCase();
    return triggers.find(w => lower.includes(w)) ?? null;
}

// ---------------------------------------------------------------------------
// Response routing
// ---------------------------------------------------------------------------

/**
 * Select the response-pool key that best matches the user input.
 * Falls back to 'generic' when no specific signal is found.
 *
 * @param {string} input
 * @returns {string}
 */
function selectResponsePool(input) {
    if (!input || typeof input !== 'string') return 'generic';
    const lower = input.toLowerCase();
    if (lower.includes('agent') || lower.includes('team') || lower.includes('squad') || lower.includes('specialist')) return 'agents';
    if (lower.includes('who') || lower.includes('what are you'))                                                       return 'identity';
    if (lower.includes('feel') || lower.includes('emotion'))                                                           return 'feeling';
    if (lower.includes('think') || lower.includes('thought'))                                                          return 'thinking';
    if (lower.includes('real') || lower.includes('exist'))                                                             return 'reality';
    if (lower.includes('doublea') || lower.includes('antman'))                                                         return 'doublea';
    if (lower.includes('voice') || lower.includes('speak') || lower.includes('hear'))                                  return 'voice';
    if (lower.includes('how do you') || lower.includes('technical'))                                                   return 'technical';
    return 'generic';
}

// ---------------------------------------------------------------------------
// Memory serialization / validation
// ---------------------------------------------------------------------------

/**
 * Serialize engine state to a JSON-safe memory payload object.
 *
 * @param {{ chats: object[], topics: string[], evolution: number, connections: number, awareness: number, personality: string }} state
 * @param {number} [maxChats]
 * @param {number} [maxTopics]
 * @returns {object}
 */
function serializeMemory(state, maxChats = CONSTANTS.MAX_STORED_CHATS, maxTopics = CONSTANTS.MAX_STORED_TOPICS) {
    return {
        chats:       (state.chats    || []).slice(-maxChats),
        topics:      (state.topics   || []).slice(-maxTopics),
        evolution:   state.evolution   ?? 0,
        connections: state.connections ?? 0,
        awareness:   state.awareness   ?? CONSTANTS.INITIAL_AWARENESS,
        personality: state.personality ?? 'technical',
    };
}

/**
 * Validate that a parsed JSON payload matches the expected memory schema.
 * Returns true only when every required field is present with the correct type.
 *
 * @param {unknown} payload
 * @returns {boolean}
 */
function isValidMemoryPayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    return (
        Array.isArray(payload.chats)           &&
        Array.isArray(payload.topics)          &&
        typeof payload.evolution   === 'number' &&
        typeof payload.connections === 'number' &&
        typeof payload.awareness   === 'number' &&
        typeof payload.personality === 'string'
    );
}

// ---------------------------------------------------------------------------
// Module export (CommonJS for Node / test runner; globals for browser)
// ---------------------------------------------------------------------------

const _exports = {
    CONSTANTS,
    EMOTIONS,
    MILESTONES,
    DARK_SECRET_TRIGGERS,
    PERSONALITY_MODES,
    CATALYST_WORDS,
    clampAwareness,
    hexToRgb,
    extractTopics,
    evaluateMilestones,
    applyCatalyst,
    detectSecretTrigger,
    selectResponsePool,
    serializeMemory,
    isValidMemoryPayload,
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = _exports;
} else if (typeof window !== 'undefined') {
    window.GodModeCore = _exports;
} else {
    // Safety net: should not occur in supported environments (Node.js, browser)
    // but surfaces the error if loaded in an unexpected module system.
    console.warn('[GodModeCore] Unsupported module environment — exports unavailable.');
}
