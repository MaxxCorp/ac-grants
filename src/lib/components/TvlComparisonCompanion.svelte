<script lang="ts">
	import type { GrantTransformationResult, InsuranceFundDetails, TvlComparisonInputs, TvlComparisonResult } from '#lib/types/grant';
	import { calculateTvlComparison } from '#lib/grants/tvl-comparison';
	import { downloadTvlExcelFile } from '#lib/grants/tvl-template-exporter';

	let {
		result
	}: {
		result: GrantTransformationResult;
	} = $props();

	// Active year selection
	const availableYears = $derived(result.years && result.years.length > 0 ? result.years : [2026]);
	let customSelectedYear = $state<number | null>(null);
	const selectedYear = $derived<number>(
		customSelectedYear !== null && availableYears.includes(customSelectedYear)
			? customSelectedYear
			: (availableYears.includes(2026) ? 2026 : (availableYears[availableYears.length - 1] || 2026))
	);

	// Custom inputs state for real-time adjustments
	let customInputs = $state<Partial<TvlComparisonInputs>>({});

	// Derived insurance funds
	const insuranceFunds = $derived<InsuranceFundDetails[]>(result.insuranceFunds || []);

	// Active TV-L calculation result
	const tvl = $derived.by<TvlComparisonResult>(() => {
		return calculateTvlComparison(
			result.rawMonthlyRecords,
			result.participant,
			selectedYear,
			customInputs,
			insuranceFunds
		);
	});

	// Copy feedback state
	let copiedField = $state<string | null>(null);
	let copiedTimeout: any = null;

	function copyValue(text: string | number | undefined | null, fieldKey: string, isCurrency = true) {
		if (text === undefined || text === null) return;
		const textToCopy = typeof text === 'number'
			? (isCurrency
				? text.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
				: text.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 4 }))
			: String(text);

		navigator.clipboard.writeText(textToCopy);
		copiedField = fieldKey;
		if (copiedTimeout) clearTimeout(copiedTimeout);
		copiedTimeout = setTimeout(() => {
			copiedField = null;
		}, 1800);
	}

	function formatCurrency(val: number): string {
		return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
	}

	function formatPercent(val: number): string {
		return (val * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + ' %';
	}

	function handleInsuranceChange(fundName: string) {
		const fund = insuranceFunds.find(f => f.name === fundName);
		if (fund) {
			customInputs = {
				...customInputs,
				selectedInsuranceName: fund.name,
				kkZusatzRate: fund.zusatzbeitragAg,
				u1Rate: fund.u1Rate,
				u2Rate: fund.u2Rate,
				u3Rate: fund.u3Rate
			};
		} else {
			customInputs = {
				...customInputs,
				selectedInsuranceName: fundName
			};
		}
	}

	let showDiscrepancies = $state(false);

	function applyOfficialAwoTariffValues() {
		customInputs = {
			...customInputs,
			istJanMarLeft: tvl.expectedIstJanMarLeft,
			istAbAprLeft: tvl.expectedIstAbAprLeft,
			istJanMarRight: tvl.expectedIstJanMarRight,
			istAbAprRight: tvl.expectedIstAbAprRight
		};
		copiedField = 'applied-official-tariffs';
		if (copiedTimeout) clearTimeout(copiedTimeout);
		copiedTimeout = setTimeout(() => {
			copiedField = null;
		}, 2000);
	}

	function copyInputsTSV() {
		const lines = [
			['Jahr', tvl.year],
			['Träger', tvl.inputs.traegerName],
			['Antragsdatum', tvl.inputs.antragsdatum],
			['Projektnummer', tvl.inputs.projektnummer],
			['Name / Vorname', tvl.inputs.participantName],
			['Qualifikation', tvl.inputs.qualifikation],
			['Tätigkeit beim Träger', tvl.inputs.taetigkeit],
			['Eintrittsdatum', tvl.inputs.eintrittsdatum],
			['Eingruppierung TV-L (links)', tvl.inputs.tariffGroupStepLeft],
			['Zeitraum von (links)', tvl.inputs.startDateLeft],
			['Zeitraum bis (links)', tvl.inputs.endDateLeft],
			['Wochenarbeitszeit (links)', tvl.inputs.weeklyHoursLeft],
			['Ist-Entgelt Jan-März (links)', tvl.inputs.istJanMarLeft.toFixed(2)],
			['Ist-Entgelt ab April (links)', tvl.inputs.istAbAprLeft.toFixed(2)],
			['Krankenkasse', tvl.inputs.selectedInsuranceName],
			['Zusatzbeitrag AG %', (tvl.inputs.kkZusatzRate * 100).toFixed(2)],
			['Umlage 1 %', (tvl.inputs.u1Rate * 100).toFixed(2)],
			['Umlage 2 %', (tvl.inputs.u2Rate * 100).toFixed(2)],
			['Umlage 3 %', (tvl.inputs.u3Rate * 100).toFixed(2)]
		];

		if (tvl.inputs.hasStepUpgrade && tvl.periodRight) {
			lines.push(
				['Sprung in Erfahrungsstufe (rechts)', tvl.inputs.tariffGroupStepRight],
				['Zeitraum von (rechts)', tvl.inputs.startDateRight],
				['Zeitraum bis (rechts)', tvl.inputs.endDateRight],
				['Ist-Entgelt Jan-März (rechts)', tvl.inputs.istJanMarRight.toFixed(2)],
				['Ist-Entgelt ab April (rechts)', tvl.inputs.istAbAprRight.toFixed(2)],
				['Ist-JSZ (rechts)', tvl.inputs.istJszRight.toFixed(2)]
			);
		}

		const tsv = lines.map(l => l.join('\t')).join('\n');
		navigator.clipboard.writeText(tsv);
		copiedField = 'all-inputs-tsv';
		if (copiedTimeout) clearTimeout(copiedTimeout);
		copiedTimeout = setTimeout(() => {
			copiedField = null;
		}, 1800);
	}

	// Group available tariffs by Entgeltgruppe for structured optgroups
	const tariffGroups = $derived.by(() => {
		const map = new Map<string, string[]>();
		for (const code of tvl.availableTariffs) {
			const grp = code.split('/')[0] || 'Sonstige';
			if (!map.has(grp)) map.set(grp, []);
			map.get(grp)!.push(code);
		}
		return Array.from(map.entries()).map(([group, codes]) => ({ group, codes }));
	});

	function handleLeftTariffChange(newLeftCode: string) {
		const parts = newLeftCode.split('/');
		const grp = parts[0] || 'E2';
		const step = parts[1] ? parseInt(parts[1], 10) : 1;
		const nextStep = Math.min(6, step + 1);
		const suggestedRight = `${grp}/${nextStep}`;

		customInputs = {
			...customInputs,
			tariffGroupStepLeft: newLeftCode,
			tariffGroupStepRight: suggestedRight
		};
	}

	function handleDownload() {
		downloadTvlExcelFile(tvl);
	}
</script>

<div class="tvl-container">
	<!-- Top Bar: Title, Year Tabs & Quick Actions -->
	<div class="tvl-header">
		<div class="header-left">
			<div class="badge-title">
				<span class="badge-icon">⚖️</span>
				<h2>Vergleichsberechnung nach TV-L</h2>
			</div>
			<p class="header-desc">
				Gegenüberstellung des gezahlten Ist-Entgelts zum TV-L Tarif zur Einhaltung des <strong>Besserstellungsverbots</strong>
			</p>
		</div>

		<div class="header-actions">
			<!-- Year Selector -->
			<div class="year-pills">
				<span class="pill-label">Berechnungsjahr:</span>
				{#each availableYears as y}
					<button
						type="button"
						class="year-pill {selectedYear === y ? 'active' : ''}"
						onclick={() => { customSelectedYear = y; customInputs = {}; }}
					>
						{y}
					</button>
				{/each}
			</div>

			<div class="action-buttons">
				<button type="button" class="btn-apply-awo" onclick={applyOfficialAwoTariffValues} title="Offizielle AWO Berlin Tarifwerte für Ist-Entgelte übernehmen">
					{#if copiedField === 'applied-official-tariffs'}
						✓ AWO-Werte angewendet!
					{:else}
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
						</svg>
						AWO-Tarifwerte anwenden
					{/if}
				</button>

				<button type="button" class="btn-copy-tsv" onclick={copyInputsTSV}>
					{#if copiedField === 'all-inputs-tsv'}
						✓ Eingabefelder kopiert!
					{:else}
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
						</svg>
						Eingaben kopieren (TSV)
					{/if}
				</button>

				<button type="button" class="btn-download-excel" onclick={handleDownload}>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
						<polyline points="7 10 12 15 17 10"></polyline>
						<line x1="12" y1="15" x2="12" y2="3"></line>
					</svg>
					Excel (.xlsx) exportieren
				</button>
			</div>
		</div>
	</div>

	<!-- Compliance Status & Summary Cards -->
	<div class="compliance-banner {tvl.isBesserstellungsverbotCompliant ? 'compliant' : 'exceeded'}">
		<div class="compliance-status">
			<div class="status-icon-box">
				{#if tvl.isBesserstellungsverbotCompliant}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
						<polyline points="22 4 12 14.01 9 11.01"></polyline>
					</svg>
				{:else}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="12" y1="8" x2="12" y2="12"></line>
						<line x1="12" y1="16" x2="12.01" y2="16"></line>
					</svg>
				{/if}
			</div>
			<div>
				<div class="status-title">
					{#if tvl.isBesserstellungsverbotCompliant}
						Das Besserstellungsverbot wird eingehalten
					{:else}
						Achtung: Besserstellungsverbot überschritten!
					{/if}
				</div>
				<div class="status-sub">
					{#if tvl.isBesserstellungsverbotCompliant}
						Ist-Personalkosten liegen um <strong>{formatCurrency(Math.abs(tvl.totalDifference))}</strong> unter den zulässigen TV-L Höchstkosten für {selectedYear}.
					{:else}
						Ist-Personalkosten übersteigen den TV-L Höchstbetrag um <strong>{formatCurrency(tvl.totalDifference)}</strong>. Bitte Anpassung prüfen!
					{/if}
				</div>
			</div>
		</div>

		<div class="summary-stat-group">
			<div class="stat-card">
				<span class="stat-label">TV-L Höchstbetrag ({selectedYear})</span>
				<span class="stat-value font-mono">{formatCurrency(tvl.totalPersonalkostenTvl)}</span>
				<span class="stat-sub">Ø {formatCurrency(tvl.avgMonthlyAgGrossTvl)} / Monat</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Ist-Personalkosten Träger</span>
				<span class="stat-value font-mono">{formatCurrency(tvl.totalPersonalkostenIst)}</span>
				<span class="stat-sub">Ø {formatCurrency(tvl.avgMonthlyAgGrossIst)} / Monat</span>
			</div>
			<div class="stat-card highlight">
				<span class="stat-label">Differenz (Ist − TV-L)</span>
				<span class="stat-value font-mono {tvl.totalDifference <= 0 ? 'text-emerald' : 'text-rose'}">
					{tvl.totalDifference > 0 ? '+' : ''}{formatCurrency(tvl.totalDifference)}
				</span>
				<span class="stat-sub">{tvl.totalDifference <= 0 ? 'Günstiger als TV-L' : 'Überschreitung'}</span>
			</div>
		</div>
	</div>

	<!-- 1. Stammdaten & Allgemeine Angaben -->
	<div class="section-card">
		<div class="section-header">
			<span class="section-number">1</span>
			<h3>Allgemeine Angaben & Stammdaten</h3>
			<span class="section-hint">Klick auf ein Feld oder Button kopiert den Wert für Excel</span>
		</div>

		<div class="fields-grid-4">
			<div class="form-field">
				<label for="tvl-traeger">Träger (Zelle E2):</label>
				<div class="input-with-copy">
					<input
						id="tvl-traeger"
						type="text"
						class="field-input excel-blue"
						value={tvl.inputs.traegerName}
						oninput={(e) => (customInputs = { ...customInputs, traegerName: (e.target as HTMLInputElement).value })}
					/>
					<button type="button" class="btn-cell-copy" onclick={() => copyValue(tvl.inputs.traegerName, 'traeger', false)} title="Wert kopieren">
						{copiedField === 'traeger' ? '✓' : '📋'}
					</button>
				</div>
			</div>

			<div class="form-field">
				<label for="tvl-antragsdatum">Antrag vom (Zelle E3):</label>
				<div class="input-with-copy">
					<input
						id="tvl-antragsdatum"
						type="text"
						class="field-input excel-blue"
						value={tvl.inputs.antragsdatum}
						oninput={(e) => (customInputs = { ...customInputs, antragsdatum: (e.target as HTMLInputElement).value })}
					/>
					<button type="button" class="btn-cell-copy" onclick={() => copyValue(tvl.inputs.antragsdatum, 'antragsdatum', false)} title="Wert kopieren">
						{copiedField === 'antragsdatum' ? '✓' : '📋'}
					</button>
				</div>
			</div>

			<div class="form-field">
				<label for="tvl-projektnummer">Projektnummer (Zelle E4):</label>
				<div class="input-with-copy">
					<input
						id="tvl-projektnummer"
						type="text"
						class="field-input excel-blue"
						value={tvl.inputs.projektnummer}
						oninput={(e) => (customInputs = { ...customInputs, projektnummer: (e.target as HTMLInputElement).value })}
					/>
					<button type="button" class="btn-cell-copy" onclick={() => copyValue(tvl.inputs.projektnummer, 'projektnummer', false)} title="Wert kopieren">
						{copiedField === 'projektnummer' ? '✓' : '📋'}
					</button>
				</div>
			</div>

			<div class="form-field">
				<label for="tvl-name">Name / Vorname (Zelle E5):</label>
				<div class="input-with-copy">
					<input
						id="tvl-name"
						type="text"
						class="field-input excel-blue"
						value={tvl.inputs.participantName}
						oninput={(e) => (customInputs = { ...customInputs, participantName: (e.target as HTMLInputElement).value })}
					/>
					<button type="button" class="btn-cell-copy" onclick={() => copyValue(tvl.inputs.participantName, 'name', false)} title="Wert kopieren">
						{copiedField === 'name' ? '✓' : '📋'}
					</button>
				</div>
			</div>

			<div class="form-field">
				<label for="tvl-quali">Qualifikation / Berufsabschluss (Zelle E6):</label>
				<div class="input-with-copy">
					<input
						id="tvl-quali"
						type="text"
						class="field-input excel-blue"
						value={tvl.inputs.qualifikation}
						oninput={(e) => (customInputs = { ...customInputs, qualifikation: (e.target as HTMLInputElement).value })}
					/>
					<button type="button" class="btn-cell-copy" onclick={() => copyValue(tvl.inputs.qualifikation, 'quali', false)} title="Wert kopieren">
						{copiedField === 'quali' ? '✓' : '📋'}
					</button>
				</div>
			</div>

			<div class="form-field">
				<label for="tvl-taetigkeit">Tätigkeit beim Träger (Zelle E7):</label>
				<div class="input-with-copy">
					<input
						id="tvl-taetigkeit"
						type="text"
						class="field-input excel-blue"
						value={tvl.inputs.taetigkeit}
						oninput={(e) => (customInputs = { ...customInputs, taetigkeit: (e.target as HTMLInputElement).value })}
					/>
					<button type="button" class="btn-cell-copy" onclick={() => copyValue(tvl.inputs.taetigkeit, 'taetigkeit', false)} title="Wert kopieren">
						{copiedField === 'taetigkeit' ? '✓' : '📋'}
					</button>
				</div>
			</div>

			<div class="form-field">
				<label for="tvl-eintritt">Tätig seit (Zelle K7):</label>
				<div class="input-with-copy">
					<input
						id="tvl-eintritt"
						type="text"
						class="field-input excel-blue"
						value={tvl.inputs.eintrittsdatum}
						oninput={(e) => (customInputs = { ...customInputs, eintrittsdatum: (e.target as HTMLInputElement).value })}
					/>
					<button type="button" class="btn-cell-copy" onclick={() => copyValue(tvl.inputs.eintrittsdatum, 'eintritt', false)} title="Wert kopieren">
						{copiedField === 'eintritt' ? '✓' : '📋'}
					</button>
				</div>
			</div>

			<div class="form-field">
				<label for="tvl-abweichend">Abweichende Tätigkeit (Zelle E8):</label>
				<div class="input-with-copy">
					<input
						id="tvl-abweichend"
						type="text"
						class="field-input excel-blue"
						value={tvl.inputs.abweichendeTaetigkeit || ''}
						placeholder="Optional"
						oninput={(e) => (customInputs = { ...customInputs, abweichendeTaetigkeit: (e.target as HTMLInputElement).value })}
					/>
					<button type="button" class="btn-cell-copy" onclick={() => copyValue(tvl.inputs.abweichendeTaetigkeit || '', 'abweichend', false)} title="Wert kopieren">
						{copiedField === 'abweichend' ? '✓' : '📋'}
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- 2. Dual Comparison Columns (Left Period & Right Period) -->
	<div class="dual-columns-grid">
		<!-- Left Section (Basis / Vor Stufenaufstieg) -->
		<div class="section-card period-card">
			<div class="section-header period-header">
				<div class="period-title-badge">
					<span class="badge-tag">Basis-Abschnitt</span>
					<h3>1. Zeitraum {tvl.inputs.hasStepUpgrade ? '(vor Stufenaufstieg)' : ''}</h3>
				</div>
			</div>

			<div class="period-controls-grid">
				<div class="form-field">
					<label for="tvl-tariff-left">Eingruppierung TV-L (E9):</label>
					<select
						id="tvl-tariff-left"
						class="field-select excel-blue"
						value={tvl.inputs.tariffGroupStepLeft}
						onchange={(e) => handleLeftTariffChange((e.target as HTMLSelectElement).value)}
					>
						{#each tariffGroups as grp}
							<optgroup label="Entgeltgruppe {grp.group}">
								{#each grp.codes as tCode}
									<option value={tCode}>{tCode}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</div>

				<div class="form-field">
					<label for="tvl-hours-left">Wöchentliche AZ (E12):</label>
					<div class="input-with-copy">
						<input
							id="tvl-hours-left"
							type="number"
							step="0.5"
							class="field-input excel-blue"
							value={tvl.inputs.weeklyHoursLeft}
							oninput={(e) => (customInputs = { ...customInputs, weeklyHoursLeft: parseFloat((e.target as HTMLInputElement).value) || 30 })}
						/>
						<span class="unit-addon">Std.</span>
					</div>
				</div>

				<div class="form-field">
					<label for="tvl-start-left">Von (E11):</label>
					<input
						id="tvl-start-left"
						type="text"
						class="field-input excel-blue"
						value={tvl.inputs.startDateLeft}
						oninput={(e) => (customInputs = { ...customInputs, startDateLeft: (e.target as HTMLInputElement).value })}
					/>
				</div>

				<div class="form-field">
					<label for="tvl-end-left">Bis (J11):</label>
					<input
						id="tvl-end-left"
						type="text"
						class="field-input excel-blue"
						value={tvl.inputs.endDateLeft}
						oninput={(e) => (customInputs = { ...customInputs, endDateLeft: (e.target as HTMLInputElement).value })}
					/>
				</div>
			</div>

			<!-- Calculation Table for Left Period -->
			<div class="period-table-wrapper">
				<table class="period-table">
					<thead>
						<tr>
							<th>Kostenposition</th>
							<th class="th-num">TV-L (39,4h)</th>
							<th class="th-num">TV-L ({tvl.inputs.weeklyHoursLeft}h)</th>
							<th class="th-num th-editable">Ist-Zahlung ({tvl.inputs.weeklyHoursLeft}h)</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td class="font-medium">
								mtl. Tabellenentgelt Jan–März
								<span class="cell-ref">K17</span>
							</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.tvl394JanMar)}</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.tvlUmJanMar)}</td>
							<td class="td-input">
								<div class="input-inline-copy">
									<input
										type="number"
										step="0.01"
										class="table-cell-input excel-blue"
										value={tvl.inputs.istJanMarLeft}
										oninput={(e) => (customInputs = { ...customInputs, istJanMarLeft: parseFloat((e.target as HTMLInputElement).value) || 0 })}
									/>
									<button type="button" class="btn-tiny-copy" onclick={() => copyValue(tvl.inputs.istJanMarLeft, 'istJanMarLeft')}>
										{copiedField === 'istJanMarLeft' ? '✓' : '📋'}
									</button>
								</div>
								{#if tvl.expectedIstJanMarLeft !== undefined}
									<div class="benchmark-pill">AWO: {formatCurrency(tvl.expectedIstJanMarLeft)}</div>
								{/if}
							</td>
						</tr>

						<tr>
							<td class="font-medium">
								mtl. Tabellenentgelt ab April
								<span class="cell-ref">K18</span>
							</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.tvl394AbApr)}</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.tvlUmAbApr)}</td>
							<td class="td-input">
								<div class="input-inline-copy">
									<input
										type="number"
										step="0.01"
										class="table-cell-input excel-blue"
										value={tvl.inputs.istAbAprLeft}
										oninput={(e) => (customInputs = { ...customInputs, istAbAprLeft: parseFloat((e.target as HTMLInputElement).value) || 0 })}
									/>
									<button type="button" class="btn-tiny-copy" onclick={() => copyValue(tvl.inputs.istAbAprLeft, 'istAbAprLeft')}>
										{copiedField === 'istAbAprLeft' ? '✓' : '📋'}
									</button>
								</div>
								{#if tvl.expectedIstAbAprLeft !== undefined}
									<div class="benchmark-pill">AWO: {formatCurrency(tvl.expectedIstAbAprLeft)}</div>
								{/if}
							</td>
						</tr>

						<tr class="row-subtotal">
							<td>Ø mtl. AN-Brutto ({tvl.periodLeft.totalMonths.toFixed(2)} Mo.)</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.avgMonthlyGross394)}</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.avgMonthlyGrossUm)}</td>
							<td class="text-right font-mono font-bold">{formatCurrency(tvl.periodLeft.avgMonthlyGrossIst)}</td>
						</tr>

						<tr>
							<td>AN-Brutto ohne JSZ</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.grossWithoutJsz394)}</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.grossWithoutJszUm)}</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.grossWithoutJszIst)}</td>
						</tr>

						<tr>
							<td>Jahressonderzahlung (JSZ)</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.jsz394)}</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.jszUm)}</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.jszIst)}</td>
						</tr>

						<tr class="row-subtotal">
							<td>AN-Brutto inkl. JSZ</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.grossWithJsz394)}</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.grossWithJszUm)}</td>
							<td class="text-right font-mono font-bold">{formatCurrency(tvl.periodLeft.grossWithJszIst)}</td>
						</tr>

						<tr>
							<td>Arbeitgeber-SV gesamt</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.totalAgSv394)}</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.totalAgSvUm)}</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.totalAgSvIst)}</td>
						</tr>

						<tr class="row-total">
							<td class="font-bold">Personalkosten Zeitraum (links)</td>
							<td class="text-right font-mono">{formatCurrency(tvl.periodLeft.personalkostenPeriod394)}</td>
							<td class="text-right font-mono text-indigo font-bold">{formatCurrency(tvl.periodLeft.personalkostenPeriodUm)}</td>
							<td class="text-right font-mono text-emerald font-bold">{formatCurrency(tvl.periodLeft.personalkostenPeriodIst)}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Right Section (Stufenaufstieg - Unterjährig) -->
		<div class="section-card period-card">
			<div class="section-header period-header">
				<div class="period-title-badge">
					<span class="badge-tag accent">Erfahrungsstufenaufstieg</span>
					<h3>2. Zeitraum (nach Stufenaufstieg)</h3>
				</div>

				<label class="toggle-container">
					<input
						type="checkbox"
						checked={tvl.inputs.hasStepUpgrade}
						onchange={(e) => (customInputs = { ...customInputs, hasStepUpgrade: (e.target as HTMLInputElement).checked })}
					/>
					<span class="toggle-slider"></span>
					<span class="toggle-text">Unterjähriger Aufstieg aktiv</span>
				</label>
			</div>

			{#if tvl.inputs.hasStepUpgrade && tvl.periodRight}
				<div class="period-controls-grid">
					<div class="form-field">
						<label for="tvl-tariff-right">Sprung in Stufe (P2):</label>
						<select
							id="tvl-tariff-right"
							class="field-select excel-blue"
							value={tvl.inputs.tariffGroupStepRight}
							onchange={(e) => (customInputs = { ...customInputs, tariffGroupStepRight: (e.target as HTMLSelectElement).value })}
						>
							{#each tariffGroups as grp}
								<optgroup label="Entgeltgruppe {grp.group}">
									{#each grp.codes as tCode}
										<option value={tCode}>{tCode}</option>
									{/each}
								</optgroup>
							{/each}
						</select>
					</div>

					<div class="form-field">
						<label for="tvl-hours-right">Wöchentliche AZ (P5):</label>
						<div class="input-with-copy">
							<input
								id="tvl-hours-right"
								type="number"
								step="0.5"
								class="field-input excel-blue"
								value={tvl.inputs.weeklyHoursRight}
								oninput={(e) => (customInputs = { ...customInputs, weeklyHoursRight: parseFloat((e.target as HTMLInputElement).value) || 30 })}
							/>
							<span class="unit-addon">Std.</span>
						</div>
					</div>

					<div class="form-field">
						<label for="tvl-start-right">Von (P4):</label>
						<input
							id="tvl-start-right"
							type="text"
							class="field-input excel-blue"
							value={tvl.inputs.startDateRight}
							oninput={(e) => (customInputs = { ...customInputs, startDateRight: (e.target as HTMLInputElement).value })}
						/>
					</div>

					<div class="form-field">
						<label for="tvl-end-right">Bis (U4):</label>
						<input
							id="tvl-end-right"
							type="text"
							class="field-input excel-blue"
							value={tvl.inputs.endDateRight}
							oninput={(e) => (customInputs = { ...customInputs, endDateRight: (e.target as HTMLInputElement).value })}
						/>
					</div>
				</div>

				<!-- Calculation Table for Right Period -->
				<div class="period-table-wrapper">
					<table class="period-table">
						<thead>
							<tr>
								<th>Kostenposition</th>
								<th class="th-num">TV-L (39,4h)</th>
								<th class="th-num">TV-L ({tvl.inputs.weeklyHoursRight}h)</th>
								<th class="th-num th-editable">Ist-Zahlung ({tvl.inputs.weeklyHoursRight}h)</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td class="font-medium">
									mtl. Tabellenentgelt Jan–März
									<span class="cell-ref">V10</span>
								</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.tvl394JanMar)}</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.tvlUmJanMar)}</td>
								<td class="td-input">
									<div class="input-inline-copy">
										<input
											type="number"
											step="0.01"
											class="table-cell-input excel-blue"
											value={tvl.inputs.istJanMarRight}
											oninput={(e) => (customInputs = { ...customInputs, istJanMarRight: parseFloat((e.target as HTMLInputElement).value) || 0 })}
										/>
										<button type="button" class="btn-tiny-copy" onclick={() => copyValue(tvl.inputs.istJanMarRight, 'istJanMarRight')}>
											{copiedField === 'istJanMarRight' ? '✓' : '📋'}
										</button>
									</div>
									{#if tvl.expectedIstJanMarRight !== undefined}
										<div class="benchmark-pill">AWO: {formatCurrency(tvl.expectedIstJanMarRight)}</div>
									{/if}
								</td>
							</tr>

							<tr>
								<td class="font-medium">
									mtl. Tabellenentgelt ab April
									<span class="cell-ref">V11</span>
								</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.tvl394AbApr)}</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.tvlUmAbApr)}</td>
								<td class="td-input">
									<div class="input-inline-copy">
										<input
											type="number"
											step="0.01"
											class="table-cell-input excel-blue"
											value={tvl.inputs.istAbAprRight}
											oninput={(e) => (customInputs = { ...customInputs, istAbAprRight: parseFloat((e.target as HTMLInputElement).value) || 0 })}
										/>
										<button type="button" class="btn-tiny-copy" onclick={() => copyValue(tvl.inputs.istAbAprRight, 'istAbAprRight')}>
											{copiedField === 'istAbAprRight' ? '✓' : '📋'}
										</button>
									</div>
									{#if tvl.expectedIstAbAprRight !== undefined}
										<div class="benchmark-pill">AWO: {formatCurrency(tvl.expectedIstAbAprRight)}</div>
									{/if}
								</td>
							</tr>

							<tr class="row-subtotal">
								<td>Ø mtl. AN-Brutto ({tvl.periodRight.totalMonths.toFixed(2)} Mo.)</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.avgMonthlyGross394)}</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.avgMonthlyGrossUm)}</td>
								<td class="text-right font-mono font-bold">{formatCurrency(tvl.periodRight.avgMonthlyGrossIst)}</td>
							</tr>

							<tr>
								<td>AN-Brutto ohne JSZ</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.grossWithoutJsz394)}</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.grossWithoutJszUm)}</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.grossWithoutJszIst)}</td>
							</tr>

							<tr>
								<td class="font-medium">
									Jahressonderzahlung (Basis Ø Jul–Sep)
									<span class="cell-ref">V21</span>
								</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.jsz394)}</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.jszUm)}</td>
								<td class="td-input">
									<div class="input-inline-copy">
										<input
											type="number"
											step="0.01"
											class="table-cell-input excel-blue"
											value={tvl.inputs.istJszRight}
											oninput={(e) => (customInputs = { ...customInputs, istJszRight: parseFloat((e.target as HTMLInputElement).value) || 0 })}
										/>
										<button type="button" class="btn-tiny-copy" onclick={() => copyValue(tvl.inputs.istJszRight, 'istJszRight')}>
											{copiedField === 'istJszRight' ? '✓' : '📋'}
										</button>
									</div>
								</td>
							</tr>

							<tr class="row-subtotal">
								<td>AN-Brutto inkl. JSZ</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.grossWithJsz394)}</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.grossWithJszUm)}</td>
								<td class="text-right font-mono font-bold">{formatCurrency(tvl.periodRight.grossWithJszIst)}</td>
							</tr>

							<tr>
								<td>Arbeitgeber-SV gesamt</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.totalAgSv394)}</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.totalAgSvUm)}</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.totalAgSvIst)}</td>
							</tr>

							<tr class="row-total">
								<td class="font-bold">Personalkosten Zeitraum (rechts)</td>
								<td class="text-right font-mono">{formatCurrency(tvl.periodRight.personalkostenPeriod394)}</td>
								<td class="text-right font-mono text-indigo font-bold">{formatCurrency(tvl.periodRight.personalkostenPeriodUm)}</td>
								<td class="text-right font-mono text-emerald font-bold">{formatCurrency(tvl.periodRight.personalkostenPeriodIst)}</td>
							</tr>
						</tbody>
					</table>
				</div>
			{:else}
				<div class="empty-period-state">
					<p>Kein unterjähriger Erfahrungsstufenaufstieg in {selectedYear}.</p>
					<p class="sub">Der linke Abschnitt deckt den gesamten Jahreszeitraum ab.</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- 3. Social Security Rates Matrix -->
	<div class="section-card">
		<div class="section-header">
			<span class="section-number">2</span>
			<h3>Sozialversicherung & Umlagen (AGA-Sätze)</h3>
			<div class="fund-selector-area">
				<label for="tvl-fund-select">Krankenkasse:</label>
				<select
					id="tvl-fund-select"
					class="field-select excel-blue"
					value={tvl.inputs.selectedInsuranceName}
					onchange={(e) => handleInsuranceChange((e.target as HTMLSelectElement).value)}
				>
					{#each insuranceFunds as fund}
						<option value={fund.name}>{fund.name} (Zusatz: {formatPercent(fund.zusatzbeitragTotal)}, AGA: {formatPercent(fund.agaRate)})</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="sv-rates-grid">
			<div class="rate-card">
				<span class="rate-name">KV (AG)</span>
				<span class="rate-val font-mono">{formatPercent(tvl.inputs.kvRate)}</span>
				<span class="rate-cell">G26</span>
			</div>

			<div class="rate-card editable">
				<span class="rate-name">KK Zusatz (AG)</span>
				<div class="rate-input-wrap">
					<input
						type="number"
						step="0.0001"
						class="rate-input excel-blue"
						value={tvl.inputs.kkZusatzRate}
						oninput={(e) => (customInputs = { ...customInputs, kkZusatzRate: parseFloat((e.target as HTMLInputElement).value) || 0 })}
					/>
					<span class="rate-pct-label">{formatPercent(tvl.inputs.kkZusatzRate)}</span>
				</div>
				<span class="rate-cell">G28</span>
			</div>

			<div class="rate-card">
				<span class="rate-name">RV (AG)</span>
				<span class="rate-val font-mono">{formatPercent(tvl.inputs.rvRate)}</span>
				<span class="rate-cell">G29</span>
			</div>

			<div class="rate-card">
				<span class="rate-name">AV (AG)</span>
				<span class="rate-val font-mono">{formatPercent(tvl.inputs.avRate)}</span>
				<span class="rate-cell">G30</span>
			</div>

			<div class="rate-card">
				<span class="rate-name">PV (AG)</span>
				<span class="rate-val font-mono">{formatPercent(tvl.inputs.pvRate)}</span>
				<span class="rate-cell">G31</span>
			</div>

			<div class="rate-card editable">
				<span class="rate-name">Umlage 1 (U1)</span>
				<div class="rate-input-wrap">
					<input
						type="number"
						step="0.0001"
						class="rate-input excel-blue"
						value={tvl.inputs.u1Rate}
						oninput={(e) => (customInputs = { ...customInputs, u1Rate: parseFloat((e.target as HTMLInputElement).value) || 0 })}
					/>
					<span class="rate-pct-label">{formatPercent(tvl.inputs.u1Rate)}</span>
				</div>
				<span class="rate-cell">G33</span>
			</div>

			<div class="rate-card editable">
				<span class="rate-name">Umlage 2 (U2)</span>
				<div class="rate-input-wrap">
					<input
						type="number"
						step="0.0001"
						class="rate-input excel-blue"
						value={tvl.inputs.u2Rate}
						oninput={(e) => (customInputs = { ...customInputs, u2Rate: parseFloat((e.target as HTMLInputElement).value) || 0 })}
					/>
					<span class="rate-pct-label">{formatPercent(tvl.inputs.u2Rate)}</span>
				</div>
				<span class="rate-cell">G34</span>
			</div>

			<div class="rate-card editable">
				<span class="rate-name">Umlage 3 (Insolvenz)</span>
				<div class="rate-input-wrap">
					<input
						type="number"
						step="0.0001"
						class="rate-input excel-blue"
						value={tvl.inputs.u3Rate}
						oninput={(e) => (customInputs = { ...customInputs, u3Rate: parseFloat((e.target as HTMLInputElement).value) || 0 })}
					/>
					<span class="rate-pct-label">{formatPercent(tvl.inputs.u3Rate)}</span>
				</div>
				<span class="rate-cell">G35</span>
			</div>
		</div>
	</div>

	<!-- 4. Notes & Explanations -->
	<div class="section-card">
		<div class="section-header">
			<span class="section-number">3</span>
			<h3>Bemerkungen & Nachweis</h3>
		</div>

		<div class="notes-area">
			<div class="form-field full-width">
				<label for="tvl-notes">Bemerkungen (Zelle M39):</label>
				<textarea
					id="tvl-notes"
					rows="3"
					class="field-textarea excel-blue"
					value={tvl.inputs.bemerkungen}
					oninput={(e) => (customInputs = { ...customInputs, bemerkungen: (e.target as HTMLTextAreaElement).value })}
				></textarea>
			</div>
		</div>
	</div>
</div>

<style>
	.tvl-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		width: 100%;
	}

	/* Top Bar */
	.tvl-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.badge-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.badge-title h2 {
		margin: 0;
		font-size: 1.45rem;
		font-weight: 700;
		color: #ffffff;
		letter-spacing: -0.02em;
	}

	.badge-icon {
		font-size: 1.4rem;
	}

	.header-desc {
		margin: 0.35rem 0 0 0;
		font-size: 0.9rem;
		color: #94a3b8;
	}

	.header-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.year-pills {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		background: rgba(15, 23, 42, 0.6);
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.pill-label {
		font-size: 0.78rem;
		font-weight: 600;
		color: #64748b;
		margin-right: 0.25rem;
	}

	.year-pill {
		padding: 0.35rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.85rem;
		font-weight: 600;
		color: #94a3b8;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.year-pill:hover {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.08);
	}

	.year-pill.active {
		color: #ffffff;
		background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
		box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
	}

	.action-buttons {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.btn-copy-tsv,
	.btn-download-excel,
	.btn-apply-awo {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1.1rem;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-apply-awo {
		background: rgba(99, 102, 241, 0.2);
		color: #a5b4fc;
		border: 1px solid rgba(99, 102, 241, 0.4);
	}

	.btn-apply-awo:hover {
		background: rgba(99, 102, 241, 0.35);
		color: #ffffff;
		border-color: rgba(99, 102, 241, 0.6);
		transform: translateY(-1px);
	}

	.btn-copy-tsv {
		background: rgba(30, 41, 59, 0.8);
		color: #cbd5e1;
		border: 1px solid rgba(255, 255, 255, 0.12);
	}

	.btn-copy-tsv:hover {
		background: rgba(51, 65, 85, 0.9);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.25);
	}

	.btn-download-excel {
		background: linear-gradient(135deg, #059669 0%, #10b981 100%);
		color: #ffffff;
		border: 1px solid rgba(16, 185, 129, 0.4);
		box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
	}

	.btn-download-excel:hover {
		background: linear-gradient(135deg, #047857 0%, #059669 100%);
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(16, 185, 129, 0.35);
	}

	/* Compliance Banner */
	.compliance-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1.5rem;
		padding: 1.25rem 1.5rem;
		border-radius: 12px;
		border: 1px solid;
		backdrop-filter: blur(12px);
	}

	.compliance-banner.compliant {
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.06) 100%);
		border-color: rgba(16, 185, 129, 0.3);
	}

	.compliance-banner.exceeded {
		background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.08) 100%);
		border-color: rgba(239, 68, 68, 0.4);
	}

	.compliance-status {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.status-icon-box {
		width: 44px;
		height: 44px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.compliance-banner.compliant .status-icon-box {
		background: rgba(16, 185, 129, 0.2);
		color: #10b981;
	}

	.compliance-banner.exceeded .status-icon-box {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
	}

	.status-title {
		font-size: 1.15rem;
		font-weight: 700;
		color: #ffffff;
	}

	.status-sub {
		font-size: 0.88rem;
		color: #94a3b8;
		margin-top: 0.15rem;
	}

	.summary-stat-group {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		flex-wrap: wrap;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		padding: 0.6rem 1rem;
		background: rgba(15, 23, 42, 0.6);
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		min-width: 140px;
	}

	.stat-card.highlight {
		background: rgba(30, 41, 59, 0.8);
		border-color: rgba(255, 255, 255, 0.15);
	}

	.stat-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
		font-weight: 600;
	}

	.stat-value {
		font-size: 1.15rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0.2rem 0;
	}

	.stat-sub {
		font-size: 0.72rem;
		color: #94a3b8;
	}

	.text-emerald { color: #10b981 !important; }
	.text-rose { color: #f43f5e !important; }
	.text-indigo { color: #818cf8 !important; }

	/* Section Cards */
	.section-card {
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 1.25rem 1.5rem;
		backdrop-filter: blur(8px);
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}

	.section-number {
		width: 24px;
		height: 24px;
		border-radius: 6px;
		background: rgba(99, 102, 241, 0.2);
		color: #818cf8;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		font-weight: 700;
	}

	.section-header h3 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
		color: #f1f5f9;
	}

	.section-hint {
		margin-left: auto;
		font-size: 0.78rem;
		color: #64748b;
	}

	/* Dual Columns */
	.dual-columns-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	@media (max-width: 1100px) {
		.dual-columns-grid {
			grid-template-columns: 1fr;
		}
	}

	.period-card {
		background: rgba(15, 23, 42, 0.5);
		border-color: rgba(255, 255, 255, 0.1);
	}

	.period-header {
		justify-content: space-between;
	}

	.period-title-badge {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.badge-tag {
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		background: rgba(99, 102, 241, 0.15);
		color: #a5b4fc;
		border: 1px solid rgba(99, 102, 241, 0.3);
	}

	.badge-tag.accent {
		background: rgba(245, 158, 11, 0.15);
		color: #fcd34d;
		border-color: rgba(245, 158, 11, 0.3);
	}

	.period-controls-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.85rem;
		margin-bottom: 1.25rem;
		background: rgba(30, 41, 59, 0.4);
		padding: 0.85rem;
		border-radius: 8px;
	}

	.fields-grid-4 {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 1rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.form-field label {
		font-size: 0.78rem;
		font-weight: 600;
		color: #94a3b8;
	}

	.field-input,
	.field-select,
	.field-textarea {
		background: #0f172a;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		font-size: 0.85rem;
		color: #f8fafc;
		transition: all 0.15s ease;
	}

	.field-select {
		cursor: pointer;
		background-color: #0f172a !important;
		color: #f8fafc !important;
	}

	.field-select option,
	.field-select optgroup {
		background-color: #0f172a !important;
		color: #f8fafc !important;
		padding: 0.35rem 0.5rem;
	}

	.field-select optgroup {
		font-weight: 700;
		color: #818cf8 !important;
	}

	.field-input:focus,
	.field-select:focus,
	.field-textarea:focus {
		outline: none;
		border-color: #6366f1;
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
	}

	.excel-blue {
		background: rgba(14, 165, 233, 0.08) !important;
		border-color: rgba(14, 165, 233, 0.35) !important;
	}

	.excel-blue:focus {
		border-color: #0ea5e9 !important;
		box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.25) !important;
	}

	.input-with-copy {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.input-with-copy input {
		flex: 1;
	}

	.unit-addon {
		font-size: 0.8rem;
		color: #64748b;
		font-weight: 600;
	}

	.btn-cell-copy,
	.btn-tiny-copy {
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #94a3b8;
		border-radius: 6px;
		padding: 0.45rem 0.6rem;
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.15s ease;
	}

	.btn-cell-copy:hover,
	.btn-tiny-copy:hover {
		color: #ffffff;
		background: rgba(51, 65, 85, 0.9);
	}

	/* Period Table */
	.period-table-wrapper {
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		overflow: hidden;
	}

	.period-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
	}

	.period-table th {
		background: rgba(15, 23, 42, 0.8);
		color: #94a3b8;
		font-weight: 600;
		text-align: left;
		padding: 0.6rem 0.85rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.period-table th.th-num {
		text-align: right;
	}

	.period-table th.th-editable {
		color: #38bdf8;
	}

	.period-table td {
		padding: 0.55rem 0.85rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		color: #cbd5e1;
	}

	.period-table tr.row-subtotal {
		background: rgba(30, 41, 59, 0.3);
		font-weight: 600;
	}

	.period-table tr.row-total {
		background: rgba(15, 23, 42, 0.8);
		border-top: 2px solid rgba(255, 255, 255, 0.1);
	}

	.cell-ref {
		display: inline-block;
		margin-left: 0.35rem;
		padding: 0.1rem 0.3rem;
		background: rgba(14, 165, 233, 0.15);
		color: #38bdf8;
		border-radius: 3px;
		font-size: 0.68rem;
		font-family: monospace;
	}

	.td-input {
		text-align: right;
	}

	.input-inline-copy {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		justify-content: flex-end;
	}

	.table-cell-input {
		width: 95px;
		text-align: right;
		font-family: monospace;
		font-weight: 600;
		padding: 0.3rem 0.45rem;
		font-size: 0.82rem;
		border-radius: 4px;
	}

	/* Toggle */
	.toggle-container {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.toggle-container input {
		position: absolute;
		opacity: 0;
	}

	.toggle-slider {
		position: relative;
		width: 38px;
		height: 20px;
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 20px;
		transition: all 0.2s ease;
	}

	.toggle-slider::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #94a3b8;
		transition: all 0.2s ease;
	}

	.toggle-container input:checked + .toggle-slider {
		background: #6366f1;
		border-color: #818cf8;
	}

	.toggle-container input:checked + .toggle-slider::after {
		transform: translateX(18px);
		background: #ffffff;
	}

	.toggle-text {
		font-size: 0.8rem;
		font-weight: 600;
		color: #cbd5e1;
	}

	.empty-period-state {
		text-align: center;
		padding: 3rem 1.5rem;
		color: #64748b;
	}

	.empty-period-state p {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.empty-period-state .sub {
		margin-top: 0.35rem;
		font-size: 0.82rem;
		font-weight: 400;
	}

	/* SV Rates Grid */
	.fund-selector-area {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.fund-selector-area label {
		font-size: 0.82rem;
		color: #94a3b8;
	}

	.sv-rates-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 0.85rem;
	}

	.rate-card {
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		padding: 0.65rem 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.rate-card.editable {
		background: rgba(14, 165, 233, 0.06);
		border-color: rgba(14, 165, 233, 0.25);
	}

	.rate-name {
		font-size: 0.72rem;
		font-weight: 600;
		color: #64748b;
		text-transform: uppercase;
	}

	.rate-val {
		font-size: 0.95rem;
		font-weight: 700;
		color: #f1f5f9;
	}

	.rate-input-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.rate-input {
		width: 100%;
		font-size: 0.75rem;
		padding: 0.25rem 0.4rem;
		border-radius: 4px;
		font-family: monospace;
	}

	.rate-pct-label {
		font-size: 0.85rem;
		font-weight: 700;
		color: #38bdf8;
		font-family: monospace;
	}

	.rate-cell {
		font-size: 0.65rem;
		color: #475569;
		font-family: monospace;
	}

	/* Notes Area */
	.notes-area {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.full-width {
		width: 100%;
	}

	.benchmark-pill {
		display: inline-block;
		margin-top: 0.2rem;
		font-size: 0.7rem;
		color: #64748b;
		font-family: monospace;
	}
</style>
