Set wsh = CreateObject("WScript.Shell")
wsh.CurrentDirectory = "C:\Users\cabre\abilene-vibes"
wsh.Run """C:\Users\cabre\abilene-vibes\build-install-rentals.bat""", 1, True
