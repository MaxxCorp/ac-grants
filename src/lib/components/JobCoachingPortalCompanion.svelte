<script lang="ts">
	import type { GrantTransformationResult, JobCoachingData, JobCoachingBetreuungRow, JobCoachingBueroItem } from '#lib/types/grant';
	import { downloadFinanzierungsplanExcelFile } from '#lib/grants/finanzierungsplan-exporter';
	import { generateAutomationPayload, generatePlaywrightScript } from '#lib/automation/bridge';
	import TvlComparisonCompanion from '#lib/components/TvlComparisonCompanion.svelte';

	let {
		result,
		onUpdateOptions
	}: {
		result: GrantTransformationResult;
		onUpdateOptions?: (opts: any) => void;
	} = $props();

	let activeWindow = $state<'betreuung' | 'sachkosten' | 'tvl'>('betreuung');
	let activeSachkostenTab = $state<'buero' | 'doku' | 'quali' | 'vwk' | 'werbung' | 'miete'>('buero');

	let copiedField = $state<string | null>(null);
	let lastCopiedRowId = $state<string | null>(null);
	let copiedTimeout: any = null;
	let showScriptModal = $state(false);

	let selectedPersonnelFilter = $state<string>('all');

	const jc = $derived<JobCoachingData | undefined>(result.jobCoachingData);
	const betreuungRows = $derived<JobCoachingBetreuungRow[]>(jc ? jc.betreuungRows : []);
	const totalBetreuung = $derived<number>(jc ? jc.totalBetreuung : 0);
	const sachkosten = $derived(jc?.sachkosten);
	const activeYear = $derived(result.years[0] || 2027);
	const qualiBudgetTotal = $derived(sachkosten?.qualifizierungsBudgetTotal || 0);
	const vwkAmountVal = $derived(sachkosten?.vwkAmount || 0);

	const personnelNames = $derived<string[]>(
		Array.from(new Set(betreuungRows.map((r) => r.employeeName).filter(Boolean)))
	);

	const displayedBetreuungRows = $derived<JobCoachingBetreuungRow[]>(
		selectedPersonnelFilter === 'all'
			? betreuungRows
			: betreuungRows.filter((r) => r.employeeName === selectedPersonnelFilter)
	);

	// User-configurable Sachkosten overrides
	let userMiete = $state(1707.15);

	function setCopied(id: string, rowId?: string) {
		copiedField = id;
		if (rowId) {
			lastCopiedRowId = rowId;
		}
		if (copiedTimeout) clearTimeout(copiedTimeout);
		copiedTimeout = setTimeout(() => {
			copiedField = null;
		}, 1800);
	}

	async function copyToClipboard(
		text: string | number | undefined | null,
		fieldKey: string,
		rowId?: string,
		isInteger = false,
		isHours = false
	) {
		if (text === undefined || text === null) return;
		try {
			const textToCopy =
				typeof text === 'number'
					? isInteger
						? text.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
						: isHours
							? text.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 4 })
							: text.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
					: String(text);

			await navigator.clipboard.writeText(textToCopy);
			setCopied(fieldKey, rowId);
		} catch (err) {
			console.error('Failed to copy text', err);
		}
	}

	function formatCurrency(val: number): string {
		return (
			val.toLocaleString('de-DE', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			}) + ' €'
		);
	}

	function formatHours(val: number): string {
		return val.toLocaleString('de-DE', {
			minimumFractionDigits: 1,
			maximumFractionDigits: 4
		});
	}

	function formatNum(val: number, decimals = 2): string {
		return val.toLocaleString('de-DE', {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
	}

	function copyBetreuungRowTSV(row: JobCoachingBetreuungRow) {
		const values = [
			row.qualification,
			row.analogTariff,
			formatNum(row.annualGross),
			formatNum(row.annualAga),
			row.weeklyHours,
			row.vacationDays,
			formatNum(row.workingHoursProject, 1),
			formatNum(row.totalAmount),
			formatNum(row.yearlyAmounts[activeYear] || row.totalAmount),
			formatNum(row.controlSum),
			row.description
		];
		navigator.clipboard.writeText(values.join('\t'));
		setCopied(`row-tsv-${row.id}`, row.id);
	}

	function copyBueroRowTSV(item: JobCoachingBueroItem) {
		const values = [
			item.name,
			item.quantity,
			formatNum(item.unitPrice),
			formatNum(item.totalAmount),
			formatNum(item.yearlyAmounts[activeYear] || item.totalAmount),
			formatNum(item.controlSum),
			item.description
		];
		navigator.clipboard.writeText(values.join('\t'));
		setCopied(`row-tsv-${item.id}`, item.id);
	}

	function copyQualiRowTSV() {
		if (!sachkosten) return;
		const values = [
			'Qualifizierungsbudget',
			formatNum(sachkosten.qualifizierungsBudgetTotal),
			formatNum(sachkosten.qualifizierungsBudgetTotal),
			formatNum(sachkosten.qualifizierungsBudgetTotal),
			formatNum(sachkosten.qualifizierungsBudgetTotal),
			sachkosten.qualifizierungsText
		];
		navigator.clipboard.writeText(values.join('\t'));
		setCopied('row-tsv-quali', 'quali-row-1');
	}

	function copyVwkRowTSV() {
		if (!sachkosten) return;
		const values = [
			'Vwk-Pauschale',
			formatNum(sachkosten.vwkAmount),
			'100',
			formatNum(sachkosten.vwkAmount),
			formatNum(sachkosten.vwkAmount),
			formatNum(sachkosten.vwkAmount),
			sachkosten.vwkText
		];
		navigator.clipboard.writeText(values.join('\t'));
		setCopied('row-tsv-vwk', 'vwk-row-1');
	}

	function copyBetreuungTSV() {
		const headers = [
			'Qualifikation',
			'Einstufung analog Tarifvertrag',
			'AN Brutto p.a. (€)',
			'AG Sozialabg. p.a. (€)',
			'Wochenarbeitszeit',
			'Urlaubstage p.a.',
			'zu leistende Std. Im Projekt',
			'Summe',
			String(activeYear),
			'Kontrollsumme',
			'Erläuterung'
		];
		const rows = betreuungRows.map((r) => [
			r.qualification,
			r.analogTariff,
			formatNum(r.annualGross),
			formatNum(r.annualAga),
			r.weeklyHours,
			r.vacationDays,
			formatNum(r.workingHoursProject, 1),
			formatNum(r.totalAmount),
			formatNum(r.yearlyAmounts[activeYear] || r.totalAmount),
			formatNum(r.controlSum),
			r.description
		]);
		const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
		navigator.clipboard.writeText(tsv);
		setCopied('betreuung-tsv');
	}

	function copySachkostenTSV() {
		if (activeSachkostenTab === 'buero' && sachkosten) {
			const headers = ['Artikel', 'Anzahl', 'Einzelpreis (€)', 'Summe', String(activeYear), 'Kontrollsumme', 'Erläuterung'];
			const rows = sachkosten.bueroItems.map((item) => [
				item.name,
				item.quantity,
				formatNum(item.unitPrice),
				formatNum(item.totalAmount),
				formatNum(item.yearlyAmounts[activeYear] || item.totalAmount),
				formatNum(item.controlSum),
				item.description
			]);
			const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
			navigator.clipboard.writeText(tsv);
			setCopied('sachkosten-tsv');
		} else if (activeSachkostenTab === 'quali' && sachkosten) {
			const tsv = [
				'Bezeichnung\tBetrag (€)\tSumme\t' + activeYear + '\tKontrollsumme\tErläuterung',
				`Qualifizierungsbudget\t${formatNum(sachkosten.qualifizierungsBudgetTotal)}\t${formatNum(sachkosten.qualifizierungsBudgetTotal)}\t${formatNum(sachkosten.qualifizierungsBudgetTotal)}\t${formatNum(sachkosten.qualifizierungsBudgetTotal)}\t${sachkosten.qualifizierungsText}`
			].join('\n');
			navigator.clipboard.writeText(tsv);
			setCopied('sachkosten-tsv');
		} else if (activeSachkostenTab === 'vwk' && sachkosten) {
			const tsv = [
				'Bezeichnung\tBetrag (€)\tAnteil (%)\tSumme\t' + activeYear + '\tKontrollsumme\tErläuterung',
				`Vwk-Pauschale\t${formatNum(sachkosten.vwkAmount)}\t100\t${formatNum(sachkosten.vwkAmount)}\t${formatNum(sachkosten.vwkAmount)}\t${formatNum(sachkosten.vwkAmount)}\t${sachkosten.vwkText}`
			].join('\n');
			navigator.clipboard.writeText(tsv);
			setCopied('sachkosten-tsv');
		}
	}

	function handleDownloadFinanzierungsplan() {
		downloadFinanzierungsplanExcelFile(result);
	}

	const playwrightScript = $derived(generatePlaywrightScript(result));
	const automationJson = $derived(JSON.stringify(generateAutomationPayload(result), null, 2));
</script>

<div class="jobcoaching-portal-root">
	<!-- Top Navigation Switcher -->
	<div class="portal-window-tabs">
		<button
			type="button"
			class="nav-tab {activeWindow === 'betreuung' ? 'active' : ''}"
			onclick={() => (activeWindow = 'betreuung')}
		>
			<span class="icon">👥</span>
			<span>4.1.1.3 - Betreuung</span>
			<span class="badge">{formatCurrency(totalBetreuung)}</span>
		</button>

		<button
			type="button"
			class="nav-tab {activeWindow === 'sachkosten' ? 'active' : ''}"
			onclick={() => (activeWindow = 'sachkosten')}
		>
			<span class="icon">📦</span>
			<span>4.1.2.9 - Sonstige Sachkosten</span>
			<span class="badge">{formatCurrency(sachkosten ? sachkosten.bueroTotal + sachkosten.qualifizierungsBudgetTotal + sachkosten.vwkAmount : 0)}</span>
		</button>

		<button
			type="button"
			class="nav-tab {activeWindow === 'tvl' ? 'active' : ''}"
			onclick={() => (activeWindow = 'tvl')}
		>
			<span class="icon">⚖️</span>
			<span>Vergleichsberechnung TV-L</span>
			<span class="badge-tag">2026 & 2027</span>
		</button>

		<div class="nav-actions">
			<button
				type="button"
				class="action-btn script-btn"
				onclick={() => (showScriptModal = true)}
				title="Browser-Automation Skript (Playwright) anzeigen"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="16 18 22 12 16 6"></polyline>
					<polyline points="8 6 2 12 8 18"></polyline>
				</svg>
				Browser-Automation (Playwright)
			</button>

			<button
				type="button"
				class="export-btn"
				onclick={handleDownloadFinanzierungsplan}
				title="Offiziellen Finanzierungsplan als Excel-Tabelle herunterladen"
			>
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
					<polyline points="7 10 12 15 17 10"></polyline>
					<line x1="12" y1="15" x2="12" y2="3"></line>
				</svg>
				Finanzierungsplan (.xlsx)
			</button>
		</div>
	</div>

	{#if activeWindow === 'betreuung'}
		<!-- WINDOW 1: Kalkulationshilfe 4.1.1.3 - Betreuung -->
		<div class="companion-window">
			<div class="window-titlebar">
				<div class="titlebar-left">
					<div class="traffic-lights">
						<span class="light red"></span>
						<span class="light yellow"></span>
						<span class="light green"></span>
					</div>
					<span class="window-title">Kalkulationshilfe : 4.1.1.3 - Betreuung</span>
				</div>
				<div class="titlebar-actions">
					<button type="button" class="action-btn" onclick={copyBetreuungTSV}>
						{#if copiedField === 'betreuung-tsv'}
							✓ Zeilen kopiert!
						{:else}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
								<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
							</svg>
							Tabellenwerte kopieren (TSV)
						{/if}
					</button>

					<button type="button" class="action-btn script-btn" onclick={() => (showScriptModal = true)}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="16 18 22 12 16 6"></polyline>
							<polyline points="8 6 2 12 8 18"></polyline>
						</svg>
						Playwright Skript
					</button>
				</div>
			</div>

			<!-- Window Info Subheader -->
			<div class="window-intro">
				Für diese Position stehen die folgenden Kalkulationshilfen zur Verfügung. Sie sehen jeweils die aktuell in Summe hinterlegten Beträge. Nutzen Sie zur Bearbeitung bitte den jeweiligen Tab-Reiter.
			</div>

			<!-- Top Summary Overview -->
			<div class="summary-overview">
				<table class="overview-table">
					<thead>
						<tr>
							<th class="col-name"></th>
							<th class="col-num">Summe</th>
							<th class="col-num">{activeYear}</th>
							<th class="col-status"></th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td class="font-medium">Betreuung</td>
							<td class="text-right">
								<button
									type="button"
									class="copy-cell-btn cell-sum font-mono highlight-sum {copiedField === 'overview-betreuung-sum' ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(totalBetreuung, 'overview-betreuung-sum')}
									title="Betreuung Gesamtsumme kopieren"
								>
									<span>{formatCurrency(totalBetreuung)}</span>
									{#if copiedField === 'overview-betreuung-sum'}<span class="copied-tooltip">✓</span>{/if}
								</button>
							</td>
							<td class="text-right">
								<button
									type="button"
									class="copy-cell-btn cell-sum font-mono highlight-sum {copiedField === 'overview-betreuung-yr' ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(totalBetreuung, 'overview-betreuung-yr')}
									title="Betreuung Jahreswert {activeYear} kopieren"
								>
									<span>{formatCurrency(totalBetreuung)}</span>
									{#if copiedField === 'overview-betreuung-yr'}<span class="copied-tooltip">✓</span>{/if}
								</button>
							</td>
							<td>
								<span class="status-indicator success">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3">
										<polyline points="20 6 9 17 4 12"></polyline>
									</svg>
									Angaben vollständig
								</span>
							</td>
						</tr>
						<tr class="untersetzung-row">
							<td class="text-muted">Untersetzung:</td>
							<td class="text-right font-mono text-muted">{formatCurrency(totalBetreuung)}</td>
							<td class="text-right font-mono text-muted">{formatCurrency(totalBetreuung)}</td>
							<td>
								<span class="status-indicator success">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3">
										<polyline points="20 6 9 17 4 12"></polyline>
									</svg>
									Korrekte Untersetzung
								</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<!-- Internal Tab Bar -->
			<div class="window-tab-bar">
				<button type="button" class="subtab-btn active">Betreuung</button>
			</div>

			<!-- Quick Legend Toolbar (Ported from §16i) -->
			<div class="table-legend-bar">
				<div class="legend-sections">
					<div class="legend-group">
						<span class="legend-group-title">Rollen:</span>
						<div class="legend-items">
							<span class="legend-item legend-cat legend-cat-coach">
								<span class="legend-dot dot-cat-coach"></span>
								<span class="legend-label">👥 JobCoach</span>
							</span>
							<span class="legend-item legend-cat legend-cat-trainer">
								<span class="legend-dot dot-cat-trainer"></span>
								<span class="legend-label">🎯 Beschäftigungstrainer</span>
							</span>
						</div>
					</div>

					<div class="legend-group">
						<span class="legend-group-title">Felder:</span>
						<div class="legend-items">
							<span class="legend-item legend-control">
								<span class="legend-dot dot-control"></span>
								<span class="legend-label">Steuerung</span>
								<span class="legend-hint">(Std., Urlaub, Std./Proj.)</span>
							</span>
							<span class="legend-item legend-sum">
								<span class="legend-dot dot-sum"></span>
								<span class="legend-label">Zeilensumme</span>
							</span>
							<span class="legend-item legend-ctrlsum">
								<span class="legend-dot dot-ctrlsum"></span>
								<span class="legend-label">Kontrollwert</span>
							</span>
							<span class="legend-item legend-data">
								<span class="legend-dot dot-data"></span>
								<span class="legend-label">Betragsdaten</span>
							</span>
						</div>
					</div>
				</div>
				<div class="legend-right">
					<span class="legend-tip">💡 Klick auf beliebigen Wert kopiert direkt in die Zwischenablage</span>
				</div>
			</div>

			<!-- Multi-Personnel Row Filter Toolbar (Ported from §16i) -->
			{#if personnelNames.length > 1}
				<div class="participant-filter-bar">
					<span class="filter-label">Filter nach Betreuungspersonal:</span>
					<div class="filter-pills">
						<button
							type="button"
							class="filter-pill {selectedPersonnelFilter === 'all' ? 'active' : ''}"
							onclick={() => (selectedPersonnelFilter = 'all')}
						>
							👥 Alle ({betreuungRows.length} Zeilen)
						</button>
						{#each personnelNames as pName}
							{@const pCount = betreuungRows.filter((r) => r.employeeName === pName).length}
							<button
								type="button"
								class="filter-pill {selectedPersonnelFilter === pName ? 'active' : ''}"
								onclick={() => (selectedPersonnelFilter = pName)}
							>
								👤 {pName} ({pCount})
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Main Table Content Area with Sticky Header & 1-Click Cells -->
			<div class="portal-table-container">
				<table class="portal-table">
					<thead>
						<tr>
							<th class="th-action" style="width: 38px;">#</th>
							<th class="th-text th-data-header">Qualifikation</th>
							<th class="th-text th-data-header">Einstufung analog Tarifvertrag</th>
							<th class="col-num th-data-header" title="Datenfeld: AN-Brutto Jahreswert">
								<span class="th-content"><span class="th-tag data-tag">#</span>AN Brutto p.a. (€)</span>
							</th>
							<th class="col-num th-data-header" title="Datenfeld: AG-Sozialabgaben Jahreswert">
								<span class="th-content"><span class="th-tag data-tag">#</span>AG Sozialabg. p.a. (€)</span>
							</th>
							<th class="col-center th-control-header" title="Steuerungseingabe: Wochenarbeitszeit">
								<span class="th-content"><span class="th-tag control-tag">⚙</span>Wochenarbeitszeit</span>
							</th>
							<th class="col-center th-control-header" title="Steuerungseingabe: Urlaubstage pro Jahr">
								<span class="th-content"><span class="th-tag control-tag">⚙</span>Urlaubstage p.a.</span>
							</th>
							<th class="col-num th-control-header" title="Steuerungseingabe: zu leistende Stunden laut Formel">
								<span class="th-content"><span class="th-tag control-tag">⚙</span>zu leistende Std. Im Projekt</span>
							</th>
							<th class="col-num th-sum" title="Ergebnis: Summe der Position">
								<span class="th-content"><span class="th-tag sum-tag">∑</span>Summe</span>
							</th>
							<th class="col-num th-data-header" title="Kalenderjahr {activeYear}">
								<span class="th-content"><span class="th-tag data-tag">#</span>{activeYear}</span>
							</th>
							<th class="col-num th-ctrl-sum" title="Prüfwert: Quersummen-Kontrollwert">
								<span class="th-content"><span class="th-tag ctrl-tag">✓</span>Kontrollsumme</span>
							</th>
							<th class="col-action" style="width: 80px;" title="Zeilenaktionen">Aktion</th>
						</tr>
					</thead>
					<tbody>
						{#each displayedBetreuungRows as row, idx (row.id)}
							{@const isLastCopied = lastCopiedRowId === row.id}
							{@const isEven = idx % 2 === 0}
							{@const isCoach = row.role === 'jobcoach'}
							{@const yVal = row.yearlyAmounts[activeYear] || row.totalAmount}

							<!-- 1. Numeric Values Data Row -->
							<tr
								class="data-row {isCoach ? 'row-coach' : 'row-trainer'} {isEven ? 'row-even' : 'row-odd'} {isLastCopied ? 'last-copied-row' : ''}"
								onclick={() => (lastCopiedRowId = row.id)}
							>
								<td class="td-row-num">
									<div class="row-num-container">
										<span class="row-badge {isCoach ? 'badge-coach' : 'badge-trainer'} {isLastCopied ? 'badge-highlight' : ''}" title="{row.employeeName} ({row.qualification}) - Zeile {idx + 1}">
											{#if isLastCopied}
												<span class="active-dot" title="Zuletzt kopierte Zeile">●</span>
											{/if}
											{idx + 1}
										</span>
									</div>
								</td>

								<!-- Qualifikation (Click to copy) -->
								<td>
									<button
										type="button"
										class="copy-pill-btn pill-role {isCoach ? 'pill-coach' : 'pill-trainer'} {copiedField === `qual-${row.id}` ? 'pill-just-copied' : ''}"
										onclick={() => copyToClipboard(row.qualification, `qual-${row.id}`, row.id)}
										title="Qualifikation kopieren: {row.qualification}"
									>
										<span>{row.qualification}</span>
										{#if copiedField === `qual-${row.id}`}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>

								<!-- Einstufung analog Tarifvertrag (Click to copy) -->
								<td>
									<button
										type="button"
										class="copy-pill-btn pill-tariff {copiedField === `tariff-${row.id}` ? 'pill-just-copied' : ''}"
										onclick={() => copyToClipboard(row.analogTariff, `tariff-${row.id}`, row.id)}
										title="Tarifeinstufung kopieren: {row.analogTariff}"
									>
										<span>{row.analogTariff}</span>
										{#if copiedField === `tariff-${row.id}`}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>

								<!-- AN Brutto p.a. (Datenfeld - Slate/White) -->
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-data font-mono {copiedField === `gross-${row.id}` ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(row.annualGross, `gross-${row.id}`, row.id)}
										title="Datenfeld: AN Brutto p.a. kopieren ({formatCurrency(row.annualGross)})"
									>
										<span>{formatCurrency(row.annualGross)}</span>
										{#if copiedField === `gross-${row.id}`}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>

								<!-- AG Sozialabg. p.a. (Datenfeld - Slate/White) -->
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-data font-mono {copiedField === `aga-${row.id}` ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(row.annualAga, `aga-${row.id}`, row.id)}
										title="Datenfeld: AG Sozialabgaben p.a. kopieren ({formatCurrency(row.annualAga)})"
									>
										<span>{formatCurrency(row.annualAga)}</span>
										{#if copiedField === `aga-${row.id}`}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>

								<!-- Wochenarbeitszeit (Steuerung - Sky/Cyan) -->
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-control font-mono {copiedField === `hours-${row.id}` ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(row.weeklyHours, `hours-${row.id}`, row.id, true)}
										title="Steuerungseingabe: Wochenarbeitszeit {row.weeklyHours} Std. kopieren"
									>
										<span>{row.weeklyHours}</span>
										{#if copiedField === `hours-${row.id}`}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>

								<!-- Urlaubstage p.a. (Steuerung - Sky/Cyan) -->
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-control font-mono {copiedField === `vacation-${row.id}` ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(row.vacationDays, `vacation-${row.id}`, row.id, true)}
										title="Steuerungseingabe: Urlaubstage {row.vacationDays} kopieren"
									>
										<span>{row.vacationDays}</span>
										{#if copiedField === `vacation-${row.id}`}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>

								<!-- zu leistende Std. Im Projekt (Steuerung - Sky/Cyan) -->
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-control font-mono {copiedField === `projhours-${row.id}` ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(row.workingHoursProject, `projhours-${row.id}`, row.id, false, true)}
										title="Steuerungseingabe: Projektarbeitsstunden {formatHours(row.workingHoursProject)} kopieren"
									>
										<span>{formatHours(row.workingHoursProject)}</span>
										{#if copiedField === `projhours-${row.id}`}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>

								<!-- Summe (Gesamtsumme Position - Gold/Amber) -->
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-sum font-mono font-bold {copiedField === `sum-${row.id}` ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(row.totalAmount, `sum-${row.id}`, row.id)}
										title="Gesamtsumme: Positionssumme {formatCurrency(row.totalAmount)} kopieren"
									>
										<span>{formatCurrency(row.totalAmount)}</span>
										{#if copiedField === `sum-${row.id}`}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>

								<!-- Jahreswert activeYear (Datenfeld - Slate/White) -->
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-data font-mono font-bold {copiedField === `yr-${row.id}` ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(yVal, `yr-${row.id}`, row.id)}
										title="Jahreswert {activeYear}: {formatCurrency(yVal)} kopieren"
									>
										<span>{formatCurrency(yVal)}</span>
										{#if copiedField === `yr-${row.id}`}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>

								<!-- Kontrollsumme (Kontrollwert - Soft Violet/Purple) -->
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-control-sum font-mono font-bold {copiedField === `ctrl-${row.id}` ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(row.controlSum, `ctrl-${row.id}`, row.id)}
										title="Kontrollsumme: Prüfwert {formatCurrency(row.controlSum)} kopieren"
									>
										<span>{formatCurrency(row.controlSum)}</span>
										{#if copiedField === `ctrl-${row.id}`}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>

								<!-- Row TSV Copy Action -->
								<td class="td-action">
									<button
										type="button"
										class="copy-row-btn {isLastCopied ? 'btn-active-row' : ''}"
										onclick={() => copyBetreuungRowTSV(row)}
										title="Ganze Zeile als Tabellenwerte kopieren (TSV)"
									>
										{#if copiedField === `row-tsv-${row.id}`}
											✓ Kopiert
										{:else}
											Kopieren
										{/if}
									</button>
								</td>
							</tr>

							<!-- 2. Sub-Row: Individual Metadata Entities & Erläuterung (Ported from §16i) -->
							<tr
								class="desc-row sub-row-meta {isCoach ? 'row-coach' : 'row-trainer'} {isEven ? 'row-even' : 'row-odd'} {isLastCopied ? 'last-copied-row' : ''}"
								onclick={() => (lastCopiedRowId = row.id)}
							>
								<td colspan="12">
									<div class="meta-content-wrapper">
										{#if isLastCopied}
											<div class="last-active-indicator" title="Diese Zeile wird gerade bearbeitet">
												<span class="pulse-indicator"></span>
												<span>Aktive Zeile</span>
											</div>
										{/if}

										<!-- Entity Quick-Copy Pills -->
										<div class="meta-pills-row">
											<!-- Name -->
											<button
												type="button"
												class="copy-meta-btn meta-name-btn {copiedField === `name-${row.id}` ? 'btn-copied' : ''}"
												onclick={() => copyToClipboard(row.employeeName, `name-${row.id}`, row.id)}
												title="Name kopieren: {row.employeeName}"
											>
												<span class="meta-label">Name:</span>
												<span class="meta-val">{row.employeeName}</span>
												{#if copiedField === `name-${row.id}`}<span class="copied-inline">✓</span>{:else}<span class="copy-icon">⎘</span>{/if}
											</button>

											<!-- Laufzeit / Zeitraum -->
											<button
												type="button"
												class="copy-meta-btn meta-period-btn {copiedField === `period-${row.id}` ? 'btn-copied' : ''}"
												onclick={() => copyToClipboard(`${row.startDate}-${row.endDate}`, `period-${row.id}`, row.id)}
												title="Laufzeit kopieren: {row.startDate} - {row.endDate}"
											>
												<span class="meta-label">Zeitraum:</span>
												<span class="meta-val">{row.startDate} - {row.endDate} ({row.monthCount} Mo.)</span>
												{#if copiedField === `period-${row.id}`}<span class="copied-inline">✓</span>{:else}<span class="copy-icon">⎘</span>{/if}
											</button>

											<!-- Tarif / Stufe -->
											<button
												type="button"
												class="copy-meta-btn meta-tariff-btn {copiedField === `tf2-${row.id}` ? 'btn-copied' : ''}"
												onclick={() => copyToClipboard(row.analogTariff, `tf2-${row.id}`, row.id)}
												title="Tarif kopieren: {row.analogTariff}"
											>
												<span class="meta-label">Tarif:</span>
												<span class="meta-val">{row.analogTariff}</span>
												{#if copiedField === `tf2-${row.id}`}<span class="copied-inline">✓</span>{:else}<span class="copy-icon">⎘</span>{/if}
											</button>

											<!-- Notiz (falls vorhanden, z.B. Tariferhöhung / Stufenaufstieg) -->
											{#if row.note}
												<button
													type="button"
													class="copy-meta-btn highlight-btn {copiedField === `note-${row.id}` ? 'btn-copied' : ''}"
													onclick={() => copyToClipboard(row.note, `note-${row.id}`, row.id)}
													title="Notiz kopieren: {row.note}"
												>
													<span class="meta-label">Status:</span>
													<span class="meta-val">{row.note}</span>
													{#if copiedField === `note-${row.id}`}<span class="copied-inline">✓</span>{:else}<span class="copy-icon">⎘</span>{/if}
												</button>
											{/if}
										</div>

										<!-- Full Description Box -->
										<div class="portal-desc-box">
											<span class="desc-text">{row.description}</span>
											<button
												type="button"
												class="copy-desc-btn {copiedField === row.id ? 'btn-copied' : ''}"
												onclick={() => copyToClipboard(row.description, row.id, row.id)}
												title="Vollständigen Erläuterungstext kopieren"
											>
												{#if copiedField === row.id}
													✓ Erläuterung kopiert
												{:else}
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
														<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
														<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
													</svg>
													Erläuterung kopieren
												{/if}
											</button>
										</div>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="total-row">
							<td class="col-idx">∑</td>
							<td colspan="7" class="text-right font-bold">Summe Betreuung:</td>
							<td class="col-num font-mono font-bold text-accent">
								<button
									type="button"
									class="copy-cell-btn cell-sum font-mono font-bold {copiedField === 'foot-sum' ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(totalBetreuung, 'foot-sum')}
									title="Summe Betreuung kopieren"
								>
									<span>{formatCurrency(totalBetreuung)}</span>
									{#if copiedField === 'foot-sum'}<span class="copied-tooltip">✓</span>{/if}
								</button>
							</td>
							<td class="col-num font-mono font-bold text-accent">
								<button
									type="button"
									class="copy-cell-btn cell-sum font-mono font-bold {copiedField === 'foot-yr' ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(totalBetreuung, 'foot-yr')}
									title="Jahressumme {activeYear} kopieren"
								>
									<span>{formatCurrency(totalBetreuung)}</span>
									{#if copiedField === 'foot-yr'}<span class="copied-tooltip">✓</span>{/if}
								</button>
							</td>
							<td class="col-num font-mono font-bold text-accent">
								<button
									type="button"
									class="copy-cell-btn cell-control-sum font-mono font-bold {copiedField === 'foot-ctrl' ? 'cell-just-copied' : ''}"
									onclick={() => copyToClipboard(totalBetreuung, 'foot-ctrl')}
									title="Kontrollsumme kopieren"
								>
									<span>{formatCurrency(totalBetreuung)}</span>
									{#if copiedField === 'foot-ctrl'}<span class="copied-tooltip">✓</span>{/if}
								</button>
							</td>
							<td></td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	{:else if activeWindow === 'sachkosten'}
		<!-- WINDOW 2: Kalkulationshilfe 4.1.2.9 - Sonstige Sachkosten -->
		<div class="companion-window">
			<div class="window-titlebar">
				<div class="titlebar-left">
					<div class="traffic-lights">
						<span class="light red"></span>
						<span class="light yellow"></span>
						<span class="light green"></span>
					</div>
					<span class="window-title">Kalkulationshilfe : 4.1.2.9 - Sonstige Sachkosten</span>
				</div>
				<div class="titlebar-actions">
					<button type="button" class="action-btn" onclick={copySachkostenTSV}>
						{#if copiedField === 'sachkosten-tsv'}
							✓ Zeilen kopiert!
						{:else}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
								<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
							</svg>
							Tabellenwerte kopieren (TSV)
						{/if}
					</button>

					<button type="button" class="action-btn script-btn" onclick={() => (showScriptModal = true)}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="16 18 22 12 16 6"></polyline>
							<polyline points="8 6 2 12 8 18"></polyline>
						</svg>
						Playwright Skript
					</button>
				</div>
			</div>

			<div class="window-intro">
				Für diese Position stehen die folgenden Kalkulationshilfen zur Verfügung. Sie sehen jeweils die aktuell in Summe hinterlegten Beträge. Nutzen Sie zur Bearbeitung bitte den jeweiligen Tab-Reiter.
			</div>

			<!-- Top Summary Overview (Matching Portal Screenshots 2, 3, 4 with 1-Click Copying) -->
			<div class="summary-overview">
				<table class="overview-table">
					<thead>
						<tr>
							<th class="col-name"></th>
							<th class="col-num">Summe</th>
							<th class="col-num">{activeYear}</th>
							<th class="col-status"></th>
						</tr>
					</thead>
					<tbody>
						<tr class={activeSachkostenTab === 'buero' ? 'active-row' : ''} onclick={() => (activeSachkostenTab = 'buero')}>
							<td class="font-medium">Büromaterial</td>
							<td class="text-right">
								<button
									type="button"
									class="copy-cell-btn cell-sum font-mono {copiedField === 'sk-buero-sum' ? 'cell-just-copied' : ''}"
									onclick={(e) => { e.stopPropagation(); copyToClipboard(sachkosten?.bueroTotal || 0, 'sk-buero-sum'); }}
									title="Büromaterial Summe kopieren"
								>
									<span>{formatCurrency(sachkosten?.bueroTotal || 0)}</span>
									{#if copiedField === 'sk-buero-sum'}<span class="copied-tooltip">✓</span>{/if}
								</button>
							</td>
							<td class="text-right">
								<button
									type="button"
									class="copy-cell-btn cell-sum font-mono {copiedField === 'sk-buero-yr' ? 'cell-just-copied' : ''}"
									onclick={(e) => { e.stopPropagation(); copyToClipboard(sachkosten?.bueroTotal || 0, 'sk-buero-yr'); }}
									title="Büromaterial Jahreswert kopieren"
								>
									<span>{formatCurrency(sachkosten?.bueroTotal || 0)}</span>
									{#if copiedField === 'sk-buero-yr'}<span class="copied-tooltip">✓</span>{/if}
								</button>
							</td>
							<td>
								<span class="status-indicator success">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3">
										<polyline points="20 6 9 17 4 12"></polyline>
									</svg>
									Angaben vollständig
								</span>
							</td>
						</tr>
						<tr class={activeSachkostenTab === 'doku' ? 'active-row' : ''} onclick={() => (activeSachkostenTab = 'doku')}>
							<td class="font-medium">Dokumentationskosten</td>
							<td class="text-right font-mono text-muted">0,00 €</td>
							<td class="text-right font-mono text-muted">0,00 €</td>
							<td><span class="status-indicator text-muted">Keine Angaben</span></td>
						</tr>
						<tr class={activeSachkostenTab === 'quali' ? 'active-row' : ''} onclick={() => (activeSachkostenTab = 'quali')}>
							<td class="font-medium">Qualifizierungsbudget</td>
							<td class="text-right">
								<button
									type="button"
									class="copy-cell-btn cell-sum font-mono {copiedField === 'sk-quali-sum' ? 'cell-just-copied' : ''}"
									onclick={(e) => { e.stopPropagation(); copyToClipboard(sachkosten?.qualifizierungsBudgetTotal || 0, 'sk-quali-sum'); }}
									title="Qualifizierungsbudget Summe kopieren"
								>
									<span>{formatCurrency(sachkosten?.qualifizierungsBudgetTotal || 0)}</span>
									{#if copiedField === 'sk-quali-sum'}<span class="copied-tooltip">✓</span>{/if}
								</button>
							</td>
							<td class="text-right">
								<button
									type="button"
									class="copy-cell-btn cell-sum font-mono {copiedField === 'sk-quali-yr' ? 'cell-just-copied' : ''}"
									onclick={(e) => { e.stopPropagation(); copyToClipboard(sachkosten?.qualifizierungsBudgetTotal || 0, 'sk-quali-yr'); }}
									title="Qualifizierungsbudget Jahreswert kopieren"
								>
									<span>{formatCurrency(sachkosten?.qualifizierungsBudgetTotal || 0)}</span>
									{#if copiedField === 'sk-quali-yr'}<span class="copied-tooltip">✓</span>{/if}
								</button>
							</td>
							<td>
								<span class="status-indicator success">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3">
										<polyline points="20 6 9 17 4 12"></polyline>
									</svg>
									Angaben vollständig
								</span>
							</td>
						</tr>
						<tr class={activeSachkostenTab === 'vwk' ? 'active-row' : ''} onclick={() => (activeSachkostenTab = 'vwk')}>
							<td class="font-medium">sonstige Verwaltungskosten</td>
							<td class="text-right">
								<button
									type="button"
									class="copy-cell-btn cell-sum font-mono {copiedField === 'sk-vwk-sum' ? 'cell-just-copied' : ''}"
									onclick={(e) => { e.stopPropagation(); copyToClipboard(sachkosten?.vwkAmount || 0, 'sk-vwk-sum'); }}
									title="Verwaltungskosten Summe kopieren"
								>
									<span>{formatCurrency(sachkosten?.vwkAmount || 0)}</span>
									{#if copiedField === 'sk-vwk-sum'}<span class="copied-tooltip">✓</span>{/if}
								</button>
							</td>
							<td class="text-right">
								<button
									type="button"
									class="copy-cell-btn cell-sum font-mono {copiedField === 'sk-vwk-yr' ? 'cell-just-copied' : ''}"
									onclick={(e) => { e.stopPropagation(); copyToClipboard(sachkosten?.vwkAmount || 0, 'sk-vwk-yr'); }}
									title="Verwaltungskosten Jahreswert kopieren"
								>
									<span>{formatCurrency(sachkosten?.vwkAmount || 0)}</span>
									{#if copiedField === 'sk-vwk-yr'}<span class="copied-tooltip">✓</span>{/if}
								</button>
							</td>
							<td>
								<span class="status-indicator success">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3">
										<polyline points="20 6 9 17 4 12"></polyline>
									</svg>
									Angaben vollständig
								</span>
							</td>
						</tr>
						<tr class={activeSachkostenTab === 'werbung' ? 'active-row' : ''} onclick={() => (activeSachkostenTab = 'werbung')}>
							<td class="font-medium">Werbekosten</td>
							<td class="text-right font-mono text-muted">0,00 €</td>
							<td class="text-right font-mono text-muted">0,00 €</td>
							<td><span class="status-indicator text-muted">Keine Angaben</span></td>
						</tr>
						<tr class="untersetzung-row">
							<td class="text-muted">Untersetzung:</td>
							<td class="text-right font-mono text-muted">{formatCurrency((sachkosten?.bueroTotal || 0) + (sachkosten?.qualifizierungsBudgetTotal || 0) + (sachkosten?.vwkAmount || 0))}</td>
							<td class="text-right font-mono text-muted">{formatCurrency((sachkosten?.bueroTotal || 0) + (sachkosten?.qualifizierungsBudgetTotal || 0) + (sachkosten?.vwkAmount || 0))}</td>
							<td>
								<span class="status-indicator success">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3">
										<polyline points="20 6 9 17 4 12"></polyline>
									</svg>
									Korrekte Untersetzung
								</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<!-- Subtabs Bar -->
			<div class="window-tab-bar">
				<button
					type="button"
					class="subtab-btn {activeSachkostenTab === 'buero' ? 'active' : ''}"
					onclick={() => (activeSachkostenTab = 'buero')}
				>
					Büromaterial
				</button>
				<button
					type="button"
					class="subtab-btn {activeSachkostenTab === 'doku' ? 'active' : ''}"
					onclick={() => (activeSachkostenTab = 'doku')}
				>
					Dokumentationskosten
				</button>
				<button
					type="button"
					class="subtab-btn {activeSachkostenTab === 'quali' ? 'active' : ''}"
					onclick={() => (activeSachkostenTab = 'quali')}
				>
					Qualifizierungsbudget
				</button>
				<button
					type="button"
					class="subtab-btn {activeSachkostenTab === 'vwk' ? 'active' : ''}"
					onclick={() => (activeSachkostenTab = 'vwk')}
				>
					sonstige Verwaltungskosten
				</button>
				<button
					type="button"
					class="subtab-btn {activeSachkostenTab === 'werbung' ? 'active' : ''}"
					onclick={() => (activeSachkostenTab = 'werbung')}
				>
					Werbekosten
				</button>
				<button
					type="button"
					class="subtab-btn {activeSachkostenTab === 'miete' ? 'active' : ''}"
					onclick={() => (activeSachkostenTab = 'miete')}
				>
					Miete (4.1.2.1)
				</button>
			</div>

			<!-- Quick Legend Bar for Sachkosten -->
			<div class="table-legend-bar">
				<div class="legend-sections">
					<div class="legend-group">
						<span class="legend-group-title">Felder:</span>
						<div class="legend-items">
							<span class="legend-item legend-control">
								<span class="legend-dot dot-control"></span>
								<span class="legend-label">Steuerung</span>
								<span class="legend-hint">(Menge, Anteil %)</span>
							</span>
							<span class="legend-item legend-sum">
								<span class="legend-dot dot-sum"></span>
								<span class="legend-label">Zeilensumme</span>
							</span>
							<span class="legend-item legend-ctrlsum">
								<span class="legend-dot dot-ctrlsum"></span>
								<span class="legend-label">Kontrollwert</span>
							</span>
							<span class="legend-item legend-data">
								<span class="legend-dot dot-data"></span>
								<span class="legend-label">Betragsdaten</span>
							</span>
						</div>
					</div>
				</div>
				<div class="legend-right">
					<span class="legend-tip">💡 Klick auf beliebigen Wert kopiert direkt in die Zwischenablage</span>
				</div>
			</div>

			<!-- Subtab Content -->
			<div class="portal-table-container">
				{#if activeSachkostenTab === 'buero'}
					<!-- TAB: Büromaterial with Sticky Header & 1-Click Cells -->
					<table class="portal-table">
						<thead>
							<tr>
								<th class="th-action" style="width: 38px;">#</th>
								<th class="th-text th-data-header">Artikel</th>
								<th class="col-center th-control-header" title="Steuerungseingabe: Anzahl">
									<span class="th-content"><span class="th-tag control-tag">⚙</span>Anzahl</span>
								</th>
								<th class="col-num th-data-header" title="Datenfeld: Einzelpreis (€)">
									<span class="th-content"><span class="th-tag data-tag">#</span>Einzelpreis (€)</span>
								</th>
								<th class="col-num th-sum" title="Ergebnis: Positionssumme">
									<span class="th-content"><span class="th-tag sum-tag">∑</span>Summe</span>
								</th>
								<th class="col-num th-data-header" title="Kalenderjahr {activeYear}">
									<span class="th-content"><span class="th-tag data-tag">#</span>{activeYear}</span>
								</th>
								<th class="col-num th-ctrl-sum" title="Prüfwert: Quersummen-Kontrollwert">
									<span class="th-content"><span class="th-tag ctrl-tag">✓</span>Kontrollsumme</span>
								</th>
								<th class="col-action" style="width: 80px;">Aktion</th>
							</tr>
						</thead>
						<tbody>
							{#each (sachkosten?.bueroItems || []) as item, idx (item.id)}
								{@const isLastCopied = lastCopiedRowId === item.id}
								{@const isEven = idx % 2 === 0}
								{@const yVal = item.yearlyAmounts[activeYear] || item.totalAmount}
								<tr
									class="data-row {isEven ? 'row-even' : 'row-odd'} {isLastCopied ? 'last-copied-row' : ''}"
									onclick={() => (lastCopiedRowId = item.id)}
								>
									<td class="td-row-num">
										<div class="row-num-container">
											<span class="row-badge badge-sachkosten {isLastCopied ? 'badge-highlight' : ''}" title="{item.name} - Zeile {idx + 1}">
												{#if isLastCopied}<span class="active-dot">●</span>{/if}
												{idx + 1}
											</span>
										</div>
									</td>
									<td class="font-medium">
										<button
											type="button"
											class="copy-pill-btn pill-buero {copiedField === `name-${item.id}` ? 'pill-just-copied' : ''}"
											onclick={() => copyToClipboard(item.name, `name-${item.id}`, item.id)}
											title="Artikelname kopieren: {item.name}"
										>
											<span>{item.name}</span>
											{#if copiedField === `name-${item.id}`}<span class="copied-tooltip">✓</span>{/if}
										</button>
									</td>
									<!-- Anzahl (Steuerung) -->
									<td class="td-cell">
										<button
											type="button"
											class="copy-cell-btn cell-control font-mono {copiedField === `qty-${item.id}` ? 'cell-just-copied' : ''}"
											onclick={() => copyToClipboard(item.quantity, `qty-${item.id}`, item.id, true)}
											title="Menge kopieren: {item.quantity}"
										>
											<span>{item.quantity}</span>
											{#if copiedField === `qty-${item.id}`}<span class="copied-tooltip">✓</span>{/if}
										</button>
									</td>
									<!-- Einzelpreis (Datenfeld) -->
									<td class="td-cell">
										<button
											type="button"
											class="copy-cell-btn cell-data font-mono {copiedField === `price-${item.id}` ? 'cell-just-copied' : ''}"
											onclick={() => copyToClipboard(item.unitPrice, `price-${item.id}`, item.id)}
											title="Einzelpreis kopieren: {formatCurrency(item.unitPrice)}"
										>
											<span>{formatCurrency(item.unitPrice)}</span>
											{#if copiedField === `price-${item.id}`}<span class="copied-tooltip">✓</span>{/if}
										</button>
									</td>
									<!-- Summe (Amber) -->
									<td class="td-cell">
										<button
											type="button"
											class="copy-cell-btn cell-sum font-mono font-bold {copiedField === `sum-${item.id}` ? 'cell-just-copied' : ''}"
											onclick={() => copyToClipboard(item.totalAmount, `sum-${item.id}`, item.id)}
											title="Summe kopieren: {formatCurrency(item.totalAmount)}"
										>
											<span>{formatCurrency(item.totalAmount)}</span>
											{#if copiedField === `sum-${item.id}`}<span class="copied-tooltip">✓</span>{/if}
										</button>
									</td>
									<!-- Jahreswert (Slate) -->
									<td class="td-cell">
										<button
											type="button"
											class="copy-cell-btn cell-data font-mono font-bold {copiedField === `yr-${item.id}` ? 'cell-just-copied' : ''}"
											onclick={() => copyToClipboard(yVal, `yr-${item.id}`, item.id)}
											title="Jahreswert {activeYear} kopieren: {formatCurrency(yVal)}"
										>
											<span>{formatCurrency(yVal)}</span>
											{#if copiedField === `yr-${item.id}`}<span class="copied-tooltip">✓</span>{/if}
										</button>
									</td>
									<!-- Kontrollsumme (Purple) -->
									<td class="td-cell">
										<button
											type="button"
											class="copy-cell-btn cell-control-sum font-mono font-bold {copiedField === `ctrl-${item.id}` ? 'cell-just-copied' : ''}"
											onclick={() => copyToClipboard(item.controlSum, `ctrl-${item.id}`, item.id)}
											title="Kontrollsumme kopieren: {formatCurrency(item.controlSum)}"
										>
											<span>{formatCurrency(item.controlSum)}</span>
											{#if copiedField === `ctrl-${item.id}`}<span class="copied-tooltip">✓</span>{/if}
										</button>
									</td>
									<!-- Row TSV -->
									<td class="td-action">
										<button
											type="button"
											class="copy-row-btn {isLastCopied ? 'btn-active-row' : ''}"
											onclick={() => copyBueroRowTSV(item)}
											title="Ganze Zeile als Tabellenwerte kopieren (TSV)"
										>
											{#if copiedField === `row-tsv-${item.id}`}
												✓ Kopiert
											{:else}
												Kopieren
											{/if}
										</button>
									</td>
								</tr>
								<!-- Description row with active indicator & quick copy pills -->
								<tr
									class="desc-row {isEven ? 'row-even' : 'row-odd'} {isLastCopied ? 'last-copied-row' : ''}"
									onclick={() => (lastCopiedRowId = item.id)}
								>
									<td colspan="8">
										<div class="meta-content-wrapper">
											{#if isLastCopied}
												<div class="last-active-indicator" title="Diese Zeile wird gerade bearbeitet">
													<span class="pulse-indicator"></span>
													<span>Aktive Zeile</span>
												</div>
											{/if}

											<div class="meta-pills-row">
												<!-- Artikel -->
												<button
													type="button"
													class="copy-meta-btn meta-name-btn {copiedField === `bname-${item.id}` ? 'btn-copied' : ''}"
													onclick={() => copyToClipboard(item.name, `bname-${item.id}`, item.id)}
													title="Artikel kopieren: {item.name}"
												>
													<span class="meta-label">Artikel:</span>
													<span class="meta-val">{item.name}</span>
													{#if copiedField === `bname-${item.id}`}<span class="copied-inline">✓</span>{:else}<span class="copy-icon">⎘</span>{/if}
												</button>

												<!-- Menge & Einzelpreis -->
												<button
													type="button"
													class="copy-meta-btn meta-period-btn {copiedField === `bcalc-${item.id}` ? 'btn-copied' : ''}"
													onclick={() => copyToClipboard(`${item.quantity} × ${formatCurrency(item.unitPrice)}`, `bcalc-${item.id}`, item.id)}
													title="Menge & Preis kopieren"
												>
													<span class="meta-label">Berechnung:</span>
													<span class="meta-val">{item.quantity} × {formatCurrency(item.unitPrice)}</span>
													{#if copiedField === `bcalc-${item.id}`}<span class="copied-inline">✓</span>{:else}<span class="copy-icon">⎘</span>{/if}
												</button>
											</div>

											<div class="portal-desc-box">
												<span class="desc-text">{item.description}</span>
												<button
													type="button"
													class="copy-desc-btn {copiedField === item.id ? 'btn-copied' : ''}"
													onclick={() => copyToClipboard(item.description, item.id, item.id)}
													title="Erläuterungstext kopieren"
												>
													{#if copiedField === item.id}
														✓ Erläuterung kopiert
													{:else}
														<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
															<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
															<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
														</svg>
														Erläuterung kopieren
													{/if}
												</button>
											</div>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="total-row">
								<td class="col-idx">∑</td>
								<td colspan="3" class="text-right font-bold">Summe Büromaterial:</td>
								<td class="col-num font-mono font-bold text-accent">
									<button
										type="button"
										class="copy-cell-btn cell-sum font-mono font-bold {copiedField === 'sk-buero-foot-sum' ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(sachkosten?.bueroTotal || 0, 'sk-buero-foot-sum')}
									>
										<span>{formatCurrency(sachkosten?.bueroTotal || 0)}</span>
										{#if copiedField === 'sk-buero-foot-sum'}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>
								<td class="col-num font-mono font-bold text-accent">
									<button
										type="button"
										class="copy-cell-btn cell-sum font-mono font-bold {copiedField === 'sk-buero-foot-yr' ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(sachkosten?.bueroTotal || 0, 'sk-buero-foot-yr')}
									>
										<span>{formatCurrency(sachkosten?.bueroTotal || 0)}</span>
										{#if copiedField === 'sk-buero-foot-yr'}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>
								<td class="col-num font-mono font-bold text-accent">
									<button
										type="button"
										class="copy-cell-btn cell-control-sum font-mono font-bold {copiedField === 'sk-buero-foot-ctrl' ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(sachkosten?.bueroTotal || 0, 'sk-buero-foot-ctrl')}
									>
										<span>{formatCurrency(sachkosten?.bueroTotal || 0)}</span>
										{#if copiedField === 'sk-buero-foot-ctrl'}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>
								<td></td>
							</tr>
						</tfoot>
					</table>
				{:else if activeSachkostenTab === 'quali'}
					<!-- TAB: Qualifizierungsbudget -->
					<table class="portal-table">
						<thead>
							<tr>
								<th class="th-action" style="width: 38px;">#</th>
								<th class="th-text th-data-header">Bezeichnung</th>
								<th class="col-num th-data-header" title="Datenfeld: Betrag (€)">
									<span class="th-content"><span class="th-tag data-tag">#</span>Betrag (€)</span>
								</th>
								<th class="col-num th-sum" title="Ergebnis: Summe">
									<span class="th-content"><span class="th-tag sum-tag">∑</span>Summe</span>
								</th>
								<th class="col-num th-data-header" title="Kalenderjahr {activeYear}">
									<span class="th-content"><span class="th-tag data-tag">#</span>{activeYear}</span>
								</th>
								<th class="col-num th-ctrl-sum" title="Prüfwert: Kontrollsumme">
									<span class="th-content"><span class="th-tag ctrl-tag">✓</span>Kontrollsumme</span>
								</th>
								<th class="col-action" style="width: 80px;">Aktion</th>
							</tr>
						</thead>
						<tbody>
							<tr
								class="data-row {lastCopiedRowId === 'quali-row-1' ? 'last-copied-row' : ''}"
								onclick={() => (lastCopiedRowId = 'quali-row-1')}
							>
								<td class="td-row-num">
									<div class="row-num-container">
										<span class="row-badge badge-sachkosten {lastCopiedRowId === 'quali-row-1' ? 'badge-highlight' : ''}">
											{#if lastCopiedRowId === 'quali-row-1'}<span class="active-dot">●</span>{/if}
											1
										</span>
									</div>
								</td>
								<td class="font-medium">
									<button
										type="button"
										class="copy-pill-btn pill-buero"
										onclick={() => copyToClipboard('Qualifizierungsbudget', 'quali-title', 'quali-row-1')}
									>
										Qualifizierungsbudget
									</button>
								</td>
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-data font-mono {copiedField === 'quali-amt' ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(qualiBudgetTotal, 'quali-amt', 'quali-row-1')}
									>
										<span>{formatCurrency(qualiBudgetTotal)}</span>
										{#if copiedField === 'quali-amt'}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-sum font-mono font-bold {copiedField === 'quali-sum' ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(qualiBudgetTotal, 'quali-sum', 'quali-row-1')}
									>
										<span>{formatCurrency(qualiBudgetTotal)}</span>
										{#if copiedField === 'quali-sum'}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-data font-mono font-bold {copiedField === 'quali-yr' ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(qualiBudgetTotal, 'quali-yr', 'quali-row-1')}
									>
										<span>{formatCurrency(qualiBudgetTotal)}</span>
										{#if copiedField === 'quali-yr'}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-control-sum font-mono font-bold {copiedField === 'quali-ctrl' ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(qualiBudgetTotal, 'quali-ctrl', 'quali-row-1')}
									>
										<span>{formatCurrency(qualiBudgetTotal)}</span>
										{#if copiedField === 'quali-ctrl'}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>
								<td class="td-action">
									<button
										type="button"
										class="copy-row-btn"
										onclick={copyQualiRowTSV}
										title="Ganze Zeile kopieren (TSV)"
									>
										{#if copiedField === 'row-tsv-quali'}✓ Kopiert{:else}Kopieren{/if}
									</button>
								</td>
							</tr>
							<tr
								class="desc-row {lastCopiedRowId === 'quali-row-1' ? 'last-copied-row' : ''}"
								onclick={() => (lastCopiedRowId = 'quali-row-1')}
							>
								<td colspan="7">
									<div class="meta-content-wrapper">
										{#if lastCopiedRowId === 'quali-row-1'}
											<div class="last-active-indicator" title="Diese Zeile wird gerade bearbeitet">
												<span class="pulse-indicator"></span>
												<span>Aktive Zeile</span>
											</div>
										{/if}
										<div class="portal-desc-box">
											<span class="desc-text">{sachkosten?.qualifizierungsText}</span>
											<button
												type="button"
												class="copy-desc-btn {copiedField === 'desc-quali' ? 'btn-copied' : ''}"
												onclick={() => copyToClipboard(sachkosten?.qualifizierungsText || '', 'desc-quali', 'quali-row-1')}
											>
												{#if copiedField === 'desc-quali'}✓ Erläuterung kopiert{:else}Erläuterung kopieren{/if}
											</button>
										</div>
									</div>
								</td>
							</tr>
						</tbody>
						<tfoot>
							<tr class="total-row">
								<td class="col-idx">∑</td>
								<td colspan="2" class="text-right font-bold">Summe Qualifizierungsbudget:</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.qualifizierungsBudgetTotal || 0)}</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.qualifizierungsBudgetTotal || 0)}</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.qualifizierungsBudgetTotal || 0)}</td>
								<td></td>
							</tr>
						</tfoot>
					</table>
				{:else if activeSachkostenTab === 'vwk'}
					<!-- TAB: sonstige Verwaltungskosten -->
					<table class="portal-table">
						<thead>
							<tr>
								<th class="th-action" style="width: 38px;">#</th>
								<th class="th-text th-data-header">Bezeichnung</th>
								<th class="col-num th-data-header" title="Datenfeld: Betrag (€)">
									<span class="th-content"><span class="th-tag data-tag">#</span>Betrag (€)</span>
								</th>
								<th class="col-center th-control-header" title="Steuerungseingabe: Anteil (%)">
									<span class="th-content"><span class="th-tag control-tag">⚙</span>Anteil (%)</span>
								</th>
								<th class="col-num th-sum" title="Ergebnis: Summe">
									<span class="th-content"><span class="th-tag sum-tag">∑</span>Summe</span>
								</th>
								<th class="col-num th-data-header" title="Kalenderjahr {activeYear}">
									<span class="th-content"><span class="th-tag data-tag">#</span>{activeYear}</span>
								</th>
								<th class="col-num th-ctrl-sum" title="Prüfwert: Kontrollsumme">
									<span class="th-content"><span class="th-tag ctrl-tag">✓</span>Kontrollsumme</span>
								</th>
								<th class="col-action" style="width: 80px;">Aktion</th>
							</tr>
						</thead>
						<tbody>
							<tr
								class="data-row {lastCopiedRowId === 'vwk-row-1' ? 'last-copied-row' : ''}"
								onclick={() => (lastCopiedRowId = 'vwk-row-1')}
							>
								<td class="td-row-num">
									<div class="row-num-container">
										<span class="row-badge badge-sachkosten {lastCopiedRowId === 'vwk-row-1' ? 'badge-highlight' : ''}">
											{#if lastCopiedRowId === 'vwk-row-1'}<span class="active-dot">●</span>{/if}
											1
										</span>
									</div>
								</td>
								<td class="font-medium">
									<button
										type="button"
										class="copy-pill-btn pill-buero"
										onclick={() => copyToClipboard('Vwk-Pauschale', 'vwk-title', 'vwk-row-1')}
									>
										Vwk-Pauschale
									</button>
								</td>
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-data font-mono {copiedField === 'vwk-amt' ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(vwkAmountVal, 'vwk-amt', 'vwk-row-1')}
									>
										<span>{formatCurrency(vwkAmountVal)}</span>
										{#if copiedField === 'vwk-amt'}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-control font-mono {copiedField === 'vwk-pct' ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(100, 'vwk-pct', 'vwk-row-1', true)}
									>
										<span>100</span>
										{#if copiedField === 'vwk-pct'}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-sum font-mono font-bold {copiedField === 'vwk-sum' ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(vwkAmountVal, 'vwk-sum', 'vwk-row-1')}
									>
										<span>{formatCurrency(vwkAmountVal)}</span>
										{#if copiedField === 'vwk-sum'}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-data font-mono font-bold {copiedField === 'vwk-yr' ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(vwkAmountVal, 'vwk-yr', 'vwk-row-1')}
									>
										<span>{formatCurrency(vwkAmountVal)}</span>
										{#if copiedField === 'vwk-yr'}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>
								<td class="td-cell">
									<button
										type="button"
										class="copy-cell-btn cell-control-sum font-mono font-bold {copiedField === 'vwk-ctrl' ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(vwkAmountVal, 'vwk-ctrl', 'vwk-row-1')}
									>
										<span>{formatCurrency(vwkAmountVal)}</span>
										{#if copiedField === 'vwk-ctrl'}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</td>
								<td class="td-action">
									<button
										type="button"
										class="copy-row-btn"
										onclick={copyVwkRowTSV}
										title="Ganze Zeile kopieren (TSV)"
									>
										{#if copiedField === 'row-tsv-vwk'}✓ Kopiert{:else}Kopieren{/if}
									</button>
								</td>
							</tr>
							<tr
								class="desc-row {lastCopiedRowId === 'vwk-row-1' ? 'last-copied-row' : ''}"
								onclick={() => (lastCopiedRowId = 'vwk-row-1')}
							>
								<td colspan="8">
									<div class="meta-content-wrapper">
										{#if lastCopiedRowId === 'vwk-row-1'}
											<div class="last-active-indicator" title="Diese Zeile wird gerade bearbeitet">
												<span class="pulse-indicator"></span>
												<span>Aktive Zeile</span>
											</div>
										{/if}
										<div class="portal-desc-box">
											<span class="desc-text">{sachkosten?.vwkText}</span>
											<button
												type="button"
												class="copy-desc-btn {copiedField === 'desc-vwk' ? 'btn-copied' : ''}"
												onclick={() => copyToClipboard(sachkosten?.vwkText || '', 'desc-vwk', 'vwk-row-1')}
											>
												{#if copiedField === 'desc-vwk'}✓ Erläuterung kopiert{:else}Erläuterung kopieren{/if}
											</button>
										</div>
									</div>
								</td>
							</tr>
						</tbody>
						<tfoot>
							<tr class="total-row">
								<td class="col-idx">∑</td>
								<td colspan="3" class="text-right font-bold">Summe Verwaltungskosten:</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.vwkAmount || 0)}</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.vwkAmount || 0)}</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.vwkAmount || 0)}</td>
								<td></td>
							</tr>
						</tfoot>
					</table>
				{:else if activeSachkostenTab === 'miete'}
					<div class="config-tab-box">
						<div class="config-header">
							<h4>Miete & Mietnebenkosten (Position 4.1.2.1)</h4>
							<p class="text-sm text-muted">Vom Träger konfigurierbarer monatlicher oder gesamter Mietbetrag.</p>
						</div>
						<div class="config-form">
							<label class="config-label">
								<span>Miete & Mietnebenkosten Gesamt (€):</span>
								<div class="input-with-copy">
									<input
										type="number"
										step="0.01"
										class="config-input"
										bind:value={userMiete}
										onchange={() => onUpdateOptions && onUpdateOptions({ mieteAmount: userMiete })}
									/>
									<button
										type="button"
										class="copy-cell-btn cell-sum font-mono {copiedField === 'miete-val' ? 'cell-just-copied' : ''}"
										onclick={() => copyToClipboard(userMiete, 'miete-val')}
										title="Mietbetrag kopieren"
									>
										<span>{formatCurrency(userMiete)}</span>
										{#if copiedField === 'miete-val'}<span class="copied-tooltip">✓</span>{/if}
									</button>
								</div>
							</label>
							<span class="config-note">Im Finanzierungsplan mit 1.707,15 € hinterlegt.</span>
						</div>
					</div>
				{:else}
					<div class="empty-state">
						<p class="text-muted">Für diesen Reiter liegen keine Daten vor (0,00 €).</p>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- WINDOW 3: TV-L Vergleichsberechnung -->
		<div class="tvl-wrapper">
			<TvlComparisonCompanion {result} />
		</div>
	{/if}
</div>

<!-- Modal for Browser Automation Script (Playwright) - Ported from §16i -->
{#if showScriptModal}
	<div
		class="modal-backdrop"
		onclick={() => (showScriptModal = false)}
		onkeydown={(e) => { if (e.key === 'Escape') showScriptModal = false; }}
		tabindex="-1"
		role="presentation"
	>
		<div
			class="modal-content"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-label="Browser Automation Script"
			tabindex="0"
		>
			<div class="modal-header">
				<h3>Berliner JobCoaching - Browser-Automation Payload & Script</h3>
				<button type="button" class="close-btn" onclick={() => (showScriptModal = false)}>✕</button>
			</div>

			<p class="modal-intro">
				Für die automatisierte Formularübernahme in das ZGS-Portal via Playwright oder Browser-Subagent:
			</p>

			<div class="modal-body">
				<div class="code-header">
					<span>Playwright Test Script (Automatische Formularausfüllung)</span>
					<button
						type="button"
						class="btn-modal-copy"
						onclick={() => copyToClipboard(playwrightScript, 'modal-script')}
					>
						{#if copiedField === 'modal-script'}✓ Skript kopiert{:else}Skript kopieren{/if}
					</button>
				</div>
				<pre class="code-block"><code>{playwrightScript}</code></pre>

				<div class="code-header" style="margin-top: 1.5rem;">
					<span>Strukturierter Automation-Payload (JSON)</span>
					<button
						type="button"
						class="btn-modal-copy"
						onclick={() => copyToClipboard(automationJson, 'modal-json')}
					>
						{#if copiedField === 'modal-json'}✓ JSON kopiert{:else}JSON kopieren{/if}
					</button>
				</div>
				<pre class="code-block"><code>{automationJson}</code></pre>
			</div>
		</div>
	</div>
{/if}

<style>
	.jobcoaching-portal-root {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: 100%;
	}

	.portal-window-tabs {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(30, 41, 59, 0.7);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 0.4rem;
		flex-wrap: wrap;
	}

	.nav-tab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #94a3b8;
		background: transparent;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.nav-tab:hover {
		color: #f1f5f9;
		background: rgba(255, 255, 255, 0.04);
	}

	.nav-tab.active {
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.12);
		border: 1px solid rgba(56, 189, 248, 0.25);
	}

	.badge {
		font-size: 0.75rem;
		padding: 0.15rem 0.45rem;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.06);
		color: #e2e8f0;
		font-family: monospace;
	}

	.nav-tab.active .badge {
		background: rgba(56, 189, 248, 0.2);
		color: #38bdf8;
	}

	.badge-tag {
		font-size: 0.7rem;
		padding: 0.15rem 0.45rem;
		border-radius: 9999px;
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
	}

	.nav-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.export-btn {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		border: none;
		border-radius: 8px;
		padding: 0.45rem 0.85rem;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s ease, transform 0.15s ease;
		box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
	}

	.export-btn:hover {
		opacity: 0.92;
		transform: translateY(-1px);
	}

	/* Companion Window */
	.companion-window {
		background: #1e2430;
		border: 1px solid #334155;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
	}

	.window-titlebar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.7rem 1.1rem;
		background: #131822;
		border-bottom: 1px solid #2d3748;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.titlebar-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.traffic-lights {
		display: flex;
		gap: 5px;
	}

	.traffic-lights .light {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.traffic-lights .red { background-color: #ef4444; }
	.traffic-lights .yellow { background-color: #f59e0b; }
	.traffic-lights .green { background-color: #10b981; }

	.window-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: #e2e8f0;
		letter-spacing: 0.02em;
	}

	.titlebar-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: rgba(255, 255, 255, 0.06);
		color: #cbd5e1;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		padding: 0.35rem 0.7rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn:hover {
		background: rgba(255, 255, 255, 0.12);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.2);
	}

	.script-btn {
		background: rgba(99, 102, 241, 0.12);
		border-color: rgba(99, 102, 241, 0.3);
		color: #a5b4fc;
	}

	.script-btn:hover {
		background: rgba(99, 102, 241, 0.22);
		border-color: #818cf8;
		color: #ffffff;
	}

	.window-intro {
		padding: 0.65rem 1.1rem;
		font-size: 0.78rem;
		color: #94a3b8;
		background: rgba(15, 23, 42, 0.4);
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		line-height: 1.4;
	}

	/* Summary Overview */
	.summary-overview {
		padding: 0.75rem 1.1rem;
		background: rgba(15, 23, 42, 0.6);
		border-bottom: 1px solid #2d3748;
	}

	.overview-table {
		width: 100%;
		max-width: 650px;
		border-collapse: collapse;
		font-size: 0.8rem;
	}

	.overview-table th {
		color: #94a3b8;
		font-weight: 500;
		padding: 0.3rem 0.5rem;
		text-align: left;
	}

	.overview-table td {
		padding: 0.35rem 0.5rem;
		color: #f1f5f9;
	}

	.overview-table .active-row td {
		color: #38bdf8;
		font-weight: 600;
	}

	.untersetzung-row td {
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.status-indicator {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: #10b981;
	}

	.status-indicator.text-muted {
		color: #64748b;
	}

	.window-tab-bar {
		display: flex;
		gap: 4px;
		padding: 0.4rem 1.1rem 0;
		background: #18202c;
		border-bottom: 1px solid #334155;
	}

	.subtab-btn {
		padding: 0.45rem 0.9rem;
		font-size: 0.8rem;
		font-weight: 500;
		color: #94a3b8;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid transparent;
		border-bottom: none;
		border-radius: 6px 6px 0 0;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.subtab-btn:hover {
		color: #e2e8f0;
		background: rgba(255, 255, 255, 0.06);
	}

	.subtab-btn.active {
		color: #38bdf8;
		background: #1e2430;
		border-color: #334155 #334155 transparent #334155;
		font-weight: 600;
	}

	/* Table Legend Bar (Ported from §16i) */
	.table-legend-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.45rem 1.1rem;
		background: rgba(15, 23, 42, 0.75);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		font-size: 0.75rem;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.legend-sections {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		flex-wrap: wrap;
	}

	.legend-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.legend-group-title {
		color: #64748b;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.legend-items {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.725rem;
	}

	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		display: inline-block;
	}

	.dot-cat-coach {
		background: #38bdf8;
		box-shadow: 0 0 6px rgba(56, 189, 248, 0.4);
	}

	.dot-cat-trainer {
		background: #c084fc;
		box-shadow: 0 0 6px rgba(192, 132, 252, 0.4);
	}

	.dot-control {
		background: rgba(14, 165, 233, 0.4);
		border: 1.5px solid #38bdf8;
		box-shadow: 0 0 6px rgba(56, 189, 248, 0.4);
	}

	.dot-sum {
		background: rgba(245, 158, 11, 0.4);
		border: 1.5px solid #fbbf24;
		box-shadow: 0 0 6px rgba(245, 158, 11, 0.4);
	}

	.dot-ctrlsum {
		background: rgba(139, 92, 246, 0.4);
		border: 1.5px solid #a78bfa;
		box-shadow: 0 0 6px rgba(167, 139, 250, 0.4);
	}

	.dot-data {
		background: rgba(30, 41, 59, 0.9);
		border: 1.5px solid rgba(255, 255, 255, 0.3);
	}

	.legend-label {
		font-weight: 600;
	}

	.legend-control .legend-label { color: #7dd3fc; }
	.legend-sum .legend-label { color: #fde68a; }
	.legend-ctrlsum .legend-label { color: #c084fc; }
	.legend-data .legend-label { color: #e2e8f0; }

	.legend-hint {
		color: #64748b;
		font-size: 0.68rem;
	}

	.legend-tip {
		color: #94a3b8;
		font-size: 0.72rem;
	}

	/* Personnel Filter Toolbar (Ported from §16i) */
	.participant-filter-bar {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.45rem 1.1rem;
		background: rgba(15, 23, 42, 0.85);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		flex-wrap: wrap;
	}

	.filter-label {
		font-size: 0.725rem;
		font-weight: 600;
		color: #94a3b8;
	}

	.filter-pills {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.filter-pill {
		padding: 0.2rem 0.6rem;
		font-size: 0.725rem;
		font-weight: 500;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.05);
		color: #cbd5e1;
		border: 1px solid rgba(255, 255, 255, 0.1);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.filter-pill:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
	}

	.filter-pill.active {
		background: rgba(56, 189, 248, 0.18);
		color: #38bdf8;
		border-color: rgba(56, 189, 248, 0.4);
		font-weight: 600;
	}

	/* Portal Table */
	.portal-table-container {
		padding: 0.5rem 0.75rem 1rem;
		overflow-x: auto;
	}

	.portal-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 0.8rem;
	}

	/* Sticky Frosted Table Header (Ported from §16i) */
	.portal-table thead {
		position: sticky;
		top: 0;
		z-index: 30;
	}

	.portal-table th {
		position: sticky;
		top: 0;
		z-index: 30;
		background: rgba(17, 24, 39, 0.98);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		color: #94a3b8;
		font-weight: 600;
		font-size: 0.75rem;
		text-align: right;
		padding: 0.55rem 0.4rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		border-bottom: 2px solid rgba(99, 102, 241, 0.4);
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
		white-space: nowrap;
		user-select: none;
	}

	.portal-table th.th-action,
	.portal-table th.col-action {
		text-align: center;
		padding: 0.55rem 0.3rem;
	}

	.portal-table th.th-text {
		text-align: left;
	}

	.th-content {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		white-space: nowrap;
	}

	.th-tag {
		font-size: 0.65rem;
		padding: 1px 3px;
		border-radius: 3px;
		font-weight: 700;
	}

	.th-control-header { color: #38bdf8 !important; }
	.control-tag {
		background: rgba(14, 165, 233, 0.2);
		color: #38bdf8;
		border: 1px solid rgba(56, 189, 248, 0.4);
	}

	.th-sum { color: #fbbf24 !important; }
	.sum-tag {
		background: rgba(245, 158, 11, 0.2);
		color: #fbbf24;
		border: 1px solid rgba(245, 158, 11, 0.4);
	}

	.th-ctrl-sum { color: #c084fc !important; }
	.ctrl-tag {
		background: rgba(139, 92, 246, 0.2);
		color: #c084fc;
		border: 1px solid rgba(167, 139, 250, 0.4);
	}

	.th-data-header { color: #cbd5e1; }
	.data-tag {
		background: rgba(255, 255, 255, 0.1);
		color: #cbd5e1;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	/* Data Row */
	.data-row {
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		transition: background 0.15s ease;
	}

	.data-row td {
		padding: 0.3rem 0.25rem;
		color: #e2e8f0;
	}

	.row-even { background: rgba(15, 23, 42, 0.25); }
	.row-odd { background: rgba(15, 23, 42, 0.45); }

	.data-row:hover {
		background: rgba(56, 189, 248, 0.08) !important;
	}

	/* Row Role Theme Left Border */
	.row-coach td:first-child {
		border-left: 3px solid #38bdf8;
	}
	.row-trainer td:first-child {
		border-left: 3px solid #c084fc;
	}

	/* Last Copied / Active Row Highlight (Ported from §16i) */
	.data-row,
	.desc-row {
		cursor: pointer;
	}
	.last-copied-row {
		background: rgba(99, 102, 241, 0.22) !important;
	}
	.data-row.last-copied-row {
		border-top: 2.5px solid #818cf8 !important;
		box-shadow: inset 0 2px 8px rgba(129, 140, 248, 0.2);
	}
	.desc-row.last-copied-row td {
		border-bottom: 2.5px solid #818cf8 !important;
		box-shadow: inset 0 -2px 8px rgba(129, 140, 248, 0.2);
	}
	.last-copied-row td:first-child {
		border-left: 4px solid #818cf8 !important;
	}

	.td-row-num {
		padding: 0.35rem 0.2rem;
		text-align: center;
		width: 38px;
	}

	.row-num-container {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.row-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 24px;
		height: 20px;
		padding: 0 4px;
		border-radius: 6px;
		font-weight: 700;
		font-size: 0.725rem;
		font-family: monospace;
	}

	.badge-coach {
		background: rgba(56, 189, 248, 0.18);
		border: 1px solid rgba(56, 189, 248, 0.4);
		color: #7dd3fc;
	}

	.badge-trainer {
		background: rgba(192, 132, 252, 0.18);
		border: 1px solid rgba(192, 132, 252, 0.4);
		color: #e9d5ff;
	}

	.badge-sachkosten {
		background: rgba(20, 184, 166, 0.18);
		border: 1px solid rgba(20, 184, 166, 0.4);
		color: #99f6e4;
	}

	.badge-highlight {
		background: rgba(99, 102, 241, 0.55) !important;
		border-color: #818cf8 !important;
		color: #ffffff !important;
		box-shadow: 0 0 10px rgba(129, 140, 248, 0.6);
	}

	.active-dot {
		color: #818cf8;
		animation: pulse-dot 1.5s infinite;
		font-size: 0.75rem;
	}

	@keyframes pulse-dot {
		0% { transform: scale(0.9); opacity: 0.7; }
		50% { transform: scale(1.3); opacity: 1; }
		100% { transform: scale(0.9); opacity: 0.7; }
	}

	/* Copyable Cell Button (Ported from §16i) */
	.td-cell {
		padding: 0.3rem 0.25rem;
		text-align: right;
	}

	.copy-cell-btn {
		width: 100%;
		border-radius: 6px;
		padding: 0.32rem 0.35rem;
		font-size: 0.78rem;
		text-align: right;
		cursor: pointer;
		position: relative;
		transition: all 0.15s ease;
		display: inline-block;
	}

	/* 1. Control Inputs (Hours, Vacation, Months, Quantity, %) - Sky/Cyan */
	.copy-cell-btn.cell-control {
		background: rgba(14, 165, 233, 0.12);
		border: 1px solid rgba(56, 189, 248, 0.38);
		color: #7dd3fc;
		font-weight: 600;
		text-align: center;
	}

	.copy-cell-btn.cell-control:hover {
		background: rgba(14, 165, 233, 0.28);
		border-color: #38bdf8;
		color: #ffffff;
		box-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
		transform: translateY(-1px);
	}

	/* 2. Position Total / Summe - Warm Amber/Gold */
	.copy-cell-btn.cell-sum {
		background: rgba(245, 158, 11, 0.14);
		border: 1px solid rgba(245, 158, 11, 0.4);
		color: #fde68a;
		font-weight: 700;
	}

	.copy-cell-btn.cell-sum:hover {
		background: rgba(245, 158, 11, 0.28);
		border-color: #fbbf24;
		color: #ffffff;
		box-shadow: 0 0 10px rgba(245, 158, 11, 0.45);
		transform: translateY(-1px);
	}

	/* 3. Control Sum / Checksum - Soft Violet/Purple */
	.copy-cell-btn.cell-control-sum {
		background: rgba(139, 92, 246, 0.14);
		border: 1px solid rgba(167, 139, 250, 0.38);
		color: #ddd6fe;
	}

	.copy-cell-btn.cell-control-sum:hover {
		background: rgba(139, 92, 246, 0.28);
		border-color: #a78bfa;
		color: #ffffff;
		box-shadow: 0 0 10px rgba(167, 139, 250, 0.45);
		transform: translateY(-1px);
	}

	/* 4. Financial Base Data - Slate/White */
	.copy-cell-btn.cell-data {
		background: rgba(30, 41, 59, 0.72);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #f1f5f9;
	}

	.copy-cell-btn.cell-data:hover {
		background: rgba(99, 102, 241, 0.25);
		border-color: #818cf8;
		color: #ffffff;
		box-shadow: 0 0 10px rgba(99, 102, 241, 0.35);
		transform: translateY(-1px);
	}

	/* Copied Cell Glow Feedback */
	.copy-cell-btn.cell-just-copied {
		background: rgba(16, 185, 129, 0.35) !important;
		border-color: #34d399 !important;
		color: #ffffff !important;
		box-shadow: 0 0 12px rgba(52, 211, 153, 0.5) !important;
	}

	.copied-tooltip {
		position: absolute;
		top: -14px;
		right: 4px;
		background: #10b981;
		color: #ffffff;
		font-size: 0.625rem;
		padding: 1px 4px;
		border-radius: 3px;
		font-weight: bold;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
		z-index: 10;
	}

	/* Copyable Pills (Role, Tariff, Buero) */
	.copy-pill-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.55rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
		position: relative;
	}

	.pill-role {
		background: rgba(56, 189, 248, 0.15);
		color: #38bdf8;
		border: 1px solid rgba(56, 189, 248, 0.3);
	}

	.pill-coach {
		background: rgba(56, 189, 248, 0.15);
		color: #38bdf8;
		border: 1px solid rgba(56, 189, 248, 0.3);
	}

	.pill-trainer {
		background: rgba(192, 132, 252, 0.15);
		color: #c084fc;
		border: 1px solid rgba(192, 132, 252, 0.3);
	}

	.pill-tariff {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
		border: 1px solid rgba(168, 85, 247, 0.3);
	}

	.pill-buero {
		background: rgba(255, 255, 255, 0.05);
		color: #f1f5f9;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.copy-pill-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
	}

	.pill-just-copied {
		background: rgba(16, 185, 129, 0.35) !important;
		border-color: #34d399 !important;
		color: #ffffff !important;
	}

	/* Row TSV Copy Button */
	.td-action {
		text-align: center;
		padding: 0.3rem 0.35rem;
	}

	.copy-row-btn {
		width: 100%;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 6px;
		color: #94a3b8;
		padding: 0.32rem 0.45rem;
		font-size: 0.72rem;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.copy-row-btn:hover {
		background: rgba(99, 102, 241, 0.25);
		border-color: #818cf8;
		color: #ffffff;
		transform: translateY(-1px);
	}

	.copy-row-btn.btn-active-row {
		background: rgba(99, 102, 241, 0.35);
		border-color: #818cf8;
		color: #ffffff;
	}

	/* Sub-Row Metadata & Description Area */
	.desc-row td {
		padding: 0.25rem 0.5rem 0.65rem;
		border-bottom: 1px solid #2d3748;
	}

	.meta-content-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding-left: 0.5rem;
	}

	.last-active-indicator {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: rgba(99, 102, 241, 0.22);
		border: 1px solid rgba(129, 140, 248, 0.5);
		border-radius: 4px;
		padding: 0.18rem 0.5rem;
		font-size: 0.7rem;
		font-weight: 700;
		color: #e0e7ff;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		width: fit-content;
	}

	.pulse-indicator {
		width: 6px;
		height: 6px;
		background: #818cf8;
		border-radius: 50%;
		box-shadow: 0 0 6px #818cf8;
		animation: pulse-dot 1.5s infinite;
	}

	.meta-pills-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.copy-meta-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: rgba(30, 41, 59, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		padding: 0.2rem 0.5rem;
		font-size: 0.72rem;
		color: #cbd5e1;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.copy-meta-btn:hover {
		background: rgba(56, 189, 248, 0.2);
		border-color: #38bdf8;
		color: #ffffff;
		transform: translateY(-1px);
	}

	.copy-meta-btn.meta-name-btn {
		background: rgba(99, 102, 241, 0.12);
		border-color: rgba(99, 102, 241, 0.3);
		color: #c7d2fe;
	}

	.copy-meta-btn.meta-period-btn {
		background: rgba(14, 165, 233, 0.12);
		border-color: rgba(56, 189, 248, 0.3);
		color: #bae6fd;
	}

	.copy-meta-btn.meta-tariff-btn {
		background: rgba(168, 85, 247, 0.12);
		border-color: rgba(168, 85, 247, 0.3);
		color: #e9d5ff;
	}

	.copy-meta-btn.highlight-btn {
		background: rgba(245, 158, 11, 0.14);
		border-color: rgba(245, 158, 11, 0.4);
		color: #fde68a;
	}

	.copy-meta-btn.btn-copied {
		background: rgba(16, 185, 129, 0.3) !important;
		border-color: #34d399 !important;
		color: #ffffff !important;
	}

	.meta-label {
		color: #64748b;
		font-size: 0.68rem;
		font-weight: 600;
	}

	.meta-val {
		font-family: monospace;
	}

	.copy-icon {
		opacity: 0.6;
		font-size: 0.7rem;
	}

	.copied-inline {
		color: #34d399;
		font-weight: bold;
	}

	.portal-desc-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: rgba(15, 23, 42, 0.55);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		padding: 0.45rem 0.8rem;
		font-family: monospace;
		font-size: 0.72rem;
		color: #94a3b8;
		gap: 0.75rem;
	}

	.desc-text {
		word-break: break-word;
	}

	.copy-desc-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: rgba(255, 255, 255, 0.08);
		color: #cbd5e1;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 4px;
		padding: 0.22rem 0.55rem;
		font-size: 0.7rem;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.copy-desc-btn:hover {
		background: rgba(255, 255, 255, 0.18);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.25);
	}

	.copy-desc-btn.btn-copied {
		background: rgba(16, 185, 129, 0.3) !important;
		border-color: #34d399 !important;
		color: #ffffff !important;
	}

	/* Footer Totals */
	.total-row td {
		padding: 0.75rem 0.4rem;
		background: #141c28;
		border-top: 2px solid #334155;
		border-bottom: none;
	}

	.text-accent { color: #38bdf8; }

	/* Configuration Tab Box */
	.config-tab-box {
		padding: 1.5rem;
		background: rgba(15, 23, 42, 0.4);
		border-radius: 8px;
		max-width: 550px;
	}

	.config-header h4 {
		margin: 0 0 0.25rem;
		color: #f1f5f9;
		font-size: 0.95rem;
	}

	.config-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.config-label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		color: #cbd5e1;
		font-size: 0.85rem;
	}

	.input-with-copy {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.config-input {
		background: #0f172a;
		border: 1px solid #334155;
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		color: #f1f5f9;
		font-family: monospace;
		font-size: 0.85rem;
		max-width: 200px;
	}

	.config-note {
		font-size: 0.75rem;
		color: #64748b;
	}

	.empty-state {
		padding: 2.5rem;
		text-align: center;
	}

	.tvl-wrapper {
		width: 100%;
	}

	/* Modal for Automation Script (Ported from §16i) */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(8px);
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.modal-content {
		background: #1e2430;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 14px;
		width: 100%;
		max-width: 850px;
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.5rem;
		background: #141c28;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.modal-header h3 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
		color: #f1f5f9;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: #94a3b8;
		font-size: 1.25rem;
		cursor: pointer;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
	}

	.close-btn:hover {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.1);
	}

	.modal-intro {
		padding: 0.75rem 1.5rem 0.25rem;
		font-size: 0.8rem;
		color: #94a3b8;
		margin: 0;
	}

	.modal-body {
		padding: 1rem 1.5rem 1.5rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.code-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.8rem;
		font-weight: 600;
		color: #cbd5e1;
	}

	.btn-modal-copy {
		background: rgba(56, 189, 248, 0.15);
		border: 1px solid rgba(56, 189, 248, 0.35);
		color: #38bdf8;
		padding: 0.25rem 0.6rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-modal-copy:hover {
		background: rgba(56, 189, 248, 0.28);
		color: #ffffff;
	}

	.code-block {
		background: #0f172a;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		padding: 0.85rem;
		font-family: monospace;
		font-size: 0.75rem;
		color: #e2e8f0;
		max-height: 240px;
		overflow-y: auto;
		white-space: pre;
	}
</style>
