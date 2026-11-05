const exporter = require('./reports.exporter');

describe('reports.exporter additional coverage', () => {
  test('exports stock CSV with missing expiry fallback', () => {
    const csv = exporter.exportToCsv('stock', {
      aggregates: [{
        bloodGroup: 'A+',
        available: 2,
        reserved: 0,
        issued: 0,
        expired: 0,
        discarded: 0,
        earliestExpiry: null,
        total: 2,
      }],
    });

    expect(csv).toContain('A+,2,0,0,0,0,None,2');
  });

  test('exports donation CSV and escapes special characters', () => {
    const csv = exporter.exportToCsv('donation', {
      records: [{
        donationId: 'DON-1',
        donorId: 'DNR-1',
        bloodGroup: 'O+',
        volumeMl: 450,
        collectionDate: '2026-11-01',
        screeningResult: 'Passed, verified',
        donationStatus: 'Recorded',
      }],
    });

    expect(csv).toContain('"Passed, verified"');
  });

  test('exports request CSV with pending decision fallback', () => {
    const csv = exporter.exportToCsv('request', {
      records: [{
        requestId: 'REQ-1',
        hospitalName: 'City Hospital',
        patientName: 'Test Patient',
        bloodGroup: 'A+',
        units: 2,
        priority: 'Urgent',
        status: 'Pending',
        requestDate: '2026-11-01',
        decisionDate: null,
      }],
    });

    expect(csv).toContain('Pending');
  });

  test('escapes quotes and newlines in CSV cells', () => {
    const csv = exporter.exportToCsv('donation', {
      records: [{
        donationId: 'DON-"1"',
        donorId: 'DNR-1',
        bloodGroup: 'O+',
        volumeMl: 450,
        collectionDate: '2026-11-01',
        screeningResult: 'Line one\nLine two',
        donationStatus: 'Recorded',
      }],
    });

    expect(csv).toContain('"DON-""1"""');
    expect(csv).toContain('"Line one\nLine two"');
  });

  test('returns empty content for an unknown CSV report type', () => {
    expect(exporter.exportToCsv('unknown', {})).toBe('');
  });

  test('exports donation PDF with summary and escaped text', () => {
    const pdf = exporter.exportToPdf('donation', {
      generatedAt: '2026-11-01T10:30:00.000Z',
      criteria: { from: '2026-11-01', bloodGroup: 'O+' },
      summary: { totalDonations: 1, totalVolumeMl: 450 },
      records: [{
        donationId: 'DON(1)',
        donorId: 'DNR\\1',
        bloodGroup: 'O+',
        volumeMl: 450,
        collectionDate: '2026-11-01',
        screeningResult: 'Passed',
        donationStatus: 'Recorded',
      }],
    }).toString();

    expect(pdf).toContain('%PDF-1.4');
    expect(pdf).toContain('Total Donations = 1');
    expect(pdf).toContain('From: 2026-11-01');
    expect(pdf).toContain('Group: O+');
    expect(pdf).toContain('DON\\(1\\)');
    expect(pdf).toContain('DNR\\\\1');
  });

  test('exports request PDF and applies the 30-record limit', () => {
    const records = Array.from({ length: 31 }, (_, i) => ({
      requestId: `REQ-${i + 1}`,
      hospitalName: 'City Hospital',
      bloodGroup: 'A+',
      units: 1,
      priority: 'Normal',
      status: 'Pending',
      requestDate: '2026-11-01',
    }));

    const pdf = exporter.exportToPdf('request', {
      summary: { totalRequests: 31, totalUnitsRequested: 31 },
      records,
    }).toString();

    expect(pdf).toContain('Total Requests = 31');
    expect(pdf).toContain('REQ-30');
    expect(pdf).not.toContain('REQ-31');
  });

  test('uses fallback title and all-records criteria for unknown PDF type', () => {
    const pdf = exporter.exportToPdf('unknown', {}).toString();

    expect(pdf).toContain('Blood Bank Management Report');
    expect(pdf).toContain('Filter Criteria: All Records');
  });

  test('exports stock PDF with default values for missing fields', () => {
    const pdf = exporter.exportToPdf('stock', {
      aggregates: [{ bloodGroup: 'O+' }],
    }).toString();

    expect(pdf).toContain('Blood Bank - Stock Inventory Report');
    expect(pdf).toContain('Earliest Expiry');
  });
});
