import type {
	MonthlyRecord,
	ParticipantInfo,
	InsuranceFundDetails,
	TvlComparisonInputs,
	TvlPeriodCalculation,
	TvlComparisonResult,
	TvlTariffEntry,
	TariffValidationReport
} from '#lib/types/grant';
import {
	STATUTORY_SV_RATES,
	DEFAULT_INSURANCE_FUNDS,
	getTvlTariffEntry,
	getAllTvlTariffCodes,
	normalizeTvlTariffCode
} from '#lib/grants/tvl-tariff-data';
import { getAwoTariffSalary, validateBerechnungsblattTariff } from '#lib/grants/awo-tariff-data';

function round2(val: number): number {
	return Math.round((val + Number.EPSILON) * 100) / 100;
}

function parseDateDMY(dStr?: string): { day: number; month: number; year: number } | null {
	if (!dStr) return null;
	const parts = dStr.split(/[.\-/]/).map((p) => parseInt(p.trim(), 10));
	if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
		if (parts[2] > 1000) return { day: parts[0], month: parts[1], year: parts[2] };
		if (parts[0] > 1000) return { day: parts[2], month: parts[1], year: parts[0] };
	}
	return null;
}

function getDaysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

/**
 * Computes exact month count with decimal fraction for a date range in a specific year.
 * Mirrors Excel: DATEDIF / EOMONTH formula used in the TV-L Vergleichsberechnung.
 */
export function calculatePeriodMonths(startDateStr: string, endDateStr: string, switchMonth = 4): {
	totalMonths: number;
	monthsPreSwitch: number;
	monthsPostSwitch: number;
} {
	const start = parseDateDMY(startDateStr);
	const end = parseDateDMY(endDateStr);

	if (!start || !end) {
		return { totalMonths: 1.0, monthsPreSwitch: 1.0, monthsPostSwitch: 0 };
	}

	const year = start.year;

	// Total months in period
	let totalMonths = 0;
	if (start.month === end.month) {
		const dim = getDaysInMonth(year, start.month);
		totalMonths = (end.day - start.day + 1) / dim;
	} else {
		const startDim = getDaysInMonth(year, start.month);
		const startFrac = (startDim - start.day + 1) / startDim;
		const endDim = getDaysInMonth(year, end.month);
		const endFrac = end.day / endDim;
		const middleMonths = Math.max(0, end.month - start.month - 1);
		totalMonths = startFrac + middleMonths + endFrac;
	}

	// Months before switch (e.g. before April = Jan to March)
	let monthsPreSwitch = 0;
	if (start.month < switchMonth) {
		if (end.month < switchMonth) {
			monthsPreSwitch = totalMonths;
		} else {
			const startDim = getDaysInMonth(year, start.month);
			const startFrac = (startDim - start.day + 1) / startDim;
			const fullPreMonths = Math.max(0, switchMonth - start.month - 1);
			monthsPreSwitch = startFrac + fullPreMonths;
		}
	}

	// Months from switch onwards (e.g. from April = Apr to Dec)
	let monthsPostSwitch = 0;
	if (end.month >= switchMonth) {
		if (start.month >= switchMonth) {
			monthsPostSwitch = totalMonths;
		} else {
			const endDim = getDaysInMonth(year, end.month);
			const endFrac = end.day / endDim;
			const fullPostMonths = Math.max(0, end.month - switchMonth);
			monthsPostSwitch = fullPostMonths + endFrac;
		}
	}

	return {
		totalMonths,
		monthsPreSwitch,
		monthsPostSwitch
	};
}

/**
 * Calculates a single period (Left Section or Right Section) of the TV-L comparison.
 */
export function calculatePeriod(
	tariffCode: string,
	startDate: string,
	endDate: string,
	weeklyHours: number,
	istJanMar: number,
	istAbApr: number,
	besitzstand: number,
	vwl: number,
	isRightSection: boolean,
	rates: {
		kvRate: number;
		kkZusatzRate: number;
		rvRate: number;
		avRate: number;
		pvRate: number;
		vorsorgeRate: number;
		u1Rate: number;
		u2Rate: number;
		u3Rate: number;
	},
	options?: {
		year?: number;
		contractStartDate?: string;
		istJsz?: number;
		switchMonth?: number;
	}
): TvlPeriodCalculation {
	const year = options?.year || 2026;
	const switchMonth = options?.switchMonth || 4;
	const tariffEntry = getTvlTariffEntry(year, tariffCode) || {
		code: tariffCode,
		valJanMar: 2853.24,
		jszPct: 0.8743,
		valAbApr: 2953.24,
		sueZulage: 0
	};

	const { totalMonths, monthsPreSwitch, monthsPostSwitch } = calculatePeriodMonths(startDate, endDate, switchMonth);

	// TV-L Base Entgelte (39.4h)
	const tvl394JanMar = tariffEntry.valJanMar;
	const tvl394AbApr = tariffEntry.valAbApr;
	const sueZulage394 = tariffEntry.sueZulage;
	const jszRatePct = tariffEntry.jszPct;

	// Converted Entgelte to weekly hours (e.g. 30h)
	const tvlUmJanMar = round2((tvl394JanMar / STATUTORY_SV_RATES.FULL_TIME_HOURS_TVL) * weeklyHours);
	const tvlUmAbApr = round2((tvl394AbApr / STATUTORY_SV_RATES.FULL_TIME_HOURS_TVL) * weeklyHours);
	const sueZulageUm = round2((sueZulage394 / STATUTORY_SV_RATES.FULL_TIME_HOURS_TVL) * weeklyHours);
	const vwlUm = weeklyHours < STATUTORY_SV_RATES.FULL_TIME_HOURS_TVL ? round2((vwl / STATUTORY_SV_RATES.FULL_TIME_HOURS_TVL) * weeklyHours) : vwl;

	// Average Monthly Gross
	const avgMonthlyGross394 = round2(
		(tvl394JanMar * monthsPreSwitch + (monthsPostSwitch > 0 ? tvl394AbApr * monthsPostSwitch : 0)) / (totalMonths || 1) +
		sueZulage394 + besitzstand + vwl
	);
	const avgMonthlyGrossUm = round2(
		(tvlUmJanMar * monthsPreSwitch + (monthsPostSwitch > 0 ? tvlUmAbApr * monthsPostSwitch : 0)) / (totalMonths || 1) +
		sueZulageUm + vwlUm
	);
	const avgMonthlyGrossIst = round2(
		(istJanMar * monthsPreSwitch + (monthsPostSwitch > 0 ? istAbApr * monthsPostSwitch : 0)) / (totalMonths || 1) +
		besitzstand + vwl
	);

	// Annual Gross without JSZ
	const grossWithoutJsz394 = round2(avgMonthlyGross394 * totalMonths);
	const grossWithoutJszUm = round2(avgMonthlyGrossUm * totalMonths);
	const grossWithoutJszIst = round2(avgMonthlyGrossIst * totalMonths);

	// Jahressonderzahlung (JSZ)
	let jsz394 = 0;
	let jszUm = 0;
	let jszIst = 0;

	const endParsed = parseDateDMY(endDate);
	const isEmployedOnDec1st = endParsed && (endParsed.month > 12 || (endParsed.month === 12 && endParsed.day >= 1));

	if (isEmployedOnDec1st) {
		// Contract start date for full-year qualification (DATEDIF formula)
		const contractStart = parseDateDMY(options?.contractStartDate || startDate) || { day: 1, month: 1, year };
		let monthsForJsz = Math.min(12, Math.max(1, (endParsed.year - contractStart.year) * 12 + (endParsed.month - contractStart.month) + (contractStart.day <= endParsed.day ? 1 : 0)));
		if (monthsForJsz > 12) monthsForJsz = 12;

		if (!isRightSection) {
			// Left section JSZ if employed on 01.12
			const baseJszSalary394 = switchMonth > 9 ? tvl394JanMar : (switchMonth < 7 ? tvl394AbApr : (tvl394JanMar + tvl394AbApr) / 2);
			jsz394 = round2((baseJszSalary394 + sueZulage394) * jszRatePct * (monthsForJsz / 12));
			jszUm = round2((jsz394 / STATUTORY_SV_RATES.FULL_TIME_HOURS_TVL) * weeklyHours);
			jszIst = options?.istJsz !== undefined ? options.istJsz : round2((istAbApr || istJanMar) * jszRatePct * (monthsForJsz / 12));
		} else {
			// Right section JSZ (Jul/Aug/Sep average)
			const jul394 = switchMonth > 7 ? tvl394JanMar : tvl394AbApr;
			const aug394 = switchMonth > 8 ? tvl394JanMar : tvl394AbApr;
			const sep394 = switchMonth > 9 ? tvl394JanMar : tvl394AbApr;
			const avgJulAugSep394 = (jul394 + aug394 + sep394) / 3;

			const julUm = switchMonth > 7 ? tvlUmJanMar : tvlUmAbApr;
			const augUm = switchMonth > 8 ? tvlUmJanMar : tvlUmAbApr;
			const sepUm = switchMonth > 9 ? tvlUmJanMar : tvlUmAbApr;
			const avgJulAugSepUm = (julUm + augUm + sepUm) / 3;

			jsz394 = round2(avgJulAugSep394 * jszRatePct * (monthsForJsz / 12));
			jszUm = round2(avgJulAugSepUm * jszRatePct * (monthsForJsz / 12));
			jszIst = options?.istJsz !== undefined ? options.istJsz : round2((istAbApr || istJanMar) * 0.85 * (monthsForJsz / 12));
		}
	}

	// Annual Gross with JSZ
	const grossWithJsz394 = round2(grossWithoutJsz394 + jsz394);
	const grossWithJszUm = round2(grossWithoutJszUm + jszUm);
	const grossWithJszIst = round2(grossWithoutJszIst + jszIst);

	// Social Security Contributions (AG-Anteile)
	const kvAmount394 = round2(grossWithJsz394 * rates.kvRate);
	const kvAmountUm = round2(grossWithJszUm * rates.kvRate);
	const kvAmountIst = round2(grossWithJszIst * rates.kvRate);

	const kkzAmount394 = round2(grossWithJsz394 * rates.kkZusatzRate);
	const kkzAmountUm = round2(grossWithJszUm * rates.kkZusatzRate);
	const kkzAmountIst = round2(grossWithJszIst * rates.kkZusatzRate);

	const rvAmount394 = round2(grossWithJsz394 * rates.rvRate);
	const rvAmountUm = round2(grossWithJszUm * rates.rvRate);
	const rvAmountIst = round2(grossWithJszIst * rates.rvRate);

	const avAmount394 = round2(grossWithJsz394 * rates.avRate);
	const avAmountUm = round2(grossWithJszUm * rates.avRate);
	const avAmountIst = round2(grossWithJszIst * rates.avRate);

	const pvAmount394 = round2(grossWithJsz394 * rates.pvRate);
	const pvAmountUm = round2(grossWithJszUm * rates.pvRate);
	const pvAmountIst = round2(grossWithJszIst * rates.pvRate);

	const vorsorgeAmount394 = round2(grossWithJsz394 * rates.vorsorgeRate);
	const vorsorgeAmountUm = round2(grossWithJszUm * rates.vorsorgeRate);
	const vorsorgeAmountIst = round2(grossWithJszIst * rates.vorsorgeRate);

	// Umlagen 1 & 2 are applied to Gross WITHOUT JSZ
	const u1Amount394 = round2(grossWithoutJsz394 * rates.u1Rate);
	const u1AmountUm = round2(grossWithoutJszUm * rates.u1Rate);
	const u1AmountIst = round2(grossWithoutJszIst * rates.u1Rate);

	const u2Amount394 = round2(grossWithoutJsz394 * rates.u2Rate);
	const u2AmountUm = round2(grossWithoutJszUm * rates.u2Rate);
	const u2AmountIst = round2(grossWithoutJszIst * rates.u2Rate);

	// Umlage 3 is applied to Gross WITH JSZ
	const u3Amount394 = round2(grossWithJsz394 * rates.u3Rate);
	const u3AmountUm = round2(grossWithJszUm * rates.u3Rate);
	const u3AmountIst = round2(grossWithJszIst * rates.u3Rate);

	const totalAgSv394 = round2(kvAmount394 + kkzAmount394 + rvAmount394 + avAmount394 + pvAmount394 + vorsorgeAmount394 + u1Amount394 + u2Amount394 + u3Amount394);
	const totalAgSvUm = round2(kvAmountUm + kkzAmountUm + rvAmountUm + avAmountUm + pvAmountUm + vorsorgeAmountUm + u1AmountUm + u2AmountUm + u3AmountUm);
	const totalAgSvIst = round2(kvAmountIst + kkzAmountIst + rvAmountIst + avAmountIst + pvAmountIst + vorsorgeAmountIst + u1AmountIst + u2AmountIst + u3AmountIst);

	// Total Personalkosten
	const personalkostenPeriod394 = round2(grossWithJsz394 + totalAgSv394);
	const personalkostenPeriodUm = round2(grossWithJszUm + totalAgSvUm);
	const personalkostenPeriodIst = round2(grossWithJszIst + totalAgSvIst);

	const avgMonthlyAgGrossUm = round2(personalkostenPeriodUm / (totalMonths || 1));
	const avgMonthlyAgGrossIst = round2(personalkostenPeriodIst / (totalMonths || 1));
	const deltaIstTvl = round2(personalkostenPeriodIst - personalkostenPeriodUm);

	return {
		tariffCode,
		startDate,
		endDate,
		weeklyHours,
		totalMonths,
		monthsPreSwitch,
		monthsPostSwitch,
		tvl394JanMar,
		tvlUmJanMar,
		istJanMar,
		tvl394AbApr,
		tvlUmAbApr,
		istAbApr,
		sueZulage394,
		sueZulageUm,
		besitzstand,
		vwl,
		avgMonthlyGross394,
		avgMonthlyGrossUm,
		avgMonthlyGrossIst,
		grossWithoutJsz394,
		grossWithoutJszUm,
		grossWithoutJszIst,
		jszRatePct,
		jsz394,
		jszUm,
		jszIst,
		grossWithJsz394,
		grossWithJszUm,
		grossWithJszIst,
		kvAmount394,
		kvAmountUm,
		kvAmountIst,
		kkzAmount394,
		kkzAmountUm,
		kkzAmountIst,
		rvAmount394,
		rvAmountUm,
		rvAmountIst,
		avAmount394,
		avAmountUm,
		avAmountIst,
		pvAmount394,
		pvAmountUm,
		pvAmountIst,
		vorsorgeAmount394,
		vorsorgeAmountUm,
		vorsorgeAmountIst,
		u1Amount394,
		u1AmountUm,
		u1AmountIst,
		u2Amount394,
		u2AmountUm,
		u2AmountIst,
		u3Amount394,
		u3AmountUm,
		u3AmountIst,
		totalAgSv394,
		totalAgSvUm,
		totalAgSvIst,
		personalkostenPeriod394,
		personalkostenPeriodUm,
		personalkostenPeriodIst,
		avgMonthlyAgGrossUm,
		avgMonthlyAgGrossIst,
		deltaIstTvl
	};
}

/**
 * Normalizes insurance fund names for robust matching (e.g. 'DAK (15,9%)' -> 'DAK').
 */
export function normalizeInsuranceName(name: string): string {
	return name
		.toLowerCase()
		.replace(/\(.*?\)/g, '')
		.replace(/krankenkasse|ersatzkasse|nordost|plus|gesundheit|pflege|direkt/gi, '')
		.trim();
}

/**
 * Finds the best matching insurance fund from the parsed AGA list.
 */
export function findMatchingInsuranceFund(
	fundName: string,
	insuranceFunds: InsuranceFundDetails[] = DEFAULT_INSURANCE_FUNDS
): InsuranceFundDetails {
	if (!fundName || insuranceFunds.length === 0) {
		return insuranceFunds[0] || DEFAULT_INSURANCE_FUNDS[0];
	}

	const norm = normalizeInsuranceName(fundName);

	// 1. Direct name equality
	const exact = insuranceFunds.find(
		(f) => f.name.toLowerCase() === fundName.toLowerCase() || normalizeInsuranceName(f.name) === norm
	);
	if (exact) return exact;

	// 2. Substring matching (e.g. 'DAK (15,9%)' contains 'dak')
	const sub = insuranceFunds.find((f) => {
		const fNorm = normalizeInsuranceName(f.name);
		return (
			fundName.toLowerCase().includes(f.name.toLowerCase()) ||
			f.name.toLowerCase().includes(fundName.toLowerCase()) ||
			(norm.length >= 2 && fNorm.length >= 2 && (norm.includes(fNorm) || fNorm.includes(norm)))
		);
	});
	if (sub) return sub;

	// 3. Known aliases
	if (norm.includes('tk') || norm.includes('techniker')) {
		const tk = insuranceFunds.find(
			(f) => f.name.toLowerCase().includes('tk') || f.name.toLowerCase().includes('techniker')
		);
		if (tk) return tk;
	}
	if (norm.includes('aok')) {
		const aok = insuranceFunds.find((f) => f.name.toLowerCase().includes('aok'));
		if (aok) return aok;
	}
	if (norm.includes('barmer')) {
		const barmer = insuranceFunds.find((f) => f.name.toLowerCase().includes('barmer'));
		if (barmer) return barmer;
	}
	if (norm.includes('dak')) {
		const dak = insuranceFunds.find((f) => f.name.toLowerCase().includes('dak'));
		if (dak) return dak;
	}
	if (norm.includes('ikk')) {
		const ikk = insuranceFunds.find((f) => f.name.toLowerCase().includes('ikk'));
		if (ikk) return ikk;
	}
	if (norm.includes('kkh')) {
		const kkh = insuranceFunds.find((f) => f.name.toLowerCase().includes('kkh'));
		if (kkh) return kkh;
	}

	return insuranceFunds[0] || DEFAULT_INSURANCE_FUNDS[0];
}

/**
 * Master calculation function for the entire TV-L Comparison form.
 */
export function calculateTvlComparison(
	records: MonthlyRecord[],
	participant: ParticipantInfo,
	selectedYear?: number,
	customInputs?: Partial<TvlComparisonInputs>,
	insuranceFunds: InsuranceFundDetails[] = DEFAULT_INSURANCE_FUNDS
): TvlComparisonResult {
	const allYears = Array.from(new Set(records.map((r) => r.year))).sort((a, b) => a - b);
	const year = selectedYear || (allYears.includes(2026) ? 2026 : (allYears[allYears.length - 1] || 2026));
	const yearRecords = records.filter((r) => r.year === year);

	// Locate participant's insurance fund
	const requestedFundName = customInputs?.selectedInsuranceName || participant.healthInsuranceName || 'DAK';
	const matchedFund = findMatchingInsuranceFund(requestedFundName, insuranceFunds);

	// Rates
	const kvRate = customInputs?.kvRate !== undefined ? customInputs.kvRate : STATUTORY_SV_RATES.KV_RATE;
	const kkZusatzRate = customInputs?.kkZusatzRate !== undefined ? customInputs.kkZusatzRate : matchedFund.zusatzbeitragAg;
	const rvRate = customInputs?.rvRate !== undefined ? customInputs.rvRate : STATUTORY_SV_RATES.RV_RATE;
	const avRate = customInputs?.avRate !== undefined ? customInputs.avRate : STATUTORY_SV_RATES.AV_RATE;
	const pvRate = customInputs?.pvRate !== undefined ? customInputs.pvRate : STATUTORY_SV_RATES.PV_RATE;
	const vorsorgeRate = customInputs?.vorsorgeRate !== undefined ? customInputs.vorsorgeRate : STATUTORY_SV_RATES.VORSORGE_RATE;
	const u1Rate = customInputs?.u1Rate !== undefined ? customInputs.u1Rate : matchedFund.u1Rate;
	const u2Rate = customInputs?.u2Rate !== undefined ? customInputs.u2Rate : matchedFund.u2Rate;
	const u3Rate = customInputs?.u3Rate !== undefined ? customInputs.u3Rate : matchedFund.u3Rate;

	const svRates = {
		kvRate,
		kkZusatzRate,
		rvRate,
		avRate,
		pvRate,
		vorsorgeRate,
		u1Rate,
		u2Rate,
		u3Rate
	};

	// Determine Step Upgrade in selected year
	// 1. Detect if any month in yearRecords has a split or wage jump
	let splitRecordIdx = -1;
	for (let i = 0; i < yearRecords.length; i++) {
		const rec = yearRecords[i];
		const prev = i > 0 ? yearRecords[i - 1] : null;

		if (prev && prev.month === rec.month && (prev.monthUnits < 1.0 || rec.monthUnits < 1.0)) {
			splitRecordIdx = i;
			break;
		}

		if (rec.startDate && !rec.startDate.startsWith('01.') && !rec.startDate.startsWith('1.') && i > 0) {
			splitRecordIdx = i;
			break;
		}

		if (prev && rec.fteSalary > prev.fteSalary && rec.month !== 4) {
			splitRecordIdx = i;
			break;
		}
	}

	// 2. Detect entry date anniversary
	const entryParsed = parseDateDMY(participant.runtimeStart || '16.01.2023');
	let anniversaryInYear = false;
	let anniversaryStep = 2;

	if (entryParsed) {
		const startYear = entryParsed.year;
		const diffYears = year - startYear;
		const initialStepNum = parseInt((participant.tariffStep.match(/\d+/) || ['1'])[0], 10);

		if (initialStepNum === 1) {
			if (diffYears === 1) { anniversaryInYear = true; anniversaryStep = 2; }
			else if (diffYears === 3) { anniversaryInYear = true; anniversaryStep = 3; }
			else if (diffYears === 6) { anniversaryInYear = true; anniversaryStep = 4; }
		} else if (initialStepNum === 2) {
			if (diffYears === 3) { anniversaryInYear = true; anniversaryStep = 3; }
			else if (diffYears === 6) { anniversaryInYear = true; anniversaryStep = 4; }
		}
	}

	let hasStepUpgrade = false;
	if (customInputs?.hasStepUpgrade !== undefined) {
		hasStepUpgrade = Boolean(customInputs.hasStepUpgrade);
	} else {
		hasStepUpgrade = splitRecordIdx >= 0 || anniversaryInYear;
	}

	// Calculate appropriate Step Codes for Left and Right
	const initialStepNum = parseInt((participant.tariffStep.match(/\d+/) || ['1'])[0], 10);
	let currentStepInYear = initialStepNum;
	let nextStepInYear = Math.min(6, initialStepNum + 1);

	if (entryParsed) {
		const diffYears = year - entryParsed.year;
		if (diffYears >= 3) {
			currentStepInYear = anniversaryInYear ? 2 : 3;
			nextStepInYear = 3;
		} else if (diffYears >= 1) {
			currentStepInYear = anniversaryInYear ? 1 : 2;
			nextStepInYear = 2;
		}
	}

	const tariffGroup = participant.tariffGroup.replace(/\s+/g, '').replace('EG', 'E') || 'E2';
	const baseCodeLeft = normalizeTvlTariffCode(customInputs?.tariffGroupStepLeft || `${tariffGroup}/${currentStepInYear}`);
	const baseCodeRight = normalizeTvlTariffCode(customInputs?.tariffGroupStepRight || `${tariffGroup}/${nextStepInYear}`);

	// Set dates for Left & Right
	let defaultStartLeft = `01.01.${year}`;
	let defaultEndLeft = `31.12.${year}`;
	let defaultStartRight = `16.01.${year}`;
	let defaultEndRight = `31.12.${year}`;

	if (hasStepUpgrade) {
		if (splitRecordIdx >= 0) {
			const preRec = yearRecords[splitRecordIdx - 1];
			const postRec = yearRecords[splitRecordIdx];
			defaultStartLeft = yearRecords[0]?.startDate || `01.01.${year}`;
			defaultEndLeft = preRec?.endDate || `15.01.${year}`;
			defaultStartRight = postRec?.startDate || `16.01.${year}`;
			defaultEndRight = yearRecords[yearRecords.length - 1]?.endDate || `31.12.${year}`;
		} else if (entryParsed) {
			const annDay = entryParsed.day;
			const annMonth = String(entryParsed.month).padStart(2, '0');
			defaultStartLeft = `01.01.${year}`;
			defaultEndLeft = `${String(Math.max(1, annDay - 1)).padStart(2, '0')}.${annMonth}.${year}`;
			defaultStartRight = `${String(annDay).padStart(2, '0')}.${annMonth}.${year}`;
			defaultEndRight = `31.12.${year}`;
		}
	} else {
		defaultStartLeft = yearRecords[0]?.startDate || `01.01.${year}`;
		defaultEndLeft = yearRecords[yearRecords.length - 1]?.endDate || `31.12.${year}`;
	}

	// Salaried amounts from records
	let istJanMarLeft = 0;
	let istAbAprLeft = 0;
	let istJanMarRight = 0;
	let istAbAprRight = 0;
	let istJszRight = 0;

	if (hasStepUpgrade && splitRecordIdx >= 0) {
		const preRec = yearRecords[splitRecordIdx - 1];
		const postRec = yearRecords[splitRecordIdx];
		const aprPostRec = yearRecords.find((r) => r.month >= 4 && r.month <= 12) || postRec;

		istJanMarLeft = preRec.fullMonthlyPartTime || preRec.partTimeSalary;
		istJanMarRight = postRec.fullMonthlyPartTime || postRec.partTimeSalary;
		istAbAprRight = aprPostRec.fullMonthlyPartTime || aprPostRec.partTimeSalary;
		istAbAprLeft = istJanMarLeft + (istAbAprRight > istJanMarRight ? istAbAprRight - istJanMarRight : 0);
	} else if (hasStepUpgrade) {
		const firstRec = yearRecords[0];
		const aprRec = yearRecords.find((r) => r.month >= 4 && r.month <= 12) || firstRec;
		istJanMarLeft = firstRec ? firstRec.fullMonthlyPartTime || firstRec.partTimeSalary : 2139.93;
		istAbAprLeft = aprRec ? aprRec.fullMonthlyPartTime || aprRec.partTimeSalary : istJanMarLeft;
		istJanMarRight = istJanMarLeft;
		istAbAprRight = istAbAprLeft;
	} else {
		const firstRec = yearRecords[0];
		const aprRec = yearRecords.find((r) => r.month >= 4 && r.month <= 12) || firstRec;
		istJanMarLeft = firstRec ? firstRec.fullMonthlyPartTime || firstRec.partTimeSalary : 2188.35;
		istAbAprLeft = aprRec ? aprRec.fullMonthlyPartTime || aprRec.partTimeSalary : istJanMarLeft;
	}

	// JSZ from December or November record
	const jszRec = yearRecords.find((r) => r.jszAmount > 0) || yearRecords.find((r) => r.month === 12);
	if (jszRec && jszRec.jszAmount > 0) {
		istJszRight = jszRec.jszAmount;
	}

	// Fallback/Overrides
	if (customInputs?.istJanMarLeft !== undefined) istJanMarLeft = customInputs.istJanMarLeft;
	if (customInputs?.istAbAprLeft !== undefined) istAbAprLeft = customInputs.istAbAprLeft;
	if (customInputs?.istJanMarRight !== undefined) istJanMarRight = customInputs.istJanMarRight;
	if (customInputs?.istAbAprRight !== undefined) istAbAprRight = customInputs.istAbAprRight;
	if (customInputs?.istJszRight !== undefined) istJszRight = customInputs.istJszRight;

	const inputs: TvlComparisonInputs = {
		year,
		traegerName: customInputs?.traegerName || 'BALL e.V.',
		antragsdatum: customInputs?.antragsdatum || `31.08.${year}`,
		projektnummer: customInputs?.projektnummer || '2024000653',
		participantName: customInputs?.participantName || participant.name,
		qualifikation: customInputs?.qualifikation || 'FA Textil',
		taetigkeit: customInputs?.taetigkeit || 'Helfer-, Büro und Verwaltung',
		eintrittsdatum: customInputs?.eintrittsdatum || participant.runtimeStart || `16.01.2023`,
		abweichendeTaetigkeit: customInputs?.abweichendeTaetigkeit || '',

		tariffGroupStepLeft: customInputs?.tariffGroupStepLeft || baseCodeLeft,
		startDateLeft: customInputs?.startDateLeft || defaultStartLeft,
		endDateLeft: customInputs?.endDateLeft || defaultEndLeft,
		weeklyHoursLeft: customInputs?.weeklyHoursLeft !== undefined ? customInputs.weeklyHoursLeft : participant.weeklyHours,
		istJanMarLeft,
		istAbAprLeft,
		besitzstandLeft: customInputs?.besitzstandLeft || 0,
		vwlLeft: customInputs?.vwlLeft || 0,

		hasStepUpgrade,
		tariffGroupStepRight: customInputs?.tariffGroupStepRight || baseCodeRight,
		startDateRight: customInputs?.startDateRight || defaultStartRight,
		endDateRight: customInputs?.endDateRight || defaultEndRight,
		weeklyHoursRight: customInputs?.weeklyHoursRight !== undefined ? customInputs.weeklyHoursRight : participant.weeklyHours,
		istJanMarRight,
		istAbAprRight,
		besitzstandRight: customInputs?.besitzstandRight || 0,
		vwlRight: customInputs?.vwlRight || 0,
		istJszRight,

		selectedInsuranceName: matchedFund.name,
		kvRate,
		kkZusatzRate,
		rvRate,
		avRate,
		pvRate,
		vorsorgeRate,
		u1Rate,
		u2Rate,
		u3Rate,

		bemerkungen: customInputs?.bemerkungen || 'Tarif AWO Berlin 10.ÄTV + Tarifeinigung vom 5.5.2026, Jahressonderzahlung monatsanteilig 85% vom Septembergehalt, wenn am 1.12. angestellt',
		bearbeiterName: customInputs?.bearbeiterName || 'Maxim Müller',
		bearbeiterDate: customInputs?.bearbeiterDate || `31.08.${year}`
	};

	// Calculate Left Period
	const periodLeft = calculatePeriod(
		inputs.tariffGroupStepLeft,
		inputs.startDateLeft,
		inputs.endDateLeft,
		inputs.weeklyHoursLeft,
		inputs.istJanMarLeft,
		inputs.istAbAprLeft,
		inputs.besitzstandLeft,
		inputs.vwlLeft,
		false,
		svRates,
		{
			year,
			contractStartDate: inputs.eintrittsdatum,
			istJsz: undefined
		}
	);

	// Calculate Right Period (if step upgrade enabled)
	let periodRight: TvlPeriodCalculation | undefined = undefined;
	if (inputs.hasStepUpgrade) {
		periodRight = calculatePeriod(
			inputs.tariffGroupStepRight,
			inputs.startDateRight,
			inputs.endDateRight,
			inputs.weeklyHoursRight,
			inputs.istJanMarRight,
			inputs.istAbAprRight,
			inputs.besitzstandRight,
			inputs.vwlRight,
			true,
			svRates,
			{
				year,
				contractStartDate: inputs.eintrittsdatum,
				istJsz: inputs.istJszRight
			}
		);
	}

	// Compute Overall Combined Totals
	const totalMonths = periodLeft.totalMonths + (periodRight ? periodRight.totalMonths : 0);
	const totalPersonalkosten394 = round2(periodLeft.personalkostenPeriod394 + (periodRight ? periodRight.personalkostenPeriod394 : 0));
	const totalPersonalkostenTvl = round2(periodLeft.personalkostenPeriodUm + (periodRight ? periodRight.personalkostenPeriodUm : 0));
	const totalPersonalkostenIst = round2(periodLeft.personalkostenPeriodIst + (periodRight ? periodRight.personalkostenPeriodIst : 0));

	const avgMonthlyAgGrossTvl = round2(totalPersonalkostenTvl / (totalMonths || 1));
	const avgMonthlyAgGrossIst = round2(totalPersonalkostenIst / (totalMonths || 1));

	const totalDifference = round2(totalPersonalkostenIst - totalPersonalkostenTvl);
	const isBesserstellungsverbotCompliant = totalDifference <= 0.01;

	// AWO Tariff Lookup for Expected Actual Payments (Ist-Zahlungen)
	const leftStepMatch = inputs.tariffGroupStepLeft.match(/\/(\d+)/);
	const leftStepNum = leftStepMatch ? parseInt(leftStepMatch[1], 10) : 1;
	const leftGroup = inputs.tariffGroupStepLeft.split('/')[0] || 'E2';

	const awoPreLeft = getAwoTariffSalary(leftGroup, leftStepNum, year, 1, inputs.weeklyHoursLeft);
	const awoPostLeft = getAwoTariffSalary(leftGroup, leftStepNum, year, year === 2026 ? 9 : 7, inputs.weeklyHoursLeft);

	const expectedIstJanMarLeft = awoPreLeft ? awoPreLeft.partTimeSalary : istJanMarLeft;
	const expectedIstAbAprLeft = awoPostLeft ? awoPostLeft.partTimeSalary : istAbAprLeft;

	let expectedIstJanMarRight: number | undefined = undefined;
	let expectedIstAbAprRight: number | undefined = undefined;

	if (inputs.hasStepUpgrade) {
		const rightStepMatch = inputs.tariffGroupStepRight.match(/\/(\d+)/);
		const rightStepNum = rightStepMatch ? parseInt(rightStepMatch[1], 10) : leftStepNum + 1;
		const rightGroup = inputs.tariffGroupStepRight.split('/')[0] || leftGroup;

		const awoPreRight = getAwoTariffSalary(rightGroup, rightStepNum, year, 1, inputs.weeklyHoursRight);
		const awoPostRight = getAwoTariffSalary(rightGroup, rightStepNum, year, year === 2026 ? 9 : 7, inputs.weeklyHoursRight);

		expectedIstJanMarRight = awoPreRight ? awoPreRight.partTimeSalary : istJanMarRight;
		expectedIstAbAprRight = awoPostRight ? awoPostRight.partTimeSalary : istAbAprRight;
	}

	// Validate all records in Berechnungsblatt against AWO tariff maps
	const tariffValidation = validateBerechnungsblattTariff(records, participant);

	const availableTariffs = getAllTvlTariffCodes(year);

	return {
		year,
		inputs,
		periodLeft,
		periodRight,
		totalMonths,
		totalPersonalkosten394,
		totalPersonalkostenTvl,
		totalPersonalkostenIst,
		avgMonthlyAgGrossTvl,
		avgMonthlyAgGrossIst,
		totalDifference,
		isBesserstellungsverbotCompliant,
		availableYears: allYears.length > 0 ? allYears : [2026],
		availableTariffs,
		availableInsuranceFunds: insuranceFunds,
		tariffValidation,
		expectedIstJanMarLeft,
		expectedIstAbAprLeft,
		expectedIstJanMarRight,
		expectedIstAbAprRight
	};
}
