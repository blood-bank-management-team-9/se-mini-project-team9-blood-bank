// src/modules/reports/reports.exporter.test.js
const { exportToCsv, exportToPdf } = require('./reports.exporter');

describe('reports.exporter', () => {
  // ── CSV ────────────────────────────────────────────────────────────
  describe('exportToCsv', () => {
    it('stock: emits header + one row per aggregate', () => {
      const csv = exportToCsv('stock', {
        aggregates: [
          { bloodGroup: 'O+', available: 4, reserved: 1, issued: 0, expired: 0, discarded: 0, earliestExpiry: '2026-12-01', total: 5 },
        ],
      });
      const lines = csv.split('\r\n');
      expect(lines[0]).toContain('Blood Group');
      expect(lines[1]).toContain('O+');
      expect(lines[1]).toContain('2026-12-01');
    });

    it('stock: shows "None" when earliestExpiry is missing', () => {
      const csv = exportToCsv('stock', {
        aggregates: [{ bloodGroup: 'A+', available: 0, reserved: 0, issued: 0, expired: 0, discarded: 0, earliestExpiry: null, total: 0 }],
      });
      expect(csv).toContain('None');
    });

    it('donation: emits header + rows, defaults on nulls', () => {
      const csv = exportToCsv('donation', {
        records: [{ donationId: 'DON-1', donorId: 'DNR-1', bloodGroup: 'A+', volumeMl: 450, collectionDate: '2026-10-01', donationStatus: 'Recorded' }],
      });
      expect(csv.split('\r\n')[0]).toContain('Donation ID');
      expect(csv).toContain('DON-1');
    });

    it('request: shows "Pending" when decisionDate missing', () => {
      const csv = exportToCsv('request', {
        records: [{ requestId: 'REQ-1', hospitalName: 'H1', patientName: 'P1', bloodGroup: 'B+', units: 2, priority: 'High', status: 'Pending', requestDate: '2026-10-01' }],
      });
      expect(csv).toContain('Pending');
    });

    it('escapes cells that contain commas, quotes, newlines', () => {
      const csv = exportToCsv('request', {
        records: [{ requestId: 'REQ,1', hospitalName: 'H"Q"', patientName: 'line1\nline2', bloodGroup: 'B+', units: 2, priority: 'High', status: 'Pending', requestDate: '2026-10-01' }],
      });
      expect(csv).toContain('"REQ,1"');
      expect(csv).toContain('"H""Q"""');
    });

    it('unknown report type returns empty string', () => {
      expect(exportToCsv('bogus', {})).toBe('');
    });
  });

  // ── PDF ────────────────────────────────────────────────────────────
  describe('exportToPdf', () => {
    it('returns a Buffer starting with %PDF-1.4', () => {
      const buf = exportToPdf('stock', { aggregates: [], generatedAt: '2026-11-06T00:00:00Z' });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.toString('utf8').startsWith('%PDF-1.4')).toBe(true);
      expect(buf.toString('utf8')).toContain('%%EOF');
    });

    it('stock: renders aggregate rows and header', () => {
      const buf = exportToPdf('stock', {
        aggregates: [{ bloodGroup: 'O+', available: 4, reserved: 1, issued: 0, expired: 0, discarded: 0, earliestExpiry: '2026-12-01', total: 5 }],
        criteria: { from: '2026-01-01', to: '2026-12-31', bloodGroup: 'O+', status: 'Available' },
        generatedAt: '2026-11-06T00:00:00Z',
      });
      const text = buf.toString('utf8');
      expect(text).toContain('Stock Inventory');
      expect(text).toContain('From: 2026-01-01');
    });

    it('donation: renders summary when provided', () => {
      const buf = exportToPdf('donation', {
        summary: { totalDonations: 2, totalVolumeMl: 900 },
        records: [{ donationId: 'DON-1', donorId: 'DNR-1', bloodGroup: 'A+', volumeMl: 450, collectionDate: '2026-10-01', donationStatus: 'Recorded' }],
        generatedAt: '2026-11-06T00:00:00Z',
      });
      expect(buf.toString('utf8')).toContain('Total Donations');
    });

    it('request: renders summary when provided', () => {
      const buf = exportToPdf('request', {
        summary: { totalRequests: 1, totalUnitsRequested: 3 },
        records: [{ requestId: 'REQ-1', hospitalName: 'H1', bloodGroup: 'B+', units: 3, priority: 'High', status: 'Pending', requestDate: '2026-10-01' }],
        generatedAt: '2026-11-06T00:00:00Z',
      });
      expect(buf.toString('utf8')).toContain('Total Requests');
    });

    it('unknown type falls back to generic title', () => {
      const buf = exportToPdf('bogus', { generatedAt: '2026-11-06T00:00:00Z' });
      expect(buf.toString('utf8')).toContain('Management Report');
    });

    it('escapes special PDF characters', () => {
      const buf = exportToPdf('stock', {
        aggregates: [{ bloodGroup: 'O(1)', available: 0, reserved: 0, issued: 0, expired: 0, discarded: 0, earliestExpiry: null, total: 0 }],
        generatedAt: '2026-11-06T00:00:00Z',
      });
      expect(buf.toString('utf8')).toContain('O\\(1\\)');
    });
  });
});