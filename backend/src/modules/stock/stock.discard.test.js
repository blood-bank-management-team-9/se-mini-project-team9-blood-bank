jest.mock('../../database/transaction', () => ({
  withTransaction: jest.fn((callback) => callback({ query: jest.fn() })),
}));
jest.mock('../audit/audit.repository', () => ({ logAudit: jest.fn() }));
jest.mock('./stock.repository', () => ({
  getStockConfig: jest.fn(),
  countUnitsByGroupAndStatus: jest.fn(),
  countExpiringSoonByGroup: jest.fn(),
  listUnits: jest.fn(),
  findUnitForUpdate: jest.fn(),
  markDiscarded: jest.fn(),
  countAvailable: jest.fn(),
}));

const { withTransaction } = require('../../database/transaction');
const { logAudit } = require('../audit/audit.repository');
const repo = require('./stock.repository');
const stockService = require('./stock.service');

const input = { actorUserId: 'USR-STF01', unitId: 'UNT-00001', reason: 'Leakage' };
const unit = (status) => ({ unit_id: 'UNT-00001', blood_group: 'O+', status });

describe('Discard unit (FR-STK-06, FR-STK-07)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a missing or invalid reason before touching the database', async () => {
    await expect(stockService.discardUnit({ ...input, reason: '' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    await expect(stockService.discardUnit({ ...input, reason: 'Boredom' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown unit', async () => {
    repo.findUnitForUpdate.mockResolvedValue(null);
    await expect(stockService.discardUnit(input))
      .rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(repo.markDiscarded).not.toHaveBeenCalled();
  });

  it.each(['Issued', 'Discarded'])('returns 409 for a %s unit', async (status) => {
    repo.findUnitForUpdate.mockResolvedValue(unit(status));
    await expect(stockService.discardUnit(input))
      .rejects.toMatchObject({ code: 'INVALID_STATE', status: 409 });
    expect(repo.markDiscarded).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('returns 409 if the unit changed state before the update', async () => {
    repo.findUnitForUpdate.mockResolvedValue(unit('Available'));
    repo.markDiscarded.mockResolvedValue(null);
    await expect(stockService.discardUnit(input))
      .rejects.toMatchObject({ code: 'INVALID_STATE', status: 409 });
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('discards an Available unit and writes an audit entry', async () => {
    repo.findUnitForUpdate.mockResolvedValue(unit('Available'));
    repo.markDiscarded.mockResolvedValue({ unit_id: 'UNT-00001', status: 'Discarded' });
    const result = await stockService.discardUnit(input);
    expect(result).toEqual({ unitId: 'UNT-00001', status: 'Discarded' });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'USR-STF01',
        action: 'UNIT_DISCARDED',
        entityId: 'UNT-00001',
        originalValue: { status: 'Available' },
        newValue: { status: 'Discarded', reason: 'Leakage', staffId: 'USR-STF01' },
      }),
      expect.anything()
    );
  });
});

describe('assertSufficientStock (FR-STK-07)', () => {
  it('refuses to allocate more units than are available', async () => {
    repo.countAvailable.mockResolvedValue(2);
    await expect(stockService.assertSufficientStock({}, 'O+', 3))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK', status: 409 });
  });

  it('allows allocation when enough units are available', async () => {
    repo.countAvailable.mockResolvedValue(3);
    await expect(stockService.assertSufficientStock({}, 'O+', 3)).resolves.toBe(3);
  });
});