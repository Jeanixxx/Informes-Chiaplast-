package mx.chiaplast.mantenimiento

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONObject
import java.time.LocalDateTime
import java.time.ZoneId

object ReminderScheduler {
    private const val PREFS = "chiaplast_native_reminders"

    fun schedule(context: Context, item: JSONObject, atMillis: Long) {
        val id = item.getString("id")
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(id, item.toString()).apply()
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pending = pendingIntent(context, id, item.optString("title", "Recordatorio"), item.optString("machine", ""))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pending)
        else alarm.setExact(AlarmManager.RTC_WAKEUP, atMillis, pending)
    }

    fun cancel(context: Context, id: String) {
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarm.cancel(pendingIntent(context, id, "", ""))
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(id).apply()
    }

    fun rescheduleAll(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.all.toMap().forEach { (id, raw) ->
            try {
                val item = JSONObject(raw as String)
                val atMillis = LocalDateTime.parse(item.getString("when"))
                    .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                if (atMillis > System.currentTimeMillis() && item.optString("status", "pending") != "done") {
                    schedule(context, item, atMillis)
                } else if (atMillis <= System.currentTimeMillis()) {
                    prefs.edit().remove(id).apply()
                }
            } catch (_: Exception) { prefs.edit().remove(id).apply() }
        }
    }

    private fun pendingIntent(context: Context, id: String, title: String, machine: String): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java)
            .putExtra("id", id).putExtra("title", title).putExtra("machine", machine)
        return PendingIntent.getBroadcast(
            context, id.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
