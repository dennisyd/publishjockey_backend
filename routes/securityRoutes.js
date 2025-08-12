const express = require('express');
const router = express.Router();

// Minimal CSP report receiver. Do not echo user-provided data back to clients.
router.post('/csp-report', express.json({ type: ['application/csp-report', 'application/json'] }), (req, res) => {
  try {
    const report = req.body && (req.body['csp-report'] || req.body['csp_report'] || req.body);
    // Log a compact, safe subset
    const entry = {
      ts: new Date().toISOString(),
      'document-uri': report?.['document-uri'] || report?.document_uri,
      'violated-directive': report?.['violated-directive'] || report?.violated_directive,
      'effective-directive': report?.['effective-directive'] || report?.effective_directive,
      'blocked-uri': report?.['blocked-uri'] || report?.blocked_uri,
      'line-number': report?.['line-number'] || report?.line_number,
      'source-file': report?.['source-file'] || report?.source_file,
      'disposition': report?.disposition,
      'original-policy': report?.['original-policy'] ? '[omitted]' : undefined
    };
    console.warn('[CSP-REPORT]', JSON.stringify(entry));
  } catch (e) {
    console.error('Failed to parse CSP report', e);
  }
  // Always 204 to avoid revealing details
  res.status(204).end();
});

module.exports = router;


