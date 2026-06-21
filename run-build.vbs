Set wsh = CreateObject("WScript.Shell")
wsh.CurrentDirectory = "C:\Users\cabre\abilene-vibes"
wsh.Run """C:\Users\cabre\abilene-vibes\clean-build-install.bat""", 1, True
wsh.Run """C:\Users\cabre\abilene-vibes\reinstall-clean.bat""", 1, True
