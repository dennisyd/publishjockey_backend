/**
 * Word counting utilities for text content
 */

/**
 * Count words in a text string
 * @param {string} text - The text to count words in
 * @returns {number} Number of words
 */
function countWords(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  
  // Remove HTML tags if present
  const cleanText = text.replace(/<[^>]*>/g, ' ');
  
  // Split by whitespace and filter out empty strings
  const words = cleanText
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);
  
  return words.length;
}

/**
 * Count words in project content object
 * @param {Object} content - Project content object with key-value pairs
 * @returns {number} Total word count across all content
 */
function countProjectWords(content) {
  if (!content || typeof content !== 'object') {
    return 0;
  }
  
  let totalWords = 0;
  
  for (const [key, value] of Object.entries(content)) {
    if (typeof value === 'string') {
      totalWords += countWords(value);
    }
  }
  
  return totalWords;
}

/**
 * Check if project exceeds word limit
 * @param {Object} content - Project content object
 * @param {number|null} wordLimit - Word limit (null means unlimited)
 * @returns {Object} Result object with isValid, wordCount, and wordLimit
 */
function validateWordLimit(content, wordLimit) {
  const wordCount = countProjectWords(content);
  
  return {
    isValid: wordLimit === null || wordCount <= wordLimit,
    wordCount,
    wordLimit,
    wordsRemaining: wordLimit ? Math.max(0, wordLimit - wordCount) : null
  };
}

module.exports = {
  countWords,
  countProjectWords,
  validateWordLimit
};
