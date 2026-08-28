const { composeSwmsPdf } = require('./lib/compose-swms');
const logoBase64 = require('./lib/logo-base64');
const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const ISO_LINE = 'Camilleri Lifting Services Pty Ltd (CLS Cranes) — Quality, Environmental & WHS Management Systems certified to ISO 9001, ISO 14001 and ISO 45001.';

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  try {
    const d = JSON.parse(event.body || "{}");
    const key = process.env.RESEND_API_KEY, from = process.env.FORM_FROM_EMAIL;
    const to = process.env.SUBMISSION_EMAIL;
    if (!to) return { statusCode: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: "Submission recipient is not configured." }) };
    const now = new Date();
    const reference = `CLS-${now.toISOString().slice(0,10).replaceAll('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const safe = s => String(s ?? "").replace(/[&<>\"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const isImage = ([k, v]) => /^(signature_|image_)/.test(k) && String(v || '').startsWith('data:image/');
    const skipKeys = new Set(['submission_recipient', 'formDef']);
    const rows = Object.entries(d).filter(x => !isImage(x) && !skipKeys.has(x[0])).map(([k, v]) => `<tr><th style="text-align:left;padding:6px;border:1px solid #d7dce1;background:#f4f6f8">${safe(k)}</th><td style="padding:6px;border:1px solid #d7dce1">${safe(v)}</td></tr>`).join("");
    const images = Object.entries(d).filter(isImage).map(([k, v]) => `<div style="display:inline-block;vertical-align:top;margin:8px 12px 8px 0"><div style="font-weight:700;margin-bottom:4px;font-size:12px">${safe(k.replaceAll('_', ' '))}</div><img style="max-width:340px;max-height:150px;border:1px solid #d7dce1;background:#fff" src="${v}"></div>`).join("");

    // Build a real PDF replica of the completed record, matching the on-screen/print layout.
    let pdfBase64 = null, pdfFilename = null, pdfError = null;
    try {
      if (d.formDef) {
        const logoBytes = Buffer.from(logoBase64, 'base64');
        const pdfBytes = await composeSwmsPdf({ formDef: d.formDef, fields: d, logoBytes, isoLine: ISO_LINE });
        pdfBase64 = Buffer.from(pdfBytes).toString('base64');
        pdfFilename = `CLS_${(d.form || 'SWMS').replace(/[^A-Za-z0-9]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      }
    } catch (e) {
      pdfError = e.message; // don't block the email if PDF generation fails — the HTML record still carries the data
    }

    const meta = d.formDef && d.formDef.meta;
    const metaBlockHtml = meta ? `
      <table style="border-collapse:collapse;width:100%;max-width:900px;margin:10px 0 16px;font-size:12.5px">
        <tr><th style="text-align:left;padding:6px;border:1px solid #d7dce1;background:#fbfcfd;width:22%">Legal entity</th><td style="padding:6px;border:1px solid #d7dce1">${safe(meta.legalEntity)}</td><th style="text-align:left;padding:6px;border:1px solid #d7dce1;background:#fbfcfd;width:14%">Status</th><td style="padding:6px;border:1px solid #d7dce1">${safe(meta.status)}</td></tr>
        <tr><th style="text-align:left;padding:6px;border:1px solid #d7dce1;background:#fbfcfd">Document No.</th><td style="padding:6px;border:1px solid #d7dce1">${safe(meta.docNo)}</td><th style="text-align:left;padding:6px;border:1px solid #d7dce1;background:#fbfcfd">Revision</th><td style="padding:6px;border:1px solid #d7dce1">${safe(meta.revision)}</td></tr>
      </table>` : '';

    const body = {
      from, to: [to],
      subject: `CLS completed form — ${d.form || "Safety Form"} — ${d.site || d.project || "site TBC"} — ${reference}`,
      html: `<div style="font-family:Arial,sans-serif;color:#202428;max-width:900px">
        <div style="border-bottom:3px solid #173b5e;padding-bottom:10px;margin-bottom:4px">
          <div style="font-size:11px;font-weight:800;color:#66717a;letter-spacing:.04em">SAFE WORK METHOD STATEMENT — COMPLETED RECORD</div>
          <h2 style="margin:2px 0 0;color:#173b5e">${safe(d.form)}</h2>
        </div>
        ${metaBlockHtml}
        <table style="border-collapse:collapse;width:100%">${rows}</table>
        <h3 style="color:#173b5e;border-bottom:2px solid #f0a23a;padding-bottom:6px;margin-top:20px">Digital signatures / sketches</h3>
        ${images}
        ${pdfBase64 ? `<p style="font-size:13px;color:#18794e">A formatted PDF copy of this record is attached.</p>` : `<p style="font-size:12px;color:#b42318">PDF attachment could not be generated (${safe(pdfError || 'unknown error')}) — the data above is the complete record.</p>`}
        <p style="font-size:11.5px;color:#66717a;margin-top:18px">Generated from the CLS digital forms portal. Retain the final operational record in accordance with the CLS records process.</p>
      </div>`,
    };
    if (pdfBase64) {
      body.attachments = [{ filename: pdfFilename, content: pdfBase64 }];
    }

    // Store every successful submission centrally in Netlify Blobs first. Email is a notification/delivery layer, not the system of record.
    const store = getStore("cls-safety-submissions");
    const storedRecord = { ...d, reference, received_at: now.toISOString(), pdf_filename: pdfFilename, email_status: key && from ? "pending" : "not_configured" };
    await store.setJSON(`${reference}.json`, storedRecord);
    if (pdfBase64) await store.set(`${reference}.pdf`, Buffer.from(pdfBase64, "base64"), { metadata: { reference, form: String(d.form || "Safety Form") } });

    let emailed = false, emailWarning = null;
    if (key && from) {
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) emailed = true;
      else emailWarning = `Record stored, but email delivery returned ${r.status}.`;
    } else {
      emailWarning = "Record stored successfully. Email delivery is not configured yet.";
    }
    return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: true, reference, stored: true, emailed, pdfStored: !!pdfBase64, warning: emailWarning }) };
  } catch (e) {
    return { statusCode: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: e.message }) };
  }
};
