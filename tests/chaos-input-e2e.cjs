'use strict';
/* Realistic chaos/regression: garbage fields, duplicate clicks, XSS text, invalid JSON and corrupted links. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-output','chaos');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 let url;try{url=new URL(req.url,'http://localhost')}catch{return res.writeHead(400).end()}
 const filename=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(filename!==root&&!filename.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(filename,(err,data)=>err?res.writeHead(404).end():res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.svg':'image/svg+xml'})[path.extname(filename)]||'application/octet-stream'}).end(data));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1270,height:900},acceptDownloads:true});
 page.setDefaultTimeout(15000);
 const issues=[],checks=[],errors=[],alerts=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('dialog',async d=>{alerts.push(d.message());if(d.type()==='confirm'&&d.message().includes('TERMINKONFLIKT'))await d.dismiss();else await d.accept()});
 const check=(name,condition,details='')=>{assert(condition,name+(details?' '+details:''));checks.push(name);console.log('CHAOS PASS',name)};
 async function count(){return page.evaluate(()=>({customers:state.customers.length,objects:state.objects.length,appointments:state.appointments.length,entries:state.entries.length,quotes:(state.quotes||[]).length}))}
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
  await page.waitForFunction(()=>document.querySelector('#employee')?.options?.length>0);
  await page.evaluate(async()=>{
   state={version:2,employees:['QA Mitarbeiter'],customers:[],objects:[],appointments:[],entries:[],quotes:[],quoteSettings:{TaxMode:'small'},changeHistory:[],appointmentTrash:[],lastSave:null,lastBackup:null};
   await saveState();renderCustomers();renderAppointments();updateCustomerSelects();
  });
  await page.locator('#home [data-jump="customersPanel"]').click();
  await page.locator('#newCustomerMode').click();
  const base=await count();
  await page.locator('#saveCustomerChanges').click();
  check('Kundenname leer blockiert',(await count()).customers===base.customers);
  await page.locator('#editCustomerName').fill('   ');
  await page.locator('#saveCustomerChanges').click();
  check('Whitespace-Kundenname blockiert',(await count()).customers===0);
  await page.locator('#editCustomerName').fill('Chaos Testkunde');
  await page.locator('#editCustomerEmail').fill('kein-at-zeichen');
  await page.locator('#saveCustomerChanges').click();
  check('Unplausible E-Mail blockiert',(await count()).customers===0);
  await page.locator('#editCustomerEmail').fill('test@example.invalid');
  await page.locator('#editCustomerZip').fill('1234');
  await page.locator('#saveCustomerChanges').click();
  check('PLZ nicht fünfstellig blockiert',(await count()).customers===0);
  await page.locator('#editCustomerZip').fill('58095');
  await page.locator('#newObjectName').fill('Chaos Objekt');
  await page.locator('#newObjectAddress').fill('Teststraße 1');
  await page.locator('#newObjectZip').fill('58095');
  await page.locator('#saveCustomerChanges').click();
  await page.waitForFunction(()=>state.customers.length===1&&state.objects.length===1);
  const created=await page.evaluate(()=>({c:structuredClone(state.customers[0]),o:structuredClone(state.objects[0])}));
  check('Gültigen Kunden samt Objekt anlegen',created.c.publicNumber==='1'&&created.o.publicNumber==='1.1');

  await page.locator('#newCustomerMode').click();
  await page.locator('#editCustomerName').fill('Chaos Testkunde');
  await page.locator('#saveCustomerChanges').click();
  check('Doppelter Kundenname blockiert',(await count()).customers===1);
  // Back to existing selection (new mode toggle), then edit object.
  await page.locator('#newCustomerMode').click();
  await page.locator('#selectedCustomer').selectOption(created.c.id);
  await page.locator('#editCustomerName').fill('Unbeabsichtigte Änderung');
  await page.locator('#newObjectMode').click(); // Toggle should preserve previous customer edit? unsaved changes may prompt, accepted.
  await page.locator('#editCustomerName').fill('Unbeabsichtigte Änderung');
  await page.locator('#newObjectName').fill('');
  await page.locator('#saveCustomerChanges').click();
  const afterFailedObject=await page.evaluate(()=>({c:state.customers[0].name,objects:state.objects.length}));
  check('Fehler beim neuen Objekt verändert Kundendaten nicht',afterFailedObject.c===created.c.name,JSON.stringify(afterFailedObject));

  await page.locator('#goHome').click();
  await page.locator('#home [data-jump="appointmentsPanel"]').click();
  await page.locator('#appointmentCreatePanel summary').click();
  await page.locator('#appointmentCustomer').selectOption(created.c.id);
  await page.locator('#appointmentObject').selectOption(created.o.id);
  await page.locator('#appointmentService').selectOption('Glas- & Fensterreinigung');
  // DOM handlers perform validation even when browser native form validation would already reject entry.
  async function tryAppointment(date,start,end,repeat,interval,until){
   return page.evaluate(async v=>{
    for(const [id,value] of [['appointmentDate',v.date],['appointmentStart',v.start],['appointmentEnd',v.end],['appointmentUntil',v.until]]){
     const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
    }
    document.getElementById('appointmentRepeat').value=v.repeat;
    document.getElementById('appointmentInterval').value=v.interval;
    await addAppointment({preventDefault(){}});
    return state.appointments.length;
   },{date,start,end,repeat,interval,until});
  }
  check('Ende vor Beginn blockiert',(await tryAppointment('2026-11-03','13:00','09:00','once','1',''))===0);
  check('Gleiche Start-/Endzeit blockiert',(await tryAppointment('2026-11-03','09:00','09:00','once','1',''))===0);
  check('Wiederholungsintervall Null blockiert',(await tryAppointment('2026-11-03','09:00','11:00','days','0','2026-11-30'))===0);
  check('Enddatum vor Beginn blockiert',(await tryAppointment('2026-11-03','09:00','11:00','weekly','1','2026-10-20'))===0);
  check('Unvollständiger Wochentag blockiert',(await tryAppointment('2026-11-03','09:00','11:00','weekdays','1','2026-11-30'))===0);
  check('Gültiger Termin speicherbar',(await tryAppointment('2026-11-03','09:00','11:00','once','1',''))===1);
  // Simulate extremely fast double submit before storage finishes: must never create same AK twice.
  await page.evaluate(async()=>{
   for(const [id,value] of [['appointmentDate','2026-11-04'],['appointmentStart','13:00'],['appointmentEnd','14:00'],['appointmentUntil','']]){
    const node=document.getElementById(id);node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));
   }
   document.getElementById('appointmentRepeat').value='once';
   await Promise.all([addAppointment({preventDefault(){}}),addAppointment({preventDefault(){}})]);
  });
  const duplicates=await page.evaluate(()=>state.appointments.filter(a=>a.date==='2026-11-04').length);
  check('Doppelklick erzeugt nur einen Termin',duplicates===1,'Doppelterminanzahl '+duplicates);

  await page.locator('#goHome').click();
  await page.locator('#home [data-jump="quoteCalculator"]').click();
  // No customer, no document
  await page.locator('#qSave').click();
  check('Angebot ohne Kundenauswahl abgewiesen',(await count()).quotes===0);
  await page.locator('#qCustomer').selectOption(created.c.id);
  await page.locator('#qObject').selectOption(created.o.id);
  const invalid=[['qVisits','0'],['qVisits','-12'],['qHourly','-1'],['qHourly','1000000'],['qArea','100000000'],['qMargin','99999'],['qProductivity','0']];
  let invalidRejected=0;
  for(const [id,bad] of invalid){
   const original=await page.locator('#'+id).inputValue();
   await page.locator('#'+id).fill(bad);
   const result=await page.evaluate(()=>MiCareQuoteUI.calculate());
   assert.equal(result,null,'Invalid calculator value should be rejected: '+id+'='+bad);
   invalidRejected++;
   await page.locator('#'+id).fill(original);
  }
  check('Extremwerte/Negativwerte in Kalkulation blockiert',invalidRejected===invalid.length,invalidRejected+' Fälle');
  await page.locator('#qScope').selectOption('windows');
  const noWindows=await page.evaluate(()=>MiCareQuoteUI.calculate());
  check('Nur Fenster ohne Fensterposition unzulässig',noWindows===null);
  await page.locator('#qWindowPicker [data-window="standard"]').click();
  const numberInput=page.locator('.quoteWindowRow input[type="number"]').first();
  await numberInput.fill('0');
  check('Null Fensterpositionen blockiert',await page.evaluate(()=>MiCareQuoteUI.calculate())===null);
  await numberInput.fill('2');
  await page.locator('#qManualNet').fill('125');
  await page.locator('#qSellerName').fill('M-iCare QA');
  await page.locator('#qSave').click();
  await page.waitForFunction(()=>state.quotes?.length===1);
  check('Korrektes Angebot kann nach Chaos gespeichert werden',(await count()).quotes===1);
  const quoteBefore=await page.evaluate(()=>state.quotes[0].number);
  await page.locator('#qNew').click();
  await page.locator('#qCustomer').selectOption(created.c.id);
  await page.locator('#qNumber').fill(quoteBefore);
  await page.locator('#qSave').click();
  check('Doppelte Angebotsnummer blockiert',(await count()).quotes===1);
  await page.locator('#qNew').click();
  await page.locator('#qCustomer').selectOption(created.c.id);
  await page.locator('#qScope').selectOption('other');
  await page.locator('#qService').fill('<img src=x onerror=alert(1)> <> & ""');
  await page.locator('#qHours').fill('2');
  await page.locator('#qManualNet').fill('99');
  await page.locator('#qSave').click();
  await page.waitForFunction(()=>document.querySelector('#qSavedTotals')?.textContent?.includes('2 Dokument(e)'),null,{timeout:15000});
  check('Sonderzeichen und HTML im Text brechen UI nicht',await page.locator('img[src="x"]').count()===0);
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#employee')?.options?.length>0);
  const recovered=await count();
  check('Daten nach Neustart intakt',recovered.customers===1&&recovered.appointments===2&&recovered.quotes===2,JSON.stringify(recovered));

  // Cloud import must never accept dangling customer/object links or duplicate ids.
  const invalidSnapshots=await page.evaluate(()=>{
   const good=structuredClone(state);
   let bad1=structuredClone(good);bad1.customers.push(structuredClone(bad1.customers[0]));
   let bad2=structuredClone(good);bad2.objects[0].customerId='unbekannt';
   let bad3=structuredClone(good);bad3.employees=['QA Mitarbeiter','QA Mitarbeiter'];
   let bad4=structuredClone(good);delete bad4.appointments;
   const checks=[bad1,bad2,bad3,bad4].map(data=>{try{MiCareCloudTransfer.validateSnapshot(data);return false}catch{return true}});
   return checks;
  });
  check('Kaputte/doppelte/inkonsistente Sicherung abgewiesen',invalidSnapshots.every(Boolean));
  const beforeImport=await page.evaluate(()=>JSON.stringify({customers:state.customers,objects:state.objects,appointments:state.appointments,entries:state.entries}));
  await page.evaluate(async()=>{
   const invalid={version:2,employees:['QA Mitarbeiter'],entries:[],customers:[null],objects:[],appointments:[]};
   const file=new File([JSON.stringify(invalid)],'fehlerhafte-kunden.json',{type:'application/json'});
   await importJson({target:{files:[file],value:''}});
  });
  const afterImport=await page.evaluate(()=>JSON.stringify({customers:state.customers,objects:state.objects,appointments:state.appointments,entries:state.entries}));
  check('Raw-JSON-Import mit kaputtem Kunden verändert keine Daten',beforeImport===afterImport);
  await page.evaluate(async()=>{
   const file=new File(['{ das ist KEIN JSON'], 'ungültig.json',{type:'application/json'});
   await importJson({target:{files:[file],value:''}});
  });
  check('Defektes JSON lässt alle bisherigen Daten stehen',beforeImport===await page.evaluate(()=>JSON.stringify({customers:state.customers,objects:state.objects,appointments:state.appointments,entries:state.entries})));
  check('Keine JavaScript-Abstürze',errors.length===0,JSON.stringify(errors));
  fs.writeFileSync(path.join(out,'CHAOS-ERGEBNIS.json'),JSON.stringify({createdAt:new Date().toISOString(),checks,dialogCount:alerts.length,dialogs:alerts.slice(0,30),errors,finalCounts:await count()},null,2));
  console.log('CHAOS ALL PASS:',checks.length);
 }catch(e){
  fs.writeFileSync(path.join(out,'CHAOS-FEHLER.txt'),String(e.stack||e)+'\nChecks passed:\n'+JSON.stringify(checks,null,2)+'\nDialogs:'+JSON.stringify(alerts.slice(-12)));
  await page.screenshot({path:path.join(out,'CHAOS-FAIL.png'),fullPage:true}).catch(()=>{});
  console.error('CHAOS FAILED:',e);process.exitCode=1;
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
