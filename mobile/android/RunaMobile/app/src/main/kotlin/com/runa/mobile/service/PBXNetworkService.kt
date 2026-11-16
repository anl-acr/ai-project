package com.runa.mobile.service

import com.runa.mobile.model.AgentSessionModel
import com.runa.mobile.model.Pending2FAContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLEncoder
import java.security.SecureRandom
import java.security.cert.X509Certificate
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

data class ResolvedHostConfig(
    val displayHost: String,
    val apiOrigin: String,
    val uiOrigin: String,
    val version: String,
    val environment: String
)

sealed class LoginOutcome {
    data class Authenticated(
        val session: AgentSessionModel,
        val resolved: ResolvedHostConfig
    ) : LoginOutcome()

    data class Requires2FA(val context: Pending2FAContext) : LoginOutcome()
}

object PBXNetworkService {

    private val trustAllCerts = arrayOf<TrustManager>(object : X509TrustManager {
        override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
        override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
        override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
    })

    private fun openConnection(urlStr: String, method: String = "GET", timeoutMs: Int = 7000): HttpURLConnection {
        val url = URL(urlStr)
        val conn = url.openConnection() as HttpURLConnection
        if (conn is HttpsURLConnection) {
            try {
                val sc = SSLContext.getInstance("TLS")
                sc.init(null, trustAllCerts, SecureRandom())
                conn.sslSocketFactory = sc.socketFactory
                conn.hostnameVerifier = HostnameVerifier { _, _ -> true }
            } catch (_: Exception) {}
        }
        conn.requestMethod = method
        conn.connectTimeout = timeoutMs
        conn.readTimeout = timeoutMs
        conn.setRequestProperty("User-Agent", "Runa-Android/2.9.3")
        return conn
    }

    private fun readResponse(conn: HttpURLConnection): Pair<Int, String> {
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else (conn.errorStream ?: conn.inputStream)
        val text = BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() }
        return code to text
    }

    suspend fun resolveAndProbeHost(rawHost: String): ResolvedHostConfig = withContext(Dispatchers.IO) {
        var raw = rawHost.trim()
        if (raw.isEmpty()) throw IllegalArgumentException("Lütfen sunucu adresini (Host / IP) giriniz.")

        raw = raw.replace(Regex("/+(login|agent-desktop|api.*)?$", RegexOption.IGNORE_CASE), "")
        val hasExplicitProtocol = raw.startsWith("http://", true) || raw.startsWith("https://", true)
        var cleanHostPart = raw.replace(Regex("^https?://", RegexOption.IGNORE_CASE), "").trimEnd('/')
        if (cleanHostPart.isEmpty()) throw IllegalArgumentException("Geçersiz sunucu adresi.")

        if (cleanHostPart.equals("runa.saphira.com.tr", ignoreCase = true)) {
            cleanHostPart = "aida.saphira.com.tr"
            raw = raw.replace(Regex("runa\\.saphira\\.com\\.tr", RegexOption.IGNORE_CASE), "aida.saphira.com.tr")
        }

        val isLocal = cleanHostPart.startsWith("localhost") ||
                cleanHostPart.startsWith("127.0.0.1") ||
                cleanHostPart.startsWith("192.168.") ||
                cleanHostPart.startsWith("10.")

        val candidates = mutableListOf<String>()
        if (hasExplicitProtocol) {
            candidates.add(raw)
        } else if (isLocal) {
            candidates.add("http://$cleanHostPart")
            candidates.add("https://$cleanHostPart")
            if (!cleanHostPart.contains(":")) {
                candidates.add("http://$cleanHostPart:3000")
                candidates.add("http://$cleanHostPart:8000")
            }
        } else {
            candidates.add("https://$cleanHostPart")
            candidates.add("http://$cleanHostPart")
            if (!cleanHostPart.contains(":")) {
                candidates.add("https://$cleanHostPart:8000")
                candidates.add("http://$cleanHostPart:8000")
                candidates.add("http://$cleanHostPart:3000")
            }
        }

        var matchedApiOrigin = ""
        var versionStr = "Aktif"
        var envStr = "On-Premise"

        for (base in candidates) {
            try {
                val conn = openConnection("$base/api/settings/version", "GET", 4500)
                val (code, body) = readResponse(conn)
                if (code in 200..299) {
                    val json = JSONObject(body)
                    val ver = json.optString("version", "")
                    if (ver.isNotEmpty()) {
                        matchedApiOrigin = base
                        versionStr = ver
                        envStr = json.optString("environment", "On-Premise")
                        break
                    }
                }
            } catch (_: Exception) {}
        }

        if (matchedApiOrigin.isEmpty()) {
            throw IllegalStateException("Belirtilen sunucuda Runa servisine ulaşılamadı. Adresi veya ağ bağlantınızı kontrol edin.")
        }

        var matchedUiOrigin = matchedApiOrigin
        try {
            val conn = openConnection("$matchedApiOrigin/?desktop=1&mobile=1", "GET", 4000)
            val ct = (conn.getHeaderField("Content-Type") ?: "").lowercase()
            val (_, body) = readResponse(conn)
            val isHtml = ct.contains("text/html") || body.contains("__NEXT_DATA__") || body.contains("<html")
            if (!isHtml) {
                val uri = URI(matchedApiOrigin)
                val hostOnly = uri.host ?: cleanHostPart
                val scheme = uri.scheme ?: "https"
                val uiFallbacks = listOf(
                    "$scheme://$hostOnly:3000",
                    "https://$hostOnly",
                    "http://$hostOnly"
                )
                for (cand in uiFallbacks) {
                    if (cand == matchedApiOrigin) continue
                    try {
                        val c2 = openConnection("$cand/?desktop=1&mobile=1", "GET", 3200)
                        val ct2 = (c2.getHeaderField("Content-Type") ?: "").lowercase()
                        val (code2, b2) = readResponse(c2)
                        if (code2 in 200..299 && (ct2.contains("text/html") || b2.contains("__NEXT_DATA__"))) {
                            matchedUiOrigin = cand
                            break
                        }
                    } catch (_: Exception) {}
                }
            }
        } catch (_: Exception) {}

        val displayHost = try {
            URI(matchedUiOrigin).authority ?: cleanHostPart
        } catch (_: Exception) {
            cleanHostPart
        }

        ResolvedHostConfig(
            displayHost = displayHost,
            apiOrigin = matchedApiOrigin,
            uiOrigin = matchedUiOrigin,
            version = versionStr,
            environment = envStr
        )
    }

    suspend fun loginWithCredentials(
        host: String,
        username: String,
        password: String,
        rememberMe: Boolean
    ): LoginOutcome = withContext(Dispatchers.IO) {
        val cleanUser = username.trim()
        if (cleanUser.isEmpty() || password.isEmpty()) {
            throw IllegalArgumentException("Kullanıcı adı ve şifre alanları zorunludur.")
        }

        val resolved = resolveAndProbeHost(host)
        val conn = openConnection("${resolved.apiOrigin}/api/auth/login", "POST", 8000)
        conn.setRequestProperty("Content-Type", "application/json")
        conn.doOutput = true

        val payload = JSONObject().apply {
            put("username", cleanUser)
            put("password", password)
            put("client_type", "mobile")
            put("device_name", "Runa Android")
        }
        conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }

        val (code, body) = readResponse(conn)
        val json = try { JSONObject(body) } catch (_: Exception) { JSONObject() }

        if (code !in 200..299 || json.optString("status") == "error") {
            val detail = json.optString("detail").ifEmpty { json.optString("message", "Kullanıcı adı veya şifre hatalı.") }
            throw IllegalStateException(detail)
        }

        val userObj = json.optJSONObject("user") ?: json
        val uid = userObj.opt("id")?.toString()?.takeIf { it.isNotEmpty() }
            ?: userObj.optString("extension").takeIf { it.isNotEmpty() }
            ?: cleanUser
        val ext = userObj.optString("extension", "1000")
        val fullName = userObj.optString("full_name").ifEmpty { userObj.optString("name", cleanUser) }
        val tenantId = userObj.optString("tenant_id", "tenant-default")

        if (json.optBoolean("requires_2fa", false) || userObj.optBoolean("two_factor_enabled", false)) {
            val method = json.optString("two_factor_method")
                .ifEmpty { userObj.optString("two_factor_method", "email") }
            return@withContext LoginOutcome.Requires2FA(
                Pending2FAContext(
                    apiOrigin = resolved.apiOrigin,
                    uiOrigin = resolved.uiOrigin,
                    displayHost = resolved.displayHost,
                    userId = uid,
                    sessionUserId = uid,
                    method = method,
                    email = userObj.optString("email", ""),
                    phone = userObj.optString("phone", ""),
                    fullName = fullName,
                    extensionNumber = ext,
                    tenantId = tenantId,
                    username = cleanUser,
                    rememberMe = rememberMe
                )
            )
        }

        LoginOutcome.Authenticated(
            session = AgentSessionModel(
                userId = uid,
                username = cleanUser,
                fullName = fullName,
                extensionNumber = ext,
                tenantId = tenantId
            ),
            resolved = resolved
        )
    }

    suspend fun loginWithMagicUrl(
        rawUrlOrToken: String,
        fallbackHost: String,
        rememberMe: Boolean
    ): LoginOutcome = withContext(Dispatchers.IO) {
        val trimmed = rawUrlOrToken.trim()
        if (trimmed.isEmpty()) throw IllegalArgumentException("Geçersiz Kolay Giriş / QR bağlantısı.")

        var hostCandidate = fallbackHost
        var tokenVal = trimmed

        if (trimmed.contains("://") || trimmed.contains("token=")) {
            try {
                val normalized = trimmed
                    .replace(Regex("^(runa-mobile|aida-mobile|runa|aida-agent)://", RegexOption.IGNORE_CASE), "https://")
                val uri = URI(normalized)
                if (!uri.host.isNullOrEmpty() && !uri.host.equals("login", true) && !uri.host.equals("auth", true)) {
                    val portPart = if (uri.port > 0) ":${uri.port}" else ""
                    hostCandidate = "${uri.host}$portPart"
                }
                val query = uri.rawQuery ?: ""
                for (pair in query.split("&")) {
                    val kv = pair.split("=", limit = 2)
                    if (kv.size == 2) {
                        val k = kv[0].lowercase()
                        val v = java.net.URLDecoder.decode(kv[1], "UTF-8")
                        if (k == "token" || k == "magic_token") tokenVal = v
                        if (k == "host" || k == "origin" || k == "server") hostCandidate = v
                    }
                }
            } catch (_: Exception) {}
        }

        val resolved = resolveAndProbeHost(hostCandidate)
        val conn = openConnection("${resolved.apiOrigin}/api/auth/app-magic-login", "POST", 8000)
        conn.setRequestProperty("Content-Type", "application/json")
        conn.doOutput = true

        val payload = JSONObject().apply {
            put("token", tokenVal)
            put("client_type", "mobile")
            put("device_name", "Runa Android")
        }
        conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }

        val (code, body) = readResponse(conn)
        val json = try { JSONObject(body) } catch (_: Exception) { JSONObject() }
        if (code !in 200..299) {
            val detail = json.optString("detail", "QR / Kolay Giriş bağlantısı doğrulanamadı veya süresi doldu.")
            throw IllegalStateException(detail)
        }

        val userObj = json.optJSONObject("user") ?: json
        val uid = userObj.opt("id")?.toString()?.takeIf { it.isNotEmpty() }
            ?: userObj.optString("extension", "1000")
        val ext = userObj.optString("extension", "1000")
        val fullName = userObj.optString("full_name").ifEmpty { userObj.optString("name", "Temsilci $ext") }
        val username = userObj.optString("email").ifEmpty { userObj.optString("username", ext) }
        val tenantId = userObj.optString("tenant_id", "tenant-default")

        LoginOutcome.Authenticated(
            session = AgentSessionModel(
                userId = uid,
                username = username,
                fullName = fullName,
                extensionNumber = ext,
                tenantId = tenantId
            ),
            resolved = resolved
        )
    }

    suspend fun send2FACode(apiOrigin: String, userId: String, method: String): String = withContext(Dispatchers.IO) {
        val conn = openConnection("$apiOrigin/api/auth/2fa/send", "POST", 7000)
        conn.setRequestProperty("Content-Type", "application/json")
        conn.doOutput = true
        val payload = JSONObject().apply {
            put("user_id", userId)
            put("method", method)
        }
        conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
        val (_, body) = readResponse(conn)
        val json = try { JSONObject(body) } catch (_: Exception) { JSONObject() }
        json.optString("message", "Doğrulama kodu gönderildi.")
    }

    suspend fun verify2FACode(context: Pending2FAContext, code: String): AgentSessionModel = withContext(Dispatchers.IO) {
        val conn = openConnection("${context.apiOrigin}/api/auth/2fa/verify", "POST", 7000)
        conn.setRequestProperty("Content-Type", "application/json")
        conn.doOutput = true
        val payload = JSONObject().apply {
            put("user_id", context.userId)
            put("code", code)
            put("method", context.method)
        }
        conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
        val (status, body) = readResponse(conn)
        val json = try { JSONObject(body) } catch (_: Exception) { JSONObject() }
        if (status !in 200..299 || json.optString("status") == "error") {
            throw IllegalStateException(json.optString("detail", "Doğrulama kodu geçersiz."))
        }
        AgentSessionModel(
            userId = context.sessionUserId,
            username = context.username,
            fullName = context.fullName,
            extensionNumber = context.extensionNumber,
            tenantId = context.tenantId
        )
    }

    suspend fun resolveContactName(apiOrigin: String, tenantId: String, extensionNumber: String, callerNumber: String): String =
        withContext(Dispatchers.IO) {
            val digits = callerNumber.replace(Regex("\\D+"), "")
            if (digits.length < 3) return@withContext ""
            val suffix10 = if (digits.length >= 10) digits.takeLast(10) else digits
            try {
                val conn = openConnection("$apiOrigin/api/contacts", "GET", 4000)
                conn.setRequestProperty("X-Tenant-ID", tenantId.ifEmpty { "tenant-default" })
                conn.setRequestProperty("X-User-Extension", extensionNumber.ifEmpty { "1000" })
                val (code, body) = readResponse(conn)
                if (code in 200..299) {
                    val arr = JSONArray(body)
                    for (i in 0 until arr.length()) {
                        val item = arr.optJSONObject(i) ?: continue
                        val pRaw = item.optString("phone_number").ifEmpty { item.optString("phone", "") }
                        val pDigits = pRaw.replace(Regex("\\D+"), "")
                        if (pDigits.isEmpty()) continue
                        if (pDigits == digits || (pDigits.length >= 10 && pDigits.takeLast(10) == suffix10)) {
                            val first = item.optString("first_name", "").trim()
                            val last = item.optString("last_name", "").trim()
                            val full = "$first $last".trim().ifEmpty { item.optString("name", "").trim() }
                            if (full.isNotEmpty()) return@withContext full
                        }
                    }
                }
            } catch (_: Exception) {}
            ""
        }

    suspend fun hangupActiveCallForExtension(apiOrigin: String, extensionNumber: String, callerNumber: String) =
        withContext(Dispatchers.IO) {
            try {
                val q = "extension=${URLEncoder.encode(extensionNumber, "UTF-8")}&caller=${URLEncoder.encode(callerNumber, "UTF-8")}"
                val conn = openConnection("$apiOrigin/api/webrtc/hangup_extension?$q", "POST", 4000)
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.outputStream.use { it.write("{}".toByteArray(Charsets.UTF_8)) }
                readResponse(conn)
            } catch (_: Exception) {}
        }
}
