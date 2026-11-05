jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../../database/db');
const repo = require('./reports.repository');

beforeEach(() => jest.clearAllMocks());

describe('reports.repository database functions', () => {
  test('gets stock report and maps aggregate and unit rows', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          blood_group: 'O+',
          available: 3,
          reserved: 1,
          issued: 2,
          expired: 1,
          discarded: 0,
          earliest_expiry: '2026-12-01',
          total: 7,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          unit_id: 'UNIT-1',
          blood_group: 'O+',
          volume_ml: 450,
          collection_date: '2026-11-01',
          expiry_date: '2026-12-01',
          status: 'Available',
        }],
      });

    const result = await repo.getStockReport({
      bloodGroup: 'O+',
      from: '2026-11-01',
      to: '2026-11-30',
      status: 'Available',
    });

    expect(result.aggregates[0]).toMatchObject({
      bloodGroup: 'O+',
      available: 3,
      earliestExpiry: '2026-12-01',
    });
    expect(result.records[0]).toMatchObject({
      unitId: 'UNIT-1',
      volumeMl: 450,
    });
    expect(result.totalUnits).toBe(1);
    expect(query).toHaveBeenCalledTimes(2);
  });

  test('handles empty stock results and null earliest expiry', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          blood_group: 'A+',
          available: 0,
          reserved: 0,
          issued: 0,
          expired: 0,
          discarded: 0,
          earliest_expiry: null,
          total: 0,
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await repo.getStockReport();

    expect(result.aggregates[0].earliestExpiry).toBeNull();
    expect(result.records).toEqual([]);
    expect(result.totalUnits).toBe(0);
  });

  test('uses special expired status filter without adding a status parameter', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await repo.getStockReport({
      bloodGroup: 'O+',
      status: 'Expired',
    });

    expect(query.mock.calls[1][0]).toContain("status = 'Expired'");
    expect(query.mock.calls[1][0]).toContain('expiry_date <= CURRENT_DATE');
    expect(query.mock.calls[1][1]).toEqual(['O+']);
  });

  test('gets donation report and maps anonymous donors and zero volume', async () => {
    query.mockResolvedValue({
      rows: [
        {
          donation_id: 'DON-1',
          donor_id: 'DNR-1',
          donor_name: null,
          collection_date: '2026-11-01',
          volume_ml: null,
          blood_group: 'O+',
          screening_status: 'Passed',
          donation_status: 'Recorded',
          recorded_by: 'USR-1',
          recorded_at: '2026-11-01',
        },
      ],
    });

    const result = await repo.getDonationReport({ status: 'Passed' });

    expect(result.records[0].donorName).toBe('Anonymous');
    expect(result.totalDonations).toBe(1);
    expect(result.totalVolumeMl).toBe(0);
    expect(query.mock.calls[0][1]).toEqual(['Passed']);
  });

  test('handles empty donation report', async () => {
    query.mockResolvedValue({ rows: [] });

    const result = await repo.getDonationReport();

    expect(result.records).toEqual([]);
    expect(result.totalDonations).toBe(0);
    expect(result.totalVolumeMl).toBe(0);
  });

  test('gets request report and maps null decision and rejection fields', async () => {
    query.mockResolvedValue({
      rows: [{
        request_id: 'REQ-1',
        hospital_name: 'City Hospital',
        patient_name: 'Test Patient',
        blood_group: 'A+',
        units: null,
        priority: 'Urgent',
        status: 'Pending',
        request_date: '2026-11-01',
        decision_date: null,
        rejection_reason: null,
      }],
    });

    const result = await repo.getRequestReport({ status: 'Pending' });

    expect(result.records[0].decisionDate).toBeNull();
    expect(result.records[0].rejectionReason).toBeNull();
    expect(result.totalRequests).toBe(1);
    expect(result.totalUnitsRequested).toBe(0);
  });

  test('handles empty request report', async () => {
    query.mockResolvedValue({ rows: [] });

    const result = await repo.getRequestReport();

    expect(result.records).toEqual([]);
    expect(result.totalRequests).toBe(0);
    expect(result.totalUnitsRequested).toBe(0);
  });
});
