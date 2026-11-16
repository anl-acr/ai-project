package com.runa.mobile.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.runa.mobile.R
import com.runa.mobile.model.AppConfigStore
import com.runa.mobile.model.Pending2FAContext
import com.runa.mobile.service.LoginOutcome
import com.runa.mobile.service.PBXNetworkService
import kotlinx.coroutines.launch

private val RainbowColors = listOf(
    Color(0xFF16A34A),
    Color(0xFF0284C7),
    Color(0xFF7C3AED),
    Color(0xFFDB2777),
    Color(0xFFEA580C)
)

private val IndigoStart = Color(0xFF4F46E5)
private val PurpleMid = Color(0xFF9333EA)
private val VioletEnd = Color(0xFF7C3AED)

@Composable
fun LoginScreen(
    store: AppConfigStore,
    onLoginSuccess: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val savedHost by store.serverHost.collectAsState()
    val savedUser by store.savedUsername.collectAsState()
    val savedRemember by store.rememberMe.collectAsState()
    val recentHosts by store.recentHosts.collectAsState()

    var hostInput by remember { mutableStateOf(savedHost) }
    var usernameInput by remember { mutableStateOf(savedUser) }
    var passwordInput by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var rememberMe by remember { mutableStateOf(savedRemember) }

    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }

    var pending2FA by remember { mutableStateOf<Pending2FAContext?>(null) }
    var otpCodeInput by remember { mutableStateOf("") }
    var showQrDialog by remember { mutableStateOf(false) }
    var qrUrlInput by remember { mutableStateOf("") }

    LaunchedEffect(savedHost, savedUser) {
        if (hostInput.isEmpty() && savedHost.isNotEmpty()) hostInput = savedHost
        if (usernameInput.isEmpty() && savedUser.isNotEmpty()) usernameInput = savedUser
    }

    suspend fun performCredentialsLogin() {
        errorMessage = ""
        isLoading = true
        try {
            when (val outcome = PBXNetworkService.loginWithCredentials(hostInput, usernameInput, passwordInput, rememberMe)) {
                is LoginOutcome.Authenticated -> {
                    store.recordLoginSuccess(
                        displayHost = outcome.resolved.displayHost,
                        apiOrigin = outcome.resolved.apiOrigin,
                        uiOrigin = outcome.resolved.uiOrigin,
                        rememberMe = rememberMe,
                        savedUsername = usernameInput.trim(),
                        session = outcome.session
                    )
                    onLoginSuccess()
                }
                is LoginOutcome.Requires2FA -> {
                    pending2FA = outcome.context
                    if (outcome.context.method == "email" || outcome.context.method == "whatsapp") {
                        runCatching {
                            PBXNetworkService.send2FACode(
                                outcome.context.apiOrigin,
                                outcome.context.userId,
                                outcome.context.method
                            )
                        }
                    }
                }
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Giriş sırasında hata oluştu."
        } finally {
            isLoading = false
        }
    }

    suspend fun performMagicOrQrLogin(payload: String) {
        errorMessage = ""
        isLoading = true
        try {
            val outcome = PBXNetworkService.loginWithMagicUrl(
                rawUrlOrToken = payload,
                fallbackHost = hostInput.ifEmpty { savedHost },
                rememberMe = rememberMe
            )
            if (outcome is LoginOutcome.Authenticated) {
                store.recordLoginSuccess(
                    displayHost = outcome.resolved.displayHost,
                    apiOrigin = outcome.resolved.apiOrigin,
                    uiOrigin = outcome.resolved.uiOrigin,
                    rememberMe = rememberMe,
                    savedUsername = outcome.session.username,
                    session = outcome.session
                )
                onLoginSuccess()
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "QR / Kolay Giriş doğrulanamadı."
        } finally {
            isLoading = false
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC)),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .size(280.dp)
                .offset(x = (-120).dp, y = (-240).dp)
                .blur(75.dp)
                .background(Color(0xFF16A34A).copy(alpha = 0.12f), CircleShape)
        )
        Box(
            modifier = Modifier
                .size(280.dp)
                .offset(x = 120.dp, y = (-200).dp)
                .blur(75.dp)
                .background(Color(0xFF0284C7).copy(alpha = 0.12f), CircleShape)
        )
        Box(
            modifier = Modifier
                .size(300.dp)
                .offset(x = (-90).dp, y = 240.dp)
                .blur(80.dp)
                .background(Color(0xFF7C3AED).copy(alpha = 0.12f), CircleShape)
        )
        Box(
            modifier = Modifier
                .size(260.dp)
                .offset(x = 120.dp, y = 220.dp)
                .blur(75.dp)
                .background(Color(0xFFEA580C).copy(alpha = 0.11f), CircleShape)
        )

        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val midY = size.height * 0.50f
            val brush = Brush.horizontalGradient(RainbowColors)

            val path1 = Path().apply {
                moveTo(0f, midY)
                quadraticTo(w * 0.25f, midY - 160f, w * 0.5f, midY)
                quadraticTo(w * 0.75f, midY + 160f, w, midY)
            }
            drawPath(
                path = path1,
                brush = brush,
                alpha = 0.26f,
                style = Stroke(width = 6f, cap = StrokeCap.Round)
            )

            val path2 = Path().apply {
                moveTo(0f, midY)
                quadraticTo(w * 0.25f, midY + 160f, w * 0.5f, midY)
                quadraticTo(w * 0.75f, midY - 160f, w, midY)
            }
            drawPath(
                path = path2,
                brush = brush,
                alpha = 0.22f,
                style = Stroke(
                    width = 4f,
                    cap = StrokeCap.Round,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(16f, 16f), 0f)
                )
            )
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 440.dp)
                    .shadow(
                        elevation = 24.dp,
                        shape = RoundedCornerShape(30.dp),
                        spotColor = IndigoStart.copy(alpha = 0.22f)
                    )
                    .clip(RoundedCornerShape(30.dp))
                    .background(Color.White)
                    .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(30.dp))
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(7.dp)
                            .background(Brush.horizontalGradient(RainbowColors))
                    )

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp, vertical = 26.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .shadow(10.dp, RoundedCornerShape(16.dp))
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color.White)
                                .border(3.5.dp, Color(0xFFF1F5F9), RoundedCornerShape(16.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Image(
                                painter = painterResource(id = R.drawable.runa_logo),
                                contentDescription = "Runa Logo",
                                modifier = Modifier.fillMaxSize()
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = "Runa",
                            style = TextStyle(
                                brush = Brush.horizontalGradient(RainbowColors),
                                fontSize = 30.sp,
                                fontWeight = FontWeight.Black
                            )
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        Text(
                            text = "Mobil Temsilci Çağrı Paneli",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 2.sp,
                            color = Color(0xFF78879D)
                        )

                        Spacer(modifier = Modifier.height(22.dp))

                        if (errorMessage.isNotEmpty()) {
                            Surface(
                                color = Color(0xFFFFF1F2),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .border(1.dp, Color(0xFFFECDD3), RoundedCornerShape(12.dp))
                                    .padding(bottom = 14.dp)
                            ) {
                                Text(
                                    text = errorMessage,
                                    color = Color(0xFFBE123C),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(12.dp)
                                )
                            }
                        }

                        val ctx2FA = pending2FA
                        if (ctx2FA != null) {
                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                Text(
                                    text = "6 Haneli Güvenlik Kodu",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color(0xFF0F172A)
                                )
                                OutlinedTextField(
                                    value = otpCodeInput,
                                    onValueChange = { if (it.length <= 6) otpCodeInput = it.filter(Char::isDigit) },
                                    placeholder = { Text("000000") },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(15.dp)
                                )
                                GradientSubmitButton(
                                    text = if (isLoading) "Doğrulanıyor..." else "Kodu Doğrula ve Giriş Yap",
                                    enabled = !isLoading,
                                    onClick = {
                                        scope.launch {
                                            isLoading = true
                                            errorMessage = ""
                                            try {
                                                val sess = PBXNetworkService.verify2FACode(ctx2FA, otpCodeInput)
                                                store.recordLoginSuccess(
                                                    displayHost = ctx2FA.displayHost,
                                                    apiOrigin = ctx2FA.apiOrigin,
                                                    uiOrigin = ctx2FA.uiOrigin,
                                                    rememberMe = ctx2FA.rememberMe,
                                                    savedUsername = ctx2FA.username,
                                                    session = sess
                                                )
                                                pending2FA = null
                                                onLoginSuccess()
                                            } catch (e: Exception) {
                                                errorMessage = e.message ?: "Doğrulama başarısız."
                                            } finally {
                                                isLoading = false
                                            }
                                        }
                                    }
                                )
                                TextButton(onClick = { pending2FA = null }) {
                                    Text("← Geri Dön", color = Color(0xFF64748B), fontWeight = FontWeight.Bold)
                                }
                            }
                        } else {
                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(13.dp)
                            ) {
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    IconInputField(
                                        value = hostInput,
                                        onValueChange = { hostInput = it },
                                        placeholder = "Sunucu Adresi (Örn: aida.saphira.com.tr)",
                                        leadingIcon = Icons.Default.Language,
                                        keyboardType = KeyboardType.Uri
                                    )

                                    if (recentHosts.isNotEmpty()) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .horizontalScroll(rememberScrollState()),
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            recentHosts.forEach { h ->
                                                Row(
                                                    modifier = Modifier
                                                        .clip(CircleShape)
                                                        .background(Color(0xFFF1F5F9))
                                                        .border(1.dp, Color(0xFFE2E8F0), CircleShape)
                                                        .clickable { hostInput = h }
                                                        .padding(horizontal = 10.dp, vertical = 5.dp),
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                ) {
                                                    Text(
                                                        text = h,
                                                        fontSize = 11.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color(0xFF0F172A)
                                                    )
                                                    Icon(
                                                        imageVector = Icons.Default.Close,
                                                        contentDescription = "Kaldır",
                                                        tint = Color(0xFF78879D),
                                                        modifier = Modifier
                                                            .size(12.dp)
                                                            .clickable { store.removeRecentHost(h) }
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }

                                IconInputField(
                                    value = usernameInput,
                                    onValueChange = { usernameInput = it },
                                    placeholder = "Kullanıcı Adı, E-Posta veya Dahili",
                                    leadingIcon = Icons.Default.PersonOutline,
                                    keyboardType = KeyboardType.Email
                                )

                                IconInputField(
                                    value = passwordInput,
                                    onValueChange = { passwordInput = it },
                                    placeholder = "••••••••••",
                                    leadingIcon = Icons.Default.Lock,
                                    keyboardType = KeyboardType.Password,
                                    isPassword = !showPassword,
                                    trailingContent = {
                                        IconButton(
                                            onClick = { showPassword = !showPassword },
                                            modifier = Modifier.size(28.dp)
                                        ) {
                                            Icon(
                                                imageVector = if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                                contentDescription = "Şifreyi Göster",
                                                tint = Color(0xFF78879D),
                                                modifier = Modifier.size(18.dp)
                                            )
                                        }
                                    }
                                )

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { rememberMe = !rememberMe }
                                        .padding(vertical = 2.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        imageVector = if (rememberMe) Icons.Default.CheckBox else Icons.Default.CheckBoxOutlineBlank,
                                        contentDescription = null,
                                        tint = if (rememberMe) Color(0xFF6366F1) else Color(0xFF94A3B8),
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Text(
                                        text = "Beni hatırla",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xFF0F172A)
                                    )
                                }

                                GradientSubmitButton(
                                    text = if (isLoading) "Giriş Yapılıyor..." else "Giriş Yap",
                                    enabled = !isLoading,
                                    onClick = { scope.launch { performCredentialsLogin() } }
                                )
                            }
                        }
                    }
                }

                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 22.dp, end = 20.dp)
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFF7F9FC))
                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                        .clickable { showQrDialog = true },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.QrCodeScanner,
                        contentDescription = "QR Kod ile Giriş",
                        tint = Color(0xFF64748B),
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            Text(
                text = "© 2026 RUNA. Tüm hakları saklıdır.",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF78879D).copy(alpha = 0.85f),
                textAlign = TextAlign.Center
            )
        }
    }

    if (showQrDialog) {
        Dialog(onDismissRequest = { showQrDialog = false }) {
            Surface(
                shape = RoundedCornerShape(24.dp),
                color = Color.White,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(22.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "QR / Kolay Giriş Bağlantısı",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color(0xFF0F172A)
                        )
                        IconButton(onClick = { showQrDialog = false }) {
                            Icon(Icons.Default.Close, contentDescription = "Kapat")
                        }
                    }
                    Text(
                        text = "Web panelindeki Kolay Giriş URL'ini veya QR kod içeriğini buraya yapıştırarak şifresiz bağlanabilirsiniz:",
                        fontSize = 12.sp,
                        color = Color(0xFF64748B)
                    )
                    IconInputField(
                        value = qrUrlInput,
                        onValueChange = { qrUrlInput = it },
                        placeholder = "Kolay Giriş URL'ini yapıştırın...",
                        leadingIcon = Icons.Default.Link,
                        keyboardType = KeyboardType.Uri
                    )
                    GradientSubmitButton(
                        text = "Otomatik Bağlan",
                        enabled = qrUrlInput.isNotBlank() && !isLoading,
                        onClick = {
                            val target = qrUrlInput
                            showQrDialog = false
                            scope.launch { performMagicOrQrLogin(target) }
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun IconInputField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    leadingIcon: androidx.compose.ui.graphics.vector.ImageVector,
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false,
    trailingContent: (@Composable () -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(15.dp))
            .background(Color(0xFFF8FAFC))
            .border(1.dp, Color(0xFFCBD5E1).copy(alpha = 0.75f), RoundedCornerShape(15.dp))
            .padding(horizontal = 14.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp)
    ) {
        Icon(
            imageVector = leadingIcon,
            contentDescription = null,
            tint = Color(0xFF78879D).copy(alpha = 0.85f),
            modifier = Modifier.size(18.dp)
        )

        Box(modifier = Modifier.weight(1f)) {
            if (value.isEmpty()) {
                Text(
                    text = placeholder,
                    color = Color(0xFF94A3B8),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = TextStyle(
                    color = Color(0xFF0F172A),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    fontFamily = FontFamily.Default
                ),
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
                cursorBrush = SolidColor(IndigoStart),
                modifier = Modifier.fillMaxWidth()
            )
        }

        if (trailingContent != null) {
            trailingContent()
        }
    }
}

@Composable
private fun GradientSubmitButton(
    text: String,
    enabled: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(14.dp, RoundedCornerShape(14.dp), spotColor = IndigoStart.copy(alpha = 0.35f))
            .clip(RoundedCornerShape(14.dp))
            .background(
                Brush.horizontalGradient(listOf(IndigoStart, PurpleMid, VioletEnd))
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = text,
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}
