'use strict';
/* M-iCare operations helpers: offline-only, deterministic business rules. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.MiCareOperationsCore=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 const cents=value=>Math.round((Number(value)||0)*100);
 const amountCents=value=>{
  const n=Number(String(value).replace(',','.'));
  if(!Number.isFinite(n)||n<=0||n>10000000||Math.round(n*100)!==Number((n*100).toFixed(0)))
   throw Error('Betrag muss positiv und auf Cent genau sein');
  return Math.round(n*100);
 };
 const assertDate=value=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))throw Error('Gültiges Datum erforderlich');
  const [y,m,d]=value.split('-').map(Number),v=new Date(Date.UTC(y,m-1,d));
  if(v.getUTCFullYear()!==y||v.getUTCMonth()!==m-1||v.getUTCDate()!==d)throw Error('Datum ist ungültig');
  return value;
 };
 const currentPayments=(payments,invoiceId)=>(Array.isArray(payments)?payments:[])
  .filter(p=>p&&p.invoiceId===invoiceId&&!p.voidedAt);
 function paymentSummary(invoice,payments,today){
  if(!invoice||invoice.kind!=='invoice'||!invoice.finalizedAt)throw Error('Nur endgültige Rechnungen können bezahlt werden');
  const grossCents=cents(invoice.gross);
  const paidCents=currentPayments(payments,invoice.id).reduce((n,p)=>n+Number(p.amountCents||0),0);
  if(grossCents<0||paidCents<0)throw Error('Ungültige Zahlungssumme');
  const remainingCents=Math.max(0,grossCents-paidCents);
  const overdue=remainingCents>0&&/^\d{4}-\d{2}-\d{2}$/.test(invoice.dueDate||'')&&invoice.dueDate<(today||'9999-12-31');
  return {grossCents,paidCents,remainingCents,overdue,status:remainingCents===0?'paid':paidCents>0?'partial':overdue?'overdue':'open'};
 }
 function addPayment(invoice,payments,form){
  const date=assertDate(form.date);
  const amount=amountCents(form.amount);
  const current=paymentSummary(invoice,payments,date);
  if(amount>current.remainingCents)throw Error('Zahlung übersteigt den offenen Rechnungsbetrag');
  const reference=String(form.reference||'').trim().slice(0,160);
  return {id:String(form.id||''),invoiceId:invoice.id,amountCents:amount,date,reference,
   createdAt:String(form.createdAt||new Date().toISOString())};
 }
 function voidPayment(payment,reason,when){
  if(!payment||payment.voidedAt)throw Error('Zahlung ist nicht mehr aktiv');
  const text=String(reason||'').trim();
  if(text.length<5)throw Error('Zum Stornieren einen Grund mit mindestens fünf Zeichen eingeben');
  return {...payment,voidedAt:when||new Date().toISOString(),voidReason:text.slice(0,500)};
 }
 function validateTemplate(data){
  const name=String(data.name||'').trim();
  if(name.length<3||name.length>80)throw Error('Vorlagenname: 3 bis 80 Zeichen');
  const scope=String(data.scope||'rooms');
  if(!['rooms','windows','combined','other'].includes(scope))throw Error('Unbekannter Leistungsumfang');
  const service=String(data.service||'').trim().slice(0,300);
  if(!service)throw Error('Leistungsbeschreibung fehlt');
  const area=Number(data.area||0);
  if(!Number.isFinite(area)||area<0||area>1000000)throw Error('Ungültige Fläche');
  return {id:String(data.id||''),name,scope,service,objectType:String(data.objectType||'').slice(0,100),
   area,planStart:String(data.planStart||'09:00'),planEnd:String(data.planEnd||'11:00')};
 }
 function conflictsForDay(occurrences){
  const conflicts=[];
  const xs=(occurrences||[]).filter(o=>o&&o.appointment&&o.appointment.employee);
  for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++){
   const a=xs[i],b=xs[j];
   if(a.appointment.employee===b.appointment.employee&&a.start<b.end&&b.start<a.end)
    conflicts.push([a,b]);
  }
  return conflicts;
 }
 return {cents,assertDate,amountCents,paymentSummary,addPayment,voidPayment,validateTemplate,conflictsForDay};
});
