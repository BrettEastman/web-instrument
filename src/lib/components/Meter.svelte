<script lang="ts">
	// Level meter (patch: levelmeter~ / meter~): reads an AnalyserNode
	// every animation frame and shows RMS as a bar with a peak tick.
	let { analyser, label = '' }: { analyser: AnalyserNode; label?: string } = $props();

	let rms = $state(0);
	let peak = $state(0);

	$effect(() => {
		const data = new Float32Array(analyser.fftSize);
		let raf = 0;
		let peakHold = 0;
		const tick = () => {
			analyser.getFloatTimeDomainData(data);
			let sum = 0;
			let p = 0;
			for (let i = 0; i < data.length; i++) {
				sum += data[i] * data[i];
				const a = Math.abs(data[i]);
				if (a > p) p = a;
			}
			rms = Math.sqrt(sum / data.length);
			peakHold = Math.max(p, peakHold * 0.97); // slow-falling peak
			peak = peakHold;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	// Map amplitude to a 0..1 bar length on a rough dB scale (-60..0 dB).
	const toBar = (v: number) => Math.max(0, Math.min(1, 1 + (20 * Math.log10(v || 1e-6)) / 60));
</script>

<div class="meter">
	{#if label}<span class="label">{label}</span>{/if}
	<div class="track">
		<div class="bar" class:hot={peak > 0.9} style:width="{toBar(rms) * 100}%"></div>
		<div class="peak" style:left="{toBar(peak) * 100}%"></div>
	</div>
</div>

<style>
	.meter {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.label {
		font-size: 0.7rem;
		color: var(--dim);
		min-width: 3.5rem;
	}
	.track {
		position: relative;
		flex: 1;
		height: 10px;
		background: #1a2126;
		border-radius: 5px;
		overflow: hidden;
	}
	.bar {
		height: 100%;
		background: linear-gradient(90deg, #4a9d8f, #90bec6);
		border-radius: 5px;
		transition: width 40ms linear;
	}
	.bar.hot {
		background: linear-gradient(90deg, #4a9d8f, #e2b04a, #d1495b);
	}
	.peak {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: #e8e6e3;
		opacity: 0.7;
	}
</style>
