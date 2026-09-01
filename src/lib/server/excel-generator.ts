import ExcelJS from 'exceljs';
import type { BerechnungsblattGeneratorOptions, GeneratorMilestone, ParticipantInfo } from '#lib/types/grant';
import {
	getAwoTariffSalary,
	calculateTariffStepAtDate,
	normalizeAwoGroupKey,
	AWO_TARIFF_PERIODS
} from '#lib/grants/awo-tariff-data';
import { DEFAULT_INSURANCE_FUNDS } from '#lib/grants/tvl-tariff-data';
import {
	COLOR_STUFENAUFSTIEG,
	COLOR_TARIFERHOEHUNG,
	COLOR_EXIT,
	COLOR_HEADER_BG,
	COLOR_SUM_BG,
	parseDateInput,
	calculateEndDate,
	formatDateDMY,
	getInsuranceFundByName,
	calculateMilestones
} from '#lib/grants/generator-milestones';

export {
	COLOR_STUFENAUFSTIEG,
	COLOR_TARIFERHOEHUNG,
	COLOR_EXIT,
	COLOR_HEADER_BG,
	COLOR_SUM_BG,
	parseDateInput,
	calculateEndDate,
	formatDateDMY,
	getInsuranceFundByName,
	calculateMilestones
};

/**
 * Generates a complete ExcelJS workbook for the 5-year Berechnungsblatt.
 */
export async function generateBerechnungsblattExcel(options: BerechnungsblattGeneratorOptions): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'AC-Grants Berechnungsblatt Generator';
	workbook.created = new Date();

	const start = parseDateInput(options.startDate);
	const durationMonths = options.durationMonths || 60;
	const end = calculateEndDate(start, durationMonths);
	const group = options.tariffGroup || 'EG2';
	const step = options.tariffStep || 'ES1';
	const initialStepNum = parseInt(step.replace(/\D/g, ''), 10) || 1;
	const weeklyHours = options.weeklyHours || 30;
	const fullTimeHours = options.fullTimeHours || 39;
	const sachkostenMonthly = options.sachkostenMonthly ?? 155;
	const childrenCount = options.childrenCount ?? 0;
	const healthFund = getInsuranceFundByName(options.healthInsuranceName || 'Barmer');
	const defaultAgaRate = options.customAgaRate || healthFund.agaRate;
	const jszPct = (options.jszPercentage ?? 85) / 100;
	const employeeName = options.employeeName.trim() || 'Neue/r Mitarbeiter/in';
	const jobcenterId = options.jobcenterId?.trim() || '';
	const zgsId = options.zgsId?.trim() || '';

	const runtimeStartStr = formatDateDMY(start);
	const runtimeEndStr = formatDateDMY(end);
	const runtimeLabel = `${runtimeStartStr} - ${runtimeEndStr}`;

	// ==========================================
	// 1. SHEET: GEHALT
	// ==========================================
	const wsGehalt = workbook.addWorksheet('Gehalt', {
		views: [{ showGridLines: true }]
	});

	// Column Widths matching the sample
	wsGehalt.columns = [
		{ key: 'A', width: 14 }, // Datum
		{ key: 'B', width: 12 }, // Anteil Monat
		{ key: 'C', width: 11 }, // Bundes-ML
		{ key: 'D', width: 11 }, // Land-ML
		{ key: 'E', width: 6 },  // (leer)
		{ key: 'F', width: 16 }, // FTE AN-Brutto
		{ key: 'G', width: 14 }, // AN-Brutto
		{ key: 'H', width: 11 }, // 0.19 JC Pauschale
		{ key: 'I', width: 16 }, // Gesamt AG-Brutto JC
		{ key: 'J', width: 12 }, // Degression
		{ key: 'K', width: 14 }, // EGZ JC
		{ key: 'L', width: 14 }, // Monate im Jahr
		{ key: 'M', width: 16 }, // Tarifeinigung
		{ key: 'N', width: 6 },  // (leer)
		{ key: 'O', width: 16 }, // AN-Brutto / Text
		{ key: 'P', width: 16 }, // Krankenkasse (repurposed from KV)
		{ key: 'Q', width: 13 }, // KV+ZB AG
		{ key: 'R', width: 13 }, // RV+AV+PV AG
		{ key: 'S', width: 13 }, // Umlagen U1-U3
		{ key: 'T', width: 14 }, // AGA-Gesamtsatz
		{ key: 'U', width: 15 }, // AGAreal
		{ key: 'V', width: 17 }, // Gehalt AN + AGAreal
		{ key: 'W', width: 14 }, // Anteil JC
		{ key: 'X', width: 16 }, // Anteil ZGS
		{ key: 'Y', width: 16 }, // Anteil Degression
		{ key: 'Z', width: 13 }  // SK-Land
	];

	// ROW 1: Jobcenter-ID & ZGS-ID & Startstufe
	wsGehalt.getCell('B1').value = 'Startstufe';
	wsGehalt.getCell('B1').font = { bold: true, size: 10 };

	wsGehalt.getCell('D1').value = 'Jobcenter-ID:';
	wsGehalt.getCell('D1').font = { bold: true, size: 10 };
	wsGehalt.getCell('F1').value = jobcenterId || '-';
	wsGehalt.getCell('F1').font = { bold: true, size: 10 };

	wsGehalt.getCell('H1').value = 'ZGS-ID:';
	wsGehalt.getCell('H1').font = { bold: true, size: 10 };
	wsGehalt.getCell('J1').value = zgsId || '-';
	wsGehalt.getCell('J1').font = { bold: true, size: 10 };

	// ROW 2: Participant Metadata
	wsGehalt.getCell('A2').value = employeeName;
	wsGehalt.getCell('A2').font = { bold: true, size: 11 };

	wsGehalt.getCell('B2').value = group;
	wsGehalt.getCell('B2').font = { bold: true };
	wsGehalt.getCell('B2').alignment = { horizontal: 'center' };

	wsGehalt.getCell('C2').value = step;
	wsGehalt.getCell('C2').font = { bold: true };
	wsGehalt.getCell('C2').alignment = { horizontal: 'center' };

	wsGehalt.getCell('D2').value = 'Laufzeit:';
	wsGehalt.getCell('D2').font = { bold: true };
	wsGehalt.getCell('F2').value = runtimeLabel;
	wsGehalt.getCell('F2').font = { bold: true };

	wsGehalt.getCell('H2').value = 'Wochenstunden:';
	wsGehalt.getCell('H2').font = { bold: true };
	wsGehalt.getCell('J2').value = weeklyHours;
	wsGehalt.getCell('J2').font = { bold: true };
	wsGehalt.getCell('J2').alignment = { horizontal: 'right' };

	wsGehalt.getCell('K2').value = 'Sachkostenpauschale:';
	wsGehalt.getCell('K2').font = { bold: true };
	wsGehalt.getCell('M2').value = sachkostenMonthly;
	wsGehalt.getCell('M2').font = { bold: true };
	wsGehalt.getCell('M2').numFmt = '#,##0.00 €';

	wsGehalt.getCell('O2').value = 'Kinder';
	wsGehalt.getCell('O2').font = { bold: true };
	wsGehalt.getCell('U2').value = childrenCount;
	wsGehalt.getCell('U2').alignment = { horizontal: 'center' };

	wsGehalt.getCell('V2').value = 'Krankenkasse';
	wsGehalt.getCell('V2').font = { bold: true };
	wsGehalt.getCell('W2').value = healthFund.name;
	wsGehalt.getCell('W2').font = { bold: true };

	wsGehalt.getCell('X2').value = 'AGA';
	wsGehalt.getCell('X2').font = { bold: true };
	wsGehalt.getCell('Y2').value = defaultAgaRate;
	wsGehalt.getCell('Y2').font = { bold: true };
	wsGehalt.getCell('Y2').numFmt = '0.000%';

	// ROW 3: Column Headers
	const headers: Record<string, string> = {
		B: 'Anteil Monat',
		C: 'Bundes-ML',
		D: 'Land-ML',
		F: 'FTE AN-Brutto',
		G: 'AN-Brutto',
		H: '0.19',
		I: 'Gesamt AG-Brutto JC',
		J: 'Degression',
		K: 'EGZ JC',
		L: 'Monate im Jahr',
		M: 'Tarifeinigung',
		O: 'AN-Brutto',
		P: 'Krankenkasse',
		Q: 'KV+ZB (AG)',
		R: 'RV+AV+PV (AG)',
		S: 'Umlagen U1-U3',
		T: 'AGA-Gesamtsatz',
		U: 'AGAreal',
		V: 'Gehalt AN + AGAreal',
		W: 'Anteil JC',
		X: 'Anteil ZGS',
		Y: 'Anteil Degression',
		Z: 'SK-Land'
	};

	for (const [col, title] of Object.entries(headers)) {
		const cell = wsGehalt.getCell(`${col}3`);
		cell.value = title;
		cell.font = { bold: true, size: 9 };
		cell.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FF' + COLOR_HEADER_BG }
		};
		cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
		cell.border = {
			bottom: { style: 'medium', color: { argb: 'FF808080' } }
		};
	}

	// Prepare milestone lookup
	const milestones = calculateMilestones(options);
	const milestoneMap = new Map<string, GeneratorMilestone>();
	for (const m of milestones) {
		const key = `${m.year}-${m.month}`;
		milestoneMap.set(key, m);
	}

	// Calculate calendar years span
	const startYear = start.year;
	const endYear = end.year;
	let currentRow = 4;

	// Keep track of active month index (0 to durationMonths - 1)
	let activeMonthCounter = 0;
	let previousFteSalary = 0;
	let previousStep = initialStepNum;

	// Registry of yearly total rows for bottom summary
	const yearlyTotalRows: { year: number; row: number }[] = [];

	for (let y = startYear; y <= endYear; y++) {
		const yearStartRow = currentRow;
		let septemberRowNumber: number | null = null;
		let lastActiveMonthRowNumber: number | null = null;
		let sepSalaryValue = 0;
		let sepAgaValue = 0;
		let yearMonthUnitsTotal = 0;

		// 12 months for this calendar year
		for (let m = 1; m <= 12; m++) {
			const rowNum = currentRow;
			const isBeforeStart = y === startYear && m < start.month;
			const isAfterEnd = y === endYear && m > end.month;
			const isActive = !isBeforeStart && !isAfterEnd;

			const lastDayOfMonth = new Date(y, m, 0).getDate();
			const mStr = String(m).padStart(2, '0');

			// Col C & D (Mindestlohn)
			wsGehalt.getCell(`C${rowNum}`).value = 14.6;
			wsGehalt.getCell(`C${rowNum}`).numFmt = '0.00';
			wsGehalt.getCell(`D${rowNum}`).value = 14.84;
			wsGehalt.getCell(`D${rowNum}`).numFmt = '0.00';

			if (isActive) {
				lastActiveMonthRowNumber = rowNum;
				if (m === 9) septemberRowNumber = rowNum;

				// Date cell Col A
				const dateCell = wsGehalt.getCell(`A${rowNum}`);
				dateCell.value = `${mStr}/${lastDayOfMonth}/${String(y).slice(-2)}`;
				dateCell.alignment = { horizontal: 'center' };

				// Check milestone color for this month
				const mKey = `${y}-${m}`;
				const milestone = milestoneMap.get(mKey);
				if (milestone) {
					dateCell.fill = {
						type: 'pattern',
						pattern: 'solid',
						fgColor: { argb: 'FF' + milestone.color }
					};
					dateCell.font = { bold: true, color: { argb: milestone.color === COLOR_EXIT ? 'FFFFFFFF' : 'FF000000' } };
				}

				// Anteil Monat (Col B)
				const isSplitFirstMonth = y === startYear && m === start.month && start.day > 1;
				const isSplitLastMonth = y === endYear && m === end.month && end.day < lastDayOfMonth;
				const monthUnits = isSplitFirstMonth || isSplitLastMonth ? 0.5 : 1.0;
				wsGehalt.getCell(`B${rowNum}`).value = monthUnits;
				wsGehalt.getCell(`B${rowNum}`).numFmt = '0.00';

				// Determine experience step for this month
				const currentStep = calculateTariffStepAtDate(
					{ day: start.day, month: m, year: y },
					start,
					initialStepNum
				);

				// Lookup salary from AWO tariff
				const salaryInfo = getAwoTariffSalary(group, currentStep, y, m, weeklyHours, fullTimeHours);
				const fteSalary = salaryInfo?.fteSalary || 2674.27;

				// Calculations for precalculated results
				let degression = 100;
				if (activeMonthCounter >= 48) degression = 70;
				else if (activeMonthCounter >= 36) degression = 80;
				else if (activeMonthCounter >= 24) degression = 90;

				const partTimeSalary = (fteSalary * weeklyHours / 39) * monthUnits;
				const jcFlatRate = partTimeSalary * 0.19;
				const jcTotalGross = partTimeSalary + jcFlatRate;
				const egzJc = (jcTotalGross * degression) / 100;
				const kvZbAg = (healthFund.kvRate + healthFund.zusatzbeitragAg);
				const rvAvPvAg = (healthFund.rvRate + healthFund.avRate + healthFund.pvRate);
				const umlagen = (healthFund.u1Rate + healthFund.u2Rate + healthFund.u3Rate);
				const totalAgaRate = kvZbAg + rvAvPvAg + umlagen;
				const agaReal = partTimeSalary * totalAgaRate;
				const totalEmployerCost = partTimeSalary + agaReal;
				const landSvShortfall = totalEmployerCost - jcTotalGross;
				const landDegression = totalEmployerCost - egzJc - landSvShortfall;
				const skLand = sachkostenMonthly * monthUnits;

				if (m === 9 || !septemberRowNumber) {
					sepSalaryValue = (fteSalary * weeklyHours / 39);
					sepAgaValue = sepSalaryValue * totalAgaRate;
				}
				yearMonthUnitsTotal += monthUnits;

				// Col F (FTE AN-Brutto)
				const cellF = wsGehalt.getCell(`F${rowNum}`);
				cellF.value = fteSalary;
				cellF.numFmt = '#,##0.00 €';

				// Col G (AN-Brutto): =F#*($J$2/39)*B#
				const cellG = wsGehalt.getCell(`G${rowNum}`);
				cellG.value = { formula: `F${rowNum}*($J$2/39)*B${rowNum}`, result: partTimeSalary };
				cellG.numFmt = '#,##0.00 €';

				// Col H (JC Pauschale): =SUM(G#:G#)*19%
				const cellH = wsGehalt.getCell(`H${rowNum}`);
				cellH.value = { formula: `SUM(G${rowNum}:G${rowNum})*19%`, result: jcFlatRate };
				cellH.numFmt = '#,##0.00 €';

				// Col I (Gesamt AG-Brutto JC): =SUM(G#:H#)
				const cellI = wsGehalt.getCell(`I${rowNum}`);
				cellI.value = { formula: `SUM(G${rowNum}:H${rowNum})`, result: jcTotalGross };
				cellI.numFmt = '#,##0.00 €';

				// Col J (Degression %)
				wsGehalt.getCell(`J${rowNum}`).value = degression;
				wsGehalt.getCell(`J${rowNum}`).alignment = { horizontal: 'right' };

				// Col K (EGZ JC): =I#*J#%
				const cellK = wsGehalt.getCell(`K${rowNum}`);
				cellK.value = { formula: `I${rowNum}*J${rowNum}%`, result: egzJc };
				cellK.numFmt = '#,##0.00 €';

				// Col M (Tarifeinigung delta)
				if (activeMonthCounter > 0 && fteSalary > previousFteSalary && currentStep === previousStep) {
					wsGehalt.getCell(`M${rowNum}`).value = { formula: `F${rowNum}-F${rowNum - 1}`, result: fteSalary - previousFteSalary };
					wsGehalt.getCell(`M${rowNum}`).numFmt = '#,##0.00 €';
				}

				// Col O (AN-Brutto): =SUM(G#:G#)
				const cellO = wsGehalt.getCell(`O${rowNum}`);
				cellO.value = { formula: `SUM(G${rowNum}:G${rowNum})`, result: partTimeSalary };
				cellO.numFmt = '#,##0.00 €';

				// --- REPURPOSED AGA COLUMNS P - T ---
				// Col P: Krankenkasse
				wsGehalt.getCell(`P${rowNum}`).value = healthFund.name;
				wsGehalt.getCell(`P${rowNum}`).alignment = { horizontal: 'center' };

				// Col Q: KV + ZB (AG): (14.6 + zusatzbeitrag)/2
				wsGehalt.getCell(`Q${rowNum}`).value = kvZbAg;
				wsGehalt.getCell(`Q${rowNum}`).numFmt = '0.000%';

				// Col R: RV + AV + PV (AG): 9.3% + 1.3% + 1.8%
				wsGehalt.getCell(`R${rowNum}`).value = rvAvPvAg;
				wsGehalt.getCell(`R${rowNum}`).numFmt = '0.000%';

				// Col S: Umlagen (U1 + U2 + U3)
				wsGehalt.getCell(`S${rowNum}`).value = umlagen;
				wsGehalt.getCell(`S${rowNum}`).numFmt = '0.000%';

				// Col T: AGA-Gesamtsatz: =SUM(Q#:S#)
				const cellT = wsGehalt.getCell(`T${rowNum}`);
				cellT.value = { formula: `SUM(Q${rowNum}:S${rowNum})`, result: totalAgaRate };
				cellT.numFmt = '0.000%';

				// Col U: AGAreal: =O#*T#
				const cellU = wsGehalt.getCell(`U${rowNum}`);
				cellU.value = { formula: `O${rowNum}*T${rowNum}`, result: agaReal };
				cellU.numFmt = '#,##0.00 €';

				// Col V: Gehalt AN + AGAreal: =U#+O#
				const cellV = wsGehalt.getCell(`V${rowNum}`);
				cellV.value = { formula: `U${rowNum}+O${rowNum}`, result: totalEmployerCost };
				cellV.numFmt = '#,##0.00 €';

				// Col W: Anteil JC: =K#
				const cellW = wsGehalt.getCell(`W${rowNum}`);
				cellW.value = { formula: `K${rowNum}`, result: egzJc };
				cellW.numFmt = '#,##0.00 €';

				// Col X: Anteil ZGS: =V#-I#
				const cellX = wsGehalt.getCell(`X${rowNum}`);
				cellX.value = { formula: `V${rowNum}-I${rowNum}`, result: landSvShortfall };
				cellX.numFmt = '#,##0.00 €';

				// Col Y: Anteil Degression: =V#-W#-X#
				const cellY = wsGehalt.getCell(`Y${rowNum}`);
				cellY.value = { formula: `V${rowNum}-W${rowNum}-X${rowNum}`, result: landDegression };
				cellY.numFmt = '#,##0.00 €';

				// Col Z: SK-Land: =$M$2*B#
				const cellZ = wsGehalt.getCell(`Z${rowNum}`);
				cellZ.value = { formula: `$M$2*B${rowNum}`, result: skLand };
				cellZ.numFmt = '#,##0.00 €';

				previousFteSalary = fteSalary;
				previousStep = currentStep;
				activeMonthCounter++;
			} else {
				// Inactive month (outside runtime)
				// Put standard formulas that evaluate to 0 to maintain clean structure
				wsGehalt.getCell(`G${rowNum}`).value = { formula: `F${rowNum}*($J$2/39)*B${rowNum}`, result: 0 };
				wsGehalt.getCell(`G${rowNum}`).numFmt = '#,##0.00 €';
				wsGehalt.getCell(`H${rowNum}`).value = { formula: `SUM(G${rowNum}:G${rowNum})*19%`, result: 0 };
				wsGehalt.getCell(`I${rowNum}`).value = { formula: `SUM(G${rowNum}:H${rowNum})`, result: 0 };
				wsGehalt.getCell(`K${rowNum}`).value = { formula: `I${rowNum}*J${rowNum}%`, result: 0 };
				wsGehalt.getCell(`O${rowNum}`).value = { formula: `SUM(G${rowNum}:G${rowNum})`, result: 0 };
				wsGehalt.getCell(`O${rowNum}`).numFmt = '#,##0.00 €';
				wsGehalt.getCell(`U${rowNum}`).value = { formula: `O${rowNum}*$Y$2`, result: 0 };
				wsGehalt.getCell(`V${rowNum}`).value = { formula: `U${rowNum}+O${rowNum}`, result: 0 };
				wsGehalt.getCell(`W${rowNum}`).value = { formula: `K${rowNum}`, result: 0 };
				wsGehalt.getCell(`X${rowNum}`).value = { formula: `V${rowNum}-I${rowNum}`, result: 0 };
				wsGehalt.getCell(`Y${rowNum}`).value = { formula: `V${rowNum}-W${rowNum}-X${rowNum}`, result: 0 };
				wsGehalt.getCell(`Z${rowNum}`).value = { formula: `$M$2*B${rowNum}`, result: 0 };
			}

			currentRow++;
		}

		// Year summary rows: JSZ, AGA auf JSZ, Yearly Totals
		const yearEndRow = currentRow - 1;
		const jszRow = currentRow++;
		const agaJszRow = currentRow++;
		const sumRow = currentRow++;

		yearlyTotalRows.push({ year: y, row: sumRow });

		// Calculate expected JSZ result (only if employed on 01.12.)
		const isEmployedInDecember = y < endYear || (y === endYear && end.month === 12);
		const jszAmount = isEmployedInDecember && lastActiveMonthRowNumber ? (sepSalaryValue * jszPct * (yearMonthUnitsTotal / 12)) : 0;
		const jszAgaAmount = isEmployedInDecember && lastActiveMonthRowNumber ? (sepAgaValue * jszPct * (yearMonthUnitsTotal / 12)) : 0;

		// Row: Jahressonderzahlung (85%)
		wsGehalt.getCell(`L${jszRow}`).value = { formula: `SUM(B${yearStartRow}:B${yearEndRow})`, result: yearMonthUnitsTotal };
		wsGehalt.getCell(`L${jszRow}`).numFmt = '0.00';
		wsGehalt.getCell(`O${jszRow}`).value = `Jahressonderzahlung (${Math.round(jszPct * 100)}%)`;
		wsGehalt.getCell(`O${jszRow}`).font = { bold: true };

		// Formula for JSZ in Col X: IF(V_dec>0, O_sep*85%*(L_sum/12), 0)
		const refSepO = septemberRowNumber ? `O${septemberRowNumber}` : (lastActiveMonthRowNumber ? `O${lastActiveMonthRowNumber}` : `O${yearEndRow}`);
		const cellJszX = wsGehalt.getCell(`X${jszRow}`);
		cellJszX.value = { formula: `IF(V${yearEndRow}>0,${refSepO}*${jszPct}*(L${jszRow}/12),0)`, result: jszAmount };
		cellJszX.numFmt = '#,##0.00 €';

		// Row: AGA auf JSZ
		wsGehalt.getCell(`O${agaJszRow}`).value = 'AGA auf JSZ';
		wsGehalt.getCell(`O${agaJszRow}`).font = { bold: true };
		const refSepU = septemberRowNumber ? `U${septemberRowNumber}` : (lastActiveMonthRowNumber ? `U${lastActiveMonthRowNumber}` : `U${yearEndRow}`);
		const cellAgaJszX = wsGehalt.getCell(`X${agaJszRow}`);
		cellAgaJszX.value = { formula: `IF(V${yearEndRow}>0,${refSepU}*${jszPct}*(L${jszRow}/12),0)`, result: jszAgaAmount };
		cellAgaJszX.numFmt = '#,##0.00 €';

		// Row: Yearly Totals
		for (const col of ['O', 'P', 'Q', 'R', 'S', 'T', 'U', 'W', 'X', 'Y', 'Z']) {
			const cell = wsGehalt.getCell(`${col}${sumRow}`);
			cell.value = { formula: `SUM(${col}${yearStartRow}:${col}${agaJszRow})` };
			cell.font = { bold: true };
			cell.numFmt = '#,##0.00 €';
			cell.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: 'FF' + COLOR_SUM_BG }
			};
			cell.border = {
				top: { style: 'thin' },
				bottom: { style: 'double' }
			};
		}

		// Col V total sums only monthly rows (V_start to V_end), matching sample formula
		const cellSumV = wsGehalt.getCell(`V${sumRow}`);
		cellSumV.value = { formula: `SUM(V${yearStartRow}:V${yearEndRow})` };
		cellSumV.font = { bold: true };
		cellSumV.numFmt = '#,##0.00 €';
		cellSumV.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FF' + COLOR_SUM_BG }
		};
		cellSumV.border = {
			top: { style: 'thin' },
			bottom: { style: 'double' }
		};
	}

	// ==========================================
	// BOTTOM SUMMARY TABLE & FOOTNOTES
	// ==========================================
	currentRow++; // empty line
	const summaryStartRow = currentRow;

	for (const item of yearlyTotalRows) {
		const r = currentRow++;
		wsGehalt.getCell(`U${r}`).value = item.year;
		wsGehalt.getCell(`U${r}`).font = { bold: true };

		for (const col of ['V', 'W', 'X', 'Y', 'Z']) {
			const cell = wsGehalt.getCell(`${col}${r}`);
			cell.value = { formula: `=${col}${item.row}` };
			cell.numFmt = '#,##0.00 €';
			cell.font = { bold: true };
		}
	}

	const grandTotalRow = currentRow++;
	for (const col of ['V', 'W', 'X', 'Y', 'Z']) {
		const cell = wsGehalt.getCell(`${col}${grandTotalRow}`);
		cell.value = { formula: `SUM(${col}${summaryStartRow}:${col}${grandTotalRow - 1})` };
		cell.font = { bold: true };
		cell.numFmt = '#,##0.00 €';
		cell.border = {
			top: { style: 'thin' },
			bottom: { style: 'double' }
		};
	}

	// Footnotes with matching color markers
	currentRow += 2;
	const note1 = wsGehalt.getCell(`A${currentRow++}`);
	note1.value = `Die Jahressonderzahlung beträgt ${Math.round(jszPct * 100)}% des Septembergehalts (gemäß Arbeitsmonaten), mit Anspruch falls eine Beschäftigung zum 1.12. besteht`;
	note1.font = { italic: true, size: 9 };

	for (const m of milestones) {
		if (m.type === 'stufenaufstieg' || m.type === 'tariferhoehung') {
			const noteCell = wsGehalt.getCell(`A${currentRow++}`);
			noteCell.value = `${m.label} am ${m.dateStr}`;
			noteCell.font = { bold: true, size: 9 };
			noteCell.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: 'FF' + m.color }
			};
		}
	}

	// ==========================================
	// 2. SHEET: AGA (Krankenkassen-Beitragstabelle)
	// ==========================================
	const wsAga = workbook.addWorksheet('AGA', {
		views: [{ showGridLines: true }]
	});

	wsAga.columns = [
		{ key: 'A', width: 18 }, // Kasse
		{ key: 'B', width: 4 },  // leer
		{ key: 'C', width: 10 }, // KV
		{ key: 'D', width: 14 }, // Zusatzbeitrag
		{ key: 'E', width: 10 }, // RV
		{ key: 'F', width: 10 }, // AV
		{ key: 'G', width: 14 }, // PV (1 Kind)
		{ key: 'H', width: 14 }, // PV kinderlos
		{ key: 'I', width: 10 }, // U1
		{ key: 'J', width: 10 }, // U1 Satz
		{ key: 'K', width: 12 }, // U2 Umlage
		{ key: 'L', width: 12 }, // IGU (U3)
		{ key: 'M', width: 4 },  // leer
		{ key: 'N', width: 14 }, // AN-Anteil (mit Kind)
		{ key: 'O', width: 14 }, // AG-Anteil (mit Kind)
		{ key: 'P', width: 4 },  // leer
		{ key: 'Q', width: 14 }, // AN-Anteil (ohne Kind)
		{ key: 'R', width: 14 }  // AG-Anteil (ohne Kind)
	];

	wsAga.getCell('A1').value = 'Beitragssätze Krankenkassen';
	wsAga.getCell('A1').font = { bold: true, size: 12 };
	wsAga.getCell('E1').value = 'Stand 01.01.2026';
	wsAga.getCell('E1').font = { italic: true };

	wsAga.getCell('N2').value = 'Mit Kind';
	wsAga.getCell('N2').font = { bold: true };
	wsAga.getCell('Q2').value = 'Ohne Kind';
	wsAga.getCell('Q2').font = { bold: true };

	const agaHeaders: Record<string, string> = {
		A: 'Krankenkasse',
		C: 'KV',
		D: 'Zusatzbeitrag',
		E: 'RV',
		F: 'AV',
		G: 'PV (1 Kind)*',
		H: 'PV kinderlos**',
		I: 'U1 bei 50%',
		J: 'U1 Erstattung',
		K: 'U2 Umlage',
		L: 'IGU (U3)',
		N: 'AN-Anteil',
		O: 'AG-Anteil',
		Q: 'AN-Anteil',
		R: 'AG-Anteil'
	};

	for (const [col, title] of Object.entries(agaHeaders)) {
		const cell = wsAga.getCell(`${col}3`);
		cell.value = title;
		cell.font = { bold: true, size: 9 };
		cell.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FF' + COLOR_HEADER_BG }
		};
		cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
	}

	let agaRow = 5;
	for (const fund of DEFAULT_INSURANCE_FUNDS) {
		wsAga.getCell(`A${agaRow}`).value = fund.name;
		wsAga.getCell(`A${agaRow}`).font = { bold: true };

		wsAga.getCell(`C${agaRow}`).value = fund.kvRate * 200; // e.g. 14.6
		wsAga.getCell(`D${agaRow}`).value = fund.zusatzbeitragTotal * 100; // e.g. 3.29
		wsAga.getCell(`E${agaRow}`).value = fund.rvRate * 200; // 18.6
		wsAga.getCell(`F${agaRow}`).value = fund.avRate * 200; // 2.6
		wsAga.getCell(`G${agaRow}`).value = 3.6;
		wsAga.getCell(`H${agaRow}`).value = 4.2;
		wsAga.getCell(`I${agaRow}`).value = fund.u1Rate * 100; // 1.90
		wsAga.getCell(`J${agaRow}`).value = 0.5;
		wsAga.getCell(`K${agaRow}`).value = fund.u2Rate * 100; // 0.42
		wsAga.getCell(`L${agaRow}`).value = fund.u3Rate * 100; // 0.15

		// Formulas matching sample AGA sheet
		wsAga.getCell(`N${agaRow}`).value = { formula: `SUM(C${agaRow}:G${agaRow})/2` };
		wsAga.getCell(`O${agaRow}`).value = { formula: `SUM(C${agaRow}:G${agaRow})/2+I${agaRow}+K${agaRow}+L${agaRow}` };
		wsAga.getCell(`Q${agaRow}`).value = { formula: `SUM(C${agaRow}:F${agaRow})/2+2.4` };
		wsAga.getCell(`R${agaRow}`).value = { formula: `SUM(C${agaRow}:F${agaRow})/2+1.8+I${agaRow}+K${agaRow}+L${agaRow}` };

		for (const c of ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'N', 'O', 'Q', 'R']) {
			wsAga.getCell(`${c}${agaRow}`).numFmt = '0.000';
			wsAga.getCell(`${c}${agaRow}`).alignment = { horizontal: 'right' };
		}

		agaRow++;
	}

	wsAga.getCell(`A${agaRow + 2}`).value = '*für jedes weitere Kind sinkt der AN-Beitrag um 0,25%';
	wsAga.getCell(`A${agaRow + 3}`).value = '**AG-Anteil 1,8%, Kinderlose AN-Anteil 2,4%';

	// Return binary buffer
	const arrayBuffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(arrayBuffer);
}
