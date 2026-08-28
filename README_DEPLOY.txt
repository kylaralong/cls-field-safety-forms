GITHUB / NETLIFY DEPLOYMENT

1. Replace the repository root contents with this package and commit to main.
2. Netlify will build automatically from GitHub.
3. Confirm the deploy log bundles netlify/functions/submit-swms.js.
4. Configure Netlify environment variables: RESEND_API_KEY, FORM_FROM_EMAIL and SUBMISSION_EMAIL.
5. Trigger a new production deploy after environment-variable changes.
6. Open the production site and hard refresh once. This build unregisters the service worker used by earlier test builds.
7. Complete one dummy submission and confirm a reference is returned, the record appears in Netlify Blobs, and email delivery succeeds.

Do not clear browser site data until any legacy locally queued submissions have been recovered or confirmed unnecessary.
