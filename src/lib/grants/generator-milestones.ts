import type {
	BerechnungsblattGeneratorOptions,
	GeneratorMilestone,
	TariffReclassification,
	BgRatePeriod
} from '#lib/types/grant';
import {
	getAwoTariffSalary,
	calculateTariffStepAtDate,
	isAwoTariffIncreaseMonth
} from '#lib/grants/awo-tariff-data';
import { DEFAULT_INSURANCE_FUNDS } from '#lib/grants/tvl-tariff-data';

// Color definitions matching the spreadsheet exactly
export const COLOR_STUFENAUFSTIEG = '70AD47'; // Green
export const COLOR_TARIFERHOEHUNG = 'FFC000'; // Amber/Yellow
export const COLOR_UMGRUPPIERUNG  = '8B5CF6'; // Vibrant Purple
export const COLOR_EXIT           = 'FF0000'; // Red
export const COLOR_HEADER_BG      = 'D9E1F2'; // Light blue-grey for headers
export const COLOR_SUM_BG         = 'F2F2F2'; // Soft grey for yearly totals

/**
 * Normalizes input date to year, month (1-12), day (1-31).
 */
export function parseDateInput(input?: string): { year: number; month: number; day: number } {
	if (!input) {
		const now = new Date();
		// First of next month
		let y = now.getFullYear();
		let m = now.getMonth() + 2; // +1 for 1-based, +1 for next month
		if (m > 12) {
			y += 1;
			m = 1;
		}
		return { year: y, month: m, day: 1 };
	}

	// Format YYYY-MM-DD
	const isoMatch = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
	if (isoMatch) {
		return {
			year: parseInt(isoMatch[1], 10),
			month: parseInt(isoMatch[2], 10),
			day: parseInt(isoMatch[3], 10)
		};
	}

	// Format DD.MM.YYYY
	const dmyMatch = input.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
	if (dmyMatch) {
		return {
			day: parseInt(dmyMatch[1], 10),
			month: parseInt(dmyMatch[2], 10),
			year: parseInt(dmyMatch[3], 10)
		};
	}

	const fallback = new Date(input);
	if (!isNaN(fallback.getTime())) {
		return {
			year: fallback.getFullYear(),
			month: fallback.getMonth() + 1,
			day: fallback.getDate()
		};
	}

	return { year: 2026, month: 10, day: 1 };
}

/**
 * Calculates the end date for a given start date and duration in months.
 */
export function calculateEndDate(startDate: { year: number; month: number; day: number }, durationMonths = 60): { year: number; month: number; day: number } {
	let totalMonths = (startDate.year * 12 + startDate.month - 1);
	if (startDate.day === 1) {
		totalMonths += durationMonths - 1;
	} else {
		// When starting mid-month (e.g. 16th), duration is full years/months to day-1
		// E.g. 16.11.2022 for 60 months (5 years) ends on 15.11.2027!
		totalMonths += durationMonths;
	}
	const endYear = Math.floor(totalMonths / 12);
	const endMonth = (totalMonths % 12) + 1;

	let endDay: number;
	if (startDate.day === 1) {
		// Last day of that month
		endDay = new Date(endYear, endMonth, 0).getDate();
	} else {
		// e.g. started on 16th, ends on 15th
		endDay = startDate.day - 1;
		if (endDay < 1) endDay = 1;
	}

	return { year: endYear, month: endMonth, day: endDay };
}

/**
 * Formats date as DD.MM.YYYY
 */
export function formatDateDMY(d: { year: number; month: number; day: number }): string {
	return `${String(d.day).padStart(2, '0')}.${String(d.month).padStart(2, '0')}.${d.year}`;
}

/**
 * Formats date as YYYY-MM-DD
 */
export function formatDateISO(d: { year: number; month: number; day: number }): string {
	return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

/**
 * Calculates active employment months between two dates.
 * Considers standard 1st-of-month (1.0 unit) or mid-month (0.5 unit) boundaries.
 */
export function calculateDurationMonthsBetween(
	startDate: { year: number; month: number; day: number },
	endDate: { year: number; month: number; day: number }
): number {
	const sIndex = startDate.year * 12 + startDate.month;
	const eIndex = endDate.year * 12 + endDate.month;
	if (eIndex < sIndex) return 0;

	if (sIndex === eIndex) {
		const lastDay = new Date(startDate.year, startDate.month, 0).getDate();
		if (startDate.day === 1 && endDate.day >= lastDay) return 1.0;
		if (startDate.day === 1 && endDate.day <= 15) return 0.5;
		return Math.max(0.1, Math.min(1.0, Math.round(((endDate.day - startDate.day + 1) / lastDay) * 100) / 100));
	}

	const startUnits = startDate.day === 1 ? 1.0 : 0.5;
	const intermediateMonths = Math.max(0, eIndex - sIndex - 1);
	const lastDayOfEndMonth = new Date(endDate.year, endDate.month, 0).getDate();
	let endUnits = 1.0;
	if (endDate.day < lastDayOfEndMonth) {
		endUnits = endDate.day <= 15 ? 0.5 : (endDate.day >= 28 ? 1.0 : Math.round((endDate.day / lastDayOfEndMonth) * 100) / 100);
	}

	return Math.round((startUnits + intermediateMonths + endUnits) * 100) / 100;
}

/**
 * Returns the insurance fund details for a fund name.
 */
export function getInsuranceFundByName(name = 'Barmer') {
	const lower = (name || '').trim().toLowerCase();
	const found = DEFAULT_INSURANCE_FUNDS.find(f => f.name.toLowerCase() === lower);
	if (found) return found;

	// Alias matching for BIG direkt gesund / BIG direkt
	if (lower.includes('big')) {
		const big = DEFAULT_INSURANCE_FUNDS.find(f => f.name.toLowerCase().includes('big'));
		if (big) return big;
	}

	// Substring / partial matching
	const partial = DEFAULT_INSURANCE_FUNDS.find(f =>
		lower.includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(lower)
	);
	if (partial) return partial;

	// Fallback to Barmer
	return DEFAULT_INSURANCE_FUNDS.find(f => f.name.toLowerCase() === 'barmer') || DEFAULT_INSURANCE_FUNDS[0];
}

import { DEFAULT_EFFECTIVE_BG_RATE_DECIMAL } from '#lib/grants/bg-calculator';

/**
 * Resolves the effective Berufsgenossenschaft (BG) contribution rate for a target date.
 */
export function getEffectiveBgRate(
	targetDate: { year: number; month: number; day?: number } | string,
	defaultRate = DEFAULT_EFFECTIVE_BG_RATE_DECIMAL,
	customBgTimeline?: BgRatePeriod[]
): number {
	if (!customBgTimeline || customBgTimeline.length === 0) {
		return defaultRate;
	}
	let dateStr = '';
	if (typeof targetDate === 'string') {
		const parsed = parseDateInput(targetDate);
		dateStr = `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day || 1).padStart(2, '0')}`;
	} else {
		dateStr = `${targetDate.year}-${String(targetDate.month).padStart(2, '0')}-${String(targetDate.day || 1).padStart(2, '0')}`;
	}

	for (const period of customBgTimeline) {
		const start = period.startDate.includes('.') ? parseDateInput(period.startDate) : null;
		const end = period.endDate.includes('.') ? parseDateInput(period.endDate) : null;
		const startStr = start ? `${start.year}-${String(start.month).padStart(2, '0')}-${String(start.day).padStart(2, '0')}` : period.startDate;
		const endStr = end ? `${end.year}-${String(end.month).padStart(2, '0')}-${String(end.day).padStart(2, '0')}` : period.endDate;

		if (dateStr >= startStr && dateStr <= endStr) {
			return period.rate;
		}
	}
	return defaultRate;
}

/**
 * Calculates the baseline reference date for experience step progression.
 * If continueTariffProgression is true, calculates an earlier date based on
 * previousTariffStepStartDate or priorExperienceMonths.
 * If false (default), returns the start date unchanged (progression starts fresh with new employer).
 */
export function computeStepBaselineDate(
	startDate: { year: number; month: number; day: number } | string,
	options?: {
		continueTariffProgression?: boolean;
		previousTariffStepStartDate?: string;
		priorExperienceMonths?: number;
	}
): { year: number; month: number; day: number } {
	const start = typeof startDate === 'string' ? parseDateInput(startDate) : startDate;
	if (!options?.continueTariffProgression) {
		return start;
	}

	if (options.previousTariffStepStartDate && options.previousTariffStepStartDate.trim()) {
		return parseDateInput(options.previousTariffStepStartDate);
	}

	if (options.priorExperienceMonths !== undefined && options.priorExperienceMonths > 0) {
		const totalMonths = (start.year * 12 + start.month - 1) - options.priorExperienceMonths;
		const baseYear = Math.floor(totalMonths / 12);
		const baseMonth = (totalMonths % 12) + 1;
		return { year: baseYear, month: baseMonth, day: start.day };
	}

	return start;
}

export interface NextStepAscentInfo {
	nextStep: number | null;
	nextAscentDate: { year: number; month: number; day: number } | null;
	nextAscentDateStr: string;
	remainingMonthsAtNewEmployer: number;
	totalMonthsRequiredInStep: number;
	priorMonthsCredited: number;
}

/**
 * Computes detailed information about the next experience step ascent (Stufenaufstieg).
 */
export function calculateNextStepAscentInfo(
	currentStep: number,
	startDate: { year: number; month: number; day: number } | string,
	baselineDate: { year: number; month: number; day: number } | string
): NextStepAscentInfo {
	const start = typeof startDate === 'string' ? parseDateInput(startDate) : startDate;
	const base = typeof baselineDate === 'string' ? parseDateInput(baselineDate) : baselineDate;

	if (currentStep >= 6) {
		return {
			nextStep: null,
			nextAscentDate: null,
			nextAscentDateStr: '-',
			remainingMonthsAtNewEmployer: 0,
			totalMonthsRequiredInStep: 0,
			priorMonthsCredited: 0
		};
	}

	const totalMonthsRequiredInStep = currentStep * 12; // ES1: 12, ES2: 24, ES3: 36, ES4: 48, ES5: 60

	// Prior months credited before startDate
	const priorMonthsCredited = Math.max(
		0,
		(start.year - base.year) * 12 + (start.month - base.month) + (start.day >= base.day ? 0 : -1)
	);

	// Date when step will advance (base + required months)
	const totalAdvanceMonths = (base.year * 12 + base.month - 1) + totalMonthsRequiredInStep;
	const advanceYear = Math.floor(totalAdvanceMonths / 12);
	const advanceMonth = (totalAdvanceMonths % 12) + 1;
	const nextAscentDate = { year: advanceYear, month: advanceMonth, day: base.day };

	const remainingMonthsAtNewEmployer = Math.max(0, totalMonthsRequiredInStep - priorMonthsCredited);

	return {
		nextStep: currentStep + 1,
		nextAscentDate,
		nextAscentDateStr: formatDateDMY(nextAscentDate),
		remainingMonthsAtNewEmployer,
		totalMonthsRequiredInStep,
		priorMonthsCredited
	};
}

/**
 * Resolves the active tariff group and experience step for a specific target date,
 * incorporating arbitrary reclassifications that took effect on or before that date.
 * If stepBaselineDateOverride is provided, the initial experience step baseline uses that date.
 */
export function resolveTariffStateAtDate(
	targetDate: { day: number; month: number; year: number },
	startDate: { day: number; month: number; year: number },
	initialGroup: string = 'EG2',
	initialStep: number = 1,
	reclassifications: TariffReclassification[] = [],
	stepBaselineDateOverride?: { day: number; month: number; year: number } | string
): {
	group: string;
	step: number;
	activeReclassification?: TariffReclassification;
	isReclassificationEffectiveThisMonth?: boolean;
} {
	const targetVal = targetDate.year * 10000 + targetDate.month * 100 + targetDate.day;

	const sorted = [...reclassifications]
		.filter(r => Boolean(r && r.effectiveDate))
		.map(r => {
			const parsed = parseDateInput(r.effectiveDate);
			return {
				...r,
				parsed,
				dateVal: parsed.year * 10000 + parsed.month * 100 + parsed.day
			};
		})
		.sort((a, b) => a.dateVal - b.dateVal);

	const applied = sorted.filter(r => r.dateVal <= targetVal);

	// Determine group
	let currentGroup = initialGroup;
	for (const r of applied) {
		if (r.tariffGroup && r.tariffGroup.trim()) {
			currentGroup = r.tariffGroup.trim();
		}
	}

	// Determine step
	// Find most recent reclassification that specified a tariffStep
	let stepBaselineDate = stepBaselineDateOverride
		? (typeof stepBaselineDateOverride === 'string' ? parseDateInput(stepBaselineDateOverride) : stepBaselineDateOverride)
		: startDate;
	let stepBaselineVal = initialStep;

	for (const r of applied) {
		if (r.tariffStep && r.tariffStep.trim()) {
			const parsedStep = parseInt(r.tariffStep.replace(/\D/g, ''), 10);
			if (!isNaN(parsedStep) && parsedStep >= 1 && parsedStep <= 6) {
				stepBaselineVal = parsedStep;
				stepBaselineDate = r.parsed;
			}
		}
	}

	const currentStep = calculateTariffStepAtDate(targetDate, stepBaselineDate, stepBaselineVal);

	// Check if a reclassification took effect in this target month
	const effectiveThisMonth = applied.find(
		r => r.parsed.year === targetDate.year && r.parsed.month === targetDate.month
	);

	return {
		group: currentGroup,
		step: currentStep,
		activeReclassification: applied[applied.length - 1],
		isReclassificationEffectiveThisMonth: Boolean(effectiveThisMonth)
	};
}

/**
 * Calculates milestones (Stufenaufstiege, Tariferhöhungen, Umgruppierungen, planned exit) for the 5-year runtime.
 */
export function calculateMilestones(options: BerechnungsblattGeneratorOptions): GeneratorMilestone[] {
	const start = parseDateInput(options.startDate);
	const end = options.endDate ? parseDateInput(options.endDate) : calculateEndDate(start, options.durationMonths || 60);
	const durationMonths = options.durationMonths || calculateDurationMonthsBetween(start, end);
	const group = options.tariffGroup || 'EG2';
	const initialStepNum = parseInt((options.tariffStep || 'ES1').replace(/\D/g, ''), 10) || 1;
	const weeklyHours = options.weeklyHours || 30;
	const fullTimeHours = options.fullTimeHours || 39;
	const reclassifications = options.reclassifications || [];
	const stepBaseline = computeStepBaselineDate(start, options);

	const milestones: GeneratorMilestone[] = [];
	let previousStep = initialStepNum;
	let previousGroup = group;
	let previousFte = 0;

	// Total calendar span in months
	const totalCalendarMonths = (end.year * 12 + end.month) - (start.year * 12 + start.month) + 1;

	for (let i = 0; i < totalCalendarMonths; i++) {
		const totalMonths = (start.year * 12 + start.month - 1) + i;
		const curYear = Math.floor(totalMonths / 12);
		const curMonth = (totalMonths % 12) + 1;
		const isLastMonth = (curYear === end.year && curMonth === end.month);

		const tariffState = resolveTariffStateAtDate(
			{ day: start.day, month: curMonth, year: curYear },
			start,
			group,
			initialStepNum,
			reclassifications,
			stepBaseline
		);

		const currentGroup = tariffState.group;
		const currentStep = tariffState.step;

		const salaryInfo = getAwoTariffSalary(currentGroup, currentStep, curYear, curMonth, weeklyHours, fullTimeHours);
		const currentFte = salaryInfo?.fteSalary || 0;

		// 1. Reclassification check (Umgruppierung / Stufenanpassung)
		if (tariffState.isReclassificationEffectiveThisMonth) {
			const activeRec = reclassifications.find(r => {
				const p = parseDateInput(r.effectiveDate);
				return p.year === curYear && p.month === curMonth;
			});

			let label = activeRec?.note?.trim();
			if (!label) {
				const groupChanged = currentGroup !== previousGroup;
				const stepChanged = currentStep !== previousStep;
				if (groupChanged && stepChanged) {
					label = `Umgruppierung zu ${currentGroup} (ES${currentStep})`;
				} else if (groupChanged) {
					label = `Höhergruppierung zu ${currentGroup}`;
				} else {
					label = `Stufenanpassung zu ES${currentStep}`;
				}
			}

			milestones.push({
				type: 'umgruppierung',
				year: curYear,
				month: curMonth,
				dateStr: activeRec?.effectiveDate ? formatDateDMY(parseDateInput(activeRec.effectiveDate)) : `01.${String(curMonth).padStart(2, '0')}.${curYear}`,
				label,
				color: COLOR_UMGRUPPIERUNG,
				oldGroup: previousGroup,
				newGroup: currentGroup,
				oldStep: `ES${previousStep}`,
				newStep: `ES${currentStep}`,
				oldSalary: previousFte,
				newSalary: currentFte
			});
		} else if (i > 0 && currentStep > previousStep) {
			// 2. Regular Stufenaufstieg check (if no reclassification occurred this month)
			milestones.push({
				type: 'stufenaufstieg',
				year: curYear,
				month: curMonth,
				dateStr: `01.${String(curMonth).padStart(2, '0')}.${curYear}`,
				label: `Stufenaufstieg zu ES${currentStep}`,
				color: COLOR_STUFENAUFSTIEG,
				oldStep: `ES${previousStep}`,
				newStep: `ES${currentStep}`,
				oldSalary: previousFte,
				newSalary: currentFte
			});
		}

		// 3. Tariferhöhung check
		if (i > 0 && isAwoTariffIncreaseMonth(curYear, curMonth)) {
			milestones.push({
				type: 'tariferhoehung',
				year: curYear,
				month: curMonth,
				dateStr: `01.${String(curMonth).padStart(2, '0')}.${curYear}`,
				label: `Tariferhöhung AWO Berlin (${salaryInfo?.periodLabel || `${curMonth}/${curYear}`})`,
				color: COLOR_TARIFERHOEHUNG,
				oldSalary: previousFte,
				newSalary: currentFte
			});
		}

		// 4. Planned Exit check (last month)
		if (isLastMonth) {
			milestones.push({
				type: 'exit',
				year: curYear,
				month: curMonth,
				dateStr: formatDateDMY(end),
				label: `Geplantes Laufzeitende (nach ${durationMonths} Monaten)`,
				color: COLOR_EXIT
			});
		}

		previousGroup = currentGroup;
		previousStep = currentStep;
		previousFte = currentFte;
	}

	return milestones;
}
