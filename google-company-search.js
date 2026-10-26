/* Optional Places lookup: manual and offline customer entry never depends on Google. */
(function(){
'use strict';
let loading=false,ready=false;
const byId=id=>document.getElementById(id);
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
async function mount(){
 try{
 const {PlaceAutocompleteElement}=await google.maps.importLibrary('places');
 const el=new PlaceAutocompleteElement();
 el.setAttribute('included-region-codes','de');
 el.setAttribute('placeholder','Firmenname oder Adresse suchen');
 el.style.width='100%';
 el.addEventListener('gmp-select',onSelection);
 byId('googlePlacesSearchHost').replaceChildren(el);
 ready=true;info('Google-Firmensuche ist bereit. Suche eine Firma und wähle einen Vorschlag.');
 }catch(err){loading=false;info('Google Places ist nicht verfügbar: '+(err?.message||'Fehler')+'. Du kannst weiter manuell eingeben.');}
}
document.addEventListener('DOMContentLoaded',()=>{
 byId('googlePlacesStart')?.addEventListener('click',()=>{
  if(ready){byId('googlePlacesSearchHost')?.querySelector('gmp-place-autocomplete')?.focus();return;}
  if(loading)return;
  if(!navigator.onLine){info('Kein Internet. Bitte die Daten wie gewohnt manuell eingeben.');return;}
  const key=byId('googlePlacesKey')?.value.trim();
  if(!key){info('Bitte zunächst einen gültigen Google Maps API-Schlüssel eingeben.');return;}
  loading=true;info('Google Places wird geladen …');
  window.micarePlacesLoaded=()=>{mount();};
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
