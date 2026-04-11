const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set up local storage for testing rotation and settings
  await page.addInitScript(() => {
    localStorage.setItem('timer_settings', JSON.stringify({
      work_duration: 1, // 1 min for fast test
      short_break: 1,
      long_break: 1,
      sessions_until_long_break: 2,
      auto_start_break: true,
      auto_start_work: true
    }));
  });

  await page.goto('file://' + path.resolve('settings.html'));
  await page.screenshot({ path: 'verification/settings_page.png' });
  console.log('Settings page screenshot saved.');

  await page.goto('file://' + path.resolve('timer.html'));
  await page.screenshot({ path: 'verification/timer_page.png' });
  console.log('Timer page screenshot saved.');

  await browser.close();
})();
