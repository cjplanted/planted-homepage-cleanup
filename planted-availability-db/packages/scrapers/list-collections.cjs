const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
try {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'get-planted-db'
  });
} catch (e) {
  // App already initialized
}

const db = getFirestore();

(async () => {
  try {
    const collections = await db.listCollections();
    console.log('Available collections:');
    for (const collection of collections) {
      const count = await db.collection(collection.id).count().get();
      console.log(`  ${collection.id}: ${count.data().count} docs`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
