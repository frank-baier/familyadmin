-- Exports all Apple Notes folders (including nested subfolders) and their notes
-- to a JSON file on the Desktop, preserving the real folder hierarchy.
-- Run with:  osascript export_apple_notes.applescript
--
-- Output: ~/Desktop/apple_notes_export.json
--   [ { "id": "...", "name": "Reisen", "parentFolderId": null, "notes": [ { "title": "...", "body": "..." }, ... ] },
--     { "id": "...", "name": "2023 Amsterdam", "parentFolderId": "<Reisen's id>", "notes": [...] }, ... ]

on replaceText(theText, oldText, newText)
	set {tid, AppleScript's text item delimiters} to {AppleScript's text item delimiters, oldText}
	set theItems to text items of theText
	set AppleScript's text item delimiters to newText
	set theText to theItems as text
	set AppleScript's text item delimiters to tid
	return theText
end replaceText

on escapeJSON(theText)
	set theText to replaceText(theText, "\\", "\\\\")
	set theText to replaceText(theText, "\"", "\\\"")
	set theText to replaceText(theText, return & linefeed, "\\n")
	set theText to replaceText(theText, return, "\\n")
	set theText to replaceText(theText, linefeed, "\\n")
	set theText to replaceText(theText, tab, "\\t")
	return theText
end escapeJSON

set outputText to "["
set isFirstFolder to true

tell application "Notes"
	repeat with theFolder in folders
		set folderId to (id of theFolder) as text
		set folderName to (name of theFolder) as text

		set parentFolderId to ""
		try
			set theContainer to container of theFolder
			if (class of theContainer) is folder then
				set parentFolderId to (id of theContainer) as text
			end if
		end try

		set noteList to {}
		try
			set theNotes to notes of theFolder
		on error
			set theNotes to {}
		end try

		repeat with theNote in theNotes
			try
				set noteTitle to (name of theNote) as text
				set noteBody to (plaintext of theNote) as text
				set end of noteList to "{\"title\":\"" & my escapeJSON(noteTitle) & "\",\"body\":\"" & my escapeJSON(noteBody) & "\"}"
			end try
		end repeat

		if not isFirstFolder then set outputText to outputText & ","
		set isFirstFolder to false

		set AppleScript's text item delimiters to ","
		set notesJoined to noteList as text
		set AppleScript's text item delimiters to ""

		set parentJsonValue to "null"
		if parentFolderId is not "" then set parentJsonValue to "\"" & my escapeJSON(parentFolderId) & "\""

		set outputText to outputText & "{\"id\":\"" & my escapeJSON(folderId) & "\",\"name\":\"" & my escapeJSON(folderName) & "\",\"parentFolderId\":" & parentJsonValue & ",\"notes\":[" & notesJoined & "]}"
	end repeat
end tell

set outputText to outputText & "]"

set outputPath to (POSIX path of (path to desktop folder)) & "apple_notes_export.json"
set fileRef to open for access outputPath with write permission
set eof of fileRef to 0
write outputText to fileRef as «class utf8»
close access fileRef

return "Exported to " & outputPath
