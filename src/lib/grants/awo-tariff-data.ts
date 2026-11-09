import type { MonthlyRecord, ParticipantInfo } from '#lib/types/grant';

export interface AwoTariffGroupStep {
	group: string; // 'E1' - 'E15', 'S02' - 'S18'
	step1?: number;
	step2: number;
	step3: number;
	step4: number;
	step5: number;
	step6: number;
}

export interface AwoTariffPeriod {
	id: string; // '2026-01', '2026-09', '2027-07', '2028-07'
	label: string;
	validFromYear: number;
	validFromMonth: number;
	fullTimeHours: number; // 39.0
	scales: Record<string, [number | undefined, number, number, number, number, number]>; // group -> [s1, s2, s3, s4, s5, s6]
}

/**
 * Official AWO Landesverband Berlin e.V. Tariftabellen
 * (Valid ab 2023/07 bzw. 2024, 2025/03, 2025/06, 2025/09 bzw. 2026/01, 2026/09, 2027/07, 2028/07)
 */
export const AWO_TARIFF_PERIODS: AwoTariffPeriod[] = [
	// 1. ab 2023/07 (bzw. 2024, gültig bis 02/2025; Anlage 4 SuE ab 12/2023)
	{
		id: '2023-07',
		label: 'ab 2023/07 (bzw. 2024)',
		validFromYear: 2023,
		validFromMonth: 7,
		fullTimeHours: 39.0,
		scales: {
			'E15': [4891.88, 5259.49, 5453.75, 6143.74, 6666.22, 6866.20],
			'E14': [4429.07, 4763.78, 5038.44, 5453.75, 6090.11, 6272.83],
			'E13': [4083.67, 4395.37, 4629.83, 5085.33, 5714.99, 5886.45],
			'E12': [3680.49, 3939.86, 4489.15, 4971.46, 5594.42, 5762.25],
			'E11': [3561.32, 3800.92, 4073.83, 4489.15, 5092.04, 5244.80],
			'E10': [3435.53, 3670.65, 3939.86, 4214.49, 4737.02, 4879.13],
			'E9':  [3058.18, 3284.85, 3432.53, 3840.59, 4187.71, 4313.36],
			'E8':  [2872.80, 3094.14, 3217.17, 3334.09, 3463.30, 3543.28],
			'E7':  [2703.04, 2919.20, 3081.82, 3204.87, 3303.33, 3389.45],
			'E6':  [2657.52, 2871.47, 2990.80, 3112.60, 3192.57, 3278.70],
			'E5':  [2553.46, 2764.08, 2883.41, 2996.77, 3087.97, 3149.50],
			'E4':  [2438.18, 2650.72, 2799.88, 2883.41, 2966.94, 3020.63],
			'E3':  [2407.07, 2614.91, 2674.58, 2770.03, 2847.60, 2913.23],
			'E2':  [2245.27, 2441.88, 2501.55, 2561.21, 2698.43, 2841.65],
			'E1':  [undefined, 2042.13, 2071.93, 2107.74, 2143.55, 2233.04],

			'S18': [3923.28, 4042.56, 4564.22, 4955.42, 5542.25, 5900.85],
			'S17': [3563.70, 3879.56, 4303.37, 4564.22, 5085.81, 5392.28],
			'S16': [3479.36, 3794.82, 4081.69, 4433.78, 4825.01, 5059.74],
			'S15': [3349.60, 3651.34, 3912.20, 4212.12, 4694.61, 4903.24],
			'S14': [3331.99, 3613.90, 3903.75, 4198.60, 4524.64, 4752.83],
			'S13': [3275.55, 3523.05, 3846.97, 4107.75, 4433.78, 4596.78],
			'S12': [3230.57, 3513.06, 3823.65, 4097.49, 4436.57, 4580.02],
			'S11b': [3146.82, 3463.10, 3628.74, 4046.03, 4372.07, 4567.68],
			'S11a': [3082.16, 3396.45, 3561.03, 3977.38, 4303.37, 4498.99],
			'S09': [2919.62, 3202.31, 3450.24, 3814.25, 4156.54, 4420.62],
			'S08b': [2862.20, 3134.07, 3383.87, 3747.25, 4087.90, 4349.08],
			'S08a': [2821.44, 3065.93, 3281.68, 3486.08, 3684.78, 3892.03],
			'S07': [2753.70, 2984.98, 3187.56, 3390.10, 3542.05, 3768.73],
			'S04': [2607.12, 2852.02, 3029.29, 3149.56, 3263.53, 3441.03],
			'S03': [2438.88, 2683.65, 2853.92, 3010.29, 3081.83, 3167.29],
			'S02': [2345.35, 2547.86, 2606.00, 2699.01, 2774.59, 2838.53]
		}
	},

	// 2. ab 2025/03 (gültig 01.03.2025 bis 31.05.2025: +97,50 € E-Tabelle / +95,00 € S-Tabelle)
	{
		id: '2025-03',
		label: 'ab 2025/03',
		validFromYear: 2025,
		validFromMonth: 3,
		fullTimeHours: 39.0,
		scales: {
			'E15': [4989.38, 5356.99, 5551.25, 6241.24, 6763.72, 6963.70],
			'E14': [4526.57, 4861.28, 5135.94, 5551.25, 6187.61, 6370.33],
			'E13': [4181.17, 4492.87, 4727.33, 5182.83, 5812.49, 5983.95],
			'E12': [3777.99, 4037.36, 4586.65, 5068.96, 5691.92, 5859.75],
			'E11': [3658.82, 3898.42, 4171.33, 4586.65, 5189.54, 5342.30],
			'E10': [3533.03, 3768.15, 4037.36, 4311.99, 4834.52, 4976.63],
			'E9':  [3155.68, 3382.35, 3530.03, 3938.09, 4285.21, 4410.86],
			'E8':  [2970.30, 3191.64, 3314.67, 3431.59, 3560.80, 3640.78],
			'E7':  [2800.54, 3016.70, 3179.32, 3302.37, 3400.83, 3486.95],
			'E6':  [2755.02, 2968.97, 3088.30, 3210.10, 3290.07, 3376.20],
			'E5':  [2650.96, 2861.58, 2980.91, 3094.27, 3185.47, 3247.00],
			'E4':  [2535.68, 2748.22, 2897.38, 2980.91, 3064.44, 3118.13],
			'E3':  [2504.57, 2712.41, 2772.08, 2867.53, 2945.10, 3010.73],
			'E2':  [2342.77, 2539.38, 2599.05, 2658.71, 2795.93, 2939.15],
			'E1':  [undefined, 2139.63, 2169.43, 2205.24, 2241.05, 2330.54],

			'S18': [4018.28, 4137.56, 4659.22, 5050.42, 5637.25, 5995.85],
			'S17': [3658.70, 3974.56, 4398.37, 4659.22, 5180.81, 5487.28],
			'S16': [3574.36, 3889.82, 4176.69, 4528.78, 4920.01, 5154.74],
			'S15': [3444.60, 3746.34, 4007.20, 4307.12, 4789.61, 4998.24],
			'S14': [3426.99, 3708.90, 3998.75, 4293.60, 4619.64, 4847.83],
			'S13': [3370.55, 3618.05, 3941.97, 4202.75, 4528.78, 4691.78],
			'S12': [3325.57, 3608.06, 3918.65, 4192.49, 4531.57, 4675.02],
			'S11b': [3241.82, 3558.10, 3723.74, 4141.03, 4467.07, 4662.68],
			'S11a': [3177.16, 3491.45, 3656.03, 4072.38, 4398.37, 4593.99],
			'S09': [3014.62, 3297.31, 3545.24, 3909.25, 4251.54, 4515.62],
			'S08b': [2957.20, 3229.07, 3478.87, 3842.25, 4182.90, 4444.08],
			'S08a': [2916.44, 3160.93, 3376.68, 3581.08, 3779.78, 3987.03],
			'S07': [2848.70, 3079.98, 3282.56, 3485.10, 3637.05, 3863.73],
			'S04': [2702.12, 2947.02, 3124.29, 3244.56, 3358.53, 3536.03],
			'S03': [2533.88, 2778.65, 2948.92, 3105.29, 3176.83, 3262.29],
			'S02': [2440.35, 2642.86, 2701.00, 2794.01, 2869.59, 2933.53]
		}
	},

	// 3. ab 2025/06 (gültig 01.06.2025 bis 31.08.2025: +97,50 € E-Tabelle / +95,00 € S-Tabelle)
	{
		id: '2025-06',
		label: 'ab 2025/06',
		validFromYear: 2025,
		validFromMonth: 6,
		fullTimeHours: 39.0,
		scales: {
			'E15': [5086.88, 5454.49, 5648.75, 6338.74, 6861.22, 7061.20],
			'E14': [4624.07, 4958.78, 5233.44, 5648.75, 6285.11, 6467.83],
			'E13': [4278.67, 4590.37, 4824.83, 5280.33, 5909.99, 6081.45],
			'E12': [3875.49, 4134.86, 4684.15, 5166.46, 5789.42, 5957.25],
			'E11': [3756.32, 3995.92, 4268.83, 4684.15, 5287.04, 5439.80],
			'E10': [3630.53, 3865.65, 4134.86, 4409.49, 4932.02, 5074.13],
			'E9':  [3253.18, 3479.85, 3627.53, 4035.59, 4382.71, 4508.36],
			'E8':  [3067.80, 3289.14, 3412.17, 3529.09, 3658.30, 3738.28],
			'E7':  [2898.04, 3114.20, 3276.82, 3399.87, 3498.33, 3584.45],
			'E6':  [2852.52, 3066.47, 3185.80, 3307.60, 3387.57, 3473.70],
			'E5':  [2748.46, 2959.08, 3078.41, 3191.77, 3282.97, 3344.50],
			'E4':  [2633.18, 2845.72, 2994.88, 3078.41, 3161.94, 3215.63],
			'E3':  [2602.07, 2809.91, 2869.58, 2965.03, 3042.60, 3108.23],
			'E2':  [2440.27, 2636.88, 2696.55, 2756.21, 2893.43, 3036.65],
			'E1':  [undefined, 2237.13, 2266.93, 2302.74, 2338.55, 2428.04],

			'S18': [4113.28, 4232.56, 4754.22, 5145.42, 5732.25, 6090.85],
			'S17': [3753.70, 4069.56, 4493.37, 4754.22, 5275.81, 5582.28],
			'S16': [3669.36, 3984.82, 4271.69, 4623.78, 5015.01, 5249.74],
			'S15': [3539.60, 3841.34, 4102.20, 4402.12, 4884.61, 5093.24],
			'S14': [3521.99, 3803.90, 4093.75, 4388.60, 4714.64, 4942.83],
			'S13': [3465.55, 3713.05, 4036.97, 4297.75, 4623.78, 4786.78],
			'S12': [3420.57, 3703.06, 4013.65, 4287.49, 4626.57, 4770.02],
			'S11b': [3336.82, 3653.10, 3818.74, 4236.03, 4562.07, 4757.68],
			'S11a': [3272.16, 3586.45, 3751.03, 4167.38, 4493.37, 4688.99],
			'S09': [3109.62, 3392.31, 3640.24, 4004.25, 4346.54, 4610.62],
			'S08b': [3052.20, 3324.07, 3573.87, 3937.25, 4277.90, 4539.08],
			'S08a': [3011.44, 3255.93, 3471.68, 3676.08, 3874.78, 4082.03],
			'S07': [2943.70, 3174.98, 3377.56, 3580.10, 3732.05, 3958.73],
			'S04': [2797.12, 3042.02, 3219.29, 3339.56, 3453.53, 3631.03],
			'S03': [2628.88, 2873.65, 3043.92, 3200.29, 3271.83, 3357.29],
			'S02': [2535.35, 2737.86, 2796.00, 2889.01, 2964.59, 3028.53]
		}
	},

	// 4. ab 2025/09 (bzw. 2026/01)
	{
		id: '2025-09',
		label: 'ab 2025/09 (bzw. 2026/01)',
		validFromYear: 2025,
		validFromMonth: 9,
		fullTimeHours: 39.0,
		scales: {
			'E15': [5366.66, 5754.49, 5959.43, 6687.37, 7238.59, 7449.57],
			'E14': [4878.39, 5231.51, 5521.28, 5959.43, 6630.79, 6823.56],
			'E13': [4514.00, 4842.84, 5090.20, 5570.75, 6235.04, 6415.93],
			'E12': [4088.64, 4362.28, 4941.78, 5450.62, 6107.84, 6284.90],
			'E11': [3962.92, 4215.70, 4503.62, 4941.78, 5577.83, 5738.99],
			'E10': [3830.21, 4078.26, 4362.28, 4652.01, 5203.28, 5353.21],
			'E9':  [3432.10, 3671.24, 3827.04, 4257.55, 4623.76, 4756.32],
			'E8':  [3236.53, 3470.04, 3599.84, 3723.19, 3859.51, 3943.89],
			'E7':  [3057.43, 3285.48, 3457.05, 3586.86, 3690.74, 3781.59],
			'E6':  [3009.41, 3235.13, 3361.02, 3489.52, 3573.89, 3664.75],
			'E5':  [2899.63, 3121.83, 3247.72, 3367.32, 3463.53, 3528.45],
			'E4':  [2778.00, 3002.23, 3159.60, 3247.72, 3335.85, 3392.49],
			'E3':  [2745.18, 2964.46, 3027.41, 3128.11, 3209.94, 3279.18],
			'E2':  [2576.77, 2781.91, 2844.86, 2907.80, 3052.57, 3203.67],
			'E1':  [undefined, 2373.63, 2403.43, 2439.24, 2475.05, 2564.54],

			'S18': [4339.51, 4465.35, 5015.70, 5428.42, 6047.52, 6425.85],
			'S17': [3960.15, 4293.39, 4740.51, 5015.70, 5565.98, 5889.31],
			'S16': [3871.17, 4203.99, 4506.63, 4878.09, 5290.84, 5538.48],
			'S15': [3734.28, 4052.61, 4327.82, 4644.24, 5153.26, 5373.37],
			'S14': [3715.70, 4013.11, 4318.91, 4629.97, 4973.95, 5214.69],
			'S13': [3656.16, 3917.27, 4259.00, 4534.13, 4878.09, 5050.05],
			'S12': [3608.70, 3906.73, 4234.40, 4523.30, 4881.03, 5032.37],
			'S11b': [3520.35, 3854.02, 4028.77, 4469.01, 4812.98, 5019.35],
			'S11a': [3452.13, 3783.70, 3957.34, 4396.59, 4740.51, 4946.88],
			'S09': [3280.65, 3578.89, 3840.45, 4224.48, 4585.60, 4864.20],
			'S08b': [3220.07, 3506.89, 3770.43, 4153.80, 4513.18, 4788.73],
			'S08a': [3177.07, 3435.01, 3662.62, 3878.26, 4087.89, 4306.54],
			'S07': [3105.60, 3349.60, 3563.33, 3777.01, 3937.31, 4176.46],
			'S04': [2950.96, 3209.33, 3396.35, 3523.24, 3643.47, 3830.74],
			'S03': [2773.47, 3031.70, 3211.34, 3376.31, 3451.78, 3541.94],
			'S02': [2674.79, 2888.44, 2949.78, 3047.91, 3127.64, 3195.10]
		}
	},

	// 2. ab 2026/09
	{
		id: '2026-09',
		label: 'ab 2026/09',
		validFromYear: 2026,
		validFromMonth: 9,
		fullTimeHours: 39.0,
		scales: {
			'E15': [5516.93, 5915.62, 6126.29, 6874.62, 7441.27, 7658.16],
			'E14': [5014.98, 5377.99, 5675.88, 6126.29, 6816.45, 7014.62],
			'E13': [4640.39, 4978.44, 5232.73, 5726.73, 6409.62, 6595.58],
			'E12': [4203.12, 4484.42, 5080.15, 5603.24, 6278.86, 6460.88],
			'E11': [4073.88, 4333.74, 4629.72, 5080.15, 5734.01, 5899.68],
			'E10': [3937.46, 4192.45, 4484.42, 4782.27, 5348.97, 5503.10],
			'E9':  [3529.60, 3774.03, 3934.20, 4376.76, 4753.23, 4889.50],
			'E8':  [3334.03, 3567.54, 3700.64, 3827.44, 3967.58, 4054.32],
			'E7':  [3154.93, 3382.98, 3554.55, 3687.29, 3794.08, 3887.47],
			'E6':  [3106.91, 3332.63, 3458.52, 3587.23, 3673.96, 3767.36],
			'E5':  [2997.13, 3219.33, 3345.22, 3464.82, 3561.03, 3627.25],
			'E4':  [2875.50, 3099.73, 3257.10, 3345.22, 3433.35, 3489.99],
			'E3':  [2842.68, 3061.96, 3124.91, 3225.61, 3307.44, 3376.68],
			'E2':  [2674.27, 2879.41, 2942.36, 3005.30, 3150.07, 3301.17],
			'E1':  [undefined, 2471.13, 2500.93, 2536.74, 2572.55, 2662.04],

			'S18': [4461.02, 4590.38, 5156.14, 5580.42, 6216.85, 6605.77],
			'S17': [4071.03, 4413.60, 4873.24, 5156.14, 5721.83, 6054.21],
			'S16': [3979.56, 4321.70, 4632.82, 5014.68, 5438.98, 5693.56],
			'S15': [3838.84, 4166.08, 4449.00, 4774.28, 5297.55, 5523.82],
			'S14': [3819.74, 4125.48, 4439.84, 4759.61, 5113.22, 5360.70],
			'S13': [3758.53, 4026.95, 4378.25, 4661.09, 5014.68, 5191.45],
			'S12': [3709.74, 4016.12, 4352.96, 4649.95, 5017.70, 5173.28],
			'S11b': [3618.92, 3961.93, 4141.58, 4594.14, 4947.74, 5159.89],
			'S11a': [3548.79, 3889.64, 4068.15, 4519.69, 4873.24, 5085.39],
			'S09': [3375.65, 3679.10, 3947.98, 4342.77, 4714.00, 5000.40],
			'S08b': [3315.07, 3605.08, 3876.00, 4270.11, 4639.55, 4922.81],
			'S08a': [3272.07, 3531.19, 3765.17, 3986.85, 4202.35, 4427.12],
			'S07': [3200.60, 3444.60, 3663.10, 3882.77, 4047.55, 4293.40],
			'S04': [3045.96, 3304.33, 3491.45, 3621.89, 3745.49, 3938.00],
			'S03': [2868.47, 3126.70, 3306.34, 3471.31, 3548.43, 3641.11],
			'S02': [2769.79, 2983.44, 3044.78, 3142.91, 3222.64, 3290.10]
		}
	},

	// 3. ab 2027/07
	{
		id: '2027-07',
		label: 'ab 2027/07',
		validFromYear: 2027,
		validFromMonth: 7,
		fullTimeHours: 39.0,
		scales: {
			'E15': [5627.27, 6033.93, 6248.82, 7012.11, 7590.10, 7811.32],
			'E14': [5115.28, 5485.55, 5789.40, 6248.82, 6952.78, 7154.91],
			'E13': [4733.20, 5078.01, 5337.38, 5841.26, 6537.81, 6727.49],
			'E12': [4287.18, 4574.11, 5181.75, 5715.30, 6404.44, 6590.10],
			'E11': [4155.36, 4420.41, 4722.31, 5181.75, 5848.69, 6017.67],
			'E10': [4016.21, 4276.30, 4574.11, 4877.92, 5455.95, 5613.16],
			'E9':  [3600.19, 3849.51, 4012.88, 4464.30, 4848.29, 4987.29],
			'E8':  [3400.71, 3638.89, 3774.65, 3903.99, 4046.93, 4135.41],
			'E7':  [3218.03, 3450.64, 3625.64, 3761.04, 3869.96, 3965.22],
			'E6':  [3169.05, 3399.28, 3527.69, 3658.97, 3747.44, 3842.71],
			'E5':  [3057.07, 3283.72, 3412.12, 3534.12, 3632.25, 3699.80],
			'E4':  [2933.01, 3161.72, 3322.24, 3412.12, 3502.02, 3559.79],
			'E3':  [2899.53, 3123.20, 3187.41, 3290.12, 3373.59, 3444.21],
			'E2':  [2727.76, 2937.00, 3001.21, 3065.41, 3213.07, 3367.19],
			'E1':  [undefined, 2520.55, 2550.95, 2587.47, 2624.00, 2715.28],

			'S18': [4550.24, 4682.19, 5259.26, 5692.03, 6341.19, 6737.89],
			'S17': [4152.45, 4501.87, 4970.70, 5259.26, 5836.27, 6175.29],
			'S16': [4059.15, 4408.13, 4725.48, 5114.97, 5547.76, 5807.43],
			'S15': [3915.62, 4249.40, 4537.98, 4869.77, 5403.50, 5634.30],
			'S14': [3896.13, 4207.99, 4528.64, 4854.80, 5215.48, 5467.91],
			'S13': [3833.70, 4107.49, 4465.82, 4754.31, 5114.97, 5295.28],
			'S12': [3783.93, 4096.44, 4440.02, 4742.95, 5118.05, 5276.75],
			'S11b': [3691.30, 4041.17, 4224.41, 4686.02, 5046.69, 5263.09],
			'S11a': [3619.77, 3967.43, 4149.51, 4610.08, 4970.70, 5187.10],
			'S09': [3443.16, 3752.68, 4026.94, 4429.63, 4808.28, 5100.41],
			'S08b': [3381.37, 3677.18, 3953.52, 4355.51, 4732.34, 5021.27],
			'S08a': [3337.51, 3601.81, 3840.47, 4066.59, 4286.40, 4515.66],
			'S07': [3264.61, 3513.49, 3736.36, 3960.43, 4128.50, 4379.27],
			'S04': [3106.88, 3370.42, 3561.28, 3694.33, 3820.40, 4016.76],
			'S03': [2925.84, 3189.23, 3372.47, 3540.74, 3619.40, 3713.93],
			'S02': [2825.19, 3043.11, 3105.68, 3205.77, 3287.09, 3355.90]
		}
	},

	// 4. ab 2028/07
	{
		id: '2028-07',
		label: 'ab 2028/07',
		validFromYear: 2028,
		validFromMonth: 7,
		fullTimeHours: 39.0,
		scales: {
			'E15': [5683.54, 6094.27, 6311.31, 7082.23, 7666.00, 7889.43],
			'E14': [5166.43, 5540.41, 5847.29, 6311.31, 7022.31, 7226.46],
			'E13': [4780.53, 5128.79, 5390.75, 5899.67, 6603.19, 6794.76],
			'E12': [4330.05, 4619.85, 5233.57, 5772.45, 6468.48, 6656.00],
			'E11': [4196.91, 4464.61, 4769.53, 5233.57, 5907.18, 6077.85],
			'E10': [4056.37, 4319.06, 4619.85, 4926.70, 5510.51, 5669.29],
			'E9':  [3636.19, 3888.01, 4053.01, 4508.94, 4896.77, 5037.16],
			'E8':  [3434.72, 3675.28, 3812.40, 3943.03, 4087.40, 4176.76],
			'E7':  [3250.21, 3485.15, 3661.90, 3798.65, 3908.66, 4004.87],
			'E6':  [3200.74, 3433.27, 3562.97, 3695.56, 3784.91, 3881.14],
			'E5':  [3087.64, 3316.56, 3446.24, 3569.46, 3668.57, 3736.80],
			'E4':  [2962.34, 3193.34, 3355.46, 3446.24, 3537.04, 3595.39],
			'E3':  [2928.53, 3154.43, 3219.28, 3323.02, 3407.33, 3478.65],
			'E2':  [2755.04, 2966.37, 3031.22, 3096.06, 3245.20, 3400.86],
			'E1':  [undefined, 2545.76, 2576.46, 2613.34, 2650.24, 2742.43],

			'S18': [4595.74, 4729.01, 5311.85, 5748.95, 6404.60, 6805.27],
			'S17': [4193.97, 4546.89, 5020.41, 5311.85, 5894.63, 6237.04],
			'S16': [4099.74, 4452.21, 4772.73, 5166.12, 5603.24, 5865.50],
			'S15': [3954.78, 4291.89, 4583.36, 4918.47, 5457.54, 5690.64],
			'S14': [3935.09, 4250.07, 4573.93, 4903.35, 5267.63, 5522.59],
			'S13': [3872.04, 4148.56, 4510.48, 4801.85, 5166.12, 5348.23],
			'S12': [3821.77, 4137.40, 4484.42, 4790.38, 5169.23, 5329.52],
			'S11b': [3728.21, 4081.58, 4266.65, 4732.88, 5097.16, 5315.72],
			'S11a': [3655.97, 4007.10, 4191.01, 4656.18, 5020.41, 5238.97],
			'S09': [3477.59, 3790.21, 4067.21, 4473.93, 4856.36, 5151.41],
			'S08b': [3415.18, 3713.95, 3993.06, 4399.07, 4779.66, 5071.48],
			'S08a': [3370.89, 3637.83, 3878.87, 4107.26, 4329.26, 4560.82],
			'S07': [3297.26, 3548.62, 3773.72, 4000.03, 4169.79, 4423.06],
			'S04': [3137.95, 3404.12, 3596.89, 3731.27, 3858.60, 4056.93],
			'S03': [2955.10, 3221.12, 3406.19, 3576.15, 3655.59, 3751.07],
			'S02': [2853.44, 3073.54, 3136.74, 3237.83, 3319.96, 3389.46]
		}
	}
];

function round2(v: number): number {
	return Math.round((v + Number.EPSILON) * 100) / 100;
}

function parseDateDMY(dStr?: string): { day: number; month: number; year: number } | null {
	if (!dStr) return null;
	const parts = dStr.split(/[.\-/]/).map((p) => parseInt(p.trim(), 10));
	if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
		if (parts[2] > 1000) return { day: parts[0], month: parts[1], year: parts[2] };
		if (parts[0] > 1000) return { day: parts[2], month: parts[1], year: parts[0] };
	}
	return null;
}

/**
 * Normalizes tariff group key (e.g. "EG 2" -> "E2", "S 8b" -> "S08b", "S8b" -> "S08b", "S9" -> "S09").
 */
export function normalizeAwoGroupKey(rawGroup: string): string {
	const clean = rawGroup.toUpperCase().replace(/\s+/g, '').replace(/^EG/, 'E');
	// Handle SuE single digit padding like S8b -> S08b, S9 -> S09
	const sMatch = clean.match(/^S(\d)([A-Z]?)$/);
	if (sMatch) {
		return `S0${sMatch[1]}${sMatch[2] || ''}`;
	}
	return clean;
}

/**
 * Finds the applicable AWO tariff period for a specific year and month.
 * Note: Returns null for dates prior to July 2023 (2023-07), since earlier comparison data is not provided.
 */
export function getApplicableAwoPeriod(year: number, month: number): AwoTariffPeriod | null {
	const dateVal = year * 100 + month;
	if (dateVal < 202307) {
		return null; // No tariff data available prior to 07/2023
	}
	for (let i = AWO_TARIFF_PERIODS.length - 1; i >= 0; i--) {
		const p = AWO_TARIFF_PERIODS[i];
		const pVal = p.validFromYear * 100 + p.validFromMonth;
		if (dateVal >= pVal) {
			return p;
		}
	}
	return null;
}

/**
 * Checks if a given year and month represents an official tariff increase (Tariferhöhung)
 * in the AWO collective agreement data (covering periods ab 07/2023, 03/2025, 06/2025, 09/2025, 09/2026, 07/2027, 07/2028).
 */
export function isAwoTariffIncreaseMonth(year: number, month: number): boolean {
	return AWO_TARIFF_PERIODS.some((p) => p.validFromYear === year && p.validFromMonth === month);
}

/**
 * Calculates the experience level (Stufe 1..6) at a specific date based on contract entry date
 * and initial starting experience level (default ES1).
 * In TV-L / TVöD / AWO collective bargaining agreements:
 * - Stay in Stufe 1: 1 year (12 months) -> advances to Stufe 2
 * - Stay in Stufe 2: 2 years (24 months) -> advances to Stufe 3
 * - Stay in Stufe 3: 3 years (36 months) -> advances to Stufe 4
 * - Stay in Stufe 4: 4 years (48 months) -> advances to Stufe 5
 * - Stay in Stufe 5: 5 years (60 months) -> advances to Stufe 6
 * (The number of the current Erfahrungsstufe determines the number of years until advancing to the next one).
 */
export function calculateTariffStepAtDate(
	targetDate: { day: number; month: number; year: number },
	startDate: { day: number; month: number; year: number },
	initialStep: number = 1
): number {
	const diffMonths =
		(targetDate.year - startDate.year) * 12 +
		(targetDate.month - startDate.month) +
		(targetDate.day >= startDate.day ? 0 : -1);

	if (diffMonths < 0) {
		return Math.max(1, Math.min(6, initialStep));
	}

	let currentStep = Math.max(1, Math.min(6, initialStep));
	let remainingMonths = diffMonths;

	while (currentStep < 6) {
		const requiredMonthsInStep = currentStep * 12;
		if (remainingMonths >= requiredMonthsInStep) {
			remainingMonths -= requiredMonthsInStep;
			currentStep += 1;
		} else {
			break;
		}
	}

	return currentStep;
}

/**
 * Calculates the participant's experience step for a specific monthly record,
 * accounting for official AWO tariff scales (sept 2025 - july 2028) and anniversary milestones.
 */
export function determineParticipantStepForRecord(
	participant: ParticipantInfo,
	rec: MonthlyRecord
): number {
	const initialStepNum = parseInt((participant.tariffStep?.match(/\d+/) || ['1'])[0], 10) || 1;

	// 1. Check if rec.fteSalary matches a step in AWO tariff scale for this period
	const period = getApplicableAwoPeriod(rec.year, rec.month);
	if (period) {
		const groupKey = normalizeAwoGroupKey(participant.tariffGroup || 'EG1');
		const groupScales = period.scales[groupKey] || Object.entries(period.scales).find(([k]) => k.toLowerCase() === groupKey.toLowerCase())?.[1];
		if (groupScales && rec.fteSalary && rec.fteSalary > 0) {
			// Exact match (tolerance 0.05 €)
			for (let s = 1; s <= 6; s++) {
				const val = groupScales[s - 1];
				if (val !== undefined && Math.abs(rec.fteSalary - val) <= 0.05) {
					return s;
				}
			}
		}
	}

	// 2. Fall back to career anniversary progression based on runtimeStart
	let startParsed = parseDateDMY(participant.runtimeStart);
	if (participant.continueTariffProgression) {
		if (participant.previousTariffStepStartDate) {
			const pDate = participant.previousTariffStepStartDate;
			const prevParsed = parseDateDMY(pDate) || (pDate.includes('-') ? {
				year: parseInt(pDate.split('-')[0], 10),
				month: parseInt(pDate.split('-')[1], 10),
				day: parseInt(pDate.split('-')[2], 10)
			} : null);
			if (prevParsed) startParsed = prevParsed;
		} else if (participant.priorExperienceMonths && startParsed) {
			const totalMonths = (startParsed.year * 12 + startParsed.month - 1) - participant.priorExperienceMonths;
			startParsed = {
				year: Math.floor(totalMonths / 12),
				month: (totalMonths % 12) + 1,
				day: startParsed.day
			};
		}
	}
	if (!startParsed) return initialStepNum;

	const recordDay = rec.startDate ? (parseDateDMY(rec.startDate)?.day || 1) : 1;
	return calculateTariffStepAtDate({ day: recordDay, month: rec.month, year: rec.year }, startParsed, initialStepNum);
}

/**
 * Looks up the official AWO full-time (39h) and part-time salary for a given group, step, year, month, and weekly hours.
 */
export function getAwoTariffSalary(
	group: string,
	step: number,
	year: number,
	month: number,
	weeklyHours = 30,
	fullTimeHours = 39.0
): { fteSalary: number; partTimeSalary: number; periodLabel: string } | null {
	const period = getApplicableAwoPeriod(year, month);
	if (!period) return null;

	const groupKey = normalizeAwoGroupKey(group);
	let groupScales = period.scales[groupKey];
	if (!groupScales) {
		const foundKey = Object.keys(period.scales).find(k => k.toLowerCase() === groupKey.toLowerCase());
		if (foundKey) {
			groupScales = period.scales[foundKey];
		}
	}
	if (!groupScales) return null;

	const stepIdx = Math.max(1, Math.min(6, step)) - 1;
	const fteSalary = groupScales[stepIdx];
	if (fteSalary === undefined) return null;

	const partTimeSalary = round2((fteSalary / (fullTimeHours || period.fullTimeHours)) * weeklyHours);
	return {
		fteSalary,
		partTimeSalary,
		periodLabel: period.label
	};
}
import type { JszAuditItem } from '#lib/types/grant';

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
	jszAudits?: JszAuditItem[];
	summaryText: string;
}

/**
 * Calculates the expected AWO Berlin Jahressonderzahlung for a calendar year according to TV AWO Berlin rules:
 * - Entitlement (Stichtag 01.12.): Employee must be employed on 01.12. (in December). If not, JSZ is 0.
 * - Assessment base: September monthly gross salary (or first full active month if started after September).
 * - Assessment rate: 85%.
 * - Proration: (Active employment months in the year / 12).
 * - AGA: JSZ * applicable AGA rate.
 */
export function calculateExpectedAwoJsz(
	year: number,
	recordsInYear: MonthlyRecord[],
	participant: ParticipantInfo
): JszAuditItem {
	// 1. Check entitlement: employment on 01.12.
	const decRecord = recordsInYear.find(r => r.month === 12);
	const endParsed = parseDateDMY(participant.runtimeEnd);
	let isEmployedOnDec1st = false;
	if (decRecord && (decRecord.monthUnits ?? 1.0) > 0) {
		isEmployedOnDec1st = true;
	} else if (endParsed) {
		isEmployedOnDec1st = endParsed.year > year || (endParsed.year === year && (endParsed.month > 12 || (endParsed.month === 12 && endParsed.day >= 1)));
	}

	// 2. Count active months in this year
	const activeMonthsInYear = round2(
		recordsInYear.reduce((sum, r) => sum + (r.monthUnits !== undefined && r.monthUnits > 0 ? r.monthUnits : 1.0), 0)
	);
	const cappedMonths = Math.min(12, activeMonthsInYear);

	// 3. Determine September salary (or first active month if started after September)
	const sepRecord = recordsInYear.find(r => r.month === 9);
	let septemberSalary = 0;
	if (sepRecord && sepRecord.partTimeSalary > 0) {
		septemberSalary = round2(sepRecord.partTimeSalary / (sepRecord.monthUnits || 1.0));
	} else {
		// Fallback to first active record or tariff table
		const firstActive = recordsInYear.find(r => (r.monthUnits ?? 1.0) > 0);
		if (firstActive && firstActive.partTimeSalary > 0) {
			septemberSalary = round2(firstActive.partTimeSalary / (firstActive.monthUnits || 1.0));
		} else {
			const initialStep = parseInt((participant.tariffStep?.match(/\d+/) || ['1'])[0], 10) || 1;
			const tariffInfo = getAwoTariffSalary(
				participant.tariffGroup,
				initialStep,
				year,
				9,
				participant.weeklyHours,
				participant.fullTimeHours || 39.0
			);
			septemberSalary = tariffInfo ? tariffInfo.partTimeSalary : 0;
		}
	}

	// 4. Expected JSZ amount
	const expectedJszAmount = isEmployedOnDec1st && cappedMonths > 0
		? round2(septemberSalary * 0.85 * (cappedMonths / 12))
		: 0;

	// 5. Expected AGA rate
	const agaRate = decRecord?.agaRealRate || sepRecord?.agaRealRate || recordsInYear[0]?.agaRealRate || participant.defaultAgaRate || 0.23815;
	const expectedJszAga = round2(expectedJszAmount * agaRate);

	// 6. Recorded values in Berechnungsblatt
	const jszRecord = recordsInYear.find(r => r.jszAmount > 0 || r.isJszMonth);
	const recordedJszAmount = jszRecord ? jszRecord.jszAmount : 0;
	const recordedJszAga = jszRecord ? jszRecord.jszAgaAmount : 0;

	const diffJszAmount = round2(recordedJszAmount - expectedJszAmount);
	const diffJszAga = round2(recordedJszAga - expectedJszAga);

	const isCompliant = Math.abs(diffJszAmount) <= 0.05 && (expectedJszAmount === 0 || Math.abs(diffJszAga) <= 0.05);

	let explanation = '';
	if (!isEmployedOnDec1st) {
		explanation = `Kein JSZ-Anspruch für ${year}, da am 01.12. nicht beschäftigt.`;
	} else if (cappedMonths < 12) {
		const countStr = cappedMonths % 1 === 0 ? String(cappedMonths) : cappedMonths.toFixed(1).replace('.', ',');
		explanation = `JSZ ${year}: anteilig für ${countStr} Monate (${countStr}/12), 85% von ${septemberSalary.toFixed(2)} € (Septembergehalt), Stichtag 01.12.`;
	} else {
		explanation = `JSZ ${year}: 85% von ${septemberSalary.toFixed(2)} € (Septembergehalt), Stichtag 01.12.`;
	}

	return {
		year,
		isEmployedOnDec1st,
		activeMonthsInYear: cappedMonths,
		septemberSalary,
		expectedJszAmount,
		recordedJszAmount,
		diffJszAmount,
		expectedJszAga,
		recordedJszAga,
		diffJszAga,
		isCompliant,
		explanation
	};
}

/**
 * Audits the uploaded Berechnungsblatt against official AWO Berlin Tariftabellen (ab 09/2025)
 * and verifies Jahressonderzahlung calculations according to AWO Berlin tariff rules.
 */
export function validateBerechnungsblattTariff(
	records: MonthlyRecord[],
	participant: ParticipantInfo
): TariffValidationReport {
	const discrepancies: TariffDiscrepancy[] = [];
	let checkedCount = 0;
	let skippedPriorTo2025Count = 0;

	// 1. Audit Column F (Full-Time Salary) for every monthly record
	for (const rec of records) {
		// Only check records within available tariff data period (>= 07/2023)
		if (rec.year * 100 + rec.month < 202307) {
			skippedPriorTo2025Count++;
			continue;
		}

		const stepNum = determineParticipantStepForRecord(participant, rec);
		const awoTariff = getAwoTariffSalary(
			participant.tariffGroup,
			stepNum,
			rec.year,
			rec.month,
			rec.weeklyHours || participant.weeklyHours,
			rec.fullTimeHours || participant.fullTimeHours || 39.0
		);

		if (!awoTariff) continue;
		checkedCount++;

		// Direct 1:1 comparison with Column F (fteSalary) of Berechnungsblatt
		const diffFte = round2(rec.fteSalary - awoTariff.fteSalary);
		const expectedPt = round2(awoTariff.partTimeSalary * (rec.monthUnits || 1.0));
		const diffPt = round2(rec.partTimeSalary - expectedPt);

		// Toleranz 0.05 € for minor rounding variations in manual spreadsheets
		const isDiscrepancy = Math.abs(diffFte) > 0.05;

		if (isDiscrepancy) {
			discrepancies.push({
				recordDate: rec.date,
				year: rec.year,
				month: rec.month,
				group: participant.tariffGroup,
				step: stepNum,
				recordedFteSalary: rec.fteSalary,
				expectedFteSalary: awoTariff.fteSalary,
				recordedPartTimeSalary: rec.partTimeSalary,
				expectedPartTimeSalary: expectedPt,
				diffFteSalary: diffFte,
				diffPartTime: diffPt,
				isDiscrepancy: true,
				explanation: `Monat ${rec.month}/${rec.year} (Stufe ${stepNum}): Spalte F = ${rec.fteSalary.toFixed(2)} € vs. AWO-Tarif = ${awoTariff.fteSalary.toFixed(2)} € (Diff: ${diffFte > 0 ? '+' : ''}${diffFte.toFixed(2)} €)`
			});
		}
	}

	// 2. Audit Jahressonderzahlung for each calendar year that includes December or has JSZ rows
	const uniqueYears = Array.from(new Set(records.map(r => r.year))).sort((a, b) => a - b);
	const jszAudits: JszAuditItem[] = [];

	for (const y of uniqueYears) {
		const yearRecs = records.filter(r => r.year === y);
		if (yearRecs.length === 0) continue;

		const hasDec = yearRecs.some(r => r.month === 12);
		const hasJszRow = yearRecs.some(r => r.jszAmount > 0 || r.isJszMonth);
		// Only audit JSZ if December is in the dataset or a JSZ row was present
		if (!hasDec && !hasJszRow) continue;

		const audit = calculateExpectedAwoJsz(y, yearRecs, participant);
		jszAudits.push(audit);

		if (!audit.isCompliant) {
			discrepancies.push({
				recordDate: `31.12.${y}`,
				year: y,
				month: 12,
				group: participant.tariffGroup,
				step: participant.tariffStep || 'ES1',
				recordedFteSalary: audit.recordedJszAmount,
				expectedFteSalary: audit.expectedJszAmount,
				recordedPartTimeSalary: audit.recordedJszAmount,
				expectedPartTimeSalary: audit.expectedJszAmount,
				diffFteSalary: audit.diffJszAmount,
				diffPartTime: audit.diffJszAmount,
				isDiscrepancy: true,
				explanation: !audit.isEmployedOnDec1st && audit.recordedJszAmount > 0
					? `Jahressonderzahlung ${y}: Anspruch entfällt, da am 01.12. nicht beschäftigt (Berechnet: ${audit.recordedJszAmount.toFixed(2)} € vs. Soll: 0,00 €)`
					: `Jahressonderzahlung ${y}: Berechnet = ${audit.recordedJszAmount.toFixed(2)} € vs. AWO-Tarif (85% Septembergehalt) = ${audit.expectedJszAmount.toFixed(2)} € (Diff: ${audit.diffJszAmount > 0 ? '+' : ''}${audit.diffJszAmount.toFixed(2)} €)`
			});
		}
	}

	const isCompliant = discrepancies.length === 0;
	const jszErrors = jszAudits.filter(a => !a.isCompliant).length;
	const fteErrors = discrepancies.length - jszErrors;

	let summaryText = '';
	if (isCompliant) {
		summaryText = `Alle ${checkedCount} geprüften Monate (ab 07/2023) und ${jszAudits.length} Jahressonderzahlungen stimmen exakt mit der AWO-Tariftabelle überein.`;
	} else {
		const parts: string[] = [];
		if (fteErrors > 0) parts.push(`${fteErrors} Abweichung(en) in Spalte F (VZ-Brutto)`);
		if (jszErrors > 0) parts.push(`${jszErrors} Abweichung(en) bei der Jahressonderzahlung`);
		summaryText = `${discrepancies.length} Tarifabweichung(en) gefunden: ${parts.join(', ')}.`;
	}

	return {
		isCompliant,
		checkedCount,
		skippedPriorTo2025Count,
		discrepancyCount: discrepancies.length,
		discrepancies,
		jszAudits,
		summaryText
	};
}
