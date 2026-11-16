package com.runa.mobile.service

import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.telecom.DisconnectCause
import androidx.core.app.NotificationCompat
import com.runa.mobile.MainActivity
import com.runa.mobile.R
import com.runa.mobile.model.AppConfigStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.Base64
import java.util.Random
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

class RunaVoipForegroundService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var sipLoopJob: Job? = null
    private var alertsPollerJob: Job? = null
    private var callTimerJob: Job? = null
    private var activeRingtone: Ringtone? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private val seenChatIds = mutableSetOf<String>()
    private val seenMissedIds = mutableSetOf<String>()
    private val seenVoicemailIds = mutableSetOf<String>()
    private var seededChatIds = false
    private var seededMissedIds = false
    private var seededVoicemailIds = false
    private val userDirectoryMap = mutableMapOf<String, String>()
    private var lastDirectoryFetchMs = 0L

    @Volatile
    private var rejectPendingInviteFlag: Boolean = false

    @Volatile
    private var powerBtnPressCountDuringRing: Int = 0

    @Volatile
    private var isRingtoneSilenced: Boolean = false

    private val screenOffReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_SCREEN_OFF) {
                val store = AppConfigStore.getInstance(this@RunaVoipForegroundService)
                if (store.liveState.value.callStatus == "Ringing") {
                    powerBtnPressCountDuringRing += 1
                    if (powerBtnPressCountDuringRing == 1) {
                        // Single press of Power/Lock button -> Silence ringtone & vibration
                        silenceIncomingRingtone()
                    } else if (powerBtnPressCountDuringRing >= 2) {
                        // Double press of Power/Lock button -> Reject incoming call (486 Busy Here)
                        rejectOrHangupCallFromSystem()
                    }
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        createNotificationChannels()
        try {
            registerReceiver(screenOffReceiver, IntentFilter(Intent.ACTION_SCREEN_OFF))
        } catch (_: Exception) {}
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_ANSWER_CALL -> {
                answerIncomingCallFromSystem()
                return START_STICKY
            }
            ACTION_REJECT_CALL -> {
                rejectOrHangupCallFromSystem()
                return START_STICKY
            }
            ACTION_STOP_SERVICE -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
        }

        val notif = buildForegroundStandingNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIF_ID_FOREGROUND,
                notif,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } else {
            startForeground(NOTIF_ID_FOREGROUND, notif)
        }

        if (sipLoopJob?.isActive != true) {
            sipLoopJob = serviceScope.launch {
                runVoipSipPushLoop()
            }
        }

        if (alertsPollerJob?.isActive != true) {
            alertsPollerJob = serviceScope.launch {
                runRealtimeAlertsPollerLoop()
            }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        instance = null
        stopIncomingRingtoneAndVibration()
        try {
            unregisterReceiver(screenOffReceiver)
        } catch (_: Exception) {}
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val standingChannel = NotificationChannel(
                CHANNEL_ID_STANDING,
                "Runa Santral Arka Plan Servisi",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Uygulama kapalıyken gelen santral çağrılarını yakalar"
                setShowBadge(false)
            }
            nm.createNotificationChannel(standingChannel)

            val incomingChannel = NotificationChannel(
                CHANNEL_ID_INCOMING_CALL,
                "Runa Gelen Çağrılar",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Kilit ekranında tam ekran gelen çağrı bildirimi"
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                enableVibration(true)
            }
            nm.createNotificationChannel(incomingChannel)

            val alertsChannel = NotificationChannel(
                CHANNEL_ID_ALERTS,
                "Runa Mesaj, Kayıp Çağrı ve Sesli Posta Bildirimleri",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Yeni iç mesaj, kayıp çağrı, sesli posta ve yanıtsız çağrı bildirimleri"
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                enableVibration(true)
                setShowBadge(true)
            }
            nm.createNotificationChannel(alertsChannel)
        }
    }

    fun postSystemAlertNotification(
        title: String,
        body: String,
        subTab: String,
        peerSenderId: String = ""
    ) {
        try {
            val notifId = 9100 + ((title + body + System.currentTimeMillis()).hashCode() and 0x7FFF)
            val openIntent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("open_subtab", subTab)
                if (peerSenderId.isNotEmpty()) {
                    putExtra("peer_sender_id", peerSenderId)
                }
            }
            val pi = PendingIntent.getActivity(
                this,
                notifId,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notif = NotificationCompat.Builder(this, CHANNEL_ID_ALERTS)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build()

            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(notifId, notif)
        } catch (_: Exception) {}
    }

    private fun buildForegroundStandingNotification(): Notification {
        val store = AppConfigStore.getInstance(this)
        val sess = store.session.value
        val ext = sess?.extensionNumber ?: "1000"
        val host = store.serverHost.value.ifEmpty { "Bağlı" }

        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            this,
            100,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID_STANDING)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Runa • Dahili $ext Aktif")
            .setContentText("Santral bağlantısı arka planda hazır ($host)")
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    fun triggerIncomingCallAlert(callerNumber: String, callerName: String, callId: String) {
        val store = AppConfigStore.getInstance(this)
        if (store.hasUserAnsweredCurrentCall || store.liveState.value.callStatus == "InCall") return

        val km = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
        val isDeviceLocked = (km?.isKeyguardLocked == true) || (pm?.isInteractive == false)

        powerBtnPressCountDuringRing = 0
        isRingtoneSilenced = false
        store.coldLaunchPickupExten = store.session.value?.extensionNumber ?: "1000"

        store.updateLiveState {
            it.copy(
                callStatus = "Ringing",
                incomingCallerNumber = callerNumber,
                incomingCallerName = callerName.ifEmpty { callerNumber },
                incomingCallWasLocked = isDeviceLocked,
                isCallKitUIPresented = true,
                callDurationSeconds = 0
            )
        }

        // Wake screen immediately
        try {
            @Suppress("DEPRECATION")
            val wl = pm?.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                "runa:incoming_call_wake"
            )
            wl?.acquire(30_000L)
            wakeLock = wl
        } catch (_: Exception) {}

        startIncomingRingtoneAndVibration()
        showFullScreenIncomingCallNotification(callerNumber, callerName.ifEmpty { callerNumber })

        // Bring MainActivity to foreground over lock screen
        try {
            val launchIntent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("incoming_call", true)
                putExtra("caller_number", callerNumber)
                putExtra("caller_name", callerName)
                putExtra("call_id", callId)
            }
            startActivity(launchIntent)
        } catch (_: Exception) {}
    }

    private fun showFullScreenIncomingCallNotification(callerNumber: String, callerName: String) {
        val fullScreenIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("incoming_call", true)
        }
        val fullScreenPi = PendingIntent.getActivity(
            this,
            201,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val answerIntent = Intent(this, RunaVoipForegroundService::class.java).apply {
            action = ACTION_ANSWER_CALL
        }
        val answerPi = PendingIntent.getService(
            this,
            202,
            answerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val rejectIntent = Intent(this, RunaVoipForegroundService::class.java).apply {
            action = ACTION_REJECT_CALL
        }
        val rejectPi = PendingIntent.getService(
            this,
            203,
            rejectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val titleText = if (callerName.isNotEmpty() && callerName != callerNumber) {
            "$callerName ($callerNumber)"
        } else {
            callerNumber
        }

        val notif = NotificationCompat.Builder(this, CHANNEL_ID_INCOMING_CALL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Gelen Çağrı — Runa")
            .setContentText(titleText)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPi, true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Reddet", rejectPi)
            .addAction(android.R.drawable.ic_menu_call, "Cevapla", answerPi)
            .build()

        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID_INCOMING_CALL, notif)
    }

    private fun cancelIncomingCallNotification() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(NOTIF_ID_INCOMING_CALL)
    }

    fun silenceIncomingRingtone() {
        isRingtoneSilenced = true
        stopIncomingRingtoneAndVibration()
    }

    private fun startIncomingRingtoneAndVibration() {
        if (isRingtoneSilenced) return
        try {
            stopIncomingRingtoneAndVibration()
            val ringUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            val r = RingtoneManager.getRingtone(applicationContext, ringUri)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                r.isLooping = true
            }
            r.audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            r.play()
            activeRingtone = r
        } catch (_: Exception) {}

        try {
            val pattern = longArrayOf(0, 800, 600, 800)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (_: Exception) {}
    }

    fun stopIncomingRingtoneAndVibration() {
        try {
            activeRingtone?.stop()
            activeRingtone = null
        } catch (_: Exception) {}
        try {
            vibrator?.cancel()
        } catch (_: Exception) {}
    }

    fun answerIncomingCallFromSystem() {
        val store = AppConfigStore.getInstance(this)
        stopIncomingRingtoneAndVibration()
        cancelIncomingCallNotification()
        store.hasUserAnsweredCurrentCall = true

        val wasLocked = store.liveState.value.incomingCallWasLocked
        store.updateLiveState {
            it.copy(
                callStatus = "InCall",
                isCallKitUIPresented = wasLocked
            )
        }

        // Route audio to voice communication
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            am.mode = AudioManager.MODE_IN_COMMUNICATION
            am.isSpeakerphoneOn = store.liveState.value.isSpeakerOn
        } catch (_: Exception) {}

        // Start call duration timer
        callTimerJob?.cancel()
        callTimerJob = serviceScope.launch {
            while (isActive && store.liveState.value.callStatus == "InCall") {
                delay(1000L)
                store.updateLiveState { st -> st.copy(callDurationSeconds = st.callDurationSeconds + 1) }
            }
        }

        val st = store.liveState.value
        val payload = JSONObject().apply {
            put("answer", true)
            put("pickupExten", store.coldLaunchPickupExten.ifEmpty { store.session.value?.extensionNumber ?: "1000" })
            put("callerNumber", st.incomingCallerNumber)
            put("callerName", st.incomingCallerName)
        }
        store.webEventDispatcher?.invoke("AIDA_CALLKIT_ANSWER", payload)
    }

    fun rejectOrHangupCallFromSystem() {
        val store = AppConfigStore.getInstance(this)
        val prevCaller = store.liveState.value.incomingCallerNumber
        val ext = store.session.value?.extensionNumber ?: "1000"
        val apiOrigin = store.apiOrigin.value

        stopIncomingRingtoneAndVibration()
        cancelIncomingCallNotification()
        callTimerJob?.cancel()
        rejectPendingInviteFlag = true
        store.hasUserAnsweredCurrentCall = false

        store.updateLiveState {
            it.copy(
                callStatus = "Idle",
                isCallKitUIPresented = false,
                isMuted = false,
                isOnHold = false,
                callDurationSeconds = 0
            )
        }

        try {
            RunaConnectionService.activeConnection?.setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
            RunaConnectionService.activeConnection?.destroy()
            RunaConnectionService.activeConnection = null
        } catch (_: Exception) {}

        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            am.mode = AudioManager.MODE_NORMAL
            am.isSpeakerphoneOn = false
        } catch (_: Exception) {}

        store.webEventDispatcher?.invoke("AIDA_CALLKIT_HANGUP", JSONObject().apply { put("hangup", true) })

        if (apiOrigin.isNotEmpty()) {
            serviceScope.launch {
                PBXNetworkService.hangupActiveCallForExtension(apiOrigin, ext, prevCaller)
            }
        }
    }

    fun toggleMuteFromSystem(): Boolean {
        val store = AppConfigStore.getInstance(this)
        val nextMute = !store.liveState.value.isMuted
        store.updateLiveState { it.copy(isMuted = nextMute) }
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            am.isMicrophoneMute = nextMute
        } catch (_: Exception) {}
        store.webEventDispatcher?.invoke("AIDA_CALLKIT_MUTE", JSONObject().apply { put("muted", nextMute) })
        return nextMute
    }

    fun toggleHoldFromSystem(forcedHold: Boolean? = null): Boolean {
        val store = AppConfigStore.getInstance(this)
        val nextHold = forcedHold ?: !store.liveState.value.isOnHold
        store.updateLiveState { it.copy(isOnHold = nextHold) }
        store.webEventDispatcher?.invoke("AIDA_CALLKIT_HOLD", JSONObject().apply { put("onHold", nextHold) })
        return nextHold
    }

    fun toggleSpeakerFromSystem(): Boolean {
        val store = AppConfigStore.getInstance(this)
        val nextSpk = !store.liveState.value.isSpeakerOn
        store.updateLiveState { it.copy(isSpeakerOn = nextSpk) }
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            am.isSpeakerphoneOn = nextSpk
        } catch (_: Exception) {}
        return nextSpk
    }

    fun sendDtmfFromSystem(digit: String) {
        val store = AppConfigStore.getInstance(this)
        store.webEventDispatcher?.invoke("AIDA_CALLKIT_DTMF", JSONObject().apply { put("digit", digit) })
    }

    // =========================================================================
    // 24/7 Background WSS SIP Listener (Port 8089/ws) for Closed/Locked Wakeup
    // =========================================================================
    private suspend fun runVoipSipPushLoop() {
        val store = AppConfigStore.getInstance(this)
        val rng = Random()

        while (serviceScope.isActive) {
            val sess = store.session.value
            val apiOrigin = store.apiOrigin.value
            if (sess == null || apiOrigin.isEmpty()) {
                delay(4000L)
                continue
            }

            var sslSocket: SSLSocket? = null
            try {
                val cfgUrl = URL("$apiOrigin/api/webrtc/config?extension=${sess.extensionNumber}")
                val conn = cfgUrl.openConnection() as HttpURLConnection
                if (conn is HttpsURLConnection) {
                    val sc = SSLContext.getInstance("TLS")
                    sc.init(null, arrayOf<TrustManager>(object : X509TrustManager {
                        override fun checkClientTrusted(c: Array<out X509Certificate>?, a: String?) {}
                        override fun checkServerTrusted(c: Array<out X509Certificate>?, a: String?) {}
                        override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
                    }), SecureRandom())
                    conn.sslSocketFactory = sc.socketFactory
                    conn.setHostnameVerifier { _, _ -> true }
                }
                conn.connectTimeout = 6000
                conn.readTimeout = 6000
                val cfgBody = BufferedReader(InputStreamReader(conn.inputStream, Charsets.UTF_8)).use { it.readText() }
                val cfgJson = JSONObject(cfgBody)

                val sipUser = cfgJson.optString("sipUsername", "").ifEmpty { sess.extensionNumber }
                val sipPass = cfgJson.optString("password", "")
                val viaHost = cfgJson.optString("viaHost", "213.74.216.246")
                val hostDomain = try { URI(apiOrigin).host ?: "aida.saphira.com.tr" } catch (_: Exception) { "aida.saphira.com.tr" }

                val sc = SSLContext.getInstance("TLS")
                sc.init(null, arrayOf<TrustManager>(object : X509TrustManager {
                    override fun checkClientTrusted(c: Array<out X509Certificate>?, a: String?) {}
                    override fun checkServerTrusted(c: Array<out X509Certificate>?, a: String?) {}
                    override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
                }), SecureRandom())

                sslSocket = sc.socketFactory.createSocket(hostDomain, 8089) as SSLSocket
                sslSocket.soTimeout = 1200
                sslSocket.startHandshake()

                val out = sslSocket.outputStream
                val inp = sslSocket.inputStream

                val keyBytes = ByteArray(16).also { rng.nextBytes(it) }
                val wsKey = Base64.getEncoder().encodeToString(keyBytes)
                val handshake = buildString {
                    append("GET /ws HTTP/1.1\r\n")
                    append("Host: $hostDomain:8089\r\n")
                    append("Upgrade: websocket\r\n")
                    append("Connection: Upgrade\r\n")
                    append("Sec-WebSocket-Key: $wsKey\r\n")
                    append("Sec-WebSocket-Version: 13\r\n")
                    append("Sec-WebSocket-Protocol: sip\r\n\r\n")
                }
                out.write(handshake.toByteArray(Charsets.UTF_8))
                out.flush()

                val respBuf = StringBuilder()
                while (!respBuf.contains("\r\n\r\n")) {
                    val b = inp.read()
                    if (b == -1) throw IllegalStateException("WSS EOF")
                    respBuf.append(b.toChar())
                }

                val regCallId = "runa-android-${100000 + rng.nextInt(899999)}@$hostDomain"
                val regTag = "ra${10000 + rng.nextInt(89999)}"
                var cseq = 1
                val contactUser = "${sipUser}_androidpush"

                fun sendSipRegister(authHeader: String? = null) {
                    val branch = "z9hG4bk${1000000 + rng.nextInt(8999999)}"
                    val uri = "sip:$hostDomain"
                    val lines = mutableListOf(
                        "REGISTER $uri SIP/2.0",
                        "Via: SIP/2.0/WSS $viaHost;branch=$branch;rport",
                        "Max-Forwards: 70",
                        "To: <sip:$sipUser@$hostDomain>",
                        "From: <sip:$sipUser@$hostDomain>;tag=$regTag",
                        "Call-ID: $regCallId",
                        "CSeq: $cseq REGISTER",
                        "Contact: <sip:$contactUser@$viaHost;transport=ws>;expires=300",
                        "User-Agent: Runa-Android-VoIP-Service/2.9.3"
                    )
                    if (!authHeader.isNullOrEmpty()) {
                        lines.add("Authorization: $authHeader")
                    }
                    lines.add("Content-Length: 0\r\n\r\n")
                    cseq += 1
                    sendWsTextFrame(out, lines.joinToString("\r\n"), rng)
                }

                sendSipRegister()
                var lastRegTime = System.currentTimeMillis()
                var activeInviteHeaders: Map<String, String>? = null
                var activeInviteVias: List<String> = emptyList()
                var activeInviteToTag: String = ""

                while (serviceScope.isActive && store.session.value != null) {
                    if (rejectPendingInviteFlag) {
                        rejectPendingInviteFlag = false
                        val inv = activeInviteHeaders
                        if (inv != null) {
                            val viaHdrs = activeInviteVias.joinToString("\r\n") { "Via: $it" }
                            val busyResp = buildString {
                                append("SIP/2.0 486 Busy Here\r\n")
                                append("$viaHdrs\r\n")
                                append("From: ${inv["from"] ?: ""}\r\n")
                                append("To: ${inv["to"] ?: ""};tag=$activeInviteToTag\r\n")
                                append("Call-ID: ${inv["call-id"] ?: ""}\r\n")
                                append("CSeq: ${inv["cseq"] ?: ""}\r\n")
                                append("Content-Length: 0\r\n\r\n")
                            }
                            sendWsTextFrame(out, busyResp, rng)
                            activeInviteHeaders = null
                        }
                    }

                    if (System.currentTimeMillis() - lastRegTime > 180_000L) {
                        sendSipRegister()
                        lastRegTime = System.currentTimeMillis()
                    }

                    val msg = try {
                        recvWsFrame(inp, out, rng)
                    } catch (_: java.net.SocketTimeoutException) {
                        continue
                    } ?: break

                    if (msg.isEmpty()) continue
                    val lines = msg.split("\r\n")
                    val firstLine = lines.firstOrNull() ?: continue
                    val hdrs = mutableMapOf<String, String>()
                    val vias = mutableListOf<String>()
                    for (line in lines.drop(1)) {
                        if (line.isBlank()) break
                        val idx = line.indexOf(':')
                        if (idx > 0) {
                            val k = line.substring(0, idx).trim().lowercase()
                            val v = line.substring(idx + 1).trim()
                            if (k == "via" || k == "v") vias.add(v)
                            hdrs.putIfAbsent(k, v)
                        }
                    }

                    if (firstLine.startsWith("SIP/2.0 401") || firstLine.startsWith("SIP/2.0 407")) {
                        val www = hdrs["www-authenticate"] ?: hdrs["proxy-authenticate"] ?: ""
                        val realm = Regex("realm=\"([^\"]+)\"").find(www)?.groupValues?.get(1) ?: ""
                        val nonce = Regex("nonce=\"([^\"]+)\"").find(www)?.groupValues?.get(1) ?: ""
                        val qop = Regex("qop=\"([^\"]+)\"").find(www)?.groupValues?.get(1)
                        if (realm.isNotEmpty() && nonce.isNotEmpty()) {
                            val authStr = computeDigestAuth(
                                sipUser,
                                sipPass,
                                realm,
                                nonce,
                                "REGISTER",
                                "sip:$hostDomain",
                                if (qop?.contains("auth") == true) "auth" else null
                            )
                            sendSipRegister(authStr)
                            lastRegTime = System.currentTimeMillis()
                        }
                    } else if (firstLine.startsWith("OPTIONS ")) {
                        val viaHdrs = vias.joinToString("\r\n") { "Via: $it" }
                        var toHdr = hdrs["to"] ?: hdrs["t"] ?: ""
                        if (!toHdr.contains(";tag=")) toHdr += ";tag=opt${1000 + rng.nextInt(8999)}"
                        val optResp = buildString {
                            append("SIP/2.0 200 OK\r\n")
                            append("$viaHdrs\r\n")
                            append("From: ${hdrs["from"] ?: hdrs["f"] ?: ""}\r\n")
                            append("To: $toHdr\r\n")
                            append("Call-ID: ${hdrs["call-id"] ?: hdrs["i"] ?: ""}\r\n")
                            append("CSeq: ${hdrs["cseq"] ?: ""}\r\n")
                            append("Content-Length: 0\r\n\r\n")
                        }
                        sendWsTextFrame(out, optResp, rng)
                    } else if (firstLine.startsWith("INVITE ")) {
                        val callId = hdrs["call-id"] ?: hdrs["i"] ?: ""
                        val fromHdr = hdrs["from"] ?: hdrs["f"] ?: ""
                        val toHdr = hdrs["to"] ?: hdrs["t"] ?: ""
                        val cseqHdr = hdrs["cseq"] ?: ""
                        if (toHdr.lowercase().contains(";tag=")) continue

                        val toTag = "ring${10000 + rng.nextInt(89999)}"
                        val viaHdrs = vias.joinToString("\r\n") { "Via: $it" }
                        val ringResp = buildString {
                            append("SIP/2.0 180 Ringing\r\n")
                            append("$viaHdrs\r\n")
                            append("From: $fromHdr\r\n")
                            append("To: $toHdr;tag=$toTag\r\n")
                            append("Call-ID: $callId\r\n")
                            append("CSeq: $cseqHdr\r\n")
                            append("Contact: <sip:$contactUser@$viaHost;transport=ws>\r\n")
                            append("Content-Length: 0\r\n\r\n")
                        }
                        sendWsTextFrame(out, ringResp, rng)

                        var callerNum = Regex("sip:([^@>;]+)").find(fromHdr)?.groupValues?.get(1)?.trim() ?: "Bilinmeyen"
                        var callerName = Regex("\"([^\"]+)\"").find(fromHdr)?.groupValues?.get(1)?.trim() ?: ""

                        if (callerName.isEmpty() || callerName == callerNum || callerName.all { it.isDigit() }) {
                            val crmName = PBXNetworkService.resolveContactName(
                                apiOrigin = apiOrigin,
                                tenantId = sess.tenantId,
                                extensionNumber = sess.extensionNumber,
                                callerNumber = callerNum
                            )
                            if (crmName.isNotEmpty()) callerName = crmName
                        }

                        activeInviteHeaders = mapOf(
                            "call-id" to callId,
                            "from" to fromHdr,
                            "to" to toHdr,
                            "cseq" to cseqHdr
                        )
                        activeInviteVias = vias
                        activeInviteToTag = toTag

                        triggerIncomingCallAlert(callerNum, callerName.ifEmpty { callerNum }, callId)
                    } else if (firstLine.startsWith("CANCEL ") || firstLine.startsWith("BYE ")) {
                        val callId = hdrs["call-id"] ?: hdrs["i"] ?: ""
                        val fromHdr = hdrs["from"] ?: hdrs["f"] ?: ""
                        val toHdr = hdrs["to"] ?: hdrs["t"] ?: ""
                        val cseqHdr = hdrs["cseq"] ?: ""
                        val reasonHdr = (hdrs["reason"] ?: "").lowercase()
                        val viaHdrs = vias.joinToString("\r\n") { "Via: $it" }

                        val okResp = buildString {
                            append("SIP/2.0 200 OK\r\n")
                            append("$viaHdrs\r\n")
                            append("From: $fromHdr\r\n")
                            append("To: $toHdr\r\n")
                            append("Call-ID: $callId\r\n")
                            append("CSeq: $cseqHdr\r\n")
                            append("Content-Length: 0\r\n\r\n")
                        }
                        sendWsTextFrame(out, okResp, rng)

                        // Do not drop call if CANCEL is due to PickupChan ("completed elsewhere" / cause=200)
                        if (!reasonHdr.contains("cause=200") && !reasonHdr.contains("completed elsewhere")) {
                            val wasRingingUnanswered = (store.liveState.value.callStatus == "Ringing" && !store.hasUserAnsweredCurrentCall)
                            val callerNum = store.liveState.value.incomingCallerNumber.ifEmpty {
                                Regex("sip:([^@>;]+)").find(fromHdr)?.groupValues?.get(1)?.trim() ?: "Bilinmeyen Numara"
                            }
                            val callerName = store.liveState.value.incomingCallerName
                            val callerDisp = if (callerName.isNotEmpty() && callerName != callerNum) {
                                "$callerName ($callerNum)"
                            } else {
                                callerNum
                            }
                            stopIncomingRingtoneAndVibration()
                            cancelIncomingCallNotification()
                            store.updateLiveState {
                                it.copy(
                                    callStatus = "Idle",
                                    isCallKitUIPresented = false
                                )
                            }
                            if (wasRingingUnanswered && firstLine.startsWith("CANCEL ")) {
                                postSystemAlertNotification(
                                    title = "$callerDisp - Yanıtsız Çağrı",
                                    body = "Gelen çağrı yanıtlanamadı. Arama geçmişini görüntülemek için dokunun.",
                                    subTab = "history"
                                )
                            }
                        }
                    }
                }
            } catch (_: Exception) {
            } finally {
                try { sslSocket?.close() } catch (_: Exception) {}
            }
            delay(3500L)
        }
    }

    private fun openInsecureHttpGet(urlStr: String, tenantId: String, extensionNumber: String): String? {
        var conn: HttpURLConnection? = null
        return try {
            val url = URL(urlStr)
            conn = url.openConnection() as HttpURLConnection
            if (conn is HttpsURLConnection) {
                val sc = SSLContext.getInstance("TLS")
                sc.init(null, arrayOf<TrustManager>(object : X509TrustManager {
                    override fun checkClientTrusted(c: Array<out X509Certificate>?, a: String?) {}
                    override fun checkServerTrusted(c: Array<out X509Certificate>?, a: String?) {}
                    override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
                }), SecureRandom())
                conn.sslSocketFactory = sc.socketFactory
                conn.setHostnameVerifier { _, _ -> true }
            }
            conn.requestMethod = "GET"
            conn.connectTimeout = 5000
            conn.readTimeout = 5000
            conn.setRequestProperty("X-Tenant-ID", tenantId.ifEmpty { "tenant-default" })
            conn.setRequestProperty("X-User-Extension", extensionNumber)
            if (conn.responseCode in 200..299) {
                BufferedReader(InputStreamReader(conn.inputStream, Charsets.UTF_8)).use { it.readText() }
            } else null
        } catch (_: Exception) {
            null
        } finally {
            try { conn?.disconnect() } catch (_: Exception) {}
        }
    }

    private fun refreshUserDirectoryIfNeeded(apiOrigin: String, tenantId: String, extensionNumber: String) {
        val now = System.currentTimeMillis()
        if (userDirectoryMap.isNotEmpty() && (now - lastDirectoryFetchMs) < 60_000L) return
        val body = openInsecureHttpGet("$apiOrigin/api/settings/users?tenant_id=all", tenantId, extensionNumber) ?: return
        try {
            val arr = JSONArray(body)
            for (i in 0 until arr.length()) {
                val u = arr.optJSONObject(i) ?: continue
                val ext = u.optString("extension", "").trim()
                val uid = u.opt("id")?.toString()?.trim() ?: ""
                val fullName = u.optString("full_name", "").trim()
                    .ifEmpty { u.optString("name", "").trim() }
                    .ifEmpty { u.optString("username", "").trim() }
                if (fullName.isNotEmpty()) {
                    if (ext.isNotEmpty()) {
                        userDirectoryMap[ext] = if (fullName.contains(ext)) fullName else "$ext - $fullName"
                    }
                    if (uid.isNotEmpty()) {
                        userDirectoryMap[uid] = if (ext.isNotEmpty() && !fullName.contains(ext)) "$ext - $fullName" else fullName
                    }
                }
            }
            lastDirectoryFetchMs = now
        } catch (_: Exception) {}
    }

    private fun formatSenderWithDirectory(rawLabel: String, senderId: String): String {
        val trimmed = rawLabel.trim()
        val sid = senderId.trim()
        if (trimmed.contains(" - ")) return trimmed
        if (trimmed.isNotEmpty() && userDirectoryMap.containsKey(trimmed)) {
            return userDirectoryMap[trimmed] ?: trimmed
        }
        if (sid.isNotEmpty() && userDirectoryMap.containsKey(sid)) {
            return userDirectoryMap[sid] ?: trimmed.ifEmpty { sid }
        }
        return trimmed.ifEmpty { sid.ifEmpty { "Mesaj" } }
    }

    private suspend fun runRealtimeAlertsPollerLoop() {
        val store = AppConfigStore.getInstance(this)
        while (serviceScope.isActive) {
            try {
                val sess = store.session.value
                val apiOrigin = store.apiOrigin.value
                if (sess == null || apiOrigin.isEmpty()) {
                    delay(4500L)
                    continue
                }
                val ext = sess.extensionNumber.trim()
                val uid = sess.userId.trim()
                val tenantId = sess.tenantId.ifEmpty { "tenant-default" }
                if (ext.isEmpty()) {
                    delay(4500L)
                    continue
                }

                refreshUserDirectoryIfNeeded(apiOrigin, tenantId, ext)

                // Always post OS notifications from the Foreground Service across all states
                // (Closed, Lock Screen, Home Screen background, and In-App foreground).
                val shouldPostFromService = true

                // 1) Poll internal chat messages
                val chatBody = openInsecureHttpGet(
                    "$apiOrigin/api/agent/chat?extension=$ext&user_id=$uid",
                    tenantId,
                    ext
                )
                if (!chatBody.isNullOrEmpty()) {
                    val arr = JSONArray(chatBody)
                    val myTokens = setOf(ext, uid, sess.username.trim()).filter { it.isNotEmpty() }
                    if (!seededChatIds) {
                        for (i in 0 until arr.length()) {
                            val m = arr.optJSONObject(i) ?: continue
                            val mid = m.opt("id")?.toString() ?: continue
                            seenChatIds.add(mid)
                        }
                        seededChatIds = true
                    } else {
                        for (i in 0 until arr.length()) {
                            val m = arr.optJSONObject(i) ?: continue
                            val mid = m.opt("id")?.toString() ?: continue
                            if (seenChatIds.contains(mid)) continue
                            seenChatIds.add(mid)
                            val senderId = m.optString("sender_id", "").trim()
                            if (myTokens.contains(senderId)) continue
                            if (shouldPostFromService) {
                                val rawSender = m.optString("sender_name", "").ifEmpty { senderId }
                                val senderDisp = formatSenderWithDirectory(rawSender, senderId)
                                val msgText = m.optString("text", "").trim()
                                    .ifEmpty { m.optString("message", "").trim() }
                                    .ifEmpty { "Yeni mesaj" }
                                postSystemAlertNotification(
                                    title = "$senderDisp - Yeni İç Mesaj",
                                    body = msgText,
                                    subTab = "chat",
                                    peerSenderId = senderId
                                )
                            }
                        }
                    }
                }

                // 2) Poll missed queue calls (Kayıp Çağrılar)
                val missedBody = openInsecureHttpGet(
                    "$apiOrigin/api/agent/missed_queue_calls?extension=$ext&user_id=$uid",
                    tenantId,
                    ext
                )
                if (!missedBody.isNullOrEmpty()) {
                    val arr = JSONArray(missedBody)
                    if (!seededMissedIds) {
                        for (i in 0 until arr.length()) {
                            val item = arr.optJSONObject(i) ?: continue
                            val id = item.opt("id")?.toString() ?: item.optString("call_id", "")
                            if (id.isNotEmpty()) seenMissedIds.add(id)
                        }
                        seededMissedIds = true
                    } else {
                        for (i in 0 until arr.length()) {
                            val item = arr.optJSONObject(i) ?: continue
                            val id = item.opt("id")?.toString() ?: item.optString("call_id", "")
                            if (id.isEmpty() || seenMissedIds.contains(id)) continue
                            seenMissedIds.add(id)
                            if (shouldPostFromService) {
                                val callerNum = item.optString("caller", "")
                                    .ifEmpty { item.optString("caller_number", "") }
                                    .ifEmpty { "Bilinmeyen Numara" }
                                var callerName = item.optString("caller_name", "")
                                    .ifEmpty { item.optString("contact_name", "") }
                                if (callerName.isEmpty() || callerName == callerNum) {
                                    callerName = PBXNetworkService.resolveContactName(apiOrigin, tenantId, ext, callerNum)
                                }
                                val disp = if (callerName.isNotEmpty() && callerName != callerNum) "$callerName ($callerNum)" else callerNum
                                val qName = item.optString("queue_name", "").trim()
                                val bodyTxt = if (qName.isNotEmpty()) {
                                    "$qName kuyruğunda kayıp çağrı. Geri dönüş yapmak için dokunun."
                                } else {
                                    "Kuyrukta bekleyen kayıp çağrı. Geri dönüş yapmak için dokunun."
                                }
                                postSystemAlertNotification(
                                    title = "$disp - Kayıp Çağrı",
                                    body = bodyTxt,
                                    subTab = "missed"
                                )
                            }
                        }
                    }
                }

                // 3) Poll voicemail (Sesli Posta)
                val vmBody = openInsecureHttpGet(
                    "$apiOrigin/api/agent/voicemail?extension=$ext",
                    tenantId,
                    ext
                )
                if (!vmBody.isNullOrEmpty()) {
                    val arr = JSONArray(vmBody)
                    if (!seededVoicemailIds) {
                        for (i in 0 until arr.length()) {
                            val item = arr.optJSONObject(i) ?: continue
                            val id = item.opt("id")?.toString() ?: item.optString("filename", "")
                            if (id.isNotEmpty()) seenVoicemailIds.add(id)
                        }
                        seededVoicemailIds = true
                    } else {
                        for (i in 0 until arr.length()) {
                            val item = arr.optJSONObject(i) ?: continue
                            val id = item.opt("id")?.toString() ?: item.optString("filename", "")
                            if (id.isEmpty() || seenVoicemailIds.contains(id)) continue
                            seenVoicemailIds.add(id)
                            if (item.optBoolean("is_read", false)) continue
                            if (shouldPostFromService) {
                                val callerNum = item.optString("caller_number", "")
                                    .ifEmpty { item.optString("caller_id", "") }
                                    .ifEmpty { item.optString("caller", "") }
                                    .ifEmpty { "Bilinmeyen Numara" }
                                var callerName = item.optString("caller_name", "")
                                    .ifEmpty { item.optString("contact_name", "") }
                                if (callerName.isEmpty() || callerName == callerNum) {
                                    callerName = PBXNetworkService.resolveContactName(apiOrigin, tenantId, ext, callerNum)
                                }
                                val disp = if (callerName.isNotEmpty() && callerName != callerNum) "$callerName ($callerNum)" else callerNum
                                val dur = item.optInt("duration", 0)
                                val durTxt = if (dur > 0) " ($dur sn)" else ""
                                postSystemAlertNotification(
                                    title = "$disp - Yeni Sesli Posta",
                                    body = "Yeni bir sesli mesaj bırakıldı$durTxt. Dinlemek için dokunun.",
                                    subTab = "voicemail"
                                )
                            }
                        }
                    }
                }
            } catch (_: Exception) {}
            delay(4500L)
        }
    }

    private fun md5Hex(input: String): String {
        val md = MessageDigest.getInstance("MD5")
        return md.digest(input.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }

    private fun computeDigestAuth(
        user: String,
        pass: String,
        realm: String,
        nonce: String,
        method: String,
        uri: String,
        qop: String?
    ): String {
        val ha1 = md5Hex("$user:$realm:$pass")
        val ha2 = md5Hex("$method:$uri")
        val nc = "00000001"
        val cnonce = "runa1234"
        return if (qop != null) {
            val resp = md5Hex("$ha1:$nonce:$nc:$cnonce:$qop:$ha2")
            "Digest username=\"$user\", realm=\"$realm\", nonce=\"$nonce\", uri=\"$uri\", response=\"$resp\", algorithm=MD5, qop=$qop, nc=$nc, cnonce=\"$cnonce\""
        } else {
            val resp = md5Hex("$ha1:$nonce:$ha2")
            "Digest username=\"$user\", realm=\"$realm\", nonce=\"$nonce\", uri=\"$uri\", response=\"$resp\", algorithm=MD5"
        }
    }

    private fun sendWsTextFrame(out: OutputStream, text: String, rng: Random) {
        val payload = text.toByteArray(Charsets.UTF_8)
        val mask = ByteArray(4).also { rng.nextBytes(it) }
        val len = payload.size
        val header = mutableListOf<Byte>(0x81.toByte())
        when {
            len < 126 -> header.add((0x80 or len).toByte())
            len < 65536 -> {
                header.add((0x80 or 126).toByte())
                header.add(((len shr 8) and 0xFF).toByte())
                header.add((len and 0xFF).toByte())
            }
            else -> {
                header.add((0x80 or 127).toByte())
                for (s in 56 downTo 0 step 8) {
                    header.add(((len.toLong() shr s) and 0xFF).toByte())
                }
            }
        }
        header.addAll(mask.toList())
        val masked = ByteArray(len) { i -> (payload[i].toInt() xor mask[i % 4].toInt()).toByte() }
        synchronized(out) {
            out.write(header.toByteArray())
            out.write(masked)
            out.flush()
        }
    }

    private fun recvWsFrame(inp: InputStream, out: OutputStream, rng: Random): String? {
        val b1 = inp.read()
        val b2 = inp.read()
        if (b1 == -1 || b2 == -1) return null
        val opcode = b1 and 0x0F
        val masked = (b2 and 0x80) != 0
        var length = b2 and 0x7F
        if (length == 126) {
            length = ((inp.read() and 0xFF) shl 8) or (inp.read() and 0xFF)
        } else if (length == 127) {
            var l = 0L
            repeat(8) { l = (l shl 8) or (inp.read().toLong() and 0xFF) }
            length = l.toInt()
        }
        val maskKey = if (masked) ByteArray(4) { inp.read().toByte() } else null
        val data = ByteArray(length)
        var readTotal = 0
        while (readTotal < length) {
            val r = inp.read(data, readTotal, length - readTotal)
            if (r == -1) return null
            readTotal += r
        }
        if (masked && maskKey != null) {
            for (i in 0 until length) {
                data[i] = (data[i].toInt() xor maskKey[i % 4].toInt()).toByte()
            }
        }
        if (opcode == 0x8) return null
        if (opcode == 0x9) {
            // Reply Pong
            val mask = ByteArray(4).also { rng.nextBytes(it) }
            val pongHdr = byteArrayOf(0x8A.toByte(), (0x80 or minOf(length, 125)).toByte()) + mask
            synchronized(out) {
                out.write(pongHdr)
                out.flush()
            }
            return ""
        }
        return if (opcode == 0x1 || opcode == 0x2) String(data, Charsets.UTF_8) else ""
    }

    companion object {
        private const val CHANNEL_ID_STANDING = "runa_voip_standing"
        private const val CHANNEL_ID_INCOMING_CALL = "runa_voip_incoming"
        private const val CHANNEL_ID_ALERTS = "runa_voip_alerts"
        private const val NOTIF_ID_FOREGROUND = 9001
        private const val NOTIF_ID_INCOMING_CALL = 9002

        const val ACTION_ANSWER_CALL = "com.runa.mobile.ACTION_ANSWER_CALL"
        const val ACTION_REJECT_CALL = "com.runa.mobile.ACTION_REJECT_CALL"
        const val ACTION_STOP_SERVICE = "com.runa.mobile.ACTION_STOP_SERVICE"

        @Volatile
        var instance: RunaVoipForegroundService? = null

        fun startService(context: Context) {
            val intent = Intent(context, RunaVoipForegroundService::class.java)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (_: Exception) {}
        }
    }
}
