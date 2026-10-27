package ar.finanzas.luis;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetTema.class);
        super.onCreate(savedInstanceState);
    }
}
