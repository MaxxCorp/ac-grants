<script lang="ts">
	import type { GrantTransformationResult, JobCoachingData, JobCoachingBetreuungRow, JobCoachingBueroItem } from '#lib/types/grant';
	import { downloadFinanzierungsplanExcelFile } from '#lib/grants/finanzierungsplan-exporter';
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
	let copiedTimeout: any = null;

	const jc = $derived<JobCoachingData | undefined>(result.jobCoachingData);
	const betreuungRows = $derived<JobCoachingBetreuungRow[]>(jc ? jc.betreuungRows : []);
	const totalBetreuung = $derived<number>(jc ? jc.totalBetreuung : 0);
	const sachkosten = $derived(jc?.sachkosten);
	const activeYear = $derived(result.years[0] || 2027);

	// User-configurable Sachkosten overrides
	let userMiete = $state(1707.15);
	let userSonstigeSkOverride = $state<number | null>(null);

	function setCopied(id: string) {
		copiedField = id;
		if (copiedTimeout) clearTimeout(copiedTimeout);
		copiedTimeout = setTimeout(() => {
			copiedField = null;
		}, 2000);
	}

	async function copyToClipboard(text: string, id: string) {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(id);
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
			r.annualGross.toFixed(2),
			r.annualAga.toFixed(2),
			r.weeklyHours,
			r.vacationDays,
			r.workingHoursProject,
			r.totalAmount.toFixed(2),
			(r.yearlyAmounts[activeYear] || r.totalAmount).toFixed(2),
			r.controlSum.toFixed(2),
			r.description
		]);
		const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
		copyToClipboard(tsv, 'betreuung-tsv');
	}

	function copySachkostenTSV() {
		if (activeSachkostenTab === 'buero' && sachkosten) {
			const headers = ['Artikel', 'Anzahl', 'Einzelpreis (€)', 'Summe', String(activeYear), 'Kontrollsumme', 'Erläuterung'];
			const rows = sachkosten.bueroItems.map((item) => [
				item.name,
				item.quantity,
				item.unitPrice.toFixed(2),
				item.totalAmount.toFixed(2),
				(item.yearlyAmounts[activeYear] || item.totalAmount).toFixed(2),
				item.controlSum.toFixed(2),
				item.description
			]);
			const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
			copyToClipboard(tsv, 'sachkosten-tsv');
		} else if (activeSachkostenTab === 'quali' && sachkosten) {
			const tsv = ['Bezeichnung\tBetrag (€)\tSumme\t' + activeYear + '\tKontrollsumme\tErläuterung', `Qualifizierungsbudget\t${sachkosten.qualifizierungsBudgetTotal.toFixed(2)}\t${sachkosten.qualifizierungsBudgetTotal.toFixed(2)}\t${sachkosten.qualifizierungsBudgetTotal.toFixed(2)}\t${sachkosten.qualifizierungsBudgetTotal.toFixed(2)}\t${sachkosten.qualifizierungsText}`].join('\n');
			copyToClipboard(tsv, 'sachkosten-tsv');
		} else if (activeSachkostenTab === 'vwk' && sachkosten) {
			const tsv = ['Bezeichnung\tBetrag (€)\tAnteil (%)\tSumme\t' + activeYear + '\tKontrollsumme\tErläuterung', `Vwk-Pauschale\t${sachkosten.vwkAmount.toFixed(2)}\t100\t${sachkosten.vwkAmount.toFixed(2)}\t${sachkosten.vwkAmount.toFixed(2)}\t${sachkosten.vwkAmount.toFixed(2)}\t${sachkosten.vwkText}`].join('\n');
			copyToClipboard(tsv, 'sachkosten-tsv');
		}
	}

	function handleDownloadFinanzierungsplan() {
		downloadFinanzierungsplanExcelFile(result);
	}
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
				</div>
			</div>

			<!-- Window Info Subheader -->
			<div class="window-intro">
				Für diese Position stehen die folgenden Kalkulationshilfen zur Verfügung. Sie sehen jeweils die aktuell in Summe hinterlegten Beträge. Nutzen Sie zur Bearbeitung bitte den jeweiligen Tab-Reiter.
			</div>

			<!-- Top Summary Overview (Matching Screenshot 1) -->
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
							<td class="text-right font-mono highlight-sum">{formatCurrency(totalBetreuung)}</td>
							<td class="text-right font-mono highlight-sum">{formatCurrency(totalBetreuung)}</td>
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

			<!-- Internal Tab Bar (Screenshot 1: "Betreuung") -->
			<div class="window-tab-bar">
				<button type="button" class="subtab-btn active">Betreuung</button>
			</div>

			<!-- Main Table Content Area -->
			<div class="portal-table-container">
				<table class="portal-table">
					<thead>
						<tr>
							<th style="width: 32px;"></th>
							<th style="width: 30px;">#</th>
							<th>Qualifikation</th>
							<th>Einstufung analog Tarifvertrag</th>
							<th class="col-num">AN Brutto p.a. (€)</th>
							<th class="col-num">AG Sozialabg. p.a. (€)</th>
							<th class="col-center">Wochenarbeitszeit</th>
							<th class="col-center">Urlaubstage p.a.</th>
							<th class="col-num">zu leistende Std. Im Projekt</th>
							<th class="col-num">Summe</th>
							<th class="col-num">{activeYear}</th>
							<th class="col-num">Kontrollsumme</th>
						</tr>
					</thead>
					<tbody>
						{#each betreuungRows as row, idx}
							<tr class="data-row">
								<td class="col-action">
									<span class="delete-icon" title="Zeile">−</span>
								</td>
								<td class="col-idx">{idx + 1}</td>
								<td>
									<span class="pill-badge pill-role">{row.qualification}</span>
								</td>
								<td>
									<span class="pill-badge pill-tariff">{row.analogTariff}</span>
								</td>
								<td class="col-num font-mono">{formatCurrency(row.annualGross)}</td>
								<td class="col-num font-mono">{formatCurrency(row.annualAga)}</td>
								<td class="col-center font-mono">{row.weeklyHours}</td>
								<td class="col-center font-mono">{row.vacationDays}</td>
								<td class="col-num font-mono">{formatHours(row.workingHoursProject)}</td>
								<td class="col-num font-mono font-bold highlight-cell">{formatCurrency(row.totalAmount)}</td>
								<td class="col-num font-mono font-bold highlight-cell">{formatCurrency(row.yearlyAmounts[activeYear] || row.totalAmount)}</td>
								<td class="col-num font-mono font-bold">{formatCurrency(row.controlSum)}</td>
							</tr>
							<!-- Description row directly underneath, matching portal screenshot -->
							<tr class="desc-row">
								<td colspan="12">
									<div class="portal-desc-box">
										<span class="desc-text">{row.description}</span>
										<button
											type="button"
											class="copy-desc-btn"
											onclick={() => copyToClipboard(row.description, row.id)}
											title="Erläuterungstext kopieren"
										>
											{#if copiedField === row.id}
												✓ Kopiert
											{:else}
												Kopieren
											{/if}
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="total-row">
							<td class="col-action">
								<span class="plus-icon">+</span>
							</td>
							<td colspan="8" class="text-right font-bold">Summe Betreuung:</td>
							<td class="col-num font-mono font-bold text-accent">{formatCurrency(totalBetreuung)}</td>
							<td class="col-num font-mono font-bold text-accent">{formatCurrency(totalBetreuung)}</td>
							<td class="col-num font-mono font-bold text-accent">{formatCurrency(totalBetreuung)}</td>
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
				</div>
			</div>

			<div class="window-intro">
				Für diese Position stehen die folgenden Kalkulationshilfen zur Verfügung. Sie sehen jeweils die aktuell in Summe hinterlegten Beträge. Nutzen Sie zur Bearbeitung bitte den jeweiligen Tab-Reiter.
			</div>

			<!-- Top Summary Overview (Matching Screenshot 2, 3, 4) -->
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
							<td class="text-right font-mono">{formatCurrency(sachkosten?.bueroTotal || 0)}</td>
							<td class="text-right font-mono">{formatCurrency(sachkosten?.bueroTotal || 0)}</td>
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
							<td class="text-right font-mono">0,00 €</td>
							<td class="text-right font-mono">0,00 €</td>
							<td><span class="status-indicator text-muted">Keine Angaben</span></td>
						</tr>
						<tr class={activeSachkostenTab === 'quali' ? 'active-row' : ''} onclick={() => (activeSachkostenTab = 'quali')}>
							<td class="font-medium">Qualifizierungsbudget</td>
							<td class="text-right font-mono">{formatCurrency(sachkosten?.qualifizierungsBudgetTotal || 0)}</td>
							<td class="text-right font-mono">{formatCurrency(sachkosten?.qualifizierungsBudgetTotal || 0)}</td>
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
							<td class="text-right font-mono">{formatCurrency(sachkosten?.vwkAmount || 0)}</td>
							<td class="text-right font-mono">{formatCurrency(sachkosten?.vwkAmount || 0)}</td>
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
							<td class="text-right font-mono">0,00 €</td>
							<td class="text-right font-mono">0,00 €</td>
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

			<!-- Subtabs Bar (Screenshot 2, 3, 4) -->
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

			<!-- Subtab Content -->
			<div class="portal-table-container">
				{#if activeSachkostenTab === 'buero'}
					<!-- TAB: Büromaterial (Screenshot 4: 10 items) -->
					<table class="portal-table">
						<thead>
							<tr>
								<th style="width: 32px;"></th>
								<th style="width: 30px;">#</th>
								<th>Artikel</th>
								<th class="col-center">Anzahl</th>
								<th class="col-num">Einzelpreis (€)</th>
								<th class="col-num">Summe</th>
								<th class="col-num">{activeYear}</th>
								<th class="col-num">Kontrollsumme</th>
							</tr>
						</thead>
						<tbody>
							{#each (sachkosten?.bueroItems || []) as item, idx}
								<tr class="data-row">
									<td class="col-action"><span class="delete-icon">−</span></td>
									<td class="col-idx">{idx + 1}</td>
									<td class="font-medium">{item.name}</td>
									<td class="col-center font-mono">{item.quantity}</td>
									<td class="col-num font-mono">{formatCurrency(item.unitPrice)}</td>
									<td class="col-num font-mono font-bold highlight-cell">{formatCurrency(item.totalAmount)}</td>
									<td class="col-num font-mono font-bold highlight-cell">{formatCurrency(item.yearlyAmounts[activeYear] || item.totalAmount)}</td>
									<td class="col-num font-mono font-bold">{formatCurrency(item.controlSum)}</td>
								</tr>
								<tr class="desc-row">
									<td colspan="8">
										<div class="portal-desc-box">
											<span class="desc-text">{item.description}</span>
											<button
												type="button"
												class="copy-desc-btn"
												onclick={() => copyToClipboard(item.description, item.id)}
											>
												{#if copiedField === item.id}✓ Kopiert{:else}Kopieren{/if}
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="total-row">
								<td class="col-action"><span class="plus-icon">+</span></td>
								<td colspan="4" class="text-right font-bold">Summe Büromaterial:</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.bueroTotal || 0)}</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.bueroTotal || 0)}</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.bueroTotal || 0)}</td>
							</tr>
						</tfoot>
					</table>
				{:else if activeSachkostenTab === 'quali'}
					<!-- TAB: Qualifizierungsbudget (Screenshot 3) -->
					<table class="portal-table">
						<thead>
							<tr>
								<th style="width: 32px;"></th>
								<th style="width: 30px;">#</th>
								<th>Bezeichnung</th>
								<th class="col-num">Betrag (€)</th>
								<th class="col-num">Summe</th>
								<th class="col-num">{activeYear}</th>
								<th class="col-num">Kontrollsumme</th>
							</tr>
						</thead>
						<tbody>
							<tr class="data-row">
								<td class="col-action"><span class="delete-icon">−</span></td>
								<td class="col-idx">1</td>
								<td class="font-medium">Qualifizierungsbudget</td>
								<td class="col-num font-mono">{formatCurrency(sachkosten?.qualifizierungsBudgetTotal || 0)}</td>
								<td class="col-num font-mono font-bold highlight-cell">{formatCurrency(sachkosten?.qualifizierungsBudgetTotal || 0)}</td>
								<td class="col-num font-mono font-bold highlight-cell">{formatCurrency(sachkosten?.qualifizierungsBudgetTotal || 0)}</td>
								<td class="col-num font-mono font-bold">{formatCurrency(sachkosten?.qualifizierungsBudgetTotal || 0)}</td>
							</tr>
							<tr class="desc-row">
								<td colspan="7">
									<div class="portal-desc-box">
										<span class="desc-text">{sachkosten?.qualifizierungsText}</span>
										<button
											type="button"
											class="copy-desc-btn"
											onclick={() => copyToClipboard(sachkosten?.qualifizierungsText || '', 'desc-quali')}
										>
											{#if copiedField === 'desc-quali'}✓ Kopiert{:else}Kopieren{/if}
										</button>
									</div>
								</td>
							</tr>
						</tbody>
						<tfoot>
							<tr class="total-row">
								<td class="col-action"><span class="plus-icon">+</span></td>
								<td colspan="3" class="text-right font-bold">Summe Qualifizierungsbudget:</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.qualifizierungsBudgetTotal || 0)}</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.qualifizierungsBudgetTotal || 0)}</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.qualifizierungsBudgetTotal || 0)}</td>
							</tr>
						</tfoot>
					</table>
				{:else if activeSachkostenTab === 'vwk'}
					<!-- TAB: sonstige Verwaltungskosten (Screenshot 2) -->
					<table class="portal-table">
						<thead>
							<tr>
								<th style="width: 32px;"></th>
								<th style="width: 30px;">#</th>
								<th>Bezeichnung</th>
								<th class="col-num">Betrag (€)</th>
								<th class="col-center">Anteil (%)</th>
								<th class="col-num">Summe</th>
								<th class="col-num">{activeYear}</th>
								<th class="col-num">Kontrollsumme</th>
							</tr>
						</thead>
						<tbody>
							<tr class="data-row">
								<td class="col-action"><span class="delete-icon">−</span></td>
								<td class="col-idx">1</td>
								<td class="font-medium">Vwk-Pauschale</td>
								<td class="col-num font-mono">{formatCurrency(sachkosten?.vwkAmount || 0)}</td>
								<td class="col-center font-mono">100</td>
								<td class="col-num font-mono font-bold highlight-cell">{formatCurrency(sachkosten?.vwkAmount || 0)}</td>
								<td class="col-num font-mono font-bold highlight-cell">{formatCurrency(sachkosten?.vwkAmount || 0)}</td>
								<td class="col-num font-mono font-bold">{formatCurrency(sachkosten?.vwkAmount || 0)}</td>
							</tr>
							<tr class="desc-row">
								<td colspan="8">
									<div class="portal-desc-box">
										<span class="desc-text">{sachkosten?.vwkText}</span>
										<button
											type="button"
											class="copy-desc-btn"
											onclick={() => copyToClipboard(sachkosten?.vwkText || '', 'desc-vwk')}
										>
											{#if copiedField === 'desc-vwk'}✓ Kopiert{:else}Kopieren{/if}
										</button>
									</div>
								</td>
							</tr>
						</tbody>
						<tfoot>
							<tr class="total-row">
								<td class="col-action"><span class="plus-icon">+</span></td>
								<td colspan="4" class="text-right font-bold">Summe Verwaltungskosten:</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.vwkAmount || 0)}</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.vwkAmount || 0)}</td>
								<td class="col-num font-mono font-bold text-accent">{formatCurrency(sachkosten?.vwkAmount || 0)}</td>
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
								<input
									type="number"
									step="0.01"
									class="config-input"
									bind:value={userMiete}
									onchange={() => onUpdateOptions && onUpdateOptions({ mieteAmount: userMiete })}
								/>
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

	/* Window styles mimicking ZGS portal */
	.companion-window {
		background: #1e2430;
		border: 1px solid #334155;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
	}

	.window-titlebar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 1rem;
		background: #131822;
		border-bottom: 1px solid #2d3748;
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

	.traffic-lights .red {
		background-color: #ef4444;
	}
	.traffic-lights .yellow {
		background-color: #f59e0b;
	}
	.traffic-lights .green {
		background-color: #10b981;
	}

	.window-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: #e2e8f0;
		letter-spacing: 0.02em;
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
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn:hover {
		background: rgba(255, 255, 255, 0.12);
		color: #ffffff;
	}

	.window-intro {
		padding: 0.6rem 1rem;
		font-size: 0.75rem;
		color: #94a3b8;
		background: rgba(15, 23, 42, 0.4);
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	/* Summary Overview */
	.summary-overview {
		padding: 0.75rem 1rem;
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
		padding: 0.25rem 0.5rem;
		text-align: left;
	}

	.overview-table td {
		padding: 0.3rem 0.5rem;
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

	.window-tab-bar {
		display: flex;
		gap: 4px;
		padding: 0.4rem 1rem 0;
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

	/* Portal Table */
	.portal-table-container {
		padding: 1rem;
		overflow-x: auto;
	}

	.portal-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 0.78rem;
	}

	.portal-table th {
		background: #141c28;
		color: #94a3b8;
		font-weight: 600;
		text-align: left;
		padding: 0.55rem 0.65rem;
		border-top: 1px solid #2d3748;
		border-bottom: 1px solid #2d3748;
		white-space: nowrap;
	}

	.portal-table td {
		padding: 0.5rem 0.65rem;
		color: #e2e8f0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	.col-num {
		text-align: right;
	}

	.col-center {
		text-align: center;
	}

	.col-action {
		width: 32px;
		text-align: center;
	}

	.delete-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #ef4444;
		color: #ffffff;
		font-weight: bold;
		font-size: 12px;
		line-height: 1;
		cursor: pointer;
	}

	.plus-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #10b981;
		color: #ffffff;
		font-weight: bold;
		font-size: 12px;
		line-height: 1;
	}

	.col-idx {
		color: #64748b;
		font-weight: 500;
	}

	.pill-badge {
		display: inline-block;
		padding: 0.2rem 0.45rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.pill-role {
		background: rgba(56, 189, 248, 0.15);
		color: #38bdf8;
		border: 1px solid rgba(56, 189, 248, 0.25);
	}

	.pill-tariff {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
		border: 1px solid rgba(168, 85, 247, 0.25);
	}

	.highlight-cell {
		background: rgba(56, 189, 248, 0.05);
		color: #38bdf8;
	}

	.desc-row td {
		padding: 0.25rem 0.65rem 0.75rem;
		border-bottom: 1px solid #2d3748;
	}

	.portal-desc-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 4px;
		padding: 0.4rem 0.75rem;
		font-family: monospace;
		font-size: 0.72rem;
		color: #94a3b8;
	}

	.copy-desc-btn {
		background: rgba(255, 255, 255, 0.08);
		color: #cbd5e1;
		border: none;
		border-radius: 4px;
		padding: 0.15rem 0.45rem;
		font-size: 0.68rem;
		cursor: pointer;
		margin-left: 0.5rem;
	}

	.copy-desc-btn:hover {
		background: rgba(255, 255, 255, 0.16);
		color: #ffffff;
	}

	.total-row td {
		padding: 0.75rem 0.65rem;
		background: #141c28;
		border-top: 2px solid #334155;
		border-bottom: none;
	}

	.text-accent {
		color: #38bdf8;
	}

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
</style>
