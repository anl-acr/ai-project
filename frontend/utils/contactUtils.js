export const normalizePhone = (num) => {
  if (!num) return "";
  const cleaned = num.toString().replace(/\D/g, "");
  return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
};

export const findContactByPhone = (phone, contactsList = [], directoryList = []) => {
  if (!phone) return null;
  const targetNorm = normalizePhone(phone);
  if (!targetNorm) return null;

  // 1. Check system contacts list
  if (Array.isArray(contactsList)) {
    const found = contactsList.find(c => {
      const cNorm = normalizePhone(c.phone_number);
      return cNorm === targetNorm || (c.phone_number && c.phone_number.trim() === phone.toString().trim());
    });
    if (found) {
      const fullName = `${found.first_name || ""} ${found.last_name || ""}`.trim();
      return {
        ...found,
        displayName: fullName || found.phone_number
      };
    }
  }

  // 2. Check directory list (users/extensions)
  if (Array.isArray(directoryList)) {
    const foundUser = directoryList.find(u => {
      const uNum = normalizePhone(u.number || u.extension || u.id);
      return uNum === targetNorm || u.number === phone || u.extension === phone;
    });
    if (foundUser) {
      return {
        displayName: foundUser.name || foundUser.full_name,
        phone_number: foundUser.number || foundUser.extension
      };
    }
  }

  return null;
};
