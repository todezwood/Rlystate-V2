import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// On Cloud Run, applicationDefault() uses the attached service account automatically.
// Locally, set GOOGLE_APPLICATION_CREDENTIALS to a service account key JSON path,
// or run `gcloud auth application-default login` once.
initializeApp({ credential: applicationDefault() });

export const firebaseAuth = getAuth();
