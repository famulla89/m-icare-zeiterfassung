'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const html=fs.readFileSync('index.html','utf8');
const js=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
new vm.Script(js);
for(const id of ['correctionPanel','correctionReason','correctionEditor','correctionNote','correctionHistoryList']){
 assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'Expected exactly one '+id);
}
const helpers=js.slice(js.indexOf('const ORDER_CORRECTION_FIELDS='),js.indexOf('function renderOrderCorrection(){'));
const save=js.slice(js.indexOf('async function saveEntry(ev){'),js.indexOf('\nfunction editEntry(id)',js.indexOf('async function saveEntry(ev){')));
assert(helpers.includes('orderCorrectionChanges')&&save.includes('correctionReason'),'Missing correction code');
const initial={
 id:'original-entry',employee:'Test Mitarbeiter',service:'Büroreinigung',object:'Testobjekt',
 date:'2026-10-19',endDate:'2026-10-19',start:'09:00',end:'11:00',breakMinutes:0,minutes:120,
 notes:'',workDone:'',orderRemarks:'',deviationReason:'',deviationNote:'',
 customerId:'customer-1',objectId:'object-1',
 appointmentId:'appointment-1',appointmentOccurrence:'2026-10-19',orderStatus:'done'
};
const state={employees:['Test Mitarbeiter'],entries:[structuredClone(initial)],appointments:[],changeHistory:[]};
let input={...initial,orderStatus:'progress'};
const fields={
 month:{value:'2026-10'},deviationReason:{value:''},deviationNote:{value:''},
 correctionReason:{value:''},correctionEditor:{value:''},correctionNote:{value:''},
 saveBtn:{textContent:''},cancelEdit:{classList:{add(){},remove(){}}},
 historyMonth:{value:''}
};
const errors=[],opened=[],calls={saved:0};
const ctx=vm.createContext({
 state,editId:'original-entry',workEntryMode:'planned',crypto:webcrypto,
 $:id=>{if(!fields[id])throw Error('Unexpected field '+id);return fields[id]},
 formValue:()=>({...input}),syncMonthToWorkday:()=>{},
 linkedOccurrence:()=>({appointment:{id:'appointment-1'},originalDate:'2026-10-19'}),
 renderPlannedDeviation:()=>false,duration:()=>120,SERVICES:['Büroreinigung'],
 confirm:()=>true,alert:m=>errors.push(String(m)),formatDate:x=>x,
 saveState:async()=>{calls.saved++},refreshLinkedAppointments:()=>{},
 renderOrderOverview:()=>{},renderAppointments:()=>{},renderOrderCorrection:()=>{},
 notify:()=>{},editEntry:id=>opened.push(id)
});
vm.runInContext(helpers+'\nlet workEntrySaveInProgress=false;\n'+save,ctx,{timeout:3000});
const submit=async()=>await vm.runInContext('saveEntry({preventDefault(){}})',ctx,{timeout:3000});
(async()=>{
 const before=JSON.stringify(state);
 await submit();
 assert.equal(calls.saved,0,'Missing correction reason must prevent saving');
 assert.match(errors.at(-1),/Korrekturgrund/);
 assert.equal(JSON.stringify(state),before,'Rejected changes must not modify state');
 fields.correctionReason.value='Aus Versehen abgeschlossen';
 await submit();
 assert.equal(calls.saved,0,'Unknown correction actor must prevent saving');
 assert.match(errors.at(-1),/wer die Arbeitskarte korrigiert/);
 fields.correctionEditor.value='Test Mitarbeiter';
 await submit();
 assert.equal(calls.saved,1);
 assert.equal(state.entries.length,1,'Must modify original entry, not create a duplicate');
 assert.equal(state.entries[0].orderStatus,'progress');
 assert.equal(state.entries[0].wasCompleted,true);
 assert.equal(state.entries[0].corrections.length,1);
 assert.equal(state.entries[0].corrections[0].reason,'Aus Versehen abgeschlossen');
 assert.equal(state.entries[0].corrections[0].editedBy,'Test Mitarbeiter');
 assert.equal(state.changeHistory[0].editedBy,'Test Mitarbeiter');
 assert(state.entries[0].corrections[0].changes.some(c=>c.field==='orderStatus'&&c.before==='done'&&c.after==='progress'));
 assert.equal(state.changeHistory[0].type,'Auftragskorrektur');
 ctx.editId='original-entry';input={...input,start:'08:00'};
 fields.correctionReason.value='Arbeitszeit falsch erfasst';
 await submit();
 assert.equal(state.entries[0].corrections.length,2);
 assert.equal(state.entries[0].corrections[1].editedBy,'Test Mitarbeiter');
 assert(state.entries[0].corrections[1].changes.some(c=>c.field==='start'));
 ctx.editId='original-entry';
 fields.correctionReason.value='Sonstiger Korrekturgrund';
 fields.correctionNote.value='';
 input={...input,orderRemarks:'Ergänzende Änderung'};
 await submit();
 assert.equal(state.entries[0].corrections.length,2);
 assert.match(errors.at(-1),/Erklärung/);
 ctx.editId=null;fields.correctionReason.value='';
 await submit();
 assert.equal(opened.at(-1),'original-entry','Duplicate should open existing entry');
 assert.equal(state.entries.length,1);
 console.log('Order correction tests PASS: mandatory reason, before/after, multiple changes, custom reason, no duplicates');
})().catch(e=>{console.error(e);process.exitCode=1});
