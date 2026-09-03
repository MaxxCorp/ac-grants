<script lang="ts">
	import { onMount } from 'svelte';
	import { getAvailableSchemes, recalculateGrant, processExcelFile } from '#lib/grant.remote';
	import { transformSgb16i, transformSgb16iMulti } from '#lib/grants/sgb16i';
	import { transformBerlinerJobCoachingMulti, generateStandardJobCoachingDemoDatasets } from '#lib/grants/berliner-jobcoaching';
	import type { GrantTransformationResult, AgaRatePeriod, RuntimeScope, RuntimeStartScope, MonthlyRecord, ParticipantInfo, ParticipantDataset } from '#lib/types/grant';
	import FileUpload from '#lib/components/FileUpload.svelte';
	import ControlDashboard from '#lib/components/ControlDashboard.svelte';
	import AwoTariffAuditCard from '#lib/components/AwoTariffAuditCard.svelte';
	import TargetFormCompanion from '#lib/components/TargetFormCompanion.svelte';
	import JobCoachingPortalCompanion from '#lib/components/JobCoachingPortalCompanion.svelte';
	import AgaTimelineEditor from '#lib/components/AgaTimelineEditor.svelte';
	import BerechnungsblattGeneratorModal from '#lib/components/BerechnungsblattGeneratorModal.svelte';

	let availableSchemes = $state<any[]>([]);
	let selectedSchemeId = $state('sgb16i-berlin');
	let includeOffset = $state(true);
	let runtimeStartScope = $state<RuntimeStartScope>('contract_start'); // 'contract_start' | 'custom'
	let customStartDate = $state('');
	let runtimeScope = $state<RuntimeScope>('exit_date'); // 'exit_date' | 'foerderperiode' | 'full_5_years' | 'custom'
	let customEndDate = $state('');
	let currentResult = $state<GrantTransformationResult | null>(null);
	let isRecalculating = $state(false);
	let isGeneratorOpen = $state(false);

	function buildParticipantRecords(
		startYear: number,
		startMonth: number,
		weeklyHours: number,
		baseSalaries: { yr1: number; yr2: number; yr3: number },
		agaRate: number
	): MonthlyRecord[] {
		const records: MonthlyRecord[] = [];
		let currentDate = new Date(startYear, startMonth - 1, 1);

		for (let i = 0; i < 60; i++) {
			const y = currentDate.getFullYear();
			const m = currentDate.getMonth() + 1;
			const lastDay = new Date(y, m, 0).getDate();
			const mStr = String(m).padStart(2, '0');

			const fteSalary = y < 2027 ? baseSalaries.yr1 : y < 2029 ? baseSalaries.yr2 : baseSalaries.yr3;
			const partTimeSalary = (fteSalary * weeklyHours) / 39;
			const jcFlatRate = partTimeSalary * 0.19;
			const jcTotalGross = partTimeSalary + jcFlatRate;
			const degPct = i < 24 ? 100 : i < 36 ? 90 : i < 48 ? 80 : 70;

			records.push({
				date: `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`,
				year: y,
				month: m,
				monthUnits: 1.0,
				startDate: `01.${mStr}.${y}`,
				endDate: `${String(lastDay).padStart(2, '0')}.${mStr}.${y}`,
				fteSalary,
				partTimeSalary,
				weeklyHours,
				fullTimeHours: 39,
				jcFlatRateAmount: jcFlatRate,
				jcTotalGross,
				jcDegressionPct: degPct,
				jcGrantAmount: (jcTotalGross * degPct) / 100,
				agaRealRate: agaRate,
				agaRealAmount: partTimeSalary * agaRate,
				totalEmployerCost: partTimeSalary * (1 + agaRate),
				landSvShortfall: partTimeSalary * (agaRate - 0.19),
				landDegressionAmount: (jcTotalGross * (100 - degPct)) / 100,
				jszAmount: m === 12 ? Math.round(partTimeSalary * 0.85 * 100) / 100 : 0,
				jszAgaAmount: m === 12 ? Math.round(partTimeSalary * 0.85 * agaRate * 100) / 100 : 0,
				isJszMonth: m === 12,
				sachkostenAmount: 155
			});

			currentDate = new Date(y, m, 1);
		}
		return records;
	}

	function loadDemoData() {
		if (selectedSchemeId === 'berliner-jobcoaching') {
			runtimeStartScope = 'custom';
			customStartDate = '01.01.2027';
			runtimeScope = 'custom';
			customEndDate = '31.12.2027';

			const jcDatasets = generateStandardJobCoachingDemoDatasets(2027);

			const res = transformBerlinerJobCoachingMulti(jcDatasets, {
				includeOffsetRows: includeOffset,
				runtimeStartScope: 'custom',
				customStartDate: '01.01.2027',
				runtimeScope: 'custom',
				customEndDate: '31.12.2027'
			});

			handleResult(res);
			return;
		}

		// Participant 1: Max Mustermann (EG2/ES1, 30h, AOK Nordost)
		const p1: ParticipantInfo = {
			name: 'Max Mustermann',
			tariffGroup: 'EG2',
			tariffStep: 'ES1',
			runtimeStart: '01.08.2026',
			runtimeEnd: '31.07.2031',
			weeklyHours: 30,
			fullTimeHours: 39,
			sachkostenMonthly: 155,
			childrenCount: 1,
			healthInsuranceName: 'AOK Nordost (15,9%)',
			defaultAgaRate: 0.23815,
			jobcenterId: 'JC-BER-2026-081',
			zgsId: 'ZGS-PR-4011'
		};
		const records1 = buildParticipantRecords(2026, 8, 30, { yr1: 2576.77, yr2: 2688.48, yr3: 2774.73 }, 0.23815);

		// Participant 2: Erika Musterfrau (EG3/ES2, 35h, Barmer)
		const p2: ParticipantInfo = {
			name: 'Erika Musterfrau',
			tariffGroup: 'EG3',
			tariffStep: 'ES2',
			runtimeStart: '01.10.2026',
			runtimeEnd: '30.09.2031',
			weeklyHours: 35,
			fullTimeHours: 39,
			sachkostenMonthly: 155,
			childrenCount: 0,
			healthInsuranceName: 'Barmer (16,79%)',
			defaultAgaRate: 0.2324,
			jobcenterId: 'JC-BER-2026-082',
			zgsId: 'ZGS-PR-4011'
		};
		const records2 = buildParticipantRecords(2026, 10, 35, { yr1: 2750.00, yr2: 2860.00, yr3: 2980.00 }, 0.2324);

		const demoDatasets: ParticipantDataset[] = [
			{ participant: p1, records: records1 },
			{ participant: p2, records: records2 }
		];

		const res = transformSgb16iMulti(demoDatasets, {
			includeOffsetRows: includeOffset,
			runtimeStartScope,
			customStartDate: runtimeStartScope === 'custom' ? customStartDate : undefined,
			runtimeScope,
			customEndDate: runtimeScope === 'custom' ? customEndDate : undefined
		});

		handleResult(res);
	}

	onMount(async () => {
		try {
			// Fetch schemes from Remote Query
			const schemes = await getAvailableSchemes();
			availableSchemes = schemes;
		} catch (err) {
			console.error('Initial load error:', err);
		}
	});

	async function handleResult(res: GrantTransformationResult) {
		currentResult = res;
		if (res.options?.runtimeStartScope) {
			runtimeStartScope = res.options.runtimeStartScope;
		}
		if (res.options?.customStartDate) {
			customStartDate = res.options.customStartDate;
		} else if (!customStartDate && res.participant?.runtimeStart) {
			customStartDate = res.participant.runtimeStart;
		}
		if (res.options?.runtimeScope) {
			runtimeScope = res.options.runtimeScope;
		}
		if (res.options?.customEndDate) {
			customEndDate = res.options.customEndDate;
		} else if (!customEndDate && res.participant?.runtimeEnd) {
			customEndDate = res.participant.runtimeEnd;
		}
	}

	async function handleToggleOffset(val: boolean) {
		includeOffset = val;
		if (currentResult) {
			await triggerRecalculate();
		}
	}

	async function handleRuntimeStartScopeChange(val: RuntimeStartScope) {
		runtimeStartScope = val;
		if (val === 'custom' && !customStartDate && currentResult?.participant?.runtimeStart) {
			customStartDate = currentResult.participant.runtimeStart;
		}
		if (currentResult) {
			await triggerRecalculate();
		}
	}

	async function handleRuntimeScopeChange(val: RuntimeScope) {
		runtimeScope = val;
		if (val === 'custom' && !customEndDate && currentResult?.participant?.runtimeEnd) {
			customEndDate = currentResult.participant.runtimeEnd;
		}
		if (currentResult) {
			await triggerRecalculate();
		}
	}

	async function handleUpdateTimeline(newTimeline: AgaRatePeriod[]) {
		if (currentResult) {
			isRecalculating = true;
			try {
				const hasMulti = currentResult.participants && currentResult.participants.length > 0;
				const updated = await recalculateGrant({
					schemeId: selectedSchemeId,
					records: currentResult.rawMonthlyRecords,
					participant: currentResult.participant,
					participants: hasMulti
						? currentResult.participants!.map(p => ({
							participant: p.participant,
							records: p.records
						}))
						: undefined,
					options: {
						includeOffsetRows: includeOffset,
						runtimeStartScope,
						customStartDate: runtimeStartScope === 'custom' ? customStartDate : undefined,
						runtimeScope,
						customEndDate: runtimeScope === 'custom' ? customEndDate : undefined,
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
		if (selectedSchemeId === 'berliner-jobcoaching') {
			if (!customStartDate) {
				runtimeStartScope = 'custom';
				customStartDate = '01.01.2027';
			}
			if (!customEndDate) {
				runtimeScope = 'custom';
				customEndDate = '31.12.2027';
			}
		}

		if (currentResult) {
			isRecalculating = true;
			try {
				const hasMulti = currentResult.participants && currentResult.participants.length > 0;
				const updated = await recalculateGrant({
					schemeId: selectedSchemeId,
					records: currentResult.rawMonthlyRecords,
					participant: currentResult.participant,
					participants: hasMulti
						? currentResult.participants!.map(p => ({
							participant: p.participant,
							records: p.records
						}))
						: undefined,
					options: {
						includeOffsetRows: includeOffset,
						runtimeStartScope,
						customStartDate: runtimeStartScope === 'custom' ? customStartDate : undefined,
						runtimeScope,
						customEndDate: runtimeScope === 'custom' ? customEndDate : undefined,
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

	async function handleUpdateJobCoachingOptions(opts: any) {
		if (!currentResult) return;
		isRecalculating = true;
		try {
			const hasMulti = currentResult.participants && currentResult.participants.length > 0;
			const updated = await recalculateGrant({
				schemeId: selectedSchemeId,
				records: currentResult.rawMonthlyRecords,
				participant: currentResult.participant,
				participants: hasMulti
					? currentResult.participants!.map(p => ({
							participant: p.participant,
							records: p.records
						}))
					: undefined,
				options: {
					includeOffsetRows: includeOffset,
					runtimeStartScope,
					customStartDate: runtimeStartScope === 'custom' ? customStartDate : undefined,
					runtimeScope,
					customEndDate: runtimeScope === 'custom' ? customEndDate : undefined,
					...opts
				}
			});
			currentResult = updated;
		} catch (err) {
			console.error('JobCoaching options recalculation error:', err);
		} finally {
			isRecalculating = false;
		}
	}

	async function removeParticipant(index: number) {
		if (!currentResult?.participants || currentResult.participants.length <= 1) return;
		const remaining = currentResult.participants.filter((_, i) => i !== index);
		isRecalculating = true;
		try {
			const updated = await recalculateGrant({
				schemeId: selectedSchemeId,
				participants: remaining.map(p => ({
					participant: p.participant,
					records: p.records
				})),
				options: {
					includeOffsetRows: includeOffset,
					runtimeStartScope,
					customStartDate: runtimeStartScope === 'custom' ? customStartDate : undefined,
					runtimeScope,
					customEndDate: runtimeScope === 'custom' ? customEndDate : undefined
				}
			});
			currentResult = updated;
		} catch (err) {
			console.error('Error removing participant:', err);
		} finally {
			isRecalculating = false;
		}
	}

	async function handleAppendParticipantFromGenerator(newRes: GrantTransformationResult) {
		const existingDatasets: ParticipantDataset[] = currentResult?.participants && currentResult.participants.length > 0
			? currentResult.participants.map(p => ({ participant: p.participant, records: p.records }))
			: (currentResult ? [{ participant: currentResult.participant, records: currentResult.rawMonthlyRecords }] : []);

		const newDatasets: ParticipantDataset[] = newRes.participants && newRes.participants.length > 0
			? newRes.participants.map(p => ({ participant: p.participant, records: p.records }))
			: [{ participant: newRes.participant, records: newRes.rawMonthlyRecords }];

		const combinedDatasets = [...existingDatasets, ...newDatasets];

		isRecalculating = true;
		try {
			const updated = await recalculateGrant({
				schemeId: selectedSchemeId,
				participants: combinedDatasets,
				options: {
					includeOffsetRows: includeOffset,
					runtimeStartScope,
					customStartDate: runtimeStartScope === 'custom' ? customStartDate : undefined,
					runtimeScope,
					customEndDate: runtimeScope === 'custom' ? customEndDate : undefined
				}
			});
			currentResult = updated;
		} catch (err) {
			console.error('Error adding generated participant:', err);
		} finally {
			isRecalculating = false;
		}
	}

	async function handleAppendFileInput(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			const file = target.files[0];
			const reader = new FileReader();
			reader.onload = async (evt) => {
				try {
					isRecalculating = true;
					const resultStr = evt.target?.result as string;
					const base64 = resultStr.split(',')[1] || resultStr;
					const newRes = await processExcelFile({
						fileBase64: base64,
						fileName: file.name,
						schemeId: selectedSchemeId,
						includeOffsetRows: includeOffset,
						runtimeScope,
						customEndDate,
						runtimeStartScope,
						customStartDate
					});

					await handleAppendParticipantFromGenerator(newRes);
				} catch (err) {
					console.error('Error appending participant from file:', err);
				} finally {
					isRecalculating = false;
					target.value = '';
				}
			};
			reader.readAsDataURL(file);
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
		<!-- Excel File Upload Dropzone -->
		<section class="upload-section">
			<FileUpload
				onResult={handleResult}
				selectedScheme={selectedSchemeId}
				{includeOffset}
				{runtimeStartScope}
				{customStartDate}
				{runtimeScope}
				{customEndDate}
				onOpenGenerator={() => (isGeneratorOpen = true)}
			/>

			<div class="demo-trigger-wrapper">
				<button type="button" class="btn-demo-data" onclick={loadDemoData}>
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
					</svg>
					✨ Standard-Beispieldaten laden (60 Monate Musterberechnung)
				</button>
			</div>
		</section>

		<!-- Configuration Toolbar (Förderprogramm & Ausgabe-Optionen) -->
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

			<!-- Visually Grouped Output Range Controls (Stacked One Above the Other) -->
			<div class="runtime-scope-group">
				<!-- Row 1: Start of Output Generation -->
				<div class="runtime-config-row">
					<span class="config-label">Ausgabe ab:</span>
					<div class="segmented-control">
						<button
							type="button"
							class="seg-btn {runtimeStartScope === 'contract_start' ? 'active' : ''}"
							onclick={() => handleRuntimeStartScopeChange('contract_start')}
							title="Standard: Ausgabe ab Vertragsbeginn laut Excel Zelle F2 ({currentResult?.participant?.runtimeStart || 'Zelle F2'})"
						>
							Ab Vertragsbeginn {currentResult?.participant?.runtimeStart ? `(${currentResult.participant.runtimeStart})` : 'Zelle F2'}
						</button>
						<button
							type="button"
							class="seg-btn {runtimeStartScope === 'custom' ? 'active' : ''}"
							onclick={() => handleRuntimeStartScopeChange('custom')}
							title="Beliebiges individuelles Berechnungs-Startdatum angeben"
						>
							Freies Startdatum...
						</button>
					</div>

					{#if runtimeStartScope === 'custom'}
						<div class="custom-date-picker">
							<label for="customStartDateInput" class="custom-date-label">Start:</label>
							<input
								id="customStartDateInput"
								type="text"
								placeholder="DD.MM.YYYY"
								class="custom-date-input"
								bind:value={customStartDate}
								onchange={() => triggerRecalculate()}
								onkeydown={(e) => e.key === 'Enter' && triggerRecalculate()}
							/>
							<button
								type="button"
								class="btn-apply-date"
								onclick={() => triggerRecalculate()}
								title="Startdatum anwenden"
							>
								Anwenden
							</button>
						</div>
					{/if}
				</div>

				<!-- Row 2: End of Output Generation -->
				<div class="runtime-config-row">
					<span class="config-label">Ausgabe bis:</span>
					<div class="segmented-control">
						<button
							type="button"
							class="seg-btn {runtimeScope === 'exit_date' ? 'active' : ''}"
							onclick={() => handleRuntimeScopeChange('exit_date')}
							title="Standard: Berechnung nur bis zum aktuellen Vertragsende laut Excel Zelle F2 ({currentResult?.participant?.runtimeEnd || 'Zelle F2'})"
						>
							Bis Austrittsdatum {currentResult?.participant?.runtimeEnd ? `(${currentResult.participant.runtimeEnd})` : 'Zelle F2'}
						</button>
						<button
							type="button"
							class="seg-btn {runtimeScope === 'foerderperiode' ? 'active' : ''}"
							onclick={() => handleRuntimeScopeChange('foerderperiode')}
							title="Förderperiode: Berechnung bis zum Ende der aktuellen Förderperiode (31.12.2029)"
						>
							Förderperiode (bis 31.12.2029)
						</button>
						<button
							type="button"
							class="seg-btn {runtimeScope === 'full_5_years' ? 'active' : ''}"
							onclick={() => handleRuntimeScopeChange('full_5_years')}
							title="Vollständige 5 Jahre (60 Monate) generieren"
						>
							Vollständige 5 Jahre (60 Mo)
						</button>
						<button
							type="button"
							class="seg-btn {runtimeScope === 'custom' ? 'active' : ''}"
							onclick={() => handleRuntimeScopeChange('custom')}
							title="Beliebiges individuelles Berechnungs-Enddatum angeben"
						>
							Freies Enddatum...
						</button>
					</div>

					{#if runtimeScope === 'custom'}
						<div class="custom-date-picker">
							<label for="customEndDateInput" class="custom-date-label">Ende:</label>
							<input
								id="customEndDateInput"
								type="text"
								placeholder="DD.MM.YYYY"
								class="custom-date-input"
								bind:value={customEndDate}
								onchange={() => triggerRecalculate()}
								onkeydown={(e) => e.key === 'Enter' && triggerRecalculate()}
							/>
							<button
								type="button"
								class="btn-apply-date"
								onclick={() => triggerRecalculate()}
								title="Enddatum anwenden"
							>
								Anwenden
							</button>
						</div>
					{/if}
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

		<!-- Active Calculation Results -->
		{#if currentResult}
			<section class="results-section">
				<!-- Participant Management Toolbar -->
				<div class="participant-mgmt-toolbar">
					<div class="mgmt-left">
						<div class="mgmt-title-wrap">
							<span class="mgmt-icon">👥</span>
							<span class="mgmt-title">Projekt-Teilnehmende ({currentResult.participants?.length || 1}):</span>
						</div>
						<div class="mgmt-chips">
							{#if currentResult.participants && currentResult.participants.length > 1}
								{#each currentResult.participants as pData, idx}
									<div class="participant-mgmt-chip">
										<span class="chip-avatar">👤</span>
										<span class="chip-name">{pData.participant.name || `TLN ${idx + 1}`}</span>
										<span class="chip-badge">{pData.participant.tariffGroup}/{pData.participant.tariffStep} ({pData.participant.weeklyHours}h)</span>
										<button
											type="button"
											class="chip-remove-btn"
											onclick={() => removeParticipant(idx)}
											title="{pData.participant.name} aus dem Projekt entfernen"
										>
											×
										</button>
									</div>
								{/each}
							{:else}
								<div class="participant-mgmt-chip">
									<span class="chip-avatar">👤</span>
									<span class="chip-name">{currentResult.participant.name}</span>
									<span class="chip-badge">{currentResult.participant.tariffGroup}/{currentResult.participant.tariffStep} ({currentResult.participant.weeklyHours}h)</span>
								</div>
							{/if}
						</div>
					</div>

					<div class="mgmt-actions">
						<label class="btn-mgmt-action add-file-btn" title="Weiteres Berechnungsblatt zum aktuellen Projekt hinzufügen">
							<input type="file" accept=".xlsx, .xls" class="hidden-file-input" onchange={handleAppendFileInput} />
							➕ Berechnungsblatt hinzufügen
						</label>
						<button type="button" class="btn-mgmt-action add-gen-btn" onclick={() => (isGeneratorOpen = true)} title="Weiteren Teilnehmer im Projekt neu generieren">
							➕ Weiteren TLN generieren
						</button>
					</div>
				</div>

				<!-- AWO Tariff Audit & Human Error Detection -->
				<AwoTariffAuditCard
					validation={currentResult.tariffValidation}
					participant={currentResult.participant}
					records={currentResult.rawMonthlyRecords}
					participants={currentResult.participants}
				/>

				<!-- Time-Dependent Employer Social Contribution (AGA) Matrix (for SGB 16i) -->
				{#if currentResult.schemeId !== 'berliner-jobcoaching'}
					<AgaTimelineEditor
						timeline={currentResult.agaTimeline}
						participant={currentResult.participant}
						onUpdateTimeline={handleUpdateTimeline}
					/>
				{/if}

				<!-- Confidence & Audit Dashboard -->
				<ControlDashboard
					controls={currentResult.controls}
					participant={currentResult.participant}
					participants={currentResult.participants}
					{includeOffset}
					onToggleOffset={handleToggleOffset}
				/>

				<!-- Target Form Companion with 1-Click Clipboard Copying -->
				{#if currentResult.schemeId === 'berliner-jobcoaching'}
					<JobCoachingPortalCompanion
						result={currentResult}
						onUpdateOptions={handleUpdateJobCoachingOptions}
					/>
				{:else}
					<TargetFormCompanion result={currentResult} />
				{/if}
			</section>
		{/if}

		<!-- Berechnungsblatt Generator Modal -->
		<BerechnungsblattGeneratorModal
			bind:isOpen={isGeneratorOpen}
			onClose={() => (isGeneratorOpen = false)}
			onResult={handleResult}
			onAppendParticipant={handleAppendParticipantFromGenerator}
			hasExistingProject={currentResult !== null}
			selectedScheme={selectedSchemeId}
		/>
	</main>
</div>

<style>
	.page-container {
		width: 100%;
		max-width: 1560px;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 4rem 1.25rem;
		box-sizing: border-box;
	}

	@media (min-width: 1680px) {
		.page-container {
			max-width: 1680px;
		}
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

	.upload-section {
		margin-bottom: 1.5rem;
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
		flex-wrap: wrap;
	}

	.runtime-scope-group {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		background: rgba(15, 23, 42, 0.45);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 0.65rem 0.9rem;
	}

	.runtime-config-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.runtime-config-row .config-label {
		min-width: 82px;
		font-size: 0.85rem;
		color: #94a3b8;
		font-weight: 500;
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
		flex-wrap: wrap;
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
		white-space: nowrap;
	}

	.seg-btn:hover {
		color: #ffffff;
	}

	.seg-btn.active {
		background: #6366f1;
		color: #ffffff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
	}

	.custom-date-picker {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(15, 23, 42, 0.9);
		border: 1px solid rgba(99, 102, 241, 0.4);
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		animation: fadeIn 0.2s ease;
	}

	.custom-date-label {
		font-size: 0.8rem;
		color: #a5b4fc;
		white-space: nowrap;
	}

	.custom-date-input {
		background: #1e293b;
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: #ffffff;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.825rem;
		width: 105px;
		outline: none;
		text-align: center;
	}

	.custom-date-input:focus {
		border-color: #6366f1;
	}

	.btn-apply-date {
		background: #6366f1;
		border: none;
		color: #ffffff;
		padding: 0.25rem 0.6rem;
		border-radius: 4px;
		font-size: 0.775rem;
		cursor: pointer;
		font-weight: 500;
		transition: background 0.15s ease;
	}

	.btn-apply-date:hover {
		background: #4f46e5;
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

	.demo-trigger-wrapper {
		display: flex;
		justify-content: center;
		margin-top: 1rem;
	}

	.btn-demo-data {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1.1rem;
		background: rgba(99, 102, 241, 0.12);
		border: 1px dashed rgba(129, 140, 248, 0.4);
		border-radius: 8px;
		color: #c7d2fe;
		font-size: 0.825rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-demo-data:hover {
		background: rgba(99, 102, 241, 0.25);
		border-color: #818cf8;
		color: #ffffff;
		transform: translateY(-1px);
	}

	.results-section {
		animation: fadeIn 0.3s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* Participant Management Toolbar */
	.participant-mgmt-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(56, 189, 248, 0.25);
		border-radius: 12px;
		margin-bottom: 1.5rem;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
	}

	.mgmt-left {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.mgmt-title-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.mgmt-icon {
		font-size: 1.2rem;
	}

	.mgmt-title {
		font-size: 0.85rem;
		font-weight: 700;
		color: #e2e8f0;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.mgmt-chips {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.participant-mgmt-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.75rem;
		background: rgba(30, 41, 59, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		color: #f1f5f9;
		font-size: 0.825rem;
	}

	.chip-avatar {
		font-size: 0.9rem;
	}

	.chip-name {
		font-weight: 600;
	}

	.chip-badge {
		font-size: 0.72rem;
		color: #94a3b8;
		background: rgba(0, 0, 0, 0.25);
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
	}

	.chip-remove-btn {
		background: transparent;
		border: none;
		color: #94a3b8;
		font-size: 1.1rem;
		cursor: pointer;
		line-height: 1;
		padding: 0 0.15rem;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.chip-remove-btn:hover {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.15);
	}

	.mgmt-actions {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.hidden-file-input {
		display: none;
	}

	.btn-mgmt-action {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.85rem;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.add-file-btn {
		background: rgba(56, 189, 248, 0.15);
		border: 1px solid rgba(56, 189, 248, 0.35);
		color: #38bdf8;
	}

	.add-file-btn:hover {
		background: rgba(56, 189, 248, 0.25);
		border-color: #38bdf8;
		color: #ffffff;
	}

	.add-gen-btn {
		background: rgba(129, 140, 248, 0.15);
		border: 1px solid rgba(129, 140, 248, 0.35);
		color: #a5b4fc;
	}

	.add-gen-btn:hover {
		background: rgba(129, 140, 248, 0.25);
		border-color: #818cf8;
		color: #ffffff;
	}
</style>
