/**
 * Script to set admin custom claim on a Firebase user
 *
 * Usage:
 *   node scripts/set-admin.js <user-email>
 *
 * Requires:
 *   - service-account.json in the project root
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize with service account
const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (e) {
  console.error('❌ Could not find service-account.json');
  console.log('Please download it from Firebase Console:');
  console.log('https://console.firebase.google.com/project/get-planted-db/settings/serviceaccounts/adminsdk');
  process.exit(1);
}

async function setAdminClaim(email) {
  try {
    // Get user by email
    const user = await admin.auth().getUserByEmail(email);
    console.log(`Found user: ${user.uid} (${user.email})`);

    // Set custom claims
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`✅ Successfully set admin claim for ${email}`);

    // Verify
    const updatedUser = await admin.auth().getUser(user.uid);
    console.log('Custom claims:', updatedUser.customClaims);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const email = process.argv[2];
if (!email) {
  console.log('Usage: node scripts/set-admin.js <user-email>');
  console.log('Example: node scripts/set-admin.js admin@planted.ch');
  process.exit(1);
}

setAdminClaim(email).then(() => process.exit(0));
