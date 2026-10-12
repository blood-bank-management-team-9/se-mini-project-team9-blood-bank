const { discardUnit } = require('./discard.service');

const setup = (unit, markResult = true) => {
  const repo = {
    findUnitForUpdate: jest.fn().mockResolvedValue(unit),
    markDiscarded: jest.fn().mockResolvedValue(markResult),
  };
  const audit = { logChange: jest.fn().mockResolvedValue() };
  let rolledBack = false;
  const tx = async (fn) => { try { return await fn({}); } catch (e) { rolledBack = true; throw e; } };
  return { repo, audit, deps: { repo, audit, tx }, wasRolledBack: () => rolledBack };
};
const run = (s) => discardUnit({ unitId: 'UNT-00001', reason: 'Hemolyzed', staffId: 7 }, s.deps);

describe('discardUnit (FR-STK-06, FR-STK-07)', () => {
  it.each(['Available', 'Reserved', 'Expired'])('discards a %s unit and logs reason and staff ID (TC-29)', async (status) => {
    const s = setup({ unit_id: 'UNT-00001', status });
    expect(await run(s)).toEqual({ unitId: 'UNT-00001', status: 'Discarded' });
    expect(s.repo.markDiscarded).toHaveBeenCalledWith({}, 'UNT-00001', 'Hemolyzed');
    expect(s.audit.logChange).toHaveBeenCalledWith({}, {
      userId: 7, action: 'UNIT_DISCARDED', entity: 'unit:UNT-00001',
      originalValue: { status }, newValue: { status: 'Discarded', reason: 'Hemolyzed' },
    });
  });

  it.each(['Issued', 'Discarded'])('refuses a %s unit with INVALID_STATE and changes nothing', async (status) => {
    const s = setup({ unit_id: 'UNT-00001', status });
    await expect(run(s)).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' });
    expect(s.repo.markDiscarded).not.toHaveBeenCalled();
    expect(s.audit.logChange).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND for an unknown unit', async () => {
    await expect(run(setup(null))).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('refuses when the guarded UPDATE touches no row (stock is never counted down twice)', async () => {
    const s = setup({ unit_id: 'UNT-00001', status: 'Available' }, false);
    await expect(run(s)).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' });
    expect(s.audit.logChange).not.toHaveBeenCalled();
  });

  it('rolls back when the audit write fails (atomic)', async () => {
    const s = setup({ unit_id: 'UNT-00001', status: 'Available' });
    s.audit.logChange.mockRejectedValue(new Error('audit down'));
    await expect(run(s)).rejects.toThrow('audit down');
    expect(s.wasRolledBack()).toBe(true);
  });
});
