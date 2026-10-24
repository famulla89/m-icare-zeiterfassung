'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const m=require('../quote-calculator.js');
const file=fs.readFileSync('index.html','utf8');
for(const id of ['quoteCalculator','qCustomer','qObject','qAppointment','qArea','qHourly','qWindowPicker','qManualNet','qVat','qSave','qPdf','qSavedList'])assert(file.includes('id="'+id+'"'),'Missing UI field '+id);
assert(file.includes(",'quoteCalculator','backupSection'")||file.includes(" 'quoteCalculator','backupSection'"),'New screen is not in navigation');
new vm.Script(fs.readFileSync('quote-ui.js','utf8'));
new vm.Script(fs.readFileSync('quote-calculator.js','utf8'));
function create(overrides={}){
 return m.compute({area:200,visits:8,hours:2,sqmPerHour:100,hourly:20,nonwage:20,
  overhead:15,productivity:90,material:2,km:8,perKm:0.70,margin:25,minNet:0,
  manualNet:0,vat:19,windowSqm:0,windowRate:3,sides:1,soil:1,extras:1,...overrides});
}
const base=create();
assert.equal(base.visits,8);
assert.equal(base.hoursPerVisit,2);
assert(base.net>0&&base.gross>base.net);
assert.equal(base.gross,m.euro(base.net+base.tax),'VAT totals match');
const custom=create({manualNet:123.45});
assert.equal(custom.net,123.45);assert.equal(custom.tax,23.46);assert.equal(custom.gross,146.91);
assert.equal(custom.rows.length,1);
const windows=create({windowSqm:7.5,windowRate:3,sides:2,soil:1.3,extras:1.2});
assert.equal(windows.windowsNet,70.2);
assert.equal(windows.rows.length,2,'Window cleaning separate position');
const minimum=create({minNet:2000});
assert.equal(minimum.net,2000);
assert.throws(()=>create({visits:0}),/Einsätze/);
assert.throws(()=>create({hourly:-5}),/Ungültiger/);
assert.throws(()=>create({productivity:0}),/Produktivität/);
assert.throws(()=>create({vat:101}),/Ungültiger/);
const multiple=create({
 mode:'solo',setupMinutes:15,liftRental:85,minimumSqm:0,fixedProfit:75,
 windowItems:[
  {id:'a',label:'Standardfenster',qty:5,each:1.5,rate:3,sides:1,soil:1,frame:true,ladder:false,lift:false},
  {id:'b',label:'Große Glasflächen',qty:2,each:4,rate:3,sides:2,soil:1.3,frame:false,ladder:true,lift:false}
 ]
});
assert.equal(multiple.windowItems.length,2);
assert.equal(multiple.windowSqm,15.5);
assert.equal(multiple.windowItems[0].total,27);
assert.equal(multiple.windowItems[1].total,81.12);
assert.equal(multiple.windowsNet,108.12);
assert.equal(multiple.liftRental,85);
assert.equal(multiple.rows.length,4);
assert.equal(m.euro(multiple.rows.reduce((a,r)=>a+r.total,0)),multiple.net,'Every euro accounted for in PDF positions');
assert(multiple.hoursPerVisit>base.hoursPerVisit,'Setup minutes counted');
assert(create({minimumSqm:20,area:200}).net>=4000,'Minimum net per sqm honored');
assert.throws(()=>create({windowItems:[{label:'Fenster',qty:0,each:1,rate:3,sides:1,soil:1}]}),/Stückzahl/);
assert.throws(()=>create({windowItems:Array(9).fill({label:'Test',qty:1,each:1,rate:3,sides:1,soil:1})}),/Maximal acht/);
assert.throws(()=>create({mode:'invalid'}),/Betriebsmodus/);
// Exact service modes: office area must not be billed for a window-only commission.
const winOnly=create({scope:'windows',area:200,hours:0,sqmPerHour:0,visits:1,setupMinutes:0,km:0,material:0,windowItems:[
 {label:'Standardfenster',qty:10,each:1.5,rate:4,sides:1,soil:1,frame:false,ladder:false,lift:false}
]});
assert.equal(winOnly.windowSqm,15);
assert.equal(winOnly.windowsNet,60);
assert.equal(winOnly.net,60,'Window-only price must not include 200 sqm of office cleaning');
assert(winOnly.rows.every(r=>!r.title.includes('Raum- und Bodenreinigung')));
assert.equal(winOnly.hoursPerVisit,0);
assert(winOnly.estimatedLaborWarning,'Warn about missing estimate of window labor');
assert.equal(create({scope:'windows',area:200,hours:0,sqmPerHour:0,visits:1,windowItems:[
 {label:'Standardfenster',qty:10,each:1.5,rate:4,sides:1,soil:1}
]}).windowSqm,15,'0 sqm/hour must be accepted for window-only work');
const winWithHours=create({scope:'windows',area:200,hours:2,visits:1,windowItems:[
 {label:'Standardfenster',qty:10,each:1.5,rate:4,sides:1,soil:1}
]});
assert(winWithHours.cleaningCost>winOnly.cleaningCost,'Internal work hours must count as costs');
assert(winWithHours.net>winOnly.net,'Base work/drive costs can be charged in addition to glass price');
const roomsOnly=create({scope:'rooms',visits:1,area:200,hours:0,sqmPerHour:100,windowItems:[{label:'Fenster',qty:5,each:1,rate:5,sides:2,soil:1}]});
assert.equal(roomsOnly.windowsNet,0,'Office-only job must not accidentally bill windows');
assert(roomsOnly.rows.every(r=>!r.title.includes('Fenster')));
assert.throws(()=>create({scope:'rooms',hours:0,sqmPerHour:0}),/m² pro Stunde/);
assert.throws(()=>create({scope:'windows',windowItems:[]}),/mindestens eine Fensterart/);
assert.throws(()=>create({scope:'other',hours:0}),/Arbeitszeit in Stunden/);
const other=create({scope:'other',serviceName:'Sonderreinigung',hours:3,area:200,visits:1,sqmPerHour:0});
assert(other.rows[0].title.includes('Sonderreinigung'));
assert.equal(other.windowSqm,0);
assert.equal(other.hoursPerVisit,3.25,'Setup time is still part of internal costs');
const combo=create({scope:'combined',visits:1,windowItems:[{label:'Glasdach',qty:1,each:7.5,rate:10,sides:1,soil:1}]});
assert(combo.rows.some(r=>r.title.includes('Raum- und Bodenreinigung')));
assert(combo.rows.some(r=>r.title.includes('Glasdach')));
const customWindows=create({scope:'windows',manualNet:99.99,visits:1,windowItems:[
 {label:'Standardfenster',qty:2,each:1.5,rate:3,sides:1,soil:1},
 {label:'Wintergarten',qty:1,each:5,rate:5,sides:1,soil:1}
]});
assert.equal(customWindows.net,99.99);
assert.equal(m.euro(customWindows.rows.reduce((a,r)=>a+r.total,0)),99.99);
assert(customWindows.rows.some(r=>r.title.includes('Wintergarten')),'Manual prices must keep window descriptions in the PDF');

const invoice={...m.createDocument({id:'t',kind:'invoice',number:'RG-QA',customerName:'Muster GmbH',sellerName:'Test',service:'Fenster',rows:multiple.rows,net:multiple.net,tax:multiple.tax,gross:multiple.gross,vat:multiple.vat})};
assert.equal(m.validateDocument(invoice),invoice);

const doc={
 id:'qa-document',kind:'quote',number:'KV-QA-001',customerName:'Musterfirma GmbH',
 customerAddress:'Musterstraße 1, Hagen',sellerName:'Reinigung Test GmbH',
 service:'Büroreinigung',rows:base.rows,net:base.net,tax:base.tax,gross:base.gross,vat:base.vat
};
assert.equal(m.validateDocument(doc),doc);
const edited=m.createDocument(doc);edited.customerName='Andere Firma';
assert.equal(doc.customerName,'Musterfirma GmbH','Snapshot must be independent');
assert.throws(()=>m.validateDocument({...doc,gross:1}),/inkonsistent/);
assert.throws(()=>m.validateDocument({...doc,kind:'random'}),/Dokumenttyp/);
console.log('Quote smoke PASS: totals, manual price, windows, VAT, minimum, validation, snapshots, UI, syntax');
