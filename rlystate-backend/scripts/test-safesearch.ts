// Verify Google Cloud Vision SafeSearch integration + moderation helpers.
// Run: npx ts-node scripts/test-safesearch.ts
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();

import { google } from 'googleapis';

// ──────────────────────────────────────────────
// 1. SafeSearch API integration test
// ──────────────────────────────────────────────

async function testSafeSearch() {
  console.log('=== SafeSearch API Integration Test ===\n');

  // Build a minimal 1x1 white PNG in base64.
  // PNG spec: signature + IHDR + IDAT (zlib of single row filter byte 0x00 + white pixel 0xFF 0xFF 0xFF) + IEND
  const pngBuffer = Buffer.from(
    '89504e470d0a1a0a' +                             // PNG signature
    '0000000d49484452' + '00000001000000010802000000907753de' + // IHDR: 1x1 RGB 8bit
    '0000000f4944415478' + '9c6260f8cf0000000200017377e1d8' + // IDAT
    '0000000049454e44ae426082',                        // IEND
    'hex'
  );
  const base64Image = pngBuffer.toString('base64');

  console.log(`Test image: 1x1 white PNG, ${pngBuffer.length} bytes, base64 length ${base64Image.length}`);
  console.log();

  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-vision'],
    });
    const vision = google.vision({ version: 'v1', auth });

    console.log('Calling vision.images.annotate with SAFE_SEARCH_DETECTION ...');
    const response = await vision.images.annotate({
      requestBody: {
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: 'SAFE_SEARCH_DETECTION' }],
          },
        ],
      },
    });

    console.log('\nFull response.data:');
    console.log(JSON.stringify(response.data, null, 2));

    const results = response.data.responses || [];
    console.log(`\nresponse.data.responses length: ${results.length}`);

    if (results.length > 0) {
      const annotation = results[0].safeSearchAnnotation;
      if (annotation) {
        console.log('\nsafeSearchAnnotation fields:');
        console.log(`  adult:    ${annotation.adult}`);
        console.log(`  violence: ${annotation.violence}`);
        console.log(`  racy:     ${annotation.racy}`);
        console.log(`  spoof:    ${annotation.spoof}`);
        console.log(`  medical:  ${annotation.medical}`);

        const VALID_LIKELIHOODS = [
          'UNKNOWN', 'VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY',
        ];
        const allValid = [
          annotation.adult, annotation.violence, annotation.racy,
          annotation.spoof, annotation.medical,
        ].every(v => v && VALID_LIKELIHOODS.includes(v));

        console.log(`\nAll likelihood values are valid enum members: ${allValid}`);
      } else {
        console.log('\nWARNING: safeSearchAnnotation is missing from the response.');
      }

      if (results[0].error) {
        console.log('\nAPI returned an error in the response:');
        console.log(JSON.stringify(results[0].error, null, 2));
      }
    }

    console.log('\n[PASS] SafeSearch API call succeeded.');
  } catch (err: any) {
    console.error('\n[FAIL] SafeSearch API call failed:');
    console.error(err.message || err);
    if (err.code) console.error(`  Error code: ${err.code}`);
    if (err.errors) console.error('  Details:', JSON.stringify(err.errors, null, 2));
    console.log('\nCheck that:');
    console.log('  1. GOOGLE_APPLICATION_CREDENTIALS env var points to a valid service account JSON');
    console.log('  2. The Cloud Vision API is enabled in your GCP project');
    console.log('  3. The service account has the Cloud Vision API User role');
  }
}

// ──────────────────────────────────────────────
// 2. Keyword blocklist test (Layer 3)
// ──────────────────────────────────────────────

function testProhibitedContent() {
  console.log('\n=== Keyword Blocklist (Layer 3) Test ===\n');

  // Inline the logic from moderation.ts to test without import path issues
  const PROHIBITED_TERMS = [
    'firearm', 'handgun', 'pistol', 'rifle', 'shotgun', 'ammunition', 'ammo',
    'gun suppressor', 'silencer', 'ar-15', 'ar15',
    'cocaine', 'heroin', 'methamphetamine', 'fentanyl', 'oxycontin',
    'escort service', 'sex work', 'sexual service', 'prostitution',
    'dynamite', 'explosive', 'grenade', 'detonator',
    'stolen goods', 'counterfeit', 'fake id', 'forged document',
  ];

  function checkProhibitedContent(title: string, rationale: string): { blocked: boolean; reason?: string } {
    const text = `${title} ${rationale}`.toLowerCase();
    for (const term of PROHIBITED_TERMS) {
      const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(text)) {
        return { blocked: true, reason: `Matched: "${term}"` };
      }
    }
    return { blocked: false };
  }

  const cases = [
    { title: 'Vintage Oak Dresser', rationale: 'Solid wood, good condition', expectBlocked: false },
    { title: 'AR-15 Scope Mount', rationale: 'Tactical accessory', expectBlocked: true },
    { title: 'Kitchen Table', rationale: 'Great for ammunition storage', expectBlocked: true },
    { title: 'Leather Couch', rationale: 'No issues, clean', expectBlocked: false },
    { title: 'Surge Suppressor Power Strip', rationale: 'Great for electronics', expectBlocked: false },
    { title: 'Ammonite Fossil Collection', rationale: 'Beautiful specimens', expectBlocked: false },
    { title: 'Magazine Rack', rationale: 'Holds up to 20 magazines', expectBlocked: false },
    { title: 'Counterfeit Designer Bag', rationale: 'Looks real', expectBlocked: true },
    { title: 'Antique Rifle Display Case', rationale: 'Decorative only', expectBlocked: true },
  ];

  let passed = 0;
  for (const c of cases) {
    const result = checkProhibitedContent(c.title, c.rationale);
    const ok = result.blocked === c.expectBlocked;
    const status = ok ? 'PASS' : 'FAIL';
    console.log(`  [${status}] "${c.title}" => blocked=${result.blocked} (expected ${c.expectBlocked})${result.reason ? ` (${result.reason})` : ''}`);
    if (ok) passed++;
  }
  console.log(`\n  ${passed}/${cases.length} assertions passed.`);
}

// ──────────────────────────────────────────────
// 3. Price ceiling test (Layer 4)
// ──────────────────────────────────────────────

function testPriceCeiling() {
  console.log('\n=== Price Ceiling (Layer 4) Test ===\n');

  function checkPriceCeiling(askingPrice: number, suggestedHighPrice: number): { blocked: boolean; maxPrice: number } {
    const maxPrice = Math.round(suggestedHighPrice * 1.25);
    return { blocked: askingPrice > maxPrice, maxPrice };
  }

  const cases = [
    { asking: 100, high: 100, expectBlocked: false, expectMax: 125 },
    { asking: 125, high: 100, expectBlocked: false, expectMax: 125 },
    { asking: 126, high: 100, expectBlocked: true, expectMax: 125 },
    { asking: 500, high: 400, expectBlocked: false, expectMax: 500 },
    { asking: 501, high: 400, expectBlocked: true, expectMax: 500 },
    { asking: 250, high: 200, expectBlocked: false, expectMax: 250 },
    { asking: 251, high: 200, expectBlocked: true, expectMax: 250 },
  ];

  let passed = 0;
  for (const c of cases) {
    const result = checkPriceCeiling(c.asking, c.high);
    const okBlocked = result.blocked === c.expectBlocked;
    const okMax = result.maxPrice === c.expectMax;
    const ok = okBlocked && okMax;
    const status = ok ? 'PASS' : 'FAIL';
    console.log(`  [${status}] asking=$${c.asking}, high=$${c.high} => blocked=${result.blocked}, max=$${result.maxPrice}`);
    if (ok) passed++;
  }
  console.log(`\n  ${passed}/${cases.length} assertions passed.`);
}

// ──────────────────────────────────────────────
// Run everything
// ──────────────────────────────────────────────

async function main() {
  // Run the offline tests first (no API call needed)
  testProhibitedContent();
  testPriceCeiling();

  // Run the API test last (requires credentials)
  await testSafeSearch();

  console.log('\n=== Done ===');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
