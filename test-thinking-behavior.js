// Simple test script to verify thinking activity behavior
console.log('=== Testing Thinking Activity Behavior ===');

// Mock the key components
let localThinkingActivity = null;
let conversationData = [];
let conversationLengthWhenThinking = 0;
let loading = false;

// Mock the thinking activity clearing logic
function checkThinkingActivityClearing() {
  if (localThinkingActivity) {
    const currentLength = conversationData.length;
    const shouldClear = currentLength > conversationLengthWhenThinking || !loading;

    // Also check if any new messages have different timestamps than our thinking activity
    const hasNewerMessages = conversationData.some(
      (msg) => new Date(msg.timestamp) > new Date(localThinkingActivity.timestamp),
    );

    console.log('Checking thinking activity clearing:', {
      localThinkingActivity: !!localThinkingActivity,
      currentLength,
      lengthWhenThinking: conversationLengthWhenThinking,
      loading,
      hasNewerMessages,
      shouldClear: shouldClear || hasNewerMessages,
      reason: hasNewerMessages
        ? 'newer messages detected'
        : currentLength > conversationLengthWhenThinking
          ? 'new messages detected'
          : 'loading stopped',
    });

    if (shouldClear || hasNewerMessages) {
      console.log('🧹 Clearing thinking activity');
      localThinkingActivity = null;
      return true;
    }
  }
  return false;
}

// Test scenario 1: Starting with thinking activity
console.log('\n--- Test 1: Starting conversation ---');
loading = true;
conversationData = [{ role: 'user', message: 'Hello', timestamp: '2025-06-19T10:00:00.000Z' }];
conversationLengthWhenThinking = 1;
localThinkingActivity = {
  role: 'assistant',
  message: '[ACTIVITY] Thinking...',
  timestamp: '2025-06-19T10:00:01.000Z',
  children: [],
  id: 'thinking-123',
};

console.log('Initial state - thinking activity should be visible');
checkThinkingActivityClearing(); // Should not clear yet

// Test scenario 2: New message arrives via polling
console.log('\n--- Test 2: New message arrives ---');
conversationData.push({
  role: 'assistant',
  message: '[ACTIVITY] Searching the web...',
  timestamp: '2025-06-19T10:00:02.000Z',
});

console.log('New message added - thinking activity should be cleared');
const cleared = checkThinkingActivityClearing(); // Should clear now
console.log('Thinking activity cleared:', cleared);

// Test scenario 3: Loading stops
console.log('\n--- Test 3: Loading stops ---');
localThinkingActivity = {
  role: 'assistant',
  message: '[ACTIVITY] Thinking...',
  timestamp: '2025-06-19T10:00:03.000Z',
  children: [],
  id: 'thinking-456',
};
loading = false;

console.log('Loading stopped - thinking activity should be cleared');
const clearedOnStop = checkThinkingActivityClearing(); // Should clear now
console.log('Thinking activity cleared:', clearedOnStop);

console.log('\n=== Test Complete ===');
