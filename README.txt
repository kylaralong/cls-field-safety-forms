CLS CRANES DIGITAL SAFETY FORMS - NETLIFY MASTER

STATUS
CLS has confirmed all documents/forms in this portal are approved for operational use. The portal displays APPROVED CONTROLLED FORM. Maintain formal document-control metadata in the CLS controlled document register.

DEPLOY TO NETLIFY
1. Drag this whole folder (or the supplied ZIP) into Netlify, or deploy from Git.
2. This build has a package.json declaring the pdf-lib dependency used to generate PDF attachments server-side. Netlify runs `npm install` automatically as part of its build — no manual step needed, but if deploying via drag-and-drop rather than Git, confirm the Netlify deploy log shows the dependency installing before the function bundles (Site configuration > Build & deploy > check deploy log).
3. In Netlify > Site configuration > Environment variables set:
   RESEND_API_KEY = your Resend API key
   FORM_FROM_EMAIL = a sender address on a domain verified with Resend (for example forms@clscranes.com.au once verified)
4. TESTING: the Netlify function is hard-set to send every completed submission to ky@kylarity.com.au. Change the server-side recipient only after acceptance testing and CLS authorisation for production routing.
5. Deploy over HTTPS and complete a live test from both a phone and a computer before operational rollout.

PDF GENERATION
- On submit, the Netlify function now generates a real PDF replica of the completed record (document-control header, all sections, risk table, signatures) using pdf-lib — no headless browser required, so it's fast and reliable in the serverless environment.
- The PDF is attached to the email alongside the polished HTML summary. If PDF generation fails for any reason, the email still sends with the full data in the HTML body and a note explaining the attachment is missing — a submission is never silently lost.
- Document identity fields (Document No., Approved by, Effective date, etc.) currently show placeholder text like "[Confirm register no.]" until CLS's real controlled-document numbers are supplied — these appear on both the on-screen form and the generated PDF, so they're impossible to miss before go-live.

FIELD WORKFLOW
- Complete and sign on phone, tablet or computer.
- Save Draft stores the current record on that device.
- Save PDF opens the device/browser PDF print flow and sets a CLS-style document filename from the form/job/asset/date where the browser supports title-based filenames.
- Submit sends the signed record to ky@kylarity.com.au.
- If offline, Submit queues the record on that device and retries after connectivity returns.

OFFLINE / PWA
- Open the deployed portal once online. The service worker caches the app shell for later offline use.
- Add to Home Screen for an app-like launch experience.
- Drafts and queued submissions use browser local storage. Browser/device data can be cleared, so local storage is not a permanent records repository.
- Email delivery always requires internet connectivity.

PRODUCTION CHECKS BEFORE GO-LIVE
- Verify the Resend sending domain and FORM_FROM_EMAIL.
- Complete and submit every form type once on iPhone/Android and desktop.
- Confirm email receipt at ky@kylarity.com.au, signatures, field content and subject naming.
- Confirm Save PDF layout on the browsers CLS actually uses.
- Confirm CLS document register metadata and retention/storage process for submitted records.
