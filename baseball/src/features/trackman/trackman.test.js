export async function verify(page){
  if(await page.locator('#page-trackman #tm-tbody tr').count()<5)throw new Error('Trackman hitting rows missing');
  await page.locator('#tm-tab-pitch').click();
  if(await page.locator('#page-trackman #tm-tbody tr').count()<3)throw new Error('Trackman pitching rows missing');
  if(await page.locator('#page-trackman canvas').count()!==1)throw new Error('Trackman chart missing');
}
