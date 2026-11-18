export async function verify(page){await page.locator('#prog-metric-sel').selectOption('laneAgility');await page.locator('#prog-athlete-sel').selectOption({index:1});}
