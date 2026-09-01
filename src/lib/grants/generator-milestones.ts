import type { BerechnungsblattGeneratorOptions, GeneratorMilestone } from '#lib/types/grant';
import {
	getAwoTariffSalary,
	calculateTariffStepAtDate,
	isAwoTariffIncreaseMonth
} from '#lib/grants/awo-tariff-data';
import { DEFAULT_INSURANCE_FUNDS } from '#lib/grants/tvl-tariff-data';

// Color definitions matching the sample spreadsheet exactly
export const COLOR_STUFENAUFSTIEG = '70AD47'; // Green
export const COLOR_TARIFERHOEHUNG = 'FFC000'; // Amber/Yellow
export const COLOR_EXIT = 'FF0000';           // Red
export const COLOR_HEADER_BG = 'D9E1F2';      // Light blue-grey for headers
export const COLOR_SUM_BG = 'F2F2F2';         // Soft grey for yearly totals

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
 * Returns the insurance fund details for a fund name.
 */
export function getInsuranceFundByName(name = 'Barmer') {
	const found = DEFAULT_INSURANCE_FUNDS.find(f => f.name.toLowerCase() === name.toLowerCase());
	if (found) return found;
	// Fallback to Barmer
	return DEFAULT_INSURANCE_FUNDS.find(f => f.name.toLowerCase() === 'barmer') || DEFAULT_INSURANCE_FUNDS[0];
}

/**
 * Calculates milestones (Stufenaufstiege, Tariferhöhungen, planned exit) for the 5-year runtime.
 */
export function calculateMilestones(options: BerechnungsblattGeneratorOptions): GeneratorMilestone[] {
	const start = parseDateInput(options.startDate);
	const durationMonths = options.durationMonths || 60;
	const end = calculateEndDate(start, durationMonths);
	const group = options.tariffGroup || 'EG2';
	const initialStepNum = parseInt((options.tariffStep || 'ES1').replace(/\D/g, ''), 10) || 1;
	const weeklyHours = options.weeklyHours || 30;
	const fullTimeHours = options.fullTimeHours || 39;

	const milestones: GeneratorMilestone[] = [];
	let previousStep = initialStepNum;
	let previousFte = 0;

	// Total calendar span in months
	const totalCalendarMonths = (end.year * 12 + end.month) - (start.year * 12 + start.month) + 1;

	for (let i = 0; i < totalCalendarMonths; i++) {
		const totalMonths = (start.year * 12 + start.month - 1) + i;
		const curYear = Math.floor(totalMonths / 12);
		const curMonth = (totalMonths % 12) + 1;
		const isLastMonth = (curYear === end.year && curMonth === end.month);

		const currentStep = calculateTariffStepAtDate(
			{ day: start.day, month: curMonth, year: curYear },
			start,
			initialStepNum
		);

		const salaryInfo = getAwoTariffSalary(group, currentStep, curYear, curMonth, weeklyHours, fullTimeHours);
		const currentFte = salaryInfo?.fteSalary || 0;

		// 1. Stufenaufstieg check
		if (i > 0 && currentStep > previousStep) {
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

		// 2. Tariferhöhung check
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

		// 3. Planned Exit check (last month)
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

		previousStep = currentStep;
		previousFte = currentFte;
	}

	return milestones;
}
