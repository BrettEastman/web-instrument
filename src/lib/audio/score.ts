/**
 * The score: a concrete set of sections for the CueEngine, wired to the
 * instrument. This is the file to compose in — each section below is the
 * equivalent of one sr0–sr13 automation cascade from the Max patch, but
 * readable top-to-bottom.
 *
 * The shape is deliberately close to the patch's own comments, e.g.
 *   "-Loop1 record on / -Mic up / -after 2 sec: Loop1 fader up for 9 sec"
 * becomes steps at atMs 0 and 2000.
 */
import type { Section } from './cues';
import type { Looper } from './looper';
import type { Granular } from './granular';
import { ramp } from './engine';

export interface ScoreContext {
	loopers: Looper[];
	granular: Granular;
	/** Environment layer (river placeholder for now): fade up / down over ms. */
	env: {
		up: (ms: number) => void;
		down: (ms: number) => void;
	};
}

export function buildDemoScore({ loopers, granular, env }: ScoreContext): Section[] {
	const [l1, l2] = loopers;

	return [
		{
			// Patch: "MAIN COUNTER must be at 0" — the ready state.
			name: 'neutral — all quiet',
			steps: [
				{
					atMs: 0,
					description: 'stop grains, stop loops, environment down',
					action: () => {
						granular.stop();
						loopers.forEach((l) => l.stopPlayback());
						env.down(2000);
					}
				}
			]
		},
		{
			// Patch: pressing "h"/"j" to bring up the environment sounds.
			name: 'environment',
			steps: [
				{ atMs: 0, description: 'environment fades up over 4 s', action: () => env.up(4000) }
			]
		},
		{
			name: 'first capture',
			steps: [
				{
					atMs: 0,
					description: 'looper 1: record',
					action: () => {
						ramp(l1.gain.gain, 0, 50);
						void l1.startRecording();
					}
				},
				{
					atMs: 3000,
					description: 'looper 1: play at 1×, fade up over 2 s',
					action: () => {
						l1.stopRecording();
						l1.setSpeed(1);
						l1.play();
						ramp(l1.gain.gain, 0.8, 2000);
					}
				}
			]
		},
		{
			name: 'half-speed shadow',
			steps: [
				{
					atMs: 0,
					description: 'looper 2: record',
					action: () => {
						ramp(l2.gain.gain, 0, 50);
						void l2.startRecording();
					}
				},
				{
					atMs: 4000,
					description: 'looper 2: play at 0.5×, fade up over 3 s',
					action: () => {
						l2.stopRecording();
						l2.setSpeed(0.5);
						l2.play();
						ramp(l2.gain.gain, 0.8, 3000);
					}
				},
				{
					atMs: 4000,
					description: 'looper 1: slow to stop over 10 s',
					action: () => l1.slowToStop(10000)
				}
			]
		},
		{
			name: 'plode',
			steps: [
				{
					atMs: 0,
					description: 'granular: record 6 s of source',
					action: () => void granular.startRecording()
				},
				{
					atMs: 6000,
					description: 'granular: sparse grains begin',
					action: () => {
						granular.stopRecording();
						Object.assign(granular.params, {
							intervalMs: 250,
							jitterMs: 300,
							lengthMinMs: 300,
							lengthMaxMs: 900,
							transposeMin: -12,
							transposeMax: 7
						});
						granular.start();
						ramp(granular.gain.gain, 0.8, 2000);
					}
				},
				{
					atMs: 14000,
					description: 'grains densify',
					action: () => {
						Object.assign(granular.params, { intervalMs: 60, jitterMs: 80 });
					}
				}
			]
		},
		{
			name: 'reverse tide',
			steps: [
				{
					atMs: 0,
					description: 'looper 2: into reverse over 4 s',
					action: () => l2.rampIntoReverse(4000)
				},
				{ atMs: 0, description: 'environment fades down over 6 s', action: () => env.down(6000) },
				{
					atMs: 3000,
					description: 'looper 1: into reverse, back to speed',
					action: () => l1.rampIntoReverse(4000)
				}
			]
		},
		{
			name: 'coda',
			steps: [
				{
					atMs: 0,
					description: 'everything fades over 10 s',
					action: () => {
						loopers.forEach((l) => ramp(l.gain.gain, 0, 10000));
						ramp(granular.gain.gain, 0, 10000);
					}
				},
				{
					atMs: 10500,
					description: 'silence — engines stop',
					action: () => {
						loopers.forEach((l) => l.stopPlayback());
						granular.stop();
					}
				}
			]
		}
	];
}
