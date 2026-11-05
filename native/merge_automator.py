#!/usr/bin/env python3
"""
Pulls the Task Automator app (checked out from its own GitHub repo) into the
Capacitor Android project, so its files never have to be copied into this repo.

usage: merge_automator.py <task-automater dir> <android dir> <native dir>
"""
import re
import shutil
import sys
from pathlib import Path

TA, AND, NATIVE = (Path(a) for a in sys.argv[1:4])
APP_ID_PKG = "com.musicfinder.app"          # the Capacitor app's package (owns R)

src = TA / "app/src/main"
dst = AND / "app/src/main"
java_dst = dst / "java/com/taskautomator"


def die(msg):
    print("ERROR:", msg)
    sys.exit(1)


if not (src / "java/com/taskautomator").is_dir():
    die("Task Automator sources not found in %s" % src)

# 1. Java: copy, point R at the host app, prefix layout names (host has its own activity_main.xml)
java_dst.mkdir(parents=True, exist_ok=True)
for f in (src / "java/com/taskautomator").glob("*.java"):
    text = f.read_text(encoding="utf-8")
    text = re.sub(r"^(package com\.taskautomator;)",
                  r"\1\n\nimport %s.R;" % APP_ID_PKG, text, count=1, flags=re.M)
    text = re.sub(r"R\.layout\.(\w+)", r"R.layout.ta_\1", text)
    (java_dst / f.name).write_text(text, encoding="utf-8")

# 2. Our bridge plugin
shutil.copy(NATIVE / "TaskAutomatorPlugin.java", java_dst / "TaskAutomatorPlugin.java")

# 3. Layouts (renamed with a ta_ prefix so nothing clashes)
(dst / "res/layout").mkdir(parents=True, exist_ok=True)
for f in (src / "res/layout").glob("*.xml"):
    shutil.copy(f, dst / "res/layout" / ("ta_" + f.name))

# 4. Colors + theme (strings.xml and file_paths.xml are skipped on purpose:
#    the host app already has its own, and its FileProvider covers Download/)
(dst / "res/values").mkdir(parents=True, exist_ok=True)
shutil.copy(src / "res/values/themes.xml", dst / "res/values/ta_themes.xml")

# 5. Manifest: permission + the four automator screens
manifest = dst / "AndroidManifest.xml"
m = manifest.read_text(encoding="utf-8")
if "com.taskautomator.BrowserActivity" not in m:
    if "</application>" not in m:
        die("AndroidManifest.xml has no </application>")
    activities = """
        <activity android:name="com.taskautomator.MainActivity"
            android:theme="@style/Theme.TaskAutomator" android:exported="false"/>
        <activity android:name="com.taskautomator.ProjectActivity"
            android:theme="@style/Theme.TaskAutomator" android:exported="false"/>
        <activity android:name="com.taskautomator.DownloadsActivity"
            android:theme="@style/Theme.TaskAutomator" android:exported="false"/>
        <activity android:name="com.taskautomator.BrowserActivity"
            android:theme="@style/Theme.TaskAutomator" android:exported="false"
            android:windowSoftInputMode="adjustResize"
            android:configChanges="orientation|screenSize|keyboardHidden|screenLayout|smallestScreenSize"/>
    """
    m = m.replace("</application>", activities + "</application>", 1)
    if "WRITE_EXTERNAL_STORAGE" not in m:
        m = m.replace("<application",
                      '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" '
                      'android:maxSdkVersion="28"/>\n    <application', 1)
    manifest.write_text(m, encoding="utf-8")

# 6. Gradle: libraries the automator screens need
gradle = AND / "app/build.gradle"
g = gradle.read_text(encoding="utf-8")
if "recyclerview" not in g:
    new, n = re.subn(r"^dependencies\s*\{",
                     "dependencies {\n"
                     "    implementation 'com.google.android.material:material:1.11.0'\n"
                     "    implementation 'androidx.recyclerview:recyclerview:1.3.2'",
                     g, count=1, flags=re.M)
    if n == 0:
        die("could not find the dependencies block in app/build.gradle")
    gradle.write_text(new, encoding="utf-8")

print("Task Automator merged into", AND)
