const { chromium } = require('playwright');

async function fetchFammaDhaw() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://famma-dhaw.com/', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    // Wait for the dynamic content to load (the zones data)
    await page.waitForSelector('.zone, .zone-item, [class*="zone"], [class*="zone-item"]', { 
      timeout: 30000 
    }).catch(() => console.log('Zone selector not found, continuing...'));

    // Wait a bit more for data to load
    await page.waitForTimeout(3000);

    // Get the fully rendered HTML
    const html = await page.content();
    
    // Also try to extract the zones data if it's in a specific format
    const zonesData = await page.evaluate(() => {
      const zones = document.querySelectorAll('.zone, .zone-item, [class*="zone"], [class*="zone-item"]');
      const data = [];
      zones.forEach(zone => {
        const text = zone.textContent?.trim();
        const classes = zone.className;
        if (text) data.push({ text, classes });
      });
      return data;
    });

    console.log('=== RENDERED HTML ===');
    console.log(html);
    console.log('\n=== EXTRACTED ZONES DATA ===');
    console.log(JSON.stringify(zonesData, null, 2));

    // Also save to file
    const fs = require('fs');
    fs.writeFileSync('famma-dhaw-rendered.html', html);
    fs.writeFileSync('famma-dhaw-zones.json', JSON.stringify(zonesData, null, 2));
    console.log('\nSaved to: famma-dhaw-rendered.html and famma-dhaw-zones.json');

  } catch (error) {
    console.error('Error:', error.message);
    // Still try to get what we have
    const html = await page.content();
    console.log('=== PARTIAL HTML ===');
    console.log(html);
  } finally {
    await browser.close();
  }
}

fetchFammaDhaw().catch(console.error);