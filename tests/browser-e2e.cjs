'use strict';
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 let url;try{url=new URL(req.url,'http://127.0.0.1')}catch{return res.writeHead(400).end()}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(file!==root&&!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data)});
});
const wait=()=>new Promise(r=>server.listen(0,'127.0.0.1',r));
(async()=>{
 await wait();
 const base='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1330,height:900}});
 page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(15000);
 const errors=[],dialogs=[];
 page.on('pageerror',err=>errors.push(String(err)));
 page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept()});
 console.log('E2E step 1: load app');
 await page.goto(base+'index.html',{waitUntil:'load'});
 await page.waitForFunction(()=>document.querySelector('#employee')?.options?.length>0,{timeout:15000});
 assert(await page.locator('#home').isVisible(),'Home screen is visible');
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'testdata/micare-10-kunden.json'),'utf8'));
 await page.evaluate(async data=>{
   state=structuredClone(data);state.changeHistory??=[];state.appointmentTrash??=[];state.lastSave=null;
   await saveState();
   updateCustomerSelects();fillEmployees();refreshLinkedAppointments();
 },fixture);
 await page.waitForFunction(()=>state.customers.length===10);console.log('E2E step 2: fixture imported');
 // Navigation and customer data
 await page.locator('[data-jump="customerOverviewScreen"]').click();
 assert(await page.locator('#customerOverviewScreen').isVisible());
 assert((await page.locator('#allCustomersList').innerText()).includes('Nordstern'));
 await page.locator('#goHome').click();
 await page.locator('[data-jump="customersPanel"]').click();
 assert(await page.locator('#customersPanel').isVisible());
 await page.locator('#goHome').click();
 console.log('E2E step 3: customer navigation passed');
 // Reporting: search + customer filter, CSV and print
 await page.locator('[data-jump="reportingScreen"]').click();
 assert(await page.locator('#reportHome').isVisible());
 await page.locator('[data-open-report="employees"]').click();
 assert(await page.locator('#reportDetail').isVisible());
 assert((await page.locator('#reportTitle').innerText()).includes('Mitarbeiter'));
 await page.locator('#reportFilters summary').click();
 await page.locator('#reportCustomerSearch').fill('Nordstern');
 assert((await page.locator('#rptCustomer option').allTextContents()).some(x=>x.includes('Nordstern')));
 await page.locator('#rptCustomer').selectOption('test-customer-1');
 assert.equal(await page.locator('#rptCustomer').inputValue(),'test-customer-1');
 const filter=await page.evaluate(()=>reportBuild());
 assert(filter.entries.every(e=>e.customerId==='test-customer-1'),'Reporting customer filter applied');
 const csvPromise=page.waitForEvent('download');
 await page.locator('#reportTableCsv').click();
 const csv=await csvPromise;
 assert(csv.suggestedFilename().endsWith('.csv'),'Report CSV should download');
 const csvContent=fs.readFileSync(await csv.path(),'utf8');
 assert(csvContent.includes('Mitarbeiter')||csvContent.includes('Bericht'),'Report export content');
 await page.evaluate(()=>{window.__printed=false;window.print=()=>{window.__printed=true}});
 await page.locator('#reportPrint').click();
 assert(await page.evaluate(()=>window.__printed),'Print action should be invoked');
 await page.emulateMedia({media:'print'});
 assert.equal(await page.locator('#reportHome').evaluate(el=>getComputedStyle(el).display),'none','Home must not appear on report PDF');
 assert.notEqual(await page.locator('#reportDetail').evaluate(el=>getComputedStyle(el).display),'none','Details must be printable');
 const pdf=await page.pdf({format:'A4',printBackground:true});
 assert(pdf.length>2500,'Generated PDF should not be empty');
 await page.emulateMedia({media:'screen'});
 console.log('E2E step 4: reporting export and print passed');
 // Planned order correction: no reason => blocked, reason => same entry updated and audited
 await page.evaluate(()=>editEntry('test-entry-1'));
 assert(await page.locator('#plannedEditorScreen').isVisible());
 assert(await page.locator('#correctionPanel').isVisible());
 await page.locator('#orderStatus').selectOption('progress');
 await page.locator('#saveBtn').click();
 assert(dialogs.some(x=>x.includes('Korrekturgrund')),'Saving without reason must be blocked');
 assert.equal(await page.evaluate(()=>state.entries.find(e=>e.id==='test-entry-1').orderStatus),'done');
 await page.locator('#correctionReason').selectOption('Aus Versehen abgeschlossen');
 await page.locator('#saveBtn').click();
 await page.waitForFunction(()=>state.entries.find(e=>e.id==='test-entry-1')?.orderStatus==='progress');
 const correction=await page.evaluate(()=>{
 const e=state.entries.find(e=>e.id==='test-entry-1');
 return {records:state.entries.filter(x=>x.appointmentId===e.appointmentId&&x.appointmentOccurrence===e.appointmentOccurrence).length,reasons:e.corrections?.map(c=>c.reason)||[],audit:state.changeHistory?.filter(x=>x.type==='Auftragskorrektur').length}
 });
 assert.equal(correction.records,1,'Must not duplicate planned appointment entry');
 assert(correction.reasons.includes('Aus Versehen abgeschlossen'));
 assert(correction.audit>=1,'Corrections must be auditable');
 console.log('E2E step 5: planned order correction passed');
 // Free entry and the shared appointment calendar
 await page.evaluate(()=>{resetEdit();openFreeWorkScreen()});
 await page.locator('#date').fill('28.10.2026');
 await page.locator('#start').fill('14:00');
 await page.locator('#end').fill('16:00');
 await page.locator('#customerChoice').selectOption('test-customer-1');
 await page.locator('#saveBtn').click();
 await page.waitForFunction(()=>state.entries.some(e=>e.date==='2026-10-28'&&e.start==='14:00'&&e.end==='16:00'));
 assert(await page.evaluate(()=>state.entries.some(e=>e.date==='2026-10-28'&&e.minutes===120)));
 await page.evaluate(()=>{showScreen('appointmentsPanel');calendarMonth='2026-10';chosenDay='2026-10-28';renderCalendar()});
 assert((await page.locator('#selectedDayList').innerText()).includes('14:00–16:00'),'Free entries should appear in calendar');
 console.log('E2E step 6: free work and calendar passed');
 // Navigation and backups
 await page.locator('#goHome').click();
 await page.locator('[data-jump="backupSection"]').click();
 const backupPromise=page.waitForEvent('download');
 await page.locator('#exportJson').click();
 const backup=await backupPromise;
 assert(backup.suggestedFilename().endsWith('.json'));
 const backupJson=JSON.parse(fs.readFileSync(await backup.path(),'utf8'));
 assert(backupJson.entries.some(e=>e.id==='test-entry-1'&&e.corrections?.length>=1),'JSON backup retains correction history');
 assert.equal(errors.length,0,'Unhandled browser errors: '+errors.join(' | '));
 console.log('Browser E2E PASS: customers, navigation, reporting filters, CSV, print/PDF, planned corrections, free time, calendar, JSON backup');
 await browser.close();
 server.close();
})().catch(e=>{console.error('E2E FAILED:',e);server.close();process.exit(1)});
