# Chiaplast Mantenimiento — APK Android nativa

Proyecto Android Studio con Kotlin + WebView, sin Capacitor. La interfaz se toma directamente de `reportes-mtto (1).html` en cada compilación.

## Requisitos
- Android Studio estable y JDK 17.
- Android SDK 35.
- Android 12 o posterior para instalar y validar.

## Generar APK local
1. Descargar o clonar el repositorio y abrir su raíz en Android Studio.
2. Esperar la sincronización de Gradle. Si Android Studio solicita un Gradle local, usar Gradle 8.9.
3. Ejecutar la configuración `app`, o desde terminal ejecutar `gradle assembleDebug`.
4. La APK de depuración queda en `app/build/outputs/apk/debug/app-debug.apk`.

## Compilación automática
La acción de GitHub `Build Android APK` compila la aplicación y publica el APK de depuración como artefacto descargable en cada push/PR. El artefacto no es una versión firmada para distribución pública.

## Capacidades
- Formularios, borradores, recordatorios y Kanban locales en WebView.
- Alarmas exactas con `AlarmManager`, reprogramación tras reinicio y notificaciones locales.
- Cámara y selección de imágenes con almacenamiento privado local.
- Impresión de notas con fotografías mediante el diálogo nativo de Android (incluye Guardar como PDF).
- Exportación Excel/PDF mediante el diálogo nativo de compartir/guardar.
- Las notas y fotografías caducadas se eliminan cuando la app vuelve a ejecutarse; Android no ejecuta la limpieza de IndexedDB mientras el proceso está cerrado.

## Permisos y límites
Android 13+ solicita permiso de notificaciones. Android 12+ puede pedir autorización de alarmas exactas en Ajustes. Si el usuario la niega, no se puede garantizar puntualidad exacta. La optimización de batería del fabricante también puede afectar avisos. Validar en un dispositivo real antes de uso en planta.
