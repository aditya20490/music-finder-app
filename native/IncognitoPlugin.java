package com.musicfinder.app;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Incognito")
public class IncognitoPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("No link given");
            return;
        }

        // First try: ask Chrome for a new incognito tab with this link
        try {
            Intent chrome = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            chrome.setPackage("com.android.chrome");
            chrome.putExtra("com.google.android.apps.chrome.EXTRA_OPEN_NEW_INCOGNITO_TAB", true);
            chrome.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chrome);
            call.resolve();
            return;
        } catch (Exception e) {
            // Chrome not found, fall through
        }

        // Second try: open the link in whatever browser the phone uses
        try {
            Intent any = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            any.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(any);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open the link");
        }
    }
}
