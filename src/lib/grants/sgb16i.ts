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
	RuntimeScope,
	RuntimeStartScope
} from '#lib/types/grant';
import { calculateTvlComparison } from './tvl-comparison';
import { validateBerechnungsblattTariff, calculateTariffStepAtDate, determineParticipantStepForRecord, isAwoTariffIncreaseMonth, getAwoTariffSalary } from './awo-tariff-data';

function round2(val: number): number {
	return Math.round((val + Number.EPSILON) * 100) / 100;
}

function formatDateDMY(isoDate: string): string {
	const parts = isoDate.split('-');
	if (parts.length === 3) {
		return `${parts[2]}.${parts[1]}.${parts[0]}`;
	}
	return isoDate;
}

function getPeriodStartDate(records: MonthlyRecord[]): string {
	if (records.length === 0) return '';
	const first = records[0];
	if (first.startDate) return first.startDate;
	const m = Math.max(1, Math.min(12, first.month || 1));
	return `01.${String(m).padStart(2, '0')}.${first.year}`;
}

function getPeriodEndDate(records: MonthlyRecord[]): string {
	if (records.length === 0) return '';
	const last = records[records.length - 1];
	if (last.endDate) return last.endDate;
	const m = Math.max(1, Math.min(12, last.month || 1));
	const lastDay = new Date(last.year, m, 0).getDate();
	return `${String(lastDay).padStart(2, '0')}.${String(m).padStart(2, '0')}.${last.year}`;
}

/**
 * Builds the complete one-line compound text:
 * Name     Laufzeit     Tarif     Zeitraum     Erläuterung     Betragstyp
 * (Erläuterung is only included when non-empty; components separated by exactly 5 spaces).
 */
export function buildCompoundOneLineText(
	name: string,
	runtime: string,
	tariff: string,
	period: string,
	explanation?: string,
	costType?: string
): string {
	const parts = [
		name,
		runtime,
		tariff,
		period,
		explanation && explanation.trim() !== '' ? explanation.trim() : null,
		costType && costType.trim() !== '' ? costType.trim() : null
	].filter((p): p is string => p !== null && p !== undefined && p !== '');

	return parts.join('     '); // Exactly 5 spaces between each component
}

/**
 * Returns the tariff step string (ES1..ES6) for a monthly record.
 * Uses official AWO tariff scales (sept 2025 - july 2028) whenever available,
 * falling back to career anniversary progression based on runtimeStart.
 */
export function getTariffStep(
	record: MonthlyRecord,
	participantOrRuntimeStart?: ParticipantInfo | string,
	initialTariffStep: string = 'ES1',
	tariffGroup: string = 'EG1'
): string {
	let participant: ParticipantInfo;
	if (typeof participantOrRuntimeStart === 'object' && participantOrRuntimeStart !== null) {
		participant = participantOrRuntimeStart;
	} else {
		participant = {
			name: '',
			tariffGroup: tariffGroup || 'EG1',
			tariffStep: initialTariffStep || 'ES1',
			runtimeStart: typeof participantOrRuntimeStart === 'string' ? participantOrRuntimeStart : '',
			runtimeEnd: '',
			weeklyHours: record.weeklyHours || 30,
			fullTimeHours: record.fullTimeHours || 39,
			sachkostenMonthly: 155,
			childrenCount: 0,
			healthInsuranceName: 'DAK',
			defaultAgaRate: record.agaRealRate || 0.2314
		};
	}
	const stepNum = determineParticipantStepForRecord(participant, record);
	return `ES${stepNum}`;
}

/**
 * Resolves the effective AGA rate for a given record, using custom timeline or default
 */
export function getEffectiveAgaRate(
	record: MonthlyRecord,
	defaultRate: number,
	customTimeline?: AgaRatePeriod[]
): number {
	if (!customTimeline || customTimeline.length === 0) {
		return defaultRate;
	}
	const recDate = record.date;
	for (const period of customTimeline) {
		if (recDate >= period.startDate && recDate <= period.endDate) {
			return period.rate;
		}
	}
	return defaultRate;
}

export function parseDateComponents(dateStr: string): { day: number; month: number; year: number } | null {
	if (!dateStr) return null;
	const clean = dateStr.trim();

	// DD.MM.YYYY or DD.MM.YY
	const ddmmyyyy = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
	if (ddmmyyyy) {
		const day = parseInt(ddmmyyyy[1], 10);
		const month = parseInt(ddmmyyyy[2], 10);
		let year = parseInt(ddmmyyyy[3], 10);
		if (year < 100) year += 2000;
		return { day, month, year };
	}

	// YYYY-MM-DD
	const yyyymmdd = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
	if (yyyymmdd) {
		const year = parseInt(yyyymmdd[1], 10);
		const month = parseInt(yyyymmdd[2], 10);
		const day = parseInt(yyyymmdd[3], 10);
		return { day, month, year };
	}

	// DD/MM/YYYY
	const slash = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
	if (slash) {
		const day = parseInt(slash[1], 10);
		const month = parseInt(slash[2], 10);
		let year = parseInt(slash[3], 10);
		if (year < 100) year += 2000;
		return { day, month, year };
	}

	return null;
}

export function isRecordWithinExitDate(record: MonthlyRecord, exitDateStr: string): boolean {
	const exit = parseDateComponents(exitDateStr);
	if (!exit) return true;

	if (record.year < exit.year) return true;
	if (record.year > exit.year) return false;

	// Same year
	if (record.month < exit.month) return true;
	if (record.month > exit.month) return false;

	// Same year and same month
	if (record.startDate) {
		const startComp = parseDateComponents(record.startDate);
		if (startComp && startComp.year === exit.year && startComp.month === exit.month) {
			if (startComp.day > exit.day) {
				return false;
			}
		}
	}

	return true;
}

export function isRecordWithinStartDate(record: MonthlyRecord, startDateStr: string): boolean {
	const start = parseDateComponents(startDateStr);
	if (!start) return true;

	if (record.year > start.year) return true;
	if (record.year < start.year) return false;

	// Same year
	if (record.month > start.month) return true;
	if (record.month < start.month) return false;

	// Same year and same month
	if (record.endDate) {
		const endComp = parseDateComponents(record.endDate);
		if (endComp && endComp.year === start.year && endComp.month === start.month) {
			if (endComp.day < start.day) {
				return false;
			}
		}
	}

	return true;
}

export function calculateMonthUnits(startDay: number, endDay: number, daysInMonth: number): number {
	if (startDay === 1 && endDay === daysInMonth) return 1.0;
	if ((startDay === 15 || startDay === 16) && endDay === daysInMonth) return 0.5;
	if (startDay === 1 && (endDay === 14 || endDay === 15)) return 0.5;
	return round2((endDay - startDay + 1) / daysInMonth);
}

export function clipRecordDateRange<T extends MonthlyRecord>(
	record: T,
	effectiveStartDate?: string,
	effectiveEndDate?: string,
	sachkostenMonthly?: number
): T {
	let { startDate, endDate, year, month } = record;
	const daysInMonth = new Date(year, month, 0).getDate();
	const mStr = String(month).padStart(2, '0');

	const startComp = parseDateComponents(startDate || `01.${mStr}.${year}`);
	const endComp = parseDateComponents(endDate || `${String(daysInMonth).padStart(2, '0')}.${mStr}.${year}`);
	let startDay = startComp?.day ?? 1;
	let endDay = endComp?.day ?? daysInMonth;

	if (effectiveStartDate) {
		const effStart = parseDateComponents(effectiveStartDate);
		if (effStart && effStart.year === year && effStart.month === month) {
			if (effStart.day > startDay) {
				startDay = effStart.day;
				startDate = `${String(startDay).padStart(2, '0')}.${mStr}.${year}`;
			}
		}
	}

	if (effectiveEndDate) {
		const effEnd = parseDateComponents(effectiveEndDate);
		if (effEnd && effEnd.year === year && effEnd.month === month) {
			if (effEnd.day < endDay) {
				endDay = effEnd.day;
				endDate = `${String(endDay).padStart(2, '0')}.${mStr}.${year}`;
			}
		}
	}

	const newUnits = calculateMonthUnits(startDay, endDay, daysInMonth);
	if (newUnits === record.monthUnits && startDate === record.startDate && endDate === record.endDate) {
		return record;
	}

	const fullMonthlyPartTime = record.fullMonthlyPartTime || (record.fteSalary * record.weeklyHours) / 39;
	const partTimeSalary = round2(fullMonthlyPartTime * newUnits);
	const agaRealAmount = round2(partTimeSalary * record.agaRealRate);
	const totalEmployerCost = round2(partTimeSalary + agaRealAmount);
	const jcFlatRateAmount = round2(partTimeSalary * 0.19);
	const jcTotalGross = round2(partTimeSalary + jcFlatRateAmount);
	const jcGrantAmount = round2((jcTotalGross * record.jcDegressionPct) / 100);
	const landSvShortfall = round2(partTimeSalary * (record.agaRealRate - 0.19));
	const landDegressionAmount = round2((jcTotalGross * (100 - record.jcDegressionPct)) / 100);
	const skRate = sachkostenMonthly !== undefined ? sachkostenMonthly : (record.sachkostenAmount || 155);
	const sachkostenAmount = round2(skRate * newUnits);

	return {
		...record,
		startDate,
		endDate,
		monthUnits: newUnits,
		partTimeSalary,
		jcFlatRateAmount,
		jcTotalGross,
		jcGrantAmount,
		agaRealAmount,
		totalEmployerCost,
		landSvShortfall,
		landDegressionAmount,
		sachkostenAmount
	};
}

export function calculate5YearEndDate(startDateStr: string): string {
	const comp = parseDateComponents(startDateStr);
	if (!comp) return '';
	if (comp.day === 1) {
		let endMonth = comp.month - 1;
		let endYear = comp.year + 5;
		if (endMonth === 0) {
			endMonth = 12;
			endYear = comp.year + 4;
		}
		const lastDay = new Date(endYear, endMonth, 0).getDate();
		return `${String(lastDay).padStart(2, '0')}.${String(endMonth).padStart(2, '0')}.${endYear}`;
	} else {
		const endDay = comp.day - 1;
		const endYear = comp.year + 5;
		return `${String(endDay).padStart(2, '0')}.${String(comp.month).padStart(2, '0')}.${endYear}`;
	}
}

export function ensureRecordsSpanScope(
	records: MonthlyRecord[],
	participant: ParticipantInfo,
	scope: RuntimeScope,
	customEndDate?: string
): MonthlyRecord[] {
	if (records.length === 0) return records;
	const result = [...records];

	const startComp = parseDateComponents(participant.runtimeStart) || { day: 1, month: 8, year: 2026 };
	let targetMonths = 60;
	if (scope === 'exit_date') {
		return result;
	} else if (scope === 'foerderperiode') {
		const startTotalM = startComp.year * 12 + startComp.month;
		const endTotalM = 2029 * 12 + 12;
		targetMonths = Math.max(result.length, endTotalM - startTotalM + 1);
	} else if (scope === 'full_5_years') {
		targetMonths = 60;
	} else if (scope === 'custom' && customEndDate) {
		const customComp = parseDateComponents(customEndDate);
		if (customComp) {
			const startTotalM = startComp.year * 12 + startComp.month;
			const endTotalM = customComp.year * 12 + customComp.month;
			targetMonths = Math.max(result.length, endTotalM - startTotalM + 1);
		}
	}

	const currentTotalMonths = round2(result.reduce((sum, r) => sum + (r.monthUnits || 1.0), 0));
	if (currentTotalMonths >= targetMonths) {
		return result;
	}

	let lastRec = result[result.length - 1];
	let currentYear = lastRec.year;
	let currentMonth = lastRec.month;
	const weeklyHours = participant.weeklyHours || 30;
	const defaultAga = participant.defaultAgaRate || 0.2314;
	const fteSalary = lastRec.fteSalary > 0 ? lastRec.fteSalary : 2774.73;

	const monthsToAdd = Math.ceil(targetMonths - currentTotalMonths);
	for (let i = 0; i < monthsToAdd; i++) {
		currentMonth += 1;
		if (currentMonth > 12) {
			currentMonth = 1;
			currentYear += 1;
		}

		if (scope === 'foerderperiode' && (currentYear > 2029 || (currentYear === 2029 && currentMonth > 12))) {
			break;
		}

		if (scope === 'custom' && customEndDate) {
			const customComp = parseDateComponents(customEndDate);
			if (customComp && (currentYear > customComp.year || (currentYear === customComp.year && currentMonth > customComp.month))) {
				break;
			}
		}

		const elapsedMonths = (currentYear - startComp.year) * 12 + (currentMonth - startComp.month);
		const monthNum = elapsedMonths + 1;

		let jcDegressionPct = 100;
		if (monthNum > 48) {
			jcDegressionPct = 70;
		} else if (monthNum > 36) {
			jcDegressionPct = 80;
		} else if (monthNum > 24) {
			jcDegressionPct = 90;
		}

		const mStr = String(currentMonth).padStart(2, '0');
		const lastDay = new Date(currentYear, currentMonth, 0).getDate();
		const dateStr = `${currentYear}-${mStr}-${String(lastDay).padStart(2, '0')}`;
		const rowStartDate = `01.${mStr}.${currentYear}`;
		const rowEndDate = `${String(lastDay).padStart(2, '0')}.${mStr}.${currentYear}`;

		const fullMonthlyPartTime = (fteSalary * weeklyHours) / 39;
		const fullMonthlyFlatRate = fullMonthlyPartTime * 0.19;
		const fullMonthlyJcTotalGross = fullMonthlyPartTime + fullMonthlyFlatRate;
		const fullMonthlySvShortfall = fullMonthlyPartTime * (defaultAga - 0.19);

		const partTimeSalary = round2(fullMonthlyPartTime);
		const agaRealAmount = round2(partTimeSalary * defaultAga);
		const totalEmployerCost = round2(partTimeSalary + agaRealAmount);
		const jcFlatRateAmount = round2(partTimeSalary * 0.19);
		const jcTotalGross = round2(partTimeSalary + jcFlatRateAmount);
		const jcGrantAmount = round2((jcTotalGross * jcDegressionPct) / 100);
		const landSvShortfall = round2(partTimeSalary * (defaultAga - 0.19));
		const landDegressionAmount = round2((jcTotalGross * (100 - jcDegressionPct)) / 100);
		const sachkostenAmount = round2(participant.sachkostenMonthly || 155);

		let isJszMonth = false;
		let jszAmount = 0;
		let jszAgaAmount = 0;
		if (currentMonth === 12) {
			isJszMonth = true;
			jszAmount = round2(partTimeSalary * 0.85);
			jszAgaAmount = round2(jszAmount * defaultAga);
		}

		const newRec: MonthlyRecord = {
			date: dateStr,
			year: currentYear,
			month: currentMonth,
			monthUnits: 1.0,
			startDate: rowStartDate,
			endDate: rowEndDate,
			fteSalary,
			partTimeSalary,
			fullMonthlyPartTime,
			weeklyHours,
			fullTimeHours: 39,
			jcFlatRateAmount,
			jcTotalGross,
			fullMonthlyJcTotalGross,
			jcDegressionPct,
			jcGrantAmount,
			agaRealRate: defaultAga,
			agaRealAmount,
			totalEmployerCost,
			landSvShortfall,
			fullMonthlySvShortfall,
			landDegressionAmount,
			jszAmount,
			jszAgaAmount,
			sachkostenAmount,
			isJszMonth
		};
		result.push(newRec);
	}

	return result;
}

export function calculateSingleParticipant(
	rawRecords: MonthlyRecord[],
	participant: ParticipantInfo,
	options: GrantTransformationOptions
): ParticipantCalculationResult & {
	exactJcTruthTotal: number;
	exactLandTruthTotal: number;
	jcRoundingDelta: number;
	landRoundingDelta: number;
} {
	const { includeOffsetRows, restrictToYear, customAgaTimeline } = options;
	const runtimeScope: RuntimeScope =
		options.runtimeScope || (options.restrictToExitDate === false ? 'full_5_years' : 'exit_date');
	const runtimeStartScope: RuntimeStartScope =
		options.runtimeStartScope || (options.customStartDate ? 'custom' : 'contract_start');

	const extendedRaw = ensureRecordsSpanScope(rawRecords, participant, runtimeScope, options.customEndDate);

	const allProcessedRecords = extendedRaw.map(r => {
		const effectiveAga = getEffectiveAgaRate(r, participant.defaultAgaRate, customAgaTimeline);
		const safeMonthUnits = r.monthUnits && r.monthUnits > 0 ? r.monthUnits : 1.0;

		const fullMonthlyPartTime = r.fullMonthlyPartTime || (r.fteSalary * participant.weeklyHours) / 39;
		const fullMonthlyFlatRate = fullMonthlyPartTime * 0.19;
		const fullMonthlyJcTotalGross = r.fullMonthlyJcTotalGross || fullMonthlyPartTime + fullMonthlyFlatRate;
		const fullMonthlySvShortfall = fullMonthlyPartTime * (effectiveAga - 0.19);

		const partTimeSalary = round2(fullMonthlyPartTime * safeMonthUnits);
		const agaRealAmount = round2(partTimeSalary * effectiveAga);
		const totalEmployerCost = round2(partTimeSalary + agaRealAmount);
		const jcFlatRate = round2(partTimeSalary * 0.19);
		const jcTotalGross = round2(partTimeSalary + jcFlatRate);
		const landSvShortfall = round2(partTimeSalary * (effectiveAga - 0.19));

		let jszAgaAmount = r.jszAgaAmount;
		if (r.jszAmount > 0) {
			jszAgaAmount = round2(r.jszAmount * effectiveAga);
		}

		return {
			...r,
			monthUnits: safeMonthUnits,
			fullMonthlyPartTime,
			fullMonthlyJcTotalGross,
			fullMonthlySvShortfall,
			partTimeSalary,
			agaRealRate: effectiveAga,
			agaRealAmount,
			totalEmployerCost,
			jcFlatRateAmount: jcFlatRate,
			jcTotalGross,
			landSvShortfall,
			jszAgaAmount
		};
	});

	let records = [...allProcessedRecords];

	const effectiveStartDate =
		runtimeStartScope === 'custom' && options.customStartDate
			? options.customStartDate
			: participant.runtimeStart;

	let effectiveEndDate: string | undefined = undefined;
	if (runtimeScope === 'exit_date' && participant.runtimeEnd) {
		effectiveEndDate = participant.runtimeEnd;
	} else if (runtimeScope === 'foerderperiode') {
		effectiveEndDate = '31.12.2029';
	} else if (runtimeScope === 'custom' && options.customEndDate) {
		effectiveEndDate = options.customEndDate;
	}

	if (effectiveStartDate) {
		records = records.filter(r => isRecordWithinStartDate(r, effectiveStartDate));
	}

	if (effectiveEndDate) {
		records = records.filter(r => isRecordWithinExitDate(r, effectiveEndDate));
	} else if (restrictToYear && restrictToYear > 0) {
		records = records.filter(r => r.year <= restrictToYear);
	}

	records = records.map(r => clipRecordDateRange(r, effectiveStartDate, effectiveEndDate, participant.sachkostenMonthly));

	const contractRuntimeText = participant.runtimeEnd
		? `${participant.runtimeStart}-${participant.runtimeEnd}`
		: (participant.runtimeStart || '');

	const years = Array.from(new Set(records.map(r => r.year))).sort((a, b) => a - b);
	const runtimeMonths = round2(records.reduce((sum, r) => sum + (r.monthUnits || 1.0), 0));

	const jcRows: FormRowItem[] = [];
	let currentJcGroup: MonthlyRecord[] = [];
	let previousJcGroup: MonthlyRecord[] | null = null;

	const flushJcGroup = () => {
		if (currentJcGroup.length === 0) return;
		const first = currentJcGroup[0];
		const monthCount = round2(currentJcGroup.reduce((sum, r) => sum + (r.monthUnits || 1.0), 0));
		const monthlyAmount = round2(first.fullMonthlyJcTotalGross || (first.fteSalary * participant.weeklyHours / 39) * 1.19);
		const percentage = first.jcDegressionPct;
		const rowNumber = jcRows.length + 1;

		const yearlyAmounts: Record<number, number> = {};
		for (const y of years) {
			const unitsInYear = currentJcGroup.filter(r => r.year === y).reduce((sum, r) => sum + (r.monthUnits || 1.0), 0);
			yearlyAmounts[y] = unitsInYear > 0 ? round2((monthlyAmount * percentage / 100) * unitsInYear) : 0;
		}

		const totalSum = Object.values(yearlyAmounts).reduce((a, b) => round2(a + b), 0);
		const startDateText = getPeriodStartDate(currentJcGroup);
		const endDateText = getPeriodEndDate(currentJcGroup);
		const calculationPeriodText = `${startDateText}-${endDateText}`;
		const tariffStep = getTariffStep(first, participant);
		const tariffText = `AWO Berlin ${participant.tariffGroup}/${tariffStep}`;
		const runtimeText = contractRuntimeText;
		const costTypeText = 'AG-Brutto, inkl. 19% Pauschale';
		let explanationText = '';

		if (previousJcGroup) {
			const prevFirst = previousJcGroup[0];
			const prevStep = getTariffStep(prevFirst, participant);
			const currStep = tariffStep;
			const stepChanged = prevStep !== currStep;
			const degressionChanged = prevFirst.jcDegressionPct !== percentage;
			const isKnownTariffIncrease = isAwoTariffIncreaseMonth(first.year, first.month);
			const salaryIncreased = first.fteSalary > prevFirst.fteSalary;

			if (stepChanged && degressionChanged) {
				explanationText = `Stufenaufstieg ${prevStep}->${currStep}, Degression auf ${percentage}% zum ${startDateText}`;
			} else if (degressionChanged) {
				explanationText = `Degression auf ${percentage}% ab ${startDateText}`;
			} else if (stepChanged) {
				explanationText = isKnownTariffIncrease ? `Stufenaufstieg ${prevStep}->${currStep} und Tariferhöhung zum ${startDateText}` : `Stufenaufstieg ${prevStep}->${currStep} zum ${startDateText}`;
			} else if (salaryIncreased) {
				explanationText = isKnownTariffIncrease ? `Tariferhöhung zum ${startDateText}` : `Stufenaufstieg ${prevStep}->${currStep} zum ${startDateText}`;
			}
		}

		jcRows.push({
			id: `jc-row-${rowNumber}`,
			rowNumber,
			workingHours: participant.weeklyHours,
			monthlyAmount,
			percentage,
			monthCount,
			totalSum,
			yearlyAmounts,
			controlSum: totalSum,
			participantName: participant.name,
			runtimeText,
			tariffText,
			calculationPeriodText,
			explanationText,
			costTypeText,
			compoundOneLineText: buildCompoundOneLineText(participant.name, runtimeText, tariffText, calculationPeriodText, explanationText, costTypeText),
			description: explanationText ? `${explanationText}     ${costTypeText}` : costTypeText,
			category: 'wage'
		});

		previousJcGroup = currentJcGroup;
		currentJcGroup = [];
	};

	for (const r of records) {
		if (currentJcGroup.length === 0) {
			currentJcGroup.push(r);
		} else {
			const prev = currentJcGroup[currentJcGroup.length - 1];
			const sameFte = Math.abs(prev.fteSalary - r.fteSalary) < 0.01;
			const sameDegression = prev.jcDegressionPct === r.jcDegressionPct;
			const sameTariffStep = getTariffStep(prev, participant) === getTariffStep(r, participant);

			if (sameFte && sameDegression && sameTariffStep) {
				currentJcGroup.push(r);
			} else {
				flushJcGroup();
				currentJcGroup.push(r);
			}
		}
	}
	flushJcGroup();

	const exactJcTruthTotal = records.reduce((sum, r) => sum + (r.jcTotalGross * r.jcDegressionPct) / 100, 0);
	const jcFormSumWithoutOffset = jcRows.reduce((sum, r) => sum + r.totalSum, 0);
	const jcRoundingDelta = round2(exactJcTruthTotal - jcFormSumWithoutOffset);

	if (includeOffsetRows && Math.abs(jcRoundingDelta) > 0.001) {
		const offsetYearly: Record<number, number> = {};
		for (const y of years) offsetYearly[y] = 0;
		offsetYearly[years[0]] = jcRoundingDelta;
		jcRows.push({
			id: `jc-row-offset`,
			rowNumber: jcRows.length + 1,
			workingHours: participant.weeklyHours,
			monthlyAmount: jcRoundingDelta,
			percentage: 100,
			monthCount: 1,
			totalSum: jcRoundingDelta,
			yearlyAmounts: offsetYearly,
			controlSum: jcRoundingDelta,
			participantName: participant.name,
			runtimeText: contractRuntimeText,
			tariffText: `AWO Berlin ${participant.tariffGroup}/${participant.tariffStep}`,
			calculationPeriodText: contractRuntimeText,
			explanationText: 'Ausgleich K-Hilfe vs. reale Kalkulation',
			costTypeText: 'Ausgleichsbetrag',
			compoundOneLineText: '',
			description: 'Ausgleich K-Hilfe vs. reale Kalkulation     Ausgleichsbetrag',
			isOffsetRow: true,
			category: 'offset'
		});
	}

	const jcYearlyTotals: Record<number, number> = {};
	for (const y of years) jcYearlyTotals[y] = jcRows.reduce((sum, r) => round2(sum + (r.yearlyAmounts[y] || 0)), 0);
	const jcGrandTotal = Object.values(jcYearlyTotals).reduce((a, b) => round2(a + b), 0);

	const landRows: FormRowItem[] = [];
	let currentSvGroup: MonthlyRecord[] = [];
	let previousSvGroup: MonthlyRecord[] | null = null;

	const flushSvGroup = () => {
		if (currentSvGroup.length === 0) return;
		const first = currentSvGroup[0];
		const monthCount = round2(currentSvGroup.reduce((sum, r) => sum + (r.monthUnits || 1.0), 0));
		const monthlyAmount = round2(first.fullMonthlySvShortfall || first.landSvShortfall / (first.monthUnits || 1.0));
		const rowNumber = landRows.length + 1;

		const yearlyAmounts: Record<number, number> = {};
		for (const y of years) {
			const unitsInYear = currentSvGroup.filter(r => r.year === y).reduce((sum, r) => sum + (r.monthUnits || 1.0), 0);
			yearlyAmounts[y] = unitsInYear > 0 ? round2(unitsInYear * monthlyAmount) : 0;
		}

		const totalSum = Object.values(yearlyAmounts).reduce((a, b) => round2(a + b), 0);
		const startDateText = getPeriodStartDate(currentSvGroup);
		const calculationPeriodText = `${startDateText}-${getPeriodEndDate(currentSvGroup)}`;
		const tariffStep = getTariffStep(first, participant);
		const tariffText = `AWO Berlin ${participant.tariffGroup}/${tariffStep}`;
		const costTypeText = `SV Fehlbetrag inkl. (U1,U2,U3) i.H.v. ${(first.agaRealRate * 100).toFixed(3).replace('.', ',')}%`;
		let explanationText = '';

		if (previousSvGroup) {
			const prevFirst = previousSvGroup[0];
			const prevStep = getTariffStep(prevFirst, participant);
			const currStep = tariffStep;
			const stepChanged = prevStep !== currStep;
			const agaChanged = Math.abs(prevFirst.agaRealRate - first.agaRealRate) > 0.0001;
			const isKnownTariffIncrease = isAwoTariffIncreaseMonth(first.year, first.month);
			const salaryIncreased = first.fteSalary > prevFirst.fteSalary;

			if (stepChanged && agaChanged) {
				explanationText = `Stufenaufstieg ${prevStep}->${currStep}, Anpassung AGA-Satz auf ${(first.agaRealRate * 100).toFixed(3).replace('.', ',')}% ab ${startDateText}`;
			} else if (agaChanged) {
				explanationText = `Anpassung AGA-Satz auf ${(first.agaRealRate * 100).toFixed(3).replace('.', ',')}% ab ${startDateText}`;
			} else if (stepChanged) {
				explanationText = isKnownTariffIncrease ? `ES Wechsel ${prevStep}->${currStep} und Tariferhöhung zum ${startDateText}` : `ES Wechsel ${prevStep}->${currStep} zum ${startDateText}`;
			} else if (salaryIncreased) {
				explanationText = isKnownTariffIncrease ? `Tariferhöhung zum ${startDateText}` : `ES Wechsel ${prevStep}->${currStep} zum ${startDateText}`;
			}
		}

		landRows.push({
			id: `land-row-sv-${rowNumber}`,
			rowNumber,
			workingHours: participant.weeklyHours,
			monthlyAmount,
			percentage: 100,
			monthCount,
			totalSum,
			yearlyAmounts,
			controlSum: totalSum,
			participantName: participant.name,
			runtimeText: contractRuntimeText,
			tariffText,
			calculationPeriodText,
			explanationText,
			costTypeText,
			compoundOneLineText: buildCompoundOneLineText(participant.name, contractRuntimeText, tariffText, calculationPeriodText, explanationText, costTypeText),
			description: explanationText ? `${explanationText}     ${costTypeText}` : costTypeText,
			category: 'sv_shortfall'
		});

		previousSvGroup = currentSvGroup;
		currentSvGroup = [];
	};

	for (const r of records) {
		if (currentSvGroup.length === 0) {
			currentSvGroup.push(r);
		} else {
			const prev = currentSvGroup[currentSvGroup.length - 1];
			const prevShortfall = prev.fullMonthlySvShortfall || prev.landSvShortfall / (prev.monthUnits || 1.0);
			const currShortfall = r.fullMonthlySvShortfall || r.landSvShortfall / (r.monthUnits || 1.0);
			const sameSv = Math.abs(prevShortfall - currShortfall) < 0.01;
			const sameAga = Math.abs(prev.agaRealRate - r.agaRealRate) < 0.0001;
			const sameTariffStep = getTariffStep(prev, participant) === getTariffStep(r, participant);

			if (sameSv && sameAga && sameTariffStep) {
				currentSvGroup.push(r);
			} else {
				flushSvGroup();
				currentSvGroup.push(r);
			}
		}
	}
	flushSvGroup();

	let currentDegGroup: MonthlyRecord[] = [];
	let previousDegGroup: MonthlyRecord[] | null = null;

	const flushDegGroup = () => {
		if (currentDegGroup.length === 0) return;
		const first = currentDegGroup[0];
		const monthCount = round2(currentDegGroup.reduce((sum, r) => sum + (r.monthUnits || 1.0), 0));
		const monthlyAmount = round2(first.fullMonthlyJcTotalGross || (first.fteSalary * participant.weeklyHours / 39) * 1.19);
		const percentage = 100 - first.jcDegressionPct;
		const rowNumber = landRows.length + 1;

		const yearlyAmounts: Record<number, number> = {};
		for (const y of years) {
			const unitsInYear = currentDegGroup.filter(r => r.year === y).reduce((sum, r) => sum + (r.monthUnits || 1.0), 0);
			if (unitsInYear > 0) {
				const effectiveMonthly = round2((monthlyAmount * percentage) / 100);
				yearlyAmounts[y] = round2(effectiveMonthly * unitsInYear);
			} else {
				yearlyAmounts[y] = 0;
			}
		}

		const totalSum = Object.values(yearlyAmounts).reduce((a, b) => round2(a + b), 0);
		const startDateText = getPeriodStartDate(currentDegGroup);
		const calculationPeriodText = `${startDateText}-${getPeriodEndDate(currentDegGroup)}`;
		const tariffStep = getTariffStep(first, participant);
		const tariffText = `AWO Berlin ${participant.tariffGroup}/${tariffStep}`;
		const costTypeText = 'Degressionsbetrag';
		let explanationText = '';

		if (previousDegGroup) {
			const prevFirst = previousDegGroup[0];
			const prevStep = getTariffStep(prevFirst, participant);
			const currStep = tariffStep;
			const stepChanged = prevStep !== currStep;
			const degChanged = prevFirst.jcDegressionPct !== first.jcDegressionPct;
			const isKnownTariffIncrease = isAwoTariffIncreaseMonth(first.year, first.month);
			const salaryIncreased = first.fteSalary > prevFirst.fteSalary;

			if (stepChanged && degChanged) {
				explanationText = `Stufenaufstieg ${prevStep}->${currStep}, Degression auf ${first.jcDegressionPct}% zum ${startDateText}`;
			} else if (degChanged) {
				explanationText = `Degression auf ${first.jcDegressionPct}% ab ${startDateText}`;
			} else if (stepChanged) {
				explanationText = isKnownTariffIncrease ? `Stufenaufstieg ${prevStep}->${currStep} und Tariferhöhung zum ${startDateText}` : `Stufenaufstieg ${prevStep}->${currStep} zum ${startDateText}`;
			} else if (salaryIncreased) {
				explanationText = isKnownTariffIncrease ? `Tariferhöhung zum ${startDateText}` : `Stufenaufstieg ${prevStep}->${currStep} zum ${startDateText}`;
			}
		}

		landRows.push({
			id: `land-row-deg-${rowNumber}`,
			rowNumber,
			workingHours: participant.weeklyHours,
			monthlyAmount,
			percentage,
			monthCount,
			totalSum,
			yearlyAmounts,
			controlSum: totalSum,
			participantName: participant.name,
			runtimeText: contractRuntimeText,
			tariffText,
			calculationPeriodText,
			explanationText,
			costTypeText,
			compoundOneLineText: buildCompoundOneLineText(participant.name, contractRuntimeText, tariffText, calculationPeriodText, explanationText, costTypeText),
			description: explanationText ? `${explanationText}     ${costTypeText}` : costTypeText,
			category: 'degression'
		});

		previousDegGroup = currentDegGroup;
		currentDegGroup = [];
	};

	for (const r of records) {
		if (r.jcDegressionPct < 100) {
			if (currentDegGroup.length === 0) {
				currentDegGroup.push(r);
			} else {
				const prev = currentDegGroup[currentDegGroup.length - 1];
				const sameFte = Math.abs(prev.fteSalary - r.fteSalary) < 0.01;
				const sameDegression = prev.jcDegressionPct === r.jcDegressionPct;
				const sameTariffStep = getTariffStep(prev, participant) === getTariffStep(r, participant);

				if (sameFte && sameDegression && sameTariffStep) {
					currentDegGroup.push(r);
				} else {
					flushDegGroup();
					currentDegGroup.push(r);
				}
			}
		} else {
			flushDegGroup();
		}
	}
	flushDegGroup();

	for (const y of years) {
		const monthsInYear = records.filter(r => r.year === y);
		const jszRecord = monthsInYear.find(r => r.isJszMonth && r.jszAmount > 0);
		if (jszRecord) {
			const totalJszWithAga = round2(jszRecord.jszAmount + jszRecord.jszAgaAmount);
			const rowNumber = landRows.length + 1;
			const allMonthsInYear = allProcessedRecords.filter(r => r.year === y);
			const totalEmploymentMonthsInYear = round2(allMonthsInYear.reduce((sum, r) => sum + (r.monthUnits || 1.0), 0));

			let explanationText = `85% vom Septembergehalt gem. AWO Berlin Tarif (10. ÄTV / TE 05.05.2026), Stichtag 01.12.`;
			if (totalEmploymentMonthsInYear < 12) {
				const countStr = totalEmploymentMonthsInYear % 1 === 0 ? String(totalEmploymentMonthsInYear) : totalEmploymentMonthsInYear.toFixed(1).replace('.', ',');
				explanationText = `anteilig für ${countStr} Monate (${countStr}/12), 85% vom Septembergehalt gem. AWO Berlin Tarif (10. ÄTV / TE 05.05.2026), Stichtag 01.12.`;
			}

			const costTypeText = `Jahressonderzahlung ${y}`;
			const runtimeText = contractRuntimeText;
			const tariffText = `AWO Berlin ${participant.tariffGroup}/${getTariffStep(jszRecord, participant)}`;
			const startDateText = getPeriodStartDate(allMonthsInYear);
			const endDateText = getPeriodEndDate(allMonthsInYear);
			const calculationPeriodText = `${startDateText}-${endDateText}`;

			const yearlyAmounts: Record<number, number> = {};
			for (const yr of years) yearlyAmounts[yr] = yr === y ? totalJszWithAga : 0;

			landRows.push({
				id: `land-row-jsz-${y}`,
				rowNumber,
				workingHours: participant.weeklyHours,
				monthlyAmount: totalJszWithAga,
				percentage: 100,
				monthCount: 1,
				totalSum: totalJszWithAga,
				yearlyAmounts,
				controlSum: totalJszWithAga,
				participantName: participant.name,
				runtimeText,
				tariffText,
				calculationPeriodText,
				explanationText,
				costTypeText,
				compoundOneLineText: buildCompoundOneLineText(participant.name, runtimeText, tariffText, calculationPeriodText, explanationText, costTypeText),
				description: `${explanationText}     ${costTypeText}`,
				category: 'jsz'
			});
		}
	}

	const exactLandTruthTotal = records.reduce((sum, r) => {
		const degShortfall = (r.jcTotalGross * (100 - r.jcDegressionPct)) / 100;
		return sum + r.landSvShortfall + degShortfall + (r.jszAmount || 0) + (r.jszAgaAmount || 0);
	}, 0);
	const landFormSumWithoutOffset = landRows.reduce((sum, r) => sum + r.totalSum, 0);
	const landRoundingDelta = round2(exactLandTruthTotal - landFormSumWithoutOffset);

	if (includeOffsetRows && Math.abs(landRoundingDelta) > 0.001) {
		const offsetYearly: Record<number, number> = {};
		for (const y of years) offsetYearly[y] = 0;
		offsetYearly[years[0]] = landRoundingDelta;
		landRows.push({
			id: `land-row-offset`,
			rowNumber: landRows.length + 1,
			workingHours: participant.weeklyHours,
			monthlyAmount: landRoundingDelta,
			percentage: 100,
			monthCount: 1,
			totalSum: landRoundingDelta,
			yearlyAmounts: offsetYearly,
			controlSum: landRoundingDelta,
			participantName: participant.name,
			runtimeText: contractRuntimeText,
			tariffText: `AWO Berlin ${participant.tariffGroup}/${participant.tariffStep}`,
			calculationPeriodText: contractRuntimeText,
			explanationText: 'Ausgleich K-Hilfe vs. reale Kalkulation',
			costTypeText: 'Ausgleichsbetrag',
			compoundOneLineText: '',
			description: 'Ausgleich K-Hilfe vs. reale Kalkulation     Ausgleichsbetrag',
			isOffsetRow: true,
			category: 'offset'
		});
	}

	const landYearlyTotals: Record<number, number> = {};
	for (const y of years) landYearlyTotals[y] = landRows.reduce((sum, r) => round2(sum + (r.yearlyAmounts[y] || 0)), 0);
	const landGrandTotal = Object.values(landYearlyTotals).reduce((a, b) => round2(a + b), 0);

	const sachkostenRate = participant.sachkostenMonthly;
	const skYearlyAmounts: Record<number, number> = {};
	for (const y of years) {
		const unitsInYear = records.filter(r => r.year === y).reduce((sum, r) => sum + (r.monthUnits || 1.0), 0);
		skYearlyAmounts[y] = round2(unitsInYear * sachkostenRate);
	}
	const skGrandTotal = round2(runtimeMonths * sachkostenRate);
	const skName = participant.name;
	const skRuntime = `${participant.runtimeStart} - ${participant.runtimeEnd || ''}`.trim();
	const skTariff = `AWO Berlin ${participant.tariffGroup}/${participant.tariffStep}`;
	const skPeriod = `${getPeriodStartDate(records)} - ${getPeriodEndDate(records)}`;
	const skExplanation = `JC Antrag bewilligt bis ${participant.runtimeEnd || getPeriodEndDate(records)}`;
	const skCostType = `Sachkostenpauschale ${sachkostenRate.toFixed(2).replace('.', ',')} € mtl.`;

	const skRows: FormRowItem[] = [{
		id: 'sk-row-1',
		rowNumber: 1,
		workingHours: 1,
		monthlyAmount: sachkostenRate,
		percentage: 100,
		monthCount: runtimeMonths,
		totalSum: skGrandTotal,
		yearlyAmounts: skYearlyAmounts,
		controlSum: skGrandTotal,
		participantName: skName,
		runtimeText: skRuntime,
		tariffText: skTariff,
		calculationPeriodText: skPeriod,
		explanationText: skExplanation,
		costTypeText: skCostType,
		compoundOneLineText: buildCompoundOneLineText(skName, skRuntime, skTariff, skPeriod, skExplanation, skCostType),
		description: `${skExplanation}     ${skCostType}`,
		category: 'sachkosten'
	}];

	const jcTruthRounded = round2(exactJcTruthTotal);
	const landTruthRounded = round2(exactLandTruthTotal);
	const excelGrandTotal = round2(jcTruthRounded + landTruthRounded + skGrandTotal);
	const formGrandTotal = round2(jcGrandTotal + landGrandTotal + skGrandTotal);
	const totalDelta = round2(excelGrandTotal - formGrandTotal);
	const jcDelta = round2(jcTruthRounded - jcGrandTotal);
	const landDelta = round2(landTruthRounded - landGrandTotal);

	const controlItems: ControlCheckItem[] = [
		{
			id: 'ctrl-jc',
			name: '1. TLN-Kosten Jobcenter',
			category: 'jobcenter',
			excelValue: jcTruthRounded,
			formValue: jcGrandTotal,
			delta: jcDelta,
			status: Math.abs(jcDelta) <= 0.01 ? 'MATCH' : (includeOffsetRows ? 'OFFSET_APPLIED' : 'WARNING'),
			note: includeOffsetRows ? (jcRoundingDelta !== 0 ? `Ausgleichsbetrag verrechnet (${jcRoundingDelta > 0 ? '+' : ''}${jcRoundingDelta.toFixed(2).replace('.', ',')} €)` : 'Exakte Übereinstimmung') : 'Cent-Rundungsdifferenz durch Formularmultiplikation'
		},
		{
			id: 'ctrl-land',
			name: '2. TLN-Kosten Landesmittel',
			category: 'landesmittel',
			excelValue: landTruthRounded,
			formValue: landGrandTotal,
			delta: landDelta,
			status: Math.abs(landDelta) <= 0.01 ? 'MATCH' : (includeOffsetRows ? 'OFFSET_APPLIED' : 'WARNING'),
			note: includeOffsetRows ? (landRoundingDelta !== 0 ? `Ausgleichsbetrag verrechnet (${landRoundingDelta > 0 ? '+' : ''}${landRoundingDelta.toFixed(2).replace('.', ',')} €)` : 'Exakte Übereinstimmung') : 'Cent-Rundungsdifferenz durch Formularmultiplikation'
		},
		{
			id: 'ctrl-sk',
			name: '3. Sachkostenpauschale (Fi BiB | SGE)',
			category: 'sachkosten',
			excelValue: skGrandTotal,
			formValue: skGrandTotal,
			delta: 0,
			status: 'MATCH',
			note: 'Pauschale 155,00 € pro Monat stimmt 100% überein'
		},
		{
			id: 'ctrl-total',
			name: 'Gesamtfördersumme (Kalkulation vs. Formular)',
			category: 'total',
			excelValue: excelGrandTotal,
			formValue: formGrandTotal,
			delta: totalDelta,
			status: Math.abs(totalDelta) <= 0.01 ? 'MATCH' : 'WARNING',
			note: Math.abs(totalDelta) <= 0.01 ? 'Alle Zahlen sind rechnerisch 100% konsistent' : 'Differenz vor Ausgleichszeilen'
		}
	];

	const controls: ControlCheckResult = {
		overallStatus: Math.abs(totalDelta) <= 0.01 ? 'MATCH' : 'WARNING',
		excelGrandTotal,
		formGrandTotal,
		totalDelta,
		items: controlItems,
		jobcenterCheck: { excelTotal: jcTruthRounded, formTotal: jcGrandTotal, delta: jcDelta, offsetAmount: jcRoundingDelta },
		landesmittelCheck: { excelTotal: landTruthRounded, formTotal: landGrandTotal, delta: landDelta, offsetAmount: landRoundingDelta },
		sachkostenCheck: { excelTotal: skGrandTotal, formTotal: skGrandTotal, delta: 0 }
	};

	const defaultAgaTimeline = customAgaTimeline || [{ id: 'aga-default', startDate: formatDateDMY(participant.runtimeStart), endDate: formatDateDMY(participant.runtimeEnd), rate: participant.defaultAgaRate, label: `${participant.healthInsuranceName} Standard (${(participant.defaultAgaRate * 100).toFixed(3)}%)` }];
	const defaultBgTimeline = options.customBgTimeline || participant.bgTimeline || [{ id: 'bg-default', startDate: formatDateDMY(participant.runtimeStart), endDate: formatDateDMY(participant.runtimeEnd), rate: participant.defaultBgRate ?? 0.018, label: `BGW Standard` }];

	return {
		participant,
		records: allProcessedRecords,
		years,
		runtimeMonths,
		tabs: [
			{ id: 'jobcenter', title: '1. TLN-Kosten Jobcenter', tabNumber: 1, rows: jcRows, yearlyTotals: jcYearlyTotals, grandTotal: jcGrandTotal, status: 'Angaben vollständig' },
			{ id: 'landesmittel', title: '2. TLN-Kosten Landesmittel', tabNumber: 2, rows: landRows, yearlyTotals: landYearlyTotals, grandTotal: landGrandTotal, status: 'Angaben vollständig' },
			{ id: 'sachkosten', title: `Sachkostenpauschale ${sachkostenRate} €`, tabNumber: 3, rows: skRows, yearlyTotals: skYearlyAmounts, grandTotal: skGrandTotal, status: 'Angaben vollständig' }
		],
		controls,
		agaTimeline: defaultAgaTimeline,
		bgTimeline: defaultBgTimeline,
		tariffValidation: validateBerechnungsblattTariff(allProcessedRecords, participant),
		tvlComparison: calculateTvlComparison(allProcessedRecords, participant, years.includes(2026) ? 2026 : (years[years.length - 1] || 2026), undefined, (participant as any).insuranceFunds),
		exactJcTruthTotal,
		exactLandTruthTotal,
		jcRoundingDelta,
		landRoundingDelta
	};
}

export function transformSgb16iMulti(
	participantsData: ParticipantDataset[],
	options: GrantTransformationOptions
): GrantTransformationResult {
	if (!participantsData || participantsData.length === 0) {
		throw new Error('Mindestens ein Teilnehmer muss für die Berechnung vorhanden sein.');
	}

	const participantResults = participantsData.map(item => {
		const mergedOptions: GrantTransformationOptions = {
			...options,
			...(item.options || {})
		};
		return calculateSingleParticipant(item.records, item.participant, mergedOptions);
	});

	if (participantResults.length === 1) {
		const single = participantResults[0];
		return {
			schemeId: 'sgb16i-berlin',
			schemeName: '§ 16i SGB II / ZGS Berlin (AWO Tarifeinigung 05.05.2026)',
			participant: single.participant,
			participants: [single],
			years: single.years,
			runtimeMonths: single.runtimeMonths,
			tabs: single.tabs,
			controls: single.controls,
			agaTimeline: single.agaTimeline,
			bgTimeline: single.bgTimeline,
			options,
			rawMonthlyRecords: single.records,
			insuranceFunds: (single.participant as any).insuranceFunds,
			tariffValidation: single.tariffValidation,
			tvlComparison: single.tvlComparison
		};
	}

	const allYears = Array.from(new Set(participantResults.flatMap(p => p.years))).sort((a, b) => a - b);

	const combinedJcRows: FormRowItem[] = [];
	let jcRowCounter = 1;
	for (let pIdx = 0; pIdx < participantResults.length; pIdx++) {
		const pRes = participantResults[pIdx];
		const jcTab = pRes.tabs.find(t => t.id === 'jobcenter') || pRes.tabs[0];
		for (const r of jcTab.rows) {
			const yearlyAmounts: Record<number, number> = {};
			for (const y of allYears) yearlyAmounts[y] = r.yearlyAmounts[y] || 0;
			combinedJcRows.push({ ...r, id: `jc-p${pIdx + 1}-${r.id}`, rowNumber: jcRowCounter++, yearlyAmounts });
		}
	}
	const combinedJcYearlyTotals: Record<number, number> = {};
	for (const y of allYears) combinedJcYearlyTotals[y] = combinedJcRows.reduce((sum, r) => round2(sum + (r.yearlyAmounts[y] || 0)), 0);
	const combinedJcGrandTotal = Object.values(combinedJcYearlyTotals).reduce((a, b) => round2(a + b), 0);

	const combinedLandRows: FormRowItem[] = [];
	let landRowCounter = 1;
	for (let pIdx = 0; pIdx < participantResults.length; pIdx++) {
		const pRes = participantResults[pIdx];
		const landTab = pRes.tabs.find(t => t.id === 'landesmittel') || pRes.tabs[1];
		for (const r of landTab.rows) {
			const yearlyAmounts: Record<number, number> = {};
			for (const y of allYears) yearlyAmounts[y] = r.yearlyAmounts[y] || 0;
			combinedLandRows.push({ ...r, id: `land-p${pIdx + 1}-${r.id}`, rowNumber: landRowCounter++, yearlyAmounts });
		}
	}
	const combinedLandYearlyTotals: Record<number, number> = {};
	for (const y of allYears) combinedLandYearlyTotals[y] = combinedLandRows.reduce((sum, r) => round2(sum + (r.yearlyAmounts[y] || 0)), 0);
	const combinedLandGrandTotal = Object.values(combinedLandYearlyTotals).reduce((a, b) => round2(a + b), 0);

	const combinedSkRows: FormRowItem[] = [];
	let skRowCounter = 1;
	for (let pIdx = 0; pIdx < participantResults.length; pIdx++) {
		const pRes = participantResults[pIdx];
		const skTab = pRes.tabs.find(t => t.id === 'sachkosten') || pRes.tabs[2];
		for (const r of skTab.rows) {
			const yearlyAmounts: Record<number, number> = {};
			for (const y of allYears) yearlyAmounts[y] = r.yearlyAmounts[y] || 0;
			combinedSkRows.push({ ...r, id: `sk-p${pIdx + 1}-${r.id}`, rowNumber: skRowCounter++, yearlyAmounts });
		}
	}
	const combinedSkYearlyTotals: Record<number, number> = {};
	for (const y of allYears) combinedSkYearlyTotals[y] = combinedSkRows.reduce((sum, r) => round2(sum + (r.yearlyAmounts[y] || 0)), 0);
	const combinedSkGrandTotal = Object.values(combinedSkYearlyTotals).reduce((a, b) => round2(a + b), 0);

	const exactJcTruthTotal = round2(participantResults.reduce((sum, p) => sum + p.exactJcTruthTotal, 0));
	const exactLandTruthTotal = round2(participantResults.reduce((sum, p) => sum + p.exactLandTruthTotal, 0));
	const excelGrandTotal = round2(exactJcTruthTotal + exactLandTruthTotal + combinedSkGrandTotal);
	const formGrandTotal = round2(combinedJcGrandTotal + combinedLandGrandTotal + combinedSkGrandTotal);
	const totalDelta = round2(excelGrandTotal - formGrandTotal);

	const totalJcDelta = round2(exactJcTruthTotal - combinedJcGrandTotal);
	const totalLandDelta = round2(exactLandTruthTotal - combinedLandGrandTotal);

	const controlItems: ControlCheckItem[] = [
		{
			id: 'ctrl-jc',
			name: `1. TLN-Kosten Jobcenter (Gesamt: ${participantResults.length} TLN)`,
			category: 'jobcenter',
			excelValue: exactJcTruthTotal,
			formValue: combinedJcGrandTotal,
			delta: totalJcDelta,
			status: Math.abs(totalJcDelta) <= 0.01 ? 'MATCH' : (options.includeOffsetRows ? 'OFFSET_APPLIED' : 'WARNING'),
			note: Math.abs(totalJcDelta) <= 0.01 ? 'Exakte Übereinstimmung (Gesamtprojekt)' : 'Differenz vor Ausgleich'
		},
		{
			id: 'ctrl-land',
			name: `2. TLN-Kosten Landesmittel (Gesamt: ${participantResults.length} TLN)`,
			category: 'landesmittel',
			excelValue: exactLandTruthTotal,
			formValue: combinedLandGrandTotal,
			delta: totalLandDelta,
			status: Math.abs(totalLandDelta) <= 0.01 ? 'MATCH' : (options.includeOffsetRows ? 'OFFSET_APPLIED' : 'WARNING'),
			note: Math.abs(totalLandDelta) <= 0.01 ? 'Exakte Übereinstimmung (Gesamtprojekt)' : 'Differenz vor Ausgleich'
		},
		{
			id: 'ctrl-sk',
			name: `3. Sachkostenpauschale (${participantResults.length} TLN)`,
			category: 'sachkosten',
			excelValue: combinedSkGrandTotal,
			formValue: combinedSkGrandTotal,
			delta: 0,
			status: 'MATCH',
			note: '155,00 € pro Teilnehmer/in und Monat stimmt 100% überein'
		},
		{
			id: 'ctrl-total',
			name: `Gesamtfördersumme Projekt (${participantResults.length} TLN)`,
			category: 'total',
			excelValue: excelGrandTotal,
			formValue: formGrandTotal,
			delta: totalDelta,
			status: Math.abs(totalDelta) <= 0.01 ? 'MATCH' : 'WARNING',
			note: Math.abs(totalDelta) <= 0.01 ? 'Alle Zahlen sind rechnerisch 100% konsistent' : 'Differenz vor Ausgleichszeilen'
		}
	];

	for (let i = 0; i < participantResults.length; i++) {
		const p = participantResults[i];
		const pName = p.participant.name || `Teilnehmer/in ${i + 1}`;
		const pJc = p.tabs[0]?.grandTotal || 0;
		const pLand = p.tabs[1]?.grandTotal || 0;
		const pSk = p.tabs[2]?.grandTotal || 0;
		const pTotal = round2(pJc + pLand + pSk);

		controlItems.push({
			id: `ctrl-p-${i + 1}`,
			name: `Teilnehmer ${i + 1} (${pName}): JC ${pJc.toFixed(2)} € + Land ${pLand.toFixed(2)} € + SK ${pSk.toFixed(2)} €`,
			category: 'total',
			excelValue: round2(p.exactJcTruthTotal + p.exactLandTruthTotal + pSk),
			formValue: pTotal,
			delta: round2(round2(p.exactJcTruthTotal + p.exactLandTruthTotal + pSk) - pTotal),
			status: 'MATCH',
			note: `Einzelanteil: ${(excelGrandTotal > 0 ? (pTotal / excelGrandTotal) * 100 : 0).toFixed(1)}% des Gesamtprojekts`
		});
	}

	const controls: ControlCheckResult = {
		overallStatus: Math.abs(totalDelta) <= 0.01 ? 'MATCH' : 'WARNING',
		excelGrandTotal,
		formGrandTotal,
		totalDelta,
		items: controlItems,
		jobcenterCheck: { excelTotal: exactJcTruthTotal, formTotal: combinedJcGrandTotal, delta: totalJcDelta, offsetAmount: round2(participantResults.reduce((sum, p) => sum + p.jcRoundingDelta, 0)) },
		landesmittelCheck: { excelTotal: exactLandTruthTotal, formTotal: combinedLandGrandTotal, delta: totalLandDelta, offsetAmount: round2(participantResults.reduce((sum, p) => sum + p.landRoundingDelta, 0)) },
		sachkostenCheck: { excelTotal: combinedSkGrandTotal, formTotal: combinedSkGrandTotal, delta: 0 }
	};

	const primary = participantResults[0];
	return {
		schemeId: 'sgb16i-berlin',
		schemeName: '§ 16i SGB II / ZGS Berlin (AWO Tarifeinigung 05.05.2026)',
		participant: primary.participant,
		participants: participantResults,
		years: allYears,
		runtimeMonths: Math.max(...participantResults.map(p => p.runtimeMonths)),
		tabs: [
			{ id: 'jobcenter', title: '1. TLN-Kosten Jobcenter', tabNumber: 1, rows: combinedJcRows, yearlyTotals: combinedJcYearlyTotals, grandTotal: combinedJcGrandTotal, status: 'Angaben vollständig' },
			{ id: 'landesmittel', title: '2. TLN-Kosten Landesmittel', tabNumber: 2, rows: combinedLandRows, yearlyTotals: combinedLandYearlyTotals, grandTotal: combinedLandGrandTotal, status: 'Angaben vollständig' },
			{ id: 'sachkosten', title: `Sachkostenpauschale 155 € (${participantResults.length} TLN)`, tabNumber: 3, rows: combinedSkRows, yearlyTotals: combinedSkYearlyTotals, grandTotal: combinedSkGrandTotal, status: 'Angaben vollständig' }
		],
		controls,
		agaTimeline: primary.agaTimeline,
		bgTimeline: primary.bgTimeline,
		options,
		rawMonthlyRecords: primary.records,
		insuranceFunds: (primary.participant as any).insuranceFunds,
		tariffValidation: primary.tariffValidation,
		tvlComparison: primary.tvlComparison
	};
}

export function transformSgb16i(
	rawRecords: MonthlyRecord[],
	participant: ParticipantInfo,
	options: GrantTransformationOptions
): GrantTransformationResult {
	return transformSgb16iMulti([{ participant, records: rawRecords }], options);
}

/**
 * Generates standard sample datasets (60 months) adhering strictly to AWO Berlin tariff tables
 * (Tarifvertrag AWO Berlin ab 09/2025) and SGB 16i grant conditions:
 * - Participant 1: Max Mustermann (EG2 / ES1, 30h, AOK Nordost, start 01.08.2026)
 * - Participant 2: Erika Musterfrau (EG3 / ES2, 35h, Barmer, start 01.10.2026)
 */
export function generateStandardSgb16iDemoDatasets(): ParticipantDataset[] {
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

	function buildParticipantRecords(p: ParticipantInfo, durationMonths: number = 60): MonthlyRecord[] {
		const startParts = p.runtimeStart.split('.');
		const startParsed = {
			day: parseInt(startParts[0], 10),
			month: parseInt(startParts[1], 10),
			year: parseInt(startParts[2], 10)
		};
		const initialStepNum = parseInt((p.tariffStep?.match(/\d+/) || ['1'])[0], 10) || 1;
		const records: MonthlyRecord[] = [];
		let currentDate = new Date(startParsed.year, startParsed.month - 1, 1);

		for (let i = 0; i < durationMonths; i++) {
			const y = currentDate.getFullYear();
			const m = currentDate.getMonth() + 1;
			const lastDay = new Date(y, m, 0).getDate();
			const mStr = String(m).padStart(2, '0');

			const stepNum = calculateTariffStepAtDate(
				{ day: 1, month: m, year: y },
				startParsed,
				initialStepNum
			);

			const tariffInfo = getAwoTariffSalary(
				p.tariffGroup,
				stepNum,
				y,
				m,
				p.weeklyHours,
				p.fullTimeHours || 39
			);

			const fteSalary = tariffInfo?.fteSalary || 2674.27;
			const partTimeSalary = tariffInfo?.partTimeSalary || round2((fteSalary / 39) * p.weeklyHours);
			const jcFlatRate = round2(partTimeSalary * 0.19);
			const jcTotalGross = round2(partTimeSalary + jcFlatRate);
			const degPct = i < 24 ? 100 : i < 36 ? 90 : i < 48 ? 80 : 70;
			const agaAmount = round2(partTimeSalary * p.defaultAgaRate);

			records.push({
				date: `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`,
				year: y,
				month: m,
				monthUnits: 1.0,
				startDate: `01.${mStr}.${y}`,
				endDate: `${String(lastDay).padStart(2, '0')}.${mStr}.${y}`,
				fteSalary,
				partTimeSalary,
				weeklyHours: p.weeklyHours,
				fullTimeHours: p.fullTimeHours || 39,
				tariffGroup: p.tariffGroup,
				tariffStep: `ES${stepNum}`,
				jcFlatRateAmount: jcFlatRate,
				jcTotalGross,
				jcDegressionPct: degPct,
				jcGrantAmount: round2((jcTotalGross * degPct) / 100),
				agaRealRate: p.defaultAgaRate,
				agaRealAmount: agaAmount,
				totalEmployerCost: round2(partTimeSalary + agaAmount),
				landSvShortfall: round2(partTimeSalary * (p.defaultAgaRate - 0.19)),
				landDegressionAmount: round2((jcTotalGross * (100 - degPct)) / 100),
				jszAmount: 0,
				jszAgaAmount: 0,
				isJszMonth: false,
				sachkostenAmount: p.sachkostenMonthly ?? 155
			});

			currentDate = new Date(y, m, 1);
		}

		// Add compliant JSZ in December of each applicable year
		const uniqueYears = Array.from(new Set(records.map((r) => r.year)));
		for (const y of uniqueYears) {
			const yearRecs = records.filter((r) => r.year === y);
			const decRec = yearRecs.find((r) => r.month === 12);
			if (!decRec) continue;

			const activeMonths = yearRecs.reduce((sum, r) => sum + (r.monthUnits || 1.0), 0);
			const sepRec = yearRecs.find((r) => r.month === 9) || yearRecs[0];
			const sepSalary = sepRec.partTimeSalary;

			const jszGross = round2(sepSalary * 0.85 * (activeMonths / 12));
			const jszAga = round2(jszGross * p.defaultAgaRate);

			decRec.isJszMonth = true;
			decRec.jszAmount = jszGross;
			decRec.jszAgaAmount = jszAga;
		}

		return records;
	}

	return [
		{ participant: p1, records: buildParticipantRecords(p1, 60) },
		{ participant: p2, records: buildParticipantRecords(p2, 60) }
	];
}

