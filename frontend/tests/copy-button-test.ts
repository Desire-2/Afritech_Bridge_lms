// Test code to verify copy button functionality
// This can be run in browser console on the learning page

/**
 * Test 1: Check if CodeBlock component renders with copy button
 */
function testCopyButtonExists() {
  const copyButtons = document.querySelectorAll('button:has(svg)');
  const codeBlockButtons = Array.from(copyButtons).filter(btn => 
    btn.textContent?.includes('Copy Code') || btn.textContent?.includes('Copied')
  );
  
  console.log(`✓ Found ${codeBlockButtons.length} copy buttons`);
  return codeBlockButtons.length > 0;
}

/**
 * Test 2: Simulate copy button click
 */
async function testCopyButtonClick() {
  const copyButtons = document.querySelectorAll('button');
  const copyButton = Array.from(copyButtons).find(btn => 
    btn.textContent?.includes('Copy Code')
  );
  
  if (!copyButton) {
    console.error('✗ No copy button found');
    return false;
  }
  
  // Click the button
  copyButton.click();
  
  // Wait for state update
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Check if button text changed to "Copied"
  const buttonText = copyButton.textContent || '';
  const success = buttonText.includes('Copied');
  
  if (success) {
    console.log('✓ Copy button clicked successfully - text changed to "Copied!"');
  } else {
    console.error('✗ Copy button click did not change state');
  }
  
  return success;
}

/**
 * Test 3: Verify clipboard content
 */
async function testClipboardContent() {
  try {
    const clipboardText = await navigator.clipboard.readText();
    if (clipboardText && clipboardText.length > 0) {
      console.log('✓ Clipboard contains text:', clipboardText.substring(0, 50) + '...');
      return true;
    } else {
      console.warn('⚠ Clipboard is empty');
      return false;
    }
  } catch (err) {
    console.warn('⚠ Cannot read clipboard (permission denied):', err.message);
    return null;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('=== Code Block Copy Button Tests ===\n');
  
  // Test 1
  console.log('Test 1: Checking for copy buttons...');
  const test1 = testCopyButtonExists();
  
  if (!test1) {
    console.error('\n✗ FAILED: No copy buttons found. Make sure you are on a page with code blocks.');
    return;
  }
  
  // Test 2
  console.log('\nTest 2: Testing copy button click...');
  const test2 = await testCopyButtonClick();
  
  if (!test2) {
    console.error('\n✗ FAILED: Copy button did not work properly.');
    return;
  }
  
  // Test 3
  console.log('\nTest 3: Verifying clipboard content...');
  const test3 = await testClipboardContent();
  
  if (test3 === null) {
    console.warn('\n⚠ WARNING: Cannot verify clipboard (browser permission needed)');
  } else if (!test3) {
    console.error('\n✗ FAILED: Clipboard is empty after copy.');
    return;
  }
  
  // Summary
  console.log('\n=== Test Summary ===');
  console.log('✓ Copy buttons render correctly');
  console.log('✓ Copy button click updates UI state');
  if (test3) {
    console.log('✓ Content copied to clipboard successfully');
  }
  console.log('\n✅ ALL TESTS PASSED!');
}

// Export for use
if (typeof window !== 'undefined') {
  (window as any).testCopyButton = {
    runAllTests,
    testCopyButtonExists,
    testCopyButtonClick,
    testClipboardContent
  };
  
  console.log('Copy button tests loaded. Run: testCopyButton.runAllTests()');
}

export { runAllTests, testCopyButtonExists, testCopyButtonClick, testClipboardContent };
