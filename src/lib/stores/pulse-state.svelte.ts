/**
 * Shared reactive pulse state — one BPM the whole instrument can see
 * (the PulsePanel writes it; the soundscape pad and grain pacing read it).
 * A .svelte.ts module so $state runes work at module level.
 */
import { DEFAULT_BPM } from '$lib/audio/pulse/types';

export const pulseState = $state({
	bpm: DEFAULT_BPM,
	frozen: false
});
