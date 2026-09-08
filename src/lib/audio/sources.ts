/**
 * Simple sound sources for testing the chain before real material exists:
 * - a sine test tone (Max: cycle~)
 * - a looping "river" placeholder made from filtered noise, standing in for
 *   the SacRiver48.wav soundscape until real recordings are added.
 */
import { getContext, getMaster, ramp } from './engine';

export interface Voice {
	/** Per-voice fader (connect UI to this). */
	gain: GainNode;
	stop: () => void;
}

export function startTestTone(freq = 261.63): Voice {
	const ctx = getContext();
	const osc = ctx.createOscillator();
	osc.type = 'sine';
	osc.frequency.value = freq;

	const gain = ctx.createGain();
	gain.gain.value = 0;

	osc.connect(gain);
	gain.connect(getMaster().busInput);
	osc.start();
	ramp(gain.gain, 0.2, 100); // fade in so there's no click

	return {
		gain,
		stop: () => {
			ramp(gain.gain, 0, 100);
			osc.stop(ctx.currentTime + 0.15);
		}
	};
}

/**
 * 4 seconds of pink-ish noise through a lowpass, looped — a passable river.
 * Demonstrates building an AudioBuffer by hand and looping a source.
 */
export function startRiverPlaceholder(): Voice {
	const ctx = getContext();
	const seconds = 4;
	const buffer = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);

	for (let ch = 0; ch < 2; ch++) {
		const data = buffer.getChannelData(ch);
		// Paul Kellet's economy pink noise filter over white noise.
		let b0 = 0,
			b1 = 0,
			b2 = 0;
		for (let i = 0; i < data.length; i++) {
			const white = Math.random() * 2 - 1;
			b0 = 0.99765 * b0 + white * 0.099046;
			b1 = 0.963 * b1 + white * 0.2965164;
			b2 = 0.57 * b2 + white * 1.0526913;
			data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
		}
		// Short crossfade at the loop seam so it doesn't click.
		const fade = Math.floor(ctx.sampleRate * 0.05);
		for (let i = 0; i < fade; i++) {
			const w = i / fade;
			data[i] = data[i] * w + data[data.length - fade + i] * (1 - w);
		}
	}

	const src = ctx.createBufferSource();
	src.buffer = buffer;
	src.loop = true;

	// Gentle lowpass wobble makes it feel more like moving water.
	const lp = ctx.createBiquadFilter();
	lp.type = 'lowpass';
	lp.frequency.value = 900;
	lp.Q.value = 0.5;
	const lfo = ctx.createOscillator();
	lfo.frequency.value = 0.13;
	const lfoDepth = ctx.createGain();
	lfoDepth.gain.value = 350;
	lfo.connect(lfoDepth);
	lfoDepth.connect(lp.frequency);
	lfo.start();

	const gain = ctx.createGain();
	gain.gain.value = 0;

	src.connect(lp);
	lp.connect(gain);
	gain.connect(getMaster().busInput);
	src.start();
	ramp(gain.gain, 0.5, 2000); // slow fade in, like the patch's env fade-ups

	return {
		gain,
		stop: () => {
			ramp(gain.gain, 0, 1500);
			src.stop(getContext().currentTime + 1.6);
			lfo.stop(getContext().currentTime + 1.6);
		}
	};
}
