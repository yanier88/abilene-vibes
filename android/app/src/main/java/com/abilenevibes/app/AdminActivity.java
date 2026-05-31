package com.abilenevibes.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class AdminActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().post(() ->
                bridge.getWebView().evaluateJavascript("window.location.hash = 'admin';", null)
            );
        }
    }
}
