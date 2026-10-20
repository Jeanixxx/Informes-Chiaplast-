# Chiaplast Mantenimiento — APK Android nativa

Proyecto Android Studio con Kotlin + WebView, sin Capacitor. La interfaz se toma directamente de `reportes-mtto (1).html` en cada compilación. En tabletas, la pantalla principal ofrece un centro de control con navegación lateral, resumen operativo, acceso por área, Kanban, calendario, notas e historial; los formularios y acciones de mantenimiento existentes se conservan.

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

Para generar también un APK de release instalable como actualización, crea un keystore propio y permanente (por ejemplo, con `keytool -genkeypair -v -keystore chiaplast-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias chiaplast`) y guarda una copia segura fuera del repositorio. Configura estos GitHub Actions Secrets en el repositorio:

- `ANDROID_KEYSTORE_BASE64`: contenido del keystore codificado en Base64.
- `ANDROID_KEYSTORE_PASSWORD`: contraseña del keystore.
- `ANDROID_KEY_ALIAS`: alias de la clave (por ejemplo, `chiaplast`).
- `ANDROID_KEY_PASSWORD`: contraseña de la clave.

No subas el keystore ni sus contraseñas al repositorio ni los compartas por chat. Al estar configurados los cuatro secretos, la acción publica `chiaplast-android-release-apk`; los APK de release de ejecuciones sucesivas usan la misma firma y aumentan su `versionCode` automáticamente. Si se pierden el keystore o sus contraseñas, Android no permitirá actualizar esa instalación con una firma nueva.

El APK `debug` y el APK `release` tienen firmas diferentes. Para pasar de uno al otro hay que desinstalar el anterior, lo que borra los datos locales de la aplicación. Para conservar los datos entre instalaciones, usa siempre el APK `release` firmado con el mismo keystore.

## Capacidades
- Formularios, borradores, recordatorios, Kanban y calendario local de mantenimiento preventivo en WebView. El calendario permite programar una máquina para un día o un periodo de siete días, abrir la orden y marcarla como hecha o aún no hecha.
- Centro de control adaptable a tabletas con indicadores locales de reportes, tareas y órdenes preventivas; navegación rápida a los flujos existentes de inspección, planificación, bitácora y configuración.
- Alarmas exactas con `AlarmManager`, reprogramación tras reinicio y notificaciones locales.
- Cámara y selección de imágenes con almacenamiento privado local.
- Impresión de notas con fotografías mediante el diálogo nativo de Android (incluye Guardar como PDF).
- Exportación Excel/PDF mediante el diálogo nativo de compartir/guardar.
- Las notas y fotografías caducadas se eliminan cuando la app vuelve a ejecutarse; Android no ejecuta la limpieza de IndexedDB mientras el proceso está cerrado.

## Permisos y límites
Android 13+ solicita permiso de notificaciones. Android 12+ puede pedir autorización de alarmas exactas en Ajustes. Si el usuario la niega, no se puede garantizar puntualidad exacta. La optimización de batería del fabricante también puede afectar avisos. Validar en un dispositivo real antes de uso en planta.
