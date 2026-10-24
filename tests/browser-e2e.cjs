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

 // AK report: customer-specific open/done/actual totals, cross-customer scheduling conflicts,
 // CSV with planned (not yet completed) orders and a byte-valid exported PDF.
 await page.evaluate(()=>{
  showScreen('history');
  document.getElementById('reportMode').value='month';
  setReportMode();
  document.getElementById('historyMonth').value='2026-10';
  document.getElementById('reportAllCustomers').checked=false;
  refreshReportCustomers();
  document.getElementById('reportCustomer').value='test-customer-1';
  renderOrderOverview();
 });
 const akInfo=await page.evaluate(()=>{
  const d=akReportData('2026-10-01','2026-10-31','test-customer-1');
  return {rows:d.rows.length,open:d.metrics.open,done:d.metrics.done,actual:d.metrics.doneActual,allBelong:d.rows.every(r=>r.customerId==='test-customer-1'),first:d.rows[0]?.ak,preview:document.getElementById('orderPrintPreviewBody').textContent};
 });
 assert(akInfo.rows>=3&&akInfo.open>0&&akInfo.done>0&&akInfo.actual>0,'AK report distinguishes open and done');
 assert(akInfo.allBelong,'AK customer filter must exclude other customers');
 assert(/^AK \d+$/.test(akInfo.first),'User-facing AK numbers should be short');
 assert(akInfo.preview.includes('Noch zu erledigen')&&akInfo.preview.includes('Fertig'),'PDF preview totals');
 const collision=await page.evaluate(()=>{
  const a={...state.appointments[0],id:'cross-customer-overlap-test',akNumber:996,customerId:'test-customer-2',objectId:'test-object-2-1',date:'2026-10-05',start:'10:00',end:'10:30',repeat:'once',employee:'Inhaber'};
  state.appointments.push(a);
  try{return akReportData('2026-10-01','2026-10-31','test-customer-1').rows.find(r=>r.date==='2026-10-05')?.conflicts||[]}
  finally{state.appointments.pop()}
 });
 assert(collision.some(x=>x.includes('AK 996')),'Cross-customer overlap must appear despite customer filter');
 const akCsvDownload=page.waitForEvent('download');
 await page.locator('#orderStatusCsv').click();
 const akCsv=await akCsvDownload;
 const akCsvText=fs.readFileSync(await akCsv.path(),'utf8');
 assert(akCsv.suggestedFilename().endsWith('.csv'),'Customer report CSV extension');
 assert(akCsvText.startsWith('\ufeff'),'Customer CSV must have UTF-8 BOM');
 assert(akCsvText.includes('Soll-Minuten')&&akCsvText.includes('Ist-Minuten'),'AK CSV contains planned and actual time');
 assert(akCsvText.includes('"Offen"')&&akCsvText.includes('"Erledigt"'),'AK CSV includes open and completed orders');
 const akPdfDownload=page.waitForEvent('download');
 await page.locator('#orderStatusPdf').click();
 const akPdf=await akPdfDownload;
 const akPdfBytes=fs.readFileSync(await akPdf.path());
 assert(akPdf.suggestedFilename().endsWith('.pdf'),'Customer report PDF extension');
 assert(akPdfBytes.subarray(0,8).toString().startsWith('%PDF-1.'),'Valid PDF signature');
 assert(akPdfBytes.length>6000,'AK report PDF should contain image and page content');
 assert(akPdfBytes.toString('latin1').includes('%%EOF'),'PDF must have a complete cross-reference trailer');
 console.log('E2E step 4b: AK open/done, customer filter, conflicts, CSV and PDF passed');

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
 // A corrected workday must keep the original planned appointment association.
 await page.evaluate(()=>editEntry('test-entry-1'));
 await page.locator('#date').fill('06.10.2026');
 assert.equal(await page.locator('#linkedAppointment').inputValue(),'test-appointment-1|2026-10-05','The plan link must remain selected after changing actual date');
 await page.locator('#deviationReason').selectOption('Sonstiger Grund');
 await page.locator('#correctionReason').selectOption('Arbeitszeit falsch erfasst');
 await page.locator('#saveBtn').click();
 await page.waitForFunction(()=>state.entries.find(e=>e.id==='test-entry-1')?.date==='2026-10-06');
 const rescheduled=await page.evaluate(()=>{
  const e=state.entries.find(e=>e.id==='test-entry-1');
  return {date:e.date,original:e.appointmentOccurrence,id:e.appointmentId,changes:e.corrections.at(-1)?.changes||[],duplicates:state.entries.filter(x=>x.appointmentId===e.appointmentId&&x.appointmentOccurrence===e.appointmentOccurrence).length};
 });
 assert.equal(rescheduled.id,'test-appointment-1');
 assert.equal(rescheduled.original,'2026-10-05');
 assert.equal(rescheduled.duplicates,1);
 assert(rescheduled.changes.some(c=>c.field==='date'&&c.before==='2026-10-05'&&c.after==='2026-10-06'));
 await page.evaluate(()=>{calendarMonth='2026-10';chosenDay='2026-10-06';renderCalendar()});
 const correctedDayCalendar=await page.locator('#selectedDayList').textContent();
 assert(correctedDayCalendar.includes('09:00–11:00'),'Corrected actual day should show documented working times');
 assert(correctedDayCalendar.includes('Zu geplantem Auftrag vom 05.10.2026'),'Rescheduled work should retain the original appointment date');

 console.log('E2E step 5b: moved actual workday retains planned link and audit history');

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
 const calendarText=await page.locator('#selectedDayList').textContent();
 const calendarDebug=await page.evaluate(()=>({chosenDay,calendarMonth,selected:state.entries.filter(e=>e.date==='2026-10-28').map(e=>({start:e.start,end:e.end,date:e.date,appointmentId:e.appointmentId})),html:document.getElementById('selectedDayList').innerHTML.slice(0,1000)}));
 console.log('Calendar debug',JSON.stringify({calendarText,calendarDebug}));
 assert(calendarText.includes('14:00–16:00'),'Free entries should appear in calendar');
 console.log('E2E step 6: free work and calendar passed');
 // Wait for the preceding successful save to finish before testing another save.
 await page.waitForFunction(()=>!workEntrySaveInProgress);
 // Two concurrent submits must create only one work entry.
 const doubleResult=await page.evaluate(async()=>{
  resetEdit();openFreeWorkScreen();
  document.getElementById('date').value='29.10.2026';
  document.getElementById('endDate').value='29.10.2026';
  document.getElementById('start').value='20:00';
  document.getElementById('end').value='21:00';
  document.getElementById('customerChoice').value='';
  document.getElementById('employee').value='Inhaber';
  const before=state.entries.length;
  const originalSave=saveState;
  let calls=0;
  try{
   saveState=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,100));};
   await Promise.all([saveEntry({preventDefault(){}}),saveEntry({preventDefault(){}})]);
  }finally{saveState=originalSave}
  const after=state.entries.length;
  await saveState();
  return {calls,created:after-before,enabled:!document.getElementById('saveBtn').disabled};
 });
 assert.deepEqual(doubleResult,{calls:1,created:1,enabled:true},'Concurrent Save must add only one work entry');
 console.log('E2E step 6b: double submit guard passed');

 // Navigation and backups
 await page.locator('#goHome').click();
 await page.locator('#home [data-jump="backupSection"]').click();
 const backupPromise=page.waitForEvent('download');
 await page.locator('#exportJson').click();
 const backup=await backupPromise;
 assert(backup.suggestedFilename().endsWith('.json'));
 const backupJson=JSON.parse(fs.readFileSync(await backup.path(),'utf8'));
 assert(backupJson.entries.some(e=>e.id==='test-entry-1'&&e.corrections?.length>=1),'JSON backup retains correction history');
 // End-to-end restore: importer must preserve the fixture and revert changed state.
 const importBackupPromise=page.waitForEvent('download');
 await page.locator('#importJson').setInputFiles(path.join(root,'testdata/micare-10-kunden.json'));
 await importBackupPromise;
 await page.waitForFunction(()=>state.entries.find(e=>e.id==='test-entry-1')?.orderStatus==='done' && !state.entries.find(e=>e.id==='test-entry-1')?.corrections?.length);
 const restored=await page.evaluate(()=>({customers:state.customers.length,objects:state.objects.length,entries:state.entries.length}));
 assert.equal(restored.customers,fixture.customers.length);
 assert.equal(restored.objects,fixture.objects.length);
 assert.equal(restored.entries,fixture.entries.length);
 console.log('E2E step 7: JSON export and import restore passed');
 // Customer create/edit and linked object from actual forms.
 await page.evaluate(()=>showScreen('customersPanel'));
 await page.locator('#newCustomerMode').click();
 await page.locator('#editCustomerName').fill('E2E Musterhaus GmbH');
 await page.locator('#editCustomerAddress').fill('Beispielweg 4');
 await page.locator('#editCustomerZip').fill('58095');
 await page.locator('#editCustomerCity').fill('Hagen');
 await page.locator('#newObjectName').fill('E2E Testhalle');
 await page.locator('#newObjectAddress').fill('Objektweg 8');
 await page.locator('#newObjectZip').fill('58095');
 await page.locator('#newObjectCity').fill('Hagen');
 await page.locator('#saveCustomerChanges').click();
 await page.waitForFunction(()=>state.customers.some(c=>c.name==='E2E Musterhaus GmbH'));
 const customerData=await page.evaluate(()=>{const c=state.customers.find(c=>c.name==='E2E Musterhaus GmbH');return {id:c.id,no:c.publicNumber,object:state.objects.find(o=>o.customerId===c.id&&o.name==='E2E Testhalle')}});
 assert(customerData.object?.publicNumber,'Creating customer must also create its office');
 console.log('Customer after create',JSON.stringify(await page.evaluate(()=>({selected:document.getElementById('selectedCustomer').value,newCustomerMode,customer:state.customers.find(c=>c.name==='E2E Musterhaus GmbH'),object:state.objects.find(o=>o.customerId===state.customers.find(c=>c.name==='E2E Musterhaus GmbH').id),formName:document.getElementById('editCustomerName').value}))));
 await page.locator('#editCustomerPhone').fill('02331 123456');
 await page.locator('#editCustomerEmail').fill('test@example.invalid');
 await page.locator('#saveCustomerChanges').click();
 console.log('Customer after edit',JSON.stringify(await page.evaluate(()=>({selected:document.getElementById('selectedCustomer').value,newCustomerMode,customer:state.customers.find(c=>c.name==='E2E Musterhaus GmbH'),objectName:document.getElementById('newObjectName').value,formName:document.getElementById('editCustomerName').value,phoneField:document.getElementById('editCustomerPhone').value,emailField:document.getElementById('editCustomerEmail').value}))),JSON.stringify(dialogs.slice(-5)));
 assert(await page.evaluate(()=>state.customers.some(c=>c.name==='E2E Musterhaus GmbH'&&c.phone==='02331 123456'&&c.email==='test@example.invalid')),'Customer edit must persist contact details');
 // Create a new planned appointment through the real appointment form.
 await page.evaluate(()=>showScreen('appointmentsPanel'));
 await page.locator('#appointmentCreatePanel summary').click();
 const countBefore=await page.evaluate(()=>state.appointments.length);
 await page.locator('#appointmentCustomer').selectOption('test-customer-1');
 await page.locator('#appointmentObject').selectOption('test-object-1-1');
 await page.locator('#appointmentEmployee').selectOption('Inhaber');
 await page.locator('#appointmentService').selectOption('Gebäudereinigung');
 await page.locator('#appointmentDate').fill('2026-11-24');
 await page.locator('#appointmentStart').fill('08:00');
 await page.locator('#appointmentEnd').fill('10:00');
 await page.locator('#appointmentRepeat').selectOption('once');
 await page.locator('#appointmentForm button[type="submit"]').click();
 await page.waitForFunction(count=>state.appointments.length===count+1,countBefore);
 assert(await page.evaluate(()=>state.appointments.some(a=>a.date==='2026-11-24'&&a.start==='08:00'&&a.end==='10:00')));
 console.log('E2E step 8: customer creation/edit and appointment creation passed');
 // Newly editable fields must trigger the unsaved-changes warning.
 await page.evaluate(()=>{
  showScreen('customersPanel');
  document.getElementById('selectedCustomer').value='test-customer-1';
  renderCustomers();
  captureCurrentScreen();
 });
 await page.locator('#editCustomerPhone').fill('02331 888888');
 assert.equal(await page.evaluate(()=>screenDirty),true,'Contact edits must mark screen as unsaved');
 await page.evaluate(()=>captureCurrentScreen());
 await page.evaluate(()=>editEntry('test-entry-1'));
 await page.locator('#correctionNote').fill('Grund muss dokumentiert bleiben');
 assert.equal(await page.evaluate(()=>screenDirty),true,'Correction notes must mark screen as unsaved');
 console.log('E2E step 9: contact and correction unsaved-data warnings passed');


 assert.equal(errors.length,0,'Unhandled browser errors: '+errors.join(' | '));
 console.log('Browser E2E PASS: customers CRUD, appointments, navigation, reporting, CSV/PDF, corrections, double-save/date changes, unsaved edits, calendar, JSON export/import');
 await browser.close();
 server.close();
})().catch(e=>{console.error('E2E FAILED:',e);server.close();process.exit(1)});
