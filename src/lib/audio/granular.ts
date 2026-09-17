/**
 * Granular — the Plode1 engine from the Max patch, rebuilt in Web Audio.
 *
 * In the patch: [metro] fires -> random grain start / length / transposition
 * within rslider ranges -> [pack note ...] -> [poly~ PlodegrainVoice1 100].
 *
 * Here, instead of a fixed voice pool, each grain is its own throwaway
 * AudioBufferSourceNode + envelope GainNode — the browser garbage-collects
 * finished grains, so polyphony is effectively free.
 *
 * Timing uses the classic lookahead-scheduler pattern (think of it as a
 * drummer reading half a bar ahead): a coarse setInterval wakes up every
 * 25 ms and schedules any grains due in the next 100 ms at sample-accurate
 * AudioContext times. UI-thread jitter never touches the groove.
 */
import { getContext, getMaster } from './engine';
import { BufferRecorder } from './recorder';

export type GranularState = 'empty' | 'recording' | 'stopped' | 'running';

export interface GrainParams {
	/** Grain start position range, as a 0..1 fraction of the buffer (patch: start-position rslider). */
	startMin: number;
	startMax: number;
	/** Grain length range in ms — wall-clock duration of each grain (patch: grain-length rslider). */
	lengthMinMs: number;
	lengthMaxMs: number;
	/** Transposition range in semitones (patch: transposition rslider through mtof / 261.63). */
	transposeMin: number;
	transposeMax: number;
	/** Base time between grain onsets, ms (patch: metro interval — later driven by pulse BPM). */
	intervalMs: number;
	/** Random extra time added per onset, ms (patch: "inter-grain length — rhythmic variation"). */
	jitterMs: number;
}

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

export class Granular {
	readonly gain: GainNode; // engine fader (patch: live.gain~[9])
	readonly analyser: AnalyserNode; // post-fader meter tap
	state: GranularState = 'empty';
	/** Duration of the recorded source buffer in seconds. */
	duration = 0;
	/** Total grains scheduled since start() — a little odometer for the UI. */
	grainCount = 0;

	params: GrainParams = {
		startMin: 0,
		startMax: 1,
		lengthMinMs: 80,
		lengthMaxMs: 600,
		transposeMin: -12,
		transposeMax: 12,
		intervalMs: 90,
		jitterMs: 120
	};

	private recorder: BufferRecorder;
	private buffer: AudioBuffer | null = null;
	private timer = 0;
	private nextGrainTime = 0;
	private readonly lookahead = 0.1; // seconds scheduled ahead
	private readonly tickMs = 25; // scheduler wake-up interval

	constructor(
		input: AudioNode,
		public readonly maxSeconds = 12
	) {
		const ctx = getContext();
		this.recorder = new BufferRecorder(input, maxSeconds, () => this.stopRecording());
		this.gain = ctx.createGain();
		this.gain.gain.value = 0.8;
		this.analyser = ctx.createAnalyser();
		this.analyser.fftSize = 1024;
		this.gain.connect(this.analyser);
		this.analyser.connect(getMaster().busInput);
	}

	async startRecording(): Promise<void> {
		if (this.state === 'recording') return;
		this.stop();
		await this.recorder.start();
		this.state = 'recording';
	}

	stopRecording(): void {
		if (this.state !== 'recording') return;
		const buffer = this.recorder.stop();
		if (!buffer) {
			this.state = this.buffer ? 'stopped' : 'empty';
			return;
		}
		this.buffer = buffer;
		this.duration = buffer.duration;
		this.state = 'stopped';
	}

	/** Start the grain cloud (patch: toggle -> metro on). */
	start(): void {
		if (!this.buffer || this.state === 'running') return;
		this.grainCount = 0;
		this.nextGrainTime = getContext().currentTime + 0.05;
		this.timer = window.setInterval(() => this.tick(), this.tickMs);
		this.state = 'running';
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = 0;
		}
		if (this.state === 'running') this.state = 'stopped';
		// In-flight grains are left to finish naturally — a soft tail, not a chop.
	}

	private tick(): void {
		const ctx = getContext();
		const horizon = ctx.currentTime + this.lookahead;
		while (this.nextGrainTime < horizon) {
			this.spawnGrain(this.nextGrainTime);
			const gap = this.params.intervalMs + Math.random() * this.params.jitterMs;
			this.nextGrainTime += Math.max(0.005, gap / 1000);
		}
	}

	private spawnGrain(t: number): void {
		if (!this.buffer) return;
		const ctx = getContext();
		const p = this.params;

		const semitones = rand(p.transposeMin, p.transposeMax);
		const rate = Math.pow(2, semitones / 12); // mtof-style ratio
		const grainSec = rand(p.lengthMinMs, p.lengthMaxMs) / 1000;
		const startFrac = rand(Math.min(p.startMin, p.startMax), Math.max(p.startMin, p.startMax));
		const offset = Math.min(startFrac * this.buffer.duration, Math.max(0, this.buffer.duration - 0.02));

		const src = ctx.createBufferSource();
		src.buffer = this.buffer;
		src.playbackRate.value = rate;

		// Triangle-ish envelope: 30% attack, 70% release — no clicks, airy overlap.
		const env = ctx.createGain();
		env.gain.setValueAtTime(0, t);
		env.gain.linearRampToValueAtTime(0.6, t + grainSec * 0.3);
		env.gain.linearRampToValueAtTime(0, t + grainSec);

		src.connect(env);
		env.connect(this.gain);
		src.start(t, offset);
		src.stop(t + grainSec + 0.02);
		src.onended = () => {
			src.disconnect();
			env.disconnect();
		};
		this.grainCount++;
	}

	getWaveform(): Float32Array | null {
		return this.buffer ? this.buffer.getChannelData(0) : null;
	}
}
