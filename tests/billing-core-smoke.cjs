'use strict';
const assert=require('node:assert/strict');
const core=require('../billing-ui.js');
const quote={id:'q1',kind:'quote',acceptedAt:'2026-10-25T12:00:00Z',number:'KV-2026-0042',
 customerId:'c1',customerName:'Beispiel GmbH',customerAddress:'Musterstraße 1, 58095 Hagen',
 sellerName:'M-iCare',sellerAddress:'Beispiel 9, 58097 Hagen',sellerTaxId:'12345',
 iban:'DE89370400440532013000',recipientEmail:'kunde@example.com',service:'Fensterreinigung',
 net:1000,tax:0,gross:1000,taxMode:'small',vat:0,appointmentIds:Array.from({length:10},(_,i)=>'ak'+(i+1))};
const appointments=quote.appointmentIds.map((id,i)=>({id,quoteId:'q1',akNumber:i+1,date:'2026-11-'+String(i+1).padStart(2,'0'),
 customerId:'c1',service:quote.service,plannedInvoiceNetCents:10000,plannedInvoiceTaxCents:0}));
const state={quotes:[quote],appointments,entries:[]};
const complete=id=>{const a=appointments.find(x=>x.id===id);state.entries.push({appointmentId:id,appointmentOccurrence:a.date,date:a.date,orderStatus:'done'})};
const bill=d=>{state.quotes.push({...d,number:'RG-2026-'+String(state.quotes.length).padStart(4,'0'),finalizedAt:new Date().toISOString()})};
let st=core.status(state,quote);
assert.equal(st.total,10);assert.equal(st.complete,0);assert.equal(st.unbilled.length,0);
assert.throws(()=>core.prepare(state,quote,'ak1',{}),/Keine erledigte/);
complete('ak1');st=core.status(state,quote);
assert.equal(st.complete,1);assert.equal(st.unbilled.length,1);assert.equal(st.allDone,false);
const first=core.prepare(state,quote,'ak1',{dueDate:'2026-11-18'});
assert.equal(first.invoiceType,'partial');assert.equal(first.net,100);
assert.deepEqual(first.coveredAppointmentIds,['ak1']);assert.equal(first.sourceVisitNumber,1);
assert.equal(first.sourceVisitCount,10);assert.equal(first.tax,0);
bill(first);assert.throws(()=>core.prepare(state,quote,'ak1',{}),/Keine erledigte|nicht erledigt|bereits abgerechnet/);
for(let i=2;i<=10;i++)complete('ak'+i);
st=core.status(state,quote);assert.equal(st.complete,10);assert.equal(st.billed,1);assert.equal(st.unbilled.length,9);
const final=core.prepare(state,quote,'ak2',{dueDate:'2026-12-31'});
assert.equal(final.invoiceType,'final');assert.equal(final.net,900);
assert.equal(final.serviceDate,'02.11.2026 – 10.11.2026','Schlussrechnung muss Zeitraum aller noch offenen AK nennen');
assert.deepEqual(final.coveredAppointmentIds,quote.appointmentIds.slice(1));
assert.equal(final.alreadyInvoicedNet,100);
assert(final.notes.includes('Bisherige Teilrechnungen'));
bill(final);st=core.status(state,quote);
assert.equal(st.billed,10);assert.equal(st.unbilled.length,0);
assert.throws(()=>core.prepare(state,quote,'ak10',{}),/Keine erledigte/);
state.quotes.push({...final,id:'bad-duplicate',number:'RG-2026-0098',finalizedAt:new Date().toISOString()});
assert.throws(()=>core.status(state,quote),/Doppelte Abrechnung/);
state.quotes.pop();
// Complete contract without interim invoices: single complete final invoice
const standalone={...quote,id:'q2',number:'KV-2',appointmentIds:['only'],net:50};
const only={...appointments[0],id:'only',quoteId:'q2',plannedInvoiceNetCents:5000};
const full={quotes:[standalone],appointments:[only],entries:[{appointmentId:'only',date:only.date,appointmentOccurrence:only.date,orderStatus:'done'}]};
const whole=core.prepare(full,standalone,'only',{dueDate:'2026-12-31'});
assert.equal(whole.invoiceType,'final');assert.equal(whole.net,50);
assert.equal(whole.coveredAppointmentIds.length,1);
const split={...quote,id:'q3',number:'KV-3',appointmentIds:['a','b','c'],net:1000.03};
const splitA=[33335,33334,33334].map((n,i)=>({...appointments[i],id:split.appointmentIds[i],quoteId:'q3',plannedInvoiceNetCents:n}));
const splitState={quotes:[split],appointments:splitA,entries:splitA.map(a=>({appointmentId:a.id,appointmentOccurrence:a.date,orderStatus:'done'}))};
const rounding=core.prepare(splitState,split,'a',{dueDate:'2026-12-31'});
assert.equal(rounding.net,1000.03);
assert.equal(core.nextNumber(state,2026),'RG-2026-0003');
assert.throws(()=>core.status(state,{...quote,acceptedAt:''}),/Nur angenommene/);
console.log('BILLING PASS: 10 AK / 1000 EUR, 1/10 partial, 9/10 final, no duplicates, full contract, precise cents, missing acceptance.');
