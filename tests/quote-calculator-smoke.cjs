'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const m=require('../quote-calculator.js');
const file=fs.readFileSync('index.html','utf8');
for(const id of ['quoteCalculator','qCustomer','qObject','qAppointment','qArea','qHourly','qWindowType','qManualNet','qVat','qSave','qPdf','qSavedList'])assert(file.includes('id="'+id+'"'),'Missing UI field '+id);
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
