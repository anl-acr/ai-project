package com.runa.mobile.ui

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import com.runa.mobile.model.AppConfigStore
import com.runa.mobile.service.RunaVoipForegroundService
import org.json.JSONObject

class RunaJsBridge(
    private val context: Context,
    private val store: AppConfigStore,
    private val onDispatchEvent: (String, JSONObject?) -> Unit
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun postMessage(rawJson: String?) {
        if (rawJson.isNullOrEmpty()) return
        try {
            val root = JSONObject(rawJson)
            val action = root.optString("action", "")
            val payload = root.optJSONObject("payload") ?: JSONObject()

            mainHandler.post {
                when (action) {
                    "openQuickTray" -> {
                        onDispatchEvent("AIDA_IOS_OPEN_QUEUE_MODAL", null)
                    }
                    "syncThemeMode" -> {
                        store.setWebDarkMode(payload.optBoolean("dark", false))
                    }
                    "sipInviteArrived" -> {
                        val caller = payload.optString("caller", "")
                        val callerName = payload.optString("callerName", "")
                        val callId = payload.optString("callId", "")
                        if (store.hasUserAnsweredCurrentCall || store.liveState.value.callStatus == "InCall") {
                            val ans = JSONObject().apply {
                                put("answer", true)
                                put("pickupExten", store.coldLaunchPickupExten)
                                put("callerNumber", caller.ifEmpty { store.liveState.value.incomingCallerNumber })
                                put("callerName", callerName.ifEmpty { store.liveState.value.incomingCallerName })
                            }
                            onDispatchEvent("AIDA_CALLKIT_ANSWER", ans)
                        } else {
                            RunaVoipForegroundService.instance?.triggerIncomingCallAlert(caller, callerName, callId)
                        }
                    }
                    "sipCancelOrByeArrived" -> {
                        RunaVoipForegroundService.instance?.stopIncomingRingtoneAndVibration()
                        store.updateLiveState {
                            it.copy(callStatus = "Idle", isCallKitUIPresented = false)
                        }
                    }
                    "disconnectServer" -> {
                        store.disconnectAndLogout()
                    }
                    "updateTrayState" -> {
                        val rawStatus = payload.optString("callStatus", "")
                        if (rawStatus == "InCall") {
                            store.coldLaunchPickupExten = ""
                            store.updateLiveState { it.copy(callStatus = "InCall") }
                        } else if (rawStatus == "Idle" && !store.hasUserAnsweredCurrentCall) {
                            store.updateLiveState { it.copy(callStatus = "Idle", isCallKitUIPresented = false) }
                        }
                    }
                }
            }
        } catch (_: Exception) {}
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun PBXWebViewScreen(
    store: AppConfigStore
) {
    val context = LocalContext.current
    val uiOrigin by store.uiOrigin.collectAsState()

    val preloadTemplate = remember {
        context.assets.open("runa_preload.js").bufferedReader().use { it.readText() }
    }
    val mobileUiOptimizerScript = remember {
        context.assets.open("runa_mobile_ui.js").bufferedReader().use { it.readText() }
    }

    var webViewRef: WebView? = remember { null }

    DisposableEffect(store) {
        store.webEventDispatcher = { eventName, detailObj ->
            val wv = webViewRef
            if (wv != null) {
                val detailJs = detailObj?.toString() ?: "null"
                val js = "try { window.dispatchEvent(new CustomEvent('$eventName', { detail: $detailJs })); } catch(e) {}"
                wv.post { wv.evaluateJavascript(js, null) }
            }
        }
        onDispose {
            store.webEventDispatcher = null
        }
    }

    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { ctx ->
            WebView(ctx).apply {
                webViewRef = this
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    databaseEnabled = true
                    mediaPlaybackRequiresUserGesture = false
                    allowFileAccess = true
                    allowContentAccess = true
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    userAgentString = "$userAgentString RunaMobileAndroid/2.9.3"
                }

                addJavascriptInterface(
                    RunaJsBridge(ctx, store) { evName, detail ->
                        val detailJs = detail?.toString() ?: "null"
                        val js = "try { window.dispatchEvent(new CustomEvent('$evName', { detail: $detailJs })); } catch(e) {}"
                        post { evaluateJavascript(js, null) }
                    },
                    "RunaAndroidBridge"
                )

                webChromeClient = object : WebChromeClient() {
                    override fun onPermissionRequest(request: PermissionRequest?) {
                        request?.grant(request.resources)
                    }
                }

                webViewClient = object : WebViewClient() {
                    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                        super.onPageStarted(view, url, favicon)
                        store.setOfflineError(false)
                        val bootJson = store.consumeBootStateJson()
                        val hydratedPreload = preloadTemplate.replace("__RUNA_BOOT_STATE_JSON__", bootJson)
                        view?.evaluateJavascript(hydratedPreload, null)
                        view?.evaluateJavascript(mobileUiOptimizerScript, null)
                    }

                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        val bootJson = store.consumeBootStateJson()
                        val hydratedPreload = preloadTemplate.replace("__RUNA_BOOT_STATE_JSON__", bootJson)
                        view?.evaluateJavascript(hydratedPreload, null)
                        view?.evaluateJavascript(mobileUiOptimizerScript, null)
                    }

                    override fun onReceivedError(
                        view: WebView?,
                        request: WebResourceRequest?,
                        error: WebResourceError?
                    ) {
                        super.onReceivedError(view, request, error)
                        if (request?.isForMainFrame == true) {
                            store.setOfflineError(true)
                        }
                    }
                }

                val cleanOrigin = uiOrigin.trimEnd('/')
                if (cleanOrigin.isNotEmpty()) {
                    loadUrl("$cleanOrigin/?desktop=1&mobile=1")
                }
            }
        }
    )
}
