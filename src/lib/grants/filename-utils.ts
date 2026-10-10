/**
 * Utility functions for consistent and discoverable file naming across all exports.
 * Files always start with the participant or project name to ensure alphabetical grouping
 * and ease-of-discovery in file managers.
 */

/**
 * Sanitizes a string to make it safe for file systems across Windows, macOS, and Linux.
 * Preserves German letters (ä, ö, ü, Ä, Ö, Ü, ß), numbers, and hyphens.
 * Replaces whitespace and other characters with underscores, collapsing duplicates.
 */
export function sanitizeFileNamePart(text?: string | null): string {
	if (!text) return '';
	return text
		.trim()
		.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
}

/**
 * Generates an export file name that always begins with the participant or project name.
 * Format: {Name}_{Category}.{extension}
 *
 * Example:
 * formatExportFileName('Frau Maria Musterfrau', 'Berechnungsblatt')
 * => 'Frau_Maria_Musterfrau_Berechnungsblatt.xlsx'
 */
export function formatExportFileName(
	name: string | undefined | null,
	category: string,
	fallbackName: string = 'Mitarbeiter',
	extension: string = 'xlsx'
): string {
	const sanitizedName = sanitizeFileNamePart(name) || sanitizeFileNamePart(fallbackName) || 'Export';
	const cleanCategory = sanitizeFileNamePart(category);
	const base = cleanCategory ? `${sanitizedName}_${cleanCategory}` : sanitizedName;
	const ext = extension.replace(/^\./, '');
	return `${base}.${ext}`;
}

/**
 * Generates the standardized file name for a Berechnungsblatt export (.xlsx).
 * Example: "Frau Maria Musterfrau" -> "Frau_Maria_Musterfrau_Berechnungsblatt.xlsx"
 */
export function getBerechnungsblattExportFileName(
	employeeName?: string | null,
	fallbackName: string = 'Mitarbeiter'
): string {
	return formatExportFileName(employeeName, 'Berechnungsblatt', fallbackName, 'xlsx');
}

/**
 * Generates the standardized file name for a TV-L Vergleichsberechnung export (.xlsx).
 * Example: "Frau Maria Musterfrau", 2026 -> "Frau_Maria_Musterfrau_Vergleichsberechnung_TV-L_2026.xlsx"
 */
export function getTvlExportFileName(
	participantName?: string | null,
	year?: number | string,
	fallbackName: string = 'Teilnehmer'
): string {
	const yrSuffix = year ? `_${year}` : '';
	return formatExportFileName(participantName, `Vergleichsberechnung_TV-L${yrSuffix}`, fallbackName, 'xlsx');
}

/**
 * Generates the standardized file name for a Berliner JobCoaching Finanzierungsplan export (.xlsx).
 * Example single: "Frau Maria Musterfrau", 2027 -> "Frau_Maria_Musterfrau_Finanzierungsplan_Berliner_JobCoaching_2027.xlsx"
 * Example multi: null, 2027, true, 3 -> "Gesamtprojekt_3_TLN_Finanzierungsplan_Berliner_JobCoaching_2027.xlsx"
 */
export function getFinanzierungsplanExportFileName(
	participantName?: string | null,
	year?: number | string,
	isMulti: boolean = false,
	participantCount?: number
): string {
	const yr = year || 2027;
	if (isMulti && participantCount && participantCount > 1) {
		return formatExportFileName(
			`Gesamtprojekt_${participantCount}_TLN`,
			`Finanzierungsplan_Berliner_JobCoaching_${yr}`,
			'JobCoaching',
			'xlsx'
		);
	}

	const sanitized = sanitizeFileNamePart(participantName);
	if (sanitized) {
		return formatExportFileName(
			sanitized,
			`Finanzierungsplan_Berliner_JobCoaching_${yr}`,
			'JobCoaching',
			'xlsx'
		);
	}

	return `Finanzierungsplan_Berliner_JobCoaching_${yr}.xlsx`;
}
