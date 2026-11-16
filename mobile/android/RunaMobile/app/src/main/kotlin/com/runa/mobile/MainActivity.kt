package com.runa.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.runa.mobile.model.AppConfigStore
import com.runa.mobile.service.LoginOutcome
import com.runa.mobile.service.PBXNetworkService
import com.runa.mobile.service.RunaVoipForegroundService
import com.runa.mobile.ui.IncomingCallOverlay
import com.runa.mobile.ui.LoginScreen
import com.runa.mobile.ui.PBXWebViewScreen
import kotlinx.coroutines.launch
import org.json.JSONObject

class MainActivity : ComponentActivity() {

    private lateinit var store: AppConfigStore

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        ensureVoipForegroundServiceRunning()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableLockScreenWakeFlags()

        store = AppConfigStore.getInstance(this)
        requestRequiredVoipPermissions()
        handleDeepLinkIntent(intent)

        if (store.session.value != null) {
            ensureVoipForegroundServiceRunning()
        }

        setContent {
            MaterialTheme {
                val session by store.session.collectAsState()
                val liveState by store.liveState.collectAsState()

                Box(modifier = Modifier.fillMaxSize()) {
                    if (session == null) {
                        LoginScreen(
                            store = store,
                            onLoginSuccess = {
                                ensureVoipForegroundServiceRunning()
                                requestBatteryOptimizationExemptionIfNeeded()
                            }
                        )
                    } else {
                        PBXWebViewScreen(store = store)

                        if (liveState.isCallKitUIPresented &&
                            (liveState.callStatus == "Ringing" ||
                             liveState.callStatus == "InCall" ||
                             liveState.callStatus == "Calling")
                        ) {
                            IncomingCallOverlay(
                                store = store,
                                onOpenInAppPBXControls = {
                                    store.updateLiveState { it.copy(isCallKitUIPresented = false) }
                                    store.webEventDispatcher?.invoke(
                                        "SWITCH_AGENT_PANEL_SUBTAB",
                                        JSONObject().apply { put("subTab", "webphone") }
                                    )
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        enableLockScreenWakeFlags()
        handleDeepLinkIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        // When user unlocks the phone while in an active call, automatically transition to in-app WebPhone
        val km = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        val isUnlocked = km?.isKeyguardLocked == false
        val st = store.liveState.value
        if (isUnlocked && st.callStatus == "InCall" && st.isCallKitUIPresented) {
            store.updateLiveState { it.copy(isCallKitUIPresented = false, incomingCallWasLocked = false) }
            store.webEventDispatcher?.invoke(
                "SWITCH_AGENT_PANEL_SUBTAB",
                JSONObject().apply { put("subTab", "webphone") }
            )
        }
    }

    private fun enableLockScreenWakeFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
    }

    private fun requestRequiredVoipPermissions() {
        val perms = mutableListOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
            Manifest.permission.READ_PHONE_STATE
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            perms.add(Manifest.permission.BLUETOOTH_CONNECT)
        }
        val missing = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    @SuppressLint("BatteryLife")
    private fun requestBatteryOptimizationExemptionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
                if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                }
            } catch (_: Exception) {}
        }
    }

    private fun ensureVoipForegroundServiceRunning() {
        if (store.session.value != null) {
            RunaVoipForegroundService.startService(this)
        }
    }

    private fun handleDeepLinkIntent(intent: Intent?) {
        val dataUri = intent?.data ?: return
        val scheme = (dataUri.scheme ?: "").lowercase()
        if (scheme == "runa-mobile" || scheme == "aida-mobile" || scheme == "runa") {
            val rawUrl = dataUri.toString()
            lifecycleScope.launch {
                try {
                    val outcome = PBXNetworkService.loginWithMagicUrl(
                        rawUrlOrToken = rawUrl,
                        fallbackHost = store.serverHost.value,
                        rememberMe = true
                    )
                    if (outcome is LoginOutcome.Authenticated) {
                        store.recordLoginSuccess(
                            displayHost = outcome.resolved.displayHost,
                            apiOrigin = outcome.resolved.apiOrigin,
                            uiOrigin = outcome.resolved.uiOrigin,
                            rememberMe = true,
                            savedUsername = outcome.session.username,
                            session = outcome.session
                        )
                        ensureVoipForegroundServiceRunning()
                    }
                } catch (_: Exception) {}
            }
        }
    }
}
