package mx.chiaplast.mantenimiento

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.content.Intent
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private var pendingCameraFile: File? = null

    private val imagePicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) copyAndReturnEvidence(uri, "Imagen adjunta")
    }
    private val cameraCapture = registerForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val file = pendingCameraFile
        if (ok && file != null && file.exists() && file.length() > 0) returnEvidence(file, "Fotografía")
        else file?.delete()
        pendingCameraFile = null
    }
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannel()
        webView = WebView(this)
        setContentView(webView)
        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/evidence/", WebViewAssetLoader.InternalStoragePathHandler(this, File(filesDir, "evidence")))
            .build()
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: android.webkit.WebResourceRequest) =
                assetLoader.shouldInterceptRequest(request.url)

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                handleNotificationIntent(intent)
            }
        }
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(ChiaplastBridge(this), "ChiaplastNative")
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
        requestNotificationPermissionIfNeeded()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (::webView.isInitialized) handleNotificationIntent(intent)
    }

    private fun handleNotificationIntent(source: Intent?) {
        val id = source?.getStringExtra("open_reminder_id") ?: return
        source.removeExtra("open_reminder_id")
        webView.post {
            webView.evaluateJavascript("window.openReminderFromNotification && window.openReminderFromNotification(${JSONObject.quote(id)})", null)
        }
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarm = getSystemService(ALARM_SERVICE) as android.app.AlarmManager
            if (alarm.canScheduleExactAlarms()) {
                webView.post { webView.evaluateJavascript("window.syncNativeReminders && window.syncNativeReminders()", null) }
            }
        }
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        webView.evaluateJavascript("history.back()", null)
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = android.app.NotificationChannel(
                "chiaplast_reminders", "Recordatorios de mantenimiento",
                android.app.NotificationManager.IMPORTANCE_HIGH
            )
            channel.description = "Avisos locales de tareas y mantenimiento"
            getSystemService(android.app.NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    inner class ChiaplastBridge(private val context: Context) {
        @JavascriptInterface fun scheduleReminder(json: String): String {
            return try {
                val item = JSONObject(json)
                val id = item.getString("id")
                val dateTime = LocalDateTime.parse(item.getString("when"), DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                val atMillis = dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                if (atMillis <= System.currentTimeMillis()) return "error"
                val alarm = getSystemService(ALARM_SERVICE) as android.app.AlarmManager
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarm.canScheduleExactAlarms()) {
                    runOnUiThread { startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$packageName"))) }
                    return "permission_required"
                }
                ReminderScheduler.schedule(context, item, atMillis)
                "ok"
            } catch (_: Exception) { "error" }
        }

        @JavascriptInterface fun cancelReminder(id: String): String {
            ReminderScheduler.cancel(context, id)
            return "ok"
        }

        @JavascriptInterface fun shareReport(fileName: String, mime: String, base64: String): String {
            return try {
                val dir = File(cacheDir, "share_reports")
                if (!dir.exists()) dir.mkdirs()
                val safeName = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_").take(120)
                val file = File(dir, safeName.ifBlank { "reporte.xlsx" })
                val bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT)
                FileOutputStream(file).use { it.write(bytes) }
                val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", file)
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = mime.ifBlank { "application/octet-stream" }
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_TITLE, safeName)
                    clipData = android.content.ClipData.newUri(contentResolver, "Reporte Chiaplast", uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                runOnUiThread { startActivity(Intent.createChooser(send, "Guardar o compartir reporte")) }
                "ok"
            } catch (_: Exception) { "error" }
        }

        @JavascriptInterface fun takePhoto(reminderId: String): String {
            return try {
                val dir = File(filesDir, "evidence")
                if (!dir.exists()) dir.mkdirs()
                val file = File(dir, "evidence_${System.currentTimeMillis()}.jpg")
                pendingCameraFile = file
                val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", file)
                runOnUiThread { cameraCapture.launch(uri) }
                "ok"
            } catch (_: Exception) { "error" }
        }

        @JavascriptInterface fun pickPhoto(reminderId: String): String {
            runOnUiThread { imagePicker.launch(arrayOf("image/*")) }
            return "ok"
        }
    }

    private fun copyAndReturnEvidence(uri: Uri, fallbackName: String) {
        try {
            val dir = File(filesDir, "evidence")
            if (!dir.exists()) dir.mkdirs()
            val ext = contentResolver.getType(uri)?.substringAfterLast('/')?.let { ".$it" } ?: ".jpg"
            val file = File(dir, "evidence_${System.currentTimeMillis()}$ext")
            contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(file).use { output -> input.copyTo(output) }
            } ?: throw IllegalStateException("No se pudo leer la imagen")
            returnEvidence(file, fallbackName)
        } catch (_: Exception) {
            runOnUiThread { webView.evaluateJavascript("window.toast && window.toast('No se pudo guardar la imagen')", null) }
        }
    }

    private fun returnEvidence(file: File, fallbackName: String) {
        val webUri = "https://appassets.androidplatform.net/evidence/${Uri.encode(file.name)}"
        val data = JSONObject().put("uri", webUri).put("name", fallbackName).put("createdAt", System.currentTimeMillis())
        val js = "window.onEvidenceCaptured && window.onEvidenceCaptured(${JSONObject.quote(data.toString())})"
        runOnUiThread { webView.evaluateJavascript(js, null) }
    }
}
