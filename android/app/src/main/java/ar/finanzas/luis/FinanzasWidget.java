package ar.finanzas.luis;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/** Widget de inicio: botón para dictar un movimiento y botón para cargarlo escribiendo. */
public class FinanzasWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_finanzas);
            v.setOnClickPendingIntent(R.id.w_voz, dictar(ctx));
            v.setOnClickPendingIntent(R.id.w_nuevo, abrir(ctx, "finanzas://nuevo", 2));
            v.setOnClickPendingIntent(R.id.w_abrir, abrir(ctx, "finanzas://abrir", 3));
            mgr.updateAppWidget(id, v);
        }
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
