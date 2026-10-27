package ar.finanzas.luis;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.widget.RemoteViews;

/** Widget de inicio: barra translúcida tipo buscador. Tocarla dicta un movimiento; el ícono abre la app.
 *  El borde y el micrófono toman el color del tema elegido en la app. */
public class FinanzasWidget extends AppWidgetProvider {
    static final String PREFS = "finanzas_widget";
    private static final int ACC_DEF = 0xFFC9A24A;

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        int acc = color(ctx);
        for (int id : ids) mgr.updateAppWidget(id, vista(ctx, acc));
    }

    /** Redibuja todos los widgets puestos en la pantalla de inicio (se llama cuando cambia el tema). */
    static void actualizar(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, FinanzasWidget.class));
        if (ids == null || ids.length == 0) return;
        int acc = color(ctx);
        for (int id : ids) mgr.updateAppWidget(id, vista(ctx, acc));
    }

    private static int color(Context ctx) {
        String s = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("acc", null);
        try { return s == null ? ACC_DEF : Color.parseColor(s); } catch (Exception e) { return ACC_DEF; }
    }

    private static RemoteViews vista(Context ctx, int acc) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_finanzas);
        v.setInt(R.id.w_borde, "setColorFilter", acc);
        v.setInt(R.id.w_mic, "setColorFilter", acc);
        v.setOnClickPendingIntent(R.id.w_voz, dictar(ctx));
        v.setOnClickPendingIntent(R.id.w_abrir, abrir(ctx, "finanzas://abrir", 3));
        return v;
    }

    private static PendingIntent dictar(Context ctx) {
        Intent i = new Intent(ctx, VozActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_MULTIPLE_TASK);
        return PendingIntent.getActivity(ctx, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent abrir(Context ctx, String uri, int req) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(uri), ctx, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
