// C11 Report Service — Export Utilities (SAD 3.4, 4.3, SRS 5.8, FR-RPT-05, TC-10)
// Supports CSV (RFC 4180) and standard PDF-1.4 generation without external dependencies.

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapePdfText(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// FR-RPT-05: CSV Export
function exportToCsv(reportType, reportData) {
  const lines = [];

  if (reportType === 'stock') {
    lines.push(['Blood Group', 'Available', 'Reserved', 'Issued', 'Expired', 'Discarded', 'Earliest Expiry', 'Total Units'].map(escapeCsvCell).join(','));
    const rows = reportData.aggregates || [];
    for (const r of rows) {
      lines.push([
        r.bloodGroup,
        r.available,
        r.reserved,
        r.issued,
        r.expired,
        r.discarded,
        r.earliestExpiry || 'None',
        r.total,
      ].map(escapeCsvCell).join(','));
    }
  } else if (reportType === 'donation') {
    lines.push(['Donation ID', 'Donor ID', 'Blood Group', 'Volume (ml)', 'Collection Date', 'Screening Result', 'Donation Status'].map(escapeCsvCell).join(','));
    const rows = reportData.records || [];
    for (const r of rows) {
      lines.push([
        r.donationId,
        r.donorId,
        r.bloodGroup,
        r.volumeMl,
        r.collectionDate,
        r.screeningResult,
        r.donationStatus,
      ].map(escapeCsvCell).join(','));
    }
  } else if (reportType === 'request') {
    lines.push(['Request ID', 'Hospital Name', 'Patient Name', 'Blood Group', 'Units', 'Priority', 'Status', 'Request Date', 'Decision Date'].map(escapeCsvCell).join(','));
    const rows = reportData.records || [];
    for (const r of rows) {
      lines.push([
        r.requestId,
        r.hospitalName,
        r.patientName,
        r.bloodGroup,
        r.units,
        r.priority,
        r.status,
        r.requestDate,
        r.decisionDate || 'Pending',
      ].map(escapeCsvCell).join(','));
    }
  }

  return lines.join('\r\n');
}

// FR-RPT-05, TC-10: Standard PDF-1.4 Generation
function exportToPdf(reportType, reportData) {
  const typeTitles = {
    stock: 'Blood Bank - Stock Inventory Report (TC-10)',
    donation: 'Blood Bank - Voluntary Donation Log Report',
    request: 'Blood Bank - Hospital Requisition Report (TC-32)',
  };

  const title = typeTitles[reportType] || 'Blood Bank Management Report';
  const timestamp = reportData.generatedAt || new Date().toISOString();

  const textLines = [];
  textLines.push(`Report Type: ${reportType.toUpperCase()} | Generated: ${timestamp.slice(0, 19).replace('T', ' ')}`);

  // Criteria summary
  const crit = reportData.criteria || {};
  const criteriaParts = [];
  if (crit.from) criteriaParts.push(`From: ${crit.from}`);
  if (crit.to) criteriaParts.push(`To: ${crit.to}`);
  if (crit.bloodGroup) criteriaParts.push(`Group: ${crit.bloodGroup}`);
  if (crit.status) criteriaParts.push(`Status: ${crit.status}`);
  textLines.push(`Filter Criteria: ${criteriaParts.length > 0 ? criteriaParts.join(' | ') : 'All Records'}`);
  textLines.push('------------------------------------------------------------------------------------------------------------------------');

  if (reportType === 'stock') {
    textLines.push('Group   | Available | Reserved | Issued | Expired | Discarded | Earliest Expiry | Total');
    textLines.push('------------------------------------------------------------------------------------------------------------------------');
    const rows = reportData.aggregates || [];
    for (const r of rows) {
      const g = (r.bloodGroup || '').padEnd(7);
      const av = String(r.available || 0).padStart(9);
      const res = String(r.reserved || 0).padStart(8);
      const iss = String(r.issued || 0).padStart(6);
      const exp = String(r.expired || 0).padStart(7);
      const disc = String(r.discarded || 0).padStart(9);
      const ear = (r.earliestExpiry || 'None').padEnd(15);
      const tot = String(r.total || 0).padStart(5);
      textLines.push(`${g} | ${av} | ${res} | ${iss} | ${exp} | ${disc} | ${ear} | ${tot}`);
    }
  } else if (reportType === 'donation') {
    textLines.push(`Summary: Total Donations = ${reportData.summary?.totalDonations || 0} | Total Volume = ${reportData.summary?.totalVolumeMl || 0} ml`);
    textLines.push('------------------------------------------------------------------------------------------------------------------------');
    textLines.push('Donation ID    | Donor ID     | Group | Volume | Date       | Screening | Status');
    textLines.push('------------------------------------------------------------------------------------------------------------------------');
    const rows = reportData.records || [];
    for (const r of rows.slice(0, 30)) {
      const did = (r.donationId || '').padEnd(14);
      const dnr = (r.donorId || '').padEnd(12);
      const bg = (r.bloodGroup || '').padEnd(5);
      const vol = (`${r.volumeMl || 0}ml`).padEnd(6);
      const dt = (r.collectionDate || '').padEnd(10);
      const scr = (r.screeningResult || '').padEnd(9);
      const st = (r.donationStatus || '');
      textLines.push(`${did} | ${dnr} | ${bg} | ${vol} | ${dt} | ${scr} | ${st}`);
    }
  } else if (reportType === 'request') {
    textLines.push(`Summary: Total Requests = ${reportData.summary?.totalRequests || 0} | Total Units Demanded = ${reportData.summary?.totalUnitsRequested || 0}`);
    textLines.push('------------------------------------------------------------------------------------------------------------------------');
    textLines.push('Request ID     | Hospital / Clinic       | Group | Units | Priority | Status    | Req Date');
    textLines.push('------------------------------------------------------------------------------------------------------------------------');
    const rows = reportData.records || [];
    for (const r of rows.slice(0, 30)) {
      const rid = (r.requestId || '').padEnd(14);
      const hosp = (r.hospitalName || '').slice(0, 23).padEnd(23);
      const bg = (r.bloodGroup || '').padEnd(5);
      const un = String(r.units || 0).padStart(5);
      const prio = (r.priority || '').padEnd(8);
      const st = (r.status || '').padEnd(9);
      const dt = (r.requestDate || '');
      textLines.push(`${rid} | ${hosp} | ${bg} | ${un} | ${prio} | ${st} | ${dt}`);
    }
  }

  // Construct PDF stream content
  let streamContent = 'BT\n/F1 14 Tf\n50 740 Td\n(' + escapePdfText(title) + ') Tj\nET\n';
  let y = 715;

  for (const line of textLines.slice(0, 42)) {
    const isHeader = line.startsWith('---') || line.startsWith('Report Type') || line.startsWith('Summary');
    const fontSize = isHeader ? 8 : 8;
    streamContent += `BT\n/F2 ${fontSize} Tf\n50 ${y} Td\n(${escapePdfText(line)}) Tj\nET\n`;
    y -= 14;
  }

  // Build standard PDF objects
  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj');
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj');
  objects.push('6 0 obj\n<< /Length ' + Buffer.byteLength(streamContent) + ' >>\nstream\n' + streamContent + '\nendstream\nendobj');

  let body = '%PDF-1.4\n';
  const xrefOffsets = [0];

  for (const obj of objects) {
    xrefOffsets.push(Buffer.byteLength(body));
    body += obj + '\n';
  }

  const xrefStart = Buffer.byteLength(body);
  body += 'xref\n0 ' + (objects.length + 1) + '\n';
  body += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    body += String(xrefOffsets[i]).padStart(10, '0') + ' 00000 n \n';
  }

  body += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n';
  body += 'startxref\n' + xrefStart + '\n%%EOF';

  return Buffer.from(body);
}

module.exports = {
  exportToCsv,
  exportToPdf,
};
