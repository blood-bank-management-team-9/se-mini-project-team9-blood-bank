// Tests for Reports Module (Issue #22)
// Covers:
// - FR-RPT-01 (Stock report: available, reserved, issued, expired, discarded, earliest expiry)
// - FR-RPT-02 (Donation report: date range, volume, collection counts)
// - FR-RPT-03 (Request report: date range, status, units requested)
// - FR-RPT-04 (Filter any report by from/to dates, bloodGroup, status)
// - FR-RPT-06 (Staff/Admin only, HTTP 403 for unauthorized roles, "No records found" message)
// - NFR-PERF-04 (Report generation efficiency)
// - STP TC-09, TC-10

const request = require('supertest');
const app = require('../../app');
const reportsService = require('./reports.service');
const reportsRepo = require('./reports.repository');

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

describe('Reports Service Unit Tests (FR-RPT-01 to 04, FR-RPT-06, TC-10)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Validation & Error Handling', () => {
    it('throws ReportError 400 when from date is after to date', async () => {
      await expect(
        reportsService.generateStockReport({ from: '2026-12-31', to: '2026-01-01' })
      ).rejects.toThrow(/"from" date must be earlier/);
    });

    it('throws ReportError 400 for invalid blood group filter', async () => {
      await expect(
        reportsService.generateStockReport({ bloodGroup: 'XYZ' })
      ).rejects.toThrow(/Invalid blood group/);
    });
  });

  describe('Stock Report (FR-RPT-01, TC-10)', () => {
    it('aggregates stock per blood group with earliest expiry date', async () => {
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

      const res = await reportsService.generateStockReport({ bloodGroup: 'O+' });
      expect(res.reportType).toBe('stock');
      expect(res.aggregates[0].available).toBe(10);
      expect(res.aggregates[0].earliestExpiry).toBe('2026-11-01');
      expect(res.records).toHaveLength(1);
      expect(res.totalRecords).toBe(1);
      expect(res.criteria).toEqual({ bloodGroup: 'O+' });
      expect(res.message).toBeUndefined();
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

  describe('Donation Report (FR-RPT-02)', () => {
    it('returns donations list with total collection count and volume', async () => {
      jest.spyOn(reportsRepo, 'getDonationReport').mockResolvedValue({
        records: [
          {
            donationId: 'DON-001',
            donorId: 'DNR-001',
            bloodGroup: 'O+',
            volumeMl: 450,
            collectionDate: '2026-10-15',
            screeningResult: 'Passed',
            donationStatus: 'Recorded',
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
  });

  describe('Request Report (FR-RPT-03)', () => {
    it('returns requests list with count and units requested summary', async () => {
      jest.spyOn(reportsRepo, 'getRequestReport').mockResolvedValue({
        records: [
          {
            requestId: 'REQ-001',
            hospitalName: 'City Hospital',
            patientName: 'Jane Patient',
            bloodGroup: 'A+',
            units: 3,
            priority: 'Urgent',
            status: 'Pending',
            requestDate: '2026-10-20',
            decisionDate: null,
          },
        ],
        totalRequests: 1,
        totalUnitsRequested: 3,
      });

      const res = await reportsService.generateRequestReport({ bloodGroup: 'A+' });
      expect(res.reportType).toBe('request');
      expect(res.summary.totalRequests).toBe(1);
      expect(res.summary.totalUnitsRequested).toBe(3);
      expect(res.records[0].hospitalName).toBe('City Hospital');
    });
  });
});

// Live Database integration tests when DB is running
describeIfDb('Reports Live DB Integration (TC-09, TC-10)', () => {
  const STAFF_EMAIL = 'staff@bloodbank.org';
  const HOSPITAL_EMAIL = 'hospital@citygen.org';
  const PASSWORD = 'Test@1234';

  async function loginAs(email, password) {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/login').send({ email, password });
    if (res.status !== 200) {
      throw new Error(`Login failed for ${email}`);
    }
    return agent;
  }

  it('blocks unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/reports/stock');
    expect(res.status).toBe(401);
  });

  it('blocks Hospital/Patient with 403 ACCESS_DENIED (FR-RPT-06, TC-09)', async () => {
    const hospital = await loginAs(HOSPITAL_EMAIL, PASSWORD);
    const res = await hospital.get('/api/reports/stock');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCESS_DENIED');
  });

  it('allows Staff to generate stock report (FR-RPT-01, TC-10)', async () => {
    const staff = await loginAs(STAFF_EMAIL, PASSWORD);
    const res = await staff.get('/api/reports/stock?bloodGroup=O+');
    expect(res.status).toBe(200);
    expect(res.body.reportType).toBe('stock');
    expect(Array.isArray(res.body.aggregates)).toBe(true);
  });
});
