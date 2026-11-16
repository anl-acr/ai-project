package com.runa.mobile.model

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject

data class AgentSessionModel(
    val userId: String,
    val username: String,
    val fullName: String,
    val extensionNumber: String,
    val tenantId: String
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("userId", userId)
        put("username", username)
        put("fullName", fullName)
        put("extension", extensionNumber)
        put("tenantId", tenantId)
    }

    companion object {
        fun fromJson(obj: JSONObject?): AgentSessionModel? {
            if (obj == null) return null
            val uid = obj.optString("userId", "")
            if (uid.isEmpty()) return null
            return AgentSessionModel(
                userId = uid,
                username = obj.optString("username", ""),
                fullName = obj.optString("fullName", ""),
                extensionNumber = obj.optString("extension", "1000"),
                tenantId = obj.optString("tenantId", "tenant-default")
            )
        }
    }
}

data class AudioPrefsModel(
    val micLabel: String = "",
    val speakerLabel: String = "",
    val ringtoneSpeakerLabel: String = ""
)

data class LiveAgentStateModel(
    val fullName: String = "",
    val extensionNumber: String = "",
    val profileId: String = "available",
    val profileLabel: String = "Uygun",
    val registered: Boolean = false,
    val callStatus: String = "Idle",
    val incomingCallerNumber: String = "",
    val incomingCallerName: String = "",
    val incomingCallWasLocked: Boolean = true,
    val isCallKitUIPresented: Boolean = false,
    val isMuted: Boolean = false,
    val isOnHold: Boolean = false,
    val isSpeakerOn: Boolean = false,
    val callDurationSeconds: Int = 0
)

data class Pending2FAContext(
    val apiOrigin: String,
    val uiOrigin: String,
    val displayHost: String,
    val userId: String,
    val sessionUserId: String,
    val method: String,
    val email: String,
    val phone: String,
    val fullName: String,
    val extensionNumber: String,
    val tenantId: String,
    val username: String,
    val rememberMe: Boolean
)

class AppConfigStore private constructor(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("runa_mobile_prefs", Context.MODE_PRIVATE)

    private val _serverHost = MutableStateFlow(prefs.getString("serverHost", "") ?: "")
    val serverHost: StateFlow<String> = _serverHost.asStateFlow()

    private val _uiOrigin = MutableStateFlow(prefs.getString("uiOrigin", "") ?: "")
    val uiOrigin: StateFlow<String> = _uiOrigin.asStateFlow()

    private val _apiOrigin = MutableStateFlow(prefs.getString("apiOrigin", "") ?: "")
    val apiOrigin: StateFlow<String> = _apiOrigin.asStateFlow()

    private val _recentHosts = MutableStateFlow(loadRecentHosts())
    val recentHosts: StateFlow<List<String>> = _recentHosts.asStateFlow()

    private val _rememberMe = MutableStateFlow(prefs.getBoolean("rememberMe", true))
    val rememberMe: StateFlow<Boolean> = _rememberMe.asStateFlow()

    private val _savedUsername = MutableStateFlow(prefs.getString("savedUsername", "") ?: "")
    val savedUsername: StateFlow<String> = _savedUsername.asStateFlow()

    private val _session = MutableStateFlow(loadSession())
    val session: StateFlow<AgentSessionModel?> = _session.asStateFlow()

    private val _isWebDarkMode = MutableStateFlow(prefs.getBoolean("isWebDarkMode", false))
    val isWebDarkMode: StateFlow<Boolean> = _isWebDarkMode.asStateFlow()

    private val _liveState = MutableStateFlow(LiveAgentStateModel())
    val liveState: StateFlow<LiveAgentStateModel> = _liveState.asStateFlow()

    private val _isOfflineError = MutableStateFlow(false)
    val isOfflineError: StateFlow<Boolean> = _isOfflineError.asStateFlow()

    @Volatile
    var justLoggedIn: Boolean = false

    @Volatile
    var hasUserAnsweredCurrentCall: Boolean = false

    @Volatile
    var coldLaunchPickupExten: String = ""

    @Volatile
    var webEventDispatcher: ((String, JSONObject?) -> Unit)? = null

    private fun loadRecentHosts(): List<String> {
        val raw = prefs.getString("recentHostsJson", "[]") ?: "[]"
        return try {
            val arr = JSONArray(raw)
            val out = mutableListOf<String>()
            for (i in 0 until arr.length()) {
                val h = arr.optString(i, "").trim()
                if (h.isNotEmpty()) out.add(h)
            }
            out
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun loadSession(): AgentSessionModel? {
        val raw = prefs.getString("sessionJson", null) ?: return null
        return try {
            AgentSessionModel.fromJson(JSONObject(raw))
        } catch (_: Exception) {
            null
        }
    }

    fun updateLiveState(transform: (LiveAgentStateModel) -> LiveAgentStateModel) {
        _liveState.value = transform(_liveState.value)
    }

    fun setWebDarkMode(dark: Boolean) {
        _isWebDarkMode.value = dark
        prefs.edit().putBoolean("isWebDarkMode", dark).apply()
    }

    fun setOfflineError(offline: Boolean) {
        _isOfflineError.value = offline
    }

    fun removeRecentHost(host: String) {
        val next = _recentHosts.value.filterNot { it.equals(host, ignoreCase = true) }
        _recentHosts.value = next
        val arr = JSONArray()
        next.forEach { arr.put(it) }
        prefs.edit().putString("recentHostsJson", arr.toString()).apply()
    }

    fun recordLoginSuccess(
        displayHost: String,
        apiOrigin: String,
        uiOrigin: String,
        rememberMe: Boolean,
        savedUsername: String,
        session: AgentSessionModel
    ) {
        justLoggedIn = true
        _serverHost.value = displayHost
        _apiOrigin.value = apiOrigin
        _uiOrigin.value = uiOrigin
        _rememberMe.value = rememberMe
        _savedUsername.value = savedUsername
        _session.value = session
        _isOfflineError.value = false

        val updatedHosts = listOf(displayHost) + _recentHosts.value.filterNot { it.equals(displayHost, ignoreCase = true) }
        val cappedHosts = updatedHosts.take(6)
        _recentHosts.value = cappedHosts

        _liveState.value = _liveState.value.copy(
            fullName = session.fullName,
            extensionNumber = session.extensionNumber
        )

        val arr = JSONArray()
        cappedHosts.forEach { arr.put(it) }

        prefs.edit().apply {
            putString("serverHost", displayHost)
            putString("apiOrigin", apiOrigin)
            putString("uiOrigin", uiOrigin)
            putBoolean("rememberMe", rememberMe)
            putString("savedUsername", if (rememberMe) savedUsername else "")
            putString("recentHostsJson", arr.toString())
            if (rememberMe) {
                putString("sessionJson", session.toJson().toString())
            } else {
                remove("sessionJson")
            }
            apply()
        }
    }

    fun disconnectAndLogout() {
        _session.value = null
        hasUserAnsweredCurrentCall = false
        _liveState.value = LiveAgentStateModel()
        prefs.edit().remove("sessionJson").apply()
    }

    fun consumeBootStateJson(): String {
        val sess = _session.value
        val flag = justLoggedIn
        justLoggedIn = false
        return JSONObject().apply {
            put("appName", "Runa")
            put("version", "2.9.3")
            put("serverHost", _serverHost.value)
            put("uiOrigin", _uiOrigin.value)
            put("apiOrigin", _apiOrigin.value)
            put("rememberMe", _rememberMe.value)
            put("justLoggedIn", flag)
            put("osNotifications", true)
            put("popWindowOnCall", true)
            put("minimizeToTray", true)
            if (sess != null) {
                put("session", sess.toJson())
            }
        }.toString()
    }

    companion object {
        @Volatile
        private var INSTANCE: AppConfigStore? = null

        fun getInstance(context: Context): AppConfigStore {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: AppConfigStore(context.applicationContext).also { INSTANCE = it }
            }
        }
    }
}
