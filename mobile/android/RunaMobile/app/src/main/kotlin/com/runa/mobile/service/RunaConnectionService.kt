package com.runa.mobile.service

import android.net.Uri
import android.os.Build
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager

class RunaConnectionService : ConnectionService() {

    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ): Connection {
        val callerNum = request?.extras?.getString("caller_number") ?: "Bilinmeyen Numara"
        val callerName = request?.extras?.getString("caller_name") ?: callerNum

        val conn = object : Connection() {
            override fun onAnswer() {
                setActive()
                RunaVoipForegroundService.instance?.answerIncomingCallFromSystem()
            }

            override fun onReject() {
                setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
                destroy()
                RunaVoipForegroundService.instance?.rejectOrHangupCallFromSystem()
            }

            override fun onDisconnect() {
                setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
                destroy()
                RunaVoipForegroundService.instance?.rejectOrHangupCallFromSystem()
            }

            override fun onHold() {
                setOnHold()
                RunaVoipForegroundService.instance?.toggleHoldFromSystem(true)
            }

            override fun onUnhold() {
                setActive()
                RunaVoipForegroundService.instance?.toggleHoldFromSystem(false)
            }
        }

        conn.setAddress(Uri.fromParts("sip", callerNum, null), TelecomManager.PRESENTATION_ALLOWED)
        conn.setCallerDisplayName(callerName, TelecomManager.PRESENTATION_ALLOWED)
        conn.connectionCapabilities =
            Connection.CAPABILITY_HOLD or Connection.CAPABILITY_SUPPORT_HOLD or Connection.CAPABILITY_MUTE
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            conn.connectionProperties = Connection.PROPERTY_SELF_MANAGED
        }
        conn.setRinging()
        activeConnection = conn
        return conn
    }

    companion object {
        @Volatile
        var activeConnection: Connection? = null
    }
}
