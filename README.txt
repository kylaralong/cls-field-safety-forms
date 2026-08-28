CLS CRANES SAFETY & OPERATIONS PORTAL — PRODUCTION SOURCE

PURPOSE
Git-connected production source for the CLS Cranes digital safety forms portal.

DEPLOYMENT
- Production branch: main
- Netlify config: netlify.toml
- Functions directory: netlify/functions
- Publish directory: repository root
- Do not use Netlify Drop for routine production updates once Git deployment is connected.

REQUIRED NETLIFY ENVIRONMENT VARIABLES
RESEND_API_KEY       Resend API key. Store as a Netlify secret.
FORM_FROM_EMAIL      Verified Resend sender, e.g. CLS Cranes Forms <forms@clscranes.online> once verified.
SUBMISSION_EMAIL     Production recipient for completed form notifications. TBC / verify before operational rollout.

RECORD HANDLING
The submit-swms function stores the submitted JSON record and generated PDF in Netlify Blobs before attempting email delivery. Email is a notification/delivery layer, not the sole record location.

DOCUMENT CONTROL
Form definitions currently contain document-control metadata requiring verification, including placeholders such as [Confirm register no.], [Confirm approver] and [Confirm effective date]. Do not represent a form as an approved controlled issue until its metadata has been verified against the CLS controlled document register.

BROWSER CACHE RESET
Earlier builds registered a service worker. This production build no longer ships sw.js and index.html actively unregisters earlier service workers and clears their caches on load. Draft/recovery records in localStorage are not intentionally cleared by this cache reset.

SUBMISSION STATES
- SUBMITTED means the Netlify function returned success after central storage.
- NOT SUBMITTED means CLS has not received the record. A local recovery copy may be retained on that device.
- Draft Saved means a draft exists only in that browser/device until submitted.

BEFORE OPERATIONAL ROLLOUT
- Verify document numbers, revisions, approval/effective dates and controlled locations.
- Configure and verify all three Netlify environment variables above.
- Verify Resend domain authentication.
- Submit each form type from representative mobile and desktop browsers.
- Confirm central Blob record, generated PDF, email delivery, signatures and PDF layout.
- Confirm access control, record retention and authorised production routing before processing live operational/personnel information.
