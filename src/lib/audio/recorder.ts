/**
 * BufferRecorder — shared record~ machinery for the looper and granulator.
 *
 * Wraps the recorder AudioWorklet (static/worklets/recorder.js): while
 * recording, 128-sample blocks arrive from the audio thread; stop() stitches
 * them into an AudioBuffer.
 */
import { getContext } from './engine';

let workletReady: Promise<void> | null = null;

export function ensureRecorderModule(ctx: AudioContext): Promise<void> {
	if (!workletReady) workletReady = ctx.audioWorklet.addModule('/worklets/recorder.js');
	return workletReady;
}

export class BufferRecorder {
	recording = false;

	private worklet: AudioWorkletNode | null = null;
	private pull: GainNode | null = null;
	private chunks: Float32Array[][] = [];
	private frames = 0;

	constructor(
		private input: AudioNode,
		readonly maxSeconds: number,
		/** Called once if recording hits the maxSeconds ceiling. */
		private onAutoStop?: () => void
	) {}

	async start(): Promise<void> {
		if (this.recording) return;
		const ctx = getContext();
		await ensureRecorderModule(ctx);

		this.chunks = [];
		this.frames = 0;

		this.worklet = new AudioWorkletNode(ctx, 'recorder');
		this.worklet.port.onmessage = (e: MessageEvent<Float32Array[]>) => {
			if (!this.recording) return;
			this.chunks.push(e.data);
			this.frames += e.data[0].length;
			if (this.frames >= this.maxSeconds * ctx.sampleRate) {
				this.onAutoStop?.(); // like record~ hitting loopend
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
		this.recording = true;
	}

	/** Stop and return the recorded buffer (null if nothing was captured). */
	stop(): AudioBuffer | null {
		if (!this.recording || !this.worklet) return null;
		this.recording = false;
		const ctx = getContext();

		this.worklet.port.postMessage('stop');
		this.input.disconnect(this.worklet);
		this.worklet.disconnect();
		this.pull?.disconnect();
		this.worklet = null;
		this.pull = null;

		if (this.frames === 0) return null;

		const channels = this.chunks[0].length;
		const buffer = ctx.createBuffer(channels, this.frames, ctx.sampleRate);
		for (let ch = 0; ch < channels; ch++) {
			const data = buffer.getChannelData(ch);
			let offset = 0;
			for (const block of this.chunks) {
				data.set(block[Math.min(ch, block.length - 1)], offset);
				offset += block[0].length;
			}
		}
		this.chunks = [];
		return buffer;
	}
}
