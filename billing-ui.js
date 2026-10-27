'use strict';
/* M-iCare: eigenständige Rechnungsverwaltung. Angebote und Arbeitskarten bleiben getrennt. */
(function(root){
 const cents=n=>Math.round(Number(n||0)*100);
 const euros=n=>Number(n||0).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
 const dateDE=iso=>/^\d{4}-\d\d-\d\d$/.test(iso||'')?iso.slice(8,10)+'.'+iso.slice(5,7)+'.'+iso.slice(0,4):String(iso||'');
 const paidIds=d=>Array.isArray(d.coveredAppointmentIds)&&d.coveredAppointmentIds.length?d.coveredAppointmentIds:[d.appointmentId].filter(Boolean);
 const forQuote=(data,quote)=> (data.quotes||[]).filter(d=>d.kind==='invoice'&&d.finalizedAt&&
    (d.sourceQuoteId===quote.id||paidIds(d).some(id=>(quote.appointmentIds||[]).includes(id))));
 const core={
  status(data,quote){
   if(!quote||quote.kind!=='quote'||!quote.acceptedAt)throw Error('Nur angenommene Angebote sind Aufträge');
   const invoices=forQuote(data,quote),invoiceMap=new Map();
   for(const inv of invoices)for(const id of paidIds(inv)){
    if(invoiceMap.has(id))throw Error('Doppelte Abrechnung für Arbeitskarte '+id+' entdeckt. Bitte Daten prüfen.');
    invoiceMap.set(id,inv);
   }
   const slots=(quote.appointmentIds||[]).map((id,index)=>{
    const a=(data.appointments||[]).find(x=>x.id===id&&x.quoteId===quote.id);
    const matches=(data.entries||[]).filter(e=>e.appointmentId===id&&(e.appointmentOccurrence||e.date)===a?.date);
    const last=matches.at(-1),done=last?.orderStatus==='done';
    return {id,index:index+1,ak:a||null,done,billed:invoiceMap.has(id),invoice:invoiceMap.get(id)||null,
     netCents:a&&Number.isInteger(a.plannedInvoiceNetCents)?a.plannedInvoiceNetCents:null,
     taxCents:a&&Number.isInteger(a.plannedInvoiceTaxCents)?a.plannedInvoiceTaxCents:null};
   });
   const total=slots.length,allDone=total>0&&slots.every(x=>x.done),complete=slots.filter(x=>x.done).length,
     unbilled=slots.filter(x=>x.done&&!x.billed&&x.ak),billed=slots.filter(x=>x.billed).length;
   return {slots,invoices,total,allDone,complete,billed,unbilled,
    paidNetCents:invoices.reduce((n,d)=>n+cents(d.net),0),
    dueNetCents:unbilled.reduce((n,s)=>n+(s.netCents||0),0)};
  },
  prepare(data,quote,akId,profile){
   const st=core.status(data,quote);
   if(st.slots.some(s=>!s.ak))throw Error('Auftrag enthält fehlende oder fremde Arbeitskarten');
   if(st.slots.some(s=>s.netCents===null||s.taxCents===null))throw Error('Für mindestens eine AK fehlt der vereinbarte anteilige Rechnungsbetrag');
   if(st.slots.some(s=>s.billed&&!s.done))throw Error('Bereits berechnete AK ist nicht mehr erledigt. Bitte Korrektur prüfen.');
   if(!st.unbilled.length)throw Error('Keine erledigte, noch nicht abgerechnete Arbeitskarte vorhanden');
   const end=st.allDone,selected=end?st.unbilled:[st.unbilled.find(s=>s.id===akId)];
   if(!selected[0])throw Error('Die ausgewählte Arbeitskarte ist nicht erledigt oder bereits abgerechnet');
   const totalNet=selected.reduce((n,s)=>n+s.netCents,0),totalTax=selected.reduce((n,s)=>n+s.taxCents,0);
   const allNet=cents(quote.net),allTax=cents(quote.tax);
   if(st.paidNetCents+totalNet>allNet)throw Error('Abrechnung übersteigt den vereinbarten Nettopreis');
   if(end&&st.paidNetCents+totalNet!==allNet)throw Error('Restbetrag weicht vom angenommenen Angebot ab; bitte AK-Preise prüfen');
   const first=selected[0],last=selected.at(-1),allDates=st.slots.map(s=>s.ak?.date||'').filter(Boolean).sort(),today=new Date(),iso=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
   const seller=profile||{},kind=end?'final':'partial';
   const prior=st.invoices.map(d=>String(d.number||'ohne Nummer')+' | '+String(d.date||dateDE(String(d.createdAt||'').slice(0,10)))+' | '+euros(d.gross)+' brutto ('+euros(d.net)+' netto)').join('; ');
   const priorNet=st.paidNetCents/100;
   const overview=end?'Auftragswert: '+euros(quote.gross)+' brutto. Bereits in Teilrechnungen abgerechnet: '+euros(st.invoices.reduce((sum,d)=>sum+Number(d.gross||0),0))+' brutto. Mit dieser Schlussrechnung verbleibend: '+euros((totalNet+totalTax)/100)+' brutto.':'';
   // "Abgerechnet" bedeutet hier fakturiert, nicht tatsächlich bezahlt.
   // Die Schlussrechnung erhält den vollständigen Leistungsnachweis auch für bereits abgerechnete AK.
   // Geld wird nur für die offenen AK berechnet.
   const performedWork=end?st.slots.map(slot=>{
    const entries=(data.entries||[]).filter(e=>e.appointmentId===slot.id&&(e.appointmentOccurrence||e.date)===slot.ak.date);
    const record=entries.at(-1)||{};
    const actions=[...new Set(entries.map(e=>String(e.workDone||'').trim()).filter(Boolean))];
    const description=actions.join(' · ')||String(slot.ak.workInstructions||'Leistung gemäß Arbeitskarte ausgeführt');
    return {
     appointmentId:slot.id,akNumber:String(slot.ak.akNumber||slot.index),
     date:slot.ak.date,service:String(slot.ak.service||quote.service||'Reinigungsleistung'),
     workDone:description,
     employee:String(record.employee||slot.ak.employee||''),
     net:slot.netCents/100,priorInvoice:slot.invoice?.number||''
    };
   }):[];
   const notes=end?(st.invoices.length?'Schlussabrechnung zum Angebot '+quote.number+'. Bisherige Teilrechnungen: '+prior+'. Diese Rechnung enthält ausschließlich die noch nicht berechneten Leistungen. '+overview+'':'Schlussabrechnung zum Angebot '+quote.number+' über sämtliche erledigten Leistungen.'):'Teilrechnung für AK '+(first.ak.akNumber||first.index)+' von '+st.total+'. Weitere Arbeitskarten werden erst nach Erledigung separat berechnet.';
   const fields={
    id:root.crypto?.randomUUID?.()||'bill-'+Date.now(),kind:'invoice',invoiceType:kind,
    number:'RG-ENTWURF',createdAt:iso,date:dateDE(iso),finalizedAt:'',
    customerId:quote.customerId,customerNumber:quote.customerNumber||'',customerName:quote.customerName,
    customerAddress:quote.customerAddress||'',objectId:quote.objectId||'',objectName:quote.objectName||'',
    objectAddress:quote.objectAddress||'',appointmentId:first.id,coveredAppointmentIds:selected.map(s=>s.id),
    orderNumber:selected.map(s=>'AK '+(s.ak.akNumber||s.index)).join(', '),
    sourceQuoteId:quote.id,sourceQuoteNumber:quote.number,sourceVisitNumber:first.index,sourceVisitCount:st.total,
    service:quote.service||'Reinigungsleistung',serviceDate:end&&allDates.length>1?dateDE(allDates[0])+' – '+dateDE(allDates.at(-1)):dateDE(last.ak.date),
    sellerName:String(seller.sellerName||quote.sellerName||''),sellerAddress:String(seller.sellerAddress||quote.sellerAddress||''),
    sellerTaxId:String(seller.sellerTaxId||quote.sellerTaxId||''),
    sellerEmail:String(seller.sellerEmail||quote.sellerEmail||''),sellerPhone:String(seller.sellerPhone||quote.sellerPhone||''),
    recipientEmail:String(seller.recipientEmail||quote.recipientEmail||''),iban:String(seller.iban||quote.iban||''),
    dueDate:String(seller.dueDate||''),notes,taxMode:quote.taxMode||'small',vat:quote.taxMode==='small'?0:Number(quote.vat||0),
    net:totalNet/100,tax:totalTax/100,gross:(totalNet+totalTax)/100,
    rows:[{title:end?'Restleistungen / Schlussrechnung zum Auftrag':('AK '+(first.ak.akNumber||first.index)+' – '+(quote.service||'Reinigung')),
     quantity:selected.length,unit:'Einsatz',price:totalNet/100/selected.length,total:totalNet/100}],
    calculation:{visits:1},formValues:{},
    performedWork,precedingInvoiceNumbers:st.invoices.map(d=>d.number),orderNetTotal:allNet/100,alreadyInvoicedNet:st.paidNetCents/100
   };
   return fields;
  },
  nextNumber(data,year){
   const prefix='RG-'+year+'-',existing=new Set((data.quotes||[]).filter(d=>d.kind==='invoice').map(d=>d.number));
   let n=1;while(existing.has(prefix+String(n).padStart(4,'0')))n++;
   return prefix+String(n).padStart(4,'0');
  },
  coveredIds:paidIds
 };
 if(typeof module==='object'&&module.exports){module.exports=core;return}
 root.MiCareBillingCore=core;
 const $=id=>document.getElementById(id);
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
 let pending=null,busy=false;
 const quoteOf=id=>(state.quotes||[]).find(q=>q.id===id&&q.kind==='quote'&&q.acceptedAt);
 const sellerDefaults=()=>{const s=state.quoteSettings||{};return {sellerName:s.SellerName||'',
  sellerAddress:s.SellerAddress||'',sellerTaxId:s.SellerTax||'',sellerEmail:s.SellerEmail||'',
  sellerPhone:s.SellerPhone||'',iban:s.Iban||''}};
 function fields(){
  return {sellerName:$('billSeller').value.trim(),sellerAddress:$('billAddress').value.trim(),
   sellerTaxId:$('billTax').value.trim(),iban:$('billIban').value.trim().replace(/\s/g,''),
   recipientEmail:$('billRecipient').value.trim(),dueDate:$('billDue').value,sellerEmail:$('billEmail').value.trim(),
   sellerPhone:$('billPhone').value.trim()};
 }
 function validate(doc){
  if(!doc.sellerName||!doc.sellerAddress||!doc.sellerTaxId||!doc.customerAddress||!doc.iban||!doc.dueDate)
   throw Error('Firmenname, Adressen, Steuernummer/USt-ID, IBAN und Zahlungsziel sind Pflicht');
  if(!/^DE[0-9]{20}$/.test(doc.iban))throw Error('Bitte vollständige deutsche IBAN (22 Zeichen) eintragen');
  if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(doc.recipientEmail))throw Error('Kunden-E-Mail prüfen');
  if(!/^\d{4}-\d\d-\d\d$/.test(doc.dueDate))throw Error('Zahlungsziel prüfen');
  if(doc.taxMode==='small'&&(doc.tax!==0||doc.vat!==0))throw Error('Kleinunternehmer darf keine USt berechnen');
  return MiCareQuote.createDocument(doc);
 }
 function current(){
  if(!pending)throw Error('Bitte zuerst abrechenbaren Auftrag auswählen');
  const quote=quoteOf(pending.quoteId);if(!quote)throw Error('Angenommenes Angebot nicht mehr vorhanden');
  const doc=core.prepare(state,quote,pending.akId,fields());
  if(JSON.stringify(doc.coveredAppointmentIds)!==JSON.stringify(pending.coveredIds))
   throw Error('Arbeitskartenstatus hat sich geändert. Rechnung neu öffnen.');
  return validate(doc);
 }
 function prepare(quoteId,akId){
  const quote=quoteOf(quoteId);if(!quote)return alert('Angenommenes Angebot nicht gefunden');
  try{
   const defaults=sellerDefaults(),draft=core.prepare(state,quote,akId,{...defaults,dueDate:'2099-01-01'});
   pending={quoteId,akId,coveredIds:draft.coveredAppointmentIds};
   const due=new Date();due.setDate(due.getDate()+14);
   const dueIso=[due.getFullYear(),String(due.getMonth()+1).padStart(2,'0'),String(due.getDate()).padStart(2,'0')].join('-');
   const f={...defaults,...Object.fromEntries(['sellerName','sellerAddress','sellerTaxId','sellerEmail','sellerPhone','iban','recipientEmail'].map(k=>[k,defaults[k]||quote[k]||''])),dueDate:dueIso};
   for(const [key,id] of Object.entries({sellerName:'billSeller',sellerAddress:'billAddress',sellerTaxId:'billTax',sellerEmail:'billEmail',sellerPhone:'billPhone',iban:'billIban',recipientEmail:'billRecipient',dueDate:'billDue'}))$(id).value=f[key]||'';
   $('billEditor').classList.remove('hidden');
   $('billEditorTitle').textContent=draft.invoiceType==='final'?'🧾 Schlussrechnung prüfen':'🧾 Teilrechnung '+draft.sourceVisitNumber+' von '+draft.sourceVisitCount+' prüfen';
   $('billEditorInfo').textContent=quote.customerName+' · '+quote.number+' · '+draft.orderNumber+' · NETTO '+euros(draft.net)+' · GESAMT '+euros(draft.gross)+'. Rechnung wird erst nach Bestätigung endgültig erstellt.';
   $('billEditor').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){alert('Rechnung nicht vorbereitet: '+e.message)}
 }
 function openForAppointment(id,occurrence){
  const a=(state.appointments||[]).find(a=>a.id===id);
  if(!a||!a.quoteId){showScreen('billingScreen');return alert('Eine Rechnung benötigt einen angenommenen Auftrag.');}
  showScreen('billingScreen');
  if(typeof currentScreen!=='undefined'&&currentScreen!=='billingScreen')return;
  if(occurrence&&occurrence!==a.date)return alert('Abweichenden Leistungstermin bitte erst in der AK prüfen.');
  prepare(a.quoteId,id);
 }
 function render(){
  const container=$('billOrders'),saved=$('billSaved');if(!container||!saved)return;
  const expanded=new Set([...container.querySelectorAll('details[data-order][open]')].map(x=>x.dataset.order));
  const q=String($('billSearch').value||'').trim().toLocaleLowerCase('de-DE');
  const akQuery=/^(?:ak\s*[-#:]?\s*)?(\d+)$/i.exec(q);
  const exactAk=akQuery?Number(akQuery[1]):null;
  const matchesAk=offer=>exactAk!==null&&(offer.appointmentIds||[]).some(id=>(state.appointments||[]).some(a=>a.id===id&&a.quoteId===offer.id&&Number(a.akNumber)===exactAk));
  container.replaceChildren();saved.replaceChildren();
  const orders=(state.quotes||[]).filter(x=>x.kind==='quote'&&x.acceptedAt).filter(x=>!q||matchesAk(x)||[x.customerName,x.number,x.service].some(v=>String(v||'').toLocaleLowerCase('de-DE').includes(q)));
  let ready=0,outstanding=0,done=0;
  for(const offer of orders){
   let st;try{st=core.status(state,offer)}catch(e){const warn=make('p','⚠ '+offer.number+': '+e.message);container.append(warn);continue}
   ready+=st.unbilled.length;outstanding+=st.total-st.billed;done+=st.complete;
   const akMatch=matchesAk(offer);
   const panel=make('details');panel.dataset.order=offer.id;panel.open=expanded.has(offer.id)||akMatch;
   panel.className='objectPanel';panel.style.margin='10px 0';
   const title=make('summary',offer.number+' · '+offer.customerName+' · '+euros(offer.net)+' netto · '+st.complete+'/'+st.total+' AK erledigt · '+st.billed+' abgerechnet');title.style.cursor='pointer';title.style.fontWeight='700';panel.append(title);
   const hint=make('p',st.allDone?st.unbilled.length?'Alle AK erledigt: Schlussrechnung über den offenen Restbetrag vorbereiten.':'Auftrag vollständig abgerechnet.':st.unbilled.length?'Erledigte Einsätze sind jetzt als Teilrechnung abrechenbar.':'Noch keine offene abrechenbare Leistung.');hint.className='hint';panel.append(hint);
   const list=make('div');
   for(const slot of st.slots){
    const row=make('div');row.className='appt';row.style.margin='5px 0';
    if(akMatch&&Number(slot.ak?.akNumber)===exactAk){row.style.border='2px solid #1b5c83';row.style.borderRadius='10px';row.style.padding='10px';row.style.background='#eef6fa';row.setAttribute('data-ak-search-match','true');}
    const label=make('div','AK '+(slot.ak?.akNumber||slot.index)+' · '+dateDE(slot.ak?.date)+' · '+euros((slot.netCents||0)/100)+' netto · '+(slot.billed?'🧾 Abgerechnet mit '+slot.invoice.number:slot.done?'✅ Erledigt, abrechenbar':slot.ak?'⏳ Noch offen / in Bearbeitung':'⚠ AK fehlt'));row.append(label);
    if(slot.done&&!slot.billed&&!st.allDone&&slot.ak){
     const btn=make('button','🧾 Teilrechnung '+slot.index+'/'+st.total+' vorbereiten');btn.type='button';btn.className='secondary smallbtn';btn.onclick=()=>prepare(offer.id,slot.id);row.append(btn)
    }
    list.append(row);
   }
   panel.append(list);
   if(st.allDone&&st.unbilled.length){
    const btn=make('button','✅ Schlussrechnung über '+euros(st.dueNetCents/100)+' netto vorbereiten');btn.type='button';btn.onclick=()=>prepare(offer.id,st.unbilled[0].id);panel.append(btn)
   }
   container.append(panel);
  }
  $('billTotals').textContent=orders.length+' angenommene Aufträge · '+done+' erledigte AK · '+ready+' erledigte, noch nicht abgerechnete AK · '+outstanding+' insgesamt noch nicht berechnete AK.';
  if(!orders.length)container.append(make('p','Noch keine angenommenen Aufträge vorhanden. Angebote zuerst unter „Kostenvoranschläge“ erstellen und annehmen.'));
  const docs=(state.quotes||[]).filter(x=>x.kind==='invoice').sort((a,b)=>String(b.finalizedAt||b.createdAt).localeCompare(String(a.finalizedAt||a.createdAt)));
  $('billSavedTotal').textContent=docs.length+' Rechnungsdokument(e), davon '+docs.filter(d=>d.finalizedAt).length+' endgültig erstellt.';
  for(const doc of docs){
   const row=make('div');row.className='objectItem';row.style.margin='8px 0';
   const name=make('strong',(doc.invoiceType==='final'?'Schlussrechnung':Number(doc.sourceVisitCount)>1?'Teilrechnung':'Rechnung')+' '+doc.number+' · '+doc.customerName+' · '+euros(doc.gross));row.append(name);
   row.append(make('div',(doc.finalizedAt?'Endgültig · Zahlung nicht automatisch bestätigt':'Entwurf')+' · '+(doc.sourceQuoteNumber||'ohne Angebotsbezug')));
   const btn=make('button','📄 PDF');btn.type='button';btn.className='secondary smallbtn';btn.onclick=async()=>{try{await saveExport('M-iCare_Rechnung_'+doc.number+'.pdf',await MiCareQuote.pdf(doc),'Rechnungen')}catch(e){alert('PDF fehlgeschlagen: '+e.message)}};row.append(btn);
   if(doc.finalizedAt&&root.MiCareQuoteUI?.emailFinalInvoice){
    const mail=make('button','✉️ E-Mail mit PDF vorbereiten');mail.type='button';mail.className='secondary smallbtn';mail.onclick=()=>root.MiCareQuoteUI.emailFinalInvoice(doc,mail);row.append(mail)
   }
   saved.append(row);
  }
 }
 async function preview(){
  try{const doc=current();await saveExport('M-iCare_Rechnungsentwurf_'+(doc.sourceQuoteNumber||'Auftrag')+'.pdf',await MiCareQuote.pdf(doc),'Rechnungsentwuerfe')}
  catch(e){alert('Rechnungsvorschau fehlgeschlagen: '+e.message)}
 }
 async function finalize(){
  if(busy)return;busy=true;$('billFinalize').disabled=true;
  try{
   let doc=current();
   doc.number=core.nextNumber(state,new Date().getFullYear());
   doc.finalizedAt=new Date().toISOString();doc.invoiceOccurrence=(state.appointments||[]).find(a=>a.id===doc.appointmentId)?.date||'';
   doc.paymentStatus='open';doc.emailStatus='not-confirmed';
   if(!confirm('Rechnung '+doc.number+' über '+euros(doc.gross)+' verbindlich ausstellen? Sie wird unveränderbar gespeichert. Kein automatischer E-Mail-Versand.'))return;
   const pdf=await MiCareQuote.pdf(doc);
   // Noch einmal prüfen, falls die Daten zwischen Bestätigung und PDF-Erstellung geändert wurden.
   const currentDoc=current();if(JSON.stringify(currentDoc.coveredAppointmentIds)!==JSON.stringify(doc.coveredAppointmentIds)||cents(currentDoc.net)!==cents(doc.net))throw Error('Auftrag zwischenzeitlich geändert. Vorgang abgebrochen.');
   if((state.quotes||[]).some(x=>x.number===doc.number))throw Error('Rechnungsnummer bereits vergeben');
   const previousSettings={...(state.quoteSettings||{})};
   state.quotes.push(doc);
   state.quoteSettings={...previousSettings,SellerName:doc.sellerName,SellerAddress:doc.sellerAddress,SellerTax:doc.sellerTaxId,SellerEmail:doc.sellerEmail,SellerPhone:doc.sellerPhone,Iban:doc.iban};
   try{await saveState()}catch(e){state.quotes=state.quotes.filter(x=>x.id!==doc.id);state.quoteSettings=previousSettings;throw e}
   pending=null;$('billEditor').classList.add('hidden');render();
   try{await saveExport('M-iCare_Rechnung_'+doc.number+'.pdf',pdf,'Rechnungen')}
   catch(e){alert('Rechnung '+doc.number+' wurde gespeichert, aber der PDF-Download schlug fehl: '+e.message+'. PDF später in der Rechnungsübersicht erneut ausgeben.');return}
   notify('Rechnung '+doc.number+' erstellt; E-Mail wird NICHT automatisch versendet.');
  }catch(e){alert('Rechnung konnte nicht erstellt werden: '+e.message)}
  finally{busy=false;$('billFinalize').disabled=false}
 }
 function close(){pending=null;$('billEditor').classList.add('hidden')}
 $('billSearch').addEventListener('input',render);
 $('billPreview').onclick=preview;$('billFinalize').onclick=finalize;$('billCancel').onclick=close;
 // Historische Rechnungsentwürfe bleiben lesbar, neue Rechnungen gehören nur in die eigene Maske.
 const legacy=make('details');legacy.id='qLegacyBilling';legacy.className='quoteBox';
 const heading=make('summary','⚙ Frühere Rechnungsentwürfe / erweiterte Altfunktionen');heading.style.cssText='cursor:pointer;font-weight:700';legacy.append(heading);
 legacy.append(make('p','Für neue Rechnungen bitte die separate Rechnungsmaske benutzen. Diese Altansicht dient nur der Kompatibilität mit bisherigen Entwürfen.'));
 const switchField=$('qKind');if(switchField?.parentElement)legacy.append(switchField.parentElement);
 if($('qPartInvoiceInfo'))legacy.append($('qPartInvoiceInfo'));
 if($('qFinalize'))legacy.append($('qFinalize'));
 const overview=$('qDocumentOverview');if(overview)overview.before(legacy);
 root.MiCareBilling={render,openForAppointment,prepare,core};
})(typeof globalThis!=='undefined'?globalThis:this);
