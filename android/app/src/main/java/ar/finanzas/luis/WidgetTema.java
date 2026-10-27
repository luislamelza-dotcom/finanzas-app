package ar.finanzas.luis;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Recibe de la app el color del tema elegido y redibuja el widget de inicio con ese color. */
@CapacitorPlugin(name = "WidgetTema")
public class WidgetTema extends Plugin {
    @PluginMethod
    public void set(PluginCall call) {
        String acc = call.getString("acc");
        Context ctx = getContext();
        if (acc != null) {
            ctx.getSharedPreferences(FinanzasWidget.PREFS, Context.MODE_PRIVATE).edit().putString("acc", acc).apply();
            FinanzasWidget.actualizar(ctx);
        }
        call.resolve();
    }
}
