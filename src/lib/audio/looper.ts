/**
 * A live looper: record the mic into a buffer, replay it as a loop at
 * variable speed, forwards or reversed.
 *
 * This is the Web Audio translation of the Max patch's
 *   [record~ loopplayerN] + [groove~ loopplayerN] + [sig~ speed]
 * pattern. One important difference: AudioBufferSourceNode.playbackRate
 * cannot go negative, so "reverse" is done by playing a pre-reversed copy
 * of the buffer. (Ramping smoothly *through* zero into reverse — which the
 * patch does with sig~ ramps — would need a custom AudioWorklet player;
 * a good future milestone.)
 */
import { getContext, getMaster, ramp } from './engine';
import { BufferRecorder } from './recorder';

export type LooperState = 'empty' | 'recording' | 'stopped' | 'playing';

export class Looper {
	readonly gain: GainNode; // per-looper fader (patch: live.gain~[N])
	readonly analyser: AnalyserNode; // post-fader meter tap
	state: LooperState = 'empty';
	speed = 1;
	reversed = false;
	/** Duration of the recorded loop in seconds (0 when empty). */
	duration = 0;

	private recorder: BufferRecorder;
	private forward: AudioBuffer | null = null;
	private reverse: AudioBuffer | null = null;
	private source: AudioBufferSourceNode | null = null;

	constructor(
		input: AudioNode,
		public readonly maxSeconds = 10
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
		this.stopPlayback();
		await this.recorder.start();
		this.state = 'recording';
	}

	stopRecording(): void {
		if (this.state !== 'recording') return;
		const buffer = this.recorder.stop();
		if (!buffer) {
			this.state = 'empty';
			return;
		}
		this.forward = buffer;
		this.reverse = reverseBuffer(getContext(), buffer);
		this.duration = buffer.duration;
		this.state = 'stopped';
	}

	play(): void {
		if (!this.forward) return;
		this.stopPlayback();
		const ctx = getContext();
		const src = ctx.createBufferSource();
		src.buffer = this.reversed ? this.reverse : this.forward;
		src.loop = true;
		src.playbackRate.value = this.speed;
		src.connect(this.gain);
		src.start();
		this.source = src;
		this.state = 'playing';
	}

	stopPlayback(): void {
		if (this.source) {
			this.source.stop();
			this.source.disconnect();
			this.source = null;
		}
		if (this.state === 'playing') this.state = 'stopped';
	}

	/** Glide playback speed over `rampMs` — the patch's [line 0. 20] -> sig~ move. */
	setSpeed(speed: number, rampMs = 20): void {
		this.speed = speed;
		if (this.source) ramp(this.source.playbackRate, speed, rampMs);
	}

	setReversed(reversed: boolean): void {
		if (reversed === this.reversed) return;
		this.reversed = reversed;
		if (this.state === 'playing') this.play(); // restart on the flipped buffer
	}

	/**
	 * Where the read head actually is right now — during a ramp this differs
	 * from `speed` (the target). Lets the UI show the glide happening.
	 */
	get currentRate(): number {
		return this.source ? this.source.playbackRate.value : this.speed;
	}

	// ---- scripted gestures (the patch's timed sig~ / line moves) ----------

	/**
	 * Grind to a halt over `ms` — the "slowing to a stop over 10 sec" cue.
	 * playbackRate can't be exactly 0, so we land on a crawl that's inaudible.
	 */
	slowToStop(ms = 10000): void {
		if (!this.source) return;
		this.speed = 0.001;
		ramp(this.source.playbackRate, 0.001, ms);
	}

	/**
	 * The patch's "slowing in reverse" move: decelerate to near-zero, flip
	 * direction, accelerate back up. Web Audio can't ramp playbackRate
	 * through zero, so this fakes the crossing with a buffer swap at the
	 * bottom of the deceleration — by then it's slow enough not to hear the seam.
	 */
	rampIntoReverse(ms = 4000): void {
		if (!this.source) {
			this.reversed = !this.reversed;
			return;
		}
		const target = this.speed > 0.05 ? this.speed : 1;
		ramp(this.source.playbackRate, 0.02, ms / 2);
		window.setTimeout(() => {
			if (this.state !== 'playing') return;
			this.reversed = !this.reversed;
			this.speed = 0.02;
			this.play(); // restart on the flipped buffer at crawl speed
			this.setSpeed(target, ms / 2); // ...and accelerate back out
		}, ms / 2);
	}

	/** Waveform data for drawing (forward buffer, first channel). */
	getWaveform(): Float32Array | null {
		return this.forward ? this.forward.getChannelData(0) : null;
	}
}

function reverseBuffer(ctx: AudioContext, buffer: AudioBuffer): AudioBuffer {
	const out = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
	for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
		const src = buffer.getChannelData(ch);
		const dst = out.getChannelData(ch);
		for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i];
	}
	return out;
}
