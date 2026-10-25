'use strict';
/* Umfassende synthetische PDF-Regression für ALLE PDF-Exportfunktionen. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-output','pdf');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 let url;try{url=new URL(req.url,'http://localhost')}catch{return res.writeHead(400).end()}
 const name=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(name!==root&&!name.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(name,(err,data)=>{if(err)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(name)]||'application/octet-stream'});res.end(data)});
});
function verifyPdf(name,bytes,{text,expectPagesMin=1}={}){
 const file=path.join(out,name);fs.writeFileSync(file,bytes);
 assert.equal(bytes.subarray(0,5).toString(),'%PDF-','Invalid PDF header '+name);
 assert(bytes.length>1500,'PDF unexpectedly small '+name);
 const info=execFileSync('pdfinfo',[file],{encoding:'utf8'});
 const pages=Number(info.match(/^Pages:\s+(\d+)/m)?.[1]||0);
 assert(pages>=expectPagesMin&&pages<=50,'Invalid page count for '+name+': '+pages);
 if(text){
  const actual=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});
  for(const word of text.must||[])assert(actual.includes(word),name+' missing '+word);
  for(const word of text.not||[])assert(!actual.includes(word),name+' unexpectedly prints UI text '+word);
 }
 return {name,pages,bytes:bytes.length};
}
let activeBrowser=null;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});activeBrowser=browser;
 const page=await browser.newPage({viewport:{width:1450,height:1100},acceptDownloads:true});
 page.setDefaultTimeout(15000);
 const jsErrors=[];page.on('pageerror',e=>jsErrors.push(String(e)));
 page.on('dialog',async d=>d.accept());
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await page.waitForFunction(()=>document.querySelector('#employee')?.options?.length>0);
 await page.evaluate(()=>{
  window.__qaLogoDraws=[];
  const original=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
   if(image instanceof HTMLImageElement && /\/logo\.svg(?:$|[?#])/.test(image.currentSrc||image.src||''))
    window.__qaLogoDraws.push({width:image.naturalWidth,height:image.naturalHeight});
   return original.call(this,image,...args);
  };
 });
 async function checkPdfLogo(name,pages,before){
  const draws=await page.evaluate(start=>window.__qaLogoDraws.slice(start),before);
  assert(draws.length>=pages,name+' missing M-iCare logo on some PDF pages: '+draws.length+' logo draws for '+pages+' pages');
  assert(draws.every(l=>l.width>0&&l.height>0),name+' uses an invalid logo image');
 }
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'testdata/micare-10-kunden.json'),'utf8'));
 await page.evaluate(async d=>{
  state=structuredClone(d);state.changeHistory??=[];state.appointmentTrash??=[];state.quotes??=[];state.quoteSettings??={};
  await saveState();render();updateCustomerSelects();fillEmployees();
 },fixture);
 const results=[];
 async function fromBlob(name,expression,options){
  const logoBefore=await page.evaluate(()=>window.__qaLogoDraws.length);
  const base64=await page.evaluate(async code=>{
   const blob=await(0,eval)(code);
   if(!(blob instanceof Blob))throw Error('PDF export did not return Blob');
   const reader=new FileReader();
   return await new Promise((resolve,reject)=>{reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
  },expression);
  const bytes=Buffer.from(base64,'base64');
  const result=verifyPdf(name,bytes,options);results.push(result);await checkPdfLogo(name,result.pages,logoBefore);console.log('PDF PASS',result.name,result.pages,Math.round(result.bytes/1024)+'KB');
 }
 async function downloaded(name,fn){
  const logoBefore=await page.evaluate(()=>window.__qaLogoDraws.length);
  const promise=page.waitForEvent('download',{timeout:30000});await fn();
  const d=await promise;const bytes=fs.readFileSync(await d.path());const result=verifyPdf(name,bytes);results.push(result);await checkPdfLogo(name,result.pages,logoBefore);console.log('PDF PASS',result.name,result.pages,Math.round(result.bytes/1024)+'KB');
 }
 // 1. Arbeitszeiten Monatsauswertung – mit Daten + leerer Monat.
 await fromBlob('01_Monatszeiten_Oktober_mit_Einsaetzen.pdf',"createMonthlyPdf('2026-10')");
 await fromBlob('02_Monatszeiten_leerer_Monat.pdf',"createMonthlyPdf('2027-02')");
 // 2. AK-Auftragsstatus – Gesamt, offen, erledigt, leer und Jahresmodus.
 await page.evaluate(()=>{document.getElementById('historyMonth').value='2026-10';document.getElementById('reportMode').value='month';document.getElementById('reportWholeYear').checked=false;document.getElementById('reportWholeMonth').checked=true;document.getElementById('reportAllCustomers').checked=true});
 await fromBlob('03_AK_Status_alle_Oktober.pdf',"createOrderStatusPdf('2026-10','')");
 await fromBlob('04_AK_Status_offen.pdf',"createOrderStatusPdf('2026-10','open')");
 await fromBlob('05_AK_Status_fertig.pdf',"createOrderStatusPdf('2026-10','done')");
 // historyMonth ist eine Select-Liste vorhandener Monate: 2028-01 lässt sich dort
 // nicht als unzulässige Option setzen. Deshalb für einen leeren Zeitraum Tag-Modus nutzen.
 await page.evaluate(()=>{document.getElementById('reportMode').value='day';document.getElementById('reportDay').value='2028-01-12';document.getElementById('reportWholeMonth').checked=false;document.getElementById('reportWholeYear').checked=false;});
 const emptyRange=await page.evaluate(()=>reportRange());
 assert.equal(emptyRange.from,'2028-01-12','Empty AK report must actually cover 2028-01-12');
 await fromBlob('06_AK_Status_ohne_Termine.pdf',"createOrderStatusPdf('2028-01','')");
 await page.evaluate(()=>{document.getElementById('reportMode').value='month';document.getElementById('reportWholeMonth').checked=true;document.getElementById('historyMonth').value='2026-10'});
 // 3. Kundenübersicht und Kundendetail: auch archivierte Kunden.
 await page.evaluate(()=>{showScreen('customerOverviewScreen');document.getElementById('customerStateFilter').value='all';document.getElementById('customerSearch').value='';renderAllCustomers()});
 await downloaded('07_Kundenliste_alle.pdf',()=>page.evaluate(()=>exportAllCustomersPdf()));
 await page.evaluate(()=>{document.getElementById('customerSearch').value='1.2';renderAllCustomers()});
 await downloaded('08_Kundenliste_nur_Objekt_1_2.pdf',()=>page.evaluate(()=>exportAllCustomersPdf()));
 await page.evaluate(()=>{showScreen('customersPanel');document.getElementById('selectedCustomer').value='test-customer-1'});
 await downloaded('09_Kundendetail.pdf',()=>page.evaluate(()=>exportCustomerPdf()));
 // 4. Angebots-PDF und Rechnungsentwurf mit Firmenlogo und deutschem Datum.
 const newDocument=await page.evaluate(()=>{
  const data=MiCareQuote.compute({scope:'windows',mode:'business',serviceName:'Fensterreinigung',
   area:200,visits:1,hours:2,sqmPerHour:100,hourly:20,nonwage:20,overhead:15,productivity:90,
   material:2,km:8,perKm:0.7,margin:25,minNet:0,vat:19,manualNet:0,
   windowItems:[{label:'Standardfenster',qty:10,each:1.5,rate:8,sides:2,soil:1.3,frame:true,ladder:true,lift:false}]});
  const d={id:'synthetic-qa-offer',kind:'quote',number:'KV-QA-2026-001',date:'2026-10-25',
   customerName:'Nordstern Büroservice GmbH',customerAddress:'Musterweg 1, 58095 Hagen',
   sellerName:'M-iCare Testfirma',sellerAddress:'Teststraße 2, 58095 Hagen',sellerTaxId:'QA-123',
   sellerEmail:'synthetisch@example.invalid',service:'Glas- & Fensterreinigung',serviceDate:'2026-10-19',validUntil:'2026-11-23',
   rows:data.rows,net:data.net,tax:data.tax,gross:data.gross,vat:data.vat};
  return d;
 });
 await page.evaluate(d=>{window.__qaQuoteDoc=d},newDocument);
 await fromBlob('10_Kostenvoranschlag_Logo_Datum.pdf',"MiCareQuote.pdf(window.__qaQuoteDoc)");
 await page.evaluate(()=>{window.__qaQuoteDoc.kind='invoice';window.__qaQuoteDoc.number='RG-ENTWURF-2026-001';window.__qaQuoteDoc.dueDate='2026-12-08';});
 await fromBlob('11_Rechnungsentwurf_Logo_Zahlungsziel.pdf',"MiCareQuote.pdf(window.__qaQuoteDoc)");
 await page.evaluate(()=>{
  window.__qaQuoteDoc.kind='quote';window.__qaQuoteDoc.validUntil='2026-11-23';
  const items=Array.from({length:8},(_,i)=>({id:String(i),label:'Fensterart '+(i+1),qty:1,each:i+1,rate:7,sides:2,soil:1,frame:false,ladder:false,lift:false}));
  const data=MiCareQuote.compute({scope:'windows',area:200,visits:1,hours:2,sqmPerHour:100,hourly:20,nonwage:20,overhead:15,productivity:90,material:3,km:5,perKm:0.70,margin:25,minNet:0,vat:19,manualNet:0,windowItems:items});
  Object.assign(window.__qaQuoteDoc,{rows:data.rows,net:data.net,tax:data.tax,gross:data.gross,vat:data.vat});
 });
 await fromBlob('12_Kostenvoranschlag_8_Fensterpositionen_Mehrseitig.pdf',"MiCareQuote.pdf(window.__qaQuoteDoc)",{expectPagesMin:2});
 // 5. Alle druckbaren Reporting-Reiter: Browser-Druck-PDF statt Webseiten-Screenshot.
 await page.evaluate(()=>{showScreen('reportingScreen');document.getElementById('reportFrom').value='2026-10-01';document.getElementById('reportTo').value='2026-10-31';});
 for(const [tab,filename] of [
  ['overview','13_Reporting_Management.pdf'],
  ['employees','14_Reporting_Mitarbeiter.pdf'],
  ['customers','15_Reporting_Kunden_Objekte.pdf'],
  ['orders','16_Reporting_Auftraege_Soll_Ist.pdf'],
  ['services','17_Reporting_Leistungen.pdf'],
  ['quality','18_Reporting_Konflikte.pdf']
 ]){
  await page.evaluate(tab=>{reportOpenTab(tab);MiCareReportPrint.prepare()},tab);
  const data=await page.evaluate(()=>({
   h:document.querySelector('#reportPrintSnapshot h1')?.textContent,
   forms:document.querySelector('#reportPrintSnapshot')?.querySelectorAll('button,input,select,textarea').length||0,
   cols:[...document.querySelectorAll('#reportPrintSnapshot .printMainAK thead th')].map(x=>x.textContent),
   sections:document.querySelectorAll('#reportPrintSnapshot .objectPanel').length
  }));
  const reportLogo=await page.evaluate(()=>{
   const image=document.querySelector('#reportPrintSnapshot .printReportHeader img');
   return {source:image?.src||'',width:image?.naturalWidth||0,height:image?.naturalHeight||0};
  });
  assert(reportLogo.source.endsWith('/logo.svg')&&reportLogo.width>0&&reportLogo.height>0,
   'Reporting PDF '+filename+' must show loaded original M-iCare logo');
  assert.equal(data.forms,0,'PDF snapshot must not contain interactive controls');
  assert(data.sections>0,'PDF snapshot must have report content');
  if(tab==='orders'){
   assert.equal(data.cols.length,10,'13-column AK table reduced to 10');
   assert(!data.cols.includes('Aktion'),'No clickable action column');
   const conflicts=await page.evaluate(()=>[...document.querySelectorAll('#reportPrintSnapshot .printMainAK tbody tr')].map(tr=>tr.lastElementChild.textContent));
   assert(conflicts.every(v=>/^(Nein|Ja \([0-9]+\))$/.test(v)),'Conflict details must be compact in print');

  }
  await page.emulateMedia({media:'print'});
  const hidden=await page.evaluate(()=>({
   snapshot:getComputedStyle(document.getElementById('reportPrintSnapshot')).display,
   original:getComputedStyle(document.getElementById('reportingScreen')).display
  }));
  assert.equal(hidden.snapshot,'block');
  assert.equal(hidden.original,'none','Original interactive report MUST be hidden in PDF');
  const bytes=await page.pdf({format:'A4',landscape:true,printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
  const o=verifyPdf(filename,bytes,{text:{must:[data.h,'Zeitraum:'],not:['Arbeitskarte direkt suchen','Ansehen / korrigieren','Dokumentieren','Tagesbackup herunterladen','Alle Berichte']}});
  // Eine gelungene erste Seite genügt nicht: Kopf, Datum und Firmenlogo
  // müssen auch auf jeder weiteren Seite erscheinen. Der Druckkopf ist fixiert.
  for(let pageNum=1;pageNum<=o.pages;pageNum++){
   const pageText=execFileSync('pdftotext',['-f',String(pageNum),'-l',String(pageNum),'-layout',path.join(out,filename),'-'],{encoding:'utf8'});
   assert(pageText.includes(data.h),filename+' page '+pageNum+' missing repeated report heading/logo header');
   assert(pageText.includes('Zeitraum:'),filename+' page '+pageNum+' missing repeated report date header');
  }
  if(tab==='orders')assert(o.pages<=4,'Order report excessively long for synthetic dataset: '+o.pages+' pages');
  results.push(o);console.log('REPORT PDF PASS',filename,o.pages,'pages');
  await page.emulateMedia({media:'screen'});
  await page.evaluate(()=>{document.getElementById('reportPrintSnapshot')?.remove();document.getElementById('reportPrintOnly')?.remove()});
 }
 assert.equal(jsErrors.length,0,'Unhandled browser JS errors: '+jsErrors.join('; '));
 fs.writeFileSync(path.join(out,'QA-ERGEBNIS.json'),JSON.stringify({createdAt:new Date().toISOString(),checks:results},null,2));
 console.log('ALL PDF TESTS PASS: '+results.length+' PDFs produced with valid A4 pages');
 await browser.close();activeBrowser=null;server.close();
})().catch(async e=>{console.error('PDF REGRESSION FAILED:',e);try{await activeBrowser?.close()}catch{}server.close();process.exitCode=1});
