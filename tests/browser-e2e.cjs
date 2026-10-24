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
 // Kundenübersicht: exakte Kunden- und Objektnummern, Namen, Orte und Status.
 await page.locator('#customerStateFilter').selectOption('all');
 await page.locator('#customerSearch').fill('1');
 let customerRows=await page.locator('#allCustomersList > .objectItem').count();
 assert.equal(customerRows,1,'Kundennummer 1 darf keine Objektnummer 10.1 oder Adresshausnummer 51 treffen');
 assert((await page.locator('#allCustomersList').innerText()).includes('Nordstern'),'Customer number 1 must find Nordstern');
 assert(!(await page.locator('#allCustomersList').innerText()).includes('Westpark'),'Number 1 must not find unrelated customer');
 assert((await page.locator('#customerListSummary').innerText()).includes('1 von 10 Kunden gefunden'),'Customer counter must show filtered result');
 await page.locator('#customerSearch').fill('1.2');
 assert.equal(await page.locator('#allCustomersList > .objectItem').count(),1,'Object number 1.2 finds its parent customer');
 const objText=await page.locator('#allCustomersList').innerText();
 assert(objText.includes('1.2'),'Matching object must appear');
 assert(!objText.includes('1.1 ·'),'Other objects must be hidden for exact object search');
 const selectedPdfCustomers=await page.evaluate(()=>({
  customers:filteredCustomers().map(c=>c.publicNumber),
  objects:filteredCustomers().flatMap(c=>customerObjectsForSearch(c).map(o=>o.publicNumber))
 }));
 assert.deepEqual(selectedPdfCustomers.customers,['1']);
 assert.deepEqual(selectedPdfCustomers.objects,['1.2'],'PDF export and filtered list must use same objects');
 await page.locator('#customerSearch').fill('10');
 assert.equal(await page.locator('#allCustomersList > .objectItem').count(),1,'Kundennummer 10 is exact');
 assert((await page.locator('#allCustomersList').innerText()).includes('Ruhr Campus'));
 await page.locator('#customerSearch').fill('Nordstern');
 assert.equal(await page.locator('#allCustomersList > .objectItem').count(),1,'Search customer by name');
 await page.locator('#customerSearch').fill('Dortmund');
 assert((await page.locator('#allCustomersList > .objectItem').count())>0,'Search object city');
 await page.locator('#customerSearch').fill('Muster & Partner');
 assert.equal(await page.locator('#allCustomersList > .objectItem').count(),1,'Archived customer visible with all filter');
 await page.locator('#customerStateFilter').selectOption('active');
 assert.equal(await page.locator('#allCustomersList > .objectItem').count(),0,'Active filter must hide archived customers');
 await page.locator('#customerStateFilter').selectOption('archived');
 assert.equal(await page.locator('#allCustomersList > .objectItem').count(),1,'Archived filter shows archived customers');
 await page.locator('#customerSearch').fill('zzzz-unbekannt');
 assert.equal(await page.locator('#allCustomersList > .objectItem').count(),0,'Unknown customer should show empty state');
 assert((await page.locator('#allCustomersList').innerText()).includes('Keine passenden Kunden gefunden'));
 await page.locator('#customerSearch').fill('');
 await page.locator('#customerStateFilter').selectOption('all');
 assert.equal(await page.locator('#allCustomersList > .objectItem').count(),10,'Clear search returns all customers');
 console.log('E2E step 2b: customer search exact number, object, name, city, archived, empty and PDF filter passed');
 await page.locator('#goHome').click();
 await page.locator('[data-jump="customersPanel"]').click();
 assert(await page.locator('#customersPanel').isVisible());
 await page.locator('#goHome').click();
 console.log('E2E step 3: customer navigation passed');

 // Cloud handoff: actual AES-256-GCM file, restore preview and local rollback.
 await page.locator('#home [data-jump="backupSection"]').click();
 assert(await page.locator('#cloudTransferPanel').isVisible(),'Cloud handoff must be visible in backups');
 await page.locator('#cloudOwnerEmail').fill('qa-cloud@gmail.com');
 await page.locator('#cloudOwnerEmail').dispatchEvent('change');
 await page.locator('#cloudPassword').fill('QA-Cloud-Passphrase-2026');
 await page.locator('#cloudPasswordConfirm').fill('QA-Cloud-Passphrase-2026');
 const cloudFileDownload=page.waitForEvent('download');
 await page.locator('#cloudExport').click();
 const cloudDownload=await cloudFileDownload;
 assert(/M-iCare_Cloud_.*\.json$/.test(cloudDownload.suggestedFilename()),'Encrypted backup has correct name');
 const encryptedFile=fs.readFileSync(await cloudDownload.path(),'utf8');
 const encryptedBackup=JSON.parse(encryptedFile);
 assert.equal(encryptedBackup.format,'M-iCare-Cloud-Backup');
 assert(!encryptedFile.includes('Nordstern'),'Backup must not reveal plaintext customer names');
 await page.evaluate(async()=>{
  state.customers.push({id:'cloud-undo-test',name:'Kunde zum Rückgängigmachen'});
  await saveState();
 });
 assert.equal(await page.evaluate(()=>state.customers.length),11);
 await page.locator('#cloudPassword').fill('QA-Cloud-Passphrase-2026');
 await page.locator('#cloudImportFile').setInputFiles({name:'QA-Cloud-Import.json',mimeType:'application/json',buffer:Buffer.from(encryptedFile)});
 await page.waitForFunction(()=>!document.querySelector('#cloudTransferPreview')?.classList.contains('hidden'));
 assert((await page.locator('#cloudImportCompare').innerText()).includes('fehlen in Datei 1'),'Must show local-only records before import');
 assert.equal(await page.evaluate(()=>state.customers.length),11,'Preview must not overwrite state');
 await page.locator('#cloudOverwriteConsent').check();
 await page.locator('#cloudApplyImport').click();
 await page.waitForFunction(()=>state.customers.length===10);
 assert.equal(await page.evaluate(()=>state.entries.length),fixture.entries.length,'Cloud restore retains work times');
 await page.locator('#cloudRestorePrevious').click();
 await page.waitForFunction(()=>state.customers.length===11);
 assert((await page.locator('#cloudTransferStatus').innerText()).includes('Vorheriger Stand erfolgreich'));
 await page.evaluate(async()=>{state.customers=state.customers.filter(c=>c.id!=='cloud-undo-test');await saveState()});
 await page.locator('#goHome').click();
 console.log('E2E cloud: encrypted download, safe diff preview, confirmed replace and recovery passed');


 // Rechner: zwei Fensterarten, Größen, Seiten, Zuschläge, eigener Netto-Preis und PDF im echten Browser.
 await page.locator('#home [data-jump="quoteCalculator"]').click();
 assert(await page.locator('#quoteCalculator').isVisible(),'Rechner muss über Startseite geöffnet werden');
 await page.locator('#qCustomer').selectOption('test-customer-1');
 assert((await page.locator('#qObject option').count())>1,'Geschäftsstellen der Kunden laden');
 await page.locator('#qObject').selectOption({index:1});
 const appointmentCount=await page.locator('#qAppointment option').count();
 assert(appointmentCount>=1,'AK-Auswahl vorhanden');
 if(appointmentCount>1)await page.locator('#qAppointment').selectOption({index:1});
 await page.locator('#qScope').selectOption('combined');
 await page.locator('#qAreas [data-area="200"]').click();
 await page.locator('#qWindowPicker [data-window="standard"]').click();
 await page.locator('#qWindowPicker [data-window="large"]').click();
 assert.equal(await page.locator('.quoteWindowRow').count(),2,'Zwei verschiedene Fensterarten werden erfasst');
 await page.locator('.quoteWindowRow').nth(0).locator('input[type="number"]').nth(0).fill('5');
 await page.locator('.quoteWindowRow').nth(0).locator('input[type="number"]').nth(1).fill('1.8');
 await page.locator('.quoteWindowRow').nth(1).locator('input[type="number"]').nth(0).fill('2');
 await page.locator('.quoteWindowRow').nth(1).locator('select').first().selectOption('2');
 await page.locator('.quoteWindowRow').nth(1).locator('input[type="checkbox"]').first().check();
 await page.locator('#qProfits [data-profit="75"]').click();
 const check=await page.evaluate(()=>MiCareQuoteUI.calculate());
 assert.equal(check.windowItems.length,2);
 assert.equal(check.windowItems[0].sqm,9);
 assert.equal(check.windowItems[1].sides,2);
 assert.equal(check.windowItems[1].frame,true);
 assert(check.gross>check.net&&check.rows.length>=3);
 await page.locator('#qManualNet').fill('950');
 assert.equal((await page.evaluate(()=>MiCareQuoteUI.calculate())).net,950,'Manuellen Angebotspreis übernehmen');
 await page.locator('#qValidUntil').fill('2026-11-23');
 await page.locator('#qSellerName').fill('M-iCare Testfirma');
 await page.locator('#qSave').click();
 await page.waitForFunction(()=>state.quotes?.length===1);
 assert.equal(await page.evaluate(()=>state.quotes[0].formValues.WindowItems.length),2,'Fensterliste wird im Entwurf dauerhaft gespeichert');
 await page.evaluate(()=>{
  window.__quotePdfLines=[];
  const original=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){
   window.__quotePdfLines.push(String(text));
   return original.call(this,text,...args);
  };
 });
 const quotePdfDownload=page.waitForEvent('download');
 await page.locator('#qPdf').click();
 const quotePdf=await quotePdfDownload;
 const quotePdfBytes=fs.readFileSync(await quotePdf.path());
 assert(quotePdfBytes.length>5000&&quotePdfBytes.subarray(0,5).toString()==='%PDF-','Angebots-PDF ist gültig');
 const quotePdfDates=await page.evaluate(()=>window.__quotePdfLines);
 assert(quotePdfDates.some(t=>t.includes('Angebot gültig bis: 23.11.2026')),'PDF must show 23.11.2026');
 assert(!quotePdfDates.some(t=>t.includes('2026-11-23')),'ISO date must not be printed');
 const invoicePdfDates=await page.evaluate(async()=>{
  window.__quotePdfLines=[];
  const doc=structuredClone(state.quotes[0]);
  doc.kind='invoice';doc.dueDate='2026-12-08';
  await MiCareQuote.pdf(doc);
  return [...window.__quotePdfLines];
 });
 assert(invoicePdfDates.some(t=>t.includes('Zahlbar bis: 08.12.2026')),'Invoice due date must be German-formatted');
 console.log('E2E PDF German dates: offer 23.11.2026 and invoice 08.12.2026 passed');
 await page.locator('#goHome').click();
 await page.locator('#home [data-jump="quoteCalculator"]').click();
 assert((await page.locator('#qSavedList').innerText()).includes('KV-'),'Gespeicherter Entwurf wird angezeigt');
 await page.locator('#qSavedList button').first().click();
 assert.equal(await page.locator('.quoteWindowRow').count(),2,'Wiederöffnen stellt Fenstergrößen und Bedingungen her');
 // Dedicated windows-only commission: 200 m² office must NOT be billed when only glass is ordered.
 await page.locator('#qNew').click();
 await page.locator('#qScope').selectOption('windows');
 assert.equal(await page.locator('#qWindowSection').isVisible(),true);
 assert.equal(await page.locator('#qArea').isVisible(),false,'Do not request/charge room area for windows-only');
 await page.locator('#qCustomer').selectOption('test-customer-1');
 await page.locator('#qWindowPicker [data-window="standard"]').click();
 await page.locator('.quoteWindowRow input[type="number"]').first().fill('10');
 await page.locator('#qHours').fill('0');
 await page.evaluate(()=>{document.getElementById('qSqmHour').value='0'}); // hidden for windows-only; ignored by calculation
 await page.locator('#qMaterial').fill('0');
 await page.locator('#qKm').fill('0');
 await page.locator('#qSetupMinutes').fill('0');
 await page.locator('#qVisits').fill('1');
 await page.locator('#qFixedProfit').fill('0');
 await page.locator('#qMargin').fill('0');
 await page.locator('#qManualNet').fill('0');
 const windowOnly=await page.evaluate(()=>MiCareQuoteUI.calculate());
 assert(windowOnly&&windowOnly.scope==='windows','Window-only quotation should be valid');
 assert.equal(windowOnly.windowSqm,15);
 assert.equal(windowOnly.net,45,'10 windows 1.5sqm at 3 EUR, without office floor cleaning');
 assert(windowOnly.rows.every(r=>!r.title.includes('Raum- und Bodenreinigung')),'No office rows in window-only quotation');
 assert((await page.locator('#qCalculationMessage').innerText()).includes('Fenster-Arbeitszeit'),'Warn on 0 estimated hours');
 await page.locator('#qScope').selectOption('other');
 assert.equal(await page.locator('#qWindowSection').isVisible(),false);
 await page.locator('#qHours').fill('3');
 await page.locator('#qService').fill('Sonderreinigung der Heizungsanlage');
 const other=await page.evaluate(()=>MiCareQuoteUI.calculate());
 assert(other&&other.scope==='other'&&other.rows[0].title.includes('Sonderreinigung'));
 await page.locator('#qScope').selectOption('combined');
 assert(await page.locator('#qArea').isVisible(),'Combined work includes room area');
 assert(await page.locator('#qWindowSection').isVisible(),'Combined work includes window cleaning');

 await page.locator('#goHome').click();
 console.log('E2E quote: customer, office, AK, 2 window sizes, soil, profit presets, custom price, storage and PDF passed');

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
 // Deutsche Status-Bezeichnungen nur bei der Ausgabe, Datenwerte bleiben stabil.
 const statusTranslation=await page.evaluate(()=>{
  showScreen('reportingScreen');reportOpenTab('orders');
  document.getElementById('reportFrom').value='2026-10-01';
  document.getElementById('reportTo').value='2026-10-31';
  document.getElementById('rptCustomer').value='';
  renderReporting();
  const section=[...document.querySelectorAll('#reportPanels .objectPanel')]
   .find(panel=>panel.querySelector('h3')?.textContent==='Auftragsstatus');
  const labels=section?[...section.querySelectorAll('tbody tr td:first-child')].map(td=>td.textContent):[];
  return {labels,raw:state.entries.map(e=>e.orderStatus),source:reportBuild().statusMap};
 });
 for(const label of ['Erledigt','In Bearbeitung','Abgebrochen','Kunde nicht angetroffen']){
  assert(statusTranslation.labels.includes(label),'Missing German status: '+label);
 }
 for(const key of ['done','progress','cancelled','absent']){
  assert(!statusTranslation.labels.includes(key),'Internal status must not appear as English label: '+key);
  assert(statusTranslation.raw.includes(key),'Internal status code must stay unchanged: '+key);
 }
 console.log('E2E step 4a: German reporting status labels and unchanged source keys passed');


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
 const sampleDir=path.join(root,'test-output');fs.mkdirSync(sampleDir,{recursive:true});
 const akCsvDownload=page.waitForEvent('download');
 await page.locator('#orderStatusCsv').click();
 const akCsv=await akCsvDownload;
 const akCsvText=fs.readFileSync(await akCsv.path(),'utf8');
 assert(akCsv.suggestedFilename().endsWith('.csv'),'Customer report CSV extension');
 assert(akCsvText.startsWith('\ufeff'),'Customer CSV must have UTF-8 BOM');
 assert(akCsvText.includes('Soll-Minuten')&&akCsvText.includes('Ist-Minuten'),'AK CSV contains planned and actual time');
 assert(akCsvText.includes('"Offen"')&&akCsvText.includes('"Erledigt"'),'AK CSV includes open and completed orders');
 fs.writeFileSync(path.join(sampleDir,'M-iCare_AK_Kundenreport_Test.csv'),akCsvText,'utf8');
 const akPdfDownload=page.waitForEvent('download');
 await page.locator('#orderStatusPdf').click();
 const akPdf=await akPdfDownload;
 const akPdfBytes=fs.readFileSync(await akPdf.path());
 assert(akPdf.suggestedFilename().endsWith('.pdf'),'Customer report PDF extension');
 assert(akPdfBytes.subarray(0,8).toString().startsWith('%PDF-1.'),'Valid PDF signature');
 assert(akPdfBytes.length>6000,'AK report PDF should contain image and page content');
 assert(akPdfBytes.toString('latin1').includes('%%EOF'),'PDF must have a complete cross-reference trailer');
 fs.writeFileSync(path.join(sampleDir,'M-iCare_AK_Kundenreport_Test.pdf'),akPdfBytes);
 await page.locator('#orderPrintPreviewBody').evaluate(el=>{el.closest('details').open=true});
 await page.locator('#orderPrintPreviewBody').screenshot({path:path.join(sampleDir,'M-iCare_AK_Druckvorschau_Test.png')});
 console.log('E2E step 4b: AK open/done, customer filter, conflicts, CSV and PDF passed');

 // Multi-page PDF and CSV formula-injection regression check.
 const safeCsv=await page.evaluate(()=>akCsvBlob([['=HYPERLINK("https://example.test")']]).text());
 assert(safeCsv.includes('"\'=HYPERLINK'), 'CSV formula-looking strings must be escaped');
 await page.evaluate(()=>{document.getElementById('reportAllCustomers').checked=true;renderOrderOverview()});
 const reportCount=await page.evaluate(()=>akReportData('2026-10-01','2026-10-31').rows.length);
 assert(reportCount>12,'Fixture must exercise multipage export');
 const multiDownload=page.waitForEvent('download');
 await page.locator('#orderStatusPdf').click();
 const multiPdf=await multiDownload;
 const multiBytes=fs.readFileSync(await multiPdf.path());
 const countMatch=/\/Count\s+(\d+)/.exec(multiBytes.toString('latin1'));
 assert(countMatch&&Number(countMatch[1])>=2,'Large AK PDF needs multiple pages');
 fs.writeFileSync(path.join(sampleDir,'M-iCare_AK_Alle-Kunden_Mehrseitig_Test.pdf'),multiBytes);
 console.log('E2E step 4c: multipage AK report and CSV injection protection passed');



 // Search a known AK even with a different selected day and employee.
 const testAk=await page.evaluate(()=>akLabel(state.appointments.find(a=>a.id==='test-appointment-1')));
 await page.evaluate(()=>{
  showScreen('plannedWorkScreen');
  document.getElementById('plannedListDate').value='2026-10-24';
  document.getElementById('plannedListEmployee').value='Anna Test';
  renderPlannedWorkScreen();
 });
 await page.locator('#plannedAkSearch').fill(testAk);
 const plannedText=await page.locator('#plannedListItems').innerText();
 assert(plannedText.includes(testAk),'AK must be found independent of date and employee');
 assert(plannedText.includes('Erfassung ansehen / korrigieren'),'Existing entry must indicate correction rather than new documentation');
 await page.locator('#plannedListItems').getByRole('button',{name:'Erfassung ansehen / korrigieren'}).first().click();
 assert.equal(await page.evaluate(()=>editId),'test-entry-1','AK search must open the existing entry');
 assert(await page.locator('#correctionPanel').isVisible(),'Existing entry should require correction reason');
 const simulatedConflict=await page.evaluate(()=>{
  const original=state.appointments.find(a=>a.id==='test-appointment-1');
  const partner={...original,id:'test-cross-appointment',akNumber:976,start:'10:00',end:'12:00'};
  state.appointments.push(partner);
  try{
   const item=datesFor(original,'2026-10-05','2026-10-05')[0];
   const clashes=akPlannedConflicts(item);
   return clashes.map(x=>({label:x.label,minutes:x.minutes}));
  }finally{state.appointments.pop()}
 });
 assert(simulatedConflict.some(x=>x.label.includes('AK 976')&&x.minutes===60),'AK conflicts show partner number and overlapping minutes');
 console.log('E2E step 4d: AK number lookup, existing-entry edit and conflict partner details passed');

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
 assert(dialogs.some(x=>x.includes('wer die Arbeitskarte korrigiert')),'Correction actor must be required');
 await page.locator('#correctionEditor').selectOption('Anna Test');
 await page.locator('#saveBtn').click();
 await page.waitForFunction(()=>state.entries.find(e=>e.id==='test-entry-1')?.orderStatus==='progress');
 const correction=await page.evaluate(()=>{
 const e=state.entries.find(e=>e.id==='test-entry-1');
 return {records:state.entries.filter(x=>x.appointmentId===e.appointmentId&&x.appointmentOccurrence===e.appointmentOccurrence).length,reasons:e.corrections?.map(c=>c.reason)||[],editedBy:e.corrections?.at(-1)?.editedBy,audit:state.changeHistory?.filter(x=>x.type==='Auftragskorrektur').length}
 });
 assert.equal(correction.records,1,'Must not duplicate planned appointment entry');
 assert(correction.reasons.includes('Aus Versehen abgeschlossen'));
 assert.equal(correction.editedBy,'Anna Test','Actual editor stored separately from executing employee');
 assert(correction.audit>=1,'Corrections must be auditable');
 console.log('E2E step 5: planned order correction passed');
 // A corrected workday must keep the original planned appointment association.
 await page.evaluate(()=>editEntry('test-entry-1'));
 await page.locator('#date').fill('06.10.2026');
 assert.equal(await page.locator('#linkedAppointment').inputValue(),'test-appointment-1|2026-10-05','The plan link must remain selected after changing actual date');
 await page.locator('#deviationReason').selectOption('Sonstiger Grund');
 await page.locator('#correctionEditor').selectOption('Ben Test');
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

 // After correcting an AK, show it in the correction-report filter and preserve link.
 await page.evaluate(()=>{
  showScreen('reportingScreen');reportOpenTab('orders');
  document.getElementById('reportFrom').value='2026-10-01';
  document.getElementById('reportTo').value='2026-10-31';
  renderReporting();
 });
 await page.locator('#reportAkSearch').fill(testAk);
 await page.locator('#reportAkCorrectionFilter').selectOption('corrected');
 assert.equal(await page.locator('#reportAkQuickSearch').inputValue(),testAk,'Quick search mirrors advanced AK filter');
 assert(await page.locator('#reportOnlyCorrectedQuick').isChecked(),'Quick correction checkbox mirrors selected filter');
 const correctedReport=await page.locator('#reportPanels').innerText();
 assert(correctedReport.includes(testAk)&&correctedReport.includes('Wer hat welche AK korrigiert?')&&correctedReport.includes('Anna Test')&&correctedReport.includes('Ben Test'),'All corrected AK and individual editors should appear');
 await page.locator('#reportCorrectionEditor').selectOption('Ben Test');
 assert((await page.locator('#reportPanels').innerText()).includes('Ben Test'),'Editor selection filters the correction report');
 await page.locator('#reportCorrectionEditor').selectOption('');
 const correctedAkLinkCount=await page.evaluate(()=>state.entries.filter(e=>e.appointmentId==='test-appointment-1'&&e.appointmentOccurrence==='2026-10-05').length);
 assert.equal(correctedAkLinkCount,1,'Reporting/search must not duplicate linked entry');
 await page.locator('#reportPanels').getByRole('button',{name:'Ansehen / korrigieren'}).first().click();
 assert.equal(await page.evaluate(()=>editId),'test-entry-1','Report edit opens same persisted entry');
 console.log('E2E step 5c: corrected AK filter and edit-through-report passed');

 // Closed AK -> progress -> done again: each genuine correction requires a reason and is audit logged.
 await page.locator('#orderStatus').selectOption('done');
 await page.locator('#correctionEditor').selectOption('Cem Test');
 await page.locator('#correctionReason').selectOption('Auftragsstatus falsch gewählt');
 await page.locator('#saveBtn').click();
 await page.waitForFunction(()=>state.entries.find(e=>e.id==='test-entry-1')?.orderStatus==='done');
 const reopened=await page.evaluate(()=>{
  const e=state.entries.find(x=>x.id==='test-entry-1');
  return {count:state.entries.filter(x=>x.appointmentId===e.appointmentId&&x.appointmentOccurrence===e.appointmentOccurrence).length,
   wasCompleted:e.wasCompleted,corrections:e.corrections?.length,last:e.corrections?.at(-1)};
 });
 assert.equal(reopened.count,1,'Reopening an AK must not create duplicate entries');
 assert(reopened.wasCompleted&&reopened.corrections>=3,'Reclosing must preserve closure history');
 assert.equal(reopened.last.reason,'Auftragsstatus falsch gewählt');
 assert.equal(reopened.last.editedBy,'Cem Test');
 assert.equal(await page.evaluate(()=>correctionActor({employee:'Inhaber'})),'Nicht erfasst','Legacy correction must not misattribute the executing employee');
 assert(reopened.last.changes.some(x=>x.field==='orderStatus'&&x.before==='progress'&&x.after==='done'));
 // Same value + correction reason is not a change and must not grow the audit trail.
 await page.evaluate(()=>editEntry('test-entry-1'));
 await page.locator('#correctionEditor').selectOption('Cem Test');
 await page.locator('#correctionReason').selectOption('Auftragsstatus falsch gewählt');
 await page.locator('#saveBtn').click();
 assert(dialogs.some(x=>x.includes('noch keine Änderung')),'No-op correction must not be saved');
 assert.equal(await page.evaluate(()=>state.entries.find(e=>e.id==='test-entry-1').corrections.length),reopened.corrections);
 // Scheduled overlaps are only planning signals; exact overlap times should be available in the editor.
 const conflictBanner=await page.evaluate(()=>{
  const a=state.appointments.find(x=>x.id==='test-appointment-1');
  const partner={...a,id:'qa-plan-conflict',akNumber:987,date:'2026-10-05',start:'10:00',end:'11:30',employee:'Inhaber'};
  const otherEmployee={...a,id:'qa-other-employee',akNumber:988,date:'2026-10-05',start:'10:00',end:'11:30',employee:'Anna Test'};
  state.appointments.push(partner,otherEmployee);
  try{
   editEntry('test-entry-1');
   const txt=document.getElementById('plannedEditorConflictInfo').textContent;
   const quality=akReportData('2026-10-01','2026-10-31').rows;
   return {txt,conflict:quality.find(r=>r.id==='test-appointment-1|2026-10-05')?.conflicts||[]};
  }finally{state.appointments=state.appointments.filter(x=>!['qa-plan-conflict','qa-other-employee'].includes(x.id))}
 });
 assert(conflictBanner.txt.includes('AK 987')&&conflictBanner.txt.includes('60 Minuten'),'Editor conflict details show correct planned overlap');
 assert(!conflictBanner.txt.includes('AK 988'),'Different employees must not be flagged as conflicting');
 assert(conflictBanner.conflict.some(x=>x.includes('AK 987')),'Report and editor use the same planned conflict');
 await page.evaluate(()=>{showScreen('reportingScreen');reportOpenTab('quality');document.getElementById('reportFrom').value='2026-10-01';document.getElementById('reportTo').value='2026-10-31';renderReporting()});
 const qaPanel=await page.locator('#reportPanels').innerText();
 assert(qaPanel.includes('Geplante AK-Überschneidungen')&&qaPanel.includes('Tatsächlich erfasste Arbeitszeitüberschneidungen'),'Planned and actual overlaps are separately explained');
 console.log('E2E step 5d: closing with reason, no-op correction block, planned-vs-actual overlap reporting passed');
 const shiftedConflict=await page.evaluate(()=>{
  const a=state.appointments.find(x=>x.id==='test-appointment-1');
  const modified={...a,id:'qa-moved',akNumber:911,exceptions:{'2026-10-05':{date:'2026-10-06',start:'10:00',end:'12:00'}}};
  const partner={...a,id:'qa-on-target',akNumber:912,date:'2026-10-06',start:'11:00',end:'13:00',employee:a.employee,exceptions:{}};
  state.appointments.push(modified,partner);
  try{
   updatePlannedEditorConflict(modified,'2026-10-05');
   const movedText=document.getElementById('plannedEditorConflictInfo').textContent;
   modified.exceptions['2026-10-05']={cancelled:true};
   updatePlannedEditorConflict(modified,'2026-10-05');
   return {movedText,hidden:document.getElementById('plannedEditorConflictInfo').classList.contains('hidden')};
  }finally{state.appointments=state.appointments.filter(x=>!['qa-moved','qa-on-target'].includes(x.id))}
 });
 assert(shiftedConflict.movedText.includes('AK 912')&&shiftedConflict.movedText.includes('60 Minuten'),'Moved order must check conflicts on actual planned date');
 assert(shiftedConflict.hidden,'Cancelled appointment must not show a conflict');
 console.log('E2E step 5e: rescheduled vs cancelled planned conflicts passed');




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
