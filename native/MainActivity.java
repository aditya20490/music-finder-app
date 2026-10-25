package com.musicfinder.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IncognitoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
