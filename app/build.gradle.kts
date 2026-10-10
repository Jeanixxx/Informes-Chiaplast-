import org.gradle.api.tasks.Sync

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "mx.chiaplast.mantenimiento"
    compileSdk = 35
    defaultConfig {
        applicationId = "mx.chiaplast.mantenimiento"
        minSdk = 31
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.1"
    }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
val copyMainWebApp by tasks.registering(Sync::class) {
    from(rootProject.file("reportes-mtto (1).html"))
    into(layout.buildDirectory.dir("generated/chiaplastAssets/www"))
    rename { "index.html" }
}
android.sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/chiaplastAssets"))
tasks.named("preBuild").configure { dependsOn(copyMainWebApp) }
