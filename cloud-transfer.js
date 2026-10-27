'use strict';
/**
 * M-iCare Cloud-Dateiübergabe (MVP): AES-GCM + PBKDF2, kein Zugriff auf Google-Konten.
 * Dateiauswahl erfolgt ausschließlich durch die Betriebssystemdialoge.
 * Ein Cloud-Dateiupload ist KEINE automatische bidirektionale Synchronisierung.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.MiCareCloudTransfer=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 const FORMAT='M-iCare-Cloud-Backup';
 const VERSION=1,ITERATIONS=310000,MAX_BYTES=12*1024*1024;
 const categories=['customers','objects','appointments','entries','employees','appointmentTrash','changeHistory','payments','quoteTemplates'];
 function getCrypto(){
  const c=globalThis.crypto;
  if(!c?.subtle||!c?.getRandomValues)throw Error('Verschlüsselung ist in dieser App-Umgebung nicht verfügbar.');
  return c;
 }
 function toBase64(bytes){
  let value='';
  for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(value);
 }
 function fromBase64(value,max=MAX_BYTES){
  if(typeof value!=='string'||value.length>Math.ceil(max*4/3)+24||!/^[-A-Za-z0-9+/]*={0,2}$/.test(value)||value.length%4!==0)throw Error('Ungültige Verschlüsselungsdaten');
  const bin=atob(value);
  if(bin.length>max)throw Error('Sicherung zu groß');
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return bytes;
 }
 function checkPassphrase(passphrase){
  if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>256)throw Error('Bitte eine Verschlüsselungs-Passphrase mit mindestens 12 Zeichen verwenden.');
 }
 function checkEnvelope(doc){
  if(!doc||typeof doc!=='object'||doc.format!==FORMAT||doc.version!==VERSION)throw Error('Keine unterstützte verschlüsselte M-iCare-Sicherung');
  if(doc.cipher!=='AES-256-GCM'||doc.kdf!=='PBKDF2-SHA256'||doc.iterations!==ITERATIONS)throw Error('Unbekannte Verschlüsselungsversion');
  if(typeof doc.createdAt!=='string'||typeof doc.snapshotId!=='string'||!/^[a-f0-9-]{36}$/i.test(doc.snapshotId))throw Error('Ungültige Sicherungsmetadaten');
  if(!doc.salt||!doc.iv||!doc.ciphertext)throw Error('Sicherung unvollständig');
  const salt=fromBase64(doc.salt,16),iv=fromBase64(doc.iv,12);
  if(salt.length!==16||iv.length!==12)throw Error('Ungültige Verschlüsselungsparameter');
  return {salt,iv,ciphertext:fromBase64(doc.ciphertext)};
 }
 async function makeKey(passphrase,salt){
  const c=getCrypto();
  const material=await c.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
  return c.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }
 function validateSnapshot(state){
  if(!state||typeof state!=='object'||Array.isArray(state))throw Error('Ungültiger Datenbestand');
  for(const key of ['customers','objects','appointments','entries','employees'])if(!Array.isArray(state[key]))throw Error('Sicherung enthält keine vollständigen '+key);
  const limit={customers:5000,objects:20000,appointments:30000,entries:50000,employees:5000,appointmentTrash:5000,changeHistory:4000,payments:50000,quoteTemplates:50};
  for(const [key,max] of Object.entries(limit))if(state[key]!==undefined&&(!Array.isArray(state[key])||state[key].length>max))throw Error('Ungültige Anzahl '+key);
  for(const key of ['customers','objects','appointments','entries']){
   const ids=new Set();
   for(const item of state[key]){
    if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.id!=='string'||!item.id||item.id.length>100||ids.has(item.id))throw Error('Fehlerhafte oder doppelte ID in '+key);
    ids.add(item.id);
   }
  }
  if(state.employees.some(x=>typeof x!=='string'||!x.trim()||x.length>80)||new Set(state.employees).size!==state.employees.length)throw Error('Ungültige Mitarbeiterliste');
  const cid=new Set(state.customers.map(x=>x.id)),oid=new Set(state.objects.map(x=>x.id));
  // Bereits erfasste Arbeitszeiten bleiben auch erhalten, wenn die ursprüngliche Terminserie im Papierkorb liegt.
  const aid=new Set([...state.appointments.map(x=>x.id),...(state.appointmentTrash||[]).map(t=>t?.appointment?.id).filter(Boolean)]);
  if(state.objects.some(o=>o.customerId&&!cid.has(o.customerId)))throw Error('Geschäftsstelle ohne zugehörigen Kunden');
  if(state.appointments.some(a=>(a.customerId&&!cid.has(a.customerId))||(a.objectId&&!oid.has(a.objectId))))throw Error('Auftrag mit unbekanntem Kunden oder Objekt');
  for(const e of state.entries){
   if(typeof e.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||typeof e.start!=='string'||typeof e.end!=='string'||!/^\d{2}:\d{2}$/.test(e.start)||!/^\d{2}:\d{2}$/.test(e.end)||!state.employees.includes(e.employee)||typeof e.service!=='string')throw Error('Ungültige Arbeitszeiterfassung');
   if(e.customerId&&!cid.has(e.customerId)||e.objectId&&!oid.has(e.objectId)||e.appointmentId&&!aid.has(e.appointmentId))throw Error('Arbeitszeit verweist auf unbekannten Auftrag/Kunden');
   if(e.corrections!==undefined&&(!Array.isArray(e.corrections)||e.corrections.length>5000))throw Error('Ungültige Korrekturhistorie');
  }
  // Auch neue lokale Zahlungs- und Vorlagendaten dürfen beim Wiederherstellen nicht ungeprüft übernommen werden.
  if(state.payments!==undefined){
   if(!Array.isArray(state.payments)||state.payments.length>50000)throw Error('Ungültige Zahlungsliste');
   const ids=new Set(),invoiceIds=new Set((state.quotes||[]).filter(q=>q.kind==='invoice'&&q.finalizedAt).map(q=>q.id));
   for(const p of state.payments){
    if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id)||!invoiceIds.has(p.invoiceId)||
       !Number.isSafeInteger(p.amountCents)||p.amountCents<1||p.amountCents>1000000000||
       !/^\d{4}-\d{2}-\d{2}$/.test(String(p.date||''))||
       typeof p.reference!=='string'||p.reference.length>160||typeof p.createdAt!=='string'||
       p.voidedAt&&!p.voidReason)throw Error('Ungültiger Zahlungseintrag');
    ids.add(p.id);
   }
  }
  if(state.quoteTemplates!==undefined){
   if(!Array.isArray(state.quoteTemplates)||state.quoteTemplates.length>50)throw Error('Ungültige Angebotsvorlagen');
   const ids=new Set();
   for(const t of state.quoteTemplates){
    if(!t||typeof t.id!=='string'||!t.id||ids.has(t.id)||typeof t.name!=='string'||t.name.length<3||
       typeof t.service!=='string'||!t.service||!['rooms','windows','combined','other'].includes(t.scope))
      throw Error('Ungültige Leistungsvorlage');
    ids.add(t.id);
   }
  }
  if(globalThis.MiCareOperationsCore?.validateOperationsSnapshot)globalThis.MiCareOperationsCore.validateOperationsSnapshot(state);
  return state;
 }
 function counts(state){
  return Object.fromEntries(categories.map(k=>[k,Array.isArray(state[k])?state[k].length:0]));
 }
 function compare(local,remote){
  validateSnapshot(remote);
  const out={};
  for(const type of ['customers','objects','appointments','entries']){
   const a=new Map((local[type]||[]).map(x=>[x.id,x])),b=new Map(remote[type].map(x=>[x.id,x]));
   let added=0,changed=0,removed=0;
   for(const [id,row] of b){if(!a.has(id))added++;else if(JSON.stringify(a.get(id))!==JSON.stringify(row))changed++}
   for(const id of a.keys())if(!b.has(id))removed++;
   out[type]={added,changed,removed};
  }
  for(const type of ['payments','quoteTemplates']){
   const a=new Map((local[type]||[]).map(x=>[x.id,x])),b=new Map((remote[type]||[]).map(x=>[x.id,x]));
   let added=0,changed=0,removed=0;
   for(const [id,row] of b){if(!a.has(id))added++;else if(JSON.stringify(a.get(id))!==JSON.stringify(row))changed++}
   for(const id of a.keys())if(!b.has(id))removed++;
   out[type]={added,changed,removed};
  }
  out.employees={local:(local.employees||[]).length,remote:remote.employees.length};
  return out;
 }
 async function encrypt(state,passphrase,ownerEmail=''){
  checkPassphrase(passphrase);
  validateSnapshot(state);
  const normalizedOwner=String(ownerEmail||'').trim().toLowerCase();
  const payload={ownerEmail:normalizedOwner,exportedAt:new Date().toISOString(),state};
  const plain=new TextEncoder().encode(JSON.stringify(payload));
  if(plain.length>MAX_BYTES-2048)throw Error('Datenbestand für Cloud-Sicherung zu groß');
  const c=getCrypto(),salt=c.getRandomValues(new Uint8Array(16)),iv=c.getRandomValues(new Uint8Array(12));
  const key=await makeKey(passphrase,salt);
  const encoded=await c.subtle.encrypt({name:'AES-GCM',iv},key,plain);
  return {format:FORMAT,version:VERSION,createdAt:payload.exportedAt,snapshotId:c.randomUUID(),cipher:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:toBase64(salt),iv:toBase64(iv),ciphertext:toBase64(new Uint8Array(encoded))};
 }
 async function decrypt(envelope,passphrase){
  checkPassphrase(passphrase);
  const {salt,iv,ciphertext}=checkEnvelope(envelope);
  const key=await makeKey(passphrase,salt);
  let plain;
  try{plain=await getCrypto().subtle.decrypt({name:'AES-GCM',iv},key,ciphertext)}
  catch{throw Error('Falsche Passphrase oder Sicherungsdatei beschädigt. Lokale Daten wurden nicht geändert.')}
  let payload;
  try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain))}
  catch{throw Error('Entschlüsselte Daten sind kein gültiges JSON')}
  if(!payload||typeof payload.ownerEmail!=='string'||typeof payload.exportedAt!=='string')throw Error('Sicherung enthält unvollständige Metadaten');
  validateSnapshot(payload.state);
  return {state:payload.state,ownerEmail:payload.ownerEmail,exportedAt:payload.exportedAt,snapshotId:envelope.snapshotId};
 }
 return {FORMAT,VERSION,MAX_BYTES,encrypt,decrypt,validateSnapshot,counts,compare,checkPassphrase,checkEnvelope};
});
