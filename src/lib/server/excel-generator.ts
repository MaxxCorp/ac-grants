import ExcelJS from 'exceljs';
import type { BerechnungsblattGeneratorOptions, GeneratorMilestone, ParticipantInfo } from '#lib/types/grant';
import {
	getAwoTariffSalary,
	calculateTariffStepAtDate,
	isAwoTariffIncreaseMonth,
	normalizeAwoGroupKey,
	AWO_TARIFF_PERIODS
} from '#lib/grants/awo-tariff-data';
import { DEFAULT_INSURANCE_FUNDS } from '#lib/grants/tvl-tariff-data';
import {
	COLOR_STUFENAUFSTIEG,
	COLOR_TARIFERHOEHUNG,
	COLOR_UMGRUPPIERUNG,
	COLOR_EXIT,
	COLOR_HEADER_BG,
	COLOR_SUM_BG,
	parseDateInput,
	calculateEndDate,
	formatDateDMY,
	getInsuranceFundByName,
	calculateMilestones,
	resolveTariffStateAtDate,
	getEffectiveBgRate
} from '#lib/grants/generator-milestones';

export {
	COLOR_STUFENAUFSTIEG,
	COLOR_TARIFERHOEHUNG,
	COLOR_UMGRUPPIERUNG,
	COLOR_EXIT,
	COLOR_HEADER_BG,
	COLOR_SUM_BG,
	parseDateInput,
	calculateEndDate,
	formatDateDMY,
	getInsuranceFundByName,
	calculateMilestones,
	resolveTariffStateAtDate,
	getEffectiveBgRate
};

export function populateGehaltWorksheet(wsGehalt: ExcelJS.Worksheet, options: BerechnungsblattGeneratorOptions): void {
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
	const defaultBgRate = options.bgRate ?? 0.018;
	const customBgTimeline = options.customBgTimeline;
	const reclassifications = options.reclassifications || [];
	const jszPct = (options.jszPercentage ?? 85) / 100;
	const employeeName = options.employeeName.trim() || 'Neue/r Mitarbeiter/in';
	const jobcenterId = options.jobcenterId?.trim() || '';
	const zgsId = options.zgsId?.trim() || '';

	const runtimeStartStr = formatDateDMY(start);
	const runtimeEndStr = formatDateDMY(end);
	const runtimeLabel = `${runtimeStartStr} - ${runtimeEndStr}`;

	// Column Widths: includes BG-Kosten and Gesamtkosten inkl. BG
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
		{ key: 'W', width: 14 }, // BG-Kosten
		{ key: 'X', width: 18 }, // Gesamtkosten inkl. BG
		{ key: 'Y', width: 14 }, // Anteil JC
		{ key: 'Z', width: 16 }, // Anteil ZGS
		{ key: 'AA', width: 16 }, // Anteil Degression
		{ key: 'AB', width: 13 }  // SK-Land
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

	wsGehalt.getCell('Z2').value = 'BG-Satz';
	wsGehalt.getCell('Z2').font = { bold: true };
	wsGehalt.getCell('AA2').value = defaultBgRate;
	wsGehalt.getCell('AA2').font = { bold: true };
	wsGehalt.getCell('AA2').numFmt = '0.000%';

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
		W: 'BG-Kosten',
		X: 'Gesamtkosten inkl. BG',
		Y: 'Anteil JC',
		Z: 'Anteil ZGS',
		AA: 'Anteil Degression',
		AB: 'SK-Land'
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
	let activeMonthCounter = 0;
	let cumulativeActiveUnits = 0;
	let previousFteSalary = 0;
	let previousStep = initialStepNum;
	let previousGroup = group;

	// Registry of yearly total rows for bottom summary
	const yearlyTotalRows: { year: number; row: number }[] = [];

	interface MonthRowDescriptor {
		year: number;
		month: number;
		isActive: boolean;
		dateStr: string;
		monthUnits: number;
		degression: number;
		isSplitPart?: 1 | 2;
		isLastActiveRow?: boolean;
	}

	function getDegression(cumUnits: number): number {
		if (cumUnits >= 48) return 70;
		if (cumUnits >= 36) return 80;
		if (cumUnits >= 24) return 90;
		return 100;
	}

	for (let y = startYear; y <= endYear; y++) {
		const yearStartRow = currentRow;
		let septemberRowNumber: number | null = null;
		let decemberRowNumber: number | null = null;
		let lastActiveMonthRowNumber: number | null = null;
		let sepSalaryValue = 0;
		let sepAgaValue = 0;
		let sepBgRate = defaultBgRate;
		let sepBgValue = 0;
		let yearMonthUnitsTotal = 0;

		// Build row descriptors for all months in this calendar year
		const yearRows: MonthRowDescriptor[] = [];

		for (let m = 1; m <= 12; m++) {
			const monthIndex = y * 12 + m;
			const startIndex = start.year * 12 + start.month;
			const endIndex = end.year * 12 + end.month;
			const lastDayOfMonth = new Date(y, m, 0).getDate();
			const mStr = String(m).padStart(2, '0');
			const yy = String(y).slice(-2);

			if (monthIndex < startIndex || monthIndex > endIndex) {
				// Inactive month
				yearRows.push({
					year: y,
					month: m,
					isActive: false,
					dateStr: `${mStr}/${lastDayOfMonth}/${yy}`,
					monthUnits: 0,
					degression: 0
				});
				continue;
			}

			// Active month
			if (monthIndex === startIndex) {
				// Start month
				const units = start.day === 1 ? 1.0 : 0.5;
				const dateDay = start.day === 1 ? lastDayOfMonth : start.day;
				cumulativeActiveUnits += units;
				yearRows.push({
					year: y,
					month: m,
					isActive: true,
					dateStr: `${mStr}/${dateDay}/${yy}`,
					monthUnits: units,
					degression: 100
				});
			} else if (monthIndex === endIndex) {
				// Final active month
				const remainingUnits = durationMonths - cumulativeActiveUnits;
				const units = remainingUnits < 1.0 ? remainingUnits : 1.0;
				const dateDay = end.day < lastDayOfMonth ? end.day : lastDayOfMonth;
				const deg = getDegression(cumulativeActiveUnits);
				cumulativeActiveUnits += units;
				yearRows.push({
					year: y,
					month: m,
					isActive: true,
					dateStr: `${mStr}/${dateDay}/${yy}`,
					monthUnits: units,
					degression: deg,
					isLastActiveRow: true
				});
			} else {
				// Intermediate active month
				// Check if a degression threshold (24, 36, 48) crosses strictly inside this month
				const splitThreshold = [24, 36, 48].find(T => cumulativeActiveUnits < T && cumulativeActiveUnits + 1.0 > T);

				if (splitThreshold !== undefined) {
					// SPLIT MONTH! 2 rows covering their respective degression split
					const units1 = splitThreshold - cumulativeActiveUnits;
					const degression1 = getDegression(cumulativeActiveUnits);
					cumulativeActiveUnits += units1;

					yearRows.push({
						year: y,
						month: m,
						isActive: true,
						dateStr: `${mStr}/15/${yy}`,
						monthUnits: units1,
						degression: degression1,
						isSplitPart: 1
					});

					const units2 = 1.0 - units1;
					const degression2 = getDegression(cumulativeActiveUnits);
					cumulativeActiveUnits += units2;

					yearRows.push({
						year: y,
						month: m,
						isActive: true,
						dateStr: `${mStr}/${lastDayOfMonth}/${yy}`,
						monthUnits: units2,
						degression: degression2,
						isSplitPart: 2
					});
				} else {
					// Full month
					const deg = getDegression(cumulativeActiveUnits);
					cumulativeActiveUnits += 1.0;
					yearRows.push({
						year: y,
						month: m,
						isActive: true,
						dateStr: `${mStr}/${lastDayOfMonth}/${yy}`,
						monthUnits: 1.0,
						degression: deg
					});
				}
			}
		}

		// Render each row in yearRows into the worksheet
		for (const r of yearRows) {
			const rowNum = currentRow++;
			const lastDayOfMonth = new Date(y, r.month, 0).getDate();
			const mStr = String(r.month).padStart(2, '0');

			if (r.month === 12) {
				decemberRowNumber = rowNum;
			}

			// Col C & D (Mindestlohn)
			wsGehalt.getCell(`C${rowNum}`).value = 14.6;
			wsGehalt.getCell(`C${rowNum}`).numFmt = '0.00';
			wsGehalt.getCell(`D${rowNum}`).value = 14.84;
			wsGehalt.getCell(`D${rowNum}`).numFmt = '0.00';

			if (r.isActive) {
				lastActiveMonthRowNumber = rowNum;
				if (r.month === 9 && r.isSplitPart !== 2) {
					septemberRowNumber = rowNum;
				}

				// Date cell Col A
				const dateCell = wsGehalt.getCell(`A${rowNum}`);
				dateCell.value = r.dateStr;
				dateCell.alignment = { horizontal: 'center' };

				// Determine experience step and group for this row (supporting reclassifications)
				const stepDay = r.isSplitPart === 2 ? 16 : (r.isSplitPart === 1 ? 1 : start.day);
				const tariffState = resolveTariffStateAtDate(
					{ day: stepDay, month: r.month, year: y },
					start,
					group,
					initialStepNum,
					reclassifications
				);
				const currentGroup = tariffState.group;
				const currentStep = tariffState.step;

				// Milestone color
				if (r.isLastActiveRow) {
					dateCell.fill = {
						type: 'pattern',
						pattern: 'solid',
						fgColor: { argb: 'FF' + COLOR_EXIT }
					};
					dateCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
				} else if (tariffState.isReclassificationEffectiveThisMonth && r.isSplitPart !== 2) {
					dateCell.fill = {
						type: 'pattern',
						pattern: 'solid',
						fgColor: { argb: 'FF' + COLOR_UMGRUPPIERUNG }
					};
					dateCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
				} else if (currentStep > previousStep && activeMonthCounter > 0) {
					dateCell.fill = {
						type: 'pattern',
						pattern: 'solid',
						fgColor: { argb: 'FF' + COLOR_STUFENAUFSTIEG }
					};
					dateCell.font = { bold: true, color: { argb: 'FF000000' } };
				} else if (isAwoTariffIncreaseMonth(y, r.month) && r.isSplitPart !== 2) {
					dateCell.fill = {
						type: 'pattern',
						pattern: 'solid',
						fgColor: { argb: 'FF' + COLOR_TARIFERHOEHUNG }
					};
					dateCell.font = { bold: true, color: { argb: 'FF000000' } };
				}

				// Col B (Anteil Monat)
				wsGehalt.getCell(`B${rowNum}`).value = r.monthUnits;
				wsGehalt.getCell(`B${rowNum}`).numFmt = '0.00';

				// Salary
				const salaryInfo = getAwoTariffSalary(currentGroup, currentStep, y, r.month, weeklyHours, fullTimeHours);
				const fteSalary = salaryInfo?.fteSalary || 2674.27;

				const partTimeSalary = (fteSalary * weeklyHours / 39) * r.monthUnits;
				const jcFlatRate = partTimeSalary * 0.19;
				const jcTotalGross = partTimeSalary + jcFlatRate;
				const egzJc = (jcTotalGross * r.degression) / 100;
				const kvZbAg = (healthFund.kvRate + healthFund.zusatzbeitragAg);
				const rvAvPvAg = (healthFund.rvRate + healthFund.avRate + healthFund.pvRate);
				const umlagen = (healthFund.u1Rate + healthFund.u2Rate + healthFund.u3Rate);
				const totalAgaRate = kvZbAg + rvAvPvAg + umlagen;
				const agaReal = partTimeSalary * totalAgaRate;
				const totalEmployerCost = partTimeSalary + agaReal;
				const landSvShortfall = totalEmployerCost - jcTotalGross;
				const landDegression = totalEmployerCost - egzJc - landSvShortfall;
				const skLand = sachkostenMonthly * r.monthUnits;

				// Berufsgenossenschaft (BG) calculation
				const rowBgRate = getEffectiveBgRate(
					{ year: y, month: r.month, day: stepDay },
					defaultBgRate,
					customBgTimeline
				);
				const bgAmount = partTimeSalary * rowBgRate;
				const totalEmployerCostWithBg = totalEmployerCost + bgAmount;

				if (r.month === 9 || !septemberRowNumber) {
					sepSalaryValue = (fteSalary * weeklyHours / 39);
					sepAgaValue = sepSalaryValue * totalAgaRate;
					sepBgRate = rowBgRate;
					sepBgValue = sepSalaryValue * rowBgRate;
				}
				yearMonthUnitsTotal += r.monthUnits;

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
				wsGehalt.getCell(`J${rowNum}`).value = r.degression;
				wsGehalt.getCell(`J${rowNum}`).alignment = { horizontal: 'right' };

				// Col K (EGZ JC): =I#*J#%
				const cellK = wsGehalt.getCell(`K${rowNum}`);
				cellK.value = { formula: `I${rowNum}*J${rowNum}%`, result: egzJc };
				cellK.numFmt = '#,##0.00 €';

				// Col M (Tarifeinigung delta)
				if (activeMonthCounter > 0 && fteSalary > previousFteSalary && currentStep === previousStep && currentGroup === previousGroup && r.isSplitPart !== 2) {
					wsGehalt.getCell(`M${rowNum}`).value = { formula: `F${rowNum}-F${rowNum - 1}`, result: fteSalary - previousFteSalary };
					wsGehalt.getCell(`M${rowNum}`).numFmt = '#,##0.00 €';
				}

				// Col O (AN-Brutto): =SUM(G#:G#)
				const cellO = wsGehalt.getCell(`O${rowNum}`);
				cellO.value = { formula: `SUM(G${rowNum}:G${rowNum})`, result: partTimeSalary };
				cellO.numFmt = '#,##0.00 €';

				// Col P-T
				wsGehalt.getCell(`P${rowNum}`).value = healthFund.name;
				wsGehalt.getCell(`P${rowNum}`).alignment = { horizontal: 'center' };

				wsGehalt.getCell(`Q${rowNum}`).value = kvZbAg;
				wsGehalt.getCell(`Q${rowNum}`).numFmt = '0.000%';

				wsGehalt.getCell(`R${rowNum}`).value = rvAvPvAg;
				wsGehalt.getCell(`R${rowNum}`).numFmt = '0.000%';

				wsGehalt.getCell(`S${rowNum}`).value = umlagen;
				wsGehalt.getCell(`S${rowNum}`).numFmt = '0.000%';

				const cellT = wsGehalt.getCell(`T${rowNum}`);
				cellT.value = { formula: `SUM(Q${rowNum}:S${rowNum})`, result: totalAgaRate };
				cellT.numFmt = '0.000%';

				const cellU = wsGehalt.getCell(`U${rowNum}`);
				cellU.value = { formula: `O${rowNum}*T${rowNum}`, result: agaReal };
				cellU.numFmt = '#,##0.00 €';

				// Col V (Gehalt AN + AGAreal)
				const cellV = wsGehalt.getCell(`V${rowNum}`);
				cellV.value = { formula: `U${rowNum}+O${rowNum}`, result: totalEmployerCost };
				cellV.numFmt = '#,##0.00 €';

				// Col W (BG-Kosten): =O#*rowBgRate
				const cellW = wsGehalt.getCell(`W${rowNum}`);
				cellW.value = { formula: `O${rowNum}*${rowBgRate}`, result: bgAmount };
				cellW.numFmt = '#,##0.00 €';

				// Col X (Gesamtkosten inkl. BG): =V#+W#
				const cellX = wsGehalt.getCell(`X${rowNum}`);
				cellX.value = { formula: `V${rowNum}+W${rowNum}`, result: totalEmployerCostWithBg };
				cellX.numFmt = '#,##0.00 €';

				// Col Y (Anteil JC): =K#
				const cellY = wsGehalt.getCell(`Y${rowNum}`);
				cellY.value = { formula: `K${rowNum}`, result: egzJc };
				cellY.numFmt = '#,##0.00 €';

				// Col Z (Anteil ZGS): =V#-I#
				const cellZ = wsGehalt.getCell(`Z${rowNum}`);
				cellZ.value = { formula: `V${rowNum}-I${rowNum}`, result: landSvShortfall };
				cellZ.numFmt = '#,##0.00 €';

				// Col AA (Anteil Degression): =V#-Y#-Z#
				const cellAA = wsGehalt.getCell(`AA${rowNum}`);
				cellAA.value = { formula: `V${rowNum}-Y${rowNum}-Z${rowNum}`, result: landDegression };
				cellAA.numFmt = '#,##0.00 €';

				// Col AB (SK-Land): =$M$2*B#
				const cellAB = wsGehalt.getCell(`AB${rowNum}`);
				cellAB.value = { formula: `$M$2*B${rowNum}`, result: skLand };
				cellAB.numFmt = '#,##0.00 €';

				previousFteSalary = fteSalary;
				previousStep = currentStep;
				previousGroup = currentGroup;
				activeMonthCounter++;
			} else {
				// Inactive month
				wsGehalt.getCell(`G${rowNum}`).value = { formula: `F${rowNum}*($J$2/39)*B${rowNum}`, result: 0 };
				wsGehalt.getCell(`G${rowNum}`).numFmt = '#,##0.00 €';
				wsGehalt.getCell(`H${rowNum}`).value = { formula: `SUM(G${rowNum}:G${rowNum})*19%`, result: 0 };
				wsGehalt.getCell(`I${rowNum}`).value = { formula: `SUM(G${rowNum}:H${rowNum})`, result: 0 };
				wsGehalt.getCell(`K${rowNum}`).value = { formula: `I${rowNum}*J${rowNum}%`, result: 0 };
				wsGehalt.getCell(`O${rowNum}`).value = { formula: `SUM(G${rowNum}:G${rowNum})`, result: 0 };
				wsGehalt.getCell(`O${rowNum}`).numFmt = '#,##0.00 €';
				wsGehalt.getCell(`U${rowNum}`).value = { formula: `O${rowNum}*$Y$2`, result: 0 };
				wsGehalt.getCell(`V${rowNum}`).value = { formula: `U${rowNum}+O${rowNum}`, result: 0 };
				wsGehalt.getCell(`W${rowNum}`).value = { formula: `O${rowNum}*$AA$2`, result: 0 };
				wsGehalt.getCell(`X${rowNum}`).value = { formula: `V${rowNum}+W${rowNum}`, result: 0 };
				wsGehalt.getCell(`Y${rowNum}`).value = { formula: `K${rowNum}`, result: 0 };
				wsGehalt.getCell(`Z${rowNum}`).value = { formula: `V${rowNum}-I${rowNum}`, result: 0 };
				wsGehalt.getCell(`AA${rowNum}`).value = { formula: `V${rowNum}-Y${rowNum}-Z${rowNum}`, result: 0 };
				wsGehalt.getCell(`AB${rowNum}`).value = { formula: `$M$2*B${rowNum}`, result: 0 };
			}
		}

		// Year summary rows: JSZ, AGA auf JSZ, Yearly Totals
		const yearEndRow = currentRow - 1;
		const jszRow = currentRow++;
		const agaJszRow = currentRow++;
		const sumRow = currentRow++;

		yearlyTotalRows.push({ year: y, row: sumRow });

		// Calculate expected JSZ result (only if employed on 01.12.)
		const isEmployedInDecember = y < endYear || (y === endYear && (end.month > 12 || (end.month === 12 && end.day >= 1)));
		const jszAmount = isEmployedInDecember && lastActiveMonthRowNumber ? (sepSalaryValue * jszPct * (yearMonthUnitsTotal / 12)) : 0;
		const jszAgaAmount = isEmployedInDecember && lastActiveMonthRowNumber ? (sepAgaValue * jszPct * (yearMonthUnitsTotal / 12)) : 0;
		const jszBgAmount = isEmployedInDecember && lastActiveMonthRowNumber ? (sepBgValue * jszPct * (yearMonthUnitsTotal / 12)) : 0;

		// Row: Jahressonderzahlung (85%)
		wsGehalt.getCell(`L${jszRow}`).value = { formula: `SUM(B${yearStartRow}:B${yearEndRow})`, result: yearMonthUnitsTotal };
		wsGehalt.getCell(`L${jszRow}`).numFmt = '0.00';
		wsGehalt.getCell(`O${jszRow}`).value = `Jahressonderzahlung (${Math.round(jszPct * 100)}%)`;
		wsGehalt.getCell(`O${jszRow}`).font = { bold: true };

		const refSepO = septemberRowNumber ? `O${septemberRowNumber}` : (lastActiveMonthRowNumber ? `O${lastActiveMonthRowNumber}` : `O${yearEndRow}`);
		const refDec = decemberRowNumber || yearEndRow;

		// Col W: JSZ BG
		const cellJszW = wsGehalt.getCell(`W${jszRow}`);
		cellJszW.value = { formula: `IF(V${refDec}>0,Z${jszRow}*${sepBgRate},0)`, result: jszBgAmount };
		cellJszW.numFmt = '#,##0.00 €';

		// Col X: JSZ Total with BG: =W#+Z#
		const cellJszX = wsGehalt.getCell(`X${jszRow}`);
		cellJszX.value = { formula: `W${jszRow}+Z${jszRow}`, result: jszAmount + jszBgAmount };
		cellJszX.numFmt = '#,##0.00 €';

		// Col Z: JSZ in Anteil ZGS
		const cellJszZ = wsGehalt.getCell(`Z${jszRow}`);
		cellJszZ.value = { formula: `IF(V${refDec}>0,${refSepO}*${jszPct}*(L${jszRow}/12),0)`, result: jszAmount };
		cellJszZ.numFmt = '#,##0.00 €';

		// Row: AGA auf JSZ
		wsGehalt.getCell(`O${agaJszRow}`).value = 'AGA auf JSZ';
		wsGehalt.getCell(`O${agaJszRow}`).font = { bold: true };
		const refSepU = septemberRowNumber ? `U${septemberRowNumber}` : (lastActiveMonthRowNumber ? `U${lastActiveMonthRowNumber}` : `U${yearEndRow}`);

		// Col X: AGA auf JSZ in Gesamtkosten inkl. BG
		const cellAgaJszX = wsGehalt.getCell(`X${agaJszRow}`);
		cellAgaJszX.value = { formula: `Z${agaJszRow}`, result: jszAgaAmount };
		cellAgaJszX.numFmt = '#,##0.00 €';

		// Col Z: AGA auf JSZ in Anteil ZGS
		const cellAgaJszZ = wsGehalt.getCell(`Z${agaJszRow}`);
		cellAgaJszZ.value = { formula: `IF(V${refDec}>0,${refSepU}*${jszPct}*(L${jszRow}/12),0)`, result: jszAgaAmount };
		cellAgaJszZ.numFmt = '#,##0.00 €';

		// Row: Yearly Totals
		wsGehalt.getCell(`O${sumRow}`).value = { formula: `SUM(O${yearStartRow}:O${yearEndRow})` };
		wsGehalt.getCell(`O${sumRow}`).font = { bold: true };
		wsGehalt.getCell(`O${sumRow}`).numFmt = '#,##0.00 €';

		wsGehalt.getCell(`V${sumRow}`).value = { formula: `SUM(V${yearStartRow}:V${yearEndRow})` };
		wsGehalt.getCell(`V${sumRow}`).font = { bold: true };
		wsGehalt.getCell(`V${sumRow}`).numFmt = '#,##0.00 €';

		for (const col of ['W', 'X', 'Y', 'Z', 'AA', 'AB']) {
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

		for (const col of ['V', 'W', 'X', 'Y', 'Z', 'AA', 'AB']) {
			const cell = wsGehalt.getCell(`${col}${r}`);
			cell.value = { formula: `=${col}${item.row}` };
			cell.numFmt = '#,##0.00 €';
			cell.font = { bold: true };
		}
	}

	const grandTotalRow = currentRow++;
	for (const col of ['V', 'W', 'X', 'Y', 'Z', 'AA', 'AB']) {
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
	note1.value = `Die Jahressonderzahlung beträgt ${Math.round(jszPct * 100)}% des Septembergehalts (gemäß Arbeitsmonaten), mit Anspruch falls eine Beschäftigung zum 1.12. besteht (Tarif AWO Berlin 10. ÄTV / TE 05.05.2026)`;
	note1.font = { italic: true, size: 9 };

	for (const m of milestones) {
		if (m.type === 'stufenaufstieg' || m.type === 'tariferhoehung' || m.type === 'umgruppierung') {
			const noteCell = wsGehalt.getCell(`A${currentRow++}`);
			noteCell.value = `${m.label} am ${m.dateStr}`;
			noteCell.font = {
				bold: true,
				size: 9,
				color: m.type === 'umgruppierung' ? { argb: 'FFFFFFFF' } : undefined
			};
			noteCell.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: 'FF' + m.color }
			};
		}
	}

}

export function populateAgaWorksheet(wsAga: ExcelJS.Worksheet): void {
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
}

/**
 * Generates an Excel workbook for multiple participants, creating a Gehalt sheet for each,
 * followed by the shared AGA reference sheet.
 */
export async function generateMultiParticipantBerechnungsblattExcel(
	optionsList: BerechnungsblattGeneratorOptions[]
): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'AC-Grants Berechnungsblatt Generator';
	workbook.created = new Date();

	for (let i = 0; i < optionsList.length; i++) {
		const opts = optionsList[i];
		const sanitizedName = (opts.employeeName || `Teilnehmer_${i + 1}`).trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_');
		const sheetName = optionsList.length === 1 ? 'Gehalt' : `Gehalt - ${sanitizedName}`.slice(0, 31);
		const wsGehalt = workbook.addWorksheet(sheetName, {
			views: [{ showGridLines: true }]
		});
		populateGehaltWorksheet(wsGehalt, opts);
	}

	const wsAga = workbook.addWorksheet('AGA', {
		views: [{ showGridLines: true }]
	});
	populateAgaWorksheet(wsAga);

	const arrayBuffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(arrayBuffer);
}

/**
 * Generates a complete ExcelJS workbook for a single 5-year Berechnungsblatt.
 */
export async function generateBerechnungsblattExcel(
	options: BerechnungsblattGeneratorOptions
): Promise<Buffer> {
	return generateMultiParticipantBerechnungsblattExcel([options]);
}
