package de.micare.zeiterfassung;

import android.app.Activity;
import android.speech.RecognizerIntent;
import java.util.ArrayList;
import java.util.Locale;
import org.json.JSONObject;
import android.webkit.JavascriptInterface;
import android.content.ClipData;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends Activity {
  private WebView web;
  private ValueCallback<Uri[]> fileCallback;
  private static final int PICK_FILE=400;
  private static final int SAVE_FILE=401;
  private static final int SPEECH_REQUEST=402;
  private String pendingName;
  private String pendingJson;
  private byte[] pendingExportBytes;
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
    web=new WebView(this);
    web.getSettings().setJavaScriptEnabled(true);
    web.addJavascriptInterface(new Object(){
      @JavascriptInterface public void speech(){runOnUiThread(()->{try{
        Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"de-DE");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT,"Bitte Datum, Uhrzeit oder Text sprechen");
        startActivityForResult(intent,SPEECH_REQUEST);
      }catch(Exception e){android.widget.Toast.makeText(MainActivity.this,"Spracherkennung nicht verfügbar",android.widget.Toast.LENGTH_LONG).show();}});}
      @JavascriptInterface public void shareJson(String name,String json){runOnUiThread(()->{try{
        File dir=new File(getCacheDir(),"shared");dir.mkdirs();
        File file=new File(dir,"M-iCare-Vollsicherung.json");
        try(FileOutputStream out=new FileOutputStream(file)){out.write(json.getBytes(StandardCharsets.UTF_8));}
        Uri uri=FileProvider.getUriForFile(MainActivity.this,getPackageName()+".fileprovider",file);
        Intent share=new Intent(Intent.ACTION_SEND);share.setType("application/json");share.putExtra(Intent.EXTRA_STREAM,uri);share.setClipData(ClipData.newRawUri("M-iCare",uri));share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(Intent.createChooser(share,"M-iCare Sicherung teilen"));
      }catch(Exception e){android.widget.Toast.makeText(MainActivity.this,"Teilen fehlgeschlagen: "+e.getMessage(),android.widget.Toast.LENGTH_LONG).show();}});}
      @JavascriptInterface public void saveExport(String name,String base64){runOnUiThread(()->{try{
        if(base64.length()>30_000_000)throw new IllegalArgumentException("Datei zu groß");
        byte[] bytes=android.util.Base64.decode(base64,android.util.Base64.DEFAULT);
        if(bytes.length==0)throw new IllegalArgumentException("Leere Datei");
        String safe=name==null?"M-iCare-Export.pdf":name.replaceAll("[^a-zA-Z0-9._\\-]","_");
        if(!safe.matches("(?i).+\\.(pdf|json|xlsx)"))throw new IllegalArgumentException("Unbekannter Dateityp");
        pendingExportBytes=bytes;
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(safe.toLowerCase(Locale.ROOT).endsWith(".pdf")?"application/pdf":safe.toLowerCase(Locale.ROOT).endsWith(".xlsx")?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"application/json");
        intent.putExtra(Intent.EXTRA_TITLE,safe);
        startActivityForResult(intent,403);
      }catch(Exception e){pendingExportBytes=null;reportExport(false,"Export fehlgeschlagen: "+e.getMessage());}});}
      @JavascriptInterface public void saveJson(String name,String json){runOnUiThread(()->{
        pendingName="M-iCare-Vollsicherung.json";pendingJson=json;
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");intent.putExtra(Intent.EXTRA_TITLE,pendingName);startActivityForResult(intent,SAVE_FILE);
      });}
    },"MiCareNative");
    web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setDatabaseEnabled(true);
    web.getSettings().setAllowFileAccess(false);
    web.getSettings().setAllowContentAccess(true);
    web.setWebViewClient(new WebViewClient() {
      @Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) { return loader.shouldInterceptRequest(req.getUrl()); }
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
        Uri uri=req.getUrl();
        if("appassets.androidplatform.net".equals(uri.getHost()))return false;
        try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}
        return true;
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
        if(fileCallback!=null)fileCallback.onReceiveValue(null);
        fileCallback=callback;
        Intent intent=new Intent(Intent.ACTION_GET_CONTENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        startActivityForResult(Intent.createChooser(intent,"JSON-Sicherung auswählen"),PICK_FILE);
        return true;
      }
    });
    setContentView(web);
    web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
  }
  @Override protected void onActivityResult(int request,int result,Intent data) {
    super.onActivityResult(request,result,data);
    if(request==SPEECH_REQUEST){if(result==RESULT_OK&&data!=null){ArrayList<String> matches=data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);if(matches!=null&&!matches.isEmpty())web.evaluateJavascript("window.micareNativeSpeechResult("+JSONObject.quote(matches.get(0))+")",null);}return;}
    if(request==403){
      boolean ok=false;String msg="Speichern abgebrochen";
      if(result==RESULT_OK&&data!=null&&data.getData()!=null&&pendingExportBytes!=null){
        try(java.io.OutputStream out=getContentResolver().openOutputStream(data.getData())){
          if(out==null)throw new java.io.IOException("Kein Schreibzugriff");
          out.write(pendingExportBytes);out.flush();ok=true;msg="Datei gespeichert";
        }catch(Exception e){msg="Speichern fehlgeschlagen: "+e.getMessage();}
      }
      pendingExportBytes=null;reportExport(ok,msg);return;
    }
    if(request==SAVE_FILE){if(result==RESULT_OK&&data!=null&&data.getData()!=null&&pendingJson!=null){try(java.io.OutputStream out=getContentResolver().openOutputStream(data.getData())){out.write(pendingJson.getBytes(StandardCharsets.UTF_8));}catch(Exception e){android.widget.Toast.makeText(this,"Speichern fehlgeschlagen",android.widget.Toast.LENGTH_LONG).show();}}pendingJson=null;return;}
    if(request==PICK_FILE&&fileCallback!=null){
      fileCallback.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);
      fileCallback=null;
    }
  }
  private void reportExport(boolean success,String message){
    if(web!=null)web.evaluateJavascript("window.micareNativeExportResult("+success+","+JSONObject.quote(message)+")",null);
  }
  @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
}