package com.musicfinder.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.taskautomator.TaskAutomatorPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IncognitoPlugin.class);
        registerPlugin(TaskAutomatorPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
