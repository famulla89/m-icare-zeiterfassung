'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const {firstRun}=require('./auth-test-helper.cjs');
const root=path.resolve(__dirname,'..'),types={'.html':'text/html','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=new URL(req.url,'http://127.0.0.1').pathname}catch{return res.writeHead(400).end()}
 const p=path.resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
 if(p!==root&&!p.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(p,(err,buf)=>{if(err)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});res.end(buf)});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1180,height:900}});
 page.setDefaultTimeout(12000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',async d=>{
  if(d.type()==='prompt')return d.accept(d.message().includes('Stornierungsgrund')?'Buchung doppelt':d.message().includes('Name der neuen')?'Standardfenster':undefined);
  await d.accept()
 });
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
  await firstRun(page);
  await page.waitForFunction(()=>Boolean(window.MiCareOperationsUI&&window.MiCareOperationsCore&&typeof state!=='undefined'));
  await page.evaluate(async()=>{
   const date=isoDate();
   state.customers.push({id:'qa-c',name:'QA Reinigungsbetrieb',publicNumber:'99'});
   state.objects.push({id:'qa-o',name:'QA Testobjekt',customerId:'qa-c'});
   state.appointments.push({id:'qa-a1',quoteId:'qa-q',akNumber:991,customerId:'qa-c',objectId:'qa-o',employee:'Inhaber',date,start:'09:00',end:'11:00',repeat:'once',service:'Glas- & Fensterreinigung',plannedInvoiceNetCents:5000,plannedInvoiceTaxCents:0});
   state.appointments.push({id:'qa-a2',quoteId:'qa-q',akNumber:992,customerId:'qa-c',objectId:'qa-o',employee:'Inhaber',date,start:'10:00',end:'12:00',repeat:'once',service:'Glas- & Fensterreinigung',plannedInvoiceNetCents:5000,plannedInvoiceTaxCents:0});
   state.quotes.push({id:'qa-q',kind:'quote',number:'KV-QA',acceptedAt:new Date().toISOString(),customerName:'QA Reinigungsbetrieb',
    customerId:'qa-c',service:'Glas- & Fensterreinigung',objectName:'QA Testobjekt',appointmentIds:['qa-a1','qa-a2'],gross:100,net:100});
   state.quotes.push({id:'qa-i',kind:'invoice',invoiceType:'final',number:'RG-QA',finalizedAt:new Date().toISOString(),createdAt:new Date().toISOString(),
    customerName:'QA Reinigungsbetrieb',gross:100.03,net:100.03,dueDate:'2026-01-01',sourceQuoteId:'qa-q'});
   await saveState();renderHomeOverview();
   window.MiCareOperationsUI.refresh();
  });
  assert((await page.locator('#miTodayList').innerText()).includes('AK 991'));
  assert((await page.locator('#miTodayList').innerText()).includes('AK 992'));
  assert.equal(await page.locator('#homeAppointmentCount').innerText(),'2');
  assert((await page.locator('#miBackupHealth').innerText()).includes('Sicherung'));
  await page.evaluate(()=>{showScreen('appointmentsPanel');calendarMonth=isoDate().slice(0,7);renderCalendar()});
  assert((await page.locator('#calendarGrid button.mi-plan-conflict').count())>=1,'calendar shows overlap in red');
  await page.locator('#goHome').click();
  await page.evaluate(()=>window.MiCareOperationsUI.openOrder('qa-q'));
  assert(await page.locator('#orderWorkspace').isVisible());
  assert((await page.locator('#miOrderList').innerText()).includes('AK 991'));
  await page.evaluate(()=>showScreen('billingScreen'));
  assert((await page.locator('#miPaymentList').innerText()).includes('RG-QA'));
  await page.locator('#miPayInvoice').selectOption('qa-i');
  await page.locator('#miPayAmount').fill('25.02');
  await page.locator('#miPayForm button[type="submit"]').click();
  await page.waitForFunction(()=>state.payments?.length===1);
  assert.equal(await page.evaluate(()=>MiCareOperationsCore.paymentSummary(state.quotes.find(x=>x.id==='qa-i'),state.payments,isoDate()).remainingCents),7501);
  await page.locator('#miPayAmount').fill('75.01');
  await page.locator('#miPayForm button[type="submit"]').click();
  await page.waitForFunction(()=>state.payments?.length===2);
  await page.waitForFunction(()=>document.querySelector('#miPaymentList')?.innerText.includes('Bezahlt'));
  assert.equal(await page.evaluate(()=>MiCareOperationsCore.paymentSummary(state.quotes.find(x=>x.id==='qa-i'),state.payments,isoDate()).remainingCents),0);
  await page.locator('#miPaymentList button').filter({hasText:'Stornieren'}).first().click();
  await page.waitForFunction(()=>state.payments?.some(x=>x.voidedAt));
  await page.waitForFunction(()=>document.querySelector('#miPaymentList')?.innerText.includes('Teilbezahlt'));
  assert.equal(await page.evaluate(()=>state.payments.filter(x=>!x.voidedAt).length),1);
  await page.evaluate(()=>showScreen('quoteCalculator'));
  await page.locator('#qService').fill('Fensterreinigung Standard');
  await page.locator('#miTemplateSave').click();
  await page.waitForFunction(()=>state.quoteTemplates?.length===1);
  await page.locator('#qService').fill('Anderer Eintrag');
  await page.locator('#miTemplateSelect').selectOption({label:'Standardfenster'});
  await page.locator('#miTemplateApply').click();
  assert.equal(await page.locator('#qService').inputValue(),'Fensterreinigung Standard');
  await page.evaluate(()=>showScreen('entryForm'));
  await page.locator('#miChecklistOptions input').first().check();
  await page.locator('#miChecklistApply').click();
  assert((await page.locator('#workDone').inputValue()).includes('gereinigt'));
  assert.equal(errors.length,0,'No browser JS errors: '+errors.join('; '));
  console.log('OPERATIONS E2E PASS: daily work, 30-day KPI, red calendar conflicts, order file, 2 partial payments, refund audit, reusable templates, work checklist.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error('OPERATIONS E2E FAILED',e);server.close();process.exitCode=1});
