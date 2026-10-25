'use strict';
const assert=require('node:assert/strict');
const USER='M-iCare-Test';
const PASS='SicheresTestPasswort!2026';
async function firstRun(page){
 await page.waitForSelector('#micareLock');
 assert(await page.locator('#micareLock').isVisible(),'Login must block app at first start');
 assert(await page.locator('#micareSetup').isVisible(),'New installation must request account creation');
 await page.locator('#micareLoginUser').fill(USER);
 await page.locator('#micareLoginPass').fill(PASS);
 await page.locator('#micareConfirmPass').fill(PASS);
 await page.locator('#micareLoginSubmit').click();
 await page.waitForFunction(()=>document.body.classList.contains('micare-authenticated'));
 assert(await page.locator('#home').isVisible(),'After successful login app home is visible');
}
async function unlock(page){
 await page.waitForSelector('#micareLock');
 assert(await page.locator('#micareLock').isVisible(),'Each new page load must be locked');
 assert(await page.locator('#micareSetup').isHidden(),'Existing profile must remain');
 await page.locator('#micareLoginUser').fill(USER);
 await page.locator('#micareLoginPass').fill(PASS);
 await page.locator('#micareLoginSubmit').click();
 await page.waitForFunction(()=>document.body.classList.contains('micare-authenticated'));
}
module.exports={firstRun,unlock,USER,PASS};
