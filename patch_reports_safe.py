import re

with open("frontend/components/dashboard/ReportsPanel.js", "r") as f:
    content = f.read()

# Fix getCallDirection
old_direction = """    // If caller is an internal extension (e.g. 1000, 1001) and callee is external, it's outbound.
    if (callee.length >= 10 || callee.startsWith("+")) {
      // Assuming 1000 or similar is AI extension
      if (caller === "1000" || caller.toLowerCase() === "ai") return "Giden (AI)";
      return "Giden (Temsilci)";
    }"""
new_direction = """    // If caller is an internal extension (e.g. 1000, 1001) and callee is external, it's outbound.
    if (callee.length >= 10 || callee.startsWith("+") || callee.length >= 3) {
      if (caller.toLowerCase() === "ai") return "Giden (AI)";
      return "Giden (Temsilci)";
    }"""
content = content.replace(old_direction, new_direction)

# Fix getConversant and add getCustomerNumber
old_conversant = """  const getConversant = (call) => {
    if (!call) return "";
    const safeId = String(call.id || "");
    if (call.status === "transferred") {
      return safeId.length > 2 && safeId.charCodeAt(2) % 2 === 0 ? "Ahmet Yılmaz (Agent)" : "Merve Kaya (Agent)";
    }
    
    const direction = getCallDirection(call);
    if (direction === "Gelen" || direction === "Giden (AI)") {
      return "AI Agent Ece";
    }
    
    return "Merve Kaya (Agent)";
  };"""
new_conversant = """  const getConversant = (call) => {
    if (!call) return "";
    const safeId = String(call.id || "");
    if (call.status === "transferred") {
      return "Temsilci";
    }
    
    const direction = getCallDirection(call);
    if (direction === "Giden (Temsilci)") {
      return call.caller_number; // Agent extension
    } else if (direction === "Gelen" || direction === "Giden (AI)") {
      return "AI Agent Ece";
    }
    
    return "Temsilci";
  };

  const getCustomerNumber = (call) => {
    if (!call) return "";
    const dir = getCallDirection(call);
    return dir.includes("Giden") ? call.callee_number : call.caller_number;
  };"""
content = content.replace(old_conversant, new_conversant)

# First, rename the properties where they should be replaced in JSX and Filters
# We only want to replace `obj.caller_number` where obj is one of: c, call, selectedTimelineCall, selectedTranscriptCall, selectedQACall, selectedNotesCall, selectedCall, activeAudioCall
# EXCEPT we must NOT replace `call.caller_number` inside getCallDirection and getConversant functions!
# To do this safely, we will do regex replacements EXCEPT for the exact strings in those functions.

# The only occurrences of `call.caller_number` in JS logic (not JSX) are:
# line 421: `        call.caller_number,` -> should be getCustomerNumber
# line 770: `    const caller = String(call.caller_number || "");` -> THIS IS getCallDirection! Must stay.
# line 830: description -> should be getCustomerNumber
# line 996: description -> should be getCustomerNumber
# line 1018: description -> should be getCustomerNumber
# line 1033: description -> should be getCustomerNumber
# In `getConversant` we added `return call.caller_number;` -> Must stay.

# Let's just do a manual string replace of the exact lines in `getCallDirection` and `getConversant` with a placeholder, then regex replace, then restore.

placeholder_getcalldir = "___CALLER_NUMBER_GETCALLDIR___"
placeholder_getconversant = "___CALLER_NUMBER_GETCONVERSANT___"

content = content.replace('const caller = String(call.caller_number || "");', f'const caller = String({placeholder_getcalldir} || "");')
content = content.replace('return call.caller_number; // Agent extension', f'return {placeholder_getconversant}; // Agent extension')

# Now apply regex for JSX and other usages
content = re.sub(r'\bc\.caller_number\b', 'getCustomerNumber(c)', content)
content = re.sub(r'\bcall\.caller_number\b', 'getCustomerNumber(call)', content)
content = re.sub(r'\bselectedTimelineCall\.caller_number\b', 'getCustomerNumber(selectedTimelineCall)', content)
content = re.sub(r'\bselectedTranscriptCall\.caller_number\b', 'getCustomerNumber(selectedTranscriptCall)', content)
content = re.sub(r'\bselectedQACall\.caller_number\b', 'getCustomerNumber(selectedQACall)', content)
content = re.sub(r'\bselectedNotesCall\.caller_number\b', 'getCustomerNumber(selectedNotesCall)', content)
content = re.sub(r'\bselectedCall\.caller_number\b', 'getCustomerNumber(selectedCall)', content)
content = re.sub(r'\bactiveAudioCall\.caller_number\b', 'getCustomerNumber(activeAudioCall)', content)

# Restore the placeholders
content = content.replace(placeholder_getcalldir, 'call.caller_number')
content = content.replace(placeholder_getconversant, 'call.caller_number')

with open("frontend/components/dashboard/ReportsPanel.js", "w") as f:
    f.write(content)

print("Patch applied successfully.")
