export const normalizePhone = (num) => {
  if (!num) return "";
  const cleaned = num.toString().replace(/\D/g, "");
  return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
};

export const findContactByPhone = (phone, contactsList = [], directoryList = []) => {
  if (!phone) return null;
  const rawStr = phone.toString().trim();
  const targetNorm = normalizePhone(rawStr);
  if (!targetNorm && !rawStr) return null;

  // 1. Check directory list (internal extensions / users / queues) first if short extension
  if (Array.isArray(directoryList)) {
    const foundUser = directoryList.find((u) => {
      const uExt = String(u.number || u.extension || "").trim();
      const uNorm = normalizePhone(uExt);
      return (
        (uExt && uExt === rawStr) ||
        (targetNorm && uNorm && uNorm === targetNorm)
      );
    });
    if (foundUser) {
      const resolvedName = foundUser.name || foundUser.full_name || foundUser.username || "";
      if (resolvedName) {
        return {
          ...foundUser,
          displayName: resolvedName,
          phone_number: foundUser.number || foundUser.extension,
          avatar: foundUser.avatar || foundUser.avatar_url || null,
          isInternal: true
        };
      }
    }
  }

  // 2. Check system contacts list
  if (Array.isArray(contactsList)) {
    const found = contactsList.find((c) => {
      const cNorm = normalizePhone(c.phone_number);
      return (
        (targetNorm && cNorm && cNorm === targetNorm) ||
        (c.phone_number && c.phone_number.trim() === rawStr)
      );
    });
    if (found) {
      const fullName = `${found.first_name || ""} ${found.last_name || ""}`.trim();
      return {
        ...found,
        displayName: fullName || found.phone_number,
        avatar: found.avatar || found.avatar_url || null
      };
    }
  }

  return null;
};

export const maskPhoneLast4 = (phone, shouldMask = false) => {
  if (!phone) return "";
  const str = String(phone).trim();
  if (!shouldMask) return str;
  const digits = str.replace(/\D/g, "");
  // Do not mask short internal extensions (e.g., 1000, 200)
  if (digits.length <= 5) return str;
  if (digits.length >= 10) {
    const prefix = str.slice(0, Math.max(0, str.length - 4)).trim();
    return `${prefix} ** **`;
  }
  return `${str.slice(0, Math.max(0, str.length - 4))} ** **`;
};

