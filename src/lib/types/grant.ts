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

export interface InsuranceFundDetails {
	name: string;
	kvRate: number; // e.g. 0.073 (AG Anteil)
	zusatzbeitragTotal: number; // e.g. 0.032 (3.2%)
	zusatzbeitragAg: number; // e.g. 0.016 (1.6%)
	rvRate: number; // e.g. 0.093 (9.3%)
	avRate: number; // e.g. 0.013 (1.3%)
	pvRate: number; // e.g. 0.018 (1.8%)
	u1Rate: number; // e.g. 0.013 (1.3%)
	u2Rate: number; // e.g. 0.0039 (0.39%)
	u3Rate: number; // e.g. 0.0015 (0.15%)
	agaRate: number; // e.g. 0.2314 (Total AG-Anteil)
}

export interface TvlTariffEntry {
	code: string; // e.g. 'E2/2', 'E2/3', 'S8b/1'
	valJanMar: number; // Entgelt Jan bis März (TV-L 39.4h)
	jszPct: number; // Jahressonderzahlung percentage (e.g. 0.8743)
	valAbApr: number; // Entgelt ab April (TV-L 39.4h)
	sueZulage: number; // SuE Zulage aus S-Tabelle (0 for standard E)
}

export interface TvlPeriodCalculation {
	tariffCode: string;
	startDate: string; // DD.MM.YYYY
	endDate: string; // DD.MM.YYYY
	weeklyHours: number;
	totalMonths: number;
	monthsPreSwitch: number; // bis März (or switch month)
	monthsPostSwitch: number; // ab April (or switch month)
	
	// Entgelte
	tvl394JanMar: number;
	tvlUmJanMar: number; // converted to weeklyHours
	istJanMar: number;
	
	tvl394AbApr: number;
	tvlUmAbApr: number;
	istAbApr: number;
	
	sueZulage394: number;
	sueZulageUm: number;
	besitzstand: number;
	vwl: number;
	
	avgMonthlyGross394: number;
	avgMonthlyGrossUm: number;
	avgMonthlyGrossIst: number;
	
	grossWithoutJsz394: number;
	grossWithoutJszUm: number;
	grossWithoutJszIst: number;
	
	jszRatePct: number;
	jsz394: number;
	jszUm: number;
	jszIst: number;
	
	grossWithJsz394: number;
	grossWithJszUm: number;
	grossWithJszIst: number;
	
	// Social Security contributions
	kvAmount394: number;
	kvAmountUm: number;
	kvAmountIst: number;
	
	kkzAmount394: number;
	kkzAmountUm: number;
	kkzAmountIst: number;
	
	rvAmount394: number;
	rvAmountUm: number;
	rvAmountIst: number;
	
	avAmount394: number;
	avAmountUm: number;
	avAmountIst: number;
	
	pvAmount394: number;
	pvAmountUm: number;
	pvAmountIst: number;
	
	vorsorgeAmount394: number;
	vorsorgeAmountUm: number;
	vorsorgeAmountIst: number;
	
	u1Amount394: number;
	u1AmountUm: number;
	u1AmountIst: number;
	
	u2Amount394: number;
	u2AmountUm: number;
	u2AmountIst: number;
	
	u3Amount394: number;
	u3AmountUm: number;
	u3AmountIst: number;
	
	totalAgSv394: number;
	totalAgSvUm: number;
	totalAgSvIst: number;
	
	personalkostenPeriod394: number;
	personalkostenPeriodUm: number;
	personalkostenPeriodIst: number;
	
	avgMonthlyAgGrossUm: number;
	avgMonthlyAgGrossIst: number;
	deltaIstTvl: number;
}

export interface TvlComparisonInputs {
	year: number;
	traegerName: string;
	antragsdatum: string;
	projektnummer: string;
	participantName: string;
	qualifikation: string;
	taetigkeit: string;
	eintrittsdatum: string;
	abweichendeTaetigkeit?: string;
	
	// Left Section inputs
	tariffGroupStepLeft: string; // e.g. "E2/2"
	startDateLeft: string; // e.g. "01.01.2026"
	endDateLeft: string; // e.g. "15.01.2026"
	weeklyHoursLeft: number;
	istJanMarLeft: number;
	istAbAprLeft: number;
	besitzstandLeft: number;
	vwlLeft: number;
	
	// Right Section inputs (Unterjähriger Stufenaufstieg)
	hasStepUpgrade: boolean;
	tariffGroupStepRight: string; // e.g. "E2/3"
	startDateRight: string; // e.g. "16.01.2026"
	endDateRight: string; // e.g. "31.12.2026"
	weeklyHoursRight: number;
	istJanMarRight: number;
	istAbAprRight: number;
	besitzstandRight: number;
	vwlRight: number;
	istJszRight: number;
	
	// Social security & insurance fund overrides
	selectedInsuranceName: string;
	kvRate: number; // default 0.073
	kkZusatzRate: number; // default e.g. 0.016
	rvRate: number; // default 0.093
	avRate: number; // default 0.013
	pvRate: number; // default 0.018
	vorsorgeRate: number; // default 0
	u1Rate: number; // default 0.013
	u2Rate: number; // default 0.0039
	u3Rate: number; // default 0.0015
	
	bemerkungen: string;
	bearbeiterName?: string;
	bearbeiterDate?: string;
}

export interface TariffDiscrepancy {
	recordDate: string;
	year: number;
	month: number;
	group: string;
	step: number | string;
	recordedFteSalary: number; // Column F in Berechnungsblatt
	expectedFteSalary: number; // Official AWO Tariftabelle Full-Time
	recordedPartTimeSalary: number;
	expectedPartTimeSalary: number;
	diffFteSalary: number;
	diffPartTime: number;
	isDiscrepancy: boolean;
	explanation: string;
}

export interface TariffValidationReport {
	isCompliant: boolean;
	checkedCount: number;
	skippedPriorTo2025Count: number;
	discrepancyCount: number;
	discrepancies: TariffDiscrepancy[];
	summaryText: string;
}

export interface TvlComparisonResult {
	year: number;
	inputs: TvlComparisonInputs;
	periodLeft: TvlPeriodCalculation;
	periodRight?: TvlPeriodCalculation;
	
	totalMonths: number;
	totalPersonalkosten394: number;
	totalPersonalkostenTvl: number;
	totalPersonalkostenIst: number;
	
	avgMonthlyAgGrossTvl: number;
	avgMonthlyAgGrossIst: number;
	
	totalDifference: number; // Ist - TVL (negative means compliant)
	isBesserstellungsverbotCompliant: boolean;
	availableYears: number[];
	availableTariffs: string[];
	availableInsuranceFunds: InsuranceFundDetails[];
	
	// AWO Tariff Increase Validation
	tariffValidation?: TariffValidationReport;
	expectedIstJanMarLeft?: number;
	expectedIstAbAprLeft?: number;
	expectedIstJanMarRight?: number;
	expectedIstAbAprRight?: number;
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
	insuranceFunds?: InsuranceFundDetails[];
	tariffValidation?: TariffValidationReport;
	tvlComparison?: TvlComparisonResult;
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

