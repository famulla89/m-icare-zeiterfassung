'use strict';
// Full realistic UI path: create customer/object, plan AK, complete, quote, invoice draft, standalone quote, reporting.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-output','workflow-e2e');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
 let u;try{u=new URL(req.url,'http://localhost')}catch{return res.writeHead(400).end()}
 let filename=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
 if(filename!==root&&!filename.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(filename,(err,buf)=>err?res.writeHead(404).end():res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream'}).end(buf));
});
const checkpoints=[];
function ok(name,details){checkpoints.push({name,result:'PASS',details:details||''});console.log('WORKFLOW PASS:',name,details||'')}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1400,height:980},acceptDownloads:true});
 page.setDefaultTimeout(15000);
 const errors=[],dialogs=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('dialog',async d=>{dialogs.push(d.message());await d.accept()});
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
  await page.waitForFunction(()=>document.querySelector('#employee')?.options?.length>0);
  await page.evaluate(async()=>{
   state={version:1,employees:['Testkraft'],entries:[],customers:[],objects:[],appointments:[],appointmentTrash:[],changeHistory:[],quotes:[],quoteSettings:{TaxMode:'small'},lastSave:null,lastBackup:null};
   await saveState();updateCustomerSelects();fillEmployees();renderCustomers();renderAppointments();
  });
  assert.equal(await page.evaluate(()=>state.customers.length),0);
  ok('Datenbank mit leeren synthetischen Testdaten initialisiert');

  // Real customer editor buttons, no preloaded customer fixture.
  await page.locator('#home [data-jump="customersPanel"]').click();
  await page.locator('#newCustomerMode').click();
  await page.locator('#editCustomerName').fill('QA Muster Gebäudeservice');
  await page.locator('#editCustomerAddress').fill('Teststraße 7');
  await page.locator('#editCustomerZip').fill('58095');
  await page.locator('#editCustomerCity').fill('Hagen');
  await page.locator('#editCustomerEmail').fill('synthetisch@example.invalid');
  await page.locator('#newObjectName').fill('Büro Etage 2');
  await page.locator('#newObjectAddress').fill('Beispielweg 11');
  await page.locator('#newObjectZip').fill('58095');
  await page.locator('#newObjectCity').fill('Hagen');
  await page.locator('#saveCustomerChanges').click();
  await page.waitForFunction(()=>state.customers.length===1&&state.objects.length===1);
  const created=await page.evaluate(()=>({customer:state.customers[0],object:state.objects[0]}));
  assert.equal(created.customer.name,'QA Muster Gebäudeservice');
  assert.equal(created.object.customerId,created.customer.id);
  assert.equal(created.customer.publicNumber,'1');
  assert.equal(created.object.publicNumber,'1.1');
  await page.screenshot({path:path.join(out,'01_Kunde_Objekt.png'),fullPage:true});
  ok('Kunde und Geschäftsstelle per Bedienoberfläche angelegt','Kunde '+created.customer.publicNumber+' / Objekt '+created.object.publicNumber);

  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#employee')?.options?.length>0);
  await page.waitForFunction(()=>state.customers.length===1&&state.objects.length===1);
  ok('Kunden- und Objektdaten nach Neustart persistent');

  // Plan one-time real AK on November 3.
  await page.locator('#home [data-jump="appointmentsPanel"]').click();
  await page.locator('#appointmentCreatePanel summary').click();
  await page.locator('#appointmentCustomer').selectOption(created.customer.id);
  await page.locator('#appointmentObject').selectOption(created.object.id);
  await page.locator('#appointmentService').selectOption('Glas- & Fensterreinigung');
  await page.locator('#appointmentCustomTitle').fill('Fensterreinigung 5 Fenster');
  await page.evaluate(()=>{
    for(const [id,value] of [['appointmentDate','2026-11-03'],['appointmentStart','09:00'],['appointmentEnd','11:00']]){
      const n=document.getElementById(id);n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  await page.locator('#appointmentRepeat').selectOption('once');
  await page.locator('#appointmentForm button[type="submit"]').click();
  await page.waitForFunction(()=>state.appointments.length===1);
  const ak=await page.evaluate(()=>state.appointments[0]);
  assert.equal(ak.customerId,created.customer.id);assert.equal(ak.objectId,created.object.id);
  assert.equal(ak.date,'2026-11-03');assert.equal(ak.start,'09:00');assert.equal(ak.end,'11:00');
  assert(ak.akNumber,'New AK needs its number after saving');
  await page.evaluate(()=>{calendarMonth='2026-11';chosenDay='2026-11-03';renderAppointments()});
  await page.locator('#appointmentCalendarPanel summary').click();
  assert((await page.locator('#selectedDayList').innerText()).includes('QA Muster Gebäudeservice'));
  assert((await page.locator('#selectedDayList').innerText()).includes('Offen'));
  await page.screenshot({path:path.join(out,'02_Termin_AK_offen.png'),fullPage:true});
  ok('Termin und offene Arbeitskarte im Kalender','AK '+ak.akNumber+', 03.11.2026 09–11 Uhr');

  // Complete existing AK via the actual UI and timesheet form.
  await page.evaluate(()=>renderAppointments());
  await page.locator('#appointmentsList button').filter({hasText:'Als erledigt erfassen'}).first().click();
  assert(await page.locator('#plannedEditorScreen').isVisible(),'Completion should open planned work editor');
  await page.locator('#workDone').fill('5 Fenster beidseitig gereinigt, Rahmen abgewischt');
  await page.locator('#orderStatus').selectOption('done');
  await page.locator('#saveBtn').click();
  await page.waitForFunction(()=>state.entries.length===1);
  const done=await page.evaluate(()=>state.entries[0]);
  assert.equal(done.appointmentId,ak.id);
  assert.equal(done.orderStatus,'done');
  assert.equal(done.appointmentOccurrence,'2026-11-03');
  assert.equal(done.customerId,created.customer.id);
  ok('Arbeitskarte als erledigt dokumentiert','Ist-Zeit gespeichert, Status erledigt');

  // Offer based on the completed AK, with SME tax mode and actual matching customer/date.
  await page.locator('#goHome').click();
  await page.locator('#home [data-jump="quoteCalculator"]').click();
  assert.equal(await page.locator('#qSellerName').inputValue(),'M-iCare Gebäudereinigung','Public company name defaults into empty form');
  assert.equal(await page.locator('#qSellerAddress').inputValue(),'Lippestraße 9, 58097 Hagen','Public company address defaults into empty form');
  assert.equal(await page.locator('#qSellerEmail').inputValue(),'info@m-icare-gebaeudereinigung.de','Public contact email defaults into empty form');
  assert.equal(await page.locator('#qSellerPhone').inputValue(),'0162 8564663','Public phone defaults into empty form');
  assert.equal(await page.locator('#qSellerTax').inputValue(),'','No fictitious tax number may be inserted');
  assert.equal(await page.locator('#qIban').inputValue(),'','No fictitious bank account may be inserted');
  await page.locator('#qSellerAddress').fill('Individuell hinterlegte Firmenadresse');
  await page.locator('#qIban').fill('DE89370400440532013000');
  await page.locator('#qApplyPublicCompany').click();
  assert.equal(await page.locator('#qSellerAddress').inputValue(),'Lippestraße 9, 58097 Hagen','Explicit button applies public address');
  assert.equal(await page.locator('#qIban').inputValue(),'DE89370400440532013000','Preset does not change bank details');
  await page.locator('#qCustomer').selectOption(created.customer.id);
  await page.locator('#qObject').selectOption(created.object.id);
  await page.locator('#qAppointment').selectOption(ak.id);
  assert.equal(await page.locator('#qVisits').inputValue(),'1','One-time AK must default to exactly one service visit');
  assert.equal(await page.locator('#qScope').inputValue(),'windows');
  await page.locator('#qWindowPicker [data-window="standard"]').click();
  await page.locator('.quoteWindowRow input[type="number"]').first().fill('5');
  await page.locator('#qManualNet').fill('149');
  await page.locator('#qSellerName').fill('M-iCare Testfirma');
  await page.locator('#qSellerAddress').fill('Fiktivstraße 8, 58095 Hagen');
  await page.locator('#qSellerTax').fill('QA-123456');
  await page.locator('#qIban').fill('DE89370400440532013000');
  await page.locator('#qValidUntil').fill('2026-11-23');
  const quoteValue=await page.evaluate(()=>MiCareQuoteUI.calculate());
  assert.equal(quoteValue.net,149);assert.equal(quoteValue.tax,0);
  await page.locator('#qSave').click();
  await page.waitForFunction(()=>state.quotes?.length===1);
  const offer=await page.evaluate(()=>state.quotes[0]);
  assert.equal(offer.appointmentId,ak.id);assert.equal(offer.customerId,created.customer.id);
  assert.equal(offer.taxMode,'small');assert.equal(offer.orderNumber.includes(String(ak.akNumber)),true);
  assert.equal(offer.calculation.visits,1,'Offer must contain only one service visit');
  assert(offer.rows.every(r=>!r.title.includes('8 Einsätze')),'Offer must not secretly quote eight visits');
  await page.screenshot({path:path.join(out,'03_Angebot_AK.png'),fullPage:true});
  const offerDownload=page.waitForEvent('download');await page.locator('#qPdf').click();
  const offerFile=await offerDownload;
  const offerBytes=fs.readFileSync(await offerFile.path());assert.equal(offerBytes.subarray(0,5).toString(),'%PDF-');
  fs.writeFileSync(path.join(out,'03_Kostenvoranschlag_AK_03-11-2026.pdf'),offerBytes);
  ok('Kostenvoranschlag mit Arbeitskarte, Kleinunternehmer und PDF',offer.number+' / '+offer.gross+' EUR');

  // Invoice must remain a DRAFT; app has no legally final invoice or mail automation yet.
  await page.locator('#qNew').click();
  await page.locator('#qCustomer').selectOption(created.customer.id);
  await page.locator('#qObject').selectOption(created.object.id);
  await page.locator('#qAppointment').selectOption(ak.id);
  assert.equal(await page.locator('#qVisits').inputValue(),'1','Invoice must inherit one-time AK visit count');
  await page.locator('#qWindowPicker [data-window="standard"]').click();
  await page.locator('.quoteWindowRow input[type="number"]').first().fill('5');
  await page.locator('#qManualNet').fill('149');
  await page.locator('#qKind').selectOption('invoice');
  await page.locator('#qValidUntil').fill('2026-11-17');
  const invoiceDownload=page.waitForEvent('download');
  await page.locator('#qPdf').click();
  const invoiceFile=await invoiceDownload;
  const invoiceBytes=fs.readFileSync(await invoiceFile.path());assert.equal(invoiceBytes.subarray(0,5).toString(),'%PDF-');
  fs.writeFileSync(path.join(out,'04_Rechnungsentwurf_AK_03-11-2026.pdf'),invoiceBytes);
  await page.waitForFunction(()=>state.quotes?.length===2);
  const invoice=await page.evaluate(()=>state.quotes.find(x=>x.kind==='invoice'));
  assert.equal(invoice.appointmentId,ak.id);assert.equal(invoice.tax,0);
  assert.equal(invoice.iban,'DE89370400440532013000');
  assert.equal(invoice.dueDate,'2026-11-17');
  ok('Rechnungsentwurf aus erledigter AK mit IBAN und PDF',invoice.number+' / '+invoice.gross+' EUR');

  // Independent quote without any AK.
  await page.locator('#qNew').click();
  await page.locator('#qCustomer').selectOption(created.customer.id);
  assert.equal(await page.locator('#qAppointment').inputValue(),'');
  await page.locator('#qScope').selectOption('other');
  await page.locator('#qService').fill('Sonderreinigung Treppenhaus – telefonische Anfrage');
  await page.locator('#qHours').fill('2');
  await page.locator('#qManualNet').fill('95');
  await page.locator('#qKind').selectOption('quote');
  await page.locator('#qSave').click();
  await page.waitForFunction(()=>state.quotes?.length===3);
  const standalone=await page.evaluate(()=>state.quotes.find(x=>x.kind==='quote'&&!x.appointmentId));
  assert(standalone,'Independent quotation must exist without AK');
  assert.equal(standalone.gross,95);assert.equal(standalone.tax,0);
  ok('Freier Kostenvoranschlag ohne Arbeitskarte','95 EUR, ohne Umsatzsteuer');
  // All saved documents: search by number/customer/AK, filter type and re-export existing PDF.
  assert((await page.locator('#qSavedTotals').innerText()).includes('3 Dokument(e)'),'Overview must show all 3 documents');
  assert.equal(await page.locator('.quoteSavedItem').count(),3);
  await page.locator('#qSavedType').selectOption('invoice');
  assert.equal(await page.locator('.quoteSavedItem').count(),1,'Invoice-only filter');
  assert((await page.locator('#qSavedList').innerText()).includes(invoice.number));
  const reprint=page.waitForEvent('download');
  await page.locator('.quoteSavedItem button').filter({hasText:'PDF'}).first().click();
  const savedPdf=await reprint;
  const savedPdfBytes=fs.readFileSync(await savedPdf.path());
  assert(savedPdfBytes.length>5000&&savedPdfBytes.subarray(0,5).toString()==='%PDF-','Saved invoice draft can be exported as PDF again');
  await page.locator('#qSavedType').selectOption('all');
  await page.locator('#qSavedSearch').fill(offer.number);
  assert.equal(await page.locator('.quoteSavedItem').count(),1,'Search by document number');
  assert((await page.locator('#qSavedList').innerText()).includes(offer.number));
  await page.locator('#qSavedSearch').fill('keine-uebereinstimmung');
  assert.equal(await page.locator('.quoteSavedItem').count(),0,'Empty search displays no items');
  await page.locator('#qSavedSearch').fill('');
  await page.locator('#qSavedSearch').fill('AK '+ak.akNumber);
  assert.equal(await page.locator('.quoteSavedItem').count(),2,'Search by assigned AK finds offer and invoice');
  await page.locator('#qSavedSearch').fill('');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#employee')?.options?.length>0);
  await page.locator('#home [data-jump="quoteCalculator"]').click();
  assert.equal(await page.locator('.quoteSavedItem').count(),3,'Document overview survives restart');
  assert((await page.locator('#qSavedTotals').innerText()).includes('2 Kostenvoranschläge und 1 Rechnungsentwürfe'),'Separate document counts preserved');
  await page.screenshot({path:path.join(out,'04_Dokumentenuebersicht.png'),fullPage:true});
  ok('Dokumentenübersicht mit Suche, Typfilter, PDF-Nachdruck und Neustart','3 gespeicherte Dokumente');

  // Reporting from the same actual UI-made data and dates.
  await page.locator('#goHome').click();
  await page.locator('#home [data-jump="reportingScreen"]').click();
  await page.locator('[data-open-report="orders"]').click();
  await page.evaluate(()=>{
   document.getElementById('reportFrom').value='2026-11-01';
   document.getElementById('reportTo').value='2026-11-30';
   renderReporting();
  });
  const report=await page.locator('#reportPanels').innerText();
  assert(report.includes('QA Muster Gebäudeservice'),'Report must show newly created customer');
  assert(report.includes('Fensterreinigung'),'Report must show order service');
  assert(report.includes(String(ak.akNumber)),'Report must show new AK');
  await page.screenshot({path:path.join(out,'05_Reporting_Auftraege.png'),fullPage:true});
  await page.evaluate(()=>MiCareReportPrint.prepare());
  await page.emulateMedia({media:'print'});
  const reportPdf=await page.pdf({format:'A4',landscape:true,printBackground:true,preferCSSPageSize:true});
  assert.equal(reportPdf.subarray(0,5).toString(),'%PDF-');
  fs.writeFileSync(path.join(out,'05_Reporting_Auftraege_November.pdf'),reportPdf);
  await page.emulateMedia({media:'screen'});
  await page.evaluate(()=>{document.getElementById('reportPrintSnapshot')?.remove();document.getElementById('reportPrintOnly')?.remove()});
  ok('Reporting Aufträge/Soll-Ist mit echter AK und PDF','November 2026');

  await page.locator('#reportBack').click();
  await page.locator('[data-open-report="customers"]').click();
  await page.evaluate(()=>{document.getElementById('reportFrom').value='2026-11-01';document.getElementById('reportTo').value='2026-11-30';renderReporting()});
  const customerReport=await page.locator('#reportPanels').innerText();
  assert(customerReport.includes('QA Muster Gebäudeservice'));
  await page.screenshot({path:path.join(out,'06_Reporting_Kunden.png'),fullPage:true});
  ok('Reporting Kunden und Geschäftsstellen','Neu angelegter Kunde erscheint in der Auswertung');

  assert.deepEqual(errors,[],'No unhandled browser JavaScript errors');
  fs.writeFileSync(path.join(out,'QA-ERGEBNIS.json'),JSON.stringify({created:new Date().toISOString(),customer:created.customer.publicNumber,object:created.object.publicNumber,ak:ak.akNumber,date:ak.date,offer:offer.number,invoiceDraft:invoice.number,tests:checkpoints,dialogs},null,2));
  console.log('WORKFLOW ALL PASS: '+checkpoints.length+' checkpoints');
 }catch(e){fs.writeFileSync(path.join(out,'QA-FEHLER.txt'),String(e.stack||e)+'\n\n'+JSON.stringify(checkpoints,null,2));console.error('WORKFLOW FAILED',e);process.exitCode=1;try{await page.screenshot({path:path.join(out,'FEHLER-Screenshot.png'),fullPage:true})}catch{}}
 finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
