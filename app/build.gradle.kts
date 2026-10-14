import org.gradle.api.tasks.Sync

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val releaseStoreFile = providers.environmentVariable("ANDROID_KEYSTORE_PATH").orNull
val releaseStorePassword = providers.environmentVariable("ANDROID_KEYSTORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("ANDROID_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("ANDROID_KEY_PASSWORD").orNull
val releaseSigningValues = listOf(releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword)
val hasReleaseSigningValues = releaseSigningValues.any { !it.isNullOrBlank() }
val hasCompleteReleaseSigningValues = releaseSigningValues.all { !it.isNullOrBlank() }
require(!hasReleaseSigningValues || hasCompleteReleaseSigningValues) {
    "Release signing requires ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS and ANDROID_KEY_PASSWORD."
}
val ciVersionCode = providers.environmentVariable("GITHUB_RUN_NUMBER").orNull?.toIntOrNull() ?: 1

android {
    namespace = "mx.chiaplast.mantenimiento"
    compileSdk = 35
    defaultConfig {
        applicationId = "mx.chiaplast.mantenimiento"
        minSdk = 31
        targetSdk = 35
        versionCode = ciVersionCode
        versionName = "1.0.2"
    }
    signingConfigs {
        if (hasCompleteReleaseSigningValues) {
            create("release") {
                storeFile = file(requireNotNull(releaseStoreFile))
                storePassword = requireNotNull(releaseStorePassword)
                keyAlias = requireNotNull(releaseKeyAlias)
                keyPassword = requireNotNull(releaseKeyPassword)
            }
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (hasCompleteReleaseSigningValues) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
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
tasks.matching { it.name == "packageRelease" || it.name == "bundleRelease" }.configureEach {
    doFirst {
        check(hasCompleteReleaseSigningValues) {
            "Release outputs must be signed. Configure ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS and ANDROID_KEY_PASSWORD."
        }
    }
}
