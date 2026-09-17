/**
 * The FX bus — inserted in the master chain between the source bus and the
 * tanh softclip:  busInput -> [ EQ -> flanger -> reverb send ] -> softclip -> ...
 *
 * Three effects from the Max patch:
 *  - EQ: one configurable biquad, like the patch's [filtergraph~] (nfilters 1)
 *    with its umenu of filter types.
 *  - Flanger: the patch's [p Basicflange] — a short modulated delay
 *    ([tapin~]/[tapout~] with a [cycle~] LFO sweeping 0–4.5 ms) plus feedback.
 *    Think of the LFO as a very slow phaser pedal knob being turned for you.
 *  - Reverb: the patch used a rev3 tap-delay network; here a ConvolverNode
 *    with a generated impulse response (decaying stereo noise) — the simplest
 *    good-sounding room the Web Audio API offers. Wired send/return style:
 *    the `wet` gain is the send fader.
 *
 * Deliberately no imports from engine.ts (engine imports us), so this file
 * is pure "given a context, build nodes".
 */

export interface FxBus {
	input: GainNode;
	output: GainNode;
	/** The single filtergraph~-style biquad. */
	eq: BiquadFilterNode;
	flanger: {
		wet: GainNode; // 0 = bypass
		feedback: GainNode;
		rate: OscillatorNode; // LFO frequency in Hz
		depth: GainNode; // LFO amount in seconds of delay sweep
		delay: DelayNode;
	};
	reverb: {
		wet: GainNode; // send level, 0 = bypass
		convolver: ConvolverNode;
	};
}

export function createFxBus(ctx: BaseAudioContext): FxBus {
	const input = ctx.createGain();
	const output = ctx.createGain();

	// --- EQ ---------------------------------------------------------------
	// Defaults echo the patch's filteringEQ setfilter (peaking around 1868 Hz).
	const eq = ctx.createBiquadFilter();
	eq.type = 'peaking';
	eq.frequency.value = 1868;
	eq.gain.value = 0; // flat until asked
	eq.Q.value = 0.7;

	// --- Flanger ----------------------------------------------------------
	const delay = ctx.createDelay(0.05);
	delay.delayTime.value = 0.003; // center of the sweep
	const rate = ctx.createOscillator();
	rate.frequency.value = 0.47; // the patch's cycle~ 0.47
	const depth = ctx.createGain();
	depth.gain.value = 0.002; // ±2 ms sweep (patch scaled 0–4.5 ms)
	rate.connect(depth);
	depth.connect(delay.delayTime);
	rate.start();

	const fWet = ctx.createGain();
	fWet.gain.value = 0; // bypass until raised
	const fFeedback = ctx.createGain();
	fFeedback.gain.value = 0.3;

	// --- Reverb -----------------------------------------------------------
	const convolver = ctx.createConvolver();
	convolver.buffer = makeImpulseResponse(ctx, 3.2, 2.4);
	const rWet = ctx.createGain();
	rWet.gain.value = 0; // send fader, off until raised

	// --- Wiring -----------------------------------------------------------
	// input -> eq -> sum(dry + flanger wet) -> output
	//                              └-> reverb send -> convolver -> output
	const sum = ctx.createGain();
	input.connect(eq);
	eq.connect(sum); // dry path
	eq.connect(delay);
	delay.connect(fWet);
	fWet.connect(sum);
	delay.connect(fFeedback);
	fFeedback.connect(delay); // regeneration
	sum.connect(output);
	sum.connect(rWet);
	rWet.connect(convolver);
	convolver.connect(output);

	return {
		input,
		output,
		eq,
		flanger: { wet: fWet, feedback: fFeedback, rate, depth, delay },
		reverb: { wet: rWet, convolver }
	};
}

/**
 * Generate a room: stereo noise with an exponential decay envelope.
 * `decay` shapes how fast it dies — higher = drier tail.
 */
function makeImpulseResponse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
	const length = Math.floor(ctx.sampleRate * seconds);
	const ir = ctx.createBuffer(2, length, ctx.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const data = ir.getChannelData(ch);
		for (let i = 0; i < length; i++) {
			data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
		}
	}
	return ir;
}
