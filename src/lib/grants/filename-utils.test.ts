import { describe, it, expect } from 'vitest';
import {
	sanitizeFileNamePart,
	formatExportFileName,
	getBerechnungsblattExportFileName,
	getTvlExportFileName,
	getFinanzierungsplanExportFileName
} from './filename-utils';

describe('Filename Export Utilities', () => {
	describe('sanitizeFileNamePart', () => {
		it('handles standard names with spaces', () => {
			expect(sanitizeFileNamePart('Frau Maria Musterfrau')).toBe('Frau_Maria_Musterfrau');
		});

		it('preserves German umlauts and ß', () => {
			expect(sanitizeFileNamePart('Herr Björn Müller-Groß')).toBe('Herr_Björn_Müller-Groß');
		});

		it('collapses multiple spaces, dashes or illegal punctuation into clean single underscores', () => {
			expect(sanitizeFileNamePart('  Dr.  Maria   Musterfrau,  M.A.  ')).toBe('Dr_Maria_Musterfrau_M_A');
			expect(sanitizeFileNamePart('Mustermann / Tester (ZGS)')).toBe('Mustermann_Tester_ZGS');
		});

		it('strips leading and trailing underscores', () => {
			expect(sanitizeFileNamePart('___Musterfrau___')).toBe('Musterfrau');
		});

		it('returns empty string for null or undefined or empty', () => {
			expect(sanitizeFileNamePart('')).toBe('');
			expect(sanitizeFileNamePart(null)).toBe('');
			expect(sanitizeFileNamePart(undefined)).toBe('');
		});
	});

	describe('formatExportFileName', () => {
		it('ensures file name always starts with the name: Frau Maria Musterfrau', () => {
			const fileName = formatExportFileName('Frau Maria Musterfrau', 'Berechnungsblatt');
			expect(fileName).toBe('Frau_Maria_Musterfrau_Berechnungsblatt.xlsx');
		});

		it('uses fallback when name is omitted or whitespace', () => {
			const fileName = formatExportFileName('   ', 'Berechnungsblatt', 'Mitarbeiter');
			expect(fileName).toBe('Mitarbeiter_Berechnungsblatt.xlsx');
		});

		it('customizes extension if specified', () => {
			const fileName = formatExportFileName('Herr Max Mustermann', 'Report', 'Mitarbeiter', 'csv');
			expect(fileName).toBe('Herr_Max_Mustermann_Report.csv');
		});
	});

	describe('getBerechnungsblattExportFileName', () => {
		it('matches the requested requirement for Frau Maria Musterfrau', () => {
			expect(getBerechnungsblattExportFileName('Frau Maria Musterfrau')).toBe(
				'Frau_Maria_Musterfrau_Berechnungsblatt.xlsx'
			);
		});

		it('falls back to Mitarbeiter_Berechnungsblatt.xlsx if no name provided', () => {
			expect(getBerechnungsblattExportFileName('')).toBe('Mitarbeiter_Berechnungsblatt.xlsx');
			expect(getBerechnungsblattExportFileName(undefined)).toBe('Mitarbeiter_Berechnungsblatt.xlsx');
		});
	});

	describe('getTvlExportFileName', () => {
		it('always starts with participant name for TV-L comparison exports', () => {
			expect(getTvlExportFileName('Frau Maria Musterfrau', 2026)).toBe(
				'Frau_Maria_Musterfrau_Vergleichsberechnung_TV-L_2026.xlsx'
			);
		});

		it('falls back to Teilnehmer prefix if participant name is empty', () => {
			expect(getTvlExportFileName(undefined, 2026)).toBe('Teilnehmer_Vergleichsberechnung_TV-L_2026.xlsx');
		});
	});

	describe('getFinanzierungsplanExportFileName', () => {
		it('starts with participant name for single participant Finanzierungsplan export', () => {
			expect(getFinanzierungsplanExportFileName('Frau Maria Musterfrau', 2027)).toBe(
				'Frau_Maria_Musterfrau_Finanzierungsplan_Berliner_JobCoaching_2027.xlsx'
			);
		});

		it('starts with Gesamtprojekt when multiple participants are exported', () => {
			expect(getFinanzierungsplanExportFileName(null, 2027, true, 3)).toBe(
				'Gesamtprojekt_3_TLN_Finanzierungsplan_Berliner_JobCoaching_2027.xlsx'
			);
		});

		it('falls back to standard Finanzierungsplan name if no participant name is given', () => {
			expect(getFinanzierungsplanExportFileName(undefined, 2027)).toBe(
				'Finanzierungsplan_Berliner_JobCoaching_2027.xlsx'
			);
		});
	});
});
