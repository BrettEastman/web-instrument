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

export type LooperState = 'empty' | 'recording' | 'stopped' | 'playing';

let workletReady: Promise<void> | null = null;
function ensureRecorderModule(ctx: AudioContext): Promise<void> {
	if (!workletReady) workletReady = ctx.audioWorklet.addModule('/worklets/recorder.js');
	return workletReady;
}

export class Looper {
	readonly gain: GainNode; // per-looper fader (patch: live.gain~[N])
	state: LooperState = 'empty';
	speed = 1;
	reversed = false;
	/** Duration of the recorded loop in seconds (0 when empty). */
	duration = 0;

	private worklet: AudioWorkletNode | null = null;
	private pull: GainNode | null = null;
	private chunks: Float32Array[][] = [];
	private recordedFrames = 0;
	private forward: AudioBuffer | null = null;
	private reverse: AudioBuffer | null = null;
	private source: AudioBufferSourceNode | null = null;

	constructor(
		private input: AudioNode,
		public readonly maxSeconds = 10
	) {
		const ctx = getContext();
		this.gain = ctx.createGain();
		this.gain.gain.value = 0.8;
		this.gain.connect(getMaster().busInput);
	}

	async startRecording(): Promise<void> {
		if (this.state === 'recording') return;
		const ctx = getContext();
		await ensureRecorderModule(ctx);

		this.stopPlayback();
		this.chunks = [];
		this.recordedFrames = 0;

		this.worklet = new AudioWorkletNode(ctx, 'recorder');
		this.worklet.port.onmessage = (e: MessageEvent<Float32Array[]>) => {
			this.chunks.push(e.data);
			this.recordedFrames += e.data[0].length;
			if (this.recordedFrames >= this.maxSeconds * ctx.sampleRate) {
				this.stopRecording(); // auto-stop at the buffer limit, like record~ hitting loopend
			}
		};

		// A worklet only processes while something downstream pulls it,
		// so route its (unused) output through a muted gain to the destination.
		this.pull = ctx.createGain();
		this.pull.gain.value = 0;
		this.input.connect(this.worklet);
		this.worklet.connect(this.pull);
		this.pull.connect(ctx.destination);

		this.worklet.port.postMessage('start');
		this.state = 'recording';
	}

	stopRecording(): void {
		if (this.state !== 'recording' || !this.worklet) return;
		const ctx = getContext();

		this.worklet.port.postMessage('stop');
		this.input.disconnect(this.worklet);
		this.worklet.disconnect();
		this.pull?.disconnect();
		this.worklet = null;
		this.pull = null;

		if (this.recordedFrames === 0) {
			this.state = 'empty';
			return;
		}

		// Stitch the 128-sample blocks into one AudioBuffer.
		const channels = this.chunks[0].length;
		const buffer = ctx.createBuffer(channels, this.recordedFrames, ctx.sampleRate);
		for (let ch = 0; ch < channels; ch++) {
			const data = buffer.getChannelData(ch);
			let offset = 0;
			for (const block of this.chunks) {
				data.set(block[Math.min(ch, block.length - 1)], offset);
				offset += block[0].length;
			}
		}
		this.chunks = [];

		this.forward = buffer;
		this.reverse = reverseBuffer(ctx, buffer);
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
