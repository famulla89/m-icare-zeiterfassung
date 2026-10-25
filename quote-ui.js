'use strict';
/* Kalkulationsrechner: Verknüpfung mit bestehenden M-iCare-Kunden, Objekten und AK. */
(function(){
 const byId=id=>document.getElementById(id);
 const tracked=['Scope','Customer','Object','Appointment','Service','ObjectType','Area','Wc','Kitchen','Heavy','Visits','Hours','SqmHour','Hourly','Nonwage','Overhead','Productivity','Material','Km','KmPrice','Margin','MinNet','MinimumSqm','SetupMinutes','LiftRental','FixedProfit','ManualNet','TaxMode','Vat','Kind','Number','ServiceDate','ValidUntil','SellerName','SellerAddress','SellerTax','SellerEmail','SellerPhone','RecipientEmail','Iban','Notes','PlanDate','PlanEmployee','PlanStart','PlanEnd','PlanRhythm','PlanMode','PlanEndDate','PlanEveryWeeks','PlanReminderDays'];
 // Einträge in öffentlich zugänglichen Firmenverzeichnissen; mögliche Adressänderungen bitte prüfen.
 const companyPublic={SellerName:'M-iCare Gebäudereinigung',SellerAddress:'Lippestraße 9, 58097 Hagen',SellerEmail:'info@m-icare-gebaeudereinigung.de',SellerPhone:'0162 8564663'};
 const typeAreas={standard:{label:'Standardfenster',sqm:1.5},large:{label:'Große Glasflächen',sqm:4},sliding:{label:'Schiebeelemente',sqm:2.5},mullion:{label:'Sprossenfenster',sqm:1.2},winter:{label:'Wintergarten',sqm:1},roof:{label:'Glasüberdachung',sqm:1}};
 let windowItems=[];
 const de=n=>Number(n).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
 const validEmail=s=>/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(String(s||''))&&String(s).length<=254;
 const isoDay=s=>{try{return germanToIso(s)}catch{return ''}};
 let invoiceFinalizing=false;
 let activeId=null;
 function value(key){return byId('q'+key)?.value||''}
 function num(key){const node=byId('q'+key);if(!node)throw Error('Fehlende Eingabe '+key);const n=Number(node.value);if(!node.value.trim()||!Number.isFinite(n)||n<0)throw Error('Ungültiger Wert in '+(node.labels?.[0]?.textContent||key));return n}
 function option(sel,value,label){const n=document.createElement('option');n.value=value;n.textContent=label;sel.append(n)}
 function refreshCustomers(){
  const select=byId('qCustomer'),prev=select.value;select.replaceChildren();option(select,'','– Kunden auswählen –');
  for(const c of state.customers||[])option(select,c.id,(c.publicNumber||'–')+' · '+c.name+(c.archived?' (archiviert)':''));
  if([...select.options].some(o=>o.value===prev))select.value=prev;
  updateObjects();
 }
 function updateObjects(){
  const select=byId('qObject'),prev=select.value;select.replaceChildren();option(select,'','– Geschäftsstelle auswählen –');
  for(const o of (state.objects||[]).filter(o=>o.customerId===value('Customer'))){
   option(select,o.id,(o.publicNumber||'–')+' · '+o.name+(o.archived?' (archiviert)':''));
  }
  if([...select.options].some(o=>o.value===prev))select.value=prev;
  updateAppointments();
 }
 function updateAppointments(){
  const select=byId('qAppointment'),prev=select.value;select.replaceChildren();option(select,'','– ohne Arbeitskarte –');
  for(const a of (state.appointments||[]).filter(a=>a.customerId===value('Customer')&&(!value('Object')||a.objectId===value('Object')))){
   option(select,a.id,'AK '+(a.akNumber||'–')+' · '+(a.service||'Reinigung')+' · '+(a.date||'')+(a.repeat&&a.repeat!=='none'?' · wiederkehrend':''));
  }
  if([...select.options].some(o=>o.value===prev))select.value=prev;
 }
 function selectAppointment(){
  const a=state.appointments.find(x=>x.id===value('Appointment'));if(!a)return calculate();
  if(a.objectId&&a.objectId!==value('Object')){byId('qObject').value=a.objectId;updateAppointments();byId('qAppointment').value=a.id}
  if(a.service){byId('qService').value=a.service;const service=a.service.toLocaleLowerCase('de-DE');const scope=/glas|fenster|wintergarten/.test(service)?'windows':/grundreinigung|unterhaltsreinigung|büroreinigung|gebäudereinigung|treppenhaus|praxis|bauendreinigung/.test(service)?'rooms':'other';byId('qScope').value=scope;updateScope()}
  if(a.date)byId('qServiceDate').value=formatDate(a.date);
  // Ein einmalig geplanter AK-Termin darf nicht versehentlich mit dem Standardwert von 8 Einsätzen berechnet werden.
  // Bei Daueraufträgen wird die Anzahl der abzurechnenden Einsätze weiterhin ausdrücklich gewählt.
  if(!a.repeat||a.repeat==='once')byId('qVisits').value='1';
  // Dauerauftrag: Anzahl der abzurechnenden Einsätze bleibt frei wählbar.
  calculate();
 }
 function windowEntries(){
  return windowItems.map(item=>({...item}));
 }
 function numberField(label,value,min,max,step,onChange){
  const wrapper=document.createElement('div');
  const text=document.createElement('label');text.textContent=label;
  const n=document.createElement('input');n.type='number';n.min=min;n.max=max;n.step=step;n.value=String(value);
  n.addEventListener('input',()=>onChange(n.value));
  wrapper.append(text,n);return wrapper;
 }
 function dropdown(label,values,current,onChange){
  const wrapper=document.createElement('div'),text=document.createElement('label'),s=document.createElement('select');
  text.textContent=label;
  for(const [val,name] of values)option(s,String(val),name);
  s.value=String(current);s.addEventListener('change',()=>onChange(s.value));
  wrapper.append(text,s);return wrapper;
 }
 function renderWindowItems(){
  const area=byId('qWindowItems');area.replaceChildren();
  if(!windowItems.length){const p=document.createElement('p');p.className='hint';p.textContent='Noch keine Fensterart erfasst. Wähle unten eine oder mehrere Fensterarten aus.';area.append(p)}
  windowItems.forEach((item,i)=>{
   const block=document.createElement('div');block.className='quoteWindowRow';
   const head=document.createElement('div');head.className='quoteWindowHead';
   const title=document.createElement('strong');title.textContent=(i+1)+'. '+item.label;
   const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='🗑 Entfernen';
   del.onclick=()=>{windowItems.splice(i,1);renderWindowItems();calculate()};
   head.append(title,del);block.append(head);
   const grid=document.createElement('div');grid.className='quoteWindowGrid';
   const update=(field,raw)=>{item[field]=Number(raw);calculate()};
   grid.append(
    numberField('Stückzahl',item.qty,1,100000,1,v=>update('qty',v)),
    numberField('Fläche pro Stück in m²',item.each,0.01,100000,0.1,v=>update('each',v)),
    numberField('Dein Preis pro m²/Seite (€)',item.rate,0,10000,0.1,v=>update('rate',v)),
    dropdown('Reinigungsseite',[['1','Einseitig'],['2','Beidseitig']],item.sides,v=>update('sides',v)),
    dropdown('Verschmutzungsgrad',[['1','Normal'],['1.3','Erhöht'],['1.6','Stark']],item.soil,v=>update('soil',v))
   );block.append(grid);
   const extras=document.createElement('div');extras.className='quoteWindowExtras';
   for(const [key,text] of [['frame','Rahmen & Falz (+20 %)'],['ladder','Leiter (+30 %)'],['lift','Hebebühne (+70 %)']]){
    const label=document.createElement('label'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=!!item[key];
    checkbox.addEventListener('change',()=>{item[key]=checkbox.checked;calculate()});
    label.append(checkbox,document.createTextNode(text));extras.append(label);
   }
   block.append(extras);area.append(block);
  });
 }
 function addWindow(type){
  const config=typeAreas[type];if(!config)return;
  if(windowItems.length>=8){alert('Maximal acht verschiedene Fensterpositionen pro Kostenvoranschlag.');return}
  windowItems.push({id:crypto.randomUUID(),label:config.label,qty:1,each:config.sqm,rate:3,sides:1,soil:1,frame:false,ladder:false,lift:false});
  renderWindowItems();calculate();
 }
 function updateScope(){
  const scope=value('Scope'),rooms=scope==='rooms'||scope==='combined',windows=scope==='windows'||scope==='combined';
  for(const node of document.querySelectorAll('#quoteCalculator .qRoomsOnly'))node.classList.toggle('hidden',!rooms);
  byId('qWindowSection').classList.toggle('hidden',!windows);
  const descriptions={
   rooms:'Es wird NUR die Raum-/Bodenreinigung kalkuliert. Keine Fensterpositionen auf dem Angebot. Fläche und m² pro Stunde sind nur relevant, wenn du bei Arbeitsstunden 0 einträgst.',
   windows:'Es werden NUR die Fenster-/Glaspositionen und allgemeine Kosten (z. B. Fahrt, Material und geschätzte Arbeitszeit) kalkuliert. Die 200 m² Bürofläche zählen hier NICHT. Bitte Fenster unten hinzufügen.',
   combined:'Raumreinigung UND Fensterreinigung. Die Raumfläche und die getrennt erfassten Fenster werden beide berechnet. „Stunden pro Einsatz“ gelten für den gesamten Mitarbeitereinsatz.',
   other:'Nur die frei beschriebene Dienstleistung – z. B. Sonderreinigung oder Hausmeisterarbeit. Du gibst eine geschätzte Arbeitszeit ein; Bürofläche und Fenster werden NICHT automatisch berechnet.'
  };
  byId('qScopeHint').textContent=descriptions[scope]||descriptions.rooms;
  const hourLabel=byId('qHours').labels?.[0];
  if(hourLabel)hourLabel.textContent=rooms?'Arbeitsstunden pro Einsatz (0 = automatisch aus Raumfläche; 2 = 2 Stunden)':'Arbeitsstunden pro Einsatz (2 = 2 Std., 0,5 = 30 Min.; 50 = 50 Std.!)';
  if(scope==='windows'&&value('Service')==='Unterhaltsreinigung')byId('qService').value='Glas- & Fensterreinigung';
  if(scope==='other'&&value('Service')==='Unterhaltsreinigung')byId('qService').value='Sonstige Reinigungsleistung';
  calculate();
 }
 function readInput(){
  const wc=byId('qWc').checked,kitchen=byId('qKitchen').checked,heavy=byId('qHeavy').checked;
  const factor=1+(wc?0.12:0)+(kitchen?0.08:0)+(heavy?0.15:0);
  return {
   scope:value('Scope'),serviceName:value('Service'),area:num('Area'),visits:num('Visits'),hours:num('Hours'),sqmPerHour:num('SqmHour')/factor,
   hourly:num('Hourly'),nonwage:num('Nonwage'),overhead:num('Overhead'),mode:document.querySelector('input[name="qMode"]:checked')?.value||'business',
   productivity:num('Productivity'),material:num('Material'),km:num('Km'),perKm:num('KmPrice'),
   margin:num('Margin'),minNet:num('MinNet'),manualNet:num('ManualNet'),
   minimumSqm:num('MinimumSqm'),setupMinutes:num('SetupMinutes'),liftRental:num('LiftRental'),fixedProfit:num('FixedProfit'),
   vat:value('TaxMode')==='small'?0:Number(value('Vat')),windowItems:windowEntries()
  };
 }
 function renderSummary(out){
  const node=byId('qSummary');node.replaceChildren();
  const title=document.createElement('div');title.textContent='Dein berechneter Gesamtpreis';node.append(title);
  const total=document.createElement('strong');total.textContent=de(out.gross)+(value('TaxMode')==='small'?' Gesamtbetrag':' brutto');node.append(total);
  const info=document.createElement('p');info.className='hint';
  info.textContent=(value('TaxMode')==='small'?'Kleinunternehmer (§ 19 UStG), keine Umsatzsteuer · ':'Netto '+de(out.net)+' · Umsatzsteuer '+de(out.tax)+' ('+out.vat+' %) · ')+out.visits+' Einsätze à ca. '+out.hoursPerVisit+' Std.';
  node.append(info);
  const scope=document.createElement('p');scope.className='hint';scope.textContent={rooms:'Nur Raum-/Bodenreinigung',windows:'Nur Fenster-/Glasreinigung (ohne Büroputzen)',combined:'Raum-/Bodenreinigung UND Fenster',other:'Sonstige Leistung nach Stunden'}[out.scope]+' · '+(out.windowItems.length?out.windowItems.length+' Fensterpositionen':'keine Fensterpositionen');node.append(scope);
  const info2=document.createElement('p');info2.className='hint';
  info2.textContent='Geschätzte interne Kosten '+de(out.cleaningCost)+' · Fenster-Verkaufspreis '+de(out.windowsNet)+' · Hebebühnen-Aufwand '+de(out.liftRental)+' · Kalkulierter Überschuss ca. '+de(out.profit);
  node.append(info2);
  const info3=document.createElement('p');info3.className='hint';
  info3.textContent='Preisvorschlag '+de(out.recommendNet)+' netto'+(num('ManualNet')>0?' · Dein abweichender Festpreis wurde übernommen.':'');
  node.append(info3);
 }
 function calculate(){
  try{
   const out=MiCareQuote.compute(readInput());
   byId('qCalculationMessage').textContent='';
   byId('qWindowArea').textContent='Fensterfläche gesamt: '+out.windowSqm.toLocaleString('de-DE')+' m² · '+out.windowItems.length+' Position(en) · '+de(out.windowsNet)+' netto';
   renderSummary(out);if(out.estimatedLaborWarning)byId('qCalculationMessage').textContent='⚠ '+out.estimatedLaborWarning;return out;
  }catch(e){
   byId('qCalculationMessage').textContent='Bitte Eingaben prüfen: '+e.message;
   byId('qSummary').textContent='Keine gültige Kalkulation vorhanden.';
   return null;
  }
 }
 function nextNumber(kind){
  const prefix=kind==='quote'?'KV':'RG-ENTWURF',year=new Date().getFullYear();
  const existing=new Set((state.quotes||[]).filter(d=>d.kind===kind).map(d=>d.number));
  let i=1,number='';do{number=prefix+'-'+year+'-'+String(i++).padStart(4,'0')}while(existing.has(number));
  return number;
 }

 function planFields(){
  return {...Object.fromEntries(['PlanDate','PlanEmployee','PlanStart','PlanEnd','PlanRhythm','PlanMode','PlanEndDate','PlanEveryWeeks','PlanReminderDays'].map(k=>[k,value(k)])),
    PlanWeekdays:[...document.querySelectorAll('#qPlanWeekdays input:checked')].map(x=>Number(x.value))};
 }
 function proposedDays(values,visits,startOverride,startOverrideTime,endOverrideTime){
  return MiCareSchedulePlanner.build({
   mode:values.PlanMode||'count',start:startOverride||values.PlanDate,end:values.PlanEndDate,
   weekdays:values.PlanWeekdays||[],intervalWeeks:Number(values.PlanEveryWeeks||1),
   visits:Number(visits),rhythm:Number(values.PlanRhythm||7),
   startTime:startOverrideTime||values.PlanStart||'09:00',
   endTime:endOverrideTime||values.PlanEnd||'11:00'
  });
 }
 function togglePlanMode(){
  const range=value('PlanMode')==='range';
  byId('qPlanRangePanel').classList.toggle('hidden',!range);
  byId('qPlanCountPanel').classList.toggle('hidden',range);
  byId('qVisits').readOnly=range;
  byId('qVisits').title=range?'Anzahl wird aus Vertragszeitraum und Wochentagen berechnet':'Anzahl der Einsätze';
 }
 function previewPlan(){
  togglePlanMode();
  const list=byId('qPlanPreview'),info=byId('qPlanStatus');list.replaceChildren();
  if(!value('PlanDate')){info.textContent='Bitte Startdatum auswählen.';list.textContent='Noch kein Terminplan berechnet.';return []}
  try{
   const v=planFields(),dates=proposedDays(v,Number(value('Visits')));
   if(v.PlanMode==='range'&&Number(value('Visits'))!==dates.length){
    byId('qVisits').value=String(dates.length);calculate();
   }
   info.textContent=dates.length+' unverbindliche Einsätze · '+formatDate(dates[0])+' bis '+formatDate(dates.at(-1))+
     ' · Erinnerung '+(v.PlanReminderDays==='-1'?'deaktiviert':(v.PlanReminderDays||30)+' Tage vor Ende');
   const container=document.createElement('div');container.style.maxHeight='240px';container.style.overflow='auto';
   let conflicts=0;
   dates.forEach((d,i)=>{
    const clash=v.PlanEmployee?employeeConflicts({date:d,start:v.PlanStart,end:v.PlanEnd,employee:v.PlanEmployee}):[];
    conflicts+=clash.length;
    const row=document.createElement('div');row.style.padding='7px';row.style.borderBottom='1px solid #dce6ef';
    row.textContent=(i+1)+'. '+formatDate(d)+' · '+v.PlanStart+'–'+v.PlanEnd+' · '+(v.PlanEmployee||'Mitarbeiter noch offen')+
      (clash.length?' · ⚠ '+clash.length+' Konflikt(e)':' · ✓ ohne erkannten Konflikt');
    if(clash.length)row.style.background='#fff0d5';container.append(row);
   });
   if(conflicts){const warn=document.createElement('strong');warn.textContent='⚠ '+conflicts+' Überschneidungen – Mitarbeiterplanung prüfen.';list.append(warn)}
   list.append(container);return dates;
  }catch(e){info.textContent='⚠ '+e.message;list.textContent='Planung noch nicht gültig.';return []}
 }
 function alignQuoteVisits(){
  if(value('Kind')==='quote'&&value('PlanMode')==='range')
   byId('qVisits').value=String(proposedDays(planFields(),Number(value('Visits'))).length);
 }
 function readValues(){
  const entries={};for(const k of tracked){const el=byId('q'+k);entries[k]=el.type==='checkbox'?el.checked:el.value}entries.WindowItems=windowEntries();entries.PlanWeekdays=[...document.querySelectorAll('#qPlanWeekdays input:checked')].map(x=>Number(x.value));entries.Mode=document.querySelector('input[name="qMode"]:checked')?.value||'business';return entries;
 }
 function updateNumber(){if(!activeId)byId('qNumber').value=nextNumber(value('Kind'))}
 function collect(){
  const out=calculate();if(!out)throw Error('Bitte die Kalkulation oben korrigieren');
  const cid=value('Customer'),c=state.customers.find(c=>c.id===cid);
  if(!c)throw Error('Bitte einen vorhandenen Kunden auswählen');
  const o=state.objects.find(o=>o.id===value('Object')),a=state.appointments.find(a=>a.id===value('Appointment'));
  const number=value('Number').trim();
  if(!number)throw Error('Dokumentnummer fehlt');
  if((state.quotes||[]).some(q=>q.id!==activeId&&q.kind===value('Kind')&&q.number===number))throw Error('Dokumentnummer bereits vergeben');
  const today=new Date().toISOString().slice(0,10);
  const doc={
   id:activeId||crypto.randomUUID(),kind:value('Kind'),number,createdAt:today,date:formatDate(today),
   customerId:c.id,customerNumber:c.publicNumber||'',customerName:c.name,customerAddress:[c.address,[c.zip,c.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
   objectId:o?.id||'',objectName:o?.name||'',objectAddress:o?[o.address,[o.zip,o.city].filter(Boolean).join(' ')].filter(Boolean).join(', '):'',
   appointmentId:a?.id||'',orderNumber:a?'AK '+(a.akNumber||'–')+' / '+orderCode(a):'',sourceQuoteId:a?.quoteId||'',sourceQuoteNumber:a?.quoteNumber||'',sourceVisitNumber:a?.quoteVisit||0,sourceVisitCount:a?.quoteVisitCount||0,
   service:value('Service').trim()||'Reinigungsleistung',serviceDate:value('ServiceDate').trim(),
   validUntil:value('Kind')==='quote'?value('ValidUntil'):'',dueDate:value('Kind')==='invoice'?value('ValidUntil'):'',
   sellerName:value('SellerName').trim(),sellerAddress:value('SellerAddress').trim(),sellerTaxId:value('SellerTax').trim(),sellerEmail:value('SellerEmail').trim(),sellerPhone:value('SellerPhone').trim(),recipientEmail:value('RecipientEmail').trim(),iban:value('Iban').trim(),
   notes:value('Notes').trim(),taxMode:value('TaxMode'),vat:out.vat,net:out.net,tax:out.tax,gross:out.gross,rows:out.rows,calculation:out,formValues:readValues()
  };
  return MiCareQuote.createDocument(doc);
 }
 function saveSettings(){
  const keep=['SellerName','SellerAddress','SellerTax','SellerEmail','SellerPhone','Iban','TaxMode'];
  state.quoteSettings=Object.fromEntries(keep.map(k=>[k,value(k)]));
 }
 async function persist(){
  alignQuoteVisits();
  if((state.quotes||[]).some(x=>x.id===activeId&&(x.finalizedAt||x.acceptedAt)))throw Error('Endgültige Rechnung oder angenommenes Angebot darf nicht verändert werden');
  const doc=collect();state.quotes??=[];saveSettings();
  const i=state.quotes.findIndex(x=>x.id===doc.id);
  if(i>=0)state.quotes[i]=doc;else state.quotes.push(doc);
  activeId=doc.id;await saveState();showSaved();
  notify('Kalkulation '+doc.number+' gespeichert');
  return doc;
 }
 async function makePdf(){
  const button=byId('qPdf');if(button.disabled)return;button.disabled=true;
  try{
   const doc=await persist();
   if(doc.kind==='invoice'&&(!doc.sellerName||!doc.sellerAddress||!doc.sellerTaxId||!doc.customerAddress||!doc.serviceDate))
    alert('Wichtige Rechnungs-Pflichtangaben fehlen. Die PDF bleibt ausdrücklich als Rechnungsentwurf gekennzeichnet. Bitte ergänze Firmenanschrift, Steuernummer, Kundenanschrift und Leistungsdatum.');
   const pdf=await MiCareQuote.pdf(doc);
   await saveExport('M-iCare_'+(doc.kind==='quote'?'Kostenvoranschlag':'Rechnungsentwurf')+'_'+doc.number.replace(/[^a-zA-Z0-9_-]/g,'_')+'.pdf',pdf,doc.kind==='quote'?'Kostenvoranschlaege':'Rechnungsentwuerfe');
   notify('PDF-Entwurf erstellt: '+doc.number);
  }catch(e){alert('PDF konnte nicht erstellt werden: '+e.message)}
  finally{button.disabled=false}
 }
 function loadQuote(id){
  const doc=(state.quotes||[]).find(q=>q.id===id);if(!doc)return;
  if(doc.finalizedAt||doc.acceptedAt){alert('Abgeschlossene Rechnung oder angenommenes Angebot ist gesperrt. PDF über die Übersicht ausgeben.');return}
  activeId=id;if(doc.kind==='invoice'){const legacy=document.getElementById('qLegacyBilling');if(legacy)legacy.open=true}const values=doc.formValues||{};
  for(const [k,v] of Object.entries(values)){
   if(k==='WindowItems'){windowItems=Array.isArray(v)?structuredClone(v).slice(0,8):[];continue}
   if(k==='Mode'){const radio=document.querySelector('input[name="qMode"][value="'+v+'"]');if(radio)radio.checked=true;continue}
   const node=byId('q'+k);if(!node)continue;if(node.type==='checkbox')node.checked=!!v;
   else if(!['Customer','Object','Appointment'].includes(k))node.value=v;
  }
  if(!values.TaxMode)byId('qTaxMode').value=doc.taxMode||'regular';
  byId('qVat').disabled=value('TaxMode')==='small';
  if(!values.Scope){byId('qScope').value=(values.WindowItems?.length?'combined':'rooms')}
  updateScope();
  byId('qCustomer').value=doc.customerId;updateObjects();
  byId('qObject').value=doc.objectId;updateAppointments();byId('qAppointment').value=doc.appointmentId;
  if(Array.isArray(values.PlanWeekdays))document.querySelectorAll('#qPlanWeekdays input').forEach(x=>x.checked=values.PlanWeekdays.map(Number).includes(Number(x.value)));
  togglePlanMode();
  renderWindowItems();showPartInvoiceInfo();calculate();schedulePdfPreview();window.scrollTo(0,0);notify('Kalkulation '+doc.number+' geöffnet');
 }
 async function exportSavedPdf(item,button){
  if(button.disabled)return;
  button.disabled=true;
  try{
   const pdf=await MiCareQuote.pdf(item);
   const type=item.kind==='quote'?'Kostenvoranschlag':item.finalizedAt?'Rechnung':'Rechnungsentwurf';
   const name='M-iCare_'+type+'_'+item.number.replace(/[^a-zA-Z0-9_-]/g,'_')+'.pdf';
   await saveExport(name,pdf,item.kind==='quote'?'Kostenvoranschlaege':item.finalizedAt?'Rechnungen':'Rechnungsentwuerfe');
   notify(type+' '+item.number+' als PDF ausgegeben');
  }catch(e){alert('PDF konnte nicht erstellt werden: '+e.message)}
  finally{button.disabled=false}
 }

 function nextInvoiceNumber(){
  const year=new Date().getFullYear(),prefix='RG-'+year+'-';
  const numbers=new Set((state.quotes||[]).filter(x=>x.finalizedAt).map(x=>x.number));
  let n=1;while(numbers.has(prefix+String(n).padStart(4,'0')))n++;
  return prefix+String(n).padStart(4,'0');
 }
 function assertFinalInvoiceReady(doc){
  if(doc.kind!=='invoice')throw Error('Bitte zuerst Rechnungsentwurf als Dokumenttyp auswählen');
  if(!doc.appointmentId)throw Error('Endgültige Rechnung benötigt eine erledigte Arbeitskarte');
  const occurrence=isoDay(doc.serviceDate);
  if(!occurrence)throw Error('Leistungsdatum muss ein konkretes gültiges Datum sein (TT.MM.JJJJ)');
  const ak=(state.appointments||[]).find(a=>a.id===doc.appointmentId&&a.customerId===doc.customerId);
  if(!ak)throw Error('Arbeitskarte passt nicht zum Rechnungsempfänger');
  const completed=(state.entries||[]).some(e=>e.appointmentId===ak.id&&(e.appointmentOccurrence||e.date)===occurrence&&e.orderStatus==='done');
  if(!completed)throw Error('Arbeitskarte ist für das angegebene Leistungsdatum noch nicht als erledigt dokumentiert');
  if((doc.calculation?.visits||0)!==1)throw Error('Diese Version rechnet je endgültiger Rechnung genau einen erledigten Einsatz ab');
  if(ak.quoteId&&Number.isInteger(ak.plannedInvoiceNetCents)){
   const agreed=Math.round(Number(ak.plannedInvoiceNetCents)),actual=Math.round(Number(doc.net)*100);
   if(actual!==agreed)throw Error('Teilrechnung weicht vom angenommenen Angebot ab: vereinbart '+(agreed/100).toFixed(2)+' EUR, berechnet '+(actual/100).toFixed(2)+' EUR. Bitte Angebot/Nachtrag prüfen, statt still einen anderen Betrag abzurechnen.');
  }
  if((state.quotes||[]).some(x=>x.finalizedAt&&(x.appointmentId===ak.id||Array.isArray(x.coveredAppointmentIds)&&x.coveredAppointmentIds.includes(ak.id))))
   throw Error('Für diese Arbeitskarte und dieses Leistungsdatum existiert bereits eine endgültige Rechnung');
  if(!doc.sellerName||!doc.sellerAddress||!doc.sellerTaxId||!doc.customerAddress||!doc.iban||!doc.dueDate)
   throw Error('Für die endgültige Rechnung fehlen Firmenname, vollständige Adressen, Steuernummer/USt-ID, IBAN oder Zahlungsziel');
  if(!/^DE[0-9]{20}$/.test(doc.iban.replace(/\s/g,'')))
   throw Error('Bitte die vollständige deutsche IBAN mit 22 Zeichen eintragen');
  if(!validEmail(doc.recipientEmail))throw Error('Bitte eine gültige Kunden-E-Mail angeben');
  if(doc.taxMode==='small'&&(Number(doc.tax)!==0||Number(doc.vat)!==0))
   throw Error('Kleinunternehmerrechnung darf keine Umsatzsteuer ausweisen');
  return occurrence;
 }
 async function finalizeInvoice(){
  if(invoiceFinalizing)return;
  invoiceFinalizing=true;
  const button=byId('qFinalize');button.disabled=true;
  try{
   if(activeId&&(state.quotes||[]).some(x=>x.id===activeId&&x.finalizedAt))throw Error('Endgültige Rechnung ist bereits vorhanden');
   const doc=collect();
   const occurrence=assertFinalInvoiceReady(doc);
   doc.number=nextInvoiceNumber();
   doc.finalizedAt=new Date().toISOString();doc.invoiceOccurrence=occurrence;
   doc.paymentStatus='open';doc.emailStatus='not-confirmed';
   doc.formValues.Number=doc.number;
   if(!confirm('Rechnung '+doc.number+' über '+de(doc.gross)+' endgültig erstellen? Sie wird danach gegen Bearbeiten und Löschen gesperrt. Die E-Mail wird NICHT automatisch gesendet.'))return;
   // Render before persisting so a broken logo cannot finalize a PDF.
   const pdf=await MiCareQuote.pdf(doc);
   state.quotes??=[];saveSettings();
   const existing=state.quotes.findIndex(x=>x.id===doc.id);
   if(existing>=0)state.quotes[existing]=doc;else state.quotes.push(doc);
   activeId=null;
   await saveState();showSaved();updateNumber();
   await saveExport('M-iCare_Rechnung_'+doc.number+'.pdf',pdf,'Rechnungen');
   notify('Endgültige Rechnung '+doc.number+' gespeichert. E-Mail kann in der Übersicht vorbereitet werden.');
  }catch(e){alert('Rechnung konnte nicht erstellt werden: '+e.message)}
  finally{invoiceFinalizing=false;button.disabled=false}
 }
 async function pdfBase64(blob){
  return new Promise((resolve,reject)=>{
   const reader=new FileReader();reader.onerror=()=>reject(Error('PDF kann nicht gelesen werden'));
   reader.onload=()=>resolve(String(reader.result).split(',')[1]);
   reader.readAsDataURL(blob);
  });
 }
 function mailDetails(doc){
  if(!validEmail(doc.recipientEmail))throw Error('Kunden-E-Mail ist ungültig. Bitte Kundendaten überprüfen.');
  const subject='Rechnung '+doc.number+' – '+doc.sellerName;
  const body='Guten Tag,\n\nanbei erhalten Sie Ihre Rechnung '+doc.number+' über '+de(doc.gross)+' als PDF.\n\nBitte beachten Sie das Zahlungsziel.\n\nMit freundlichen Grüßen\n'+doc.sellerName;
  const name='M-iCare_Rechnung_'+doc.number.replace(/[^a-zA-Z0-9_-]/g,'_')+'.pdf';
  return {recipient:doc.recipientEmail,subject,body,name};
 }
 async function emailFinalInvoice(doc,button){
  if(!doc.finalizedAt||doc.kind!=='invoice')throw Error('E-Mail nur für endgültige Rechnungen');
  if(button.disabled)return;button.disabled=true;
  try{
   const pdf=await MiCareQuote.pdf(doc),m=mailDetails(doc),base64=await pdfBase64(pdf);
   if(window.MiCareNative?.shareInvoicePdf){
    window.MiCareNative.shareInvoicePdf(m.name,base64,m.recipient,m.subject,m.body);
    notify('E-Mail-App wird geöffnet. Bitte PDF und Empfänger prüfen, dann selbst senden.');
   }else if(window.MiCareDesktopFiles?.composeEmail){
    const res=await window.MiCareDesktopFiles.composeEmail({...m,base64});
    alert('E-Mail-Entwurf mit PDF erstellt: '+res.path+'\n'+(res.opened?'E-Mail-App wurde geöffnet.':'Bitte die EML-Datei im E-Mail-Programm öffnen.')+'\nVersand wurde NICHT bestätigt.');
   }else{
    // Local portable .eml with a real MIME PDF attachment; no SMTP credentials or silent sending.
    const b64bytes=new TextEncoder().encode(m.body);
    let binary='';for(const b of b64bytes)binary+=String.fromCharCode(b);
    const encodedBody=btoa(binary),chunks=base64.match(/.{1,76}/g)||[];
    const header=(x)=>'=?UTF-8?B?'+btoa(unescape(encodeURIComponent(x)))+'?=';
    const boundary='MiCareInvoice'+Date.now();
    const eml='To: '+m.recipient+'\r\nSubject: '+header(m.subject)+'\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="'+boundary+'"\r\n\r\n--'+boundary+'\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n'+encodedBody+'\r\n--'+boundary+'\r\nContent-Type: application/pdf; name="'+m.name+'"\r\nContent-Disposition: attachment; filename="'+m.name+'"\r\nContent-Transfer-Encoding: base64\r\n\r\n'+chunks.join('\r\n')+'\r\n--'+boundary+'--\r\n';
    download('M-iCare_Email_'+doc.number+'.eml',new Blob([eml],{type:'message/rfc822'}));
    alert('E-Mail-Entwurf mit angehängter PDF heruntergeladen. Öffne die .eml-Datei in deinem E-Mail-Programm, kontrolliere Empfänger und Anhang und klicke dort auf Senden. M-iCare kann den Versand nicht bestätigen.');
   }
  }catch(e){alert('E-Mail konnte nicht vorbereitet werden: '+e.message)}
  finally{button.disabled=false}
 }

 function elStatus(text){
  const n=document.createElement('div');n.className='docMeta';n.textContent=text;return n;
 }
 function refreshPlanEmployees(){
  const select=byId('qPlanEmployee'),previous=select.value;
  select.replaceChildren();option(select,'','– Mitarbeiter auswählen –');
  for(const name of (state.employees||[]))option(select,name,name);
  if((state.employees||[]).includes(previous))select.value=previous;
 }
 let quoteToAccept=null,acceptBusy=false;
 let acceptPlanRows=[];
 function instructionsFromQuote(doc){
  const parts=[doc.service,...(doc.rows||[]).map(r=>r.title),doc.notes||''];
  return [...new Set(parts.filter(Boolean))].join(' | ').slice(0,1400);
 }
 function buildAcceptedPlan(doc){
  const date=byId('qAcceptDate').value,emp=byId('qAcceptEmployee').value,start=byId('qAcceptStart').value,end=byId('qAcceptEnd').value;
  const values={...doc.formValues,PlanRhythm:byId('qAcceptRhythm').value};
  const days=proposedDays(values,doc.calculation?.visits,date,start,end);
  if(days.length!==Number(doc.calculation?.visits))throw Error('Anzahl der Termine weicht vom Angebot ab. Angebot vor der Annahme korrigieren.');
  if(!state.employees.includes(emp))throw Error('Bitte Mitarbeiter auswählen');
  return days.map((d,i)=>({date:d,start,end,employee:emp,sequence:i+1}));
 }
 function drawAcceptPlan(){
  const doc=(state.quotes||[]).find(q=>q.id===quoteToAccept);
  const list=byId('qAcceptPlanRows'),status=byId('qAcceptPlanStatus');list.replaceChildren();
  if(!doc)return;
  try{
   acceptPlanRows=buildAcceptedPlan(doc);
   const total=acceptPlanRows.length;
   status.textContent=total+' Arbeitskarten werden vorbereitet. Auftragsdaten kommen aus '+doc.number+'.';
   for(const [i,p] of acceptPlanRows.entries()){
    const row=document.createElement('div');row.className='qAcceptAkRow';row.dataset.index=String(i);
    row.style.cssText='padding:10px 6px;border-bottom:1px solid #d5e2ed';
    const head=document.createElement('strong');head.textContent='AK '+(i+1)+' von '+total+' · '+doc.service+' · Offen';row.append(head);
    const grid=document.createElement('div');grid.className='grid';grid.style.marginTop='8px';
    const fields=[['date','Datum','date'],['start','Beginn','time'],['end','Ende','time'],['employee','Mitarbeiter','select']];
    for(const [name,label,type] of fields){
     const wrapper=document.createElement('div');const l=document.createElement('label');l.textContent=label;wrapper.append(l);
     const input=document.createElement(type==='select'?'select':'input');
     input.dataset.field=name;
     if(type!=='select')input.type=type;else for(const e of state.employees)option(input,e,e);
     input.value=p[name];input.setAttribute('aria-label','AK '+(i+1)+' '+label);wrapper.append(input);grid.append(wrapper);
    }
    row.append(grid);list.append(row);
   }
  }catch(e){acceptPlanRows=[];status.textContent='⚠ '+e.message;list.textContent='Bitte Planung korrigieren, dann erneut berechnen.'}
 }
 function editedPlanRows(doc){
  const rows=[...byId('qAcceptPlanRows').querySelectorAll('.qAcceptAkRow')];
  if(!rows.length||rows.length!==Number(doc.calculation?.visits))
   throw Error('Bitte erst die Arbeitskartenplanung vollständig berechnen.');
  const unique=new Set();
  const out=rows.map((row,i)=>{
   const read=field=>row.querySelector('[data-field="'+field+'"]').value;
   const date=read('date'),start=read('start'),end=read('end'),employee=read('employee');
   MiCareSchedulePlanner.parse(date);
   if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||start>=end)throw Error('AK '+(i+1)+': Uhrzeiten ungültig');
   if(!state.employees.includes(employee))throw Error('AK '+(i+1)+': Mitarbeiter ungültig');
   const key=date+'|'+start+'|'+end+'|'+employee;
   if(unique.has(key))throw Error('AK '+(i+1)+': gleicher Mitarbeiter, Datum und Uhrzeit bereits vorhanden');
   unique.add(key);
   return {date,start,end,employee};
  });
  return out;
 }

 function openAcceptDialog(doc){
  if(doc.kind!=='quote'||doc.acceptedAt)return;
  quoteToAccept=doc.id;
  const visits=Number(doc.calculation?.visits);
  if(!Number.isInteger(visits)||visits<1||visits>104)return alert('Anzahl Einsätze prüfen.');
  byId('qAcceptInfo').textContent=doc.number+' · '+visits+' Einsätze · '+de(doc.gross)+' Gesamtpreis. Erst nach Bestätigung werden die Termine verbindlich.';
  byId('qAcceptDate').value=doc.formValues?.PlanDate||new Date().toISOString().slice(0,10);
  const employees=byId('qAcceptEmployee');employees.replaceChildren();
  for(const emp of state.employees||[])option(employees,emp,emp);
  employees.value=(state.employees||[]).includes(doc.formValues?.PlanEmployee)?doc.formValues.PlanEmployee:(state.employees||[])[0]||'';
  byId('qAcceptStart').value=doc.formValues?.PlanStart||'09:00';
  byId('qAcceptEnd').value=doc.formValues?.PlanEnd||'11:00';
  byId('qAcceptRhythm').value=doc.formValues?.PlanRhythm||'7';
  const range=doc.formValues?.PlanMode==='range';
  byId('qAcceptRhythm').parentElement.hidden=range;
  byId('qAcceptScheduleSummary').textContent=range?
   'Wochentage '+(doc.formValues?.PlanWeekdays||[]).map(n=>['So','Mo','Di','Mi','Do','Fr','Sa'][n]).join(', ')+', bis '+formatDate(doc.formValues.PlanEndDate)+
   '. Die Anzahl muss mit dem angenommenen Angebot übereinstimmen.':
   visits+' geplante Einsätze im ausgewählten Abstand.';
  byId('qAcceptWorkInstructions').value=instructionsFromQuote(doc);
  byId('qAcceptDialog').showModal();
  drawAcceptPlan();
 }
 function scheduleForQuote(doc){
  if(!state.customers.some(c=>c.id===doc.customerId))throw Error('Kunde nicht gefunden');
  if(doc.objectId&&!state.objects.some(o=>o.id===doc.objectId&&o.customerId===doc.customerId))throw Error('Geschäftsstelle nicht gefunden');
  const slots=editedPlanRows(doc),visits=slots.length;
  const netCents=Math.round(doc.net*100),taxCents=Math.round(doc.tax*100);
  const base=Math.floor(netCents/visits),baseTax=Math.floor(taxCents/visits);
  const instructions=byId('qAcceptWorkInstructions').value.trim().slice(0,1500);
  const proposed=slots.map((slot,i)=>({
   id:crypto.randomUUID(),customTitle:doc.service+' – '+(i+1)+'/'+visits+' · '+doc.number,
   quoteId:doc.id,quoteNumber:doc.number,quoteVisit:i+1,quoteVisitCount:visits,
   plannedInvoiceNetCents:base+(i<netCents%visits?1:0),plannedInvoiceTaxCents:baseTax+(i<taxCents%visits?1:0),
   customerId:doc.customerId,objectId:doc.objectId||null,employee:slot.employee,workInstructions:instructions,
   service:/fenster|glas|wintergarten/i.test(doc.service)?'Glas- & Fensterreinigung':
     (typeof SERVICES!=='undefined'&&SERVICES.includes(doc.service))?doc.service:'Sonderreinigungen',
   date:slot.date,start:slot.start,end:slot.end,repeat:'once',interval:1,until:'',exceptions:{},status:'open'
  }));
  if((state.appointments||[]).some(a=>a.quoteId===doc.id))throw Error('Für dieses Angebot existieren bereits Arbeitskarten');
  const external=proposed.flatMap(x=>employeeConflicts(x)).filter(Boolean);
  const internal=[];
  for(let i=0;i<proposed.length;i++)for(let j=i+1;j<proposed.length;j++){
   const a=proposed[i],b=proposed[j];
   if(a.employee===b.employee&&a.date===b.date&&a.start<b.end&&b.start<a.end)internal.push(i+1+' / '+(j+1));
  }
  if((external.length||internal.length)&&!confirm('⚠ '+external.length+' Kollision(en) mit bestehenden Terminen und '+internal.length+' Überschneidung(en) innerhalb dieses Angebots. Trotzdem planen?'))return null;
  return proposed;
 }
 async function confirmAcceptedQuote(){
  if(acceptBusy)return;acceptBusy=true;const btn=byId('qAcceptConfirm');btn.disabled=true;
  try{
   const doc=(state.quotes||[]).find(x=>x.id===quoteToAccept&&x.kind==='quote');
   if(!doc||doc.acceptedAt)throw Error('Angebot wurde bereits angenommen oder nicht gefunden');
   const proposed=scheduleForQuote(doc);if(!proposed)return;
   if(!confirm('Kundenannahme bestätigen und '+proposed.length+' offene Arbeitskarte(n) für '+doc.number+' verbindlich einplanen?'))return;
   state.appointments.push(...proposed);
   doc.acceptedAt=new Date().toISOString();
   doc.appointmentIds=proposed.map(x=>x.id);
   doc.contractEnd=doc.formValues?.PlanMode==='range'?doc.formValues.PlanEndDate:proposed.at(-1).date;
   doc.reminderDays=Number(doc.formValues?.PlanReminderDays??30);
   doc.reminderDoneAt='';
   await saveState();
   window.MiCareContractReminders?.refresh();
   byId('qAcceptDialog').close();quoteToAccept=null;
   if(activeId===doc.id)activeId=null;
   showSaved();
   calendarMonth=proposed[0].date.slice(0,7);chosenDay=proposed[0].date;
   document.getElementById('appointmentCalendarPanel').open=true;
   showScreen('appointmentsPanel');
   renderAppointments();
   notify(proposed.length+' offene AK für '+doc.number+' angelegt. Sie stehen unter „Angenommene Aufträge“.');
  }catch(e){alert('Angebot kann nicht angenommen werden: '+e.message)}
  finally{acceptBusy=false;btn.disabled=false}
 }
 function showPartInvoiceInfo(){
  const panel=byId('qPartInvoiceInfo');
  if(!panel)return;
  const a=(state.appointments||[]).find(a=>a.id===value('Appointment'));
  const part=value('Kind')==='invoice'&&a&&Number(a.quoteVisitCount)>1;
  panel.classList.toggle('hidden',!part);
  if(part){
   const eur=(Number(a.plannedInvoiceNetCents||0)/100).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
   panel.textContent='🧾 Teilrechnung '+a.quoteVisit+' von '+a.quoteVisitCount+' · '+eur+' netto für diese erledigte Arbeitskarte · Bezug: '+(a.quoteNumber||'angenommenes Angebot')+'. Der gesamte Auftrag wird nicht erneut berechnet.';
  }else panel.textContent='';
 }
 function openForAppointment(appointmentId,occurrenceDate){
  const a=(state.appointments||[]).find(x=>x.id===appointmentId);if(!a)return alert('Arbeitskarte nicht gefunden');
  const occ=occurrenceDate||a.date;
  const entry=(state.entries||[]).find(e=>e.appointmentId===a.id&&e.appointmentOccurrence===occ&&e.orderStatus==='done');
  if(!entry)return alert('Erst muss der Mitarbeiter die Arbeit tatsächlich erledigen und als „Erledigt“ speichern.');
  if((state.quotes||[]).some(q=>q.finalizedAt&&(q.appointmentId===a.id||Array.isArray(q.coveredAppointmentIds)&&q.coveredAppointmentIds.includes(a.id))))return alert('Diese Arbeitskarte wurde bereits endgültig abgerechnet.');
  const quote=(state.quotes||[]).find(q=>q.id===a.quoteId&&q.acceptedAt);
  clear();refreshCustomers();
  if(quote){
   for(const [k,v] of Object.entries(quote.formValues||{})){
    if(k==='WindowItems'){windowItems=Array.isArray(v)?structuredClone(v):[];continue}
    if(k==='Mode'){const r=document.querySelector('input[name="qMode"][value="'+v+'"]');if(r)r.checked=true;continue}
    if(['Customer','Object','Appointment','Number','Kind','Visits','ManualNet','ServiceDate','ValidUntil'].includes(k))continue;
    const node=byId('q'+k);if(node){if(node.type==='checkbox')node.checked=!!v;else node.value=v}
   }
   updateScope();renderWindowItems();
  }
  byId('qCustomer').value=a.customerId;
  updateObjects();byId('qObject').value=a.objectId||'';updateAppointments();
  byId('qAppointment').value=a.id;
  byId('qScope').value=quote?.calculation?.scope||(/glas|fenster/i.test(a.service)?'windows':'rooms');updateScope();
  byId('qService').value=quote?.service||a.service;
  byId('qVisits').value='1';
  byId('qManualNet').value=(a.plannedInvoiceNetCents!==undefined?(a.plannedInvoiceNetCents/100).toFixed(2):'0');
  byId('qServiceDate').value=formatDate(occ);
  byId('qValidUntil').value=new Date(Date.now()+14*864e5).toISOString().slice(0,10);
  byId('qKind').value='invoice';updateNumber();
  byId('qRecipientEmail').value=quote?.recipientEmail||(state.customers||[]).find(c=>c.id===a.customerId)?.email||'';
  showPartInvoiceInfo();calculate();notify((Number(a.quoteVisitCount)>1?'Teilrechnung '+a.quoteVisit+' von '+a.quoteVisitCount:'Rechnung')+' für '+(a.akNumber?'AK '+a.akNumber:'Arbeitskarte')+' vorbereitet – Betrag und Angaben prüfen.');
  window.scrollTo(0,0);
 }
 function showSaved(){
  const area=byId('qSavedList');area.replaceChildren();
  const items=[...(state.quotes||[])].filter(q=>q&&['quote','invoice'].includes(q.kind));
  const search=value('SavedSearch').trim().toLocaleLowerCase('de-DE');
  const kind=value('SavedType')||'all';
  const filtered=items.filter(item=>{
   if(kind!=='all'&&item.kind!==kind)return false;
   if(!search)return true;
   return [item.number,item.customerName,item.customerNumber,item.objectName,item.service,item.orderNumber,item.date,item.serviceDate].some(v=>String(v||'').toLocaleLowerCase('de-DE').includes(search));
  }).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))||String(b.number||'').localeCompare(String(a.number||'')));
  const quotes=items.filter(x=>x.kind==='quote').length,invoices=items.filter(x=>x.kind==='invoice').length,finals=items.filter(x=>x.kind==='invoice'&&x.finalizedAt).length;
  byId('qSavedTotals').textContent=items.length+' Dokument(e): '+quotes+' Kostenvoranschläge und '+invoices+' Rechnungen ('+finals+' endgültig, '+(invoices-finals)+' Entwürfe) · '+filtered.length+' angezeigt.';
  if(!filtered.length){area.textContent=items.length?'Keine Dokumente für den gewählten Filter.':'Noch keine Kostenvoranschläge oder Rechnungsentwürfe gespeichert.';return}
  for(const item of filtered){
   const line=document.createElement('div');line.className='quoteSavedItem';
   const description=document.createElement('div');description.className='docLine';
   const title=document.createElement('strong');
   title.textContent=(item.kind==='quote'?'Kostenvoranschlag':item.finalizedAt?'Rechnung':'Rechnungsentwurf')+' · '+item.number+' · '+de(item.gross||0);
   const customer=document.createElement('div');customer.textContent=(item.customerNumber?'Kunde '+item.customerNumber+' · ':'')+(item.customerName||'Unbekannter Kunde');
   const meta=document.createElement('div');meta.className='docMeta';meta.textContent='Datum: '+(item.date||'–')+' · '+(item.orderNumber||'ohne AK')+' · '+(item.service||'–')+(item.finalizedAt?' · ZAHLUNG OFFEN · E-Mail-Versand nicht bestätigt':'');
   description.append(title,customer,meta);
   const actions=document.createElement('div');actions.className='row docActions';
   const open=document.createElement('button');open.type='button';open.className='secondary';open.textContent='✏️ Bearbeiten';open.onclick=()=>loadQuote(item.id);
   const pdf=document.createElement('button');pdf.type='button';pdf.className='secondary';pdf.textContent='📄 PDF';pdf.onclick=()=>exportSavedPdf(item,pdf);
   const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='🗑 Löschen';
   del.onclick=async()=>{
    if(!confirm('Entwurf '+item.number+' unwiderruflich aus der Liste löschen? Bereits exportierte PDF-Dateien im PC-Ordner bleiben bestehen.'))return;
    state.quotes=state.quotes.filter(q=>q.id!==item.id);
    if(activeId===item.id)activeId=null;
    await saveState();showSaved();
   };
   if(!item.finalizedAt&&!item.acceptedAt)actions.append(open);
   actions.append(pdf);
   if(item.kind==='quote'&&!item.acceptedAt){
    const accept=document.createElement('button');accept.type='button';accept.className='secondary';accept.textContent='✅ Kunde hat angenommen · AK planen';accept.onclick=()=>openAcceptDialog(item);actions.append(accept);
   }
   if(item.acceptedAt){
    const ordersBtn=document.createElement('button');ordersBtn.type='button';ordersBtn.className='secondary';ordersBtn.textContent='📋 Angenommenen Auftrag öffnen';
    ordersBtn.onclick=()=>{showScreen('appointmentsPanel');byId('acceptedOrdersSearch').value=item.number;renderAcceptedOrders();byId('acceptedOrdersPanel').scrollIntoView({behavior:'smooth',block:'start'})};
    actions.append(ordersBtn);
    const ids=item.appointmentIds||[],done=ids.filter(id=>(state.entries||[]).some(e=>e.appointmentId===id&&e.orderStatus==='done')).length;
    const invoiced=ids.filter(id=>(state.quotes||[]).some(q=>q.finalizedAt&&(q.appointmentId===id||Array.isArray(q.coveredAppointmentIds)&&q.coveredAppointmentIds.includes(id)))).length;
    description.append(elStatus('✅ Angenommen · '+done+'/'+ids.length+' AK erledigt · '+invoiced+' Rechnung(en) erstellt'));
    if(ids.length){
     const plan=state.appointments.find(a=>a.id===ids[0]);
     if(plan){
      const calendar=document.createElement('button');calendar.type='button';calendar.className='secondary';calendar.textContent='📅 Arbeitskarten im Kalender';
      calendar.onclick=()=>{
       calendarMonth=plan.date.slice(0,7);chosenDay=plan.date;
       document.getElementById('appointmentCalendarPanel').open=true;showScreen('appointmentsPanel');renderAppointments();
      };
      actions.append(calendar);
     }
    }
   }
   if(item.finalizedAt){
    const email=document.createElement('button');email.type='button';email.className='secondary';email.textContent='✉️ E-Mail mit PDF';email.onclick=()=>emailFinalInvoice(item,email);
    actions.append(email);
   }else if(!item.acceptedAt)actions.append(del);
   line.append(description,actions);area.append(line);
  }
 }
 let previewTimer=null,previewRevision=0,previewUrl='';
 function invalidatePdfPreview(message){
  previewRevision++;
  if(previewTimer!==null){clearTimeout(previewTimer);previewTimer=null}
  const img=byId('qPreviewImg');if(img){img.hidden=true;img.removeAttribute('src')}
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=''}
  const status=byId('qPreviewStatus');if(status)status.textContent=message||'Eingaben geändert – Vorschau wird aktualisiert.';
 }
 async function renderPdfPreview(){
  if(!byId('qPdfPreviewPanel').open)return;
  const id=++previewRevision;
  const status=byId('qPreviewStatus'),img=byId('qPreviewImg');
  if(!value('Customer')){invalidatePdfPreview('Bitte zuerst einen Kunden auswählen. Danach siehst du das PDF direkt hier in der App.');return}
  status.textContent='PDF-Layout wird aktualisiert …';
  try{
   const doc=collect();
   const picture=await MiCareQuote.previewImage(doc);
   if(id!==previewRevision)return;
   const url=URL.createObjectURL(picture);
   const old=previewUrl;previewUrl=url;
   img.onload=()=>{if(old)URL.revokeObjectURL(old)};
   img.onerror=()=>{if(id===previewRevision)invalidatePdfPreview('Die Vorschau konnte nicht angezeigt werden. Bitte PDF-Daten prüfen.')};
   img.src=url;img.hidden=false;
   status.textContent='Original-PDF-Ansicht · Seite 1 · '+doc.number+' · '+de(doc.gross)+' · '+(doc.kind==='quote'?'Kostenvoranschlag':'Rechnungsentwurf')+'.';
  }catch(e){if(id===previewRevision)invalidatePdfPreview('Vorschau noch nicht verfügbar: '+e.message)}
 }
 function schedulePdfPreview(){
  invalidatePdfPreview('Eingaben geändert – Vorschau wird nach der Eingabe aktualisiert.');
  if(!byId('qPdfPreviewPanel').open||!value('Customer'))return;
  previewTimer=setTimeout(()=>{previewTimer=null;renderPdfPreview()},650);
 }
 function clear(){
  activeId=null;windowItems=[];renderWindowItems();
  const radio=document.querySelector('input[name="qMode"][value="business"]');if(radio)radio.checked=true;
  for(const k of ['Customer','Object','Appointment','RecipientEmail','PlanDate'])byId('q'+k).value='';
  byId('qScope').value='rooms';
  byId('qService').value='Unterhaltsreinigung';updateScope();
  byId('qKind').value='quote';showPartInvoiceInfo();byId('qManualNet').value='0';byId('qTaxMode').value=state.quoteSettings?.TaxMode||'small';
  byId('qNotes').value='';byId('qServiceDate').value='';byId('qPlanDate').value='';byId('qPlanStart').value='09:00';byId('qPlanEnd').value='11:00';byId('qPlanRhythm').value='7';byId('qPlanMode').value='count';byId('qPlanEndDate').value='';byId('qPlanEveryWeeks').value='1';byId('qPlanReminderDays').value='30';document.querySelectorAll('#qPlanWeekdays input').forEach(x=>x.checked=false);togglePlanMode();
  byId('qValidUntil').value=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  for(const k of ['Wc','Kitchen','Heavy'])byId('q'+k).checked=false;
  byId('qVat').disabled=value('TaxMode')==='small';updateObjects();updateNumber();calculate();schedulePdfPreview();window.scrollTo(0,0);
 }
 function refresh(){
  const settings=state.quoteSettings||{};
  for(const [k,v] of Object.entries(settings)){const node=byId('q'+k);if(node&&(k==='TaxMode'||!node.value))node.value=String(v).slice(0,node.maxLength>0?node.maxLength:300)}
  // Öffentliche Kontaktdaten nur in wirklich leere Felder eintragen. Nie vorhandene Angaben überschreiben.
  for(const [k,v] of Object.entries(companyPublic)){const field=byId('q'+k);if(!field.value.trim())field.value=v}
  refreshPlanEmployees();togglePlanMode();byId('qVat').disabled=value('TaxMode')==='small';refreshCustomers();showSaved();if(!value('Number'))updateNumber();calculate();schedulePdfPreview();
 }
 function init(){
  for(const k of tracked){
   const el=byId('q'+k);if(!el)throw Error('Kalkulationsfeld fehlt: '+k);
   el.addEventListener('input',()=>calculate());
   el.addEventListener('change',()=>calculate());
  }
  byId('qScope').addEventListener('change',updateScope);
  byId('qCustomer').addEventListener('change',()=>{byId('qObject').value='';byId('qRecipientEmail').value=(state.customers||[]).find(x=>x.id===value('Customer'))?.email||'';updateObjects();calculate()});
  byId('qObject').addEventListener('change',()=>{updateAppointments();calculate()});
  byId('qAppointment').addEventListener('change',selectAppointment);
  byId('qAppointment').addEventListener('change',showPartInvoiceInfo);
  byId('qKind').addEventListener('change',updateNumber);
  byId('qKind').addEventListener('change',showPartInvoiceInfo);
  byId('qTaxMode').addEventListener('change',()=>{byId('qVat').disabled=value('TaxMode')==='small';calculate()});
  byId('qVat').disabled=value('TaxMode')==='small';
  byId('qWindowPicker').addEventListener('click',e=>{
   const btn=e.target.closest('button[data-window]');if(btn)addWindow(btn.dataset.window)
  });
  byId('qProfits').addEventListener('click',e=>{
   const btn=e.target.closest('button[data-profit]');if(!btn)return;
   byId('qFixedProfit').value=btn.dataset.profit;calculate();
  });
  for(const mode of document.querySelectorAll('input[name="qMode"]'))mode.addEventListener('change',calculate);
  renderWindowItems();
  byId('qAreas').addEventListener('click',e=>{const target=e.target.closest('button[data-area]');if(!target)return;byId('qArea').value=target.dataset.area;calculate()});
  byId('qSave').onclick=()=>persist().catch(e=>alert('Kalkulation nicht gespeichert: '+e.message));
  byId('qPdf').onclick=makePdf;
  byId('qFinalize').onclick=finalizeInvoice;
  byId('qAcceptConfirm').onclick=confirmAcceptedQuote;
  byId('qAcceptGenerate').onclick=drawAcceptPlan;
  for(const id of ['qAcceptDate','qAcceptEmployee','qAcceptStart','qAcceptEnd','qAcceptRhythm'])byId(id).addEventListener('change',drawAcceptPlan);
  byId('qAcceptCancel').onclick=()=>{byId('qAcceptDialog').close();quoteToAccept=null};
  byId('qAcceptDialog').addEventListener('cancel',()=>{quoteToAccept=null});
  byId('qNew').onclick=clear;
  byId('qJumpPreview').onclick=()=>{
   const panel=byId('qPdfPreviewPanel');panel.open=true;panel.scrollIntoView({behavior:'smooth',block:'start'});renderPdfPreview();
  };
  byId('qPreviewNow').onclick=renderPdfPreview;
  byId('qPdfPreviewPanel').addEventListener('toggle',()=>{
   if(byId('qPdfPreviewPanel').open)renderPdfPreview();
   else invalidatePdfPreview('Vorschau geschlossen. Öffne den Bereich, um das PDF-Layout zu sehen.');
  });
  byId('quoteCalculator').addEventListener('input',event=>{
   if(event.target.closest('#qPdfPreviewPanel')||event.target.closest('#qDocumentOverview'))return;
   schedulePdfPreview();
  });
  byId('quoteCalculator').addEventListener('change',event=>{
   if(event.target.closest('#qPdfPreviewPanel')||event.target.closest('#qDocumentOverview'))return;
   schedulePdfPreview();
  });
  byId('qPlanPreviewButton').onclick=previewPlan;
  for(const key of ['PlanDate','PlanEmployee','PlanStart','PlanEnd','PlanEndDate','PlanEveryWeeks','PlanReminderDays','PlanRhythm'])byId('q'+key).addEventListener('change',previewPlan);
  byId('qPlanMode').addEventListener('change',previewPlan);
  document.querySelectorAll('#qPlanWeekdays input').forEach(el=>el.addEventListener('change',previewPlan));
  byId('qPlanOpenCalendar').onclick=()=>{const day=value('PlanDate');if(day){calendarMonth=day.slice(0,7);chosenDay=day}document.getElementById('appointmentCalendarPanel').open=true;showScreen('appointmentsPanel');renderAppointments()};
  byId('qPlanDate').addEventListener('change',()=>{if(value('Kind')==='quote'&&value('PlanDate'))byId('qServiceDate').value=formatDate(value('PlanDate'))});
  byId('qSavedSearch').addEventListener('input',showSaved);
  byId('qSavedType').addEventListener('change',showSaved);
  byId('qChooseDirectory').onclick=async()=>{
   await chooseFolder();
   byId('qFolderHint').textContent=window.MiCareDesktopFiles?'Windows-Speicherordner auswählen. Bei Erfolg werden neue PDFs und Sicherungen dorthin geschrieben.':'Wenn der Ordner freigegeben ist, legt M-iCare Sicherungen und neue PDF-Exporte darin ab.';
  };
  byId('qExportBackup').onclick=()=>exportJson().catch(e=>alert('Datensicherung fehlgeschlagen: '+e.message));
  byId('qApplyPublicCompany').onclick=()=>{
   if(!confirm('Öffentliche M-iCare-Kontaktdaten (Lippestraße 9, Hagen) in die vier Felder übernehmen? Mögliche Adressänderungen vorher prüfen. Steuernummer und IBAN bleiben unverändert.'))return;
   for(const [k,v] of Object.entries(companyPublic))byId('q'+k).value=v;
   calculate();notify('Öffentliche M-iCare-Kontaktdaten eingesetzt. Vor PDF-Versand Anschrift prüfen.');
  };
  byId('qValidUntil').value=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  updateScope();
 }
 init();
 window.MiCareQuoteUI={refresh,calculate,collect,openForAppointment,loadQuote,emailFinalInvoice};
})();
