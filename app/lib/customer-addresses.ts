export interface CustomerAddress {
  id: string;
  name: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

export function readCustomerAddresses(): CustomerAddress[] {
  const saved = localStorage.getItem('userAddresses');
  if (!saved) return [];

  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error('Saved delivery addresses are invalid.');

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error('A saved delivery address is invalid.');
    }
    const address = entry as Record<string, unknown>;
    const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
    const name = text(address.name);
    return {
      id: text(address.id) || `saved-address-${index}`,
      name,
      label: text(address.label) || name || 'Delivery address',
      street: text(address.street),
      city: text(address.city),
      state: text(address.state),
      zipCode: text(address.zipCode) || text(address.zip),
      country: text(address.country),
      phone: text(address.phone),
      isDefault: address.isDefault === true,
    };
  });
}

export function formatCustomerAddress(address: CustomerAddress): string {
  return [
    address.name,
    address.street,
    address.city,
    address.state,
    address.zipCode,
    address.country,
    address.phone,
  ].filter(Boolean).join(', ');
}
