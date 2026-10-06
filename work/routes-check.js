const { chromium } = require('D:/waves-co/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const base = 'http://localhost:3111';
  const routes = ['/', '/architecture-audit', '/case-study', '/robots.txt', '/sitemap.xml'];

  // Route checks
  for (const r of routes) {
    const page = await browser.newPage();
    const resp = await page.goto(base + r, { waitUntil: 'networkidle', timeout: 20000 });
    const title = await page.title();
    console.log(`ROUTE ${r} -> ${resp.status()} | title: ${title}`);
    await page.close();
  }

  // Desktop homepage
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(base + '/', { waitUntil: 'networkidle' });
  const dChecks = await desktop.evaluate(() => {
    const h1 = document.querySelector('h1');
    const nav = document.querySelector('nav');
    const links = Array.from(document.querySelectorAll('nav a, footer a')).map(a => a.getAttribute('href'));
    const bodyW = document.body.scrollWidth;
    const hasHorizontalOverflow = bodyW > window.innerWidth;
    const text = document.body.innerText;
    return {
      h1: h1 ? h1.innerText : null,
      hasNav: !!nav,
      overflowX: hasHorizontalOverflow,
      copyright: /© \d{4} Wavesco/.test(text),
      founderApi: text.includes('FOUNDER IS THE'),
      siteLinks: [...new Set(links)].slice(0, 12),
    };
  });
  console.log('DESKTOP:', JSON.stringify(dChecks, null, 1));

  // Mobile homepage
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.goto(base + '/', { waitUntil: 'networkidle' });
  const mChecks = await mobile.evaluate(() => {
    return {
      overflowX: document.body.scrollWidth > window.innerWidth,
      viewportW: window.innerWidth,
      bodyW: document.body.scrollWidth,
    };
  });
  console.log('MOBILE:', JSON.stringify(mChecks));
  await mobile.screenshot({ path: 'D:/waves-co/work/mobile-home.png', fullPage: true });

  // Audit page check
  const audit = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await audit.goto(base + '/architecture-audit', { waitUntil: 'networkidle' });
  const aChecks = await audit.evaluate(() => {
    const form = document.querySelector('form');
    const inp = Array.from(document.querySelectorAll('input')).slice(0, 10).map(i => ({ name: i.name, placeholder: i.placeholder }));
    return { hasForm: !!form, overflowX: document.body.scrollWidth > window.innerWidth, inputs: inp };
  });
  console.log('MOBILE AUDIT:', JSON.stringify(aChecks, null, 1));

  await browser.close();
  process.exit(0);
})();