<script lang="ts">
	import { onMount } from 'svelte';
	import { getAvailableSchemes, recalculateGrant, loadSampleCalculation } from '#lib/grant.remote';
	import type { GrantTransformationResult, AgaRatePeriod } from '#lib/types/grant';
	import FileUpload from '#lib/components/FileUpload.svelte';
	import ControlDashboard from '#lib/components/ControlDashboard.svelte';
	import TargetFormCompanion from '#lib/components/TargetFormCompanion.svelte';
	import AgaTimelineEditor from '#lib/components/AgaTimelineEditor.svelte';

	let availableSchemes = $state<any[]>([]);
	let selectedSchemeId = $state('sgb16i-berlin');
	let includeOffset = $state(true);
	let runtimeMode = $state<'full' | 'restricted'>('full'); // 'full' (60 mo) vs 'restricted' (41 mo)
	let currentResult = $state<GrantTransformationResult | null>(null);
	let isRecalculating = $state(false);

	const restrictYear = $derived(runtimeMode === 'restricted' ? 2029 : undefined);

	onMount(async () => {
		try {
			// Fetch schemes from Remote Query
			const schemes = await getAvailableSchemes();
			availableSchemes = schemes;

			// Automatically load bundled sample calculation (Langner) for instant interactive experience
			const sampleRes = await loadSampleCalculation({
				includeOffsetRows: includeOffset,
				restrictToYear: restrictYear
			});
			currentResult = sampleRes;
		} catch (err) {
			console.error('Initial load error:', err);
		}
	});

	async function handleResult(res: GrantTransformationResult) {
		currentResult = res;
	}

	async function handleToggleOffset(val: boolean) {
		includeOffset = val;
		if (currentResult) {
			await triggerRecalculate();
		}
	}

	async function handleRuntimeModeChange(mode: 'full' | 'restricted') {
		runtimeMode = mode;
		if (currentResult) {
			await triggerRecalculate();
		}
	}

	async function handleUpdateTimeline(newTimeline: AgaRatePeriod[]) {
		if (currentResult) {
			isRecalculating = true;
			try {
				const updated = await recalculateGrant({
					schemeId: selectedSchemeId,
					records: currentResult.rawMonthlyRecords,
					participant: currentResult.participant,
					options: {
						includeOffsetRows: includeOffset,
						restrictToYear: runtimeMode === 'restricted' ? 2029 : undefined,
						customAgaTimeline: newTimeline
					}
				});
				currentResult = updated;
			} catch (err) {
				console.error('Recalculation error:', err);
			} finally {
				isRecalculating = false;
			}
		}
	}

	async function triggerRecalculate() {
		if (currentResult) {
			isRecalculating = true;
			try {
				const updated = await recalculateGrant({
					schemeId: selectedSchemeId,
					records: currentResult.rawMonthlyRecords,
					participant: currentResult.participant,
					options: {
						includeOffsetRows: includeOffset,
						restrictToYear: runtimeMode === 'restricted' ? 2029 : undefined,
						customAgaTimeline: currentResult.agaTimeline
					}
				});
				currentResult = updated;
			} catch (err) {
				console.error('Recalculation error:', err);
			} finally {
				isRecalculating = false;
			}
		}
	}
</script>

<div class="page-container">
	<!-- Main Header -->
	<header class="app-header">
		<div class="header-content">
			<div class="logo-area">
				<div class="logo-icon">
					<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
					</svg>
				</div>
				<div>
					<h1>ZGS Grant Assistant & Form Converter</h1>
					<p class="subtitle">
						Intelligente Transformation & Plausibilitätshelfer für Förderanträge nach <strong>§ 16i SGB II / ZGS Berlin</strong> (AWO Tarifeinigung 05.05.2026)
					</p>
				</div>
			</div>

			<div class="header-badges">
				<span class="tech-badge">Svelte 5 Runes</span>
				<span class="tech-badge">SvelteKit Remote Functions</span>
				<span class="tech-badge">Browser Automation Ready</span>
			</div>
		</div>
	</header>

	<!-- Main Body Content -->
	<main class="app-main">
		<!-- Configuration Toolbar -->
		<section class="config-bar">
			<div class="config-item scheme-selector">
				<label for="schemeSelect">Förderprogramm:</label>
				<select id="schemeSelect" bind:value={selectedSchemeId} onchange={triggerRecalculate}>
					{#each availableSchemes as scheme}
						<option value={scheme.id}>{scheme.name}</option>
					{/each}
					{#if availableSchemes.length === 0}
						<option value="sgb16i-berlin">§ 16i SGB II (Jobcenter + ZGS Berlin Landesmittel)</option>
					{/if}
				</select>
			</div>

			<div class="config-item">
				<span class="config-label">Laufzeit-Darstellung:</span>
				<div class="segmented-control">
					<button
						type="button"
						class="seg-btn {runtimeMode === 'full' ? 'active' : ''}"
						onclick={() => handleRuntimeModeChange('full')}
					>
						Vollständige 5 Jahre (60 Mo)
					</button>
					<button
						type="button"
						class="seg-btn {runtimeMode === 'restricted' ? 'active' : ''}"
						onclick={() => handleRuntimeModeChange('restricted')}
					>
						Formular-Begrenzung 2029 (41 Mo)
					</button>
				</div>
			</div>

			<div class="config-item offset-toggle">
				<label class="checkbox-label">
					<input
						type="checkbox"
						checked={includeOffset}
						onchange={(e) => handleToggleOffset((e.target as HTMLInputElement).checked)}
					/>
					<span class="custom-checkbox"></span>
					<span>Ausgleichszeilen (K-Hilfe Offset)</span>
				</label>
			</div>
		</section>

		<!-- Excel File Upload Dropzone -->
		<section class="upload-section">
			<FileUpload
				onResult={handleResult}
				selectedScheme={selectedSchemeId}
				{includeOffset}
				{restrictYear}
			/>
		</section>

		<!-- Active Calculation Results -->
		{#if currentResult}
			<section class="results-section">
				<!-- Confidence & Audit Dashboard -->
				<ControlDashboard
					controls={currentResult.controls}
					participant={currentResult.participant}
					{includeOffset}
					onToggleOffset={handleToggleOffset}
				/>

				<!-- Time-Varying AGA Rate Matrix Editor -->
				<AgaTimelineEditor
					timeline={currentResult.agaTimeline}
					participant={currentResult.participant}
					onUpdateTimeline={handleUpdateTimeline}
				/>

				<!-- Target Form Companion with 1-Click Clipboard Copying -->
				<TargetFormCompanion result={currentResult} />
			</section>
		{/if}
	</main>
</div>

<style>
	.page-container {
		max-width: 1380px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem 1.5rem;
	}

	.app-header {
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1.5rem;
	}

	.logo-area {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.logo-icon {
		width: 52px;
		height: 52px;
		border-radius: 14px;
		background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		box-shadow: 0 8px 20px -4px rgba(99, 102, 241, 0.5);
	}

	.logo-area h1 {
		margin: 0 0 0.25rem 0;
		font-size: 1.6rem;
		font-weight: 700;
		background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.subtitle {
		margin: 0;
		font-size: 0.925rem;
		color: #94a3b8;
		max-width: 680px;
	}

	.subtitle strong {
		color: #c7d2fe;
	}

	.header-badges {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.tech-badge {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		padding: 0.35rem 0.75rem;
		border-radius: 20px;
		font-size: 0.775rem;
		color: #a5b4fc;
		font-weight: 500;
	}

	.config-bar {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		padding: 0.9rem 1.25rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.config-item {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.config-item label,
	.config-label {
		font-size: 0.85rem;
		color: #94a3b8;
		font-weight: 500;
	}

	.scheme-selector select {
		background: #0f172a;
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: #ffffff;
		padding: 0.45rem 0.85rem;
		border-radius: 6px;
		font-size: 0.875rem;
		outline: none;
		cursor: pointer;
	}

	.segmented-control {
		display: flex;
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		padding: 2px;
	}

	.seg-btn {
		background: transparent;
		border: none;
		color: #94a3b8;
		padding: 0.35rem 0.75rem;
		border-radius: 4px;
		font-size: 0.825rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.seg-btn:hover {
		color: #ffffff;
	}

	.seg-btn.active {
		background: #6366f1;
		color: #ffffff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.85rem;
		color: #cbd5e1;
		user-select: none;
	}

	.checkbox-label input {
		cursor: pointer;
		accent-color: #6366f1;
	}

	.results-section {
		animation: fadeIn 0.3s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
