'use strict';
/* Kalkulationsrechner: Verknüpfung mit bestehenden M-iCare-Kunden, Objekten und AK. */
(function(){
 const byId=id=>document.getElementById(id);
 const tracked=['Scope','Customer','Object','Appointment','Service','ObjectType','Area','Wc','Kitchen','Heavy','Visits','Hours','SqmHour','Hourly','Nonwage','Overhead','Productivity','Material','Km','KmPrice','Margin','MinNet','MinimumSqm','SetupMinutes','LiftRental','FixedProfit','ManualNet','TaxMode','Vat','Kind','Number','ServiceDate','ValidUntil','SellerName','SellerAddress','SellerTax','SellerEmail','SellerPhone','RecipientEmail','Iban','Notes'];
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
 function readValues(){
  const entries={};for(const k of tracked){const el=byId('q'+k);entries[k]=el.type==='checkbox'?el.checked:el.value}entries.WindowItems=windowEntries();entries.Mode=document.querySelector('input[name="qMode"]:checked')?.value||'business';return entries;
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
   appointmentId:a?.id||'',orderNumber:a?'AK '+(a.akNumber||'–')+' / '+orderCode(a):'',
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
  if((state.quotes||[]).some(x=>x.id===activeId&&x.finalizedAt))throw Error('Endgültige Rechnung ist gesperrt und darf nicht verändert werden');
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
  if(doc.finalizedAt){alert('Endgültige Rechnung ist gesperrt. Für PDF und E-Mail bitte die Dokumentenübersicht verwenden.');return}
  activeId=id;const values=doc.formValues||{};
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
  renderWindowItems();calculate();window.scrollTo(0,0);notify('Kalkulation '+doc.number+' geöffnet');
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
  if((state.quotes||[]).some(x=>x.finalizedAt&&x.appointmentId===ak.id&&isoDay(x.serviceDate)===occurrence))
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
   if(!item.finalizedAt)actions.append(open);
   actions.append(pdf);
   if(item.finalizedAt){
    const email=document.createElement('button');email.type='button';email.className='secondary';email.textContent='✉️ E-Mail mit PDF';email.onclick=()=>emailFinalInvoice(item,email);
    actions.append(email);
   }else actions.append(del);
   line.append(description,actions);area.append(line);
  }
 }
 function clear(){
  activeId=null;windowItems=[];renderWindowItems();
  const radio=document.querySelector('input[name="qMode"][value="business"]');if(radio)radio.checked=true;
  for(const k of ['Customer','Object','Appointment','RecipientEmail'])byId('q'+k).value='';
  byId('qScope').value='rooms';
  byId('qService').value='Unterhaltsreinigung';updateScope();
  byId('qKind').value='quote';byId('qManualNet').value='0';byId('qTaxMode').value=state.quoteSettings?.TaxMode||'small';
  byId('qNotes').value='';byId('qServiceDate').value='';
  byId('qValidUntil').value=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  for(const k of ['Wc','Kitchen','Heavy'])byId('q'+k).checked=false;
  byId('qVat').disabled=value('TaxMode')==='small';updateObjects();updateNumber();calculate();window.scrollTo(0,0);
 }
 function refresh(){
  const settings=state.quoteSettings||{};
  for(const [k,v] of Object.entries(settings)){const node=byId('q'+k);if(node&&(k==='TaxMode'||!node.value))node.value=String(v).slice(0,node.maxLength>0?node.maxLength:300)}
  // Öffentliche Kontaktdaten nur in wirklich leere Felder eintragen. Nie vorhandene Angaben überschreiben.
  for(const [k,v] of Object.entries(companyPublic)){const field=byId('q'+k);if(!field.value.trim())field.value=v}
  byId('qVat').disabled=value('TaxMode')==='small';refreshCustomers();showSaved();if(!value('Number'))updateNumber();calculate();
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
  byId('qKind').addEventListener('change',updateNumber);
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
  byId('qNew').onclick=clear;
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
 window.MiCareQuoteUI={refresh,calculate,collect};
})();
