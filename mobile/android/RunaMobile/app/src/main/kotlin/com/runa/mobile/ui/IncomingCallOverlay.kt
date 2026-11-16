package com.runa.mobile.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runa.mobile.R
import com.runa.mobile.model.AppConfigStore
import com.runa.mobile.service.RunaVoipForegroundService

@Composable
fun IncomingCallOverlay(
    store: AppConfigStore,
    onOpenInAppPBXControls: () -> Unit
) {
    val liveState by store.liveState.collectAsState()
    var showKeypad by remember { mutableStateOf(false) }
    var dtmfDigits by remember { mutableStateOf("") }

    val callerNumber = liveState.incomingCallerNumber.ifEmpty { "Bilinmeyen Numara" }
    val callerName = liveState.incomingCallerName.ifEmpty { callerNumber }
    val hasDistinctName = callerName.isNotEmpty() && callerName != callerNumber
    val isRinging = liveState.callStatus == "Ringing"

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF0A0F1D).copy(alpha = 0.96f),
                        Color(0xFF050811).copy(alpha = 0.98f)
                    )
                )
            )
            .padding(horizontal = 28.dp, vertical = 48.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Top Caller Identity Block
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(top = 24.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.runa_logo),
                        contentDescription = "Runa",
                        modifier = Modifier
                            .size(20.dp)
                            .clip(RoundedCornerShape(5.dp))
                    )
                    Text(
                        text = if (isRinging) "Runa Sesli Arama..." else formatDuration(liveState.callDurationSeconds),
                        color = Color.White.copy(alpha = 0.72f),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = if (hasDistinctName) callerName else callerNumber,
                    color = Color.White,
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center
                )

                if (hasDistinctName) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = callerNumber,
                        color = Color.White.copy(alpha = 0.70f),
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Medium,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            // Middle Section: Active Call 6-Button Grid or Keypad
            if (!isRinging) {
                if (showKeypad) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Text(
                            text = dtmfDigits.ifEmpty { " " },
                            color = Color.White,
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        val rows = listOf(
                            listOf("1", "2", "3"),
                            listOf("4", "5", "6"),
                            listOf("7", "8", "9"),
                            listOf("*", "0", "#")
                        )
                        rows.forEach { row ->
                            Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                                row.forEach { d ->
                                    Box(
                                        modifier = Modifier
                                            .size(68.dp)
                                            .clip(CircleShape)
                                            .background(Color.White.copy(alpha = 0.14f))
                                            .clickable {
                                                dtmfDigits += d
                                                RunaVoipForegroundService.instance?.sendDtmfFromSystem(d)
                                            },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = d,
                                            color = Color.White,
                                            fontSize = 26.sp,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                }
                            }
                        }
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(22.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            CallControlCircle(
                                icon = if (liveState.isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                                label = "sessiz",
                                active = liveState.isMuted,
                                onClick = { RunaVoipForegroundService.instance?.toggleMuteFromSystem() }
                            )
                            CallControlCircle(
                                icon = Icons.Default.Dialpad,
                                label = "tuş takımı",
                                active = showKeypad,
                                onClick = { showKeypad = true }
                            )
                            CallControlCircle(
                                icon = Icons.Default.VolumeUp,
                                label = "ses",
                                active = liveState.isSpeakerOn,
                                onClick = { RunaVoipForegroundService.instance?.toggleSpeakerFromSystem() }
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            CallControlCircle(
                                icon = Icons.Default.PersonAdd,
                                label = "çağrı ekle",
                                active = false,
                                onClick = onOpenInAppPBXControls
                            )
                            CallControlCircle(
                                icon = if (liveState.isOnHold) Icons.Default.PlayArrow else Icons.Default.Pause,
                                label = if (liveState.isOnHold) "devam et" else "beklet",
                                active = liveState.isOnHold,
                                onClick = { RunaVoipForegroundService.instance?.toggleHoldFromSystem() }
                            )
                            CallControlCircle(
                                icon = Icons.Default.SwapCalls,
                                label = "santral",
                                active = false,
                                onClick = onOpenInAppPBXControls
                            )
                        }
                    }
                }
            } else {
                Spacer(modifier = Modifier.height(40.dp))
            }

            // Bottom Action Bar (Red/Green Answer-Reject or Red Hangup)
            if (isRinging) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(74.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFFF3B30))
                                .clickable { RunaVoipForegroundService.instance?.rejectOrHangupCallFromSystem() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.CallEnd,
                                contentDescription = "Reddet",
                                tint = Color.White,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Reddet", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                    }

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(74.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF34C759))
                                .clickable { RunaVoipForegroundService.instance?.answerIncomingCallFromSystem() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Call,
                                contentDescription = "Cevapla",
                                tint = Color.White,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Kabul Et", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                    }
                }
            } else {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(74.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFFF3B30))
                            .clickable { RunaVoipForegroundService.instance?.rejectOrHangupCallFromSystem() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.CallEnd,
                            contentDescription = "Kapat",
                            tint = Color.White,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CallControlCircle(
    icon: ImageVector,
    label: String,
    active: Boolean,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(CircleShape)
                .background(if (active) Color.White else Color.White.copy(alpha = 0.14f))
                .border(0.8.dp, Color.White.copy(alpha = 0.18f), CircleShape)
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = if (active) Color(0xFF0F172A) else Color.White,
                modifier = Modifier.size(28.dp)
            )
        }
        Text(
            text = label,
            color = Color.White.copy(alpha = 0.90f),
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

private fun formatDuration(totalSecs: Int): String {
    val m = (totalSecs / 60).toString().padStart(2, '0')
    val s = (totalSecs % 60).toString().padStart(2, '0')
    return "$m:$s"
}
