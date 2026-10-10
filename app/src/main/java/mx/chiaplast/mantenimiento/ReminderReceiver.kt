package mx.chiaplast.mantenimiento

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra("id") ?: return
        val title = intent.getStringExtra("title") ?: "Recordatorio de mantenimiento"
        val machine = intent.getStringExtra("machine").orEmpty()
        val openApp = context.packageManager.getLaunchIntentForPackage(context.packageName)?.putExtra("open_reminder_id", id)
        val contentIntent = openApp?.let {
            PendingIntent.getActivity(context, id.hashCode(), it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }
        val text = if (machine.isBlank()) title else "$title · $machine"
        val notification = NotificationCompat.Builder(context, "chiaplast_reminders")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        context.getSystemService(NotificationManager::class.java).notify(id.hashCode(), notification)
    }
}
