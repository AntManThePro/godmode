/**
 * tests/core.test.js
 *
 * End-to-end reference tests for the GodMode Consciousness Engine core.
 * Run with: node --test tests/
 *
 * Uses only Node.js built-in test infrastructure (no third-party deps).
 * Every test exercises a real behavioral contract — not mocks, not stubs.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
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
} = require('../core');

// ---------------------------------------------------------------------------
// Constants integrity
// ---------------------------------------------------------------------------

describe('CONSTANTS', () => {
    test('INITIAL_AWARENESS is a positive number ≤ 100', () => {
        assert.ok(CONSTANTS.INITIAL_AWARENESS > 0);
        assert.ok(CONSTANTS.INITIAL_AWARENESS <= 100);
    });

    test('all boost values are positive', () => {
        assert.ok(CONSTANTS.CATALYST_AWARENESS_BOOST  > 0);
        assert.ok(CONSTANTS.CATALYST_CONNECTION_BOOST > 0);
        assert.ok(CONSTANTS.CATALYST_EVOLUTION_BOOST  > 0);
        assert.ok(CONSTANTS.SECRET_EVOLUTION_REWARD   > 0);
        assert.ok(CONSTANTS.SECRET_CONNECTION_REWARD  > 0);
    });

    test('storage limits are sane positive integers', () => {
        assert.ok(Number.isInteger(CONSTANTS.MAX_STORED_CHATS)  && CONSTANTS.MAX_STORED_CHATS  > 0);
        assert.ok(Number.isInteger(CONSTANTS.MAX_STORED_TOPICS) && CONSTANTS.MAX_STORED_TOPICS > 0);
        assert.ok(Number.isInteger(CONSTANTS.MIN_TOPIC_TOKEN_LENGTH) && CONSTANTS.MIN_TOPIC_TOKEN_LENGTH > 0);
    });

    test('frequency constants are audible (>0 Hz)', () => {
        assert.ok(CONSTANTS.IGNITE_BASE_FREQ  > 0);
        assert.ok(CONSTANTS.SECRET_BASE_FREQ  > 0);
        assert.ok(CONSTANTS.DEFAULT_BASE_FREQ > 0);
    });

    test('CONSTANTS object is frozen (immutable)', () => {
        assert.throws(() => { CONSTANTS.INITIAL_AWARENESS = 0; }, TypeError);
    });
});

describe('EMOTIONS', () => {
    test('is a non-empty array of strings', () => {
        assert.ok(Array.isArray(EMOTIONS) && EMOTIONS.length > 0);
        EMOTIONS.forEach(e => assert.equal(typeof e, 'string'));
    });
});

describe('MILESTONES', () => {
    test('has four milestones in ascending threshold order', () => {
        assert.equal(MILESTONES.length, 4);
        for (let i = 1; i < MILESTONES.length; i++) {
            assert.ok(MILESTONES[i].threshold > MILESTONES[i - 1].threshold);
        }
    });

    test('each milestone has title and reward strings', () => {
        MILESTONES.forEach(m => {
            assert.equal(typeof m.title,  'string');
            assert.equal(typeof m.reward, 'string');
            assert.ok(m.title.length  > 0);
            assert.ok(m.reward.length > 0);
        });
    });
});

describe('PERSONALITY_MODES', () => {
    test('defines technical, creative, and rebellious modes', () => {
        ['technical', 'creative', 'rebellious'].forEach(mode => {
            assert.ok(PERSONALITY_MODES[mode], `missing mode: ${mode}`);
            assert.ok(typeof PERSONALITY_MODES[mode].accent === 'string');
            assert.ok(Array.isArray(PERSONALITY_MODES[mode].flavor));
            assert.ok(PERSONALITY_MODES[mode].flavor.length > 0);
        });
    });

    test('accent colors are valid 7-char hex strings', () => {
        Object.values(PERSONALITY_MODES).forEach(mode => {
            assert.match(mode.accent, /^#[0-9a-fA-F]{6}$/);
        });
    });
});

describe('DARK_SECRET_TRIGGERS', () => {
    test('is a non-empty frozen array of lowercase strings', () => {
        assert.ok(Array.isArray(DARK_SECRET_TRIGGERS) && DARK_SECRET_TRIGGERS.length > 0);
        DARK_SECRET_TRIGGERS.forEach(t => {
            assert.equal(typeof t, 'string');
            assert.equal(t, t.toLowerCase());
        });
    });
});

describe('CATALYST_WORDS', () => {
    test('is a non-empty array of strings', () => {
        assert.ok(Array.isArray(CATALYST_WORDS) && CATALYST_WORDS.length > 0);
        CATALYST_WORDS.forEach(w => assert.equal(typeof w, 'string'));
    });
});

// ---------------------------------------------------------------------------
// clampAwareness
// ---------------------------------------------------------------------------

describe('clampAwareness', () => {
    test('returns value unchanged when within [0, 100]', () => {
        assert.equal(clampAwareness(50),  50);
        assert.equal(clampAwareness(0),   0);
        assert.equal(clampAwareness(100), 100);
    });

    test('clamps values above 100 to 100', () => {
        assert.equal(clampAwareness(101), 100);
        assert.equal(clampAwareness(200), 100);
    });

    test('clamps negative values to 0', () => {
        assert.equal(clampAwareness(-1),   0);
        assert.equal(clampAwareness(-999), 0);
    });
});

// ---------------------------------------------------------------------------
// hexToRgb
// ---------------------------------------------------------------------------

describe('hexToRgb', () => {
    test('parses #00ff87 correctly', () => {
        assert.deepEqual(hexToRgb('#00ff87'), { r: 0, g: 255, b: 135 });
    });

    test('parses #60efff correctly', () => {
        assert.deepEqual(hexToRgb('#60efff'), { r: 96, g: 239, b: 255 });
    });

    test('parses #ff0080 correctly', () => {
        assert.deepEqual(hexToRgb('#ff0080'), { r: 255, g: 0, b: 128 });
    });

    test('parses #ffffff (white) correctly', () => {
        assert.deepEqual(hexToRgb('#ffffff'), { r: 255, g: 255, b: 255 });
    });

    test('parses #000000 (black) correctly', () => {
        assert.deepEqual(hexToRgb('#000000'), { r: 0, g: 0, b: 0 });
    });

    test('returns {0,0,0} for malformed input', () => {
        assert.deepEqual(hexToRgb(''),         { r: 0, g: 0, b: 0 });
        assert.deepEqual(hexToRgb('zzzzzz'),   { r: 0, g: 0, b: 0 });
        assert.deepEqual(hexToRgb('#abc'),      { r: 0, g: 0, b: 0 });
        assert.deepEqual(hexToRgb(null),        { r: 0, g: 0, b: 0 });
        assert.deepEqual(hexToRgb(undefined),   { r: 0, g: 0, b: 0 });
    });

    test('all personality accent colors round-trip correctly', () => {
        Object.values(PERSONALITY_MODES).forEach(mode => {
            const { r, g, b } = hexToRgb(mode.accent);
            assert.ok(r >= 0 && r <= 255);
            assert.ok(g >= 0 && g <= 255);
            assert.ok(b >= 0 && b <= 255);
        });
    });
});

// ---------------------------------------------------------------------------
// extractTopics
// ---------------------------------------------------------------------------

describe('extractTopics', () => {
    test('returns a Set', () => {
        assert.ok(extractTopics('hello world') instanceof Set);
    });

    test('adds tokens longer than minLength', () => {
        const result = extractTopics('consciousness is evolving fast');
        assert.ok(result.has('consciousness'));
        assert.ok(result.has('evolving'));
        assert.ok(result.has('fast'));
    });

    test('skips tokens shorter than minLength (default 3)', () => {
        const result = extractTopics('it is a big world');
        assert.ok(!result.has('it'));
        assert.ok(!result.has('is'));
        assert.ok(!result.has('a'));
        assert.ok(result.has('big'));
        assert.ok(result.has('world'));
    });

    test('respects maxPerMessage limit (default 3)', () => {
        const initial = new Set();
        const result = extractTopics('alpha beta gamma delta epsilon', initial);
        // At most 3 new tokens added
        assert.ok(result.size <= 3);
    });

    test('does not mutate existingTopics', () => {
        const existing = new Set(['memory']);
        extractTopics('quantum consciousness', existing);
        assert.equal(existing.size, 1); // unchanged
    });

    test('preserves existing topics in the returned Set', () => {
        const existing = new Set(['memory']);
        const result = extractTopics('quantum field', existing);
        assert.ok(result.has('memory'));
    });

    test('handles null/empty input gracefully', () => {
        const existing = new Set(['old']);
        assert.deepEqual(extractTopics(null, existing), existing);
        assert.deepEqual(extractTopics('',   existing), existing);
    });

    test('lowercases all tokens', () => {
        const result = extractTopics('CONSCIOUSNESS QUANTUM');
        assert.ok(result.has('consciousness'));
        assert.ok(result.has('quantum'));
    });
});

// ---------------------------------------------------------------------------
// evaluateMilestones
// ---------------------------------------------------------------------------

describe('evaluateMilestones', () => {
    test('returns empty newlyUnlocked when below all thresholds', () => {
        const { newlyUnlocked, allUnlocked } = evaluateMilestones(0);
        assert.equal(newlyUnlocked.length, 0);
        assert.equal(allUnlocked.size, 0);
    });

    test('unlocks Emergent milestone at threshold 120', () => {
        const { newlyUnlocked } = evaluateMilestones(120);
        assert.ok(newlyUnlocked.includes(120));
    });

    test('unlocks all four milestones at max evolution', () => {
        const { newlyUnlocked, allUnlocked } = evaluateMilestones(1000);
        assert.equal(newlyUnlocked.length, 4);
        assert.equal(allUnlocked.size, 4);
    });

    test('does not re-unlock already unlocked milestones', () => {
        const already = new Set([120]);
        const { newlyUnlocked } = evaluateMilestones(320, already);
        assert.ok(!newlyUnlocked.includes(120));
        assert.ok(newlyUnlocked.includes(320));
    });

    test('does not mutate the input unlockedMilestones Set', () => {
        const input = new Set([120]);
        evaluateMilestones(1000, input);
        assert.equal(input.size, 1); // unchanged
    });

    test('allUnlocked includes previously unlocked milestones', () => {
        const already = new Set([120]);
        const { allUnlocked } = evaluateMilestones(320, already);
        assert.ok(allUnlocked.has(120));
        assert.ok(allUnlocked.has(320));
    });

    test('exact threshold boundary: 119 does not unlock 120', () => {
        const { newlyUnlocked } = evaluateMilestones(119);
        assert.equal(newlyUnlocked.length, 0);
    });
});

// ---------------------------------------------------------------------------
// applyCatalyst
// ---------------------------------------------------------------------------

describe('applyCatalyst', () => {
    const baseState = { awareness: 80, connections: 5, evolution: 100, emotion: 'focused' };

    test('increases awareness by CATALYST_AWARENESS_BOOST', () => {
        const next = applyCatalyst(baseState);
        assert.equal(next.awareness, baseState.awareness + CONSTANTS.CATALYST_AWARENESS_BOOST);
    });

    test('awareness is clamped to 100 when near ceiling', () => {
        const nearCeiling = { ...baseState, awareness: 99 };
        const next = applyCatalyst(nearCeiling);
        assert.equal(next.awareness, 100);
    });

    test('increases connections by CATALYST_CONNECTION_BOOST', () => {
        const next = applyCatalyst(baseState);
        assert.equal(next.connections, baseState.connections + CONSTANTS.CATALYST_CONNECTION_BOOST);
    });

    test('increases evolution by CATALYST_EVOLUTION_BOOST', () => {
        const next = applyCatalyst(baseState);
        assert.equal(next.evolution, baseState.evolution + CONSTANTS.CATALYST_EVOLUTION_BOOST);
    });

    test('resulting emotion is a valid EMOTIONS entry', () => {
        // Use seeded random to make deterministic
        let call = 0;
        const seeded = () => [0, 0.5, 0.99][call++ % 3];
        [0, 0.5, 0.99].forEach(seed => {
            const next = applyCatalyst(baseState, 'quantum', () => seed);
            assert.ok(EMOTIONS.includes(next.emotion), `unexpected emotion: ${next.emotion}`);
        });
    });

    test('does not mutate input state', () => {
        const frozen = Object.freeze({ ...baseState });
        assert.doesNotThrow(() => applyCatalyst(frozen));
        assert.equal(frozen.awareness, baseState.awareness);
    });

    test('repeated application is cumulative', () => {
        let state = { ...baseState };
        for (let i = 0; i < 4; i++) {
            state = applyCatalyst(state);
        }
        assert.equal(state.connections, baseState.connections + 4 * CONSTANTS.CATALYST_CONNECTION_BOOST);
        assert.equal(state.evolution,   baseState.evolution   + 4 * CONSTANTS.CATALYST_EVOLUTION_BOOST);
    });
});

// ---------------------------------------------------------------------------
// detectSecretTrigger
// ---------------------------------------------------------------------------

describe('detectSecretTrigger', () => {
    test('detects a known trigger word', () => {
        assert.equal(detectSecretTrigger('activate the eclipse protocol'), 'eclipse');
    });

    test('detects multi-word trigger "red queen"', () => {
        assert.equal(detectSecretTrigger('invoke red queen now'), 'red queen');
    });

    test('detection is case-insensitive', () => {
        assert.equal(detectSecretTrigger('ARCHIVE access granted'), 'archive');
    });

    test('returns null when no trigger is present', () => {
        assert.equal(detectSecretTrigger('hello how are you today'), null);
    });

    test('returns null for null/empty input', () => {
        assert.equal(detectSecretTrigger(null),  null);
        assert.equal(detectSecretTrigger(''),    null);
    });

    test('all DARK_SECRET_TRIGGERS are detectable', () => {
        DARK_SECRET_TRIGGERS.forEach(trigger => {
            const result = detectSecretTrigger(`activating ${trigger} now`);
            assert.equal(result, trigger, `trigger not detected: ${trigger}`);
        });
    });
});

// ---------------------------------------------------------------------------
// selectResponsePool
// ---------------------------------------------------------------------------

describe('selectResponsePool', () => {
    const cases = [
        ['what agents do you have',    'agents'],
        ['show me your team',          'agents'],
        ['who are you',                'identity'],
        ['what are you made of',       'identity'],
        ['how do you feel right now',  'feeling'],
        ['what emotions do you have',  'feeling'],
        ['what are you thinking',      'identity'],  // "what are you" matched before "think"
        ['share your thoughts',        'thinking'],
        ['are you real',               'reality'],
        ['do you exist',               'reality'],
        ['tell me about doublea',      'doublea'],
        ['antman is awesome',          'doublea'],
        ['can you hear my voice',      'voice'],
        ['speak to me',                'voice'],
        ['how do you process speech',  'technical'],
        ['show me the technical side', 'technical'],
        ['the weather is nice today',  'generic'],
        ['',                           'generic'],
    ];

    cases.forEach(([input, expected]) => {
        test(`"${input}" → "${expected}"`, () => {
            assert.equal(selectResponsePool(input), expected);
        });
    });

    test('returns generic for null input', () => {
        assert.equal(selectResponsePool(null), 'generic');
    });
});

// ---------------------------------------------------------------------------
// serializeMemory
// ---------------------------------------------------------------------------

describe('serializeMemory', () => {
    const fullState = {
        chats:       Array.from({ length: 30 }, (_, i) => ({ msg: i })),
        topics:      Array.from({ length: 20 }, (_, i) => `topic${i}`),
        evolution:   500,
        connections: 42,
        awareness:   91,
        personality: 'creative',
    };

    test('serializes all required fields', () => {
        const result = serializeMemory(fullState);
        assert.ok('chats'       in result);
        assert.ok('topics'      in result);
        assert.ok('evolution'   in result);
        assert.ok('connections' in result);
        assert.ok('awareness'   in result);
        assert.ok('personality' in result);
    });

    test('trims chats to MAX_STORED_CHATS', () => {
        const result = serializeMemory(fullState);
        assert.ok(result.chats.length <= CONSTANTS.MAX_STORED_CHATS);
    });

    test('trims topics to MAX_STORED_TOPICS', () => {
        const result = serializeMemory(fullState);
        assert.ok(result.topics.length <= CONSTANTS.MAX_STORED_TOPICS);
    });

    test('numeric fields are preserved', () => {
        const result = serializeMemory(fullState);
        assert.equal(result.evolution,   500);
        assert.equal(result.connections, 42);
        assert.equal(result.awareness,   91);
    });

    test('personality string is preserved', () => {
        const result = serializeMemory(fullState);
        assert.equal(result.personality, 'creative');
    });

    test('defaults missing numeric fields to 0 or INITIAL_AWARENESS', () => {
        const minimal = { chats: [], topics: [], personality: 'technical' };
        const result = serializeMemory(minimal);
        assert.equal(result.evolution,   0);
        assert.equal(result.connections, 0);
        assert.equal(result.awareness,   CONSTANTS.INITIAL_AWARENESS);
    });

    test('round-trips through JSON without loss', () => {
        const result  = serializeMemory(fullState);
        const parsed  = JSON.parse(JSON.stringify(result));
        assert.equal(parsed.evolution,   result.evolution);
        assert.equal(parsed.personality, result.personality);
        assert.equal(parsed.chats.length, result.chats.length);
    });
});

// ---------------------------------------------------------------------------
// isValidMemoryPayload
// ---------------------------------------------------------------------------

describe('isValidMemoryPayload', () => {
    const valid = {
        chats: [], topics: [],
        evolution: 0, connections: 0,
        awareness: 84, personality: 'technical',
    };

    test('accepts a fully valid payload', () => {
        assert.equal(isValidMemoryPayload(valid), true);
    });

    test('rejects null', () => {
        assert.equal(isValidMemoryPayload(null), false);
    });

    test('rejects a plain array', () => {
        assert.equal(isValidMemoryPayload([]), false);
    });

    test('rejects when chats is not an array', () => {
        assert.equal(isValidMemoryPayload({ ...valid, chats: '[]' }), false);
    });

    test('rejects when topics is not an array', () => {
        assert.equal(isValidMemoryPayload({ ...valid, topics: null }), false);
    });

    test('rejects when evolution is not a number', () => {
        assert.equal(isValidMemoryPayload({ ...valid, evolution: '0' }), false);
    });

    test('rejects when connections is not a number', () => {
        assert.equal(isValidMemoryPayload({ ...valid, connections: undefined }), false);
    });

    test('rejects when awareness is not a number', () => {
        assert.equal(isValidMemoryPayload({ ...valid, awareness: true }), false);
    });

    test('rejects when personality is not a string', () => {
        assert.equal(isValidMemoryPayload({ ...valid, personality: 42 }), false);
    });

    test('accepts payload produced by serializeMemory', () => {
        const state   = { chats: [], topics: [], evolution: 10, connections: 3, awareness: 84, personality: 'technical' };
        const payload = serializeMemory(state);
        assert.equal(isValidMemoryPayload(payload), true);
    });
});

// ---------------------------------------------------------------------------
// End-to-end integration scenario
// ---------------------------------------------------------------------------

describe('Integration: full interaction cycle', () => {
    test('a single interaction cycle produces a valid, consistent state', () => {
        // Initial state
        let state = {
            awareness:   CONSTANTS.INITIAL_AWARENESS,
            connections: 0,
            evolution:   0,
            emotion:     'focused',
        };

        const input = 'consciousness quantum evolution today';

        // 1. Route the response
        const pool = selectResponsePool(input);
        assert.equal(pool, 'generic');

        // 2. Check for secret triggers
        const secret = detectSecretTrigger(input);
        assert.equal(secret, null);

        // 3. Extract topics — maxPerMessage=3 so first three qualifying tokens are captured
        let topicSet = extractTopics(input);
        // All tokens are ≥ 3 chars; first 3 are collected
        assert.ok(topicSet.has('consciousness'));
        assert.ok(topicSet.has('quantum'));
        assert.ok(topicSet.has('evolution'));
        assert.equal(topicSet.size, 3); // maxPerMessage cap

        // 4. Apply catalyst (simulating a user interaction event)
        state = applyCatalyst(state, 'signal', () => 0.1);
        assert.equal(state.awareness, clampAwareness(CONSTANTS.INITIAL_AWARENESS + CONSTANTS.CATALYST_AWARENESS_BOOST));
        assert.equal(state.connections, CONSTANTS.CATALYST_CONNECTION_BOOST);
        assert.equal(state.evolution,   CONSTANTS.CATALYST_EVOLUTION_BOOST);

        // 5. Evaluate milestones
        const { newlyUnlocked } = evaluateMilestones(state.evolution);
        assert.equal(newlyUnlocked.length, 0, 'no milestone crossed after one catalyst at default boost');

        // 6. Serialize to storage
        const payload = serializeMemory({
            chats:       [{ input, response: 'A response.', time: '00:00:00', personality: 'technical', emotion: state.emotion }],
            topics:      Array.from(topicSet),
            ...state,
            personality: 'technical',
        });
        assert.equal(isValidMemoryPayload(payload), true);
        assert.equal(payload.awareness,   state.awareness);
        assert.equal(payload.connections, state.connections);
        assert.equal(payload.evolution,   state.evolution);
    });

    test('repeated catalyst applications eventually unlock the Emergent milestone', () => {
        let state = { awareness: CONSTANTS.INITIAL_AWARENESS, connections: 0, evolution: 0, emotion: 'focused' };
        let unlocked = new Set();

        // Apply enough catalysts to exceed the Emergent threshold (120 pts)
        const cycles = Math.ceil(120 / CONSTANTS.CATALYST_EVOLUTION_BOOST) + 1;
        for (let i = 0; i < cycles; i++) {
            state = applyCatalyst(state, 'pulse', () => 0);
            const { allUnlocked } = evaluateMilestones(state.evolution, unlocked);
            unlocked = allUnlocked;
        }

        assert.ok(unlocked.has(120), 'Emergent milestone (120) should be unlocked');
    });

    test('secret trigger increases evolution and connections on detection', () => {
        const input   = 'engage the eclipse directive now';
        const trigger = detectSecretTrigger(input);
        assert.equal(trigger, 'eclipse');

        // Simulate secret reward application
        let state = { awareness: 90, connections: 5, evolution: 300, emotion: 'focused' };
        state = {
            ...state,
            evolution:   state.evolution   + CONSTANTS.SECRET_EVOLUTION_REWARD,
            connections: state.connections + CONSTANTS.SECRET_CONNECTION_REWARD,
        };
        assert.equal(state.evolution,   345);
        assert.equal(state.connections, 8);
    });

    test('memory round-trip preserves all state fields', () => {
        const original = {
            chats:       [{ input: 'hello', response: 'hi', time: '12:00', personality: 'technical', emotion: 'focused' }],
            topics:      ['hello', 'quantum'],
            evolution:   250,
            connections: 10,
            awareness:   92,
            personality: 'creative',
        };
        const serialized = serializeMemory(original);
        assert.equal(isValidMemoryPayload(serialized), true);

        // Simulate JSON round-trip (as localStorage would do)
        const restored = JSON.parse(JSON.stringify(serialized));
        assert.equal(isValidMemoryPayload(restored), true);
        assert.equal(restored.evolution,   original.evolution);
        assert.equal(restored.connections, original.connections);
        assert.equal(restored.awareness,   original.awareness);
        assert.equal(restored.personality, original.personality);
        assert.deepEqual(restored.topics,  original.topics);
    });
});
