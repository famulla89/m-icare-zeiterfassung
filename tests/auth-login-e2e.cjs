'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const {firstRun,unlock,USER,PASS}=require('./auth-test-helper.cjs');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 const f=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(f!==root&&!f.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(f,(err,buf)=>err?res.writeHead(404).end():res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.html':'text/html','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream'}).end(buf));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();
 const checks=[];
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
  await page.waitForSelector('#micareLock');
  assert(await page.locator('#micareLock').isVisible());
  assert(await page.locator('#home').isHidden());
  await page.locator('#micareLoginUser').fill(USER);
  await page.locator('#micareLoginPass').fill(PASS);
  await page.locator('#micareConfirmPass').fill('DasIstAnders123!');
  await page.locator('#micareLoginSubmit').click();
  await page.waitForFunction(()=>document.querySelector('#micareLoginMessage').textContent.includes('übereinstimmen'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('micare-local-account-v1')),null);
  checks.push('Mismatching password confirmation rejected');

  await page.locator('#micareConfirmPass').fill(PASS);
  await page.locator('#micareLoginSubmit').click();
  await page.waitForFunction(()=>document.body.classList.contains('micare-authenticated'));
  let stored=await page.evaluate(()=>localStorage.getItem('micare-local-account-v1'));
  assert(!stored.includes(PASS));
  let account=JSON.parse(stored);
  assert.equal(account.username,USER);
  assert.equal(account.salt.length,32);
  assert.equal(account.hash.length,64);
  checks.push('First-run username/password setup with PBKDF2 salted hash');

  await page.evaluate(async()=>{
   state.customers.push({id:'auth-qa',name:'Persistenter Testkunde'});
   await saveState();
  });
  await page.reload();
  await page.waitForSelector('#micareLock');
  assert(await page.locator('#micareLock').isVisible());
  assert(await page.locator('#home').isHidden());
  assert.equal(await page.evaluate(()=>state.customers.some(x=>x.id==='auth-qa')),true);
  checks.push('Logout on restart without deleting existing client data');

  await page.locator('#micareLoginPass').fill('FalschesPasswort123!');
  await page.locator('#micareLoginSubmit').click();
  await page.waitForFunction(()=>document.querySelector('#micareLoginMessage').textContent.includes('falsch'));
  assert(await page.locator('#home').isHidden());
  let f=await page.evaluate(()=>JSON.parse(localStorage.getItem('micare-failed-logins-v1')));
  assert.equal(f.count,1);
  checks.push('Wrong password rejected');
  for(let n=0;n<4;n++){
   await page.locator('#micareLoginPass').fill('FalschesPasswort123!');
   await page.locator('#micareLoginSubmit').click();
   await page.waitForFunction(count=>JSON.parse(localStorage.getItem('micare-failed-logins-v1')).count===count,2+n);
  }
  f=await page.evaluate(()=>JSON.parse(localStorage.getItem('micare-failed-logins-v1')));
  assert.equal(f.count,5);
  assert(f.until>Date.now());
  await page.locator('#micareLoginPass').fill(PASS);
  await page.locator('#micareLoginSubmit').click();
  assert(await page.locator('#home').isHidden());
  checks.push('Five failed attempts temporarily lock account');

  await page.evaluate(()=>{
   const data=JSON.parse(localStorage.getItem('micare-failed-logins-v1'));
   data.until=Date.now()-1;localStorage.setItem('micare-failed-logins-v1',JSON.stringify(data));
  });
  await page.locator('#micareLoginPass').fill(PASS);
  await page.locator('#micareLoginSubmit').click();
  await page.waitForFunction(()=>document.body.classList.contains('micare-authenticated'));
  assert.equal(await page.locator('#micareBioLogin').isHidden(),true);
  checks.push('Correct password works after lockout and browser has no fake biometrics');

  await page.locator('#micareLogout').click();
  await page.waitForFunction(()=>!document.body.classList.contains('micare-authenticated'));
  await page.evaluate(()=>window.MiCareLogin.biometricResult('forged',true));
  assert(await page.locator('#home').isHidden());
  await page.locator('#micareLoginPass').fill(PASS);
  await page.locator('#micareLoginSubmit').click();
  await page.waitForFunction(()=>document.body.classList.contains('micare-authenticated'));
  checks.push('Manual lock and spoofed biometric callback denied');

  console.log('AUTH LOGIN QA PASS: '+checks.length+' checks: '+checks.join(' | '));
 }catch(e){console.error('AUTH LOGIN QA FAILED',e);process.exitCode=1}
 finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
