import { chromium } from 'playwright';
import fs from 'fs';

async function fetchFammaDhaw() {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();

  try {
    await page.goto('https://famma-dhaw.com/', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    await page.waitForSelector('.zone, .zone-item, [class*="zone"]', { 
      timeout: 30000 
    }).catch(() => console.log('Zone selector not found, continuing...'));

    await page.waitForTimeout(3000);

    const html = await page.content();
    
    const zonesData = await page.evaluate(() => {
      const zones = document.querySelectorAll('.zone, .zone-item, [class*="zone"]');
      const data = [];
      zones.forEach(zone => {
        const text = zone.textContent?.trim();
        const classes = zone.className;
        if (text) data.push({ text, classes });
      });
      return data;
    });

    const parsedZones = zonesData.map(zone => {
      const match = zone.text.match(/(.+?)🔌\s*(\d+)\s*·\s*💡\s*(\d+)\s*·\s*il y a\s*(.+?)(✅|⛔)\s*(Ça marche|Coupé)/);
      if (match) {
        const [, name, gridVotes, lightVotes, timeAgo, statusIcon, status] = match;
        return {
          name: name.trim(),
          gridVotes: parseInt(gridVotes),
          lightVotes: parseInt(lightVotes),
          lastUpdate: timeAgo.trim(),
          status: statusIcon === '✅' ? 'power-on' : 'power-off',
          statusLabel: status,
          rawClasses: zone.classes
        };
      }
      return null;
    }).filter(Boolean);

    const output = {
      timestamp: new Date().toISOString(),
      source: 'https://famma-dhaw.com/',
      totalZones: parsedZones.length,
      zones: parsedZones
    };

    fs.writeFileSync('famma-dhaw-data.json', JSON.stringify(output, null, 2));
    fs.writeFileSync('famma-dhaw-rendered.html', html);
    
    console.log(`✅ Extracted ${parsedZones.length} zones`);
    console.log(`📅 Timestamp: ${output.timestamp}`);
    
    const powerOff = parsedZones.filter(z => z.status === 'power-off').length;
    const powerOn = parsedZones.filter(z => z.status === 'power-on').length;
    console.log(`⚡ Power ON: ${powerOn} | ⛔ Power OFF: ${powerOff}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

fetchFammaDhaw().catch(e => {
  console.error(e);
  process.exit(1);
});