package ar.finanzas.luis;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import java.util.ArrayList;

/**
 * Pantalla invisible que abre el micrófono de Google encima de la pantalla de inicio.
 * Cuando terminás de hablar, abre Finanzas directo en la confirmación del movimiento.
 */
public class VozActivity extends Activity {
    private static final int REQ_VOZ = 7;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (savedInstanceState != null) return;
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-AR");
        i.putExtra(RecognizerIntent.EXTRA_PROMPT, "Decí el movimiento");
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        try {
            startActivityForResult(i, REQ_VOZ);
        } catch (ActivityNotFoundException e) {
            abrirApp("finanzas://voz");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_VOZ && resultCode == RESULT_OK && data != null) {
            ArrayList<String> r = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (r != null && !r.isEmpty() && r.get(0) != null && !r.get(0).trim().isEmpty()) {
                abrirApp("finanzas://voz?t=" + Uri.encode(r.get(0)));
                return;
            }
        }
        finish();
    }

    private void abrirApp(String uri) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(uri), this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(i);
        finish();
    }
}
