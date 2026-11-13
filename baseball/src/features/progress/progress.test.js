export async function verify(page){await page.locator('#prog-metric-sel').selectOption('split10');await page.locator('#prog-athlete-sel').selectOption({index:1});}
