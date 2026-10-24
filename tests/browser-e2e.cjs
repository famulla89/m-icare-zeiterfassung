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



 // Create an annual order via real UI, document 70% completed, and record customer follow-up.
 await page.evaluate(()=>{captureCurrentScreen();showScreen('ordersScreen')});
 assert(await page.locator('#ordersScreen').isVisible());
 await page.locator('#newOrderToggle').click();
 await page.locator('#orderCustomer').selectOption('test-customer-1');
 await page.locator('#orderObject').selectOption('test-object-1-1');
 await page.locator('#orderTitle').fill('Jahresauftrag Fensterreinigung');
 await page.locator('#orderService').selectOption('Glas- & Fensterreinigung');
 await page.locator('#orderEmployee').selectOption('Inhaber');
 await page.locator('#orderType').selectOption('recurring');
 await page.locator('#orderStartDate').fill('2026-10-27');
 await page.locator('#orderUntil').fill('2027-10-19');
 await page.locator('#orderRepeat').selectOption('weekly');
 await page.locator('#orderStartTime').fill('09:00');
 await page.locator('#orderEndTime').fill('11:00');
 await page.locator('#orderScope').fill('25 Fenster von innen und außen, Rahmen inklusive');
 await page.locator('#orderCreateSave').click();
 await page.waitForFunction(()=>state.orders.some(o=>o.title==='Jahresauftrag Fensterreinigung'));
 const originalProgress=await page.evaluate(()=>{const o=state.orders.find(o=>o.title==='Jahresauftrag Fensterreinigung');return {id:o.id,appointments:state.appointments.filter(a=>a.orderId===o.id).length,...orderProgress(o)}});
 assert.equal(originalProgress.total,52,'Contract should create 52 Tuesdays');
 assert.equal(originalProgress.done,0);
 assert.equal(originalProgress.appointments,1,'Contract is one recurring series, not 52 duplicated appointment records');
 console.log('E2E step 10: annual contract and 52 occurrences created');
 // Independent extra work hours can be linked to the contract without falsely completing a visit.
 await page.evaluate(()=>{resetEdit();openFreeWorkScreen()});
 await page.locator('#date').fill('28.11.2026');
 await page.locator('#start').fill('14:00');
 await page.locator('#end').fill('15:00');
 await page.locator('#customerChoice').selectOption('test-customer-1');
 await page.locator('#entryObjectChoice').selectOption('test-object-1-1');
 const assignedOrder=await page.evaluate(()=>state.orders.find(o=>o.title==='Jahresauftrag Fensterreinigung').id);
 await page.locator('#entryOrderChoice').selectOption(assignedOrder);
 await page.locator('#saveBtn').click();
 await page.waitForFunction(id=>state.entries.some(e=>e.orderId===id&&e.date==='2026-11-28'&&e.start==='14:00'),assignedOrder);
 const extra=await page.evaluate(id=>{const o=state.orders.find(o=>o.id===id),p=orderProgress(o),e=state.entries.find(e=>e.orderId===id&&e.date==='2026-11-28');return {done:p.done,hours:p.minutes,hasVisitLink:!!e.appointmentId}},assignedOrder);
 assert.equal(extra.done,0,'Extra work must not count as a completed contractual visit');
 assert.equal(extra.hours,60,'Extra one-hour work should count toward actual contract hours');
 assert.equal(extra.hasVisitLink,false,'Extra time should be linked to the order, not to a planned appointment');
 console.log('E2E step 10b: extra free time linked without fake visit completion');

 await page.evaluate(async()=>{
  const o=state.orders.find(o=>o.title==='Jahresauftrag Fensterreinigung'),stats=orderProgress(o),a=state.appointments.find(a=>a.orderId===o.id);
  for(const item of stats.visits.slice(0,37)){
   state.entries.push({id:crypto.randomUUID(),customerId:o.customerId,objectId:o.objectId,employee:'Inhaber',service:o.service,object:'',notes:'',date:item.occ.date,endDate:item.occ.date,start:'09:00',end:'11:00',breakMinutes:0,minutes:120,appointmentId:a.id,appointmentOccurrence:item.occ.originalDate,orderId:o.id,orderStatus:'done',workDone:'Glas gereinigt',orderRemarks:''});
  }
  await saveState();renderOrders()
 });
 const threshold=await page.evaluate(()=>{const o=state.orders.find(o=>o.title==='Jahresauftrag Fensterreinigung'),p=orderProgress(o);return {done:p.done,total:p.total,percent:p.percent,due:orderFollowupDue(o,p)}});
 assert.equal(threshold.done,37);assert(threshold.percent>=70&&threshold.percent<72);assert.equal(threshold.due,true);
 await page.evaluate(()=>{captureCurrentScreen();showScreen('ordersScreen')});
 await page.locator('#orderList .orderCard .orderFollowup select').first().selectOption('offer');
 await page.locator('#orderList .orderCard .orderFollowup textarea').first().fill('Kunde möchte ein Angebot für Treppenhausreinigung');
 await page.locator('#orderList .orderCard .orderFollowup button').first().click();
 await page.waitForFunction(()=>state.orders.some(o=>o.title==='Jahresauftrag Fensterreinigung'&&o.followUpStatus==='offer'));
 assert.equal(await page.evaluate(()=>{const o=state.orders.find(o=>o.title==='Jahresauftrag Fensterreinigung');return orderFollowupDue(o,orderProgress(o))}),false);
 await page.evaluate(()=>{captureCurrentScreen();showScreen('reportingScreen');reportOpenTab('contracts')});
 assert((await page.locator('#reportPanels').innerText()).includes('Jahresauftrag Fensterreinigung'),'Progress report should include contract');
 assert((await page.locator('#reportPanels').innerText()).includes('Angebot gewünscht'),'Follow-up response should appear in report');
 await page.evaluate(()=>{captureCurrentScreen();showScreen('backupSection')});
 const orderBackupPromise=page.waitForEvent('download');
 await page.locator('#exportJson').click();
 const orderBackup=await orderBackupPromise;
 const orderBackupData=JSON.parse(fs.readFileSync(await orderBackup.path(),'utf8'));
 assert(orderBackupData.orders?.some(o=>o.title==='Jahresauftrag Fensterreinigung'&&o.followUpStatus==='offer'),'Order and follow-up should persist in JSON full backup');
 assert(orderBackupData.appointments.some(a=>a.orderId===orderBackupData.orders.find(o=>o.title==='Jahresauftrag Fensterreinigung').id),'Appointment linked to contract');
 console.log('E2E step 11: 70% progress, follow-up and backup passed');
 // Full backup restore must bring orders, occurrences, additional hours and follow-up back.
 const preRestore=page.waitForEvent('download');
 await page.locator('#importJson').setInputFiles(await orderBackup.path());
 await preRestore;
 await page.waitForFunction(()=>state.orders?.some(o=>o.title==='Jahresauftrag Fensterreinigung'&&o.followUpStatus==='offer'));
 const restoredOrder=await page.evaluate(()=>{
  const o=state.orders.find(o=>o.title==='Jahresauftrag Fensterreinigung'),p=orderProgress(o);
  return {total:p.total,done:p.done,minutes:p.minutes,followUp:o.followUpStatus,events:o.events?.length||0}
 });
 assert.equal(restoredOrder.total,52);
 assert.equal(restoredOrder.done,37);
 assert.equal(restoredOrder.minutes,37*120+60);
 assert.equal(restoredOrder.followUp,'offer');
 assert(restoredOrder.events>=2);
 console.log('E2E step 12: full order backup and restore passed');

 // Sequential numbering and terminal cancellation/closure must work through the UI.
 await page.evaluate(()=>{captureCurrentScreen();showScreen('ordersScreen')});
 for(const [title,date] of [['Probeauftrag Küche','2027-01-09'],['Probeauftrag Glas','2027-01-10']]){
  await page.locator('#newOrderToggle').click();
  await page.locator('#orderCustomer').selectOption('test-customer-1');
  await page.locator('#orderObject').selectOption('test-object-1-1');
  await page.locator('#orderTitle').fill(title);
  await page.locator('#orderService').selectOption('Gebäudereinigung');
  await page.locator('#orderEmployee').selectOption('Inhaber');
  await page.locator('#orderType').selectOption('once');
  await page.locator('#orderStartDate').fill(date);
  await page.locator('#orderStartTime').fill('15:00');
  await page.locator('#orderEndTime').fill('16:00');
  await page.locator('#orderCreateSave').click();
  await page.waitForFunction(name=>state.orders.some(o=>o.title===name),title);
 }
 const ids=await page.evaluate(()=>state.orders.map(o=>({number:o.number,title:o.title,status:o.status,kind:o.type})));
 assert.deepEqual(ids.map(o=>o.number),['1','2','3'],'New order numbers must be sequential');
 let testCard=page.locator('#orderList .orderCard').filter({hasText:'Probeauftrag Küche'});
 await testCard.locator('.orderActions details summary').click();
 await testCard.locator('.orderActions details select').selectOption('cancelled');
 await testCard.locator('.orderActions details textarea').fill('Kunde hat den Auftrag abgesagt');
 await testCard.locator('.orderActions details button').click();
 await page.waitForFunction(()=>state.orders.find(o=>o.number==='2')?.status==='cancelled');
 testCard=page.locator('#orderList .orderCard').filter({hasText:'Probeauftrag Glas'});
 await testCard.locator('.orderActions details summary').click();
 await testCard.locator('.orderActions details select').selectOption('completed');
 await testCard.locator('.orderActions details textarea').fill('Auftrag administrativ geschlossen');
 await testCard.locator('.orderActions details button').click();
 await page.waitForFunction(()=>state.orders.find(o=>o.number==='3')?.status==='completed');
 const closed=await page.evaluate(()=>({all:state.orders.length,closed:state.orders.filter(orderIsClosed).length,cancelled:state.orders.filter(o=>o.status==='cancelled').length,events:state.orders.filter(orderIsClosed).map(o=>o.events.at(-1)?.reason),percent:state.orders.find(o=>o.number==='2')&&orderProgress(state.orders.find(o=>o.number==='2')).percent,next:orderNextNumber()}));
 assert.equal(closed.all,3);assert.equal(closed.closed,2);assert.equal(closed.cancelled,1);
 assert.equal(closed.percent,0,'Cancellation must not count as completed work');
 assert.equal(closed.next,4,'Sequence must advance after cancellation');
 assert(closed.events.includes('Kunde hat den Auftrag abgesagt'));
 await page.locator('#orderStateFilter').selectOption('closed');
 assert.equal(await page.locator('#orderList .orderCard').count(),2,'Closed filter includes completed and cancelled');
 await page.evaluate(()=>{captureCurrentScreen();showScreen('reportingScreen');reportOpenTab('contracts')});
 const report=await page.locator('#reportPanels').innerText();
 assert(report.includes('Abgeschlossen – abgebrochen')&&report.includes('Abgeschlossen – erledigt'),'Controlling reports must distinguish closure reason');
 console.log('E2E step 13: orders 1/2/3, cancelled and completed count as closed, reason and report verified');



 assert.equal(errors.length,0,'Unhandled browser errors: '+errors.join(' | '));
 console.log('Browser E2E PASS: customers CRUD, appointments, navigation, reporting, CSV/PDF, corrections, double-save/date changes, unsaved edits, calendar, JSON export/import and annual orders/follow-ups');
 await browser.close();
 server.close();
})().catch(e=>{console.error('E2E FAILED:',e);server.close();process.exit(1)});
