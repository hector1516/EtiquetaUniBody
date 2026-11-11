const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:1420');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:\\OpenCodeProyects\\ECCSAProyects\\Hussmann EtiquetaUnibody\\screenshots\\dashboard.png', fullPage: false });
  // navigate tabs via sidebar buttons
  for (const name of ['Diseñador', 'Historial', 'Configuración']) {
    await page.click(`button:has-text("${name}")`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `C:\\OpenCodeProyects\\ECCSAProyects\\Hussmann EtiquetaUnibody\\screenshots\\${name.toLowerCase()}.png`, fullPage: false });
  }
  await browser.close();
  console.log('done');
})();
