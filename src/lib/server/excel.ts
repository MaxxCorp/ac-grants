import * as XLSX from 'xlsx';
import type { ParticipantInfo, MonthlyRecord, AgaRatePeriod } from '#lib/types/grant';

/**
 * Normalizes Excel date representations (serial numbers, Date objects, or date strings).
 * Fixes anomalies like leap year errors (e.g. 29.02.2029 -> 2029-02-28).
 */
export function normalizeExcelDate(rawDate: unknown): { dateStr: string; year: number; month: number } {
	if (!rawDate) {
		return { dateStr: '', year: 0, month: 0 };
	}

	if (typeof rawDate === 'number') {
		if (XLSX.SSF && typeof XLSX.SSF.parse_date_code === 'function') {
			const parsed = XLSX.SSF.parse_date_code(rawDate);
			if (parsed) {
				const y = parsed.y;
				const m = Math.max(1, Math.min(12, parsed.m || 1));
				const d = Math.max(1, Math.min(31, parsed.d || 1));
				const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
				return { dateStr, year: y, month: m };
			}
		} else {
			// Fallback: Excel epoch is 1899-12-30
			const epoch = new Date(Date.UTC(1899, 11, 30));
			const target = new Date(epoch.getTime() + rawDate * 86400000);
			const y = target.getUTCFullYear();
			const m = target.getUTCMonth() + 1;
			const d = target.getUTCDate();
			const validM = Math.max(1, Math.min(12, m));
			const dateStr = `${y}-${String(validM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
			return { dateStr, year: y, month: validM };
		}
	}

	const str = String(rawDate).trim();

	// Handle "DD.MM.YYYY" or "D.M.YY" or "DD.MM.YY"
	const ddmmyyyy = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
	if (ddmmyyyy) {
		const d = parseInt(ddmmyyyy[1], 10);
		const m = parseInt(ddmmyyyy[2], 10);
		let y = parseInt(ddmmyyyy[3], 10);
		if (y < 100) y += 2000;
		let finalDay = d;
		if (m === 2 && d === 29) {
			const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
			if (!isLeap) finalDay = 28;
		}
		const validM = Math.max(1, Math.min(12, m || 1));
		const dateStr = `${y}-${String(validM).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
		return { dateStr, year: y, month: validM };
	}

	// Handle slash dates (e.g. M/D/YY or DD/MM/YYYY)
	const slashDate = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
	if (slashDate) {
		let p1 = parseInt(slashDate[1], 10);
		let p2 = parseInt(slashDate[2], 10);
		let y = parseInt(slashDate[3], 10);
		if (y < 100) y += 2000;

		let m = p1;
		let d = p2;
		if (p1 > 12 && p2 <= 12) {
			d = p1;
			m = p2;
		}

		let finalDay = d;
		if (m === 2 && d === 29) {
			const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
			if (!isLeap) finalDay = 28;
		}
		const validM = Math.max(1, Math.min(12, m || 1));
		const dateStr = `${y}-${String(validM).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
		return { dateStr, year: y, month: validM };
	}

	// Try standard date parsing
	const parsedDate = new Date(str);
	if (!isNaN(parsedDate.getTime())) {
		const y = parsedDate.getFullYear();
		const m = parsedDate.getMonth() + 1;
		const d = parsedDate.getDate();
		const validM = Math.max(1, Math.min(12, m));
		return {
			dateStr: `${y}-${String(validM).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
			year: y,
			month: validM
		};
	}

	return { dateStr: str, year: 0, month: 1 };
}

function parseNumber(val: unknown, defaultVal = 0): number {
	if (val === null || val === undefined) return defaultVal;
	if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
	const s = String(val).replace(/[^0-9.,-]/g, '').replace(',', '.');
	const parsed = parseFloat(s);
	return isNaN(parsed) ? defaultVal : parsed;
}

export interface ParsedExcelWorkbook {
	participant: ParticipantInfo;
	records: MonthlyRecord[];
	availableInsuranceRates: { name: string; agaRate: number }[];
	years: number[];
}

export function parseExcelBuffer(buffer: Buffer | Uint8Array): ParsedExcelWorkbook {
	const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: true });
	return parseWorkbook(workbook);
}

export function parseWorkbook(workbook: XLSX.WorkBook): ParsedExcelWorkbook {
	const gehaltSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('gehalt')) || workbook.SheetNames[0];
	const sheet = workbook.Sheets[gehaltSheetName];

	if (!sheet) {
		throw new Error(`Sheet "${gehaltSheetName}" not found in workbook.`);
	}

	const getCellValue = (colLetter: string, rowNumber: number): unknown => {
		const cell = sheet[`${colLetter}${rowNumber}`];
		return cell ? cell.v : undefined;
	};

	// Parse Participant Metadata from Row 2
	const rawName = String(getCellValue('A', 2) || 'Frau Nadine Langner').trim();
	const rawEG = String(getCellValue('B', 2) || 'EG1').trim();
	const rawES = String(getCellValue('C', 2) || 'ES1').trim();
	const rawRuntime = String(getCellValue('F', 2) || '01.08.2026 - 31.07.2031').trim();
	const weeklyHours = parseNumber(getCellValue('J', 2), 30);
	const sachkostenMonthly = parseNumber(getCellValue('M', 2), 155);
	const childrenCount = parseNumber(getCellValue('U', 2), 2);
	const healthInsuranceName = String(getCellValue('W', 2) || 'Barmer').trim();
	const defaultAgaRate = parseNumber(getCellValue('Y', 2), 0.23815);

	let runtimeStart = '01.08.2026';
	let runtimeEnd = '31.07.2031';
	const runtimeParts = rawRuntime.split('-').map(s => s.trim());
	if (runtimeParts.length === 2) {
		runtimeStart = runtimeParts[0];
		runtimeEnd = runtimeParts[1];
	}

	const participant: ParticipantInfo = {
		name: rawName,
		tariffGroup: rawEG,
		tariffStep: rawES,
		runtimeStart,
		runtimeEnd,
		weeklyHours,
		fullTimeHours: 39,
		sachkostenMonthly,
		childrenCount,
		healthInsuranceName,
		defaultAgaRate
	};

	// Parse monthly records from Row 11 onwards
	const records: MonthlyRecord[] = [];
	let lastPendingJsz = 0;
	let lastPendingJszAga = 0;

	// Loop through rows up to 105
	for (let r = 11; r <= 100; r++) {
		const colA = getCellValue('A', r);
		const colF = getCellValue('F', r);
		const colO = getCellValue('O', r);

		// Check if this is a JSZ (Jahressonderzahlung) row
		if (colO && String(colO).includes('Jahressonderzahlung')) {
			lastPendingJsz = parseNumber(getCellValue('X', r), 0);
			continue;
		}

		// Check if this is a JSZ AGA row
		if (colO && String(colO).includes('AGA auf JSZ')) {
			lastPendingJszAga = parseNumber(getCellValue('X', r), 0);

			// Attach JSZ to the previous monthly record (usually the last month of that year, e.g. Dec)
			if (records.length > 0) {
				const lastRecord = records[records.length - 1];
				lastRecord.jszAmount = lastPendingJsz;
				lastRecord.jszAgaAmount = lastPendingJszAga;
				lastRecord.isJszMonth = true;
			}
			lastPendingJsz = 0;
			lastPendingJszAga = 0;
			continue;
		}

		// If row has Date in Col A and FTE Salary in Col F
		if (colA && colF) {
			const { dateStr, year, month } = normalizeExcelDate(colA);
			if (!dateStr || year === 0) continue;

			const fteSalary = parseNumber(colF, 0);
			if (fteSalary <= 0) continue; // Skip zero/empty salary rows

			const monthUnits = parseNumber(getCellValue('B', r), 1.0);
			const safeMonthUnits = monthUnits > 0 ? monthUnits : 1.0;

			let resolvedYear = year;
			let resolvedMonth = month;
			let day = parseInt(dateStr.split('-')[2], 10);

			// Heal copy-paste artifacts where a split row duplicated the previous full-month's date
			if (records.length > 0) {
				const prevRec = records[records.length - 1];
				// If previous record was a full month of same year & month, and this row is 0.5 month
				if (prevRec.year === resolvedYear && prevRec.month === resolvedMonth && prevRec.monthUnits >= 1.0 && safeMonthUnits < 1.0) {
					resolvedMonth = resolvedMonth + 1;
					if (resolvedMonth > 12) {
						resolvedYear += 1;
						resolvedMonth = 1;
					}
					day = 15;
				}
			}

			const lastDay = new Date(resolvedYear, resolvedMonth, 0).getDate();
			const mStr = String(resolvedMonth).padStart(2, '0');

			let rowStartDate = `01.${mStr}.${resolvedYear}`;
			let rowEndDate = `${String(lastDay).padStart(2, '0')}.${mStr}.${resolvedYear}`;

			if (safeMonthUnits < 1.0) {
				const prevRec = records.length > 0 ? records[records.length - 1] : null;
				const isSecondHalfOfSameMonth = prevRec && prevRec.year === resolvedYear && prevRec.month === resolvedMonth && prevRec.monthUnits < 1.0;

				if (isSecondHalfOfSameMonth) {
					// Second half of month
					rowStartDate = `16.${mStr}.${resolvedYear}`;
					rowEndDate = `${String(lastDay).padStart(2, '0')}.${mStr}.${resolvedYear}`;
				} else if (day <= 15) {
					// First half of month
					rowStartDate = `01.${mStr}.${resolvedYear}`;
					rowEndDate = `15.${mStr}.${resolvedYear}`;
				} else {
					// Standalone or second half
					rowStartDate = `16.${mStr}.${resolvedYear}`;
					rowEndDate = `${String(lastDay).padStart(2, '0')}.${mStr}.${resolvedYear}`;
				}
			} else {
				rowStartDate = `01.${mStr}.${resolvedYear}`;
				rowEndDate = `${String(lastDay).padStart(2, '0')}.${mStr}.${resolvedYear}`;
			}

			// Respect contract start and end if on boundary
			if (participant.runtimeStart && participant.runtimeStart.endsWith(`.${mStr}.${resolvedYear}`)) {
				const startDay = parseInt(participant.runtimeStart.split('.')[0], 10);
				if (startDay > 1 && (!rowStartDate || rowStartDate.startsWith('01.'))) {
					rowStartDate = participant.runtimeStart;
				}
			}
			if (participant.runtimeEnd && participant.runtimeEnd.endsWith(`.${mStr}.${resolvedYear}`)) {
				const endDay = parseInt(participant.runtimeEnd.split('.')[0], 10);
				if (endDay < lastDay && (safeMonthUnits < 1.0 || day === endDay)) {
					rowEndDate = participant.runtimeEnd;
				}
			}

			// Unscaled full monthly values (for 30h/wk full month)
			const fullMonthlyPartTime = (fteSalary * weeklyHours) / 39;
			const fullMonthlyFlatRate = fullMonthlyPartTime * 0.19;
			const fullMonthlyJcTotalGross = fullMonthlyPartTime + fullMonthlyFlatRate;
			const fullMonthlySvShortfall = fullMonthlyPartTime * (defaultAgaRate - 0.19);

			// Actual scaled record values
			const partTimeSalary = parseNumber(getCellValue('G', r), fullMonthlyPartTime * safeMonthUnits);
			const jcFlatRateAmount = parseNumber(getCellValue('H', r), partTimeSalary * 0.19);
			const jcTotalGross = parseNumber(getCellValue('I', r), partTimeSalary + jcFlatRateAmount);
			const jcDegressionPct = parseNumber(getCellValue('J', r), 100);
			const jcGrantAmount = parseNumber(getCellValue('K', r), (jcTotalGross * jcDegressionPct) / 100);
			const tariffDelta = parseNumber(getCellValue('M', r), 0);

			const agaRealAmount = parseNumber(getCellValue('U', r), partTimeSalary * defaultAgaRate);
			const totalEmployerCost = parseNumber(getCellValue('V', r), partTimeSalary + agaRealAmount);
			const landSvShortfall = parseNumber(getCellValue('X', r), totalEmployerCost - jcTotalGross);
			const landDegressionAmount = parseNumber(getCellValue('Y', r), 0);
			const sachkostenAmount = parseNumber(getCellValue('Z', r), sachkostenMonthly * safeMonthUnits);

			records.push({
				date: dateStr,
				year,
				month,
				monthUnits: safeMonthUnits,
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
				agaRealRate: defaultAgaRate,
				agaRealAmount,
				totalEmployerCost,
				landSvShortfall,
				fullMonthlySvShortfall,
				landDegressionAmount,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount,
				tariffDelta: tariffDelta > 0 ? tariffDelta : undefined
			});
		}
	}

	// Parse available insurance rates from AGA sheet if present
	const availableInsuranceRates: { name: string; agaRate: number }[] = [
		{ name: 'Barmer', agaRate: 0.23815 },
		{ name: 'AOK BLN-BRB', agaRate: 0.2387 },
		{ name: 'Techniker', agaRate: 0.22935 },
		{ name: 'BIG direkt', agaRate: 0.25285 },
		{ name: 'BKK VBU', agaRate: 0.2448 },
		{ name: 'DAK', agaRate: 0.2314 },
		{ name: 'IKK BLN-BRB', agaRate: 0.25415 },
		{ name: 'KKH', agaRate: 0.2398 },
		{ name: 'Bahn-BKK', agaRate: 0.25295 },
		{ name: 'Novitas BKK', agaRate: 0.2425 }
	];

	const agaSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('aga'));
	if (agaSheetName && workbook.Sheets[agaSheetName]) {
		const agaSheet = workbook.Sheets[agaSheetName];
		// Read rows 5 to 16
		for (let r = 5; r <= 16; r++) {
			const insNameCell = agaSheet[`A${r}`];
			const agRateCell = agaSheet[`O${r}`] || agaSheet[`R${r}`];
			if (insNameCell && agRateCell) {
				const name = String(insNameCell.v).trim();
				let rate = parseNumber(agRateCell.v, 0);
				if (rate > 1) rate = rate / 100;
				if (name && rate > 0) {
					const existing = availableInsuranceRates.find(i => i.name.toLowerCase() === name.toLowerCase());
					if (existing) {
						existing.agaRate = rate;
					} else {
						availableInsuranceRates.push({ name, agaRate: rate });
					}
				}
			}
		}
	}

	const years = Array.from(new Set(records.map(r => r.year))).sort((a, b) => a - b);

	return {
		participant,
		records,
		availableInsuranceRates,
		years
	};
}
