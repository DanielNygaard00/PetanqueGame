import * as admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

// Use an environment variable for the service account path or credentials string
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (serviceAccountJson) {
  try {
    const cert = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(cert),
    });
  } catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e);
  }
} else if (serviceAccountPath) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
} else {
  // If no credentials, try default (useful if running in GCP environment)
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();
export { db, admin };
