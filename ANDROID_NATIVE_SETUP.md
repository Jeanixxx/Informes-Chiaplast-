# Chiaplast Android nativo (sin Capacitor)

## Objetivo
Empaquetar la interfaz HTML existente en una aplicación Android nativa mediante Android Studio, Kotlin y WebView. Los reportes existentes permanecen en el HTML original y se copian automáticamente al paquete de assets durante la compilación.

## Requisitos
- Android Studio estable.
- JDK 17.
- Android SDK 35.
- Dispositivo Android 12 o posterior para pruebas.
- Abrir la raíz del repositorio como proyecto Gradle.

## Construcción
1. Abrir la raíz del repositorio en Android Studio.
2. Esperar la sincronización de Gradle.
3. Conectar un dispositivo o iniciar un emulador Android 12+.
4. Ejecutar la configuración app.
5. Para generar un APK de prueba: Build > Build Bundle(s) / APK(s) > Build APK(s).

La tarea Gradle copyMainWebApp toma el archivo reportes-mtto (1).html y lo coloca como assets/www/index.html; no se mantiene una segunda copia manual del HTML.

## Almacenamiento
- La interfaz usa el almacenamiento privado de WebView/localStorage para los registros de Recordatorios y Kanban.
- Android conserva la información necesaria para reprogramar las alarmas en preferencias privadas.
- Las fotografías se copian a filesDir/evidence y se sirven a WebView mediante WebViewAssetLoader.
- No hay sincronización entre dispositivos ni servicios de nube.

## Notificaciones exactas
- Android 13+ solicita permiso para mostrar notificaciones.
- Android 12+ puede requerir que el usuario autorice alarmas exactas en los ajustes de la aplicación. Sin esa autorización, el sistema no puede garantizar avisos a la hora exacta.
- El receptor de arranque intenta reprogramar alarmas después de reiniciar el dispositivo o cambiar la hora/zona horaria.
- La política de ahorro de batería del fabricante puede afectar la entrega; validar en el teléfono de planta.

## Privacidad y seguridad
- No se carga contenido web remoto dentro del WebView.
- El puente JavaScript expone solo operaciones para alarmas y evidencias.
- Las imágenes y datos permanecen en el dispositivo. Desinstalar la aplicación o borrar sus datos puede eliminarlos.
- La cámara y las notificaciones persistentes requieren el APK; en un navegador de escritorio solo se puede probar la interfaz local.

## Estado de la base
Esta rama agrega la interfaz integrada y el esqueleto nativo. Antes de distribuir a producción hay que compilar y probar en Android Studio, validar permisos y rutas de imagen, comprobar alarmas en varios dispositivos, añadir respaldo/restauración local y revisar el comportamiento de las notificaciones al tocarlas. No se declara compilación exitosa hasta ejecutar esas pruebas.