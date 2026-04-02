const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 420, deviceScaleFactor: 2 });

  const svgPath = 'file:///' + path.resolve(__dirname, '..', 'assets', 'demo.svg').replace(/\\/g, '/');
  await page.goto(svgPath, { waitUntil: 'load' });

  // Wait for all SMIL animations to finish (~5.5s)
  await new Promise(r => setTimeout(r, 7000));

  await page.screenshot({
    path: path.resolve(__dirname, '..', 'assets', 'demo.png'),
    omitBackground: false,
  });
  await browser.close();
  console.log('PNG saved: assets/demo.png');
})();
