'use strict';
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
  assert(!pageerrors.length,'Windows renderer JavaScript errors: '+pageerrors.join('; '));
  console.log('NATIVE WINDOWS ELECTRON E2E PASS: offline protocol, AK search, completed correction, reason, no duplicates, quality reports');
 } finally {await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
