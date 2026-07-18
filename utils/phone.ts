export const formatPhoneForWhatsApp = (phone: string | null | undefined): string => {
  if (!phone) return '';
  let cleanPhone = phone.replace(/[^\d+]/g, '');
  if (cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.substring(1);
  } else if (cleanPhone.startsWith('0')) {
      cleanPhone = '4' + cleanPhone;
  }
  return cleanPhone;
};

export const getWhatsAppLink = (phone: string | null | undefined, message?: string): string => {
  const formatted = formatPhoneForWhatsApp(phone);
  if (!formatted) return '';
  if (message) {
    return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/${formatted}`;
};
