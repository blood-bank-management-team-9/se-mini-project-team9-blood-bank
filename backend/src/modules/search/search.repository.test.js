jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

jest.mock('../donors/donors.repository', () => ({
  getEligibilityConfig: jest.fn(),
}));

const { query } = require('../../database/db');
const { getEligibilityConfig } = require('../donors/donors.repository');
const repo = require('./search.repository');

beforeEach(() => jest.clearAllMocks());

describe('search.repository database functions', () => {
  test('searches stock by blood group', async () => {
    const rows = [{ unit_id: 'UNIT-1', expiry_date: '2026-12-01' }];
    query.mockResolvedValue({ rows });

    const result = await repo.searchStockByGroup('O+');

    expect(result).toEqual(rows);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'Available'"),
      ['O+']
    );
  });

  test('gets eligible donors using configured values and pagination', async () => {
    getEligibilityConfig.mockResolvedValue({
      eligibility_min_age: '20',
      eligibility_max_age: '60',
      eligibility_min_weight_kg: '50',
      eligibility_gap_days_male: '90',
      eligibility_gap_days_other: '120',
    });

    query
      .mockResolvedValueOnce({ rows: [{ total: 25 }] })
      .mockResolvedValueOnce({
        rows: [{
          donor_id: 'DNR-1',
          full_name: 'Test Donor',
          blood_group: 'O+',
          city: 'Bangalore',
          phone: '9876501234',
          last_donation_date: '2026-06-01',
        }],
      });

    const result = await repo.searchEligibleDonors({
      bloodGroup: 'O+',
      city: 'Bangalore',
      pin: '560001',
      page: 2,
      limit: 10,
    });

    expect(result.total).toBe(25);
    expect(result.donors[0]).toMatchObject({
      donorId: 'DNR-1',
      name: 'Test Donor',
      lastDonationDate: '2026-06-01',
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][1].slice(-2)).toEqual([10, 10]);
  });

  test('falls back to default eligibility config when config lookup fails', async () => {
    getEligibilityConfig.mockRejectedValue(new Error('Config unavailable'));

    query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await repo.searchEligibleDonors({});

    expect(result).toEqual({ donors: [], total: 0 });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][1]).toEqual([45, 18, 66, 90, 120]);
  });

  test('handles missing count row and null last donation date', async () => {
    getEligibilityConfig.mockResolvedValue({});

    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          donor_id: 'DNR-2',
          full_name: 'Another Donor',
          blood_group: 'A+',
          city: 'Mysore',
          phone: '9876500000',
          last_donation_date: null,
        }],
      });

    const result = await repo.searchEligibleDonors({ page: 1, limit: 20 });

    expect(result.total).toBe(0);
    expect(result.donors[0].lastDonationDate).toBeNull();
  });
});
