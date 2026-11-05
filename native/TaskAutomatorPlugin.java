package com.taskautomator;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

/**
 * Bridge between the Music Finder web UI and the Task Automator engine.
 * Lives in the com.taskautomator package so it can use the engine's package-private classes.
 */
@CapacitorPlugin(name = "TaskAutomator")
public class TaskAutomatorPlugin extends Plugin {

    // One fixed id, so every run overwrites the same saved project instead of piling up new ones.
    private static final String RUN_ID = "music-finder-run";

    /**
     * run({ template, link, selector? })
     *   template : the exported .task.json text
     *   link     : the value that replaces the typed text
     *   selector : which "type" step to change (default "#id_url")
     */
    @PluginMethod
    public void run(PluginCall call) {
        String template = call.getString("template");
        String link = call.getString("link");
        String selector = call.getString("selector", "#id_url");

        if (template == null || template.isEmpty()) { call.reject("No task template given"); return; }
        if (link == null || link.isEmpty()) { call.reject("No link given"); return; }

        try {
            Project p = ProjectFile.parse(template);

            // swap the one value that changes between runs
            JSONObject target = null;
            JSONObject firstType = null;
            for (int i = 0; i < p.steps.length(); i++) {
                JSONObject s = p.steps.optJSONObject(i);
                if (s == null || !"type".equals(s.optString("type")) || s.optBoolean("secret")) continue;
                if (firstType == null) firstType = s;
                if (selector.equals(s.optString("selector"))) { target = s; break; }
            }
            if (target == null) target = firstType;
            if (target == null) { call.reject("The task has no typing step to put the link into"); return; }
            target.put("value", link);

            p.id = RUN_ID;
            new ProjectStore(getContext()).save(p);

            Intent i = new Intent(getContext(), BrowserActivity.class);
            i.putExtra("mode", "run");
            i.putExtra("projectId", RUN_ID);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);

            JSObject ret = new JSObject();
            ret.put("steps", p.steps.length());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not start the task: " + e.getMessage());
        }
    }

    /** Opens the full Task Automator screen (projects, recorder, downloads). */
    @PluginMethod
    public void openHome(PluginCall call) {
        Intent i = new Intent(getContext(), MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Opens the automator's own Downloads list. */
    @PluginMethod
    public void openDownloads(PluginCall call) {
        Intent i = new Intent(getContext(), DownloadsActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}
