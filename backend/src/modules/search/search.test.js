// Tests for Search Module (Issue #21)
// Covers:
// - FR-SRCH-01, FR-SRCH-02 (Stock search, role-based unit detail visibility)
// - FR-SRCH-03, FR-SRCH-04 (Eligible donor search, RBAC 403 enforcement)
// - FR-SRCH-05 (No matching results message without error)
// - FR-SRCH-06 (Pagination with 20 records per page)
// - STP TC-09, TC-12, TC-26

const request = require('supertest');
const app = require('../../app');
const searchService = require('./search.service');
const searchRepo = require('./search.repository');

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

describe('Search Service Unit Tests (FR-SRCH-01 to 06, TC-12, TC-26)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('searchStock', () => {
    it('throws SearchError 400 when blood group is invalid', async () => {
      await expect(searchService.searchStock('XYZ', 'Staff')).rejects.toThrow(
        /Valid blood group is required/
      );
    });

    it('returns stock summary for Hospital/Patient without unit IDs (FR-SRCH-02, TC-12)', async () => {
      jest.spyOn(searchRepo, 'searchStockByGroup').mockResolvedValue([
        { unit_id: 'UNT-001', expiry_date: new Date('2026-11-15') },
        { unit_id: 'UNT-002', expiry_date: new Date('2026-11-20') },
      ]);

      const res = await searchService.searchStock('O+', 'Hospital/Patient');
      expect(res.bloodGroup).toBe('O+');
      expect(res.availableUnits).toBe(2);
      expect(res.earliestExpiry).toBe('2026-11-15');
      expect(res.units).toBeUndefined(); // Units hidden from requester
      expect(res.criteria).toEqual({ bloodGroup: 'O+' });
    });

    it('returns detailed unit IDs and expiry for Staff (FR-SRCH-02, TC-12)', async () => {
      jest.spyOn(searchRepo, 'searchStockByGroup').mockResolvedValue([
        { unit_id: 'UNT-001', expiry_date: new Date('2026-11-15') },
      ]);

      const res = await searchService.searchStock('O+', 'Staff');
      expect(res.availableUnits).toBe(1);
      expect(res.units).toEqual([
        { unitId: 'UNT-001', expiryDate: '2026-11-15' },
      ]);
    });

    it('returns 200 with "No matching results found" when stock is 0 (FR-SRCH-05, TC-12)', async () => {
      jest.spyOn(searchRepo, 'searchStockByGroup').mockResolvedValue([]);

      const res = await searchService.searchStock('AB-', 'Staff');
      expect(res.availableUnits).toBe(0);
      expect(res.earliestExpiry).toBeNull();
      expect(res.message).toBe('No matching results found');
      expect(res.criteria).toEqual({ bloodGroup: 'AB-' });
    });
  });

  describe('searchDonors', () => {
    it('throws SearchError 400 for invalid blood group filter', async () => {
      await expect(searchService.searchDonors({ bloodGroup: 'INVALID' })).rejects.toThrow(
        /Valid blood group is required/
      );
    });

    it('returns paginated eligible donors and criteria (FR-SRCH-03, FR-SRCH-06, TC-26)', async () => {
      const mockDonors = Array.from({ length: 20 }, (_, i) => ({
        donorId: `DNR-${1000 + i}`,
        name: `Donor ${i + 1}`,
        bloodGroup: 'O+',
        city: 'Bangalore',
        phone: `98765432${i.toString().padStart(2, '0')}`,
        lastDonationDate: '2026-06-01',
      }));

      jest.spyOn(searchRepo, 'searchEligibleDonors').mockResolvedValue({
        donors: mockDonors,
        total: 45,
      });

      const res = await searchService.searchDonors({ bloodGroup: 'O+', page: 1, limit: 20 });
      expect(res.donors).toHaveLength(20);
      expect(res.total).toBe(45);
      expect(res.page).toBe(1);
      expect(res.limit).toBe(20);
      expect(res.totalPages).toBe(3);
      expect(res.criteria).toEqual({ bloodGroup: 'O+' });
      expect(res.message).toBeUndefined();
    });

    it('returns "No matching results found" when 0 eligible donors match (FR-SRCH-05)', async () => {
      jest.spyOn(searchRepo, 'searchEligibleDonors').mockResolvedValue({
        donors: [],
        total: 0,
      });

      const res = await searchService.searchDonors({ bloodGroup: 'B-', city: 'NonExistentCity' });
      expect(res.donors).toEqual([]);
      expect(res.total).toBe(0);
      expect(res.message).toBe('No matching results found');
      expect(res.criteria).toEqual({ bloodGroup: 'B-', city: 'NonExistentCity' });
    });
  });
});

// Live Database integration tests when DB is running
describeIfDb('Search Live DB Integration (TC-09, TC-12, TC-26)', () => {
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

  it('returns 401 UNAUTHENTICATED on GET /api/search/stock without session', async () => {
    const res = await request(app).get('/api/search/stock?bloodGroup=O+');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 UNAUTHENTICATED on GET /api/search/donors without session', async () => {
    const res = await request(app).get('/api/search/donors');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('allows Hospital user to search stock (FR-SRCH-01, TC-12)', async () => {
    const hospital = await loginAs(HOSPITAL_EMAIL, PASSWORD);
    const res = await hospital.get('/api/search/stock?bloodGroup=O+');
    expect(res.status).toBe(200);
    expect(res.body.bloodGroup).toBe('O+');
    expect(typeof res.body.availableUnits).toBe('number');
    expect(res.body.units).toBeUndefined(); // Hospital cannot view unit IDs
  });

  it('blocks Hospital user from searching donors with 403 ACCESS_DENIED (FR-SRCH-04, TC-09)', async () => {
    const hospital = await loginAs(HOSPITAL_EMAIL, PASSWORD);
    const res = await hospital.get('/api/search/donors');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCESS_DENIED');
  });

  it('allows Staff to search stock and view unit IDs (FR-SRCH-02, TC-12)', async () => {
    const staff = await loginAs(STAFF_EMAIL, PASSWORD);
    const res = await staff.get('/api/search/stock?bloodGroup=O+');
    expect(res.status).toBe(200);
    expect(res.body.bloodGroup).toBe('O+');
    expect(Array.isArray(res.body.units)).toBe(true);
  });

  it('allows Staff to search eligible donors with pagination (FR-SRCH-03, FR-SRCH-06, TC-26)', async () => {
    const staff = await loginAs(STAFF_EMAIL, PASSWORD);
    const res = await staff.get('/api/search/donors?bloodGroup=O+&page=1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.donors)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });
});
