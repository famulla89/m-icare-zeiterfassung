'use strict';
const {firstRun,unlock}=require('./auth-test-helper.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {_electron: electron} = require('../windows-app/node_modules/playwright');
const exe = path.join(process.env.RUNNER_TEMP || '.', 'micare-qa-install', 'M-iCare.exe');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'testdata', 'micare-10-kunden.json'), 'utf8'));
(async()=>{
 assert(fs.existsSync(exe),'Installed Windows M-iCare.exe not found');
 const app = await electron.launch({executablePath:exe,timeout:45000});
 try {
  const page = await app.firstWindow({timeout:45000});
  page.setDefaultTimeout(12000);
  const dialogs = [];
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept()});
  const pageerrors=[];
  page.on('pageerror',err=>pageerrors.push(String(err)));
  await page.waitForFunction(()=>document.querySelector('#employee')?.options.length>0,{timeout:30000});
  await firstRun(page);
  assert(await page.locator('#home').isVisible(),'Installed Electron app must display home screen');
  assert.equal(await page.evaluate(()=>location.protocol),'micare:','Must run in packaged offline protocol');

  await page.evaluate(async data=>{
   state=structuredClone(data);
   state.changeHistory??=[];
   state.appointmentTrash??=[];
   await saveState();
   updateCustomerSelects();
   refreshLinkedAppointments();
  },fixture);
  await page.waitForFunction(()=>state.customers.length===10);
  // Real installed Windows renderer must filter customer number exactly.
  await page.evaluate(()=>{showScreen('customerOverviewScreen');document.getElementById('customerStateFilter').value='all';renderAllCustomers()});
  await page.locator('#customerSearch').fill('1');
  assert.equal(await page.locator('#allCustomersList > .objectItem').count(),1,'Windows search: customer 1 must match one customer');
  await page.locator('#customerSearch').fill('1.2');
  assert.equal(await page.locator('#allCustomersList > .objectItem').count(),1);
  assert((await page.locator('#allCustomersList').innerText()).includes('1.2'));
  assert(!(await page.locator('#allCustomersList').innerText()).includes('1.1 ·'),'Windows object search must not show siblings');
  await page.locator('#customerSearch').fill('no-such-customer');
  assert.equal(await page.locator('#allCustomersList > .objectItem').count(),0);
  await page.locator('#customerSearch').fill('');
  assert.equal(await page.locator('#allCustomersList > .objectItem').count(),10);
  console.log('NATIVE WINDOWS CUSTOMER SEARCH PASS: exact customer and object numbers, empty, reset');

  const encryptionProbe=await page.evaluate(async()=>{
    const pass='QA-Windows-Cloud-Pass-2026';
    const doc=await MiCareCloudTransfer.encrypt(structuredClone(state),pass,'qa-windows@gmail.com');
    const restored=await MiCareCloudTransfer.decrypt(doc,pass);
    return {same:restored.state.customers.length===state.customers.length,owner:restored.ownerEmail,hasPlaintext:JSON.stringify(doc).includes('Nordstern')};
  });
  assert(encryptionProbe.same&&!encryptionProbe.hasPlaintext,'Installed Electron renderer can encrypt and decrypt without exposing customer names');
  assert.equal(encryptionProbe.owner,'qa-windows@gmail.com');
  console.log('NATIVE WINDOWS CLOUD CRYPTO PASS');
  // Real installed Electron app: in-app AK editor must work without unsupported prompt().
  await page.evaluate(async()=>{
   const original=state.appointments.find(a=>a.id==='test-appointment-1');
   const a={...structuredClone(original),id:'qa-windows-modal-ak',akNumber:991,date:'2026-12-09',start:'09:00',end:'11:00',employee:'Anna Test',repeat:'once',exceptions:{},workInstructions:'Ursprüngliche Fensterreinigung'};
   state.appointments.push(a);await saveState();
   showScreen('appointmentsPanel');
   editAppointmentFromCalendar({appointment:a,originalDate:a.date,date:a.date,start:a.start,end:a.end});
  });
  assert(await page.locator('#akEditDialog').isVisible(),'Electron AK editor uses supported modal, not window.prompt');
  await page.locator('#akEditStart').fill('10:00');
  await page.locator('#akEditEnd').fill('12:00');
  await page.locator('#akEditInstructions').fill('Fensterrahmen und Glas reinigen, Schlüssel beim Hausmeister');
  await page.locator('#akEditSave').click();
  await page.waitForFunction(()=>!document.getElementById('akEditDialog').open);
  const savedAk=await page.evaluate(async()=>{
   const stateOnDisk=await read('app');
   return stateOnDisk.appointments.find(a=>a.id==='qa-windows-modal-ak');
  });
  assert.equal(savedAk.start,'10:00');
  assert.equal(savedAk.end,'12:00');
  assert(savedAk.workInstructions.includes('Hausmeister'));
  await page.reload();
  await unlock(page);
  await page.waitForFunction(()=>state.appointments.some(a=>a.id==='qa-windows-modal-ak'&&a.start==='10:00'));
  assert.equal(await page.evaluate(()=>state.appointments.find(a=>a.id==='qa-windows-modal-ak').end),'12:00');
  await page.evaluate(async()=>{state.appointments=state.appointments.filter(a=>a.id!=='qa-windows-modal-ak');await saveState()});
  console.log('NATIVE WINDOWS AK EDIT PASS: Electron modal, valid time, instructions and persisted after app restart');

  const ak=await page.evaluate(()=>akLabel(state.appointments.find(a=>a.id==='test-appointment-1')));
  assert(/^AK \d+$/.test(ak));

  await page.evaluate(()=>{
    showScreen('plannedWorkScreen');
    document.getElementById('plannedListDate').value='2026-10-24';
    document.getElementById('plannedListEmployee').value='Anna Test';
    renderPlannedWorkScreen();
  });
  await page.locator('#plannedAkSearch').fill(ak);
  assert((await page.locator('#plannedListItems').innerText()).includes(ak),'Search must find AK across dates');
  await page.getByRole('button',{name:'Erfassung ansehen / korrigieren'}).first().click();
  assert(await page.locator('#correctionPanel').isVisible(),'Closed AK must open correction form');
  assert((await page.locator('#plannedEditorAkInfo').textContent()).includes(ak));
  await page.locator('#orderStatus').selectOption('progress');
  await page.locator('#saveBtn').click();
  assert(dialogs.some(d=>d.includes('Korrekturgrund')),'Closed AK cannot be modified without reason');
  assert.equal(await page.evaluate(()=>state.entries.find(e=>e.id==='test-entry-1').orderStatus),'done');

  await page.locator('#correctionEditor').selectOption('Anna Test');
  await page.locator('#correctionReason').selectOption('Auftragsstatus falsch gewählt');
  await page.locator('#saveBtn').click();
  await page.waitForFunction(()=>state.entries.find(e=>e.id==='test-entry-1')?.orderStatus==='progress');
  const corrected=await page.evaluate(()=>{
   const e=state.entries.find(e=>e.id==='test-entry-1');
   return {count:state.entries.filter(x=>x.appointmentId===e.appointmentId&&x.appointmentOccurrence===e.appointmentOccurrence).length,
    reason:e.corrections?.at(-1)?.reason,wasCompleted:e.wasCompleted};
  });
  assert.equal(corrected.count,1,'Correcting closed AK must not create duplicate');
  assert.equal(corrected.reason,'Auftragsstatus falsch gewählt');
  assert.equal(await page.evaluate(()=>state.entries.find(e=>e.id==='test-entry-1')?.corrections?.at(-1)?.editedBy),'Anna Test','Correction actor persists in installed Windows app');
  assert(corrected.wasCompleted,'Originally closed state must remain auditable');
  await page.evaluate(()=>{
   showScreen('reportingScreen');reportOpenTab('quality');
   document.getElementById('reportFrom').value='2026-10-01';
   document.getElementById('reportTo').value='2026-10-31';
   renderReporting();
  });
  const quality=await page.locator('#reportPanels').innerText();
  assert(quality.includes('Geplante AK-Überschneidungen'),'Quality report contains planned conflicts');
  assert(quality.includes('Tatsächlich erfasste Arbeitszeitüberschneidungen'),'Quality report separates actual overlaps');

  // The installed Windows renderer must create functional PDF, CSV, Excel and JSON data.
  const exports=await page.evaluate(async()=>{
   const rangeControls={mode:document.getElementById('reportMode').value,month:document.getElementById('historyMonth').value,all:document.getElementById('reportAllCustomers').checked};
   document.getElementById('reportMode').value='month';
   document.getElementById('historyMonth').value='2026-10';
   document.getElementById('reportAllCustomers').checked=true;
   const pdf=createOrderStatusPdf('2026-10','');
   const csv=akCsvBlob(akCsvRows(akReportData('2026-10-01','2026-10-31')));
   const xlsx=makeXlsx('2026-10');
   const pdfMonth=createMonthlyPdf('2026-10');
   const xlsxCustomers=makeCustomersXlsx(),xlsxAppointments=makeAppointmentsXlsx(),xlsxAllWork=makeAllWorkXlsx();
   const backup=JSON.parse(JSON.stringify(state));
   const sig=async blob=>[...new Uint8Array((await blob.slice(0,8).arrayBuffer()))];
   const result={pdfSize:pdf.size,pdfSig:await sig(pdf),csvSize:csv.size,csvSig:await sig(csv),csvContent:await csv.text(),
    xlsxSize:xlsx.size,xlsxSig:await sig(xlsx),
    pdfMonthSize:pdfMonth.size,pdfMonthSig:await sig(pdfMonth),
    excelSizes:[xlsxCustomers.size,xlsxAppointments.size,xlsxAllWork.size],
    excelSignatures:await Promise.all([xlsxCustomers,xlsxAppointments,xlsxAllWork].map(sig)),
    backupCount:backup.entries.length,
    backupAkCount:backup.appointments.filter(a=>Number.isInteger(a.akNumber)).length};
   document.getElementById('reportMode').value=rangeControls.mode;
   document.getElementById('historyMonth').value=rangeControls.month;
   document.getElementById('reportAllCustomers').checked=rangeControls.all;
   return result;
  });
  assert(exports.pdfSize>5000&&String.fromCharCode(...exports.pdfSig.slice(0,5))==='%PDF-','Windows AK PDF output');
  assert(exports.csvSize>100,'Windows CSV enthält keine Datensätze');
  assert.deepEqual(exports.csvSig.slice(0,3),[239,187,191],'CSV muss mit UTF-8-BOM beginnen');
  assert(exports.csvContent.includes('Erledigt'),'Windows CSV muss deutsche Auftragsstatus enthalten');
  assert(exports.xlsxSize>100&&exports.xlsxSig[0]===80&&exports.xlsxSig[1]===75,'Windows Excel ZIP format');
  assert(exports.pdfMonthSize>5000&&String.fromCharCode(...exports.pdfMonthSig.slice(0,5))==='%PDF-','Windows monthly PDF output');
  assert(exports.excelSizes.every(size=>size>100)&&exports.excelSignatures.every(sig=>sig[0]===80&&sig[1]===75),'Windows customer/appointment/work Excel exports');
  assert(exports.backupCount===fixture.entries.length&&exports.backupAkCount===fixture.appointments.length,'Windows backup retains AK data');

  // Exercise the real Windows folder bridge and verify files exist on disk after save.
  assert(await page.evaluate(()=>Boolean(window.MiCareDesktopFiles)),'Packaged Electron preload must expose safe desktop filesystem bridge');
  const folderQa=path.join(process.env.RUNNER_TEMP||'.','micare-selected-folder-qa');
  fs.mkdirSync(folderQa,{recursive:true});
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]})},folderQa);
  await page.evaluate(()=>chooseFolder());
  await page.waitForFunction(()=>desktopBackupFolder.length>0);
  const selected=await page.evaluate(()=>desktopBackupFolder);
  assert.equal(path.resolve(selected),path.resolve(folderQa));
  const backupPath=path.join(folderQa,'Backups','M-iCare_Aktueller_Stand.json');
  assert(fs.existsSync(backupPath),'Windows folder must contain automatic JSON full backup');
  const backupContents=JSON.parse(fs.readFileSync(backupPath,'utf8'));
  assert.equal(backupContents.customers.length,fixture.customers.length,'Native backup must contain customers');
  assert.equal(backupContents.appointments.length,fixture.appointments.length,'Native backup must contain AKs');
  const pdfData=await page.evaluate(async()=>{
   const file=createOrderStatusPdf('2026-10','');
   return saveExport('M-iCare_AK_Windows-Folder-QA.pdf',file,'Reporting');
  });
  assert.equal(pdfData,true,'Native PDF save must report folder success');
  const exported=path.join(folderQa,'Reporting','M-iCare_AK_Windows-Folder-QA.pdf');
  assert(fs.existsSync(exported),'Native PDF must exist under selected folder/Reporting');
  assert.equal(fs.readFileSync(exported).subarray(0,5).toString(),'%PDF-','Native PDF signature');
  assert(fs.existsSync(path.join(folderQa,'Kostenvoranschlaege','Kostenvoranschlaege_Uebersicht.json')));
  assert(fs.existsSync(path.join(folderQa,'Rechnungsentwuerfe','Rechnungsentwuerfe_Uebersicht.json')));
  console.log('NATIVE WINDOWS FOLDER PASS: folder chosen, automatic complete backup and separate document indexes, PDF persisted');

  // Mail draft must contain a real PDF attachment, but never send on its own.
  await app.evaluate(({shell})=>{shell.openPath=async()=>''});
  const mime=await page.evaluate(async()=>{
   const pdf=createOrderStatusPdf('2026-10','');
   const raw=await pdf.arrayBuffer();const u=new Uint8Array(raw);
   let binary='';for(const b of u)binary+=String.fromCharCode(b);
   return window.MiCareDesktopFiles.composeEmail({
    recipient:'rechnungs-test@example.invalid',
    subject:'Rechnung RG-2026-0001 – M-iCare QA',
    body:'Anbei die Testrechnung. Kein automatischer Versand.',
    name:'M-iCare_Rechnung_RG-2026-0001.pdf',
    base64:btoa(binary)
   });
  });
  assert(mime.opened,'Windows mail client opening should be requested');
  const mimeText=fs.readFileSync(mime.path,'utf8');
  assert(mimeText.startsWith('To: rechnungs-test@example.invalid\r\n'),'Windows EML has recipient with RFC822 line endings');
  assert(mimeText.includes('Content-Type: application/pdf'),'Windows EML includes attachment');
  assert(mimeText.includes('filename="M-iCare_Rechnung_RG-2026-0001.pdf"'));
  const piece=mimeText.split('Content-Disposition: attachment; filename="M-iCare_Rechnung_RG-2026-0001.pdf"')[1];
  assert(piece,'Attached file header must be present');
  const b64=piece.split('\r\n\r\n')[1].split('\r\n--MiCare_')[0].replace(/\s/g,'');
  assert.equal(Buffer.from(b64,'base64').subarray(0,5).toString(),'%PDF-','Windows attached PDF must be readable');
  console.log('NATIVE WINDOWS INVOICE EMAIL PASS: valid EML with PDF, no message sent');

  assert(!pageerrors.length,'Windows renderer JavaScript errors: '+pageerrors.join('; '));
  console.log('NATIVE WINDOWS ELECTRON E2E PASS: offline protocol, AK search, completed correction, reason, no duplicates, quality reports');
 } finally {await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
