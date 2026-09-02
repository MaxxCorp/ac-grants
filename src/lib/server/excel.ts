import * as XLSX from 'xlsx';
import type { ParticipantInfo, MonthlyRecord, AgaRatePeriod, InsuranceFundDetails, TariffReclassification } from '#lib/types/grant';
import { DEFAULT_INSURANCE_FUNDS } from '#lib/grants/tvl-tariff-data';

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

export function normalizeTariffStep(val: unknown): string {
	if (val === null || val === undefined) return 'ES1';
	const s = String(val).trim();
	if (!s) return 'ES1';
	const match = s.match(/\d+/);
	if (match) {
		const num = parseInt(match[0], 10);
		if (num >= 1 && num <= 6) {
			return `ES${num}`;
		}
	}
	const upper = s.toUpperCase().replace(/\s+/g, '');
	if (upper.startsWith('ES')) {
		return upper;
	}
	return 'ES1';
}

export function parseNumber(val: unknown, defaultVal = 0): number {
	if (val === null || val === undefined) return defaultVal;
	if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
	let s = String(val).trim();
	if (!s) return defaultVal;

	// Strip currency, spaces, non-numeric characters except . , -
	s = s.replace(/[^0-9.,-]/g, '');
	if (!s) return defaultVal;

	// Handle both '.' and ',' (e.g. German "2.781,91" or US "2,781.91")
	if (s.includes('.') && s.includes(',')) {
		if (s.indexOf('.') < s.indexOf(',')) {
			// German style: 2.781,91 -> 2781.91
			s = s.replace(/\./g, '').replace(',', '.');
		} else {
			// US style: 2,781.91 -> 2781.91
			s = s.replace(/,/g, '');
		}
	} else if (s.includes(',')) {
		// Only comma: 2139,93 -> 2139.93
		s = s.replace(',', '.');
	}

	const parsed = parseFloat(s);
	return isNaN(parsed) ? defaultVal : parsed;
}

export interface ParsedExcelWorkbook {
	participant: ParticipantInfo;
	records: MonthlyRecord[];
	availableInsuranceRates: { name: string; agaRate: number }[];
	insuranceFunds: InsuranceFundDetails[];
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
		if (!cell) return undefined;
		if (cell.v !== undefined && cell.v !== null && cell.v !== '') {
			return cell.v;
		}
		return cell.w;
	};

	const getCellFormattedText = (colLetter: string, rowNumber: number): string => {
		const cell = sheet[`${colLetter}${rowNumber}`];
		if (!cell) return '';
		if (cell.w !== undefined && cell.w !== null && cell.w !== '') {
			return String(cell.w).trim();
		}
		if (cell.v !== undefined && cell.v !== null && cell.v !== '') {
			return String(cell.v).trim();
		}
		return '';
	};

	// Parse Participant Metadata from Row 2
	const rawName = String(getCellValue('A', 2) || 'Teilnehmer/in').trim();
	const rawEG = String(getCellValue('B', 2) || 'EG1').trim();
	const rawES = normalizeTariffStep(getCellValue('C', 2));
	const rawRuntime = String(getCellValue('F', 2) || '').trim();
	const weeklyHours = parseNumber(getCellValue('J', 2), 30);
	const sachkostenMonthly = parseNumber(getCellValue('M', 2), 155);
	const childrenCount = parseNumber(getCellValue('U', 2), 0);
	
	let rawHealthInsurance = getCellFormattedText('W', 2);
	if (!rawHealthInsurance || rawHealthInsurance.toLowerCase() === 'gkv') {
		for (const col of ['V', 'X']) {
			const alt = getCellFormattedText(col, 2);
			if (alt && !alt.match(/^[\d.,%]+$/) && alt.toLowerCase() !== 'gkv') {
				rawHealthInsurance = alt;
				break;
			}
		}
	}
	const healthInsuranceName = rawHealthInsurance || 'DAK';
	const defaultAgaRate = parseNumber(getCellValue('Y', 2), 0.2314);

	let defaultBgRate = 0.018;
	for (const col of ['Z', 'AA', 'AB', 'Y', 'X']) {
		const txt = getCellFormattedText(col, 2).toLowerCase();
		if (txt.includes('bg') || txt.includes('unfall')) {
			const nextCol = String.fromCharCode(col.charCodeAt(0) + 1);
			const nextVal = parseNumber(getCellValue(nextCol, 2), 0);
			if (nextVal > 0) {
				defaultBgRate = nextVal > 1 ? nextVal / 100 : nextVal;
				break;
			}
		}
	}

	// Parse JobCenter-ID and ZGS-ID from Row 1 if present
	let jobcenterId: string | undefined;
	let zgsId: string | undefined;

	for (const col of ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']) {
		const txt = getCellFormattedText(col, 1);
		if (txt.toLowerCase().includes('jobcenter') || txt.toLowerCase().includes('jc')) {
			const nextCol = String.fromCharCode(col.charCodeAt(0) + 1);
			const nextVal = getCellFormattedText(nextCol, 1) || getCellFormattedText(String.fromCharCode(col.charCodeAt(0) + 2), 1);
			if (nextVal && !nextVal.toLowerCase().includes('id')) jobcenterId = nextVal;
		}
		if (txt.toLowerCase().includes('zgs')) {
			const nextCol = String.fromCharCode(col.charCodeAt(0) + 1);
			const nextVal = getCellFormattedText(nextCol, 1) || getCellFormattedText(String.fromCharCode(col.charCodeAt(0) + 2), 1);
			if (nextVal && !nextVal.toLowerCase().includes('id')) zgsId = nextVal;
		}
	}
	if (!jobcenterId) {
		const directF1 = getCellFormattedText('F', 1);
		if (directF1 && !directF1.toLowerCase().includes('id') && !directF1.toLowerCase().includes('jobcenter')) {
			jobcenterId = directF1;
		}
	}
	if (!zgsId) {
		const directJ1 = getCellFormattedText('J', 1);
		if (directJ1 && !directJ1.toLowerCase().includes('id') && !directJ1.toLowerCase().includes('zgs')) {
			zgsId = directJ1;
		}
	}

	let runtimeStart = '';
	let runtimeEnd = '';
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
		defaultAgaRate,
		defaultBgRate,
		jobcenterId,
		zgsId
	};

	// Scan Row 3 headers to detect dynamic column layout
	const headerColMap: Record<string, string> = {};
	const candidateCols: string[] = [];
	for (let i = 0; i < 26; i++) candidateCols.push(String.fromCharCode(65 + i));
	for (let i = 0; i < 10; i++) candidateCols.push(`A${String.fromCharCode(65 + i)}`);

	for (const c of candidateCols) {
		const hText = getCellFormattedText(c, 3).toLowerCase().replace(/\s+/g, ' ').trim();
		if (hText) {
			headerColMap[hText] = c;
		}
	}

	const findCol = (keywords: string[], fallback: string): string => {
		for (const [header, col] of Object.entries(headerColMap)) {
			if (keywords.some(kw => header.includes(kw.toLowerCase()))) {
				return col;
			}
		}
		return fallback;
	};

	const colBgCost = findCol(['bg-kosten', 'berufsgenossenschaft', 'bg kosten', 'unfallversicherung'], '');
	const colTotalCostWithBg = findCol(['gesamtkosten inkl. bg', 'gesamt ag-brutto inkl. bg', 'inkl. bg'], '');
	const colJcShare = findCol(['anteil jc', 'egz jc'], colBgCost ? 'Y' : 'W');
	const colZgsShare = findCol(['anteil zgs'], colBgCost ? 'Z' : 'X');
	const colDegressionShare = findCol(['anteil degression'], colBgCost ? 'AA' : 'Y');
	const colSkLand = findCol(['sk-land', 'sachkosten'], colBgCost ? 'AB' : 'Z');

	// Parse monthly records from Row 4 onwards (after header rows)
	const records: MonthlyRecord[] = [];
	let lastPendingJsz = 0;
	let lastPendingJszAga = 0;
	let lastPendingJszBg = 0;

	// Loop through rows up to 130
	for (let r = 4; r <= 130; r++) {
		const colA = getCellValue('A', r);
		const colF = getCellValue('F', r);
		const colO = getCellValue('O', r);

		// Check if this is a JSZ (Jahressonderzahlung) row
		if (colO && String(colO).includes('Jahressonderzahlung')) {
			lastPendingJsz = parseNumber(getCellValue(colZgsShare, r), 0);
			if (colBgCost) {
				lastPendingJszBg = parseNumber(getCellValue(colBgCost, r), 0);
			}
			continue;
		}

		// Check if this is a JSZ AGA row
		if (colO && String(colO).includes('AGA auf JSZ')) {
			lastPendingJszAga = parseNumber(getCellValue(colZgsShare, r), 0);

			// Attach JSZ to the previous monthly record (usually the last month of that year, e.g. Dec)
			if (records.length > 0 && (lastPendingJsz > 0 || lastPendingJszAga > 0)) {
				const lastRecord = records[records.length - 1];
				lastRecord.jszAmount = lastPendingJsz;
				lastRecord.jszAgaAmount = lastPendingJszAga;
				if (lastPendingJszBg > 0) {
					lastRecord.jszBgAmount = lastPendingJszBg;
				}
				lastRecord.isJszMonth = true;
			}
			lastPendingJsz = 0;
			lastPendingJszAga = 0;
			lastPendingJszBg = 0;
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

			let rowAgaRate = defaultAgaRate;
			const colTVal = parseNumber(getCellValue('T', r), 0);
			if (colTVal > 0) {
				rowAgaRate = colTVal > 1 ? colTVal / 100 : colTVal;
			}

			const agaRealAmount = parseNumber(getCellValue('U', r), partTimeSalary * rowAgaRate);
			const totalEmployerCost = parseNumber(getCellValue('V', r), partTimeSalary + agaRealAmount);
			const landSvShortfall = parseNumber(getCellValue(colZgsShare, r), totalEmployerCost - jcTotalGross);
			const landDegressionAmount = parseNumber(getCellValue(colDegressionShare, r), 0);
			const sachkostenAmount = parseNumber(getCellValue(colSkLand, r), sachkostenMonthly * safeMonthUnits);

			// BG calculation
			let bgAmount = 0;
			let totalEmployerCostWithBg = totalEmployerCost;
			let rowBgRate = defaultBgRate;

			if (colBgCost) {
				bgAmount = parseNumber(getCellValue(colBgCost, r), 0);
				if (partTimeSalary > 0 && bgAmount > 0) {
					rowBgRate = bgAmount / partTimeSalary;
				}
			}
			if (colTotalCostWithBg) {
				totalEmployerCostWithBg = parseNumber(getCellValue(colTotalCostWithBg, r), totalEmployerCost + bgAmount);
			} else if (bgAmount > 0) {
				totalEmployerCostWithBg = totalEmployerCost + bgAmount;
			}

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
				agaRealRate: rowAgaRate,
				agaRealAmount,
				totalEmployerCost,
				landSvShortfall,
				fullMonthlySvShortfall,
				landDegressionAmount,
				jszAmount: 0,
				jszAgaAmount: 0,
				sachkostenAmount,
				tariffDelta: tariffDelta > 0 ? tariffDelta : undefined,
				isJszMonth: false,
				bgRate: rowBgRate,
				bgAmount,
				totalEmployerCostWithBg
			});
		}
	}

	// Extract reclassifications from footnotes if present
	const reclassifications: TariffReclassification[] = [];
	for (let r = 70; r <= 140; r++) {
		const txt = getCellFormattedText('A', r);
		if (txt && (txt.includes('Umgruppierung') || txt.includes('Höhergruppierung') || txt.includes('Stufenanpassung'))) {
			const amMatch = txt.match(/(.*)\s+am\s+(\d{1,2}\.\d{1,2}\.\d{4})/);
			if (amMatch) {
				const note = amMatch[1].trim();
				const effectiveDate = amMatch[2];
				const groupMatch = note.match(/(EG\s*\d+|S\s*\d+[a-z]?)/i);
				const stepMatch = note.match(/(ES\s*\d+)/i);
				reclassifications.push({
					id: `reclass-fn-${r}`,
					effectiveDate,
					tariffGroup: groupMatch ? groupMatch[0].replace(/\s+/g, '').toUpperCase() : undefined,
					tariffStep: stepMatch ? stepMatch[0].replace(/\s+/g, '').toUpperCase() : undefined,
					note
				});
			}
		}
	}
	if (reclassifications.length > 0) {
		participant.reclassifications = reclassifications;
	}

	// Parse available insurance funds and rates from AGA sheet if present
	const insuranceFunds: InsuranceFundDetails[] = JSON.parse(JSON.stringify(DEFAULT_INSURANCE_FUNDS));

	const agaSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('aga'));
	if (agaSheetName && workbook.Sheets[agaSheetName]) {
		const agaSheet = workbook.Sheets[agaSheetName];
		// Read rows 5 to 16
		for (let r = 5; r <= 16; r++) {
			const insNameCell = agaSheet[`A${r}`];
			const kvCell = agaSheet[`C${r}`];
			const zusatzCell = agaSheet[`D${r}`];
			const rvCell = agaSheet[`E${r}`];
			const avCell = agaSheet[`F${r}`];
			const u1Cell = agaSheet[`I${r}`];
			const u2Cell = agaSheet[`K${r}`];
			const u3Cell = agaSheet[`L${r}`];
			const agRateCell = agaSheet[`O${r}`] || agaSheet[`R${r}`];

			if (insNameCell && insNameCell.v) {
				const name = String(insNameCell.v).trim();
				if (!name) continue;

				let totalRate = parseNumber(agRateCell ? agRateCell.v : undefined, 0);
				if (totalRate > 1) totalRate = totalRate / 100;

				let kv = parseNumber(kvCell ? kvCell.v : undefined, 14.6);
				if (kv > 0.2) kv = kv / 100;
				const kvRate = kv / 2; // AG Anteil

				let zusatz = parseNumber(zusatzCell ? zusatzCell.v : undefined, 3.2);
				if (zusatz > 0.1) zusatz = zusatz / 100;
				const zusatzbeitragAg = zusatz / 2;

				let rv = parseNumber(rvCell ? rvCell.v : undefined, 18.6);
				if (rv > 0.2) rv = rv / 100;
				const rvRate = rv / 2;

				let av = parseNumber(avCell ? avCell.v : undefined, 2.6);
				if (av > 0.1) av = av / 100;
				const avRate = av / 2;

				let u1 = parseNumber(u1Cell ? u1Cell.v : undefined, 1.3);
				if (u1 > 0.05) u1 = u1 / 100;

				let u2 = parseNumber(u2Cell ? u2Cell.v : undefined, 0.39);
				if (u2 > 0.005) u2 = u2 / 100;

				let u3 = parseNumber(u3Cell ? u3Cell.v : undefined, 0.15);
				if (u3 > 0.002) u3 = u3 / 100;

				const pvRate = 0.018;

				const existing = insuranceFunds.find(i => i.name.toLowerCase() === name.toLowerCase());
				const fundObj: InsuranceFundDetails = {
					name,
					kvRate,
					zusatzbeitragTotal: zusatz,
					zusatzbeitragAg,
					rvRate,
					avRate,
					pvRate,
					u1Rate: u1,
					u2Rate: u2,
					u3Rate: u3,
					agaRate: totalRate > 0 ? totalRate : (existing ? existing.agaRate : 0.2314)
				};

				if (existing) {
					Object.assign(existing, fundObj);
				} else {
					insuranceFunds.push(fundObj);
				}
			}
		}
	}

	const availableInsuranceRates = insuranceFunds.map(f => ({ name: f.name, agaRate: f.agaRate }));
	const years = Array.from(new Set(records.map(r => r.year))).sort((a, b) => a - b);

	return {
		participant,
		records,
		availableInsuranceRates,
		insuranceFunds,
		years
	};
}

