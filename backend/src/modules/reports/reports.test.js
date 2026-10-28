// Tests for Reports Module (Issue #22)
// Covers:
// - FR-RPT-01 (Stock report: available, reserved, issued, expired, discarded, earliest expiry)
// - FR-RPT-02 (Donation report: date range, volume, collection counts)
// - FR-RPT-03 (Request report: date range, status, units requested, TC-32)
// - FR-RPT-04 (Filter any report by from/to dates, bloodGroup, status)
// - FR-RPT-06 (Staff/Admin only, HTTP 403 for unauthorized roles, "No records found" message)
// - STP TC-09, TC-10, TC-32

const request = require('supertest');
const app = require('../../app');
const reportsService = require('./reports.service');
const reportsRepo = require('./reports.repository');
const { logAudit } = require('../audit/audit.repository');

jest.mock('../audit/audit.repository', () => ({
  logAudit: jest.fn().mockResolvedValue(true),
}));

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

describe('Reports Service & Route Unit Tests (Offline / Mocked DB)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Route-Level Authentication & Validation (Without DB)', () => {
    it('returns 401 UNAUTHENTICATED on all report endpoints when unauthenticated (FR-RPT-06, TC-09)', async () => {
      const stockRes = await request(app).get('/api/reports/stock');
      expect(stockRes.status).toBe(401);
      expect(stockRes.body.error.code).toBe('UNAUTHENTICATED');

      const donRes = await request(app).get('/api/reports/donation');
      expect(donRes.status).toBe(401);
      expect(donRes.body.error.code).toBe('UNAUTHENTICATED');

      const reqRes = await request(app).get('/api/reports/request');
      expect(reqRes.status).toBe(401);
      expect(reqRes.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects invalid blood group with 400', async () => {
      await expect(
        reportsService.generateStockReport({ bloodGroup: 'INVALID' })
      ).rejects.toThrow(/Invalid blood group/);
    });

    it('rejects invalid date format with 400', async () => {
      await expect(
        reportsService.generateStockReport({ from: '2026/10/01' })
      ).rejects.toThrow(/YYYY-MM-DD expected/);
    });

    it('rejects from date later than to date with 400', async () => {
      await expect(
        reportsService.generateStockReport({ from: '2026-11-01', to: '2026-10-01' })
      ).rejects.toThrow(/"from" date must be earlier/);
    });

    it('rejects invalid status filter with 400', async () => {
      await expect(
        reportsService.generateStockReport({ status: 'InvalidStatus' })
      ).rejects.toThrow(/Invalid status filter/);
    });
  });

  describe('Stock Report (FR-RPT-01, FR-RPT-04, TC-10)', () => {
    it('aggregates stock per blood group with earliest expiry date and records audit', async () => {
      jest.spyOn(reportsRepo, 'getStockReport').mockResolvedValue({
        aggregates: [
          {
            bloodGroup: 'O+',
            available: 10,
            reserved: 2,
            issued: 5,
            expired: 1,
            discarded: 0,
            earliestExpiry: '2026-11-01',
            total: 18,
          },
        ],
        records: [
          {
            unitId: 'UNT-001',
            bloodGroup: 'O+',
            volumeMl: 450,
            collectionDate: '2026-10-01',
            expiryDate: '2026-11-01',
            status: 'Available',
          },
        ],
        totalUnits: 1,
      });

      const res = await reportsService.generateStockReport({ bloodGroup: 'O+' }, 'USR-00001');
      expect(res.reportType).toBe('stock');
      expect(res.aggregates[0].available).toBe(10);
      expect(res.aggregates[0].earliestExpiry).toBe('2026-11-01');
      expect(res.records).toHaveLength(1);
      expect(res.totalRecords).toBe(1);
      expect(res.criteria).toEqual({ bloodGroup: 'O+' });
      expect(res.message).toBeUndefined();

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'USR-00001',
          action: 'REPORT_GENERATED',
          entity: 'reports',
          entityId: 'stock',
        })
      );
    });

    it('returns "No records found" when 0 records match (FR-RPT-06)', async () => {
      jest.spyOn(reportsRepo, 'getStockReport').mockResolvedValue({
        aggregates: [],
        records: [],
        totalUnits: 0,
      });

      const res = await reportsService.generateStockReport({ bloodGroup: 'AB-' });
      expect(res.totalRecords).toBe(0);
      expect(res.message).toBe('No records found');
    });
  });

  describe('Donation Report (FR-RPT-02, FR-RPT-04, FR-RPT-06)', () => {
    it('returns donations list with total collection count and volume', async () => {
      jest.spyOn(reportsRepo, 'getDonationReport').mockResolvedValue({
        records: [
          {
            donationId: 'DON-001',
            donorId: 'DNR-001',
            donorName: 'Test Donor',
            bloodGroup: 'O+',
            volumeMl: 450,
            collectionDate: '2026-10-15',
            screeningStatus: 'Passed',
            donationStatus: 'Recorded',
            recordedBy: 'USR-00001',
            recordedAt: '2026-10-15',
          },
        ],
        totalDonations: 1,
        totalVolumeMl: 450,
      });

      const res = await reportsService.generateDonationReport({ from: '2026-10-01', to: '2026-10-31' });
      expect(res.reportType).toBe('donation');
      expect(res.summary.totalDonations).toBe(1);
      expect(res.summary.totalVolumeMl).toBe(450);
      expect(res.records[0].donationId).toBe('DON-001');
    });

    it('returns "No records found" when 0 donations match (FR-RPT-06)', async () => {
      jest.spyOn(reportsRepo, 'getDonationReport').mockResolvedValue({
        records: [],
        totalDonations: 0,
        totalVolumeMl: 0,
      });

      const res = await reportsService.generateDonationReport({ bloodGroup: 'AB-' });
      expect(res.totalRecords).toBe(0);
      expect(res.message).toBe('No records found');
    });
  });

  describe('Request Report (FR-RPT-03, FR-RPT-04, TC-32)', () => {
    it('returns requests list with count and units requested summary (TC-32)', async () => {
      jest.spyOn(reportsRepo, 'getRequestReport').mockResolvedValue({
        records: [
          {
            requestId: 'REQ-001',
            hospitalName: 'City Hospital',
            patientName: 'Jane Patient',
            bloodGroup: 'A+',
            units: 3,
            priority: 'Urgent',
            status: 'Approved',
            requestDate: '2026-10-20',
            decisionDate: '2026-10-20',
            rejectionReason: null,
          },
        ],
        totalRequests: 1,
        totalUnitsRequested: 3,
      });

      const res = await reportsService.generateRequestReport({ bloodGroup: 'A+', status: 'Approved' });
      expect(res.reportType).toBe('request');
      expect(res.summary.totalRequests).toBe(1);
      expect(res.summary.totalUnitsRequested).toBe(3);
      expect(res.records[0].priority).toBe('Urgent');
      expect(res.records[0].status).toBe('Approved');
      expect(res.records[0].requestDate).toBe('2026-10-20');
      expect(res.records[0].decisionDate).toBe('2026-10-20');
    });

    it('returns "No records found" when 0 requests match (FR-RPT-06)', async () => {
      jest.spyOn(reportsRepo, 'getRequestReport').mockResolvedValue({
        records: [],
        totalRequests: 0,
        totalUnitsRequested: 0,
      });

      const res = await reportsService.generateRequestReport({ status: 'Rejected' });
      expect(res.totalRecords).toBe(0);
      expect(res.message).toBe('No records found');
    });
  });

  describe('Repository SQL Builders (FR-RPT-04: Filter Query Generation)', () => {
    it('builds stock filters correctly with date casting', () => {
      const { where, params } = reportsRepo.buildStockFilters({
        from: '2026-10-01',
        to: '2026-10-31',
        bloodGroup: 'O+',
      });
      expect(params).toEqual(['O+', '2026-10-01', '2026-10-31']);
      expect(where).toContain('blood_group = $1');
      expect(where).toContain('collection_date >= $2::date');
      expect(where).toContain('collection_date <= $3::date');
    });

    it('builds donation filters correctly with screening status', () => {
      const { where, params } = reportsRepo.buildDonationFilters({
        from: '2026-10-01',
        to: '2026-10-31',
        bloodGroup: 'B+',
        status: 'Passed',
      });
      expect(params).toEqual(['B+', 'Passed', '2026-10-01', '2026-10-31']);
      expect(where).toContain('blood_group = $1');
      expect(where).toContain('screening_status = $2');
      expect(where).toContain('collection_date >= $3::date');
      expect(where).toContain('collection_date <= $4::date');
    });

    it('builds request filters on created_at timestamp with full day inclusion', () => {
      const { where, params } = reportsRepo.buildRequestFilters({
        from: '2026-10-01',
        to: '2026-10-31',
        bloodGroup: 'AB-',
        status: 'Pending',
      });
      expect(params).toEqual(['AB-', 'Pending', '2026-10-01', '2026-10-31']);
      expect(where).toContain('blood_group = $1');
      expect(where).toContain('status = $2');
      expect(where).toContain('created_at >= $3::date');
      expect(where).toContain("created_at < ($4::date + INTERVAL '1 day')");
    });
  });

  describe('Report Export (FR-RPT-05, TC-10)', () => {
    it('exports stock report as RFC 4180 CSV string with headers', async () => {
      jest.spyOn(reportsRepo, 'getStockReport').mockResolvedValue({
        aggregates: [
          { bloodGroup: 'O+', available: 3, reserved: 0, issued: 0, expired: 0, discarded: 0, earliestExpiry: '2026-11-05', total: 3 },
        ],
        records: [],
        totalUnits: 3,
      });

      const file = await reportsService.exportReport('stock', 'csv', {});
      expect(file.contentType).toBe('text/csv');
      expect(file.filename).toMatch(/stock-report-.*\.csv/);
      const csv = file.data.toString('utf8');
      expect(csv).toContain('Blood Group,Available,Reserved,Issued,Expired,Discarded,Earliest Expiry,Total Units');
      expect(csv).toContain('O+,3,0,0,0,0,2026-11-05,3');
    });

    it('exports stock report as valid standard PDF-1.4 binary buffer', async () => {
      jest.spyOn(reportsRepo, 'getStockReport').mockResolvedValue({
        aggregates: [
          { bloodGroup: 'O+', available: 3, reserved: 0, issued: 0, expired: 0, discarded: 0, earliestExpiry: '2026-11-05', total: 3 },
        ],
        records: [],
        totalUnits: 3,
      });

      const file = await reportsService.exportReport('stock', 'pdf', {});
      expect(file.contentType).toBe('application/pdf');
      expect(file.filename).toMatch(/stock-report-.*\.pdf/);
      expect(Buffer.isBuffer(file.data)).toBe(true);
      const pdfHeader = file.data.slice(0, 8).toString('utf8');
      expect(pdfHeader).toContain('%PDF-1.4');
    });

    it('throws ReportError 400 for unsupported export format', async () => {
      await expect(
        reportsService.exportReport('stock', 'docx', {})
      ).rejects.toThrow(/Export format must be "csv" or "pdf"/);
    });
  });
});

// Live Database integration tests when DB is running
describeIfDb('Reports Live DB Integration (TC-09, TC-10, TC-32)', () => {
  const STAFF_EMAIL = 'staff@bloodbank.org';
  const HOSPITAL_EMAIL = 'hospital@citygen.org';
  const PASSWORD = 'Password123!';

  async function loginAs(email, password) {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/login').send({ email, password });
    if (res.status !== 200) {
      throw new Error(`Login failed for ${email}`);
    }
    return agent;
  }

  it('blocks Hospital/Patient from all report endpoints with 403 ACCESS_DENIED (FR-RPT-06, TC-09)', async () => {
    const hospital = await loginAs(HOSPITAL_EMAIL, PASSWORD);
    const stockRes = await hospital.get('/api/reports/stock');
    expect(stockRes.status).toBe(403);
    expect(stockRes.body.error.code).toBe('ACCESS_DENIED');

    const donRes = await hospital.get('/api/reports/donation');
    expect(donRes.status).toBe(403);
    expect(donRes.body.error.code).toBe('ACCESS_DENIED');

    const reqRes = await hospital.get('/api/reports/request');
    expect(reqRes.status).toBe(403);
    expect(reqRes.body.error.code).toBe('ACCESS_DENIED');
  });

  it('allows Staff to generate stock, donation, and request reports (FR-RPT-01..03, TC-10, TC-32)', async () => {
    const staff = await loginAs(STAFF_EMAIL, PASSWORD);
    const stockRes = await staff.get('/api/reports/stock?bloodGroup=O+');
    expect(stockRes.status).toBe(200);
    expect(stockRes.body.reportType).toBe('stock');

    const donRes = await staff.get('/api/reports/donation');
    expect(donRes.status).toBe(200);
    expect(donRes.body.reportType).toBe('donation');

    const reqRes = await staff.get('/api/reports/request');
    expect(reqRes.status).toBe(200);
    expect(reqRes.body.reportType).toBe('request');
  });
});
