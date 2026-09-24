"""Package the restored CF artwork; never redraw or regenerate its identity.

Requires Pillow. Run from any directory: python tools/brand/package-app-icon.py
Master: the opaque 1024px iOS icon from Git commit 0bcf661.
"""
from pathlib import Path
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "tools/brand"
MASTER = BRAND / "masters/app-icon.png"
icon = Image.open(MASTER)
assert icon.size == (1024, 1024) and icon.mode == "RGB", "iOS master must be opaque RGB 1024x1024"

shutil.copyfile(MASTER, ROOT / "apps/game/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")
res = ROOT / "apps/game/android/app/src/main/res"
(res / "drawable-nodpi").mkdir(parents=True, exist_ok=True)
icon.resize((432, 432), Image.Resampling.LANCZOS).save(res / "drawable-nodpi/cf_launcher_art.png", optimize=True)
(res / "drawable/cf_launcher_foreground.xml").write_text('''<?xml version="1.0" encoding="utf-8"?>
<!-- Keep the CF crest inside the adaptive launcher's safe region. -->
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/cf_launcher_art" android:inset="18dp" />
''', encoding="utf-8")
(res / "mipmap-anydpi/ic_launcher.xml").write_text('''<?xml version="1.0" encoding="utf-8"?>
<!-- API 24-25 uses the original complete artwork. -->
<bitmap xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@drawable/cf_launcher_art" android:gravity="fill" />
''', encoding="utf-8")
mark = (BRAND / "mark.path.txt").read_text(encoding="utf-8").strip()
(res / "drawable/ic_launcher_monochrome.xml").write_text(f'''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
    <group android:scaleX="1.03125" android:scaleY="1.03125" android:translateX="21" android:translateY="21">
        <path android:fillColor="#FFFFFF" android:fillType="evenOdd" android:pathData="{mark}" />
    </group>
</vector>
''', encoding="utf-8")
store = ROOT / "artifacts/icon-restoration"
store.mkdir(parents=True, exist_ok=True)
icon.resize((512, 512), Image.Resampling.LANCZOS).save(store / "play-icon.png", optimize=True)
print("Restored CF iOS icon, Android adaptive/legacy/themed resources, and Play listing icon.")
