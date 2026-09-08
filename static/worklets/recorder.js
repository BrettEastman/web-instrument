/**
 * A tiny recording AudioWorklet — the equivalent of Max's record~.
 *
 * AudioWorklets run on the real-time audio thread in 128-sample blocks.
 * While recording, each block is copied and posted to the main thread,
 * which accumulates them into an AudioBuffer when recording stops.
 */
class RecorderProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.recording = false;
		this.port.onmessage = (e) => {
			if (e.data === 'start') this.recording = true;
			if (e.data === 'stop') this.recording = false;
		};
	}

	process(inputs) {
		const input = inputs[0];
		if (this.recording && input && input.length > 0 && input[0].length > 0) {
			// Copy the channel data — the engine reuses these arrays between blocks.
			this.port.postMessage(input.map((ch) => ch.slice()));
		}
		return true; // keep processor alive
	}
}

registerProcessor('recorder', RecorderProcessor);
