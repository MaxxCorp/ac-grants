import * as XLSX from 'xlsx';
import type { TvlComparisonResult } from '#lib/types/grant';

function parseDateToExcelSerial(dStr: string): number | null {
	if (!dStr) return null;
	const parts = dStr.split('.');
	if (parts.length === 3) {
		const d = parseInt(parts[0], 10);
		const m = parseInt(parts[1], 10);
		const y = parseInt(parts[2], 10);
		const dateObj = new Date(Date.UTC(y, m - 1, d));
		const epoch = new Date(Date.UTC(1899, 11, 30));
		return Math.round((dateObj.getTime() - epoch.getTime()) / 86400000);
	}
	return null;
}

/**
 * Creates or prefills a TV-L Comparison Excel workbook from a TvlComparisonResult.
 * If a template buffer is provided (from the respective year's template), it fills in the exact cells.
 * Otherwise, it creates a fully structured workbook ready for download.
 */
export function generateTvlComparisonWorkbook(
	result: TvlComparisonResult,
	templateBuffer?: Buffer | Uint8Array
): Uint8Array {
	let wb: XLSX.WorkBook;

	if (templateBuffer) {
		wb = XLSX.read(templateBuffer, { type: 'buffer', cellFormula: true, cellStyles: true });
	} else {
		// Create workbook with standard sheets
		wb = XLSX.utils.book_new();
	}

	let ws = wb.Sheets['Vergleichsberechnung'];
	if (!ws) {
		ws = {};
		XLSX.utils.book_append_sheet(wb, ws, 'Vergleichsberechnung');
	}

	const setCell = (addr: string, val: string | number | undefined | null) => {
		if (val === undefined || val === null) return;
		if (typeof val === 'number') {
			ws[addr] = { t: 'n', v: val };
		} else {
			ws[addr] = { t: 's', v: String(val) };
		}
	};

	const inputs = result.inputs;

	// 1. General & Header Info
	setCell('A1', 'Vergleichsberechnung nach TV-L ');
	setCell('I1', inputs.year);
	setCell('E2', inputs.traegerName);
	const antragsDateSerial = parseDateToExcelSerial(inputs.antragsdatum);
	setCell('E3', antragsDateSerial || inputs.antragsdatum);
	setCell('E4', inputs.projektnummer);
	setCell('E5', inputs.participantName);
	setCell('E6', inputs.qualifikation);
	setCell('E7', inputs.taetigkeit);
	const eintrittsDateSerial = parseDateToExcelSerial(inputs.eintrittsdatum);
	setCell('K7', eintrittsDateSerial || inputs.eintrittsdatum);
	if (inputs.abweichendeTaetigkeit) setCell('E8', inputs.abweichendeTaetigkeit);

	// 2. Left Section
	setCell('E9', inputs.tariffGroupStepLeft);
	const startLeftSerial = parseDateToExcelSerial(inputs.startDateLeft);
	setCell('E11', startLeftSerial || inputs.startDateLeft);
	const endLeftSerial = parseDateToExcelSerial(inputs.endDateLeft);
	setCell('J11', endLeftSerial || inputs.endDateLeft);
	setCell('E12', inputs.weeklyHoursLeft);
	setCell('K17', inputs.istJanMarLeft);
	setCell('K18', inputs.istAbAprLeft);
	if (inputs.besitzstandLeft) setCell('J20', inputs.besitzstandLeft);
	if (inputs.vwlLeft) setCell('J21', inputs.vwlLeft);

	// Social Security Rates
	setCell('G26', inputs.kvRate);
	setCell('C27', inputs.selectedInsuranceName);
	setCell('G28', inputs.kkZusatzRate);
	setCell('G29', inputs.rvRate);
	setCell('G30', inputs.avRate);
	setCell('G31', inputs.pvRate);
	if (inputs.vorsorgeRate) setCell('G32', inputs.vorsorgeRate);
	setCell('G33', inputs.u1Rate);
	setCell('G34', inputs.u2Rate);
	setCell('G35', inputs.u3Rate);

	// 3. Right Section (if Step Upgrade)
	if (inputs.hasStepUpgrade && result.periodRight) {
		setCell('P2', inputs.tariffGroupStepRight);
		const startRightSerial = parseDateToExcelSerial(inputs.startDateRight);
		setCell('P4', startRightSerial || inputs.startDateRight);
		const endRightSerial = parseDateToExcelSerial(inputs.endDateRight);
		setCell('U4', endRightSerial || inputs.endDateRight);
		setCell('P5', inputs.weeklyHoursRight);
		setCell('V10', inputs.istJanMarRight);
		setCell('V11', inputs.istAbAprRight);
		setCell('V21', inputs.istJszRight);
	}

	// 4. Notes & Bearbeiter
	if (inputs.bemerkungen) setCell('M39', inputs.bemerkungen);
	if (inputs.bearbeiterName) setCell('O43', inputs.bearbeiterName);
	if (inputs.bearbeiterDate) {
		const bDateSerial = parseDateToExcelSerial(inputs.bearbeiterDate);
		setCell('M43', bDateSerial || inputs.bearbeiterDate);
	}

	// Calculate and set worksheet range reference
	const cellKeys = Object.keys(ws).filter(k => !k.startsWith('!'));
	if (cellKeys.length > 0) {
		let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
		for (const k of cellKeys) {
			const decoded = XLSX.utils.decode_cell(k);
			if (decoded.r < minR) minR = decoded.r;
			if (decoded.r > maxR) maxR = decoded.r;
			if (decoded.c < minC) minC = decoded.c;
			if (decoded.c > maxC) maxC = decoded.c;
		}
		ws['!ref'] = XLSX.utils.encode_range({ s: { r: minR, c: minC }, e: { r: maxR, c: maxC } });
	}

	const wbOut = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
	return new Uint8Array(wbOut);
}

/**
 * Triggers a browser download for the TV-L Vergleichsberechnung Excel file.
 */
export function downloadTvlExcelFile(result: TvlComparisonResult, customFileName?: string): void {
	const bytes = generateTvlComparisonWorkbook(result);
	const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = customFileName || `Vergleichsberechnung_TV-L_${result.year}_${result.inputs.participantName.replace(/\s+/g, '_')}.xlsx`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
