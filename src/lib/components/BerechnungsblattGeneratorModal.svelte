<script lang="ts">
	import { generateBerechnungsblatt } from '#lib/grant.remote';
	import {
		calculateMilestones,
		parseDateInput,
		calculateEndDate,
		calculateDurationMonthsBetween,
		formatDateISO,
		formatDateDMY,
		computeStepBaselineDate,
		calculateNextStepAscentInfo
	} from '#lib/grants/generator-milestones';
	import type {
		GrantTransformationResult,
		TariffReclassification,
		BgRatePeriod,
		AgaRatePeriod
	} from '#lib/types/grant';
	import type { BgProviderType } from '#lib/types/bg';
	import {
		BGW_TARIFSTELLEN,
		VBG_TARIFSTELLEN,
		BGW_BEITRAGSFUSS_GEMEINNUETZIG,
		BGW_BEITRAGSFUSS_GEWERBLICH,
		BGW_AUSGLEICHSUMLAGE_DEFAULT,
		calculateBgwRate,
		calculateVbgRate,
		calculateManualRate,
		getBgwTarifstelle
	} from '#lib/grants/bg-calculator';
	import {
		getOrganizationBgSettings,
		saveOrganizationBgSettings
	} from '#lib/grants/organization-settings';
	import { getBerechnungsblattExportFileName } from '#lib/grants/filename-utils';

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

	function computeEndDateFromMonths(startStr: string, months: number): string {
		try {
			const parsed = parseDateInput(startStr);
			const endObj = calculateEndDate(parsed, months);
			return formatDateISO(endObj);
		} catch {
			return '';
		}
	}

	// Form State
	const initialStartDate = getDefaultStartDate();
	let employeeName = $state('Frau Maria Musterfrau');
	let startDate = $state(initialStartDate);
	let durationMonths = $state(60);
	let endDate = $state(computeEndDateFromMonths(initialStartDate, 60));
	let weeklyHours = $state(30);
	let fullTimeHours = $state(39);
	let partTimePercentage = $derived(((weeklyHours / fullTimeHours) * 100).toFixed(1).replace('.', ','));
	let tariffGroup = $state('EG2');
	let tariffStep = $state('ES1');

	// Experience level progression continuity from prior employer in same tariff
	let continueTariffProgression = $state(false);
	let progressionInputMode = $state<'months' | 'date'>('months');
	let priorExperienceMonths = $state<number>(12);
	let previousTariffStepStartDate = $state('');

	let currentStepNum = $derived(parseInt((tariffStep || 'ES1').replace(/\D/g, ''), 10) || 1);

	let effectiveStepBaseline = $derived.by(() => {
		if (!continueTariffProgression) {
			return parseDateInput(startDate);
		}
		if (progressionInputMode === 'date' && previousTariffStepStartDate) {
			return parseDateInput(previousTariffStepStartDate);
		}
		return computeStepBaselineDate(startDate, {
			continueTariffProgression: true,
			priorExperienceMonths: priorExperienceMonths > 0 ? priorExperienceMonths : 0
		});
	});

	let nextAscentInfo = $derived.by(() => {
		try {
			return calculateNextStepAscentInfo(currentStepNum, startDate, effectiveStepBaseline);
		} catch {
			return null;
		}
	});

	function handlePriorMonthsChange(months: number) {
		priorExperienceMonths = Math.max(0, months);
		if (startDate && months >= 0) {
			try {
				const start = parseDateInput(startDate);
				const totalMonths = (start.year * 12 + start.month - 1) - months;
				const baseYear = Math.floor(totalMonths / 12);
				const baseMonth = (totalMonths % 12) + 1;
				previousTariffStepStartDate = `${baseYear}-${String(baseMonth).padStart(2, '0')}-${String(start.day).padStart(2, '0')}`;
			} catch {}
		}
	}

	function handleStepStartDateChange(dateStr: string) {
		previousTariffStepStartDate = dateStr;
		if (startDate && dateStr) {
			try {
				const start = parseDateInput(startDate);
				const base = parseDateInput(dateStr);
				const months = Math.max(0, (start.year - base.year) * 12 + (start.month - base.month) + (start.day >= base.day ? 0 : -1));
				priorExperienceMonths = months;
			} catch {}
		}
	}

	let healthInsuranceName = $state('Barmer');
	let jobcenterId = $state('');
	let zgsId = $state('');

	function handleStartDateChange(newStart: string) {
		startDate = newStart;
		if (newStart && durationMonths > 0) {
			endDate = computeEndDateFromMonths(newStart, durationMonths);
		}
	}

	function handleDurationChange(newMonths: number) {
		durationMonths = newMonths;
		if (startDate && newMonths > 0) {
			endDate = computeEndDateFromMonths(startDate, newMonths);
		}
	}

	function handleEndDateChange(newEnd: string) {
		endDate = newEnd;
		if (startDate && newEnd) {
			try {
				const startObj = parseDateInput(startDate);
				const endObj = parseDateInput(newEnd);
				const calcMonths = calculateDurationMonthsBetween(startObj, endObj);
				if (calcMonths > 0) {
					durationMonths = calcMonths;
				}
			} catch {
				// Keep current duration if parse fails
			}
		}
	}

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

	// Berufsgenossenschaft (Gesetzliche Unfallversicherung) Multi-Provider Engine
	let bgProvider = $state<BgProviderType>('bgw');
	let bgwIsNonProfit = $state(true);
	let bgwTarifstelleCode = $state('ts-14');
	let bgwDangerClassOverride = $state<number | undefined>(undefined);
	let bgwBeitragsfussOverride = $state<number | undefined>(undefined);
	let bgwAusgleichsumlage = $state(BGW_AUSGLEICHSUMLAGE_DEFAULT);
	let bgwSurcharge = $state(0.0);

	let vbgTarifstelleCode = $state('vbg-ts-26');
	let vbgDangerClass = $state(0.33);
	let vbgBeitragsfuss = $state(4.00);

	let manualBgRatePercent = $state(0.681);

	let showBgDetails = $state(false);
	let showBgTimeline = $state(false);
	let bgTimeline = $state<BgRatePeriod[]>([]);
	let orgSettingsSavedToast = $state(false);

	// Load organization defaults on initialization
	const initialOrgSettings = getOrganizationBgSettings();
	bgProvider = initialOrgSettings.provider;
	bgwIsNonProfit = initialOrgSettings.bgw.isNonProfit;
	bgwTarifstelleCode = initialOrgSettings.bgw.tarifstelleCode;
	bgwDangerClassOverride = initialOrgSettings.bgw.dangerClassOverride;
	bgwBeitragsfussOverride = initialOrgSettings.bgw.beitragsfussOverride;
	bgwAusgleichsumlage = initialOrgSettings.bgw.ausgleichsumlageRate ?? BGW_AUSGLEICHSUMLAGE_DEFAULT;
	bgwSurcharge = initialOrgSettings.bgw.surchargePercentage ?? 0.0;
	vbgTarifstelleCode = initialOrgSettings.vbg.tarifstelleCode || 'vbg-ts-26';
	vbgDangerClass = initialOrgSettings.vbg.dangerClass;
	vbgBeitragsfuss = initialOrgSettings.vbg.beitragsfuss;
	manualBgRatePercent = initialOrgSettings.manualRatePercent;

	function handleVbgPresetChange(code: string) {
		vbgTarifstelleCode = code;
		const found = VBG_TARIFSTELLEN.find(t => t.code === code);
		if (found) {
			vbgDangerClass = found.dangerClass;
		}
	}

	function handleSaveOrgDefaults() {
		saveOrganizationBgSettings({
			provider: bgProvider,
			bgw: {
				isNonProfit: bgwIsNonProfit,
				tarifstelleCode: bgwTarifstelleCode,
				dangerClassOverride: bgwDangerClassOverride,
				beitragsfussOverride: bgwBeitragsfussOverride,
				ausgleichsumlageRate: bgwAusgleichsumlage,
				surchargePercentage: bgwSurcharge
			},
			vbg: {
				tarifstelleCode: vbgTarifstelleCode,
				dangerClass: vbgDangerClass,
				beitragsfuss: vbgBeitragsfuss
			},
			manualRatePercent: manualBgRatePercent
		});
		orgSettingsSavedToast = true;
		setTimeout(() => {
			orgSettingsSavedToast = false;
		}, 3000);
	}

	let bgCalculation = $derived.by(() => {
		if (bgProvider === 'bgw') {
			return calculateBgwRate({
				isNonProfit: bgwIsNonProfit,
				tarifstelleCode: bgwTarifstelleCode,
				dangerClassOverride: bgwDangerClassOverride,
				beitragsfussOverride: bgwBeitragsfussOverride,
				ausgleichsumlageRate: bgwAusgleichsumlage,
				surchargePercentage: bgwSurcharge
			});
		} else if (bgProvider === 'vbg') {
			return calculateVbgRate({
				tarifstelleCode: vbgTarifstelleCode,
				dangerClass: vbgDangerClass,
				beitragsfuss: vbgBeitragsfuss
			});
		} else {
			return calculateManualRate({
				ratePercent: manualBgRatePercent
			});
		}
	});

	let effectiveBgRatePercent = $derived(bgCalculation.ratePercent);
	let effectiveBgRateDecimal = $derived(bgCalculation.rateDecimal);

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
				rate: effectiveBgRateDecimal,
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
		const selFund = AVAILABLE_INSURANCES.find(i => i.name === healthInsuranceName)
			|| (healthInsuranceName.toLowerCase().includes('big') ? AVAILABLE_INSURANCES.find(i => i.name.toLowerCase().includes('big')) : undefined);
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
		{ name: 'BIG direkt gesund', rate: '25,285%', note: 'Direktversicherung (Zusatz 3,69%)' },
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
				endDate,
				durationMonths,
				tariffGroup,
				tariffStep,
				continueTariffProgression,
				previousTariffStepStartDate: continueTariffProgression
					? (progressionInputMode === 'date' && previousTariffStepStartDate ? previousTariffStepStartDate : formatDateISO(effectiveStepBaseline))
					: undefined,
				priorExperienceMonths: continueTariffProgression ? priorExperienceMonths : undefined,
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

		if (startDate && endDate && endDate < startDate) {
			errorMessage = 'Das Enddatum muss nach dem Startdatum liegen.';
			return;
		}

		try {
			isGenerating = true;
			errorMessage = null;

			const response = await generateBerechnungsblatt({
				employeeName,
				startDate,
				endDate,
				durationMonths,
				tariffGroup,
				tariffStep,
				continueTariffProgression,
				previousTariffStepStartDate: continueTariffProgression
					? (progressionInputMode === 'date' && previousTariffStepStartDate ? previousTariffStepStartDate : formatDateISO(effectiveStepBaseline))
					: undefined,
				priorExperienceMonths: continueTariffProgression ? priorExperienceMonths : undefined,
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
				bgRate: effectiveBgRateDecimal,
				bgProvider: bgCalculation.providerLabel,
				bgDetails: bgCalculation.detailsLabel,
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
						<span class="field-hint filename-preview">
							Export-Dateiname: <code>{getBerechnungsblattExportFileName(employeeName)}</code>
						</span>
					</div>

					<!-- Start Date -->
					<div class="form-group">
						<label for="startDate">Startdatum (Beginn) <span class="required">*</span></label>
						<input
							type="date"
							id="startDate"
							value={startDate}
							oninput={(e) => handleStartDateChange(e.currentTarget.value)}
							onchange={(e) => handleStartDateChange(e.currentTarget.value)}
							class="form-input"
							required
						/>
						<span class="field-hint">Standard: 1. des nächsten Monats</span>
					</div>

					<!-- Flexible End Date -->
					<div class="form-group">
						<div class="label-row">
							<label for="endDate">Enddatum (Geplantes Ende) <span class="required">*</span></label>
							<span class="runtime-badge">
								{durationMonths} {durationMonths === 1 ? 'Monat' : 'Monate'}
								{#if durationMonths >= 12}
									({(durationMonths / 12).toFixed(1).replace('.', ',')} J.)
								{/if}
							</span>
						</div>
						<input
							type="date"
							id="endDate"
							value={endDate}
							oninput={(e) => handleEndDateChange(e.currentTarget.value)}
							onchange={(e) => handleEndDateChange(e.currentTarget.value)}
							class="form-input"
							min={startDate}
							required
						/>
						<span class="field-hint">Frei wählbares Befristungs- oder Förderende</span>
					</div>

					<!-- Duration Presets -->
					<div class="form-group col-span-2 duration-presets-group">
						<div class="duration-presets-bar">
							<span class="preset-title">⚡ Schnellauswahl Laufzeit:</span>
							<div class="pill-selector">
								{#each [12, 24, 36, 48, 60] as months}
									<button
										type="button"
										class="pill-btn {durationMonths === months ? 'active' : ''}"
										onclick={() => handleDurationChange(months)}
									>
										{months / 12} {months === 12 ? 'Jahr' : 'Jahre'} ({months} M.)
									</button>
								{/each}
								{#if ![12, 24, 36, 48, 60].includes(durationMonths)}
									<span class="custom-duration-pill">
										Individuell: {durationMonths} M.
									</span>
								{/if}
							</div>
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

					<!-- Stufenlaufzeit-Fortführung aus Vorbeschäftigung Card -->
					<div class="form-group col-span-2 tariff-continuity-card {continueTariffProgression ? 'active' : ''}">
						<div class="continuity-header-row">
							<div class="continuity-title-left">
								<label class="continuity-switch-label" for="toggle-continuity">
									<input
										type="checkbox"
										id="toggle-continuity"
										bind:checked={continueTariffProgression}
										class="continuity-checkbox"
									/>
									<span class="continuity-title-text">
										Tarifliche Vorbeschäftigung anrechnen (Stufenlaufzeit fortführen)
									</span>
								</label>
								<span class="continuity-sub-hint">
									{#if continueTariffProgression}
										Mitarbeiter/in wechselt aus demselben Tarif (z. B. TV-L / AWO Berlin) — bisherige Stufenlaufzeit wird übernommen.
									{:else}
										Standard: Stufenlaufzeit beginnt beim neuen Arbeitgeber bei 0 Monaten (Laufzeitneubeginn).
									{/if}
								</span>
							</div>
							<div class="continuity-status-badge">
								{#if continueTariffProgression}
									<span class="badge-continuity-active">⚡ Fortführung aktiv</span>
								{:else}
									<span class="badge-continuity-inactive">Standard (Neubeginn)</span>
								{/if}
							</div>
						</div>

						{#if continueTariffProgression}
							<div class="continuity-body">
								<div class="continuity-mode-selector">
									<button
										type="button"
										class="continuity-mode-btn {progressionInputMode === 'months' ? 'active' : ''}"
										onclick={() => {
											progressionInputMode = 'months';
											if (!priorExperienceMonths || priorExperienceMonths <= 0) handlePriorMonthsChange(12);
										}}
									>
										📅 Nach absolvierten Monaten
									</button>
									<button
										type="button"
										class="continuity-mode-btn {progressionInputMode === 'date' ? 'active' : ''}"
										onclick={() => {
											progressionInputMode = 'date';
											if (!previousTariffStepStartDate) handlePriorMonthsChange(priorExperienceMonths || 12);
										}}
									>
										🗓️ Nach Datum des Stufenbeginns
									</button>
								</div>

								<div class="continuity-inputs-row">
									{#if progressionInputMode === 'months'}
										<div class="sub-field flex-1">
											<label for="prior-months-input">Bereits absolvierte Monate in {tariffStep}</label>
											<div class="input-with-unit">
												<input
													type="number"
													id="prior-months-input"
													min="1"
													max={currentStepNum * 12}
													step="1"
													value={priorExperienceMonths}
													oninput={(e) => handlePriorMonthsChange(parseInt(e.currentTarget.value, 10) || 0)}
													class="form-input"
												/>
												<span class="unit">Monate</span>
											</div>
										</div>

										<div class="sub-field flex-2">
											<span class="sub-field-label">Schnellauswahl für {tariffStep}:</span>
											<div class="pills-row">
												{#each [6, 12, 18, 24, 30].filter(m => m < currentStepNum * 12) as mPreset}
													<button
														type="button"
														class="pill-btn continuity-pill {priorExperienceMonths === mPreset ? 'active' : ''}"
														onclick={() => handlePriorMonthsChange(mPreset)}
													>
														{mPreset} Mon. ({mPreset >= 12 ? `${(mPreset / 12).toFixed(1).replace('.0', '').replace('.', ',')} J.` : ''})
													</button>
												{/each}
											</div>
										</div>
									{:else}
										<div class="sub-field flex-1">
											<label for="step-start-date-input">Datum des Beginns von {tariffStep} beim Vorarbeitgeber</label>
											<input
												type="date"
												id="step-start-date-input"
												value={previousTariffStepStartDate}
												oninput={(e) => handleStepStartDateChange(e.currentTarget.value)}
												onchange={(e) => handleStepStartDateChange(e.currentTarget.value)}
												max={startDate}
												class="form-input"
											/>
										</div>
									{/if}
								</div>

								{#if nextAscentInfo}
									<div class="continuity-live-result-box">
										<div class="result-icon">⚡</div>
										<div class="result-text">
											<div class="result-main">
												{#if nextAscentInfo.nextStep}
													Nächster Stufenaufstieg zu <strong>ES{nextAscentInfo.nextStep}</strong> am <strong>{nextAscentInfo.nextAscentDateStr}</strong>
													{#if nextAscentInfo.remainingMonthsAtNewEmployer > 0}
														(bereits nach <strong>{nextAscentInfo.remainingMonthsAtNewEmployer} {nextAscentInfo.remainingMonthsAtNewEmployer === 1 ? 'Monat' : 'Monaten'}</strong> beim neuen Arbeitgeber)
													{:else}
														(fällig mit Dienstantritt)
													{/if}
												{:else}
													Mitarbeiter/in befindet sich bereits in Endstufe ES6.
												{/if}
											</div>
											<div class="result-sub">
												Angerechnete Vorzeit: {nextAscentInfo.priorMonthsCredited} Monate von erforderlichen {nextAscentInfo.totalMonthsRequiredInStep} Monaten in {tariffStep} • Referenz-Stufenbeginn: {formatDateDMY(effectiveStepBaseline)}
											</div>
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Settable Hours / Week (Prominent in main form) -->
					<div class="form-group col-span-2 weekly-hours-card">
						<div class="hours-header-row">
							<div class="hours-title-left">
								<label for="weeklyHours" class="main-field-label">Wöchentliche Arbeitszeit</label>
								<span class="hours-sub-hint">Grundlage für Teilzeitberechnung und Förderbetrag</span>
							</div>
							<div class="hours-live-badge">
								{#if weeklyHours === fullTimeHours}
									<span class="badge-fulltime">100% Vollzeit ({fullTimeHours} Std.)</span>
								{:else}
									<span class="badge-parttime">{partTimePercentage}% Teilzeit ({weeklyHours} / {fullTimeHours} Std.)</span>
								{/if}
							</div>
						</div>

						<div class="hours-control-row">
							<div class="input-with-unit hours-input-box">
								<input
									type="number"
									id="weeklyHours"
									bind:value={weeklyHours}
									min="1"
									max="45"
									step="0.5"
									class="form-input"
								/>
								<span class="unit">Std./Woche</span>
							</div>

							<div class="hours-quick-pills">
								{#each [19.5, 20, 25, 30, 35, 39] as h}
									<button
										type="button"
										class="pill-btn hours-pill {weeklyHours === h ? 'active' : ''}"
										onclick={() => (weeklyHours = h)}
									>
										{h} {h === 30 ? 'Std. (§ 16i)' : (h === 39 ? 'Std. (Vollzeit)' : (h === 19.5 ? 'Std. (50%)' : 'Std.'))}
									</button>
								{/each}
							</div>
						</div>
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
					<div class="form-group col-span-2 bg-calculation-wrapper">
						<div class="bg-section-header">
							<div class="bg-header-left">
								<span class="bg-icon">🛡️</span>
								<div>
									<label class="bg-main-label" for="bgw-gts">Berufsgenossenschaft (Gesetzliche Unfallversicherung)</label>
									<span class="bg-sub-desc">Gesetzliche Umlage (§ 152 ff. SGB VII) für Arbeitsunfall- und Berufskrankheitsschutz</span>
								</div>
							</div>
							<div class="bg-provider-tabs">
								<button
									type="button"
									class="provider-tab-btn {bgProvider === 'bgw' ? 'active' : ''}"
									onclick={() => (bgProvider = 'bgw')}
								>
									BGW
								</button>
								<button
									type="button"
									class="provider-tab-btn {bgProvider === 'vbg' ? 'active' : ''}"
									onclick={() => (bgProvider = 'vbg')}
								>
									VBG
								</button>
								<button
									type="button"
									class="provider-tab-btn {bgProvider === 'manual' ? 'active' : ''}"
									onclick={() => (bgProvider = 'manual')}
								>
									Manuell
								</button>
							</div>
						</div>

						{#if bgProvider === 'bgw'}
							<!-- BGW Options & GTS Selector -->
							<div class="bg-provider-card bgw-card">
								<div class="bgw-top-controls">
									<div class="nonprofit-toggle-group">
										<button
											type="button"
											class="chip-toggle-btn {bgwIsNonProfit ? 'active' : ''}"
											onclick={() => (bgwIsNonProfit = !bgwIsNonProfit)}
										>
											<span class="chip-status-dot"></span>
											{bgwIsNonProfit ? 'Gemeinnützig / Wohlfahrtspflege (Basis-Beitragsfuß 1,94)' : 'Gewerblich / Nicht gemeinnützig (Beitragsfuß 2,08)'}
										</button>
									</div>
									<div class="bg-actions-group">
										<button
											type="button"
											class="action-pill-btn {showBgDetails ? 'active' : ''}"
											onclick={() => (showBgDetails = !showBgDetails)}
											title="Einzelfall-Parameter anpassen"
										>
											⚙️ Einzelfall-Parameter
										</button>
										<button
											type="button"
											class="action-pill-btn save-org-btn"
											onclick={handleSaveOrgDefaults}
											title="Aktuelle Einstellungen als Organisations-Standard in diesem Browser speichern"
										>
											{#if orgSettingsSavedToast}
												✓ Gespeichert!
											{:else}
												💾 Als Organisations-Standard
											{/if}
										</button>
										<button
											type="button"
											class="timeline-pill-btn {showBgTimeline || bgTimeline.length > 0 ? 'active' : ''}"
											onclick={() => (showBgTimeline = !showBgTimeline)}
										>
											📅 Zeitverlauf {bgTimeline.length > 0 ? `(${bgTimeline.length} Intervalle)` : ''}
										</button>
									</div>
								</div>

								<div class="sub-field gts-select-field">
									<label for="bgw-gts">Gefahrtarifstelle (6. Gefahrtarif der BGW ab 2025)</label>
									<select
										id="bgw-gts"
										bind:value={bgwTarifstelleCode}
										class="form-select gts-select"
									>
										{#each BGW_TARIFSTELLEN as ts}
											<option value={ts.code}>
												{ts.title} (GK {ts.dangerClass.toFixed(2).replace('.', ',')})
											</option>
										{/each}
									</select>
									{#if getBgwTarifstelle(bgwTarifstelleCode)}
										<span class="gts-hint-text">
											{getBgwTarifstelle(bgwTarifstelleCode)?.description}
										</span>
									{/if}
								</div>

								{#if showBgDetails}
									<div class="bg-details-drawer">
										<div class="bg-drawer-header">
											<span>⚙️ Einzelfall-Parameter für diesen Teilnehmer</span>
											<span class="drawer-sub">Überschreiben Sie hier spezifische Faktoren aus dem BGW-Beitragsbescheid</span>
										</div>
										<div class="bg-drawer-grid">
											<div class="sub-field">
												<label for="bgw-danger-override">Gefahrklasse (Override)</label>
												<input
													id="bgw-danger-override"
													type="number"
													step="0.01"
													min="0.1"
													max="20"
													placeholder={getBgwTarifstelle(bgwTarifstelleCode)?.dangerClass.toFixed(2) || '3.47'}
													value={bgwDangerClassOverride ?? ''}
													oninput={(e) => {
														const val = parseFloat(e.currentTarget.value);
														bgwDangerClassOverride = isNaN(val) ? undefined : val;
													}}
													class="form-input-sm"
												/>
											</div>
											<div class="sub-field">
												<label for="bgw-bf-override">Beitragsfuß (Override)</label>
												<input
													id="bgw-bf-override"
													type="number"
													step="0.01"
													min="0.5"
													max="10"
													placeholder={bgwIsNonProfit ? '1.94' : '2.08'}
													value={bgwBeitragsfussOverride ?? ''}
													oninput={(e) => {
														const val = parseFloat(e.currentTarget.value);
														bgwBeitragsfussOverride = isNaN(val) ? undefined : val;
													}}
													class="form-input-sm"
												/>
											</div>
											<div class="sub-field">
												<label for="bgw-au">Ausgleichsumlage (€ / 1.000 €)</label>
												<input
													id="bgw-au"
													type="number"
													step="0.01"
													min="0"
													max="1"
													bind:value={bgwAusgleichsumlage}
													class="form-input-sm"
												/>
											</div>
											<div class="sub-field">
												<label for="bgw-surcharge">Zuschlag / Nachlass (%)</label>
												<input
													id="bgw-surcharge"
													type="number"
													step="0.5"
													min="-25"
													max="50"
													bind:value={bgwSurcharge}
													class="form-input-sm"
												/>
											</div>
										</div>
									</div>
								{/if}

								<!-- Live Result Card -->
								<div class="bg-live-result-bar">
									<div class="live-result-left">
										<span class="live-label">Berechneter BG-Beitragssatz:</span>
										<span class="live-rate-badge">{effectiveBgRatePercent.toFixed(3).replace('.', ',')} %</span>
										<span class="live-decimal">({effectiveBgRateDecimal.toFixed(5).replace('.', ',')})</span>
									</div>
									<div class="live-result-right">
										<span class="live-formula" title="Berechnungsgrundlage gem. SGB VII">
											📐 {bgCalculation.formulaBreakdown}
										</span>
										<span class="old-comparison-badge" title="Alte pauschale Schätzung war 1,80%">
											Vorher: 1,80% (ca. {Math.round((1 - (effectiveBgRatePercent / 1.80)) * 100)}% realistischer)
										</span>
									</div>
								</div>
							</div>
						{:else if bgProvider === 'vbg'}
							<!-- VBG Options -->
							<div class="bg-provider-card vbg-card">
								<div class="bgw-top-controls">
									<div class="vbg-preset-group">
										{#each VBG_TARIFSTELLEN as vts}
											<button
												type="button"
												class="chip-btn {vbgTarifstelleCode === vts.code ? 'active' : ''}"
												onclick={() => handleVbgPresetChange(vts.code)}
											>
												{vts.title.split(':')[0]}: {vts.title.split(':')[1]?.split('(')[0]?.trim()} (GK {vts.dangerClass.toFixed(2).replace('.', ',')})
											</button>
										{/each}
									</div>
									<div class="bg-actions-group">
										<button
											type="button"
											class="action-pill-btn save-org-btn"
											onclick={handleSaveOrgDefaults}
											title="Aktuelle Einstellungen als Organisations-Standard in diesem Browser speichern"
										>
											{#if orgSettingsSavedToast}
												✓ Gespeichert!
											{:else}
												💾 Als Organisations-Standard
											{/if}
										</button>
										<button
											type="button"
											class="timeline-pill-btn {showBgTimeline || bgTimeline.length > 0 ? 'active' : ''}"
											onclick={() => (showBgTimeline = !showBgTimeline)}
										>
											📅 Zeitverlauf {bgTimeline.length > 0 ? `(${bgTimeline.length} Intervalle)` : ''}
										</button>
									</div>
								</div>

								<div class="bg-drawer-grid mt-2">
									<div class="sub-field">
										<label for="vbg-danger">Gefahrklasse</label>
										<input
											id="vbg-danger"
											type="number"
											step="0.01"
											min="0.1"
											max="15"
											bind:value={vbgDangerClass}
											class="form-input-sm"
										/>
									</div>
									<div class="sub-field">
										<label for="vbg-bf">VBG-Beitragsfuß (pro 1.000 €)</label>
										<input
											id="vbg-bf"
											type="number"
											step="0.05"
											min="1"
											max="10"
											bind:value={vbgBeitragsfuss}
											class="form-input-sm"
										/>
									</div>
								</div>

								<div class="bg-live-result-bar">
									<div class="live-result-left">
										<span class="live-label">Berechneter VBG-Satz:</span>
										<span class="live-rate-badge">{effectiveBgRatePercent.toFixed(3).replace('.', ',')} %</span>
									</div>
									<div class="live-result-right">
										<span class="live-formula">📐 {bgCalculation.formulaBreakdown}</span>
									</div>
								</div>
							</div>
						{:else}
							<!-- Manual Direct % Input -->
							<div class="bg-provider-card manual-card">
								<div class="input-with-toggle">
									<div class="input-with-unit">
										<input
											type="number"
											id="bgRate"
											bind:value={manualBgRatePercent}
											min="0"
											max="15"
											step="0.01"
											class="form-input"
										/>
										<span class="unit">% Beitragssatz</span>
									</div>
									<div class="bg-actions-group">
										<button
											type="button"
											class="action-pill-btn save-org-btn"
											onclick={handleSaveOrgDefaults}
										>
											{#if orgSettingsSavedToast}
												✓ Gespeichert!
											{:else}
												💾 Als Organisations-Standard
											{/if}
										</button>
										<button
											type="button"
											class="timeline-pill-btn {showBgTimeline || bgTimeline.length > 0 ? 'active' : ''}"
											onclick={() => (showBgTimeline = !showBgTimeline)}
										>
											📅 Zeitverlauf {bgTimeline.length > 0 ? `(${bgTimeline.length} Intervalle)` : ''}
										</button>
									</div>
								</div>
								<span class="field-hint">Geben Sie direkt den Prozentsatz aus Ihrem BG-Bescheid ein (z. B. 0,681%).</span>
							</div>
						{/if}

						{#if showBgTimeline}
							<div class="nested-timeline-box">
								<div class="nested-timeline-header">
									<span>📅 Berufsgenossenschafts-Beitragssatz im Zeitverlauf</span>
									<button type="button" class="btn-sub-action" onclick={addBgPeriod}>
										+ Zeitraum hinzufügen
									</button>
								</div>
								{#if bgTimeline.length === 0}
									<p class="empty-timeline-hint">Standardmäßig gilt der oben berechnete Beitragssatz ({effectiveBgRatePercent.toFixed(3).replace('.', ',')}%) über die gesamte 5-jährige Laufzeit. Fügen Sie Zeiträume hinzu, falls sich der BG-Gefahrtarif oder Beitragsfuß in späteren Förderjahren ändert.</p>
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
														step="0.01"
														value={Number((period.rate * 100).toFixed(3))}
														oninput={(e) => (period.rate = parseFloat(e.currentTarget.value) / 100 || 0)}
														class="form-input-sm"
													/>
												</div>
												<div class="sub-field flex-grow">
													<label for="bg-label-{period.id}">Bezeichnung</label>
													<input id="bg-label-{period.id}" type="text" bind:value={period.label} placeholder="z. B. BGW 6. Gefahrtarif" class="form-input-sm" />
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
						<span>⚙️ Weitere Einstellungen (Vollzeit-Referenz, Sachkosten, Sonderzahlung)</span>
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
									<label for="fullTimeHours">Referenz-Vollzeitstunden</label>
									<div class="input-with-unit">
										<input
											type="number"
											id="fullTimeHours"
											bind:value={fullTimeHours}
											min="35"
											max="42"
											step="0.5"
											class="form-input"
										/>
										<span class="unit">Std./Woche</span>
									</div>
									<span class="field-hint">Tarifliche Vollzeit nach TV-L / AWO: 39,0 Std.</span>
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

	.filename-preview {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.35rem;
		color: #94a3b8;
		font-size: 0.8rem;
		flex-wrap: wrap;
	}

	.filename-preview code {
		color: #38bdf8;
		font-family: monospace;
		background: rgba(56, 189, 248, 0.08);
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
		border: 1px solid rgba(56, 189, 248, 0.25);
		word-break: break-all;
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

	/* Multi-Provider Berufsgenossenschaft Calculation */
	.bg-calculation-wrapper {
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(56, 189, 248, 0.25);
		border-radius: 12px;
		padding: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.bg-section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.bg-header-left {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.bg-icon {
		font-size: 1.4rem;
	}

	.bg-main-label {
		display: block;
		font-weight: 700;
		font-size: 0.95rem;
		color: #f1f5f9;
	}

	.bg-sub-desc {
		display: block;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.bg-provider-tabs {
		display: flex;
		background: rgba(15, 23, 42, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 0.2rem;
		gap: 0.2rem;
	}

	.provider-tab-btn {
		background: transparent;
		border: none;
		color: #94a3b8;
		padding: 0.35rem 0.85rem;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.provider-tab-btn:hover {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.05);
	}

	.provider-tab-btn.active {
		background: #0284c7;
		color: #ffffff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
	}

	.bg-provider-card {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.bgw-top-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.chip-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.35);
		color: #6ee7b7;
		padding: 0.4rem 0.75rem;
		border-radius: 8px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.chip-toggle-btn:not(.active) {
		background: rgba(148, 163, 184, 0.12);
		border-color: rgba(148, 163, 184, 0.25);
		color: #cbd5e1;
	}

	.chip-status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: currentColor;
	}

	.bg-actions-group {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.action-pill-btn {
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		padding: 0.4rem 0.75rem;
		font-size: 0.775rem;
		color: #94a3b8;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		transition: all 0.15s ease;
	}

	.action-pill-btn:hover {
		color: #ffffff;
		border-color: #38bdf8;
		background: rgba(56, 189, 248, 0.1);
	}

	.action-pill-btn.active {
		border-color: #38bdf8;
		background: rgba(56, 189, 248, 0.15);
		color: #7dd3fc;
	}

	.save-org-btn {
		border-color: rgba(99, 102, 241, 0.4);
		background: rgba(99, 102, 241, 0.15);
		color: #c7d2fe;
	}

	.save-org-btn:hover {
		border-color: #818cf8;
		background: rgba(99, 102, 241, 0.25);
		color: #ffffff;
	}

	.gts-select-field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.gts-select {
		width: 100%;
		font-size: 0.875rem;
		padding: 0.6rem 0.75rem;
	}

	.gts-hint-text {
		font-size: 0.75rem;
		color: #94a3b8;
		line-height: 1.35;
		margin-top: 0.2rem;
	}

	.bg-details-drawer {
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 0.75rem 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.bg-drawer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.drawer-sub {
		font-size: 0.725rem;
		font-weight: normal;
		color: #94a3b8;
	}

	.bg-drawer-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 0.65rem;
	}

	.bg-live-result-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
		background: linear-gradient(135deg, rgba(2, 132, 199, 0.12), rgba(99, 102, 241, 0.12));
		border: 1px solid rgba(56, 189, 248, 0.3);
		border-radius: 10px;
		padding: 0.75rem 1rem;
	}

	.live-result-left {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.live-label {
		font-size: 0.825rem;
		color: #e2e8f0;
		font-weight: 600;
	}

	.live-rate-badge {
		font-size: 1.25rem;
		font-weight: 800;
		color: #38bdf8;
		letter-spacing: -0.02em;
	}

	.live-decimal {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.live-result-right {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.live-formula {
		font-size: 0.775rem;
		color: #bae6fd;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		background: rgba(0, 0, 0, 0.25);
		padding: 0.2rem 0.5rem;
		border-radius: 5px;
	}

	.old-comparison-badge {
		font-size: 0.725rem;
		color: #34d399;
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.3);
		padding: 0.2rem 0.5rem;
		border-radius: 5px;
		font-weight: 600;
	}

	.vbg-preset-group {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
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

	.tariff-continuity-card {
		background: rgba(15, 23, 42, 0.45);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 0.9rem 1.15rem;
		transition: all 0.25s ease;
	}

	.tariff-continuity-card.active {
		background: rgba(16, 185, 129, 0.04);
		border-color: rgba(16, 185, 129, 0.35);
		box-shadow: 0 4px 20px rgba(16, 185, 129, 0.06);
	}

	.continuity-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.continuity-title-left {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.continuity-switch-label {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		cursor: pointer;
		font-weight: 600;
		font-size: 0.95rem;
		color: #f8fafc;
	}

	.continuity-checkbox {
		width: 1.15rem;
		height: 1.15rem;
		cursor: pointer;
		accent-color: #10b981;
	}

	.continuity-sub-hint {
		font-size: 0.78rem;
		color: #94a3b8;
	}

	.badge-continuity-active {
		font-size: 0.72rem;
		font-weight: 700;
		color: #34d399;
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.3);
		padding: 0.25rem 0.65rem;
		border-radius: 9999px;
		letter-spacing: 0.02em;
	}

	.badge-continuity-inactive {
		font-size: 0.72rem;
		color: #64748b;
		background: rgba(100, 116, 139, 0.12);
		padding: 0.25rem 0.65rem;
		border-radius: 9999px;
	}

	.continuity-body {
		margin-top: 0.9rem;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.continuity-mode-selector {
		display: flex;
		gap: 0.5rem;
	}

	.continuity-mode-btn {
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #94a3b8;
		padding: 0.35rem 0.75rem;
		border-radius: 8px;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.continuity-mode-btn.active {
		background: rgba(16, 185, 129, 0.15);
		border-color: rgba(16, 185, 129, 0.4);
		color: #6ee7b7;
		font-weight: 600;
	}

	.continuity-inputs-row {
		display: flex;
		gap: 1.25rem;
		align-items: flex-end;
		flex-wrap: wrap;
	}

	.pills-row {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.continuity-pill {
		font-size: 0.75rem;
		padding: 0.35rem 0.65rem;
	}

	.continuity-live-result-box {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		background: rgba(16, 185, 129, 0.08);
		border: 1px solid rgba(16, 185, 129, 0.25);
		border-radius: 10px;
		padding: 0.65rem 0.9rem;
	}

	.result-icon {
		font-size: 1.35rem;
		color: #34d399;
	}

	.result-main {
		font-size: 0.85rem;
		color: #e2e8f0;
	}

	.result-sub {
		font-size: 0.74rem;
		color: #94a3b8;
		margin-top: 0.15rem;
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

	/* Flexible End Date & Duration Presets */
	.runtime-badge {
		font-size: 0.775rem;
		font-weight: 600;
		color: #818cf8;
		background: rgba(99, 102, 241, 0.12);
		border: 1px solid rgba(99, 102, 241, 0.25);
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
	}

	.duration-presets-group {
		margin-top: -0.25rem;
	}

	.duration-presets-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: rgba(15, 23, 42, 0.4);
		border: 1px dashed rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		padding: 0.5rem 0.85rem;
		flex-wrap: wrap;
	}

	.preset-title {
		font-size: 0.8rem;
		font-weight: 600;
		color: #94a3b8;
		white-space: nowrap;
	}

	.custom-duration-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.45rem 0.65rem;
		border-radius: 8px;
		font-size: 0.8rem;
		font-weight: 600;
		background: rgba(139, 92, 246, 0.2);
		border: 1px solid rgba(139, 92, 246, 0.4);
		color: #c4b5fd;
	}

	/* Weekly Hours Primary Card */
	.weekly-hours-card {
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(99, 102, 241, 0.25);
		border-radius: 12px;
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.hours-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.hours-title-left {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.hours-title-left .main-field-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #f1f5f9;
	}

	.hours-sub-hint {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.hours-live-badge {
		display: flex;
		align-items: center;
	}

	.badge-fulltime {
		font-size: 0.75rem;
		font-weight: 600;
		color: #34d399;
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.35);
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
	}

	.badge-parttime {
		font-size: 0.75rem;
		font-weight: 600;
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.15);
		border: 1px solid rgba(56, 189, 248, 0.35);
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
	}

	.hours-control-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.hours-input-box {
		width: 140px;
		flex-shrink: 0;
	}

	.hours-quick-pills {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.hours-pill {
		padding: 0.4rem 0.65rem;
	}
</style>
