'use strict';
/* M-iCare: offline-only operational cockpit. No sync, no remote storage. */
(function(root){
 const core=root.MiCareOperationsCore;
 const $=id=>document.getElementById(id);
 const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);return node};
 const euro=value=>Number(value||0).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
 const dateDE=iso=>/^\d{4}-\d\d-\d\d$/.test(String(iso||''))?iso.slice(8)+'.'+iso.slice(5,7)+'.'+iso.slice(0,4):String(iso||'');
 let api=null;
 const state=()=>api.getState();
 function today(){return api.today()}
 function localDateAfter(days){
  const d=new Date(today()+'T12:00:00');d.setDate(d.getDate()+days);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 }
 function occurrenceList(from,to){
  return (state().appointments||[]).flatMap(a=>api.datesFor(a,from,to)).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
 }
 function customerName(id){return state().customers.find(c=>c.id===id)?.name||'Unbekannter Kunde'}
 function objectName(id){return state().objects.find(o=>o.id===id)?.name||'Ohne Objekt'}
 function entryFor(item){
  return api.completedEntry(item);
 }
 function button(label,fn,secondary=true){
  const b=el('button',label);b.type='button';if(secondary)b.className='secondary smallbtn';b.onclick=fn;return b;
 }
 function renderToday(){
  const box=$('miTodayList');if(!box)return;box.replaceChildren();
  const items=occurrenceList(today(),today());
  const done=items.filter(x=>entryFor(x)?.orderStatus==='done').length;
  $('miTodaySummary').textContent=items.length+' Einsätze heute · '+done+' erledigt · '+(items.length-done)+' noch offen';
  if(!items.length){box.append(el('p','Heute sind keine Arbeitskarten geplant.'));return}
  for(const x of items){
   const doneEntry=entryFor(x),status=doneEntry?.orderStatus==='done'?'Erledigt':doneEntry?'In Bearbeitung':'Offen';
   const line=el('div');line.className='mi-op-row';
   const info=el('div');info.className='mi-op-row-main';
   const title=el('strong',x.start+'–'+x.end+' · '+customerName(x.appointment.customerId));
   info.append(title,el('span',objectName(x.appointment.objectId)+' · AK '+(x.appointment.akNumber||'–')+' · '+(x.appointment.service||'')));
   const tag=el('span',status);tag.className='mi-op-tag '+(status==='Erledigt'?'done':status==='In Bearbeitung'?'progress':'open');
   const actions=el('div');actions.className='mi-op-actions';
   actions.append(button(doneEntry?'Arbeit ansehen':'Arbeit dokumentieren',()=>api.openAk(x)));
   if(x.appointment.quoteId)actions.append(button('Auftragsakte',()=>openOrder(x.appointment.quoteId)));
   line.append(info,tag,actions);box.append(line);
  }
 }
 function renderBackup(){
  const holder=$('miBackupHealth');if(!holder)return;holder.replaceChildren();
  const s=state();const date=s.lastBackup?new Date(s.lastBackup).toLocaleString('de-DE'):'Keine externe Sicherung dokumentiert';
  const label=s.lastSave&&(!s.lastBackup||new Date(s.lastBackup)<new Date(s.lastSave))?'Datensicherung empfohlen':'Letzter externer Sicherungsstand';
  holder.append(el('strong',label),el('span',date));
  holder.append(button('Sicherung öffnen',()=>api.show('backupSection')));
 }
 function renderHome(){
  renderToday();renderBackup();
  const counter=$('homeAppointmentCount');
  if(counter){counter.textContent=String(occurrenceList(today(),localDateAfter(29)).length)}
 }
 function openOrder(id){
  api.show('orderWorkspace');
  const input=$('miOrderSearch');if(input)input.value='';
  renderOrderWorkspace(id);
 }
 function renderOrderWorkspace(selectedId){
  const host=$('miOrderList');if(!host)return;host.replaceChildren();
  const query=String($('miOrderSearch').value||'').toLocaleLowerCase('de-DE').trim();
  let orders=(state().quotes||[]).filter(q=>q.kind==='quote'&&q.acceptedAt)
   .filter(q=>!query||[q.number,q.customerName,q.service,q.objectName].some(v=>String(v||'').toLocaleLowerCase('de-DE').includes(query)));
  orders.sort((a,b)=>Number(b.id===selectedId)-Number(a.id===selectedId)||String(b.acceptedAt).localeCompare(String(a.acceptedAt)));
  $('miOrderCount').textContent=orders.length+' angenommene Aufträge';
  if(!orders.length){host.append(el('p','Keine passenden Aufträge.'));return}
  for(const q of orders){
   const ids=q.appointmentIds||[];
   const slots=ids.map(id=>state().appointments.find(a=>a.id===id)).filter(Boolean);
   const done=slots.filter(a=>entryFor({appointment:a,originalDate:a.date,date:a.date})?.orderStatus==='done').length;
   const docs=(state().quotes||[]).filter(d=>d.kind==='invoice'&&d.finalizedAt&&d.sourceQuoteId===q.id);
   const section=el('details');section.className='mi-op-order';section.open=q.id===selectedId;
   const summary=el('summary',q.number+' · '+q.customerName+' · '+done+'/'+ids.length+' AK erledigt');
   section.append(summary);
   const inner=el('div');inner.className='mi-op-order-body';
   inner.append(el('div','Leistung: '+(q.service||'–')+' · Objekt: '+(q.objectName||'–')));
   inner.append(el('div','Auftragswert: '+euro(q.gross)+' brutto · '+docs.length+' ausgestellte Rechnung(en)'));
   const meter=el('progress');meter.max=Math.max(1,ids.length);meter.value=done;meter.setAttribute('aria-label','Auftragsfortschritt');inner.append(meter);
   const actions=el('div');actions.className='mi-op-actions';
   actions.append(button('Im Kalender',()=>api.show('appointmentsPanel')));
   actions.append(button('Rechnungen',()=>api.show('billingScreen')));
   inner.append(actions);
   const work=el('div');work.className='mi-op-work';
   for(const a of slots){
    const entry=entryFor({appointment:a,originalDate:a.date,date:a.date});
    const line=el('div');line.className='mi-op-row';
    const details=el('div');details.className='mi-op-row-main';
    details.append(el('strong','AK '+(a.akNumber||'–')+' · '+dateDE(a.date)),
     el('span',(a.service||'')+' · '+(entry?.orderStatus==='done'?'Erledigt':entry?'In Bearbeitung':'Noch offen')));
    if(entry?.workDone)details.append(el('span',entry.workDone));
    line.append(details,button(entry?'Dokumentation öffnen':'Arbeit dokumentieren',()=>{
      const occ=api.datesFor(a,a.date,a.date).find(x=>x.originalDate===a.date)||{appointment:a,date:a.date,originalDate:a.date,start:a.start,end:a.end};
      api.openAk(occ);
    }));work.append(line);
   }
   inner.append(work);
   if(docs.length){
    inner.append(el('h4','Rechnungen'));
    for(const d of docs)inner.append(el('div',d.number+' · '+euro(d.gross)+' · '+(d.invoiceType==='final'?'Schlussrechnung':'Teilrechnung')));
   }
   section.append(inner);host.append(section);
  }
 }
 function renderPayments(){
  const host=$('miPaymentList');if(!host)return;host.replaceChildren();
  const invoices=(state().quotes||[]).filter(x=>x.kind==='invoice'&&x.finalizedAt)
   .sort((a,b)=>String(b.finalizedAt).localeCompare(String(a.finalizedAt)));
  const select=$('miPayInvoice'),selected=select.value;
  select.replaceChildren();
  for(const invoice of invoices){const o=el('option',invoice.number+' · '+invoice.customerName);o.value=invoice.id;select.append(o)}
  if(invoices.some(i=>i.id===selected))select.value=selected;
  let open=0,overdue=0;
  for(const inv of invoices){
   const m=core.paymentSummary(inv,state().payments||[],today());open+=m.remainingCents;if(m.overdue)overdue++;
   const row=el('div');row.className='mi-op-row';const info=el('div');info.className='mi-op-row-main';
   info.append(el('strong',inv.number+' · '+inv.customerName),
     el('span','Betrag '+euro(inv.gross)+' · Eingegangen '+euro(m.paidCents/100)+' · Offen '+euro(m.remainingCents/100)));
   const tag=el('span',m.status==='paid'?'Bezahlt':m.status==='partial'?'Teilbezahlt':m.status==='overdue'?'Überfällig':'Offen');
   tag.className='mi-op-tag '+(m.status==='paid'?'done':m.status==='overdue'?'late':m.status==='partial'?'progress':'open');
   row.append(info,tag);
   if(m.remainingCents>0)row.append(button('Zahlung erfassen',()=>{select.value=inv.id;$('miPayAmount').value=(m.remainingCents/100).toFixed(2);$('miPayAmount').focus()}));
   const payments=(state().payments||[]).filter(p=>p.invoiceId===inv.id&&!p.voidedAt);
   for(const p of payments){
    const paid=el('div');paid.className='mi-op-payment';
    paid.append(el('span','Zahlung '+dateDE(p.date)+' · '+euro(p.amountCents/100)+(p.reference?' · '+p.reference:'')));
    paid.append(button('Stornieren',async()=>{
      const reason=prompt('Stornierungsgrund (mindestens 5 Zeichen):');if(reason===null)return;
      try{
       const index=state().payments.findIndex(x=>x.id===p.id);
       const revised=core.voidPayment(p,reason);
       state().payments[index]=revised;
       try{await api.save()}catch(e){state().payments[index]=p;throw e}
       renderPayments();
      }catch(e){alert(e.message)}
    }));
    host.append(paid);
   }
   host.append(row);
  }
  $('miPaymentSummary').textContent=invoices.length+' Rechnungen · '+euro(open/100)+' offen · '+overdue+' überfällig. Zahlungen nur nach tatsächlich bestätigtem Geldeingang erfassen.';
  if(!invoices.length)host.append(el('p','Noch keine endgültig ausgestellten Rechnungen vorhanden.'));
  $('miPaySubmit').disabled=invoices.length===0;
 }
 async function savePayment(event){
  event.preventDefault();
  const submit=$('miPaySubmit');if(submit.disabled)return;submit.disabled=true;
  try{
   const inv=state().quotes.find(x=>x.id===$('miPayInvoice').value);
   const payment=core.addPayment(inv,state().payments||[],{
    id:root.crypto?.randomUUID?.()||'pay-'+Date.now(),
    amount:$('miPayAmount').value,date:$('miPayDate').value,reference:$('miPayNote').value});
   if(!confirm('Eingang von '+euro(payment.amountCents/100)+' für Rechnung '+inv.number+' verbindlich erfassen?'))return;
   state().payments??=[];state().payments.push(payment);
   try{await api.save()}catch(e){state().payments=state().payments.filter(x=>x!==payment);throw e}
   $('miPayAmount').value='';$('miPayNote').value='';renderPayments();
  }catch(e){alert('Zahlung konnte nicht gespeichert werden: '+e.message)}
  finally{submit.disabled=false}
 }
 function renderTemplates(){
  const select=$('miTemplateSelect');if(!select)return;
  const prior=select.value;select.replaceChildren();
  const empty=el('option','Vorlage auswählen');empty.value='';select.append(empty);
  for(const t of state().quoteTemplates||[]){const item=el('option',t.name);item.value=t.id;select.append(item)}
  if([...select.options].some(x=>x.value===prior))select.value=prior;
 }
 function storeTemplate(){
  const name=prompt('Name der neuen Leistungsvorlage (z. B. Büroreinigung wöchentlich):');
  if(name===null)return;
  try{
   const template=core.validateTemplate({
    id:root.crypto?.randomUUID?.()||'tpl-'+Date.now(),name,
    scope:$('qScope').value,service:$('qService').value,objectType:$('qObjectType').value,
    area:$('qArea').value,planStart:$('qPlanStart').value,planEnd:$('qPlanEnd').value});
   state().quoteTemplates??=[];
   if(state().quoteTemplates.length>=50)throw Error('Maximal 50 Vorlagen. Bitte ältere Vorlage löschen.');
   if(state().quoteTemplates.some(t=>t.name.toLocaleLowerCase('de-DE')===template.name.toLocaleLowerCase('de-DE')))throw Error('Vorlagenname bereits vorhanden');
   state().quoteTemplates.push(template);
   api.save().then(()=>renderTemplates()).catch(e=>{state().quoteTemplates=state().quoteTemplates.filter(x=>x.id!==template.id);alert('Vorlage speichern fehlgeschlagen: '+e.message)});
  }catch(e){alert(e.message)}
 }
 function applyTemplate(){
  const t=(state().quoteTemplates||[]).find(t=>t.id===$('miTemplateSelect').value);if(!t)return;
  for(const [id,val] of Object.entries({qScope:t.scope,qService:t.service,qObjectType:t.objectType,qArea:t.area,qPlanStart:t.planStart,qPlanEnd:t.planEnd})){
   const input=$(id);if(!input)continue;
   input.value=String(val??'');input.dispatchEvent(new Event('change',{bubbles:true}));input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  $('miTemplateInfo').textContent='Vorlage „'+t.name+'“ angewendet. Kunden, Termine, Preise und Steuern bitte prüfen; sie wurden nicht übernommen.';
 }
 async function deleteTemplate(){
  const id=$('miTemplateSelect').value;if(!id)return;
  if(!confirm('Ausgewählte Vorlage entfernen? Bestehende Angebote bleiben unverändert.'))return;
  const previous=state().quoteTemplates;
  state().quoteTemplates=previous.filter(x=>x.id!==id);
  try{await api.save();renderTemplates()}catch(e){state().quoteTemplates=previous;alert(e.message)}
 }
 function checklistSuggestions(){
  const service=String($('service').value||'').toLocaleLowerCase('de-DE');
  if(service.includes('fenster')||service.includes('glas'))return ['Glasflächen gereinigt','Rahmen und Fensterbänke gereinigt','Arbeitsbereich kontrolliert'];
  if(service.includes('treppen'))return ['Treppen gekehrt','Böden gewischt','Handläufe und Eingänge gereinigt'];
  return ['Böden gereinigt','Oberflächen gereinigt','Sanitär- und Kontaktflächen geprüft','Abschlusskontrolle durchgeführt'];
 }
 function renderChecklist(){
  const host=$('miChecklistOptions');if(!host)return;
  host.replaceChildren();
  for(const item of checklistSuggestions()){
   const label=el('label');label.className='mi-op-check';
   const cb=el('input');cb.type='checkbox';cb.value=item;
   label.append(cb,el('span',item));host.append(label)
  }
 }
 function insertChecklist(){
  const checked=[...$('miChecklistOptions').querySelectorAll('input:checked')].map(x=>x.value);
  if(!checked.length){alert('Bitte mindestens eine Tätigkeit auswählen.');return}
  const work=$('workDone'),existing=work.value.trim();
  const added=checked.filter(x=>!existing.includes(x));
  work.value=[existing,...added].filter(Boolean).join(existing?'\n':'\n');
  work.dispatchEvent(new Event('input',{bubbles:true}));
  $('miChecklistStatus').textContent=added.length+' Arbeiten in den Leistungsnachweis übernommen. Bitte vor dem Speichern prüfen.';
 }
 function refresh(){
  if(!api)return;
  renderHome();renderPayments();renderTemplates();
  if($('orderWorkspace')?.classList.contains('active'))renderOrderWorkspace();
 }
 function init(context){
  if(api||!core)return;api=context;
  $('miPayDate').value=today();
  $('miPayForm').addEventListener('submit',savePayment);
  $('miOrderSearch').addEventListener('input',()=>renderOrderWorkspace());
  $('miTemplateSave').onclick=storeTemplate;$('miTemplateApply').onclick=applyTemplate;$('miTemplateDelete').onclick=deleteTemplate;
  $('miChecklistApply').onclick=insertChecklist;
  $('service').addEventListener('change',renderChecklist);
  renderChecklist();refresh();
 }
 root.MiCareOperationsUI={init,refresh,renderHome,renderPayments,renderOrderWorkspace,openOrder,renderChecklist};
})(typeof globalThis!=='undefined'?globalThis:this);
