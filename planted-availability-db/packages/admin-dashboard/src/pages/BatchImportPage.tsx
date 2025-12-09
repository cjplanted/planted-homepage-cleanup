import { useState, useRef, ChangeEvent } from 'react';
import type { VenueType } from '@pad/core';

interface CSVRow {
  name: string;
  type: VenueType;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  chain_id: string;
  latitude: string;
  longitude: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

const TEMPLATE_HEADERS = [
  'name',
  'type',
  'street',
  'city',
  'postal_code',
  'country',
  'chain_id',
  'latitude',
  'longitude',
];

const VALID_VENUE_TYPES: VenueType[] = ['restaurant', 'retail', 'delivery_kitchen'];

function BatchImportPage() {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<CSVRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const headers = TEMPLATE_HEADERS.join(',');
    const example = [
      'Hans im Glück - Zurich',
      'restaurant',
      'Bahnhofstrasse 1',
      'Zurich',
      '8001',
      'CH',
      'hans-im-glueck',
      '47.3769',
      '8.5417',
    ].join(',');

    const csv = `${headers}\n${example}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'venue-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseCSV = (content: string): CSVRow[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim());
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const row: any = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      rows.push(row as CSVRow);
    }

    return rows;
  };

  const validateData = (data: CSVRow[]): ValidationError[] => {
    const errors: ValidationError[] = [];

    data.forEach((row, index) => {
      const rowNum = index + 2; // +2 because of 0-index and header row

      if (!row.name || row.name.trim() === '') {
        errors.push({ row: rowNum, field: 'name', message: 'Name is required' });
      }

      if (!row.type || !VALID_VENUE_TYPES.includes(row.type)) {
        errors.push({
          row: rowNum,
          field: 'type',
          message: `Type must be one of: ${VALID_VENUE_TYPES.join(', ')}`,
        });
      }

      if (!row.street || row.street.trim() === '') {
        errors.push({ row: rowNum, field: 'street', message: 'Street is required' });
      }

      if (!row.city || row.city.trim() === '') {
        errors.push({ row: rowNum, field: 'city', message: 'City is required' });
      }

      if (!row.postal_code || row.postal_code.trim() === '') {
        errors.push({ row: rowNum, field: 'postal_code', message: 'Postal code is required' });
      }

      if (!row.country || row.country.trim() === '') {
        errors.push({ row: rowNum, field: 'country', message: 'Country is required' });
      }

      const lat = parseFloat(row.latitude);
      if (!row.latitude || isNaN(lat) || lat < -90 || lat > 90) {
        errors.push({
          row: rowNum,
          field: 'latitude',
          message: 'Invalid latitude (must be between -90 and 90)',
        });
      }

      const lng = parseFloat(row.longitude);
      if (!row.longitude || isNaN(lng) || lng < -180 || lng > 180) {
        errors.push({
          row: rowNum,
          field: 'longitude',
          message: 'Invalid longitude (must be between -180 and 180)',
        });
      }
    });

    return errors;
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'text/csv') {
      processFile(droppedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      const data = parseCSV(content);
      const errors = validateData(data);

      setParsedData(data);
      setValidationErrors(errors);
      setStep('preview');
    };

    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (validationErrors.length > 0) return;

    setStep('importing');
    setImportProgress(0);

    // Mock import with progress simulation
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < parsedData.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200)); // Simulate API call

      // Randomly simulate some failures for demo (10% failure rate)
      if (Math.random() < 0.1) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          error: 'Mock error: Duplicate venue or validation failed',
        });
      } else {
        result.success++;
      }

      setImportProgress(((i + 1) / parsedData.length) * 100);
    }

    setImportResult(result);
    setStep('complete');
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setParsedData([]);
    setValidationErrors([]);
    setImportProgress(0);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const typeLabels: Record<VenueType, string> = {
    restaurant: 'Foodservice',
    retail: 'Retail',
    delivery_kitchen: 'Delivery Kitchen',
  };

  return (
    <>
      <header className="page-header">
        <h2>Batch Import</h2>
      </header>

      <div className="page-content">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Import Venues from CSV</h3>
              <p style={{ color: 'var(--text-light)', marginBottom: '1rem' }}>
                Upload a CSV file to bulk import venues. Download the template to see the required format.
              </p>
              <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
                Download CSV Template
              </button>
            </div>

            <div className="card">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                style={{
                  border: `2px dashed ${isDragOver ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: '0.5rem',
                  padding: '3rem',
                  textAlign: 'center',
                  backgroundColor: isDragOver ? '#f0f8f0' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📤</div>
                <h3 style={{ marginBottom: '0.5rem' }}>Drop CSV file here</h3>
                <p style={{ color: 'var(--text-light)', marginBottom: '1rem' }}>
                  or click to browse
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select CSV File
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ marginBottom: '0.5rem' }}>Preview Import</h3>
                  <p style={{ color: 'var(--text-light)', margin: 0 }}>
                    {file?.name} - {parsedData.length} rows
                  </p>
                </div>
                <button className="btn btn-secondary" onClick={handleReset}>
                  Upload Different File
                </button>
              </div>
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div
                className="alert alert-error"
                style={{ marginBottom: '1.5rem', maxHeight: '200px', overflow: 'auto' }}
              >
                <h4 style={{ marginBottom: '0.75rem' }}>
                  Validation Errors ({validationErrors.length})
                </h4>
                <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
                  {validationErrors.map((error, idx) => (
                    <li key={idx}>
                      Row {error.row}, {error.field}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview Table */}
            <div className="card" style={{ padding: 0, overflow: 'auto', maxHeight: '500px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--secondary)' }}>
                      Row
                    </th>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--secondary)' }}>
                      Name
                    </th>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--secondary)' }}>
                      Type
                    </th>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--secondary)' }}>
                      Address
                    </th>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--secondary)' }}>
                      Location
                    </th>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--secondary)' }}>
                      Chain ID
                    </th>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--secondary)' }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((row, idx) => {
                    const rowNum = idx + 2;
                    const hasError = validationErrors.some((e) => e.row === rowNum);
                    return (
                      <tr
                        key={idx}
                        style={{
                          backgroundColor: hasError ? '#fff5f5' : undefined,
                        }}
                      >
                        <td>{rowNum}</td>
                        <td>{row.name}</td>
                        <td>
                          <span className={`badge badge-${row.type}`}>
                            {typeLabels[row.type] || row.type}
                          </span>
                        </td>
                        <td>
                          <div>{row.street}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                            {row.postal_code} {row.city}, {row.country}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {row.latitude}, {row.longitude}
                        </td>
                        <td>{row.chain_id || '-'}</td>
                        <td>
                          {hasError ? (
                            <span className="badge badge-error">Error</span>
                          ) : (
                            <span className="badge badge-success">Valid</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div
              style={{
                marginTop: '1.5rem',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
              }}
            >
              <button className="btn btn-secondary" onClick={handleReset}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={validationErrors.length > 0 || parsedData.length === 0}
              >
                Import {parsedData.length} Venues
              </button>
            </div>
          </>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 1.5rem' }} />
            <h3 style={{ marginBottom: '1rem' }}>Importing Venues...</h3>
            <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
              Please wait while we process your import.
            </p>

            {/* Progress Bar */}
            <div
              style={{
                width: '100%',
                maxWidth: '500px',
                margin: '0 auto',
                backgroundColor: 'var(--secondary)',
                borderRadius: '9999px',
                height: '24px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: '100%',
                  backgroundColor: 'var(--primary)',
                  width: `${importProgress}%`,
                  transition: 'width 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {Math.round(importProgress)}%
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && importResult && (
          <>
            <div
              className={`alert ${
                importResult.failed > 0 ? 'alert-error' : 'alert-success'
              }`}
              style={{ marginBottom: '1.5rem' }}
            >
              <h3 style={{ marginBottom: '0.5rem' }}>Import Complete</h3>
              <p style={{ margin: 0 }}>
                Successfully imported {importResult.success} of {parsedData.length} venues
                {importResult.failed > 0 && ` (${importResult.failed} failed)`}
              </p>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="card stat-card">
                <span className="stat-label">Successful</span>
                <span className="stat-value" style={{ color: 'var(--success)' }}>
                  {importResult.success}
                </span>
              </div>
              <div className="card stat-card">
                <span className="stat-label">Failed</span>
                <span className="stat-value" style={{ color: 'var(--error)' }}>
                  {importResult.failed}
                </span>
              </div>
              <div className="card stat-card">
                <span className="stat-label">Total Processed</span>
                <span className="stat-value">{parsedData.length}</span>
              </div>
            </div>

            {/* Error Details */}
            {importResult.errors.length > 0 && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Failed Imports</h4>
                <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Venue Name</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.errors.map((error, idx) => {
                        const rowData = parsedData[error.row - 2]; // -2 for header and 0-index
                        return (
                          <tr key={idx}>
                            <td>{error.row}</td>
                            <td>{rowData?.name || 'Unknown'}</td>
                            <td style={{ color: 'var(--error)' }}>{error.error}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={handleReset}>
                Import Another File
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => (window.location.href = '/venues')}
              >
                View All Venues
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default BatchImportPage;
