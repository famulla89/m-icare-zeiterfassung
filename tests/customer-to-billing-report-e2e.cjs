'use strict';
const {firstRun,unlock}=require('./auth-test-helper.cjs');
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
 let acceptInvoicePrompt=false;
 page.on('dialog',async d=>{
  dialogs.push(d.message());
  if(d.message().includes('jetzt vorbereiten?')&&!acceptInvoicePrompt)await d.dismiss();
  else await d.accept();
 });
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await firstRun(page);
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
  await unlock(page);
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
  await page.locator('#appointmentsList .akAccordion').first().locator(':scope > summary').click();
  await page.locator('#appointmentsList button').filter({hasText:'Arbeit dokumentieren'}).first().click();
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

  // Inspect actual rendered brand pixels in BOTH user-triggered PDFs.
  await page.evaluate(()=>{
   window.__qaOfferInvoiceLogo=[];
   const native=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(img,...args){
    const result=native.call(this,img,...args);
    if(img instanceof HTMLImageElement && /\/logo\.svg(?:[?#]|$)/.test(img.currentSrc||img.src||'') &&
       args[0]===70 && args[1]===31 && args[2]===350 && args[3]===154){
     const px=this.getImageData(70,31,350,154).data;
     let colored=0,hash=2166136261;
     for(let i=0;i<px.length;i+=4){
      if(px[i+3]>200&&(px[i]<190||px[i+1]<190||px[i+2]<190))colored++;
      for(let n=0;n<3;n++){hash^=px[i+n];hash=Math.imul(hash,16777619)}
     }
     window.__qaOfferInvoiceLogo.push({colored,hash:hash>>>0});
    }
    return result;
   };
  });
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
  const logoOffer=await page.evaluate(()=>window.__qaOfferInvoiceLogo.at(-1));
  assert(logoOffer&&logoOffer.colored>200,'Kostenvoranschlag PDF must visibly contain the real M-iCare logo');
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
  const logoInvoice=await page.evaluate(()=>window.__qaOfferInvoiceLogo.at(-1));
  assert(logoInvoice&&logoInvoice.colored>200,'Rechnungsentwurf PDF must visibly contain the real M-iCare logo');
  assert.deepEqual(logoOffer,logoInvoice,'Offer and invoice draft MUST use exactly the same original M-iCare logo at the same size and position');
  ok('Identischer sichtbarer Firmen-Logobriefkopf in Angebot und Rechnungsentwurf',logoOffer.colored+' farbige Pixel, identischer Fingerabdruck');
  await page.waitForFunction(()=>state.quotes?.length===2);
  const invoice=await page.evaluate(()=>state.quotes.find(x=>x.kind==='invoice'));
  assert.equal(invoice.appointmentId,ak.id);assert.equal(invoice.tax,0);
  assert.equal(invoice.iban,'DE89370400440532013000');
  assert.equal(invoice.dueDate,'2026-11-17');
  ok('Rechnungsentwurf aus erledigter AK mit IBAN und PDF',invoice.number+' / '+invoice.gross+' EUR');

  // Negative practical test: an empty (white) SVG must NEVER generate an apparently valid PDF.
  const blankPage=await browser.newPage();
  await blankPage.route('**/logo.svg',route=>route.fulfill({
   status:200,contentType:'image/svg+xml',
   body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 440"><rect width="1000" height="440" fill="white"/></svg>'
  }));
  await blankPage.goto('http://127.0.0.1:'+server.address().port+'/index.html');
  await blankPage.waitForFunction(()=>Boolean(window.MiCareQuote));
  const rejectsInvisibleLogo=await blankPage.evaluate(async doc=>{
   try{await MiCareQuote.pdf(doc);return false}
   catch(e){return /Logo.*nicht sichtbar|Logo.*sichtbar|Logo/.test(String(e.message))}
  },offer);
  await blankPage.close();
  assert(rejectsInvisibleLogo,'Kostenvoranschlag must refuse PDF export when an invisible logo is served');
  ok('PDF-Export ohne sichtbares Firmenlogo blockiert');
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
  await page.waitForFunction(()=>document.querySelector('#qSavedTotals')?.textContent?.includes('3 Dokument(e)'),null,{timeout:15000});
  const overviewTotals=await page.locator('#qSavedTotals').innerText();
  assert(overviewTotals.includes('3 Dokument(e)'),'Overview must show all 3 documents; got '+overviewTotals+'; quotes='+JSON.stringify(await page.evaluate(()=>state.quotes.map(q=>q.number))));
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
  await unlock(page);
  await page.waitForFunction(()=>document.querySelector('#employee')?.options?.length>0);
  await page.locator('#home [data-jump="quoteCalculator"]').click();
  assert.equal(await page.locator('.quoteSavedItem').count(),3,'Document overview survives restart');
  assert((await page.locator('#qSavedTotals').innerText()).includes('2 Kostenvoranschläge und 1 Rechnungen (0 endgültig, 1 Entwürfe)'),'Separate document counts preserved');
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

  // Test a completed-order invoice and its email attachment, without actually delivering mail.
  await page.locator('#goHome').click();
  await page.locator('#home [data-jump="quoteCalculator"]').click();
  await page.locator('#qSavedSearch').fill(invoice.number);
  await page.locator('#qSavedList button').filter({hasText:'Bearbeiten'}).click();
  const newPdf=page.waitForEvent('download');
  await page.locator('#qFinalize').click();
  const receipt=await newPdf;
  assert.equal(fs.readFileSync(await receipt.path()).subarray(0,5).toString(),'%PDF-');
  await page.waitForFunction(id=>state.quotes.some(d=>d.id===id&&d.finalizedAt),invoice.id);
  const finalized=await page.evaluate(id=>state.quotes.find(d=>d.id===id),invoice.id);
  assert(finalized.number.startsWith('RG-2026-'));
  assert.equal(finalized.emailStatus,'not-confirmed');
  await page.locator('#qSavedSearch').fill(finalized.number);
  assert.equal(await page.locator('.quoteSavedItem button').filter({hasText:'Bearbeiten'}).count(),0);
  assert.equal(await page.locator('.quoteSavedItem button').filter({hasText:'Löschen'}).count(),0);
  const emailDownload=page.waitForEvent('download');
  await page.locator('.quoteSavedItem button').filter({hasText:'E-Mail mit PDF'}).click();
  const mail=fs.readFileSync(await (await emailDownload).path(),'utf8');
  assert(mail.includes('Content-Type: application/pdf'));
  assert(mail.includes(finalized.number+'.pdf'));
  assert(mail.includes('Content-Disposition: attachment'));
  assert.equal(await page.evaluate(id=>state.quotes.find(d=>d.id===id).emailStatus,invoice.id),'not-confirmed');
  fs.writeFileSync(path.join(out,'08_Email_mit_Rechnungs_PDF.eml'),mail);
  ok('Rechnung abgeschlossen und E-Mail mit PDF als Entwurf vorbereitet','PDF-Anhang vorhanden, kein automatischer Versand');

  // NEW offer-led workflow: 5 visits with provisional calendar dates, accepted as five OPEN AKs.
  await page.locator('#qNew').click();
  await page.locator('#qCustomer').selectOption(created.customer.id);
  await page.locator('#qObject').selectOption(created.object.id);
  await page.locator('#qScope').selectOption('windows');
  await page.locator('#qService').fill('Glas- & Fensterreinigung');
  await page.locator('#qWindowPicker [data-window="standard"]').click();
  await page.locator('.quoteWindowRow input[type="number"]').first().fill('5');
  await page.locator('#qVisits').fill('5');
  await page.locator('#qManualNet').fill('500');
  await page.locator('#qPlanDate').fill('2026-11-10');
  await page.locator('#qPlanEmployee').selectOption('Testkraft');
  await page.locator('#qPlanStart').fill('10:00');
  await page.locator('#qPlanEnd').fill('12:00');
  await page.locator('#qPlanRhythm').selectOption('7');
  const beforeScheduled=await page.evaluate(()=>state.appointments.length);
  await page.locator('#qSave').click();
  await page.waitForFunction(()=>state.quotes.some(d=>d.kind==='quote'&&d.calculation.visits===5));
  const contract=await page.evaluate(()=>state.quotes.find(d=>d.kind==='quote'&&d.calculation.visits===5));
  assert.equal(contract.net,500);
  assert.equal(await page.evaluate(()=>state.appointments.length),beforeScheduled,'Saving an unaccepted offer MUST NOT schedule employee visits');
  ok('5-Besuche-Angebot kalkuliert, ohne vorzeitige Kalendereinträge');
  await page.locator('#qSavedSearch').fill(contract.number);
  await page.locator('.quoteSavedItem button').filter({hasText:'Kunde hat angenommen'}).click();
  assert(await page.locator('#qAcceptDialog').isVisible());
  assert.equal(await page.locator('#qAcceptDate').inputValue(),'2026-11-10');
  assert.equal(await page.locator('#qAcceptStart').inputValue(),'10:00');
  assert.equal(await page.locator('#qAcceptEmployee').inputValue(),'Testkraft');
  assert.equal(await page.locator('.qAcceptAkRow').count(),5,'Acceptance dialog lists all 5 future work cards');
  assert((await page.locator('#qAcceptWorkInstructions').inputValue()).includes('Fenster'),'Offer work scope prefilled');
  await page.locator('#qAcceptWorkInstructions').fill('Fenster von innen und außen, Rahmen reinigen, Zugang über Hausmeister.');
  await page.locator('.qAcceptAkRow').nth(1).locator('[data-field="start"]').fill('11:00');
  await page.locator('#qAcceptConfirm').click();
  await page.waitForFunction(id=>state.quotes.find(d=>d.id===id)?.appointmentIds?.length===5,contract.id);
  const scheduled=await page.evaluate(id=>{
   const accepted=state.quotes.find(d=>d.id===id);
   return accepted.appointmentIds.map(aid=>state.appointments.find(a=>a.id===aid));
  },contract.id);
  assert.deepEqual(scheduled.map(a=>a.date),['2026-11-10','2026-11-17','2026-11-24','2026-12-01','2026-12-08']);
  assert(scheduled.every(a=>a.status==='open'&&a.repeat==='once'));
  assert(scheduled.every(a=>a.quoteId===contract.id));
  assert.deepEqual(scheduled.map(a=>a.plannedInvoiceNetCents),[10000,10000,10000,10000,10000]);
  assert.equal(scheduled[1].start,'11:00','Second AK time customized in acceptance dialog');
  assert(scheduled.every(a=>a.workInstructions.includes('Hausmeister')),'Scope and instructions copied from offer');
  await page.waitForFunction(()=>document.getElementById('acceptedOrdersPanel')?.getClientRects().length>0 && document.getElementById('acceptedOrdersList')?.textContent?.includes('5 Arbeitskarten'),null,{timeout:15000});
  assert(await page.locator('#acceptedOrdersPanel').isVisible(),'Accepted orders dashboard opens automatically');
  assert((await page.locator('#acceptedOrdersList').innerText()).includes(contract.number));
  assert((await page.locator('#acceptedOrdersList').innerText()).includes('5 Arbeitskarten'));
  await page.locator('#acceptedOrdersList summary').filter({hasText:'Arbeitskarten anzeigen'}).first().click();
  assert.equal(await page.locator('#acceptedOrdersList').locator('.appt').count(),5);
  assert((await page.locator('#acceptedOrdersList').innerText()).includes('Offen'));
  await page.evaluate(()=>renderAppointments());
  assert.equal(await page.locator('#acceptedOrdersList details[data-quote-id][open]').count(),1,'An expanded order must remain expanded after a calendar refresh');
  // Both large panels must be closable and reopenable.
  await page.locator('#acceptedOrdersPanel > summary').click();
  assert.equal(await page.locator('#acceptedOrdersPanel').evaluate(e=>e.open),false);
  await page.locator('#acceptedOrdersPanel > summary').click();
  assert.equal(await page.locator('#acceptedOrdersPanel').evaluate(e=>e.open),true);
  // Real AK editing in installed-style dialog: individual start/end and instructions persist.
  await page.locator('#acceptedOrdersList .appt').nth(1).locator('button').filter({hasText:'AK bearbeiten'}).click();
  assert(await page.locator('#akEditDialog').isVisible(),'Edit AK dialog opens rather than window.prompt');
  assert.equal(await page.locator('#akEditStart').inputValue(),'11:00');
  await page.locator('#akEditStart').fill('12:00');
  await page.locator('#akEditEnd').fill('14:00');
  await page.locator('#akEditInstructions').fill('Fünf Testfenster; Rahmen reinigen und Schlüssel beim Hausmeister abholen.');
  await page.locator('#akEditSave').click();
  await page.waitForFunction(id=>!document.getElementById('akEditDialog').open&&state.appointments.find(a=>a.id===id)?.start==='12:00',scheduled[1].id);
  await page.waitForFunction(async id=>(await read('app')).appointments.some(a=>a.id===id&&a.start==='12:00'),scheduled[1].id);
  assert.equal(await page.evaluate(id=>state.appointments.find(a=>a.id===id)?.end,scheduled[1].id),'14:00');
  assert((await page.evaluate(id=>state.appointments.find(a=>a.id===id)?.workInstructions,scheduled[1].id)).includes('Hausmeister'));
  await page.reload();await unlock(page);
  await page.waitForFunction(id=>state.appointments.find(a=>a.id===id)?.start==='12:00',scheduled[1].id);
  ok('AK bearbeiten funktioniert als Formular auf Windows und bleibt nach Neustart gespeichert');
  await page.evaluate(()=>showScreen('appointmentsPanel'));
  ok('Annahme-Dialog erzeugt fünf individuell bearbeitbare AK und zeigt sie in eigener Auftragsübersicht');
  assert.equal((await page.evaluate(()=>state.entries.length)),1,'Accepting a quote MUST NOT mark work as done or create worktime entries');
  await page.locator('#goHome').click();
  await page.locator('#home [data-jump="quoteCalculator"]').click();
  await page.locator('#qSavedSearch').fill(contract.number);
  await page.waitForFunction(()=>document.querySelector('#qSavedList')?.textContent?.includes('Angenommen') && !document.querySelector('#qSavedList')?.textContent?.includes('Kunde hat angenommen'));
  assert.equal(await page.locator('#qSavedList button').filter({hasText:'Kunde hat angenommen'}).count(),0,'Already accepted quote cannot create duplicates');
  await page.locator('#qSavedSearch').fill('');
  ok('Kundenannahme erzeugt fünf OFFENE AK am Wunschtermin, mit je 100 EUR');
  await page.screenshot({path:path.join(out,'09_Angenommenes_Angebot.png'),fullPage:true});
  await page.locator('#goHome').click();
  await page.locator('#home [data-jump="appointmentsPanel"]').click();
  await page.evaluate(()=>{calendarMonth='2026-11';chosenDay='2026-11-10';document.getElementById('appointmentCalendarPanel').open=true;renderAppointments()});
  const cal=await page.locator('#selectedDayList').innerText();
  assert(cal.includes('AK '+scheduled[0].akNumber),'Calendar must display real AK number');
  assert(cal.includes('Offen'),'New accepted AK must not show completed');
  assert(cal.includes('AK bearbeiten'),'Calendar must provide direct edit action');
  assert(!cal.includes('Rechnung erstellen'),'Invoice button must be absent before actual completion');
  const beforeEntry=await page.evaluate(()=>state.entries.length);
  await page.locator('#selectedDayList button').filter({hasText:'Arbeit dokumentieren'}).click();
  assert.equal(await page.locator('#orderStatus').inputValue(),'progress','Start of work must not default to completed');
  assert(await page.locator('#plannedWorkPanel').isVisible());
  await page.locator('#plannedWorkPanel > summary').click();
  assert.equal(await page.locator('#plannedWorkPanel').evaluate(e=>e.open),false);
  await page.locator('#plannedWorkPanel > summary').click();
  assert.equal(await page.locator('#plannedWorkPanel').evaluate(e=>e.open),true);
  await page.locator('#workDone').fill('Zunächst drei Zimmer gereinigt');
  await page.locator('#saveBtn').click();
  await page.waitForFunction(num=>state.entries.length>num,beforeEntry);
  let entryStatus=await page.evaluate(id=>state.entries.find(e=>e.appointmentId===id)?.orderStatus,scheduled[0].id);
  assert.equal(entryStatus,'progress');
  await page.locator('#goHome').click();
  await page.locator('#home [data-jump="appointmentsPanel"]').click();
  await page.evaluate(()=>{chosenDay='2026-11-10';calendarMonth='2026-11';document.getElementById('appointmentCalendarPanel').open=true;renderAppointments()});
  assert((await page.locator('#selectedDayList').innerText()).includes('In Bearbeitung'));
  assert(!(await page.locator('#selectedDayList').innerText()).includes('Rechnung erstellen'));
  ok('Mitarbeiter dokumentiert Zwischenstand: AK bleibt in Bearbeitung, keine Rechnung');
  await page.locator('#selectedDayList button').filter({hasText:'Arbeitszeit bearbeiten'}).click();
  await page.locator('#orderStatus').selectOption('done');
  await page.locator('#workDone').fill('Alle fünf Fenster gereinigt, Materialnachschub benötigte zusätzliche Zeit');
  await page.locator('#correctionReason').selectOption('Auftragsstatus falsch gewählt');
  await page.locator('#correctionEditor').selectOption('Testkraft');
  acceptInvoicePrompt=true;
  const offeredPartInvoice=page.waitForEvent('dialog',{timeout:15000});
  await page.locator('#saveBtn').click();
  const offerDialog=await offeredPartInvoice;
  assert(offerDialog.message().includes('Teilrechnung 1 von 5')&&offerDialog.message().includes('jetzt vorbereiten?'),'After first completion app should offer 1/5 partial invoice');
  await page.waitForFunction(id=>state.entries.some(e=>e.appointmentId===id&&e.orderStatus==='done'),scheduled[0].id);
  acceptInvoicePrompt=false;
  await page.locator('#goHome').click();
  await page.locator('#home [data-jump="appointmentsPanel"]').click();
  await page.evaluate(()=>{chosenDay='2026-11-10';calendarMonth='2026-11';document.getElementById('appointmentCalendarPanel').open=true;renderAppointments()});
  const doneText=await page.locator('#selectedDayList').innerText();
  assert(doneText.includes('Erledigt')&&doneText.includes('Rechnung erstellen'));
  await page.screenshot({path:path.join(out,'10_Kalender_Erledigt_Rechnung.png'),fullPage:true});
  await page.locator('#selectedDayList button').filter({hasText:'Rechnung erstellen'}).click();
  assert.equal(await page.locator('#qAppointment').inputValue(),scheduled[0].id);
  assert.equal(await page.locator('#qKind').inputValue(),'invoice');
  assert.equal(await page.locator('#qManualNet').inputValue(),'100.00','Only one fifth of total quote must be invoiced');
  assert.equal(await page.locator('#qVisits').inputValue(),'1');
  const partialLabel=await page.locator('#qPartInvoiceInfo').innerText();
  assert(partialLabel.includes('Teilrechnung 1 von 5')&&/100,00\s*€/.test(partialLabel),'UI must show partial invoice and agreed 1/5 amount. Actual: '+JSON.stringify(partialLabel));
  const rawPart=await page.evaluate(()=>MiCareQuoteUI.collect());
  assert.equal(rawPart.sourceVisitNumber,1);
  assert.equal(rawPart.sourceVisitCount,5);
  assert.equal(rawPart.net,100);
  assert.equal(rawPart.sourceQuoteNumber,contract.number);
  const part=await page.evaluate(()=>MiCareQuoteUI.calculate());
  assert.equal(part.net,100);assert.equal(part.tax,0);
  ok('Erledigte AK öffnet Rechnungsrechner mit korrekt anteiligem Preis 100 EUR');
  // Exact business scenario: 10 scheduled services, 1,000 EUR agreed net, one 100 EUR partial invoice.
  await page.locator('#qNew').click();
  await page.locator('#qCustomer').selectOption(created.customer.id);
  await page.locator('#qObject').selectOption(created.object.id);
  await page.locator('#qScope').selectOption('windows');
  await page.locator('#qService').fill('Glas- & Fensterreinigung');
  await page.locator('#qWindowPicker [data-window="standard"]').click();
  await page.locator('.quoteWindowRow input[type="number"]').first().fill('5');
  await page.locator('#qVisits').fill('10');
  await page.locator('#qManualNet').fill('1000');
  await page.locator('#qPlanDate').fill('2027-02-02');
  await page.locator('#qPlanEmployee').selectOption('Testkraft');
  await page.locator('#qPlanStart').fill('08:00');
  await page.locator('#qPlanEnd').fill('10:00');
  await page.locator('#qPlanRhythm').selectOption('7');
  await page.locator('#qSave').click();
  await page.waitForFunction(()=>state.quotes.some(q=>q.kind==='quote'&&q.calculation?.visits===10&&q.net===1000));
  const tenQuote=await page.evaluate(()=>state.quotes.find(q=>q.kind==='quote'&&q.calculation?.visits===10&&q.net===1000));
  await page.locator('#qSavedSearch').fill(tenQuote.number);
  await page.locator('.quoteSavedItem button').filter({hasText:'Kunde hat angenommen'}).click();
  assert.equal(await page.locator('.qAcceptAkRow').count(),10);
  await page.locator('#qAcceptConfirm').click();
  await page.waitForFunction(id=>state.quotes.find(q=>q.id===id)?.appointmentIds?.length===10,tenQuote.id);
  const firstTen=await page.evaluate(id=>{
    const quote=state.quotes.find(q=>q.id===id);
    return quote.appointmentIds.map(id=>state.appointments.find(a=>a.id===id));
  },tenQuote.id);
  assert.equal(firstTen.length,10);
  assert(firstTen.every(a=>a.plannedInvoiceNetCents===10000),'Every 1/10 visit must be priced at 100 EUR');
  assert.equal(await page.evaluate(id=>state.entries.some(e=>e.appointmentId===id),firstTen[0].id),false,'No invoice before work is done');
  await page.evaluate(async id=>{
    const a=state.appointments.find(a=>a.id===id);
    const previous=state.entries.find(e=>e.orderStatus==='done');
    const record={...(previous||{}),id:crypto.randomUUID(),appointmentId:id,appointmentOccurrence:a.date,customerId:a.customerId,objectId:a.objectId,employee:a.employee,service:a.service,date:a.date,endDate:a.date,start:a.start,end:a.end,breakMinutes:0,minutes:120,orderStatus:'done',workDone:'Fünf Testfenster gereinigt'};
    state.entries.push(record);
    await saveState();
  },firstTen[0].id);
  await page.locator('#goHome').click();
  await page.locator('#home [data-jump="appointmentsPanel"]').click();
  await page.locator('#acceptedOrdersSearch').fill(tenQuote.number);
  await page.locator('#acceptedOrdersList summary').filter({hasText:'Arbeitskarten anzeigen'}).first().click();
  await page.locator('#acceptedOrdersList button').filter({hasText:'Teilrechnung 1/10'}).click();
  assert.equal(await page.locator('#qManualNet').inputValue(),'100.00');
  assert((await page.locator('#qPartInvoiceInfo').innerText()).includes('Teilrechnung 1 von 10'));
  const tenDoc=await page.evaluate(()=>MiCareQuoteUI.collect());
  assert.equal(tenDoc.net,100);
  assert.equal(tenDoc.sourceVisitNumber,1);
  assert.equal(tenDoc.sourceVisitCount,10);
  assert.equal(tenDoc.sourceQuoteNumber,tenQuote.number);
  ok('10 Besuche 1.000 EUR: Rechnung 1/10 beträgt 100 EUR statt 1.000 EUR');
  // PDF must really render the partial-invoice heading and retain a readable PDF header.
  const invoiceHeading=await page.evaluate(async doc=>{
   let heading='';
   const original=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(txt,...args){
    if(String(txt).startsWith('TEILRECHNUNG'))heading=String(txt);
    return original.call(this,txt,...args);
   };
   try{
    const pdf=await MiCareQuote.pdf({...doc,finalizedAt:'2026-10-25T00:00:00Z'});
    const bytes=new Uint8Array(await pdf.arrayBuffer());
    return {heading,pdfHeader:String.fromCharCode(...bytes.slice(0,5))};
   }finally{CanvasRenderingContext2D.prototype.fillText=original}
  },tenDoc);
  assert.equal(invoiceHeading.heading,'TEILRECHNUNG');
  assert.equal(invoiceHeading.pdfHeader,'%PDF-');
  const tenDownload=page.waitForEvent('download');
  await page.locator('#qFinalize').click();
  const finalTenPdf=await tenDownload;
  const partPdfBytes=fs.readFileSync(await finalTenPdf.path());
  assert.equal(partPdfBytes.subarray(0,5).toString(),'%PDF-');
  fs.writeFileSync(path.join(out,'12_Teilrechnung_1_von_10_mit_Logo.pdf'),partPdfBytes);
  await page.waitForFunction(id=>state.quotes.some(x=>x.kind==='invoice'&&x.finalizedAt&&x.appointmentId===id),firstTen[0].id);
  const finalTen=await page.evaluate(id=>state.quotes.find(x=>x.kind==='invoice'&&x.finalizedAt&&x.appointmentId===id),firstTen[0].id);
  assert.equal(finalTen.net,100);
  assert.equal(finalTen.sourceVisitNumber,1);
  assert.equal(finalTen.sourceVisitCount,10);
  assert.equal(finalTen.sourceQuoteNumber,tenQuote.number);
  assert.equal(await page.evaluate(id=>state.quotes.filter(q=>q.finalizedAt&&q.appointmentId===id).length,firstTen[0].id),1);
  ok('TEILRECHNUNG 1/10 als endgültiges PDF mit 100 EUR erstellt, genau einmal gespeichert');
  await page.evaluate(()=>{showScreen('appointmentsPanel');renderAppointments()});
  await page.locator('#acceptedOrdersSearch').fill(tenQuote.number);
  const tenOrderDetails=page.locator('#acceptedOrdersList details[data-quote-id="'+tenQuote.id+'"]');
  assert.equal(await tenOrderDetails.count(),1,'Accepted contract found after filtering');
  if(!await tenOrderDetails.evaluate(node=>node.open))await tenOrderDetails.locator(':scope > summary').click();
  assert.equal(await tenOrderDetails.locator('.appt').first().locator('button').filter({hasText:'Teilrechnung 1/10 erstellen'}).count(),0,'A paid AK must not offer another invoice');
  const billedRow=await tenOrderDetails.locator('.appt').first().innerText();
  assert(billedRow.includes('Rechnung erstellt'),'Already billed AK must clearly show its invoice status');
  ok('Abgerechnete Arbeitskarte bietet keine zweite Teilrechnung an');
  // UI MASK REGRESSION: Main work areas must load without missing fields or exceptions.
  const requiredMasks={
   home:['micareContractReminders'],
   customersPanel:['selectedCustomer','selectedObject','editCustomerName','editCustomerEmail','saveCustomerChanges'],
   customerOverviewScreen:['customerSearch'],
   appointmentsPanel:['acceptedOrdersPanel','acceptedOrdersSearch','acceptedOrdersFilter','appointmentCalendarPanel','appointmentForm','appointmentsList'],
   quoteCalculator:['qCustomer','qObject','qAppointment','qPlanDate','qPlanEmployee','qPlanStart','qPlanEnd','qAcceptDialog','qAcceptPlanRows','qAcceptWorkInstructions','qSavedList'],
   plannedWorkScreen:['plannedListItems'],
   dailyWorkOverview:['dailyOverviewDate','dailyOverviewAppointments'],
   entryForm:['date','start','end','orderStatus','workDone'],
   history:['orderOverviewList','historyMonth'],
   reportingScreen:['reportHome','reportHomeStats'],
   backupSection:['importJson','loadCustomersFile','exportCustomersJson'],
   management:['newEmployee']
  };
  for(const [screen,fields] of Object.entries(requiredMasks)){
   await page.evaluate(s=>showScreen(s),screen);
   assert(await page.locator('#'+screen).isVisible(),'Screen '+screen+' must be visible');
   const missed=await page.evaluate(fields=>fields.filter(id=>!document.getElementById(id)),fields);
   assert.deepEqual(missed,[],'Missing required inputs on '+screen);
  }
  ok('Alle 12 Hauptmasken öffnen ohne fehlende kritische Eingabefelder oder JavaScriptfehler');
  assert.deepEqual(errors,[],'No unhandled browser JavaScript errors');
  fs.writeFileSync(path.join(out,'QA-ERGEBNIS.json'),JSON.stringify({created:new Date().toISOString(),customer:created.customer.publicNumber,object:created.object.publicNumber,ak:ak.akNumber,date:ak.date,offer:offer.number,invoiceDraft:invoice.number,tests:checkpoints,dialogs},null,2));
  console.log('WORKFLOW ALL PASS: '+checkpoints.length+' checkpoints');
 }catch(e){fs.writeFileSync(path.join(out,'QA-FEHLER.txt'),String(e.stack||e)+'\n\n'+JSON.stringify(checkpoints,null,2));console.error('WORKFLOW FAILED',e);process.exitCode=1;try{await page.screenshot({path:path.join(out,'FEHLER-Screenshot.png'),fullPage:true})}catch{}}
 finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
