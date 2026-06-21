Set wsh = CreateObject("WScript.Shell")
wsh.CurrentDirectory = "C:\Users\cabre\abilene-vibes"
' Write timestamp to confirm this ran
Set fso = CreateObject("Scripting.FileSystemObject")
Set f = fso.OpenTextFile("C:\Users\cabre\abilene-vibes\vbs-ran.txt", 2, True)
f.WriteLine "VBS ran at: " & Now()
f.Close
' Now run reinstall
wsh.Run "cmd /c ""C:\Users\cabre\abilene-vibes\reinstall-clean.bat""", 1, True
