'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
assert(script.length>1000,'App script not found');
new vm.Script(script,{filename:'index-inline.js'});
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(ids.length,new Set(ids).size,'Duplicate HTML ids: '+ids.filter((id,i)=>ids.indexOf(id)!==i).join(', '));
for(const id of ['reportHome','reportDetail','reportFrom','reportTo','rptCustomer','reportCustomerSearch','reportEmployee','reportObject','reportService','reportEntryKind','reportOrderStatus','reportTableCsv','reportPrint','reportBack']){
 assert(ids.includes(id),'Missing report control '+id);
}
assert(html.includes('data-open-report="history"'),'Legacy month exports must remain accessible from reporting');
assert(!html.includes('data-jump="history">📊 Auswertungen'),'Duplicate history home tile still exists');
const printModule=fs.readFileSync('report-print.js','utf8');
new vm.Script(printModule,{filename:'report-print.js'});
assert(html.includes('MiCareReportPrint.print()'),'Report print must use dedicated snapshot');
assert(printModule.includes('@page{size:A4 landscape'),'Report print must explicitly use A4 landscape');
assert(printModule.includes('body>*:not(#reportPrintSnapshot)'),'Interactive page must be hidden in PDF');
const first=script.indexOf('function reportBuild(){'),last=script.indexOf('function customerNameForReport',first);
assert(first>=0&&last>first,'Calculation function not found');
const source=script.slice(first,last);
const state={
 customers:[{id:'a',publicNumber:'1',name:'Muster GmbH'},{id:'b',publicNumber:'2',name:'Muster GmbH'}],
 objects:[{id:'oa',publicNumber:'1.1',name:'Halle'},{id:'ob',publicNumber:'2.1',name:'Halle'}],
 entries:[
  {id:'1',employee:'Anna',date:'2026-10-10',endDate:'2026-10-10',start:'08:00',end:'10:00',minutes:120,customerId:'a',objectId:'oa',service:'Büroreinigung',appointmentId:'p',appointmentOccurrence:'2026-10-10',orderStatus:'done'},
  {id:'2',employee:'Anna',date:'2026-10-10',endDate:'2026-10-10',start:'09:00',end:'10:00',minutes:60,customerId:'a',objectId:'oa',service:'Büroreinigung'},
  {id:'3',employee:'Anna',date:'2026-10-10',endDate:'2026-10-10',start:'08:00',end:'08:00',minutes:0,customerId:'a',objectId:'oa',service:'Büroreinigung',orderStatus:'absent'},
  {id:'4',employee:'Ben',date:'2026-10-11',endDate:'2026-10-11',start:'11:00',end:'12:00',minutes:60,customerId:'b',objectId:'ob',service:'Grundreinigung',orderStatus:'done'}
 ],
 appointments:[{id:'p',date:'2026-10-10',start:'08:00',end:'10:00',customerId:'a',objectId:'oa',service:'Büroreinigung',employee:'Anna',repeat:'once'}]
};
const controls={reportFrom:'2026-10-01',reportTo:'2026-10-31',rptCustomer:'',reportEmployee:'',reportObject:'',reportService:'',reportEntryKind:'',reportOrderStatus:''};
const run=()=>vm.runInNewContext(source+';reportBuild()',{
 state,$:id=>({value:controls[id]}),
 datesFor:(a,from,to)=>a.date>=from&&a.date<=to?[{appointment:a,date:a.date,start:a.start,end:a.end,originalDate:a.date}]:[],
 appointmentKey:(a,d)=>a.id+'|'+d
},{timeout:2500});
const before=JSON.stringify(state);
let d=run();
assert.equal(d.total,240,'Total net minutes');
assert.equal(d.entries.length,4);
assert.equal(d.completed.length,1);
assert.equal(d.overlaps.length,1,'Zero-minute entry must not count as overlap');
assert.equal(d.byCustomer.length,2,'Customers with identical names must remain distinct');
controls.rptCustomer='b';d=run();assert.equal(d.entries.length,1);assert.equal(d.total,60);
controls.rptCustomer='';controls.reportEntryKind='free';d=run();assert.equal(d.entries.length,3);
controls.reportEntryKind='';controls.reportOrderStatus='done';d=run();assert.equal(d.entries.length,2);
assert.equal(JSON.stringify(state),before,'Reporting must not alter stored data');
console.log('Reporting smoke tests: PASS (syntax, unique IDs, controls, filters, totals, overlaps, nonmutating)');
