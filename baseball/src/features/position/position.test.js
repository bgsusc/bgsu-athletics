export async function verify(page){await page.locator('#page-position .pos-tab').filter({hasText:/^C$/}).click();}
