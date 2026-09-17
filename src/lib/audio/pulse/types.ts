/**
 * The pulse module — the patch's Arduino PulseSensor input, generalized.
 *
 * A PulseSource is anything that can produce BPM readings: tapping along,
 * a Bluetooth heart-rate strap, or the original Arduino over Web Serial.
 * The instrument doesn't care which — same interface, swappable live.
 */

export type BpmListener = (bpm: number) => void;

export interface PulseSource {
	readonly label: string;
	start(onBpm: BpmListener): Promise<void>;
	stop(): void;
}

/** The patch's default when no monitor is used: BPM 67, river only. */
export const DEFAULT_BPM = 67;

/**
 * The patch's five [if $i1 >= .. && $i1 <= ..] range gates, verbatim —
 * each heart-rate zone activated one environment soundscape.
 * (Milestone 4's 2D mixer will consume these; for now they light up chips.)
 */
export const BPM_BUCKETS = [
	{ name: 'river', min: 40, max: 69 },
	{ name: 'waves', min: 70, max: 89 },
	{ name: 'thunder', min: 90, max: 110 },
	{ name: 'thunder + rain', min: 111, max: 130 },
	{ name: 'wind', min: 131, max: 179 }
] as const;

export function bucketIndexFor(bpm: number): number {
	return BPM_BUCKETS.findIndex((b) => bpm >= b.min && bpm <= b.max);
}
