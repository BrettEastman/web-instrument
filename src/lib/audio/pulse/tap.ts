/**
 * TapPulse — the zero-hardware source: the performer taps their own pulse
 * (finger on neck, tap the button) and we infer BPM from the tap intervals,
 * averaging the last few like a drummer's internal clock settling in.
 */
import type { BpmListener, PulseSource } from './types';

export class TapPulse implements PulseSource {
	readonly label = 'tap';

	private listener: BpmListener | null = null;
	private taps: number[] = [];

	async start(onBpm: BpmListener): Promise<void> {
		this.listener = onBpm;
		this.taps = [];
	}

	stop(): void {
		this.listener = null;
		this.taps = [];
	}

	/** Call on each tap (button press). */
	tap(): void {
		const now = performance.now();

		// A long gap means a fresh attempt, not a 20 BPM heart.
		if (this.taps.length && now - this.taps[this.taps.length - 1] > 3000) {
			this.taps = [];
		}

		this.taps.push(now);
		if (this.taps.length > 6) this.taps.shift(); // keep the last 6 taps

		if (this.taps.length < 2) return;
		const intervals: number[] = [];
		for (let i = 1; i < this.taps.length; i++) {
			intervals.push(this.taps[i] - this.taps[i - 1]);
		}
		const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
		const bpm = Math.round(60000 / avgMs);
		if (bpm >= 30 && bpm <= 220) this.listener?.(bpm);
	}
}
