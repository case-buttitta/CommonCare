import { describe, it, expect } from 'vitest';
import { BIOMARKER_META, getBiomarkerStatus } from '../../utils/biomarkerData';

const MOCK_RANGES = [
  { biomarker_type: 'heart_rate',               min_value: 60,  max_value: 100 },
  { biomarker_type: 'blood_pressure_systolic',  min_value: 90,  max_value: 120 },
  { biomarker_type: 'blood_pressure_diastolic', min_value: 60,  max_value: 80  },
  { biomarker_type: 'oxygen_saturation',        min_value: 95,  max_value: 100 },
];

describe('BIOMARKER_META', () => {
  it('contains an entry for heart_rate', () => {
    expect(BIOMARKER_META).toHaveProperty('heart_rate');
    expect(BIOMARKER_META.heart_rate.label).toBe('Heart Rate');
  });

  it('every entry has label, IconComponent, and color', () => {
    for (const [key, meta] of Object.entries(BIOMARKER_META)) {
      expect(meta, `${key} missing label`).toHaveProperty('label');
      expect(meta, `${key} missing IconComponent`).toHaveProperty('IconComponent');
      expect(meta, `${key} missing color`).toHaveProperty('color');
    }
  });

  it('contains all expected biomarker types', () => {
    const expected = [
      'blood_pressure_systolic', 'blood_pressure_diastolic', 'heart_rate',
      'cholesterol_total', 'blood_sugar', 'vitamin_d', 'bmi', 'hba1c',
    ];
    for (const type of expected) {
      expect(BIOMARKER_META, `Missing ${type}`).toHaveProperty(type);
    }
  });
});

describe('getBiomarkerStatus()', () => {
  it('returns Normal for a value within range', () => {
    const result = getBiomarkerStatus('heart_rate', 75, MOCK_RANGES);
    expect(result.status).toBe('Normal');
    expect(result.className).toBe('status-normal');
  });

  it('returns Low for a value below min', () => {
    const result = getBiomarkerStatus('heart_rate', 50, MOCK_RANGES);
    expect(result.status).toBe('Low');
    expect(result.className).toBe('status-low');
  });

  it('returns High for a value clearly above max', () => {
    const result = getBiomarkerStatus('heart_rate', 130, MOCK_RANGES);
    expect(result.status).toBe('High');
    expect(result.className).toBe('status-high');
  });

  it('returns Borderline for a value just above max (within 10%)', () => {
    // max=100, borderline zone is 100–110
    const result = getBiomarkerStatus('heart_rate', 105, MOCK_RANGES);
    expect(result.status).toBe('Borderline');
    expect(result.className).toBe('status-borderline');
  });

  it('returns Unknown when no range exists for the type', () => {
    const result = getBiomarkerStatus('unknown_type', 42, MOCK_RANGES);
    expect(result.status).toBe('Unknown');
    expect(result.className).toBe('status-unknown');
  });

  it('returns Unknown for empty ranges array', () => {
    const result = getBiomarkerStatus('heart_rate', 75, []);
    expect(result.status).toBe('Unknown');
  });

  it('handles numeric string values correctly', () => {
    const result = getBiomarkerStatus('heart_rate', '80', MOCK_RANGES);
    expect(result.status).toBe('Normal');
  });

  it('returns Low for value at exactly min - 1', () => {
    const result = getBiomarkerStatus('heart_rate', 59, MOCK_RANGES);
    expect(result.status).toBe('Low');
  });

  it('returns Normal for value at exactly min', () => {
    const result = getBiomarkerStatus('heart_rate', 60, MOCK_RANGES);
    expect(result.status).toBe('Normal');
  });

  it('returns Normal for value at exactly max', () => {
    const result = getBiomarkerStatus('heart_rate', 100, MOCK_RANGES);
    expect(result.status).toBe('Normal');
  });

  it('returns High (not Borderline) when value exceeds the 10% borderline threshold', () => {
    // max=100, borderline ends at 110; 111 must be High
    const result = getBiomarkerStatus('heart_rate', 111, MOCK_RANGES);
    expect(result.status).toBe('High');
  });

  it('picks the correct range when multiple ranges are present', () => {
    // 115 is within [90,120] for systolic → Normal
    const bp = getBiomarkerStatus('blood_pressure_systolic', 115, MOCK_RANGES);
    expect(bp.status).toBe('Normal');
    // 115 is above max (100) AND above borderline (110) for heart_rate → High
    const hr = getBiomarkerStatus('heart_rate', 115, MOCK_RANGES);
    expect(hr.status).toBe('High');
  });

  it('every BIOMARKER_META entry has popMean and popSigma as numbers', () => {
    for (const [key, meta] of Object.entries(BIOMARKER_META)) {
      expect(typeof meta.popMean, `${key} popMean`).toBe('number');
      expect(typeof meta.popSigma, `${key} popSigma`).toBe('number');
    }
  });
});
