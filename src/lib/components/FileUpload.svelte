<script lang="ts">
	import { processExcelFile } from '#lib/grant.remote';
	import type { GrantTransformationResult, RuntimeScope } from '#lib/types/grant';

	let {
		onResult,
		selectedScheme = 'sgb16i-berlin',
		includeOffset = true,
		runtimeScope = 'exit_date',
		restrictToExitDate = true,
		restrictYear = undefined
	}: {
		onResult: (res: GrantTransformationResult) => void;
		selectedScheme?: string;
		includeOffset?: boolean;
		runtimeScope?: RuntimeScope;
		restrictToExitDate?: boolean;
		restrictYear?: number | undefined;
	} = $props();

	let isDragging = $state(false);
	let isProcessing = $state(false);
	let errorMessage = $state<string | null>(null);
	let successFileName = $state<string | null>(null);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			const file = e.dataTransfer.files[0];
			if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
				readFileAndProcess(file);
			} else {
				errorMessage = 'Bitte nur Excel-Dateien (.xlsx) hochladen.';
			}
		}
	}

	function handleFileInputChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			readFileAndProcess(target.files[0]);
		}
	}

	async function readFileAndProcess(file: File) {
		try {
			isProcessing = true;
			errorMessage = null;
			successFileName = null;

			// Read file as base64 and invoke Remote Command
			const reader = new FileReader();
			reader.onload = async (evt) => {
				try {
					const resultStr = evt.target?.result as string;
					const base64 = resultStr.split(',')[1] || resultStr;

					const res = await processExcelFile({
						fileBase64: base64,
						fileName: file.name,
						schemeId: selectedScheme,
						includeOffsetRows: includeOffset,
						runtimeScope,
						restrictToExitDate,
						restrictToYear: restrictYear
					});

					successFileName = file.name;
					onResult(res);
				} catch (err: any) {
					errorMessage = err?.message || 'Fehler beim Verarbeiten der Excel-Kalkulation.';
				} finally {
					isProcessing = false;
				}
			};

			reader.onerror = () => {
				errorMessage = 'Fehler beim Einlesen der Datei im Browser.';
				isProcessing = false;
			};

			reader.readAsDataURL(file);
		} catch (err: any) {
			errorMessage = err?.message || 'Unerwarteter Fehler beim Dateiupload.';
			isProcessing = false;
		}
	}
</script>

<div class="upload-container">
	<div
		class="dropzone {isDragging ? 'dragging' : ''} {isProcessing ? 'loading' : ''}"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		role="region"
		aria-label="Excel Datei Upload"
	>
		<input
			type="file"
			id="excelFileInput"
			accept=".xlsx, .xls"
			onchange={handleFileInputChange}
			class="file-input"
			disabled={isProcessing}
		/>

		<div class="dropzone-content">
			<div class="icon-bubble">
				{#if isProcessing}
					<svg class="spinner" viewBox="0 0 50 50">
						<circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
					</svg>
				{:else if successFileName}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
						<polyline points="20 6 9 17 4 12"></polyline>
					</svg>
				{:else}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
						<polyline points="14 2 14 8 20 8"></polyline>
						<line x1="12" y1="18" x2="12" y2="12"></line>
						<line x1="9" y1="15" x2="15" y2="15"></line>
					</svg>
				{/if}
			</div>

			<div class="drop-text">
				<h3>
					{#if isProcessing}
						Verarbeite Excel-Kalkulation...
					{:else if successFileName}
						<span class="text-success">Erfolgreich geladen: {successFileName}</span>
					{:else}
						Excel-Berechnungsblatt hier ablegen
					{/if}
				</h3>
				<p>Unterstützt <code>.xlsx</code> Gehalts- und Personalkostenberechnungen</p>
			</div>

			<div class="actions-row">
				<label for="excelFileInput" class="btn btn-primary">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
						<polyline points="17 8 12 3 7 8"></polyline>
						<line x1="12" y1="3" x2="12" y2="15"></line>
					</svg>
					Datei auswählen
				</label>
			</div>
		</div>
	</div>

	{#if errorMessage}
		<div class="error-alert">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10"></circle>
				<line x1="12" y1="8" x2="12" y2="12"></line>
				<line x1="12" y1="16" x2="12.01" y2="16"></line>
			</svg>
			<span>{errorMessage}</span>
		</div>
	{/if}
</div>

<style>
	.upload-container {
		width: 100%;
		margin: 1.5rem 0;
	}

	.dropzone {
		border: 2px dashed rgba(99, 102, 241, 0.35);
		border-radius: 16px;
		background: rgba(30, 41, 59, 0.4);
		backdrop-filter: blur(12px);
		padding: 2.5rem 1.5rem;
		text-align: center;
		position: relative;
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.3);
		display: block;
	}

	.dropzone:hover,
	.dropzone.dragging {
		border-color: #6366f1;
		background: rgba(99, 102, 241, 0.08);
		transform: translateY(-2px);
		box-shadow: 0 8px 30px -4px rgba(99, 102, 241, 0.2);
	}

	.dropzone.loading {
		pointer-events: none;
		opacity: 0.85;
	}

	.file-input {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
	}

	.dropzone-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
	}

	.icon-bubble {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
		border: 1px solid rgba(99, 102, 241, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #a5b4fc;
	}

	.drop-text h3 {
		font-size: 1.25rem;
		font-weight: 600;
		color: #f8fafc;
		margin: 0 0 0.25rem 0;
	}

	.text-success {
		color: #34d399;
	}

	.drop-text p {
		color: #94a3b8;
		font-size: 0.9rem;
		margin: 0;
	}

	.drop-text code {
		background: rgba(255, 255, 255, 0.1);
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		color: #38bdf8;
		font-family: monospace;
	}

	.actions-row {
		display: flex;
		gap: 1rem;
		margin-top: 0.5rem;
		position: relative;
		z-index: 2;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 1.25rem;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
		text-decoration: none;
	}

	.btn-primary {
		background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
		color: #ffffff;
		box-shadow: 0 2px 10px rgba(79, 70, 229, 0.3);
	}

	.btn-primary:hover {
		background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
		box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-alert {
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.4);
		border-radius: 8px;
		color: #fca5a5;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.9rem;
	}

	.spinner {
		animation: rotate 2s linear infinite;
		width: 32px;
		height: 32px;
	}

	.spinner .path {
		stroke: #a5b4fc;
		stroke-linecap: round;
		animation: dash 1.5s ease-in-out infinite;
	}

	@keyframes rotate {
		100% {
			transform: rotate(360deg);
		}
	}

	@keyframes dash {
		0% {
			stroke-dasharray: 1, 150;
			stroke-dashoffset: 0;
		}
		50% {
			stroke-dasharray: 90, 150;
			stroke-dashoffset: -35;
		}
		100% {
			stroke-dasharray: 90, 150;
			stroke-dashoffset: -124;
		}
	}
</style>
