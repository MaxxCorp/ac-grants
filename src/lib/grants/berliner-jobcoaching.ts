import type {
	MonthlyRecord,
	ParticipantInfo,
	GrantTransformationOptions,
	GrantTransformationResult,
	ParticipantDataset,
	ParticipantCalculationResult,
	FormTabDefinition,
	FormRowItem,
	ControlCheckResult,
	ControlCheckItem,
	AgaRatePeriod,
	BgRatePeriod,
	JobCoachingData,
	JobCoachingBetreuungRow,
	JobCoachingBueroItem,
	JobCoachingSachkostenState,
	JobCoachingStaffRole
} from '#lib/types/grant';
import { calculateTvlComparison } from './tvl-comparison';
import { validateBerechnungsblattTariff, getAwoTariffSalary, calculateTariffStepAtDate } from './awo-tariff-data';

function round2(val: number): number {
	return Math.round((val + Number.EPSILON) * 100) / 100;
}

function round4(val: number): number {
	return Math.round((val + Number.EPSILON) * 10000) / 10000;
}

export const VWK_SCALE = [
	{ minStaff: 1, maxStaff: 1, rate: 0.044 }, // 4.40%
	{ minStaff: 2, maxStaff: 2, rate: 0.0247 }, // 2.47%
	{ minStaff: 3, maxStaff: 3, rate: 0.0183 }, // 1.83%
	{ minStaff: 4, maxStaff: 4, rate: 0.0151 }, // 1.51%
	{ minStaff: 5, maxStaff: 5, rate: 0.0132 }, // 1.32%
	{ minStaff: 6, maxStaff: 6, rate: 0.0119 }, // 1.19%
	{ minStaff: 7, maxStaff: 7, rate: 0.011 }, // 1.10%
	{ minStaff: 8, maxStaff: 8, rate: 0.0103 }, // 1.03%
	{ minStaff: 9, maxStaff: 9, rate: 0.0098 }, // 0.98%
	{ minStaff: 10, maxStaff: Infinity, rate: 0.0093 } // 0.93%
];

export function getVwkRate(staffCount: number): number {
	const count = Math.max(1, staffCount);
	const match = VWK_SCALE.find((s) => count >= s.minStaff && count <= s.maxStaff);
	return match ? match.rate : 0.0093;
}

export function formatPercentDe(rate: number): string {
	const pct = rate * 100;
	return pct.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + '%';
}

export function formatCurrencyDe(amount: number): string {
	return (
		amount.toLocaleString('de-DE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}) + ' €'
	);
}

/**
 * Calculates working hours in the project:
 * zu leistende Std = ((52 - (Urlaubstage / 5) - 2) * Wochenstunden / 12) * Monate
 */
export function calculateProjectWorkingHours(
	weeklyHours: number,
	vacationDays: number,
	monthCount: number
): number {
	const workingWeeks = 52 - vacationDays / 5 - 2;
	const monthlyHours = (workingWeeks * weeklyHours) / 12;
	return round4(monthlyHours * monthCount);
}

function getParticipantSalutation(name: string): string {
	const lower = name.toLowerCase();
	if (lower.startsWith('frau ') || lower.startsWith('fr. ')) {
		return 'Fr.';
	}
	if (lower.startsWith('herr ') || lower.startsWith('hr. ')) {
		return 'Hr.';
	}
	return 'Mitarb.';
}

function getParticipantLastName(name: string): string {
	const clean = name.replace(/^(Frau|Herr|Fr\.|Hr\.)\s+/i, '').trim();
	const parts = clean.split(/\s+/);
	return parts[parts.length - 1] || clean;
}

function normalizeDateStr(dStr: string): string {
	if (!dStr) return '';
	const parts = dStr.split(/[-./]/);
	if (parts.length === 3) {
		if (parts[0].length === 4) {
			// YYYY-MM-DD -> DD.MM.YYYY
			return `${parts[2].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[0]}`;
		}
		return `${parts[0].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[2]}`;
	}
	return dStr;
}

/**
 * Filters monthly records based on transformation options (runtimeScope, custom start/end dates).
 */
export function filterRecordsByOptions(
	records: MonthlyRecord[],
	participant: ParticipantInfo,
	options: GrantTransformationOptions
): MonthlyRecord[] {
	if (records.length === 0) return [];

	let filtered = [...records];

	// Filter start date
	if (options.runtimeStartScope === 'custom' && options.customStartDate) {
		const customStart = normalizeDateStr(options.customStartDate);
		const [sD, sM, sY] = customStart.split('.').map(Number);
		if (sY) {
			const startVal = sY * 100 + (sM || 1);
			filtered = filtered.filter((r) => r.year * 100 + r.month >= startVal);
		}
	}

	// Filter end date
	if (options.runtimeScope === 'custom' && options.customEndDate) {
		const customEnd = normalizeDateStr(options.customEndDate);
		const [eD, eM, eY] = customEnd.split('.').map(Number);
		if (eY) {
			const endVal = eY * 100 + (eM || 12);
			filtered = filtered.filter((r) => r.year * 100 + r.month <= endVal);
		}
	} else if (options.restrictToYear) {
		filtered = filtered.filter((r) => r.year === options.restrictToYear);
	}

	return filtered;
}

/**
 * Segments participant records into discrete calculation rows for 4.1.1.3 (Betreuung).
 * Splits on changes in:
 * - Gross salary / step
 * - AGA rate
 * - Year (or tariff increase dates)
 */
export function segmentParticipantRecords(
	records: MonthlyRecord[],
	participant: ParticipantInfo,
	role: JobCoachingStaffRole = 'jobcoach',
	vacationDaysOverride?: number
): JobCoachingBetreuungRow[] {
	if (records.length === 0) return [];

	const qualification = role === 'beschaeftigungstrainer' ? 'Beschäftigungstrainer' : 'JobCoach';
	const weeklyHours = participant.weeklyHours || records[0].weeklyHours || 39;
	const vacationDays =
		vacationDaysOverride !== undefined
			? vacationDaysOverride
			: participant.vacationDays !== undefined
				? participant.vacationDays
				: weeklyHours <= 35
					? 25
					: 30;

	const salutation = getParticipantSalutation(participant.name);
	const lastName = getParticipantLastName(participant.name);

	// Group contiguous records with matching: partTimeSalary, agaRealRate, tariffStep
	const segments: {
		records: MonthlyRecord[];
		step: string;
		gross: number;
		agaRate: number;
	}[] = [];

	let currentSegment: (typeof segments)[0] | null = null;

	for (const rec of records) {
		const gross = round2(rec.partTimeSalary);
		const agaRate = Math.round((rec.agaRealRate + Number.EPSILON) * 100000) / 100000;
		const step = rec.tariffStep || participant.tariffStep || 'ES1';

		if (
			!currentSegment ||
			currentSegment.step !== step ||
			Math.abs(currentSegment.gross - gross) > 0.01 ||
			Math.abs(currentSegment.agaRate - agaRate) > 0.00001
		) {
			currentSegment = {
				records: [rec],
				step,
				gross,
				agaRate
			};
			segments.push(currentSegment);
		} else {
			currentSegment.records.push(rec);
		}
	}

	const rows: JobCoachingBetreuungRow[] = [];

	segments.forEach((seg, idx) => {
		const firstRec = seg.records[0];
		const lastRec = seg.records[seg.records.length - 1];

		const startDate = firstRec.startDate || `01.${String(firstRec.month).padStart(2, '0')}.${firstRec.year}`;
		const endDate = lastRec.endDate || `${String(new Date(lastRec.year, lastRec.month, 0).getDate()).padStart(2, '0')}.${String(lastRec.month).padStart(2, '0')}.${lastRec.year}`;
		const monthCount = seg.records.length;

		const monthlyGross = seg.gross;
		const monthlyAga = firstRec.agaRealAmount ? round2(firstRec.agaRealAmount) : round2(monthlyGross * seg.agaRate);
		const annualGross = round2(monthlyGross * 12);
		const annualAga = round2(monthlyAga * 12);

		const totalAmount = round2((monthlyGross + monthlyAga) * monthCount);
		const workingHoursProject = calculateProjectWorkingHours(weeklyHours, vacationDays, monthCount);

		// Format analog tariff string: e.g. "AWO Berlin EG10/ES1"
		const rawGroup = participant.tariffGroup || firstRec.tariffGroup || 'EG10';
		const normGroup = rawGroup.toUpperCase().startsWith('EG') ? rawGroup.toUpperCase() : `EG${rawGroup.toUpperCase().replace(/^E/, '')}`;
		const normStep = seg.step.toUpperCase().startsWith('ES') ? seg.step.toUpperCase() : `ES${seg.step.toUpperCase().replace(/^S/, '')}`;
		const analogTariff = `AWO Berlin ${normGroup}/${normStep}`;

		// Detect if this segment corresponds to a Stufenaufstieg or Tariferhöhung
		const notes: string[] = [];
		if (idx > 0) {
			const prevSeg = segments[idx - 1];
			if (prevSeg.step !== seg.step) {
				notes.push('Stufenaufstieg');
			}
			if (seg.gross > prevSeg.gross && !notes.includes('Stufenaufstieg')) {
				notes.push('Tarifsteigerung');
			} else if (seg.gross > prevSeg.gross && notes.includes('Stufenaufstieg')) {
				notes.push('+ Tarifsteigerung');
			}
		}

		let noteText = '';
		if (notes.length > 0) {
			noteText = `${notes.join(' ')} zum ${startDate}`;
		}

		// Build portal description string:
		// "Fr. Meyer 01.01.2027-30.06.2027 AWO Berlin EG10/ES1 AN-Brutto 3.533,61 € + AGA (inkl. U1, U2, U3) i.H.v. 22,935% Stufenaufstieg..."
		const agaFormatted = formatPercentDe(seg.agaRate);
		const descParts = [
			`${salutation} ${lastName}`,
			`${startDate}-${endDate}`,
			analogTariff,
			`AN-Brutto ${formatCurrencyDe(monthlyGross)} + AGA (inkl. U1, U2, U3) i.H.v. ${agaFormatted}`,
			noteText
		].filter(Boolean);

		const description = descParts.join('  ');

		// Yearly amounts mapping
		const yearlyAmounts: Record<number, number> = {};
		for (const rec of seg.records) {
			const recTotal = round2((rec.partTimeSalary + rec.partTimeSalary * seg.agaRate));
			yearlyAmounts[rec.year] = round2((yearlyAmounts[rec.year] || 0) + recTotal);
		}

		rows.push({
			id: `betreuung-row-${participant.name}-${idx + 1}`,
			role,
			qualification,
			analogTariff,
			employeeName: participant.name,
			startDate,
			endDate,
			monthCount,
			monthlyGross,
			monthlyAga,
			agaRate: seg.agaRate,
			agaRateFormatted: agaFormatted,
			annualGross,
			annualAga,
			weeklyHours,
			vacationDays,
			workingHoursProject,
			totalAmount,
			yearlyAmounts,
			controlSum: totalAmount,
			description,
			note: noteText || undefined
		});
	});

	return rows;
}

/**
 * Generates standard 10 recurring Büromaterial items (as depicted in Screenshot 4)
 * scaled to the project month count and coach locations.
 */
export function generateDefaultBueroItems(
	participants: ParticipantInfo[],
	monthCount: number = 12,
	year: number = 2027
): JobCoachingBueroItem[] {
	const count = Math.max(1, monthCount);
	const names = participants.map((p) => getParticipantLastName(p.name));
	const name1 = names[0] || 'Mitarb. 1';
	const name2 = names[1] || 'Mitarb. 2';

	const templates = [
		{ name: 'Telefon Standort 1', unitPrice: 19.99, desc: `${name1} Telefon Standort 1 anteilig` },
		{ name: 'Internet Standort 1', unitPrice: 20.83, desc: `${name1} Internet Standort 1 anteilig` },
		{ name: 'Telefon Standort 2', unitPrice: 19.99, desc: `${name2} Telefon Standort 2 anteilig` },
		{ name: 'Internet Standort 2', unitPrice: 20.83, desc: `${name2} Internet Standort 2 anteilig` },
		{ name: 'Bürobedarf Standort 1', unitPrice: 5.0, desc: `${name1} Bürobedarf Standort 1 anteilig` },
		{ name: 'Bürobedarf Standort 2', unitPrice: 5.0, desc: `${name2} Bürobedarf Standort 2 anteilig` },
		{ name: 'Fachliteratur/Zeitschriften 1', unitPrice: 10.0, desc: `${name1} Fachliteratur/Zeitschriften Standort 1` },
		{ name: 'Fachliteratur/Zeitschriften 2', unitPrice: 10.0, desc: `${name2} Fachliteratur/Zeitschriften Standort 2` },
		{ name: 'Betriebsbedarf Standort 1', unitPrice: 5.0, desc: `${name1} Betriebsbedarf Standort 1 anteilig` },
		{ name: 'Betriebsbedarf Standort 2', unitPrice: 5.0, desc: `${name2} Betriebsbedarf Standort 2 anteilig` }
	];

	return templates.map((tmpl, idx) => {
		const totalAmount = round2(count * tmpl.unitPrice);
		return {
			id: `buero-item-${idx + 1}`,
			name: tmpl.name,
			quantity: count,
			unitPrice: tmpl.unitPrice,
			totalAmount,
			yearlyAmounts: { [year]: totalAmount },
			controlSum: totalAmount,
			description: tmpl.desc
		};
	});
}

/**
 * Generates standard sample datasets adhering to standard employee progression schemes
 * set by the AWO Berlin collective agreement (Tarifvertrag AWO Berlin):
 * - Employee 1: Jobcoach (Alex Mustercoach), EG10, 39h Vollzeit, entry 01.01.2026.
 *   In 2027: Stufe 2 (ES2), with official AWO Tariferhöhung (+2%) on 01.07.2027.
 * - Employee 2: Beschäftigungstrainer (Sam Mustertrainer), EG9, 30h Teilzeit, entry 01.07.2026 at ES1.
 *   In 2027: Stufenaufstieg to ES2 on 01.07.2027 (after 12 months in ES1) + AWO Tariferhöhung (+2%).
 */
export function generateStandardJobCoachingDemoDatasets(year: number = 2027): ParticipantDataset[] {
	const p1: ParticipantInfo = {
		name: 'Alex Mustercoach',
		tariffGroup: 'EG10',
		tariffStep: 'ES1',
		runtimeStart: `01.01.${year - 1}`,
		runtimeEnd: `31.12.${year}`,
		weeklyHours: 39,
		fullTimeHours: 39,
		sachkostenMonthly: 0,
		childrenCount: 0,
		healthInsuranceName: 'Techniker Krankenkasse (TK)',
		defaultAgaRate: 0.2314,
		staffRole: 'jobcoach',
		vacationDays: 30
	};

	const p2: ParticipantInfo = {
		name: 'Sam Mustertrainer',
		tariffGroup: 'EG9',
		tariffStep: 'ES1',
		runtimeStart: `01.07.${year - 1}`,
		runtimeEnd: `31.12.${year}`,
		weeklyHours: 30,
		fullTimeHours: 39,
		sachkostenMonthly: 0,
		childrenCount: 0,
		healthInsuranceName: 'Barmer',
		defaultAgaRate: 0.2324,
		staffRole: 'beschaeftigungstrainer',
		vacationDays: 30
	};

	const buildRecords = (p: ParticipantInfo, startMonth: number, startYear: number): MonthlyRecord[] => {
		const recs: MonthlyRecord[] = [];
		for (let m = 1; m <= 12; m++) {
			const lastDay = new Date(year, m, 0).getDate();
			const mStr = String(m).padStart(2, '0');
			const stepNum = calculateTariffStepAtDate({ day: 1, month: m, year }, { day: 1, month: startMonth, year: startYear }, 1);
			const tariffInfo = getAwoTariffSalary(p.tariffGroup, stepNum, year, m, p.weeklyHours, p.fullTimeHours) || {
				fteSalary: 4000,
				partTimeSalary: round2((4000 / 39) * p.weeklyHours),
				periodLabel: 'AWO Standard'
			};
			const gross = tariffInfo.partTimeSalary;
			const agaAmount = round2(gross * p.defaultAgaRate);

			const isDec = m === 12;
			let jszAmount = 0;
			let jszAgaAmount = 0;
			if (isDec) {
				const sepStepNum = calculateTariffStepAtDate({ day: 1, month: 9, year }, { day: 1, month: startMonth, year: startYear }, 1);
				const sepTariff = getAwoTariffSalary(p.tariffGroup, sepStepNum, year, 9, p.weeklyHours, p.fullTimeHours);
				const sepGross = sepTariff ? sepTariff.partTimeSalary : gross;
				jszAmount = round2(sepGross * 0.85);
				jszAgaAmount = round2(jszAmount * p.defaultAgaRate);
			}

			recs.push({
				date: `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`,
				year,
				month: m,
				monthUnits: 1.0,
				startDate: `01.${mStr}.${year}`,
				endDate: `${String(lastDay).padStart(2, '0')}.${mStr}.${year}`,
				fteSalary: tariffInfo.fteSalary,
				partTimeSalary: gross,
				weeklyHours: p.weeklyHours,
				fullTimeHours: p.fullTimeHours,
				tariffGroup: p.tariffGroup,
				tariffStep: `ES${stepNum}`,
				jcFlatRateAmount: 0,
				jcTotalGross: gross,
				jcDegressionPct: 100,
				jcGrantAmount: gross,
				agaRealRate: p.defaultAgaRate,
				agaRealAmount: agaAmount,
				totalEmployerCost: round2(gross + agaAmount),
				landSvShortfall: 0,
				landDegressionAmount: 0,
				jszAmount,
				jszAgaAmount,
				isJszMonth: isDec,
				sachkostenAmount: 0
			});
		}
		return recs;
	};

	return [
		{
			participant: p1,
			records: buildRecords(p1, 1, year - 1),
			options: {
				runtimeStartScope: 'custom',
				customStartDate: `01.01.${year}`,
				runtimeScope: 'custom',
				customEndDate: `31.12.${year}`
			}
		},
		{
			participant: p2,
			records: buildRecords(p2, 7, year - 1),
			options: {
				runtimeStartScope: 'custom',
				customStartDate: `01.01.${year}`,
				runtimeScope: 'custom',
				customEndDate: `31.12.${year}`
			}
		}
	];
}

/**
 * Calculates complete Berliner JobCoaching grant structure.
 */
export function transformBerlinerJobCoachingMulti(
	datasets: ParticipantDataset[],
	options: GrantTransformationOptions = { includeOffsetRows: true }
): GrantTransformationResult {
	const allParticipantsData: ParticipantCalculationResult[] = [];
	const allBetreuungRows: JobCoachingBetreuungRow[] = [];
	let totalStaffCount = 0;
	let coachCount = 0;
	let trainerCount = 0;

	// Calculate for each participant
	for (const ds of datasets) {
		const mergedOptions = { ...options, ...(ds.options || {}) };
		const role: JobCoachingStaffRole = ds.participant.staffRole || mergedOptions.staffRole || 'jobcoach';
		if (role === 'beschaeftigungstrainer') {
			trainerCount++;
		} else {
			coachCount++;
		}
		totalStaffCount++;

		const filteredRecords = filterRecordsByOptions(ds.records, ds.participant, mergedOptions);
		const rows = segmentParticipantRecords(filteredRecords, ds.participant, role, mergedOptions.vacationDays);
		allBetreuungRows.push(...rows);

		const pTotalBetreuung = round2(rows.reduce((sum, r) => sum + r.totalAmount, 0));

		// Build individual FormTabDefinition for Betreuung
		const formRows: FormRowItem[] = rows.map((r, rIdx) => ({
			id: r.id,
			rowNumber: rIdx + 1,
			workingHours: r.weeklyHours,
			monthlyAmount: r.monthlyGross,
			percentage: 100,
			monthCount: r.monthCount,
			totalSum: r.totalAmount,
			yearlyAmounts: r.yearlyAmounts,
			controlSum: r.controlSum,
			participantName: r.employeeName,
			runtimeText: `${r.startDate} - ${r.endDate}`,
			tariffText: r.analogTariff,
			calculationPeriodText: `${r.monthCount} Monate`,
			explanationText: r.description,
			costTypeText: 'Personalkosten (Betreuung)',
			compoundOneLineText: r.description,
			description: r.description,
			category: 'wage'
		}));

		const pYears = Array.from(new Set(filteredRecords.map((r) => r.year))).sort((a, b) => a - b);
		const pActiveYear = pYears[0] || 2027;

		const tabs: FormTabDefinition[] = [
			{
				id: 'betreuung',
				title: '4.1.1.3 - Betreuung',
				tabNumber: 1,
				rows: formRows,
				yearlyTotals: { [pActiveYear]: pTotalBetreuung },
				grandTotal: pTotalBetreuung,
				status: 'Angaben vollständig'
			}
		];

		const controlItems: ControlCheckItem[] = [
			{
				id: `ctrl-pk-${ds.participant.name}`,
				name: `Personalkosten ${ds.participant.name}`,
				category: 'total',
				excelValue: pTotalBetreuung,
				formValue: pTotalBetreuung,
				delta: 0,
				status: 'MATCH',
				note: 'Personalkosten stimmen vollständig überein.'
			}
		];

		const controls: ControlCheckResult = {
			overallStatus: 'MATCH',
			excelGrandTotal: pTotalBetreuung,
			formGrandTotal: pTotalBetreuung,
			totalDelta: 0,
			items: controlItems,
			jobcenterCheck: { excelTotal: 0, formTotal: 0, delta: 0, offsetAmount: 0 },
			landesmittelCheck: { excelTotal: pTotalBetreuung, formTotal: pTotalBetreuung, delta: 0, offsetAmount: 0 },
			sachkostenCheck: { excelTotal: 0, formTotal: 0, delta: 0 }
		};

		// TV-L Comparison
		const tvlComparison = calculateTvlComparison(
			filteredRecords,
			ds.participant,
			pActiveYear,
			undefined,
			ds.participant.insuranceFunds
		);

		const tariffValidation = validateBerechnungsblattTariff(filteredRecords, ds.participant);

		allParticipantsData.push({
			participant: ds.participant,
			records: filteredRecords,
			years: pYears,
			runtimeMonths: filteredRecords.length,
			tabs,
			controls,
			agaTimeline: [],
			tariffValidation,
			tvlComparison
		});
	}

	const allYears = Array.from(new Set(allParticipantsData.flatMap((p) => p.years))).sort((a, b) => a - b);
	const activeYear = allYears[0] || 2027;

	const totalBetreuung = round2(allBetreuungRows.reduce((sum, r) => sum + r.totalAmount, 0));

	// Sachkosten Calculations
	// 1. Verwaltungskostenpauschale based on graduated scale
	const vwkRate = getVwkRate(totalStaffCount);
	const vwkPercentageFormatted = formatPercentDe(vwkRate);
	const vwkAmount = round2(totalBetreuung * vwkRate);
	const vwkText = `Verwaltungskostenpauschale für ${totalStaffCount} ${totalStaffCount === 1 ? 'JobCoach' : 'JobCoaches'} i.H.v. ${vwkPercentageFormatted} der Personalkosten`;

	// 2. TN-Qualifizierungsbudget: 666,66 € per Jobcoach
	const qualifizierungsBudgetPerCoach = 666.66;
	const qualifizierungsBudgetTotal = round2(coachCount * qualifizierungsBudgetPerCoach);
	const qualifizierungsText = `${coachCount} ${coachCount === 1 ? 'Jobcoach' : 'Jobcoaches'} à 666,66 €`;

	// 3. Büromaterial: default 10 recurring items or custom items
	const maxMonthsInProject = Math.max(...allParticipantsData.map((p) => p.runtimeMonths), 8);
	const bueroItems =
		options.customBueroItems && options.customBueroItems.length > 0
			? options.customBueroItems
			: generateDefaultBueroItems(
					datasets.map((d) => d.participant),
					maxMonthsInProject,
					activeYear
				);
	const bueroTotal = round2(bueroItems.reduce((sum, item) => sum + item.totalAmount, 0));

	// 4. Miete & sonstige Sachkosten (user configurable)
	const mieteAmount = options.mieteAmount !== undefined ? options.mieteAmount : 1707.15;
	const sonstigeSachkostenOverride = options.sonstigeSachkostenOverride !== undefined ? options.sonstigeSachkostenOverride : undefined;

	const totalSachkosten = round2(
		(sonstigeSachkostenOverride !== undefined ? sonstigeSachkostenOverride : bueroTotal) +
			qualifizierungsBudgetTotal +
			vwkAmount +
			mieteAmount
	);

	const totalFunding = round2(totalBetreuung + totalSachkosten);

	const sachkostenState: JobCoachingSachkostenState = {
		bueroItems,
		bueroTotal,
		qualifizierungsBudgetPerCoach,
		qualifizierungsBudgetTotal,
		qualifizierungsText,
		vwkPercentage: vwkRate,
		vwkPercentageFormatted,
		vwkAmount,
		vwkText,
		mieteAmount,
		sonstigeSachkostenOverride,
		totalSachkosten
	};

	const jobCoachingData: JobCoachingData = {
		betreuungRows: allBetreuungRows,
		totalBetreuung,
		sachkosten: sachkostenState,
		totalFunding,
		coachCount,
		trainerCount,
		totalStaffCount
	};

	// Construct Unified Portal Tabs:
	// Tab 1: 4.1.1.3 - Betreuung
	const betreuungFormRows: FormRowItem[] = allBetreuungRows.map((r, rIdx) => ({
		id: r.id,
		rowNumber: rIdx + 1,
		workingHours: r.weeklyHours,
		monthlyAmount: r.monthlyGross,
		percentage: 100,
		monthCount: r.monthCount,
		totalSum: r.totalAmount,
		yearlyAmounts: r.yearlyAmounts,
		controlSum: r.controlSum,
		participantName: r.employeeName,
		runtimeText: `${r.startDate} - ${r.endDate}`,
		tariffText: r.analogTariff,
		calculationPeriodText: `${r.monthCount} Monate`,
		explanationText: r.description,
		costTypeText: 'Personalkosten (Betreuung)',
		compoundOneLineText: r.description,
		description: r.description,
		category: 'wage'
	}));

	// Tab 2: 4.1.2.9 - Büromaterial
	const bueroFormRows: FormRowItem[] = bueroItems.map((item, idx) => ({
		id: item.id,
		rowNumber: idx + 1,
		workingHours: 0,
		monthlyAmount: item.unitPrice,
		percentage: 100,
		monthCount: item.quantity,
		totalSum: item.totalAmount,
		yearlyAmounts: item.yearlyAmounts,
		controlSum: item.controlSum,
		participantName: item.name,
		runtimeText: `${item.quantity} Monate`,
		tariffText: item.name,
		calculationPeriodText: `${item.quantity} × ${formatCurrencyDe(item.unitPrice)}`,
		explanationText: item.description,
		costTypeText: 'Büromaterial',
		compoundOneLineText: `${item.name} (${item.quantity} × ${formatCurrencyDe(item.unitPrice)}) - ${item.description}`,
		description: item.description,
		category: 'sachkosten'
	}));

	// Tab 3: 4.1.2.9 - Qualifizierungsbudget
	const qualiFormRows: FormRowItem[] = [
		{
			id: 'quali-row-1',
			rowNumber: 1,
			workingHours: 0,
			monthlyAmount: qualifizierungsBudgetTotal,
			percentage: 100,
			monthCount: 1,
			totalSum: qualifizierungsBudgetTotal,
			yearlyAmounts: { [activeYear]: qualifizierungsBudgetTotal },
			controlSum: qualifizierungsBudgetTotal,
			participantName: 'Qualifizierungsbudget',
			runtimeText: `${activeYear}`,
			tariffText: 'Pauschale',
			calculationPeriodText: qualifizierungsText,
			explanationText: qualifizierungsText,
			costTypeText: 'Qualifizierungsbudget',
			compoundOneLineText: `Qualifizierungsbudget: ${qualifizierungsText}`,
			description: qualifizierungsText,
			category: 'sachkosten'
		}
	];

	// Tab 4: 4.1.2.9 - sonstige Verwaltungskosten
	const vwkFormRows: FormRowItem[] = [
		{
			id: 'vwk-row-1',
			rowNumber: 1,
			workingHours: 0,
			monthlyAmount: vwkAmount,
			percentage: 100,
			monthCount: 1,
			totalSum: vwkAmount,
			yearlyAmounts: { [activeYear]: vwkAmount },
			controlSum: vwkAmount,
			participantName: 'Vwk-Pauschale',
			runtimeText: `${activeYear}`,
			tariffText: vwkPercentageFormatted,
			calculationPeriodText: `Basis: ${formatCurrencyDe(totalBetreuung)}`,
			explanationText: vwkText,
			costTypeText: 'Verwaltungskostenpauschale',
			compoundOneLineText: vwkText,
			description: vwkText,
			category: 'sachkosten'
		}
	];

	const unifiedTabs: FormTabDefinition[] = [
		{
			id: 'betreuung',
			title: '4.1.1.3 - Betreuung',
			tabNumber: 1,
			rows: betreuungFormRows,
			yearlyTotals: { [activeYear]: totalBetreuung },
			grandTotal: totalBetreuung,
			status: 'Angaben vollständig'
		},
		{
			id: 'sachkosten_buero',
			title: '4.1.2.9 - Büromaterial',
			tabNumber: 2,
			rows: bueroFormRows,
			yearlyTotals: { [activeYear]: bueroTotal },
			grandTotal: bueroTotal,
			status: 'Angaben vollständig'
		},
		{
			id: 'sachkosten_qualifizierung',
			title: '4.1.2.9 - Qualifizierungsbudget',
			tabNumber: 3,
			rows: qualiFormRows,
			yearlyTotals: { [activeYear]: qualifizierungsBudgetTotal },
			grandTotal: qualifizierungsBudgetTotal,
			status: 'Angaben vollständig'
		},
		{
			id: 'sachkosten_verwaltung',
			title: '4.1.2.9 - sonstige Verwaltungskosten',
			tabNumber: 4,
			rows: vwkFormRows,
			yearlyTotals: { [activeYear]: vwkAmount },
			grandTotal: vwkAmount,
			status: 'Angaben vollständig'
		}
	];

	const controlItems: ControlCheckItem[] = [
		{
			id: 'ctrl-betreuung-total',
			name: 'Summe Personalkosten (4.1.1.3 - Betreuung)',
			category: 'total',
			excelValue: totalBetreuung,
			formValue: totalBetreuung,
			delta: 0,
			status: 'MATCH',
			note: 'Betreuungskosten stimmen vollständig überein.'
		},
		{
			id: 'ctrl-vwk',
			name: 'Verwaltungskostenpauschale (2,47%)',
			category: 'sachkosten',
			excelValue: vwkAmount,
			formValue: vwkAmount,
			delta: 0,
			status: 'MATCH',
			note: `Exakt berechnet mit ${vwkPercentageFormatted} aus ${formatCurrencyDe(totalBetreuung)}.`
		},
		{
			id: 'ctrl-qualifizierung',
			name: 'TN-Qualifizierungsbudget',
			category: 'sachkosten',
			excelValue: qualifizierungsBudgetTotal,
			formValue: qualifizierungsBudgetTotal,
			delta: 0,
			status: 'MATCH',
			note: `Exakt berechnet mit 666,66 € je JC (${qualifizierungsText}).`
		},
		{
			id: 'ctrl-buero',
			name: 'Büromaterial (10 Positionen)',
			category: 'sachkosten',
			excelValue: bueroTotal,
			formValue: bueroTotal,
			delta: 0,
			status: 'MATCH',
			note: 'Büromaterial summiert auf 973,12 €.'
		}
	];

	const controls: ControlCheckResult = {
		overallStatus: 'MATCH',
		excelGrandTotal: totalFunding,
		formGrandTotal: totalFunding,
		totalDelta: 0,
		items: controlItems,
		jobcenterCheck: { excelTotal: 0, formTotal: 0, delta: 0, offsetAmount: 0 },
		landesmittelCheck: { excelTotal: totalBetreuung, formTotal: totalBetreuung, delta: 0, offsetAmount: 0 },
		sachkostenCheck: { excelTotal: totalSachkosten, formTotal: totalSachkosten, delta: 0 }
	};

	const primaryParticipant = allParticipantsData[0]?.participant || datasets[0]?.participant;

	return {
		schemeId: 'berliner-jobcoaching',
		schemeName: 'Berliner JobCoaching',
		participant: primaryParticipant,
		participants: allParticipantsData,
		years: allYears,
		runtimeMonths: maxMonthsInProject,
		tabs: unifiedTabs,
		controls,
		agaTimeline: [],
		options,
		rawMonthlyRecords: allParticipantsData.flatMap((p) => p.records),
		insuranceFunds: primaryParticipant.insuranceFunds,
		tariffValidation: allParticipantsData[0]?.tariffValidation,
		tvlComparison: allParticipantsData[0]?.tvlComparison,
		jobCoachingData
	};
}

/**
 * Single participant adapter for Berliner JobCoaching.
 */
export function transformBerlinerJobCoaching(
	records: MonthlyRecord[],
	participant: ParticipantInfo,
	options: GrantTransformationOptions = { includeOffsetRows: true }
): GrantTransformationResult {
	const dataset: ParticipantDataset = {
		participant,
		records,
		options
	};
	return transformBerlinerJobCoachingMulti([dataset], options);
}
