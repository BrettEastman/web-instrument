/**
 * CueEngine — the piece's score, as data.
 *
 * In the Max patch this was the MAIN COUNTER (0–13) fanning out to sr0–sr13
 * sends, each triggering a cascade of [delay] objects driving fader ramps,
 * recorders, and speed changes. Here a Section is just a named list of
 * timed steps, so the whole score reads top-to-bottom like a cue sheet
 * instead of a web of patch cords.
 *
 * Timing note: steps fire via setTimeout, which is plenty for cue-level
 * moves (seconds-scale fades). The *audio* inside each action is still
 * sample-accurate, because actions call ramp()/scheduled AudioParam moves —
 * setTimeout only decides when the conductor waves, not when the note lands.
 *
 * One deliberate difference from the patch: advancing to a new section
 * CANCELS the previous section's still-pending steps. Max's delay chains
 * keep firing after you move on, which is a classic live-performance
 * surprise; here the score always means what the current section says.
 */

export interface CueStep {
	/** Milliseconds after the section starts (the patch's [delay N]). */
	atMs: number;
	/** Human-readable cue text, shown in the on-stage display. */
	description: string;
	action: () => void;
}

export interface Section {
	name: string;
	steps: CueStep[];
}

export interface StepStatus {
	atMs: number;
	description: string;
	fired: boolean;
}

export class CueEngine {
	current = 0;

	private timeouts: number[] = [];
	private startedAt = 0; // performance.now() when the section began
	private fired = new Set<CueStep>();

	constructor(public readonly sections: Section[]) {}

	get section(): Section {
		return this.sections[this.current];
	}

	/** ms since the current section started (for the display's clock). */
	get elapsedMs(): number {
		return this.startedAt ? performance.now() - this.startedAt : 0;
	}

	status(): StepStatus[] {
		return this.section.steps.map((s) => ({
			atMs: s.atMs,
			description: s.description,
			fired: this.fired.has(s)
		}));
	}

	goTo(index: number): void {
		if (index < 0 || index >= this.sections.length) return;

		// Cancel whatever the previous section still had in flight.
		this.timeouts.forEach(clearTimeout);
		this.timeouts = [];
		this.fired.clear();

		this.current = index;
		this.startedAt = performance.now();

		for (const step of this.section.steps) {
			if (step.atMs <= 0) {
				step.action();
				this.fired.add(step);
			} else {
				this.timeouts.push(
					window.setTimeout(() => {
						step.action();
						this.fired.add(step);
					}, step.atMs)
				);
			}
		}
	}

	next(): void {
		this.goTo(this.current + 1);
	}

	prev(): void {
		this.goTo(this.current - 1);
	}

	/** The patch's «Press "0" to go back to zero at any time». */
	reset(): void {
		this.goTo(0);
	}
}
