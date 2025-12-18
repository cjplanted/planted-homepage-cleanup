#!/usr/bin/env node
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

admin.initializeApp({
  credential: admin.credential.cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function main() {
  const venues = await db.collection('venues').where('type', '==', 'restaurant').get();

  let withDishes = 0;
  let withoutDishes = 0;
  const zeroDishWithPlatforms = [];
  const zeroDishWithoutPlatforms = [];

  for (const doc of venues.docs) {
    const data = doc.data();
    const dishCount = await db.collection('dishes').where('venue_id', '==', doc.id).count().get();

    if (dishCount.data().count > 0) {
      withDishes++;
    } else {
      withoutDishes++;
      const platforms = (data.delivery_platforms || []).filter(p => p && p.url);

      const entry = {
        name: data.name,
        city: data.address?.city || 'unknown',
        platforms: platforms.map(p => p.platform)
      };

      if (platforms.length > 0) {
        zeroDishWithPlatforms.push(entry);
      } else {
        zeroDishWithoutPlatforms.push(entry);
      }
    }
  }

  console.log('=== FINAL STATUS ===');
  console.log('Total restaurants:', venues.docs.length);
  console.log('With dishes:', withDishes);
  console.log('Without dishes:', withoutDishes);
  console.log('');
  console.log('=== ZERO-DISH WITH PLATFORMS (' + zeroDishWithPlatforms.length + ') ===');
  zeroDishWithPlatforms.forEach(v => {
    console.log('-', v.name, '(' + v.city + ')', '[' + v.platforms.join(', ') + ']');
  });
  console.log('');
  console.log('=== ZERO-DISH WITHOUT PLATFORMS (' + zeroDishWithoutPlatforms.length + ') ===');
  zeroDishWithoutPlatforms.forEach(v => {
    console.log('-', v.name, '(' + v.city + ')');
  });
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
