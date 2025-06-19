// Simple debug script to test thinking activity behavior
console.log('Testing thinking activity behavior');

// Simulate the thinking activity clearing logic
function testThinkingClear() {
  const localThinkingActivity = {
    id: 'thinking-123',
    timestamp: new Date().toISOString(),
    message: '[ACTIVITY] Thinking...',
  };

  const conversationLengthWhenThinking = 2;
  const loading = true;

  // Test case 1: No new messages
  let conversationData = [
    { id: 'msg1', timestamp: '2024-01-01T10:00:00Z' },
    { id: 'msg2', timestamp: '2024-01-01T10:01:00Z' },
  ];

  console.log('Test 1 - No new messages:', {
    shouldClear: conversationData.length > conversationLengthWhenThinking || !loading,
    currentLength: conversationData.length,
    lengthWhenThinking: conversationLengthWhenThinking,
    loading,
  });

  // Test case 2: New message arrives
  conversationData = [
    { id: 'msg1', timestamp: '2024-01-01T10:00:00Z' },
    { id: 'msg2', timestamp: '2024-01-01T10:01:00Z' },
    { id: 'msg3', timestamp: new Date(Date.now() + 1000).toISOString() }, // Future timestamp
  ];

  const hasNewerMessages = conversationData.some(
    (msg) => new Date(msg.timestamp) > new Date(localThinkingActivity.timestamp),
  );

  const hasRealMessages = conversationData.some(
    (msg) => msg.id !== localThinkingActivity.id && new Date(msg.timestamp) >= new Date(localThinkingActivity.timestamp),
  );

  console.log('Test 2 - New message arrives:', {
    shouldClear: conversationData.length > conversationLengthWhenThinking || !loading,
    currentLength: conversationData.length,
    lengthWhenThinking: conversationLengthWhenThinking,
    loading,
    hasNewerMessages,
    hasRealMessages,
    finalDecision:
      conversationData.length > conversationLengthWhenThinking || !loading || hasNewerMessages || hasRealMessages,
  });
}

testThinkingClear();
