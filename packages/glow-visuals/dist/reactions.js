export const EMOJI_GLYPHS = {
    heart: '❤️',
    fire: '🔥',
    star: '⭐',
    clap: '👏',
    raised_hands: '🙌',
    party: '🎉',
    sparkles: '✨',
    mind_blown: '🤯',
    rocket: '🚀',
    sun: '☀️',
    lightning: '⚡',
};
// Free plan gets a subset
export const REACTION_ALLOWLIST_FREE = [
    'heart',
    'fire',
    'star',
    'clap',
    'raised_hands',
];
// Paid plans get all
export const REACTION_ALLOWLIST_PAID = [
    'heart',
    'fire',
    'star',
    'clap',
    'raised_hands',
    'party',
    'sparkles',
    'mind_blown',
    'rocket',
    'sun',
    'lightning',
];
export const MAX_BOOST_FREE = 1;
export const MAX_BOOST_PAID = 3;
// Windows and limits
export const BOOST_WINDOW_MS = 1000; // time window to escalate boost
export const RATE_LIMIT_WINDOW_MS = 10000; // 10s rate limit window
export const RATE_LIMIT_FREE = 5; // max 5 reactions per 10s
export const RATE_LIMIT_PAID = 15; // max 15 reactions per 10s
