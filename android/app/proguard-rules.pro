# NearSend ProGuard rules
-keepclassmembers class com.nearsend.app.MainActivity$AndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}
