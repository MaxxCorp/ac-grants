import type {
	MonthlyRecord,
	ParticipantInfo,
	GrantTransformationOptions,
	GrantTransformationResult,
	FormTabDefinition,
	FormRowItem,
	ControlCheckResult,
	ControlCheckItem,
	AgaRatePeriod,
	RuntimeScope,
	RuntimeStartScope
} from '#lib/types/grant';
import { calculateTvlComparison } from './tvl-comparison';
import { validateBerechnungsblattTariff, calculateTariffStepAtDate, determineParticipantStepForRecord, isAwoTariffIncreaseMonth } from './awo-tariff-data';

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

export function transformSgb16i(
	rawRecords: MonthlyRecord[],
	participant: ParticipantInfo,
	options: GrantTransformationOptions
): GrantTransformationResult {
	const { includeOffsetRows, restrictToYear, customAgaTimeline } = options;
	const runtimeScope: RuntimeScope =
		options.runtimeScope || (options.restrictToExitDate === false ? 'full_5_years' : 'exit_date');
	const runtimeStartScope: RuntimeStartScope =
		options.runtimeStartScope || (options.customStartDate ? 'custom' : 'contract_start');

	// Ensure dataset covers requested scope if synthetic projection is needed
	const extendedRaw = ensureRecordsSpanScope(rawRecords, participant, runtimeScope, options.customEndDate);

	// Apply custom AGA rates, calculate full unscaled and scaled monthly amounts
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

		// Recompute JSZ if applicable
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

	// Filter active records according to selected runtime scope and start date
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
	} else if (options.restrictToYear && options.restrictToYear > 0) {
		const yr = options.restrictToYear;
		records = records.filter(r => r.year <= yr);
	}
	// 'full_5_years' uses all records (which spans up to 60 months)

	// Dynamically clip boundaries (first and last month) to effectiveStartDate and effectiveEndDate
	records = records.map(r => clipRecordDateRange(r, effectiveStartDate, effectiveEndDate, participant.sachkostenMonthly));

	// In the ZGS form, the contract runtime in Cell F2 is the fixed Laufzeit for individual lines
	const contractRuntimeText = participant.runtimeEnd
		? `${participant.runtimeStart}-${participant.runtimeEnd}`
		: (participant.runtimeStart || '');
	const contractRuntimeWithSpaces = participant.runtimeEnd
		? `${participant.runtimeStart} - ${participant.runtimeEnd}`
		: (participant.runtimeStart || '');

	const years = Array.from(new Set(records.map(r => r.year))).sort((a, b) => a - b);
	const runtimeMonths = round2(records.reduce((sum, r) => sum + (r.monthUnits || 1.0), 0));

	// ==========================================
	// TAB 1: 1. TLN-Kosten Jobcenter
	// ==========================================
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

		// Calculate yearly distribution
		const yearlyAmounts: Record<number, number> = {};
		for (const y of years) {
			const unitsInYear = currentJcGroup.filter(r => r.year === y).reduce((sum, r) => sum + (r.monthUnits || 1.0), 0);
			if (unitsInYear > 0) {
				const effectiveMonthly = round2((monthlyAmount * percentage) / 100);
				yearlyAmounts[y] = round2(effectiveMonthly * unitsInYear);
			} else {
				yearlyAmounts[y] = 0;
			}
		}

		const totalSum = Object.values(yearlyAmounts).reduce((a, b) => round2(a + b), 0);
		const startDateText = getPeriodStartDate(currentJcGroup);
		const endDateText = getPeriodEndDate(currentJcGroup);
		const calculationPeriodText = `${startDateText}-${endDateText}`;
		const tariffStep = getTariffStep(first, participant);
		const tariffText = `AWO Berlin ${participant.tariffGroup}/${tariffStep}`;
		const runtimeText = contractRuntimeText;

		// Detect reasons for Erläuterung only when needed (Tariferhöhung, Stufenaufstieg, Degression)
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
				if (isKnownTariffIncrease) {
					explanationText = `Stufenaufstieg ${prevStep}->${currStep} und Tariferhöhung zum ${startDateText}`;
				} else {
					explanationText = `Stufenaufstieg ${prevStep}->${currStep} zum ${startDateText}`;
				}
			} else if (salaryIncreased) {
				if (isKnownTariffIncrease) {
					if (first.year === 2026 && first.month === 9 && first.startDate?.startsWith('01.09.')) {
						explanationText = 'Tariferhöhung zum 01.09.2026 (% Erhöhung ist kleiner als Sockelbetrag)';
					} else {
						explanationText = `Tariferhöhung zum ${startDateText}`;
					}
				} else {
					explanationText = `Stufenaufstieg ${prevStep}->${currStep} zum ${startDateText}`;
				}
			}
		}

		// Composite one-line text containing the full row components with 5 spaces
		const compoundOneLineText = buildCompoundOneLineText(
			participant.name,
			runtimeText,
			tariffText,
			calculationPeriodText,
			explanationText,
			costTypeText
		);

		// Description field contains Erläuterung + Betragstyp (or just Betragstyp if explanation is empty)
		const description = explanationText ? `${explanationText}     ${costTypeText}` : costTypeText;

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
			compoundOneLineText,
			description,
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

	// Calculate exact unrounded Jobcenter sum from raw monthly records
	const exactJcTruthTotal = records.reduce((sum, r) => {
		const rawMonthlyGrant = (r.jcTotalGross * r.jcDegressionPct) / 100;
		return sum + rawMonthlyGrant;
	}, 0);

	const jcFormSumWithoutOffset = jcRows.reduce((sum, r) => sum + r.totalSum, 0);
	const jcRoundingDelta = round2(exactJcTruthTotal - jcFormSumWithoutOffset);

	// Add Jobcenter balancing row if requested and delta != 0
	if (includeOffsetRows && Math.abs(jcRoundingDelta) > 0.001) {
		const firstYear = years[0];
		const offsetYearly: Record<number, number> = {};
		for (const y of years) offsetYearly[y] = 0;
		offsetYearly[firstYear] = jcRoundingDelta;

		const runtimeText = contractRuntimeText;
		const tariffText = `AWO Berlin ${participant.tariffGroup}/${participant.tariffStep}`;
		const calculationPeriodText = contractRuntimeText;
		const explanationText = 'Ausgleich K-Hilfe vs. reale Kalkulation';
		const costTypeText = 'Ausgleichsbetrag';
		const compoundOneLineText = buildCompoundOneLineText(
			participant.name,
			runtimeText,
			tariffText,
			calculationPeriodText,
			explanationText,
			costTypeText
		);

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
			runtimeText,
			tariffText,
			calculationPeriodText,
			explanationText,
			costTypeText,
			compoundOneLineText,
			description: `${explanationText}     ${costTypeText}`,
			isOffsetRow: true,
			category: 'offset'
		});
	}

	const jcYearlyTotals: Record<number, number> = {};
	for (const y of years) {
		jcYearlyTotals[y] = jcRows.reduce((sum, r) => round2(sum + (r.yearlyAmounts[y] || 0)), 0);
	}
	const jcGrandTotal = Object.values(jcYearlyTotals).reduce((a, b) => round2(a + b), 0);

	const jcTab: FormTabDefinition = {
		id: 'jobcenter',
		title: '1. TLN-Kosten Jobcenter',
		tabNumber: 1,
		rows: jcRows,
		yearlyTotals: jcYearlyTotals,
		grandTotal: jcGrandTotal,
		status: 'Angaben vollständig'
	};

	// ==========================================
	// TAB 2: 2. TLN-Kosten Landesmittel
	// ==========================================
	const landRows: FormRowItem[] = [];

	// 1. SV Fehlbetrag Rows (grouped by full-monthly SV shortfall, AGA rate, and tariff step)
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
			yearlyAmounts[y] = unitsInYear > 0 ? round2(monthlyAmount * unitsInYear) : 0;
		}
		const totalSum = Object.values(yearlyAmounts).reduce((a, b) => round2(a + b), 0);
		const startDateText = getPeriodStartDate(currentSvGroup);
		const endDateText = getPeriodEndDate(currentSvGroup);
		const tariffStep = getTariffStep(first, participant);
		const tariffText = `AWO Berlin ${participant.tariffGroup}/${tariffStep}`;
		const runtimeText = contractRuntimeText;
		const calculationPeriodText = `${startDateText}-${endDateText}`;

		const agaPctStr = `${(first.agaRealRate * 100).toFixed(3).replace('.', ',')}%`;
		const costTypeText = `SV Fehlbetrag inkl. (U1,U2,U3) i.H.v. ${agaPctStr}`;
		let explanationText = '';

		if (previousSvGroup) {
			const prevFirst = previousSvGroup[0];
			const prevStep = getTariffStep(prevFirst, participant);
			const currStep = tariffStep;
			const stepChanged = prevStep !== currStep;
			const isKnownTariffIncrease = isAwoTariffIncreaseMonth(first.year, first.month);
			const salaryIncreased = first.fteSalary > prevFirst.fteSalary;

			if (stepChanged) {
				if (isKnownTariffIncrease) {
					explanationText = `ES Wechsel ${prevStep}->${currStep} und Tariferhöhung zum ${startDateText}`;
				} else {
					explanationText = `ES Wechsel ${prevStep}->${currStep} zum ${startDateText}`;
				}
			} else if (salaryIncreased) {
				if (isKnownTariffIncrease) {
					explanationText = `Tariferhöhung zum ${startDateText}`;
				} else {
					explanationText = `ES Wechsel ${prevStep}->${currStep} zum ${startDateText}`;
				}
			}
		}

		const compoundOneLineText = buildCompoundOneLineText(
			participant.name,
			runtimeText,
			tariffText,
			calculationPeriodText,
			explanationText,
			costTypeText
		);

		landRows.push({
			id: `land-row-${rowNumber}`,
			rowNumber,
			workingHours: participant.weeklyHours,
			monthlyAmount,
			percentage: 100,
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
			compoundOneLineText,
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
			const sameAga = Math.abs(prev.agaRealRate - r.agaRealRate) < 0.00001;
			const sameStep = getTariffStep(prev, participant) === getTariffStep(r, participant);

			if (sameSv && sameAga && sameStep) {
				currentSvGroup.push(r);
			} else {
				flushSvGroup();
				currentSvGroup.push(r);
			}
		}
	}
	flushSvGroup();

	// 2. Degressionsbetrag Rows (when JC < 100%, grouped by salary, step, and degression tier)
	const degRecords = records.filter(r => r.jcDegressionPct < 100);
	let currentDegGroup: MonthlyRecord[] = [];
	let previousDegGroup: MonthlyRecord[] | null = null;

	const flushDegGroup = () => {
		if (currentDegGroup.length === 0) return;
		const first = currentDegGroup[0];
		const landPct = 100 - first.jcDegressionPct;
		const monthCount = round2(currentDegGroup.reduce((sum, r) => sum + (r.monthUnits || 1.0), 0));
		const monthlyAmount = round2(first.fullMonthlyJcTotalGross || (first.fteSalary * participant.weeklyHours / 39) * 1.19);
		const rowNumber = landRows.length + 1;

		const yearlyAmounts: Record<number, number> = {};
		for (const y of years) {
			const unitsInYear = currentDegGroup.filter(r => r.year === y).reduce((sum, r) => sum + (r.monthUnits || 1.0), 0);
			if (unitsInYear > 0) {
				const effectiveMonthly = round2(monthlyAmount * (landPct / 100));
				yearlyAmounts[y] = round2(effectiveMonthly * unitsInYear);
			} else {
				yearlyAmounts[y] = 0;
			}
		}

		const totalSum = Object.values(yearlyAmounts).reduce((a, b) => round2(a + b), 0);
		const startDateText = getPeriodStartDate(currentDegGroup);
		const endDateText = getPeriodEndDate(currentDegGroup);
		const calculationPeriodText = `${startDateText}-${endDateText}`;
		const tariffStep = getTariffStep(first, participant);
		const tariffText = `AWO Berlin ${participant.tariffGroup}/${tariffStep}`;
		const runtimeText = contractRuntimeText;

		let explanationText = '';
		if (previousDegGroup) {
			const prevFirst = previousDegGroup[0];
			const prevStep = getTariffStep(prevFirst, participant);
			const currStep = tariffStep;
			const stepChanged = prevStep !== currStep;
			const degressionChanged = prevFirst.jcDegressionPct !== first.jcDegressionPct;
			const isKnownTariffIncrease = isAwoTariffIncreaseMonth(first.year, first.month);
			const salaryIncreased = first.fteSalary > prevFirst.fteSalary;

			if (degressionChanged && stepChanged) {
				explanationText = `Stufenaufstieg ${prevStep}->${currStep}, Degression auf ${first.jcDegressionPct}% zum ${startDateText}`;
			} else if (degressionChanged) {
				explanationText = `Degression auf ${first.jcDegressionPct}% ab ${startDateText}`;
			} else if (stepChanged) {
				if (isKnownTariffIncrease) {
					explanationText = `Stufenaufstieg ${prevStep}->${currStep} und Tariferhöhung zum ${startDateText}`;
				} else {
					explanationText = `Stufenaufstieg ${prevStep}->${currStep} zum ${startDateText}`;
				}
			} else if (salaryIncreased) {
				if (isKnownTariffIncrease) {
					explanationText = `Tariferhöhung zum ${startDateText}`;
				} else {
					explanationText = `Stufenaufstieg ${prevStep}->${currStep} zum ${startDateText}`;
				}
			}
		} else {
			explanationText = `Degression auf ${first.jcDegressionPct}% ab ${startDateText}`;
		}

		const costTypeText = 'Degressionsbetrag';
		const compoundOneLineText = buildCompoundOneLineText(
			participant.name,
			runtimeText,
			tariffText,
			calculationPeriodText,
			explanationText,
			costTypeText
		);

		landRows.push({
			id: `land-row-${rowNumber}`,
			rowNumber,
			workingHours: participant.weeklyHours,
			monthlyAmount,
			percentage: landPct,
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
			compoundOneLineText,
			description: `${explanationText}     ${costTypeText}`,
			category: 'degression'
		});

		previousDegGroup = currentDegGroup;
		currentDegGroup = [];
	};

	for (const r of degRecords) {
		if (currentDegGroup.length === 0) {
			currentDegGroup.push(r);
		} else {
			const prev = currentDegGroup[currentDegGroup.length - 1];
			const sameFte = Math.abs(prev.fteSalary - r.fteSalary) < 0.01;
			const sameDeg = prev.jcDegressionPct === r.jcDegressionPct;
			const sameStep = getTariffStep(prev, participant) === getTariffStep(r, participant);

			if (sameFte && sameDeg && sameStep) {
				currentDegGroup.push(r);
			} else {
				flushDegGroup();
				currentDegGroup.push(r);
			}
		}
	}
	flushDegGroup();

	// 3. Jahressonderzahlung Rows (JSZ 85% + AGA)
	for (const y of years) {
		const monthsInYear = records.filter(r => r.year === y);
		const jszRecord = monthsInYear.find(r => r.isJszMonth && r.jszAmount > 0);
		if (jszRecord) {
			const totalJszWithAga = round2(jszRecord.jszAmount + jszRecord.jszAgaAmount);
			const rowNumber = landRows.length + 1;
			const allMonthsInYear = allProcessedRecords.filter(r => r.year === y);
			const totalEmploymentMonthsInYear = round2(allMonthsInYear.reduce((sum, r) => sum + (r.monthUnits || 1.0), 0));

			const yearlyAmounts: Record<number, number> = {};
			for (const yr of years) yearlyAmounts[yr] = yr === y ? totalJszWithAga : 0;

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

			const compoundOneLineText = buildCompoundOneLineText(
				participant.name,
				runtimeText,
				tariffText,
				calculationPeriodText,
				explanationText,
				costTypeText
			);

			landRows.push({
				id: `land-row-${rowNumber}`,
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
				compoundOneLineText,
				description: `${explanationText}     ${costTypeText}`,
				category: 'jsz'
			});
		}
	}

	// Calculate unrounded exact Landesmittel sum from raw monthly records
	const exactLandTruthTotal = records.reduce((sum, r) => {
		const degressionShortfall = round2((r.jcTotalGross * (100 - r.jcDegressionPct)) / 100);
		const monthlyLand = r.landSvShortfall + degressionShortfall + (r.jszAmount || 0) + (r.jszAgaAmount || 0);
		return sum + monthlyLand;
	}, 0);

	const landFormSumWithoutOffset = landRows.reduce((sum, r) => sum + r.totalSum, 0);
	const landRoundingDelta = round2(exactLandTruthTotal - landFormSumWithoutOffset);

	// Add Landesmittel balancing row if requested and delta != 0
	if (includeOffsetRows && Math.abs(landRoundingDelta) > 0.001) {
		const firstYear = years[0];
		const offsetYearly: Record<number, number> = {};
		for (const y of years) offsetYearly[y] = 0;
		offsetYearly[firstYear] = landRoundingDelta;

		const runtimeText = contractRuntimeText;
		const tariffText = `AWO Berlin ${participant.tariffGroup}/${participant.tariffStep}`;
		const calculationPeriodText = contractRuntimeText;
		const explanationText = 'Ausgleich K-Hilfe vs. reale Kalkulation';
		const costTypeText = 'Ausgleichsbetrag';
		const compoundOneLineText = buildCompoundOneLineText(
			participant.name,
			runtimeText,
			tariffText,
			calculationPeriodText,
			explanationText,
			costTypeText
		);

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
			runtimeText,
			tariffText,
			calculationPeriodText,
			explanationText,
			costTypeText,
			compoundOneLineText,
			description: `${explanationText}     ${costTypeText}`,
			isOffsetRow: true,
			category: 'offset'
		});
	}

	const landYearlyTotals: Record<number, number> = {};
	for (const y of years) {
		landYearlyTotals[y] = landRows.reduce((sum, r) => round2(sum + (r.yearlyAmounts[y] || 0)), 0);
	}
	const landGrandTotal = Object.values(landYearlyTotals).reduce((a, b) => round2(a + b), 0);

	const landTab: FormTabDefinition = {
		id: 'landesmittel',
		title: '2. TLN-Kosten Landesmittel',
		tabNumber: 2,
		rows: landRows,
		yearlyTotals: landYearlyTotals,
		grandTotal: landGrandTotal,
		status: 'Angaben vollständig'
	};

	// ==========================================
	// TAB 3: Sachkostenpauschale (155 €)
	// ==========================================
	const sachkostenRate = participant.sachkostenMonthly;
	const skYearlyAmounts: Record<number, number> = {};
	for (const y of years) {
		const unitsInYear = records.filter(r => r.year === y).reduce((sum, r) => sum + (r.monthUnits || 1.0), 0);
		skYearlyAmounts[y] = round2(unitsInYear * sachkostenRate);
	}
	const skGrandTotal = round2(runtimeMonths * sachkostenRate);

	const skName = participant.name.startsWith('Hr.') || participant.name.startsWith('Herr')
		? participant.name
		: `Fr. ${participant.name.replace(/^Frau\s+/i, '')}`;
	const skRuntime = contractRuntimeWithSpaces;
	const skTariff = `AWO Berlin ${participant.tariffGroup}/${participant.tariffStep}`;
	const skPeriod = `${getPeriodStartDate(records)} - ${getPeriodEndDate(records)}`;
	const skExplanation = `JC Antrag bewilligt bis ${participant.runtimeEnd || getPeriodEndDate(records)}`;
	const skCostType = `Sachkostenpauschale ${sachkostenRate.toFixed(2).replace('.', ',')} € mtl.`;
	const skCompoundOneLineText = buildCompoundOneLineText(skName, skRuntime, skTariff, skPeriod, skExplanation, skCostType);

	const skRow: FormRowItem = {
		id: 'sk-row-1',
		rowNumber: 1,
		workingHours: 1, // "Anzahl Teilnehmende" = 1
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
		compoundOneLineText: skCompoundOneLineText,
		description: `${skExplanation}     ${skCostType}`,
		category: 'sachkosten'
	};

	const skTab: FormTabDefinition = {
		id: 'sachkosten',
		title: `Sachkostenpauschale ${sachkostenRate} €`,
		tabNumber: 3,
		rows: [skRow],
		yearlyTotals: skYearlyAmounts,
		grandTotal: skGrandTotal,
		status: 'Angaben vollständig'
	};

	// ==========================================
	// CONTROL CALCULATIONS & AUDIT CHECKS
	// ==========================================
	const roundedJcTruth = round2(exactJcTruthTotal);
	const roundedLandTruth = round2(exactLandTruthTotal);
	const excelGrandTotal = round2(roundedJcTruth + roundedLandTruth + skGrandTotal);
	const formGrandTotal = round2(jcGrandTotal + landGrandTotal + skGrandTotal);
	const totalDelta = round2(excelGrandTotal - formGrandTotal);

	const controlItems: ControlCheckItem[] = [
		{
			id: 'ctrl-jc',
			name: '1. TLN-Kosten Jobcenter',
			category: 'jobcenter',
			excelValue: roundedJcTruth,
			formValue: jcGrandTotal,
			delta: round2(roundedJcTruth - jcGrandTotal),
			status: Math.abs(roundedJcTruth - jcGrandTotal) <= 0.01 ? 'MATCH' : includeOffsetRows ? 'OFFSET_APPLIED' : 'WARNING',
			note: includeOffsetRows ? (jcRoundingDelta !== 0 ? `Ausgleichsbetrag verrechnet (${jcRoundingDelta > 0 ? '+' : ''}${jcRoundingDelta.toFixed(2).replace('.', ',')} €)` : 'Exakte Übereinstimmung') : 'Cent-Rundungsdifferenz durch Formularmultiplikation'
		},
		{
			id: 'ctrl-land',
			name: '2. TLN-Kosten Landesmittel',
			category: 'landesmittel',
			excelValue: roundedLandTruth,
			formValue: landGrandTotal,
			delta: round2(roundedLandTruth - landGrandTotal),
			status: Math.abs(roundedLandTruth - landGrandTotal) <= 0.01 ? 'MATCH' : includeOffsetRows ? 'OFFSET_APPLIED' : 'WARNING',
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
		jobcenterCheck: {
			excelTotal: roundedJcTruth,
			formTotal: jcGrandTotal,
			delta: round2(roundedJcTruth - jcGrandTotal),
			offsetAmount: jcRoundingDelta
		},
		landesmittelCheck: {
			excelTotal: roundedLandTruth,
			formTotal: landGrandTotal,
			delta: round2(roundedLandTruth - landGrandTotal),
			offsetAmount: landRoundingDelta
		},
		sachkostenCheck: {
			excelTotal: skGrandTotal,
			formTotal: skGrandTotal,
			delta: 0
		}
	};

	// Default AGA timeline if not provided
	const defaultAgaTimeline: AgaRatePeriod[] = customAgaTimeline || [
		{
			id: 'aga-default',
			startDate: participant.runtimeStart ? formatDateDMY(participant.runtimeStart) : '2026-08-01',
			endDate: participant.runtimeEnd ? formatDateDMY(participant.runtimeEnd) : '2031-07-31',
			rate: participant.defaultAgaRate,
			label: `${participant.healthInsuranceName} Standard (${(participant.defaultAgaRate * 100).toFixed(3)}%)`
		}
	];

	// Generate TV-L Comparison calculation
	const tvlComparison = calculateTvlComparison(
		allProcessedRecords,
		participant,
		years.includes(2026) ? 2026 : (years[years.length - 1] || 2026),
		undefined,
		(participant as any).insuranceFunds
	);

	const tariffValidation = validateBerechnungsblattTariff(allProcessedRecords, participant);

	return {
		schemeId: 'sgb16i-berlin',
		schemeName: '§ 16i SGB II / ZGS Berlin (AWO Tarifeinigung 05.05.2026)',
		participant,
		years,
		runtimeMonths,
		tabs: [jcTab, landTab, skTab],
		controls,
		agaTimeline: defaultAgaTimeline,
		options: {
			...options,
			runtimeScope,
			runtimeStartScope,
			customStartDate: options.customStartDate
		},
		rawMonthlyRecords: allProcessedRecords,
		insuranceFunds: (participant as any).insuranceFunds,
		tariffValidation,
		tvlComparison
	};
}
