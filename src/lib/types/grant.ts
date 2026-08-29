export interface ParticipantInfo {
	name: string;
	tariffGroup: string;
	tariffStep: string;
	runtimeStart: string;
	runtimeEnd: string;
	weeklyHours: number;
	fullTimeHours: number;
	sachkostenMonthly: number;
	childrenCount: number;
	healthInsuranceName: string;
	defaultAgaRate: number;
}

export interface MonthlyRecord {
	date: string;
	year: number;
	month: number;
	monthUnits: number; // e.g. 1.0 or 0.5 from Column B (Anteil Monat)
	startDate: string; // DD.MM.YYYY
	endDate: string; // DD.MM.YYYY
	fteSalary: number;
	partTimeSalary: number;
	fullMonthlyPartTime?: number;
	weeklyHours: number;
	fullTimeHours: number;
	jcFlatRateAmount: number;
	jcTotalGross: number;
	fullMonthlyJcTotalGross?: number;
	jcDegressionPct: number;
	jcGrantAmount: number;
	agaRealRate: number;
	agaRealAmount: number;
	totalEmployerCost: number;
	landSvShortfall: number;
	fullMonthlySvShortfall?: number;
	landDegressionAmount: number;
	jszAmount: number;
	jszAgaAmount: number;
	sachkostenAmount: number;
	tariffDelta?: number;
	isJszMonth?: boolean;
	notes?: string;
}

export interface AgaRatePeriod {
	id: string;
	startDate: string;
	endDate: string;
	rate: number;
	label: string;
}

export interface FormRowItem {
	id: string;
	rowNumber: number;
	workingHours: number;
	monthlyAmount: number;
	percentage: number;
	monthCount: number;
	totalSum: number;
	yearlyAmounts: Record<number, number>;
	controlSum: number;
	participantName: string;
	runtimeText: string;
	tariffText: string;
	calculationPeriodText: string;
	explanationText?: string;
	costTypeText: string;
	compoundOneLineText: string;
	description: string;
	isOffsetRow?: boolean;
	category?: 'wage' | 'sv_shortfall' | 'degression' | 'jsz' | 'sachkosten' | 'offset';
}

export interface FormTabDefinition {
	id: string;
	title: string;
	tabNumber: number;
	rows: FormRowItem[];
	yearlyTotals: Record<number, number>;
	grandTotal: number;
	status: 'Angaben vollständig' | 'Keine Angaben' | 'Korrekt';
}

export interface ControlCheckItem {
	id: string;
	name: string;
	category: 'jobcenter' | 'landesmittel' | 'sachkosten' | 'total';
	excelValue: number;
	formValue: number;
	delta: number;
	status: 'MATCH' | 'OFFSET_APPLIED' | 'WARNING';
	note: string;
}

export interface ControlCheckResult {
	overallStatus: 'MATCH' | 'OFFSET_APPLIED' | 'WARNING';
	excelGrandTotal: number;
	formGrandTotal: number;
	totalDelta: number;
	items: ControlCheckItem[];
	jobcenterCheck: {
		excelTotal: number;
		formTotal: number;
		delta: number;
		offsetAmount: number;
	};
	landesmittelCheck: {
		excelTotal: number;
		formTotal: number;
		delta: number;
		offsetAmount: number;
	};
	sachkostenCheck: {
		excelTotal: number;
		formTotal: number;
		delta: number;
	};
}

export type RuntimeScope = 'exit_date' | 'foerderperiode' | 'full_5_years' | 'custom';
export type RuntimeStartScope = 'contract_start' | 'custom';

export interface GrantTransformationOptions {
	includeOffsetRows: boolean;
	runtimeScope?: RuntimeScope; // 'exit_date' (cell F2) | 'foerderperiode' (until 31.12.2029) | 'full_5_years' (60 months) | 'custom'
	customEndDate?: string; // Arbitrary end date for calculation (e.g. '31.03.2029' or '2029-03-31')
	runtimeStartScope?: RuntimeStartScope; // 'contract_start' (cell F2) | 'custom'
	customStartDate?: string; // Arbitrary start date for calculation / output generation (e.g. '01.01.2028' or '2028-01-01')
	restrictToExitDate?: boolean; // Legacy compatibility: true -> 'exit_date', false -> 'full_5_years'
	restrictToYear?: number; // Optional fallback year restriction
	customAgaTimeline?: AgaRatePeriod[];
}

export interface GrantTransformationResult {
	schemeId: string;
	schemeName: string;
	participant: ParticipantInfo;
	years: number[];
	runtimeMonths: number;
	tabs: FormTabDefinition[];
	controls: ControlCheckResult;
	agaTimeline: AgaRatePeriod[];
	options: GrantTransformationOptions;
	rawMonthlyRecords: MonthlyRecord[];
}

export interface GrantSchemeDefinition {
	id: string;
	name: string;
	description: string;
	defaultTariff: string;
	legalBasis: string;
	standardSachkostenMonthly: number;
	standardJcFlatRatePct: number;
	transform: (
		records: MonthlyRecord[],
		participant: ParticipantInfo,
		options: GrantTransformationOptions
	) => GrantTransformationResult;
}
