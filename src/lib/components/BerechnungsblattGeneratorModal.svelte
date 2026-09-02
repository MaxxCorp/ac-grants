<script lang="ts">
	import { generateBerechnungsblatt } from '#lib/grant.remote';
	import { calculateMilestones } from '#lib/grants/generator-milestones';
	import type {
		GrantTransformationResult,
		TariffReclassification,
		BgRatePeriod,
		AgaRatePeriod
	} from '#lib/types/grant';

	let {
		isOpen = $bindable(false),
		onClose,
		onResult,
		onAppendParticipant = undefined,
		hasExistingProject = false,
		selectedScheme = 'sgb16i-berlin'
	}: {
		isOpen: boolean;
		onClose: () => void;
		onResult: (res: GrantTransformationResult, fileName?: string) => void;
		onAppendParticipant?: (res: GrantTransformationResult) => void;
		hasExistingProject?: boolean;
		selectedScheme?: string;
	} = $props();

	let projectAction = $state<'append' | 'replace'>('append');

	// Default start date: First day of next month relative to current date
	function getDefaultStartDate(): string {
		const now = new Date();
		let y = now.getFullYear();
		let m = now.getMonth() + 2; // +1 for 1-based, +1 for next month
		if (m > 12) {
			y += 1;
			m = 1;
		}
		return `${y}-${String(m).padStart(2, '0')}-01`;
	}

	// Form State
	let employeeName = $state('Frau Maria Musterfrau');
	let startDate = $state(getDefaultStartDate());
	let durationMonths = $state(60);
	let tariffGroup = $state('EG2');
	let tariffStep = $state('ES1');
	let healthInsuranceName = $state('Barmer');
	let jobcenterId = $state('');
	let zgsId = $state('');

	// Reclassifications (Umgruppierungen & Stufenanpassungen)
	let reclassifications = $state<TariffReclassification[]>([]);

	function addReclassification() {
		let defaultEffDate = '2028-01-01';
		if (startDate) {
			const parts = startDate.split('-');
			if (parts.length === 3) {
				defaultEffDate = `${parseInt(parts[0], 10) + 1}-${parts[1]}-${parts[2]}`;
			}
		}
		reclassifications = [
			...reclassifications,
			{
				id: `reclass-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
				effectiveDate: defaultEffDate,
				tariffGroup,
				tariffStep: 'ES2',
				note: 'Umgruppierung / Stufenanpassung'
			}
		];
	}

	function removeReclassification(id: string) {
		reclassifications = reclassifications.filter(r => r.id !== id);
	}

	// Berufsgenossenschaft (Gesetzliche Unfallversicherung)
	let bgRate = $state(1.80); // in percent (e.g. 1.80%)
	let showBgTimeline = $state(false);
	let bgTimeline = $state<BgRatePeriod[]>([]);

	const PRESET_BG_RATES = [
		{ label: 'BGW Standard', rate: 1.80, note: 'Wohlfahrtspflege & Gesundheit' },
		{ label: 'BGW Erhöht', rate: 2.00, note: 'Gefahrtarif mit Risikozuschlag' },
		{ label: 'VBG', rate: 1.50, note: 'Verwaltungs-Berufsgenossenschaft' }
	];

	function addBgPeriod() {
		let nextStart = '2028-01-01';
		let nextEnd = '2031-09-30';
		if (bgTimeline.length > 0) {
			nextStart = bgTimeline[bgTimeline.length - 1].endDate;
		}
		bgTimeline = [
			...bgTimeline,
			{
				id: `bg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
				startDate: nextStart,
				endDate: nextEnd,
				rate: bgRate / 100,
				label: `Anpassung BG ab ${nextStart.slice(0, 4)}`
			}
		];
	}

	function removeBgPeriod(id: string) {
		bgTimeline = bgTimeline.filter(p => p.id !== id);
	}

	// Krankenkassen-Zeitverlauf (AGA)
	let showAgaTimeline = $state(false);
	let customAgaTimeline = $state<AgaRatePeriod[]>([]);

	function addAgaPeriod() {
		let nextStart = '2028-01-01';
		let nextEnd = '2031-09-30';
		if (customAgaTimeline.length > 0) {
			nextStart = customAgaTimeline[customAgaTimeline.length - 1].endDate;
		}
		const selFund = AVAILABLE_INSURANCES.find(i => i.name === healthInsuranceName);
		const defaultAga = selFund ? parseFloat(selFund.rate.replace(',', '.')) / 100 : 0.23815;
		customAgaTimeline = [
			...customAgaTimeline,
			{
				id: `aga-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
				startDate: nextStart,
				endDate: nextEnd,
				rate: defaultAga,
				label: `Anpassung AGA ab ${nextStart.slice(0, 4)}`
			}
		];
	}

	function removeAgaPeriod(id: string) {
		customAgaTimeline = customAgaTimeline.filter(p => p.id !== id);
	}

	// Advanced customizations
	let showAdvanced = $state(false);
	let weeklyHours = $state(30);
	let fullTimeHours = $state(39);
	let sachkostenMonthly = $state(155);
	let childrenCount = $state(0);
	let jszPercentage = $state(85);

	let isGenerating = $state(false);
	let errorMessage = $state<string | null>(null);

	const AVAILABLE_GROUPS = [
		'EG1', 'EG2', 'EG3', 'EG4', 'EG5', 'EG6', 'EG7', 'EG8', 'EG9',
		'EG10', 'EG11', 'EG12', 'EG13', 'EG14', 'EG15',
		'S02', 'S03', 'S04', 'S07', 'S08a', 'S08b', 'S09', 'S11a', 'S11b', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18'
	];

	const AVAILABLE_STEPS = ['ES1', 'ES2', 'ES3', 'ES4', 'ES5', 'ES6'];

	const AVAILABLE_INSURANCES = [
		{ name: 'Barmer', rate: '23,815%', note: 'Online geprüft & aktuell 2026' },
		{ name: 'Techniker', rate: '22,935%', note: 'Günstigster Zusatzbeitrag' },
		{ name: 'AOK BLN-BRB', rate: '23,870%', note: 'Berlin/Brandenburg' },
		{ name: 'DAK', rate: '23,140%', note: 'Bundesweit' },
		{ name: 'mkk', rate: '24,480%', note: 'meine krankenkasse (ehem. BKK VBU)' },
		{ name: 'BIG direkt', rate: '25,285%', note: 'Direktversicherung' },
		{ name: 'BKK VBU', rate: '24,480%', note: 'Betriebskrankenkasse' },
		{ name: 'IKK BLN-BRB', rate: '25,415%', note: 'Innungskrankenkasse' },
		{ name: 'KKH', rate: '23,980%', note: 'Kaufmännische Krankenkasse' },
		{ name: 'Bahn-BKK', rate: '25,295%', note: 'Verkehr & Logistik' }
	];

	// Live derived milestones
	let liveMilestones = $derived.by(() => {
		try {
			return calculateMilestones({
				employeeName,
				startDate,
				durationMonths,
				tariffGroup,
				tariffStep,
				weeklyHours,
				fullTimeHours,
				reclassifications
			});
		} catch {
			return [];
		}
	});

	function downloadBase64(base64: string, fileName: string) {
		const byteCharacters = atob(base64);
		const byteNumbers = new Array(byteCharacters.length);
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}
		const byteArray = new Uint8Array(byteNumbers);
		const blob = new Blob([byteArray], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		setTimeout(() => URL.revokeObjectURL(url), 3000);
	}

	async function handleGenerate(loadDirectly: boolean) {
		if (!employeeName.trim()) {
			errorMessage = 'Bitte geben Sie einen Namen für die/den Mitarbeiter/in ein.';
			return;
		}

		try {
			isGenerating = true;
			errorMessage = null;

			const response = await generateBerechnungsblatt({
				employeeName,
				startDate,
				durationMonths,
				tariffGroup,
				tariffStep,
				healthInsuranceName,
				jobcenterId: jobcenterId.trim() || undefined,
				zgsId: zgsId.trim() || undefined,
				weeklyHours,
				fullTimeHours,
				sachkostenMonthly,
				childrenCount,
				jszPercentage,
				schemeId: selectedScheme,
				includeOffsetRows: true,
				reclassifications: reclassifications.length > 0 ? reclassifications : undefined,
				bgRate: bgRate / 100,
				customBgTimeline: bgTimeline.length > 0 ? bgTimeline : undefined,
				customAgaTimeline: customAgaTimeline.length > 0 ? customAgaTimeline : undefined
			});

			// Download file
			downloadBase64(response.fileBase64, response.fileName);

			if (loadDirectly) {
				if (hasExistingProject && projectAction === 'append' && onAppendParticipant) {
					onAppendParticipant(response.result);
				} else {
					onResult(response.result, response.fileName);
				}
				isOpen = false;
			}
		} catch (err: any) {
			errorMessage = err?.message || 'Fehler beim Generieren des Berechnungsblatts.';
		} finally {
			isGenerating = false;
		}
	}
</script>

{#if isOpen}
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-labelledby="generator-title"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
	>
		<div class="modal-card">
			<!-- Header -->
			<div class="modal-header">
				<div class="header-title-group">
					<div class="icon-circle">
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
							<polyline points="14 2 14 8 20 8"></polyline>
							<line x1="12" y1="18" x2="12" y2="12"></line>
							<line x1="9" y1="15" x2="15" y2="15"></line>
						</svg>
					</div>
					<div>
						<h2 id="generator-title">Berechnungsblatt-Generator für neue Mitarbeiter</h2>
						<p class="subtitle">Erstellt ein formel- und stufengenaues 5-Jahres-Berechnungsblatt (.xlsx) inklusive Tarifstufen, Jahressonderzahlungen und ZGS-Kofinanzierung.</p>
					</div>
				</div>
				<button type="button" class="btn-close" onclick={onClose} aria-label="Schließen">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<!-- Body Form -->
			<div class="modal-body">
				{#if errorMessage}
					<div class="error-banner">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10"></circle>
							<line x1="12" y1="8" x2="12" y2="12"></line>
							<line x1="12" y1="16" x2="12.01" y2="16"></line>
						</svg>
						<span>{errorMessage}</span>
					</div>
				{/if}

				{#if hasExistingProject}
					<div class="project-action-box">
						<span class="action-box-title">Integration in das aktuelle Projekt:</span>
						<div class="action-box-radios">
							<label class="action-radio-label {projectAction === 'append' ? 'active' : ''}">
								<input type="radio" name="projAction" value="append" bind:group={projectAction} />
								<div class="radio-content">
									<strong>👥 Zum bestehenden Projekt hinzufügen</strong>
									<span>Erstellt ein Mehr-Teilnehmer-Projekt mit kombinierter Kalkulationshilfe & TV-L Vergleich</span>
								</div>
							</label>
							<label class="action-radio-label {projectAction === 'replace' ? 'active' : ''}">
								<input type="radio" name="projAction" value="replace" bind:group={projectAction} />
								<div class="radio-content">
									<strong>🔄 Als neues Einzelprojekt laden</strong>
									<span>Ersetzt die bisherigen Daten vollständig durch diesen neuen Teilnehmer</span>
								</div>
							</label>
						</div>
					</div>
				{/if}

				<!-- Standard Inputs (Minimal by default) -->
				<div class="form-grid">
					<!-- Name -->
					<div class="form-group col-span-2">
						<label for="employeeName">Name der/des Mitarbeiter/in <span class="required">*</span></label>
						<input
							type="text"
							id="employeeName"
							bind:value={employeeName}
							placeholder="z. B. Frau Maria Musterfrau"
							class="form-input"
							required
						/>
					</div>

					<!-- Start Date -->
					<div class="form-group">
						<label for="startDate">Startdatum (Beginn der Beschäftigung) <span class="required">*</span></label>
						<input
							type="date"
							id="startDate"
							bind:value={startDate}
							class="form-input"
						/>
						<span class="field-hint">Standard: 1. des nächsten Monats</span>
					</div>

					<!-- Duration -->
					<div class="form-group">
						<label for="durationMonths">Laufzeit</label>
						<div class="pill-selector">
							{#each [12, 24, 36, 48, 60] as months}
								<button
									type="button"
									class="pill-btn {durationMonths === months ? 'active' : ''}"
									onclick={() => (durationMonths = months)}
								>
									{months / 12} {months === 12 ? 'Jahr' : 'Jahre'} ({months} M.)
								</button>
							{/each}
						</div>
					</div>

					<!-- Tariff Group & Step -->
					<div class="form-group">
						<label for="tariffGroup">Entgeltgruppe (AWO Berlin)</label>
						<select id="tariffGroup" bind:value={tariffGroup} class="form-select">
							{#each AVAILABLE_GROUPS as grp}
								<option value={grp}>{grp}</option>
							{/each}
						</select>
					</div>

					<div class="form-group">
						<label for="tariffStep">Start-Erfahrungsstufe</label>
						<select id="tariffStep" bind:value={tariffStep} class="form-select">
							{#each AVAILABLE_STEPS as stp}
								<option value={stp}>{stp} {stp === 'ES1' ? '(Standard Neueinstellung)' : ''}</option>
							{/each}
						</select>
					</div>

					<!-- Krankenkasse -->
					<div class="form-group col-span-2">
						<div class="label-row">
							<label for="healthInsurance">Gesetzliche Krankenkasse (AGA-Beitragssatz)</label>
							<span class="verified-badge">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3">
									<polyline points="20 6 9 17 4 12"></polyline>
								</svg>
								Barmer 2026 Daten verifiziert (AGA 23,815%)
							</span>
						</div>
						<select id="healthInsurance" bind:value={healthInsuranceName} class="form-select">
							{#each AVAILABLE_INSURANCES as ins}
								<option value={ins.name}>
									{ins.name} — AG-Anteil {ins.rate} ({ins.note})
								</option>
							{/each}
						</select>

						<div class="timeline-toggle-row">
							<button
								type="button"
								class="timeline-pill-btn {showAgaTimeline || customAgaTimeline.length > 0 ? 'active' : ''}"
								onclick={() => (showAgaTimeline = !showAgaTimeline)}
							>
								📅 Krankenkassen-Beitragssatz im Zeitverlauf anpassen {customAgaTimeline.length > 0 ? `(${customAgaTimeline.length} Intervalle)` : ''}
							</button>
						</div>

						{#if showAgaTimeline}
							<div class="nested-timeline-box">
								<div class="nested-timeline-header">
									<span>📅 Krankenkassen-Beitragssatz im Zeitverlauf</span>
									<button type="button" class="btn-sub-action" onclick={addAgaPeriod}>
										+ Zeitraum hinzufügen
									</button>
								</div>
								{#if customAgaTimeline.length === 0}
									<p class="empty-timeline-hint">Standardmäßig gilt der Beitragssatz der gewählten Krankenkasse über die gesamte Laufzeit. Fügen Sie Zeiträume hinzu, falls sich der Krankenkassen- oder Zusatzbeitragssatz ändert.</p>
								{:else}
									<div class="timeline-rows-list">
										{#each customAgaTimeline as period, idx (period.id)}
											<div class="timeline-row-card">
												<span class="period-num">#{idx + 1}</span>
												<div class="sub-field">
													<label for="aga-start-{period.id}">Von</label>
													<input id="aga-start-{period.id}" type="date" bind:value={period.startDate} class="form-input-sm" />
												</div>
												<div class="sub-field">
													<label for="aga-end-{period.id}">Bis</label>
													<input id="aga-end-{period.id}" type="date" bind:value={period.endDate} class="form-input-sm" />
												</div>
												<div class="sub-field">
													<label for="aga-rate-{period.id}">AGA-Satz (%)</label>
													<input
														id="aga-rate-{period.id}"
														type="number"
														step="0.001"
														value={Number((period.rate * 100).toFixed(3))}
														oninput={(e) => (period.rate = parseFloat(e.currentTarget.value) / 100 || 0)}
														class="form-input-sm"
													/>
												</div>
												<div class="sub-field flex-grow">
													<label for="aga-label-{period.id}">Bezeichnung</label>
													<input id="aga-label-{period.id}" type="text" bind:value={period.label} placeholder="z. B. Anpassung 2028" class="form-input-sm" />
												</div>
												<button type="button" class="btn-icon-delete" onclick={() => removeAgaPeriod(period.id)} aria-label="Entfernen">
													✕
												</button>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Berufsgenossenschaft (Gesetzliche Unfallversicherung) -->
					<div class="form-group col-span-2">
						<div class="label-row">
							<label for="bgRate">Berufsgenossenschaft (Gesetzliche Unfallversicherung)</label>
							<div class="preset-chips">
								{#each PRESET_BG_RATES as preset}
									<button
										type="button"
										class="chip-btn {bgRate === preset.rate ? 'active' : ''}"
										onclick={() => (bgRate = preset.rate)}
									>
										{preset.label} ({preset.rate.toFixed(2).replace('.', ',')}%)
									</button>
								{/each}
							</div>
						</div>
						<div class="input-with-toggle">
							<div class="input-with-unit">
								<input
									type="number"
									id="bgRate"
									bind:value={bgRate}
									min="0"
									max="15"
									step="0.05"
									class="form-input"
								/>
								<span class="unit">% Beitragssatz</span>
							</div>
							<button
								type="button"
								class="timeline-pill-btn {showBgTimeline || bgTimeline.length > 0 ? 'active' : ''}"
								onclick={() => (showBgTimeline = !showBgTimeline)}
							>
								📅 Zeitverlauf {bgTimeline.length > 0 ? `(${bgTimeline.length} Intervalle)` : ''}
							</button>
						</div>
						<span class="field-hint">Wird als eigene Spalte "BG-Kosten" und "Gesamtkosten inkl. BG" berechnet (Standard BGW: 1,80%).</span>

						{#if showBgTimeline}
							<div class="nested-timeline-box">
								<div class="nested-timeline-header">
									<span>📅 Berufsgenossenschafts-Beitragssatz im Zeitverlauf</span>
									<button type="button" class="btn-sub-action" onclick={addBgPeriod}>
										+ Zeitraum hinzufügen
									</button>
								</div>
								{#if bgTimeline.length === 0}
									<p class="empty-timeline-hint">Standardmäßig gilt der oben angegebene Beitragssatz ({bgRate.toFixed(2).replace('.', ',')}%) über die gesamte 5-jährige Laufzeit. Fügen Sie Zeiträume hinzu, falls sich der BG-Gefahrtarif oder Beitragsfuß ändert.</p>
								{:else}
									<div class="timeline-rows-list">
										{#each bgTimeline as period, idx (period.id)}
											<div class="timeline-row-card">
												<span class="period-num">#{idx + 1}</span>
												<div class="sub-field">
													<label for="bg-start-{period.id}">Von</label>
													<input id="bg-start-{period.id}" type="date" bind:value={period.startDate} class="form-input-sm" />
												</div>
												<div class="sub-field">
													<label for="bg-end-{period.id}">Bis</label>
													<input id="bg-end-{period.id}" type="date" bind:value={period.endDate} class="form-input-sm" />
												</div>
												<div class="sub-field">
													<label for="bg-rate-{period.id}">BG-Satz (%)</label>
													<input
														id="bg-rate-{period.id}"
														type="number"
														step="0.05"
														value={Number((period.rate * 100).toFixed(3))}
														oninput={(e) => (period.rate = parseFloat(e.currentTarget.value) / 100 || 0)}
														class="form-input-sm"
													/>
												</div>
												<div class="sub-field flex-grow">
													<label for="bg-label-{period.id}">Bezeichnung</label>
													<input id="bg-label-{period.id}" type="text" bind:value={period.label} placeholder="z. B. Anpassung BGW 2028" class="form-input-sm" />
												</div>
												<button type="button" class="btn-icon-delete" onclick={() => removeBgPeriod(period.id)} aria-label="Entfernen">
													✕
												</button>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- JobCenter & ZGS Tracking IDs -->
					<div class="form-group">
						<label for="jobcenterId">JobCenter-ID / BG-Nummer <span class="optional">(optional)</span></label>
						<input
							type="text"
							id="jobcenterId"
							bind:value={jobcenterId}
							placeholder="z. B. BG-12345/67"
							class="form-input"
						/>
					</div>

					<div class="form-group">
						<label for="zgsId">ZGS-ID / Projektnummer <span class="optional">(optional)</span></label>
						<input
							type="text"
							id="zgsId"
							bind:value={zgsId}
							placeholder="z. B. ZGS-2026-042"
							class="form-input"
						/>
					</div>
				</div>

				<!-- Reclassifications (Umgruppierungen & Stufenanpassungen) Section -->
				<div class="reclass-section">
					<div class="reclass-header">
						<div class="reclass-title-group">
							<span class="reclass-icon">🔄</span>
							<div>
								<h4>Beliebige Umgruppierungen & Stufenanpassungen ({reclassifications.length})</h4>
								<p class="reclass-desc">Legen Sie fest, ob die/der Mitarbeiter/in zu beliebigen Terminen in eine andere Entgeltgruppe (EG) oder Erfahrungsstufe (ES) wechselt.</p>
							</div>
						</div>
						<button type="button" class="btn-add-reclass" onclick={addReclassification}>
							+ Umgruppierung hinzufügen
						</button>
					</div>

					{#if reclassifications.length === 0}
						<div class="reclass-empty-hint">
							Keine manuellen Umgruppierungen hinterlegt. Reguläre Stufenaufstiege (nach 1 bzw. 2 Jahren) und Tariferhöhungen der AWO Berlin werden automatisch berechnet.
						</div>
					{:else}
						<div class="reclass-list">
							{#each reclassifications as rec, idx (rec.id)}
								<div class="reclass-card">
									<div class="reclass-card-header">
										<span class="reclass-badge">Umgruppierungs-Ereignis #{idx + 1}</span>
										<button type="button" class="btn-icon-delete" onclick={() => removeReclassification(rec.id)} aria-label="Entfernen">
											✕
										</button>
									</div>
									<div class="reclass-grid">
										<div class="sub-field">
											<label for="rec-date-{rec.id}">Wirksam ab Datum <span class="required">*</span></label>
											<input id="rec-date-{rec.id}" type="date" bind:value={rec.effectiveDate} class="form-input" required />
										</div>
										<div class="sub-field">
											<label for="rec-eg-{rec.id}">Neue Entgeltgruppe (EG)</label>
											<select id="rec-eg-{rec.id}" bind:value={rec.tariffGroup} class="form-select">
												<option value="">(Unverändert belassen)</option>
												{#each AVAILABLE_GROUPS as grp}
													<option value={grp}>{grp}</option>
												{/each}
											</select>
										</div>
										<div class="sub-field">
											<label for="rec-es-{rec.id}">Neue Erfahrungsstufe (ES)</label>
											<select id="rec-es-{rec.id}" bind:value={rec.tariffStep} class="form-select">
												<option value="">(Unverändert belassen)</option>
												{#each AVAILABLE_STEPS as stp}
													<option value={stp}>{stp}</option>
												{/each}
											</select>
										</div>
										<div class="sub-field flex-grow">
											<label for="rec-note-{rec.id}">Bezeichnung / Grund <span class="optional">(optional)</span></label>
											<input id="rec-note-{rec.id}" type="text" bind:value={rec.note} placeholder="z. B. Höhergruppierung nach Tätigkeitswechsel" class="form-input" />
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Collapsible Advanced Settings -->
				<div class="advanced-section">
					<button
						type="button"
						class="toggle-advanced-btn"
						onclick={() => (showAdvanced = !showAdvanced)}
					>
						<span>⚙️ Weitere Einstellungen (Wochenstunden, Sachkosten, Sonderzahlung)</span>
						<svg
							class="chevron {showAdvanced ? 'rotated' : ''}"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<polyline points="6 9 12 15 18 9"></polyline>
						</svg>
					</button>

					{#if showAdvanced}
						<div class="advanced-body">
							<div class="form-grid">
								<div class="form-group">
									<label for="weeklyHours">Wöchentliche Arbeitszeit</label>
									<div class="input-with-unit">
										<input
											type="number"
											id="weeklyHours"
											bind:value={weeklyHours}
											min="10"
											max="40"
											step="0.5"
											class="form-input"
										/>
										<span class="unit">Std./Woche</span>
									</div>
									<span class="field-hint">Standard § 16i: 30 Stunden (Vollzeit: 39 Std.)</span>
								</div>

								<div class="form-group">
									<label for="sachkostenMonthly">Sachkostenpauschale Land</label>
									<div class="input-with-unit">
										<input
											type="number"
											id="sachkostenMonthly"
											bind:value={sachkostenMonthly}
											min="0"
											step="5"
											class="form-input"
										/>
										<span class="unit">€ / Monat</span>
									</div>
									<span class="field-hint">Standard: 155,00 € pro Fördermonat</span>
								</div>

								<div class="form-group">
									<label for="childrenCount">Kinderfreibeträge / Kinder</label>
									<input
										type="number"
										id="childrenCount"
										bind:value={childrenCount}
										min="0"
										max="10"
										class="form-input"
									/>
									<span class="field-hint">0 = kinderlos (mit PV-Zuschlag auf AN-Seite)</span>
								</div>

								<div class="form-group">
									<label for="jszPercentage">Jahressonderzahlung (JSZ)</label>
									<div class="input-with-unit">
										<input
											type="number"
											id="jszPercentage"
											bind:value={jszPercentage}
											min="0"
											max="100"
											class="form-input"
										/>
										<span class="unit">%</span>
									</div>
									<span class="field-hint">Standard: 85% des September-Entgelts</span>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Live Milestone & Progression Preview -->
				<div class="preview-section">
					<h3>
						<span>🗓️ Automatische Meilensteine & Farbcodierung</span>
						<span class="badge-count">{liveMilestones.length} Ereignisse</span>
					</h3>
					<div class="legend-row">
						<span class="legend-item"><span class="color-dot green"></span> Stufenaufstieg (Grün)</span>
						<span class="legend-item"><span class="color-dot yellow"></span> Tariferhöhung (Gelb)</span>
						<span class="legend-item"><span class="color-dot purple"></span> Umgruppierung (Lila)</span>
						<span class="legend-item"><span class="color-dot red"></span> Geplanter Austritt (Rot)</span>
					</div>

					<div class="milestone-list">
						{#each liveMilestones as m}
							<div class="milestone-item border-{m.type}">
								<div class="milestone-badge badge-{m.type}">
									{#if m.type === 'umgruppierung'}
										🔄 {m.newGroup || m.newStep || 'Umgruppierung'}
									{:else if m.type === 'stufenaufstieg'}
										🌱 {m.newStep}
									{:else if m.type === 'tariferhoehung'}
										📈 Tarif
									{:else}
										🏁 Ende
									{/if}
								</div>
								<div class="milestone-details">
									<div class="milestone-title">
										<strong>{m.label}</strong>
									</div>
									<div class="milestone-sub">
										Stichtag: {m.dateStr}
										{#if m.oldSalary && m.newSalary}
											• FTE-Gehalt: {m.oldSalary.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} → {m.newSalary.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Footer Actions -->
			<div class="modal-footer">
				<button type="button" class="btn btn-secondary" onclick={onClose} disabled={isGenerating}>
					Abbrechen
				</button>

				<button
					type="button"
					class="btn btn-download-only"
					onclick={() => handleGenerate(false)}
					disabled={isGenerating}
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
						<polyline points="7 10 12 15 17 10"></polyline>
						<line x1="12" y1="15" x2="12" y2="3"></line>
					</svg>
					Nur .xlsx herunterladen
				</button>

				<button
					type="button"
					class="btn btn-primary btn-generate"
					onclick={() => handleGenerate(true)}
					disabled={isGenerating}
				>
					{#if isGenerating}
						<svg class="spinner" viewBox="0 0 50 50">
							<circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
						</svg>
						Generiere Berechnungsblatt...
					{:else}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
						</svg>
						Generieren & Direkt laden
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.75);
		backdrop-filter: blur(8px);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		overflow-y: auto;
	}

	.modal-card {
		background: #1e293b;
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: 20px;
		width: 100%;
		max-width: 820px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.2);
		overflow: hidden;
		animation: modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes modalPop {
		0% {
			opacity: 0;
			transform: scale(0.96) translateY(10px);
		}
		100% {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.modal-header {
		padding: 1.5rem 1.75rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		background: rgba(15, 23, 42, 0.4);
	}

	.header-title-group {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.icon-circle {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: rgba(99, 102, 241, 0.15);
		border: 1px solid rgba(99, 102, 241, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #818cf8;
		flex-shrink: 0;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.3rem;
		font-weight: 700;
		color: #f8fafc;
	}

	.subtitle {
		margin: 0.25rem 0 0 0;
		font-size: 0.85rem;
		color: #94a3b8;
		line-height: 1.4;
	}

	.btn-close {
		background: transparent;
		border: none;
		color: #94a3b8;
		cursor: pointer;
		padding: 0.4rem;
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.btn-close:hover {
		background: rgba(255, 255, 255, 0.08);
		color: #f8fafc;
	}

	.modal-body {
		padding: 1.5rem 1.75rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.error-banner {
		padding: 0.75rem 1rem;
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.35);
		border-radius: 10px;
		color: #fca5a5;
		font-size: 0.875rem;
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.col-span-2 {
		grid-column: span 2;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.label-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #cbd5e1;
	}

	.required {
		color: #f43f5e;
	}

	.optional {
		font-weight: 400;
		color: #64748b;
		font-size: 0.8rem;
	}

	.verified-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.3);
		color: #34d399;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.form-input,
	.form-select {
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		padding: 0.65rem 0.85rem;
		color: #f8fafc;
		font-size: 0.925rem;
		transition: all 0.2s ease;
	}

	.form-input:focus,
	.form-select:focus {
		outline: none;
		border-color: #6366f1;
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
	}

	.input-with-unit {
		position: relative;
		display: flex;
		align-items: center;
	}

	.input-with-unit .form-input {
		width: 100%;
		padding-right: 5rem;
	}

	.input-with-unit .unit {
		position: absolute;
		right: 0.85rem;
		color: #94a3b8;
		font-size: 0.85rem;
		pointer-events: none;
	}

	.field-hint {
		font-size: 0.775rem;
		color: #64748b;
	}

	.pill-selector {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.pill-btn {
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 0.45rem 0.65rem;
		font-size: 0.8rem;
		color: #94a3b8;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.pill-btn:hover {
		color: #f8fafc;
		background: rgba(255, 255, 255, 0.06);
	}

	.pill-btn.active {
		background: rgba(99, 102, 241, 0.25);
		border-color: #6366f1;
		color: #c7d2fe;
		font-weight: 600;
	}

	.preset-chips {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.chip-btn {
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		padding: 0.2rem 0.5rem;
		font-size: 0.75rem;
		color: #94a3b8;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.chip-btn:hover {
		color: #f8fafc;
		border-color: rgba(255, 255, 255, 0.2);
	}

	.chip-btn.active {
		background: rgba(99, 102, 241, 0.25);
		border-color: #6366f1;
		color: #c7d2fe;
		font-weight: 600;
	}

	.input-with-toggle {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.timeline-toggle-row {
		margin-top: 0.35rem;
	}

	.timeline-pill-btn {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		padding: 0.45rem 0.85rem;
		font-size: 0.8rem;
		color: #94a3b8;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.timeline-pill-btn:hover {
		color: #f8fafc;
		border-color: #6366f1;
		background: rgba(99, 102, 241, 0.1);
	}

	.timeline-pill-btn.active {
		background: rgba(99, 102, 241, 0.2);
		border-color: #818cf8;
		color: #c7d2fe;
		font-weight: 600;
	}

	/* Nested Timeline Editor Box */
	.nested-timeline-box {
		margin-top: 0.5rem;
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(99, 102, 241, 0.25);
		border-radius: 10px;
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.nested-timeline-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.825rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.btn-sub-action {
		background: rgba(99, 102, 241, 0.2);
		border: 1px solid rgba(99, 102, 241, 0.4);
		color: #c7d2fe;
		border-radius: 6px;
		padding: 0.25rem 0.6rem;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-sub-action:hover {
		background: rgba(99, 102, 241, 0.35);
		color: #ffffff;
	}

	.empty-timeline-hint {
		font-size: 0.775rem;
		color: #94a3b8;
		margin: 0;
		line-height: 1.4;
	}

	.timeline-rows-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.timeline-row-card {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
	}

	.period-num {
		font-size: 0.75rem;
		font-weight: 700;
		color: #818cf8;
		margin-bottom: 0.4rem;
	}

	.sub-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.sub-field label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #94a3b8;
	}

	.sub-field.flex-grow {
		flex: 1;
	}

	.form-input-sm {
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		padding: 0.35rem 0.5rem;
		color: #f8fafc;
		font-size: 0.8rem;
		min-width: 0;
	}

	.form-input-sm:focus {
		outline: none;
		border-color: #6366f1;
	}

	.btn-icon-delete {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #f87171;
		border-radius: 6px;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 0.8rem;
		flex-shrink: 0;
		transition: all 0.15s ease;
		margin-bottom: 0.15rem;
	}

	.btn-icon-delete:hover {
		background: rgba(239, 68, 68, 0.35);
		color: #ffffff;
	}

	/* Reclassifications Section */
	.reclass-section {
		border: 1px solid rgba(139, 92, 246, 0.3);
		border-radius: 12px;
		background: rgba(139, 92, 246, 0.06);
		padding: 1rem 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.reclass-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.reclass-title-group {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
	}

	.reclass-icon {
		font-size: 1.3rem;
		line-height: 1;
	}

	.reclass-title-group h4 {
		margin: 0 0 0.25rem 0;
		font-size: 0.925rem;
		font-weight: 700;
		color: #e9d5ff;
	}

	.reclass-desc {
		margin: 0;
		font-size: 0.775rem;
		color: #c4b5fd;
		line-height: 1.35;
	}

	.btn-add-reclass {
		background: rgba(139, 92, 246, 0.25);
		border: 1px solid rgba(139, 92, 246, 0.5);
		color: #ddd6fe;
		border-radius: 8px;
		padding: 0.45rem 0.85rem;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.btn-add-reclass:hover {
		background: rgba(139, 92, 246, 0.4);
		color: #ffffff;
		border-color: #a78bfa;
	}

	.reclass-empty-hint {
		font-size: 0.8rem;
		color: #94a3b8;
		background: rgba(15, 23, 42, 0.4);
		border-radius: 8px;
		padding: 0.65rem 0.85rem;
		border: 1px dashed rgba(255, 255, 255, 0.1);
	}

	.reclass-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.reclass-card {
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(139, 92, 246, 0.25);
		border-radius: 10px;
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.reclass-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.reclass-badge {
		font-size: 0.75rem;
		font-weight: 700;
		color: #c4b5fd;
		background: rgba(139, 92, 246, 0.2);
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
	}

	.reclass-grid {
		display: grid;
		grid-template-columns: 140px 150px 150px 1fr;
		gap: 0.75rem;
		align-items: flex-end;
	}

	.advanced-section {
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		background: rgba(15, 23, 42, 0.3);
		overflow: hidden;
	}

	.toggle-advanced-btn {
		width: 100%;
		padding: 0.75rem 1rem;
		background: transparent;
		border: none;
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: #cbd5e1;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.toggle-advanced-btn:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.chevron {
		transition: transform 0.2s ease;
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	.advanced-body {
		padding: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.preview-section {
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 14px;
		padding: 1.15rem;
	}

	.preview-section h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.95rem;
		font-weight: 700;
		color: #f8fafc;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.badge-count {
		font-size: 0.75rem;
		background: rgba(99, 102, 241, 0.2);
		color: #a5b4fc;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
	}

	.legend-row {
		display: flex;
		gap: 1rem;
		margin-bottom: 0.85rem;
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.color-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.color-dot.green {
		background: #70ad47;
	}

	.color-dot.yellow {
		background: #ffc000;
	}

	.color-dot.red {
		background: #ef4444;
	}

	.color-dot.purple {
		background: #8b5cf6;
	}

	.milestone-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 180px;
		overflow-y: auto;
		padding-right: 0.4rem;
	}

	.milestone-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		background: rgba(30, 41, 59, 0.5);
		border-radius: 8px;
		border-left: 4px solid transparent;
		font-size: 0.85rem;
	}

	.border-stufenaufstieg {
		border-left-color: #70ad47;
	}

	.border-tariferhoehung {
		border-left-color: #ffc000;
	}

	.border-umgruppierung {
		border-left-color: #8b5cf6;
	}

	.border-exit {
		border-left-color: #ef4444;
	}

	.milestone-badge {
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	.badge-stufenaufstieg {
		background: rgba(112, 173, 71, 0.2);
		color: #a3e635;
	}

	.badge-tariferhoehung {
		background: rgba(255, 192, 0, 0.2);
		color: #fde047;
	}

	.badge-umgruppierung {
		background: rgba(139, 92, 246, 0.25);
		color: #c4b5fd;
	}

	.badge-exit {
		background: rgba(239, 68, 68, 0.2);
		color: #f87171;
	}

	.milestone-details {
		flex: 1;
	}

	.milestone-title {
		color: #e2e8f0;
	}

	.milestone-sub {
		font-size: 0.775rem;
		color: #94a3b8;
	}

	.modal-footer {
		padding: 1.25rem 1.75rem;
		background: rgba(15, 23, 42, 0.5);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		align-items: center;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 1.25rem;
		border-radius: 10px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: rgba(255, 255, 255, 0.08);
		color: #cbd5e1;
	}

	.btn-secondary:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.15);
		color: #ffffff;
	}

	.btn-download-only {
		background: rgba(99, 102, 241, 0.15);
		border: 1px solid rgba(99, 102, 241, 0.35);
		color: #c7d2fe;
	}

	.btn-download-only:hover:not(:disabled) {
		background: rgba(99, 102, 241, 0.25);
		color: #ffffff;
	}

	.btn-primary.btn-generate {
		background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
		color: #ffffff;
		box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
	}

	.btn-primary.btn-generate:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
	}

	.spinner {
		animation: rotate 1.5s linear infinite;
		width: 18px;
		height: 18px;
	}

	.spinner .path {
		stroke: currentColor;
		stroke-linecap: round;
		animation: dash 1.5s ease-in-out infinite;
	}

	@keyframes rotate {
		100% {
			transform: rotate(360deg);
		}
	}

	@keyframes dash {
		0% {
			stroke-dasharray: 1, 150;
			stroke-dashoffset: 0;
		}
		50% {
			stroke-dasharray: 90, 150;
			stroke-dashoffset: -35;
		}
		100% {
			stroke-dasharray: 90, 150;
			stroke-dashoffset: -124;
		}
	}

	@media (max-width: 640px) {
		.form-grid {
			grid-template-columns: 1fr;
		}
		.col-span-2 {
			grid-column: span 1;
		}
		.modal-footer {
			flex-direction: column;
			width: 100%;
		}
		.btn {
			width: 100%;
			justify-content: center;
		}
	}

	/* Project Action Radio Group */
	.project-action-box {
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(56, 189, 248, 0.3);
		border-radius: 10px;
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.action-box-title {
		display: block;
		font-size: 0.82rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #38bdf8;
		margin-bottom: 0.75rem;
	}

	.action-box-radios {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.75rem;
	}

	.action-radio-label {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 8px;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.1);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-radio-label:hover {
		background: rgba(51, 65, 85, 0.8);
		border-color: rgba(255, 255, 255, 0.2);
	}

	.action-radio-label.active {
		background: rgba(14, 165, 233, 0.15);
		border-color: #38bdf8;
		box-shadow: 0 0 10px rgba(56, 189, 248, 0.2);
	}

	.action-radio-label input[type="radio"] {
		margin-top: 0.2rem;
		accent-color: #38bdf8;
	}

	.radio-content {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.radio-content strong {
		font-size: 0.88rem;
		color: #f8fafc;
	}

	.radio-content span {
		font-size: 0.78rem;
		color: #94a3b8;
		line-height: 1.35;
	}
</style>
