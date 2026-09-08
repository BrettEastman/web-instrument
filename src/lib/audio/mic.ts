/**
 * Microphone input — the patch's ezadc~ / "mic on/off" toggle.
 *
 * We disable the browser's voice-call processing (echo cancellation, noise
 * suppression, auto gain) because they mangle musical signals.
 *
 * The mic connects to:
 *  - an analyser for the input level meter (patch: levelmeter~ on the flute mic)
 *  - a monitor gain into the master bus, defaulted to silence (feedback safety —
 *    the patch has comments about needing to turn the flute monitor down live!)
 *  - anything else (loopers, granulator) taps `source` directly.
 */
import { getContext, getMaster } from './engine';

export interface MicInput {
	source: MediaStreamAudioSourceNode;
	analyser: AnalyserNode;
	/** Dry monitor into the master bus. Default 0 — turn up with care. */
	monitorGain: GainNode;
	stream: MediaStream;
	stop: () => void;
}

let mic: MicInput | null = null;

export function getMic(): MicInput | null {
	return mic;
}

export async function enableMic(): Promise<MicInput> {
	if (mic) return mic;
	const ctx = getContext();

	const stream = await navigator.mediaDevices.getUserMedia({
		audio: {
			echoCancellation: false,
			noiseSuppression: false,
			autoGainControl: false
		}
	});

	const source = ctx.createMediaStreamSource(stream);

	const analyser = ctx.createAnalyser();
	analyser.fftSize = 2048;
	source.connect(analyser);

	const monitorGain = ctx.createGain();
	monitorGain.gain.value = 0; // OFF by default: mic + speakers = feedback risk
	source.connect(monitorGain);
	monitorGain.connect(getMaster().busInput);

	mic = {
		source,
		analyser,
		monitorGain,
		stream,
		stop: () => {
			stream.getTracks().forEach((t) => t.stop());
			source.disconnect();
			monitorGain.disconnect();
			mic = null;
		}
	};
	return mic;
}
