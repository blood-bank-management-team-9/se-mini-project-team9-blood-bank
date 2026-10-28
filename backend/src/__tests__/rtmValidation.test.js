const fs = require('fs');
const path = require('path');

describe('Requirements Traceability Matrix (RTM) Integrity Check', () => {
  const rtmPath = path.resolve(__dirname, '../../../docs/RTM.md');
  let rtmContent = '';

  beforeAll(() => {
    expect(fs.existsSync(rtmPath)).toBe(true);
    rtmContent = fs.readFileSync(rtmPath, 'utf8');
  });

  test('contains exactly 54 Functional Requirements matching SRS schema', () => {
    const frMatches = rtmContent.match(/\|\s*\d+\s*\|\s*\*\*(FR-[A-Z]+-\d{2})\*\*/g) || [];
    expect(frMatches.length).toBe(54);

    const validFrPrefixes = ['FR-AUTH', 'FR-ADM', 'FR-DON', 'FR-SRCH', 'FR-DNR', 'FR-STK', 'FR-REQ', 'FR-RPT'];
    frMatches.forEach((match) => {
      const idMatch = match.match(/FR-[A-Z]+-\d{2}/);
      expect(idMatch).toBeTruthy();
      const prefix = idMatch[0].split('-').slice(0, 2).join('-');
      expect(validFrPrefixes).toContain(prefix);
    });
  });

  test('contains exactly 19 Non-Functional Requirements matching SRS schema', () => {
    const nfrMatches = rtmContent.match(/\|\s*\d+\s*\|\s*\*\*(NFR-[A-Z]+-\d{2})\*\*/g) || [];
    expect(nfrMatches.length).toBe(19);

    const validNfrPrefixes = ['NFR-PERF', 'NFR-SAF', 'NFR-SEC', 'NFR-QUAL'];
    nfrMatches.forEach((match) => {
      const idMatch = match.match(/NFR-[A-Z]+-\d{2}/);
      expect(idMatch).toBeTruthy();
      const prefix = idMatch[0].split('-').slice(0, 2).join('-');
      expect(validNfrPrefixes).toContain(prefix);
    });
  });

  test('contains exactly 6 Business Rules matching SRS schema', () => {
    const brMatches = rtmContent.match(/\|\s*\d+\s*\|\s*\*\*(BR-0[1-6])\*\*/g) || [];
    expect(brMatches.length).toBe(6);
  });

  test('totals exactly 79 traced requirements', () => {
    const allMatches = rtmContent.match(/\|\s*\d+\s*\|\s*\*\*(FR|NFR|BR)-/g) || [];
    expect(allMatches.length).toBe(79);
  });

  test('all test case references match STP valid range (TC-01 through TC-37)', () => {
    const tcMatches = rtmContent.match(/TC-\d{2}/g) || [];
    expect(tcMatches.length).toBeGreaterThan(0);

    tcMatches.forEach((tc) => {
      const num = parseInt(tc.replace('TC-', ''), 10);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(37);
    });
  });
});
