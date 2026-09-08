<script lang="ts">
	// One channel strip of the looper bank: record/play/reverse, scripted
	// speed gestures, waveform, live speed readout, level fader.
	//
	// The Looper class isn't reactive (it lives in audio-land), so we mirror
	// its state into $state locals on a light poll — simple and reliable.
	import type { Looper, LooperState } from '$lib/audio/looper';
	import Meter from './Meter.svelte';
	import Fader from './Fader.svelte';
	import Waveform from './Waveform.svelte';

	let { looper, index }: { looper: Looper; index: number } = $props();

	let loopState = $state<LooperState>('empty');
	let duration = $state(0);
	let reversed = $state(false);
	let sliderSpeed = $state(1);
	let liveRate = $state(1);
	let waveform = $state<Float32Array | null>(null);

	$effect(() => {
		const id = setInterval(() => {
			loopState = looper.state;
			duration = looper.duration;
			reversed = looper.reversed;
			liveRate = looper.currentRate;
			if (waveform !== looper.getWaveform()) waveform = looper.getWaveform();
		}, 120);
		return () => clearInterval(id);
	});

	async function recordToggle() {
		if (looper.state === 'recording') looper.stopRecording();
		else await looper.startRecording();
	}

	function playToggle() {
		if (looper.state === 'playing') looper.stopPlayback();
		else {
			looper.setSpeed(sliderSpeed, 20);
			looper.play();
		}
	}

	function onSpeed(e: Event) {
		sliderSpeed = Number((e.target as HTMLInputElement).value);
		looper.setSpeed(sliderSpeed, 100);
	}
</script>

<section>
	<h2>looper {index + 1}</h2>
	<div class="row">
		<button class:rec={loopState === 'recording'} onclick={recordToggle}>
			{loopState === 'recording' ? 'stop rec' : 'record'}
		</button>
		<button disabled={loopState === 'empty' || loopState === 'recording'} onclick={playToggle}>
			{loopState === 'playing' ? 'stop' : 'play loop'}
		</button>
		<button
			disabled={loopState === 'empty'}
			class:on={reversed}
			onclick={() => looper.setReversed(!looper.reversed)}
		>
			reverse
		</button>
		{#if duration > 0}
			<span class="hint">{duration.toFixed(2)} s</span>
		{/if}
	</div>

	<div class="row">
		<span class="label">gestures</span>
		<button disabled={loopState !== 'playing'} onclick={() => looper.slowToStop(10000)}>
			slow to stop · 10s
		</button>
		<button disabled={loopState !== 'playing'} onclick={() => looper.rampIntoReverse(4000)}>
			into reverse · 4s
		</button>
		<button
			disabled={loopState !== 'playing'}
			onclick={() => {
				looper.setSpeed(sliderSpeed, 3000);
			}}
		>
			back to {sliderSpeed.toFixed(2)}× · 3s
		</button>
	</div>

	<Waveform samples={waveform} />

	<label class="fader-row">
		<span class="label">speed</span>
		<input type="range" min="0.1" max="4" step="0.01" value={sliderSpeed} oninput={onSpeed} />
		<span class="value">
			{liveRate.toFixed(2)}×{reversed ? ' ◀' : ''}
		</span>
	</label>

	<Fader param={looper.gain.gain} label="level" initialDb={-2} />
	<Meter analyser={looper.analyser} label="out" />
</section>

<style>
	section {
		background: #151b21;
		border: 1px solid #222b33;
		border-radius: 10px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	h2 {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--dim);
		margin: 0 0 0.25rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	button {
		background: #223039;
		color: #e8e6e3;
		border: 1px solid #33454f;
		border-radius: 7px;
		padding: 0.45rem 0.9rem;
		font-size: 0.85rem;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		background: #2b3d48;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	button.rec {
		background: #5c2330;
		border-color: #8a3547;
	}
	button.on {
		background: #2c4a45;
		border-color: #4a9d8f;
	}
	.hint {
		color: var(--dim);
		font-size: 0.75rem;
	}
	.label {
		font-size: 0.7rem;
		color: var(--dim);
		min-width: 3.5rem;
	}
	.fader-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.fader-row input {
		flex: 1;
		accent-color: #90bec6;
	}
	.value {
		font-size: 0.7rem;
		color: var(--dim);
		min-width: 4rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
