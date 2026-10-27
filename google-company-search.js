/* Optional Places lookup: manual and offline customer entry never depends on Google. */
(function(){
'use strict';
let loading=false,ready=false;
const byId=id=>document.getElementById(id);
let photonPending=null;
window.micarePhotonResult=(ok,payload)=>{
 const done=photonPending;photonPending=null;
 if(!done)return;
 if(!ok){done.reject(new Error(payload||'Netzwerkfehler'));return;}
 try{done.resolve(JSON.parse(payload));}catch(err){done.reject(err);}
};
function fetchPhoton(url,query){
 if(window.MiCareNative?.searchAddress){
  return new Promise((resolve,reject)=>{
   photonPending={resolve,reject};
   window.MiCareNative.searchAddress(query);
   setTimeout(()=>{if(photonPending?.resolve===resolve){photonPending=null;reject(new Error('Suche hat zu lange gedauert'));}},15000);
  });
 }
 return fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)}).then(response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.json();});
}

const info=message=>{const n=byId('googlePlacesMessage');if(n)n.textContent=message;};
const setField=(id,value)=>{const el=byId(id);if(!el||!value)return;el.value=String(value).slice(0,el.maxLength>0?el.maxLength:1000);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
function addressParts(parts){
 const find=type=>{const c=(parts||[]).find(x=>(x.types||[]).includes(type));return c?(c.longText||c.long_name||''):'';};
 const street=find('route'),number=find('street_number'),zip=find('postal_code');
 const city=find('locality')||find('postal_town')||find('administrative_area_level_3');
 return {street,number,zip,city};
}
function existingCustomer(name){
 const options=Array.from(byId('selectedCustomer')?.options||[]);
 return options.find(x=>x.value&&x.textContent.trim().toLocaleLowerCase('de').includes(name.trim().toLocaleLowerCase('de')));
}
async function onSelection(e){
 try {
 const prediction=e.placePrediction;
 if(!prediction)return info('Kein Google-Treffer ausgewählt.');
 info('Firmendetails werden geladen …');
 const place=prediction.toPlace();
 await place.fetchFields({fields:['displayName','addressComponents','formattedAddress','nationalPhoneNumber','websiteURI']});
 const name=place.displayName||'',addr=addressParts(place.addressComponents);
 const target=byId('googlePlacesTarget').value;
 if(target==='customer'){
  const duplicate=existingCustomer(name);
  if(duplicate&&!confirm('Ähnlicher Kunde ist bereits vorhanden: '+duplicate.textContent+'. Trotzdem Daten in die Maske übernehmen?')){info('Übernahme abgebrochen. Bitte bestehenden Kunden auswählen.');return;}
  if(byId('selectedCustomer')?.value&&!confirm('Aktuell ist ein vorhandener Kunde ausgewählt. Die angezeigten Felder überschreiben (noch nicht speichern)?'))return;
  if(!byId('selectedCustomer')?.value && byId('newCustomerMode'))byId('newCustomerMode').click();
  setField('editCustomerName',name);
  setField('editCustomerAddress',addr.street);
  setField('editCustomerHouseNumber',addr.number);
  setField('editCustomerZip',addr.zip);
  setField('editCustomerCity',addr.city);
  setField('editCustomerPhone',place.nationalPhoneNumber||'');
 }else{
  if(!byId('selectedCustomer')?.value){info('Bitte zuerst einen bestehenden Kunden auswählen und dann eine Geschäftsstelle hinzufügen.');return;}
  if(!confirm('Objektfelder mit dem ausgewählten Standort überschreiben (noch nicht speichern)?'))return;
  setField('newObjectName',name);
  setField('newObjectAddress',addr.street);
  setField('newObjectHouseNumber',addr.number);
  setField('newObjectZip',addr.zip);
  setField('newObjectCity',addr.city);
 }
 info('Google-Treffer übernommen: '+name+'. Bitte Adresse, Telefon und fehlende Daten kontrollieren und anschließend manuell speichern.'+(place.websiteURI?' Webseite: '+place.websiteURI:''));
 }catch(err){info('Google-Daten konnten nicht geladen werden: '+(err?.message||'Unbekannter Fehler')+'. Manuelle Eingabe bleibt möglich.');}
}
async function mount(query){
 try{
  const {AutocompleteSuggestion}=await google.maps.importLibrary('places');
  ready=true;loading=false;
  await searchGoogle(query);
 }catch(err){loading=false;info('Google Places ist nicht verfügbar: '+(err?.message||'Fehler')+'. Du kannst weiterhin manuell eingeben.');}
}
async function searchGoogle(query){
 const host=byId('googlePlacesSearchHost');
 host.replaceChildren();
 try{
  const {AutocompleteSuggestion}=await google.maps.importLibrary('places');
  const result=await AutocompleteSuggestion.fetchAutocompleteSuggestions({input:query,includedRegionCodes:['de'],language:'de'});
  const suggestions=(result?.suggestions||[]).filter(x=>x.placePrediction).slice(0,12);
  for(const suggestion of suggestions){
   const prediction=suggestion.placePrediction;
   const row=document.createElement('button');
   row.className='secondary';row.type='button';
   row.style.cssText='display:block;width:100%;white-space:normal;text-align:left;margin:7px 0';
   row.textContent='📍 '+(prediction.text?.text||prediction.mainText?.text||query);
   row.addEventListener('click',()=>onSelection({placePrediction:prediction}));
   host.append(row);
  }
  info(suggestions.length?suggestions.length+' Google-Treffer gefunden. Tippe auf einen Eintrag, um die Firmendaten zu übernehmen.':'Keine passenden Google-Treffer gefunden. Versuche einen anderen Namen oder Ort.');
 }catch(err){info('Google-Suche fehlgeschlagen: '+(err?.message||'Unbekannter Fehler')+'. Bitte Google-Places-Konfiguration prüfen.');}
}

document.addEventListener('DOMContentLoaded',()=>{
 byId('googleCompanyQuery')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();byId('googlePlacesStart')?.click();}});
 byId('googlePlacesStart')?.addEventListener('click',async()=>{
  if(ready){const value=byId('googleCompanyQuery')?.value.trim();if(value)searchGoogle(value);return;}
  if(loading)return;
  if(!navigator.onLine){info('Offline: Suche nur in gespeicherten Kunden möglich.');}
  const query=byId('googleCompanyQuery')?.value.trim();
  if(!query){info('Bitte zuerst einen Firmennamen oder eine Adresse eingeben.');byId('googleCompanyQuery')?.focus();return;}
  const key=byId('googlePlacesKey')?.value.trim();
  if(!key){
   const host=byId('googlePlacesSearchHost');
   host.replaceChildren();
   const queryLower=query.toLocaleLowerCase('de');
   const customers=(typeof state!=='undefined'&&Array.isArray(state.customers))?state.customers:[];
   const objects=(typeof state!=='undefined'&&Array.isArray(state.objects))?state.objects:[];
   const rows=[
    ...customers.filter(c=>[c.name,c.city,c.address,c.publicNumber].some(v=>String(v||'').toLocaleLowerCase('de').includes(queryLower))).map(c=>({name:c.name,subtitle:[c.address,c.houseNumber,c.zip,c.city].filter(Boolean).join(' '),customer:c})),
    ...objects.filter(o=>[o.name,o.city,o.address,o.publicNumber].some(v=>String(v||'').toLocaleLowerCase('de').includes(queryLower))).map(o=>({name:o.name,subtitle:[o.address,o.houseNumber,o.zip,o.city].filter(Boolean).join(' '),object:o}))
   ].slice(0,30);
   for(const item of rows){
    const button=document.createElement('button');
    button.type='button';button.className='secondary';button.style.cssText='display:block;width:100%;text-align:left;margin:6px 0;white-space:normal';
    button.textContent=(item.object?'📍 ':'🏢 ')+item.name+' · '+item.subtitle;
    button.addEventListener('click',()=>{
     if(item.customer){
      const sel=byId('selectedCustomer');
      if(sel){sel.value=item.customer.id;sel.dispatchEvent(new Event('change',{bubbles:true}));}
      info('Gespeicherten Kunden ausgewählt: '+item.name+'. Bitte Daten prüfen.');
     }else{
      const obj=item.object;
      setField('newObjectName',obj.name);setField('newObjectAddress',obj.address);
      setField('newObjectHouseNumber',obj.houseNumber);setField('newObjectZip',obj.zip);setField('newObjectCity',obj.city);
      info('Gespeicherte Geschäftsstelle in die Felder übernommen: '+item.name+'. Bitte prüfen.');
     }
    });
    host.appendChild(button);
   }
   if(!navigator.onLine){info(rows.length?rows.length+' lokale Treffer gefunden.':'Offline: Keine gespeicherten Treffer.');return;}
   info('Suche kostenlose OpenStreetMap-Adressen …');
   try{
    const url='https://photon.komoot.io/api/?q='+encodeURIComponent(query)+'&limit=10&lang=de';
    const data=await fetchPhoton(url,query);
    const places=Array.isArray(data.features)?data.features:[];
    for(const feature of places){
     const p=feature.properties||{};
     if(!p.name&&!p.street)continue;
     const street=p.street||'',number=p.housenumber||'',zip=p.postcode||'',city=p.city||p.town||p.village||p.county||'';
     const label=[p.name,street+' '+number,zip+' '+city].filter(Boolean).join(' · ');
     const button=document.createElement('button');
     button.type='button';button.className='secondary';
     button.style.cssText='display:block;width:100%;text-align:left;margin:6px 0;white-space:normal';
     button.textContent='📍 '+label;
     button.addEventListener('click',()=>{
      const object=byId('googlePlacesTarget')?.value==='object';
      if(object&&!byId('selectedCustomer')?.value){info('Bitte zuerst einen Kunden auswählen, bevor du eine Geschäftsstelle übernimmst.');return;}
      const fields=object?['newObjectAddress','newObjectHouseNumber','newObjectZip','newObjectCity']:['editCustomerAddress','editCustomerHouseNumber','editCustomerZip','editCustomerCity'];
      if(!object&&!byId('selectedCustomer')?.value&&byId('newCustomerMode'))byId('newCustomerMode').click();
      [street,number,zip,city].forEach((v,i)=>setField(fields[i],v));
      // Photon liefert einen Orts-/POI-Namen, aber in der Regel keine Telefonnummer.
      // Bei reinen Straßen-/Hausnummer-Treffern nicht den Straßennamen als Firmennamen einsetzen.
      const isAddressOnly=!p.name||p.osm_key==='highway'||p.type==='street'||p.type==='house';
      const placeName=isAddressOnly?'':String(p.name).trim();
      if(placeName)setField(object?'newObjectName':'editCustomerName',placeName);
      info('Adresse'+(placeName?' und Name':'')+' aus OpenStreetMap übernommen. Telefonnummern liefert diese Adresssuche normalerweise nicht; bitte bei Bedarf manuell ergänzen und die Angaben vor dem Speichern prüfen.');
     });
     host.append(button);
    }
    info(places.length?'Treffer aus OpenStreetMap – wähle eine Adresse aus. Bitte Angaben vor dem Speichern prüfen.':'Keine OpenStreetMap-Adressen gefunden. Bitte die Adresse manuell eintragen.');
   }catch(err){info('Online-Adresssuche derzeit nicht erreichbar ('+(err?.message||'Netzwerk')+'). Bereits gespeicherte Firmen bleiben durchsuchbar.');}
   const credit=document.createElement('small');
   credit.textContent='Adressdaten: © OpenStreetMap-Mitwirkende (ODbL), Suche: Photon/komoot. Kostenloser öffentlicher Testdienst, keine Verfügbarkeitsgarantie.';
   host.append(credit);
   return;
  }
  loading=true;info('Google Places wird geladen …');
  window.micarePlacesLoaded=()=>{mount(query);};
  window.gm_authFailure=()=>{loading=false;info('Google hat den API-Schlüssel abgelehnt. Bitte API-Freigabe, Abrechnung und Einschränkungen prüfen.');};
  const script=document.createElement('script');
  script.async=true;
  script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&loading=async&libraries=places&callback=micarePlacesLoaded&v=weekly&language=de&region=DE';
  script.onerror=()=>{loading=false;info('Google Maps konnte nicht geladen werden. Manuelle Eingabe bleibt möglich.');};
  document.head.appendChild(script);
 });
 window.addEventListener('offline',()=>info('Offline: Firmen-Suche nicht verfügbar. Manuelle Eingabe ist weiterhin möglich.'));
});
})();
