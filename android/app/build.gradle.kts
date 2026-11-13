plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Monotonic identity for every build, supplied by the release workflow as the GitHub Actions run
// number. versionCode/versionName only change when a release is cut, so the beta channel — which
// rebuilds on every push to `main` — would otherwise have no way to tell two builds of the same
// version apart. Left at 0 for local builds, which the updater reads as "not a CI build" and
// falls back to its timestamp heuristic for.
val bdsBuildId: Long = (project.findProperty("bdsBuildId") as String?)?.toLongOrNull() ?: 0L

// The ONE version string of the app: CI passes `-PbdsVersionName=$(node -p version)`
// from package.json, so the APK's versionName, the release tag (`v$version`) and the
// value the in-app updater compares against can never drift apart again. A drift is
// not cosmetic: with an older versionName inside the APK, every launch sees a
// "newer" release on GitHub and offers the same update forever.
// Falls back to this literal for a local build without the property.
val bdsVersionName: String = (project.findProperty("bdsVersionName") as String?)?.takeIf { it.isNotBlank() } ?: "2.0.0"

// The model list is DATA, not code: published as a release asset of this repo and
// shipped in the APK so the very first launch works offline. Staged from the
// repository root so the app and the published file can never disagree.
val stageModelList by tasks.registering(Copy::class) {
    from(rootProject.file("../models.json"))
    into(layout.projectDirectory.dir("src/main/assets/models"))
}
tasks.named("preBuild") { dependsOn(stageModelList) }

android {
    namespace = "com.arenadeck.app"
    compileSdk = 34

    buildFeatures {
        buildConfig = true
    }
    
    defaultConfig {
        applicationId = "com.arenadeck.app"
        minSdk = 26
        targetSdk = 34
        // Monotonically increasing versionCode ensures updates install smoothly over older versions
        versionCode = (1000L + bdsBuildId).toInt()
        // Comes from package.json via -PbdsVersionName (see bdsVersionName above).
        versionName = bdsVersionName
        buildConfigField("long", "BUILD_ID", "${bdsBuildId}L")
        // The one chat site this app wraps: Site.kt (native) and bds/sd-site.js
        // (engine) both branch on it. The deep-link host follows the same
        // switch, so the app can only ever claim arena.ai URLs.
        buildConfigField("String", "SITE_ID", "\"arena\"")
        manifestPlaceholders["siteHost"] = "arena.ai"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // ── One app: ArenaPilot ─────────────────────────────────────────────────
    // One site (arena.ai), one applicationId, one name. The app id is unchanged
    // since the first release on purpose: it is what makes an update install over
    // the app people already have. Nothing else about the identity is inherited —
    // package, theme, assets, strings and the model list are ArenaPilot's own.

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        signingConfigs {
            create("release") {
                val permanentKeystore = file("superdeepseek-release.jks").takeIf { it.exists() }
                    ?: rootProject.file("ci-release.jks").takeIf { it.exists() }
                    ?: rootProject.file("android/app/superdeepseek-release.jks").takeIf { it.exists() }

                if (permanentKeystore != null && permanentKeystore.exists()) {
                    storeFile = permanentKeystore
                    val envStorePass = System.getenv("BDS_KEYSTORE_PASSWORD")
                    val envAlias = System.getenv("BDS_KEY_ALIAS")
                    val envKeyPass = System.getenv("BDS_KEY_PASSWORD")

                    storePassword = if (!envStorePass.isNullOrEmpty()) envStorePass else "superdeepseek"
                    keyAlias = if (!envAlias.isNullOrEmpty()) envAlias else "superdeepseek"
                    keyPassword = if (!envKeyPass.isNullOrEmpty()) envKeyPass else "superdeepseek"
                } else {
                    // Fallback to debug keystore when release keystore is not supplied
                    val debugConfig = getByName("debug")
                    storeFile = debugConfig.storeFile
                    storePassword = debugConfig.storePassword
                    keyAlias = debugConfig.keyAlias
                    keyPassword = debugConfig.keyPassword
                }
            }
        }
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources {
            excludes += setOf("META-INF/AL2.0", "META-INF/LGPL2.1")
        }
        jniLibs {
            // The Linux sandbox execs proot from nativeLibraryDir (the only app
            // location Android allows exec() from), so the libraries must be
            // extracted at install time rather than mapped from the APK.
            useLegacyPackaging = true
            // proot and its loader are executables, not ordinary libraries: ship
            // them exactly as fetched.
            keepDebugSymbols += setOf("**/libproot.so", "**/libproot-loader.so", "**/libproot-loader32.so", "**/libtalloc.so")
        }
    }

    testOptions {
        unitTests {
            isReturnDefaultValues = true
            isIncludeAndroidResources = true
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.documentfile:documentfile:1.0.1")

    implementation("com.google.android.material:material:1.12.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.mockito:mockito-core:5.12.0")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.4.0")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.json:json:20240303")
    testImplementation("org.robolectric:robolectric:4.13")

    androidTestImplementation("androidx.test.ext:junit-ktx:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation("androidx.test:rules:1.6.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
