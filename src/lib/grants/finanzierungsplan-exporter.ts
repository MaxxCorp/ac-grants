import * as XLSX from 'xlsx';
import type { GrantTransformationResult } from '#lib/types/grant';
import { getVwkRate } from './berliner-jobcoaching';

function round2(val: number): number {
	return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Creates or prefills a Finanzierungsplan Excel workbook from a GrantTransformationResult.
 * If a template buffer is provided, it populates the exact cells and preserves formatting/styles.
 * Otherwise, it builds a fully structured Excel workbook ready for submission.
 */
export function generateFinanzierungsplanWorkbook(
	result: GrantTransformationResult,
	templateBuffer?: Buffer | Uint8Array
): Uint8Array {
	let wb: XLSX.WorkBook;

	if (templateBuffer) {
		wb = XLSX.read(templateBuffer, { type: 'buffer', cellFormula: true, cellStyles: true });
	} else {
		wb = XLSX.utils.book_new();
	}

	const activeYear = result.years[0] || 2027;
	const sheetName = String(activeYear);

	let ws = wb.Sheets[sheetName];
	if (!ws) {
		// If template has another year or no sheet
		const existingSheetName = wb.SheetNames[0];
		if (existingSheetName && wb.Sheets[existingSheetName]) {
			ws = wb.Sheets[existingSheetName];
		} else {
			ws = {};
			XLSX.utils.book_append_sheet(wb, ws, sheetName);
		}
	}

	const CURRENCY_FMT = '#,##0.00 "€"';

	const setCell = (addr: string, val: string | number | undefined | null, formula?: string, numFmt?: string) => {
		if (formula) {
			ws[addr] = {
				t: typeof val === 'number' ? 'n' : 's',
				v: val ?? 0,
				f: formula,
				z: numFmt !== undefined ? numFmt : (typeof val === 'number' ? CURRENCY_FMT : undefined)
			};
			return;
		}
		if (val === undefined || val === null) return;
		if (typeof val === 'number') {
			ws[addr] = { t: 'n', v: val, z: numFmt !== undefined ? numFmt : CURRENCY_FMT };
		} else {
			ws[addr] = { t: 's', v: String(val) };
		}
	};

	if (!templateBuffer) {
		ws['!cols'] = [
			{ wch: 4 },  // A
			{ wch: 40 }, // B (Name / Bezeichnung)
			{ wch: 22 }, // C (Einstufung nach TV-L / Betrag)
			{ wch: 18 }, // D (Januar AN-Brutto)
			{ wch: 18 }, // E (AG-Anteil Januar)
			{ wch: 22 }, // F (Februar - Juni AN-Brutto)
			{ wch: 22 }, // G (AG-Anteil Februar - Juni)
			{ wch: 22 }, // H (Juli - August AN-Brutto)
			{ wch: 22 }, // I (AG-Anteil Juli - August)
			{ wch: 20 }  // J (Summe)
		];
		setCell('B2', `Finanzierungsplan für das Berliner JobCoaching - Kurzantrag - ${activeYear}`);
		setCell('B9', 'Personalkosten');
		setCell('B10', 'Jobcoach (JC)           namentliche Nennung');
		setCell('C10', String(activeYear));
		setCell('C11', 'Einstufung nach TV-L');
		setCell('D11', 'Januar (AN - Brutto)');
		setCell('E11', 'AG - Anteil Januar');
		setCell('F11', 'Februar - Juni (AN - Brutto)');
		setCell('G11', 'AG - Anteil Februar - Juni');
		setCell('H11', 'Juli - August (AN - Brutto)');
		setCell('I11', 'AG - Anteil Juli - August');
		setCell('J11', 'Summe');

		setCell('B28', 'Personalkosten');
		setCell('B29', 'Beschäftigungstrainer (BT)           namentliche Nennung');
		setCell('C29', String(activeYear));
		setCell('C30', 'Einstufung nach TV-L');
		setCell('D30', 'Januar (AN - Brutto)');
		setCell('E30', 'AG - Anteil Januar');
		setCell('F30', 'Februar - Juni (AN - Brutto)');
		setCell('G30', 'AG - Anteil Februar - Juni');
		setCell('H30', 'Juli - August (AN - Brutto)');
		setCell('I30', 'AG - Anteil Juli - August');
		setCell('J30', 'Summe');

		setCell('I44', 'Summe PK:');
		setCell('B46', 'Sachkosten');
		setCell('B48', 'Didaktisches Material');
		setCell('B49', 'Miete & Mietnebenkosten');
		setCell('B50', 'Reisekosten des Personals');
		setCell('B51', 'Weiterbildung des Personals');
		setCell('B52', 'sonstige Sachkosten');
		setCell('B53', 'TN-Qualifizierungsbudget (666,66 € je JC)');
		setCell('B54', 'Verwaltungskostenpauschale *');
		setCell('B55', 'Summe SK:');
		setCell('A58', 'Gesamte Fördersumme');
		ws['!ref'] = 'A1:J65';
	}

	const jcData = result.jobCoachingData;
	const betreuungRows = jcData ? jcData.betreuungRows : [];
	const coachRows = betreuungRows.filter((r) => r.role === 'jobcoach');
	const trainerRows = betreuungRows.filter((r) => r.role === 'beschaeftigungstrainer');

	// Populate Jobcoach rows (Rows 12 to 24 in Finanzierungsplan)
	// Col B: Name, Col C: Tariff Group/Step
	// Col D: Jan Brutto, Col E: Jan AGA
	// Col F: Feb-Jun Brutto, Col G: Feb-Jun AGA
	// Col H: Jul-Aug Brutto, Col I: Jul-Aug AGA
	// Col J: Summe

	// Clear rows 12-24
	for (let r = 12; r <= 24; r++) {
		setCell(`B${r}`, '');
		setCell(`C${r}`, '');
		setCell(`D${r}`, 0);
		setCell(`E${r}`, 0);
		setCell(`F${r}`, 0);
		setCell(`G${r}`, 0);
		setCell(`H${r}`, 0);
		setCell(`I${r}`, 0);
		setCell(`J${r}`, 0, `D${r}+E${r}+F${r}+G${r}+H${r}+I${r}`);
	}

	// Populate coaches
	coachRows.forEach((row, idx) => {
		const r = 12 + idx;
		if (r > 24) return;

		setCell(`B${r}`, row.employeeName);
		setCell(`C${r}`, row.analogTariff.replace('AWO Berlin ', ''));

		if (row.monthCount === 6) {
			// Jan - Jun
			setCell(`D${r}`, row.monthlyGross);
			setCell(`E${r}`, row.monthlyAga);
			setCell(`F${r}`, round2(row.monthlyGross * 5), `${row.monthlyGross}*5`);
			setCell(`G${r}`, round2(row.monthlyAga * 5), `${row.monthlyAga}*5`);
		} else if (row.monthCount === 2) {
			// Jul - Aug
			setCell(`H${r}`, round2(row.monthlyGross * 2), `${row.monthlyGross}*2`);
			setCell(`I${r}`, round2(row.monthlyAga * 2), `${row.monthlyAga}*2`);
		} else {
			// Arbitrary duration: fill Jan and Feb-Jun proportional
			setCell(`D${r}`, row.monthlyGross);
			setCell(`E${r}`, row.monthlyAga);
			if (row.monthCount > 1) {
				const remainingMonths = row.monthCount - 1;
				setCell(`F${r}`, round2(row.monthlyGross * remainingMonths), `${row.monthlyGross}*${remainingMonths}`);
				setCell(`G${r}`, round2(row.monthlyAga * remainingMonths), `${row.monthlyAga}*${remainingMonths}`);
			}
		}

		setCell(`J${r}`, row.totalAmount, `D${r}+E${r}+F${r}+G${r}+H${r}+I${r}`);
	});

	// Clear rows 31-42 (Beschäftigungstrainer)
	for (let r = 31; r <= 42; r++) {
		setCell(`B${r}`, '');
		setCell(`C${r}`, '');
		setCell(`D${r}`, 0);
		setCell(`E${r}`, 0);
		setCell(`F${r}`, 0);
		setCell(`G${r}`, 0);
		setCell(`H${r}`, 0);
		setCell(`I${r}`, 0);
		setCell(`J${r}`, 0, `D${r}+E${r}+F${r}+G${r}+H${r}+I${r}`);
	}

	// Populate trainers
	trainerRows.forEach((row, idx) => {
		const r = 31 + idx;
		if (r > 42) return;

		setCell(`B${r}`, row.employeeName);
		setCell(`C${r}`, row.analogTariff.replace('AWO Berlin ', ''));

		if (row.monthCount === 6) {
			setCell(`D${r}`, row.monthlyGross);
			setCell(`E${r}`, row.monthlyAga);
			setCell(`F${r}`, round2(row.monthlyGross * 5), `${row.monthlyGross}*5`);
			setCell(`G${r}`, round2(row.monthlyAga * 5), `${row.monthlyAga}*5`);
		} else if (row.monthCount === 2) {
			setCell(`H${r}`, round2(row.monthlyGross * 2), `${row.monthlyGross}*2`);
			setCell(`I${r}`, round2(row.monthlyAga * 2), `${row.monthlyAga}*2`);
		} else {
			setCell(`D${r}`, row.monthlyGross);
			setCell(`E${r}`, row.monthlyAga);
			if (row.monthCount > 1) {
				const remainingMonths = row.monthCount - 1;
				setCell(`F${r}`, round2(row.monthlyGross * remainingMonths), `${row.monthlyGross}*${remainingMonths}`);
				setCell(`G${r}`, round2(row.monthlyAga * remainingMonths), `${row.monthlyAga}*${remainingMonths}`);
			}
		}

		setCell(`J${r}`, row.totalAmount, `D${r}+E${r}+F${r}+G${r}+H${r}+I${r}`);
	});

	// Fix Header typos in template if present
	setCell('G11', 'AG - Anteil Februar - Juni');
	setCell('I11', 'AG - Anteil Juli - August');
	setCell('G30', 'AG - Anteil Februar - Juni');
	setCell('I30', 'AG - Anteil Juli - August');

	// Summe Personalkosten (Row 44)
	const sumPkFormula = 'J12+J13+J14+J15+J16+J17+J18+J19+J20+J21+J22+J23+J24+J31+J32+J33+J34+J35+J36+J37+J38+J39+J40+J41+J42';
	const totalBetreuung = jcData ? jcData.totalBetreuung : 0;
	setCell('J44', totalBetreuung, sumPkFormula);

	// Sachkosten Section (Rows 48 to 58)
	const sachkosten = jcData?.sachkosten;
	const staffCount = jcData?.totalStaffCount || 1;
	const vwkRate = getVwkRate(staffCount);

	const miete = sachkosten ? sachkosten.mieteAmount : 1707.15;
	const sonstigeSk = sachkosten?.sonstigeSachkostenOverride !== undefined
		? sachkosten.sonstigeSachkostenOverride
		: (sachkosten ? sachkosten.bueroTotal : 973.12);
	const qualiBudget = sachkosten ? sachkosten.qualifizierungsBudgetTotal : 1333.32;
	const vwkAmount = round2(totalBetreuung * vwkRate);

	setCell('C49', miete);
	setCell('C52', sonstigeSk);
	setCell('C53', qualiBudget);
	setCell('C54', vwkAmount, `J44*${vwkRate}`);

	// Summe Sachkosten (Row 55)
	const sumSkFormula = 'C48+C49+C50+C51+C52+C53+C54';
	const sumSkValue = round2(miete + sonstigeSk + qualiBudget + vwkAmount);
	setCell('C55', sumSkValue, sumSkFormula);

	// Gesamte Fördersumme (Row 58)
	const totalFundingFormula = 'J44+C55';
	const totalFundingValue = round2(totalBetreuung + sumSkValue);
	setCell('C58', totalFundingValue, totalFundingFormula);

	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array;
}

/**
 * Triggers a browser download of the generated Finanzierungsplan Excel file.
 */
export function downloadFinanzierungsplanExcelFile(
	result: GrantTransformationResult,
	templateBuffer?: Buffer | Uint8Array,
	filename?: string
): void {
	if (typeof window === 'undefined') return;

	const wbBytes = generateFinanzierungsplanWorkbook(result, templateBuffer);
	const activeYear = result.years[0] || 2027;
	const defaultFilename = `Finanzierungsplan_Berliner_JobCoaching_${activeYear}.xlsx`;

	const blob = new Blob([wbBytes as any], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename || defaultFilename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
