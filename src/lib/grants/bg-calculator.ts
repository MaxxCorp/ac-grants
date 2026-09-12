import type {
	BgwTarifstelle,
	BgwCalculationOptions,
	VbgTarifstelle,
	VbgCalculationOptions,
	ManualBgCalculationOptions,
	BgCalculationResult,
	OrganizationBgSettings,
	BgProviderType
} from '#lib/types/bg';

// Official BGW constants (2024 / 2025)
export const BGW_BEITRAGSFUSS_GEMEINNUETZIG = 1.94;
export const BGW_BEITRAGSFUSS_GEWERBLICH = 2.08;
export const BGW_AUSGLEICHSUMLAGE_DEFAULT = 0.08; // 8 Cent pro 1.000 Euro Arbeitsentgelt

/**
 * Official 6. Gefahrtarif der BGW (valid from 01.01.2025).
 * Contains all 17 Gefahrtarifstellen with industry branches and danger classes.
 */
export const BGW_TARIFSTELLEN: BgwTarifstelle[] = [
	{
		code: 'ts-14',
		number: 14,
		title: 'GTS 14: Beratung, Betreuung, mobile soziale Dienste & Eingliederungshilfe',
		category: 'social',
		description: 'Beratungs- und Betreuungsstellen (Familien-, Erziehungs-, Schuldner-, Schwangerschaftsberatung), mobile soziale Dienste ohne pflegerische Leistungen, Tageseinrichtungen für Personen in besonderen sozialen Situationen, Eingliederungshilfe, Integrationshilfe, Betreuungsvereine, Streetwork.',
		dangerClass: 3.47,
		dangerClassPrevious: 3.66
	},
	{
		code: 'ts-17',
		number: 17,
		title: 'GTS 17: WfbM, Beschäftigungs- & Qualifizierungsprojekte (AGH / SGB 16i)',
		category: 'workshop',
		description: 'Werkstätten für behinderte Menschen (WfbM), Beschäftigungs- und Qualifizierungseinrichtungen/-projekte und Arbeitsgelegenheiten für Personen in besonderen sozialen Situationen (Arbeitslose, Suchtkranke, Wohnungslose), Inklusionsunternehmen.',
		dangerClass: 8.40,
		dangerClassPrevious: 9.82
	},
	{
		code: 'ts-10',
		number: 10,
		title: 'GTS 10: Geschäfts- und Verwaltungsstellen, Verbände & Sozialwerke',
		category: 'admin',
		description: 'Geschäfts- und Verwaltungsstellen der Sozialwirtschaft, Kammern, Vereinigungen, Verrechnungsstellen, Sozialwerke, Verbände und deren Dienstleistungsunternehmen.',
		dangerClass: 2.59
	},
	{
		code: 'ts-11',
		number: 11,
		title: 'GTS 11: Heime, Wohneinrichtungen & stationäre Hospize',
		category: 'social',
		description: 'Heime und Wohneinrichtungen der Kinder-, Jugend- und Familienhilfe, Heime für pflegebedürftige und behinderte Menschen, stationäre Hospize, besondere Wohnformen, Übergangsheime.',
		dangerClass: 3.96,
		dangerClassPrevious: 3.71
	},
	{
		code: 'ts-12',
		number: 12,
		title: 'GTS 12: Kitas, Kindertagespflege, Ganztagsbetreuung & Schulen',
		category: 'social',
		description: 'Kinderkrippen, Krabbelstuben, Kindergärten, Kitas, Horte, Schulkinderbetreuung im Ganztag, verlässliche Grundschulen, allgemeinbildende Schulen.',
		dangerClass: 2.69
	},
	{
		code: 'ts-16',
		number: 16,
		title: 'GTS 16: Berufliche Bildung & Rehabilitation',
		category: 'social',
		description: 'Einrichtungen der beruflichen Bildung und Rehabilitation, Fachschulen, Fachakademien, Berufsbildungswerke, Berufsförderungswerke, ausbildungsbegleitende Hilfen.',
		dangerClass: 4.01
	},
	{
		code: 'ts-15',
		number: 15,
		title: 'GTS 15: Ambulante Pflegedienste, Fahrdienste & Mahlzeitendienste',
		category: 'health',
		description: 'Ambulante Pflegedienste, Sozialstationen, Haus- und Krankenpflege, Fahrdienste für mobilitätseingeschränkte Menschen, Mahlzeitendienste, Rettungsdienste.',
		dangerClass: 5.49
	},
	{
		code: 'ts-01',
		number: 1,
		title: 'GTS 01: Stationäre ärztliche Versorgung & Kliniken',
		category: 'health',
		description: 'Krankenhäuser, Kliniken, stationäre Reha- und Vorsorgeeinrichtungen, Sanatorien, Fachkliniken.',
		dangerClass: 3.21
	},
	{
		code: 'ts-02',
		number: 2,
		title: 'GTS 02: Ambulante ärztliche Versorgung & Psychotherapie',
		category: 'health',
		description: 'Arztpraxen, Notfalldienste, medizinische Versorgungszentren (MVZ), Praxen für Psychologie und Psychotherapie, Labore.',
		dangerClass: 2.11
	},
	{
		code: 'ts-06',
		number: 6,
		title: 'GTS 06: Frühförderung, Hebammen, Logopädie & Dozierende',
		category: 'health',
		description: 'Ambulante Vorsorge/Reha, Frühförderstellen, sozialpädiatrische Zentren, Hebammen, Logopädie, Heilpädagogik, Lehrende und Dozierende.',
		dangerClass: 2.51
	},
	{
		code: 'ts-07',
		number: 7,
		title: 'GTS 07: Physiotherapie, Ergotherapie, Heilpraktiker & Bäder',
		category: 'health',
		description: 'Praxen für Physiotherapie, Ergotherapie, Massage, medizinische Bäder, Heilkunde nach dem Heilpraktikergesetz, Podologie.',
		dangerClass: 3.78
	},
	{
		code: 'ts-03',
		number: 3,
		title: 'GTS 03: Zahnärztliche Versorgung',
		category: 'health',
		description: 'Zahnarztpraxen, zahntechnische Institute, Zahnkliniken.',
		dangerClass: 1.80
	},
	{
		code: 'ts-04',
		number: 4,
		title: 'GTS 04: Apotheken & pharmazeutische Labore',
		category: 'health',
		description: 'Öffentliche Apotheken, Krankenhausapotheken, pharmazeutische Forschung und Labore.',
		dangerClass: 1.97
	},
	{
		code: 'ts-05',
		number: 5,
		title: 'GTS 05: Veterinärmedizin & Tierbehandlung',
		category: 'other',
		description: 'Tierarztpraxen, Tierkliniken, Schädlingsbekämpfung, Desinfektion.',
		dangerClass: 7.23
	},
	{
		code: 'ts-09',
		number: 9,
		title: 'GTS 09: Friseurhandwerk & Kosmetikfachschulen',
		category: 'other',
		description: 'Unternehmen des Friseurhandwerks, Kosmetik- und Friseur-Fachschulen.',
		dangerClass: 3.63
	}
];

// VBG constants & presets
export const VBG_BEITRAGSFUSS_DEFAULT = 4.00; // ca. 4,00 pro 1.000 €

export const VBG_TARIFSTELLEN: VbgTarifstelle[] = [
	{
		code: 'vbg-ts-26',
		title: 'VBG TS 26: Verwaltung, Büro & freie Berufe (IT, Beratung)',
		description: 'Bürobetriebe, Verwaltungen, EDV-Beratung, Unternehmensberatung, Rechtsberatung.',
		dangerClass: 0.33
	},
	{
		code: 'vbg-ts-27',
		title: 'VBG TS 27: Vereine, Verbände & Interessenvertretungen',
		description: 'Gemeinnützige Vereine, Verbände, Gewerkschaften, politische Parteien.',
		dangerClass: 0.45
	},
	{
		code: 'vbg-ts-13',
		title: 'VBG TS 13: Bildungseinrichtungen & Schulen',
		description: 'Privatschulen, Bildungsträger, Weiterbildungsinstitute, Sprachschulen.',
		dangerClass: 0.70
	},
	{
		code: 'vbg-ts-24',
		title: 'VBG TS 24: Zeitarbeit & Arbeitnehmerüberlassung',
		description: 'Personaldienstleister und Zeitarbeitsunternehmen.',
		dangerClass: 3.80
	}
];

export function getBgwTarifstelle(code: string): BgwTarifstelle | undefined {
	return BGW_TARIFSTELLEN.find(ts => ts.code === code);
}

export function getVbgTarifstelle(code: string): VbgTarifstelle | undefined {
	return VBG_TARIFSTELLEN.find(ts => ts.code === code);
}

/**
 * Calculates statutory BGW contribution rate under § 152 ff. SGB VII.
 *
 * Formula:
 *   Umlagebeitrag = (Entgelt * Gefahrklasse * Beitragsfuß) / 1.000
 *   Ausgleichsumlage = (Entgelt * Ausgleichsumlage-Satz) / 1.000
 *   Zuschlag = Umlagebeitrag * (zuschlagProzent / 100)
 *
 * Effective rate decimal = ((Gefahrklasse * Beitragsfuß / 1000) * (1 + zuschlag/100)) + (Ausgleichsumlage / 1000)
 */
export function calculateBgwRate(options: BgwCalculationOptions): BgCalculationResult {
	const gts = getBgwTarifstelle(options.tarifstelleCode) || BGW_TARIFSTELLEN[0];
	const dangerClass = options.dangerClassOverride ?? gts.dangerClass;

	const defaultBeitragsfuss = options.isNonProfit
		? BGW_BEITRAGSFUSS_GEMEINNUETZIG
		: BGW_BEITRAGSFUSS_GEWERBLICH;
	const beitragsfuss = options.beitragsfussOverride ?? defaultBeitragsfuss;

	const ausgleichsumlageRate = options.ausgleichsumlageRate ?? BGW_AUSGLEICHSUMLAGE_DEFAULT;
	const surchargePct = options.surchargePercentage ?? 0.0;

	// Base rate for statutory risk cover: (GK * BF) / 1000
	const baseRate = (dangerClass * beitragsfuss) / 1000;
	// Risk surcharge/rebate under Beitragsausgleichsverfahren
	const surchargeFactor = 1 + (surchargePct / 100);
	const adjustedBaseRate = baseRate * surchargeFactor;

	// Ausgleichsumlage Wohlfahrtspflege (0.08 € pro 1.000 € Entgelt -> 0.0000800)
	const ausgleichsumlageFactor = ausgleichsumlageRate / 1000;

	// Total effective decimal rate
	const rateDecimal = adjustedBaseRate + ausgleichsumlageFactor;
	const ratePercent = rateDecimal * 100;

	const nonProfitLabel = options.isNonProfit ? 'Gemeinnützig (BF 1,94)' : 'Gewerblich (BF 2,08)';
	const gtsShort = `GTS ${gts.number} (GK ${dangerClass.toFixed(2).replace('.', ',')})`;

	// Formula breakdown readable string
	let breakdown = `(${dangerClass.toFixed(2).replace('.', ',')} × ${beitragsfuss.toFixed(2).replace('.', ',')} ÷ 1.000)`;
	if (surchargePct !== 0) {
		breakdown += ` × (1 ${surchargePct > 0 ? '+' : '-'} ${Math.abs(surchargePct).toFixed(1).replace('.', ',')}%)`;
	}
	if (ausgleichsumlageRate > 0) {
		breakdown += ` + (${ausgleichsumlageRate.toFixed(2).replace('.', ',')} € ÷ 1.000)`;
	}
	breakdown += ` = ${ratePercent.toFixed(3).replace('.', ',')}%`;

	return {
		provider: 'bgw',
		rateDecimal,
		ratePercent,
		formulaBreakdown: breakdown,
		providerLabel: `BGW – ${nonProfitLabel}`,
		detailsLabel: `${gtsShort} | ${breakdown}`
	};
}

/**
 * Calculates statutory VBG contribution rate.
 *
 * Formula:
 *   Umlagebeitrag = (Entgelt * Gefahrklasse * Beitragsfuß) / 1.000
 */
export function calculateVbgRate(options: VbgCalculationOptions): BgCalculationResult {
	const dangerClass = options.dangerClass;
	const beitragsfuss = options.beitragsfuss || VBG_BEITRAGSFUSS_DEFAULT;

	const rateDecimal = (dangerClass * beitragsfuss) / 1000;
	const ratePercent = rateDecimal * 100;

	const breakdown = `(${dangerClass.toFixed(2).replace('.', ',')} × ${beitragsfuss.toFixed(2).replace('.', ',')} ÷ 1.000) = ${ratePercent.toFixed(3).replace('.', ',')}%`;

	return {
		provider: 'vbg',
		rateDecimal,
		ratePercent,
		formulaBreakdown: breakdown,
		providerLabel: 'VBG (Verwaltungs-Berufsgenossenschaft)',
		detailsLabel: `GK ${dangerClass.toFixed(2).replace('.', ',')} | ${breakdown}`
	};
}

/**
 * Direct percentage calculation.
 */
export function calculateManualRate(options: ManualBgCalculationOptions): BgCalculationResult {
	const ratePercent = Math.max(0, options.ratePercent);
	const rateDecimal = ratePercent / 100;

	return {
		provider: 'manual',
		rateDecimal,
		ratePercent,
		formulaBreakdown: `Manuell festgelegt: ${ratePercent.toFixed(3).replace('.', ',')}%`,
		providerLabel: 'Manuell / Freier Beitragssatz',
		detailsLabel: `${ratePercent.toFixed(3).replace('.', ',')}% (0,${(rateDecimal * 100000).toFixed(0).padStart(5, '0')})`
	};
}

/**
 * Unified resolver from full settings or partial config.
 */
export function calculateEffectiveBgRate(settings: OrganizationBgSettings): BgCalculationResult {
	if (settings.provider === 'bgw') {
		return calculateBgwRate(settings.bgw);
	}
	if (settings.provider === 'vbg') {
		return calculateVbgRate(settings.vbg);
	}
	return calculateManualRate({ ratePercent: settings.manualRatePercent });
}

/**
 * Default organization settings (BGW, gemeinnützig, GTS 14 Wohlfahrtspflege/Betreuung -> 0.681%).
 */
export const DEFAULT_ORGANIZATION_BG_SETTINGS: OrganizationBgSettings = {
	provider: 'bgw',
	bgw: {
		isNonProfit: true,
		tarifstelleCode: 'ts-14',
		ausgleichsumlageRate: BGW_AUSGLEICHSUMLAGE_DEFAULT,
		surchargePercentage: 0.0
	},
	vbg: {
		tarifstelleCode: 'vbg-ts-26',
		dangerClass: 0.33,
		beitragsfuss: VBG_BEITRAGSFUSS_DEFAULT
	},
	manualRatePercent: 0.681
};

/**
 * Default effective decimal rate for the system:
 * (3.47 * 1.94 / 1000) + (0.08 / 1000) = 0.0068118
 */
export const DEFAULT_EFFECTIVE_BG_RATE_DECIMAL = 0.00681;
