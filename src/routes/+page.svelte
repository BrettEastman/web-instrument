<script lang="ts">
	import { initEngine, type MasterChain } from '$lib/audio/engine';
	import { startTestTone, startRiverPlaceholder, type Voice } from '$lib/audio/sources';
	import { enableMic, type MicInput } from '$lib/audio/mic';
	import { Looper, type LooperState } from '$lib/audio/looper';
	import Meter from '$lib/components/Meter.svelte';
	import Fader from '$lib/components/Fader.svelte';
	import Waveform from '$lib/components/Waveform.svelte';

	let master = $state<MasterChain | null>(null);
	let tone = $state<Voice | null>(null);
	let river = $state<Voice | null>(null);
	let mic = $state<MicInput | null>(null);
	let micError = $state('');

	let looper = $state.raw<Looper | null>(null);
	let looperState = $state<LooperState>('empty');
	let looperDuration = $state(0);
	let looperSpeed = $state(1);
	let looperReversed = $state(false);
	let waveform = $state<Float32Array | null>(null);

	async function begin() {
		master = await initEngine();
	}

	function toggleTone() {
		if (tone) {
			tone.stop();
			tone = null;
		} else {
			tone = startTestTone();
		}
	}

	function toggleRiver() {
		if (river) {
			river.stop();
			river = null;
		} else {
			river = startRiverPlaceholder();
		}
	}

	async function onEnableMic() {
		micError = '';
		try {
			mic = await enableMic();
			looper = new Looper(mic.source, 10);
		} catch (e) {
			micError = e instanceof Error ? e.message : String(e);
		}
	}

	function syncLooper() {
		if (!looper) return;
		looperState = looper.state;
		looperDuration = looper.duration;
		waveform = looper.getWaveform();
	}

	async function recordToggle() {
		if (!looper) return;
		if (looper.state === 'recording') {
			looper.stopRecording();
		} else {
			await looper.startRecording();
			// Poll for the auto-stop at max length so the UI stays honest.
			const poll = setInterval(() => {
				if (looper && looper.state !== 'recording') {
					clearInterval(poll);
					syncLooper();
				}
			}, 200);
		}
		syncLooper();
	}

	function playToggle() {
		if (!looper) return;
		if (looper.state === 'playing') looper.stopPlayback();
		else looper.play();
		syncLooper();
	}

	function onSpeed(e: Event) {
		looperSpeed = Number((e.target as HTMLInputElement).value);
		looper?.setSpeed(looperSpeed, 100);
	}

	function toggleReverse() {
		looperReversed = !looperReversed;
		looper?.setReversed(looperReversed);
	}
</script>

<main>
	<h1>web instrument</h1>
	<p class="sub">a browser descendant of the pulse-flute Max patch — milestone 1–2</p>

	{#if !master}
		<button class="begin" onclick={begin}>Begin</button>
		<p class="hint">browsers only start audio after a click — this is our ezdac~ toggle</p>
	{:else}
		<section>
			<h2>master</h2>
			<Fader param={master.masterGain.gain} label="out" initialDb={-6} />
			<Meter analyser={master.analyser} label="main" />
		</section>

		<section>
			<h2>sources</h2>
			<div class="row">
				<button onclick={toggleTone}>{tone ? 'stop tone' : 'test tone'}</button>
				<button onclick={toggleRiver}>{river ? 'stop river' : 'river (placeholder)'}</button>
			</div>
			{#if river}
				<Fader param={river.gain.gain} label="river" initialDb={-6} />
			{/if}
		</section>

		<section>
			<h2>mic</h2>
			{#if !mic}
				<button onclick={onEnableMic}>enable mic</button>
				{#if micError}<p class="error">{micError}</p>{/if}
			{:else}
				<Meter analyser={mic.analyser} label="input" />
				<Fader param={mic.monitorGain.gain} label="monitor" initialDb={-70} />
				<p class="hint">monitor is muted by default — headphones recommended before raising it</p>
			{/if}
		</section>

		{#if mic && looper}
			<section>
				<h2>looper 1</h2>
				<div class="row">
					<button class:rec={looperState === 'recording'} onclick={recordToggle}>
						{looperState === 'recording' ? 'stop rec' : 'record'}
					</button>
					<button disabled={looperState === 'empty' || looperState === 'recording'} onclick={playToggle}>
						{looperState === 'playing' ? 'stop' : 'play loop'}
					</button>
					<button disabled={looperState === 'empty'} class:on={looperReversed} onclick={toggleReverse}>
						reverse
					</button>
					{#if looperDuration > 0}
						<span class="hint">{looperDuration.toFixed(2)} s</span>
					{/if}
				</div>
				<Waveform samples={waveform} />
				<label class="fader-row">
					<span class="label">speed</span>
					<input type="range" min="0.1" max="4" step="0.01" value={looperSpeed} oninput={onSpeed} />
					<span class="value">{looperSpeed.toFixed(2)}×</span>
				</label>
				<Fader param={looper.gain.gain} label="level" initialDb={-2} />
			</section>
		{/if}
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		background: #0e1216;
		color: #e8e6e3;
		font-family: system-ui, sans-serif;
		--dim: #8b98a0;
	}
	main {
		max-width: 640px;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	h1 {
		font-size: 1.4rem;
		font-weight: 600;
		margin: 0;
		letter-spacing: 0.02em;
	}
	h2 {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--dim);
		margin: 0 0 0.75rem;
	}
	.sub {
		color: var(--dim);
		margin: -0.75rem 0 0;
		font-size: 0.85rem;
	}
	section {
		background: #151b21;
		border: 1px solid #222b33;
		border-radius: 10px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
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
	.begin {
		align-self: flex-start;
		font-size: 1.1rem;
		padding: 0.8rem 2.2rem;
		background: #2c4a45;
		border-color: #4a9d8f;
	}
	.hint {
		color: var(--dim);
		font-size: 0.75rem;
		margin: 0;
	}
	.error {
		color: #d1495b;
		font-size: 0.8rem;
	}
	.fader-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.fader-row .label {
		font-size: 0.7rem;
		color: var(--dim);
		min-width: 3.5rem;
	}
	.fader-row input {
		flex: 1;
		accent-color: #90bec6;
	}
	.fader-row .value {
		font-size: 0.7rem;
		color: var(--dim);
		min-width: 4rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
