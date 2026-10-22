/**
 * Role-Based Navigation Access Matrix as specified in SAD 4.3 and 4.5
 */
export function getNavigationItems(role) {
  switch (role) {
    case 'Admin':
      return [
        { id: 'dashboard', label: 'Admin Dashboard' },
        { id: 'users', label: 'User Accounts' },
        { id: 'audit', label: 'System Audit Log' },
        { id: 'reports', label: 'Reports' },
      ];
    case 'Staff':
      return [
        { id: 'dashboard', label: 'Staff Dashboard' },
        { id: 'search-donors-stock', label: 'Search Stock & Donors' },
        { id: 'register-donor', label: 'Register Donor' },
        { id: 'record-donation', label: 'Record Donation' },
        { id: 'stock', label: 'Blood Inventory' },
        { id: 'requests', label: 'Process Requests Queue' },
        { id: 'discard', label: 'Discard Unit' },
        { id: 'reports', label: 'Reports' },
      ];
    case 'Donor':
      return [
        { id: 'dashboard', label: 'Donor Dashboard' },
        { id: 'history', label: 'My Donation History' },
        { id: 'eligibility', label: 'Check Eligibility' },
      ];
    case 'Hospital/Patient':
      return [
        { id: 'dashboard', label: 'Hospital Dashboard' },
        { id: 'search-stock', label: 'Search Stock' },
        { id: 'request-blood', label: 'New Blood Request' },
        { id: 'track-requests', label: 'Track Requests' },
      ];
    default:
      return [{ id: 'dashboard', label: 'Dashboard' }];
  }
}

export function getRoleBadgeClass(role) {
  if (!role) return 'staff';
  if (role === 'Hospital/Patient') return 'hospital';
  return role.toLowerCase();
}
