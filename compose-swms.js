const { PdfBuilder } = require('./pdf-builder');

// Builds a PDF replica of a completed SWMS record from the submitted payload.
// `formDef` is the client-side form definition (id, docTitle/name, meta, jobFields, docSections, steps, stopWork, references)
// `fields` is the flat FormData-derived field map from payload().
async function composeSwmsPdf({ formDef, fields, logoBytes, isoLine }) {
  const b = new PdfBuilder();
  const title = formDef.docTitle || formDef.name;
  await b.init({
    kicker: 'Safe Work Method Statement',
    title,
    statusLine: 'CONTROLLED DOCUMENT DETAILS · VERIFY CURRENT ISSUE BEFORE USE · Digital record',
    footerLine: isoLine || 'Camilleri Lifting Services Pty Ltd (CLS Cranes).',
    logoBytes,
  });

  if (formDef.meta) {
    const m = formDef.meta;
    b.metaGrid([
      [['Legal entity', m.legalEntity], ['Status', m.status]],
      [['Document No.', m.docNo], ['Revision', m.revision]],
      [['Work activity', m.workActivity], ['Approval', m.approval]],
      [['Effective date', m.effectiveDate], ['Controlled location', m.controlledLocation]],
      [['Primary basis', m.primaryBasis], [m.relatedLabel || 'Related document', m.relatedValue || '']],
      [['Use limitation', m.useLimitation], ['Review trigger', m.reviewTrigger]],
    ]);
  }

  b.heading('1. Job details');
  const jobFieldDefs = formDef.jobFields || [
    ['Client / Principal Contractor', 'client'], ['Project / Job No.', 'job'], ['Site / Location', 'site'],
    ['Date / Shift', 'date'], ['Supervisor', 'supervisor'], ['Contact', 'contact'],
    ['Plant / Vehicle / Asset', 'asset'], ['Operator / Driver', 'operator'], ['Permit / Plan Ref.', 'permit'],
    ['Emergency contact', 'emergency'], ['Additional site controls', 'hazards'], ['Review date / trigger', 'reviewTrigger'],
  ];
  b.fieldGrid(jobFieldDefs.map(([label, name]) => [label, fields[name] || '']));

  (formDef.docSections || []).forEach((sec, si) => {
    b.heading(sec.title, { size: 11 });
    if (sec.type === 'holdpoint') {
      const prefix = `hold${formDef.formIndex}_${si}`;
      const rows = sec.items.map((item, i) => ({
        item,
        answer: fields[`${prefix}_${i}`] || '',
        detail: fields[`${prefix}_${i}_detail`] || '',
      }));
      b.holdTable(rows, sec.options || ['Yes', 'No']);
    } else {
      b.bulletList(sec.items);
    }
  });

  if (formDef.steps) {
    b.heading('5. Safe work method — task steps, hazards and controls', { size: 11 });
    const rows = formDef.steps.map((r, n) => [r[0], r[1], r[2], r[3], r[4], !!fields['control_' + n] && fields['control_' + n] !== 'false']);
    b.riskTable(rows);
    if (fields.additional) { b.subheading('Additional controls / changed conditions'); b.paragraph(fields.additional); }
  }

  if (formDef.stopWork) {
    b.heading('6. Stop work / change control', { size: 11 });
    b.bulletList(formDef.stopWork);
  }

  b.heading('Pre-work acknowledgement', { size: 11 });
  b.bulletList([
    fields.ack1 ? 'Reviewed SWMS and site/task conditions — confirmed.' : 'Reviewed SWMS and site/task conditions — NOT confirmed.',
    fields.ack2 ? 'Licences/competencies/permits/configuration verified — confirmed.' : 'Licences/competencies/permits/configuration verified — NOT confirmed.',
    fields.ack3 ? 'Will stop work and reassess if conditions change — confirmed.' : 'Will stop work and reassess if conditions change — NOT confirmed.',
  ]);

  b.heading('7. Workgroup consultation and sign-on', { size: 11 });
  const signRows = [];
  for (let i = 0; i < 8; i++) {
    const name = fields['signerName_' + i], role = fields['signerRole_' + i];
    if (!name && !role) continue;
    const sigImg = await b.embedImageAuto(fields['signature_' + (i + 1)]);
    signRows.push({ name, role, time: fields['signerTime_' + i], resign: fields['signerResign_' + i], sigImg });
  }
  b.signTable(signRows);

  if (formDef.references) {
    b.heading('8. References / controlled issue', { size: 11 });
    b.bulletList(formDef.references);
    if (formDef.meta) {
      const m = formDef.meta;
      b.subheading('Document approval');
      b.metaGrid([
        [['Prepared by', '[Confirm preparer]'], ['Position', '[Confirm position]']],
        [['Approved by', m.approval], ['Approval date', m.effectiveDate]],
        [['Revision', m.revision], ['Next review', '[Confirm next review]']],
      ]);
    }
  }

  b.heading('Declaration', { size: 11 });
  b.paragraph(fields.declare ? 'Declaration confirmed by the completing person.' : 'Declaration NOT confirmed.');
  if (fields.completed) b.paragraph('Completed: ' + fields.completed);
  if (fields.recordNotes) b.paragraph('Notes: ' + fields.recordNotes);

  return b.finish();
}

module.exports = { composeSwmsPdf };
