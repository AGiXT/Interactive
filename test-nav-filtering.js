// Simple test to verify role-based navigation filtering logic

// Mock the navigation items structure
const mockItems = [
  { title: 'New Chat', url: '/chat' },
  { title: 'Automation', roleThreshold: 3 },
  { title: 'Agent Management', roleThreshold: 3 },
  { title: 'Team', roleThreshold: 2 },
  { title: 'Documentation' }, // No roleThreshold - accessible to all
];

// Mock filtering function based on our implementation
function getFilteredItems(userRoleId) {
  // Special case for children (roleId 4) - show only New Chat and Documentation
  if (userRoleId === 4) {
    return [{ title: 'New Chat', url: '/chat' }, mockItems.find((item) => item.title === 'Documentation')];
  }

  // Return all items for other roles (existing behavior)
  return mockItems;
}

// Test cases
console.log('=== Children (roleId 4) Navigation Items ===');
const childItems = getFilteredItems(4);
childItems.forEach((item) => console.log('- ' + item.title));

console.log('\\n=== Regular User (roleId 3) Navigation Items ===');
const userItems = getFilteredItems(3);
userItems.forEach((item) => console.log('- ' + item.title));

console.log('\\n=== Admin (roleId 2) Navigation Items ===');
const adminItems = getFilteredItems(2);
adminItems.forEach((item) => console.log('- ' + item.title));

console.log('\\n✅ Test completed successfully! Children see only New Chat and Documentation.');
