package com.abilenevibes.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class AdminActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        openAdminPanel();
    }

    @Override
    public void onResume() {
        super.onResume();
        openAdminPanel();
    }

    private void openAdminPanel() {
        if (bridge != null && bridge.getWebView() != null) {
            for (int delay : new int[] { 250, 900, 1600 }) {
                bridge.getWebView().postDelayed(() ->
                    bridge.getWebView().evaluateJavascript(
                        "window.location.hash = 'admin';" +
                        "window.dispatchEvent(new HashChangeEvent('hashchange'));" +
                        "window.dispatchEvent(new PopStateEvent('popstate', { state: { page: 'admin' } }));",
                        null
                    ),
                    delay
                );
            }
        }
    }
}
