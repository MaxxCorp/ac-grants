export type BgProviderType = 'bgw' | 'vbg' | 'manual';

export interface BgwTarifstelle {
	code: string;
	number: number;
	title: string;
	category: 'social' | 'health' | 'admin' | 'workshop' | 'other';
	description: string;
	dangerClass: number; // 6. Gefahrtarif ab 01.01.2025
	dangerClassPrevious?: number; // 5. Gefahrtarif (2019 - 2024)
}

export interface BgwCalculationOptions {
	isNonProfit: boolean; // Gemeinnützig / kirchlich / mildtätig (Standard: true -> Beitragsfuß 1,94, false -> 2,08)
	tarifstelleCode: string; // e.g. 'ts-14'
	dangerClassOverride?: number; // Optional individual danger class override
	beitragsfussOverride?: number; // Optional Beitragsfuß override
	ausgleichsumlageRate?: number; // Standard: 0.08 € pro 1.000 € Entgelt
	surchargePercentage?: number; // Beitragsausgleichsverfahren: Zuschlag/Nachlass in % (Standard: 0.0%)
}

export interface VbgTarifstelle {
	code: string;
	title: string;
	description: string;
	dangerClass: number;
}

export interface VbgCalculationOptions {
	tarifstelleCode?: string;
	dangerClass: number;
	beitragsfuss: number; // Standard: ca. 4.00 pro 1.000 € Entgelt
}

export interface ManualBgCalculationOptions {
	ratePercent: number; // e.g. 0.68 for 0.68%
}

export interface BgCalculationResult {
	provider: BgProviderType;
	rateDecimal: number; // e.g. 0.0068118
	ratePercent: number; // e.g. 0.68118
	formulaBreakdown: string;
	providerLabel: string;
	detailsLabel: string;
}

export interface OrganizationBgSettings {
	provider: BgProviderType;
	bgw: BgwCalculationOptions;
	vbg: VbgCalculationOptions;
	manualRatePercent: number;
}
