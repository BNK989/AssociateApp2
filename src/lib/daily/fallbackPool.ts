import { DOMAINS, daysSinceEpoch, type Domain } from './themeWheel';

/**
 * Hand-written chains for when the model cannot be reached.
 *
 * The old pool held five entries, which made the safety net a source of the
 * very repetition it was catching -- and one of them was the coffee-and-morning
 * chain the model already gravitated to unprompted. There is now one chain per
 * domain, so a fallback day still honours the wheel and still reads as a
 * different puzzle from the day before.
 *
 * Hints are deliberately absent. The fallback fires when the model is
 * unreachable, which is exactly when hint generation would fail too; the
 * existing hint pipeline (`ensureDailyHints`, and the nightly cron) fills them
 * in on the next run, and until then the client shows its generic length-and-
 * first-letter hint. A playable puzzle with weak hints beats no puzzle.
 */

export type FallbackChain = {
    domain: Domain;
    theme: string;
    words: string[];
};

export const FALLBACK_CHAINS: FallbackChain[] = [
    { domain: 'Nature and weather', theme: 'Before the Storm', words: ['Thunder', 'Cloud', 'Shadow', 'Cool', 'Breeze', 'Leaf'] },
    { domain: 'Food and cooking', theme: 'Slow Sunday Kitchen', words: ['Dough', 'Knead', 'Oven', 'Crust', 'Butter', 'Melt'] },
    { domain: 'Music and sound', theme: 'The Quiet Between Notes', words: ['Echo', 'Hall', 'Silence', 'Breath', 'Reed', 'Whistle'] },
    { domain: 'Sport and movement', theme: 'The Last Lap', words: ['Sprint', 'Lane', 'Chalk', 'Track', 'Baton', 'Handover'] },
    { domain: 'Cinema and television', theme: 'Cutting Room', words: ['Reel', 'Splice', 'Scene', 'Take', 'Clapper', 'Silence'] },
    { domain: 'Technology and machines', theme: 'Things That Whirr', words: ['Fan', 'Blade', 'Motor', 'Coil', 'Copper', 'Wire'] },
    { domain: 'History and the past', theme: 'What the Ground Kept', words: ['Shard', 'Clay', 'Kiln', 'Ash', 'Layer', 'Dig'] },
    { domain: 'Myth, legend and folklore', theme: 'Doors You Should Not Open', words: ['Key', 'Lock', 'Crypt', 'Curse', 'Whisper', 'Warning'] },
    { domain: 'Travel and places', theme: 'The Long Way Round', words: ['Detour', 'Gravel', 'Ridge', 'Valley', 'River', 'Crossing'] },
    { domain: 'The body and health', theme: 'Small Repairs', words: ['Scab', 'Skin', 'Stitch', 'Thread', 'Knot', 'Tighten'] },
    { domain: 'The home and everyday objects', theme: 'The Drawer Nobody Opens', words: ['Hinge', 'Screw', 'Washer', 'Rubber', 'Band', 'Stretch'] },
    { domain: 'Animals', theme: 'Built to Burrow', words: ['Claw', 'Tunnel', 'Soil', 'Root', 'Worm', 'Cast'] },
    { domain: 'Art and craft', theme: 'Before the First Mark', words: ['Primer', 'Canvas', 'Weave', 'Linen', 'Flax', 'Field'] },
    { domain: 'Language and words', theme: 'Borrowed Words', words: ['Accent', 'Vowel', 'Tongue', 'Root', 'Latin', 'Carving'] },
    { domain: 'Games and play', theme: 'Rules Made Up on the Spot', words: ['Marble', 'Circle', 'Flick', 'Wrist', 'Snap', 'Finish'] },
    { domain: 'Transport and journeys', theme: 'Signals and Sidings', words: ['Rail', 'Sleeper', 'Ballast', 'Gravel', 'Switch', 'Junction'] },
    { domain: 'Clothing and style', theme: 'Everything Has a Seam', words: ['Hem', 'Needle', 'Thimble', 'Brass', 'Polish', 'Shine'] },
    { domain: 'Space and science', theme: 'Measuring the Dark', words: ['Lens', 'Mirror', 'Focus', 'Beam', 'Prism', 'Spectrum'] },
    { domain: 'Trades and working life', theme: 'Tools With Worn Handles', words: ['Chisel', 'Mallet', 'Grain', 'Timber', 'Sawdust', 'Sweep'] },
    { domain: 'Money, trade and markets', theme: 'What a Thing Is Worth', words: ['Scale', 'Weight', 'Brass', 'Counter', 'Haggle', 'Bargain'] },
];

/**
 * Picks the fallback for a date, honouring the day's domain when one matches.
 *
 * Falling back should not also mean falling out of the rotation: if the wheel
 * said today is about animals, the stand-in chain is the animal one, so two
 * consecutive fallback days still differ from each other.
 */
export function getFallbackChain(dateStr: string, domain?: Domain): FallbackChain {
    if (domain) {
        const matched = FALLBACK_CHAINS.find((chain) => chain.domain === domain);
        if (matched) return matched;
    }

    const day = daysSinceEpoch(dateStr);
    const index = ((day % FALLBACK_CHAINS.length) + FALLBACK_CHAINS.length) % FALLBACK_CHAINS.length;
    return FALLBACK_CHAINS[index];
}

/** Every domain should have a stand-in; asserted by the tests, not at runtime. */
export function domainsWithoutFallback(): Domain[] {
    const covered = new Set(FALLBACK_CHAINS.map((chain) => chain.domain));
    return DOMAINS.filter((domain) => !covered.has(domain));
}
