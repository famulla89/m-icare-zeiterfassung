'use strict';
/* Deterministische kombinatorische Prüfung: Preislogik, Datenintegrität, JSON und verschlüsselte Backups. */
const assert=require('node:assert/strict'),fs=require('node:fs'),{webcrypto}=require('node:crypto');
globalThis.crypto??=webcrypto;
const quote=require('../quote-calculator.js'),cloud=require('../cloud-transfer.js');
const fixture=JSON.parse(fs.readFileSync('testdata/micare-10-kunden.json','utf8'));
let seed=20261025;
function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/0x100000000}
function r(max){return Math.floor(rand()*max)}
const money=n=>Math.round((n+Number.EPSILON)*100)/100;
function scenario(i){
 const scope=['windows','rooms','combined','other'][i%4],visits=r(12)+1;
 const windows=scope==='rooms'||scope==='other'?[]:Array.from({length:r(8)+1},(_,n)=>({
  id:'w'+n,label:'Fenster '+n,qty:r(25)+1,each:money((r(200)+1)/10),rate:money((r(250)+1)/10),
  sides:1+r(2),soil:[1,1.3,1.6][r(3)],frame:r(2)===1,ladder:r(2)===1,lift:r(2)===1
 }));
 return {scope,mode:i%2?'solo':'business',serviceName:'Sonderreinigung',area:r(1500)+1,visits,
  hours:scope==='other'?r(10)+1:r(8)===0?0:r(12)+1,
  sqmPerHour:r(200)+1,hourly:r(70),nonwage:r(45),overhead:r(50),productivity:r(60)+40,
  material:r(100),km:r(125),perKm:money(r(200)/100),margin:r(80),minNet:r(100),vat:[0,7,19][r(3)],
  manualNet:r(5)===0?money(10+r(7000)):0,minimumSqm:money(r(250)/100),
  setupMinutes:r(90),liftRental:r(100),fixedProfit:r(5)===0?r(300):0,windowItems:windows};
}
(async()=>{
 const failures=[],modes={};
 for(let i=0;i<600;i++){
  const v=scenario(i);
  try{
   const x=quote.compute(v);
   assert.equal(x.scope,v.scope);
   assert(Number.isFinite(x.net)&&Number.isFinite(x.gross)&&Number.isFinite(x.tax));
   assert(x.net>=0&&x.gross>=0);
   assert.equal(money(x.net+x.tax),x.gross,'VAT and gross must match');
   assert.equal(money(x.rows.reduce((sum,line)=>sum+line.total,0)),x.net,'PDF line sum must equal net total');
   assert(x.rows.every(line=>line.total>=0&&line.price>=0&&line.title),'No negative or unnamed positions');
   if(v.scope==='rooms'||v.scope==='other'){
    assert.equal(x.windowSqm,0,'Unselected window work may never be charged');
    assert.equal(x.windowsNet,0);
   }else{
    assert.equal(x.windowItems.length,v.windowItems.length);
    assert.equal(x.windowsNet,money(x.windowItems.reduce((sum,w)=>sum+w.total,0)*v.visits));
   }
   if(v.scope==='windows'){
    const changed=quote.compute({...v,area:v.area+3000});
    assert.equal(changed.net,x.net,'Office area must not affect window-only price');
    assert.equal(changed.cleaningCost,x.cleaningCost);
   }
   if(v.manualNet>0)assert.equal(x.net,money(v.manualNet));
   if(v.mode==='solo'&&v.nonwage>0){
    const b=quote.compute({...v,nonwage:0});
    assert.equal(x.cleaningCost,b.cleaningCost,'Solo excludes employee payroll extras');
   }
   const d={id:'qa-'+i,kind:i%2?'quote':'invoice',number:'QA-'+i,customerName:'Testkunde',
    sellerName:'M-iCare Test',service:'Synthetischer Auftrag',rows:x.rows,net:x.net,tax:x.tax,gross:x.gross,vat:x.vat};
   assert.equal(quote.validateDocument(d),d);
   modes[v.scope]=(modes[v.scope]||0)+1;
  }catch(e){failures.push({index:i,message:e.message,scope:v.scope,inputs:v});if(failures.length>8)break}
 }
 if(failures.length)throw Error('Kombinatorische Preis-Fehler: '+JSON.stringify(failures,null,2));
 assert.equal(Object.values(modes).reduce((a,b)=>a+b),600);
 assert.equal(cloud.validateSnapshot(fixture),fixture);
 const backupSource=structuredClone(fixture);
 backupSource.quotes=[{id:'qa-offer',kind:'quote',number:'QA-1',customerName:'Beispielkunde',net:10,tax:1.9,gross:11.9}];
 backupSource.quoteSettings={SellerName:'QA-Reinigung'};
 const plain=JSON.stringify(backupSource);
 const saved=await cloud.encrypt(backupSource,'Das-Ist-Eine-Testpassphrase-2026','synthetisch@example.invalid');
 const encoded=JSON.stringify(saved);
 assert(!encoded.includes('QA-Reinigung')&&!encoded.includes('Beispielkunde'),'No plaintext quote leaked');
 const restored=await cloud.decrypt(saved,'Das-Ist-Eine-Testpassphrase-2026');
 assert.deepEqual(restored.state,backupSource,'Complete snapshot including quotes roundtrip');
 assert.equal(JSON.stringify(backupSource),plain,'Encryption must not mutate source');
 const a=cloud.compare(fixture,restored.state);
 assert(Object.values(a).every(item=>typeof item==='object'),'Diff object exists');
 await assert.rejects(cloud.decrypt(saved,'falsche-passphrase-2026'),/Falsche Passphrase/);
 const wrong={...saved,version:99};
 await assert.rejects(cloud.decrypt(wrong,'Das-Ist-Eine-Testpassphrase-2026'),/unterstützte/);
 console.log('LOGIC FUZZ PASS: 600 deterministic quote combinations, cents, windows vs rooms, tax, solo, 1 cryptographic full-data roundtrip, invalid credentials');
})().catch(e=>{console.error(e);process.exitCode=1});
