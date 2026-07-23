import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

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

    console.log(`✅ Extracted ${parsedZones.length} zones`);

    // Aggregate by governorate to match original app format (24 governorates)
const govMapping = {
      'ariana': ['ariana', 'ennasr', 'ennkhilette', 'menzah', 'soukra', 'mnihla', 'kalâat', 'raoued', 'riad el andalous', 'sidi thabet', 'soukra park', 'cité ennasr', 'jardins', 'el menzah', 'nouvelle ariana', 'petite ariana', 'chotrana', 'cité el ghazela', 'cité el wahat', 'cité ennahli', 'cité ennour', 'cité ennozha', 'cité essahafa', 'cité ettadhamen', 'cité ezzouhour', 'cité hédi nouira', 'cité ibn khaldoun', 'cité ibn sina', 'cité intilaka', 'cité jaafar', 'gammarth', 'gammarth supérieur', 'gammarth village', 'ghedir el golla', 'raoued', 'souq el asr'],
      'ben arous': ['ben arous', 'bennane', 'bir el bey', 'bir kassâa', 'borj cédria', 'bougarnine', 'boumhel', 'chebedda', 'el mhamdia', 'el mourouj', 'ezzahra', 'hammam lif', 'khelidia', 'mégrine', 'mghira', 'mornag', 'naassen', 'nouvelle medina', 'radès', 'mourouj', 'fouchana', 'hammam chott', 'boumhal', 'borj el amri', 'oued gueriana', 'el jedaida', 'mornaguia', 'sidi hessine', 'cité el faouz', 'essaidia', 'borj chakir', 'bhar lazreg', 'borj baccouche', 'borj louzir', 'borj touil'],
      'manouba': ['chaouat', 'douar hicher', 'el jedaida', 'ksar saïd', 'manouba', 'mornaguia', 'oued ellil', 'oued gueriana', 'sanhaja', 'sidi amor', 'tebourba', 'denden', 'borj el amri', 'oued gueriana', 'cité el khadra', 'cité olympique', 'el menzah', 'la marsa', 'la goulette', 'centre urbain nord', 'centre-ville / lafayette', 'charguia', 'mutuelleville', 'belvédère', 'montfleury', 'mellassine', 'cité el faouz', 'hafsia', 'halfaouine', 'jbal jloud', 'jbel lahmar', 'khaznadar', 'l\'aouina', 'mellassine', 'messadine', 'nouvelle medina', 'ras tabia', 'riadh el andalous', 'rouhia', 'souk jedid', 'zaouiet djedidi'],
      'béja': ['béja', 'medjez el-bab', 'nefza', 'téboursouk', 'testour', 'thibar', 'amdoun'],
      'bizerte': ['aïn mariem', 'bizerte', 'cap zbib', 'corniche', 'el alia', 'el bhira', 'errimel', 'ghar el melh', 'jarzouna', 'mateur', 'menzel abderrahmen', 'menzel bourguiba', 'metline', 'raf raf', 'ras jebel', 'sejnane', 'sidi salem', 'sounine', 'tinja', 'touibia', 'utique', 'menzel jemil'],
      'gabès': ['el hamma', 'gabès sud', 'gabès ville', 'mareth', 'matmata', 'métouia', 'oudhref', 'tbelbou', 'zrig', 'ghannouch', 'el guettar'],
      'gafsa': ['el guettar', 'gafsa ville', 'mdhilla', 'métlaoui', 'redeyef', 'sbeïtla', 'moularès', 'redyef'],
      'jendouba': ['aïn draham', 'bou salem', 'ghardimaou', 'jendouba ville', 'tabarka', 'ferdjaoua', 'oued melliz'],
      'kairouan': ['bou hajla', 'hajeb el ayoun', 'kairouan ville', 'oueslatia', 'sbikha', 'haffouz', 'nasrallah'],
      'kasserine': ['fériana', 'kasserine ville', 'sbeïtla', 'sbiba', 'thala', 'foussana', 'sbeitla'],
      'kébili': ['douz', 'jemna', 'kébili ville', 'soukh lahad', 'souq lahad', 'faouar', 'rzeg'],
      'le kef': ['dahmani', 'jerissa', 'le kef ville', 'le sers', 'tajroun', 'tajrouna', 'kalâat snan', 'kalaat senan', 'souk lahad', 'tajerouine'],
      'mahdia': ['chebba', 'el jem', 'ksour essef', 'mahdia ville', 'mellouleche', 'rejiche', 'salakta', 'sidi alouane', 'souassi', 'téboulba', 'touza', 'zeramdine', 'ksour essef', 'bou merdes', 'sidi alouene', 'chott meriem', 'melloulèche', 'messadine', 'souk jedid', 'sidi fraj'],
      'médenine': ['ben guerdane', 'béni khedache', 'boughrara', 'djerba aghir', 'djerba ajim', 'djerba el may', 'djerba erriadh', 'djerba guellala', 'djerba houmt souk', 'djerba mezraya', 'djerba midoun', 'djerba robbana', 'djerba sedouikech', 'médenine ville', 'zarzis', 'sidi makhlouf', 'boughrara', 'ajim', 'erriadh', 'houmt souk', 'midoun', 'sedouikech'],
      'monastir': ['bembla', 'béni hassen', 'bouhjar', 'jemmal', 'khniss', 'ksar hellal', 'ksibet el mediouni', 'lamta', 'menzel kamel', 'moknine', 'monastir ville', 'ouardanine', 'sayada', 'téboulba', 'touza', 'zeramdine', 'sahline', 'ksibet thrayet', 'skhira'],
      'nabeul': ['azmour', 'béni khalled', 'bir bouregba', 'bir challouf', 'bou argoub', 'cité afh', 'dar allouch', 'dar chaâbane', 'el haouaria', 'el mida', 'grombalia', 'hammam ghezaz', 'hammamet', 'hammamet nord', 'kélibia', 'kerker', 'kerkouane', 'korba', 'maâmoura', 'menzel horr', 'menzel temime', 'mrezga', 'nabeul ville', 'oued souhil', 'sidi daoud', 'soliman', 'takelsa', 'zaouiet jedidi', 'tazarka', 'bni khiar', 'el somâa'],
      'sfax': ['agareb', 'bir ali ben khalifa', 'bouzayène', 'chaffar', 'chihia', 'cité chaker', 'cité el bahri', 'cité el habib', 'cité el ons', 'cité jardin', 'el amra', 'el ghraiba', 'jebeniana', 'kerkennah', 'mahres', 'route de gremda', 'route de l\'aéroport', 'route de mahdia', 'route de saltnia', 'route de sidi mansour', 'route de sokra', 'route de teniour', 'route de tunis', 'route el aïn', 'route kaïd mohamed', 'route lafrane', 'route menzel chaker', 'route mharza', 'route tbolbi', 'sakiet eddaïer', 'sakiet ezzit', 'sfax ville', 'sidi mansour', 'thyna', 'hencha', 'graiba', 'menzel chaker', 'mharza', 'tbolbi', 'el aïn', 'kaid mohamed', 'lafrane', 'sidi salah', 'skhira', 'sidi ali ben aoun'],
      'sidi bouzid': ['bir el hafey', 'cebbala', 'jilma', 'mazouna', 'meknassy', 'ouled haffouz', 'regueb', 'sidi bouzid ville', 'sidi ali ben oun', 'mezzouna', 'ouled haffez', 'bir el hafey'],
      'siliana': ['bousalem', 'gaâfour', 'kesra', 'makthar', 'rohia', 'siliana ville', 'kesra', 'el krib', 'gafour', 'rohia', 'makther'],
      'sousse': ['akouda', 'bouficha', 'chott mariem', 'enfidha', 'hammam sousse', 'hergla', 'kalâa kebira', 'kalâa seghira', 'kondar', 'msaken', 'sidi bou ali', 'sidi el heni', 'sousse ville', 'zaouiet ksiba', 'khézama', 'khezama ouest', 'jawhara', 'sahloul', 'port el kantaoui', 'enfidha hergla', 'sidi abdelhamid', 'bou ali', 'souk jedid', 'sidi fraj'],
      'tataouine': ['bir lahmar', 'dehiba', 'ghomrassen', 'remada', 'smâr', 'tataouine ville', 'bir mchergua', 'dehiba', 'remada', 'ghomrassen'],
      'tozeur': ['degache', 'hazoua', 'nefta', 'tamaghza', 'tozeur ville', 'tamerza', 'nefta', 'hazoua', 'tamaghza'],
      'tunis': ['ariana', 'bardo', 'belvédère', 'carthage', 'cite el khadra', 'cite olympique', 'djebel jelloud', 'el menzah', 'el ouardia', 'etadhamen', 'ezzahrouni', 'gorjani', 'hels', 'incline', 'jebel jeloud', 'kharrouba', 'la goulette', 'la marsa', 'les berges du lac', 'le bardo', 'le kram', 'les jardins de carthage', 'manar', 'montplaisir', 'mornag', 'omrane', 'sidi hassine', 'sijoumi', 'tunis ville', 'bardo', 'el omrane', 'sijoumi', 'el kabaria', 'djebel jelloud', 'aïn zaghouan', 'aïn zaghouan nord', 'bouchoucha', 'bouhsina', 'charguia', 'cité borj turki', 'cité el khadra / olympique', 'cité el wahat', 'cité ennahli', 'cité ennour', 'cité ennozha', 'cité essahafa', 'cité ettadhamen', 'cité ezzouhour', 'cité hédi nouira', 'cité ibn khaldoun', 'cité ibn sina', 'cité intilaka', 'cité jaafar', 'dar fadhal', 'el hraïria', 'essaidia', 'gammarth', 'gammarth supérieur', 'gammarth village', 'ghedir el golla', 'hafsia', 'halfaouine', 'jbal jloud', 'jbel lahmar', 'khaznadar', 'l\'aouina', 'mellassine', 'melloulèche', 'messadine', 'montfleury', 'mutuelleville / belvédère', 'médina', 'nouvelle médina', 'ras tabia', 'riadh el andalous', 'rouhia', 'souk jedid', 'souk lahad', 'tajerouine', 'zaouiet djedidi', 'zaouiet sousse', 'centre urbain nord', 'centre-ville / lafayette', 'charguia 1', 'charguia 2', 'chotrana 1', 'chotrana 2', 'chotrana 3', 'alain savary', 'bab el khadhra', 'bab jdid', 'bab saadoun', 'bab souika', 'bellevue', 'berges du lac', 'kheireddine', 'carthage amilcar', 'carthage byrsa', 'carthage dermech', 'carthage hannibal', 'carthage mohamed ali', 'carthage présidence', 'carthage salammbô', 'carthage yasmina', 'cité el khadra / olympique', 'cité el wahat (el agba)', "cité el wahat (l'aouina)", 'cité ettahrir', 'cité ezzouhour', 'cité ibn khaldoun', 'cité ibn sina', 'el hraïria', 'el menzah 1', 'el menzah 4', 'el omrane', 'el omrane supérieur', 'el ouardia / kabaria', 'ezzahrouni', 'gammarth', 'gammarth supérieur', 'gammarth village', 'ghedir el golla', 'hafsia', 'halfaouine', 'jardins de carthage', 'jbal jloud', 'jbel lahmar', 'bhar lazreg', 'borj chakir', 'cité el faouz'],
      'zaghouan': ['bir mcherga', 'el fahs', 'nadhour', 'saouaf', 'zaghouan ville', 'hammam zriba', 'zriba', 'saouaf', 'nadhour']
    };

    // Aggregate zones by governorate
    const govData = {};
    parsedZones.forEach(zone => {
      let matchedGov = null;
      const zoneNameLower = zone.name.toLowerCase();
      
      for (const [gov, zones] of Object.entries(govMapping)) {
        if (zones.some(z => zoneNameLower.includes(z.toLowerCase()))) {
          matchedGov = gov;
          break;
        }
      }
      
      if (!matchedGov) {
        // Try direct match
        for (const [gov, zones] of Object.entries(govMapping)) {
          if (zoneNameLower.includes(gov)) {
            matchedGov = gov;
            break;
          }
        }
      }

      if (!matchedGov) {
        matchedGov = 'unknown';
      }

      if (!govData[matchedGov]) {
        govData[matchedGov] = { on: 0, off: 0, zones: [] };
      }
      govData[matchedGov].on += zone.gridVotes;
      govData[matchedGov].off += zone.lightVotes;
      govData[matchedGov].zones.push(zone);
    });

    // Create output in original app format
    const outputZones = Object.entries(govData).map(([gov, data]) => {
      const govName = gov.charAt(0).toUpperCase() + gov.slice(1).replace('-', ' ');
      return {
        slug: gov.toLowerCase().replace(/ /g, '-'),
        name: govName,
        gov: govName,
        on_count: data.on,
        off_count: data.off,
        last_report: new Date().toISOString()
      };
    });

    const output = {
      scraped_at: new Date().toISOString(),
      engine: 'Playwright Chromium (famma-dhaw.com)',
      status: 'success',
      total_zones: outputZones.length,
      zones: outputZones
    };

    // Save to src/data/scraped_live.json (original app location)
    const dataPath = path.resolve('src/data/scraped_live.json');
    fs.writeFileSync(dataPath, JSON.stringify(output, null, 2));
    console.log(`💾 Saved to ${dataPath}`);

    // Also save detailed zones for reference
    const detailedPath = path.resolve('src/data/scraped_detailed.json');
    fs.writeFileSync(detailedPath, JSON.stringify({
      scraped_at: new Date().toISOString(),
      total_detailed_zones: parsedZones.length,
      zones: parsedZones
    }, null, 2));
    console.log(`💾 Saved detailed data to ${detailedPath}`);

    const powerOff = parsedZones.filter(z => z.status === 'power-off').length;
    const powerOn = parsedZones.filter(z => z.status === 'power-on').length;
    console.log(`⚡ Power ON: ${powerOn} | ⛔ Power OFF: ${powerOff}`);
    console.log(`📍 Aggregated to ${outputZones.length} governorates`);

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