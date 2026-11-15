// scripts/lib/cabinet.mjs -- the browser checks' way into the filing cabinet (app/js/cabinet.js): the projects on
// Focus ('projects'), Sort ('tray-folders') and the Projects tab ('projects-tab'). A tap opens a file, a tap on the
// open file chooses it. Files are tapped on their tab (the top 10px), the part the next file never covers.
export const cab = (wallet) => '.cab[data-wallet="' + wallet + '"]';
// Everything is the first drawer and holds every file, so a key is always found there
export const everyFile = (wallet, key) => cab(wallet) + ' .cab-drawer:first-child .cab-file' + (key ? '[data-key="' + key + '"]' : '');

// The keys in Everything, in order (the lead file, All projects, included on Focus)
export const fileKeys = (page, wallet) => page.$$eval(everyFile(wallet), (fs) => fs.map((f) => f.dataset.key));
export const openKey = (page, wallet) => page.$eval(cab(wallet), (c) => { const f = c.querySelector('.cab-file.is-centre'); return f && f.dataset.key; });

async function tapFile(page, wallet, key) {
  await page.waitForSelector(cab(wallet));
  // go to Everything first, so the file is in the drawer showing
  await page.$eval(cab(wallet) + ' .cab-drawers', (row) => { row.scrollLeft = 0; });
  const f = page.locator(everyFile(wallet, key));
  await f.scrollIntoViewIfNeeded();
  await f.click({ position: { x: 30, y: 6 } });
  await page.waitForTimeout(150);
}

// Open a file (it faces you; nothing chosen yet)
export async function openFile(page, wallet, key) {
  if ((await openKey(page, wallet)) !== key) await tapFile(page, wallet, key);
}

// Choose a file: open it if it is not open, then tap it again
export async function chooseFile(page, wallet, key) {
  await openFile(page, wallet, key);
  await tapFile(page, wallet, key);
  await page.waitForTimeout(200);
}
